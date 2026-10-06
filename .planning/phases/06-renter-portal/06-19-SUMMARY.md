---
phase: 06-renter-portal
plan: 19
subsystem: renter-map
tags: [leaflet, supercluster, openstreetmap, csp, a11y, axe, target-size, lazy-load, e2e, svelte5]
requires:
  - "06-16 ResultsView (mounts MapTab on first Map selection, keeps it mounted/hidden), ListingCard (selected/compact), search.view URL sync"
  - "06-13 search controller (filtered, selectedListingId, hoveredListingId, select, hover, newIds, provenance, locationText)"
  - "06-05 MAP_LIBS lint boundary (leaflet/supercluster only under shared/listings/map), service-worker OSM guard"
  - "06-04 img-src 'self' https://tile.openstreetmap.org; EXTERNAL_HOSTS www.openstreetmap.org"
  - "06-09 E2E net fixture (tile mock, counts.tiles, tileReferers), mockRentCast extraRows, withRentCastKey"
provides:
  - "features/shared/listings/map/pins.ts: pinLabel, pinText, pinStreet, clusterLabel, spotTitle, pinWidth, buildPinElement, buildClusterElement (DOM + textContent only)"
  - "features/shared/listings/map/cluster.ts: CLUSTER_OPTIONS {radius 48, extent 256, maxZoom 19}, MAP_MAX_ZOOM 18, toPointFeatures, createClusterIndex"
  - "features/shared/listings/map/LazyMap.svelte: the only entry to the map chunk (dynamic import, 300ms loading state, failure panel + Show list, retry on re-show)"
  - "features/shared/listings/map/ListingMap.svelte: Leaflet in onMount, OSM tiles (live) or grid backdrop (sample), keyed supercluster markers, active prop -> invalidateSize"
  - "features/renter/map/MapTab.svelte (replaces the 06-16 placeholder) + SelectedListingPreview.svelte"
  - "tests/e2e/renter-map.spec.ts (11 tests x root + sub)"
affects: [06-22 gate (RENT-02 map evidence), Phase 7 investor map (reuse LazyMap/ListingMap from shared/listings/map), Phase 8 (img-src merge keeps the OSM host)]
tech-stack:
  added: ["leaflet 1.9.4", "supercluster 9.1.0 (ships its own types)", "@types/leaflet 1.9.22 (dev)"]
  patterns:
    - "Map chunk reachable only via LazyMap's import('./ListingMap.svelte'); Leaflet itself is a second await import('leaflet') inside onMount"
    - "Markers keyed (p:id:new:coords / c:clusterId:count) and diffed per draw, so selection/hover restyle existing nodes and keyboard focus survives"
    - "CSP-safe tile cancel: TileLayer.extend overriding _removeTile/_abortLoading to removeAttribute('src') instead of Leaflet's data: GIF"
    - "Map container height lives in the component's own CSS (clamp(320px, 60dvh, 480px)) so Leaflet never measures a 0px box, even without Tailwind"
    - "{#key mode} around LazyMap: a sample->live switch remounts the map with or without the tile layer"
key-files:
  created:
    - apps/web/src/lib/features/shared/listings/map/pins.ts
    - apps/web/src/lib/features/shared/listings/map/pins.test.ts
    - apps/web/src/lib/features/shared/listings/map/cluster.ts
    - apps/web/src/lib/features/shared/listings/map/cluster.test.ts
    - apps/web/src/lib/features/shared/listings/map/LazyMap.svelte
    - apps/web/src/lib/features/shared/listings/map/ListingMap.svelte
    - apps/web/src/lib/features/shared/listings/map/map.browser.test.ts
    - apps/web/src/lib/features/renter/map/SelectedListingPreview.svelte
    - apps/web/tests/e2e/renter-map.spec.ts
  modified:
    - apps/web/package.json
    - pnpm-lock.yaml
    - apps/web/src/lib/features/renter/map/MapTab.svelte
    - apps/web/tests/e2e/renter-results.spec.ts
    - apps/web/src/lib/features/renter/search/ResultsView.browser.test.ts
