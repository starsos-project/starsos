import pc from "picocolors";
import { runHook } from "../hooks/runner.ts";
import { resolveChatRef } from "../resolve/chat-ref.ts";
import { indexClaudeArchive } from "../scan/indexer.ts";
import { addNote, getNotes } from "../storage/repositories/chats.ts";

export async function runChatNote(
  ref: string,
  body: string,
  opts: { json?: boolean },
): Promise<void> {
  indexClaudeArchive();
  const uuid = resolveChatRef(ref);
  if (uuid === null) {
    process.stderr.write(`${pc.red("error:")} chat not found: ${ref}\n`);
    process.exit(1);
  }
  if (body.trim().length === 0) {
    process.stderr.write(`${pc.red("error:")} note body cannot be empty\n`);
    process.exit(1);
  }
  const id = addNote(uuid, body);
  runHook(
    "post-chat-note.sh",
    {
      STARSOS_CHAT_UUID: uuid,
      STARSOS_ACTION: "append",
      STARSOS_NOTE_BODY: body,
    },
    { wait: false },
  );
  const all = getNotes(uuid);
  if (opts.json === true) {
    process.stdout.write(`${JSON.stringify({ uuid, noteId: id, notes: all })}\n`);
  } else {
    process.stdout.write(
      `${pc.green("✓")} note attached to ${uuid.slice(0, 8)} ${pc.dim(`(${all.length} total)`)}\n`,
    );
  }
}
