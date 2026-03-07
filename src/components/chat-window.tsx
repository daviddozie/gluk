"use client";

import { useEffect, useRef } from "react";
import { Message } from "@/types/chat";
import MessageBubble from "./message-bubble";
import GlukLogo from "./svg";

interface ChatWindowProps {
  messages: Message[];
  isLoading?: boolean;
}

export default function ChatWindow({ messages, isLoading }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shadow-lg">
            <GlukLogo size={44} />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            How can I help you today?
          </h1>
          <p className="text-white/40 text-sm text-center max-w-sm">
            Ask me anything — I'm here to help with questions, analysis, writing, code, and more.
          </p>
        </div>

        {/* Suggestion chips */}
        <div className="grid grid-cols-2 gap-2 max-w-lg w-full mt-2">
          {[
            "Explain quantum computing",
            "Write a Python script",
            "Summarize a topic",
            "Help me brainstorm ideas",
          ].map((suggestion) => (
            <button
              key={suggestion}
              className="px-4 py-3 rounded-xl border border-white/[0.08] text-white/50 text-sm text-left hover:border-white/20 hover:text-white/80 hover:bg-white/[0.04] transition-all"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}