import os
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

load_dotenv()

app = FastAPI()

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
    "You are a specialized 3D Asset Engineer. Your goal is to convert a simple user idea "
    "into a technical specification for 3D generative AI models.\n"
    "Ensure the 'final_prompt' is optimized for text-to-3D models by using keywords "
    "like 'high resolution', 'watertight mesh', 'PBR materials', and 'centered at origin'.\n"
    "{format_instructions}"
)

prompt_template = ChatPromptTemplate.from_messages([
    ("system", three_d_system_prompt),
    ("human", "{user_input}")
])

def generate_3d_model(refined_prompt: str):
    """Викликає Meshy API v2 для генерації 3D моделі"""
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
    chain = prompt_template | llm | parser
    response = chain.invoke({
        "user_input": user_input,
        "format_instructions": parser.get_format_instructions()
    })
    
    print(f"USER CONCEPT: {user_input}")
    print(f"FINAL 3D PROMPT: {response['final_prompt']}")
    return response

@app.post("/prompt")
async def handle_prompt(data: PromptRequest):
    print(f"\nReceived prompt: {data.prompt}")
    try:

        refined_data = process_3d_request(data.prompt)
        
        meshy_response = generate_3d_model(refined_data['final_prompt'])
        
        return {
            "ok": True, 
            "llm_refinement": refined_data,
            "meshy_result": meshy_response
        }
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/task/{task_id}")
async def get_task_status(task_id: str):
    """Перевірка статусу для Meshy v2"""
    url = f"https://api.meshy.ai/openapi/v2/text-to-3d/{task_id}"
    headers = {"Authorization": f"Bearer {MESHY_API_KEY}"}
    response = requests.get(url, headers=headers)
    return response.json()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
