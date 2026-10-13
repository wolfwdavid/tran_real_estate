---
phase: 10-launch-hardening-go-to-market
plan: 07
subsystem: seo
tags: [json-ld, canonical, og-image, resvg, woff, fonts]
requires:
  - 10-04 (clean dependency audit)
provides:
  - "lib/seo/jsonld.ts: serializeJsonLd, webApplication, faqPage"
  - "lib/seo/paths.ts: canonicalPath(routeId)"
  - "lib/seo/woff.server.ts: woffToSfnt(buffer), nameFamily(sfnt)"
  - "lib/seo/og-marks.ts: OG_MARKS (renter, investor), CONTOUR_PATHS"
  - "lib/seo/og-card.server.ts: OgCard, OG_FONT_FAMILY, ogCardSvg(card), renderOgCard(card, opts?)"
affects: [10-10 (tool content + OG endpoints + JSON-LD in ToolPage), later SEO/meta plans]
tech-stack:
  added:
    - "@resvg/resvg-js 2.6.2 (dev)"
    - "@fontsource/fraunces 5.3.0 (dev, static WOFF)"
    - "@fontsource/inter 5.3.0 (dev, static WOFF)"
  patterns:
    - JSON-LD text is JSON-escaped (<, >, &, U+2028, U+2029 as unicode escapes) before Svelte sees it
    - Share cards render only the site's own fonts (loadSystemFonts false); fontless render is the non-vacuity control
    - Overflow guard diffs a fonted render against a fontless one, isolating text pixels exactly
key-files:
  created:
    - apps/web/src/lib/seo/jsonld.ts
    - apps/web/src/lib/seo/jsonld.test.ts
    - apps/web/src/lib/seo/paths.ts
    - apps/web/src/lib/seo/paths.test.ts
    - apps/web/src/lib/seo/woff.server.ts
    - apps/web/src/lib/seo/woff.server.test.ts
    - apps/web/src/lib/seo/og-marks.ts
    - apps/web/src/lib/seo/og-card.server.ts
    - apps/web/src/lib/seo/og-card.server.test.ts
  modified:
    - apps/web/package.json
    - pnpm-lock.yaml
decisions:
  - "Inter 600 static family name is 'Inter SemiBold' (read from the name table, asserted in the test); OG_FONT_FAMILY = { display: 'Fraunces SemiBold', body: 'Inter', bodySemibold: 'Inter SemiBold' }"
  - "Cash-on-cash card title breaks as ['Cash-on-cash', 'return calculator']: 'Cash-on-cash return' on one 80px line is ~800px wide and ran into the mark disc. Plan 10-10 must use this break"
  - "The default card stays at two lines ('Real estate tools that' / 'do the refreshing for you'): its widest line ends at x ~1036, inside the 1120 limit, so the three-line fallback was not needed"
  - "Tints mirror the landing hero CSS exactly (ellipses at 88%/8% and 4%/92%, radii 60%x55% and 45%x40%, transparent from 70%). The first draft's large circular tints put the default card at 202,589 bytes, just under the 204,800 cap; the hero-faithful tints bring it to 142,993"
  - "Overflow test is stricter than the plan: besides 'no dark pixel in x >= 1120', it requires zero text pixels (fonted vs fontless diff) in the right padding for every card and inside the disc's bounding square for tool cards"
  - "Converted fonts go to a mkdtemp dir that is removed on process exit; a missing font throws 'share-card font missing: <spec>'"
requirements-completed: [GTM-03]
metrics:
  duration: ~28 min
  completed: 2026-10-13
  tasks: 2
  files: 11
---

# Phase 10 Plan 07: SEO primitives (JSON-LD, canonical paths, share-card renderer) Summary

**Escaped JSON-LD builders with no ratings, a route-id to canonical-path function, and a resvg share-card renderer that draws on-brand text from Fontsource WOFF files converted to SFNT in memory, with tests proving text is present, deterministic, within 200 KB and out of the right padding.**

GTM-03 note: this plan delivers the primitives. The prerendered `/og/*.png` endpoints, `lib/content/tools.ts` card data and the JSON-LD/canonical wiring in pages belong to later plans (10-10 onward).

## Tasks

