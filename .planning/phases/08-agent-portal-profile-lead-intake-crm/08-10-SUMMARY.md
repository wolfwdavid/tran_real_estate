---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 10
subsystem: agent-ui-primitives
tags: [agent, shadcn, bits-ui, dropdown-menu, dates, svelte5, primitives]
requires:
  - "08-01 @tran/core/agent/types (Stage, STAGES, STAGE_LABELS)"
  - "Phase 3 label copy-in; Phase 5 popover reconciliation precedent; 04-14 ProvenanceChip sample variant"
provides:
  - "components/ui/dropdown-menu: shadcn-svelte 1.6.1 copy-in reconciled to Phase 2 tokens"
  - "components/sample/SampleChip.svelte (no props; usable from (public) routes)"
  - "features/agent/ui/{NativeSelect,DateField,StageBadge,UndoStatus,EmptyState}.svelte"
  - "features/agent/dates.ts: pad2, localDateOf, todayLocal, parseLocalDate, formatMonDay, formatMonDayYear, formatWeekdayLong, formatActivityTime, relativeDays"
affects: [08-11+ agent UI plans (board Move menu, Today queue, contacts list, contact detail, public inquiry demo)]
tech-stack:
  added: []
  patterns:
    - "Badge-like spans that need text-label + a colour class are written as plain class strings, not through cn(), to dodge the tailwind-merge text-label/text-* collision"
    - "Intl formatters are built per call so the runtime zone (and a test-pinned TZ) is always honoured"
key-files:
  created:
    - apps/web/src/lib/components/ui/dropdown-menu/ (17 .svelte + index.ts)
    - apps/web/src/lib/components/sample/SampleChip.svelte
    - apps/web/src/lib/features/agent/ui/NativeSelect.svelte
    - apps/web/src/lib/features/agent/ui/DateField.svelte
    - apps/web/src/lib/features/agent/ui/StageBadge.svelte
    - apps/web/src/lib/features/agent/ui/UndoStatus.svelte
    - apps/web/src/lib/features/agent/ui/EmptyState.svelte
    - apps/web/src/lib/features/agent/ui/primitives.test.ts
    - apps/web/src/lib/features/agent/ui/dropdown-menu.browser.test.ts
    - apps/web/src/lib/features/agent/ui/testing/MoveMenuHarness.svelte
    - apps/web/src/lib/features/agent/dates.ts
    - apps/web/src/lib/features/agent/dates.test.ts
  modified: []
key-decisions:
  - "SampleChip is its own component in components/sample, not a re-export of Phase 4's ProvenanceChip: that chip lives in features/shared/data, which the (public) inquiry demo may not import (08-02 lint)"
  - "dropdown-menu RadioItem defaults closeOnSelect to true (upstream copy-in sets false) so picking a stage closes the Move menu per UI-SPEC"
  - "Checked radio/checkbox items use aria-checked:font-semibold (bits-ui radio items expose aria-checked, not data-state)"
  - "StageBadge renders the Phase 3 badge shape as a plain span instead of <Badge class=text-foreground>, because cn() would drop text-label"
  - "formatActivityTime normalises ICU's narrow no-break space before AM/PM to a plain space ('Today at 3:42 PM')"
requirements-completed: []
metrics:
  duration: ~20 min
  completed: 2026-10-06
  tasks: 2
  files: 30
---

# Phase 8 Plan 10: Shared agent primitives, dropdown-menu and local dates Summary

Later agent UI plans can now build on ready-made pieces: a token-reconciled `dropdown-menu` for the board's Move menu (radio items, 44px rows, a check and weight 600 on the current stage, fade-only motion), a `SampleChip` that the public inquiry demo can import, labelled 48px `NativeSelect` and `DateField` controls with no `data:` images, a text-only `StageBadge`, a persistent `UndoStatus` and an `EmptyState`. `features/agent/dates.ts` is now the single source of local calendar dates and display formats ("Oct 4", "Sunday, October 4", "Today at 3:42 PM", "5 days ago"). None of it slices UTC.

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 | dropdown-menu copy-in, SampleChip, NativeSelect, DateField, StageBadge | c9b3f69 |
| 2 | UndoStatus, EmptyState, local-date helper, structural and browser tests | cc18084 |

## Token class names (for later plans)

