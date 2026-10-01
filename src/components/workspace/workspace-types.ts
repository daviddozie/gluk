export type Workspace = {
  id: string;
  name: string;
  description: string | null;
  role: string;
  members: { email: string; name: string; role: string; joinedAt: string; avatarUrl: string | null }[];
};

export type ReplyReference = { id: string; userName: string; content: string };
export type MessageAttachment = { id: string; name: string; type: string; size: number; url: string };
export type MessageReaction = { emoji: string; count: number; reacted: boolean };
export type Message = {
  id: string;
  userEmail: string;
  userName: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  clientMessageId?: string | null;
  deliveryStatus?: "sending" | "sent" | "failed";
  isStreaming?: boolean;
  replyToId?: string | null;
  replyTo?: ReplyReference | null;
  attachments?: MessageAttachment[];
  reactions?: MessageReaction[];
  pendingFiles?: File[];
};
export type WorkspaceMember = { email: string; name: string; online: boolean };
export type MentionOption = {
  kind: "assistant" | "member" | "resource" | "invite";
  label: string;
  detail: string;
  value?: string;
};
export type WorkspaceTheme = "light" | "dark";
export type WorkspaceTab = "chat" | "projects" | "resources";
