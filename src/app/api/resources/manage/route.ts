import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserResourceForDeletion, updateUserResource } from "@/lib/db";
import { del } from "@vercel/blob";
import { v2 as cloudinary } from "cloudinary";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        if (typeof body.url !== "string" || !body.url) {
            return Response.json({ error: "url is required" }, { status: 400 });
        }

        if (body.action === "rename" && typeof body.name === "string" && body.name.trim()) {
            await updateUserResource(session.user.email, body.url, { name: body.name.trim().slice(0, 200) });
        } else if (body.action === "folder" && (typeof body.folder === "string" || body.folder === null)) {
            const folder = typeof body.folder === "string" ? body.folder.trim().slice(0, 80) || null : null;
            await updateUserResource(session.user.email, body.url, { folder });
        } else if (body.action === "delete") {
            const resource = await getUserResourceForDeletion(session.user.email, body.url);
            if (!resource) return Response.json({ error: "Resource not found" }, { status: 404 });
            let storage = resource.storage;
            let publicId = resource.publicId;
            let resourceType = resource.resourceType;
            if (!storage) {
                try {
                    const parsedUrl = new URL(resource.url);
                    if (parsedUrl.hostname.endsWith(".blob.vercel-storage.com")) {
                        storage = "vercel-blob";
                    } else if (parsedUrl.hostname === "res.cloudinary.com") {
                        const match = parsedUrl.pathname.match(/\/(image|raw|video)\/upload\/(.+)$/);
                        if (match) {
                            storage = "cloudinary";
                            resourceType = match[1];
                            publicId = match[2].replace(/^v\d+\//, "");
                            if (resourceType === "image") publicId = publicId.replace(/\.[^.]+$/, "");
                        }
                    }
                } catch {
                    // Keep legacy resources removable from the library even if the URL is not recognized.
                }
            }
            if (storage === "vercel-blob") {
                await del(resource.url, { token: process.env.BLOB_READ_WRITE_TOKEN });
            } else if (storage === "cloudinary" && publicId) {
                cloudinary.config({
                    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                    api_key: process.env.CLOUDINARY_API_KEY,
                    api_secret: process.env.CLOUDINARY_API_SECRET,
                });
                await cloudinary.uploader.destroy(publicId, {
                    resource_type: resourceType ?? "raw",
                    invalidate: true,
                });
            }
            await updateUserResource(session.user.email, body.url, { deleted: true });
        } else {
            return Response.json({ error: "Invalid resource action" }, { status: 400 });
        }

        return Response.json({ success: true });
    } catch (err) {
        console.error("Failed to manage resource:", err);
        return Response.json({ error: "Failed to update resource" }, { status: 500 });
    }
}
