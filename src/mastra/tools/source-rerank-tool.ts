import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import {
    evaluateFreshness,
    getSystemTemporalContext,
} from "@/lib/temporal";

export const SourceSchema = z.object({
    title: z.string(),
    url: z.string(),
    content: z.string(),
    publishedDate: z.string().optional(),
    score: z.number().optional().default(0),
});

export type SourceType = z.infer<typeof SourceSchema>;

/**
 * Computes a freshness score (0.0 to 1.0) based on source published date
 * and temporal requirements of the query.
 */
export function computeFreshnessScore(
    publishedDateStr: string | undefined,
    url: string,
    content: string,
    isTimeSensitive: boolean,
    targetYear: number = getSystemTemporalContext().year
): number {
    let extractedYear: number | null = null;
    let publishedMs: number | null = null;

    if (publishedDateStr) {
        const parsed = Date.parse(publishedDateStr);
        if (!isNaN(parsed)) {
            publishedMs = parsed;
            extractedYear = new Date(parsed).getUTCFullYear();
        } else {
            const ym = publishedDateStr.match(/\b(20[2-9][0-9])\b/);
            if (ym) extractedYear = parseInt(ym[1], 10);
        }
    }

    // If not in publishedDate, attempt extraction from URL (e.g. /2026/09/ or 2026-09)
    if (!extractedYear) {
        const urlYearMatch = url.match(/\b(20[2-9][0-9])\b/);
        if (urlYearMatch) extractedYear = parseInt(urlYearMatch[1], 10);
    }

    // If query is not time-sensitive, freshness is a minor secondary signal
    if (!isTimeSensitive) {
        if (!extractedYear) return 0.5;
        if (extractedYear >= targetYear) return 0.8;
        if (extractedYear === targetYear - 1) return 0.6;
        return 0.4;
    }

    // For time-sensitive queries:
    const nowMs = Date.now();
    if (publishedMs) {
        const ageHours = (nowMs - publishedMs) / (1000 * 60 * 60);
        if (ageHours <= 24) return 1.0; // Breaking / today
        if (ageHours <= 24 * 7) return 0.95; // This past week
        if (ageHours <= 24 * 30) return 0.9; // This past month
        if (ageHours <= 24 * 90) return 0.75; // This quarter
        if (ageHours <= 24 * 365) return 0.5; // Within past year
        return 0.15; // Older than 1 year
    }

    if (extractedYear) {
        if (extractedYear >= targetYear) return 0.85;
        if (extractedYear === targetYear - 1) return 0.45;
        return 0.1; // Stale year for recent queries
    }

    // Default neutral if no date indicators found
    return 0.4;
}

/**
 * Reranks a list of search results / fetched sources by relevance to the query,
 * source credibility, and publication freshness.
 */
