"use client"

import React, { useState, useRef, useEffect, Suspense } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowUpRight, Trash2, User, Info, X } from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"

interface ModelState {
  id: string 
  url: string
  prompt: string
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

const Student3DViewer = dynamic(() => import("@/components/Student3DViewer"), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-gray-400 font-sans text-sm">Loading Laboratory...</div>
})

function TaskContent() {
  const searchParams = useSearchParams()
  const roomCode = searchParams.get("code") || "UNKNOWN"
  const studentName = searchParams.get("name") || "Студент"
  
  const [prompt, setPrompt] = useState("")
  const [modelStates, setModelStates] = useState<ModelState[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [grade, setGrade] = useState<{score: number, feedback: string} | null>(null)
  const [status, setStatus] = useState<string>("")
  const [showTaskInfo, setShowTaskInfo] = useState(false)
  const [taskDetails, setTaskDetails] = useState({ title: "", description: "" })
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (roomCode !== "UNKNOWN") {
      const initializeTask = async () => {
        try {
          await fetch(`http://127.0.0.1:8802/task/${roomCode}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: studentName, task_id: roomCode })
          })
          pollTaskStatus(roomCode, "Teacher Base Model", true)
        } catch (err) {
          console.error("Error initializing task:", err)
        }
      }
      initializeTask()
    }
  }, [roomCode, studentName])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [prompt])

  const pollTaskStatus = async (taskId: string, originalPrompt: string, isBaseModel: boolean = false) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8802/task/${taskId}`)
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`)
        
        const data = await response.json()
        
        // Update task details if this is the base model poll
        if (isBaseModel && data) {
          setTaskDetails({
            title: data.description || "Завдання 3D Лабораторії",
            description: data.grading_criteria || "Деталі завдання відсутні."
          })
        }

        if (!isBaseModel) {
          if (data.status === "REFINING") setStatus(`Покращення... ${data.progress || 0}%`)
          else if (data.status === "PROCESSING") setStatus(`Генерація... ${data.progress || 0}%`)
        }

        if (data.model_url) {
          const proxyUrl = data.model_url.startsWith("http") 
            ? `http://127.0.0.1:8802/proxy?url=${encodeURIComponent(data.model_url)}`
            : data.model_url
          
          setModelStates(prev => {
            const isBase = taskId === roomCode
            const existingIndex = prev.findIndex(s => s.id === taskId)
            
            if (existingIndex >= 0) {
              const next = [...prev]
              next[existingIndex] = { ...next[existingIndex], url: proxyUrl }
              return next
            } else {
              const baseConfig = data.base_model_config ? JSON.parse(data.base_model_config) : null
              const newModel: ModelState = {
                id: taskId,
                url: proxyUrl,
                prompt: originalPrompt,
                position: isBase ? (baseConfig?.position || [0, 0, 0]) : [0, 0, 0],
                rotation: isBase ? (baseConfig?.rotation || [0, 0, 0]) : [0, 0, 0],
                scale: isBase ? (baseConfig?.scale || [1, 1, 1]) : [1, 1, 1]
              }
              // If it's the base model, put it at the start. Otherwise at the end.
              return isBase ? [newModel, ...prev.filter(m => m.id !== roomCode)] : [...prev, newModel]
            }
          })

          if (data.status === "SUCCEEDED") {
            clearInterval(interval)
            if (!isBaseModel) setStatus("Готово!")
          }
        } else if (data.status === "FAILED") {
          clearInterval(interval)
          if (!isBaseModel) setStatus("Помилка генерації")
        }
      } catch (err) {
        console.error("Polling error:", err)
      }
    }, 3000)
  }

  const handleSend = async () => {
    if (!prompt.trim()) return
    const currentPrompt = prompt
    setIsLoading(true)
    setStatus("Обробка запиту...")

    try {
      const response = await fetch("http://127.0.0.1:8802/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: currentPrompt,
          room_id: roomCode !== "UNKNOWN" ? roomCode : null,
          role: "student"
        }),
      })

      const data = await response.json()
      if (data.ok) {
        if (data.is_final === false) {
          setStatus(data.llm_answer || "Потрібне уточнення")
          setTimeout(() => { setIsLoading(false); setPrompt(""); }, 2000)
        } else if (data.task_id) {
          pollTaskStatus(data.task_id, currentPrompt, false)
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
    if (modelStates.length === 0) {
      console.log("DEBUG: No models to submit")
      return
    }
    setIsSubmitting(true)
    console.log("DEBUG: Submitting work for", studentName, "in room", roomCode)
    console.log("DEBUG: Model States:", modelStates)
    
    try {
      const res = await fetch(`http://127.0.0.1:8802/task/${roomCode}/participant/${encodeURIComponent(studentName)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompts_used: modelStates.map(s => s.prompt),
          spatial_data: modelStates
        })
      })
      
      console.log("DEBUG: Submit response status:", res.status)
      const data = await res.json()
      console.log("DEBUG: Submit data:", data)
      
      if (data.ok) setGrade({ score: data.score, feedback: data.feedback })
      else alert("Помилка при здачі: " + (data.error || "Невідома помилка"))
    } catch (e) { 
      console.error("DEBUG: Submit Fetch Error:", e) 
      alert("Помилка зв'язку з сервером")
    }
    setIsSubmitting(false)
  }

  useEffect(() => {
    if (status === "Готово!" || status === "Помилка генерації" || status === "Помилка сервісу") {
      setTimeout(() => { setIsLoading(false); setPrompt(""); }, 1000)
    }
  }, [status])

  return (
    <Card className="w-full h-[calc(100vh-48px)] bg-white rounded-[40px] border-none shadow-2xl relative overflow-hidden flex flex-col">
      <div className="absolute top-8 left-8 right-8 z-10 flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <Link href={roomCode !== "UNKNOWN" ? `/join?code=${roomCode}` : "/"}>
            <Button variant="ghost" className="text-gray-400 hover:bg-gray-100 gap-2 rounded-xl cursor-pointer">
              <ArrowLeft className="w-4 h-4" /> Назад
            </Button>
          </Link>
          <div className="bg-brand/10 text-brand px-4 py-1.5 rounded-full text-sm font-medium border border-brand/20 flex items-center gap-2">
            <User className="w-3.5 h-3.5" /> {studentName}
          </div>
          <div className="bg-gray-100 text-gray-500 px-4 py-1.5 rounded-full text-sm font-medium border border-gray-200">
            Кімната: {roomCode}
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <Button onClick={() => setShowTaskInfo(true)} variant="outline" className="border-brand/20 text-brand hover:bg-brand/5 gap-2 rounded-xl h-[74px] px-6 text-lg font-light">
            <Info className="w-5 h-5" /> Про завдання
          </Button>
          {modelStates.length > 0 && !grade && (
            <Button onClick={submitWork} disabled={isSubmitting || isLoading} className="bg-[#1A69F3] hover:bg-[#1A69F3]/90 text-white rounded-[40px] px-12 h-[74px] text-[24px] font-medium shadow-xl border-none cursor-pointer">
              {isSubmitting ? "Оцінюємо..." : "Здати роботу"}
            </Button>
          )}
        </div>
      </div>

      {/* Task Info Modal */}
      {showTaskInfo && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-8">
          <Card className="bg-white rounded-[40px] p-10 shadow-2xl max-w-[600px] w-full relative flex flex-col gap-6 border-none animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setShowTaskInfo(false)}
              className="absolute top-8 right-8 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div>
              <div className="text-brand text-sm font-medium uppercase tracking-wider mb-2">Деталі завдання</div>
              <h2 className="text-3xl font-light text-gray-900 mb-4 tracking-tight">{taskDetails.title}</h2>
              <div className="h-px w-full bg-gray-100 my-6" />
              <div className="text-gray-600 leading-relaxed text-lg font-light space-y-4">
                <p>{taskDetails.description}</p>
              </div>
            </div>
            <Button onClick={() => setShowTaskInfo(false)} className="mt-4 bg-brand text-white rounded-2xl h-14 text-lg font-medium border-none">
              Зрозумів, до роботи!
            </Button>
          </Card>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-slate-50/30">
          <Student3DViewer modelStates={modelStates} onModelsChange={setModelStates} />
        </div>
        
        {isLoading && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center z-30 transition-all">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              <div className="max-w-[300px]">
                <p className="text-white text-2xl font-light tracking-tight mb-1">{status}</p>
                <p className="text-white/60 text-sm font-light">Зачекайте, поки магія працює...</p>
              </div>
            </div>
          </div>
        )}

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
              <Button onClick={() => setGrade(null)} variant="outline" className="mt-4 rounded-xl border-gray-200 text-gray-600 hover:bg-gray-50 font-light">
                Закрити
              </Button>
            </Card>
          </div>
        )}

        <div className={`transition-all duration-700 ease-in-out w-full flex justify-center z-20 px-10 absolute bottom-10 left-0 right-0`}>
          <div className="relative w-full max-w-4xl min-h-[140px] h-auto rounded-[32px] border border-gray-200 bg-white shadow-2xl flex flex-col group focus-within:border-brand/40 overflow-hidden">
            <textarea 
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              rows={1}
              className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 pt-8 px-8 pb-4 text-lg text-gray-800 placeholder:text-gray-400 font-light resize-none outline-none overflow-hidden leading-relaxed tracking-tight"
              placeholder="Додати об'єкт у сцену..."
              disabled={isLoading}
            />
            <div className="flex justify-end pr-6 pb-6 bg-white">
              <Button onClick={handleSend} disabled={isLoading} className="bg-brand hover:bg-brand/90 text-white rounded-[18px] h-[52px] px-8 text-lg font-medium flex items-center gap-3 transition-all cursor-pointer shadow-none border-none group">
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
      <Suspense fallback={<div className="text-white text-center mt-20">Loading Lab...</div>}>
        <TaskContent />
      </Suspense>
    </div>
  )
}
