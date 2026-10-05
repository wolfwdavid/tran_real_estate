---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 16
subsystem: ui
tags: [budget, cap, alert-dialog, typed-confirmation, settings, a11y, vitest-browser, DATA-03]

requires:
  - phase: 04-01
    provides: platform-ui re-exports (AlertDialog, Button, Input, Label, announce)
  - phase: 04-02
    provides: "@tran/core/budget validateCap, matchesOverageWord, confirmVariant, overageCostUsd, formatCount, formatUsd, PLAN_LIMIT"
  - phase: 04-08
    provides: web-browser Vitest project, axeViolations helper
provides:
  - CapConfirmDialog (per-call over-cap confirmation, variant A primary / variant B destructive)
  - CapAboveLimitDialog (typed "overage" confirmation for caps 51..1,000)
  - CapEditor (Monthly call cap form for the Settings RentCast usage section)
  - copy/cap.ts (verbatim cap, confirm and editor strings)
affects: [04-settings-usage-section, 04-gateway-consumers, 06, 07, 08, 09]

tech-stack:
  added: []
  patterns:
    - "Caller-owned alert dialogs with a single cancel() path: Cancel click and Escape both route through it (onEscapeKeydown preventDefaults bits-ui's own close), so onCancel fires exactly once and pending ignores Escape"
    - "Dialogs close when the caller's onConfirm settles (success or failure); the caller renders the result or error"
    - "Save cap uses aria-disabled (not disabled) while pending so focus stays on the button"
    - "Component tests without CSS: restore the 48px control height for axe target-size; outside-click tests use a planted fixed target instead of the (boxless) overlay"

key-files:
  created:
    - apps/web/src/lib/features/shared/data/copy/cap.ts
    - apps/web/src/lib/features/shared/data/CapConfirmDialog.svelte
    - apps/web/src/lib/features/shared/data/CapAboveLimitDialog.svelte
    - apps/web/src/lib/features/shared/data/CapEditor.svelte
    - apps/web/src/lib/features/shared/data/CapConfirmDialog.browser.test.ts
    - apps/web/src/lib/features/shared/data/CapEditor.browser.test.ts
  modified: []

key-decisions:
  - "SAVE_FAILED copy is discretionary [D]: \"Couldn't save your cap. Try again.\" (UI-SPEC gives no failed-write copy)"
  - "Below-usage note shows when used >= new cap (and used > 0): at equality the next call also asks first"
  - "CapEditor's helper falls back to helperWithin(saved cap) while the typed value is invalid"
  - "CapEditor focus after CapAboveLimitDialog closes: Save cap on cancel or success, the cap input after a failed save"
  - "Cross-tab cap broadcast is left to the Settings section that owns writeCap (CapEditor only calls onSave)"

patterns-established:
  - "Over-cap dialogs hold no memory: no 'don't ask again', no session flag; every over-cap call reopens CapConfirmDialog"

requirements-completed: [DATA-03]

duration: 30min
completed: 2026-10-05
---

# Phase 4 Plan 16: Cap UI Summary

**Per-call over-cap confirmation (`CapConfirmDialog`, terracotta within the 50-call plan and destructive past it, naming who bills and how much), a typed-"overage" dialog for caps 51 to 1,000, and the Settings `CapEditor` that saves 1-50 directly. All strings are verbatim UI-SPEC copy in `copy/cap.ts`, and all validation and thresholds come from `@tran/core/budget`.**

## Performance

- **Duration:** about 30 min
- **Completed:** 2026-10-05
- **Tasks:** 2 (TDD, RED then GREEN each)
- **Files:** 6 created

## Accomplishments

- **CapConfirmDialog:** props `{ open, used, cap, onConfirm, onCancel, onCloseAutoFocus? }`.
  - Variant comes from `confirmVariant(used)`. Variant A has a `default` (terracotta) confirm button and variant B a `destructive` one.
  - Body copy matches the UI-SPEC exactly. The `<dl>` fact list holds "Used this month: U of 50", "Your cap: C" and "This action: 1 call" in tabular numerals.
  - Initial focus goes to **Not now**. Escape cancels once and announces "Nothing was spent." Outside clicks are ignored.
  - While the call runs, the button reads "Spending…" with a spinner, both buttons are disabled and Escape is ignored. The dialog closes once the call settles.
- **CapAboveLimitDialog:** props `{ open, value, oldCap, onConfirm, onCancel, onCloseAutoFocus? }`.
  - The input has `autocomplete="off" autocapitalize="off" spellcheck="false"`, and the match uses `matchesOverageWord`.
  - **Set cap to N** (destructive) stays enabled. A miss shows "Type the word overage to confirm, or choose Keep cap at {old}." with `aria-invalid` and moves focus to the input.
  - **Keep cap at {old}** (outline) gets initial focus.
