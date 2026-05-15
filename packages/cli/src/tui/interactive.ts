import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import pc from "picocolors";
import { runChatDone } from "../commands/chat-done.ts";
import { runChatNote } from "../commands/chat-note.ts";
import { runChatSend } from "../commands/chat-send.ts";
import { runChatTag } from "../commands/chat-tag.ts";
import { runChatTask } from "../commands/chat-task.ts";
import { countInboxEntries } from "../inbox/inbox.ts";
import { indexClaudeArchive } from "../scan/indexer.ts";
import { autoDetectProjects } from "../scan/project-detect.ts";
import { writeAliases } from "../state/aliases.ts";
import { getTags, listChats } from "../storage/repositories/chats.ts";
import { listProjects } from "../storage/repositories/projects.ts";
import type { Chat, Project } from "../types.ts";
import { relativeTime, truncate } from "../ui/relative.ts";

// Page size — number of chats visible in the cockpit at once.
const PAGE_SIZE = 30;

interface Row {
  kind: "header" | "chat";
  alias: string;
  uuid: string;
  cwd: string | null;
  title: string | null;
  status: string;
  lastMessageAt: string;
  messageCount: number;
  tags: string[];
  pendingInbox: number;
  projectName: string;
}

interface CockpitState {
  rows: Row[];
  chatRows: Row[]; // rows where kind === "chat" — selectable
  selectedIndex: number; // index into chatRows
  scrollOffset: number; // chat index at top of viewport
  totals: { active: number; parked: number; done: number; total: number };
  message: string | null; // transient feedback line
}

export async function runInteractiveTui(): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write(
      `${pc.red("error:")} interactive TUI needs a real terminal. Use \`starsos status\` instead.\n`,
    );
    process.exit(1);
  }

  const state = buildState();
  if (state.chatRows.length === 0) {
    process.stdout.write(`${pc.dim("no chats indexed yet. run starsos init first.")}\n`);
    process.exit(0);
  }

  enterAltScreen();
  process.stdin.setRawMode(true);
  emitKeypressEvents(process.stdin);
  process.stdin.resume();

  const cleanup = () => {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    leaveAltScreen();
  };
  const exit = (code: number): never => {
    cleanup();
    process.exit(code);
  };

  process.on("SIGINT", () => exit(0));
  process.on("SIGTERM", () => exit(0));

  render(state);

  return new Promise<void>((resolve) => {
    process.stdin.on("keypress", async (_str, key) => {
      if (key === undefined) return;
      if ((key.ctrl === true && key.name === "c") || key.name === "q") {
        cleanup();
        resolve();
        process.exit(0);
      }
      const current = state.chatRows[state.selectedIndex];

      switch (key.name) {
        case "up":
        case "k":
          state.selectedIndex = Math.max(0, state.selectedIndex - 1);
          adjustScroll(state);
          state.message = null;
          render(state);
          break;
        case "down":
        case "j":
          state.selectedIndex = Math.min(state.chatRows.length - 1, state.selectedIndex + 1);
          adjustScroll(state);
          state.message = null;
          render(state);
          break;
        case "pageup":
          state.selectedIndex = Math.max(0, state.selectedIndex - PAGE_SIZE);
          adjustScroll(state);
          state.message = null;
          render(state);
          break;
        case "pagedown":
          state.selectedIndex = Math.min(
            state.chatRows.length - 1,
            state.selectedIndex + PAGE_SIZE,
          );
          adjustScroll(state);
          state.message = null;
          render(state);
          break;
        case "home":
          state.selectedIndex = 0;
          adjustScroll(state);
          state.message = null;
          render(state);
          break;
        case "end":
          state.selectedIndex = state.chatRows.length - 1;
          adjustScroll(state);
          state.message = null;
          render(state);
          break;
        case "return":
          if (current !== undefined) {
            cleanup();
            await openInNewTab(current);
            // After spawn, re-enter TUI if iTerm2 was used (spawn was async).
            // Simpler: exit cleanly — user is now in the new tab.
            process.stdout.write(
              `${pc.green("✓")} opened ${current.alias} (${current.uuid.slice(0, 8)}) in a new iTerm tab\n`,
            );
            resolve();
            process.exit(0);
          }
          break;
        case "r":
          if (current !== undefined) {
            cleanup();
            await resumeInCurrent(current);
            resolve();
            process.exit(0);
          }
          break;
        case "t":
          if (current !== undefined) await promptAndTask(state, current);
          break;
        case "n":
          if (current !== undefined) await promptAndNote(state, current);
          break;
        case "s":
          if (current !== undefined) await promptAndSend(state, current);
          break;
        case "g":
          if (current !== undefined) await promptAndTag(state, current);
          break;
        case "d":
          if (current !== undefined) await promptAndDone(state, current);
          break;
        case "f5":
        case "f": // also accept 'f' for refresh
          refresh(state);
          render(state);
          break;
        case "h":
        case "?":
          await showHelp();
          render(state);
          break;
        default:
          break;
      }
    });
  });
}

