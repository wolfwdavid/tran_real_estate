---
phase: 10-launch-hardening-go-to-market
plan: 12
subsystem: tools
tags: [calculators, svelte5-runes, a11y, gtm-03, marketing-safe, bundle-budget]
requires:
  - 10-03 (lib/components/tools is inside the MARKETING_SAFE lint boundary)
  - 10-08 (capRateCalc, cashOnCashCalc, dscrCalc, validateToolField, formatMoneyInput, toolMoney/toolPercent/toolRatio)
  - 10-10 (TOOLS[slug].fields/announce/emptyBody/..., SHARED_TOOL_COPY)
provides:
  - "lib/components/tools/calculator-form.svelte.ts: createCalculatorForm(fields, { announce, summary }) -> { values, errors, touched, parsed, isExample, blur(id), submit(), fill(), clear() }; pure errorMessage, parseAll, isExample, fillAnnouncement, markNegative; type CalculatorForm"
  - "lib/components/tools/CapRateCalculator.svelte, CashOnCashCalculator.svelte, DscrCalculator.svelte: prop-less, mount directly on the tool pages"
  - "lib/components/tools/CalculatorShell.svelte { headingId, fields, form, results: Snippet }, NumberField, ResultRows, EmptyResult, Headline"
  - "@tran/core exports './finance/*' -> src/finance/*.ts (deep imports that skip the finance barrel)"
affects: [10-13 (tool pages mount the calculators), 10-14 (E2E example figures, zero-network, axe states), 10-22/10-23 (budget + a11y audit)]
tech-stack:
  added: []
  patterns:
    - Runes form factory in a .svelte.ts module: $state values/touched, $derived errors/parsed, one $effect for the 750 ms debounced announcement (timer cleared on change and on destroy)
    - Errors appear once a field is touched (blur or submit) and then track the value live
    - Calculators import @tran/core/finance/calculators and /tool-inputs directly, never the finance barrel
key-files:
  created:
    - apps/web/src/lib/components/tools/calculator-form.svelte.ts
    - apps/web/src/lib/components/tools/calculator-form.test.ts
    - apps/web/src/lib/components/tools/NumberField.svelte
    - apps/web/src/lib/components/tools/CalculatorShell.svelte
    - apps/web/src/lib/components/tools/ResultRows.svelte
    - apps/web/src/lib/components/tools/EmptyResult.svelte
    - apps/web/src/lib/components/tools/Headline.svelte
    - apps/web/src/lib/components/tools/CapRateCalculator.svelte
    - apps/web/src/lib/components/tools/CashOnCashCalculator.svelte
    - apps/web/src/lib/components/tools/DscrCalculator.svelte
    - apps/web/src/lib/components/tools/calculators.browser.test.ts
  modified:
    - packages/core/package.json (exports "./finance/*")
decisions:
  - "Field DOM ids are `${headingId}-${field.id}` (cap-rate-price, dscr-loanAmount, ...) so ids never collide; accessible names are '<label>, in dollars|as a percent|in years'"
  - "Enter is handled by NumberField (onenter -> validate). The form has several text inputs and no submit button, so browsers never submit it implicitly; the onsubmit handler stays for completeness"
  - "Buttons are plain <button> elements with the button token classes, not the shadcn Button copy-in, so tool pages don't pull in tailwind-variants"
  - "markNegative adds '(negative)' to any U+2212 value in all three calculators (headline and rows), not only cash-on-cash rows, per the Accessibility Contract ('negative values carry the word negative')"
  - "The debounced announcer skips a summary identical to the last one announced (for example, a blur that only reformats '250000' to '250,000'); Clear resets that memory"
  - "Cash-on-cash with $0 total cash invested (ratio null) shows the headline label plus 'With no cash invested, there is no cash-on-cash return to show.' and the rows; DSCR with a null ratio uses the not-applicable display"
  - "DSCR interpretation compares the raw ratio (>= 1 covers), which is the arithmetic truth, rather than the rounded display"
requirements-completed: [GTM-03]
metrics:
  duration: ~25 min
  completed: 2026-10-13
  tasks: 2
  files: 12
---

# Phase 10 Plan 12: Zero-call calculators Summary

Three marketing-safe Svelte 5 calculators (cap rate, cash-on-cash, DSCR) over the @tran/core finance math, on a shared runes form helper with tested UI-SPEC validation copy, touched-gated errors linked by aria-describedby, and one polite summary announced 750 ms after the last valid change.

## What was built

- **calculator-form.svelte.ts**: pure `errorMessage` (required/nan/min/max/price-zero to UI-SPEC copy; money limits print as dollars), `parseAll` (cents for money, optional blanks are 0, failing ids in field order), `isExample`, `fillAnnouncement` (does not double a `%` already in the template), `markNegative`; plus `createCalculatorForm`.
- **NumberField**: visible label with a visually hidden unit suffix, 48px input group with focus ring on the wrapper, aria-hidden `$` / `%` / `years` adornment, `inputmode` decimal or numeric, helper and error slot (CircleAlert + text) in `aria-describedby`, `aria-invalid`, and a `border-destructive` wrapper on error.
- **CalculatorShell**: inputs card (`h2` Your numbers, fields 16px apart, Fill in an example (outline + Calculator icon, focus stays) and Clear (ghost, focuses the first input, announces "Calculator cleared."), example note only while the values equal the examples) and results card (`section aria-labelledby`, `h2` Your results, `lg:sticky lg:top-6`, NOT a live region). 7fr/5fr grid from 1024px.
- **ResultRows** `<dl>` with ruled rows, term-over-value below 375px, `[overflow-wrap:anywhere]` on `<dd>`.
- **Calculators**: empty state (Calculator icon + emptyBody + emptyTail), result state (headline label, Fraunces value, definition, rows), DSCR not-applicable state (reason sentence + NOI row) and the covers / doesn't-cover line.

