---
phase: 15-load-deterministic-test-lanes
plan: 09
subsystem: testing
tags: [vitest, playwright, typescript-ast, guard, repo-sweep, mutation-testing, test-lanes]

# Dependency graph
requires:
  - phase: 15-load-deterministic-test-lanes
    provides: 15-01 lane manifest and the four *-serial projects; 15-02 rules module and its 116 planted tests; 15-03 flaky gate and worker pins; 15-04/15-05/15-06 annotated raises; 15-07 worker-cap RUNBOOK and PATH guard; 15-08 per-lane SERIAL_GROUP_ORDER and the three scripts-serial proofs
provides:
  - scripts/test-lanes.test.ts, the permanent Phase 15 guard: repo sweep over git ls-files (tracked + untracked-not-ignored), non-vacuity pins (EXPECTED_ELAPSED x5, EXPECTED_RAISES x7), lane manifest integrity, worker-cap, CI and flaky-gate pins
  - scripts/lib/test-lane-rules.mjs reads callee names from the AST (calleeName), so Prettier-wrapped expect.poll / expect.element / vi.waitFor / vi.setConfig / describe.configure / test.setTimeout chains are detected (closes the 15-06 blind spot)
  - 10 new planted wrapped-chain cases in scripts/test-lane-rules.test.ts (126 total)
  - measured guard runtime under full load (1.88 s max test; stays in the parallel scripts lane)
