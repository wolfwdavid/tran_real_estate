---
phase: 06-renter-portal
plan: 20
subsystem: renter-saved-searches
tags: [renter, saved-search, alerts, new-since, dexie, liveQuery, page-clock, e2e, axe, tdd, mutation-test]
requires:
  - "04-19 createSavedSearchRepo (create/list/complete/markSeen/snapshot/remove), runDueSearches"
  - "04-22 savedSearchRepo port + DataShell on-open checkSavedSearchesOnOpen"
  - "04-20 NewSinceBadge; 04-14 ProvenanceChip; Phase 3 ConfirmDialog, dialog copy-in"
  - "06-07 filteredNewIds, savedSearchSummary, defaultSearchName, encodeSearchParams"
  - "06-08 canSaveAnother / MAX_SAVED_SEARCHES; 06-11 getSearchMetaRepo, searchRequest"
  - "06-13 search controller + stubs; 06-16 newIds -> New badge on cards"
provides:
  - "features/renter/saved/saved-searches.ts: createRenterSavedSearches(deps), getRenterSavedSearches(gateway), matchesSearch, cleanName, NAME_MAX, RenterSavedSearch"
  - "SaveSearchDialog (save | rename | limit), SaveSearchButton, SavedSearchesSection, focus.ts"
  - "features/shared/listings/SavedSearchRow.svelte (prop-driven, reusable by Phase 7)"
  - "SearchPage: ?saved={id} opens a saved search (newIds before markSeen, 0 calls)"
  - "lib/data saved-search-repo: rename(id, name)"
  - "tests/e2e/renter-saved.spec.ts (3 tests x root + sub)"
affects: [06-22 gate (RENT-04), Phase 7 (SavedSearchRow reuse)]
key-files:
  created:
    - apps/web/src/lib/features/renter/saved/saved-searches.ts
    - apps/web/src/lib/features/renter/saved/saved-searches.test.ts
    - apps/web/src/lib/features/renter/saved/SaveSearchDialog.svelte
    - apps/web/src/lib/features/renter/saved/focus.ts
    - apps/web/src/lib/features/shared/listings/SavedSearchRow.svelte
    - apps/web/tests/e2e/renter-saved.spec.ts
  modified:
    - apps/web/src/lib/features/renter/saved/SaveSearchButton.svelte
    - apps/web/src/lib/features/renter/saved/SavedSearchesSection.svelte
    - apps/web/src/lib/features/renter/search/SearchPage.svelte
    - apps/web/src/lib/data/saved-search-repo.ts
key-decisions:
  - "A save writes the Phase 4 row, then complete() with a baseline snapshot (takenAt = the results' fetchedAt, so the scheduler re-runs 24h after the data was fetched), then the meta row. They live in two databases, so a failure after create compensates by tombstoning both (no cross-DB transaction exists)"
  - "Rename needed a Phase 4 repo method: additive rename(id, name) via the existing live-row patch; the name stays in the Phase 4 row (no parallel model)"
  - "The 10-limit counts Phase 4 renter rows at click time (canSave()), not the rendered list"
  - "View results is a link to /renter/?{saved query}&saved={id}; SearchPage handles it on mount AND on a same-page client navigation (an effect keyed on the saved id), and the URL mirror drops `saved` so a reload never re-marks"
  - "Rows/badge source is the current runtime mode (sample -> Sample chip, '(sample data)', count forced to 0); the waiting line shows for a due search in live mode at the cap"
requirements-completed: []
metrics:
  duration: ~50min
  completed: 2026-10-05
  tasks: 2
  files: 10
---

# Phase 6 Plan 20: Renter saved searches Summary

Renters can save the current search (name prefilled, 60-char cap), see a **Saved searches** section with "{n} new since your last visit" counted only for new listings that still match the saved filters, and open **View results** at 0 calls with exactly those listings badged New and the search marked seen. The 10-search limit explains itself, Rename and confirmed Delete are storage-only and keep the shortlist. Phase 4's on-open scheduler does every re-run (at most once per 24 hours); this plan adds no scheduler.

Advances **RENT-04**. It stays open until the 06-22 gate (`requirements mark-complete` not run).

## Phase 4 functions used

| Need | Phase 4 API |
| --- | --- |
| Create the search | `savedSearchRepo().create({ portal: 'renter', endpoint: 'rental-listings', params: wide server params })` |
| Baseline snapshot + lastRunAt | `repo.complete(id, buildSnapshot(null, observed, { takenAt: provenance.fetchedAt }))` |
| New since last visit | `repo.snapshot(id)` + `row.lastSeenAt` -> core `filteredNewIds` with rows from `gateway.peek(searchRequest(location))` |
| View results | `repo.markSeen(id)` after the new ids are read |
| Delete | `repo.remove(id)` + `getSearchMetaRepo().remove(id)` |
| Rename | `repo.rename(id, name)` (added here) |
| Re-runs | unchanged `checkSavedSearchesOnOpen` in DataShell |

