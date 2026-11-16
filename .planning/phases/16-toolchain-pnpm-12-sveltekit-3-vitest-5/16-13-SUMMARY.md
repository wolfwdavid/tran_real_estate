---
phase: 16-toolchain-pnpm-12-sveltekit-3-vitest-5
plan: 13
status: complete (pushed ab1dc90..679b0a1; ci and live-smoke green)
requirements: [TOOL-04, TOOL-06]
---

# Phase 16 Plan 13: Vitest 5 evidence and launch audit

Complete. The owner approved the push (ab1dc90..679b0a1, 5 commits). TOOL-01 to TOOL-06 are ticked in REQUIREMENTS.md (TOOL-01 was already ticked by plan 04).

## Runs for the pushed SHA

- ci run 43864552755 on 679b0a1: success (secrets + real-data guard, root, sub, configured legs, deploy). Per leg: root `pnpm --filter web exec playwright test --project=root --fail-on-flaky-tests`, `Running 1157 tests using 2 workers`, unit `Test Files  372 passed (372)`; sub `--project=sub`, `Running 1153 tests using 2 workers`, 372 passed; configured `--project=configured`, `Running 44 tests using 2 workers`, 372 passed. Raw log `.tools/test-evidence/ci-43864552755.log`.
- live-smoke run 43867700929: success, `smoke: 679b0a13af0a3b16a71789c1e0ec47149bd99d87 live at https://wolfwdavid.github.io/tran_real_estate/ after 0 s`, 121 passed (36.7 s).

## Measurement

- Measurement SHA `c14e964ebcc3449d832f5b7d0cfe66c51c7c5e56` (679b0a1 is one docs-only commit above it). Evidence file: `docs/test-evidence/2026-11-16.md`; `scripts/test-evidence.test.ts` is unchanged.
- Verify x3 exit 0, repeat-each 3 on the 12 specs (0 failed, 0 flaky), serial lane x3 (21 files, 573 tests), groupOrder single-invocation design re-verified on Vitest 5.1.0, shuffle seed 1795137722 (372 files, 7395 tests), 12-thread CPU-pressure E2E 2350 passed 0 failed. WLAN 8003 count 0 in every window.
- Launch audit at c14e964: pnpm 12.18.0, every row PASS, budget PASS (landing 60775 bytes root, 60891 configured), dependency audit PASS with 2 exceptions.

## Commits

| Hash | Subject |
|------|---------|
| ad0c35b | docs(16-12): complete routine bumps plan |
| 5f05aa6 | fix(agent): restore the gap before the Today due-count pill |
| b38d58a | test(web): gate E2E interactions on hydration, not on the html hidden flag |
| c14e964 | perf(web): serve the landing hero contours as an asset, not in the page script |
| 679b0a1 | docs: Vitest 5 test evidence and launch audit at the deployed commit |

## Attempts

1. ad0c35b, pressure step: `agent-csv.spec.ts:91` took 33 s. `html hidden` is not a hydration signal (frame-guard removes it at parse time). Reproduced with a 300 ms delay on every immutable script (old specs fail, fixed pass). Fix 5f05aa6 and b38d58a (56 gates through `expectHydrated`, sweep guard `scripts/hydration-gate.test.ts`).
2. b38d58a, launch audit row 7 FAIL: landing 61819 bytes (60.4 KB). Hero contours moved to an `?no-inline` SVG asset as a CSS mask (c14e964): 60775 bytes. Hero screenshot: 0 differing pixels at default tolerance, 4421 (0.43%) at zero tolerance (anti-aliasing).

## Per-requirement evidence

| Req | Evidence |
|-----|----------|
| TOOL-01 | plan 04 push |
| TOOL-02, TOOL-03 | plan 10: Kit 3 live on ed3210e (see 16-10-SUMMARY) |
| TOOL-04 | plan 11: ci 43712512564, live-smoke 43714943846 (587c51c) |
| TOOL-05 | plan 12: ci 43790148391, live-smoke 43793250837 (ab1dc90); exception count five to two, `scripts/lib/audit-exceptions.mjs` has 2 |
| TOOL-06 | this plan: ci 43864552755, live-smoke 43867700929 (679b0a1) |

## Deviations

1. [Rule 1] Hydration race fixed class-wide (attempt 1); landing budget trim (attempt 2). Both found by this plan's own protocol.
2. Plain `pnpm`, not `corepack.cmd pnpm`. `MSYS_NO_PATHCONV=1` is needed for deploy-env builds; evidence shards need a name (`full`).
3. CLAUDE.md: the owner asked for the stack rows to be updated to the installed pins; done by the coordinator and committed here. The stale-version grep (1.63.0, 4.1.12, 2.70.3) on CLAUDE.md now returns nothing: PASS (previously the open item from plan 12 deviation 6).

## Carried risks

- Calculator pages have about 0.2 KB budget headroom (cash-on-cash and dscr 59.8 KB of 60); the landing has about 0.6 KB.
- `GenerationPanel.svelte:83` unused eslint-disable warning (accepted).
- minimatch audit exception, `revisitBy` 2026-12-31 (deepmerge 2027-01-31).
- Unproven markets overflow flake (not reproduced in this plan).
- Landing is rated by the launch audit against 60 KB although `assert-budget` only reports it; run `audit:launch` after any shared-code growth.

## Known Stubs

None.
