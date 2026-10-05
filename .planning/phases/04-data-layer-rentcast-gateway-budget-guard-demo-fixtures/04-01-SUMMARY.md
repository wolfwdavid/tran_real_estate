---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 01
subsystem: data-platform-adapter
tags: [dexie, backup, vault, adapter, fake-indexeddb, tdd]
requires:
  - "Phase 3 vault (getVault/Vault.getKey/onChange/getStatus), TranDb, backup registry, key-tester hook, announcer, ConfirmDialog"
provides:
  - "$lib/data/platform: getRentCastKey (sync), getRentCastKeyState, onRentCastKeyChange, bindRentCastVault, connectRentCastKey, registerRentCastKeyTest, getLastRentCastKeyTest, keyTestStatusOf, announce, createDataDb, getDataDb, DataDb, BACKUP_EXCLUDED_TABLES, listBackupTables"
  - "$lib/data/tables: PHASE4_STORES, row types, DATA_RECORD_SCHEMA_VERSION, DATA_PREF_IDS, PHASE4_BACKUP_TABLES, PHASE4_BACKUP_EXCLUDED, unregisteredTables"
  - "$lib/data/testing/harness: makeDb, T0, TEST_KEY, jsonResponse, spyFetch, FetchCall"
  - "$lib/features/shared/data/platform-ui: Button, Badge, Input, Label, AlertDialog, RadioGroup, ConfirmDialog, announce"
  - "TranDb version 2 with apiCache, ledger, savedSearches, searchSnapshots, dataPrefs"
  - "@tran/core subpath exports ./* -> ./src/*/index.ts"
affects: [04-08 onward (every data-layer and UI plan imports these fixed names)]
tech-stack:
  added: [zod 4.6.4 (web), date-fns 4.4.0 (web), runed 0.37.1, "@vitest/browser-playwright 4.1.11", vitest-browser-svelte 2.2.1, playwright 1.63.0, axe-core 4.13.0]
  patterns:
    - "Sync key mirror over the async vault: refresh on vault onChange, generation counter drops stale reads"
    - "Built-in backup registrations live in DEFAULT_TABLES so a Settings export always includes them"
    - "Every backed-up Phase 4 row is Syncable; fixed-uuid ids for dataPrefs, id === searchId for snapshots"
key-files:
  created:
    - apps/web/src/lib/data/platform.ts
    - apps/web/src/lib/data/tables.ts
    - apps/web/src/lib/data/testing/harness.ts
    - apps/web/src/lib/data/platform.test.ts
    - apps/web/src/lib/data/schema-registry.test.ts
    - apps/web/src/lib/features/shared/data/platform-ui.ts
  modified:
    - apps/web/src/lib/storage/db.ts
    - apps/web/src/lib/storage/backup-registry.ts
    - apps/web/src/lib/storage/db.test.ts
    - apps/web/src/lib/storage/backup.test.ts
    - apps/web/src/lib/storage/backup-registry.test.ts
    - eslint.config.js
    - apps/web/package.json
    - packages/core/package.json
    - pnpm-lock.yaml
key-decisions:
  - "getRentCastKey stays synchronous (the 04-09 client contract) by mirroring the async Phase 3 vault; the vault loads via dynamic import on first key access in a browser"
  - "searchSnapshots and dataPrefs rows extend Syncable (ISO timestamps, uuid id) because the Phase 3 backup file validates every record with SyncableSchema; DataPrefRow.updatedAt is an ISO string, not a number"
  - "Phase 4 backup tables are registered in backup-registry DEFAULT_TABLES (not a side-effect import); apiCache added to BACKUP_EXCLUDED_TABLES"
  - "tables.ts exports PHASE4_BACKUP_EXCLUDED; the full list BACKUP_EXCLUDED_TABLES stays in the registry and is re-exported from platform.ts"
  - "platform-ui re-exports announce straight from the Phase 3 announcer (the 04-07 data-port rule forbids $lib/data/platform outside lib/data)"
  - "lib/storage/*.ts may import $lib/data/tables only (scoped eslint exception), so the TranDb/registry dependency on Phase 4 schema is explicit"
requirements-completed: [DATA-03, DATA-04]
metrics:
  duration: 25min
  completed: 2026-10-05
  tasks: 2
  files: 15
---

# Phase 4 Plan 01: Phase 3 platform adapter, Phase 4 tables and test harness Summary

