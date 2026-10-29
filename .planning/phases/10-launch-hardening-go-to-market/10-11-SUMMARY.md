---
phase: 10-launch-hardening-go-to-market
plan: 11
subsystem: seo
tags: [seo, sitemap, open-graph, noindex, e2e]
requires:
  - phase: 10-10
    provides: SeoHead component, sitemap/robots/og endpoints
  - phase: 10-09
    provides: assert-seo oracle
provides:
  - SeoHead on landing, audience and legal pages (canonical, og:*, twitter card)
  - robots noindex on every (app), (print), (public) and error page
  - seo.spec.ts browser proof of head tags and SEO file serving
affects: [10-13, 10-14, 10-18, 10-22, 10-23]
tech-stack:
  added: []
  patterns: ["Route-group layouts own noindex; marketing pages own SeoHead"]
key-files:
  created:
    - apps/web/tests/e2e/seo.spec.ts
  modified:
    - apps/web/src/routes/(marketing)/+page.svelte
    - apps/web/src/lib/components/marketing/AudiencePage.svelte
    - apps/web/src/lib/components/legal/LegalPage.svelte
    - apps/web/src/routes/(app)/+layout.svelte
    - apps/web/src/routes/(print)/+layout.svelte
    - apps/web/src/routes/(public)/+layout.svelte
    - apps/web/src/routes/+error.svelte
key-decisions:
  - "(public) layout (agent inquiry page) also carries noindex: it is lead-facing, not marketing, and is outside the (marketing) sitemap glob, so without it assert-seo flagged it as indexable-but-unlisted"
  - "noindex lives on the route-group layouts, so every future (app)/(print)/(public) page inherits it with no per-page work"
requirements-completed: [GTM-03]
duration: ~35min
completed: 2026-10-13
---

# Phase 10 Plan 11: SEO head adoption and noindex Summary

**Landing, three audience pages and four legal pages now render SeoHead (absolute canonical, og:* with the default share card, summary_large_image), every non-marketing page is noindex, and a 22-test Playwright spec proves it on both base paths.**

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | SeoHead on marketing templates; noindex on app, print, public and error pages | 8eb7330 |
| 2 | E2E proof of head tags and SEO file serving (seo.spec.ts) | 4dcfd62 |

Titles and descriptions are unchanged (landing title verbatim, `audience.docTitle`/`description`, `docTitle`/`description`).

## Verification (real output)

- `pnpm check`: 0 errors, 0 warnings (2664 files). `pnpm lint`: exit 0. `pnpm banned`: passed (404 files).
- `build:root`, `build:sub`, `build:configured`: OK.
- `assert-seo apps/web/build --target root --min-urls 8`: "SEO assertion passed for 37 pages, 8 sitemap URLs, 1 share cards".
- `assert-seo apps/web/build-sub --target sub --min-urls 8`: "SEO assertion passed for 37 pages, 8 sitemap URLs, 1 share cards".
- `assert-seo apps/web/build --target root` (default min 14): exactly ONE remaining error: `sitemap.xml: 8 URLs, expected at least 14`. This is owned by the not-yet-built /tools/ and /feedback/ pages (10-13, 10-14, 10-18). All missing-SeoHead and missing-noindex error classes (previously 391 errors) are gone.
- noindex grep: `build/renter/index.html` 1, `build/agent/inquire/index.html` 1, `build/print/index.html` 1, `build/index.html` 0.
- `csp:assert`: passed for 38 pages on root, sub and configured.
- `playwright test seo --project=root --project=sub`: 22 passed (10.4s).
- Regression chunks: marketing + routing + routes-drift + layout (root+sub) 556 passed; csp + a11y + framing (root+sub) 310 passed; configured project 4 passed.
- Not run: the complete `pnpm test:e2e` suite (exceeds the 7-minute per-call watchdog; the orchestrator/10-23 runs it). Only specs touching head, routing, layout, CSP and a11y were run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] noindex on the (public) layout**
- **Found during:** Task 1
- **Issue:** The plan listed only (app), (print) and the error page, but the 10-10 handoff showed assert-seo also flagging (public) (agent/inquire/), which is not in the (marketing)-only sitemap and has no SeoHead.
- **Fix:** Added the same `<meta name="robots" content="noindex" />` head block to `(public)/+layout.svelte`.
- **Commit:** 8eb7330

Extra assertions in seo.spec.ts beyond the plan: meta description count 1, no robots meta on marketing pages, og:url equals canonical, and no canonical on app/print pages.

## Notes

- `build/404.html` (the SPA fallback shell) has no noindex. The oracle excludes 404.html from both lists by contract, and GitHub Pages serves it with HTTP 404, so crawlers don't index it.
- The local server's content types (application/xml, text/plain, image/png) come from scripts/serve-pages.mjs. On production, GitHub Pages sets them by file extension.

## Known Stubs

None.

## Self-Check: PASSED
- FOUND: apps/web/tests/e2e/seo.spec.ts
- FOUND: 8eb7330, 4dcfd62
