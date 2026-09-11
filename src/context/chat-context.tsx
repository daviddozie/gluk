"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { Conversation } from "@/types/chat";
import { nanoid } from "nanoid";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

interface ChatContextType {
    conversations: Conversation[];
    activeConversationId: string | null;
    activeConversation: Conversation | null;
    isLoadingInitial: boolean;
    isLoadingThread: boolean;
    isStreaming: boolean;
    sidebarOpen: boolean;
    theme: "light" | "dark";
    setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
    setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
    setActiveConversationId: (id: string | null) => void;
    toggleTheme: () => void;
    selectConversation: (id: string) => void;
    createNewConversation: () => string;
    deleteConversationById: (id: string) => Promise<void>;
    pinConversationById: (id: string, pinned: boolean) => Promise<void>;
    debounceSave: (conv: Conversation) => void;
    ensureThreadLoaded: (id: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { data: session, status } = useSession();
    const isAuthenticated = status === "authenticated";

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [isLoadingInitial, setIsLoadingInitial] = useState(true);
    const [isLoadingThread, setIsLoadingThread] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [theme, setTheme] = useState<"light" | "dark">("dark");

    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fetchedInitialRef = useRef(false);

    // Responsive sidebar defaults
    useEffect(() => {
        if (window.innerWidth >= 768) setSidebarOpen(true);
    }, []);

    // Theme initialization
    useEffect(() => {
        const root = document.documentElement;
        const storedTheme = localStorage.getItem("theme");
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const initialTheme = storedTheme === "light" || storedTheme === "dark"
            ? storedTheme
            : (systemPrefersDark ? "dark" : "light");

        setTheme(initialTheme);
        root.classList.add("theme-transition");
        root.classList.toggle("dark", initialTheme === "dark");
        root.style.colorScheme = initialTheme;
    }, []);

    const toggleTheme = useCallback(() => {
        const root = document.documentElement;
        setTheme((curr) => {
            const nextTheme = curr === "dark" ? "light" : "dark";
            localStorage.setItem("theme", nextTheme);
            root.classList.toggle("dark", nextTheme === "dark");
            root.style.colorScheme = nextTheme;
            return nextTheme;
        });
    }, []);

    // Debounced database saving - strictly disabled for guests (no thread memory)
    const debounceSave = useCallback((conv: Conversation) => {
        if (!isAuthenticated) return;
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
    }, [isAuthenticated]);

    // Fetch conversations list once on application mount for authenticated users
    useEffect(() => {
        if (status === "loading") return;
        if (!isAuthenticated) {
            setConversations([]);
            setIsLoadingInitial(false);
            return;
        }
        if (fetchedInitialRef.current) return;
        fetchedInitialRef.current = true;

        const load = async () => {
            try {
                const res = await fetch("/api/conversations");
                if (res.ok) {
                    const data = await res.json();
                    const loadedConvs: Conversation[] = data.conversations ?? [];
                    setConversations(loadedConvs);
                }
            } catch (err) {
                console.error("Failed to load initial conversations:", err);
            } finally {
                setIsLoadingInitial(false);
            }
        };
        load();
    }, [status, isAuthenticated]);

    // Ensure a thread is loaded in the cache
    const ensureThreadLoaded = useCallback(async (id: string) => {
        // Cache hit: already loaded in memory
        const existing = conversations.find((c) => c.id === id);
        if (existing) {
            setActiveConversationId(id);
            setIsLoadingThread(false);
            return;
        }

        // Cache miss: fetch single thread from API
        setIsLoadingThread(true);
        try {
            const res = await fetch(`/api/conversations/${id}`);
            if (res.ok) {
                const data = await res.json();
                if (data.conversation) {
                    setConversations((prev) => {
                        const exists = prev.some((c) => c.id === id);
                        return exists ? prev : [data.conversation, ...prev];
                    });
                    setActiveConversationId(id);
                }
            }
        } catch (err) {
            console.error(`Failed to load thread ${id}:`, err);
        } finally {
            setIsLoadingThread(false);
        }
    }, [conversations]);

    const selectConversation = useCallback((id: string) => {
        setActiveConversationId(id);
        router.push(`/c/${id}`, { scroll: false });
        if (window.innerWidth < 768) setSidebarOpen(false);
    }, [router]);

    const createNewConversation = useCallback(() => {
        const id = nanoid();
        const newConv: Conversation = { id, title: "New Chat", messages: [], createdAt: new Date() };
        if (!isAuthenticated) {
            setConversations([newConv]);
            setActiveConversationId(id);
            router.push("/", { scroll: false });
            if (window.innerWidth < 768) setSidebarOpen(false);
            return id;
        }
        setConversations((prev) => [newConv, ...prev.filter((c) => c.messages.length > 0)]);
        setActiveConversationId(id);
        router.push("/", { scroll: false });
        if (window.innerWidth < 768) setSidebarOpen(false);
        return id;
    }, [isAuthenticated, router]);

    const deleteConversationById = useCallback(async (id: string) => {
        if (!isAuthenticated) return;
        try {
            await fetch(`/api/conversations/${id}`, { method: "DELETE" });
        } catch (err) {
            console.error("Failed to delete:", err);
        }
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) {
            createNewConversation();
        }
    }, [activeConversationId, createNewConversation, isAuthenticated]);

    const pinConversationById = useCallback(async (id: string, pinned: boolean) => {
        if (!isAuthenticated) return;
        setConversations((prev) =>
            prev
                .map((c) => (c.id === id ? { ...c, pinned } : c))
                .sort((a, b) => {
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                })
        );
        try {
            await fetch(`/api/conversations/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pinned }),
            });
        } catch (err) {
            console.error("Failed to pin:", err);
        }
    }, [isAuthenticated]);

    // Sync route with active conversation ID on browser back/forward
    useEffect(() => {
        if (pathname.startsWith("/c/")) {
            if (status === "loading") return;
            if (!isAuthenticated) {
                // Guests do not have thread memory; redirect to '/'
                router.replace("/");
                return;
            }
            const idFromPath = pathname.replace("/c/", "");
            if (idFromPath && idFromPath !== activeConversationId) {
                ensureThreadLoaded(idFromPath);
            }
        } else if (pathname === "/") {
            // If activeConversationId is already valid and exists in conversations, keep it!
            if (activeConversationId && conversations.some((c) => c.id === activeConversationId)) {
                return;
            }
            const emptyConv = conversations.find((c) => c.messages.length === 0);
            if (emptyConv) {
                setActiveConversationId(emptyConv.id);
            } else {
                const id = nanoid();
                const newConv: Conversation = { id, title: "New Chat", messages: [], createdAt: new Date() };
                setConversations((prev) => [newConv, ...prev]);
                setActiveConversationId(id);
            }
        }
    }, [pathname, activeConversationId, conversations, ensureThreadLoaded, status, isAuthenticated, router]);

    const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;

    const value = {
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
    };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error("useChat must be used within a ChatProvider");
    }
    return context;
}
