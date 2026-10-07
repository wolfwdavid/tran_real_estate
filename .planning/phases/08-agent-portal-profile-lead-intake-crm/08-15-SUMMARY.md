---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 15
subsystem: agent-crm-ui
tags: [crm, quick-add, dedupe, sample-data, empty-state, undo, dexie, svelte5, playwright, axe]

# Dependency graph
requires:
  - phase: 08-12
    provides: contacts-repo (addContact, findDuplicates, listContacts, ADDED_TEXT, buildContactRecord), tables, live.svelte useContacts
  - phase: 08-10
    provides: EmptyState, UndoStatus, NativeSelect, SampleChip
  - phase: 08-11
    provides: (app)/agent/+layout.svelte with AgentNav, contacts skeleton page
  - phase: 08-13
    provides: tests/e2e/agent-helpers.ts (rentcastTripwire, expectAxeClean, expectNoHorizontalScroll)
  - phase: 03
    provides: dialog copy-in, button/input/label/textarea, announce()
provides:
  - "features/agent/fixtures/sample-contacts.ts: buildSampleData(today, now) -> 12 synthetic contacts, 9 tasks (2 overdue / 3 due today / 4 upcoming), activities, all sample: true"
  - "features/agent/samples/samples.ts: loadSampleContacts (idempotent), removeSampleContacts -> SampleSnapshot, restoreSampleContacts, hasAnyContacts, SAMPLE_COUNT"
  - "features/agent/samples/samples-state.svelte.ts: shared { undo, status } for the layout notice and its Undo line"
  - "features/agent/crm/quick-add.ts: validateQuickAdd, duplicateMessage (pure, exact UI-SPEC copy)"
  - "features/agent/crm/QuickAddDialog.svelte: Add a lead dialog with validation, duplicate alert, Open {First} / Add as a separate contact"
  - "features/agent/crm/CrmEmptyState.svelte and SampleContactsNotice.svelte"
  - "agent layout renders SampleContactsNotice / UndoStatus between AgentNav and the page; contacts page has the Add a lead toolbar + empty state"
  - "tests/e2e/agent-helpers.ts: announcer, loadSampleContacts, addLeadByHand (seeding for later specs)"
  - "tests/e2e/agent-entry.spec.ts"
