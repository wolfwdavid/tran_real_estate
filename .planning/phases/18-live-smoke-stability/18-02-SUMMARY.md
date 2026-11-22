---
phase: 18-live-smoke-stability
plan: 02
subsystem: testing
tags: [smoke, playwright, github-pages, rate-limit, service-worker, seo]

requires:
  - phase: 18-live-smoke-stability
    provides: Emulator request counter (SERVE_PAGES_COUNT_FILE), the 5,939-request Kit 3 baseline, the cached-status probe (18-01)
provides:
  - LIVE_THIRD_PARTY_SAMPLE (nine routes, one per route group) used by third-party.smoke.ts on a live origin
  - One service worker install for the registration, precache and hashed-asset checks (assets.smoke.ts removed)
  - SEO share-tag checks over prerendered HTML, with no page loads
  - Measured after-volume per spec and a projected live total of 1,535 requests
affects: [18-03, 18-04, 18-05]

tech-stack:
  added: []
  patterns:
    - "Live runs sample one route per route group; the local emulator run keeps every route"
    - "Precache statuses are read from the Cache API after the install instead of re-fetching each file"

key-files:
  created: []
  modified:
    - apps/web/tests/e2e/routes.ts
    - apps/web/tests/smoke/third-party.smoke.ts
    - apps/web/tests/smoke/seo.smoke.ts
    - apps/web/tests/smoke/pwa.smoke.ts
    - apps/web/playwright.smoke.config.ts
    - scripts/smoke.test.ts
    - scripts/smoke-readonly.test.ts

key-decisions:
  - "third-party.smoke.ts loads all of ROUTES when SMOKE_ALLOW_HTTP is 1 (the local emulator) and the nine-route sample otherwise"
  - "The hashed-asset contract reads cached statuses (zero requests); a missing entry is reported as a failure too"
  - "SMOKE-07 is advanced (volume cut and measured locally), not completed; it closes with the 18-05 proof runs"

patterns-established:
  - "Measure one third-party route alone with a title filter to get its real cost; per-route cost ranges from 27 to 106 requests"

requirements-completed: [] # SMOKE-07 advanced only (volume cut, measured locally); it is completed by the three proof runs in 18-05

duration: 12min
completed: 2026-11-22
---

# Phase 18 Plan 02: Cut Live Smoke Volume Summary

**Projected live smoke volume cut from 5,939 to 1,535 requests (74%) by a nine-route third-party sample, one shared service worker install read from the cache, and share tags read from prerendered HTML**

## Performance

- **Duration:** about 12 min
- **Started:** 2026-11-22T14:07Z
- **Completed:** 2026-11-22T14:19Z
- **Tasks:** 3
- **Files modified:** 7 (one of them deleted), plus this summary

## Accomplishments

- `third-party.smoke.ts` loads nine routes on a live origin (one per route group) and all 44 on the local emulator.
- `pwa.smoke.ts` makes one install and asserts registration, precache contents and the hashed-asset statuses from it; `assets.smoke.ts` and its 322-request GET loop are gone.
- `seo.smoke.ts` makes no page loads: 15 page loads became 15 HTML GETs.
- No sleep, retry, `toPass` or timeout change was introduced; `PRECACHE_INSTALL_TIMEOUT_MS` and `fixtures.ts` are untouched.

## Task Commits

1. **Task 1: third-party live sample and SEO share tags over HTML** - `cc23f9d` (test)
2. **Task 2: one service worker install for pwa and assets** - `2aeff6b` (test)
3. **Task 3: rebuild, full local smoke, measure** - recorded in this summary (docs commit)

## Verification

- **Build SHA:** `2aeff6b72877f89c35444e4e31a6335ab8e924a5` (equal to `git rev-parse HEAD` and to `_app/version.json` in all three builds at measurement time).
- **Unit tests:** `pnpm vitest run --project scripts` gives 40 files, 1,271 tests passed (1,264 before; 7 new pins).
- **`pnpm smoke:local`:** exit 0, 119 tests passed on each target.

| Target | Tests | Time |
| --- | --- | --- |
| root | 119 passed | 12.9 s |
| sub | 119 passed | 12.5 s |
| configured | 119 passed | 12.7 s |
| **Total** | | **38.1 s** (budget 300 s) |

- The suite is now 119 tests in 9 spec files (was 121 in 10): the assets test is gone and three pwa tests became two. The third-party spec still ran 44 routes on every target.
- Precache install as logged by the run: 381 entries in about 0.87 s (382 on the configured target).

## Request volume: before and after (root target)

- **Method:** as in 18-01. One `pnpm smoke:local --target root` run per spec with `SERVE_PAGES_COUNT_FILE` pointing at a Windows-style absolute path under `.tools/p18/after/`, emulator-side count minus the orchestrator's one `version.json` poll. pwa, seo and the full suite were each measured twice with identical results.
- **Live column:** the same count for the requests a live run makes. Only third-party differs between local and live.

| Spec | Before (18-01) | After, local run | After, live run | How |
| --- | --- | --- | --- | --- |
| third-party | 3,337 (44 loads) | 3,337 (44 loads, re-measured) | **576** (9 loads) | measured, see the next table |
| pwa | 841 | **421** | 421 | measured twice |
| assets | 742 | 0 (spec removed) | 0 | merged into pwa |
| seo | 504 | **19** | 19 | measured twice |
| routing | 225 | 225 | 225 | 18-01 figure, unchanged spec |
| a11y | 177 | 177 | 177 | 18-01 figure, unchanged spec |
| csp | 45 | 45 | 45 | 18-01 figure, unchanged spec |
| analytics | 38 | 38 | 38 | 18-01 figure, unchanged spec |
| extension-link | 33 | 33 | 33 | 18-01 figure, unchanged spec |
| version | 1 | 1 | 1 | 18-01 figure, unchanged spec |
| **Total** | **5,939** (full-suite run) | **4,294** (full-suite run, measured twice) | **1,535** (projected) | |

