import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";
import { put } from "@vercel/blob";
import { NextRequest } from "next/server";
import { getDB, saveUserResources } from "@/lib/db";
import {
  addWorkspaceResource,
  getWorkspaceForMember,
  initWorkspaceDB,
} from "@/lib/workspace-db";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_REQUEST_BYTES = 55 * 1024 * 1024;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedWorkspaceId = new URL(req.url).searchParams.get("workspaceId");
  if (
    requestedWorkspaceId &&
    !(await getWorkspaceForMember(requestedWorkspaceId, session.user.email))
  ) {
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  }

  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return Response.json(
      { error: "Each upload must be 50 MB or smaller." },
      { status: 413 },
    );
  }

  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return Response.json(
        {
          error:
            "Could not read the upload. Check the file size and try again.",
        },
        { status: 400 },
      );
    }
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);
    const conversationId = formData.get("conversationId");
    const formWorkspaceId = formData.get("workspaceId");
    if (
      requestedWorkspaceId &&
      formWorkspaceId &&
      formWorkspaceId !== requestedWorkspaceId
    ) {
      return Response.json({ error: "Workspace mismatch" }, { status: 400 });
    }
    const workspaceId = requestedWorkspaceId ?? formWorkspaceId;
    const projectId = formData.get("projectId");

    if (!files.length) {
      return Response.json({ error: "No files provided" }, { status: 400 });
    }
    if (files.some((file) => file.size > MAX_UPLOAD_BYTES)) {
      return Response.json(
        { error: "Each upload must be 50 MB or smaller." },
        { status: 413 },
      );
    }

    const userEmail = session.user.email;
    if (
      typeof workspaceId === "string" &&
      !(await getWorkspaceForMember(workspaceId, userEmail))
    ) {
      return Response.json({ error: "Workspace not found" }, { status: 404 });
    }
    if (typeof projectId === "string" && typeof workspaceId !== "string") {
      return Response.json(
        { error: "A workspace is required for a project resource" },
        { status: 400 },
      );
    }
    if (typeof projectId === "string" && projectId) {
      await initWorkspaceDB();
      const project = await getDB().execute({
        sql: `SELECT id FROM workspace_projects WHERE id=? AND workspace_id=?`,
        args: [projectId, workspaceId as string],
      });
      if (!project.rows.length)
        return Response.json({ error: "Project not found" }, { status: 404 });
    }
    const useVercelBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

    const uploaded = await Promise.all(
      files.map(async (file) => {
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const pathName = `gluk/${typeof workspaceId === "string" ? `workspaces/${workspaceId}` : userEmail}/${Date.now()}-${sanitizedName}`;

        if (useVercelBlob) {
          const blob = await put(pathName, file, {
            access: "public",
            contentType: file.type || "application/octet-stream",
            token: process.env.BLOB_READ_WRITE_TOKEN,
          });

          return {
            name: file.name,
            type: file.type,
            url: blob.url,
            downloadUrl: blob.downloadUrl || blob.url,
            publicId: blob.pathname,
            storage: "vercel-blob",
          };
        }

        // Fallback to Cloudinary if BLOB_READ_WRITE_TOKEN is not configured
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64 = buffer.toString("base64");
        const dataUri = `data:${file.type};base64,${base64}`;
        const isImage = file.type.startsWith("image/");

        const result = await cloudinary.uploader.upload(dataUri, {
          folder: `gluk/${typeof workspaceId === "string" ? `workspaces/${workspaceId}` : userEmail}`,
          resource_type: isImage ? "image" : "raw",
          public_id: `${Date.now()}-${sanitizedName}`,
        });

        return {
          name: file.name,
          type: file.type,
          url: result.secure_url,
          downloadUrl: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          storage: "cloudinary",
        };
      }),
    );

    await saveUserResources(
      userEmail,
      uploaded.map((file) => ({
        name: file.name,
        type: file.type,
        url: file.url,
        storage: file.storage,
        publicId: file.publicId,
        resourceType: "resourceType" in file ? file.resourceType : undefined,
        conversationId:
          typeof conversationId === "string" ? conversationId : undefined,
      })),
    );

    if (typeof workspaceId === "string") {
      for (const file of uploaded) {
        await addWorkspaceResource(
          workspaceId,
          typeof projectId === "string" && projectId ? projectId : null,
          { name: file.name, type: file.type, url: file.url },
          userEmail,
        );
      }
    }

    return Response.json({ files: uploaded });
  } catch (err) {
    console.error("Upload error:", err);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
