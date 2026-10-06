---
phase: 07-investor-portal
plan: 07
subsystem: core/finance
tags: [investor, compare, buy-box, quick-metrics, pure, tdd]
requires:
  - phase: 07-05
    provides: analyze(), DealInputs/DealAnalysis, REFERENCE_CASES, BUY_BOX_EXPENSE_BPS, mulBps
  - phase: 07-06
    provides: zipMedianRentForBeds, MarketStatsInput
  - phase: 07-01
    provides: usd, pct, pctTrim, ratio, monthYear, NOT_AVAILABLE
provides:
  - COMPARE_ROWS / MIN_COMPARE / MAX_COMPARE / bestInRow / buildComparison (compare view, INV-03)
  - quickMetrics / meetsTargets / quickBasisLine (buy-box matches, INV-04)
affects: [07 deals compare UI, 07 buy-box match list]
tech-stack:
  added: []
  patterns: [direction-carrying rows, relative 1e-12 tie tolerance, unknown-as-null target checks]
key-files:
  created:
    - packages/core/src/finance/compare.ts
    - packages/core/src/finance/compare.test.ts
    - packages/core/src/finance/quick-metrics.ts
    - packages/core/src/finance/quick-metrics.test.ts
  modified:
    - packages/core/src/finance/index.ts
key-decisions:
  - "Quick-metrics estimated NOI = rent minus the 40% set-aside; listing HOA is NOT added on top (the set-aside is the whole operating-expense load, matching the basis-line copy)"
  - "meetsTargets returns null (not false) when a set target needs an unavailable value, so the UI can say not enough data rather than a false no"
  - "Ties use a relative tolerance: |a-b| <= 1e-12 * max(1,|a|,|b|)"
  - "Basis-line wording extensions: 'all homes' (overall fallback), 'studios' (0 beds), 'homes with 4 or more bedrooms' (4+ bucket), singular '(1 listing)'"
requirements-advanced: [INV-03, INV-04]
duration: ~25min
completed: 2026-10-05
---

# Phase 7 Plan 07: Comparison and Quick Metrics Summary

**Best-in-row deal comparison with per-metric direction and tie marking, plus zero-call buy-box quick metrics (rent-to-price, GRM, estimated cap rate) from cached ZIP median rent with a provenance sentence.**

## Accomplishments

- `buildComparison` yields the 10 UI-SPEC rows in order with formatted values and Highest/Lowest marks; price/rent never marked; nulls display "—" and are never marked; all-equal or fewer than 2 values marks nothing; RangeError outside 2..3 deals.
- A/D/E reference check: cash flow [0], total cash needed [2] Lowest, DSCR/CoC [2], cap/NOI [0], GRM tie [0,2] Lowest, rent-to-price tie [0,2] Highest.
- `quickMetrics` reads rent only through `zipMedianRentForBeds` (no fetch/gateway), whole-dollar rent, null ratios for price <= 0; fast-check property proves no NaN/Infinity.
- `quickBasisLine` produces the exact UI-SPEC sentence; month/listings segments are omitted when unknown.

## Verification

- `corepack pnpm vitest run --project core`: 55 files, 1632 tests green. `@tran/core check` (tsc) clean; eslint clean on touched files.
- Mutation testing (manual sed mutants): flipping GRM/Total cash/DSCR directions, dropping the all-equal rule, zeroing the tie epsilon, dropping the null filter, price guard, expense set-aside, rounding mode, unknown-as-null, and `>=` boundary (after adding a boundary test) all killed. Two equivalent mutants survive by construction: `present.length < 2` -> `< 1` (a single value is also "all equal") and removing the no-targets early return (`every` over an empty list is true).

## Task Commits

1. Task 1 RED `0efeab7` test(07-07): failing comparison tests; GREEN `7727157` feat(07-07): best-in-row comparison
2. Task 2 RED `42ba223` test(07-07): failing quick metrics tests; GREEN `a39971f` feat(07-07): quick metrics from zip median rent

## Deviations from Plan

- Acceptance criterion "compare.ts contains no string `best`" conflicts with the required export name `bestInRow`; interpreted as no user-facing "best" copy. The file has no "best" literal or comment other than the function identifier.
- Added a boundary test (value exactly at target meets it) after mutation testing found the `>=` vs `>` mutant surviving.

## Requirements

INV-03 (compare core) and INV-04 (quick metrics core) advanced; not marked complete (closed at 07-21).

## Known Stubs

None.

## Self-Check: PASSED
