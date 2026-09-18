import { createStep } from "@mastra/core/workflows";
import { nanoid } from "nanoid";
import { saveResearchSources } from "@/lib/research-store";
import { RerankStepInput, RerankStepOutput } from "../schemas";
import { rerankSources } from "../helpers";

export const rerankStep = createStep({
    id: "rerank_sources",
    inputSchema: RerankStepInput,
    outputSchema: RerankStepOutput,
    execute: async ({ inputData }) => {
        const { enrichedSources, originalQuery, sessionId, ragContext, subQueries, tavilyAnswer, timezone } = inputData;
        const rankedSources = rerankSources(originalQuery, enrichedSources, 8, timezone);

        await saveResearchSources(
            rankedSources.map((s) => ({
                id: nanoid(),
                sessionId,
                url: s.url,
                title: s.title,
                content: s.content,
                relevanceScore: s.relevanceScore,
                credibilityScore: s.credibilityScore,
                finalScore: s.finalScore,
                fetchedAt: new Date().toISOString(),
            }))
        );

        return {
            sessionId,
            originalQuery,
            ragContext,
            subQueries,
            tavilyAnswer,
            rankedSources,
            timezone,
            progress: `📊 Reranked ${rankedSources.length} sources by credibility, relevance, and recency`,
        };
    },
});
