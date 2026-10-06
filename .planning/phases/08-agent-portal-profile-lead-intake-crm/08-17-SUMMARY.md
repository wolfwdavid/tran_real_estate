---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 17
subsystem: agent-crm-ui
tags: [crm, smart-lists, url-state, svelte5, components]
requires:
  - "08-09 @tran/core/crm (SMART_LISTS, SMART_LIST_LABELS, isOverdue, isDueToday)"
  - "08-10 SampleChip, features/agent/dates.ts (formatMonDay, relativeDays)"
  - "08-01 @tran/core/agent (Contact, Task, SOURCE_LABELS, isLive)"
provides:
  - "features/agent/crm/list-state.ts: readListParam, readQueryParam, withParams, filterContacts"
  - "features/agent/crm/DueBadge.svelte { task: Task | null; today }"
  - "features/agent/crm/ContactCard.svelte { contact, nextTask, today, variant: 'board'|'list', moving?, actions? }"
  - "features/agent/crm/SmartListFilter.svelte { value (bindable SmartList, default 'all'), counts, onchange? }"
affects: [08 pipeline board, contacts list, today/home pages]
tech-stack:
  added: []
  patterns:
    - "Badge spans are plain class strings (no cn()) so text-label survives tailwind-merge"
    - "Card links: resolve('/agent/contact/') + '?id=' + encodeURIComponent(id), wrapped in an eslint-disable/enable block for svelte/no-navigation-without-resolve"
key-files:
  created:
    - apps/web/src/lib/features/agent/crm/list-state.ts
    - apps/web/src/lib/features/agent/crm/list-state.test.ts
    - apps/web/src/lib/features/agent/crm/DueBadge.svelte
    - apps/web/src/lib/features/agent/crm/ContactCard.svelte
    - apps/web/src/lib/features/agent/crm/SmartListFilter.svelte
    - apps/web/src/lib/features/agent/crm/crm-components.test.ts
  modified: []
key-decisions:
  - "Links under Vitest: resolve() from $app/paths loads in the node project without a mock (base ''), so no contactHref helper module was needed; the test asserts href=\"/agent/contact/?id=c%201\""
  - "withParams returns '' (not '?') when no params remain, so callers can pass pathname + result straight to replaceState"
  - "Phone search compares digit strings only when the query holds 3+ digits, so short numbers inside names or emails never match every phone"
  - "SmartListFilter unpressed buttons are weight 400 outline; pressed is foreground fill, card text, weight 600 and a Check icon, so state is never colour-only"
  - "DueBadge treats a tombstoned task like a done one (renders nothing)"
requirements-completed: []
metrics:
  duration: ~15 min
  completed: 2026-10-06
  tasks: 2
  files: 6
---

# Phase 8 Plan 17: Shared CRM list components Summary

The pipeline, contacts and home pages now share the same tested list pieces: `DueBadge` ("Overdue · Oct 2", "Due today", or muted "Due Oct 9", always with words and an icon for the badges), `ContactCard` (a flat article labelled by its name link to `/agent/contact/?id=`, a last-contact meta line or "Moving…", a due badge, Sample data and No emails chips, and an optional actions snippet for the board's Move menu), `SmartListFilter` (a `role="group" aria-label="Show"` set of four `aria-pressed` toggles with live counts), and pure `list-state` helpers for `?list=`/`?q=` and in-memory search.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | list-state helpers (URL params, search filter) | 164e35a (RED), 0b3ca9d (GREEN) |
| 2 | DueBadge, ContactCard, SmartListFilter with SSR structural tests | 568518d |

## How links are built under Vitest

`ContactCard` calls `resolve('/agent/contact/')` from `$app/paths` directly, as `AgentNav` (08-11) already does. That import loads in the node Vitest project without a mock, and the base is `''` there, so the SSR test asserts `href="/agent/contact/?id=c%201"` (the id is URL-encoded). The plan's fallback `contactHref(id)` helper module was not needed.

## Verification

- `vitest run --project web src/lib/features/agent/crm`: 2 files, 26 tests passed (14 list-state, 12 component).
- `corepack pnpm check`: web svelte-check found 0 errors and 0 warnings across 2396 files, and core and brand tsc are clean.
- eslint is clean on `features/agent/crm`. `banned` passed (291 files), and so did `ui:guard` (79 files).
- `grep -c bg-primary` returns 0 for all three components.
- I made no package.json or lockfile edits.

## Deviations from Plan

1. **[Rule 3] eslint `svelte/no-navigation-without-resolve`.** The rule cannot see that `href` comes from `resolve()`. I wrapped the link in an HTML-comment disable/enable block, following the `(print)/print/memo` precedent.
2. **Non-ASCII literals.** `Moving…` and `Overdue · ` are required verbatim by the acceptance criteria, so those two strings are not ASCII. Investor feature sources already set this precedent.

## Known Stubs

None.

## Self-Check: PASSED
