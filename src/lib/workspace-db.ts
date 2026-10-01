import { randomBytes, randomUUID, createHash } from "node:crypto";
import { getDB } from "@/lib/db";

export type Workspace = {
  id: string;
  name: string;
  description: string | null;
  role: string;
  createdAt: string;
  memberCount?: number;
  unreadCount?: number;
};
export type WorkspaceMessage = {
  id: string;
  workspaceId: string;
  userEmail: string;
  userName: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  clientMessageId: string | null;
  replyToId: string | null;
  replyTo: { id: string; userName: string; content: string } | null;
  attachments: WorkspaceMessageAttachment[];
  reactions: WorkspaceMessageReaction[];
};
export type WorkspaceMessageAttachment = { id: string; name: string; type: string; size: number; url: string };
export type StoredWorkspaceMessageAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  storageUrl: string;
};
export type WorkspaceMessageReaction = { emoji: string; count: number; reacted: boolean };

let workspaceDBInit: Promise<void> | null = null;

export function initWorkspaceDB() {
  if (!workspaceDBInit) {
    workspaceDBInit = initializeWorkspaceDB().catch((error) => {
      workspaceDBInit = null;
      throw error;
    });
  }
  return workspaceDBInit;
}

async function initializeWorkspaceDB() {
  const db = getDB();
  await db.execute(
    `CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL)`,
  );
  await db.execute(
    `CREATE TABLE IF NOT EXISTS workspace_members (workspace_id TEXT NOT NULL, user_email TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', joined_at TEXT NOT NULL, PRIMARY KEY(workspace_id, user_email), FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE)`,
  );
  try {
    await db.execute(`ALTER TABLE workspace_members ADD COLUMN avatar_url TEXT`);
  } catch (error) {
    if (!String(error).toLowerCase().includes("duplicate column")) throw error;
  }
  await db.execute(
    `CREATE TABLE IF NOT EXISTS workspace_invitations (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, email TEXT NOT NULL, invited_by TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, expires_at TEXT NOT NULL, accepted_at TEXT, UNIQUE(workspace_id, email, status))`,
  );
  await db.execute(
    `CREATE TABLE IF NOT EXISTS workspace_messages (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, user_email TEXT NOT NULL, user_name TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL, client_message_id TEXT, reply_to_message_id TEXT, attachments TEXT NOT NULL DEFAULT '[]')`,
  );
  try {
    await db.execute(`ALTER TABLE workspace_messages ADD COLUMN client_message_id TEXT`);
  } catch (error) {
    if (!String(error).toLowerCase().includes("duplicate column")) throw error;
  }
  try {
    await db.execute(`ALTER TABLE workspace_messages ADD COLUMN reply_to_message_id TEXT`);
  } catch (error) {
    if (!String(error).toLowerCase().includes("duplicate column")) throw error;
  }
  try {
    await db.execute(`ALTER TABLE workspace_messages ADD COLUMN attachments TEXT NOT NULL DEFAULT '[]'`);
  } catch (error) {
    if (!String(error).toLowerCase().includes("duplicate column")) throw error;
  }
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_workspace_messages ON workspace_messages(workspace_id, created_at)`,
  );
  await db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_messages_idempotency ON workspace_messages(workspace_id, user_email, client_message_id) WHERE client_message_id IS NOT NULL`,
  );
  await db.execute(`CREATE TABLE IF NOT EXISTS workspace_read_cursors (workspace_id TEXT NOT NULL, user_email TEXT NOT NULL, last_read_created_at TEXT NOT NULL, last_read_message_id TEXT NOT NULL, PRIMARY KEY(workspace_id,user_email))`);
  await db.execute(`CREATE TABLE IF NOT EXISTS workspace_message_reactions (workspace_id TEXT NOT NULL, message_id TEXT NOT NULL, user_email TEXT NOT NULL, emoji TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(message_id,user_email,emoji))`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_workspace_message_reactions_workspace ON workspace_message_reactions(workspace_id,message_id)`);
  await db.execute(
    `CREATE TABLE IF NOT EXISTS workspace_projects (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, created_by TEXT NOT NULL, created_at TEXT NOT NULL)`,
  );
  await db.execute(
    `CREATE TABLE IF NOT EXISTS workspace_resources (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, project_id TEXT, name TEXT NOT NULL, type TEXT NOT NULL, url TEXT NOT NULL, shared_by TEXT NOT NULL, created_at TEXT NOT NULL)`,
  );
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export async function listWorkspaces(email: string): Promise<Workspace[]> {
  await initWorkspaceDB();
  const result = await getDB().execute({
    sql: `SELECT w.id,w.name,w.description,m.role,w.created_at,(SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id=w.id) AS member_count,(SELECT COUNT(*) FROM workspace_messages msg LEFT JOIN workspace_read_cursors c ON c.workspace_id=w.id AND c.user_email=m.user_email WHERE msg.workspace_id=w.id AND msg.user_email!=m.user_email AND (c.last_read_created_at IS NULL OR msg.created_at>c.last_read_created_at OR (msg.created_at=c.last_read_created_at AND msg.id>c.last_read_message_id))) AS unread_count FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id WHERE m.user_email=? ORDER BY w.created_at DESC`,
    args: [normalizeEmail(email)],
  });
  return result.rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    description: r.description ? String(r.description) : null,
    role: String(r.role),
    createdAt: String(r.created_at),
    memberCount: Number(r.member_count ?? 0),
    unreadCount: Number(r.unread_count ?? 0),
  }));
}
export async function createWorkspace(
  email: string,
  displayName: string,
  name: string,
  description = "",
  avatarUrl: string | null = null,
) {
  await initWorkspaceDB();
  const id = randomUUID();
  const now = new Date().toISOString();
  const owner = normalizeEmail(email);
  const tx = await getDB().transaction("write");
  try {
    await tx.execute({
      sql: `INSERT INTO workspaces(id,name,description,created_by,created_at) VALUES(?,?,?,?,?)`,
      args: [id, name.trim(), description.trim() || null, owner, now],
    });
    await tx.execute({
      sql: `INSERT INTO workspace_members(workspace_id,user_email,display_name,role,joined_at,avatar_url) VALUES(?,?,?,?,?,?)`,
      args: [id, owner, displayName || owner, "owner", now, avatarUrl],
    });
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
  return {
    id,
    name: name.trim(),
    description: description.trim() || null,
    role: "owner",
    createdAt: now,
  };
}
export async function isWorkspaceMember(workspaceId: string, email: string) {
  await initWorkspaceDB();
  const r = await getDB().execute({
    sql: `SELECT 1 FROM workspace_members WHERE workspace_id=? AND user_email=?`,
    args: [workspaceId, normalizeEmail(email)],
  });
  return r.rows.length > 0;
}
export async function getWorkspaceForMember(
  workspaceId: string,
  email: string,
) {
  await initWorkspaceDB();
  const r = await getDB().execute({
    sql: `SELECT w.id,w.name,w.description,m.role,w.created_at FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id WHERE w.id=? AND m.user_email=?`,
    args: [workspaceId, normalizeEmail(email)],
  });
  const row = r.rows[0];
  return row
    ? {
        id: String(row.id),
        name: String(row.name),
        description: row.description ? String(row.description) : null,
        role: String(row.role),
        createdAt: String(row.created_at),
      }
    : null;
}

export async function listWorkspaceMembers(workspaceId: string) {
  await initWorkspaceDB();
  const r = await getDB().execute({
    sql: `SELECT user_email,display_name FROM workspace_members WHERE workspace_id=? ORDER BY display_name COLLATE NOCASE`,
    args: [workspaceId],
  });
  return r.rows.map((row) => ({
    email: String(row.user_email),
    name: String(row.display_name),
  }));
}
export async function createInvitation(
  workspaceId: string,
  email: string,
  inviter: string,
) {
  await initWorkspaceDB();
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const id = randomUUID();
  const tx = await getDB().transaction("write");
  try {
    await tx.execute({
      sql: `UPDATE workspace_invitations SET status='superseded-' || id WHERE workspace_id=? AND email=? AND status='pending'`,
      args: [workspaceId, normalizeEmail(email)],
    });
    await tx.execute({
      sql: `INSERT INTO workspace_invitations(id,workspace_id,email,invited_by,token_hash,created_at,expires_at) VALUES(?,?,?,?,?,?,?)`,
      args: [
        id,
        workspaceId,
        normalizeEmail(email),
        normalizeEmail(inviter),
        createHash("sha256").update(token).digest("hex"),
        now.toISOString(),
        new Date(now.getTime() + 7 * 86400000).toISOString(),
      ],
    });
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
  return token;
}
export async function getInvitation(token: string) {
  await initWorkspaceDB();
  const r = await getDB().execute({
    sql: `SELECT i.id,i.workspace_id,i.email,i.status,i.expires_at,w.name FROM workspace_invitations i JOIN workspaces w ON w.id=i.workspace_id WHERE i.token_hash=?`,
    args: [createHash("sha256").update(token).digest("hex")],
  });
  const row = r.rows[0];
  if (
    !row ||
    row.status !== "pending" ||
    new Date(String(row.expires_at)).getTime() < Date.now()
  )
    return null;
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    email: String(row.email),
    name: String(row.name),
  };
}
export async function acceptInvitation(
  token: string,
  email: string,
  displayName: string,
  avatarUrl: string | null = null,
) {
  const invite = await getInvitation(token);
  if (!invite || invite.email !== normalizeEmail(email)) return false;
  const now = new Date().toISOString();
  const tx = await getDB().transaction("write");
  try {
    await tx.execute({
      sql: `INSERT OR IGNORE INTO workspace_members(workspace_id,user_email,display_name,role,joined_at,avatar_url) VALUES(?,?,?,?,?,?)`,
      args: [
        invite.workspaceId,
        normalizeEmail(email),
        displayName || email,
        "member",
        now,
        avatarUrl,
      ],
    });
    const changed = await tx.execute({
      sql: `UPDATE workspace_invitations SET status='accepted',accepted_at=? WHERE id=? AND status='pending'`,
      args: [now, invite.id],
    });
    if (!changed.rowsAffected) {
      await tx.rollback();
      return false;
    }
    await tx.commit();
    return true;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}
export async function listWorkspaceMessages(
  workspaceId: string,
  viewerEmail = "",
): Promise<WorkspaceMessage[]> {
  await initWorkspaceDB();
  const r = await getDB().execute({
    sql: `SELECT m.id,m.workspace_id,m.user_email,m.user_name,m.role,m.content,m.created_at,m.client_message_id,m.reply_to_message_id,m.attachments,parent.id AS reply_parent_id,parent.user_name AS reply_parent_user_name,parent.content AS reply_parent_content FROM (SELECT * FROM workspace_messages WHERE workspace_id=? ORDER BY created_at DESC,id DESC LIMIT 300) m LEFT JOIN workspace_messages parent ON parent.id=m.reply_to_message_id AND parent.workspace_id=m.workspace_id ORDER BY m.created_at ASC,m.id ASC`,
    args: [workspaceId],
  });
  return mapWorkspaceMessageRows(workspaceId, r.rows, viewerEmail);
}

export async function listWorkspaceMessagesSince(
  workspaceId: string,
  cursor: { createdAt: string; id: string } | null,
  viewerEmail = "",
): Promise<WorkspaceMessage[]> {
  if (!cursor) return listWorkspaceMessages(workspaceId, viewerEmail);
  await initWorkspaceDB();
  const r = await getDB().execute({
    sql: `SELECT m.id,m.workspace_id,m.user_email,m.user_name,m.role,m.content,m.created_at,m.client_message_id,m.reply_to_message_id,m.attachments,parent.id AS reply_parent_id,parent.user_name AS reply_parent_user_name,parent.content AS reply_parent_content FROM workspace_messages m LEFT JOIN workspace_messages parent ON parent.id=m.reply_to_message_id AND parent.workspace_id=m.workspace_id WHERE m.workspace_id=? AND (m.created_at>? OR (m.created_at=? AND m.id>?)) ORDER BY m.created_at ASC,m.id ASC LIMIT 300`,
    args: [workspaceId, cursor.createdAt, cursor.createdAt, cursor.id],
  });
  return mapWorkspaceMessageRows(workspaceId, r.rows, viewerEmail);
}

function parseMessageAttachments(value: unknown): StoredWorkspaceMessageAttachment[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is StoredWorkspaceMessageAttachment => Boolean(item && typeof item === "object" && typeof (item as StoredWorkspaceMessageAttachment).id === "string" && typeof (item as StoredWorkspaceMessageAttachment).name === "string" && typeof (item as StoredWorkspaceMessageAttachment).type === "string" && typeof (item as StoredWorkspaceMessageAttachment).storageUrl === "string"));
  } catch { return []; }
}

async function mapWorkspaceMessageRows(workspaceId: string, rows: readonly unknown[], viewerEmail: string): Promise<WorkspaceMessage[]> {
  const messages = rows.map((raw): WorkspaceMessage => {
    const v = raw as Record<string, unknown>;
    return {
      id: String(v.id), workspaceId: String(v.workspace_id), userEmail: String(v.user_email), userName: String(v.user_name),
      role: v.role as "user" | "assistant", content: String(v.content), createdAt: String(v.created_at),
      clientMessageId: v.client_message_id ? String(v.client_message_id) : null,
      replyToId: v.reply_to_message_id ? String(v.reply_to_message_id) : null,
      replyTo: v.reply_parent_id ? { id: String(v.reply_parent_id), userName: String(v.reply_parent_user_name), content: String(v.reply_parent_content) } : null,
      attachments: parseMessageAttachments(v.attachments).map((attachment) => ({ id: attachment.id, name: attachment.name, type: attachment.type, size: attachment.size, url: `/api/workspaces/${workspaceId}/messages/${String(v.id)}/attachments/${attachment.id}` })),
      reactions: [],
    };
  });
  if (!messages.length) return messages;
  const ids = messages.map((message) => message.id);
  const reactionRows = await getDB().execute({
    sql: `SELECT message_id,user_email,emoji FROM workspace_message_reactions WHERE workspace_id=? AND message_id IN (${ids.map(() => "?").join(",")}) ORDER BY created_at`,
    args: [workspaceId, ...ids],
  });
  const groups = new Map<string, Map<string, { count: number; reacted: boolean }>>();
  const normalizedViewer = normalizeEmail(viewerEmail);
  for (const row of reactionRows.rows) {
    const messageId = String(row.message_id), emoji = String(row.emoji);
    const byEmoji = groups.get(messageId) ?? new Map();
    const group = byEmoji.get(emoji) ?? { count: 0, reacted: false };
    group.count++;
    group.reacted ||= String(row.user_email) === normalizedViewer;
    byEmoji.set(emoji, group);
    groups.set(messageId, byEmoji);
  }
  messages.forEach((message) => { message.reactions = [...(groups.get(message.id) ?? new Map()).entries()].map(([emoji, value]) => ({ emoji, ...value })); });
  return messages;
}

export async function markWorkspaceRead(workspaceId: string, email: string) {
  await initWorkspaceDB();
  const normalized = normalizeEmail(email);
  const result = await getDB().execute({
    sql: `SELECT created_at,id FROM workspace_messages WHERE workspace_id=? ORDER BY created_at DESC,id DESC LIMIT 1`,
    args: [workspaceId],
  });
  const latest = result.rows[0];
  if (!latest) return { createdAt: null, id: null };
  const createdAt = String(latest.created_at);
  const id = String(latest.id);
  await getDB().execute({
    sql: `INSERT INTO workspace_read_cursors(workspace_id,user_email,last_read_created_at,last_read_message_id) VALUES(?,?,?,?) ON CONFLICT(workspace_id,user_email) DO UPDATE SET last_read_created_at=excluded.last_read_created_at,last_read_message_id=excluded.last_read_message_id WHERE excluded.last_read_created_at>workspace_read_cursors.last_read_created_at OR (excluded.last_read_created_at=workspace_read_cursors.last_read_created_at AND excluded.last_read_message_id>workspace_read_cursors.last_read_message_id)`,
    args: [workspaceId, normalized, createdAt, id],
  });
  return { createdAt, id };
}

export async function insertWorkspaceMessage(
  workspaceId: string,
  email: string,
  name: string,
  role: "user" | "assistant",
  content: string,
  clientMessageId: string | null = null,
  messageId?: string,
  replyToMessageId: string | null = null,
  attachments: StoredWorkspaceMessageAttachment[] = [],
): Promise<{ message: WorkspaceMessage; inserted: boolean }> {
  await initWorkspaceDB();
  let replyTo: WorkspaceMessage["replyTo"] = null;
  if (replyToMessageId) {
    const parent = await getDB().execute({
      sql: `SELECT id,user_name,content FROM workspace_messages WHERE workspace_id=? AND id=? LIMIT 1`,
      args: [workspaceId, replyToMessageId],
    });
    if (!parent.rows[0]) throw new Error("Reply target was not found in this workspace");
    replyTo = { id: String(parent.rows[0].id), userName: String(parent.rows[0].user_name), content: String(parent.rows[0].content) };
  }
  const itemId = messageId ?? randomUUID();
  const item: WorkspaceMessage = {
    id: itemId,
    workspaceId,
    userEmail: normalizeEmail(email),
    userName: name,
    role,
    content,
    createdAt: new Date().toISOString(),
    clientMessageId,
    replyToId: replyToMessageId,
    replyTo,
    attachments: attachments.map((attachment) => ({ id: attachment.id, name: attachment.name, type: attachment.type, size: attachment.size, url: `/api/workspaces/${workspaceId}/messages/${itemId}/attachments/${attachment.id}` })),
    reactions: [],
  };
  const result = await getDB().execute({
    sql: `INSERT OR IGNORE INTO workspace_messages(id,workspace_id,user_email,user_name,role,content,created_at,client_message_id,reply_to_message_id,attachments) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    args: [
      item.id,
      item.workspaceId,
      item.userEmail,
      item.userName,
      item.role,
      item.content,
      item.createdAt,
      item.clientMessageId,
      item.replyToId,
      JSON.stringify(attachments),
    ],
  });
  if (result.rowsAffected) return { message: item, inserted: true };
  if (!clientMessageId) throw new Error("Workspace message insert was ignored");
  const existing = await getDB().execute({
    sql: `SELECT m.id,m.workspace_id,m.user_email,m.user_name,m.role,m.content,m.created_at,m.client_message_id,m.reply_to_message_id,m.attachments,parent.id AS reply_parent_id,parent.user_name AS reply_parent_user_name,parent.content AS reply_parent_content FROM workspace_messages m LEFT JOIN workspace_messages parent ON parent.id=m.reply_to_message_id AND parent.workspace_id=m.workspace_id WHERE m.workspace_id=? AND m.user_email=? AND m.client_message_id=? LIMIT 1`,
    args: [workspaceId, item.userEmail, clientMessageId],
  });
  const row = existing.rows[0];
  if (!row) throw new Error("Could not retrieve the existing workspace message");
  return {
    message: {
      id: String(row.id),
      workspaceId: String(row.workspace_id),
      userEmail: String(row.user_email),
      userName: String(row.user_name),
      role: row.role as "user" | "assistant",
      content: String(row.content),
      createdAt: String(row.created_at),
      clientMessageId: row.client_message_id ? String(row.client_message_id) : null,
      replyToId: row.reply_to_message_id ? String(row.reply_to_message_id) : null,
      replyTo: row.reply_parent_id ? { id: String(row.reply_parent_id), userName: String(row.reply_parent_user_name), content: String(row.reply_parent_content) } : null,
      attachments: parseMessageAttachments(row.attachments).map((attachment) => ({ id: attachment.id, name: attachment.name, type: attachment.type, size: attachment.size, url: `/api/workspaces/${workspaceId}/messages/${String(row.id)}/attachments/${attachment.id}` })),
      reactions: [],
    },
    inserted: false,
  };
}

