"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Sparkles } from "lucide-react"
import dynamic from "next/dynamic"

import { useState, useRef, useEffect } from "react"
import { ArrowUpRight } from "lucide-react"

// Import Cell3DViewer dynamically to avoid SSR issues with Three.js
const Cell3DViewer = dynamic(() => import("@/components/Cell3DViewer"), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-gray-400 font-sans text-sm">Loading 3D Model...</div>
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [status, setStatus] = useState<string>("")

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [prompt])

  const pollTaskStatus = async (taskId: string) => {
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
            // Use proxy to avoid CORS and fix malformed Meshy URLs
            const proxyUrl = finalUrl.startsWith("http") 
              ? `http://127.0.0.1:8000/proxy?url=${encodeURIComponent(finalUrl)}`
              : finalUrl
            setModelUrl(proxyUrl)
          }
        }
 else if (data.status === "FAILED") {
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

    const userMessage = prompt
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setPrompt("")
    setIsLoading(true)
    setStatus("Обробка запиту...")

    try {
      const response = await fetch("http://127.0.0.1:8000/prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: userMessage }),
      })

      const data = await response.json()

      if (data.ok) {
        setMessages(prev => [...prev, { 
          role: 'ai', 
          content: data.llm_answer || "Модель успішно згенерована! Ви можете побачити її в області перегляду." 
        }])
        
        if (data.task_id) {
          pollTaskStatus(data.task_id)
        }
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: "Вибачте, сталася помилка при генерації моделі." }])
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Error sending prompt:", error)
      setMessages(prev => [...prev, { role: 'ai', content: "Помилка зв'язку з сервером." }])
      setIsLoading(false)
    }
  }

  // Effect to stop loading when status is finished
  useEffect(() => {
    if (status === "Готово!" || status === "Помилка генерації") {
      setIsLoading(false)
    }
  }, [status])

  return (
    <div className="flex h-screen w-full bg-[#1A69F3] p-6 gap-4 overflow-hidden font-sans">
      {/* Left Column: AI Chat Interface */}
      <Card className="flex flex-col w-[400px] bg-white rounded-[24px] border-none overflow-hidden shadow-none">
        <ScrollArea className="flex-1 p-6">
          <div className="flex flex-col gap-6">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={msg.role === 'user' 
                  ? "bg-[#1A69F3] text-white p-4 rounded-2xl rounded-tr-none max-w-[85%] text-sm leading-relaxed" 
                  : "bg-gray-100 text-gray-800 p-4 rounded-2xl rounded-tl-none max-w-[85%] text-sm leading-relaxed flex flex-col gap-2"}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-50 text-gray-400 p-4 rounded-2xl italic text-sm">
                  {status || "Генеруємо вашу відповідь та модель..."}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-6 pt-2 bg-white">
          <div className="relative w-full min-h-[120px] h-auto rounded-[24px] border border-gray-200 bg-white transition-all flex flex-col group focus-within:border-brand/40 shadow-sm overflow-hidden">
            <textarea 
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              rows={1}
              className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 pt-6 px-6 pb-2 text-[14px] text-gray-800 placeholder:text-gray-400 font-medium resize-none outline-none overflow-hidden leading-relaxed tracking-[0.02em]"
              placeholder="Почніть створювати ваше завдання"
              disabled={isLoading}
            />
            <div className="flex justify-end pr-5 pb-5 bg-white">
              <Button 
                onClick={handleSend}
                disabled={isLoading}
                className="bg-brand hover:bg-brand/90 text-white rounded-[14px] h-[44px] px-5 text-sm font-medium flex items-center gap-2 transition-all shadow-none border-none group cursor-pointer"
              >
                <span className="tracking-[0.02em]">{isLoading ? "..." : "Надіслати"}</span>
                {!isLoading && (
                  <div className="flex items-center justify-center w-5 h-5 bg-white rounded-full transition-colors">
                    <ArrowUpRight className="w-3 h-3 text-brand" strokeWidth={3} />
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Right Column: Content Preview Area */}
      <div className="flex flex-1 flex-col gap-4">
        {/* Top Panel */}
        <Card className="h-[80px] bg-white rounded-[24px] border-none shadow-none flex items-center justify-end px-6">
          <Button 
            variant="outline" 
            className="border-brand/30 text-brand hover:bg-brand hover:text-white rounded-xl px-5 h-10 text-sm font-medium transition-all duration-200 cursor-pointer"
          >
            Створити завдання
          </Button>
        </Card>

        {/* Bottom Panel (Main Content) */}
        <Card 
          className="flex-1 bg-white rounded-[24px] border-none shadow-none relative overflow-hidden flex items-center justify-center"
          style={{
            backgroundImage: 'radial-gradient(#e5e7eb 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px'
          }}
        >
          <div className="w-full h-full relative">
            <Cell3DViewer modelUrl={modelUrl} />
            
            {!modelUrl && !isLoading && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-8 text-center">
                <div className="max-w-[400px]">
                  <p className="text-white text-lg font-medium leading-relaxed tracking-wide">
                    Модель ще не створена.<br />Згенеруйте її, щоб почати.
                  </p>
                </div>
              </div>
            )}

            {isLoading && status && status.includes("Генерація") && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center z-10 transition-all">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                  <div className="max-w-[300px]">
                    <p className="text-white text-xl font-bold tracking-tight mb-1">
                      {status}
                    </p>
                    <p className="text-white/60 text-sm">
                      Це може зайняти до 1 хвилини
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