One adapter (`$lib/data/platform`) now connects the data layer to the shipped Phase 3 vault, DB, key-test hook and announcer. TranDb has a new version 2 block with the five Phase 4 tables. Four of those tables are registered for backup and `apiCache` is excluded. Dependencies are exact-pinned, `@tran/core` has subpath exports, and an isolated fake-indexeddb harness is ready for every later test.

## Phase 3 gate

Satisfied. 17 Phase 3 SUMMARY files and 03-VERIFICATION.md exist, and the vault `getKey` lives in `apps/web/src/lib/storage/secrets/vault.ts`.

## Phase 3 contract map

| Fixed Phase 4 name | Real Phase 3 path / export | Notes |
| --- | --- | --- |
| `getRentCastKey()` / `getRentCastKeyState()` / `onRentCastKeyChange()` | `$lib/storage/secrets` → `getVault(): Promise<Vault>`; `Vault.getKey('rentcast'): Promise<string \| undefined>`, `Vault.getStatus().providers.rentcast.state: 'none' \| 'session' \| 'remembered' \| 'locked'`, `Vault.onChange(cb) → off` | The vault is async, so platform.ts keeps a synchronous mirror. Mapping: key readable → `available`, state `locked` → `locked`, else `none`. |
| `bindRentCastVault(vault)` / `connectRentCastKey()` | same | Bind is for tests and explicit start-up. Connect is called lazily by the accessors and only in a browser. |
| `registerRentCastKeyTest(test)` | `$lib/storage/secrets/testers` → `registerKeyTester('rentcast', (key, signal) => Promise<KeyTestResult>)`, `KeyTestResult = { status: 'accepted' \| 'rejected' \| 'rate-limited' \| 'failed'; message? }` | ProviderKeyCard shows **Test key** only while a tester is registered (`hasKeyTester`). |
| `announce(message)` | `$lib/components/a11y/announcer.svelte` (`.svelte.ts`) → `announce`; rendered by `$lib/components/a11y/LiveAnnouncer.svelte` | |
| `DataDb` / `getDataDb()` | `$lib/storage/db` → `class TranDb extends Dexie` (`constructor(options?: DbOptions, name = 'tran')`), singleton `getDb()`, `openDb()` (maps blocked storage to `StorageBlockedError`) | Latest Phase 3 version was **1**; Phase 4 added **2**. The constructor already forwarded `{ indexedDB, IDBKeyRange }`, so no constructor change was needed. |
| `createDataDb({ name, indexedDB, IDBKeyRange })` | `new TranDb(options, name)` | |
| Syncable type / helper | `@tran/core` → `Syncable`, `SyncableSchema`, `newSyncable({ id, now: Date, schemaVersion })`, `touch`, `tombstone`, `OWNER_LOCAL` | Timestamps are **ISO strings**. Use `DATA_RECORD_SCHEMA_VERSION` (1) from `$lib/data/tables`. |
| Backup registry | `$lib/storage/backup-registry` → `registerBackupTable({ name, label })`, `listBackupTables()`, `BACKUP_EXCLUDED_TABLES`, `_resetBackupRegistry()` | Include-only registry plus an exclusion list. Phase 4 tables are built into `DEFAULT_TABLES`, and `apiCache` is in `BACKUP_EXCLUDED_TABLES`. |
| Backup service | `$lib/storage/backup` → `buildBackupText`, `exportBackup`, `previewImport`, `applyImport` | It reads every registered table and validates every record with `SyncableSchema`. |
| `ConfirmDialog` | `$lib/features/shared/settings/ConfirmDialog.svelte` | |
| `Button` / `Badge` / `Input` / `Label` | `$lib/components/ui/{button,badge,input,label}/index.js` | |
| `AlertDialog` (namespace) | `$lib/components/ui/alert-dialog/index.js` (Root, Content, Title, Description, Footer, Header, Cancel, Action, Trigger, Portal, Overlay, Media) | |
| `RadioGroup` (namespace) | `$lib/components/ui/radio-group/index.js` (Root, Item) | |
| ProviderKeyCard | `$lib/features/shared/settings/ProviderKeyCard.svelte` | |

No shadcn copy-ins were needed because every UI piece already existed.

## Tasks

| Task | Name | Commit |
| --- | --- | --- |
| 1 | Phase 3 gate, platform adapter, Phase 4 tables, backup registration | a4d13bc |
| 2 (RED) | Failing adapter and schema-registry tests | 9a927ec |
| 2 (GREEN) | Pinned deps, core subpath exports, isolated DB harness | 22cc62d |