function buildState(): CockpitState {
  indexClaudeArchive();
  autoDetectProjects();
  const projects = listProjects().filter((p) => p.status === "active");
  const chats = listChats({ limit: 10_000 });

  const byProject = new Map<string, Chat[]>();
  const unlinked: Chat[] = [];
  for (const c of chats) {
    if (c.projectSlug === null) {
      unlinked.push(c);
    } else {
      const list = byProject.get(c.projectSlug) ?? [];
      list.push(c);
      byProject.set(c.projectSlug, list);
    }
  }

  // Group order: by most recent chat activity in that project.
  const groups: Array<{ project: Project | null; chats: Chat[] }> = [];
  for (const p of projects) {
    const list = byProject.get(p.slug);
    if (list === undefined || list.length === 0) continue;
    list.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    groups.push({ project: p, chats: list });
  }
  groups.sort((a, b) => {
    const aLast = a.chats[0]?.lastMessageAt ?? "";
    const bLast = b.chats[0]?.lastMessageAt ?? "";
    return bLast.localeCompare(aLast);
  });
  if (unlinked.length > 0) {
    unlinked.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    groups.push({ project: null, chats: unlinked });
  }

  // Assign aliases (Spreadsheet-style A..Z, AA..ZZ).
  const rows: Row[] = [];
  const aliasMap: Record<string, string> = {};
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    if (group === undefined) continue;
    const letter = projectLetter(gi);
    const projName = group.project?.name ?? "(unlinked)";
    rows.push({
      kind: "header",
      alias: letter,
      uuid: "",
      cwd: null,
      title: null,
      status: "",
      lastMessageAt: "",
      messageCount: 0,
      tags: [],
      pendingInbox: 0,
      projectName: projName,
    });
    for (let ci = 0; ci < group.chats.length; ci++) {
      const chat = group.chats[ci];
      if (chat === undefined) continue;
      const alias = `${letter}${ci + 1}`;
      aliasMap[alias] = chat.uuid;
      rows.push({
        kind: "chat",
        alias,
        uuid: chat.uuid,
        cwd: chat.cwd,
        title: chat.title,
        status: chat.status,
        lastMessageAt: chat.lastMessageAt,
        messageCount: chat.messageCount,
        tags: getTags(chat.uuid),
        pendingInbox: countInboxEntries(chat.uuid),
        projectName: projName,
      });
    }
  }
  writeAliases(aliasMap);

  const chatRows = rows.filter((r) => r.kind === "chat");
  const totals = {
    active: chatRows.filter((r) => r.status === "active").length,
    parked: chatRows.filter((r) => r.status === "parked").length,
    done: chatRows.filter((r) => r.status === "done").length,
    total: chatRows.length,
  };

  return {
    rows,
    chatRows,
    selectedIndex: 0,
    scrollOffset: 0,
    totals,
    message: null,
  };
}

function refresh(state: CockpitState): void {
  const previousUuid = state.chatRows[state.selectedIndex]?.uuid;
  const fresh = buildState();
  Object.assign(state, fresh);
  if (previousUuid !== undefined) {
    const newIdx = state.chatRows.findIndex((r) => r.uuid === previousUuid);
    if (newIdx >= 0) state.selectedIndex = newIdx;
  }
  adjustScroll(state);
  state.message = pc.dim(`refreshed at ${new Date().toLocaleTimeString()}`);
}

function adjustScroll(state: CockpitState): void {
  if (state.selectedIndex < state.scrollOffset) {
    state.scrollOffset = state.selectedIndex;
  } else if (state.selectedIndex >= state.scrollOffset + PAGE_SIZE) {
    state.scrollOffset = state.selectedIndex - PAGE_SIZE + 1;
  }
}

