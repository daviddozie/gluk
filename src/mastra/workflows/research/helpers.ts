import { glukAgent } from "../../agents/gluk-agent";
import type { RawSource, RankedSource, Confidence } from "./schemas";
import {
    getSystemTemporalContext,
    resolveQueryTemporalExpressions,
    evaluateFreshness,
    TavilyTimeRange,
} from "@/lib/temporal";
import { computeFreshnessScore } from "../../tools/source-rerank-tool";

// ─── Query & Date Constraints ────────────────────────────────────────────────

export function extractDateConstraint(
    query: string,
    timezone?: string
): {
    hasRecent: boolean;
    hasYear: number | null;
    boostRecent: boolean;
    tavilyTimeRange?: TavilyTimeRange;
    searchConstraint?: string;
} {
    const temporalCtx = getSystemTemporalContext(timezone);
    const resolved = resolveQueryTemporalExpressions(query, temporalCtx);
    const freshness = evaluateFreshness(query, temporalCtx);

    return {
        hasRecent: freshness.isTimeSensitive,
        hasYear: resolved.targetYear ?? null,
        boostRecent: freshness.isTimeSensitive,
        tavilyTimeRange: resolved.tavilyTimeRange,
        searchConstraint: resolved.searchConstraint,
    };
}

// ─── Web Search (Tavily) ─────────────────────────────────────────────────────

export async function runWebSearch(
    query: string,
    sessionId: string,
    timezone?: string
): Promise<{ answer: string; results: RawSource[] }> {
    const temporalCtx = getSystemTemporalContext(timezone);
    const dateConstraint = extractDateConstraint(query, timezone);

    let enhancedQuery = query;
    if (dateConstraint.hasYear && dateConstraint.hasYear !== temporalCtx.year) {
        enhancedQuery = `${query} after:${dateConstraint.hasYear}-01-01`;
    } else if (dateConstraint.boostRecent) {
        // Boost towards current year
        if (!query.includes(String(temporalCtx.year))) {
            enhancedQuery = `${query} ${temporalCtx.year}`;
        }
    }

    const requestBody: Record<string, unknown> = {
        api_key: process.env.TAVILY_API_KEY,
        query: enhancedQuery,
        search_depth: "advanced",
        include_answer: true,
        max_results: 6,
    };

    if (dateConstraint.tavilyTimeRange) {
        requestBody.time_range = dateConstraint.tavilyTimeRange;
    }

    const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) throw new Error(`Tavily error (${sessionId}): ${response.statusText}`);
    const data = await response.json();

    return {
        answer: (data.answer ?? "") as string,
        results: (data.results ?? []).map(
            (r: { title: string; url: string; content: string; published_date?: string; publishedDate?: string; score?: number }) => ({
                title: r.title,
                url: r.url,
                content: r.content,
                publishedDate: r.published_date || r.publishedDate,
                score: r.score ?? 0,
            })
        ) as RawSource[],
    };
}

// ─── Web Fetch & HTML Extraction ─────────────────────────────────────────────

export function extractText(html: string): { title: string; text: string } {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";
    const cleaned = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
        .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
        .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|article|section)>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    return { title, text: cleaned };
}

export async function runWebFetch(
    url: string,
    attempt = 0
): Promise<{ title: string; text: string; success: boolean }> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { "User-Agent": "Mozilla/5.0 (compatible; GlukResearch/1.0)" },
        });
        clearTimeout(timeout);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const { title, text } = extractText(html);
        return { title, text: text.slice(0, 6000), success: true };
    } catch {
        if (attempt < 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return runWebFetch(url, attempt + 1);
        }
        return { title: "", text: "", success: false };
    }
}

// ─── Reranking & Scoring ─────────────────────────────────────────────────────

