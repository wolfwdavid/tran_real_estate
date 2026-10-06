---
phase: 07-investor-portal
plan: 09
subsystem: investor-data-persistence
tags: [dexie, backup, repository, data-port, rentcast, markets, fixtures]
requires:
  - phase: 03 (TranDb, Syncable, backup registry)
  - phase: 04 (DataRuntime/gateway, mappers, fixtures, canonicalKey)
  - plan: 07-04 (ArtifactRepo.deleteBySubjectId / listBySubject)
  - plan: 07-05 (DealInputs, ANALYZER_VERSION)
  - plan: 07-06 (MarketStatsInput, addWatchedZip, rentTrendSeries)
provides:
  - TranDb version 5 (deals, investorDraft, buyBoxes, watchedZips), all backup-registered with record schemas
  - deals repo (createDeal/updateDeal/getDeal/listDeals/deleteDeal/dealsLive)
  - watched ZIPs repo (listWatchedZips/watchZip/unwatchZip/watchedZipsLive)
  - shared MarketsPort (MARKET_HISTORY_MONTHS, marketStatsRequest, createMarketsPort, useMarketsPort, toMarketStatsInput)
  - InvestorDataPort (createInvestorPort, useInvestorPort, investorRequest, saleListingsRequest, toCents)
  - MarketHistoryPoint.byBedrooms (per-month bedroom breakdown, mapped from RentCast history)
affects: [07-10, 07-12+, 07-UI plans using deals/markets/estimates, Phase 9 agent market reports]
tech-stack:
  added: []
  patterns:
    - "Per-table backup record schemas: BackupTable.schema, applied by previewImport (whole file rejected on any invalid row)"
    - "Deterministic uuid-shaped id per ZIP (watchedZipId) so backup merges never collide on the unique zip index"
    - "Ports take a Pick<DataRuntime> (gateway for free peek/estimate, requestSpend for spends) and are built via useXPort() during component init"
key-files:
  created:
    - apps/web/src/lib/features/investor/deals/schema.ts
    - apps/web/src/lib/features/investor/deals/tables.ts
    - apps/web/src/lib/features/investor/deals/dealsRepo.ts
    - apps/web/src/lib/features/investor/deals/dealsRepo.test.ts
    - apps/web/src/lib/features/shared/markets/watched-zip-record.ts
    - apps/web/src/lib/features/shared/markets/watchedZipsRepo.ts
    - apps/web/src/lib/features/shared/markets/watchedZipsRepo.test.ts
    - apps/web/src/lib/features/shared/markets/markets-port.ts
    - apps/web/src/lib/features/shared/markets/markets-port.test.ts
    - apps/web/src/lib/features/investor/data/investor-port.ts
    - apps/web/src/lib/features/investor/data/investor-port.test.ts
  modified:
    - apps/web/src/lib/storage/db.ts
    - apps/web/src/lib/storage/backup-registry.ts
    - apps/web/src/lib/storage/backup.ts
    - apps/web/src/lib/data/rentcast/mappers.ts
    - apps/web/src/lib/data/rentcast/mappers.test.ts
    - packages/core/src/listings/types.ts
    - scripts/gen-fixtures.mjs
    - apps/web/src/lib/data/fixtures/markets.json (regenerated)
    - apps/web/src/lib/features/renter/data/requests.ts
    - apps/web/src/lib/features/renter/data/renter-data.test.ts
    - apps/web/src/lib/storage/backup-registry.test.ts
    - apps/web/src/lib/storage/db.test.ts
    - apps/web/src/lib/features/renter/storage/renter-storage.test.ts
key-decisions:
  - "Phase 7 records are Phase 3 Syncable (ISO-string timestamps, deletedAt omitted on live rows), not the plan's numeric/null sketch: the backup envelope validates every row as Syncable"
  - "watchedZips keyed by a uuid derived from the ZIP ('id, &zip, addedAt'), unwatch tombstones and re-watch restores"
  - "Backup registry gains optional per-table record schemas; previewImport rejects a file with any invalid Phase 7 row (BackupError 'invalid')"
  - "Ports have no grant/grantFor: over-cap confirmation is the runtime's CapPrompt via requestSpend (grant issuing stays behind the gateway)"
  - "No lazy getInvestorPort()/dynamic import: getDataRuntime() reads Svelte context, so ports are built with useInvestorPort()/useMarketsPort() during component init"
  - "renter marketsRequest is now a re-export of the shared marketStatsRequest (one builder, one cache key for every portal)"
  - "Fixture per-month dataByBedrooms comes from a separate seeded stream so every previously generated value is byte-identical"
