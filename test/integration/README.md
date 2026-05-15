# Stars OS — Integration Test Suite (chat-first)

**Test-first development plan.** These 10 integration tests define the v0.1 acceptance gate. They run before code exists and stay green by the end of M7 (public push).

Each test:

- Spawns the real `starsos` CLI as a subprocess
- Uses an isolated `$STARSOS_HOME` (temp dir, cleaned up after)
- Asserts CLI exit codes, stdout content, and filesystem state
- Mocks only external HTTP APIs (Paperclip, Moco, ClickUp), never internal storage
- Uses fixture JSONL files for chat-related tests (in `test/integration/fixtures/claude-chats/`)

Run all: `bun test test/integration`. Single test: `bun test test/integration/01-install.test.ts`.

---

## IT-01 — Zero-friction install

**Goal**: Fresh user with only Bun installed can install Stars OS in under 30 seconds without native build tools.

**Setup**: Clean Docker container (ubuntu:24.04 or alpine), install Bun, no Node, no Python, no C compiler.

**Steps**:
1. `bun install -g @starsos/cli` exits with code 0 in < 30s
2. `which starsos` returns a path
3. `starsos --version` prints a version string matching `0.1.0-alpha.X`

**Acceptance**: All three assertions pass. No "node-gyp", no "python", no "make" appears in install output.

---

## IT-02 — Idempotent first run

**Goal**: `starsos init` is safe to run multiple times; never corrupts existing state.

**Setup**: `STARSOS_HOME=$(mktemp -d)`.

**Steps**:
1. Run `starsos init` — assert exit 0, output contains "initialized"
2. Assert `$STARSOS_HOME/config.toml` exists with default sections
3. Assert `$STARSOS_HOME/stars.db` exists, contains `schema_version` row with version=1
4. Assert tables `projects`, `chats`, `chat_tags`, `chat_notes`, `mcp_servers` exist
5. Run `starsos init` again — assert exit 0, output contains "already initialized"
6. Filesystem state identical after 1st and 2nd init

**Acceptance**: All assertions pass.

---

## IT-03 — Chat indexing from JSONL archive

**Goal**: Stars OS reads `~/.claude/projects/*/*.jsonl` and populates the `chats` table accurately.

**Setup**: Init'd `$STARSOS_HOME`, fixture archive at `test/integration/fixtures/claude-chats/` with 5 known chats across 2 cwd-paths (`/tmp/proj-a`, `/tmp/proj-b`), various message counts and timestamps.

**Steps**:
1. Set `claude_archive_path` in config to fixture path
2. Run `starsos chat list` — exits 0
3. Output shows all 5 chats
4. For each: uuid (matching JSONL filename), cwd, last activity (relative time), message count
5. Sorted by `last_message_at DESC` (newest first)
6. Run `starsos chat list --json` — valid JSON array, 5 entries

**Acceptance**: All chats correctly indexed with metadata derived from JSONL content.

---

## IT-04 — Chat meta view without resume

**Goal**: `starsos chat show <uuid>` displays a meta-view without invoking `claude --resume`.

**Setup**: Init'd `$STARSOS_HOME` with fixture chats indexed.

**Steps**:
1. Capture a known chat uuid from `chat list --json`
2. Run `starsos chat show <uuid>` — exits 0
3. Output contains: uuid, cwd, first message preview (truncated), last message preview, message count, status, tags (empty initially), notes (empty initially)
4. **Critical**: no `claude` subprocess spawned (verify via `pgrep claude` count unchanged)
5. Run `starsos chat show <invalid-uuid>` — exits non-zero with "chat not found"

**Acceptance**: Meta view works; no Claude Code invocation; clean error for missing.

---

## IT-05 — Chat resume in current terminal

**Goal**: `starsos chat resume <uuid>` spawns `claude --resume <uuid>` and inherits stdio.

**Setup**: Init'd `$STARSOS_HOME`. Mock `claude` binary in PATH (test fixture script) that captures arguments and exits.

**Steps**:
1. Run `starsos chat resume <uuid>` — exits with mock's exit code (0)
2. Mock-recorded arguments include `--resume` and the uuid
3. Mock-recorded cwd matches the chat's cwd (Stars OS sets cwd before spawn)
4. Run `starsos chat resume <invalid-uuid>` — exits non-zero with helpful error
5. Run `starsos chat resume <uuid> --print` — outputs the command without executing

**Acceptance**: Resume spawns correctly, cwd is honored, --print mode works.

---

## IT-06 — Tags and notes round-trip

**Goal**: Tag and note metadata is owned by Stars OS — adds/removes/lists work; the source JSONL is never modified.

**Setup**: Init'd `$STARSOS_HOME` with one fixture chat indexed. Record SHA-256 of the source JSONL.

