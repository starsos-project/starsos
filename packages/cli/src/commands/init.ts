import { existsSync, mkdirSync } from "node:fs";
import pc from "picocolors";
import { runHook } from "../hooks/runner.ts";
import { writeDefaultConfig } from "../storage/config.ts";
import { closeDb, getSchemaVersion, openDb } from "../storage/db.ts";
import {
  getDbPath,
  getHooksDir,
  getInboxConsumedDir,
  getInboxDir,
  getLogsDir,
  getMcpServersDir,
  getStarsosHome,
  getStateDir,
  getTasksDir,
  getTouchdownsDir,
} from "../storage/paths.ts";

export interface InitResult {
  starsosHome: string;
  alreadyInitialized: boolean;
  schemaVersion: number;
}

export function runInit(): InitResult {
  const home = getStarsosHome();
  // Use the presence of stars.db as the truth signal — a bare $STARSOS_HOME
  // directory (e.g. an empty mkdtemp result in tests) is not "initialized".
  const alreadyHad = existsSync(getDbPath());

  // Make directories.
  for (const dir of [
    home,
    getHooksDir(),
    getInboxDir(),
    getInboxConsumedDir(),
    getTasksDir(),
    getMcpServersDir(),
    getStateDir(),
    getLogsDir(),
    getTouchdownsDir(),
  ]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // Write default config if missing.
  writeDefaultConfig();

  // Open DB and run migrations.
  openDb();
  const schemaVersion = getSchemaVersion();
  closeDb();

  // Run post-init hook (non-fatal on error).
  runHook("post-init.sh", {}, { wait: true });

  return {
    starsosHome: home,
    alreadyInitialized: alreadyHad,
    schemaVersion,
  };
}

export function printInitResult(result: InitResult, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (result.alreadyInitialized) {
    process.stdout.write(`${pc.dim("already initialized")} at ${result.starsosHome}\n`);
    process.stdout.write(`schema version: ${pc.cyan(String(result.schemaVersion))}\n`);
  } else {
    process.stdout.write(`${pc.green("✓")} initialized at ${result.starsosHome}\n`);
    process.stdout.write(`schema version: ${pc.cyan(String(result.schemaVersion))}\n`);
    process.stdout.write(`\nnext: ${pc.cyan("starsos status")} to see your chats\n`);
  }
}
