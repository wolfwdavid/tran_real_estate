---
phase: 06-renter-portal
plan: 15
subsystem: renter-shortlist
tags: [renter, shortlist, status-board, notes, a11y, focus-management, e2e]
requires:
  - "06-08 @tran/core/renter records (SHORTLIST_STATUSES, STATUS_LABELS, groupByStatus, shortlistSummary, needsRemoveConfirm, notesPreview, MAX_NOTES)"
  - "06-11 getShortlistRepo (setStatus, setNotes, remove, liveAll, liveCount)"
  - "06-10 PropertyTypeMark, ListingStatusChip; 06-03 formatRent/formatMonthDay/formatSqft"
  - "06-14 ShortlistToggle confirm pattern, listing/address streetLine"
  - "Phase 4 DataGateway.peekListingById, ProvenanceChip; Phase 3 ConfirmDialog, announce, Textarea, live()"
provides:
  - "features/renter/shortlist: ShortlistBoard (items?/gateway? props), ShortlistCard, NotesEditor, StatusSelect, status-icons (STATUS_ICONS, STATUS_BADGE)"
  - "/renter/shortlist/ board route; renter layout passes the live shortlist count to RenterNav"
  - "RenterNav count reads '1 listing' for one item"
affects: [06-22 gate (RENT-05), 06-16 search cards (nav count now live), Phase 7/8 boards (status-board + focus-after-move pattern)]
tech-stack:
  added: []
  patterns:
    - "Board-level pending focus: a child reports the intent BEFORE its write; an effect focuses the target once the liveQuery result satisfies ready(items)"
    - "Board renders nothing until the first liveQuery result (null initial), so the empty state never flashes or prerenders"
    - "Rent-change notice only for a cached row NEWER than the snapshot (peekListingById, 0 calls)"
key-files:
  created:
    - apps/web/src/lib/features/renter/shortlist/ShortlistBoard.svelte
    - apps/web/src/lib/features/renter/shortlist/ShortlistCard.svelte
    - apps/web/src/lib/features/renter/shortlist/NotesEditor.svelte
    - apps/web/src/lib/features/renter/shortlist/StatusSelect.svelte
    - apps/web/src/lib/features/renter/shortlist/status-icons.ts
    - apps/web/src/lib/features/renter/shortlist/shortlist-ui.test.ts
    - apps/web/src/lib/features/renter/shortlist/ShortlistCard.browser.test.ts
    - apps/web/tests/e2e/renter-shortlist.spec.ts
  modified:
    - apps/web/src/routes/(app)/renter/+layout.svelte
    - apps/web/src/routes/(app)/renter/shortlist/+page.svelte
    - apps/web/src/lib/features/renter/RenterNav.svelte
    - apps/web/src/lib/features/renter/RenterNav.test.ts
key-decisions:
  - "Focus after a status move or a removal is owned by the board, not tick(): the card unmounts/re-mounts only after the liveQuery emits, so the child announces intent before writing and the board focuses once ready(items) holds (06-14's lesson generalised)."
  - "Rent change requires the cached row's fetchedAt to be newer than the snapshot's; an older cached row with a different rent stays silent (it would report the change backwards). Date = cached lastSeenDate, else its fetchedAt."
  - "The recency chip uses the newer cached row when there is one, else the snapshot; cards show it only when not 'recent' (06-10 card rule)."
  - "Meta line is one <p data-status-meta>: an icon+text status badge followed by <time>, reading 'Toured Oct 2' — status is never color alone and the text is not duplicated."
  - "Board/cards take the gateway as a prop (the route reads getDataRuntime()), so SSR tests render without a runtime context."
  - "Summary and nav use '1 listing' for a single item (UI-SPEC '{n} listings' kept for every other count)."
  - "A #item-{id} fragment (from 'See it on your shortlist') scrolls to and focuses the card once the first query result renders."
requirements-completed: []
metrics:
  duration: ~45min
  completed: 2026-10-05
  tasks: 2
  files: 14
---

# Phase 6 Plan 15: Shortlist board Summary

**`/renter/shortlist/` now tracks every saved listing from its stored snapshot at 0 calls: a labelled native Status select moves the card through Saved, Contacted, Toured, Applied and Signed (stacked sections below 1280px, a five-column board from 1280px), notes save explicitly, removal asks first only when notes or progress would be lost, a newer cached rent shows "Rent changed from $X to $Y on Mon D.", and the Renter tools nav shows the live count.**

Advances RENT-05 (shortlist with status tracking). It stays open until the 06-22 gate, so `requirements mark-complete` was not run.

## Tasks

| # | Task | Commit |
| --- | --- | --- |
| 1 | Shortlist cards, notes, remove, rent-change line, empty state, nav count, route | c203872 |
| 2 | Status select, five-status board, E2E | 29a9068 |

