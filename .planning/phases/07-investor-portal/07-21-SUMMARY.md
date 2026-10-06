---
phase: 07-investor-portal
plan: 21
subsystem: testing
tags: [investor, e2e, playwright, budget, phase-gate, validation, mutation-ledger]
requires:
  - phase: 07-investor-portal
    provides: "07-01..07-20 investor portal (finance core, numeric post-check, analyzer, autofill, deals/compare, buy boxes, markets, memo, print, overview + sweep)"
provides:
  - "demo.spec.ts: keyless composed journey with zero external requests; mocked-key journey spending exactly 6 RentCast calls"
  - "Walked 07-VALIDATION.md (57 rows green, gate results, phase mutation ledger, nyquist_compliant, approved)"
  - "07-HUMAN-UAT.md owner runbook (I1-I13, S1-S2, non-blocking)"
  - "README investor portal section; INV-01..06 complete"
  - "Root fix: autofill buttons render only once the data runtime's source exists (investor port source())"
affects: [08-agent-crm, 09-agent-ai, verify-work]
tech-stack:
  added: []
  patterns:
    - "Gate the render of cost-labelled buttons on the runtime source and key them on it, so a late runtime start re-mounts them"
    - "E2E that leaves a page after a background check waits for the stored result, not for the mock's request count"
key-files:
  created:
    - apps/web/tests/e2e/investor/demo.spec.ts
    - .planning/phases/07-investor-portal/07-HUMAN-UAT.md
  modified:
    - apps/web/src/lib/features/investor/analyzer/AnalyzerForm.svelte
    - apps/web/src/lib/features/investor/data/investor-port.ts
    - apps/web/src/lib/features/investor/data/investor-port.test.ts
    - apps/web/tests/e2e/investor/autofill.spec.ts
    - apps/web/tests/e2e/investor/buybox.spec.ts
    - .planning/phases/07-investor-portal/07-VALIDATION.md
    - .planning/phases/07-investor-portal/deferred-items.md
    - .planning/REQUIREMENTS.md
    - README.md
key-decisions:
  - "AutofillButton race fixed at the root: AnalyzerForm reads port.source() (exposed through the investor port, keeping features/investor on its single $lib/data adapter) and keys the buttons on it"
  - "Print re-check that cannot see notes-only numbers (07-19) stays fail-closed and goes to owner sign-off (07-HUMAN-UAT S2) instead of a phase-gate code change"
  - "07-12's unspecced save message goes to owner sign-off (07-HUMAN-UAT S1)"
requirements-completed: [INV-01, INV-02, INV-03, INV-04, INV-05, INV-06]
duration: ~95min (two executors; the first was terminated by a server error after 5 commits)
completed: 2026-10-06
---

# Phase 7 Plan 21: Investor portal phase gate Summary

**Keyless investor journey proven at zero external requests and the keyed journey at exactly 6 RentCast calls, a late-runtime autofill race fixed at its root, all 57 validation rows walked green, and `corepack pnpm verify` exit 0 in 600 s.**

## Performance

- **Duration:** about 95 min across two executors (the first was terminated by a server error mid-plan after its five commits; the second finished the gate)
- **Completed:** 2026-10-06
- **Tasks:** 2 of 2
- **Files modified:** 11

## Accomplishments

