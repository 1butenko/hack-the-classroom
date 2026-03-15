# 3D Model Generation & Rendering Guide

This document provides a complete overview and the full source code for the 3D generation pipeline, covering everything from the AI backend to the interactive frontend viewer.

## 1. Backend: Model Generation Pipeline
The backend uses **FastAPI** and **LangChain** to translate user ideas into technical 3D specifications, which are then sent to the **Meshy API**.

### `backend/main.py` (Generation Logic)
```python
import os
import requests
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser

# --- AI Configuration ---
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)

three_d_system_prompt = (
    "You are an Elite 3D Technical Artist specializing in educational visualization. "
    "Your goal is to create structurally accurate 3D models with professionally selected color palettes.\n\n"
    "TECHNICAL SPECIFICATIONS for final_prompt:\n"
    "- Keywords: 'PBR materials', '4k textures', 'vibrant albedo', 'no dark shadows', 'centered at origin', 'y-axis up'.\n"
)

# --- Endpoints ---

@app.post("/prompt")
async def handle_prompt(data: TaskCreate):
    # 1. Refine prompt with LLM
    # 2. Call Meshy API (https://api.meshy.ai/openapi/v2/text-to-3d)
    # 3. Return task_id for polling
    pass

@app.get("/proxy")
async def proxy_model(url: str):
    """Bypasses CORS and fixes signed URL formatting for GLB files."""
    if ".glbExpires=" in url:
        url = url.replace(".glbExpires=", ".glb?Expires=")
    resp = requests.get(url, stream=True)
    return StreamingResponse(resp.iter_content(chunk_size=4096), media_type="application/octet-stream")
```

## 2. Frontend: Interactive 3D Rendering
The frontend uses **React Three Fiber** and **Drei** to display models with high-quality lighting and interactive movement controls.

### `frontend/components/Cell3DViewer.tsx` (The Engine)
```tsx
"use client"
import React, { Suspense } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, useGLTF, PivotControls, Environment, ContactShadows } from "@react-three/drei"

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url)
  // Deep clone ensures independent instances for multiple models
  const clonedScene = React.useMemo(() => scene.clone(true), [scene])
  return <primitive object={clonedScene} scale={1.5} />
}

export default function Cell3DViewer({ models = [] }: { models?: string[] }) {
  return (
    <div className="w-full h-full min-h-[400px] bg-gradient-to-b from-[#E0F2FE] to-[#F8FAFC]">
      <Canvas shadows camera={{ position: [10, 10, 10], fov: 40 }}>
        <color attach="background" args={['#f0f9ff']} />
        <ambientLight intensity={1.5} />
        <pointLight position={[20, 20, 20]} intensity={2} castShadow />
        <Environment preset="city" /> {/* Critical for PBR colors */}
        
        <Suspense fallback={null}>
          {models.length > 0 ? (
            <group>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow opacity={0.4} transparent>
                <circleGeometry args={[15, 64]} />
                <meshStandardMaterial color="#ffffff" />
              </mesh>
              <ContactShadows position={[0, -0.04, 0]} opacity={0.4} scale={20} blur={2} />
              
              {models.map((url, index) => (
                <PivotControls key={index} offset={[index * 2.5, 0, 0]} activeAxes={[true, true, true]}>
                  <Model url={url} />
                </PivotControls>
              ))}
            </group>
          ) : (
            <GridPlaceholder /> /* Circular platform + Grid Helper */
          )}
          <OrbitControls makeDefault enableDamping={true} />
        </Suspense>
      </Canvas>
    </div>
  )
}
```

## 3. Integration: Polling & State
The `StudentTaskPage` manages the logic of sending prompts, tracking progress, and updating the model array.

### `frontend/app/task/page.tsx` (Logic Layer)
```tsx
const pollTaskStatus = async (taskId: string) => {
  const interval = setInterval(async () => {
    const res = await fetch(`http://127.0.0.1:8000/task/${taskId}`);
    const data = await res.json();
    if (data.status === "SUCCEEDED") {
      clearInterval(interval);
      const finalUrl = data.model_urls.glb;
      const proxyUrl = `http://127.0.0.1:8000/proxy?url=${encodeURIComponent(finalUrl)}`;
      setModels(prev => [...prev, proxyUrl]); // Add to multi-model scene
    }
  }, 3000);
};
```

## Summary of Key Fixes Applied:
1. **CORS/Proxy:** All models are routed through the backend `/proxy` to fix browser "Failed to Fetch" errors.
2. **PBR Colors:** Added `Environment` and high-intensity lights to ensure models aren't black/gray.
3. **Multi-Model:** Used `scene.clone(true)` and an array state to support multiple objects.
4. **Interaction:** Integrated `PivotControls` so every model can be moved/rotated by the student.
