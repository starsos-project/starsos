# Stability Policy

> *Stable Core. Volatile Edge.*

Stars OS is built around the assumption that **most software changes, but a few foundations must not**. This document defines what is which. Read this before you propose, depend on, or change anything.

Inspired by [Node.js Stability Index](https://nodejs.org/api/documentation.html#stability-index), Bun's `unstable_*` prefix, and Vite's `experimental/` convention.

---

## The four tiers

| Tier | Name | SemVer behavior | Promise to users |
|---|---|---|---|
| **3** | **Locked** | Effectively never breaks. Wire-format contracts. | Bet your business on it. |
| **2** | **Stable** | Breaking change requires a major version bump and a deprecation window. | Build long-term workflows on it. |
| **1** | **Provisional** | May change in minor versions with a changelog entry. Helpers, internals, output formats. | Use it, expect adjustments. |
| **0** | **Experimental** | Behind `--experimental` flags or `unstable_*` namespaces. May vanish without notice. | Try at your own risk. |

Everything not listed in this document is **internal** by default and may change at any time.

---

## Tier 3 — Locked (wire-format contracts)

These would break stored data or external systems if changed. We treat them as **append-only**: new fields can be added, existing ones must stay.

| Surface | Lock contract |
|---|---|
| `~/.starsos/` storage root path | Never moves. `$STARSOS_HOME` may override for tests. |
| SQLite primary keys | `projects.slug`, `sessions.id`, `notes.id`, `mcp_servers.name` — these stay stable. Other columns can evolve. |
| CLI binary name | `starsos` — chosen to coexist with legacy `stars` (StarsHub). See [ADR-001](docs/adr/001-absorb-starshub.md). |
| AGPL-3.0 licensing of core | The core stays AGPL-3 forever. See [ADR-003](docs/adr/003-agpl-license.md). |
| MCP-wrapper as adapter strategy | Stars OS is an MCP client. Adapters are standard MCP servers. See [ADR-006](docs/adr/006-mcp-wrapper.md). Reverting to a custom SDK requires superseding ADR. |

**Promotion rule**: Things in Tier 3 require a successor migration path before removal. There is no "we'll just rename it".

---

## Tier 2 — Stable (the API people build on)

These can break, but only in major versions, with a deprecation period of at least 2 minor releases beforehand.

### CLI commands and their primary flags (v0.1)

| Command | Notes |
|---|---|
| `starsos` (no args) | Starts interactive TUI cockpit (see Tier-2 TUI surface below). |
| `starsos init` | Creates `~/.starsos/`. Idempotent. Stable since v0.1. |
| `starsos status [--here]` | Cockpit view. Numbers chats with `A1, A2, B1, ...` aliases. Persists mapping in `state/last-status.json` for 24h. `--here` filters to current `$CLAUDE_PROJECT_DIR`. |
| `starsos chat list` | List all Claude chats from `~/.claude/projects/*/*.jsonl`. |
| `starsos chat show <uuid\|.>` | Meta view of a chat. `.` = current chat (from env vars). |
| `starsos chat resume <uuid\|alias> [--new-tab]` | **Implicit liftoff** (context block) + spawn `claude --resume <uuid>` in current terminal. `--new-tab` opens new iTerm2 tab (macOS only in v0.1). |
| `starsos chat task <uuid\|alias> "..."` | **M1.5 feature**: dispatch background subagent task in chat context. See [ADR-010](docs/adr/010-task-subagent.md). |
| `starsos chat task-list/task-show/task-abort` | Task lifecycle management. |
| `starsos chat done <uuid\|.> --status ... --summary ...` | **Explicit touchdown**: writes session-log, marks chat done, runs `post-touchdown.sh`. |
| `starsos chat current` | Returns UUID of the chat in the current Claude-Code session. |
| `starsos chat tag/untag <uuid\|.> <tag>` | Tag management. |
| `starsos chat note <uuid\|.> "..."` | Append note. |
| `starsos chat link <uuid\|.> --project <slug>` | Link chat to project. |
| `starsos chat status <uuid\|.>` | Per-chat status (active/parked/done/archived). |
| `starsos chat send <uuid> --prompt "..."` | Queue an inbox prompt. |
| `starsos chat watch [--notify]` | File-watcher; `--notify` triggers macOS notifications. |
| `starsos project list/rename/add/archive` | Project pretty-name layer. Minimal CRUD. |
| `starsos mcp install/list/call` | MCP server management. |
| `starsos migrate` | One-shot StarsHub project-name import. |

**Global flags and aliases (Tier 2):**

- `--json` — structured output on every command
- `.` shortcut — when running inside Claude-Code-Bash, resolves to current chat UUID from env vars
- `A1, A2, B1, ...` aliases — from last `starsos status` call; persists 24h or until next `status`

**TUI surface (Tier 2 Stable):**

- `starsos` (no args) → TUI cockpit
- Inside TUI: `<alias> resume`, `<alias> new window` (or `nw`), `<alias> tag/note/done/task`, `r` refresh, `q` quit, `?` help
- TUI rendering format is **Tier 1 Provisional** (cosmetic improvements OK in minor versions)
- TUI command grammar above is **Tier 2 Stable**

### Hook contract (Tier 2 Stable — see [ADR-009](docs/adr/009-hook-system.md))

The five hooks (`pre-liftoff.sh`, `post-touchdown.sh`, `post-chat-tag.sh`, `post-chat-note.sh`, `post-init.sh`) and their env-var contracts are Tier 2 Stable. Additions to env vars are non-breaking; removals require a major version bump.

Commands deliberately **not** in v0.1 (see [ADR-008](docs/adr/008-anti-scope-v0.1.md)):

- `starsos session start/end/log` — superseded by chats as session abstraction
- `starsos liftoff` / `starsos touchdown` — context-assembly rituals; deferred
- `starsos memory add/list/search` — structured memory; deferred
- `starsos find` — FTS5 cross-surface search; deferred
- `starsos report` — time aggregation; deferred
- `starsos chat ask` / `starsos chat run` — headless Anthropic API calls; deferred
- `starsos sync push/pull` — optional remote sync; deferred

### Stable storage paths and formats

| Path | Format | Notes |
|---|---|---|
| `~/.starsos/config.toml` | TOML, top-level keys: `[general]`, `[mcp]`, `[ui]` | Top-level sections stable; sub-keys may grow. See [03-data-model.md](strategy/03-data-model.md). |
| `~/.starsos/stars.db` | SQLite WAL mode | Migrations forward-only. |
| `~/.starsos/mcp-servers/<name>/` | Filesystem | Installed MCP servers; managed via `starsos mcp install/remove`. |
| `~/.starsos/logs/YYYY-MM-DD.jsonl` | JSONL | Daily action log. Audit only; not source of truth. |

> `~/.starsos/memory/`, `~/.starsos/projects/<slug>/`, and `~/.starsos/adapters/` are reserved paths for future features ([ADR-008](docs/adr/008-anti-scope-v0.1.md) anti-scope) — Stars OS will not create or write to them in v0.1.

### MCP protocol surface (Tier 2 — Stable since v0.1)

- Stars OS speaks the [Model Context Protocol](https://modelcontextprotocol.io) as a client via `@modelcontextprotocol/sdk`
- MCP servers under `@starsos/mcp-server-*` are individually versioned; each ships its own STABILITY notes
- We follow MCP's own protocol versioning, which is Tier 3 from MCP's perspective and Tier 2 from ours

**Deprecation policy for Tier 2:**

1. Mark in code with `@deprecated` JSDoc tag
2. Emit a runtime warning the first time used per session
3. Document in `CHANGELOG.md` under "Deprecated"
4. Keep working for **at least 2 minor versions** after the warning starts
5. Remove only in next major version

---

## Tier 1 — Provisional (the working surface, evolving)

These can change in any minor version. They are documented and supported, but we reserve the right to improve them.

| Surface | Why provisional |
|---|---|
| Table output format of `starsos status`, `project list`, `session list` | UI iterates as we learn what's useful. |
| Internal MCP-client layer (`packages/cli/src/mcp/`) | We may rev `@modelcontextprotocol/sdk` versions in minor releases; protocol-version-pinning is a future concern. |
| Command flags without explicit Tier 2 mark (e.g. `--json`, `--plain`, `--verbose`) | Output flags shift as needs emerge. |
| `starsos doctor` checks and output format | Diagnostics will grow over time. |

**Change policy for Tier 1**: announce in `CHANGELOG.md`, no deprecation window required. Don't break minor versions casually, but you may.

---

## Tier 0 — Experimental (try, don't depend on)

These are explicitly marked. Use them to give feedback. Do not build production workflows around them.

| Mechanism | Where |
|---|---|
| `--experimental` flag | Required for any command in this tier (e.g. `starsos liftoff --experimental` in v0.1 if Liftoff lands early) |
| `unstable_*` prefix | SDK exports like `unstable_streamEvents()` |
| `@starsos/sdk/unstable` subpath import | Anything imported from here is fair game to break |
| `experiments/` folder in this repo | Code lives outside main packages; clearly marked README inside |

**Rules:**

- No production user should depend on Tier 0 without explicit opt-in
- Removing Tier 0 features requires nothing more than a `CHANGELOG.md` entry
- A Tier 0 → Tier 1 promotion ("graduation") requires an ADR and at least one minor version of community testing

---

## Lifecycle: how tiers promote and demote

```
Tier 0 (Experimental)
       │   "We tried it for a release, it works. Let's promote."
       │   Requires: ADR + 1 minor version of stability + no major bugs reported.
       ▼
Tier 1 (Provisional)
       │   "Two minor versions of API stability, contributors agree."
       │   Requires: ADR + 2 minor versions stable + RFC discussion period.
       ▼
Tier 2 (Stable)
       │   "We've never wanted to change this in 12+ months."
       │   Very rare. Most things should not be Tier 3.
       ▼
Tier 3 (Locked)
```

**Demotion is rare and serious.** Going from Tier 2 to Tier 1 requires:

- An ADR explaining why
- A migration path for affected users
- A minor version of warning before the demotion takes effect

We will not demote Tier 3. Tier 3 things are removed, not demoted — and removal is a major version event.

---

## How to use this document

### If you are a user

Look up the command, flag, or path you depend on. If it's Tier 2 or Tier 3, you have strong guarantees. If it's Tier 1 or Tier 0, read the changelog before upgrading.

### If you are a contributor

Before opening a PR that touches public API:

1. Find the surface in the tables above
2. Determine its tier
3. If your change is breaking and the tier doesn't allow it, you have three options:
   - Make the change non-breaking (add, don't replace)
   - Demote the surface first (Tier 2 → 1, with ADR)
   - Schedule the breaking change for the next major version

### If you are unsure

Open a GitHub Discussion. Reading this document and asking is better than guessing.

---

## Architecture Decision Records

Major decisions that shape what is in which tier are tracked as ADRs in [`docs/adr/`](docs/adr/). Current set:

- [ADR-000 — ADR template](docs/adr/000-template.md)
- [ADR-001 — Coexistence and eventual absorption of StarsHub](docs/adr/001-absorb-starshub.md)
- [ADR-002 — Bun as primary runtime](docs/adr/002-bun-runtime.md)
- [ADR-003 — AGPL-3 license + CLA](docs/adr/003-agpl-license.md)
- [ADR-004 — Monorepo with pnpm workspaces](docs/adr/004-monorepo.md)
- [ADR-005 — CLI name `starsos` and storage path `~/.starsos/`](docs/adr/005-naming-and-paths.md)
- [ADR-006 — MCP-wrapper strategy (no custom adapter SDK)](docs/adr/006-mcp-wrapper.md)
- [ADR-007 — Repo visibility: private until W4, then silent public](docs/adr/007-repo-visibility.md)
- [ADR-008 — Anti-scope for v0.1](docs/adr/008-anti-scope-v0.1.md)
- [ADR-009 — Hook system for operator-specific automation](docs/adr/009-hook-system.md)
- [ADR-010 — Task subagent pattern](docs/adr/010-task-subagent.md)

New ADRs are welcome. Use [ADR-000](docs/adr/000-template.md) as the template.

---

## Versioning summary

Stars OS follows [Semantic Versioning 2.0](https://semver.org/). For this project, that translates to:

- **Patch (`x.y.Z`)**: bug fixes, doc improvements, no API change
- **Minor (`x.Y.0`)**: new features, Tier 1 changes, additive Tier 2 changes, Tier 0 promotions/removals
- **Major (`X.0.0`)**: breaking changes to Tier 2 surfaces; Tier 3 changes only happen with a migration tool shipped in the same release

Pre-1.0 releases (`0.x.y`) follow the same rules with one exception: **minor versions may include breaking Tier 2 changes** as long as they are documented prominently in the changelog. This is the standard "pre-1.0 SemVer" interpretation.

---

## Questions

If you read this and something feels ambiguous, open a [GitHub Discussion](https://github.com/starsos-project/starsos/discussions) tagged `stability-policy`. We will clarify, and probably amend this document.
