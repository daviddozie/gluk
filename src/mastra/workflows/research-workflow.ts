import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { nanoid } from "nanoid";
import { glukAgent } from "../agents/gluk-agent";
import {
    saveResearchSession,
    saveResearchSources,
    saveResearchFindings,
} from "@/lib/research-store";

// ─── Shared helpers (inlined to avoid tool-execute API quirks) ───────────────

function extractDateConstraint(query: string): { hasRecent: boolean; hasYear: number | null; boostRecent: boolean } {
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

async function runWebSearch(query: string, sessionId: string) {
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
        results: (data.results ?? []).map((r: { title: string; url: string; content: string; score?: number }) => ({
            title: r.title,
            url: r.url,
            content: r.content,
            score: r.score ?? 0,
        })) as Array<{ title: string; url: string; content: string; score: number }>,
    };
}

async function runWebFetch(url: string, attempt = 0): Promise<{ title: string; text: string; success: boolean }> {
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
    } catch (err) {
        if (attempt < 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return runWebFetch(url, attempt + 1);
        }
        return { title: "", text: "", success: false };
    }
}

function extractText(html: string): { title: string; text: string } {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";
    let cleaned = html
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

function rerankSources(
    query: string,
    sources: Array<{ title: string; url: string; content: string; score: number }>,
    topK = 8
) {
    const queryTerms = new Set(
        query.toLowerCase().split(/\W+/).filter((t) => t.length > 2)
    );

    const TRUSTED = [".edu", ".gov", "arxiv.org", "pubmed", "reuters.com", "bbc.com",
        "apnews.com", "nature.com", "wikipedia.org", "britannica.com", "github.com"];

    const scored = sources.map((s) => {
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

async function llmPlan(query: string): Promise<string[]> {
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

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function calculateConfidence(
    rankedSources: Array<{ finalScore: number; credibilityScore: number }>,
    tavilyAnswer: string
): { level: "high" | "medium" | "low"; note: string } {
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

// ─── Input / Output Schemas ──────────────────────────────────────────────────

const ResearchInput = z.object({
    query: z.string(),
    conversationId: z.string(),
    userEmail: z.string(),
    ragContext: z.string().optional().default(""),
});

const ResearchOutput = z.object({
    synthesis: z.string(),
    sources: z.array(z.object({ title: z.string(), url: z.string(), finalScore: z.number() })),
    sessionId: z.string(),
    subQueriesUsed: z.array(z.string()),
    confidence: z.object({
        level: z.enum(["high", "medium", "low"]),
        note: z.string(),
    }),
});

// ─── Step 1: Plan ───────────────────────────────────────────────────────────

const planStep = createStep({
    id: "plan_queries",
    inputSchema: ResearchInput,
    outputSchema: z.object({
        sessionId: z.string(),
        originalQuery: z.string(),
        conversationId: z.string(),
        userEmail: z.string(),
        ragContext: z.string(),
        subQueries: z.array(z.string()),
        progress: z.string().optional(),
    }),
    execute: async ({ inputData }) => {
        const { query, conversationId, userEmail, ragContext } = inputData;
        const sessionId = nanoid();
        const subQueries = await llmPlan(query);
        await saveResearchSession({
            id: sessionId, conversationId, userEmail,
            originalQuery: query, subQueries, status: "running",
        });
        return { sessionId, originalQuery: query, conversationId, userEmail, ragContext: ragContext ?? "", subQueries, progress: `📋 Planning research strategy for "${query.slice(0, 50)}${query.length > 50 ? "..." : ""}" — ${subQueries.length} angles identified` };
    },
});

// ─── Step 2: Gather ──────────────────────────────────────────────────────────

const gatherStep = createStep({
    id: "gather_sources",
    inputSchema: z.object({
        sessionId: z.string(), originalQuery: z.string(), conversationId: z.string(),
        userEmail: z.string(), ragContext: z.string(), subQueries: z.array(z.string()),
    }),
    outputSchema: z.object({
        sessionId: z.string(), originalQuery: z.string(), ragContext: z.string(),
        subQueries: z.array(z.string()),
        rawSources: z.array(z.object({ title: z.string(), url: z.string(), content: z.string(), score: z.number() })),
        tavilyAnswer: z.string(),
        progress: z.string().optional(),
    }),
    execute: async ({ inputData }) => {
        const { sessionId, subQueries, originalQuery, ragContext } = inputData;
        const allResults: Array<{ title: string; url: string; content: string; score: number }> = [];
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

        return { sessionId, originalQuery, ragContext, subQueries: inputData.subQueries, rawSources, tavilyAnswer, progress: `🔎 Searched ${subQueries.length} angles: ${subQueries.join(", ")}` };
    },
});

// ─── Step 3: Deep-fetch ──────────────────────────────────────────────────────

const deepFetchStep = createStep({
    id: "deep_fetch",
    inputSchema: z.object({
        sessionId: z.string(), originalQuery: z.string(), ragContext: z.string(),
        subQueries: z.array(z.string()),
        rawSources: z.array(z.object({ title: z.string(), url: z.string(), content: z.string(), score: z.number() })),
        tavilyAnswer: z.string(),
    }),
    outputSchema: z.object({
        sessionId: z.string(), originalQuery: z.string(), ragContext: z.string(),
        subQueries: z.array(z.string()),
        enrichedSources: z.array(z.object({ title: z.string(), url: z.string(), content: z.string(), score: z.number() })),
        tavilyAnswer: z.string(),
        progress: z.string().optional(),
    }),
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
            .filter((result): result is PromiseFulfilledResult<typeof toFetch[number]> => result.status === "fulfilled")
            .map((result) => result.value);

        const failedCount = results.filter((r) => r.status === "rejected").length;
        if (failedCount > 0) {
            console.warn(`Deep fetch: ${failedCount}/${toFetch.length} URLs failed, continuing with ${enriched.length} sources`);
        }

        return { sessionId, originalQuery, ragContext, subQueries, tavilyAnswer, enrichedSources: [...enriched, ...rest], progress: ` Deep-read ${enriched.length} sources for full content` };
    },
});

// ─── Step 4: Rerank ──────────────────────────────────────────────────────────

const rerankStep = createStep({
    id: "rerank_sources",
    inputSchema: z.object({
        sessionId: z.string(), originalQuery: z.string(), ragContext: z.string(),
        subQueries: z.array(z.string()),
        enrichedSources: z.array(z.object({ title: z.string(), url: z.string(), content: z.string(), score: z.number() })),
        tavilyAnswer: z.string(),
    }),
    outputSchema: z.object({
        sessionId: z.string(), originalQuery: z.string(), ragContext: z.string(),
        subQueries: z.array(z.string()),
        rankedSources: z.array(z.object({
            title: z.string(), url: z.string(), content: z.string(), score: z.number(),
            finalScore: z.number(), credibilityScore: z.number(), relevanceScore: z.number(),
        })),
        tavilyAnswer: z.string(),
        progress: z.string().optional(),
    }),
    execute: async ({ inputData }) => {
        const { enrichedSources, originalQuery, sessionId, ragContext, subQueries, tavilyAnswer } = inputData;
        const rankedSources = rerankSources(originalQuery, enrichedSources, 8);

        await saveResearchSources(
            rankedSources.map((s) => ({
                id: nanoid(), sessionId, url: s.url, title: s.title, content: s.content,
                relevanceScore: s.relevanceScore, credibilityScore: s.credibilityScore,
                finalScore: s.finalScore, fetchedAt: new Date().toISOString(),
            }))
        );

        return { sessionId, originalQuery, ragContext, subQueries, tavilyAnswer, rankedSources, progress: `📊 Reranked ${rankedSources.length} sources by credibility and relevance` };
    },
});

// ─── Step 5: Synthesise ──────────────────────────────────────────────────────

const synthesiseStep = createStep({
    id: "synthesise",
    inputSchema: z.object({
        sessionId: z.string(), originalQuery: z.string(), ragContext: z.string(),
        subQueries: z.array(z.string()),
        rankedSources: z.array(z.object({
            title: z.string(), url: z.string(), content: z.string(), score: z.number(),
            finalScore: z.number(), credibilityScore: z.number(), relevanceScore: z.number(),
        })),
        tavilyAnswer: z.string(),
    }),
    outputSchema: ResearchOutput,
    execute: async ({ inputData }) => {
        const { sessionId, originalQuery, rankedSources, ragContext, subQueries, tavilyAnswer } = inputData;

        const confidence = calculateConfidence(rankedSources, tavilyAnswer);

        const evidenceBlock = rankedSources.slice(0, 6).map((s, i) =>
            `[Source ${i + 1}] ${s.title}\nURL: ${s.url}\nRelevance: ${(s.relevanceScore * 100).toFixed(0)}% | Credibility: ${(s.credibilityScore * 100).toFixed(0)}%\n${s.content.slice(0, 1200)}`
        ).join("\n\n---\n\n");

        const ragSection = ragContext ? `\n\n## Uploaded Document Context\n${ragContext}` : "";
        const citationList = rankedSources.slice(0, 6).map((s, i) => `[${i + 1}] [${s.title}](${s.url})`).join("\n");

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

        await saveResearchFindings([{
            id: nanoid(), sessionId,
            claim: `Research synthesis for: "${originalQuery}"`,
            supportingUrls: rankedSources.slice(0, 6).map((s) => s.url),
            confidence: rankedSources[0]?.finalScore ?? 0,
        }]);

        await saveResearchSession({
            id: sessionId, conversationId: "", userEmail: "",
            originalQuery, subQueries, status: "complete",
        });

        return {
            synthesis, sessionId, subQueriesUsed: subQueries,
            sources: rankedSources.slice(0, 6).map((s) => ({ title: s.title, url: s.url, finalScore: s.finalScore })),
            confidence,
            progress: `✍️ Synthesizing final answer with citations`,
        };
    },
});

// ─── Workflow assembly ───────────────────────────────────────────────────────

export const researchWorkflow = createWorkflow({
    id: "research_workflow",
    inputSchema: ResearchInput,
    outputSchema: ResearchOutput,
})
    .then(planStep)
    .then(gatherStep)
    .then(deepFetchStep)
    .then(rerankStep)
    .then(synthesiseStep)
    .commit();
