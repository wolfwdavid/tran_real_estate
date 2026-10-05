---
phase: 3
slug: local-platform-storage-key-vault-backup
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-04
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11 (projects `web`, `core`, `brand`, `scripts`); fake-indexeddb 6.2.5 (new in 03-01) for Dexie in the Node `web` project; Node 24 native `crypto.subtle` + `BroadcastChannel`; Playwright 1.63.0 + @axe-core/playwright 4.13.0 (projects `root`, `sub`); build oracle `scripts/assert-csp.mjs` (CARRIERS + manifest/icon checks added in 03-03/03-09); copy gate `scripts/banned-terms.mjs`; class gate `scripts/ui-class-guard.mjs` (new in 03-06) |
| **Config file** | `vitest.config.ts` (root projects, unchanged), `packages/core/vitest.config.ts`, `apps/web/vite.config.ts`, `scripts/vitest.config.ts`, `apps/web/playwright.config.ts` (unchanged; service workers allowed by default) |
| **Quick run command** | `corepack pnpm lint && corepack pnpm test:unit` (+ `corepack pnpm banned && corepack pnpm ui:guard` once 03-06 lands) |
| **E2E run (needs builds)** | `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert && corepack pnpm test:e2e` |
| **Full suite command** | `corepack pnpm verify` (check → lint → banned → ui:guard → test:unit → builds → csp:assert → test:e2e → guard → secrets:canary → secrets:scan → lint:workflows) |
| **Estimated runtime** | quick ~30-45 s (vault tests inject 1,000 PBKDF2 iterations; one test uses the real 600,000 ≈ 0.2 s); full ~3-4 min warm (Phase 2 baseline plus ~10 new specs, each running on both bases) |

---

## Sampling Rate

