import { Command } from "commander";
import pc from "picocolors";
import { runChatDone } from "./commands/chat-done.ts";
import { runChatLink } from "./commands/chat-link.ts";
import { runChatList } from "./commands/chat-list.ts";
import { runChatNote } from "./commands/chat-note.ts";
import { runChatResume } from "./commands/chat-resume.ts";
import { runChatSend } from "./commands/chat-send.ts";
import { runChatShow } from "./commands/chat-show.ts";
import { runChatStatus } from "./commands/chat-status.ts";
import { runChatTag, runChatUntag } from "./commands/chat-tag.ts";
import {
  runChatTask,
  runChatTaskAbort,
  runChatTaskList,
  runChatTaskShow,
} from "./commands/chat-task.ts";
import { runChatWatch } from "./commands/chat-watch.ts";
import { printInitResult, runInit } from "./commands/init.ts";
import { runStatus } from "./commands/status.ts";
import { runInteractiveTui } from "./tui/interactive.ts";
import { runTui } from "./tui/repl.ts";

// Version is injected by bundler from package.json at build time.
// For dev (bun run via tsx-like path), fall back to a constant.
const VERSION = "0.1.0-alpha.1";

const program = new Command();

program
  .name("starsos")
  .description("Stars OS — operator layer for AI-native work. CLI cockpit for Claude Code chats.")
  .version(VERSION, "-v, --version", "print version");

program
  .command("init")
  .description("bootstrap ~/.starsos/ (idempotent)")
  .option("--json", "structured JSON output")
  .action((opts: { json?: boolean }) => {
    try {
      const result = runInit();
      printInitResult(result, opts.json === true);
      process.exit(0);
    } catch (err) {
      process.stderr.write(
        `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    }
  });

program
  .command("status")
  .description("cockpit view: projects grouped, chats numbered A1/A2/B1 (the Game-Loop)")
  .option("--json", "structured JSON output")
  .option("--plain", "grep-friendly tab-separated output")
  .option("--here", "filter to current $CLAUDE_PROJECT_DIR / cwd")
  .option("--limit <n>", "max total chats to show (default 15)", (v) => Number.parseInt(v, 10))
  .option("--all", "show all project groups and chats (no pagination)")
  .action(
    async (opts: {
      json?: boolean;
      plain?: boolean;
      here?: boolean;
      limit?: number;
      all?: boolean;
    }) => {
      try {
        await runStatus(opts);
        process.exit(0);
      } catch (err) {
        process.stderr.write(
          `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
        );
        process.exit(2);
      }
    },
  );

const chat = program.command("chat").description("manage Claude chats from your archive");

