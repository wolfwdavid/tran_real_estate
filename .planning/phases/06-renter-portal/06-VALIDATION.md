---
phase: 6
slug: renter-portal
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-04
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11 (projects `core`, `web`, `scripts`; network blocked by `tooling/vitest/no-network.ts`; `fake-indexeddb` 6.2.5 for Dexie; `svelte/server` `render()` for component structure) + Playwright 1.63.0 with `@axe-core/playwright` 4.13.0 (projects `root` :4273 and `sub` :4274 via `scripts/serve-pages.mjs`) |
| **Config file** | `vitest.config.ts`, `packages/core/vitest.config.ts`, `apps/web/vite.config.ts`, `scripts/vitest.config.ts`, `apps/web/playwright.config.ts` |
| **Shared E2E harness** | `apps/web/tests/e2e/support/{network,rentcast-mocks,seed}.ts` + `assets/tile.png` (06-09): deny-all route registered FIRST, tile/RentCast mocks after, `serviceWorkers: 'block'`, per-host call counters, mocked key `test-key-not-real` |
| **Quick run command** | `corepack pnpm vitest run --project core packages/core/src/renter` (pure core, ~2 s) or `corepack pnpm test:unit` (all unit, < 30 s) |
| **E2E (per wave)** | `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert && corepack pnpm --filter web exec playwright test renter-` |
| **Full suite command** | `corepack pnpm verify` |
| **Estimated runtime** | quick ~2-6 s; unit < 30 s; renter E2E ~1 min warm (both bases); verify measured 391 s (6.5 min) warm in 06-22 |

---

## Sampling Rate

- **After every task commit:** `corepack pnpm test:unit` (plus `corepack pnpm lint` when imports/boundaries change, `node scripts/banned-terms.mjs` when renter copy changes)
- **After every plan wave:** `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert && corepack pnpm test:e2e`
- **Before `/gsd:verify-work`:** `corepack pnpm verify` must be green (06-22)
- **Max feedback latency:** 6 seconds for core logic (quick command); UI tasks rely on the per-task E2E command listed below

