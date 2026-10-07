---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 05
subsystem: core-studio
tags: [studio, snapshot, market-stats, allowed-set, aggregates, tdd]
requires:
  - "Phase 4 @tran/core/listings MarketStats / MarketSide / Listing (normalized domain shape: sale/rental sides, history as a month-tagged ARRAY, byBedrooms[].median)"
  - "Phase 7 @tran/core/format usd (cents), usdRange, pct, ratio, monthYear, longDate, MINUS, NOT_AVAILABLE"
  - "Phase 7 @tran/core/markets currentStats (price-to-rent formula reused, not re-derived)"
provides:
  - "packages/core/src/studio/snapshot-metrics.ts: BedroomRent, SnapshotMetrics, buildSnapshotMetrics(MarketStats), BedroomAggregate, AggregatedSample, AGGREGATED_SAMPLE_KEYS, BEDROOM_AGGREGATE_KEYS, aggregateListings(listings, kind, seenAt), bedroomLabel(beds)"
  - "packages/core/src/studio/snapshot-facts.ts: formatSignedPct, SnapshotFigureValues, snapshotFigureValues, FactLine, snapshotFactLines, factsForPrompt, snapshotAllowedNumbers"
  - "MarketSide.medianDaysOnMarket (optional) mapped from RentCast medianDaysOnMarket"
affects: [09-10, 09-13, snapshot builder, snapshot print route, snapshot.v1 prompt]
tech-stack:
  added: []
  patterns:
    - "Snapshot figures, prompt facts and the allowed set share one formatter source (@tran/core/format), proven by running checkNumbers over factsForPrompt output"
    - "Aggregate-only listings summary: rows built from scratch with whitelisted keys; tests deep-equal Object.keys against the exported key lists"
key-files:
  created:
    - packages/core/src/studio/snapshot-metrics.ts
    - packages/core/src/studio/snapshot-metrics.test.ts
    - packages/core/src/studio/snapshot-facts.ts
    - packages/core/src/studio/snapshot-facts.test.ts
  modified:
    - packages/core/src/listings/types.ts
    - apps/web/src/lib/data/rentcast/mappers.ts
decisions:
  - "buildSnapshotMetrics takes the Phase 4 DOMAIN MarketStats (what DataGateway.marketStats returns), not the raw RentCast saleData/rentalData shape the plan sketched. Phase 4 normalizes history into a sorted month-tagged array and renames medianRent/medianPrice to side.median. The markets port's toMarketStatsInput output (MarketStatsInput) drops days on market and newListings, so it can't feed a snapshot"
  - "Days on market is RentCast's MEDIAN (new optional MarketSide.medianDaysOnMarket), rounded to whole days. The mean (averageDaysOnMarket) is never substituted, because the report labels the figure as a median. A side without the field gives null"
  - "Price-to-rent calls Phase 7 currentStats() and rounds to 1 decimal, so it's the same formula as the investor charts"
  - "Rent change uses the first and last months that have a usable median (sorted ascending). months = count of distinct valid month keys in the rental history"
  - "4+ row: listings summed; median = the median of the row holding the middle listing (rows sorted by median, cumulative count >= total/2). If any count is unknown, the 4-bedroom row is used alone (else the smallest bedroom count present)"
  - "aggregateListings skips listings of the other kind and listings without a positive finite price. Listings with unknown bedrooms count toward total but sit in no bedroom row. min/max/median/medianDom are rounded to whole numbers"
  - "Counts are shown via a local thousands-grouping helper (no Intl/toLocaleString in snapshot-facts.ts); money via usd(dollars x 100); ratio(x, 1); signed percent via pct(v, 1) plus a '+' for non-zero positives"
  - "Fact-line wording: bedroom labels lower-cased mid-sentence ('Median rent, studio'); listings summary lines 'Homes for sale, 2 bedrooms: 3 listings, $1,700 to $2,000, median $1,850, median days on market 17'; a single-price row shows one amount instead of a degenerate range"
  - "snapshotAllowedNumbers includes both the signed and the absolute rent change, so 'fell 1.4%' and '−1.4%' both pass"
metrics:
  duration: "~9 min"
  completed: 2026-10-07
  tasks: 2
  files: 6
---

# Phase 9 Plan 05: Snapshot metrics, aggregated sample, facts and allowed numbers Summary

All Market Snapshot math is now pure, tested core code. `buildSnapshotMetrics` turns the Phase 4 market stats into every figure the report shows, with explicit nulls. `aggregateListings` builds an address-free summary of active listings. `snapshot-facts.ts` produces the report strings, the `snapshot.v1` prompt facts and the allowed-number set, all from the Phase 7 formatters. A figure the model copies from the facts always passes the number check, and a number the model computes itself never does.

## Performance

- **Duration:** ~9 min
- **Started:** 2026-10-07T07:59Z
- **Completed:** 2026-10-07T08:08Z
- **Tasks:** 2 (TDD: RED and GREEN commits each)
- **Files:** 4 created, 2 modified

