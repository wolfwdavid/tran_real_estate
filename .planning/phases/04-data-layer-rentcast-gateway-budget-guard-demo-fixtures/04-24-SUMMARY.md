---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 24
subsystem: e2e-data
tags: [playwright, axe, e2e, rentcast-mock, indexeddb-seed, status-bar, key-test, call-meter, cap-dialog]
requires:
  - "04-22 DataShell (status bar, on-open check, DueSearchesDialog)"
  - "04-23 RentCast usage section, Test key, KeyTestResult"
  - "Phase 3 E2E conventions (data-hydrated markers, both bases, axe helper pattern)"
provides:
  - "tests/e2e/helpers/data.ts: blockRentCast, mockRentCast (records calls; unmatched requests abort), saveRentCastKey, saveCap, openSettingsPage, seedLedger, seedSavedSearches, FAKE_RENTCAST_KEY"
  - "tests/e2e/data-status.spec.ts: status bar variants + DueSearchesDialog, axe, root + sub"
  - "tests/e2e/settings-data.spec.ts: RentCast usage section, 6 Test key outcomes, 4 meter states, CapAboveLimitDialog, source choice, axe, root + sub"
  - "runtime: KeyPort.ready(); start() waits for the stored key before resolving the mode"
affects: [Phases 6-9 (portal spend E2E reuses helpers/data.ts), 04-25]
tech-stack:
  added: []
  patterns:
    - "RentCast mocking: a blanket abort route in beforeEach, then a recording mockRentCast route that takes precedence; the call array is asserted for count, path, params and the X-Api-Key header"
    - "Seeding the app DB with raw IndexedDB (open 'tran' with no version) and exact Syncable row shapes, then reload"
    - "Seed due saved searches from the marketing home page (no DataShell), so no (app) page's on-open pass races the seed"
    - "test.use({ reducedMotion: 'reduce' }) where clicks follow scroll-into-view: html { scroll-behavior: smooth } otherwise animates Playwright's scroll and a click can land on a moving target"
key-files:
  created:
    - apps/web/tests/e2e/helpers/data.ts
    - apps/web/tests/e2e/data-status.spec.ts
    - apps/web/tests/e2e/settings-data.spec.ts
  modified:
    - apps/web/src/lib/data/runtime.svelte.ts
    - apps/web/src/lib/data/runtime.test.ts
    - .planning/phases/04-data-layer-rentcast-gateway-budget-guard-demo-fixtures/04-VALIDATION.md
key-decisions:
  - "Fixed a real race the E2E exposed: the runtime resolved its mode before the vault's first key read, so a keyed session started as sample/no-key. The on-open alerts pass then 'checked' every due search against fixtures for free (setting lastRunAt), and the bar flashed Sample data. start() now awaits KeyPort.ready (connectRentCastKey in the app)."
  - "Due saved searches are seeded from the home page, not an (app) page, so the seeding page's own check-on-open pass cannot open a dialog and hold the 'tran-alerts' lock"
  - "Both new specs run with reducedMotion 'reduce' to avoid lost clicks under smooth scrolling. The product CSS is unchanged."
  - "CapConfirmDialog A/B still have no Phase 4 trigger surface; their axe proof stays the 04-16 component test (already recorded in 04-VALIDATION.md manual-only table)"
requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-05]
metrics:
  duration: "~40 min"
  completed: 2026-10-05
  tasks: 2
  files: 6
---

# Phase 4 Plan 24: Phase 4 E2E and Accessibility Proof Summary

The Phase 4 data surfaces are now proven end to end on the built site under both bases (`root` and `sub`), with RentCast fully mocked. The data status bar is covered keyless, live, at the cap, and with the due-search dialog. Settings covers the RentCast usage section, all six Test key outcomes, the four meter states, and the overage cap dialog. Every state passes axe. Writing the specs exposed a real startup race in the data runtime, which is now fixed.

## Tasks

| Task | Name | Commits |
| --- | --- | --- |
| 1 | E2E data helpers and status-bar spec | 8ba765f (plus fix af05ac7) |
| 2 | Settings data spec | 302d6d3 |

## What the specs prove

**data-status.spec.ts (8 tests × 2 bases):**
- **Keyless `renter/`, `investor/`, `agent/`:** the "Data source" region is `main`'s first child. It shows "Sample data" and "The places, people, and numbers here are made up.", and "Add a RentCast key" links to `settings/#api-keys`. axe is clean.
- **`settings/` and home:** there is no Data source region.
- **Live:** with a key saved, the bar shows "RentCast calls:", "0 of 50" and "Usage and cap". axe is clean.
- **At the cap** (cap 1, 1 billed row, 5 due searches): the bar shows "Saved searches weren't checked because you've reached your cap. 5 are waiting." with "Change your cap". There is no dialog and 0 RentCast requests. axe is clean.
- **5 due under cap 40:** the dialog "Check 5 saved searches for new listings?" opens with focus on Not now, and axe is clean on the open dialog. Not now closes it, announces the declined line, and makes 0 requests.

