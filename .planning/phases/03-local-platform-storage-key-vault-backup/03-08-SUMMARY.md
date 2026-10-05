---
phase: 03-local-platform-storage-key-vault-backup
plan: 08
subsystem: web-backup
tags: [backup, dexie, export, import, key-scan, transaction, rollback, tdd, mutation-testing]
requires:
  - "03-02: buildEnvelope, parseBackup, planMerge/planReplace, findKeyMaterial, backupFilename, BackupError, MAX_BACKUP_BYTES"
  - "03-04: vault.knownSecrets()"
  - "03-05: TranDb, META/getMeta/setMeta, listBackupTables, _resetBackupRegistry"
provides:
  - "apps/web/src/lib/storage/backup.ts: buildBackupText, downloadJson, exportBackup, previewImport, applyImport, KnownSecretsSource, BackupFileLike, ImportPreview, ImportResult"
affects: [03-13, 03-15]
tech-stack:
  added: []
  patterns:
    - "export reads only registry tables of DB 'tran'; key scan before any Blob exists"
    - "lastBackupAt written only after download() returns"
    - "size check on file.size before file.text()"
    - "apply re-plans inside ONE rw transaction over registered tables + meta (no stale-plan overwrite)"
    - "error mapping: BackupError passes through, QuotaExceededError (walking inner/cause/failures) -> out-of-space, else write-failed"
key-files:
  created:
    - apps/web/src/lib/storage/backup.ts
    - apps/web/src/lib/storage/backup.test.ts
  modified: []
decisions:
  - "applyImport recomputes planMerge/planReplace inside the transaction from preview.incoming (ImportPreview gains an `incoming` field), so an edit made between preview and confirm is never overwritten by a stale plan; counts equal the preview when nothing changed"
  - "The key scan checks each known secret both raw and JSON-escaped, so a secret containing quotes/backslashes is still caught in the stringified envelope"
  - "A rejected file.text() maps to 'not-json'; a local read failure during preview maps to 'write-failed'"
  - "firstRecordAt is set (inside the same transaction) only when absent and at least one registered table holds a live record afterwards"
metrics:
  duration: 8min
  completed: 2026-10-04
  tasks: 2
  files: 2
---

# Phase 3 Plan 08: Web Backup Service Summary

One module (`apps/web/src/lib/storage/backup.ts`) now handles both directions. Export reads only the registered tables of DB `tran`, runs a key-shape and exact-vault-value scan before any Blob exists, and records `lastBackupAt` only after the download succeeds. Import checks the 25 MB limit before `file.text()`, then previews exact Merge/Replace counts, then applies everything in one Dexie rw transaction with rollback and quota mapping.

## Service API (for 03-13 Settings Backup and 03-15 AppNotice)

```ts
interface KnownSecretsSource { knownSecrets(): string[] }          // the vault satisfies this
buildBackupText(db, { now, knownSecrets }): Promise<{ text; filename; counts: Record<string, number> }>
downloadJson(text, filename): void                                  // Blob + object URL + <a download>
exportBackup(db, vault, { now?, download? } = {}): Promise<{ filename }>
  // throws BackupError 'key-material' | 'export-failed'

interface BackupFileLike { name; size; text(): Promise<string> }    // a File works directly
interface ImportPreview {
  fileName; exportedAt; schemaVersion; migratedFrom: number | null;
  merge: MergePlan; replace: ReplacePlan; tables: readonly string[];
  incoming: Record<string, Syncable[]>;
}
previewImport(db, file): Promise<ImportPreview>
  // throws 'too-large' (before text()) | 'not-json' | 'not-tran' | 'newer' | 'invalid' | 'write-failed'
type ImportResult =
  | { mode: 'merge'; added; updated; unchanged }
  | { mode: 'replace'; total; fileName };
applyImport(db, preview, 'merge' | 'replace'): Promise<ImportResult>
  // throws 'invalid' (registry changed since preview) | 'write-failed' | 'out-of-space'
```

UI notes for 03-13:
- Call `requestPersistence()` synchronously in the confirm click handler. `applyImport` does not request persistence.
- Import never changes `lastBackupAt`. It sets `firstRecordAt` if that value is absent and live data exists afterwards.
- Every error message is just the code. Map codes to the UI-SPEC copy.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | a04cb5a | test(03-08): add failing export tests |
| 1 GREEN | a5a0d4b | feat(03-08): backup export with key-free check and download |
| 2 RED | 852ef3e | test(03-08): add failing import preview and apply tests |
| 2 GREEN | ed2d70f | feat(03-08): import preview and single-transaction merge/replace |

## Mutation proofs (each applied, observed failing, reverted)

| Mutation | Failing tests |
|---|---|
| Export also reads `meta` (`tables.meta = await db.table('meta').toArray()`) | empty DB valid file; table names equal the registry (never meta); exports a newly registered table; success downloads once (4 failed) |
| Key scan skipped (`.length > 99`) | key-shaped value; exact known secret; JSON-escaped secret; planted key never calls download; vault value never calls download (5 failed) |
| Replace `clear()` moved outside the transaction | `replace: a failure part-way rolls every table back (write-failed)` (1 failed) |

After revert: `storage/backup` 35/35 pass.

## Verification

- `corepack pnpm vitest run --project web storage/backup`: 35 tests passed
- `corepack pnpm test:unit`: 35 files / 559 tests passed
- `corepack pnpm check`: 0 errors. One earlier run showed errors only in `secrets/vault-lock.test.ts`, which is a parallel executor's RED test. They were gone on the re-run.
- `corepack pnpm lint` (prettier + eslint, repo-wide): clean
- `node scripts/gitleaks.mjs staged` on both GREEN commits: no leaks
- Acceptance greps: `grep -c "tran-secrets\|db.meta.toArray" backup.ts` = 0. `findKeyMaterial(`, `new BackupError('key-material')`, `URL.createObjectURL`, `URL.revokeObjectURL`, `META.lastBackupAt`, `export async function previewImport`, `export async function applyImport`, `MAX_BACKUP_BYTES`, `QuotaExceededError` and `transaction('rw'` are all present.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale-plan overwrite between preview and confirm**
- **Found during:** Task 2
- **Issue:** Applying `preview.merge.writes` as-is could overwrite a record the user edited after the preview, which breaks the "local wins ties / newer only" rule.
- **Fix:** `ImportPreview` now also carries `incoming`. `applyImport` re-reads the tables and re-plans inside the rw transaction. Counts match the preview when nothing changed.
- **Commit:** ed2d70f

**2. [Rule 2 - Correctness] JSON-escaped known secrets**
- **Found during:** Task 1
- **Issue:** A vault value that contains `"` or `\` is escaped in the stringified envelope, so a raw `includes` check would miss it.
- **Fix:** Each secret is scanned in both its raw and its JSON-escaped form. A test covers this.
- **Commit:** a5a0d4b

**3. Test expectation corrected (not a code change).** Merge `unchanged` follows core's definition, local count minus updates. The RED test first assumed 2 for the a/b + update-b/add-c case; the correct value is 1.

**4. Test seam.** `db.table('prefs')` is not the same object as `db.prefs` in Dexie 4, so the failure-injection tests wrap `db.table` with `vi.spyOn` instead of spying on `db.prefs`.

## Known Stubs

None.

## Self-Check: PASSED
