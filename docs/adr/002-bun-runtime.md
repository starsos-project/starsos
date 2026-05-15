# ADR-002 — Bun as primary runtime

- **Status**: Accepted
- **Date**: 2026-05-15
- **Deciders**: @gbechtold
- **Tags**: runtime, dependencies, stability-tier

## Context

Stars OS is CLI-first and ships to operators who run it locally. Choice of runtime affects install friction, native-module compatibility, batteries-included features, and long-term maintenance cost.

Three serious options exist as of 2026: Node.js (mature, ubiquitous), Bun (fast, batteries-included, growing), Deno (secure-by-default, niche). The chosen runtime constrains the rest of the stack (which SQLite binding, which test runner, which package layout).

## Options considered

### Option A — Node.js 22 LTS

The default. Maximum compatibility, every CI has it, every developer has it.

- Pros: Ubiquity. Every JS dependency works. LTS guarantees through 2027. `better-sqlite3` is mature, `vitest` is the test gold standard.
- Cons: Slow startup. Native modules (better-sqlite3) require build toolchain at install. Need a third-party test runner and bundler. More config files.

### Option B — Bun 1.x

The newer runtime. Single binary, fast, includes `bun:sqlite`, `bun:test`, and a bundler.

- Pros: Single binary install. `bun:sqlite` requires no native build. `bun:test` is fast and Jest-compatible. Bundler built in. CLI startup is noticeably faster than Node. Excellent TypeScript handling.
- Cons: Younger than Node. Some Node-only ecosystem libraries don't run. Some edge-case bugs still surface (improving fast). Reliance on a single vendor (Oven).

### Option C — Deno

Secure-by-default, web-standards-oriented.

- Pros: Security model. URL imports. Strong standard library.
- Cons: Smaller ecosystem. Less momentum than Bun. Worse package.json compat.

## Decision

We chose **Option B — Bun 1.x**.

**Rationale**: For a CLI tool whose distribution model is `bun install -g @starsos/cli` (or curl-pipe-shell that installs Bun first), the lack of native-build steps is a major UX win. `bun:sqlite` removes the most fragile install dependency that Node + better-sqlite3 imposes. Built-in test runner and bundler reduce config sprawl. The performance gain at CLI startup is user-visible.

Node compatibility is **planned as an explicit Tier 1 / Tier 0 promotion path** for v1.0 — when Stars OS is more stable, we'll evaluate whether to add Node support, likely via a thin compatibility shim. For now, Node users can run `bunx @starsos/cli` after a one-time `npm install -g bun`.

## Consequences

### Positive

- Faster install: one binary, no native build
- Faster CLI startup
- Smaller config surface (no separate `vitest.config.ts`, `jest.config.js`, `tsup` is the only bundler config)
- Excellent TypeScript ergonomics
- `bun:sqlite` is rock-solid for our use case

### Negative

- Bun-only audience for v0.1. Some users will need to install Bun first.
- Less broad community support if obscure issues arise
- We're betting on Oven's continued maintenance of Bun (mitigated: Bun is open source, AGPL-friendly, and large enough to fork if needed)

### Neutral

- Test framework is `bun:test`, not Vitest. The API is similar enough that contributors familiar with Jest/Vitest can pick it up quickly.
- We use `tsup` for the final distributable bundle, even though Bun has its own bundler — `tsup` produces broadly-compatible output we can later publish to npm for non-Bun users.

## Migration / rollout

### Tier commitments

- "Bun as primary runtime" is **Tier 1 Provisional** — not Tier 2 stable. We may add Node support without it being a breaking change; we may also drop a hypothetical future runtime without a major bump.
- Node compatibility, when added, will be **Tier 2 Stable** with explicit support window.

### For users

- Install Bun: `curl -fsSL https://bun.sh/install | bash`
- Install Stars OS: `bun install -g @starsos/cli`
- Or one-shot: `bunx @starsos/cli`

### For contributors

- `bun install` to set up deps
- `bun test` to run tests
- `bun run build` to bundle
- See `CONTRIBUTING.md` for the full development setup

## References

- [Bun documentation](https://bun.sh/docs)
- [STABILITY.md](../../STABILITY.md) — runtime is Tier 1
- [ADR-001](001-absorb-starshub.md) — StarsHub uses Node.js; migration tool runs under Bun and reads `~/.stars/` cross-runtime via plain JSON
