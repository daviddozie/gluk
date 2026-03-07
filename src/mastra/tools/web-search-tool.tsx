import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const webSearchTool = createTool({
    id: "web_search",
    description:
        "Search the internet for current, real-time information. Use this for any question about recent events, news, facts, people, places, products, or anything that requires up-to-date information.",
    inputSchema: z.object({
        query: z.string().describe("The search query"),
    }),
    outputSchema: z.object({
        results: z.array(
            z.object({
                title: z.string(),
                url: z.string(),
                content: z.string(),
            })
        ),
        answer: z.string().optional(),
    }),
    execute: async ({ query }) => {
        const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: process.env.TAVILY_API_KEY,
                query,
                search_depth: "basic",
                include_answer: true,
                max_results: 5,
            }),
        });

        if (!response.ok) {
            throw new Error(`Tavily search failed: ${response.statusText}`);
        }

        const data = await response.json();

        return {
            answer: data.answer ?? "",
            results: (data.results ?? []).map((r: { title: string; url: string; content: string }) => ({
                title: r.title,
                url: r.url,
                content: r.content,
            })),
        };
    },
});