- **After every task commit:** `corepack pnpm check && corepack pnpm lint` plus the task's own `<automated>` command (the pre-commit hook runs gitleaks staged + the real-data guard automatically).
- **After every plan wave:** `corepack pnpm verify`.
- **Before `/gsd:verify-work`:** `corepack pnpm verify` green in one invocation (plan 03-17) and the mutation ledger complete.
- **Max feedback latency:** ~45 s for unit/lint; E2E tasks need both builds (~60-90 s) and are always the last task of their plan.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | PLAT-01 | unit (registry + host ⊆ CSP + header-auth contract) | `corepack pnpm vitest run --project core providers && corepack pnpm vitest run --project scripts provider-hosts` | ✅ created W0 (providers.test.ts, scripts/provider-hosts.test.ts) | ✅ green |
| 3-01-02 | 01 | 1 | PLAT-04, PLAT-05 | unit (Syncable schema, 7-day boundary) | `corepack pnpm vitest run --project core` | ✅ created W0 (syncable.test.ts, reminder.test.ts) | ✅ green |
| 3-01-03 | 01 | 1 | PLAT-01 | unit (ESLint rule proofs) | `corepack pnpm vitest run --project scripts eslint-rules && corepack pnpm lint` | ✅ extend | ✅ green |
| 3-02-01 | 02 | 2 | PLAT-04 | unit (envelope error codes, migration gap guard, filename) | `corepack pnpm vitest run --project core backup` | ✅ created W0 (envelope.test.ts, migrations.test.ts) | ✅ green |
| 3-02-02 | 02 | 2 | PLAT-04 | unit + mutation (merge invariant, tie rule, key scan) | `corepack pnpm vitest run --project core` | ✅ created W0 (diff.test.ts, key-scan.test.ts) | ✅ green |
| 3-03-01 | 03 | 2 | PLAT-06 | unit (manifest relative URLs, PNG IHDR sizes, brand parity) | `corepack pnpm vitest run --project scripts pwa-assets` | ✅ created W0 (scripts/pwa-assets.test.ts) | ✅ green |
| 3-03-02 | 03 | 2 | PLAT-06 | unit (oracle mutations) + build oracle + E2E regression | `corepack pnpm vitest run --project scripts assert-csp && corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert && corepack pnpm test:e2e` | ✅ extend | ✅ green |
| 3-04-01 | 04 | 2 | PLAT-03 | unit + mutation (wrong pass, wrong AAD, distinct IVs, non-extractable) | `corepack pnpm vitest run --project web secrets/crypto` | ✅ created W0 (crypto.test.ts) | ✅ green |
| 3-04-02 | 04 | 2 | PLAT-01, PLAT-02 | unit + mutation (session default, remember, forget-all ×5 steps, cross-tab) | `corepack pnpm vitest run --project web secrets/vault` | ✅ created W0 (vault.test.ts) | ✅ green |
| 3-04-03 | 04 | 2 | PLAT-01 | unit (tester hook) + check | `corepack pnpm vitest run --project web secrets && corepack pnpm check` | ✅ created W0 (testers.test.ts) | ✅ green |
| 3-05-01 | 05 | 2 | PLAT-04, PLAT-05 | unit (TranDb versions, repos, tombstones, firstRecordAt, registry) | `corepack pnpm vitest run --project web storage/db storage/repo storage/backup-registry` | ✅ created W0 | ✅ green |
| 3-05-02 | 05 | 2 | PLAT-05 | unit (persist called synchronously, status, estimate, formatBytes) | `corepack pnpm vitest run --project web storage/persistence` | ✅ created W0 (persistence.test.ts) | ✅ green |
| 3-06-01 | 06 | 2 | PLAT-01, PLAT-03, PLAT-04 | check + pin assertion + workspace guard | `corepack pnpm check && git diff --exit-code pnpm-workspace.yaml` (+ exact-pin node one-liner in plan) | ✅ | ✅ green |
| 3-06-02 | 06 | 2 | PLAT-01, PLAT-03, PLAT-04 | unit (brand alias parity + contrast) + build oracle | `corepack pnpm vitest run --project brand && corepack pnpm vitest run --project web theme-parity && corepack pnpm lint && corepack pnpm build:root && corepack pnpm csp:assert` | ✅ extend | ✅ green |
| 3-06-03 | 06 | 2 | PLAT-01, PLAT-03, PLAT-04 | unit + CLI non-vacuity (class guard) + workflow gate | `corepack pnpm vitest run --project scripts ui-class-guard workflow-gate && corepack pnpm ui:guard && corepack pnpm lint:workflows` | ✅ created W0 (scripts/ui-class-guard.test.ts) | ✅ green |
| 3-07-01 | 07 | 3 | PLAT-03 | unit (cooldown schedule, wrap/unwrap/rewrap) | `corepack pnpm vitest run --project web secrets/vault-lock` | ✅ created W0 (vault-lock.test.ts) | ✅ green |
| 3-07-02 | 07 | 3 | PLAT-03 | unit + mutation (at-rest rows, reopen locked, AAD swap, persisted cooldown, cross-tab lock) | `corepack pnpm vitest run --project web secrets` | ✅ created W0 | ✅ green |
| 3-08-01 | 08 | 3 | PLAT-04, PLAT-05 | unit + mutation (registry-only export, planted key blocks, lastBackupAt) | `corepack pnpm vitest run --project web storage/backup` | ✅ created W0 (backup.test.ts) | ✅ green |
| 3-08-02 | 08 | 3 | PLAT-04 | unit + mutation (25 MB pre-read, single-transaction rollback, idempotent merge) | `corepack pnpm vitest run --project web storage` | ✅ created W0 | ✅ green |
| 3-09-01 | 09 | 3 | PLAT-06 | unit (SW source guard, dotfile filter) + build oracle | `corepack pnpm vitest run --project scripts service-worker-guard assert-csp && corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert` | ✅ created W0 (scripts/service-worker-guard.test.ts) | ✅ green |
| 3-09-02 | 09 | 3 | PLAT-06 | E2E (scope, control, offline, 404, route mock, .nojekyll, manifest via CDP, icons) | `corepack pnpm --filter web exec playwright test pwa` | ✅ created W0 (tests/e2e/pwa.spec.ts) | ✅ green |
| 3-10-01 | 10 | 3 | PLAT-01, PLAT-05 | unit (section registry order) + check/lint/banned | `corepack pnpm vitest run --project web settings/sections && corepack pnpm check && corepack pnpm lint && corepack pnpm banned` | ✅ created W0 (sections.test.ts) | ✅ green |
| 3-10-02 | 10 | 3 | PLAT-01, PLAT-05 | build oracle (static shell, probe kept) | `corepack pnpm check && corepack pnpm lint && corepack pnpm banned && corepack pnpm ui:guard && corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert` | ✅ | ✅ green |
| 3-10-03 | 10 | 3 | PLAT-01, PLAT-05 | E2E (shell, announcer, blocked storage, cross-tab announce) | `corepack pnpm --filter web exec playwright test settings-shell csp routing a11y` | ✅ created W0 (settings-shell.spec.ts, helpers/settings.ts) | ✅ green |
| 3-11-01 | 11 | 4 | PLAT-01 | check/lint/banned/ui:guard + build oracle | `corepack pnpm check && corepack pnpm lint && corepack pnpm banned && corepack pnpm ui:guard && corepack pnpm build:root && corepack pnpm csp:assert` | ✅ | ✅ green |
| 3-11-02 | 11 | 4 | PLAT-01, PLAT-02 | E2E + mutation (last4 only, session default, new tab/context, forget-all cross-tab) | `corepack pnpm --filter web exec playwright test settings-keys routing` | ✅ created W0 (settings-keys.spec.ts) | ✅ green |
| 3-13-01 | 13 | 4 | PLAT-04 | check/lint/banned/ui:guard + build oracle | `corepack pnpm check && corepack pnpm lint && corepack pnpm banned && corepack pnpm ui:guard && corepack pnpm build:root && corepack pnpm csp:assert` | ✅ | ✅ green |
| 3-13-02 | 13 | 4 | PLAT-04, PLAT-05 | E2E + mutation (key-free download with 5 keys, fresh-profile merge, replace confirm, errors) | `corepack pnpm --filter web exec playwright test settings-backup` | ✅ created W0 (settings-backup.spec.ts, helpers/backup-files.ts) | ✅ green |
| 3-14-01 | 14 | 4 | PLAT-05, PLAT-06 | unit (iOS / standalone detection) + check | `corepack pnpm vitest run --project web pwa/detect && corepack pnpm check && corepack pnpm lint && corepack pnpm banned && corepack pnpm ui:guard` | ✅ created W0 (detect.test.ts) | ✅ green |
| 3-14-02 | 14 | 4 | PLAT-05, PLAT-06 | E2E + mutation (persist stubs, install states incl. pre-hydration capture) | `corepack pnpm --filter web exec playwright test settings-storage settings-install csp` | ✅ created W0 (settings-storage.spec.ts, settings-install.spec.ts) | ✅ green |
| 3-12-01 | 12 | 5 | PLAT-02, PLAT-03 | check/lint/banned/ui:guard + build oracle | `corepack pnpm check && corepack pnpm lint && corepack pnpm banned && corepack pnpm ui:guard && corepack pnpm build:root && corepack pnpm csp:assert` | ✅ | ✅ green |
| 3-12-02 | 12 | 5 | PLAT-02, PLAT-03 | E2E + mutation (remember across tabs, raw IDB at rest, locked after reopen, cooldown across reload) | `corepack pnpm --filter web exec playwright test settings-security` | ✅ created W0 (settings-security.spec.ts) | ✅ green |
| 3-15-01 | 15 | 5 | PLAT-03, PLAT-05 | unit (notice selection) + build | `corepack pnpm vitest run --project web app-notice && corepack pnpm check && corepack pnpm lint && corepack pnpm build:root && corepack pnpm csp:assert` | ✅ created W0 (notice-logic.test.ts) | ✅ green |
| 3-15-02 | 15 | 5 | PLAT-05 | E2E + mutation (7-day due, snooze 24 h, download from notice, marketing absent) | `corepack pnpm --filter web exec playwright test app-notice` | ✅ created W0 (app-notice.spec.ts) | ✅ green |
| 3-16-01 | 16 | 6 | PLAT-01..06 | E2E axe matrix (11 states × 2 bases), overlay paint, 375px | `corepack pnpm --filter web exec playwright test settings-a11y a11y` | ✅ created W0 (settings-a11y.spec.ts) | ✅ green |
| 3-16-02 | 16 | 6 | PLAT-01, PLAT-03 | E2E (real-dialog CSP, locked notice) + full suite | `corepack pnpm test:e2e` | ✅ extend csp.spec / created W0 app-notice-locked.spec.ts | ✅ green |
| 3-17-01 | 17 | 7 | PLAT-01..06 | full gate | `corepack pnpm verify` | ✅ | ✅ green |
| 3-17-02 | 17 | 7 | PLAT-01..06 | docs + requirements check | `corepack pnpm lint && corepack pnpm banned` (+ PLAT checkbox node one-liner) | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**03-17 walk (2026-10-05):** every Automated Command above was run on its own, in table order, on a clean tree: 37/37 exited 0 (unit rows 2-30 s; build rows 20-45 s; `3-03-02` and `3-16-02` each ran the full E2E suite, 454 passed / 2 skipped). The composed `corepack pnpm verify` then passed in one invocation (210 s wall: 577 unit tests in 37 files, 14 pages × 2 bases through `csp:assert`, 454 E2E passed / 2 skipped, guard, secrets canary + scan, actionlint).

