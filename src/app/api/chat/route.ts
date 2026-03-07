import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mastra } from "@/mastra";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return new Response("Unauthorized", { status: 401 });
    }

    const { message, threadId } = await req.json();

    if (!message?.trim()) {
        return new Response("Message is required", { status: 400 });
    }

    const agent = mastra.getAgent("glukAgent");
    const resourceId = session.user.email ?? session.user.name ?? "anonymous";

    const encoder = new TextEncoder();

    // Use TransformStream to flush each chunk immediately to the client
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Start streaming in background — don't await so response returns immediately
    (async () => {
        try {
            const response = await agent.stream(message, {
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
            await writer.write(encoder.encode("\n\nSorry, something went wrong. Please try again."));
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