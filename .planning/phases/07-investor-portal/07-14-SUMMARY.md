---
phase: 07-investor-portal
plan: 14
subsystem: investor-buy-boxes
tags: [investor, buy-box, saved-search, scheduler, quick-metrics, dexie, tdd, mutation-test]
requires:
  - "04-19 createSavedSearchRepo / runDueSearches (already schedules 'sale-listings')"
  - "07-09 buyBoxes table (Dexie v5, backup-registered), InvestorDataPort (saleListings / peekSaleListings / saleListingsRequest), MarketsPort.peek"
  - "07-07 quickMetrics / meetsTargets; 07-05 BUY_BOX_EXPENSE_BPS"
provides:
  - "buybox/buyBoxRepo.ts: createBuyBoxRepo(deps) / useBuyBoxRepo() -> createBuyBox, updateBuyBox, deleteBuyBox, listBuyBoxes, getBuyBox, checkNow, markSeen, newMatchIds, newMatchCount; validateBuyBox, emptyBuyBox, BUY_BOX_PROPERTY_TYPES, BuyBoxValidationError, BuyBoxNotFoundError"
  - "buybox/matches.ts: filterListings, buildMatches -> { meeting, below, zipsNeedingStats }, loadMatches -> + { truncated, checked }"
  - "investor-port.ts re-exports savedSearchRepo / SavedSearchRepo (the single $lib/data adapter)"
affects: [07-18 buy-box UI (Deep analyze, Load ZIP rents, error copy), 07-21 gate (INV-04)]
tech-stack:
  added: []
  patterns:
    - "Two rows per buy box sharing one id (Phase 4 saved search + criteria row), written in ONE Dexie transaction (same TranDb)"
    - "Lazy db/phase4 thunks so useBuyBoxRepo() is safe at component init during prerender"
key-files:
  created:
    - apps/web/src/lib/features/investor/buybox/buyBoxRepo.ts
    - apps/web/src/lib/features/investor/buybox/buyBoxRepo.test.ts
    - apps/web/src/lib/features/investor/buybox/matches.ts
    - apps/web/src/lib/features/investor/buybox/matches.test.ts
  modified:
    - apps/web/src/lib/features/investor/data/investor-port.ts
key-decisions:
  - "No scheduler change: the shipped Phase 4 scheduler already runs 'sale-listings' saved searches of any portal; buy boxes are portal 'investor' rows with the fetch-wide saleListingsRequest params, so on-open checks, claims and the 24 h rule are Phase 4's unchanged code"
  - "Saved search and criteria row are created/updated/deleted in one Dexie transaction (DataDb IS TranDb), not compensated across stores as 06-20 did"
  - "The buy-box name lives in the Phase 4 row (rename via phase4.rename); criteria, targets and expenseBps live in the buyBoxes row"
  - "checkNow spends through the investor port's requestSpend (CapPrompt applies; no grant option, per 07-09) and writes the snapshot with phase4.complete; takenAt = provenance.fetchedAt (06-20 rule)"
  - "New since last visit = snapshot firstSeenAt > lastSeenAt, on-market, AND the id passes filterListings on the cached rows; a box's first run flags all its matches new (the user has not seen them)"
  - "A location change rewrites the saved search params, sets lastRunAt/claimedAt null and deletes the old snapshot (new geography is due at once)"
  - "A cached markets error or a missing/null stats entry reads as 'not loaded' (zipsNeedingStats); unknown meets (null) stays in meeting"
requirements-advanced: [INV-04]
metrics:
  duration: ~30min
  completed: 2026-10-05
  tasks: 2
  files: 5
---

# Phase 7 Plan 14: Buy-box data layer Summary

**Buy boxes saved as Phase 4 investor saved searches over the fetch-wide sale-listings request plus a same-id criteria row (one transaction, both backed up), re-run on app open by the unchanged Phase 4 scheduler at most once per 24 hours, with criteria filtering, new-since flags and 0-call quick metrics grouped by target applied locally to cached rows.**

## Tasks

| # | Task | Commits |
| --- | --- | --- |
| 1 | Buy-box repository over Phase 4 saved searches and the scheduler | a2a9422 (test), 7bcd6c6 (feat) |
| 2 | Local match filtering, new flags and zero-call quick metrics | 8999eb2 (test), eddb343 (feat) |

## What the tests prove

**buyBoxRepo.test.ts (15 tests).** These run against a live Phase 4 gateway on fake-indexeddb, with a fetch spy counting RentCast calls and the real `runDueSearches`.
- Validation codes: `name-empty`, `location-empty`, `location-unrecognized` ("Nowhere"), `min-over-max`, and equal min/max is valid. An invalid create writes nothing.
- Create makes 0 calls. It writes `portal: 'investor'`, `sale-listings`, `{zipCode, status: 'Active', limit: 500}` with no price, beds or type params, `lastRunAt: null`, and the same-id criteria row.
- Scheduler: the first run is 1 call, +1h is 0 calls, +24h is 1 call. Two boxes in one location cost 1 call. Two tabs opening at once give exactly one run and 1 call.
- `checkNow`: 1 call when uncached, 0 when fresh. It returns the criteria-filtered new count, and afterwards the on-open pass skips the box.
- `markSeen` sets the count to 0. A later run that adds s3 (a match) and s4 (over the max price) counts only s3. The new-since rule is strict: an item first seen exactly at `lastSeenAt` is not new.
- A location change resets `lastRunAt`, drops the snapshot and rewrites the params to the city/state form, and the box is due at once. Other edits keep them.
- Delete removes the saved search and the snapshot and tombstones the row, and the box is never due again. Only investor rows with a live criteria row are listed.
- A backup round trip (`buildBackupText`, then `previewImport` and `applyImport` into a fresh DB) restores an identical `listBuyBoxes()`.