No watch-mode flags anywhere. Unit tests never call `vi.useFakeTimers()` with defaults (deadlocks fake-indexeddb); time is injected, and E2E uses `page.clock.setFixedTime`.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | RENT-01 | unit (core) | `corepack pnpm vitest run --project core packages/core/src/renter/location` | ✅ `location.test.ts` | ✅ green |
| 6-01-02 | 01 | 1 | RENT-01 | unit (core) | `corepack pnpm vitest run --project core packages/core/src/renter` (filters.test.ts) | ✅ `filters.test.ts` | ✅ green |
| 6-02-01 | 02 | 1 | RENT-06 | unit (core) | `corepack pnpm vitest run --project core packages/core/src/renter/fair-rent` | ✅ `fair-rent.test.ts` | ✅ green |
| 6-02-02 | 02 | 1 | RENT-08 | unit (core) | `corepack pnpm vitest run --project core packages/core/src/renter/affordability` | ✅ `affordability.test.ts` (core) | ✅ green |
| 6-03-01 | 03 | 1 | RENT-03 | unit (core) | `corepack pnpm vitest run --project core packages/core/src/renter/history packages/core/src/renter/sparkline packages/core/src/renter/format` | ✅ `history.test.ts`, `sparkline.test.ts`, `format.test.ts` | ✅ green |
| 6-03-02 | 03 | 1 | RENT-03 | unit (core) + guard | `corepack pnpm vitest run --project core packages/core/src/renter/contact-links packages/core/src/renter/listing-status && corepack pnpm guard` | ✅ `contact-links.test.ts`, `listing-status.test.ts` | ✅ green |
| 6-04-01 | 04 | 1 | RENT-02/03/05/08 | unit (SSR) | `corepack pnpm vitest run --project web src/lib/features/renter/RenterNav` | ✅ `RenterNav.test.ts` | ✅ green |
| 6-04-02 | 04 | 1 | RENT-02 | build oracle + mutation + E2E | `corepack pnpm vitest run --project scripts assert-csp && corepack pnpm csp:assert && corepack pnpm --filter web exec playwright test routing csp a11y routes-drift` | ✅ `scripts/assert-csp.test.ts`, `routing`/`layout`/`csp`/`a11y`/`routes-drift` specs | ✅ green |
| 6-05-01 | 05 | 1 | RENT-02/08 | lint (in-memory) | `corepack pnpm vitest run --project scripts eslint-rules && corepack pnpm lint` | ✅ `scripts/eslint-rules.test.ts` | ✅ green |
| 6-05-02 | 05 | 1 | RENT-02 | unit (copy gate, SW scope) | `node scripts/banned-terms.mjs && corepack pnpm vitest run --project scripts banned-terms service-worker-guard` | ✅ `scripts/banned-terms.test.ts`, `scripts/service-worker-guard.test.ts` | ✅ green |
| 6-06-01 | 06 | 1 | RENT-07 | unit (prompt + checker) | `corepack pnpm vitest run --project web src/lib/ai/prompts` | ✅ `ai/prompts/renter/outreach.v1.test.ts` | ✅ green |
| 6-06-02 | 06 | 1 | RENT-07 | unit (fake-indexeddb) | `corepack pnpm vitest run --project web src/lib/ai` | ✅ `artifacts.test.ts`, `draft-history.test.ts`, `panel-state.test.ts`, `settings-ai.browser.test.ts` | ✅ green |
| 6-07-01 | 07 | 2 | RENT-02 | unit (core) | `corepack pnpm vitest run --project core packages/core/src/renter/sort packages/core/src/renter/url-state` | ✅ `sort.test.ts`, `url-state.test.ts` | ✅ green |
| 6-07-02 | 07 | 2 | RENT-01/04 | unit (core) | `corepack pnpm vitest run --project core packages/core/src/renter` (labels, new-since) | ✅ `labels.test.ts`, `new-since.test.ts` | ✅ green |
| 6-08-01 | 08 | 2 | RENT-04/05 | unit (core, zod) | `corepack pnpm vitest run --project core packages/core/src/renter/records` | ✅ `records.test.ts` | ✅ green |
| 6-09-01 | 09 | 2 | RENT-01/02 | harness build + guard | `node scripts/gen-test-tile.mjs && corepack pnpm lint && corepack pnpm guard` | ✅ `assets/tile.png` + `support/{network,rentcast-mocks,seed}.ts` | ✅ green |
| 6-09-02 | 09 | 2 | RENT-01/02 | E2E (harness smoke) | `corepack pnpm --filter web exec playwright test renter-harness` | ✅ `renter-harness.spec.ts` | ✅ green |
| 6-10-01 | 10 | 2 | RENT-02 | type/lint | `corepack pnpm check && corepack pnpm lint` | n/a (svg components) | ✅ green |
| 6-10-02 | 10 | 2 | RENT-01/03 | unit (SSR) | `corepack pnpm vitest run --project web src/lib/features/shared/listings` | ✅ `shared-listings.test.ts`, `shared-listings.browser.test.ts` | ✅ green |
| 6-11-01 | 11 | 3 | RENT-01/03/06 | unit (gateway call counts) | `corepack pnpm vitest run --project web src/lib/data src/lib/features/renter/data` | ✅ `gateway.renter.test.ts`, `renter-data.test.ts` | ✅ green |
| 6-11-02 | 11 | 3 | RENT-04/05 | unit (Dexie, backup) | `corepack pnpm vitest run --project web src/lib/features/renter/storage src/lib/storage src/lib/data` | ✅ `renter-storage.test.ts`, `renter-storage.browser.test.ts`, `backup*.test.ts`, `db.test.ts` | ✅ green |
| 6-12-01 | 12 | 3 | RENT-08 | unit (SSR + import audit) | `corepack pnpm vitest run --project web src/lib/features/shared/affordability` | ✅ `affordability.test.ts`, `affordability.browser.test.ts` (shared) | ✅ green |
| 6-12-02 | 12 | 3 | RENT-08 | E2E (0 requests, axe) | `corepack pnpm --filter web exec playwright test renter-affordability` | ✅ `renter-affordability.spec.ts` | ✅ green |
| 6-13-01 | 13 | 4 | RENT-01 | unit (controller call counts) | `corepack pnpm vitest run --project web src/lib/features/renter/search` | ✅ `search-state.test.ts` | ✅ green |
| 6-13-02 | 13 | 4 | RENT-01/02 | E2E (budget, URL restore, truncation, axe) | `corepack pnpm --filter web exec playwright test renter-search` | ✅ `renter-search.spec.ts` | ✅ green |
| 6-14-01 | 14 | 4 | RENT-03/05 | unit (resolver order) | `corepack pnpm vitest run --project web src/lib/features/renter/listing` | ✅ `resolve.test.ts`, `listing-ui.test.ts`, `mappers.test.ts`, `ShortlistToggle.browser.test.ts` | ✅ green |
| 6-14-02 | 14 | 4 | RENT-03 | E2E (detail, not-found, by-id 1 call, unsafe link) | `corepack pnpm --filter web exec playwright test renter-listing` | ✅ `renter-listing.spec.ts` | ✅ green |
| 6-15-01 | 15 | 5 | RENT-05 | unit (SSR) | `corepack pnpm vitest run --project web src/lib/features/renter/shortlist` | ✅ `shortlist-ui.test.ts`, `ShortlistCard.browser.test.ts` | ✅ green |
| 6-15-02 | 15 | 5 | RENT-05 | E2E (status, notes, remove, axe) | `corepack pnpm --filter web exec playwright test renter-shortlist` | ✅ `renter-shortlist.spec.ts` | ✅ green |
| 6-16-01 | 16 | 5 | RENT-02 | unit (SSR cards) | `corepack pnpm vitest run --project web src/lib/features/renter/search` | ✅ `results-ui.test.ts`, `ResultsView.browser.test.ts` | ✅ green |
| 6-16-02 | 16 | 5 | RENT-02 | E2E (sort, pagination, tabs, axe) | `corepack pnpm --filter web exec playwright test renter-results renter-search` | ✅ `renter-results.spec.ts`, `renter-search.spec.ts` | ✅ green |
| 6-17-01 | 17 | 5 | RENT-06 | unit (SSR copy) | `corepack pnpm vitest run --project web src/lib/features/renter/fair-rent` | ✅ `fair-rent-ui.test.ts`, `FairRentCheck.browser.test.ts`, `GatewayError.browser.test.ts` | ✅ green |
| 6-17-02 | 17 | 5 | RENT-06 | E2E (Tier 1 0 calls, Tier 2 1 call, low confidence) | `corepack pnpm --filter web exec playwright test renter-fair-rent` | ✅ `renter-fair-rent.spec.ts` | ✅ green |
| 6-18-01 | 18 | 5 | RENT-07 | unit (validation) | `corepack pnpm vitest run --project web src/lib/features/renter/outreach` | ✅ `outreach-form.test.ts`, `OutreachSection.browser.test.ts` | ✅ green |
| 6-18-02 | 18 | 5 | RENT-07 | E2E (exits, mailto, block gate, Gemini) | `corepack pnpm --filter web exec playwright test renter-outreach` | ✅ `renter-outreach.spec.ts` | ✅ green |
| 6-19-01 | 19 | 6 | RENT-02 | unit (pins, clusters) | `corepack pnpm vitest run --project web src/lib/features/shared/listings/map` | ✅ `pins.test.ts`, `cluster.test.ts`, `map.browser.test.ts` | ✅ green |
| 6-19-02 | 19 | 6 | RENT-02 | build (no prerender crash, no eager chunk) | `corepack pnpm build:root` + modulepreload check in the plan | ✅ build + modulepreload check | ✅ green |
| 6-19-03 | 19 | 6 | RENT-02 | E2E (lazy chunk, tiles, Referer, CSP, axe target-size) | `corepack pnpm --filter web exec playwright test renter-map csp a11y routing` | ✅ `renter-map.spec.ts` | ✅ green |
| 6-20-01 | 20 | 6 | RENT-04 | unit (saved search, filtered new count) | `corepack pnpm vitest run --project web src/lib/features/renter/saved` | ✅ `saved-searches.test.ts` | ✅ green |
| 6-20-02 | 20 | 6 | RENT-04 | E2E (`page.clock` 24h re-run) | `corepack pnpm --filter web exec playwright test renter-saved` | ✅ `renter-saved.spec.ts` | ✅ green |
| 6-21-01 | 21 | 7 | RENT-02 | unit (bounds) | `corepack pnpm vitest run --project web src/lib/features/renter/map` | ✅ `in-bounds.test.ts` | ✅ green |
| 6-21-02 | 21 | 7 | RENT-02 | E2E (split view, linking, wheel gating) | `corepack pnpm --filter web exec playwright test renter-map-split renter-map` | ✅ `renter-map-split.spec.ts`, `renter-map.spec.ts` | ✅ green |
| 6-22-01 | 22 | 8 | RENT-01..08 | E2E (route × mode × base matrix, 3-call journey) | `corepack pnpm --filter web exec playwright test renter-demo-credible renter-journey` | ✅ `renter-demo-credible.spec.ts`, `renter-journey.spec.ts` | ✅ green |
| 6-22-02 | 22 | 8 | RENT-01..08 | full gate | `corepack pnpm verify` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Sampling continuity: every task has an automated command; no three consecutive tasks lack one.

