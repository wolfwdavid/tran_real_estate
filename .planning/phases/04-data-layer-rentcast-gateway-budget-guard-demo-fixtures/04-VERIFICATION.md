---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
verified: 2026-10-05T13:04:44Z
status: human_needed
score: 5/5 must-haves verified (automated); 14 real-key UAT checks pending owner action
human_verification:
  - test: "U1-U14 real RentCast key checks (04-HUMAN-UAT.md)"
    expected: "Key format, probe status codes (U3/U4/U5), 404/empty-search billing (U6/U7), page-2 billing (U8), cancelled-plan 403 body (U9), real field coverage (U10), live-origin CORS (U11), open-ended range bounds / bedroom bucket / own-listing-in-comparables (U12-U14) all match the documented expectations"
    why_human: "Needs the owner's dedicated, endpoint-restricted RentCast key and the RentCast dashboard usage counter; never automated, never committed (CLAUDE.md data hygiene). Non-blocking per 04-HUMAN-UAT.md and 04-VALIDATION.md Manual-Only Verifications — does not block Phases 5-9."
---

# Phase 4: Data Layer (RentCast Gateway, Budget Guard, Demo Fixtures) Verification Report

**Phase Goal:** Every RentCast call flows through one gateway that caches, meters, and hard-stops before the user is charged, and every portal has realistic synthetic sample data when no key is present.
**Verified:** 2026-10-05T13:04:44Z
**Status:** human_needed (all automated checks pass; 14 real-key UAT items are owner-gated by design, not code gaps)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Visitor without a key gets badged sample data for rentals, sales, estimates, and market stats; CI PII scan passes | ✓ VERIFIED | `apps/web/src/lib/data/fixtures/{rentals,sales,estimates,markets,metros,meta}.json` (12,555 lines total), `fixtures/fixture-fetch.ts`, `mode.ts` `resolveMode()` defaults to `sample` whenever no readable key (`no-key`/`locked`); `scripts/gen-fixtures.mjs --check` exits "Fixtures match generator output (6 files)"; `scripts/lib/real-data-rules.mjs` `findFixtureProblems` PII scan covered by 24 planted-case mutation test (04-06-SUMMARY); `corepack pnpm vitest run --project scripts` → 340/340 passed |
| 2 | User sees a call meter and the cost of an action before it runs | ✓ VERIFIED | `CallMeter.svelte`, `CostLabel.svelte` (renders `estimateCost()` output inline in the action label, never a tooltip), `DataShell.svelte` wires `runtime.usage` into `DataStatusBar`; `RentCastUsageSection.svelte` in Settings |
| 3 | Real key: app blocks next call at user-editable cap (default 40/50), requires explicit confirmation beyond it; 60-call probe blocks #41; 10 re-renders spend 0; 5 due searches run once/24h | ✓ VERIFIED | `gateway.ts` `spend()` → `ledger.reserve()` before `client.get()`; `gateway.budget.test.ts` ("60 calls block #41"); `CapConfirmDialog.svelte` + `runtime.svelte.ts` `capPrompt`/`confirmCapPrompt`; `rerender.browser.test.ts` (10 re-renders, 0 spend, mutation-proven); `scheduler.ts` + `scheduler.test.ts` ("5 due searches run once/24h", mutation-proven); ran `vitest run --project core --project web gateway cap scheduler ledger` → 153/153 passed |
| 4 | Identical repeat returns cached data with "as of" timestamp, 0 calls; "Refresh (1 call)" refetches on demand | ✓ VERIFIED | `gateway.ts` `fromCache()`/`resultOf()` preserve the ORIGINAL `fetchedAt`; `refresh()` bypasses TTL via `bypassTtl=true` but still goes through `ledger.reserve`; `gateway.cache.test.ts`, `ProvenanceRow.svelte` renders "as of"; `CostLabel` shows "(1 call)" for refresh |
| 5 | Testing a key in Settings reports valid/invalid/restricted without a billed call; specific messages for invalid/restricted/rate-limit/cap/no-results | ✓ VERIFIED | `rentcast/probe.ts` `testRentCastKey` + `PROBE_REQUEST` (400/404 non-billing probe); `testKeyWith()` in `gateway.ts` records intent `'key-test'` so it's excluded from `noResults` (fix 7506489, tested); `KeyTestResult.svelte`, `copy/errors.ts`, `copy/source.ts` carry the five specific message variants; `04-09`, `04-23` test files green |

