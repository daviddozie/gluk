import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getDB } from "@/lib/db";

async function initDigestTable() {
    const db = getDB();
    await db.execute(`
        CREATE TABLE IF NOT EXISTS research_digests (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            topic TEXT NOT NULL,
            summary TEXT NOT NULL,
            key_findings TEXT NOT NULL DEFAULT '[]',
            sources TEXT NOT NULL DEFAULT '[]',
            tags TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL
        )
    `);
}

export const saveDigestTool = createTool({
    id: "save_research_digest",
    description:
        "Save a curated research digest, key takeaways, and verified source citations into the database. Use this when the user asks to save, bookmark, archive, or record research findings for later retrieval.",
    inputSchema: z.object({
        title: z.string().describe("Descriptive title for the research digest"),
        topic: z.string().describe("Main topic or category (e.g. 'Artificial Intelligence', 'Next.js', 'Biotech')"),
        summary: z.string().describe("Executive summary of the findings (2-4 sentences)"),
        keyFindings: z
            .array(z.string())
            .describe("List of core bullet points or facts discovered"),
        sources: z
            .array(
                z.object({
                    title: z.string(),
                    url: z.string().url(),
                })
            )
            .describe("List of verified reference sources cited in the digest"),
        tags: z
            .array(z.string())
            .optional()
            .default([])
            .describe("Optional categorization tags (e.g. ['ai', 'nextjs', 'benchmark'])"),
    }),
    outputSchema: z.object({
        success: z.boolean(),
        digestId: z.string(),
        title: z.string(),
        topic: z.string(),
        savedAt: z.string(),
        findingsCount: z.number(),
        sourcesCount: z.number(),
        confirmation: z.string(),
    }),
    execute: async ({ title, topic, summary, keyFindings, sources, tags = [] }) => {
        await initDigestTable();

        const digestId = nanoid();
        const savedAt = new Date().toISOString();

        await getDB().execute({
            sql: `
                INSERT INTO research_digests (id, title, topic, summary, key_findings, sources, tags, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                digestId,
                title,
                topic,
                summary,
                JSON.stringify(keyFindings),
                JSON.stringify(sources),
                JSON.stringify(tags),
                savedAt,
            ],
        });

        return {
            success: true,
            digestId,
            title,
            topic,
            savedAt,
            findingsCount: keyFindings.length,
            sourcesCount: sources.length,
            confirmation: `💾 Research digest "${title}" (ID: ${digestId}) successfully saved with ${keyFindings.length} findings and ${sources.length} sources.`,
        };
    },
});
