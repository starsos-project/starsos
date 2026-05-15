import pc from "picocolors";
import { runHook } from "../hooks/runner.ts";
import { resolveChatRef } from "../resolve/chat-ref.ts";
import { indexClaudeArchive } from "../scan/indexer.ts";
import { addTag, getTags, removeTag } from "../storage/repositories/chats.ts";

export async function runChatTag(
  ref: string,
  tags: string[],
  opts: { json?: boolean },
): Promise<void> {
  indexClaudeArchive();
  const uuid = resolveChatRef(ref);
  if (uuid === null) {
    process.stderr.write(`${pc.red("error:")} chat not found: ${ref}\n`);
    process.exit(1);
  }
  if (tags.length === 0) {
    process.stderr.write(`${pc.red("error:")} at least one tag required\n`);
    process.exit(1);
  }
  for (const tag of tags) {
    addTag(uuid, tag);
    runHook(
      "post-chat-tag.sh",
      {
        STARSOS_CHAT_UUID: uuid,
        STARSOS_ACTION: "add",
        STARSOS_TAG: tag,
      },
      { wait: false },
    );
  }
  const all = getTags(uuid);
  if (opts.json === true) {
    process.stdout.write(`${JSON.stringify({ uuid, tags: all })}\n`);
  } else {
    process.stdout.write(
      `${pc.green("✓")} tagged ${uuid.slice(0, 8)} as ${tags.join(", ")} ${pc.dim(`(all tags: ${all.join(", ")})`)}\n`,
    );
  }
}

export async function runChatUntag(
  ref: string,
  tags: string[],
  opts: { json?: boolean },
): Promise<void> {
  indexClaudeArchive();
  const uuid = resolveChatRef(ref);
  if (uuid === null) {
    process.stderr.write(`${pc.red("error:")} chat not found: ${ref}\n`);
    process.exit(1);
  }
  if (tags.length === 0) {
    process.stderr.write(`${pc.red("error:")} at least one tag required\n`);
    process.exit(1);
  }
  for (const tag of tags) removeTag(uuid, tag);
  const remaining = getTags(uuid);
  if (opts.json === true) {
    process.stdout.write(`${JSON.stringify({ uuid, tags: remaining })}\n`);
  } else {
    process.stdout.write(
      `${pc.green("✓")} untagged ${uuid.slice(0, 8)} removed ${tags.join(", ")}\n`,
    );
  }
}
