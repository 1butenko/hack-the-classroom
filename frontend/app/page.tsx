"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { ArrowUpRight } from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="flex h-screen w-full bg-brand p-6 gap-6 overflow-hidden font-sans">
      <Card className="flex flex-col w-96 bg-white rounded-3xl border-none overflow-hidden shadow-none">
        <ScrollArea className="flex-1 p-6">
          <div className="flex flex-col gap-6">
            <div className="flex justify-end">
              <div className="bg-brand text-white p-4 px-5 rounded-[20px] rounded-tr-none max-w-[90%] text-sm leading-[1.4] font-normal tracking-tight">
                Створи інтерактивне завдання, де учні мають працювати з клітиною, та називати її елементи
              </div>
            </div>

            <div className="flex flex-col gap-5 text-sm text-[#0A0A0A] leading-[1.6] font-normal tracking-tight">
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
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-[15px] font-medium text-[#0A0A0A]">🧩 Завдання 1 — Визнач елемент клітини</span>
                <p className="text-[#0A0A0A]/80">
                  Учням показується схема клітини з позначеними цифрами.<br />
                  Їхнє завдання — назвати елемент клітини, який відповідає кожному номеру.
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-6 pt-2 bg-white">
          <div className="relative w-full h-32 rounded-[24px] border border-[#E5E7EB] bg-[#F9FAFB] focus-within:border-brand/30 transition-all flex flex-col">
            <textarea 
              className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 pt-5 px-6 text-[15px] placeholder:text-[#9CA3AF] font-normal resize-none outline-none leading-relaxed"
              placeholder="Почніть створювати ваше завдання"
            />
            <div className="flex justify-end pr-4 pb-4">
              <Button className="bg-brand hover:bg-[#1559D3] text-white rounded-[14px] h-[44px] px-5 text-sm font-medium flex items-center gap-2 transition-all shadow-none border-none group">
                Надіслати
                <div className="flex items-center justify-center w-5 h-5 bg-white/20 rounded-full group-hover:bg-white/30 transition-colors">
                  <ArrowUpRight className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                </div>
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-1 flex-col gap-4">
        <Card className="h-20 bg-white rounded-3xl border-none shadow-none" />

        <Card 
          className="flex-1 bg-white rounded-3xl border-none shadow-none relative flex items-center justify-center overflow-hidden"
          style={{
            backgroundImage: 'radial-gradient(#e5e7eb 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px'
          }}
        >
          <div className="relative w-4/5 h-4/5">
            <img 
              src="https://img.freepik.com/free-vector/internal-structure-animal-cell-white-background_1308-111107.jpg" 
              alt="3D Animal Cell" 
              className="w-full h-full object-contain"
            />
          </div>
        </Card>
      </div>
    </div>
  )
}
