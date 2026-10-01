import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDB } from "@/lib/db";
import { getUserResourceForChat } from "@/lib/db";
import { getWorkspaceForMember, initWorkspaceDB } from "@/lib/workspace-db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  if (!(await getWorkspaceForMember(workspaceId, session.user.email)))
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  await initWorkspaceDB();
  const result = await getDB().execute({
    sql: `SELECT id,project_id,name,type,url,shared_by,created_at FROM workspace_resources WHERE workspace_id=? ORDER BY created_at DESC`,
    args: [workspaceId],
  });
  return Response.json(
    result.rows.map((r) => ({
      id: String(r.id),
      projectId: r.project_id ? String(r.project_id) : null,
      name: String(r.name),
      type: String(r.type),
      url: `/api/workspaces/${workspaceId}/resources/${r.id}/file`,
      sourceUrl: String(r.url),
      sharedBy: String(r.shared_by),
      createdAt: String(r.created_at),
    })),
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  if (!(await getWorkspaceForMember(workspaceId, session.user.email)))
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.url !== "string")
    return Response.json(
      { error: "Choose a resource from your library" },
      { status: 400 },
    );
  const owned = await getUserResourceForChat(session.user.email, body.url);
  if (!owned)
    return Response.json({ error: "Resource not found" }, { status: 404 });
  await initWorkspaceDB();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const projectId = typeof body.projectId === "string" && body.projectId.trim() ? body.projectId.trim() : null;
  if (projectId) {
    const p = await getDB().execute({
      sql: `SELECT id FROM workspace_projects WHERE id=? AND workspace_id=?`,
      args: [projectId, workspaceId],
    });
    if (!p.rows.length)
      return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const existing = await getDB().execute({
    sql: `SELECT id FROM workspace_resources WHERE workspace_id=? AND url=?`,
    args: [workspaceId, owned.url],
  });
  if (existing.rows.length > 0) {
    const existingId = String(existing.rows[0].id);
    await getDB().execute({
      sql: `UPDATE workspace_resources SET project_id=? WHERE id=? AND workspace_id=?`,
      args: [projectId, existingId, workspaceId],
    });
    return Response.json({
      id: existingId,
      projectId,
      name: owned.name,
      type: owned.type,
      url: `/api/workspaces/${workspaceId}/resources/${existingId}/file`,
      sourceUrl: owned.url,
      createdAt,
    });
  }

  await getDB().execute({
    sql: `INSERT INTO workspace_resources(id,workspace_id,project_id,name,type,url,shared_by,created_at) VALUES(?,?,?,?,?,?,?,?)`,
    args: [
      id,
      workspaceId,
      projectId,
      owned.name,
      owned.type,
      owned.url,
      session.user.email.trim().toLowerCase(),
      createdAt,
    ],
  });
  return Response.json(
    {
      id,
      projectId,
      name: owned.name,
      type: owned.type,
      url: `/api/workspaces/${workspaceId}/resources/${id}/file`,
      sourceUrl: owned.url,
      createdAt,
    },
    { status: 201 },
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  if (!(await getWorkspaceForMember(workspaceId, session.user.email)))
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const resourceId = typeof body.resourceId === "string" ? body.resourceId : "";
  const projectId = typeof body.projectId === "string" && body.projectId.trim() ? body.projectId.trim() : null;
  if (!resourceId)
    return Response.json({ error: "resourceId is required" }, { status: 400 });
  await initWorkspaceDB();
  if (projectId) {
    const p = await getDB().execute({
      sql: `SELECT id FROM workspace_projects WHERE id=? AND workspace_id=?`,
      args: [projectId, workspaceId],
    });
    if (!p.rows.length)
      return Response.json({ error: "Project not found" }, { status: 404 });
  }
  await getDB().execute({
    sql: `UPDATE workspace_resources SET project_id=? WHERE id=? AND workspace_id=?`,
    args: [projectId, resourceId, workspaceId],
  });
  return Response.json({ success: true, resourceId, projectId });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  if (!(await getWorkspaceForMember(workspaceId, session.user.email)))
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const resourceId = typeof body.resourceId === "string" ? body.resourceId : "";
  if (!resourceId)
    return Response.json({ error: "resourceId is required" }, { status: 400 });
  await initWorkspaceDB();
  await getDB().execute({
    sql: `DELETE FROM workspace_resources WHERE id=? AND workspace_id=?`,
    args: [resourceId, workspaceId],
  });
  return Response.json({ success: true, resourceId });
}


