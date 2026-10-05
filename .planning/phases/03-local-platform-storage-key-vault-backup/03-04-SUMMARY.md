---
phase: 03-local-platform-storage-key-vault-backup
plan: 04
subsystem: key-vault
tags: [webcrypto, pbkdf2, aes-gcm, dexie, tran-secrets, sessionstorage, broadcastchannel, byok]
requires:
  - phase: 03-01
    provides: "PROVIDER_IDS/ProviderId, memoryStorage()/freshIdb() test helpers, fakeKey(), no-console rule on lib/storage/secrets/**"
provides:
  - "WebCrypto primitives (ITERATIONS 600k, deriveKey, seal/open, sealBytes/openBytes, aadFor, CHECK_AAD, DEK_AAD, newSalt, toBytes)"
  - "Separate 'tran-secrets' Dexie DB (keys: provider, meta: id)"
  - "Vault class: session default, remember opt-in, removeKey, forgetAll with cross-tab broadcast, knownSecrets"
  - "registerKeyTester hook + KeyTestResult (accepted/rejected/rate-limited/failed)"
  - "createVaultState runes wrapper and getVault() browser singleton with blocked-storage fallback"
affects: [03-07, 03-08, 03-09, 03-10, phase-04, phase-05]
tech-stack:
  added: []
  patterns:
    - "Dependency-injected Vault (session store, openDb, channel, iterations, now, tabId)"
    - "Fixed-code VaultError, never interpolated"
    - "Broadcast {type, from} only; each tab clears its own sessionStorage"
    - "Clear tran-secrets tables in one rw transaction, never delete the DB"
key-files:
  created:
    - apps/web/src/lib/storage/secrets/crypto.ts
    - apps/web/src/lib/storage/secrets/crypto.test.ts
    - apps/web/src/lib/storage/secrets/secrets-db.ts
    - apps/web/src/lib/storage/secrets/memory-storage.ts
    - apps/web/src/lib/storage/secrets/channel.ts
    - apps/web/src/lib/storage/secrets/vault.ts
    - apps/web/src/lib/storage/secrets/vault.test.ts
    - apps/web/src/lib/storage/secrets/testers.ts
    - apps/web/src/lib/storage/secrets/testers.test.ts
    - apps/web/src/lib/storage/secrets/vault-state.svelte.ts
    - apps/web/src/lib/storage/secrets/index.ts
  modified:
    - scripts/eslint-rules.test.ts
key-decisions:
  - "A tab receiving a remote switch to remember moves its own session-only keys into tran-secrets (existing rows win), so a key lives in exactly one store"
  - "registerKeyTester's unregister only removes its own registration (a stale unregister cannot remove a replacement)"
  - "Rows holding only a sealed box surface as state 'locked' now; hasLock/locked/cooldownUntil stay false/null until 03-07"
  - "setMode is a no-op when the mode is unchanged"
patterns-established:
  - "Vault tests: makeVault() helper with freshIdb, memoryStorage, real Node BroadcastChannel per-test name, spy-wrapped postMessage, dispose in afterEach"
requirements-completed: [PLAT-01, PLAT-02, PLAT-03]
duration: 10min
completed: 2026-10-04
---

# Phase 3 Plan 04: Key Vault Core Summary

**Per-tab session vault with opt-in "remember on this device" in a separate `tran-secrets` IndexedDB. Forget-all clears session, memory, keys and meta, then broadcasts `{type, from}` so every tab clears itself. Provider-bound PBKDF2-600k/AES-GCM primitives and a pluggable key-tester hook complete it.**

## Performance

- **Duration:** about 10 min
- **Completed:** 2026-10-04
- **Tasks:** 3 (TDD, RED and GREEN committed separately) plus 1 coordinator-requested fix
- **Files:** 11 created, 1 modified

## Vault contract (Phases 4/5)

All exports below are re-exported from `$lib/storage/secrets` (`index.ts`). Import that module only via dynamic `import()` in `onMount`. The marketing import ban already covers it.

