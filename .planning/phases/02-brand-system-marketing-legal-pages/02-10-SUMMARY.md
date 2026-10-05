---
phase: 02-brand-system-marketing-legal-pages
plan: 10
subsystem: e2e-testing
tags: [playwright, layout, landmarks, aria-current, responsive, wcag-1.4.12, disclosure, csp]
requires:
  - "02-04: PortalSwitcher (nav[data-hydrated], #portal-menu disclosure, route-id aria-current) and SiteFooter"
  - "02-05: tests/e2e/routes.ts (ROUTES, CHROME_ROUTES, APP_ROUTES, PRINT, NOT_FOUND)"
  - "02-06..02-09: all 13 pages built"
provides:
  - "apps/web/tests/e2e/layout.spec.ts: 86 tests per project (172 total) proving the shared chrome on both bases"
affects: [any future page (inherits landmark, 375px, text-spacing and footer-legal checks via routes.ts), PortalSwitcher/SiteFooter changes]
tech-stack:
  added: []
  patterns:
    - "Raw prerendered HTML assertions scoped to one landmark via regex slice (Portals nav / footer)"
    - "Text-spacing overrides through constructed adoptedStyleSheets (CSP-safe), with an applied-check before the overflow check"
    - "bypassCSP only in the non-vacuity describe for the same-origin request filter"
key-files:
  created:
    - apps/web/tests/e2e/layout.spec.ts
  modified: []
decisions:
  - "The raw aria-current check is scoped to the Portals nav for app routes and to the footer for legal/privacy: unscoped, the footer's own portal links masked a broken header switcher on renter/investor/agent (mutation caught only on settings/)"
  - "Text-spacing tests first assert the override is in force (h1 word-spacing != 0px, body letter-spacing != normal) so the overflow check cannot pass vacuously"
  - "640px Settings check is two-sided: visible on APP_ROUTES, count 0 elsewhere"
metrics:
  duration: 14min
  completed: 2026-10-04
  tasks: 2
  files: 1
---

# Phase 2 Plan 10: Layout Chrome Proofs Summary

`layout.spec.ts` covers the shared header, footer and page shells on all 13 routes plus the 404, under both the root and `/tran_real_estate/` bases. It checks landmark structure, `aria-current` in the raw prerendered HTML, that the footer legal links return 200, that no request leaves the origin, that both self-hosted fonts load, that nothing scrolls sideways at 375px (menu open or closed, and with WCAG 1.4.12 text spacing), how the disclosure menu responds to mouse and keyboard, and the switch to inline links at 640px. Every check has a non-vacuity control.

## What was built

**Task 1 (62680cb):**
- Landmark counts on every route (banner, Portals nav, main, contentinfo, exactly one h1). Every route shows 1/1/1/1 except print, which shows 0/0/1/0.
- Raw-HTML `aria-current="page"` check on the 4 app routes and `legal/privacy/`. The control: the landing page has zero current anchors.
- On each of the 12 chrome routes, the four footer legal links each return 200, and the footer shows the EHO line and `© YYYY Tran Real Estate Tools`. The Portals Renter link resolves to `.../renter/`.
- Same-origin request collector across all 13 routes. The collector must capture more requests than there are routes. `Inter Variable` and `Fraunces Variable` load. A `bypassCSP` control plants an `Image` aimed at the attacker port and confirms the filter flags it.

**Task 2 (4332cb8):**
- At 375px:
  - No horizontal scroll on every route and the 404. On non-print routes the Menu button is visible and the inline list is hidden.
  - No horizontal scroll with the menu open on every chrome route.
  - With the text-spacing overrides applied, there is no overflow and the h1 stays visible.
  - A planted 1000px div confirms the overflow detector works.
- Disclosure at 375px on `renter/`:
  - Initial state is correct, and a click toggles the menu (Menu/Close label, `aria-expanded`, current portal marked in the panel).
  - Escape closes the menu and returns focus to the button. Enter opens it and Space closes it.
  - Choosing Investor navigates and closes the panel.
  - Resizing to 640 hides the button and panel and shows the inline list. Resizing back to 639 shows `aria-expanded="false"`, so the state was reset rather than just hidden by CSS.
- At 640px on every chrome route: the button is hidden, the inline Renter/Investor/Agent links are visible, and Settings appears only on app routes.

**Fix (45cd5c1):** scoped the raw `aria-current` assertion (see the deviation below).

## Mutation check (aria-current mechanism, Pitfall 1)

Mutant: `PortalSwitcher.svelte` `current` changed to compare `page.url.pathname === href` (and the call sites to pass `href`). Root rebuilt each time, then `playwright test layout --project=root -g "prerendered HTML"` run.

| Run | Assertion | Result |
|-----|-----------|--------|
| Mutant, first (unscoped assertion) | whole-page raw HTML | RED, but only at `settings/` (`raw HTML of settings/ marks it current: []`). renter/investor/agent passed because the footer's links also carry aria-current |
| Restored | | GREEN (1 passed) |
| Mutant, after the scoping fix | Portals nav only | RED at the first app route: `Portals nav in raw renter/: []` |
| Restored + rebuilt | | GREEN; full `layout` 172/172 on root + sub |

`git diff --exit-code apps/web/src/lib/components/layout/PortalSwitcher.svelte` exits 0 after the check.

## Verification

- `corepack pnpm check`: 0 errors, 0 warnings. ESLint and Prettier are clean on `layout.spec.ts`.
- `playwright test layout`: 172 passed (root + sub).
- Full `corepack pnpm test:e2e`: 306 passed. Afterwards, ports 4273-4275 were no longer listening.
- `grep -c addStyleTag apps/web/tests/e2e/layout.spec.ts` outputs 0.
- No layout source fixes were needed. Every route already passes at 375px with the menu open and with text spacing applied.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The raw aria-current check could not detect the header bug on 3 of 4 app routes**
- **Found during:** Task 2 mutation check
- **Issue:** The planned assertion searched every `aria-current` anchor in the page. SiteFooter also marks Renter/Investor/Agent as current using route ids, so a broken header switcher still passed on those routes. Only `settings/` (which has no footer link) caught the mutant.
- **Fix:** The assertion now slices the raw HTML to the `nav[aria-label="Portals"]` landmark for app routes, and to the `<footer>` for `legal/privacy/`. It also asserts that the slice is non-empty. The landing-page control stays page-wide.
- **Files modified:** apps/web/tests/e2e/layout.spec.ts
- **Commit:** 45cd5c1

**2. [Rule 2 - Non-vacuity] The text-spacing tests now confirm the override took effect**
- An `adoptedStyleSheets` assignment that silently did nothing would let the overflow check pass. The test therefore first asserts that h1 `word-spacing` is not `0px` and body `letter-spacing` is not `normal`. This shipped in Task 2 (4332cb8).

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: apps/web/tests/e2e/layout.spec.ts
- FOUND: 62680cb, 4332cb8, 45cd5c1
