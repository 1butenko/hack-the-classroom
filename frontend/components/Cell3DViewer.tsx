"use client"

import React from "react"

export default function Cell3DViewer({ models = [] }: { models?: string[] }) {
  return (
    <div className="w-full h-full min-h-[500px] flex items-center justify-center bg-slate-50 border-2 border-dashed border-slate-200">
      <div className="text-slate-400 font-light text-center">
        Порожній перегляд (Cell3DViewer)<br/>
        Кількість моделей: {models.length}
      </div>
    </div>
  )
}
