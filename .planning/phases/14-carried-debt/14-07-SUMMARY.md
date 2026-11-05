---
phase: 14-carried-debt
plan: 07
subsystem: alerts-scheduler
tags: [scheduler, web-locks, e2e, cpu-pressure, DEBT-07]
requires:
  - "14-05 (backup-roundtrip.spec.ts seeds savedSearches with lastRunAt = now; untouched by this plan)"
provides:
  - "scheduler.ts: ALERTS_LOCK_WAIT_MS = 10_000 and browserLock(waitMs) with a bounded AbortSignal.timeout wait"
  - "scheduler.test.ts: real navigator.locks proofs (hold-then-release, two runners recompute due inside the lock), timeout and error-propagation tests"
  - "renter-saved.spec.ts: reopenAt(page, t) moves the page clock on the marketing home page, never on a portal page"
  - "A CPU-pressure method (concurrent full unit suite) recorded for Phase 15"
affects:
  - "14-11 (close-out: DEBT-07 closed; the verify chain runs renter-saved and data-status on root and sub)"
  - "Phase 15 (reuse the CPU-pressure method below; any E2E that jumps page.clock on a page with DataShell has the same race)"
tech-stack:
  added: []
  patterns:
    - "Lock timeout detected by a granted flag plus signal.aborted, never by error name"
    - "page.clock jumps happen on a page without DataShell, so an in-flight check-on-open pass cannot read the new time"
key-files:
  created: []
  modified:
    - apps/web/src/lib/data/scheduler.ts
    - apps/web/src/lib/data/scheduler.test.ts
    - apps/web/tests/e2e/renter-saved.spec.ts
decisions:
  - "browserLock waits up to 10 s for tran-alerts (AbortSignal.timeout), then returns null so the pass skips as 'busy'; any error after the grant propagates"
  - "renter-saved.spec.ts:83 had a second race besides the 10-23 busy skip: the test jumped page.clock on the renter page while that page's pass was in flight, so the pass claimed the now-due search and was killed by the reload (claimedAt = T+25h, lastRunAt = T, CLAIM_TTL_MS 120 s hid it from the next page). Fixed in the test (reopenAt), not in product code, because a real clock never jumps 24 h mid-pass"
  - "data-status.spec.ts left untouched: its comment says the next pass 'can come back busy', which is still true after the 10 s wait"
metrics:
  duration: "~30 min"
  completed: "2026-11-05"
  tasks: 2
  files: 3
---

# Phase 14 Plan 07: Bounded-wait alerts lock Summary

The check-on-open scheduler now waits up to 10 seconds for the `tran-alerts` lock (`AbortSignal.timeout`) instead of skipping at once with `ifAvailable`. A tab that opens while another tab is checking now runs its due searches after the other tab finishes, and due searches are still computed inside the lock. Real `navigator.locks` tests on Node 24 prove this, and four mutants of the guard are all caught. The first CPU-pressure run turned up a second, test-only race in `renter-saved.spec.ts:83`. It was root-caused with IndexedDB evidence, reproduced deterministically and fixed. The spec then passed 60/60 under `--repeat-each 10` on root and sub while the full unit suite ran alongside.

## Tasks

| Task | Name | Commits | Files |
| ---- | ---- | ------- | ----- |
| 1 | Bounded-wait browserLock with real-lock two-tab, timeout and error tests | 4d7529b (RED), 605cc8b (GREEN) | scheduler.ts, scheduler.test.ts |
| 2 | renter-saved x10 under CPU pressure | f1313d5 (race fix found by the run) | renter-saved.spec.ts |

### Task 1

- RED (4d7529b): 4 of 5 new or flipped tests failed on the old code. The bounded-wait signal test failed with "expected undefined to be an instance of AbortSignal", the timeout test failed, the hold-then-release test got `'busy'` instead of null, and the two-runner test recorded only one pass. The error-propagation test passed on the old code too, which is expected: it guards the new catch.
- GREEN (605cc8b): `ALERTS_LOCK_WAIT_MS = 10_000`, `browserLock(waitMs)` as specified in the plan, and an updated LockPort doc comment. `runDueSearches` is unchanged.
- `vitest run --project web apps/web/src/lib/data/`: 22 files, 306 tests passed. `pnpm --filter web check`: 0 errors, 0 warnings. ESLint and Prettier are clean on both files.
- Acceptance greps: `ifAvailable` in scheduler.ts = 0, `AbortSignal.timeout(waitMs)` = 1, `ALERTS_LOCK_WAIT_MS = 10_000` = 1, `toEqual({ ifAvailable: true })` in scheduler.test.ts = 0.
- The two-runner test finds out which runner went second by wrapping each tab's `repo.list()`, the first call inside the pass, to record the order. It then asserts that the second runner has `due: 0, skipped: null, ran: []`.

## Mutation ledger

Each mutant was applied by a scratch script to scheduler.ts and then run against `scheduler.test.ts`. The file was then restored from a saved good copy, and the suite was green again (22/22).