- **CapEditor:** props `{ cap, used, onSave }`.
  - The input is `type="text" inputmode="numeric" pattern="[0-9]*"`, `w-24 tabular-nums`. Its `aria-describedby` points to the helper, plus the error when one shows.
  - The helper updates as you type and switches to the above-plan note at 51 or more.
  - Validation runs on submit only (`validateCap` → `CAP_ERRORS`) and moves focus to the input on an error.
  - A save shows "Saving…", then a saved line with a CircleCheck icon that is also announced. Focus stays on Save cap.
  - The below-usage note appears when it applies. A failed save shows SAVE_FAILED and focuses the input.

## Task Commits

1. **Task 1 RED:** `44da55f` test(04-16): add failing CapConfirmDialog tests
2. **Task 1 GREEN:** `56412a9` feat(04-16): over-cap confirm dialog
3. **Task 2 RED:** `cc07309` test(04-16): add failing cap editor tests
4. **Task 2 GREEN:** `7a9d554` feat(04-16): cap editor with typed overage confirmation

## Verification

- `vitest run --project web-browser CapEditor CapConfirmDialog`: 19/19 passed.
- The full `vitest run --project web-browser`: 8 files and 98 tests passed (including the other wave-3 plans' files at that point).
- `lint` (repo-wide prettier and eslint), `ui:guard` and `guard` all pass.
- `check` reports 0 errors in this plan's files. The only 3 errors are in `relative-time.test.ts`, which belongs to 04-14 and was in progress at the time. I did not touch it.
- Mutation proof for the outside-click test: I flipped `interactOutsideBehavior` to `'close'`. The planted-target test then FAILED, and passed again after I restored it. My first version, which clicked the overlay, passed vacuously, so I replaced it (see deviations).
- Acceptance literals:
  - `copy/cap.ts` contains every required string.
  - `CapConfirmDialog.svelte` contains `confirmVariant(` and `destructive`, and contains neither `window.confirm` nor `confirm(`.
  - `CapEditor.svelte` contains `validateCap(`, `inputmode="numeric"`, `aria-invalid`, `aria-describedby` and `preventDefault`.
  - `CapAboveLimitDialog.svelte` contains `matchesOverageWord(`, `autocomplete="off"` and `spellcheck="false"`.
  - The test file contains `'Overage '`, `'overag'` and `'$2.00 a month'`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test validity] The overlay-click test was vacuous**
- **Found during:** Task 1 (mutation check)
- **Issue:** Component tests load no CSS. The overlay has no box and the dialog content sits at (0,0), so a click "on the overlay" landed inside the content and could never close it.
- **Fix:** The test now clicks a planted `position:fixed` target at the bottom of the viewport. Flipping to `'close'` makes it fail.
- **Commit:** 56412a9

**2. [Rule 3 - Blocking] axe target-size flagged the unstyled layout**
- **Found during:** Task 2
- **Issue:** Without CSS, the input and the Save cap button render 21px tall and touching, so axe's `target-size` fired on a layout the app never shows.
- **Fix:** `CapEditor.browser.test.ts` injects `[data-slot=button],[data-slot=input]{height:48px}`, which is the real `h-12`. The E2E axe runs still cover the full stylesheet.
- **Commit:** 7a9d554

**3. [Rule 2 - Robustness] `onCloseAutoFocus` passthrough on both dialogs**
- Both dialogs accept an optional `onCloseAutoFocus`, so caller-owned dialogs can control where focus returns when there is no trigger. CapEditor uses it to send focus to Save cap or the input.

### Deferred Issues

- **Cold Vite dep-optimizer flake:** the first `web-browser` run after `bits-ui` was newly discovered failed every dialog test with Svelte `effect_orphan`. Vite re-optimized mid-run, so bits-ui got a duplicate Svelte runtime. The second run passed and the problem has not recurred. A fresh CI cache could hit it once. A likely fix is `optimizeDeps.include: ['bits-ui', ...]` in `apps/web/vitest.browser.config.ts`, which is outside this plan's files, so I left it for the orchestrator or 04-08's owner.

## Known Stubs

None. The components are wired to props. Mounting CapEditor in Settings, with `writeCap` and the BroadcastChannel, and calling CapConfirmDialog from gateway `BudgetCapReached` are the consumers' plans.

## Self-Check: PASSED
