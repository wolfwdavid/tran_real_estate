---
phase: 07-investor-portal
plan: 03
subsystem: investor-routes
tags: [routing, prerender, sub-nav, banned-terms, e2e-harness]
requires:
  - 06-04 route-shell pattern (prerendered, ?id= read in onMount, prerender.entries)
  - 06-05 path-scoped banned-terms lists
  - 06-09 no-network E2E harness (support/network, support/rentcast-mocks)
  - 05-15 AI E2E mocks (helpers/ai-mocks)
provides:
  - PortalSubNav + nav.ts (SubNavItem, currentItemIndex, routeIdToPath) in features/shared/nav
  - INVESTOR_NAV, NotFoundPanel
  - 8 investor route stubs + /print/memo/ stub
  - INVESTOR_ROUTES, PRINT_ROUTES, isPrintRoute, PORTAL_ROUTES in tests/e2e/routes.ts
  - INVESTOR_SCOPES / INVESTOR_BANNED copy gate
  - tests/e2e/investor/{helpers,rentcast-mocks}.ts for every later investor spec
affects: [07-05..07-21 investor plans, Phase 8 agent portal sub-nav, Phase 9 print/markets]
tech-stack:
  added: []
  patterns:
    - "SubNavItem.href is a BASE-LESS pathname; PortalSubNav resolves it at render time and derives the current item from page.route.id (resolve()/base are relative while prerendering, so a module-level resolve() list or a pathname-vs-base compare would be wrong in static HTML)"
    - "Investor specs: import { test, expect, mockRentCast, ... } from './helpers' + test.use(INVESTOR_TEST_OPTIONS); mockRentCast(page, net, opts) layers investor answers over the 06-09 fixture mock with route.fallback()"
    - "Path-scoped banned lists generalised: SCOPED_LISTS [{ scopes, list }] (renter + investor)"
key-files:
  created:
    - apps/web/src/lib/features/shared/nav/PortalSubNav.svelte
    - apps/web/src/lib/features/shared/nav/nav.ts
    - apps/web/src/lib/features/shared/nav/nav.test.ts
    - apps/web/src/lib/features/investor/nav.ts
    - apps/web/src/lib/features/shared/NotFoundPanel.svelte
    - apps/web/src/routes/(app)/investor/{analyze,deals,compare,memo,buy-boxes,markets,market}/+page.svelte
    - apps/web/src/routes/(print)/print/memo/+page.svelte
    - apps/web/tests/e2e/investor/helpers.ts
    - apps/web/tests/e2e/investor/rentcast-mocks.ts
    - apps/web/tests/e2e/investor/routes.spec.ts
  modified:
    - apps/web/src/routes/(app)/investor/+page.svelte
    - apps/web/svelte.config.js (prerender.entries only)
    - apps/web/tests/e2e/routes.ts
    - apps/web/tests/e2e/routing.spec.ts
    - apps/web/tests/e2e/layout.spec.ts
    - scripts/assert-csp.mjs
    - scripts/assert-csp.test.ts
    - scripts/lib/banned-terms-rules.mjs
    - scripts/banned-terms.test.ts
key-decisions:
  - "SubNavItem.href holds a base-less pathname resolved inside PortalSubNav; the current item comes from page.route.id (06-04 RenterNav precedent), so aria-current is in the prerendered HTML on both bases. RenterNav left unchanged (its 9 tests stay green); Phase 8 should use PortalSubNav"
  - "Investor banned phrases are a SCOPED list (INVESTOR_SCOPES: investor routes, print/memo route, features/investor, shared/markets, shared/print, shared/nav), not global, following 06-05"
  - "MOCK_ZIP = '74201', MOCK_CITY = 'Harlow Springs, OK' (the Phase 4 fixture metro); '79999'/'TX' would be outside sample coverage. Later specs must import the constants"
  - "Mock keys default to support/fake-keys fakeKey('rentcast'|'anthropic') (gitleaks-safe, shape-valid) instead of the plan's literal strings"
requirements-advanced: [INV-01, INV-02, INV-03, INV-04, INV-05, INV-06]
metrics:
  duration: ~45 min
  completed: 2026-10-05
  tasks: 3
  files: 26
---

# Phase 7 Plan 03: Investor route stubs, shared sub-nav, registries and E2E helpers Summary

All nine Phase 7 routes exist as prerendered stubs on both bases, each with its UI-SPEC h1 and title. They carry a shared `PortalSubNav` ("Investor", 5 links; compare and memo mark Deals, market marks Markets). The routes are registered in every registry. Investor copy is under a scoped no-advice banned-terms list. Later investor specs import one helper module built on the 06-09 harness.

## Task Commits

