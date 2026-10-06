---
phase: 07-investor-portal
plan: 12
subsystem: investor-analyzer-page
tags: [analyzer, results, autosave, dexie, sample-deal, e2e, zero-calls, a11y, svelte5]
requires:
  - "07-03: PortalSubNav, NotFoundPanel, investor E2E helpers (collectRequests, mockRentCast, useMockedRentCastKey, axe/scroll helpers)"
  - "07-05: analyze(), METRIC_DEFINITIONS, REFERENCE_CASES"
  - "07-09: createDeal/updateDeal/getDeal, investorDraft table (backup-registered, loose Syncable schema)"
  - "07-10: form-model, MoneyInput/PercentInput/NumberInput, UnitToggle, ExpenseLines"
provides:
  - "analyzer/draftRepo.ts: DRAFT_ID, AnalyzerDraft, readDraft/writeDraft/clearDraft, createDraftRepo, createAutosaver (500ms, flush, cancel, onError)"
  - "analyzer/deal-data.ts: dealSnapshot, EMPTY_SNAPSHOT, isUnsaved, dealName, formToDealData"
  - "analyzer/sample-deal.ts: SAMPLE_DEAL (frozen), sampleDealCopy()"
  - "analyzer/analyzer-page.svelte.ts: AnalyzerPageState (form/sources/dealId/savedSnapshot $state; parsed/analysis/snapshot/unsaved $derived; startAutosave effect)"
  - "analyzer/ResultsPanel.svelte (focusHeading export) and AnalyzerPage.svelte (open(params) export; purchaseAutofill/incomeAutofill snippet slots)"
  - "/investor/analyze/ live page; tests/e2e/investor/analyze.spec.ts"
affects: [07-15 autofill (fills the two slots), 07-16 deals list (?sample=1 link, ?id= open), 07-17+ memo (Draft a memo link)]
tech-stack:
  added: []
  patterns:
    - "Page state as a runes class in a .svelte.ts module; tests in *.svelte.test.ts (node project runs Svelte's server build, so $effect is proven in E2E, not unit)"
    - "Route onMount reads new URL(location.href).searchParams and calls the child component's exported open()"
    - "Unsaved badge compares a JSON snapshot of PARSED inputs, so blur formatting never counts as a change"
key-files:
  created:
    - apps/web/src/lib/features/investor/analyzer/draftRepo.ts
    - apps/web/src/lib/features/investor/analyzer/draftRepo.test.ts
    - apps/web/src/lib/features/investor/analyzer/deal-data.ts
    - apps/web/src/lib/features/investor/analyzer/sample-deal.ts
    - apps/web/src/lib/features/investor/analyzer/sample-deal.test.ts
    - apps/web/src/lib/features/investor/analyzer/analyzer-page.svelte.ts
    - apps/web/src/lib/features/investor/analyzer/analyzer-page.svelte.test.ts
    - apps/web/src/lib/features/investor/analyzer/ResultsPanel.svelte
    - apps/web/src/lib/features/investor/analyzer/results.ssr.test.ts
    - apps/web/src/lib/features/investor/analyzer/AnalyzerPage.svelte
    - apps/web/tests/e2e/investor/analyze.spec.ts
  modified:
    - apps/web/src/routes/(app)/investor/analyze/+page.svelte
key-decisions:
  - "Draft row id is a fixed uuid-shaped DRAFT_ID, not 'current': the backup envelope validates every investorDraft row with z.uuid(), so a 'current' id would make every backup containing the draft fail import"
  - "Draft updatedAt is an ISO string (Phase 3 Syncable), not the plan's number"
  - "No AnalyzerForm.svelte (07-15 owns it): AnalyzerPage.svelte composes the five fieldsets directly and exposes purchaseAutofill/incomeAutofill snippet slots"
  - "?id= with a draft for the same deal restores the draft (unsaved typing on an open deal survives reload); a draft pointing at a deleted deal becomes a new analysis"
  - "?sample=1 fills the sample and then drops the param from the URL so a reload never overwrites edits with the sample"
  - "Saving with price or rent blank focuses that field and announces 'Enter a purchase price and monthly rent before saving.' (no UI-SPEC string exists for this case)"
requirements-advanced: [INV-01, INV-02, INV-03]
metrics:
  duration: ~45min
  completed: 2026-10-05
  tasks: 3
  files: 12
---

# Phase 7 Plan 12: Deal analyzer page Summary

The `/investor/analyze/` page is now live. It has five fieldsets built from the 07-10 inputs. Results update as you type and show each metric's one-line definition on the page. Typing is autosaved to a working draft within 500ms. You can Save deal, Save changes or Save as a new deal, and saving adds `?id=` to the URL. Try a sample deal, Clear analysis (with confirmation), the `?sample=1` link and the not-found panel all work. An E2E test proves that typing, results, save and reload make **zero RentCast requests**, even with a RentCast key saved.

