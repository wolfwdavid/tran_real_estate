---
phase: 05-ai-layer-providers-streaming-fair-housing-guardrails
plan: 11
subsystem: ai-platform-integration
tags: [dexie, backup, vault, key-test, prefs, runed, provider-selection, tdd, mutation-test]
requires:
  - "Phase 3 TranDb (append-only versions), backup registry + export key scan, vault KeyState, registerKeyTester"
  - "Phase 4 version 2 (PHASE4_STORES), $lib/data/tables pattern"
  - "05-05 runTestConnection, 05-07/05-08 adapters + probes, 05-09 fixtureProvider, ai-copy testResultCopy"
provides:
  - "$lib/ai/storage/tables: AI_STORES, AI_ARTIFACTS_TABLE, AI_ARTIFACTS_LABEL, AI_BACKUP_TABLES, AiArtifact, ArtifactStatus, StoredFinding"
  - "$lib/ai/storage/artifacts: createArtifactRepo(db?, {now, uuid}), toStoredFindings, DEFAULT_PAGE_SIZE (re-exports tables)"
  - "TranDb version 3 + typed aiArtifacts table; 'AI drafts' in the default backup list"
  - "$lib/ai/prefs.svelte: aiPrefs, createAiPrefs({window}), AI_PREF_KEYS"
  - "$lib/ai/setup: PROBES, toAiKeyState, keyStateFrom(vault), createLiveProvider, selectProvider, defaultPreferred, resolveProvider, toKeyTestResult, registerAiTestKeys, AiKeyTestResult"
affects: [05-13, 05-14, 05-15 (panel, draft history, Settings AI section call sites)]
tech-stack:
  added: []
  patterns:
    - "Dependency-free tables module (like $lib/data/tables) so db.ts and backup-registry.ts import AI constants without an import cycle"
    - "Allow-list create(): only the AiArtifact fields are copied, so stray input properties never reach storage"
    - "PersistedState prefs validated on every read; disconnected (in-memory) when no window or storage is blocked"
key-files:
  created:
    - apps/web/src/lib/ai/storage/tables.ts
    - apps/web/src/lib/ai/storage/artifacts.ts
    - apps/web/src/lib/ai/storage/artifacts.test.ts
    - apps/web/src/lib/ai/prefs.svelte.ts
    - apps/web/src/lib/ai/setup.ts
    - apps/web/src/lib/ai/setup.test.ts
  modified:
    - apps/web/src/lib/storage/db.ts
    - apps/web/src/lib/storage/db.test.ts
    - apps/web/src/lib/storage/backup-registry.ts
    - apps/web/src/lib/storage/backup-registry.test.ts
    - apps/web/src/lib/storage/backup.test.ts
    - apps/web/src/lib/data/platform.test.ts
key-decisions:
  - "Tombstone convention follows Phase 3: deletedAt is absent while live (not null), because SyncableSchema rejects deletedAt: null and backup import would fail"
  - "create() rejects an inputHash that is not 64 lowercase hex chars, so raw prompt text cannot be smuggled into the hash field"
  - "AI prefs use runed PersistedState in localStorage (keys tran.ai.provider / tran.ai.sample / tran.ai.models), per UI-SPEC; they hold no key material and are not in backups"
  - "A locked or keyless selection resolves to the fixture provider (never the network); 'locked' still surfaces as its own Selection kind so the panel can offer Unlock"
  - "Key state is read synchronously from vault.getStatus() (keyStateFrom); no key mirror was needed because adapters read the key asynchronously at stream time"
  - "registerAiTestKeys call site deferred to 05-15: Phase 4 registers testers in Settings onMount, and the Settings AI section is 05-15's"
requirements-completed: []
metrics:
  duration: 8min
  completed: 2026-10-05
  tasks: 2
  files: 12
---

# Phase 5 Plan 11: Phase 3 integration (AI drafts storage, prefs, provider selection, Test key) Summary

AI generations now persist as `aiArtifacts` rows in the Phase 3 `tran` database (new version 3), appear in the backup as "AI drafts", and never store raw inputs or keys. AI prefs (provider, sample toggle, model overrides) persist per device. `setup.ts` builds live adapters that read their key from the vault, decides live vs sample with a stated reason, and registers Test key for Anthropic, OpenAI, Google Gemini and OpenRouter through the Phase 3 hook.

