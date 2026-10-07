---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 11
subsystem: studio-storage
tags: [studio, dexie, backup, snapshots, autosave, privacy, tdd]
requires:
  - phase: 03
    provides: "TranDb (db.ts) append-only version history, backup registry DEFAULT_TABLES, backup envelope (Syncable rows), buildBackupText / previewImport / applyImport"
  - phase: 04
    provides: "schema-registry.test.ts (versions strictly increase, every table registered XOR excluded)"
  - phase: 07
    provides: "analyzer draft autosave pattern (fixed uuid row id, 500 ms debounce, injectable timers); ZipTrendChart / PriceToRentChart `stats: MarketStatsInput` prop"
  - phase: 09-10
    provides: "@tran/core/studio barrel (AggregatedSample, AGGREGATED_SAMPLE_KEYS, BEDROOM_AGGREGATE_KEYS, SnapshotMetrics, DisclosureProfile)"
provides:
  - "TranDb version 7: studioDraft ('tool') + snapshots ('id, createdAt, zip') via STUDIO_STORES"
  - "$lib/storage/studio/types: StudioTool, STUDIO_TOOLS, StudioDraftRecord, SNAPSHOT_SECTION_KEYS, SnapshotSectionKey, SnapshotNarrative, SnapshotOptions, SnapshotAgent, SnapshotSeries, SnapshotRecord"
  - "$lib/storage/studio/tables: STUDIO_STORES, STUDIO_DRAFT_IDS, snapshotViolations, FORBIDDEN_SNAPSHOT_KEYS, SNAPSHOT_RECORD_KEYS, studioDraftRowSchema, snapshotRowSchema, STUDIO_BACKUP_TABLES"
  - "$lib/storage/studio/studio-draft-repo: getStudioDraft, putStudioDraft, clearStudioDraft"
  - "$lib/storage/studio/snapshots-repo: addSnapshot, getSnapshot, listSnapshots, deleteSnapshot, countSnapshots, SnapshotPrivacyError"
  - "$lib/storage/studio/autosave.svelte: createStudioAutosave(tool, delayMs = 500, opts) -> { load, schedule, flush, destroy }"
affects: [09-12, 09-14, 09-15, 09-17, 09-18, 09-20, 09-22, 09-23]
tech-stack:
  added: []
  patterns:
    - "Keyed-by-tool table whose rows still carry a fixed per-tool uuid id so the Syncable backup envelope accepts them and merges update the same row"
    - "Frozen record stored with Syncable stamps added by the repo and stripped on read, so the domain type stays stamp-free (09-14's id 'sample' record type-checks)"
    - "Privacy guard as a pure function shared by the write path and the backup import schema (z.refine)"
key-files:
  created:
    - apps/web/src/lib/storage/studio/types.ts
    - apps/web/src/lib/storage/studio/tables.ts
    - apps/web/src/lib/storage/studio/studio-draft-repo.ts
    - apps/web/src/lib/storage/studio/snapshots-repo.ts
    - apps/web/src/lib/storage/studio/autosave.svelte.ts
    - apps/web/src/lib/storage/studio/studio-storage.test.ts
  modified:
    - apps/web/src/lib/storage/db.ts
    - apps/web/src/lib/storage/backup-registry.ts
    - apps/web/src/lib/storage/db.test.ts
    - apps/web/src/lib/storage/backup-registry.test.ts
