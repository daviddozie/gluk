"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Message = { workspaceId: string; userEmail: string; userName: string; content: string };
type Workspace = { id: string; name: string };

export default function WorkspaceNotifications() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    let disposed = false;
    let client: ReturnType<typeof getSupabaseBrowser> | undefined;
    let channels: RealtimeChannel[] = [];
    let tokenRefresh: number | undefined;
    void (async () => {
      try {
        const [tokenResponse, workspaces] = await Promise.all([
          fetch("/api/workspaces/realtime-token", { cache: "no-store" }).then(async (r) => { if (!r.ok) throw new Error(); return r.json() as Promise<{ token: string; email: string }>; }),
          fetch("/api/workspaces", { cache: "no-store" }).then(async (r) => { if (!r.ok) throw new Error(); return r.json() as Promise<Workspace[]>; }),
        ]);
        if (disposed || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return;
        client = getSupabaseBrowser(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
        await client.realtime.setAuth(tokenResponse.token);
        tokenRefresh = window.setInterval(() => {
          void fetch("/api/workspaces/realtime-token", { cache: "no-store" })
            .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<{ token: string }>; })
            .then(({ token }) => client?.realtime.setAuth(token))
            .catch(() => undefined);
        }, 4 * 60 * 1000);
        channels = workspaces.map((workspace) => client!.channel(`workspace:${workspace.id}:messages`, { config: { private: true } })
          .on("broadcast", { event: "message" }, ({ payload }) => {
            const message = payload as Message;
            void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
            if (message.userEmail !== tokenResponse.email && !pathname?.startsWith(`/workspaces/${workspace.id}`)) {
              setNotice(`${message.userName}: ${message.content.slice(0, 100)}${message.content.length > 100 ? "…" : ""}`);
              window.setTimeout(() => setNotice(""), 5000);
            }
          }));
        channels.forEach((channel) => channel.subscribe());
        const personal = client.channel(`user:${tokenResponse.email}`, { config: { private: true } })
          .on("broadcast", { event: "read_cursor_changed" }, () => void queryClient.invalidateQueries({ queryKey: ["workspaces"] }));
        channels.push(personal);
        personal.subscribe();
      } catch { /* Chat remains available through HTTP history if Realtime is not configured. */ }
    })();
    return () => { disposed = true; if (tokenRefresh) window.clearInterval(tokenRefresh); channels.forEach((channel) => { void channel.unsubscribe(); }); };
  }, [status, session?.user?.email, pathname, queryClient]);

  if (!notice) return null;
  return <div role="status" className="fixed bottom-5 right-5 z-50 max-w-sm rounded-2xl border border-border bg-card px-4 py-3 text-sm shadow-xl">{notice}</div>;
}
