---
phase: 17-extension-release-edge-add-ons-submission
plan: 02
subsystem: extension-release
tags: [store-listing, screenshots, playwright-capture, vitest]
requires: [17-01]
provides:
  - apps/extension/e2e/capture-store-shots.capture.ts and playwright.capture.config.ts (pnpm --filter extension capture:store)
  - three 1280x800 PNGs under apps/extension/store/screenshots/
  - Website, Support contact detail and Notes for certification in edge-listing.md
  - store-copy, PNG-header and EXT-09 placeholder-or-link tests
affects: [17-04 owner asset review, 17-05 Partner Center submission]
tech-stack:
  added: []
  patterns: [capture spec outside the default e2e run via .capture.ts suffix, IHDR-reading test with planted negatives]
key-files:
  created:
    - apps/extension/e2e/capture-store-shots.capture.ts
    - apps/extension/playwright.capture.config.ts
    - apps/extension/store/screenshots/01-dimmed-results.png
    - apps/extension/store/screenshots/02-reveal-card.png
    - apps/extension/store/screenshots/03-popup.png
  modified:
    - apps/extension/package.json
    - apps/extension/store/edge-listing.md
    - scripts/extension-docs.test.ts
key-decisions:
  - "Support contact defaults to the live site feedback page (no personal email); owner confirms in 17-04"
requirements-completed: []
duration: ~10min
completed: 2026-11-16
---

# Phase 17 Plan 02: Store screenshots, listing copy, store-copy and EXT-09 tests Summary

Three 1280x800 screenshots are captured headless from the synthetic fixture page with the production build, the listing carries Website, Support contact detail and the ad-slot Notes for certification, and tests pin sizes, copy and the install-guide placeholder-or-link rule, each with planted negatives.

## Commits

- df926ef feat(17-02): capture script, config, three PNGs
- 16c17ce feat(17-02): listing sections and tests
- (follow-up) fix(17-02): annotate capture timeouts with measured values and cause

## Verification

- `pnpm --filter extension capture:store`: 1 passed (headless worked; headed fallback not needed). Re-run reproduced identical PNGs.
- PNGs: all three 1280 x 800, 35.9 KB, 37.6 KB, 59.2 KB.
- Screenshots viewed: 01 shows a three-column grid of seven fictional-address cards, three dimmed with "Sponsored - show" pills; 02 shows the first card revealed at full strength with a "dim" pill; 03 shows the popup (switch On, "Collects nothing, sends nothing") sparse on the left of the canvas. No real data.
- The default `playwright test --list` lists no capture spec (count 0).
- `pnpm vitest run --project scripts`: 39 files, 1252 tests passed. Quick-command files: 4 files, 162 tests passed.
- `pnpm ext:build && pnpm ext:assert` passed; `pnpm guard` and `pnpm fixtures:check` passed; eslint and prettier clean on touched files. docs/EXTENSION-INSTALL.md untouched.

## Deviations from Plan

**1. [Rule 1 - Bug] Capture timeouts failed the test-lanes sweep.** The full scripts project failed `test-lanes.test.ts` because the 15 s and 60 s timeouts lacked the "measured" and "cause" comment wording. Rewrote the comments in the repo's format (same numbers). Commit: follow-up fix above.

## Notes

- Shot 3 is sparse on the 1280x800 canvas; composition is the owner's call in 17-04 (may drop to two shots).
- The certification note wording is pinned by test; 17-05 must confirm it against the owner's live smoke.
- REQUIREMENTS.md not ticked: EXT-07 and EXT-09 finish in later plans.

## Self-Check: PASSED
