import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
    saveResearchSession,
    saveResearchSources,
    saveResearchFindings,
} from "@/lib/research-store";

// ─── Shared helpers (inlined to avoid tool-execute API quirks) ───────────────

async function runWebSearch(query: string, sessionId: string) {
    const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query,
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

async function runWebFetch(url: string): Promise<{ title: string; text: string; success: boolean }> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(url, {
            signal: controller.signal,
            headers: { "User-Agent": "Mozilla/5.0 (compatible; GlukResearch/1.0)" },
        });
        clearTimeout(timeout);
        if (!response.ok) return { title: "", text: "", success: false };
        const html = await response.text();
        const { title, text } = extractText(html);
        return { title, text: text.slice(0, 6000), success: true };
    } catch {
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

function deriveSubQueries(query: string): string[] {
    const base = query.trim();
    const queries = [base];
    if (!/\b(202[0-9]|latest|recent|current|today|now)\b/i.test(base)) {
        queries.push(`${base} latest 2025`);
    }
    if (/^what\b/i.test(base)) {
        queries.push(base.replace(/^what\b/i, "how"));
    } else {
        queries.push(`${base} explained`);
    }
    return queries.slice(0, 3);
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

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
    }),
    execute: async ({ inputData }) => {
        const { query, conversationId, userEmail, ragContext } = inputData;
        const sessionId = nanoid();
        const subQueries = deriveSubQueries(query);
        await saveResearchSession({
            id: sessionId, conversationId, userEmail,
            originalQuery: query, subQueries, status: "running",
        });
        return { sessionId, originalQuery: query, conversationId, userEmail, ragContext: ragContext ?? "", subQueries };
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

        return { sessionId, originalQuery, ragContext, subQueries: inputData.subQueries, rawSources, tavilyAnswer };
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
    }),
    execute: async ({ inputData }) => {
        const { rawSources, sessionId, originalQuery, ragContext, subQueries, tavilyAnswer } = inputData;
        const sorted = [...rawSources].sort((a, b) => b.score - a.score);
        const toFetch = sorted.slice(0, 4);
        const rest = sorted.slice(4);

        const enriched = await Promise.all(
            toFetch.map(async (src) => {
                const fetched = await runWebFetch(src.url);
                if (fetched.success && fetched.text.length > 200) {
                    return { ...src, title: fetched.title || src.title, content: src.content + "\n\n" + fetched.text };
                }
                return src;
            })
        );

        return { sessionId, originalQuery, ragContext, subQueries, tavilyAnswer, enrichedSources: [...enriched, ...rest] };
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

        return { sessionId, originalQuery, ragContext, subQueries, tavilyAnswer, rankedSources };
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

        const evidenceBlock = rankedSources.slice(0, 6).map((s, i) =>
            `[Source ${i + 1}] ${s.title}\nURL: ${s.url}\nRelevance: ${(s.relevanceScore * 100).toFixed(0)}% | Credibility: ${(s.credibilityScore * 100).toFixed(0)}%\n${s.content.slice(0, 1200)}`
        ).join("\n\n---\n\n");

        const ragSection = ragContext ? `\n\n## Uploaded Document Context\n${ragContext}` : "";
        const citationList = rankedSources.slice(0, 6).map((s, i) => `[${i + 1}] [${s.title}](${s.url})`).join("\n");

        const synthesis = `## Research Results for: "${originalQuery}"

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
