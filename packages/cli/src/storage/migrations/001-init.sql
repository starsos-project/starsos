-- Migration 001: initial schema
-- Tier 3 Locked surface — see STABILITY.md and 03-data-model.md.

CREATE TABLE IF NOT EXISTS projects (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  number TEXT,
  root_path TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  external_refs TEXT,
  billing_type TEXT,
  client TEXT,
  tags TEXT,
  auto_detected INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chats (
  uuid TEXT PRIMARY KEY,
  jsonl_path TEXT NOT NULL UNIQUE,
  cwd TEXT,
  project_slug TEXT REFERENCES projects(slug) ON DELETE SET NULL,
  title TEXT,
  first_message_at TEXT NOT NULL,
  last_message_at TEXT NOT NULL,
  message_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  link_method TEXT,
  touchdown_log_path TEXT,
  touchdown_status TEXT,
  touchdown_summary TEXT,
  done_at TEXT,
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_tags (
  chat_uuid TEXT NOT NULL REFERENCES chats(uuid) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  added_at TEXT NOT NULL,
  PRIMARY KEY (chat_uuid, tag)
);

CREATE TABLE IF NOT EXISTS chat_notes (
  id TEXT PRIMARY KEY,
  chat_uuid TEXT NOT NULL REFERENCES chats(uuid) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  chat_uuid TEXT NOT NULL REFERENCES chats(uuid) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  backend TEXT NOT NULL,
  pid INTEGER,
  output_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  started_at TEXT NOT NULL,
  ended_at TEXT,
  exit_code INTEGER,
  tokens_estimated INTEGER,
  alias_at_dispatch TEXT
);

CREATE TABLE IF NOT EXISTS mcp_servers (
  name TEXT PRIMARY KEY,
  package TEXT NOT NULL,
  version TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  config TEXT,
  installed_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chats_project ON chats(project_slug);
CREATE INDEX IF NOT EXISTS idx_chats_status ON chats(status);
CREATE INDEX IF NOT EXISTS idx_chats_last_message ON chats(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_cwd ON chats(cwd);
CREATE INDEX IF NOT EXISTS idx_chat_tags_tag ON chat_tags(tag);
CREATE INDEX IF NOT EXISTS idx_chat_notes_chat ON chat_notes(chat_uuid);
CREATE INDEX IF NOT EXISTS idx_tasks_chat ON tasks(chat_uuid);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_started ON tasks(started_at DESC);

INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (1, datetime('now'));