---

## Wave 0 Requirements

Every test file is created inside the task that needs it (TDD tasks write the failing test first), so no separate Wave 0 plan is required. Cross-cutting test infrastructure is delivered early:

- [x] `packages/core/src/renter/*.test.ts` — created RED-first in 06-01, 06-02, 06-03, 06-07, 06-08
- [x] `apps/web/tests/e2e/support/network.ts`, `rentcast-mocks.ts`, `seed.ts`, `assets/tile.png` — 06-09 (before any renter E2E spec, wave 2)
- [x] `scripts/assert-csp.mjs` `EXACT['img-src']` + `EXPECTED_PAGES` + mutation tests — 06-04 (same commit as `svelte.config.js`)
- [x] `apps/web/tests/e2e/routes.ts` `RENTER_ROUTES` + routing link filter for `tel:`/`mailto:` and new external hosts — 06-04
- [x] ESLint map-library / shared-affordability / shared-boundary rules + in-memory lint tests — 06-05
- [x] Scoped renter banned-terms list + planted non-vacuity case — 06-05
- [x] Service-worker OSM exclusion case in `scripts/service-worker-guard.test.ts` — 06-05

---

## Requirement → Proof Summary

| Req | Strongest automated proof |
|-----|---------------------------|
| RENT-01 | `renter-search.spec.ts`: 1 listings call, then 5 filter/sort changes = 0 calls; URL reload = 0 calls; truncation + Narrow = exactly 1 more call, never `offset`; `filters.test.ts` server params exactly `{zip|city,state, status, limit}` |
| RENT-02 | `renter-results.spec.ts` (sort, pagination, tabs) + `renter-map.spec.ts` (lazy chunk, tiles with Referer, 0 CSP violations, planted `data:` blocked, axe incl. target-size with clusters) + `csp:assert` `img-src` exact |
| RENT-03 | `resolve.test.ts` (shortlist → cache → sample → explicit fetch order) + `renter-listing.spec.ts` (history, `tel:`/`mailto:`, not-found, 1-call by-id, no `javascript:` href) |
| RENT-04 | `saved-searches.test.ts` (filtered new count, seen reset, limit 10) + `renter-saved.spec.ts` (`page.clock` T+1h = 0 calls, T+25h = 1 call and "2 new", reload = 0) |
| RENT-05 | `renter-storage.test.ts` (unique listingId, tombstone restore, backup round trip) + `renter-shortlist.spec.ts` (status → section, notes persist, confirm rule, axe) |
| RENT-06 | `fair-rent.test.ts` (2% threshold, buckets, caveat, comps exclusion) + `renter-fair-rent.spec.ts` (Tier 1 0 calls when cached, Load = 1 markets call with `dataType=All&historyRange=24` (Phase 7 cache parity), Tier 2 = 1 AVM call, low confidence) |
| RENT-07 | `outreach.v1.test.ts` (input keys fixed, redaction, checker-clean fixture) + `renter-outreach.spec.ts` (3 exits, mailto, block gate, Gemini dialog, per-listing history) |
| RENT-08 | `affordability.test.ts` (25/30/40 math) + `renter-affordability.spec.ts` (0 requests to any host, nothing persisted, axe) + lint rule forbidding storage/data/AI imports |
| All | `renter-demo-credible.spec.ts` (4 routes × sample/live × root/sub: axe, CSP, sample chips, 375px, zero external) + `renter-journey.spec.ts` (full journey = exactly 3 RentCast calls) |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real OSM tiles render on the deployed origin with attribution and no "Access blocked" tile | RENT-02 | CI never contacts tile.openstreetmap.org (policy + determinism); the Pages origin is deferred (owner action) | After deploy (docs/DEPLOY-CHECKLIST.md), search a real ZIP with a real key, open the Map tab, confirm street tiles, attribution bottom-right, and DevTools shows tile requests with `Referer: https://tranrealestate.github.io/` |
| Real RentCast payloads for listings, by-id, markets and rent AVM parse and render | RENT-01/03/06 | Needs the owner's endpoint-restricted key (Phase 4 deferred UAT) | With a real key: one search, one detail, Load ZIP data, Get estimate; confirm 4 ledger entries and no SchemaMismatch; note whether the subject listing appears in its own comps (RESEARCH Pitfall 11) |
| Zillow `/homes/{address}_rb/` link still resolves | RENT-03 | Third-party URL pattern, undocumented | Click **Search Zillow** on a live listing; if it 404s, switch to `https://www.zillow.com/homes/{enc}` |

