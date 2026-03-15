import os
import requests
import random
import string
import json
from datetime import datetime, timedelta
from typing import List, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from database import create_db_and_tables, get_session, engine
from models import Task, Participant, TaskCreate, ParticipantCreate, ParticipantUpdate, ParticipantSubmit

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

MESHY_API_KEY = os.getenv("MESHY_API_KEY", "msy_MeTsyL39y0iEOeaJO8Zn28MXVYGcU6XSktn8")

class ThreeDPrompt(BaseModel):
    geometry: str = Field(description="Detailed description of the 3D shape and structure")
    texture: str = Field(description="Description of materials, colors, and surface properties")
    style: str = Field(description="Visual style like low-poly, realistic, or stylized")
    final_prompt: str = Field(description="A condensed single-string prompt for the 3D generator")

class TaskAnalysis(BaseModel):
    is_clear: bool = Field(description="Is the educational objective of the task clear and specific?")
    objective: Optional[str] = Field(description="A clear, 1-sentence educational goal/objective of the task")
    grading_criteria: Optional[str] = Field(description="Explicit rules for how to grade the student's submission. What specific parts must they generate to get a good score?")
    feedback: str = Field(description="Feedback to the teacher. If is_clear is False, ask for clarification. If True, confirm success.")

class GradingResult(BaseModel):
    score: int = Field(description="Score from 1 to 12 based on the student's generated models compared to the teacher's objective.")
    feedback: str = Field(description="Encouraging and constructive feedback for the student in Ukrainian.")

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
parser = JsonOutputParser(pydantic_object=ThreeDPrompt)
analysis_parser = JsonOutputParser(pydantic_object=TaskAnalysis)
grading_parser = JsonOutputParser(pydantic_object=GradingResult)

three_d_system_prompt = (
    "You are a specialized 3D Technical Artist. Convert user concepts into 3D AI prompts.\n\n"
    "ВАЖЛИВО: Модель має бути кольоровою, як у підручнику. Використовуйте яскраві, контрастні кольори для різних частин.\n"
    "Your output must be optimized for Meshy V2 text-to-3d.\n"
    "1. geometry: Describe shape clearly.\n"
    "2. texture: MUST include vivid colors (e.g., 'bright red core', 'emerald green surface', 'white semitransparent membrane'). Describe surface properties (shiny, matte).\n"
    "3. style: Use 'pbr' or 'realistic' for better materials.\n"
    "4. final_prompt: A single detailed prompt combining geometry, textures, AND VIVID COLORS. Use keywords like 'high-quality PBR textures', 'vivid colors', 'vibrant educational model'.\n\n"
    "{format_instructions}"
)

analysis_system_prompt = (
    "Ви — професійний Методист та Освітній Асистент. Ваша роль — проаналізувати запит вчителя на створення 3D завдання.\n\n"
    "ВАШЕ ЗАВДАННЯ:\n"
    "1. Визначити, чи зрозуміла навчальна мета завдання (наприклад, 'вивчити будову клітини', 'зібрати модель атома').\n"
    "2. Якщо мета розмита, встановіть is_clear = false та ввічливо попросіть вчителя уточнити.\n"
    "3. Якщо мета зрозуміла, встановіть is_clear = true та сформулюйте лаконічну ціль у полі objective.\n"
    "4. У полі grading_criteria чітко опишіть, що має зробити учень, щоб отримати максимальну оцінку (які об'єкти він має згенерувати).\n"
    "5. У полі feedback напишіть надихаючу відповідь українською мовою.\n\n"
    "{format_instructions}"
)

grading_system_prompt = (
    "Ви — об'єктивний Вчитель-Асистент. Ваша мета — оцінити роботу учня у 3D лабораторії за 12-бальною шкалою.\n\n"
    "ДАНІ ДЛЯ ОЦІНЮВАННЯ:\n"
    "- Мета завдання (від вчителя): {objective}\n"
    "- Критерії оцінювання: {grading_criteria}\n"
    "- Побудована сцена (дані учня): {student_data}\n\n"
    "ІНСТРУКЦІЯ:\n"
    "1. Проаналізуйте склад сцени (що саме згенерував учень).\n"
    "2. ВАЖЛИВО: Оцініть ВЗАЄМНЕ РОЗМІЩЕННЯ об'єктів (spatial_data: position [x, y, z]).\n"
    "   - Чи знаходяться внутрішні елементи (наприклад, ядро, органели) ВСЕРЕДИНІ оболонки?\n"
    "   - Чи дотримано логічних відстаней між частинами?\n"
    "   - Якщо координати об'єктів майже однакові, вони накладені один на одного.\n"
    "3. Поставте оцінку від 1 до 12 (score).\n"
    "4. Напишіть детальний фідбек українською мовою (feedback), пояснивши, що розміщено правильно, а що ні.\n\n"
    "{format_instructions}"
)

