---
phase: 4
slug: data-layer-rentcast-gateway-budget-guard-demo-fixtures
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-04
updated: 2026-10-05
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11 (projects `core`, `web`, `scripts`, `brand` if Phase 2 added it, and the new `web-browser` = @vitest/browser-playwright 4.1.11 + vitest-browser-svelte 2.2.1 on Chromium) + Playwright 1.63.0 / @axe-core/playwright 4.13.0 E2E (`root`, `sub`) |
| **Config file** | `vitest.config.ts` (root projects), `apps/web/vite.config.ts` (Node `web`, excludes `*.browser.test.ts`), `apps/web/vitest.browser.config.ts` (new, plan 04-08), `packages/core/vitest.config.ts`, `scripts/vitest.config.ts`, `apps/web/playwright.config.ts` |
| **Quick run command** | `corepack pnpm vitest run --project core --project web` |
| **Component run** | `corepack pnpm vitest run --project web-browser` |
| **Guard run** | `corepack pnpm guard && corepack pnpm fixtures:check` |
| **Full suite command** | `corepack pnpm verify` (gains `pnpm fixtures:check` after `pnpm guard` in plan 04-06) |
| **Estimated runtime** | quick ~20 s; component ~11 s (`--project web-browser`, 167 tests); full verify 229 s measured at 04-25 (E2E 2.3 min) |

---

## Sampling Rate

- **After every task commit:** `corepack pnpm vitest run --project core --project web` (plus `--project scripts` when touching the guard, generator, ESLint or CI; plus `--project web-browser` when touching a `.svelte` component)
- **After every plan wave:** `corepack pnpm test:unit && corepack pnpm lint && corepack pnpm guard && corepack pnpm fixtures:check`
- **Before `/gsd:verify-work`:** `corepack pnpm verify` green
- **Max feedback latency:** ~30 seconds for the quick command