**Score:** 5/5 truths verified by automation.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/{budget,request,location,listings,alerts}/` | Pure cap/error/canonical-key/location/listing domain logic | ✓ VERIFIED | All five directories present with implementation + test files; `corepack pnpm vitest run --project core` subset passed (cap, budget, canonical, errors, normalize, listings, diff, schedule all green in targeted runs) |
| `apps/web/src/lib/data/gateway.ts` | `createDataGateway` (live) + `createSampleGateway` (demo), read/spend split, dedupe, serial queue, reservation, taxonomy | ✓ VERIFIED | 467 lines, no stub markers; reviewed in full — in-flight dedupe (`inflight` Map), serial queue (`enqueue`/`tail`), reserve→fetch→settle, negative caching, `ReactiveSpendError` guard, sample gateway behind the identical `DataGateway` port |
| `apps/web/src/lib/data/runtime.svelte.ts` | Mode resolution, cap prompts, scheduler integration | ✓ VERIFIED | 434 lines; `af05ac7` fix confirmed (awaits `KeyPort.ready()` before resolving mode), tested in `runtime.test.ts` |
| `apps/web/src/lib/data/scheduler.ts` | Due saved-search runner, ≤1 run per 24h, claim-based concurrency | ✓ VERIFIED | 194 lines; `scheduler.test.ts` mutation-proven ("expected 10 to be 5" when claim skipped) |
| `apps/web/src/lib/data/ledger-repo.ts`, `cache-repo.ts` | Atomic reserve/settle, cache get/put/findListingById | ✓ VERIFIED | 156 / 52 lines; `ledger.concurrency.test.ts` mutation-proven (cap-reservation atomicity, cross-tab) |
| `apps/web/src/lib/data/rentcast/` (client, mappers, probe, schemas) | Typed RentCast client + Zod validation + mappers + key probe | ✓ VERIFIED | All present with paired test files; exercised by both live and sample gateways |
| `apps/web/src/lib/data/fixtures/` + `scripts/gen-fixtures.mjs` | Synthetic sample dataset, regenerable, PII-scanned | ✓ VERIFIED | 6 JSON fixture files (12,555 lines), `gen-fixtures.mjs` (536 lines) `--check` passes; `scripts/lib/real-data-rules.mjs` PII scan with 24-case mutation proof |
| `apps/web/src/lib/data/index.ts` (public port) | Explicit, additive export surface; internals hidden | ✓ VERIFIED | 39 lines; exports runtime, peek store, key-test, alerts, scheduler types, gateway types, mode/tables/platform types, sample metros, core error re-exports — no client/repo/grant leakage |
| `apps/web/src/lib/features/shared/data/` components | Meter, cost label, cap dialogs, error copy, provenance, status bar | ✓ VERIFIED | 30 components/modules present, each with a `.browser.test.ts` or `.test.ts` companion; reviewed `DataShell.svelte` (wires runtime, status bar, cap dialog, due-searches dialog) and `CostLabel.svelte` (renders `estimateCost()` inline, never hidden) |
| `apps/web/src/routes/(app)/+layout.svelte` | Mounts `DataShell` as first child of `<main>` | ✓ VERIFIED | Confirmed: `DataShell` wraps `AppNotice` + `children()`, `showStatusBar` hidden only on `/settings/` |
| `apps/web/src/routes/(app)/settings/+page.svelte` | RentCast usage section + Test key wiring | ✓ VERIFIED | Confirmed: `enableRentCastKeyTest(dataRuntime)` registered in `onMount`, `RentCastUsageSection` rendered via section registry |
| `eslint.config.js` DATA_INTERNALS rules (04-07) | Portal/marketing code can't import gateway internals directly | ✓ VERIFIED | `DATA_INTERNALS` restricted-import pattern present, merged into marketing/portal entries; `04-07` mutation proof (3 cases fail when removed) |
| `apps/web/tests/e2e/{data-status,settings-data}.spec.ts` | E2E coverage of status bar and settings data flows | ✓ VERIFIED | 133 / 212 lines respectively; both referenced in the 72b6875 reduced-motion fix, part of the 496-passed E2E run recorded in 04-VALIDATION.md |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `gateway.ts get()` | `ledger-repo.reserve()` | reserve → fetch → settle → cache.put | ✓ WIRED | Confirmed in source: `spend()` calls `ledger.reserve` before `client.get`, settles after, caches on 200 |
| `gateway.ts` | `cache-repo.get()` + `isStale()` | fresh-cache short-circuit before reserve | ✓ WIRED | `isFresh()` check precedes `ledger.reserve` in both `spend()` and `read()` |
| `DataShell.svelte` | `runtime.svelte.ts` `createDataRuntime` | `setDataRuntime`/`getDataRuntime` context | ✓ WIRED | One runtime per mount, started in `onMount`, provided through Svelte context, consumed by Settings page |
| `(app)/+layout.svelte` | `DataShell.svelte` | direct import, wraps `<main>` children | ✓ WIRED | Confirmed in layout source |
| `settings/+page.svelte` | `enableRentCastKeyTest` / `RentCastUsageSection` | `getDataRuntime()` + section registry | ✓ WIRED | Confirmed in settings page source |
| `scheduler.ts` | `saved-search-repo.ts` `claim()` | atomic claim before run, ≤1/24h | ✓ WIRED | Mutation-proven (04-19 SUMMARY: claim removed → scheduler runs twice) |
| `scripts/gen-fixtures.mjs` | `scripts/lib/real-data-rules.mjs` | PII scan gate in `pnpm verify` | ✓ WIRED | `node scripts/gen-fixtures.mjs --check` exits 0; guard integrated per 04-06 |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| DATA-01 | 04-04, 04-06, 04-10, 04-12, 04-14, 04-17, 04-18, 04-20, 04-22, 04-24, 04-25 | Visitor without key can use every portal on badged synthetic sample data | ✓ SATISFIED | `createSampleGateway`, fixtures, `mode.ts`, `DataSourceChoice.svelte`, sample badge components, independently confirmed above |
| DATA-02 | 04-02, 04-08, 04-13, 04-14, 04-15, 04-18, 04-22, 04-23, 04-24 | User sees calls used this month and call cost before running an action | ✓ SATISFIED | `CallMeter`, `CostLabel`, `estimateCost`/`estimateBatchCost`, `RentCastUsageSection` |
| DATA-03 | 04-01, 04-02, 04-05, 04-07, 04-11, 04-13, 04-16, 04-18, 04-19, 04-20, 04-21, 04-22, 04-23, 04-24 | App stops at user-editable cap (default 40/50), requires explicit confirmation to go beyond | ✓ SATISFIED | `ledger.reserve`, `CapConfirmDialog`, `CapEditor`, `grantOverCap`/`OverCapGrant`, 60-call and cross-instance mutation proofs |
| DATA-04 | 04-01, 04-03, 04-04, 04-07, 04-09, 04-11, 04-13, 04-14, 04-17, 04-18, 04-21 | Repeated identical requests served from cache with "as of" timestamp; manual "Refresh (1 call)" | ✓ SATISFIED | `fromCache`, `ProvenanceRow`, `refresh()` bypassTtl path |
| DATA-05 | 04-03, 04-09, 04-10, 04-13, 04-15, 04-20, 04-23, 04-24 | Specific messages for invalid key, restricted key, rate limit, budget cap reached, no results | ✓ SATISFIED | `GatewayError` taxonomy (`InvalidKey`, `RestrictedKey`, `RateLimited`, `BudgetCapReached`, `NoResults`), `copy/errors.ts`, `GatewayError.svelte` (8 component variants) |

No orphaned requirements: REQUIREMENTS.md lists exactly DATA-01..05 for Phase 4, and every ID appears in at least one plan's `requirements` frontmatter field, cross-checked above.

**Note on premature completion marking:** `requirements mark-complete` ticked DATA-01..05 during wave 1 (before implementation existed), per the task's own caveat. This verification re-derived satisfaction independently from source code and test runs, not from the REQUIREMENTS.md checkmarks, and reaches the same conclusion the marks claimed.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TODO/FIXME/XXX/HACK/placeholder/"not yet implemented"/"coming soon" markers found in any non-test file under `packages/core/src/{budget,request,location,listings,alerts}`, `apps/web/src/lib/data/`, `apps/web/src/lib/features/shared/data/`, `scripts/gen-fixtures.mjs` | — | None found | — |

One grep hit (`endpoints.ts:24`, the word "placeholder" in a doc comment about URL path templating, e.g. `{id}`) is not a stub — it describes a real, implemented mechanism, confirmed by reading the surrounding code.

Known pre-existing, explicitly out-of-scope debt (not a Phase 4 gap): the tailwind-merge font-size class collision on Phase 3's Badge/Button (deferred-items.md "From 04-14"), scheduled for a Phase 5+ UI fix; Phase 4's own chips build their own class strings and are unaffected.

### Out-of-Plan Fixes Verified

| Commit | Fix | Test Confirmed |
|--------|-----|-----------------|
| 7506489 | `summarize()` excludes `intent === 'key-test'` 404/400 rows from `noResults` | `packages/core/src/budget/budget.test.ts` (+18 lines), `apps/web/src/lib/data/ledger-repo.test.ts` (+12 lines) — both present and passing |
| af05ac7 | `runtime.start()` awaits `KeyPort.ready()` before resolving mode (no sample flash, no stale due-search run for a keyed session) | `apps/web/src/lib/data/runtime.test.ts` (+25 lines) — present and passing |
| 72b6875 | `reducedMotion: 'reduce'` as the Playwright suite default (prevents clicks landing mid-smooth-scroll) | `apps/web/playwright.config.ts` default changed; per-spec overrides removed from `data-status.spec.ts`/`settings-data.spec.ts`; proof recorded in 04-VALIDATION.md (156/156 on `--repeat-each 3`, full `verify` green) |

All three have accompanying tests, confirmed by reading the commit diffs (`git show --stat`) and the current test files.

### Human Verification Required

#### 1. Real-key UAT checklist (U1-U14)

**Test:** Follow `04-HUMAN-UAT.md` steps A/B/C with a dedicated, endpoint-restricted RentCast key: Settings → Test key (valid, invalid, restricted), an empty real search once Phase 6 ships Search, page-2 billing, cancelled-plan 403 body, real field coverage, live-origin CORS after deploy, and the three Phase-6-dependent range/bucket/comparables checks.
**Expected:** Status codes and dashboard-counter deltas match the documented expectations in each row of the checklist; zero-cost probe for key tests confirmed against the real RentCast billing counter (not just mocks).
**Why human:** Requires the owner's real RentCast account/key and the RentCast dashboard's usage counter — this can never be safely automated or committed (CLAUDE.md data-hygiene rule against committing real RentCast responses or keys). This is non-blocking by explicit design: 04-HUMAN-UAT.md and 04-VALIDATION.md both record it as deferred/pending with 0 gaps, since every mocked behavior is already covered by the full automated suite (1384 unit + 496 E2E, all green per 04-25's `verify` run).

### Gaps Summary

No code gaps found. Every observable truth, required artifact, and key link derived from the phase goal and the 25 plans' `must_haves` is present, substantive (no placeholders, no TODO markers, real logic with accompanying tests), and wired end-to-end from the route layout down through the gateway to the ledger/cache repos. Targeted re-runs of the most safety-critical unit tests (cap enforcement, scheduler dedupe, cache/ledger concurrency, fixtures PII guard — 153 + 340 tests) passed cleanly in this verification session, independent of trusting the SUMMARY/VALIDATION claims. The three commits that landed outside the original 25 plans (7506489, af05ac7, 72b6875) each carry their own regression test or configuration proof.

The only open item is the real-key UAT checklist (U1-U14), which is intentionally owner-gated and explicitly marked non-blocking in the phase's own validation strategy — it tests RentCast's live billing behavior and real response shapes, which cannot be exercised without spending the owner's actual quota. This does not block Phase 5+ work.

---

*Verified: 2026-10-05T13:04:44Z*
*Verifier: Claude (gsd-verifier)*
