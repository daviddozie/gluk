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
    const db = getDB();
    await db.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      title TEXT NOT NULL,
      messages TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0
    )
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS resources (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      favorite INTEGER NOT NULL DEFAULT 0,
      folder TEXT,
      conversation_id TEXT,
      storage TEXT,
      public_id TEXT,
      resource_type TEXT,
      vector_file_name TEXT,
      deleted INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_email, url)
    )
  `);
    await db.execute(`
    CREATE TABLE IF NOT EXISTS resource_folders (
      user_email TEXT NOT NULL,
      name TEXT NOT NULL COLLATE NOCASE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_email, name)
    )
  `);
    try {
        await db.execute(`ALTER TABLE resources ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0`);
    } catch {
        // Column already exists — ignore
    }
    for (const column of ["folder TEXT", "conversation_id TEXT", "storage TEXT", "public_id TEXT", "resource_type TEXT", "vector_file_name TEXT", "deleted INTEGER NOT NULL DEFAULT 0"]) {
        try {
            await db.execute(`ALTER TABLE resources ADD COLUMN ${column}`);
        } catch {
            // Column already exists — ignore
        }
    }
    // Migrate existing tables that don't yet have the pinned column
    try {
        await db.execute(`ALTER TABLE conversations ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`);
    } catch {
        // Column already exists — ignore
    }
}

export async function getUserResourceFolders(userEmail: string): Promise<string[]> {
    await initDB();
    const result = await getDB().execute({
        sql: `SELECT name FROM resource_folders WHERE user_email = ?
              UNION SELECT DISTINCT folder AS name FROM resources WHERE user_email = ? AND deleted = 0 AND folder IS NOT NULL
              ORDER BY name COLLATE NOCASE`,
        args: [userEmail, userEmail],
    });
    return result.rows.map((row) => row.name as string);
}

export async function createUserResourceFolder(userEmail: string, name: string): Promise<boolean> {
    await initDB();
    const result = await getDB().execute({
        sql: `INSERT OR IGNORE INTO resource_folders (user_email, name, created_at) VALUES (?, ?, ?)`,
        args: [userEmail, name, new Date().toISOString()],
    });
    return result.rowsAffected > 0;
}

export async function renameUserResourceFolder(userEmail: string, oldName: string, newName: string): Promise<boolean> {
    await initDB();
    const db = getDB();
    const transaction = await db.transaction("write");
    try {
        const existing = await transaction.execute({
            sql: `SELECT name FROM resource_folders WHERE user_email = ? AND name = ? COLLATE NOCASE`,
            args: [userEmail, newName],
        });
        if (existing.rows.length && String(existing.rows[0].name).toLowerCase() !== oldName.toLowerCase()) {
            await transaction.rollback();
            return false;
        }
        if (oldName.toLowerCase() === newName.toLowerCase()) {
            await transaction.execute({
                sql: `UPDATE resource_folders SET name = ? WHERE user_email = ? AND name = ?`,
                args: [newName, userEmail, oldName],
            });
            await transaction.execute({
                sql: `UPDATE resources SET folder = ? WHERE user_email = ? AND folder = ?`,
                args: [newName, userEmail, oldName],
            });
            await transaction.commit();
            return true;
        }
        await transaction.execute({
            sql: `INSERT OR IGNORE INTO resource_folders (user_email, name, created_at)
                  VALUES (?, ?, COALESCE((SELECT created_at FROM resource_folders WHERE user_email = ? AND name = ?), ?))`,
            args: [userEmail, newName, userEmail, oldName, new Date().toISOString()],
        });
        await transaction.execute({
            sql: `UPDATE resources SET folder = ? WHERE user_email = ? AND folder = ?`,
            args: [newName, userEmail, oldName],
        });
        await transaction.execute({
            sql: `DELETE FROM resource_folders WHERE user_email = ? AND name = ?`,
            args: [userEmail, oldName],
        });
        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

export async function deleteUserResourceFolder(userEmail: string, name: string): Promise<void> {
    await initDB();
    const db = getDB();
    const transaction = await db.transaction("write");
    try {
        await transaction.execute({ sql: `UPDATE resources SET folder = NULL WHERE user_email = ? AND folder = ?`, args: [userEmail, name] });
        await transaction.execute({ sql: `DELETE FROM resource_folders WHERE user_email = ? AND name = ?`, args: [userEmail, name] });
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

export async function saveUserResources(
    userEmail: string,
    files: { name: string; type: string; url: string; uploadedAt?: string; conversationId?: string; storage?: string; publicId?: string; resourceType?: string; vectorFileName?: string }[]
) {
    if (files.length === 0) return;
    await initDB();
    const now = new Date().toISOString();
    for (const file of files) {
        await getDB().execute({
            sql: `INSERT INTO resources (id, user_email, name, type, url, uploaded_at, conversation_id, storage, public_id, resource_type, vector_file_name, deleted)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                  ON CONFLICT(user_email, url) DO UPDATE SET
                    name = excluded.name,
                    type = excluded.type,
                    uploaded_at = excluded.uploaded_at,
                    conversation_id = COALESCE(excluded.conversation_id, resources.conversation_id),
                    storage = COALESCE(excluded.storage, resources.storage),
                    public_id = COALESCE(excluded.public_id, resources.public_id),
                    resource_type = COALESCE(excluded.resource_type, resources.resource_type),
                    vector_file_name = COALESCE(resources.vector_file_name, excluded.vector_file_name),
                    deleted = 0`,
            args: [`${userEmail}:${file.url}`, userEmail, file.name, file.type || "application/octet-stream", file.url, file.uploadedAt ?? now, file.conversationId ?? null, file.storage ?? null, file.publicId ?? null, file.resourceType ?? null, file.vectorFileName ?? file.name],
        });
    }
}

export async function getUserConversations(userEmail: string) {
    await initDB();
    const result = await getDB().execute({
        sql: `SELECT * FROM conversations WHERE user_email = ? ORDER BY pinned DESC, updated_at DESC`,
        args: [userEmail],
    });
    return result.rows.map((row) => ({
        id: row.id as string,
        title: row.title as string,
        messages: JSON.parse(row.messages as string),
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
        pinned: row.pinned === 1,
    }));
}

export async function getUserResources(userEmail: string) {
    await initDB();
    const result = await getDB().execute({
        sql: `SELECT name, type, url, uploaded_at, favorite, folder, conversation_id, storage, public_id, resource_type, deleted FROM resources WHERE user_email = ? ORDER BY uploaded_at DESC`,
        args: [userEmail],
    });

    const resources = new Map<string, {
        name: string;
        type: string;
        url: string;
        uploadedAt: string;
        favorite: boolean;
        folder: string | null;
        conversationId: string | null;
        storage: string | null;
        publicId: string | null;
        resourceType: string | null;
    }>();
    const legacyResources: { name: string; type: string; url: string; uploadedAt: string; conversationId?: string }[] = [];
    const knownUrls = new Set<string>();

    for (const row of result.rows) {
        const url = row.url as string;
        knownUrls.add(url);
        if (row.deleted === 1) continue;
        resources.set(url, {
            name: row.name as string,
            type: row.type as string,
            url: row.url as string,
            uploadedAt: row.uploaded_at as string,
            favorite: row.favorite === 1,
            folder: row.folder as string | null,
            conversationId: row.conversation_id as string | null,
            storage: row.storage as string | null,
            publicId: row.public_id as string | null,
            resourceType: row.resource_type as string | null,
        });
    }

    // Backfill uploads made before the independent resources catalog existed.
    const conversations = await getDB().execute({
        sql: `SELECT id, messages, updated_at FROM conversations WHERE user_email = ? ORDER BY updated_at DESC`,
        args: [userEmail],
    });

    for (const row of conversations.rows) {
        let messages: unknown;
        try {
            messages = JSON.parse(row.messages as string);
        } catch {
            continue;
        }
        if (!Array.isArray(messages)) continue;

        for (const message of messages) {
            if (!message || typeof message !== "object") continue;
            const entry = message as { createdAt?: unknown; files?: unknown };
            if (!Array.isArray(entry.files)) continue;

            for (const file of entry.files) {
                if (!file || typeof file !== "object") continue;
                const item = file as { name?: unknown; type?: unknown; url?: unknown };
                if (
                    typeof item.name !== "string" ||
                    typeof item.url !== "string" ||
                    !item.url
                ) continue;

                const key = item.url;
                if (!knownUrls.has(key) && !resources.has(key)) {
                    const createdAt = typeof entry.createdAt === "string" ? entry.createdAt : row.updated_at as string;
                    const legacyResource = {
                        name: item.name,
                        type: typeof item.type === "string" ? item.type : "application/octet-stream",
                        url: item.url,
                        uploadedAt: createdAt,
                        favorite: false,
                        folder: null,
                        conversationId: row.id as string,
                        storage: null,
                        publicId: null,
                        resourceType: null,
                    };
                    resources.set(key, legacyResource);
                    legacyResources.push(legacyResource);
                }
            }
        }
    }

    await saveUserResources(userEmail, legacyResources);

    return Array.from(resources.values());
}

export async function setUserResourceFavorite(userEmail: string, url: string, favorite: boolean) {
    await initDB();
    await getDB().execute({
        sql: `UPDATE resources SET favorite = ? WHERE user_email = ? AND url = ?`,
        args: [favorite ? 1 : 0, userEmail, url],
    });
}

export async function updateUserResource(
    userEmail: string,
    url: string,
    update: { name?: string; folder?: string | null; deleted?: boolean }
) {
    await initDB();
    if (update.deleted) {
        await getDB().execute({
            sql: `UPDATE resources SET deleted = 1 WHERE user_email = ? AND url = ?`,
            args: [userEmail, url],
        });
        return;
    }
    if (typeof update.name === "string") {
        await getDB().execute({
            sql: `UPDATE resources SET name = ? WHERE user_email = ? AND url = ?`,
            args: [update.name, userEmail, url],
        });
    }
    if (update.folder !== undefined) {
        await getDB().execute({
            sql: `UPDATE resources SET folder = ? WHERE user_email = ? AND url = ?`,
            args: [update.folder, userEmail, url],
        });
    }
}

export async function getUserResourceForDeletion(userEmail: string, url: string) {
    await initDB();
    const result = await getDB().execute({
        sql: `SELECT url, storage, public_id, resource_type FROM resources WHERE user_email = ? AND url = ? AND deleted = 0 LIMIT 1`,
        args: [userEmail, url],
    });
    const row = result.rows[0];
    if (!row) return null;
    return {
        url: row.url as string,
        storage: row.storage as string | null,
        publicId: row.public_id as string | null,
        resourceType: row.resource_type as string | null,
    };
}

export async function getUserResourceForChat(userEmail: string, url: string) {
    await initDB();
    const result = await getDB().execute({
        sql: `SELECT name, type, url, conversation_id, COALESCE(vector_file_name, name) AS vector_file_name FROM resources WHERE user_email = ? AND url = ? AND deleted = 0 LIMIT 1`,
        args: [userEmail, url],
    });
    const row = result.rows[0];
    if (!row) return null;
    return {
        name: row.name as string,
        type: row.type as string,
        url: row.url as string,
        conversationId: row.conversation_id as string | null,
        fileName: row.vector_file_name as string,
    };
}

export async function getConversation(userEmail: string, id: string) {
    await initDB();
    const result = await getDB().execute({
        sql: `SELECT * FROM conversations WHERE id = ? AND user_email = ? LIMIT 1`,
        args: [id, userEmail],
    });
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
        id: row.id as string,
        title: row.title as string,
        messages: JSON.parse(row.messages as string),
        createdAt: new Date(row.created_at as string),
        updatedAt: new Date(row.updated_at as string),
        pinned: row.pinned === 1,
    };
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

export async function pinConversation(userEmail: string, id: string, pinned: boolean) {
    await getDB().execute({
        sql: `UPDATE conversations SET pinned = ? WHERE id = ? AND user_email = ?`,
        args: [pinned ? 1 : 0, id, userEmail],
    });
}
