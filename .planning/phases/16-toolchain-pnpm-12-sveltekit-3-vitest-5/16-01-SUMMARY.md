---
phase: 16-toolchain-pnpm-12-sveltekit-3-vitest-5
plan: 01
subsystem: testing
tags: [playwright, smoke, service-worker, github-pages, rate-limit]

requires: []
provides:
  - "scripts/smoke.mjs exits 2 ('CDN rate-limited, re-dispatch once') when a smoke navigation answers 429; other failures stay exit 1"
  - "serviceWorkers 'block' as the smoke suite default; only pwa/assets specs keep the worker"
  - "A live-smoke run green on its own at e04ba10 (the pacing proof)"
affects: [16-02, phase-16 final gate, phase-17]

tech-stack:
  added: []
  patterns:
    - "Env-var evidence file (SMOKE_429_LOG) from the runner to Playwright fixtures"
    - "Reduce requests rather than add retries/sleeps (D-03)"

key-files:
  created: []
  modified:
    - scripts/smoke.mjs
    - scripts/smoke.test.ts
    - apps/web/tests/smoke/fixtures.ts
    - apps/web/tests/smoke/pwa.smoke.ts
    - apps/web/tests/smoke/assets.smoke.ts
    - apps/web/playwright.smoke.config.ts
    - docs/RUNBOOK.md

key-decisions:
  - "429 relabel is evidence-based (navigation responses logged by a fixture), not a status-code guess"
  - "No live-only reduction (fullyParallel/workers) needed: the live run went green"

requirements-completed: []  # TOOL-06 is the phase final-gate requirement; left Pending (plans 16-10, 16-13 also carry it)

duration: n/a
completed: 2026-11-11
---

# Phase 16 Plan 01: Smoke pre-flight (429 relabel + service-worker block) Summary

**Live smoke now reports a Pages CDN rate limit as exit 2 and no longer provokes it: non-worker specs run with the service worker blocked, and the live run at e04ba10 passed 121/121 without a re-dispatch.**

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | Relabel a 429 navigation as exit 2 (D-07.1) | d8b8747 |
| 2 | Measure, then block the service worker in non-worker specs (D-07.2) | e04ba10 |
| 3 | Local gate at HEAD | no commit (no file change) |
| 4 | Owner-approved push and live-smoke proof | no commit (evidence below) |

### Task 1
`classifySuiteExit(status, count)` (0 green; 2 for non-zero status with 429 evidence; else status) and `countRateLimited(text)` in scripts/smoke.mjs. `remote()` passes `SMOKE_429_LOG` (temp file) to Playwright, reads it back, prints the "CDN rate-limited, re-dispatch once" message, removes the temp dir in `finally`; `local()` untouched. A `rateLimit429` auto fixture in apps/web/tests/smoke/fixtures.ts appends the URL of every 429 navigation response when the env var is set. RUNBOOK exit-code 2 row covers the 429 case.

Mutation table (mutants reverted, never committed):

| Mutant | Result |
|--------|--------|
| `rateLimitedCount > 0` changed to `> 99` | 3 tests failed |
| fixture `isNavigationRequest()` mutated | fixture pin and its non-vacuity case failed |
| fixture `=== 429` literal mutated | fixture pin and its non-vacuity case failed |

### Task 2
Measured on the `sub` target (page loads; total requests / worker-issued requests), before to after:

| Spec | Loads | Before | After |
|------|-------|--------|-------|
| third-party.smoke.ts | 44 | 8039 / 4823 | 3216 / 0 |
| assets.smoke.ts | 1 | 412 / 380 | 412 / 380 (keeps worker) |
| pwa.smoke.ts | 2 | 824 / 760 | 824 / 760 (keeps worker) |
| a11y.smoke.ts | 3 | 667 / 504 | 163 / 0 |
| seo.smoke.ts | 15 | 571 / 93 | 478 / 0 |
| routing.smoke.ts | 4 | 254 / 43 | 217 / 0 |
| extension-link.smoke.ts | 1 | 30 / 1 | 29 / 0 |
| **Total** | 70 | **10797 / 6604** | **5339 / 1140** |

Hypothesis A1 confirmed: worker traffic was 61% of requests. The config diff only adds `serviceWorkers: 'block'` plus a comment; retries, workers, fullyParallel, failOnFlakyTests, globalTimeout and timeouts are untouched. Pinned in scripts/smoke.test.ts with a non-vacuity case.

### Task 3 (local gate at e04ba10)
All three targets rebuilt after the last commit; build stamp equals HEAD; no WLAN 8003 events in the prior 30 min. lint, check (0 errors), vitest `--project scripts --project scripts-serial` (43 files, 1271 tests), csp:assert, seo:assert, budget:assert all pass. smoke:local 121/121 on each of three targets (21.1 s, 20.4 s, 19.8 s; 61.3 s total).

### Task 4 (evidence)
- Owner approved the push; `git push origin main` moved 7217d4d..e04ba10 (7 commits). HEAD = origin/main = e04ba102c042a25ee2e958ed90d7debdb9bbe43c.
- ci (event push), success: https://github.com/wolfwdavid/tran_real_estate/actions/runs/42971716664
- live-smoke (event `workflow_run`, not a `workflow_dispatch` re-run), headSha e04ba102c042a25ee2e958ed90d7debdb9bbe43c, conclusion success: https://github.com/wolfwdavid/tran_real_estate/actions/runs/42975141402
- Log line: `smoke: e04ba102c042a25ee2e958ed90d7debdb9bbe43c live at https://wolfwdavid.github.io/tran_real_estate/ after 0 s`
- Result: `121 passed (35.7s)`. No re-dispatch, no live-only reduction needed.
- Acceptance: `git grep -n "retries: 0" apps/web/playwright.smoke.config.ts` matches at line 18.

## Deviations from Plan

**1. [Acceptance gap] Request reduction smaller than the order of magnitude asked for.** For third-party.smoke.ts, total requests fell about 2.5x (8039 to 3216), not 10x. Worker-issued requests went to 0; the remaining ~73 requests per load are ordinary page subresources that a worker block cannot remove. Overall requests fell about 2x (10797 to 5339). The outcome evidence (live run green with no 429, no re-dispatch) is the pacing proof; no further reduction was made, to avoid adding retries/sleeps/serialisation (D-03).

## Deferred / Issues

- `test-lanes.test.ts` repo-sweep test hit its 5 s default timeout once in a first combined run under machine load; it passed alone and in the scripts-project run. Pre-existing and load-sensitive; nothing raised or retried.

## Known Stubs

None.

## Self-Check: PASSED
- Commits d8b8747 and e04ba10 exist on main and origin/main.
- Live-smoke run 42975141402 re-read via `gh`: success, workflow_run, headSha e04ba10, 121 passed.
