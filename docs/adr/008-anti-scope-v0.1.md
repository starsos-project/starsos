# ADR-008 — Anti-scope for v0.1

- **Status**: Accepted
- **Date**: 2026-05-15
- **Deciders**: @gbechtold
- **Tags**: scope, discipline, supersedes-archived-plans

## Context

Earlier strategy documents (now archived under `strategy/archive/2026-05-15/`) included a comprehensive feature set: event-sourcing append log, custom adapter SDK with manifest spec, FTS5 cross-surface search, 4-typed structured memory subsystem, Liftoff and Touchdown ritual commands, S3 sync, telemetry, GUI plans, federated network V2.

This is too much for an 8–12h/week solo-built v0.1. The maintainer needs hard rules about what stays out — both to limit scope drift during weekly planning and to refuse well-meaning agent-generated suggestions to build something off-plan.

## Options considered

### Option A — No formal anti-scope, decide ad-hoc each week

Lean on planning discipline alone. Each week, look at the roadmap and the time budget; trim accordingly.

- Pros: Maximum flexibility.
- Cons: Past experience shows discipline alone doesn't survive contact with creative ideas mid-sprint. Without a written rule, "just one more feature" wins repeatedly.

### Option B — Explicit anti-scope list, written, referenced from every planning artifact

Maintain a permanent list of "deliberately not in v0.1". Every plan reviews this list. Agents stop and ask if they encounter something on it.

- Pros: Removes ambiguity. Reduces decision fatigue. Makes scope cuts feel like enforcing a rule rather than retreating.
- Cons: Risk of cargo-cult adherence — never reconsidering whether the list is still right.

### Option C — Per-feature time-box

Allow any feature, but cap each at a time budget. If it exceeds, drop.

- Pros: Honest with self.
- Cons: Time-boxes routinely break. Doesn't actually prevent scope creep.

## Decision

We chose **Option B** with a quarterly review checkpoint.

The anti-scope list below is canonical for v0.1. Items on it stay out **until explicitly promoted by a new ADR**.

Quarterly (every 13 weeks), the maintainer reviews the list:
- Does the original reason for excluding each item still hold?
- Has external feedback or own usage signaled real demand?

A review that promotes an item produces:
- A new ADR with date and reasoning
- An update to this ADR's Status field to "Superseded by ADR-XXX for item Y"
- An update to the relevant Tier in STABILITY.md

## The anti-scope list

These are **not** in v0.1:

### Architecture

- **Event-sourcing append log** (`events.jsonl`) — was Tier 3 Locked in original plan; SQLite alone is sufficient for v0.1 needs. Re-evaluate when audit-trail or cross-machine sync need it.
- **Custom adapter SDK** (`@starsos/sdk` with `defineAdapter()`) — superseded by [ADR-006 MCP-wrapper](006-mcp-wrapper.md).
- **Adapter manifest format** — replaced by standard MCP server declarations.

### Features

- **`starsos session start/end/log`** (StarsHub-style sessions) — superseded by chat-first design (2026-05-15). Chats are the session abstraction in v0.1. See [02-roadmap.md](../../strategy/02-roadmap.md) and [03-data-model.md](../../strategy/03-data-model.md). Plain `chat resume / chat status` cover the wedge use case.
- **FTS5 cross-surface search** (`starsos find`) — defer beyond v0.1. SQLite indexes on `chats`, `chat_tags`, `chat_notes` are enough for v0.1.
- **4-typed structured memory subsystem** (`starsos memory` with user/feedback/project/reference types) — defer beyond v0.1. The `chat_notes` table covers basic per-chat annotations.
- **Separate `starsos liftoff` command** — superseded by **implicit liftoff at `starsos chat resume`** (2026-05-15). Context block is shown automatically before the spawn. No separate command needed.
- **Separate `starsos touchdown` command** — superseded by **`starsos chat done`** which integrates touchdown into the chat lifecycle. Per-project `.starsos.toml` and `post-touchdown.sh` hook customize behavior.
- **`starsos report`** with billable breakdown and date ranges — defer unless wedge feedback demands it.
- ~~**`starsos chat ask` / `chat run`**~~ — **Superseded by [ADR-010](010-task-subagent.md)** (2026-05-15). Task subagent pattern promoted from anti-scope to M1.5 feature. Implementation uses headless Claude Code primarily; Anthropic API as fallback. Command name is `starsos chat task`, not `ask/run`.

### Infrastructure

- **S3-compatible sync** (`starsos sync push/pull`) — defer to v0.4+. Single-device usage is the v0.1 default.
- **Telemetry** (opt-in or otherwise) — defer to v0.2+. We don't need to know what users do until we have users.
- **Pro tier** (`starsos.dev` hosted) — defer until demand-signal (waitlist > 50 or 5+ paying inquiries). See [00-decisions.md](../../strategy/00-decisions.md) D-22.

### Surfaces

- **Web UI / dashboard** — no plan for v1.0. CLI is the entire surface.
- **Adapter marketplace UI** — adapters are just npm packages; install via `starsos mcp install`. No marketplace until adapter count > 20 and demand exists.
- **Federated operator network** (V2) — long-term idea, not on active roadmap. See [00-decisions.md](../../strategy/00-decisions.md) D-23.
- **Multi-device state replication** — single-device only for v0.1.

## Consequences

### Positive

- Maintainer has a written defense against scope creep
- Agents have a checklist of "if I'm about to do this, stop and ask"
- Future architecture decisions reference a stable baseline ("this is what v0.1 looked like")
- Promoting an item to v0.x.y is deliberate and documented, not accidental

### Negative

- Discipline can feel like missing out — the temptation to add "just one feature" is real
- If the wedge fails, this list may have included the very thing that would have saved it (low likelihood per W9-10 validation plan)

### Neutral

- The list is long; this is honest. Stars OS is intentionally small in v0.1

## Migration / rollout

This ADR takes effect immediately. The maintainer commits to:

1. **Pre-coding check**: before starting any task not in [02-roadmap.md](../../strategy/02-roadmap.md), check this list. If listed: stop, decide whether to promote (new ADR) or skip.
2. **Agent-prompt boilerplate**: every implementer-agent prompt includes a reference to this list with "if you encounter anti-scope, stop and ask".
3. **Weekly retro**: end of each week, glance at this list. Anything that's nagging? Document as a "wish-list item" in [00-decisions.md](../../strategy/00-decisions.md) — not a roadmap commitment.

## References

- [02-roadmap.md](../../strategy/02-roadmap.md) — defines what IS in v0.1
- [03-data-model.md](../../strategy/03-data-model.md) — schema reflects this anti-scope (no events, no FTS, no memory types)
- [ADR-006](006-mcp-wrapper.md) — explains why custom SDK is out
- Archived plans in `strategy/archive/2026-05-15/` — show what was originally in scope