**settings-data.spec.ts (13 tests × 2 bases):**
- **Keyless:** "RentCast usage" is an h2 and the 2nd link in `nav[aria-label="Settings sections"]`. The no-key line and "Add a RentCast key" show, with no radios. axe is clean.
- **Test key (0 calls)**, one test per answer (404, 200, 401, 403, 429, network abort):
  - The exact KeyTestResult line shows (restricted and unverified are matched by prefix), with "Tested just now".
  - Focus stays on the button.
  - Exactly 1 request is made: `https://api.rentcast.io/v1/markets`, `zipCode=00000`, `suppressLogging=true`, `x-api-key` = the fake key, and the key is not in the URL.
  - For 200, the meter moves to "1 of 50 calls used this month".
  - axe is clean in each case.
- **Meter OK / Near / At / Past** (cap set through the editor, or the overage dialog for 60; usage seeded): each shows its UI-SPEC lines, and axe is clean.
- **CapAboveLimitDialog:**
  - Typing 60 and choosing Save cap opens "Allow calls past RentCast's free 50?" with focus on "Keep cap at 40". axe is clean.
  - "overag" gives the field error and the dialog stays open.
  - "Overage" saves: "Cap saved: 60 calls a month." and "Cap: 60 · 60 left…".
- **Data source:** choosing Sample data announces "Showing sample data.". `renter/` then shows "You chose sample data." with "Switch to RentCast". axe is clean.

**No real RentCast traffic:** every test starts with `blockRentCast` (abort all). Mocked tests assert the exact request count. In the specs and helpers, `api.rentcast.io` appears only in route patterns and assertions.

## Verification

- `build:root`, `build:sub` and `csp:assert` pass (14 pages each).
- `corepack pnpm test:e2e`: **496 passed, 2 skipped** across both bases. That is the previous 454, plus 16 from data-status and 26 from settings-data.
- Stability check: `data-status --repeat-each 8` passed 128/128 and `settings-data --repeat-each 4` passed 104/104.
- `corepack pnpm test:unit`: 87 files, 1384 tests pass, including the new runtime test.
- `corepack pnpm check` reports 0 errors, and eslint/prettier are clean on the touched files.
- All builds and E2E ran under `.tools/build.lock`, which was released.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The data runtime chose its mode before the stored RentCast key was read**
- **Found during:** Task 1. The DueSearchesDialog test failed in about 40% of runs. A diagnostic run showed the seeded searches with `lastRunAt` set and 0 RentCast calls.
- **Issue:** `getRentCastKeyState()` returns the mirror synchronously and only starts `connectRentCastKey()`. `runtime.start()` therefore often resolved `sample/no-key` for a session that had a key, and the on-open alerts pass ran in sample mode. It "checked" every due search against fixtures for free and stamped `lastRunAt`, so real saved searches would skip their live check for a day. The status bar also flashed "Sample data".
- **Fix:** `KeyPort` gained an optional `ready()`. The app port wires it to `connectRentCastKey`, and `start()` awaits it before the first rebuild. Ports without `ready()` (the tests) behave as before.
- **Test:** a runtime test holds `ready()` open, checks the mode stays null, then releases it and expects `rentcast/live` with no fixtures loaded. It failed before the fix.
- **Files:** `apps/web/src/lib/data/runtime.svelte.ts`, `runtime.test.ts`
- **Commit:** af05ac7

**2. [Rule 3 - Blocking] Seeding due searches on an (app) page raced that page's own pass**
- **Fix:** the specs seed due searches from the home page, which has no DataShell, then navigate to `renter/`. The reason is documented in `seedFromHome`.
- **Commit:** 8ba765f

**3. [Rule 3 - Blocking] Lost "Save key" clicks under smooth scrolling**
- **Issue:** the trace showed "element is not stable" and "outside of the viewport" retries, and then the click landed while `html { scroll-behavior: smooth }` was still scrolling.
- **Fix:** `test.use({ reducedMotion: 'reduce' })` in both new specs. `openSettingsPage` also waits for the usage meter headline, so the late layout fill has finished before any click.
- **Commits:** 8ba765f, 302d6d3

**4. Helper additions:** `saveCap`, `openSettingsPage`, `FAKE_RENTCAST_KEY` and a `reload` option on the seeders (beyond the plan's list).

## Known Stubs

None.

## Self-Check: PASSED
