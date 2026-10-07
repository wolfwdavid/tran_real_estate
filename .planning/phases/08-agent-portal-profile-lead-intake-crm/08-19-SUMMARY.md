---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 19
subsystem: agent-crm-ui
tags: [crm, pipeline, kanban, drag-and-drop, html5-dnd, dropdown-menu, bits-ui, wcag-2.5.7, undo, svelte5, playwright, axe]

# Dependency graph
requires:
  - phase: 08-12
    provides: contacts-repo moveStage / undoMove (MoveUndo), live.svelte useContacts
  - phase: 08-14
    provides: tasks-live.svelte useOpenTasks
  - phase: 08-15
    provides: QuickAddDialog (onadded), CrmEmptyState, E2E helpers (announcer, loadSampleContacts, rentcastTripwire)
  - phase: 08-17
    provides: ContactCard (actions snippet, moving, data-contact-id), SmartListFilter, list-state (readListParam, withParams)
  - phase: 08-10
    provides: dropdown-menu copy-in (RadioGroup / RadioItem), UndoStatus
  - phase: 08-09
    provides: "@tran/core/crm sortForBoard, stageCounts, matchesList, countLists, nextOpenTask, SMART_LIST_LABELS"
provides:
  - "features/agent/pipeline/dnd.ts: DRAG_MIME, DRAG_MEDIA, readDraggedId(dt, knownIds)"
  - "features/agent/pipeline/MoveMenu.svelte { contact, onmove }: 44px outline trigger 'Move {Name}', radio group of the five stages"
  - "features/agent/pipeline/board-state.svelte.ts: createBoardState() -> { undo, status, pending, move(contact, to, {focus}), undoLast(), requestFocus(req), settle(contacts), clear() }, BOARD_UNDO_ID, focusInView"
  - "features/agent/pipeline/StageColumn.svelte: one labelled stage section with counts, keyed cards, native drop target and drop hint"
  - "features/agent/pipeline/StageBoard.svelte { contacts, tasks, board, onaddlead }: filter row, UndoStatus, Jump to row, five columns"
  - "/agent/pipeline/ route: empty state, board, quick add with focus to the new card"
  - "tests/e2e/agent-pipeline.spec.ts (9 tests x 2 bases)"
