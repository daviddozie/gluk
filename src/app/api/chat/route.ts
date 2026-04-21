import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

function isResearchQuery(message: string): boolean {
    const lower = message.toLowerCase();

    // If the user is clearly asking about an uploaded file, skip research mode —
    // RAG will answer it without any web search needed.
    const fileKeywords = [
        "in the file", "in the document", "based on the doc", "in the pdf", "in the csv",
        "from the file", "from the document", "uploaded", "attached",
        "the file says", "according to the file", "based on the file",
        "list of", "show me the", "summarize the file", "summarise this file",
    ];
    if (fileKeywords.some((kw) => lower.includes(kw))) return false;

    const researchKeywords = [
        "research", "investigate", "analyse", "analyze", "deep dive",
        "comprehensive", "in-depth", "compare", "explain in detail",
        "pros and cons", "advantages and disadvantages",
        "history of", "overview of", "latest on", "what is the current",
        "find information", "gather data", "survey", "report on",
    ];
    
    return researchKeywords.some((kw) => lower.includes(kw));
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return new Response("Unauthorized", { status: 401 });
    }

    const userEmail = session.user.email ?? session.user.name ?? "anonymous";

    const { message, threadId, files, useResearch } = await req.json();

    if (!message?.trim()) {
        return new Response("Message is required", { status: 400 });
    }

    // Search Pinecone for relevant document chunks (RAG)
    let ragContext = "";
    if (threadId) {
        try {
            const { searchSimilarChunks } = await import("@/lib/vector-store");
            const chunks = await searchSimilarChunks(message, threadId);
            if (chunks.length > 0) {
                ragContext = `\n\n--- Relevant document context ---\n${chunks
                    .map((c) => `[From: ${c.fileName} | relevance: ${(c.score * 100).toFixed(0)}%]\n${c.text}`)
                    .join("\n\n")}\n--- End of document context ---\n`;
            }
        } catch (err) {
            console.error("RAG search error:", err);
        }
    }

    // Append image URLs if any images were uploaded
    const imageFiles = (files ?? []).filter((f: { type: string }) =>
        f.type?.startsWith("image/")
    );
    let fullMessage = message;
    if (ragContext) fullMessage = `${message}\n${ragContext}`;
    if (imageFiles.length > 0) {
        const imageList = imageFiles
            .map((f: { name: string; url: string }) => `- ${f.name}: ${f.url}`)
            .join("\n");
        fullMessage += `\n\nAttached images:\n${imageList}`;
    }

    const { mastra } = await import("@/mastra");
    const agent = mastra.getAgent("glukAgent");

    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    const hasRagContext = ragContext.length > 0;
    const isFileQuestion =
        useResearch === false ||
        (hasRagContext && !isResearchQuery(message) && useResearch !== true);

    const shouldUseResearch =
        !isFileQuestion && (useResearch === true || (useResearch !== false && isResearchQuery(message)));

    (async () => {
        try {
            if (isFileQuestion && hasRagContext) {
                await streamAgent(agent, fullMessage, threadId, userEmail, writer, encoder);
            } else if (shouldUseResearch) {

                await writer.write(encoder.encode("🔍 *Starting deep research…*\n\n"));

                try {
                    const workflow = mastra.getWorkflow("researchWorkflow");
                    const run = await workflow.createRun();

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const result: any = await run.start({
                        inputData: {
                            query: message,
                            conversationId: threadId ?? "no-thread",
                            userEmail,
                            ragContext,
                        },
                    });

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const stepOutput: any =
                        result?.results?.synthesise?.output ??
                        result?.output;

                    if (stepOutput?.synthesis) {
                        
                        await writer.write(encoder.encode(stepOutput.synthesis));
                    } else {
                        // Workflow returned nothing useful — fall back to agent
                        await streamAgent(agent, fullMessage, threadId, userEmail, writer, encoder);
                    }
                } catch (workflowErr) {
                    console.error("Research workflow error, falling back to agent:", workflowErr);
                    await writer.write(
                        encoder.encode("*Research pipeline hit an issue — switching to direct agent mode.*\n\n")
                    );
                    await streamAgent(agent, fullMessage, threadId, userEmail, writer, encoder);
                }
            } else {
                // ── Standard agent mode ──
                await streamAgent(agent, fullMessage, threadId, userEmail, writer, encoder);
            }

        } catch (err) {
            console.error("Chat route error:", err);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function streamAgent(
    agent: any,
    message: string,
    threadId: string | undefined,
    resourceId: string,
    writer: WritableStreamDefaultWriter,
    encoder: TextEncoder
) {
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
    } catch (err: unknown) {
        // Surface rate-limit errors with a clear, actionable message
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
            await writer.write(
                encoder.encode(
                    " **Daily rate limit reached** — the free model allows 50 requests per day and today's quota is now used up.\n\n" +
                    "The limit resets at **midnight UTC**. You can also:\n" +
                    "- Add credits on [OpenRouter](https://openrouter.ai) to unlock 1 000 req/day\n" +
                    "- Switch to a different free model in your `.env.local` (`OPENROUTER_MODEL`)\n\n" +
                    "In the meantime, **uploaded documents are still searchable** — your files are stored and will be ready when the limit resets."
                )
            );
        } else {
            throw err; 
        }
    }
}
