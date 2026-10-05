---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 19
subsystem: data-alerts
tags: [alerts, scheduler, saved-searches, dexie, concurrency, mutation-test, tdd]
requires:
  - "04-01 DataDb savedSearches/searchSnapshots tables, DATA_RECORD_SCHEMA_VERSION, harness makeDb/T0/spyFetch"
  - "04-05 @tran/core/alerts isDue, dueSearches, planRun, buildSnapshot, diffSnapshots, countNewSince"
  - "04-11 LedgerRepo usage (countedTowardCap, cap)"
  - "04-13/04-17 DataGateway (get, estimateCost, usage, source), makeGateway harness, createSampleGateway"
provides:
  - "$lib/data/saved-search-repo: createSavedSearchRepo(db, clock) -> create, list, claim, complete, release, markSeen, snapshot, remove; SavedSearchInput, SnapshotInput"
  - "$lib/data/scheduler: runDueSearches(deps) -> SchedulerResult; LockPort, noLock, browserLock; ConfirmInput, SchedulerDeps"
affects: [04-22 (public $lib/data port export + (app) layout wiring), 04-20 DataStatusBar (waiting / skippedForCap), Phases 6-7 alerts UI]
tech-stack:
  added: []
  patterns:
    - "Claim-then-run: due + unclaimed re-check and claimedAt stamp in one rw transaction"
    - "Snapshot write + lastRunAt in one rw transaction over savedSearches + searchSnapshots"
    - "Scheduler is I/O only around pure core/alerts decisions"
key-files:
  created:
    - apps/web/src/lib/data/saved-search-repo.ts
    - apps/web/src/lib/data/saved-search-repo.test.ts
    - apps/web/src/lib/data/scheduler.ts
    - apps/web/src/lib/data/scheduler.test.ts
  modified: []
key-decisions:
  - "complete() takes { takenAt, truncated, items } and builds the Syncable snapshot row itself (id === searchId, createdAt kept on rewrite), so callers never mint Syncable fields"
  - "SchedulerResult gains failed: string[] (network/key/rate-limit errors are released and due again next pass) so they are not mislabeled as waiting for cap room"
  - "skipped 'cap' means the cap is reached (planRun blockedByCap or BudgetCapReached mid-run), matching DataStatusBar skippedForCap; at 38/40 the 3 left over are waiting with skipped null"
  - "Non-GatewayError exceptions (e.g. ReactiveSpendError) release the claim and rethrow; only GatewayErrors are absorbed"
requirements-completed: [DATA-03]
metrics:
  duration: 20min
  completed: 2026-10-05
  tasks: 2
  files: 4
---

# Phase 4 Plan 19: Saved-search repository and check-on-open alerts scheduler Summary

Saved searches persist as Syncable rows with crash-safe, transactional claims. `runDueSearches` runs due listings searches one at a time inside the cap. It asks for confirmation above 3 due, never refreshes or uses a grant, and stops cleanly at the cap. The roadmap's "5 due saved searches" criterion is proven by call counts, including two tabs racing, and the claim is mutation-checked at both the repo and the scheduler level.

## Tasks

| Task | Name | Commits |
| --- | --- | --- |
| 1 | Saved-search repository with transactional claim | 707364b (RED), 6b7ae33 (GREEN) |
| 2 | runDueSearches and the 5-due-searches call-count tests | 5440a71 (RED), cd4a6c0 (GREEN) |

## What the tests prove (scheduler.test.ts, 18 tests; saved-search-repo.test.ts, 13 tests)

