---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 15
subsystem: ui
tags: [svelte5, call-meter, gateway-error, copy, a11y, axe, vitest-browser-svelte]
requires:
  - "04-02: @tran/core/budget meterState, PLAN_LIMIT, OVERAGE_USD, formatCount, formatMonthDay, formatUsd"
  - "04-03: @tran/core/request GatewayError taxonomy + backoffMs"
  - "04-08: web-browser Vitest project, axeViolations, $app/paths stub"
provides:
  - "CallMeter.svelte (props used/unbilled/cap/resetsAt/variant/id; full + compact)"
  - "GatewayError.svelte (props error + onTryAgain/onUseSample/onContinuePastCap/onEditSearch/focusOnMount)"
  - "copy/meter.ts: meterHeadline, compactHeadline, compactCount, meterSubline, stateLine, notCountedLine, SCOPE_NOTE, compactStateText, CAP_CAPTION, FREE_PLAN_CAPTION, USAGE_LINK, thresholdAnnouncement"
  - "copy/errors.ts: errorCopy(error) -> { title, body, variant }, ACTION_LABELS, rateLimitAnnouncements, countdownLabel"
affects: [04-19, 04-20, settings RentCast usage section, DataStatusBar, portal phases 6-9]
tech-stack:
  added: []
  patterns:
    - "Icons carry a data-icon attribute so component tests assert icon presence without depending on lucide class names"
    - "announce() spied in browser tests via vi.mock('$lib/components/a11y/announcer.svelte', { spy: true })"
    - "Hash links to Settings use `${resolve('/settings/')}#fragment` with the established eslint-disable-next-line justification, kept on one line"
key-files:
  created:
    - apps/web/src/lib/features/shared/data/copy/meter.ts
    - apps/web/src/lib/features/shared/data/copy/errors.ts
    - apps/web/src/lib/features/shared/data/copy/meter-errors.test.ts
    - apps/web/src/lib/features/shared/data/CallMeter.svelte
    - apps/web/src/lib/features/shared/data/CallMeter.browser.test.ts
    - apps/web/src/lib/features/shared/data/GatewayError.svelte
    - apps/web/src/lib/features/shared/data/GatewayError.browser.test.ts
  modified: []
key-decisions:
  - "CallMeter full variant always stacks its captions (Cap {C} first, then Free plan: 50) instead of measuring overlap; captions are margin-clamped so they never overflow at 375px"
  - "In the full OK state the Gauge icon sits beside the sub-line (OK has no state line); other states put their icon on the state line"
  - "GatewayError countdown runs in an $effect keyed only on the error object (everything else untracked), so ticks never re-announce or re-focus; retryInMs undefined falls back to core backoffMs(0) = 2s, 0 means no wait"
  - "Try again is also disabled while onTryAgain's promise is pending, so a double click cannot spend two calls"
requirements-completed: [DATA-02, DATA-05]
metrics:
  duration: 10min
  completed: 2026-10-05
  tasks: 3
  files: 7
---

# Phase 4 Plan 15: CallMeter and GatewayError Summary

**Usage meter (full + compact) driven by core `meterState`, and an 8-variant gateway error panel with a never-auto-retrying 429 countdown, every string verbatim from 04-UI-SPEC and axe-clean in every state.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-10-05T11:09Z
- **Completed:** 2026-10-05T11:19Z
- **Tasks:** 3 (all TDD, RED then GREEN)
- **Files:** 7 created

## Accomplishments

- `copy/meter.ts` and `copy/errors.ts`: every meter, threshold, error, action and countdown string lives once, numbers via `formatCount`, dates via `formatMonthDay`, the $0.20 price via `formatUsd(OVERAGE_USD)`. 16 Node tests.
- `CallMeter.svelte`: `div[role=group]` named by its headline, decorative `aria-hidden` track/fill/markers, fill colour per state (`bg-secondary` / `bg-primary` / `bg-destructive`), width `U / max(50, C, U)`, no transition, cap marker plus a free-plan marker when C > 50, state icons (Gauge / CircleAlert / CirclePause / CircleAlert destructive), not-counted line only when unbilled > 0, scope note always. Compact row: icon, "RentCast calls: **U of 50** this month", 96px track, "Cap C", state word, "Usage and cap" link to `/settings/#rentcast-usage`. 18 browser tests incl. axe for all 8 renders.
- `GatewayError.svelte`: `<section>` labelled by a `tabindex="-1"` title, neutral treatment for NoResults only, destructive left rule otherwise, one icon per variant (5xx uses CircleAlert), the exact UI-SPEC action set per kind, RentCast dashboard as a same-tab link with hidden "(opens external site)". Announces "{title}. {body}" once on mount; 429 shows a disabled "Try again in {s}s" (`aria-live="off"`), announces the wait start and end only, and never calls `onTryAgain` without a click. 39 browser tests incl. axe for all 8 variants.

## Task Commits

1. **Task 1: copy modules** — `1da66f1` (test, RED), `9a339f1` (feat)
2. **Task 2: CallMeter** — `2d143e5` (test, RED), `066cdfd` (feat)
3. **Task 3: GatewayError** — `4f3cfdb` (test, RED), `c31974f` (feat)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Swept-in sibling file on the Task 1 GREEN commit**
- **Found during:** Task 1 commit
- **Issue:** Staging the `copy/` directory picked up 04-16's untracked `copy/cap.ts`.
- **Fix:** Soft-reset my own commit (HEAD was still mine), unstaged `cap.ts`, re-committed only my three files by path. `cap.ts` went back to untracked for 04-16, which has since committed it. Note: my `prettier --write copy/` also ran over `cap.ts` at that moment (formatting only).
- **Commit:** 9a339f1

**2. [Rule 1 - Bug] Width assertion precision**
- **Found during:** Task 2
- **Issue:** Chromium serializes `86.66666666666667%` as `86.6667%`, so an exact string match was wrong.
- **Fix:** Test asserts a `%` unit and `toBeCloseTo(expected, 3)`.

**3. [Rule 1 - Bug] Accessible name of the dashboard link lost its space**
- **Found during:** Task 3
- **Issue:** Svelte trimmed the leading space inside the sr-only span, giving "Open RentCast dashboard(opens external site)".
- **Fix:** Space placed before the icon (same pattern as ProviderKeyCard).

**Total deviations:** 3 auto-fixed. No scope change.

## Verification

- `corepack pnpm vitest run --project web meter-errors`: 16/16
- `corepack pnpm vitest run --project web-browser`: 8 files, 98/98 (run twice for GatewayError/CallMeter: 57/57 both times)
- `corepack pnpm vitest run --project web`: 32 files, 406/406 at the time of the run
- `corepack pnpm lint`: pass; `corepack pnpm guard`: pass; `corepack pnpm ui:guard`: pass
- `corepack pnpm check`: my files clean; the only 3 errors were in 04-14's in-progress `relative-time.test.ts` (another wave-3 plan, not touched)

## Known Stubs

None. Both components are props-driven by design; wiring to ledger/settings stores is owned by later plans (04-19/04-20).

## Notes for Downstream

- Untracked `apps/web/.vitest-attachments/` and other plans' `__screenshots__/` folders appear after failing browser runs; they are not gitignored. Removed my own screenshot folders; left the rest.
- On a 429 the mount announcement and the wait-start announcement are issued back to back; the announcer sets text on the next animation frame, so assistive tech hears the later (wait-start) message.

## Self-Check: PASSED