## Verification (real output)

- `vitest run --project web calculator-form`: 16 passed (includes the UI-SPEC example figures through parseAll and core: cap rate 6.24% with $15,600 / $22,800 / $7,200; cash-on-cash 0.90% with $631 / $53 / $70,000 / $1,247 / $15,600; DSCR 1.04 with $15,600 / $14,969 / $1,247 / $631; $0 loan is not applicable).
- `vitest run --project web-browser calculators.browser`: 4 passed (empty / example / invalid / not-applicable states each axe-clean; no aria-live in the calculator; exactly the announcement "Cap rate 6.24%. Net operating income $15,600 a year."; Clear focuses "Purchase price, in dollars" and announces "Calculator cleared."; blur shows the error and links it by aria-describedby; blur reformats to 250,000; Enter focuses the first invalid field).
- `vitest run --project web`: 173 files, 2585 tests passed. `vitest run --project core`: 87 files, 2701 tests passed.
- `pnpm check`: 0 errors, 0 warnings. `pnpm lint`: exit 0. `pnpm banned`: passed (409 files). `pnpm ui:guard`: passed (79 files).
- Acceptance greps: `aria-live` count in CalculatorShell = 0; no `bits-ui` / `$lib/storage` / `$lib/data` / `$lib/ai` under components/tools; no `fetch(`; no "good/bad/safe deal|investment|rate".
- Full `pnpm test:unit` (all projects incl. the whole browser suite) was NOT run as one command; the node `web` and `core` projects and this plan's browser file were run instead. No build or Playwright E2E was run (no pages mount the calculators yet), so the build lock was never taken.

## JS budget measurement (orchestrator asked for numbers)

No route mounts the calculators yet (10-13), so `scripts/assert-budget.mjs` cannot measure them. I measured each component with a throwaway Vite library build (minified, gzip, Svelte runtime external):

| Component | Before deep imports | After | After, excluding tools.ts copy + announcer + lucide Icon base |
|-----------|--------------------|-------|------------------------------------|
| CapRateCalculator | 12.1 KB gz | 10.5 KB gz | 5.3 KB gz |
| CashOnCashCalculator | 12.4 KB gz | 10.9 KB gz | 5.7 KB gz |
| DscrCalculator | 12.4 KB gz | 10.9 KB gz | 5.7 KB gz |

The `@tran/core/finance` barrel was pulling in reference cases, memo copy and defaults (~10 KB raw); fixed with a `./finance/*` export and deep imports. The largest remaining piece is `content/tools.ts` (14 KB raw, about 4.5 KB gz). The tool page needs that copy anyway for its FAQ and header, so it is shared. **Risk for 10-13:** calculator-only cost (~5.7 KB gz) plus tools.ts (~4.5 KB gz) is more than the ~6.5 KB headroom unless the layout already carries some of it. If 10-13 goes over, the obvious lever is splitting `content/tools.ts` per slug so each page ships only its own tool's copy. I did not raise any budget.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Enter did nothing in the calculator form**
- **Found during:** Task 2 (browser test)
- **Issue:** with several text inputs and no submit button, browsers never submit a form implicitly, so "Enter re-validates" could not work through `onsubmit`.
- **Fix:** NumberField takes an `onenter` callback (keydown Enter, preventDefault), and the shell runs the same validate-and-focus-first-invalid path. A form-level keydown was rejected because it trips Svelte's a11y_no_noninteractive_element_interactions warning.
- **Files:** NumberField.svelte, CalculatorShell.svelte. **Commit:** f9a62e4

**2. [Rule 3 - Blocking/budget] Finance barrel blew the per-route JS budget**
- **Found during:** post-task budget measurement
- **Fix:** `"./finance/*": "./src/finance/*.ts"` export in packages/core/package.json; calculators import `@tran/core/finance/calculators` and `/tool-inputs`. **Commit:** 6b3f4a5

**3. [Rule 2 - Accessibility] Negative values are never sign-by-color only**
- `markNegative` applies "(negative)" across all three calculators (the plan named only cash-on-cash rows). **Commit:** f9a62e4

### Additions beyond the file list
- `EmptyResult.svelte` and `Headline.svelte` (shared result pieces, keeps each calculator small), `calculators.browser.test.ts` (state + axe coverage). CalculatorShell derives the first input from `fields[0]` instead of taking a `firstInputId` prop.
- New copy string (not in the UI-SPEC): cash-on-cash zero-cash-invested sentence "With no cash invested, there is no cash-on-cash return to show." (banned-terms clean). Flag for copy review.

## Known Stubs

None. The components are complete; mounting them on pages is plan 10-13 by design.

## Commits

- 43e9aed test(10-12): add failing calculator form tests
- fda1073 feat(10-12): calculator shell, fields and form state
- f9a62e4 feat(10-12): cap rate, cash-on-cash and DSCR calculators
- 6b3f4a5 perf(10-12): import calculator math by module, not the finance barrel

## Self-Check: PASSED