key-decisions:
  - "Studio version block is this.version(7).stores(STUDIO_STORES); blocks 1-6 byte-unchanged (db.ts diff is additions only)"
  - "Both tables are in the registry's built-in DEFAULT_TABLES (Phase 7/8 pattern), not a runtime registerBackupTable call, so a Settings backup made before any studio module loads includes them"
  - "studioDraft rows carry fixed per-tool uuids (STUDIO_DRAFT_IDS ...57d01-04); the backup schema checks id === STUDIO_DRAFT_IDS[tool]"
  - "SnapshotRecord stays stamp-free (as the plan's interface); the stored SnapshotRow adds ownerId 'local', updatedAt = createdAt, schemaVersion 1; addSnapshot refuses a non-uuid id, so the 09-14 'sample' record can never be stored"
  - "Snapshots are frozen: add uses table.add (a duplicate id is refused), no update API; delete is a hard delete like the Phase 7 analyzer draft (the indexes have no deletedAt), while reads still skip any imported tombstone"
  - "Privacy guard = top-level key whitelist (SNAPSHOT_RECORD_KEYS) + listingsSample keys within AGGREGATED_SAMPLE_KEYS / BEDROOM_AGGREGATE_KEYS + forbidden keys anywhere (formattedAddress, addressLine1, addressLine2, listingAgent, listingOffice, photos, mlsNumber, logo, raw, response) + any Blob / ArrayBuffer / typed array anywhere; the same guard runs on backup import via snapshotRowSchema"
  - "series is typed as MarketStatsInput | null per chart (the exact `stats` prop of the Phase 7 ZipTrendChart / PriceToRentChart)"
  - "Autosave load() is bound to the helper's tool (no tool argument); schedule() snapshots with $state.snapshot so a live proxy is safe; timers are injected (no Vitest fake timers with fake-indexeddb)"
requirements-completed: []
duration: ~16min
completed: 2026-10-07
---

# Phase 9 Plan 11: Studio drafts and snapshots storage Summary

**TranDb version 7 adds `studioDraft` (one autosaved form per tool) and `snapshots` (frozen Market Snapshot records), both in the backup as "Studio forms" and "Market Snapshots". Every saved snapshot passes an aggregate-only privacy guard on write and again on backup import. `createStudioAutosave(tool)` writes each studio form 500 ms after the last change, with no leave-page prompt.**

## Performance

- **Duration:** about 16 min (single core, mask 0x100, alongside 09-13)
- **Completed:** 2026-10-07T11:12Z
- **Tasks:** 2
- **Files:** 6 created, 4 modified

## Accomplishments

- **Schema:** `STUDIO_STORES = { studioDraft: 'tool', snapshots: 'id, createdAt, zip' }`, added to db.ts as one block: `this.version(7).stores(STUDIO_STORES)`. The db.ts diff only adds lines: two imports, two typed table fields, and the block with its comment.
- **Backup:** `STUDIO_BACKUP_TABLES` is appended to the registry's built-in list with record schemas:
  - `studioDraftRowSchema`: a Syncable row with a known tool, and its id must be that tool's fixed id.
  - `snapshotRowSchema`: a Syncable row with zip, sample and source fields, and it re-runs the privacy guard.
  - The schema-registry coverage test passes unchanged: both tables are registered, none are excluded, and versions strictly increase.
- **Repositories:**
  - Drafts: `getStudioDraft`, `putStudioDraft` (a rewrite keeps the original createdAt) and `clearStudioDraft` (removes one tool only).
  - Snapshots: `addSnapshot` (guard first, then uuid check, then `table.add`), `getSnapshot`, `listSnapshots` (newest createdAt first), `deleteSnapshot` and `countSnapshots`.
- **Autosave:** `createStudioAutosave(tool, delayMs = 500, { setTimer, clearTimer, write, read, onError })`, following the Phase 7 analyzer autosaver.
  - Only the last scheduled form is written. `flush()` writes immediately, and `destroy()` cancels a pending write and ignores any later ones.
  - A failed write goes to `onError` and is never thrown.

## Task Commits

1. **Task 1: tables, types, repositories, backup registration:** `f9b06d3` (feat)
2. **Task 2: 500 ms autosave helper:** `9298fa7` (feat)

Both commits used an explicit pathspec, and `git diff --cached --name-only` was checked before each one.

## Verification