| # | Mutant | Caught by | Result |
| - | ------ | --------- | ------ |
| 1 | Restore `{ ifAvailable: true }` + `lock ? fn() : null` | bounded-wait signal, timeout, hold-then-release (`expected 'busy' to be null`), two-runner | CAUGHT (4 failed) |
| 2 | Compute `repo.list()` before `lock.run` and pass the precomputed rows into the pass | two-runner: `expected { ... } to match object { due: 0, skipped: null, ran: [] }` (second runner reported due 5 from its stale list) | CAUGHT (1 failed) |
| 3 | Drop `{ signal }` (unbounded wait) | bounded-wait signal, timeout, error-propagation (`cb is not a function` with the stub's 3-argument shape) | CAUGHT (3 failed) |
| 4 | Replace the catch body with `return null` | error-propagation: `promise resolved "null" instead of rejecting` | CAUGHT (1 failed) |

4/4 caught. Mutant 2 failed on the first try, so its assertion did not need strengthening.

## CPU-pressure method (for Phase 15)

- **Machine:** Windows 11, `nproc` = 16 and `NUMBER_OF_PROCESSORS` = 16 (`os.availableParallelism()` = 16). No other heavy external load was running (no llama-server, unlike 10-23).
- **Builds:** `pnpm build:root`, `pnpm build:configured` and `pnpm build:sub` were all run from HEAD after 605cc8b, under the build lock. The later commit f1313d5 changes only a test file.
- **Pressure command (background loop, started 15 s before the E2E run and stopped by a stop file after it):**
  `while [ ! -f "$R/stop" ]; do MSYS_NO_PATHCONV=1 corepack.cmd pnpm test:unit > "$R/unit-$(date +%s).log" 2>&1; done`
  - Vitest worker count: no `maxWorkers` is set in `vitest.config.ts`, so Vitest uses its default of availableParallelism - 1 = 15 workers for the Node projects. The `web-browser` project also runs Chromium.
  - One iteration takes about 146 s: 359 files and 6,998 tests passed (`Duration 146.37s`).
- **E2E command (foreground, from apps/web):**
  `node node_modules/@playwright/test/cli.js test tests/e2e/renter-saved.spec.ts --repeat-each 10 --workers 4 --project root --project sub --reporter=line`
  This is equivalent to the plan's `pnpm --filter web exec playwright test ...`. The CLI path is used because of the Git Bash `'C:\Program'` problem. The Playwright worker count is 4.
- **Acceptance run (after f1313d5):**
  - The unit iteration ran from 23:27:45 to 23:30:16 UTC and exited 0. The E2E run ran from 23:28:01 to 23:29:56 UTC, so one unit iteration overlapped the whole E2E run.
  - Result: `60 passed (1.9m)`. That is 3 tests x 10 repeats x 2 projects: root 30/30, sub 30/30, with 0 failed and 0 flaky. `retries` is 0 locally, and `git diff --stat apps/web/playwright.config.ts` is empty.
- **Plan verification run:** `renter-saved.spec.ts` + `data-status.spec.ts` with `--repeat-each 2`, 4 workers, root and sub, under the same pressure. One unit iteration ran from 23:30:39 to 23:32:35, and the E2E run from 23:30:54 to 23:31:51. Result: `44 passed (55.0s)`.

### The failure the first pressure run found (root-caused, not a flake)

- **First run** (root only, `--repeat-each 10`, same pressure): 29 passed and 1 failed. The failure was `renter-saved.spec.ts:83` at line 137 ("2 new since your last visit" not visible). The page showed "Checked 1 day ago", which is the same symptom as in 10-23.
- **Evidence:** a temporary diagnostic, never committed, read IndexedDB when the step failed. A second failure appeared in 1 of 80 runs under pressure, and it read `rows=[{"lastRunAt":1792065600000,"claimedAt":1792155600000}] calls=2`, with `navigator.locks.query()` showing `tran-alerts` held just before the reload. So `claimedAt` was T+25h and `lastRunAt` was T.
- **Mechanism:**
  1. The T+1h page's pass was still in flight, holding the lock or waiting for it, when the test called `page.clock.setFixedTime(T + 25h)`.
  2. That pass read the new clock, found the search due, claimed it and spent call 2.
  3. The reload then destroyed the page before `complete()`.
  4. The claim (`CLAIM_TTL_MS` = 120 s) hid the search from the T+25h page.
  The cause is the test's clock jump, not the lock.
- **Deterministic reproduction** (scratch specs, deleted afterwards):
  - Setup: a second page held `tran-alerts` so that the T+1h pass parked behind the lock, and the RentCast route was delayed by 1.5 s.
  - Old flow (set the clock, release the lock, reload): 3/3 failed at the same line.
  - New flow (`reopenAt`: move to the marketing home page, then set the clock, then reopen; the holder is released after the new page is waiting): 3/3 passed. This also shows the bounded wait working in a real browser, because the new page waited for the held lock and then ran.
- **Fix (f1313d5):** `reopenAt(page, t)` moves the clock on the marketing home page, which mounts no DataShell, and then reopens the current portal URL. Both clock jumps in the spec use it. No retries were added and no timeouts were raised.

## Budget gate

`pnpm budget:assert` was run on the fresh builds and passed for both: 9 gated routes within 60 KB in `apps/web/build` and in `apps/web/build-configured`. The largest gated routes are `for-*` at 59.7 KB (build) and 59.8 KB (configured). The scheduler does not ship on marketing routes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test race in renter-saved.spec.ts:83 (clock jump on a live portal page)**
- **Found during:** Task 2, first `--repeat-each 10` run under pressure
- **Issue:** The test advanced `page.clock` while the previous page's check-on-open pass was in flight. That pass claimed the newly due search and was killed by the reload, and the claim TTL hid the search from the next page.
- **Fix:** Added a `reopenAt` helper that moves the clock on the marketing home page before reopening the portal URL. The plan allowed a scheduler.ts fix only if the lock was the cause, and it was not.
- **Files modified:** apps/web/tests/e2e/renter-saved.spec.ts (not listed in the plan's files_modified)
- **Commit:** f1313d5

**2. data-status.spec.ts not modified**
- The plan listed this file but said to reword its comment only if it claimed that a busy lock skips instantly. It does not make that claim, so the file is unchanged.

**3. Task 2 run split into two calls**
- The pre-fix diagnostic runs and the acceptance run were separate Bash calls, each under the 7-minute cap. The acceptance run covered root and sub in one call.

## Known Stubs

None.

## Self-Check: PASSED
