import os
import json
from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

load_dotenv()

app = FastAPI()

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
    "into a technical specification for 3D generative AI models (like Shap-E or TripoSR).\n"
    "Ensure the 'final_prompt' is optimized for text-to-3D models by using keywords "
    "like 'high resolution', 'watertight mesh', 'PBR materials', and 'centered at origin'.\n"
    "{format_instructions}"
)

prompt_template = ChatPromptTemplate.from_messages([
    ("system", three_d_system_prompt),
    ("human", "{user_input}")
])

def process_3d_request(user_input: str):
    chain = prompt_template | llm | parser
    
    response = chain.invoke({
        "user_input": user_input,
        "format_instructions": parser.get_format_instructions()
    })
    

    print(f"USER CONCEPT: {user_input}")
    print(f"GEOMETRY: {response['geometry']}")
    print(f"TEXTURE: {response['texture']}")
    print(f"STYLE: {response['style']}")
    print(f"FINAL 3D PROMPT: {response['final_prompt']}")

    return response

@app.post("/prompt")
def handle_prompt(data: PromptRequest):
    print(f"\nReceived prompt: {data.prompt}")
    llm_answer = ask_llm(data.prompt)
    return {"ok": True, "prompt": data.prompt, "llm_answer": llm_answer}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