**Test-writing rules for every Phase 4 task:** inject the clock; NEVER call `vi.useFakeTimers()` in a test that touches IndexedDB (fake-indexeddb deadlock, RESEARCH Pitfall 1); fake keys are low-entropy (`'test-key-not-real'`, `'k'.repeat(32)`, Pitfall 13); planted PII is built from fragments (`j('512','994','8203')`, Pitfall 5); unit tests never touch the network (inject `fetch`), E2E routes every `https://api.rentcast.io/**` request.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | DATA-03, DATA-04 | type/static | `corepack pnpm check` | ✅ | ✅ green |
| 4-01-02 | 01 | 1 | DATA-03, DATA-04 | unit (fake IDB) + schema-registry | `corepack pnpm vitest run --project web platform schema-registry` | ✅ | ✅ green |
| 4-02-01 | 02 | 1 | DATA-02 | unit (core) | `corepack pnpm vitest run --project core budget` | ✅ | ✅ green |
| 4-02-02 | 02 | 1 | DATA-02, DATA-03 | unit (core) + mutation | `corepack pnpm vitest run --project core cap` | ✅ | ✅ green |
| 4-03-01 | 03 | 1 | DATA-04 | unit (core) | `corepack pnpm vitest run --project core canonical` | ✅ | ✅ green |
| 4-03-02 | 03 | 1 | DATA-05 | unit (core) + mutation | `corepack pnpm vitest run --project core errors` | ✅ | ✅ green |
| 4-04-01 | 04 | 1 | DATA-01 | unit (core) | `corepack pnpm vitest run --project core normalize` | ✅ | ✅ green |
| 4-04-02 | 04 | 1 | DATA-04 | unit (core) | `corepack pnpm vitest run --project core listings` | ✅ | ✅ green |
| 4-05-01 | 05 | 1 | DATA-03 | unit (core) + mutation | `corepack pnpm vitest run --project core diff` | ✅ | ✅ green |
| 4-05-02 | 05 | 1 | DATA-03 | unit (core) | `corepack pnpm vitest run --project core schedule` | ✅ | ✅ green |
| 4-06-01 | 06 | 1 | DATA-01 | unit (scripts) | `corepack pnpm vitest run --project scripts real-data-rules` | ✅ | ✅ green |
| 4-06-02 | 06 | 1 | DATA-01 | CLI | `node scripts/gen-fixtures.mjs --check && corepack pnpm guard` | ✅ | ✅ green |
| 4-06-03 | 06 | 1 | DATA-01 | unit (scripts) planted-PII + drift | `corepack pnpm vitest run --project scripts gen-fixtures fixtures-guard workflow-gate` | ✅ | ✅ green |
| 4-07-01 | 07 | 1 | DATA-04 | lint unit (RED) | `corepack pnpm vitest run --project scripts eslint-rules` (red at 04-07 Task 1; green since 04-07 Task 2) | ✅ | ✅ green |
| 4-07-02 | 07 | 1 | DATA-03, DATA-04 | lint unit | `corepack pnpm vitest run --project scripts eslint-rules && corepack pnpm lint` | ✅ | ✅ green |
| 4-08-01 | 08 | 2 | DATA-02 | browser spike (ban + axe non-vacuity) | `corepack pnpm vitest run --project web-browser` | ✅ | ✅ green |
| 4-08-02 | 08 | 2 | DATA-02 | CI order unit | `corepack pnpm vitest run --project scripts workflow-gate && corepack pnpm lint:workflows` | ✅ | ✅ green |
| 4-09-01 | 09 | 2 | DATA-04, DATA-05 | unit (web) | `corepack pnpm vitest run --project web rentcast/client` | ✅ | ✅ green |
| 4-09-02 | 09 | 2 | DATA-05 | unit (web) key probe | `corepack pnpm vitest run --project web rentcast` | ✅ | ✅ green |
| 4-10-01 | 10 | 2 | DATA-01, DATA-05 | unit (fixtures through live schemas) | `corepack pnpm vitest run --project web rentcast/schemas` | ✅ | ✅ green |
| 4-10-02 | 10 | 2 | DATA-01 | unit (mappers) | `corepack pnpm vitest run --project web rentcast` | ✅ | ✅ green |
| 4-11-01 | 11 | 2 | DATA-03, DATA-04 | unit (fake IDB) | `corepack pnpm vitest run --project web ledger-repo cache-repo` | ✅ | ✅ green |
| 4-11-02 | 11 | 2 | DATA-03 | concurrency + mutation proof | `corepack pnpm vitest run --project web ledger` | ✅ | ✅ green |
| 4-12-01 | 12 | 2 | DATA-01 | unit (fixture fetch, +400 d rebasing) | `corepack pnpm vitest run --project web fixture-fetch` | ✅ | ✅ green |
| 4-12-02 | 12 | 2 | DATA-01 | unit (estimates/markets) | `corepack pnpm vitest run --project web fixture-fetch` | ✅ | ✅ green |
| 4-13-01 | 13 | 3 | DATA-02, DATA-04 | unit — identical repeat spends 0 + original fetchedAt; dedupe; cost | `corepack pnpm vitest run --project web gateway.cache gateway.cost` | ✅ | ✅ green |
| 4-13-02 | 13 | 3 | DATA-03, DATA-05 | unit — **60 calls block #41**; grants; errors; cross-instance race + mutation | `corepack pnpm vitest run --project web gateway` | ✅ | ✅ green |
| 4-14-01 | 14 | 3 | DATA-02, DATA-04 | unit (copy) | `corepack pnpm vitest run --project web relative-time` | ✅ | ✅ green |
| 4-14-02 | 14 | 3 | DATA-01, DATA-02, DATA-04 | component + axe | `corepack pnpm vitest run --project web-browser ProvenanceRow CostLabel NewSinceBadge` | ✅ | ✅ green |
| 4-15-01 | 15 | 3 | DATA-02, DATA-05 | unit (copy) | `corepack pnpm vitest run --project web meter-errors` | ✅ | ✅ green |
| 4-15-02 | 15 | 3 | DATA-02 | component + axe | `corepack pnpm vitest run --project web-browser CallMeter` | ✅ | ✅ green |
| 4-15-03 | 15 | 3 | DATA-05 | component + axe (8 variants) | `corepack pnpm vitest run --project web-browser GatewayError` | ✅ | ✅ green |
| 4-16-01 | 16 | 3 | DATA-03 | component + axe (variants A/B, focus) | `corepack pnpm vitest run --project web-browser CapConfirmDialog` | ✅ | ✅ green |
| 4-16-02 | 16 | 3 | DATA-03 | component + axe (typed overage) | `corepack pnpm vitest run --project web-browser CapEditor` | ✅ | ✅ green |
| 4-17-01 | 17 | 4 | DATA-01 | unit | `corepack pnpm vitest run --project web mode` | ✅ | ✅ green |
| 4-17-02 | 17 | 4 | DATA-01, DATA-04 | unit — keyless all endpoints, 0 spend, mode-switch leak | `corepack pnpm vitest run --project web gateway` | ✅ | ✅ green |
| 4-18-01 | 18 | 5 | DATA-03 | unit — cap prompt per call, cross-tab | `corepack pnpm vitest run --project web runtime` | ✅ | ✅ green |
| 4-18-02 | 18 | 5 | DATA-04 | component (peek store) + port surface | `corepack pnpm vitest run --project web-browser stores && corepack pnpm vitest run --project web runtime` | ✅ | ✅ green |
| 4-19-01 | 19 | 5 | DATA-03 | unit (claims, concurrency) | `corepack pnpm vitest run --project web saved-search-repo` | ✅ | ✅ green |
| 4-19-02 | 19 | 5 | DATA-03 | unit — **5 due searches run once / 24 h**; parallel + mutation | `corepack pnpm vitest run --project web scheduler` | ✅ | ✅ green |
| 4-20-01 | 20 | 4 | DATA-01, DATA-05 | unit (copy) | `corepack pnpm vitest run --project web copy/source` | ✅ | ✅ green |
| 4-20-02 | 20 | 4 | DATA-05 | component + axe | `corepack pnpm vitest run --project web-browser KeyTestResult DataSourceChoice` | ✅ | ✅ green |
| 4-20-03 | 20 | 4 | DATA-01, DATA-03 | component + axe | `corepack pnpm vitest run --project web-browser DueSearchesDialog DataStatusBar` | ✅ | ✅ green |
| 4-21-01 | 21 | 6 | DATA-04 | lint + type | `corepack pnpm lint && corepack pnpm check` | ✅ | ✅ green |
| 4-21-02 | 21 | 6 | DATA-04 | component — **10 re-renders spend 0** + mutants | `corepack pnpm vitest run --project web-browser rerender` | ✅ | ✅ green |
| 4-22-01 | 22 | 6 | DATA-03 | unit | `corepack pnpm vitest run --project web alerts runtime` | ✅ | ✅ green |
| 4-22-02 | 22 | 6 | DATA-01, DATA-02, DATA-03 | component + build + CSP | `corepack pnpm vitest run --project web-browser DataShell && corepack pnpm build:root && corepack pnpm csp:assert` | ✅ | ✅ green |
| 4-23-01 | 23 | 7 | DATA-05 | unit | `corepack pnpm vitest run --project web key-test runtime` | ✅ | ✅ green |
| 4-23-02 | 23 | 7 | DATA-02, DATA-03 | component + axe | `corepack pnpm vitest run --project web-browser RentCastUsageSection` | ✅ | ✅ green |
| 4-23-03 | 23 | 7 | DATA-02, DATA-05 | build + E2E | `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert && corepack pnpm test:e2e` | ✅ | ✅ green |
| 4-24-01 | 24 | 8 | DATA-01, DATA-02, DATA-03 | E2E + axe (root, sub) | `corepack pnpm --filter web exec playwright test data-status` | ✅ | ✅ green |
| 4-24-02 | 24 | 8 | DATA-02, DATA-03, DATA-05 | E2E + axe (root, sub) | `corepack pnpm test:e2e` | ✅ | ✅ green |
| 4-25-01 | 25 | 9 | DATA-01..05 | doc | `grep -c "^| U" .planning/phases/04-data-layer-rentcast-gateway-budget-guard-demo-fixtures/04-HUMAN-UAT.md` (= 14) | ✅ | ✅ green |
| 4-25-02 | 25 | 9 | DATA-01..05 | full gate | `corepack pnpm verify` | ✅ | ✅ green |

