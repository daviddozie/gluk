"use client";

import { useEffect, useRef } from "react";
import { Message } from "@/types/chat";
import MessageBubble from "./message-bubble";
import GlukLogo from "./svg";

interface ChatWindowProps {
  messages: Message[];
  isLoading?: boolean;
  theme: "light" | "dark";
}

const SUGGESTIONS = [
  { label: "Research a topic in depth", icon: "🔍" },
  { label: "Summarise an uploaded document", icon: "📄" },
  { label: "Compare two sources or ideas", icon: "⚖️" },
  { label: "Find the latest news on…", icon: "📰" },
];

export default function ChatWindow({ messages, isLoading, theme }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isDark = theme === "dark";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 transition-colors duration-300">
        <div className="flex flex-col items-center gap-3">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-colors duration-300 ${
            isDark
              ? "bg-white/4 border border-white/8 text-white"
              : "bg-black/4 border border-black/10 text-black"
          }`}>
            <GlukLogo size={44} />
          </div>
          <h1 className="text-2xl text-center font-semibold tracking-tight transition-colors duration-300">
            What would you like to research?
          </h1>
          <p className={`text-sm text-center max-w-sm transition-colors duration-300 ${
            isDark ? "text-white/40" : "text-black/50"
          }`}>
            Ask a question, upload a document, or start a deep dive — Gluk searches the web, reads sources, and delivers cited answers.
          </p>
        </div>

        {/* Suggestion chips */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-lg w-full mt-2">
          {SUGGESTIONS.map(({ label, icon }) => (
            <button
              key={label}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm text-left transition-all duration-200 ${
                isDark
                  ? "border-white/8 text-white/50 hover:border-white/20 hover:text-white/80 hover:bg-white/4"
                  : "border-black/10 text-black/50 hover:border-black/25 hover:text-black/80 hover:bg-black/4"
              }`}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto transition-colors duration-300">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} theme={theme} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}