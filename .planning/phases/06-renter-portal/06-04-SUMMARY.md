---
phase: 06-renter-portal
plan: 04
subsystem: renter-routes-csp
tags: [sveltekit, routes, prerender, csp, img-src, openstreetmap, e2e, playwright, a11y, aria-current]
requires:
  - "Phase 1 01-04 CSP oracle contract (two-file literal duplicate)"
  - "Phase 2 PortalSwitcher route-id current-link pattern, routes.ts single route list"
  - "Phase 4 04-22 (app) layout: DataShell status bar then AppNotice inside <main>"
provides:
  - "Four prerendered renter routes: /renter/, /renter/listing/, /renter/shortlist/, /renter/affordability/ (titles, h1s, leads, unique meta descriptions)"
  - "(app)/renter/+layout.svelte rendering RenterNav before every renter page"
  - "RenterNav: <nav aria-label=\"Renter tools\"> with Search/Shortlist/Affordability, aria-current from route id (listing -> Search), optional shortlistCount badge (wired by 06-15)"
  - "img-src 'self' https://tile.openstreetmap.org in svelte.config.js and assert-csp.mjs EXACT, with mutation tests"
  - "prerender.entries ['*', '/renter/listing/']"
  - "RENTER_ROUTES export; APP_ROUTES/ROUTES and EXPECTED_PAGES include the three new renter pages"
  - "Link check skips tel:/mailto:; EXTERNAL_HOSTS gains www.openstreetmap.org, www.google.com, www.zillow.com"
  - "PortalSwitcher marks the portal root aria-current=\"true\" on that portal's sub-pages"
affects: [06-14 listing detail, 06-15 shortlist count, 06-19 Leaflet map, 06-22 gate, Phase 7 investor sub-routes (inherit the PortalSwitcher section marking), Phase 8 (img-src merge: append blob:)]
tech-stack:
  added: []
  patterns:
    - "Sub-nav current link from page.route.id (an id list per link) so aria-current is in the prerendered HTML under both bases"
    - "Portal section marking: aria-current='page' on the exact route, 'true' on descendants, styled with Tailwind aria-[current]: (matches any value)"
    - "Svelte trims leading whitespace in literal element text and entities; a visually hidden suffix with a leading space comes from a script constant"
    - "$app/state mocked with vi.hoisted + vi.mock in Node svelte/server component tests"
key-files:
  created:
    - apps/web/src/lib/features/renter/RenterNav.svelte
    - apps/web/src/lib/features/renter/RenterNav.test.ts
    - apps/web/src/routes/(app)/renter/+layout.svelte
    - apps/web/src/routes/(app)/renter/listing/+page.svelte
    - apps/web/src/routes/(app)/renter/shortlist/+page.svelte
    - apps/web/src/routes/(app)/renter/affordability/+page.svelte
  modified:
    - apps/web/src/routes/(app)/renter/+page.svelte
    - apps/web/svelte.config.js
    - scripts/assert-csp.mjs
    - scripts/assert-csp.test.ts
    - apps/web/tests/e2e/routes.ts
    - apps/web/tests/e2e/routing.spec.ts
    - apps/web/tests/e2e/layout.spec.ts
    - apps/web/src/lib/components/layout/PortalSwitcher.svelte
key-decisions:
  - "img-src is a fresh directive (no earlier phase had added one): exactly 'self' + https://tile.openstreetmap.org, pinned as an EXACT set in the oracle; Phase 8 must append blob: to both files, never replace"
  - "PortalSwitcher marks a portal as the current section with aria-current=\"true\" on its sub-pages ('page' stays exact-match only)"
  - "Each renter route carries its own meta description (marketing.spec requires a unique non-empty description on every chrome route)"
requirements-advanced: [RENT-02, RENT-03, RENT-05, RENT-08]
metrics:
  duration: ~35 min
  completed: 2026-10-05
  tasks: 2
  files: 14
---

# Phase 6 Plan 04: Renter route shells, sub-nav and OSM img-src Summary

The renter portal now has four prerendered routes (Search, listing detail shell, Shortlist, Affordability) under a `Renter tools` sub-nav. The OSM tile host is allowed in `img-src` in both CSP files and pinned by the oracle with mutation tests. Every renter route goes through the routing, CSP, axe, layout and drift specs on both bases.

## What was built

