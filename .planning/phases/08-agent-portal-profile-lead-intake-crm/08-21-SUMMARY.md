---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 21
subsystem: agent-crm-ui
tags: [crm, tasks, today-queue, agent-home, svelte5, dexie, live-query, playwright, axe]

# Dependency graph
requires:
  - phase: 08-14
    provides: tasks-repo (addTask, completeTask, reopenTask, TaskValidationError), tasks-live (useOpenTasks, useDoneToday)
  - phase: 08-09
    provides: "@tran/core/crm groupTasks, isOverdue, isDueToday, quickDates, stageCounts"
  - phase: 08-17
    provides: DueBadge
  - phase: 08-10
    provides: StageBadge, DateField, UndoStatus, SampleChip, features/agent/dates (todayLocal, localDateOf, parseLocalDate, formatMonDay, formatWeekdayLong)
  - phase: 08-11
    provides: AgentNav dueCount prop, agent layout, today/home route skeletons
  - phase: 08-12 / 08-15 / 08-16
    provides: useContacts, useProfile, QuickAddDialog, CrmEmptyState, sample contacts + E2E seeding helpers
  - phase: 08-13
    provides: buildInquiryUrl, agent-helpers (rentcastTripwire, expectAxeClean, expectNoHorizontalScroll)
provides:
  - "features/agent/tasks/task-ui.ts: taskCountLabel, dueCount, taskErrorMessage, nextFocusTarget, compactQueue, COMPACT_MAX"
  - "features/agent/home/setup-checklist.ts: setupChecklist({ profile, contacts }) -> { items[{key, done}], allDone }, detailsDone, inquiryDone, contactDone, inquiryConfigFor(profile)"
  - "features/agent/tasks/TaskRow.svelte { task, contact, today, showContact?, ondelete?, ondone?, onreopened? }: checkbox row that completes / reopens with announcements"
  - "features/agent/tasks/AddTaskForm.svelte { contact, today, onadded? }: Task + Due + quick-set + Add task (mounted by the contact page in 08-23)"
  - "features/agent/tasks/TodayQueue.svelte { variant: 'full' | 'compact' }: grouped queue with focus management"
  - "features/agent/home/AgentHome.svelte { onadded? }: Due today, Pipeline counts, Get set up, Quick actions, Copy inquiry link"
  - "/agent/ renders AgentHome under the Agent portal h1; /agent/today/ renders the full queue; the agent layout feeds AgentNav dueCount from the live open tasks"
  - "tests/e2e/agent-today.spec.ts"
