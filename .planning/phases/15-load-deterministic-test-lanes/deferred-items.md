# Phase 15 deferred items

## D-10 (carried from Phase 14): live-smoke HTTP 429 hardening

- **Source:** `14-CONTEXT.md` D-10: "map 429 on navigation to the exit-2 precondition path of
  `scripts/smoke.mjs`, zero retries otherwise", deferred "to Phase 15".
- **Decision (planning, 2026-11-06):** NOT planned in Phase 15. Recorded here so it is not dropped.
- **Why it does not fit this phase:**
  1. No TEST-01..06 requirement covers it. Phase 15 is about determinism under local CPU load;
     D-10 is about how the live smoke classifies a Pages CDN rate-limit response.
  2. It can only be verified against the live origin (a real 429 from the Pages CDN). The Phase 15
     evidence protocol runs locally and cannot exercise it, so it would ship unproven.
  3. It touches `scripts/smoke.mjs` and the smoke specs under `apps/web/tests/smoke/`, which no
     Phase 15 plan otherwise edits (Phase 15 annotates timeouts in `tests/smoke/fixtures.ts` only).
- **Pointer (next home):** insert a decimal phase before Phase 16 (`/gsd:insert-phase 15`, giving
  Phase 15.1 "Live-smoke 429 classification"). Phase 16 closes with a deploy and a green live smoke,
  which is the next run that can meet a CDN 429, and Phase 16 forbids anything else in flight.
  If the owner prefers, it can instead ride with Phase 17 (it also deploys).
- **Definition of done for whoever picks it up:** a 429 on any smoke navigation exits 2 (precondition,
  "CDN rate-limited, re-dispatch once per lessons 2026-10-31") instead of 1; zero retries added; a
  scripts-project unit test plants a 429 response and asserts exit 2; any other status keeps exit 1.

## 15-01: browser-project startup "Failed to fetch dynamically imported module" (pre-existing, load-correlated)

- **Seen:** 2026-11-09, two of five full `pnpm test:unit` runs while plans 15-02 and 15-03 executed in
  parallel on the same machine (38-51 Chromium processes alive). Run 1: 2 files (DataShell in
  `web-browser`, OutreachSection in `web-browser-serial`); run 2: 7 `web-browser` files. Every failing
  file was among the first files its browser project loaded (`(0 test)` at project startup); every
  later file in the same project passed. Tests themselves never ran.
- **Not reproduced:** both browser projects alone, warm cache (34/34, 42 s) and cold cache
  (`rm -rf apps/web/node_modules/.vite`, 34/34, 63.7 s); and the full suite in the next three runs
  (360/360). Prior sighting: 09-23 SUMMARY, once, recorded as a host-suspend transient.
- **Not caused by the lanes:** the parallel browser project ran 12 tabs before 15-01 and 8 after; the
  serial browser project failed only once, on its very first (cold) start. The Vite optimizer logged
  no mid-run re-bundle in either failing run.
- **Candidate causes to test (not done here, out of 15-01 scope):** Vite dev-server request handling
  at browser-project startup under CPU starvation (8 iframes importing the full module graph while 8
  forks and sibling Chromium instances compete); cross-process interaction on Vitest's default browser
  port 63315 when two Vitest processes with browser projects start at the same time.
- **Pointer:** 15-10 evidence protocol (3 consecutive clean `pnpm verify`, CPU-pressure run) is the
  natural place to see whether it recurs on an otherwise idle machine. If it does, root-cause before
  classifying; never add a retry.
