# ADR-010 — Task subagent pattern for `starsos chat task`

- **Status**: Accepted (supersedes earlier anti-scope on "no LLM API calls")
- **Date**: 2026-05-15
- **Deciders**: @gbechtold
- **Tags**: architecture, scope, ux, supersedes-008-partially

## Context

The early v0.1 anti-scope ([ADR-008](008-anti-scope-v0.1.md)) excluded `chat ask` / `chat run` — headless LLM-execution from Stars OS. Rationale was "Stars OS is a filesystem orchestrator; LLM execution stays in Claude Code itself."

After user-evaluation of the Cockpit UX (Game-Loop pattern, letter+number aliases), the operator's wedge use-case turns out to be:

> Stay in the meta-cockpit, dispatch tasks to specific chats, see their status live. Never lose the bird's-eye view.

This is impossible without a background-execution mechanism that runs as a subagent inside the context of a specific chat. We therefore promote this from anti-scope to a first-class M1.5 feature.

## Options considered

### Option X — Headless Claude Code via `claude --resume <uuid> -p "prompt"`

Use the existing Claude Code CLI in non-interactive mode:

```bash
claude --resume <uuid> -p "do X with context from this chat" \
  > ~/.starsos/tasks/<alias>-<timestamp>.out 2>&1 &
echo $! > /tmp/starsos-task-pid
```

- **Pros**: Reuses operator's Claude Code subscription. No Anthropic API key needed in Stars OS. Response naturally appears in the source JSONL. Output is identical to what the operator would see resuming manually.
- **Cons**: Depends on `claude --resume -p` headless-mode being supported and stable. Must be verified by a spike before M1.5 implementation.

### Option Y — Direct Anthropic API with shadow-chat-JSONL

Stars OS reads the source JSONL, makes its own API call with `$ANTHROPIC_API_KEY`, writes the response to a **shadow JSONL** (separate file under `~/.starsos/shadow-chats/<uuid>-<task-id>.jsonl`). User can review / merge / discard.

- **Pros**: Works regardless of Claude Code's CLI capabilities. Full control over request shape.
- **Cons**: Requires Anthropic key in Stars OS config. Costs operator extra (separate from Claude Code subscription). Response is NOT in the source JSONL — manual merge needed to be visible during `chat resume`.

### Option Z — No subagent feature

Stay strict on anti-scope. Operator dispatches manually by resuming the chat.

- **Pros**: Simplest.
- **Cons**: Defeats the cockpit Game-Loop. Operator loses meta-view every time.

## Decision

We chose **Option X as primary, Option Y as fallback**.

Implementation:

1. **M1.5 starts with a 1-hour spike**: verify `claude --resume <uuid> -p "prompt"` works headless, captures full response, exits cleanly, appends to source JSONL. Test with a fixture chat.
2. **If verified** → implement Option X. `starsos chat task` uses background-spawned `claude` processes.
3. **If not verified** (headless mode broken / undocumented / unstable) → implement Option Y. Operator must set `ANTHROPIC_API_KEY` and accept shadow-chat semantics.
4. **Config knob** (`tasks.backend` in config.toml): defaults to `auto` (prefer X, fall back to Y). User can force one or the other.

## Consequences

### Positive

- Cockpit Game-Loop becomes complete: dispatch + observe + stay-meta
- Operator can run 3-5 chats "working in parallel" (subagent tasks) while focused on one in the foreground
- Promotes a new operating pattern: cockpit-driven instead of switching-driven

### Negative

- M1.5 adds ~8h of work beyond M1's original scope
- Headless-Claude support uncertain until spike completes; Option Y is more code
- Background-process management on macOS/Linux requires careful PID/output handling

### Neutral

- Stars OS gains LLM-awareness when Option Y is active; this is a meaningful architectural shift but contained behind the `chat task` surface
- Updates to anti-scope ADR-008 to remove `chat ask` / `chat run` exclusions (which were the same idea under a different name)

## Stability commitments

- `starsos chat task` command interface (args, output, exit codes): **Tier 2 Stable** from v0.1
- `starsos chat task-list/show/abort`: **Tier 2 Stable** from v0.1
- `tasks` SQLite table schema: **Tier 3 Locked** for primary key columns (id, chat_uuid, status); other columns may evolve
- Output file format (`<alias>-<ts>.out`): **Tier 1 Provisional** — may grow structure (e.g. JSON sections for tokens, errors)
- Backend selection (`headless-claude` vs `anthropic-api`): **Tier 1 Provisional** — additional backends may be added (`continue-dev`, `cursor`, ...)

## Migration / rollout

- M1.5 ships task feature in v0.1.0-alpha.X (after M1)
- Anti-scope ADR-008 is updated: `chat ask` and `chat run` removed from out-of-scope list, replaced by reference to this ADR
- README adds "Task Subagent" section after "Cockpit"
- IT-13 added: end-to-end task dispatch and lifecycle test (will need Headless-Claude mock or real Claude install)

## References

- [02-roadmap.md M1.5](../../strategy/02-roadmap.md) — Task Subagent Pattern
- [03-data-model.md](../../strategy/03-data-model.md) — `tasks` table schema
- [008-anti-scope-v0.1.md](008-anti-scope-v0.1.md) — supersedes "no LLM API calls" line
- [STABILITY.md](../../STABILITY.md) — chat task surfaces listed in Tier 2/3
