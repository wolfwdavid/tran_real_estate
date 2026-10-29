---
phase: 12-go-live-readiness-local-smoke-suite
plan: 03
subsystem: build
tags: [sveltekit, version-json, service-worker, build-stamp, e2e, playwright]

# Dependency graph
requires:
  - phase: 12
    provides: "12-02 rewritten history (build dirs carried pre-rewrite timestamp stamps)"
provides:
  - resolveBuildStamp(env, readHead) (BUILD_SHA > GITHUB_SHA > git HEAD, 40-hex or a named build error)
  - kit.version.name = commit SHA, so <build>/_app/version.json and the SW cache key carry it
  - build-web.mjs resolves the stamp once, logs BUILD_SHA=<sha> and passes it to the Kit build
  - build-stamp.spec.ts on the root and sub Playwright projects (build dir, served file, cache key)
  - Three build dirs rebuilt at one commit (ad8fbe9...) with stamps proven equal
affects: [12-06/12-07 smoke (SMOKE_EXPECT_VERSION, stale-stamp precheck), 12-08..12-10 gates, 13 live smoke]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Build-time resolver in plain JS + JSDoc under src/lib (no node: imports), the side effect (git spawn) injected by the caller"
    - "Pin one stamp for a multi-target build with BUILD_SHA so parallel commits cannot split the three builds"

key-files:
  created:
    - apps/web/src/lib/build-stamp.js
    - apps/web/src/lib/build-stamp.test.ts
    - apps/web/tests/e2e/build-stamp.spec.ts
  modified:
    - apps/web/svelte.config.js
    - scripts/build-web.mjs

key-decisions:
  - "BUILD_SHA outranks GITHUB_SHA so build-web.mjs's single resolution is what Kit sees; empty strings mean unset (CI expands unset vars to '')"
  - "Upper-case, short, whitespace-padded and timestamp values all fail the build; no silent fallback to Kit's timestamp default"
  - "The E2E expected value is GITHUB_SHA || git HEAD, so a stale local build fails with 'stale build: rebuild with pnpm build:<project>'"

patterns-established:
  - "Any plan that runs E2E or the smoke rebuilds all three targets first: committing moves HEAD, so a build is stale one commit later"

requirements-completed: [LIVE-04]

# Metrics
duration: 9min
completed: 2026-10-29
---

# Phase 12 Plan 03: Build Stamp Summary

**Kit `version.name` is now the 40-hex commit SHA (BUILD_SHA from build-web.mjs, GITHUB_SHA in CI, git HEAD otherwise), so `/_app/version.json` and the `tran-shell-<sha>` cache key identify every deploy; unit and E2E tested on root and sub.**

## Performance

- **Duration:** about 9 min
- **Started:** 2026-10-29T19:30:11Z
- **Completed:** 2026-10-29T19:38:21Z
- **Tasks:** 2 (TDD; 4 commits)
- **Files modified:** 5

## Accomplishments

- `resolveBuildStamp` has 9 unit tests: precedence (git is never read when an env value is set), empty values count as unset, and five planted bad values (short, upper-case, leading space, empty HEAD, timestamp) are rejected with `/40-hex commit SHA/`.
- `svelte.config.js` sets `version: { name: resolveBuildStamp(process.env, readHead) }`. `svelte-kit sync`, `svelte-check` (`pnpm check`: 0 errors) and `service-worker-guard.test.ts` (10/10), which all load the config, still work through the git-HEAD fallback.
- `build-web.mjs` logs `BUILD_SHA=<sha>` and passes it to the Kit build. A malformed `BUILD_SHA=1792988474126` exits 2 with the named error before anything is built.
- Git-HEAD fallback build (BUILD_SHA and GITHUB_SHA unset) logged `BUILD_SHA=31991ff48a6d86662642d4e0dfa6ec432f161507`, which was HEAD at that moment, and wrote that value to `build/_app/version.json`.
- Pinned run `BUILT_AT=ad8fbe92e6c6cfd6efc696c1d8fe9327e53bcbeb`: `build`, `build-sub` and `build-configured` all carry it in `_app/version.json`. `csp:assert` (45 pages x 3), `seo:assert` and `budget:assert` passed.
- `GITHUB_SHA=$BUILT_AT playwright test build-stamp pwa routing --project=root --project=sub`: 32 passed. The plan's verify command (expected value read from the build) passed 8/8.
- RED was proven first. Against the pre-rewrite timestamp builds, 3 of the 4 build-stamp tests failed.

## Task Commits

1. **Task 1 RED: failing resolver test** - `bafe373` (test)
2. **Task 1 GREEN: resolver, Kit wiring, build-web BUILD_SHA** - `7345fb1` (feat)
3. **Task 2: E2E stamp spec** - `cc6051a` (test). RED and GREEN were run against the build dirs. The spec is the only committed file.

## Files Created/Modified

- `apps/web/src/lib/build-stamp.js`: the resolver (no node: imports)
- `apps/web/src/lib/build-stamp.test.ts`: precedence and planted bad values
- `apps/web/svelte.config.js`: `kit.version.name` from the resolver, with a git-HEAD `readHead`
- `scripts/build-web.mjs`: resolves the stamp once, logs it, passes `BUILD_SHA` to the build, exits 2 on a bad stamp
- `apps/web/tests/e2e/build-stamp.spec.ts`: build dir, served `_app/version.json` and `caches.keys()` equal `tran-shell-<expected>`

## Decisions Made

See key-decisions in the frontmatter.

## Deviations from Plan

None. The plan was executed as written.

Notes:
- Full `corepack pnpm lint` failed on Prettier for `scripts/smoke-env.test.ts`. That file belongs to a parallel plan (12-06) and was untracked at the time, so it is out of scope. Prettier and ESLint passed on every file this plan touches, and `eslint .` over the whole repo passed.
- When the pinned builds ran, the working tree held another agent's uncommitted `apps/web/src/app.html` change, so those builds may include it. This does not affect the stamp proof. The builds are stale anyway once later commits land.

## Build-dir state for the next plan

The three build dirs are stamped `ad8fbe92e6c6cfd6efc696c1d8fe9327e53bcbeb`. HEAD has moved past that commit (this plan's spec commit plus parallel wave-3 commits). Any later plan that runs E2E or `smoke:local` must rebuild all three targets first. Otherwise `build-stamp.spec.ts` (and the smoke's stale-stamp check) fails with `stale build: rebuild with pnpm build:<project>`, by design.

## Issues Encountered

None.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

LIVE-04 is delivered. `SMOKE_EXPECT_VERSION` (12-06/12-07) can read `_app/version.json`, and Phase 13's live smoke can poll the deployed one behind the Pages CDN.

## Self-Check: PASSED

All 3 created files exist; commits bafe373, 7345fb1, cc6051a resolve.
