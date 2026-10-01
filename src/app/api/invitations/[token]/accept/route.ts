import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { acceptInvitation, getInvitation } from "@/lib/workspace-db";
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return Response.json(
      { error: "Sign in to accept this invitation" },
      { status: 401 },
    );
  const { token } = await params;
  const invitation = await getInvitation(token);
  if (!invitation)
    return Response.json(
      { error: "This invitation is invalid or expired" },
      { status: 404 },
    );
  if (invitation.email !== session.user.email.trim().toLowerCase())
    return Response.json(
      { error: `Sign in as ${invitation.email} to accept this invitation` },
      { status: 403 },
    );
  const accepted = await acceptInvitation(
    token,
    session.user.email,
    session.user.name ?? session.user.email,
    session.user.image ?? null,
  );
  return accepted
    ? Response.json({ workspaceId: invitation.workspaceId })
    : Response.json({ error: "Invitation was already used" }, { status: 409 });
}
