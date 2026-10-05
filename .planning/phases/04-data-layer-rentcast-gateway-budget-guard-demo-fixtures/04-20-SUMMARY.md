---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 20
subsystem: ui
tags: [svelte5, bits-ui, a11y, axe, vitest-browser, copy]
requires:
  - phase: 04-14
    provides: CostLabel, copy/provenance formatCost, relative-time
  - phase: 04-15
    provides: CallMeter compact variant
  - phase: 04-16
    provides: alert-dialog conventions (CapConfirmDialog pattern)
provides:
  - DataStatusBar (role=region "Data source": hydrating / sample x3 / live / live + alerts-at-cap / partial)
  - KeyTestResult (6 probe outcomes + bad-format)
  - DataSourceChoice (radio group or no-key status line)
  - DueSearchesDialog (confirm before > 3 due saved searches)
  - copy/source.ts (verbatim strings + announcements)
affects: [04-22 (app) layout wiring, 04-23 Settings wiring, Phases 6-9 portals]
tech-stack:
  added: []
  patterns:
    - "Exported `DataStatus` type from DataStatusBar's module script for the layout to build"
    - "SettingsLink {text, hash} copy objects; components build resolve('/settings/') + hash"
key-files:
  created:
    - apps/web/src/lib/features/shared/data/copy/source.ts
    - apps/web/src/lib/features/shared/data/copy/source.test.ts
    - apps/web/src/lib/features/shared/data/KeyTestResult.svelte
    - apps/web/src/lib/features/shared/data/DataSourceChoice.svelte
    - apps/web/src/lib/features/shared/data/DueSearchesDialog.svelte
    - apps/web/src/lib/features/shared/data/DataStatusBar.svelte
    - apps/web/src/lib/features/shared/data/KeyTestResult.browser.test.ts
    - apps/web/src/lib/features/shared/data/DataSourceChoice.browser.test.ts
    - apps/web/src/lib/features/shared/data/DueSearchesDialog.browser.test.ts
    - apps/web/src/lib/features/shared/data/DataStatusBar.browser.test.ts
  modified: []
key-decisions:
  - "Key format errors 'charset' and 'length' share one [D] sentence: \"This doesn't look like a complete RentCast key. Copy it again from RentCast and paste it here.\""
  - "[D] singular forms: alertsSkipped(1) '1 is waiting.', alertsWaiting(1) '1 saved search is waiting…', checkLabel(1) 'Check 1 search', dueDone(1,1) 'Checked 1 saved search. 1 new listing.'"
  - "DueSearchesDialog owns `open` as $bindable (like CapConfirmDialog), closes after onConfirm settles; busy = local pending OR caller progress; focus returns to <main> via onCloseAutoFocus"
  - "DataSourceChoice reverts the radio silently if onChange rejects (caller owns error UI); announces only after onChange resolves"
  - "KeyTestResult ticks its own clock once a minute only when no `now` prop is passed"
patterns-established:
  - "Status bar: full-bleed region (bg + border-b) wrapping a max-w-page gutter container with min-h-11 and flex-wrap rows"
requirements-completed: [DATA-01, DATA-03, DATA-05]
duration: 9min
completed: 2026-10-05
---

# Phase 4 Plan 20: Data Source UI Primitives Summary

**Props-driven DataStatusBar, KeyTestResult, DataSourceChoice and DueSearchesDialog with verbatim 04-UI-SPEC copy, axe-clean component tests for every state.**

## Performance

- **Duration:** ~9 min
- **Completed:** 2026-10-05
- **Tasks:** 3 (TDD, 6 commits)
- **Files created:** 10

## Accomplishments

- `copy/source.ts`: every remaining Phase 4 string (status bar, data source, due searches, key test, announcements), 12 Node tests.
- `KeyTestResult`: six outcomes with their icons and colours (`CircleQuestionMark` for unverified, host in `<code>`), `Tested {relative}` inside `<time>`, bad-format shows the field message with no tested line; never a live region.
- `DataSourceChoice`: fieldset/legend radio group applying immediately and announcing "Showing sample data." / "Showing RentCast data."; no-key and locked states show the status line plus the right Settings link.
- `DueSearchesDialog`: alert-dialog with title, body, partial-fit sentence, `<ul>` capped at 10 + "and {n} more", `<dl>` facts, confirm `Check {k} searches` + `CostLabel` (accessible name "Check 5 searches (5 calls)"), "Checking {i} of {k}…" progress with both buttons disabled, Not now / Escape decline + announce, overlay ignored, focus returns to `<main>`.
- `DataStatusBar`: `role="region" aria-label="Data source"` (no aria-live), hydrating / sample (3 reasons, `bg-accent-surface`, FlaskConical) / live (CallMeter compact, `bg-background`) / alerts skipped at cap (CirclePause + Change your cap) / waiting line.

## Task Commits

1. **Task 1: copy** - `ef2f014` (test, RED), `a1ce212` (feat)
2. **Task 2: KeyTestResult + DataSourceChoice** - `099b72c` (test, RED), `e1ace05` (feat)
3. **Task 3: DueSearchesDialog + DataStatusBar** - `4542f67` (test, RED), `04f8815` (feat)

## Verification

- `vitest --project web-browser`: 12 files / 135 tests pass. `vitest --project web`: 35 files / 451 tests pass.
- `pnpm check` 0 errors, `pnpm lint` clean, `pnpm guard`, `pnpm ui:guard`, `pnpm banned` pass.
- Acceptance greps all present (`role="region"`, `aria-label="Data source"`, `variant="compact"`, the three hashes, no `aria-live`; `CostLabel`/`<dl`/`<ul`; `<code>`/`aria-hidden`; `<fieldset`/`<legend`/`announce(`).

## Deviations from Plan

None in behaviour. Minor notes:
- The DataStatusBar hash literals live in `copy/source.ts` (links are built from `SettingsLink` objects); the component also documents its three link targets in a comment.
- `DataSourceChoice.browser.test.ts` was retyped in the GREEN commit (`vi.fn<...>` instead of an unused `_v` parameter) to satisfy eslint.

## Issues Encountered

- First browser run on a cold Vite cache optimized `@lucide/svelte/icons/circle-question-mark` mid-run and reloaded, failing 2 tests with a Svelte runtime error; the re-run passed. Same class of flake as the bits-ui one 04-16 fixed via `optimizeDeps.include`. Not changed here (config is shared); if CI shows it, add new lucide icon subpaths to `optimizeDeps.include` in `apps/web/vitest.browser.config.ts`.

## Known Stubs

None. The components are intentionally props-driven; 04-22 wires DataStatusBar into the `(app)` layout and 04-23 wires KeyTestResult/DataSourceChoice into Settings.

## Next Phase Readiness

- 04-22 can import `DataStatusBar` and its `DataStatus` type; render above `<AppNotice />`.
- 04-23 passes `KeyTestResult` `{ result, now? }` and `DataSourceChoice` `{ keyState, value, onChange }` per the contract.

## Self-Check: PASSED
