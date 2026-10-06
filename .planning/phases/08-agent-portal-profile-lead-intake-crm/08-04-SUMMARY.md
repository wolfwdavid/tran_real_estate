---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 04
subsystem: brand-kit
tags: [brand, contrast, wcag, logo, sniffing, tdd]
requires: ["@tran/brand contrastRatio + tokens (02-01)"]
provides: ["@tran/brand/brand-color: normalizeHex, assessBrandColor, effectiveBrandColors, BRAND_FALLBACK, FALLBACK_NAMES, BRAND_MIN_RATIO", "@tran/core/agent logo: LOGO_MAX_BYTES, LOGO_MAX_SIDE, RASTER_LONG_SIDE, sniffLogo, checkLogoFile, pngSize, svgIntrinsicSize, rasterTargetSize, isOversizedRaster"]
affects: [08-22 logo upload UI, profile brand-color UI, Phase 9 reports]
tech-stack:
  added: []
  patterns: ["subpath export to avoid a barrel import cycle", "seeded LCG table test instead of fast-check"]
key-files:
  created: [packages/brand/src/brand-color.ts, packages/brand/src/brand-color.test.ts, packages/core/src/agent/logo.ts, packages/core/src/agent/logo.test.ts]
  modified: [packages/brand/package.json, packages/core/src/agent/index.ts]
decisions:
  - "brand-color is imported as `@tran/brand/brand-color` (package.json subpath export), NOT re-exported from index: re-exporting caused a runtime cycle (index-first import -> TypeError reading tokens.color)"
  - "White comes from tokens.color.white (a token exists), so brand-color.ts contains zero hex literals (plan expected 1)"
metrics:
  duration: ~25min
  completed: 2026-10-06
---

# Phase 8 Plan 04: Brand Color + Logo Logic Summary

This plan adds pure, tested brand-kit logic. Agent brand colors are checked for WCAG AA with the Phase 2 `contrastRatio`: white text on the primary color and espresso text on the accent color must each reach at least 4.5:1. If a color fails, `effectiveBrandColors()` swaps in the terracotta or sand token. Logos are identified by their bytes, not their file type or extension: PNG by its magic bytes, SVG by finding the `<svg` root after any BOM, XML prolog, comments or DOCTYPE. Separate pure functions read PNG/SVG sizes and compute the 1024 px raster target.

## Import path (required record)
`import { effectiveBrandColors } from '@tran/brand/brand-color'`. A re-export from `packages/brand/src/index.ts` was tried and failed at runtime because of a circular import (contrast.test.ts got `TypeError: Cannot read properties of undefined (reading 'color')`). So, as the plan allows for this case, the code is exposed through a `"./brand-color"` subpath export. `index.ts` is unchanged. Logo helpers come from `@tran/core/agent` (I added `export * from './logo.js'` to the 08-01 barrel).

## Commits
- da751f2 test(08-04): failing brand color tests
- 6c3dc0c feat(08-04): brand color contrast assessment with token fallback
- e0e4ac0 test(08-04): failing logo sniffing tests
- 22b771f feat(08-04): logo sniffing and raster size math
- 194794c refactor(08-04): keep DOM API names out of logo module comments

## Verification
- `vitest --project brand --project core`: 64 files and 1764 tests pass. `@tran/brand check` and `@tran/core check` (tsc) both pass.
- Mutation tests:
  - brand-color: threshold changed to 4.4, fallback bypassed, and `floor` changed to `round`. The tests caught all 3.
  - logo: BOM skip removed, size gate shifted by one byte, IHDR tag check altered, upscaling allowed, 1024-byte head limit removed, and the sniff result ignored in `checkLogoFile`. The tests caught all 6.
  - The mutant that removes the character check after `<svg` could not be applied with sed. The `<svgx>` and bare `<svg` tests cover that case.
- The `TextDecoder|Blob` grep finds 0 matches in logo.ts.

## Deviations from Plan
1. **[Rule 3] Import cycle.** I used the plan's documented fallback: a subpath export in `packages/brand/package.json`. That file is the brand package's own manifest, not one of 08-01's files, and the lockfile did not change.
2. **[Rule 1] White is a token.** `tokens.color.white` exists, so I used it instead of a literal `'#FFFFFF'`. The hex-count acceptance grep therefore gives 0, not 1. This is stricter than the plan intended.
3. **Extra comment-only commit (194794c)** so the `TextDecoder|Blob` acceptance grep returns 0.
4. **SVG `<script>` handling.** `logo.ts` does not look for scripts inside SVGs, and the plan never asked it to. Protection comes from the Pattern 8 rule that only rasterized PNGs are stored (web plan 08-22): an SVG drawn into a canvas through `<img>` cannot run scripts. If a separate script-rejection gate is wanted, it is an additive follow-up.

## Requirements advanced
AGT-01 (brand kit: colors + logo validation logic). Not marked complete. The UI and storage plans finish it.

## Known Stubs
None.

## Self-Check: PASSED
