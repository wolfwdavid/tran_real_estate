# Phase 3: Local Platform: Storage, Key Vault & Backup - Research

**Researched:** 2026-10-04
**Domain:** Browser-only persistence (Dexie/IndexedDB), WebCrypto key vault, JSON backup/restore, Storage API, PWA (manifest + SvelteKit service worker) under a meta CSP on a sub-path base, and shadcn-svelte init on Tailwind v4
**Confidence:** HIGH for everything spiked in a throwaway worktree (shadcn init/add, CSP, axe, SW, manifest, Dexie, WebCrypto, blob download, BroadcastChannel). MEDIUM for cross-browser persist() and iOS behaviour (official docs, not device-tested).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

The owner chose fully autonomous mode on 2026-10-04. The researched recommended defaults are adopted.

#### Key vault & storage modes
- **Session-only by default.**
  - Keys live in `sessionStorage`, or in memory mirrored to `sessionStorage`, so they survive a reload but are gone when the browser session ends.
- **"Remember on this device" opt-in.**
  - Keys persist in a separate IndexedDB database (`tran-secrets`), never in the main data DB.
- **Optional passphrase lock.**
  - Uses WebCrypto PBKDF2-SHA256 (≥600k iterations, random 16-byte salt) to derive an AES-GCM-256 key; each record gets a random 12-byte IV.
  - After reopen, keys stay unusable until the passphrase is entered.
  - The copy labels this as protection at rest only, not protection against XSS.
- **Providers:** RentCast, Anthropic, OpenAI, Gemini, OpenRouter.
- **Never leak keys.** Keys never appear in URLs, logs, error messages, analytics, or backups. The Gemini key must be sent in a header, never `?key=`. This is enforced by Phase 5 and asserted here as a contract.
- **Forget all keys** is one action that clears session, remember, and passphrase stores and broadcasts the change to other tabs via `BroadcastChannel`.
- **Key UI:**
  - Each key field is masked, with show/hide and paste.
  - Each provider has a "where your key goes" explainer: this key is sent only from your browser directly to `<provider host>`.
  - Advice to use dedicated, endpoint-restricted, spend-limited keys.

#### Data layer & backup
- **Dexie 4** (or the latest stable) holds the main DB.
- **Every record is `Syncable`:** `id` UUID, `ownerId: 'local'`, `createdAt`/`updatedAt`, `deletedAt` tombstone, `schemaVersion`. Records are sync-ready for v2.
- **Pure logic lives in DOM-free `packages/core`:** backup schemas (Zod mini), migrations, and the diff/merge preview.
- **Export** is a versioned JSON file (`tran-backup-v1`).
  - Before download, a key-free guarantee scans the payload for anything shaped like a key, or matching the vault's actual values, and refuses if found.
- **Import** runs a dry-run preview showing counts of what will be added, changed, or replaced.
  - The user chooses Merge (newer `updatedAt` wins) or Replace.
  - Migrations run on older schema versions; invalid files are rejected with a plain-language error.
- **Persistence and backup reminders:**
  - The app calls `navigator.storage.persist()` on first meaningful save and on demand from Settings. Settings shows "Persistent storage: granted/not granted" with an explanation.
  - A "Last backup N days ago" reminder appears once a backup is overdue (default 7 days, matching the Safari eviction window), shown as a non-blocking app banner.

#### PWA
- **Install files:** `manifest.webmanifest` plus self-hosted icons, generated from brand tokens (simple text-mark icon; no SVG logo in v1).
- **Service worker** uses SvelteKit's `src/service-worker` with an app-shell cache-first strategy for build assets and prerendered pages.
  - It never caches API responses, which belong to Phase 4's IndexedDB cache, and never touches requests carrying keys.
  - It must be compatible with the meta CSP (served from `'self'`) and the sub-path base.
- **Install affordance:** an "Install app" button on browsers that fire `beforeinstallprompt`, and an Add-to-Home-Screen tip on iOS Safari (detected).

#### Settings UX
- **One Settings page** (`/settings/`) with sections: API keys, Security (remember/passphrase), Backup & restore, Storage status, Install app.
- **Destructive actions** (forget keys, replace import) use an accessible confirmation step, not `window.confirm`.
- **Every state is announced** (saved, locked, unlocked, forgotten, import done) via a polite live region.

### Claude's Discretion
- Exact Dexie table layout for future phases (define the base and repo pattern only; portal tables arrive with their phases).
- The PBKDF2 iteration count (≥600k).
- The rate-limit on passphrase attempts.
- The backup filename format.
- The service-worker cache naming and versioning.

### Deferred Ideas (OUT OF SCOPE)
- Cross-device sync and accounts (PLAT-V2-01).
- Biometric/WebAuthn unlock (post-v1).

**Also locked (approved 03-UI-SPEC.md, treat as contract):** shadcn-svelte 1.6.1 init in `apps/web` with Phase 2 tokens as the only color source, the 9-component inventory (button, input, label, alert-dialog, dialog, radio-group, checkbox, badge, alert), the feature-component contracts, all copy strings, the passphrase rate limit (5 attempts, then 30s doubling to a 300s cap, persisted), a 12-character passphrase minimum, a 25 MB import limit, the filename `tran-backup-YYYY-MM-DD.json`, the PWA manifest fields and icon set, and the `csp-transition-toggle` fixture rule.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAT-01 | User can paste, test, and forget a RentCast key and AI provider keys (Anthropic, OpenAI, Gemini, OpenRouter), with a plain-language "where your key goes" explanation | Vault API + `registerKeyTester` hook (Pattern 4); forget-all across 3 stores + `BroadcastChannel` (verified cross-tab in Chromium); provider-host ⊆ CSP `connect-src` unit test; shadcn components verified CSP/axe-clean (Pattern 1) |
| PLAT-02 | Keys are kept for the browser session only by default; user can opt into "remember on this device" | `sessionStorage` per-tab semantics verified (a new tab gets `null`); `tran-secrets` Dexie DB for remember mode; Pitfall 6 (Firefox restores sessionStorage on reopen-closed-tab) |
| PLAT-03 | User can lock remembered keys behind a passphrase | PBKDF2-SHA256 600k + AES-GCM-256 with AAD binding, verifier record, persisted cooldown (Pattern 4); wrong passphrase and wrong-AAD both reject (verified); 600k PBKDF2 = 152 ms in Node 24, so the UI's "Unlocking…" state is needed on mobile |
| PLAT-04 | User can export all app data (never keys) to a JSON file and import it back after previewing what will change | `tran-backup-v1` envelope + zod/mini schema (API verified), migration registry, diff/merge algorithm (Pattern 5); key-free scanner; `<a download>` blob URL needs no CSP change (verified: download fires, 0 violations); file read via `File.text()` (verified); single Dexie transaction rollback (verified) |
| PLAT-05 | User can see whether the browser granted persistent storage and receives a "last backup N days ago" reminder | `persist()`/`persisted()`/`estimate()` semantics per browser (Pattern 6); Firefox needs user activation; headless Chromium returns `false` (verified), so E2E stubs it; pure `backupReminderDue()` in core |
| PLAT-06 | User can install the app to their home screen or desktop as a progressive web app | Static `manifest.webmanifest` with **relative** `start_url`/`scope`/`id`/icons works on both bases (verified via CDP `Page.getAppManifest`, 0 errors, 0 installability errors); Kit SW registers on both bases, precaches 38 assets, works offline, leaves 404s and `page.route` mocks intact (verified); icons generated with Playwright + Fraunces (verified) |
</phase_requirements>

## Summary

Every risky integration was run in a throwaway git worktree of this repo (removed afterwards). The worktree had shadcn-svelte 1.6.1 init plus the 9 components, a SvelteKit service worker, a static manifest with icons, Dexie 4.4.6 + fake-indexeddb 6.2.5, and WebCrypto. Both builds (`/` and `/tran_real_estate/`) passed `assert-csp.mjs`. The **entire existing Phase 1 E2E suite stayed green with the service worker active** (34/34 including spike specs). Dialogs, alert-dialogs, radio groups and checkboxes produced **zero CSP violations and zero axe violations**. bits-ui's scroll lock writes `document.body.style` through CSSOM, which CSP does not govern, and no `<style>` element is injected.

The biggest surprise is that **shadcn-svelte 1.6.1's `init` is not the classic init the UI-SPEC assumed.** It is preset-driven:
- **Non-interactive init needs `--preset <code>`.** Without it the CLI prompts; the code for vega/stone is `bJ36uES`. It also stops at a "CSS will be overwritten" confirm prompt.
- **It rewrites `app.css`.** It adds `@import "tw-animate-css"`, `@import "shadcn-svelte/tailwind.css"` (which defines the `data-open:`/`data-checked:` variants the components need), an Inter font import, `@custom-variant dark`, `--color-*: var(--…)` mappings, and `--radius-*: calc(var(--radius)…)` overrides that would **overwrite Phase 2's color and radius tokens**.
- **It writes caret ranges for the latest packages:** `shadcn-svelte ^1.7.0`, `bits-ui ^2.18.0` (2.19.5 got installed), `@lucide/svelte ^1.52.0`, and a new `cn` package in place of `clsx`/`tailwind-merge`. Installing `@lucide/svelte@1.52.0` made pnpm 11 **write a `minimumReleaseAgeExclude` entry into `pnpm-workspace.yaml`** (reproduced, same as Phase 2 Pitfall 8).
- **Generated sources fail `prettier --check` (51 files) and ESLint** (`svelte/no-navigation-without-resolve` in `button.svelte`). They also contain many `dark:` and `ring-ring/50` classes.

The fix is a deterministic procedure: save `app.css`, run init/add with `--no-deps-install`, restore `app.css` and add exactly one import, re-pin `package.json`, replace `cn` with `clsx` + `tailwind-merge`, run `prettier --write`, then reconcile the sources (Pattern 1).

The service worker works with **no CSP change**. Kit's registration lives inside the hashed boot script and uses a relative URL (`../service-worker.js`). Scope resolves to `{base}/` on both bases. The worker must deviate from Kit's docs example in three ways:
1. **Never call `respondWith` for cross-origin requests or for anything outside the precache list.** The docs example caches every 200 response, which would cache API responses and touch requests carrying keys.
2. **Filter `.nojekyll` out of `$service-worker.files`** with `kit.serviceWorker.files`, because `cache.addAll` is all-or-nothing.
3. **Add a scoped ESLint override**, because the Phase 1 fetch ban flags the worker's `fetch(req)`.

With that shape, Playwright `page.route()` mocks of provider hosts still intercept while the SW controls the page (verified). That matters for Phases 4 and 5.

**Primary recommendation:** Build Phase 3 as five layers, each with its own tests.
1. **Pure core:** backup envelope, migrations, diff/merge, key-shape scanner, reminder math. Unit-tested in `packages/core`.
2. **Storage:** a lazy `getDb()` Dexie singleton, `Syncable` repos, and a backup registry.
3. **Vault:** `lib/storage/secrets/`, with injected `Storage`/IDB/crypto so it unit-tests under fake-indexeddb.
4. **PWA:** a static manifest with relative URLs, an allowlist-only SW, a head-loaded `pwa-capture.js`, and committed icons.
5. **UI:** shadcn init via the reconciliation procedure, then the Settings sections.

