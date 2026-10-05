---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 17
subsystem: data-gateway
tags: [gateway, sample-mode, fixtures, mode, preferences, dexie, tdd]
requires:
  - "04-12 createFixtureFetch / FixtureSet (fixture transport, date rebasing, OUTSIDE_COVERAGE)"
  - "04-13 createDataGateway / DataGateway port / ReactiveSpendError / makeGateway harness"
  - "04-11 LedgerRepo, DATA_PREF_IDS, DataPrefRow"
  - "04-01 RentCastKeyState, DataDb"
provides:
  - "$lib/data/gateway: createSampleGateway(SampleGatewayDeps) -> DataGateway (source 'sample')"
  - "$lib/data/mode: resolveMode, DataMode, ModeReason, ResolvedMode"
  - "$lib/data/prefs-repo: createPrefsRepo(db, clock) -> PrefsRepo { readSource, writeSource }, DEFAULT_DATA_SOURCE"
affects: [04-18 (public $lib/data port + gateway selection), 04-20..04-22 (DataStatusBar / DataSourceChoice wiring)]
tech-stack:
  added: []
  patterns:
    - "Sample mode = real RentCast client + parsePayload + mapPayload over createFixtureFetch (RESEARCH Pattern 4)"
    - "Sample gateway is stateless: no apiCache, no ledger reserve, so sample rows can never surface as live (Pitfall 4)"
    - "assertNotReactive / truncatedOf / testKeyWith are module-private helpers shared by both factories"
key-files:
  created:
    - apps/web/src/lib/data/mode.ts
    - apps/web/src/lib/data/mode.test.ts
    - apps/web/src/lib/data/prefs-repo.ts
    - apps/web/src/lib/data/gateway.sample.test.ts
  modified:
    - apps/web/src/lib/data/gateway.ts
decisions:
  - "Sample gateway re-runs the fixture fetch on every read (peek included) instead of caching: fixtures are in memory and free, and avoiding apiCache is what guarantees no sample/live cache leak"
  - "Sample errors carry provenance { source: 'sample' } so error UI can badge them; NoResults detail 'outside-sample-coverage' comes straight from core classifyResponse"
  - "Locked key wins over preference in resolveMode (locked -> sample/locked even if preference is sample), so the status bar shows the unlock prompt rather than 'you chose sample'"
  - "dataSource pref row follows the 04-11 cap pattern: fixed id, newSyncable on first write, createdAt preserved on rewrite, ISO updatedAt from the injected clock"
metrics:
  duration: "~12 min"
  completed: 2026-10-05
  tasks: 2
  files: 5
---

# Phase 4 Plan 17: Sample Gateway, Mode Resolver and Source Preference Summary

Keyless sample (demo) mode behind the same `DataGateway` port: the real RentCast client, schemas and mappers run over the committed synthetic fixtures, every result is badged `source: 'sample'`, and nothing is fetched, metered or cached. Plus the pure `resolveMode` decision and the persisted `dataSource` preference.

## What was built

- `createSampleGateway(deps)`: all six endpoints (rental listings, sale listings, rental listing by id, rent estimate, value estimate, market stats) parse with 0 dropped rows. `peek` is free fixture data, `estimateCost`/`estimateBatchCost` return `{ calls: 0, reason: 'sample' }`, `peekListingById` answers from fixtures (undefined on NoResults), out-of-metro locations throw `NoResults` / `'outside-sample-coverage'`, and get/refresh/rentalListingById honour the reactive guard. `testKey` is the same metered live probe as the live gateway.
- Shared helpers `assertNotReactive`, `truncatedOf`, `testKeyWith` replace the live factory's inline versions. All 49 existing live gateway tests stay green.
- `resolveMode`: none -> sample/no-key, locked -> sample/locked, available+sample -> sample/chosen, available+rentcast -> rentcast/live.
- `createPrefsRepo`: default `'rentcast'`, Syncable row with fixed id `DATA_PREF_IDS.dataSource`, TypeError on invalid values.

## Verification

- `corepack pnpm vitest run --project web gateway mode`: 82 passed (sample 21, mode 12, live 49)
- `corepack pnpm vitest run --project web`: 35 files, 451 passed
- `corepack pnpm check`: 0 errors. `corepack pnpm lint`: clean. `corepack pnpm guard`: passed
- `grep "cache.put\|ledger.reserve" gateway.ts`: matches only inside `createDataGateway`
- Mutation run (not committed): pointing the sample client's fetch at `probeFetch` made **11 of 21** sample tests fail, including "0 live fetches, 0 ledger rows, 0 cache rows". File restored. The in-suite non-vacuity test also shows a live-wired client hits the spy and writes cache and ledger rows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Synchronous ReactiveSpendError in the sample spend path**
- **Found during:** Task 2 GREEN
- **Issue:** The first version of `spend` was non-async, so the reactive guard threw synchronously instead of returning a rejected promise. That broke `expect(...).rejects` and differs from the live gateway's contract.
- **Fix:** Made `spend` async.
- **Files modified:** apps/web/src/lib/data/gateway.ts
- **Commit:** 580830f

**2. Test field name**
- The RED test read `usage().used`. `UsageSnapshot` exposes `countedTowardCap`. Fixed in the test before the GREEN commit.

### Notes
- The plan sketched the pref row as `{ key, value, updatedAt: <clock> }`. Per the 04-01/04-11 deviation, it is a full Syncable row with ISO `updatedAt`, and the test asserts that.
- An extra `test(04-17): format mode tests` commit came from a prettier pass on the RED test file.

## Commits

- cb67c8d test(04-17): add failing mode and source preference tests
- 9ccaa65 feat(04-17): pure mode resolution and data-source preference
- 8d39e40 test(04-17): format mode tests
- 2e1a226 test(04-17): add failing sample-mode gateway tests
- 580830f feat(04-17): sample-mode gateway over fixtures

## Known Stubs

None. Choosing a gateway at runtime (resolveMode + key state + prefs -> live or sample factory) is the public `$lib/data` port's job in 04-18.

## Self-Check: PASSED
