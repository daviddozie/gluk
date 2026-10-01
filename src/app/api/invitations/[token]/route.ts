import { getInvitation } from "@/lib/workspace-db";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const invitation = await getInvitation(token);
  if (!invitation)
    return Response.json(
      { error: "This invitation is invalid or expired" },
      { status: 404 },
    );
  return Response.json({
    email: invitation.email,
    workspaceName: invitation.name,
  });
}
