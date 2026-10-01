import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWorkspaceForMember, getWorkspaceMessageAttachment } from "@/lib/workspace-db";

export const runtime = "nodejs";

function getMimeType(fileName: string, explicitType?: string | null, upstreamType?: string | null): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "txt") return "text/plain";
  if (ext === "csv") return "text/csv";
  if (ext === "json") return "application/json";
  if (ext === "md") return "text/markdown";

  if (explicitType && explicitType !== "application/octet-stream" && explicitType !== "raw") {
    return explicitType.split(";")[0].toLowerCase();
  }
  if (upstreamType && upstreamType !== "application/octet-stream" && upstreamType !== "raw") {
    return upstreamType.split(";")[0].toLowerCase();
  }
  return "application/octet-stream";
}

export async function GET(_req: Request, { params }: { params: Promise<{ workspaceId: string; messageId: string; attachmentId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId, messageId, attachmentId } = await params;
  if (!(await getWorkspaceForMember(workspaceId, session.user.email))) return Response.json({ error: "Attachment not found" }, { status: 404 });
  const attachment = await getWorkspaceMessageAttachment(workspaceId, messageId, attachmentId);
  if (!attachment) return Response.json({ error: "Attachment not found" }, { status: 404 });
  let url: URL;
  try { url = new URL(attachment.storageUrl); } catch { return Response.json({ error: "Attachment unavailable" }, { status: 502 }); }
  if (url.protocol !== "https:" || !(url.hostname === "res.cloudinary.com" || url.hostname.endsWith(".public.blob.vercel-storage.com")))
    return Response.json({ error: "Unsupported attachment storage" }, { status: 502 });
  const upstream = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000) });
  if (!upstream.ok || !upstream.body) return Response.json({ error: "Could not load attachment" }, { status: 502 });
  const fileName = String(attachment.name);
  const contentType = getMimeType(
    fileName,
    attachment.type ? String(attachment.type) : null,
    upstream.headers.get("content-type"),
  );
  const inline =
    contentType.startsWith("image/") ||
    contentType === "application/pdf" ||
    contentType === "text/plain" ||
    contentType === "text/csv" ||
    contentType === "text/markdown";
  return new Response(upstream.body, { headers: {
    "Content-Type": contentType,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fileName.replace(/[\r\n"\\]/g, "_")}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Content-Security-Policy": "frame-ancestors 'self'",
  } });
}
