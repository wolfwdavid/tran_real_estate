---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 23
subsystem: settings-data-wiring
tags: [settings, svelte5, runes, key-test, call-meter, cap, data-source, a11y, vitest-browser, tdd]
requires:
  - "04-18 DataRuntime (usage, mode, saveCap, setSourcePreference, testKey, lastRemoteChange)"
  - "04-22 DataShell in the (app) layout (provides and starts the runtime for Settings)"
  - "04-01 platform.registerRentCastKeyTest / onRentCastKeyChange"
  - "04-15 CallMeter, 04-16 CapEditor, 04-20 DataSourceChoice + KeyTestResult, CostLabel"
  - "03-10 Settings section registry, 03-13 Phase 3 key-tester hook + ProviderKeyCard"
provides:
  - "$lib/data: enableRentCastKeyTest(runtime, deps?) and the reactive rentCastKeyTest.current (KeyTestRecord | null)"
  - "runtime.testKey(key?): tests the given key (the vault key) or the current one"
  - "features/shared/data/RentCastUsageSection.svelte: Settings slot 2 (#rentcast-usage)"
  - "Settings: slot 'rentcast-usage' available + mapped; RentCast card 'Test key (0 calls)', KeyTestResult line, section pointer"
affects: [04-24 (settings-data.spec.ts E2E), Phase 5 (AI drafting slot 3 follows the same registry pattern)]
tech-stack:
  added: []
  patterns:
    - "Module-level reactive record (class with a $state field in a .svelte.ts) shared by the hook and the card, reset on key change and on Settings unmount, with a generation guard so a test that finishes after a key change is dropped"
    - "{#key} on the remote cap-change count to remount a form whose input is prefilled once"
key-files:
  created:
    - apps/web/src/lib/data/key-test.svelte.ts
    - apps/web/src/lib/data/key-test.test.ts
    - apps/web/src/lib/features/shared/data/RentCastUsageSection.svelte
    - apps/web/src/lib/features/shared/data/RentCastUsageSection.browser.test.ts
  modified:
    - apps/web/src/lib/data/index.ts
    - apps/web/src/lib/data/runtime.svelte.ts
    - apps/web/src/lib/data/runtime.test.ts
    - apps/web/src/lib/features/shared/settings/ProviderKeyCard.svelte
    - apps/web/src/lib/features/shared/settings/sections.ts
    - apps/web/src/lib/features/shared/settings/sections.test.ts
    - "apps/web/src/routes/(app)/settings/+page.svelte"
    - apps/web/tests/e2e/settings-shell.spec.ts
key-decisions:
  - "The tester calls runtime.testKey(key), not runtime.gateway.testKey(key): the runtime waits for the current gateway (no null gateway before start) and refreshes usage, so a billed 200 probe moves the meter at once"
  - "Phase 3 mapping: a failed format check (no request) is reported to the Phase 3 hook as 'invalid' (KeyTestStatus 'rejected'); a thrown test is 'unverified'. The card renders the precise line from rentCastKeyTest.current, not Phase 3's generic string"
  - "The key test is registered only while Settings is mounted (enable in onMount, cleanup on unmount); the result also clears on unmount"
  - "Test key uses aria-disabled while running instead of disabled: a disabled button drops focus, and the UI-SPEC says focus stays on the button (applies to every provider's Test key button; others have no tester yet)"
  - "The section nav needs no edit: SettingsNav renders the registry, so flipping slot 2 makes 'RentCast usage' the second of six links"
requirements-completed: [DATA-02, DATA-03, DATA-05]
metrics:
  duration: "~13 min"
  completed: 2026-10-05
  tasks: 3
  files: 12
---

# Phase 4 Plan 23: RentCast Usage Section and Test Key in Settings Summary

Settings now has the "RentCast usage" section in second place, with three parts: the full meter, the cap editor and the data source choice. Cap saves and source switches apply at once, are announced, and reach other tabs. The RentCast key card has a "Test key (0 calls)" button through the Phase 3 hook. The result line covers valid, valid-but-counted, invalid, restricted, unverified, rate-limited and bad-format. It lasts until the next test, a key change, or the user leaving Settings, and focus stays on the button.

## Tasks

| Task | Name | Commits |
| --- | --- | --- |
| 1 | RentCast key-test registration and reactive result | c5983dd (RED), f5190fe (GREEN) |
| 2 | RentCastUsageSection | 3d89ab8 (RED), 7c596ca (GREEN) |
| 3 | Settings insertion and RentCast key card | f013622 |

## What the tests prove

**key-test.test.ts (Node, 11 tests), using a real runtime on fake-indexeddb with a fetch spy:**
- Exactly one tester and one key listener are registered, and cleanup removes both.
- 404 gives `valid` at the injected clock with exactly 1 request to api.rentcast.io. 401 gives `invalid` and 403 gives `restricted`.
- The test uses the key it is handed in the `x-api-key` header.
- `'abc def'` records `{ outcome: 'bad-format', formatError: 'whitespace' }`, makes 0 requests and returns `'invalid'` to Phase 3.
- A network throw gives `unverified`.
- A key change resets the result to null. A key change during a test drops that test's result. Cleanup clears it too.
- 200 gives `valid-billed`, writes one `key-test` ledger row, sets `countedTowardCap` to 1, and refreshes `runtime.usage`.
- Sample mode still probes RentCast.
- The port-surface test now requires `enableRentCastKeyTest` and `rentCastKeyTest`, and still rejects `registerRentCastKeyTest`, `onRentCastKeyChange` and every other internal.

