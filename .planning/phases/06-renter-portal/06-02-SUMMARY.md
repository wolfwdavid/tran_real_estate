---
phase: 06-renter-portal
plan: 02
subsystem: core/renter
tags: [renter, fair-rent, affordability, tdd, pure-math]
requires:
  - "@tran/core/renter barrel (index.ts, created by 06-01)"
  - "\"./renter/*\" package export (added by 06-01)"
provides:
  - "@tran/core/renter/fair-rent: SAME_THRESHOLD, SMALL_SAMPLE, LOW_CONFIDENCE_COMPS, MAX_COMPS_SHOWN, BedroomBucket, CompLike, pickBedroomBucket, compareToMedian, sampleCaveat, compareToRange, estimateConfidence, displayComparables, rangeBarScale"
  - "@tran/core/renter/affordability: IncomePeriod, MoneyParse, parseMoneyInput, round25, floor25, RENT_LOW_SHARE, RENT_HIGH_SHARE, DEBT_CHECK_SHARE, AffordabilityInput, AffordabilityResult, affordability, rentFeedback, landlordIncome, moveInCash, sliderMax"
affects: [FairRentCheck UI plan, AffordabilityCalculator UI plan, Phase 10 marketing calculator, 06-07 type unification]
tech-stack:
  added: []
  patterns: ["test-first pure math", "generic passthrough of RentCast rows (T extends BedroomBucket / CompLike)", "thresholds compared on unrounded ratios, percents rounded for display", "mutation-tested boundary rules"]
key-files:
  created:
    - packages/core/src/renter/fair-rent.ts
    - packages/core/src/renter/fair-rent.test.ts
    - packages/core/src/renter/affordability.ts
    - packages/core/src/renter/affordability.test.ts
  modified:
    - packages/core/src/renter/index.ts
decisions:
  - "UI-SPEC wins over RESEARCH: 'same' is |d| < 2% (strict), so exactly 2% reads above/below"
  - "rangeBarScale uses the UI-SPEC general form [min(low, asking) * 0.95, max(high, asking) * 1.05]; pos returns 0 when the span is 0 (no divide-by-zero)"
  - "pickBedroomBucket only falls back (exact:false) when bedrooms exceed every bucket; a missing middle bucket is null, never a guessed neighbour"
  - "displayComparables never matches on a blank subject id/address; sort is non-mutating with null distance last"
  - "parseMoneyInput: blank -> null, symbols-only or exponent ('$', '1e5') -> invalid, leading '-' -> negative; never NaN"
  - "affordability treats non-finite/negative debts and savings as 0; returns null for null/NaN/<=0 income"
  - "BedroomBucket and CompLike declared locally with TODO(06-07) to unify with renter/types.ts (types.ts had no equivalents)"
metrics:
  duration: "~10 min"
  completed: 2026-10-05
  tasks: 2
  files: 5
---

# Phase 6 Plan 02: Fair-rent and affordability math Summary

Neutral fair-rent comparison math (median direction with a strict under-2% "same" band, bedroom-bucket pick, small-sample caveat, estimate range position, low-confidence rule, subject-excluded nearest-10 comparables, range-bar scale) and the UI-SPEC 25/30/40 affordability model with money-input parsing. Both are pure TypeScript with no I/O, built test-first in `@tran/core/renter`.

## What was built

- **`fair-rent.ts`** (RENT-06, Tier 1 and Tier 2). `compareToMedian` returns `above` / `below` / `same` plus a whole-number percent. 2030 vs 2000 gives `same` with percent 2, and 2040 vs 2000 gives `above`. `pickBedroomBucket` labels the fallback to the highest bucket with `exact: false`. `displayComparables` removes the subject by id or by normalized address and reports `subjectIncluded`. The module contains no valuation words (checked by grep and by the 06-05 banned-terms ESLint rule).
- **`affordability.ts`** (RENT-08). `affordability()` returns the 25%-30% band capped by `max(0, 40% of M - debts)`, rounded to $25, plus the `onlyTop` and `debtsNote` flags and `savingsCoverRentUpTo`. `rentFeedback` compares unrounded ratios, so 30.4% displays as 30 but counts as above 30%, while exactly 30% and exactly 40% stay below each threshold. `sliderMax`, `landlordIncome` (×40) and `moveInCash` (×2) are included. The file has no imports, so Phase 10 can reuse it as is.
- **Barrel:** appended `export * from './fair-rent.js'` and `'./affordability.js'` to the shared `renter/index.ts`.

## Verification

- `corepack pnpm vitest run --project core packages/core/src/renter`: 9 files, 163 tests pass (34 fair-rent and 25 affordability are mine).
- `corepack pnpm --filter @tran/core check`: clean. Earlier errors came only from sibling RED tests that had not landed yet.
- ESLint and Prettier are clean on all four files.
- Acceptance greps: no `import` in affordability.ts. No overpriced, underpriced, good deal or bargain in fair-rent.ts.
- **Mutation testing** (per the memory guidance). The suite killed 8 of 8 fair-rent mutants (`<`→`<=` on the 2% threshold, the small-sample threshold, the 3-comp threshold and the range edge; dropping the 10-row cap; dropping address matching; a broken bucket fallback; dropping address normalization) and 11 of 11 affordability mutants (`>`→`>=` on the 30% and 40% checks, the onlyTop and debtsNote comparisons, removing the 0 floor, removing the debt-check cap, removing the 10,000 slider floor, ceil→round on the slider, floor25→round25 on savings, comparing rounded instead of unrounded ratios, and a missing ÷12).

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 RED | 35e06ed | test(06-02): add failing fair-rent tests |
| 1 GREEN | e4e4a00 | feat(06-02): fair-rent comparison math |
| 2 RED | 414fdff | test(06-02): add failing affordability tests |
| 2 GREEN | 0fdc71e | feat(06-02): affordability math |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `parseMoneyInput('$')` returned null instead of an error**
- **Found during:** Task 2 GREEN
- **Issue:** Stripping `$` before the blank check made symbol-only input look like an empty field.
- **Fix:** The blank check now runs on the raw string, so `'$'` is `{ error: 'invalid' }`.
- **Files modified:** packages/core/src/renter/affordability.ts
- **Commit:** 0fdc71e

**2. [Rule 2 - Correctness] Edge-case hardening beyond the listed bullets**
- `rangeBarScale` guards a zero span. `displayComparables` never treats a blank subject id or address as a match and does not mutate its input. `affordability` treats non-finite or negative debts and savings as 0. Each guard has a test.

Other notes:
- A sibling executor ran Prettier over `fair-rent.test.ts` between RED and GREEN. The change was whitespace only, and the reformatted file was committed with GREEN.
- Import paths: the plan names `@tran/core/renter/fair-rent` and `@tran/core/renter/affordability`. These resolve through the `"./renter/*"` export that 06-01 added, and the barrel is available as `@tran/core/renter`.

## Requirements advanced

- **RENT-06** (fair-rent check), core math only. The UI and copy plans still need to render it.
- **RENT-08** (affordability calculator), core math only.
- Neither is marked complete. Both stay open until the 06-22 gate.

## Known Stubs

None.

## Self-Check: PASSED