*Status legend: ⬜ not yet run · ✅ green · ❌ red · ⚠️ flaky*

### Success criterion → proof

| Criterion | Proof (task) |
|-----------|--------------|
| SC1 sample data for every data type, badged, PII scan passes | 4-06-01..03, 4-10-01, 4-12-01/02, 4-17-02, 4-14-02, 4-20-03, 4-24-01 |
| SC2 meter + cost before every spend | 4-02-01/02, 4-13-01 (estimateCost), 4-14-02 (CostLabel), 4-15-02 (CallMeter), 4-24-02 |
| SC3 cap 40/50 + confirm; **60 calls block #41**; **10 re-renders spend 0**; **5 due searches once / 24 h** | 4-11-02, 4-13-02, 4-16-01/02, 4-18-01, 4-21-02, 4-19-02, 4-07-02 (lint layer) |
| SC4 identical repeat → cached, original "as of", Refresh (1 call) | 4-03-01, 4-13-01, 4-14-02 |
| SC5 zero-cost Test key valid/invalid/restricted; specific error messages | 4-03-02, 4-09-02, 4-13-02, 4-15-03, 4-20-02, 4-23-01, 4-24-02 |

### Phase 6 research additions (coordinator, 2026-10-04) → proof

| Addition | Proof |
|----------|-------|
| `peek(request)` and `peekListingById(id)` (0 calls) | 4-13-01, 4-17-02, 4-18-02 |
| `rentalListingById(id)` (1 call, explicit only; lint-banned in `$effect`) | 4-03-01 (endpoint), 4-13-01, 4-07-02 |
| `core.normalizeLocation` with canonical casing | 4-04-01 |
| Fixture dates shifted relative to today at load | 4-12-01 (+400 days test) |
| Dexie schema versions strictly increase; every table backup-registered or explicitly excluded | 4-01-02 (schema-registry.test.ts) |
| Searches carry only location + status=Active + limit=500; pure `filterListings`; "Narrow on RentCast (1 call)" params | 4-04-02 |
| Real-key UAT: open-ended `*` bounds, top bedroom bucket, listing in its own comparables | 4-25-01 (U12-U14) |

