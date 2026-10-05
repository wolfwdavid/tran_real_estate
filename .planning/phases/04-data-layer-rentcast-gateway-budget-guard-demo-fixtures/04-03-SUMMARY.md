---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 03
subsystem: data-layer
tags: [rentcast, canonical-key, ttl, error-taxonomy, key-probe, tdd]
requires: []
provides:
  - "@tran/core/request: EndpointId, ENDPOINT_PATHS, requestTarget"
  - "canonicalParams, canonicalKey, DataRequest, ParamValue, RequestParams, TRANSPORT_ONLY"
  - "HOUR_MS, DAY_MS, TTL_MS, NEGATIVE_TTL_MS, ttlFor, isStale"
  - "GatewayErrorKind, GatewayErrorDetail, GatewayErrorInfo, GatewayError, isGatewayError, classifyResponse, backoffMs, Provenance"
  - "KeyTestOutcome, PROBE_REQUEST, classifyProbe, validateKeyFormat"
affects: [04-09, 04-12, 04-13]
tech-stack:
  added: []
  patterns:
    - "One pure canonicalParams() feeds both the cache key and the wire query (RESEARCH Pattern 1)"
    - "Pure status-table classification; GatewayError copies only whitelisted fields"
key-files:
  created:
    - packages/core/src/request/index.ts
    - packages/core/src/request/endpoints.ts
    - packages/core/src/request/canonical.ts
    - packages/core/src/request/ttl.ts
    - packages/core/src/request/errors.ts
    - packages/core/src/request/probe.ts
    - packages/core/src/request/canonical.test.ts
    - packages/core/src/request/errors.test.ts
  modified: []
decisions:
  - "Estimates TTL is 7 days (locked CONTEXT), overriding CLAUDE.md's 14d; listings/by-id 24h, markets 30d, 400/404 negative 24h"
  - "canonicalParams throws on any param name matching /api.?key/i, even when its value is empty"
  - "City is NOT title-cased in canonicalParams (RentCast city is case-sensitive; location normalization belongs to the location module); only state uppercase, ZIP to 5 digits and trimming are applied"
  - "Whitespace-only strings and empty multi-value elements are dropped like ''; non-finite numbers throw TypeError"
  - "requestTarget throws TypeError if a {id} endpoint has no id param"
metrics:
  duration: "~4 min"
  completed: 2026-10-05
  tasks: 2
  files: 8
---

# Phase 4 Plan 03: Request Primitives Summary

This plan adds pure request primitives under `packages/core/src/request/`. One `canonicalParams()` builds both the cache key and the RentCast wire query, so the two can't drift. It also adds a single TTL table, the locked seven-kind error taxonomy with `classifyResponse` and a fixed 2/4/8/16/30s backoff, and the zero-cost key probe (`markets?zipCode=00000`) with a pure status mapping and a key-format check.

## What was built

- **endpoints.ts**: `ENDPOINT_PATHS` (including the Phase 6 `/v1/listings/rental/long-term/{id}`). `requestTarget()` substitutes `{id}` via `encodeURIComponent` and removes `id` from the query. For every other endpoint the query is exactly `canonicalParams(params)`.
- **canonical.ts**: drops undefined/null/blank values and transport-only params (`suppressLogging`, `includeTotalCount`). It sorts and pipe-joins multi-values, uppercases `state`, trims `zipCode` to 5 digits, trims strings, writes numbers as decimals and booleans as `true`/`false`. It throws `TypeError('API keys never belong in request params')` for any param name that looks like an API key.
- **ttl.ts**: `TTL_MS` table, `NEGATIVE_TTL_MS = DAY_MS`, `ttlFor`, `isStale` (stale when `now - fetchedAt >= ttl`).
- **errors.ts**: `Provenance`, `GatewayErrorKind`/`Detail`/`Info`. `GatewayError` sets `message = kind` and `name = 'GatewayError'` and stores only the whitelisted fields. A test confirms that extra `apiKey`/`body` input never serializes. Also `isGatewayError`, `classifyResponse` (with `outside-sample-coverage`) and `backoffMs`.
- **probe.ts**: `PROBE_REQUEST` (canonical key `markets?dataType=Rental&historyRange=1&zipCode=00000`), `classifyProbe`, and `validateKeyFormat` (trim, empty, whitespace, printable ASCII, 16..128).
- **index.ts**: barrel re-exporting all five modules.

## Verification

- `corepack pnpm vitest run --project core`: 17 files, 340 tests pass (77 in `request/`).
- `corepack pnpm check` (core tsc + web svelte-check): 0 errors.
- ESLint and Prettier are clean on `packages/core/src/request/`.
- `grep -c "Retry-After\|X-Total-Count"` returns 0 in every request file.
- Mutation check: mapping 404 to `'valid-billed'` in `classifyProbe` made `classifyProbe(404) -> valid` fail (1 failed / 45 passed). The mutation was reverted, and `git diff --exit-code probe.ts` is clean against the committed file.

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 RED | c31134d | test(04-03): add failing canonical key and TTL tests |
| 1 GREEN | ba246bc | feat(04-03): canonical request key, endpoints and TTLs |
| 2 RED | 8474bdc | test(04-03): add failing error taxonomy and probe tests |
| 2 GREEN | 38fc4d6 | feat(04-03): error taxonomy and zero-cost probe mapping |

## Deviations from Plan

None. Small hardening choices made within the plan's scope are listed under `decisions` in the frontmatter: whitespace-only values are dropped, non-finite numbers throw, and a by-id request with no id throws.

## Notes for downstream plans

- **`@tran/core/request` subpath:** `packages/core/package.json` still exports only `"."`. Plan 04-01 owns adding the `./request` subpath export, so this plan did not edit it. The tests import relatively. The barrel is at `packages/core/src/request/index.ts`, ready for `"./request": "./src/request/index.ts"`.
- The core root `index.ts` does not re-export `request/`. Consumers should import from the subpath.
- An executor-side process note: during the mutation check, `git checkout -- probe.ts` briefly restored the Task 1 placeholder because the GREEN file was not yet committed. It was restored from a backup before committing, and the committed file was verified (77/77 request tests pass).

## Known Stubs

None.

## Self-Check: PASSED

- All 8 files exist under packages/core/src/request/
- Commits c31134d, ba246bc, 8474bdc, 38fc4d6 are present in git log
