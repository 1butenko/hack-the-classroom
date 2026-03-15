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

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
parser = JsonOutputParser(pydantic_object=ThreeDPrompt)
analysis_parser = JsonOutputParser(pydantic_object=TaskAnalysis)

three_d_system_prompt = (
    "You are a specialized 3D Technical Artist. Your task is to convert user concepts into high-quality 3D generation prompts for Tripo AI.\n"
    "IMPORTANT: Regardless of the input language, the 'final_prompt' MUST be written in English.\n"
    "Tripo AI works best with detailed English descriptions of geometry, textures, and materials.\n"
    "Use descriptive keywords: 'highly detailed, photorealistic, 4k textures, PBR materials, cinematic lighting'.\n"
    "{format_instructions}"
)

analysis_system_prompt = (
    "Ви — Методист 3D лабораторії. Ваша мета — швидко розпочати генерацію, але знати, як оцінювати учня.\n"
    "ВАШЕ ЗАВДАННЯ:\n"
    "1. Визначити предмет та критерії оцінювання.\n"
    "2. Якщо вчитель вказав предмет, але не вказав критерії — запитайте їх ОДИН РАЗ.\n"
    "3. Якщо вчитель відповів на ваше запитання про критерії (або просто уточнив завдання) — ВСТАНОВЛЮЙТЕ is_clear = true.\n"
    "4. Не будьте занадто прискіпливими. Якщо з контексту зрозуміло, що робити — генеруйте.\n"
    "5. У полі grading_criteria сформулюйте правила оцінювання (навіть якщо вони прості).\n\n"
    "{format_instructions}"
)

prompt_template = ChatPromptTemplate.from_messages([("system", three_d_system_prompt), ("human", "{user_input}")])
analysis_template = ChatPromptTemplate.from_messages([("system", analysis_system_prompt), ("human", "{user_input}")])

def generate_task_id():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

@app.post("/prompt")
async def handle_prompt(data: TaskCreate, session: Session = Depends(get_session)):
    try:
        # Conversation Context
        previous_context = ""
        if data.room_id: # Actually we use room_id here if provided, but let's look for the task
            # If the user is responding to a clarification, they might pass the room_id (currentTaskId)
            # We can use the prompt of that task as context
            existing_task = session.get(Task, data.room_id)
            if existing_task:
                previous_context = f"Попередня розмова: Вчитель хотів: {existing_task.prompt}. Асистент питав про критерії. "

        # Step 1: Analysis
        analysis = (analysis_template | llm | analysis_parser).invoke({
            "user_input": previous_context + data.prompt,
            "format_instructions": analysis_parser.get_format_instructions()
        })

        if not analysis["is_clear"]:
            return {"ok": True, "is_final": False, "llm_answer": analysis["feedback"]}

        # Step 2: Technical Prompt
        tech_res = (prompt_template | llm | parser).invoke({
            "user_input": previous_context + data.prompt, 
            "format_instructions": parser.get_format_instructions()
        })

        # Step 3: Tripo AI V2 Call (Initial Draft)
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TRIPO_API_KEY}"
        }
        payload = {
            "type": "text_to_model",
            "prompt": tech_res['final_prompt']
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
            user_feedback=analysis["feedback"],
            meshy_task_id=tripo_task_id,
            status="PROCESSING",
            is_refining=False,
            room_id=data.room_id
        )
        session.add(new_task)
        session.commit()

        return {"ok": True, "is_final": True, "task_id": task_id, "llm_answer": analysis["feedback"]}

    except Exception as e:
        print(f"ERROR: {e}")
        return {"ok": False, "error": str(e)}

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
        "description": task.description
    }

    output = task_info.get("output", {})
    # Tripo documentation says GLB is in 'model' or 'glb' field. Let's be thorough.
    fresh_url = output.get("model") or output.get("glb") or output.get("pbr_model")
    
    if fresh_url:
        print(f"DEBUG: Found Model URL: {fresh_url[:50]}...")

    # Force success if progress is 100 and we have a URL, regardless of what Tripo says
    is_done = (tripo_status == "success") or (fresh_url and progress >= 100)

    # AUTOMATIC REFINEMENT logic
    if is_done and task_type == "text_to_model":
        # Draft is ready, start refinement
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
            if fresh_url: response["model_url"] = fresh_url
            return response

    elif is_done and (task_type == "refine_model" or task.is_refining):
        # If it was refining or is of type refine_model, then we are officially done
        print(f"DEBUG: Refine SUCCEEDED for {task_id}.")
        task.status = "SUCCEEDED"
        task.is_refining = False
        session.add(task)
        session.commit()
        response["status"] = "SUCCEEDED"
        if fresh_url: response["model_url"] = fresh_url
        return response
    
    # Fallback: If it's done but type didn't match perfectly, just finish it
    if is_done:
        print(f"DEBUG: Fallback SUCCEEDED for {task_id} (Type: {task_type}).")
        task.status = "SUCCEEDED"
        session.add(task)
        session.commit()
        response["status"] = "SUCCEEDED"
        if fresh_url: response["model_url"] = fresh_url
        return response

    elif tripo_status == "failed":
        task.status = "FAILED"
        session.add(task)
        session.commit()
        response["status"] = "FAILED"
        return response

    # Still running
    response["status"] = "REFINING" if task.is_refining else "PROCESSING"
    if fresh_url: response["model_url"] = fresh_url
    return response

@app.get("/proxy")
async def proxy_model(url: str):
    if not url: return {"error": "No URL provided"}
    print(f"DEBUG: Proxying URL: {url[:60]}...")
    
    # Tripo/Meshy URL cleanup
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

@app.post("/task/{task_id}/join")
async def join_task(task_id: str, data: ParticipantCreate, session: Session = Depends(get_session)):
    participant = Participant(task_id=task_id, name=data.name)
    session.add(participant)
    session.commit()
    return {"ok": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8802)