Run the UI plans **after Phase 2's token and layout plans land**. The non-UI plans can run any time.

## Standard Stack

### Core (versions verified on npm 2026-10-04; pin EXACTLY, repo convention)
| Library | Pin | Published | Purpose | Notes |
|---------|-----|-----------|---------|-------|
| `dexie` | **4.4.6** | 2026-09-10 | IndexedDB wrapper: `tran` main DB, `tran-secrets` vault DB, transactions, `liveQuery` | Construction is safe without IndexedDB (verified: `new Dexie()` OK in Node; first query throws `MissingAPIError`). Still open it lazily. |
| `zod` | **4.6.4** | 2026-09-13 | Backup envelope/record validation (`import * as z from 'zod/mini'`) | Verified API: `z.object`, `z.literal`, `z.optional`, `z.iso.datetime()`, `z.string().check(z.uuid())`, `z.looseObject`, `z.record`, `.safeParse`, `z.prettifyError`. 4.6.5 exists (same day); stay on the UI-SPEC pin. Goes in `packages/core` **dependencies**. |
| `date-fns` | **4.4.0** | 2026-05-29 | `differenceInCalendarDays` for "N days ago" and reminder math | In `packages/core` (pure). |
| `runed` | **0.37.1** | 2025-12-20 | Optional `PersistedState` for tiny prefs | Recommendation below is the Dexie `meta` table instead, so runed may be unnecessary in Phase 3. bits-ui 2.19.2 depends on `runed ^0.35.1`, so a second copy lands either way. |
| `bits-ui` | **2.19.2** | 2026-09-09 | Primitives under shadcn components | Latest is 2.19.5 (2026-10-03). The CLI writes `^2.18.0`, which resolves to 2.19.5. **Re-pin to 2.19.2.** Peer `@internationalized/date`. |
| `@internationalized/date` | **3.12.4** | 2026-09-01 | bits-ui peer | Ignore nightly tags. |
| `shadcn-svelte` | **1.6.1** | 2026-09-04 | **Becomes a devDependency**: `app.css` imports `shadcn-svelte/tailwind.css` (custom variants `data-open`, `data-closed`, `data-checked`, `data-disabled`, …) | The CLI writes `^1.7.0` (1.7.0 is from 2026-09-16). Re-pin to 1.6.1 so the CSS matches the CLI that generated the components. The package exports `./tailwind.css` with a `style` condition (verified). |
| `tailwind-variants` | **3.3.1** | 2026-08-03 | `tv()` in button/badge/alert | Peer `tailwind-merge >=3.0.0`. |
| `tailwind-merge` | **3.7.0** | 2026-09-12 | Class merging inside `cn()` and as a `tailwind-variants` peer | Replaces the `cn` npm package (see Alternatives). |
| `clsx` | **2.1.1** | 2024-04-23 | Conditional classes in `cn()` | Listed in the UI-SPEC registry. |
| `tw-animate-css` | **1.4.0** | 2025-09-24 | `animate-in`/`fade-in-0`/`zoom-in-95` used by dialog sources | Keep it only with every usage prefixed `motion-safe:` (UI-SPEC rule). |
| `@lucide/svelte` | **1.45.0** | 2026-09-11 | Icons | **Phase 2 pins this.** The CLI writes `^1.52.0`. Revert. All icons the UI-SPEC and generated components need exist in 1.45.0 (verified: loader-circle, clipboard-paste, eye, eye-off, key-round, circle-check, circle-alert, hard-drive, lock, shield-check, download, upload, monitor-down, share, hard-drive-download, external-link, check, x, circle, minus). |

