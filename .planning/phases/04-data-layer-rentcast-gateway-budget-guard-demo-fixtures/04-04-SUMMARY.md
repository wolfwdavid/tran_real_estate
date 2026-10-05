---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 04
subsystem: core/data-domain
tags: [location, listings, rentcast, filters, tdd]
requires: []
provides:
  - "@tran/core location: normalizeLocation / parseLocation, titleCaseCity, US_STATES, stateFromInput"
  - "@tran/core listings: Listing + estimate/market domain types, PROPERTY_TYPES, filterListings, hasActiveFilters, LISTINGS_LIMIT, buildListingsRequest, toRentCastFilterParams, buildListingByIdRequest, isTruncated, shouldOfferNarrow"
affects: [04-06 mappers/fixtures, 04-13 gateway type assertions, Phase 6 renter search]
tech-stack:
  added: []
  patterns: ["fetch wide, filter local", "request shapes declared locally for wave-1 independence"]
key-files:
  created:
    - packages/core/src/location/states.ts
    - packages/core/src/location/normalize.ts
    - packages/core/src/location/index.ts
    - packages/core/src/location/normalize.test.ts
    - packages/core/src/listings/types.ts
    - packages/core/src/listings/filter.ts
    - packages/core/src/listings/request.ts
    - packages/core/src/listings/index.ts
    - packages/core/src/listings/listings.test.ts
  modified: []
decisions:
  - "City casing: input with both upper- and lower-case letters is kept verbatim (DeKalb, LaGrange); otherwise title-cased per word/hyphen with Mc+letter rule"
  - "A lone state name or a comma with empty city maps to 'missing-state' (head must be non-empty)"
  - "buildListingByIdRequest trims the id and throws RangeError on empty/whitespace"
  - "filterListings excludes rows whose constrained field is null; unparseable listedDate is excluded under listedWithinDays"
  - "Narrow propertyType values are a sorted array; the client pipe-joins them (canonical key stability)"
metrics:
  duration: "~6 min"
  completed: 2026-10-05
  tasks: 2
  files: 9
---

# Phase 4 Plan 04: Location Normalization and Listings Domain Summary

Local `normalizeLocation` turns ZIP, "city, ST" and "city state-name" input into RentCast's case-sensitive form without an API call. The listings domain in core adds normalized row types, a pure `filterListings` that takes an injected `now`, and request builders. Search requests carry only location + `status=Active` + `limit=500` + `offset=0`. A separate explicit narrow path uses RentCast's `min:max` / `*` / multi-value syntax.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | States table + normalizeLocation (TDD) | 6700e22 (RED), 513da69 (GREEN), 0885f95 (prettier) |
| 2 | Listings types, filterListings, request builders (TDD) | e0efc88 (RED), 7db5b11 (GREEN) |

## Verification

- `corepack pnpm vitest run --project core`: 17 files, 340 tests pass. That includes 37 normalize tests and the listings suite.
- `corepack pnpm check` (core, brand, web svelte-check): 0 errors.
- `corepack pnpm lint` (prettier and eslint): clean.
- Acceptance greps: `name: '` count = 51. No `from '../request'` in location/ or listings/. No `Date.now` in filter.ts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Formatting] Prettier reflowed the `LocationResult` union after the GREEN commit**
- Found during: Task 1 post-commit prettier check
- Fix: a separate `style(04-04)` commit, 0885f95. I did not amend because parallel executors were moving HEAD.

### Additions (within plan scope)
- Exported `titleCaseCity`, `hasActiveFilters`, and the `FilterableListing`, `UsState`, `LocationError`, `MarketHistoryPoint` and `RequestParamValue` helper types.
- Added extra tests: lone state name, empty city before a comma, propertyTypes not mutated by the sort, an empty `propertyTypes` array means no filter, and whitespace-only ids.

## Notes for downstream plans
- `packages/core/package.json` has no `./location` or `./listings` subpath exports yet. 04-01 owns that file. Both modules have `index.ts` barrels ready for `"./location": "./src/location/index.ts"` and `"./listings": "./src/listings/index.ts"`. If 04-01 did not add them, 04-13 or the orchestrator should.
- `ListingsRequest` and `ListingByIdRequest` are declared locally in `listings/request.ts`. 04-13 should add the type-level assertion that they are assignable to 04-03's `DataRequest`.

## Known Stubs
None.

## Self-Check: PASSED
- All 9 files exist on disk.
- Commits 6700e22, 513da69, 0885f95, e0efc88 and 7db5b11 are present in `git log`.