⚠️ The first `verify` attempt of the session failed 2 of 456 E2E tests under full parallel load: `app-notice.spec.ts` "never-backed-up notice at 8 days on every app page" [root] and `settings-backup.spec.ts` "fresh-profile import with preview" [sub]. Both timed out at the 5 s expect default waiting for the import preview to react to a click (Import backup / Close). Neither reproduced: 140/140 under `--repeat-each 5` for both specs, the second full `verify`, and both full E2E runs in the walk were green. The same symptom was noted once in 03-15. Tracked in `deferred-items.md`.

### Success criteria → proof

| Roadmap success criterion | Proven by |
|---------------------------|-----------|
| 1. Paste RentCast + 4 AI keys, "where your key goes", forget all; session-only by default unless remember | 3-01-01 (hosts ⊆ CSP), 3-04-02, 3-11-02, 3-12-02 (remember) |
| 2. Remember + passphrase lock; after reopen keys unusable until passphrase | 3-07-02 (unit, mutation), 3-12-02 (raw IDB + new page = Locked), 3-16-02 (locked notice) |
| 3. Export verified key-free; import into a fresh profile after preview | 3-02-02, 3-08-01/02, 3-13-02 (5 planted keys, new browser context) |
| 4. Persistent-storage status; "last backup N days ago" reminder when overdue | 3-05-02, 3-14-02, 3-01-02 (boundary), 3-15-02 (clock) |
| 5. Install as PWA, launch standalone; iOS tip | 3-03-01/02, 3-09-02 (offline + manifest), 3-14-02 (install states), HUMAN-UAT (real devices) |

