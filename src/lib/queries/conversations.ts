import { Conversation } from "@/types/chat";

async function readJson<T>(response: Response, fallback: string): Promise<T> {
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? fallback);
    }
    return response.json() as Promise<T>;
}

export async function fetchConversations(signal?: AbortSignal) {
    const response = await fetch("/api/conversations", { signal });
    const data = await readJson<{ conversations: Conversation[] }>(response, "Could not load conversations");
    return data.conversations ?? [];
}

export async function fetchConversation(id: string, signal?: AbortSignal) {
    const response = await fetch(`/api/conversations/${encodeURIComponent(id)}`, { signal });
    const data = await readJson<{ conversation: Conversation }>(response, "Could not load conversation");
    return data.conversation;
}

export async function saveConversation(conversation: Conversation) {
    const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            id: conversation.id,
            title: conversation.title,
            messages: conversation.messages,
        }),
    });
    await readJson<{ success: boolean }>(response, "Could not save conversation");
}

export async function deleteConversation(id: string) {
    const response = await fetch(`/api/conversations/${encodeURIComponent(id)}`, { method: "DELETE" });
    await readJson<{ success: boolean }>(response, "Could not delete conversation");
}

export async function setConversationPinned(id: string, pinned: boolean) {
    const response = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned }),
    });
    await readJson<{ success: boolean }>(response, "Could not update conversation");
}
