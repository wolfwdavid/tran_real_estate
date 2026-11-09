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
