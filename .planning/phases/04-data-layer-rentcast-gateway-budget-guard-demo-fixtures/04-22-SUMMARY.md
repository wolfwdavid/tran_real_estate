---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 22
subsystem: data-ui-wiring
tags: [svelte5, runes, layout, alerts, scheduler, cap-prompt, announcer, a11y, vitest-browser, tdd]
requires:
  - "04-18 createDataRuntime / setDataRuntime / getDataRuntime, capPrompt, lastRemoteChange"
  - "04-19 runDueSearches, createSavedSearchRepo, browserLock, SchedulerResult, ConfirmInput"
  - "04-16 CapConfirmDialog; 04-20 DataStatusBar, DueSearchesDialog, copy/source.ts"
  - "03-15 AppNotice in the (app) layout; 03-16 notice E2E specs"
provides:
  - "$lib/data: checkSavedSearchesOnOpen(runtime, confirm, deps?), savedSearchRepo(deps?), AlertsDeps; types SchedulerResult, ConfirmInput, LockPort, SavedSearchRepo, SavedSearchInput"
  - "scheduler.ts: optional onProgress(i, k) before each planned search"
  - "features/shared/data/DataShell.svelte: runtime provider + status bar + cap prompt host + on-open check + announcements"
  - "copy/source.ts: CAP_CHANGED_ELSEWHERE"
  - "(app)/+layout.svelte mounts DataShell; the Data source bar is main's first child on portal routes"
affects: [04-23 (Settings uses getDataRuntime under DataShell), 04-24 (Phase 4 E2E specs), Phases 6-9 portals]
tech-stack:
  added: []
  patterns:
    - "Layout shell component with no wrapper element: status bar, then children, then portaled dialogs, so AppNotice and the page stay direct children of <main>"
    - "Promise-backed confirm: the scheduler's confirm() opens DueSearchesDialog and resolves on the user's choice; the dialog's onConfirm awaits the run so it closes when the run settles"
    - "Announcement effects with a silent baseline (meter state) and a seq guard (remote changes)"
key-files:
  created:
    - apps/web/src/lib/data/alerts.ts
    - apps/web/src/lib/data/alerts.test.ts
    - apps/web/src/lib/features/shared/data/DataShell.svelte
    - apps/web/src/lib/features/shared/data/DataShell.browser.test.ts
    - apps/web/src/lib/features/shared/data/testing/DataShellHarness.svelte
    - apps/web/src/lib/features/shared/data/testing/SpendProbe.svelte
  modified:
    - apps/web/src/lib/data/index.ts
    - apps/web/src/lib/data/runtime.test.ts
    - apps/web/src/lib/data/scheduler.ts
    - apps/web/src/lib/features/shared/data/copy/source.ts
    - "apps/web/src/routes/(app)/+layout.svelte"
    - apps/web/tests/e2e/app-notice.spec.ts
    - apps/web/tests/e2e/app-notice-locked.spec.ts
key-decisions:
  - "The status bar is hidden on Settings by route id ('/(app)/settings', as PortalSwitcher does), not by pathname vs resolve('/settings/'): resolve() is relative during prerender, so the path compare put the bar into the prerendered Settings shell"
  - "CapConfirmDialog is opened from a local capOpen flag set when runtime.capPrompt appears, not bound to capPrompt !== null: confirmCapPrompt clears capPrompt at once, which would close the dialog while 'Spending…' is still running"
  - "The on-open check runs in sample mode too (free, fixtures); it announces only when something is new there, and after any run in live mode (UI-SPEC situation table)"
  - "Declined and busy scheduler passes do not feed the status bar's waiting count; only cap waits do"
  - "The port exports checkSavedSearchesOnOpen/savedSearchRepo but still hides runDueSearches, createSavedSearchRepo, createDataDb and getDataDb (port-surface test asserts it)"
