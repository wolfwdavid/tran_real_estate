---
phase: 07-investor-portal
plan: 18
subsystem: investor-buy-boxes-ui
tags: [investor, buy-box, deep-analyze, quick-metrics, cost-label, e2e, a11y, svelte5]
requires:
  - "07-14 createBuyBoxRepo/useBuyBoxRepo, loadMatches (peek-only), checkNow, markSeen, newMatchIds"
  - "07-15 runAutofill pattern, AutofillButton/EstimateResult/FieldSource ('From listing')"
  - "07-12 writeDraft / AnalyzerPage.open draft restore"
  - "07-13 loadMarket + useMarketsPort"
provides:
  - "buybox/buybox-form.ts: BuyBoxFormState, emptyBuyBoxForm, buyBoxToForm, toBuyBoxInput, criteriaSummary, BUY_BOX_ERROR_COPY, PROPERTY_TYPE_LABELS"
  - "buybox/deep-analyze.ts: deepAnalyze, listingDraft, listingQuery, analyzerPropertyType"
  - "BuyBoxForm, BuyBoxCard, MatchRow, QuickMetrics; /investor/buy-boxes/ page"
  - "draft field estimateErrors; AnalyzerPageState.estimates/estimateErrors/loadDraft; autofill ShownEstimates"
  - "tests/e2e/investor/buybox.spec.ts"
affects: [07-21 gate (INV-04)]
tech-stack:
  added: []
  patterns:
    - "Box list is a Dexie liveQuery; matches re-read from cache (peek only) in an untracked effect keyed on runtime.gateway + list; all spends in click handlers"
    - "Deep analyze: estimateCost before each spend to count calls; draft write is the handoff; analyzer renders from cache"
    - "A restore dispatches a non-bubbling 'change' on #analyzer-form so autofill cost labels refresh without an effect"
key-files:
  created:
    - apps/web/src/lib/features/investor/buybox/buybox-form.ts
    - apps/web/src/lib/features/investor/buybox/buybox-form.test.ts
    - apps/web/src/lib/features/investor/buybox/deep-analyze.ts
    - apps/web/src/lib/features/investor/buybox/deep-analyze.test.ts
    - apps/web/src/lib/features/investor/buybox/BuyBoxForm.svelte
    - apps/web/src/lib/features/investor/buybox/BuyBoxCard.svelte
    - apps/web/src/lib/features/investor/buybox/MatchRow.svelte
    - apps/web/src/lib/features/investor/buybox/QuickMetrics.svelte
    - apps/web/tests/e2e/investor/buybox.spec.ts
  modified:
    - apps/web/src/routes/(app)/investor/buy-boxes/+page.svelte
    - apps/web/src/lib/features/investor/analyzer/draftRepo.ts
    - apps/web/src/lib/features/investor/analyzer/analyzer-page.svelte.ts
    - apps/web/src/lib/features/investor/analyzer/AnalyzerPage.svelte
    - apps/web/src/lib/features/investor/analyzer/AutofillButton.svelte
    - apps/web/src/lib/features/investor/analyzer/autofill.ts
key-decisions:
  - "deepAnalyze counts calls via the free estimateCost before each spend (Provenance cannot tell cached from fresh)"
  - "Over-cap: a 'dismissed' BudgetCapReached skips the estimate without asking again; any other BudgetCapReached awaits confirmCap and retries once (the UI passes confirmCap = true, so the runtime CapPrompt asks)"
  - "The analyzer's shown estimates live on AnalyzerPageState.estimates and persist in the draft; estimateErrors are restored once and not re-persisted"
  - "'Matches (n meet your targets)' counts rows with meets === true; rows with unknown metrics stay in the main list"
  - "markSeen runs on pagehide / visibility hidden / unmount, only for boxes whose Matches were opened during the visit"
requirements-advanced: [INV-04]
metrics:
  duration: ~75min
  completed: 2026-10-06
  tasks: 3
  files: 15
---

# Phase 7 Plan 18: Buy boxes UI Summary

