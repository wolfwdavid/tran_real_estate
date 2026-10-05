---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 12
subsystem: data-fixtures
tags: [fixtures, sample-mode, rentcast, date-rebasing, tdd]
requires:
  - "04-03 @tran/core/request ENDPOINT_PATHS / EndpointId"
  - "04-06 fixtures (meta, metros, rentals, sales, estimates, markets JSON)"
provides:
  - "$lib/data/fixtures/fixture-fetch: FixtureSet, rebaseFixtures(data, now), createFixtureFetch(data, now) -> typeof fetch, OUTSIDE_COVERAGE"
  - "$lib/data/fixtures/load: loadFixtureSet() (dynamic import of the 6 JSON files)"
  - "$lib/data/fixtures/sample-metros: SAMPLE_METROS (city, state, zipCodes, label)"
affects: [04-13 onward (gateway sample mode), Phase 6/7 one-tap sample locations]
tech-stack:
  added: []
  patterns:
    - "Fetch-compatible in-memory transport: returns Response objects, never calls the network"
    - "Rebase once at creation (now - anchor; markets by whole UTC months); now() re-read per request for age math"
    - "Coverage gate before filtering: non-sample ZIP3, unknown city/state (case-sensitive) or a point > 25 mi from every centroid -> 404 sample/outside-coverage"
key-files:
  created:
    - apps/web/src/lib/data/fixtures/fixture-fetch.ts
    - apps/web/src/lib/data/fixtures/fixture-fetch.test.ts
    - apps/web/src/lib/data/fixtures/load.ts
    - apps/web/src/lib/data/fixtures/sample-metros.ts
  modified: []
key-decisions:
  - "Listing requests with no location answer 400 resource/bad-request (Tran always sends a location); latitude/longitude without radius defaults to 5 miles"
  - "Comparable daysOld is whole days since the rebased lastSeenDate; the listing daysOld filter uses fractional days since listedDate (single N = at most N)"
  - "Markets with an invalid dataType answer 400; historyRange keeps the newest N months (default 12, min 1)"
  - "Non-GET methods answer 405, mirroring RentCast's GET-only API"
requirements-completed: [DATA-01]
metrics:
  duration: 12min
  completed: 2026-10-05
  tasks: 2
  files: 4
---

# Phase 4 Plan 12: Sample-mode fixture fetch Summary

Sample mode now has a fetch-compatible transport that answers all six RentCast endpoint ids from the synthetic fixtures. It honors RentCast's filter, sort and paging rules, shifts every fixture date to the current clock, and reports places outside the three sample metros as `sample/outside-coverage` without relabeling any row.

## Tasks

| Task | Name | Commit |
| --- | --- | --- |
| 1 (RED) | Failing listing, rebase and SAMPLE_METROS tests | 320f2ec |
| 1 (GREEN) | rebaseFixtures, listings and by-id routes, load.ts, sample-metros.ts | 8be6c1e |
| 2 (RED) | Failing estimate and market tests | 26b5ca5 |
| 2 (GREEN) | Rent/value AVM and market-stats routes | 0f25bc8 |

## What it does

- **Rebasing.** `rebaseFixtures(data, now)` returns a deep copy and leaves the input alone. Listing `listedDate`, `createdDate`, `lastSeenDate` and `removedDate`, plus the history `YYYY-MM-DD` keys and their inner dates, all move by `now − anchor`. Market `lastUpdatedDate` moves by the same amount. Market history `YYYY-MM` keys and their `date` values move by whole UTC months, so at anchor + 400 days the newest month is the one before `now`'s month.
- **Listings** (rental, sale, rental by id). Location can be a ZIP (prefix 742/702/858), an exact case-sensitive city and state, latitude/longitude/radius (the point must be within 25 miles of a metro centroid), or an address. Filters: `status` (default Active), pipe-separated `propertyType`, numeric ranges for `bedrooms`, `bathrooms`, `squareFootage`, `lotSize`, `yearBuilt` and `price` (`min:max`, `*` for an open end, pipes for alternatives), and `daysOld`. Results sort by `lastSeenDate` descending with `id` as the tie-break. `limit` is clamped to 1..500 (default 50) and `offset` is applied. An empty result inside coverage answers `404 resource/not-found`.
- **AVMs.** Requests match by address (case and repeated spaces ignored) or by a point within 0.0005°. The response includes `subjectProperty` (taken from the subject's own listing when one exists) and comparables built from the rebased listings by `comparableIds`. Each comparable carries a haversine `distance`, a whole-day `daysOld` and `correlation = 0.9 − 0.02·i`. A sale estimate for a rental-only address answers 404.
- **Markets.** Supports `dataType` (All, Sale or Rental; a side that isn't requested is left out of the response) and `historyRange` (default 12). `zipCode=00000` answers `sample/outside-coverage`, so the key probe can never succeed against fixtures.
- **Responses.** Every response is `application/json`. Unknown paths answer 404. The module never calls `fetch(` (`grep -c` returns 0).

## Verification

- `corepack pnpm vitest run --project web fixture-fetch`: 23/23 pass.
- `corepack pnpm vitest run --project web`: 26 files, 330 tests, all pass.
- `corepack pnpm check` (0 errors, 0 warnings), `corepack pnpm lint` and `corepack pnpm guard` (644 files) all exit 0.
- Mutation check: replacing the creation-time rebase with the raw data makes the +400-day `daysOld=*:7` test fail. The file was restored afterwards.

## Deviations from Plan

None. The plan was executed as written. The fixture JSON and generator were not touched. The choices the plan left open (no-location → 400, default radius 5 mi, 405 for non-GET, invalid `dataType` → 400) are recorded in key-decisions.

## Known Stubs

None.

## Self-Check: PASSED
