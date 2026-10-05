---
phase: 06-renter-portal
plan: 09
subsystem: e2e-harness
tags: [playwright, e2e, page-route, deny-all, csp, img-src, openstreetmap, rentcast, fixtures, vault]
requires:
  - "06-04 img-src 'self' https://tile.openstreetmap.org and RENTER_ROUTES"
  - "04-12 createFixtureFetch (sample-mode transport, date rebasing) and the six synthetic fixtures"
  - "04-23 Settings 'Test key (0 calls)' zero-cost probe (GET /v1/markets?zipCode=00000)"
  - "Phase 3 vault session store (sessionStorage 'tran.vault.session.v1', plain JSON)"
provides:
  - "tests/e2e/support/network.ts: `test` with auto `net` fixture (deny-all FIRST, synthetic tile mock with Referer capture, per host+pathname counters, teardown asserts no external request), `expect`, `RENTER_TEST_OPTIONS` ({ serviceWorkers: 'block' }), `rentcastCalls(net, path?)`, `recordRequest`, `TILE`, `NON_LOCAL`"
  - "tests/e2e/support/rentcast-mocks.ts: `mockRentCast(page, net, { rows: 'fixtures'|'many500', extraRows, estimateComps, markets: 'fixtures'|'none', byIdMissing })`, `rentcastFixtures()`, path constants, `PROBE_ZIP`"
  - "tests/e2e/support/seed.ts: `TEST_RENTCAST_KEY = 'test-key-not-real'`, `withRentCastKey(page)`, `expectLiveMode(page)`, `expectSampleMode(page)`"
  - "tests/e2e/assets/tile.png (369 B, 256x256 greyscale) + scripts/gen-test-tile.mjs (deterministic)"
  - "renter-harness.spec.ts: 7 tests x 2 bases"
affects: [every Phase 6 renter E2E spec (06-1x feature specs, 06-19 map, 06-22 gate)]
tech-stack:
  added: []
  patterns:
    - "Renter specs: `import { test, expect, RENTER_TEST_OPTIONS } from './support/network'` + `test.use(RENTER_TEST_OPTIONS)`; register mockRentCast inside the test so it outranks the deny-all"
    - "RentCast mock bodies come from createFixtureFetch at request time (same rows, rebased dates and filters as sample mode); variants are derived in memory, never written"
    - "A deny-all probe must target a CSP-allowed host (e.g. api.openai.com): a connect-src-blocked host never reaches the router, so the probe would be vacuous"
    - "A spec that probes the deny-all on purpose empties net.external after asserting it"
key-files:
  created:
    - scripts/gen-test-tile.mjs
    - apps/web/tests/e2e/assets/tile.png
    - apps/web/tests/e2e/support/network.ts
    - apps/web/tests/e2e/support/rentcast-mocks.ts
    - apps/web/tests/e2e/support/seed.ts
    - apps/web/tests/e2e/renter-harness.spec.ts
  modified: []
key-decisions:
  - "Key seeding uses the preferred path: addInitScript writes { rentcast: key } into sessionStorage 'tran.vault.session.v1' (vault.ts line 76; session keys are plain JSON, never sealed), once per tab via a flag so a later in-test key removal is not undone"
  - "mockRentCast reuses createFixtureFetch rather than re-implementing filters/rebasing, so live-mode specs and sample mode cannot drift"
  - "Deny-all smoke probe fetches api.openai.com (CSP-allowed, unmocked) instead of example.org (CSP would block before routing)"
metrics:
  duration: ~35 min
  completed: 2026-10-05
---

# Phase 6 Plan 09: No-network renter E2E harness Summary

**One shared Playwright fixture that denies every non-local request first, answers OSM tiles with a committed synthetic PNG (Referer recorded), serves RentCast from the synthetic Phase 4 fixtures via createFixtureFetch (500-row, extra-row, by-id, comps-slice and no-markets variants), and seeds a fake session key straight into the vault.**

