import { spawnSync } from "node:child_process";
import chokidar from "chokidar";
import pc from "picocolors";
import { scanJsonlFile } from "../scan/claude-archive.ts";
import { loadConfig } from "../storage/config.ts";
import { upsertChat } from "../storage/repositories/chats.ts";
import { relativeTime } from "../ui/relative.ts";

export interface WatchOptions {
  notify?: boolean;
  once?: boolean; // for tests: emit ready then exit
}

export async function runChatWatch(opts: WatchOptions): Promise<void> {
  const cfg = loadConfig();
  const archive = cfg.general.claude_archive_path;

  process.stdout.write(
    `${pc.bold("watching")} ${archive} ${pc.dim(opts.notify === true ? "(macOS notifications on)" : "")}\n`,
  );

  const watcher = chokidar.watch(`${archive}/**/*.jsonl`, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
  });

  watcher
    .on("add", (path) => handleChange(path, "new", opts))
    .on("change", (path) => handleChange(path, "update", opts))
    .on("ready", () => {
      process.stdout.write(`${pc.dim("ready · Ctrl-C to stop")}\n`);
      if (opts.once === true) {
        watcher.close();
        process.exit(0);
      }
    });

  // Graceful shutdown.
  const shutdown = async () => {
    process.stdout.write(`\n${pc.dim("watch stopped")}\n`);
    await watcher.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function handleChange(jsonlPath: string, kind: "new" | "update", opts: WatchOptions): void {
  const scanned = scanJsonlFile(jsonlPath);
  if (scanned === null) return;
  upsertChat({
    uuid: scanned.uuid,
    jsonlPath: scanned.jsonlPath,
    cwd: scanned.cwd,
    title: scanned.title,
    firstMessageAt: scanned.firstMessageAt,
    lastMessageAt: scanned.lastMessageAt,
    messageCount: scanned.messageCount,
  });
  const marker = kind === "new" ? pc.green("+") : pc.cyan("~");
  const ago = relativeTime(scanned.lastMessageAt);
  process.stdout.write(
    `${marker} ${scanned.uuid.slice(0, 8)}  ${pc.dim(scanned.cwd ?? "?")}  ${pc.dim(ago)}  ${pc.dim(`(${scanned.messageCount} msgs)`)}\n`,
  );
  if (opts.notify === true && process.platform === "darwin") {
    sendMacNotification(scanned.uuid, scanned.cwd ?? "");
  }
}

function sendMacNotification(uuid: string, cwd: string): void {
  const title = "Stars OS";
  const body = `${uuid.slice(0, 8)} updated · ${cwd}`;
  const script = `display notification "${escapeApplescript(body)}" with title "${escapeApplescript(title)}"`;
  spawnSync("osascript", ["-e", script]);
}

function escapeApplescript(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
