---
phase: 06-renter-portal
plan: 17
subsystem: renter-fair-rent
tags: [renter, fair-rent, gateway, peek, cost-first, e2e, a11y, ssr-tests]
requires:
  - "06-02 @tran/core/renter/fair-rent (pickBedroomBucket, compareToMedian, sampleCaveat, compareToRange, estimateConfidence, displayComparables, rangeBarScale)"
  - "06-03 @tran/core/renter/format (formatRent, formatMonthYear, formatDistance, formatSqft)"
  - "06-09 E2E harness (mockRentCast estimateComps / markets: 'none', rentcastCalls, withRentCastKey)"
  - "06-11 marketsRequest, rentEstimateRequest; gateway peek / estimateCost"
  - "06-14 FairRentCheck stub mounted by ListingDetail ({ row, provenance })"
  - "Phase 4 CostLabel, ProvenanceRow, ProvenanceChip, GatewayError, runtime.requestSpend, announce"
provides:
  - "features/renter/fair-rent: FairRentCheck (two tiers), ZipMedianTier, ZipMedianResult, RentEstimateTier, RentEstimateResult, RentRangeBar, ConfidenceBadge, ComparablesTable"
  - "GatewayError props `body` (body override, also announced) and `actions` (false hides the action row)"
  - "MarketSide.lastUpdatedDate (optional; the mapper always sets it)"
affects: [06-22 gate (RENT-06), Phase 7 (MarketSide.lastUpdatedDate available to the investor market views)]
tech-stack:
  added: []
  patterns:
    - "Tier = read-only $effect (peek + estimateCost only) + one click handler that spends via runtime.requestSpend; dismissed cap prompts leave the state untouched"
    - "Gateway glue component + presentational *Result component, so the copy is SSR-testable without a runtime"
    - "Announce the rendered sentence's textContent, so spoken and visible copy can't drift"
    - "Caption kept inside a track with left: p% + translateX(-p%) (no measuring)"
key-files:
  created:
    - apps/web/src/lib/features/renter/fair-rent/ZipMedianTier.svelte
    - apps/web/src/lib/features/renter/fair-rent/ZipMedianResult.svelte
    - apps/web/src/lib/features/renter/fair-rent/RentEstimateTier.svelte
    - apps/web/src/lib/features/renter/fair-rent/RentEstimateResult.svelte
    - apps/web/src/lib/features/renter/fair-rent/RentRangeBar.svelte
    - apps/web/src/lib/features/renter/fair-rent/ConfidenceBadge.svelte
    - apps/web/src/lib/features/renter/fair-rent/ComparablesTable.svelte
    - apps/web/src/lib/features/renter/fair-rent/fair-rent-ui.test.ts
    - apps/web/src/lib/features/renter/fair-rent/FairRentCheck.browser.test.ts
    - apps/web/src/lib/features/renter/fair-rent/testing/FairRentHarness.svelte
    - apps/web/tests/e2e/renter-fair-rent.spec.ts
  modified:
    - apps/web/src/lib/features/renter/fair-rent/FairRentCheck.svelte
    - apps/web/src/lib/features/shared/data/GatewayError.svelte
    - apps/web/src/lib/features/shared/data/GatewayError.browser.test.ts
    - apps/web/src/lib/data/rentcast/mappers.ts
    - apps/web/src/lib/data/rentcast/mappers.test.ts
    - packages/core/src/listings/types.ts
key-decisions:
  - "Each tier reads with gateway.peek + estimateCost in a read-only $effect and spends only from its button through runtime.requestSpend (so the over-cap prompt applies). Cached or sample data renders with no button."
  - "Sentence/caveat copy and the estimate result live in presentational ZipMedianResult / RentEstimateResult, so svelte/server can test them. The Tier components keep the headings, buttons, request builders and peek."
  - "One Sample chip in the card header in sample mode, plus one in the comparables caption row (UI-SPEC Sample Data Contract). ProvenanceRow renders in a tier only for live (rentcast) provenance, so a sample card doesn't show three identical chips."
  - "A count above every bedroom bucket uses the top bucket's number in the sentence ('5-bedroom rentals'). Unknown bedrooms show only the all-rentals median line."
  - "A successful markets answer with no usable rental stats renders the same Tier 1 NoResults panel as RentCast's 404."
  - "Tier 2 NoResults (no estimate for the address) uses the body 'RentCast couldn't estimate rent for this address.' with no actions. This line isn't in the UI-SPEC; the stock NoResults copy talks about filters and offers Edit search."
requirements-completed: []
metrics:
  duration: ~45min
  completed: 2026-10-05
  tasks: 2
  files: 17
---

# Phase 6 Plan 17: Fair-rent check Summary

**The listing detail's "How this rent compares" card has two tiers. Tier 1 compares the asking rent with the ZIP median for that bedroom count. It costs 0 calls when the ZIP's market stats are cached or in sample mode; otherwise "Load {zip} rent data (1 call)" spends exactly one call. Tier 2 is RentCast's rent estimate, behind "Get rent estimate (1 call)": the likely range, a decorative range bar, a low-confidence badge under 3 comparables, and the nearest 10 comparables. The copy compares; it never judges the price.**

This advances RENT-06. Per the orchestrator, `requirements mark-complete` was not run, so it stays open until the 06-22 gate.

## Tasks

| # | Task | Commit |
| --- | --- | --- |
| 1 | FairRentCheck shell and Tier 1 ZIP median (+ GatewayError body/actions, MarketSide.lastUpdatedDate) | de6f2ea |
| 2 | Tier 2 rent estimate with range bar, confidence and comparables, plus E2E | 6ef11d9 |

## What the tests prove