affects: [08-23 contact detail (mounts AddTaskForm + TaskRow), 08-24 share builder (inquiryConfigFor), 08-26 gate (AGT-05)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Focus after a live-query change: record the intent (task id, expected open/done state, fallback target), let an $effect wait until the live view reflects it, then tick() and query the DOM (data-task-checkbox -> data-group-heading -> data-queue-empty-focus)"
    - "A bits-ui Checkbox button named by its <label for> also gets aria-labelledby, so accessible-name computation (axe, Playwright) agrees with browsers"
    - "Visually hidden prefixes/suffixes are variables ({DONE_PREFIX}), never literal element text, because Svelte trims trailing spaces and svelte/no-useless-mustaches rejects {'literal '}"
    - "Component-owned copy: row labels live in the component next to the markup; pure helpers return keys + booleans"

key-files:
  created:
    - apps/web/src/lib/features/agent/tasks/task-ui.ts
    - apps/web/src/lib/features/agent/tasks/task-ui.test.ts
    - apps/web/src/lib/features/agent/tasks/TaskRow.svelte
    - apps/web/src/lib/features/agent/tasks/AddTaskForm.svelte
    - apps/web/src/lib/features/agent/tasks/TodayQueue.svelte
    - apps/web/src/lib/features/agent/home/setup-checklist.ts
    - apps/web/src/lib/features/agent/home/setup-checklist.test.ts
    - apps/web/src/lib/features/agent/home/AgentHome.svelte
    - apps/web/tests/e2e/agent-today.spec.ts
  modified:
    - apps/web/src/routes/(app)/agent/+page.svelte
    - apps/web/src/routes/(app)/agent/today/+page.svelte
    - apps/web/src/routes/(app)/agent/+layout.svelte
    - .planning/phases/08-agent-portal-profile-lead-intake-crm/deferred-items.md

key-decisions:
  - "08-21: the empty-CRM home hides Quick actions (CrmEmptyState already offers Add a lead and Import leads; rendering both would duplicate the buttons) while Get set up stays"
  - "08-21: the Get set up row copy lives in AgentHome.svelte (SETUP_LABELS); setupChecklist returns keys + done only"
  - "08-21: the full queue renders both the Overdue and Due today sections (one may read 0 tasks) whenever either has tasks, so an emptied group keeps its heading as the focus target; both empty -> the Nothing due today panel, whose h2 takes focus; Done today <details> renders only when n > 0"
  - "08-21: the E2E's due-today order (Reply -> Confirm -> Check in) assumes Dexie returns equal-createdAt rows in primary-key order (the sample ids ascend in fixture order); confirmed on both bases"
  - "08-21: the Today pill is matched with /^Today ?, n tasks due$/ because browsers compute 'Today , 5 tasks due' from AgentNav's sr-only suffix; the AgentNav fix is logged in deferred-items.md (08-11's file)"
  - "08-21: inquiryConfigFor(profile) lives in setup-checklist.ts so the home's Copy inquiry link and the 08-24 share builder derive the same InquiryConfig"

patterns-established:
  - "Tasks UI: TaskRow owns the write + announcement; the parent owns focus through ondone / onreopened"
  - "E2E: toggle bits-ui checkboxes with click(), not check(), when the row leaves the DOM on the live update"

requirements-completed: [AGT-05]  # advanced here; left open in REQUIREMENTS.md until the 08-26 gate (Phase 8 convention)

# Metrics
duration: ~1h 45m wall clock (stage 1 ~30 min active; stage 2 waited for the shared build directory and re-ran E2E after a memory-pressure kill)
completed: 2026-10-07
---

# Phase 8 Plan 21: Due-today queue, task rows and the agent home Summary

**The agent portal now opens on its follow-ups: `/agent/` shows overdue then due-today tasks before anything else (with pipeline counts, a data-driven Get set up checklist and quick actions), `/agent/today/` groups tasks into Overdue, Due today, Coming up and Done today with one-click complete / reopen, announcements and focus management, and the AgentNav Today pill counts the live due work, all proven by Playwright on both bases.**

## Performance

- **Duration:** ~1h 45m wall clock. Stage 1 (implementation, unit tests, check/lint) 2026-10-07T01:07:53Z to ~01:37Z; stage 2 (builds + E2E) from ~01:58Z after the shared build directory was handed over, including one restart after the system killed the first background Playwright run for memory pressure.
- **Started:** 2026-10-07T01:07:53Z
- **Completed:** 2026-10-07 (see the final docs commit)
- **Tasks:** 3 of 3
- **Files modified:** 13 (9 created, 4 modified incl. deferred-items.md)

## Accomplishments

- **Pure helpers (Task 1, TDD).** `task-ui.ts`: `taskCountLabel` ("1 task" / "{n} tasks"), `dueCount` (open live tasks overdue or due today: the nav pill), `taskErrorMessage` (the three UI-SPEC validation strings keyed by `TaskValidationCode`), `nextFocusTarget` (next in group, else previous, else null = heading), `compactQueue` (overdue then due today, first 5, `more`). `setup-checklist.ts`: `setupChecklist` with details / inquiry / contact steps computed from the stored profile and contacts (never from clicks), plus `inquiryConfigFor` mapping a profile to the public page's `InquiryConfig`. 19 unit tests.
- **TaskRow.** `<li data-task-id>` with the shadcn/bits-ui checkbox (`data-task-checkbox`, named by its label and `aria-labelledby`), the title (line-through plus a visible "Done" label when done), the contact link on Today, `DueBadge` + `StageBadge` + `SampleChip`, and an optional ghost Delete. Checking calls `completeTask` (which logs "Task done: {title}") and announces "Done: {title}."; unchecking calls `reopenTask` and announces "Reopened: {title}.".
- **AddTaskForm.** Task input (max 120), Due `DateField` defaulting to today, ghost quick-set Today / Tomorrow / In 3 days / Next week (`quickDates`, `aria-pressed`, never submit), Add task / "Adding...". `TaskValidationError` codes map to the copy under the right field and focus it; success clears the title, announces "Task added for {Name}, due {Mon D}." and calls `onadded(task)`. Built here for the contact page (08-23).
- **TodayQueue.** Reads `useOpenTasks`, `useDoneToday(local midnight ISO)` and `useContacts`, groups with `groupTasks` (today = `todayLocal()`, localDate = `localDateOf`). Full: date line, `<section aria-labelledby data-group>` per group with an `h2` (tabindex -1) and count, Coming up with "and {n} more", a closed `<details>` "Done today ({n})", and the caught-up panel ("Nothing due today", body copy, "Open your pipeline"). Compact: h3 groups, first five, "See everything due" when more. After a change an `$effect` waits for the live view, then focuses the next task's checkbox, else the group heading, else the panel title.
- **AgentHome + routes + layout.** `/agent/` keeps `<h1>Agent portal</h1>` and its title; below it the lead line, then either the CRM empty state + Get set up, or the `lg:grid-cols-[2fr_1fr]` layout: Due today (compact queue) left; Pipeline (`<ul>` of five 44px links "{Stage} · {n}" to `/agent/pipeline/#stage-{stage}`), Get set up (`<ol>`, CircleCheck / Circle icons, hidden "Done: " prefix, rows are the links to the profile / `#inquiry-page` or the button that opens `QuickAddDialog`, hidden when all done) and the sr-only-headed Quick actions (Add a lead, Import leads, Copy inquiry link when a share link can be built, with "Link copied." / the clipboard-refused copy and a selected readonly link field) right. `/agent/today/` renders the full queue. The layout keeps the 08-15 wiring and now feeds `<AgentNav dueCount>` from `useOpenTasks()`.
- **E2E (Task 3).** `agent-today.spec.ts`, 9 tests per base: home order (overdue first, exactly five rows, no overflow link, badges), nav pill, Today groups with counts and ordering, complete -> announcement, Done today (1), focus on the next checkbox, pill 5 -> 4; reopen from Done today -> announcement, focus, pill 5; completing all five -> caught-up panel focused, Done today (5), no pill; pipeline anchors and all five counts; Get set up hrefs, item 3 opens the dialog and Cancel returns focus, Done prefix after a real contact, quick actions without Copy link; empty CRM home and Today; axe at 1280 (empty, samples, Done today open) and a 375px describe with no horizontal scroll and axe. The RentCast tripwire is asserted empty after every test.

## Task Commits

1. **Task 1 (RED): failing tests for task UI and setup checklist helpers** - `b95f7be` (test)
2. **Task 1 (GREEN): task UI and setup checklist helpers** - `2b67f2e` (feat)
3. **Task 2: due-today queue, agent home and task rows** - `768a393` (feat)
4. **Task 2 follow-up: name task checkboxes explicitly and focus the caught-up title** - `a8a416d` (fix)
5. **Task 3: due-today queue and home E2E** - `0a28f7b` (test)

**Plan metadata:** the docs(08-21) commit that follows.

## Files Created/Modified

- `apps/web/src/lib/features/agent/tasks/task-ui.ts` / `.test.ts` - queue helpers (11 tests)
- `apps/web/src/lib/features/agent/home/setup-checklist.ts` / `.test.ts` - checklist state + `inquiryConfigFor` (8 tests)
- `apps/web/src/lib/features/agent/tasks/TaskRow.svelte` - the task row
- `apps/web/src/lib/features/agent/tasks/AddTaskForm.svelte` - the add-task form
- `apps/web/src/lib/features/agent/tasks/TodayQueue.svelte` - full and compact queue
- `apps/web/src/lib/features/agent/home/AgentHome.svelte` - the home body
- `apps/web/src/routes/(app)/agent/+page.svelte` - h1 Agent portal + AgentHome (PortalPlaceholder dropped)
- `apps/web/src/routes/(app)/agent/today/+page.svelte` - h1 Today + full queue
- `apps/web/src/routes/(app)/agent/+layout.svelte` - `useOpenTasks` -> `dueCount` -> AgentNav
- `apps/web/tests/e2e/agent-today.spec.ts` - the E2E
- `.planning/phases/08-agent-portal-profile-lead-intake-crm/deferred-items.md` - AgentNav pill name entry

## Verification

Every Node command ran through the single-core affinity wrapper (mask 0x4000); Playwright with `--workers=1`.

- `vitest run --project web src/lib/features/agent`: 15 files / 172 tests passed at the end of stage 1 (this plan's two files: 19/19).
- `corepack pnpm check`: tsc x2 clean; svelte-check 2484 files, 0 errors, 0 warnings.
- prettier + eslint on every file of this plan: clean (repo-wide `prettier --check .` was not run because other executors' uncommitted files were in the tree). `corepack pnpm banned`: passed (330 files).
- Acceptance greps: every string listed for Tasks 2 and 3 is present (TodayQueue: Overdue, Due today, Coming up, "Done today (", Nothing due today, See everything due, `<details`; AddTaskForm: Tomorrow, In 3 days, Next week, Add task, "Task added for "; TaskRow: completeTask, reopenTask, "Done: ", "Reopened: "; AgentHome: Get set up, Quick actions, Copy inquiry link and the three checklist labels; the home page keeps the Agent portal h1; the layout contains dueCount; the spec contains "Today, 5 tasks due", "Done: Reply to the Saturday tour question.", "Reopened: ", "#stage-touring", "Nothing due today").
- `corepack pnpm build:root` and `build:sub`: both wrote their sites (HEAD d6d44a3 plus this plan's commits).
- Playwright (both bases): `agent-today` 18/18 (9 root + 9 sub); `agent-shell` 44/44; `a11y.spec.ts` 65 root + 65 sub; `ai-a11y` + `settings-a11y` 70/70 (35 root + 35 sub). The a11y pattern therefore totals 200 passed, 0 failed, on top of 18 + 44 for this plan's own specs.
- `apps/web/test-results/` removed after the runs.

## Decisions Made

- **Empty-CRM home hides Quick actions.** The plan says only "Get set up stays"; CrmEmptyState already renders Add a lead and Import leads, so the quick-actions row would duplicate them. Copy inquiry link is therefore unavailable until a first contact exists; trivial to flip if unwanted.
- **Checklist copy in the component.** The plan's acceptance grep wants the three labels in AgentHome.svelte; keeping them there (and keys + booleans in the helper) avoids two copies.
- **Both due groups render while the queue is non-empty** so UI-SPEC's "focus the group heading when the group empties" has a heading to land on; the caught-up panel takes over when both are empty.
- **Dexie order assumption.** The sample tasks share one `createdAt`; the due-today order the E2E asserts (Reply -> Confirm -> Check in) comes from the `[status+dueDate]` index returning equal rows in primary-key order and the fixture's ascending ids. Verified on both bases; if the fixture ids ever change, the spec's `DUE_TODAY` must follow.
- **Pill name regex.** See deviation 3.
- **`inquiryConfigFor`** added to setup-checklist.ts (same module as `inquiryDone`) so 08-24 can reuse it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task checkbox had no name for axe / accessible-name computation**
- **Found during:** Task 2 review before the E2E
- **Issue:** the bits-ui checkbox is a `<button role="checkbox">`; a `<label for>` names it in browsers, but axe-core's native naming for `button` is subtree text, so `aria-toggle-field-name` would have flagged every row.
- **Fix:** the label gets an id and the checkbox `aria-labelledby`.
- **Files modified:** TaskRow.svelte
- **Verification:** axe clean on Today with samples and with Done today open, both bases.
- **Committed in:** `a8a416d`

**2. [Rule 1 - Bug] Caught-up fallback focused a non-focusable div**
- **Found during:** Task 2 review
- **Issue:** when the last due group empties, the queue replaces the sections with the panel, so the heading fallback had nothing to focus and the `[data-queue-empty]` wrapper is not focusable.
- **Fix:** a `data-queue-empty-focus` marker on the panel's h2 (full) / the empty line (compact); the effect falls back to it.
- **Verification:** E2E "completing every due task shows the caught-up panel" asserts the h2 is focused.
- **Committed in:** `a8a416d`

**3. [Plan detail] Today pill matched with an optional space**
- **Found during:** Task 3 (first E2E run: `getByRole('link', { name: 'Today, 5 tasks due' })` not found while the pill rendered 5, then 4, then 5)
- **Issue:** browsers compute the AgentNav link name as `Today , 5 tasks due`: Tailwind's `sr-only` is `position: absolute`, which accname treats as block-level and separates with a space. AgentNav.svelte belongs to 08-11 and is outside this plan's files.
- **Fix:** the spec's `pill(page, n)` uses `/^Today ?, n tasks due$/` and documents why; the AgentNav fix (`aria-label` instead of the sr-only suffix) is logged in `deferred-items.md`.
- **Verification:** `agent-today` 18/18.

**4. [Plan detail] Local `addFirstLead` instead of the shared `addLeadByHand`**
- **Found during:** Task 3 (reported deterministic on root by 08-20: the contacts page's toolbar button is in the prerendered HTML before hydration, so the shared helper's immediate click can miss)
- **Fix:** the spec's own helper waits for the "No contacts yet" empty state before clicking; `agent-helpers.ts` (08-15, shared) untouched.

---

**Total deviations:** 2 auto-fixed (2 bugs) + 2 test-side adjustments. **Impact:** all four were needed for the plan's own must-haves (announced, focused, axe-clean completion; the pill count); no scope creep.

## Issues Encountered

- **Memory-pressure kill.** The first full `agent-today agent-shell a11y` run (started in the background) was stopped by the session's memory reaper partway through a11y 375px; its `✘ (0ms)` lines were Playwright's interrupted markers, not failures. With ~5-7 GB free the suites were re-run in the foreground in chunks (agent-today; agent-shell; a11y.spec root; a11y.spec sub; ai-a11y + settings-a11y), each under the 10-minute call limit, all sequential because they share the preview ports and build directory.
- **Prettier unescapes unicode.** `·`, `…` and `⌘` were rewritten to the literal glyphs (the middle dot in pipeline rows and the spec, "Adding..." with an ellipsis, the command-key symbol in the clipboard copy); these are UI-SPEC-verbatim strings, same precedent as 08-17's DueBadge, and the only non-ASCII in this plan's files.
- **Concurrent executors.** 08-18/19/20/22 were writing in the same tree; repo-wide prettier was skipped and only this plan's paths were staged. `pnpm check` briefly showed three `state_referenced_locally` warnings in 08-22's `BrandColorField.svelte`; gone by the final run.
- The wrapper's cmd layer rejects literal `(app)` paths; prettier/eslint were pointed at `apps/web/src/routes/**/agent/...` globs.

## Known Stubs

None. Every section reads live Dexie data. `AddTaskForm` is built but not mounted anywhere yet by design (the contact page in plan 08-23 mounts it), so its behaviour is covered by the repo's unit tests and will get E2E coverage there.

## Requirements

`requirements-completed` copies the plan's `requirements` field (AGT-05). The due-today queue, task completion and the Today count are in place, but `requirements mark-complete AGT-05` was NOT run: the Phase 8 convention (08-12, 08-14, 08-15, 08-16) leaves AGT ids open until the 08-26 gate closes them.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-23 can mount `AddTaskForm` (`{ contact, today, onadded }`) and `TaskRow` (`showContact={false}`, `ondelete`) on the contact page; `onadded` returns the task so the page can focus `[data-task-id="{id}"] [data-task-checkbox]`.
- 08-24 can build the share link with `inquiryConfigFor(profile)` + `buildInquiryUrl`.
- Open follow-up for 08-11's owner: the AgentNav pill name (deferred-items.md).

---
*Phase: 08-agent-portal-profile-lead-intake-crm*
*Completed: 2026-10-07*

## Self-Check: PASSED

All 12 plan files plus this SUMMARY exist on disk; commits b95f7be, 2b67f2e, 768a393, a8a416d and 0a28f7b are in `git log`.
