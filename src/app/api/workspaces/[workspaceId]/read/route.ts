import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWorkspaceForMember, markWorkspaceRead } from "@/lib/workspace-db";
import { broadcastReadCursor } from "@/lib/workspace-realtime";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  if (!(await getWorkspaceForMember(workspaceId, session.user.email))) return Response.json({ error: "Workspace not found" }, { status: 404 });
  const cursor = await markWorkspaceRead(workspaceId, session.user.email);
  try { await broadcastReadCursor(session.user.email, workspaceId); }
  catch (error) { console.error("Read cursor notification failed", error instanceof Error ? error.message : "unknown error"); }
  return Response.json(cursor);
}
