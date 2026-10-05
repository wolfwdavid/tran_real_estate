# Phase 3: Local Platform: Storage, Key Vault & Backup - Context

**Gathered:** 2026-10-04
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the browser-only platform layer:
- Local data store: Dexie/IndexedDB schema and migrations, `Syncable` record shape, typed repositories.
- A separate secrets vault for API keys, with three modes: session-only default, "remember on this device" opt-in, and an optional passphrase lock.
- A Settings key-management UX with the "where your key goes" explainer and a forget-all action.
- JSON backup export and import, with a key-free guarantee, a dry-run preview, and schema migrations.
- Persistent-storage status and a last-backup reminder.
- PWA install: manifest, service worker, and an iOS Add-to-Home-Screen tip.

Requirements: PLAT-01..06.

Live "test key" calls are only stubbed here as a pluggable `testKey(provider)` hook. They are finished by Phase 4 (RentCast) and Phase 5 (AI providers).

</domain>

<decisions>
## Implementation Decisions

The owner chose fully autonomous mode on 2026-10-04. The researched recommended defaults are adopted.

### Key vault & storage modes
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

### Data layer & backup
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

### PWA
- **Install files:** `manifest.webmanifest` plus self-hosted icons, generated from brand tokens (simple text-mark icon; no SVG logo in v1).
- **Service worker** uses SvelteKit's `src/service-worker` with an app-shell cache-first strategy for build assets and prerendered pages.
  - It never caches API responses, which belong to Phase 4's IndexedDB cache, and never touches requests carrying keys.
  - It must be compatible with the meta CSP (served from `'self'`) and the sub-path base.
- **Install affordance:** an "Install app" button on browsers that fire `beforeinstallprompt`, and an Add-to-Home-Screen tip on iOS Safari (detected).

### Settings UX
- **One Settings page** (`/settings/`) with sections: API keys, Security (remember/passphrase), Backup & restore, Storage status, Install app.
- **Destructive actions** (forget keys, replace import) use an accessible confirmation step, not `window.confirm`.
- **Every state is announced** (saved, locked, unlocked, forgotten, import done) via a polite live region.

### Claude's Discretion
- Exact Dexie table layout for future phases (define the base and repo pattern only; portal tables arrive with their phases).
- The PBKDF2 iteration count (≥600k).
- The rate-limit on passphrase attempts.
- The backup filename format.
- The service-worker cache naming and versioning.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Empty module dirs reserved in Phase 1: `apps/web/src/lib/storage/`, `lib/security/`, `lib/features/shared/`.
- `packages/core` (pure TS, network-blocked tests) is the home for schemas, migrations, and diff logic.
- Brand tokens and the layout and footer come from Phase 2 (`packages/brand`, `app.css @theme`). Phase 3 UI consumes them.
- `/settings/` is a prerendered placeholder route already linked from the app nav.

### Established Patterns
- Static prerendered SvelteKit 2 with Svelte 5 runes and a strict meta CSP (hash mode; `connect-src` already lists provider hosts).
- Unit tests block network via Vitest `setupFiles`. The fetch ban is lint-enforced.
- E2E runs on root and sub-path bases (ports 4273-4275), with axe on every route.
- The real-data guard and gitleaks run in `pnpm verify`.

### Integration Points
- The vault API (`getKey(provider)`, `setKey`, `forgetAll`, `lock`/`unlock`, `onChange`) is consumed by Phase 4's RentCast gateway and Phase 5's AI providers.
- The backup registry: each later phase registers its tables for export and import.
- The service worker registers in the root layout. Manifest links go in `app.html` (`'self'`).

</code_context>

<specifics>
## Specific Ideas

- Copy is honest about limits: a passphrase protects keys at rest on this device, not against malicious scripts. The origin isolation and CSP from Phase 1 are the real defense.
- iOS has a 7-day eviction risk, so the backup reminder and the persist() status are first-class, not hidden.

</specifics>

<deferred>
## Deferred Ideas

- Cross-device sync and accounts (PLAT-V2-01).
- Biometric/WebAuthn unlock (post-v1).

</deferred>
