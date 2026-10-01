import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createInvitation,
  getWorkspaceForMember,
  initWorkspaceDB,
  normalizeEmail,
} from "@/lib/workspace-db";
import { getDB } from "@/lib/db";

export async function POST(
  req: Request,
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
  const creator = await getDB().execute({
    sql: `SELECT created_by FROM workspaces WHERE id=? LIMIT 1`,
    args: [workspaceId],
  });
  if (
    !creator.rows[0] ||
    normalizeEmail(String(creator.rows[0].created_by)) !==
      normalizeEmail(session.user.email)
  )
    return Response.json(
      { error: "Only the workspace creator can invite members" },
      { status: 403 },
    );
  const body = await req.json().catch(() => ({}));
  const inputEmails: unknown[] = Array.isArray(body.emails)
    ? body.emails
    : [body.email];
  const emails: string[] = [
    ...new Set(
      inputEmails
        .filter((v): v is string => typeof v === "string")
        .map(normalizeEmail),
    ),
  ].slice(0, 20);
  if (
    !emails.length ||
    emails.some((v) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
  )
    return Response.json(
      { error: "Enter one or more valid email addresses" },
      { status: 400 },
    );
  await initWorkspaceDB();
  const members = await getDB().execute({
    sql: `SELECT user_email FROM workspace_members WHERE workspace_id=?`,
    args: [workspaceId],
  });
  const memberEmails = new Set(members.rows.map((r) => String(r.user_email)));
  const invitations = [];
  const escapeHtml = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char]!,
    );
  for (const email of emails) {
    if (memberEmails.has(email)) continue;
    const token = await createInvitation(
      workspaceId,
      email,
      session.user.email,
    );
    const inviteOrigin = process.env.NEXTAUTH_URL || new URL(req.url).origin;
    const inviteUrl = new URL(`/invite/${token}`, inviteOrigin).toString();
    let sent = false;
    if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL,
            to: email,
            subject: `Invitation to ${workspace.name}`,
            html: `<p>${escapeHtml(session.user.name ?? session.user.email)} invited you to join <strong>${escapeHtml(workspace.name)}</strong> on Gluk.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This invitation expires in 7 days.</p>`,
          }),
        });
        sent = response.ok;
        if (!sent)
          console.error(
            "Workspace invitation email failed",
            await response.text(),
          );
      } catch (error) {
        console.error("Workspace invitation email request failed", error);
      }
    }
    invitations.push({ email, inviteUrl, sent });
  }
  return Response.json({ invitations });
}
