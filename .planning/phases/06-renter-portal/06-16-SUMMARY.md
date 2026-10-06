---
phase: 06-renter-portal
plan: 16
subsystem: renter-search
tags: [renter, results, listing-card, tabs, shadcn, bits-ui, pagination, e2e, axe, svelte5]
requires:
  - "06-13 createRenterSearch (sorted/filtered/rows/shownCount/showMore/view/setView/select/hover/newIds/clearFilters), SearchPage results slot"
  - "06-14 ShortlistToggle (card variant), listing/address streetLine/placeLine, /renter/listing/?id="
  - "06-10 PropertyTypeMark, ListingStatusChip; 06-07 propertyTypeLabel, url-state view param; 06-03 formatRent/formatSqft/relativeListed"
  - "04-14 ProvenanceChip (sample variant)"
provides:
  - "components/ui/tabs: shadcn-svelte tabs copy-in reconciled to Phase 2 tokens"
  - "features/renter/search/ListingCard.svelte (generic row/provenance/now props; selected/highlighted/compact/isNew/onhover)"
  - "features/renter/search/ResultsList.svelte (24-card local pages, focus + announce, delayed skeletons)"
  - "features/renter/search/ResultsView.svelte (List | Map tabs bound to search.view, mapOpened)"
  - "features/renter/search/FilteredEmptyState.svelte"
  - "features/renter/map/MapTab.svelte STUB taking { search } (06-19 owns it)"
  - "tests/e2e/renter-results.spec.ts (6 tests x root + sub)"
affects: [06-19 map (fills MapTab; ListingCard compact + highlighted/selected for the split view and SelectedListingPreview), 06-20 saved searches (sets search.newIds -> New badge renders), 06-22 gate, Phase 7 (ListingCard reuse)]
tech-stack:
  added: []
  patterns:
    - "Tabs bound one-way: value={search.view} + onValueChange -> search.setView; the page's existing URL mirror writes view=map"
    - "Lazy panel: Map Tabs.Content renders MapTab only after the first Map selection and keeps it mounted (bits-ui hides inactive panels with the hidden attribute)"
    - "Stretched address link (::after inset-0) + ShortlistToggle relative z-1 above it; card focus ring via has-[a:focus-visible]"
    - "Abbreviations rendered through snippets so the literal <abbr title=...> markup survives Prettier wrapping"
key-files:
  created:
    - apps/web/src/lib/components/ui/tabs/index.ts
    - apps/web/src/lib/components/ui/tabs/tabs.svelte
    - apps/web/src/lib/components/ui/tabs/tabs-list.svelte
    - apps/web/src/lib/components/ui/tabs/tabs-trigger.svelte
    - apps/web/src/lib/components/ui/tabs/tabs-content.svelte
    - apps/web/src/lib/features/renter/search/ListingCard.svelte
    - apps/web/src/lib/features/renter/search/ResultsList.svelte
    - apps/web/src/lib/features/renter/search/ResultsView.svelte
    - apps/web/src/lib/features/renter/search/FilteredEmptyState.svelte
    - apps/web/src/lib/features/renter/search/results-ui.test.ts
    - apps/web/src/lib/features/renter/search/ResultsView.browser.test.ts
    - apps/web/src/lib/features/renter/map/MapTab.svelte
    - apps/web/tests/e2e/renter-results.spec.ts
  modified:
    - apps/web/src/lib/features/renter/search/SearchPage.svelte
    - apps/web/tests/e2e/renter-search.spec.ts
key-decisions:
  - "ResultsView renders whenever rows exist (not only status 'ready'), so a re-search in flight shows the 6 skeletons after 300ms in place of the previous cards"
  - "The pagination button reads 'Show 24 more' while 24+ remain and 'Show {n} more' on the last partial page (never promises cards that do not exist)"
  - "The count line 'Showing {shown} of {n}' appears only when there is more than one page"
  - "Tabs list carries aria-label 'Show results as'; activation is automatic (arrow keys select), matching the E2E contract that ArrowRight lands on Map and writes view=map"
requirements-completed: []
metrics:
  duration: ~35 min
  completed: 2026-10-05
  tasks: 2
  files: 15
---

# Phase 6 Plan 16: Result cards, pagination and List/Map tabs Summary

Search results now render as honest listing cards: a property mark, the rent as "$1,650 a month", a facts line ("Studio" for 0 bedrooms, `<abbr>` bd/ba, missing parts left out), the street address as a stretched link to `/renter/listing/?id=`, the place line, "{type} · Listed {relative}" (or "Listing date not shown"), and a chips row. Every sample card carries its own Sample data chip, the New badge comes from `search.newIds`, and the recency chip appears only when RentCast has not seen the listing lately. No card says "available". Each card has a Save/Saved shortlist toggle that touches storage only. The list pages 24 at a time locally, and List | Map are WAI-ARIA tabs kept in the URL. The Map panel is a named stub for 06-19.

Advances **RENT-02** (results as a sortable list of cards). It stays open until the 06-22 gate, so `requirements mark-complete` was not run.

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 | Tabs copy-in, ListingCard, ResultsList, FilteredEmptyState, SSR tests | d465061 |
| 2 | ResultsView tabs + URL state, MapTab stub, SearchPage wiring, browser test, E2E | a1159af |

## What the tests prove

