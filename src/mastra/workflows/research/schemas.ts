import { z } from "zod";

// ─── Input / Output Schemas ──────────────────────────────────────────────────

export const ResearchInput = z.object({
    query: z.string(),
    conversationId: z.string(),
    userEmail: z.string(),
    ragContext: z.string().optional().default(""),
});

export const ResearchOutput = z.object({
    synthesis: z.string(),
    sources: z.array(z.object({ title: z.string(), url: z.string(), finalScore: z.number() })),
    sessionId: z.string(),
    subQueriesUsed: z.array(z.string()),
    confidence: z.object({
        level: z.enum(["high", "medium", "low"]),
        note: z.string(),
    }),
});

// ─── Step Schemas ────────────────────────────────────────────────────────────

export const PlanStepOutput = z.object({
    sessionId: z.string(),
    originalQuery: z.string(),
    conversationId: z.string(),
    userEmail: z.string(),
    ragContext: z.string(),
    subQueries: z.array(z.string()),
    progress: z.string().optional(),
});

export const GatherStepInput = z.object({
    sessionId: z.string(),
    originalQuery: z.string(),
    conversationId: z.string(),
    userEmail: z.string(),
    ragContext: z.string(),
    subQueries: z.array(z.string()),
});

export const GatherStepOutput = z.object({
    sessionId: z.string(),
    originalQuery: z.string(),
    ragContext: z.string(),
    subQueries: z.array(z.string()),
    rawSources: z.array(z.object({ title: z.string(), url: z.string(), content: z.string(), score: z.number() })),
    tavilyAnswer: z.string(),
    progress: z.string().optional(),
});

export const DeepFetchStepInput = z.object({
    sessionId: z.string(),
    originalQuery: z.string(),
    ragContext: z.string(),
    subQueries: z.array(z.string()),
    rawSources: z.array(z.object({ title: z.string(), url: z.string(), content: z.string(), score: z.number() })),
    tavilyAnswer: z.string(),
});

export const DeepFetchStepOutput = z.object({
    sessionId: z.string(),
    originalQuery: z.string(),
    ragContext: z.string(),
    subQueries: z.array(z.string()),
    enrichedSources: z.array(z.object({ title: z.string(), url: z.string(), content: z.string(), score: z.number() })),
    tavilyAnswer: z.string(),
    progress: z.string().optional(),
});

export const RerankStepInput = z.object({
    sessionId: z.string(),
    originalQuery: z.string(),
    ragContext: z.string(),
    subQueries: z.array(z.string()),
    enrichedSources: z.array(z.object({ title: z.string(), url: z.string(), content: z.string(), score: z.number() })),
    tavilyAnswer: z.string(),
});

export const RerankStepOutput = z.object({
    sessionId: z.string(),
    originalQuery: z.string(),
    ragContext: z.string(),
    subQueries: z.array(z.string()),
    rankedSources: z.array(
        z.object({
            title: z.string(),
            url: z.string(),
            content: z.string(),
            score: z.number(),
            finalScore: z.number(),
            credibilityScore: z.number(),
            relevanceScore: z.number(),
        })
    ),
    tavilyAnswer: z.string(),
    progress: z.string().optional(),
});

export const SynthesiseStepInput = z.object({
    sessionId: z.string(),
    originalQuery: z.string(),
    ragContext: z.string(),
    subQueries: z.array(z.string()),
    rankedSources: z.array(
        z.object({
            title: z.string(),
            url: z.string(),
            content: z.string(),
            score: z.number(),
            finalScore: z.number(),
            credibilityScore: z.number(),
            relevanceScore: z.number(),
        })
    ),
    tavilyAnswer: z.string(),
});

// ─── TypeScript Types ────────────────────────────────────────────────────────

export type ResearchInputType = z.infer<typeof ResearchInput>;
export type ResearchOutputType = z.infer<typeof ResearchOutput>;
export type PlanStepOutputType = z.infer<typeof PlanStepOutput>;
export type GatherStepInputType = z.infer<typeof GatherStepInput>;
export type GatherStepOutputType = z.infer<typeof GatherStepOutput>;
export type DeepFetchStepInputType = z.infer<typeof DeepFetchStepInput>;
export type DeepFetchStepOutputType = z.infer<typeof DeepFetchStepOutput>;
export type RerankStepInputType = z.infer<typeof RerankStepInput>;
export type RerankStepOutputType = z.infer<typeof RerankStepOutput>;
export type SynthesiseStepInputType = z.infer<typeof SynthesiseStepInput>;

export interface RawSource {
    title: string;
    url: string;
    content: string;
    score: number;
}

export type EnrichedSource = RawSource;

export interface RankedSource extends RawSource {
    finalScore: number;
    credibilityScore: number;
    relevanceScore: number;
}

export interface Confidence {
    level: "high" | "medium" | "low";
    note: string;
}
