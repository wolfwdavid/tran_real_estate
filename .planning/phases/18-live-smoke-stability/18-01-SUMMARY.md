---
phase: 18-live-smoke-stability
plan: 01
subsystem: testing
tags: [smoke, playwright, github-pages, rate-limit, measurement]

requires:
  - phase: 16-toolchain-pnpm-12-sveltekit-3-vitest-5
    provides: Kit 3 build, service worker blocked outside pwa/assets, 429 navigation evidence (exit 2)
provides:
  - Opt-in request counter in the Pages emulator (SERVE_PAGES_COUNT_FILE)
  - Per-spec request baseline of the current smoke suite on the Kit 3 root build
  - Probe answers for APIRequestContext visibility and cached precache status
affects: [18-02, 18-03, 18-04]

tech-stack:
  added: []
  patterns:
    - "Emulator-side request counting: exact, includes APIRequestContext traffic that Playwright context listeners never see"

key-files:
  created:
    - scripts/lib/request-counter.mjs
    - scripts/request-counter.test.ts
  modified:
    - scripts/serve-pages.mjs

key-decisions:
  - "The count file is written 5 ms after the last request, not only on shutdown: on Windows the parent's exit kills the emulator before its shutdown handlers finish"
  - "An empty or missing count file is a failed measurement to redo, never zero"
  - "SMOKE-07 is advanced (baseline half of roadmap criterion 1), not completed; it closes with the 18-05 proof runs"

patterns-established:
  - "Measure per spec with SERVE_PAGES_COUNT_FILE set to a Windows-style absolute path under .tools/ and subtract the orchestrator's one version.json poll"

requirements-completed: [] # SMOKE-07 advanced only (baseline measured); it is completed by the three proof runs in 18-05

duration: 20min
completed: 2026-11-22
---

# Phase 18 Plan 01: Live Smoke Baseline Summary

**Emulator request counter behind SERVE_PAGES_COUNT_FILE, and a measured Kit 3 baseline of 5,939 requests per smoke run (third-party 56%, 75.8 requests per page load)**

## Performance

- **Duration:** about 20 min
- **Started:** 2026-11-22T13:47Z
- **Completed:** 2026-11-22T14:10Z
- **Tasks:** 3
- **Files modified:** 3 (plus this summary)

## Accomplishments

- `scripts/serve-pages.mjs` counts GET/HEAD requests on the three build mounts when `SERVE_PAGES_COUNT_FILE` is set, and does nothing when it is unset.
- The current, unmodified suite was measured spec by spec on the Kit 3 root build: 5,939 requests for 121 tests.
- Both research open questions are answered by local probes (see Probe results).

## Task Commits

1. **Task 1: opt-in request counter in the emulator, with unit tests** - `6d4e39d` (test), follow-up fix `8f4541c` (fix, see Deviations)
2. **Task 2: rebuild the three targets and measure the baseline per spec** - `26bb461` (docs)
3. **Task 3: local probes for the two open questions** - `bb3ae81` (docs); probe scripts stay under the ignored `.tools/probes/`

## Baseline: requests per spec (root target, Kit 3)

- **Build SHA:** `8f4541ced2fd2e473d19b0f88e38a43352a20b08` (equals `git rev-parse HEAD` and the served `_app/version.json` at measurement time; all three targets rebuilt at this SHA)
- **Method:** one `pnpm smoke:local --target root -- tests/smoke/<spec>.smoke.ts` per spec with `SERVE_PAGES_COUNT_FILE` pointing at a file under `.tools/p18/`, emulator-side count of GET/HEAD on the root site port (4273), minus the orchestrator's single `version.json` poll. The attacker origin is not counted. 4 Playwright workers (local default), service worker blocked outside pwa and assets.
- Every spec was measured twice. All figures were identical between the two runs except routing (see the note under the table).

