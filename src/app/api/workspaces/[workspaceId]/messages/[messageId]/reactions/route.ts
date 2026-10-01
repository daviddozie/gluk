import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWorkspaceForMember, toggleWorkspaceMessageReaction } from "@/lib/workspace-db";
import { broadcastWorkspaceEvent } from "@/lib/workspace-realtime";

export async function POST(req: Request, { params }: { params: Promise<{ workspaceId: string; messageId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId, messageId } = await params;
  if (!(await getWorkspaceForMember(workspaceId, session.user.email))) return Response.json({ error: "Workspace not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const emoji = typeof body.emoji === "string" ? body.emoji : "";
  if (!emoji || emoji.length > 16 || !/\p{Extended_Pictographic}/u.test(emoji)) return Response.json({ error: "Choose a valid emoji reaction" }, { status: 400 });
  const reactions = await toggleWorkspaceMessageReaction(workspaceId, messageId, session.user.email, emoji);
  if (!reactions) return Response.json({ error: "Message not found" }, { status: 404 });
  try { await broadcastWorkspaceEvent(workspaceId, "reaction_state", { messageId, reactions, actorEmail: session.user.email.toLowerCase() }); }
  catch (error) { console.error("Workspace reaction broadcast failed", error instanceof Error ? error.message : "unknown error"); }
  return Response.json({ messageId, reactions });
}
