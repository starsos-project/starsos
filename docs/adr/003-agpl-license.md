# ADR-003 — AGPL-3 license choice

- **Status**: Accepted
- **Date**: 2026-05-15
- **Deciders**: @gbechtold
- **Tags**: license, business-model, stability-tier

## Context

Open-source licensing is the highest-leverage decision in an OSS project's lifecycle. Once chosen and shipped with contributions, it is effectively permanent — you cannot relicense without consent from every contributor. The choice signals what kind of project this is and constrains the business model.

Three license families are relevant for a developer-tool project in 2026:

1. **Permissive** (MIT, Apache-2): maximum reach, no obligations on downstream users, but allows commercial forks (AWS-style "managed Stars OS" without giving back).
2. **Weak copyleft** (LGPL, MPL): file-level copyleft, derivative works can stay proprietary.
3. **Strong copyleft / network copyleft** (GPL-3, AGPL-3): full copyleft including network use (AGPL only).

## Options considered

### Option A — MIT or Apache-2

Maximum permissive license. Anyone can use, modify, distribute, sublicense.

- Pros: Maximum adoption. No friction for enterprise. No need to think about license compliance.
- Cons: AWS-style commercial forks are explicitly allowed. A hyperscaler could ship "Managed Stars OS" without contributing anything back. We'd be competing with our own code, with their distribution.

### Option B — Elastic License v2 / BSL (Business Source License)

Source-available with explicit commercial-fork prohibition. Used by Sentry, HashiCorp, MongoDB.

- Pros: Explicit protection from cloud commercial-forks. Source remains visible.
- Cons: **Not an OSI-approved open-source license.** Some operators (especially in DACH government and enterprise) will not adopt non-OSI-approved licenses. Damages credibility of "open source" claim.

### Option C — AGPL-3

Strong copyleft with network clause. Anyone who modifies and offers Stars OS over a network must release their changes.

- Pros: OSI-approved (real open source). Protects against AWS-style forks because they must open-source their modifications. Same license as Paperclip (`paperclipai/paperclip`), which is a direct inspiration. Compatible with our commercial Pro tier on `starsos.dev` (we author the code and license it dual).
- Cons: Some enterprises avoid AGPL for fear of obligations on internal modifications (largely unfounded, but real). Slightly smaller adoption ceiling than MIT.

### Option D — Dual license (AGPL + commercial)

Same as Option C, but with a paid commercial license available for those who can't comply with AGPL.

- Pros: All of C's benefits plus a revenue path for enterprise.
- Cons: More legal complexity at v0.1. Better evaluated at v1.0 when we have real commercial inquiries.

## Decision

We chose **Option C — AGPL-3** for the core, with the explicit intent to add a commercial license option in the future if and when demand warrants it (effectively transitioning toward Option D).

**Rationale**: AGPL-3 strikes the right balance for this project. It signals "real open source" (OSI-approved), it matches our role-model Paperclip in both spirit and legal structure, and it protects us from hyperscaler-style commercial forks while leaving the door open for legitimate enterprise relationships through future commercial licensing. The Pro tier on `starsos.dev` will be a separately licensed commercial offering built on top of the AGPL core.

## Consequences

### Positive

- "Real open source" credibility (OSI-approved)
- Cloud providers cannot fork-and-host without contributing back
- Direct alignment with Paperclip's stance (matters for the launch narrative)
- Compatible with commercial Pro tier (we're the copyright holder, we can dual-license)

### Negative

- Some enterprise teams will hesitate (often based on misunderstanding of AGPL)
- Smaller potential adoption ceiling than MIT
- Requires CLA (Contributor License Agreement) or DCO (Developer Certificate of Origin) if we ever want to relicense or dual-license third-party contributions — see Migration section

### Neutral

- Adapters can be authored under permissive licenses by third parties — AGPL doesn't infect adapter packages that aren't redistributed by us
- The license decision is **Tier 3 Locked**. Changing it would require contributor consent and is effectively never going to happen for the core

## Migration / rollout

### Contributor License framework

We require a **CLA** (Contributor License Agreement) for all contributors from W1 onward. The CLA assigns the contributor a perpetual right to keep using their contribution, and grants Stars OS the right to relicense the project in the future (e.g. to a dual-licensed model when a Pro-tier business case materializes).

Implementation in W1 Tag 4:
- `CLA.md` in repo root describing the agreement
- GitHub Action (e.g. `contributor-assistant/github-action`) that requires PR contributors to sign before merge
- Maintainer (Guntram) is exempt as copyright holder

Rationale for CLA over DCO: DCO is lighter but does not permit relicensing without contacting every contributor for re-signing. The CLA is the durable choice given Stars OS will likely move to dual-license (AGPL + commercial) once the Pro tier launches.

Reference: [00-decisions.md](../../strategy/00-decisions.md) row D-06.

### Where AGPL applies

- All code in `packages/cli/`, `packages/core/`, `packages/sdk/` — AGPL-3
- First-party adapters under `packages/adapter-*/` — AGPL-3
- Documentation: CC BY-SA 4.0 (compatible, allows reuse with attribution)
- Brand assets (logos): CC BY-NC-ND 4.0 (more restrictive — don't impersonate the project)

### Where AGPL doesn't apply

- Third-party adapters published under their own license
- The Pro tier (`starsos.dev`) — separately licensed commercial software, may incorporate AGPL core under the dual-license model we'll author when needed

## References

- [STABILITY.md](../../STABILITY.md) — license is Tier 3 Locked
- [GNU AGPL-3 text](https://www.gnu.org/licenses/agpl-3.0.txt)
- [Paperclip license](https://github.com/paperclipai/paperclip/blob/main/LICENSE) — direct inspiration (Paperclip is MIT-licensed; Stars OS chose AGPL despite this, see Option C above)
- [contributor-assistant CLA Bot](https://github.com/contributor-assistant/github-action)
