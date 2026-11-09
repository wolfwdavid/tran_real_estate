---
phase: 15-load-deterministic-test-lanes
plan: 01
subsystem: testing
tags: [vitest, projects, groupOrder, fileParallelism, maxWorkers, test-lanes, measurement]

# Dependency graph
requires:
  - phase: 14-launch-audit
    provides: measured unit/E2E durations, CI run 42289609809 worker counts, deferred-items load-sensitive lists
provides:
  - tooling/vitest/lanes.ts lane manifest (SERIAL, files, serialTest, SERIAL_GROUP_ORDER, MAX_WORKERS, LOAD_SENSITIVE_SPECS, LOAD_SENSITIVE_VITEST)
  - four file-based *-serial Vitest projects (core-serial, web-serial, web-browser-serial, scripts-serial) running after the parallel group, one file at a time per pool
  - parallel siblings that exclude every serial file via files(lane)
  - one MAX_WORKERS constant (CI 3, dev 8) on the root config and both browser configs
  - VITEST_MAX_WORKERS fail-closed check in the root config
  - measured ordering, shuffle, 50% threshold, worker and cold-cache numbers for 15-06, 15-07, 15-10
affects: [15-02, 15-06, 15-07, 15-08, 15-09, 15-10, 16-vitest-5-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Serial lane = separate vitest.serial.config.ts files that spread their base config and override test with serialTest(lane); never inline project objects, never mergeConfig/extends"
    - "Parallel sibling excludes the lane's files via exclude: [...configDefaults.exclude, ...files(lane)]"
    - "Worker cap is one constant, applied on the root config and on every browser config (the browser pool ignores the root value)"

key-files:
  created:
    - tooling/vitest/lanes.ts
    - packages/core/vitest.serial.config.ts
    - apps/web/vitest.serial.config.ts
    - apps/web/vitest.browser-serial.config.ts
    - scripts/vitest.serial.config.ts
  modified:
    - vitest.config.ts
    - packages/core/vitest.config.ts
    - apps/web/vite.config.ts
    - apps/web/vitest.browser.config.ts
    - apps/extension/vitest.browser.config.ts
    - scripts/vitest.config.ts
    - .planning/phases/15-load-deterministic-test-lanes/deferred-items.md

key-decisions:
  - "Browser-serial config is apps/web/vitest.browser-serial.config.ts (hyphen): Vitest 4.1.12's project-config regex /^vite(?:st)?(?:\\.[\\w-]+)?\\.config\\./ allows one dotted segment, so the planned vitest.browser.serial.config.ts is rejected at startup; the project name web-browser-serial is unchanged"
  - "Dev MAX_WORKERS stays 8: median 124.3 s at 8 vs 135.1 s at 15 (2 runs each); 8 is not slower and leaves headroom for E2E and Chromium"
  - "Cross-pool concurrency inside group 1 is reported, not changed: node serial files run strictly one at a time and browser-serial files one tab at a time, but the forks pool and the browser pool overlap; moving web-browser-serial to groupOrder 2 would fix it in one line and is left as an orchestrator decision because 15-09's guard asserts groupOrder === 1 for every lane"
  - "TEST-01 and TEST-04 left unchecked after 15-01 (mechanism and Vitest cap only); the guard (15-09), Playwright workers (15-03) and PATH-guard test (15-07) close them"

patterns-established:
  - "Lane-safety threshold: a test stays in the parallel lane only while its max duration in a full parallel run is <= 50% of the lane's default timeout (node 2.5 s, browser 7.5 s)"
  - "Every measurement run writes .tools/test-evidence/15-01-<step>.log with start/end UTC and exit code; wall times come from Vitest's Duration line"

requirements-completed: []

# Metrics
duration: 55min
completed: 2026-11-09
---

# Phase 15 Plan 01: Load-Deterministic Test Lanes Summary

**Two Vitest lanes on 4.1.12: a `tooling/vitest/lanes.ts` manifest, four file-based `*-serial` projects (`fileParallelism: false`, `sequence.groupOrder: 1`) that start 0.3-0.6 s after the last parallel file, parallel siblings that exclude the 17 serial files, one `MAX_WORKERS` constant (CI 3, dev 8 by measurement) on the root and both browser configs, and a root config that throws on `VITEST_MAX_WORKERS`.**

## Performance

- **Duration:** 55 min (06:45Z to 07:40Z)
- **Started:** 2026-11-09T06:45:28Z
- **Completed:** 2026-11-09T07:40:00Z
- **Tasks:** 3
- **Files modified:** 12 (5 created, 7 modified incl. deferred-items.md)

## Accomplishments

- `pnpm test:unit` is still exactly `vitest run` and now runs six parallel projects (group 0) followed by `core-serial`, `web-serial`, `web-browser-serial (chromium)` and `scripts-serial` (group 1); `ci.yml` and `package.json` untouched.
- The lane manifest lists 17 literal files with reasons (4 core, 3 web, 4 web-browser, 6 scripts); `pnpm vitest run --project "*-serial"` reports `Test Files  17 passed (17)`, and the parallel siblings stay green without them.
- The parallel `scripts` project lost its unexplained `testTimeout: 60_000`; `scripts-serial` carries it with measured numbers and a root cause.
- Measured: ordering plain and shuffled (seed recorded), 50% threshold (0 hits), worker value (8 kept), scripts-serial durations, cold cache (2 of 3 green), fail-closed env check (exit 1).

## Task Commits

1. **Task 1: Lane manifest + core-serial + scripts-serial** - `e51561d` (feat)
2. **Task 2: web-serial, web-browser-serial, root projects, MAX_WORKERS, fail-closed** - `a6bbcd5` (feat)
3. **Task 3: Measurements written into lanes.ts and scripts-serial comment** - `4ab5f42` (test)

## Files Created/Modified

- `tooling/vitest/lanes.ts` - SERIAL manifest, `files()`, `serialTest()`, `SERIAL_GROUP_ORDER`, `MAX_WORKERS` (measured comment), `LOAD_SENSITIVE_SPECS`, `LOAD_SENSITIVE_VITEST`
- `packages/core/vitest.serial.config.ts`, `apps/web/vitest.serial.config.ts`, `apps/web/vitest.browser-serial.config.ts`, `scripts/vitest.serial.config.ts` - the four serial projects (object spread over the base config)
- `vitest.config.ts` - `maxWorkers: MAX_WORKERS`, ten string project entries, `VITEST_MAX_WORKERS` throw
- `packages/core/vitest.config.ts`, `apps/web/vite.config.ts`, `scripts/vitest.config.ts` - `exclude` gains `...files(lane)`; scripts drops `testTimeout`
- `apps/web/vitest.browser.config.ts`, `apps/extension/vitest.browser.config.ts` - `maxWorkers: MAX_WORKERS` (+ `exclude` with `files('web-browser')` in web); Windows PATH blocks untouched for 15-07
- `.planning/phases/15-load-deterministic-test-lanes/deferred-items.md` - three out-of-scope findings (below)

## Measurements

All runs from Git Bash at the repo root with `MSYS_NO_PATHCONV=1 corepack.cmd pnpm ...` and `VITE_CONFIG_NATIVE_IGNORE_WARNING=true`; logs in `.tools/test-evidence/15-01-*.log` (gitignored). Machine: 16 logical CPUs, Windows 11. Two sibling executor agents (15-02, 15-03) ran full suites and Playwright E2E on the same machine until about 07:12Z; the user's Chrome (about 50 processes), VS Code and a local `mesh-llm` server were active throughout. The 11-06 research baseline (75 s at 15 workers, idle machine) was never reachable today; treat the absolute numbers as "loaded dev box" and the relative ones as sound.

### 1. Ordering, plain run

Command: `pnpm test:unit --reporter=default --reporter=json --outputFile.json=.tools/test-evidence/15-01-order.json` (07:05:20Z, exit 0, 360 files, 7115 tests, Duration 140.90 s).

Classifier: a Node one-liner (scratch `lane-order.mjs`) marks a `testResults[].name` serial when it ends with a `SERIAL` path prefixed by its project root (`packages/core/`, `apps/web/`, `scripts/`).

| Measure | Value |
|---|---|
| Files classified | 360 = 343 parallel + 17 serial (all 17 manifest entries found) |
| Max parallel `endTime` | +85.63 s after first file start |
| Min serial `startTime` | +86.23 s |
| Serial after parallel | YES, gap 0.601 s |
| Overlap among node serial files (core/web/scripts-serial) | none |
| Overlap among browser-serial files | none |
| Overlap browser-serial vs node-serial | 8 pairs (e.g. OutreachSection.browser +88.19..+102.51 s alongside mutation, parse-freeform, number-words, precommit) |

The cross-pool overlap is Vitest's two-pool behaviour inside one group (15-RESEARCH Pattern 1: "the browser-serial files run one tab at a time, concurrently with at most one node file"). The plan's literal "no serial overlap" holds per pool and not across pools; see Decisions.

### 2. Ordering, shuffled run

Command: `SEED=$(date +%s); pnpm test:unit --sequence.shuffle.files --sequence.shuffle.tests --sequence.seed=$SEED --reporter=default --reporter=json --outputFile.json=.tools/test-evidence/15-01-shuffle.json`

- Seed: `1794208427`; printed line: `Running tests with seed "1794208427"`
- Result: exit 0, 360 files, 7115 tests, Duration 100.92 s (07:13:47Z)
- Max parallel end +65.61 s, min serial start +65.87 s, serial after parallel YES (gap 0.256 s); same per-pool/no-overlap and cross-pool-overlap pattern as the plain run. File-based serial projects keep `groupOrder` under `--sequence.*` (Pitfall 1 avoided).

### 3. 50% lane-safety threshold (from the plain-run JSON)

- Parallel-lane tests above 2500 ms (node) or 7500 ms (`*.browser.test.ts`): **0**. No SERIAL additions needed; no `packages/brand` or `apps/extension` hit.
- Five slowest parallel tests:

| Duration | File :: test |
|---|---|
| 2583.9 ms | apps/web/src/lib/ai/ui/PlatformCard.browser.test.ts :: GenerationPanel sections mode in the browser run, announce, copy, edit past the hashtag cap, gated focus |
| 1666.4 ms | apps/web/src/lib/features/shared/data/CapEditor.browser.test.ts :: CapAboveLimitDialog a near-miss word shows the field error and never saves; 'Overage ' saves 60 |
| 1648.4 ms | apps/web/src/lib/features/shared/data/CapEditor.browser.test.ts :: CapEditor the helper follows the typed value live |
| 1589.2 ms | apps/web/src/lib/features/renter/shortlist/ShortlistToggle.browser.test.ts :: ShortlistToggle (detail) saves, shows the shortlist link, and removes a plain Saved item without asking |
| 1588.1 ms | apps/web/src/lib/features/shared/data/DataShell.browser.test.ts :: DataShell runAlerts gate (08-27, SC5) deferred start with 5 due asks as usual |

All five are browser tests at <= 34% of the 7.5 s threshold (<= 17% of the 15 s default); the slowest node parallel test is well under 1.6 s.

### 4. Dev worker value (Q2)

Four full `pnpm test:unit` runs back to back (07:15Z-07:26Z, after the sibling agents had finished), `Duration` line from each:

| MAX_WORKERS (dev) | Run a | Run b | Median |
|---|---|---|---|
| 8 | 98.62 s | 150.00 s | **124.3 s** |
| 15 | 135.73 s | 134.41 s | **135.1 s** |

Rule: keep 8 unless median(8) > 1.5 x median(15) = 202.6 s. 124.3 s < 202.6 s, so **8 stays**. At 15 the aggregate `transform` time doubled (243-245 s vs 81-127 s) and `import` rose to about 795 s vs 368-511 s: more workers only added contention on this box. Recorded in the `MAX_WORKERS` comment. CI stays 3 (today's `cpus-1` on 4 vCPU; CI behaviour unchanged).

### 5. scripts-serial timeout re-measure (plain-run JSON, serial lane)

| File | Max test duration |
|---|---|
| scripts/eslint-rules.test.ts | 6436.8 ms |
| scripts/origin-parity.test.ts | 2475.0 ms |
| scripts/precommit.test.ts | 2206.0 ms |
| scripts/gen-fixtures.test.ts | 1774.0 ms |
| scripts/site-url.test.ts | 1489.4 ms |
| scripts/commit-hygiene.test.ts | 735.8 ms |

Precommit's max is far below the 56 s worst case; `testTimeout: 60_000` is kept (not lowered in this plan) and the comment now also carries the serial-lane numbers. eslint-rules still exceeds the 5 s default even alone in the lane, so it cannot return to the parallel project without a code change.

Other serial-lane maxima: OutreachSection.browser 4573 ms, ResultsView.browser 3129 ms, GatewayError.browser 2118 ms, calculators.browser 1074 ms, import-commit 760 ms, boundaries 746 ms, numbers.property 438 ms, og-card.server 377 ms, mutation 58 ms, parse-freeform 28 ms, number-words 19 ms.

### 6. Cold Vite cache (Pitfall 6)

`rm -rf apps/web/node_modules/.vite` before each full `pnpm test:unit`:

| Run | Start | Result |
|---|---|---|
| cold-a | 07:26:28Z | exit 0, 360/360, 168.51 s; both browser projects logged `[optimizer] bundling dependencies...` once; no `effect_orphan` |
| cold-b | 07:29:32Z | exit 1, 356/360: `Error: Failed to connect to the browser session "0c24b810-..." [web-browser-serial (chromium)] within the timeout.` (Vitest `browser.connectTimeout` 60 s) right after the serial browser project's cold optimizer pass; tests never started; no `effect_orphan` |
| cold-c | 07:34:53Z | exit 0, 360/360, 164.72 s; no `effect_orphan` |

Two green cold runs as required; the cold-b failure is a browser-session startup failure under load, not a test or lane failure, and is recorded in deferred-items (no timeout was raised).

Also measured in isolation before the full runs: `pnpm vitest run --project web-browser --project web-browser-serial` warm 34/34 in 42.26 s and cold 34/34 in 63.66 s.

### 7. Fail closed

Command: `VITEST_MAX_WORKERS=2 MSYS_NO_PATHCONV=1 corepack.cmd pnpm vitest run --project brand`
Exit code: **1**. Output line 4: `Error: VITEST_MAX_WORKERS overrides fileParallelism:false and breaks the *-serial lane (tooling/vitest/lanes.ts); unset it.`

### Other verification

- `pnpm vitest run --project "*-serial"`: `Test Files  17 passed (17)`, 520 tests, 26.83 s.
- `pnpm --filter extension test:browser`: 1 file, 13 tests, exit 0 (extension browser config loads with the cap).
- `pnpm check` exit 0; `pnpm lint` exit 0 (07:08Z-07:12Z).
- Direct config loads (Task 1): `pnpm vitest run --root packages/core --config vitest.serial.config.ts` = 4 files / 249 tests; `--root scripts --config vitest.serial.config.ts` = 6 files / 182 tests. (`--config` alone resolves `include` against cwd, so `--root` is required for direct runs.)
- Static: 7 exports in lanes.ts; `fileParallelism: false` x1; `groupOrder: SERIAL_GROUP_ORDER` x1; `maxWorkers: MAX_WORKERS` x1 in each of the three configs; `VITEST_MAX_WORKERS` x3 in the root; `serial.config.ts'` x4; no `{` project objects; `"test:unit": "vitest run"` x1; `git diff --stat .github/workflows/ci.yml` empty; `<filled by Task 3>` x0.

## Decisions Made

- **Config filename (Rule 3 deviation):** `apps/web/vitest.browser-serial.config.ts`, not `vitest.browser.serial.config.ts`. Vitest's `CONFIG_REGEXP` (`cli-api…js:11146`) is `/^vite(?:st)?(?:\.[\w-]+)?\.config\./`: one optional dotted segment, so the two-segment name fails at startup with "must start with vitest.config/vite.config or match the pattern (vitest|vite).*.config.*". The research's claim that it matched was wrong. Project name, exports and `serialTest('web-browser')` are exactly as planned. **15-02 (line 111 classifier fixture) and 15-09 (line 60 table) reference the old filename and must use the hyphenated one.**
- **Dev MAX_WORKERS = 8** by the plan's rule (Measurements 4).
- **Cross-pool overlap in group 1 reported, not changed.** Node serial files are strictly sequential; browser-serial files are strictly sequential; the two pools run concurrently, so e.g. ResultsView.browser (load-sensitive) ran while eslint-rules spent 6.4 s linting. The one-line refinement is `sequence.groupOrder: 2` for the `web-browser` lane (parallel -> node-serial -> browser-serial, about +20 s per run). Not applied here because 15-09's guard (as planned) asserts `groupOrder === SERIAL_GROUP_ORDER === 1` for every lane; the orchestrator should decide before 15-09 is written.
- **Requirements not marked complete.** TEST-01 also needs the guard (15-09) and TEST-04 needs Playwright `workers` (15-03) and the PATH-guard test (15-07); following the project's convention (e.g. FND-04/05 after 01-01), both stay unchecked until their closing plans.
- Logs were run with `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to silence Vite's "configLoader: 'native'" extension warning for the planned extension-less imports; the warning is harmless and recorded in deferred-items for Phase 16.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed the browser-serial config to a name Vitest accepts**
- **Found during:** Task 2 (first `pnpm test:unit`): Startup Error, `apps/web/vitest.browser.serial.config.ts` rejected by `resolveTestProjectConfigs`
- **Issue:** Vitest 4.1.12 allows only one dotted segment between `vitest` and `.config` (verified: `vitest.browser.serial.config.ts` false, `vitest.browser-serial.config.ts` true, `vitest.serial.config.ts` true)
- **Fix:** file renamed to `apps/web/vitest.browser-serial.config.ts`; root `projects` entry updated; content unchanged
- **Files modified:** apps/web/vitest.browser-serial.config.ts, vitest.config.ts
- **Verification:** full run names `web-browser-serial (chromium)`; `--project "*-serial"` = 17 files
- **Committed in:** a6bbcd5

**2. [Rule 3 - Blocking] Direct serial-config runs need `--root`**
- **Found during:** Task 1 verification: `pnpm vitest run --config packages/core/vitest.serial.config.ts` reported "No test files found" because `include` resolved against the repo root
- **Fix:** verification command run as `pnpm vitest run --root packages/core --config vitest.serial.config.ts` (and `--root scripts`); no file change
- **Verification:** 4 and 6 files respectively

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking). **Impact on plan:** the filename change propagates to 15-02 and 15-09 text; no behavioural change to the lane design.

## Issues Encountered

- **Browser-project startup failures in 3 of 10 full runs** (never in the 2 isolated browser-only runs): run 1 (06:50Z, both siblings active): 2 files `Failed to fetch dynamically imported module` (DataShell in web-browser, OutreachSection in web-browser-serial); order run 1 (06:59Z): 7 web-browser files, same error, all among the first files loaded; cold-b (07:29Z, siblings finished): web-browser-serial `Failed to connect to the browser session ... within the timeout`. Every failure is at browser-project startup; no test body ever failed; the other 7 full runs were 360/360. Same symptom was recorded once in 09-23. Not caused by the lanes (the parallel browser project ran 12 tabs before and 8 after; the Vite optimizer logged no mid-run re-bundle). Logged in deferred-items with candidate causes; no timeout raised, no retry added. **Recommendation for the orchestrator:** 15-10's evidence runs on an otherwise idle machine will show whether this recurs; if it does, it needs its own root-cause plan in this phase (it is a load-determinism defect).
- **Loaded machine:** all wall times are 1.3-2x the 11-06 baseline (75 s). Sibling agents explain the early runs only; VS Code, Copilot runtime, `mesh-llm` and the user's Chrome were active throughout. No orphaned headless Chromium remained after any run (checked after cold-c).
- **happy-dom iframe noise** (15 `DOMException` lines per run from `apps/extension/tests/brand-parity.test.ts` and `reconcile.test.ts`): pre-existing, tests pass; logged in deferred-items.

## Known Stubs

None. Every manifest entry resolves to an existing file (17/17 found in both JSON reports); no placeholder values.

## User Setup Required

None.

## Next Phase Readiness

- 15-02/15-09 (guard): consume `SERIAL`, `files`, `serialTest`, `SERIAL_GROUP_ORDER` from `tooling/vitest/lanes.ts`; use the filename `apps/web/vitest.browser-serial.config.ts`; decide on `groupOrder` 1 vs 2 for the browser-serial lane before asserting it.
- 15-06 (annotations): serial-lane maxima above; ResultsView 3.13 s, OutreachSection 4.57 s, GatewayError 2.12 s, calculators 1.07 s; boundaries 0.75 s, import-commit 0.76 s, og-card 0.38 s.
- 15-07 (RUNBOOK + PATH guard): `MAX_WORKERS = process.env.CI ? 3 : 8`; browser configs' PATH blocks untouched here.
- 15-10 (evidence): seed `1794208427` and the `Running tests with seed` line are in `.tools/test-evidence/15-01-shuffle.log`; worker medians 124.3 s (8) / 135.1 s (15); copy from this file.

## Self-Check: PASSED

- Files: tooling/vitest/lanes.ts, packages/core/vitest.serial.config.ts, apps/web/vitest.serial.config.ts, apps/web/vitest.browser-serial.config.ts, scripts/vitest.serial.config.ts, 15-01-SUMMARY.md all FOUND
- Commits: e51561d, a6bbcd5, 4ab5f42 all FOUND in `git log --all`

---
*Phase: 15-load-deterministic-test-lanes*
*Completed: 2026-11-09*