**matches.test.ts (17 tests).**
- Filters: inclusive price bounds (±1 cent), null bounds are open. Any bedrooms keeps null-bed listings; a minimum excludes them; 4 means 4 or more. `[]` matches any type, otherwise only the listed types.
- Order: `listedAt` descending, nulls last.
- Stats: ZIP A has cached stats and gets metrics (cap 6.21 meets, 4.70 goes to `below`). ZIP B has none: its rows get `quick`/`meets` null, stay in `meeting`, and B is listed once. An explicit null entry counts as not loaded.
- Targets: the 1% rule is met exactly at the boundary. With no targets, every row is in `meeting`. `expenseBps` is honoured, and `isNew` follows `newIds`.
- `loadMatches` with spy ports makes 1 listings peek and 1 peek per distinct ZIP. The `saleListings`, `rentEstimate`, `valueEstimate` and `markets.load` spies all stay at 0.
- `checked` is false when the box was never run and nothing is cached, and true when the location is already cached. `truncated` passes through. A cached ZIP error reads as not loaded.

## Mutation tests (memory guidance; all restored)
- buyBoxRepo: changing `>` to `>=` in the new-since rule → red. Dropping the criteria filter from the new ids → 2 red. Removing the location-change reset → red. Removing the snapshot delete on deleteBuyBox → red.
- matches: changing either price bound to exclusive → red. Letting a beds minimum keep null bedrooms → red. Grouping with `!meets` (unknown counted as below) → 7 red. Removing the ZIP dedupe → 2 red. Sorting nulls first → red. Ignoring `expenseBps` → red.
- Scheduler "two tabs → one run" is covered by the Phase 4 claim, now exercised with investor rows.

## Verification
- `corepack pnpm vitest run --project web matches buyBoxRepo`: 32 passed.
- `corepack pnpm test:unit`: 203 files, 4018 tests, all passing. This includes every Phase 4/6 `lib/data` scheduler test; `scheduler.ts` is unchanged.
- `corepack pnpm check`: 0 errors.
- `eslint` on `features/investor/buybox` and `investor-port.ts`: clean. `corepack pnpm lint` as a whole reports 1 error, in 07-12's then-uncommitted `analyzer/ResultsPanel.svelte` (`svelte/no-useless-mustaches`). That file is not in this plan's scope.
- Acceptance greps: `buyBoxRepo.ts` contains `portal: 'investor'`. The artifact's literal `export async function checkNow` is not present: `checkNow` is a method of the repo factory (deviation 3). `matches.ts` contains `zipsNeedingStats` and no `.load(`, `.saleListings(`, `.rentEstimate(` or `.valueEstimate(`.

## Deviations from Plan

1. **[Rule 3 - Blocking] Boundary: only `investor-port.ts` may import `$lib/data` at runtime (07-09 test).** The buy-box repo needs Phase 4's `savedSearchRepo()`. `investor-port.ts` now re-exports `savedSearchRepo` and `SavedSearchRepo`, a 6-line additive change. No parallel plan touches that file.
2. **[Rule 3] No scheduler edit was needed.** `scheduler.ts` already schedules `sale-listings` for any portal, so the investor "registration" is just the saved-search row.
3. **[Rule 3 - Pattern] The repo is a factory, not module-level functions.** `getDataRuntime()` reads Svelte context (07-09 decision 5), so the methods live on `createBuyBoxRepo(deps)`. `useBuyBoxRepo()` is called at component init, with the DB resolved lazily. Same contract names; `getBuyBox` and `newMatchIds` were added for 07-18. `loadMatches(box, deps)` takes the two ports and `newIds` explicitly.
4. **[Rule 3] `checkNow(id)` has no `grant` option.** Over-cap confirmation is the runtime's CapPrompt via `requestSpend` (07-09 decision 4).
5. **`filterListings` shipped in the Task 1 commit**, because the repo's new count depends on it. Task 2 added `buildMatches` and `loadMatches`.
6. Test and implementation were written together and committed as test-then-feat. RED was demonstrated by mutation runs (07-09 precedent).

## For 07-18 (UI)
- "Save and check now": `createBuyBox`, then `checkNow` from the click handler.
- On open: `newMatchIds(id)`, then `loadMatches(view, { investor, markets, newIds })`, then `markSeen(id)`.
- "Load ZIP rents": iterate `zipsNeedingStats` with the markets port's `load`. This module never does.
- "Deep analyze (2 calls)": `MatchRow.listing` has `address`, `propertyType`, `bedrooms`, `bathrooms` and `squareFeet` for the port's `rentEstimate`/`valueEstimate` `EstimateQuery`.
- Error codes come from `validateBuyBox`.

## Requirements
INV-04 advanced; not marked complete (the orchestrator owns that).

## Known Stubs
None.

## Self-Check: PASSED