- `demo.spec.ts` (84db8b6): the keyless flow (analyze → sample deal → autofill (0 calls · sample data) → save twice → compare 2 → buy box in a sample metro → Load ZIP rents → Deep analyze → watch a sample ZIP → dashboard charts → memo "Number check passed" → print `[data-ready]`) asserts `toEqual([])` on every RentCast and AI host request. The mocked-key flow asserts rent AVM 2, value AVM 2, sale listings 1, markets 1 and `toBe(6)`, and the count stays 6 after reloading every visited page. 4/4 green (2 per base).
- Root fix for the AutofillButton late-runtime race (33ecefa RED, 43c2a28 + 0769526 GREEN): the cost label was missing when the data runtime started after the analyzer mounted. The buttons now render only once `port.source()` is non-null and are keyed on it.
- buy-box "app open checks a due buy box once" flake fixed (477beae): the test now waits for the overview's "new match since your last visit" line instead of leaving when the request is counted, which used to abort the in-flight check.
- 07-VALIDATION.md walked: every row run with its own command after the gate, all 57 green on the first run. It now has a gate-results section, a phase mutation ledger, `status: verified`, `wave_0_complete: true`, and approval dated 2026-10-06.
- 07-HUMAN-UAT.md: 13 owner checks (real RentCast key, real AI key, real browsers' print, real phones, screen readers, deployed CSP) and 2 sign-off items. `blocking: false`.
- README: investor portal section, a 24-page routes table, and Dexie v5 backup tables. INV-01..06 are ticked in REQUIREMENTS with Complete in the traceability table.

## Gate figures

| Gate | Result |
|------|--------|
| `corepack pnpm install --frozen-lockfile && corepack pnpm verify` | install exit 0; verify **exit 0 in 600 s** in one invocation |
| check | svelte-check 2317 files, 0 errors / 0 warnings; core + brand tsc clean |
| test:unit | 214 files, **4140 tests** passed |
| build:root / build:sub + csp:assert | 25 HTML files per base (24 pages + 404.html) |
| test:e2e | **1062 passed**, 2 skipped, 0 flaky (7.2 min) |
| Investor E2E | 150 (75 per base): routes 48, analyze 22, autofill 16, markets 16, buybox 12, memo 10, print 8, deals 6, demo 4, overview 4, sweep 4 |
| guard / fixtures:check / secrets | 1238 files / 6 files / canary detected, 720 commits, no leaks; actionlint clean |

No known flake fired in this run: `precommit.test.ts`, the Vitest libuv crash and renter `ResultsView.browser` all passed first time.

## Task Commits

1. **Task 1: Demo-credibility and budget E2E** (previous executor)
   - `33ecefa` test(07-21): add failing test for the autofill cost label when the data runtime starts late
   - `43c2a28` fix(07-21): autofill buttons wait for the data runtime
   - `477beae` test(07-21): buy-box app-open check waits for the stored result before leaving the overview
   - `84db8b6` test(07-21): demo and budget E2E
   - `0769526` fix(07-21): analyzer reads the data source through the investor port
2. **Task 2: Full gate, validation walk, README and requirement status**
   - `9340d25` docs(07-21): verify investor portal and close INV-01..06

## Phase 7 mutation ledger

The full table is in 07-VALIDATION.md under "Mutation proofs". Summary: 07-01 (1), 07-02 (14/14), 07-03 (1), 07-05 (18/18), 07-06 (4/4), 07-07 (all behavioural killed; **2 equivalent no-op mutants survive by construction**: `present.length < 2` → `< 1`, and removing the no-targets early return), 07-08 (5/5), 07-09 (6/6), 07-10 (10/10), 07-14 (10/10), 07-16 (3/3), 07-18 (1), 07-20 (1), and 07-21's two pre-fix states (late-runtime autofill red before 43c2a28; the app-open flake under `--repeat-each 3`). Nothing was committed in a mutated state.

## Phase notes carried forward

- **07-01:** two runed versions resolve (0.37.1 for the app and layerchart, 0.35.1 pinned by bits-ui 2.19.2 itself). No override, by design.
- **07-09:** the market mapper reads per-month `dataByBedrooms`, so `gen-fixtures.mjs` regenerates per-month bedroom fixtures (`fixtures:check` green, 6 files).
- **07-12:** the unspecced save message "Enter a purchase price and monthly rent before saving." goes to owner sign-off as 07-HUMAN-UAT S1.
- **07-19 known limitation:** the print re-check cannot see numbers that appear only in the notes, so it fails closed. Owner sign-off as S2.
- **07-20 root fixes (3):** the memo printout scrolled sideways at 375px with text spacing; "Check now (0 calls · sample data)" overflowed the buy-box card; the buy-box form's cost label was missing on a late runtime.
- **History rewrite:** the orchestrator rewrote history to strip 20 co-author trailers. The tree is identical before and after.
- **Carried debt (unchanged, out of scope):** tailwind-merge font-size collision; duplicate card ids on the renter Map tab.
- **Known flakes (none fired this run):** `precommit.test.ts` on a HEAD move (re-run once); the Vitest libuv crash (`--no-file-parallelism`); renter `ResultsView.browser` under full load (re-run alone).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Autofill cost label missing when the data runtime starts late**
- **Found during:** Task 1 (`tests/e2e/investor --repeat-each 3`, 438 runs)
- **Issue:** AutofillButton mounted before the runtime's gateway existed and never picked up the cost label.
- **Fix:** AnalyzerForm renders each button only once `port.source()` is non-null, keyed on it. `source()` is exposed through the investor port so `features/investor` keeps its single `$lib/data` adapter.
- **Files modified:** AnalyzerForm.svelte, investor-port.ts (+ test), autofill.spec.ts
- **Commits:** 33ecefa, 43c2a28, 0769526

**2. [Rule 1 - Bug] buy-box app-open E2E aborted its own check**
- **Found during:** Task 1 (same repeat run)
- **Fix:** wait for the stored result's overview line before navigating away. 10/10 on repeat.
- **Files modified:** buybox.spec.ts
- **Commit:** 477beae

**3. [Process] Executor restart.** The first executor was terminated by a server error after its five commits. The second executor kept its uncommitted HUMAN-UAT, README and deferred-items drafts, ran the full gate, walked the map, and committed them in 9340d25.

## Known Stubs

None.

## User Setup Required

None for automation. Owner-gated live checks are in `07-HUMAN-UAT.md` and are non-blocking.

## Next Phase Readiness

Phase 7 is verified end to end. The shared markets and print components and `packages/core/src/numbers/` are ready for Phases 8 and 9 to reuse.

## Self-Check: PASSED
