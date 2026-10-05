---
phase: 6
slug: renter-portal
status: planned
nyquist_compliant: true
wave_0_complete: false
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
| **Estimated runtime** | quick ~2-6 s; unit < 30 s; renter E2E ~3-5 min warm (both bases); verify ~3-4 min warm |

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
| 6-01-01 | 01 | 1 | RENT-01 | unit (core) | `corepack pnpm vitest run --project core packages/core/src/renter/location` | ❌ W0 (created in task) | ⬜ pending |
| 6-01-02 | 01 | 1 | RENT-01 | unit (core) | `corepack pnpm vitest run --project core packages/core/src/renter` (filters.test.ts) | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 1 | RENT-06 | unit (core) | `corepack pnpm vitest run --project core packages/core/src/renter/fair-rent` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 1 | RENT-08 | unit (core) | `corepack pnpm vitest run --project core packages/core/src/renter/affordability` | ❌ W0 | ⬜ pending |
| 6-03-01 | 03 | 1 | RENT-03 | unit (core) | `corepack pnpm vitest run --project core packages/core/src/renter/history packages/core/src/renter/sparkline packages/core/src/renter/format` | ❌ W0 | ⬜ pending |
| 6-03-02 | 03 | 1 | RENT-03 | unit (core) + guard | `corepack pnpm vitest run --project core packages/core/src/renter/contact-links packages/core/src/renter/listing-status && corepack pnpm guard` | ❌ W0 | ⬜ pending |
| 6-04-01 | 04 | 1 | RENT-02/03/05/08 | unit (SSR) | `corepack pnpm vitest run --project web src/lib/features/renter/RenterNav` | ❌ W0 | ⬜ pending |
| 6-04-02 | 04 | 1 | RENT-02 | build oracle + mutation + E2E | `corepack pnpm vitest run --project scripts assert-csp && corepack pnpm csp:assert && corepack pnpm --filter web exec playwright test routing csp a11y routes-drift` | ⚠ extend | ⬜ pending |
| 6-05-01 | 05 | 1 | RENT-02/08 | lint (in-memory) | `corepack pnpm vitest run --project scripts eslint-rules && corepack pnpm lint` | ⚠ extend | ⬜ pending |
| 6-05-02 | 05 | 1 | RENT-02 | unit (copy gate, SW scope) | `node scripts/banned-terms.mjs && corepack pnpm vitest run --project scripts banned-terms service-worker-guard` | ⚠ extend | ⬜ pending |
| 6-06-01 | 06 | 1 | RENT-07 | unit (prompt + checker) | `corepack pnpm vitest run --project web src/lib/ai/prompts` | ❌ W0 | ⬜ pending |
| 6-06-02 | 06 | 1 | RENT-07 | unit (fake-indexeddb) | `corepack pnpm vitest run --project web src/lib/ai` | ⚠ extend | ⬜ pending |
| 6-07-01 | 07 | 2 | RENT-02 | unit (core) | `corepack pnpm vitest run --project core packages/core/src/renter/sort packages/core/src/renter/url-state` | ❌ W0 | ⬜ pending |
| 6-07-02 | 07 | 2 | RENT-01/04 | unit (core) | `corepack pnpm vitest run --project core packages/core/src/renter` (labels, new-since) | ❌ W0 | ⬜ pending |
| 6-08-01 | 08 | 2 | RENT-04/05 | unit (core, zod) | `corepack pnpm vitest run --project core packages/core/src/renter/records` | ❌ W0 | ⬜ pending |
| 6-09-01 | 09 | 2 | RENT-01/02 | harness build + guard | `node scripts/gen-test-tile.mjs && corepack pnpm lint && corepack pnpm guard` | ❌ W0 | ⬜ pending |
| 6-09-02 | 09 | 2 | RENT-01/02 | E2E (harness smoke) | `corepack pnpm --filter web exec playwright test renter-harness` | ❌ W0 | ⬜ pending |
| 6-10-01 | 10 | 2 | RENT-02 | type/lint | `corepack pnpm check && corepack pnpm lint` | n/a (svg components) | ⬜ pending |
| 6-10-02 | 10 | 2 | RENT-01/03 | unit (SSR) | `corepack pnpm vitest run --project web src/lib/features/shared/listings` | ❌ W0 | ⬜ pending |
| 6-11-01 | 11 | 3 | RENT-01/03/06 | unit (gateway call counts) | `corepack pnpm vitest run --project web src/lib/data src/lib/features/renter/data` | ❌ W0 | ⬜ pending |
| 6-11-02 | 11 | 3 | RENT-04/05 | unit (Dexie, backup) | `corepack pnpm vitest run --project web src/lib/features/renter/storage src/lib/storage src/lib/data` | ❌ W0 | ⬜ pending |
| 6-12-01 | 12 | 3 | RENT-08 | unit (SSR + import audit) | `corepack pnpm vitest run --project web src/lib/features/shared/affordability` | ❌ W0 | ⬜ pending |
| 6-12-02 | 12 | 3 | RENT-08 | E2E (0 requests, axe) | `corepack pnpm --filter web exec playwright test renter-affordability` | ❌ W0 | ⬜ pending |
| 6-13-01 | 13 | 4 | RENT-01 | unit (controller call counts) | `corepack pnpm vitest run --project web src/lib/features/renter/search` | ❌ W0 | ⬜ pending |
| 6-13-02 | 13 | 4 | RENT-01/02 | E2E (budget, URL restore, truncation, axe) | `corepack pnpm --filter web exec playwright test renter-search` | ❌ W0 | ⬜ pending |
| 6-14-01 | 14 | 4 | RENT-03/05 | unit (resolver order) | `corepack pnpm vitest run --project web src/lib/features/renter/listing` | ❌ W0 | ⬜ pending |
| 6-14-02 | 14 | 4 | RENT-03 | E2E (detail, not-found, by-id 1 call, unsafe link) | `corepack pnpm --filter web exec playwright test renter-listing` | ❌ W0 | ⬜ pending |
| 6-15-01 | 15 | 5 | RENT-05 | unit (SSR) | `corepack pnpm vitest run --project web src/lib/features/renter/shortlist` | ❌ W0 | ⬜ pending |
| 6-15-02 | 15 | 5 | RENT-05 | E2E (status, notes, remove, axe) | `corepack pnpm --filter web exec playwright test renter-shortlist` | ❌ W0 | ⬜ pending |
| 6-16-01 | 16 | 5 | RENT-02 | unit (SSR cards) | `corepack pnpm vitest run --project web src/lib/features/renter/search` | ❌ W0 | ⬜ pending |
| 6-16-02 | 16 | 5 | RENT-02 | E2E (sort, pagination, tabs, axe) | `corepack pnpm --filter web exec playwright test renter-results renter-search` | ❌ W0 | ⬜ pending |
| 6-17-01 | 17 | 5 | RENT-06 | unit (SSR copy) | `corepack pnpm vitest run --project web src/lib/features/renter/fair-rent` | ❌ W0 | ⬜ pending |
| 6-17-02 | 17 | 5 | RENT-06 | E2E (Tier 1 0 calls, Tier 2 1 call, low confidence) | `corepack pnpm --filter web exec playwright test renter-fair-rent` | ❌ W0 | ⬜ pending |
| 6-18-01 | 18 | 5 | RENT-07 | unit (validation) | `corepack pnpm vitest run --project web src/lib/features/renter/outreach` | ❌ W0 | ⬜ pending |
| 6-18-02 | 18 | 5 | RENT-07 | E2E (exits, mailto, block gate, Gemini) | `corepack pnpm --filter web exec playwright test renter-outreach` | ❌ W0 | ⬜ pending |
| 6-19-01 | 19 | 6 | RENT-02 | unit (pins, clusters) | `corepack pnpm vitest run --project web src/lib/features/shared/listings/map` | ❌ W0 | ⬜ pending |
| 6-19-02 | 19 | 6 | RENT-02 | build (no prerender crash, no eager chunk) | `corepack pnpm build:root` + modulepreload check in the plan | n/a | ⬜ pending |
| 6-19-03 | 19 | 6 | RENT-02 | E2E (lazy chunk, tiles, Referer, CSP, axe target-size) | `corepack pnpm --filter web exec playwright test renter-map csp a11y routing` | ❌ W0 | ⬜ pending |
| 6-20-01 | 20 | 6 | RENT-04 | unit (saved search, filtered new count) | `corepack pnpm vitest run --project web src/lib/features/renter/saved` | ❌ W0 | ⬜ pending |
| 6-20-02 | 20 | 6 | RENT-04 | E2E (`page.clock` 24h re-run) | `corepack pnpm --filter web exec playwright test renter-saved` | ❌ W0 | ⬜ pending |
| 6-21-01 | 21 | 7 | RENT-02 | unit (bounds) | `corepack pnpm vitest run --project web src/lib/features/renter/map` | ❌ W0 | ⬜ pending |
| 6-21-02 | 21 | 7 | RENT-02 | E2E (split view, linking, wheel gating) | `corepack pnpm --filter web exec playwright test renter-map-split renter-map` | ❌ W0 | ⬜ pending |
| 6-22-01 | 22 | 8 | RENT-01..08 | E2E (route × mode × base matrix, 3-call journey) | `corepack pnpm --filter web exec playwright test renter-demo-credible renter-journey` | ❌ W0 | ⬜ pending |
| 6-22-02 | 22 | 8 | RENT-01..08 | full gate | `corepack pnpm verify` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Sampling continuity: every task has an automated command; no three consecutive tasks lack one.

