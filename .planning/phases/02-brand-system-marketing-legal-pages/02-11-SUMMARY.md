---
phase: 02-brand-system-marketing-legal-pages
plan: 11
subsystem: web-e2e
tags: [e2e, playwright, axe, content-contracts, banned-terms, BRND-01, BRND-02, BRND-03, BRND-04]
requires:
  - "02-02: scripts/lib/banned-terms-rules.mjs findBanned"
  - "02-05: routes.ts (ROUTES, CHROME_ROUTES, NOT_FOUND) and per-route axe spec"
  - "02-06/07/08/09: landing, audience, legal and portal placeholder copy"
provides:
  - "marketing.spec.ts: landing, audience and legal content contracts, rendered banned-terms scan of every route, unique meta descriptions"
  - "a11y.spec.ts: axe at 1280px and 375px on every route, on the 404 page, and with the portal menu open"
affects: [CI e2e matrix (root + sub), later phases that change marketing/legal copy]
tech-stack:
  added: []
  patterns:
    - "Prerendered hrefs are base-relative: resolve against page.url() before asserting the pathname"
    - "Rendered-copy compliance: findBanned over title + meta description + body innerText per route"
    - "expectNoViolations(page, label) helper: rules-ran guard, zero violations, color-contrast incompletes logged"
key-files:
  created:
    - apps/web/tests/e2e/marketing.spec.ts
  modified:
    - apps/web/tests/e2e/a11y.spec.ts
key-decisions:
  - "findBanned is imported statically (typed through checkJs/JSDoc) instead of the plan's dynamic import; svelte-check stays clean"
  - "Meta description lookup returns '' when absent (print surface has none) instead of waiting for the locator"
requirements-completed: [BRND-01, BRND-02, BRND-03, BRND-04]
metrics:
  duration: ~8 min
  completed: 2026-10-04
  tasks: 2
  files: 2
---

# Phase 2 Plan 11: Marketing Content Contracts and Extended axe Summary

**Playwright now checks the landing, audience and legal copy on the built site under both base paths, runs the banned-terms rules over the rendered text of all 13 routes, and runs axe at 375px, on the 404 page and with the mobile menu open (29 axe tests per project).**

## What was built

- **marketing.spec.ts** (27 tests per project)
  - Landing: checks the h1 text, that the hero CTAs point to `#portals` and `#how-it-works` and both targets exist, the "Three steps, no account" heading and the three trust h3s. Each "Explore … tools" card link must resolve to the right `for-*/` path, return 200, and render the audience h1.
  - Each audience page: checks the h1, that both "Open {portal} portal" and "Try sample data" resolve to `/{portal}/`, the "Good to know" h2 and that its list has exactly 3 items.
  - Legal pages: the terms sentence appears word for word, the four data-coverage strings are present, the HUD link has no `target`, privacy says "no server that stores your data", and all four pages show "Last updated: 4 October 2026".
  - `findBanned` runs over the title, meta description and body innerText of all 13 routes. A control test confirms it catches "Our guaranteed returns".
  - Each of the 12 routes with site header and footer (every route except print) has a non-empty meta description, and no two are the same.
- **a11y.spec.ts** (29 tests per project): 13 routes at 1280px, the same 13 at 375×812, the 404 page, and the portal menu open at 375px on `''` and `renter/`. Before clicking the toggle, the menu test waits for the `nav[data-hydrated]` attribute.

## Verification

- `corepack pnpm check`: 0 errors. `prettier --check` and `eslint` on both specs: clean.
- `playwright test marketing`: 54/54 passed (root + sub).
- `playwright test a11y`: 58/58 passed (root + sub). Only the landing hero logs color-contrast incompletes (8 at 1280px, 5 at 375px), which is expected per Pitfall 12.
- Full `corepack pnpm test:e2e`: 306/306 passed. All runs used the existing Wave 4 builds while holding `.tools/build.lock`; this plan changed no source files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Meta-description helper timed out on the print route**
- **Found during:** Task 1
- **Issue:** `locator.getAttribute` waits for the element. The print surface has no meta description, so the banned-terms test for `print/` timed out.
- **Fix:** The helper now counts first and returns `''` if no meta description exists.
- **Files modified:** apps/web/tests/e2e/marketing.spec.ts
- **Commit:** 3bc526a

**2. [Minor] Static import of findBanned instead of the planned dynamic import:** the import is typed through checkJs, svelte-check passes, and Playwright loads the `.mjs` without problems.

## Known Stubs

None. This plan only adds tests.

## Commits

- 3bc526a test(02-11): landing, audience and legal content contracts
- d3e9c30 test(02-11): axe at 375px, on the 404 page and with the menu open

## Self-Check: PASSED
