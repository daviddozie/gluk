import { createStep } from "@mastra/core/workflows";
import { nanoid } from "nanoid";
import { saveResearchFindings, saveResearchSession } from "@/lib/research-store";
import { SynthesiseStepInput, ResearchOutput } from "../schemas";
import { calculateConfidence } from "../helpers";

export const synthesiseStep = createStep({
    id: "synthesise",
    inputSchema: SynthesiseStepInput,
    outputSchema: ResearchOutput,
    execute: async ({ inputData }) => {
        const { sessionId, originalQuery, rankedSources, ragContext, subQueries, tavilyAnswer } = inputData;

        const confidence = calculateConfidence(rankedSources, tavilyAnswer);

        const evidenceBlock = rankedSources
            .slice(0, 6)
            .map(
                (s, i) =>
                    `[Source ${i + 1}] ${s.title}\nURL: ${s.url}\nRelevance: ${(s.relevanceScore * 100).toFixed(0)}% | Credibility: ${(s.credibilityScore * 100).toFixed(0)}%\n${s.content.slice(0, 1200)}`
            )
            .join("\n\n---\n\n");

        const ragSection = ragContext ? `\n\n## Uploaded Document Context\n${ragContext}` : "";
        const citationList = rankedSources
            .slice(0, 6)
            .map((s, i) => `[${i + 1}] [${s.title}](${s.url})`)
            .join("\n");

        const synthesis = `## Research Results for: "${originalQuery}"

**Confidence:** ${confidence.level.toUpperCase()} — ${confidence.note}

${tavilyAnswer ? `**Quick Answer:** ${tavilyAnswer}\n\n` : ""}---

## Evidence Gathered

${evidenceBlock}
${ragSection}

---

## Sources
${citationList}

---
*Research pipeline: multi-query search → deep fetch → credibility reranking → synthesis*`;

        await saveResearchFindings([
            {
                id: nanoid(),
                sessionId,
                claim: `Research synthesis for: "${originalQuery}"`,
                supportingUrls: rankedSources.slice(0, 6).map((s) => s.url),
                confidence: rankedSources[0]?.finalScore ?? 0,
            },
        ]);

        await saveResearchSession({
            id: sessionId,
            conversationId: "",
            userEmail: "",
            originalQuery,
            subQueries,
            status: "complete",
        });

        return {
            synthesis,
            sessionId,
            subQueriesUsed: subQueries,
            sources: rankedSources
                .slice(0, 6)
                .map((s) => ({ title: s.title, url: s.url, finalScore: s.finalScore })),
            confidence,
            progress: `✍️ Synthesizing final answer with citations`,
        };
    },
});
