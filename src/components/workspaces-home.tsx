"use client";

import { FormEvent, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Grid2X2, LoaderCircle, List, Plus, UsersRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Workspace = {
  id: string;
  name: string;
  description: string | null;
  role: string;
  createdAt: string;
  memberCount?: number;
  unreadCount?: number;
};
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function WorkspacesHome() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const { data = [], isLoading } = useQuery({
    queryKey: ["workspaces", session?.user?.email],
    queryFn: () => api<Workspace[]>("/api/workspaces"),
    enabled: status === "authenticated",
  });
  const create = useMutation({
    mutationFn: () =>
      api<Workspace>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      }),
    onSuccess: async (workspace) => {
      setOpen(false);
      setName("");
      setDescription("");
      await client.invalidateQueries({ queryKey: ["workspaces"] });
      router.push(`/workspaces/${workspace.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    create.mutate();
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background text-foreground">
      <section className="border-b border-border/60 px-6 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Workspaces
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Private spaces to learn, share resources, and work together.
            </p>
          </div>
          <button
            onClick={() =>
              status === "authenticated"
                ? setOpen(true)
                : router.push("/login?callbackUrl=%2Fworkspaces")
            }
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-85"
          >
            <Plus className="h-4 w-4" /> Create workspace
          </button>
        </div>
      </section>

      <section className="flex-1 p-6 sm:p-8">
        {status === "authenticated" && !isLoading && data.length > 0 && (
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{data.length} {data.length === 1 ? "workspace" : "workspaces"}</p>
            <div aria-label="Workspace display" className="inline-flex rounded-xl border border-border bg-card p-1">
              <button type="button" aria-label="Grid view" aria-pressed={viewMode === "grid"} onClick={() => setViewMode("grid")} className={`grid h-8 w-9 place-items-center rounded-lg transition-colors ${viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}><Grid2X2 className="h-4 w-4" /></button>
              <button type="button" aria-label="List view" aria-pressed={viewMode === "list"} onClick={() => setViewMode("list")} className={`grid h-8 w-9 place-items-center rounded-lg transition-colors ${viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}><List className="h-4 w-4" /></button>
            </div>
          </div>
        )}
        {status !== "authenticated" && status !== "loading" ? (
          <button
            onClick={() => router.push("/login?callbackUrl=%2Fworkspaces")}
            className="grid min-h-[360px] w-full place-items-center rounded-[28px] border border-dashed border-border bg-card/40 p-8 text-center transition-colors hover:bg-muted/30"
          >
            <span>
              <UsersRound className="mx-auto h-10 w-10 text-muted-foreground" />
              <span className="mt-4 block text-lg font-medium">
                Sign in to create or join a workspace
              </span>
              <span className="mt-2 block text-sm text-muted-foreground">
                Workspaces are private and only visible to their members.
              </span>
            </span>
          </button>
        ) : isLoading || status === "loading" ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-3xl bg-muted"
              />
            ))}
          </div>
        ) : data.length ? (
          <div className={viewMode === "grid" ? "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4" : "flex flex-col gap-3"}>
            {data.map((w) => (
              <button
                key={w.id}
                onClick={() => router.push(`/workspaces/${w.id}`)}
                className={viewMode === "grid"
                  ? "flex min-h-64 flex-col rounded-3xl border border-border bg-card p-5 text-left transition-colors hover:bg-muted/35"
                  : "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border bg-card px-4 py-4 text-left transition-colors hover:bg-muted/35 sm:px-5"}
              >
                <span className={`grid place-items-center rounded-2xl bg-muted ${viewMode === "grid" ? "h-11 w-11" : "h-10 w-10"}`}>
                  <UsersRound className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base font-medium">{w.name}</span>
                    {!!w.unreadCount && viewMode === "list" && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">{w.unreadCount > 99 ? "99+" : w.unreadCount} unread</span>}
                  </span>
                  <span className="mt-1 block line-clamp-2 text-sm text-muted-foreground">{w.description || "A private space to learn and collaborate."}</span>
                  <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs capitalize text-muted-foreground">
                    {viewMode === "list" && <span>{w.role}</span>}
                    <span className="inline-flex items-center gap-1.5"><UsersRound className="h-3.5 w-3.5" />{w.memberCount ?? 1} {w.memberCount === 1 ? "member" : "members"}</span>
                  </span>
                </span>
                <span className={`flex items-center gap-2 ${viewMode === "grid" ? "mt-6 justify-between" : "justify-end"}`}>
                  {viewMode === "grid" && <span className="text-xs capitalize text-muted-foreground">{w.role} · Workspace</span>}
                  {!!w.unreadCount && viewMode === "grid" && <span className="rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">{w.unreadCount > 99 ? "99+" : w.unreadCount} unread</span>}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="grid min-h-[min(58vh,620px)] w-full place-items-center rounded-[28px] border border-dashed border-border bg-card/40 p-8 text-center transition-colors hover:bg-muted/30"
          >
            <span>
              <UsersRound className="mx-auto h-11 w-11 text-muted-foreground" />
              <span className="mt-5 block text-xl font-medium">
                Create your first workspace
              </span>
              <span className="mt-2 block text-sm text-muted-foreground">
                Bring people together to learn, chat, and share resources.
              </span>
              <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background">
                <Plus className="h-4 w-4" /> Create workspace
              </span>
            </span>
          </button>
        )}
      </section>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!create.isPending) setOpen(next);
        }}
      >
        <DialogContent
          showCloseButton={!create.isPending}
          className="sm:max-w-xl"
        >
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Create a workspace</DialogTitle>
              <DialogDescription>
                Set up a private place for your group to learn and collaborate.
              </DialogDescription>
            </DialogHeader>
            <label className="mt-6 block text-sm font-medium">
              Workspace name
              <input
                required
                maxLength={80}
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Study group"
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Description{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
              <textarea
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this workspace for?"
                rows={3}
                className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-3 py-3 outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            <DialogFooter className="mt-6">
              <button
                type="button"
                disabled={create.isPending}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={create.isPending || !name.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-50"
              >
                {create.isPending && (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                )}
                {create.isPending ? "Creating…" : "Create workspace"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
