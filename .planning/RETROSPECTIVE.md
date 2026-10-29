# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-10-29
**Phases:** 11 | **Plans:** 209 | **Tasks:** 475 | **Commits:** 1,206 | **Calendar:** 47 days (2026-09-13 → 2026-10-29), with owner pauses on 09-23, 10-05, 10-07 and 10-14

### What Was Built
- A $0, browser-only SvelteKit static site with three portals (renter, investor, agent), a per-tab key vault, a budget-guarded RentCast gateway, four BYOK LLM providers behind one generation panel with a Fair Housing gate, and a launch surface (onboarding, waitlist, SEO tools, first-party analytics).
- A hide-only Zillow sponsored-listing MV3 extension with a zero-network proof at the source, bundle and runtime layers, plus a gated release pipeline.
- ~165k lines across apps/web, apps/extension, packages/core, packages/brand and scripts; 6,647 unit tests; 2,327 E2E tests with axe on every route; mutation-tested oracles for CSP, SEO, budget, supply chain and the extension.

### What Worked
- **Wave-parallel executors with one plan each** (up to six at once in Phase 11) with the lockfile and contracts landed in wave 1, so no later agent touched package.json. Phase 11's 12 plans executed in about 2.5 hours of wall clock.
- **Goal-backward verification per phase** (gsd-verifier + Nyquist validation maps). Two phases (8, 9) caught real gaps before completion instead of at the milestone audit.
- **Oracles over assertions:** every launch-audit row derives from test evidence; mutation tests on the oracles caught silently-green checks three times (Phase 10 and 11-06, 11-11).
- **Live third-party check before building against it:** a ten-minute read-only pass over zillow.com before the detector plan changed the primary signal from label text (zero live hits) to ad-slot list items.

### What Was Inefficient
- **Machine memory, not code, set the pace of the final close-out.** The composed `pnpm verify` was killed twice by the host's low-memory reaper (Chrome holding 7-10 GB); the chain had to be run stage by stage with Playwright at three workers (about 50 minutes per full pass).
- **Load-sensitive tests recurred across phases** (03, 08, 10, 11 close-out) and each time cost a diagnosis round. Most were real races or instant reads of async flags; the pre-commit suite's setup failure was pure starvation.
- **Dependency advisories moved between phases.** Twelve advisories against unchanged pins appeared in the nine days between the Phase 10 and Phase 11 gates and broke `audit:deps` at the worst moment (close-out).
- **Executor commit trailers.** Two wave-2 agents added a model co-author trailer despite the project rule, forcing a `filter-branch` rewrite and a hash remap in six summaries.
- **PROJECT.md drifted** (Phase 10 was never folded in until Phase 11 closed) because the per-phase evolve step was skipped once.

### Patterns Established
- `scripts/lib/audit-exceptions.mjs` + `pnpm-workspace.yaml audit.ignore` kept equal by a test; an exception needs a shipped-output grep and a revisit date.
- Evidence shards (`pnpm evidence:e2e|unit|merge`) feed the generated launch audit; never edit `docs/LAUNCH-AUDIT.md` by hand.
- Every executor prompt carries: no `git add -A`, no package.json/lockfile edits after wave 1, no commit trailers, `--no-verify` only in parallel waves with a post-wave hook run.
- Extension zero-network proof in three layers: ESLint ban on network primitives, production manifest/bundle/zip oracle with a planted-violation control, and a Playwright session recorder with page and worker controls.

### Key Lessons
1. Run `corepack pnpm audit` first in any close-out or resume; it is a moving target and the long chain stops on it.
2. An instant `expect(flag).toBe(true)` on anything set by an intercepted request is a race under load; use `expect.poll`, keep instant reads for "must never have happened" assertions.
3. Before a composed verify on this machine, check free memory and the Chrome footprint; cap Playwright workers rather than retrying the full-parallel run.
4. Re-check third-party DOM research live before the plan that depends on it runs.
5. Strip model trailers per wave and before any push; remap summary hashes by commit subject, not by hash.

### Cost Observations
- Model mix (Phase 11, the only phase run end to end in one session): executors on Opus (12 plans, roughly 100-140k tokens each), verifier and integration checker on Sonnet. Earlier phases ran on the project's `quality` profile.
- Sessions: about a dozen across the milestone, with four owner-initiated pauses and handoffs (`HANDOFF-2026-10-05.md`, `HANDOFF-2026-10-07.md`, `PAUSE-2026-09-23.md`).
- Notable: the single largest avoidable cost was re-running the 22-minute E2E suite three times at close-out (one real failure, one memory kill, one evidence run with the JSON reporter). Producing the JSON evidence on the first green run would have saved one pass.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~12 | 11 | Wave-parallel executors with contracts-first wave 1; evidence-derived launch audit; audit exceptions module |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 6,647 unit + 2,327 E2E + 261 extension | not measured (oracles + axe per route instead) | assert-csp, assert-seo, assert-budget, assert-extension, serve-pages, guard-real-data, launch-audit, audit-evidence |

### Top Lessons (Verified Across Milestones)

1. Verify the gate inputs (audit, memory, third-party DOM) before the long chain, not after it fails.
2. Instant reads of asynchronously-set state are the dominant source of "flaky" E2E failures; poll them.
