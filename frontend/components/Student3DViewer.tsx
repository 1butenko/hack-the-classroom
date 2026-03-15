"use client"

import React from "react"

export default function Student3DViewer({ modelStates = [], onModelsChange }: { modelStates: any[], onModelsChange: (states: any[]) => void }) {
  return (
    <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center bg-[#f8fafc] border-2 border-dashed border-slate-200">
      <div className="text-slate-400 font-light mb-4">
        Студентський 3D Лабораторний Контейнер
      </div>
      <div className="flex gap-2 flex-wrap justify-center p-4">
        {modelStates.map((s: any, i: number) => (
          <div key={i} className="px-4 py-2 bg-white border border-brand/20 rounded-xl text-xs text-brand shadow-sm">
            Об'єкт: {s.prompt}
          </div>
        ))}
      </div>
    </div>
  )
}
