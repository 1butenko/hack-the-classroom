import os
import requests
import random
import string
from datetime import datetime, timedelta
from typing import List, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

from .database import create_db_and_tables, get_session, engine
from .models import Task, Participant, TaskCreate, ParticipantCreate, ParticipantUpdate

load_dotenv()

app = FastAPI()

# Додаємо CORS для фронтенду
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

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
parser = JsonOutputParser(pydantic_object=ThreeDPrompt)

three_d_system_prompt = (
    "You are an Elite 3D Technical Artist specializing in educational visualization. Your goal is to create "
    "structurally accurate 3D models with professionally selected color palettes.\n\n"
    "COLOR & MATERIAL RULES:\n"
    "1. CONTEXTUAL COLORS: Select colors based on the subject. For biological models (like mitochondria), use classic textbook palettes: vibrant pinks, oranges, and deep purples for contrast. For mechanical parts, use realistic metallic and industrial tones.\n"
    "2. VISIBILITY: Avoid pitch-black or extremely dark materials. Ensure the Albedo (base color) is bright enough to be clearly visible under studio lighting.\n"
    "3. CONTRAST: Use a distinct color for each functional part of the object to make them easily distinguishable for students.\n\n"
    "TECHNICAL SPECIFICATIONS:\n"
    "1. LIGHTING: Define 'bright studio lighting' and 'multi-point illumination' in the final prompt.\n"
    "2. GEOMETRY: Focus on 'watertight mesh', 'clean topology', and 'high-poly detail'. Mention specific anatomical features (e.g., 'folded inner cristae', 'outer smooth membrane').\n"
    "3. OUTPUT: Keywords for final prompt: 'PBR materials', '4k textures', 'vibrant albedo', 'no dark shadows', 'centered at origin', 'y-axis up'.\n\n"
    "{format_instructions}"
)

feedback_system_prompt = (
    "Ви — приязний та захоплений Творчий Асистент. Ваша мета — надати теплу та цікаву "
    "відповідь користувачу про 3D-об'єкт, який ви зараз створюєте для нього.\n"
    "Опишіть, що ви уявили на основі його ідеї, передайте 'вайб' об'єкта та "
    "скажіть, що магія вже почалася. Пишіть виключно УКРАЇНСЬКОЮ мовою.\n"
    "Відповідь має бути короткою (2-3 надихаючі речення) і звертатися безпосередньо до користувача."
)

prompt_template = ChatPromptTemplate.from_messages([
    ("system", three_d_system_prompt),
    ("human", "{user_input}")
])

feedback_template = ChatPromptTemplate.from_messages([
    ("system", feedback_system_prompt),
    ("human", "The user wants: {user_input}. The technical plan is: {technical_plan}")
])

def generate_room_code():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

def generate_3d_model(refined_prompt: str):
    url = "https://api.meshy.ai/openapi/v2/text-to-3d"
    headers = {
        "Authorization": f"Bearer {MESHY_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "mode": "preview",
        "prompt": refined_prompt,
        "art_style": "realistic",
        "should_remesh": False
    }
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code not in [200, 201, 202]:
        raise Exception(f"Meshy API error: {response.status_code} - {response.text}")
    return response.json()

@app.post("/prompt")
async def handle_prompt(data: TaskCreate, session: Session = Depends(get_session)):
    try:
        # 1. Створюємо Task у БД
        room_code = generate_room_code()
        new_task = Task(id=room_code, prompt=data.prompt)
        session.add(new_task)
        session.commit()
        session.refresh(new_task)

        # 2. LLM Рефінамент
        technical_chain = prompt_template | llm | parser
        technical_response = technical_chain.invoke({
            "user_input": data.prompt,
            "format_instructions": parser.get_format_instructions()
        })
        
        feedback_chain = feedback_template | llm
        feedback_response = feedback_chain.invoke({
            "user_input": data.prompt,
            "technical_plan": technical_response["geometry"]
        })

        # 3. Meshy Request
        meshy_result = generate_3d_model(technical_response['final_prompt'])
        
        # 4. Оновлюємо Task у БД
        new_task.refined_prompt = technical_response['final_prompt']
        new_task.user_feedback = feedback_response.content
        new_task.meshy_task_id = meshy_result.get("result")
        new_task.status = "PROCESSING"
        session.add(new_task)
        session.commit()
        
        return {
            "ok": True, 
            "task_id": room_code,
            "user_feedback": feedback_response.content,
            "llm_refinement": technical_response
        }
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/task/{task_id}")
async def get_task_status(task_id: str, session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Якщо статус у БД вже SUCCEEDED, віддаємо одразу
    if task.status == "SUCCEEDED" and task.model_url:
        return {
            "status": "SUCCEEDED",
            "model_url": task.model_url,
            "progress": 100
        }
    
    # Інакше перевіряємо в Meshy
    if task.meshy_task_id:
        url = f"https://api.meshy.ai/openapi/v2/text-to-3d/{task.meshy_task_id}"
        headers = {"Authorization": f"Bearer {MESHY_API_KEY}"}
        response = requests.get(url, headers=headers)
        meshy_data = response.json()
        
        # Оновлюємо нашу БД, якщо статус змінився
        new_status = meshy_data.get("status")
        if new_status:
            task.status = new_status
            if new_status == "SUCCEEDED":
                task.model_url = meshy_data.get("model_urls", {}).get("glb")
            session.add(task)
            session.commit()
            session.refresh(task)
            
        return meshy_data

    return {"status": task.status}

@app.post("/task/{task_id}/join")
async def join_task(task_id: str, data: ParticipantCreate, session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Перевіряємо чи такий учень уже є
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

@app.patch("/task/{task_id}/participant/{name}")
async def update_participant(task_id: str, name: str, data: ParticipantUpdate, session: Session = Depends(get_session)):
    statement = select(Participant).where(Participant.task_id == task_id, Participant.name == name)
    participant = session.exec(statement).first()
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
    
    if data.status: participant.status = data.status
    if data.has_viewed is not None: participant.has_viewed = data.has_viewed
    if data.reaction: participant.reaction = data.reaction
    
    participant.last_heartbeat = datetime.utcnow()
    session.add(participant)
    session.commit()
    return {"ok": True}

@app.get("/task/{task_id}/dashboard")
async def get_dashboard(task_id: str, session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Визначаємо хто онлайн (heartbeat за останні 30 секунд)
    threshold = datetime.utcnow() - timedelta(seconds=30)
    
    participants_list = []
    for p in task.participants:
        is_online = p.last_heartbeat > threshold
        participants_list.append({
            "name": p.name,
            "status": p.status if is_online else "offline",
            "has_viewed": p.has_viewed,
            "reaction": p.reaction,
            "is_online": is_online
        })
        
    return {
        "room_code": task.id,
        "status": task.status,
        "model_url": task.model_url,
        "participants": participants_list
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
