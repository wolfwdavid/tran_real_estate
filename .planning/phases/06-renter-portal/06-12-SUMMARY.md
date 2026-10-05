---
phase: 06-renter-portal
plan: 12
subsystem: renter/affordability
tags: [renter, affordability, slider, shadcn-svelte, zero-call, no-persistence, e2e, axe]
requires:
  - "06-02 @tran/core/renter/affordability (parseMoneyInput, affordability, rentFeedback, landlordIncome, moveInCash, sliderMax)"
  - "06-03 @tran/core/renter/format formatRent"
  - "06-04 /renter/affordability/ route shell (title, h1, lead, unique meta description)"
  - "06-05 shared/affordability lint boundary (no storage/data/ai/portal imports)"
  - "06-09 renter E2E harness (deny-all net fixture, mockRentCast, withRentCastKey)"
provides:
  - "$lib/components/ui/slider (shadcn-svelte copy-in, Phase 2 tokens, `thumbProps` ARIA passthrough to the role=slider thumb)"
  - "$lib/features/shared/affordability: AffordabilityCalculator, AffordabilityForm, AffordabilityResult, GoodToKnow (barrel index.ts)"
  - "/renter/affordability/ filled with the calculator and the privacy line"
  - "renter-affordability.spec.ts (7 tests x root/sub)"
affects: [Phase 10 marketing affordability page, 06-22 renter gate]
tech-stack:
  added: []
  patterns:
    - "Slider thumb ARIA via a narrow `thumbProps` interface (aria-label/labelledby/describedby/valuetext); the 20px visual thumb is an aria-hidden child of a 44px hit-area thumb, focus ring via group-focus-visible"
    - "Inputs settle 300ms after typing stops into a `settled` $state snapshot; the announcement fires 700ms later (1,000ms total)"
    - "Tried rent is `null` = top of range; a primitive $derived `high` resets it only when the top changes"
    - "Slider and number input share one value through a Svelte 5 function binding (`bind:value={() => rent, (v) => (tried = v)}`)"
key-files:
  created:
    - apps/web/src/lib/components/ui/slider/index.ts
    - apps/web/src/lib/components/ui/slider/slider.svelte
    - apps/web/src/lib/features/shared/affordability/AffordabilityCalculator.svelte
    - apps/web/src/lib/features/shared/affordability/AffordabilityForm.svelte
    - apps/web/src/lib/features/shared/affordability/AffordabilityResult.svelte
    - apps/web/src/lib/features/shared/affordability/GoodToKnow.svelte
    - apps/web/src/lib/features/shared/affordability/index.ts
    - apps/web/src/lib/features/shared/affordability/affordability.test.ts
    - apps/web/src/lib/features/shared/affordability/affordability.browser.test.ts
    - apps/web/tests/e2e/renter-affordability.spec.ts
  modified:
    - apps/web/src/routes/(app)/renter/affordability/+page.svelte
key-decisions:
  - "'Rent that fits: up to {$high} a month' is the derived heading (and announcement) for the onlyTop case only; the debts note follows it when debtsNote is true"
  - "The move-in line drops its second sentence ('Your savings cover {$s}.') when savings is 0 or blank, rather than saying 'Your savings cover $0.'"
  - "The search CTA is hidden when the top of the range is $0 (debts exceed the 40% check), so it never offers 'Search rentals up to $0'"
  - "Income error 'Enter your income before taxes, like 60,000.' shows for invalid input immediately and for blank/0 only after blur; negative income and invalid/negative debts or savings show 'Use a number of 0 or more.'"
  - "Period chips are native radios (one shared name) in a role=radiogroup labelled by the 'Income before taxes' label; the paired rent number input is named 'Try a rent amount a month' via aria-labelledby"
requirements-completed: []
metrics:
  duration: ~35 min
  completed: 2026-10-05
  tasks: 2
  files: 11
---

# Phase 6 Plan 12: Zero-call affordability calculator Summary

**A reusable, persistence-free affordability calculator in `features/shared/affordability` that composes the 06-02 core math into the UI-SPEC form, range, breakdown, "Try a rent amount" slider with a paired number input, honest feedback lines, a prefilling search CTA and the "Good to know" callout, mounted at `/renter/affordability/` and proven by E2E to make zero network requests and save nothing.**

## What was built