export function rerankSources(
    query: string,
    sources: RawSource[],
    topK = 8,
    timezone?: string
): RankedSource[] {
    const temporalCtx = getSystemTemporalContext(timezone);
    const freshnessEval = evaluateFreshness(query, temporalCtx);

    const queryTerms = new Set(
        query.toLowerCase().split(/\W+/).filter((t) => t.length > 2)
    );

    const TRUSTED = [
        ".edu", ".gov", "arxiv.org", "pubmed", "reuters.com", "bbc.com",
        "apnews.com", "nature.com", "wikipedia.org", "britannica.com", "github.com"
    ];

    const scored: RankedSource[] = sources.map((s) => {
        const docTerms = (s.title + " " + s.content).toLowerCase().split(/\W+/);
        const overlap = docTerms.filter((t) => queryTerms.has(t)).length;
        const relevanceScore = Math.min(overlap / Math.max(queryTerms.size, 1), 1);

        let credibilityScore = 0.5;
        try {
            const host = new URL(s.url).hostname;
            if (TRUSTED.some((d) => host.endsWith(d))) credibilityScore += 0.3;
            if (s.content.length > 2000) credibilityScore += 0.1;
            if (s.url.startsWith("https://")) credibilityScore += 0.05;
        } catch { /* keep baseline */ }

        credibilityScore = Math.max(0, Math.min(1, credibilityScore));

        const freshnessScore = computeFreshnessScore(
            s.publishedDate,
            s.url,
            s.content,
            freshnessEval.isTimeSensitive,
            temporalCtx.year
        );

        let finalScore: number;
        if (freshnessEval.isTimeSensitive) {
            finalScore = relevanceScore * 0.45 + credibilityScore * 0.25 + freshnessScore * 0.3;
        } else {
            finalScore = relevanceScore * 0.6 + credibilityScore * 0.3 + freshnessScore * 0.1;
        }

        return {
            ...s,
            relevanceScore: parseFloat(relevanceScore.toFixed(4)),
            credibilityScore: parseFloat(credibilityScore.toFixed(4)),
            freshnessScore: parseFloat(freshnessScore.toFixed(4)),
            finalScore: parseFloat(finalScore.toFixed(4)),
        };
    });

    scored.sort((a, b) => b.finalScore - a.finalScore);

    // Deduplicate by URL
    const seen = new Set<string>();
    const deduped = scored.filter((s) => {
        const key = s.url.toLowerCase().replace(/\/$/, "");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return deduped.slice(0, topK);
}

// ─── LLM Planning ────────────────────────────────────────────────────────────

export async function llmPlan(query: string, timezone?: string): Promise<string[]> {
    const temporalCtx = getSystemTemporalContext(timezone);

    const prompt = `You are a research planner. Break this user query into 3-5 specific, searchable sub-queries that cover different angles or aspects.

Current Temporal Context:
- Today's Date: ${temporalCtx.dateString}
- Current Year: ${temporalCtx.year}
- Timezone: ${temporalCtx.timezone}

Rules:
- Each sub-query should be a complete, standalone search phrase
- Cover complementary angles (e.g., definitions, recent developments, technical details, comparisons)
- If the user query is about recent, latest, or current events (e.g. today, this week, recently), anchor search phrases to the current calendar year (${temporalCtx.year}) or time window. Do NOT search for outdated years like 2024 or 2025 unless the user specifically asked for that historical year.
- Return ONLY a JSON array of strings, no other text

Query: "${query}"

Example output for a current topic: ["example topic overview", "example topic ${temporalCtx.year} updates", "example topic key developments"]

Now generate for the query above.`;

    try {
        const response = await glukAgent.generate(prompt, {
            modelSettings: {
                maxOutputTokens: 500,
            },
        });
        const jsonMatch = response.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed.slice(0, 5);
            }
        }
        return [query];
    } catch (error) {
        console.error("LLM planning failed, falling back to heuristic:", error);
        return [query, `${query} ${temporalCtx.year}`, `${query} latest`];
    }
}

// ─── Confidence Calculation ──────────────────────────────────────────────────

export function calculateConfidence(
    rankedSources: Array<{ finalScore: number; credibilityScore: number; freshnessScore?: number }>,
    tavilyAnswer: string
): Confidence {
    const bestFinalScore = rankedSources.length > 0 ? rankedSources[0].finalScore : 0;
    const hasHighCredibility = rankedSources.some((s) => s.credibilityScore > 0.7);
    const sourceCount = rankedSources.length;
    const hasTavilyAnswer = tavilyAnswer.trim().length > 0;

    if (bestFinalScore > 0.7 && hasHighCredibility && sourceCount >= 2) {
        return {
            level: "high",
            note: `Strong relevance (${(bestFinalScore * 100).toFixed(0)}%) with ${sourceCount} credible sources${hasTavilyAnswer ? " and a direct answer" : ""}.`,
        };
    }
    if (bestFinalScore > 0.5 || hasHighCredibility) {
        return {
            level: "medium",
            note: `Moderate relevance (${(bestFinalScore * 100).toFixed(0)}%) — ${hasHighCredibility ? "at least one highly credible source found" : "credibility of sources is mixed"}.`,
        };
    }
    return {
        level: "low",
        note: `Limited relevance (${(bestFinalScore * 100).toFixed(0)}%) — results may not fully address the query. Consider refining your search.`,
    };
}

// ─── Utilities ───────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}
