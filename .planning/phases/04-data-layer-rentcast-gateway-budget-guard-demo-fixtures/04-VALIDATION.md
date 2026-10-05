---
phase: 4
slug: data-layer-rentcast-gateway-budget-guard-demo-fixtures
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-04
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
| **Estimated runtime** | quick ~20 s; component ~30 s; full verify ~2-3 min warm (Phase 1 baseline 71-79 s + browser project + new E2E specs) |

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
| 4-01-01 | 01 | 1 | DATA-03, DATA-04 | type/static | `corepack pnpm check` | ✅ | ⬜ pending |
| 4-01-02 | 01 | 1 | DATA-03, DATA-04 | unit (fake IDB) + schema-registry | `corepack pnpm vitest run --project web platform schema-registry` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 1 | DATA-02 | unit (core) | `corepack pnpm vitest run --project core budget` | ❌ W0 | ⬜ pending |
| 4-02-02 | 02 | 1 | DATA-02, DATA-03 | unit (core) + mutation | `corepack pnpm vitest run --project core cap` | ❌ W0 | ⬜ pending |
| 4-03-01 | 03 | 1 | DATA-04 | unit (core) | `corepack pnpm vitest run --project core canonical` | ❌ W0 | ⬜ pending |
| 4-03-02 | 03 | 1 | DATA-05 | unit (core) + mutation | `corepack pnpm vitest run --project core errors` | ❌ W0 | ⬜ pending |
| 4-04-01 | 04 | 1 | DATA-01 | unit (core) | `corepack pnpm vitest run --project core normalize` | ❌ W0 | ⬜ pending |
| 4-04-02 | 04 | 1 | DATA-04 | unit (core) | `corepack pnpm vitest run --project core listings` | ❌ W0 | ⬜ pending |
| 4-05-01 | 05 | 1 | DATA-03 | unit (core) + mutation | `corepack pnpm vitest run --project core diff` | ❌ W0 | ⬜ pending |
| 4-05-02 | 05 | 1 | DATA-03 | unit (core) | `corepack pnpm vitest run --project core schedule` | ❌ W0 | ⬜ pending |
| 4-06-01 | 06 | 1 | DATA-01 | unit (scripts) | `corepack pnpm vitest run --project scripts real-data-rules` | ✅ extend | ⬜ pending |
| 4-06-02 | 06 | 1 | DATA-01 | CLI | `node scripts/gen-fixtures.mjs --check && corepack pnpm guard` | ❌ W0 | ⬜ pending |
| 4-06-03 | 06 | 1 | DATA-01 | unit (scripts) planted-PII + drift | `corepack pnpm vitest run --project scripts gen-fixtures fixtures-guard workflow-gate` | ❌ W0 | ⬜ pending |
| 4-07-01 | 07 | 1 | DATA-04 | lint unit (RED) | `corepack pnpm vitest run --project scripts eslint-rules` (expected red) | ✅ extend | ⬜ pending |
| 4-07-02 | 07 | 1 | DATA-03, DATA-04 | lint unit | `corepack pnpm vitest run --project scripts eslint-rules && corepack pnpm lint` | ✅ extend | ⬜ pending |
| 4-08-01 | 08 | 2 | DATA-02 | browser spike (ban + axe non-vacuity) | `corepack pnpm vitest run --project web-browser` | ❌ W0 | ⬜ pending |
| 4-08-02 | 08 | 2 | DATA-02 | CI order unit | `corepack pnpm vitest run --project scripts workflow-gate && corepack pnpm lint:workflows` | ✅ extend | ⬜ pending |
| 4-09-01 | 09 | 2 | DATA-04, DATA-05 | unit (web) | `corepack pnpm vitest run --project web rentcast/client` | ❌ W0 | ⬜ pending |
| 4-09-02 | 09 | 2 | DATA-05 | unit (web) key probe | `corepack pnpm vitest run --project web rentcast` | ❌ W0 | ⬜ pending |
| 4-10-01 | 10 | 2 | DATA-01, DATA-05 | unit (fixtures through live schemas) | `corepack pnpm vitest run --project web rentcast/schemas` | ❌ W0 | ⬜ pending |
| 4-10-02 | 10 | 2 | DATA-01 | unit (mappers) | `corepack pnpm vitest run --project web rentcast` | ❌ W0 | ⬜ pending |
| 4-11-01 | 11 | 2 | DATA-03, DATA-04 | unit (fake IDB) | `corepack pnpm vitest run --project web ledger-repo cache-repo` | ❌ W0 | ⬜ pending |
| 4-11-02 | 11 | 2 | DATA-03 | concurrency + mutation proof | `corepack pnpm vitest run --project web ledger` | ❌ W0 | ⬜ pending |
| 4-12-01 | 12 | 2 | DATA-01 | unit (fixture fetch, +400 d rebasing) | `corepack pnpm vitest run --project web fixture-fetch` | ❌ W0 | ⬜ pending |
| 4-12-02 | 12 | 2 | DATA-01 | unit (estimates/markets) | `corepack pnpm vitest run --project web fixture-fetch` | ❌ W0 | ⬜ pending |
| 4-13-01 | 13 | 3 | DATA-02, DATA-04 | unit — identical repeat spends 0 + original fetchedAt; dedupe; cost | `corepack pnpm vitest run --project web gateway.cache gateway.cost` | ❌ W0 | ⬜ pending |
| 4-13-02 | 13 | 3 | DATA-03, DATA-05 | unit — **60 calls block #41**; grants; errors; cross-instance race + mutation | `corepack pnpm vitest run --project web gateway` | ❌ W0 | ⬜ pending |
| 4-14-01 | 14 | 3 | DATA-02, DATA-04 | unit (copy) | `corepack pnpm vitest run --project web relative-time` | ❌ W0 | ⬜ pending |
| 4-14-02 | 14 | 3 | DATA-01, DATA-02, DATA-04 | component + axe | `corepack pnpm vitest run --project web-browser ProvenanceRow CostLabel NewSinceBadge` | ❌ W0 | ⬜ pending |
| 4-15-01 | 15 | 3 | DATA-02, DATA-05 | unit (copy) | `corepack pnpm vitest run --project web meter-errors` | ❌ W0 | ⬜ pending |
| 4-15-02 | 15 | 3 | DATA-02 | component + axe | `corepack pnpm vitest run --project web-browser CallMeter` | ❌ W0 | ⬜ pending |
| 4-15-03 | 15 | 3 | DATA-05 | component + axe (8 variants) | `corepack pnpm vitest run --project web-browser GatewayError` | ❌ W0 | ⬜ pending |
| 4-16-01 | 16 | 3 | DATA-03 | component + axe (variants A/B, focus) | `corepack pnpm vitest run --project web-browser CapConfirmDialog` | ❌ W0 | ⬜ pending |
| 4-16-02 | 16 | 3 | DATA-03 | component + axe (typed overage) | `corepack pnpm vitest run --project web-browser CapEditor` | ❌ W0 | ⬜ pending |
| 4-17-01 | 17 | 4 | DATA-01 | unit | `corepack pnpm vitest run --project web mode` | ❌ W0 | ⬜ pending |
| 4-17-02 | 17 | 4 | DATA-01, DATA-04 | unit — keyless all endpoints, 0 spend, mode-switch leak | `corepack pnpm vitest run --project web gateway` | ❌ W0 | ⬜ pending |
| 4-18-01 | 18 | 5 | DATA-03 | unit — cap prompt per call, cross-tab | `corepack pnpm vitest run --project web runtime` | ❌ W0 | ⬜ pending |
| 4-18-02 | 18 | 5 | DATA-04 | component (peek store) + port surface | `corepack pnpm vitest run --project web-browser stores && corepack pnpm vitest run --project web runtime` | ❌ W0 | ⬜ pending |
| 4-19-01 | 19 | 5 | DATA-03 | unit (claims, concurrency) | `corepack pnpm vitest run --project web saved-search-repo` | ❌ W0 | ⬜ pending |
| 4-19-02 | 19 | 5 | DATA-03 | unit — **5 due searches run once / 24 h**; parallel + mutation | `corepack pnpm vitest run --project web scheduler` | ❌ W0 | ⬜ pending |
| 4-20-01 | 20 | 4 | DATA-01, DATA-05 | unit (copy) | `corepack pnpm vitest run --project web copy/source` | ❌ W0 | ⬜ pending |
| 4-20-02 | 20 | 4 | DATA-05 | component + axe | `corepack pnpm vitest run --project web-browser KeyTestResult DataSourceChoice` | ❌ W0 | ⬜ pending |
| 4-20-03 | 20 | 4 | DATA-01, DATA-03 | component + axe | `corepack pnpm vitest run --project web-browser DueSearchesDialog DataStatusBar` | ❌ W0 | ⬜ pending |
| 4-21-01 | 21 | 6 | DATA-04 | lint + type | `corepack pnpm lint && corepack pnpm check` | ❌ W0 | ⬜ pending |
| 4-21-02 | 21 | 6 | DATA-04 | component — **10 re-renders spend 0** + mutants | `corepack pnpm vitest run --project web-browser rerender` | ❌ W0 | ⬜ pending |
| 4-22-01 | 22 | 6 | DATA-03 | unit | `corepack pnpm vitest run --project web alerts runtime` | ❌ W0 | ⬜ pending |
| 4-22-02 | 22 | 6 | DATA-01, DATA-02, DATA-03 | component + build + CSP | `corepack pnpm vitest run --project web-browser DataShell && corepack pnpm build:root && corepack pnpm csp:assert` | ❌ W0 | ⬜ pending |
| 4-23-01 | 23 | 7 | DATA-05 | unit | `corepack pnpm vitest run --project web key-test runtime` | ❌ W0 | ⬜ pending |
| 4-23-02 | 23 | 7 | DATA-02, DATA-03 | component + axe | `corepack pnpm vitest run --project web-browser RentCastUsageSection` | ❌ W0 | ⬜ pending |
| 4-23-03 | 23 | 7 | DATA-02, DATA-05 | build + E2E | `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert && corepack pnpm test:e2e` | ✅ | ⬜ pending |
| 4-24-01 | 24 | 8 | DATA-01, DATA-02, DATA-03 | E2E + axe (root, sub) | `corepack pnpm --filter web exec playwright test data-status` | ✅ | ✅ green |
| 4-24-02 | 24 | 8 | DATA-02, DATA-03, DATA-05 | E2E + axe (root, sub) | `corepack pnpm test:e2e` | ✅ | ✅ green |
| 4-25-01 | 25 | 9 | DATA-01..05 | doc | `grep -c "^| U" .planning/phases/04-data-layer-rentcast-gateway-budget-guard-demo-fixtures/04-HUMAN-UAT.md` (= 14) | ❌ W0 | ⬜ pending |
| 4-25-02 | 25 | 9 | DATA-01..05 | full gate | `corepack pnpm verify` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

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

