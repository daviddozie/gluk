import { createStep } from "@mastra/core/workflows";
import { GatherStepInput, GatherStepOutput, RawSource } from "../schemas";
import { runWebSearch, sleep } from "../helpers";

export const gatherStep = createStep({
    id: "gather_sources",
    inputSchema: GatherStepInput,
    outputSchema: GatherStepOutput,
    execute: async ({ inputData }) => {
        const { sessionId, subQueries, originalQuery, ragContext } = inputData;
        const allResults: RawSource[] = [];
        let tavilyAnswer = "";

        for (const subQuery of subQueries) {
            try {
                const result = await runWebSearch(subQuery, sessionId);
                if (result.answer && !tavilyAnswer) tavilyAnswer = result.answer;
                allResults.push(...result.results);
                await sleep(300);
            } catch (err) {
                console.error(`Search failed for "${subQuery}":`, err);
            }
        }

        const seen = new Set<string>();
        const rawSources = allResults.filter((r) => {
            if (seen.has(r.url)) return false;
            seen.add(r.url);
            return true;
        });

        return {
            sessionId,
            originalQuery,
            ragContext,
            subQueries: inputData.subQueries,
            rawSources,
            tavilyAnswer,
            progress: `🔎 Searched ${subQueries.length} angles: ${subQueries.join(", ")}`,
        };
    },
});
