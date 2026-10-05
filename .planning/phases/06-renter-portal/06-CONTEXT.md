# Phase 6: Renter Portal - Context

**Gathered:** 2026-10-04
**Status:** Ready for planning

<domain>
## Phase Boundary

The Renter portal under `/renter/`: location-required rental search, sortable list + map, listing detail, saved searches with "N new since last visit", shortlist with status tracking, fair-rent check (zip median + optional estimate), AI outreach draft, and a zero-call affordability calculator. Requirements RENT-01..08.

It consumes, never re-implements: the Phase 4 gateway/fixtures/alerts scheduler, Phase 5 `GenerationPanel` + Fair Housing checker, Phase 3 storage/backup, Phase 2 brand.

</domain>

<decisions>
## Implementation Decisions

The owner chose fully autonomous mode on 2026-10-04. Recommended defaults adopted.

### Search & results
- **Location is required** (city+state or 5-digit zip; normalized by Phase 4's location normalizer). Filters: price min/max, bedrooms (studio..4+), property type (RentCast enum), "listed within N days" (7/14/30/60), status Active. No pet/amenity filters (RentCast lacks the data; the AI outreach asks instead).
- **Fetch wide, filter local:** one gateway call per distinct location+core filter; secondary filters/sorting run client-side at zero cost. A 500-row truncation warning shows when the API cap is hit.
- **Results:** sortable list (price, beds, sqft, days on market, newest) and a **Leaflet + OpenStreetMap map** with simple marker clustering; list↔map hover/selection linked. Map tiles require adding the OSM tile host to CSP `img-src` (and attribution per the OSM tile usage policy — verify during planning; use `https://tile.openstreetmap.org` and respect the policy's "no heavy use" guidance by lazy-loading the map only on the map tab).
- **Listing detail** (`/renter/listing/?id=` via query param — no `[param]` routes under prerender): address, price, beds/baths/sqft, year built, HOA, days on market, dated price/event history (table + small sparkline), listing agent/office name/phone/email/website (`tel:`/`mailto:` links), provenance chip, "search this address" outbound links (Google/Zillow/Apartments.com generic URLs — no scraping).
- **Cards** use illustrated property-type marks (Phase 2) — no photos exist in RentCast data.

### Saved searches, shortlist & alerts
- **Saved search** stores the normalized query + `lastRunAt` + snapshot ids; on app open, Phase 4's scheduler re-runs due searches (≤1/24h each, sequential, confirm if >3) and shows "N new since last visit" per search, with new items badged in results.
- **Shortlist** (favorites) with status: Saved → Contacted → Toured → Applied → Signed, plus notes; a compact shortlist board on `/renter/shortlist/`. Registered in backup.

### Fair-rent check & affordability
- **Tier 1 (0 calls):** asking rent vs zip median for that bedroom count from the shared market-stats cache (Phase 4), shown as "X% above/below zip median (as of date)" with sample-size caveat.
- **Tier 2 (1 call, cost shown first):** RentCast rent estimate with range and comparables table; low-confidence badge when comps < 3. Copy says "estimate", never "appraisal"/"value".
- **Affordability calculator** (`/renter/affordability/`): income, debts, savings → 30%/rule-of-thumb band + "what rent fits" slider; zero API calls; labeled as a general guideline, not financial advice.

### AI outreach
- Prompt `renter/outreach.v1`: inputs = listing facts + user's move-in date, occupants count (as a number only), pets (y/n + type), questions; asks about availability, pets, fees, lease terms. Output through `GenerationPanel` (copy / `mailto:` to listing agent / mark sent) gated by the Fair Housing checker; PII minimization applied; Gemini warning applies.

### Demo credibility
- Every renter route works keyless on Phase 4 fixtures with "Sample data" chips; E2E uses fixtures + `page.route()` mocks; axe passes on all renter routes (keyless and with a mocked key state).

### Claude's Discretion
- Exact route slugs under `/renter/`; map library wiring details (dynamic import to keep marketing bundle clean); clustering threshold; sort defaults.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 4: `gateway.search/rentEstimate/marketStats`, `CallMeter`, `CostLabel`, `CapConfirmDialog`, `ProvenanceChip`, fixtures, scheduler, `core.diffSnapshots`.
- Phase 5: `GenerationPanel`, prompt registry, Fair Housing checker.
- Phase 3: Dexie repos, backup registry; Phase 2: tokens, layout, header portal nav.

### Established Patterns
- No `[param]` routes (static prerender) — use query params for detail pages.
- ESLint import boundaries: `lib/features/renter` may import `shared`, `data`, `ai`, `storage`, never `investor`/`agent`.
- Portal routes live in `(app)`; `(marketing)` must not import Dexie/Leaflet/LLM code.

### Integration Points
- CSP `img-src` gains the OSM tile host (svelte.config.js + Phase 1 CSP contract test list).
- Scheduler hooks for saved searches; backup registry for shortlist + saved searches.

</code_context>

<specifics>
## Specific Ideas

- "Availability" is reframed as "listed within N days" + Active + a "likely still available" heuristic (recent lastSeen). Copy explains this honestly.

</specifics>

<deferred>
## Deferred Ideas

- Price-drop / likely-rented badges (RENT-V2-01), email digests (RENT-V2-02).
- Cut line order if overrun: map clustering polish → RENT-05 statuses (keep plain shortlist) → Tier 2 rent estimate.

</deferred>
