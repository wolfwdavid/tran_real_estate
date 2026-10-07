---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 27
subsystem: data-shell
tags: [gap-closure, sc5, rentcast, saved-search-alerts, data-shell, playwright, mutation-check]

# Dependency graph
requires:
  - phase: 04 (data layer)
    provides: DataShell check-on-open pass (checkSavedSearchesOnOpen), DueSearchesDialog, scheduler lock and claim
  - phase: 08-26
    provides: agent-no-rentcast keyless tripwire walk, isAgentCrm status-bar gate in the (app) layout
provides:
  - "DataShell runAlerts prop (default true): the check-on-open pass starts once per mount at the first point where start() has resolved and runAlerts is true"
  - "Once-per-mount alertsClaimed latch; withdraw-on-leave of a waiting DueSearchesDialog (settled as declined, no announcement)"
  - "(app) layout passes runAlerts = !isAgentCrm(page.route.id), so one predicate drives both the status bar and the alerts gate"
  - "tests/e2e/agent-live-key.spec.ts: live key with 2 or 5 due saved searches; zero RentCast requests and no dialog over the agent portal (full loads and client-side nav); the first Renter arrival checks once; Back withdraws a waiting dialog unspent"
  - "DataShell runAlerts gate component tests A-F (D extended with a declined-then-toggle leg)"
