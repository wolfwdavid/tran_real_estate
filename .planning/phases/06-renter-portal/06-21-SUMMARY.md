---
phase: 06-renter-portal
plan: 21
subsystem: renter-map
tags: [split-view, leaflet, list-map-linking, bounds, a11y, axe, e2e, svelte5, mutation-testing]
requires:
  - "06-19 ListingMap/LazyMap (keyed markers, restyle on selectedId/highlightedId, wheel gating), MapTab, SelectedListingPreview"
  - "06-16 ListingCard (compact/selected/highlighted/onhover, data-listing-card), ResultsView (Map panel kept mounted)"
  - "06-13 search controller (filtered, sort, selectedListingId, hoveredListingId, select, hover)"
provides:
  - "renter/map/in-bounds.ts: rowsInBounds(rows, {west,south,east,north}) — pure, inclusive edges, input order, drops non-finite coordinates"
  - "renter/map/SplitList.svelte: 400px region 'Rentals in this view' (tabindex 0) with '{n} rentals in this map view' and compact cards"
  - "ListingMap onbounds prop (first fit + every moveend), data-zoom on the container, data-listing-pin on rent pins"
  - "MapTab split layout from 1024px (lg:grid-cols-[400px_1fr], sticky map calc(100dvh - 128px) min 480px)"
  - "tests/e2e/renter-map-split.spec.ts (7 tests x root + sub)"
affects: [06-22 gate (RENT-02 list-map linking evidence), Phase 7 investor map (onbounds available on the shared map)]
tech-stack:
  added: []
  patterns:
    - "Map bounds cross the shared/portal boundary as plain numbers; the portal filters with a pure helper"
    - "Pin activation routes focus by width at activation time: scrollToken (split list) at >=1024px, focusToken (preview) below"
    - "Map height override for the split view lives in MapTab's scoped CSS (media query on [data-map-split]), the shared map keeps its own clamp default"
key-files:
  created:
    - apps/web/src/lib/features/renter/map/in-bounds.ts
    - apps/web/src/lib/features/renter/map/in-bounds.test.ts
    - apps/web/src/lib/features/renter/map/SplitList.svelte
    - apps/web/tests/e2e/renter-map-split.spec.ts
  modified:
    - apps/web/src/lib/features/shared/listings/map/ListingMap.svelte
    - apps/web/src/lib/features/renter/map/MapTab.svelte
    - apps/web/tests/e2e/renter-map.spec.ts
key-decisions:
  - "Before the map first reports bounds, the split list shows every filtered result (count <= total still holds)"
  - "From 1024px the SelectedListingPreview is hidden for a single selection (the split list shows it) but still shows a co-located spot list, which the split list cannot express"
  - "Pin hover uses mouseenter/mouseleave gated on matchMedia('(hover: hover)') (was pointerType === 'mouse'), matching ListingCard and the UI-SPEC wording"
  - "The scroll/focus effect reads selectedListingId untracked and runs only on a pin activation token, never on passive selection changes, and never while an input/select/textarea has focus"
requirements-completed: []
duration: 35min
completed: 2026-10-05
---

# Phase 6 Plan 21: Split view and list-map linking Summary

**From 1024px the Map tab is a split view: a 400px keyboard-scrollable list of only the rentals inside the current map view ("{n} rentals in this map view", in the chosen sort) beside a sticky full-height map. Hovering or focusing a card highlights its pin and vice versa; Enter on a pin scrolls its card into view and focuses its link; the wheel zooms the map only after it is clicked or focused.**

## Performance

- **Duration:** about 35 min
- **Completed:** 2026-10-05
- **Tasks:** 2
- **Files:** 4 created, 3 modified

## Accomplishments

