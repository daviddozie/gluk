import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { resolveQueryTemporalExpressions } from "@/lib/temporal";

export const webSearchTool = createTool({
    id: "web_search",
    description:
        "Search the internet for current, real-time information. Use this for any question about recent events, news, facts, people, places, products, or anything that requires up-to-date information. When searching for recent topics, specify 'timeRange' ('day', 'week', 'month', 'year') to filter results by publication freshness.",
    inputSchema: z.object({
        query: z.string().describe("The search query. Be specific — narrow queries return better results than broad ones."),
        depth: z
            .enum(["basic", "advanced"])
            .optional()
            .default("advanced")
            .describe("Search depth. Use 'advanced' for research tasks to get richer content."),
        maxResults: z
            .number()
            .optional()
            .default(8)
            .describe("Maximum number of results to return (default 8 for research, lower for quick lookups)."),
        includeImages: z
            .boolean()
            .optional()
            .default(false)
            .describe("Whether to include image URLs in results."),
        timeRange: z
            .enum(["day", "week", "month", "year", "d", "w", "m", "y"])
            .optional()
            .describe("Time filter for recent events: 'day' (past 24h), 'week' (past 7 days), 'month' (past 30 days), 'year' (past year)."),
    }),
    outputSchema: z.object({
        results: z.array(
            z.object({
                title: z.string(),
                url: z.string(),
                content: z.string(),
                publishedDate: z.string().optional(),
                score: z.number().optional(),
            })
        ),
        answer: z.string().optional(),
        query: z.string(),
        searchedAt: z.string(),
        timeRangeApplied: z.string().optional(),
    }),
    execute: async ({ query, depth = "advanced", maxResults = 8, includeImages = false, timeRange }) => {
        const searchedAt = new Date().toISOString();

        // If timeRange is not explicitly specified, inspect query for relative temporal expressions
        let effectiveTimeRange = timeRange;
        if (!effectiveTimeRange) {
            const resolved = resolveQueryTemporalExpressions(query);
            if (resolved.tavilyTimeRange) {
                effectiveTimeRange = resolved.tavilyTimeRange;
            }
        }

        const requestBody: Record<string, unknown> = {
            api_key: process.env.TAVILY_API_KEY,
            query,
            search_depth: depth,
            include_answer: true,
            include_images: includeImages,
            include_raw_content: false,
            max_results: maxResults,
        };

        if (effectiveTimeRange) {
            requestBody.time_range = effectiveTimeRange;
        }

        const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`Tavily search failed: ${response.statusText}`);
        }

        const data = await response.json();

        return {
            query,
            searchedAt,
            timeRangeApplied: effectiveTimeRange,
            answer: data.answer ?? "",
            results: (data.results ?? []).map(
                (r: { title: string; url: string; content: string; published_date?: string; publishedDate?: string; score?: number }) => ({
                    title: r.title,
                    url: r.url,
                    content: r.content,
                    publishedDate: r.published_date || r.publishedDate,
                    score: r.score,
                })
            ),
        };
    },
});