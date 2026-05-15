import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDbPath, getStarsosHome } from "./paths.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Migration list. Append-only. New entries get a higher version number.
const MIGRATIONS = [{ version: 1, file: "001-init.sql" }] as const;

let cachedDb: Database | null = null;

export function openDb(): Database {
  if (cachedDb !== null) return cachedDb;

  const dbPath = getDbPath();
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  runMigrations(db);

  cachedDb = db;
  return db;
}

export function closeDb(): void {
  if (cachedDb !== null) {
    cachedDb.close();
    cachedDb = null;
  }
}

function runMigrations(db: Database): void {
  const currentVersion = getCurrentSchemaVersion(db);

  for (const m of MIGRATIONS) {
    if (m.version <= currentVersion) continue;
    const sqlPath = resolveMigrationPath(m.file);
    const sql = readFileSync(sqlPath, "utf-8");
    db.transaction(() => {
      db.exec(sql);
    })();
  }
}

function getCurrentSchemaVersion(db: Database): number {
  // Schema_version table might not exist yet on a fresh DB.
  try {
    const row = db
      .prepare<{ max: number | null }, []>("SELECT MAX(version) AS max FROM schema_version")
      .get();
    return row?.max ?? 0;
  } catch {
    return 0;
  }
}

function resolveMigrationPath(file: string): string {
  // In development (bun run / bun test) __dirname is .../src/storage
  // In bundled dist, migrations are copied alongside.
  const candidates = [
    join(__dirname, "migrations", file),
    join(__dirname, "..", "..", "src", "storage", "migrations", file),
    join(getStarsosHome(), "..", "src", "storage", "migrations", file),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(`migration file not found: ${file}`);
}

export function getSchemaVersion(): number {
  const db = openDb();
  return getCurrentSchemaVersion(db);
}
