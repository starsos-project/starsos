# ADR-001 — Coexistence and eventual absorption of StarsHub

- **Status**: Accepted
- **Date**: 2026-05-15
- **Deciders**: @gbechtold
- **Tags**: scope, naming, migration, stability-tier

## Context

A pre-existing internal CLI named `stars` (StarsHub, v1.0.0) is installed at `~/.nvm/versions/node/v22.19.0/bin/stars`. It uses `~/.stars/` as its storage path and provides 13 commands: `init`, `ls`, `start`, `stop`, `log`, `project`, `find`, `note`, `link`, `sync`, `report`, `resume`, `switch`. Active session data, project registry, audit logs, and config currently live there.

The new Stars OS project aims to be an open-source operator layer with overlapping concepts: project registry, session lifecycle, find/search, sync to external systems. Without explicit alignment, the two tools would collide both in CLI namespace and storage path.

This ADR decides how the two relate, both now and long-term.

## Options considered

### Option A — Parallel coexistence (rename Stars OS CLI only)

Stars OS CLI is named `starsos`, storage at `~/.starsos/`. StarsHub keeps `stars` and `~/.stars/`. They never interact.

- Pros: Zero migration risk. Ship faster.
- Cons: Maintains two tools doing similar things. Confusing for the operator (Guntram). StarsHub features (Moco/ClickUp sync, search, time tracking) miss the OSS audience.

### Option B-light — Parallel now, plan absorption for v1.0

Stars OS ships as `starsos` in `~/.starsos/`. StarsHub stays as-is. In v1.0, an explicit `starsos migrate-from-starshub` tool is provided; StarsHub is then deprecated.

- Pros: Low risk near-term, clean migration path long-term.
- Cons: Two systems coexist for 6+ months; the OSS launch ships without the most battle-tested features (Moco/ClickUp).

### Option B-full — Absorb StarsHub features into the initial Stars OS commit

Stars OS launches with StarsHub-equivalent commands as first-party functionality plus Moco/ClickUp as first-party adapters. StarsHub is immediately deprecated and a migration tool is shipped from day one.

- Pros: OSS launch carries 2 years of internal battle-testing. Story is honest ("I built this for myself, now I OSS it"). Eliminates parallel-systems confusion.
- Cons: Initial commit work grows from ~2 days to ~6–10 days. Larger surface to keep stable from the start. Migration must work flawlessly on Guntram's own data (only live user at launch).

### Option D — Pick a non-overlapping brand (`knot`, `loom`, ...)

Stars OS releases as a Paperclip-style alternate-name (e.g. `knot`), CLI heißt `knot`, storage at `~/.knot/`. `starsos.org` becomes only the project's brand hub.

- Pros: Cleanest naming, no historical baggage, marketing-friendly.
- Cons: Conflicts with deep brand commitment (`starsos.org`, `starsos.dev` domains already registered, "Stars" lineage from StarsBridge/StarsLaunch/StarsHub). Sunk-cost on brand choice already made.

## Decision

We chose **Option B-full**.

**Rationale**: The OSS narrative is strongest when Stars OS is presented as the OSS-ification of a battle-tested internal system, not a hypothetical new tool. StarsHub's Moco and ClickUp integrations are exactly the kind of "credentialed access to real-world infrastructure" the strategy document highlights as the durable proprietary value worth wrapping. Shipping them as first-party adapters from v0.1 establishes the adapter pattern with quality examples and gives the launch real substance.

The cost — ~6 additional days of pre-push work — is acceptable given the strategic payoff.

## Consequences

### Positive

- Initial public commit ships ~13 working commands + 2 first-party adapters (Moco, ClickUp) + a migration tool
- "Show HN" narrative is concrete: 2-year-tested system, now open source
- Adapter SDK is exercised with two non-trivial real adapters from day one
- No parallel-system confusion for the operator
- Marketing surface is rich (release notes, "feature-by-feature" walkthroughs possible)

### Negative

- Pre-push work multiplied (~46h total vs. ~15h)
- Stars OS launches with a larger Tier 2 surface, increasing maintenance burden
- Migration tool must work perfectly on the maintainer's own data; data loss = catastrophic
- StarsHub-specific patterns (e.g. `start`/`stop` semantics) carry over and may need explicit Tier 1 treatment if they conflict with the new `liftoff`/`touchdown` rituals planned for Sprint 6

### Neutral

- CLI is `starsos`, not `stars`, for the lifetime of the coexistence — StarsHub keeps `stars` until deprecation
- Storage path is `~/.starsos/`, not `~/.stars/`, for the same reason
- Coexistence period: indefinitely. `stars` will keep working until Guntram deletes it; `starsos migrate-from-starshub` is opt-in

## Migration / rollout

### For the maintainer (Guntram)

1. Stars OS v0.1 ships
2. Run `starsos migrate-from-starshub --dry-run` — preview which projects, sessions, configs would migrate
3. Run `starsos migrate-from-starshub` for real — creates `~/.starsos/` with imported data, leaves `~/.stars/` untouched
4. Use Stars OS in parallel until comfort established
5. After 30 days of parallel use without issues, optionally `rm -rf ~/.stars/` and `npm uninstall -g stars-hub`

### For external users

Not applicable — StarsHub is private. External Stars OS users start fresh in `~/.starsos/`.

### Tier 3 commitments resulting from this ADR

- CLI binary name `starsos` (Tier 3 Locked) — see [ADR-005](005-naming-and-paths.md)
- Storage root `~/.starsos/` (Tier 3 Locked) — see [ADR-005](005-naming-and-paths.md)
- Migration tool input format (StarsHub data layout in `~/.stars/`) is read-only and may be supported indefinitely; if StarsHub structure changes externally, migration adapts on-demand

## References

- [STABILITY.md](../../STABILITY.md) — the four-tier model
- [ADR-005](005-naming-and-paths.md) — naming and storage paths
- StarsHub internal docs at `077-StarsHub/CLAUDE.md` (not public)
- StarsHub repo: `github.com/gbechtold/stars-hub` (private)