**Steps**:
1. `starsos chat tag <uuid> wip urgent` — exits 0, 2 tags added
2. `starsos chat show <uuid>` — output lists "wip, urgent"
3. `starsos chat untag <uuid> urgent` — exits 0
4. `starsos chat show <uuid>` — lists only "wip"
5. `starsos chat note <uuid> "first note"` — exits 0
6. `starsos chat note <uuid> "second note"` — exits 0
7. `starsos chat show <uuid>` — both notes listed in chronological order with timestamps
8. SHA-256 of source JSONL is **unchanged**

**Acceptance**: All metadata round-trips through DB; source JSONL untouched.

---

## IT-07 — Project auto-detection from cwd

**Goal**: Projects are inferred from chat cwds without manual setup.

**Setup**: Init'd `$STARSOS_HOME`, fixture chats with cwds:
- `/tmp/proj-a` (3 chats)
- `/tmp/proj-b` (2 chats)
- `/tmp/proj-c/nested/path` (1 chat)

**Steps**:
1. Run `starsos status` — exits 0
2. Output groups chats by detected project: `proj-a (3 chats)`, `proj-b (2 chats)`, `proj-c (1 chat)`
3. Run `starsos project list` — exits 0, lists same 3 projects with `auto_detected=1`
4. Run `starsos project rename proj-a "Project Alpha"` — exits 0
5. Run `starsos status` — shows "Project Alpha (3 chats)" now
6. Run `starsos chat link <uuid> --project proj-b` — exits 0, manual override stored
7. Subsequent `starsos status` reflects the manual link

**Acceptance**: Auto-detection works on cwd prefixes; manual rename and link override correctly.

---

## IT-08 — Inbox pattern for queued prompts

**Goal**: `starsos chat send` queues a prompt that surfaces on next `chat resume`.

**Setup**: Init'd `$STARSOS_HOME` with fixture chat indexed. Mock `claude` binary.

**Steps**:
1. `starsos chat send <uuid> --prompt "remind me to update the README"` — exits 0
2. File `$STARSOS_HOME/inboxes/<uuid>.md` exists with the prompt content
3. `starsos chat send <uuid> --prompt "and check the tests"` — appends to inbox
4. `starsos chat show <uuid>` — shows "Pending inbox: 2 queued prompts"
5. `starsos chat resume <uuid>` — output BEFORE spawning includes the queued prompts with marker `[stars: queued prompts]`
6. After successful resume (mock exits 0), file is moved to `$STARSOS_HOME/inboxes/.consumed/<uuid>-<timestamp>.md`
7. `starsos chat show <uuid>` no longer shows pending inbox

**Acceptance**: Queue accumulates, resume surfaces, consumption is auditable.

---

## IT-09 — Chat watch live updates

**Goal**: `starsos chat watch` detects when a JSONL file changes and reports it.

**Setup**: Init'd `$STARSOS_HOME` with fixture chats indexed. Test writes new content to a fixture JSONL during the test.

**Steps**:
1. Start `starsos chat watch` in background (capture stdout)
2. Wait 200ms for watcher initialization
3. Append a new message to `<uuid>.jsonl`
4. Within 2s, stdout contains: "chat <uuid> updated • new message in <cwd> • <Nms ago>"
5. Update the file again — second event logged
6. Ctrl-C / SIGTERM — watcher exits 0 cleanly

**Acceptance**: File changes detected reliably, output is informative, clean shutdown.

---

## IT-10 — Lossless migration from StarsHub

**Goal**: Read `~/.stars/` (StarsHub format), write `~/.starsos/` project + adapter metadata. **Sessions are intentionally not migrated** (chats are the new abstraction).

**Setup**:
- `STARS_HUB_SOURCE=$(mktemp -d)` seeded with realistic StarsHub data:
  - `registry.json` with 3 projects (each with moco_project_id, clickup_space_id)
  - `config.json` with moco.api_key, clickup.api_key
  - `active-session.json` with one active session (will NOT migrate)
  - `logs/2026-05-15-sessions.jsonl` with 5 historical sessions (will NOT migrate)
- `STARSOS_HOME=$(mktemp -d)` clean

**Steps**:
1. `starsos migrate --dry-run --source $STARS_HUB_SOURCE` exits 0
2. Dry-run output: "Would migrate: 3 projects, 0 sessions (chats handled separately), 2 adapter configs"
3. Dry-run made no changes to either path
4. `starsos migrate --source $STARS_HUB_SOURCE` exits 0
5. `$STARSOS_HOME/stars.db` has 3 projects with names + external_refs
6. `mcp_servers` table has moco + clickup configs (token values via env-var pattern, not stored in DB)
7. Sessions table is empty (intentional)
8. SHA-256 of every file in `$STARS_HUB_SOURCE` is unchanged (read-only on source)
9. Re-run with populated target → exits non-zero unless `--force`
10. With `--force`, idempotent (same result)

