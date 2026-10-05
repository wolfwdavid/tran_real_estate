---
phase: 03-local-platform-storage-key-vault-backup
plan: 16
subsystem: testing
tags: [a11y, axe, csp, e2e, playwright, dialogs, app-notice, responsive]
requires:
  - phase: 03-10
    provides: E2E helpers (openSettings, saveKey, fakeKey, announcer)
  - phase: 03-12
    provides: Key security (remember mode, passphrase lock, cooldown)
  - phase: 03-13
    provides: import preview + makeBackup/fileFrom fixtures
  - phase: 03-15
    provides: AppNotice locked + backup variants
provides:
  - apps/web/tests/e2e/settings-a11y.spec.ts (11-state axe matrix, overlay paint, focus, 375px)
  - apps/web/tests/e2e/app-notice-locked.spec.ts (locked-keys notice E2E)
  - csp.spec.ts real-dialog CSP test (existing tests byte-identical)
affects: [03-17 phase verification]
tech-stack:
  added: []
  patterns:
    - "Overlay paint check targets our own data-slot attribute ([data-slot=\"dialog-overlay\"], [data-slot=\"alert-dialog-overlay\"]) rather than bits-ui internals"
    - "context.clock.install for multi-tab timelines (setup tab + newly opened locked tab share the seeded clock)"
key-files:
  created:
    - apps/web/tests/e2e/settings-a11y.spec.ts
    - apps/web/tests/e2e/app-notice-locked.spec.ts
  modified:
    - apps/web/tests/e2e/csp.spec.ts
key-decisions:
  - "Overlay selector uses the shadcn wrapper's data-slot (ours, stable) instead of bits-ui's generated attribute"
  - "No component fixes were needed: every Settings state was axe-clean on the first run on both bases"
requirements-completed: [PLAT-01, PLAT-03, PLAT-04, PLAT-05, PLAT-06]
duration: 25min
completed: 2026-10-05
---

# Phase 3 Plan 16: Settings A11y / CSP Contract Gate Summary

**All 11 UI-SPEC Settings states and the renter backup notice pass axe (WCAG 2.0/2.1/2.2 A/AA) on both bases. The alert and modal dialogs place focus correctly, return it on Escape, and have overlays that actually paint (shown by a mutation test). Settings never scrolls sideways at 375px. The real dialogs, radios and checkbox run under the meta CSP with zero violations and inject no `<style>` elements. The locked-keys notice takes priority over an overdue backup reminder and links to Key security.**

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Settings axe state matrix, overlay paint, 375px | 0292fc6 |
| 2 | Real-dialog CSP check and locked-keys notice E2E | 3e6faab |

## What was built

- **settings-a11y.spec.ts** has 11 tests, each run on root and sub, for 22 results:
  1. Empty Settings.
  2. Keys saved, also re-checked at 375px.
  3. Remember mode with a locked vault in a new tab.
  4. Import preview in Merge.
  5. Import preview in Replace.
  6. Forget all dialog.
  7. Replace all data dialog.
  8. Add a passphrase dialog with the "Use at least 12 characters." error showing.
  9. Change passphrase dialog.
  10. Cooldown countdown after 5 wrong attempts under `page.clock`.
  11. `renter/` with the backup notice (+8 days).
- **Dialog states** check four things:
  - Focus is inside the dialog.
  - Alert dialogs focus the cancel button ("Keep my keys" / "Keep my data").
  - Escape closes the dialog and returns focus to the trigger.
  - The overlay `backgroundColor` is neither `rgba(0, 0, 0, 0)` nor `transparent`.
- **Focus after actions:** choosing a backup file focuses the "Review this backup" heading, and confirming forget-all focuses `#api-keys-heading`.
- **375px:** states 2, 4 and 5 check `scrollWidth <= 375`. The import table wrapper has `tabindex="0"`, is focusable, and has `scrollWidth >= clientWidth`.
- **csp.spec.ts:** 62 lines appended and 0 deleted (`git diff --numstat` gives `62 0`), so the probe test is unchanged. The new test walks this flow and asserts `violations == []` after each step:
  1. Save a key.
  2. Open the Forget all dialog and close it with Escape.
  3. Switch the storage mode to remember, then to tab-only, then back to remember.
  4. Open Add a passphrase, tick and untick the checkbox, then Cancel.

  It also asserts that the `querySelectorAll('style')` count does not change.
- **app-notice-locked.spec.ts:** two tests, each on both bases.
  - The first uses a context-wide clock and seeds an import, remember mode, a key and a passphrase. It then opens a new tab at +8 days on `renter/` and checks:
    - Only "Your keys are locked" renders, with its body copy. The backup notice count is 0 even though the backup is due.
    - axe is clean.
    - The link href is exactly `{base}settings/#key-security`.
    - Clicking the link lands on Settings, which shows the unlock form and no locked region.
    - After unlocking, `renter/` shows the backup notice and no locked notice. Because the backup notice appears once unlocked, the earlier count-0 check is not vacuous.
  - The second checks that the locked notice is `main > :first-child` on renter, investor and agent.

## Verification

- `build:root`, `build:sub` and `csp:assert` pass (14 pages each).
- `playwright test settings-a11y a11y` passes 80/80.
- `playwright test app-notice-locked csp` passes 12/12.
- Full `test:e2e` gives **454 passed, 2 skipped, 0 failed** (2.3 min).
- **Mutation proof:** I changed the alert-dialog overlay from `bg-foreground/60` to `bg-transparent` and rebuilt root. Test 6 then **failed** with "Forget all overlay background". I restored the file (diff empty) and rebuilt root.
- eslint is clean on all three spec files, and `prettier --check` passes on tests/e2e.

## Deviations from Plan

None. The plan was executed as written. axe found no violations, so no component fixes were needed. The overlay attribute chosen after inspection is our wrapper's `data-slot`, not bits-ui's generated attribute.

## Known Stubs

None.

## Self-Check: PASSED
