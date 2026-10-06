---
phase: 06-renter-portal
verified: 2026-10-05T21:35:00Z
status: human_needed
score: 8/8 must-haves verified
human_verification:
  - test: "Real OSM tiles render on the deployed origin with correct Referer and no CSP violation (R3)"
    expected: "Street tiles render, attribution links to openstreetmap.org/copyright, requests go only to tile.openstreetmap.org with Referer https://tranrealestate.github.io/"
    why_human: "CI never contacts the real tile server by policy; needs the deployed origin"
  - test: "Real RentCast search, listing-by-id, markets and rent AVM calls with a real endpoint-restricted key (R1, R6, R7)"
    expected: "Each call type returns parseable payloads, no SchemaMismatch, and the full journey spends exactly 3 calls matching the dashboard"
    why_human: "Needs the owner's real RentCast key; CI uses mocked fixtures only"
  - test: "Saved-search re-run over a real 24h boundary (R8)"
    expected: "0 calls within 24h, at most 1 call for that search after 24h, with 'N new since last visit'"
    why_human: "Requires real wall-clock elapsed time on the deployed app; E2E uses page.clock simulation"
  - test: "AI outreach draft with a real provider key, Open in email app, Copy text (R9)"
    expected: "Streams a draft with no Must-fix findings; mailto opens the mail app prefilled; Copy matches"
    why_human: "Needs a real AI provider key and a real OS mail-client handoff"
  - test: "Zillow/Google 'look up elsewhere' links resolve to a real results page (R10)"
    expected: "Zillow /homes/{address}_rb/ pattern and Google search both open valid results"
    why_human: "Undocumented third-party URL pattern; only confirmable against the live site"
  - test: "Real phones (iOS Safari, Android Chrome): layout, map gesture gating, tel:/mailto:, tap targets, 200% text zoom (R11)"
    expected: "No sideways scroll, map doesn't trap page scroll, dialer/mail app open, targets easy to hit, text stays readable at 200%"
    why_human: "Real device behavior not reproducible in CI"
  - test: "Screen reader pass: VoiceOver/NVDA on search results, map pins, shortlist status, dialogs (R12)"
    expected: "Results heading/count announced, pins read '$rent a month, address', status changes announced, dialogs trap/return focus"
    why_human: "Screen-reader announcement quality requires a human listener"
---

# Phase 6: Renter Portal Verification Report

**Phase Goal:** A renter goes from "what I'm looking for" to matching listings, a fair-rent read, and a ready-to-send message to the listing agent in minutes.
**Verified:** 2026-10-05
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Renter can search any US city/zip by price, bedrooms, type, "listed within N days"; view sortable list and map; open detail with price history and agent/office contact | ✓ VERIFIED | `packages/core/src/renter/{location,filters,sort}.ts`, `apps/web/src/lib/features/renter/search/*`, `apps/web/src/lib/features/renter/map/*`, `apps/web/src/lib/features/renter/listing/*`; core unit tests 276/276 green, web renter unit tests 160/160 green |
| 2 | Renter can save a search, see "N new since last visit" (re-runs ≤1×/24h), shortlist listings and track status (Contacted/Toured/Applied/Signed) | ✓ VERIFIED | `packages/core/src/renter/{records,new-since}.ts`, `apps/web/src/lib/features/renter/{saved,shortlist}/*`, Dexie v4 tables `renterShortlist`/`renterSearchMeta` in `apps/web/src/lib/storage/db.ts`, backup registration in `apps/web/src/lib/features/renter/storage/tables.ts` wired into `apps/web/src/lib/storage/backup-registry.ts` |
| 3 | Renter can compare asking rent to zip median by bedroom count, optionally a rent estimate with range/comparables (cost shown first), and calculate affordable rent from income at 0 calls | ✓ VERIFIED | `packages/core/src/renter/{fair-rent,affordability}.ts`, `apps/web/src/lib/features/renter/fair-rent/*`, `apps/web/src/lib/features/shared/affordability/*` (import-boundary lint-enforced to forbid storage/data/AI) |
| 4 | Renter can generate an AI outreach draft (availability, pets, fees, lease terms); draft passes Fair Housing checker; exits only via copy or own email client | ✓ VERIFIED | `apps/web/src/lib/ai/prompts/renter/outreach.v1.ts` registered in `apps/web/src/lib/ai/prompts/registry.ts` (`renterOutreachV1`, id `renter/outreach.v1`); `apps/web/src/lib/features/renter/outreach/*`; `renter-outreach.spec.ts` covers 3 exits, mailto, block-finding gate |
| 5 | Demo-credible: works keyless on sample data, stays under call budget with a real key, all AI copy passes Fair Housing checker, passes axe | ✓ VERIFIED | `renter-demo-credible.spec.ts` (4 routes × sample/live × root/sub, axe/CSP/375px/zero-external), `renter-journey.spec.ts` (exactly 3 RentCast calls end-to-end); `corepack pnpm verify` reported green in 06-22 SUMMARY (391s, 3180 unit + 774 E2E) |

