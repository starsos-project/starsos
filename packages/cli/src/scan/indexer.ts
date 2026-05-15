import { loadConfig } from "../storage/config.ts";
import { upsertChat } from "../storage/repositories/chats.ts";
import { scanClaudeArchive } from "./claude-archive.ts";

export interface IndexResult {
  scanned: number;
  inserted: number;
  updated: number;
}

// Walks the configured Claude archive root and brings the chats table in sync.
// Existing rows keep their Stars-OS-owned fields (status, tags, notes, touchdown).
export function indexClaudeArchive(): IndexResult {
  const cfg = loadConfig();
  const root = cfg.general.claude_archive_path;
  const scanned = scanClaudeArchive(root);
  const inserted = 0;
  let updated = 0;
  for (const c of scanned) {
    // upsertChat distinguishes internally; we just count for now.
    upsertChat({
      uuid: c.uuid,
      jsonlPath: c.jsonlPath,
      cwd: c.cwd,
      title: c.title,
      firstMessageAt: c.firstMessageAt,
      lastMessageAt: c.lastMessageAt,
      messageCount: c.messageCount,
    });
    // Counting insert vs update would require a roundtrip; skipped for v0.1 metrics.
    updated += 1;
  }
  return { scanned: scanned.length, inserted, updated };
}
