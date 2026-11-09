---
phase: 15-load-deterministic-test-lanes
plan: 08
subsystem: testing
tags: [vitest, groupOrder, playwright, failOnFlakyTests, worker_threads, cpu-pressure, behavioural-proof]

# Dependency graph
requires:
  - phase: 15-load-deterministic-test-lanes
    provides: 15-01 lane manifest (SERIAL, serialTest, SERIAL_GROUP_ORDER) and the four *-serial projects; 15-03 flaky-gate policy (--fail-on-flaky-tests, failOnFlakyTests: !!process.env.CI)
provides:
  - per-lane SERIAL_GROUP_ORDER map (core/web/scripts 1, web-browser 2) so the browser pool never overlaps the forks pool inside one group
  - scripts/lane-order.test.ts, behavioural proof of the three-group lane order on Vitest 4.1.12, plain and shuffled (seed 7), plus the VITEST_MAX_WORKERS fail-closed proof
  - scripts/flaky-gate.test.ts, behavioural proof on Playwright 1.63.0 that a pass-on-retry fails under --fail-on-flaky-tests and under the configs' CI-only failOnFlakyTests
  - scripts/cpu-burn.mjs (+ cpu-burn.test.ts), the cross-platform CPU-pressure tool for the evidence protocol
  - measured ordering and wall-clock cost of the extra browser-serial group
