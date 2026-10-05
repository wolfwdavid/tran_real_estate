---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 02
subsystem: data-layer/budget
tags: [budget, quota, rentcast, pure-functions, tdd]
requires: []
provides:
  - "@tran/core/budget barrel: periodKey, resetsAt, daysInPeriod, isBilled, summarize, PENDING_STALE_MS, validateCap, matchesOverageWord, canSpend, meterState, meterTransition, confirmVariant, overageCostUsd, projectedBurn, formatCount, formatUsd, formatMonthDay, PLAN_LIMIT, DEFAULT_CAP, CAP_MIN, CAP_MAX, OVERAGE_USD, METER_THRESHOLDS"
affects: [04 gateway, CallMeter, CapEditor, CapConfirmDialog, CapAboveLimitDialog]
tech-stack:
  added: []
  patterns: ["clock injected as a parameter (no Date.now() in non-test code)", "billed derived from status via isBilled(), never stored", "single exported threshold constants"]
key-files:
  created:
    - packages/core/src/budget/index.ts
    - packages/core/src/budget/period.ts
    - packages/core/src/budget/policy.ts
    - packages/core/src/budget/usage.ts
    - packages/core/src/budget/cap.ts
    - packages/core/src/budget/projection.ts
    - packages/core/src/budget/format.ts
    - packages/core/src/budget/budget.test.ts
    - packages/core/src/budget/cap.test.ts
  modified: []
decisions:
  - "Billing period = UTC calendar month; renewalDay param reserved, any value but 1 throws RangeError"
  - "Only HTTP 200 is billed (one-line isBilled policy); pending rows >= 120 s old count as billed (conservative)"
  - "Meter: past (used >= 50) outranks at/near; transitions announce only on worsening, never on first load"
metrics:
  duration: "~6 min"
  completed: 2026-10-05
  tasks: 2
  files: 9
---

# Phase 4 Plan 02: Budget Math Summary

Pure, DOM-free, clock-injected RentCast budget math in `packages/core/src/budget`: UTC-month billing period, 200-only billing policy, ledger summary with stale-pending-as-billed, cap validation with the "overage" confirmation word, ok/near/at/past meter with worsening-only transitions, confirm-dialog variant, integer-cents overage cost, projected burn and en-US formatting. 57 tests.

## Tasks

| Task | Name | Commits |
| ---- | ---- | ------- |
| 1 | Period, policy, usage summary, projection, formatting | abcc526 (RED), 37602ed (GREEN), c5e1ee3 (prettier) |
| 2 | Cap validation, meter state, transitions, confirm variant | 9ac6ba7 (RED), 48ee149 (GREEN) |

## Verification

- `corepack pnpm vitest run --project core budget/` : 2 files, 57 tests pass.
- `tsc --noEmit` in packages/core: zero errors in `src/budget/`. The package-wide `check` currently fails only on `src/request/canonical.test.ts` (plan 04-03, in flight in the same wave) — not this plan's files.
- `grep -c "Date.now()"` = 0 for every budget file.
- Mutation: `nearMaxLeft: 5` -> `6` made `vitest run --project core cap` fail (2 tests); reverted, file byte-identical (committed version unchanged).
- Prettier + ESLint clean on `packages/core/src/budget`. Repo-wide `pnpm lint` still flags other plans' files (alerts/*.test.ts, request/errors.ts) — out of scope.
- Full `vitest run --project core` shows failures only in `src/request/` and `src/listings/` (other wave-1 plans' RED/in-progress tests).

## Deviations from Plan

- Added an extra formatting commit (`style(04-02)`, c5e1ee3) because Prettier reformatted `budget.test.ts` after GREEN. No behavior change.
- Tests cover a few extra boundaries beyond the plan bullets (pending exactly at 120 000 ms, renewalDay RangeError, projectedBurn on the 1st, overageCostUsd(50/51), explicit planLimit).

## Notes for Downstream Plans

- `@tran/core/budget` subpath export (`"./*": "./src/*/index.ts"`) had not yet landed in packages/core/package.json at completion time; it is plan 04-01's responsibility. Tests import relatively (`./index.js`), so nothing here depends on it.

## Known Stubs

None.

## Self-Check: PASSED
