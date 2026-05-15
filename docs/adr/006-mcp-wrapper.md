# ADR-006 — MCP-wrapper strategy (no custom adapter SDK)

- **Status**: Accepted
- **Date**: 2026-05-15
- **Deciders**: @gbechtold
- **Tags**: architecture, dependencies, anti-scope, supersedes-04-monorepo-partially

## Context

The previous plan ([strategy/archive/2026-05-15/06-mvp-sprint-b-full.md](../../strategy/archive/2026-05-15/06-mvp-sprint-b-full.md)) included a custom adapter SDK: `@starsos/sdk` with a `defineAdapter()` function, a manifest format, capability schemas, and an authoring guide for third parties.

Since that plan was written, Anthropic's MCP (Model Context Protocol) has matured into the de-facto standard for LLM tool integration. Tens of MCP servers exist in the wild, the protocol is documented and stable, and the SDK (`@modelcontextprotocol/sdk`) is production-grade.

Building our own adapter SDK in parallel would mean:
- Re-inventing capability declaration
- Maintaining a registry separate from npm
- Convincing third parties to learn `@starsos/sdk` instead of MCP they already know
- Splitting the AI-tools ecosystem rather than joining it

## Options considered

### Option A — Build `@starsos/sdk` with custom manifest

Original plan. Stars OS as platform, adapters as packages following our convention.

- Pros: Full control over capability schema, naming, lifecycle hooks
- Cons: Duplicate effort vs MCP; no ecosystem leverage; third parties unlikely to learn yet-another-SDK

### Option B — MCP-wrapper: Stars OS is an MCP client, every "adapter" is a standard MCP server

Stars OS uses `@modelcontextprotocol/sdk` as an MCP client. Adapters live in `packages/mcp-server-*/` as standard MCP servers that any MCP-compatible tool (including Claude Desktop, Cursor, Continue.dev) can also use.

- Pros: Joins existing ecosystem. Stars OS adapters become useful outside Stars OS. Less code to maintain. Third parties don't need to learn anything new.
- Cons: MCP protocol features not invented here. We accept MCP's pace of change as constraint. Some Stars OS-specific UX (e.g. session-aware capability invocation) needs to be added on top of plain MCP.

### Option C — Hybrid: MCP for external tools, custom SDK for Stars-OS-specific extensions

Use MCP for adapters but layer a custom SDK on top for "deep integrations" (e.g. session lifecycle hooks).

- Pros: Best of both
- Cons: Most complex. Confusing for contributors. Premature — we haven't seen what "deep integrations" need yet.

## Decision

We chose **Option B**.

`@starsos/sdk` is removed from the v0.1 surface. Adapters are standard MCP servers in `packages/mcp-server-<name>/`. Stars OS's internal `packages/cli/src/mcp/` module is a client of the MCP protocol, not a platform.

## Consequences

### Positive

- Significantly less code to ship in v0.1 (the SDK module is gone, plus its tests, plus its docs)
- Stars OS adapters are immediately useful in Claude Desktop, Cursor, and other MCP clients — multi-purpose tooling
- Operators authoring an MCP server for their own tools get value beyond Stars OS
- The MCP ecosystem brings discoverability we couldn't build alone (MCP server registry, community)

### Negative

- We can't enforce Stars-OS-specific conventions across adapters (e.g. session-aware logging) until we add a thin Stars-OS layer on top of MCP — and that addition would itself be Tier 1 Provisional
- MCP protocol evolution dictates our update cadence
- Some operations that fit naturally in a custom SDK (e.g. "subscribe to session-end events") have no MCP equivalent yet — we work around or add a thin extension protocol if/when needed

### Neutral

- Our adapter packages publish under `@starsos/mcp-server-*` on npm, joining the established `mcp-server-*` naming pattern
- We use the official `@modelcontextprotocol/sdk` as a runtime dependency

## Migration / rollout

### What gets removed from the public surface

- `@starsos/sdk` package (was Tier 2 Stable per STABILITY.md — now removed from the lookup table)
- `defineAdapter()` function signature
- Adapter manifest JSON Schema
- `@starsos/sdk/unstable` subpath export (no longer applicable)

### What gets added

- Dependency on `@modelcontextprotocol/sdk` in `packages/cli/`
- `packages/cli/src/mcp/client.ts` — Stars OS MCP-client integration
- `packages/cli/src/mcp/registry.ts` — installed MCP-server registry
- Commands: `starsos mcp install/list/call`
- First MCP server: `packages/mcp-server-paperclip/` (W3, see [04-paperclip-integration.md](../../strategy/04-paperclip-integration.md))

### Tier commitments

- MCP-client integration in `packages/cli/src/mcp/` is **Tier 1 Provisional** until v1.0. We may rev the MCP-SDK version with minor releases
- MCP-server packages (`@starsos/mcp-server-*`) are individually versioned. Stable when the underlying API they wrap is stable
- The decision to use MCP at all is **Tier 3 Locked**. Reverting to a custom SDK would require a new ADR superseding this one

## References

- [Model Context Protocol](https://modelcontextprotocol.io)
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)
- [STABILITY.md](../../STABILITY.md) — needs update: remove `@starsos/sdk` rows, add MCP entries
- [02-roadmap.md](../../strategy/02-roadmap.md) — W3 wedge ships first MCP server
- [04-paperclip-integration.md](../../strategy/04-paperclip-integration.md) — first concrete MCP-server target
