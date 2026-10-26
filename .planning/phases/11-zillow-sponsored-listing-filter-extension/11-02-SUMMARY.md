---
phase: 11-zillow-sponsored-listing-filter-extension
plan: 02
subsystem: extension
tags: [icons, playwright, brand, edge-store, png]

requires:
  - phase: 11-01
    provides: "apps/extension package with @playwright/test, @fontsource-variable/fraunces and the `icons` script; manifest referencing icon/{16,32,48,128}.png"
  - phase: 02
    provides: "@tran/brand tokens.color.primary / tokens.color.background"
provides:
  - "apps/extension/scripts/make-icons.mjs: re-runnable Playwright icon generator reading hexes from @tran/brand"
  - "Committed RGBA PNGs: public/icon/16, 32, 48, 128 and store/edge-logo-300"
  - "tests/icons.test.ts: locks PNG signature, exact size and RGBA color type for all five files"
affects: [11-06, 11-10, 11-11]

tech-stack:
  added: []
  patterns:
    - "Generator imports brand tokens through a relative TS path (Node 24 type stripping), so no hex literal exists in the script"
    - "Generator refuses to write output if the webfont fails to load (document.fonts.check guard, carried over from the Phase 3 PWA script)"

key-files:
  created:
    - apps/extension/scripts/make-icons.mjs
    - apps/extension/public/icon/16.png
    - apps/extension/public/icon/32.png
    - apps/extension/public/icon/48.png
    - apps/extension/public/icon/128.png
    - apps/extension/store/edge-logo-300.png
    - apps/extension/tests/icons.test.ts
  modified: []

key-decisions:
  - "11-02: The Phase 3 icon script (apps/web/scripts/generate-icons.mjs) exists, but it runs at module top level with no exports and hardcodes hexes, so importing it would execute it. The extension got its own generator with the same inputs (Fraunces latin wght woff2, Playwright screenshot) instead of a refactor of a web-app file outside this plan"
  - "11-02: Glyph font-size is 0.72 x square in a single GLYPH_SCALE constant (Phase 3 PWA uses 0.7); visual check confirmed cap height is about 50% and the T is centered"

patterns-established:
  - "Extension store assets live in apps/extension/store/ (outside public/, so they never ship in the zip)"

requirements-completed: [EXT-04]

duration: 6min
completed: 2026-10-26
---

# Phase 11 Plan 02: Extension Icons and Edge Store Logo Summary

**Playwright-rendered Fraunces "T" on a terracotta rounded square, generated from @tran/brand tokens at 16/32/48/128 px plus a 300x300 Edge Add-ons logo, with a test that locks size and RGBA transparency.**

## Performance

- **Duration:** about 6 min
- **Started:** 2026-10-26T02:34Z
- **Completed:** 2026-10-26T02:40Z
- **Tasks:** 2
- **Files created:** 7

## Accomplishments

- `corepack pnpm --filter extension icons` regenerates all five PNGs deterministically. A second run left `git status` clean.
- The geometry follows UI-SPEC C: 16 and 32 are full-bleed (radius 3/6), 48 is a 44px square with a 2px transparent margin (radius 8), 128 is a 96px square in 16px transparent padding (radius 20), and the store logo is a full-bleed 300 (radius 48). `omitBackground: true` makes the padding real alpha.
- I checked every PNG by eye. There is no Zillow house, Z, blue, shield or stop-sign imagery.
- The script contains no 6-digit hex literal. The colors come from `tokens.color.primary` and `tokens.color.background`.
- `tests/icons.test.ts` has 16 tests: signature, size and color type 6 for each file, plus rejection of a 2-byte buffer and a zeroed 32-byte buffer.

## Task Commits

1. **Task 1: Icon generator script and committed PNGs**: `1de6172` (feat)
2. **Task 2: Icon dimension test**: `5a48d07` (test)

## TDD Evidence (Task 2)

- RED: a stub `readPngSize` that returns zeros made 11 of 16 tests fail. The 5 signature tests don't use the helper, so they passed.
- GREEN: the real IHDR parser passes 16 of 16.
- Mutation: copying 32.png over 48.png turned `public/icon/48.png is 48 px square` red. I then restored the file, and git showed no diff.
- I made one test-only commit and did not commit the stub separately. The PNGs already existed from Task 1, so a committed RED state would only have been a deliberately broken helper.

## Deviations from Plan

**1. [Rule 2 - Correctness] Font-load guard added to the generator**
- **Found during:** Task 1 (borrowed from the Phase 3 script)
- **Issue:** `document.fonts.ready` resolves even if the font fails to load. Without a check, the generator could quietly write Georgia "T" icons.
- **Fix:** After the fonts are ready, `document.fonts.check("600 64px 'Fraunces Variable'")` must pass, or the script throws.
- **Commit:** 1de6172

**2. [Rule 1 - Bug] Test title formatter**
- The title `'%s is %ix%i'` printed `48xNaN`, because `it.each` has no third value to fill the second `%i`. I changed it to `'%s is %i px square'` before committing.

**3. Commit trailer**
- Commit `1de6172` went in with a `Co-Authored-By` trailer that names an AI model, which breaks the project's commit-message rule. By the time I tried to amend it, another wave-2 agent had committed on top (`396a9cc`, 11-07), so rewriting it was no longer safe. It is unpushed, so the owner can reword it before pushing (for example with `git rebase -i` and reword). `5a48d07` has no trailer.

**Total deviations:** 3 (all minor). **Impact:** none on scope.

## Issues Encountered

- Root `corepack pnpm lint` currently fails Prettier on `apps/extension/src/lib/reveal-host.ts` and `apps/extension/tests/reveal-host.test.ts`. Those are another parallel wave-2 plan's uncommitted files, not files from this plan. `prettier --check` and `eslint` pass on `make-icons.mjs` and `icons.test.ts`. The orchestrator's post-wave lint run should re-check once every agent has committed.

## Known Stubs

None.

## Verification

- `corepack pnpm --filter extension icons`: wrote all 5 files.
- `corepack pnpm vitest run --project extension icons`: 16/16 passed.
- Acceptance greps: `omitBackground: true`, `packages/brand/src/index.ts`, `tokens.color.primary`, `document.fonts.ready` are all present. The hex-literal count is 0.

---
*Phase: 11-zillow-sponsored-listing-filter-extension*
*Completed: 2026-10-26*

## Self-Check: PASSED

All 7 created files exist and are non-empty; commits 1de6172 and 5a48d07 are present.