- **Slider copy-in** (`shadcn-svelte@1.6.1 add slider --yes --no-deps`, official registry; bits-ui already installed). Reconciled: 8px `bg-surface` track with a 1px `border-input`, `bg-primary` range, a 20px `bg-card` thumb with a 2px `border-primary` inside a 44px (`size-11`) hit area, Phase 2 outline focus on the visual thumb (`group-focus-visible:outline-*`). Removed `bg-muted`, `bg-white`, `ring-ring/50`, `hover:ring-4`, `shadow-sm` and every vertical-orientation class. A narrow `thumbProps` prop passes `aria-labelledby`, `aria-valuetext` and `aria-describedby` to the bits-ui thumb (a broad `HTMLAttributes` type broke svelte-check with a "union too complex" error).
- **AffordabilityForm**: three money fields (`type="text"`, `inputmode="decimal"`, aria-hidden `$` prefix, `tabular-nums`, plain `<label>`/`<input>` with the Phase 3 look), **a year** / **a month** chips, helpers and errors verbatim, `aria-invalid` + `aria-describedby` wiring.
- **AffordabilityResult**: empty `bg-surface` panel; `<section aria-labelledby="afford-result">` with the h2 range heading, debts note, the four-row `<dl>`, the slider (0 to `sliderMax(high)`, step 25, `aria-valuetext="{$r} a month"`) paired with a number input, the three feedback sentences with `CircleCheck`/`TriangleAlert`/`CircleAlert` icons, landlord and move-in lines, and the `ButtonLink` CTA `resolve('/renter/') + '?max=' + high`.
- **GoodToKnow**: `bg-secondary-surface` callout, 4px `border-secondary` rule, `Info` icon, h3 and the three bullets verbatim.
- **AffordabilityCalculator**: all state in `$state`; 300ms settle; announcement "Rent that fits: {$low} to {$high} a month." 1,000ms after typing stops; one column below 1024px, `lg:grid-cols-2 gap-8` above with the result + callout column `lg:sticky lg:top-4`. Imports only `@tran/core/renter/*`, `$lib/components/**`, `@lucide/svelte` and `$app/paths`.
- **Route**: keeps the 06-04 title, meta description, h1 and lead; adds the `Lock` 14px privacy line and the calculator.

## Verification

- `vitest --project web src/lib/features/shared/affordability`: 29/29 SSR (contract copy, period default, errors, onlyTop and $0 cases, CTA href, zero-I/O source checks for `$lib/storage`, `$lib/data`, `$lib/ai`, `localStorage`, `sessionStorage`, `PersistedState`, `replaceState`, `goto(`, `fetch(`, and no "you can afford" / "you qualify" / "recommended" / "you should").
- `vitest --project web-browser src/lib/features/shared/affordability`: 5/5 (empty + filled + error axe clean, slider/number pairing, ArrowRight/ArrowLeft $25 steps, monthly period, blur error). Mutation: removing the `thumbProps` spread fails 2 of them.
- `playwright test renter-affordability`: 14/14 (7 tests x root/sub). Also `routing marketing a11y csp layout`: 424/424. `csp:assert`: 17 pages per base. `build:root` + `build:sub` green (under `.tools/build.lock`, released).
- `corepack pnpm test:unit`: 149 files / 3016 tests pass.
- ESLint and Prettier clean on all my files; `banned` passes (118 files); `ui:guard` passes (56 files); `grep -c "dark:"` on the slider files is 0 each.
- `svelte-check` (apps/web): 0 errors in my files. The only errors at the time of the final run were in 06-11's in-flight `features/renter/storage/renter-storage.test.ts` (not this plan's).

## Requirements advanced

RENT-08 (affordability calculator, UI + route + E2E). Not marked complete; it closes at the 06-22 gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Slider thumb attribute type**
- **Found during:** Task 1 check
- **Issue:** typing `thumbProps` as `HTMLAttributes<HTMLSpanElement>` made svelte-check fail ("union type too complex", `id: null` mismatch with bits-ui's thumb props).
- **Fix:** a narrow `ThumbAria` interface with the four ARIA attributes.
- **Commit:** baf0a87

### Additive

- **Browser test file** (`affordability.browser.test.ts`) beyond the plan's file list, per the wave guidance that slider keyboard operation must be proven in the browser project.
- **`index.ts` barrel** in `features/shared/affordability` so the route (and Phase 10) imports `AffordabilityCalculator` from `$lib/features/shared/affordability`.
- E2E "nothing is saved" also asserts the URL carries no income and the result resets after reload; the mocked-key test also clicks the CTA to prove the search page loads `?max=1800` at 0 RentCast calls.

## Known Stubs

None.

## Self-Check: PASSED