| Spec | Tests run | Requests | Share of total | Kit 2 figure (16-01, 18-RESEARCH) | Change |
| --- | --- | --- | --- | --- | --- |
| third-party | 44 | 3,337 | 56.2% | 3,216 | +121 |
| pwa | 3 | 841 | 14.2% | 824 | +17 |
| assets | 1 | 742 | 12.5% | 412 + about 370 = about 782 | about -40 |
| seo | 18 | 504 | 8.5% | 478 | +26 |
| routing | 4 | 225 | 3.8% | 217 | +8 |
| a11y | 3 | 177 | 3.0% | 163 | +14 |
| csp | 45 | 45 | 0.8% | about 45 | 0 |
| analytics | 1 | 38 | 0.6% | about 60 for analytics, extension-link and version together | +12 for the three together |
| extension-link | 1 | 33 | 0.6% | (in the 60 above) | |
| version | 1 | 1 | 0.0% | (in the 60 above) | |
| **Sum of the ten specs** | **121** | **5,943** | **100%** | **about 5,700** | **about +240 (4%)** |
| **Full-suite run (no spec filter)** | **121** | **5,939** | | | |

- **Sum versus full suite:** 5,943 against 5,939, measured twice with the same full-suite total both times. The difference of 4 is routing: its page loads are still fetching when the browser closes, so the spec alone measured 223 to 229 over ten runs (225 and 223 in the two table runs).
- **third-party per load:** 3,337 requests over 44 page loads is **75.8 requests per load** on Kit 3 (Kit 2: 73.1). Plan 02 multiplies this figure by its live sample size.
- **pwa:** two installs of the 381-entry precache plus three page loads and the manifest GET; `service-worker.js` was fetched twice.
- **assets:** one install (381 entries) plus one GET per hashed file. The precache holds **322** `/_app/immutable/` entries, not about 370: 287 of them were requested twice (install and the spec's own GET) and 35 three times (page load as well). The spec's own per-hash GET loop is therefore 322 requests.
- **Duration:** the full root suite ran in 13.7 s and 14.2 s against the emulator.
- **Unit tests after the change:** `pnpm vitest run --project scripts` gives 40 files, 1,264 tests passed.

## Probe results

Both probes ran on loopback only (Playwright 1.65.0, Chromium). The scripts are `.tools/probes/probe-a.mjs` and `.tools/probes/probe-b.mjs` (ignored, not committed).

### Probe A: which requests the context listeners see

A stub server on an ephemeral 127.0.0.1 port answered 429 on `/limited` and 200 elsewhere. One browser context had `context.on('request')`, `context.on('response')` and `context.on('requestfailed')` registered. The stub's own log confirms all five requests reached it.

| Case | Call | Status returned | Context request listener saw it | Context response listener saw it |
| --- | --- | --- | --- | --- |
| 1 | `context.request.get('/limited')` | 429 | no | no |
| 2 | `page.request.get('/limited')` | 429 | no | no |
| 3 | standalone `request.newContext()` then `get('/limited')` | 429 | no | no |
| 4 | `page.goto('/limited')` | 429 | yes | yes (`isNavigationRequest()` true) |
| 5 | service worker install, `cache.addAll` over one ok URL plus `/limited` | n/a | yes | yes (status 429, `request().serviceWorker()` set, `isNavigationRequest()` false) |

- **Cases 1 to 3:** APIRequestContext traffic is invisible to the context listeners, requests and responses alike. Assumption A2 is confirmed. The suite's `request` fixture is the case 3 kind.
- **Case 5:** the context listeners see the worker's requests and the 429 response with the default settings (no experimental flag), followed by a `requestfailed` for the same URL. A `page.on('response')` listener does not see it. The install fails fast and does not hang: the worker went from `installing` to `redundant` in 27 ms. The cache key exists afterwards with **zero entries**.

### Probe B: cached precache status

The root build (same SHA as the baseline) was served by `scripts/serve-pages.mjs`, the base was opened with service workers allowed, and after the install every cache key was read with `caches.match` in the page.

- **322 of 322 cached immutable entries have status 200** and `ok === true`.
- All 381 of 381 precache entries have status 200 and `ok === true`; every response type is `basic` (none opaque).
- The check issued zero network requests, and the install took about 0.4 s locally.
- Assumption A4 is confirmed: a cache-status check can replace the per-hash GET loop.

## Findings for later plans

Measured facts that differ from what plans 18-02 and 18-03 assume. Nothing was redesigned here.

1. **18-03, 429 logging needs both mechanisms, a combination the plan does not spell out.** The plan offers "listener sees API traffic, so drop the navigation restriction" or "it does not, so wrap the `request` fixture and keep the navigation branch", and separately Branch A for the worker ("the same unrestricted listener already records it"). Measured: the listener does **not** see API-context responses (wrapper needed) and it **does** see the worker's 429, but only with `isNavigationRequest()` false. Keeping the navigation-only condition next to the wrapper would leave a 429 during the install unlogged. Branch A applies only if the listener condition is widened (unrestricted, or navigation or service worker request).
2. **18-03, what a rate-limited install looks like.** The worker turns redundant within tens of milliseconds and the cache key exists with zero entries, so `installedPrecache` (which waits for one key with entries) would wait its full 20 s and then fail. The 429 itself is visible on the context listener the moment it happens.
3. **18-02, the per-hash GET loop is 322 requests, not about 370.** The plan's wording "the 370 per-hash GETs" overstates the saving by about 48. The precache total is 381 entries.
4. **18-02, third-party costs 75.8 requests per load, not 73.** With the plan's nine-route live sample that is about 682 requests, not the research figure of about 440 for seven routes. A rough projection from these measurements (arithmetic, not a measurement): third-party about 682, one shared install about 421, seo about 20, unchanged specs 519 (version 1, analytics 38, extension-link 33, csp 45, routing 225, a11y 177), in total about 1,640. That is inside the plan's 1,500 to 1,800 target and under its 2,000 stop line.
5. **18-02 and 18-04, how to read the count file.** Set `SERVE_PAGES_COUNT_FILE` to a Windows-style absolute path (`$(pwd -W)/...` in Git Bash). Treat an empty or missing file as a failed run. Expect routing to vary by a few requests between runs; every other spec was identical run to run. The orchestrator's poll is one `version.json` GET per target.
6. **The Kit 3 total is about 4% above the research figure** (5,939 against about 5,700), with the same shape: third-party, pwa and assets are 83% of all requests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The count file was missing or empty after most runs**
- **Found during:** Task 2 (first measurement runs)
- **Issue:** The plan assumed the emulator has about 2 s to flush after `smoke.mjs` ends its stdin. It does not: `smoke.mjs` exits right after `stop()`, and on Windows that exit kills the child process immediately. Over eight version-spec runs the count file was missing three times, empty (truncated, then killed before the write) three times and complete twice. A first attempt with a 100 ms idle write still lost counts, because page loads keep fetching until the browser closes.
- **Fix:** The count is written 5 ms after the last request (plus the planned every-25 and shutdown writes), and a write is skipped when the total is unchanged, so the shutdown path no longer truncates a complete file. Verified against a temporary trace of every flush (removed before the commit): in eight runs the file total equalled the true total every time; then 20 per-spec runs and 2 full runs produced a complete file each time.
- **Files modified:** scripts/serve-pages.mjs
- **Commit:** `8f4541c`
- **Residual limit:** a kill that lands inside a write leaves an empty file. That is detectable, which is why an empty or missing file counts as a failed measurement.

**2. [Rule 3 - Blocking] Count file path form in Git Bash**
- **Found during:** Task 2
- **Issue:** With `MSYS_NO_PATHCONV` set, a path built from `$PWD` (`/c/Users/...`) reaches Node unconverted and the write fails.
- **Fix:** No code change. The measurement uses `$(pwd -W)` so the variable holds a Windows-style absolute path.

## Issues Encountered

- A temporary debug edit made through a shell string broke the emulator file's syntax once; it was discarded with `git checkout -- scripts/serve-pages.mjs` and redone with the edit tool. Nothing of it was committed.

## Self-Check: PASSED

- Files found: scripts/lib/request-counter.mjs, scripts/request-counter.test.ts, scripts/serve-pages.mjs
- Commits found: 6d4e39d, 8f4541c, 26bb461, bb3ae81
- Nothing under .tools/ is tracked; .planning/config.json was never staged
