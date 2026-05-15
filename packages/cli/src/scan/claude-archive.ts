import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";

// Metadata extracted from a single Claude JSONL by scanning its lines.
// Does not load the full conversation into memory.
export interface ScannedChat {
  uuid: string;
  jsonlPath: string;
  cwd: string | null;
  title: string | null;
  firstMessageAt: string;
  lastMessageAt: string;
  messageCount: number;
}

// Walks the Claude archive root (e.g. ~/.claude/projects) and yields ScannedChat
// for every *.jsonl found.
export function scanClaudeArchive(rootPath: string): ScannedChat[] {
  if (!existsSync(rootPath)) return [];
  const out: ScannedChat[] = [];
  walkJsonlFiles(rootPath, (path) => {
    const scanned = scanJsonlFile(path);
    if (scanned !== null) out.push(scanned);
  });
  return out;
}

export function scanJsonlFile(jsonlPath: string): ScannedChat | null {
  if (!existsSync(jsonlPath) || !jsonlPath.endsWith(".jsonl")) return null;

  const uuid = basename(jsonlPath).replace(/\.jsonl$/, "");
  let firstMessageAt: string | null = null;
  let lastMessageAt: string | null = null;
  let messageCount = 0;
  let cwd: string | null = null;
  let title: string | null = null;

  let content: string;
  try {
    content = readFileSync(jsonlPath, "utf-8");
  } catch {
    return null;
  }

  const lines = content.split("\n");
  for (const line of lines) {
    if (line.length === 0) continue;
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const type = typeof row.type === "string" ? row.type : null;
    if (type !== "user" && type !== "assistant") continue;
    messageCount += 1;
    const ts = typeof row.timestamp === "string" ? row.timestamp : null;
    if (ts !== null) {
      if (firstMessageAt === null) firstMessageAt = ts;
      lastMessageAt = ts;
    }
    if (cwd === null && typeof row.cwd === "string") {
      cwd = row.cwd;
    }
    if (title === null && type === "user") {
      const text = extractUserText(row);
      if (text !== null) {
        title = text.slice(0, 80).split("\n")[0]?.trim() ?? null;
      }
    }
  }

  if (firstMessageAt === null || lastMessageAt === null) {
    // No user/assistant messages found — fall back to file mtime.
    try {
      const mtime = statSync(jsonlPath).mtime.toISOString();
      firstMessageAt = mtime;
      lastMessageAt = mtime;
    } catch {
      return null;
    }
  }

  return {
    uuid,
    jsonlPath,
    cwd,
    title,
    firstMessageAt,
    lastMessageAt,
    messageCount,
  };
}

function extractUserText(row: Record<string, unknown>): string | null {
  const message = row.message as { content?: unknown } | undefined;
  if (message === undefined) return null;
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    for (const part of content) {
      if (
        typeof part === "object" &&
        part !== null &&
        "text" in part &&
        typeof (part as { text: unknown }).text === "string"
      ) {
        return (part as { text: string }).text;
      }
    }
  }
  return null;
}

function walkJsonlFiles(root: string, onFile: (path: string) => void): void {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(root, name);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walkJsonlFiles(full, onFile);
    } else if (st.isFile() && name.endsWith(".jsonl")) {
      onFile(full);
    }
  }
}