## Verification

- `corepack pnpm check`: 0 errors, 0 warnings.
- `corepack pnpm lint` (prettier and eslint, whole repo): exit 0.
- `corepack pnpm vitest run --project web platform schema-registry`: 22/22 pass (platform 18, schema-registry 4).
- `corepack pnpm test:unit`: 49 files, 906 tests, all pass.
- `corepack pnpm guard`: passed (619 files).
- `git diff --numstat` on `storage/db.ts` in Task 1 showed `16 0`, so the change was additions only.
- `git diff --exit-code pnpm-workspace.yaml` exits 0.
- Mutation check: emptying `PHASE4_BACKUP_EXCLUDED` makes the backup-coverage test fail. The file was restored afterwards.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Backed-up rows had to be Syncable**
- **Found during:** Task 1
- **Issue:** The planned `SearchSnapshotRow` had no Syncable fields, and the planned `DataPrefRow` had `updatedAt: number`. The Phase 3 backup format validates every record with `SyncableSchema` (uuid `id`, ISO timestamps) and merges by `id`. Registering these tables as planned would make any backup that contains them fail import with `BackupError('invalid')`.
- **Fix:** Both types now extend `Syncable`. Snapshots use `id === searchId` by convention. Data prefs use the fixed uuids in `DATA_PREF_IDS`, so merge-by-id lines up with the `key` primary key across devices. The schema strings are unchanged. A test proves the Phase 4 rows pass `parseBackup`.
- **Files:** apps/web/src/lib/data/tables.ts, schema-registry.test.ts
- **Commit:** a4d13bc, 9a927ec

**2. [Rule 3 - Blocking] Vault is async, but the contract `getRentCastKey(): string | null` is sync**
- **Fix:** platform.ts mirrors the key and state from `Vault.getKey`/`getStatus`, refreshes on `Vault.onChange` (cross-tab events included), and notifies listeners only on a real change. It loads the vault lazily with a dynamic import in the browser. `bindRentCastVault` lets tests and start-up code bind explicitly. `registerRentCastKeyTest` also accepts an injectable `now`, plus the optional `signal`.
- **Commit:** a4d13bc

**3. [Rule 3 - Blocking] Phase 3 tests asserted the old defaults**
- **Issue:** `db.test.ts` expected verno 1 with meta and prefs only. `backup-registry.test.ts` and `backup.test.ts` expected a registry holding prefs only. The `TestDb` in `backup.test.ts` declared `version(2)`, which now collides with the real version 2.
- **Fix:** The assertions are now derived from `PHASE4_STORES` and `PHASE4_BACKUP_TABLES`, and `TestDb` moved to `version(3)`. The tests are no weaker: they still check exact lists and order.
- **Commit:** a4d13bc

**4. [Rule 3 - Blocking] The 04-07 data-port lint rule landed mid-plan**
- **Issue:** `DATA_INTERNALS` forbids `$lib/data/*` outside lib/data. This broke two imports: platform-ui re-exporting `announce` from `$lib/data/platform`, and the storage modules importing `$lib/data/tables`.
- **Fix:** platform-ui now re-exports `announce` directly from the Phase 3 announcer. A scoped eslint entry lets `lib/storage/*.ts` import only `$lib/data/tables`, using gitignore negation inside the `DATA_INTERNALS` group. The 33/33 eslint-rules tests still pass.
- **Commit:** a4d13bc

**5. [Minor] Dependency placement**
- The web runtime libraries (zod, date-fns, runed) went into `devDependencies` to match the existing convention, because Phase 3 put dexie, bits-ui and @lucide/svelte there and the static build bundles everything. dexie, fake-indexeddb, @lucide/svelte and @tran/core were already present.

## Notes for later plans

- Build Syncable fields with `newSyncable({ id, now: new Date(clock()), schemaVersion: DATA_RECORD_SCHEMA_VERSION })`. Data prefs must use `id: DATA_PREF_IDS[key]`, and snapshots must use `id: searchId`.
- `getDataDb()` is the same `TranDb` singleton that Settings and backup use. Open it with Phase 3 `openDb()` when you need `StorageBlockedError` mapping.
- `apiCache` rows hold no Syncable fields and are never exported.

## Known Stubs

None.

## Self-Check: PASSED
