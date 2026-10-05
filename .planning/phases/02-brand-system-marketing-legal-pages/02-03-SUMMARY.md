---
phase: 02-brand-system-marketing-legal-pages
plan: 03
subsystem: web-styling
tags: [tailwind-theme, fonts, self-hosting, csp, parity-test, build-oracle]
requires:
  - "02-01: @tran/brand tokens + themeVars()"
provides:
  - "Tailwind @theme driven only by brand tokens (default palette reset)"
  - "Type-scale utilities text-label / text-body / text-heading / text-display"
  - "Self-hosted Fraunces + Inter variable fonts as hashed same-origin woff2"
  - "@lucide/svelte 1.45.0 available to components"
  - "BUILD_YEAR constant ($lib/build-info) from a Vite define"
  - "app.css <-> @tran/brand parity test + raw-hex ban in .svelte files"
  - "checkAssetText(): csp:assert rejects data: URIs in built CSS/HTML"
affects: [02-04 layout/landmarks, every Phase 2+ component (token-only utilities), footer copyright year]
tech-stack:
  added: ["@fontsource-variable/fraunces 5.3.0", "@fontsource-variable/inter 5.3.0", "@lucide/svelte 1.45.0", "@tran/brand workspace:*"]
  patterns: [token parity unit test with mutation control, build-time define read only from a .ts module]
key-files:
  created:
    - apps/web/src/app.d.ts
    - apps/web/src/lib/build-info.ts
    - apps/web/src/lib/brand/theme-parity.test.ts
  modified:
    - apps/web/package.json
    - pnpm-lock.yaml
    - apps/web/vite.config.ts
    - apps/web/src/routes/+layout.svelte
    - apps/web/src/app.css
    - scripts/assert-csp.mjs
    - scripts/assert-csp.test.ts
decisions:
  - "Raw-hex ban walks every .svelte file under apps/web/src and also asserts the walk found at least one file, so it cannot pass vacuously"
  - "checkBuild runs checkAssetText in a second walk over .css and .html after the existing html loop; the missing-dir short-circuit still returns exactly 2 + EXPECTED_PAGES.length errors"
  - "Fontsource CSS uses relative url(./...woff2), so the fonts resolve under both the root and the /tran_real_estate sub-base without any path rewriting"
metrics:
  duration: 5min
  completed: 2026-10-05
  tasks: 3
  files: 10
---

# Phase 2 Plan 03: Tailwind Theme, Self-Hosted Fonts, data: URI Oracle Summary

Tailwind v4 `@theme` now mirrors `@tran/brand` with the default palette reset (`--color-*: initial`), so components can only use brand colors. Fraunces and Inter ship as hashed same-origin woff2 files. A parity test fails on any drift between app.css and the brand package, and `csp:assert` now rejects `data:` URIs in built CSS and HTML.

## What Was Built

- **Task 1 (86b06f5):** Added `@fontsource-variable/fraunces@5.3.0`, `@fontsource-variable/inter@5.3.0`, `@lucide/svelte@1.45.0` (all exact) and `@tran/brand@workspace:*` to apps/web. `pnpm-workspace.yaml` is unchanged. `vite.config.ts` gained `build.assetsInlineLimit: 0` and `define.__BUILD_YEAR__`, which apply to both the Kit and Vitest branches. Added `app.d.ts` (global `__BUILD_YEAR__: number`) and `$lib/build-info.ts` (`BUILD_YEAR`). The root layout imports both font packages before `app.css`. The build emits 3 Fraunces and 7 Inter woff2 files, and nothing references fonts.googleapis or fonts.gstatic.
- **Task 2 RED (8ad8aa2):** Wrote 6 tests: forward parity, reverse parity (no extra brand-group vars), non-vacuity (>25 vars plus `--color-*: initial;`), a mutation control (`#fbf7f1` reports exactly `--color-background`), a planted-hex control, and the raw-hex ban over `.svelte` files. 3 failed against the empty `@theme`.
- **Task 2 GREEN (ee2032e):** Rewrote `app.css` with the full `@theme` (18 colors, 2 fonts, the 4-step type scale, radii, shadows, ease, `container-page`/`container-reading`) and the base layer (page ground, flex column body, balanced headings, focus ring, scroll margin, reduced motion). It has no `--duration-*` and no `container-prose`. 6/6 pass, and the built CSS contains `Inter Variable`.
- **Task 3 RED (8915635):** Added 6 `data: URI ban` tests. These cover CSS url() (bare and quoted/padded), the HTML attribute case, the Kit boot `data: [null, null]` and `data-*` attribute negatives, and checkBuild over a temp build with a `data:` font in `_app/immutable/assets/0.css`. All 6 failed.
- **Task 3 GREEN (b468792):** Added `checkAssetText` plus the second walk in `checkBuild`. 37/37 oracle tests pass.

## Verification

- `corepack pnpm check`: 0 errors. `corepack pnpm lint`: clean.
- `corepack pnpm test:unit`: 13 files, 200 tests pass.
- `build:root` and `build:sub` both pass `csp:assert` (7 pages each).
- `corepack pnpm test:e2e`: 30/30 pass (routing, CSP, framing and axe under both bases).
- Mutation check on the real build (not committed): appending `url(data:image/png;base64,AA)` to the built CSS made `assert-csp` exit 1, naming the file. After restoring the file it passed again.
- Under the sub-base, the font URLs in the built CSS are relative (`url(./fraunces-...woff2)`), so they stay same-origin under both bases.

## Deviations from Plan

None. The plan was executed as written.

Process note (no code impact): the first GREEN edit to `assert-csp.mjs` went through a Python string that turned `\b` into a literal backspace byte. The HTML-attribute test caught it (red), I replaced the byte with `\b`, and the test went green before the commit. No other file contains a backspace byte (checked).

## Known Stubs

None. `BUILD_YEAR` and `@lucide/svelte` have no consumers yet; plan 02-04 (footer/layout) uses them.

## Self-Check: PASSED
