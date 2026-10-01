"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { Conversation } from "@/types/chat";
import { ResourceReference } from "@/types/resource";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { isCancelledError, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import {
    deleteConversation as deleteConversationRequest,
    fetchConversation,
    fetchConversations,
    saveConversation as saveConversationRequest,
    setConversationPinned,
} from "@/lib/queries/conversations";

interface ChatContextType {
    conversations: Conversation[];
    activeConversationId: string | null;
    activeConversation: Conversation | null;
    isLoadingInitial: boolean;
    isLoadingThread: boolean;
    isStreaming: boolean;
    sidebarOpen: boolean;
    theme: "light" | "dark";
    documentReference: ResourceReference | null;
    setDocumentReference: React.Dispatch<React.SetStateAction<ResourceReference | null>>;
    setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
    setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
    setActiveConversationId: (id: string | null) => void;
    toggleTheme: () => void;
    selectConversation: (id: string) => void;
    createNewConversation: (reference?: ResourceReference) => void;
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
    const userEmail = session?.user?.email ?? null;
    const queryClient = useQueryClient();

    const conversationsKey = queryKeys.conversations.list(userEmail ?? "guest");
    const conversationsQuery = useQuery({
        queryKey: conversationsKey,
        queryFn: ({ signal }) => fetchConversations(signal),
        enabled: isAuthenticated && Boolean(userEmail),
        refetchOnWindowFocus: false,
    });
    const [guestConversations, setGuestConversations] = useState<Conversation[]>([]);
    const conversations = React.useMemo(
        () => isAuthenticated ? conversationsQuery.data ?? [] : guestConversations,
        [conversationsQuery.data, guestConversations, isAuthenticated]
    );
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const isLoadingInitial = status === "loading" || (isAuthenticated && conversationsQuery.isPending);
    const [isLoadingThread, setIsLoadingThread] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [sidebarPreferenceLoaded, setSidebarPreferenceLoaded] = useState(false);
    const [theme, setTheme] = useState<"light" | "dark">("dark");
    const [documentReference, setDocumentReference] = useState<ResourceReference | null>(null);

    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const threadLoadsInFlightRef = useRef(new Set<string>());
    const deletingConversationIdsRef = useRef(new Set<string>());

    const saveMutation = useMutation({
        mutationFn: saveConversationRequest,
        onSuccess: (_, conversation) => {
            if (!userEmail) return;
            const existing = queryClient.getQueryData<Conversation[]>(conversationsKey)?.find((item) => item.id === conversation.id);
            const saved = existing ? { ...conversation, pinned: existing.pinned } : conversation;
            queryClient.setQueryData<Conversation[]>(conversationsKey, (current) => {
                const list = current ?? [];
                return existing
                    ? list.map((item) => item.id === conversation.id ? saved : item)
                    : [saved, ...list];
            });
            queryClient.setQueryData(queryKeys.conversations.detail(userEmail, conversation.id), saved);
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteConversationRequest,
        onMutate: async (id) => {
            deletingConversationIdsRef.current.add(id);
            await queryClient.cancelQueries({ queryKey: conversationsKey });
            const previous = queryClient.getQueryData<Conversation[]>(conversationsKey);
            queryClient.setQueryData<Conversation[]>(conversationsKey, (current) => (current ?? []).filter((item) => item.id !== id));
            return { previous, id };
        },
        onError: (_error, _id, context) => {
            if (context?.previous) queryClient.setQueryData(conversationsKey, context.previous);
            deletingConversationIdsRef.current.delete(_id);
        },
        onSuccess: async (_data, id) => {
            if (userEmail) {
                const detailKey = queryKeys.conversations.detail(userEmail, id);
                await queryClient.cancelQueries({ queryKey: detailKey, exact: true });
                queryClient.removeQueries({ queryKey: detailKey, exact: true });
            }
            deletingConversationIdsRef.current.delete(id);
        },
    });

    const pinMutation = useMutation({
        mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => setConversationPinned(id, pinned),
        onMutate: async ({ id, pinned }) => {
            await queryClient.cancelQueries({ queryKey: conversationsKey });
            const previous = queryClient.getQueryData<Conversation[]>(conversationsKey);
            queryClient.setQueryData<Conversation[]>(conversationsKey, (current) =>
                (current ?? [])
                    .map((item) => item.id === id ? { ...item, pinned } : item)
                    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            );
            return { previous };
        },
        onError: (_error, _variables, context) => {
            if (context?.previous) queryClient.setQueryData(conversationsKey, context.previous);
        },
    });
    const saveConversation = saveMutation.mutate;
    const deleteConversationAsync = deleteMutation.mutateAsync;
    const pinConversationAsync = pinMutation.mutateAsync;

    // Restore the user's sidebar preference, with a sensible responsive default on first visit.
    useEffect(() => {
        const storedPreference = localStorage.getItem("gluk_sidebar_open");
        setSidebarOpen(storedPreference === null ? window.innerWidth >= 768 : storedPreference === "true");
        setSidebarPreferenceLoaded(true);
    }, []);

    useEffect(() => {
        if (sidebarPreferenceLoaded) localStorage.setItem("gluk_sidebar_open", String(sidebarOpen));
    }, [sidebarOpen, sidebarPreferenceLoaded]);

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

    const setConversations = useCallback<React.Dispatch<React.SetStateAction<Conversation[]>>>((update) => {
        if (!isAuthenticated || !userEmail) {
            setGuestConversations(update);
            return;
        }
        queryClient.setQueryData<Conversation[]>(conversationsKey, (current) =>
            typeof update === "function" ? update(current ?? []) : update
        );
    }, [conversationsKey, isAuthenticated, queryClient, userEmail]);

    // Debounced persistence is a mutation; the Query cache remains the client-side source of truth.
    const debounceSave = useCallback((conv: Conversation) => {
        if (!isAuthenticated) return;
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            saveConversation(conv, {
                onError: (err) => console.error("Failed to save conversation:", err),
            });
        }, 1000);
    }, [isAuthenticated, saveConversation]);

    useEffect(() => () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    }, []);

    useEffect(() => {
        if (status !== "unauthenticated") return;
        setGuestConversations([]);
        queryClient.removeQueries({ queryKey: queryKeys.conversations.all });
        queryClient.removeQueries({ queryKey: queryKeys.resources.all });
    }, [queryClient, status]);

    // Ensure a thread is loaded in the cache
    const ensureThreadLoaded = useCallback(async (id: string) => {
        if (deletingConversationIdsRef.current.has(id)) return;
        if (threadLoadsInFlightRef.current.has(id)) return;
        const existing = conversations.find((c) => c.id === id);
        if (existing) {
            const reference = existing.messages.flatMap((message) => message.files ?? []).find((file) => file.isReference);
            const nextReference = reference ? { name: reference.name, url: reference.url, type: reference.type, conversationId: reference.conversationId ?? null } : null;
            setDocumentReference((current) => current?.name === nextReference?.name && current?.url === nextReference?.url && current?.type === nextReference?.type && current?.conversationId === nextReference?.conversationId ? current : nextReference);
            setActiveConversationId((current) => current === id ? current : id);
            setIsLoadingThread((current) => current ? false : current);
            return;
        }

        threadLoadsInFlightRef.current.add(id);
        setIsLoadingThread(true);
        try {
            if (!userEmail) throw new Error("Conversation requires an authenticated user");
            const conversation = await queryClient.fetchQuery({
                queryKey: queryKeys.conversations.detail(userEmail, id),
                queryFn: ({ signal }) => fetchConversation(id, signal),
            });
            const reference = conversation.messages.flatMap((message) => message.files ?? []).find((file) => file.isReference);
            const nextReference = reference ? { name: reference.name, url: reference.url, type: reference.type, conversationId: reference.conversationId ?? null } : null;
            setDocumentReference((current) => current?.name === nextReference?.name && current?.url === nextReference?.url && current?.type === nextReference?.type && current?.conversationId === nextReference?.conversationId ? current : nextReference);
            setConversations((prev) => prev.some((item) => item.id === id) ? prev : [conversation, ...prev]);
            setActiveConversationId((current) => current === id ? current : id);
        } catch (err) {
            if (isCancelledError(err) || deletingConversationIdsRef.current.has(id)) return;
            if (err instanceof Error && err.message === "Conversation not found") {
                router.replace("/");
                return;
            }
            console.error(`Failed to load thread ${id}:`, err);
            router.replace("/");
        } finally {
            threadLoadsInFlightRef.current.delete(id);
            setIsLoadingThread(false);
        }
    }, [conversations, queryClient, router, setConversations, userEmail]);

    const selectConversation = useCallback((id: string) => {
        const conversation = conversations.find((item) => item.id === id);
        const reference = conversation?.messages.flatMap((message) => message.files ?? []).find((file) => file.isReference);
        setDocumentReference(reference ? { name: reference.name, url: reference.url, type: reference.type, conversationId: reference.conversationId ?? null } : null);
        setActiveConversationId(id);
        router.push(`/c/${id}`, { scroll: false });
        if (window.innerWidth < 768) setSidebarOpen(false);
    }, [conversations, router]);

    const createNewConversation = useCallback((reference?: ResourceReference) => {
        setDocumentReference(reference ?? null);
        setActiveConversationId(null);
        setConversations((prev) => prev.filter((c) => c.messages.length > 0));
        router.push("/", { scroll: false });
        if (window.innerWidth < 768) setSidebarOpen(false);
    }, [router, setConversations]);

    const deleteConversationById = useCallback(async (id: string) => {
        if (!isAuthenticated) return;
        try {
            await deleteConversationAsync(id);
        } catch (err) {
            console.error("Failed to delete:", err);
            return;
        }
        if (activeConversationId === id) {
            createNewConversation();
        }
    }, [activeConversationId, createNewConversation, deleteConversationAsync, isAuthenticated]);

    const pinConversationById = useCallback(async (id: string, pinned: boolean) => {
        if (!isAuthenticated) return;
        try {
            await pinConversationAsync({ id, pinned });
        } catch (err) {
            console.error("Failed to pin:", err);
        }
    }, [isAuthenticated, pinConversationAsync]);

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
            if (idFromPath && deletingConversationIdsRef.current.has(idFromPath)) return;
            if (idFromPath && idFromPath !== activeConversationId) {
                const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
                // A newly created empty chat can become active just before its route updates.
                // Don't let the previous URL restore its old conversation during that transition.
                if (activeConversation && activeConversation.messages.length === 0) return;
                ensureThreadLoaded(idFromPath);
            }
        } else if (pathname === "/") {
            // When at '/', stay on a new chat without an ID until a query is sent.
            // If the browser URL was just updated to /c/[id] (e.g. user just sent a message), do not reset.
            if (typeof window !== "undefined" && window.location.pathname.startsWith("/c/")) {
                return;
            }
            if (activeConversationId !== null) {
                setActiveConversationId(null);
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
        documentReference,
        setDocumentReference,
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
