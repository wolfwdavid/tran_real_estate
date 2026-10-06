---
phase: 07-investor-portal
plan: 06
subsystem: core/markets
tags: [markets, series, price-to-rent, a11y-summaries, watched-zips, fast-check, tdd]
requires:
  - "@tran/core/format (07-01): usd, ratio, monthYear"
  - "./markets subpath export in packages/core/package.json (07-01)"
provides:
  - "@tran/core/markets types: BedroomStat, RentalMonth, SaleMonth, MarketStatsInput, SeriesKey, SERIES_KEYS, SERIES_LABELS, RentSeries, RentTrend, PriceToRent"
  - "@tran/core/markets series: monthRange, rentTrendSeries, priceToRentSeries, hasEnoughData, currentStats, zipMedianRentForBeds"
  - "@tran/core/markets summary: FEW_LISTINGS, timeRangeLine, rentTrendSummary, priceToRentSummary, fewListingsSuffix"
  - "@tran/core/markets watched-zips: MAX_WATCHED_ZIPS = 5, validateZip, addWatchedZip, removeWatchedZip"
affects: [07-09 web markets port, 07-11 chart components, buy-box quick metrics, Phase 9 Market Snapshot]
tech-stack:
  added: []
  patterns: ["integer month-index arithmetic (no Date)", "null gaps, never zero-fill", "non-positive medians treated as missing", "fast-check continuity and cap properties", "mutation-tested formula and limit"]
key-files:
  created:
    - packages/core/src/markets/types.ts
    - packages/core/src/markets/series.ts
    - packages/core/src/markets/series.test.ts
    - packages/core/src/markets/summary.ts
    - packages/core/src/markets/summary.test.ts
    - packages/core/src/markets/watched-zips.ts
    - packages/core/src/markets/watched-zips.test.ts
    - packages/core/src/markets/index.ts
  modified: []
decisions:
  - "Zero or negative medians are treated as missing (null), so a bad RentCast row can never draw a 0 on the chart or divide by zero"
  - "priceToRentSeries spans the union of rental and sale months; a month missing either side is null"
  - "4+ series: listings-weighted mean of medians at 4, 5, 6… when every count is known, otherwise the 4-bedroom entry alone (documented approximation)"
  - "addWatchedZip checks in order invalid, duplicate, limit, so re-adding an already-watched ZIP at 5 reports 'duplicate' (the friendlier message)"
  - "validateZip accepts only a trimmed 5-digit ZIP (ZIP+4 rejected) and rejects 00000, matching location/normalize"
  - "Empty-data copy (not in UI-SPEC): rentTrendSummary returns just the prefix; priceToRentSummary returns 'Price-to-rent ratio in ZIP {zip}.'; timeRangeLine([]) returns ''. The chart shows its empty state in those cases anyway"
  - "Did not reuse renter/fair-rent pickBedroomBucket: its highest-bucket fallback (exact:false) conflicts with this plan's 4+ pooling and bedroom-then-overall fallback rules"
metrics:
  duration: ~20min
  completed: 2026-10-05
  tasks: 2
  files: 8
---

# Phase 7 Plan 06: Market series math, chart summaries, 5-ZIP watch rules Summary

This plan adds a pure `@tran/core/markets` module. It builds continuous monthly rent-by-bedroom and price-to-rent series, using `null` for missing months and never 0. It also provides ZIP-median rent lookup for buy-box quick metrics, the UI-SPEC chart summary sentences and time-range line, and pure rules for the 5-ZIP watch list.

This plan advances requirement **INV-05**. It stays open until the 07-21 phase gate.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Continuous monthly series, price-to-rent, ZIP median rent lookup | 908d62d (RED), 1db6af4 (GREEN) |
| 2 | Summary sentences, time-range line, 5-ZIP watch rules | fa965e2 (RED), ad6d724 (GREEN) |

## Verification

- `vitest run --project core markets`: 45 passed (series 21, summary + watched-zips 24)
- Full core project: **1575 passed / 50 files**
- `tsc --noEmit` (core): no errors in `src/markets/`. The only errors are in 07-05's in-flight `src/finance/expenses.test.ts`, which belongs to the parallel plan.
- ESLint and Prettier are clean on `packages/core/src/markets`.
- Property tests:
  - `monthRange` output is continuous and strictly ascending, and includes both endpoints.
  - `rentTrendSeries` points line up with the months, and absent months are never 0 or NaN.
  - The watch list never exceeds 5 entries and never holds duplicates.
- Mutation tests (all killed, then reverted):
  - Inverting price-to-rent to `rent*12/price`: 3 tests fail.
  - Dropping `* 12`: 3 tests fail.
  - Changing the limit check from `>=` to `>`: 2 tests fail.
  - `MAX_WATCHED_ZIPS = 6`: 1 test fails.

## Deviations from Plan

**1. [Rule 3] Index barrel built in two steps.** In Task 1, `index.ts` re-exports only types and series. Task 2 appends summary and watched-zips. The plan suggested typed stubs instead. Both approaches keep typecheck green, and this one avoids committing throwaway stubs.

Otherwise the plan ran as written.

## Finding for 07-09 (web markets port)

The Phase 4 domain type `MarketHistoryPoint` (`@tran/core/listings`) carries only `month/average/median/totalListings` per month. It has **no per-month bedroom breakdown**, and `byBedrooms` exists only at the top level of `MarketSide`. If the Phase 4 mapper drops `history[m].dataByBedrooms`, the 07-09 adapter can only fill each month's overall `medianRent`. Then `rentTrendSeries` yields no bedroom series and the chart shows its empty state. 07-09 should map from a source that keeps per-month `dataByBedrooms`, or extend the Phase 4 history mapping. This module's structural input already accepts that data.

## Known Stubs

None.

## Self-Check: PASSED
