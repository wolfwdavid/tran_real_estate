---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 10
subsystem: data/rentcast
tags: [zod-mini, schemas, mappers, rentcast, fixtures, tdd]
requires:
  - "@tran/core/request EndpointId (04-03)"
  - "@tran/core/listings domain types (04-04)"
  - "fixtures rentals/sales/markets.json (04-06)"
provides:
  - "$lib/data/rentcast/schemas: parsePayload, ValidatedPayload, ParseResult, listingSchema, comparableSchema, rentEstimateSchema, valueEstimateSchema, marketSchema, RentCast* inferred types"
  - "$lib/data/rentcast/mappers: mapPayload, mapListing, DomainData"
affects: [04-12 fixture-fetch, 04-13 gateway (SchemaMismatch, cache map-on-read), portal phases 6-9]
tech-stack:
  added: []
  patterns:
    - "Tolerant validation: strip unknown keys, require core fields only, enum-like fields as free strings"
    - "Per-row safeParse with drop-and-count; mismatch only on wrong top-level shape or all rows bad"
    - "Issues as path:code strings only (never values)"
    - "Mappers read defensively with num()/str() helpers so they are total over unknown input"
key-files:
  created:
    - apps/web/src/lib/data/rentcast/schemas.ts
    - apps/web/src/lib/data/rentcast/schemas.test.ts
    - apps/web/src/lib/data/rentcast/mappers.ts
    - apps/web/src/lib/data/rentcast/mappers.test.ts
  modified: []
decisions:
  - "Root-level issues are reported as '$:<code>'; issue lists are capped at 20 entries"
  - "AVM comparables are re-validated per row; dropped comparables count toward droppedRows"
  - "Mappers take unknown and never throw: missing id/zip map to '', missing price/estimate to 0 (schemas already guarantee these for validated payloads)"
  - "MarketBreakdown from dataByBedrooms gets propertyType null and vice versa; market and price history sorted by key ascending"
requirements-completed: [DATA-01, DATA-05]
metrics:
  duration: 5min
  completed: 2026-10-05
  tasks: 2
  files: 4
---

# Phase 4 Plan 10: Tolerant RentCast Schemas and Domain Mappers Summary

zod/mini response schemas for all six RentCast endpoints drop and count bad rows instead of failing the page. Pure mappers turn validated payloads into the `@tran/core/listings` domain types. All 60 rental rows, 40 sale rows and 6 market fixtures pass the live schemas with 0 dropped rows.

## Tasks

| Task | Name | Commits |
| --- | --- | --- |
| 1 | Tolerant zod/mini schemas + parsePayload (TDD) | 64255b8 (RED), d39c4b4 (GREEN) |
| 2 | Mappers to core domain rows (TDD) | 2fb03fb (RED), c9ccdb7 (GREEN) |

## What Was Built

- **schemas.ts**: `parsePayload(endpoint, body)` returns `{ ok: true, payload, droppedRows }` or `{ ok: false, issues }`. The listing schema requires `id`, `price`, `status` and `zipCode`, plus either `formattedAddress` or `addressLine1` (via a refine). Every other field is nullish and unknown keys are stripped. A `200 []` response is a valid empty result. AVM responses require only `rent` or `price`, the deprecated top-level lat/long are tolerated, and comparables are validated per row. A market response needs only `zipCode`, and its sub-objects are records read defensively by the mapper. By-id responses reject arrays.
- **mappers.ts**: `mapListing(row, kind)` and `mapPayload(payload)`. Unknown `propertyType` or `status` values become `'Other'`. The history record becomes a date-ascending `PriceEvent[]`. If `formattedAddress` is missing, it is rebuilt as "line1, city, ST zip", skipping null parts. Each market side uses a `'Rent' | 'Price'` field prefix, and a missing side maps to `null`.

## Verification

- `corepack pnpm vitest run --project web rentcast`: 4 files, 65 tests pass. That includes 04-09's client and probe tests.
- `corepack pnpm vitest run --project web`: 26 files, 330 tests pass.
- `corepack pnpm check`: 0 errors. `corepack pnpm lint`: clean. `corepack pnpm guard`: passed (643 files).
- The planted-value test proves that `'planted-value-xyz'` never appears in `issues`.

## Deviations from Plan

None. The plan was executed as written. These additions stay within scope:
- `comparableSchema` also accepts nullish `addressLine1/city/state/zipCode`, so the address fallback works for comparables too.
- The inferred `RentCast*` types and the individual schemas are exported for 04-12 and 04-13.

## Notes

- While Task 1 ran, svelte-check briefly reported errors in `fixtures/fixture-fetch.test.ts`, another wave-2 plan's RED file. That file belongs to that plan, and `pnpm check` was green at the end.
- No fixture or generator changes were needed.

## Known Stubs

None.

## Self-Check: PASSED