## What the tests prove

- **shortlist-ui.test.ts (12, SSR, stub repo):** nothing renders before the first query result; the empty state copy + "Search rentals" → `/renter/`; the summary "3 listings · 2 contacted · 1 applied"; five h2s "Saved (1) … Signed (0)" in order with `tabindex="-1"` and "Nothing here yet." in each empty one; `id="item-"+encoded id` with `aria-labelledby` on the address link and the `?id=` href; rent, facts ("2 bd · 1.5 ba · 1,050 sq ft", "Studio", missing parts omitted), "Saved Oct 2"; a 130-char note previews 120 + "…" with Edit notes; Add notes when empty; the Sample data chip on sample snapshots only; the labelled native select with five options and the applied option selected; the badge has an icon and text; the remove button's name.
- **ShortlistCard.browser.test.ts (4, Chromium, real repo):** a newer cached row at $1,575 shows "Rent changed from $1,500 to $1,575 on Oct 4." (peekListingById called with the id, axe clean); the same rent or an OLDER cached row shows nothing; notes save explicitly, persist, counter "17 of 2,000", focus returns to the notes button; Escape cancels without saving and refocuses Add notes.
- **renter-shortlist.spec.ts (4 × root/sub = 8):** empty state + axe; save two sample listings from their detail pages → nav "Shortlist 2 listings" (sr-only " listings"); summary "2 listings · 0 contacted · 0 applied"; Status → Toured moves the card under Toured, the moved select keeps focus, summary "2 listings · 1 contacted · 0 applied", announcement "{street} moved to Toured."; notes "Ask about parking" saved and announced; reload keeps status + notes, meta matches `/^Toured [A-Z][a-z]{2} \d{1,2}$/`; every badge has visible text and one icon; Remove on the Toured card opens the dialog with focus on Keep it, "Remove listing" removes it, announces "Removed…", and focuses the Toured heading; Remove on the plain Saved card removes it with no dialog and focuses "Your shortlist is empty"; sample chip on each card; axe clean on populated board, notes editing, remove dialog and the 1280px board; five columns share one row at 1280×900; at 375×812 `scrollWidth <= 375` and sections stack; a `#item-` link from the detail page focuses that card; 0 RentCast calls throughout.

## Mutation check (not committed; restored)

| Mutation | Killed by |
| --- | --- |
| Board pending-focus effect no longer focuses the target | E2E "save two, move one…" (`toBeFocused` on the moved select) |

## Verification

- `vitest --project web src/lib/features/renter/shortlist`: 12/12. `--project web-browser src/lib/features/renter/shortlist`: 9/9 (incl. 06-14's toggle tests).
- `test:unit`: 161 files / 3136 tests passed.
- `pnpm --filter web check`: 0 errors, 0 warnings (an earlier run showed errors only in 06-18's in-progress `OutreachSection.browser.test.ts`; gone by the final run). ESLint + Prettier clean on all touched files. `banned`: passed (167 files). `ui:guard`: passed.
- `build:root` + `build:sub` + `csp:assert`: 17 pages per base. `playwright test renter-shortlist renter-listing routing a11y layout`: 378 passed. Run under `.tools/build.lock`, released.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] "Shortlist 1 listings" in the nav**
- RenterNav's hidden suffix was always " listings". It now reads " listing" for 1; a RenterNav test covers it. The board summary uses the same rule.
- **Commit:** c203872

**2. [Rule 2 - Correctness] Rent change only from a newer row**
- The plan compares the snapshot against the cached row. Without an age check an older cached search (e.g. the search the snapshot was later refreshed from by id) would announce a rent change backwards. The notice now requires `cached.fetchedAt > snapshot.fetchedAt`; a browser test covers both sides.
- **Commit:** c203872

**3. Focus after a move is board-owned (plan: `tick()` then `getElementById` in StatusSelect)**
- A status move only re-renders after the liveQuery emits, which is later than `tick()` (06-14 hit the same with removal). StatusSelect and ShortlistCard report intent before writing; the board focuses the select / next card / section heading once the live items satisfy the change. Mutation-checked.

**4. Additive**
- `status-icons.ts` (icon + badge class per status), `ShortlistCard.browser.test.ts` (rent change and notes behaviour that SSR cannot run), a `#item-` fragment handler (the detail page's "See it on your shortlist" link lands focus on the card), and the board's `items`/`gateway` props for SSR tests and the route.
- The notes-editor browser test skips axe: component tests load no CSS, so the two adjacent unstyled buttons trip target-size. The E2E runs axe with notes editing open.
- `Signature` exists in @lucide/svelte 1.45.0, so no `FileCheck` fallback was needed.

## Known Stubs

None.

## Self-Check: PASSED
