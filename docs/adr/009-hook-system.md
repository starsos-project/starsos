# ADR-009 — Hook system for operator-specific automation

- **Status**: Accepted
- **Date**: 2026-05-15
- **Deciders**: @gbechtold
- **Tags**: extensibility, integration, stability-tier, post-phase-0

## Context

Operators using Stars OS will have their own peripheral systems they want to keep synchronized: a People-CRM, a `PROJECTS.md` registry, an `ACTIVITY-LOG.md`, a `SESSIONS.md` resume-index, content-pipeline trackers, security-check logs, etc.

Three options for handling these:

1. Build them all into Stars OS Core (rigid, niche)
2. Ignore them (Stars OS becomes useless for power users)
3. **Expose lifecycle hooks** that run user-owned scripts at key moments

Hooks decouple Stars OS Core from per-operator integration logic. Stars OS Core stays generic and OSS-friendly; the maintainer's StarsMedia-specific integrations (People-CRM, PROJECTS.md updates, etc.) live in private hook scripts.

## Decision

Stars OS exposes a **lifecycle hook system** at `~/.starsos/hooks/`. Hooks are executable scripts (any language with a shebang) that Stars OS invokes at specific events. The hook contract is **Tier 2 Stable**: env-var names, ordering, and exit-code semantics do not change between minor versions.

## The five hooks (v0.1)

| Hook script | Trigger | Stars OS waits for it? |
|---|---|---|
| `~/.starsos/hooks/pre-liftoff.sh` | Before `starsos chat resume` spawns `claude --resume` | Yes — exits non-zero aborts the resume |
| `~/.starsos/hooks/post-touchdown.sh` | After `starsos chat done` finishes its built-in updates | Yes — exits non-zero is logged but does not roll back |
| `~/.starsos/hooks/post-chat-tag.sh` | After `starsos chat tag` adds/removes tags | No — fire-and-forget |
| `~/.starsos/hooks/post-chat-note.sh` | After `starsos chat note` appends | No — fire-and-forget |
| `~/.starsos/hooks/post-init.sh` | Once after `starsos init` succeeds | Yes — but errors are non-fatal |

Hooks are **optional**. Missing files mean Stars OS proceeds normally — no warning. Stars OS Core does not ship a default hook; users opt in by creating their own.

## Environment variables (Tier 2 Stable contract)

All hooks receive:

```
STARSOS_HOME            Path to ~/.starsos/
STARSOS_VERSION         Semver of Stars OS that invoked the hook
STARSOS_HOOK_NAME       Name of the hook (pre-liftoff, post-touchdown, etc.)
STARSOS_EVENT_TS        ISO8601 timestamp of the event
```

Plus hook-specific context:

### `pre-liftoff.sh`
```
STARSOS_CHAT_UUID       The chat being resumed
STARSOS_CHAT_CWD        Working directory of the chat
STARSOS_PROJECT_SLUG    Linked project slug (or empty)
STARSOS_PROJECT_PATH    Linked project root_path (or empty)
```

### `post-touchdown.sh`
```
STARSOS_CHAT_UUID       The chat being done'd
STARSOS_CHAT_CWD        cwd
STARSOS_PROJECT_SLUG    Linked project (or empty)
STARSOS_PROJECT_PATH    Project root_path (or empty)
STARSOS_TOUCHDOWN_LOG   Path to generated session-log .md file
STARSOS_TOUCHDOWN_SUMMARY  One-line summary captured by `chat done`
STARSOS_TOUCHDOWN_STATUS   FERTIG | IN ARBEIT | BLOCKED (or English equivalents)
```

### `post-chat-tag.sh` / `post-chat-note.sh`
```
STARSOS_CHAT_UUID
STARSOS_ACTION          add | remove (tag) or append (note)
STARSOS_TAG             The tag (for tag hook only)
STARSOS_NOTE_BODY       The note body (for note hook only)
```

### `post-init.sh`
```
(only the global vars; no extra context)
```

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Hook succeeded |
| Non-zero | Hook failed |

