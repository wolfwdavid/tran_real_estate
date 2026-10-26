# Phase 11 Deferred Items

## From 11-09 (toolbar popup)

The 11-09 production build compiles, but `node scripts/assert-extension.mjs apps/extension/.output/chrome-mv3` reports three findings in the popup chunk. 11-10's job is to run the oracle on the first real production build, so these are passed to 11-10. They are not fixed here because the fix belongs in the shared `wxt.config.ts` or the oracle allowlist.

1. `chunks/popup-*.js: network token fetch(`. This is Vite's modulepreload polyfill (`fetch(e.href, n)` for `<link rel=modulepreload>`), not popup code. Fix it at the source: set `vite: () => ({ build: { assetsInlineLimit: 0, modulePreload: { polyfill: false } } })` in `apps/extension/wxt.config.ts`. MV3 Chrome supports modulepreload natively, and the popup CSP sets `connect-src 'none'` anyway.
2. `URL not on allowlist: https://github.com/wxt-dev/wxt/issues/371` and `https://wxt.dev/guide/go-further/testing.html`. These are inert error-message strings from WXT's `browser`/storage runtime, pulled in by `deps.ts` → `wxt/browser` and `settings.ts` → `wxt/utils/storage`. Under 11-10's rule they are documentation strings, so the fix is the narrowest exact-prefix allowlist entries, each with a test.

The other two findings at that time (`content_scripts[0].css` missing, `background` missing) belong to the content-script and background plans, not the popup.