- **`rowsInBounds`** is pure (no Leaflet import, lint boundary intact), edge-inclusive and order-preserving, and drops null/undefined/NaN/Infinity coordinates. 8 unit tests; mutation-tested: each of the four `>=`/`<=` edges flipped to strict, both finiteness guards removed (caught by a view spanning 0, since `null >= -1` is true in JS), and a lat/lng swap — all 7 mutants killed.
- **ListingMap:** `onbounds` after the first fit and on every `moveend`; `data-zoom` mirrors the zoom for tests; rent pins carry `data-listing-pin`; pin hover gated on `(hover: hover)`. Existing wheel gating (`scrollWheelZoom: false`, `enable()` on click/focusin, `disable()` on focusout) and `animate: motionOK` kept.
- **SplitList:** `role="region"`, `tabindex="0"`, `aria-label="Rentals in this view"`, sticky header with singular/plural count, compact `ListingCard`s with selected/highlighted/onhover, an empty "No rentals in this part of the map" hint. On a pin activation it scrolls the card (`smooth` under no-preference, `instant` under reduce, `block: 'nearest'`) and focuses its address link, scoped to the region (the hidden List tab holds the same ids).
- **MapTab:** `lg:grid lg:grid-cols-[400px_1fr] lg:gap-8` with the list left and the sticky (`lg:top-4`) map right at `calc(100dvh - 128px)`, min 480px. Below 1024px the 06-19 layout is unchanged.

## Task Commits

1. Task 1 RED: failing bounds filter tests: `e804bbb`
2. Task 1 GREEN: bounds filter: `2ab7905`
3. Task 1: split view and list-map linking: `b406c76`
4. Task 2: split view E2E (+ renter-map selectPin update): `9610db8`

## Verification

- `vitest --project web src/lib/features/renter/map`: 8/8. `web-browser` map + ResultsView: 7/7. Repo `test:unit`: 3178/3178 (first run hit the known libuv worker crash; clean on re-run).
- `check`: 0 errors / 0 warnings. `lint`: clean. `banned`: passed.
- `build:root` + `build:sub` + `csp:assert`: 17 pages each.
- `playwright test renter layout csp a11y routing pwa` on root + sub: **516/516** (was 502; +14 split tests). `renter-map` 11/11 per base still green.
- **E2E mutation tests** (rebuild per mutant, code restored after each): split list ignoring bounds (zoom test fails); no focus after activation (3 fail); no scrollIntoView (3 fail); `highlightedId={null}` to the map (hover test fails); no wheel enable on click+focusin (wheel test fails); `scrollWheelZoom: true` at creation (wheel test fails); no `disable()` on blur (wheel test fails, after fixing the test's own focus-scroll — see Deviations).
- All builds and E2E runs held `.tools/build.lock` and released it.

## Requirement Progress

Advances **RENT-02** ("list↔map hover/selection linked", CONTEXT). Not marked complete; it closes at the 06-22 gate. This plan is ROADMAP cut-line item (1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] renter-map.spec selectPin assumed the preview at desktop**
- **Found during:** Task 2 design (Playwright's Desktop Chrome viewport is 1280 wide, so the 06-19 desktop tests now run in split view)
- **Fix:** `selectPin` looks for the single visible `article[data-listing-card][aria-current="true"]`, which is the preview card below 1024px and the split-list card from 1024px.
- **Commit:** 9610db8

**2. [Test rigor] Wheel "turns off on blur" step was vacuous on first write**
- **Issue:** `mapTab.focus()` scrolled the page so the mouse left the map; the mutant without `disable()` passed.
- **Fix:** focus with `preventScroll: true` and re-aim the mouse at the map before the wheel; the mutant now fails.
- **Commit:** 9610db8

**3. [Plan detail] Interfaces**
- The plan's `onhover(id | null)` on pins and wheel gating already existed from 06-19; kept and tightened (hover media query). `data-zoom` / `data-listing-pin` added for E2E observability. The split view's `ViewBounds` type is declared locally in ListingMap (shared code may not import portal folders); it is structurally identical to `MapBounds`.

## Known Stubs

None.

## Issues Encountered

- One `svelte-ignore` comment with trailing prose was parsed as extra rule codes by eslint (`no-unused-svelte-ignore`); the explanation moved to its own comment.

## Self-Check: PASSED

- FOUND: in-bounds.ts, in-bounds.test.ts, SplitList.svelte, renter-map-split.spec.ts
- FOUND commits: e804bbb, 2ab7905, b406c76, 9610db8