- [ ] Phase 3 executed; contract map recorded (plan 04-01 Task 1 gate — Phase 4 STOPS if Phase 3 is missing)
- [ ] Dev deps at exact pins: `fake-indexeddb@6.2.5`, `@vitest/browser-playwright@4.1.11`, `vitest-browser-svelte@2.2.1`, `playwright@1.63.0`, `axe-core@4.13.0`; `@tran/core` workspace dep + `"./*"` subpath exports (04-01)
- [ ] `apps/web/src/lib/data/testing/harness.ts` (`makeDb`, `spyFetch`, `jsonResponse`, `T0`, `TEST_KEY`) (04-01)
- [ ] `apps/web/vitest.browser.config.ts` + root projects entry + spike green WITH the no-network setup file (04-08)
- [ ] `ci.yml`: Chromium install moved above `pnpm test:unit` (04-08)
- [ ] `scripts/gen-fixtures.mjs --check` in `pnpm verify` and CI quality (04-06)
- [ ] `apps/web/src/lib/data/testing/gateway-harness.ts` (`makeGateway`, `rentals()`) (04-13)
- [ ] Core test files under `packages/core/src/{budget,request,location,listings,alerts}/` (04-02..04-05)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real RentCast billing/probe behavior (U1-U14) | DATA-03, DATA-05 | Needs the owner's dedicated endpoint-restricted key and the RentCast dashboard counter; never automated, never committed | `04-HUMAN-UAT.md` (created by 04-25); non-blocking |
| CapConfirmDialog opened from a real portal spend (E2E) | DATA-03 | Phase 4 ships no portal surface that spends; covered by component tests (4-16-01, axe) and the runtime prompt test (4-18-01) | Phases 6-9 add the E2E when their Search buttons exist |
| Live-origin CORS from the deployed site | DATA-05 | No deployed origin yet (deferred hosting) | HUMAN-UAT U11 |

---

## Mutation proofs (recorded in SUMMARYs; never committed)

| Guard | Mutation | Expected red |
|-------|----------|--------------|
| Cap reservation atomicity (04-11) | count read in a separate transaction | race test: 2 reservations succeed |
| Gateway cap (04-13) | remove `ledger.reserve` | 60 fetches instead of 40 |
| Scheduler claim (04-19) | skip `repo.claim` | parallel test: 10 fetches |
| Reactive spend (04-21) | mutant view with guard disabled | spy count > 0 |
| Near threshold (04-02), probe 404 mapping (04-03), diff truncation (04-05) | constant/branch flips | respective suites red |
| Fixture drift (04-06) | edit one price in a fixture copy | `--check` exits 1 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30 s for the quick command
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution (04-25 walks the map and sets `wave_0_complete: true`)
