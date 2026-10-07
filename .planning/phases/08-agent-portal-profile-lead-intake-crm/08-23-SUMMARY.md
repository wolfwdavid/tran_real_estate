---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 23
subsystem: agent-crm-ui
tags: [crm, contact-detail, tasks, activity-log, opt-out, confirm-dialog, undo, svelte5, dexie, live-query, playwright, axe]

# Dependency graph
requires:
  - phase: 08-12
    provides: contacts-repo (updateContact, findDuplicates, setOptOut, logContact, deleteContact), live.svelte useContact / useActivities
  - phase: 08-14
    provides: tasks-repo deleteTask / restoreTask, tasks-live useTasksFor
  - phase: 08-15
    provides: quick-add validateQuickAdd / duplicateMessage, E2E helpers
  - phase: 08-17
    provides: DueBadge, ContactCard No emails chip styling
  - phase: 08-18
    provides: ContactsView (now reads the delete flash)
  - phase: 08-19
    provides: board-state createBoardState move / undoLast / settle, BOARD_UNDO_ID
  - phase: 08-21
    provides: TaskRow, AddTaskForm, task-ui nextFocusTarget
  - phase: 03
    provides: ConfirmDialog, LiveAnnouncer announce(), Checkbox, Textarea
provides:
  - "features/agent/contact/contact-ui.ts: LOG_TYPES, logAnnouncement, deleteDialogCopy, addedMeta, optOutAnnouncement"
  - "features/agent/contact/ContactHeader.svelte { contact, taskCount, board, onedit, onleaving }: h1, chips, Stage select through board-state, Edit details, Delete contact (ConfirmDialog + cascade + redirect)"
  - "features/agent/contact/ContactInfo.svelte { contact, editing, onclose }: dl with mailto/tel, edit form with duplicate check and opt-out"
  - "features/agent/contact/ContactTasks.svelte { contact, tasks, today }: TaskRows with undoable Delete, AddTaskForm, Done (n)"
  - "features/agent/contact/ContactNotes.svelte { contact }: notes saved on blur and with Save notes, no activity"
  - "features/agent/contact/ActivityLog.svelte { contact, activities }: Log contact form + newest-first <ol reversed>, 20 at a time"
  - "features/agent/crm/flash.svelte.ts: setFlash(message), takeFlash() one-shot message with a 10 s TTL"
  - "/agent/contact/?id= route with not-found block and the <section id=\"follow-up\"> slot for 08-25"
  - "tests/e2e/agent-contact.spec.ts (11 tests x 2 bases)"