affects: [15-10, 15-11, 16-vitest-5-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Repo sweep = git ls-files -z --cached --others --exclude-standard, paths normalised to POSIX and filtered to files still on disk, texts read once in beforeAll, rules applied per fileKind"
    - "Non-vacuity pins: run a detector with lane membership ignored and compare the sorted unique path list to a hard-coded expected list, so a silently broken rule cannot turn the zero-findings sweep into a vacuous pass"
    - "AST-derived callee names (identifier/property chain joined with dots, whitespace-stripped source text as fallback) for every callee comparison in the rules module"

key-files:
  created:
    - scripts/test-lanes.test.ts
  modified:
    - scripts/lib/test-lane-rules.mjs
    - scripts/test-lane-rules.test.ts

key-decisions:
  - "Guard stays in the parallel scripts lane: max test duration under full load is 1.88 s (sweep), under the 2.5 s Pitfall 10 threshold; tooling/vitest/lanes.ts untouched"
  - "calleeName() builds the callee from the AST property chain and falls back to whitespace-stripped getText for call-rooted chains (expect(loc).toBeVisible), replacing every getText() comparison in the rules module"
  - "Group-order assertions are per lane (SERIAL_GROUP_ORDER[lane], every value > 0, web-browser strictly greatest), per the orchestrator amendment, not the plan's === 1"
  - "Non-vacuity C also pins that core + web + web-browser hold exactly the 11 timing/raise files (5 elapsed + 7 raise, import-commit in both), so the manifest cannot be padded without a visible test change"

patterns-established:
  - "Mutation ledger for a guard: one mutant per enforced rule, each applied with sed/node, the guard run, the file restored with git checkout, and the failing test name recorded"

requirements-completed: [TEST-01, TEST-02, TEST-03, TEST-04]

# Metrics
duration: 18min
completed: 2026-11-09
---

# Phase 15 Plan 09: Repo sweep guard, manifest integrity and CI pins Summary

**`scripts/test-lanes.test.ts` now sweeps every tracked and untracked-not-ignored file (365 Vitest tests, 116 Playwright files, all 15 configs, 5 package.json files, 3 workflows, 27 scripts/*.mjs) with the 15-02 rules and expects nothing, pins the detection to exactly 5 elapsed-time and 7 raised-timeout files with lane membership ignored, proves the manifest, worker caps, CI line and flaky gate are wired, and does so with a rules module that finally sees Prettier-wrapped wait chains; 8 mutants (7 planned + the Task 1 plant) each turn exactly the intended test red.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-11-09T08:17:12Z
- **Completed:** 2026-11-09T08:35:00Z
- **Tasks:** 2 (plus the orchestrator-amended rules fix as a TDD pre-step)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **Rules fix first (orchestrator amendment 2).** `scripts/lib/test-lane-rules.mjs` gained `calleeName(e, sf)`: it joins the identifier/property chain from the AST and falls back to whitespace-stripped source text for call-rooted chains. `vitestRaiseSites`, `playwrightTimeoutFindings`, `retryFindings` and `elapsedTimeFindings` all compare against it; no `getText()` callee comparison remains. 10 planted cases were added to `scripts/test-lane-rules.test.ts` (wrapped `expect.poll`, `expect.element`, `vi.waitFor`, identifier value, default value negative, wrapped `vi.setConfig`, serial-lane annotation on a wrapped chain, wrapped `describe.configure` timeout and retries, wrapped `test.setTimeout`). RED: 7 of 10 failed on the old module (the three that passed did so only through the generic `{ timeout }` fallback branch). GREEN: 126/126; the 116 pre-existing tests are untouched and green.
- **Repo sweep (Task 1).** `scanFile` over `git ls-files -z --cached --others --exclude-standard` returns `[]`; the failure message lists `path:line rule detail`. Coverage pins: >= 300 `vitest-test` (365 today), >= 40 `playwright` (116), every `vite|vitest|playwright*.config.ts` git lists is scanned (15, set-equal), the seven named configs, the three package.json files and `ci.yml`.
- **Non-vacuity (Task 1).** With lane membership ignored, `elapsedTimeFindings` finds exactly `EXPECTED_ELAPSED` (5 files) and `vitestTimeoutFindings` with `serial: false` finds exactly `EXPECTED_RAISES` (7 files, ResultsView included through its wrapped `.poll(..., { timeout: LAZY_MAP_MS })`, which the old module could not see). Every pinned file is in the serial lane, and `core + web + web-browser` hold exactly the 11 distinct pinned files.
- **Manifest, worker caps, CI and flaky gate (Task 2).** `describe('lane manifest')`, `describe('worker caps')`, `describe('CI and flaky gate')`: literal existing paths in one lane each (>= 17 entries); each lane's serial config contains `serialTest('<lane>')` and the sibling `files('<lane>')`; `serialTest(lane)` yields `name`, `include === files(lane)`, `fileParallelism: false`, `maxWorkers: 1`, `sequence.groupOrder === SERIAL_GROUP_ORDER[lane]`, every order > 0, `web-browser` strictly greatest; the root `projects` array (TypeScript AST) is string literals only, unique, and lists the four serial configs; `maxWorkers: MAX_WORKERS` + `process.env.VITEST_MAX_WORKERS` in the root; both browser configs carry the cap; `MAX_WORKERS` is a positive integer; Playwright `workers: process.env.CI ? 2 : 4` / `workers: 1`; exactly one `run: pnpm test:unit`; exactly one `run:` line with `--fail-on-flaky-tests` and it runs `playwright test`; `test:unit === 'vitest run'`; both Playwright configs contain `failOnFlakyTests: !!process.env.CI` and `Retry policy (TEST-03)`.
- **Full chain green:** `pnpm test:unit` 365 files / 7175 tests / 123.51 s exit 0; `pnpm check` 0 errors (web 3271 files, extension 1079); `pnpm lint` exit 0; `pnpm banned` 454 files; `pnpm ui:guard` 81 files.

## Task Commits

1. **Pre-step RED: planted wrapped-chain tests** - `17be9f2` (test)
2. **Pre-step GREEN: calleeName() in the rules module** - `70da4bf` (fix)
3. **Task 1: repo sweep + non-vacuity pins** - `b7a50f1` (test)
4. **Task 2: manifest integrity, worker-cap and CI pins** - `a704795` (test)

**Plan metadata:** see the final docs commit.

## Files Created/Modified

- `scripts/test-lanes.test.ts` (326 lines, 16 tests) - the guard: sweep, non-vacuity A/B/C, lane manifest, worker caps, CI and flaky gate
- `scripts/lib/test-lane-rules.mjs` - `calleeName()`; all callee comparisons use it; header comment states the rule
- `scripts/test-lane-rules.test.ts` - two new describe blocks (`vitestTimeoutFindings on Prettier-wrapped wait chains`, `playwright rules on Prettier-wrapped chains`), 10 tests

## Guard runtime (Pitfall 10)

Measured in the full `pnpm test:unit --reporter=dot --reporter=json --outputFile.json=.tools/test-evidence/15-09-unit.json` (08:27:32Z to 08:29:39Z, exit 0, 365 files, 7175 tests, `Duration 123.51s`; 16-CPU Windows 11 dev box, this executor the only agent, user's Chrome/VS Code/local LLM server active).

| Test (scripts/test-lanes.test.ts) | Duration |
|---|---|
| every rule reports nothing across all tracked and untracked-not-ignored files | **1877 ms** |
| A: the elapsed-time rule finds exactly the expected files | 424 ms |
| B: with every file forced out of the serial lane, the raise rule finds exactly the expected files | 336 ms |
| the other 13 tests | <= 4 ms each |
| file wall time | 2.66 s |

Isolated run (`--project scripts scripts/test-lanes.test.ts`): sweep 1126-1189 ms, A 244 ms, B 235 ms. **Max test 1877 ms < 2500 ms threshold (37.5% of the 5 s node default), so the file stays in the parallel `scripts` project and `tooling/vitest/lanes.ts` is unchanged.** If a future full-load run shows the sweep above 2.5 s, move it to `SERIAL.scripts` with reason `'repo sweep parses ~520 files: <n> s under full load'`.

## Mutation ledger

Each mutant applied with `sed`/`node` on the committed tree, the guard run with `pnpm vitest run --project scripts scripts/test-lanes.test.ts`, then restored with `git checkout` (tree clean after each). Baseline: 16/16.

| # | Mutant | Result |
|---|---|---|
| 1 | remove `'scripts/vitest.serial.config.ts'` from root `projects` | red (`the root projects array is string literals only and lists the four serial configs`, 1 failed / 15 passed) -> restored green |
| 2 | rename `SERIAL.scripts` `precommit.test.ts` -> `precommit-missing.test.ts` | red (`every SERIAL entry is a literal path to a file that exists, listed in exactly one lane`, 1/15) -> restored green |
| 3 | `retries: process.env.CI ? 2 : 0` in apps/web/playwright.config.ts | red (sweep: `apps/web/playwright.config.ts:26 retry retries: process.env.CI ? 2 : 0 (pinned: process.env.CI ? 1 : 0)`, 1/15) -> restored green |
| 4 | `--retries=1` appended to root package.json `test:e2e` | red (sweep: `package.json:25 retry script "test:e2e": ...`, 1/15) -> restored green |
| 5 | delete the `Cause:` line above `testTimeout: 60_000` in scripts/vitest.serial.config.ts | red (sweep: `scripts/vitest.serial.config.ts:16 unannotated-raise testTimeout 60000 > 5000 without measured+cause comment`, 1/15) -> restored green |
| 6 | `{ timeout: 10_000 }` on `expect.poll` in the parallel apps/web/src/lib/data/rerender.browser.test.ts | red (sweep: `rerender.browser.test.ts:140 raised-timeout-outside-serial expect.poll timeout 10000 > 1000` and non-vacuity B, 2 failed / 14 passed) -> restored green |
| 7 | root `projects` serial entry -> inline `{ test: { name: 'x' } }` | red (`the root projects array is string literals only ...`, 1/15) -> restored green |

Task 1 acceptance mutant: `const t0 = performance.now();` appended to `packages/brand/src/brand-color.test.ts` -> red (sweep: `packages/brand/src/brand-color.test.ts:145 elapsed-time performance.now()` and non-vacuity A, 2 failed / 3 passed at the Task 1 stage) -> restored green.

Rules-module RED/GREEN (pre-step): 7 of the 10 planted wrapped-chain tests failed at `17be9f2`, 126/126 at `70da4bf`.

## Decisions Made

- **Guard stays parallel** (numbers above).
- **`calleeName()` from the AST, fallback to collapsed text.** The orchestrator offered "collapse whitespace or build from the AST chain"; the AST chain is exact for every identifier/property callee (`expect.poll`, `vi.waitFor`, `test.describe.configure`) and the collapsed-text fallback keeps the detail labels readable for call-rooted chains (`expect(loc).toBeVisible timeout ...`).
- **Per-lane group order** asserted as the amendment specifies; `maxWorkers: 1` kept (15-08 "For 15-09" item 4).
- **Sweep reads `git ls-files -z`.** NUL separation avoids C-style quoting of paths with spaces or quotes; paths deleted in the working tree but still indexed are skipped (`existsSync`).
- **Non-vacuity C pins the lane total** (11 distinct files across core/web/web-browser) so an extra non-timing file cannot be slipped into those lanes without a visible test edit; the `scripts` lane is duration-based and is pinned by reasons (> 10 chars) rather than by detector.

## Deviations from Plan

### Orchestrator amendments (applied as instructed)

**1. [Amendment 1] Per-lane group order instead of `=== SERIAL_GROUP_ORDER === 1`**
- **Found during:** Task 2 (plan written before 15-08 made `SERIAL_GROUP_ORDER` a map)
- **Fix:** `serialTest(lane).sequence.groupOrder === SERIAL_GROUP_ORDER[lane]`, every value > 0, `web-browser` strictly greater than each node lane
- **Files modified:** scripts/test-lanes.test.ts
- **Committed in:** a704795

**2. [Amendment 2 / Rule 1 - Bug] Rules module blind to Prettier-wrapped chains (15-06 deferred item)**
- **Found during:** pre-step before Task 1 (the sweep would have been vacuous for two of the eight raise sites)
- **Issue:** `WAITS.has(callee.getText(sf))` and `calleeText.endsWith(...)` compared raw source text, so `expect\n\t.poll(...)` was never a wait site
- **Fix:** `calleeName()` (above) used for every callee comparison; 10 planted multi-line cases (RED 7 failed, GREEN 126/126)
- **Files modified:** scripts/lib/test-lane-rules.mjs, scripts/test-lane-rules.test.ts (both outside the plan's `files_modified`, in scope per the amendment)
- **Verification:** real-tree scratch sweep after the fix: 0 findings, exactly 5 elapsed and 7 raise files, ResultsView now in the raise set; `EXPECTED_RAISES` would be 6 entries without the fix
- **Committed in:** 17be9f2 (test), 70da4bf (fix)

---

**Total deviations:** 2 (both orchestrator amendments; amendment 2 is also a Rule 1 bug fix). **Impact on plan:** amendment 2 is load-bearing: without it non-vacuity B would have pinned a 6-file list and the sweep would not guard the two wrapped raises. No scope creep beyond the two named files.

### Plan-shape notes (not deviations)

- The plan allowed `tooling/vitest/lanes.ts` to change "only if Pitfall 10 applies"; it did not apply, so the file is unchanged.
- The plan's interfaces list said the 15-08 serial files might join `EXPECTED_ELAPSED` "if their own source performs such arithmetic"; computed: they do not (they compare timestamps the fixture files emit), so the list is the five Inventory A files, documented in the constant's comment.
- `SERIAL.scripts` has 9 entries, so the manifest test asserts >= 17 total entries (20 today) rather than the 15-01 count of 17.

## Issues Encountered

- An inline `node -e` snippet to read the JSON report lost its `\\` escape in Git Bash; moved to a scratch `.mjs` file. No repo impact.
- The mutant runner's `git status` check reported the uncommitted Task 2 guard as "residue" between mutants; that was the in-progress file itself, not a mutant leftover (verified: only `scripts/test-lanes.test.ts` was modified, and it was committed as a704795 afterwards).

## Known Stubs

None. Every constant in the guard is a live pin against the repo; every test reads real files.

## User Setup Required

None.

## Next Phase Readiness

- **15-10 (evidence):** the guard runs in every `pnpm test:unit`; the serial lane is unchanged (20 files). Shuffled runs keep the guard parallel (file-based projects). Full-suite wall time today 123.51 s with this executor alone.
- **15-11 / CI:** nothing pushed. The guard's CI-side assumptions are only the pinned strings in `ci.yml`, `package.json` and the two Playwright configs.
- **Phase 16 (Vitest 5):** if browser/wait defaults change, `DEFAULTS` in the rules module, the ResultsView comment and `EXPECTED_RAISES` move together; if any serial config is renamed, update `LANES` in the guard.
- **Future contributors:** a new timing test or raise outside the lane fails the sweep with `path:line rule detail`; the fix is to move the whole file into the right `SERIAL` lane with a reason and annotate the raise, never to raise or retry.

## Self-Check: PASSED

- Files: scripts/test-lanes.test.ts, scripts/lib/test-lane-rules.mjs, scripts/test-lane-rules.test.ts FOUND
- Commits: 17be9f2, 70da4bf, b7a50f1, a704795 FOUND in `git log --all`
- Grep criteria: `describe('lane manifest'|'worker caps'|'CI and flaky gate'` = 3; `EXPECTED_ELAPSED|EXPECTED_RAISES` = 6 (>= 4); `ls-files` = 1 with `--others` and `--exclude-standard`; guard 326 lines (>= 120)
- Chain: test:unit / check / lint / banned / ui:guard all exit 0

---
*Phase: 15-load-deterministic-test-lanes*
*Completed: 2026-11-09*
