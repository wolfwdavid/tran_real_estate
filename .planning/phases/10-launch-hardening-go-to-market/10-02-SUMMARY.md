---
phase: 10-launch-hardening-go-to-market
plan: 02
subsystem: build-config / security
tags: [csp, analytics-host, json-ld, build-targets, oracle]
requires:
  - 10-01 (site-config.js resolveAnalytics)
provides:
  - apps/web/src/lib/csp-policy.js (buildCsp({ analyticsHost }) -> Kit csp config)
  - scripts/lib/build-targets.mjs (TARGETS, OWNER_KEYS, targetEnv(name, env), TEST_FORM_KEY, TEST_WEBSITE_ID, TEST_CONTACT_EMAIL)
  - scripts/build-web.mjs root|sub|configured
  - scripts/assert-csp.mjs checkHtml(rel, html, { analyticsHost }), checkBuild(dir, opts), CLI --target <name>, ld+json exemption
affects: [10-05 (package.json csp:assert --target wiring, build:configured, CI matrix), JSON-LD plans (GTM-03), analytics beacon plan (GTM-04)]
tech-stack:
  added: []
  patterns:
    - CSP policy produced by a unit-tested builder; oracle keeps an independent literal (two-file reviewed diff)
    - One build-target table drives builds, the CSP oracle and (later) the E2E harness
key-files:
  created:
    - apps/web/src/lib/csp-policy.js
    - apps/web/src/lib/csp-policy.test.ts
    - scripts/lib/build-targets.mjs
    - scripts/build-targets.test.ts
  modified:
    - apps/web/svelte.config.js
    - scripts/build-web.mjs
    - scripts/assert-csp.mjs
    - scripts/assert-csp.test.ts
    - apps/web/src/lib/ai/models.test.ts
    - apps/web/src/lib/ai/models.ts (comment)
    - packages/core/src/providers.ts (comment)
decisions:
  - With no analytics host the emitted CSP is identical to the pre-Phase-10 policy (deep-equal test against the copied literal, csp:assert green on root and sub)
  - The oracle recognises JSON-LD only by the script's own type attribute (regex anchored on whitespace, quote-matched, case-insensitive); a data-* attribute naming ld+json does not exempt a script
  - csp-policy.test.ts loads the Node oracle via a computed-URL dynamic import so svelte-check (checkJs) does not type-check scripts/assert-csp.mjs inside the web project
  - targetEnv('root') passes owner settings through only when present (an empty env yields exactly { BASE_PATH, BUILD_DIR }); PUBLIC_SITE_URL passes through on every target
  - package.json csp:assert still has no --target flags; plan 10-05 owns that wiring (its files_modified include package.json)
requirements-completed: [GTM-03, GTM-04]
metrics:
  duration: ~20 min
  completed: 2026-10-13
---

# Phase 10 Plan 02: Host-aware CSP builder, build targets and JSON-LD aware oracle Summary

The CSP now comes from `buildCsp({ analyticsHost })`, which adds the analytics origin to connect-src only when `PUBLIC_ANALYTICS_HOST` is configured. One `root|sub|configured` target table drives every build. The independent CSP oracle accepts escaped JSON-LD blocks and takes the analytics origin only from the same validated env the build reads.

## Tasks

| Task | Name | Commits |
| ---- | ---- | ------- |
| 1 | CSP builder consumed by svelte.config.js | 71fc847 (RED), d7a6d92 (GREEN) |
| 2 | Build targets, oracle JSON-LD exemption, optional analytics host | 13ec1aa (RED), c8a0e53 (GREEN) |
| - | Deviation: CSP coverage test + svelte-check fix | c2d9702 |
| - | Deviation: stale invariant comment | 69dcf68 |

## Verification (real output)

- `vitest run --project web csp-policy models`: 24 passed
- `vitest run --project scripts`: 15 files, 549 tests passed (includes build-targets and assert-csp)
- `pnpm test:unit` (all projects incl. browser): 300 files, 5993 tests passed
- `pnpm check`: 2624 files, 0 errors, 0 warnings
- `pnpm lint`: exit 0. It ran before the last two small commits; the files those commits touched were each re-checked with prettier and eslint, both clean.
- `build:root` + `build:sub` (under build lock) then `pnpm csp:assert`: "CSP assertion passed for 38 pages in apps/web/build (analytics host: none)" and the same for build-sub
- End-to-end analytics proof (build lock held, output deleted afterwards): `node scripts/build-web.mjs configured` emitted `connect-src ... https://api.web3forms.com http://127.0.0.1:4275`. `assert-csp build-configured --target configured` passed (38 pages). Without `--target` it failed on all 38 pages. `assert-csp apps/web/build --target configured` also failed on all 38 pages (missing host), so the check runs both ways.
- Unknown targets: `build-web.mjs nope` exits 2 with usage, and `assert-csp --target nope` exits 2 with the error and usage.
- Mutation: removing openrouter from csp-policy.js fails 5 tests, including the provider-host CSP coverage test. The file was restored afterwards.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Provider CSP coverage test read the moved literal**
- **Found during:** after Task 1 (reported by the orchestrator from a parallel executor)
- **Issue:** `apps/web/src/lib/ai/models.test.ts` "every registry host is listed in svelte.config.js connect-src" text-searched svelte.config.js, which no longer holds the host list.
- **Fix:** The test now asserts against `buildCsp().directives['connect-src']`, the single source. Mutation-tested as described above. The stale comments in models.ts and packages/core/src/providers.ts were updated too.
- **Commits:** c2d9702, 69dcf68

**2. [Rule 3 - Blocking] svelte-check type-checked the Node oracle**
- **Found during:** plan verification (`pnpm check`, 35 implicit-any errors in scripts/assert-csp.mjs)
- **Issue:** The static import of `scripts/assert-csp.mjs` in csp-policy.test.ts pulled the untyped script into the web project's checkJs. The plan anticipated this.
- **Fix:** The test now uses a typed dynamic import through `new URL(..., import.meta.url).href`. Check is back to 0 errors.
- **Commit:** c2d9702

**3. [Rule 1 - Bug] build-web.mjs version probe on Windows without npm_execpath**
- **Found during:** Task 2 (running `node scripts/build-web.mjs configured` directly)
- **Issue:** The `corepack` fallback probe spawned without a shell, so on Windows it reported "pnpm unknown". The build spawn already used a shell.
- **Fix:** Both spawns now share one `shell` flag. The probe returns 11.27.0.
- **Commit:** c8a0e53

## Notes for later plans

- `package.json` `csp:assert` still runs without `--target`. If CI ever sets `PUBLIC_ANALYTICS_HOST`, the build-sub assertion would expect the host and fail, because sub blanks it. Plan 10-05 changes the script to `--target root|sub|configured`, which fixes this.
- `apps/web/build-configured/` is not gitignored yet (10-05 adds it). The test build was deleted after verification.

## Known Stubs

None.

## Self-Check: PASSED
