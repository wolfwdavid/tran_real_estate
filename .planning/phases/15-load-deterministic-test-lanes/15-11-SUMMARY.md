---
phase: 15-load-deterministic-test-lanes
plan: 11
subsystem: testing
tags: [ci, evidence, playwright, flaky-gate, requirements]

requires:
  - phase: 15-load-deterministic-test-lanes
    provides: 15-10 evidence file and pin test; 15-03 flaky gate; 15-01 worker caps and serial lanes
provides:
  - "## 5. CI observation in docs/test-evidence/2026-11-10.md, quoting the CI log for run 42947670555"
  - TEST-05 and TEST-06 ticked in REQUIREMENTS.md (TEST-01..04 were already ticked by earlier plans)
affects: [phase-15-verification, 16-vitest-5-migration]

key-files:
  modified:
    - docs/test-evidence/2026-11-10.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "One owner approval ('finish phase 15') covered both pushes; the first push happened before this continuation, the closing docs commit is pushed at the end"

requirements-completed: [TEST-03, TEST-04, TEST-05]

duration: 25min
completed: 2026-11-10
---

# Phase 15 Plan 11: CI observation Summary

**CI run 42947670555 on head 11b58f9 is green on all three quality legs, and its log shows `--fail-on-flaky-tests`, `using 2 workers` on every leg and the `*-serial` unit projects, so TEST-01..06 are closed.**

## CI observation

Run `42947670555` (ci.yml, main), head `11b58f92e0c658e1812dfd49264d2a5415fd6886`, conclusion `success`. Jobs, all `success`: secrets + real-data guard; check, lint, unit, build, csp, e2e+axe (root); (sub); (configured); deploy.

Verbatim log lines (from `.tools/test-evidence/ci-42947670555.log`, gitignored):

- `pnpm --filter web exec playwright test --project=root --fail-on-flaky-tests`
- `pnpm --filter web exec playwright test --project=sub --fail-on-flaky-tests`
- `pnpm --filter web exec playwright test --project=configured --fail-on-flaky-tests`
- `Running 1157 tests using 2 workers` (root), `Running 1153 tests using 2 workers` (sub), `Running 44 tests using 2 workers` (configured)
- Unit step: `core-serial src/fair-housing/mutation.test.ts (206 tests)`, `scripts-serial eslint-rules.test.ts (113 tests)`, `scripts-serial precommit.test.ts (10 tests)`; `Test Files 366 passed (366)` on all three legs.

## Task commits

1. Task 1 (owner approval to push): resolved by the owner ("finish phase 15"); no commit.
2. Task 2: first push done before this continuation (main == origin/main at 11b58f9); closing commit `a0fa734` docs(15-11): CI observation and TEST-01..06 complete.

## Acceptance results

- CI conclusion success on root, sub, configured legs: yes (jobs list above).
- Log contains the flag on the E2E step and `using 2 workers` on each leg: yes.
- `scripts/test-evidence.test.ts`: 12 passed after the new section.
- REQUIREMENTS.md: all six `- [x] **TEST-0[1-6]**` and six `| TEST-0N | Phase 15 | Complete |` rows present.

## Deviations from Plan

- The plan expected 12 changed lines in REQUIREMENTS.md; only 4 changed (8 diff lines: TEST-05 and TEST-06 checkbox and traceability rows) because TEST-01..04 were already ticked by earlier plans. End state is identical.
- The evidence table lists the three legs as rows rather than one row, to quote each leg's lines verbatim.

## Live smoke (not in scope)

live-smoke run 42950864036, triggered by the deploy, completed with `failure`: 108 passed, the rest failed with HTTP 429 from the live site (32 log lines mention 429), the same known open quick task as run 42907249126. Not re-run or fixed here.

## Open observation (carried from 15-10)

`marketing.spec.ts:169` passed in CI (all three legs green); no timeout there.