affects: [08-20 today page (counts / links into #stage-), 08-21 contact detail stage select (same moveStage path and copy), 08-23 contact-page activity E2E, 08-26 AGT gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One move path: menu, pointer drop and Undo all call board-state move()/undoLast(), which wrap the 08-12 transactional repo and own status, announcement and focus"
    - "Focus after a live-query write is a FocusRequest { ready(contacts), target(), fallback() } settled by an $effect over the live list, never a bare tick()"
    - "Native HTML5 DnD as a progressive enhancement behind svelte/reactivity MediaQuery(DRAG_MEDIA); the Move menu is the WCAG 2.5.7 path on every card"
    - "Derived Map indexes inside $derived are built from entries (new Map(entries)), never mutated, to satisfy svelte/prefer-svelte-reactivity"

key-files:
  created:
    - apps/web/src/lib/features/agent/pipeline/dnd.ts
    - apps/web/src/lib/features/agent/pipeline/dnd.test.ts
    - apps/web/src/lib/features/agent/pipeline/MoveMenu.svelte
    - apps/web/src/lib/features/agent/pipeline/board-state.svelte.ts
    - apps/web/src/lib/features/agent/pipeline/StageColumn.svelte
    - apps/web/src/lib/features/agent/pipeline/StageBoard.svelte
    - apps/web/tests/e2e/agent-pipeline.spec.ts
  modified:
    - apps/web/src/routes/(app)/agent/pipeline/+page.svelte

key-decisions:
  - "08-19: no svelte-ignore comments on the drag handlers: Svelte 5.57 emits no a11y warning for drag events on section/li, and the repo's error-level svelte/no-unused-svelte-ignore rejects an unused directive, so the WCAG 2.5.7 rationale lives in plain HTML comments"
  - "08-19: focus after a move waits for the live contacts view (FocusRequest settled by StageBoard's $effect) because the Dexie liveQuery re-render is asynchronous and a bare tick() would focus the card's old, about-to-be-destroyed element"
  - "08-19: the source column is not a drop target (dropping a card where it already is would be a no-op), and a drop carrying any text that is not a known contact id is ignored"
  - "08-19: the pointer-drag E2E drops on the column heading, which is always in view: Playwright's dragTo scrolls its target into view after the press, and a column taller than the viewport shifted the page under the held pointer so Chromium dragged the card that slid underneath"

patterns-established:
  - "Board focus: requestFocus({ ready, target, fallback }) + settle(liveList) from an $effect"
  - "E2E native drag: fonts.ready + a short settle before a raw press, one move past the drag threshold, then glide; drop targets must not need scrolling"

requirements-completed: [AGT-04]

# Metrics
duration: ~55 min (reading from ~01:05Z; Task 1 commit 01:16Z; E2E commit 01:32Z; docs after)
completed: 2026-10-07
---

# Phase 8 Plan 19: Pipeline board with Move menu and native drag and drop Summary

**A five-column kanban (New, Contacted, Touring, Offer, Closed; side by side from 1280px, stacked with a Jump to row below) where every card moves through one tested path: a bits-ui radio Move menu on every card (keyboard and single tap, WCAG 2.5.7), native HTML5 drag at 1280px with a fine pointer, and an Undo line, each announcing through the Phase 3 live region and returning focus to the moved card, proven by Playwright on both bases with zero RentCast traffic.**

## Performance

- **Duration:** ~55 min wall clock (about 10 min reading the plan, dependency summaries and components; Task 1 and 2 committed at 01:16Z; E2E green and committed at 01:32Z; SUMMARY and state after)
- **Started:** 2026-10-07T01:05Z (approx.)
- **Completed:** 2026-10-07T01:33Z (E2E commit; docs commit follows)
- **Tasks:** 3 of 3
- **Files modified:** 8 (7 created, 1 modified)

## Accomplishments

- **dnd.ts** (pure, 6 unit tests): `DRAG_MIME = 'text/plain'`, `DRAG_MEDIA = '(min-width: 1280px) and (hover: hover) and (pointer: fine)'`, and `readDraggedId(dt, knownIds)`, which returns an id only when it is a known live contact id (null-safe, swallows a throwing `getData`), so a drag of arbitrary text from elsewhere never moves anything.
- **MoveMenu.svelte**: 44px outline trigger with `ArrowRightLeft` 16px and visible "Move", `aria-label="Move {Name}"`, `data-move-for={id}`; content label "Move {Name} to" over a `DropdownMenu.RadioGroup` of the five stages (current stage checked with the copy-in's Check icon and 600 weight). Choosing the current stage closes with no change; another stage calls `onmove`. Escape closes and returns focus to the trigger (bits-ui default).
- **board-state.svelte.ts**: `createBoardState()` is the single move path. `move(contact, to, { focus })` calls `moveStage` (08-12 writes stage + "Moved from {Old} to {New}" activity in one transaction), sets the UndoStatus text "Moved {Name} to {Stage}." and announces it; with `focus: true` (menu) it queues a focus request to the card's Move button in its new column, with the `#board-undo` status line as the fallback when the active filter hides the card; a pointer drop uses `focus: false` (no focus change, announcement only). `undoLast()` calls `undoMove`, sets and announces "Moved {Name} back to {Old}." and focuses the restored card's Move button. Focus requests settle from `StageBoard`'s `$effect` once the live contacts view reflects the write (`await tick()`, then `scrollIntoView` instant under reduced motion, then `focus({ preventScroll })`).
- **StageColumn.svelte**: `<section id="stage-{stage}" aria-labelledby="stage-{stage}-title">` surface well (min-height 160px, radius-lg, 16px padding); `h2` "{Stage}" with a visually hidden ", {n} contacts" (or ", {shown} of {total} contacts" under a filter) so the region reads "Touring, 2 contacts"; a visible tabular count (`[data-stage-count]`); cards in a keyed `<ul>` (two columns from 768px in the stacked view, one in board columns), each a `ContactCard` variant board with the MoveMenu in its actions snippet; "No contacts in {Stage}." when empty (still a drop target). While `dragEnabled`: cards are `draggable` with a `GripVertical` handle top-right and `cursor-grab`; `dragstart` calls `setData(DRAG_MIME, id)` + `effectAllowed = 'move'`; the source card shows surface fill, 2px dashed border-strong and "Moving..." (ContactCard `moving`); valid columns get a 2px dashed border-strong outline, the one under the pointer a 2px solid primary outline plus "Drop to move to {Stage}" at the column foot (a depth counter turns child dragenter/dragleave pairs into one enter and one leave). No transitions or animations: moves re-render instantly.
- **StageBoard.svelte**: SmartListFilter + **Add a lead** (outline, UserPlus) row wrapping below 640px; `<UndoStatus id="board-undo">` with Undo only while an undo token exists; a `nav aria-label="Jump to"` row of five 44px `#stage-{stage}` links "{Stage} {n}" hidden from 1280px; `grid gap-6 xl:grid-cols-5 xl:gap-4` (Tailwind `xl` is 1280px, the same breakpoint Phase 6's ShortlistBoard uses). Cards sort with `sortForBoard` on a next-open-task due map from `useOpenTasks()`. `dragEnabled = new MediaQuery(DRAG_MEDIA).current`. The filter reads `?list=` in `onMount`, writes it with `replaceState(resolve('/agent/pipeline/') + withParams(...))` and announces "Showing {List}: {n} contacts."; the source column is never a drop target.
- **/agent/pipeline/**: h1 Pipeline (`tabindex="-1"`); the prerendered loading line until `useContacts().loaded`; `CrmEmptyState` when empty; otherwise `StageBoard`; one `QuickAddDialog` whose `onadded` queues focus to the new card's name link (`#contact-{id}-name`) with the h1 as the fallback; a `#stage-{stage}` hash scrolls that section into view once the board renders (instant under reduced motion).
- **E2E** (`agent-pipeline.spec.ts`, 9 tests, root and sub): five stages in order with "{Stage}, {n} contacts" headings; keyboard-only Jordan Example through Contacted, Touring, Offer, Closed and back to New (Enter opens the menu, ArrowDown until the `menuitemradio` is focused, Enter; asserts the card inside `#stage-{id}`, the announcement, focus back on the Move button, the status line and Undo); choosing the current stage changes nothing; pointer drag at 1280x900 (a held drag shows "Moving" on the source and "Drop to move to Touring" on the target, release moves the card and updates both counts; then `dragTo` onto the Offer heading moves it again); Undo (card back in New, "Moved Jordan Example back to New.", focus, reload shows the original counts, so the activity is gone); the Show filter ("Due today (5)" gives New "2 of 4", heading "New, 2 of 4 contacts", `?list=due-today`, reload restores the pressed state, "All (12)" clears the param); stacked 375 (Jump to row, "Offer 2" link scrolls `#stage-offer` into the viewport, no `li[draggable="true"]`, single-tap move, no horizontal scroll); `#stage-closed` deep link; axe clean at 1280, 1024, 375 and with the Move menu open. The RentCast tripwire is asserted empty after every test.

## Task Commits

1. **Task 1: MoveMenu, DnD helpers, board state with a single move/undo path** - `f629df2` (feat)
2. **Task 2: StageColumn, StageBoard and the pipeline route** - `d4f1dde` (feat)
3. **Task 3: Pipeline E2E (keyboard, drag, undo, filter, axe)** - `7d61c92` (test)

**Plan metadata:** see the docs(08-19) commit that follows this file.

## Files Created/Modified

- `apps/web/src/lib/features/agent/pipeline/dnd.ts` - DRAG_MIME, DRAG_MEDIA, readDraggedId
- `apps/web/src/lib/features/agent/pipeline/dnd.test.ts` - known / unknown / null / throwing / wrong-type / empty-set cases plus the media-query constant
- `apps/web/src/lib/features/agent/pipeline/MoveMenu.svelte` - the per-card Move menu
- `apps/web/src/lib/features/agent/pipeline/board-state.svelte.ts` - move / undo / focus-settle state
- `apps/web/src/lib/features/agent/pipeline/StageColumn.svelte` - one stage section with cards, counts and the native drop target
- `apps/web/src/lib/features/agent/pipeline/StageBoard.svelte` - filter row, UndoStatus, Jump to row, the five columns, drag wiring
- `apps/web/src/routes/(app)/agent/pipeline/+page.svelte` - route: empty state, board, quick add, hash scroll
- `apps/web/tests/e2e/agent-pipeline.spec.ts` - the pipeline spec

## Verification

Every Node command ran through the single-core affinity wrapper on mask 0x1000 (see Issues Encountered); plain git did not need it.

- `vitest run --project web src/lib/features/agent/pipeline`: 6/6. `vitest run --project web src/lib/features/agent`: 15 files, 172/172 passed.
- `pnpm check` (svelte-check): 0 errors and 0 warnings in every 08-19 file. The repo-wide run reported, at different moments, errors only in other wave-5 executors' uncommitted files (08-18 `import/ImportReview.svelte` missing `@tran/core/csv/contact-columns`; 08-22 `profile/logo-pipeline.test.ts` BlobPart typing; 08-20/08-21 RED tests whose modules did not exist yet). None touched or staged.
- Prettier and eslint on `features/agent/pipeline`, `routes/**/agent/pipeline/*.svelte` and the spec: clean. `pnpm banned`: passed (319 files).
- `pnpm build:root` and `pnpm build:sub`: both wrote their sites on the first attempt.
- Playwright `agent-pipeline --workers=1`: **18/18 passed (9 root + 9 sub)** on the final run (first run 12/18, see Issues Encountered).
- Acceptance greps: MoveMenu contains `RadioGroup`, `aria-label`, `Move {`, the `to` label and `data-move-for`; `aria-grabbed|aria-dropeffect` sums to 0 across the folder; board-state contains `moveStage`, `undoMove`, `Moved `, ` back to `, `announce(`; dnd.ts contains `(hover: hover) and (pointer: fine)`, `1280px` and the `'text/plain'` literal; StageColumn contains `id="stage-{stage}"`, `aria-labelledby`, `ondragover`, `ondrop`, `setData` (with `DRAG_MIME`), `Drop to move to`, `No contacts in`, and `grep -c "transition\|animate-"` is 0; StageBoard contains `Jump to`, `DRAG_MEDIA`, `MediaQuery`, `UndoStatus`, `SmartListFilter`; the spec contains `dragTo`, `menuitemradio`, `ArrowDown`, `back to New.`, `of 4`, `Jump to`, `rentcastTripwire` and loops over the five stage names. The one criterion not met literally is the `svelte-ignore a11y_no_static_element_interactions` comment (deviation 1 below).

## Decisions Made

- No `svelte-ignore` on the drag handlers (deviation 1).
- Focus after a move is a `FocusRequest` settled by an `$effect` over the live contacts list rather than a bare `tick()`, because the Dexie liveQuery re-render is asynchronous and the keyed `{#each}` destroys the card's old element when it changes column; a `tick()`-then-focus would land on the element about to be removed.
- `board-state` exposes `status` (the UndoStatus text), `pending`, `requestFocus`, `settle`, `clear`, `BOARD_UNDO_ID` and `focusInView` beyond the plan's `{ undo, move, undoLast }` shape; `undo` keeps the plan's `{ message, token, name, from }`. The route creates the state and passes it to `StageBoard` so the quick-add focus request can use the same settle mechanism.
- The source column is excluded from the drop targets (a drop there is a no-op, so offering it would show a misleading "Drop to move to New"); dropping on the same stage through the repo returns null and changes nothing either way.
- The derived Map indexes are built from entries because `svelte/prefer-svelte-reactivity` (error level) rejects `.set()` on a plain Map inside `$derived.by`; these maps are recomputed, never mutated, so `SvelteMap` would be the wrong tool.
- The E2E drops Playwright's `dragTo` onto the column `h2` (decision in frontmatter) and settles the page (`document.fonts.ready` plus 300 ms) before the raw press-and-move that starts the held drag.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dropped the plan-mandated `<!-- svelte-ignore a11y_no_static_element_interactions -->` comments**
- **Found during:** Task 2 (StageColumn)
- **Issue:** The plan (and RESEARCH Pattern 7, which marked this LOW and said to confirm what the compiler emits) required the ignore comment on the drag handlers. Svelte 5.57 emits no a11y warning for drag events on `<section>` or `<li>` (svelte-check: 0 warnings; eslint `svelte/valid-compile` silent; no `warningFilter` is configured), and the repo's error-level `svelte/no-unused-svelte-ignore` reported every directive as unused (23 errors), so the comment as written cannot pass lint.
- **Fix:** Replaced them with plain HTML comments that state the WCAG 2.5.7 equivalence (the Move menu) and why no ignore is needed.
- **Files modified:** `apps/web/src/lib/features/agent/pipeline/StageColumn.svelte`
- **Verification:** svelte-check 0 warnings, eslint clean on the folder, axe clean in four layouts.
- **Committed in:** `d4f1dde`

**2. [Rule 1 - Bug] Replaced three mutated Maps in `$derived.by` with entry-constructed Maps**
- **Found during:** Task 2 (StageBoard)
- **Issue:** `svelte/prefer-svelte-reactivity` (error) flagged `new Map()` + `.set()` inside the derived indexes.
- **Fix:** `new Map(entries)` built from `filter`/`map`/`flatMap`; same values, no mutation.
- **Files modified:** `apps/web/src/lib/features/agent/pipeline/StageBoard.svelte`
- **Verification:** eslint clean; the filter and sort E2E assertions pass.
- **Committed in:** `d4f1dde`

**3. [Rule 1 - Bug] `replaceState` call shape for `svelte/no-navigation-without-resolve`**
- **Found during:** Task 2
- **Issue:** The rule flagged `replaceState(\`${resolve(...)}...\`)` even with the disable comment on the line above, because Prettier wrapped the call across lines and the directive no longer covered the call.
- **Fix:** Build `href` on its own line and call `replaceState(href, page.state)` under a one-line disable with the resolve() rationale, matching the SearchPage / AnalyzerPage precedent.
- **Committed in:** `d4f1dde`

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 lint-level bugs). **Impact on plan:** none on behaviour; all three were required to pass the repo's own lint gates. No scope creep.

## Issues Encountered

- **First Playwright run: 12/18.** Two causes, both in the spec, none in the board:
  1. `page.getByText('Moved ... to Contacted.')` matched both the UndoStatus span and the Phase 3 live region (strict-mode violation). Scoped the status assertions to `#board-undo`.
  2. `dragTo(section)` dragged the wrong card: Playwright scrolls its target into view after the press, and the Offer column (bottom at 1010 px in a 900 px viewport) scrolled the page 152 px under the held pointer, so Chromium started the drag from the card that slid underneath (Drew Exampleton). Diagnosed with a throwaway logging spec (deleted, never committed). Dropping on the column heading, which is always in view, fixed it. A separate flake, where the raw press-and-move occasionally did not start a drag right after navigation on the single pinned core (2 of 4 debug runs), went away with `document.fonts.ready` plus a 300 ms settle before the press (4 of 4, then 18/18 on the real spec).
- **Machine constraint:** the host's performance counter runs backwards across cores after a sleep resume, so every Node process (vitest, svelte-check, prettier, eslint, vite builds, Playwright) was pinned to one core through the wrapper; builds took ~30 s each and the spec ~1.3 min.
- **Concurrent executors:** repo-wide `pnpm check` was red at times on 08-18 / 08-20 / 08-21 / 08-22 files that were still being written; those are outside this plan's `files_modified` and were neither edited nor staged. Both builds succeeded on the first attempt.

## Requirements

`requirements-completed` above copies the plan's `requirements` field (`[AGT-04]`) verbatim, as the template requires. Following the Phase 8 convention (08-12, 08-14, 08-15, 08-16), `requirements mark-complete` was **not** run: AGT ids stay open until the 08-26 gate closes them, and AGT-04's "detail-page stage select" path belongs to 08-21.

## Known Stubs

None. Every control is wired to the 08-12 repo and the live views; the E2E proves the menu, drop and Undo paths end to end.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-20 (Today) can link into `/agent/pipeline/#stage-{stage}`; the route scrolls the section into view.
- 08-21 (contact detail) should reuse `moveStage` / `undoMove` with the same "Moved {Name} to {Stage}." / "back to" copy so the activity log and Undo behave identically; `features/agent/pipeline/board-state.svelte.ts` is board-specific (DOM focus by `#stage-`), so the detail page needs its own thin status wrapper rather than importing it.
- 08-23's contact-page E2E asserts the "Moved from {Old} to {New}" activity entries in the browser, as the plan notes.
- No blockers.

---
*Phase: 08-agent-portal-profile-lead-intake-crm*
*Completed: 2026-10-07*

## Self-Check: PASSED

All 8 plan files plus this SUMMARY exist on disk; commits f629df2, d4f1dde and 7d61c92 are in `git log`.
