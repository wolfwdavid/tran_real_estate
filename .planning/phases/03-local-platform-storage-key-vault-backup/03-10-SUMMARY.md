---
phase: 03-local-platform-storage-key-vault-backup
plan: 10
subsystem: ui
tags: [settings, a11y, live-region, alert-dialog, bits-ui, hydration, broadcastchannel, playwright]

requires:
  - phase: 02-brand-system-marketing-legal-pages
    provides: root/(app) layouts, Settings placeholder with the CSP transition probe, tokens
  - phase: 03-04
    provides: getVault, createVaultState, Vault.onChange/forgetAll, VaultStatus
  - phase: 03-05
    provides: getDb, openDb, StorageBlockedError
  - phase: 03-06
    provides: shadcn primitives (alert-dialog, button, input, label, alert)
provides:
  - SETTINGS_SECTIONS fixed 8-slot registry + availableSections()
  - root LiveAnnouncer + announce()
  - Settings context (ready/storageBlocked/vault/vaultStatus/db) filled by dynamic import in onMount
  - ConfirmDialog, SecretInput, SectionError, StorageBlockedAlert, ForgetAllDialog
  - five section stubs (api-keys, key-security, backup, storage, install) for 03-11..03-14
  - E2E helpers (openSettings, stubStorage, cspCollector, announcer, saveKey, fakeKey)
affects: [03-11, 03-12, 03-13, 03-14, 04, 05, 10]

tech-stack:
  added: []
  patterns:
    - "Settings sections read getSettingsContext(); static copy prerenders, live state waits on ctx.ready"
    - "Browser-only modules enter Settings via dynamic import() in onMount; types via import type only"
    - "All state-change announcements go through announce() (one polite region; never role=alert)"

key-files:
  created:
    - apps/web/src/lib/components/a11y/announcer.svelte.ts
    - apps/web/src/lib/components/a11y/LiveAnnouncer.svelte
    - apps/web/src/lib/features/shared/settings/sections.ts
    - apps/web/src/lib/features/shared/settings/sections.test.ts
    - apps/web/src/lib/features/shared/settings/settings-context.svelte.ts
    - apps/web/src/lib/features/shared/settings/SettingsNav.svelte
    - apps/web/src/lib/features/shared/settings/ConfirmDialog.svelte
    - apps/web/src/lib/features/shared/settings/SecretInput.svelte
    - apps/web/src/lib/features/shared/settings/SectionError.svelte
    - apps/web/src/lib/features/shared/settings/StorageBlockedAlert.svelte
    - apps/web/src/lib/features/shared/settings/ForgetAllDialog.svelte
    - apps/web/src/lib/features/shared/settings/ApiKeysSection.svelte
    - apps/web/src/lib/features/shared/settings/KeySecuritySection.svelte
    - apps/web/src/lib/features/shared/settings/BackupSection.svelte
    - apps/web/src/lib/features/shared/settings/StorageSection.svelte
    - apps/web/src/lib/features/shared/settings/InstallSection.svelte
    - apps/web/tests/e2e/helpers/settings.ts
    - apps/web/tests/e2e/settings-shell.spec.ts
  modified:
    - apps/web/src/routes/+layout.svelte
    - apps/web/src/routes/(app)/settings/+page.svelte

key-decisions:
  - "Settings container carries data-settings-page; openSettings waits on [data-settings-page][data-hydrated=true] because PortalSwitcher already uses data-hydrated"
  - "SectionError renders the Alert primitive with role={null}: Phase 3 never uses role=alert; it announces once via the polite LiveAnnouncer (announceOnMount prop, default true)"
  - "ConfirmDialog confirm is a plain Button (not AlertDialog.Action) so busy state controls closing; onError prop optional, otherwise the error is rethrown and the dialog stays open"
  - "ForgetAllDialog moves focus to #api-keys-heading through ConfirmDialog's onCloseAutoFocus override (preventDefault) instead of racing bits-ui's focus return"
  - "CSP probe moved into StorageSection as the 'What counts as Tran's data?' disclosure, rendered without a ctx.ready guard so it prerenders"

patterns-established:
  - "Adding a later-phase section: flip `available` in sections.ts and add the component to SECTION_COMPONENTS in the Settings page"

requirements-completed: [PLAT-01, PLAT-05]

duration: 11min
completed: 2026-10-05
---

# Phase 3 Plan 10: Settings Shell Summary

**Prerendered Settings shell in the fixed 8-slot cross-phase order, with a single root polite live region, lazily imported vault/Dexie context, an accessible Cancel-first ConfirmDialog, SecretInput, forget-all flow, cross-tab announcements, and shared E2E helpers.**

## Performance

- **Duration:** about 11 min
- **Completed:** 2026-10-05
- **Tasks:** 3
- **Files modified:** 20

## Registry API (for Phases 4, 5 and 10)

`apps/web/src/lib/features/shared/settings/sections.ts`:

```ts
interface SettingsSection { id: string; label: string; owner: 3 | 4 | 5 | 10; available: boolean }
SETTINGS_SECTIONS // frozen, 8 entries in order:
// api-keys(3) · rentcast-usage(4, reserved) · ai-drafting(5, reserved) · key-security(3)
// · backup(3) · storage(3) · install(3) · getting-started(10, reserved)
availableSections() // entries with available === true, registry order
```

