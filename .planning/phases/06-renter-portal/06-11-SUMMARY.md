---
phase: 06-renter-portal
plan: 11
subsystem: renter-data
tags: [renter, gateway, dexie, shortlist, saved-search, backup, tdd, mutation-test]
requires:
  - "06-01 @tran/core/renter toServerParams, DEFAULT_FILTERS, applyFilters"
  - "06-08 @tran/core/renter shortlistItemSchema, renterSearchMetaSchema, changeStatus, MAX_NOTES"
  - "04-13/04-17 DataGateway (peek, peekListingById, estimateCost, get, refresh, rentalListingById)"
  - "04-18 $lib/data public port (createDataRuntime, SAMPLE_METROS, Provenance, DataRequest)"
  - "Phase 3 TranDb append-only versions, backup registry, backup export/import"
provides:
  - "$lib/features/renter/data/requests: searchRequest, listingByIdRequest, marketsRequest, rentEstimateRequest, RENT_ESTIMATE_COMPS, RentEstimateSubject"
  - "$lib/features/renter/storage/tables: RENTER_SHORTLIST_TABLE/LABEL, RENTER_SEARCH_META_TABLE/LABEL, RENTER_BACKUP_TABLES, RENTER_RECORD_SCHEMA_VERSION, shortlistTable, searchMetaTable"
  - "$lib/features/renter/storage/shortlist-repo: createShortlistRepo(db, clock, {uuid}), getShortlistRepo, ShortlistRepo, ShortlistListing"
  - "$lib/features/renter/storage/search-meta-repo: createSearchMetaRepo(db, clock), getSearchMetaRepo, SearchMetaRepo, SearchMetaValue"
  - "TranDb version 4 (renterShortlist, renterSearchMeta)"
affects: [06-13..06-21 renter UI plans (search, detail, shortlist board, saved searches), Phase 7 (markets cache parity), Phases 7/8 (next Dexie version is 5)]
tech-stack:
  added: []
  patterns:
    - "Renter request shapes live in ONE module; UI plans compose them with the $lib/data gateway"
    - "Tombstone restore on a unique index: look up the key INCLUDING tombstones, put the same row back with deletedAt removed"
    - "Dependency-free tables module feeds the backup registry's built-in list (Phase 4/5 pattern)"
key-files:
  created:
    - apps/web/src/lib/features/renter/data/requests.ts
    - apps/web/src/lib/features/renter/data/renter-data.test.ts
    - apps/web/src/lib/data/gateway.renter.test.ts
    - apps/web/src/lib/features/renter/storage/tables.ts
    - apps/web/src/lib/features/renter/storage/shortlist-repo.ts
    - apps/web/src/lib/features/renter/storage/search-meta-repo.ts
    - apps/web/src/lib/features/renter/storage/renter-storage.test.ts
    - apps/web/src/lib/features/renter/storage/renter-storage.browser.test.ts
  modified:
    - apps/web/src/lib/storage/db.ts
    - apps/web/src/lib/storage/backup-registry.ts
    - apps/web/src/lib/storage/db.test.ts
    - apps/web/src/lib/storage/backup-registry.test.ts
    - apps/web/src/lib/storage/backup.test.ts
key-decisions:
  - "No gateway change: Phase 4 already ships peek, peekListingById, estimateCost and rentalListingById with the planned semantics. lib/data/gateway.ts and lib/data/index.ts are untouched; the contract is proven by call-count tests."
  - "Fixtures already rebase (04-12 rebaseFixtures), so no fixture-fetch change; a mutation (shift = 0) turns the 400-day decay test red."
  - "marketsRequest is defined locally ({ zipCode, dataType: 'All', historyRange: 24 }); Phase 7's markets-port.ts does not exist yet. When 07-09 lands it should import or match this; the canonical key is asserted."
  - "Renter tables take Dexie version 4. Phases 7/8 take 5+."
  - "Backup registration goes through the registry's built-in DEFAULT_TABLES (spread of RENTER_BACKUP_TABLES), not a runtime registerBackupTable() call from tables.ts: a Settings backup must include the shortlist even if no renter module has loaded, and a runtime call from tables.ts would create an import cycle with the registry."
  - "A restored tombstone has deletedAt REMOVED (per 06-08), not null; the plan's 'deletedAt null' wording was not followed literally."
  - "Re-adding a removed listing restarts it: same id and createdAt, status saved with a fresh one-entry history, empty notes, fresh snapshot and provenance."
  - "liveCount() returns a Dexie liveQuery Observable (Svelte-store-compatible); proven in the browser project because liveQuery does not emit under fake-indexeddb in Node."
