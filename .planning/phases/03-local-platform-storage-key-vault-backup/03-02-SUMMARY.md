---
phase: 03-local-platform-storage-key-vault-backup
plan: 02
subsystem: core-backup
tags: [backup, zod, migrations, merge, diff, key-scan, tdd, mutation-testing]
requires:
  - "03-01: Syncable, SyncableSchema (packages/core/src/syncable.ts)"
provides:
  - "@tran/core backup envelope: BACKUP_FORMAT, BACKUP_SCHEMA_VERSION, MAX_BACKUP_BYTES, BACKUP_APP_NAME, EnvelopeSchema, BackupEnvelope, buildEnvelope, parseBackup, ParseBackupOptions, ParsedBackup"
  - "@tran/core backup errors: BackupError, BackupErrorCode (9 codes)"
  - "@tran/core backup migrations: TablesMap, MigrationRegistry, migrations, migrateTables"
  - "@tran/core backupFilename (local date)"
  - "@tran/core diff: BackupTableRef, MergeRow, ReplaceRow, MergePlan, ReplacePlan, planMerge, planReplace"
  - "@tran/core key scan: KEY_SHAPES, findKeyMaterial"
affects: [03-08, 03-13]
tech-stack:
  added: []
  patterns:
    - "migrate-before-validate envelope parsing with injectable registry/currentVersion test seams"
    - "fixed-code errors (message === code) so nothing from the file can leak into UI or logs"
    - "shared invariant helper (expectInvariant) called in every merge test"
    - "mutation proofs recorded for tie rule, tombstone skip, and the gemini key shape"
key-files:
  created:
    - packages/core/src/backup/errors.ts
    - packages/core/src/backup/envelope.ts
    - packages/core/src/backup/envelope.test.ts
    - packages/core/src/backup/migrations.ts
    - packages/core/src/backup/migrations.test.ts
    - packages/core/src/backup/filename.ts
    - packages/core/src/backup/diff.ts
    - packages/core/src/backup/diff.test.ts
    - packages/core/src/backup/key-scan.ts
    - packages/core/src/backup/key-scan.test.ts
    - packages/core/src/backup/index.ts
    - packages/core/src/backup/__fixtures__/backup-v1.json
  modified:
    - packages/core/src/index.ts
decisions:
  - "Golden fixture is loaded with a native `import ... with { type: 'json' }`; core's tsc accepted it unchanged, so the ?raw fallback was not needed and tsconfig.json is untouched"
  - "parseBackup rejects a missing, non-integer or < 1 schemaVersion as 'invalid' before the 'newer' check, and a non-object `tables` as 'invalid' before migrating"
  - "buildEnvelope casts Syncable[] to the zod looseObject record type (Syncable has no index signature; runtime shape is identical)"
  - "Merge `unchanged` = local count minus updates (covers matched-not-newer and local-only), which makes the invariant hold by construction"
metrics:
  duration: 6min
  completed: 2026-10-04
  tasks: 2
  files: 13
---

# Phase 3 Plan 02: Pure Backup Logic (Envelope, Migrations, Diff, Key Scan) Summary

`tran-backup-v1` JSON envelope parsed in a fixed order (JSON → format → version → migrate → zod validate → known tables), with nine fixed error codes. It also adds a gap-checked forward-migration registry, a local-date filename, a merge/replace dry-run diff with a proven invariant and a local-wins-ties rule, and a key-material scanner that reports labels only. Everything is pure and DOM-free in `packages/core/src/backup/` and re-exported from `@tran/core`.

## Exports for 03-08 (web backup layer) and 03-13 (Settings UI)

All exported from `@tran/core` via `packages/core/src/backup/index.ts`:

| Module | Exports |
|---|---|
| `errors.ts` | `type BackupErrorCode = 'not-json' \| 'not-tran' \| 'invalid' \| 'newer' \| 'too-large' \| 'key-material' \| 'export-failed' \| 'write-failed' \| 'out-of-space'`, `class BackupError extends Error { readonly code }` (message === code) |
| `envelope.ts` | `BACKUP_FORMAT = 'tran-backup-v1'`, `BACKUP_SCHEMA_VERSION = 1`, `MAX_BACKUP_BYTES = 25 MiB`, `BACKUP_APP_NAME = 'Tran Real Estate Tools'`, `EnvelopeSchema`, `type BackupEnvelope`, `buildEnvelope(tables, now)`, `parseBackup(text, { registeredTables, currentVersion?, registry? }) → { envelope, migratedFrom: number \| null }`, `interface ParseBackupOptions`, `interface ParsedBackup` |
| `migrations.ts` | `type TablesMap`, `type MigrationRegistry`, `migrations` (frozen, empty today), `migrateTables(tables, from, to?, registry?)` |
| `filename.ts` | `backupFilename(d = new Date())` → `tran-backup-YYYY-MM-DD.json` (local date) |
| `diff.ts` | `interface BackupTableRef { name; label }`, `MergeRow`, `ReplaceRow`, `MergePlan { mode:'merge', perTable, totals, writes, noChanges }`, `ReplacePlan { mode:'replace', perTable, totals, writes }`, `planMerge(local, incoming, tables)`, `planReplace(local, incoming, tables)` |
| `key-scan.ts` | `KEY_SHAPES` (frozen: anthropic, openrouter, openai, gemini), `findKeyMaterial(json, knownSecrets): string[]` (labels + `'vault-value'`, deduplicated) |

