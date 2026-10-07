---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 14
subsystem: studio-snapshot-data
tags: [studio, snapshot, rentcast-budget, gateway, frozen-record, sample, tdd]
requires:
  - phase: 04
    provides: "DataGateway (estimateCost, peek, get via runtime.requestSpend, ledger cap + CapPrompt), buildListingsRequest, fixture sample gateway, testing harness"
  - phase: 07
    provides: "features/shared/markets: marketStatsRequest (canonical key), createMarketsPort, loadMarket, toMarketStatsInput"
  - phase: 09-05
    provides: "buildSnapshotMetrics(domain MarketStats), aggregateListings, AGGREGATED_SAMPLE_KEYS"
  - phase: 09-10
    provides: "@tran/core/studio barrel; features/shared/agent-profile (toDisclosureProfile, effectiveBrandColors, SAMPLE_AGENT_PROFILE)"
  - phase: 09-11
    provides: "SnapshotRecord types, SNAPSHOT_RECORD_KEYS, snapshotViolations"
  - phase: 09-13
    provides: "studio/snapshot.v1 sampleSnapshotNotes, numberPostCheck, numberWordsPostCheck"
provides:
  - "features/studio/snapshot/snapshot-data.ts: createSnapshotData(runtime) / useSnapshotData() -> { snapshotZipCost, loadZipData, listingsSummaryCost, loadListingsSummary }; CostPreview, ZipData, ListingsSummary, listingsSummaryRequest"
  - "features/studio/snapshot/build-record.ts: buildSnapshotRecord(args) -> deep-frozen SnapshotRecord; BuildSnapshotArgs"
  - "features/studio/fixtures/sample-snapshot.ts: SAMPLE_MARKET_STATS, SAMPLE_LISTINGS_SUMMARY, SAMPLE_SNAPSHOT_RECORD (id 'sample'), SAMPLE_ZIP, SAMPLE_PLACE_NAME, SAMPLE_FETCHED_AT"
  - "features/shared/markets/market-input.ts: toMarketStatsInput (data-layer free; still re-exported by markets-port)"
affects: [09-15, 09-17, 09-18, 09-20, 09-22, 09-23]
tech-stack:
  added: []
  patterns:
    - "Snapshot data is a port bound to the runtime (createSnapshotData(runtime) / useSnapshotData()), like the Phase 7 markets port, because the runtime lives in Svelte context"
    - "Call budget proven against the REAL data runtime + live gateway with an injected fetch spy, so every counted request passed the ledger cap"
key-files:
  created:
    - apps/web/src/lib/features/studio/snapshot/snapshot-data.ts
    - apps/web/src/lib/features/studio/snapshot/snapshot-calls.test.ts
    - apps/web/src/lib/features/studio/snapshot/build-record.ts
    - apps/web/src/lib/features/studio/snapshot/build-record.test.ts
    - apps/web/src/lib/features/studio/fixtures/sample-snapshot.ts
    - apps/web/src/lib/features/shared/markets/market-input.ts
  modified:
    - apps/web/src/lib/features/shared/markets/markets-port.ts
key-decisions:
  - "The four contract functions are methods of createSnapshotData(runtime) (useSnapshotData() for components), not free functions: the data runtime lives in Svelte context, the same reason the Phase 7 markets port is a factory"
  - "loadZipData spends through runtime.requestSpend<MarketStats>(marketStatsRequest(zip)) and returns the DOMAIN MarketStats (09-05: the port's MarketResult.stats drops DOM/newListings); snapshotZipCost reuses the markets port's estimateCost"
  - "listingsSummaryRequest = buildListingsRequest({ kind: 'zip', ... }, sale|rental endpoint): byte-identical to a ZIP search request, so a searched ZIP is also a cache hit"
  - "placeName is the fictional sample-metro label in sample mode, null for live RentCast data (the markets endpoint carries no place name)"
  - "fetchedAt strings are ISO from provenance.fetchedAt, so a cache hit keeps the original time"
  - "buildSnapshotRecord takes ProfileInput (AgentProfile is assignable; the shipped SAMPLE_AGENT_PROFILE is a ProfileInput); hasLogo = profile.logo != null, never the bytes"
  - "series.rentTrend needs the rental side, series.priceToRent needs both sides, else null; the listings summary and options are rebuilt key by key, and the whole record is deep-frozen"
  - "Sample report uses fictional ZIP 74201 / 'Harlow Springs, OK' (Phase 4 fixture metro) with 24 months of round figures; asOf = createdAt = fetchedAt = 2026-10-01T12:00:00.000Z"
