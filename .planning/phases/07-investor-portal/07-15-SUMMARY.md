---
phase: 07-investor-portal
plan: 15
subsystem: investor-analyzer-autofill
tags: [analyzer, autofill, rentcast, cost-label, provenance, fill-rule, e2e, a11y, svelte5]
requires:
  - "07-09: useInvestorPort (estimateCost, rentEstimate, valueEstimate), Estimate, DealSources/FieldSource"
  - "07-10: NumericField chip slot, formatOnBlur"
  - "07-12: AnalyzerPage purchaseAutofill/incomeAutofill slots, AnalyzerPageState, draft autosave (sources persist)"
  - "Phase 4: CostLabel, ProvenanceRow/ProvenanceChip, GatewayError, runtime CapPrompt"
provides:
  - "analyzer/autofill.ts: estimateQueryFromForm, runAutofill (ok/no-address/cap/error), applyEstimate (fill rule), useEstimate, markEdited, priceComparison, TARGET_FIELD, AutofillContext"
  - "AutofillButton.svelte, EstimateResult.svelte, FieldSource.svelte, AnalyzerForm.svelte (AnalyzerPage + both autofill buttons)"
  - "tests/e2e/investor/autofill.spec.ts"
affects: [07-16+ Deep analyze (FieldSource 'listing' chip already renders "From listing")]
tech-stack:
  added: []
  patterns:
    - "Cost label refreshed from DOM events (form change, button pointerenter/focus, mount, after a lookup), never $effect; estimateCost never spends"
    - "Spend only in click handlers via runAutofill; over-cap handled by the runtime CapPrompt, so runAutofill never builds grants (mirrors shared/markets/market-load.ts)"
    - "One form-level oninput maps input ids to FieldSourceKeys and calls markEdited"
key-files:
  created:
    - apps/web/src/lib/features/investor/analyzer/autofill.ts
    - apps/web/src/lib/features/investor/analyzer/autofill.test.ts
    - apps/web/src/lib/features/investor/analyzer/AutofillButton.svelte
    - apps/web/src/lib/features/investor/analyzer/EstimateResult.svelte
    - apps/web/src/lib/features/investor/analyzer/FieldSource.svelte
    - apps/web/src/lib/features/investor/analyzer/AnalyzerForm.svelte
    - apps/web/tests/e2e/investor/autofill.spec.ts
  modified:
    - apps/web/src/lib/features/investor/analyzer/AnalyzerPage.svelte
    - apps/web/src/routes/(app)/investor/analyze/+page.svelte
key-decisions:
  - "No grantFor on the port (07-09 routes over-cap through runtime.requestSpend's CapPrompt): the 'cap' outcome carries dismissed + retry, and retry re-runs runAutofill (one more ask through the same prompt)"
  - "AnalyzerForm.svelte wraps 07-12's AnalyzerPage and fills its two slots, so AnalyzerPage stays gateway-free; the route mounts AnalyzerForm"
  - "Autofill button is aria-disabled (not disabled) in flight so focus stays on it after the lookup"
  - "EstimateResult's ProvenanceRow is chip-only: the port has no refresh method, so 'Refresh (1 call)' is not offered"
requirements-advanced: [INV-02]
metrics:
  duration: ~40min
  completed: 2026-10-05
  tasks: 3
  files: 9
---

# Phase 7 Plan 15: Analyzer autofill Summary

The analyzer now has **Autofill value estimate** at the end of the Purchase fieldset and **Autofill rent estimate** at the end of the Income fieldset. Each button shows its cost in its accessible name before any click: "(1 call)", "(0 calls · cached)" or "(0 calls · sample data)". A click spends at most one call, and only from the click handler. Without an address it makes no request: the Address field shows "Enter the property address to look up an estimate." and takes focus. The fill rule never overwrites a typed number. An empty field is filled. A typed number is kept, and the estimate is offered with "Use $x" (after Use, focus moves to the field). Filled values get a provenance chip ("RentCast · as of …" or "Sample data"), and typing into them turns it into "Edited by you". Every estimate shows its range and comparable count, a "Few comparables" badge under 3, a factual price comparison for value estimates, and a "Comparables used (n)" table.

Advances **INV-02** (autofill half: "autofill rent and value estimates with the call cost shown first"). `requirements mark-complete` was not run, per the orchestrator.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Autofill controller (TDD) | 25498c2 (test), f6dd1a5 (feat) |
| 2 | AutofillButton, EstimateResult, FieldSource, analyzer wiring | 421cb7a (feat), 2ea8b97 (fix: focus + 375px wrap) |
| 3 | Autofill E2E | e01fab0 |

## Verification

- `vitest --project web autofill results.ssr inputs.ssr analyzer-page`: 69 passed (autofill: 21).
- `pnpm --filter web check`: 0 errors and 0 warnings. ESLint and Prettier are clean on the touched files. `banned` (239 files) and `ui:guard` both pass.
- Full `test:unit`: 4082 of 4083 passed. Three tests failed under full-suite load and all passed when re-run in isolation, so they are load flakes outside this plan's files:
  - `precommit.test.ts` (known flake): 10/10 passed on re-run.
  - `renter/search/ResultsView.browser`: 3/3 passed on re-run.
- `build:root` + `build:sub`, then Playwright `tests/e2e/investor` (root + sub): **100 passed**. This includes the 14 autofill tests and 07-12's 22 analyze tests.
- Acceptance greps:
  - No `.svelte` file in `analyzer/` references `rentEstimate`/`valueEstimate`. The only spend path is `runAutofill`, which runs from `onclick`.
  - EstimateResult contains `based on`, `Few comparables`, the low-confidence sentence and `Comparables used`.
  - FieldSource contains `From listing` and `Edited by you`.
  - The spec contains every required string.

## Deviations from Plan

1. **[Rule 3 - Interface] No `port.grantFor` / `{grant}`.** The 07-09 port has neither: over-cap goes through `runtime.requestSpend`'s CapPrompt. The `cap` outcome mirrors `market-load.ts`: it carries `{ error, dismissed, retry }`, and `retry()` re-runs `runAutofill`, which calls the estimate method once more. If the user answered "Not now" (`dismissed`), nothing is shown. Any other cap error is shown with GatewayError, whose "Continue past cap" action calls retry.
2. **[Rule 1 - Bug] Focus stayed off the button.** A `disabled` button loses focus during the lookup, which violated "focus stays on the autofill button". The button is now `aria-disabled` while in flight, and `run()` ignores repeat clicks. The label also wraps (`whitespace-normal`, `min-h-11`), because "Autofill rent estimate (0 calls · cached)" overflowed the page by 32px at 375px.
3. **[Rule 2] Non-gateway failures** (for example, the data runtime not started) render as a `NetworkError` GatewayError instead of throwing inside the click handler.
4. **Refresh omitted from ProvenanceRow.** InvestorDataPort has no refresh method, and adding one is outside this plan's files. The row shows the chip only. Pressing Autofill again re-reads the cache at 0 calls.
5. **AnalyzerPage edits (additive).**
   - The slot snippets now receive a second `AutofillContext` argument (`addressMissing`).
   - The Address field gains an error state (`aria-invalid`, `#address-error`, cleared once an address is typed).
   - Rent and Price pass a `FieldSource` chip through the `chip` slot.
   - A form-level `oninput` calls `markEdited` for the seven source keys.
   - Clear analysis also clears the address error.
6. **Estimates after reload.** The sources (chips) persist in the working draft and in saved deals through `s.sources`. The EstimateResult block itself is session state and is not re-peeked on reload.

## Known Stubs

None.

## Self-Check: PASSED