---

## Wave 0 Requirements

- [x] Exact-pinned deps: `zod@4.6.4`, `date-fns@4.4.0` (core); `dexie@4.4.6`, `fake-indexeddb@6.2.5`, `@tran/core` workspace (web) — 03-01; shadcn stack pins — 03-06; `git diff --exit-code pnpm-workspace.yaml` after each
- [x] `apps/web/src/lib/storage/test-utils.ts` (Map-backed Storage, fresh `IDBFactory` per test) and `apps/web/tests/support/fake-keys.ts` (runtime-built planted keys; never gitleaks-matching literals) — 03-01
- [x] `packages/core/src/backup/__fixtures__/backup-v1.json` synthetic golden file (no emails/phones) — 03-02
- [x] `apps/web/tests/e2e/helpers/settings.ts` (openSettings, stubStorage, cspCollector, announcer, saveKey) — 03-10; `helpers/backup-files.ts` — 03-13
- [x] `scripts/serve-pages.mjs` MIME (`.webmanifest`, `.png`); `scripts/assert-csp.mjs` CARRIERS + checkManifest + IHDR checks — 03-03; `service-worker.js` carrier — 03-09
- [x] `scripts/ui-class-guard.mjs` + test, wired into `verify` and CI hygiene (`run:` only) — 03-06

---

## Mutation ledger (filled by 03-17 from the plan SUMMARYs)

Every row was applied by hand, observed failing, and reverted (`git diff` empty, suite green again). Source: the "Mutation proofs" / "Mutation runs" section of each 03-NN-SUMMARY.md. Rows marked *static* are permanent non-vacuity tests that plant the mutation in a fixture on every run.

