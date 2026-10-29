---
phase: 12-go-live-readiness-local-smoke-suite
plan: 09
subsystem: testing
tags: [smoke, playwright, service-worker, third-party, analytics, gpc, read-only-guard]
requires:
  - phase: 12-06
    provides: smoke fixtures (test with GPC on, testGpcOff, beaconBudget, read-only monitor), scripts/smoke.mjs
  - phase: 12-07
    provides: configured target (analytics host http://127.0.0.1:4275)
  - phase: 12-08
    provides: six content-contract smoke specs, first green smoke.mjs --local
provides:
  - four network-contract smoke specs (pwa, assets, third-party, analytics)
  - serve-pages collector answering POST /api/send with 200 application/json
  - scripts/smoke-readonly.test.ts static guard (read-only + single GPC-off spec)
  - full ten-spec smoke suite green on root, sub and configured
affects: [12-10 (smoke:local in verify / full gate)]
tech-stack:
  added: []
  patterns:
    - "GPC-off analytics proof reads the opaque no-cors beacon response via page.route + route.fetch() + route.fulfill({ response })"
    - "Specs import every Playwright type through ./fixtures (Page re-exported) so the static guard can ban @playwright/test in *.smoke.ts"
key-files:
  created:
    - apps/web/tests/smoke/pwa.smoke.ts
    - apps/web/tests/smoke/assets.smoke.ts
    - apps/web/tests/smoke/third-party.smoke.ts
    - apps/web/tests/smoke/analytics.smoke.ts
    - scripts/smoke-readonly.test.ts
  modified:
    - scripts/serve-pages.mjs
    - apps/web/tests/smoke/fixtures.ts
key-decisions:
  - "fixtures.ts re-exports the Page type so specs never import @playwright/test (needed by the swCache helpers; the guard enforces it)"
  - "The guard requires exactly one testGpcOff user outside fixtures.ts, so deleting it from analytics.smoke.ts fails as loudly as adding a second"
  - "Third-party spec runs one test per route (44) for parallelism and named failures"
requirements-completed: [SMOKE-01, SMOKE-02, SMOKE-05]
duration: 17min
completed: 2026-10-29
---

# Phase 12 Plan 09: Network-Contract Smoke Specs Summary

**Service worker (origin, scope, one `tran-shell-<sha>` cache of same-origin paths), all 321 hashed assets 200, zero cross-origin requests on 44 routes, and the single GPC-off spec proving one beacon and a JSON 200 collector, all behind a static read-only guard: the ten-spec smoke suite runs green on root, sub and configured in 70.7 s.**

## Performance

- **Duration:** about 17 min (16:18 to 16:35 local)
- **Tasks:** 3
- **Files:** 5 created, 2 modified

## Timing (final full run, `corepack pnpm smoke:local`, HEAD fea7b80, builds stamped fea7b80)

| Target | Base | Tests | Result | Seconds |
| --- | --- | --- | --- | --- |
| root | http://127.0.0.1:4273/ | 121 | pass | 23.5 |
| sub | http://127.0.0.1:4274/tran_real_estate/ | 121 | pass | 23.2 |
| configured | http://127.0.0.1:4276/ | 121 | pass | 24.1 |
| **total** | | 363 | exit 0 | **70.7** (budget 300) |

Per target: the 72 from 12-08 plus pwa 3, assets 1, third-party 44, analytics 1. Zero retries, `--fail-on-flaky-tests`.

## Accomplishments

- `pwa.smoke.ts`: polls until the one cache is populated; scope equals `smoke.baseUrl`, the script is `<base>service-worker.js` on the page's origin; cache keys equal `['tran-shell-' + smoke.expectVersion]`; every precached URL same-origin, under the base, no dotfile segment, not the worker itself; contains `manifest.webmanifest` and `renter/`; manifest served as `application/manifest+json` with a string `name`.
- `assets.smoke.ts`: filters the precache to `/_app/immutable/` (321 today, asserts > 50), GETs them in concurrent chunks of 25, and expects the non-200 list to be empty.
- `third-party.smoke.ts`: per route in `ROUTES`, 200, `networkidle`, zero requests off the base origin, and at least one same-origin script seen (non-vacuity). GPC is on, so the configured build sends no beacon either.
- `analytics.smoke.ts` (only `testGpcOff` user, `beaconBudget: 1`, `serviceWorkers: 'block'`): on configured, `route.fetch()` passthrough sees exactly one beacon answered 200 `application/json` with an object body; on root/sub, zero cross-origin requests with GPC off.
- `scripts/serve-pages.mjs`: `POST /api/send` answers `200 {"cache":"serve-pages"}` with `content-type: application/json`; still no CORS headers.
- `scripts/smoke-readonly.test.ts`: pure `readOnlyViolations()` over every `.ts`/`.js` under `apps/web/tests/smoke` (recursive). Rules: 9 interactions, 5 writes, 4 banned helper imports (static and dynamic), no `@playwright/test` in specs, every spec imports `./fixtures`, exactly one `testGpcOff` user and it is `analytics.smoke.ts`, `beaconBudget` only in fixtures/analytics. 28 tests (one planted case per rule, a negative control, the real ten-spec tree).

## Task Commits

1. **Task 1: hashed assets, service worker, zero third-party** - `243913d` (test)
2. **Task 2: GPC-off analytics spec + JSON collector** - `108cc5f` (test)
3. **Task 3: static read-only guard** - `fea7b80` (test, TDD: RED 25 failed / 3 passed against a stubbed function, GREEN 28/28)

## Verification

- Task 1: `smoke.mjs --local -- assets pwa third-party` exit 0, 48 per target (53.2 s) on builds stamped b9ada31 (the then-HEAD; the spec files were uncommitted, which does not affect the builds).
- Task 2: `smoke.mjs --local -- analytics.smoke.ts` exit 0 on all three (6.5 s) at 243913d. Mutation: reverting the collector to an empty body made the configured leg fail with `SyntaxError: Unexpected end of JSON input` (exit 1); restored. `playwright test analytics.configured --project=configured` 5/5.
- Task 3 / plan: full `smoke:local` exit 0 at fea7b80 (table above); `vitest run --project scripts smoke-readonly smoke-env smoke` 67 passed; `playwright test --project=configured` 41 passed; `corepack pnpm check` exit 0; `corepack pnpm lint` exit 0; `corepack pnpm test:unit` 349 files, 6802 tests passed.
- Acceptance greps: `'tran-shell-' + smoke.expectVersion` 1; `_app/immutable/` in assets ≥ 1; `networkidle` ≥ 1; `{"cache":"serve-pages"}` 1; `route.fetch()` 1; `serviceWorkers: 'block'` 1; `testGpcOff` only in analytics.smoke.ts among specs; 10 `*.smoke.ts`; no commit body mentions an assistant, no trailer.
- `.tools/build.lock` held for every build and Playwright run, released at the end.

## Requirements

- **SMOKE-02:** the network half (every hashed asset 200, zero third-party requests, worker from the same origin precaching only same-origin paths) is now delivered, so the tick 12-08 set is true. Nothing in SMOKE-02 remains undelivered. The ten-minute version poll lives in `smoke.mjs` (12-06) and only runs in remote mode.
- **SMOKE-01:** read-only is now proved two ways (runtime monitor + static guard); fail-closed env, zero retries, fail-on-flaky and the 300 s budget were in place from 12-06. Proven locally only: no live origin exists yet, so a remote `pnpm smoke` run is still to come after deploy.
- **SMOKE-05:** delivered as above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-exported the `Page` type from fixtures.ts**
- **Found during:** Task 1
- **Issue:** the plan's `swCache(page)` helper needs a `Page` type, but specs may not import `@playwright/test` (Task 3 rule).
- **Fix:** `export type { Page } from '@playwright/test';` in fixtures.ts; specs import it from `./fixtures`.
- **Files modified:** apps/web/tests/smoke/fixtures.ts
- **Commit:** 243913d

Otherwise the plan ran as written.

## Known Stubs

None.

## Build-dir state for 12-10

All three build dirs (`apps/web/build`, `build-sub`, `build-configured`) are stamped `fea7b80` (the Task 3 commit). The docs commit for this SUMMARY moves HEAD, so they are stale for 12-10 by design: rebuild all three before `smoke:local`.

## Self-Check: PASSED

- All five created files present; commits 243913d, 108cc5f, fea7b80 present.