- **ROOT CAUSE FOUND 2026-11-09 by 15-10 (host network, not the repository):** the dev machine's
  Intel Wi-Fi 7 BE201 adapter (Netwaw18 driver 24.20.0.4, 2026-01-06) drops and re-joins the WLAN
  every 1-3 minutes under load (WLAN-AutoConfig event 8003 "The network is disconnected by the
  driver", 8001 reconnect 3-5 s later; 42 drops in the 5 h before 09:17Z). Each drop fires a Windows
  network-state change and Chromium's NetworkChangeNotifier aborts every in-flight request, loopback
  included, with `net::ERR_NETWORK_CHANGED`; a module graph loading at that instant fails with
  `Failed to fetch dynamically imported module`. 15-10's first `pnpm verify` had 12 E2E failures
  (pages stuck on `<html hidden>` or SvelteKit's `Internal Error` page) and every one started within
  0.5-1.7 s of a logged drop; 15-01's three sightings (06:50Z, 06:59Z, 07:29Z) match drops at
  06:50:42, 06:59:44 and 07:29:18. Neither Vitest browser mode nor the lanes are involved. No repo
  fix (a retry would hide it); the protocol needs a stable host network. Longer-term the app could
  recover from a failed chunk load (SvelteKit's version-skew reload only fires on navigation), which
  is a product decision for a later phase, not a test change.

## 15-10: the 16-thread pressure run fails five tests at the 5 s edge of a lazy chunk load

- **Seen:** 2026-11-10, 15-10 attempt 2 at 194b07f on a stable network (0 WLAN 8003 events from
  17:01Z to 19:54Z). Steps 1 (three `pnpm verify`, all green), 2 (repeat-each 3 on all 12
  load-sensitive specs, 0 failed / 0 flaky; serial lane x3 green) and 4 (shuffle, seed
  `1794340461`, green) passed. Step 3, `pnpm test:e2e` under `cpu-burn --threads 16` on 16 CPUs
  with 4 workers: `5 failed`, `4 skipped`, `2345 passed (43.3m)`. Failures: guide.spec.ts:46 (root),
  renter-map.spec.ts:141 and :350 (root), ai-drafting.spec.ts:106 (sub), studio-keyless.spec.ts:380
  (sub). Every one is a default 5 s expectation that spans the delivery of lazily imported module
  chunks (tour panel, Leaflet, data layer, settings hydration, the print route's nodes).
- **Root cause (host starvation, not the repository):** in the guide trace the click fired at
  +3.31 s and `import('./TourPanel.svelte')` requested three chunks (318-4681 bytes, loopback) that
  Chromium recorded at 2583, 5012 and 5013 ms, so the import resolved about 30 ms after the expect
  expired; the first 28 chunks of the same page load took about 15 ms each under the same burner.
  The static server is exonerated: with the 16-thread burner running and four concurrent 383-file
  precache storms (fresh TCP connection per request) `scripts/serve-pages.mjs` answered a probe
  chunk at p50 3.0 ms / p90 3.9 ms / max 119 ms (`.tools/test-evidence/diag-server-latency.log`).
  The 2.5-5 s request times sit in Chromium's network path under 16 burner threads plus four
  browsers on 16 CPUs: the starvation class 15-RESEARCH called "not a fair zero-failure target" at
  40 burners, reached at 16 on this machine with the current 2354-test suite (10-23 saw 0 failures
  at 16 with a smaller suite).
- **Reproduced under artificial delay (lessons 2026-10-13):** a scratch spec that `page.route`-delays
  every `_app/immutable/chunks/*.js` request after the tile click fails identically at 5100 ms
  (`toBeFocused` ... element(s) not found, 5000 ms) and passes at 4000 ms. No race, no stale write;
  the `version` guard in `GetStartedGuide.svelte` is intact and the click is by design gated on the
  lazy panel import.
- **Not fixed here:** a timeout raise or a retry is forbidden by 15-10; a serve-pages change is
  refuted by the measurement; a lower burner count changes the pressure level written into the
  plan's must-haves and is an owner decision (options recorded in the 15-10 checkpoint). Full facts
  in `.tools/test-evidence/attempt-2.md` (gitignored).

## 15-01: happy-dom iframe warnings in the extension project (pre-existing noise)

- `apps/extension/tests/brand-parity.test.ts:109` and `reconcile.test.ts:167` set `innerHTML` that
  contains an `<iframe>`; happy-dom 21 logs `DOMException [NotSupportedError]: Failed to load iframe
  page "about:blank". Iframe page loading is disabled.` 15 times per full run. Tests pass; the noise
  predates Phase 15 (`.tools/unit-extension.log` from 14-11 shows the same 15 lines). Silence it in
  the extension tests (e.g. happy-dom `settings.disableIframePageLoading` without the console error, or
  strip iframes from the fixture) in a later plan; not a Phase 15 requirement.

## 15-06: the rules module skips multi-line `expect\n.poll(...)` / `expect\n.element(...)` chains

- **Seen:** 2026-11-09 while listing what 15-06 had to annotate. `vitestRaiseSites` in
  `scripts/lib/test-lane-rules.mjs` matches waits with `WAITS.has(callee.getText(sf))`, and `getText()`
  keeps the source whitespace, so a Prettier-wrapped chain (`await expect\n\t\t\t.poll(fn, { timeout })`)
  yields the callee text `expect\n\t\t\t.poll`, which is not in `WAITS`. Two of the eight Inventory A
  raise sites were therefore invisible to the guard: `ResultsView.browser.test.ts` (`timeout: LAZY_MAP_MS`)
  and `calculators.browser.test.ts` (`timeout: 2000`). The checker reported 6 findings, not 8.
- **Proved, not fixed here:** 15-06 annotated both sites anyway and re-ran the rules on a copy of each
  file with the whitespace between `expect` and `.poll` collapsed: 0 findings as annotated, 1 finding
  each with the annotation lines stripped (scratch `collapsed-check.mjs`). So the annotations satisfy
  the rule once the module sees the site.
- **Why not fixed in 15-06:** the plan's files are the seven test files; the module belongs to 15-02 and
  15-09's planted-violation tests assert its behaviour. The fix is one line: build the callee text for
  the `WAITS`/`vi.setConfig` comparison from the AST (`PropertyAccessExpression` -> `root.name`) or
  strip whitespace (`calleeText.replace(/\s+/g, '')`), plus a planted multi-line `expect.poll` case in
  `scripts/test-lane-rules.test.ts`. The same applies to any raise detected by `calleeText ===` /
  `calleeText.endsWith(...)` in the Playwright rules (`describe.configure`, `test.setTimeout`,
  `test.slow`) when Prettier wraps the chain.
- **Pointer:** 15-09 (repo sweep) should land the fix with its planted test before asserting zero
  findings, otherwise the sweep is vacuous for wrapped chains. No timeout value depends on it.
- **RESOLVED 2026-11-09 by 15-09** (commits 17be9f2, 70da4bf): callee names are now built from the AST
  identifier/property chain, and ten planted wrapped-chain cases guard it in
  `scripts/test-lane-rules.test.ts`. The repo sweep in `scripts/test-lanes.test.ts` pins both formerly
  invisible sites (ResultsView, calculators) in `EXPECTED_RAISES`.

## 15-01: Vite "configLoader: 'native'" warning for extension-less imports in the lane configs

- The new configs import `../../tooling/vitest/lanes` and `./vitest.config` without a file extension,
  exactly as planned. Vite 8.3 prints a one-off warning that the future native config loader needs
  extensions. Suppressed in 15-01 logs with `VITE_CONFIG_NATIVE_IGNORE_WARNING=true`; harmless today.
  Phase 16 (Vite/Vitest upgrades) should add `.ts` extensions (needs `allowImportingTsExtensions`) or
  `.js` specifiers in one sweep over all config files.
