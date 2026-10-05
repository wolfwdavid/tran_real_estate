---
phase: 03-local-platform-storage-key-vault-backup
plan: 05
subsystem: storage
tags: [dexie, indexeddb, syncable, tombstones, backup-registry, storage-api, persist, liveQuery, runes]
requires:
  - "03-01: @tran/core Syncable/newSyncable/touch/tombstone, ReminderInput; freshIdb() test helper"
provides:
  - "TranDb Dexie class ('tran': meta, prefs) with append-only version blocks + options-forwarding constructor"
  - "getDb/openDb/_resetDb lazy singleton and StorageBlockedError"
  - "createRepo<T extends Syncable>() with tombstones and firstRecordAt stamping"
  - "META keys, getMeta/setMeta, readReminderInput"
  - "Backup registry: registerBackupTable, listBackupTables, BACKUP_EXCLUDED_TABLES"
  - "requestPersistence/persistenceStatus/storageEstimate/formatBytes"
  - "live(query, initial) runes helper over Dexie liveQuery"
affects: [03-07, 03-08, 03-09, 03-10, 03-11, 03-12, 03-13, phase-04, phase-05, phase-06, phase-07, phase-08]
tech-stack:
  added: []
  patterns:
    - "Dexie subclass with append-only this.version(n) blocks, guarded by a source regex test"
    - "Lazy singleton DB (never at module scope; prerender-safe)"
    - "Repo writes + meta bookkeeping in one rw transaction"
    - "Include-only backup registry + explicit excluded list; every table registered XOR excluded"
    - "Non-async requestPersistence so persist() runs inside user activation"
key-files:
  created:
    - apps/web/src/lib/storage/db.ts
    - apps/web/src/lib/storage/db.test.ts
    - apps/web/src/lib/storage/repo.ts
    - apps/web/src/lib/storage/repo.test.ts
    - apps/web/src/lib/storage/meta.ts
    - apps/web/src/lib/storage/backup-registry.ts
    - apps/web/src/lib/storage/backup-registry.test.ts
    - apps/web/src/lib/storage/persistence.ts
    - apps/web/src/lib/storage/persistence.test.ts
    - apps/web/src/lib/storage/live.svelte.ts
  modified: []
decisions:
  - "openDb maps blocked storage by walking Dexie's error chain (err → .inner → .cause) for SecurityError/InvalidStateError/UnknownError/MissingAPIError; other open failures rethrow unchanged"
  - "Backup registry is include-only: unregistered tables are never exported; BACKUP_EXCLUDED_TABLES documents deliberate local-only tables, and registering an excluded name throws"
  - "Re-registering a name replaces its label in place (keeps registration order)"
  - "'Already persisted this session' is tracked per nav object in a WeakSet (no global reset needed for tests); persist() rejection maps to 'not-reported'"
  - "readReminderInput skips registered names that are not tables of the given DB, so a later phase can register before its version block opens"
metrics:
  duration: 12min
  completed: 2026-10-04
  tasks: 2
  files: 10
---

# Phase 3 Plan 05: Main Dexie Data Layer Summary

This plan adds the lazy, append-only Dexie `tran` database (`meta` is local-only, `prefs` goes in backups). `Syncable` repos stamp ids and timestamps, tombstone on delete, and record `firstRecordAt` in the same transaction as the first save. An include-only backup registry with an explicit excluded list sits on top. A non-async `requestPersistence` calls `navigator.storage.persist()` synchronously inside the click, and a thin `live()` helper turns `liveQuery` into Svelte 5 runes.

## Data layer contract (Phase 4/5/6/7/8 consumers)