requirements-completed: []
duration: ~14 min
completed: 2026-10-07
---

# Phase 9 Plan 14: Market Snapshot data path, frozen record and sample report Summary

**A Market Snapshot now loads ZIP statistics through the same canonical `marketStatsRequest` as the investor dashboards, so a ZIP that's already cached costs 0 calls. A new ZIP costs 1 call, a new ZIP plus the active-listings summary costs 2, and keyless sample mode spends 0. A test against the real data runtime and live gateway proves each of those counts. Saving builds a deep-frozen, 0-call `SnapshotRecord` that passes the 09-11 privacy guard. The built-in `?id=sample` report (Avery Sample, fictional ZIP 74201) exists without importing lib/data.**

## Performance

- **Duration:** ~14 min (single core, mask 0x200, alongside 09-12)
- **Started:** 2026-10-07T07:12Z
- **Completed:** 2026-10-07T07:27Z
- **Tasks:** 2 of 2
- **Files:** 6 created, 1 modified

## Accomplishments

- **snapshot-data.ts** is a thin adapter: no `fetch(`, no `historyRange`, and every request comes from `marketStatsRequest` or `buildListingsRequest`. The `*Cost` functions are free. The load functions spend only through `runtime.requestSpend`, so the ledger cap and the CapConfirmDialog prompt apply. Listings are reduced to `aggregateListings()` inside the module, and raw rows never leave it.
- **snapshot-calls.test.ts** runs 7 cases over the real `createDataRuntime` with a fake key port, fake-indexeddb and a `spyFetch`:
  - New ZIP: the cost shows 1 call, there is exactly 1 `/v1/markets` fetch and 1 billed row, and a repeat makes 0 fetches with the original fetchedAt.
  - The Phase 7 path (`loadMarket(createMarketsPort(rt), zip)`) followed by a snapshot is 0 calls with the cost `{ calls: 0, cached: true }`.
  - New ZIP plus the sale summary is 2 fetches and 2 billed rows. The summary keys match AGGREGATED_SAMPLE_KEYS and BEDROOM_AGGREGATE_KEYS exactly, and the result contains no address or listing id. A second full snapshot is 0 calls.
  - With a key, `gateway.get` and `requestSpend` are each called exactly 2 times for 2 loads, and 0 times for the 2 cost previews.
  - At cap 1, the summary waits on the CapPrompt, and "Not now" rejects with BudgetCapReached having spent 0 calls.
  - Keyless: costs show `{ calls: 0, sample: true }`, fixture stats are badged `sample` with the place name, and there are 0 injected-fetch calls, 0 global-fetch calls and 0 billed rows.
  - Importing the module issues no request.
- **build-record.ts** builds `buildSnapshotRecord`, which reports `effectiveBrandColors` (Tran fallback `#a4452a` / `#f6e3d8`) and `toDisclosureProfile`. It records only the 14 SNAPSHOT_RECORD_KEYS, and `snapshotViolations(record)` returns `[]` even when a leaky summary with formattedAddress or listingAgent is passed in. The record is deep-frozen, synchronous and makes no fetch.
- **sample-snapshot.ts** defines `SAMPLE_MARKET_STATS`: a synthetic domain literal with 24 months on both sides, bedrooms 0-4 and DOM medians. It also holds a hand-authored `SAMPLE_LISTINGS_SUMMARY` and `SAMPLE_SNAPSHOT_RECORD`, built with `buildSnapshotMetrics(` and `sampleSnapshotNotes`. Its import graph has no lib/data path.

## Task Commits

1. **Task 1: snapshot data via the shared market-stats request with call-count proof:** `4c8ed3f` (feat)
2. **Task 2: frozen snapshot record builder and built-in sample report:** `91e9f92` (feat)

