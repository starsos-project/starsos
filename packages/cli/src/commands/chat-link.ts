import pc from "picocolors";
import { resolveChatRef } from "../resolve/chat-ref.ts";
import { indexClaudeArchive } from "../scan/indexer.ts";
import { setChatProject } from "../storage/repositories/chats.ts";
import { deriveSlug, getProject, upsertProject } from "../storage/repositories/projects.ts";

export async function runChatLink(
  ref: string,
  opts: { project?: string; auto?: boolean; json?: boolean; unlink?: boolean },
): Promise<void> {
  indexClaudeArchive();
  const uuid = resolveChatRef(ref);
  if (uuid === null) {
    process.stderr.write(`${pc.red("error:")} chat not found: ${ref}\n`);
    process.exit(1);
  }

  if (opts.unlink === true) {
    setChatProject(uuid, null, "manual");
    if (opts.json === true) {
      process.stdout.write(`${JSON.stringify({ uuid, projectSlug: null })}\n`);
    } else {
      process.stdout.write(`${pc.green("✓")} unlinked ${uuid.slice(0, 8)} from project\n`);
    }
    return;
  }

  if (opts.project === undefined || opts.project.length === 0) {
    process.stderr.write(`${pc.red("error:")} --project <slug> required (or --unlink)\n`);
    process.exit(1);
  }

  const slug = deriveSlug(opts.project);
  // Auto-create a project entry if missing (manual links should be addressable).
  if (getProject(slug) === null) {
    upsertProject({
      slug,
      name: opts.project,
      rootPath: process.cwd(),
      autoDetected: false,
    });
  }
  setChatProject(uuid, slug, "manual");
  if (opts.json === true) {
    process.stdout.write(`${JSON.stringify({ uuid, projectSlug: slug })}\n`);
  } else {
    process.stdout.write(`${pc.green("✓")} linked ${uuid.slice(0, 8)} → project ${slug}\n`);
  }
}
