# Stars OS — User Guide

> *Run more projects with greater clarity. Replace 15+ open Claude Code chats with a single mission-control view.*

## Install (one time, ~30 seconds)

```bash
curl -fsSL https://bun.sh/install | bash    # if you don't have Bun yet
bun install -g @starsos/cli                  # install Stars OS
starsos --version                            # → 0.1.0-alpha.1
```

Open a fresh terminal afterwards (so `~/.bun/bin` is on `$PATH`), then run `starsos init` once.

## The 30-second tour

```bash
starsos                  # → opens the cockpit (interactive TUI)
starsos status           # → one-shot list, top 15 chats
starsos chat resume A1   # → liftoff + claude --resume in this terminal
starsos chat done .      # → touchdown for the current chat
```

That's the loop. Everything else builds on it.

## Daily workflow

### Morning: open the cockpit

```bash
starsos
```

You see your projects (A, B, C, ...) and your latest chats numbered inside them (A1, A2, B1, ...). Recent chats at the top. Status colors: green = active, yellow = parked, dim = done.

### Pick a chat and resume

Inside the cockpit, type:

```
A2 resume
```

Stars OS prints a **liftoff context block** (git status, last session log, open tasks, pending inbox, Infisical hint if configured), then spawns `claude --resume <uuid>` in this terminal. You are now inside that chat with full context.

Equivalent one-shot from the shell:

```bash
starsos chat resume A2
```

### Tag, note, link while you work

You can stay in the cockpit and apply metadata without switching:

```
A2 tag wip urgent
A3 note "remember to ship the migration"
B1 link 066-fff
```

Or from another terminal:

```bash
starsos chat tag A2 wip urgent
starsos chat note A3 "remember the migration"
```

### Queue a prompt for later (inbox)

You want chat A2 to do something next time you open it:

```bash
starsos chat send A2 --prompt "update the README before commit"
```

The prompt lands in `~/.starsos/inboxes/<uuid>.md`. When you next `chat resume A2`, the queued prompts surface as the first thing.

### Dispatch a task as background subagent (M1.5)

You want A2 to run something *now* without opening it:

```bash
starsos chat task A2 --prompt "summarize the open tasks in CLAUDE.md"
```

Stars OS spawns `claude --resume <uuid> -p "..."` in the background. The cockpit shows it as `▶ running`. When done, the output is saved at `~/.starsos/tasks/A2-<timestamp>.out` and the chat's JSONL has the new exchange.

Check status of background tasks:

```bash
starsos chat task-list
starsos chat task-show <task-id>
starsos chat task-abort <task-id>
```

### Evening: touchdown

When you're done with a chat:

```bash
starsos chat done A2 --status FERTIG --summary "Performance baseline complete"
```

Stars OS writes a session log to `<project>/session-logs/YYYY-MM-DD-<slug>.md`, marks the chat as `done` in the cockpit, and runs your `~/.starsos/hooks/post-touchdown.sh` hook (if any) — which can update `PROJECTS.md`, `ACTIVITY-LOG.md`, your People-CRM, anything.

## TUI cheatsheet

When you type `starsos` with no args, you're in the cockpit. Commands:

| Type | What it does |
|---|---|
| `<alias> resume` (or `r`) | Resume in current terminal |
| `<alias> nw` (or `new window`) | Open in a new iTerm2 tab (macOS) |
| `<alias> show` | Meta view: tags, notes, preview |
| `<alias> tag <tag>` | Add tag |
| `<alias> untag <tag>` | Remove tag |
| `<alias> note <text>` | Append note |
| `<alias> link <slug>` | Manual project link |
| `<alias> send <text>` | Queue inbox prompt |
| `<alias> task <text>` | Dispatch background subagent (M1.5) |
| `<alias> done <status> <summary>` | Touchdown |
| `<alias> status [s]` | Get / set per-chat status |
| `r` or `refresh` | Re-render cockpit |
| `?` or `help` | Show this list |
| `q` or `quit` | Exit cockpit |

## Output formats

Every Stars OS command supports `--json` for piping into other tools:

```bash
starsos status --json | jq '.projects[].chats[] | select(.tags[] == "wip")'
```

And `--plain` for grep-friendly tab-separated output:

```bash
starsos status --plain | grep "active" | head
```

## Watch mode (live updates)

