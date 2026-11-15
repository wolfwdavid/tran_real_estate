---
phase: 16-toolchain-pnpm-12-sveltekit-3-vitest-5
plan: 08
subsystem: toolchain
tags: [sveltekit-3, service-worker, app-manifest, precache, first-kit3-build]
requires: [16-07]
provides:
  - "service worker on $app/manifest, $app/env, $app/paths with the dotfile filter inside the worker"
  - "flipped guard (REQUIRED $app/manifest and $app/env, FORBIDDEN $service-worker) with a planted .nojekyll case"
  - "worker type-checked again (web check runs tsc on src/service-worker/tsconfig.json)"
  - "first Kit 3 builds of all three targets, all local oracles green except the known budget"
affects: [16-09, 16-10]
tech-stack:
  added: []
  patterns:
    - "precacheFiles(assets) in lib/precache-filter.ts is the one filter the worker and its test both call"
    - "ESLint fetch-ban exemption scoped to exactly service-worker/index.ts"
key-files:
  created:
    - apps/web/src/service-worker/tsconfig.json
  modified:
    - apps/web/src/service-worker/index.ts (git mv from src/service-worker.ts)
    - apps/web/src/lib/precache-filter.ts
    - apps/web/tsconfig.json
    - apps/web/package.json
    - apps/web/tests/e2e/pwa.spec.ts
    - eslint.config.js
    - scripts/service-worker-guard.test.ts
    - scripts/kit3-migration.test.ts
    - scripts/eslint-rules.test.ts
requirements-completed: []
duration: one session
completed: 2026-11-14
---

# Phase 16 Plan 08: service worker on $app/manifest and the first Kit 3 build

The worker now runs on Kit 3's manifest without widening what it may cache, the guard that pins its shape is flipped (not weakened), and the whole tree builds and serves on Kit 3 for the first time: three builds, csp/seo asserts, `smoke:local` and 278 E2E tests on root and sub all pass. `budget:assert` is red as expected (plan 09). Nothing was pushed.

## Commits

| Task | Commit | Subject |
|------|--------|---------|
| 1 | aee4eb8 | feat(web): service worker on $app/manifest with in-worker dotfile filter |
| 2 | none | verification only; no fix was needed |

No commit carries a trailer.

## Task 1: worker, guard, lint exemption