| # | Plan | Mutation | Test that failed | Reverted |
|---|------|----------|------------------|----------|
| 1 | 03-02 | planMerge `rec.updatedAt > mine.updatedAt` → `>=` (tie rule) | core `diff.test.ts` "equal updatedAt -> unchanged (local wins ties)"; "re-planning the same incoming against the applied result is a no-op (idempotent)" | yes |
| 2 | 03-02 | removed `if (rec.deletedAt !== undefined) continue;` (incoming tombstone with no local record) | core `diff.test.ts` "incoming tombstone with no local record -> skipped entirely" | yes |
| 3 | 03-02 | deleted the gemini `KEY_SHAPES` entry | core `key-scan.test.ts` "flags a planted gemini key by label only"; "results are deduplicated and never echo any planted key"; "KEY_SHAPES is frozen and covers the four LLM providers" | yes |
| 4 | 03-03 | *static:* each CSP carrier dropped, each icon at the wrong IHDR size, manifest faults (absolute URLs, wrong scope/start_url), head-link faults | `scripts/assert-csp.test.ts` oracle mutation cases (one per fault) | n/a (fixture-only) |
| 5 | 03-04 | forgetAll: skip `this.#session.removeItem(SESSION_KEY)` | web `vault.test.ts` "forgetAll > clears session, memory, every tran-secrets key and meta row, and resets the mode"; "forgets in session mode too" | yes |
| 6 | 03-04 | forgetAll: skip `this.#memory.clear()` | the two above + "storage blocked > falls back to session-only when tran-secrets cannot open" | yes |
| 7 | 03-04 | forgetAll: skip `await db.keys.clear()` | "forgetAll > clears session, memory, every tran-secrets key and meta row, and resets the mode" | yes |
| 8 | 03-04 | forgetAll: skip `await db.meta.clear()` | "forgetAll > clears session, memory, every tran-secrets key and meta row, and resets the mode" | yes |
| 9 | 03-04 | forgetAll: skip `this.#post('forget-all')` (broadcast) | "forgetAll > broadcasts forget-all so another tab clears ITS OWN session store and memory"; "ignores its own broadcasts"; "broadcast payloads carry only {type, from}" | yes |
| 10 | 03-04 | receiver of remote `forget-all` skips its own session removeItem | "forgetAll > broadcasts forget-all so another tab clears ITS OWN session store and memory" | yes |
| 11 | 03-07 | AAD ignored (every `aadFor(...)` → `''`) | web `vault-lock.test.ts` "provider-bound ciphertexts (AAD) > swapping two rows makes decryption fail instead of returning the other key"; "never echoes the passphrase, a key or a last4" | yes |
| 12 | 03-07 | IV reuse (`sealBytes` fixed all-zero IV) | "Vault.setPassphrase > uses 12-byte IVs that are all distinct and a 16-byte salt"; "createLock / unwrapDek / rewrap > rewrap uses a new salt and box" | yes |
| 13 | 03-07 | plaintext rows on `setPassphrase` (`{ provider, value }` instead of a sealed box) | 7 tests incl. "Vault.setPassphrase > seals every remembered key at rest: no raw tran-secrets row contains a planted key" | yes |
| 14 | 03-07 | failedAttempts not persisted (memory only) | "5 wrong attempts start a 30 s cooldown that survives a reload, then doubles"; "a wrong passphrase returns wrong and persists failedAttempts = 1" | yes |
| 15 | 03-07 | DEK stash not cleared on `lock()` | "Vault.lock and cross-tab lock > lock clears the DEK stash and memory and broadcasts locked" | yes |
| 16 | 03-07 | receiver of `'locked'` skips its own stash removal | "locking in one tab locks every other open tab (each clears its own stash)" | yes |
| 17 | 03-08 | export also reads `meta` (non-registry table) | web `backup.test.ts` "empty DB valid file"; "table names equal the registry exactly (never meta)"; "exports a newly registered table"; "success downloads once" (4 failed) | yes |
| 18 | 03-08 | key scan skipped (`findKeyMaterial(...).length > 99`) | "a key-shaped value -> key-material"; "an exact known secret (no key shape) -> key-material"; "a known secret that JSON escapes … is still caught"; "planted key never calls download"; "vault value never calls download" (5 failed) | yes |
| 19 | 03-08 | Replace `clear()` moved outside the transaction | "replace: a failure part-way rolls every table back (write-failed)" | yes |
| 20 | 03-09 | removed the `serviceWorker.files` dotfile filter (SW precaches `.nojekyll`) | E2E `pwa.spec.ts` "precache holds only build assets under the base, never dotfiles"; static: `service-worker-guard.test.ts` "svelte.config.js serviceWorker.files dotfile filter" | yes |
| 21 | 03-09 | deleted the SW cross-origin early return | static: `service-worker-guard.test.ts` "non-vacuity: dropping the cross-origin early return is caught" (E2E stays green by defense in depth: the `ASSETS.has` check also skips the route) | yes |
| 22 | 03-11 | skip forget-all broadcast (E2E) | `settings-keys.spec.ts` "Forget all in one tab clears every other open Tran tab" | yes |
| 23 | 03-12 | `setPassphrase` writes plaintext rows (E2E) | `settings-security.spec.ts` "set passphrase validates on submit and encrypts every key at rest" (raw IndexedDB held the planted key) | yes |
| 24 | 03-13 | key scan skipped (E2E "Backup stopped") | `settings-backup.spec.ts` "export refuses a key-bearing pref" | yes |
| 25 | 03-14 | removed the `pwa-capture.js` `<script>` from `app.html` | `settings-install.spec.ts` "installable via a pre-hydration beforeinstallprompt, then appinstalled" (no Install app button) | yes |
| 26 | 03-15 | reminder threshold `n >= days` → `n > days` (effectively `> 7`) | `app-notice.spec.ts` "N days ago after a Settings export" (no notice at exactly 7 days) | yes |
| 27 | 03-15 | `BACKUP_REMINDER_DAYS = 6` (negative-test non-vacuity) | `app-notice.spec.ts` "no notice before 7 days" | yes |
| 28 | 03-16 | alert-dialog overlay `bg-foreground/60` → `bg-transparent` | `settings-a11y.spec.ts` "6. Forget all keys dialog: axe, focus, overlay paint, Escape and confirm focus" | yes |

