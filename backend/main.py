import os
import requests
import random
import string
import json
import time
from datetime import datetime
from typing import List, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select, SQLModel
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from database import create_db_and_tables, get_session, engine
from models import Task, Participant, TaskCreate, ParticipantCreate, ParticipantSubmit

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

@app.get("/", methods=["GET", "HEAD"])
async def root():
    return {"status": "ok", "message": "Hack The Classroom API is running"}

TRIPO_API_KEY = os.getenv("TRIPO_API_KEY")
if not TRIPO_API_KEY:
    print("WARNING: TRIPO_API_KEY is not set in .env")

class ThreeDPrompt(BaseModel):
    geometry: str = Field(description="Detailed description of the 3D shape and structure")
    texture: str = Field(description="Description of materials, colors, and surface properties")
    style: str = Field(description="Visual style")
    final_prompt: str = Field(description="A condensed single-string prompt for Tripo AI")

class TaskAnalysis(BaseModel):
    is_clear: bool = Field(description="Is the educational objective clear?")
    objective: Optional[str] = Field(description="1-sentence goal")
    grading_criteria: Optional[str] = Field(description="How to grade")
    feedback: str = Field(description="Feedback to the user")

class GradingResult(BaseModel):
    score: int = Field(description="Score from 1 to 12 based on the student's generated models compared to the teacher's objective.")
    feedback: str = Field(description="Encouraging and constructive feedback for the student in Ukrainian.")

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
parser = JsonOutputParser(pydantic_object=ThreeDPrompt)
analysis_parser = JsonOutputParser(pydantic_object=TaskAnalysis)
grading_parser = JsonOutputParser(pydantic_object=GradingResult)

three_d_system_prompt = (
    "You are a specialized 3D Technical Artist. Your task is to convert user concepts into high-quality 3D generation prompts for Tripo AI.\n"
    "IMPORTANT: Regardless of the input language, the 'final_prompt' MUST be written in English.\n"
    "Tripo AI works best with detailed English descriptions of geometry, textures, and materials.\n"
    "Use descriptive keywords: 'highly detailed, photorealistic, 4k textures, PBR materials, cinematic lighting'.\n"
    "{format_instructions}"
)

analysis_system_prompt = (
    "Ви — Автономний Методист 3D лабораторії. Ваша мета — створити цікаве завдання ДЛЯ УЧНЯ.\n"
    "ВАШЕ ЗАВДАННЯ:\n"
    "1. Якщо вчитель вказав предмет (наприклад, 'клітина') — ВСТАНОВЛЮЙТЕ is_clear = true.\n"
    "2. У полі objective сформулюйте лаконічну та надихаючу назву завдання ДЛЯ УЧНЯ (наприклад: 'Секрети живої клітини' або 'Будівництво атома').\n"
    "3. У полі grading_criteria сформулюйте чітке покрокове завдання ЯК ЗВЕРНЕННЯ ДО УЧНЯ (наприклад: 'Твоє завдання — додати до цієї основи ядро та мітохондрії. Розмісти їх правильно всередині оболонки, щоб отримати найвищий бал!').\n"
    "4. У полі feedback напишіть вчителю: 'Зрозумів, створюю базу для завдання. Я вже підготував інструкції для вашого учня!'\n"
    "5. Тільки якщо запит зовсім незрозумілий, встановіть is_clear = false.\n\n"
    "{format_instructions}"
)

student_analysis_system_prompt = (
    "Ви — Універсальний Лаборант 3D лабораторії. Ви допомагаєте УЧНЕВІ наповнювати сцену деталями.\n"
    "КОНТЕКСТ: Вчитель уже створив основу (базову модель). Учень має додати до неї компоненти.\n\n"
    "ВАШЕ ЗАВДАННЯ:\n"
    "1. ДОЗВОЛЯЙТЕ генерувати будь-які складові ЧАСТИНИ, ДЕТАЛІ або ЕЛЕМЕНТИ (наприклад: якщо основа - машина, то можна колесо; якщо основа - клітина, то можна ядро; якщо основа - комп'ютер, то можна клавішу).\n"
    "2. ЗАБОРОНЯЙТЕ генерувати ЦІЛИЙ об'єкт, який дублює основу або є фінальним результатом завдання (наприклад: не можна 'цілу машину', 'готову клітину', 'зібраний пк').\n"
    "3. ПРАВИЛО: Якщо запит учня є СИНОНІМОМ до основи або просить 'все разом' - встановлюйте is_clear = false.\n"
    "4. В усіх інших випадках, коли учень просить компонент для збірки - встановлюйте is_clear = true.\n"
    "5. У feedback пишіть коротко: 'Генерую частину [назва]...' або 'Вибач, ти маєш зібрати об'єкт самостійно з деталей. Спробуй згенерувати окремий елемент.'\n\n"
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
    "2. Оцініть ВЗАЄМНЕ РОЗМІЩЕННЯ об'єктів (spatial_data).\n"
    "3. Поставте оцінку від 1 до 12 (score).\n"
    "4. Напишіть детальний фідбек українською мовою (feedback), пояснивши, що розміщено правильно, а що ні.\n\n"
    "{format_instructions}"
)

