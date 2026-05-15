import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, openSync, statSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { resolveChatRef } from "../resolve/chat-ref.ts";
import { indexClaudeArchive } from "../scan/indexer.ts";
import { readAliases } from "../state/aliases.ts";
import { getChat } from "../storage/repositories/chats.ts";
import {
  createTask,
  getTask,
  listTasks,
  updateTaskStatus,
} from "../storage/repositories/tasks.ts";
import { getTasksDir } from "../storage/paths.ts";

export interface ChatTaskOptions {
  prompt: string;
  json?: boolean;
  claudeBin?: string;
  wait?: boolean;
}

// Dispatch a task to a chat as a background subagent.
// Uses Headless Claude Code (`claude --resume <uuid> -p "prompt"`).
export async function runChatTask(
  ref: string,
  opts: ChatTaskOptions,
): Promise<void> {
  indexClaudeArchive();
  const uuid = resolveChatRef(ref);
  if (uuid === null) {
    process.stderr.write(`${pc.red("error:")} chat not found: ${ref}\n`);
    process.exit(1);
  }
  const chat = getChat(uuid);
  if (chat === null) {
    process.stderr.write(`${pc.red("error:")} chat not found: ${ref}\n`);
    process.exit(1);
  }
  if (opts.prompt.trim().length === 0) {
    process.stderr.write(`${pc.red("error:")} --prompt cannot be empty\n`);
    process.exit(1);
  }

  const claudeBin = opts.claudeBin ?? "claude";
  let cwd = chat.cwd ?? process.cwd();
  if (!existsSync(cwd)) {
    cwd = process.cwd();
  }

  const tasksDir = getTasksDir();
  if (!existsSync(tasksDir)) mkdirSync(tasksDir, { recursive: true });

  const taskId = randomUUID();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reverseAlias = (readAliases()?.reverse ?? {})[uuid] ?? null;
  const aliasLabel = reverseAlias ?? uuid.slice(0, 8);
  const outputPath = join(tasksDir, `${aliasLabel}-${stamp}.out`);

  // Spawn detached so the parent CLI can return without waiting.
  const fd = openSync(outputPath, "w");
  const child = spawn(claudeBin, ["--resume", uuid, "-p", opts.prompt], {
    cwd,
    detached: true,
    stdio: ["ignore", fd, fd],
  });

  createTask({
    id: taskId,
    chatUuid: uuid,
    prompt: opts.prompt,
    backend: "headless-claude",
    pid: child.pid ?? null,
    outputPath,
    aliasAtDispatch: reverseAlias,
  });

  // Update task status when the child exits.
  child.on("exit", (code) => {
    updateTaskStatus(taskId, code === 0 ? "done" : "failed", code);
  });
  child.on("error", () => {
    updateTaskStatus(taskId, "failed", null);
  });

  // If --wait, block until the child exits; otherwise detach.
  if (opts.wait === true) {
    await new Promise<void>((resolve) => {
      child.on("exit", () => resolve());
    });
  } else {
    child.unref();
  }

  if (opts.json === true) {
    process.stdout.write(
      `${JSON.stringify({
        taskId,
        chatUuid: uuid,
        backend: "headless-claude",
        pid: child.pid,
        outputPath,
        alias: reverseAlias,
      })}\n`,
    );
    return;
  }

  process.stdout.write(`${pc.green("✓")} task queued for ${aliasLabel}\n`);
  process.stdout.write(`  ${pc.dim("→ task id:")} ${taskId}\n`);
  process.stdout.write(`  ${pc.dim("→ pid:")} ${child.pid ?? "?"}\n`);
  process.stdout.write(`  ${pc.dim("→ output:")} ${outputPath}\n`);
  if (opts.wait !== true) {
    process.stdout.write(
      `  ${pc.dim("→ status:")} ${pc.cyan("starsos chat task-list")} or ${pc.cyan("starsos chat task-show")} ${taskId.slice(0, 8)}\n`,
    );
  }
}

export async function runChatTaskList(opts: { json?: boolean }): Promise<void> {
  // Refresh status: any "running" task whose PID is dead → mark failed.
  reconcileTaskStatuses();
  const tasks = listTasks({ limit: 50 });
  if (opts.json === true) {
    process.stdout.write(
      `${JSON.stringify(
        tasks.map((t) => ({
          id: t.id,
          chatUuid: t.chatUuid,
          alias: t.aliasAtDispatch,
          status: t.status,
          startedAt: t.startedAt,
          endedAt: t.endedAt,
          pid: t.pid,
        })),
        null,
        2,
      )}\n`,
    );
    return;
  }
  if (tasks.length === 0) {
    process.stdout.write(`${pc.dim("no tasks yet")}\n`);
    return;
  }
  for (const t of tasks) {
    const status = colorStatus(t.status);
    const alias = t.aliasAtDispatch ?? t.chatUuid.slice(0, 8);
    process.stdout.write(
      `${t.id.slice(0, 8)}  ${status}  ${alias}  ${t.startedAt.slice(11, 19)}  ${t.prompt.slice(0, 50)}\n`,
    );
  }
}

