"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/sidebar";
import ChatWindow from "@/components/chat-window";
import ChatWindowSkeleton from "@/components/chat-window-skeleton";
import ChatInput, { AttachedFile } from "@/components/chat-input";
import { Message, Conversation } from "@/types/chat";
import { nanoid } from "nanoid";
import ChatSkeleton from "@/components/chat-skeleton";
import { Moon, Sun } from "lucide-react";
import { useChat } from "@/context/chat-context";
import { useSession } from "next-auth/react";
import LoginModal from "@/components/login-modal";

interface ChatAppProps {
  initialConversationId?: string;
}

export default function ChatApp({ initialConversationId }: ChatAppProps) {
  const {
    conversations,
    activeConversationId,
    activeConversation,
    isLoadingInitial,
    isLoadingThread,
    isStreaming,
    sidebarOpen,
    theme,
    setSidebarOpen,
    setIsStreaming,
    setConversations,
    setActiveConversationId,
    toggleTheme,
    selectConversation,
    createNewConversation,
    deleteConversationById,
    pinConversationById,
    debounceSave,
    ensureThreadLoaded,
  } = useChat();

  const abortControllerRef = useRef<AbortController | null>(null);
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginModalMode, setLoginModalMode] = useState<"prompt_limit" | "new_chat">("prompt_limit");

  const handleNewChat = () => {
    if (!isAuthenticated) {
      setLoginModalMode("new_chat");
      setShowLoginModal(true);
      return;
    }
    createNewConversation();
  };

  // Check guest usage on mount
  useEffect(() => {
    if (status === "unauthenticated") {
      const count = parseInt(localStorage.getItem("gluk_guest_prompt_count") || "0", 10);
      if (count >= 3) {
        setLoginModalMode("prompt_limit");
        setShowLoginModal(true);
      }
    } else if (status === "authenticated") {
      setShowLoginModal(false);
    }
  }, [status]);

  // When initialConversationId is provided, ensure it is active and loaded
  useEffect(() => {
    if (initialConversationId) {
      ensureThreadLoaded(initialConversationId);
    }
  }, [initialConversationId, ensureThreadLoaded]);

  const handleSend = async (content: string, files?: AttachedFile[]) => {
    const hasFiles = files && files.length > 0;
    if ((!content.trim() && !hasFiles) || isStreaming) return;

    // Check guest limit
    if (!isAuthenticated) {
      const count = parseInt(localStorage.getItem("gluk_guest_prompt_count") || "0", 10);
      if (count >= 3) {
        setLoginModalMode("prompt_limit");
        setShowLoginModal(true);
        return;
      }
      localStorage.setItem("gluk_guest_prompt_count", String(count + 1));
    }

    let convId = activeConversationId;
    if (!convId) {
      convId = nanoid();
      setActiveConversationId(convId);
    }

    // Smoothly update address bar to /c/[convId] if starting from '/' - ONLY for authenticated users
    if (isAuthenticated && typeof window !== "undefined" && !window.location.pathname.startsWith("/c/")) {
      window.history.replaceState(null, "", `/c/${convId}`);
    }

    const userMessage: Message = {
      id: nanoid(),
      role: "user",
      content,
      createdAt: new Date(),
      files: files?.map((f) => ({
        name: f.file.name,
        type: f.file.type,
        url: f.preview ?? "",
      })),
    };
    const assistantMessage: Message = { id: nanoid(), role: "assistant", content: "", createdAt: new Date(), isStreaming: true };

    const title = content.slice(0, 40) + (content.length > 40 ? "..." : "");

    setConversations((prev) => {
      const exists = prev.some((c) => c.id === convId);
      if (!exists) {
        const newConv: Conversation = {
          id: convId!,
          title,
          messages: [userMessage, assistantMessage],
          createdAt: new Date(),
        };
        return [newConv, ...prev];
      }
      return prev.map((c) =>
        c.id === convId
          ? {
              ...c,
              title: c.messages.length === 0 ? title : c.title,
              messages: [...c.messages, userMessage, assistantMessage],
            }
          : c
      );
    });

    setIsStreaming(true);
    abortControllerRef.current = new AbortController();

    try {
      // Upload files to Cloudinary first if any
      let uploadedFiles: { name: string; type: string; url: string }[] = [];
      if (files && files.length > 0) {
        const formData = new FormData();
        files.forEach((f) => formData.append("files", f.file));
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          uploadedFiles = uploadData.files;
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convId
                ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === userMessage.id
                      ? {
                        ...m,
                        files: uploadedFiles.map((f: { name: string; type: string; url: string }) => ({
                          name: f.name,
                          type: f.type,
                          url: f.url,
                        })),
                      }
                      : m
                  ),
                }
                : c
            )
          );
        }

        // Ingest documents into Pinecone (skip images)
        const docFiles = files.filter((f) => !f.file.type.startsWith("image/"));
        if (docFiles.length > 0) {
          const ingestForm = new FormData();
          docFiles.forEach((f) => ingestForm.append("files", f.file));
          ingestForm.append("conversationId", convId!);
          try {
            await fetch("/api/ingest", {
              method: "POST",
              body: ingestForm,
            });
          } catch (ingestErr) {
            console.error("Ingest failed:", ingestErr);
          }
        }
      }

      const chatMessage = content.trim() || "Please summarise and answer questions about the attached file(s).";
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatMessage, threadId: convId, files: uploadedFiles }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok || !response.body) throw new Error("Failed to fetch");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });

        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, messages: c.messages.map((m) => m.id === assistantMessage.id ? { ...m, content: accumulated } : m) }
              : c
          )
        );
      }

      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === convId
            ? { ...c, messages: c.messages.map((m) => m.id === assistantMessage.id ? { ...m, isStreaming: false } : m) }
            : c
        );
        const updatedConv = updated.find((c) => c.id === convId);
        if (updatedConv) debounceSave(updatedConv);
        return updated;
      });

    } catch (err: unknown) {
      const errorMsg = err instanceof Error && err.name === "AbortError"
        ? "\n\n*Generation stopped.*"
        : "Something went wrong. Please try again.";

      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === convId
            ? { ...c, messages: c.messages.map((m) => m.id === assistantMessage.id ? { ...m, content: m.content + errorMsg, isStreaming: false } : m) }
            : c
        );
        const updatedConv = updated.find((c) => c.id === convId);
        if (updatedConv) debounceSave(updatedConv);
        return updated;
      });
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
      if (!isAuthenticated) {
        const count = parseInt(localStorage.getItem("gluk_guest_prompt_count") || "0", 10);
        if (count >= 3) {
          setLoginModalMode("prompt_limit");
          setShowLoginModal(true);
        }
      }
    }
  };

  // Only show the full-page skeleton once when the entire application boots up for the first time
  if (isLoadingInitial) {
    return <ChatSkeleton />;
  }

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden relative transition-colors duration-300">

      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/60 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — stays permanently mounted and cached */}
      {sidebarOpen && (
        <div className={`
          z-30 w-65 shrink-0 h-full
          ${isMobile ? "fixed top-0 left-0 bottom-0" : "relative"}
        `}>
          <Sidebar
            conversations={conversations.filter((c) => c.messages.length > 0)}
            activeConversationId={activeConversationId}
            onSelect={selectConversation}
            onNew={handleNewChat}
            onDelete={deleteConversationById}
            onPin={pinConversationById}
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen((v) => !v)}
            theme={theme}
          />
        </div>
      )}

      {/* Main content — always full width on mobile */}
      <div className="flex flex-col flex-1 min-w-0 w-full">
        {/* Top Header — permanently solid, never flickers */}
        <div className="flex items-center h-14 px-4 border-b border-border/60 transition-colors duration-300">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="mr-3 p-2 rounded-lg hover:bg-black/6 dark:hover:bg-white/6 cursor-pointer transition-colors shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="text-sm font-medium text-foreground/70 truncate">
            {activeConversation?.title ?? "New Chat"}
          </span>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {!isAuthenticated && (
              <div className="flex items-center gap-1.5 mr-1">
                <a
                  href="/login"
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    theme === "dark"
                      ? "text-white/80 hover:text-white hover:bg-white/6"
                      : "text-black/80 hover:text-black hover:bg-black/6"
                  }`}
                >
                  Log in
                </a>
                <a
                  href="/login"
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-sm ${
                    theme === "dark"
                      ? "bg-white text-black hover:bg-white/90"
                      : "bg-black text-white hover:bg-black/90"
                  }`}
                >
                  Sign up for free
                </a>
              </div>
            )}

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-black/6 dark:hover:bg-white/6 cursor-pointer transition-all duration-300 shrink-0"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <Sun className="w-4.5 h-4.5" />
              ) : (
                <Moon className="w-4.5 h-4.5" />
              )}
            </button>
            <button
              onClick={handleNewChat}
              className="p-2 rounded-lg hover:bg-black/6 dark:hover:bg-white/6 cursor-pointer transition-colors shrink-0"
              title="New chat"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chat message area — uses scoped skeleton only if an uncached thread is being fetched */}
        {isLoadingThread ? (
          <ChatWindowSkeleton theme={theme} />
        ) : (
          <ChatWindow
            messages={activeConversation?.messages ?? []}
            isLoading={isStreaming}
            theme={theme}
          />
        )}

        {/* Chat input — always interactive */}
        <ChatInput
          onSend={handleSend}
          onAbort={() => abortControllerRef.current?.abort()}
          isStreaming={isStreaming}
          theme={theme}
        />
      </div>

      {/* Login modal (either ChatGPT-style New Chat prompt or 3-prompt trial limit) */}
      <LoginModal
        isOpen={showLoginModal}
        mode={loginModalMode}
        onClose={() => setShowLoginModal(false)}
        theme={theme}
      />
    </div>
  );
}