**Acceptance**: Project + adapter metadata migrated. Sessions ignored by design. Source untouched. Re-runnable.

---

## Cross-cutting test invariants

- **Source JSONLs in `~/.claude/projects/` are never modified by Stars OS** — verified by SHA-256 before/after every test that touches chats
- **No secrets in Stars OS log files** — `~/.starsos/logs/*.jsonl` lines never contain `mcp_servers.config` values
- **DB survives crash mid-write** — kill -9 during a tag-add, restart, DB is consistent (WAL mode)
- **`$STARSOS_HOME` honored** — every test uses isolated temp dir
- **Exit codes**: 0 = success, 1 = user error, 2 = system error

---

## Test infrastructure

```
test/integration/
├── README.md                       this file
├── helpers/
│   ├── temp-home.ts                $STARSOS_HOME factory + cleanup
│   ├── spawn-cli.ts                wraps Bun.spawn for CLI tests
│   ├── seed-chats.ts               copies fixture JSONLs into a test archive path
│   ├── mock-claude.ts              mock claude binary for resume tests
│   └── mock-api.ts                 starts mock Moco/ClickUp/Paperclip servers
├── fixtures/
│   ├── claude-chats/               sample JSONL files
│   │   ├── proj-a/
│   │   │   ├── abc-uuid.jsonl
│   │   │   └── def-uuid.jsonl
│   │   └── proj-b/
│   │       └── xyz-uuid.jsonl
│   └── starshub-source/            sample ~/.stars/ layout
│       ├── registry.json
│       ├── config.json
│       ├── active-session.json
│       └── logs/...
├── 01-install.test.ts
├── 02-init.test.ts
├── 03-chat-list.test.ts
├── 04-chat-show.test.ts
├── 05-chat-resume.test.ts
├── 06-chat-tag-note.test.ts
├── 07-status-project-detect.test.ts
├── 08-chat-send-inbox.test.ts
├── 09-chat-watch.test.ts
└── 10-migrate.test.ts
```

## IT-11 — Implicit liftoff at chat resume

**Goal**: `chat resume` prints the liftoff context block (git status, last session log, open tasks, pending chats) before spawning `claude --resume`.

**Setup**: Init'd `$STARSOS_HOME`, one fixture chat with cwd pointing to a real git repo (`test/integration/fixtures/sample-repo/`), and a fixture `session-logs/2026-05-10-prev.md` plus `CLAUDE.md` with open tasks.

**Steps**:
1. Run `starsos chat resume <uuid>` with mock `claude` binary
2. Stdout BEFORE the mock claude invocation contains:
   - Git status section (e.g. "On branch main, 2 uncommitted changes")
   - "Last session log" section showing first 10 lines of `2026-05-10-prev.md`
   - "Open tasks" section parsed from CLAUDE.md
   - "Pending chats in this project" if any
3. If `pre-liftoff.sh` exists in `$STARSOS_HOME/hooks/` and exits 0, resume proceeds
4. If `pre-liftoff.sh` exits non-zero, resume aborts and the hook's stderr is shown

**Acceptance**: Liftoff block printed correctly; hook contract honored.

---

## IT-12 — Touchdown writes session log and runs hook

**Goal**: `chat done` writes a structured session log, updates DB, and runs `post-touchdown.sh` with correct env vars.

**Setup**: Init'd `$STARSOS_HOME`, fixture chat indexed and linked to a project at `/tmp/proj-a/`. A mock `post-touchdown.sh` that logs its env vars to `/tmp/hook-output.txt`.

**Steps**:
1. Run `starsos chat done <uuid> --status FERTIG --summary "demo summary"`
2. File `/tmp/proj-a/session-logs/<YYYY-MM-DD>-<slug>.md` exists with summary, status, generated structure
3. DB row for chat has `status='done'`, `touchdown_log_path` set, `touchdown_summary='demo summary'`, `done_at` populated
4. `/tmp/hook-output.txt` contains `STARSOS_CHAT_UUID=<uuid>`, `STARSOS_TOUCHDOWN_LOG=<path>`, `STARSOS_TOUCHDOWN_STATUS=FERTIG`, `STARSOS_TOUCHDOWN_SUMMARY=demo summary`
5. Hook exits 0 — session-log remains; hook exits non-zero — session-log remains but warning logged

**Acceptance**: Filesystem state correct, DB state correct, hook env vars match ADR-009 contract.

---

Plus a `test/unit/` folder for finer-grained tests on storage, parsing, helpers. The 12 integration tests above are the **v0.1 acceptance gate** — all must be green before public push at M7.