requirements-completed: []
metrics:
  duration: ~40min
  completed: 2026-10-05
  tasks: 2
  files: 13
---

# Phase 6 Plan 11: Renter data contract and storage Summary

Every renter RentCast request now comes from one module, `features/renter/data/requests.ts`. The Phase 4 gateway's 0-call reads and its 1-call by-id lookup are proven against those requests. Sample mode serves every fixture metro at 0 network calls, and its listings still fall inside "listed within 7 days" 400 days after the anchor. The shortlist and saved-search filters persist in Dexie version 4 with tombstone restore, and both appear in backups as "Rental shortlist" and "Saved rental searches".

Advances RENT-01 (search requests), RENT-03 (markets and rent-estimate requests for the fair-rent check), RENT-04 (saved-search meta storage), RENT-05 (shortlist storage) and RENT-06 (by-id detail lookup at 0 or 1 call). All of them stay open until the 06-22 gate.

## Phase 4 names used (all already shipped; no additions)

| Plan contract | Shipped name | Notes |
| --- | --- | --- |
| `peek(req)` | `DataGateway.peek<T>(req)` → `{ kind: 'data', result } \| { kind: 'error', error } \| undefined` | The result shape is a tagged union, not `{ rows }` |
| `peekListingById(id)` | `DataGateway.peekListingById(id)` → `{ listing, provenance } \| undefined` | Field is `listing`, not `row`. Scans `rental-listings` and `rental-listing-by-id` cache bodies via `cache-repo.findListingById` |
| `estimateCost(req)` | `DataGateway.estimateCost(req)` → `{ calls, reason: 'sample' \| 'cached' \| 'network' }` | |
| `get` / `refresh` | unchanged | |
| `rentalListingById(id, opts)` | unchanged; uses core `buildListingByIdRequest` | Same params as `listingByIdRequest` |
| Public port | `$lib/data`: `createDataRuntime`, `SAMPLE_METROS`, `DataGateway`, `DataRequest`, `Provenance` | `index.ts` not changed |
| Mode | `runtime.mode.source` (`'sample' \| 'rentcast'`) | |

## Tasks

| # | Task | Commits |
| --- | --- | --- |
| 1 | Renter request builders and gateway 0-call/by-id contract | 3d30048 (RED), da95312 (GREEN) |
| 2 | Renter Dexie tables, shortlist and search-meta repos, backup registration | 1eaf14c (RED), 542b743 (GREEN) |

## What the tests prove

- **renter-data.test.ts (18):**
  - The wide search is exactly location + Active + limit 500, and its canonical key is the same for any filter set.
  - Narrow mode adds `price`, `bedrooms`, `propertyType` and `daysOld`.
  - The by-id request carries the raw id.
  - `marketsRequest('74201')` equals Phase 7's params, with key `markets?dataType=All&historyRange=24&zipCode=74201`.
  - The rent estimate asks for 15 comps and omits null facts.
  - Through the public port, `createDataRuntime` in sample mode returns rows from `peek` for all 6 fixture ZIPs. It also answers `peekListingById` for a fixture id, and `estimateCost` gives `{ 0, 'sample' }`. All of this makes 0 network calls.
  - For each metro at `anchor + 400 days`, `listedWithin: 7` still leaves at least one row.
- **gateway.renter.test.ts (5):**
  - Before any spend, `peek` returns undefined, the estimate is 1 network call, and nothing is fetched.
  - After one `get`, `peek` keeps the original `fetchedAt`, `peekListingById` finds the row, a missing id returns undefined, and the estimate is `{ 0, 'cached' }`. The spy stays at `toHaveLength(1)`.
  - The narrow request is its own cache entry.
  - `rentalListingById('A,1 b')` makes 1 fetch to the percent-encoded path. A repeat 23h later makes 0, and the by-id entry is then visible to `peekListingById`.
