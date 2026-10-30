---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 20
subsystem: testing
tags: [vitest, fixtures, site-origin, github-pages, d-03]

# Dependency graph
requires:
  - phase: 13-02
    provides: "DEFAULT_SITE_ORIGIN = https://wolfwdavid.github.io in apps/web/src/lib/site-config.js (two smoke.test.ts assertions read it through localTargets)"
provides:
  - "The eleven fixture-only test files use https://wolfwdavid.github.io; no test pins the dead tranrealestate.github.io org origin"
  - "Repo-wide greps for tranrealestate (13-10 Task 1 sweep) are no longer polluted by test fixtures"
affects: [13-10, live-smoke, seo, analytics, leads]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Origin substitution in tests is literal-for-literal; regex escapes are preserved (tranrealestate\\.github\\.io -> wolfwdavid\\.github\\.io)"

key-files:
  created: []
  modified:
    - apps/web/src/lib/analytics/beacon.test.ts
    - apps/web/src/lib/analytics/boot.test.ts
    - apps/web/src/lib/analytics/payload.test.ts
    - apps/web/src/lib/features/agent/profile/share-link.test.ts
    - apps/web/src/lib/leads/inquiry-url.test.ts
    - apps/web/src/lib/seo/jsonld.test.ts
    - apps/web/src/lib/seo/sitemap.test.ts
    - scripts/assert-seo.test.ts
    - scripts/service-worker-guard.test.ts
    - scripts/smoke-env.test.ts
    - scripts/smoke.test.ts

key-decisions:
  - "13-20: scripts/smoke.test.ts lines 19/26 (localTargets root/sub siteUrl) are not fixtures: they assert DEFAULT_SITE_ORIGIN through resolveSiteOrigin, so they pass only once 13-02's site-config.js lands (same wave); substituted anyway because wolfwdavid.github.io is the correct end state"
  - "13-20: LIVE-03 left unchecked (fixture half only); the live routing-contract plans close it"

patterns-established: []

requirements-completed: []

# Metrics
duration: 5min
completed: 2026-10-30
---

# Phase 13 Plan 20: Fixture-only origin substitution Summary

**All 26 `tranrealestate.github.io` literals in the eleven fixture test files now read `wolfwdavid.github.io` (regex escaping kept), with every file green and Prettier-clean; the two `smoke.test.ts` default-origin assertions depend on 13-02's `DEFAULT_SITE_ORIGIN`, not on fixtures.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-30T11:37:14Z
- **Completed:** 2026-10-30T11:42:00Z
- **Tasks:** 1
- **Files modified:** 11

## Accomplishments

- Replaced every `tranrealestate.github.io` with `wolfwdavid.github.io` in exactly the eleven files the plan names: 26 lines changed (26 insertions, 26 deletions), matching the 26 `git grep` hits one-for-one. No other text changed; ASCII/UTF-8 encodings and line endings untouched.
- The version-poll regex at `scripts/smoke.test.ts:142` keeps its escaping: `/^https:\/\/wolfwdavid\.github\.io\/_app\/version\.json\?_=\S+/`.
- `grep -c tranrealestate` prints 0 for every one of the eleven files.
- Targeted Vitest: the seven `apps/web` files pass (7 files, 89 tests); the four `scripts` project files pass (4 files, 83 tests). `pnpm exec prettier --check` on the eleven files exits 0.
- Files owned by other plans (site-config.*, site.ts, site.test.ts, scripts/site-url.test.ts, apps/extension/**, docs/*, deploy-checklist/extension-docs/launch-audit/workflow-gate tests, CLAUDE.md) were not touched.

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Substitute the old origin in the eleven fixture files | 6f579f7 | the eleven test files listed in key-files |

## Deviations from Plan

### Discovered, no code deviation

**1. [Finding] Two `smoke.test.ts` literals are coupled to 13-02, not fixture-only**

- **Found during:** Task 1 (first targeted run of the scripts project)
- **Issue:** `scripts/smoke.test.ts` lines 19 and 26 (`localTargets({})` root and sub `siteUrl`) failed after the substitution because `scripts/smoke.mjs:55` derives `siteUrl` from `resolveSiteOrigin()` -> `DEFAULT_SITE_ORIGIN`, which was still `https://tranrealestate.github.io` on disk at that moment. Research (13-RESEARCH.md "Fixture-only") listed only the `:142` regex for this file; the plan's claim "they pass with either string" does not hold for these two lines.
- **Resolution:** Kept the substitution (the plan's acceptance criterion requires zero `tranrealestate` hits, and 13-02 sets `DEFAULT_SITE_ORIGIN = 'https://wolfwdavid.github.io'`, so `wolfwdavid` is the only correct end state). Re-ran once 13-02's `site-config.js` edit was on disk in the shared working tree: 4 files, 83 tests pass. No file outside the eleven was edited.
- **Follow-up:** none required beyond 13-02 landing in the same wave. If 13-02 were ever reverted, `smoke.test.ts > localTargets > defaults` would be the first test to flag it, which is the intended guard.

### Auto-fixed Issues

None.

## Verification

- `git grep -n tranrealestate -- <eleven files>` -> no output.
- `pnpm vitest run <seven apps/web files>` -> 7 passed, 89 tests.
- `pnpm vitest run --project scripts scripts/assert-seo.test.ts scripts/service-worker-guard.test.ts scripts/smoke-env.test.ts scripts/smoke.test.ts` -> 4 passed, 83 tests (with 13-02's `DEFAULT_SITE_ORIGIN` on disk).
- `pnpm exec prettier --check <eleven files>` -> "All matched files use Prettier code style!".
- `git log -1 --format=%B | grep -ciE "co-authored-by|claude|anthropic"` -> 0.
- Full `pnpm lint` / `pnpm test:unit` deliberately not run here (shared wave-1 working tree); the orchestrator runs them once after the wave.

## Requirements

`LIVE-03` (live deploy and routing contract) is referenced by this plan but is not completed by a fixture substitution; it stays unchecked for the live-deploy plans to close.

## Known Stubs

None.

## Self-Check: PASSED

- 13-20-SUMMARY.md exists
- Commit 6f579f7 exists
- All eleven modified files exist and contain no tranrealestate literal
