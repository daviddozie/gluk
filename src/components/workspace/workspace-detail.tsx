"use client";
import { FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { AttachProjectResourceDialog, WorkspaceProjectsPanel, WorkspaceResourcesPanel, type WorkspacePersonalResource, type WorkspaceProject, type WorkspaceResource } from "@/components/workspace/workspace-panels";
import { WorkspaceDialogs } from "@/components/workspace/workspace-dialogs";
import { WorkspaceChatPanel } from "@/components/workspace/workspace-chat-panel";
import DocumentViewer, { type DocumentViewerFile } from "@/components/document-viewer";
import { api, mergeMessages } from "@/components/workspace/workspace-utils";
import { useWorkspaceRealtime } from "@/components/workspace/use-workspace-realtime";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  ArrowLeft,
  UsersRound,
  MessageSquareText,
  FolderKanban,
  FolderOpen,
  LoaderCircle,
  Copy,
  Check,
  Bot,
} from "lucide-react";

import type { MentionOption, Message, MessageReaction, ReplyReference, Workspace, WorkspaceMember, WorkspaceTab, WorkspaceTheme } from "@/components/workspace/workspace-types";

function readWorkspaceTab(): WorkspaceTab {
  if (typeof window === "undefined") return "chat";
  const value = new URLSearchParams(window.location.search).get("tab");
  return value === "projects" || value === "resources" ? value : "chat";
}

function MemberAvatar({
  name,
  src,
  assistant = false,
}: {
  name: string;
  src?: string | null;
  assistant?: boolean;
}) {
  return (
    <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-border/70 bg-muted text-[11px] font-semibold text-muted-foreground">
      {assistant ? (
        <Bot className="h-4 w-4" />
      ) : src ? (
        <Image src={src} alt={`${name}'s profile`} fill sizes="32px" unoptimized className="object-cover" />
      ) : (
        name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?"
      )}
    </span>
  );
}

export default function WorkspaceDetail(props: {
  workspaceId: string;
  embedded?: boolean;
  theme?: WorkspaceTheme;
  onPreviewFile?: (file: DocumentViewerFile) => void;
}) {
  return <WorkspaceDetailContent key={props.workspaceId} {...props} theme={props.theme ?? "dark"} />;
}

