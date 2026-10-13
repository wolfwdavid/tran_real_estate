---
phase: 10-launch-hardening-go-to-market
plan: 05
subsystem: e2e-harness-ci
tags: [playwright, ci, csp, analytics, build-targets]
requires: [10-02, 10-03, 10-04]
provides:
  - configured Playwright project (port 4276, *.configured.spec.ts only)
  - first-party beacon collector on the attacker origin (POST /api/send, GET /__beacons, POST /__beacons/reset)
  - siteEnv(project) helper for specs
  - CI matrix leg `configured`; owner repository variables reach only the root leg
affects: [10-06, 10-07, 10-09, every later spec that branches on owner settings]
tech-stack:
  added: []
  patterns:
    - "Specs branch on siteEnv(testInfo.project.name) instead of guessing whether a build has owner settings"
    - "CI env: `matrix.target == 'root' && vars.X || ''` in every step env block (Build, CSP oracle, E2E)"
key-files:
  created:
    - apps/web/tests/e2e/site-env.ts
    - apps/web/tests/e2e/harness.configured.spec.ts
  modified:
    - scripts/serve-pages.mjs
    - apps/web/playwright.config.ts
    - package.json
    - .github/workflows/ci.yml
    - scripts/workflow-gate.test.ts
    - .gitignore
    - .prettierignore
    - eslint.config.js
    - apps/web/src/lib/site-config.js
    - apps/web/src/lib/site-config.test.ts
decisions:
  - "site-env.ts imports build-targets.mjs and site-config.js directly (static imports); svelte-check accepted them, no dynamic-import workaround needed"
  - "resolveSiteOrigin treats an empty PUBLIC_SITE_URL as unset (|| instead of ??): GitHub expands an unset repository variable to '', which would otherwise fail every CI build"
  - "The attacker listener only answers GET / with the framing page now (byte-identical HTML); other paths are the collector or 404"
  - "The collector answers /api/send with no CORS headers and records any OPTIONS preflight as { preflight: true } so specs can assert none happened"
requirements: [GTM-02, GTM-04]
metrics:
  duration: ~45 min
  completed: 2026-10-13
  tasks: 2
  files: 12
---

# Phase 10 Plan 05: Configured E2E Harness and CI Leg Summary

A third `configured` build (test form key, loopback analytics host + website id, test contact email) is now built, CSP-asserted per target and E2E-tested locally and in CI, with a first-party Umami-shaped collector on the attacker origin that records beacon bodies and headers, and a `siteEnv(project)` helper so specs know which owner settings their build carries.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Emulator MIME types, configured listener, beacon collector; Playwright configured project | f9d8069 | scripts/serve-pages.mjs, apps/web/playwright.config.ts, apps/web/tests/e2e/site-env.ts, apps/web/tests/e2e/harness.configured.spec.ts |
| 2 | Scripts, ignore files and the CI configured leg | 06126b8 | package.json, .github/workflows/ci.yml, scripts/workflow-gate.test.ts, .gitignore, .prettierignore, eslint.config.js, apps/web/src/lib/site-config.js(+test) |

## What was built

- **serve-pages.mjs**: `.xml` and `.txt` MIME types (`.png` was already there); a configured listener on `E2E_PORT_CONFIGURED` (4276) that serves `apps/web/build-configured` when it exists; and on the attacker origin `POST /api/send` (records `{ body, contentType, cookie, referer, origin, at }` and answers 200 with no CORS headers and an empty body), `OPTIONS /api/send` (recorded as a preflight, 204), `GET /__beacons`, `POST /__beacons/reset`, and 404 for anything else. `GET /` serves the same framing HTML as before.
- **playwright.config.ts**: root and sub ignore `*.configured.spec.ts`; the new `configured` project matches only those files; `E2E_PORT_CONFIGURED` is passed to the single webServer entry.
- **site-env.ts**: `siteEnv(project)` returns `{ analyticsHost, websiteId, web3formsKey, contactEmail, collector }`. Root reads the process env, sub is always blank, configured uses the fixed test values from `targetEnv`.
- **harness.configured.spec.ts**: checks that the CSP `connect-src` contains the configured analytics host, that the collector resets to `[]`, that a Node-sent beacon is recorded with a `text/plain` content type and no CORS header (non-vacuity check), and that `siteEnv('configured').web3formsKey === TEST_FORM_KEY`.
- **package.json**: `build:configured`; `csp:assert` now passes `--target root|sub|configured` (handoff from 10-02 closed); `verify` builds all three targets.
- **ci.yml**: the matrix is root/sub/configured (`base_path` dropped). Build runs `pnpm run build:${{ matrix.target }}`, the CSP oracle runs with `--target ${{ matrix.target }}`, and the Build, CSP and E2E steps share one env block in which each owner variable is `matrix.target == 'root' && vars.X || ''`. The `uses:` count is unchanged (7).
- **workflow-gate.test.ts**: new tests pin the three matrix entries, the build script, the target-to-path mapping from `targetEnv`, the root-only owner-variable form (3 per name, no other `vars.X` use), and the CSP and E2E target flags. In the "check, lint, unit before the build" order test, only the build string changed. All other gate tests are unchanged.

