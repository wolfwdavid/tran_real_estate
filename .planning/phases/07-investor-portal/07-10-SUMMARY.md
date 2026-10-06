---
phase: 07-investor-portal
plan: 10
subsystem: investor-analyzer-inputs
tags: [analyzer, forms, validation, masking, expense-lines, a11y, svelte5]
requires:
  - "07-01: parseMoneyInput / parsePercentInput / parseRateInput, usd / pctTrim"
  - "07-05: DealInputs, defaultExpenseLines, DEFAULT_* constants, MAX_CUSTOM_LINES, convertExpenseUnit, lineMonthlyCents, analyze, REFERENCE_CASES"
provides:
  - "analyzer/form-model.ts: AnalyzerForm, ExpenseLineForm, defaultForm, parseForm, validateField, fieldName, FIELD_ERROR_COPY, FIELD_NAMES, FIELD_IMPACT, inputsToForm, formatOnBlur, addCustomLine, removeLine, canAddCustomLine, lineToForm, lineFromForm, centsToText, bpsToText"
  - "analyzer/expense-lines.ts: convertLineUnit (conversion + announcement), computedText, lineContext, lineLabel, UNIT_LABELS"
  - "MoneyInput / PercentInput / NumberInput (thin wrappers over NumericField), UnitToggle, ExpenseLines"
  - "analyzer/testing/ExpenseLinesHarness.svelte (browser-test harness)"
affects: [07-12 analyzer page, 07-15 FieldSource chip, saved deals round trip]
tech-stack:
  added: []
  patterns: [raw-string form model with substitute-and-mask, blur-only validation, native radios as segmented control, pure helper module behind a component for testable copy]
key-files:
  created:
    - apps/web/src/lib/features/investor/analyzer/form-model.ts
    - apps/web/src/lib/features/investor/analyzer/form-model.test.ts
    - apps/web/src/lib/features/investor/analyzer/NumericField.svelte
    - apps/web/src/lib/features/investor/analyzer/MoneyInput.svelte
    - apps/web/src/lib/features/investor/analyzer/PercentInput.svelte
    - apps/web/src/lib/features/investor/analyzer/NumberInput.svelte
    - apps/web/src/lib/features/investor/analyzer/UnitToggle.svelte
    - apps/web/src/lib/features/investor/analyzer/ExpenseLines.svelte
    - apps/web/src/lib/features/investor/analyzer/expense-lines.ts
    - apps/web/src/lib/features/investor/analyzer/inputs.ssr.test.ts
    - apps/web/src/lib/features/investor/analyzer/ExpenseLines.browser.test.ts
    - apps/web/src/lib/features/investor/analyzer/testing/ExpenseLinesHarness.svelte
  modified: []
decisions:
  - "Blank down payment or blank loan term (mortgage) masks the financing metrics with no error (no safe meaning); blank closing/repairs/other income count as 0 without masking; a blank or invalid rate goes to core as null so core's 'Needs interest rate' reason applies"
  - "Invalid closing substitutes the default 3% (pct) or $0 (usd); invalid expense amounts go to core as null (counts as 0, keeps tax/insurance 'missing' flags honest); the first invalid field wins a shared masked metric"
  - "ExpenseLines renders the fieldset CONTENTS (note, rows, add/cap note, footer); the page (07-12) owns the fieldset card + 'Operating expenses' legend so all five fieldsets share one shell"
  - "Expense amount inputs keep a real <label for> but visually hidden ('{Line} amount, in percent'); the visible line name labels the row group"
  - "Without an analysis (price missing) unit conversion uses rent for every base; with one it uses the analysis GSI/EGI so management converts on collected income"
  - "Row DOM order is name, amount, toggle, remove (desktop reading order); on mobile the remove button is grid-placed beside the name"
metrics:
  duration: ~50min
  completed: 2026-10-05
  tasks: 3
  files: 12
---

# Phase 7 Plan 10: Analyzer input layer Summary

The analyzer now has its whole input layer: a raw-string form model that parses with the exact core parsers, validates on blur with the verbatim UI-SPEC copy, and masks only the metrics an invalid optional field feeds. It also has accessible money, percent and number inputs, a segmented unit toggle that uses native radios and a Check icon, and the expense-lines editor. That editor converts units without changing the monthly dollars, caps custom lines at 12, and announces each change.

