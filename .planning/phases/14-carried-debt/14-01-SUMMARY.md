---
phase: 14-carried-debt
plan: 01
subsystem: renter-ui
tags: [a11y, ids, focus, renter, map, e2e]
requires:
  - phase: 14-12
    provides: hard marketing budget gate (unchanged; renter code is not imported by marketing routes)
provides:
  - ListingCard idPrefix prop (default 'card') and module export addrIdFor(prefix, listingId)
  - Duplicate-id E2E assertions on the Map tab at 1280x800 and 375x812 with a pin selected
affects: [renter results, split list, map preview]
tech-stack:
  added: []
  patterns: ["Per-container id namespace on reusable cards via idPrefix + a module-script id helper shared by the card and the focus lookups"]
key-files:
  created: []
  modified:
    - apps/web/src/lib/features/renter/search/ListingCard.svelte
    - apps/web/src/lib/features/renter/search/ResultsList.svelte
    - apps/web/src/lib/features/renter/map/SplitList.svelte
    - apps/web/src/lib/features/renter/map/SelectedListingPreview.svelte
    - apps/web/tests/e2e/renter-map-split.spec.ts
    - apps/web/tests/e2e/renter-map.spec.ts
key-decisions:
  - "ListingCard ids are namespaced per container: card (List tab, default), split (split list), preview (map preview); addrIdFor() is the single builder used by the card and both focus lookups"
  - "SelectedListingPreview keeps its id-free focus selector (UI-SPEC allows either)"
requirements-completed: [DEBT-01]
duration: 15min
completed: 2026-11-05
---

# Phase 14 Plan 01: ListingCard id prefix (DEBT-01) Summary

**ListingCard now takes an `idPrefix` and exports `addrIdFor(prefix, id)`, so the hidden List panel (`card-`), split list (`split-`) and map preview (`preview-`) render distinct address-link ids; new E2E proves zero duplicate ids on the Map tab at 1280x800 and 375x812 with a pin selected.**

## Performance

- Duration: about 15 min
- Completed: 2026-11-05
- Tasks: 1/1
- Files modified: 6

## Accomplishments

- `ListingCard.svelte`: `<script module>` with `addrIdFor`; `idPrefix?: string` prop, default `'card'`; `addrId` derives from the helper. No visual change.
- `ResultsList.svelte`: Show more focus uses `addrIdFor('card', row.id)` (no prop passed; default keeps `card-{id}-addr`).
- `SplitList.svelte`: passes `idPrefix="split"`; pin-activation focus uses `addrIdFor('split', id)`.
- `SelectedListingPreview.svelte`: passes `idPrefix="preview"`; id-free focus selector kept.
- `renter-map-split.spec.ts`: `selectPin()` focus assertion and the keyboard-linking `.focus()` now use `split-${id}-addr`; new test "no duplicate ids at 1280x800 on the Map tab with a pin selected".
- `renter-map.spec.ts`: new test "no duplicate ids at 375x812 on the Map tab with a pin selected".
- Both new tests also assert every `article[data-listing-card]`'s `aria-labelledby` resolves to an element inside the same article.

## RED evidence (before the fix)

All 4 runs (2 tests x root/sub) failed with the same dupes array:

```
[
  "card-SAMPLE-74201-R001-addr", "card-SAMPLE-74201-R003-addr", "card-SAMPLE-74201-R005-addr",
  "card-SAMPLE-74201-R017-addr", "card-SAMPLE-74201-R011-addr", "card-SAMPLE-74201-R013-addr",
  "card-SAMPLE-74201-R009-addr", "card-SAMPLE-74201-R015-addr", "card-SAMPLE-74201-R007-addr",
  "card-SAMPLE-74201-R019-addr"
]
```

Non-ListingCard duplicate ids: **none**. The only duplicates were `card-*-addr`; after the fix the collector returns `[]` with Leaflet, the skip link and every other id in the document included, so no scoping of the assertion was needed.

## Verification (GREEN, after fix)

- `playwright test renter-map-split.spec.ts renter-map.spec.ts --project root --project sub`: 40 passed (24.6s), including both duplicate-id tests and the existing axe tests at 1280 and 375 (sample and live).
- `playwright test renter-results.spec.ts renter-journey.spec.ts --project root --project sub`: 14 passed (13.9s).
- `vitest run --project web-browser ResultsView.browser.test.ts`: 3 passed.
- `vitest run --project web apps/web/src/lib/features/renter/search/`: 26 passed.
- `pnpm --filter web check`: 0 errors, 0 warnings.
- `prettier --check` on the six files: clean.
- `pnpm budget:assert` (root build and a fresh configured build): both "Budget assertion passed: 9 gated route(s) within 60 KB"; for-renters 59.7 / 59.8 KB unchanged.
- After the mutation ledger, root rebuilt from the committed tree: renter-results + renter-map-split + renter-map on root 26 passed, browser test 3 passed, budget passed.

## Mutation ledger

| Mutant | Change | Caught by | Result |
|--------|--------|-----------|--------|
| (a) | `SelectedListingPreview` passes `idPrefix="split"` | renter-map.spec.ts "no duplicate ids at 375x812" | FAIL: dupes `["split-SAMPLE-74201-R011-addr"]` |
| (b) | `SplitList` lookup back to `addrIdFor('card', id)` | renter-map-split.spec.ts `selectPin()` (:71), via "Enter on a pin scrolls its card into view..." and "reduced motion..." | FAIL: expected focus id `split-SAMPLE-74201-R019-addr`, received `""` |
| (c) | default `idPrefix = 'list'` | ResultsView.browser.test.ts:87 and renter-results.spec.ts Show-more focus | FAIL: `expected '' to be 'card-VIEW-30-addr'`; renter-results 1 failed |

Each restored with `git checkout`; green re-confirmed (3/3 caught). Note on (b): the plan named the :183 line; that line calls `.focus()` on the card link directly, so it does not exercise the lookup. The lookup is exercised by `selectPin()` at :71, which is where the mutant was caught.

## Task Commits

1. Task 1: idPrefix + addrIdFor, adopted by all three containers, with duplicate-id E2E: `5030bd2` (fix)

## Decisions Made

- ids namespaced per container (`card` / `split` / `preview`) with one builder, per 14-UI-SPEC §DEBT-01.
- Preview focus selector stays id-free.

## Deviations from Plan

- RED and GREEN landed in one `fix` commit (single-task plan); the RED failure is recorded above.
- Playwright invoked as `node node_modules/@playwright/test/cli.js test ...` from `apps/web`: `corepack.cmd pnpm --filter web exec playwright test ... -g "..."` failed in Git Bash with `'C:\Program' is not recognized`. Same tests and projects; environment only.

## Owner follow-up

06-HUMAN-UAT R12 (ledger L51, duplicate ids on the Map tab) can now be re-checked by the owner.

## Known Stubs

None.

## Self-Check: PASSED

- All six modified files exist; commit `5030bd2` present in `git log`.