Advances AI-01 (provider choice, keys from the vault, Test connection per provider) and AI-04 (stored draft with status draft / acknowledged / sent and `sentAt`; the code never sends). Both stay open until the 05-16 gate.

## Phase 3 name/path mapping

| Plan name | Real path / export | Notes |
| --- | --- | --- |
| Phase 3 Dexie module | `apps/web/src/lib/storage/db.ts`, `class TranDb` | Latest was version 2 (Phase 4). Added `this.version(3).stores(AI_STORES)` and `aiArtifacts!: Table<AiArtifact, string>`. Additions only (`5 0` numstat). |
| Backup registry | `apps/web/src/lib/storage/backup-registry.ts` | No per-table schema parameter. Built into `DEFAULT_TABLES` (as Phase 4 did), so a Settings backup always includes AI drafts. |
| Export key-free scan | `$lib/storage/backup` `buildBackupText` → `@tran/core` `findKeyMaterial` | Validates every record with `SyncableSchema`. |
| Syncable helpers | `@tran/core` `newSyncable`, `tombstone`, `Syncable` | ISO timestamps; `deletedAt` optional. |
| Repo pattern + first-record meta | `$lib/storage/repo.ts`, `$lib/storage/meta.ts` `META.firstRecordAt` | `create()` sets `firstRecordAt` in the same transaction, like `createRepo`. |
| Test IDB | `$lib/storage/test-utils` `freshIdb()`, `memoryStorage()` | |
| Vault | `$lib/storage/secrets` `getVault()`, `Vault.getKey(p)`, `Vault.getStatus().providers[p].state: KeyState` | Read through `keyStateFrom(vault)` and `resolveProvider(..., { getKey: (id) => vault.getKey(id) })`. |
| Key tester hook | `$lib/storage/secrets/testers` `registerKeyTester(p, (key, signal) => Promise<KeyTestResult>)` | `testers.ts` was not edited. `AiKeyTestResult` adds an optional `ai` field. |
| Settings prefs mechanism | runed `PersistedState` (0.37.1, already a dependency) | Phase 3 shipped no PersistedState wrapper. Its `prefs` Dexie table is async and backed up, which does not fit a synchronous picker. |
| Fake keys | `apps/web/tests/support/fake-keys.ts` `fakeKey(p)` | |
| fake-indexeddb | already in apps/web devDependencies (6.2.5) | No package.json or lockfile change. |

## Tasks

| Task | Name | Commits |
| --- | --- | --- |
| 1 | aiArtifacts table, repository and backup registration | 5deb875 (RED), 30519ae (GREEN) |
| 2 | AI prefs, provider selection and testKey registration | d78cdfc (RED), c9f2447 (GREEN) |

## What the tests prove

**artifacts.test.ts (14):** create stamps a valid Syncable draft (uuid, `local`, ISO, `schemaVersion` 1, `status` draft, `sentAt` null) and sets `firstRecordAt`. The stored object's keys exactly equal the AiArtifact keys even when `inputs`, `system`, `user`, `key` and `apiKey` are passed. A non-hash `inputHash` is rejected and nothing is written. With 12 drafts, pages are 10 and then 2, newest first, and another feature never appears. `sent` sets `sentAt` and `updatedAt`. `acknowledged` clears `sentAt`. An unknown status is rejected. `updateText` bumps `updatedAt`. A soft-deleted draft is hidden from list and count, but `get` returns it with `deletedAt`. Writes to a missing id are no-ops. Export includes the artifact, `parseBackup` accepts it, and a key pasted into a draft blocks export with `key-material`.

**db.test.ts (additions):** verno 3, the `aiArtifacts` indexes, and an in-place upgrade from a real version 2 database that keeps existing rows.