chat
  .command("list")
  .description("list all Claude chats (newest first)")
  .option("--json", "structured JSON output")
  .option("--plain", "grep-friendly tab-separated output")
  .option("--limit <n>", "max chats to show", (v) => Number.parseInt(v, 10), 100)
  .action(async (opts: { json?: boolean; plain?: boolean; limit?: number }) => {
    try {
      await runChatList(opts);
      process.exit(0);
    } catch (err) {
      process.stderr.write(
        `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    }
  });

chat
  .command("show")
  .argument("<ref>", "uuid, prefix, alias (A2), or '.' for current chat")
  .description("show chat metadata and preview without resuming")
  .option("--json", "structured JSON output")
  .option("--preview <n>", "number of message previews", (v) => Number.parseInt(v, 10), 2)
  .action(async (ref: string, opts: { json?: boolean; preview?: number }) => {
    try {
      await runChatShow(ref, opts);
      process.exit(0);
    } catch (err) {
      process.stderr.write(
        `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    }
  });

chat
  .command("resume")
  .argument("<ref>", "uuid, prefix, alias (A2), or '.' for current chat")
  .description("resume a chat via `claude --resume <uuid>` in this terminal")
  .option("--new-tab", "open in a new iTerm2 tab instead (macOS only)")
  .option("--print", "print the command without executing it")
  .option("--claude-bin <path>", "override the claude binary", "claude")
  .action(async (ref: string, opts: { newTab?: boolean; print?: boolean; claudeBin?: string }) => {
    try {
      await runChatResume(ref, opts);
      process.exit(0);
    } catch (err) {
      process.stderr.write(
        `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    }
  });

chat
  .command("tag")
  .argument("<ref>", "chat ref")
  .argument("<tags...>", "one or more tags")
  .description("add tags to a chat (own metadata, JSONL untouched)")
  .option("--json", "structured output")
  .action(async (ref: string, tags: string[], opts: { json?: boolean }) => {
    try {
      await runChatTag(ref, tags, opts);
      process.exit(0);
    } catch (err) {
      process.stderr.write(
        `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    }
  });

chat
  .command("untag")
  .argument("<ref>", "chat ref")
  .argument("<tags...>", "one or more tags to remove")
  .description("remove tags from a chat")
  .option("--json", "structured output")
  .action(async (ref: string, tags: string[], opts: { json?: boolean }) => {
    try {
      await runChatUntag(ref, tags, opts);
      process.exit(0);
    } catch (err) {
      process.stderr.write(
        `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    }
  });

chat
  .command("note")
  .argument("<ref>", "chat ref")
  .argument("<body...>", "note body (multi-word becomes one note)")
  .description("attach a note to a chat (your own metadata)")
  .option("--json", "structured output")
  .action(async (ref: string, body: string[], opts: { json?: boolean }) => {
    try {
      await runChatNote(ref, body.join(" "), opts);
      process.exit(0);
    } catch (err) {
      process.stderr.write(
        `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    }
  });

chat
  .command("link")
  .argument("<ref>", "chat ref")
  .description("link a chat to a project (manual override of auto-detection)")
  .option("--project <slug>", "project slug (auto-created if new)")
  .option("--unlink", "remove an existing link")
  .option("--json", "structured output")
  .action(async (ref: string, opts: { project?: string; unlink?: boolean; json?: boolean }) => {
    try {
      await runChatLink(ref, opts);
      process.exit(0);
    } catch (err) {
      process.stderr.write(
        `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    }
  });

chat
  .command("send")
  .argument("<ref>", "chat ref")
  .description("queue a prompt that surfaces on next chat resume (inbox pattern)")
  .requiredOption("--prompt <text>", "the prompt to queue")
  .option("--json", "structured output")
  .action(async (ref: string, opts: { prompt: string; json?: boolean }) => {
    try {
      await runChatSend(ref, opts);
      process.exit(0);
    } catch (err) {
      process.stderr.write(
        `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    }
  });

chat
  .command("done")
  .argument("<ref>", "chat ref")
  .description("touchdown: writes session log + marks chat done + runs post-touchdown hook")
  .requiredOption("--status <status>", "FERTIG | IN_ARBEIT | BLOCKED (or your own)")
  .requiredOption("--summary <text>", "one-line summary")
  .option("--log-dir <path>", "override session-log directory")
  .option("--json", "structured output")
  .action(
    async (
      ref: string,
      opts: {
        status: string;
        summary: string;
        logDir?: string;
        json?: boolean;
      },
    ) => {
      try {
        await runChatDone(ref, opts);
        process.exit(0);
      } catch (err) {
        process.stderr.write(
          `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
        );
        process.exit(2);
      }
    },
  );

chat
  .command("watch")
  .description("watch claude_archive_path for chat updates and live-update the index")
  .option("--notify", "send macOS notifications on updates (osascript)")
  .action(async (opts: { notify?: boolean }) => {
    try {
      await runChatWatch(opts);
    } catch (err) {
      process.stderr.write(
        `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    }
  });

chat
  .command("task")
  .argument("<ref>", "chat ref")
  .description("dispatch background subagent task in chat context (headless claude)")
  .requiredOption("--prompt <text>", "the prompt to dispatch")
  .option("--wait", "block until task completes")
  .option("--claude-bin <path>", "override the claude binary", "claude")
  .option("--json", "structured output")
  .action(
    async (
      ref: string,
      opts: { prompt: string; wait?: boolean; claudeBin?: string; json?: boolean },
    ) => {
      try {
        await runChatTask(ref, opts);
        process.exit(0);
      } catch (err) {
        process.stderr.write(
          `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
        );
        process.exit(2);
      }
    },
  );

chat
  .command("task-list")
  .description("list recent tasks (running, recent, failed)")
  .option("--json", "structured output")
  .action(async (opts: { json?: boolean }) => {
    try {
      await runChatTaskList(opts);
      process.exit(0);
    } catch (err) {
      process.stderr.write(
        `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    }
  });

chat
  .command("task-show")
  .argument("<id>", "task id or prefix")
  .description("show task metadata + output")
  .option("--json", "structured output")
  .option("--tail <n>", "show last N lines of output", (v) => Number.parseInt(v, 10))
  .action(async (id: string, opts: { json?: boolean; tail?: number }) => {
    try {
      await runChatTaskShow(id, opts);
      process.exit(0);
    } catch (err) {
      process.stderr.write(
        `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    }
  });

chat
  .command("task-abort")
  .argument("<id>", "task id or prefix")
  .description("abort a running task (SIGTERM)")
  .option("--json", "structured output")
  .action(async (id: string, opts: { json?: boolean }) => {
    try {
      await runChatTaskAbort(id, opts);
      process.exit(0);
    } catch (err) {
      process.stderr.write(
        `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    }
  });

chat
  .command("status")
  .argument("<ref>", "chat ref")
  .argument("[new-status]", "active|parked|done|archived (omit to read)")
  .description("get or set per-chat status")
  .option("--json", "structured output")
  .action(async (ref: string, newStatus: string | undefined, opts: { json?: boolean }) => {
    try {
      await runChatStatus(ref, newStatus, opts);
      process.exit(0);
    } catch (err) {
      process.stderr.write(
        `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(2);
    }
  });

// If invoked without any args, drop into the interactive TUI cockpit.
// --legacy-repl forces the older line-based REPL.
if (process.argv.length <= 2) {
  runInteractiveTui().catch((err) => {
    process.stderr.write(
      `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(2);
  });
} else if (process.argv.length === 3 && process.argv[2] === "--legacy-repl") {
  runTui().catch((err) => {
    process.stderr.write(
      `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(2);
  });
} else {
  program.parseAsync(process.argv).catch((err) => {
    process.stderr.write(
      `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(2);
  });
}