## What was built

- **`scripts/gen-test-tile.mjs` / `tests/e2e/assets/tile.png`**: Node built-ins only (zlib + in-script CRC32); 256x256 8-bit greyscale, flat 0xE2, 369 bytes, byte-deterministic.
- **`support/network.ts`**: auto `net` fixture. Deny-all regex `^https?://(?!(127.0.0.1|localhost)([:/]|$))` registered first (comment `deny-all FIRST`), then `https://tile.openstreetmap.org/**` → tile.png, `counts.tiles++`, Referer pushed to `tileReferers`. Teardown: `expect(net.external, 'unexpected external requests').toEqual([])`.
- **`support/rentcast-mocks.ts`**: one route on `https://api.rentcast.io/v1/**`; OPTIONS preflights answered 204 and not counted; every GET counted (`net.counts['api.rentcast.io' + pathname]`, `net.requests`). `/v1/markets?zipCode=00000` → 404 `{}`; listings → fixture rows (or 500 clones `-c{n}` for `many500`) plus matching `extraRows` on the first page, 404 when empty; by-id → extra row, fixture row, or 404 (`byIdMissing`); rent AVM → comparables sliced to `estimateComps`; markets → fixtures or 404 (`markets: 'none'`).
- **`support/seed.ts`**: see key-decisions; `expectLiveMode` asserts "RentCast calls:" and no "Sample data"; `expectSampleMode` the reverse.
- **`renter-harness.spec.ts`** (both bases): deny-all blocks and records; tile loads at naturalWidth 256 under CSP with a non-empty Referer; `data:` image raises an `img-src` violation; no service-worker controller after a reload; seeded key shows "Key ending in real" in Settings, "Test key (0 calls)" sends exactly one probe (404, "didn't use a call"), renter/ is live with "0 of 50" and no further call; keyless control stays in sample mode with 0 calls; every mock variant exercised from the page with exact call counts.

## Verification

- `playwright test renter-harness`: 14 passed (root + sub); `--repeat-each 3`: 42 passed.
- Mutation: swapping the deny-all and tile route order makes the tile test fail (Pitfall 10 is actually guarded).
- `pnpm --filter web check` 0 errors; ESLint + Prettier clean on all files; `pnpm guard` passed (903 files); `pnpm secrets:scan` no leaks (512 commits).
- Builds: `build:root` and `build:sub` green under `.tools/build.lock` (released).

## Requirements advanced

RENT-01 and RENT-02 (test infrastructure only; they stay open until the 06-22 gate, `requirements mark-complete` deliberately not run).

## Deviations from Plan

1. **[Rule 2 - Missing critical verification] Two extra smoke tests (14 instead of 10)**: a keyless sample-mode control (proves the seed is what flips live mode) and a mock-variant test (the plan's truths require many500/by-id/comps/markets variants but the planned smoke spec never exercised them). Commit ef442f6.
2. **[Rule 1 - Bug in plan] Deny-all probe host**: the plan's `fetch('https://example.org/x')` is refused by CSP `connect-src` before Playwright routing sees it, so `net.external` would stay empty. The probe uses `https://api.openai.com/v1/models` (CSP-allowed, unmocked). Commit ef442f6.
3. **[Rule 3 - Blocking] ESLint `no-restricted-syntax` forbids `fetch` outside adapter folders**: the two in-page fetches carry `eslint-disable-next-line` with a justification, following the pwa.spec.ts precedent.
4. Key probe proof goes through the real Settings "Test key (0 calls)" button (renter/ itself never probes), then checks renter/ shows "0 of 50".

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: scripts/gen-test-tile.mjs, apps/web/tests/e2e/assets/tile.png, apps/web/tests/e2e/support/{network,rentcast-mocks,seed}.ts, apps/web/tests/e2e/renter-harness.spec.ts
- FOUND: a90ea48 (Task 1), ef442f6 (Task 2)
