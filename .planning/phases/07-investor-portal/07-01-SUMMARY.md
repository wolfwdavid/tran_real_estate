---
phase: 07-investor-portal
plan: 01
subsystem: finance-core
tags: [finance, money, formatter, amortization, fast-check, layerchart]
requires: []
provides:
  - "@tran/core/finance: Cents, MAX_CENTS, roundHalfAway, divRoundHalfAway, mulBps, parseMoneyInput, parsePercentInput, parseRateInput, monthlyPayment"
  - "@tran/core/format: usd, usdRange, pct, pctTrim, ratio, rateLabel, monthYear, longDate, MINUS, NOT_AVAILABLE"
  - "packages/core/src/finance/arbitraries.ts: centsArb, bpsArb, rateArb, termArb (test-only)"
  - "fast-check 4.10.2 (core dev), layerchart 2.5.1 (web) installed; lockfile final for Phase 7"
affects: [07-02, 07-05, 07-06, 07-13, all investor UI plans]
tech-stack:
  added: [fast-check@4.10.2, layerchart@2.5.1]
  patterns: [integer cents + integer basis points, half-away-from-zero rounding, trunc/remainder exact division, string-math input parsing, BigInt reference property tests]
key-files:
  created:
    - packages/core/src/finance/money.ts
    - packages/core/src/finance/money.test.ts
    - packages/core/src/finance/amortization.ts
    - packages/core/src/finance/amortization.test.ts
    - packages/core/src/finance/arbitraries.ts
    - packages/core/src/finance/index.ts
    - packages/core/src/format/index.ts
    - packages/core/src/format/format.test.ts
  modified:
    - packages/core/package.json
    - apps/web/package.json
    - pnpm-lock.yaml
decisions:
  - "Kept the existing `./*` and `./renter/*` core export wildcards and added explicit ./finance ./format ./numbers ./markets entries ahead of them"
  - "No pnpm override for runed: the second copy (0.35.1) predates Phase 7 and is pinned by bits-ui 2.19.2 itself; layerchart shares the app's runed 0.37.1"
  - "arbitraries.ts is not exported from the finance barrel (fast-check is a dev dependency)"
  - "MINUS/NOT_AVAILABLE and the parser's negative check are written as \\u escapes in source so the code points are unambiguous"
  - "Older budget/renter formatters left untouched (different contracts: budget shows cents, renter takes dollars); format/ is the single source for investor figures"
metrics:
  duration: ~25min
  completed: 2026-10-06
  tasks: 3
  files: 11
---

# Phase 7 Plan 01: Exact money core, single formatter, amortizing payment Summary

Integer-cents money primitives (exact `mulBps`/`divRoundHalfAway`, half away from zero, BigInt-verified), a single investor display formatter (whole dollars, U+2212 minus, UTC dates) that round-trips through the input parser, and `monthlyPayment` matching all published P&I anchors to the cent. All Phase 7 dependencies are installed in this plan.

Advances requirement **INV-01** (left open until the 07-21 phase gate).

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Dependency installs, core subpath exports, exact money primitives | 8522b86 (RED), faa6aca (GREEN) |
| 2 | Single display formatter | b1a3faa (RED), 6c39576 (GREEN) |
| 3 | Amortizing monthly payment | 9f92a93 (RED), 1aadf8b (GREEN) |

## Dependencies

- `packages/core/package.json` devDependencies: `"fast-check": "4.10.2"`
- `apps/web/package.json` dependencies: `"layerchart": "2.5.1"` (`@tran/core` was already `workspace:*`)
- **runed version count:** `corepack pnpm ls -r runed --depth Infinity` resolves **two** versions: 0.37.1 (app + layerchart) and 0.35.1. The 0.35.1 copy was already in the lockfile at HEAD before this plan and comes from `bits-ui@2.19.2` (and its `svelte-toolbelt@0.10.6`), which declares `runed` 0.35.x as a direct dependency. Layerchart adds no new runed copy. See deviation 1.

## Verification

- `vitest run --project core money` 71 passed; `format` 44 passed; `amortization` 16 passed.
- Full core project: 1418 passed. The only failures (73) are in `src/numbers/**`, the 07-02 parallel plan's RED tests, outside this plan's scope.
- `tsc --noEmit` (core): no errors in finance/ or format/. The only errors are in 07-02's `src/numbers/numbers.test.ts`.
- Prettier check clean on all touched files.
- Mutation test: replacing `mulBps`'s trunc/remainder rounding with `Math.round(n / 10000)` fails 2 tests (the negative half-cases and the BigInt property). Reverted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug avoided] No runed override**
- **Found during:** Task 1
- **Issue:** The plan says to add `overrides: { runed: 0.37.x }` if two runed versions resolve. Two versions do resolve, but the 0.35.1 copy predates this phase and is bits-ui's own direct dependency. Forcing bits-ui (0.x semver, `^0.35` means <0.36) onto 0.37 would break its dependency range and could break every dialog, select and popover in the app.
- **Fix:** No override. Layerchart was verified to resolve the app's runed 0.37.1, which is the case the plan's check is meant to protect against (CLAUDE.md: "align your runed to 0.37.x").
- **Files modified:** none

**2. [Rule 1 - Bug] The `P·n ≥ L` property is false for small principals as written**
- **Found during:** Task 3
- **Issue:** Because of per-payment rounding, a 1-cent loan at 0.5%/30y gives P = 0, so P·n = 0 < 1. fast-check would find this right away.
- **Fix:** The property is now `P ≥ divRoundHalfAway(L, n)` and `P·n + n/2 ≥ L` over the full principal range, plus a strict `P·n ≥ L` property for L ≥ $1,000 and rate ≥ 1%. That gives 6 `fc.property` calls in total.
- **Files modified:** packages/core/src/finance/amortization.test.ts
- **Commit:** 9f92a93

**3. [Rule 3 - Blocking] finance/index.ts staged in two steps**
- Task 1's barrel exports only `./money.js`, because `amortization.ts` did not exist yet and the type check would fail. Task 3 appended `./amortization.js`.

**4. Core exports kept additive**
- The plan's literal exports object would have dropped the existing `./*` and `./renter/*` entries that Phases 4–6 rely on. The four explicit entries were added and the wildcards kept.

## Known Stubs

None. `./numbers` and `./markets` subpath targets are created by plans 07-02 and 07-06.

## Self-Check: PASSED