- **fair-rent-ui.test.ts (19, SSR):**
  - Tier 1 sentences:
    - "$2,160 is 8% above the median rent of $2,000 for 2-bedroom rentals in 74201."
    - The below case, and "about the same as" at 1.5%.
    - Studios, and the top-bucket label.
  - Caveat: "Based on 24 rental listings … as of Sep 2026." The k = 9 case appends the small-sample sentence, and the as-of part is dropped when no date is given.
  - The no-bedroom-data lines.
  - Tier 2:
    - Estimate and range lines.
    - The within, $140 above and $150 below sentences.
    - The `aria-hidden` bar with both captions; no range means no bar.
    - The badge for 2 comparables and the singular "1 comparable". The subject is removed before counting.
    - At most 10 rows, nearest first, as text with formatted cells and no links.
    - The empty-comps line.
    - The Sample chip in the caption row.
  - No output matches overpriced, underpriced, deal, appraisal or value.
- **FairRentCheck.browser.test.ts (3, Chromium, counting fake runtime):**
  - Cached ZIP stats render Tier 1 with 0 spends. "Get rent estimate (1 call)" shows before any spend. A click makes exactly 1 `rent-estimate` spend (address + compCount 15), followed by the low-confidence badge and the announcement "Rent estimate ready: $2,080 a month. Low confidence."
  - With nothing cached, both buttons show "(1 call)" and there are 0 spends. Load makes exactly 1 spend, `{ zipCode: '74201', dataType: 'All', historyRange: 24 }`, and the result sentence is announced.
  - NoResults shows the Tier 1 body and no Edit search button.
  - axe is clean in each state.
- **GatewayError.browser.test.ts (+1):** the body override replaces the body and the announcement, and `actions={false}` removes the row.
- **renter-fair-rent.spec.ts (4 × root/sub = 8):**
  - Keyless: the Tier 1 sentence regex and "Based on 26 …". Tier 2 renders from fixtures with no button. Sample chips appear in the card and the comparables caption. No judgment words. 0 RentCast calls. axe is clean.
  - Live Tier 1: "Load 74201 rent data (1 call)" with 0 markets calls and axe clean. A click makes exactly 1 `/v1/markets` call with `zipCode=74201`, `dataType=All` and `historyRange=24`, and the sentence then shows. "Refresh (1 call)" appears. A reload shows the sentence with no new call.
  - Live Tier 2 (`estimateComps: 2`): "Get rent estimate (1 call)" with 0 estimate calls. A click makes exactly 1 `/v1/avm/rent/long-term` call. Then "Estimate: $…", "Likely range: $…", "Low confidence: 2 comparables", 10 or fewer rows sorted by distance, axe clean, and no judgment words outside the intro sentence.
  - `markets: 'none'`: Load shows "RentCast has no rent data for 74201 yet." plus the estimate pointer, with no Edit search.

## Mutation checks (not committed; restored)

| Mutation | Killed by |
| --- | --- |
| Confidence counted on raw comparables (subject included) | SSR "drops the subject listing before counting comparables" |
| Tier 1 ignores a cached peek result | browser "cached ZIP stats render Tier 1 at 0 calls" |

## Verification

- `vitest --project web src/lib/features/renter/fair-rent`: 19/19. `vitest --project web-browser src/lib/features/renter/fair-rent`: 3/3. GatewayError browser: 40/40.
- `corepack pnpm test:unit`: 161 files, 3136 tests passed.
- ESLint and Prettier are clean on all touched files. `banned`: passed (167 files). `ui:guard`: passed.
- `pnpm --filter web check`: no errors in this plan's files. The remaining errors are in sibling wave-5 files (`outreach/OutreachSection.browser.test.ts`, `shortlist/ShortlistCard.svelte`, `shortlist/shortlist-ui.test.ts`, `tests/e2e/renter-results.spec.ts`) and were not touched here.
- `build:root` + `build:sub` + `csp:assert` (17 pages per base), run under `.tools/build.lock`, which was released.
- `playwright test renter-fair-rent renter-listing --repeat-each 2`: 44/44.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Market stats dropped RentCast's `lastUpdatedDate`**
- **Found during:** Task 1
- **Issue:** The caveat must say "as of {Mon YYYY}" from RentCast's data date, but the Phase 4 `mapMarket` dropped `rentalData.lastUpdatedDate`. Using the fetch time would misstate how current the data is.
- **Fix:** I added an optional `lastUpdatedDate?` to core `MarketSide`. The mapper always sets it, and two mapper assertions were added.
- **Files:** packages/core/src/listings/types.ts, apps/web/src/lib/data/rentcast/mappers.ts(+test)
- **Commit:** de6f2ea

**2. [Rule 3 - Blocking] GatewayError had no body override**
- **Found during:** Task 1
- **Issue:** The plan's interfaces say NoResults supports a body override, but the Phase 4 component had none. Its NoResults panel also always rendered "Edit search", which does nothing on a listing page.
- **Fix:** I added the additive props `body` (shown and announced) and `actions` (default true). Existing callers are unchanged, and a browser test was added.
- **Commit:** de6f2ea

**3. Copy placement (acceptance greps)**
- The plan's greps expect the result sentence and caveat strings in `ZipMedianTier.svelte`, and "Likely range" plus the disclaimer in `RentEstimateTier.svelte`. Those strings are in the presentational `ZipMedianResult.svelte` / `RentEstimateResult.svelte`, which the tiers render. That way svelte/server can test the copy (effects don't run in SSR). Every other listed string is in the named file.

**4. Additive**
- `FairRentCheck.browser.test.ts` and its `testing/FairRentHarness.svelte` count spends at the component level. The E2E counts them at the network level.
- Live Tier 1 shows "Refresh (1 call)" through ProvenanceRow, following the Phase 4 convention.

## Known Stubs

None. Both tiers are wired to the gateway.

## Self-Check: PASSED