### Supporting (dev)
| Library | Pin | Purpose |
|---------|-----|---------|
| `fake-indexeddb` | **6.2.5** | Vitest: `new IDBFactory()` per test (from `fake-indexeddb`) passed to `new Dexie(name, { indexedDB, IDBKeyRange })`. Blobs and non-extractable `CryptoKey`s round-trip (verified). |
| `@playwright/test` (existing 1.63.0) | n/a | Also used by the **icon generator script** (no new dependency) |
| `@fontsource-variable/fraunces` (Phase 2, 5.3.0) | n/a | Source font for the icon "T" (`files/fraunces-latin-wght-normal.woff2`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `clsx` + `tailwind-merge` in `$lib/utils.ts` | The `cn` npm package that 1.6.1 init writes | `cn@0.4.0` is a **repurposed npm name**: versions 0.1.x date from 2013, then shadcn published 0.2.0-0.4.0 between 2026-09-01 and 2026-09-22, nine releases in three weeks. It is a compiled drop-in, but on an origin that holds API keys, two long-established packages beat a three-week-old one. `tailwind-merge` is needed anyway as the `tailwind-variants` peer. |
| Static `static/manifest.webmanifest` with relative URLs | A prerendered `+server.ts` manifest endpoint using `base` | The endpoint must be crawled (`handleUnseenRoutes: 'fail'`) and adds a route. Relative URLs resolve against the manifest URL, so one static file is correct on both bases (verified: start/scope = `http://127.0.0.1:4384/tran_real_estate/`). |
| Playwright-rendered icon PNGs | `@resvg/resvg-js` / `sharp` | Both are new native dependencies. resvg needs TTF/OTF, and Fontsource ships woff2 only. Playwright is already installed and renders the real self-hosted Fraunces (verified, see Code Examples). |
| Dexie `meta` table for `lastBackupAt`/snooze | runed `PersistedState` (localStorage) | Same eviction fate either way on Safari. Dexie keeps the reminder state with the data it describes: if IndexedDB is wiped, "Last backup: Never" is then *true*. One storage system, testable under fake-indexeddb. |
| Kit automatic SW registration | Manual `navigator.serviceWorker.register` in the root layout (`serviceWorker.register: false`) | Automatic registration is already inside the hashed inline boot script with the correct relative URL on every page, including the `404.html` fallback (absolute `/tran_real_estate/service-worker.js`). Manual registration needs base-path handling and duplicates Kit. CONTEXT's "registers in the root layout" is satisfied by Kit's root-level boot. |

**Installation (exact pins; run from repo root with corepack):**
```bash
corepack pnpm --filter @tran/core add zod@4.6.4 date-fns@4.4.0
corepack pnpm --filter web add -D dexie@4.4.6 fake-indexeddb@6.2.5 bits-ui@2.19.2 @internationalized/date@3.12.4 shadcn-svelte@1.6.1 tailwind-variants@3.3.1 tailwind-merge@3.7.0 clsx@2.1.1 tw-animate-css@1.4.0 "@tran/core@workspace:*"
# @lucide/svelte@1.45.0 comes from Phase 2. If Phase 2 hasn't landed: add it with the same exact pin.
git diff --exit-code pnpm-workspace.yaml   # must be empty (minimumReleaseAge guard)
```
Note: `apps/web` keeps everything in `devDependencies` (repo convention: static site, nothing ships from node_modules at runtime except bundled code). Check whether `@tran/core` is already a web dependency; Phase 1 tests import it by path in places.

## Architecture Patterns

### Recommended file layout
```
packages/core/src/
├── syncable.ts                 # Syncable type + zod/mini SyncableSchema, newSyncable(), touch(), tombstone()
├── backup/
│   ├── envelope.ts             # BACKUP_FORMAT='tran-backup-v1', BACKUP_SCHEMA_VERSION, EnvelopeSchema, parseBackup()
│   ├── migrations.ts           # migrations: Record<number, (tables) => tables>, migrateEnvelope()
│   ├── diff.ts                 # planMerge(), planReplace() → per-table counts + write sets
│   ├── key-scan.ts             # KEY_SHAPES, findKeyMaterial(json, knownSecrets) → provider ids only
│   ├── errors.ts               # BackupError codes: not-json | not-tran | invalid | newer | too-large
│   └── *.test.ts
├── providers.ts                # PROVIDERS (id, label, host, keyUrl) - single source for vault, cards, CSP test
├── reminder.ts                 # backupReminderDue(), daysSince() (date-fns)
└── index.ts                    # re-exports
apps/web/src/
├── service-worker.ts           # allowlist cache-first, cross-origin untouched (Pattern 7)
├── lib/
│   ├── storage/
│   │   ├── db.ts               # getDb() lazy singleton (browser only), TranDb schema versions, StorageBlockedError
│   │   ├── repo.ts             # createRepo<T extends Syncable>(table) → get/list/put/remove(tombstone)
│   │   ├── meta.ts             # lastBackupAt, backupReminderSnoozedUntil (not exported)
│   │   ├── backup-registry.ts  # registerBackupTable({name,label,include}); Phase 4+ register theirs
│   │   ├── backup.ts           # exportBackup(), previewImport(file), applyImport(plan) (one transaction)
│   │   ├── persistence.ts      # requestPersistence(), persistenceStatus(), storageEstimate()
│   │   ├── live.svelte.ts      # live(query, initial) runes helper over Dexie liveQuery
│   │   └── secrets/
│   │       ├── crypto.ts       # deriveKey/seal/open (WebCrypto), ITERATIONS
│   │       ├── vault.svelte.ts # Vault class: modes, lock/unlock, forgetAll, onChange, reactive status
│   │       ├── channel.ts      # BroadcastChannel('tran-vault') messages (never carry key material)
│   │       └── testers.ts      # registerKeyTester(provider, fn) (Phase 4/5 plug in)
│   ├── pwa/install.svelte.ts   # install state: deferred prompt, iOS detection, standalone detection
│   ├── components/
│   │   ├── ui/…                # shadcn copy-ins (reconciled)
│   │   └── a11y/LiveAnnouncer.svelte + announcer.svelte.ts
│   └── features/shared/settings/   # ProviderKeyCard, KeyStorageMode, PassphraseLock, PassphraseDialog,
│                                   # ConfirmDialog, BackupExport, BackupImport, ImportPreview,
│                                   # StorageStatus, InstallApp, AppNotice, StorageBlockedAlert, SectionError
├── routes/(app)/settings/+page.svelte
static/
├── manifest.webmanifest        # relative URLs (Pattern 7)
├── pwa-capture.js              # head script: captures beforeinstallprompt before hydration
└── icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon-180}.png
apps/web/scripts/generate-icons.mjs   # Playwright renders the Fraunces "T" (run manually, commit the PNGs)
```
Put the vault under `lib/storage/secrets/`, **not** `lib/security/`. The existing ESLint marketing ban covers `$lib/storage/**` but not `$lib/security/**`, so this placement makes "marketing never imports the vault" lint-enforced for free.

### Pattern 1: shadcn-svelte 1.6.1 init + add, reconciled (VERIFIED end-to-end in a worktree)
**What:** A deterministic, non-interactive procedure that ends with Phase 2's `app.css` intact plus one import line.

```bash
cd apps/web
cp src/app.css ../../.tmp-app.css.bak          # 1. protect Phase 2 tokens (outside src/ so nothing scans it)
# 2. init: --preset is REQUIRED for non-interactive use; bJ36uES = style vega (classic look),
#    baseColor stone, theme stone, iconLibrary lucide, font inter, radius default.
#    The CLI still asks "Updates to your src/app.css are required… Continue?" (default Yes):
#    on CI-less local runs answer Enter; scripted: feed "\r\n" after the registry fetch.
corepack pnpm dlx shadcn-svelte@1.6.1 init --preset bJ36uES --css src/app.css \
  --lib-alias '$lib' --components-alias '$lib/components' --utils-alias '$lib/utils' \
  --hooks-alias '$lib/hooks' --ui-alias '$lib/components/ui' --no-deps-install
corepack pnpm dlx shadcn-svelte@1.6.1 add button input label alert-dialog dialog radio-group \
  checkbox badge alert --yes --no-deps-install
cp ../../.tmp-app.css.bak src/app.css && rm ../../.tmp-app.css.bak   # 3. restore Phase 2 CSS
```
Then make these edits by hand:
4. **`app.css`:** after `@import 'tailwindcss';` add `@import 'shadcn-svelte/tailwind.css';` (the generated components use its `data-open:`/`data-closed:`/`data-checked:` variants, verified in source). Add `@import 'tw-animate-css';` only if it is kept per the UI-SPEC. Add the 8 **alias tokens** from the UI-SPEC to `@theme` and to `@tran/brand` (parity test). Do **not** add init's Inter import (Phase 2 imports fonts in the root layout), `@custom-variant dark`, `:root{oklch…}`, `.dark{…}`, the `--color-*: var(--*)` mapping, the `--radius-*: calc(var(--radius)…)` overrides, or the `@layer base { * { @apply border-border outline-ring/50 } }` rule.
5. **`package.json`:** delete the caret entries the CLI wrote (`@fontsource-variable/inter ^5.3.0`, `@lucide/svelte ^1.52.0`, `bits-ui ^2.18.0`, `cn ^0.4.0`, `shadcn-svelte ^1.7.0`, `tailwind-variants ^3.3.1`, `tw-animate-css ^1.4.0`, `@internationalized/date ^3.12.0`) and install the exact pins from the Standard Stack. Run `git diff --exit-code pnpm-workspace.yaml`.
6. **`src/lib/utils.ts`:** replace `export { cn } from "cn";` with the classic `clsx` + `tailwind-merge` `cn()` (Code Examples). Keep the `WithoutChild*`/`WithElementRef` types.
7. **`components.json`:** keep it as written (`style: "vega"`, `registry: https://shadcn-svelte.com/registry`, `tailwind.css: src/app.css`). Future `add` calls in Phases 4-9 must repeat steps 1-3 and 5, because `add` can also touch CSS for components that carry `cssVars`.
8. **`corepack pnpm format`** (51 generated files fail `prettier --check`: double quotes, spaces), then reconcile the sources per UI-SPEC init contract step 4. Concretely, the generated code contains:
   - `button.svelte`: sizes `h-9`/`size-9`/`xs`/`sm`/`lg`/`icon-xs`/`icon-sm`/`icon-lg`. Keep `default` (→ `h-12`), `icon` (→ `size-11`) and **delete the rest**. `dialog-content.svelte` uses `size="icon-sm"` for its close button, so change it to `icon`. The `destructive` variant is a **tinted** fill (`bg-destructive/10 text-destructive`); the UI-SPEC wants a solid fill plus a new `destructive-outline`. `focus-visible:ring-3 ring-ring/50`, `aria-invalid:ring-*` and many `dark:*` classes are present. The `href` branch fails ESLint `svelte/no-navigation-without-resolve`: delete it (no Phase 3 button navigates; inline links are `<a>`) or add a justified `eslint-disable-next-line`.
   - `dialog-overlay`/`alert-dialog-overlay`: `bg-black/10 supports-backdrop-filter:backdrop-blur-xs`. `--color-black` is reset by `--color-*: initial`, so it would render **nothing**. Use `bg-foreground/60`.
   - `dialog-content`/`alert-dialog-content`: `rounded-xl`, `ring-1 ring-foreground/10`, `max-w-xs`/`sm:max-w-lg`, `data-open:animate-in … zoom-in-95`. Map these to `--radius-lg`, `--shadow-card-hover`, `max-w-[30rem]`, and wrap the animations with `motion-safe:`.
   - `radio-group-item`/`checkbox`: `size-4` with `after:-inset-*` hit-area tricks. The UI-SPEC wants 20px glyphs and a 44px `<label>` row target.
   - `input`: `h-9 md:text-sm`. Use `h-12 text-base`, a `border-input` (alias = border-strong) border, and the `card` fill.
9. Add the UI-SPEC class-guard check (fail on `bg-secondary`, `bg-black`, `dark:`, `ring-ring/` under `src/lib/components/ui/`).

**Verified behaviour after `add` (worktree, both bases):**
- **CSP:** opening and closing the AlertDialog and Dialog and toggling radio and checkbox gave `securitypolicyviolation` = `[]`. bits-ui's body scroll lock wrote `overflow: hidden; pointer-events: none;` via CSSOM `style.setProperty` (not governed by CSP), and **0 `<style>` elements** were added. The only `createElement('style')` in bits-ui 2.19 is in `pin-input` (unused).
- **Axe:** WCAG A/AA violations = `[]` with each dialog open.
- **Focus:** Dialog put initial focus on the first input (UI-SPEC ✓). AlertDialog focused the **content element**, not Cancel. Use `onOpenAutoFocus={(e) => { e.preventDefault(); cancelEl?.focus(); }}` (prop exists in bits-ui 2.19.2 `focus-scope/types.d.ts`). Escape closed both, and focus returned to the trigger (UI-SPEC ✓).
- **While a confirm action runs:** `escapeKeydownBehavior="ignore"` and `interactOutsideBehavior="ignore"` exist on the content props.
- **svelte-check:** 0 errors, 0 warnings over 993 files after add.

### Pattern 2: Dexie in a prerendered app (lazy singleton + Syncable repos + registry)
**What:** Never touch IndexedDB at module scope. Every route prerenders in Node, and marketing routes must not even load Dexie.
```ts
// apps/web/src/lib/storage/db.ts
import Dexie, { type EntityTable } from 'dexie';
import type { Syncable } from '@tran/core';

export interface MetaRow { key: string; value: unknown }
export interface PrefRecord extends Syncable { key: string; value: unknown }

export type TranDb = Dexie & {
	meta: EntityTable<MetaRow, 'key'>;          // local-only: lastBackupAt, snooze, firstRecordAt. NEVER exported.
	prefs: EntityTable<PrefRecord, 'id'>;       // exported (registered in backup)
};

/** Version history is append-only. Later phases add db.version(n+1).stores({...}) here. */
export function defineSchema(db: Dexie) {
	db.version(1).stores({ meta: 'key', prefs: 'id, key, updatedAt' });
}

let instance: TranDb | undefined;
export function getDb(options?: { indexedDB?: IDBFactory; IDBKeyRange?: typeof IDBKeyRange }): TranDb {
	if (!instance) {
		instance = new Dexie('tran', options) as TranDb;
		defineSchema(instance);
	}
	return instance;
}
/** Tests only: reset between cases. */
export function _resetDb() { instance?.close(); instance = undefined; }
```
- **Call `getDb()` only from `onMount`/event handlers or modules imported by `(app)` routes.** Detect blocked storage with `await getDb().open()` in a try/catch (`SecurityError`, `UnknownError`, `InvalidStateError`) → `StorageBlockedAlert`. Firefox and Safari private modes support IndexedDB today, so "blocked" means site data blocked by the user or policy.
- **Repos:** `put()` sets `updatedAt = new Date().toISOString()`, and `remove()` sets `deletedAt` (a tombstone). `list()` filters `deletedAt === undefined` by default. IDs come from `crypto.randomUUID()`. ISO-8601 UTC strings from `toISOString()` compare correctly as strings (same length and format), which the merge relies on.
- **Phase 3 tables:** `meta` (local-only) and `prefs` (exported). Register `prefs` in the backup registry so export/import has a real table to diff in E2E. Phase 4 registers `ledger`/`savedSearches` (included) and `apiCache` (excluded), per 04-CONTEXT.
- **Migration discipline:** Dexie keeps old `version()` declarations plus `.upgrade(tx => …)` (verified: v1→v2 upgrade with `modify()` worked under fake-indexeddb). Every upgrade also bumps the record's `schemaVersion`. The backup schema version (Pattern 5) is a **separate** constant in core.

### Pattern 3: `liveQuery` → Svelte 5 runes
```ts
// apps/web/src/lib/storage/live.svelte.ts
import { liveQuery } from 'dexie';
import { createSubscriber } from 'svelte/reactivity';

/** Reactive view of a Dexie liveQuery; subscribes only while read inside an effect/template. */
export function live<T>(query: () => Promise<T>, initial: T) {
	let value = initial;
	let error: unknown;
	const subscribe = createSubscriber((update) => {
		const sub = liveQuery(query).subscribe({
			next: (v) => { value = v; update(); },
			error: (e) => { error = e; update(); }
		});
		return () => sub.unsubscribe();
	});
	return {
		get current() { subscribe(); return value; },
		get error() { subscribe(); return error; }
	};
}
```
`liveQuery` itself is verified under fake-indexeddb: it emitted `[1, 2]` across an insert. The runes wrapper could **not** be unit-tested in the current Vitest `web` project. That project runs `environment: 'node'`, so vite-plugin-svelte compiles `.svelte.ts` for the server and `$effect` never runs (seen = `[]` even with `resolve.conditions: ['browser']` and `ssr.resolve.conditions`). Keep the helper this thin and prove it through E2E (the Settings "Last backup" line updates after an import without a reload). Do not add jsdom or happy-dom just for this. The query closure must read reactive inputs *synchronously* and be re-created when they change (`$derived(live(() => repo.list(filter), []))` pattern), because `liveQuery` runs the query outside Svelte's tracking.

### Pattern 4: The key vault (three stores, one API)
**Stores:**
| Store | Where | Contents | Cleared by |
|---|---|---|---|
| Session | `sessionStorage['tran.vault.session.v1']` + module `Map` mirror | `{ [provider]: key }` plaintext. Also receives **decrypted** keys after unlock, so a reload stays unlocked and closing the tab relocks (matches the copy "unlocked until you close this tab or lock them"). | forgetAll, lock, tab close, mode change to session (no-op) |
| Remember | IndexedDB `tran-secrets` → `keys: 'provider'` | `{ provider, value }` plaintext when there is no lock, or `{ provider, box: { iv, ct } }` when locked. **`last4` is NOT stored outside the box** (UI-SPEC: no last4 while locked). | forgetAll, mode → session, removeKey |
| Passphrase meta | `tran-secrets` → `meta: 'id'` row `vault` | `{ kdf: 'PBKDF2-SHA256', iterations: 600000, salt(16B), check: {iv, ct}, failedAttempts, cooldownUntil, v: 1 }` | forgetAll, removePassphrase |

**Crypto (verified in Node 24 WebCrypto; same API in browsers):**
- `deriveKey`: PBKDF2-SHA256 with **600,000 iterations** (OWASP's current PBKDF2-HMAC-SHA256 figure; the CONTEXT minimum) and a random 16-byte salt per vault, producing a **non-extractable** AES-GCM-256 key held only in memory.
- `seal`: a fresh random 12-byte IV per encryption. **AAD = `tran-vault:v1:<provider>`** binds each ciphertext to its provider. Verified: decrypting with the right key but another provider's AAD throws, so records can't be swapped.
- **Verifier:** `check = seal(key, 'tran-vault-check', 'tran-vault:v1:check')`. Unlock = derive, then open the verifier. A wrong passphrase throws `OperationError` (verified). Only then decrypt the keys.
- **Store `iterations` in the record** so a future bump re-wraps on the next successful unlock.
- **Timing:** 152 ms for 600k in Node 24 on this machine. Expect about 0.3-1.5 s on phones, which is why the UI-SPEC's "Unlocking…" state exists. Never lower iterations in production code. Tests inject a low count except one test that asserts the production constant and the stored `iterations === 600000`.
- **Passphrase input:** `passphrase.normalize('NFC')` before encoding, so the same passphrase typed on different keyboards derives the same key.

**Rate limit (UI-SPEC):** on a wrong passphrase, increment `failedAttempts` and **persist it in the same `tran-secrets` transaction**. At 5 or more failures, set `cooldownUntil = now + min(30s × 2^(failed−5), 300s)`. A success resets both. Be honest in code comments: someone with disk access can reset the counter, so the PBKDF2 cost is the real brute-force defense and the cooldown is UX.

**API (contract for Phases 4/5):**
```ts
export type ProviderId = 'rentcast' | 'anthropic' | 'openai' | 'gemini' | 'openrouter';
export type KeyState = 'none' | 'session' | 'remembered' | 'locked';
export interface VaultStatus {
	mode: 'session' | 'remember';
	hasLock: boolean; locked: boolean;
	cooldownUntil: number | null;
	providers: Record<ProviderId, { state: KeyState; last4?: string }>;   // last4 only when readable
}
export interface Vault {
	readonly status: VaultStatus;                         // $state-backed, reactive in components
	getKey(p: ProviderId): Promise<string | undefined>;   // undefined when absent OR locked
	setKey(p: ProviderId, key: string): Promise<void>;    // trims; rejects internal whitespace
	removeKey(p: ProviderId): Promise<void>;
	forgetAll(): Promise<void>;                           // session + memory + tran-secrets (keys+meta) + broadcast
	setMode(m: 'session' | 'remember'): Promise<void>;    // migrates keys between stores
	setPassphrase(pass: string): Promise<void>;           // encrypt remembered keys in place (1 transaction)
	changePassphrase(current: string, next: string): Promise<'ok' | 'wrong'>;
	removePassphrase(): Promise<void>;                    // requires unlocked; writes plaintext back
	lock(): Promise<void>;
	unlock(pass: string): Promise<'ok' | 'wrong' | { cooldownUntil: number }>;
	onChange(cb: (e: VaultEvent) => void): () => void;    // events carry provider ids/kinds only
	knownSecrets(): string[];                             // for the export key-scan ONLY; never logged
}
export function registerKeyTester(p: ProviderId, fn: (key: string, signal: AbortSignal) => Promise<KeyTestResult>): void;
```
- Build the vault as a class with injected dependencies (`storage: Pick<Storage,'getItem'|'setItem'|'removeItem'>`, `openSecretsDb: () => Dexie`, `channel: BroadcastChannel-like`, `iterations`, `now`). Node 24 has **no** global `sessionStorage`/`localStorage` without a flag (verified `typeof sessionStorage === 'undefined'`), so tests pass a `Map`-backed fake. `BroadcastChannel` and `crypto.subtle` **are** Node 24 globals.
- **Cross-tab:** one `BroadcastChannel('tran-vault')`. Messages are `{ type: 'forget-all' | 'locked' | 'mode-changed' | 'keys-changed', from: tabId }`. **Never a key or last4.** A receiver clears its own `sessionStorage` entry and memory on `forget-all`/`locked`, re-reads `tran-secrets` on the others, and announces per the UI-SPEC cross-tab strings. Verified in Chromium: tab 2 received `{type:'forget-all'}`. `sessionStorage` is per tab (tab 2 read `null`), so **each tab must clear itself**. That is exactly why the broadcast is required.
- **Clear `tran-secrets` by clearing tables inside one rw transaction**, not `Dexie.delete()`. Deleting a DB that another tab holds open raises `versionchange`/blocked events. Clearing tables needs no coordination.
- **Persist and the vault:** setting the mode to remember is a "meaningful save". Call `requestPersistence()` synchronously inside that click handler (Pattern 6).
- **No logging:** add `no-console: 'error'` for `apps/web/src/lib/storage/secrets/**` in `eslint.config.js`, and errors thrown from the vault use fixed messages (`'vault-locked'`, `'wrong-passphrase'`) with no interpolation.

### Pattern 5: Backup (envelope, migrations, diff/merge, key-free guarantee)
**Envelope (`packages/core/src/backup/envelope.ts`):**
```ts
import * as z from 'zod/mini';
export const BACKUP_FORMAT = 'tran-backup-v1';
export const BACKUP_SCHEMA_VERSION = 1;           // bump with a migrations[n] entry when a registered record shape changes
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

export const SyncableSchema = z.looseObject({
	id: z.string().check(z.uuid()),
	ownerId: z.literal('local'),
	createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
	deletedAt: z.optional(z.iso.datetime()),
	schemaVersion: z.number().check(z.int(), z.positive())
});
export const EnvelopeSchema = z.object({
	format: z.literal(BACKUP_FORMAT),
	schemaVersion: z.number().check(z.int(), z.positive()),
	app: z.literal('Tran Real Estate Tools'),
	exportedAt: z.iso.datetime(),
	tables: z.record(z.string(), z.array(SyncableSchema))
});
```
- **`parseBackup(text, { registeredTables })` steps:** `JSON.parse` (failure → `not-json`), then `format` check (missing or other → `not-tran`), then `schemaVersion > BACKUP_SCHEMA_VERSION` → `newer`, then migrate (pure, `migrations[v]: (tables) => tables` for v → v+1), then validate (`invalid`). Unknown table names → `invalid` (a same-or-older file from this app can't contain them). Each error code maps 1:1 to a UI-SPEC SectionError string. The `file.size > MAX_BACKUP_BYTES` check (`too-large`) happens in the web layer **before** `file.text()`.
- A unit test asserts `migrations` has keys `1..BACKUP_SCHEMA_VERSION-1` with no gaps, and a golden v1 fixture under `packages/core/src/backup/__fixtures__/` (synthetic, `@example.com` only, because the real-data guard scans `fixtures?/` paths) always parses at the current version.

**Diff (pure, `diff.ts`).** Compare by `id` per registered table:
- **Merge:** `add` = incoming ids absent locally. `update` = present in both **and** `incoming.updatedAt > local.updatedAt` (strict; local wins ties). `unchanged` = all other local records, both matched-not-newer and local-only. Invariant: `add + update + unchanged === resulting table size`, a good property test. Tombstones are ordinary records: a newer incoming tombstone over a live local record is an `update`. An incoming tombstone with no local record is skipped entirely (a no-op, not counted).
- **Replace:** `delete` = local record count, `add` = incoming record count, excluding incoming tombstones (nothing to tombstone in an empty table).
- **`planMerge`/`planReplace` return `{ perTable: [{ table, label, add, update, unchanged } | { table, label, delete, add }], writes }`.** The web layer applies `writes` inside **one** `db.transaction('rw', [...registeredTables], …)`. Replace = `clear()` every registered table, then `bulkPut`. Merge = `bulkPut(add ∪ update)`. Verified: a thrown error inside a Dexie rw transaction rolled back both a `clear()` and a `put()`. "No differences" (`add + update === 0` in merge) drives the UI-SPEC empty state.
- **Merge is idempotent:** importing the same file twice gives `add=0, update=0` the second time (E2E check).

**Key-free guarantee (`key-scan.ts`):**
```ts
export const KEY_SHAPES: readonly { provider: string; re: RegExp }[] = [
	{ provider: 'anthropic', re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
	{ provider: 'openrouter', re: /sk-or-(?:v1-)?[A-Za-z0-9]{20,}/ },
	{ provider: 'openai', re: /sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}/ },
	{ provider: 'gemini', re: /AIza[0-9A-Za-z_-]{35}/ }
];
/** Returns provider labels only, never the matched text. */
export function findKeyMaterial(json: string, knownSecrets: readonly string[]): string[] {
	const hits = new Set<string>();
	for (const { provider, re } of KEY_SHAPES) if (re.test(json)) hits.add(provider);
	for (const s of knownSecrets) if (s.length >= 8 && json.includes(s)) hits.add('vault-value');
	return [...hits];
}
```
- RentCast key format is undocumented (LOW), so **don't** add a bare 32-hex/64-hex shape. It would false-positive on Phase 5's `inputHash` (sha256 hex) and similar. RentCast is covered by the exact-value check.
- **When the vault is locked, the exact-value check has no plaintext.** It is defense in depth on top of the structural guarantee: export reads only registered tables of DB `tran`, and the vault lives in DB `tran-secrets`.
- **Export flow:** read registered tables, build the envelope, `JSON.stringify(env, null, 2)`, `findKeyMaterial(text, vault.knownSecrets())`. Any hit → throw `key-material` (UI "Backup stopped"), and nothing is created. On pass: create a Blob and an object URL, click an `<a download>`, revoke the URL, then set `meta.lastBackupAt = now`.
- **Verified:** the download fired with the suggested filename and **0 CSP violations**. No `blob:` source is needed in any directive for an anchor download, and the policy stays unchanged.

### Pattern 6: Persistent storage + reminder
| Browser | `persist()` behaviour | Source |
|---|---|---|
| Chromium (Chrome/Edge) | No prompt. Auto-grants or denies from engagement heuristics (installed PWA, bookmark, high engagement, notification permission). | MDN quotas page (HIGH), web.dev (MEDIUM) |
| Firefox | **Shows a permission prompt** and only grants for requests generated by **user input** | MDN (HIGH) + web.dev (MEDIUM) |
| Safari 17+ (macOS/iOS) | Supported since 17.0. Granted by heuristics such as "opened as a Home Screen Web App". Persisted origins are exempt from eviction. | WebKit storage-policy post (HIGH) |
| Headless Chromium (Playwright) | `persisted()` false, `persist()` false, `estimate()` returned quota 6.4 GB, usage 0 (verified) | spike |

- **`requestPersistence()` must call `navigator.storage.persist()` synchronously at the top of the click handler**, before any `await`, as a fire-and-forget promise. That preserves transient user activation for Firefox. Call sites: Save key while in remember mode, switching to remember, Import (Merge/Replace confirm), "Ask the browser again", and later phases' first repo save. Skip the call if `persisted()` already returned true this session. The automatic call is silent unless the result changes (UI-SPEC).
- **Status values:** `granted` (true), `not-granted` (false), `not-reported` (`!navigator.storage?.persisted`). Space used: `estimate()`. Hide the row when it is unavailable, and never invent a figure.
- **Safari 7-day rule (MDN):** "If an origin has no user interaction … in the last seven days of browser use, its data created from script will be deleted." Home Screen web apps and persisted origins are exempt. This is why the reminder threshold is 7 and the copy says installing can help.
- **Reminder math (pure, core):**
```ts
export function backupReminderDue(i: { now: Date; hasRecords: boolean; lastBackupAt?: string; firstRecordAt?: string; snoozedUntil?: string }, days = 7) {
	if (!i.hasRecords) return { due: false as const };
	if (i.snoozedUntil && new Date(i.snoozedUntil) > i.now) return { due: false as const };
	const since = i.lastBackupAt ?? i.firstRecordAt;
	const n = since ? differenceInCalendarDays(i.now, new Date(since)) : 0;
	return n >= days ? { due: true as const, days: n, never: !i.lastBackupAt } : { due: false as const };
}
```
`firstRecordAt` lives in `meta` and is set by the repo layer on the first-ever user record. Phase 3 has no user-created records except prefs, so the backup AppNotice effectively appears from Phase 4 on. E2E seeds via import plus a clock override (`page.clock.install({ time })`, Playwright 1.45+).

### Pattern 7: PWA under meta CSP + sub-path base (VERIFIED on both bases)
**Manifest (`static/manifest.webmanifest`).** Every URL is relative, so it resolves against the manifest's own URL:
```json
{
	"name": "Tran Real Estate Tools",
	"short_name": "Tran Tools",
	"id": "./",
	"start_url": "./",
	"scope": "./",
	"display": "standalone",
	"background_color": "#fbf7f0",
	"theme_color": "#fbf7f0",
	"icons": [
		{ "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
		{ "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
		{ "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
	]
}
```
`app.html` head, after the frame-guard script:
```html
<script src="%sveltekit.assets%/pwa-capture.js"></script>
<link rel="manifest" href="%sveltekit.assets%/manifest.webmanifest" />
<link rel="apple-touch-icon" href="%sveltekit.assets%/icons/apple-touch-icon-180.png" />
<meta name="theme-color" content="#fbf7f0" />
```
Verified: the prerendered `renter/index.html` gets `href="../manifest.webmanifest"`. The `404.html` fallback gets the absolute `/tran_real_estate/manifest.webmanifest`. CDP `Page.getAppManifest` reported 0 errors, and `Page.getInstallabilityErrors` = `[]` on both bases. Use lowercase hex in the JSON (Prettier formats `.webmanifest` as JSON; Phase 2 Pitfall 5 lowercases CSS hex).

**Service worker (`src/service-worker.ts`).** Typed with triple-slash references. svelte-check passed with 0 errors and no tsconfig change (Kit 2.70.3):
```ts
/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { build, files, prerendered, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `tran-shell-${version}`;
const ASSETS = new Set([...build, ...files, ...prerendered]);

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((c) => c.addAll([...ASSETS])));
});
sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((k) => k.startsWith('tran-shell-') && k !== CACHE).map((k) => caches.delete(k)))
		)
	);
});
sw.addEventListener('fetch', (event) => {
	const req = event.request;
	if (req.method !== 'GET') return;                       // never POSTs (AI providers, Web3Forms)
	const url = new URL(req.url);
	if (url.origin !== sw.location.origin) return;          // never touches provider hosts / requests with keys
	if (!ASSETS.has(url.pathname)) return;                  // unknown paths → network → real 404 / 301
	event.respondWith(caches.open(CACHE).then(async (c) => (await c.match(url.pathname)) ?? fetch(req)));
});
```
- **`svelte.config.js`:** add `serviceWorker: { files: (f) => !/(^|[\\/])\./.test(f) }`. `$service-worker.files` contained `/.nojekyll` (verified). `cache.addAll` rejects the whole install if any request fails, so this excludes every dotfile.
- **Verified:**
  - Registration happens through Kit's inline boot script (`'../service-worker.js'` on `/renter/`), which is already hashed into `script-src`.
  - Scope is `http://127.0.0.1:4384/tran_real_estate/` on sub and `/` on root.
  - 38 entries were cached. `controller` is non-null after reload.
  - `does-not-exist/deeper/` still returns **404** while controlled.
  - A `page.route('https://api.rentcast.io/**')` mock **was hit** while the SW controlled the page, so Phase 4/5 mocks keep working.
  - Going offline then navigating to `renter/` rendered the h1.
  - 0 CSP violations. The full Phase 1 suite stayed green.
- **No `skipWaiting()`/`clients.claim()`.** A cache-first shell is self-consistent per version. Activating a new SW under an open old page would delete chunks the old page still lazy-loads, and GitHub Pages no longer has those hashed files after a deploy. A new version takes over when all Tran tabs close. Phase 10 can add an "update available" prompt if wanted.
- **Version/name:** `tran-shell-${version}`. Kit's `version.name` defaults to a build timestamp, so every deploy produces a byte-different SW and a new cache. Deleting only `tran-shell-*` keys means a future Phase 4 Cache Storage use (not planned; they use IndexedDB) would never be collateral damage.
- **ESLint:** the Phase 1 fetch ban flags `fetch(req)` here (verified). Add an override `{ files: ['apps/web/src/service-worker.ts'], rules: { 'no-restricted-syntax': 'off' } }` and a matching assertion in `scripts/eslint-rules.test.ts`: the SW path is allowed, and a sibling `lib/pwa/x.ts` is still banned.
- **`scripts/serve-pages.mjs`:** add `'.webmanifest': 'application/manifest+json'` and `'.png': 'image/png'` to `types` so local serving matches Pages. Chromium accepted the octet-stream manifest in the spike, but other engines and future checks may not.

**Install capture.** Chromium can fire `beforeinstallprompt` **before hydration**, and the event is lost if the listener is attached in `onMount`. The CSP-clean fix is a tiny external `'self'` script loaded in `<head>`, the same mechanism as `frame-guard.js`:
```js
// static/pwa-capture.js
(function () {
	window.addEventListener('beforeinstallprompt', function (e) {
		e.preventDefault();
		window.__tranInstallPrompt = e;
		window.dispatchEvent(new Event('tran:installable'));
	});
	window.addEventListener('appinstalled', function () {
		window.__tranInstallPrompt = undefined;
		window.dispatchEvent(new Event('tran:installed'));
	});
})();
```
`lib/pwa/install.svelte.ts` reads `window.__tranInstallPrompt` on mount, listens for the two custom events, and exposes `state: 'installable' | 'ios' | 'installed' | 'unsupported'`:
- **iOS detection:** `/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)`, covering iPadOS's desktop UA.
- **Installed detection:** `matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true`.

On iOS 26, every site added to the Home Screen opens as a web app by default, via the "Open as Web App" toggle. Since iOS 16.4, non-Safari iOS browsers can also Add to Home Screen. The UI-SPEC copy ("Tap the Share button in your browser's toolbar or menu") is therefore correct for all iOS browsers. Add `pwa-capture.js` to the `checkBuild` carrier list in `assert-csp.mjs`, next to `frame-guard.js`.

**Icons** are generated by `apps/web/scripts/generate-icons.mjs`, run manually with the PNGs committed. The script must live in `apps/web/`: from the repo-root `scripts/` dir, `@playwright/test` doesn't resolve (verified). See Code Examples. The output was checked visually: a cream Fraunces 600 "T" centered on terracotta, with `document.fonts.check` true.

### Pattern 8: Settings page hydration, probe, and announcer
- **Hydration:** the prerendered page renders all static copy plus "Checking this browser…". `onMount` dynamically imports `$lib/storage/…` and the vault, so the module graph stays out of other routes' entry chunks. A `data-hydrated` attribute is set in `onMount`, and E2E waits on it before interacting (Phase 2 Pitfall 10).
- **CSP probe (`data-testid="csp-transition-toggle"`/`csp-transition-target`):** keep the restyled Phase 2 probe element exactly as Phase 2 leaves it (Phase 2 Pitfall 7), so `csp.spec.ts` needs no change. **Additionally** extend `csp.spec.ts` with a real-UI assertion: save a dummy key, open the Forget-all ConfirmDialog, close it, and expect 0 violations. bits-ui inline styles and `tw-animate-css` animations are what the probe was standing in for.
- **LiveAnnouncer** lives in the root layout and imports nothing from storage, so it is legal for marketing. `announce()` clears the node, then sets text in `requestAnimationFrame` (UI-SPEC).
- **AppNotice** goes in the `(app)` group layout as the first child of `<main>`. That requires Phase 2's layout restructure (Phase 2 Pattern 6 moves `<main>` into group layouts). Phase 4's UI-SPEC later moves it to second child. It must **not** be rendered in, or imported by, `(marketing)` or `(print)`.

### Anti-Patterns to Avoid
- **Accepting init's `app.css` rewrite.** It replaces Phase 2 hex tokens with `var(--primary)` oklch indirection, and the radius tokens with `calc(var(--radius)…)`.
- **Kit docs' SW example verbatim.** It caches every 200 GET, including cross-origin, which caches API responses and routes key-bearing requests through the SW.
- **`Dexie.delete('tran-secrets')` for forget-all.** It blocks against other open tabs. Clear the tables in a transaction instead.
- **Putting `lastBackupAt` in the backup.** Importing would fake backup recency. It belongs in local-only `meta`.
- **Calling `persist()` after an `await`.** Firefox drops it for lacking user input.
- **`skipWaiting()` in a cache-first app-shell SW on Pages.** It causes old-page chunk 404s after deploys.
- **Planted test keys as source literals** (`sk-ant-api03-…` with full length, `AIza…35 chars`). gitleaks' default rules (enabled via `useDefault = true`) and the pre-commit hook will block the commit. Build them at runtime instead: `['sk', 'ant', 'api03', 'x'.repeat(40)].join('-')`.
- **`window.confirm`.** Banned by the UI-SPEC. Add `'no-restricted-globals': ['error', { name: 'confirm', message: 'Use ConfirmDialog' }]`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus trap, Escape, focus return, scroll lock, `aria-labelledby` wiring for dialogs | Custom modal | bits-ui `Dialog`/`AlertDialog` via shadcn copy-ins | Verified axe-clean and CSP-clean. Handles inert background (`pointer-events: none` on body) and nested portals. |
| IndexedDB transactions, schema upgrades, change observation | Raw `indexedDB.open` + `onupgradeneeded` | Dexie 4.4.6 `version().stores().upgrade()`, `transaction('rw')`, `liveQuery` | Rollback and observation verified. Raw IDB auto-commit pitfalls across `await` are real. |
| Key derivation and encryption | Any JS crypto lib, hand-written PBKDF2, `btoa` "obfuscation" | WebCrypto `PBKDF2` + `AES-GCM` | Native, constant-time, non-extractable keys, zero dependencies |
| JSON validation of untrusted files | Manual `typeof` trees | `zod/mini` schemas in core | Precise issue paths, migrations stay typed |
| SW precache manifest | Hand-maintained asset list | `$service-worker` `build`/`files`/`prerendered`/`version` | Hashed names change every build, and the lists are base-prefixed (verified) |
| Icon rasterization | Canvas at runtime, a native image lib | Playwright screenshot of an HTML page using the self-hosted Fraunces woff2 | Zero new dependencies, real brand font, deterministic sizes |
| Cross-tab signalling | `storage` events on localStorage | `BroadcastChannel` | `storage` events never fire for sessionStorage. BroadcastChannel is native in all targets and in Node 24 (unit-testable). |
| Day counting | `Math.floor(ms / 86400000)` | date-fns `differenceInCalendarDays` | DST and local calendar days, per the UI-SPEC |

**Key insight:** In this phase the dangerous code is the glue (what the SW intercepts, what export reads, what a tab clears), not the algorithms. Every glue point gets an allowlist and a planted-failure test.

## Common Pitfalls

### Pitfall 1: shadcn-svelte 1.6.1 init is preset-based and interactive (VERIFIED)
**What goes wrong:** `init --base-color stone` alone still prompts ("You didn't provide a preset…"), then asks to confirm overwriting `app.css`. Without a TTY it hangs or aborts.
**How to avoid:** `--preset bJ36uES` plus all alias flags plus `--no-deps-install`, answering the CSS confirm (default Yes). The decoded preset is `{style:'vega', baseColor:'stone', theme:'stone', iconLibrary:'lucide', font:'inter', fontHeading:'inherit', radius:'default', menuAccent:'subtle', menuColor:'default', chartColor:'neutral'}`. `encodePreset`/`decodePreset` are exported from `shadcn-svelte/preset` if it needs re-deriving.

### Pitfall 2: init/add write caret pins to the newest versions and trip pnpm's release-age gate (VERIFIED)
**What goes wrong:** `@lucide/svelte ^1.52.0` (published today) made `pnpm install` write `minimumReleaseAgeExclude` into `pnpm-workspace.yaml`. `bits-ui ^2.18.0` resolved 2.19.5, not the UI-SPEC's 2.19.2. `shadcn-svelte ^1.7.0` doesn't match the generating CLI.
**How to avoid:** `--no-deps-install`, then rewrite to exact pins, then `git diff --exit-code pnpm-workspace.yaml`.

### Pitfall 3: Generated component code fails the repo gates (VERIFIED)
**What goes wrong:** `prettier --check` fails (51 files), `eslint` fails (`svelte/no-navigation-without-resolve` in `button.svelte`), and the UI-SPEC class guard would fail on `dark:`/`ring-ring/`/`bg-black`.
**How to avoid:** `pnpm format` immediately after add, then the reconciliation edits in Pattern 1, then lint. Do it all in the same plan.

### Pitfall 4: `--color-*: initial` makes some generated classes silently render nothing
**What goes wrong:** `bg-black/10` (overlays) and any other palette class compile to nothing, so the overlay is invisible. No error is raised.
**How to avoid:** Replace them with token classes (`bg-foreground/60`). Make the class guard grep for `bg-black`/`text-white`/palette names under `components/ui/`. Add an E2E assertion that the overlay has a non-transparent computed `background-color` while a dialog is open.

### Pitfall 5: The service worker breaks things only if it is too helpful (VERIFIED safe shape)
**What goes wrong:** Kit's docs example responds to every GET, caches 200s (including cross-origin), and falls back to cache. That caches RentCast/LLM responses outside Phase 4's budget-aware cache, routes key-bearing requests through SW code, and can mask 404s.
**How to avoid:** Use the allowlist shape in Pattern 7, plus a unit-level guard: a script test that reads `src/service-worker.ts` and asserts it contains the `url.origin !== sw.location.origin` early return and no `cache.put`, plus the E2E proofs below.

### Pitfall 6: "Session only" is not quite "gone when the session ends" (MEDIUM)
**What goes wrong:** `sessionStorage` is per tab and survives reloads (verified), but browsers restore it with the tab. Firefox persists sessionStorage across browser restart/session restore and on "reopen closed tab" (Bugzilla 1198772, MEDIUM). Chrome restores it on "Reopen closed tab".
**How to avoid:** This is the CONTEXT-locked mechanism, so keep it. The UI-SPEC copy "Keys are cleared when you close this tab" is accurate for a normal close. The planner may add one short helper sentence under the radio for honesty ("Reopening a closed tab can bring them back"); that is the owner's call (Open Question 2). Forget-all is the reliable path and must clear sessionStorage in every tab.

### Pitfall 7: `persist()` without user activation is ignored by Firefox
**How to avoid:** Call it synchronously first thing in the click handler (Pattern 6). Unit-test that `requestPersistence` calls `navigator.storage.persist` synchronously by asserting a spy was called before the first `await` resolves.

### Pitfall 8: `beforeinstallprompt` fires before hydration
**How to avoid:** Use `static/pwa-capture.js` in `<head>` (Pattern 7). Don't put an inline script in `app.html`: Kit's hash mode does not hash it, and `assert-csp` would fail it.

### Pitfall 9: `$service-worker.files` includes `.nojekyll` (VERIFIED)
**How to avoid:** Set `kit.serviceWorker.files` to exclude dotfiles. Add an E2E check that the cache holds no `/.nojekyll` key.

### Pitfall 10: Planted keys in tests trip gitleaks (pre-commit + CI history scan)
**How to avoid:** Generate fixtures at runtime (Anti-Patterns). Never commit a literal matching default gitleaks rules. Keep the `TRANCANARY_` canary untouched.

### Pitfall 11: Node unit tests have no Web Storage and no client Svelte runtime (VERIFIED)
**What goes wrong:** `typeof sessionStorage === 'undefined'` in Node 24. `.svelte.ts` effects never run in the `web` Vitest project, which compiles for the server.
**How to avoid:** Inject storage into the vault, keep reactive wrappers thin, and assert reactivity in Playwright. `fake-indexeddb` plus native `crypto.subtle` plus native `BroadcastChannel` cover the rest.

### Pitfall 12: Headless Chromium never grants `persist()` and never fires `beforeinstallprompt` (VERIFIED for persist)
**How to avoid:** Stub them in E2E with `page.addInitScript`: override `navigator.storage.persist`/`persisted` to return a controllable value, and dispatch a synthetic `beforeinstallprompt` (an `Event` with `prompt()` and `userChoice`) *after* `pwa-capture.js` has attached its listener. Real installability is checked with CDP `Page.getAppManifest` (errors `[]` plus the parsed fields). Note that `Page.getInstallabilityErrors` returned `[]` **even for a deliberately broken manifest** served via `page.route` (non-vacuity failed), so don't rely on it alone. Assert the manifest fields directly and fetch every icon (200, `image/png`, IHDR dimensions match).

### Pitfall 13: Phase 2 ordering
**What goes wrong:** Phase 2 restructures layouts (`<main>` moves into group layouts), adds `@lucide/svelte@1.45.0`, fonts, `@tran/brand` tokens, the parity test, the shared `tests/e2e/routes.ts`, and the restyled settings probe. Phase 3 UI work depends on all of these.
**How to avoid:** Non-UI Phase 3 plans (core backup/diff/scan, Dexie/repos/registry, vault, SW/manifest/icons) don't depend on Phase 2. UI plans (shadcn init, Settings, AppNotice) must run after Phase 2's tokens and layout plans. Each UI plan starts with a precondition check, `grep -q -- '--color-\*: initial' apps/web/src/app.css`, and if it is missing, writes the Phase 2 `@theme` block literal-for-literal from 02-UI-SPEC (the UI-SPEC fallback). Never duplicate Phase 2's fonts or layout work.

### Pitfall 14: Route-list drift
Phase 2 introduces `tests/e2e/routes.ts` plus a build drift guard. Phase 3 adds **no new routes**, but adds carriers (`manifest.webmanifest`, `service-worker.js`, `pwa-capture.js`, 4 icons) that belong in `assert-csp.mjs` `checkBuild`'s carrier list. `assert-csp.test.ts` computes expected counts from the lists, so update those lists and not hard-coded numbers.

## Code Examples

### `$lib/utils.ts` (replace the CLI's `cn` re-export)
```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
// keep the generated WithoutChild / WithoutChildren / WithoutChildrenOrChild / WithElementRef types below
```

### Vault crypto core (verified primitives)
```ts
// apps/web/src/lib/storage/secrets/crypto.ts
export const ITERATIONS = 600_000;
const enc = new TextEncoder();
const dec = new TextDecoder();
export type Box = { iv: Uint8Array<ArrayBuffer>; ct: Uint8Array<ArrayBuffer> };

export async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations = ITERATIONS) {
	const base = await crypto.subtle.importKey('raw', enc.encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
		base,
		{ name: 'AES-GCM', length: 256 },
		false,                     // non-extractable
		['encrypt', 'decrypt']
	);
}
export async function seal(key: CryptoKey, plaintext: string, aad: string): Promise<Box> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, key, enc.encode(plaintext)));
	return { iv, ct };
}
/** Throws (OperationError) on wrong key OR wrong aad. */
export async function open(key: CryptoKey, box: Box, aad: string): Promise<string> {
	return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: box.iv, additionalData: enc.encode(aad) }, key, box.ct));
}
export const aadFor = (provider: string) => `tran-vault:v1:${provider}`;
export const CHECK_AAD = 'tran-vault:v1:check';
```
Values read back from IndexedDB come back as `Uint8Array`. If TS 6 complains about `ArrayBufferLike` vs `BufferSource`, copy them with `new Uint8Array(x)` at the read boundary (MEDIUM: the spike typechecked fresh `getRandomValues` buffers only).

### Vitest: Dexie under fake-indexeddb (verified)
```ts
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import Dexie from 'dexie';
const db = new Dexie('t', { indexedDB: new IDBFactory(), IDBKeyRange }); // fresh, isolated per test
```
Prefer a fresh `IDBFactory` per test over `import 'fake-indexeddb/auto'` (global), so tests can't leak state.

### Export download (verified: download fires, 0 CSP violations)
```ts
export function downloadJson(text: string, filename: string) {
	const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
	const a = Object.assign(document.createElement('a'), { href: url, download: filename });
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
export const backupFilename = (d = new Date()) =>
	`tran-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
```

### Icon generator (verified; run from `apps/web`)
```js
// apps/web/scripts/generate-icons.mjs  (node scripts/generate-icons.mjs; commit static/icons/*.png)
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../package.json', import.meta.url));
const font = readFileSync(require.resolve('@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2')).toString('base64');
const out = new URL('../static/icons/', import.meta.url);
mkdirSync(out, { recursive: true });
// colors MUST come from @tran/brand (import tokens via a tiny build step or duplicate + parity-test them)
const html = (size, safe) => `<!doctype html><style>
@font-face{font-family:F;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
html,body{margin:0}div{width:${size}px;height:${size}px;background:#a4452a;color:#fbf7f0;display:grid;place-items:center;
font:600 ${Math.round(size * (safe ? 0.56 : 0.7))}px/1 F}</style><div>T</div>`;
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [name, size, safe] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true], ['apple-touch-icon-180.png', 180, false]]) {
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(html(size, safe));
	await page.evaluate(() => document.fonts.ready);
	writeFileSync(new URL(name, out), await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } }));
}
await browser.close();
```
The generator page is a local `setContent` document, so the `data:` font is fine there. It never ships. The shipped PNGs are opaque (screenshots have no alpha), which satisfies apple-touch-icon "no transparency". `@tran/brand` is a `.ts` package; Node 24 strips types natively for `import` of `.ts`. Verify that with `node --experimental-strip-types` if needed, or duplicate the two hex values and add them to the parity test (LOW risk either way).

### E2E: stubbing persist() and beforeinstallprompt
```ts
await page.addInitScript(() => {
	let granted = false;
	Object.defineProperty(navigator.storage, 'persisted', { value: async () => granted });
	Object.defineProperty(navigator.storage, 'persist', { value: async () => (granted = true) });
});
// after load: pwa-capture.js is attached
await page.evaluate(() => {
	const e = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
		prompt: async () => {},
		userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' })
	});
	window.dispatchEvent(e);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `shadcn-svelte init` with base-color prompts, `clsx`+`tailwind-merge` utils | Preset codes (`--preset`), styles (nova default, vega classic, luma, sera…), `shadcn-svelte/tailwind.css` variant import, `cn` package, font registry items | shadcn-svelte 1.6 (2026-09) | Init edits more than before: CSS imports, fonts, the `cn` dep. Use the reconciliation procedure. |
