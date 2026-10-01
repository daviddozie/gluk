import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listWorkspaces, normalizeEmail } from "@/lib/workspace-db";
import { createWorkspaceRealtimeToken } from "@/lib/workspace-realtime";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const email = normalizeEmail(session.user.email);
    const workspaces = await listWorkspaces(email);
    const token = await createWorkspaceRealtimeToken(email, workspaces.map((workspace) => workspace.id));
    return Response.json({ token, email, name: session.user.name ?? email }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to issue workspace realtime token", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Workspace realtime is not configured" }, { status: 503 });
  }
}
