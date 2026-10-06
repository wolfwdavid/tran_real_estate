---
phase: 07-investor-portal
plan: 19
subsystem: print
tags: [print, pdf, memo, disclaimer, provenance, csp, e2e]
requires:
  - "07-17: /investor/memo/ print link (?id=&memo=), data-artifact-id hook, createMemoPostChecks, memoFactsForDeal, acknowledged status on print"
  - "07-03: (print) route group, /print/memo/ stub, PRINT_ROUTES/isPrintRoute/CHROME_ROUTES, prerender entry, stubPrint/printCount helpers"
  - "07-09: getDeal, DealRecord; 07-05: analyze, METRIC_DEFINITIONS; core formatters"
  - "Phase 5: runChecks(text, postChecks), createArtifactRepo().get"
provides:
  - "Shared PrintReport shell (features/shared/print) with brand/footerNote snippets for Phase 9"
  - "print.css: @page margins, Page N of M margin box, print media and break rules (imported only by the (print) layout)"
  - "print-model.ts: PRINT_DISCLAIMER, PRINT_DISCLAIMER_FULL, PRINT_SAMPLE_SENTENCE, PRINT_NO_MEMO_NOTE, keyFigures, inputTables, provenanceSentence, printTitle, sourceWord, dealIsSample"
  - "MemoPrintout.svelte and the live /print/memo/?id=&memo= route (hydrating / not-found / blocked / ready)"
affects: [07-21 phase gate, Phase 9 agent reports]
tech-stack:
  added: []
  patterns:
    - "Browser-native PDF: print stylesheet + window.print() on click after document.fonts.ready; pdfmake not used"
    - "Print-only CSS kept verbatim via /* prettier-ignore */ and code-split into the (print) chunk only"
key-files:
  created:
    - apps/web/src/lib/features/shared/print/PrintReport.svelte
    - apps/web/src/lib/features/shared/print/print.css
    - apps/web/src/lib/features/shared/print/PrintReport.ssr.test.ts
    - apps/web/src/lib/features/investor/memo/print-model.ts
    - apps/web/src/lib/features/investor/memo/print-model.test.ts
    - apps/web/src/lib/features/investor/memo/MemoPrintout.svelte
    - apps/web/tests/e2e/investor/print.spec.ts
  modified:
    - apps/web/src/routes/(print)/+layout.svelte
    - apps/web/src/routes/(print)/print/memo/+page.svelte
decisions:
  - "The route stayed at routes/(print)/print/memo/ (07-03 already put it in the (print) group), so PRINT_ROUTES, prerender.entries and the 25-page csp:assert count are unchanged"
  - "Computed rows (Loan amount, Monthly loan payment) use the source word 'Calculated'; the four UI-SPEC words cover entered/fetched values only"
  - "Null figures print as an em dash plus the results-panel reason words (e.g. '— No loan')"
  - "printTitle and every printed date use the UTC calendar date, like the core formatters"
  - "The print-time recheck passes empty notes to memoFactsForDeal (artifact meta never holds prompt inputs), so a memo that cites a number only from the notes is blocked at print"
  - "The sample chip mirrors Phase 4's ProvenanceChip sample classes inline (shared/print must not import investor; ProvenanceChip needs a Provenance object)"
  - "Toolbar 'Back to memo' stays on hydrating and not-found (07-03 route contract); the blocked panel carries its own Back to memo link"
metrics:
  duration: ~45min
  completed: 2026-10-06
  tasks: 3
  files: 9
---

# Phase 7 Plan 19: Print pipeline and memo printout Summary

The `(print)` pipeline is in place. `/print/memo/?id=&memo=` shows a print-ready sheet with:

- the memo
- the key figures (cash flow first)
- the inputs with their sources
- a data-sources sentence
- the not-investment-advice disclaimer at the top and again in the closing Important block

The user prints to PDF through the browser's own dialog. The shared `PrintReport` shell and `print.css` are ready for Phase 9.