```bash
starsos chat watch
```

Stars OS watches your `~/.claude/projects/` archive. When a chat receives a new message, you see a live update line. With `--notify`, you also get macOS notifications:

```bash
starsos chat watch --notify
```

## Pagination

By default, `starsos status` shows the **top 15 chats** across all projects (newest first), grouped by project, max 5 per project. To override:

```bash
starsos status --limit 30   # show top 30
starsos status --all        # show everything (warning: long output)
starsos status --here       # only chats whose cwd matches current dir
```

## Letter+number aliases (A1, A2, ..., AA1, AB2)

Each `starsos status` call assigns aliases:

- **Letter = project**, ordered by most recent chat activity
- **Number = chat within project**, also newest first
- After 26 projects: `AA, AB, AC, ...` (spreadsheet style)

Aliases persist in `~/.starsos/state/last-status.json` for 24h or until next `status` call. After that they refresh.

All commands accept the alias, the full UUID, a UUID prefix (≥ 4 chars), or `.` (current Claude chat when running inside Claude-Code-Bash).

## Hook system

Stars OS calls your own shell scripts at lifecycle events. Drop them in `~/.starsos/hooks/`:

| File | Trigger | Wait? |
|---|---|---|
| `pre-liftoff.sh` | before `chat resume` | yes (non-zero exit aborts) |
| `post-touchdown.sh` | after `chat done` | yes (errors logged, not fatal) |
| `post-chat-tag.sh` | after `chat tag` | no |
| `post-chat-note.sh` | after `chat note` | no |
| `post-init.sh` | after `starsos init` | yes (non-fatal) |

Each hook receives env vars: `STARSOS_CHAT_UUID`, `STARSOS_PROJECT_SLUG`, `STARSOS_TOUCHDOWN_LOG`, `STARSOS_TOUCHDOWN_SUMMARY`, `STARSOS_TOUCHDOWN_STATUS`. See `docs/adr/009-hook-system.md` for the full contract.

Example `post-touchdown.sh` that updates an external registry:

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "$(date +%F) · $STARSOS_PROJECT_SLUG · $STARSOS_TOUCHDOWN_SUMMARY" \
  >> ~/Documents/ACTIVITY-LOG.md
```

## Configuration

Stars OS reads `~/.starsos/config.toml`. The defaults are sensible. Two settings you may want to change:

```toml
[general]
# Override only if your Claude Code archive lives somewhere unusual
claude_archive_path = "~/.claude/projects"

[watch]
# Enable macOS notifications by default
notify_macos = true
```

Per-project overrides go in `<project-root>/.starsos.toml`:

```toml
[liftoff]
infisical_slug = "client/femalefuture"  # shows the hint on chat resume

[touchdown]
people_snapshot = true                   # passes STARSOS_PEOPLE_NAMES to your hook
```

## Troubleshooting

**"command not found: starsos"** — Bun is installed but not yet in `$PATH`. Open a fresh terminal, or run `source ~/.zshrc`.

**"chat not found"** — The alias is stale. Run `starsos status` to refresh. Or pass the UUID directly (a 4-char prefix is enough).

**Migration corrupted my data** — Stars OS never writes to `~/.claude/projects/` (Claude Code owns it) and never writes to `~/.stars/` (StarsHub owns it). If something looks off, run `starsos init` in a fresh `$STARSOS_HOME` to start clean.

**Cockpit too wide / too narrow** — Stars OS auto-adapts to your terminal width. If you want a stable format, use `--plain` or `--json`.

## Where things live

| Path | Purpose |
|---|---|
| `~/.starsos/stars.db` | SQLite — projects, chats, tags, notes, tasks |
| `~/.starsos/config.toml` | Global config |
| `~/.starsos/inboxes/<uuid>.md` | Queued prompts |
| `~/.starsos/tasks/<alias>-<ts>.out` | Task output files |
| `~/.starsos/hooks/<name>.sh` | Your lifecycle scripts |
| `~/.starsos/state/last-status.json` | Alias mapping from last `status` call |
| `~/.starsos/logs/YYYY-MM-DD.jsonl` | Daily action log (audit only) |
| `<project>/session-logs/YYYY-MM-DD-*.md` | Touchdown session logs |

## License

[AGPL-3.0](LICENSE). Inspired by [Paperclip](https://paperclip.ing).
