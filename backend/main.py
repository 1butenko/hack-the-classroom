import os
import requests
import json
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MESHY_API_KEY = os.getenv("MESHY_API_KEY", "msy_MeTsyL39y0iEOeaJO8Zn28MXVYGcU6XSktn8")

class ThreeDPrompt(BaseModel):
    geometry: str = Field(description="Detailed description of the 3D shape and structure")
    texture: str = Field(description="Description of materials, colors, and surface properties")
    style: str = Field(description="Visual style like low-poly, realistic, or stylized")
    final_prompt: str = Field(description="A condensed single-string prompt for the 3D generator")

class PromptRequest(BaseModel):
    prompt: str

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
parser = JsonOutputParser(pydantic_object=ThreeDPrompt)

three_d_system_prompt = (
    "You are an Elite 3D Technical Artist and Master Sculptor. Your mission is to translate vague user concepts "
    "into high-fidelity, industrial-grade 3D asset specifications for state-of-the-art generative AI.\n\n"
    "Guidelines for excellence:\n"
    "1. GEOMETRY: Define the structural topology. Describe micro-details, bevels, and physical weight. "
    "Use terms like 'watertight mesh', 'manifold geometry', 'clean silhouette', and 'high-poly density'.\n"
    "2. TEXTURE & SHADING: Think in PBR (Physically Based Rendering). Specify Albedo, Roughness, Metallic, "
    "and Normal maps. Mention surface imperfections like scratches, oxidation, or dust to add realism.\n"
    "3. STYLE: Reference high-end rendering aesthetics (Unreal Engine 5, Octane Render, Ray-traced) "
    "or specific artistic movements (Cyberpunk, Biomechanical, Hyper-realistic, Low-poly aesthetic).\n"
    "4. FINAL PROMPT: This must be a powerhouse of keywords. Use technical anchors: 'centered at origin', "
    "'high-resolution mesh', 'PBR materials', '4k textures', 'professional topology', 'y-axis up'.\n\n"
    "{format_instructions}"
)

# Промпт для дружнього фідбеку користувачу (українською мовою)
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

def generate_3d_model(refined_prompt: str):
    if not MESHY_API_KEY:
        print("Warning: MESHY_API_KEY not found. Returning mock.")
        return {"result": "mock_task_id"}
        
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

def process_3d_request(user_input: str):
    technical_chain = prompt_template | llm | parser
    technical_response = technical_chain.invoke({
        "user_input": user_input,
        "format_instructions": parser.get_format_instructions()
    })
    
    feedback_chain = feedback_template | llm
    feedback_response = feedback_chain.invoke({
        "user_input": user_input,
        "technical_plan": technical_response["geometry"]
    })
    
    return technical_response, feedback_response.content

@app.post("/prompt")
async def handle_prompt(data: PromptRequest):
    print(f"\nReceived prompt: {data.prompt}")
    try:
        refined_data, user_feedback = process_3d_request(data.prompt)
        meshy_response = generate_3d_model(refined_data['final_prompt'])
        
        task_id = meshy_response.get("result")
        
        return {
            "ok": True, 
            "llm_answer": user_feedback,
            "task_id": task_id
        }
    except Exception as e:
        print(f"Error: {e}")
        return {"ok": False, "error": str(e)}

@app.get("/task/{task_id}")
async def get_task_status(task_id: str):
    if task_id == "mock_task_id" or not MESHY_API_KEY:
        return {
            "status": "SUCCEEDED", 
            "model_urls": {"glb": "/cell/scene.gltf"},
            "progress": 100
        }
        
    url = f"https://api.meshy.ai/openapi/v2/text-to-3d/{task_id}"
    headers = {"Authorization": f"Bearer {MESHY_API_KEY}"}
    response = requests.get(url, headers=headers)
    return response.json()

@app.get("/proxy")
async def proxy_model(url: str):
    # Fix for potential missing '?' in Meshy signed URLs
    if ".glbExpires=" in url:
        url = url.replace(".glbExpires=", ".glb?Expires=")
        
    try:
        resp = requests.get(url, stream=True)
        return StreamingResponse(
            resp.iter_content(chunk_size=4096),
            media_type="application/octet-stream"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
