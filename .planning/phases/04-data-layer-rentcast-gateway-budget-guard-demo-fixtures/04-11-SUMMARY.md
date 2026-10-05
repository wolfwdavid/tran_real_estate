---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 11
subsystem: data-ledger-cache
tags: [dexie, budget-guard, ledger, cache, concurrency, mutation-test, tdd]
requires:
  - "04-01 DataDb (ledger, dataPrefs, apiCache tables), DATA_PREF_IDS, DATA_RECORD_SCHEMA_VERSION, harness makeDb/T0/TEST_KEY"
  - "04-02 @tran/core/budget periodKey, resetsAt, summarize, canSpend, DEFAULT_CAP, CAP_MIN, CAP_MAX"
  - "04-03 @tran/core/request GatewayError, EndpointId, DAY_MS"
provides:
  - "$lib/data/grants: OverCapGrant, issueGrant, consumeGrant"
  - "$lib/data/ledger-repo: createLedgerRepo(db, clock) -> reserve, settle, record, usage, readCap, writeCap; SpendRequest, UsageSnapshot"
  - "$lib/data/cache-repo: createCacheRepo(db) -> get, put, findListingById, prune; CACHE_MAX_AGE_MS"
affects: [04-13 onward (gateway, meter, cap settings, scheduler)]
tech-stack:
  added: []
  patterns:
    - "Reserve-then-settle: usage read + cap read + pending-row append in one Dexie rw transaction over ledger + dataPrefs"
    - "Billing derived at read time from stored HTTP status (no billed flag)"
    - "Over-cap grants are WeakSet-registered in-memory objects: unforgeable, single-use, key-bound"
key-files:
  created:
    - apps/web/src/lib/data/grants.ts
    - apps/web/src/lib/data/ledger-repo.ts
    - apps/web/src/lib/data/ledger-repo.test.ts
    - apps/web/src/lib/data/cache-repo.ts
    - apps/web/src/lib/data/cache-repo.test.ts
    - apps/web/src/lib/data/ledger.concurrency.test.ts
  modified: []
key-decisions:
  - "Ledger and cap rows are built with newSyncable (ISO timestamps, uuid id); the cap pref uses the fixed DATA_PREF_IDS.rentcastCap id and keeps createdAt on rewrite"
  - "settle() bumps updatedAt (ISO) alongside status and settledAt so backup merge-by-updatedAt sees the settled row as newer"
  - "A grant is consumed only when the call is actually over the cap; a within-cap call leaves it unused"
  - "record() (key tests) bypasses the cap check and writes a settled row with overCap false"
  - "usage() reads rows and cap in one read-only transaction for a consistent snapshot"
requirements-completed: [DATA-03, DATA-04]
metrics:
  duration: 6min
  completed: 2026-10-05
  tasks: 2
  files: 6
---

# Phase 4 Plan 11: Transactional ledger, single-use grants and cache repo Summary

The cap is enforced in storage. `reserve()` reads the period's usage and the cap, then appends a pending ledger row, all inside one Dexie read-write transaction over `ledger` and `dataPrefs`. So two tabs at 39/40 cannot both take call #40, and a mutation test proves it. Rows store the HTTP status and never a billed flag. Over-cap overrides are single-use, unforgeable, in-memory grants bound to one request key. The cache repo serves lookups by canonical key and finds listings by id across cached listing responses.

## Tasks

| Task | Name | Commit |
| --- | --- | --- |
| 1 (RED) | Failing ledger, grant and cache repo tests | 215b062 |
| 1 (GREEN) | Transactional ledger, single-use grants, cache repo | 6318f1b |
| 2 | Cross-connection cap race test with mutation proof | ebd5b85 |

## Verification

- `corepack pnpm vitest run --project web ledger-repo cache-repo`: 25/25 pass.
- `corepack pnpm vitest run --project web ledger`: 21/21 pass (ledger-repo 18, concurrency 3).
- `corepack pnpm vitest run --project web`: 26 files, 323 tests, all pass (at the time of the run, with sibling wave-2 work in the tree).
- `corepack pnpm lint`: exit 0. `corepack pnpm guard`: passed (643 files).
- `corepack pnpm check`: my files are clean. The only errors at run time were in `lib/data/fixtures/fixture-fetch.test.ts`, which is plan 04-12's in-flight RED test (its module did not exist yet). That file is out of scope here.
- `grep -c useFakeTimers apps/web/src/lib/data/*.test.ts`: 0 for every file.
- `ledger-repo.ts` contains `transaction('rw'`, `db.ledger`, `db.dataPrefs`, `summarize(`, `'BudgetCapReached'` and `'pending'`, and has no `billed:`.

## Mutation proof

**Mutation:** in `reserve()`, the `summarize(...)` usage read and the cap read were moved into a separate `db.transaction('r', db.ledger, db.dataPrefs, ...)`. That transaction was awaited to completion before a second `db.transaction('rw', ...)` did the cap check and `ledger.add`.

**Mutated run** (`corepack pnpm vitest run --project web ledger.concurrency`):

```
     × two tabs at 39/40: exactly one takes call #40 66ms
     × holds over 20 fresh races 42ms
 FAIL  |web| src/lib/data/ledger.concurrency.test.ts > cap reservation across connections > two tabs at 39/40: exactly one takes call #40
AssertionError: expected [ { status: 'fulfilled', …(1) }, …(1) ] to have a length of 1 but got 2
      Tests  2 failed | 1 passed (3)
```

Both tabs reserved call #40. The control test (cap 41 at 39 used, both fulfilled) stayed green, so the guard test does not pass by rejecting everything.

**Revert:** `git checkout -- apps/web/src/lib/data/ledger-repo.ts`. After that, `git diff --exit-code apps/web/src/lib/data/ledger-repo.ts` exits 0 and the suite is green again (21/21). The mutation was never committed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's inline Syncable sketch did not match the shipped type**
- **Found during:** Task 1
- **Issue:** The plan's inline fallback (`createdAt: now`, `deletedAt: null`) would put numeric timestamps and a null `deletedAt` on ledger rows. The Phase 3 `SyncableSchema` requires ISO strings and an optional `deletedAt`, so a backup that contains the ledger would fail validation.
- **Fix:** Rows are built with `newSyncable({ id, now: new Date(now), schemaVersion: DATA_RECORD_SCHEMA_VERSION })`, as the 04-01 SUMMARY directs. `settle()` also updates `updatedAt` as an ISO string.
- **Files:** apps/web/src/lib/data/ledger-repo.ts
- **Commit:** 6318f1b

No Dexie schema change was needed. The `periodKey`, `endpoint` and `fetchedAt` indexes from 04-01 cover every query.

## Known Stubs

None.

## Self-Check: PASSED
