---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 24
subsystem: ai-ui
tags: [gap-closure, fair-housing, exits, svelte5, flushSync, debounce]
requires:
  - phase: 05
    provides: PanelState / GenerationPanel exits and edit recheck debounce
  - phase: 09
    provides: PlatformCard sections-mode Copy (09-19)
provides:
  - PanelState.checkPending, flushChecks(), emailHref
  - GenerationPanel settle() before every exit, exported flushChecks(), read-only checkPending bindable
  - PlatformCard onCopy that checks the current edit before reading the gate
affects: [09-25 memo Print (binds checkPending / calls flushChecks), every GenerationPanel host]
tech-stack:
  added: []
  patterns:
    - "Exit handlers settle first: flush the pending recheck, then flushSync before reading the gate or moving focus"
    - "Link exits withhold href while a recheck is pending; pointerdown and onclick both settle so the post-dispatch activation sees the checked href"
key-files:
  created:
    - apps/web/src/lib/ai/ui/testing/PanelBindHarness.svelte
  modified:
    - apps/web/src/lib/ai/ui/panel-state.svelte.ts
    - apps/web/src/lib/ai/ui/panel-state.test.ts
    - apps/web/src/lib/ai/ui/GenerationPanel.svelte
    - apps/web/src/lib/ai/ui/GenerationPanel.browser.test.ts
    - apps/web/src/lib/ai/ui/PlatformCard.svelte
    - apps/web/src/lib/ai/ui/PlatformCard.browser.test.ts
    - .planning/phases/09-agent-content-studio-market-snapshot-reports/09-VALIDATION.md
key-decisions:
  - "Every PanelState exit (copy, emailClicked, markSent) calls flushChecks() first; the view adds flushSync so focus targets the post-swap findings title"
  - "The email link has no href while an edit recheck is pending; aria-disabled stays gate-based so the link does not flicker while typing"
  - "GenerationPanel forwards its recheckMs to PlatformCard (cards used the 300 ms default before)"
  - "Test harness renames the `state` prop locally: a binding named `state` shadows the $state rune (store_invalid_shape)"
requirements-completed: [STU-01, STU-02, STU-03]
duration: 18min
completed: 2026-10-13
---

# Phase 9 Plan 24: Exit gating inside the recheck window Summary

**Copy text, Open in email app, Mark as sent and each social card's Copy now run any pending edit recheck on the current text before they read the gate, so a Must-fix phrase typed or pasted in edit mode can no longer leave inside the 300 ms debounce window.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-10-13T14:56:16Z
- **Completed:** 2026-10-13T15:14:38Z
- **Tasks:** 3
- **Files modified:** 8 (1 created)

## Accomplishments

- PanelState: `checkPending` state (set by `setText`, cleared by `recheckNow`, `#run`, `open`), `flushChecks()`, and an `emailHref` getter that is `undefined` while pending or gated. `copy()`, `emailClicked()` and `markSent()` call `this.flushChecks()` first.
- GenerationPanel: one `settle()` helper (flushChecks + flushSync) is the first statement of `onCopy`, `onMarkSent`, `onEmail` and `onEmailKey`, and is the email link's `onpointerdown`. The link uses `href={st.emailHref}` (keeps `role="link"` / `tabindex=0` while it has no href). New `export function flushChecks()` and a read-only `checkPending` bindable for host-owned exits (09-25). `recheckMs` is forwarded to every PlatformCard.
- PlatformCard: `onCopy` sets `checkedEdit = current` (cancelling the debounce) before reading `gated`, ticks before focusing the reason line, and copies `cardPayload(spec, current)`, the exact text that was checked.
- Regression tests: 7 unit tests (PanelState), 8 real-browser tests (GenerationPanel A-G incl. F1/F2), 2 real-browser tests (PlatformCard).

## Task Commits

1. **Task 1: PanelState flushes before every exit**
   - RED `7f14834` test(09-24): add failing tests for exits inside the recheck window
   - GREEN `f8ce4f2` fix(09-24): flush a pending edit recheck before every panel exit
2. **Task 2: GenerationPanel settles first; email href withheld; checkPending bindable**
   - RED `0eb27ed` test(09-24): add failing browser tests for panel exits inside the recheck window
   - GREEN `c1601d8` fix(09-24): settle pending edit checks before GenerationPanel exits
3. **Task 3: PlatformCard Copy checks current text; validation rows; studio E2E**
   - RED `bb44b07` test(09-24): add failing PlatformCard Copy test inside the recheck window
   - GREEN `89258ef` fix(09-24): PlatformCard Copy checks the current edit before reading the gate
   - `4fd432c` docs(09-24): add gap-closure rows to the phase 9 validation map

## TDD and mutation evidence

