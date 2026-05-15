# ADR-005 — CLI name `starsos` and storage path `~/.starsos/`

- **Status**: Accepted
- **Date**: 2026-05-15
- **Deciders**: @gbechtold
- **Tags**: naming, storage, stability-tier, conflict-resolution

## Context

The CLI binary name and storage path are Tier 3 Locked once chosen — they are wire-format contracts to users and to the operator's existing filesystem state. They should be decided deliberately, and they cannot be changed without a major version migration tool.

A namespace conflict exists with StarsHub (see [ADR-001](001-absorb-starshub.md)):

- StarsHub installs a `stars` binary
- StarsHub stores data in `~/.stars/`

Stars OS must choose names that do not collide.

## Options considered

### Option A — CLI: `stars`, path: `~/.stars/`

Direct collision with StarsHub. Would require replacing StarsHub immediately, which is part of ADR-001's "Option D" that we rejected.

- Pros: Shortest possible name.
- Cons: Catastrophic during coexistence period.

### Option B — CLI: `starsos`, path: `~/.starsos/`

The straightforward distinct namespace.

- Pros: No collision. Clear identity. Matches `starsos.org` domain and `@starsos/*` npm scope.
- Cons: 4 extra characters to type compared to `stars`.

### Option C — CLI: `stars`, path: `~/.stars/os/` (subfolder)

Use the same CLI name (would require uninstalling StarsHub first) but share the storage root with a subfolder.

- Pros: Shorter CLI name.
- Cons: Forces StarsHub uninstall as prerequisite. Subfolder approach is awkward. Confuses migration.

### Option D — CLI: alternate brand (`knot`, `loom`, `spool`)

Pick a different name entirely.

- Pros: No conflict. Marketing-friendly Paperclip-style name.
- Cons: Conflicts with brand investment in `starsos.org`, `starsos.dev`, `@starsos/*` npm scope, `starsos-project` GitHub org — all already committed.

## Decision

We chose **Option B**.

- **CLI binary name**: `starsos`
- **Default storage path**: `~/.starsos/`
- **Override variable**: `$STARSOS_HOME` (for tests, dev, alt-installs)
- **npm scope**: `@starsos/`
- **GitHub org**: `starsos-project`
- **Primary domain**: `starsos.org` (OSS), `starsos.dev` (Pro)

All names align cleanly with the brand and don't collide with StarsHub.

## Consequences

### Positive

- Zero collision with StarsHub during indefinite coexistence
- Brand consistency across npm, GitHub, domain, CLI, storage path
- Users typing `starsos` will not accidentally trigger StarsHub
- Tab completion gives both `stars` and `starsos` distinct paths

### Negative

- `starsos` is 4 characters longer than `stars`. We expect users to alias it (`alias s='starsos'`) once it's their primary tool — and we'll document this.

### Neutral

- The four-letter alias `sos` was considered and rejected: too easy to confuse with `S.O.S.` distress signals, and conflicts with the `sos` npm package and several shell aliases in the wild
- A future major version (`v2.0+`) might offer an opt-in alternate name like `stars` once StarsHub is fully deprecated. This would be a non-breaking addition (both names work), with `starsos` always supported

## Migration / rollout

### Tier 3 Locked commitments

- `starsos` CLI name: never removed. Future versions may add aliases but `starsos` always works.
- `~/.starsos/` path: never removed. `$STARSOS_HOME` may override; multiple installs are not supported and not planned.
- `@starsos/` npm scope: never abandoned. Packages may be renamed within the scope (Tier 2 process), but the scope stays.

### For new users

Install creates `~/.starsos/` on first `starsos init`. No conflict possible because the path is new.

### For Guntram (maintainer)

`~/.stars/` (StarsHub) and `~/.starsos/` (Stars OS) coexist on the same machine without interfering. `starsos migrate-from-starshub` reads from one and writes to the other, copying data — never deleting source.

## References

- [STABILITY.md](../../STABILITY.md) — these are all Tier 3 Locked
- [ADR-001](001-absorb-starshub.md) — context for the conflict
- [GitHub org](https://github.com/starsos-project)
- Domains: `starsos.org`, `starsos.dev` (both registered 2026-05-15)