For `pre-liftoff.sh`: non-zero **aborts** the resume. The user sees the hook's stderr.
For all other hooks: non-zero is **logged** to `~/.starsos/logs/YYYY-MM-DD.jsonl` but does not change Stars OS behavior.

## What hooks can do

- Update external Markdown registries (PROJECTS.md, ACTIVITY-LOG.md, SESSIONS.md)
- Run People-CRM scripts (e.g. `bash touchdown-people.sh "$names"`)
- Trigger backups, notifications, syncs
- Invoke other tools (Infisical, 1Password, Notion, Linear, Obsidian, etc.)
- Append to security check logs
- Send Slack / Discord / iMessage notifications via osascript
- Anything an executable script can do — Stars OS doesn't care

## What hooks cannot (must not) do

- Modify `~/.starsos/stars.db` directly (use `starsos` CLI subcommands instead)
- Modify `~/.claude/projects/*/*.jsonl` files (Claude Code owns those)
- Hang indefinitely — Stars OS times out at 30s and logs a warning

## Stability commitments

- The five hook names, their trigger order, and their env-var contracts are **Tier 2 Stable**: breaking changes go through a major version bump with deprecation window
- Adding new env vars to existing hooks is non-breaking (additive)
- Adding entirely new hook events is non-breaking (operators opt in)
- Removing a hook event is breaking (requires major bump)
- The hook timeout (30s) is Tier 1 Provisional — may grow if real workloads demand

## Example: maintainer's post-touchdown.sh (private, not shipped)

```bash
#!/usr/bin/env bash
# ~/.starsos/hooks/post-touchdown.sh — StarsMedia-specific
set -euo pipefail

PROJECTS_MD=~/Documents/Projects/BusinessProjects/PROJECTS.md
ACTIVITY_LOG=~/Documents/Projects/ACTIVITY-LOG.md
SESSIONS_MD=~/.claude/SESSIONS.md
PEOPLE_DIR=~/Documents/Projects/People

# 1. Update PROJECTS.md status if project tag set in summary
[ -n "$STARSOS_PROJECT_SLUG" ] && bash "$PEOPLE_DIR/_scripts/update-projects-md.sh" \
  --slug "$STARSOS_PROJECT_SLUG" \
  --status "$STARSOS_TOUCHDOWN_STATUS"

# 2. Prepend new row to ACTIVITY-LOG.md
bash ~/bin/activity-log-prepend.sh \
  --date "$(date +%Y-%m-%d)" \
  --project "$STARSOS_PROJECT_SLUG" \
  --summary "$STARSOS_TOUCHDOWN_SUMMARY" \
  --log "$STARSOS_TOUCHDOWN_LOG"

# 3. Update SESSIONS.md with new resume-index entry
bash ~/bin/sessions-md-update.sh --chat "$STARSOS_CHAT_UUID" --status "$STARSOS_TOUCHDOWN_STATUS"

# 4. People-CRM if relevant (grep summary for known people names)
NAMES=$(grep -oE '@[A-Za-z]+' <<< "$STARSOS_TOUCHDOWN_SUMMARY" || true)
[ -n "$NAMES" ] && bash "$PEOPLE_DIR/_scripts/touchdown-people.sh" $NAMES
```

This script is private to the maintainer's machine. The OSS Stars OS Core knows nothing about it.

## Documentation

A `docs/hooks.md` page (shipped in the public repo) explains the contract with example hooks for common cases:
- Update a Markdown registry
- Send a macOS notification
- Sync to Obsidian
- Trigger a backup

These are **examples**, not built-ins. The user copies, adapts, owns.

## References

- [STABILITY.md](../../STABILITY.md) — hook contract listed in Tier 2
- [02-roadmap.md](../../strategy/02-roadmap.md) — M1 includes hook implementation
- [03-data-model.md](../../strategy/03-data-model.md) — hook directory in storage layout
- Inspiration: Git hooks (`.git/hooks/`), Husky, lefthook
