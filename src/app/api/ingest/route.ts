import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { processDocument } from "@/lib/document-processor";
import { storeDocumentChunks } from "@/lib/vector-store";
import { NextRequest } from "next/server";
import { nanoid } from "nanoid";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const files = formData.getAll("files") as File[];
        const conversationId = formData.get("conversationId") as string;

        if (!files.length) {
            return Response.json({ error: "No files provided" }, { status: 400 });
        }
        if (!conversationId) {
            return Response.json({ error: "conversationId required" }, { status: 400 });
        }

        const results = await Promise.all(
            files.map(async (file) => {
                // Skip images — they don't need RAG
                if (file.type.startsWith("image/")) {
                    return { name: file.name, chunks: 0, skipped: true };
                }

                const buffer = Buffer.from(await file.arrayBuffer());
                const processed = await processDocument(buffer, file.name, file.type);

                // Build chunk objects for Pinecone
                const chunks = processed.chunks.map((text, i) => ({
                    id: `${nanoid()}-${i}`,
                    text,
                    fileName: file.name,
                    fileType: file.type,
                    userEmail: session.user!.email!,
                    conversationId,
                    chunkIndex: i,
                }));

                await storeDocumentChunks(chunks);

                return {
                    name: file.name,
                    chunks: chunks.length,
                    skipped: false,
                };
            })
        );

        return Response.json({ success: true, files: results });
    } catch (err) {
        console.error("Ingest error:", err);
        return Response.json(
            { error: err instanceof Error ? err.message : "Ingest failed" },
            { status: 500 }
        );
    }
}