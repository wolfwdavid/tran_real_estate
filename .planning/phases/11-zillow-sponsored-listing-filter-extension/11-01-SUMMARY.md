---
phase: 11-zillow-sponsored-listing-filter-extension
plan: 01
subsystem: extension
tags: [wxt, mv3, svelte, happy-dom, vitest, chrome-storage]

requires:
  - phase: 02
    provides: "@tran/brand themeVars() and the /legal/privacy/ page (precondition checked, passed)"
provides:
  - "apps/extension pnpm workspace package on WXT 0.21.4 with every Phase 11 dependency pinned exactly (lockfile committed)"
  - "Production-strict wxt.config.ts: storage + *://*.zillow.com/* only, popup CSP connect-src 'none', deterministic zip name, manifest strings from COPY"
  - "happy-dom `extension` Vitest project reachable from the repo root with every network primitive throwing"
  - "Contracts: selectors.v1.json, config.ts (constants, normalizeLabel, hasClassSelector), copy.ts (COPY, badgeTitleCount), messages.ts (GET_COUNT, COUNT_PUSH, guards, createResponder, badgeFor), settings.ts (enabledSetting)"
  - "Banned-words gate over copy.ts, popup .svelte markup, store/*.md and docs/EXTENSION-INSTALL.md"
affects: [11-02, 11-03, 11-04, 11-05, 11-06, 11-07, 11-08, 11-09, 11-10, 11-11, 11-12]

tech-stack:
  added:
    - wxt 0.21.4
    - vite 8.3.0 (extension)
    - "@wxt-dev/module-svelte 2.0.5"
    - happy-dom 20.14.5
    - vitest-browser-svelte 2.2.1 / @vitest/browser-playwright 4.1.11 (extension)
    - playwright / @playwright/test 1.63.0 (extension)
    - axe-core 4.13.0 (extension, same engine as apps/web)
  patterns:
    - "WxtVitest({ root }) under the root projects harness (no alias fallback needed)"
    - "Extension-local setup-no-network.ts layered after tooling/vitest/no-network.ts"
    - "All user-facing strings in one frozen COPY object; the manifest imports from it"

key-files:
  created:
    - apps/extension/package.json
    - apps/extension/wxt.config.ts
    - apps/extension/tsconfig.json
    - apps/extension/vitest.config.ts
    - apps/extension/tests/setup-no-network.ts
    - apps/extension/tests/no-network.test.ts
    - apps/extension/src/entrypoints/zillow.content/index.ts
    - apps/extension/src/lib/selectors.v1.json
    - apps/extension/src/lib/config.ts
    - apps/extension/src/lib/copy.ts
    - apps/extension/src/lib/messages.ts
    - apps/extension/src/lib/settings.ts
    - apps/extension/tests/selectors.test.ts
    - apps/extension/tests/settings.test.ts
    - apps/extension/tests/messages.test.ts
    - apps/extension/tests/copy-banned.test.ts
  modified:
    - vitest.config.ts
    - eslint.config.js
    - .gitignore
    - .prettierignore
    - pnpm-lock.yaml

key-decisions:
  - "11-01: WXT UserManifestFn env exposes `mode` (ConfigEnv.mode); the production-only CSP keys on mode === 'production'"
  - "11-01: WxtVitest({ root }) resolves apps/extension correctly from the repo root; the wxt/browser alias fallback was not needed"
  - "11-01: Content script import path is wxt/utils/define-content-script (present in wxt 0.21.4 exports); storage is wxt/utils/storage"
  - "11-01: axe-core pinned 4.13.0 in apps/extension (matches apps/web's single installed engine)"
  - "11-01: No allowBuilds entries added: the install reported no ignored build scripts; pnpm-workspace.yaml unchanged"
  - "11-01: EXT-01/02/03 left unchecked after 11-01 (contracts and harness only); later Phase 11 plans close them"

patterns-established:
  - "Extension tests live in apps/extension/tests/**/*.test.ts; tests/browser/** and e2e/** are excluded from the happy-dom project"
  - "Copy-surface glob picks up new popup .svelte files, store/*.md and docs/EXTENSION-INSTALL.md automatically"

requirements-completed: []

duration: 21min
completed: 2026-10-26
---

# Phase 11 Plan 01: Extension Scaffold and Contracts Summary

**WXT 0.21.4 MV3 package with a network-banned happy-dom test project, a production manifest limited to storage + the Zillow host with popup `connect-src 'none'`, and the typed selectors/copy/messages/settings contracts the remaining eleven plans build on.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-10-26T02:10:51Z
- **Completed:** 2026-10-26T02:32:11Z
- **Tasks:** 3
- **Files modified:** 21

## Accomplishments

- `apps/extension` installs reproducibly with every phase dependency pinned exactly, in one lockfile change, so wave-2 plans never touch package.json or pnpm-lock.yaml.
- `corepack pnpm vitest run --project extension` from the repo root runs 42 tests (6 no-network, 15 selectors/normalize, 3 settings, 14 messages/badge/copy, 4 banned-words).
- Every network primitive (fetch, window.fetch, XMLHttpRequest, WebSocket, EventSource, navigator.sendBeacon) throws in the extension test environment, proven test by test.
- `selectors.v1.json` is versioned and bundled, has no class selectors (with a non-vacuity check on a hashed class name), and keeps Showcase opt-in and disjoint from the default labels.
- The banned-words gate was mutation-checked: planting "Official" in copy.ts turned it red with `src/lib/copy.ts:13: Official`.

