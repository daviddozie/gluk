"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Sidebar from "@/components/sidebar";
import ChatWindow from "@/components/chat-window";
import ChatInput, { AttachedFile } from "@/components/chat-input";
import { Message, Conversation } from "@/types/chat";
import { nanoid } from "nanoid";
import ChatSkeleton from "@/components/chat-skeleton";

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Open sidebar by default on desktop
  useEffect(() => {
    if (window.innerWidth >= 768) setSidebarOpen(true);
  }, []);

  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;

  const debounceSave = useCallback((conv: Conversation) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: conv.id, title: conv.title, messages: conv.messages }),
        });
      } catch (err) {
        console.error("Failed to save:", err);
      }
    }, 1000);
  }, []);

  const createNewConversation = useCallback(() => {
    const id = nanoid();
    const newConv: Conversation = { id, title: "New Chat", messages: [], createdAt: new Date() };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConversationId(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
    return id;
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/conversations");
        if (res.ok) {
          const data = await res.json();
          if (data.conversations?.length > 0) {
            setConversations(data.conversations);
            // Always start with a fresh new chat
            createNewConversation();
          } else {
            createNewConversation();
          }
        }
      } catch {
        createNewConversation();
      } finally {
        setIsLoadingConversations(false);
      }
    };
    load();
  }, []);

  const handleSend = async (content: string, files?: AttachedFile[]) => {
    const hasFiles = files && files.length > 0;
    if ((!content.trim() && !hasFiles) || isStreaming) return;

    let convId = activeConversationId;
    if (!convId) convId = createNewConversation();

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

    const conv = conversations.find((c) => c.id === convId);
    if (conv && conv.messages.length === 0) {
      const title = content.slice(0, 40) + (content.length > 40 ? "..." : "");
      setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, title } : c)));
    }

    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId ? { ...c, messages: [...c.messages, userMessage, assistantMessage] } : c
      )
    );

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
          // Update user message with real Cloudinary URLs
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

        // Ingest documents into Pinecone (skip images).
        // MUST await before sending /api/chat so the RAG search finds the chunks.
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

      const chatMessage = content.trim() || "Please summarise and answer questions about the attached file(s)."
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
    }
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete:", err);
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConversationId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length > 0) handleSelectConversation(remaining[0].id);
      else createNewConversation();
    }
  };

  if (isLoadingConversations) {
    return <ChatSkeleton />;
  }

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden relative">

      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/60 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {sidebarOpen && (
        <div className={`
          z-30 w-[260px] flex-shrink-0 h-full
          ${isMobile ? "fixed top-0 left-0 bottom-0" : "relative"}
        `}>
          <Sidebar
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelect={handleSelectConversation}
            onNew={createNewConversation}
            onDelete={handleDeleteConversation}
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen((v) => !v)}
          />
        </div>
      )}

      {/* Main content — always full width on mobile */}
      <div className="flex flex-col flex-1 min-w-0 w-full">
        <div className="flex items-center h-14 px-4 border-b border-white/[0.06]">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="mr-3 p-2 rounded-lg hover:bg-white/[0.06] transition-colors flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="text-sm font-medium text-white/60 truncate">
            {activeConversation?.title ?? "New Chat"}
          </span>
          <button
            onClick={createNewConversation}
            className="ml-auto p-2 rounded-lg hover:bg-white/[0.06] transition-colors flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        <ChatWindow messages={activeConversation?.messages ?? []} isLoading={isStreaming} />
        <ChatInput onSend={handleSend} onAbort={() => abortControllerRef.current?.abort()} isStreaming={isStreaming} />
      </div>
    </div>
  );
}