affects: [08-17 home/pipeline/contacts list (QuickAddDialog, CrmEmptyState), 08-18 contacts list, 08-19/08-20 import (Add one lead by hand), every later agent E2E spec (seeding helpers)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Keyless demo data: a hand-authored fixture under features/agent/fixtures (guard-scanned: @example.com + 555-01xx only), fixed v4-shaped ids, dates relative to today/now"
    - "Sample removal is a hard delete inside one rw transaction that returns the snapshot; Undo bulkPuts the same records (samples are not user data, never tombstoned)"
    - "Module-level $state shared between a layout and a child component, cleared on afterNavigate; pass $state.snapshot() before handing it to Dexie"
    - "Duplicate gate: validate -> findDuplicates -> in-dialog neutral alert; nothing is written until the agent chooses"

key-files:
  created:
    - apps/web/src/lib/features/agent/fixtures/sample-contacts.ts
    - apps/web/src/lib/features/agent/samples/samples.ts
    - apps/web/src/lib/features/agent/samples/samples.test.ts
    - apps/web/src/lib/features/agent/samples/samples-state.svelte.ts
    - apps/web/src/lib/features/agent/crm/quick-add.ts
    - apps/web/src/lib/features/agent/crm/quick-add.test.ts
    - apps/web/src/lib/features/agent/crm/QuickAddDialog.svelte
    - apps/web/src/lib/features/agent/crm/CrmEmptyState.svelte
    - apps/web/src/lib/features/agent/crm/SampleContactsNotice.svelte
    - apps/web/tests/e2e/agent-entry.spec.ts
  modified:
    - apps/web/src/routes/(app)/agent/+layout.svelte
    - apps/web/src/routes/(app)/agent/contacts/+page.svelte
    - apps/web/tests/e2e/agent-helpers.ts

key-decisions:
  - "SampleContactsNotice is a div with role=region (not <section role=region>): Svelte flags the latter as a redundant role, and the repo's other named regions already use the div form"
  - "The removal announcement and status use the snapshot's real contact count rather than the constant 12, so the copy stays true if a sample was deleted first"
  - "Undo passes $state.snapshot(snapshot) to Dexie: the deep-$state Proxy cannot be structured-cloned (DataCloneError), which silently broke Undo in the first E2E run"
  - "Contacts page keeps the 'Loading your contacts...' line once contacts exist: the list itself is plan 08-18's job (documented stub)"

patterns-established:
  - "E2E seeding helpers for the CRM live in agent-helpers.ts (announcer, loadSampleContacts, addLeadByHand); wave 5+ plans import them and must not edit the file"
  - "Agent E2E specs install rentcastTripwire in beforeEach and assert it empty in afterEach"

requirements-completed: [AGT-03]

# Metrics
duration: ~35 min (resume session; the plan spanned a stalled first executor, Task 1 commit 13:58Z to final 00:48Z wall clock)
completed: 2026-10-07
---

# Phase 8 Plan 15: CRM entry points (sample contacts, empty state, quick add) Summary

**Keyless 12-contact sample dataset with one-transaction load / remove / Undo, a CRM empty state with three ways in, a layout-level Sample contacts notice on every agent page, and an Add a lead dialog that validates and blocks same-email / same-phone duplicates until the agent chooses, all proven by Playwright on both bases with zero RentCast traffic.**

## Performance

- **Duration:** ~35 min for this resume session (Tasks 2 and 3 plus verification). Wall clock for the whole plan: 2026-10-06T13:58Z (Task 1 commit by the first executor, which then stalled on the single-core crash) to 2026-10-07T00:48Z.
- **Started (resume):** 2026-10-07T00:13Z
- **Completed:** 2026-10-07T00:48Z
- **Tasks:** 3 of 3
- **Files modified:** 13 (10 created, 3 modified)

## Accomplishments

- **Sample contacts** (Task 1, prior executor): `buildSampleData(today, now)` yields 12 contacts across New 4 / Contacted 3 / Touring 2 / Offer 2 / Closed 1, nine open tasks split 2 overdue / 3 due today / 4 upcoming relative to the caller's day, plus added / stage_changed / call / opt_out_set / inquiry activities. Every record is `sample: true` with fixed v4-shaped ids; emails are all `@example.com`, phones all `555-01xx`, and `scripts/guard-real-data.mjs --all` passes. `loadSampleContacts` is idempotent, `removeSampleContacts` hard-deletes in one rw transaction and returns the snapshot, `restoreSampleContacts` puts it back. 110 agent-feature unit tests pass.
- **Quick add** (Task 2): `validateQuickAdd` carries the four UI-SPEC strings verbatim and reports the first invalid field in form order; `duplicateMessage` prefers the email match. `QuickAddDialog` (max 480px, Name focused on open) validates, calls `findDuplicates`, and on a hit renders a neutral in-dialog alert whose `tabindex="-1"` title takes focus, with **Open {First}** (link to `/agent/contact/?id=`) and **Add as a separate contact**; nothing is saved until one is chosen. Saves go through `addContact` as `source: 'manual'`, `consentSource: 'unknown'`, announce "Added {Name} to {Stage}." and hand focus back to the caller via `onadded`.
- **Empty state and notice** (Task 2): `CrmEmptyState` ("No contacts yet", Add a lead / Import leads / Load sample contacts, announces "Loaded 12 sample contacts."). `SampleContactsNotice` is a `role="region" aria-label="Sample contacts"` block on accent-surface, shown while any live contact is a sample; Remove snapshots into `samples-state` and the layout swaps in `UndoStatus` with **Undo** ("Sample contacts restored."). State is cleared on `afterNavigate`.
- **Wiring** (Task 2): the agent layout renders the notice (or its Undo line) between AgentNav and the page; `/agent/contacts/` gained the **Add a lead** toolbar button (UserPlus 16px), the single `QuickAddDialog`, the empty state when `useContacts` is loaded and empty, and focus-to-h1 after an add.
- **E2E** (Task 3): `agent-helpers.ts` exports `announcer`, `loadSampleContacts`, `addLeadByHand`. `agent-entry.spec.ts` covers the empty state, load / notice on `agent/` and the five sub-pages / remove / Undo / reload persistence, the full quick-add flow (empty submit focus, incomplete email, short phone, add, same-email alert with case + whitespace variance, Add as a separate contact, same-phone alert across formats, Open link href, Cancel focus return), and axe at 1280 and 375 with no horizontal scroll. The RentCast tripwire is asserted empty after every test.

## Task Commits

1. **Task 1: Sample-contacts fixture and load / remove / restore** - `56497ce` (feat; first executor)
2. **Task 2: QuickAddDialog, CrmEmptyState, SampleContactsNotice, layout + contacts wiring** - `711f96d` (feat)
3. **Task 3 fix: Undo hands Dexie a plain snapshot** - `b48027b` (fix; Rule 1, found by the first E2E run)
4. **Task 3: E2E helpers and the entry-points spec** - `7d5e4cf` (test)

**Plan metadata:** see the final docs commit.

## Files Created/Modified

- `apps/web/src/lib/features/agent/fixtures/sample-contacts.ts` - buildSampleData, sampleId, SAMPLE_ID_PREFIX
- `apps/web/src/lib/features/agent/samples/samples.ts` - loadSampleContacts, removeSampleContacts, restoreSampleContacts, hasAnyContacts, SAMPLE_COUNT
- `apps/web/src/lib/features/agent/samples/samples.test.ts` - stage split, 2/3/4 task split, sample flag, idempotence, remove leaves user contacts, restore identity, guard shapes
- `apps/web/src/lib/features/agent/samples/samples-state.svelte.ts` - shared undo/status state + clearSamplesState
- `apps/web/src/lib/features/agent/crm/quick-add.ts` / `quick-add.test.ts` - validation and duplicate precedence
- `apps/web/src/lib/features/agent/crm/QuickAddDialog.svelte` - the dialog
- `apps/web/src/lib/features/agent/crm/CrmEmptyState.svelte` - the empty state
- `apps/web/src/lib/features/agent/crm/SampleContactsNotice.svelte` - the notice
- `apps/web/src/routes/(app)/agent/+layout.svelte` - notice / UndoStatus slot, Undo handler, afterNavigate clear
- `apps/web/src/routes/(app)/agent/contacts/+page.svelte` - toolbar, dialog, empty state, focus
- `apps/web/tests/e2e/agent-helpers.ts` - announcer, loadSampleContacts, addLeadByHand
- `apps/web/tests/e2e/agent-entry.spec.ts` - the entry-points spec

## Verification

- `vitest run --project web src/lib/features/agent`: 8 files, 110 tests passed.
- `pnpm check`: 0 errors in this plan's files. The run reports one error and one warning, both in `features/agent/profile/ProfileForm.svelte`, which is the concurrent 08-16 executor's uncommitted work (not touched here).
- `pnpm lint`: eslint clean. `prettier --check .` passes for every file of this plan; the only remaining hits are the 08-16 executor's uncommitted `profile/ProfileForm.svelte` and `routes/(app)/agent/profile/+page.svelte`.
- `pnpm banned`: passed (304 files). `node scripts/guard-real-data.mjs --all`: passed (1379 files). Pre-commit gitleaks + staged guard passed on every commit.
- `pnpm build:root` and `pnpm build:sub`: both wrote their sites.
- Playwright (`--workers=1`, single core): `agent-entry` 8/8 passed (4 root + 4 sub); `agent-shell` 44/44 passed (root + sub); `a11y` pattern (a11y, ai-a11y, settings-a11y) 100/100 passed on root and 100/100 on sub.
- All acceptance-criteria strings for Tasks 2 and 3 confirmed present by grep.

## Decisions Made

- `role="region"` on a `div` for the notice (Svelte reports `<section role="region">` as a redundant role).
- The Remove status uses the snapshot's real count, not the constant.
- The Undo handler passes `$state.snapshot(...)` to Dexie (see deviation 1).
- The duplicate alert is a plain labelled block (no `role="alert"`, per the Phase 3 single-polite-live-region rule); the live announcement carries the message.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Undo of sample removal did nothing (DataCloneError)**
- **Found during:** Task 3 (first `agent-entry` run: announcer stayed on "Removed 12 sample contacts." after clicking Undo, on both bases)
- **Issue:** `samplesState` is a deep `$state` object, so the stored `SampleSnapshot` is returned as a Svelte Proxy. IndexedDB's structured clone cannot clone a Proxy, so `bulkPut` threw and the restore never completed.
- **Fix:** the layout's Undo handler calls `restoreSampleContacts($state.snapshot(snapshot))`.
- **Files modified:** `apps/web/src/routes/(app)/agent/+layout.svelte`
- **Verification:** `agent-entry` "remove and undo" passes on root and sub; the notice returns, the Undo line clears, and "Sample contacts restored." is announced.
- **Committed in:** `b48027b`

**2. [Resume hygiene] QuickAddDialog.svelte formatting**
- The stalled executor left the file failing `prettier --check`; `prettier --write` fixed it. A line-by-line review against the plan found no botched edit (no stray escapes, broken braces or duplicated blocks).

---

**Total deviations:** 1 auto-fixed (1 bug) plus formatting of an inherited file.
**Impact on plan:** The fix was required for the plan's own must-have ("Remove sample contacts removes only samples, with Undo"). No scope creep.

## Issues Encountered

- **Machine constraint:** the host's performance counter runs backwards across cores after a sleep resume, so any multi-core Node process aborts with `Assertion failed: new_time >= loop->time`. Every Node command (vitest, svelte-check, prettier, eslint, vite builds, Playwright) was run through the single-core affinity wrapper on mask 0x200, with Playwright at `--workers=1`. This is what stalled the first executor mid-Task 2.
- **Concurrent executors:** `pnpm check` and `prettier --check .` currently fail on the 08-16 executor's uncommitted profile files; those are outside this plan's `files_modified` and were neither touched nor staged.
- The wrapper's cmd layer rejects paths containing `(app)`; prettier/eslint were pointed at directories or `**` globs instead.

## Known Stubs

- `apps/web/src/routes/(app)/agent/contacts/+page.svelte`: when the CRM has contacts, the page still shows the "Loading your contacts..." line in place of a list. Intentional per the plan ("the list arrives in 08-18"); focus after a quick add therefore goes to the page `h1`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `QuickAddDialog` (with `defaultStage` and `onadded`) and `CrmEmptyState` are ready for the home, pipeline and import pages; `SampleContactsNotice` already covers every agent route through the layout.
- Later E2E specs can seed state with `loadSampleContacts(page)` / `addLeadByHand(page, lead)` and read `announcer(page)`.
- AGT-03's manual-add path is complete; the paste / CSV intake paths belong to their own plans.

## Requirements

`requirements-completed` above copies the plan's `requirements` field verbatim, as the template requires. AGT-03 reads "import leads by pasting a lead email or adding them manually, with duplicate detection": this plan delivers the manual half (and the duplicate detection), while the paste import ships in its own wave-5 plan. `requirements mark-complete AGT-03` was therefore NOT run here (the same call the 08-12 executor made for partially advanced requirements); the plan that lands paste import should mark it.

---
*Phase: 08-agent-portal-profile-lead-intake-crm*
*Completed: 2026-10-07*

## Self-Check: PASSED

- All 13 plan files plus this SUMMARY exist on disk; commits 56497ce, 711f96d, b48027b and 7d5e4cf are in `git log`.