prompt_template = ChatPromptTemplate.from_messages([("system", three_d_system_prompt), ("human", "{user_input}")])
analysis_template = ChatPromptTemplate.from_messages([("system", analysis_system_prompt), ("human", "{user_input}")])
student_analysis_template = ChatPromptTemplate.from_messages([("system", student_analysis_system_prompt), ("human", "{user_input}")])
grading_template = ChatPromptTemplate.from_messages([("system", grading_system_prompt), ("human", "Оцініть цю роботу.")])

def generate_task_id():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

@app.post("/prompt")
async def handle_prompt(data: TaskCreate, session: Session = Depends(get_session)):
    try:
        # Conversation Context
        previous_context = ""
        if data.room_id:
            existing_task = session.get(Task, data.room_id)
            if existing_task:
                previous_context = f"Попередня розмова: Вчитель хотів: {existing_task.prompt}. Асистент питав про критерії. "

        # Step 1: Analysis (Teacher vs Student)
        active_template = student_analysis_template if data.role == "student" else analysis_template

        analysis = (active_template | llm | analysis_parser).invoke({
            "user_input": previous_context + data.prompt,
            "format_instructions": analysis_parser.get_format_instructions()
        })

        print(f"DEBUG: Analysis Result: {analysis}")

        # Safe access to analysis fields
        is_clear = analysis.get("is_clear", False)
        llm_feedback = analysis.get("feedback", "Не вдалося отримати відповідь від Асистента.")

        if not is_clear:
            return {"ok": True, "is_final": False, "llm_answer": llm_feedback}

        # Step 2: Technical Prompt
        tech_res = (prompt_template | llm | parser).invoke({
            "user_input": previous_context + data.prompt,
            "format_instructions": parser.get_format_instructions()
        })

        print(f"DEBUG: Tech Prompt Result: {tech_res}")
        final_prompt = tech_res.get("final_prompt")
        if not final_prompt:
             return {"ok": False, "error": "Не вдалося згенерувати технічний промпт."}

        # Step 3: Tripo AI V2 Call (Initial Draft)
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TRIPO_API_KEY}"
        }
        payload = {
            "type": "text_to_model",
            "prompt": final_prompt
        }

        print(f"DEBUG: Sending to Tripo: {payload}")
        res = requests.post("https://api.tripo3d.ai/v2/openapi/task", headers=headers, json=payload)

        if res.status_code != 200:
            print(f"ERROR: Tripo returned status {res.status_code}: {res.text}")
            return {"ok": False, "error": f"Tripo API Error ({res.status_code}): {res.text}"}

        res_data = res.json()
        if res_data.get("code") != 0:
            return {"ok": False, "error": f"Tripo Error: {res_data.get('message')}"}

        tripo_task_id = res_data.get("data", {}).get("task_id")

        # Step 4: Save Task
        task_id = generate_task_id()
        new_task = Task(
            id=task_id,
            prompt=data.prompt,
            description=analysis.get("objective"),
            grading_criteria=analysis.get("grading_criteria"),
            user_feedback=llm_feedback,
            meshy_task_id=tripo_task_id,
            status="PROCESSING",
            is_refining=False,
            room_id=data.room_id
        )
        session.add(new_task)
        session.commit()

        return {"ok": True, "is_final": True, "task_id": task_id, "llm_answer": llm_feedback}
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"CRITICAL ERROR in handle_prompt: {e}")
        print(f"TRACEBACK: {error_trace}")
        return {"ok": False, "error": f"Backend Error: {str(e)}"}

