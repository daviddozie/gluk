import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDB, saveUserResources } from "@/lib/db";
import { getOrProcessResourceDocument, selectReferenceContext } from "@/lib/document-processor";
import {
  addWorkspaceResource,
  getWorkspaceForMember,
  getWorkspaceMessageByClientId,
  insertWorkspaceMessage,
  listWorkspaceMessages,
  listWorkspaceMessagesSince,
  type StoredWorkspaceMessageAttachment,
} from "@/lib/workspace-db";
import { after } from "next/server";
import { broadcastWorkspaceMessage, createWorkspaceRealtimeBroadcaster } from "@/lib/workspace-realtime";
import { mastra } from "@/mastra";
import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { put } from "@vercel/blob";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  if (!(await getWorkspaceForMember(workspaceId, session.user.email)))
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  const url = new URL(req.url);
  const createdAt = url.searchParams.get("createdAt");
  const id = url.searchParams.get("id");
  const cursor = createdAt && id ? { createdAt, id } : null;
  return Response.json(cursor ? await listWorkspaceMessagesSince(workspaceId, cursor, session.user.email) : await listWorkspaceMessages(workspaceId, session.user.email));
}

export async function POST(req: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = await params;
  const workspace = await getWorkspaceForMember(workspaceId, session.user.email);
  if (!workspace) return Response.json({ error: "Workspace not found" }, { status: 404 });
  let content = "";
  let clientMessageId = "";
  let replyToId: string | null = null;
  let files: File[] = [];
  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return Response.json({ error: "Could not read message attachments" }, { status: 400 });
    content = typeof form.get("content") === "string" ? String(form.get("content")).trim() : "";
    clientMessageId = typeof form.get("clientMessageId") === "string" ? String(form.get("clientMessageId")) : "";
    const reply = form.get("replyToId");
    replyToId = reply == null || reply === "" ? null : typeof reply === "string" ? reply : "invalid";
    files = form.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
  } else {
    const body = await req.json().catch(() => ({}));
    content = typeof body.content === "string" ? body.content.trim() : "";
    clientMessageId = typeof body.clientMessageId === "string" ? body.clientMessageId : "";
    replyToId = body.replyToId == null ? null : typeof body.replyToId === "string" ? body.replyToId : "invalid";
  }
  if ((!content && !files.length) || content.length > 10000 || !/^[\w-]{8,100}$/.test(clientMessageId))
    return Response.json({ error: "Enter a message, attach a file, and provide a valid clientMessageId" }, { status: 400 });
  if (files.length > 10 || files.some((file) => file.size > 50 * 1024 * 1024) || files.reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024)
    return Response.json({ error: "Attach up to 10 files with a combined size of 50 MB or less." }, { status: 413 });
  if (replyToId === "invalid" || (replyToId && !/^[\w-]{8,100}$/.test(replyToId)))
    return Response.json({ error: "The reply target is invalid" }, { status: 400 });
  const existing = await getWorkspaceMessageByClientId(workspaceId, session.user.email, clientMessageId);
  if (existing) return Response.json(existing, { status: 200 });
  const storedAttachments: StoredWorkspaceMessageAttachment[] = [];
  if (files.length) {
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
    const useVercelBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
    try {
      for (const file of files) {
        const id = randomUUID();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const pathname = `gluk/workspaces/${workspaceId}/messages/${id}-${safeName}`;
        let storageUrl: string;
        if (useVercelBlob) {
          const blob = await put(pathname, file, { access: "public", contentType: file.type || "application/octet-stream", token: process.env.BLOB_READ_WRITE_TOKEN });
          storageUrl = blob.url;
        } else {
          const bytes = Buffer.from(await file.arrayBuffer());
          const dataUri = `data:${file.type || "application/octet-stream"};base64,${bytes.toString("base64")}`;
          const result = await cloudinary.uploader.upload(dataUri, { folder: `gluk/workspaces/${workspaceId}/messages`, resource_type: file.type.startsWith("image/") ? "image" : "raw", public_id: id });
          storageUrl = result.secure_url;
        }
        storedAttachments.push({ id, name: file.name.slice(0, 255), type: file.type || "application/octet-stream", size: file.size, storageUrl });
      }
    } catch (error) {
      console.error("Workspace chat attachment upload failed", error instanceof Error ? error.message : "unknown error");
      return Response.json({ error: "One or more files could not be uploaded. Please try again." }, { status: 502 });
    }
  }
  let result: Awaited<ReturnType<typeof insertWorkspaceMessage>>;
  try {
    result = await insertWorkspaceMessage(workspaceId, session.user.email, session.user.name ?? session.user.email, "user", content, clientMessageId, undefined, replyToId, storedAttachments);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Reply target"))
      return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
  const { message, inserted } = result;
  if (inserted) {
    if (storedAttachments.length) {
      const useVercelBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
      await saveUserResources(
        session.user.email,
        storedAttachments.map((att) => ({
          name: att.name,
          type: att.type,
          url: att.storageUrl,
          storage: useVercelBlob ? "vercel-blob" : "cloudinary",
          publicId: att.id,
        })),
      ).catch((err) => {
        console.error("Failed to save user resources from chat attachment", err);
      });

      for (const att of storedAttachments) {
        try {
          await addWorkspaceResource(
            workspaceId,
            null,
            { name: att.name, type: att.type, url: att.storageUrl },
            session.user.email,
          );
        } catch (resourceErr) {
          console.error("Failed to add uploaded chat attachment to workspace resources", resourceErr);
        }
      }
    }
    try { await broadcastWorkspaceMessage(workspaceId, message); }
    catch (error) { console.error("Workspace realtime broadcast failed", error instanceof Error ? error.message : "unknown error"); }
  }
  if (inserted && /(^|\s)@gluk\b/i.test(content)) {
    after(async () => {
      const assistantMessageId = `gluk-reply-${message.id}`;
      const createdAt = new Date().toISOString();
      let broadcaster: ReturnType<typeof createWorkspaceRealtimeBroadcaster> | undefined;
      const publish = async (event: string, payload: unknown) => {
        try {
          await broadcaster?.send(event, payload);
        } catch (error) {
          console.error("Workspace assistant stream broadcast failed", error instanceof Error ? error.message : "unknown error");
        }
      };
      try {
        broadcaster = createWorkspaceRealtimeBroadcaster(workspaceId);
        await publish("assistant_stream", {
          type: "start",
          id: assistantMessageId,
          createdAt,
          clientMessageId: assistantMessageId,
          requestClientMessageId: message.clientMessageId,
          userEmail: "gluk@system.local",
          userName: "Gluk",
          role: "assistant",
          content: "",
        });
        const db = getDB();
        const [history, projectsResult, resourcesResult] = await Promise.all([
          listWorkspaceMessages(workspaceId).then((m) => m.slice(-30)),
          db.execute({
            sql: `SELECT id, name, description, created_by, created_at FROM workspace_projects WHERE workspace_id=?`,
            args: [workspaceId],
          }),
          db.execute({
            sql: `SELECT id, project_id, name, type, url FROM workspace_resources WHERE workspace_id=?`,
            args: [workspaceId],
          }),
        ]);
        const projectSummaries = projectsResult.rows.map((r) => {
          const projectResources = resourcesResult.rows.filter((res) => res.project_id === r.id);
          return `- Project "${r.name}": ${r.description || "No description provided."} (Attached resources: ${
            projectResources.length ? projectResources.map((res) => String(res.name)).join(", ") : "None uploaded yet"
          })`;
        }).join("\n");
        const generalResources = resourcesResult.rows
          .filter((res) => !res.project_id)
          .map((res) => `- ${res.name} (${res.type})`)
          .join("\n");

        // Identify workspace resources referenced in the message or conversation context
        const messageText = `${content} ${message.replyTo?.content || ""}`.toLowerCase();
        const candidateResources: typeof resourcesResult.rows = [];

        for (const row of resourcesResult.rows) {
          const resourceName = String(row.name).toLowerCase();
          const nameWithoutExt = resourceName.replace(/\.[^/.]+$/, "");
          const tagWithAt = `@${resourceName}`;
          const tagWithoutExt = `@${nameWithoutExt}`;

          if (
            messageText.includes(tagWithAt) ||
            messageText.includes(tagWithoutExt) ||
            messageText.includes(resourceName) ||
            (nameWithoutExt.length >= 4 && messageText.includes(nameWithoutExt))
          ) {
            candidateResources.push(row);
          }
        }

        // If no specific resource was matched by name, but the query asks about documents/files/PRD/specs
        if (
          candidateResources.length === 0 &&
          /\b(document|doc|prd|file|spec|requirements|pdf|attached|uploaded|responsibilities)\b/i.test(content)
        ) {
          if (resourcesResult.rows.length <= 2) {
            candidateResources.push(...resourcesResult.rows);
          }
        }

        const documentContextBlocks: string[] = [];
        for (const res of candidateResources.slice(0, 3)) {
          try {
            const url = String(res.url);
            const fileName = String(res.name);
            const mimeType = String(res.type || "application/octet-stream");
            if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/") && !mimeType.startsWith("audio/")) {
              const doc = await getOrProcessResourceDocument(url, fileName, mimeType);
              if (doc && doc.text) {
                const excerpt = selectReferenceContext(doc.chunks, content, 24_000) || doc.text.slice(0, 24_000);
                documentContextBlocks.push(
                  `--- ATTACHED WORKSPACE DOCUMENT: "${fileName}" ---\n${excerpt}\n--- END OF ATTACHED DOCUMENT "${fileName}" ---`
                );
              }
            }
          } catch (docErr) {
            console.error(`Failed to extract text for workspace resource ${res.name}:`, docErr);
          }
        }

        const workspaceContext = `Workspace: "${workspace.name}"
${workspace.description ? `Description: "${workspace.description}"` : ""}

Workspace Projects:
${projectSummaries || "No projects created yet."}

General Workspace Resources (not tied to a specific project):
${generalResources || "No general resources uploaded yet."}
${documentContextBlocks.length > 0 ? `\nAuthoritative Attached Document Contents:\n${documentContextBlocks.join("\n\n")}` : ""}`;
        const context = history.map((item) => `${item.role === "assistant" ? "Gluk" : item.userName}${item.replyTo ? ` (replying to ${item.replyTo.userName}: "${item.replyTo.content.slice(0, 400)}")` : ""}: ${item.content}`).join("\n");
        const prompt = `You are Gluk, the collaborative AI assistant participating in the shared workspace "${workspace.name}". Reply accurately and helpfully to the latest message. Everyone can see your answer.

${workspaceContext}

CRITICAL ACCURACY GUIDELINES:
- Ground your responses strictly in the workspace context and any attached document contents provided above.
- When an attached document's contents are provided under "Authoritative Attached Document Contents", treat them as the single authoritative source of truth for questions regarding that document, project scope, requirements, roles, deliverables, or timelines.
- DO NOT call external web search tools for workspace documents, filenames, or internal project specifications. The document text is already extracted and provided to you above.
- If asked about responsibilities, features, requirements, or architecture based on a document (such as a PRD), cite specific sections, numbered requirements (e.g. FR-01 to FR-09), user roles, and delivery phases directly from the document text.
- If a project currently has no attached resources or additional documentation, state that fact clearly.
- DO NOT invent, hallucinate, or assume hypothetical technology stacks, timelines, or features that were not specified by the workspace members or present in the document.

Recent workspace chat:
${context}`;
        const answer = await mastra.getAgent("glukAgent").stream(prompt, { maxSteps: 5, modelSettings: { maxOutputTokens: 2048 } });
        let text = "";
        let pendingDelta = "";
        let lastSentAt = Date.now();
        for await (const delta of answer.textStream) {
          text += delta;
          pendingDelta += delta;
          if (pendingDelta.length >= 80 || Date.now() - lastSentAt >= 200) {
            await publish("assistant_stream", { type: "delta", id: assistantMessageId, delta: pendingDelta });
            pendingDelta = "";
            lastSentAt = Date.now();
          }
        }
        if (pendingDelta) await publish("assistant_stream", { type: "delta", id: assistantMessageId, delta: pendingDelta });
        text = text.trim();
        if (!text) {
          await publish("assistant_stream", { type: "error", id: assistantMessageId, requestClientMessageId: message.clientMessageId, content: "Gluk couldn't finish that response. Please try mentioning Gluk again." });
          return;
        }
        const reply = await insertWorkspaceMessage(workspaceId, "gluk@system.local", "Gluk", "assistant", text, assistantMessageId, assistantMessageId, message.id);
        if (reply.inserted) await broadcastWorkspaceMessage(workspaceId, reply.message);
      } catch (error) {
        console.error("Workspace Gluk reply failed", error instanceof Error ? error.message : "unknown error");
        await publish("assistant_stream", {
          type: "error",
          id: assistantMessageId,
          requestClientMessageId: message.clientMessageId,
          content: "Gluk couldn't finish that response. Please try mentioning Gluk again.",
        });
      } finally {
        if (broadcaster) await broadcaster.close();
      }
    });
  }
  return Response.json(message, { status: inserted ? 201 : 200 });
}