## Tasks

| # | Task | Commits |
| --- | --- | --- |
| 1 | Renter saved-search service | 3fad285 (RED), 20eef82 (GREEN) |
| 2 | Dialog, button, row, section, page wiring, E2E | 6ca93a9 |

## What the tests prove

**saved-searches.test.ts (11, Node, real Phase 4 repo + meta repo on fake-indexeddb, gateway whose get/refresh throw):** save writes the Phase 4 row (`portal: 'renter'`, wide params, `lastRunAt` = fetchedAt, `lastSeenAt` = now), a 3-item baseline snapshot and same-id meta, newCount 0, no spend; empty name rejected, long names sliced to 60; the 11th save returns `{ error: 'limit' }` and writes nothing; only renter rows count; rename trims/rejects/slices; remove tombstones both; after a scheduler pass with 3 new ids (2 within Max $2,000) newCount is 2, `openForResults` returns those 2 and the saved state, sets lastSeenAt, then newCount is 0; sample mode shows no drift; ordering by new count then name; `findMatching`.
Mutations (restored after): removing `markSeen` -> red; removing the limit check -> red.

**renter-saved.spec.ts (3 tests x root + sub = 6 passed):**
- Live, `page.clock.setFixedTime(T)`: search 74201 (1 call), Max 2000, the dialog prefilled "74201 · Up to $2,000" with the body copy (axe clean), save -> **Saved search** `aria-pressed="true"`, row "No new listings" + "Checked … from RentCast", 1 call; "Manage in Saved searches" focuses the row. T+1h reload: 0 new calls. T+25h with 3 new rows (2 at or under $2,000): exactly 1 new listings call and "2 new since your last visit" (axe clean); reload at T+25h: still 2 calls. View results: 0 calls, exactly 2 cards with the New badge, `saved` dropped from the URL, Max restored, row back to "No new listings".
- Limit: 10 seeded searches -> "You have 10 saved searches", body copy, only **Close** (focused), no textbox, axe clean, 0 calls.
- Sample: shortlist a card, save, Sample chip + "(sample data)" and no "new"; rename (empty -> "Give this search a name.", then "Search renamed to Near work."); Delete -> **Keep search** focused, body mentions the shortlist, **Delete search** -> "Saved search deleted.", section gone; the shortlisted listing is still on `renter/shortlist/`; 0 calls.

## Verification

- `vitest --project web src/lib/features/renter/saved`: 11 passed; `saved-search-repo`: 13 passed.
- `corepack pnpm check`: 0 errors. eslint + prettier clean on all touched files. `banned` passed (176 files), `ui:guard` passed.
- `build:root` + `build:sub` + `csp:assert` (17 pages each) under `.tools/build.lock` (released).
- `playwright test renter-saved`: 6/6. `renter-search renter-harness renter-affordability layout a11y app-notice` all green; the 4 failures in that run were `renter-results` tabs/375px expecting the old "Loading map…" stub, which 06-19 replaced in 27decd6 (06-19's scope).
- `test:unit`: 3168 passed, 2 failed: the known `precommit.test.ts` HEAD-moved flake (re-run 10/10) and `ResultsView.browser.test.ts` map-stub assertion (06-19's MapTab change, not this plan).
- Acceptance grep: `saved-searches.ts` has no `.get(` / `.refresh(`.

## Deviations from Plan

**1. [Rule 3 - Blocking] Phase 4 repo had no rename.** Added `rename(id, name)` to `lib/data/saved-search-repo.ts` (additive, via the existing live-row patch). Commit 20eef82.

**2. [Rule 1 - Constraint] "One transaction" is impossible across the two databases** (DataDb holds the Phase 4 rows, TranDb the meta). Save writes in order and compensates (tombstones both) on failure.

**3. [Rule 1 - Type] `maxlength={60}` instead of the literal `maxlength="60"`.** The shadcn `Input` component types `maxlength` as a number; the string form fails svelte-check. Same attribute, same rendered HTML.

**4. [Rule 2 - Missing critical] Same-page View results.** A client navigation from `/renter/` to `/renter/?…&saved=id` does not remount SearchPage, so an effect opens a newly seen `saved` id (guarded so each id is marked once).

**5. Simplification: the 'limit' E2E seeds 10 Phase 4 rows** with the Phase 4 `seedSavedSearches` helper (no meta rows), since the limit counts Phase 4 renter rows.

**6. Not built: a component browser test.** The dialogs and rows are covered end to end (focus, axe, copy) in renter-saved on both bases.

## Known Stubs

None.

## Self-Check: PASSED
