"use client"

import React from "react"
import { ScrollArea } from "@/components/ui/scroll-area"

export function ChatHistory() {
  return (
    <ScrollArea className="flex-1 p-6">
      <div className="flex flex-col gap-6">
        <div className="flex justify-end">
          <div className="bg-brand text-white p-4 px-5 rounded-[20px] rounded-tr-none max-w-[90%] text-sm leading-[1.4] font-normal tracking-[0.02em]">
            Створи інтерактивне завдання, де учні мають працювати з клітиною, та називати її елементи
          </div>
        </div>

        <div className="flex flex-col gap-5 text-sm text-text-main leading-[1.6] font-normal tracking-[0.01em]">
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
            <span className="text-[15px] font-medium text-text-main tracking-[0.01em]">🧩 Завдання 1 — Визнач елемент клітини</span>
            <p className="text-text-main/80 tracking-[0.01em]">
              Учням показується схема клітини з позначеними цифрами.<br />
              Їхнє завдання — назвати елемент клітини, який відповідає кожному номеру.
            </p>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}