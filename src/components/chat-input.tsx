"use client";

import { useState, useRef, useEffect } from "react";

interface ChatInputProps {
    onSend: (message: string) => void;
    onAbort: () => void;
    isStreaming: boolean;
}

export default function ChatInput({ onSend, onAbort, isStreaming }: ChatInputProps) {
    const [input, setInput] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [input]);

    const handleSend = () => {
        if (!input.trim() || isStreaming) return;
        onSend(input.trim());
        setInput("");
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="px-4 pb-6 pt-2">
            <div className="max-w-3xl mx-auto">
                <div className="relative flex items-end gap-2 bg-white/[0.05] border border-white/[0.1] rounded-2xl px-4 py-3 focus-within:border-white/[0.2] transition-colors">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Message Gluk..."
                        rows={1}
                        className="flex-1 bg-transparent text-white placeholder-white/30 text-sm resize-none outline-none leading-6 max-h-[200px] overflow-y-auto"
                        disabled={isStreaming}
                    />

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {isStreaming ? (
                            <button
                                onClick={onAbort}
                                className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
                                title="Stop generating"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                </svg>
                            </button>
                        ) : (
                            <button
                                onClick={handleSend}
                                disabled={!input.trim()}
                                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${input.trim()
                                        ? "bg-white text-black hover:bg-white/90"
                                        : "bg-white/10 text-white/30 cursor-not-allowed"
                                    }`}
                                title="Send message"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M12 19V5M5 12l7-7 7 7" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>

                <p className="text-center text-white/20 text-xs mt-2">
                    Press Enter to send · Shift+Enter for new line
                </p>
            </div>
        </div>
    );
}