Both were committed with an explicit pathspec after `git diff --cached --name-only`. The tests and the implementation were committed together in each task's single feat commit, using the plan's messages.

## Verification

Every Node command ran through the single-core wrapper, mask 0x200.

- `vitest --project web snapshot-calls`: 7/7. `build-record`: 10/10.
- The targeted regression run over features/studio/snapshot, features/shared/markets (markets-port, market-load, charts SSR), storage/studio, ai/prompts/studio and shared/agent-profile passed: 12 files, **148/148**.
- **Mutation proof (not committed):** replacing `marketStatsRequest(zip)` in loadZipData with a hand-built `historyRange: 12` request failed 2 of the 7 call-count tests: "new ZIP" and "dashboard cache hit". The file was restored with `git checkout`.
- `pnpm check`: 0 errors, 0 warnings (2559 files). `pnpm guard`: passed (1520 files). `pnpm banned`: passed (354 files).
- `pnpm lint`: repo-wide `eslint .` is clean. `prettier --check .` flags only `apps/web/src/lib/features/studio/StudioHub.svelte`, the concurrent 09-12 executor's in-progress file, which I did not touch. A scoped `prettier --check` on this plan's files is clean.
- Acceptance greps:
  - snapshot-data.ts contains `marketStats` and `$lib/features/shared/markets`, and has no `fetch(` or `historyRange`.
  - sample-snapshot.ts contains `export const SAMPLE_SNAPSHOT_RECORD`, `id: 'sample'` and `buildSnapshotMetrics(`, and has no `lib/data` import.
  - build-record.ts contains `export function buildSnapshotRecord` and `effectiveBrandColors`.
- All new .ts sources are ASCII-only. No build or Playwright run was made, as the briefing requires. `apps/web/test-results` does not exist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] toMarketStatsInput extracted to a data-free module (file outside files_modified)**
- **Found during:** Task 2
- **Issue:** The record's chart series must come from the Phase 7 mapper, but `toMarketStatsInput` lived in `markets-port.ts`, which imports `$lib/data`. The sample record has to exist "without any lib/data import".
- **Fix:** I moved the mapper unchanged, together with its two helpers, into `features/shared/markets/market-input.ts`, which has type imports only. `markets-port.ts` imports and re-exports it, so its API and tests are unchanged and the markets suites pass. No other Phase 9 plan lists either file.
- **Commit:** `91e9f92`

**2. [Interface adaptation] Contract functions bound to the runtime**
- The plan sketches `snapshotZipCost(zip)` and the others as free functions. The runtime is in Svelte context, so they are methods of `createSnapshotData(runtime)`, with `useSnapshotData()` for components. Their names, parameters and return shapes match the contract.

**3. [Interface adaptation] `profile: ProfileInput`**
- The contract says `AgentProfile`, but the shipped sample agent is a `ProfileInput`. `AgentProfile` is assignable to it, so callers can pass either one.

**4. Test location**
- The call-count test stays in `features/studio/snapshot/`. Its `$lib/data/*` test-only imports use the per-line `eslint-disable-next-line no-restricted-imports -- test-only` pattern already used by `markets-port.test.ts`. The plan's fallback path (`lib/data/studio-snapshot-calls.test.ts`) was not needed.

**Total deviations:** 1 auto-fixed (Rule 3) and 3 interface or location notes. There was no scope creep.

## Issues Encountered

- I once ran `prettier --write` on the whole `features/studio` directory, which also contains 09-12's untracked in-progress files: CharacterCount, DisclosureStatus, InputFairHousingNote and studio-components.test. The visible output reported studio-components.test.ts "(unchanged)", but I can't confirm the other three were unchanged too. If prettier did touch them, it only formatted them. They were never staged or committed here, and later runs targeted explicit paths only.

## Requirements

STU-04 is advanced. Per the briefing, I did not run `requirements mark-complete`, because the 09-23 phase gate closes requirement ids.

## Known Stubs

None. The snapshot builder UI (a later plan) consumes these modules.

## Self-Check: PASSED
