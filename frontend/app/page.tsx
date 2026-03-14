"use client"

import React from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { PreviewArea } from "@/components/dashboard/preview-area"

export default function DashboardPage() {
  return (
    <div className="flex h-screen w-full bg-brand p-6 gap-6 overflow-hidden font-sans tracking-[0.01em]">
      <Sidebar />
      <PreviewArea />
    </div>
  )
}
