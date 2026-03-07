import { createClient } from "@libsql/client";

export const turso = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

// Create conversations table if it doesn't exist
export async function initDB() {
    await turso.execute(`
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
    const result = await turso.execute({
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
    await turso.execute({
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
    await turso.execute({
        sql: `DELETE FROM conversations WHERE id = ? AND user_email = ?`,
        args: [id, userEmail],
    });
}