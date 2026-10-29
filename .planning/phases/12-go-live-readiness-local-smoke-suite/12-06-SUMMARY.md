---
phase: 12-go-live-readiness-local-smoke-suite
plan: 06
subsystem: testing
tags: [smoke, playwright, fail-closed, gpc, network-monitor, orchestrator]
requires:
  - phase: 12-02
    provides: rewritten history + commit-msg hygiene hook
provides:
  - parseSmokeEnv fail-closed env gate (apps/web/tests/smoke/env.js)
  - playwright.smoke.config.ts (retries 0, failOnFlakyTests, forbidOnly, 300 s globalTimeout, no server block)
  - smoke fixtures: test (GPC on + read-only monitor), testGpcOff, expect, smoke, PROVIDER_ORIGINS
  - scripts/smoke.mjs (localTargets, readStamp, staleBuilds, waitForVersion, httpGet + CLI)
  - pnpm smoke / pnpm smoke:local
affects: [12-08, 12-09, 12-10]
tech-stack:
  added: []
  patterns:
    - "Smoke config gate runs parseSmokeEnv(process.env) at config load, before defineConfig"
    - "Provider deny-list derived from the CSP oracle CONNECT export (no third host list)"
    - "Typed .d.mts beside an untyped .mjs oracle so svelte-check consumers do not type-check the whole oracle"
key-files:
  created:
    - apps/web/tests/smoke/env.js
    - apps/web/tests/smoke/fixtures.ts
    - apps/web/playwright.smoke.config.ts
    - scripts/smoke-env.test.ts
    - scripts/smoke.mjs
    - scripts/smoke.test.ts
    - scripts/assert-csp.d.mts
  modified:
    - package.json
key-decisions:
  - "scripts/assert-csp.d.mts types the oracle's exports so fixtures.ts can import CONNECT under svelte-check (checkJs strict) without 35 implicit-any errors from the oracle body"
  - "extraHTTPHeaders overridden with a plain value ({ 'Sec-GPC': '1' }); the [value, { option: true }] tuple does not typecheck for a built-in option"
  - "smoke.mjs exit codes: 0 ok, 1 suite failed, 2 precondition, 3 version not propagated, 4 over the 5-minute budget; waitForVersion returns 'ok'|'timeout' and never exits"
requirements-completed: []
duration: 25min
completed: 2026-10-29
---

# Phase 12 Plan 06: Smoke Harness Summary

**Fail-closed smoke harness: parseSmokeEnv gate loaded by a zero-retry/fail-on-flaky Playwright config, GPC-by-default fixtures with a provider-abort + read-only teardown monitor, and the scripts/smoke.mjs orchestrator behind `pnpm smoke` / `pnpm smoke:local`.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-10-29
- **Tasks:** 3
- **Files:** 7 created, 1 modified

## Accomplishments

- `parseSmokeEnv` rejects a missing/non-URL/non-https/slashless base, flagless loopback http, `SMOKE_ALLOW_HTTP` other than exactly `'1'`, a non-40-hex version, an unsafe `SMOKE_SITE_URL` and a malformed `SMOKE_ANALYTICS_HOST` (28 tests).
- Smoke config throws at load before any test is listed. CLI proof (wave-3 safe, no browser):
  - `SMOKE_BASE_URL= ... playwright test -c playwright.smoke.config.ts --list` -> exit 1, `Error: SMOKE_BASE_URL is required (the deployed origin + base path, with a trailing slash)`
  - `SMOKE_BASE_URL=http://example.com/ SMOKE_EXPECT_VERSION=<HEAD> ... --list` -> exit 1, `Error: SMOKE_BASE_URL must be https:// (http only for loopback with SMOKE_ALLOW_HTTP=1) (got "http://example.com/")`
