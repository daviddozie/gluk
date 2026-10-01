import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDB } from "@/lib/db";
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
    sql: `SELECT id,name,description,created_by,created_at FROM workspace_projects WHERE workspace_id=? ORDER BY created_at DESC`,
    args: [workspaceId],
  });
  return Response.json(
    result.rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      description: r.description ? String(r.description) : "",
      createdBy: String(r.created_by),
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
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 100)
    return Response.json(
      { error: "Project name must be between 1 and 100 characters" },
      { status: 400 },
    );
  await initWorkspaceDB();
  const project = {
    id: crypto.randomUUID(),
    name,
    description:
      typeof body.description === "string"
        ? body.description.slice(0, 500)
        : "",
    createdAt: new Date().toISOString(),
  };
  await getDB().execute({
    sql: `INSERT INTO workspace_projects(id,workspace_id,name,description,created_by,created_at) VALUES(?,?,?,?,?,?)`,
    args: [
      project.id,
      workspaceId,
      name,
      project.description,
      session.user.email.trim().toLowerCase(),
      project.createdAt,
    ],
  });
  return Response.json(project, { status: 201 });
}
