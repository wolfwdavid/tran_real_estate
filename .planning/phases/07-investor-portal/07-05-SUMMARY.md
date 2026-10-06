---
phase: 07-investor-portal
plan: 05
subsystem: finance-core
tags: [finance, analyzer, reference-cases, fast-check, mutation-testing]
requires:
  - "07-01: Cents, MAX_CENTS, mulBps, divRoundHalfAway, monthlyPayment, centsArb/bpsArb/rateArb/termArb"
provides:
  - "@tran/core/finance: analyze(DealInputs): DealAnalysis, ANALYZER_VERSION = 1"
  - "@tran/core/finance: ExpenseLine/DealInputs/DealAnalysis/Financing/ClosingCosts/NullReason/MissingInput types"
  - "@tran/core/finance: DEFAULT_EXPENSE_LINES, defaultExpenseLines(), DEFAULT_CLOSING, DEFAULT_DOWN_BPS, DEFAULT_TERM_YEARS, BUY_BOX_EXPENSE_BPS, MAX_CUSTOM_LINES"
  - "@tran/core/finance: METRIC_DEFINITIONS (verbatim UI-SPEC wording) + CONVENTIONS"
  - "@tran/core/finance: lineBaseCents, lineMonthlyCents, convertExpenseUnit, validateDealInputs, LineContext, InputError"
  - "@tran/core/finance: REFERENCE_CASES A-I (exact expected values, worked math in comments)"
  - "packages/core/src/finance/arbitraries.ts: dealArb, financingArb, expenseLinesArb (test-only)"
affects: [07-07+ analyzer UI, compare view, buy-box quick metrics, memo FACTS, print report]
tech-stack:
  added: []
  patterns: [integer-cents pipeline with ratios computed last, null-with-reason for undefined ratios, single definitions object, operator mutation testing against reference cases]
key-files:
  created:
    - packages/core/src/finance/types.ts
    - packages/core/src/finance/defaults.ts
    - packages/core/src/finance/definitions.ts
    - packages/core/src/finance/expenses.ts
    - packages/core/src/finance/expenses.test.ts
    - packages/core/src/finance/analyze.ts
    - packages/core/src/finance/analyze.test.ts
    - packages/core/src/finance/reference-cases.ts
    - packages/core/src/finance/reference-cases.test.ts
    - packages/core/src/finance/properties.test.ts
  modified:
    - packages/core/src/finance/arbitraries.ts
    - packages/core/src/finance/index.ts
decisions:
  - "UI copy vs math bases reconciled: unit segments read '% of rent' / '$ per month' (UI-SPEC verbatim) while the math uses vacancy on GSI and management on EGI; the computed '= $x a month' line shows the true dollars, so the bases are visible in results"
  - "Dollars-to-percent conversion rounds to the nearest whole basis point (mulBps needs integer bps for exactness); percent-to-dollars is exact and a pct->usd->pct round trip is lossless; usd->pct->usd is within the 0.01% resolution of the base"
  - "Null-reason priority: a blank rate (needs-interest-rate) wins over no-cash-invested for CoC; DSCR is 'no-loan' whenever the payment is 0 (all cash, 100% down, or a loan that rounds to a 0 payment)"
  - "missing flags property-tax/insurance only when every line of that kind is blank; interest-rate only when there is a loan to price"
  - "validateDealInputs reports non-integer/non-finite numbers as out-of-range and negative bps/cents as negative; line errors are keyed expenses.<line id>"
metrics:
  duration: ~20min
  completed: 2026-10-06
  tasks: 3
  files: 12
---

# Phase 7 Plan 05: Pure deal analyzer Summary

`analyze()` turns a deal (price, closing, repairs, financing, rent, other income and editable expense lines) into NOI, cap rate, monthly cash flow, cash-on-cash, DSCR, GRM and the 1% rule in exact integer cents. It reproduces all nine hand-checked reference deals (A-I) exactly, returns null with a reason for every undefined ratio, and holds six fast-check invariants over 500 random deals each. One `METRIC_DEFINITIONS` object carries the UI-SPEC labels and definitions word for word.

Advances requirement **INV-01** (left open until the 07-21 phase gate; `requirements mark-complete` deliberately not run).

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Types, defaults, definitions and the expense-line model | 89fdc27 (RED), 25c45b5 (GREEN) |
| 2 | analyze() and the nine exact reference cases | d4a7107 (RED), fa43343 (GREEN) |
| 3 | fast-check invariants over random deals | 9de7728 |

## Verification

- `vitest run --project core expenses`: 39 passed. `reference-cases analyze`: 24 passed (9 reference cases + 15 null/missing/basics). `properties`: 7 passed (validity + invariants 1-6, numRuns 500 each).
- Full core project: **53 files, 1606 tests passed**.
- `pnpm --filter @tran/core check` (tsc): clean. `pnpm lint` (prettier + eslint, whole repo): clean.
- Acceptance greps: "It leaves out financing." 1; "bps: 800" 1; "cents: null" 4; "BUY_BOX_EXPENSE_BPS = 4000" 1; `Math.round(` in analyze.ts 0; `EGI =` comment blocks 9; all nine titles and the anchor literals (106_448, 223_749, -114_999, 5_925_307, 59_955) present.
- **Mutation testing (reference + analyze suites):** 15 operator/operand mutants, each applied alone and reverted: EGI sign, NOI sign, cash-flow sign, cap rate monthly-for-annual, repairs dropped from cash invested, DSCR without ×12, GRM on GSI instead of rent, 1% rule `>=` → `>`, vacancy counted in OpEx, CoC over down payment only, rent-to-price on GSI, loan = price − closing, vacancy base rent instead of GSI, management base GSI instead of EGI, dollar lines +1 cent. **All 15 killed** (1 to 13 failing tests each).
- Property-suite mutants: 1% `>=` → `>` (killed), vacancy in OpEx (killed), cash-only EGI skew (killed). A cap-rate divide-by-zero mutant is not reachable by the properties because `dealArb` keeps price ≥ 1 cent (per the plan's bounds); `analyze.test.ts` "price 0" covers that guard.

## Deviations from Plan

None that change behavior. Additions within the plan's intent:
- `expected` in `REFERENCE_CASES` also carries per-line cents, extra integers (GSI, expensesInclVacancy, down payment) and ratios computed from the worked math (e.g. B GRM, G rent-to-price 0) beyond the bullets; every case also asserts `validateDealInputs(inputs) === []` and `missing === []`.
- `arbitraries.ts` exports `financingArb` and `expenseLinesArb` alongside `dealArb` (property 3 needs a second financing). Property (0) asserts every generated deal validates.
- Property 4 caps the percent lines at 6000 bps by proportional scaling instead of `fc.pre`, so no runs are discarded.
- `reference-cases.ts` is exported from the finance barrel as the plan says. It is plain data with no fast-check import.

## Known Stubs

None.

## Self-Check: PASSED