**setup.test.ts (33):** every `selectProvider` and `defaultPreferred` case in the plan, `toAiKeyState`, `keyStateFrom`, and all four adapters rejecting with `LlmError('locked')` on a null key. Also: `resolveProvider` (live → adapter asking the vault for its own id; sample and locked → fixture, with the vault never asked), and `PROBES` alignment. The outcome→status mapping table. Registering exactly four testers (never rentcast) through an injected register and through the real Phase 3 hook, including cleanup. The anthropic tester returns `{ status: 'accepted', message: 'Anthropic accepted this key.', ai: { outcome: 'ok', modelListed: true } }`. A rejected key's result never contains the key, and an unreachable host gives `failed` with the host line. Prefs: defaults, `effectiveModel`/`setModel` (`gpt-6.1-sol` → `gpt-5.6-terra` → reset), invalid ids throw `spaces`/`empty` and leave the value unchanged, persistence across instances, tampered storage ignored, and no-window in-memory mode.

## Mutation proof

| Mutation | Result |
| --- | --- |
| Remove `...AI_BACKUP_TABLES` from `DEFAULT_TABLES` | "every TranDb table is registered XOR excluded" and 9 others go red |
| Remove `this.version(3).stores(AI_STORES)` | the db schema tests (verno, indexes, upgrade) and every artifact test go red |
| Sample toggle no longer wins in `selectProvider` | "the sample toggle wins: reason 'toggle'" goes red |
| Map `quota` to `failed` | "{ outcome: 'quota' } -> rate-limited" goes red |

All mutations were restored from copies, and the suites were green again. None was committed.

## Verification

- `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/storage apps/web/src/lib/storage apps/web/src/lib/data`: 31 files, 454 tests passed
- `corepack pnpm exec vitest run --project web apps/web/src/lib/ai`: 18 files, 393 tests passed
- `corepack pnpm test:unit`: 116 files, 2431 tests passed (with the parallel 05-10 work in the tree)
- `corepack pnpm check`: 0 errors, 0 warnings. `corepack pnpm lint` (prettier + eslint, including 05-10's new lib/ai boundary): clean
- `grep -c rentcast apps/web/src/lib/ai/setup.ts` prints 0. `grep -E "inputs|apiKey" artifacts.ts` matches only a comment.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `deletedAt: null` would break backup import**
- **Issue:** The plan's AiArtifact had `deletedAt: string | null` with live rows at `null`. Phase 3's `SyncableSchema` has `deletedAt: z.optional(z.iso.datetime())`, so a `null` fails validation and the whole backup import is rejected (the same trap 04-01 hit).
- **Fix:** `deletedAt` is absent while live and set by `tombstone()`. Queries filter on `deletedAt === undefined`, as Phase 3's `createRepo` does.
- **Commit:** 30519ae

**2. [Rule 3 - Blocking] Import cycle between the registry and artifacts**
- **Issue:** `backup-registry.ts` → `artifacts.ts` → `meta.ts` → `backup-registry.ts` would hit a TDZ error on `AI_BACKUP_TABLES`.
- **Fix:** The constants and types moved to the dependency-free `ai/storage/tables.ts` (mirroring `$lib/data/tables`). `artifacts.ts` re-exports them.
- **Commit:** 30519ae

**3. [Rule 3 - Blocking] Earlier tests pinned the latest version**
- `db.test.ts` (verno 2), `backup-registry.test.ts` (defaults without AI), `backup.test.ts` (`TestDb` at version 3, which now collides) and `data/platform.test.ts` (verno must equal 2) were updated. The platform test now asserts that the Phase 4 block is `version(2)`, and that verno is at least 2 and equals the highest declared version. The assertions are no weaker.
- **Commit:** 30519ae

**4. [Rule 2 - Critical] Validation added beyond the plan**
- `inputHash` must be SHA-256 hex. `setStatus` rejects unknown statuses. Prefs reject non-AI providers and validate stored values on read. The prefs factory falls back to in-memory when localStorage is blocked, so importing the module cannot throw.

**5. Additions to the contract**
- `keyStateFrom(vault)` and `resolveProvider(selection, deps)` were added so 05-13..05-15 do not re-derive vault wiring. `createArtifactRepo` takes optional `{ now, uuid }` for deterministic tests.

### Deferred

- **Call site for `registerAiTestKeys`:** this goes in the Settings AI section's `onMount` (with cleanup on unmount, like Phase 4's `enableRentCastKeyTest`) via `import('$lib/ai/setup')`. It is deferred to 05-15, which owns that section.
- The Phase 3 tester's `signal` is not forwarded, because `runTestConnection` has no signal parameter.

## Known Stubs

None.

## Self-Check: PASSED
