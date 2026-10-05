---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 09
subsystem: data-layer
tags: [rentcast, http-client, key-probe, tdd]
requires:
  - "04-01: lib/data/testing/harness (spyFetch, jsonResponse, TEST_KEY)"
  - "04-03: @tran/core/request (requestTarget, GatewayError, PROBE_REQUEST, classifyProbe, validateKeyFormat)"
provides:
  - "$lib/data/rentcast/client: RENTCAST_ORIGIN, RawResult, RentCastClient, RentCastClientDeps, createRentCastClient, browserFetch"
  - "$lib/data/rentcast/probe: ProbeResult, testRentCastKey"
affects: [04-12, 04-13]
tech-stack:
  added: []
  patterns:
    - "Single RentCast fetch call site; real fetch reaches other modules only via the injected browserFetch"
    - "Wire URL = requestTarget(req) + suppressLogging=true, so the URL and the cache key share canonicalParams()"
key-files:
  created:
    - apps/web/src/lib/data/rentcast/client.ts
    - apps/web/src/lib/data/rentcast/client.test.ts
    - apps/web/src/lib/data/rentcast/probe.ts
    - apps/web/src/lib/data/rentcast/probe.test.ts
  modified:
    - apps/web/src/lib/data/rentcast/.gitkeep (deleted)
key-decisions:
  - "The timeout covers both the fetch and the body read (the timer is cleared in finally after res.json())"
  - "Client never reads response headers and never throws for HTTP status; only a missing key throws (GatewayError InvalidKey/missing-key)"
  - "Probe does no ledger I/O; the gateway (04-13) records the valid-billed edge"
requirements-completed: [DATA-05, DATA-04]
metrics:
  duration: 6min
  completed: 2026-10-05
  tasks: 2
  files: 5
---

# Phase 4 Plan 09: RentCast client and zero-cost key probe Summary

This plan adds the typed RentCast GET client, which is the only RentCast `fetch` call site, plus the zero-cost key probe. The client builds its URL from `requestTarget()` and adds `suppressLogging=true`. It sends only `X-Api-Key` and `Accept`, omits credentials, sends no referrer, uses `no-store`, and times out after 20s by default. Any thrown fetch becomes status 0. `testRentCastKey` checks the key format first and only then sends the single `markets?zipCode=00000` probe.

## Tasks

| Task | Name | Commit |
| --- | --- | --- |
| 1 RED | Failing RentCast client tests | b6e2ea3 |
| 1 GREEN | Typed RentCast GET client (.gitkeep removed) | bb27fb0 |
| 2 RED | Failing key probe tests | b3f0284 |
| 2 GREEN | Zero-cost RentCast key probe | 5680330 |

## Verification

- `corepack pnpm vitest run --project web rentcast/client rentcast/probe`: 27/27 pass (client 12, probe 15).
- `grep -cE "console\.|Retry-After|X-Total-Count|includeTotalCount" client.ts` returns 0. The tests also spy on `console.log/info/warn/error/debug` in every client case and assert none of them was called.
- Mutation check: removing `suppressLogging` makes 4 tests fail. The file was restored with `git checkout`, and `git diff --exit-code` is clean.
- `eslint .` and `prettier --check .` both pass. `corepack pnpm guard` passed (638 files).
- `corepack pnpm check`: 0 errors in this plan's files. The only error is in `rentcast/mappers.test.ts`, which belongs to 04-10 and is in its RED state.
- `vitest run --project web`: 7 failures, all in `fixtures/fixture-fetch.test.ts`, which belongs to 04-11 and is in its RED state. Every other file passes.

## Deviations from Plan

None. The plan was executed as written. The tests wrap the harness `spyFetch` to also record the `RequestInit`, so they can assert `method`, `credentials`, `referrerPolicy`, `cache` and `signal`. The harness only records the URL and headers. Two extra tests cover the `origin` override.

## Known Stubs

None.

## Self-Check: PASSED