- **5 due on open:** confirm is called once with run 5, calls 5, used 0, cap 40. There are 5 fetches (one per ZIP), and every `lastRunAt` is now with the claims cleared.
- A second pass at once spends 0 and asks nothing. So does a pass at +23 h. At +24 h all 5 are due again: 5 more fetches and one more confirmation.
- 3 due runs without asking. Declining spends 0, leaves every `lastRunAt` null and leaves no claims behind.
- **Cap:** at 38/40 the 2 oldest run (ZIPs 74205 and 74204, in that order), 3 wait, nothing throws and usage ends at 40. At 40/40 nothing runs, there is no confirmation, `skipped` is 'cap' and 5 wait. At 37/40, if another tab spends 2 calls after the first fetch, exactly 1 runs, the loop stops with `BudgetCapReached` absorbed, 4 wait, no claim is left and usage stays at 40.
- Two due searches with the same ZIP share 1 fetch.
- `gateway.get` is called only with `{ intent: 'scheduler' }`. `refresh` and `grantOverCap` are never called, and every ledger row is `intent: 'scheduler'`, `overCap: false`.
- **Two tabs:** two schedulers on two connections to one database, started with `Promise.all`, make exactly 5 fetches in total over 5 fresh races. A held lock returns `skipped: 'busy'` with 0 fetches. `browserLock` requests `'tran-alerts'` with `{ ifAvailable: true }` and falls back to `noLock` when there is no `navigator.locks`.
- **Sample mode:** 5 searches across fixture ZIPs make 0 live fetches, show no confirmation, write snapshots, and add 0 ledger rows and 0 cache rows.
- **Diff:** the first run is a baseline (`newListings` 0). A run 24 h later with one more listing gives `newListings` 1 and `countNewSince(snapshot, lastSeenAt) === 1`. After `markSeen` the count is 0.
- NoResults (404) stores an empty, non-truncated snapshot and counts as run. A 500 releases the claim, leaves `lastRunAt` null, writes no snapshot and is reported in `failed`, and the other search still runs.

## Mutation runs (recorded, not committed; files restored and verified)

| Mutation | Result |
| --- | --- |
| Scheduler skips `repo.claim` | "two schedulers ... exactly 5 fetches" is red: **expected 10 to be 5** |
| `claim()` reads the row in a separate `'r'` transaction before the `'rw'` write | Repo "two connections ... exactly one wins" is red (`[true, true]`), and the scheduler two-tab test is red (**7 fetches instead of 5**) |
| `planRun` gets `used: 0` instead of `countedTowardCap` | 3 cap tests red (38/40, at cap, mid-run BudgetCapReached) |

The repo restore used a temp backup because the file was untracked during the first mutation. After the restore the suites were green: 31/31.

## Verification

- `corepack pnpm vitest run --project web scheduler saved-search-repo`: 31/31 pass.
- `corepack pnpm vitest run --project web`: 38 files, 503 tests, all pass.
- `corepack pnpm check`: 0 errors. One intermediate run showed 2 errors in 04-18's in-progress files; the re-run was clean.
- eslint and prettier are clean on all 4 files. `corepack pnpm guard` passed (706 files).
- `scheduler.ts` contains `planRun(`, `dueSearches(`, `diffSnapshots(`, `repo.claim(` and `intent: 'scheduler'`. It has 0 matches for `grantOverCap` or `.refresh(`. No test uses fake timers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Snapshot rows must be Syncable**
- **Found during:** Task 1
- **Issue:** The plan's sketch had `complete(id, { searchId, ...next })`. A `SearchSnapshotRow` without Syncable fields would fail the Phase 3 backup `SyncableSchema` (see the 04-01 deviation).
- **Fix:** `complete()` takes `SnapshotInput` (`takenAt`, `truncated`, `items`) and builds the row with `newSyncable({ id: searchId, ... })`, keeping `createdAt` on rewrite. Row updates write ISO `updatedAt`, not the numeric `now` from the plan's sketch.
- **Commit:** 6b7ae33

**2. [Rule 2 - Missing critical] Failed runs were indistinguishable from cap waits**
- **Fix:** Added `failed: string[]` to `SchedulerResult` (an additive change). Without it, a network failure would show as "waiting until there's room under your cap" in DataStatusBar.
- **Commit:** cd4a6c0

## Notes for 04-22 (port owner)

- `lib/data/index.ts` is owned by 04-18/04-22. This plan did not touch it. Export from the port: `runDueSearches`, `browserLock`, `noLock`, `createSavedSearchRepo` and the types `SchedulerResult`, `ConfirmInput`, `LockPort`, `SavedSearchRepo`, `SavedSearchInput`.
- Map the result to DataStatusBar like this: `waiting = result.waiting.length`, `skippedForCap = result.skipped === 'cap'`. 'declined' maps to the "weren't checked ... will ask again" copy.
- Call `runDueSearches({ ..., lock: browserLock() })` from the (app) layout `onMount`, gated on key state. Never call it from `$effect`.

## Known Stubs

None.

## Self-Check: PASSED
