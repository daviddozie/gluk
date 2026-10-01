"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LoaderCircle, UsersRound } from "lucide-react";

export default function WorkspaceInvitation({ token }: { token: string }) {
  const { status } = useSession();
  const router = useRouter();
  const [invite, setInvite] = useState<{
    email: string;
    workspaceName: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`/api/invitations/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setInvite(data);
      })
      .catch((e) => setError(e.message));
  }, [token]);
  async function accept() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      router.replace(`/workspaces/${d.workspaceId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept invitation");
      setBusy(false);
    }
  }
  if (status === "loading" || (!invite && !error))
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground">
        <LoaderCircle className="animate-spin" />
      </main>
    );
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted">
          <UsersRound className="h-6 w-6" />
        </div>
        {error && !invite ? (
          <>
            <h1 className="mt-5 text-2xl font-semibold">
              Invitation unavailable
            </h1>
            <p className="mt-2 text-muted-foreground">{error}</p>
          </>
        ) : (
          <>
            <h1 className="mt-5 text-2xl font-semibold">
              Join {invite?.workspaceName}
            </h1>
            <p className="mt-2 text-muted-foreground">
              You’ve been invited to collaborate in this private workspace as{" "}
              <strong className="font-medium text-foreground">
                {invite?.email}
              </strong>
              .
            </p>
            {status !== "authenticated" ? (
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 font-medium text-background"
              >
                Sign in to accept
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                onClick={accept}
                disabled={busy}
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 font-medium text-background disabled:opacity-60"
              >
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
                Accept invitation
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </>
        )}
        {error && invite && (
          <p className="mt-4 text-sm text-destructive">{error}</p>
        )}
        <Link
          href="/workspaces"
          className="mt-5 block text-sm text-muted-foreground hover:text-foreground"
        >
          Go to workspaces
        </Link>
      </section>
    </main>
  );
}