export async function runChatTaskShow(
  taskId: string,
  opts: { json?: boolean; tail?: number },
): Promise<void> {
  reconcileTaskStatuses();
  const task = resolveTaskRef(taskId);
  if (task === null) {
    process.stderr.write(`${pc.red("error:")} task not found: ${taskId}\n`);
    process.exit(1);
  }
  let output = "";
  if (existsSync(task.outputPath)) {
    output = await Bun.file(task.outputPath).text();
  }
  if (opts.json === true) {
    process.stdout.write(
      `${JSON.stringify({
        id: task.id,
        chatUuid: task.chatUuid,
        status: task.status,
        pid: task.pid,
        exitCode: task.exitCode,
        startedAt: task.startedAt,
        endedAt: task.endedAt,
        outputPath: task.outputPath,
        output: opts.tail !== undefined ? tailLines(output, opts.tail) : output,
      })}\n`,
    );
    return;
  }
  const status = colorStatus(task.status);
  process.stdout.write(`${pc.bold("task")} ${task.id}\n`);
  process.stdout.write(`${pc.dim("status:")} ${status}  ${pc.dim("pid:")} ${task.pid ?? "?"}  ${pc.dim("started:")} ${task.startedAt}\n`);
  process.stdout.write(`${pc.dim("prompt:")} ${task.prompt}\n`);
  process.stdout.write(`${pc.dim("output:")} ${task.outputPath}\n`);
  process.stdout.write("---\n");
  process.stdout.write(opts.tail !== undefined ? tailLines(output, opts.tail) : output);
  if (!output.endsWith("\n")) process.stdout.write("\n");
}

export async function runChatTaskAbort(
  taskId: string,
  opts: { json?: boolean },
): Promise<void> {
  const task = resolveTaskRef(taskId);
  if (task === null) {
    process.stderr.write(`${pc.red("error:")} task not found: ${taskId}\n`);
    process.exit(1);
  }
  if (task.status !== "running") {
    process.stderr.write(
      `${pc.yellow("note:")} task ${task.id.slice(0, 8)} is already ${task.status}\n`,
    );
    process.exit(0);
  }
  if (task.pid !== null) {
    try {
      process.kill(task.pid, "SIGTERM");
    } catch {
      // Process may already be gone.
    }
  }
  updateTaskStatus(task.id, "aborted");
  if (opts.json === true) {
    process.stdout.write(`${JSON.stringify({ id: task.id, status: "aborted" })}\n`);
  } else {
    process.stdout.write(`${pc.green("✓")} aborted task ${task.id.slice(0, 8)}\n`);
  }
}

function resolveTaskRef(ref: string): ReturnType<typeof getTask> {
  // Exact id wins, else prefix.
  const exact = getTask(ref);
  if (exact !== null) return exact;
  const candidates = listTasks({ limit: 500 }).filter((t) => t.id.startsWith(ref));
  return candidates.length === 1 ? candidates[0] ?? null : null;
}

function reconcileTaskStatuses(): void {
  const running = listTasks({ status: "running", limit: 100 });
  for (const t of running) {
    if (t.pid === null) continue;
    if (!isProcessAlive(t.pid)) {
      // Process ended but exit handler didn't fire (e.g. CLI restarted).
      // Determine final status from output file size: if file grew at all, call it done.
      let exitCode: number | null = null;
      try {
        const st = statSync(t.outputPath);
        if (st.size === 0) exitCode = -1;
      } catch {
        exitCode = -1;
      }
      updateTaskStatus(t.id, exitCode === 0 ? "done" : "failed", exitCode);
    }
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function tailLines(text: string, n: number): string {
  const lines = text.split("\n");
  return lines.slice(Math.max(0, lines.length - n)).join("\n");
}

function colorStatus(s: string): string {
  switch (s) {
    case "running":
      return pc.cyan(s);
    case "done":
      return pc.green(s);
    case "failed":
      return pc.red(s);
    case "aborted":
      return pc.yellow(s);
    case "queued":
      return pc.dim(s);
    default:
      return s;
  }
}

// Mark spawnSync as referenced even though we use spawn for detached.
void spawnSync;
