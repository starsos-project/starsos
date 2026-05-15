import { homedir } from "node:os";
import { join, resolve } from "node:path";

// Resolves the Stars OS home directory.
// Honors $STARSOS_HOME for tests and dev installs.
// Default: ~/.starsos/
export function getStarsosHome(): string {
  const fromEnv = process.env.STARSOS_HOME;
  if (fromEnv && fromEnv.length > 0) {
    return resolve(fromEnv);
  }
  return join(homedir(), ".starsos");
}

export function getConfigPath(): string {
  return join(getStarsosHome(), "config.toml");
}

export function getDbPath(): string {
  return join(getStarsosHome(), "stars.db");
}

export function getInboxDir(): string {
  return join(getStarsosHome(), "inboxes");
}

export function getInboxConsumedDir(): string {
  return join(getInboxDir(), ".consumed");
}

export function getHooksDir(): string {
  return join(getStarsosHome(), "hooks");
}

export function getTasksDir(): string {
  return join(getStarsosHome(), "tasks");
}

export function getMcpServersDir(): string {
  return join(getStarsosHome(), "mcp-servers");
}

export function getStateDir(): string {
  return join(getStarsosHome(), "state");
}

export function getLastStatusPath(): string {
  return join(getStateDir(), "last-status.json");
}

export function getLogsDir(): string {
  return join(getStarsosHome(), "logs");
}

export function getTouchdownsDir(): string {
  return join(getStarsosHome(), "touchdowns");
}

// Default Claude Code archive — overridable via config.
export function getClaudeArchiveDefault(): string {
  return join(homedir(), ".claude", "projects");
}