- **Task 1 RED:** 6 of 7 new tests failed on the old code (Tests 1, 2, 3, 4, 6, 7; Test 3/4 because `emailHref` did not exist, Test 7 because `flushChecks` did not exist). Test 5 (clean edit copies) passed, as it should: the fix must not block clean edits.
- **Task 1 mutation:** deleting `this.flushChecks();` from `copy()` failed Test 1 (copy refuses Must-fix) and Test 6 (new Review phrase voids the ack); restored, 41/41 green.
- **Task 2 RED:** all 8 new browser tests failed before the change (A, D: focus stayed on the textarea; B, C, F1: href present while pending; F2: navigation not prevented; E, G: export/bindable missing).
- **Task 2 mutation:** replacing `settle();` in `onCopy` with a bare `st.flushChecks();` failed Test A with `expected '' to match /-findings-title$/` (focus fell to body because the 0 -> 1 FindingsSummary branch swap removed the focused node). This proves the flushSync is load-bearing. Restored, 10/10 green.
- **Test C path:** the keyboard Enter path worked in Chromium (the in-handler href restore is seen by the post-dispatch link activation); the pointer fallback was not needed.
- **Task 3 RED:** the Must-fix card test failed (the stale gate copied the phrase: `expected [ Array(1) ] to deeply equal []`).
- **Task 3 mutation:** removing `checkedEdit = current;` failed the same test the same way; restored, 3/3 green.
- **recheckMs forwarding:** the existing `edit past the hashtag cap` test (mount `recheckMs: 10`) passes explicitly (`-t "edit past the hashtag cap"`: 1 passed). No timing change was needed.

## Verification run

- `vitest --project web panel-state.test.ts no-auto-send.test.ts`: 64 passed
- `vitest --project web-browser GenerationPanel.browser.test.ts`: 10 passed
- `vitest --project web GenerationPanel.test.ts GenerationPanel.sections.test.ts no-auto-send.test.ts`: 65 passed (SSR email-href tests unchanged)
- `vitest --project web-browser PlatformCard.browser.test.ts GenerationPanel.browser.test.ts`: 13 passed
- `vitest --project web apps/web/src/lib/ai`: 32 files / 643 passed
- `vitest --project web-browser apps/web/src/lib/ai/ui`: 4 files / 33 passed
- `pnpm --filter web check`: 2616 files, 0 errors, 0 warnings
- `eslint apps/web/src/lib/ai/ui`, `prettier --check apps/web/src/lib/ai/ui`, `pnpm lint`: clean
- `pnpm banned`: passed (384 files)
- `pnpm build:root`, then Playwright root: studio-listing 6 passed, studio-reel 7 passed, studio-social 8 passed
- Grep criteria: `this.flushChecks();` x3 in panel-state; `settle();` x4 and `st.flushChecks();` x2 in GenerationPanel; no `location.*` / `window.open(` in GenerationPanel; `cardPayload(spec, text)` gone from PlatformCard; 3 `| 9-24-0` rows in 09-VALIDATION.md

No Node pin was needed: the clock probe passed and no run hit the libuv assertion.

## Decisions Made

- `aria-disabled` on the email link stays gate-based (not pending-based), per plan, so the link does not grey out on every keystroke; the missing href alone prevents opening unchecked text.
- `onEmailKey` only calls `onEmail` when there is still no href after settling; with an href the native click follows and `onEmail` records it once.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Harness prop named `state` shadowed the `$state` rune**
- **Found during:** Task 2 (Test G)
- **Issue:** Destructuring a prop as `state` in PanelBindHarness.svelte made Svelte treat `$state(...)` as a store subscription of `state` (`store_invalid_shape`).
- **Fix:** Destructure as `state: panelState` and pass `state={panelState}`; comment explains why.
- **Files modified:** apps/web/src/lib/ai/ui/testing/PanelBindHarness.svelte
- **Commit:** c1601d8

**2. [Test strengthening] Pending-href precondition in Tests C and F1**
- Tests C and F1 also assert `href` is null right after typing (before activation), which makes them prove the href is restored by the settle inside the handler rather than being present all along. Not a behavior change.

---

**Total deviations:** 1 auto-fixed (blocking), 1 test strengthening. **Impact:** none on scope.

## Issues Encountered

None beyond the harness rune shadowing above.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

- The 09-VERIFICATION.md truth 7 gap is closed for listing, reel and social exits. 09-25 can bind `checkPending` and call `flushChecks()` for the memo Print link.
- Phase 9 re-verification can run once 09-25 lands.

## Self-Check: PASSED

- FOUND: apps/web/src/lib/ai/ui/testing/PanelBindHarness.svelte
- FOUND commits: 7f14834, f8ce4f2, 0eb27ed, c1601d8, bb44b07, 89258ef, 4fd432c