| `data-[state=open]:` classes | `data-open:`/`data-checked:` custom variants from `shadcn-svelte/tailwind.css` | shadcn-svelte 1.6 | That CSS import is mandatory for the copied components |
| iOS: only Safari can add to Home Screen; needs manifest/meta for standalone | iOS 16.4+: any browser via Share. iOS 26: every Home Screen site opens as a web app by default ("Open as Web App" toggle) | 2023 / 2025 | The UI-SPEC iOS copy is browser-agnostic, which is correct |
| WebKit: no Storage API | Safari 17: `persist()`/`persisted()`/`estimate()`; persistent origins exempt from eviction | 2023 | The "Persistent storage" row is meaningful on iOS |
| SvelteKit 2 is latest | **SvelteKit 3.0.0 stable published 2026-10-01** | 3 days ago | **Out of scope.** Stay on 2.70.3 (all pins and peers verified for 2.x). svelte.dev docs now show v3 APIs (`$app/service-worker`, `$app/manifest`); **don't copy them**. Use `$service-worker` (Kit 2, verified). |

**Deprecated/outdated:**
- Kit docs' "cache everything" SW example: unsafe for this app (Pitfall 5).
- `dexie-svelte-query`: unreliable under Svelte 5 (Dexie #2231; CLAUDE.md).

## Open Questions

1. **Keep `tw-animate-css` or drop it?**
   - **Known:** the generated dialogs use `data-open:animate-in fade-in-0 zoom-in-95`, and the UI-SPEC permits it only behind `motion-safe:`.
   - **Recommendation:** keep it (1 dependency, 0 runtime JS), prefix every usage with `motion-safe:`, and make the class guard fail on an unprefixed `animate-in`/`animate-out`.
2. **Honesty about session restore (Pitfall 6).**
   - **Recommendation:** keep the UI-SPEC copy unchanged (owner-approved). Record the limitation in the plan's threat model, and add a one-line helper only if the UI-SPEC owner revisits it. Forget-all remains the guaranteed path.
3. **Merge "Unchanged" definition.**
   - **Recommendation:** matched-not-newer plus local-only, which gives the `add + update + unchanged = final count` invariant. Caption copy is unchanged.
4. **Where `@tran/brand` hex values come from in the icon script.**
   - **Recommendation:** import from `@tran/brand` if Node's type stripping handles the package's `.ts` export. Otherwise duplicate the two values and have a unit test compare them to `@tran/brand`.
5. **Does Phase 3 register anything besides `prefs` for backup?**
   - **Known:** the CONTEXT says each later phase registers its tables.
   - **Recommendation:** `prefs` only, which gives E2E a real table. The registry API and the "no data yet" empty state are exercised with 0 records.
6. **Vitest browser mode for reactive helpers?** `@vitest/browser-playwright` is in the stack doc but not installed.
   - **Recommendation:** not in Phase 3. E2E covers the thin `live()` and vault-status reactivity. Revisit when the portal phases need component tests.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.11 (projects `web`, `core`, `scripts`, plus Phase 2's `brand`), Playwright 1.63.0 + @axe-core/playwright 4.13.0 (projects `root`, `sub`), Node oracle `scripts/assert-csp.mjs` |
| Config files | `vitest.config.ts` (unchanged unless `core` needs nothing new), `packages/core/vitest.config.ts` (existing; network-blocked), `apps/web/vite.config.ts` (unchanged), `apps/web/playwright.config.ts` (unchanged: SW `allow` is the default and was verified green) |
| Quick run command | `corepack pnpm lint && corepack pnpm test:unit` (about 30 s plus the vault tests, which use injected low iterations) |
| E2E run | `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert && corepack pnpm test:e2e` |
| Full suite command | `corepack pnpm verify` |

### Phase Requirements → Test Map
| Req / Criterion | Behavior | Test Type | File + command | How it can fail (non-vacuity / mutation) | Exists? |
|---|---|---|---|---|---|
| PLAT-01 | Provider registry hosts ⊆ CSP `connect-src`; 5 providers, RentCast first | unit | `packages/core/src/providers.test.ts` (imports `CONNECT` from `scripts/assert-csp.mjs`) · `corepack pnpm vitest run --project core` | Adding a host not in CSP fails. Removing a provider fails the count. | ❌ W0 |
| PLAT-01 | setKey/getKey/removeKey per provider; trims; rejects internal whitespace; no key text in any thrown message | unit | `apps/web/src/lib/storage/secrets/vault.test.ts` · `--project web` | Planted key value must not appear in `String(err)` for every rejection path | ❌ W0 |
| PLAT-01 | **forgetAll clears all three stores and broadcasts** | unit (mutation) | `vault.test.ts` | Assert the session fake is empty, `tran-secrets.keys` count is 0, `meta.vault` is absent, and a second Vault on the same channel received `forget-all`. **Manual mutation run:** comment out each of the 4 clear steps in turn; each must fail a test. Record in SUMMARY. | ❌ W0 |
| PLAT-01 | Paste / show-hide / Save / saved summary shows only last4; full key never in the DOM; forget-all with ConfirmDialog (focus to Cancel, Escape cancels) | E2E | `apps/web/tests/e2e/settings-keys.spec.ts` · `corepack pnpm test:e2e` | After save, `page.content()` must not contain the planted key, and must contain `Key ending in ` + last4 | ❌ W0 |
| PLAT-01 | Cross-tab forget: tab B's UI clears and announces | E2E | `settings-keys.spec.ts` (two pages, one context) | Tab B's sessionStorage entry must be gone (each tab clears itself) | ❌ W0 |
| PLAT-01 | Test-key button absent when no tester is registered | E2E | `settings-keys.spec.ts` | `getByRole('button', {name:'Test key'})` has count 0 | ❌ W0 |
| PLAT-02 | Default mode is session: survives reload; a new tab and a new context lack it; remember mode: a new tab (same context) has it | E2E | `settings-keys.spec.ts` | Asserting the new tab is empty proves sessionStorage, not IDB, holds session keys | ❌ W0 |
| PLAT-02 | Mode switch migrates keys; remember→session deletes `tran-secrets` rows | unit | `vault.test.ts` | Row count after the switch must be 0 | ❌ W0 |
| PLAT-03 | Correct passphrase unlocks; **wrong passphrase fails**; wrong AAD fails; stored record has `iterations === 600000`, 16-byte salt, 12-byte IV per record, all IVs distinct | unit (mutation) | `apps/web/src/lib/storage/secrets/crypto.test.ts`, `vault.test.ts` | Mutation: make `open()` ignore AAD → the AAD test fails. Mutation: reuse one IV → the distinct-IV test fails. | ❌ W0 |
| PLAT-03 | Locked at rest: raw `tran-secrets` contains no plaintext key after lock; after "reopen" (close the page, open a new page in the same context) the badge says Locked and `getKey` returns undefined until unlock | E2E | `settings-security.spec.ts` | `page.evaluate` opens raw IndexedDB and serializes all rows: must not include the planted key. Mutation: skip encryption → fails. | ❌ W0 |
| PLAT-03 | Rate limit: 5 wrong attempts then a 30s cooldown that survives reload, doubling to a 300s cap; success resets | unit + E2E | `vault.test.ts` (injected clock); `settings-security.spec.ts` (`page.clock`) | Reloading during cooldown must still show the countdown | ❌ W0 |
| PLAT-04 | Envelope parse: not-json / not-tran / newer / invalid / unknown-table errors; migration registry has no gaps; golden v1 fixture parses | unit | `packages/core/src/backup/envelope.test.ts`, `migrations.test.ts` | Each error code is asserted on a crafted input | ❌ W0 |
| PLAT-04 | Diff: merge add/update/unchanged incl. ties and tombstones; invariant `a+u+k = final`; replace counts; idempotent re-merge | unit (property-style table) | `packages/core/src/backup/diff.test.ts` | Mutation: `>=` instead of `>` on updatedAt → tie test fails | ❌ W0 |
| PLAT-04 | **Export contains no key:** scanner flags each runtime-built key shape plus exact vault values; export throws `key-material` and creates no file when a planted key is in a pref record | unit (mutation) | `packages/core/src/backup/key-scan.test.ts`; `apps/web/src/lib/storage/backup.test.ts` (fake-indexeddb) | Planted runtime-built `sk-ant-…` inside a `prefs.value` must block. Mutation: export a non-registered table, or read `tran-secrets` → a test asserting export table names ⊆ registry fails. | ❌ W0 |
| PLAT-04 | Single transaction: a failure mid-import leaves data unchanged | unit | `backup.test.ts` (inject a throwing `bulkPut`) | Count before = count after | ❌ W0 |
| PLAT-04 | Round trip into a **fresh profile**: export (after saving keys in all 5 providers), the downloaded file contains none of the 5 planted values nor any `KEY_SHAPES` match; a new context imports it, previews counts, Merge, then the Replace confirm path | E2E | `settings-backup.spec.ts` (`page.waitForEvent('download')`, `setInputFiles`) | Fresh context proves cross-profile import. Re-import shows "matches what's already in this browser". | ❌ W0 |
| PLAT-04 | Too-large (>25 MB) and invalid files show the right SectionError; file input resets | E2E | `settings-backup.spec.ts` (`setInputFiles` with a generated buffer) | Each error title asserted | ❌ W0 |
| PLAT-05 | `backupReminderDue` table: never/7 days/6 days/snoozed/no records | unit | `packages/core/src/reminder.test.ts` | Boundary at exactly 7 days | ❌ W0 |
| PLAT-05 | Storage status renders granted / not granted / not reported; "Ask the browser again" calls persist and announces | E2E | `settings-storage.spec.ts` (addInitScript stubs) | Real headless returns false (verified), so the stub is what gives "granted" coverage | ❌ W0 |
| PLAT-05 | `requestPersistence` calls `persist()` synchronously (Firefox activation) | unit | `apps/web/src/lib/storage/persistence.test.ts` | A spy is called before the first microtask | ❌ W0 |
| PLAT-05 | Backup AppNotice shows on a portal route after 8 days (clock), not on marketing/print; "Remind me tomorrow" snoozes | E2E | `app-notice.spec.ts` (`page.clock.install`) | Marketing route must have 0 notice regions | ❌ W0 |
| PLAT-06 | Build carriers exist: `manifest.webmanifest` (valid JSON, relative `start_url`/`scope`/`id`, 192 + 512 + maskable icons), `service-worker.js`, `pwa-capture.js`, 4 PNGs with correct IHDR sizes | build oracle | extend `scripts/assert-csp.mjs` + `scripts/assert-csp.test.ts` · `corepack pnpm csp:assert` | Mutation: absolute `start_url` → oracle error; missing icon → error | ❌ extend |
| PLAT-06 | SW registers with scope `{base}/`, controls after reload, cache keys ⊆ the build asset list and contain no `.nojekyll`, unknown path still 404, a cross-origin `page.route` mock is still hit, offline navigation to a prerendered page works, 0 CSP violations | E2E | `apps/web/tests/e2e/pwa.spec.ts` (both projects) | All of these were verified in the spike. The `.nojekyll` check fails without the `serviceWorker.files` filter. | ❌ W0 |
| PLAT-06 | Manifest parsed by Chromium on both bases: CDP `Page.getAppManifest` errors `[]`, `start_url` resolves to `{base}/`; every icon fetch returns 200 `image/png` | E2E | `pwa.spec.ts` | Don't use `getInstallabilityErrors` as the only oracle (non-vacuity failed in the spike) | ❌ W0 |
| PLAT-06 | Install section states: synthetic `beforeinstallprompt` → "Install app" → `prompt()` called → "installed" after a synthetic `appinstalled`; iOS UA (`test.use({ userAgent })`) → `<ol>` steps; unsupported → state (d) | E2E | `settings-install.spec.ts` | Event dispatched **before** hydration (pre-mount via `addInitScript` timing) must still be captured. Proves `pwa-capture.js`. | ❌ W0 |
| UI contract | axe 0 violations on `/settings/` in every UI-SPEC state (empty, keys saved, locked, preview merge/replace, each dialog open, notice on a portal) on both bases | E2E | extend `tests/e2e/a11y.spec.ts` or `settings-a11y.spec.ts` | Existing `passes.length > 0` guard | ✅ extend |
| UI contract | Class guard: no `bg-secondary`/`bg-black`/`dark:`/`ring-ring/`/unprefixed `animate-in` under `components/ui/` | script + unit | `scripts/ui-class-guard.mjs` + `.test.ts` (temp-dir planted file) | Planted `dark:bg-x` must fail | ❌ W0 |
| Lint contract | SW fetch override scoped to `service-worker.ts` only; `no-restricted-globals: confirm`; `no-console` in `lib/storage/secrets/**`; marketing can't import `$lib/storage/secrets` | unit | extend `scripts/eslint-rules.test.ts` | Sibling file with fetch is still an error; `confirm()` is an error | ✅ extend |
| Regression | Phase 1 CSP (probe kept) plus new dialog-open CSP check; routing 404; framing; Phase 2 parity test with the 8 alias tokens | E2E + unit | existing specs; `csp.spec.ts` extended | — | ✅ extend |

### Sampling Rate
- **Per task commit:** `corepack pnpm lint && corepack pnpm test:unit` (pre-commit gitleaks + real-data guard run automatically).
- **Per wave merge:** `corepack pnpm verify` (both builds, CSP oracle, E2E on both bases).
- **Phase gate:** full `corepack pnpm verify` green, plus the recorded manual mutation runs (vault forget-all, AAD, IV reuse, merge tie, SW `.nojekyll` filter), before `/gsd:verify-work`. Owner device UAT (deferred, non-blocking, same as Phase 1): install on a real Android/desktop Chrome and iOS Safari Add to Home Screen once the org origin exists.

### Wave 0 Gaps
- [ ] Deps with exact pins (Standard Stack). `pnpm-workspace.yaml` unchanged.
- [ ] `packages/core`: `zod`/`date-fns` deps. `src/backup/__fixtures__/backup-v1.json` (synthetic, `@example.com`).
- [ ] Test fakes: `apps/web/src/lib/storage/test-utils.ts` (Map-backed Storage, fresh `IDBFactory`, runtime key builders `fakeKey(provider)`).
- [ ] E2E: `settings-keys`, `settings-security`, `settings-backup`, `settings-storage`, `settings-install`, `pwa`, `app-notice` specs. Shared helpers in `tests/e2e/helpers/settings.ts` (hydration wait, persist stub, planted keys).
- [ ] `scripts/serve-pages.mjs` MIME additions. `scripts/assert-csp.mjs` carrier and manifest checks plus tests.
- [ ] `scripts/ui-class-guard.mjs` plus test, wired into `verify` and the CI `hygiene` job (`run:` step only; keep the workflow-gate SHA-pin counts unchanged, as Phase 2 Pattern 5 does).

### Suggested plan ordering (fine granularity)
1. **Wave 1 (parallel, no Phase 2 dependency):**
   - (a) Core: providers, syncable, backup envelope/migrations/diff/key-scan, reminder, with tests.
   - (b) Dexie `getDb`/repos/meta/registry/backup service/persistence, with fake-indexeddb tests.
   - (c) Vault crypto + Vault class + channel + testers, with mutation-tested unit tests.
   - (d) PWA: manifest, icons script + committed PNGs, `pwa-capture.js`, SW, `serviceWorker.files`, ESLint override, serve-pages MIME, assert-csp carriers, `pwa.spec.ts`.
2. **Wave 2 (needs Phase 2 tokens/layout):** shadcn init + add via the Pattern 1 procedure, alias tokens + parity, utils, reconciliation, class guard, LiveAnnouncer.
3. **Wave 3 (parallel):**
   - Settings API keys + Key security sections.
   - Backup & restore section.
   - Storage + Install sections.
   - AppNotice in the `(app)` layout.
4. **Wave 4:** Settings E2E/axe matrix, CSP dialog check, full `verify`, mutation runs recorded.

## Sources

### Primary (HIGH confidence; executed in a throwaway worktree of this repo at be816eb on 2026-10-04, then removed)
- `shadcn-svelte@1.6.1` CLI (`dist/index.mjs`, `dist/preset-*.mjs`, `dist/tailwind.css`): init/add options, preset encoding, CSS rewrite, dependency writes. Run end to end.
- `bits-ui@2.19.2` / installed 2.19.5 dist: style injection scan, `onOpenAutoFocus`, `escapeKeydownBehavior`, `interactOutsideBehavior` types.
- Spike builds (root + sub) with `assert-csp.mjs` passing. Playwright: the full existing suite plus spike specs, 34/34 green, CSP/axe/focus/SW/offline/route-mock/manifest/download/persist/BroadcastChannel/sessionStorage observations quoted above.
- Vitest (web project): Dexie 4.4.6 + fake-indexeddb 6.2.5 round trip, rollback, `liveQuery`, v1→v2 upgrade, Blob round trip, CryptoKey storage. WebCrypto PBKDF2 600k timing, wrong-passphrase and wrong-AAD rejection. `zod/mini` 4.6.4 API checks.
- `@sveltejs/kit@2.70.3` `types/index.d.ts`: `serviceWorker.files`/`register`, `$service-worker` exports.
- npm registry (`npm view`, 2026-10-04): every version and publish date in Standard Stack. `cn` package history.
- [WebKit: Updates to storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/): persist heuristics (Home Screen Web App), persistent origins exempt, quotas.
- [MDN: Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria): per-browser persist behaviour, Safari 7-day rule and exemptions, quotas.
- [MDN: StorageManager.persist()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist): semantics, secure context, not in workers.

### Secondary (MEDIUM)
- [web.dev: Persistent storage](https://web.dev/articles/persistent-storage): Firefox requires user input for the prompt. Chromium heuristics.
- [WebKit Features in Safari 17.0](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/): Storage API support.
- [WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/) and [heise: iOS 26 web app behaviour](https://www.heise.de/en/news/iOS-26-and-iPadOS-26-Changed-web-app-behaviour-on-the-home-screen-10749652.html): Home Screen sites open as web apps by default.
- [Bugzilla 1198772](https://bugzilla.mozilla.org/show_bug.cgi?id=1198772): Firefox sessionStorage survives tab close/restore.
- [MDN: Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable): Chromium manifest requirements.
- [svelte.dev service workers docs](https://svelte.dev/docs/kit/service-workers): now shows Kit 3 APIs. Used only for the caching caveats, not the code.

### Tertiary (LOW)
- RentCast key format: undocumented, so there is deliberately no shape regex.
- Whether GitHub Pages serves `/.nojekyll` (irrelevant once it is filtered out).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Versions and dates from the registry, packages installed and exercised.
- shadcn init procedure: HIGH. Run twice in the worktree; outputs quoted.
- Dexie/vault/backup design: HIGH for primitives (spiked), MEDIUM for the exact merge-count semantics (a design choice, Open Question 3).
- PWA/SW: HIGH on Chromium, both bases. MEDIUM for iOS/Firefox install behaviour (docs only).
- Persist/eviction: HIGH (MDN + WebKit) for policy, MEDIUM for heuristics details.
- Pitfalls: 1-5, 9, 11, 12 reproduced. 6-8 doc-sourced (MEDIUM). 10, 13, 14 from repo inspection.

**Research date:** 2026-10-04
**Valid until:** 2026-11-03. Re-check sooner if bumping shadcn-svelte (1.7.0 exists) or bits-ui, or if the project moves to SvelteKit 3 (stable since 2026-10-01).
