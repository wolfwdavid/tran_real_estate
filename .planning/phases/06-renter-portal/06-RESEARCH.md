# Phase 6: Renter Portal - Research

**Researched:** 2026-10-04
**Domain:** SvelteKit 2 / Svelte 5 static portal over a budgeted BYOK API: location-required rental search (fetch wide, filter local), Leaflet + OSM map under a strict meta CSP, query-param detail routes under full prerender, Dexie saved searches/shortlist with snapshot diffs, two-tier fair-rent check, AI outreach through the Phase 5 GenerationPanel, a zero-call affordability calculator, and a no-network E2E/axe harness
**Confidence:** HIGH for the map/CSP/routing mechanics (verified empirically in a throwaway worktree of this repo, then removed); HIGH for RentCast parameter shapes (official docs); MEDIUM for upstream contracts (Phases 3/4/5 are planned but not executed, so this plan targets their CONTEXT/UI-SPEC contracts); LOW items are flagged inline.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

The owner chose fully autonomous mode on 2026-10-04. Recommended defaults adopted.

#### Search & results
- **Location is required** (city+state or 5-digit zip; normalized by Phase 4's location normalizer). Filters: price min/max, bedrooms (studio..4+), property type (RentCast enum), "listed within N days" (7/14/30/60), status Active. No pet/amenity filters (RentCast lacks the data; the AI outreach asks instead).
- **Fetch wide, filter local:** one gateway call per distinct location+core filter; secondary filters/sorting run client-side at zero cost. A 500-row truncation warning shows when the API cap is hit.
- **Results:** sortable list (price, beds, sqft, days on market, newest) and a **Leaflet + OpenStreetMap map** with simple marker clustering; list↔map hover/selection linked. Map tiles require adding the OSM tile host to CSP `img-src` (and attribution per the OSM tile usage policy — verify during planning; use `https://tile.openstreetmap.org` and respect the policy's "no heavy use" guidance by lazy-loading the map only on the map tab).
- **Listing detail** (`/renter/listing/?id=` via query param — no `[param]` routes under prerender): address, price, beds/baths/sqft, year built, HOA, days on market, dated price/event history (table + small sparkline), listing agent/office name/phone/email/website (`tel:`/`mailto:` links), provenance chip, "search this address" outbound links (Google/Zillow/Apartments.com generic URLs — no scraping).
- **Cards** use illustrated property-type marks (Phase 2) — no photos exist in RentCast data.

#### Saved searches, shortlist & alerts
- **Saved search** stores the normalized query + `lastRunAt` + snapshot ids; on app open, Phase 4's scheduler re-runs due searches (≤1/24h each, sequential, confirm if >3) and shows "N new since last visit" per search, with new items badged in results.
- **Shortlist** (favorites) with status: Saved → Contacted → Toured → Applied → Signed, plus notes; a compact shortlist board on `/renter/shortlist/`. Registered in backup.

#### Fair-rent check & affordability
- **Tier 1 (0 calls):** asking rent vs zip median for that bedroom count from the shared market-stats cache (Phase 4), shown as "X% above/below zip median (as of date)" with sample-size caveat.
- **Tier 2 (1 call, cost shown first):** RentCast rent estimate with range and comparables table; low-confidence badge when comps < 3. Copy says "estimate", never "appraisal"/"value".
- **Affordability calculator** (`/renter/affordability/`): income, debts, savings → 30%/rule-of-thumb band + "what rent fits" slider; zero API calls; labeled as a general guideline, not financial advice.

#### AI outreach
- Prompt `renter/outreach.v1`: inputs = listing facts + user's move-in date, occupants count (as a number only), pets (y/n + type), questions; asks about availability, pets, fees, lease terms. Output through `GenerationPanel` (copy / `mailto:` to listing agent / mark sent) gated by the Fair Housing checker; PII minimization applied; Gemini warning applies.

#### Demo credibility
- Every renter route works keyless on Phase 4 fixtures with "Sample data" chips; E2E uses fixtures + `page.route()` mocks; axe passes on all renter routes (keyless and with a mocked key state).

#### Specific ideas
- "Availability" is reframed as "listed within N days" + Active + a "likely still available" heuristic (recent lastSeen). Copy explains this honestly.

### Claude's Discretion
- Exact route slugs under `/renter/`; map library wiring details (dynamic import to keep marketing bundle clean); clustering threshold; sort defaults.

### Deferred Ideas (OUT OF SCOPE)
- Price-drop / likely-rented badges (RENT-V2-01), email digests (RENT-V2-02).
- Cut line order if overrun: map clustering polish → RENT-05 statuses (keep plain shortlist) → Tier 2 rent estimate.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RENT-01 | Search rentals in any US city or zip by price range, bedrooms, property type, "listed within N days" | §Fetch-wide/filter-local design (server window = location + `status=Active` + `limit=500`; all four user filters local via `core.renter.matchRental`); RentCast param syntax verified (`min:max` ranges, `\|` multi-values, `daysOld` ranges, `limit` 1-500); Pitfalls 6, 7, 8 (city case-sensitivity, fixture date drift, URL-restore must not spend) |
| RENT-02 | Sortable list and map | §Leaflet pattern (spike-verified: 0 CSP violations, axe clean, referer sent, lazy 148 KB chunk); supercluster 9.1.0 config that passes axe `target-size`; stable sort in core |
| RENT-03 | Listing detail with price history and agent/office contact | §Query-param route pattern (Kit throws on `url.searchParams` during prerender — read only in browser); history mapper + inline SVG sparkline + table; safe `tel:`/`mailto:`/`https:` href builders (Pitfall 4); `GET /listings/rental/long-term/{id}` fallback (1 call, never automatic) |
| RENT-04 | Saved searches, "N new since last visit", ≤1 re-run/24h | §Saved-search + snapshot schema (two cursors: `lastRunAt`, `seenSnapshot`); Phase 4 scheduler + `core.diffSnapshots`; Playwright `page.clock` for 24h tests |
| RENT-05 | Shortlist with Contacted/Toured/Applied/Signed | §Dexie `renterShortlist` table (Syncable, `&listingId` unique, tombstone-restore), embedded listing snapshot so detail renders at 0 calls |
| RENT-06 | Asking rent vs zip median (+ optional estimate with range/comps) | §Fair-rent math (`dataByBedrooms` bucket, % delta, sample caveat); `/avm/rent/long-term` params (`compCount` 5-25, default 15) and comps fields; Pitfall 11 (subject listing appears in its own comps) |
| RENT-07 | AI outreach draft asking availability, pets, fees, lease terms | §Outreach prompt contract (`renter/outreach.v1` in the AI layer, not features), GenerationPanel props (`feature`, `promptId`, `inputs`, `mailto {to, subject}`, `containsClientData`), Fixture-provider canned output pre-linted; Pitfall 12 (assistance animals ≠ pets; occupants as number only) |
| RENT-08 | Affordable rent from income, 0 API calls | §Affordability math (HUD 30% cost-burden definition; CFPB DTI definition; user-adjustable share; no thresholds asserted as advice); component lives in `features/shared` so Phase 10's `/tools/affordability/` can reuse it |
</phase_requirements>

## Summary

Phase 6 is mostly composition: it consumes the Phase 4 gateway (search, rent estimate, market stats, cache, ledger, scheduler, provenance/cost primitives), the Phase 5 `GenerationPanel` and Fair Housing checker, and Phase 3's Dexie/backup. The genuinely new technical surface is (1) the map under the strict meta CSP, (2) query-param detail routes under full prerender, (3) the renter-specific pure logic (filters, sort, fair-rent, affordability, history, safe contact links) in `packages/core`, (4) two Dexie record types (shortlist, saved-search snapshots), and (5) an E2E harness that never touches the network, including map tiles.

I verified the risky parts empirically in a throwaway git worktree (installed `leaflet@1.9.4`, `supercluster@9.1.0`, `@types/leaflet@1.9.22`, added a spike route, built with the real `svelte.config.js` CSP plus `img-src 'self' https://tile.openstreetmap.org`, and ran Playwright + axe against `serve-pages.mjs`). Results: `await import('leaflet')` returns a module with working named exports (`map`, `tileLayer`, `divIcon`, `marker`, `layerGroup`); Leaflet goes into its own 148 KB lazy chunk that is not modulepreloaded on any page; its CSS lands in the lazily-loaded component's CSS chunk; with `build.assetsInlineLimit: 0` (which Phase 2 adds) Leaflet's PNGs are emitted as hashed same-origin files (without it, three `data:image/png` URIs appear and would violate `img-src`); zero `securitypolicyviolation` events; zero `<style>` elements injected; tile requests carry `Referer: <origin>/` (the browser default `strict-origin-when-cross-origin`, which the OSM policy requires); the zoom control's `href="#"` does not trigger a SvelteKit navigation; `url.searchParams` works client-side on the prerendered page. axe initially failed **`target-size` (WCAG 2.2 2.5.8)** on overlapping markers; supercluster `{extent: 256, radius: 48, maxZoom: 19}` with 28 px pins / 40 px clusters and a map `maxZoom: 18` fixed it, including 5 co-located units at maximum zoom (they stay one "5 listings" cluster).

The biggest planning hazards are not in the libraries but in the contracts: Phase 4's gateway contract lists `search/rentEstimate/marketStats/refresh` but Phase 6 also needs a 0-call cache read (`peek`), a by-id listing lookup, fixture dates that do not age out of "listed within 7 days", and a location normalizer that nobody's CONTEXT explicitly owns. Phases 6/7/8 can each add Dexie tables, so Dexie version numbers must be coordinated. These are listed as Open Questions with recommended defaults so the planner can add small "contract gap" tasks rather than discover them mid-execution.

**Primary recommendation:** Build renter pure logic in `packages/core/src/renter/` first (test-first), then the search page on the gateway with list-only results, then a lazily-imported `MapView` (Leaflet 1.9.4 + supercluster 9.1.0, DivIcon markers with `title`, no popups), then detail/shortlist/saved/fair-rent/outreach/affordability; extend the Phase 1 oracles (`assert-csp.mjs` `EXACT['img-src']` and `EXPECTED_PAGES`, csp/a11y/routing spec route lists) in the same plan that adds `img-src`; ship a shared deny-all E2E network fixture before any renter spec.

## Standard Stack

### Core (new in this phase)
| Library | Version (verified) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `leaflet` | **1.9.4** (npm `latest`, 2023-05-18; `2.0.0-alpha.1` exists but is pre-release) | Map, tile layer, markers | De-facto standard raster map library; no key; ESM build exported; spike-verified under this CSP. Do **not** use 2.0 alpha. |
| `supercluster` | **9.1.0** (2026-09-03; ESM, ships `index.d.ts`, deps `kdbush@4.1.0`, `@types/geojson`; ~19 KB source) | Marker clustering | Mapbox's clustering engine; `getClusters(bbox, zoom)`, `getClusterExpansionZoom`, `getLeaves`; framework-agnostic so it works with DivIcons we fully control. |
| `@types/leaflet` (dev) | **1.9.22** | Types | `svelte-check` 4.7.6 + TS 6.0.3 reported 0 errors with it in the spike. |

### Already in the graph (from earlier phases; do not re-add)
| Library | Version | Use here |
|---------|---------|----------|
| Dexie | 4.4.6 (Phase 3) | `renterShortlist`, saved-search snapshots |
| `zod` (`zod/mini`) | 4.6.4 (Phase 3/4) | Schemas for shortlist/snapshot records, backup import |
| `date-fns` | 4.4.0 (Phase 3) | `differenceInCalendarDays` for "listed within N days", relative times |
| `@lucide/svelte` | 1.45.0 (Phase 2) | UI glyphs |
| bits-ui / shadcn-svelte | 2.19.2 / 1.6.1 (Phase 3) | Tabs (List/Map), Dialog, Select, Slider |
| svelte-sonner | 1.2.1 | Optional "N new" toast (Phase 3 deferred sonner to Phase 6; add only if the UI-SPEC asks) |
| `fake-indexeddb` | 6.2.5 | Node-project repo tests |
| `@playwright/test` / `@axe-core/playwright` | 1.63.0 / 4.13.0 | E2E + axe (`page.clock`, `serviceWorkers: 'block'` available) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| supercluster | `leaflet.markercluster` 1.5.3 | Last published 2022-06; mutates global `L`, ships its own CSS + default-icon assumptions, and its spiderfy markers are hard to make axe-clean. Not recommended. |
| supercluster | Hand-rolled grid bucketing in core | ~40 lines, but you then own expansion-zoom, co-located points, and bbox edge cases. supercluster is tiny and battle-tested; see Don't Hand-Roll. |
| Inline SVG sparkline | LayerChart 2.5.1 (Phase 7's sanctioned chart lib) | Pulls d3 modules + `@layerstack/tailwind` into the renter bundle for a ≤20-point line that is `aria-hidden` anyway (the table is the accessible equivalent). Use LayerChart only for real charts (Phase 7). |
| OSM standard tiles | CARTO basemaps | **Now requires an API key** (tiles without one are watermarked; commercial free tier 1M req/month; changed 2026-09-23). Not a no-key fallback. |
| OSM standard tiles | OpenFreeMap / Maptoolkit | Vector tiles only → MapLibre GL (WebGL, worker `blob:` → CSP `worker-src` changes). Out of scope for v1. |

**Installation (apps/web):**
```bash
corepack pnpm --filter web add leaflet@1.9.4 supercluster@9.1.0
corepack pnpm --filter web add -D @types/leaflet@1.9.22
```
Pin exact versions like the rest of `apps/web/package.json`.

## Architecture Patterns

### Recommended Project Structure
```
packages/core/src/renter/              # pure, DOM-free, network-blocked tests
├── filters.ts        # RentalFilters type, toServerQuery(), matchRental(), isTruncated()
├── sort.ts           # stable sort with id tiebreak (price/beds/sqft/dom/newest)
├── fair-rent.ts      # zip-median bucket pick, % delta, sample-size caveat, comp confidence
├── affordability.ts  # 30%-of-gross band, DTI incl. rent, move-in cash coverage
├── history.ts        # RentCast `history` object → sorted event list
├── sparkline.ts      # points → SVG path string (pure)
├── availability.ts   # "likely still available" (Active + lastSeen within N days)
└── contact-links.ts  # telHref(), mailtoHref(), safeHttpUrl(), outboundSearchLinks()

apps/web/src/lib/features/renter/
├── search/           # SearchForm, ResultsList, ListingCard, TruncationNotice, search-state.svelte.ts
├── map/              # LazyMap.svelte (loader+fallback), MapView.svelte (Leaflet), cluster.ts, icons.ts
├── listing/          # ListingDetail, PriceHistory (table + Sparkline), AgentContact, OutboundLinks
├── fair-rent/        # FairRentPanel (tier 1 + tier 2)
├── shortlist/        # shortlist-repo.ts, ShortlistBoard, StatusSelect
├── saved/            # saved-search actions, SavedSearchList (NewSinceBadge from Phase 4)
└── outreach/         # OutreachForm + GenerationPanel host
apps/web/src/lib/features/shared/affordability/   # AffordabilityCalculator (no data/storage imports → Phase 10 reuse)
apps/web/src/lib/ai/prompts/renter-outreach.v1.ts # prompt lives in the AI layer (registry), not in features
apps/web/src/routes/(app)/renter/
├── +page.svelte                 # search + results (List | Map tabs)
├── listing/+page.svelte         # ?id=
├── shortlist/+page.svelte
├── saved/+page.svelte           # saved searches + "N new" (or a section of +page; UI-SPEC decides)
└── affordability/+page.svelte
apps/web/tests/e2e/
├── support/network.ts           # deny-all + RentCast/LLM/tile mocks + request counters
├── support/seed.ts              # key-state + Dexie seeding helpers (Phase 3/4 formats)
├── assets/tile.png              # 256x256 synthetic tile (≈760 bytes, generated)
└── renter-*.spec.ts
```
Static routes are prerendered automatically: Kit's default `prerender.entries` is `['*']`, which includes every route without `[params]` (verified in Kit 2.70.3 `src/core/postbuild/prerender.js`), so `handleUnseenRoutes: 'fail'` is not triggered by new renter routes.

### Pattern 1: Fetch wide, filter local (RENT-01)
**What:** The gateway request ("window") contains only what maximizes cache reuse; every user filter is applied locally by one pure function.
- **Server window (canonical request):** location (`zipCode` **or** `city`+`state`), `status=Active`, `limit=500`. Nothing else by default. Five saved searches in one zip = one call per 24h.
- **Local filters (0 calls):** price min/max, bedrooms (0 = studio, "4+" = `>=4`), property types (subset of the RentCast enum `Single Family | Condo | Townhouse | Manufactured | Multi-Family | Apartment`), listed within N days (from `listedDate`), sort.
- **Truncation:** `truncated = rows.length >= 500`. RentCast does not expose `X-Total-Count` to the browser (no `Access-Control-Expose-Headers`, ARCHITECTURE F2), so length is the only signal. On truncation show the warning with two explicit actions: **Narrow on RentCast (1 call)** — re-issue with the user's price/bedrooms/propertyType/daysOld pushed server-side (`price=min:max`, `bedrooms=min:max`, `propertyType=A|B`, `daysOld=1:N`), which is a different canonical key — or **Search a zip instead**. Never auto-paginate (`offset`), never auto-narrow.
- `matchRental` is idempotent, so applying it to a narrowed server response is harmless; keep one code path.

```ts
// packages/core/src/renter/filters.ts (shape)
export type Location = { kind: 'zip'; zipCode: string } | { kind: 'city'; city: string; state: string };
export interface RentalFilters {
  location: Location;
  priceMin?: number; priceMax?: number;
  bedsMin?: number; bedsMax?: number;          // 0 = studio; bedsMax undefined = "4+"
  propertyTypes?: readonly PropertyType[];      // empty/undefined = all
  listedWithinDays?: 7 | 14 | 30 | 60;
}
export function toServerQuery(f: RentalFilters, mode: 'wide' | 'narrow' = 'wide'): Record<string, string> {
  const q: Record<string, string> = { status: 'Active', limit: '500' };
  if (f.location.kind === 'zip') q.zipCode = f.location.zipCode;
  else { q.city = f.location.city; q.state = f.location.state; }
  if (mode === 'narrow') {
    if (f.priceMin != null || f.priceMax != null) q.price = `${f.priceMin ?? '*'}:${f.priceMax ?? '*'}`;
    // bedrooms/propertyType/daysOld likewise ('|' for multi, 'min:max' for ranges)
  }
  return q;
}
export function matchRental(row: RentalListing, f: RentalFilters, now: Date): boolean { /* pure */ }
```
`*` as an open bound: RentCast documents `min:max` and a single value as max for `daysOld`; open-ended `*:max` syntax is **not** confirmed in the docs I could read (LOW). Default: when only one bound is set, send the explicit other bound (`price=0:2000`, `price=1500:100000`) instead of `*`.

### Pattern 2: Lazy Leaflet map (RENT-02) — spike-verified
**What:** The map component (and Leaflet + its CSS) loads only when the Map tab is first activated; Leaflet is imported inside `onMount` because its module top level reads `window`, `navigator`, `document` (would crash prerender).
```svelte
<!-- features/renter/map/LazyMap.svelte -->
<script lang="ts">
  let { listings, selectedId = $bindable() } = $props();
  const load = () => import('./MapView.svelte');   // Leaflet + leaflet.css live in this chunk only
</script>
{#await load()}
  <p>Loading map…</p>
{:then m}
  <m.default {listings} bind:selectedId />
{:catch}
  <p>The map couldn't load. The list shows every result.</p>
{/await}
```
```svelte
<!-- features/renter/map/MapView.svelte (essentials; spike version passed CSP + axe) -->
<script lang="ts">
  import 'leaflet/dist/leaflet.css';
  import { onMount } from 'svelte';
  import type { Map as LMap, LayerGroup } from 'leaflet';
  import Supercluster from 'supercluster';
  let { listings, selectedId = $bindable() } = $props();
  let el: HTMLDivElement; let map: LMap | undefined; let layer: LayerGroup | undefined;
  let L: typeof import('leaflet') | undefined;
  const index = $derived(new Supercluster({ radius: 48, extent: 256, maxZoom: 19 })
      .load(listings.map(toPointFeature)));          // extent 256 = Leaflet tile size

  onMount(() => {
    let disposed = false;
    (async () => {
      L = await import('leaflet');                    // named exports work (verified)
      if (disposed) return;
      map = L.map(el, { maxZoom: 18 });               // < supercluster maxZoom → co-located units always cluster
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      layer = L.layerGroup().addTo(map);
      map.fitBounds(boundsOf(listings), { padding: [24, 24] });
      map.on('moveend', draw);
      draw();
    })();
    return () => { disposed = true; map?.remove(); };
  });
  $effect(() => { void index; draw(); });            // redraw when filtered listings change (no gateway calls here)

  function draw() {
    if (!map || !L || !layer) return;
    layer.clearLayers();
    const b = map.getBounds();
    for (const f of index.getClusters([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], Math.round(map.getZoom()))) {
      // Build DOM nodes / static SVG strings only. NEVER interpolate listing data into an HTML string.
      // Accessible name comes from Leaflet's `title` option (set via DOM property, safe).
    }
  }
</script>
<div bind:this={el} class="map-canvas"></div>   <!-- give it an explicit height in CSS -->
```
Rules:
- **No `bindPopup`/`setContent` strings, no DivIcon `html` built from listing data.** Leaflet writes those with `innerHTML` (lines 10028, 11080 of `leaflet-src.esm.js`). Pass an `HTMLElement` built with `textContent`, or a static SVG string. Selection details render in our Svelte side panel / highlighted card, not a Leaflet popup.
- **Markers:** `L.marker(latlng, { icon: L.divIcon({ html: node, className: 'pin', iconSize: [28, 28] }), title: '$1,450 · 2 bd · 412 Example Ave' })`. Leaflet sets `tabindex=0` + `role="button"` on keyboard markers; `title` gives the accessible name (axe `button-name` passed). Pins ≥ 24 px (WCAG 2.5.8), clusters 40 px with `textContent` count.
- **Cluster click:** `zoom = index.getClusterExpansionZoom(id)`; if `zoom > map.getMaxZoom()` (co-located units), show `index.getLeaves(id, Infinity)` as a list in the side panel instead of zooming.
- **Wrap** the map in `<section aria-labelledby="map-heading">`. Do not put `aria-label` on the bare Leaflet `div` (aria-label on a generic element is prohibited in ARIA 1.2 → axe `aria-prohibited-attr`). Do not use `role="application"`.
- **Tab visibility:** if the map stays mounted while hidden, call `map.invalidateSize()` when the Map tab is re-shown. Initialize only when visible.
- **Tile errors:** listen to `tileerror`; after N errors show "Map tiles from OpenStreetMap aren't loading right now. The list shows every result." No retry loop.
- **Restyle `.leaflet-control-attribution`** with brand tokens and an opaque background so axe's contrast result is deterministic (spike: 1 `color-contrast` "incomplete" over the semi-transparent default). Attribution must stay visible (OSM blocks manually for missing attribution).

### Pattern 3: Query-param detail route under full prerender (RENT-03)
**What:** `/renter/listing/` is a normal static route; the id is read only in the browser.
```svelte
<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  // Kit's server renderer replaces url.search/searchParams with throwing getters during prerender
  // ("Cannot access url.searchParams on a page with prerendering enabled", src/utils/url.js disable_search).
  const id = $derived(browser ? page.url.searchParams.get('id') : null);
</script>
```
- Build links with `resolve('/renter/listing/') + '?' + new URLSearchParams({ id })`. RentCast ids contain commas and dashes (e.g. `3821-Hargis-St,-Austin,-TX-78723`); the spike round-tripped `%2C` correctly. For the by-id API call, `encodeURIComponent(id)` in the path.
- **Resolution order (0 calls first):** shortlist snapshot → cached search rows (gateway cache) → fixture rows (sample mode) → otherwise an explicit **Load this listing (1 call)** button (`GET /v1/listings/rental/long-term/{id}`, live mode only). Never auto-fetch on mount.
- **Missing/unknown id:** the prerendered HTML always has a static `h1` ("Listing details"), because the routing and a11y specs assert a visible `h1`. Content below it swaps to a not-found state ("We couldn't find that listing" + a link back to search). There is no HTTP status change: static hosting returns 200 for the prerendered page.
- Same-route navigation (`?id=a` → `?id=b`) does not remount; the `$derived` id handles it — do not rely on `onMount` to read the id.

### Pattern 4: URL-synced search state that never spends on load
- Mirror the submitted `RentalFilters` into the URL (`/renter/?zip=78701&max=2000&beds=1-2&type=Condo|Apartment&days=14&sort=newest`) via `goto(url, { replaceState: true, keepFocus: true, noScroll: true })` so back/forward and reload work.
- On load, parse the URL, then **peek** the gateway cache for the server window (0 calls). Cached → render with "(0 calls · cached)". Not cached → show the form filled in with **Search rentals (1 call)**. A URL must never trigger a billable call (Phase 4 rule: no reactive refetch; `$effect` must never call the gateway).

### Pattern 5: Saved searches, snapshots and "N new since last visit" (RENT-04)
Two cursors per saved search, consistent with Phase 4's scheduler ("two-cursor TTL re-run"):
- `lastRunAt` — TTL cursor (≤ 1 run / 24 h, owned by the scheduler).
- `seenSnapshot` — what the user last *looked at*. "N new" = `core.diffSnapshots(seenSnapshot, latestSnapshot).new.length`. Opening the saved search's results marks it seen (`seenSnapshot := latestSnapshot`). Re-runs without a visit accumulate correctly because the diff is always against the seen snapshot, not the previous run.
- Snapshot = compact, **post-local-filter** rows: `{ id, price, listedDate }[]` (≤ 500 × ~60 bytes). Store `latestSnapshot`, `seenSnapshot`, `lastRunAt`, `lastSeenAt`, `truncated`.
- Recommended record (sync-ready `Syncable` per Phase 3):
```ts
interface SavedSearch extends Syncable {         // table likely owned by Phase 4 (scheduler); Phase 7 shares it
  kind: 'renter.rental' | 'investor.sale';       // scheduler is portal-agnostic: server query + core matcher
  name: string;
  filters: RentalFilters;                        // normalized
  serverQuery: Record<string, string>;           // canonical window (what the scheduler sends)
  lastRunAt: string | null; lastSeenAt: string | null;
  latestSnapshot: SnapshotRow[]; seenSnapshot: SnapshotRow[];
  truncated: boolean;
}
```
- The scheduler stays in `lib/data` and must not import `features/renter`; it re-runs `serverQuery` through the gateway and applies the portal-neutral matcher from core. Register saved searches (incl. snapshots) in the backup so "new since last visit" survives restore.
- New listings are badged in results by `newIds = new Set(diff.new.map(r => r.id))`.

### Pattern 6: Shortlist (RENT-05)
```ts
// Dexie stores (added in the storage schema version Phase 6 takes; see Open Question 5)
renterShortlist: 'id, &listingId, status, updatedAt, deletedAt'
interface ShortlistItem extends Syncable {
  listingId: string;                 // RentCast id (case-sensitive)
  listing: RentalListingSnapshot;    // normalized row at save time, incl. provenance {source, fetchedAt}
  status: 'saved' | 'contacted' | 'toured' | 'applied' | 'signed';
  statusHistory: { status: ShortlistItem['status']; at: string }[];
  notes: string;                     // plain text, rendered as text, length-capped
}
```
- `&listingId` is unique even for tombstoned rows: "add" must restore a tombstone (`deletedAt = null`, bump `updatedAt`) instead of inserting, or the unique index throws `ConstraintError`.
- Status is a select (and optionally drag on the board). Never color-only: every status has text + icon.
- Embedded `listing` snapshot lets detail render at 0 calls months later; show its "as of" chip.
- Register in backup (included). Sample-mode items keep `source: 'sample'` and their Sample chip forever.

### Pattern 7: Fair-rent check (RENT-06)
- **Tier 1 (0 calls if cached):** `marketStats(zip)` from the shared cache (30 d TTL). Pick `rentalData.dataByBedrooms.find(b => b.bedrooms === listing.bedrooms)`; for bedrooms above the highest bucket use the highest (LOW: max bucket value unverified). `delta = (asking − medianRent) / medianRent`. Copy: "{n}% above the zip median for {beds}-bedroom rentals (as of {date})"; within ±3% say "about the same as". Caveat when the bucket's `totalListings < 10` (discretion default): "Based on few listings." If stats are not cached: a **Load zip rent stats (1 call)** button — never automatic. Fields verified: `averageRent, medianRent, minRent, maxRent, totalListings, newListings, …, lastUpdatedDate`, `dataByBedrooms[]`, `dataByPropertyType[]`, `history` by `YYYY-MM`.
- **Tier 2 (1 call, `CostLabel` first):** `GET /v1/avm/rent/long-term?address=…&propertyType=…&bedrooms=…&bathrooms=…&squareFootage=…&compCount=15` → `rent`, `rentRangeLow`, `rentRangeHigh`, `comparables[]` (address, beds/baths/sqft, `price`, `distance`, `daysOld`, `correlation`, `status`, dates). Low-confidence badge when `comparables.length < 3`. Words: "estimate", "range", "comparable rentals". Never "value", "appraisal", "fair market value".

### Pattern 8: AI outreach (RENT-07)
- Prompt `renter/outreach.v1` is defined in the AI layer's registry (`lib/ai/prompts/`), with `containsClientData: true` (it carries the renter's own details → Gemini warning applies). Features import the AI layer, never the reverse.
- Inputs: listing facts (address, price, beds/baths, property type, days on market), move-in date, `occupants: number` (no ages, relationships, or household description), `pets: { has: boolean; type?: 'dog'|'cat'|'other' }`, optional free-text questions (redacted by `core.redactPii`), sender first name as a role token.
- Host: `<GenerationPanel feature="renter.outreach" promptId="renter/outreach.v1" inputs={…} mailto={{ to: agent.email ?? office.email, subject: `Question about ${addressLine1}` }} containsClientData />`. No other exits.
- Add a canned Fixture-provider output for this prompt (Phase 5 Fixture provider) that passes the checker with zero findings; a unit test enforces it.

### Pattern 9: Affordability (RENT-08), zero calls
```ts
// packages/core/src/renter/affordability.ts
export function affordability(i: { grossMonthly: number; monthlyDebts: number; utilities: number; savings: number; share: number /* 0.30 default */ }) {
  const guideline = Math.max(0, i.share * i.grossMonthly - i.utilities);  // HUD: >30% of income on housing = cost-burdened
  const dtiAt = (rent: number) => (rent + i.monthlyDebts) / i.grossMonthly; // CFPB DTI definition (debts / gross monthly)
  const moveInCost = (rent: number) => rent * 2;                           // first month + deposit (editable assumption)
  return { guideline, dtiAt, moveInCost, monthsCovered: (rent: number) => i.savings / rent };
}
```
- Integer cents internally (match Phase 7's finance convention); display rounded.
- Copy: "A common guideline is to keep rent and utilities near 30% of income before taxes. Landlords and lenders set their own requirements. This is a general guideline, not financial advice." Never "you can afford", "you qualify", "recommended".
- Do not persist income by default (privacy, and Phase 10 reuses the component on a marketing page that must not import storage). The component in `features/shared/affordability/` imports only `core` + UI primitives.

### Anti-Patterns to Avoid
- **Static `import L from 'leaflet'` in any component or module evaluated during prerender** → `window is not defined` at build.
- **Interpolating listing fields into Leaflet HTML strings** (popups, DivIcon `html`, attribution) → XSS on a key-holding origin.
- **Calling the gateway from `$effect`, `onMount` URL restore, or a map `moveend`** → silent call burn (Phase 4 forbids).
- **A Leaflet popup as the only place selection details appear** → keyboard/screen-reader trap. Use the list/side panel.
- **Putting the affordability calculator in `features/renter`** → Phase 10's marketing route can't reuse it cleanly.
- **Auto-pagination (`offset`) when truncated** → each page is a billed call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Marker clustering | Grid buckets / distance merging | `supercluster` 9.1.0 | Expansion zoom, leaves, co-located points, bbox wrap; verified axe-clean config |
| Map, tiles, pan/zoom, keyboard | Custom tile renderer | Leaflet 1.9.4 | Keyboard pan/zoom, accessible zoom buttons, tile lifecycle |
| Budget, cache, dedupe, TTL, cap dialog | Any renter-side fetch/cache | Phase 4 `DataGateway` + `CostLabel`/`CapConfirmDialog`/`ProvenanceRow` | Single choke point; lint bans `fetch` outside adapters |
| Snapshot diff | Ad-hoc set math in a component | `core.diffSnapshots` (Phase 4) | One tested implementation shared with Phase 7 |
| LLM streaming, exits, Fair Housing gating, Gemini warning, redaction | Anything in renter | Phase 5 `GenerationPanel`, `core.redactPii`, checker | AI-04 invariants are tested there |
| Saved-search scheduling | A renter timer/interval | Phase 4 scheduler | ≤1/24h, sequential, >3 confirm, never past cap |
| Date math | Manual ms arithmetic | `date-fns` `differenceInCalendarDays`, `formatDistanceToNowStrict` | DST/timezone edges |
| Backup inclusion | Custom export | Phase 3 backup registry | Key-free guarantee, migrations |
| Phone/email/URL links from data | String concat | `core/renter/contact-links.ts` (small, tested) | Scheme injection (`javascript:`) and encoding bugs |

**Key insight:** Phase 6 should add almost no infrastructure. If a renter task starts writing a fetch, a cache, a timer, or an HTML string, it is in the wrong layer.

## Common Pitfalls

### Pitfall 1: Leaflet PNGs inlined as `data:` URIs
**What goes wrong:** With Vite's default 4 KB `assetsInlineLimit`, `leaflet.css`'s `layers.png`, `layers-2x.png`, `marker-icon.png` become `url(data:image/png;base64,…)` (spike: 3 occurrences) → `img-src` violations whenever those classes render.
**How to avoid:** `build.assetsInlineLimit: 0` (Phase 2 already plans it; confirm it landed). Phase 2's `data:` oracle check in `assert-csp.mjs` covers regressions. Use DivIcons, not the default icon.
**Warning signs:** `grep -c "data:image" build/_app/immutable/assets/*.css` > 0.

### Pitfall 2: `img-src` added in one file only
**What goes wrong:** `svelte.config.js` gains `'img-src': ['self', 'https://tile.openstreetmap.org']`, but `scripts/assert-csp.mjs` has no `img-src` in `EXACT` → the oracle doesn't pin it, and a later widening (`https:` / `data:`) passes silently. Adding `img-src` without `'self'` blocks same-origin images (Leaflet assets, icons).
**How to avoid:** Same commit: add `'img-src': ["'self'", 'https://tile.openstreetmap.org']` to `EXACT` + a mutation test in `assert-csp.test.ts`; add renter pages to `EXPECTED_PAGES`. Use the bare host (no `a.`/`b.`/`c.` subdomains — OSM policy mandates the single `tile.openstreetmap.org` URL).

### Pitfall 3: OSM "Access blocked" tiles
**What goes wrong:** OSM returns a blocked tile when no `Referer` is sent (e.g. someone adds `<meta name="referrer" content="no-referrer">` or `same-origin`), when attribution is missing, or on bulk/prefetch use. Leaflet 1.9.4 has **no** `referrerPolicy` tile option (the upstream fix landed only for 2.x).
**How to avoid:** Keep the document default (`strict-origin-when-cross-origin`; spike observed `Referer: http://127.0.0.1:4373/`). Never add a restrictive referrer meta. E2E asserts the mocked tile request has a non-empty `referer`. Visible attribution; lazy load on the Map tab; no prefetch; the Phase 3 service worker must ignore cross-origin requests (offline use of OSM tiles is prohibited).

### Pitfall 4: Scheme injection through listing contact fields
**What goes wrong:** `listingAgent.website` / `listingOffice.website` rendered as `href={website}` allows `javascript:` URLs from data. Svelte does not sanitize `href`.
**How to avoid:** `safeHttpUrl(s)` returns a URL only if `new URL(s)` succeeds with protocol `https:` or `http:`; otherwise render as plain text. `telHref` keeps digits only (`tel:+1XXXXXXXXXX`); `mailtoHref` validates a simple email shape and `encodeURIComponent`s. External links: `rel="noopener noreferrer" target="_blank"` plus visible "(opens in a new tab)" text.

### Pitfall 5: Phase 1 routing spec vs external links
**What goes wrong:** `routing.spec.ts` asserts every non-fragment `<a>` resolves to a trailing-slash path under the base. `tel:`, `mailto:`, Google/Zillow links and the OSM copyright link (`/copyright`) fail that assertion once renter routes join `ROUTES`.
**How to avoid:** Filter the check to same-origin `http(s)` links (`new URL(href, page.url()).origin === new URL(page.url()).origin`) in the same plan that adds renter routes.

### Pitfall 6: City names are case-sensitive in RentCast
**What goes wrong:** `city=austin` returns no results (404, unbilled, negative-cached 24 h).
**How to avoid:** Normalize (trim, collapse spaces, title-case, uppercase 2-letter state) and validate 5-digit zip before the call; the 404 message suggests "Check the city spelling or try a zip code". Naive title-casing breaks names like "McAllen", "DeKalb", "St. Louis" (LOW: exact RentCast spellings unverified) → recommend zip as the primary input in the UI and keep the user's casing when it already contains capitals.

### Pitfall 7: Fixture dates age out of "listed within N days"
**What goes wrong:** Seeded fixtures have absolute dates; a month after generation "listed within 7 days" returns nothing in sample mode and demo credibility dies.
**How to avoid:** Fixture adapter rebases every date by `(todayUTC − FIXTURE_EPOCH)` whole days at read time (or the generator emits day offsets). Tests use an injected clock / `page.clock.setFixedTime`. If Phase 4 does not ship this, Phase 6 adds it in the fixture adapter (Open Question 3).

### Pitfall 8: Restoring state spends a call
**What goes wrong:** Reading filters from the URL or a saved search and "helpfully" running the search on mount.
**How to avoid:** Restore = `peek` cache only. Billable runs come only from a click or the scheduler. Unit test: mounting the search page with a URL and an empty cache produces 0 fetches.

### Pitfall 9: Overlapping markers fail axe `target-size`
**What goes wrong:** WCAG 2.2 2.5.8 (in the project's axe tag set via `wcag22aa`) flags focusable markers that overlap or are < 24 px (spike: 8 nodes with supercluster defaults `radius: 60, extent: 512` and 20 px pins).
**How to avoid:** `extent: 256` (Leaflet tile size), `radius: 48`, pins 28 px, clusters 40 px, supercluster `maxZoom: 19` > map `maxZoom: 18` so co-located units never render as stacked individual markers. Run axe with the map tab open in E2E.

### Pitfall 10: Playwright route precedence
**What goes wrong:** Handlers registered later win. A catch-all deny route added after the tile/RentCast mocks swallows them (spike: every tile `ERR_FAILED`). `page.route` also misses Service Worker–initiated requests.
**How to avoid:** Register the deny-all first, specific mocks after (or a single router function). Set `test.use({ serviceWorkers: 'block' })` in renter specs. Count requests per host and assert.

### Pitfall 11: The subject listing appears in its own comps
**What goes wrong:** An active listing is likely among RentCast's comparables for its own address (distance ≈ 0, high correlation), making "asking vs estimate" circular. (LOW: not verified with a real key.)
**How to avoid:** Display comps excluding entries with the same id or same `formattedAddress`, and note "This listing is included in RentCast's estimate" when present. Add to Phase 4's real-key HUMAN-UAT list.

### Pitfall 12: Fair Housing exposure in renter inputs
**What goes wrong:** Free-text household descriptions ("me, my wife and two kids") flow into the prompt and output; pets field treats assistance animals as pets.
**How to avoid:** Occupants is a number input only; no ages/relationships fields. Pets helper text: "Assistance animals aren't pets under fair housing rules, so you don't need to list them here." Free-text questions go through `redactPii` and the output through the checker (block = Copy/Open-email disabled).

### Pitfall 13: Dexie version collisions across portal phases
**What goes wrong:** Phases 6, 7, 8 each add tables with `db.version(N)`; if two pick the same N or reorder, upgrades break on existing browsers.
**How to avoid:** One schema module (`lib/storage/schema.ts`) with an ordered version list; Phase 6 takes the next free version at execution time; a unit test asserts versions strictly increase and every table is either backup-registered or explicitly excluded.

### Pitfall 14: Map initialized in a hidden container
**What goes wrong:** Leaflet measures a 0×0 container → grey map, wrong bounds.
**How to avoid:** Create the map only after the Map tab is visible; `invalidateSize()` on re-show; the container has an explicit CSS height (e.g. `min-height: 24rem`, full viewport height minus header on mobile).

## Code Examples

### Shared deny-all network fixture (E2E)
```ts
// apps/web/tests/e2e/support/network.ts
import { test as base, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const TILE = fileURLToPath(new URL('../assets/tile.png', import.meta.url));

export const test = base.extend<{ net: { counts: Record<string, number>; external: string[]; tileReferers: string[] } }>({
  net: [async ({ page }, use) => {
    const net = { counts: {} as Record<string, number>, external: [] as string[], tileReferers: [] as string[] };
    // 1) deny-all FIRST (later-registered routes take precedence)
    await page.route(/^https?:\/\/(?!127\.0\.0\.1[:/])/, (r) => { net.external.push(r.request().url()); return r.abort(); });
    // 2) specific mocks
    await page.route('https://tile.openstreetmap.org/**', (r) => {
      net.counts.tiles = (net.counts.tiles ?? 0) + 1;
      net.tileReferers.push(r.request().headers()['referer'] ?? '');
      return r.fulfill({ path: TILE, contentType: 'image/png' });
    });
    // RentCast/LLM mocks are installed per spec via helpers that also bump net.counts['rentcast:/listings/rental/long-term'] etc.
    await use(net);
    expect(net.external, 'unexpected external requests').toEqual([]);
  }, { auto: true }]
});
test.use({ serviceWorkers: 'block' });
```

### Safe contact links (core)
```ts
export function safeHttpUrl(s: string | undefined): string | null {
  if (!s) return null;
  try { const u = new URL(s.includes('://') ? s : `https://${s}`); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null; }
  catch { return null; }
}
export const telHref = (p?: string) => { const d = (p ?? '').replace(/\D/g, ''); return d.length === 10 ? `tel:+1${d}` : d.length === 11 && d[0] === '1' ? `tel:+${d}` : null; };
export function outboundSearchLinks(address: string) {
  const q = encodeURIComponent(address);
  return [
    { label: 'Google Maps', href: `https://www.google.com/maps/search/?api=1&query=${q}` }, // official Maps URLs API
    { label: 'Google search', href: `https://www.google.com/search?q=${q}` },
    { label: 'Apartments.com (via Google)', href: `https://www.google.com/search?q=${encodeURIComponent(`site:apartments.com "${address}"`)}` },
    { label: 'Zillow', href: `https://www.zillow.com/homes/${q}_rb/` } // LOW: undocumented URL pattern; keep as data
  ];
}
```

### Sparkline (pure path + aria-hidden SVG; the table is the accessible equivalent)
```ts
export function sparklinePath(values: number[], w: number, h: number, pad = 2): string | null {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  return values.map((v, i) => `${i ? 'L' : 'M'}${(pad + (i * (w - 2 * pad)) / (values.length - 1)).toFixed(1)},${(h - pad - ((v - min) * (h - 2 * pad)) / span).toFixed(1)}`).join(' ');
}
```
```svelte
{#if path}<svg viewBox="0 0 120 32" width="120" height="32" aria-hidden="true" focusable="false"><path d={path} fill="none" class="stroke-primary" stroke-width="2" /></svg>{/if}
<table><caption>Price history</caption><thead><tr><th scope="col">Date</th><th scope="col">Event</th><th scope="col">Rent</th><th scope="col">Days on market</th></tr></thead>…</table>
```
History source: RentCast `history` is an object keyed `YYYY-MM-DD` with `{ event, price, listingType, listedDate, removedDate, daysOnMarket }`; sort keys ascending. One entry → show the table and "Only one price on record" (no sparkline). Use a non-text-contrast-safe token (≥ 3:1) for the stroke.

### "Likely still available" heuristic
```ts
export const likelyAvailable = (r: { status: string; lastSeenDate?: string }, now: Date, maxDays = 3) =>
  r.status === 'Active' && !!r.lastSeenDate && differenceInCalendarDays(now, new Date(r.lastSeenDate)) <= maxDays;
```
Copy: "Seen on the market in the last 3 days. RentCast doesn't know move-in dates, so ask the agent." Never "available now".

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `{a,b,c}.tile.openstreetmap.org` | single `tile.openstreetmap.org` | OSM policy (current) | One CSP host |
| CARTO raster tiles keyless | CARTO requires an API key (watermark without) | 2026-09-23 | No keyless fallback provider; list view is the fallback |
| `leaflet.markercluster` | supercluster (+ own DivIcons) | markercluster unpublished since 2022 | Cleaner a11y and CSP control |
| Leaflet tiles send whatever referrer the page policy allows | Leaflet 2.x defaults tile `referrerPolicy` to `strict-origin-when-cross-origin` | 2026 (2.x line only) | On 1.9.4, keep the document default and test it |
| RentCast single-value filters | `min:max` ranges + `\|` multi-values on listings (`bedrooms`, `price`, `propertyType`, `daysOld`, …) | RentCast 2025-08 query engine release | Narrow-on-truncation is a single request |

**Deprecated/outdated:** Leaflet 2.0 is alpha (`2.0.0-alpha.1`, 2025-08) — do not adopt in v1.

## Open Questions

1. **Gateway API surface Phase 6 needs beyond Phase 4's stated contract**
   - What we know: Phase 4 promises `search`, `rentEstimate`, `marketStats`, `refresh`, `estimateCost`.
   - What's unclear: a 0-call cache read (`peek(request)`), cached-listing lookup by id, and `rentalListingById(id)` (`GET /v1/listings/rental/long-term/{id}`, 1 call, 24 h TTL).
   - Recommendation: Phase 6 plan includes a small task adding these to the gateway port + RentCast adapter (`lib/data/rentcast`, the only place `fetch` is allowed) + fixture adapter, following Phase 4 patterns and call-count tests. If Phase 4 already shipped them, the task collapses to verification.
2. **Who owns the location normalizer?** 06-CONTEXT says "Phase 4's location normalizer", but 04-CONTEXT doesn't list one. Recommendation: `core.normalizeLocation(input) → Location | ValidationError` in `packages/core` (Phase 6 creates it if absent; Phase 7 reuses).
3. **Fixture date rebasing** (Pitfall 7). Recommendation: fixture adapter rebases at read time; if Phase 4 didn't, Phase 6 adds it with a test that "listed within 7 days" returns ≥ 1 sample row for any `now`.
4. **"N new" in sample mode.** Static fixtures never change, so a keyless visitor never sees "N new". Recommendation (default): honest behaviour (no fake drift); E2E proves the path by seeding an older `seenSnapshot`. Optional later: deterministic daily drift in the fixture adapter, clearly badged.
5. **Dexie version number and table ownership.** `savedSearches` appears to be Phase 4's (backup registry note) and is shared with Phase 7's buy-boxes. Recommendation: Phase 6 adds `renterShortlist` (and snapshot fields on `savedSearches` if Phase 4's shape lacks them) in the next free schema version; add the version/backup-coverage unit test.
6. **Key-state seeding in E2E.** The mocked-key state depends on Phase 3's vault storage format. Recommendation: `tests/e2e/support/seed.ts` uses the Settings UI once per worker (paste fake key `test-rentcast-0000`) or the vault's documented session key; never a real-looking key (gitleaks).
7. **TTL conflict for estimates:** CLAUDE.md says 14 d, 04-CONTEXT says 7 d. Phase 4 owns it; Phase 6 just displays "as of". Flag for Phase 4.
8. **RentCast open-ended range syntax (`*:2000`)** unconfirmed (LOW). Default: always send both bounds.
9. **Max `dataByBedrooms` bucket** (e.g. whether 4 and 5+ are separate) unverified (LOW). Default: nearest bucket ≤ bedrooms, else highest; label the bucket used.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.11 (projects: `apps/web` node env, `packages/core`, `scripts`; network blocked by `tooling/vitest/no-network.ts`), Playwright 1.63.0 + `@axe-core/playwright` 4.13.0 (projects `root` :4273 and `sub` :4274 via `scripts/serve-pages.mjs`), `fake-indexeddb` 6.2.5 (Phase 3) |
| Config files | `vitest.config.ts`, `apps/web/vite.config.ts`, `packages/core/vitest.config.ts`, `apps/web/playwright.config.ts` |
| Quick run command | `corepack pnpm test:unit` (all unit, < 30 s) or `corepack pnpm vitest run packages/core/src/renter` |
| E2E (per wave) | `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm test:e2e -- tests/e2e/renter-` |
| Full suite command | `corepack pnpm verify` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File | Failure mode caught |
|--------|----------|-----------|-------------------|------|---------------------|
| RENT-01 | `toServerQuery` = location + `status=Active` + `limit=500` only (wide); narrow mode emits `price=a:b`, `bedrooms=a:b`, `propertyType=A\|B`, `daysOld=1:N` | unit | `corepack pnpm vitest run packages/core/src/renter/filters.test.ts` | ❌ Wave 0 | Filters leak server-side (cache fragmentation) or wrong syntax |
| RENT-01 | `matchRental` table tests: studio=0, "4+", type subset, listed-within with injected `now`, price bounds inclusive; idempotent | unit | same file | ❌ | Off-by-one, timezone day drift |
| RENT-01 | Location required: empty/invalid zip or city without state → no request, inline error | unit + E2E | `filters.test.ts`; `test:e2e -- renter-search` | ❌ | Wasted (404) calls |
| RENT-01 | Keyless search returns sample rows with Sample chips; mocked-key search = exactly 1 RentCast request; 5 subsequent filter/sort changes = 0 more; URL reload = 0 requests (cache peek) | E2E | `test:e2e -- renter-search.spec.ts` | ❌ | Reactive refetch / restore spending |
| RENT-01 | 500-row mock → truncation notice; "Narrow on RentCast (1 call)" issues 1 request with narrow params; no `offset` request ever | E2E | same | ❌ | Silent truncation, auto-pagination |
| RENT-02 | Stable sort (price/beds/sqft/dom/newest, id tiebreak) | unit | `vitest run packages/core/src/renter/sort.test.ts` | ❌ | Non-deterministic order |
| RENT-02 | List view makes 0 tile requests; Map tab → tiles requested (mocked), markers/clusters visible, `referer` non-empty, 0 CSP violations, axe clean with map open; marker click highlights card | E2E | `test:e2e -- renter-map.spec.ts` | ❌ | Eager map load, CSP regression, target-size, referer stripped |
| RENT-02 | Built CSP has `img-src 'self' https://tile.openstreetmap.org` exactly; no `data:` in CSS; renter pages present | build oracle | `corepack pnpm csp:assert` (+ `vitest run scripts/assert-csp.test.ts` mutation) | ⚠ extend | One-file CSP drift, inlined assets |
| RENT-02 | Marketing routes don't import leaflet/supercluster | lint | `corepack pnpm lint` (+ `scripts/eslint-rules.test.ts` case) | ⚠ extend | Map code in marketing bundle |
| RENT-03 | `history` → sorted events; `sparklinePath` (<2 points → null); `safeHttpUrl` rejects `javascript:`; `telHref`/`mailtoHref` | unit | `vitest run packages/core/src/renter/{history,sparkline,contact-links}.test.ts` | ❌ | Scheme injection, bad ordering |
| RENT-03 | `/renter/listing/?id=<fixture id with comma>` renders facts, history table, `tel:`/`mailto:` hrefs, provenance chip; missing id and unknown id → not-found state with link back; unknown id with key → "Load this listing (1 call)" and 0 requests until clicked | E2E | `test:e2e -- renter-listing.spec.ts` | ❌ | Prerender searchParams crash, auto-fetch |
| RENT-04 | Saved search: first run snapshot; re-run within 24 h = 0 calls; after 24 h with 2 new mocked rows → `new=2`; marking seen resets; diff against seen snapshot accumulates across runs | unit (fake-indexeddb, fake timers) | `vitest run apps/web/src/lib/features/renter/saved` | ❌ | Double-runs, wrong cursor |
| RENT-04 | `page.clock.setFixedTime(T)`, save search, set `T+25h`, reload → 1 RentCast request and "2 new since your last visit"; reload again → 0 requests | E2E | `test:e2e -- renter-saved.spec.ts` | ❌ | >1 run/24h, missing badge |
| RENT-05 | Shortlist repo: add, unique `listingId`, tombstone restore, status history, backup registration | unit | `vitest run apps/web/src/lib/features/renter/shortlist` | ❌ | ConstraintError on re-add, backup omission |
| RENT-05 | Add from card → status change → reload persists; board axe clean; status conveyed by text not color | E2E | `test:e2e -- renter-shortlist.spec.ts` | ❌ | Lost state, color-only status |
| RENT-06 | Bucket pick, % delta, ±3% "about the same", sample caveat, missing bucket; comps < 3 → low confidence; subject-listing comp excluded | unit | `vitest run packages/core/src/renter/fair-rent.test.ts` | ❌ | Wrong math/copy, circular comps |
| RENT-06 | Tier 1 with cached stats = 0 requests; Tier 2 button shows "(1 call)" and issues exactly 1 `/avm/rent/long-term` request; copy contains "estimate", never "appraisal"/"value" | E2E | `test:e2e -- renter-fair-rent.spec.ts` | ❌ | Hidden spending, advice optics |
| RENT-07 | Prompt builder includes only allowed inputs (occupants numeric, pets), redacts PII; fixture output passes checker with 0 findings; `mailto.to` falls back agent → office | unit | `vitest run apps/web/src/lib/ai/prompts/renter-outreach` | ❌ | Protected-class leakage, broken mailto |
| RENT-07 | Keyless: Generate → sample draft streams, exactly 3 exits, mailto href encoded; mocked LLM SSE returning "no kids" → block finding, Copy/Open-email disabled | E2E | `test:e2e -- renter-outreach.spec.ts` | ❌ | Ungated copy |
| RENT-08 | Reference cases (e.g. $6,000/mo gross, $150 utilities, 30% → $1,650; DTI with $400 debts at $1,650 rent = 34.2%) and edge cases (0 income, negative after utilities → 0) | unit | `vitest run packages/core/src/renter/affordability.test.ts` | ❌ | Math/rounding errors |
| RENT-08 | `/renter/affordability/` interaction makes 0 requests to any host; axe clean; copy says "general guideline, not financial advice" | E2E | `test:e2e -- renter-affordability.spec.ts` | ❌ | Hidden calls, advice language |
| All | axe (`wcag2a/2aa/21a/21aa/22aa`) on every renter route × {keyless, mocked key}; CSP collector over every renter route incl. Map tab; routing spec over renter routes (same-origin link filter); every `data-provenance="sample"` row has a visible chip (Phase 4 helper) | E2E | `test:e2e -- a11y csp routing renter-` | ⚠ extend | Demo-credibility regressions |
| All | No external request in any renter spec (`net.external` empty) | E2E fixture | every renter spec (auto fixture) | ❌ | CI hitting RentCast/LLM/OSM |

### Sampling Rate
- **Per task commit:** `corepack pnpm test:unit` (plus `corepack pnpm lint` when touching imports/boundaries)
- **Per wave merge:** `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert && corepack pnpm test:e2e`
- **Phase gate:** `corepack pnpm verify` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/tests/e2e/support/network.ts` — deny-all auto fixture, RentCast/LLM/tile mocks, per-host counters (Pitfall 10)
- [ ] `apps/web/tests/e2e/assets/tile.png` — 256×256 synthetic PNG (generated with Node `zlib`, ~760 bytes; no OSM imagery committed)
- [ ] `apps/web/tests/e2e/support/seed.ts` — mocked-key state + Dexie seeding (depends on Phase 3/4 formats; Open Question 6)
- [ ] RentCast mock bodies built from the Phase 4 synthetic fixtures (must pass `scripts/guard-real-data.mjs`), including a 500-row variant and a by-id response
- [ ] `packages/core/src/renter/*.test.ts` stubs (filters, sort, fair-rent, affordability, history, sparkline, contact-links, availability)
- [ ] Extend `scripts/assert-csp.mjs` (`EXACT['img-src']`, `EXPECTED_PAGES` + renter pages) and `scripts/assert-csp.test.ts` (mutation: drop OSM host / add `data:`)
- [ ] Extend `csp.spec.ts`, `a11y.spec.ts`, `routing.spec.ts` route lists; routing link filter to same-origin
- [ ] ESLint: forbid `leaflet`/`supercluster` imports in `routes/(marketing)/**` and `features/shared/affordability/**` forbidding `storage`/`data`/`ai`; add cases to `scripts/eslint-rules.test.ts`

## Sources

### Primary (HIGH confidence)
- **Empirical spike in a throwaway worktree of this repo (2026-10-04, removed afterwards):** Leaflet 1.9.4 + supercluster 9.1.0 + @types/leaflet 1.9.22 built with the real CSP plus `img-src`; Playwright 1.63 + axe 4.13 against `serve-pages.mjs`: chunking, `data:` inlining with/without `assetsInlineLimit: 0`, 0 CSP violations, 0 `<style>` elements, referer header, axe `target-size` failure and fix, co-located markers at max zoom, zoom-control vs Kit router, keyboard focus, `url.searchParams` on a prerendered page, `svelte-check` 0 errors.
- Leaflet 1.9.4 package source (`dist/leaflet-src.esm.js`): module-top `window`/`navigator` reads, `innerHTML` sinks (popup content, DivIcon html, attribution), marker `role="button"`/`tabindex`/`title` handling, tile `alt=""`, no `referrerPolicy` option.
- `@sveltejs/kit` 2.70.3 source: `src/utils/url.js` `disable_search` (throws during prerender); `src/core/config/options.js` default `prerender.entries: ['*']`; `src/core/postbuild/prerender.js` `'*'` expansion.
- npm registry (2026-10-04): leaflet 1.9.4 (latest) / 2.0.0-alpha.1; leaflet.markercluster 1.5.3 (2022); supercluster 9.1.0 (2026-09-03); @types/leaflet 1.9.22; layerchart 2.5.1; dexie 4.4.6; fake-indexeddb 6.2.5; date-fns 4.4.0; kdbush 4.1.0.
- [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/): single tile URL, attribution "© OpenStreetMap contributors" linking to /copyright, valid Referer for websites, no bulk/prefetch/offline, caching, blocking without notice, commercial-use caveat.
- [OSM Wiki: Blocked tiles](https://wiki.openstreetmap.org/wiki/Blocked_tiles): referer and attribution blocks, acceptable referrer policies.
- [RentCast GET Rental Listings](https://developers.rentcast.io/reference/rental-listings-long-term): params, `limit` 1-500, `daysOld`, case-sensitive city/state, radius ≤ 100.
- [RentCast listing schema](https://developers.rentcast.io/reference/property-listings-schema): fields, `history` structure, `listingAgent`/`listingOffice`, enums.
- [RentCast 2025-08 query engine changelog](https://developers.rentcast.io/changelog/api-release-2025-08): `min:max` ranges, `|` multi-values.
- [RentCast Market Statistics](https://developers.rentcast.io/reference/market-statistics): zip-only, `rentalData`, `dataByBedrooms`, `history`.
- [RentCast Rent Estimate](https://developers.rentcast.io/reference/rent-estimate-long-term): params, `compCount` 5-25 (default 15), comps fields.
- [RentCast Rental Listing by Id](https://developers.rentcast.io/reference/rental-listing-long-term-by-id): `/listings/rental/long-term/{id}`, case-sensitive ids.
- [CARTO Basemaps FAQ](https://docs.carto.com/faqs/carto-basemaps): API key now required, 2026-09-23 terms.
- [CFPB: What is a debt-to-income ratio?](https://www.consumerfinance.gov/ask-cfpb/what-is-a-debt-to-income-ratio-en-1791/): definition; thresholds vary by lender.

### Secondary (MEDIUM confidence)
- [HUD USER PD&R Edge: Rental Burdens](https://www.huduser.gov/portal/pdredge/pdr_edge_featd_article_092214.html) and [Census 2024 release](https://www.census.gov/newsroom/press-releases/2024/renter-households-cost-burdened-race.html): >30% of income on housing = cost-burdened, >50% severe.
- [Leaflet PR #9883](https://github.com/Leaflet/Leaflet/pull/9883) (superseded by #9897): tile `referrerPolicy` default in the 2.x line, not 1.9.4.
- Project research `.planning/research/{FEATURES,ARCHITECTURE,PITFALLS}.md` (RentCast field coverage, F2 no exposed headers, F4 fetch-wide).

### Tertiary (LOW confidence)
- Zillow `/homes/{address}_rb/` URL pattern (undocumented; keep as data).
- RentCast `*` open bounds; `dataByBedrooms` max bucket; subject listing in own comps — verify in Phase 4's real-key HUMAN-UAT.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions from the registry; Leaflet/supercluster built and tested in this repo's toolchain.
- Architecture: MEDIUM-HIGH — mechanics verified; upstream Phase 3/4/5 contracts are planned but unexecuted (gaps listed in Open Questions).
- Pitfalls: HIGH for map/CSP/routing/E2E (observed in the spike); MEDIUM for RentCast data-quality items.

**Research date:** 2026-10-04
**Valid until:** 2026-11-03 (30 days; re-check Leaflet 2.0 status and OSM policy if planning slips)
