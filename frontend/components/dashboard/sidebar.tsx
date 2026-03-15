"use client"

import React from "react"
import { Card } from "@/components/ui/card"
import { ChatHistory } from "./chat-history"
import { MessageInput } from "./message-input"

export function Sidebar() {
  return (
    <Card className="flex flex-col w-[410px] bg-white rounded-3xl border-none overflow-hidden shadow-none shrink-0">
      <ChatHistory />
      <MessageInput />
    </Card>
  );
}