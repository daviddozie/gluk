import { glukAgent } from "../../agents/gluk-agent";
import type { RawSource, RankedSource, Confidence } from "./schemas";

// ─── Query & Date Constraints ────────────────────────────────────────────────

export function extractDateConstraint(query: string): {
    hasRecent: boolean;
    hasYear: number | null;
    boostRecent: boolean;
} {
    const lower = query.toLowerCase();
    const recentKeywords = ["latest", "recent", "new", "current", "today", "now", "2025", "2024"];
    const hasRecent = recentKeywords.some((kw) => lower.includes(kw));
    const yearMatch = query.match(/\b(20[2-9][0-9])\b/);
    const hasYear = yearMatch ? parseInt(yearMatch[0]) : null;
    const techNewsTopics = ["ai", "model", "gpt", "llm", "breakthrough", "discovery", "release", "announcement"];
    const isRecentTopic = techNewsTopics.some((topic) => lower.includes(topic));
    return {
        hasRecent: hasRecent || isRecentTopic,
        hasYear,
        boostRecent: hasRecent || isRecentTopic,
    };
}

// ─── Web Search (Tavily) ─────────────────────────────────────────────────────

export async function runWebSearch(
    query: string,
    sessionId: string
): Promise<{ answer: string; results: RawSource[] }> {
    const dateConstraint = extractDateConstraint(query);

    let enhancedQuery = query;
    if (dateConstraint.hasYear) {
        enhancedQuery = `${query} after:${dateConstraint.hasYear}-01-01`;
    } else if (dateConstraint.boostRecent) {
        const currentYear = new Date().getFullYear();
        enhancedQuery = `${query} after:${currentYear - 1}-01-01`;
    }

    const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: enhancedQuery,
            search_depth: "advanced",
            include_answer: true,
            max_results: 6,
        }),
    });
    if (!response.ok) throw new Error(`Tavily error (${sessionId}): ${response.statusText}`);
    const data = await response.json();
    return {
        answer: (data.answer ?? "") as string,
        results: (data.results ?? []).map(
            (r: { title: string; url: string; content: string; score?: number }) => ({
                title: r.title,
                url: r.url,
                content: r.content,
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
    topK = 8
): RankedSource[] {
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
        const finalScore = relevanceScore * 0.6 + credibilityScore * 0.4;
        return { ...s, relevanceScore, credibilityScore, finalScore };
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

export async function llmPlan(query: string): Promise<string[]> {
    const prompt = `You are a research planner. Break this user query into 3-5 specific, searchable sub-queries that cover different angles or aspects.

Rules:
- Each sub-query should be a complete, standalone search phrase
- Cover complementary angles (e.g., definitions, recent developments, technical details, comparisons)
- Do NOT include the year unless the query is specifically about recent events
- Return ONLY a JSON array of strings, no other text

Query: "${query}"

Example output: ["quantum computing basics", "quantum computing 2025 breakthroughs", "quantum computing vs classical computing comparison"]

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
        return [query, `${query} explained`, `${query} latest`];
    }
}

// ─── Confidence Calculation ──────────────────────────────────────────────────

export function calculateConfidence(
    rankedSources: Array<{ finalScore: number; credibilityScore: number }>,
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
