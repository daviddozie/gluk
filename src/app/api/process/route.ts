import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { processDocument } from "@/lib/document-processor";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

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

        const results = await Promise.all(
            files.map(async (file) => {
                const buffer = Buffer.from(await file.arrayBuffer());
                const processed = await processDocument(buffer, file.name, file.type);
                return {
                    name: processed.name,
                    type: processed.type,
                    text: processed.text,
                    chunks: processed.chunks,
                    chunkCount: processed.chunks.length,
                };
            })
        );

        return Response.json({ documents: results });
    } catch (err) {
        console.error("Processing error:", err);
        return Response.json(
            { error: err instanceof Error ? err.message : "Processing failed" },
            { status: 500 }
        );
    }
}