requirements-completed: [DATA-01, DATA-02, DATA-03]
metrics:
  duration: "~25 min"
  completed: 2026-10-05
  tasks: 2
  files: 13
---

# Phase 4 Plan 22: DataShell in the (app) Layout Summary

Every portal route now leads with the Data source status bar ("Sample data" or the compact live meter). Any user spend that hits the cap opens the per-call confirm dialog from the layout. Due saved searches are checked once on open: silently for 1-3, after DueSearchesDialog for more than 3, never past the cap (status bar line instead), and free in sample mode. Meter threshold crossings and other-tab cap or source changes are announced politely.

## Tasks

| Task | Name | Commits |
| --- | --- | --- |
| 1 | checkSavedSearchesOnOpen and port exports | f3b74cd (RED), c18b97b (GREEN) |
| 2 | DataShell in the (app) layout | 5bf5edd (RED), 5c3f35f (GREEN) |

## What the tests prove

**alerts.test.ts (Node, 7 tests).** There are two no-op cases that resolve undefined with 0 fetches: the runtime is not started yet, and the mode is rentcast but there is no gateway. With 2 due, both run, nobody is asked, and there are 2 fetches. With 5 due, the user is asked once (run 5, calls 5, cap 40); declining gives `skipped: 'declined'` and 0 fetches. Progress reports (1,5)…(5,5). In sample mode with 5 due, nobody is asked, there are 0 fetches and 0 ledger rows. `savedSearchRepo` can create and list. The port-surface test now requires the two new exports and still rejects `runDueSearches`, `createSavedSearchRepo`, `createDataDb`, `getDataDb` and the other internals.

**DataShell.browser.test.ts (real Chromium IndexedDB, 16 tests):**
- **Hydrating:** shows "Checking data source…" while `start()` is pending.
- **Keyless:** "Sample data", the no-key explanation and `Add a RentCast key` → `/settings/#api-keys`. The bar is `main`'s first element child. Nothing is announced on load, and axe is clean.
- **Status bar off:** with `showStatusBar` false there is no region.
- **Live:** shows the compact meter "2 of 50", and axe is clean.
- **Cap prompt at 1/1:** a click opens "This call goes past your cap" with focus on Not now and 0 fetches. "Spend 1 call anyway" makes exactly 1 fetch and resolves the spend. "Not now" announces "Nothing was spent.", rejects with `dismissed` and makes 0 fetches.
- **5 due:** the dialog opens with 0 fetches. "Check 5 searches (5 calls)" shows "Checking 1 of 5…" while the fetch is held, then closes, makes 5 fetches and announces "Checked 5 saved searches. Nothing new." "Not now" announces `DUE_DECLINED` and makes 0 fetches.
- **2 due:** they run with no dialog and one announcement.
- **At cap with 5 due:** no dialog, 0 fetches, and the bar shows "Saved searches weren't checked because you've reached your cap. 5 are waiting." axe is clean.
- **Sample with 4 due:** no dialog, 0 fetches, and no announcement (the first run is a baseline).
- **Thresholds:** going from 4/10 to 5/10 by a spend announces "5 RentCast calls left before your cap." exactly once. Loading at 5/10 (already near) announces nothing.
- **Other tab:** `cap-changed` announces "Your RentCast cap was changed in another Tran tab." `source-changed` announces "Showing RentCast data." (live) or "Showing sample data." (keyless).

**Mutation runs** (files restored, re-run green):

| Mutation | Result |
| --- | --- |
| Meter baseline starts at `'ok'` instead of `null` | "loading at Near cap announces nothing" goes red |
| `progress={null}` instead of `{progress}` | "5 due: … progress label …" goes red (exactly 1 test after the teardown fix below) |

## Verification

