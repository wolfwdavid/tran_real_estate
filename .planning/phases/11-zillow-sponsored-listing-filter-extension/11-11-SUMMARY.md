---
phase: 11-zillow-sponsored-listing-filter-extension
plan: 11
subsystem: extension
tags: [playwright, e2e, mv3, chromium, zero-network, csp]
requires:
  - 11-10 (production build apps/extension/.output/chrome-mv3 + oracle)
  - 11-03 (fixtures A and C)
provides:
  - Extension Playwright config (no webServer, System32 PATH guard, SW network events)
  - Synthetic zillow.com page builder (routed, never served)
  - 7-test runtime spec against the production build, including a monitored zero-network session
affects:
  - 11-12 (CI wiring of `corepack pnpm --filter extension e2e`; live zillow.com smoke stays HUMAN-UAT)
tech-stack:
  added: []
  patterns:
    - "Persistent Chromium context with --disable-extensions-except/--load-extension, channel 'chromium' new headless"
    - "Context route fulfils exactly one URL and aborts every other http(s) request; aborted requests are still recorded"
    - "Planted-violation controls inside the zero-network test so the assertion cannot pass vacuously"
key-files:
  created:
    - apps/extension/playwright.config.ts
    - apps/extension/e2e/zillow-page.ts
    - apps/extension/e2e/extension.spec.ts
  modified: []
decisions:
  - "Headless mode works: channel 'chromium' + headless: true loads the MV3 extension and its service worker on Windows; the headed fallback (off-CI only) was never needed"
  - "Worker-side chrome.* calls are typed with a small local WorkerChrome interface instead of adding @types/chrome"
  - "The two deliberate control fetches carry targeted eslint-disable-next-line comments (the repo-wide fetch ban covers e2e files)"
metrics:
  duration: ~12 min
  completed: 2026-10-25
  tasks: 2
  files: 3
---

# Phase 11 Plan 11: Production Extension E2E Summary

The production extension (`wxt build` output in `apps/extension/.output/chrome-mv3`) now runs end to end in real Chromium. The tests cover dimming with the closed-shadow pill, one-click reveal, late-inserted cards, SPA navigation, real `tabs.sendMessage` count messaging, the toolbar badge, and the popup under its production CSP with a working toggle. A monitored session records zero extension network traffic, and two planted-violation controls show that assertion is not vacuous.

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 | Playwright config and synthetic Zillow page | 0da4ab7 |
| 2 | Runtime spec: dim, reveal, late insert, SPA nav, toggle, messaging, badge, zero network | efd743d |

## Run facts

- **Mode:** headless (`channel: 'chromium'`, `headless: true`). The service worker appeared immediately and the headed fallback never ran. Extension id: `mopeohdagfbpgcaeanjhfomiaeoeamkb`.
- **Run time:** the 7 tests take about 2.1-3.4 s; the whole command takes about 4.4 s wall time.
- **Flake check:** `corepack pnpm --filter extension e2e` was run 4 times against the final spec. All were 7/7 green, including two back-to-back runs.
- **Browser:** the installed Playwright 1.63.0 Chromium was reused. Nothing was downloaded.

## Verification

- `corepack pnpm --filter extension build` followed by `node scripts/assert-extension.mjs apps/extension/.output/chrome-mv3` printed `Extension oracle passed`.
- `corepack pnpm --filter extension e2e`: 7 passed.
- `corepack pnpm --filter extension check`: 0 errors. `corepack pnpm lint`: exit 0. `corepack pnpm vitest run --project extension`: 240 passed (e2e is excluded from the unit suite).
- Acceptance greps found all required tokens (`--load-extension`, `launchPersistentContext`, `tran-slf:get-count`, `getBadgeText`, `history.pushState`, `Content Security Policy`, `chrome-extension://`, `route.abort()`). `test.skip|test.fixme` = 0. The config contains `System32`, `testDir: 'e2e'` and `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS`, and has no `webServer`.

## Zero-network proof: controls

- **Permanent, in the spec, page frame:** after the session is asserted clean, the page issues a fetch to `https://planted-control.invalid/probe`. The test requires the recorder to capture it and flag it as the only violation. Content-script requests show up in this same page frame.
- **Permanent, in the spec, worker:** a fetch from the service worker must be rejected, and nothing new may be recorded. In the production build, `connect-src 'none'` blocks it before any request exists.
- **One-off, not committed, planted content script:** I appended `fetch("https://planted.invalid/content-script")` to the built `content-scripts/zillow.js` and re-ran the suite. The zero-network test went RED with `https://planted.invalid/content-script (from https://www.zillow.com/homes/for_rent/)`. I then rebuilt the bundle.
- **One-off, not committed, recorder probe:** with the manifest CSP removed in a scratch copy, a worker fetch IS recorded with `serviceWorker()` set. With the production CSP it is rejected (`TypeError: Failed to fetch`) and nothing is recorded. So the recorder does see workers, and the production CSP stops worker traffic before it reaches the network.

## Deviations from Plan

- **[Rule 2 - Correctness] Planted-violation controls in the zero-network test.** The plan only asserted an empty violation list, which would also pass if the recorder captured nothing. The test now also requires that recorded traffic exists (the synthetic document plus extension resources). It runs the page and worker controls described above.
- **[Rule 3 - Blocking] `chrome` global untyped in svelte-check.** I added a local `WorkerChrome` interface instead of a new dependency, so package.json and the lockfile are unchanged.
- **[Rule 3 - Blocking] Repo-wide fetch lint ban.** The two deliberate control fetches carry targeted `eslint-disable-next-line no-restricted-syntax` comments with reasons.
- **Additional assertions beyond the plan:**
  - after a reveal, the article's opacity is back to 1
  - c-4 and c-5 stay clean after SPA navigation
  - the popup toggle is enabled and checked, and toggles to unchecked
  - the popup has no console errors or page errors
  - `reducedMotion: 'reduce'` is set, so the 150 ms opacity transition cannot make the computed-style check flaky
- **Route fallback:** non-http(s) requests (`chrome-extension://`) use `route.fallback()` so extension pages load normally. Every other http(s) request is aborted.

## Known Stubs

None.

## Notes

- I did not hit zillow.com. The live-site smoke check stays an owner HUMAN-UAT item (11-12).
- Nothing was pushed or tagged. The repo has no remote.

## Self-Check: PASSED

- FOUND: apps/extension/playwright.config.ts, apps/extension/e2e/zillow-page.ts, apps/extension/e2e/extension.spec.ts
- FOUND commits: 0da4ab7, efd743d
