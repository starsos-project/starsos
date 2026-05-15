import { randomUUID } from "node:crypto";
import type { Chat, ChatStatus } from "../../types.ts";
import { openDb } from "../db.ts";

interface ChatRow {
  uuid: string;
  jsonl_path: string;
  cwd: string | null;
  project_slug: string | null;
  title: string | null;
  first_message_at: string;
  last_message_at: string;
  message_count: number;
  status: ChatStatus;
  link_method: "auto" | "manual" | null;
  touchdown_log_path: string | null;
  touchdown_status: string | null;
  touchdown_summary: string | null;
  done_at: string | null;
  first_seen_at: string;
  updated_at: string;
}

export interface UpsertChatInput {
  uuid: string;
  jsonlPath: string;
  cwd: string | null;
  title: string | null;
  firstMessageAt: string;
  lastMessageAt: string;
  messageCount: number;
}

function rowToChat(row: ChatRow): Chat {
  return {
    uuid: row.uuid,
    jsonlPath: row.jsonl_path,
    cwd: row.cwd,
    projectSlug: row.project_slug,
    title: row.title,
    firstMessageAt: row.first_message_at,
    lastMessageAt: row.last_message_at,
    messageCount: row.message_count,
    status: row.status,
    linkMethod: row.link_method,
    touchdownLogPath: row.touchdown_log_path,
    touchdownStatus: row.touchdown_status,
    touchdownSummary: row.touchdown_summary,
    doneAt: row.done_at,
    firstSeenAt: row.first_seen_at,
    updatedAt: row.updated_at,
  };
}

// Insert a chat we have never seen, or refresh metadata for an existing one.
// Stars OS owns the row; status/tags/notes/touchdown are NOT touched on refresh.
export function upsertChat(input: UpsertChatInput): void {
  const db = openDb();
  const now = new Date().toISOString();

  const existing = db
    .prepare<{ uuid: string }, [string]>("SELECT uuid FROM chats WHERE uuid = ?")
    .get(input.uuid);

  if (existing === null) {
    db.prepare(
      `INSERT INTO chats (
        uuid, jsonl_path, cwd, project_slug, title,
        first_message_at, last_message_at, message_count,
        status, first_seen_at, updated_at
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'active', ?, ?)`,
    ).run(
      input.uuid,
      input.jsonlPath,
      input.cwd,
      input.title,
      input.firstMessageAt,
      input.lastMessageAt,
      input.messageCount,
      now,
      now,
    );
  } else {
    db.prepare(
      `UPDATE chats SET
        jsonl_path = ?,
        cwd = COALESCE(cwd, ?),
        title = COALESCE(title, ?),
        first_message_at = ?,
        last_message_at = ?,
        message_count = ?,
        updated_at = ?
       WHERE uuid = ?`,
    ).run(
      input.jsonlPath,
      input.cwd,
      input.title,
      input.firstMessageAt,
      input.lastMessageAt,
      input.messageCount,
      now,
      input.uuid,
    );
  }
}

export function getChat(uuid: string): Chat | null {
  const db = openDb();
  const row = db.prepare<ChatRow, [string]>("SELECT * FROM chats WHERE uuid = ?").get(uuid);
  return row === null ? null : rowToChat(row);
}

export interface ListChatsFilter {
  status?: ChatStatus | undefined;
  projectSlug?: string | undefined;
  cwd?: string | undefined;
  limit?: number | undefined;
}

export function listChats(filter: ListChatsFilter = {}): Chat[] {
  const db = openDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.status !== undefined) {
    where.push("status = ?");
    params.push(filter.status);
  }
  if (filter.projectSlug !== undefined) {
    where.push("project_slug = ?");
    params.push(filter.projectSlug);
  }
  if (filter.cwd !== undefined) {
    where.push("cwd = ?");
    params.push(filter.cwd);
  }
  const whereSql = where.length === 0 ? "" : ` WHERE ${where.join(" AND ")}`;
  const limitSql = filter.limit === undefined ? "" : " LIMIT ?";
  if (filter.limit !== undefined) params.push(filter.limit);

  const rows = db
    .prepare<ChatRow, unknown[]>(
      `SELECT * FROM chats${whereSql} ORDER BY last_message_at DESC${limitSql}`,
    )
    .all(...params);
  return rows.map(rowToChat);
}

export function setChatProject(
  uuid: string,
  projectSlug: string | null,
  method: "auto" | "manual",
): void {
  const db = openDb();
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE chats SET project_slug = ?, link_method = ?, updated_at = ? WHERE uuid = ?",
  ).run(projectSlug, method, now, uuid);
}

export function setChatStatus(uuid: string, status: ChatStatus): void {
  const db = openDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE chats SET status = ?, updated_at = ? WHERE uuid = ?").run(status, now, uuid);
}

export interface TouchdownData {
  status: string;
  summary: string;
  logPath: string;
}

export function markChatDone(uuid: string, data: TouchdownData): void {
  const db = openDb();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE chats SET
      status = 'done',
      touchdown_status = ?,
      touchdown_summary = ?,
      touchdown_log_path = ?,
      done_at = ?,
      updated_at = ?
     WHERE uuid = ?`,
  ).run(data.status, data.summary, data.logPath, now, now, uuid);
}

// Tags
export function addTag(uuid: string, tag: string): void {
  const db = openDb();
  const now = new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO chat_tags (chat_uuid, tag, added_at) VALUES (?, ?, ?)").run(
    uuid,
    tag,
    now,
  );
}

export function removeTag(uuid: string, tag: string): void {
  const db = openDb();
  db.prepare("DELETE FROM chat_tags WHERE chat_uuid = ? AND tag = ?").run(uuid, tag);
}

export function getTags(uuid: string): string[] {
  const db = openDb();
  const rows = db
    .prepare<{ tag: string }, [string]>(
      "SELECT tag FROM chat_tags WHERE chat_uuid = ? ORDER BY added_at",
    )
    .all(uuid);
  return rows.map((r) => r.tag);
}

// Notes
export interface NoteRow {
  id: string;
  body: string;
  createdAt: string;
}

export function addNote(uuid: string, body: string): string {
  const db = openDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO chat_notes (id, chat_uuid, body, created_at) VALUES (?, ?, ?, ?)").run(
    id,
    uuid,
    body,
    now,
  );
  return id;
}

export function getNotes(uuid: string): NoteRow[] {
  const db = openDb();
  const rows = db
    .prepare<{ id: string; body: string; created_at: string }, [string]>(
      "SELECT id, body, created_at FROM chat_notes WHERE chat_uuid = ? ORDER BY created_at",
    )
    .all(uuid);
  return rows.map((r) => ({ id: r.id, body: r.body, createdAt: r.created_at }));
}