To ship a reserved slot: set `available: true` in `sections.ts`, then add `'<id>': YourSection` to `SECTION_COMPONENTS` in `apps/web/src/routes/(app)/settings/+page.svelte`. The page renders `availableSections()` filtered to mapped components, so order always comes from the registry. Never reorder or rename entries. Section components render `<section id="{id}" aria-labelledby="{id}-heading">` with `<h2 id="{id}-heading" tabindex="-1">`.

## Component kit

- `$lib/components/a11y/announcer.svelte.ts`: `announce(message)` (clears the text, then sets it on the next rAF so repeats re-announce). `LiveAnnouncer.svelte` is rendered once in the root `+layout.svelte`.
- `settings-context.svelte.ts`: `getSettingsContext()` returns `{ ready, storageBlocked, vault, vaultStatus, db }`. `vaultStatus` updates on every vault change. `db` stays null when storage is blocked.
- `ConfirmDialog.svelte`: props `open` (bindable), `title`, `body: string[]`, `confirmLabel`, `confirmBusyLabel`, `cancelLabel`, `onConfirm: () => Promise<void>`, `onError?`, `onCloseAutoFocus?`, `trigger` snippet `({ props })`. The caller spreads `props` onto its Button.
- `SecretInput.svelte`: props `id`, `label`, `value` (bindable), `helper?`, `error?`, `autocomplete`, `showLabel = 'Show key'`, `digits`, `disabled`, `inputRef` (bindable). Exported `hide()`.
- `SectionError.svelte`: props `title`, `body`, `focusOnMount`, `announceOnMount = true`, `class`.
- `StorageBlockedAlert.svelte`: page-level alert, rendered when `ctx.storageBlocked`.
- `ForgetAllDialog.svelte`: props `triggerClass?`, `onError?`. Calls `vault.forgetAll()`, announces "All API keys forgotten.", and focuses `#api-keys-heading`.
- E2E: `apps/web/tests/e2e/helpers/settings.ts`.

## Task Commits

1. **Task 1 RED: section registry tests** - `df9c320` (test)
2. **Task 1 GREEN: announcer, registry, shared components** - `cde6870` (feat)
3. **Task 2: settings page shell, context, forget-all, stubs** - `da10c5c` (feat)
4. **Task 3: E2E helpers and shell spec** - `612175d` (test)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `data-hydrated` collided with PortalSwitcher**
- **Found during:** Task 3
- **Issue:** The header's `PortalSwitcher` nav already sets `data-hydrated`. `[data-hydrated="true"]` matched two elements, so `toBeAttached()` failed in strict mode.
- **Fix:** Added a `data-settings-page` marker on the Settings container. `openSettings` now waits on `[data-settings-page][data-hydrated="true"]`.
- **Files modified:** `+page.svelte`, `helpers/settings.ts`
- **Commit:** `612175d`

**2. [Rule 1 - Bug] Live-region count included SvelteKit's route announcer**
- **Issue:** Kit renders its own `#svelte-announcer` (`aria-live="assertive"`).
- **Fix:** The spec counts `[aria-live]:not(#svelte-announcer)` and expects exactly 1.
- **Commit:** `612175d`

**3. [Rule 2 - A11y] SectionError drops the primitive's `role="alert"`**
- **Issue:** The UI-SPEC says no `role="alert"` or assertive region is used in Phase 3. The Alert primitive hard-codes `role="alert"`.
- **Fix:** SectionError passes `role={null}` and announces once through the LiveAnnouncer.
- **Commit:** `cde6870`

**4. [Rule 1 - Bug] Focus after forget-all**
- **Issue:** A microtask focus would race bits-ui's focus return to the trigger.
- **Fix:** ConfirmDialog gained an `onCloseAutoFocus` pass-through. ForgetAllDialog prevents the default and focuses the heading.
- **Commit:** `da10c5c`

**5. Minor:** Prettier rewrites `autocomplete={autocomplete}` to the `{autocomplete}` shorthand. The behaviour is the same, but the literal acceptance grep string does not appear. `confirm()` inside ConfirmDialog was renamed `runConfirm()` so it does not shadow the global and the `confirm(` grep stays clean.

## Verification

- `vitest run --project web settings/sections`: 7/7 pass. `pnpm test:unit`: 559/559 pass.
- `check`: 0 errors in this plan's files. Mid-run, the only errors came from parallel 03-07's in-progress `vault-lock.test.ts`, which is out of scope. `lint` (on this plan's files), `banned` and `ui:guard` all pass.
- `build:root`, `build:sub` and `csp:assert` pass for 14 pages on each base. `build/settings/index.html` contains "Checking this browser" (×5), `csp-transition-toggle`, `id="api-keys"` and `id="install"`, and has no `id="rentcast-usage"`.
- `playwright test settings-shell csp routing a11y`: 86/86 pass. The full `test:e2e` run passes 336/336 on root and sub, which shows the Phase 1 CSP probe still works.

## Known Stubs

These are intentional and owned by later plans:
- `ApiKeysSection.svelte`, `KeySecuritySection.svelte`, `BackupSection.svelte`, `StorageSection.svelte` and `InstallSection.svelte` render only the heading, the static intro and the "Checking this browser…" line. 03-11 to 03-14 replace their bodies.
- `saveKey` in the E2E helpers assumes 03-11's card is a `<form>` with a "{label} API key" field and a "Save key" button.

## Self-Check: PASSED