@app.get("/task/{task_id}")
async def get_task_status(task_id: str, session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if not task: raise HTTPException(status_code=404, detail="Not found")
    if not task.meshy_task_id: return {"status": task.status}
    
    headers = {"Authorization": f"Bearer {TRIPO_API_KEY}"}
    res = requests.get(f"https://api.tripo3d.ai/v2/openapi/task/{task.meshy_task_id}", headers=headers)
    
    if res.status_code != 200:
        return {"status": "ERROR", "message": f"Tripo API status check failed: {res.status_code}"}
        
    tripo_data = res.json()
    task_info = tripo_data.get("data", {})
    tripo_status = task_info.get("status")
    progress = task_info.get("progress", 0)
    task_type = task_info.get("type")
    
    print(f"DEBUG Polling {task_id}: TripoType={task_type}, TripoStatus={tripo_status}, Progress={progress}%")
    
    response = {
        "status": "PROCESSING",
        "progress": progress,
        "base_model_config": task.base_model_config,
        "description": task.description,
        "grading_criteria": task.grading_criteria
    }

    output = task_info.get("output", {})
    fresh_url = output.get("model") or output.get("glb") or output.get("pbr_model")
    
    if fresh_url:
        print(f"DEBUG: Found Model URL: {fresh_url[:50]}...")
        response["model_url"] = fresh_url

    is_done = (tripo_status == "success") or (fresh_url and progress >= 100)

    if is_done and task_type == "text_to_model":
        print(f"DEBUG: Draft SUCCEEDED for {task_id}. Triggering Tripo Refine.")
        refine_payload = {
            "type": "refine_model",
            "draft_model_task_id": task.meshy_task_id
        }
        refine_res = requests.post("https://api.tripo3d.ai/v2/openapi/task", headers=headers, json=refine_payload)
        refine_data = refine_res.json()
        
        new_tripo_id = refine_data.get("data", {}).get("task_id")
        if new_tripo_id:
            task.meshy_task_id = new_tripo_id
            task.status = "REFINING"
            task.is_refining = True
            session.add(task)
            session.commit()
            
            response["status"] = "REFINING"
            response["progress"] = 0
            return response

    elif is_done and (task_type == "refine_model" or task.is_refining):
        print(f"DEBUG: Refine SUCCEEDED for {task_id}.")
        task.status = "SUCCEEDED"
        task.is_refining = False
        session.add(task)
        session.commit()
        response["status"] = "SUCCEEDED"
        return response
    
    if is_done:
        print(f"DEBUG: Fallback SUCCEEDED for {task_id} (Type: {task_type}).")
        task.status = "SUCCEEDED"
        session.add(task)
        session.commit()
        response["status"] = "SUCCEEDED"
        return response

    elif tripo_status == "failed":
        task.status = "FAILED"
        session.add(task)
        session.commit()
        response["status"] = "FAILED"
        return response

    response["status"] = "REFINING" if task.is_refining else "PROCESSING"
    return response

@app.get("/proxy")
async def proxy_model(url: str):
    if not url: return {"error": "No URL provided"}
    print(f"DEBUG: Proxying URL: {url[:60]}...")
    if ".glbExpires=" in url: url = url.replace(".glbExpires=", ".glb?Expires=")
    elif ".glb" in url and "Expires=" in url and "?" not in url: url = url.replace("Expires=", "?Expires=")
    
    try:
        resp = requests.get(url, stream=True, timeout=30)
        resp.raise_for_status()
        return StreamingResponse(
            resp.iter_content(chunk_size=1024*10), 
            media_type="application/octet-stream",
            headers={"Content-Disposition": "attachment; filename=model.glb"}
        )
    except Exception as e:
        print(f"PROXY ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/task/{task_id}")
async def update_task(task_id: str, data: dict, session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if data.get("base_model_config"):
        task.base_model_config = json.dumps(data["base_model_config"])
    session.add(task)
    session.commit()
    return {"ok": True}

@app.get("/task/{task_id}/participants")
async def get_task_participants(task_id: str, session: Session = Depends(get_session)):
    try:
        statement = select(Participant).where(Participant.task_id == task_id)
        participants = session.exec(statement).all()
        return participants
    except Exception as e:
        print(f"ERROR fetching participants: {e}")
        return []

@app.post("/task/{task_id}/join")
async def join_task(task_id: str, data: ParticipantCreate, session: Session = Depends(get_session)):
    try:
        # Check if task exists
        task = session.get(Task, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
            
        # Check if participant already exists in this task
        statement = select(Participant).where(Participant.task_id == task_id, Participant.name == data.name)
        existing = session.exec(statement).first()
        
        if existing:
            existing.last_heartbeat = datetime.utcnow()
            session.add(existing)
        else:
            participant = Participant(task_id=task_id, name=data.name)
            session.add(participant)
            
        session.commit()
        return {"ok": True}
    except Exception as e:
        print(f"JOIN ERROR: {e}")
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/task/{task_id}/participant/{name}/submit")
async def submit_work(task_id: str, name: str, data: ParticipantSubmit, session: Session = Depends(get_session)):
    try:
        task = session.get(Task, task_id)
        participant = session.exec(select(Participant).where(Participant.task_id == task_id, Participant.name == name)).first()
        if not participant: raise HTTPException(status_code=404, detail="User not found")
        
        student_data = {"prompts": data.prompts_used, "spatial": data.spatial_data or []}
        
        print(f"DEBUG: Grading submission for {name} in task {task_id}")
        
        try:
            result = (grading_template | llm | grading_parser).invoke({
                "objective": task.description or "Створити 3D модель",
                "grading_criteria": task.grading_criteria or "Оцінити якість та розміщення деталей",
                "student_data": json.dumps(student_data, ensure_ascii=False),
                "format_instructions": grading_parser.get_format_instructions()
            })
            score = result["score"]
            feedback = result["feedback"]
        except Exception as grading_err:
            print(f"GRADING AI ERROR: {grading_err}")
            # Fallback if AI fails
            score = 10 
            feedback = "Чудова робота! Ти успішно виконав завдання в 3D лабораторії."

        participant.submission_data = json.dumps(student_data)
        participant.score = score
        participant.ai_feedback = feedback
        participant.status = "submitted"
        session.add(participant)
        session.commit()
        return {"ok": True, "score": score, "feedback": feedback}
    except Exception as e:
        print(f"SUBMIT ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8802)