Advances requirement **INV-01** ("with editable expense lines"). `requirements mark-complete` was deliberately not run; the 07-21 phase gate closes it.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Analyzer form model (parse, validate, mask, round-trip) | 8f2c615 (RED), c236445 (GREEN) |
| 2 | Money/percent/number inputs and the segmented UnitToggle | 547083b (RED), c321ed9 (GREEN) |
| 3 | ExpenseLines editor with conversion, custom lines and totals | 187e70c (RED), c34ae5e (GREEN) |

## Verification

- `vitest run --project web form-model inputs.ssr`: 125 passed (97 model + 28 SSR/helper).
- `vitest run --project web-browser ExpenseLines`: 7 passed. These cover add focus, remove focus (to the next name field or to Add expense line), the cap at the 12th line, the unit switch ($152 management on $1,900 collected) with its announcement and onvalidate, arrow-key radio movement, blur-only validation (typing never calls onvalidate; blur formats `1234.5` → `1,234.50` and validates once), and axe `[]`.
- Full `web` project: 92 files, 1571 tests passed.
- `pnpm --filter web check`: 0 errors, 0 warnings. ESLint and Prettier are clean on analyzer/. `pnpm banned` passed (215 files). `pnpm ui:guard` passed. The hex/`dark:` grep finds nothing.
- Acceptance greps: the three copy strings are in form-model.ts, and ExpenseLines.svelte contains `Add expense line`, the cap note, `Operating expenses:` and `convertExpenseUnit`. MoneyInput has no `oninput`, and an SSR test asserts that none of the four input files contain one.
- **Mutation testing.** form-model.ts got 10 mutants, applied one at a time and reverted, and all 10 were killed: mask overwrite (`??=` → `=`), term `<= 40` → `< 40`, bedrooms `<= 20` → `< 20`, the cash guard on down payment removed, blank-down masking removed, expense masking removed, invalid expense substituted with 0 instead of null, money negative mapped to not-a-number, invalid rate substituted with 0, and the cents-text fraction check. expense-lines.ts got 5 mutants and all were killed: the rent guard, the no-rent guard on percent lines, EGI replaced by GSI as the management base, the zero-base blank handling and the name trim. The EGI mutant survived at first; a `lineContext` test was added before the commit and now kills it.

## Deviations from Plan

### Auto-fixed / additions

**1. [Rule 3 - Structure] Shared `NumericField.svelte` plus thin wrappers.** MoneyInput, PercentInput and NumberInput would have repeated about 60 lines of label, adornment, error and chip markup three times. They are now one-line wrappers that fix kind, hidden unit, adornment and inputmode. NumericField also takes `labelHidden` for the expense rows. Commits c321ed9 and c34ae5e.

**2. [Rule 2 - Testability] `expense-lines.ts` pure helper.** The conversion, its announcement copy and the computed lines live in a DOM-free module (`convertLineUnit`, `computedText`, `lineContext`), so the copy and math are unit-tested in node. ExpenseLines.svelte calls them and still runs core `convertExpenseUnit` through `convertLineUnit`.

**3. [Rule 2] Browser tests and a harness.** These were not in the plan's file list, but the prior-wave guidance requires focus behaviour to be covered in the browser project. Added `ExpenseLines.browser.test.ts` and `testing/ExpenseLinesHarness.svelte` (bound `$state`, in the same style as LocationFieldHarness).

**4. form-model API additions.** These are `fieldName(form, key)` (expense lines need the form to resolve their name), `canAddCustomLine`, `lineToForm`, `lineFromForm`, `centsToText` and `bpsToText`. `addCustomLine` and `removeLine` are generic over `Pick<AnalyzerForm, 'expenses'>`, so the editor can call them on just the rows. All of these add to the planned contract; nothing in it changed.

## Notes for 07-12 (page composition)

- Bind `form.expenses` to `<ExpenseLines bind:form>`. Pass `analysis` (null when not ready), `rentCents` (parsed rent or null), `errors` from `parseForm`, `onvalidate(key)` (run `validateField` and record the error), and optionally `announce` (defaults to the global LiveAnnouncer).
- Wrap ExpenseLines in the fieldset card with the legend "Operating expenses". The basis note has id `{idPrefix}-note`, which the fieldset can reference through aria-describedby.
- For masked metrics, show "—" plus `Needs ${fieldName(form, parsed.masked[metric])}`.

## Known Stubs

None.

## Self-Check: PASSED