function WorkspaceDetailContent({
  workspaceId,
  embedded = false,
  theme,
  onPreviewFile,
}: {
  workspaceId: string;
  embedded?: boolean;
  theme: WorkspaceTheme;
  onPreviewFile?: (file: DocumentViewerFile) => void;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<WorkspaceTab>(readWorkspaceTab);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resourcePickerOpen, setResourcePickerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyReference | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [mentionContext, setMentionContext] = useState<{ start: number; end: number; query: string } | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [glukResponding, setGlukResponding] = useState(false);
  const messageRef = useRef(message);
  const [liveMessages, setLiveMessages] = useState<Message[]>([]);
  const messageListRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerSelectionRef = useRef({ start: 0, end: 0 });
  const glukPendingRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [onlineMembers, setOnlineMembers] = useState<WorkspaceMember[]>([]);
  const [typingMembers, setTypingMembers] = useState<Record<string, { name: string; avatarUrl?: string | null }>>({});
  const [socketReady, setSocketReady] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceProject, setResourceProject] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [previewFile, setPreviewFile] = useState<DocumentViewerFile | null>(null);
  useEffect(() => {
    const syncTabFromUrl = () => setTab(readWorkspaceTab());
    const url = new URL(window.location.href);
    if (!url.searchParams.has("tab")) {
      url.searchParams.set("tab", "chat");
      window.history.replaceState(null, "", url);
    }
    window.addEventListener("popstate", syncTabFromUrl);
    return () => window.removeEventListener("popstate", syncTabFromUrl);
  }, []);
  const ephemeralRef = useRef<RealtimeChannel | null>(null);
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastTypingSentRef = useRef(0);
  const typingClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const base = `/api/workspaces/${workspaceId}`;
  const workspaceQ = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => api<Workspace>(base),
    enabled: status === "authenticated",
  });
  const projectsQ = useQuery({
    queryKey: ["workspace-projects", workspaceId],
    queryFn: () => api<WorkspaceProject[]>(`${base}/projects`),
    enabled: status === "authenticated",
  });
  const resourcesQ = useQuery({
    queryKey: ["workspace-resources", workspaceId],
    queryFn: () => api<WorkspaceResource[]>(`${base}/resources`),
    enabled: status === "authenticated",
  });
  const myResourcesQ = useQuery({
    queryKey: ["resources", session?.user?.email],
    queryFn: async () => {
      const d = await api<{ resources: WorkspacePersonalResource[] }>("/api/resources");
      return d.resources;
    },
    enabled: status === "authenticated" && (tab === "resources" || tab === "projects"),
  });
  const messagesQ = useQuery({
    queryKey: ["workspace-messages", workspaceId],
    queryFn: () => api<Message[]>(`${base}/messages`),
    enabled: status === "authenticated" && tab === "chat",
    refetchInterval: socketReady ? false : 10_000,
  });
  const workspaceMessages = useMemo(
    () => mergeMessages(messagesQ.data ?? [], liveMessages),
    [messagesQ.data, liveMessages],
  );
  const typingCount = Object.keys(typingMembers).length;
  useEffect(() => {
    const list = messageListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [workspaceMessages.length, glukResponding, typingCount]);
  useEffect(() => () => {
    for (const timeout of glukPendingRef.current.values()) clearTimeout(timeout);
    glukPendingRef.current.clear();
  }, []);
  useWorkspaceRealtime({
    status,
    tab,
    workspaceId,
    userEmail: session?.user?.email,
    queryClient: qc,
    setWorkspaceMessages: setLiveMessages,
    setGlukResponding,
    setOnlineMembers,
    setTypingMembers,
    setSocketReady,
    setError,
    ephemeralRef,
    glukPendingRef,
    typingTimersRef,
    typingClearTimerRef,
  });
  const createProject = useMutation({
    mutationFn: () =>
      api(`${base}/projects`, {
        method: "POST",
        body: JSON.stringify({
          name: projectName,
          description: projectDescription,
        }),
      }),
    onSuccess: async () => {
      setProjectName("");
      setProjectDescription("");
      setNotice("Project created");
      await qc.invalidateQueries({
        queryKey: ["workspace-projects", workspaceId],
      });
    },
    onError: (e: Error) => setError(e.message),
  });
  const invite = useMutation({
    mutationFn: () =>
      api<{
        invitations: { email: string; inviteUrl: string; sent: boolean }[];
      }>(`${base}/invitations`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail }),
      }),
    onSuccess: (d) => {
      setInviteEmail("");
      setInviteOpen(false);
      setNotice(
        d.invitations
          .map((i) =>
            i.sent
              ? `Invitation emailed to ${i.email}`
              : `Invite link for ${i.email}: ${i.inviteUrl}`,
          )
          .join("\n"),
      );
      setError("");
    },
    onError: (e: Error) => setError(e.message),
  });
  const share = useMutation({
    mutationFn: () =>
      api(`${base}/resources`, {
        method: "POST",
        body: JSON.stringify({
          url: resourceUrl,
          projectId: resourceProject || null,
        }),
      }),
    onSuccess: async () => {
      setResourceUrl("");
      setNotice("Resource shared with this workspace");
      await qc.invalidateQueries({
        queryKey: ["workspace-resources", workspaceId],
      });
    },
    onError: (e: Error) => setError(e.message),
  });
  const attachWorkspaceResource = useMutation({
    mutationFn: ({ resourceId, projectId }: { resourceId: string; projectId: string | null }) =>
      api(`${base}/resources`, {
        method: "PATCH",
        body: JSON.stringify({ resourceId, projectId }),
      }),
    onSuccess: async (_data, variables) => {
      setNotice(variables.projectId ? "Resource attached to project" : "Resource removed from project");
      await qc.invalidateQueries({
        queryKey: ["workspace-resources", workspaceId],
      });
    },
    onError: (e: Error) => setError(e.message),
  });
  const sharePersonalResource = useMutation({
    mutationFn: ({ url, projectId }: { url: string; projectId?: string | null }) =>
      api(`${base}/resources`, {
        method: "POST",
        body: JSON.stringify({ url, projectId: projectId || null }),
      }),
    onSuccess: async (_data, variables) => {
      setNotice(variables.projectId ? "Resource attached to project" : "Resource shared with workspace");
      await qc.invalidateQueries({
        queryKey: ["workspace-resources", workspaceId],
      });
    },
    onError: (e: Error) => setError(e.message),
  });
  const deleteWorkspaceResource = useMutation({
    mutationFn: (resourceId: string) =>
      api(`${base}/resources`, {
        method: "DELETE",
        body: JSON.stringify({ resourceId }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ["workspace-resources", workspaceId],
      });
    },
    onError: (e: Error) => setError(e.message),
  });
  const w = workspaceQ.data;
  const mentionOptions: MentionOption[] = [
    { kind: "assistant", label: "Gluk", detail: "Ask Gluk in this workspace", value: "@Gluk" },
    ...(w?.members ?? []).map((member) => ({ kind: "member" as const, label: member.name, detail: member.email, value: `@${member.name}` })),
    ...(resourcesQ.data ?? []).map((resource) => ({ kind: "resource" as const, label: resource.name, detail: `Workspace resource · ${resource.type}`, value: `@${resource.name}` })),
    ...(w?.role === "owner" ? [{ kind: "invite" as const, label: "Invite a member…", detail: "Invite someone new to this workspace" }] : []),
  ];
  const filteredMentionOptions = mentionContext
    ? mentionOptions.filter((option) => option.label.toLowerCase().includes(mentionContext.query.toLowerCase()))
    : [];
  function selectMention(option: MentionOption) {
    if (!mentionContext) return;
    const before = message.slice(0, mentionContext.start);
    const after = message.slice(mentionContext.end);
    if (option.kind === "invite") {
      const next = `${before}${after}`;
      messageRef.current = next;
      setMessage(next);
      setMentionContext(null);
      setInviteOpen(true);
      return;
    }
    const insertion = `${option.value ?? `@${option.label}`} `;
    const next = `${before}${insertion}${after}`;
    const caret = before.length + insertion.length;
    messageRef.current = next;
    setMessage(next);
    setMentionContext(null);
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(caret, caret);
    });
  }
  function insertComposerText(text: string) {
    const input = composerRef.current;
    const start = input?.selectionStart ?? composerSelectionRef.current.start;
    const end = input?.selectionEnd ?? composerSelectionRef.current.end;
    const next = `${message.slice(0, start)}${text}${message.slice(end)}`;
    const caret = start + text.length;
    messageRef.current = next;
    setMessage(next);
    setMentionContext(null);
    composerSelectionRef.current = { start: caret, end: caret };
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(caret, caret);
    });
    return caret;
  }
  function openMentionPicker() {
    const caret = insertComposerText("@");
    setMentionContext({ start: caret - 1, end: caret, query: "" });
    setActiveMentionIndex(0);
  }
  function handleFilesSelected(files: FileList | null) {
    if (!files?.length) return;
    const next = [...attachedFiles, ...Array.from(files)];
    if (next.length > 10 || next.reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024) {
      setError("Attach up to 10 files with a combined size of 50 MB or less.");
    } else {
      setAttachedFiles(next);
      setError("");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }
  function submitMessage(e: FormEvent) {
    e.preventDefault();
    sendWorkspaceMessage();
  }
  function handleComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionContext && filteredMentionOptions.length && e.key === "ArrowDown") {
      e.preventDefault();
      setActiveMentionIndex((index) => (index + 1) % filteredMentionOptions.length);
      return;
    }
    if (mentionContext && filteredMentionOptions.length && e.key === "ArrowUp") {
      e.preventDefault();
      setActiveMentionIndex((index) => (index - 1 + filteredMentionOptions.length) % filteredMentionOptions.length);
      return;
    }
    if (mentionContext && e.key === "Escape") {
      e.preventDefault();
      setMentionContext(null);
      return;
    }
    if (mentionContext && filteredMentionOptions.length && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      selectMention(filteredMentionOptions[activeMentionIndex] ?? filteredMentionOptions[0]);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (message.trim()) sendWorkspaceMessage();
    }
  }
  async function deliverWorkspaceMessage(pending: Message) {
    const clientMessageId = pending.clientMessageId;
    if (!clientMessageId) return;
    if (/(^|\s)@gluk\b/i.test(pending.content) && !glukPendingRef.current.has(clientMessageId)) {
      const timer = setTimeout(() => {
        glukPendingRef.current.delete(clientMessageId);
        setGlukResponding(glukPendingRef.current.size > 0);
      }, 120_000);
      glukPendingRef.current.set(clientMessageId, timer);
      setGlukResponding(true);
    }
    setLiveMessages((current) => mergeMessages(current, [{ ...pending, deliveryStatus: "sending" }]));
    try {
      const files = pending.pendingFiles ?? [];
      let body: BodyInit;
      if (files.length) {
        const form = new FormData();
        form.set("content", pending.content);
        form.set("clientMessageId", clientMessageId);
        form.set("replyToId", pending.replyToId ?? "");
        files.forEach((file) => form.append("files", file));
        body = form;
      } else {
        body = JSON.stringify({ content: pending.content, clientMessageId, replyToId: pending.replyToId ?? null });
      }
      const saved = await api<Message>(`${base}/messages`, { method: "POST", body });
      setLiveMessages((current) => mergeMessages(current, [{ ...saved, deliveryStatus: "sent", pendingFiles: undefined }]));
      qc.setQueryData<Message[]>(["workspace-messages", workspaceId], (old) => mergeMessages(old ?? [], [saved]));
      if (files.length) {
        void qc.invalidateQueries({ queryKey: ["workspace-resources", workspaceId] });
        if (session?.user?.email) {
          void qc.invalidateQueries({ queryKey: ["resources", session.user.email] });
        }
      }
      setError("");
    } catch {
      setLiveMessages((current) => mergeMessages(current, [{ ...pending, deliveryStatus: "failed" }]));
      const timer = glukPendingRef.current.get(clientMessageId);
      if (timer) clearTimeout(timer);
      glukPendingRef.current.delete(clientMessageId);
      setGlukResponding(glukPendingRef.current.size > 0);
    }
  }
  function sendWorkspaceMessage() {
    const content = message.trim();
    if (!content && !attachedFiles.length) return;
    const clientMessageId = crypto.randomUUID();
    const pending: Message = {
      id: `pending:${clientMessageId}`,
      userEmail: session?.user?.email?.trim().toLowerCase() ?? "",
      userName: session?.user?.name ?? session?.user?.email ?? "You",
      role: "user",
      content,
      createdAt: new Date().toISOString(),
      clientMessageId,
      deliveryStatus: "sending",
      replyToId: replyTo?.id ?? null,
      replyTo,
      pendingFiles: attachedFiles,
      attachments: attachedFiles.map((file, index) => ({ id: `pending:${clientMessageId}:${index}`, name: file.name, type: file.type || "application/octet-stream", size: file.size, url: "" })),
    };
    setLiveMessages((current) => mergeMessages(current, [pending]));
    messageRef.current = "";
    setMessage("");
    setAttachedFiles([]);
    setEmojiPickerOpen(false);
    setReplyTo(null);
    void ephemeralRef.current?.send({ type: "broadcast", event: "typing", payload: { email: session?.user?.email?.toLowerCase(), name: session?.user?.name ?? "Member", avatarUrl: session?.user?.image ?? null, typing: false } });
    void deliverWorkspaceMessage(pending);
  }
  function beginReply(target: Message) {
    setReplyTo({
      id: target.id,
      userName: target.role === "assistant" ? "Gluk" : target.userName,
      content: target.content,
    });
    requestAnimationFrame(() => composerRef.current?.focus());
  }
  async function toggleReaction(target: Message, emoji: string) {
    const previous = target.reactions ?? [];
    const currentReaction = previous.find((reaction) => reaction.emoji === emoji);
    const optimistic = currentReaction
      ? currentReaction.reacted
        ? currentReaction.count > 1
          ? previous.map((reaction) => reaction.emoji === emoji ? { ...reaction, count: reaction.count - 1, reacted: false } : reaction)
          : previous.filter((reaction) => reaction.emoji !== emoji)
        : previous.map((reaction) => reaction.emoji === emoji ? { ...reaction, count: reaction.count + 1, reacted: true } : reaction)
      : [...previous, { emoji, count: 1, reacted: true }];
    setLiveMessages((current) => current.map((item) => item.id === target.id ? { ...item, reactions: optimistic } : item));
    setReactionPickerFor(null);
    try {
      const result = await api<{ reactions: MessageReaction[] }>(`${base}/messages/${encodeURIComponent(target.id)}/reactions`, { method: "POST", body: JSON.stringify({ emoji }) });
      setLiveMessages((current) => current.map((item) => item.id === target.id ? { ...item, reactions: result.reactions } : item));
      setError("");
    } catch (error) {
      setLiveMessages((current) => current.map((item) => item.id === target.id ? { ...item, reactions: previous } : item));
      setError(error instanceof Error ? error.message : "Could not update reaction");
    }
  }
  function handleMessageChange(value: string, caret: number) {
    composerSelectionRef.current = { start: caret, end: caret };
    messageRef.current = value;
    setMessage(value);
    const prefix = value.slice(0, caret);
    const match = prefix.match(/(?:^|\s)@([^\s@]*)$/);
    if (match) {
      const query = match[1];
      setMentionContext({ start: caret - query.length - 1, end: caret, query });
      setActiveMentionIndex(0);
    } else {
      setMentionContext(null);
    }
    if (!socketReady) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current >= 1500) {
      lastTypingSentRef.current = now;
      void ephemeralRef.current?.send({ type: "broadcast", event: "typing", payload: { email: session?.user?.email?.toLowerCase(), name: session?.user?.name ?? "Member", avatarUrl: session?.user?.image ?? null, typing: true } });
    }
    if (typingClearTimerRef.current) clearTimeout(typingClearTimerRef.current);
    typingClearTimerRef.current = setTimeout(() => {
      void ephemeralRef.current?.send({ type: "broadcast", event: "typing", payload: { email: session?.user?.email?.toLowerCase(), name: session?.user?.name ?? "Member", avatarUrl: session?.user?.image ?? null, typing: false } });
    }, 1800);
  }
  function clearFeedback() {
    setError("");
    setNotice("");
  }
  async function copyInvite(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  const visibleError = error || (!process.env.NEXT_PUBLIC_SUPABASE_URL && tab === "chat"
    ? "Workspace chat is not configured. The Supabase URL is missing."
    : !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && tab === "chat"
      ? "Workspace chat is not configured. The Supabase publishable key is missing."
      : "");

  if (status === "loading" || workspaceQ.isLoading)
    return (
      <main className="grid min-h-0 flex-1 place-items-center bg-background text-foreground">
        <LoaderCircle className="animate-spin" />
      </main>
    );
  if (status !== "authenticated")
    return (
      <main className="grid min-h-0 flex-1 place-items-center bg-background p-6 text-foreground">
        <section className="text-center">
          <h1 className="text-2xl font-semibold">
            Sign in to view this workspace
          </h1>
        </section>
      </main>
    );
  if (workspaceQ.isError || !w)
    return (
      <main className="grid min-h-0 flex-1 place-items-center bg-background p-6 text-foreground">
        <section className="text-center">
          <h1 className="text-2xl font-semibold">Workspace unavailable</h1>
          <p className="mt-2 text-muted-foreground">
            You may not be a member of this private workspace.
          </p>
          <button
            onClick={() => router.replace("/workspaces")}
            className="mt-5 rounded-full border border-border px-5 py-3"
          >
            Back to workspaces
          </button>
        </section>
      </main>
    );
  const tabs = [
    { id: "chat" as const, label: "Chat", icon: MessageSquareText },
    { id: "projects" as const, label: "Projects", icon: FolderKanban },
    { id: "resources" as const, label: "Resources", icon: FolderOpen },
  ];
  const onlineUsers = onlineMembers.filter((member) => member.online);
  function changeWorkspaceTab(nextTab: WorkspaceTab) {
    clearFeedback();
    setTab(nextTab);
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") === nextTab) return;
    url.searchParams.set("tab", nextTab);
    window.history.pushState(null, "", url);
  }
  function handleAskGlukAboutProject(p: WorkspaceProject) {
    changeWorkspaceTab("chat");
    const prompt = `@Gluk Can you summarize the goals and resources in the ${p.name} project?`;
    setMessage(prompt);
    messageRef.current = prompt;
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(prompt.length, prompt.length);
    });
  }
  function handleChatAboutResource(resource: WorkspaceResource) {
    changeWorkspaceTab("chat");
    const prompt = `@Gluk Can you summarize and review @${resource.name}? `;
    setMessage(prompt);
    messageRef.current = prompt;
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(prompt.length, prompt.length);
    });
  }
  const handlePreview = onPreviewFile ?? setPreviewFile;
  return (
    <main
      className={`relative flex min-h-0 flex-1 flex-col bg-background text-foreground ${embedded ? "h-full overflow-hidden" : "min-h-screen overflow-y-auto"}`}
    >
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            aria-label="All workspaces"
            onClick={() => router.push("/workspaces")}
            className="rounded-full p-2 hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{w.name}</p>
            <p className="text-xs text-muted-foreground">
              Private workspace · {w.members.length}{" "}
              {w.members.length === 1 ? "member" : "members"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {w.role === "owner" && (
          <button
            onClick={() => {
              clearFeedback();
              setInviteOpen(true);
            }}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-colors hover:opacity-85"
          >
            <UsersRound className="h-4 w-4" />
            <span className="hidden sm:inline">Invite members</span>
          </button>
          )}
        </div>
      </header>
      <div className={`flex min-h-0 w-full flex-1 flex-col px-4 sm:px-6 ${embedded ? "" : "mx-auto max-w-6xl"}`}>
        {!embedded && <div className="shrink-0 border-b border-border/60 py-7">
          <p className="text-sm text-muted-foreground">Workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{w.name}</h1>
          {w.description && <p className="mt-2 max-w-2xl text-muted-foreground">{w.description}</p>}
          <nav aria-label="Workspace sections" className="mt-6 flex items-center gap-1 overflow-x-auto border-b border-border/60">
            {tabs.map((item) => <button key={item.id} onClick={() => changeWorkspaceTab(item.id)} className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm ${tab === item.id ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}><item.icon className="h-4 w-4" />{item.label}</button>)}
            {tab === "chat" && <div className="ml-auto flex shrink-0 items-center gap-2 px-2 py-2 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${socketReady ? "bg-emerald-500" : "bg-amber-500/80 animate-pulse"}`} /><span>{socketReady ? `${onlineUsers.length} online` : "Connecting…"}</span><div className="flex -space-x-2">{onlineUsers.slice(0, 4).map((member) => <MemberAvatar key={member.email} name={member.name} src={w.members.find((item) => item.email === member.email)?.avatarUrl ?? (member.email === session.user?.email?.toLowerCase() ? session.user.image : null)} />)}</div></div>}
          </nav>
        </div>}
        {embedded && <nav aria-label="Workspace sections" className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/60 py-2">
          {tabs.map((item) => <button key={item.id} onClick={() => changeWorkspaceTab(item.id)} className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-colors ${tab === item.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}><item.icon className="h-4 w-4" />{item.label}</button>)}
          {tab === "chat" && <div className="ml-auto flex shrink-0 items-center gap-2 px-2 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${socketReady ? "bg-emerald-500" : "bg-amber-500/80 animate-pulse"}`} /><span>{socketReady ? `${onlineUsers.length} online` : "Connecting…"}</span><div className="flex -space-x-2">{onlineUsers.slice(0, 4).map((member) => <MemberAvatar key={member.email} name={member.name} src={w.members.find((item) => item.email === member.email)?.avatarUrl ?? (member.email === session.user?.email?.toLowerCase() ? session.user.image : null)} />)}</div></div>}
        </nav>}
        {(visibleError || notice) && <div className={`mt-4 whitespace-pre-wrap rounded-xl border px-4 py-3 text-sm ${visibleError ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-border bg-muted/50 text-muted-foreground"}`}>{visibleError || notice}{notice.includes("http") && <button onClick={() => copyInvite(notice.match(/https?:\/\/[^\s]+/)?.[0] ?? "")} className="ml-3 inline-flex items-center gap-1 underline">{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}Copy invite link</button>}<button className="float-right ml-3 underline" onClick={clearFeedback}>Dismiss</button></div>}
        {tab === "chat" && (
          <WorkspaceChatPanel
            messageListRef={messageListRef}
            composerRef={composerRef}
            fileInputRef={fileInputRef}
            composerSelectionRef={composerSelectionRef}
            typingMembers={typingMembers}
            socketReady={socketReady}
            messagesLoading={messagesQ.isLoading && !workspaceMessages.length}
            workspaceMessages={workspaceMessages}
            session={session}
            workspace={w}
            theme={theme}
            mentionLabels={[...(w.members ?? []).map((member) => member.name), ...(resourcesQ.data ?? []).map((resource) => resource.name)]}
            glukResponding={glukResponding}
            reactionPickerFor={reactionPickerFor}
            setReactionPickerFor={setReactionPickerFor}
            onToggleReaction={toggleReaction}
            onReply={beginReply}
            onRetry={deliverWorkspaceMessage}
            replyTo={replyTo}
            setReplyTo={setReplyTo}
            submitMessage={submitMessage}
            handleFilesSelected={handleFilesSelected}
            attachedFiles={attachedFiles}
            setAttachedFiles={setAttachedFiles}
            mentionContext={mentionContext}
            filteredMentionOptions={filteredMentionOptions}
            activeMentionIndex={activeMentionIndex}
            selectMention={selectMention}
            message={message}
            handleMessageChange={handleMessageChange}
            onComposerKeyDown={handleComposerKeyDown}
            emojiPickerOpen={emojiPickerOpen}
            setEmojiPickerOpen={setEmojiPickerOpen}
            insertComposerText={insertComposerText}
            openMentionPicker={openMentionPicker}
            onPreview={handlePreview}
          />
        )}
        {tab === "projects" && (
          <WorkspaceProjectsPanel
            workspaceId={workspaceId}
            projects={projectsQ.data ?? []}
            resources={resourcesQ.data ?? []}
            personalResources={(myResourcesQ.data ?? []) as WorkspacePersonalResource[]}
            isLoading={projectsQ.isLoading}
            name={projectName}
            description={projectDescription}
            isCreating={createProject.isPending}
            onNameChange={setProjectName}
            onDescriptionChange={setProjectDescription}
            onCreate={() => createProject.mutate()}
            onResourceUploaded={() => {
              void qc.invalidateQueries({ queryKey: ["workspace-resources", workspaceId] });
            }}
            onAskGlukAboutProject={handleAskGlukAboutProject}
            onSharePersonalResource={async (url, projectId) => {
              await sharePersonalResource.mutateAsync({ url, projectId });
            }}
            onAttachWorkspaceResource={async (resourceId, projectId) => {
              await attachWorkspaceResource.mutateAsync({ resourceId, projectId });
            }}
            onDeleteWorkspaceResource={async (resourceId) => {
              await deleteWorkspaceResource.mutateAsync(resourceId);
            }}
            onPreview={handlePreview}
          />
        )}
        {tab === "resources" && (
          <WorkspaceResourcesPanel
            workspaceId={workspaceId}
            resources={resourcesQ.data ?? []}
            projects={projectsQ.data ?? []}
            personalResources={(myResourcesQ.data ?? []) as WorkspacePersonalResource[]}
            isLoading={resourcesQ.isLoading}
            isSharing={share.isPending}
            selectedProject={resourceProject}
            selectedResourceUrl={resourceUrl}
            onProjectChange={(value) => setResourceProject(value === "none" ? "" : value)}
            onResourcePickerOpen={() => setResourcePickerOpen(true)}
            onShare={() => share.mutate()}
            onUploaded={() => qc.invalidateQueries({ queryKey: ["workspace-resources", workspaceId] }).then(() => undefined)}
            onPreview={handlePreview}
            onChatAbout={handleChatAboutResource}
            onDeleteResource={async (resourceId) => {
              await deleteWorkspaceResource.mutateAsync(resourceId);
            }}
            onNotice={(msg) => setNotice(msg)}
          />
        )}
        <WorkspaceDialogs
          workspaceName={w.name}
          workspaceRole={w.role}
          members={w.members}
          inviteOpen={inviteOpen}
          invitePending={invite.isPending}
          inviteEmail={inviteEmail}
          error={error}
          onInviteOpenChange={setInviteOpen}
          onInviteEmailChange={setInviteEmail}
          onInvite={() => invite.mutate()}
        />
        <AttachProjectResourceDialog
          open={resourcePickerOpen}
          onOpenChange={setResourcePickerOpen}
          project={projectsQ.data?.find((p) => p.id === resourceProject) || null}
          workspaceResources={resourcesQ.data ?? []}
          personalResources={(myResourcesQ.data ?? []) as WorkspacePersonalResource[]}
          initialTab={resourceProject ? "personal" : "personal"}
          onAttachWorkspaceResource={async (resId, pId) => {
            await attachWorkspaceResource.mutateAsync({ resourceId: resId, projectId: pId });
          }}
          onSharePersonalResource={async (url, pId) => {
            await sharePersonalResource.mutateAsync({ url, projectId: pId || null });
          }}
          onDeleteWorkspaceResource={async (resId) => {
            await deleteWorkspaceResource.mutateAsync(resId);
          }}
          onSelectResourceUrl={setResourceUrl}
        />
      </div>
      {!onPreviewFile && previewFile && (
        <div className="absolute inset-0 z-40 flex min-h-0 bg-background">
          <DocumentViewer
            file={previewFile}
            onClose={() => setPreviewFile(null)}
            theme={theme}
          />
        </div>
      )}
    </main>
  );
}
