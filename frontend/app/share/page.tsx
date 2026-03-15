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
  const joinUrl = `https://vyvchai.vercel.app/join?code=${code}`

  return (
    <div className="flex flex-col lg:flex-row items-center gap-8 max-w-6xl w-full justify-center">
      {}
      <div className="flex flex-col gap-6 w-full max-w-[500px]">
        {}
        <div className="border border-white/40 rounded-full px-8 py-4 text-center">
          <span className="text-white text-lg font-medium">
            Приєднайтесь за QR-кодом або кодом доступу
          </span>
        </div>

        {}
        <Card className="bg-white rounded-[40px] p-10 border-none shadow-2xl">
          <div className="flex flex-col gap-1 mb-6">
            <p className="text-gray-900 text-xl font-medium font-sans">
              Перейдіть на <span className="text-brand">https://vyvchai.vercel.app/join</span>
            </p>
            <p className="text-gray-900 text-xl font-medium font-sans">
              Введіть наступний код:
            </p>
          </div>

          <div className="bg-brand rounded-[20px] py-6 flex items-center justify-center shadow-lg">
            <span className="text-white text-4xl font-bold tracking-[0.1em] font-sans">
              {code}
            </span>
          </div>
        </Card>
      </div>

      {}
      <Card className="bg-white rounded-[40px] p-10 border-none shadow-2xl flex items-center justify-center w-full max-w-[400px] aspect-square text-gray-900">
        <div className="relative w-full h-full">
          <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(joinUrl)}&color=000000`} 
            alt="Join QR Code"
            className="w-full h-full object-contain"
          />
        </div>
      </Card>
    </div>
  )
}

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