key-decisions:
  - "Pin/cluster sizes and clustering follow the orchestrator reconciliation over UI-SPEC: pins 28px tall (min-width 44px, width grows with the rent text, +20px for the BellDot when new), clusters 40px circles (UI-SPEC said 44/64px), supercluster {extent 256, radius 48, maxZoom 19} (UI-SPEC radius 60 / maxZoom 16 superseded), map and tile maxZoom 18 (UI-SPEC tile maxZoom 19 superseded)"
  - "Live vs sample comes from the results' provenance (source 'rentcast' = live), not the runtime mode, so sample rows never land on real streets even right after a key is added"
  - "Leaflet 1.9.4 cancels unloaded tiles by pointing them at a data: GIF, which img-src refuses (a CSP violation on every zoom/pan); a TileLayer subclass removes the src instead. Mutation-proven by the live E2E"
  - "Enter/Space activation is our own keydown listener: Leaflet 1.9.4 maps Enter on a marker only to popups, and popups are banned here"
  - "Selection focus goes to the preview's address link only after a map activation (focusToken), never on passive selection changes"
  - "The map region is <section aria-labelledby> with an sr-only h3 'Map of {n} rentals' (RESEARCH Pattern 2), not role=region + aria-label on the Leaflet div"
requirements-completed: []
duration: 25min
completed: 2026-10-05
---

# Phase 6 Plan 19: Lazy Leaflet map with clusters and selection Summary

**The Map tab now loads Leaflet and supercluster on demand. Live results draw on OpenStreetMap tiles with the default Referer, visible attribution and zero CSP violations. Sample results draw on a plain grid with zero third-party requests. Rent pins are built from DOM nodes and named for screen readers. Co-located units cluster and list as "rentals at this spot", and selecting a pin shows its card below the map and moves focus to its link.**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-10-05
- **Tasks:** 3
- **Files:** 9 created, 5 modified

## Accomplishments

- **Lazy by construction.** `MapTab` imports only `LazyMap`. `LazyMap` holds the single `import('./ListingMap.svelte')`, and `ListingMap` runs `await import('leaflet')` in `onMount`. In the build, exactly one chunk contains `tile.openstreetmap.org`, and `renter/index.html` modulepreloads none of its 42 preloads that contain it. E2E shows the marketing home and the List tab never load it, while opening the Map tab does. There is no `data:image` in any built CSS, and the service worker does not mention leaflet.
- **OSM policy.** Live mode uses one tile host, sets no referrer or crossOrigin options, uses Leaflet's default buffering, and shows the "Leaflet | © OpenStreetMap contributors" attribution on an opaque card background at 14px. "Report a map problem" goes to `https://www.openstreetmap.org/fixthemap`, and `curl -sI` returned 200. Sample mode has no tile layer and shows the 64px grid backdrop, the caption and the Sample chip.
- **CSP fix found during execution.** Leaflet 1.9.4 cancels unloaded tiles by pointing them at a `data:` GIF, which `img-src` refuses. The fix is `CspSafeTileLayer` (see Deviations). The live E2E zooms and pans, then asserts zero violations, and a planted `data:` image confirms the check is real.
- **Accessible markers.** Each pin and cluster is a Leaflet keyboard marker (`tabindex=0`, `role=button`) with `title` and `aria-label`. Pins are labelled like "New. $2,150 a month, 418 Larkspur Ln, studio", and clusters "{n} rentals here. Zoom in to see them.". Enter and Space activate them. Activating a cluster zooms to its expansion zoom, or, past map maxZoom, lists its units in the preview. Selection and hover restyle the existing nodes, so focus is never lost. Zoom buttons are 44×44. Wheel zoom turns on only after a click or focus on the map. Under reduced motion, every animation is off.
- **MapTab and preview.** These include the instructions line, the "Skip the map" link to `#after-map`, a labelled section, the announcements ("Map ready. {n} rentals shown." / "Map ready with sample listings." / "{street}, {$rent} a month, selected." / "{n} rentals at this spot."), `SelectedListingPreview` (empty prompt, `ListingCard selected`, or the spot list), and `invalidateSize` whenever the panel is shown again.

## Task Commits

1. Task 1 RED: failing pin and cluster helper tests: `d58fe1c`
2. Task 1 GREEN: map libraries plus pure pin and cluster helpers: `1174e62`
3. Task 2: lazy Leaflet map with clusters and selection, plus browser tests: `27decd6`
4. Task 3: map E2E, and the stub assertions updated in renter-results and ResultsView: `8e97ec4`

## Verification

