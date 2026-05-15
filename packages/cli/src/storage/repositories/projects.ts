import type { Project, ProjectStatus } from "../../types.ts";
import { openDb } from "../db.ts";

interface ProjectRow {
  slug: string;
  name: string;
  number: string | null;
  root_path: string;
  description: string | null;
  status: ProjectStatus;
  external_refs: string | null;
  billing_type: string | null;
  client: string | null;
  tags: string | null;
  auto_detected: number;
  created_at: string;
  updated_at: string;
}

function rowToProject(row: ProjectRow): Project {
  return {
    slug: row.slug,
    name: row.name,
    rootPath: row.root_path,
    description: row.description,
    status: row.status,
    externalRefs:
      row.external_refs === null
        ? null
        : (JSON.parse(row.external_refs) as Record<string, string | number>),
    billingType: row.billing_type,
    client: row.client,
    tags: row.tags === null ? [] : (JSON.parse(row.tags) as string[]),
    autoDetected: row.auto_detected === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface UpsertProjectInput {
  slug: string;
  name: string;
  rootPath: string;
  autoDetected: boolean;
  client?: string | null;
  billingType?: string | null;
  externalRefs?: Record<string, string | number> | null;
}

export function upsertProject(input: UpsertProjectInput): void {
  const db = openDb();
  const now = new Date().toISOString();
  const existing = getProject(input.slug);
  if (existing === null) {
    db.prepare(
      `INSERT INTO projects (
        slug, name, root_path, status, external_refs, billing_type, client,
        auto_detected, created_at, updated_at
      ) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.slug,
      input.name,
      input.rootPath,
      input.externalRefs === null || input.externalRefs === undefined
        ? null
        : JSON.stringify(input.externalRefs),
      input.billingType ?? null,
      input.client ?? null,
      input.autoDetected ? 1 : 0,
      now,
      now,
    );
  } else {
    db.prepare(
      `UPDATE projects SET
        name = ?,
        root_path = ?,
        external_refs = COALESCE(?, external_refs),
        billing_type = COALESCE(?, billing_type),
        client = COALESCE(?, client),
        auto_detected = ?,
        updated_at = ?
       WHERE slug = ?`,
    ).run(
      input.name,
      input.rootPath,
      input.externalRefs === null || input.externalRefs === undefined
        ? null
        : JSON.stringify(input.externalRefs),
      input.billingType ?? null,
      input.client ?? null,
      input.autoDetected ? 1 : 0,
      now,
      input.slug,
    );
  }
}

export function getProject(slug: string): Project | null {
  const db = openDb();
  const row = db.prepare<ProjectRow, [string]>("SELECT * FROM projects WHERE slug = ?").get(slug);
  return row === null ? null : rowToProject(row);
}

export function listProjects(): Project[] {
  const db = openDb();
  const rows = db.prepare<ProjectRow, []>("SELECT * FROM projects ORDER BY name").all();
  return rows.map(rowToProject);
}

export function renameProject(slug: string, newName: string): void {
  const db = openDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE projects SET name = ?, updated_at = ? WHERE slug = ?").run(newName, now, slug);
}

export function archiveProject(slug: string): void {
  const db = openDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE projects SET status = 'archived', updated_at = ? WHERE slug = ?").run(
    now,
    slug,
  );
}

// Auto-derive slug from a project name or basename.
export function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