- `corepack pnpm vitest run --project web alerts runtime scheduler`: 46 passed
- `corepack pnpm vitest run --project web-browser DataShell`: 16 passed
- `corepack pnpm test:unit`: 85 files, 1362 tests pass (this includes 04-21's files)
- `corepack pnpm check`: 0 errors. `pnpm lint`, `ui:guard` and `banned` pass.
- `build:root`, `build:sub` and `csp:assert` pass: 14 pages in each build. These ran under `.tools/build.lock`, which was released.
- Prerendered `renter/`, `investor/` and `agent/` contain "Checking data source…". `settings/` and the marketing pages do not.
- `grep -rn '$lib/data' routes/(marketing) routes/(print)` finds nothing. DataShell imports only from `$lib/data` (no subpaths).
- `playwright test app-notice` (root + sub, under the build lock): 16 passed. This includes the updated placement assertions and axe on `renter/` with the locked notice and the sample status bar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Settings detection by pathname vs `resolve('/settings/')` failed in prerender**
- **Found during:** Task 2 build check
- **Issue:** The first build rendered the status bar into `build/settings/index.html`. During prerender `resolve()` returns a relative path, so the comparison never matched. The browser would then remove the bar on hydration (a flash plus a hydration mismatch).
- **Fix:** `showStatusBar = page.route.id !== '/(app)/settings'`, the same route-id matching PortalSwitcher uses. After the rebuild only the 3 portal pages carry the bar. The acceptance grep for `resolve('/settings/')` in the layout therefore no longer matches by design. The comment in the layout explains why.
- **Commit:** 5c3f35f

**2. [Rule 1 - Bug] CapConfirmDialog open state**
- **Issue:** The plan's key link `open={runtime.capPrompt !== null}` would close the dialog the moment `confirmCapPrompt()` takes the parked spend. That happens before the call settles, so the "Spending…" state would vanish mid-call.
- **Fix:** A local `capOpen` flag and the last prompt (`capShown`) are set when `capPrompt` appears. The dialog binds `open` and closes itself when the call settles. `onConfirm` and `onCancel` are still `runtime.confirmCapPrompt` and `runtime.cancelCapPrompt`.
- **Commit:** 5c3f35f

**3. [Rule 3 - Blocking] The scheduler had no progress hook**
- **Issue:** The "Checking {i} of {k}…" label needs per-search progress. `runDueSearches` exposed none.
- **Fix:** Added an optional `onProgress(i, k)` to `SchedulerDeps`. It is called after a successful claim and before the fetch. This is additive; the 18 scheduler tests are unchanged and green.
- **Commit:** c18b97b

**4. [Rule 3 - Blocking] The browser test needs an isolated DataDb outside lib/data**
- **Fix:** One `eslint-disable-next-line no-restricted-imports` with a justification for `createDataDb` from `$lib/data/platform` in `DataShell.browser.test.ts`. The repo already uses justified disables (`no-network.test.ts`). The port does not gain `createDataDb`.
- Added the test-only harness components `testing/DataShellHarness.svelte` (a `<main>` around DataShell) and `testing/SpendProbe.svelte` (a child that calls `getDataRuntime().requestSpend`). These files were not in the plan's file list.

**5. Phase 3 placement assertions updated (planned, recorded here)**
- `tests/e2e/app-notice-locked.spec.ts`: `main > :first-child` must be the Data source region, and `main > :nth-child(2)` must contain "Your keys are locked".
- `tests/e2e/app-notice.spec.ts`: on the portals the notice is `:nth-child(2)` and the first child is the Data source region. On `settings/` (no bar) the notice is still `:nth-child(1)`.

## Notes for later plans

- A sample-mode pass writes snapshots and `lastRunAt` from fixtures. When a user later adds a key, the first live run diffs against a fixture snapshot. That is a 04-19/alerts-UI concern (Phase 6-7 `NewSinceBadge`) and was not changed here.
- If `runtime.start()` rejects (storage blocked), the bar stays on "Checking data source…". Phase 3's storage-blocked handling covers the page. A dedicated bar variant would be a UI-SPEC addition.

## Known Stubs

None.

## Self-Check: PASSED