- **dropdown-menu content:** `rounded-lg border border-border bg-popover p-2 text-base leading-[1.6] text-popover-foreground shadow-card-hover min-w-56 max-w-[calc(100vw-2rem)]`, motion `motion-safe:duration-150 motion-safe:data-open:animate-in motion-safe:data-open:fade-in-0 motion-safe:data-closed:animate-out motion-safe:data-closed:fade-out-0`. Defaults: `align='start'`, `sideOffset=4`.
- **Items** (item, radio, checkbox, sub-trigger): `min-h-11 px-4 rounded-md text-base leading-[1.6] font-normal text-foreground data-highlighted:bg-surface`. Radio and checkbox add `pr-12 aria-checked:font-semibold`, with the indicator `Check` `size-4 aria-hidden` at `right-4`.
- **Menu label / group heading:** `px-4 py-2 text-sm leading-[1.4] font-semibold text-muted-foreground`. This uses `text-sm`, not `text-label`, because it goes through cn().
- **SampleChip:** `inline-flex items-center gap-1 rounded-full border border-border-strong bg-accent-surface px-2 py-1 text-label font-semibold whitespace-nowrap text-foreground` + `FlaskConical size-3.5 aria-hidden`, with `data-sample-chip`.
- **StageBadge:** `inline-flex items-center rounded-full bg-surface px-2 py-1 text-label font-semibold whitespace-nowrap text-foreground`, with `data-slot="badge" data-stage={stage}`.
- **NativeSelect / DateField control:** `h-12 w-full min-w-0 rounded-md border border-input bg-card px-4 (select: pr-12 pl-4 appearance-none) text-base leading-[1.6] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive`. The label is the Phase 3 `Label`. The chevron is `ChevronDown` 16px `pointer-events-none absolute top-1/2 right-4 -translate-y-1/2`.
- **UndoStatus:** `<p tabindex="-1" data-undo-status class="inline-flex flex-wrap items-center gap-2 text-label text-foreground">` + `CircleCheck` 16 `text-secondary`. Undo is a `min-h-11 min-w-11 ... underline` button.
- **EmptyState:** `mx-auto max-w-[480px] py-12 text-center`, with the title in `font-display text-heading font-semibold`. Actions use `flex-col gap-4 sm:flex-row`, and each child is full width below 640px.

## Component APIs

- `NativeSelect { id, label, value (bindable), options: readonly {value,label}[], invalid?, describedby?, disabled?, onchange?(v) }`
- `DateField { id, label, value (bindable 'YYYY-MM-DD'), invalid?, describedby?, required?, disabled? }`
- `StageBadge { stage }`, `SampleChip` (no props)
- `UndoStatus { message: string | null, onundo?, id? }`: the owner clears it on navigation and moves focus to `id` when needed.
- `EmptyState { icon, title, headingLevel?: 2 | 3, body, children? (actions) }`

## Verification

- `vitest --project web src/lib/features/agent`: 34 passed (dates 8, primitives 11, plus the existing agent tests). `--project web-browser src/lib/features/agent`: 3 passed. `vitest --project web` (full): 114 files, 1810 tests passed.
- `svelte-check` (web): 0 errors and 0 warnings once 08-11's in-flight AgentNav had settled. `packages/core` check failed only on another plan's in-progress `leads/*.test.ts`, which is out of scope. eslint and prettier are clean on every touched file. `banned` passed, and so did `ui:guard` (79 files).
- Acceptance greps: there are 0 `zoom-in|zoom-out|slide-in|bg-secondary|bg-black|dark:|ring-ring/` under `ui/dropdown-menu`, and 0 `data:` in NativeSelect. `new Date('` appears 0 times in dates.ts.
- The TZ pin is honoured in-file. A dedicated test asserts `getTimezoneOffset() === 420` for 2026-10-05, so no per-file environment workaround was needed.
- No build was run, so the build lock was never taken.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tailwind-merge would drop `text-label`**
- **Found during:** Task 1
- **Issue:** The plan's `<Badge class="text-foreground">` and the cn()-wrapped menu labels would lose `text-label`, because twMerge treats it as a text colour.
- **Fix:** StageBadge is a plain span with the badge classes. Menu label, group heading and shortcut use `text-sm leading-[1.4]` instead.
- **Commit:** c9b3f69

**2. [Rule 1 - Bug] Move menu must close on select**
- **Issue:** The upstream radio item defaults to `closeOnSelect = false`, but the UI-SPEC says selecting a stage closes the menu.
- **Fix:** The default is now `true`. A browser test proves that Enter selects, the menu closes and `onmove` fires once.
- **Commit:** c9b3f69 / cc18084

**3. [Rule 2 - Missing critical] Browser test for dropdown-menu keyboard and axe**
- Per the wave guidance, `dropdown-menu.browser.test.ts` (with `testing/MoveMenuHarness.svelte`) covers: aria-checked on the current stage only, a decorative check icon, arrow keys plus Enter to select and close, Escape closing and returning focus to the trigger, and an axe-clean open menu. Tailwind CSS is not loaded in the component project, so the 44px check asserts the `min-h-11` class, not layout height.
- **Commit:** cc18084

**4. [Plan wording] Shadcn CLI invocation**
- `pnpm --filter web exec shadcn-svelte@1.6.1` is not a valid exec target, so I used `pnpm dlx shadcn-svelte@1.6.1 add dropdown-menu --no-deps --yes` from `apps/web`. package.json and the lockfile are untouched.

## Known Stubs

None.

## Self-Check: PASSED