- **Projected live total: 1,535 requests, a 74.2% cut** from 5,939. It is under the 2,000 stop line and inside the plan's 1,500 to 1,800 target.
- With the plan's own formula (the 75.8 average per load times nine, 682) the total would be 1,641, a 72.4% cut. The measured per-route sum is used because it is a measurement; both are under 2,000.
- The local full run fell from 5,939 to 4,294 (27.7%). The sum of the per-spec figures is 4,296; the difference of 2 is routing, which varies by a few requests between runs (18-01).
- pwa at 421: one install of the 381-entry precache, one page load, `service-worker.js` once and the manifest GET. The hashed-asset step added no requests.
- seo at 19: sitemap, robots, manifest, 14 route HTML GETs, the landing HTML and the og:image.

### The nine sampled routes, measured one at a time

Each route was run alone (`third-party.smoke.ts` with a title filter), one load each.

| Route | Group | Requests |
| --- | --- | --- |
| (landing) | MARKETING_ROUTES | 38 |
| tools/cap-rate/ | TOOL_ROUTES | 34 |
| legal/privacy/ | LEGAL_ROUTES | 33 |
| renter/ | RENTER_ROUTES, APP_ROUTES | 106 |
| investor/deals/ | INVESTOR_ROUTES | 85 |
| agent/contacts/ | AGENT_ROUTES | 105 |
| agent/studio/ | STUDIO_ROUTES | 97 |
| agent/inquire/ | PUBLIC_ROUTES | 51 |
| print/ | PRINT_ROUTES | 27 |
| **Sum** | | **576** |

## Findings for later plans

Nothing here contradicts what 18-03 or 18-04 rest on. These are facts they should use.

1. **18-04, the numbers for the RUNBOOK.** Projected live total 1,535 requests (third-party 576, pwa 421, seo 19, unchanged specs 519). The suite is 119 tests in 9 spec files. The local full run is 4,294 requests on the root target.
2. **18-04 and 18-05, the live sample branch has never executed.** `smoke:local` always sets SMOKE_ALLOW_HTTP to 1, so the nine-route branch cannot run against the emulator. It is covered by the unit pins and by running each of its nine routes alone; its first real execution is the first live run. A live run should list 9 third-party tests and 84 tests in total (119 minus 35).
3. **18-03, more of the suite is API-context traffic now.** seo is entirely `request.get` (19 requests), on top of csp (45), the manifest GET and version. 18-01 showed the context listeners never see that traffic, so the request wrapper in 18-03 is what makes a 429 on those specs visible.
4. **18-03, the hashed-asset step cannot see a 429 itself.** It reads the cache and sends nothing. A rate-limited install still shows up as before: the cache key exists with zero entries and `installedPrecache` waits its 20 s and fails (18-01 finding 2). `installedPrecache` and `fixtures.ts` are unchanged, so Branch A or B of 18-03 applies as written.
5. **Counting a full-suite run.** `version.json` is fetched three times in a full run (the orchestrator's poll, the version spec, and one more). Subtract only the orchestrator's one poll, as 18-01 did; subtracting every `version.json` hit understates the total by 2.
6. **Per-route cost varies fourfold** (27 to 106). The 75.8 average is not a good predictor for a sample; portal pages cost about 100, marketing and legal pages about 35.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The spec-count pin in the read-only guard**
- **Found during:** Task 2
- **Issue:** `scripts/smoke-readonly.test.ts` asserts the number of smoke spec files (10) as its non-vacuity check. Removing `assets.smoke.ts` makes it 9. The file is not in the plan's `files_modified`, though the task says to update scripts tests.
- **Fix:** The expected count is 9.
- **Files modified:** scripts/smoke-readonly.test.ts
- **Commit:** `2aeff6b`

### Other differences

- **Third-party live volume is measured per route (576), not computed as 75.8 times 9 (682).** The plan asked for the computed figure; both are in the table above.
- **The asset check reports a missing cache entry as a failure** (`missing <url>`) besides a non-200 status. The plan asked for the non-200 entries; an entry that cannot be matched is worse, not fine.
- **Task 2's commit has five files, not four**, because of the pin above.
- **The share-tag test asserts the canonical link and og:url are each present exactly once** and equal to the site URL plus the route, which is slightly stricter than the old first-match read.
- **No doc under `docs/` was changed.** The only "121" figures are dated run records, and no live statement of the current suite size exists.
- The plan's `done` line for Task 1 says seven routes; the sample is nine, as the task body and `must_haves` say.

## Issues Encountered

- A first check of the share-tag parser, run as an inline shell one-liner, reported every route as failing. The cause was shell quoting of the regular expression, not the parser: the same check from a file passed for all 14 indexable routes on the root and sub builds, and the spec then passed on all three targets.

## Not done

- No live run, no push, no workflow dispatch (by rule). The projected live total is arithmetic over local measurements.
- The unchanged specs (routing, a11y, csp, analytics, extension-link, version) were not re-measured one by one; the full-suite total confirms them within 2 requests.

## Self-Check: PASSED

- Files found: apps/web/tests/e2e/routes.ts, apps/web/tests/smoke/third-party.smoke.ts, apps/web/tests/smoke/seo.smoke.ts, apps/web/tests/smoke/pwa.smoke.ts, scripts/smoke.test.ts, scripts/smoke-readonly.test.ts; apps/web/tests/smoke/assets.smoke.ts is absent
- Commits found: cc23f9d, 2aeff6b
- Nothing under .tools/ is tracked; .planning/config.json was never staged