*All other phase behaviors have automated verification.* The owner runbook for these rows, plus real-device, screen-reader, saved-search-over-a-real-day and real-AI-key checks, is `06-HUMAN-UAT.md` (R1-R12, `blocking: false`).

---

## Gate results (06-22)

| Gate | Result |
|------|--------|
| `corepack pnpm verify` | exit 0 in **391 s (6.5 min)** warm, on the 06-22 tree (after 0f111c9, ec49c9a, 3d1f94d) |
| Unit (`test:unit`, incl. `web-browser`) | 166 files, **3180 tests** passed |
| Builds + `csp:assert` | root and sub, **17 HTML files per base** (16 pages + `404.html`) |
| E2E (`test:e2e`, both bases) | **774 passed**, 2 skipped (pre-existing `settings-backup` migration-line skip), 0 flaky |
| Renter E2E (`renter-*` specs) | **154** (77 per base), including `renter-demo-credible` (8 cells x 2 bases) and `renter-journey` (1 x 2 bases) |
| Guards | `guard` (1050 files), `fixtures:check` (6 files), gitleaks canary + history (574 commits, no leaks), actionlint |

ROADMAP criterion 5, as proven: every renter route works keyless on sample data with badged sample
blocks and zero third-party requests; a full live journey (mocked key) spends exactly 3 RentCast
calls (1 listings, 1 markets, 1 rent AVM; filters, sort, map, detail, outreach, shortlist, notes,
saved search and affordability = 0) and the usage meter reads 3 of 50; every AI draft goes
through the Fair Housing checker (06-06 `outreach.v1.test.ts` checker-clean fixture, 06-18
`renter-outreach.spec.ts` Must fix gate); axe (WCAG 2.2 AA tags) is clean on all four renter
routes in sample and live mode on both bases, at 1280 px and at 375 px, with no horizontal scroll.

