---
phase: 10-launch-hardening-go-to-market
plan: 10
subsystem: seo
tags: [content, sitemap, robots, og-image, seo-head, json-ld]
requires:
  - 10-01 (SITE_URL in lib/site.ts)
  - 10-03 (lib/content and lib/seo are marketing-safe)
  - 10-07 (serializeJsonLd, canonicalPath, renderOgCard)
  - 10-08 (FieldKind, calculator input/result keys in @tran/core/finance)
provides:
  - "lib/content/tools.ts: TOOLS, TOOLS_HUB, TOOL_SLUGS, SHARED_TOOL_COPY, DEFAULT_OG, DEFAULT_OG_ALT, types ToolSlug/OgCard/FaqItem/ToolField/ToolRow/ToolContent"
  - "lib/seo/SeoHead.svelte: { title, description, ogImage?, ogAlt?, jsonLd? }"
  - "lib/seo/sitemap.ts: sitemapPaths, sitemapXml, robotsTxt"
  - "prerendered /sitemap.xml, /robots.txt and /og/{default,tools,affordability,cap-rate,cash-on-cash,dscr}.png"
affects: [10-11 (tool pages + SeoHead adoption), 10-13, 10-22 (launch audit SEO section)]
tech-stack:
  added: []
  patterns:
    - Copy module is data only (one type-only import), so tool pages pay no JS for it beyond the strings they use
    - OgCard type defined once in content/tools.ts and re-exported by og-card.server.ts
    - Share-card endpoints wrap the resvg Buffer in a Uint8Array (Buffer is not a BodyInit under TS 6 DOM types)
key-files:
  created:
    - apps/web/src/lib/content/tools.ts
    - apps/web/src/lib/content/tools.test.ts
    - apps/web/src/lib/seo/SeoHead.svelte
    - apps/web/src/lib/seo/sitemap.ts
    - apps/web/src/lib/seo/sitemap.test.ts
    - apps/web/src/routes/sitemap.xml/+server.ts
    - apps/web/src/routes/robots.txt/+server.ts
    - apps/web/src/routes/og/{default,tools,affordability,cap-rate,cash-on-cash,dscr}.png/+server.ts
  modified:
    - apps/web/src/lib/seo/og-card.server.ts (OgCard now imported from content/tools and re-exported)
decisions:
  - "Cash-on-cash share-card title is ['Cash-on-cash', 'return calculator'] (10-07 handoff overrides the plan's ['Cash-on-cash return', 'calculator']); tools.test.ts pins all six titleLines to the 10-07 overflow fixtures"
  - "OgCard has one definition, in lib/content/tools.ts; og-card.server.ts does `import type` + `export type { OgCard }`, so existing imports keep working"
  - "goFurther.sample carries `query: '?source=sample'` next to the resolvable path ('/investor/' | '/renter/'): the UI-SPEC targets are /investor/?source=sample and /renter/?source=sample, and resolve() only takes the route"
  - "Added `rows: ToolRow[]` (supporting result-row labels keyed by the @tran/core/finance result fields) so every calculator string, including the UI-SPEC supporting rows, lives in the module; field ids equal the core input keys (price, monthlyRent, otherMonthlyIncome, vacancyPct, monthlyOpex, downPaymentPct, closingCosts, interestRatePct, termYears, loanAmount)"
  - "Announcement templates use {x} for the headline and {y} for an already-formatted dollar string (UI-SPEC writes {$y})"
  - "Affordability formula lines were written from packages/core/src/renter/affordability.ts (25%/30% of monthly income, 40% debt check, round to $25, 40x rent yearly income, 2x rent move-in) as the plan requires; they are not in the UI-SPEC"
  - "No svelte.config.js change: prerender entries '*' already include the static +server endpoints, so sitemap.xml and robots.txt are emitted even though no page links them"
requirements-completed: [GTM-03]
metrics:
  duration: ~15 min
  completed: 2026-10-13
  tasks: 2
  files: 14
---

# Phase 10 Plan 10: Calculator content, SeoHead, sitemap/robots and share-card endpoints Summary

**One typed, banned-term-checked copy module for all four calculators and the hub, a SeoHead component that builds canonical and og:* URLs from SITE_URL plus the route id, and prerendered sitemap.xml, robots.txt and six 1200x630 share-card PNGs on both the root and sub builds.**

## Tasks

| Task | Name | Commits |
| ---- | ---- | ------- |
| 1 | Typed calculator content module | ad30742 (RED), d977415 (GREEN) |
| 2 | SeoHead, sitemap/robots endpoints and share-card endpoints | 7553385 (RED), 0aa8a7e (GREEN) |

## Verification (real output)