## Task Commits

1. **Task 1 RED:** `78423d8` test(09-05): add failing snapshot metrics tests
2. **Task 1 GREEN:** `c74a4c6` feat(09-05): snapshot metrics and aggregate-only listings summary
3. **Task 2 RED:** `dbf6aea` test(09-05): add failing snapshot facts tests
4. **Task 2 GREEN:** `cbda923` feat(09-05): snapshot figure values, prompt facts and allowed numbers

No refactor commits were needed. Every commit was checked with `git show --stat`, and none contains another plan's files.

## Verification

- `corepack pnpm vitest run --project core snapshot-metrics`: 16/16 passed (RED first failed on the missing module)
- `corepack pnpm vitest run --project core snapshot-facts snapshot-metrics`: 31/31 passed
- `corepack pnpm vitest run --project core studio` (plan verification): 9 files, 239/239 passed. That includes other wave-1 plans' studio tests present at the time
- `corepack pnpm vitest run --project web apps/web/src/lib/data/rentcast` (mapper change): 4 files, 69/69 passed
- `corepack pnpm --filter @tran/core check`: clean on the final run. An earlier run showed errors only in other executors' in-progress `reel.test.ts` / `unsupported-claims.test.ts`, never in this plan's files
- Scoped `eslint` + `prettier --check` on all 6 files: clean
- `corepack pnpm banned`: passed (348 files)
- Repo-wide `corepack pnpm lint`: prettier flags only `packages/core/src/fair-housing/lexicon.ts`, another executor's in-progress file. Not touched
- Acceptance greps: no listing spread (`\.\.\.(listing|l|row)\b` returns nothing); no `toLocaleString`/`Intl.NumberFormat` in snapshot-facts.ts; snapshot-facts.ts imports `from '../format/index.js'`; the tests contain `AGGREGATED_SAMPLE_KEYS`, `formattedAddress`, `Number.isFinite`, a literal `−` and `not.toContain(1800)`
- Non-test .ts sources are ASCII-only. The two test files hold the literal U+2212 the acceptance criteria require, which matches existing core tests such as `format.test.ts`
- Real-data guard and secret scan passed on every commit (fictional ZIP 00199, `Example Way` addresses, `@example.com` emails, `555-01xx` phones)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Input type adapted to the shipped Phase 4 domain shape**
- **Found during:** Task 1
- **Issue:** The plan's interface note described the raw RentCast `/v1/markets` shape (`saleData`/`rentalData`, `medianRent`, history as a record). The shipped `MarketStats` in `@tran/core/listings` is normalized (`sale`/`rental` sides, `median`, history as a sorted month-tagged array). The record-shaped `MarketStatsInput` from the markets port has no DOM or newListings.
- **Fix:** `buildSnapshotMetrics` takes the domain `MarketStats` as the contract names, and the fixtures are written in that shape with the history array deliberately out of order. Sorting is still done in code.
- **Commit:** c74a4c6

**2. [Rule 2 - Correctness] Added optional `MarketSide.medianDaysOnMarket` (files outside files_modified)**
- **Found during:** Task 1
- **Issue:** The Phase 4 mapper kept only `averageDaysOnMarket`. The snapshot must show "Median days on market" (UI-SPEC), and RentCast and the fixtures provide `medianDaysOnMarket`. Labeling the mean as a median would be dishonest.
- **Fix:** One optional field in `packages/core/src/listings/types.ts` and one mapper line, `medianDaysOnMarket: num(v.medianDaysOnMarket)`, in `apps/web/src/lib/data/rentcast/mappers.ts`. No other Phase 9 plan lists either file. Because the field is optional, existing hand-built `MarketSide` values still type-check, and the rentcast tests are green (69/69).
- **Commit:** c74a4c6
- **Downstream note:** cached market-stats rows written before this change have no `medianDaysOnMarket`, so DOM shows as an em dash until the ZIP is refreshed. The sample fixtures map it fresh.

**Total deviations:** 2 auto-fixed. **Impact:** contract names and signatures are exactly as the plan specified.

## Notes for downstream plans

- The snapshot builder (09-1x) needs the DOMAIN `MarketStats` (for example from `gateway.peek/requestSpend<MarketStats>(marketStatsRequest(zip))`, the canonical request). The markets port's `MarketResult.stats` (`MarketStatsInput`) lacks DOM and newListings.
- `aggregateListings` expects RentCast prices in whole dollars, as `Listing.price` stores them. Formatting converts to cents internally.
- `snapshotAllowedNumbers` and `factsForPrompt` must get the same `(metrics, sample, asOf)`. The test `passes every figure copied verbatim from the facts through the number check` locks this in.
- Requirement STU-04 was NOT marked complete. The 09-23 phase gate closes requirement ids, per the executor briefing.

## Known Stubs

None.

## Self-Check: PASSED