**The buy-boxes page is live.** The form shows its cost before saving ("Save and check now (1 call)"). Cards show criteria summaries, New-since badges, "Checked" lines and Check now. Match rows carry New badges and zero-call quick metrics. "Load ZIP rents (1 call)" spends only when clicked. "Deep analyze (2 calls)" spends the rent and value estimates in its click handler and then opens the analyzer from the cache, with "From listing" chips on the listing facts and RentCast chips on the estimates.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Form model + deepAnalyze (TDD) | 4946bb2 (feat), 76b8849 (test) |
| 2 | Buy boxes page, cards, match rows, quick metrics; analyzer estimate restore | ec0cb43 (feat), 3324c2a (fix) |
| 3 | Buy-box E2E | 90af3e7 |

## Verification

- Unit: `buybox-form`, `deep-analyze`, `matches`, `buyBoxRepo`, `analyzer-page`, `draftRepo` and `autofill` all pass. Full `test:unit`: 212 files, 4129 tests, all passing.
- `pnpm check`: 0 errors. `pnpm lint` (prettier + eslint) is clean. `banned` (248 files) and `ui:guard` pass.
- `build:root` and `build:sub`, then Playwright `tests/e2e/investor`: 135 passed, 1 failed on the first full run. The failure was a race in this spec's `openMatches` helper (the disclosure auto-opened while the test clicked it). After the fix, `buybox.spec` passed 36/36 (6 tests × root/sub × `--repeat-each=3`).
- Acceptance greps: the required copy is present. The only `$effect` in the buy-box files is the page's peek-only re-read; it never calls `checkNow`, `loadMarket`, `deepAnalyze` or any estimate or listings spend. The spec contains `Save and check now (1 call)`, `Load ZIP rents (1 call)`, `Deep analyze (2 calls)`, `From listing`, `count('/v1/markets')` and `below your targets`.

E2E call counts asserted:
- Create + check = 1 sale call, with markets at 0.
- Load ZIP rents = 1 markets call.
- Reload = +0.
- A Save-only box costs 1 call on app open, then 0 on the next open.
- Deep analyze = 1 rent + 1 value call, then +0 while the analyzer renders. The analyzer's rent autofill reads "(0 calls · cached)".
- Partial failure: the value GatewayError shows in the Purchase fieldset, and the rent is still filled.
- axe ran on the empty page, the open form, the form with errors, the page with matches, the below-targets group open, the delete dialog, and the analyzer after a partial Deep analyze. No horizontal scroll at 375px.

## Deviations from Plan

1. **[Rule 1 - Bug] Stale autofill cost after a draft restore.** AutofillButton computes its cost on mount, before `open()` restores the draft, so after a Deep analyze handoff it read "(1 call)" for a cached estimate. This also affected `?id=` restores. Fix: `AnalyzerPage.open()` dispatches a non-bubbling `change` on `#analyzer-form` once restored, which the buttons already listen to. No `$effect` was added. Commit 3324c2a.
2. **[Rule 3] Analyzer hook location.** Restoring failed estimates needed changes in `draftRepo.ts` (`estimateErrors`), `analyzer-page.svelte.ts` (`estimates`, `estimateErrors`, `loadDraft`), `AnalyzerPage.svelte` and `AutofillButton.svelte`, not in `analyze/+page.svelte`, which only mounts AnalyzerForm. All changes are additive. `ShownEstimates` lives in `autofill.ts` because an existing test forbids port imports in `analyzer-page.svelte.ts`.
3. **Keyless E2E step 1:** in sample mode the gateway's peek answers market stats from the fixtures, so quick metrics appear at once and the "Load ZIP rents" button never shows. The spec asserts that quick metrics are present, that there is no Load button, and that RentCast saw 0 requests.
4. **Live specs use `MOCK_ZIP` as the location**, so a single Load ZIP rents call covers every row (needed for "0 meet your targets"). Estimates are mocked for any address with the fixture subject's bodies.
5. Task 1 was committed feat-then-test: the test files were untracked, so the first `--` pathspec commit skipped them. RED was shown by mutation (dropping the cap retry turned 2 tests red).

## Requirements

INV-04 advanced; `requirements mark-complete` not run (orchestrator owns it).

## Known Stubs

None.

## Self-Check: PASSED