## Mutation proofs (recorded in SUMMARYs; never committed)

| Plan | Mutations | Result |
|------|-----------|--------|
| 06-01 | filters.ts: truncation edge, wide early-return, 7-day boundary, `4+`, removedDate guard, type sort | 6/6 killed |
| 06-02 | fair-rent thresholds, caps, address matching (8); affordability ratios, floors, rounding, /12 (11) | 19/19 killed |
| 06-04 / 06-05 | CSP `img-src` oracle; ESLint boundaries (5 ways); banned-terms scoping | all killed |
| 06-07 | sort + url-state (16), labels + new-since (18 after 4 boundary tests added) | 34/34 behavioural killed (1 cast-only equivalent) |
| 06-08 / 06-11 / 06-13 / 06-14 / 06-15 / 06-17 | records, storage/backup, search controller, resolver, shortlist focus, fair-rent UI | tables in each SUMMARY, all killed |
| 06-09 | deny-all registered after the tile route | tile test fails |
| 06-19 | Leaflet `data:` tile cancel and five more | 6/6 killed |
| 06-20 | no `markSeen`; no limit check | both killed |
| 06-21 | `rowsInBounds` (7 unit) + 7 split-view E2E mutants | all killed |
| 06-22 | resolver ignores the search cache (`peekListingById` result dropped) | `renter-journey` fails ("Listing not found") |
| 06-22 | price-history scroll wrapper without `relative` (the pre-fix state) | `renter-demo-credible` listing cells fail at 375 px (scrollWidth 376) |
| 06-22 | mapper / adapter without `removedDate` (the pre-fix state) | `mappers.test.ts` + `listing-ui.test.ts` red |

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (each created in its owning task; harness in wave 2 before UI waves)
- [x] No watch-mode flags
- [x] Feedback latency < 6s for core logic (quick command)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-05 (06-22: every row green, `corepack pnpm verify` exit 0 in 391 s; owner-gated live checks in `06-HUMAN-UAT.md`, non-blocking)