- Fixtures: auto `monitor` records every request, aborts every provider origin (CONNECT minus `'self'`), and at teardown fails on provider hits, any non-GET/HEAD beyond `beaconBudget` (default 0), and any `x-api-key`/`authorization`/`x-goog-api-key`/`anthropic-api-key` header. `test` adds `Sec-GPC: 1` + `navigator.globalPrivacyControl`; `testGpcOff = withMonitor`.
- `scripts/smoke.mjs`: per-target base/site/analytics URLs from `targetEnv` + `resolveSiteOrigin`/`resolveBasePath`/`resolveAnalytics`; stale/missing stamp gate (exit 2, `rebuild: pnpm build:<name>`); serve-pages lifecycle via stdin end; version.json poll (30 s local, 10 min remote, exit 3); Playwright via the pinned pnpm with `--fail-on-flaky-tests`; per-target and total timing with the 300 s budget (exit 4). Remote CLI fail-closed verified: missing env -> 2, http base -> 2, bad `--target` -> 2. 11 unit tests; `staleBuilds` mutation (`if (false)`) fails 2 of 3 of its tests.

## Task Commits

1. **Task 1: Fail-closed env gate and smoke Playwright config** - `31991ff` (feat)
2. **Task 2: GPC-by-default fixtures with the read-only network monitor** - `9e6987f` (feat)
3. **Task 3: scripts/smoke.mjs orchestrator and the smoke scripts** - `e993844` (feat)

## Verification

- `corepack pnpm vitest run --project scripts scripts/smoke-env.test.ts scripts/smoke.test.ts`: 39 passed
- `corepack pnpm check` (under build lock): web 3245 files 0 errors, extension 0 errors
- `corepack pnpm lint`: green
- `corepack pnpm test:unit`: 347 files, 6760 tests passed
- Acceptance greps: `webServer` 0, `failOnFlakyTests: true` 1, `retries: 0` 1, `testGpcOff = withMonitor` 1, `'Sec-GPC': '1'` 1, `globalPrivacyControl` 1, `CONNECT` 3, `api.rentcast.io` 0, interaction calls 0, bare `fetch(` in smoke.mjs 0, `verify` includes smoke = false
- No commit message mentions an assistant; no trailer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Importing the CSP oracle broke svelte-check**
- **Found during:** Task 2
- **Issue:** `fixtures.ts` importing `CONNECT` from `scripts/assert-csp.mjs` pulled the untyped oracle into the apps/web program (allowJs + checkJs + strict): 35 implicit-any errors.
- **Fix:** added `scripts/assert-csp.d.mts` declaring all nine oracle exports (same pattern 12-04 used for `site-config.d.ts`). The oracle stays the single host list; no runtime change.
- **Files:** scripts/assert-csp.d.mts
- **Commit:** 9e6987f

**2. [Rule 1 - Bug] extraHTTPHeaders option tuple did not typecheck**
- **Found during:** Task 2
- **Issue:** `[{ 'Sec-GPC': '1' }, { option: true }]` is not assignable for a built-in option.
- **Fix:** plain value override `extraHTTPHeaders: { 'Sec-GPC': '1' }` (equivalent behaviour, avoids an empty destructuring pattern).
- **Commit:** 9e6987f

### Process notes

- TDD tasks (1, 3): tests and implementation were committed together per task rather than as separate RED/GREEN commits; the `staleBuilds` behaviour was mutation-checked instead.
- Per the plan, no build, no real Playwright run and no `smoke:local` invocation happened in this wave; the first real run is 12-08.

## Known Stubs

None. No `*.smoke.ts` spec files exist yet by design (12-08 / 12-09).

## Next Phase Readiness

- 12-08/12-09 write `apps/web/tests/smoke/*.smoke.ts` importing `test`/`expect`/`smoke` from `./fixtures`; analytics.smoke.ts uses `testGpcOff` and `test.use({ beaconBudget: 1 })`.
- 12-10 adds `pnpm smoke:local` to `verify` (after `test:e2e`, before the `ext:*` tail).
- If an export is added to `scripts/assert-csp.mjs`, add it to `scripts/assert-csp.d.mts`.

## Self-Check: PASSED
