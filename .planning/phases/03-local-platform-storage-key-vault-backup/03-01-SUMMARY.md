---
phase: 03-local-platform-storage-key-vault-backup
plan: 01
subsystem: core-platform
tags: [providers, csp, syncable, zod, date-fns, dexie, fake-indexeddb, eslint, test-fakes]
requires: []
provides:
  - "@tran/core providers registry (PROVIDER_IDS, ProviderId, ProviderInfo, PROVIDERS, providerById)"
  - "@tran/core Syncable shape (Syncable, OWNER_LOCAL, SyncableSchema, newSyncable, touch, tombstone)"
  - "@tran/core reminder math (BACKUP_REMINDER_DAYS, ReminderInput, ReminderResult, backupReminderDue, BackupAge, lastBackupAge)"
  - "web test helpers memoryStorage()/freshIdb() at apps/web/src/lib/storage/test-utils.ts"
  - "planted keys fakeKey()/FAKE_PROVIDERS at apps/web/tests/support/fake-keys.ts"
  - "ESLint guardrails: SW fetch allowance, confirm ban, vault no-console"
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 03-07, 03-08, 03-09, 03-10, 03-11, 03-12, 03-13, 03-14, 03-15, 03-16, 03-17, phase-04, phase-05]
tech-stack:
  added: ["zod 4.6.4 (core dep)", "date-fns 4.4.0 (core dep)", "dexie 4.4.6 (web dev)", "fake-indexeddb 6.2.5 (web dev)", "@tran/core workspace:* (web dev)"]
  patterns: ["frozen registry (PORTALS precedent)", "header-only key auth contract", "calendar-day math via differenceInCalendarDays", "runtime-assembled planted keys", "scoped ESLint override per file"]
key-files:
  created:
    - packages/core/src/providers.ts
    - packages/core/src/providers.test.ts
    - packages/core/src/syncable.ts
    - packages/core/src/syncable.test.ts
    - packages/core/src/reminder.ts
    - packages/core/src/reminder.test.ts
    - scripts/provider-hosts.test.ts
    - apps/web/src/lib/storage/test-utils.ts
    - apps/web/tests/support/fake-keys.ts
  modified:
    - packages/core/package.json
    - packages/core/src/index.ts
    - apps/web/package.json
    - pnpm-lock.yaml
    - eslint.config.js
    - scripts/eslint-rules.test.ts
decisions:
  - "Provider registry is the single source for host/label/keyUrl/auth header; host ⊆ CSP connect-src is enforced in the scripts project (core has no node types)"
  - "backupReminderDue returns {due:false} when neither lastBackupAt nor firstRecordAt exists (deviation from RESEARCH Pattern 6, which computed 0 days)"
  - "Core stays free of platform globals: ids are passed in, tests clone via JSON instead of structuredClone"
metrics:
  duration: 6min
  completed: 2026-10-04
  tasks: 3
  files: 15
---

# Phase 3 Plan 01: Core Contracts, Pinned Deps, Test Fakes and Lint Guardrails Summary

Five-provider frozen registry with header-only auth, proven inside the CSP connect-src allowlist. Alongside it: a zod/mini `Syncable` record shape, calendar-day backup-reminder math, isolated fake-indexeddb and Storage helpers, runtime-built planted keys, and three scoped ESLint guardrails. All non-UI deps are exact-pinned and `pnpm-workspace.yaml` is unchanged.

## Exports for later plans (Phase 3/4/5 consumers)

All of these are re-exported from `@tran/core` (`packages/core/src/index.ts`; the `PORTALS`/`isPortal` exports are unchanged):

| Module | Exports |
|---|---|
| `packages/core/src/providers.ts` | `PROVIDER_IDS` (frozen `['rentcast','anthropic','openai','gemini','openrouter']`), `type ProviderId`, `interface ProviderInfo { id, label, host, keyUrl, note?, auth: { kind: 'header'; header } }`, `PROVIDERS: readonly ProviderInfo[]` (frozen array + entries + auth), `providerById(id): ProviderInfo \| undefined` |
| `packages/core/src/syncable.ts` | `OWNER_LOCAL = 'local'`, `interface Syncable`, `SyncableSchema` (zod/mini `looseObject`), `newSyncable({ id, now, schemaVersion })`, `touch(rec, now)`, `tombstone(rec, now)` (both return new objects) |
| `packages/core/src/reminder.ts` | `BACKUP_REMINDER_DAYS = 7`, `type ReminderInput`, `type ReminderResult`, `backupReminderDue(input, days?)`, `type BackupAge`, `lastBackupAge(now, lastBackupAt?)` |