## Verification (real output)

- `node scripts/build-web.mjs configured`: exit 0
- `playwright test harness --project=configured`: 4 passed
- `playwright test framing --project=root`: 4 passed (attacker page unchanged)
- `vitest run --project scripts workflow-gate`: 26 passed
- `pnpm lint:workflows` (actionlint): exit 0
- `pnpm lint` with `apps/web/build-configured/` present: Prettier clean, ESLint clean
- `pnpm build:root`, `build:sub`, `build:configured`: all exit 0
- `pnpm csp:assert`: passed for 38 pages in each build (analytics host: none / none / `http://127.0.0.1:4275`)
- 10-02 handoff check: with `PUBLIC_ANALYTICS_HOST`/`WEBSITE_ID` set in the shell, `assert-csp build-sub --target sub` passes (exit 0), and the old form without `--target` fails (exit 1)
- `pnpm test:e2e`: run as 6 shards because of the 7-minute watchdog. root+configured 288+296+277 = 861 (857 root + 4 configured), sub 288+296+269 = 853, so **1714 passed, 0 failed, 0 flaky**
- `pnpm test:unit`: 309 files, 6142 tests passed; `pnpm check`: 0 errors, 0 warnings

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] An unset `PUBLIC_SITE_URL` repository variable would have failed every CI build**
- **Found during:** Task 2
- **Issue:** The plan sets `PUBLIC_SITE_URL: ${{ vars.PUBLIC_SITE_URL }}` in each env block. GitHub expands an unset variable to `''`. `targetEnv` passes `''` through, and `resolveSiteOrigin` used `??` and rejected `''` (a test pinned that), so all three legs would fail at build time until the owner set the variable. The plan's own note says "an unset var is '' which site-config treats as unset". That was true for the four owner keys but not for the site URL.
- **Fix:** `resolveSiteOrigin` now uses `env.PUBLIC_SITE_URL || DEFAULT_SITE_ORIGIN`, which matches the other resolvers. The site-config test no longer lists `''` as rejected and adds an "empty means unset" test. Malformed non-empty values still throw.
- **Files modified:** apps/web/src/lib/site-config.js, apps/web/src/lib/site-config.test.ts
- **Commit:** 06126b8

**2. [Rule 3 - Blocking] Prettier wrapped the eslint ignores array** after `'**/build-configured/'` was added. I reformatted it, and the content matches the plan.

**3. Order gate string:** the existing "quality runs check, lint and unit before the build" test looked for `run: pnpm --filter web build`, which no longer exists. I changed it to `run: pnpm run build:${{ matrix.target }}`. The test still checks the same ordering.

## Known Stubs

None.

## Handoffs

- Specs that touch forms, the contact email or analytics should branch on `siteEnv(test.info().project.name)`. Configured-state specs go in `*.configured.spec.ts` and run only on the `configured` project. To assert on beacons, call `POST {collector}/__beacons/reset` first, then read `GET {collector}/__beacons` and check that no entry has `preflight: true`.
- The collector record is in-memory and shared across workers. Configured specs that assert on beacons should run serially or filter entries by body or website id.

## Self-Check: PASSED

- FOUND: apps/web/tests/e2e/site-env.ts, apps/web/tests/e2e/harness.configured.spec.ts
- FOUND: commits f9d8069, 06126b8