duration: 20min
completed: 2026-10-06
---

# Phase 7 Plan 09: Investor Persistence and Data Ports Summary

**Dexie v5 investor tables with schema-validated backup, an inputs-only deals repo that tombstones memo drafts in the same transaction, a cross-tab-safe watched-ZIP repo, and two peek-safe ports (shared markets, investor estimates/listings) over the Phase 4 runtime. Also includes the per-month bedroom data fix in the market mapper.**

## Performance
- Duration: ~20 min
- Tasks: 3 of 3, plus the required data-contract fix
- Files: 11 created, 13 modified

## Accomplishments
- **Data-contract fix (from 07-06):** `MarketHistoryPoint.byBedrooms?: MarketBreakdown[]` (additive). The mapper now reads `history[month].dataByBedrooms`. `scripts/gen-fixtures.mjs` now emits per-month bedroom breakdowns from a separate `createRandom(SEED ^ 0x5eedbed)` stream. A script confirmed the regenerated `markets.json` matches the old file once those keys are removed. `fixtures:check` passes. Two mapper tests were added: one maps the fixture month by month for both sides, the other checks that a month with no breakdown maps to `[]`. A mutation test that drops the mapping turns them red. All Phase 4 mapper tests still pass.
- **Task 1:** TranDb `version(5).stores(INVESTOR_STORES)` adds `deals` (`id, updatedAt, deletedAt`), `investorDraft` (`id`), `buyBoxes` (`id`) and `watchedZips` (`id, &zip, addedAt`). All four are in the registry's built-in list with labels and zod/mini record schemas. `dealRecordSchema` checks integer cents ≥ 0, bps between 0 and 10000, a rate between 0 and 25 or null, a term of 1 to 40 years, and that `deletedAt` is never null. The deals repo stores only DealData fields (computed keys are dropped). `deleteDeal` runs `db.transaction('rw', [deals, aiArtifacts])` → tombstone, then `deleteBySubjectId(id, at)`. If that call throws, the deal tombstone rolls back too (tested).
- **Task 2:** `watchZip` re-reads the live list inside a rw transaction and then applies core `addWatchedZip`. Concurrent calls in one connection and across two connections (two tabs) let exactly one fifth ZIP through. Unwatch tombstones only the watch row and leaves the cached `markets?...` entry alone. `marketStatsRequest` uses `{zipCode, dataType:'All', historyRange: MARKET_HISTORY_MONTHS}`. MarketsPort `peek`/`estimateCost` use only `gateway.peek`/`estimateCost`; `load` goes through `runtime.requestSpend` (get, or refresh when asked). It maps the domain object into `MarketStatsInput`, per-month bedrooms included, and a test shows `rentTrendSeries` on fixture data returns all 5 series over 24 months.
- **Task 3:** InvestorDataPort builds AVM rent/value requests (address, plus propertyType/bedrooms/bathrooms/squareFootage only when given, compCount 15). It builds the fetch-wide sale-listings request through the core `normalizeLocation` (Active, limit 500; `truncated` comes from the gateway flag or 500 rows). Every peek is gateway.peek only, with get/refresh/requestSpend spies all at 0. `toCents` (`Math.round(d*100)`) is the one place dollars become cents: 1850.4 → 185040. A boundary test scans `features/investor` for value imports of `$lib/data` outside the adapter.

## Task Commits
| # | Commit | Message |
|---|--------|---------|
| fix RED | 54d352e | test(07-09): failing per-month bedroom breakdown mapper tests |
| fix GREEN | acb72af | fix(07-09): map each market history month's bedroom breakdown |
| 1 RED | dc47769 | test(07-09): deals repo, v5 tables and backup round-trip tests |
| 1 GREEN | fb7ca05 | feat(07-09): investor tables and deals repo |
| 2 RED | 3a3a754 | test(07-09): watched zips cap/concurrency and markets port tests |
| 2 GREEN | 48096d8 | feat(07-09): watched zips and markets port |
| 2 fix | e84c214 | fix(07-09): keep shared markets free of portal-folder imports |
| 3 RED | 379926a | test(07-09): investor data port tests |
| 3 GREEN | 7b17240 | feat(07-09): investor data port |

