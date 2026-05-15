import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import { getHooksDir, getStarsosHome } from "../storage/paths.ts";

export type HookName =
  | "pre-liftoff.sh"
  | "post-touchdown.sh"
  | "post-chat-tag.sh"
  | "post-chat-note.sh"
  | "post-init.sh";

export interface HookContext {
  [key: string]: string | undefined;
}

export interface HookResult {
  ran: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}

const TIMEOUT_MS = 30_000;

// Run a lifecycle hook if it exists and is executable.
// `wait=false` => fire-and-forget. `wait=true` => block until completion.
export function runHook(
  name: HookName,
  ctx: HookContext,
  opts: { wait?: boolean; verbose?: boolean } = {},
): HookResult {
  const path = join(getHooksDir(), name);
  if (!existsSync(path)) {
    return { ran: false, exitCode: 0, stdout: "", stderr: "" };
  }
  try {
    const st = statSync(path);
    if (!st.isFile()) return { ran: false, exitCode: 0, stdout: "", stderr: "" };
  } catch {
    return { ran: false, exitCode: 0, stdout: "", stderr: "" };
  }

  const env: Record<string, string> = {
    ...process.env,
    STARSOS_HOME: getStarsosHome(),
    STARSOS_VERSION: "0.1.0-alpha.1",
    STARSOS_HOOK_NAME: name.replace(/\.sh$/, ""),
    STARSOS_EVENT_TS: new Date().toISOString(),
  };
  for (const [k, v] of Object.entries(ctx)) {
    if (v !== undefined) env[k] = v;
  }

  if (opts.wait === false) {
    // Fire-and-forget. We don't track the child; let it run.
    spawnSync(path, [], { env, timeout: TIMEOUT_MS, stdio: "ignore" });
    return { ran: true, exitCode: 0, stdout: "", stderr: "" };
  }

  const result = spawnSync(path, [], {
    env,
    timeout: TIMEOUT_MS,
    encoding: "utf-8",
  });
  if (opts.verbose === true && result.stdout && result.stdout.length > 0) {
    for (const line of result.stdout.trim().split("\n")) {
      process.stdout.write(`  ${pc.dim("[hook]")} ${line}\n`);
    }
  }
  if (result.status !== 0 && result.stderr) {
    for (const line of result.stderr.trim().split("\n")) {
      process.stderr.write(`  ${pc.yellow("[hook]")} ${line}\n`);
    }
  }
  return {
    ran: true,
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}
