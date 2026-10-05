---
phase: 02-brand-system-marketing-legal-pages
plan: 04
subsystem: web-layout
tags: [site-chrome, landmarks, portal-switcher, disclosure, footer, legal-routes, aria-current, 404]
requires:
  - "02-02: banned-terms gate"
  - "02-03: Tailwind @theme utilities, fonts, @lucide/svelte, BUILD_YEAR"
provides:
  - "SiteHeader + PortalSwitcher (Portals nav, inline at 640px+, Menu disclosure below)"
  - "SiteFooter (disclaimer, Footer nav with Portals/Learn/Legal, EHO line, copyright)"
  - "ButtonLink primary/secondary CTA anchor; SkipLink to #main-content"
  - "Group layouts own main#main-content; one banner/Portals nav/main/contentinfo per page; print chrome-free"
  - "Branded +error page with header and footer"
  - "Prerendered stubs for /for-renters/, /for-investors/, /for-agents/, /legal/{privacy,terms,fair-housing,data-coverage}/"
  - "assert-csp EXPECTED_PAGES = 14; routing spec same-origin filter for external links"
affects: [02-05 shared routes module + layout E2E, 02-06 home page, 02-07/02-08 audience and legal content, every app page (chrome)]
tech-stack:
  added: []
  patterns:
    - "aria-current from page.route.id (prerender-safe under any base)"
    - "writable $derived.by over MediaQuery to auto-close the disclosure on breakpoint change"
    - "link arrays use `satisfies T[]` (not `: T[]`) so svelte/no-navigation-without-resolve can trace resolve()"
key-files:
  created:
    - apps/web/src/lib/components/ui/ButtonLink.svelte
    - apps/web/src/lib/components/layout/SkipLink.svelte
    - apps/web/src/lib/components/layout/PortalSwitcher.svelte
    - apps/web/src/lib/components/layout/SiteHeader.svelte
    - apps/web/src/lib/components/layout/SiteFooter.svelte
    - apps/web/src/routes/(marketing)/+layout.svelte
    - apps/web/src/routes/(marketing)/for-renters/+page.svelte
    - apps/web/src/routes/(marketing)/for-investors/+page.svelte
    - apps/web/src/routes/(marketing)/for-agents/+page.svelte
    - apps/web/src/routes/(marketing)/legal/privacy/+page.svelte
    - apps/web/src/routes/(marketing)/legal/terms/+page.svelte
    - apps/web/src/routes/(marketing)/legal/fair-housing/+page.svelte
    - apps/web/src/routes/(marketing)/legal/data-coverage/+page.svelte
  modified:
    - apps/web/src/routes/+layout.svelte
    - apps/web/src/routes/(app)/+layout.svelte
    - apps/web/src/routes/(print)/+layout.svelte
    - apps/web/src/routes/+error.svelte
    - apps/web/tests/e2e/routing.spec.ts
    - scripts/assert-csp.mjs
decisions:
  - "Portals <nav> wraps the whole header row (wordmark, inline list, Menu button, #portal-menu panel) so the full-width mobile panel stays in one navigation landmark at every width (deviation from UI-SPEC component split, per RESEARCH Open Question 3)"
  - "ButtonLink uses an eslint-disable/enable block (not disable-next-line) because the rule reports on the {href} attribute line, not the <a line"
  - "Footer link arrays use `satisfies FooterLink[]`; a `: FooterLink[]` annotation stops the resolve() trace and the lint rule fires"
  - "Stub pages keep the description in a script const so the meta tag stays one line after Prettier"
metrics:
  duration: 7min
  completed: 2026-10-05
  tasks: 3
  files: 19
---

# Phase 2 Plan 04: Site Chrome, Portal Switcher, Footer and Route Stubs Summary

Every marketing, legal, app and 404 page now shares one header with the "Tran Real Estate Tools" wordmark and a Portals switcher, and one footer with the disclaimer, legal links, the Equal Housing Opportunity line and the copyright. The current portal carries `aria-current="page"` in the prerendered HTML. Below 640px the links collapse into a Menu disclosure that closes on Escape (focus returns to the button), on navigation and on a breakpoint change. All 7 routes the footer links exist as prerendered stubs, so the build passes with `handleUnseenRoutes: 'fail'` and `handleHttpError: 'fail'`.

## What Was Built

