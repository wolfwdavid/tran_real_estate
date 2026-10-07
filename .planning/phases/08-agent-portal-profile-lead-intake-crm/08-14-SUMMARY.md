---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 14
subsystem: agent-storage
tags: [dexie, indexeddb, crm, tasks, import, transactions, live-query, fake-indexeddb]
requires:
  - "08-06 @tran/core/leads/diff-leads LeadDiffRow (new | update {target, fills, keeps, logsInquiry} | duplicate | conflict | same-as-row), FillableField"
  - "08-09 @tran/core/crm/dates isIsoDate"
  - "08-12 $lib/storage/agent/tables, contacts-repo (buildContactRecord, ADDED_TEXT, getContact, listActivities)"
  - "08-01 @tran/core/agent/{types,schemas} (Task, Activity, IncomingLead, isLive, contactSchema, MAX_ACTIVITY_TEXT)"
  - "Phase 3 getDb/_resetDb, newSyncable/touch/tombstone, live(), freshIdb(), META.firstRecordAt"
provides:
  - "$lib/storage/agent/tasks-repo: addTask, completeTask, reopenTask, deleteTask, restoreTask, listOpenTasks, listTasksFor, listDoneSince, TaskValidationError, TaskValidationCode"
  - "$lib/storage/agent/tasks-live.svelte: useOpenTasks, useTasksFor, useDoneToday"
  - "$lib/storage/agent/import-commit: planFromDiff, commitImport, inquiryText, ImportCommitError, ImportPlan, ImportUpdate, ImportResult, LeadEdits"
affects: [08-18 paste import, 08-19 CSV import, 08-20 Today queue, 08-21 contact detail tasks, 08-23 inquiry intake]
tech-stack:
  added: []
  patterns:
    - "Task status is the string 'open' | 'done' and dueDate a local YYYY-MM-DD; the due queue reads the [status+dueDate] compound index (IndexedDB cannot index booleans)"
    - "A reviewed import is a pure ImportPlan (planFromDiff) followed by ONE rw transaction (commitImport); every write is collected in memory and flushed with bulkAdd/bulkPut at the end"
    - "Fill-blank updates re-read the target inside the transaction and only write fields that are still blank"
key-files:
  created:
    - apps/web/src/lib/storage/agent/tasks-repo.ts
    - apps/web/src/lib/storage/agent/tasks-repo.test.ts
    - apps/web/src/lib/storage/agent/tasks-live.svelte.ts
    - apps/web/src/lib/storage/agent/import-commit.ts
    - apps/web/src/lib/storage/agent/import-commit.test.ts
  modified: []
key-decisions:
  - "08-14: the inquiry preview ellipsis is ASCII '...' because cleanText NFKC-folds U+2026 into three full stops before the activity text is stored (and Phase 8 source stays ASCII-only)"
  - "08-14: the commitImport transaction spans contacts, activities and meta so META.firstRecordAt is set in the same atomic write, as addContact does"
  - "08-14: an update whose target was deleted between review and commit counts as skipped, not an error; two updates for one contact chain on the in-memory row, not the stale stored one"
  - "08-14: a CSV round-trip Tran id is reused only when that id is free; otherwise the add gets a fresh uuid"
  - "08-14: completeTask is a no-op on an already-done task; reopenTask tombstones only the latest live task_done activity for that taskId"
patterns-established:
  - "Tasks: status strings + compound index, never a boolean done field"
  - "Import: diff (pure) -> plan (pure) -> commit (one transaction)"
requirements-completed: []  # AGT-03, AGT-05, AGT-07 advanced at the storage layer; left open for the 08-26 gate (Phase 8 convention)
duration: ~40 min active across two executor sessions
completed: 2026-10-07
---

# Phase 8 Plan 14: Tasks repository and all-or-nothing import commit Summary

**Follow-up tasks persist under a `[status+dueDate]` index with logged completion and undoable delete, and a reviewed paste/CSV import lands as one Dexie transaction that fills only blank fields and turns inquiry messages into activities.**

## Performance

- **Duration:** ~40 min active. Task 1 was committed at 2026-10-06T13:57:40Z by the first executor, which then stalled mid-Task 2 (see Issues Encountered); the resume session ran 2026-10-07T00:16:04Z to 2026-10-07T00:20:38Z.
- **Started:** 2026-10-06T13:57:40Z (first commit)
- **Completed:** 2026-10-07T00:20:38Z
- **Tasks:** 2
- **Files modified:** 5 (all created)

## Accomplishments

