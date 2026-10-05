---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 13
subsystem: data-gateway
tags: [gateway, budget, cache, dedupe, dexie, fake-indexeddb, tdd, mutation-testing]
requires:
  - "04-03 @tran/core/request (canonicalKey, isStale, classifyResponse, backoffMs, GatewayError, PROBE_REQUEST)"
  - "04-04 @tran/core/listings (buildListingByIdRequest, isTruncated, LISTINGS_LIMIT, Listing)"
  - "04-09 createRentCastClient / testRentCastKey"
  - "04-10 parsePayload / mapPayload / mapListing"
  - "04-11 createLedgerRepo / createCacheRepo / issueGrant"
provides:
  - "$lib/data/gateway: createDataGateway, DataGateway, GatewayResult, PeekResult, CostEstimate, SpendOptions, LiveGatewayDeps, ReactiveSpendError"
  - "$lib/data/testing/gateway-harness: makeGateway({ fetch, clock, cap, db, reactiveGuard }), rentals(zip), listingRow, listingRows"
affects: [04-17 (sample mode in gateway.ts), 04-18, 04-20..04-22, Phases 6-9 (coordinator uses peek/peekListingById/rentalListingById)]
tech-stack:
  added: []
  patterns:
    - "Read/spend split: peek/estimate* touch only the cache; get/refresh/rentalListingById are the only spend paths"
    - "Spend path: fresh cache -> in-flight map -> serial queue -> cache re-check -> ledger.reserve -> client.get -> ledger.settle -> cache.put"
    - "Cache stores the validated wire-shaped body (rows array / row / object) and rebuilds the ValidatedPayload on read, so cache-repo findListingById can search it and mapping stays on read"
    - "Negative cache rows store only { detail } (never the response body) so a repeat throws the same NoResults detail"
key-files:
  created:
    - apps/web/src/lib/data/gateway.ts
    - apps/web/src/lib/data/testing/gateway-harness.ts
    - apps/web/src/lib/data/gateway.cache.test.ts
    - apps/web/src/lib/data/gateway.cost.test.ts
    - apps/web/src/lib/data/gateway.budget.test.ts
    - apps/web/src/lib/data/gateway.concurrency.test.ts
  modified: []
decisions:
  - "apiCache.body holds the validated wire-shaped body, not the ValidatedPayload wrapper: keeps 04-11 cache-repo findListingById working unchanged; payloadOf(row) rebuilds the wrapper from row.endpoint"
  - "spend() re-checks the fresh cache inside the queue before reserving: a request queued behind another tab's identical fetch costs 0"
  - "A missing key (client throws before fetch) settles the reserved row with status 0 so it never lingers as pending against the cap"
  - "Refresh shares the in-flight map with get: a double-clicked Refresh costs 1 call"
metrics:
  duration: "~25 min"
  completed: 2026-10-05
  tasks: 2
  files: 6
---

# Phase 4 Plan 13: Live DataGateway Summary

Cache-first, cap-guarded RentCast gateway: original "as of" stamps on hits, in-flight dedupe, a serial spend queue, reserve-fetch-settle metering through the transactional ledger, 24h negative cache, the full error taxonomy, cost estimates, 0-call `peek`/`peekListingById`, `rentalListingById`, single-use over-cap grants and a metered key test. The 60-call, repeat-spends-0 and cross-tab race tests are all mutation-checked.

## What was built

- `createDataGateway(deps)` (source `'rentcast'`) implementing the plan's `DataGateway` contract verbatim.
- `ReactiveSpendError` thrown by get/refresh/rentalListingById before any I/O when the injected `reactiveGuard` reports a tracking context; peek keeps working.
- `makeGateway` harness plus synthetic `listingRow(s)` helpers (fictional addresses, fake key only).
- 49 gateway tests across four files: cache (17), cost (7), budget (17), concurrency (8).

## Mutation runs (recorded, not committed)

| Mutation | Result |
|---|---|
| `ledger.reserve(...)` removed from `spend()` | 60-call probe: **60 fetches, 0 blocked, 0 billed** (baseline 40 / 20 / 40); `gateway.budget` "calls 1-40 ..." and "BudgetCapReached carries ..." go red |
| In-flight dedupe removed (`inflight.get(key)` -> `undefined`) | First run stayed green (the in-queue cache re-check hid it), so two cases were added: shared-result identity and double-clicked refresh. Re-run: **2 red** ("dedupes 5 identical concurrent gets", "double-clicked refresh costs 1 call") |
| Serial queue removed (`enqueue(fn)` -> `fn()`) | "serializes distinct spends: never two requests in flight" red (peak 2 concurrent) |
| `ledger-repo` reserve read moved out of the rw transaction | Cross-instance tests red: **2 fetches instead of 1** ("at 39/40, two tabs ..." and "holds over 10 fresh races") |

All mutated files restored and verified with `git diff --exit-code`.

## Verification

- `corepack pnpm vitest run --project web gateway` -> 49 passed
- `corepack pnpm vitest run --project web` -> 32 files, 406 passed
- `corepack pnpm guard` -> passed
- `eslint` / `prettier --check` / `svelte-check`: clean for every file this plan owns. The only reported problems are in other wave-3 executors' in-progress files under `lib/features/shared/data/` (CapAboveLimitDialog.svelte formatting, GatewayError.svelte `untrack`, ProvenanceRow/CostLabel browser tests, relative-time.test.ts); not this plan's scope.
- `gateway.ts` contains no `fetch(` and no `console.`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cache body shape vs cache-repo findListingById**
- **Found during:** Task 1 GREEN
- **Issue:** Storing the `ValidatedPayload` wrapper (`{ endpoint, rows }`) as `apiCache.body` made `cache.findListingById` (04-11, which expects the wire-shaped array/object) unable to find any listing, so `peekListingById` always returned undefined.
- **Fix:** Store the wire-shaped validated body (`storedBody`) and rebuild the wrapper on read (`payloadOf(row)`). Still "store validated payload, map on read" (Pattern 9), no change to cache-repo.
- **Files modified:** apps/web/src/lib/data/gateway.ts
- **Commit:** b43fde2

**2. [Rule 2 - Missing critical] Dedupe guard was not mutation-visible**
- **Found during:** Task 2 mutation run
- **Issue:** With dedupe removed the suite stayed green, because the queued duplicate hit the in-queue cache re-check. A double-clicked Refresh (TTL bypass, no re-check) would however spend 2 calls.
- **Fix:** Added a shared-result identity assertion and a double-refresh test; both go red without dedupe.
- **Commit:** 4be1e6e

**3. Negative-cache body keeps `{ detail }`**
- Plan said `body: null`; storing the classified detail (never the response body) lets a repeat 400 throw `NoResults/bad-request` (and sample mode's `outside-sample-coverage`) consistently. `null` when there is no detail.

### TDD note

Task 2's tests passed on first run: Task 1 already implemented `grantOverCap` and `testKey` per the `<interfaces>` contract, so no Task 2 GREEN change to `gateway.ts` was needed and there is no separate `feat` commit for it. The red evidence for Task 2 comes from the mutation runs above.

## Commits

- 4c16457 test(04-13): add failing gateway cache and cost tests
- b43fde2 feat(04-13): live data gateway with cache, dedupe and cost estimates
- 608ae12 test(04-13): add gateway budget, error and race tests
- 4be1e6e test(04-13): make the dedupe guard mutation-visible

## Known Stubs

None. Sample mode is intentionally absent; 04-17 adds it to `gateway.ts`.

## Self-Check: PASSED
