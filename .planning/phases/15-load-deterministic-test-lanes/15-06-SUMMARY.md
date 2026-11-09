---
phase: 15-load-deterministic-test-lanes
plan: 06
subsystem: testing
tags: [vitest, timeouts, annotations, serial-lane, measurement, browser-mode]

# Dependency graph
requires:
  - phase: 15-load-deterministic-test-lanes
    provides: 15-01 lane manifest and the web-serial / web-browser-serial projects; 15-02 rules module (MEASURED and CAUSE regexes, hasAnnotation placement)
  - phase: 14-launch-audit
    provides: apps/web/test-results/vitest.json full-parallel durations (the full-load sample for every annotation)
provides:
  - Every raised Vitest timeout in the 7 web serial-lane files annotated with two serial-lane measurements, a full-load measurement and a root cause
  - ResultsView.browser.test.ts states the real 15 s browser-mode default; TEST_MS and the describe timeout option are gone
  - Zero unannotated-raise, raised-timeout-outside-serial and elapsed-time findings across all 363 Vitest files (the static condition 15-09 enforces)
  - A documented gap in the rules module (multi-line expect.poll chains) for 15-09, in deferred-items.md
affects: [15-09, 15-10, 16-vitest-5-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Timeout annotation = two lines directly above the raise site (const declaration, option property or statement): 'Timeout: measured <a> s ... (<date>) and <b> s under full parallel load (<source>).' then 'Cause: <slow work>. <value> keeps a <ratio>x margin ...; default is <default>.'"
    - "A raised test timeout is removed, not annotated, when every test in the file measures <= one third of the lane default in both serial runs and the full-load report"

key-files:
  created: []
  modified:
    - apps/web/src/lib/features/renter/search/ResultsView.browser.test.ts
    - apps/web/src/lib/features/renter/outreach/OutreachSection.browser.test.ts
    - apps/web/src/lib/features/shared/data/GatewayError.browser.test.ts
    - apps/web/src/lib/components/tools/calculators.browser.test.ts
    - apps/web/src/lib/storage/agent/import-commit.test.ts
    - apps/web/src/lib/seo/og-card.server.test.ts
    - apps/web/src/lib/features/studio/boundaries.test.ts
    - .planning/phases/15-load-deterministic-test-lanes/deferred-items.md

key-decisions:
  - "ResultsView TEST_MS removed: every test measured <= 2.56 s in both serial runs and 2.64 s in the 14-11 report (3.3 s in the 15-RESEARCH run), all under one third of the 15 s browser default; LAZY_MAP_MS stays and is annotated"
  - "The 14-11 launch-audit vitest.json (2026-11-06 full parallel run) is the full-load source for every site; the 15-01 order-run JSON is reported alongside for context"
  - "The rules module's blindness to Prettier-wrapped expect.poll chains is logged for 15-09, not fixed here: the module is 15-02's file with its own planted tests, and the plan's scope is the seven test files"

patterns-established:
  - "Measurement provenance in annotations: serial-lane numbers carry the date and 'loaded dev box'; full-load numbers name their source file"

requirements-completed: [TEST-02, TEST-01]

# Metrics
duration: 13min
completed: 2026-11-09
---

# Phase 15 Plan 06: Annotate serial-lane timeouts Summary

**Every remaining raised Vitest timeout in the seven web serial-lane files now carries two serial-lane measurements taken today, a full-load measurement from the 14-11 report and a root cause; ResultsView drops its 20 s describe timeout (all tests <= 2.64 s against a 15 s browser default, not the 5 s the old comment claimed), and the 15-02 rules report zero findings across all 363 Vitest files.**

## Performance

- **Duration:** 13 min (07:46:58Z to about 08:00Z)
- **Started:** 2026-11-09T07:46:58Z
- **Completed:** 2026-11-09T08:00:00Z
- **Tasks:** 2
- **Files modified:** 8 (7 test files + deferred-items.md)

## Accomplishments

- Both serial-lane runs green before any edit: `Test Files 7 passed (7)`, 89 tests, exit 0, 29.39 s and 29.68 s; no browser-startup failure in either run.
- Seven files annotated; six of them with comment-only diffs (`git diff -U0` shows no non-comment line; the timeout literal sets are unchanged). ResultsView loses `TEST_MS` and `{ timeout: TEST_MS }` per the planning-time rule.
- `node .tools/test-evidence/15-06-check.mjs`: `363 Vitest files scanned, 0 findings`, exit 0 (was 6 findings before the edits).
- Verification after the edits: `pnpm vitest run --project web-serial --project web-browser-serial --project web --project web-browser` = 217 files / 2956 tests, exit 0 (132.43 s); `pnpm check` = 0 errors; Prettier and ESLint clean on all seven files.

## Task Commits

1. **Task 1: Measure the serial-lane files and collect full-load numbers** - no committed files (evidence in `.tools/test-evidence/15-06-serial-1.json`, `15-06-serial.json`, `15-06-serial-*.log`, gitignored)
2. **Task 2: Annotate the 7 files** - `ad645d9` (test: the six files) + `4c2c0ca` (fix: ResultsView browser-default comment)

**Plan metadata:** see the final docs commit.

## Measured durations

Machine: 16 logical CPUs, Windows 11, Git Bash. **Four sibling executor agents (15-04, 15-05, 15-07, 15-08) were running Vitest and Playwright suites on the same machine throughout both serial runs**, plus the user's Chrome, VS Code and a local `mesh-llm` server; treat the absolute numbers as "loaded dev box". Commands (repo root, `MSYS_NO_PATHCONV=1 VITE_CONFIG_NATIVE_IGNORE_WARNING=true corepack.cmd pnpm ...`):

- Run 1: `vitest run --project web-serial --project web-browser-serial --reporter=default --reporter=json --outputFile.json=.tools/test-evidence/15-06-serial-1.json` (07:47:13Z, exit 0, 7 files / 89 tests, Duration 29.39 s)
- Run 2: same with `--outputFile.json=.tools/test-evidence/15-06-serial.json` (07:48:28Z, exit 0, 7 files / 89 tests, Duration 29.68 s)
- Full-load column: `apps/web/test-results/vitest.json` (14-11 launch audit, full parallel `vitest run` of 2026-11-06). The 15-01 order-run JSON (`15-01-order.json`, 2026-11-09 full run with lanes) is shown for context.
- Extraction: a Node script over `testResults[].assertionResults[].duration`, matching each file by path suffix (scratch `durations.mjs`).

Rows are the tests governed by a raise (every test under a describe-level or file-level raise, the single test for the trailing-arg and wait-level raises), plus the file maximum.

| File | Test | Serial run 1 (s) | Serial run 2 (s) | 14-11 report (s) | 15-01 order run (s) | Research / 10-23 (s) |
|---|---|---|---|---|---|---|
| ResultsView.browser | pages locally and moves focus to the first new card (60 cards + axe) | 2.52 | 2.56 | 2.64 | 3.13 | 3.3 full load; 1.4 alone / 3.9 in 321-file run (old comment) |
| ResultsView.browser | switches tabs with the arrow keys, mounts the map once and never spends (LAZY_MAP_MS poll) | 0.69 | 0.63 | 0.88 | 0.40 | - |
| ResultsView.browser | shows the filtered-empty state and clears filters for free | 0.13 | 0.12 | 0.15 | 0.09 | - |
| ResultsView.browser | **file max** | **2.52** | **2.56** | **2.64** | 3.13 | 3.3 |
| OutreachSection.browser | a listing without an email shows the no-recipient note and a bare mailto (draftAndWait) | 4.48 | 4.23 | 4.20 | 4.43 | 4.4-5.5 under load |
| OutreachSection.browser | the office email is the fallback recipient (draftAndWait) | 4.28 | 4.34 | 4.60 | 4.57 | 4.4-5.5 under load |
| OutreachSection.browser | keyless, Draft message streams the sample draft to a mailto for the listing email (draftAndWait) | 4.26 | 4.33 | 4.42 | 4.32 | 4.4-5.5 under load |
| OutreachSection.browser | **file max** | **4.48** | **4.34** | **4.60** | 4.57 | 5.5 |
| GatewayError.browser | rate-limit countdown: disabled countdown, start/end announcements, never auto-retries (expect.element 4 s) | 2.10 | 2.08 | 2.27 | 2.12 | - |
| calculators.browser | cap rate: empty state, example figures, one debounced announcement, clear (expect.poll 2 s) | 1.12 | 1.12 | 1.72 | 1.07 | - |
| import-commit | commits a 5000-lead plan in one call (trailing 30 s) | 1.10 | 1.15 | 1.43 | 0.76 | - |
| og-card.server | renderOgCard: slowest case (default card keeps text out of the right padding and off the mark) | 0.48 | 0.50 | 0.86 | 0.34 | - |
| og-card.server | renderOgCard: **max over the 10 cases** | **0.48** | **0.51** | **0.86** | 0.38 | - |
| boundaries | features/studio never reaches features/investor, features/agent/crm or lib/leads | 1.06 | 1.16 | 0.68 | 0.75 | 1.9 alone with 40 burners; 2.5 full run (10-23) |
| boundaries | the snapshot print route never reaches lib/data (only the store-schema leaf) | 0.22 | 0.18 | 0.18 | 0.15 | - |
| boundaries | the snapshot print route never reaches the investor portal or the agent CRM | 0.09 | 0.10 | 0.10 | 0.04 | - |
| boundaries | **file max** | **1.06** | **1.16** | **0.68** | 0.75 | 2.5 |

File wall times (start to end of the file, serial run 1 / run 2 / 14-11): ResultsView 3.34 / 3.31 / 3.67 s; OutreachSection 14.34 / 14.20 / 15.00 s; GatewayError 2.74 / 2.72 / 3.23 s; calculators 1.62 / 1.66 / 2.58 s; import-commit 1.27 / 1.33 / 1.61 s; og-card 3.29 / 3.33 / 3.56 s; boundaries 1.40 / 1.49 / 0.98 s.

### Cause facts recorded for the annotations

| Site | Fact | Source |
|---|---|---|
| GatewayError countdown | `retryInMs: 2000` -> `Math.ceil(2000 / 1000)` = 2 s, one `setInterval` tick per `1000` ms, "Try again" enables at 0 | `apps/web/src/lib/features/shared/data/GatewayError.svelte:69-82` |
| calculator announcement debounce | `ANNOUNCE_DELAY_MS = 750` ms after the last change, then `announce()` sets the text on the next animation frame | `apps/web/src/lib/components/tools/calculator-form.svelte.ts:17` (used at `:116`); `apps/web/src/lib/components/a11y/announcer.svelte.ts:25-33` |
| OutreachSection sample draft | keyless fixture provider streams word by word with `sleep(20 + Math.floor(random() * 41))` ms per word (20-60 ms) | `apps/web/src/lib/ai/providers/fixture.ts:62-66` |
| og-card rasteriser | `Resvg` from `@resvg/resvg-js`, 1200x630, two renders per case (with and without fonts) plus one at collection | `apps/web/src/lib/seo/og-card.server.ts:5`; test `:101-102, :129-130` |
| ResultsView map | two chained dynamic imports (ListingMap, then Leaflet and its CSS) transformed on first open | existing in-test comment at `ResultsView.browser.test.ts:112-114` |

## ResultsView decision

**TEST_MS removed.** The planning-time rule was: remove `TEST_MS` and the `{ timeout: TEST_MS }` describe option if, and only if, every ResultsView test is <= 5 s in both serial runs AND the 14-11 report. Measured maxima: 2.52 s (run 1), 2.56 s (run 2), 2.64 s (14-11), all from the 60-card paging test; the 15-01 order run showed 3.13 s and the 15-RESEARCH full run 3.3 s. All are under one third of the 15 s browser-mode default, so the describe is now `describe('ResultsView', () => {` with a comment stating the 15 s default and the measured numbers. `LAZY_MAP_MS = 10_000` stays (an `expect.poll` wait whose default is 1 s) and is annotated with 0.69 s / 0.63 s serial and 0.88 s full-load for the whole map test. `grep -c "5 s default"` = 0; `grep -c "15 s"` = 1; `grep -c TEST_MS` = 0.

## Per-file annotations

| File | Raise | Placement | Numbers cited | Cause (short) |
|---|---|---|---|---|
| ResultsView.browser.test.ts | `LAZY_MAP_MS = 10_000` (`expect.poll` at the map test) | above the `const` | 0.69 s / 0.63 s serial; 0.88 s 14-11; 11x margin | lazy ListingMap + Leaflet chunks transformed on first open; poll default 1 s |
| ResultsView.browser.test.ts | (removed) `TEST_MS = 20_000` describe timeout | comment above `describe('ResultsView', ...)` | 2.56 s serial; 2.64 s 14-11; 3.3 s research; 15 s default | no raise needed |
| OutreachSection.browser.test.ts | `vi.waitFor(..., { timeout: 20_000 })` in `draftAndWait` | above the `await vi.waitFor(` statement | 4.48 s / 4.34 s serial; 4.60 s 14-11; 4.4-5.5 s research; 4x margin | sample draft streams one word per 20-60 ms (about 4 s); waitFor default 1 s |
| GatewayError.browser.test.ts | `expect.element(ready, { timeout: 4000 })` | above the `await expect.element` statement | 2.10 s / 2.08 s serial; 2.27 s 14-11 | real 2 s countdown, 1000 ms ticks; 4 s = 2x; element default 1 s |
| calculators.browser.test.ts | `.poll(announcerMessage, { timeout: 2000 })` | above the `await expect` statement | 1.12 s / 1.12 s serial; 1.72 s 14-11 | 750 ms debounce + next frame; 2 s = 2.7x; poll default 1 s |
| import-commit.test.ts | trailing `30_000` on `it('commits a 5000-lead plan in one call')` | above the `it(` statement | 1.10 s / 1.15 s serial; 1.43 s 14-11 | 5000 contacts + 5000 activities via Dexie into fake-indexeddb in one transaction; 30 s = 3x the in-test 10 s budget; node default 5 s |
| og-card.server.test.ts | `describe('renderOgCard', { timeout: 30_000 })` | above the `describe` statement (replaces the old one-liner) | 0.48 s / 0.51 s serial; 0.86 s 14-11; 35x margin | two resvg rasterisations + full pixel scan per case; node default 5 s |
| boundaries.test.ts | `GRAPH_WALK_MS = 30_000` describe timeout | above the `const` (rewritten) | 1.06 s / 1.16 s serial; 0.68 s 14-11; 1.9 s / 2.5 s (10-23); 12x margin | synchronous import-graph walk of src/lib; node default 5 s |

Every annotation is two or more `//` lines with `Timeout: measured <n> s` on one line and the word `Cause` in the block, matching 15-02's `MEASURED` and `CAUSE` regexes at one of `hasAnnotation`'s three sites. Serial-lane numbers are tagged "(2026-11-09, loaded dev box)".

## Rules check (acceptance)

Command (repo root): `node .tools/test-evidence/15-06-check.mjs` (throwaway, gitignored under `.tools/`; imports `SERIAL` from `tooling/vitest/lanes.ts` via Node 24 type stripping, `laneOf` / `vitestTimeoutFindings` / `elapsedTimeFindings` from `scripts/lib/test-lane-rules.mjs`, over `git ls-files -- "*.test.ts" "*.spec.ts"`).

Before the edits (6 findings, exit 1):

```
apps/web/src/lib/features/renter/outreach/OutreachSection.browser.test.ts:64 unannotated-raise vi.waitFor timeout 20000 > 1000 without measured+cause comment
apps/web/src/lib/features/renter/search/ResultsView.browser.test.ts:75 unannotated-raise describe option timeout TEST_MS (non-literal) > 15000 without measured+cause comment
apps/web/src/lib/features/shared/data/GatewayError.browser.test.ts:224 unannotated-raise expect.element timeout 4000 > 1000 without measured+cause comment
apps/web/src/lib/features/studio/boundaries.test.ts:67 unannotated-raise describe option timeout GRAPH_WALK_MS (non-literal) > 5000 without measured+cause comment
apps/web/src/lib/seo/og-card.server.test.ts:100 unannotated-raise describe option timeout 30000 > 5000 without measured+cause comment
apps/web/src/lib/storage/agent/import-commit.test.ts:225 unannotated-raise it trailing timeout 30000 > 5000 without measured+cause comment
[15-06-check] 363 Vitest files scanned, 6 findings
```

After the edits (exit 0):

```
[15-06-check] 363 Vitest files scanned, 0 findings
```

So: zero `unannotated-raise` in the serial files, zero `raised-timeout-outside-serial` and zero `elapsed-time` in the parallel files.

**Gap found (see Issues):** the inventory lists 8 raise sites but the module saw 6. The two Prettier-wrapped `expect\n.poll(...)` chains (ResultsView `LAZY_MAP_MS`, calculators `2000`) are invisible to `WAITS.has(callee.getText(sf))`. Proof that their annotations still satisfy the rule, from a scratch script that collapses the whitespace between `expect` and `.poll` before running `vitestTimeoutFindings`:

```
ResultsView.browser.test.ts   as-written 0 | collapsed 0 | collapsed + annotation stripped 1 [112 expect.poll timeout LAZY_MAP_MS (non-literal) > 1000 ...]
calculators.browser.test.ts   as-written 0 | collapsed 0 | collapsed + annotation stripped 1 [30 expect.poll timeout 2000 > 1000 ...]
```

## Other verification

- `git diff -U0` on the six non-ResultsView files filtered to non-comment lines: empty. Timeout literal sets (`N_000` / 4-digit) identical before and after in all six (GatewayError gains the token `1000` inside the new comment only).
- `grep -lE "Timeout: measured [0-9.]+ (ms|s)"` over the 7 files: 7.
- `pnpm vitest run --project web-serial --project web-browser-serial --project web --project web-browser` (07:53Z-07:55Z): 217 files, 2956 tests, exit 0, Duration 132.43 s. No "Failed to fetch dynamically imported module" or browser-connect failure in any of the three Vitest runs of this plan.
- `pnpm check`: `3271 FILES 0 ERRORS 0 WARNINGS`, exit 0.
- `pnpm lint` first run: exit 1 from Prettier on `scripts/flaky-gate.test.ts` and `scripts/lane-order.test.ts`, both committed by the sibling 15-08 agent during this plan (its `e733310 style(15-08): format lane-order and flaky-gate tests` followed). Prettier `--check` and ESLint on the seven 15-06 files: clean, exit 0. See Issues for the re-run.

## Decisions Made

- **TEST_MS removed** (rule and numbers above).
- **Full-load source = 14-11 `vitest.json`** for every site, since every file has a sample there; research and 10-23 numbers are kept where the old comments or the plan cited them.
- **Rules-module gap logged, not fixed** (deferred-items.md, "15-06: the rules module skips multi-line expect.poll chains"): one-line fix plus a planted test belongs with 15-09's sweep, which otherwise asserts zero findings vacuously for wrapped chains.

## Deviations from Plan

None - plan executed exactly as written. The ResultsView removal is the plan's own conditional branch, taken because its condition held.

## Issues Encountered

- **Rules module misses Prettier-wrapped wait chains** (above). Out of this plan's files; proven harmless for these annotations; handed to 15-09 via deferred-items.md.
- **`pnpm lint` red from sibling files, then green.** The first run (07:56Z) failed on two 15-08 files that were committed mid-run; 15-08 committed a formatting fix afterwards (`e733310`), and the re-run at 08:00:23Z exited 0. None of the seven 15-06 files had a lint or format problem at any point.
- **Loaded machine.** Four sibling agents ran suites throughout; the serial-lane numbers are nevertheless within 2-25% of the 14-11 full-parallel report, and the 29.4 s / 29.7 s lane wall times were stable between the two runs.

## Known Stubs

None. Comment-only changes plus one removed constant.

## User Setup Required

None.

## Next Phase Readiness

- 15-09 (sweep): the static condition holds today (0 findings over 363 files). Land the `WAITS` callee-text fix with a planted multi-line `expect.poll` case before the sweep asserts zero, or two serial-lane raises stay unguarded.
- 15-10 (evidence): serial-lane maxima today: OutreachSection 4.48 s, ResultsView 2.56 s, GatewayError 2.10 s, calculators 1.12 s, boundaries 1.16 s, import-commit 1.15 s, og-card 0.51 s. `web-serial` + `web-browser-serial` alone: 29.4-29.7 s.
- Phase 16 (Vitest 5): if browser-mode defaults change, the ResultsView comment and `DEFAULTS.browserTest` in the rules module must move together.

## Self-Check: PASSED

- Files: the 7 annotated test files, 15-06-SUMMARY.md and deferred-items.md all FOUND on disk; `git diff --stat HEAD -- apps/web/src/lib` empty (annotations fully committed)
- Commits: `ad645d9` (test), `4c2c0ca` (fix) FOUND in `git log --all`
- Checker: `node .tools/test-evidence/15-06-check.mjs` = 0 findings, exit 0 (re-run after the commits)

---
*Phase: 15-load-deterministic-test-lanes*
*Completed: 2026-11-09*
