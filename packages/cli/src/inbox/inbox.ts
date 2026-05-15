import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getInboxConsumedDir, getInboxDir } from "../storage/paths.ts";

export interface InboxEntry {
  ts: string;
  prompt: string;
}

function inboxPath(uuid: string): string {
  return join(getInboxDir(), `${uuid}.md`);
}

function ensureInboxDir(): void {
  const dir = getInboxDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const consumed = getInboxConsumedDir();
  if (!existsSync(consumed)) mkdirSync(consumed, { recursive: true });
}

// Append a new prompt to a chat's inbox. Inbox file uses a simple
// "# YYYY-MM-DDTHH:MM:SSZ\n<prompt>\n\n" entry format, append-only.
export function appendInboxPrompt(uuid: string, prompt: string): void {
  ensureInboxDir();
  const path = inboxPath(uuid);
  const ts = new Date().toISOString();
  const entry = `# ${ts}\n${prompt}\n\n`;
  if (existsSync(path)) {
    const existing = readFileSync(path, "utf-8");
    writeFileSync(path, existing + entry, "utf-8");
  } else {
    writeFileSync(path, entry, "utf-8");
  }
}

// Parse a chat's inbox into discrete entries.
export function readInboxEntries(uuid: string): InboxEntry[] {
  const path = inboxPath(uuid);
  if (!existsSync(path)) return [];
  const content = readFileSync(path, "utf-8");
  return parseInboxContent(content);
}

export function countInboxEntries(uuid: string): number {
  return readInboxEntries(uuid).length;
}

// Move the inbox file into .consumed/, freeing the slot for future queues.
// Returns the consumed-archive path, or null if no inbox existed.
export function consumeInbox(uuid: string): string | null {
  const path = inboxPath(uuid);
  if (!existsSync(path)) return null;
  ensureInboxDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = join(getInboxConsumedDir(), `${uuid}-${stamp}.md`);
  renameSync(path, target);
  return target;
}

function parseInboxContent(content: string): InboxEntry[] {
  const lines = content.split("\n");
  const entries: InboxEntry[] = [];
  let currentTs: string | null = null;
  let currentBody: string[] = [];
  for (const line of lines) {
    const m = /^# (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)$/.exec(line);
    if (m !== null) {
      if (currentTs !== null) {
        entries.push({ ts: currentTs, prompt: currentBody.join("\n").trim() });
      }
      currentTs = m[1] ?? null;
      currentBody = [];
    } else if (currentTs !== null) {
      currentBody.push(line);
    }
  }
  if (currentTs !== null) {
    entries.push({ ts: currentTs, prompt: currentBody.join("\n").trim() });
  }
  return entries.filter((e) => e.prompt.length > 0);
}
