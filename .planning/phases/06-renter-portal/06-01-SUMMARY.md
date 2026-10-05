---
phase: 06-renter-portal
plan: 01
subsystem: core/renter
tags: [renter, location, filters, fetch-wide, tdd]
requires:
  - "@tran/core location: normalizeLocation (Phase 4, 04-04)"
  - "@tran/core listings: Listing domain row (Phase 4, 04-04)"
provides:
  - "@tran/core/renter/types: SEARCH_LIMIT, RENTER_PROPERTY_TYPES, BedsFilter, LISTED_WITHIN, ListedWithin, RenterLocation, RentalFilters, DEFAULT_FILTERS, RentalQuery, RentalRowLike, LocationError"
  - "@tran/core/renter/location: normalizeRenterLocation, locationDisplay, RenterLocationResult"
  - "@tran/core/renter/filters: toServerParams, matchRental, applyFilters, isTruncated, utcDayDiff, hasLocalFilters, ServerParams"
  - "@tran/core/renter barrel (index.ts) shared with 06-02/06-03"
affects: [06-02, 06-03, renter search UI plans, renter search store]
tech-stack:
  added: []
  patterns: ["fetch wide, filter local", "delegate to Phase 4 normalizer, map error kinds", "compile-time structural assertion against Phase 4 Listing"]
key-files:
  created:
    - packages/core/src/renter/types.ts
    - packages/core/src/renter/location.ts
    - packages/core/src/renter/location.test.ts
    - packages/core/src/renter/filters.ts
    - packages/core/src/renter/filters.test.ts
    - packages/core/src/renter/index.ts
  modified:
    - packages/core/package.json
decisions:
  - "Location normalization delegates to Phase 4 normalizeLocation; no state table duplicated (no renter/states.ts)"
  - "Error mapping: empty→empty, invalid-zip→bad-zip, unknown-state→unrecognized; missing-state→bad-zip for digit/dash-only input, unrecognized for a trailing 2-letter token ('Austin ZZ'), else city-without-state"
  - "Added \"./renter/*\": \"./src/renter/*.ts\" export: the existing \"./*\" wildcard maps @tran/core/renter/filters to src/renter/filters/index.ts, which does not exist"
  - "RentalRowLike needed no renames; a type-level assertion proves Phase 4 Listing is assignable to it"
  - "Status rule always applies: only status 'Active' with no removedDate matches, even with default filters"
metrics:
  duration: "~8 min"
  completed: 2026-10-05
  tasks: 2
  files: 7
---

# Phase 6 Plan 01: Renter Search Core Summary

The renter search core is now pure TypeScript under `@tran/core/renter/*`. `normalizeRenterLocation` wraps Phase 4's `normalizeLocation` and maps every failure to one of four renter error kinds. `toServerParams` builds one wide request per location (location + `status=Active` + `limit=500`, nothing else), so the cache key never changes with filters. `matchRental`/`applyFilters` apply every renter filter locally and idempotently. `isTruncated` flags 500-row responses, and narrow mode pushes closed `min:max` bounds plus a sorted `propertyType` array server-side.

Advances requirement **RENT-01**. It stays open until the phase gate (06-22).

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Renter types, subpath export, location normalization (TDD) | 6c312dd (RED), 0fec24e (GREEN) |
| 2 | Fetch-wide params, local matcher, truncation, narrow mode (TDD) | a72ba81 (RED), d8b5b77 (GREEN) |

## Verification

- `corepack pnpm vitest run --project core packages/core/src/renter/location packages/core/src/renter/filters`: 66/66 pass.
- Mutation test on filters.ts: 6/6 mutants killed. The mutants were truncation `>=`→`>`, removing the wide early-return, the 7-day boundary `<=`→`<`, the `4+` threshold, the removedDate guard, and dropping the propertyType sort.
- tsc on my files: clean. The only `tsc` errors come from siblings' RED-phase test files (06-02 affordability; earlier 06-03 format/history/sparkline).
- Prettier and eslint are clean on my files. Repo-wide `pnpm lint` currently flags formatting in 3 files owned by 06-03 and 06-06.
- Full core suite: 1132/1134. The 2 failures are in 06-02's in-progress `affordability.test.ts`.
- Acceptance greps: the `./renter/*` export count is 1, and `offset` appears 0 times in filters.ts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Distinguishing bad-zip and unrecognized on Phase 4's `missing-state`**
- Phase 4 returns `missing-state` for `7870`, `787011` and `Austin ZZ`. The renter contract needs `bad-zip` for the first two and `unrecognized` for the third. The wrapper splits these with a digits/dash check and a trailing 2-letter-token check, and tests cover both.

**2. [Process] Barrel ownership**
- I created `renter/index.ts` with the types and location exports. A sibling commit (06-03, 21157de) then committed the barrel, including my `./filters.js` line, before my Task 2 GREEN commit. My final commit therefore touched only filters.ts.

## Notes for downstream plans

- Import as `@tran/core/renter/filters`, `@tran/core/renter/location`, `@tran/core/renter/types`, or through the `@tran/core/renter` barrel.
- Deferred, not fixed because it is outside my files: `apps/web/src/lib/ai/import-graph.ts` `baseFor` maps every `@tran/core/<x>` specifier to `<x>/index.ts`. A `@tran/core/renter/<module>` import reachable from the AI-04 walk would resolve to `to: null`. If a renter prompt module imports a renter subpath, teach `baseFor` to also try `<coreSrc>/<sub>.ts`.

## Known Stubs
None.

## Self-Check: PASSED
- All 7 files exist. Commits 6c312dd, 0fec24e, a72ba81 and d8b5b77 are in `git log`.