export async function getWorkspaceMessageByClientId(workspaceId: string, email: string, clientMessageId: string) {
  await initWorkspaceDB();
  const result = await getDB().execute({
    sql: `SELECT m.id,m.workspace_id,m.user_email,m.user_name,m.role,m.content,m.created_at,m.client_message_id,m.reply_to_message_id,m.attachments,parent.id AS reply_parent_id,parent.user_name AS reply_parent_user_name,parent.content AS reply_parent_content FROM workspace_messages m LEFT JOIN workspace_messages parent ON parent.id=m.reply_to_message_id AND parent.workspace_id=m.workspace_id WHERE m.workspace_id=? AND m.user_email=? AND m.client_message_id=? LIMIT 1`,
    args: [workspaceId, normalizeEmail(email), clientMessageId],
  });
  const rows = await mapWorkspaceMessageRows(workspaceId, result.rows, email);
  return rows[0] ?? null;
}

export async function getWorkspaceMessageAttachment(workspaceId: string, messageId: string, attachmentId: string) {
  await initWorkspaceDB();
  const result = await getDB().execute({
    sql: `SELECT attachments FROM workspace_messages WHERE workspace_id=? AND id=? LIMIT 1`,
    args: [workspaceId, messageId],
  });
  if (!result.rows[0]) return null;
  return parseMessageAttachments(result.rows[0].attachments).find((attachment) => attachment.id === attachmentId) ?? null;
}