| Export | Path | Signature |
|---|---|---|
| `getVault` | secrets/index.ts | `getVault(): Promise<Vault>`. Browser singleton. Uses `window.sessionStorage` (falls back to `memoryStorage()` if access throws) and `BroadcastChannel('tran-vault')` (or `null`). Calls `init()` once. |
| `Vault.getKey` | secrets/vault.ts | `getKey(p: ProviderId): Promise<string \| undefined>`. Returns `undefined` when the key is absent or locked. |
| `Vault.setKey` | secrets/vault.ts | `setKey(p: ProviderId, key: string): Promise<void>`. Trims the key. Throws `VaultError('empty-key' \| 'invalid-key')`. Writes to the session store, or to tran-secrets in remember mode. |
| `Vault.removeKey` | secrets/vault.ts | `removeKey(p: ProviderId): Promise<void>`. Removes the key from session, memory and tran-secrets. |
| `Vault.forgetAll` | secrets/vault.ts | `forgetAll(): Promise<void>`. Clears session, memory, `keys.clear()` and `meta.clear()` in one rw transaction, sets mode to session, emits `forgotten`, posts `forget-all`. |
| `Vault.setMode` | secrets/vault.ts | `setMode(m: 'session' \| 'remember'): Promise<void>`. Migrates keys between stores. Throws `storage-blocked` (no DB) or `vault-locked`. Posts `mode-changed`. |
| `Vault.getStatus` | secrets/vault.ts | `getStatus(): VaultStatus`. Fresh snapshot: `{ mode, hasLock, locked, cooldownUntil, storageBlocked, providers: Record<ProviderId, { state: KeyState; last4? }> }`. |
| `Vault.onChange` | secrets/vault.ts | `onChange(cb: (e: VaultEvent) => void): () => void`. `VaultEvent = { kind: 'keys-changed' \| 'mode-changed' \| 'forgotten' \| 'locked' \| 'unlocked' \| 'lock-changed'; provider?: ProviderId; remote: boolean }`. |
| `Vault.knownSecrets` | secrets/vault.ts | `knownSecrets(): string[]`. For the export key scan only. Never log it. |
| `Vault.dispose` | secrets/vault.ts | `dispose(): void`. Closes the channel and drops listeners. |
| `KeyState` | secrets/vault.ts | `'none' \| 'session' \| 'remembered' \| 'locked'` |
| `VaultError` | secrets/vault.ts | `class VaultError extends Error { code: VaultErrorCode }`, where the code is one of `empty-key, invalid-key, vault-locked, storage-blocked, wrong-passphrase, cooldown, no-lock, corrupt` |
| `SESSION_KEY` | secrets/vault.ts | `'tran.vault.session.v1'` |
| `registerKeyTester` | secrets/testers.ts | `registerKeyTester(p: ProviderId, fn: KeyTester): () => void`. Last registration wins. The returned unregister only removes its own registration. |
| `getKeyTester` / `hasKeyTester` | secrets/testers.ts | `(p: ProviderId) => KeyTester \| undefined` / `boolean` |
| `KeyTester` | secrets/testers.ts | `(key: string, signal: AbortSignal) => Promise<KeyTestResult>` |
| `KeyTestResult` | secrets/testers.ts | `{ status: 'accepted' \| 'rejected' \| 'rate-limited' \| 'failed'; message?: string }`. `message` overrides the UI line and must never echo the key. `KEY_TEST_STATUSES` lists the four statuses. |
| `createVaultState` | secrets/vault-state.svelte.ts | `createVaultState(vault): { readonly status: VaultStatus; dispose(): void }`. `$state`-backed. Reactivity is proven in E2E only. |
| crypto (for 03-07) | secrets/crypto.ts | `ITERATIONS=600_000`, `SALT_BYTES=16`, `IV_BYTES=12`, `Box`, `newSalt()`, `deriveKey(pass, salt, iterations?)` (NFC, non-extractable), `seal/open`, `sealBytes/openBytes`, `aadFor(p)`, `CHECK_AAD`, `DEK_AAD`, `toBytes()` |
| `SecretsDb` / `createSecretsDb` | secrets/secrets-db.ts | Dexie `'tran-secrets'` v1 `{ keys: 'provider', meta: 'id' }`. `KeyRow { provider, value?, box? }`, `MetaRow { id, ... }` |
| `VAULT_CHANNEL` / `VaultMessage` / `ChannelLike` | secrets/channel.ts | `'tran-vault'`, `{ type: 'forget-all' \| 'locked' \| 'mode-changed' \| 'keys-changed'; from }` |

Phase 3 registers no testers (grep confirms there is no `registerKeyTester(` call outside `secrets/`).

## Forget-all mutation runs

For each run, one line in `Vault.forgetAll` was commented out, `vitest run --project web secrets/vault` was run, and the line was restored. All 21 tests pass after every restore.

