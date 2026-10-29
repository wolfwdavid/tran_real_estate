---
phase: 12-go-live-readiness-local-smoke-suite
plan: 08
subsystem: testing
tags: [smoke, playwright, csp, seo, axe, live-08, build-stamp]
requires:
  - phase: 12-03
    provides: build stamp (_app/version.json = commit SHA)
  - phase: 12-05
    provides: app.html Search Console slot (first web-build csp:assert here)
  - phase: 12-06
    provides: smoke fixtures (test/expect/smoke), playwright.smoke.config.ts, scripts/smoke.mjs
  - phase: 12-07
    provides: configured target on https://tran-configured.example
provides:
  - six content-contract smoke specs (routing, version, extension-link, csp, seo, a11y)
  - first green end-to-end `smoke.mjs --local` over root, sub and configured
affects: [12-09 (adds analytics/GPC specs + import guard), 12-10 (smoke:local in verify)]
tech-stack:
  added: []
  patterns:
    - "Smoke specs re-point existing oracles at a URL: checkHtml from scripts/assert-csp.mjs, route lists from tests/e2e/routes.ts"
    - "Site URL always from smoke.siteUrl; absolute share URLs mapped onto smoke.baseUrl by stripping the site base path"
key-files:
  created:
    - apps/web/tests/smoke/routing.smoke.ts
    - apps/web/tests/smoke/version.smoke.ts
    - apps/web/tests/smoke/extension-link.smoke.ts
    - apps/web/tests/smoke/csp.smoke.ts
    - apps/web/tests/smoke/seo.smoke.ts
    - apps/web/tests/smoke/a11y.smoke.ts
  modified: []
key-decisions:
  - "CSP smoke runs one test per route (45 incl. the 404 body) for parallelism and named failures"
  - "Share-tag test also requires at least one absolute og/twitter URL, so the starts-with-site check cannot pass vacuously"
requirements-completed: [SMOKE-02, SMOKE-03, SMOKE-06]
duration: 13min
completed: 2026-10-29
---

# Phase 12 Plan 08: Content-Contract Smoke Specs Summary

**Six read-only smoke specs (routing, build stamp, privacy anchor, CSP via the shared checkHtml oracle, sitemap/robots/manifest/share tags on the build's own site URL, axe WCAG 2.2 AA) run green through `scripts/smoke.mjs --local` on root, sub and configured: 72 tests per target, 18.7 s total.**

## Performance

- **Duration:** about 13 min (16:05 to 16:18 local)
- **Tasks:** 3
- **Files:** 6 created

## Timing (final full run, `node scripts/smoke.mjs --local`, HEAD b3be3d1, builds stamped b3be3d1)

| Target | Base | Site URL | Tests | Result | Seconds |
| --- | --- | --- | --- | --- | --- |
| root | http://127.0.0.1:4273/ | https://tranrealestate.github.io/ | 72 | pass | 6.2 |
| sub | http://127.0.0.1:4274/tran_real_estate/ | https://tranrealestate.github.io/tran_real_estate/ | 72 | pass | 6.3 |
| configured | http://127.0.0.1:4276/ | https://tran-configured.example/ | 72 | pass | 6.3 |
| **total** | | | 216 | exit 0 | **18.7** (budget 300) |

Per spec, per target: routing 4, version 1, extension-link 1, csp 45 (44 routes + 404), seo 18 (sitemap, robots, manifest, 14 share-tag pages, og:image), a11y 3.

## Accomplishments

- `routing.smoke.ts`: landing 200 + brand title; `renter` answers 301 with `maxRedirects: 0` and the Location (relative on serve-pages) resolves to `renter/`; `investor/deals/` 200 before and after reload; `does-not-exist/deeper/` answers 404 with an h1 containing 404.
- `version.smoke.ts`: cache-busted `_app/version.json` equals `smoke.expectVersion` (no polling in the suite).
- `extension-link.smoke.ts`: `legal/privacy/` has exactly one `#browser-extension`.
- `csp.smoke.ts`: imports `checkHtml` from `scripts/assert-csp.mjs` (already typed in `assert-csp.d.mts`); never reads a CSP header.
- `seo.smoke.ts`: sitemap has exactly the 14 MARKETING + LEGAL URLs on `smoke.siteUrl`; robots carries `Sitemap: <site>sitemap.xml`; manifest is `application/manifest+json`; every indexable page has one og:image, canonical = site + route, og:url = canonical, every absolute og/twitter URL on the site URL; landing og:image answers image/png. The configured leg is the HTTP-level LIVE-08 proof (served from 127.0.0.1:4276, URLs on tran-configured.example).
- `a11y.smoke.ts`: axe with the five WCAG tags on `/`, `renter/`, `legal/privacy/`; violations [] and passes > 0.

## Task Commits

1. **Task 1: routing, build stamp and privacy anchor** - `e14d6e6` (test)
2. **Task 2: CSP and SEO contracts via the shared oracles** - `4e32cd5` (test)
3. **Task 3: axe on landing, portal and privacy** - `b3be3d1` (test)

## Verification

- Task 1: `smoke.mjs --local -- routing version extension-link` exit 0 on all three (7.8 s) at f25d90b.
- Stamp guard end to end: right after the Task 1 commit, `smoke.mjs --local --target root` exited 2 with `apps/web/build is missing or stale (stamp f25d90b..., HEAD e14d6e6...); rebuild: pnpm build:root`.
- Task 2: `smoke.mjs --local -- csp seo` exit 0, 63 per target (13.0 s) at e14d6e6; `corepack pnpm csp:assert` exit 0 (45 pages each; configured analytics host http://127.0.0.1:4275).
- Mutation check: forcing `analyticsHost: ''` in csp.smoke.ts made the configured leg fail with `connect-src ... expected [...]` (exit 1); restored before commit.
- Task 3: a11y alone exit 0 (9.8 s); full suite exit 0 at 4e32cd5 (18.9 s), then rebuilt and re-ran at b3be3d1 (18.7 s, table above).
- `corepack pnpm check`: web 3251 files 0 errors, extension 0 errors. `corepack pnpm lint`: exit 0. `corepack pnpm test:unit`: 348 files, 6774 tests passed.
- Acceptance greps: `maxRedirects: 0` 1; `from './fixtures'` 1 per file; interaction calls 0 in every spec; `assert-csp.mjs` in csp.smoke.ts 1; `content-security-policy` 0; `tranrealestate.github.io` in seo.smoke.ts 0; `AxeBuilder` 2; `wcag22aa` 1; `passes.length` 1.
- `.tools/build.lock` released. No commit message mentions an assistant; no trailer.

## Deviations from Plan

None in behaviour. One process note: the Task 2 header comment originally named `scripts/assert-csp.mjs` a second time, which broke the "exactly 1" acceptance grep; the comment was reworded and the commit amended while it was still HEAD (final hash 4e32cd5).

## Known Stubs

None.

## Build-dir state for 12-09

All three build dirs (`apps/web/build`, `build-sub`, `build-configured`) are stamped `b3be3d1` (the Task 3 commit). The docs commit for this SUMMARY moves HEAD, so they are stale for 12-09 by design: rebuild all three before `smoke:local`.

## Self-Check: PASSED

- All six spec files present; commits e14d6e6, 4e32cd5, b3be3d1 present.
