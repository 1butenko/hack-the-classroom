"use client"

import React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function ShareContent() {
  const searchParams = useSearchParams()
  const code = searchParams.get("code") || "ABC-332-FGH"
  const joinUrl = `http://localhost:3000/join?code=${code}`

  return (
    <div className="flex flex-col items-center gap-12 max-w-6xl w-full">
      <div className="flex flex-col lg:flex-row items-center gap-8 w-full justify-center">
        {/* Left Column: Instructions and Code */}
        <div className="flex flex-col gap-6 w-full max-w-[500px]">
          {/* Header Badge */}
          <div className="border border-white/40 rounded-full px-8 py-4 text-center bg-white/5 backdrop-blur-sm">
            <span className="text-white text-lg font-medium">
              Приєднайтесь за QR-кодом або кодом доступу
            </span>
          </div>

          {/* Main Code Card */}
          <Card className="bg-white rounded-[40px] p-10 border-none shadow-2xl transition-transform hover:scale-[1.02]">
            <div className="flex flex-col gap-1 mb-6">
              <p className="text-gray-900 text-xl font-medium font-sans">
                Перейдіть на <span className="text-brand font-bold">http://localhost:3000/join</span>
              </p>
              <p className="text-gray-900 text-xl font-medium font-sans">
                Введіть наступний код:
              </p>
            </div>

            <div className="bg-brand rounded-[24px] py-8 flex items-center justify-center shadow-xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <span className="text-white text-5xl font-black tracking-[0.15em] font-sans relative z-10">
                {code}
              </span>
            </div>
          </Card>
        </div>

        {/* Right Column: QR Code */}
        <Card className="bg-white rounded-[40px] p-10 border-none shadow-2xl flex items-center justify-center w-full max-w-[400px] aspect-square text-gray-900 transition-transform hover:scale-[1.02]">
          <div className="relative w-full h-full p-4">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(joinUrl)}&color=000000&bgcolor=ffffff&margin=1`} 
              alt="Join QR Code"
              className="w-full h-full object-contain"
            />
          </div>
        </Card>
      </div>

      {/* NEW: Action Button for Teacher */}
      <div className="mt-4 animate-bounce-subtle">
        <Link href={`/dashboard/${code}`}>
          <Button 
            className="bg-white text-brand hover:bg-white/90 rounded-[30px] px-12 h-[72px] text-[22px] font-bold shadow-2xl transition-all hover:px-16 flex items-center gap-4 group"
          >
            <span>Результати учнів</span>
            <div className="w-10 h-10 bg-brand rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform">
              <Users className="w-5 h-5 text-white" />
            </div>
          </Button>
        </Link>
      </div>
    </div>
  )
}

// Don't forget to import Users icon
import { ArrowLeft, Users } from "lucide-react"

export default function TaskSharePage() {
  return (
    <div className="min-h-screen w-full bg-brand flex flex-col items-center justify-center p-6 font-sans">
      {}
      <Link href="/" className="absolute top-8 left-8">
        <Button variant="ghost" className="text-white hover:bg-white/10 gap-2 rounded-xl cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
          Назад
        </Button>
      </Link>

      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <ShareContent />
      </Suspense>
    </div>
  )
}