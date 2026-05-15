import pc from "picocolors";
import { countInboxEntries } from "../inbox/inbox.ts";
import { resolveChatRef } from "../resolve/chat-ref.ts";
import { indexClaudeArchive } from "../scan/indexer.ts";
import { getChat, getTags, setChatStatus } from "../storage/repositories/chats.ts";
import type { ChatStatus } from "../types.ts";

const VALID: ChatStatus[] = ["active", "parked", "done", "archived"];

export async function runChatStatus(
  ref: string,
  newStatus: string | undefined,
  opts: { json?: boolean },
): Promise<void> {
  indexClaudeArchive();
  const uuid = resolveChatRef(ref);
  if (uuid === null) {
    process.stderr.write(`${pc.red("error:")} chat not found: ${ref}\n`);
    process.exit(1);
  }

  if (newStatus === undefined) {
    // Read mode
    const chat = getChat(uuid);
    if (chat === null) {
      process.stderr.write(`${pc.red("error:")} chat not found: ${ref}\n`);
      process.exit(1);
    }
    const tags = getTags(uuid);
    const pending = countInboxEntries(uuid);
    if (opts.json === true) {
      process.stdout.write(
        `${JSON.stringify({
          uuid,
          status: chat.status,
          tags,
          pendingInbox: pending,
          lastMessageAt: chat.lastMessageAt,
          projectSlug: chat.projectSlug,
        })}\n`,
      );
    } else {
      process.stdout.write(
        `${chat.uuid.slice(0, 8)}  ${pc.bold(chat.status)}  tags=[${tags.join(",")}]  inbox=${pending}  last=${chat.lastMessageAt.slice(0, 19)}\n`,
      );
    }
    return;
  }

  if (!VALID.includes(newStatus as ChatStatus)) {
    process.stderr.write(
      `${pc.red("error:")} invalid status '${newStatus}' (allowed: ${VALID.join(", ")})\n`,
    );
    process.exit(1);
  }
  setChatStatus(uuid, newStatus as ChatStatus);
  if (opts.json === true) {
    process.stdout.write(`${JSON.stringify({ uuid, status: newStatus })}\n`);
  } else {
    process.stdout.write(`${pc.green("✓")} ${uuid.slice(0, 8)} status → ${newStatus}\n`);
  }
}