affects: [08-25 follow-up composer (fills #follow-up), 08-26 AGT gate (AGT-04 detail-page path, AGT-05 per-contact tasks)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route id read in afterNavigate (fires on mount and on same-route navigations), live views recreated with $derived(id ? useX(id) : null)"
    - "Cross-navigation status via a module-level $state flash with a TTL, never the URL or history"
    - "Keep a deleted record on screen (leaving snapshot) until the redirect so the not-found block never flashes"
    - "Mobile order on a two-column page: flat flex column with order-N, column wrappers are display: contents below lg"

key-files:
  created:
    - apps/web/src/lib/features/agent/contact/contact-ui.ts
    - apps/web/src/lib/features/agent/contact/contact-ui.test.ts
    - apps/web/src/lib/features/agent/contact/ContactHeader.svelte
    - apps/web/src/lib/features/agent/contact/ContactInfo.svelte
    - apps/web/src/lib/features/agent/contact/ContactTasks.svelte
    - apps/web/src/lib/features/agent/contact/ContactNotes.svelte
    - apps/web/src/lib/features/agent/contact/ActivityLog.svelte
    - apps/web/src/lib/features/agent/crm/flash.svelte.ts
    - apps/web/tests/e2e/agent-contact.spec.ts
  modified:
    - apps/web/src/routes/(app)/agent/contact/+page.svelte
    - apps/web/src/lib/features/agent/crm/ContactsView.svelte

key-decisions:
  - "08-23: the contact page reads ?id= in afterNavigate, not onMount, because the duplicate alert's Open {First} link navigates to the same route with another id and onMount would not re-run"
  - "08-23: the delete flash (crm/flash.svelte.ts) expires after 10 s so deleting the last contact (no ContactsView mounts) cannot surface a stale Deleted {Name}. later"
  - "08-23: the detail Stage select reuses createBoardState().move(contact, to, { focus: false }) with the #board-undo UndoStatus; Undo has no card to focus, so focus falls back to that status line"
  - "08-23: Delete contact snapshots the contact (onleaving) before the cascade so the page never shows not-found mid-delete; goto() is not awaited so ConfirmDialog closes first and its close auto-focus is prevented"
  - "08-23: the phone link is href=\"tel:{telDigits}\" (E.164 when it normalizes); svelte/no-navigation-without-resolve rejects an expression href but accepts a literal scheme prefix, like mailto:"
  - "08-23: Save details writes updateContact only when a field changed (no empty Details updated entry) and setOptOut only when the box changed; a save without an opt-out change announces Details saved. (not in the UI-SPEC table; added so the save is never silent)"

patterns-established:
  - "Contact page: one board-state per page for stage moves outside the board"

requirements-completed: [AGT-04, AGT-05]  # advanced here; left open in REQUIREMENTS.md until the 08-26 gate (Phase 8 convention)

# Metrics
duration: 25 min
completed: 2026-10-07
---

# Phase 8 Plan 23: Contact detail page Summary

**`/agent/contact/?id=` is now a full contact record: the name as h1 with stage, Sample data and No emails chips, a Stage select that moves through the pipeline's own move/undo path, editable details with the quick-add duplicate check and an email opt-out, per-contact tasks (quick-set dates, complete, undoable delete), private notes, a Log contact form with a newest-first activity log, and a confirmed cascade delete that returns to Contacts with a focused "Deleted {Name}." line, proven by Playwright on both bases.**

## Performance

- **Duration:** 25 min (two stages: implementation, then builds + E2E once the shared build directory was handed over)
- **Started:** 2026-10-07T02:51:34Z
- **Completed:** 2026-10-07T03:16:29Z
- **Tasks:** 3 of 3
- **Files modified:** 11 (9 created, 2 modified)

## Accomplishments

- **Copy helpers (Task 1, TDD):** LOG_TYPES, logAnnouncement ("Logged call for Jordan Example."), deleteDialogCopy (with "1 task" singular), addedMeta ("Added Oct 4, 2026 · Inquiry page"), optOutAnnouncement. 7 unit tests.
- **Route:** loading line, not-found block with focused h1 and Go to contacts, `{Name}: Agent portal · Tran Real Estate Tools` title, two columns from 1024px (`minmax(0,640px)_352px`, 32px gap) and the mobile order header, info, tasks, notes, follow-up, activity.
- **ContactHeader:** Stage NativeSelect through `board.move`, which writes "Moved from {Old} to {New}", announces "Moved {Name} to {Stage}." and offers Undo. Edit details. Delete contact behind ConfirmDialog (Keep contact focused first, "Deleting..." in progress), followed by deleteContact (contact, tasks and activities in one transaction), the announcement, setFlash and a redirect.
- **ContactInfo:** Email (mailto), Phone (tel, tabular, no text-message links anywhere), Property of interest, Source. The edit form has Name, Email, Phone, Property, Source, and the "{Name} asked not to get emails from me" checkbox; it uses validateQuickAdd and findDuplicates with excludeId, showing the neutral alert with Open {First} / Save anyway.
- **ContactTasks / ContactNotes / ActivityLog:** as listed in `provides`. Focus after every write waits for the live list before moving.
- **ContactsView:** the only change is that it reads takeFlash() on mount and focuses the `#contacts-flash` status line.

## Task Commits

1. **Task 1 (RED): failing tests for contact UI helpers** - `f0db223` (test)
2. **Task 1 (GREEN): contact UI helpers** - `0ac1d41` (feat)
3. **Task 2: contact detail with tasks, notes and activity** - `c7fbd07` (feat)
4. **Task 3: contact detail E2E** - `a4513c7` (test)

**Plan metadata:** the docs(08-23) commit that follows.

## Files Created/Modified

- `apps/web/src/lib/features/agent/contact/contact-ui.ts` / `.test.ts`: copy helpers and their tests
- `apps/web/src/lib/features/agent/contact/ContactHeader.svelte`: h1, chips, stage select, edit, delete
- `apps/web/src/lib/features/agent/contact/ContactInfo.svelte`: details list and edit form
- `apps/web/src/lib/features/agent/contact/ContactTasks.svelte`: tasks section
- `apps/web/src/lib/features/agent/contact/ContactNotes.svelte`: notes section
- `apps/web/src/lib/features/agent/contact/ActivityLog.svelte`: log form and activity list
- `apps/web/src/lib/features/agent/crm/flash.svelte.ts`: one-shot cross-navigation message
- `apps/web/src/lib/features/agent/crm/ContactsView.svelte`: flash read and focus
- `apps/web/src/routes/(app)/agent/contact/+page.svelte`: the route
- `apps/web/tests/e2e/agent-contact.spec.ts`: the spec

## Verification

Every Node command ran through the single-core wrapper on mask 0x100, and Playwright ran with `--workers=1`.

- vitest `src/lib/features/agent`: 17 files, 192/192 (this plan's suite: 7/7).
- `pnpm check`: 2499 files, 0 errors, 0 warnings. Prettier was clean repo-wide. eslint was clean on every file in this plan; the only repo-wide eslint errors were in 08-24's uncommitted `profile/ShareLinkBuilder.svelte`, which I did not touch. `pnpm banned`: passed (339 files).
- `build:root` and `build:sub` both succeeded on the first attempt.
- Playwright `agent-contact`: **22/22 (11 root + 11 sub)** on the first run. Regression `agent-contacts` (ContactsView changed): **14/14 (7 root + 7 sub)**.
- All acceptance greps were met (`searchParams` 0, `window.confirm` 0, `sms:` 0 in ContactInfo, and every required string present). `apps/web/test-results/` was removed.

## Decisions Made

These are the six key-decisions in the frontmatter: afterNavigate for `?id=`, the flash TTL, the shared board-state move with status-line focus on Undo, the leaving snapshot plus the un-awaited goto, the literal `tel:` href, and change-only writes with a "Details saved." announcement. Also: the Source select hides 'sample' unless the contact already is a sample. Notes skip the write when the text is unchanged. Sources and the spec stay ASCII, so the middle dot is built with `String.fromCharCode(0xb7)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Same-route navigation would show a stale contact**
- **Found during:** Task 2
- **Issue:** The plan said to read `id` in onMount. The duplicate alert's **Open {First}** link goes to `/agent/contact/?id={other}`, which SvelteKit treats as a same-route navigation, so onMount does not re-run.
- **Fix:** Read `location.search` in `afterNavigate`, which also runs on first mount. The edit, leaving and board state are reset on each navigation.
- **Files modified:** `+page.svelte`
- **Committed in:** `c7fbd07`

**2. [Rule 3 - Blocking] `href={telHref}` failed svelte/no-navigation-without-resolve**
- **Fix:** `href="tel:{telDigits}"`. Two comments were also reworded so that the acceptance greps for `sms:` and `window.confirm` read 0.
- **Committed in:** `c7fbd07`

**3. [Rule 2 - Missing critical] Flash TTL**
- **Issue:** A message left behind after deleting the last contact would have appeared on some later, unrelated visit to Contacts.
- **Fix:** A 10 s expiry in `takeFlash()`.
- **Committed in:** `c7fbd07`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing critical). **Impact:** all three were needed for correct behaviour or the lint gate. No scope creep.

## Issues Encountered

- The editor tooling and Prettier turn `·` escapes into literal glyphs, so both .ts sources and the spec build the dot from its code point.
- 08-24 was executing in the same tree. Only this plan's paths were staged, and its untracked `agent-share-link.spec.ts` was left alone.

## Known Stubs

- `apps/web/src/routes/(app)/agent/contact/+page.svelte`, `<section id="follow-up" aria-labelledby="follow-up-title">`: renders only its h2 **Follow-up email** for now. This is intentional; plan 08-25 mounts `FollowUpComposer` inside it.

## Requirements

`requirements-completed` copies the plan's `[AGT-04, AGT-05]`. Per the Phase 8 convention, `requirements mark-complete` was **not** run: AGT ids stay open until the 08-26 gate.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- 08-25 can render its composer inside `#follow-up`. The page already has `c` (the contact); the profile has to come from `useProfile()`.
- No blockers.

---
*Phase: 08-agent-portal-profile-lead-intake-crm*
*Completed: 2026-10-07*

## Self-Check: PASSED

All 11 plan files plus this SUMMARY exist on disk; commits f0db223, 0ac1d41, c7fbd07 and a4513c7 are in `git log`.