| Export | Path | Signature / notes |
|---|---|---|
| `TranDb` | `apps/web/src/lib/storage/db.ts` | `class TranDb extends Dexie { meta!: Table<MetaRow, string>; prefs!: Table<PrefRecord, string>; constructor(options?: DbOptions, name = 'tran') }`, which calls `super(name, options)` |
| Version pattern | same | `this.version(1).stores({ meta: 'key', prefs: 'id, key, updatedAt' });` **APPEND-ONLY**. Phase 4 adds `this.version(2).stores(PHASE4_STORES)` after it plus typed `Table` fields. `db.test.ts` enforces this: `/\.version\((\d+)\)/g` must be strictly increasing, with exactly one `.version(1)`. Current latest = **1** |
| `DbOptions` | same | `{ indexedDB?: IDBFactory; IDBKeyRange?: typeof IDBKeyRange }`. Tests pass `freshIdb()` |
| `MetaRow`, `PrefRecord` | same | `{ key; value: unknown }`; `PrefRecord extends Syncable { key; value }` |
| `getDb` | same | `getDb(options?: DbOptions): TranDb`. Lazy singleton for browser callers only (onMount/handlers). Options apply on the first call |
| `openDb` | same | `openDb(db = getDb()): Promise<TranDb>`. Rejects with `StorageBlockedError` for blocked storage |
| `StorageBlockedError` | same | `name = 'StorageBlockedError'`, `message = 'storage-blocked'` |
| `_resetDb` | same | tests only |
| `createRepo` | `apps/web/src/lib/storage/repo.ts` | `createRepo<T extends Syncable>(db: TranDb, table: string, o: { schemaVersion; now?; uuid? }): Repo<T>` with `get(id)`, `list({ includeDeleted? })`, `put(input: Omit<T, keyof Syncable> & Partial<Syncable>)`, `remove(id)` (tombstone). Also exports `RepoOptions`, `RepoInput`, `Repo` |
| `META`, `getMeta`, `setMeta`, `readReminderInput` | `apps/web/src/lib/storage/meta.ts` | `META = { lastBackupAt: 'lastBackupAt', snoozedUntil: 'backupReminderSnoozedUntil', firstRecordAt: 'firstRecordAt' }`; `getMeta<T>(db, key)`; `setMeta(db, key, value)`; `readReminderInput(db, now): Promise<ReminderInput>` |
| `registerBackupTable` | `apps/web/src/lib/storage/backup-registry.ts` | `registerBackupTable({ name, label }): void`. Appends, or replaces the label in place. Throws `backup-table-excluded` for excluded names |
| `listBackupTables` | same | `(): readonly BackupTable[]`, a frozen snapshot in registration order. Default `[{ name: 'prefs', label: 'Settings' }]` |
| `BACKUP_EXCLUDED_TABLES` | same | `readonly string[]`, frozen `['meta']`. Phase 4 adds `'apiCache'` **in this array literal** (the registry is include-only; frozen arrays can't be pushed) |
| `_resetBackupRegistry` | same | tests only; restores the default |
| `requestPersistence` | `apps/web/src/lib/storage/persistence.ts` | `(nav = navigator): Promise<PersistStatus>`. **Call synchronously at the top of a click handler, before any await** |
| `persistenceStatus`, `storageEstimate`, `formatBytes`, `PersistStatus` | same | `'granted' \| 'not-granted' \| 'not-reported'`; `storageEstimate → { usage, quota } \| null`; `formatBytes(n)` returns KB/MB/GB with at most 1 decimal (`'0 KB'`, `'1.5 KB'`, `'5 MB'`, `'6.4 GB'`) |
| `live` | `apps/web/src/lib/storage/live.svelte.ts` | `live<T>(query: () => Promise<T>, initial: T): { readonly current: T; readonly error: unknown }` (liveQuery + createSubscriber) |

Phase 4 note: the "registered XOR excluded" invariant is already tested in `backup-registry.test.ts` against `new TranDb({}).tables`. Adding a Phase 4 table without registering or excluding it will fail that test.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | 26689b6 | test(03-05): add failing Dexie data layer tests |
| 1 GREEN | 8161731 | feat(03-05): Dexie data layer with Syncable repos, meta and backup registry |
| 2 RED | 5181b2e | test(03-05): add failing persistence tests |
| 2 GREEN | dc5a56f | feat(03-05): storage persistence wrapper and liveQuery runes helper |

## Verification

- `corepack pnpm vitest run --project web storage/db storage/repo storage/backup-registry storage/persistence`: 53/53 passed (5 files)
- `corepack pnpm --filter web check`: 0 errors in this plan's files. During the final run, the only error was in `src/lib/components/ui/alert/alert.svelte`, which belongs to the parallel 03-06 and was mid-edit
- `eslint apps/web/src/lib/storage` and `prettier --check apps/web/src/lib/storage`: clean
- `corepack pnpm build:root` (under `.tools/build.lock`): exit 0. `grep -rl dexie apps/web/build/index.html` finds nothing
- Acceptance greps: no module-scope `getDb(`/`new TranDb(` in any storage file (count 0 each); `persist?.()` sits on the first line of `requestPersistence`
- The synchronous-call test asserts the spy *before* `await Promise.resolve()`

## Deviations from Plan

None. The plan was executed as written. Small additions within scope:
- `remove()` of an unknown id is a no-op (tested).
- `persist()` rejection resolves `'not-reported'` instead of throwing.
- `registerBackupTable` also rejects empty name/label.

Out-of-scope observations (not fixed; they belong to parallel executors): `src/lib/storage/secrets/vault.test.ts` (03-04 RED stage) failed to load during my storage run, and `alert.svelte` (03-06) had a transient type error.

## Known Stubs

None.

## Self-Check: PASSED