export const sourceRerankTool = createTool({
    id: "source_rerank",
    description:
        "Rerank and deduplicate a list of sources by relevance to the research query, source credibility, and publication date freshness. Prioritizes recent sources for time-sensitive queries.",
    inputSchema: z.object({
        query: z.string().describe("The research question / topic to rank sources against"),
        sources: z
            .array(SourceSchema)
            .describe("Array of sources to rerank, optionally including publishedDate"),
        topK: z
            .number()
            .optional()
            .default(5)
            .describe("How many top sources to return (default 5)"),
    }),
    outputSchema: z.object({
        ranked: z.array(
            SourceSchema.extend({
                finalScore: z.number(),
                credibilityScore: z.number(),
                relevanceScore: z.number(),
                freshnessScore: z.number(),
            })
        ),
        droppedCount: z.number(),
    }),
    execute: async ({ query, sources, topK = 5 }) => {
        // Deduplicate by normalised URL
        const seen = new Set<string>();
        const unique = sources.filter((s) => {
            const key = normaliseUrl(s.url);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        const queryTerms = tokenise(query);
        const freshnessEval = evaluateFreshness(query);
        const currentYear = getSystemTemporalContext().year;

        const scored = unique.map((source) => {
            const relevanceScore = computeRelevance(queryTerms, source.title + " " + source.content);
            const credibilityScore = computeCredibility(source.url, source.content);
            const freshnessScore = computeFreshnessScore(
                source.publishedDate,
                source.url,
                source.content,
                freshnessEval.isTimeSensitive,
                currentYear
            );

            // Dynamically balance weights depending on query freshness requirement:
            let finalScore: number;
            if (freshnessEval.isTimeSensitive) {
                // For time-sensitive queries, recency is weighted heavily (30%)
                finalScore = relevanceScore * 0.45 + credibilityScore * 0.25 + freshnessScore * 0.3;
            } else {
                // Evergreen query: relevance 60%, credibility 30%, freshness 10%
                finalScore = relevanceScore * 0.6 + credibilityScore * 0.3 + freshnessScore * 0.1;
            }

            return {
                ...source,
                score: source.score ?? 0,
                finalScore: parseFloat(finalScore.toFixed(4)),
                credibilityScore: parseFloat(credibilityScore.toFixed(4)),
                relevanceScore: parseFloat(relevanceScore.toFixed(4)),
                freshnessScore: parseFloat(freshnessScore.toFixed(4)),
            };
        });

        // Sort descending by finalScore
        scored.sort((a, b) => b.finalScore - a.finalScore);

        const ranked = scored.slice(0, topK);
        const droppedCount = unique.length - ranked.length;

        return { ranked, droppedCount };
    },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function tokenise(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function computeRelevance(queryTerms: string[], docText: string): number {
    if (!queryTerms.length || !docText) return 0;
    const docTokens = tokenise(docText);
    const docFreq = new Map<string, number>();
    for (const t of docTokens) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);

    const totalDocTerms = docTokens.length || 1;
    let score = 0;
    for (const term of queryTerms) {
        const tf = (docFreq.get(term) ?? 0) / totalDocTerms;
        score += tf * (1 + Math.log(1 + (docFreq.get(term) ?? 0)));
    }
    return Math.min(score / queryTerms.length, 1);
}

function computeCredibility(url: string, content: string): number {
    let score = 0.5; // baseline

    try {
        const hostname = new URL(url).hostname.replace(/^www\./, "");

        // Trusted academic / research / gov / news domains
        if (TRUSTED_DOMAINS.some((d) => hostname.endsWith(d))) score += 0.3;

        // Penalise known low-quality patterns
        if (SPAM_PATTERNS.some((p) => hostname.includes(p))) score -= 0.3;

        // Content length as a quality signal (longer ≈ more substantive)
        if (content.length > 2000) score += 0.1;
        if (content.length > 5000) score += 0.1;

        // HTTPS bonus
        if (url.startsWith("https://")) score += 0.05;
    } catch {
        // invalid URL — keep baseline
    }

    return Math.max(0, Math.min(1, score));
}

function normaliseUrl(url: string): string {
    try {
        const u = new URL(url);
        return (u.hostname + u.pathname).replace(/\/$/, "").toLowerCase();
    } catch {
        return url.toLowerCase();
    }
}

const TRUSTED_DOMAINS = [
    ".edu", ".gov", ".ac.uk", ".ac.jp",
    "arxiv.org", "pubmed.ncbi.nlm.nih.gov", "scholar.google.com",
    "nature.com", "science.org", "thelancet.com", "nejm.org",
    "bbc.com", "reuters.com", "apnews.com", "theguardian.com",
    "nytimes.com", "washingtonpost.com", "economist.com",
    "wikipedia.org", "britannica.com",
    "github.com", "stackoverflow.com", "developer.mozilla.org",
    "docs.python.org", "nodejs.org",
];

const SPAM_PATTERNS = ["click", "spam", "ad.", "track.", "pixel."];

const STOP_WORDS = new Set([
    "the", "and", "for", "are", "but", "not", "you", "all", "can",
    "was", "had", "her", "his", "him", "its", "our", "out", "who",
    "did", "get", "has", "him", "how", "man", "new", "now", "old",
    "see", "two", "way", "may", "say", "she", "use", "been", "have",
    "that", "this", "with", "from", "they", "will", "would", "could",
    "than", "then", "what", "when", "where", "which", "while", "into",
    "more", "also", "some", "such", "there", "these", "those", "very",
]);
