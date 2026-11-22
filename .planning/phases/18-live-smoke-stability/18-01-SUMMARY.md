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
2. **Task 2: rebuild the three targets and measure the baseline per spec** - this summary's first commit (docs)
3. **Task 3: local probes for the two open questions** - this summary's second commit (docs); probe scripts stay under the ignored `.tools/probes/`

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

## Self-Check