Advances **INV-01** (analyze with editable expense lines), the manual half of **INV-02** ("enter every number manually, zero API calls") and the save half of **INV-03**. `requirements mark-complete` was deliberately not run.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Working-draft autosave, sample deal and page state | 3affd42 (test), 5ebbaa8 (feat) |
| 2 | ResultsPanel and the /investor/analyze/ page | 1a55577 (test), 7f2949c (feat) |
| 3 | Analyzer E2E | 3b5d46f |

## Verification

- `vitest --project web draftRepo sample-deal analyzer-page`: 24 passed. `results.ssr`: 15 passed. Full `test:unit`: 203 files, 4018 tests, all passing.
- `pnpm --filter web check`: 0 errors and 0 warnings. ESLint and Prettier are clean on every touched file. `banned` passed (226 files) and so did `ui:guard`.
- `build:root` + `build:sub` + `csp:assert`: 25 pages per base.
- Playwright `investor/analyze`: 22 of 22 passed on root and sub (11 tests per project) on the first run. Playwright `investor routing csp a11y`: 274 passed, none failed.
- Acceptance greps: the analyze route contains `new URL(location.href)` and does not contain `page.url.searchParams`. ResultsPanel has no `text-destructive`, and an SSR test also asserts this. The spec contains `collectRequests(page, ['api.rentcast.io'])` followed by `toEqual([])`, plus `It leaves out financing.`, `Enter a number, like 250000.` and `We couldn't find that deal in this browser`. results.ssr contains every required string. analyzer-page.svelte.ts does not import `investor-port` or `$lib/data`, and a unit test asserts this.

## Deviations from Plan

### Auto-fixed / adapted

1. **[Rule 1 - Bug] Draft id.** The plan's literal `'current'` id would fail the backup's per-row `looseRecordSchema` (which requires a uuid id). Every backup made after someone used the analyzer would then fail to import. The row now uses `DRAFT_ID = '00000000-0000-4000-8000-00000000d4af'` and is a full Phase 3 Syncable with ISO timestamps. A test round-trips it through backup export and import.
2. **[Orchestrator scope] No `AnalyzerForm.svelte`.** 07-15 owns that file. `AnalyzerPage.svelte` composes the fieldsets and gives 07-15 two slots (`purchaseAutofill` and `incomeAutofill`, each a `Snippet<[AnalyzerPageState]>`) at the end of fieldsets 2 and 4.
3. **[Rule 3] Pure helpers in `deal-data.ts`.** The snapshot, name fallback and form-to-DealData helpers live in a pure module. That way draftRepo tests, page state and save all share them.
4. **[Rule 3] Runes test file.** The page-state tests live in `analyzer-page.svelte.test.ts`, because runes compile only in `.svelte.*` modules. The node project uses Svelte's server build, where `$effect` never runs. For that reason the autosave effect is proven end to end by "the working draft survives a reload", not by a unit test.
5. **[Rule 2] Autosaver additions.** `cancel()` drops a pending write. Clear analysis needs it, because otherwise a scheduled write could bring the cleared draft back. `onError` reports a failed write instead of throwing inside the effect. A `pagehide` flush, plus a flush on teardown, protects the last keystrokes.
6. **[Rule 2] Restore guards.**
   - The autosave effect runs only after `restored`, so the empty initial form never overwrites a stored draft.
   - A draft is not applied if the user has already started typing.
   - `#analyzer-form[data-restored]` lets the E2E tests wait for the restore to finish.
7. **Additive copy.** Saving while price or rent is blank announces "Enter a purchase price and monthly rent before saving." and focuses the missing field. The UI-SPEC has no string for this case. The property-type select's blank option reads "Choose a type".
8. **Closing-cost unit toggle** converts the amount, keeping the dollars the same (3% → "6,000"), the same way the expense lines do. If the price is not ready, the amount is left unchanged.

## Notes for later plans

- **07-15:** render the autofill controls through `<AnalyzerPage purchaseAutofill={...} incomeAutofill={...}>`, or move the fieldsets into your `AnalyzerForm.svelte`. Page state is `AnalyzerPageState` (`form`, `sources`, `analysis`, `parsed`). `NumericField` already has the `chip` slot.
- **07-16:** "Try a sample deal" on the empty deals list links to `investor/analyze/?sample=1`. Deal cards link to `investor/analyze/?id=`.

## Known Stubs

None. The autofill slots are empty by design until 07-15. The page works fully with manual entry.

## Self-Check: PASSED
