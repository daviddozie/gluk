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
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-white/40 hover:text-white/80 hover:bg-white/[0.08] transition-all"
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
      <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

function StreamingCursor() {
  return (
    <span className="inline-block w-[2px] h-[1em] bg-white/70 ml-0.5 align-middle animate-pulse" />
  );
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const { data: session } = useSession();

  const getInitials = () => {
    const name = session?.user?.name;
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
        isUser
          ? "bg-white text-black"
          : "bg-white/[0.06] border border-white/[0.1]"
      }`}>
        {isUser ? getInitials() : <GlukLogo size={18} />}
      </div>

      {/* Content */}
      <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        {isUser ? (
          <div className="bg-white/[0.08] border border-white/[0.08] rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white/90 leading-relaxed">
            {message.content}
          </div>
        ) : (
          <div className="text-sm text-white/85 leading-relaxed w-full">
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
                            className="bg-white/[0.08] text-white/90 px-1.5 py-0.5 rounded text-[0.85em] font-mono border border-white/[0.08]"
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }

                      return (
                        <div className="my-3 rounded-xl overflow-hidden border border-white/[0.08]">
                          <div className="flex items-center justify-between px-4 py-2 bg-white/[0.04] border-b border-white/[0.06]">
                            <span className="text-xs text-white/40 font-mono">
                              {match ? match[1] : "code"}
                            </span>
                            <CopyButton text={codeString} />
                          </div>
                          <SyntaxHighlighter
                            style={oneDark}
                            language={match ? match[1] : "text"}
                            PreTag="div"
                            customStyle={{
                              margin: 0,
                              padding: "1rem",
                              background: "rgba(255,255,255,0.02)",
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
                      return <h1 className="text-xl font-semibold mb-3 mt-4 text-white">{children}</h1>;
                    },
                    h2({ children }) {
                      return <h2 className="text-lg font-semibold mb-2 mt-4 text-white">{children}</h2>;
                    },
                    h3({ children }) {
                      return <h3 className="text-base font-semibold mb-2 mt-3 text-white">{children}</h3>;
                    },
                    ul({ children }) {
                      return <ul className="list-disc list-inside mb-3 space-y-1 text-white/80">{children}</ul>;
                    },
                    ol({ children }) {
                      return <ol className="list-decimal list-inside mb-3 space-y-1 text-white/80">{children}</ol>;
                    },
                    li({ children }) {
                      return <li className="leading-6">{children}</li>;
                    },
                    blockquote({ children }) {
                      return (
                        <blockquote className="border-l-2 border-white/20 pl-4 italic text-white/60 my-3">
                          {children}
                        </blockquote>
                      );
                    },
                    strong({ children }) {
                      return <strong className="font-semibold text-white">{children}</strong>;
                    },
                    a({ children, href }) {
                      return (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-white underline underline-offset-2 hover:text-white/70 transition-colors">
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
                      return <th className="border border-white/10 px-3 py-2 text-left font-semibold bg-white/[0.04]">{children}</th>;
                    },
                    td({ children }) {
                      return <td className="border border-white/10 px-3 py-2">{children}</td>;
                    },
                    hr() {
                      return <hr className="border-white/10 my-4" />;
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
            <CopyButton text={message.content} />
          </div>
        )}
      </div>
    </div>
  );
}