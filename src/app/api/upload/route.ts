import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { v2 as cloudinary } from "cloudinary";
import { NextRequest } from "next/server";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const files = formData.getAll("files") as File[];

        if (!files.length) {
            return Response.json({ error: "No files provided" }, { status: 400 });
        }

        const uploaded = await Promise.all(
            files.map(async (file) => {
                const bytes = await file.arrayBuffer();
                const buffer = Buffer.from(bytes);
                const base64 = buffer.toString("base64");
                const dataUri = `data:${file.type};base64,${base64}`;

                const isImage = file.type.startsWith("image/");

                const result = await cloudinary.uploader.upload(dataUri, {
                    folder: `gluk/${session.user!.email}`,
                    resource_type: isImage ? "image" : "raw",
                    public_id: `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
                });

                return {
                    name: file.name,
                    type: file.type,
                    url: result.secure_url,
                    publicId: result.public_id,
                    resourceType: result.resource_type,
                };
            })
        );

        return Response.json({ files: uploaded });
    } catch (err) {
        console.error("Upload error:", err);
        return Response.json({ error: "Upload failed" }, { status: 500 });
    }
}