1. **Task 1 (TDD):** `e5d0c67` test (RED), `c2dc320` feat (GREEN). PortalSubNav, nav.ts, INVESTOR_NAV, NotFoundPanel, 8 investor stubs + print/memo stub. `895546d` chore: reworded a comment so `grep page.url.searchParams` is empty.
2. **Task 2:** `5b468fa`. routes.ts (`INVESTOR_ROUTES`, `PRINT_ROUTES`, `isPrintRoute`; `CHROME_ROUTES` excludes every print route), routing/layout specs use `isPrintRoute`, `EXPECTED_PAGES` +8, `prerender.entries` + `/investor/compare/`, `/investor/memo/`, `/investor/market/`, `/print/memo/`, and investor banned terms with tests.
3. **Fix:** `cc04d69`. `PORTAL_ROUTES` (APP_ROUTES + INVESTOR_ROUTES) for the layout Settings-link and portal-marking checks.
4. **Task 3:** `29d28ef`. Investor helpers, mock bodies and `routes.spec.ts`.

## Verification

- `vitest --project web nav`: 33/33. Full `test:unit`: 3515/3515 (173 files). svelte-check: 0 errors. ESLint and Prettier are clean on all touched files. `banned` passes (190 files), and so do `ui:guard`, `guard` (1087 files) and `secrets:canary`.
- `grep -c "index.html'" scripts/assert-csp.mjs`: **16 before, 24 after** (+8).
- `build:root` + `build:sub` + `csp:assert`: **25 pages per base** (17 before, +8).
- Playwright `investor/routes routing csp a11y layout routes-drift marketing`: 600 passed and 14 failed on the first run. All 14 failures were the layout Settings-link check, fixed in cc04d69. After the fix, `layout routes-drift` passed 302/302. investor/routes.spec ran 24 tests × root + sub, all passing.
- Banned-terms mutation: dropping the investor entry from `SCOPED_LISTS` fails 11 tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's `INVESTOR_NAV` built with `resolve()` and the `pathname`-minus-`base` current check would break in prerendered HTML**
- `paths.relative` is the default, so `resolve()` and `base` are relative while prerendering (the 06-04/04-22 finding). A module-level resolved list would capture one page's relative prefix.
- **Fix:** `SubNavItem.href` is base-less and is resolved inside PortalSubNav. The current item comes from `routeIdToPath(page.route.id)`, and an optional `currentPath` prop overrides it. `currentItemIndex(items, pathname, base)` keeps the planned contract and covers the planned behaviour cases (including base `/tran_real_estate`). Pages do not pass `page.url.pathname`.

**2. [Rule 1 - Bug] The layout spec's Settings-link and portal-marking checks keyed on `APP_ROUTES`**
- The investor sub-pages render Settings, so 14 tests failed. Added `PORTAL_ROUTES` and used it in both places. This also proves that the header marks Investor with `aria-current="true"` on every sub-page. Commit cc04d69.

**3. [Rule 3 - Harness reuse] Helper signatures follow the 06-09 harness**
- `mockRentCast(page, net, opts)` takes the `net` fixture (it does not fork the harness). It returns `{ count(path?), urls }`.
- `MOCK_ZIP`/`MOCK_CITY` are the fixture metro's values, not 79999/TX.
- Mock bodies are derived at runtime from the fixtures, and the spec checks them with `parsePayload`.
- The default keys come from `fakeKey()`.
- Extras: `INVESTOR_TEST_OPTIONS`, `printCount`, `rentEstimateFor`, `withComparables`, and `GAP_MONTH_OFFSET`/`THIN_MONTH_OFFSET`/`THIN_LISTINGS`.

**4. Additive:**
- `scripts/assert-csp.test.ts` pins the 8 new pages and the uniqueness of `EXPECTED_PAGES`.
- Each route has a unique meta description (marketing.spec rule, 06-04).
- The `/investor/` overview shows the UI-SPEC disclaimer line.
- `nav.test.ts` also holds the PortalSubNav SSR structure tests.

## Requirement progress

This plan advances INV-01 through INV-06 (the route shells, navigation and test infrastructure). They stay open until the 07-21 gate, so `requirements mark-complete` was not run.

## Known Stubs

These shells are intentional. Later Phase 7 plans fill them.
- Every investor route shows "Loading your investor data…" in place of its live content: the analyzer, deals, compare, memo, buy-box and markets plans.
- `/investor/market/` sets the h1 and title from `?zip=`. The dashboard comes in 07-13.
- `/print/memo/` shows "Preparing your printout…" and a Back to memo link. PrintReport comes in a later plan.
- `NotFoundPanel` is created but not used yet. The ?id/?ids/?zip not-found states in later plans will use it.

## Self-Check: PASSED
- All created files exist on disk.
- Commits e5d0c67, c2dc320, 895546d, 5b468fa, cc04d69 and 29d28ef are in `git log`.
