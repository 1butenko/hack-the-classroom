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
    "You are a specialized 3D Technical Artist. Convert user concepts into 3D AI prompts.\n"
    "Focus on clear geometry and simple textbook colors.\n"
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

class TaskCreate(SQLModel):
    prompt: str
    task_id: Optional[str] = None 

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
            "art_style": "realistic",
        }

        res = requests.post(
            "https://api.meshy.ai/openapi/v2/text-to-3d",
            headers={"Authorization": f"Bearer {MESHY_API_KEY}"},
            json=payload
        )
        
        meshy_id = res.json().get("result")
        current_task.meshy_task_id = meshy_id
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
        
        task.status = data.get("status", task.status)
        if task.status == "SUCCEEDED":
            task.model_url = data.get("model_urls", {}).get("glb")
        session.add(task)
        session.commit()
        return data

    return {"status": task.status}

@app.get("/task/{task_id}/participants")
async def get_task_participants(task_id: str, session: Session = Depends(get_session)):
    statement = select(Participant).where(Participant.task_id == task_id)
    participants = session.exec(statement).all()
    return participants

@app.get("/proxy")
async def proxy_model(url: str):
    if ".glbExpires=" in url: url = url.replace(".glbExpires=", ".glb?Expires=")
    resp = requests.get(url, stream=True)
    return StreamingResponse(resp.iter_content(chunk_size=4096), media_type="application/octet-stream")

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
    uvicorn.run(app, host="0.0.0.0", port=8000)