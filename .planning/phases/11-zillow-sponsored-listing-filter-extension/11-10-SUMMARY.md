---
phase: 11-zillow-sponsored-listing-filter-extension
plan: 10
subsystem: extension
tags: [wxt, mv3, content-script, badge, service-worker, oracle]
requires:
  - 11-01 (messages, settings, config)
  - 11-06 (assert-extension oracle)
  - 11-08 (startFilter controller)
  - 11-09 (popup)
provides:
  - Real WXT content entrypoint (thin) over wireContent
  - Badge service worker (per-tab dimmed count)
  - First production build + zip passing the oracle
affects:
  - 11-11 / 11-12 (E2E and release use the production output)
tech-stack:
  added: []
  patterns:
    - "Entrypoint body extracted to a DI'd lib function (wireContent) so it is unit-tested with hand fakes"
    - "Badge API calls wrapped in a quiet() catch so a tab closing mid-update never rejects unhandled"
key-files:
  created:
    - apps/extension/src/lib/badge.ts
    - apps/extension/src/lib/content-wiring.ts
    - apps/extension/src/entrypoints/background.ts
    - apps/extension/tests/badge.test.ts
    - apps/extension/tests/content-wiring.test.ts
  modified:
    - apps/extension/src/entrypoints/zillow.content/index.ts
    - apps/extension/wxt.config.ts
    - scripts/assert-extension.mjs
    - scripts/assert-extension.test.ts
decisions:
  - "Vite modulepreload polyfill disabled (build.modulePreload.polyfill=false) to remove fetch( from the popup chunk at the source"
  - "Oracle URL_ALLOWLIST gains two exact full-URL entries for the wxt/browser shim's developer error text; tests prove other github.com / wxt.dev URLs are still reported"
  - "browser.runtime satisfies RuntimeLike with no cast (listener typed as ReturnType<typeof createResponder>)"
metrics:
  duration: ~8 min
  completed: 2026-10-25
  tasks: 2
  files: 9
---

# Phase 11 Plan 10: Content + Badge Wiring and Production Oracle Summary

The real WXT entrypoints are now in place. A thin `zillow.content` script imports the manifest CSS and calls the DI'd `wireContent`, which runs `startFilter` with ctx timers and `wxt:locationchange`, registers one get-count responder, swallows rejected pushes, and calls `stop()` when the context is invalidated. A badge-only service worker shows the per-tab count in espresso/ivory. The first production build and its zip pass the 11-06 oracle after the three deferred 11-09 findings were fixed.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Badge module, background worker, thin content entrypoint (TDD) | ec96be1 (RED), 0a8bcf5 (GREEN) |
| 2 | Production build + zip through the oracle | 96f6b80, 0ae70e4 |

## Verification

- `corepack pnpm vitest run --project extension`: 17 files, 240 tests pass (includes badge + content-wiring suites)
- `corepack pnpm vitest run --project scripts assert-extension`: 65 tests pass
- `corepack pnpm --filter extension check`: 0 errors; `corepack pnpm lint`: clean
- `corepack pnpm --filter extension zip && node scripts/assert-extension.mjs apps/extension/.output/chrome-mv3 --zip-dir apps/extension/.output` printed `Extension oracle passed (6 files scanned in apps/extension/.output/chrome-mv3, zip root verified)`
- Zip: `apps/extension/.output/sponsored-listing-filter-0.1.0-chrome.zip`
- Acceptance greps: `return true` in background.ts = 0; `createShadowRootUi|createIntegratedUi|cssInjectionMode` in the content entry = 0

## Final production manifest (`apps/extension/.output/chrome-mv3/manifest.json`)

```json
{"manifest_version":3,"name":"Sponsored Listing Filter — for Zillow","description":"Dims sponsored listing cards in Zillow search results. Show any card with one click. Collects nothing, sends nothing.","version":"0.1.0","short_name":"Sponsored Filter","icons":{"16":"icon/16.png","32":"icon/32.png","48":"icon/48.png","128":"icon/128.png"},"permissions":["storage"],"host_permissions":["*://*.zillow.com/*"],"action":{"default_title":"Sponsored Listing Filter","default_icon":{"16":"icon/16.png","32":"icon/32.png"},"default_popup":"popup.html"},"content_security_policy":{"extension_pages":"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"},"background":{"service_worker":"background.js"},"content_scripts":[{"matches":["*://*.zillow.com/*"],"run_at":"document_idle","css":["content-scripts/zillow.css"],"js":["content-scripts/zillow.js"]}]}
```

Checked by eye: permissions `["storage"]` only; no `tabs`, `scripting`, `web_accessible_resources` or `<all_urls>`; `connect-src 'none'`; one content script with `css`; background is exactly `{ service_worker: "background.js" }` (WXT emitted no `type` key). The manifest needed no changes, and none of the oracle's manifest expectations changed.

## Deferred findings from 11-09: resolution

1. **`chunks/popup-*.js: network token fetch(`.** This was Vite's modulepreload polyfill (`function n(e){...fetch(e.href,n)}`). Fixed at the source with `vite: () => ({ build: { assetsInlineLimit: 0, modulePreload: { polyfill: false } } })` in `apps/extension/wxt.config.ts` (96f6b80). After the rebuild the popup chunk has no `fetch(`. MV3 Chrome supports modulepreload natively.
2. **`URL not on allowlist: https://github.com/wxt-dev/wxt/issues/371`.**
3. **`URL not on allowlist: https://wxt.dev/guide/go-further/testing.html`.** Both appear in the popup chunk and in `content-scripts/zillow.js`. They are inert developer error text from the `wxt/browser` shim (`- If thrown during a build, see https://github.com/wxt-dev/wxt/issues/371` / `- If thrown during tests, mock 'wxt/browser' correctly. See https://wxt.dev/guide/go-further/testing.html`) and are never fetched. They are now allowlisted as exact full URLs, each with a one-line comment (0ae70e4). New tests:
   - both URLs are in the locked-contract assertion and the allowlisted-URL `test.each`
   - the error text exactly as bundled passes `scanBundle`
   - sibling URLs (`https://github.com/wxt-dev/wxt/releases/x`, `https://github.com/evil/repo`, `https://wxt.dev/api/x`) are still reported. This proves the entries do not open whole hosts.

No network-token exemptions were added. `NETWORK_TOKENS`, the manifest expectations and the zip checks are unchanged.

## Deviations from Plan

- **[Rule 2 - Robustness] Badge calls swallow rejections.** `applyBadge`/`initBadgeColors` wrap each `browser.action` call in a `quiet()` catch. Without it, a tab that closes between the push and the update would cause an unhandled rejection in the worker. A test covers this.
- **The listener type uses `ReturnType<typeof createResponder>`** instead of the plan's `(...a: never[]) => unknown`. `browser.runtime` satisfies `RuntimeLike` with no cast (svelte-check is clean).
- **Task 2 needed two commits:** a config fix and an oracle allowlist change. Both were pre-authorised by deferred-items.md and the plan's URL rule.

## Known Stubs

None.

## Notes

- `tasks/lessons.md` was already modified in the working tree by something outside this plan. It was left untouched and was not staged.
- Nothing was pushed or tagged. The repo has no remote.

## Self-Check: PASSED

- FOUND: apps/extension/src/lib/badge.ts, src/lib/content-wiring.ts, src/entrypoints/background.ts, tests/badge.test.ts, tests/content-wiring.test.ts, .output/sponsored-listing-filter-0.1.0-chrome.zip
- FOUND commits: ec96be1, 0a8bcf5, 96f6b80, 0ae70e4
