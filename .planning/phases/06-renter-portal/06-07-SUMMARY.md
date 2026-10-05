---
phase: 06-renter-portal
plan: 07
subsystem: core/renter
tags: [renter, sort, url-state, labels, new-since, tdd, mutation-tested]
requires:
  - "@tran/core/renter/types + filters (06-01): RentalFilters, DEFAULT_FILTERS, RENTER_PROPERTY_TYPES, LISTED_WITHIN, matchRental, utcDayDiff"
  - "@tran/core/renter/format (06-03): formatRent"
  - "@tran/core/alerts (Phase 4, 04-05): SnapshotItemLike, countNewSince semantics"
provides:
  - "@tran/core/renter/sort: SORT_OPTIONS, SortId, DEFAULT_SORT, isSortId, sortRentals"
  - "@tran/core/renter/url-state: ResultsView, DEFAULT_VIEW, SearchUrlState, encodeSearchParams, decodeSearchParams"
  - "@tran/core/renter/labels: PROPERTY_TYPE_LABELS, propertyTypeLabel, FilterChip, activeFilterChips, filterCount, removeChip, savedSearchSummary, defaultSearchName, resultsHeading"
  - "@tran/core/renter/new-since: filteredNewIds (re-exports SnapshotItemLike from alerts)"
  - "renter/types.ts now owns BedroomBucket and CompLike (fair-rent re-exports them)"
affects: [renter search UI, SearchForm URL sync, saved searches list + save dialog, results header, affordability CTA (?max=)]
tech-stack:
  added: []
  patterns:
    - "decorate-sort-undecorate with nulls-last and id tiebreak (deterministic regardless of input order)"
    - "per-param independent URL validation with default fallback; canonical type order on decode"
    - "partial barrel commit via git hash-object + update-index --cacheinfo (shared file in a parallel wave)"
key-files:
  created:
    - packages/core/src/renter/sort.ts
    - packages/core/src/renter/sort.test.ts
    - packages/core/src/renter/url-state.ts
    - packages/core/src/renter/url-state.test.ts
    - packages/core/src/renter/labels.ts
    - packages/core/src/renter/labels.test.ts
    - packages/core/src/renter/new-since.ts
    - packages/core/src/renter/new-since.test.ts
  modified:
    - packages/core/src/renter/index.ts
    - packages/core/src/renter/types.ts
    - packages/core/src/renter/fair-rent.ts
    - packages/core/src/renter/format.ts
    - packages/core/src/renter/listing-status.ts
decisions:
  - "Sort 'newest' parses listedDate with Date.parse; unparseable dates sort with nulls (last). Non-finite numbers also sort as null"
  - "URL encode sorts types alphabetically (Apartment|Condo); decode returns them de-duplicated in RENTER_PROPERTY_TYPES order, so round-trip states use UI order"
  - "min/max accept only /^\\d+$/ safe integers; beds only studio|1|2|3|4plus ('4+' and '0' are rejected); loc is passed through verbatim and omitted when blank"
  - "defaultSearchName slices to 60 chars then trimEnd, so a cut never leaves a trailing space in the Name input"
  - "resultsHeading noun follows total ('1 of 5 rentals'); counts use en-US thousands separators"
  - "filteredNewIds is stricter than alerts countNewSince: status must be exactly 'Active' (null status is not new). With default filters and all rows cached it equals countNewSince for Active items (tested)"
  - "Uncached ids fall back to the snapshot price only: inclusive bounds, null price fails any bound, no bounds = included"
  - "Resolved wave-1 TODO(06-07)s: BedroomBucket/CompLike moved to types.ts (fair-rent re-exports, no barrel ambiguity under tsc); format.ts and listing-status.ts now call filters.ts utcDayDiff"
metrics:
  duration: "~12 min"
  completed: 2026-10-05
  tasks: 2
  files: 13
---

# Phase 6 Plan 07: Renter search core finish (sort, URL state, labels, new-since) Summary

Deterministic nulls-last/id-tiebreak rental sorting, a side-effect-free `?`-query codec for loc/min/max/beds/type/days/sort/view that never throws, UI-SPEC chip/summary/name/heading labels, and a filtered "N new since last visit" built on Phase 4's snapshot model and 06-01's `matchRental`. All test-first, all mutation-tested.

Advances **RENT-01** (URL-restorable search state), **RENT-02** (sortable results, results heading, filter chips) and **RENT-04** (filtered new-since, saved-search summary and default name). None marked complete; they stay open until the 06-22 gate.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Stable sort and URL state codec | c63fe29 (RED), 15a87ee (GREEN) |
| 2 | Labels and filtered new-since | 7f063fc (RED), 16ea2d2 (GREEN) |
| - | Wave-1 TODO(06-07) hand-offs | fb5eb46 (refactor) |
| - | Barrel exports | 829807b |

## Verification

- `corepack pnpm vitest run --project core src/renter`: 14 files, 276 tests pass (all wave-1 renter tests still green after the refactor).
- Full core project: 41 files, 1247 tests pass.
- `corepack pnpm --filter @tran/core check` (tsc): clean, including the barrel re-export of BedroomBucket/CompLike through both types.ts and fair-rent.ts.
- eslint + prettier on `packages/core`: clean. Repo-wide `pnpm lint` currently fails only on Prettier formatting in 06-10's in-progress untracked `apps/web/src/lib/features/shared/listings/{ListingStatusChip,PriceHistory}.svelte` (not this plan's files).
- `grep TODO(06-07)`: 0 remaining.
- **Mutation testing:** sort + url-state 16/16 behavioural mutants killed (nulls-first in either direction, tiebreak removed/inverted, newest/dom direction flipped, non-finite guard, blank-loc check, type sort, safe-integer guard, unanchored integer regex, unknown types kept, unvalidated view/sort, default sort emitted, `4+` param). One cast-only equivalent mutant survived (no behaviour change). labels + new-since: 18/18 killed after adding boundary tests for the four initial survivors (null price with a single bound, inclusive min/max edges, singular noun on shown-vs-total).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Boundary tests added after mutation survivors**
- Found during Task 2 mutation pass: the missing-row price check and the heading noun were under-tested. Added inclusive-edge, null-price-with-one-bound and "1 of 5 rentals" tests. Committed with 16ea2d2.

**2. [Rule 2 - Correctness] Hardening beyond the listed bullets**
- `propertyTypeLabel` uses `Object.hasOwn` so `'constructor'`/`'toString'` read "Home"; decode rejects prototype-named values; `filteredNewIds` ignores inherited keys; `defaultSearchName` trims trailing whitespace after the 60-char cut. Each has a test.

**3. [Scope - orchestrator hand-off] Wave-1 TODO(06-07)s resolved** in types.ts, fair-rent.ts, format.ts, listing-status.ts (additive refactor, separate commit fb5eb46).

### Notes
- `formatRent` from 06-03's format.ts is reused for chip money (no local Intl formatter).
- The barrel commit was built from `HEAD:index.ts` + my 4 lines via `git hash-object`/`update-index --cacheinfo`, so no sibling working-tree line could be swept in (06-08's `records.js` line was already committed).
- Phase 4's `@tran/core/alerts` index uses extensionless re-exports; new-since imports `../alerts/diff.js` directly, consistent with the renter modules.

## Known Stubs

None.

## Self-Check: PASSED
- All 8 created files exist; commits c63fe29, 15a87ee, 7f063fc, 16ea2d2, fb5eb46, 829807b are in `git log`.
