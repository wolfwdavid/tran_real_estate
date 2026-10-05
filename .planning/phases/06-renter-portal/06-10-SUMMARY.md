---
phase: 06-renter-portal
plan: 10
subsystem: web/features/shared/listings
tags: [renter, shared-components, marks, location, price-history, recency, a11y]
requires:
  - phase: 06-01
    provides: LocationError type, location normalizer wrapper
  - phase: 06-03
    provides: history, sparkline, listing-status, format helpers
  - phase: 04-14
    provides: ProvenanceChip (sample variant)
provides:
  - "PropertyTypeMark (type -> mark in an accent-surface disc, card 48-in-64 / detail 64-in-96) + 6 marks"
  - "LocationField (bindable value + inputEl, 4 location errors, no dropdown)"
  - "PriceHistory (h2|h3 + summary + Sparkline + events table) and Sparkline (3+ points)"
  - "ListingStatusChip (recent detail-only / stale / gone)"
affects: [06-results-cards, 06-listing-detail, 06-shortlist, 06-search-form, 07-investor-sale-listings]
tech-stack:
  added: []
  patterns:
    - "Plain <label>/<input> with text-base leading-[1.6] instead of Label/Input (text-body tailwind-merge collision)"
    - "Map-based type->component lookup so prototype keys ('constructor') fall back safely"
    - "Disc sizes its svg child with [&>svg]:size-* so the fixed-size Phase 2 RenterMark scales too"
key-files:
  created:
    - apps/web/src/lib/features/shared/listings/marks/{SingleFamily,MultiFamily,Condo,Townhouse,Manufactured,Home}Mark.svelte
    - apps/web/src/lib/features/shared/listings/PropertyTypeMark.svelte
    - apps/web/src/lib/features/shared/listings/LocationField.svelte
    - apps/web/src/lib/features/shared/listings/PriceHistory.svelte
    - apps/web/src/lib/features/shared/listings/Sparkline.svelte
    - apps/web/src/lib/features/shared/listings/ListingStatusChip.svelte
    - apps/web/src/lib/features/shared/listings/shared-listings.test.ts
    - apps/web/src/lib/features/shared/listings/shared-listings.browser.test.ts
    - apps/web/src/lib/features/shared/listings/testing/LocationFieldHarness.svelte
  modified: []
key-decisions:
  - "PriceHistory replaces the table only when every event is 'listed' (or none); delist/relist histories with no rent change keep the table under the 'No rent changes recorded…' sentence"
  - "Missing rent in a history row renders an aria-hidden em dash + sr-only 'not recorded' (not 'Not listed', which reads like a delisting)"
  - "LocationField uses a plain input (not the Phase 3 Input wrapper) to avoid the text-body tailwind-merge collision; same 48px/card/border-input anatomy"
  - "Sample chip reuses ProvenanceChip with a fixed sample provenance and now={0} so it starts no interval"
requirements-completed: []
duration: ~12min
completed: 2026-10-05
---

# Phase 6 Plan 10: Shared listing components Summary

**Property-type marks in accent discs, a labelled no-dropdown location field with the four location errors, a price history with summary sentence, 3+-point sparkline and captioned scrollable events table, and an honest recency chip, all in `features/shared/listings` for Phase 7 reuse.**

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Property-type marks and PropertyTypeMark | e83e7fe |
| 2 | LocationField, PriceHistory + Sparkline, ListingStatusChip and tests | 6d61e50 |

## Verification

- `corepack pnpm vitest run --project web src/lib/features/shared/listings`: 29/29 (SSR).
- `corepack pnpm vitest run --project web-browser src/lib/features/shared/listings`: 4/4 (bound `inputEl` focus, bound value, accessible descriptions, focusable table region, rendered mark width, axe clean on all).
- Mutation check: removing `bind:this={inputEl}` from LocationField fails the browser focus test; restored.
- Whole `web` project: 67 files / 1074 tests pass. `svelte-check` (apps/web) 0 errors; `eslint .` clean; prettier clean on my files; `banned` passes (107 files); `ui:guard` passes.
- `pnpm check` at the root stops on `packages/core` RED tests from sibling 06-08 (`records.test.ts`), which aren't part of this plan.
- Acceptance greps: no hex in marks (0 each); every listed literal is present.

## Requirements advanced

RENT-01 (location input), RENT-02 (marks on result cards), RENT-03 (price history + recency). None are marked complete; they close at the 06-22 gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RenterMark has no `size` prop**
- svelte-check rejected RenterMark as `Component<{ size?: number }>`. Apartment now renders through its own branch, and the disc sizes the svg child with `[&>svg]:size-12/16`.
- Commit: e83e7fe

**2. [Rule 2 - Correctness] Prototype-key lookup**
- I swapped the type map for a `Map`, so a type like `'constructor'` can't resolve to an Object prototype member. A test covers it.
- Commit: e83e7fe

### Additive

- I added browser tests and a `testing/LocationFieldHarness.svelte` beyond the plan's file list, following the prior-wave guidance that ref and focus behaviour needs real-browser coverage.

## Known Stubs

None.

## Self-Check: PASSED
