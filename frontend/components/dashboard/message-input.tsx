"use client"

import React, { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowUpRight } from "lucide-react"

export function MessageInput() {
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [inputValue]);

  return (
    <div className="p-6 pt-2 bg-white">
      <div className="relative w-full min-h-[120px] h-auto rounded-[24px] border-[1.5px] border-border-main/40 bg-white transition-all flex flex-col group focus-within:border-brand/40 shadow-sm overflow-hidden">
        <textarea 
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          rows={1}
          className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 pt-6 px-6 pb-2 text-[14px] text-text-main placeholder:text-text-muted font-normal resize-none outline-none overflow-hidden leading-relaxed tracking-[0.02em]"
          placeholder="Почніть створювати ваше завдання"
        />
        <div className="flex justify-end pr-5 pb-5 bg-white">
          <Button className="bg-brand hover:bg-brand-hover text-white rounded-[14px] h-[44px] px-5 text-sm font-medium flex items-center gap-2 transition-all shadow-none border-none group">
            <span className="tracking-[0.02em]">Надіслати</span>
            <div className="flex items-center justify-center w-5 h-5 bg-white rounded-full transition-colors">
              <ArrowUpRight className="w-3 h-3 text-brand" strokeWidth={3} />
            </div>
          </Button>
        </div>
      </div>
    </div>
  );
}