- `vitest run --project web studio-storage`: **30 passed**. That is 25 Task 1 cases (version 7, drafts, snapshots, guard, backup) and 5 autosave cases.
- Storage, backup and migration suites: studio-storage, schema-registry, storage/db.test, storage/backup*, storage/agent/*, platform.test, deals*, renter-storage and artifacts gave **15 files, 241 passed**. The new v6 to v7 upgrade test (in db.test.ts) and the existing v2 and v5 upgrade tests pass.
- Full `vitest run --project web`: **144 files, 2178 passed**.
- `vitest run --project scripts`: 14 files, **504 passed**. `vitest run --project core backup`: 4 files, **57 passed**.
- `pnpm check`: 0 errors, 0 warnings (2549 files). `pnpm lint` (prettier + eslint, repo-wide): clean. `pnpm banned`: passed.
- **Mutation proof:** with the deep forbidden-key and binary walk disabled, 8 tests fail: the 6 forbidden-key cases, the logo case and the tampered-import case. The file was restored from a copy and `git diff` was clean afterwards.
- Acceptance greps:
  - `tables.ts` contains `studioDraft: 'tool'` and `snapshots: 'id, createdAt, zip'`. The labels `'Studio forms'` and `'Market Snapshots'` are in `STUDIO_BACKUP_TABLES`.
  - The test file contains `formattedAddress` and `listSnapshots`. `autosave.svelte.ts` contains `delayMs = 500` and `export function createStudioAutosave`.
  - `grep -rn beforeunload apps/web/src/lib/storage/studio` finds nothing.
- No Playwright or build was needed. `apps/web/test-results` does not exist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated two existing tests that pin the schema version and the default registry**
- **Found during:** Task 1
- **Issue:**
  - `storage/db.test.ts` asserts `verno` 6 and lists every table.
  - `storage/backup-registry.test.ts` asserts the exact DEFAULTS list.
  - Both fail on any additive bump. Phase 8 edited the same two files the same way.
- **Fix:**
  - db.test.ts: the version is now 7 in three places, `STUDIO_STORES` keys are added to the table list, and a new v6 to v7 upgrade test checks that agent rows are kept and the studio tables start empty. No existing assertion was removed.
  - backup-registry.test.ts: `...STUDIO_BACKUP_TABLES` is appended to DEFAULTS and to the re-register expectation.
- **Why the upgrade test is in db.test.ts:** the studio test cannot import `$lib/data/tables` (eslint `no-restricted-imports`), and db.test.ts already does.
- **Commit:** `f9b06d3`

**2. [Rule 2 - Correctness] Snapshot and draft rows are full Syncable records**
- The plan's `StudioDraftRecord` and `SnapshotRecord` have no Syncable stamps, but the Phase 3 backup envelope rejects any row without a uuid id, ownerId, timestamps and schemaVersion.
- The repositories add the stamps when writing and strip them when reading, so the domain types match the plan's interface. Drafts get a fixed uuid per tool; snapshots must have a uuid id.
- **Commit:** `f9b06d3`

**3. [Interpretation] `load()` takes no argument**
- The plan's behaviour line says `load(tool)`, but the helper is created for one tool, so `load()` reads that tool's form.

**Total deviations:** 2 auto-fixed (Rule 3, Rule 2) and 1 interpretation. No scope creep.

## Notes for downstream plans

- 09-14 `buildSnapshotRecord` must emit only the 14 `SNAPSHOT_RECORD_KEYS`. It also must not include `logo`, `raw`, `response` or any listing field anywhere, or `addSnapshot` throws `SnapshotPrivacyError`, whose `violations` lists the offending paths. The 09-14 `SAMPLE_SNAPSHOT_RECORD` (id `'sample'`) type-checks as a `SnapshotRecord` but is refused by `addSnapshot`. That is intended: the print route reads it directly.
- 09-17 and 09-18: `addSnapshot` refuses a duplicate id, so generate a fresh `crypto.randomUUID()` for every save.

## Requirements

STU-01 and STU-04 were not marked complete. Per the briefing, the 09-23 phase gate closes requirement ids.

## Known Stubs

None.

## Self-Check: PASSED
