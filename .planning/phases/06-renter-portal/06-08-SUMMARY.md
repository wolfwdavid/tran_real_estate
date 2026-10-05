---
phase: 06-renter-portal
plan: 08
subsystem: renter-core
tags: [renter, shortlist, saved-search, zod, syncable, backup, tdd, mutation-test]
requires:
  - "06-01 renter types (RENTER_PROPERTY_TYPES, LISTED_WITHIN, RenterLocation, RentalFilters)"
  - "Phase 3 SyncableSchema (packages/core/src/syncable.ts)"
provides:
  - "@tran/core/renter/records: SHORTLIST_STATUSES, ShortlistStatus, STATUS_LABELS, MAX_NOTES, NOTES_PREVIEW, MAX_SAVED_SEARCHES, RENTER_SORT_IDS, RenterSortId, shortlistItemSchema, ShortlistItem, renterSearchMetaSchema, RenterSearchMeta, changeStatus, needsRemoveConfirm, shortlistSummary, groupByStatus, notesPreview, canSaveAnother"
  - "Also re-exported from the @tran/core/renter barrel"
affects: [06-11 (shortlist + search-meta repos), 06-15 (ShortlistBoard), 06-20 (renter saved searches)]
tech-stack:
  added: []
  patterns:
    - "Record schemas = z.extend(SyncableSchema, {...}), so every row passes the Phase 3 backup validator"
    - "Syncable timestamps ISO; domain times epoch ms (matches Phase 4 lastRunAt/fetchedAt)"
key-files:
  created:
    - packages/core/src/renter/records.ts
    - packages/core/src/renter/records.test.ts
  modified:
    - packages/core/src/renter/index.ts
key-decisions:
  - "changeStatus(item, status, now: epoch ms) sets statusChangedAt = now and updatedAt = new Date(now).toISOString(). The plan sketch had numeric updatedAt, but Phase 3's Syncable requires ISO."
  - "Renter search meta is a companion row with the same id as the Phase 4 savedSearches row. Phase 4 keeps name, endpoint, wide params, lastRunAt/lastSeenAt and claims; meta keeps location, filters and sort. There is no parallel saved-search model."
  - "deletedAt is optional ISO and null is rejected by both schemas, so a restored tombstone must DELETE the field. 06-11's 'deletedAt null' wording must not be taken literally."
  - "Any status may follow any other, so a renter can correct a mistaken move. Moving to the same status returns the identical object, with no history entry and no write."
  - "Whitespace-only notes do not trigger the remove confirmation."
requirements-completed: []
metrics:
  duration: 15min
  completed: 2026-10-05
  tasks: 1
  files: 3
---

# Phase 6 Plan 08: Renter record schemas and record logic Summary

This plan adds the shortlist item and renter search-meta schemas in zod/mini. Both extend Phase 3's `SyncableSchema`, and they come with the pure shortlist logic: the five-status pipeline with history, a 2,000-character notes cap, a remove-confirm rule, summary counts, grouping, notes preview, and a 10-saved-search limit. All of it is tested first and mutation-checked.

## Tasks

| Task | Name | Commits |
| --- | --- | --- |
| 1 | Shortlist and saved-search meta schemas with record logic | 9eab751 (RED), 1f9648f (GREEN) |

## What the tests prove (records.test.ts, 50 tests)

- The five statuses run in pipeline order with the UI-SPEC labels. `MAX_NOTES` is 2000, `NOTES_PREVIEW` is 120 and `MAX_SAVED_SEARCHES` is 10.
- `shortlistItemSchema` accepts a full item, every status, sample provenance and an ISO tombstone. It rejects an unknown status (also inside the history), 2,001-character notes, a missing or empty listingId, `provenance.source: 'other'`, missing Syncable fields and **`deletedAt: null`**. The listing snapshot keeps `history`, `listingAgent` and `listingOffice` through a parse.
- `changeStatus(item, 'toured', 5000)` returns a new object with the status, `statusChangedAt` 5000, ISO `updatedAt` and one appended history entry, and the input is not mutated. The same status returns the same reference with no history entry. A backwards move is allowed.
- `needsRemoveConfirm` is false for a Saved item with empty or whitespace-only notes and true for real notes or any later status.
- `shortlistSummary` and `groupByStatus` skip tombstones. Grouping returns all five keys in pipeline order, sorted by `statusChangedAt` descending and then by `listingId`, and leaves the input array in its original order.
- `renterSearchMetaSchema` accepts zip and city searches and every beds, listedWithin and sort value. It rejects beds 9 or '4', types ['Land'], listedWithin 5, a negative or fractional price, a 4- or 6-digit zip, a lowercase state, an empty city, an unknown sort, `deletedAt: null` and a missing id.
- `canSaveAnother` returns true for 0 and 9 and false for 10 and 11.
- `RENTER_SORT_IDS` equals the ids in 06-07's `SORT_OPTIONS`. `sort.ts` had merged by the time GREEN ran, so this test **ran and passed** instead of being skipped. It loads the module through a runtime import, so it compiles either way.

## Mutation runs (recorded, not committed; file restored, 50/50 green after)

| Mutation | Killed by |
| --- | --- |
| `count <= MAX_SAVED_SEARCHES` | canSaveAnother(10) (1 red) |
| Same-status guard removed | same-status unchanged (1 red) |
| History not appended | 2 red |
| No `trim()` in remove-confirm | whitespace notes (1 red) |
| Status ignored in remove-confirm | later statuses (1 red) |
| Applied bucket includes toured | 2 red |
| Contacted bucket includes saved | 2 red |
| Group sort ascending | sort order (1 red) |
| Tombstones grouped | non-deleted only (1 red) |
| Notes cap 2001 | 2,001 rejected (1 red) |

## Verification

- `corepack pnpm vitest run --project core packages/core/src/renter`: 12 files, 250 tests, all pass.
- `corepack pnpm --filter @tran/core check`: clean.
- `corepack pnpm lint` (prettier + eslint across the repo): clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `updatedAt` must be ISO, not a number**
- **Found during:** Task 1
- **Issue:** The plan's behavior says `changeStatus(..., now=5000)` sets `updatedAt 5000`. Phase 3's `SyncableSchema` requires `updatedAt` to be an ISO datetime, and backup merge compares ISO strings, so a numeric value would fail backup validation.
- **Fix:** `now` stays epoch ms for `statusChangedAt` and the history, and `updatedAt = new Date(now).toISOString()`. The test asserts exactly that.
- **Commit:** 1f9648f

**2. [Rule 2 - Missing critical] Barrel export**
- `export * from './records.js'` was appended to `packages/core/src/renter/index.ts` (append only), so consumers of `@tran/core/renter` get the records too. It was checked for name collisions with the other renter modules first.

`packages/core/package.json` was not changed: zod 4.6.4 is already a dependency of core, and the `./renter/*` export exists.

## Notes for 06-11 / 06-15 / 06-20

- When restoring a tombstoned shortlist row (unique `&listingId`), remove `deletedAt` from the row (Dexie `update(id, { deletedAt: undefined })` or a full `put` without the key). Do not set it to `null`, because the schema rejects null.
- The search-meta row id must equal the Phase 4 `savedSearches` row id. Count live **renter** Phase 4 rows for `canSaveAnother`.
- The status meta line ("{Status} {Mon D}") reads `statusChangedAt` (epoch ms).

## Requirements advanced

RENT-04 (saved-search meta schema + 10 limit) and RENT-05 (status pipeline + notes). Both stay open until the 06-22 gate, so they are not marked complete.

## Known Stubs

None.

## Self-Check: PASSED
