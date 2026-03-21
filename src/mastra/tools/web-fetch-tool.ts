import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Fetches the full text content of a webpage and returns clean, normalized text.
 * Used by the research workflow to go deeper than Tavily snippets.
 */
export const webFetchTool = createTool({
    id: "web_fetch",
    description:
        "Fetch and extract the full readable text content of a webpage URL. Use this to read the full details of a source found during web search — e.g., to verify claims, extract methodology, or read full articles.",
    inputSchema: z.object({
        url: z.string().url().describe("The URL of the webpage to fetch"),
        maxChars: z
            .number()
            .optional()
            .default(8000)
            .describe("Maximum characters to return (default 8000 to stay within context limits)"),
    }),
    outputSchema: z.object({
        url: z.string(),
        title: z.string(),
        text: z.string(),
        fetchedAt: z.string(),
        success: z.boolean(),
        error: z.string().optional(),
    }),
    execute: async ({ url, maxChars = 8000 }) => {
        const fetchedAt = new Date().toISOString();

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (compatible; GlukResearch/1.0; +https://gluk.app)",
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
            });
            clearTimeout(timeout);

            if (!response.ok) {
                return {
                    url,
                    title: "",
                    text: "",
                    fetchedAt,
                    success: false,
                    error: `HTTP ${response.status}: ${response.statusText}`,
                };
            }

            const html = await response.text();
            const { title, text } = extractText(html);

            return {
                url,
                title,
                text: text.slice(0, maxChars),
                fetchedAt,
                success: true,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                url,
                title: "",
                text: "",
                fetchedAt,
                success: false,
                error: message,
            };
        }
    },
});

/**
 * Lightweight HTML-to-text extraction without a headless browser.
 * Removes scripts, styles, nav, footer and normalises whitespace.
 */
function extractText(html: string): { title: string; text: string } {
    // Extract <title>
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "";

    // Remove noisy tags wholesale
    let cleaned = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
        .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
        .replace(/<header[\s\S]*?<\/header>/gi, " ")
        .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ");

    // Convert block-level tags to newlines so paragraphs survive
    cleaned = cleaned
        .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|article|section)>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n");

    // Strip remaining tags
    cleaned = cleaned.replace(/<[^>]+>/g, " ");

    // Decode entities and normalise whitespace
    const text = decodeHtmlEntities(cleaned)
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return { title, text };
}

function decodeHtmlEntities(str: string): string {
    return str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}