- Task 1 RED: `vitest run --project web content/tools` failed (module missing, "no tests"). GREEN: 12/12 passed. With the 10-07 renderer tests: 2 files, 30 tests passed
- Task 2 RED: `seo/sitemap` failed (module missing). GREEN: 7/7 passed. `vitest run --project web seo content`: 66 passed
- `corepack pnpm check`: 0 errors, 0 warnings (2664 files). `corepack pnpm banned`: passed (400 files)
- `eslint` + `prettier --check` on every file of this plan: clean. Full `corepack pnpm lint` exits 1 only because of 4 `no-explicit-any` errors in `scripts/launch-audit.test.ts`, which is 10-22's uncommitted work running in parallel. None of the errors are in this plan's files
- Under `.tools/build.lock`: `build:root` and `build:sub` both succeeded. The plan's node check printed "8 files x 2 builds OK, PNGs 1200x630" and "sub locs OK". `csp:assert` passed 38 pages for root, sub and configured (note: build-configured was not rebuilt by this plan)
- Emitted PNG sizes (bytes, root): affordability 124,632; cap-rate 120,048; cash-on-cash 126,271; default 142,993; dscr 118,760; tools 124,030. They match the 10-07 fixture renders byte for byte in size
- build-sub robots.txt: `Disallow: /tran_real_estate/print/`, `Disallow: /tran_real_estate/agent/inquire/`, `Sitemap: https://tranrealestate.github.io/tran_real_estate/sitemap.xml`
- Acceptance greps: no `{@html` in lib/seo; SeoHead has no `$app/paths` and no `page.url`; each og endpoint contains `export const prerender = true` and `renderOgCard(`; `apps/web/src/lib/data/tools.ts` does not exist
- `corepack pnpm test:unit`: 6185 passed, 1 failed (`scripts/precommit.test.ts` "a staged fixture with a real-looking email blocks the commit", 56 s under parallel load). Re-run alone: 10/10 passed. It is unrelated to this plan

### SEO oracle (`node scripts/assert-seo.mjs apps/web/build --target root`): exit 1, 391 errors, all expected at this point

- `sitemap.xml: 8 URLs, expected at least 14`: /tools/, the four calculators and /feedback/ pages don't exist yet (10-11 and later). The sitemap is glob-derived, so they appear once those pages land
- `(app)`/`(print)`/`(public)` pages ("indexable page missing from sitemap.xml"): they need `<meta name="robots" content="noindex">`, which a later plan adds
- Missing canonical/og:*/twitter tags on every page: no page uses SeoHead yet (10-11 and 10-13 adopt it)
- No errors were reported about og:image files, sitemap duplicates, or the robots/sitemap format

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Buffer is not a BodyInit**
- **Found during:** Task 2 (`pnpm check`: 6 errors "Buffer<ArrayBufferLike> is not assignable to BodyInit")
- **Fix:** `new Response(new Uint8Array(renderOgCard(card).asPng()), ...)` in each og endpoint
- **Commit:** 0aa8a7e

**2. [Plan adjustment] Cash-on-cash card title break**
- The plan listed ['Cash-on-cash return', 'calculator']. The 10-07 handoff requires ['Cash-on-cash', 'return calculator'] because the single line overlaps the mark disc. The 10-07 version is used, and a test pins it.

**3. [Rule 2 - Completeness] Small type extensions**
- Added `goFurther.sample.query`, `rows`, and an optional `negativeSuffix`/`notApplicable`/`covers`/`doesNotCover` on `ToolContent`, so the UI-SPEC's sample links and supporting-row labels also live in the module (see decisions)

**4. [Shared file] og-card.server.ts edited**
- This file is not in the plan's files list. The plan requires one OgCard definition, so the interface moved to content/tools.ts and the renderer re-exports it. The 10-07 tests still pass.

## Known Stubs

None. The six share cards, sitemap and robots file are fully generated. SeoHead is complete but no page uses it yet. Pages adopt it in 10-11/10-13, per the plan's success criteria.

## Notes for 10-11

- `<SeoHead title={t.docTitle} description={t.description} ogImage={t.slug} ogAlt={t.ogAlt} jsonLd={[webApplication({ name: t.h1, description: t.description, url }), faqPage(t.faq)]} />`. Hub: `ogImage="tools"`. Other marketing pages: defaults (default card, DEFAULT_OG_ALT)
- Sample CTA href = `resolve(t.goFurther.sample.path) + t.goFurther.sample.query`
- Field `id`s and row `id`s are the `@tran/core/finance` input/result keys

## Self-Check: PASSED

- All 13 created files are tracked (git ls-files = 13) and og-card.server.ts is committed
- Commits ad30742, d977415, 7553385, 0aa8a7e exist in `git log`