---

## Wave 0 Requirements

Every test file is created inside the task that needs it (TDD tasks write the failing test first), so no separate Wave 0 plan is required. Cross-cutting test infrastructure is delivered early:

- [ ] `packages/core/src/renter/*.test.ts` — created RED-first in 06-01, 06-02, 06-03, 06-07, 06-08
- [ ] `apps/web/tests/e2e/support/network.ts`, `rentcast-mocks.ts`, `seed.ts`, `assets/tile.png` — 06-09 (before any renter E2E spec, wave 2)
- [ ] `scripts/assert-csp.mjs` `EXACT['img-src']` + `EXPECTED_PAGES` + mutation tests — 06-04 (same commit as `svelte.config.js`)
- [ ] `apps/web/tests/e2e/routes.ts` `RENTER_ROUTES` + routing link filter for `tel:`/`mailto:` and new external hosts — 06-04
- [ ] ESLint map-library / shared-affordability / shared-boundary rules + in-memory lint tests — 06-05
- [ ] Scoped renter banned-terms list + planted non-vacuity case — 06-05
- [ ] Service-worker OSM exclusion case in `scripts/service-worker-guard.test.ts` — 06-05

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

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (each created in its owning task; harness in wave 2 before UI waves)
- [x] No watch-mode flags
- [x] Feedback latency < 6s for core logic (quick command)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending execution (06-22 marks rows green and sets `status: complete`)
