import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { readInboxEntries } from "../inbox/inbox.ts";
import { listChats } from "../storage/repositories/chats.ts";
import type { Chat } from "../types.ts";

export interface LiftoffSection {
  title: string;
  body: string[];
}

// Assembles the liftoff context block for a chat about to be resumed.
// All sections are best-effort: missing data => skipped, no error.
export function buildLiftoff(chat: Chat): LiftoffSection[] {
  const sections: LiftoffSection[] = [];
  const cwd = chat.cwd;

  // 1. Git status
  if (cwd !== null && existsSync(cwd)) {
    const gs = gitStatus(cwd);
    if (gs !== null) sections.push({ title: "git", body: gs });
  }

  // 2. Last session log
  if (cwd !== null) {
    const lastLog = findLastSessionLog(cwd);
    if (lastLog !== null) {
      sections.push({
        title: `last session log · ${lastLog.relPath}`,
        body: lastLog.firstLines,
      });
    }
  }

  // 3. Open tasks from CLAUDE.md
  if (cwd !== null) {
    const tasks = openTasksFromClaudeMd(cwd);
    if (tasks.length > 0) {
      sections.push({ title: "open tasks (CLAUDE.md)", body: tasks });
    }
  }

  // 4. Other active chats in same project
  if (chat.projectSlug !== null) {
    const others = listChats({ projectSlug: chat.projectSlug, limit: 20 })
      .filter((c) => c.uuid !== chat.uuid && c.status === "active")
      .slice(0, 5);
    if (others.length > 0) {
      sections.push({
        title: "other active chats in this project",
        body: others.map((c) => `${c.uuid.slice(0, 8)}  ${(c.title ?? "").slice(0, 60)}`),
      });
    }
  }

  // 5. Pending inbox
  const inbox = readInboxEntries(chat.uuid);
  if (inbox.length > 0) {
    sections.push({
      title: `inbox · ${inbox.length} queued prompt(s)`,
      body: inbox.map((e) => `[${e.ts.slice(0, 16)}] ${e.prompt.slice(0, 100)}`),
    });
  }

  // 6. Infisical hint
  if (cwd !== null) {
    const slug = infisicalSlugFromProject(cwd);
    if (slug !== null) {
      sections.push({
        title: "infisical",
        body: [`proj secrets env ${slug}`],
      });
    }
  }

  return sections;
}

export function printLiftoff(sections: LiftoffSection[]): void {
  if (sections.length === 0) {
    process.stdout.write(`${pc.dim("liftoff:")} ${pc.dim("(no context available)")}\n`);
    return;
  }
  process.stdout.write(`${pc.bold("═══ liftoff ═══")}\n`);
  for (const s of sections) {
    process.stdout.write(`${pc.dim(s.title)}\n`);
    for (const line of s.body) {
      process.stdout.write(`  ${line}\n`);
    }
    process.stdout.write("\n");
  }
}

function gitStatus(cwd: string): string[] | null {
  if (!existsSync(join(cwd, ".git"))) return null;
  const branchRes = spawnSync("git", ["branch", "--show-current"], {
    cwd,
    encoding: "utf-8",
  });
  const statusRes = spawnSync("git", ["status", "--porcelain"], {
    cwd,
    encoding: "utf-8",
  });
  if (branchRes.status !== 0 || statusRes.status !== 0) return null;
  const branch = (branchRes.stdout ?? "").trim();
  const lines = (statusRes.stdout ?? "").split("\n").filter((l) => l.length > 0);
  const out = [`branch: ${branch || "(detached)"}`];
  if (lines.length === 0) {
    out.push("clean");
  } else {
    out.push(`${lines.length} uncommitted change(s)`);
    for (const l of lines.slice(0, 5)) out.push(`  ${l}`);
    if (lines.length > 5) out.push(`  ... +${lines.length - 5} more`);
  }
  return out;
}

interface FoundLog {
  relPath: string;
  firstLines: string[];
}

function findLastSessionLog(cwd: string): FoundLog | null {
  const dir = join(cwd, "session-logs");
  if (!existsSync(dir)) return null;
  let entries: string[];
  try {
    entries = readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    return null;
  }
  if (entries.length === 0) return null;
  // newest by mtime
  let best: string | null = null;
  let bestMtime = 0;
  for (const f of entries) {
    try {
      const st = statSync(join(dir, f));
      if (st.mtimeMs > bestMtime) {
        bestMtime = st.mtimeMs;
        best = f;
      }
    } catch {
      // ignore
    }
  }
  if (best === null) return null;
  const content = readFileSync(join(dir, best), "utf-8");
  return {
    relPath: `session-logs/${best}`,
    firstLines: content.split("\n").slice(0, 10),
  };
}

function openTasksFromClaudeMd(cwd: string): string[] {
  const path = join(cwd, "CLAUDE.md");
  if (!existsSync(path)) return [];
  try {
    const content = readFileSync(path, "utf-8");
    return content
      .split("\n")
      .filter((l) => /^\s*-\s*\[\s\]\s*/.test(l))
      .slice(0, 8)
      .map((l) => l.trim());
  } catch {
    return [];
  }
}

function infisicalSlugFromProject(cwd: string): string | null {
  // Check .starsos.toml first
  const tomlPath = join(cwd, ".starsos.toml");
  if (existsSync(tomlPath)) {
    try {
      const content = readFileSync(tomlPath, "utf-8");
      const m = /infisical_slug\s*=\s*["']([^"']+)["']/.exec(content);
      if (m !== null) return m[1] ?? null;
    } catch {
      // ignore
    }
  }
  // Check CLAUDE.md
  const claudePath = join(cwd, "CLAUDE.md");
  if (existsSync(claudePath)) {
    try {
      const content = readFileSync(claudePath, "utf-8");
      const m = /Infisical[:\s]+\/?(\S+)/i.exec(content);
      if (m !== null) return m[1] ?? null;
    } catch {
      // ignore
    }
  }
  return null;
}
