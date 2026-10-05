---
phase: 03-local-platform-storage-key-vault-backup
plan: 03
subsystem: infra
tags: [pwa, manifest, icons, playwright, fraunces, csp, assert-csp, github-pages]

# Dependency graph
requires:
  - phase: 03-01
    provides: Phase 3 contracts and guardrails
  - phase: 02-brand-system-marketing-legal-pages
    provides: "@tran/brand tokens (background #fbf7f0, primary #a4452a), self-hosted Fraunces"
provides:
  - Relative-URL web app manifest valid under both the root and /tran_real_estate/ base
  - Four committed brand icons (192, 512, maskable 512, apple-touch 180) and their Playwright generator
  - pwa-capture.js: pre-hydration beforeinstallprompt / appinstalled capture (window.__tranInstallPrompt, tran:installable, tran:installed)
  - app.html head links (capture script, manifest, apple-touch icon, theme-color)
  - assert-csp CARRIERS list, checkManifest, PNG IHDR size checks, per-page manifest/capture link checks
  - serve-pages .webmanifest and .png MIME types
affects: [03-09 service worker, 03-14 install section UI, any plan adding build carriers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Build carriers live in one exported CARRIERS list; tests derive expected counts from it"
    - "Pre-hydration browser events are captured by an external 'self' script in <head>, never inline"
    - "Generated binary assets are committed and parity-tested against the brand tokens"

key-files:
  created:
    - apps/web/static/manifest.webmanifest
    - apps/web/scripts/generate-icons.mjs
    - apps/web/static/icons/icon-192.png
    - apps/web/static/icons/icon-512.png
    - apps/web/static/icons/icon-maskable-512.png
    - apps/web/static/icons/apple-touch-icon-180.png
    - apps/web/static/pwa-capture.js
    - scripts/pwa-assets.test.ts
  modified:
    - apps/web/src/app.html
    - scripts/serve-pages.mjs
    - scripts/assert-csp.mjs
    - scripts/assert-csp.test.ts

key-decisions:
  - "PWA head-link checks run in checkBuild (checkPwaHead), not checkHtml, so checkHtml stays the pure CSP contract and the real-build drift guard is unaffected by stale builds"
  - "Icon size checks cover every manifest icon plus the app.html-linked apple-touch icon; absent files are reported once via CARRIERS, never double-counted"
  - "checkManifest treats any scheme (http:, https:, data:) or leading '/' in an icon src as non-relative"

patterns-established:
  - "CARRIERS: add any new required non-page build file here; assert-csp.test.ts writes and counts from the list"

requirements-completed: [PLAT-06]

# Metrics
duration: 9min
completed: 2026-10-04
---

# Phase 3 Plan 03: PWA Install Assets Summary

**Relative-URL web app manifest, four Fraunces-on-terracotta icons from a Playwright generator, a pre-hydration install-prompt capture script, and a CSP oracle that fails the build on any missing or malformed PWA carrier**

## Performance

- **Duration:** about 9 min
- **Started:** 2026-10-04T22:20Z
- **Completed:** 2026-10-04T22:29Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- `manifest.webmanifest` uses `./` for `id`, `start_url` and `scope`, and relative icon URLs, so one static file is correct on both bases. On the real sub build, `renter/index.html` links `href="../manifest.webmanifest"` and `404.html` links `href="/tran_real_estate/manifest.webmanifest"`, as RESEARCH Pattern 7 predicted.
- `generate-icons.mjs` rasterizes a Fraunces 600 "T" in `#fbf7f0` on `#a4452a`. It refuses to write an icon unless `document.fonts.check('600 64px F')` passes, so a fallback font can never produce an icon. I opened `icon-maskable-512.png` and `icon-192.png` and checked them visually: a cream serif "T", centered on full-bleed terracotta, with the maskable glyph inside the safe zone.
- `pwa-capture.js` is an external IIFE that runs `preventDefault()` on `beforeinstallprompt`, stores the event as `window.__tranInstallPrompt`, and dispatches `tran:installable`. On `appinstalled` it clears the stored event and dispatches `tran:installed`. `app.html` still has 0 inline `<script>` tags.
- `assert-csp.mjs` exports `CARRIERS` (8 files) and `checkManifest`. `checkBuild` reports:
  - missing carriers
  - manifest faults
  - icons that are not PNGs or whose IHDR size differs from the declared size
  - pages whose `<head>` lacks the manifest link or the `pwa-capture.js` tag
- The oracle passes on both real builds (14 pages each), and the full E2E suite passed 306/306.

## Task Commits

1. **Task 1: Manifest, generated icons, asset parity tests**: `ed00511` (test, RED), `635b7b0` (feat, GREEN)
2. **Task 2: Install-prompt capture, head links, local MIME, build oracle**: `66825a9` (test, RED), `6f98dda` (feat, GREEN)

## Files Created/Modified
- `apps/web/static/manifest.webmanifest`: PWA manifest with relative URLs only
- `apps/web/scripts/generate-icons.mjs`: Playwright + Fraunces icon rasterizer, run manually
- `apps/web/static/icons/*.png`: four committed icons
- `apps/web/static/pwa-capture.js`: captures the install prompt before hydration
- `apps/web/src/app.html`: four head lines after frame-guard.js
- `scripts/serve-pages.mjs`: `.webmanifest` and `.png` MIME types
- `scripts/assert-csp.mjs`: CARRIERS, checkManifest, pngSize, checkPwaAssets, checkPwaHead
- `scripts/assert-csp.test.ts`: `png(w,h)` fixture helper, full-carrier `writeFullBuild`, golden head lines, and mutation tests for every carrier, icon size, manifest fault and head-link fault
- `scripts/pwa-assets.test.ts`: checks the manifest, the icon IHDR sizes and brand-token parity

## Decisions Made
See the key-decisions frontmatter. The main one: PWA head-link checks live in `checkBuild`. This keeps `checkHtml`, which the drift guard runs on the real `index.html`, as a pure CSP check.

## Deviations from Plan
None. The plan ran as written. One small choice: I formatted only this plan's files with `prettier --write` instead of running repo-wide `pnpm format`, so I would not touch files owned by the parallel executors. Repo-wide `pnpm lint`, which includes `prettier --check .`, passes.

## Issues Encountered
- Plan-level `test:unit`: 2 test files failed, neither caused by 03-03:
  - `precommit.test.ts` failed because HEAD moved mid-run during parallel execution. It passed on the documented single re-run.
  - `eslint-rules.test.ts` "Phase 3 guardrails": its `beforeAll` asserts that `lib/storage/secrets/vault*` does not exist yet, and a parallel wave-2 vault executor has just created that file. This is out of scope here and belongs to the vault plan or 03-01's guard.
- `corepack pnpm exec` ran an install because the lockfile had changed (03-06's package install). That change was to node_modules only, and no tracked file of this plan was affected.

## Next Phase Readiness
- 03-09 (service worker) can add `service-worker.js` to `CARRIERS`. The test counts update automatically.
- 03-14 (Install UI) reads `window.__tranInstallPrompt` and listens for `tran:installable` and `tran:installed`.

## Self-Check: PASSED