## Task Commits

1. **Task 1: Package scaffold, one-shot dependency install, harness wiring** - `21503f1` (chore)
2. **Task 2 RED: failing contract tests** - `a47434a` (test)
3. **Task 2 GREEN: contracts (selectors, copy, messages, settings)** - `4c5f325` (feat)
4. **Task 3: banned-words gate for extension copy** - `0fcc74b` (test)

## Recorded Facts (requested by the plan output spec)

- **UserManifestFn field:** `mode` (`ConfigEnv` has both `mode` and `command`; the plan's `mode === 'production'` was used as written).
- **WxtVitest path:** `WxtVitest({ root })` with `root = fileURLToPath(new URL('.', import.meta.url))`. The fake-browser storage test proves it is wired. No alias fallback was needed.
- **define-content-script import:** `wxt/utils/define-content-script` (exists in 0.21.4 exports).
- **axe-core version pinned:** `4.13.0` (apps/web resolves exactly one axe-core, 4.13.0, via `@axe-core/playwright@4.13.0`'s `~4.13.0`).
- **allowBuilds entries:** none added. pnpm 11 reported no ignored build scripts, and `pnpm-workspace.yaml` is unchanged.

## Files Created/Modified

- `apps/extension/package.json`: scripts (prepare/build/zip/check/icons/test:browser/e2e) and exact-pinned devDependencies.
- `apps/extension/wxt.config.ts`: manifest from COPY + ZILLOW_MATCH, exported `POPUP_CSP`, production-only CSP, zip template, `assetsInlineLimit: 0`.
- `apps/extension/vitest.config.ts`: `extension` project, happy-dom with JS/CSS loading and navigation disabled.
- `apps/extension/tests/setup-no-network.ts`: throwers for all network primitives, re-applied in `beforeEach`.
- `apps/extension/src/lib/*`: the five contract files.
- Root `vitest.config.ts` (+`apps/extension`), `eslint.config.js` ignores (+`**/.wxt/`, `**/.output/`), `.gitignore` and `.prettierignore` (+`.wxt`, `.output`, `__screenshots__`).

## Decisions Made

See key-decisions in the frontmatter. In short, every runtime fact the plan asked to confirm matched the plan's primary path, so no fallbacks were used.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Minimal copy.ts/config.ts created in Task 1**
- **Found during:** Task 1
- **Issue:** `wxt.config.ts` imports `COPY` and `ZILLOW_MATCH`, and the stub entrypoint imports `ZILLOW_MATCH`. Without them, `wxt prepare` and `check` cannot pass in Task 1, but both files belong to Task 2.
- **Fix:** Task 1 shipped a minimal `config.ts` (ZILLOW_MATCH only) and `copy.ts` (the four manifest strings). Task 2 replaced both with the full contracts. The RED tests still failed first because `messages.ts`, `settings.ts`, `selectors.v1.json` and `normalizeLabel` did not exist yet.
- **Commit:** 21503f1, then 4c5f325

**2. [Rule 2 - Correctness] Extra test coverage beyond the behavior list**
- Added `isGetCount`/`isCountPush` guard tests (wrong type, non-boolean enabled, negative/fractional/NaN counts), a whitespace-collapse `normalizeLabel` case, a count-250 badge case and a COPY frozen check. No behavior change.

**Total deviations:** 2 (both minor). **Impact:** none on scope.

## Issues Encountered

- `svelte-check` prints a "No svelte input files were found" warning (exit 0, 0 errors). It clears when the popup `.svelte` entrypoint lands in a later plan.
- `@types/node` was recorded by pnpm as `^24.13.5`, which is still within the plan's `^24` range.

## Known Stubs

- `apps/extension/src/entrypoints/zillow.content/index.ts`: `main() {}` is intentionally empty so `wxt prepare` has an entrypoint. Plan 11-10 replaces the body.
- The manifest references `icon/16.png` through `icon/128.png`, which do not exist yet. The icons plan (`scripts/make-icons.mjs`) creates them. `wxt build` was not run in this plan.

## Verification

- `corepack pnpm test:unit`: 326 files, 6333 tests passed (all root projects including `extension`).
- `corepack pnpm check`: 0 errors (extension and web).
- `corepack pnpm lint`: Prettier and ESLint clean.
- `pnpm-workspace.yaml`: no diff.

## Next Phase Readiness

The wave-2 plans can consume `CONFIG`, `COPY`, `badgeTitleCount`, the message contracts, `enabledSetting`/`EnabledSetting`, `PILL_TAG`, `PRIVACY_URL` and the timing constants without changing anything else. Plan 11-06 owns the extension ESLint rule block. The targeted `no-restricted-syntax` disables in `tests/no-network.test.ts` are already in place for it.

---
*Phase: 11-zillow-sponsored-listing-filter-extension*
*Completed: 2026-10-26*

## Self-Check: PASSED

All 7 key files exist; commits 21503f1, a47434a, 4c5f325, 0fcc74b are present.