- `vitest --project web` map folder: 19/19 (pins and cluster). `--project web-browser` map plus ResultsView: 7/7. These cover DOM-built pins (markup stays text), names and roles, Enter/Space, a 5-unit cluster with a spot list, focus surviving selection, and axe on both map states.
- Repo `test:unit`: 3170/3170. `check`: 0 errors. `lint` (prettier + eslint): clean. `banned`: passed. `ui:guard`: passed.
- `build:root` + `build:sub` + `csp:assert`: 17 pages each. The plan's preload check script exited 0.
- `playwright test renter-map` passes 11/11 per base. `playwright test renter layout csp a11y routing pwa` on root + sub: 502/502 passed.
- **Mutation tests.** All six mutations failed tests, and the code was restored after each.
  - Unit (cluster.ts): radius 60, extent 512, supercluster maxZoom 18, `MAP_MAX_ZOOM` 19, and dropping the latitude finiteness check.
  - E2E: a plain `lib.TileLayer` instead of `CspSafeTileLayer` failed the live test with a CSP violation. A tile layer in sample mode failed the sample test on the tile count. Supercluster maxZoom 17 failed the co-located test.
- All builds and E2E runs held `.tools/build.lock` and released it.

## Requirement Progress

This plan advances **RENT-02**, "view results on a map": the map tab, OSM policy, CSP, keyboard access and axe. The requirement is not marked complete; it closes at the 06-22 gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Leaflet 1.9.4 tile cancellation violates img-src**
- **Found during:** Task 2 (source review), proven in Task 3
- **Issue:** `TileLayer._removeTile` and `_abortLoading` set `src` to `data:image/gif;base64,…`. Every zoom or pan then raises an `img-src` CSP violation, which conflicts with the "zero CSP violations" truth.
- **Fix:** `lib.TileLayer.extend` overrides both private methods (version pinned at 1.9.4) to `removeAttribute('src')` instead. Without a `src` attribute the image fires no load or error event, so `_tileReady` is not reached.
- **Files:** ListingMap.svelte
- **Commit:** 27decd6

**2. [Rule 1 - Bug] The map measured 0px without Tailwind**
- **Found during:** Task 2 browser tests
- **Issue:** The height came only from a Tailwind class. In the browser test (no Tailwind) the container was 0px tall, so no markers drew. This is Pitfall 14 in miniature.
- **Fix:** The height `clamp(320px, 60dvh, 480px)` moved into the component's own CSS.
- **Commit:** 27decd6

**3. [Rule 3 - Blocking] 06-16 tests asserted the placeholder**
- **Found during:** Task 3 E2E
- **Issue:** `renter-results.spec.ts` (3 places) and `ResultsView.browser.test.ts` (2 places) expected the "Loading map…" placeholder, `data-map-stub`, and no `.leaflet-container`.
- **Fix:** They now assert the real map. The container is visible on Map, hidden but still mounted (exactly one) on List, and sample mode still makes no tile request.
- **Commit:** 8e97ec4

**4. [Plan wording] pins.ts header comment**
- The plan's header sentence contains the word "innerHTML". That conflicts with its own acceptance check (`grep -c innerHTML pins.ts` must output 0). The comment now reads "parsed as markup" and keeps the same meaning.

**5. [Rule 2 - Additional] Extras**
- `map.browser.test.ts` adds the component-level axe and keyboard proof. Pin focus and hover call `search.hover` (list ↔ map linking). LazyMap retries a failed import when the tab is shown again ("choose the Map tab again"). A tile request with an empty Referer fails the live test.

## Known Stubs

None. The split view at 1024px+ was never built by 06-16 (the list and map are separate tabs at every width), so the preview under the map serves every width. That matches the UI-SPEC's behaviour below 1024px.

## Issues Encountered

- 06-20's in-flight files briefly caused `check` errors in `renter/saved/*` mid-wave. They were not mine and were gone once 06-20 committed. The final `check` is clean.

## Next Phase Readiness

- Phase 7 can reuse `LazyMap` and `ListingMap` from `features/shared/listings/map`. Pass `rows`, `mode` (from provenance), `fitKey`, `active` and the callbacks.
- The 06-22 gate can cite `renter-map.spec.ts` for RENT-02's map criteria.

## Self-Check: PASSED

- FOUND: pins.ts, cluster.ts, LazyMap.svelte, ListingMap.svelte, map.browser.test.ts, MapTab.svelte, SelectedListingPreview.svelte, renter-map.spec.ts
- FOUND commits: d58fe1c, 1174e62, 27decd6, 8e97ec4
