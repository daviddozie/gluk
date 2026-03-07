export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: Date;
    isStreaming?: boolean;
}

export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    createdAt: Date;
}