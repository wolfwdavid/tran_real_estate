---
phase: 15-load-deterministic-test-lanes
verified: 2026-11-11T00:00:00Z
status: passed
score: 6/6 requirements verified (TEST-01..TEST-06)
overrides_applied: 0
---

# Phase 15: Load-Deterministic Test Lanes Verification Report

**Phase Goal:** Full `test:unit` and E2E runs are deterministic under parallel load: wall-clock budgets live in serial lanes, blind timeout raises and retries are mechanically impossible, worker counts are capped and recorded, and a dated evidence file proves it.
**Status:** passed. **Re-verification:** No.

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| TEST-01 | Timing budgets in `*-serial` projects; guard fails on timing assertion or raise outside serial lane | VERIFIED | `vitest.config.ts` lists the 6 parallel projects plus 4 `*serial.config.ts`; `tooling/vitest/lanes.ts` SERIAL manifest (core 4, web 3, web-browser 4, scripts ...) with `fileParallelism:false`, `maxWorkers:1`, groupOrder 1/2. `scripts/test-lanes.test.ts` sweeps `git ls-files --cached --others` and expects zero findings. |
| TEST-02 | Raised timeouts carry measured number + cause; no blind retries | VERIFIED | Rules in `scripts/lib/test-lane-rules.mjs`. I planted violations via `scanFile` (fresh node run): `test(..., 20000)` in a parallel core file -> `raised-timeout-outside-serial`; `performance.now()` -> `elapsed-time`; Playwright `test.setTimeout(90000)` without comment -> `unannotated-raise`; `describe.configure({retries:2})` -> `retry`. Guard is non-vacuous. Pins A/B/C force lane membership off and require the exact known timing/raise file sets, so a rule regression cannot pass silently. Retry values pinned per config (`PINNED_RETRIES`). |
| TEST-03 | Playwright CI `--fail-on-flaky-tests`, retry policy documented | VERIFIED | `.github/workflows/ci.yml:133` passes the flag; `apps/web/playwright.config.ts` has the retry-policy comment, `retries: CI?1:0`, `failOnFlakyTests: !!CI`. test-lanes.test.ts pins exactly one such ci.yml line and both configs. flaky-gate.test.ts (serial) proves non-vacuity (CI log shows it passing). |
| TEST-04 | Worker caps in config, values recorded; Windows PATH/taskkill guard tested | VERIFIED | `MAX_WORKERS = CI ? 3 : 8` in `tooling/vitest/lanes.ts`, applied at root and both browser configs; root config throws on `VITEST_MAX_WORKERS`. Playwright `workers: CI ? 2 : 4`. Pinned by "worker caps" tests. Recorded in evidence file "Worker caps" table. `scripts/windows-path.test.ts` covers taskkill/PATH teardown. |
| TEST-05 | Evidence protocol: 3 clean verifies, repeat-each 3 on load-sensitive specs, full E2E under CPU pressure, dated file | VERIFIED | `docs/test-evidence/2026-11-10.md` records 3 verify runs (exit 0, 365 files / 7175 tests each), 12 specs x repeat-each 3 (0 failed / 0 flaky), 3 serial-lane runs, full E2E under 12 burner threads (2350 passed, 0 failed, 0 flaky). Failed attempts are disclosed with causes (Wi-Fi driver drops, build-stamp mismatch, host starvation), no code changes made to mask them. `scripts/test-evidence.test.ts` pins the file's structure with planted negatives. |
| TEST-06 | Shuffled unit run with recorded seed | VERIFIED | Evidence file records command `--sequence.shuffle.files --sequence.shuffle.tests --sequence.seed=1794340461` and the "Running tests with seed" output. |

## Independent checks

- `gh run view 42947670555`: conclusion success, headSha `11b58f92e0c658e1812dfd49264d2a5415fd6886`. Log shows `pnpm test:unit` 366 files / 7186 tests passed on all three build legs, E2E with `--fail-on-flaky-tests` passed (sub 1149 passed, configured 44 passed).
- `git diff --stat 11b58f9..HEAD` outside `.planning` and `docs`: no files (docs-only after the code head).
- Ran `pnpm vitest run --project scripts` on test-lanes, test-lane-rules, test-evidence, lane-order: 3 files / 154 tests passed (lane-order is a serial-project file, so the scripts project does not run it; it is covered by the CI serial lane).
- Sweep covers >=300 Vitest tests, >=40 Playwright files, every vite/vitest/playwright config (compared against `git ls-files`), package.json and ci.yml. Serial manifest entries must exist and appear in exactly one lane; parallel siblings exclude them.

## Requirements coverage

TEST-01..TEST-06 all appear in REQUIREMENTS.md (lines 46-51, ticked) and in the traceability table (Phase 15, Complete). No orphaned IDs.

## Notes (non-blocking)

- Evidence file counts 365 test files (taken at 194b07f); CI at 11b58f9 counts 366 because the evidence pin test was added later. Consistent.
- Evidence is a local-machine record (HEAD 194b07f); code head 11b58f9 differs by later commits, but CI at 11b58f9 is fully green. Acceptable.
- `15-VALIDATION.md` frontmatter still says `status: draft` / `wave_0_complete: false`; cosmetic bookkeeping.
- Vite warns that config imports lack file extensions (`configLoader: native`); informational, relevant to the Phase 16 migration.
- Live-smoke HTTP 429 failure is the known separately tracked issue; no Phase 15 must-have depends on it.

## Anti-patterns

No TBD/FIXME/XXX gate hits investigated beyond the guard sweep; none surfaced in the checks run.

## Human verification

None required.

_Verified: 2026-11-11 (Claude, gsd-verifier)_
