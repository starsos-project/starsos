# ADR-004 — Monorepo with pnpm workspaces

- **Status**: Accepted
- **Date**: 2026-05-15
- **Deciders**: @gbechtold
- **Tags**: structure, tooling, stability-tier

## Context

Stars OS will ship multiple packages from day one (`@starsos/cli`, `@starsos/sdk`) and add more over time (`@starsos/adapter-moco`, `@starsos/adapter-clickup`, future `@starsos/core`, `@starsos/web`, etc.). These packages share types, lint config, build pipeline, and release cadence.

We need to decide: single repo (monorepo) with workspaces, or multiple separate repos (polyrepo).

## Options considered

### Option A — Single repository, no workspaces

One repo, one package.

- Pros: Simplest possible setup.
- Cons: Doesn't scale beyond ~1 package. We already need 2.

### Option B — Monorepo with pnpm workspaces

Single repo, multiple packages under `packages/*`, managed via pnpm workspaces.

- Pros: Atomic cross-package changes. Shared tooling. Easy local development (`pnpm install` links workspace packages automatically). Industry standard for projects with multiple related packages (Astro, Vite, Cal.com, Next.js).
- Cons: Slightly more setup. Requires pnpm (not npm) for the workflow to be ergonomic.

### Option C — Monorepo with Turborepo or Nx

Same as B but with a higher-level orchestration tool.

- Pros: Faster builds via caching. Better task pipeline declaration.
- Cons: More complexity than we need for v0.1. We can adopt later if build times become a problem.

### Option D — Polyrepo (separate repos per package)

Each package in its own GitHub repo.

- Pros: Independent versioning. Each repo has clean issue tracking.
- Cons: Cross-package changes require multiple PRs. Tooling has to be replicated. Discoverability suffers (where is the adapter SDK?). Standard practice has shifted toward monorepos for related package families.

## Decision

We chose **Option B — Monorepo with pnpm workspaces**.

**Rationale**: pnpm workspaces give us all the benefits of monorepo (atomic changes, shared tooling, easy linking) without the overhead of Turborepo/Nx at this stage. We can graduate to Turborepo later if build performance demands it. Polyrepo would create real friction for an evolving SDK + adapter ecosystem where breaking changes to the SDK must land alongside adapter updates.

## Consequences

### Positive

- All Stars OS packages versioned and changeloged in one place
- Contributors clone one repo and have everything available
- Cross-package refactors are atomic (single PR)
- Shared `tsconfig.base.json`, `biome.json`, `tsup.config` reduce duplication
- Adapter authoring is easier when contributors can browse the SDK source alongside example adapters

### Negative

- Repository will grow over time as packages accumulate
- Release tooling needs to handle per-package versions (we'll use Changesets for this in v0.2+)
- New contributors must learn pnpm if they only know npm or yarn

### Neutral

- Storage structure becomes Tier 2 Stable for top-level paths (`packages/`, `apps/`, `docs/`) — see [STABILITY.md](../../STABILITY.md)

## Migration / rollout

### For initial setup

```
106-StarsOS/
├── package.json              (root, private, workspace declaration)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── biome.json
├── packages/
│   ├── cli/                  @starsos/cli — the user-facing CLI
│   ├── sdk/                  @starsos/sdk — adapter authoring + helpers
│   ├── adapter-moco/         @starsos/adapter-moco
│   └── adapter-clickup/      @starsos/adapter-clickup
└── apps/
    ├── docs/                 Mintlify-hosted docs site
    └── web/                  Astro landing page
```

### Versioning strategy

- v0.1.0 — all packages share the major version
- v0.2.0+ — packages may diverge; we'll adopt [Changesets](https://github.com/changesets/changesets) for managed releases

### Future: when to consider Turborepo

If `pnpm test` across all packages exceeds 60 seconds in CI, or if developers report long local rebuild times, we revisit and likely adopt Turborepo for task caching. Until then, plain pnpm is fine.

## References

- [pnpm workspaces docs](https://pnpm.io/workspaces)
- [STABILITY.md](../../STABILITY.md)
- Prior art: Astro, Vite, Cal.com, Next.js, Resend all use monorepos with workspaces
