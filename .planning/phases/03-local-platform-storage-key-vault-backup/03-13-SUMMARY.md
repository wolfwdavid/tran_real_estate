---
phase: 03-local-platform-storage-key-vault-backup
plan: 13
subsystem: ui
tags: [settings, backup, restore, import-preview, merge, replace, a11y, playwright, mutation-testing]
requires:
  - "03-08: exportBackup / previewImport / applyImport + BackupError codes"
  - "03-10: settings context, announce(), ConfirmDialog, SectionError, BackupSection stub, E2E helpers"
  - "03-05: requestPersistence, META, readReminderInput"
provides:
  - "Backup and restore Settings section: BackupExport, BackupImport, ImportPreview"
  - "BackupKit + loadBackupKit() (dynamic-import bundle of the browser-only backup modules)"
  - "E2E helper tests/e2e/helpers/backup-files.ts (makeBackup, fileFrom, recordId)"
  - "settings-backup.spec.ts (PLAT-04 proofs on root and sub)"
affects: [03-15, 04, 05]
tech-stack:
  added: []
  patterns:
    - "Browser-only modules reach the section through one dynamic-import kit after ctx.ready"
    - "Last backup line and 'nothing to back up' hint come from ONE live() query over readReminderInput"
    - "Data headed for IndexedDB is held in $state.raw (deep proxies fail structured clone)"
    - "{#key seq} remounts SectionError so a repeated error re-announces"
key-files:
  created:
    - apps/web/src/lib/features/shared/settings/BackupExport.svelte
    - apps/web/src/lib/features/shared/settings/BackupImport.svelte
    - apps/web/src/lib/features/shared/settings/ImportPreview.svelte
    - apps/web/tests/e2e/helpers/backup-files.ts
    - apps/web/tests/e2e/settings-backup.spec.ts
  modified:
    - apps/web/src/lib/features/shared/settings/BackupSection.svelte
decisions:
  - "BackupSection loads backup/meta/live/persistence/@tran/core via dynamic import once ctx.ready and the DB opened, so none of them enter the prerendered Settings graph; requestPersistence stays synchronous in the confirm click"
  - "Last backup uses readReminderInput (meta + registered tables) through live(), giving both the date and hasRecords from one subscription"
  - "When storage is blocked, both sub-groups render their copy without the button/picker (import needs the DB too)"
  - "A failed Replace closes the dialog and focuses the SectionError; onCloseAutoFocus is prevented when a result or failure exists"
  - "Unknown preview error codes fall back to the 'This backup can't be read' copy"
metrics:
  duration: 25min
  completed: 2026-10-04
  tasks: 2
  files: 6
---

# Phase 3 Plan 13: Backup and Restore Section Summary

**The Settings Backup and restore section now has a key-checked download with a live "Last backup" line, a guarded file picker with all approved error messages, and an import preview. The preview offers Merge or Replace with a diff table, and Replace needs an accessible confirmation. E2E proves a key-free export round-trips into a fresh browser profile on both bases.**

## Task Commits

| Task | Commit | Message |
|---|---|---|
| 1 | fc5b76c | feat(03-13): backup and restore section with import preview |
| 1 (fix found in Task 2) | ec9d904 | fix(03-13): keep import preview out of deep state so IndexedDB can clone it |
| 2 | 4eb263f | test(03-13): backup E2E for key-free export and fresh-profile import |

## Verification

- `pnpm check`: 0 errors, 0 warnings. `eslint` and `prettier` pass on all six files. `banned` and `ui:guard` pass.
- `build:root`, `build:sub` and `csp:assert` pass (14 pages on each base).
- `playwright test settings-backup`: 12 passed and 2 fixme-skipped (the older-backup migration line) across root and sub.
- Full `test:e2e`: 390 passed and 2 failed. The failures were `layout.spec` "landmarks on ''" (root) and 03-11's `settings-keys` cross-tab forget. Both passed on re-run (`layout settings-keys`: 196/196), so they are load flakes and not caused by this plan.
- `grep -cE "sk-ant-|AIza|sk-proj-"` on the spec and helper prints 0 for each.

## Mutation proof (scan skipped)

The check in `apps/web/src/lib/storage/backup.ts` line 64 was changed to `findKeyMaterial(...).length > 99`, which skips the key scan. The root project was rebuilt and `settings-backup` run: **"export refuses a key-bearing pref" FAILED** and the other 5 passed. Test 1 still passes under the mutation because vault keys are structurally excluded: they never sit in a registered table. The file was restored from a copy, `git diff` was empty, and both bases were rebuilt before the final runs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Import always failed with "Import didn't finish"**
- **Found during:** Task 2 (first E2E run)
- **Issue:** `preview` was a deep `$state` proxy. `applyImport` writes `preview.incoming` records to IndexedDB, and structured clone rejects Proxy objects. The resulting DataCloneError mapped to `write-failed`.
- **Fix:** `let preview = $state.raw<Preview | null>(null)` in BackupImport.
- **Files modified:** BackupImport.svelte
- **Commit:** ec9d904

**2. [Rule 3 - Blocking] Browser-only modules are dynamically imported**
- The plan names `live`, `getMeta` and `requestPersistence` as plain imports. The 03-10 pattern forbids value imports of storage modules in Settings components, so BackupSection exports `BackupKit`/`loadBackupKit()` and passes the kit down. `requestPersistence()` is still called synchronously in the click handler, before `applyImport(`.

**3. Minor:** the helper gained `idOffset`, `ownerId` and `firstValue` options for the replace, invalid-file and key-bearing-pref tests. h3 headings use `text-body font-semibold`, the existing pattern, because there is no subheading token.

## Known Stubs

None. The older-backup migration line is wired (`migratedFrom !== null`). Its E2E is `test.fixme` because BACKUP_SCHEMA_VERSION is 1 and no older version exists. Core `migrations.test.ts` covers that path.

## Self-Check: PASSED
