import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const SourceSchema = z.object({
    title: z.string(),
    url: z.string(),
    content: z.string(),
    score: z.number().optional().default(0),
});

/**
 * Reranks a list of search results / fetched sources by relevance to the query.
 * Uses a lexical TF-IDF-style heuristic (no external API needed, free to run).
 * Returns sources sorted by combined relevance + credibility score.
 */
export const sourceRerankTool = createTool({
    id: "source_rerank",
    description:
        "Rerank and deduplicate a list of sources by relevance to the research query, source credibility, and content quality. Always call this after gathering multiple sources to surface the best evidence before synthesising.",
    inputSchema: z.object({
        query: z.string().describe("The research question / topic to rank sources against"),
        sources: z
            .array(SourceSchema)
            .describe("Array of sources to rerank"),
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

        const scored = unique.map((source) => {
            const relevanceScore = computeRelevance(queryTerms, source.title + " " + source.content);
            const credibilityScore = computeCredibility(source.url, source.content);
            // Weight: relevance 60%, credibility 40%
            const finalScore = relevanceScore * 0.6 + credibilityScore * 0.4;

            return {
                ...source,
                score: source.score ?? 0,
                finalScore: parseFloat(finalScore.toFixed(4)),
                credibilityScore: parseFloat(credibilityScore.toFixed(4)),
                relevanceScore: parseFloat(relevanceScore.toFixed(4)),
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
    // Normalise to [0,1]
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
