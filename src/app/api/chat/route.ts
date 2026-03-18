import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return new Response("Unauthorized", { status: 401 });
    }

    const { message, threadId, files } = await req.json();

    if (!message?.trim()) {
        return new Response("Message is required", { status: 400 });
    }

    // Search Pinecone for relevant document chunks
    let ragContext = "";
    if (threadId && session.user.email) {
        try {
            const { searchSimilarChunks } = await import("@/lib/vector-store");
            const chunks = await searchSimilarChunks(message, session.user.email, threadId);
            if (chunks.length > 0) {
                ragContext = `\n\n--- Relevant document context ---\n${chunks
                    .map((c) => `[From: ${c.fileName}]\n${c.text}`)
                    .join("\n\n")}\n--- End of document context ---\n`;
            }
        } catch (err) {
            console.error("RAG search error:", err);
        }
    }

    // Build message with RAG context + file references
    let fullMessage = message;
    if (ragContext) {
        fullMessage = `${message}\n${ragContext}`;
    }

    // Append image URLs if any images were uploaded
    const imageFiles = (files ?? []).filter((f: { type: string }) =>
        f.type?.startsWith("image/")
    );
    if (imageFiles.length > 0) {
        const imageList = imageFiles
            .map((f: { name: string; url: string }) => `- ${f.name}: ${f.url}`)
            .join("\n");
        fullMessage += `\n\nAttached images:\n${imageList}`;
    }

    // Lazy import Mastra
    const { mastra } = await import("@/mastra");
    const agent = mastra.getAgent("glukAgent");
    const resourceId = session.user.email ?? session.user.name ?? "anonymous";

    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    (async () => {
        try {
            const response = await agent.stream(fullMessage, {
                memory: {
                    thread: threadId,
                    resource: resourceId,
                },
            });

            for await (const chunk of response.textStream) {
                await writer.write(encoder.encode(chunk));
            }
        } catch (err) {
            console.error("Agent stream error:", err);
            await writer.write(
                encoder.encode("\n\nSorry, something went wrong. Please try again.")
            );
        } finally {
            await writer.close();
        }
    })();

    return new Response(readable, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Transfer-Encoding": "chunked",
        },
    });
}