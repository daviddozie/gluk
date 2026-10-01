import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createWorkspace, listWorkspaces } from "@/lib/workspace-db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listWorkspaces(session.user.email));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 80)
    return Response.json(
      { error: "Workspace name must be between 1 and 80 characters" },
      { status: 400 },
    );
  const description =
    typeof body.description === "string" ? body.description.slice(0, 500) : "";
  const workspace = await createWorkspace(
    session.user.email,
    session.user.name ?? session.user.email,
    name,
    description,
    session.user.image ?? null,
  );
  return Response.json(workspace, { status: 201 });
}
