import { existsSync, readFileSync } from "node:fs";
import pc from "picocolors";
import { countInboxEntries } from "../inbox/inbox.ts";
import { resolveChatRef } from "../resolve/chat-ref.ts";
import { indexClaudeArchive } from "../scan/indexer.ts";
import { getChat, getNotes, getTags } from "../storage/repositories/chats.ts";
import { relativeTime } from "../ui/relative.ts";

export interface ChatShowOptions {
  json?: boolean;
  preview?: number;
}

export async function runChatShow(ref: string, opts: ChatShowOptions): Promise<void> {
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
  const tags = getTags(uuid);
  const notes = getNotes(uuid);
  const pendingInbox = countInboxEntries(uuid);
  const previewLines = previewMessages(chat.jsonlPath, opts.preview ?? 2);

  if (opts.json === true) {
    process.stdout.write(
      `${JSON.stringify(
        {
          uuid: chat.uuid,
          cwd: chat.cwd,
          title: chat.title,
          status: chat.status,
          projectSlug: chat.projectSlug,
          firstMessageAt: chat.firstMessageAt,
          lastMessageAt: chat.lastMessageAt,
          messageCount: chat.messageCount,
          tags,
          notes: notes.map((n) => ({ body: n.body, createdAt: n.createdAt })),
          pendingInbox,
          preview: previewLines,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  process.stdout.write(`${pc.bold(`chat ${chat.uuid}`)}\n`);
  if (chat.title !== null) {
    process.stdout.write(`${pc.dim("title:")} ${chat.title}\n`);
  }
  process.stdout.write(`${pc.dim("cwd:")} ${chat.cwd ?? "—"}\n`);
  process.stdout.write(
    `${pc.dim("status:")} ${chat.status}  ${pc.dim("messages:")} ${chat.messageCount}  ${pc.dim("last:")} ${relativeTime(chat.lastMessageAt)}\n`,
  );
  if (chat.projectSlug !== null) {
    process.stdout.write(`${pc.dim("project:")} ${chat.projectSlug} (${chat.linkMethod ?? "?"})\n`);
  }
  if (tags.length > 0) {
    process.stdout.write(`${pc.dim("tags:")} ${tags.join(", ")}\n`);
  }
  if (pendingInbox > 0) {
    process.stdout.write(`${pc.dim("inbox:")} ${pc.yellow(`${pendingInbox} pending prompt(s)`)}\n`);
  }
  if (notes.length > 0) {
    process.stdout.write(`${pc.dim("notes:")}\n`);
    for (const n of notes) {
      process.stdout.write(`  ${pc.dim(`[${n.createdAt.slice(0, 10)}]`)} ${n.body}\n`);
    }
  }
  if (previewLines.length > 0) {
    process.stdout.write(`${pc.dim("preview:")}\n`);
    for (const p of previewLines) {
      process.stdout.write(`  ${pc.dim(`[${p.kind}]`)} ${p.preview}\n`);
    }
  }
}

interface PreviewLine {
  kind: "user" | "assistant";
  preview: string;
}

function previewMessages(jsonlPath: string, count: number): PreviewLine[] {
  if (!existsSync(jsonlPath)) return [];
  const out: PreviewLine[] = [];
  let content: string;
  try {
    content = readFileSync(jsonlPath, "utf-8");
  } catch {
    return [];
  }
  const lines = content.split("\n").filter((l) => l.length > 0);
  // First N user messages, then last N total user/assistant messages (deduped by uuid)
  for (const line of lines) {
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const type = typeof row.type === "string" ? row.type : null;
    if (type !== "user" && type !== "assistant") continue;
    const text = extractText(row);
    if (text === null) continue;
    out.push({ kind: type, preview: text.slice(0, 100).replace(/\s+/g, " ") });
    if (out.length >= count) break;
  }
  return out;
}

function extractText(row: Record<string, unknown>): string | null {
  const message = row.message as { content?: unknown } | undefined;
  if (message === undefined) return null;
  const c = message.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    for (const part of c) {
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