| Task | Name | Commits |
| ---- | ---- | ------- |
| 1 | Dependencies, JSON-LD serializer and canonical paths | eaabc72 (deps), 4124815 (RED), 0f1eae5 (GREEN) |
| 2 | WOFF to SFNT converter and the share-card renderer | b735a85 (RED), 71e08b2 (GREEN), aae397f (fix: hero tints, size, timeout) |

## Verification (real output)

- `corepack pnpm vitest run --project web seo/jsonld seo/paths`: RED failed (modules missing), GREEN 2 files / 19 tests passed
- `corepack pnpm vitest run --project web seo`: RED failed (modules missing); final 4 files / 42 tests passed (run twice in a row after the last change, both green)
- `corepack pnpm lint`: exit 0. `corepack pnpm check`: 0 errors, 0 warnings (2643 files). `corepack pnpm banned`: passed (389 files)
- `corepack pnpm audit:deps`: exit 0 ("1 ignored: 1 low", the 10-04 exception, nothing new)
- `corepack pnpm install --frozen-lockfile`: passed (run under `.tools/build.lock` right after the add; the lockfile has not changed since)
- Font files present: `@fontsource/fraunces/files/fraunces-latin-600-normal.woff`, `@fontsource/inter/files/inter-latin-400-normal.woff`, `@fontsource/inter/files/inter-latin-600-normal.woff`
- `grep -c "aggregateRating\|review" jsonld.ts` = 1 (the NEVER comment). `grep -En "#[0-9a-fA-F]{6}"` on og-card.server.ts and og-marks.ts: no output (all colours come from `tokens.color`)
- Rendered sizes (bytes): affordability 124,632; cap-rate 120,048; cash-on-cash 126,271; dscr 118,760; tools hub 124,030; default 142,993. All six were inspected visually

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Raw U+2028/U+2029 characters written into source**
- **Found during:** Task 1 GREEN
- **Issue:** the file-writing step turned the escape sequences in the regex and test input into raw separator characters, so Prettier/ESLint could not parse jsonld.ts or jsonld.test.ts (vitest still ran). The RED commit 4124815 contains the raw characters in the test file.
- **Fix:** rewrote both files with the escape sequences (built from character codes); the corrected test file is in 0f1eae5
- **Files modified:** apps/web/src/lib/seo/jsonld.ts, apps/web/src/lib/seo/jsonld.test.ts

**2. [Rule 1 - Bug] Cash-on-cash title overlapped the mark disc**
- **Found during:** Task 2 GREEN (the overflow test caught it: 1,764 text pixels inside the disc square)
- **Fix:** the fixture (and the content contract for 10-10) breaks the title as 'Cash-on-cash' / 'return calculator'
- **Commit:** 71e08b2

**3. [Rule 1 - Bug] Default card within 1% of the PNG budget**
- **Found during:** Task 2 review of real sizes (202,589 of 204,800 bytes)
- **Fix:** tints changed to the hero's exact elliptical gradients (the UI-SPEC says the hero's two tints); default card now 142,993 bytes
- **Commit:** aae397f

**4. [Rule 3 - Blocking] Renderer tests timed out once under parallel load**
- **Found during:** final verification (20 s run while other executors were busy; 1 test exceeded the 5 s default)
- **Fix:** `describe('renderOgCard', { timeout: 30_000 })`; two consecutive runs green
- **Commit:** aae397f

**5. [Plan adjustment] Dependencies committed separately**
- The dependency add went into its own `chore(10-07)` commit (eaabc72) ahead of the RED commit so the lockfile change is isolated.

## Known Stubs

None. The modules are complete; their consumers (OG endpoints, ToolPage JSON-LD) are planned for 10-10.

## Notes for later plans

- 10-10: card `titleLines` must match the fixtures in og-card.server.test.ts (especially cash-on-cash). Adding the real `TOOLS[...].og` entries to that test's overflow loop would keep content edits honest.
- Use `canonicalPath(page.route.id)` with `SITE_URL`; never `page.url` or `$app/paths` base.
- Render JSON-LD via `<svelte:element this={tag} type="application/ld+json">{serializeJsonLd(data)}</svelte:element>` (no `{@html}` in marketing routes).

## Self-Check: PASSED

- All 9 created source/test files exist under apps/web/src/lib/seo/
- Commits eaabc72, 4124815, 0f1eae5, b735a85, 71e08b2, aae397f exist in `git log`