affects: [phase 8 re-verification (SC5), Phase 9 agent studio (keeps the pass: isAgentCrm excludes /agent/studio/)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A spend may start from $effect only through untrack() into a synchronous once-per-mount latch; the latch, not the effect, is the spend guard"
    - "Negative E2E assertions use a quiet window that a recorded mutation run proves long enough"

key-files:
  created:
    - apps/web/tests/e2e/agent-live-key.spec.ts
  modified:
    - apps/web/src/lib/features/shared/data/DataShell.svelte
    - apps/web/src/lib/features/shared/data/testing/DataShellHarness.svelte
    - apps/web/src/lib/features/shared/data/DataShell.browser.test.ts
    - apps/web/src/routes/(app)/+layout.svelte

key-decisions:
  - "Check-on-open is still once per DataShell mount; runAlerts only decides when in the mount it may start. Opening on an agent CRM page defers it to the first client-side arrival at a non-agent (app) route"
  - "Leaving for an agent CRM page while the DueSearchesDialog is still asking settles it as declined (nothing spent, asked again next open) without the DUE_DECLINED announcement; an already-confirmed pass runs to the end"
  - "The no-spend-in-$effect ESLint rule stays enabled: the deferred-start effect only calls the latched startAlerts via untrack"

patterns-established:
  - "Route-scoped spend gates live in the (app) layout and reuse isAgentCrm as the single route predicate"

requirements-completed: [AGT-04, AGT-05]

# Metrics
duration: 28min
completed: 2026-10-07
---

# Phase 8 Plan 27: Agent RentCast isolation with a live key (SC5 gap closure) Summary

**DataShell's check-on-open saved-search pass now waits behind a `runAlerts` prop that the (app) layout turns off on agent CRM routes. A live-key E2E proves the agent portal makes zero RentCast requests and shows no DueSearchesDialog, and that the first Renter arrival runs the check exactly once.**

## Performance

- **Duration:** about 28 min
- **Started:** 2026-10-07T07:16Z
- **Completed:** 2026-10-07T07:44Z
- **Tasks:** 3 (Task 3 was verification only, plus two test-hardening commits)
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Closed the 08-VERIFICATION gap (SC5 partial). With a live RentCast key and 2 or 5 due renter saved searches, every agent CRM route spends nothing and shows no dialog, on both bases, over full loads and client-side nav. The searches stay unclaimed (lastRunAt and claimedAt null).
- Sessions that open on renter, investor or settings behave as before: the pass starts from the onMount boot right after start() resolves.
- Both mutation checks went red, and both files were restored byte-identical.

## Decided semantics as implemented

1. `runAlerts?: boolean` on DataShell, default `true`. The (app) layout passes `runAlerts = $derived(!isAgentCrm(page.route.id))`, the same predicate as `showStatusBar`. It is false on `/agent/` and the CRM sub-routes. It is true on renter, investor, settings, `/agent/studio/*` and unmatched routes.
2. `runtime.start()` still runs on mount on every route. Only the saved-search pass is gated.
3. `startAlerts()` returns early if `alertsClaimed || destroyed`. Otherwise it sets `alertsClaimed = true` synchronously, then runs the unchanged pass body (progress, `run`, alertResult, the live/sample announcement rule). `boot()` sets `started = true` after `stop = cleanup` and calls `startAlerts()` if `untrack(() => runAlerts)`. A deferred-start `$effect` calls `untrack(startAlerts)` when `started && runAlerts`.
4. Withdraw `$effect`: when `runAlerts` is false and `answer` is non-null (the dialog is waiting), it sets `dueOpen = false` and calls `settleDue(false)`. A confirmed pass has `answer === null` and keeps running.
5. A full load of an `/agent/*` URL is a fresh mount that starts with runAlerts false, so it never runs a pass.
6. The header comment records the 04-07 justification: the latch is the spend guard, and the effect only calls `startAlerts` through untrack. No `eslint-disable` was added.

## Task Commits

1. **Task 1 RED: failing runAlerts gate tests** - `ef55f85` (test)
2. **Task 1 GREEN: gate the check-on-open run behind runAlerts** - `79ebc30` (fix)
3. **Task 2: layout wiring + agent-live-key E2E** - `6860597` (fix)
4. **Task 3 hardening: fail agent-live-key directly on a dialog over an agent page** - `11caae5` (fix)
5. **Task 3 hardening: latch-only toggle leg in Test D** - `5386df6` (test)

## Test results

**RED (before the DataShell change):** Tests A, B, C, D and E failed. F passed: the old code also runs exactly once on mount, so F cannot fail before gating exists. It guards the boot/effect race after gating.

**GREEN and regression (final tree, rebuilt after both restores):**

| Command | Result |
|---|---|
| `pnpm check` | 0 errors, 0 warnings (2510 files) |
| `pnpm lint` | exit 0 |
| `pnpm banned` | passed (342 files) |
| `pnpm ui:guard` | passed (79 files) |
| vitest web-browser: DataShell + rerender + DueSearchesDialog | 3 files, 36/36 |
| vitest web: alerts + scheduler + runtime | 3 files, 47/47 |
| vitest web (Task 1 verify, + saved-search-repo) | 4 files, 60/60 |
| vitest scripts: agent-boundary | 8/8 |
| `build:root`, `build:sub` | exit 0 (from the clean tree, after the mutant restores) |
| `csp:assert` | 32 pages per build, both pass |
| Playwright (a) agent-live-key + agent-no-rentcast | 6 passed (3 root, 3 sub) |
| Playwright (b) data-status + renter-saved | 22 passed (11 root, 11 sub) |
| Playwright (c) agent-shell + agent-entry | 52 passed (26 root, 26 sub) |

agent-live-key: 2/2 on root and 2/2 on sub, both in Task 2 and in the regression run. All Playwright runs used `--workers=1` on one core. No spec needed `test.slow()`; agent-live-key keeps the plan's `timeout: 120_000` describe config.

**Announcement observed for 404 answers:** "Checked 2 saved searches. Nothing new." (`dueDone(2, 0)`), exactly the plan's text. No wording differed from the plan. The spec also asserts the plan's dialog heading "Check 5 saved searches for new listings?" and the DUE_DECLINED line "Saved searches weren't checked. Tran will ask again next time you open it." verbatim.

## Mutation checks

1. **E2E mutant:** `<DataShell {showStatusBar} runAlerts={true}>` in the (app) layout, then `build:root` and `agent-live-key --project=root`. **Both tests red.**
   - First run: Test 1 failed on `agent pages must never call RentCast` (44 recorded calls). Test 2 failed, but only on a 120 s click timeout: the mutant's modal dialog over the agent page blocked the Agent tools nav click. To make Test 2 fail on the dialog itself, `walkAgent` now waits a 1.5 s quiet window after the full-load leg and asserts `alertdialog` count 0 (commit `11caae5`).
   - Re-run on the same mutant: Test 1 red on `calls != []` (86 calls). Test 2 red on `DueSearchesDialog on an agent page` (expected 0, received 1).
   - Restored with `git checkout`; `cmp` against a pre-mutation copy was byte-identical.
2. **Unit mutant:** dropped `alertsClaimed ||` from the startAlerts guard.
   - First run: 2 red. Test E failed (the withdrawn dialog asks again on the next true), and so did the pre-existing "5 due: DueSearchesDialog, progress label, then one Nothing new announcement" (the boot and effect paths both start a pass).
   - Tests C and F stayed green under this mutant. With 2 due, the scheduler's own guards already stop a second spend: the first pass marks the searches run, and the tran-alerts lock makes a racing pass return 'busy'. So those two tests cannot see the latch on its own.
   - To get a toggle test that the latch alone guards (must-have truth 6), Test D now presses Not now and then toggles runAlerts four times. It asserts no dialog, exactly one DUE_DECLINED and 0 calls (commit `5386df6`).
   - Re-run under the mutant: 3 red (D, E and the 5-due check-on-open test). Unmutated: 22/22.
   - Restored with `git checkout`; `cmp` was byte-identical.

## Files Created/Modified

- `apps/web/src/lib/features/shared/data/DataShell.svelte`: runAlerts prop, startAlerts latch, deferred-start and withdraw effects, updated header comment
- `apps/web/src/lib/features/shared/data/testing/DataShellHarness.svelte`: `runAlerts` prop (default true) passed through
- `apps/web/src/lib/features/shared/data/DataShell.browser.test.ts`: `mount()` gains `runAlerts`; new `DataShell runAlerts gate (08-27, SC5)` describe with Tests A-F
- `apps/web/src/routes/(app)/+layout.svelte`: `runAlerts = $derived(!isAgentCrm(page.route.id))`, comment extended
- `apps/web/tests/e2e/agent-live-key.spec.ts`: new, 166 lines

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The agent-live-key Test 2 caught the mutant only through a click timeout**
- **Found during:** Task 3, mutation 1
- **Issue:** With runAlerts forced on, Test 2 failed at a click blocked by the modal dialog (120 s timeout), not on a visible alertdialog as the plan requires.
- **Fix:** After the full-load leg, walkAgent now waits a 1.5 s quiet window and then asserts the alertdialog count is 0.
- **Files modified:** apps/web/tests/e2e/agent-live-key.spec.ts
- **Commit:** 11caae5

**2. [Rule 2 - Missing coverage] Tests C and F could not detect the latch on its own**
- **Found during:** Task 3, mutation 2
- **Issue:** The plan expected C and/or F to go red without the latch. Both stay green because the scheduler's claim and lock also block a second spend with 2 due. The mutant was still red (Test E and an existing test), but no toggle test proved "toggling never starts a second pass" by the latch alone.
- **Fix:** Test D gets a Not now, then a toggle leg. With the latch removed, the dialog asks again.
- **Files modified:** apps/web/src/lib/features/shared/data/DataShell.browser.test.ts
- **Commit:** 5386df6

**Total deviations:** 2 auto-fixed, both test hardening. Production code is exactly as planned.

## Issues Encountered

- Prettier reformatted the multi-line props destructure in DataShell.svelte to one line before the GREEN commit. Formatting only.
- `gsd-tools roadmap update-plan-progress 8` also ticked `09-10-PLAN.md`, which has no SUMMARY. That line mentions "Phase 8 boundary scope", so the tool matched it by mistake. The tick was reverted by hand; only the 08-27 checkbox and the Phase 8 row (27/27) changed. The tool also left STATE's Current Position at "26 of 26", corrected by hand to 27 of 27.
- Vitest failure screenshots (`__screenshots__`, gitignored) from the RED and mutant runs were deleted. `apps/web/test-results` was removed at the end.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

- SC5 now holds with a live key. Phase 8 is ready for re-verification. The 7 owner UAT items in 08-HUMAN-UAT.md are unchanged.
- Phase 9 `/agent/studio/*` keeps the pass and the status bar, because isAgentCrm excludes it.

## Self-Check: PASSED
