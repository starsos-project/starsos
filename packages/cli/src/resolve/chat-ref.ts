import { existsSync, readFileSync } from "node:fs";
import { getLastStatusPath } from "../storage/paths.ts";
import { getChat, listChats } from "../storage/repositories/chats.ts";

// Resolves a chat reference (uuid, prefix, '.', or alias like A2) to a full UUID.
// Returns null if no unique match exists.
export function resolveChatRef(ref: string): string | null {
  if (ref === ".") {
    return resolveCurrentChat();
  }
  // Letter+number alias: A1, A2, B1, ..., AA1, AB2, ...
  if (/^[A-Z]+\d+$/.test(ref)) {
    return resolveAlias(ref);
  }
  // Full UUID — try direct lookup
  if (getChat(ref) !== null) return ref;
  // UUID prefix (>=4 chars) — find unique match in chats
  if (ref.length >= 4) {
    const matches = listChats({ limit: 5000 }).filter((c) => c.uuid.startsWith(ref));
    if (matches.length === 1) return matches[0]?.uuid ?? null;
  }
  return null;
}

function resolveCurrentChat(): string | null {
  const fromEnv = process.env.CLAUDE_SESSION_ID;
  if (fromEnv !== undefined && fromEnv.length > 0) {
    if (getChat(fromEnv) !== null) return fromEnv;
  }
  return null;
}

interface LastStatusFile {
  generatedAt: string;
  aliases: Record<string, string>; // "A1" -> uuid
}

function resolveAlias(alias: string): string | null {
  const path = getLastStatusPath();
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as LastStatusFile;
    return data.aliases[alias] ?? null;
  } catch {
    return null;
  }
}
