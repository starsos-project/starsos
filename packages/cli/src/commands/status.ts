import Table from "cli-table3";
import pc from "picocolors";
import { countInboxEntries } from "../inbox/inbox.ts";
import { indexClaudeArchive } from "../scan/indexer.ts";
import { autoDetectProjects } from "../scan/project-detect.ts";
import { writeAliases } from "../state/aliases.ts";
import { getTags, listChats } from "../storage/repositories/chats.ts";
import { listProjects } from "../storage/repositories/projects.ts";
import type { Chat, Project } from "../types.ts";
import { relativeTime, truncate } from "../ui/relative.ts";

export interface StatusOptions {
  json?: boolean;
  plain?: boolean;
  here?: boolean;
  limit?: number;
  all?: boolean;
}

// Defaults aimed at fitting "the recent stuff" on one screen.
const DEFAULT_TOTAL_LIMIT = 30;
const DEFAULT_PER_PROJECT_LIMIT = 5;

interface ChatWithAlias extends Chat {
  alias: string;
  tagsList: string[];
  pendingInbox: number;
}

interface ProjectGroup {
  project: Project | null; // null = unlinked chats group
  chats: ChatWithAlias[];
  letter: string;
}

export async function runStatus(opts: StatusOptions): Promise<void> {
  indexClaudeArchive();
  autoDetectProjects();

  const projects = listProjects().filter((p) => p.status === "active");
  const allChats = listChats({ limit: 10_000 });

  let chats = allChats;
  if (opts.here === true) {
    const hereCwd = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
    chats = chats.filter((c) => c.cwd !== null && hereCwd !== null && c.cwd.startsWith(hereCwd));
  }

  // Group chats by project. Compute letter aliases A, B, C... per project.
  const groups = groupByProject(projects, chats);
  const aliasMap = assignAliases(groups);
  writeAliases(aliasMap);

  if (opts.json === true) {
    process.stdout.write(
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          projects: groups.map((g) => ({
            letter: g.letter,
            slug: g.project?.slug ?? null,
            name: g.project?.name ?? "(unlinked)",
            chats: g.chats.map((c) => ({
              alias: c.alias,
              uuid: c.uuid,
              status: c.status,
              title: c.title,
              lastMessageAt: c.lastMessageAt,
              messageCount: c.messageCount,
              tags: c.tagsList,
              pendingInbox: c.pendingInbox,
            })),
          })),
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  if (opts.plain === true) {
    for (const g of groups) {
      for (const c of g.chats) {
        process.stdout.write(
          `${c.alias}\t${c.uuid}\t${c.status}\t${g.project?.slug ?? ""}\t${c.lastMessageAt}\t${c.title ?? ""}\n`,
        );
      }
    }
    return;
  }

  // Pretty output
  const totalChats = groups.reduce((n, g) => n + g.chats.length, 0);
  const activeCount = groups.reduce(
    (n, g) => n + g.chats.filter((c) => c.status === "active").length,
    0,
  );
  const parkedCount = groups.reduce(
    (n, g) => n + g.chats.filter((c) => c.status === "parked").length,
    0,
  );
  const doneCount = groups.reduce(
    (n, g) => n + g.chats.filter((c) => c.status === "done").length,
    0,
  );

  process.stdout.write(
    `${pc.bold("Stars OS")} ${pc.dim("cockpit")}  ${pc.dim(`${activeCount} active · ${parkedCount} parked · ${doneCount} done · ${totalChats} total`)}\n\n`,
  );

  if (groups.length === 0) {
    process.stdout.write(
      `${pc.dim("no chats indexed yet. did you set claude_archive_path in config.toml?")}\n`,
    );
    return;
  }

  // Pagination: default to 15 chats total across all projects, max 5 per group.
  // --limit N overrides the total. --all bypasses the limit.
  const totalLimit =
    opts.all === true ? Number.POSITIVE_INFINITY : opts.limit ?? DEFAULT_TOTAL_LIMIT;
  const perGroupLimit = DEFAULT_PER_PROJECT_LIMIT;

  // Responsive table: adapt column widths to terminal.
  const termWidth = Math.max(60, process.stdout.columns ?? 100);
  const showInboxCol = termWidth >= 90;
  const showTagsCol = termWidth >= 110;
  const fixedCols =
    4 + // alias
    9 + // status
    13 + // last
    6 + // msgs
    (showInboxCol ? 7 : 0) +
    (showTagsCol ? 16 : 0) +
    14; // borders/padding overhead
  const titleWidth = Math.max(20, termWidth - fixedCols);

  let shown = 0;
  let truncatedGroups = 0;
  for (const g of groups) {
    if (shown >= totalLimit) {
      truncatedGroups += 1;
      continue;
    }
    const slug = g.project?.slug ?? "(no project)";
    const name = g.project?.name ?? "unlinked chats";
    process.stdout.write(
      `${pc.cyan(g.letter)}  ${pc.bold(slug)} ${pc.dim(name === slug ? "" : `· ${name}`)}  ${pc.dim(`${g.chats.length} chat(s)`)}\n`,
    );

    const head: string[] = ["", "STATUS", "LAST", "MSGS"];
    const colWidths: number[] = [4, 9, 13, 6];
    if (showInboxCol) {
      head.push("INBOX");
      colWidths.push(7);
    }
    if (showTagsCol) {
      head.push("TAGS");
      colWidths.push(16);
    }
    head.push("TITLE");
    colWidths.push(titleWidth);

    const table = new Table({
      head,
      style: { head: ["dim"], border: ["gray"] },
      colWidths,
      wordWrap: false,
    });

    const available = Math.max(0, totalLimit - shown);
    const sliceLimit = Math.min(perGroupLimit, available);
    for (const c of g.chats.slice(0, sliceLimit)) {
      const row: string[] = [
        pc.cyan(c.alias),
        colorStatus(c.status),
        relativeTime(c.lastMessageAt),
        String(c.messageCount),
      ];
      if (showInboxCol) {
        row.push(c.pendingInbox > 0 ? pc.yellow(`+${c.pendingInbox}`) : pc.dim("-"));
      }
      if (showTagsCol) {
        row.push(truncate(c.tagsList.join(","), 14));
      }
      row.push(truncate(c.title, titleWidth - 2));
      table.push(row);
    }
    process.stdout.write(`${table.toString()}\n`);
    shown += sliceLimit;
    if (g.chats.length > sliceLimit) {
      process.stdout.write(
        `${pc.dim(`  + ${g.chats.length - sliceLimit} more in this project — use \`starsos chat list --limit N\``)}\n`,
      );
    }
    process.stdout.write("\n");
  }

  if (truncatedGroups > 0) {
    process.stdout.write(
      `${pc.dim(`+ ${truncatedGroups} more project group(s) hidden — use`)} ${pc.cyan("--all")} ${pc.dim("or")} ${pc.cyan("--limit N")} ${pc.dim("to see more")}\n`,
    );
  }

  process.stdout.write(
    `${pc.dim("hint:")} ${pc.cyan("starsos chat resume A1")}  ${pc.dim("·")}  ${pc.cyan("starsos chat task A1 --prompt '…'")}  ${pc.dim("·")}  ${pc.cyan("starsos chat send A1 --prompt '…'")}\n`,
  );
}

function groupByProject(projects: Project[], chats: Chat[]): ProjectGroup[] {
  const byProject = new Map<string, ChatWithAlias[]>();
  const unlinked: ChatWithAlias[] = [];

  for (const c of chats) {
    const enriched: ChatWithAlias = {
      ...c,
      alias: "", // filled later
      tagsList: getTags(c.uuid),
      pendingInbox: countInboxEntries(c.uuid),
    };
    if (c.projectSlug === null) {
      unlinked.push(enriched);
    } else {
      const list = byProject.get(c.projectSlug) ?? [];
      list.push(enriched);
      byProject.set(c.projectSlug, list);
    }
  }

  // Sort projects by most-recent activity descending; chats inside group by last_message_at desc.
  const groups: ProjectGroup[] = [];
  for (const proj of projects) {
    const list = byProject.get(proj.slug);
    if (list === undefined || list.length === 0) continue;
    list.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    groups.push({ project: proj, chats: list, letter: "" });
  }
  groups.sort((a, b) => {
    const aLast = a.chats[0]?.lastMessageAt ?? "";
    const bLast = b.chats[0]?.lastMessageAt ?? "";
    return bLast.localeCompare(aLast);
  });
  if (unlinked.length > 0) {
    unlinked.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    groups.push({ project: null, chats: unlinked, letter: "" });
  }
  return groups;
}

function assignAliases(groups: ProjectGroup[]): Record<string, string> {
  const aliasMap: Record<string, string> = {};
  for (let gi = 0; gi < groups.length; gi++) {
    const letter = projectLetter(gi);
    const group = groups[gi];
    if (group === undefined) continue;
    group.letter = letter;
    for (let ci = 0; ci < group.chats.length; ci++) {
      const chat = group.chats[ci];
      if (chat === undefined) continue;
      chat.alias = `${letter}${ci + 1}`;
      aliasMap[chat.alias] = chat.uuid;
    }
  }
  return aliasMap;
}

// Spreadsheet-style column letters: 0..25 = A..Z, 26..701 = AA..ZZ, ...
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
