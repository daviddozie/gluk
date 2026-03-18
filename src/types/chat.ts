export interface MessageFile {
    name: string;
    type: string;
    url: string;
}

export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: Date;
    isStreaming?: boolean;
    files?: MessageFile[];
}

export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    createdAt: Date;
}