- **Task 1 (3d93a31):** `ButtonLink` (anchor-only CTA, `min-h-12`, primary/secondary, optional arrow), `SkipLink`, `PortalSwitcher` (RESEARCH Pattern 4 logic: `MediaQuery` + writable `$derived.by`, `afterNavigate` close, window Escape handler, `data-hydrated` hook for E2E, panel always rendered and toggled with `hidden`), and `SiteHeader` (not sticky, `showSettings` adds a divider and a Settings link).
- **Task 2 (d372daa):** `SiteFooter` with a "Footer" nav landmark in a real two-column grid (no `display: contents`). Its link arrays all use `resolve()` with trailing slashes and get `aria-current` from the route id. Added 7 stub routes with final titles, h1s and meta descriptions. `EXPECTED_PAGES` now has 14 entries.
- **Task 3 (89f9962):** The root layout renders only SkipLink + children. The `(marketing)` layout is new, and `(app)` uses `SiteHeader showSettings={true}`. Each of these owns `main#main-content tabindex="-1"` and the footer. `(print)` has only the main. The branded `+error.svelte` has a header, a status h1 ("404: Page not found"), body copy, a "Go to the home page" CTA and the footer. The routing spec's "every in-page link" test now requires cross-origin links to be `https:` with no `target`, then skips the base-path checks.

## Verification

- `corepack pnpm check`: 0 errors, 0 warnings. `lint`: exit 0. `banned`: passed (24 files). `test:unit`: 13 files, 200 tests pass.
- `build:root` and `build:sub` both succeed. `csp:assert`: 14 pages pass in each build.
- `test:e2e`: 30/30 pass (routing, CSP, framing and axe on both bases).
- Acceptance greps:
  - `build/renter/index.html` has 3 `aria-current="page"` (inline, panel, footer).
  - `build-sub/legal/privacy/index.html` has 1.
  - `build/print/index.html` has 0 Portals navs; `build/for-agents/index.html` has 1.
  - `<main` count in the root layout is 0.
  - No `page.url.pathname` anywhere.
  - No barrel `@lucide/svelte` import.
  - No raw hex in components.
- Ad-hoc Playwright check at 375px on both bases. It was not committed: 02-05 owns `layout.spec.ts`.
  - Landmark counts are one banner, one Portals nav, one main and one contentinfo on `/`, `/renter/`, `/legal/privacy/`, `/for-agents/` and an unknown path (404). `/print/` has 0 banner, 0 nav, 1 main and 0 contentinfo.
  - `scrollWidth` stays within 375 on all of them.
  - Disclosure: `aria-expanded` toggles. The panel's current row is Renter. Escape closes the panel and focuses Menu. A link click navigates and closes the panel. Resizing to 640 hides the open panel, and back at 639 the button shows `aria-expanded="false"`.

## Deviations from Plan

### Recorded design deviations (planned)

1. **The Portals nav wraps the whole header row.** The UI-SPEC split the wordmark from the nav. Here the `<nav aria-label="Portals">` contains the wordmark, the inline list, the Menu button and the `#portal-menu` panel. This keeps the full-width mobile panel inside a single navigation landmark at every width (RESEARCH Pattern 4 / Open Question 3).
2. **Token renames (from 02-03, used here).** `--container-prose` became `--container-reading` (`max-w-reading`) to avoid a clash with Tailwind's built-in `prose` container. The `--duration-*` tokens were dropped in favour of the built-in `duration-150` utility, which ButtonLink uses.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] eslint `svelte/no-navigation-without-resolve` on ButtonLink**
- **Found during:** Task 1
- **Issue:** The plan's `eslint-disable-next-line` sat above `<a`, but the rule reports on the `{href}` attribute line, so lint failed.
- **Fix:** Replaced it with a targeted `eslint-disable … -- reason` / `eslint-enable` pair around the single anchor.
- **Commit:** 3d93a31

**2. [Rule 3 - Blocking] The same lint rule on footer links**
- **Found during:** Task 2
- **Issue:** The rule could not trace `resolve()` through a snippet parameter or through a `: FooterLink[]` type annotation.
- **Fix:** Inlined the three `{#each}` groups and typed the arrays with `satisfies FooterLink[]`. A source comment records why.
- **Commit:** d372daa

**3. [Rule 3 - Blocking] Stub meta tags vs the acceptance grep**
- **Found during:** Task 2
- **Issue:** Prettier wrapped the long `<meta name="description" content="…">` tags, so `grep '<meta name="description"'` found nothing.
- **Fix:** Moved each description into a `const description` in the script block and used `<meta name="description" content={description} />`. The rendered output is the same.
- **Commit:** d372daa

## Known Stubs

These are intentional and part of the plan. Each page has its final `<title>`, `<h1>` and meta description but no body content yet:

- `apps/web/src/routes/(marketing)/for-{renters,investors,agents}/+page.svelte`: plan 02-07 adds the audience-page bodies.
- `apps/web/src/routes/(marketing)/legal/{privacy,terms,fair-housing,data-coverage}/+page.svelte`: plan 02-08 adds the legal-page bodies.

## Self-Check: PASSED
