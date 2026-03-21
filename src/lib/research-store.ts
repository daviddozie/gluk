import { createClient } from "@libsql/client";

let _turso: ReturnType<typeof createClient> | null = null;

function getDB() {
    if (!_turso) {
        const url = process.env.TURSO_DATABASE_URL;
        if (!url) throw new Error("TURSO_DATABASE_URL is not set");
        _turso = createClient({
            url,
            authToken: process.env.TURSO_AUTH_TOKEN,
        });
    }
    return _turso;
}

async function initResearchTables() {
    const db = getDB();
    await db.execute(`
        CREATE TABLE IF NOT EXISTS research_sessions (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            user_email TEXT NOT NULL,
            original_query TEXT NOT NULL,
            sub_queries TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS research_sources (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            url TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            relevance_score REAL NOT NULL DEFAULT 0,
            credibility_score REAL NOT NULL DEFAULT 0,
            final_score REAL NOT NULL DEFAULT 0,
            fetched_at TEXT NOT NULL,
            FOREIGN KEY (session_id) REFERENCES research_sessions(id)
        )
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS research_findings (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            claim TEXT NOT NULL,
            supporting_urls TEXT NOT NULL DEFAULT '[]',
            confidence REAL NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (session_id) REFERENCES research_sessions(id)
        )
    `);
}

export interface ResearchSession {
    id: string;
    conversationId: string;
    userEmail: string;
    originalQuery: string;
    subQueries: string[];
    status: "pending" | "running" | "complete" | "failed";
}

export interface ResearchSource {
    id: string;
    sessionId: string;
    url: string;
    title: string;
    content: string;
    relevanceScore: number;
    credibilityScore: number;
    finalScore: number;
    fetchedAt: string;
}

export interface ResearchFinding {
    id: string;
    sessionId: string;
    claim: string;
    supportingUrls: string[];
    confidence: number;
}

export async function saveResearchSession(session: ResearchSession) {
    await initResearchTables();
    const now = new Date().toISOString();
    await getDB().execute({
        sql: `
            INSERT INTO research_sessions (id, conversation_id, user_email, original_query, sub_queries, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                sub_queries = excluded.sub_queries,
                status = excluded.status,
                updated_at = excluded.updated_at
        `,
        args: [
            session.id,
            session.conversationId,
            session.userEmail,
            session.originalQuery,
            JSON.stringify(session.subQueries),
            session.status,
            now,
            now,
        ],
    });
}

export async function saveResearchSources(sources: ResearchSource[]) {
    await initResearchTables();
    const now = new Date().toISOString();
    for (const src of sources) {
        await getDB().execute({
            sql: `
                INSERT OR REPLACE INTO research_sources
                (id, session_id, url, title, content, relevance_score, credibility_score, final_score, fetched_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                src.id,
                src.sessionId,
                src.url,
                src.title,
                src.content.slice(0, 4000), // keep DB lean
                src.relevanceScore,
                src.credibilityScore,
                src.finalScore,
                now,
            ],
        });
    }
}

export async function saveResearchFindings(findings: ResearchFinding[]) {
    await initResearchTables();
    const now = new Date().toISOString();
    for (const f of findings) {
        await getDB().execute({
            sql: `
                INSERT OR REPLACE INTO research_findings
                (id, session_id, claim, supporting_urls, confidence, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `,
            args: [f.id, f.sessionId, f.claim, JSON.stringify(f.supportingUrls), f.confidence, now],
        });
    }
}

export async function getResearchSession(sessionId: string): Promise<ResearchSession | null> {
    await initResearchTables();
    const result = await getDB().execute({
        sql: `SELECT * FROM research_sessions WHERE id = ?`,
        args: [sessionId],
    });
    const row = result.rows[0];
    if (!row) return null;
    return {
        id: row.id as string,
        conversationId: row.conversation_id as string,
        userEmail: row.user_email as string,
        originalQuery: row.original_query as string,
        subQueries: JSON.parse(row.sub_queries as string),
        status: row.status as ResearchSession["status"],
    };
}

export async function getSessionSources(sessionId: string): Promise<ResearchSource[]> {
    await initResearchTables();
    const result = await getDB().execute({
        sql: `SELECT * FROM research_sources WHERE session_id = ? ORDER BY final_score DESC`,
        args: [sessionId],
    });
    return result.rows.map((row) => ({
        id: row.id as string,
        sessionId: row.session_id as string,
        url: row.url as string,
        title: row.title as string,
        content: row.content as string,
        relevanceScore: row.relevance_score as number,
        credibilityScore: row.credibility_score as number,
        finalScore: row.final_score as number,
        fetchedAt: row.fetched_at as string,
    }));
}