| # | Mutation | Result | Failing tests |
|---|---|---|---|
| a | `this.#session.removeItem(SESSION_KEY)` | KILLED (2 fail) | forgetAll > clears session, memory, every tran-secrets key and meta row, and resets the mode; forgetAll > forgets in session mode too |
| b | `this.#memory.clear()` | KILLED (3 fail) | the two above + storage blocked > falls back to session-only when tran-secrets cannot open |
| c | `await db.keys.clear()` | KILLED (1 fail) | forgetAll > clears session, memory, every tran-secrets key and meta row, and resets the mode |
| d | `await db.meta.clear()` | KILLED (1 fail) | forgetAll > clears session, memory, every tran-secrets key and meta row, and resets the mode |
| e | `this.#post('forget-all')` | KILLED (3 fail) | forgetAll > broadcasts forget-all so another tab clears ITS OWN session store and memory; forgetAll > ignores its own broadcasts; broadcast payloads > carry only {type, from} |
| bonus | receiver's `this.#session.removeItem(SESSION_KEY)` in the remote `forget-all` handler | KILLED (1 fail) | forgetAll > broadcasts forget-all so another tab clears ITS OWN session store and memory |

## Task Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | 57aa927 | test(03-04): add failing vault crypto tests |
| 1 GREEN | 8974085 | feat(03-04): WebCrypto primitives and tran-secrets database |
| 2 RED | 95304fa | test(03-04): add failing vault mode and forget-all tests |
| 2 GREEN | 8a91ea6 | feat(03-04): key vault with session default, remember opt-in and forget-all broadcast |
| 3 RED | f9057de | test(03-04): add failing key-tester hook tests |
| 3 GREEN | 5081544 | feat(03-04): key-tester hook, reactive vault state and browser singleton |
| fix | 3e5547e | fix(03-04): vault no-console probe coexists with the real vault module |

## Verification

- `vitest run --project web secrets`: 3 files, 41 tests passed (crypto 14, vault 21, testers 6). The process exits cleanly because channels are disposed in afterEach.
- `vitest run --project scripts`: 255 passed. `test:unit`: every 03-04 file is green.
- `pnpm --filter web check`: 0 errors. The repo-wide `pnpm check` hit a type error in another executor's uncommitted `packages/core/src/backup/envelope.ts`. That file is out of scope and was not touched.
- ESLint and Prettier pass on `apps/web/src/lib/storage` and `scripts/eslint-rules.test.ts`.
- `node scripts/gitleaks.mjs staged`: no leaks on every feat commit.
- Acceptance greps: `ITERATIONS = 600_000`, `NON_EXTRACTABLE = false`, `'tran-secrets'`, `keys: 'provider', meta: 'id'` are all present. `Dexie.delete|console.` appears 0 times in vault.ts. `new BroadcastChannel(VAULT_CHANNEL)` appears in index.ts. There is no `registerKeyTester(` outside `secrets/`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, coordinator-requested] 03-01's lint guardrail test asserted that no vault module exists**
- **Found during:** plan verification. The `scripts` project failed with "Phase 3 guardrails" because its `beforeAll` asserted that `secrets/vault.ts` does not exist.
- **Fix:** The `no-console` probe now lints in memory against the reserved virtual path `secrets/__lint-probe__.ts`, and the precondition asserts that the probe file does not exist. Rule coverage is unchanged: the test still proves `console.*` is an error under `lib/storage/secrets/**`, and the control case still passes.
- **Files modified:** scripts/eslint-rules.test.ts
- **Commit:** 3e5547e

**2. [Rule 1 - Bug] Remote switch to remember dropped the receiving tab's own session keys**
- **Found during:** Task 2 (self-review before commit)
- **Issue:** The first draft removed the receiving tab's session entry without moving its session-only keys into tran-secrets. Those keys would have been lost on reload.
- **Fix:** The receiving tab now moves its own session-only keys into tran-secrets. Existing rows win. A test was added for this.
- **Commit:** 8a91ea6

**3. Acceptance-grep wording.** A comment saying "never Dexie.delete()" in vault.ts tripped the zero-count grep. It now reads "never delete the database".

**4. Formatting scope.** Because five executors were running in parallel, I ran Prettier only on this plan's files (`prettier --write <files>`) instead of the repo-wide `pnpm format`, so I never rewrote another plan's in-flight files.

## Known Stubs

None. `hasLock`, `locked` and `cooldownUntil` are always `false`/`false`/`null` by design until the passphrase lock in 03-07. The `'locked'` message handler and the `wrong-passphrase`/`cooldown`/`no-lock`/`corrupt` codes are reserved for 03-07.

## Self-Check: PASSED
