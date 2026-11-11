---
phase: 15-load-deterministic-test-lanes
plan: 10
subsystem: testing
tags: [evidence, playwright, vitest, cpu-pressure, shuffle, doc-pin]

# Dependency graph
requires:
  - phase: 15-load-deterministic-test-lanes
    provides: 15-01 lane manifest and worker caps; 15-03 flaky gate; 15-07 cpu-burn.mjs; 15-09 the permanent lane guard
provides:
  - docs/test-evidence/2026-11-10.md, the dated evidence file for TEST-05 and TEST-06 (verify x3, repeat-each 3 on the 12 load-sensitive specs, serial lane x3, full E2E under 12 burner threads, seeded shuffle, four recorded attempts)
  - scripts/test-evidence.test.ts, the pin that keeps the newest evidence file honest (12 tests, 10 planted negatives)
affects: [15-11, 16-vitest-5-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A pressure measurement runs on a checkout of the measured SHA: the build-stamp specs compare the built site to HEAD, so any later commit, docs included, makes the full E2E fail until a rebuild"
    - "A CPU sampler (total % and per-process cores every 30 s) runs beside any load measurement, so outside load can be shown or ruled out afterwards"

key-files:
  created:
    - docs/test-evidence/2026-11-10.md
    - scripts/test-evidence.test.ts
  modified: []

key-decisions:
  - "Pressure level is 12 burner threads on 16 CPUs (75%), amended from 16 by the owner on 2026-11-10 (f2cd341) after attempt 2"
  - "The passing pressure run was made on a detached checkout of 194b07f rather than after a rebuild at the later docs-only HEAD: the plan forbids a rebuild and the evidence file names one HEAD for every step"
  - "The failed 12-thread run at 23c7aae is recorded as attempt 3 with its one unexplained timeout stated as unexplained, not attributed"

patterns-established:
  - "Evidence file + pin test: the newest docs/test-evidence/YYYY-MM-DD.md is parsed by a unit test whose rules each have a planted negative"

requirements-completed: []
# TEST-05 and TEST-06 are evidenced here; plan 15-11 ticks TEST-01..06 after the CI observation.
---

# Phase 15 Plan 10: Evidence protocol Summary

**The Phase 15 evidence protocol is complete at `194b07f`: three clean verify runs, repeat-each 3 on all 12 load-sensitive specs, the serial lane three times, a full E2E under 12 burner threads with 0 failed and 0 flaky, and a seeded shuffle, in one dated file pinned by a test.**

## Code under test

`194b07f858b913a3118c393f68f5625b8362e272`. The only commits after it are docs and planning (`9e88163`, `f2cd341`, `23c7aae`), the evidence file (`180ee94`) and the doc-pin test (`bda6ead`). No product or test-lane code changed during the protocol.

## Wall time per step

| Step | What | When (UTC) | Wall time |
| --- | --- | --- | --- |
| 1 | `pnpm verify` x3 | 2026-11-10 17:11:46Z-18:51:00Z | 27m47s, 35m53s, 30m02s |
| 2a | repeat-each 3, 12 specs, root+sub | 18:55:41Z-19:03:08Z | 7m27s (528 passed) |
| 2b | serial lane x3 | 19:04:08Z-19:08Z | 79.84 s, 78.43 s, 78.93 s |
| 3 | full E2E under 12 burner threads | 2026-11-11 02:02:22Z-02:30:42Z | 28.3 m (2350 passed, 4 skipped) |
| 4 | shuffled unit run, seed 1794340461 | 2026-11-10 19:54:21Z-19:56:54Z | 147.12 s |

## Attempts

1. `81473a3`, step 1: 12 E2E failures on `net::ERR_NETWORK_CHANGED`. Host Wi-Fi driver drops; no repository change.
2. `194b07f`, step 3 at 16 threads: 5 failures on default 5 s expectations spanning lazy chunk imports. Host starvation; owner lowered the pressure level to 12 threads.
3. `23c7aae`, step 3 at 12 threads (2026-11-11 01:27Z-01:59Z): 7 failed. Six are the build-stamp guard, because the builds carried `194b07f` and HEAD had moved by docs-only commits; the handoff's "docs commits keep the measurements valid" missed that guard. The seventh is a 30 s timeout in `marketing.spec.ts:169` on root (36.5 s, every navigation slow, none stalled). No CPU log covered that window, so its cause is not established; the same test took 16.1 s under 16 threads and 20.6 s in the passing run.
4. `194b07f` on a detached checkout, step 3 at 12 threads with a CPU sampler: exit 0, `Running 2354 tests using 4 workers`, 2350 passed, 4 skipped, 0 failed, 0 flaky, 0 WLAN drops, 54 CPU samples at 83-88% with no outside process above one core apart from the editor in three samples. This is the row in the evidence file.

## Task Commits

1. Evidence file: `180ee94` docs(15-10): test evidence 2026-11-10
2. Pin test: `bda6ead` test(15-10): pin the test-evidence file

## Verification

- `pnpm vitest run --project scripts scripts/test-evidence.test.ts`: 12 passed.
- `pnpm test:unit`: 366 files, 7187 tests passed. `pnpm lint`: clean. `pnpm banned`: passed (454 files).
- The gitleaks and real-data pre-commit hooks passed on both commits.
- No unfilled placeholder in the evidence file; one seed across `Seed:`, the command and the output.

## Deviations from Plan

- Step 3 ran at 12 threads, not 16 (owner amendment, `f2cd341`).
- Step 3 ran on a detached checkout of the measured SHA, hours after steps 1, 2 and 4, on 2026-11-11 UTC (still 2026-11-10 local, the file's date).
- The evidence file adds a CPU-sampler sentence and an attempt-3 row that the draft did not have.

## Open observation for 15-11

`marketing.spec.ts:169` visits about 40 routes inside one 30 s test budget. It has 9 to 19 s of headroom in every clean run, and exceeded the budget once under 12 threads for a reason that was not captured. If it times out again in CI or under pressure, the structural fix is to read the prerendered descriptions without a browser navigation per route; a timeout raise stays out of bounds.

## Next

Plan 15-11: the owner-approved push, CI observation of the flaky flag and the 2-worker cap, and ticking TEST-01..06. The builds on this machine are stale against the new HEAD; rebuild the three targets before any local E2E.

## Self-Check: PASSED
