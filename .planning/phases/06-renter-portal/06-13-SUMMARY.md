---
phase: 06-renter-portal
plan: 13
subsystem: renter-search
tags: [renter, search, svelte5, runes, url-state, fetch-wide, cost-label, e2e, axe, tdd, mutation-test]
requires:
  - "06-01 normalizeRenterLocation, applyFilters, isTruncated, hasLocalFilters"
  - "06-07 sortRentals/SORT_OPTIONS, encode/decodeSearchParams, activeFilterChips/removeChip/filterCount/resultsHeading"
  - "06-09 E2E harness (deny-all net fixture, mockRentCast, withRentCastKey, expectLiveMode/expectSampleMode)"
  - "06-10 LocationField, PropertyTypeMark"
  - "06-11 searchRequest (wide/narrow)"
  - "04-14 CostLabel, ProvenanceRow; 04-16/04-18 GatewayError, runtime.requestSpend (cap prompt), SAMPLE_METROS"
provides:
  - "features/renter/search/search-state.svelte.ts: createRenterSearch(deps) / RenterSearch, PAGE_SIZE, FILTER_ANNOUNCE_MS"
  - "features/renter/search/cost-estimate.svelte.ts: createCostEstimate(source) (estimateCost-only $effect for CostLabel)"
  - "SearchForm (focusFilters/focusLocation exports), FilterFields, ActiveFilterChips, ResultsHeader, TruncationNotice, StartEmptyState, SearchPage"
  - "features/renter/saved/{SaveSearchButton,SavedSearchesSection}.svelte stubs taking { search } (06-20 fills)"
  - "/renter/ route renders SearchPage under the existing h1/lead/meta"
  - "tests/e2e/renter-search.spec.ts (6 tests x root + sub)"
affects: [06-16 result cards/tabs/pagination (read search.sorted/shownCount/showMore/select/hover/newIds/view), 06-19 map (setView/selectedListingId/hoveredListingId), 06-20 saved searches (fills the stubs; sets search.newIds), 06-22 gate]
tech-stack:
  added: []
  patterns:
    - "Controller with deps { gateway: () => DataGateway | null, spend: runtime.requestSpend, now, announce }: getters over $state, spends only in search/narrow/refresh"
    - "URL mirror through $app/navigation replaceState (shallow) gated on a 'restored' flag, so the first effect run cannot wipe the incoming query"
    - "Restore = peek once in onMount; a new gateway (runtime start / mode switch) re-peeks via an untracked $effect"
    - "Chip controls: the native radio/checkbox covers its label chip at opacity 0 (absolute inset-0), so it stays the real pointer and focus target"
key-files:
  created:
    - apps/web/src/lib/features/renter/search/search-state.svelte.ts
    - apps/web/src/lib/features/renter/search/search-state.test.ts
    - apps/web/src/lib/features/renter/search/cost-estimate.svelte.ts
    - apps/web/src/lib/features/renter/search/SearchForm.svelte
    - apps/web/src/lib/features/renter/search/FilterFields.svelte
    - apps/web/src/lib/features/renter/search/ActiveFilterChips.svelte
    - apps/web/src/lib/features/renter/search/ResultsHeader.svelte
    - apps/web/src/lib/features/renter/search/TruncationNotice.svelte
    - apps/web/src/lib/features/renter/search/StartEmptyState.svelte
    - apps/web/src/lib/features/renter/search/SearchPage.svelte
    - apps/web/src/lib/features/renter/saved/SaveSearchButton.svelte
    - apps/web/src/lib/features/renter/saved/SavedSearchesSection.svelte
    - apps/web/tests/e2e/renter-search.spec.ts
  modified:
    - apps/web/src/routes/(app)/renter/+page.svelte
key-decisions:
  - "The controller takes a gateway getter plus runtime.requestSpend instead of a gateway object, so the over-cap CapConfirmDialog path is the only spend path and a mode switch is visible to peek/estimate"
  - "The URL carries the committed location (restore or a validated search), never each keystroke; typing never rewrites history"
  - "URL sync uses shallow replaceState from $app/navigation, not goto(..., { replaceState }): no navigation, no route announcement, no load/focus side effects"
  - "rentError is derived (min > max shows on Max immediately) and blocks search()/narrow(); location errors are set on submit only"
  - "Search button cost: the typed location's estimateCost when valid; otherwise '(1 call)' live and '(0 calls · sample data)' in sample mode"
  - "A dismissed over-cap prompt ('Not now') restores the previous status with no error panel; nothing was spent"
