<div align="center">

# Stars OS

**The open-source operator layer for AI-native work.**

Persistent memory, session lifecycle, and modular adapters for Claude Code, Cursor, and other AI agents — all CLI-first, local-by-default.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Status: Pre-alpha](https://img.shields.io/badge/Status-Pre--alpha-orange.svg)](#roadmap)

[Website](https://starsos.org) · [Docs](https://docs.starsos.org) · [Pro Services](https://starsos.dev)

</div>

---

## The problem

You have 15+ Claude Code chats open across multiple projects. You don't remember which chat covered what. You forget where you left off. You switch projects ten times a day and lose the meta-overview each time.

You end up browsing `~/.claude/projects/` manually or grep'ing JSONL files to find the right thread.

## Stars OS gives you

- **`starsos`** alone — opens an interactive TUI cockpit (`lazygit`-style). The primary Game-Loop. Chats listed with simple aliases: `A1, A2, B1, ...`
- **`starsos status`** — same view as one-shot output for scripts and piping
- **`starsos chat resume A2`** — implicit liftoff (git status, last session log, open tasks, Infisical hint) then spawn `claude --resume` in current terminal. `--new-tab` for new iTerm2 tab (macOS).
- **`starsos chat task A2 "..."`** — dispatch a background subagent task to chat A2. Status visible in cockpit as `A2 ▶ running`. The killer feature for parallel orchestration.
- **`starsos chat done A2 --status FERTIG`** — explicit touchdown: writes session log, updates your external registries via `post-touchdown.sh`
- **`starsos chat tag/note/send/link`** — metadata on top of chats, JSONL stays untouched. Inbox-pattern for queued prompts.
- **`starsos chat watch [--notify]`** — live updates + optional macOS notifications
- **`starsos mcp install/call`** — call MCP servers (Paperclip, Moco, ...) without leaving the terminal
- **Hook system** — `~/.starsos/hooks/post-touchdown.sh` etc. let you update `PROJECTS.md`, ACTIVITY logs, People-CRMs, anything you own

Use `.` as shortcut for "current chat" when running inside Claude Code: `starsos chat tag . wip`.

All open source. All running locally on your machine. No account required. Stars OS is a filesystem orchestrator — it never makes LLM API calls of its own.

---

## Install

You need [Bun](https://bun.sh) installed first:

```bash
curl -fsSL https://bun.sh/install | bash
```

Then install Stars OS:

```bash
bun install -g @starsos/cli
```

Or run without installing globally:

```bash
bunx @starsos/cli --help
```

Verify:

```bash
starsos --version
```

Homebrew formula and a single-binary installer (`curl … | sh`) are planned for v0.2.

---

## Quick start

```bash
# 1. Initialize Stars OS
starsos init

# 2. Open the cockpit (interactive TUI — your home screen)
starsos

# In the cockpit you see your chats numbered: A1, A2, B1, ... grouped by project.
# Type:
#   A2 resume                 → liftoff + spawn `claude --resume` in this terminal
#   A2 new window             → open new iTerm2 tab with claude --resume
#   A2 task "fix the tests"   → dispatch background subagent (M1.5)
#   A2 tag wip                → add tag without switching
#   A2 done                   → touchdown with summary prompt
#   r                          → refresh
#   q                          → quit
#
# Or one-shot from the shell:
starsos chat resume A2 --new-tab
starsos chat tag A2 wip
starsos chat send A2 --prompt "remember to update the README"
```

That's the Game-Loop. Projects are auto-detected from your chats' working directories. Liftoff and touchdown wrap each chat session. Your own `~/.starsos/hooks/post-touchdown.sh` keeps your external registries (PROJECTS.md, ACTIVITY-LOG.md, etc.) in sync. Everything else (MCP servers, migrations, task subagents) builds on top.

---

## How it works

```
┌─────────────────────────────────────────────┐
│  Your terminal (Claude Code, Cursor, …)     │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  starsos CLI                                │
│  ┌──────────┐ ┌─────────┐ ┌─────────────┐  │
│  │ Sessions │ │ Memory  │ │ Projects    │  │
│  └──────────┘ └─────────┘ └─────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │ Adapter SDK (plug in anything)       │  │
│  └──────────────────────────────────────┘  │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
            ~/.starsos/  ← All your data, on your disk
```

**Local-first.** Stars OS metadata lives in `~/.starsos/`. Chats stay where Claude Code put them (`~/.claude/projects/*/*.jsonl`) — Stars OS reads but never writes them.

**MCP-native.** Adapters are standard MCP servers (`@starsos/mcp-server-*`). The same servers you install for Stars OS also work in Claude Desktop, Cursor, Continue.dev.

**Filesystem-orchestrator only.** Stars OS does not make LLM API calls itself. It coordinates Claude Code, not duplicates it.

---

## Adapters

All adapters are standard **MCP servers**. They work in Stars OS, Claude Desktop, Cursor, Continue.dev — anywhere that speaks MCP.

| MCP server | Purpose | Milestone |
|---|---|---|
| `@starsos/mcp-server-paperclip` | Project list, activities, time logging | M4 wedge |
| `@starsos/mcp-server-moco` | Time tracking sync | M5 |
| `@starsos/mcp-server-clickup` | Tasks and time entries | M6 |
| `@starsos/mcp-server-hetzner` | Cloud host management | Beyond M9 |
| `@starsos/mcp-server-cloudways` | App management | Beyond M9 |

**Write your own MCP server** using the official `@modelcontextprotocol/sdk`. Stars OS does not require an SDK of its own.

---

## Why open source

We believe the *code* layer is a commodity. The lasting value is in:

- **People networks** — who you know, who you trust
- **Systems** — workflows you've earned through experience
- **Data** — datasets you've gathered or refined
- **Real-world infrastructure access** — credentialed, audited, accountable

Stars OS is AGPL-3 forever for the core. We never ask you for an account to use it. If you want a managed hosted version with team views, audit logs, and managed sync, see [starsos.dev](https://starsos.dev).

---

## Roadmap

Milestones, not dates. We ship when a milestone is real.

- **M1 — Chat Cockpit + Liftoff/Touchdown + Hooks + TUI**: interactive cockpit, letter+number aliases, implicit liftoff at resume, explicit touchdown at done, hook system, `--new-tab`
- **M1.5 — Task Subagent**: `chat task <alias> "..."` dispatches background subagents, status visible in cockpit
- **M2 — Project Registry (minimal)**: pretty-name layer over auto-detected projects
- **M3 — StarsHub Migration**: import project names and external refs (sessions deliberately skipped — chats are sessions)
- **M4 — MCP Client + Wedge Adapter** (Paperclip, contingent on maintainer verification)
- **M5 — Moco adapter** as MCP server
- **M6 — ClickUp adapter** as MCP server
- **M7 — Public push** (silent mode, no Show HN)
- **M8 — Dogfood-heavy phase**
- **M9 — External wedge validation** (3–5 operators)
- **Beyond M9** — Show HN (conditional), Liftoff/Touchdown, memory subsystem, more adapters

See [STABILITY.md](STABILITY.md) for what's guaranteed vs. what may move. [docs/adr/](docs/adr/) holds the architectural decisions.

---

## Community

- **GitHub Discussions**: Use the [Discussions tab](https://github.com/starsos-project/starsos/discussions) for questions and ideas
- **X / Twitter**: [@StarsosOrg](https://twitter.com/StarsosOrg)

A Discord server will open closer to v0.1 launch.

---

## Contributing

We welcome contributions, especially:

- New adapters for tools and platforms you use daily
- Documentation improvements
- Bug reports with reproducible steps
- Recipes and workflow examples

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

---

## License

[AGPL-3.0](LICENSE) for the core. Pro services on [starsos.dev](https://starsos.dev) are under separate commercial terms.

Inspired by [Paperclip](https://paperclip.ing) — both in spirit and in license choice.

Built by [Stars Media IT GmbH](https://starsmedia.com) and the community.