prompt_template = ChatPromptTemplate.from_messages([
    ("system", three_d_system_prompt),
    ("human", "{user_input}")
])

analysis_template = ChatPromptTemplate.from_messages([
    ("system", analysis_system_prompt),
    ("human", "{user_input}")
])

grading_template = ChatPromptTemplate.from_messages([
    ("system", grading_system_prompt),
    ("human", "Оцініть цю роботу.")
])

def generate_room_code():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

class TaskUpdate(BaseModel):
    base_model_config: Optional[dict] = None

@app.patch("/task/{task_id}")
async def update_task(task_id: str, data: TaskUpdate, session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if not task: raise HTTPException(status_code=404, detail="Task not found")
    if data.base_model_config is not None:
        task.base_model_config = json.dumps(data.base_model_config)
    session.add(task)
    session.commit()
    return {"ok": True}

@app.post("/prompt")
async def handle_prompt(data: TaskCreate, session: Session = Depends(get_session)):
    try:
        previous_context = ""
        current_task = None
        
        
        if data.task_id:
            current_task = session.get(Task, data.task_id)
            if current_task:
                previous_context = f"Попередня модель була створена за запитом: {current_task.prompt}. "

        
        if not data.task_id:
            statement = select(Task).where(Task.prompt == data.prompt, Task.status == "SUCCEEDED")
            existing_task = session.exec(statement).first()
            if existing_task and existing_task.model_url:
                return {
                    "ok": True, 
                    "is_final": True,
                    "task_id": existing_task.id, 
                    "llm_answer": existing_task.user_feedback or "Завдання готове!"
                }

        
        analysis_chain = analysis_template | llm | analysis_parser
        analysis = analysis_chain.invoke({
            "user_input": previous_context + data.prompt,
            "format_instructions": analysis_parser.get_format_instructions()
        })

        if not analysis["is_clear"]:
            return {
                "ok": True,
                "is_final": False, 
                "task_id": data.task_id or "NEW",
                "llm_answer": analysis["feedback"]
            }

        technical_response = (prompt_template | llm | parser).invoke({
            "user_input": previous_context + data.prompt, 
            "format_instructions": parser.get_format_instructions()
        })

        if current_task:
            
            current_task.prompt = f"{current_task.prompt} -> {data.prompt}"
            current_task.description = analysis.get("objective")
            current_task.grading_criteria = analysis.get("grading_criteria")
            current_task.user_feedback = analysis["feedback"]
            current_task.status = "PROCESSING"
            room_code = current_task.id
        else:
            
            room_code = generate_room_code()
            current_task = Task(
                id=room_code, 
                prompt=data.prompt,
                description=analysis.get("objective"),
                grading_criteria=analysis.get("grading_criteria"),
                user_feedback=analysis["feedback"],
                status="PROCESSING"
            )
        
        session.add(current_task)
        session.commit()

        
        payload = {
            "mode": "preview",
            "prompt": technical_response['final_prompt'],
            "art_style": "pbr",
        }

        res = requests.post(
            "https://api.meshy.ai/openapi/v2/text-to-3d",
            headers={"Authorization": f"Bearer {MESHY_API_KEY}"},
            json=payload
        )
        res_data = res.json()
        meshy_id = res_data.get("result")
        
        if not meshy_id:
            print(f"DEBUG: Meshy API error: {res_data}")
            current_task.status = "FAILED"
        else:
            current_task.meshy_task_id = meshy_id
            print(f"DEBUG: Meshy task created: {meshy_id}")
            
        session.add(current_task)
        session.commit()
        
        return {
            "ok": True, 
            "is_final": True,
            "task_id": room_code, 
            "llm_answer": analysis["feedback"]
        }
    except Exception as e:
        print(f"DATABASE ERROR: {e}")
        return {"ok": False, "error": "Database schema mismatch. Please delete classroom.db and restart server."}

@app.get("/task/{task_id}")
async def get_task_status(task_id: str, session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if not task: raise HTTPException(status_code=404, detail="Task not found")
    
    if task.meshy_task_id:
        url = f"https://api.meshy.ai/openapi/v2/text-to-3d/{task.meshy_task_id}"
        res = requests.get(url, headers={"Authorization": f"Bearer {MESHY_API_KEY}"})
        data = res.json()
        
        print(f"DEBUG: Meshy API response for {task_id}: {data.get('status')} - {data.get('progress')}%")
        
        task.status = data.get("status", task.status)
        
        # Automatic refinement logic: if preview SUCCEEDED, start refine
        if task.status == "SUCCEEDED" and data.get("mode") == "preview":
            print(f"DEBUG: Preview SUCCEEDED for {task_id}. Starting refinement...")
            refine_payload = {
                "mode": "refine",
                "preview_task_id": task.meshy_task_id
            }
            refine_res = requests.post(
                "https://api.meshy.ai/openapi/v2/text-to-3d",
                headers={"Authorization": f"Bearer {MESHY_API_KEY}"},
                json=refine_payload
            )
            refine_data = refine_res.json()
            new_meshy_id = refine_data.get("result")
            if new_meshy_id:
                task.meshy_task_id = new_meshy_id
                task.status = "PENDING" 
                session.add(task)
                session.commit()
                return {"status": "REFINING", "progress": 0}

        if task.status == "SUCCEEDED":
            model_urls = data.get("model_urls", {})
            task.model_url = model_urls.get("glb") or model_urls.get("fbx") or model_urls.get("obj")
            print(f"DEBUG: Task {task_id} SUCCEEDED. Model URL: {task.model_url}")
        
        session.add(task)
        session.commit()
        
        data["model_url"] = task.model_url
        return data

    return {"status": task.status, "model_url": task.model_url}

@app.get("/task/{task_id}/participants")
async def get_task_participants(task_id: str, session: Session = Depends(get_session)):
    statement = select(Participant).where(Participant.task_id == task_id)
    participants = session.exec(statement).all()
    return participants

@app.get("/proxy")
async def proxy_model(url: str):
    print(f"DEBUG: Proxying model from URL: {url}")
    # Fix potential Meshy URL parameter issues
    if ".glbExpires=" in url: 
        url = url.replace(".glbExpires=", ".glb?Expires=")
    elif ".glb" in url and "Expires=" in url and "?" not in url:
        url = url.replace("Expires=", "?Expires=")
        
    try:
        resp = requests.get(url, stream=True, timeout=15)
        resp.raise_for_status()
        return StreamingResponse(resp.iter_content(chunk_size=4096), media_type="application/octet-stream")
    except Exception as e:
        print(f"DEBUG: Proxy error for {url}: {e}")
        raise HTTPException(status_code=500, detail=f"Proxy error: {str(e)}")

@app.post("/task/{task_id}/join")
async def join_task(task_id: str, data: ParticipantCreate, session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if not task: raise HTTPException(status_code=404, detail="Task not found")
    statement = select(Participant).where(Participant.task_id == task_id, Participant.name == data.name)
    participant = session.exec(statement).first()
    if not participant:
        participant = Participant(task_id=task_id, name=data.name, status="joined")
        session.add(participant)
    else:
        participant.status = "joined"
        participant.last_heartbeat = datetime.utcnow()
        session.add(participant)
    session.commit()
    return {"ok": True, "participant_id": participant.id}

@app.post("/task/{task_id}/participant/{name}/submit")
async def submit_work(task_id: str, name: str, data: ParticipantSubmit, session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if not task: raise HTTPException(status_code=404, detail="Task not found")
    
    statement = select(Participant).where(Participant.task_id == task_id, Participant.name == name)
    participant = session.exec(statement).first()
    if not participant: raise HTTPException(status_code=404, detail="Participant not found")

    try:
        
        grading_chain = grading_template | llm | grading_parser
        
        
        student_scene_info = {
            "prompts_used": data.prompts_used,
            "spatial_data": data.spatial_data or []
        }

        grading_result = grading_chain.invoke({
            "objective": task.description or "Невідома мета",
            "grading_criteria": task.grading_criteria or "Оцінюйте загальну якість моделювання",
            "student_data": json.dumps(student_scene_info, ensure_ascii=False),
            "format_instructions": grading_parser.get_format_instructions()
        })

        
        participant.submission_data = json.dumps(student_scene_info)
        participant.score = grading_result["score"]
        participant.ai_feedback = grading_result["feedback"]
        participant.status = "submitted"
        session.add(participant)
        session.commit()

        return {"ok": True, "score": participant.score, "feedback": participant.ai_feedback}
    except Exception as e:
        print(f"Grading Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship

class TaskBase(SQLModel):
    prompt: str
    description: Optional[str] = None 
    grading_criteria: Optional[str] = None 
    refined_prompt: Optional[str] = None
    user_feedback: Optional[str] = None
    meshy_task_id: Optional[str] = None
    status: str = "PENDING" 
    model_url: Optional[str] = None
    base_model_config: Optional[str] = None 
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Task(TaskBase, table=True):
    id: str = Field(primary_key=True) 
    participants: List["Participant"] = Relationship(back_populates="task")

class ParticipantBase(SQLModel):
    name: str
    status: str = "joined" 
    has_viewed: bool = False
    reaction: Optional[str] = None
    submission_data: Optional[str] = None 
    score: Optional[int] = None 
    ai_feedback: Optional[str] = None 
    last_heartbeat: datetime = Field(default_factory=datetime.utcnow)

class Participant(ParticipantBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: str = Field(foreign_key="task.id")
    task: Task = Relationship(back_populates="participants")

class TaskCreate(SQLModel):
    prompt: str
    task_id: Optional[str] = None

class ParticipantCreate(SQLModel):
    name: str
    task_id: str

class ParticipantUpdate(SQLModel):
    status: Optional[str] = None
    has_viewed: Optional[bool] = None
    reaction: Optional[str] = None

class ParticipantSubmit(SQLModel):
    prompts_used: List[str]
    spatial_data: Optional[List[dict]] = None from sqlmodel import SQLModel, create_engine, Session
import os

sqlite_file_name = "classroom.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)

from sqlalchemy import text

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    
    with Session(engine) as session:
        columns = [
            ("task", "description", "VARCHAR"),
            ("task", "grading_criteria", "VARCHAR"),
            ("task", "refined_prompt", "VARCHAR"),
            ("task", "user_feedback", "VARCHAR"),
            ("task", "meshy_task_id", "VARCHAR"),
            ("task", "model_url", "VARCHAR"),
            ("task", "base_model_config", "VARCHAR"),
            ("participant", "submission_data", "VARCHAR"),
            ("participant", "score", "INTEGER"),
            ("participant", "ai_feedback", "VARCHAR"),
        ]
        for table, column, type in columns:
            try:
                session.exec(text(f"ALTER TABLE {table} ADD COLUMN {column} {type}"))
                session.commit()
                print(f"Successfully added {column} to {table}.")
            except Exception:
                session.rollback()

def get_session():
    with Session(engine) as session:
        yield session"use client"

import React, { useState, useRef, useEffect, Suspense } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, ArrowUpRight, Trash2, User } from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"

import { ScrollArea } from "@/components/ui/scroll-area"


const Student3DViewer = dynamic(() => import("@/components/Student3DViewer"), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-gray-400 font-sans text-sm">Loading Laboratory...</div>
})

function TaskContent() {
  const searchParams = useSearchParams()
  const roomCode = searchParams.get("code") || "UNKNOWN"
  const studentName = searchParams.get("name") || "Студент"
  
  const [prompt, setPrompt] = useState("")
  const [promptsUsed, setPromptsUsed] = useState<string[]>([]) 
  const [models, setModels] = useState<string[]>([])
  const [modelStates, setModelStates] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [grade, setGrade] = useState<{score: number, feedback: string} | null>(null)
  const [status, setStatus] = useState<string>("")
  const [hasStarted, setHasStarted] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  
  useEffect(() => {
    if (roomCode !== "UNKNOWN") {
      const initializeTask = async () => {
        try {
          
          await fetch(`http://127.0.0.1:8000/task/${roomCode}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: studentName, task_id: roomCode })
          })

          
          const res = await fetch(`http://127.0.0.1:8000/task/${roomCode}`)
          const data = await res.json()
          
          if (data.status === "SUCCEEDED") {
            let finalUrl = data.model_url || (data.model_urls && data.model_urls.glb)
            if (finalUrl) {
              const proxyUrl = finalUrl.startsWith("http") 
                ? `http://127.0.0.1:8000/proxy?url=${encodeURIComponent(finalUrl)}`
                : finalUrl
              
              const baseConfig = data.base_model_config ? JSON.parse(data.base_model_config) : null
              
              setModels([proxyUrl])
              setModelStates([{
                url: proxyUrl,
                prompt: "Teacher Base Model",
                position: baseConfig?.position || [0, 0, 0],
                rotation: baseConfig?.rotation || [0, 0, 0],
                scale: baseConfig?.scale || [1, 1, 1]
              }])
              setHasStarted(true)
            }
          }
        } catch (err) {
          console.error("Error initializing task:", err)
        }
      }
      initializeTask()
    }
  }, [roomCode, studentName])

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [prompt])

  const pollTaskStatus = async (taskId: string, originalPrompt: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/task/${taskId}`)
        const data = await response.json()
        
        if (data.status === "SUCCEEDED") {
          clearInterval(interval)
          setStatus("Готово!")
          let finalUrl = ""
          if (data.model_urls && data.model_urls.glb) {
            finalUrl = data.model_urls.glb
          } else if (data.model_url) {
            finalUrl = data.model_url
          }

          if (finalUrl) {
            const proxyUrl = finalUrl.startsWith("http") 
              ? `http://127.0.0.1:8000/proxy?url=${encodeURIComponent(finalUrl)}`
              : finalUrl
            setModels(prev => [...prev, proxyUrl])
            setPromptsUsed(prev => [...prev, originalPrompt]) 
            
            
            setModelStates(prev => [...prev, {
              url: proxyUrl,
              prompt: originalPrompt,
              position: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1]
            }])
          }
        } else if (data.status === "FAILED") {
          clearInterval(interval)
          setStatus("Помилка генерації")
        } else {
          setStatus(`Генерація... ${data.progress || 0}%`)
        }
      } catch (err) {
        console.error("Polling error:", err)
      }
    }, 3000)
  }

  const handleSend = async () => {
    if (!prompt.trim()) return

    const currentPrompt = prompt
    setHasStarted(true)
    setIsLoading(true)
    setStatus("Обробка запиту...")

    try {
      const response = await fetch("http://127.0.0.1:8000/prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: currentPrompt }),
      })

      const data = await response.json()

      if (data.ok) {
        if (data.is_final === false) {
          // AI needs clarification
          setStatus(data.llm_answer || "Потрібне уточнення")
          // Briefly show the message then unlock input
          setTimeout(() => {
            setIsLoading(false)
            setPrompt("")
          }, 2000)
        } else if (data.task_id) {
          pollTaskStatus(data.task_id, currentPrompt)
        }
      } else {
        setStatus("Помилка сервісу")
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Error sending prompt:", error)
      setStatus("Помилка зв'язку")
      setIsLoading(false)
    }
  }

  const submitWork = async () => {
    if (promptsUsed.length === 0 && modelStates.length === 0) return
    setIsSubmitting(true)
    try {
      
      const spatialData = modelStates.map(state => ({
        prompt: state.prompt,
        position: state.position,
        rotation: state.rotation,
        scale: state.scale
      }))

      const res = await fetch(`http://127.0.0.1:8000/task/${roomCode}/participant/${encodeURIComponent(studentName)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompts_used: promptsUsed,
          spatial_data: spatialData
        })
      })
      const data = await res.json()
      if (data.ok) {
        setGrade({ score: data.score, feedback: data.feedback })
      }
    } catch (e) {
      console.error(e)
    }
    setIsSubmitting(false)
  }

  const handleModelUpdate = (states: any[]) => {
    
    setModelStates(prev => {
      return states.map((state, i) => ({
        ...state,
        prompt: prev[i]?.prompt || (i === 0 ? "Teacher Base Model" : "Generated Part")
      }))
    })
  }

  useEffect(() => {
    if (status === "Готово!" || status === "Помилка генерації" || status === "Помилка сервісу") {
      setTimeout(() => {
        setIsLoading(false)
        setPrompt("")
      }, 1000)
    }
  }, [status])

  return (
    <Card className="w-full h-[calc(100vh-48px)] bg-white rounded-[40px] border-none shadow-2xl relative overflow-hidden flex flex-col">
      {}
      <div className="absolute top-8 left-8 right-8 z-10 flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <Link href={roomCode !== "UNKNOWN" ? `/join?code=${roomCode}` : "/"}>
            <Button variant="ghost" className="text-gray-400 hover:bg-gray-100 gap-2 rounded-xl cursor-pointer">
              <ArrowLeft className="w-4 h-4" />
              Назад
            </Button>
          </Link>
          
          <div className="bg-brand/10 text-brand px-4 py-1.5 rounded-full text-sm font-medium border border-brand/20 flex items-center gap-2">
            <User className="w-3.5 h-3.5" />
            {studentName}
          </div>

          <div className="bg-gray-100 text-gray-500 px-4 py-1.5 rounded-full text-sm font-medium border border-gray-200">
            Код: {roomCode}
          </div>

          {hasStarted && modelStates.length > 0 && (
            <Button 
              onClick={() => { setModels([]); setModelStates([]); setPromptsUsed([]); }}
              variant="ghost" 
              className="text-red-400 hover:bg-red-50 hover:text-red-500 gap-2 rounded-xl cursor-pointer transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Очистити
            </Button>
          )}
        </div>

        {}
        {hasStarted && modelStates.length > 0 && !grade && (
          <Button 
            onClick={submitWork}
            disabled={isSubmitting || isLoading}
            className="bg-[#1A69F3] hover:bg-[#1A69F3]/90 text-white rounded-[40px] px-12 h-[74px] text-[24px] font-medium tracking-tight shadow-xl transition-all border-none cursor-pointer"
          >
            {isSubmitting ? "Оцінюємо..." : "Здати роботу"}
          </Button>
        )}
      </div>

      {}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {hasStarted && (
          <div className="absolute inset-0 bg-slate-50/30">
            <Student3DViewer models={models} onModelsChange={handleModelUpdate} />
          </div>
        )}
        
        {}
        {isLoading && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center z-30 transition-all">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              <div className="max-w-[300px]">
                <p className="text-white text-2xl font-light tracking-tight mb-1">
                  {status}
                </p>
                <p className="text-white/60 text-sm font-light">
                  Твоя модель скоро з'явиться!
                </p>
              </div>
            </div>
          </div>
        )}

        {}
        {grade && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex items-center justify-center z-40 p-8">
            <Card className="bg-white rounded-[40px] p-10 shadow-2xl max-w-[500px] text-center flex flex-col items-center gap-6 border-brand/20 border-2">
              <div className="w-24 h-24 rounded-full bg-brand/10 flex items-center justify-center">
                <span className="text-4xl font-light text-brand">{grade.score}</span>
              </div>
              <div>
                <h2 className="text-2xl font-light text-gray-900 mb-4 tracking-tight">Роботу оцінено!</h2>
                <p className="text-gray-600 leading-relaxed text-lg font-light tracking-tight">{grade.feedback}</p>
              </div>
              <Button 
                onClick={() => setGrade(null)} 
                variant="outline"
                className="mt-4 rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50 font-light"
              >
                Закрити
              </Button>
            </Card>
          </div>
        )}

        {}
        <div className={`transition-all duration-700 ease-in-out w-full flex justify-center z-20 px-10 ${
          hasStarted 
            ? "absolute bottom-10 left-0 right-0" 
            : "relative translate-y-[-20px]"
        }`}>
          <div className="relative w-full max-w-4xl min-h-[140px] h-auto rounded-[32px] border border-gray-200 bg-white shadow-2xl flex flex-col group focus-within:border-brand/40 overflow-hidden">
            <textarea 
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              rows={1}
              className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 pt-8 px-8 pb-4 text-lg text-gray-800 placeholder:text-gray-400 font-light resize-none outline-none overflow-hidden leading-relaxed tracking-tight"
              placeholder="Генеруйте ваші відповіді"
              disabled={isLoading}
            />
            <div className="flex justify-end pr-6 pb-6 bg-white">
              <Button 
                onClick={handleSend}
                disabled={isLoading}
                className="bg-brand hover:bg-brand/90 text-white rounded-[18px] h-[52px] px-8 text-lg font-medium flex items-center gap-3 transition-all cursor-pointer shadow-none border-none group"
              >
                <span className="font-medium">Генерувати</span>
                <div className="flex items-center justify-center w-7 h-7 bg-white rounded-full">
                  <ArrowUpRight className="w-4 h-4 text-brand" strokeWidth={3} />
                </div>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function StudentTaskPage() {
  return (
    <div className="min-h-screen w-full bg-brand p-6 font-sans text-gray-900">
      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <TaskContent />
      </Suspense>
    </div>
  )
}"use client"

import React, { Suspense, useMemo, useRef } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, useGLTF, PivotControls, Environment } from "@react-three/drei"
import * as THREE from "three"

interface ModelProps {
  url: string
  index: number
  onUpdate: (index: number, matrix: THREE.Matrix4) => void
}

function Model({ url, index, onUpdate }: ModelProps) {
  const { scene } = useGLTF(url)
  const clonedScene = useMemo(() => {
    const s = scene.clone(true)
    return s
  }, [scene])
  
  return (
    <PivotControls 
      key={`${url}-${index}`}
      activeAxes={[true, true, true]} 
      depthTest={false} 
      scale={0.75}
      fixed={false}
      onDragEnd={(matrix) => onUpdate(index, matrix)}
    >
      <primitive object={clonedScene} scale={1.5} />
    </PivotControls>
  )
}

interface Student3DViewerProps {
  models: string[]
  onModelsChange?: (modelStates: any[]) => void
}

export default function Student3DViewer({ models = [], onModelsChange }: Student3DViewerProps) {
  const modelStates = useRef<any[]>([])

  
  useMemo(() => {
    modelStates.current = models.map((url, i) => ({
      url,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    }))
  }, [models])

  const handleUpdate = (index: number, matrix: THREE.Matrix4) => {
    const position = new THREE.Vector3()
    const rotation = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    
    matrix.decompose(position, rotation, scale)
    
    const euler = new THREE.Euler().setFromQuaternion(rotation)
    
    modelStates.current[index] = {
      ...modelStates.current[index],
      position: [position.x, position.y, position.z],
      rotation: [euler.x, euler.y, euler.z],
      scale: [scale.x, scale.y, scale.z]
    }
    
    if (onModelsChange) {
      onModelsChange([...modelStates.current])
    }
  }

  return (
    <div className="w-full h-full min-h-[500px] bg-gradient-to-b from-[#E0F2FE] to-[#F8FAFC] relative">
      <Canvas shadows camera={{ position: [10, 10, 10], fov: 40 }}>
        <color attach="background" args={['#f0f9ff']} />
        <ambientLight intensity={1} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <Environment preset="city" />
        
        <Suspense fallback={null}>
          <group>
            {}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
              <circleGeometry args={[12, 64]} />
              <meshStandardMaterial color="#ffffff" opacity={0.8} transparent />
            </mesh>
            
            {}
            <gridHelper args={[24, 24, 0x1A69F3, 0xD1D5DB]} position={[0, 0, 0]} opacity={0.2} transparent />
            
            {models.map((url, index) => (
              <Model 
                key={`${url}-${index}`} 
                url={url} 
                index={index} 
                onUpdate={handleUpdate} 
              />
            ))}
          </group>
          <OrbitControls makeDefault enableDamping={true} />
        </Suspense>
      </Canvas>
    </div>
  )
}"use client"

import React, { useState, Suspense } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter, useSearchParams } from "next/navigation"

function JoinForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const codeFromUrl = searchParams.get("code") || ""
  
  const [name, setName] = useState("")
  const [code, setCode] = useState(codeFromUrl)

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !code.trim()) return
    router.push(`/task?code=${code.trim().toUpperCase()}&name=${encodeURIComponent(name.trim())}`)
  }

  return (
    <Card className="bg-white rounded-[40px] p-12 border-none shadow-2xl w-full max-w-[480px] flex flex-col">
      <div className="flex flex-col gap-8">
        <h1 className="text-[48px] font-bold text-[#1A69F3] tracking-tight leading-none text-left">
          Приєднатись
        </h1>

        <form onSubmit={handleJoin} className="w-full flex flex-col gap-6">
          {}
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-medium text-black ml-1">
              Код від вчителя
            </label>
            <Input 
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Код від вчителя"
              className="h-[54px] rounded-[20px] border-[#D1D5DB] focus:border-[#1A69F3] focus:ring-0 px-5 text-[16px] text-gray-800 placeholder:text-[#9CA3AF] font-light bg-white"
              required
            />
          </div>

          {}
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-medium text-black ml-1">
              Прізвище та ім'я
            </label>
            <Input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ваше прізвище та ім'я"
              className="h-[54px] rounded-[20px] border-[#D1D5DB] focus:border-[#1A69F3] focus:ring-0 px-5 text-[16px] text-gray-800 placeholder:text-[#9CA3AF] font-light bg-white"
              required
            />
          </div>

          <Button 
            type="submit"
            className="h-[54px] rounded-[18px] bg-[#1A69F3] hover:bg-[#1A69F3]/90 text-white text-[18px] font-medium transition-all mt-4 cursor-pointer shadow-none border-none"
          >
            Приєднатись
          </Button>
        </form>
      </div>
    </Card>
  )
}

export default function JoinPage() {
  return (
    <div className="min-h-screen w-full bg-[#1A69F3] flex flex-col items-center justify-center p-6 font-sans">
      <Suspense fallback={<div className="text-white text-xl">Завантаження...</div>}>
        <JoinForm />
      </Suspense>
    </div>
  )
}"use client"

import React, { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, Users, CheckCircle2, Clock, Trophy } from "lucide-react"
import Link from "next/link"

interface Participant {
  id: number
  name: string
  status: string
  score?: number
  ai_feedback?: string
  last_heartbeat: string
}

export default function StudentProgressDashboard() {
  const { taskId } = useParams()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [task, setTask] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchTask = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/task/${taskId}`)
      if (response.ok) {
        const data = await response.json()
        setTask(data)
      }
    } catch (error) {
      console.error("Error fetching task:", error)
    }
  }

  const fetchParticipants = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/task/${taskId}/participants`)
      if (response.ok) {
        const data = await response.json()
        setParticipants(data)
      }
    } catch (error) {
      console.error("Error fetching participants:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTask()
    fetchParticipants()
    const interval = setInterval(fetchParticipants, 5000)
    return () => clearInterval(interval)
  }, [taskId])

  const submittedCount = participants.filter(p => p.status === "submitted").length

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 font-sans">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        {}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" className="rounded-full w-10 h-10 p-0 hover:bg-white shadow-sm">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Прогрес учнів</h1>
              <p className="text-gray-500 text-sm">Код кімнати: <span className="font-mono font-bold text-brand">{taskId}</span></p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <Card className="px-6 py-3 bg-white border-none shadow-sm flex items-center gap-3 rounded-2xl">
              <div className="w-10 h-10 bg-brand/10 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-brand" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Приєдналося</p>
                <p className="text-xl font-bold text-gray-900">{participants.length}</p>
              </div>
            </Card>
            <Card className="px-6 py-3 bg-white border-none shadow-sm flex items-center gap-3 rounded-2xl">
              <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Здано робіт</p>
                <p className="text-xl font-bold text-gray-900">{submittedCount}</p>
              </div>
            </Card>
          </div>
        </div>

        {}
        {task && task.description && (
          <Card className="p-6 bg-brand text-white border-none shadow-lg rounded-[24px]">
            <h2 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-2">Навчальна мета</h2>
            <p className="text-xl font-medium leading-relaxed italic">
              «{task.description}»
            </p>
          </Card>
        )}

        {}
        <div className="grid grid-cols-1 gap-6">
          <Card className="bg-white border-none shadow-sm rounded-[32px] overflow-hidden">
            <div className="p-8 border-b border-gray-50 bg-white/50">
              <h2 className="text-lg font-bold text-gray-900">Список класу</h2>
            </div>
            
            <ScrollArea className="h-[600px]">
              <div className="p-4">
                {participants.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <Users className="w-10 h-10 text-gray-200" />
                    </div>
                    <p className="text-gray-400 font-medium">Ще жоден учень не приєднався</p>
                    <p className="text-sm text-gray-300">Поділіться кодом {taskId}, щоб почати</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {participants.map((student) => (
                      <Card key={student.id} className="p-6 bg-white border border-gray-100 shadow-none rounded-2xl hover:border-brand/20 transition-all group">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${student.status === 'submitted' ? 'bg-green-500' : 'bg-brand'}`}>
                              {student.name[0].toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900">{student.name}</h3>
                              <p className="text-xs text-gray-400">
                                {student.status === 'submitted' ? 'Роботу здано' : 'У процесі...'}
                              </p>
                            </div>
                          </div>
                          {student.status === 'submitted' && (
                            <div className="bg-brand/5 text-brand px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                              <Trophy className="w-3 h-3" />
                              {student.score}
                            </div>
                          )}
                        </div>

                        {student.status === 'submitted' ? (
                          <div className="mt-4 bg-gray-50 p-4 rounded-xl">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Фідбек від AI</p>
                            <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                              {student.ai_feedback}
                            </p>
                          </div>
                        ) : (
                          <div className="mt-4 flex items-center gap-2 text-gray-300 italic text-sm py-4 border-2 border-dashed border-gray-50 rounded-xl justify-center">
                            <Clock className="w-4 h-4 animate-pulse" />
                            Очікуємо на роботу
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </div>
    </div>
  )
}