**results-ui.test.ts (11 SSR tests):**
- A 0-bedroom sample row shows "Studio", "$1,650 a month", "Sample data", `<abbr title="bathrooms">ba</abbr>`, "480 sq ft" and the exact sr-only summary "$1,650 a month, studio, 1 bathroom, 480 square feet, Condo, listed 7 days ago.". Its address link `href` contains `renter/listing/?id=`, and nothing contains "available".
- Missing baths and sqft are omitted, never shown as 0.
- A null listedDate gives "Condo · Listing date not shown". `isNew` adds "New" plus the sr-only " since your last visit".
- A live row has no Sample chip. Selected sets `aria-current="true"`, and compact drops the mark.
- 60 rows give 24 cards, "Showing 24 of 60" and "Show 24 more". 30 rows give "Show 6 more". One page shows no paging. FilteredEmptyState renders the exact copy and nothing otherwise.

**ResultsView.browser.test.ts (3 tests, real Chromium, real `createRenterSearch` with a counting spend):**
- "Show 24 more" renders 48 cards and focuses `card-{sorted[24].id}-addr`.
- Map starts at `tabindex=-1`, and ArrowRight selects and focuses it. `search.view` becomes `'map'`, and the stub mounts. After ArrowLeft the stub stays mounted but hidden.
- Clear filters restores the cards and calls `onFiltersCleared`.
- spend is called exactly once across search, paging, tab switches and Clear filters, and axe is clean.

**renter-results.spec.ts (6 tests × root + sub = 12 passed):**
- Cards: the first card has "a month", a visible Sample data chip, `data-provenance="sample"` and a detail `href`. The Phase 4 unbadged-sample check returns 0, and no card mentions "available". Sorting by Rent: low to high makes the first three rents non-decreasing.
- Pagination: live `many500` → "Showing 24 of 500". **Show 24 more** → 48 cards, and focus is on card 25's address link (`href` /renter\/listing/). Listing calls stay at 1.
- Filtered empty: Max 1 → "No rentals match these filters" plus "Clearing them costs nothing.", with 0 cards and axe clean. **Clear filters** restores every card.
- Tabs: ArrowRight → Map, selected and focused. The URL gains `view=map`, the stub shows, and axe is clean. After leaving for the detail page, Back restores `view=map` with Map selected. List removes `view`. There is no `.leaflet-container`, `net.counts.tiles` is undefined, and there are 0 calls.
- Shortlist: **Save** → **Saved** with `aria-pressed="true"`, 0 calls.
- 375px: axe is clean, `scrollWidth <= 375` with and without the WCAG 1.4.12 text-spacing overrides (a constructed sheet, since CSP refuses `<style>`), and axe is clean on the Map tab.

## Verification
- `corepack pnpm vitest run --project web src/lib/features/renter/search`: 24 passed. `--project web-browser`: 3 passed.
- `corepack pnpm test:unit`: 161 files, 3136 tests passed. The first run had 3 failures in one file, consistent with the known precommit.test.ts HEAD-moved flake while siblings committed. The re-run was green.
- `corepack pnpm check`: 0 errors, 0 warnings. eslint is clean on all touched files. Prettier is clean. `banned`: passed (159 files). `ui:guard`: passed (61 files).
- `build:root` + `build:sub` + `csp:assert` (17 pages each) all pass. `playwright test renter-results renter-search renter-listing`: 38/38 passed. Earlier, `renter-results renter-search layout`: 232/232 passed. All of these ran under `.tools/build.lock`, which was released every time.
- Acceptance greps: there is no `dark:` or `data-[state=active]:bg-` in ui/tabs, and every listed literal is present. `grep -c "leaflet\|supercluster" MapTab.svelte` gives 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] renter-search.spec strict-mode clash caused by the new cards**
- **Found during:** Task 2
- **Issue:** `results(page).getByText('Sample data', { exact: true })` matched only one element before. With every sample card now carrying its own chip, it matched many, which is a Playwright strict-mode violation.
- **Fix:** Changed it to `.first()`. The test's intent is the same: a Sample data chip is visible in the results.
- **Files modified:** apps/web/tests/e2e/renter-search.spec.ts
- **Commit:** a1159af

**2. [Rule 2 - Missing critical] Browser-project test for the tabs and the 0-spend guarantee**
- The plan listed only SSR tests and E2E. Per the wave guidance, bits-ui tabs (roving tabindex and arrow keys) and "paging and tab switches never spend" are now also proven in the browser project against the real controller (`ResultsView.browser.test.ts`).
- **Commit:** a1159af

**3. [Plan wording] Text-spacing check added to the 375px E2E**
- 06-13 had overflowed 6px under the WCAG 1.4.12 overrides. The 375px results test now applies those overrides too and asserts no horizontal scroll. Long button labels ("Show 24 more", Clear filters) are set to wrap: `h-auto min-h-11 whitespace-normal`, full width below 640px.

## Notes for downstream plans
- **06-19:** Replace `features/renter/map/MapTab.svelte`. It receives `{ search }`, mounts on the first Map selection and stays mounted, so handle `invalidateSize` when the tab becomes visible. Its tabpanel is `hidden` while List is active. For the split view and SelectedListingPreview, use `ListingCard` with `compact`, `selected`, `highlighted` and `onhover` (cards already call `search.hover` from ResultsList). Cards expose `data-listing-card={id}` for scroll-into-view lookups. ResultsView already scrolls the selected card into view when the user returns to List.
- **06-20:** Set `search.newIds`, and the New badge renders on the matching cards. Nothing else is needed.
- ResultsView is wired in SearchPage only inside the results `<section>` under `{#if search.rows.length > 0}`. 06-20's SearchPage edits can sit beside it.

## Known Stubs
- `apps/web/src/lib/features/renter/map/MapTab.svelte` renders only "Loading map…". This is intentional and planned: 06-19 owns the file and fills it with the lazy Leaflet map. The List tab fully meets this plan's goal (RENT-02 sortable list).

## Self-Check: PASSED
