// Shared types for Stars OS.
// Tier 2 Stable surface — see STABILITY.md.

export type ProjectStatus = "active" | "paused" | "archived";

export interface Project {
  slug: string;
  name: string;
  rootPath: string;
  description: string | null;
  status: ProjectStatus;
  externalRefs: Record<string, string | number> | null;
  billingType: string | null;
  client: string | null;
  tags: string[];
  autoDetected: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ChatStatus = "active" | "parked" | "done" | "archived";

export interface Chat {
  uuid: string;
  jsonlPath: string;
  cwd: string | null;
  projectSlug: string | null;
  title: string | null;
  firstMessageAt: string;
  lastMessageAt: string;
  messageCount: number;
  status: ChatStatus;
  linkMethod: "auto" | "manual" | null;
  touchdownLogPath: string | null;
  touchdownStatus: string | null;
  touchdownSummary: string | null;
  doneAt: string | null;
  firstSeenAt: string;
  updatedAt: string;
}

export interface ChatTag {
  chatUuid: string;
  tag: string;
  addedAt: string;
}

export interface ChatNote {
  id: string;
  chatUuid: string;
  body: string;
  createdAt: string;
}

export type TaskStatus = "queued" | "running" | "done" | "failed" | "aborted";
export type TaskBackend = "headless-claude" | "anthropic-api";

export interface Task {
  id: string;
  chatUuid: string;
  prompt: string;
  backend: TaskBackend;
  pid: number | null;
  outputPath: string;
  status: TaskStatus;
  startedAt: string;
  endedAt: string | null;
  exitCode: number | null;
  tokensEstimated: number | null;
  aliasAtDispatch: string | null;
}

export interface McpServer {
  name: string;
  packageName: string;
  version: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  installedAt: string;
  lastUsedAt: string | null;
}
