import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import pc from "picocolors";
import { runHook } from "../hooks/runner.ts";
import { buildLiftoff, printLiftoff } from "../liftoff/context.ts";
import { resolveChatRef } from "../resolve/chat-ref.ts";
import { indexClaudeArchive } from "../scan/indexer.ts";
import { getChat } from "../storage/repositories/chats.ts";

export interface ChatResumeOptions {
  newTab?: boolean;
  print?: boolean;
  claudeBin?: string;
  skipLiftoff?: boolean;
}

export async function runChatResume(ref: string, opts: ChatResumeOptions): Promise<void> {
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

  const claudeBin = opts.claudeBin ?? "claude";
  const chatCwd = chat.cwd ?? process.cwd();

  // For --print and --new-tab, show the chat's recorded cwd verbatim.
  if (opts.print === true) {
    process.stdout.write(`cd ${shellQuote(chatCwd)} && ${claudeBin} --resume ${uuid}\n`);
    process.exit(0);
  }
  if (opts.newTab === true) {
    openInNewItermTab(chatCwd, claudeBin, uuid);
    process.stdout.write(`${pc.green("✓")} opened new iTerm tab for ${uuid}\n`);
    process.exit(0);
  }

  // Liftoff: print context block before spawning.
  if (opts.skipLiftoff !== true) {
    const sections = buildLiftoff(chat);
    printLiftoff(sections);
  }

  // Run pre-liftoff hook. Non-zero exit aborts the resume.
  const hook = runHook(
    "pre-liftoff.sh",
    {
      STARSOS_CHAT_UUID: uuid,
      STARSOS_CHAT_CWD: chatCwd,
      STARSOS_PROJECT_SLUG: chat.projectSlug ?? "",
      STARSOS_PROJECT_PATH: chat.projectSlug !== null ? chatCwd : "",
    },
    { wait: true, verbose: true },
  );
  if (hook.ran && hook.exitCode !== 0) {
    process.stderr.write(
      `${pc.red("error:")} pre-liftoff hook aborted resume (exit ${hook.exitCode})\n`,
    );
    process.exit(1);
  }

  // For real spawn: fall back if the recorded cwd no longer exists.
  let spawnCwd = chatCwd;
  if (!existsSync(spawnCwd)) {
    process.stderr.write(
      `${pc.yellow("note:")} chat cwd ${spawnCwd} no longer exists; falling back to current dir\n`,
    );
    spawnCwd = process.cwd();
  }

  const result = spawnSync(claudeBin, ["--resume", uuid], {
    cwd: spawnCwd,
    stdio: "inherit",
  });
  process.exit(result.status ?? 0);
}

function shellQuote(s: string): string {
  // Single-quote escape for sh-like shells.
  return `'${s.replace(/'/g, "'\\''")}'`;
}

function openInNewItermTab(cwd: string, claudeBin: string, uuid: string): void {
  const cmd = `cd ${shellQuote(cwd)} && ${claudeBin} --resume ${uuid}`;
  // AppleScript for iTerm2. Falls back to printing the command if osascript is unavailable.
  const script = `
    tell application "iTerm"
      tell current window
        create tab with default profile
        tell current session of current tab
          write text "${cmd.replace(/"/g, '\\"')}"
        end tell
      end tell
    end tell
  `;
  const result = spawnSync("osascript", ["-e", script]);
  if (result.status !== 0) {
    process.stdout.write(
      `${pc.yellow("note:")} could not open new tab — run this manually:\n  ${cmd}\n`,
    );
  }
}
