"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Message } from "@/types/chat";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import GlukLogo from "./svg";

interface MessageBubbleProps {
  message: Message;
  theme: "light" | "dark";
}

function CopyButton({ text, isDark }: { text: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer transition-all ${
        isDark
          ? "text-white/40 hover:text-white/80 hover:bg-white/8"
          : "text-black/40 hover:text-black/80 hover:bg-black/6"
      }`}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

function StreamingCursor() {
  return (
    <span className="inline-block w-[2px] h-[1em] bg-current opacity-70 ml-0.5 align-middle animate-pulse" />
  );
}

export default function MessageBubble({ message, theme }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const { data: session } = useSession();
  const isDark = theme === "dark";

  const getInitials = () => {
    const name = session?.user?.name;
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className={`flex gap-2 sm:gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className={`shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors duration-300 ${isUser
        ? "bg-black text-white dark:bg-white dark:text-black"
        : (isDark ? "bg-white/6 border border-white/10 text-white" : "bg-black/6 border border-black/10 text-black")
        }`}>
        {isUser ? getInitials() : <GlukLogo size={16} />}
      </div>

      {/* Content */}
      <div className={`flex flex-col gap-1 max-w-[88%] sm:max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        {isUser ? (
          <div className="flex flex-col gap-2 items-end">
            {/* File attachments */}
            {message.files && message.files.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-end">
                {message.files.map((f, i) => (
                  <div key={i} className={`w-16 h-16 rounded-xl overflow-hidden border flex items-center justify-center shrink-0 transition-colors duration-300 ${
                    isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5"
                  }`}>
                    {f.type.startsWith("image/") ? (
                      <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 px-1">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isDark ? "text-white/60" : "text-black/60"}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span className={`text-[9px] truncate w-full text-center ${isDark ? "text-white/40" : "text-black/50"}`}>
                          {f.name.length > 7 ? f.name.slice(0, 6) + "…" : f.name}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Message text */}
            {message.content && (
              <div className={`border rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed transition-colors duration-300 ${
                isDark ? "bg-white/8 border-white/8 text-white/90" : "bg-black/6 border-black/8 text-black/85"
              }`}>
                {message.content}
              </div>
            )}
          </div>
        ) : (
          <div className={`text-sm leading-relaxed w-full transition-colors duration-300 ${
            isDark ? "text-white/85" : "text-black/80"
          }`}>
            {message.isStreaming && !message.content ? (
              <TypingIndicator />
            ) : (
              <>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const codeString = String(children).replace(/\n$/, "");
                      const isInline = !match && !String(children).includes("\n");

                      if (isInline) {
                        return (
                          <code
                            className={`px-1.5 py-0.5 rounded text-[0.85em] font-mono border transition-colors duration-300 ${
                              isDark
                                ? "bg-white/8 text-white/90 border-white/8"
                                : "bg-black/6 text-black/80 border-black/10"
                            }`}
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }

                      return (
                        <div className={`my-3 rounded-xl overflow-hidden border transition-colors duration-300 ${
                          isDark ? "border-white/8" : "border-black/10"
                        }`}>
                          <div className={`flex items-center justify-between px-4 py-2 border-b transition-colors duration-300 ${
                            isDark ? "bg-white/4 border-white/6" : "bg-black/4 border-black/8"
                          }`}>
                            <span className={`text-xs font-mono ${isDark ? "text-white/40" : "text-black/50"}`}>
                              {match ? match[1] : "code"}
                            </span>
                            <CopyButton text={codeString} isDark={isDark} />
                          </div>
                          <SyntaxHighlighter
                            style={oneDark}
                            language={match ? match[1] : "text"}
                            PreTag="div"
                            customStyle={{
                              margin: 0,
                              padding: "1rem",
                              background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.03)",
                              fontSize: "0.8rem",
                              lineHeight: "1.6",
                            }}
                          >
                            {codeString}
                          </SyntaxHighlighter>
                        </div>
                      );
                    },
                    p({ children }) {
                      return <p className="mb-3 last:mb-0 leading-7">{children}</p>;
                    },
                    h1({ children }) {
                      return <h1 className={`text-xl font-semibold mb-3 mt-4 ${isDark ? "text-white" : "text-black"}`}>{children}</h1>;
                    },
                    h2({ children }) {
                      return <h2 className={`text-lg font-semibold mb-2 mt-4 ${isDark ? "text-white" : "text-black"}`}>{children}</h2>;
                    },
                    h3({ children }) {
                      return <h3 className={`text-base font-semibold mb-2 mt-3 ${isDark ? "text-white" : "text-black"}`}>{children}</h3>;
                    },
                    ul({ children }) {
                      return <ul className={`list-disc list-inside mb-3 space-y-1 ${isDark ? "text-white/80" : "text-black/75"}`}>{children}</ul>;
                    },
                    ol({ children }) {
                      return <ol className={`list-decimal list-inside mb-3 space-y-1 ${isDark ? "text-white/80" : "text-black/75"}`}>{children}</ol>;
                    },
                    li({ children }) {
                      return <li className="leading-6">{children}</li>;
                    },
                    blockquote({ children }) {
                      return (
                        <blockquote className={`border-l-2 pl-4 italic my-3 transition-colors duration-300 ${
                          isDark ? "border-white/20 text-white/60" : "border-black/20 text-black/60"
                        }`}>
                          {children}
                        </blockquote>
                      );
                    },
                    strong({ children }) {
                      return <strong className={`font-semibold ${isDark ? "text-white" : "text-black"}`}>{children}</strong>;
                    },
                    a({ children, href }) {
                      return (
                        <a href={href} target="_blank" rel="noopener noreferrer" className={`underline underline-offset-2 transition-colors ${
                          isDark ? "text-white hover:text-white/70" : "text-blue-600 hover:text-blue-500"
                        }`}>
                          {children}
                        </a>
                      );
                    },
                    table({ children }) {
                      return (
                        <div className="overflow-x-auto my-3">
                          <table className="w-full border-collapse text-sm">{children}</table>
                        </div>
                      );
                    },
                    th({ children }) {
                      return <th className={`border px-3 py-2 text-left font-semibold transition-colors duration-300 ${
                        isDark ? "border-white/10 bg-white/4" : "border-black/10 bg-black/4"
                      }`}>{children}</th>;
                    },
                    td({ children }) {
                      return <td className={`border px-3 py-2 transition-colors duration-300 ${
                        isDark ? "border-white/10" : "border-black/10"
                      }`}>{children}</td>;
                    },
                    hr() {
                      return <hr className={`my-4 transition-colors duration-300 ${isDark ? "border-white/10" : "border-black/10"}`} />;
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
                {message.isStreaming && <StreamingCursor />}
              </>
            )}
          </div>
        )}

        {/* Copy full message button for assistant */}
        {!isUser && !message.isStreaming && message.content && (
          <div className="flex items-center gap-1 mt-1">
            <CopyButton text={message.content} isDark={isDark} />
          </div>
        )}
      </div>
    </div>
  );
}