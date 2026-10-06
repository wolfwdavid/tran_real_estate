---
phase: 06-renter-portal
plan: 22
subsystem: testing
tags: [renter, e2e, axe, csp, call-budget, demo-credibility, phase-gate, mutation-test]

requires:
  - phase: 06-renter-portal
    provides: "all renter routes, the 06-09 no-network harness, renter specs 06-12..06-21"
provides:
  - "renter-demo-credible.spec.ts: 4 routes x sample/live x root/sub matrix (axe at 1280 and 375, CSP, sample chips, scrollWidth, zero third-party)"
  - "renter-journey.spec.ts: full live journey = exactly 3 RentCast calls (listings, markets, rent AVM), meter reads 3 of 50"
  - "price-history removedDate kept through the mapper (Delisted/Relisted for live rows)"
  - "06-VALIDATION complete, RENT-01..08 complete, 06-HUMAN-UAT (R1-R12)"
affects: [07-investor-portal, 08-agent-portal, 10-launch]

tech-stack:
  added: []
  patterns:
    - "Scroll regions (overflow-x-auto) are `relative` so sr-only descendants stay inside them"
    - "PriceEvent -> RawHistory adapter lives in the web feature (toRawHistory), core history stays RentCast-shaped"

key-files:
  created:
    - apps/web/tests/e2e/renter-demo-credible.spec.ts
    - apps/web/tests/e2e/renter-journey.spec.ts
    - apps/web/src/lib/features/renter/listing/history.ts
    - .planning/phases/06-renter-portal/06-HUMAN-UAT.md
    - .planning/phases/06-renter-portal/deferred-items.md
  modified:
    - apps/web/src/lib/features/shared/listings/PriceHistory.svelte
    - apps/web/src/lib/features/renter/fair-rent/ComparablesTable.svelte
    - apps/web/src/lib/features/shared/settings/ImportPreview.svelte
    - packages/core/src/listings/types.ts
    - apps/web/src/lib/data/rentcast/mappers.ts
    - apps/web/src/lib/data/rentcast/mappers.test.ts
    - apps/web/src/lib/features/renter/listing/ListingDetail.svelte
    - apps/web/src/lib/features/renter/listing/listing-ui.test.ts
    - .planning/phases/06-renter-portal/06-VALIDATION.md
    - .planning/REQUIREMENTS.md
    - README.md

key-decisions:
  - "removedDate (06-14 carry-over) fixed at the root in this plan: optional PriceEvent.removedDate, mapper always sets it, toRawHistory passes it to the core history"
  - "Every overflow-x-auto table wrapper is `relative`: an sr-only cell in a static scroll region escaped to the page and widened the listing detail to 376px at 375px"
  - "Duplicate listing-card ids (list + split + preview) recorded as deferred, not fixed in the gate plan; behaviour and axe are correct, HUMAN-UAT R12 covers screen readers"
  - "tailwind-merge text-label/text-body collision stays open (recorded, not fixed)"

patterns-established:
  - "Demo-credibility matrix per portal: route x mode x base, axe at 1280 and 375, CSP collector, sample-chip rule, scrollWidth, net.external teardown"
  - "Budget journey spec: one live walk-through asserting exact per-endpoint call counts and the usage meter"

requirements-completed: [RENT-01, RENT-02, RENT-03, RENT-04, RENT-05, RENT-06, RENT-07, RENT-08]

duration: ~50min
completed: 2026-10-05
---

# Phase 6 Plan 22: Renter Portal Gate Summary

**Every renter route proven keyless, axe-clean at 1280 and 375px, CSP-clean and third-party-free on both bases, and a full live renter journey that spends exactly 3 RentCast calls; `pnpm verify` green in 391 s.**

## Performance

- **Duration:** about 50 min
- **Completed:** 2026-10-05
- **Tasks:** 2
- **Files:** 5 created, 11 modified

## Accomplishments

- `renter-demo-credible.spec.ts`: 8 cells (4 `RENTER_ROUTES` x sample/live) on both Playwright projects, so 16 tests. Each cell installs the CSP collector before navigation and runs axe with the WCAG 2.2 AA tags at 1280px and again at 375px. It also checks that `scrollWidth` is at most 375. In sample mode every `[data-provenance="sample"]` block must carry a visible chip, and search and listing must show sample data. In live mode no sample blocks may appear. The RentCast call count must match the setup exactly (sample 0, live 1 search), and the harness teardown fails on any third-party request.
- `renter-journey.spec.ts`: search 74201, then Max, Bedrooms, Townhouse, Listed within and sort. Next the Map tab (mocked tiles), a pin selected with Enter, and its detail from the cache. Then "Load 74201 rent data", "Get rent estimate", an outreach draft on the Fixture provider with Copy text, Save to shortlist, status Contacted with a note, saving the filtered search, and the affordability CTA. The spec asserts `rentcastCalls(net)` `toBe(3)`, split 1/1/1 across `listings/rental/long-term`, `/v1/markets` and `avm/rent/long-term`. It also asserts the meter reads "RentCast calls: 3 of 50 this month", 0 LLM-host requests, and an empty `net.external`.
- Price history now keeps RentCast's per-entry `removedDate`, so live listings can show Delisted and Relisted events (06-14 carry-over).
- 06-VALIDATION is closed: all 44 rows are green with their test files, plus gate results, the phase mutation ledger and approval. RENT-01..08 are marked complete. 06-HUMAN-UAT.md lists 12 owner-gated rows. The README gained the renter portal section and corrected facts.