---

## Wave 0 Requirements

- [x] Phase 3 executed; contract map recorded (plan 04-01 Task 1 gate — Phase 4 STOPS if Phase 3 is missing)
- [x] Dev deps at exact pins: `fake-indexeddb@6.2.5`, `@vitest/browser-playwright@4.1.11`, `vitest-browser-svelte@2.2.1`, `playwright@1.63.0`, `axe-core@4.13.0`; `@tran/core` workspace dep + `"./*"` subpath exports (04-01)
- [x] `apps/web/src/lib/data/testing/harness.ts` (`makeDb`, `spyFetch`, `jsonResponse`, `T0`, `TEST_KEY`) (04-01)
- [x] `apps/web/vitest.browser.config.ts` + root projects entry + spike green WITH the no-network setup file (04-08)
- [x] `ci.yml`: Chromium install moved above `pnpm test:unit` (04-08)
- [x] `scripts/gen-fixtures.mjs --check` in `pnpm verify` and CI quality (04-06)
- [x] `apps/web/src/lib/data/testing/gateway-harness.ts` (`makeGateway`, `rentals()`) (04-13)
- [x] Core test files under `packages/core/src/{budget,request,location,listings,alerts}/` (04-02..04-05)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real RentCast billing/probe behavior (U1-U14) | DATA-03, DATA-05 | Needs the owner's dedicated endpoint-restricted key and the RentCast dashboard counter; never automated, never committed | `04-HUMAN-UAT.md` (created by 04-25); non-blocking |
| CapConfirmDialog opened from a real portal spend (E2E) | DATA-03 | Phase 4 ships no portal surface that spends; covered by component tests (4-16-01, axe) and the runtime prompt test (4-18-01) | Phases 6-9 add the E2E when their Search buttons exist |
| Live-origin CORS from the deployed site | DATA-05 | No deployed origin yet (deferred hosting) | HUMAN-UAT U11 |

---

## Mutation proofs (recorded in SUMMARYs; never committed)

Planned guards (04-25 confirmed each record exists in the named SUMMARY):

| Guard | Mutation | Observed red | Record |
|-------|----------|--------------|--------|
| Cap reservation atomicity (04-11) | usage + cap read moved into a separate `'r'` transaction before the `'rw'` add | `ledger.concurrency`: 2 failed / 1 passed; both tabs took call #40 (control stayed green) | 04-11-SUMMARY "Mutation proof" |
| Gateway cap (04-13) | `ledger.reserve(...)` removed from `spend()` | 60-call probe: 60 fetches, 0 blocked (baseline 40 / 20) | 04-13-SUMMARY "Mutation runs" |
| Scheduler claim (04-19) | scheduler skips `repo.claim` | two-scheduler test: expected 10 to be 5 | 04-19-SUMMARY "Mutation runs" |
| Reactive spend (04-21) | `assertNotReactive` made a no-op; peek store using `refresh` | 1 red (mutant-with-real-guard); 2 red (warm/empty cache) | 04-21-SUMMARY "Mutation runs" |
| Near threshold (04-02) | `nearMaxLeft: 5` -> `6` | `core cap`: 2 failed | 04-02-SUMMARY |
| Probe 404 mapping (04-03) | 404 -> `'valid-billed'` in `classifyProbe` | 1 failed / 45 passed | 04-03-SUMMARY |
| Diff truncation + cap admission (04-05) | truncated guard dropped; admission `<= cap + 1` | 2 failed; 5 failed | 04-05-SUMMARY |
| Fixture PII scan (04-06) | `findFixtureProblems` hook disabled | 24 planted cases fail (ZIP, URL host, MLS number, id x 6 files) | 04-06-SUMMARY |