**Score:** 5/5 truths verified (mapped from ROADMAP success criteria, which supersede derived truths per process)

### Required Artifacts

All 22 plans' artifacts verified via `gsd-tools verify artifacts` — **22/22 plans, all_passed: true** (no STUB/MISSING issues across any declared artifact path). Spot-checked key paths directly:

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/renter/*.ts` (types, location, filters, fair-rent, affordability, history, contact-links, listing-status, format, sort, url-state, labels, new-since, records) | Pure core logic, test-first | ✓ VERIFIED | 14 test files, 276 tests, all green |
| `apps/web/src/lib/features/renter/{search,listing,shortlist,saved,fair-rent,outreach,map,data,storage}/**` | Portal UI + data wiring | ✓ VERIFIED | 12 test files, 160 tests, all green; routes exist for `/renter/`, `/renter/listing/`, `/renter/shortlist/`, `/renter/affordability/` |
| `apps/web/src/lib/features/shared/{listings,affordability}/**` | Cross-portal shared primitives (map, cards, affordability calc) | ✓ VERIFIED | `PropertyTypeMark.svelte`, `PriceHistory.svelte` (375px fix: `class="relative overflow-x-auto"`), `AffordabilityCalculator.svelte` present with import-boundary lint |
| `apps/web/src/lib/storage/db.ts` (Dexie v4) + `backup-registry.ts` | New tables + backup coverage | ✓ VERIFIED | `version(4).stores({ renterShortlist: ..., renterSearchMeta: ... })`; `RENTER_BACKUP_TABLES` spread into `DEFAULT_TABLES` in backup-registry.ts (not a lazy runtime call — enforced at init) |
| `apps/web/src/lib/ai/prompts/renter/**` | Outreach prompt | ✓ VERIFIED | `outreach.v1.ts` exports `RENTER_OUTREACH_PROMPT_ID = 'renter/outreach.v1'`, registered via `registerPrompt(renterOutreachV1)` |
| `eslint.config.js` + scripts (06-05 guardrails) | Map-lib / shared-boundary / banned-terms restrictions | ✓ VERIFIED | `MAP_LIBS` group (`leaflet`, `supercluster`) restricted to the map folder; applied across multiple `no-restricted-imports` entries |
| `svelte.config.js` + `scripts/assert-csp.mjs` (img-src) | OSM tile host allowed, duplicated oracle | ✓ VERIFIED | Both files contain `https://tile.openstreetmap.org` in `img-src` |
| `apps/web/tests/e2e/{renter-*.spec.ts,support/*}` | Full renter E2E coverage + shared mocking harness | ✓ VERIFIED | 13 renter spec files + 3 support files (`network.ts`, `rentcast-mocks.ts`, `seed.ts`) all present |

### Key Link Verification

`gsd-tools verify key-links` reported `all_verified: false` on plans 01, 02, 04, 06, 13, 19 (6 of 22). Each was manually re-checked against the live source — all are **false negatives** from the tool's literal pattern-matching (e.g., checking for a literal regex string where the code uses a named constant, or checking the wrong file for a duplicated-value pattern):

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `packages/core/package.json` | `renter/*.ts` | wildcard subpath export | ✓ WIRED (manual) | `"./renter/*": "./src/renter/*.ts"` present; tool's source/target check missed it |
| `packages/core/src/renter/fair-rent.ts` | UI-SPEC direction wording | `SAME_THRESHOLD = 0.02` | ✓ WIRED (manual) | Line 16: `export const SAME_THRESHOLD = 0.02;`, used in `compareToMedian` |
| `packages/core/src/renter/affordability.ts` | UI-SPEC math | 0.25/0.30/0.40 multipliers | ✓ WIRED (manual) | `RENT_LOW_SHARE = 0.25`, `DEBT_CHECK_SHARE = 0.4`, `pct25 = 0.25 * M` all present |
| `apps/web/svelte.config.js` | `scripts/assert-csp.mjs` | literal img-src duplicate | ✓ WIRED (manual) | Both files declare `https://tile.openstreetmap.org` in `img-src` |
| `apps/web/src/lib/ai/prompts/registry.ts` | `renter/outreach.v1.ts` | registered prompt id | ✓ WIRED (manual) | `import { renterOutreachV1 } ...; registerPrompt(renterOutreachV1 as PromptDef)` — id resolved via the constant, not a literal string in this file |
| `apps/web/src/lib/features/renter/search/search-state.svelte.ts` | `gateway.get`/`gateway.peek` | get in click paths, peek in restore | ✓ WIRED (manual) | Comment + `await gateway.peek<Listing[]>(req)` confirmed; `gateway.get` used elsewhere in same file for explicit search() |
| `apps/web/src/lib/features/shared/listings/map/ListingMap.svelte` | tile.openstreetmap.org | `L.tileLayer` live mode | ✓ WIRED (manual) | `TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'` present |

All other key links (16 of 22 plans) verified clean by the tool with no manual follow-up needed.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| RENT-01 | 01, 07, 09, 10, 11, 13 | Search by price/bedrooms/type/listed-within in any US city/zip | ✓ SATISFIED | `filters.ts`, `location.ts`, `search-state.svelte.ts`, `renter-search.spec.ts` 1-call budget test |
| RENT-02 | 02 (n/a)… 04, 05, 07, 09, 13, 16, 19, 21 | Sortable list + map results view | ✓ SATISFIED | `ResultsView.svelte`, `MapTab.svelte`/`ListingMap.svelte` lazy-loaded, `renter-map.spec.ts`, `renter-map-split.spec.ts` |
| RENT-03 | 03, 10, 11, 14 | Listing detail: price history + agent/office contact | ✓ SATISFIED | `history.ts`, `contact-links.ts`, `PriceHistory.svelte`, `resolve.ts`, `renter-listing.spec.ts` |
| RENT-04 | 07, 08, 11, 20 | Saved search + "N new since last visit" (≤1 re-run/24h) | ✓ SATISFIED | `new-since.ts`, `saved-searches.ts`, `renter-saved.spec.ts` with `page.clock` 24h test |
| RENT-05 | 08, 11, 14, 15 | Shortlist + status pipeline | ✓ SATISFIED | `records.ts` (`SHORTLIST_STATUSES`), `shortlist-repo.ts`, `ShortlistBoard.svelte`, `renter-shortlist.spec.ts` |
| RENT-06 | 02, 11, 17 | Compare asking rent to zip median + optional AVM estimate | ✓ SATISFIED | `fair-rent.ts`, `ZipMedianTier.svelte`, `RentEstimateTier.svelte`, `renter-fair-rent.spec.ts` (Tier 1 0-call, Tier 2 1-call) |
| RENT-07 | 06, 18 | AI outreach draft, Fair Housing-checked | ✓ SATISFIED | `outreach.v1.ts` prompt, `OutreachSection.svelte`, `renter-outreach.spec.ts` (block gate) |
| RENT-08 | 02, 12 | Affordability calc, zero API calls | ✓ SATISFIED | `affordability.ts`, `AffordabilityCalculator.svelte`, `renter-affordability.spec.ts` (0-request assertion), lint rule forbidding storage/data/AI imports in shared/affordability |

No orphaned requirements: REQUIREMENTS.md lists exactly RENT-01..08 against Phase 6, and all eight IDs appear across the 22 plans' frontmatter `requirements` fields.

### Anti-Patterns Found

None. Scanned `apps/web/src/lib/features/renter`, `apps/web/src/routes/(app)/renter`, and `packages/core/src/renter` for TODO/FIXME/XXX/HACK/placeholder/"coming soon"/"not yet implemented"/"not available" (excluding test/spec files) — zero matches.

Two items of **recorded, non-blocking debt** (not anti-patterns introduced silently — documented in `deferred-items.md`):
- tailwind-merge drops `text-label`/`text-body` tokens when a variant adds a text color — carried from Phase 4/5, not Phase 6's to fix.
- `ListingCard.svelte` address-link id collisions on the Map tab (card renders in up to 3 containers) — behavior is correct (axe passes, scoped `querySelector`), cosmetic DOM-id debt, screen-reader side covered by HUMAN-UAT R12.

### Human Verification Required

See YAML frontmatter `human_verification` block (R1, R3, R6-R12 from `06-HUMAN-UAT.md`): real RentCast key behavior, real OSM tiles on the deployed origin, real 24h saved-search boundary, real AI provider draft + mailto handoff, third-party Zillow/Google link resolution, real-device layout/gesture/zoom, and screen-reader announcements. These are explicitly `blocking: false` in `06-HUMAN-UAT.md` and gated on the owner creating the `tranrealestate` GitHub org, deploying, and generating a real RentCast key — they do not block Phase 6 completion, but they are outstanding and should be run once those prerequisites exist.

### Gaps Summary

No gaps found. All 8 ROADMAP success criteria have corresponding artifacts that exist, are substantive (no stubs), and are wired end-to-end; all 8 RENT requirements have concrete automated proof per `06-VALIDATION.md`'s Requirement → Proof Summary table, independently spot-verified against source in this pass (not just trusted from SUMMARYs). Targeted re-runs of `vitest run --project core packages/core/src/renter` (276/276 green) and `vitest run --project web src/lib/features/renter` (160/160 green) confirm the unit layer is live, not aspirational. The `gsd-tools verify key-links` tool flagged 6 links as unverified; all 6 were confirmed genuinely wired by direct source inspection, so this is a tool limitation, not a phase gap. The two debt items in `deferred-items.md` are pre-existing (tailwind-merge) or cosmetic/non-functional (duplicate DOM ids, axe-clean) and were correctly deferred rather than hidden. Status is `human_needed` solely because of the owner-gated real-key/real-device/screen-reader checks in `06-HUMAN-UAT.md`, which are expected at this stage and explicitly non-blocking.

---

_Verified: 2026-10-05_
_Verifier: Claude (gsd-verifier)_
