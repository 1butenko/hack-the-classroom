"use client"

import React, { useState, Suspense } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter, useSearchParams } from "next/navigation"

function JoinForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const codeFromUrl = searchParams.get("code") || ""
  
  const [name, setName] = useState("")
  const [code, setCode] = useState(codeFromUrl)

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !code.trim()) return
    router.push(`/task?code=${code.trim().toUpperCase()}&name=${encodeURIComponent(name.trim())}`)
  }

  return (
    <Card className="bg-white rounded-[40px] p-12 border-none shadow-2xl w-full max-w-[480px] flex flex-col">
      <div className="flex flex-col gap-8">
        <h1 className="text-[48px] font-bold text-[#1A69F3] tracking-tight leading-none text-left">
          Приєднатися
        </h1>

        <form onSubmit={handleJoin} className="w-full flex flex-col gap-6">
          {}
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-medium text-black ml-1">
              Код від вчителя
            </label>
            <Input 
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Код від вчителя"
              className="h-[54px] rounded-[20px] border-[#D1D5DB] focus:border-[#1A69F3] focus:ring-0 px-5 text-[16px] text-gray-800 placeholder:text-[#9CA3AF] font-light bg-white"
              required
            />
          </div>

          {}
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-medium text-black ml-1">
              Прізвище та ім'я
            </label>
            <Input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ваше прізвище та ім'я"
              className="h-[54px] rounded-[20px] border-[#D1D5DB] focus:border-[#1A69F3] focus:ring-0 px-5 text-[16px] text-gray-800 placeholder:text-[#9CA3AF] font-light bg-white"
              required
            />
          </div>

          <Button 
            type="submit"
            className="h-[54px] rounded-[18px] bg-[#1A69F3] hover:bg-[#1A69F3]/90 text-white text-[18px] font-medium transition-all mt-4 cursor-pointer shadow-none border-none"
          >
            Приєднатися
          </Button>
        </form>
      </div>
    </Card>
  )
}

export default function JoinPage() {
  return (
    <div className="min-h-screen w-full bg-[#1A69F3] flex flex-col items-center justify-center p-6 font-sans">
      <Suspense fallback={<div className="text-white text-xl">Завантаження...</div>}>
        <JoinForm />
      </Suspense>
    </div>
  )
}