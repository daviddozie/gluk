import { createStep } from "@mastra/core/workflows";
import { DeepFetchStepInput, DeepFetchStepOutput } from "../schemas";
import { runWebFetch } from "../helpers";

export const deepFetchStep = createStep({
    id: "deep_fetch",
    inputSchema: DeepFetchStepInput,
    outputSchema: DeepFetchStepOutput,
    execute: async ({ inputData }) => {
        const { rawSources, sessionId, originalQuery, ragContext, subQueries, tavilyAnswer } = inputData;
        const sorted = [...rawSources].sort((a, b) => b.score - a.score);
        const toFetch = sorted.slice(0, 4);
        const rest = sorted.slice(4);

        const results = await Promise.allSettled(
            toFetch.map(async (src) => {
                const fetched = await runWebFetch(src.url);
                if (fetched.success && fetched.text.length > 200) {
                    return { ...src, title: fetched.title || src.title, content: src.content + "\n\n" + fetched.text };
                }
                return src;
            })
        );

        const enriched = results
            .filter((result): result is PromiseFulfilledResult<(typeof toFetch)[number]> => result.status === "fulfilled")
            .map((result) => result.value);

        const failedCount = results.filter((r) => r.status === "rejected").length;
        if (failedCount > 0) {
            console.warn(`Deep fetch: ${failedCount}/${toFetch.length} URLs failed, continuing with ${enriched.length} sources`);
        }

        return {
            sessionId,
            originalQuery,
            ragContext,
            subQueries,
            tavilyAnswer,
            enrichedSources: [...enriched, ...rest],
            progress: `🌐 Deep-read ${enriched.length} sources for full content`,
        };
    },
});
