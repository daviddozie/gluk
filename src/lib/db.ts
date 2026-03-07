import { createClient } from "@libsql/client";

// Lazy singleton — only created at runtime, not at build time
let _turso: ReturnType<typeof createClient> | null = null;

export function getDB() {
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

export async function initDB() {
    await getDB().execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      title TEXT NOT NULL,
      messages TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

export async function getUserConversations(userEmail: string) {
    await initDB();
    const result = await getDB().execute({
        sql: `SELECT * FROM conversations WHERE user_email = ? ORDER BY updated_at DESC`,
        args: [userEmail],
    });
    return result.rows.map((row) => ({
        id: row.id as string,
        title: row.title as string,
        messages: JSON.parse(row.messages as string),
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
    }));
}

export async function saveConversation(
    userEmail: string,
    id: string,
    title: string,
    messages: unknown[]
) {
    await initDB();
    const now = new Date().toISOString();
    await getDB().execute({
        sql: `
      INSERT INTO conversations (id, user_email, title, messages, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        messages = excluded.messages,
        updated_at = excluded.updated_at
    `,
        args: [id, userEmail, title, JSON.stringify(messages), now, now],
    });
}

export async function deleteConversation(userEmail: string, id: string) {
    await getDB().execute({
        sql: `DELETE FROM conversations WHERE id = ? AND user_email = ?`,
        args: [id, userEmail],
    });
}