- **Tasks repo.** `addTask` validates with `TaskValidationError('title-empty' | 'title-long' | 'due-invalid')`, copies `sample` from the contact and writes `status: 'open'`. `completeTask` flips to `'done'`, sets `doneAt` and logs `Task done: {title}` in one rw transaction; `reopenTask` reverses both in one transaction (tombstoning the latest live `task_done` activity). `deleteTask`/`restoreTask` are a tombstone round trip that returns the record for Undo. `listOpenTasks` reads `where('[status+dueDate]').between(['open', minKey], ['open', maxKey])`, filters `isLive`, and comes back sorted by due date; `listTasksFor` and `listDoneSince` serve the contact detail and the done-today strip.
- **Live wrappers.** `useOpenTasks()`, `useTasksFor(contactId)`, `useDoneToday(isoStart)` over Phase 3 `live()` returning `LiveView<Task[]>`.
- **Import plan.** `planFromDiff(rows, include, edits?)` keeps only checked `'new'` rows (with preview edits applied) and checked `'update'` rows (fills taken from the lead fields named in `row.fills`, `inquiryMessage` when `row.logsInquiry`); duplicates, conflicts, same-as-row and unchecked rows are counted as skipped.
- **Import commit.** `commitImport(plan, now?)` runs exactly one `db.transaction('rw', [contacts, activities, db.meta])`. Adds go through `buildContactRecord` + an `'added'` activity using `ADDED_TEXT[source]` ("Added from your inquiry page" / "Added from a pasted email" / "Imported from CSV") and, when the lead carries a message, an `'inquiry'` activity `Inquiry received: "{first 80 chars}..."` (ellipsis only when truncated). Updates re-read the target inside the transaction, fill only still-blank fields, re-normalize `emailNorm`/`phoneNorm`, re-validate with `contactSchema`, and log `Details updated` plus any inquiry. Notes are never touched. Any throw aborts the transaction and surfaces as `ImportCommitError` (with `cause`) for the UI's "Import didn't finish" copy.

## Task Commits

1. **Task 1: Tasks repository with done/reopen/delete/restore, activity logging and live wrappers** - `c1c2274` (feat)
2. **Task 2: Single-transaction import commit from a reviewed diff** - `3a4e1e9` (feat)

**Plan metadata:** see the docs(08-14) commit that follows this file.

## Files Created/Modified

- `apps/web/src/lib/storage/agent/tasks-repo.ts` - eight task operations + `TaskValidationError`; `[status+dueDate]` queries; transactional complete/reopen
- `apps/web/src/lib/storage/agent/tasks-repo.test.ts` - 11 tests: validation codes, done + activity text, atomicity, reopen, delete/restore, queue ordering and exclusions, sample propagation
- `apps/web/src/lib/storage/agent/tasks-live.svelte.ts` - `useOpenTasks`, `useTasksFor`, `useDoneToday`
- `apps/web/src/lib/storage/agent/import-commit.ts` - `planFromDiff`, `commitImport`, `inquiryText`, `ImportCommitError`, `ImportPlan`
- `apps/web/src/lib/storage/agent/import-commit.test.ts` - 12 tests (10 `it` blocks, one `it.each` over three sources): plan counts and edits, added-activity copy per source, inquiry activity with notes untouched, fill-blank update, never-overwrite, two atomicity cases, 5,000-lead smoke

## Verification

Every Node command ran through the single-core affinity wrapper (see Issues Encountered).