function render(state: CockpitState): void {
  process.stdout.write("\x1b[2J\x1b[H");
  const termWidth = Math.max(60, process.stdout.columns ?? 100);

  // Header
  process.stdout.write(
    `${pc.bold("Stars OS")} ${pc.dim("cockpit")}  ${pc.dim(`${state.totals.active} active · ${state.totals.parked} parked · ${state.totals.done} done · ${state.totals.total} total`)}\n`,
  );
  process.stdout.write(
    `${pc.dim("↑↓ navigate · Enter = new iTerm tab · r = resume here · t = task · n = note · s = send · g = tag · d = done · f5 = refresh · ? = help · q = quit")}\n\n`,
  );

  // Show a slice of chatRows; render each chat row, optionally preceded by
  // its project header if it's the first chat in that project section.
  const start = state.scrollOffset;
  const end = Math.min(state.chatRows.length, start + PAGE_SIZE);
  let lastProject = "";
  for (let i = start; i < end; i++) {
    const row = state.chatRows[i];
    if (row === undefined) continue;
    if (row.projectName !== lastProject) {
      lastProject = row.projectName;
      const letter = row.alias.replace(/\d+$/, "");
      process.stdout.write(`\n${pc.cyan(letter)}  ${pc.bold(row.projectName)}\n`);
    }
    renderChatRow(row, i === state.selectedIndex, termWidth);
  }

  // Footer
  process.stdout.write("\n");
  if (state.message !== null) {
    process.stdout.write(`${state.message}\n`);
  }
  process.stdout.write(
    `${pc.dim(`chat ${state.selectedIndex + 1} / ${state.chatRows.length}`)}\n`,
  );
}

