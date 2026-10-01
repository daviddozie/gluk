import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWorkspaceForMember, initWorkspaceDB } from "@/lib/workspace-db";
import { getDB } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  const workspace = await getWorkspaceForMember(
    workspaceId,
    session.user.email,
  );
  if (!workspace)
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  await initWorkspaceDB();
  if (session.user.image) {
    await getDB().execute({
      sql: `UPDATE workspace_members SET avatar_url=? WHERE workspace_id=? AND user_email=? AND (avatar_url IS NULL OR avatar_url!=?)`,
      args: [session.user.image, workspaceId, session.user.email.trim().toLowerCase(), session.user.image],
    });
  }
  const result = await getDB().execute({
    sql: `SELECT user_email,display_name,role,joined_at,avatar_url FROM workspace_members WHERE workspace_id=? ORDER BY role='owner' DESC,display_name COLLATE NOCASE`,
    args: [workspaceId],
  });
  return Response.json({
    ...workspace,
    members: result.rows.map((r) => ({
      email: String(r.user_email),
      name: String(r.display_name),
      role: String(r.role),
      joinedAt: String(r.joined_at),
      avatarUrl: r.avatar_url ? String(r.avatar_url) : null,
    })),
  });
}