Auth headers (the contract for Phases 4/5): RentCast `X-Api-Key`, Anthropic `x-api-key`, OpenAI `Authorization`, Gemini `x-goog-api-key` (never `?key=`), OpenRouter `Authorization`.

Test-only helpers:
- `apps/web/src/lib/storage/test-utils.ts`: `memoryStorage(): MemoryStorage` (Map-backed `getItem/setItem/removeItem` + `size` + `dump()`), `freshIdb(): { indexedDB: IDBFactory; IDBKeyRange }` (new `IDBFactory()` per call). Import it from tests as `$lib/storage/test-utils`. App code must never import it.
- `apps/web/tests/support/fake-keys.ts`: `fakeKey(provider, seed = 'A')`, `FAKE_PROVIDERS`, `type FakeProvider`. Keys are shaped like real ones (`sk-ant-api03-…`, `sk-proj-…`, `sk-or-v1-…`, `AIza…`, `rc…`) but assembled at runtime, so gitleaks passes.

ESLint rules (`eslint.config.js`, inserted between the adapter fetch allowlist and the marketing block):
- `apps/web/src/service-worker.ts`: `no-restricted-syntax: 'off'` (this file only).
- `apps/web/src/**/*.{ts,js,svelte}`: `no-restricted-globals` (`confirm`) + `no-restricted-properties` (`window.confirm`). Both messages name ConfirmDialog.
- `apps/web/src/lib/storage/secrets/**`: `no-console: 'error'`.
- Caution for later plans: flat-config rule entries REPLACE rather than merge. Any later block that sets `no-restricted-globals` or `no-restricted-properties` on a `${WEB}` path must include the confirm entries again.

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | 174f97b | test(03-01): add failing provider registry tests |
| 1 GREEN | 6451f46 | feat(03-01): provider registry with CSP-host and header-auth contracts |
| 2 RED | b11e355 | test(03-01): add failing syncable and reminder tests |
| 2 GREEN | 2b4b12b | feat(03-01): syncable records, reminder math, and test fakes |
| 3 RED | 8218694 | test(03-01): add failing Phase 3 lint guardrail tests |
| 3 GREEN | 9874451 | feat(03-01): lint guardrails for service worker fetch, confirm and vault logging |

## Verification

- `corepack pnpm check`: 0 errors (core tsc + svelte-check, 534 files)
- `corepack pnpm lint`: green (prettier + eslint on the real tree)
- `corepack pnpm test:unit`: 18 files, 261 tests passed (no libuv flake this run)
- `git diff --exit-code pnpm-workspace.yaml`: exit 0 after all three installs
- `node scripts/gitleaks.mjs staged`: no leaks on both feat commits
- Acceptance greps: `?key=` count 0 in providers.ts; `crypto|window|navigator` count 0 in syncable.ts and reminder.ts; no `sk-ant-|AIza|sk-proj-` literal in fake-keys.ts
- Runtime smoke test: every `fakeKey` produces the expected prefix, and `freshIdb()` returns distinct factories

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment literal tripped the `?key=` acceptance grep**
- **Found during:** Task 1
- **Issue:** The invariant comment in providers.ts said "no `?key=`", so `grep -c "?key="` returned 1.
- **Fix:** Reworded it to "Never put a key in a URL query parameter".
- **Commit:** 6451f46

**2. [Rule 3 - Blocking] `structuredClone` is unavailable under core's `lib: ES2024, types: []`**
- **Found during:** Task 2 (RED authoring)
- **Fix:** The syncable tests snapshot inputs with `JSON.parse(JSON.stringify(rec))`, so `tsc --noEmit` in core stays clean.
- **Commit:** b11e355

**3. Doc-comment wording in syncable.ts**
- The plan asked for a comment naming `crypto.randomUUID()`, but the acceptance criterion requires zero `crypto` matches, comments included. The comment now says "apps/web generates a random v4 UUID". The acceptance criterion wins.

Fraunces was already pinned at 5.3.0 (Phase 2), so no install was needed.

## Known Stubs

None. `test-utils.ts` and `fake-keys.ts` are intentionally test-only and have no consumers yet; later Phase 3 plans import them.

## Self-Check: PASSED