Web-layer responsibilities that core deliberately leaves out:
- Check `file.size > MAX_BACKUP_BYTES` and throw `new BackupError('too-large')` **before** `file.text()`.
- Export: `JSON.stringify(env, null, 2)`, then `findKeyMaterial(text, vault.knownSecrets())`. On any hit, throw `key-material` and write nothing.
- Apply `writes` in one rw transaction. Merge = `bulkPut(writes[t])`. Replace = `clear()` every registered table, then `bulkPut(writes[t])`.
- `perTable` order follows the `tables` argument, so pass the registry in display order.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | c783264 | test(03-02): add failing envelope and migration tests |
| 1 GREEN | 3089ea4 | feat(03-02): backup envelope, error codes, migrations and filename |
| 2 RED | 5c3f017 | test(03-02): add failing diff and key-scan tests |
| 2 GREEN | 15022fc | feat(03-02): merge/replace dry-run diff and key-material scanner |

## Mutation proofs (each applied, observed failing, reverted)

| Mutation | Failing tests |
|---|---|
| `rec.updatedAt > mine.updatedAt` → `>=` in planMerge | `planMerge > equal updatedAt -> unchanged (local wins ties)`; `planMerge > re-planning the same incoming against the applied result is a no-op (idempotent)` |
| Removed `if (rec.deletedAt !== undefined) continue;` (incoming tombstone with no local) | `planMerge > incoming tombstone with no local record -> skipped entirely` |
| Deleted the gemini `KEY_SHAPES` entry | `findKeyMaterial > flags a planted gemini key by label only`; `findKeyMaterial > results are deduplicated and never echo any planted key`; `KEY_SHAPES > is frozen and covers the four LLM providers` |

After revert: core project 9 files / 110 tests pass.

## Verification

- `corepack pnpm vitest run --project core`: 9 files, 110 tests passed
- `corepack pnpm --filter @tran/core check`: clean
- `eslint packages/core/src` + `prettier --check packages/core/src`: clean
- `node scripts/guard-real-data.mjs --all`: passed (443 files)
- `node scripts/gitleaks.mjs staged` (Task 2) and `history`: no leaks
- Acceptance greps: fixture `@` count 0; `git diff --exit-code packages/core/tsconfig.json` exits 0; key-scan.ts has `sk-ant-` and `AIza[0-9A-Za-z_-]{35}` and no `{64}` / `[0-9a-f]{32}`; no planted-key literals anywhere under `packages/core/src`
- Repo-wide `corepack pnpm lint` currently fails only on other parallel executors' in-progress files (`apps/web/src/lib/components/ui/button/button.svelte` no-navigation-without-resolve, `apps/web/src/lib/storage/secrets/vault.ts` formatting). Those belong to 03-06 and 03-04 and are out of scope here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `Syncable[]` not assignable to the zod looseObject record type**
- **Found during:** Task 1 GREEN (`tsc --noEmit`)
- **Issue:** `Syncable` has no string index signature, while `z.looseObject` infers `{ [x: string]: unknown; ... }`.
- **Fix:** `buildEnvelope` casts `tables as BackupEnvelope['tables']`, with a comment. The runtime shape is identical.
- **Commit:** 3089ea4

**2. Scoped formatting**
- The first `corepack pnpm format` ran repo-wide and also touched other executors' uncommitted files, rewriting them in Prettier style only. After that, formatting was scoped to `packages/core/src/backup` and `packages/core/src/index.ts`, and only this plan's files were staged.

Extra tests beyond the plan's behavior list (no scope change): error messages never echo file content, inputs are not mutated, regex scans are stable across calls, `KEY_SHAPES` is frozen, and planReplace treats a table missing on either side as `[]`.

## Known Stubs

None. `migrations` is intentionally empty at schema version 1, and the gap test enforces that it grows in step with `BACKUP_SCHEMA_VERSION`.

## Self-Check: PASSED