All 15 required mutation classes from 03-17 Task 1 are covered: tie rule (1), tombstone skip (2), gemini KEY_SHAPE (3), forget-all ×5 (5-9), AAD (11), IV reuse (12), plaintext on setPassphrase (13, 23), failedAttempts (14), DEK stash (15), export reads meta (17), key scan (18, 24), Replace outside transaction (19), SW dotfile filter (20), pwa-capture (25), reminder threshold (26).

------|----------|------------------|----------|
| 03-02 | planMerge `>` → `>=` | — | — |
| 03-02 | remove incoming-tombstone-without-local skip | — | — |
| 03-02 | delete gemini KEY_SHAPE | — | — |
| 03-04 | forgetAll: skip session removeItem / memory clear / keys clear / meta clear / broadcast (5 runs) | — | — |
| 03-07 | ignore AAD; reuse IV; plaintext rows on setPassphrase; failedAttempts not persisted; DEK stash kept on lock | — | — |
| 03-08 | export reads meta / tran-secrets; skip key scan; Replace clear() outside transaction | — | — |
| 03-09 | remove `serviceWorker.files` dotfile filter | — | — |
| 03-11 | skip forget-all broadcast (E2E) | — | — |
| 03-12 | setPassphrase writes plaintext rows (E2E) | — | — |
| 03-13 | skip key scan (E2E "Backup stopped") | — | — |
| 03-14 | remove pwa-capture.js from app.html | — | — |
| 03-15 | reminder threshold `> 7` | — | — |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Install on Android Chrome / desktop Chrome-Edge and launch standalone | PLAT-06 | Headless Chromium never fires a real `beforeinstallprompt` and cannot install | 03-HUMAN-UAT.md items 1-2 (deferred until the `tranrealestate.github.io` origin exists) |
| iPhone / iPad Add to Home Screen and standalone launch | PLAT-06 | Requires real iOS Safari | 03-HUMAN-UAT.md items 3-4 |
| Firefox persistent-storage prompt appears on "Remember on this device" | PLAT-05 | Prompt UI is browser chrome, not page DOM | 03-HUMAN-UAT.md item 5 |
| Safari persistence status / offline launch on a device | PLAT-05, PLAT-06 | WebKit heuristics and real eviction cannot be simulated | 03-HUMAN-UAT.md items 6-7 |
| Firefox session restore of session keys (accepted limitation) | PLAT-02 | Browser session-restore behavior | 03-HUMAN-UAT.md item 8 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 45 s for unit/lint tasks (confirmed during execution)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-05 (03-17: `corepack pnpm verify` green in one invocation, 210 s wall, 577 unit / 454 E2E passed, 2 skipped; every row below walked individually)
