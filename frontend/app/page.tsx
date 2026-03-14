"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"

export default function DashboardPage() {
  return (
    <div className="flex h-screen w-full bg-brand p-6 gap-6 overflow-hidden font-sans">
      <Card className="flex flex-col w-96 bg-white rounded-3xl border-none overflow-hidden shadow-none">
        <ScrollArea className="flex-1 p-6">
          <div className="flex flex-col gap-6">
            <div className="flex justify-end">
              <div className="bg-brand text-white p-4 rounded-2xl rounded-tr-none max-w-[85%] text-sm leading-relaxed">
                Створи інтерактивне завдання, де учні мають працювати з клітиною, та називати її елементи
              </div>
            </div>

            <div className="flex flex-col gap-4 text-sm text-gray-800 leading-relaxed font-normal">
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
                <span className="text-base font-normal">🧩 Завдання 1 — Визнач елемент клітини</span>
                <p>
                  Учням показується схема клітини з позначеними цифрами.<br />
                  Їхнє завдання — назвати елемент клітини, який відповідає кожному номеру.
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 bg-white">
          <div className="flex items-center gap-2 p-1.5 pl-4 border border-gray-200 rounded-2xl">
            <Input 
              className="border-none shadow-none focus-visible:ring-0 p-0 h-auto text-sm placeholder:text-gray-400 font-normal"
              placeholder="Почніть створювати ваше завдання"
            />
            <Button className="bg-brand hover:opacity-90 rounded-xl h-10 px-4 text-sm font-normal flex items-center gap-2 shrink-0">
              Надіслати
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 640 640" 
                className="w-4 h-4 fill-current"
              >
                <path d="M566.6 342.6C579.1 330.1 579.1 309.8 566.6 297.3L406.6 137.3C394.1 124.8 373.8 124.8 361.3 137.3C348.8 149.8 348.8 170.1 361.3 182.6L466.7 288L96 288C78.3 288 64 302.3 64 320C64 337.7 78.3 352 96 352L466.7 352L361.3 457.4C348.8 469.9 348.8 490.2 361.3 502.7C373.8 515.2 394.1 515.2 406.6 502.7L566.6 342.7z"/>
              </svg>
            </Button>
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
