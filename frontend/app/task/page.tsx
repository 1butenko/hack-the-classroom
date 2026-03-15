"use client"

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

      if (data.ok && data.task_id) {
        pollTaskStatus(data.task_id, currentPrompt)
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
}