"use client";
import { useEffect, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { api, mergeMessages } from "@/components/workspace/workspace-utils";
import type { Message, MessageReaction, WorkspaceMember, WorkspaceTab } from "@/components/workspace/workspace-types";

type UseWorkspaceRealtimeOptions = {
  status: string;
  tab: WorkspaceTab;
  workspaceId: string;
  userEmail?: string | null;
  queryClient: QueryClient;
  setWorkspaceMessages: Dispatch<SetStateAction<Message[]>>;
  setGlukResponding: Dispatch<SetStateAction<boolean>>;
  setOnlineMembers: Dispatch<SetStateAction<WorkspaceMember[]>>;
  setTypingMembers: Dispatch<SetStateAction<Record<string, { name: string; avatarUrl?: string | null }>>>;
  setSocketReady: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  ephemeralRef: RefObject<RealtimeChannel | null>;
  glukPendingRef: RefObject<Map<string, ReturnType<typeof setTimeout>>>;
  typingTimersRef: RefObject<Map<string, ReturnType<typeof setTimeout>>>;
  typingClearTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
};

export function useWorkspaceRealtime({ status, tab, workspaceId, userEmail, queryClient: qc, setWorkspaceMessages, setGlukResponding, setOnlineMembers, setTypingMembers, setSocketReady, setError, ephemeralRef, glukPendingRef, typingTimersRef, typingClearTimerRef }: UseWorkspaceRealtimeOptions) {
  const base = `/api/workspaces/${workspaceId}`;
  const cursorRef = useRef<{ createdAt: string; id: string } | null>(null);
  useEffect(() => {
    if (status !== "authenticated" || tab !== "chat") return;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) return;
    let disposed = false;
    let channels: RealtimeChannel[] = [];
    let tokenRefresh: number | undefined;
    const typingTimers = typingTimersRef.current;
    const applyMessages = (incoming: Message[]) => {
      setWorkspaceMessages((current) => mergeMessages(current, incoming));
      for (const item of incoming) {
        const candidate = { createdAt: item.createdAt, id: item.id };
        const cursor = cursorRef.current;
        if (!cursor || candidate.createdAt > cursor.createdAt || (candidate.createdAt === cursor.createdAt && candidate.id > cursor.id)) {
          cursorRef.current = candidate;
        }
      }
    };
    void (async () => {
      try {
        const tokenResponse = await api<{ token: string; email: string; name: string }>("/api/workspaces/realtime-token");
        if (disposed) return;
        const supabase = getSupabaseBrowser(supabaseUrl, supabaseKey);
        await supabase.realtime.setAuth(tokenResponse.token);
        if (disposed) return;
        tokenRefresh = window.setInterval(() => {
          void api<{ token: string }>("/api/workspaces/realtime-token", { cache: "no-store" })
            .then(({ token }) => supabase.realtime.setAuth(token))
            .catch((err) => console.warn("Realtime authorization refresh error:", err));
        }, 4 * 60 * 1000);
        supabase.getChannels().forEach((ch) => {
          if (ch.topic === `realtime:workspace:${workspaceId}:messages` || ch.topic === `realtime:workspace:${workspaceId}:ephemeral`) {
            void supabase.removeChannel(ch);
          }
        });
        const messagesChannel = supabase.channel(`workspace:${workspaceId}:messages`, { config: { private: true } });
        const ephemeral = supabase.channel(`workspace:${workspaceId}:ephemeral`, { config: { private: true, presence: { key: tokenResponse.email } } });
        ephemeralRef.current = ephemeral;
        channels = [messagesChannel, ephemeral];
        messagesChannel.on("broadcast", { event: "message" }, ({ payload }) => {
          const saved = payload as Message;
          const incoming = saved.userEmail === tokenResponse.email && saved.clientMessageId
            ? { ...saved, deliveryStatus: "sent" as const }
            : saved;
          if (incoming.role === "assistant") incoming.isStreaming = false;
          applyMessages([incoming]);
          if (incoming.attachments?.length) {
            void qc.invalidateQueries({ queryKey: ["workspace-resources", workspaceId] });
          }
          if (incoming.role === "assistant") {
            for (const timer of glukPendingRef.current.values()) clearTimeout(timer);
            glukPendingRef.current.clear();
            setGlukResponding(false);
          }
          if (incoming.userEmail !== tokenResponse.email) void api(`${base}/read`, { method: "POST" }).then(() => qc.invalidateQueries({ queryKey: ["workspaces"] })).catch(() => undefined);
        });
        messagesChannel.on("broadcast", { event: "reaction_state" }, ({ payload }) => {
          const update = payload as { messageId: string; reactions: MessageReaction[]; actorEmail: string };
          setWorkspaceMessages((current) => current.map((item) => {
            if (item.id !== update.messageId) return item;
            const ownUpdate = update.actorEmail === tokenResponse.email;
            return { ...item, reactions: update.reactions.map((reaction) => ({
              ...reaction,
              reacted: ownUpdate ? reaction.reacted : (item.reactions ?? []).some((old) => old.emoji === reaction.emoji && old.reacted),
            })) };
          }));
        });
        messagesChannel.on("broadcast", { event: "assistant_stream" }, ({ payload }) => {
          const event = payload as {
            type: "start" | "delta" | "error";
            id: string;
            createdAt?: string;
            clientMessageId?: string | null;
            requestClientMessageId?: string | null;
            userEmail?: string;
            userName?: string;
            role?: "assistant";
            content?: string;
            delta?: string;
          };
          if (event.type === "start") {
            const requestTimer = event.requestClientMessageId ? glukPendingRef.current.get(event.requestClientMessageId) : undefined;
            if (requestTimer) clearTimeout(requestTimer);
            if (event.requestClientMessageId) glukPendingRef.current.delete(event.requestClientMessageId);
            setGlukResponding(false);
            setWorkspaceMessages((current) => mergeMessages(current, [{
              id: event.id,
              userEmail: event.userEmail ?? "gluk@system.local",
              userName: event.userName ?? "Gluk",
              role: "assistant",
              content: "",
              createdAt: event.createdAt ?? new Date().toISOString(),
              clientMessageId: event.clientMessageId,
              isStreaming: true,
            }]));
            return;
          }
          if (event.type === "delta") {
            setWorkspaceMessages((current) => current.map((item) => item.id === event.id
              ? { ...item, content: item.content + (event.delta ?? ""), isStreaming: true }
              : item));
            return;
          }
          if (event.type === "error") {
            const requestTimer = event.requestClientMessageId ? glukPendingRef.current.get(event.requestClientMessageId) : undefined;
            if (requestTimer) clearTimeout(requestTimer);
            if (event.requestClientMessageId) glukPendingRef.current.delete(event.requestClientMessageId);
            setWorkspaceMessages((current) => {
              if (current.some((item) => item.id === event.id)) {
                return current.map((item) => item.id === event.id
                  ? { ...item, content: event.content ?? "Gluk couldn't finish that response.", isStreaming: false }
                  : item);
              }
              return mergeMessages(current, [{
                id: event.id,
                userEmail: "gluk@system.local",
                userName: "Gluk",
                role: "assistant",
                content: event.content ?? "Gluk couldn't finish that response.",
                createdAt: new Date().toISOString(),
                clientMessageId: event.id,
                isStreaming: false,
              }]);
            });
            setGlukResponding(false);
          }
        });
        ephemeral.on("presence", { event: "sync" }, () => {
          const state = ephemeral.presenceState<{ email: string; name: string }>();
          const members = new Map<string, WorkspaceMember>();
          Object.values(state).flat().forEach((p) => members.set(p.email, { email: p.email, name: p.name, online: true }));
          setOnlineMembers([...members.values()]);
        });
        ephemeral.on("broadcast", { event: "typing" }, ({ payload }) => {
          const p = payload as { email: string; name: string; typing: boolean; avatarUrl?: string | null };
          if (p.email === tokenResponse.email) return;
          const oldTimer = typingTimers.get(p.email);
          if (oldTimer) clearTimeout(oldTimer);
          if (!p.typing) { typingTimers.delete(p.email); setTypingMembers((current) => { const next = { ...current }; delete next[p.email]; return next; }); return; }
          setTypingMembers((current) => ({ ...current, [p.email]: { name: p.name, avatarUrl: p.avatarUrl ?? null } }));
          typingTimers.set(p.email, setTimeout(() => { typingTimers.delete(p.email); setTypingMembers((current) => { const next = { ...current }; delete next[p.email]; return next; }); }, 4000));
        });
        const recoverMissed = async () => {
          let batch: Message[] = [];
          do {
            const cursor = cursorRef.current;
            const url = `${base}/messages${cursor ? `?createdAt=${encodeURIComponent(cursor.createdAt)}&id=${encodeURIComponent(cursor.id)}` : ""}`;
            batch = await api<Message[]>(url);
            if (disposed) return;
            applyMessages(batch);
          } while (batch.length === 300);
        };
        let wasSubscribed = false;
        messagesChannel.subscribe((state, err) => {
          if (disposed) return;
          if (state === "SUBSCRIBED") {
            setSocketReady(true);
            setError("");
            if (wasSubscribed) {
              void recoverMissed().catch(() => undefined);
            }
            wasSubscribed = true;
          } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
            setSocketReady(false);
            if (err) console.warn("Workspace messages channel connection issue:", state, err);
          }
        });
        ephemeral.subscribe((state, err) => {
          if (disposed) return;
          if (state === "SUBSCRIBED") {
            void ephemeral.track({ email: tokenResponse.email, name: tokenResponse.name });
          } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
            if (err) console.warn("Workspace ephemeral channel connection issue:", state, err);
          }
        });
        void recoverMissed().catch(() => undefined);
        void api(`${base}/read`, { method: "POST" }).then(() => qc.invalidateQueries({ queryKey: ["workspaces"] })).catch(() => undefined);
      } catch (err) {
        if (!disposed) {
          setSocketReady(false);
          console.warn("Could not connect to workspace realtime:", err);
        }
      }
    })();
    return () => {
      disposed = true;
      if (tokenRefresh) window.clearInterval(tokenRefresh);
      const supabase = getSupabaseBrowser(supabaseUrl, supabaseKey);
      channels.forEach((channel) => { void supabase.removeChannel(channel); });
      ephemeralRef.current = null;
      setSocketReady(false);
      for (const timer of typingTimers.values()) clearTimeout(timer);
      typingTimers.clear();
      // This ref stores an ordinary timeout handle, so read its latest value during cleanup.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (typingClearTimerRef.current) clearTimeout(typingClearTimerRef.current);
    };
    // One private channel pair belongs to the signed-in user and active workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- State setters and ref containers are stable; reconnects depend on workspace and user identity.
  }, [status, tab, workspaceId, userEmail, base, qc]);
}