**RentCastUsageSection.browser.test.ts (Chromium, 8 tests):**
- Structure: `section#rentcast-usage[aria-labelledby=rentcast-usage-heading]`, the h2, the verbatim intro, then the h3s in order.
- Hydrating shows "Checking this browser…" and no meter. axe is clean.
- Live, with 12 used and a cap of 40: "12 of 50 calls used this month", "Cap: 40 · 28 left…", and the input prefilled with 40. axe is clean.
- Saving 25 calls `saveCap(25)`, after which the meter shows "Cap: 25 · 13 left…" and "Cap saved: 25 calls a month."
- Keyless shows the no-key line, "Add a RentCast key" and no radios. axe is clean. Locked shows "Unlock your keys".
- Choosing Sample data calls `setSourcePreference('sample')`, the mode becomes `chosen`, the radio is checked and the change is announced.
- When another tab changes the cap, both the meter and the input update.

**Mutation runs** (restored afterwards, re-run green):

| Mutation | Result |
| --- | --- |
| Drop the key-change generation guard | "a key change during a test drops that test result" goes red |
| Return the raw `bad-format` to Phase 3 | the bad-format test goes red |
| `{#key 0}` instead of `{#key capEpoch}` | the cross-tab cap test goes red |

**Temporary E2E smoke** (`zz-tmp-0423.spec.ts`, deleted after the run; 04-24 owns the committed `settings-data.spec.ts`). It passed on both the root and sub bases:
- The nav's second link is RentCast usage.
- With a key saved, the card shows "Test key (0 calls)" and the pointer line.
- On 404, the valid line and "Tested just now" appear, the button keeps focus, the live announcer carries the same line, there is exactly 1 request, and axe is clean at 1280.
- 401 shows the invalid line.
- 200 shows the counted line, and the meter moves to "1 of 50".
- At 375px there is no horizontal scroll.

## Verification

- `corepack pnpm vitest run --project web key-test runtime`: 32 passed
- `corepack pnpm vitest run --project web-browser RentCastUsageSection`: 8 passed
- `corepack pnpm test:unit`: 87 files, 1381 tests passed
- `corepack pnpm check` reported 0 errors. `lint`, `ui:guard`, `banned` and `guard` passed.
- `build:root` and `build:sub` succeeded and `csp:assert` passed (14 pages each). These ran under `.tools/build.lock`, which was released.
- `corepack pnpm test:e2e`: **454 passed** (both bases). This includes `settings-a11y.spec.ts` with the new section and the updated `settings-shell.spec.ts`.
- `grep -rn '$lib/data/' apps/web/src/routes` finds nothing. Settings imports only `$lib/data` and `$lib/features/shared/data/*`.
- Nav order: SettingsNav renders `availableSections()`. In `sections.ts`, `rentcast-usage` (line 2 of the registry) sits between `api-keys` and `key-security`, and the E2E checks the six links' text and hrefs in order.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `runtime.testKey` could not test a given key**
- **Issue:** Phase 3's tester hands over the vault key. `runtime.testKey()` only read the platform mirror, and `runtime.gateway` is null until `start()` resolves. That would turn an early click into a false "unverified".
- **Fix:** `testKey(key?: string)` now tests the given key when there is one. The hook calls `runtime.testKey(key)`, which waits for the current gateway and refreshes usage. The change is additive; the existing runtime tests are unchanged and green.
- **Commit:** f5190fe

**2. [Rule 1 - Bug] Test key dropped focus while running**
- **Issue:** Phase 3's button used `disabled={testing}`. Disabling a focused button drops focus, which contradicts "After Test key, focus stays on the button".
- **Fix:** The button uses `aria-disabled={testing}` instead. The handler already ignores clicks while a test runs. The E2E confirms the button keeps focus.
- **Commit:** f013622

**3. [Rule 3 - Blocking] Phase 3 contract tests assumed slot 2 was reserved**
- `sections.test.ts` (Phase 3 + 4 sections are now available) and `settings-shell.spec.ts` were updated. SECTIONS now has six entries with RentCast usage second, and only `ai-drafting` and `getting-started` are still absent from the prerender.
- **Commit:** f013622

**4. Name clash in ProviderKeyCard**
- The `KeyTestResult` component is imported as `RentCastKeyTestResult`, because the card already imports Phase 3's `type KeyTestResult`.

**5. Browser-test CSS shim**
- The same `[data-slot=button|input] { height: 48px }` style that CapEditor's browser test uses was added for axe's target-size rule, because component tests load no CSS. The E2E axe covers the real stylesheet.

**6. Pointer copy as a constant**
- The card pointer is kept verbatim in one constant (`POINTER`) and split at its link words, so the full UI-SPEC sentence appears in the source and the visible text matches it exactly.

## Deferred Issues

- After a free (404) Test key, the usage section's "Not counted" line counts it as "1 searches with no results". `summarize()` counts every 404 row as `noResults`, whatever its intent. Billing is correct. This is logged in `deferred-items.md` with a proposed fix: exclude `key-test` rows from `noResults`.

## Known Stubs

None.

## Self-Check: PASSED