Advances requirement **INV-06** (print half). `requirements mark-complete` was not run, per orchestrator.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Print model (key figures, inputs with sources, provenance) | 4744dac (RED), 71e4997 (GREEN) |
| 2 | PrintReport shell, print.css, (print) layout, MemoPrintout, route | 8b06c78 (RED), d087900 (GREEN) |
| 3 | Print E2E | 615abca |
| - | Route-contract fix (deviation 1) | 24752a1 |

## How it works

### Route
- The route reads `id` and `memo` in `onMount` from `new URL(location.href)`.
- A missing deal shows `NotFoundPanel` with "Back to saved deals".
- The memo is dropped and the no-memo note is shown instead when the memo is:
  - absent
  - deleted
  - for another deal (`subjectId`)

### Print-time recheck
- On load, the memo is checked again with `runChecks(artifact.text, createMemoPostChecks(memoFactsForDeal(deal, '').allowed))` against the current deal.
- If any finding is Must fix, or a Review finding is on a `draft` artifact, no sheet renders. A neutral panel says "This memo has flags to fix before printing".

### Printing
- The page sets `document.title` to "Investment memo - {name} - YYYY-MM-DD" and focuses "Print or save as PDF".
- Printing happens only on click: `await document.fonts.ready; window.print()`.

### Print CSS
- `print.css` holds the UI-SPEC rules verbatim, plus the `@bottom-center` "Page N of M" margin box.
- It is imported only by `(print)/+layout.svelte`.
- In the build it is code-split into one asset that only `print/memo/index.html` links. The marketing page never loads it.
- There are no inline `style` attributes, which an SSR test asserts.

## Verification

- **Unit tests:**
  - `vitest --project web PrintReport print-model`: 21 tests green.
  - `corepack pnpm test:unit`: 212 files, 4129 tests pass. The first full run had one transient failure, a known flake under parallel load; the re-run was all green.
- **Static checks:** `corepack pnpm check` 0 errors, `corepack pnpm lint` clean (Prettier + ESLint), `corepack pnpm banned` passed (248 files).
- **Build:** `build:root` + `build:sub`, then `csp:assert` passed for 25 pages per base.
- **Playwright `tests/e2e/investor/print`:** 8/8 on root and sub. This covers:
  - ready state: focus, title, print count 0 then 1
  - print media: toolbar hidden; header disclaimer, sample chip and sentence, and provenance visible; Important block is the last section
  - PDF page count between 1 and 4
  - no-memo state
  - not-found state
  - blocked state (planted "Expect 12% growth")
  - axe in every state
  - zero RentCast or AI calls on the keyless paths
- **Wider Playwright run** (`investor` + `routing` + `csp` + `a11y`):
  - First run: 240 passed, 2 failed. The failures were the 07-03 route contract on `print/memo/` (deviation 1).
  - After the fix, `investor/routes` + `investor/print` + `routing` passed 64/64.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Route contract regression on `/print/memo/` with no id**
- **Found during:** Task 3 wider E2E run
- **Issue:** The 07-03 contract expects the print surface to keep its "Back to memo" link after hydration. My first version showed the toolbar only while hydrating, so a missing id (now the not-found state) dropped the link.
- **Fix:** The toolbar now renders in the hydrating and not-found states. The blocked state keeps only its panel link, which avoids two identical links.
- **Files modified:** apps/web/src/routes/(print)/print/memo/+page.svelte
- **Commit:** 24752a1

**2. [Rule 2 - Minimal extension] "Calculated" source word**
- Loan amount and Monthly loan payment are analyzer outputs, so "You" would misstate their origin. They read "Calculated".

## Known Stubs

None. The `/print/` placeholder page from 07-03 is untouched. It is part of `PRINT_ROUTES` and is outside this plan.

## Known Limitations

- The print recheck has no access to the memo notes, because they are not stored with the artifact. A memo that quotes a number found only in the user's notes passes on the memo page but is blocked at print. The fix is to re-check without that number or to store allowed note numerals in `meta`; this is deferred to the phase gate.

## Self-Check: PASSED
