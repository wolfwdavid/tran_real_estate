---
phase: 10-launch-hardening-go-to-market
plan: 01
subsystem: build-config
tags: [gate, contract-map, site-config, vite-define, prerender-origin]
requires:
  - Phases 2-9 shipped (gate verified)
provides:
  - 10-CONTRACT-MAP.md (fixed name -> real shipped path/export for every Phase 2-9 integration point)
  - apps/web/src/lib/site-config.js (resolveSiteOrigin, resolveAnalytics, resolveWeb3formsKey, resolveContactEmail, DEFAULT_SITE_ORIGIN)
  - apps/web/src/lib/site.ts (SITE_URL, SITE_ORIGIN, SITE_BASE, ANALYTICS, WEB3FORMS_KEY, CONTACT_EMAIL)
  - kit.prerender.origin = resolveSiteOrigin()
affects: [10-02 and every later Phase 10 plan]
tech-stack:
  added: []
  patterns:
    - Optional owner settings via Node process.env + Vite define (never Kit's static public env module)
    - One module ($lib/site) names the define globals
key-files:
  created:
    - .planning/phases/10-launch-hardening-go-to-market/10-CONTRACT-MAP.md
    - apps/web/src/lib/site-config.js
    - apps/web/src/lib/site-config.test.ts
    - apps/web/src/lib/site.ts
    - apps/web/src/lib/site.test.ts
  modified:
    - apps/web/vite.config.ts
    - apps/web/svelte.config.js
    - apps/web/src/app.d.ts
    - eslint.config.js
decisions:
  - "The five Phase 10 define constants sit beside the existing __BUILD_YEAR__ in the one top-level define block, so Vitest, dev, build and prerender all get them"
  - "app.d.ts already existed (Phase 2 __BUILD_YEAR__): the five declarations were added inside its declare global block"
  - "ProviderKeyCard depends on getSettingsContext(); a page outside /settings/ that renders it must create and populate a settings context (recorded in the contract map)"
  - "The backup registry accepts Dexie table names only; a localStorage pref cannot be registered (recorded in the contract map)"
requirements-completed: [GTM-02, GTM-03, GTM-04]
metrics:
  duration: ~33 min
  completed: 2026-10-13
  tasks: 3
  files: 9
---

# Phase 10 Plan 01: Wave 0 gate, contract map and build-time site config Summary

Gate passed for Phases 2-9. 10-CONTRACT-MAP.md records the real path and export for every Phase 2-9 integration point. A validated `site-config.js` feeds `SITE_URL` and the optional Umami, Web3Forms and contact settings into Vite `define`. `kit.prerender.origin` now makes the crawler follow absolute share-card links.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Wave 0 gate and Phase 2-9 contract map | 4a77381 | 10-CONTRACT-MAP.md |
| 2 | Validated site-config module (TDD) | 53f8c4c (RED), 5bae821 (GREEN) | site-config.test.ts, site-config.js |
| 3 | Define constants, prerender.origin, typed site module | 70e1a1f | site.ts, site.test.ts, app.d.ts, vite.config.ts, svelte.config.js, eslint.config.js |

## Gate result

PLAN/SUMMARY counts: 02 12/12, 03 17/17, 04 25/25, 05 16/16, 06 22/22, 07 21/21, 08 27/27, 09 25/25. All required artifacts exist: AffordabilityCalculator, CapEditor, KeyTestResult, ProviderKeyCard, monthlyPayment and web3forms-sink. No blocker.

## Verification (real output)

- Task 1 verify node script: `VERIFY_OK`. `grep -c TBD` = 0. `test -f` passed for every backticked file path in the map.
- `corepack pnpm vitest run --project web site-config`: 29 passed. RED was confirmed first: the suite failed on the missing module.
- `vitest run --project web site` with all PUBLIC_* and BASE_PATH cleared: 2 files, 31 passed.
- `corepack pnpm check`: 0 errors, 0 warnings (2620 files).
- `corepack pnpm lint`: Prettier and ESLint both clean, exit 0.
- `corepack pnpm test:unit`: 295 files, 5883 tests passed.
- `build:root` exit 0, `build:sub` exit 0, `csp:assert`: 38 pages passed in both `build` and `build-sub`.
- Negative build: running `node scripts/build-web.mjs root` with only `PUBLIC_ANALYTICS_HOST=https://stats.example.org` set (through `node -e`) exited 1 with "...: set both or neither". The existing build output was left untouched.
- `test:e2e` ran in 7 chunks of 5 minutes or less, under the build lock, covering every spec file: 162 + 736 + 156 + 154 + 150 + 308 + 184 = 1850 passed, 0 failed. The `a11y.spec.ts` filter also matched the agent, AI and settings a11y specs, so some specs ran twice.
- `grep -rln` for the define globals in `apps/web/src` lists only `src/app.d.ts` and `src/lib/site.ts`. `grep -rn "env/static/public" apps/web/src` returns nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing `define` block and `app.d.ts`**
- **Found during:** Task 3
- **Issue:** `vite.config.ts` already had a top-level `define: { __BUILD_YEAR__ }`, and `app.d.ts` already existed.
- **Fix:** Merged the five new constants into the existing `define` object and the existing `declare global` block. Both are covered by the plan's own "if app.d.ts exists" instruction.
- **Commit:** 70e1a1f

**2. [Rule 1 - Acceptance] Comment wording in site-config.js**
- **Found during:** Task 2
- **Issue:** The explanatory comment named the module path, which tripped the acceptance grep that requires zero hits.
- **Fix:** Reworded the comment to "Kit's static public env module".
- **Commit:** 5bae821

## Known Stubs

None. `ANALYTICS`, `WEB3FORMS_KEY` and `CONTACT_EMAIL` default to `''` on purpose: an unset setting means the feature is off. Later Phase 10 plans consume these values.

## Self-Check: PASSED

- FOUND: 10-CONTRACT-MAP.md, site-config.js, site-config.test.ts, site.ts, site.test.ts
- FOUND commits: 4a77381, 53f8c4c, 5bae821, 70e1a1f
- Build lock released; no stray apps/web/test-results