- `corepack pnpm vitest run --project web src/lib/storage/agent`: 5 files, 70 tests passed (profile 9, backup 6, contacts 32, tasks 11, import-commit 12).
- `corepack pnpm vitest run --project web --reporter=verbose src/lib/storage/agent/import-commit`: 12/12 passed; the 5,000-lead plan committed in 773 ms (bound: 10 s).
- `corepack pnpm check`: tsc x2 clean, svelte-check 2428 files, 0 errors, 0 warnings.
- Lint: `prettier --check` and `eslint` on the two Task 2 files are clean; repo-wide `eslint .` exits 0. Repo-wide `prettier --check .` currently fails on `apps/web/src/lib/features/agent/crm/QuickAddDialog.svelte`, an untracked file owned by the parallel 08-15 executor (not this plan's scope, not touched).
- Acceptance greps (Task 2): `transaction('rw'` appears exactly once in import-commit.ts; `Inquiry received: ` present; test file contains `5000`, `ImportCommitError`, a `never overwrites` test and two `all or nothing` tests. Exports `planFromDiff`, `commitImport`, `ImportCommitError`, `ImportPlan` confirmed.
- Acceptance greps (Task 1): the eight exports present; `[status+dueDate]` x4, `Task done: ` x3, `transaction('rw'` x5; zero `done: true|false` writes (the three `done:` matches are the plan-required `Task done:` activity text, so the literal `grep -c "done:" == 0` criterion is unsatisfiable as written; its intent, no boolean field, holds); test file contains `reopen`, `restore` and an atomicity test.

**Mutation test (resume session).** Replaced `db.transaction('rw', [...], async () => {` with `Promise.resolve().then(async () => {`: "is all or nothing: a failed activity write rolls back contacts and fills" went red (1 failed, 11 passed); the original was restored and byte-compared with the backup. The "invalid third add" case survives this mutant by design: validation throws before any write, so it exercises the `ImportCommitError` path rather than rollback; the second atomicity test covers rollback. The first executor reported its own mutants on Task 1 and Task 2 killed before the stall.

## Decisions Made

- The inquiry preview ellipsis is ASCII `...`, not the plan's `U+2026`: `cleanText` applies NFKC, which decomposes the Unicode ellipsis into three full stops, so the stored activity text would be `...` regardless; using it directly keeps the source ASCII-only per the Phase 8 convention and makes the test assertion honest.
- `db.meta` is included in the single transaction so `META.firstRecordAt` is set atomically with the first contact, matching `addContact`.
- A target deleted between review and commit is counted in `skipped` rather than aborting the whole import (the agent chose to update a row that no longer exists; the rest of the batch should still land).
- `ImportUpdate`, `ImportResult` and `LeadEdits` are exported alongside the plan's required names so the import UI can type its state without re-deriving shapes.

## Deviations from Plan

**1. [Rule 1 - Bug] Plan's `U+2026` ellipsis would never survive storage** (Task 2). `activity()` runs `cleanText` on the text, and NFKC folds the Unicode ellipsis to `...`. Writing `U+2026` and asserting it in tests would have failed or, worse, passed only by accident of normalization order. Implemented the ASCII form with a comment explaining why. Verified by the "logs an inquiry message" test (`endsWith('..."')`). Committed in `3a4e1e9`.

**Total deviations:** 1 auto-fixed (1 bug). **Impact:** behaviour matches the UI-SPEC copy ("Inquiry received: ..." with a trailing ellipsis only when truncated); no scope creep.

## Issues Encountered

- **Stalled first executor.** The original executor committed Task 1, wrote both Task 2 files, ran its mutation tests and restored the original, then stalled before `check + lint + commit`. Root cause was environmental: after a resume from sleep this machine's performance counter runs backwards across cores, and any multi-core Node process dies within a second with `Assertion failed: new_time >= loop->time, file src\win\core.c`. The resume session ran every Node command through a wrapper that pins the process tree to one core (`pin.sh 0x100`); plain git was unaffected. Both Task 2 files were taken as found on disk, re-verified against the plan's action text and acceptance criteria (no edits needed), re-tested, mutation-checked and committed.
- **Repo-wide Prettier red on another plan's file.** `pnpm lint` stops at `prettier --check .` because the parallel 08-15 executor's untracked `QuickAddDialog.svelte` is unformatted. Out of scope for this plan; lint was verified scoped to this plan's files plus a full `eslint .`. That executor will format it before its own commit.

## Requirements advanced

AGT-05 (task persistence and the due-today query), AGT-03 and AGT-07 (the transactional commit behind paste and CSV import) are advanced at the storage layer. Following the Phase 8 convention (08-01, 08-05, 08-09, 08-12), `requirements mark-complete` was not run; the AGT ids stay open until the UI plans land and the 08-26 gate closes them.

## Known Stubs

None. Every export is wired to Dexie tables and covered by fake-indexeddb tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-18 (paste import) and 08-19 (CSV import) can call `planFromDiff(rows, checkedRowNumbers, edits)` then `commitImport(plan)` and render `{added} added, {updated} updated, {skipped} skipped.`; catch `ImportCommitError` for the "Import didn't finish" panel.
- 08-20 (Today) consumes `useOpenTasks()` and `useDoneToday(localMidnightIso)`; 08-21 (contact detail) consumes `useTasksFor(contactId)` plus `addTask`/`completeTask`/`reopenTask`/`deleteTask`/`restoreTask`.
- No blockers.

---
*Phase: 08-agent-portal-profile-lead-intake-crm*
*Completed: 2026-10-07*

## Self-Check: PASSED

All five source files and the SUMMARY exist on disk; commits c1c2274 and 3a4e1e9 are in history.
