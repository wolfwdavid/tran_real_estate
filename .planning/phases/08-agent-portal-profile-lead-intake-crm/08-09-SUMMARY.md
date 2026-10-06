---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 09
subsystem: agent-core
tags: [crm, pipeline, tasks, smart-lists, dates, tdd]
requires:
  - "08-01 @tran/core/agent/types (Contact, Task, Activity, Stage, STAGES, STAGE_LABELS, isLive)"
provides:
  - "@tran/core/crm barrel: addDays, isIsoDate, applyMove, ActivityDraft, stageCounts, sortForBoard, TaskCtx, TaskGroups, isDueToday, isOverdue, groupTasks, nextOpenTask, quickDates, COMING_UP_DAYS, COMING_UP_MAX, SMART_LISTS, SmartList, SMART_LIST_LABELS, ListCtx, matchesList, countLists"
affects: [08-web CRM board, today queue, contact detail, smart-list filter]
tech-stack:
  added: []
  patterns:
    - "Local calendar dates as YYYY-MM-DD strings compared lexically; Date.UTC on Y/M/D parts for arithmetic"
    - "Injected `today` and `localDate(iso)`: core never reads the runtime clock or time zone"
key-files:
  created:
    - packages/core/src/crm/dates.ts
    - packages/core/src/crm/pipeline.ts
    - packages/core/src/crm/pipeline.test.ts
    - packages/core/src/crm/tasks.ts
    - packages/core/src/crm/tasks.test.ts
    - packages/core/src/crm/smart-lists.ts
    - packages/core/src/crm/smart-lists.test.ts
    - packages/core/src/crm/index.ts
  modified: []
decisions:
  - "Import form is the barrel `@tran/core/crm`. The existing `./*` -> src/*/index.ts export resolves it, so package.json is unchanged. A deep `@tran/core/crm/<file>` path would need a new `./crm/*` export, which no plan has added."
  - "addDays throws RangeError on a malformed date instead of returning NaN-ish output"
  - "Group ordering: overdue by due date, then contact name, then createdAt. Due today by createdAt. Coming up by due date, then createdAt. Done today by doneAt ascending."
  - "matchesList('due-today') re-checks open and live on each task, so a caller passing an unfiltered map stays correct"
metrics:
  duration: "~15 min"
  completed: 2026-10-06
  tasks: 2
  files: 8
---

# Phase 8 Plan 09: CRM pipeline, task queue and smart lists Summary

This plan adds the pure CRM rules for AGT-04 and AGT-05:

- **Stage moves.** `applyMove` returns the updated contact plus exactly one "Moved from {Old} to {New}" `stage_changed` activity draft, or `null` when the target is the current stage. It does not touch `lastContactedAt`.
- **Board.** `stageCounts` counts live contacts per stage. `sortForBoard` puts contacts with a next open task first, by due date ascending. Ties go to the most recent of `lastContactedAt` (falling back to `updatedAt`), then to name.
- **Due-today queue.** `groupTasks` sorts tasks into Overdue, Due today, Coming up and Done today. Coming up covers today+1 through today+7, capped at 10, with `comingUpMore` holding the overflow count. Done today uses the injected `localDate(doneAt)`.
- **Task helpers.** `nextOpenTask` and `quickDates` (Today, Tomorrow, In 3 days, Next week).
- **Smart lists.** `matchesList` and `countLists` cover All plus the three presets:
  - Due today: an open task due today or overdue.
  - No contact in 7 days: Closed contacts never match. A contact contacted exactly 7 days ago does not match; 8 days ago does. When `lastContactedAt` is null, `createdAt` is used.
  - New this week: a rolling 7 calendar days, including today.
- **Dates.** Calendar math lives in `dates.ts` and uses `Date.UTC` only. It never parses a string with `new Date(...)`, so it is DST-safe.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Calendar math and stage transitions | 27e040a (RED), a5d76f1 (GREEN) |
| 2 | Task grouping and smart lists | bfc5e1a (RED), f83fcaa (GREEN) |

## Verification

- `vitest run --project core packages/core/src/crm`: 3 files, 38 tests passed.
- `tsc --noEmit` reports no errors in `src/crm`. The errors it does print come from sibling RED steps in `src/csv` and `src/disclosure`, which belong to those plans.
- ESLint is clean. All crm sources are pure ASCII. `grep -c "new Date('" dates.ts` returns 0.
- Mutation testing: I applied 24 mutants one at a time and restored the file after each. All 24 were killed.
  - **pipeline:** the no-op guard, the live filter in counts, the due-date sort direction, the recency fallback and the recency direction.
  - **tasks:** overdue `<` changed to `<=`; the open check removed from due today; the horizon `<=` changed to `<`; horizon +1; `localDate` replaced by `slice(0,10)` for done today; the tombstone filter removed; the cap changed to 11; the contact-name tie-break removed; the `nextOpenTask` comparison flipped.
  - **smart lists:** -7 changed to -8; `<` changed to `<=` at the 7-day boundary; `>=` changed to `>` and -6 changed to -7 for new this week; the closed exclusion removed; the `lastContactedAt` fallback removed; `localDate` replaced by `slice` for createdAt; the overdue clause removed; the contact tombstone check removed; the task tombstone check removed.

## Deviations from Plan

1. **[Rule 2] Added `crm/index.ts` barrel.** The orchestrator assigned it to this plan. `@tran/core/crm` resolves through the existing `./*` export, and package.json is unchanged.
2. **[Rule 2] Extra exports.** I added `TaskGroups`, `COMING_UP_DAYS` and `COMING_UP_MAX` so the web UI can say "and {n} more" without hard-coding 10. `addDays` throws on malformed input.
3. **Time-zone test shape.** The smart-list test uses a fixed UTC-4 mapping function rather than a literal lookup table. It asserts that `localDate('2026-10-05T02:00:00.000Z') === '2026-10-04'` and that a contact created at that instant counts as created today. It also checks the window edge, where the UTC date is inside the window but the local date is outside.

## Requirements advanced

AGT-04 and AGT-05 business rules are in place. Per the orchestrator, `requirements mark-complete` was not run.

## Known Stubs

None.

## Self-Check: PASSED
