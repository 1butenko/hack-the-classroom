"use client"

import React, { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { ArrowUpRight } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import * as THREE from "three"

const Teacher3DViewer = dynamic(() => import("@/components/Teacher3DViewer"), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-gray-400 font-sans text-sm">Завантаження...</div>
})

interface Message {
  role: 'user' | 'ai'
  content: string | React.ReactNode
}

export default function DashboardPage() {
  const [prompt, setPrompt] = useState("")
  const [modelUrl, setModelUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [status, setStatus] = useState<string>("")
  const [baseModelConfig, setBaseModelConfig] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea && !isExpanded) {
      textarea.style.height = "auto"
      const nextHeight = Math.min(textarea.scrollHeight, 120)
      textarea.style.height = `${nextHeight}px`
    }
  }, [prompt, isExpanded])

  const pollTaskStatus = async (taskId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8802/task/${taskId}`)
        const data = await response.json()
        
        if (data.status === "PROCESSING") {
          setStatus(`Генерація... ${data.progress || 0}%`)
        } else if (data.status === "REFINING") {
          setStatus(`Покращення якості (Refine)... ${data.progress || 0}%`)
        }

        // Show model if URL is available (either preview during refining, or final)
        if (data.model_url) {
          const proxyUrl = data.model_url.startsWith("http") 
            ? `http://127.0.0.1:8802/proxy?url=${encodeURIComponent(data.model_url)}`
            : data.model_url
          setModelUrl(proxyUrl)
        }

        if (data.status === "SUCCEEDED") {
          clearInterval(interval)
          setStatus("Готово!")
        } else if (data.status === "FAILED") {
          clearInterval(interval)
          setStatus("Помилка генерації")
        }
      } catch (err) {
        console.error("Polling error:", err)
      }
    }, 3000)
  }

  const handleSend = async () => {
    if (!prompt.trim()) return
    const userMessage = prompt
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setPrompt("")
    setIsLoading(true)
    setStatus("Обробка запиту...")

    try {
      const response = await fetch("http://127.0.0.1:8802/prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          prompt: userMessage,
          room_id: currentTaskId // Send context if we have it
        }),
      })
      const data = await response.json()
      
      if (data.ok) {
        if (data.is_final === false) {
          // AI needs clarification - add to chat and stop loading
          setMessages(prev => [...prev, { role: 'ai', content: data.llm_answer || "Будь ласка, уточніть ваш запит." }])
          setIsLoading(false)
          setStatus("")
        } else if (data.task_id) {
          setCurrentTaskId(data.task_id)
          setMessages(prev => [...prev, { role: 'ai', content: data.llm_answer || "Генеруємо модель..." }])
          pollTaskStatus(data.task_id)
        }
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: "Помилка при генерації моделі." }])
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Error sending prompt:", error)
      setIsLoading(false)
    }
  }

  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleTeacherUpdate = (matrix: THREE.Matrix4) => {
    const position = new THREE.Vector3()
    const rotation = new THREE.Quaternion()
    const scale = new THREE.Vector3()
    matrix.decompose(position, rotation, scale)
    const euler = new THREE.Euler().setFromQuaternion(rotation)
    
    setBaseModelConfig({
      position: [position.x, position.y, position.z],
      rotation: [euler.x, euler.y, euler.z],
      scale: [scale.x, scale.y, scale.z]
    })
    // Reset success state if they move it again
    setSaveSuccess(false)
  }

  const saveBaseModelLayout = async () => {
    if (!currentTaskId || !baseModelConfig) return
    setIsSaving(true)
    try {
      await fetch(`http://127.0.0.1:8802/task/${currentTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_model_config: baseModelConfig })
      })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error("Error saving layout:", err)
    }
    setIsSaving(false)
  }

  useEffect(() => {
    if (status === "Готово!" || status === "Помилка генерації") {
      setTimeout(() => setIsLoading(false), 1000)
    }
  }, [status])

  return (
    <div className="flex h-screen w-full bg-[#1A69F3] p-6 gap-4 overflow-hidden font-sans text-gray-900">
      <Card className="flex flex-col w-[400px] bg-white rounded-[24px] border-none shadow-none overflow-hidden">
        <ScrollArea className="flex-1 p-6">
          <div className="flex flex-col gap-6">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={msg.role === 'user' ? "bg-[#1A69F3] text-white p-4 rounded-2xl rounded-tr-none text-sm font-light leading-relaxed" : "bg-gray-100 text-gray-800 p-4 rounded-2xl rounded-tl-none text-sm font-light leading-relaxed"}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && <div className="bg-gray-50 text-gray-400 p-4 rounded-2xl italic text-sm font-light">{status || "Генеруємо..."}</div>}
          </div>
        </ScrollArea>
        
        <div className="p-6 bg-white">
          <div className={`relative w-full transition-all duration-300 border border-[#D1D5DB] rounded-[32px] bg-white overflow-hidden flex flex-col group focus-within:border-brand/40 ${isExpanded ? 'h-[350px]' : 'min-h-[110px]'}`}>
            <textarea 
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 pt-6 px-6 pb-2 text-[16px] text-gray-800 placeholder:text-[#9CA3AF] font-light resize-none outline-none overflow-y-auto leading-relaxed scrollbar-thin"
              placeholder="Почніть створювати ваше завдання"
              disabled={isLoading}
            />
            
            <div className="flex justify-between items-center px-5 pb-5 bg-white">
              <button onClick={() => setIsExpanded(!isExpanded)} className="text-gray-400 hover:text-brand transition-colors p-1">
                <svg className={`w-5 h-5 fill-current transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
                  <path d="M408 64L552 64C565.3 64 576 74.7 576 88L576 232C576 241.7 570.2 250.5 561.2 254.2C552.2 257.9 541.9 255.9 535 249L496 210L409 297C399.6 306.4 384.4 306.4 375.1 297L343.1 265C333.7 255.6 333.7 240.4 343.1 231.1L430.1 144.1L391.1 105.1C384.2 98.2 382.2 87.9 385.9 78.9C389.6 69.9 398.3 64 408 64zM232 576L88 576C74.7 576 64 565.3 64 552L64 408C64 398.3 69.8 389.5 78.8 385.8C87.8 382.1 98.1 384.2 105 391L144 430L231 343C240.4 333.6 255.6 333.6 264.9 343L296.9 375C306.3 384.4 306.3 399.6 296.9 408.9L209.9 495.9L248.9 534.9C255.8 541.8 257.8 552.1 254.1 561.1C250.4 570.1 241.7 576 232 576z"/>
                </svg>
              </button>

              <Button 
                onClick={handleSend} 
                disabled={isLoading} 
                className="bg-[#1A69F3] hover:bg-[#1A69F3]/90 text-white rounded-[18px] h-[48px] px-6 text-[16px] font-medium flex items-center gap-3 transition-all border-none shadow-none"
              >
                <span>Надіслати</span>
                <div className="flex items-center justify-center w-5 h-5 bg-white rounded-full">
                  <ArrowUpRight className="w-3 h-3 text-[#1A69F3]" strokeWidth={3} />
                </div>
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-1 flex-col gap-4">
        <Card className="h-[80px] bg-white rounded-[24px] border-none shadow-none flex items-center justify-end px-6 gap-3">
          {currentTaskId && modelUrl && (
            <Button 
              onClick={saveBaseModelLayout} 
              disabled={isSaving} 
              variant="outline" 
              className={`rounded-xl px-5 h-10 text-sm font-light transition-all duration-300 ${
                saveSuccess 
                  ? "border-green-500 text-green-600 bg-green-50" 
                  : "border-green-200 text-green-600 hover:bg-green-50"
              }`}
            >
              {isSaving ? "Зберігаємо..." : saveSuccess ? "Збережено! ✅" : "Зберегти положення"}
            </Button>
          )}
          {currentTaskId && (
            <Link href={`/dashboard/${currentTaskId}`}>
              <Button variant="outline" className="border-gray-200 text-gray-600 rounded-xl px-5 h-10 text-sm font-light">Прогрес учнів</Button>
            </Link>
          )}
          <Link href={currentTaskId && !isLoading ? `/share?code=${currentTaskId}` : "#"}>
            <Button variant="outline" disabled={!currentTaskId || isLoading} className="border-brand text-brand rounded-xl px-5 h-10 text-sm font-light">Створити завдання</Button>
          </Link>
        </Card>
        <Card className="flex-1 bg-white rounded-[24px] border-none relative overflow-hidden flex items-center justify-center">
          <div className="w-full h-full relative">
            <Teacher3DViewer modelUrl={modelUrl} onUpdate={handleTeacherUpdate} />
            
            {/* Оверлей "Згенеруйте модель", який зникає автоматично */}
            {!modelUrl && !isLoading && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-10 transition-opacity duration-500">
                <div className="bg-white/90 px-8 py-4 rounded-3xl shadow-2xl text-gray-900 text-lg font-medium tracking-tight">
                  Згенеруйте модель, щоб почати
                </div>
              </div>
            )}

            {/* Статус генерації */}
            {isLoading && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-white/20 border-t-brand rounded-full animate-spin" />
                  <p className="text-white text-xl font-bold animate-pulse tracking-tight">{status}</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