Additional mutation runs recorded by executors:

| Plan | Mutation | Observed red |
|------|----------|--------------|
| 04-01 | `PHASE4_BACKUP_EXCLUDED` emptied | backup-coverage test fails |
| 04-07 | `DATA_INTERNALS` removed from portal ESLint entries | 3 cases fail (flat-config replacement hazard is real) |
| 04-09 | `suppressLogging` removed from the client | 4 tests fail |
| 04-12 | creation-time rebase replaced with raw data | +400-day `daysOld=*:7` test fails |
| 04-13 | in-flight dedupe removed | first run green -> 2 tests added -> 2 red (dedupe made mutation-visible, 4be1e6e) |
| 04-13 | serial queue removed | "never two requests in flight" red (peak 2) |
| 04-13 | ledger reserve read outside the rw transaction | cross-instance: 2 fetches instead of 1 |
| 04-16 | `interactOutsideBehavior` -> `'close'` | planted-target outside-click test fails (first overlay-click version was vacuous, replaced) |
| 04-17 | sample client fetch pointed at `probeFetch` | 11 of 21 sample tests fail incl. "0 live fetches, 0 ledger rows, 0 cache rows" |
| 04-18 | `#post` without `postMessage`; sync guard check removed; `reactiveGuard` not passed; confirm without grant; peek store uses `get`; stale `current` | each red (sync-guard case needed a new tracking test first) |
| 04-19 | `claim()` read in a separate `'r'` transaction | repo `[true, true]`; scheduler two-tab 7 fetches instead of 5 |
| 04-19 | `planRun` gets `used: 0` | 3 cap tests red |
| 04-21 | suppression comment removed from `MutantEffectView` | ESLint `no-restricted-syntax` error |
| 04-22 | meter baseline `'ok'` instead of `null`; `progress={null}` | each 1 red |
| 04-23 | key-change generation guard dropped; raw `bad-format` returned; `{#key 0}` | each red |

Non-vacuity cases are committed rather than run as mutations in 04-08 (planted `image-alt` axe
violation), 04-10 (planted value never echoed in `issues`) and every component axe test.

Out-of-plan fixes this phase (each landed with a test that failed first):

| Commit | Fix | Proof |
|--------|-----|-------|
| 7506489 | core `summarize()` leaves `intent === 'key-test'` 404/400 rows out of `noResults`, so a free Test key no longer shows "Not counted: 1 searches with no results." | core `summarize` test + `ledger-repo` `record` test; deferred-items.md 04-23 entry RESOLVED |
| af05ac7 | `runtime.start()` awaits `KeyPort.ready()` before choosing live vs sample, so a keyed session never runs due searches against fixtures (stamping `lastRunAt`) | runtime test holds `ready()` open: mode stays null, then `rentcast/live` with no fixtures loaded (red before the fix) |
| 72b6875 (04-25) | Playwright runs with `reducedMotion: 'reduce'` suite-wide; smooth scrolling made Save key / Import backup clicks land mid-scroll | first 04-25 verify: 2 E2E failures (`app-notice` root, `settings-keys` sub) with traces showing "element is not stable" -> "outside of the viewport" -> click done, no effect; after the fix 156/156 on `--repeat-each 3` of the affected specs and the full gate green |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30 s for the quick command
- [x] `nyquist_compliant: true` set in frontmatter

**Map walk (04-25, 2026-10-05):** every row above was re-run with its exact command and exited 0.
`4-23-03`, `4-24-02` and `4-25-02` were proven by the composed `corepack pnpm verify` on a clean
tree at 72b6875: exit 0 in 229 s; unit 87 files / 1384 tests (incl. `web-browser`); CSP 14 pages
per build; E2E 496 passed + 2 skipped on root and sub; guard 734 files; fixtures match (6 files);
gitleaks history clean (367 commits); actionlint clean.

**Approval:** approved 2026-10-05
