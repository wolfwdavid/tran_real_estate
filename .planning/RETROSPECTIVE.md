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

## Milestone: v1.1 — Launch & Hardening

**Shipped:** 2026-11-20
**Phases:** 6 (12-17) | **Plans:** 72 | **Tasks:** 143 | **Commits:** 332 | **Calendar:** 22 days (2026-10-29 → 2026-11-20)

### What Was Built
- The live site at `https://wolfwdavid.github.io/tran_real_estate/`, with CI, deploy and a read-only live smoke chained behind every push to `main`.
- Nine carried-debt fixes, serial test lanes with a mechanical guard against unannotated timeouts and retries, and the move to pnpm 12, SvelteKit 3.1 and Vitest 5.
- The `ext-v0.1.0` GitHub Release from a hardened release workflow, with checksums and a changelog.

### What Worked
- **One tool per plan with a full gate and a live smoke after each push** (Phase 16). Every toolchain step was provable on its own, and the Kit 3 service-worker change was observed on the live origin.
- **Measuring before fixing.** The Pages dotfile behaviour, the first-deploy facts and the live Zillow DOM were read live before the code that depends on them.
- **One owner ledger** (`.planning/HUMAN-UAT.md`) with a text oracle in place of twelve per-phase files; every status change is checked by a test.
- **Approval dialogs for owner gates** (tag, publish, push). Each was answered in one step.

### What Was Inefficient
- **The JS budget ran at near-zero headroom through the Kit 3 migration** and still does (0.06 KB), so the weekly Dependabot PR fails CI. The budget oracle also undercounts under Kit 3.
- **Scope changed after the work was done.** The Edge listing assets, capture spec and tests were built in Phase 17 and then the store submission was cut; the records needed a second pass to match.
- **Stale wording after decisions.** The origin change (org to personal account) and the store cut each left old text in ROADMAP, PROJECT and REQUIREMENTS that a verifier had to find.
- **The extension would not run in the owner's Chrome window driven by the browser tools**, cause never found; the live check moved to a clean Chromium, where a Zillow bot check then stopped the reveal-click step.
- **SUMMARY frontmatter does not list all completed requirements**, so the three-source cross-check at the audit fell back to the phase verifications.

### Patterns Established
- `scripts/smoke.mjs` with a fail-closed env gate, zero retries and an exit-2 precondition path; the same specs run local and live.
- `tooling/vitest/lanes.ts` as the lane manifest, with a repo-wide guard test.
- Release workflow: dispatch dry-run, draft release, owner publishes; tag created on the pushed commit by SHA.
- Every push, tag push and publish is approved by the owner each time, and the run links are recorded in the plan summary.

### Key Lessons
1. Keep real headroom on a hard budget before a framework major, and check that the oracle counts what the framework ships.
2. When the owner changes scope, grep every planning file for the old wording in the same change.
3. Confirm an owner decision that removes scope (a store listing) before building its assets.
4. For a live third-party check, have a clean-browser fallback ready and stop at a bot check.
5. Fill `requirements-completed` in each SUMMARY as the plan closes; the audit depends on it.

### Cost Observations
- Model mix: not recorded for this milestone.
- Sessions: not counted; Phase 17 and the audit ran in one long session with several context compactions.
- Notable: multi-agent orchestration was turned off by the owner part-way through Phase 17; single agents (verifier, integration checker) were enough.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~12 | 11 | Wave-parallel executors with contracts-first wave 1; evidence-derived launch audit; audit exceptions module |
| v1.1 | not counted | 6 | Live smoke after every deploy; one tool per plan with a gate and a push; one owner UAT ledger; owner approval dialog for every push, tag and publish |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 6,647 unit + 2,327 E2E + 261 extension | not measured (oracles + axe per route instead) | assert-csp, assert-seo, assert-budget, assert-extension, serve-pages, guard-real-data, launch-audit, audit-evidence |
| v1.1 | totals not re-counted at close (last full gate: Phase 16 plan 13; scripts project 1,258 and extension unit 242 on 2026-11-20) | not measured | smoke.mjs and the smoke specs, live-smoke gate, lane guard, origin-parity, release check scripts (version, ancestor, probe, notes, zip allowlist) |

### Top Lessons (Verified Across Milestones)

1. Verify the gate inputs (audit, memory, third-party DOM) before the long chain, not after it fails.
2. Instant reads of asynchronously-set state are the dominant source of "flaky" E2E failures; poll them.
