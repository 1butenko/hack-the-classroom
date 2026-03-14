"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Sparkles } from "lucide-react"
import dynamic from "next/dynamic"

// Import Cell3DViewer dynamically to avoid SSR issues with Three.js
const Cell3DViewer = dynamic(() => import("@/components/Cell3DViewer"), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-gray-400 font-sans text-sm">Loading 3D Model...</div>
})

export default function DashboardPage() {
  return (
    <div className="flex h-screen w-full bg-[#1A69F3] p-6 gap-4 overflow-hidden font-sans">
      {/* Left Column: AI Chat Interface */}
      <Card className="flex flex-col w-[400px] bg-white rounded-3xl border-none overflow-hidden shadow-none">
        <ScrollArea className="flex-1 p-6 text-sm">
          <div className="flex flex-col gap-6">
            {/* User Message */}
            <div className="flex justify-end">
              <div className="bg-[#1A69F3] text-white p-4 rounded-2xl rounded-tr-none max-w-[85%] leading-relaxed">
                Створи інтерактивне завдання, де учні мають працювати з клітиною, та називати її елементи
              </div>
            </div>

            {/* AI Message */}
            <div className="flex flex-col gap-4 text-gray-800 leading-relaxed">
              <p>
                Ось приклад інтерактивного завдання для учнів, де вони працюють із клітиною та називають її елементи.
              </p>
              <p>
                Його можна використати на уроці біології або в онлайн-курсі.<br />
                🔗 Інтерактивне завдання: "Збери клітину"
              </p>
              <p>
                Мета: навчитися розпізнавати та називати основні частини клітини.
              </p>
              <div className="flex flex-col gap-2">
                <span className="font-semibold">🧩 Завдання 1 — Визнач елемент клітини</span>
                <p>
                  Учням показується схема клітини з позначеними цифрами.<br />
                  Їхнє завдання — назвати елемент клітини, який відповідає кожному номеру.
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-100">
          <div className="flex items-center gap-2 p-1.5 pl-4 border border-gray-200 rounded-2xl focus-within:border-[#1A69F3] transition-colors">
            <Input 
              className="border-none shadow-none focus-visible:ring-0 p-0 h-auto text-sm placeholder:text-gray-400 font-sans"
              placeholder="Почніть створювати ваше завдання"
            />
            <Button className="bg-[#1A69F3] hover:bg-[#1A69F3]/90 rounded-xl h-10 px-4 text-sm font-medium flex items-center gap-2 shrink-0 font-sans cursor-pointer shadow-none">
              Надіслати
              <svg width="18" height="18" viewBox="354 90 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-2 shrink-0">
                <rect x="354" y="90" width="18" height="18" rx="9" fill="white"/>
                <path d="M367.063 95.4346C367.063 95.0479 366.749 94.7339 366.363 94.7339L361.413 94.7339C361.026 94.7339 360.712 95.0479 360.712 95.4346C360.712 95.8213 361.026 96.1353 361.413 96.1353L364.674 96.1353L358.94 101.869C358.666 102.143 358.666 102.585 358.94 102.859C359.213 103.133 359.656 103.133 359.93 102.859L365.664 97.1253L365.664 100.386C365.664 100.773 365.978 101.087 366.364 101.087C366.751 101.087 367.065 100.773 367.065 100.386L367.065 95.4362L367.063 95.4346Z" fill="#1A69F3"/>
              </svg>
            </Button>
          </div>
        </div>
      </Card>

      {/* Right Column: Content Preview Area */}
      <div className="flex flex-1 flex-col gap-4">
        {/* Top Panel */}
        <Card className="h-[80px] bg-white rounded-3xl border-none shadow-none flex items-center justify-end px-6">
          <Button className="bg-[#1A69F3] hover:bg-[#1A69F3]/90 text-white rounded-xl h-10 px-4 font-medium flex items-center font-sans cursor-pointer shadow-none">
            <Sparkles className="w-4 h-4 mr-2" />
            Створити завдання
          </Button>
        </Card>

        {/* Bottom Panel (Main Content) */}
        <Card 
          className="flex-1 bg-white rounded-3xl border-none shadow-none relative overflow-hidden flex items-center justify-center"
          style={{
            backgroundImage: 'radial-gradient(#e5e7eb 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px'
          }}
        >
          <div className="w-full h-full relative">
            <Cell3DViewer />
          </div>
        </Card>
      </div>
    </div>
  )
}
