import { openDb } from "../db.ts";
import type { Task, TaskBackend, TaskStatus } from "../../types.ts";

interface TaskRow {
  id: string;
  chat_uuid: string;
  prompt: string;
  backend: TaskBackend;
  pid: number | null;
  output_path: string;
  status: TaskStatus;
  started_at: string;
  ended_at: string | null;
  exit_code: number | null;
  tokens_estimated: number | null;
  alias_at_dispatch: string | null;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    chatUuid: row.chat_uuid,
    prompt: row.prompt,
    backend: row.backend,
    pid: row.pid,
    outputPath: row.output_path,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    exitCode: row.exit_code,
    tokensEstimated: row.tokens_estimated,
    aliasAtDispatch: row.alias_at_dispatch,
  };
}

export interface CreateTaskInput {
  id: string;
  chatUuid: string;
  prompt: string;
  backend: TaskBackend;
  pid: number | null;
  outputPath: string;
  aliasAtDispatch: string | null;
}

export function createTask(input: CreateTaskInput): void {
  const db = openDb();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO tasks (
      id, chat_uuid, prompt, backend, pid, output_path,
      status, started_at, alias_at_dispatch
    ) VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?)`,
  ).run(
    input.id,
    input.chatUuid,
    input.prompt,
    input.backend,
    input.pid,
    input.outputPath,
    now,
    input.aliasAtDispatch,
  );
}

export function updateTaskStatus(
  id: string,
  status: TaskStatus,
  exitCode?: number | null,
): void {
  const db = openDb();
  const ended = status === "running" || status === "queued" ? null : new Date().toISOString();
  db.prepare(
    `UPDATE tasks SET
      status = ?,
      exit_code = COALESCE(?, exit_code),
      ended_at = COALESCE(?, ended_at)
     WHERE id = ?`,
  ).run(status, exitCode ?? null, ended, id);
}

export function getTask(id: string): Task | null {
  const db = openDb();
  const row = db.prepare<TaskRow, [string]>("SELECT * FROM tasks WHERE id = ?").get(id);
  return row === null ? null : rowToTask(row);
}

export function listTasks(filter: { status?: TaskStatus; limit?: number } = {}): Task[] {
  const db = openDb();
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.status !== undefined) {
    where.push("status = ?");
    params.push(filter.status);
  }
  const whereSql = where.length === 0 ? "" : ` WHERE ${where.join(" AND ")}`;
  const limitSql = filter.limit === undefined ? "" : " LIMIT ?";
  if (filter.limit !== undefined) params.push(filter.limit);
  const rows = db
    .prepare<TaskRow, unknown[]>(
      `SELECT * FROM tasks${whereSql} ORDER BY started_at DESC${limitSql}`,
    )
    .all(...params);
  return rows.map(rowToTask);
}
