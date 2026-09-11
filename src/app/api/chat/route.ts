import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

function isResearchQuery(message: string): boolean {
    const lower = message.toLowerCase();

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
                let inWorkflowThink = true;
                await writer.write(encoder.encode("<think>\n🔍 Initializing deep research pipeline…\n"));

                try {
                    const workflow = mastra.getWorkflow("researchWorkflow");
                    const run = await workflow.createRun();

                    // Watch for step completions and stream progress in real-time
                    run.watch((event: any) => {
                        if (
                            event.type === "workflow-step-result" &&
                            event.payload?.output?.progress
                        ) {
                            writer
                                .write(encoder.encode(`${event.payload.output.progress}\n`))
                                .catch(() => {});
                        }
                    });

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
                        if (inWorkflowThink) {
                            inWorkflowThink = false;
                            await writer.write(encoder.encode("</think>\n\n"));
                        }
                        await writer.write(encoder.encode(stepOutput.synthesis));

                        if (stepOutput?.confidence) {
                            const confidenceLine = `\n\n---\n*Confidence: ${stepOutput.confidence.level.toUpperCase()} — ${stepOutput.confidence.note}*`;
                            await writer.write(encoder.encode(confidenceLine));
                        }
                    } else {
                        if (inWorkflowThink) {
                            inWorkflowThink = false;
                            await writer.write(encoder.encode("</think>\n\n"));
                        }
                        // Workflow returned nothing useful — fall back to agent
                        await streamAgent(agent, fullMessage, threadId, userEmail, writer, encoder);
                    }
                } catch (workflowErr) {
                    console.error("Research workflow error, falling back to agent:", workflowErr);
                    if (inWorkflowThink) {
                        inWorkflowThink = false;
                        await writer.write(encoder.encode("</think>\n\n"));
                    }
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
    let inThinkBlock = true;
    try {
        // Send initial immediate thinking state so the UI reacts instantly
        await writer.write(encoder.encode("<think>\n🧠 Analyzing request and formulating strategy…\n"));

        const response = await agent.stream(message, {
            maxSteps: 5,
            memory: {
                thread: threadId,
                resource: resourceId,
            },
            modelSettings: {
                maxOutputTokens: 2048,
            },
            onStepFinish: async (step: any) => {
                if (step.toolCalls && step.toolCalls.length > 0) {
                    for (const tc of step.toolCalls) {
                        const toolName = tc.payload?.toolName || tc.toolName || "";
                        const args = tc.payload?.args || tc.args || {};
                        let label = "";

                        if (toolName === "webSearchTool" || toolName === "web_search") {
                            label = args.query ? `🔍 Searching web: "${args.query}"` : `🔍 Searching web…`;
                        } else if (toolName === "webFetchTool" || toolName === "web_fetch") {
                            label = args.url ? `🌐 Deep reading: ${args.url}` : `🌐 Reading web page…`;
                        } else if (toolName === "sourceRerankTool" || toolName === "source_rerank") {
                            label = `📊 Reranking sources for relevance and credibility…`;
                        } else if (toolName === "exportReportTool" || toolName === "export_report") {
                            label = `📥 Generating and exporting report (${args.format || "csv"})…`;
                        } else if (toolName === "saveDigestTool" || toolName === "save_research_digest") {
                            label = `💾 Saving research digest to database…`;
                        } else if (toolName === "sendWebhookTool" || toolName === "send_webhook") {
                            label = `📡 Dispatching webhook notification to: ${args.url || "endpoint"}`;
                        } else if (toolName === "askFactCheckerTool" || toolName === "consult_fact_checker") {
                            label = `🕵️ Consulting Fact-Checker sub-agent: "${args.claim ? (args.claim.slice(0, 60) + "…") : "verifying claim"}"`;
                        } else if (toolName === "askCodeReviewerTool" || toolName === "consult_code_reviewer") {
                            label = `💻 Consulting Code Reviewer sub-agent: auditing code and security…`;
                        } else if (toolName) {
                            label = `⚙️ Executing tool: ${toolName}`;
                        }

                        if (label) {
                            if (!inThinkBlock) {
                                inThinkBlock = true;
                                await writer.write(encoder.encode("<think>\n")).catch(() => {});
                            }
                            await writer.write(encoder.encode(`${label}\n`)).catch(() => {});
                        }
                    }
                }
            },
        });

        for await (const chunk of response.textStream) {
            if (inThinkBlock) {
                inThinkBlock = false;
                await writer.write(encoder.encode("</think>\n\n")).catch(() => {});
            }
            await writer.write(encoder.encode(chunk));
        }

        if (inThinkBlock) {
            inThinkBlock = false;
            await writer.write(encoder.encode("</think>\n\n")).catch(() => {});
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
            await writer.write(
                encoder.encode(
                    "**Daily rate limit reached** — the model quota has been reached.\n\n" +
                    "The limit resets at **midnight UTC**. You can also:\n" +
                    "- Add credits on [OpenRouter](https://openrouter.ai) to unlock higher limits\n" +
                    "- Switch to a different model in your `.env.local` (`OPENROUTER_MODEL`)\n\n" +
                    "In the meantime, **uploaded documents are still searchable** — your files are stored and will be ready when the limit resets."
                )
            );
        } else if (msg.includes("unavailable") || msg.includes("AI_APICallError") || msg.toLowerCase().includes("openrouter")) {
            await writer.write(
                encoder.encode(
                    `**LLM Provider Error:** ${msg}\n\n` +
                    "You can switch the model by setting `OPENROUTER_MODEL` in your `.env.local` (e.g. `OPENROUTER_MODEL=deepseek/deepseek-chat`)."
                )
            );
        } else {
            throw err; 
        }
    }
}
