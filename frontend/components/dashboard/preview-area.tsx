"use client"

import React from "react"
import { Card } from "@/components/ui/card"

export function PreviewArea() {
  return (
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
  );
}
