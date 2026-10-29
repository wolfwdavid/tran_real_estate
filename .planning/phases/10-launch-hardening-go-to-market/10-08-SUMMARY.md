---
phase: 10-launch-hardening-go-to-market
plan: 08
subsystem: core-finance
tags: [calculators, seo-tools, finance, validation, formatting, tdd]
requires:
  - Phase 7 finance core (monthlyPayment, mulBps, divRoundHalfAway, roundHalfAway)
  - Phase 7 formatters (usd, pct, ratio in @tran/core/format)
provides:
  - capRateCalc / cashOnCashCalc / dscrCalc + Input/Result types (@tran/core/finance)
  - parseToolNumber, validateToolField, FIELD_LIMITS, formatMoneyInput, toolMoney, toolPercent, toolRatio
affects:
  - SEO calculator tool pages (later Phase 10 plans) consume these; they add no formulas
tech-stack:
  added: []
  patterns:
    - Calculators are thin compositions of Phase 7 primitives; null (never NaN/Infinity) for zero denominators
    - Tool display strings delegate to the single Phase 7 formatter module
key-files:
  created:
    - packages/core/src/finance/calculators.ts
    - packages/core/src/finance/calculators.test.ts
    - packages/core/src/finance/tool-inputs.ts
    - packages/core/src/finance/tool-inputs.test.ts
  modified:
    - packages/core/src/finance/index.ts
decisions:
  - toolMoney/toolPercent/toolRatio delegate to Phase 7 usd / pct(x*100, 2) / ratio(x, 2), which already produce the UI-SPEC strings exactly, so there is no second formatter
  - Phase 7 rounding helpers (roundHalfAway, divRoundHalfAway) are imported rather than redefined; cashFlowMonthly = divRoundHalfAway(cashFlowYearly, 12)
  - The analyze() mapping exists (vacancy pct line + one custom usd opex line); a test asserts capRateCalc NOI == analyze().noiAnnual for the UI-SPEC example
  - Fractional loan terms map to 'nan' (whole years only) and are checked before the range; price-zero is checked after the range
  - Not re-exported from the @tran/core root, because the root index does not re-export finance; consumers import @tran/core/finance
requirements-completed: [GTM-03]
metrics:
  duration: ~6 min
  completed: 2026-10-13
  tasks: 2
  files: 5
---

# Phase 10 Plan 08: SEO Calculator Core Math Summary

The cap rate, cash-on-cash and DSCR calculators are now pure functions in `@tran/core/finance`, built on Phase 7's `monthlyPayment`, `mulBps` and `divRoundHalfAway`. Input parsing and validation return typed error codes, and display strings go through the shared `usd`, `pct` and `ratio` formatters. The UI-SPEC examples are reproduced exactly, down to the cent: payment 124,744, NOI 1,560,000, cash flow 63,072, cash invested 7,000,000, debt service 1,496,928.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Calculator functions over Phase 7 primitives | 651cf3b (RED), f7675c5 (GREEN) |
| 2 | Tool input parsing, validation and display formatting | 2730312 (RED), 60891aa (GREEN) |

## Verification (real output)

- `corepack pnpm vitest run --project core calculators`: RED failed (module missing). GREEN passed with 12/12 tests.
- `corepack pnpm vitest run --project core tool-inputs calculators`: 2 files, 49/49 tests passed.
- `corepack pnpm vitest run --project core` (full core suite, checks for Phase 7 regressions): 87 files, 2701/2701 tests passed.
- `corepack pnpm --filter @tran/core check` (tsc --noEmit): clean.
- `corepack pnpm lint` (prettier --check + eslint): exit 0.
- `grep -c "Math.pow" packages/core/src/finance/calculators.ts`: 0. A test also asserts that `monthlyPayment` is imported from `./amortization.js`.
- The repo-wide `corepack pnpm check` failed with **35 errors, all in `scripts/assert-csp.mjs`**. That file has uncommitted edits from another parallel Wave 2 executor, and this plan does not touch it. Out of scope; flagged for the orchestrator's post-wave check.

## Deviations from Plan

- **[Rule 1 - Bug] I typed a literal U+2212 into a doc comment in tool-inputs.ts.** I replaced it with `MINUS + "$120"` before committing. None of the plan's files contain a non-ASCII character.
- Prettier reformatted the two new test files before the Task 2 commit, and that commit includes the formatting.
- I added extra cases beyond the plan's bullets: other income added before vacancy, negative monthly cash flow, a negative toolPercent, and money boundary values ($0.29, $100,000,000). No behavior changed.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: packages/core/src/finance/calculators.ts, calculators.test.ts, tool-inputs.ts, tool-inputs.test.ts
- FOUND commits: 651cf3b, f7675c5, 2730312, 60891aa