function renderChatRow(row: Row, selected: boolean, termWidth: number): void {
  const status = colorStatus(row.status);
  const ago = relativeTime(row.lastMessageAt).padEnd(12);
  const msgs = String(row.messageCount).padStart(4);
  const inbox = row.pendingInbox > 0 ? pc.yellow(`+${row.pendingInbox}`) : pc.dim("  ");
  const tags = truncate(row.tags.join(","), 12).padEnd(12);
  const titleSpace = Math.max(20, termWidth - 70);
  const title = truncate(row.title, titleSpace - 1);
  const alias = row.alias.padEnd(5);

  const indicator = selected ? pc.cyan("▸") : " ";
  const linePrefix = `${indicator} ${selected ? pc.bold(alias) : pc.cyan(alias)}`;
  const line = `${linePrefix}  ${status.padEnd(8)}  ${ago}  ${msgs}  ${inbox}  ${tags}  ${title}`;
  if (selected) {
    process.stdout.write(`${pc.inverse(line)}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
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

function projectLetter(i: number): string {
  let n = i;
  let s = "";
  while (true) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return s;
}

async function openInNewTab(row: Row): Promise<void> {
  const cwd = row.cwd && existsSync(row.cwd) ? row.cwd : process.cwd();
  const cmd = `cd ${shellQuote(cwd)} && claude --resume ${row.uuid}`;
  const script = `
    tell application "iTerm"
      tell current window
        create tab with default profile
        tell current session of current tab
          write text "${cmd.replace(/"/g, '\\"')}"
        end tell
      end tell
      activate
    end tell
  `;
  const r = spawnSync("osascript", ["-e", script]);
  if (r.status !== 0) {
    // Fallback: print the command for manual paste.
    process.stdout.write(
      `${pc.yellow("note:")} could not open new tab via osascript. Run this manually:\n  ${cmd}\n`,
    );
  }
}

async function resumeInCurrent(row: Row): Promise<void> {
  const cwd = row.cwd && existsSync(row.cwd) ? row.cwd : process.cwd();
  const child = spawn("claude", ["--resume", row.uuid], {
    cwd,
    stdio: "inherit",
  });
  await new Promise<void>((resolve) => {
    child.on("exit", () => resolve());
  });
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

// Inline prompts for sub-actions
async function promptInline(label: string, def?: string): Promise<string | null> {
  // Temporarily restore cooked mode for readline.
  process.stdin.setRawMode(false);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const placeholder = def !== undefined && def.length > 0 ? ` [${def}]` : "";
    const line = await rl.question(`\n${pc.cyan(label)}${pc.dim(placeholder)}: `);
    const value = line.trim();
    if (value.length === 0 && def !== undefined) return def;
    return value.length === 0 ? null : value;
  } finally {
    rl.close();
    process.stdin.setRawMode(true);
    process.stdin.resume();
  }
}

async function promptAndTask(state: CockpitState, row: Row): Promise<void> {
  const prompt = await promptInline(`task prompt for ${row.alias}`);
  if (prompt === null) {
    state.message = pc.dim("cancelled");
    render(state);
    return;
  }
  try {
    // Reuse runChatTask but suppress its output by piping through process control.
    // Easiest: call it directly; it writes to stdout, then we re-render.
    await runChatTask(row.uuid, { prompt, json: false });
    state.message = `${pc.green("✓")} task dispatched for ${row.alias}`;
  } catch (err) {
    state.message = `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}`;
  }
  // Repaint after sub-action printed to terminal.
  setTimeout(() => render(state), 500);
}

async function promptAndNote(state: CockpitState, row: Row): Promise<void> {
  const body = await promptInline(`note for ${row.alias}`);
  if (body === null) {
    state.message = pc.dim("cancelled");
    render(state);
    return;
  }
  try {
    await runChatNote(row.uuid, body, { json: false });
    state.message = `${pc.green("✓")} note added to ${row.alias}`;
  } catch (err) {
    state.message = `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}`;
  }
  refresh(state);
  render(state);
}

async function promptAndSend(state: CockpitState, row: Row): Promise<void> {
  const prompt = await promptInline(`inbox prompt for ${row.alias}`);
  if (prompt === null) {
    state.message = pc.dim("cancelled");
    render(state);
    return;
  }
  try {
    await runChatSend(row.uuid, { prompt, json: false });
    state.message = `${pc.green("✓")} prompt queued for ${row.alias}`;
  } catch (err) {
    state.message = `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}`;
  }
  refresh(state);
  render(state);
}

async function promptAndTag(state: CockpitState, row: Row): Promise<void> {
  const raw = await promptInline(`tag(s) for ${row.alias} (space-separated)`);
  if (raw === null) {
    state.message = pc.dim("cancelled");
    render(state);
    return;
  }
  const tags = raw.split(/\s+/).filter((t) => t.length > 0);
  if (tags.length === 0) {
    state.message = pc.dim("no tags entered");
    render(state);
    return;
  }
  try {
    await runChatTag(row.uuid, tags, { json: false });
    state.message = `${pc.green("✓")} tagged ${row.alias} as ${tags.join(", ")}`;
  } catch (err) {
    state.message = `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}`;
  }
  refresh(state);
  render(state);
}

async function promptAndDone(state: CockpitState, row: Row): Promise<void> {
  const summary = await promptInline(`summary for ${row.alias} (touchdown)`);
  if (summary === null) {
    state.message = pc.dim("cancelled");
    render(state);
    return;
  }
  const status = (await promptInline("status", "FERTIG")) ?? "FERTIG";
  try {
    await runChatDone(row.uuid, { status, summary, json: false });
    state.message = `${pc.green("✓")} touchdown logged for ${row.alias}`;
  } catch (err) {
    state.message = `${pc.red("error:")} ${err instanceof Error ? err.message : String(err)}`;
  }
  refresh(state);
  render(state);
}

async function showHelp(): Promise<void> {
  process.stdout.write("\x1b[2J\x1b[H");
  process.stdout.write(`${pc.bold("Stars OS cockpit")} ${pc.dim("· keybindings")}\n\n`);
  const items: Array<[string, string]> = [
    ["↑ ↓ / k j", "navigate one chat"],
    ["PageUp / PageDown", "navigate one page"],
    ["Home / End", "jump to first / last"],
    ["Enter", "open in a new iTerm2 tab"],
    ["r", "resume in current terminal (exits cockpit)"],
    ["t", "dispatch task (background subagent)"],
    ["n", "add note"],
    ["s", "send inbox prompt"],
    ["g", "add tags"],
    ["d", "touchdown (chat done)"],
    ["f5 / f", "refresh"],
    ["? / h", "this help"],
    ["q / Ctrl-C", "quit"],
  ];
  for (const [k, v] of items) {
    process.stdout.write(`  ${pc.cyan(k.padEnd(22))} ${v}\n`);
  }
  process.stdout.write(`\n${pc.dim("press any key to return…")}\n`);
  // Wait for any key
  await new Promise<void>((resolve) => {
    const onKey = () => {
      process.stdin.off("keypress", onKey);
      resolve();
    };
    process.stdin.on("keypress", onKey);
  });
}

function enterAltScreen(): void {
  // Switch to alternate screen so we don't pollute scrollback.
  process.stdout.write("\x1b[?1049h\x1b[H");
}

function leaveAltScreen(): void {
  process.stdout.write("\x1b[?1049l");
}
