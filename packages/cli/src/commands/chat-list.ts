import Table from "cli-table3";
import pc from "picocolors";
import { indexClaudeArchive } from "../scan/indexer.ts";
import { getTags, listChats } from "../storage/repositories/chats.ts";
import { relativeTime, truncate } from "../ui/relative.ts";

export interface ChatListOptions {
  json?: boolean;
  plain?: boolean;
  limit?: number;
}

export async function runChatList(opts: ChatListOptions): Promise<void> {
  indexClaudeArchive();
  const chats = listChats({ limit: opts.limit ?? 100 });

  if (opts.json === true) {
    const out = chats.map((c) => ({
      uuid: c.uuid,
      cwd: c.cwd,
      title: c.title,
      lastMessageAt: c.lastMessageAt,
      messageCount: c.messageCount,
      status: c.status,
      projectSlug: c.projectSlug,
      tags: getTags(c.uuid),
    }));
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
    return;
  }

  if (chats.length === 0) {
    process.stdout.write(`${pc.dim("no chats found in archive")}\n`);
    return;
  }

  if (opts.plain === true) {
    for (const c of chats) {
      process.stdout.write(
        `${c.uuid}\t${c.status}\t${c.lastMessageAt}\t${c.messageCount}\t${c.title ?? ""}\n`,
      );
    }
    return;
  }

  const table = new Table({
    head: ["UUID", "STATUS", "LAST", "MSGS", "TITLE"],
    style: { head: ["dim"], border: ["gray"] },
    colWidths: [12, 10, 14, 6, 60],
    wordWrap: false,
  });

  for (const c of chats) {
    table.push([
      c.uuid.slice(0, 8),
      colorStatus(c.status),
      relativeTime(c.lastMessageAt),
      String(c.messageCount),
      truncate(c.title, 58),
    ]);
  }

  process.stdout.write(`${table.toString()}\n`);
  process.stdout.write(
    `\n${pc.dim(`${chats.length} chat(s). hint:`)} ${pc.cyan("starsos chat show <uuid>")}\n`,
  );
}

function colorStatus(s: string): string {
  switch (s) {
    case "active":
      return pc.green(s);
    case "parked":
      return pc.yellow(s);
    case "done":
      return pc.dim(s);
    case "archived":
      return pc.dim(s);
    default:
      return s;
  }
}
