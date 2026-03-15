"use client"

import React, { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, Users, CheckCircle2, Clock, Trophy } from "lucide-react"
import Link from "next/link"

interface Participant {
  id: number
  name: string
  status: string
  score?: number
  ai_feedback?: string
  last_heartbeat: string
}

export default function StudentProgressDashboard() {
  const { taskId } = useParams()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [task, setTask] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchTask = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/task/${taskId}`)
      if (response.ok) {
        const data = await response.json()
        setTask(data)
      }
    } catch (error) {
      console.error("Error fetching task:", error)
    }
  }

  const fetchParticipants = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/task/${taskId}/participants`)
      if (response.ok) {
        const data = await response.json()
        setParticipants(data)
      }
    } catch (error) {
      console.error("Error fetching participants:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTask()
    fetchParticipants()
    const interval = setInterval(fetchParticipants, 5000)
    return () => clearInterval(interval)
  }, [taskId])

  const submittedCount = participants.filter(p => p.status === "submitted").length

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 font-sans">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        {}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" className="rounded-full w-10 h-10 p-0 hover:bg-white shadow-sm">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Прогрес учнів</h1>
              <p className="text-gray-500 text-sm">Код кімнати: <span className="font-mono font-bold text-brand">{taskId}</span></p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <Card className="px-6 py-3 bg-white border-none shadow-sm flex items-center gap-3 rounded-2xl">
              <div className="w-10 h-10 bg-brand/10 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-brand" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Приєдналося</p>
                <p className="text-xl font-bold text-gray-900">{participants.length}</p>
              </div>
            </Card>
            <Card className="px-6 py-3 bg-white border-none shadow-sm flex items-center gap-3 rounded-2xl">
              <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Здано робіт</p>
                <p className="text-xl font-bold text-gray-900">{submittedCount}</p>
              </div>
            </Card>
          </div>
        </div>

        {}
        {task && task.description && (
          <Card className="p-6 bg-brand text-white border-none shadow-lg rounded-[24px]">
            <h2 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-2">Навчальна мета</h2>
            <p className="text-xl font-medium leading-relaxed italic">
              «{task.description}»
            </p>
          </Card>
        )}

        {}
        <div className="grid grid-cols-1 gap-6">
          <Card className="bg-white border-none shadow-sm rounded-[32px] overflow-hidden">
            <div className="p-8 border-b border-gray-50 bg-white/50">
              <h2 className="text-lg font-bold text-gray-900">Список класу</h2>
            </div>
            
            <ScrollArea className="h-[600px]">
              <div className="p-4">
                {participants.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <Users className="w-10 h-10 text-gray-200" />
                    </div>
                    <p className="text-gray-400 font-medium">Ще жоден учень не приєднався</p>
                    <p className="text-sm text-gray-300">Поділіться кодом {taskId}, щоб почати</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {participants.map((student) => (
                      <Card key={student.id} className="p-6 bg-white border border-gray-100 shadow-none rounded-2xl hover:border-brand/20 transition-all group">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${student.status === 'submitted' ? 'bg-green-500' : 'bg-brand'}`}>
                              {student.name[0].toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900">{student.name}</h3>
                              <p className="text-xs text-gray-400">
                                {student.status === 'submitted' ? 'Роботу здано' : 'У процесі...'}
                              </p>
                            </div>
                          </div>
                          {student.status === 'submitted' && (
                            <div className="bg-brand/5 text-brand px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                              <Trophy className="w-3 h-3" />
                              {student.score}
                            </div>
                          )}
                        </div>

                        {student.status === 'submitted' ? (
                          <div className="mt-4 bg-gray-50 p-4 rounded-xl">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Фідбек від AI</p>
                            <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                              {student.ai_feedback}
                            </p>
                          </div>
                        ) : (
                          <div className="mt-4 flex items-center gap-2 text-gray-300 italic text-sm py-4 border-2 border-dashed border-gray-50 rounded-xl justify-center">
                            <Clock className="w-4 h-4 animate-pulse" />
                            Очікуємо на роботу
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </div>
    </div>
  )
}