affects: [15-09, 15-10, 15-11, 16-vitest-5-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Behavioural proofs spawn the installed CLI (node_modules/vitest/vitest.mjs, apps/web/node_modules/@playwright/test/cli.js) against throwaway fixtures under gitignored .tools/ dirs, with every VITEST* key stripped from the child env"
    - "A CPU-pressure hot loop never reads the clock: V8's Date.now() on Windows takes a process-wide mutex"
    - "Fixture values that mirror production (group orders) are imported from tooling/vitest/lanes.ts, not retyped, so the proof tracks the manifest"

key-files:
  created:
    - scripts/lane-order.test.ts
    - scripts/flaky-gate.test.ts
    - scripts/cpu-burn.mjs
    - scripts/cpu-burn.test.ts
  modified:
    - tooling/vitest/lanes.ts
    - apps/web/vitest.browser-serial.config.ts
    - vitest.config.ts

key-decisions:
  - "SERIAL_GROUP_ORDER is a per-lane map (core 1, web 1, scripts 1, web-browser 2) and serialTest reads SERIAL_GROUP_ORDER[lane]; parallel projects keep Vitest's default 0 (orchestrator decision after 15-01's 8 cross-pool overlap pairs)"
  - "lane-order.test.ts proves the browser-serial group with a node stand-in project at SERIAL_GROUP_ORDER['web-browser'] rather than launching Chromium in the fixture; the group mechanism is pool-independent and a static test pins web-browser as the strictly greatest value"
  - "cpu-burn's hot loop is pure arithmetic: the planned Date.now() slicing burned about 2.8 of 16 cores on Windows because V8's Clock::Now() holds a mutex"
  - "TEST-01 and TEST-05 stay unchecked: the guard (15-09) and the evidence run (15-10) close them; TEST-03's behavioural half is closed here (15-03 already marked it)"

patterns-established:
  - "Mutation proof for behavioural tests: flip one value in the system under test (group map, fixture retries), run the file red, restore, record in the SUMMARY"
  - "Load readings on Windows quote % Processor Utility (and CPU-seconds from Win32_Process), because % Processor Time under-reports"

requirements-completed: [TEST-03]

# Metrics
duration: 25min
completed: 2026-11-09
---

# Phase 15 Plan 08: Behavioural lane, flaky-gate and CPU-pressure proofs Summary

**Three behavioural proofs in `scripts-serial` (lane order on Vitest 4.1.12 with a per-lane `SERIAL_GROUP_ORDER` map that gives the browser-serial lane its own group 2, pass-on-retry failing under Playwright 1.63.0's flaky gate, and a `worker_threads` CPU burner that saturates 16 cores once its hot loop stopped calling `Date.now()`), each mutation-checked and measured on the real suite: 364 files in three strictly ordered groups with zero cross-pool overlap.**

## Performance

- **Duration:** 25 min (07:46:58Z to about 08:12Z)
- **Started:** 2026-11-09T07:46:58Z
- **Completed:** 2026-11-09T08:12:00Z
- **Tasks:** 3
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- `tooling/vitest/lanes.ts`: `SERIAL_GROUP_ORDER = { core: 1, web: 1, scripts: 1, 'web-browser': 2 } as const satisfies Record<Lane, number>`; `serialTest(lane)` sets `sequence.groupOrder: SERIAL_GROUP_ORDER[lane]`; header comment describes the three groups and why. `SERIAL.scripts` gains the three new files (reasons recorded). The browser-serial config and the root config comments now describe groups 0 / 1 / 2.
- `scripts/lane-order.test.ts` (4 tests): a `.tools/lane-order-<pid>-<rand>/` fixture with a parallel project (`maxWorkers: 2`), a node-serial project at `SERIAL_GROUP_ORDER.scripts` and a browser-serial stand-in at `SERIAL_GROUP_ORDER['web-browser']`, each file logging JSONL start/end marks. Plain and shuffled (`--sequence.shuffle.files --sequence.shuffle.tests --sequence.seed=7`, output asserted to contain `Running tests with seed "7"`), it proves: the two parallel files overlap (non-vacuity), every parallel file ends before the first node-serial file starts, node-serial files never overlap, every node-serial file ends before the first browser-serial file starts, browser-serial files never overlap. A fourth test spawns the real root config with `VITEST_MAX_WORKERS=2 --project brand` and asserts a non-zero exit with `VITEST_MAX_WORKERS overrides fileParallelism:false`. A static test pins every lane value > 0 and `web-browser` strictly greatest.
- `scripts/flaky-gate.test.ts` (4 tests): an `apps/web/.tools/flaky-gate-<pid>-<rand>/` fixture whose spec passes only when `test.info().retry === 1`, with `retries: 1`. Without the gate: exit 0 and `1 flaky` (non-vacuity). With `--fail-on-flaky-tests`: non-zero. With a config carrying `failOnFlakyTests: !!process.env.CI` and child env `CI=1`: non-zero; same config with `CI` stripped: exit 0. No browser is launched.
- `scripts/cpu-burn.mjs` + `scripts/cpu-burn.test.ts` (11 tests): `parseArgs` (defaults `availableParallelism()`, `null`, 3600; six rejections naming the flag), `--max-seconds` self-stop, pre-created stop file, exit 2 on bad arguments with `cpu-burn: ...` on stderr. Output lines `cpu-burn: N threads on M CPUs, started <iso>` and `cpu-burn: stopped <iso> after <s> s`; SIGINT/SIGTERM take the stop path; burners run at normal priority.
- Verification: `pnpm vitest run --project "*-serial"` = 20 files / 539 tests green (73.3 s); `pnpm test:unit` = 364 files / 7149 tests green (121.73 s); `pnpm lint` exit 0; `--project scripts scripts/lane-order.test.ts` collects nothing (the file sits in the exclude list); no `.tools/lane-order-*` or `apps/web/.tools/flaky-gate-*` directory remained after any run.

## Task Commits

1. **Task 1 (RED): lane-order proof** - `e263360` (test)
2. **Task 1 (GREEN): per-lane group order** - `d72e4bd` (feat)
3. **Task 2: flaky-gate proof** - `e87c24d` (test); wording fix so the CI expression appears once - `5af3de0` (test)
4. **Formatting of the two test files** - `e733310` (style)
5. **Task 3 (RED): cpu-burn tests** - `21cc13a` (test)
6. **Task 3 (GREEN): cpu-burn tool** - `293cb9e` (feat)

## Files Created/Modified

- `scripts/lane-order.test.ts` - behavioural lane proof (plain, shuffled seed 7, fail-closed env)
- `scripts/flaky-gate.test.ts` - behavioural flaky-gate proof (4 cases)
- `scripts/cpu-burn.mjs` - cross-platform CPU-pressure tool, exports `parseArgs`
- `scripts/cpu-burn.test.ts` - parseArgs + both stop paths + exit 2
- `tooling/vitest/lanes.ts` - per-lane `SERIAL_GROUP_ORDER`, `serialTest` reads it, three new `SERIAL.scripts` entries, header comment
- `apps/web/vitest.browser-serial.config.ts` - comment: own group after every node-serial file
- `vitest.config.ts` - comment: three groups instead of "groupOrder 1" for all four serial projects

## Measurements

All runs from Git Bash at the repo root with `MSYS_NO_PATHCONV=1 corepack.cmd pnpm ...` and `VITE_CONFIG_NATIVE_IGNORE_WARNING=true`. Machine: Intel Core Ultra 9 285H, 16 cores / 16 logical CPUs, Windows 11, Node 24.18.0. **Machine-load caveat:** four sibling executor agents (15-04, 15-05, 15-06, 15-07) ran their own Vitest and Playwright suites on this machine throughout, plus the user's Chrome, VS Code and a local `mesh-llm` server; idle CPU before the burn readings was already 19-25%. Absolute wall times are "loaded dev box"; the ordering facts and relative numbers are sound.

### 1. Real suite, plain run, three groups (`.tools/test-evidence/15-08-order.json`, gitignored)

Command: `pnpm test:unit --reporter=dot --reporter=json --outputFile.json=.tools/test-evidence/15-08-order.json` (08:04:54Z to 08:07:00Z, exit 0, 364 files, 7149 tests, `Duration 121.73s`). Classifier: scratch `lane-order-report.mjs` marks a `testResults[].name` node-serial or browser-serial when it ends with a `SERIAL` path prefixed by its project root.

| Measure | Value |
|---|---|
| Files classified | 364 = 344 parallel + 16 node-serial + 4 browser-serial (manifest 16 + 4, all found) |
| Parallel group | first start +0.00 s, last end +48.47 s |
| Node-serial group | first start +48.72 s, last end +99.98 s; after parallel: **yes**, gap 0.241 s |
| Browser-serial group | first start +101.34 s, last end +121.03 s; after node-serial: **yes**, gap 1.365 s |
| Overlap pairs | node-serial 0, browser-serial 0, **cross-pool 0** (15-01 measured 8) |
| Spans | node-serial 51.26 s, browser-serial 19.69 s |

### 2. Wall-clock cost of the extra group

In 15-01 the four browser-serial files ran concurrently with the node-serial files, so their span was hidden. With group 2 that span is now additive: **about 21 s per full run** (browser-serial span 19.69 s + 1.37 s group gap) as the upper bound; the real cost is a little lower because the node-serial files no longer compete with a Chromium tab (15-01 estimated "about +20 s"). Total 121.73 s today versus 15-01's 140.90 s plain run is not a like-for-like comparison (different sibling load; the node-serial lane also grew by the three new files, about 44 s of its 51.26 s span is lane-order 24 s + flaky-gate 17 s + cpu-burn 2.5 s).

Serial lane alone: `pnpm vitest run --project "*-serial"` = 20 files, 539 tests, `Duration 73.33s` (15-01: 17 files, 26.83 s; the difference is the three new spawning tests plus the now-sequential browser group).

### 3. Fixture ordering (lane-order.test.ts, both runs inside one test file)

Plain run: parallel files overlap, node-serial min start >= parallel max end, browser-serial min start >= node-serial max end, no intra-group overlap; exit 0. Shuffled run with `--sequence.seed=7`: same five facts; stdout contains `Running tests with seed "7"`. The file takes about 23-24 s (two fixture runs of about 11 s each plus the fail-closed spawn).

### 4. CPU pressure, 16 threads (`node scripts/cpu-burn.mjs --threads 16 --max-seconds 12`)

Readings are from PowerShell `Get-Counter` (1 s samples) and `Win32_Process` CPU times; `wmic cpu get loadpercentage` is deprecated on this Windows build and its CIM equivalent (`Win32_Processor.LoadPercentage`) returned erratic values (67, 31, 5, 0 within one burn), so it was not used.

| Reading | Idle baseline (siblings active) | 16-thread burn |
|---|---|---|
| `\Processor Information(_Total)\% Processor Utility` | - | **122.6-125.0 %** (6 consecutive samples; > 100 % = all cores above nominal clock, i.e. saturated) |
| `\Processor(_Total)\% Processor Time` | 19.3-25.0 % | **84.0-89.1 %** (this counter is known to under-report on Windows 11; Task Manager uses Utility) |
| Burner CPU-seconds after 6 s (`UserModeTime`) | - | **80.3 s user + 0.7 s kernel of 96 possible** (worker start-up about 1 s; siblings held the rest) |
| 1-thread control after 4 s | - | 4.3 s user (one full core) |

Before the fix (hot loop polling `Date.now()`, as planned): 14.5 s user + 2.6 s kernel after 6 s with 16 threads (about 2.8 cores), `% Processor Utility` 37-72 %, `% Processor Time` 24-55 %. See Deviations.

### 5. Mutation notes

- **lane-order:** `'web-browser': 2` -> `'web-browser': 1` in `SERIAL_GROUP_ORDER` (one shared serial group, the 15-01 state): 3 of 4 tests fail: the static pin (`web-browser > core: expected 1 to be greater than 1`) and both behavioural runs at `browser-serial after node-serial` (plain: bser start +0 ms vs ser end +5.6 s; shuffled: 2.6 s early). Restored: 4/4. The plan's suggested mutation (`groupOrder: 1 -> 0` in the fixture) is weaker on Vitest 4.1.12: a `maxWorkers: 1` project with order 0 still lands in a trailing sequential group (15-RESEARCH Pattern 1), which is exactly what the RED run showed when the map did not exist yet (`serial after parallel` passed, `browser-serial after node-serial` failed).
- **flaky-gate:** fixture `retries: 1 -> 0`: 4/4 tests fail (the spec becomes a plain failure, no `1 flaky`, and the no-gate case exits non-zero). Restored: 4/4.
- **cpu-burn:** RED commit `21cc13a` fails with `Cannot find module './cpu-burn.mjs'`; GREEN 11/11.

## For 15-09

The guard must **not** assert a single constant of 1. It must:

1. Import `SERIAL_GROUP_ORDER` (now `Record<Lane, number>`) and assert, for each `*-serial` config (`packages/core/vitest.serial.config.ts`, `apps/web/vitest.serial.config.ts`, `apps/web/vitest.browser-serial.config.ts` (hyphen), `scripts/vitest.serial.config.ts`), that the resolved `test.sequence.groupOrder` equals `SERIAL_GROUP_ORDER[lane]` for that config's lane.
2. Assert every value in `SERIAL_GROUP_ORDER` is `> 0` (so no serial lane can fall back into the parallel group).
3. Optionally pin what `lane-order.test.ts` already pins statically: `SERIAL_GROUP_ORDER['web-browser']` is strictly greater than every node lane's value, which is the property that keeps the browser pool out of the forks pool's group.
4. Keep asserting `fileParallelism: false` and `maxWorkers: 1` on every serial config, and that root `projects` entries are strings (Pitfall 1).

## For 15-10

- Pressure command is unchanged from Pattern 7: `node scripts/cpu-burn.mjs --threads 16 --stop-file .tools/test-evidence/stop --max-seconds 5400` in the background; it prints the `started` and `stopped` lines the evidence file quotes.
- Record load with `Get-Counter '\Processor Information(_Total)\% Processor Utility'` (or Task Manager), not `% Processor Time`, and not `wmic`.
- The browser-startup failure from 15-01's deferred-items did not recur in this plan's two full-suite runs (serial lane 20/20, full 364/364).

## Decisions Made

- **Per-lane group map (orchestrator decision, implemented here):** `SERIAL_GROUP_ORDER = { core: 1, web: 1, scripts: 1, 'web-browser': 2 }`; `serialTest(lane)` reads `SERIAL_GROUP_ORDER[lane]`. Parallel projects stay at the default 0. Measured result: 0 cross-pool overlap in the real suite (section 1).
- **Browser-serial proven by a node stand-in in the fixture.** Launching Chromium inside a throwaway fixture would need the browser provider resolved from `apps/web/node_modules` and would reintroduce the startup failures 15-01 documented. The group mechanism (`groupSpecs` buckets by `groupOrder`, `executeTests` awaits each group) is pool-independent, so a node project at `SERIAL_GROUP_ORDER['web-browser']` proves the same ordering; the real-suite JSON (section 1) proves it for the real browser pool.
- **Fixture values imported from `lanes.ts`.** The fixture's group orders are `SERIAL_GROUP_ORDER.scripts` and `SERIAL_GROUP_ORDER['web-browser']`, so the proof follows the manifest and a future change to the map is tested, not retyped.
- **Requirements:** `TEST-03` listed as completed (its behavioural half; 15-03 marked it already). `TEST-01` (needs the 15-09 guard) and `TEST-05` (needs the 15-10 evidence run) stay unchecked, following 15-01's convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] cpu-burn's planned hot loop produced no real pressure on Windows**
- **Found during:** Task 3, step 4 smoke run (`--threads 16 --max-seconds 10`): `% Processor Time` only 35-56 %
- **Issue:** The plan's worker loop (`for (;;) { const end = Date.now() + 50; while (Date.now() < end); }`) polls `Date.now()` continuously. V8's Windows `Clock::Now()` takes a process-wide mutex, so 16 threads serialise on one lock: 14.5 s user CPU in 6 s instead of about 96 s (one thread alone did burn a full core, 4.2 s in 4 s, so the design, not the machine, was the limit).
- **Fix:** Pure-arithmetic loop (`acc = (acc * 31 + i) | 0` over 1e6 iterations, accumulator checked against a sentinel so the JIT keeps it); no clock read in the worker. `worker.terminate()` interrupts it, so the 50 ms slicing was never needed.
- **Files modified:** scripts/cpu-burn.mjs
- **Verification:** 80.3 s user CPU in 6 s with 16 threads (section 4); `% Processor Utility` 122.6-125.0 %; 11/11 tests still green.
- **Committed in:** 293cb9e

**2. [Rule 1 - Bug] Root `vitest.config.ts` comment became false**
- **Found during:** Task 1 GREEN
- **Issue:** The comment said all four serial projects run at "groupOrder 1"; with the map, the browser-serial project runs at 2.
- **Fix:** Comment rewritten to the three groups and `SERIAL_GROUP_ORDER`; no code change. `vitest.config.ts` was not in the plan's `files_modified`; only its comment changed, and no sibling plan edits it.
- **Files modified:** vitest.config.ts
- **Verification:** `pnpm test:unit` green; `pnpm lint` green.
- **Committed in:** d72e4bd

**3. [Rule 1 - Bug] Plan's grep criterion for the CI expression**
- **Found during:** Self-check
- **Issue:** `grep -c "failOnFlakyTests: !!process.env.CI" scripts/flaky-gate.test.ts` was 3 because the header comment and a test title repeated the fixture's expression; the criterion says 1.
- **Fix:** Reworded the comment and the title; the expression now appears only in the fixture writer.
- **Files modified:** scripts/flaky-gate.test.ts
- **Verification:** grep = 1; 4/4 green; eslint and prettier clean.
- **Committed in:** 5af3de0

---

**Total deviations:** 3 auto-fixed (3 x Rule 1). **Impact on plan:** deviation 1 is load-bearing for TEST-05 (the evidence protocol's pressure would otherwise have been about one sixth of what the evidence file would claim); 2 and 3 are text-only.

### Plan-shape notes (not deviations)

- Task 2 has no repo code under test (it proves installed Playwright behaviour), so there was no meaningful RED commit; the `retries: 0` mutation (section 5) is its red proof.
- The two test files were committed before `prettier --check` was run on them; the fix is the separate `e733310` style commit.

## Issues Encountered

- `sed` from Git Bash did not match the `'\tretries: 1,'` line of the flaky-gate fixture (escaping); the mutation was applied with a direct edit instead and the file restored the same way. No file content was affected.
- `Win32_Processor.LoadPercentage` (the `wmic cpu get loadpercentage` source) gave erratic readings; `Get-Counter` and per-process CPU times were used instead (section 4).
- No browser-startup failure (15-01 deferred item) in this plan's full runs.

## Known Stubs

None. Every new manifest entry resolves to a committed file (20/20 serial files collected); the fixtures are created and deleted per run.

## User Setup Required

None.

## Next Phase Readiness

- 15-09: see **For 15-09** above; also `SERIAL.scripts` now has 9 entries and `SERIAL_GROUP_ORDER` is an object, so any guard code typed against a number must change.
- 15-10: see **For 15-10**; the serial lane now takes about 73 s alone and the full suite about 122 s on a loaded box.
- 15-11 / CI: nothing pushed; `ci.yml` untouched.

## Self-Check: PASSED

- Files: scripts/lane-order.test.ts, scripts/flaky-gate.test.ts, scripts/cpu-burn.mjs, scripts/cpu-burn.test.ts, tooling/vitest/lanes.ts, apps/web/vitest.browser-serial.config.ts all FOUND
- Commits: e263360, d72e4bd, e87c24d, e733310, 21cc13a, 293cb9e, 5af3de0 all FOUND in `git log --all`
- Grep criteria: lane-order.test.ts x1, flaky-gate.test.ts x1, the three `file:` entries x3 in lanes.ts; `sequence.seed=7` x2 and `Running tests with seed` x1 in lane-order.test.ts; `--fail-on-flaky-tests` x3 and `failOnFlakyTests: !!process.env.CI` x1 in flaky-gate.test.ts; `export function parseArgs` x1 and `worker_threads` x1 in cpu-burn.mjs; no fixture directories left behind

---
*Phase: 15-load-deterministic-test-lanes*
*Completed: 2026-11-09*
