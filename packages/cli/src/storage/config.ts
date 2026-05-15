import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import { getClaudeArchiveDefault, getConfigPath } from "./paths.ts";

// Default values match Tier-2 surfaces in STABILITY.md.
export const DEFAULT_CONFIG = {
  general: {
    editor: "code",
    claude_archive_path: getClaudeArchiveDefault(),
  },
  chat: {
    default_status: "active",
    auto_link_projects: true,
    watch_interval_ms: 1000,
  },
  liftoff: {
    show_git_status: true,
    show_last_session_log: true,
    show_open_tasks: true,
    show_pending_chats: true,
    show_infisical_hint: true,
  },
  touchdown: {
    session_log_dir: "session-logs",
    session_log_filename_format: "YYYY-MM-DD-{slug}.md",
    require_summary: true,
    status_choices: ["FERTIG", "IN_ARBEIT", "BLOCKED"],
  },
  watch: {
    notify_macos: false,
  },
  ui: {
    relative_time: true,
    color: "auto",
    alias_ttl_hours: 24,
  },
  tui: {
    enabled: true,
    framework: "auto",
    refresh_seconds: 5,
  },
  tasks: {
    backend: "auto",
    output_retention_days: 30,
    anthropic_api_env: "ANTHROPIC_API_KEY",
  },
  mcp: {
    auto_install_on_first_call: false,
  },
};

export type Config = typeof DEFAULT_CONFIG;

export function loadConfig(): Config {
  const path = getConfigPath();
  if (!existsSync(path)) {
    return DEFAULT_CONFIG;
  }
  try {
    const content = readFileSync(path, "utf-8");
    const parsed = parseToml(content) as Partial<Config>;
    return mergeDeep(DEFAULT_CONFIG, parsed);
  } catch (err) {
    throw new Error(
      `config.toml is malformed at ${path}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function writeDefaultConfig(): void {
  const path = getConfigPath();
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  if (existsSync(path)) {
    return;
  }
  const toml = stringifyToml(DEFAULT_CONFIG as unknown as Record<string, unknown>);
  const header =
    "# Stars OS config — generated on init. Edit freely; restart Stars OS for some changes.\n# See https://github.com/starsos-project/starsos for documentation.\n\n";
  writeFileSync(path, header + toml, "utf-8");
}

function mergeDeep<T extends Record<string, unknown>>(base: T, overrides: Partial<T>): T {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value === undefined || value === null) continue;
    const existing = result[key];
    if (
      typeof existing === "object" &&
      existing !== null &&
      !Array.isArray(existing) &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      result[key] = mergeDeep(
        existing as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