- **renter-storage.test.ts (18):**
  - Version 4 is the highest block and holds both tables, with a unique `listingId` index.
  - A Phase-3-only database upgrades in place.
  - `add` creates a valid Saved item and sets `firstRecordAt`. A duplicate add returns the existing item.
  - Remove, then re-add, gives no ConstraintError and keeps the same id and createdAt. `deletedAt` is absent, not null.
  - `setStatus` appends history, and setting the same status writes nothing. `setNotes` accepts 2000 characters and throws RangeError at 2001 without writing.
  - Writes to a missing or removed listing are no-ops. Tombstones are ignored by `getByListingId`, `liveAll` and `count`.
  - The search-meta repo covers put, get, upsert (createdAt kept), invalid filters or location rejected, and tombstone plus restore.
  - Both labels are in the default registry. An export, then replace-import, round trip keeps notes and status history.
  - A Phase 4 `Listing` is assignable to `add`'s input, checked at the type level.
- **renter-storage.browser.test.ts (1):** in real Chromium, `liveCount` follows add, remove and restore.

## Mutation runs (recorded, not committed; files restored from copies)

| Mutation | Killed by |
| --- | --- |
| Fixture rebasing off (`shiftMs = 0`) | 3 decay tests red |
| `...RENTER_BACKUP_TABLES` removed from DEFAULT_TABLES | 9 red (XOR coverage, schema-registry, labels, round trip) |
| `this.version(4)` block removed | 38 red |
| Restore writes `deletedAt: null` | 1 red (schema rejects null) |
| `add` looks up live rows only (insert over tombstone) | 1 red (ConstraintError) |
| `liveCount` counts tombstones | browser test red |

## Verification

- `corepack pnpm vitest run --project web src/lib/data src/lib/features/renter src/lib/storage`: 490 passed
- `corepack pnpm vitest run --project web-browser src/lib/features/renter/storage`: 1 passed
- `corepack pnpm test:unit`: 149 files, 3017 tests passed
- `corepack pnpm check`: 0 errors. `corepack pnpm lint`: clean. `corepack pnpm guard`: passed
- `grep -rn "fetch(" apps/web/src/lib/features/renter`: no output

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `deletedAt` is removed on restore, never null**
- The plan says a restore sets `deletedAt null`. 06-08's schemas and Phase 3's backup validator reject null, so the field is destructured out before the put. Tests assert `'deletedAt' in row === false`.
- **Commit:** 542b743

**2. [Rule 1 - Bug] Repo input types accept what the UI actually holds**
- **Issue:** The schema-inferred types did not accept the UI's values. 06-08's listing snapshot type has an index signature, so a Phase 4 `Listing` interface was not assignable to it. `RentalFilters.types` is readonly, and the meta schema's types are mutable.
- **Fix:** `ShortlistListing` is now `{ readonly id; readonly price }`, and the full row is still snapshotted. `SearchMetaValue` uses `RenterLocation`, `RentalFilters` and `RenterSortId`, and copies the types array before validation.
- **Commit:** 542b743

**3. [Rule 3 - Blocking] Earlier tests pinned version 3 and the default registry list**
- `db.test.ts` now expects verno 4 with the renter tables, and its upgrade test checks the new tables. `backup-registry.test.ts` DEFAULTS includes `RENTER_BACKUP_TABLES`. In `backup.test.ts`, TestDb's extra table moved to version 5 so it no longer shares version 4. No assertion was weakened.
- **Commit:** 542b743

**4. Backup registration path (acceptance grep)**
- `tables.ts` does not call `registerBackupTable` at runtime. Its header comment explains why. The entries go through the registry's built-in list, as Phases 4 and 5 do, so the XOR coverage test enforces them and a Settings backup always includes them. The labels match the plan exactly.

**5. liveCount tested in the browser project**
- Dexie liveQuery never emits under fake-indexeddb in the Node project, as Phase 3 and 4 also found. The emission test is therefore `renter-storage.browser.test.ts`.

## Notes for downstream plans

- Import the request builders from `$lib/features/renter/data/requests`. Spend only with `runtime.requestSpend(searchRequest(...))` or `gateway.rentalListingById(id)` in click handlers. Views read with `createPeekStore` / `peek` / `peekListingById`.
- Detail route resolution order: `peekListingById(id)` (0 calls). If that finds nothing, offer "Load listing", which calls `rentalListingById(id)` (1 call, 24h TTL).
- Shortlist: `getShortlistRepo()` from onMount or event handlers. Use `live(() => repo.liveAll(), [])` for lists and `repo.liveCount()` for the badge. The first-save click handler must call `requestPersistence()` itself.
- Saved searches: create the Phase 4 `savedSearches` row first, then `getSearchMetaRepo().put(sameId, { location, filters, sort })`.
- Next free Dexie version: **5**.

## Known Stubs

None.

## Self-Check: PASSED