## Gate results

| Gate | Result |
|------|--------|
| `corepack pnpm verify` | exit 0, 391 s (6.5 min) |
| Unit | 166 files, 3180 tests |
| Builds + CSP | 17 HTML files per base |
| E2E | 774 passed, 2 skipped (pre-existing), 0 flaky; renter specs 154 (77 per base) |

## Task Commits

1. **Task 1 deviation fix (Rule 1): scroll wrappers contain their screen-reader cells** - `0f111c9` (fix)
2. **Task 1 deviation fix (Rule 2): keep price-history removedDate through the mapper** - `ec49c9a` (fix)
3. **Task 1: renter demo-credibility matrix and budget journey** - `3d1f94d` (test)
4. **Task 2: close renter validation map and requirements** - `96e70f5` (docs)

## Mutation proofs (not committed; restored, suite re-run green)

| Mutation | Killed by |
|----------|-----------|
| Resolver drops the `peekListingById` cache hit | `renter-journey` (detail shows "Listing not found") |
| Price-history scroll wrapper without `relative` (pre-fix state) | `renter-demo-credible` listing cells, sample and live, both bases (scrollWidth 376) |
| Mapper / adapter without `removedDate` (pre-fix, RED first) | `mappers.test.ts` new case + `listing-ui.test.ts` `toRawHistory` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Listing detail scrolled sideways by 1px at 375px**
- **Found during:** Task 1 (the new matrix: `renter/listing/` failed in both modes on both bases with scrollWidth 376)
- **Issue:** The price-history table is in an `overflow-x-auto` region, but the region was statically positioned. An `sr-only` (absolute) "no change" cell therefore took the initial containing block, escaped the scroll region, and widened the page.
- **Fix:** `relative` on the scroll wrapper in PriceHistory, ComparablesTable and ImportPreview (the same pattern in all three).
- **Commit:** 0f111c9

**2. [Rule 2 - Missing functionality] removedDate dropped by the mapper (06-14 carry-over)**
- **Issue:** Mapped `PriceEvent`s had no `removedDate`, so the detail's history could never show Delisted or Relisted for live rows.
- **Fix:** Added optional `PriceEvent.removedDate`. The mapper always sets it. A new `toRawHistory` adapter in the web listing feature passes it to `@tran/core/renter/history`. Tests were written RED first.
- **Commit:** ec49c9a

**3. [Rule 3 - Blocking, test-side] Duplicate card ids on the Map tab**
- The journey's click on the selected card's address link hit 3 elements with the same id (list, split list, preview). The spec now scopes the link to the selected visible card. The id duplication itself is logged in `deferred-items.md` rather than fixed in the gate plan.

**4. Meter text:** the usage meter reads "RentCast calls: 3 of 50 this month", so the assertion matches that exact text.

## Carried notes (from 06-01..06-21, recorded for the verifier)

- 06-14: `$state` proxies must go through `$state.snapshot` before Dexie `structuredClone`. The mapper keeps `addressLine2`/`hoaFee`, and since 06-22 `removedDate` too.
- 06-19: Leaflet's `data:` tile-cancel was replaced so `img-src` holds. Sample mode loads zero tiles. OSM attribution is required.
- 06-17: `MarketSide.lastUpdatedDate` was added, and `GatewayError` gained `body`/`actions`. 06-18: `GenerationPanel.beforeGenerate`. 06-20: the saved-search repo gained `rename`, and the 24 h re-run is proven under `page.clock`.
- 06-16/06-21: specs were updated for the real map and the split view.
- Orchestrator fixes 9b34e8b/b82fc78 (formatting, a useless regex escape in `contact-links.ts`).
- Open debt: the tailwind-merge `text-label`/`text-body` collision (since Phase 4) and duplicate listing-card ids. Both are in `deferred-items.md`.

## Known Stubs

None. The Phase 7-9 placeholders (`/investor/`, `/agent/`) are outside this plan.

## User Setup Required

None for the gate. The owner-gated live checks are in `06-HUMAN-UAT.md` (non-blocking).

## Next Phase Readiness

Phase 6 is complete. Phase 7 (investor portal) can reuse the matrix and journey patterns, the shared listings/map components and `toRawHistory`.

## Self-Check: PASSED
