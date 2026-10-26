---
phase: 11-zillow-sponsored-listing-filter-extension
plan: 09
subsystem: extension-popup
tags: [svelte5, wxt, popup, a11y, axe, vitest-browser, playwright]
requires:
  - 11-02 (icons: /icon/32.png)
  - 11-05 (popup-model.ts state model, tokens.css, messages, settings)
provides:
  - Toolbar popup entrypoint (popup.html) with 5 UI-SPEC components
  - createBrowserDeps(): the single real-browser wiring module for the popup
  - extension-browser Vitest project (axe over every popup state in real Chromium)
affects:
  - 11-10 (real-build oracle run: popup chunk findings in deferred-items.md)
tech-stack:
  added: []
  patterns:
    - "Dependency-injected Svelte root: App takes PopupDeps by prop, so tests inject every state and only deps.ts imports wxt/browser"
    - "Native checkbox role=switch kept in the a11y tree at opacity 0 over a drawn track; focus ring via input:focus-visible + .track"
    - "Axe in browser mode with the real tokens.css/app.css imported so color-contrast measures shipped colours"
key-files:
  created:
    - apps/extension/src/entrypoints/popup/index.html
    - apps/extension/src/entrypoints/popup/main.ts
    - apps/extension/src/entrypoints/popup/app.css
    - apps/extension/src/entrypoints/popup/deps.ts
    - apps/extension/src/entrypoints/popup/App.svelte
    - apps/extension/src/entrypoints/popup/components/PopupHeader.svelte
    - apps/extension/src/entrypoints/popup/components/FilterSwitch.svelte
    - apps/extension/src/entrypoints/popup/components/CountStatus.svelte
    - apps/extension/src/entrypoints/popup/components/PrivacyCallout.svelte
    - apps/extension/src/entrypoints/popup/components/PopupFooter.svelte
    - apps/extension/vitest.browser.config.ts
    - apps/extension/tests/browser/popup.browser.test.ts
  modified:
    - .gitignore
decisions:
  - "The On/Off state word is aria-hidden: the switch's accessible name is exactly 'Dim sponsored listings' and role=switch already announces on/off, so screen readers don't hear the state twice"
  - "The toggle is optimistic (the switch moves at once), then loadStatus re-reads the persisted value, so a failed write reverts and a racing count push gets corrected. The input is never disabled mid-toggle, so keyboard focus is never dropped"
  - "The switch is disabled exactly when enabled === null (loading or storage-error), which matches the UI-SPEC disabled contract"
  - "The extension-browser project mirrors the apps/web Windows System32 PATH guard and optimizeDeps entries, to avoid a hung taskkill teardown and a mid-run re-optimize reload"
metrics:
  duration: 11min
  completed: 2026-10-26
  tasks: 2
  files: 13
---

# Phase 11 Plan 09: Toolbar Popup Summary

The Svelte 5 toolbar popup is built to the approved UI-SPEC. It has a persisted "Dim sponsored listings" switch (`role=switch`, On/Off word), a live count or state message, the "Collects nothing, sends nothing." callout, the Zillow non-affiliation notice, and the Privacy details link. All 8 renders (loading, counting 3, counting 1, zero, off, not-zillow, not-running, storage-error) pass axe (wcag2a/2aa/21aa/22aa) with zero violations in real Chromium.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Popup entrypoint, deps wiring, five UI-SPEC components | 06f7d7a | popup/index.html, main.ts, app.css, deps.ts, App.svelte, components/*.svelte |
| 2 | Browser-mode axe test across all popup states | 6cb04ba | vitest.browser.config.ts, tests/browser/popup.browser.test.ts, .gitignore |

## Verification

- `corepack pnpm --filter extension test:browser`: 13/13 pass. That covers 8 state renders (exact copy, both notices, link href/name/target/rel, switch disabled/enabled, axe clean), toggle to Off (`writeEnabled(false)`, the Off word, the off copy, axe clean), the state word hidden while loading, a live push from the active tab updating the count while other tabs are ignored, the listener removed on unmount, and the planted unnamed-button control (axe reports `button-name`).
- Mutation checks, run by hand and reverted:
  - Changing the count text colour to `--color-border` failed 8 tests on axe `color-contrast`, so the real CSS is being measured.
  - Changing `role="switch"` to `checkbox` failed 11 tests.
- `corepack pnpm vitest run --project extension`: 222/222. `corepack pnpm check`: 0 errors (extension + web). `corepack pnpm lint`: prettier + eslint clean (the EXT-03 zero-network ban covers the new .svelte files).
- `corepack pnpm --filter extension build` exits 0, and `.output/chrome-mv3/popup.html` exists with `default_popup` in the manifest and the production popup CSP.
- No `style="` attributes and no hex in popup `.svelte` files. `wxt/browser` is imported only by `deps.ts`.
- The extension-browser config is not in the root `vitest.config.ts` projects. Note: the plan's literal grep "root vitest.config.ts does NOT contain `vitest.browser.config`" would match the existing `apps/web/vitest.browser.config.ts` entry. The intent holds: no extension browser config is listed there.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ignored the extension browser-test attachment directory**
- **Found during:** Task 2 (the mutation runs)
- **Issue:** Failing browser tests write screenshots to `apps/extension/.vitest-attachments/`, which was untracked.
- **Fix:** Added `apps/extension/.vitest-attachments/` next to the existing `apps/web` entry in the root `.gitignore`.
- **Commit:** 6cb04ba

**2. [Rule 2 - A11y] State word aria-hidden; no disable during toggle**
- **Found during:** Task 1
- **Issue:** The `<label>` wraps the On/Off word, so the switch name would be "Dim sponsored listings On", and screen readers would hear the state twice. Disabling the input while a write is pending would also drop keyboard focus.
- **Fix:** Put `aria-hidden="true"` on the state word, and made the toggle optimistic with a reload instead of disabling the input.
- **Commit:** 06f7d7a

### Deferred (out of scope, logged in deferred-items.md for 11-10)

The real-build oracle (`scripts/assert-extension.mjs`, which 11-10 runs on the production output) flags the popup chunk for two reasons:
- Vite's modulepreload polyfill `fetch(`. The fix is `build.modulePreload.polyfill: false` in `wxt.config.ts`.
- Two inert WXT error-message URLs. The fix is narrow allowlist entries.

Both fixes belong to the oracle/config surface that 11-10 owns.

## Known Stubs

None. Every state is wired to `loadStatus`/`applyPush`. The content entry is still the 11-01 stub; 11-08/11-10 replace it.

## Self-Check: PASSED