export async function toggleWorkspaceMessageReaction(workspaceId: string, messageId: string, email: string, emoji: string) {
  await initWorkspaceDB();
  const db = getDB();
  const normalizedEmail = normalizeEmail(email);
  const found = await db.execute({
    sql: `SELECT 1 FROM workspace_messages WHERE id=? AND workspace_id=? LIMIT 1`,
    args: [messageId, workspaceId],
  });
  if (!found.rows.length) return null;
  const existing = await db.execute({
    sql: `SELECT 1 FROM workspace_message_reactions WHERE message_id=? AND user_email=? AND emoji=? LIMIT 1`,
    args: [messageId, normalizedEmail, emoji],
  });
  if (existing.rows.length) {
    await db.execute({ sql: `DELETE FROM workspace_message_reactions WHERE message_id=? AND user_email=? AND emoji=?`, args: [messageId, normalizedEmail, emoji] });
  } else {
    await db.execute({
      sql: `INSERT OR IGNORE INTO workspace_message_reactions(workspace_id,message_id,user_email,emoji,created_at) VALUES(?,?,?,?,?)`,
      args: [workspaceId, messageId, normalizedEmail, emoji, new Date().toISOString()],
    });
  }
  const reactions = await db.execute({
    sql: `SELECT emoji,user_email FROM workspace_message_reactions WHERE workspace_id=? AND message_id=? ORDER BY created_at`,
    args: [workspaceId, messageId],
  });
  const groups = new Map<string, { count: number; reacted: boolean }>();
  for (const row of reactions.rows) {
    const key = String(row.emoji), current = groups.get(key) ?? { count: 0, reacted: false };
    current.count++;
    current.reacted ||= String(row.user_email) === normalizedEmail;
    groups.set(key, current);
  }
  return [...groups.entries()].map(([key, value]) => ({ emoji: key, ...value }));
}

export async function addWorkspaceResource(
  workspaceId: string,
  projectId: string | null,
  resource: { name: string; type: string; url: string },
  sharedBy: string,
) {
  await initWorkspaceDB();
  if (projectId) {
    const project = await getDB().execute({
      sql: `SELECT id FROM workspace_projects WHERE id=? AND workspace_id=?`,
      args: [projectId, workspaceId],
    });
    if (!project.rows.length) throw new Error("Project not found");
  }
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  await getDB().execute({
    sql: `INSERT INTO workspace_resources(id,workspace_id,project_id,name,type,url,shared_by,created_at) VALUES(?,?,?,?,?,?,?,?)`,
    args: [
      id,
      workspaceId,
      projectId,
      resource.name,
      resource.type || "application/octet-stream",
      resource.url,
      normalizeEmail(sharedBy),
      createdAt,
    ],
  });
  return {
    id,
    projectId,
    name: resource.name,
    type: resource.type || "application/octet-stream",
    url: `/api/workspaces/${workspaceId}/resources/${id}/file`,
    createdAt,
  };
}