- **Task 1 (6d847cb):** `RenterNav` (3 links via `resolve()`, `aria-current="page"` from `page.route.id`, `/renter/listing` counts as Search, an optional `shortlistCount` badge that reads "Shortlist 3 listings"), the renter `+layout.svelte`, and four route shells with the UI-SPEC titles, h1s and leads. The listing shell shows "Loading listing…" in Label style. The `PortalPlaceholder` renter page is gone. 9 SSR tests.
- **Task 2 (068d01f):** `'img-src': ['self', 'https://tile.openstreetmap.org']` in `kit.csp.directives` and `EXACT['img-src']` in `assert-csp.mjs` in one commit. Golden policy updated. Fault 10 rejects a missing directive, `data:`, `blob:`, a bare `https:`, a missing OSM host, a missing `'self'` and an `a.` subdomain. Fault 10b covers order independence and pins both tokens. `EXPECTED_PAGES` gains the three new pages, with a test. `prerender.entries` adds `/renter/listing/`. `routes.ts` gains `RENTER_ROUTES`, the extended `APP_ROUTES` and three external hosts. The routing link check skips `tel:`/`mailto:`.

## Verification

- `svelte-check`: 0 errors. eslint and prettier are clean on all touched files. `banned` and `ui:guard` pass.
- `vitest --project web --project scripts`: 1456/1456 pass, including assert-csp 76/76 and RenterNav 9/9.
- `build:root` + `build:sub` + `csp:assert`: 17 pages per base pass (up from 14). The built `renter/listing/index.html` has `img-src 'self' https://tile.openstreetmap.org`.
- Full `test:e2e`: **620 passed**, root and sub.
- `grep "data:" apps/web/svelte.config.js` returns 0. Neither `svelte.config.js` nor `app.html` contains a `referrer` setting.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] layout.spec "prerendered HTML marks the current portal" broke on renter sub-routes**
- **Found during:** Task 2
- **Issue:** The test iterates `APP_ROUTES` and expects a Portals link whose href ends in the route itself to carry `aria-current="page"`. No header link points at `renter/listing/` and the other new pages, so the test would have failed.
- **Fix:** `PortalSwitcher.current()` now returns `'page'` on the exact route and `'true'` on the portal's descendants. The 12 `aria-[current=page]:` style variants became `aria-[current]:`, so both values are styled. The test maps each route to its portal root and expects `'page'` on the root route and `'true'` on sub-routes. (This also uses `String.raw` for the RegExp source so `\b` is not a backspace.)
- **Files modified:** apps/web/src/lib/components/layout/PortalSwitcher.svelte, apps/web/tests/e2e/layout.spec.ts
- **Commit:** 068d01f

**2. [Rule 2 - Correctness] Unique meta descriptions on the new routes**
- `marketing.spec` requires a unique, non-empty description on every chrome route. The plan's shells did not list one, so each route has its own description, written to the honesty rules. The affordability description says "A general guideline, not financial advice."

**3. Minor:** the listing shell uses `text-label` (Label 14/400 token) instead of the plan's `text-sm`, to stay on Phase 2 tokens. The `features/renter/.gitkeep` placeholder was removed now that the directory has files.

## Requirement progress

This plan advances RENT-02, RENT-03, RENT-05 and RENT-08: the route shells for search/detail, shortlist and affordability, plus the map CSP. Those requirements stay open until the 06-22 gate, so `requirements mark-complete` was not run.

## Known Stubs

These are intentional shells. Later plans fill them:
- `apps/web/src/routes/(app)/renter/listing/+page.svelte`: "Loading listing…" placeholder → 06-14 (resolved and not-found states).
- `/renter/`, `/renter/shortlist/` and `/renter/affordability/` show only the h1 and lead → the search, shortlist and affordability plans of this phase.
- `RenterNav` `shortlistCount` is always `null` → wired by 06-15.

## Notes for later plans

- The service-worker exclusion for `tile.openstreetmap.org` (UI-SPEC Planner Note 2) is not part of this plan. It belongs to the 06-05 guard and the 06-19 map work.
- Phase 8's `blob:` must be appended to both `img-src` lists, and Fault 10's `blob:` case updated in the same commit.

## Self-Check: PASSED
- All 6 created files exist on disk.
- Commits 6d847cb and 068d01f are in `git log`.
