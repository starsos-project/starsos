import { createInterface } from "node:readline/promises";
import pc from "picocolors";
import { runChatDone } from "../commands/chat-done.ts";
import { runChatLink } from "../commands/chat-link.ts";
import { runChatNote } from "../commands/chat-note.ts";
import { runChatResume } from "../commands/chat-resume.ts";
import { runChatSend } from "../commands/chat-send.ts";
import { runChatShow } from "../commands/chat-show.ts";
import { runChatStatus } from "../commands/chat-status.ts";
import { runChatTag, runChatUntag } from "../commands/chat-tag.ts";
import { runStatus } from "../commands/status.ts";

// Simple readline-based TUI. Renders status on launch and after each command,
// accepts space-separated commands, exits cleanly on q / Ctrl-C / EOF.
export async function runTui(): Promise<void> {
  await render();
  printHelp();

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const shutdown = () => {
    rl.close();
    process.stdout.write(`\n${pc.dim("cockpit closed")}\n`);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let line: string;
    try {
      line = await rl.question(`${pc.cyan("starsos>")} `);
    } catch {
      shutdown();
      return;
    }
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    if (trimmed === "q" || trimmed === "quit" || trimmed === "exit") {
      shutdown();
      return;
    }
    if (trimmed === "?" || trimmed === "help" || trimmed === "h") {
      printHelp();
      continue;
    }
    if (trimmed === "r" || trimmed === "refresh") {
      await render();
      continue;
    }

    try {
      await dispatch(trimmed);
    } catch (err) {
      process.stdout.write(
        `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }
}

async function dispatch(line: string): Promise<void> {
  // Parse: alias-or-ref command [args...]
  const tokens = parseTokens(line);
  if (tokens.length === 0) return;

  const first = tokens[0] ?? "";
  // global commands without a chat ref
  if (first === "status") {
    await runStatus({});
    return;
  }

  const rest = tokens.slice(1);
  const cmd = rest[0] ?? "";
  const args = rest.slice(1);

  switch (cmd) {
    case "resume":
    case "r": {
      const newTab = args.includes("--new-tab") || args.includes("nw");
      const print = args.includes("--print");
      // exit TUI so claude can inherit our terminal
      if (!newTab && !print) {
        process.stdout.write(`${pc.dim("exiting cockpit to spawn claude…")}\n`);
      }
      await runChatResume(first, { newTab, print });
      return;
    }
    case "new":
    case "nw": {
      // "<alias> new window" or "<alias> nw"
      await runChatResume(first, { newTab: true });
      return;
    }
    case "show":
    case "s":
      await runChatShow(first, {});
      return;
    case "tag":
      if (args.length === 0) {
        process.stdout.write(`${pc.yellow("usage:")} <alias> tag <tag> [tag…]\n`);
        return;
      }
      await runChatTag(first, args, {});
      return;
    case "untag":
      if (args.length === 0) {
        process.stdout.write(`${pc.yellow("usage:")} <alias> untag <tag> [tag…]\n`);
        return;
      }
      await runChatUntag(first, args, {});
      return;
    case "note":
      if (args.length === 0) {
        process.stdout.write(`${pc.yellow("usage:")} <alias> note <text>\n`);
        return;
      }
      await runChatNote(first, args.join(" "), {});
      return;
    case "link":
      if (args.length === 0) {
        process.stdout.write(`${pc.yellow("usage:")} <alias> link <project-slug>\n`);
        return;
      }
      await runChatLink(first, { project: args.join(" ") });
      return;
    case "send":
      if (args.length === 0) {
        process.stdout.write(`${pc.yellow("usage:")} <alias> send <prompt>\n`);
        return;
      }
      await runChatSend(first, { prompt: args.join(" ") });
      return;
    case "done": {
      // "<alias> done <status> <summary…>"
      const status = args[0] ?? "FERTIG";
      const summary = args.slice(1).join(" ");
      if (summary.trim().length === 0) {
        process.stdout.write(`${pc.yellow("usage:")} <alias> done <status> <summary…>\n`);
        return;
      }
      await runChatDone(first, { status, summary });
      return;
    }
    case "status":
      await runChatStatus(first, args[0], {});
      return;
    default:
      process.stdout.write(
        `${pc.yellow("?")} unknown command "${cmd}" — try ${pc.cyan("?")} for help\n`,
      );
  }
}

function parseTokens(line: string): string[] {
  // Naive splitter: respects quoted strings.
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null = re.exec(line);
  while (m !== null) {
    tokens.push(m[1] ?? m[2] ?? m[3] ?? "");
    m = re.exec(line);
  }
  return tokens;
}

async function render(): Promise<void> {
  process.stdout.write("\x1b[2J\x1b[H"); // clear screen + home
  await runStatus({});
}

function printHelp(): void {
  process.stdout.write(
    `${pc.dim("commands: <alias> resume | nw | show | tag <t> | untag <t> | note <text> | link <slug> | send <text> | done <status> <summary> | status [s]")}\n`,
  );
  process.stdout.write(
    `${pc.dim("           status (refresh) | r (refresh) | ? (help) | q (quit)")}\n\n`,
  );
}