requirements-completed: []
metrics:
  duration: ~40 min
  completed: 2026-10-05
  tasks: 2
  files: 14
---

# Phase 6 Plan 13: Renter search form, filters and results header Summary

`/renter/` now searches any ZIP or city/state at exactly one RentCast call per location. Rent, bedroom, type and listed-within filters and the sort run locally at 0 calls and update the heading at once. The Search button always shows its cost. Reloads and shared URLs restore from the cache or prefill and wait, and never spend. A 500-row answer warns "Some listings may be missing" and offers one explicit **Narrow on RentCast (1 call)**, with no offset paging. With no key, **Try a sample search** runs a fixture ZIP at 0 calls with Sample data provenance.

Advances **RENT-01** (search end to end) and **RENT-02** (results heading, sort, filter chips). Both stay open until the 06-22 gate, so `requirements mark-complete` was not run.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Search controller (state, URL sync, 0-call restore, explicit spend) | d3a5b3e (RED), 39a307e (GREEN) |
| 2 | Form, filters, chips, results header, truncation, empty state, page wiring, E2E | fced180 |

## What the tests prove

**search-state.test.ts (13 tests, Node, live runtime through `$lib/data`, spy fetch, fake IndexedDB, injected clock):**
- Restoring `loc=74201&max=2000` with an empty cache prefills the form, leaves status idle and makes 0 fetches.
- A cached location restores rows with the original `fetchedAt` and makes 0 more fetches.
- An unparseable `loc` stays idle with no error.
- An empty location gives `'empty'` and `Austin` gives `'city-without-state'`, with 0 fetches. Min > max gives `rentError` and no fetch.
- One search makes 1 fetch with exactly `zipCode/status=Active/limit=500`. Five filter and sort changes keep that 1 and update `filtered`/`sorted` synchronously.
- Filters set before a search never reach the request, and re-searching after a change is cached.
- A 500-row answer is truncated. `narrow()` makes exactly 1 more fetch with `price=0:2000` and no `offset`.
- A 404 gives `NoResults` with no rows. `toUrlParams()` equals `encodeSearchParams` of the state, and typing does not change the URL.

**Mutation runs** (not committed; the file was restored and the suite re-run green):

| Mutation | Killed by |
|---|---|
| `peekCurrent` spends (`deps.spend`) instead of `gateway.peek` | 2 red, including "uncached location … (0 fetches)" |
| `search()` sends the narrow (filtered) request | First survived. Added "filters set before searching never reach the request…", which is now red |

**renter-search.spec.ts (6 tests × root + sub = 12 passed):**
- **Keyless:** the empty state passes axe. Try a sample search gives `/^\d+ rentals? in /`, a Sample data chip in the results section, and the button reads "(0 calls · sample data)". 0 RentCast calls, and the results pass axe.
- **Validation:** the three location errors show, the input is focused with `aria-invalid`, and there are 0 calls.
- **Live budget:**
  - The button reads "Search rentals (1 call)". The click makes 1 listings request (`zipCode=74201`, `status=Active`, `limit=500`, plus `suppressLogging` only).
  - Max 2000, Bedrooms 2, Condo, 14 days and Rent: low to high still leave 1 call. The heading reads `N of M rentals in 74201`, the button "(0 calls · cached)", and the URL carries `max`/`sort`.
  - A reload makes 0 new calls with the same heading.
  - A `browser.newContext()` on the shared URL (its own deny-all, mocks and key) shows 74201 and Max 2000 prefilled, the button at "(1 call)", the empty state and 0 calls.
- **Truncation:** `many500` shows the notice, with no Narrow button until a filter is set. **Narrow on RentCast (1 call)** passes axe and makes exactly 1 more call with `price=0%3A2000`. No URL ever contains `offset`.
- **NoResults:** "No results for this search". **Edit search** focuses the location input.
- **375×812:** the Filters disclosure toggles `aria-expanded`. With the panel open it passes axe and `scrollWidth <= 375`. Escape closes it and focuses the toggle. Removing the last chip focuses the toggle, and its label goes back to "Filters".

