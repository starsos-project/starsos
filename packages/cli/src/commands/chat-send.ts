import pc from "picocolors";
import { appendInboxPrompt, countInboxEntries } from "../inbox/inbox.ts";
import { resolveChatRef } from "../resolve/chat-ref.ts";
import { indexClaudeArchive } from "../scan/indexer.ts";

export async function runChatSend(
  ref: string,
  opts: { prompt: string; json?: boolean },
): Promise<void> {
  indexClaudeArchive();
  const uuid = resolveChatRef(ref);
  if (uuid === null) {
    process.stderr.write(`${pc.red("error:")} chat not found: ${ref}\n`);
    process.exit(1);
  }
  if (opts.prompt.trim().length === 0) {
    process.stderr.write(`${pc.red("error:")} --prompt cannot be empty\n`);
    process.exit(1);
  }
  appendInboxPrompt(uuid, opts.prompt);
  const total = countInboxEntries(uuid);
  if (opts.json === true) {
    process.stdout.write(`${JSON.stringify({ uuid, pending: total })}\n`);
  } else {
    process.stdout.write(
      `${pc.green("✓")} queued for ${uuid.slice(0, 8)} ${pc.dim(`(${total} prompt(s) pending)`)}\n`,
    );
    process.stdout.write(
      `${pc.dim("  → will surface on next:")} starsos chat resume ${uuid.slice(0, 8)}\n`,
    );
  }
}