- `apps/web/src/service-worker.ts` moved with `git mv` to `src/service-worker/index.ts`. Header comment (three numbered reasons) and the install, activate and fetch bodies are unchanged, including the three early returns and the `respondWith` line.
- `ASSETS = new Set([...immutable.map(toUrl), ...precacheFiles(assets).map(asset), ...prerendered.map(toUrl)])`. `precacheFiles` lives next to `isPrecacheable` in `lib/precache-filter.ts` (regex untouched) and is imported relatively (the worker tsconfig has no `#lib` mapping).
- Kit 3's `assets` has no dotfile filter, so `.nojekyll` is in the built worker's manifest array (it appears once in `build/service-worker.js`); the filter runs inside the worker at module load, which is the only place that matters on Pages.
- `src/service-worker/tsconfig.json` extends `$app/tsconfig/service-worker`; `apps/web/tsconfig.json` gained `"src/service-worker"` in `exclude` (the old file globs were already there but Kit's validator names the directory).
- ESLint exemption is exactly `${WEB}/service-worker/index.ts`; `scripts/eslint-rules.test.ts` lints that virtual path, and the old path `service-worker.ts` and the sibling `service-worker/helper.ts` each still report exactly one fetch-ban error (the existing `lib/pwa/install.ts` control is kept).
- `scripts/kit3-migration.test.ts`: sixth token `$service-worker`, planted case via the existing `test.each`, and `scripts/service-worker-guard.test.ts` added to the exact-path allowlist (its FORBIDDEN list has to spell the token). The allowlist-shape test now pins both paths.

### Guard mutation table

| Mutant (scratch, reverted) | Result |
|----------------------------|--------|
| `isPrecacheable` returns true (filter off) | 2 failed of 13 (the dotfile table and the planted Kit 3 manifest case) |
| `sw.skipWaiting();` appended to the worker | 1 failed of 13 (worker shape: `forbidden skipWaiting`) |
| ESLint exemption widened to `service-worker/**` | 1 failed of 137 (the same-directory sibling `service-worker/helper.ts`) |
| Before the worker existed (Step B) | 5 failed of 13, as intended |

Gate: guard, kit3-migration, pwa-assets and eslint-rules: 4 files, 172 tests pass. Prettier clean on all touched files.

## Task 2: first Kit 3 build and the local oracles

WLAN gate: last event 8003 was 19:02:14; the first browser run started 19:30, the last E2E run finished 19:36; a query at 19:36:54 shows no event after 19:02:14. About 28 quiet minutes before the first Playwright run, none inside any run window.

| Stage | Command | Result |
|-------|---------|--------|
| generated state | `rm -rf apps/web/.svelte-kit`, `svelte-kit sync` | clean |
| check | `pnpm check` (web svelte-check, worker tsc, extension, core) | exit 0; web 3,218 files 0 errors 0 warnings; extension 1,079 files 0 errors |
| lint | `pnpm lint` | exit 0; 1 warning (GenerationPanel.svelte:83 unused eslint-disable, pre-existing, not this plan's) |
| banned | `pnpm banned` | pass, 454 files |
| ui:guard | `pnpm ui:guard` | pass, 81 files |
| builds | `pnpm build:root`, `build:sub`, `build:configured` | all exit 0 on the first attempt; `_app/version.json` equals `git rev-parse HEAD` (aee4eb8...) in all three; `service-worker.js` emitted at the build root in all three |
| csp:assert | all three targets | pass, 45 pages each |
| seo:assert | all three targets | pass, 44 pages, 14 sitemap URLs, 6 share cards each |
| smoke:local | root, sub, configured | 121 passed on each; 13.6 s, 13.4 s, 13.8 s; total 40.7 s |
| ext:build, ext:assert | extension zip and oracle | exit 0 (6 files scanned, zip root verified) |
| budget:assert | see below | exit 1, expected, owned by plan 09 |

Plain `pnpm` was used for every script that spawns pnpm (corepack-wrapped `pnpm check` fails with the global-11 mismatch from tasks/lessons.md 2026-11-11); `corepack.cmd pnpm exec` was used for direct tool runs.

### E2E (Playwright, projects root and sub, workers 4, no retries, no timeout changes)

| Specs | Tests | Result |
|-------|-------|--------|
| sample-handoff, renter-search, renter-saved, agent-contacts, agent-pipeline, agent-contact | 82 | 82 passed (40.4 s) |
| investor/analyze, investor/deals, pwa | 44 | 44 passed (16.8 s) |
| investor/ whole directory (includes analyze, deals, demo, routes, memo, print, sweep, autofill, buybox, overview) | 152 | 152 passed (1.9 min) |

The five shallow-routing sites (sample handoff `?source` strip, renter search URL mirroring, saved list state, contacts and pipeline `?list=`, analyzer `?id=` and compare `?ids=` in deals) pass on both base paths; no navigation loop appeared, so the plan 05 handler guards needed no change. The pwa spec (`tests/e2e/pwa.spec.ts`) passes on root and sub, and the local `pwa.smoke.ts` (scope = base, `tran-shell-<sha>`, no dotfile in the precache) passes inside `smoke:local` on all three targets. The `configured` project and the rest of the E2E suite were not run here (plan 10's full gate).

Base-path check: `smoke:local` and the root and sub E2E runs exercise built hrefs under both the empty base and `/tran_real_estate` (the sub build); no href error appeared.

### Budget (assert-budget.mjs untouched, `git diff origin/main..HEAD -- scripts/assert-budget.mjs` is empty)

Initial JS gzip KB per page, budget 60 KB on gated pages:

| Page | build (root) | build-configured | Result |
|------|--------------|------------------|--------|
| feedback/ | 60.6 | 60.8 | FAIL |
| for-agents/ | 64.0 | 64.2 | FAIL |
| for-investors/ | 64.1 | 64.3 | FAIL |
| for-renters/ | 64.1 | 64.3 | FAIL |
| tools/affordability/ | 63.4 | 63.6 | FAIL |
| tools/cap-rate/ | 63.2 | 63.4 | FAIL |
| tools/cash-on-cash/ | 63.4 | 63.5 | FAIL |
| tools/dscr/ | 63.4 | 63.5 | FAIL |
| tools/ | 55.8 | 56.0 | PASS |
| index.html (report only) | 62.4 | 62.5 | REPORT |
| legal/data-coverage, fair-housing, privacy, terms (report only) | 54.5, 54.7, 56.1, 52.9 | 54.7, 54.9, 56.3, 53.0 | REPORT |

CSS gzip is 11.7 KB on gated pages (12.0 on legal). Exactly the research prediction: 8 gated pages over by 0.6 to 4.2 KB. `budget:assert` exits 1 because its first command fails and `&&` skips the configured target, so the configured numbers above came from running `scripts/assert-budget.mjs apps/web/build-configured --require-tools` directly (same eight failures). Plan 09 owns the trim.

## Deviations from plan

**1. [Rule 3 - blocking] `apps/web/package.json` check script.** The plan lists no file for "make the worker type-checked again", but tsconfig excludes the worker and svelte-check never sees it. `check` now ends with `&& tsc -p src/service-worker/tsconfig.json`. The first run of that command, before the fix below, reported two real errors, so it is not vacuous.

**2. [Rule 1 - types] `resolve(e.path as never)` does not type-check on Kit 3.1.1.** Its overloads reject the spread-tuple form, and the manifest's `Path` type includes `/` (the root page) which `resolve` does not accept as a pathname although it resolves correctly at runtime (a leading slash takes the route-ID branch and yields base + `/`). The worker uses `const toUrl = resolve as (path: string) => string` with a comment saying why. Behaviour is the spike's: the local pwa smoke passes 121/121 on the sub build.

**3. [Rule 3] Task 2 produced no commit.** No build, assert, smoke or E2E failure needed a fix.

No auth gates, no installs (`pnpm-lock.yaml`, root `package.json` untouched).

## Threat flags

None new. T-16-08-01 to -05 mitigations are in place as listed in the plan and mutation-proved above.

## Known stubs

None.

## Requirements

TOOL-03 is NOT marked complete: its text ends with "registers and precaches on the live origin as proven by the live smoke", which can only be proven after plan 10's push. The code half (worker on `$app/manifest`, in-worker dotfile filter, flipped guard, local smoke and E2E proof) is done and locally proven. TOOL-02 spans plans 05 to 10 and stays Pending.

## Left red

- `budget:assert`: 8 gated pages over 60 KB (plan 09).
- Live-origin worker proof (scope `https://wolfwdavid.github.io/tran_real_estate/`, `caches.keys()` = `['tran-shell-<sha>']`): after plan 10's push.
- Pre-existing, unchanged: lint warning at GenerationPanel.svelte:83; Vite warning about `../../tooling/vitest/lanes` without an extension.

## Self-Check: PASSED

Commit aee4eb8 exists; `apps/web/src/service-worker/index.ts` and `tsconfig.json` exist; `apps/web/src/service-worker.ts` is absent.