## Verification
- `corepack pnpm vitest run --project web src/lib/features/renter/search`: 13 passed
- `corepack pnpm test:unit`: 153 files, 3057 tests passed
- `corepack pnpm check`: 0 errors, 0 warnings. `corepack pnpm lint`: clean. `banned`: passed (141 files). `ui:guard`: passed
- `build:root` + `build:sub` + `csp:assert`: 17 pages each, all passing. These ran under `.tools/build.lock`, which was released.
- `playwright test renter-search renter-harness renter-affordability routing csp a11y marketing layout`: 462 passed and 2 failed on the first run. The 2 were layout text-spacing at 375px, fixed below. After the fix, `renter-search layout`: 220/220 passed on both bases.
- Acceptance greps: every listed literal is present. No `$effect` line in search-state.svelte.ts calls `.get(`/`.refresh(` (the file has no `$effect` at all).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Shallow `replaceState` instead of `goto(..., { replaceState: true })`**
- `goto` runs a client navigation for every filter change. That fires navigation hooks such as the route announcer and focus handling, which is wrong for a local filter. `$app/navigation` `replaceState` only rewrites history. It is gated on `restored`, so the first effect run cannot wipe `?max=1800` (the renter-affordability CTA spec still passes). There is one justified `eslint-disable-next-line svelte/no-navigation-without-resolve`, since the URL is `resolve('/renter/')` plus the page's own query.
- Commit: fced180

**2. [Rule 1 - Bug] Chip inputs were not reachable by pointer**
- A `sr-only` input inside the chip label was "outside of the viewport" and the label intercepted clicks, so Playwright could not check it. The native input now covers its chip at opacity 0 (`absolute inset-0`) inside a `relative` label. It is still the real radio or checkbox for keyboard, pointer and assistive tech, and the label draws the chip.
- Commit: fced180

**3. [Rule 1 - Bug] WCAG 1.4.12 text spacing overflowed 375px**
- `layout.spec` text-spacing on `renter/` overflowed by 6px. The cause was the nowrap "Search rentals (0 calls · sample data)" label. The Search and Narrow buttons now wrap (`h-auto min-h-12 py-2 whitespace-normal`).
- Commit: fced180

**4. [Rule 2 - Missing critical] Additions beyond the plan's file list**
- `cost-estimate.svelte.ts` holds the shared estimateCost-only `$effect` for the Search and Narrow CostLabels. It never calls get/refresh.
- `refresh()` on the controller backs ProvenanceRow's live "Refresh (1 call)" through `requestSpend(req, 'refresh')`. `peekCurrent()` re-reads the cache when the runtime's gateway changes (start or mode switch), so sample rows never show under live provenance.
- The latest load wins (a sequence guard), and a dismissed over-cap prompt restores the previous state.

**5. [Plan wording] The filter announcement lives in the controller**
- The 500ms-debounced "Showing {shown} of {n} rentals." is scheduled by `setFilters` in the controller rather than inside FilterFields. Chip removal and Clear filters announce through the same path.

## Notes for downstream plans
- 06-16: render `search.sorted.slice(0, search.shownCount)` and use `showMore()`, `select(id)`, `hover(id)`, `newIds`, `view`/`setView`. The results-section placeholder comment in SearchPage marks the slot. The "No rentals match these filters" local empty state (UI-SPEC core elements) belongs with the cards. It is not built here.
- 06-20: fill `saved/SaveSearchButton.svelte` (already placed in ResultsHeader) and `saved/SavedSearchesSection.svelte` (already placed above the form). Both receive `{ search }`. Restore a saved search with `search.restoreFromUrl(encodeSearchParams(...))`, which is 0 calls.
- No shortlist toggle was needed in this plan, so nothing here touches 06-14's files.
- Minor: if a live Refresh fails, ProvenanceRow still announces "Refreshed…", because the controller resolves into the GatewayError state instead of rejecting. That avoids an unhandled rejection from the row's click handler. GatewayError then announces the real error.

## Known Stubs
- `apps/web/src/lib/features/renter/saved/SaveSearchButton.svelte` and `SavedSearchesSection.svelte` render nothing (`<!-- filled by 06-20 -->`). This is intentional and planned, and 06-20 fills them.
- The results list, tabs and map slot inside the results section are empty and come in 06-16/06-19. The search goal works without them: the count, provenance, sort, truncation and chips all work.

## Self-Check: PASSED
