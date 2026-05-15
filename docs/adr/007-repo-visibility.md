# ADR-007 — Repository visibility: private until W4, then public in silent mode

- **Status**: Accepted
- **Date**: 2026-05-15
- **Deciders**: @gbechtold
- **Tags**: process, marketing, release-strategy

## Context

The initial plan envisioned a public repo from day 1, with build-in-public being the primary launch tactic. After review, this conflicts with the operator's stated mode ("Pragmatiker — Tool für mich, OSS als Nebeneffekt") and the disciplined approach of validating the wedge with real use before inviting attention.

We need a clear rule for when the repo becomes public, what marketing happens at that moment, and how the launch event (Show HN, multiplier outreach) is decoupled from the technical milestone.

## Options considered

### Option A — Public from day 1, no marketing

Repo is public from M0 onward. README states "pre-alpha, no code". Maintainer commits in the open.

- Pros: Build-in-public credibility. SEO from day 1.
- Cons: Promises before delivery. First impression is a project that doesn't work yet.

### Option B — Private until v0.1 ready, then public as launch event

Repo stays private through W4. End of W4: gh repo create --public, GitHub release, Show HN same day, Product Hunt, Twitter thread, newsletter outreach.

- Pros: First impression is a working tool. Marketing momentum concentrated.
- Cons: Conflates "code ready" with "marketing ready". Pressures both.

### Option C — Private until W4, public in silent mode, marketing later

Repo is private through W4. End of W4: gh repo create --public, tag v0.1.0-alpha.1, one tweet stating "repo is public, this is what I built for myself". No Show HN, no outreach, no Product Hunt. Marketing waits for wedge validation (W9–W10).

- Pros: Decouples code-readiness from marketing-readiness. Allows weeks of low-stakes public iteration before launch. Reduces launch-day pressure on a single moment.
- Cons: Less aggressive growth in the first weeks. Some "What's this?" curiosity wasted because no outreach amplifies it.

## Decision

We chose **Option C**.

The repo becomes public at end of W4 (target 2026-06-12). At that moment:
- `gh repo create starsos-project/starsos --public`
- Tag `v0.1.0-alpha.1`
- npm publish under `@alpha` distribution tag
- One Twitter/X post: "Stars OS is now public. Pre-alpha — I built it for myself. AGPL-3. https://github.com/starsos-project/starsos"
- Update `00-decisions.md` row D-13 from "Locked" to "Locked — executed YYYY-MM-DD"

The Show HN trigger is decoupled and conditional, defined in [02-roadmap.md](../../strategy/02-roadmap.md) W10+.

## Consequences

### Positive

- W1–W4 development is unobserved — no pressure from drive-by issues or social-media attention
- Public moment in W4 is low-stakes — if something is broken, the maintainer fixes it without launching-week reputation damage
- W5–W8 ("dogfood-heavy phase") happens in the open but quietly. Anyone curious can read commits and form their own opinion
- Show HN, when it happens, is backed by 6+ weeks of public commits and the maintainer's own daily-use evidence

### Negative

- No SEO / star compounding during W1–W4
- Loss of theoretical "I'm building Stars OS"-tweet engagement potential
- First-mover advantage in the "operator OS" space partly forfeit if competitor launches first

### Neutral

- Build-in-public still happens — just starting at W5 instead of W1
- Twitter narrative shifts from "watch me build" to "I built this; here's what's next"

## Migration / rollout

### Implementation

Until end of W4:
- `gh repo create starsos-project/starsos --private` (or via web UI)
- Maintainer pushes freely; no review needed for solo work but conventional commits + PR for personal hygiene
- GitHub Actions CI runs on private repo (counts against free-tier minutes — acceptable)
- `npm publish --dry-run` periodically to verify package layout, no real publish

At end of W4:
- `gh repo edit starsos-project/starsos --visibility public`
- Topics, description, homepage URL set on repo
- Issues / Discussions enabled
- `npm publish --tag alpha` for the four packages
- Single tweet, no thread
- Pin repo on org page

After end of W4 through W9:
- All commits are public
- Maintainer responds to drive-by issues but does not promote
- No newsletter pitches, no Product Hunt, no Show HN

W10+: see [02-roadmap.md](../../strategy/02-roadmap.md) Show HN section.

## References

- [00-decisions.md](../../strategy/00-decisions.md) row D-13
- [02-roadmap.md](../../strategy/02-roadmap.md) W4 push, W10+ Show HN section
- Inspiration: how Pieter Levels launched Photo AI (public when ready, marketing when stable) vs. how many OSS projects launch loudly and immediately