Note: for Tasks 1 to 3 the test and implementation files were written together and committed as separate test-then-feat commits. RED was shown by mutation runs rather than by a failing commit (see below).

## Mutation tests (memory guidance)
- Per-month bedroom mapping removed → 2 mapper tests red (the RED commit).
- `INVESTOR_BACKUP_TABLES` removed from the registry defaults → 9 tests red.
- Backup import schema check disabled → the negative-priceCents import test red.
- `deleteBySubjectId` call removed from deleteDeal → 3 tests red.
- Watched-ZIP list read moved outside the transaction → the concurrent and two-tab tests red.
- Removing the v5 block makes `db.deals` undefined, and every repo test plus the version-block assertion fails.

## Deviations from Plan

### Auto-fixed / adapted
1. **[Rule 3 - Blocking] Syncable shape.** The plan's `DealRecord` sketch used numeric timestamps and `deletedAt: null`. The Phase 3 backup envelope validates every row against `SyncableSchema` (ISO strings, `deletedAt` optional and never null), so all Phase 7 rows use `newSyncable`/`tombstone`. `WatchedZip` keeps numeric `addedAt` for ordering.
2. **[Rule 3] watchedZips store key.** It is `'id, &zip, addedAt'`, not `'zip, addedAt'`, because backup merge works by Syncable `id`. The id comes from `watchedZipId(zip)` (`00000000-0000-4000-8000-0000000<zip>`), so it is the same on every device.
3. **[Rule 2 - Missing critical] Per-table import validation.** The backup registry had no schema hook, so a deal with negative cents could be imported. Added an optional `BackupTable.schema` and a check in `previewImport` (`apps/web/src/lib/storage/backup.ts`, a file outside the declared list; no parallel plan touches it).
4. **[Rule 3] No `grant`/`grantFor` on the ports.** Over-cap confirmation already lives in `runtime.requestSpend`'s CapPrompt, and `$lib/data` deliberately does not export grant issuing. The spending methods take no grant option.
5. **[Rule 3] No lazy `getInvestorPort()` via dynamic import.** `getDataRuntime()` reads Svelte context, so it cannot be called after an `await import`. `useInvestorPort()`/`useMarketsPort()` are called during component init, which matches how renter components use `getDataRuntime()`.
6. **[Rule 3] Exact-list tests updated.** Existing exact-list assertions were updated: `db.test.ts` (tables, verno 5), `backup-registry.test.ts` (defaults include `INVESTOR_BACKUP_TABLES`), and the renter "version block higher than every earlier block" check, which now compares only blocks declared before it (append-only intent kept).
7. **[Rule 3 - lint] Portal-folder import.** The shared markets code may not import portal folders. The watched-ZIP schema version lives in `watched-zip-record.ts`, and the renter parity assertion (`marketsRequest === marketStatsRequest`) moved to `renter-data.test.ts`. `markets-port.test.ts` imports the fixture, mapper and schemas with justified `eslint-disable-next-line` lines (same precedent as the saved-searches and DataShell tests).
8. **Data-contract fix** (required by the orchestrator, recorded here): `MarketHistoryPoint.byBedrooms`, plus the mapper, generator and fixture changes described above.

## Verification
- `corepack pnpm test:unit`: 191 files, 3884 tests, all passing.
- `corepack pnpm check`: 0 errors. `corepack pnpm lint`: clean. `corepack pnpm fixtures:check`: match.
- `grep -rln "\$lib/data'" apps/web/src/lib/features/investor` returns only `data/investor-port.ts` and its test file. The test file match is its test title ("…value import from $lib/data'"), not an import.

## Requirements advanced (not marked complete; orchestrator owns that)
- INV-02 (saved deals persistence + backup), INV-03 (estimate/listing data seam), INV-05 (watched ZIPs + market stats seam with per-month bedroom data).

## Known Stubs
- `investorDraft` and `buyBoxes` have tables and a permissive Syncable schema but no repository yet. Their row shapes belong to the plans that write them (analyzer draft autosave, buy-box finder).

## Self-Check: PASSED
