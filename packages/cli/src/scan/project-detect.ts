import { basename } from "node:path";
import { listChats, setChatProject } from "../storage/repositories/chats.ts";
import { deriveSlug, getProject, upsertProject } from "../storage/repositories/projects.ts";

// Auto-detects projects from indexed chat cwds.
// For each unique cwd that hasn't been linked: create a project (auto_detected=1)
// and link chats to it. Manual links (link_method='manual') are not overwritten.
export function autoDetectProjects(): void {
  const chats = listChats({ limit: 10_000 });
  const seenCwds = new Map<string, string[]>(); // cwd -> chat uuids
  for (const c of chats) {
    if (c.cwd === null || c.cwd.length === 0) continue;
    const list = seenCwds.get(c.cwd) ?? [];
    list.push(c.uuid);
    seenCwds.set(c.cwd, list);
  }

  for (const [cwd, uuids] of seenCwds) {
    const name = basename(cwd) || cwd;
    const slug = deriveSlug(name);
    if (slug.length === 0) continue;
    if (getProject(slug) === null) {
      upsertProject({
        slug,
        name,
        rootPath: cwd,
        autoDetected: true,
      });
    }
    // Link only chats that have no manual link.
    for (const uuid of uuids) {
      const chat = chats.find((c) => c.uuid === uuid);
      if (chat === undefined) continue;
      if (chat.linkMethod === "manual") continue;
      if (chat.projectSlug === slug) continue;
      setChatProject(uuid, slug, "auto");
    }
  }
}
