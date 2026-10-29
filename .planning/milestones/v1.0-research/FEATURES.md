# Feature Research

**Domain:** Nationwide-US real-estate go-to-market SaaS — three portals (Renters, Investors, Agents) on a static, browser-only, bring-your-own-key architecture
**Researched:** 2026-09-13
**Confidence:** MEDIUM-HIGH overall (data-source constraints verified against RentCast docs and a live CORS probe = HIGH; competitor feature sets = MEDIUM, from vendor pages plus 2026 reviews; extension/Zillow ToS posture = LOW)

---

## 0. Constraint Findings That Reshape the Feature List (read first)

These verified facts decide which "expected" features are possible, degraded, or impossible in v1. Requirements should reference them directly.

| # | Finding | Evidence / Confidence | Feature impact |
|---|---------|----------------------|----------------|
| C1 | **RentCast API accepts direct browser calls.** Preflight to `api.rentcast.io` returns `access-control-allow-origin: *` and allows the `x-api-key` header. | Live `OPTIONS` probe from origin `https://wolfwdavid.github.io`, 2026-09-13 — HIGH | The BYOK, no-backend model works for all RentCast features. No proxy needed. |
| C2 | **Free Developer plan = 50 requests/month, with a "small overage fee" beyond 50.** One request counts once no matter how much data it returns (listings up to `limit=500`). Non-200 responses are not billed. | RentCast billing docs — HIGH | Every data feature must be designed around a **shared 50-call monthly budget**. Because overage is billed, the app needs a local budget meter and a **hard cap that is on by default**. |
| C3 | **RentCast listings have NO photos, NO listing URL, NO description/remarks, NO amenities, NO pet policy, NO availability date.** They do have: address, lat/long, property type, beds, baths, sqft, lot, year built, HOA fee, status (Active/Inactive), price, listedDate/removedDate/lastSeenDate, daysOnMarket, MLS name/number, **listingAgent and listingOffice name/phone/email/website**, and a dated price/event `history`. | Listing schema, full field list — HIGH | Renter "availability" filter and pet/amenity filters are **impossible**. Photo-first listing cards are **impossible**. Outreach drafts **are** feasible (agent/office email and phone exist). Price-drop and "likely rented" signals **are** feasible (`history`, `removedDate`, `lastSeenDate`). |
| C4 | **Rental listing filters:** city/state/zip, lat/long + radius (≤100 mi), propertyType (multi), bedrooms/bathrooms/sqft/lotSize/yearBuilt/price (ranges), status, `daysOld` (ranges). | Rental listings endpoint docs — HIGH | Saved-search filters must map to exactly these fields. "Listed in the last N days" (`daysOld`) is the honest stand-in for "available now". |
| C5 | **Rent estimate** returns rent, low/high range, and 5–25 comparables sorted by correlation, with distance and days old. It needs a full address or lat/long; for multi-family it estimates **one unit**. | Rent estimate endpoint docs — HIGH | Fair-rent check can show *why* (comps), not just a number. Costs 1 call per listing checked. |
| C6 | **Market statistics is ZIP-only** (`zipCode`, `dataType` All/Sale/Rental, `historyRange` in months). It returns average/median rent and price, per-sqft figures, days on market, new/total listings, broken down by property type and bedroom count, plus month-by-month history. | Market statistics endpoint docs — HIGH | One call gives a full zip dashboard with trend history, and price-to-rent comes from the same call. **Metro/city dashboards are impossible** without aggregating many zips (budget-prohibitive). Zip medians by bedroom are a **zero-extra-call "quick fair-rent signal"** for every listing in that zip. |
| C7 | **RentCast API Terms, Section 1** permit displaying, distributing, and reselling API Data to third parties (subject to restrictions), and Section 3.4 says **no attribution is required**. The Preamble says the **API key is confidential and must not be transferred to third parties.** | rentcast.io/terms-api — MEDIUM-HIGH (quoted clauses) | Corrects a PROJECT.md assumption: redistribution is *not* forbidden. The binding rule is key confidentiality: **never ship a shared or embedded "demo key"**. Demo mode should still use synthetic fixtures (cleaner story, no key, no stale real addresses). |
| C8 | **Web3Forms free plan = 250 submissions/month**, delivered by email. Its **Submissions API (reading submissions back) is Pro-only.** Formspree free = 50/month. | Web3Forms docs (Submissions API marked PRO); 2026 comparison pages — MEDIUM-HIGH | The agent **"lead inbox" cannot automatically pull leads into the app** on the free tier. Leads land in the agent's **email**. The in-app inbox must be degraded to "paste/import lead from email" or manual entry. Recommend Web3Forms over Formspree (5x the free headroom). |
| C9 | **HUD's April 2024 guidance on Fair Housing Act digital advertising was withdrawn** (effective 2025-09-17, Federal Register notice 2026-04-06). **The Fair Housing Act itself, including §3604(c) on discriminatory advertising statements, is unchanged.** | Federal Register 2026-06624; NAA; NLIHC — HIGH | Removing guidance does not remove liability. Fair-housing-safe copy stays a hard requirement, and the product should say it follows the statute rather than cite withdrawn guidance. |
| C10 | **State license-law advertising rules** (e.g., FL, NJ, OH, CA) require the brokerage name, and in some states a license number, on real-estate ads **including social media and web pages**. | State regulations / Realtor association pages — MEDIUM | The Agent content studio and market reports need an **agent/brokerage disclosure profile** that is appended automatically. |
| C11 | **HUD USER FMR API** allows browser calls (`Access-Control-Allow-Origin: *`) and uses a free bearer token. Small Area FMRs are zip-level. The API itself returns FMR-area values, so a zip needs HUD's crosswalk. | Live `OPTIONS` probe (HIGH); HUD USER docs (MEDIUM) | Optional **second, free, government rent benchmark** for fair-rent checks and dashboards. Does not use RentCast budget. v1.x candidate. |
| C12 | **Zillow sells top-of-search rental placement** ("Zillow Boost" ranks ads at the top; "Listing Spotlight"; "featured search cards" in Premium/Signature packages). | Zillow Rentals Network pages; HousingWire — HIGH | Confirms the hider extension addresses a real, documented problem. Only DOM hiding on pages the user is already viewing is defensible. Zillow ToS text could not be fetched (403), so ToS posture = **LOW confidence**. |
| C13 | **Chrome Web Store policy update (enforced 2026-08-01):** collected data must be strictly necessary to the extension's single disclosed purpose, and all collection must be prominently disclosed. | developer.chrome.com policy blog — HIGH | The extension must collect **zero data** (no analytics, no remote config) to stay simple to publish. |
| C14 | **LLM keys in the browser:** Anthropic supports CORS with the `anthropic-dangerous-direct-browser-access` header; OpenAI's SDK needs `dangerouslyAllowBrowser`. Google advises **against** client-side Gemini keys and will reject "Standard" keys from September 2026 (auth keys only). | Anthropic header (MEDIUM, 2024 source); OpenAI SDK docs (HIGH); Google API-key docs (HIGH) | BYOK LLM works for Anthropic and OpenAI. **Gemini BYOK from the browser is uncertain (LOW)** and should be verified in the stack phase; ship it last or mark it experimental. |
| C15 | **Free, privacy-friendly analytics:** Umami Cloud Hobby = 100k events/month, 3 sites, cookieless, custom events, no card. Cloudflare Web Analytics = free and cookieless but **no custom events or funnels**. GoatCounter's free hosted tier is **non-commercial only**. | privacytools.io, klymentiev.com 2026 reviews — MEDIUM | Use **Umami Cloud** so GTM funnel events (demo started, key added, first result) can be tracked. Avoid GoatCounter for a commercial product. |

### RentCast budget math (drives several requirements)

| Action | Calls | Notes |
|--------|-------|-------|
| Re-run one saved search / buy-box (≤500 results) | 1 | Only if the cache is older than the TTL |
| Market dashboard for one zip (sale + rental + 12-month history) | 1 | Cache ~30 days; market stats change monthly |
| Deep fair-rent check (rent estimate + comps) | 1 | Per listing |
| Deal analyzer autofill (rent estimate + value estimate) | 2 | Property record adds taxes (+1). Manual entry = 0 |
| Agent market report (1 zip stats + 1 sale-listings pull) | 2 | |
| Invalid key / error response | 0 | Not billed (C2) |

Example month for **one** user: 2 saved searches refreshed every 3 days (≈20) + 5 deep fair-rent checks (5) + 3 zip dashboards (3) + 5 deal autofills (10) = **38 calls**. Daily auto re-run of 2 searches alone would be 60 calls and exceed the cap. **So "re-run on app open" must be TTL-gated and budget-aware, not unconditional.** All three portals share one key and one budget.

---

## 1. Platform (Shared)

### Table Stakes

| Feature | Why Expected | Complexity | v1 Status | Notes |
|---------|--------------|------------|-----------|-------|
| Landing page + per-audience marketing pages (Renters / Investors / Agents) | Every competitor has audience-specific entry points; visitors must self-select in seconds | LOW | In scope | Prerendered static pages; also the SEO surface (see §5) |
| Portal routing + persistent portal switcher | Users often belong to two audiences (renter who invests; agent who invests) | LOW | In scope | |
| **Demo mode with realistic sample data (no key)** | Most visitors will never create a RentCast account on the first visit. Without a demo, bounce rate is near-total | MEDIUM | In scope | Synthetic fixtures shaped like RentCast responses, clearly labeled "Sample data". Covers every portal feature end-to-end. **Never an embedded real key (C7)** |
| BYOK settings: RentCast key + LLM key, stored only in this browser | Required by the architecture; users must trust where the key goes | LOW | In scope | Show exactly which domains receive each key. Provide a "Forget keys" button |
| Guided key onboarding ("Get a free RentCast key in 3 steps") | The key is the biggest activation drop-off | LOW | In scope (implied) | Validate lazily on the first real request (401 is not billed, C2) rather than spending a call on a "test" request |
| **API budget meter + default-on hard cap** | Overage is billed to the user's RentCast account (C2); a surprise charge destroys trust | MEDIUM | **MISSING — add** | Local counter per calendar month plus a per-feature cost preview ("This uses 1 of your 38 remaining calls"). Local only: it cannot see calls made outside the app, so say so and let users adjust the count |
| **Response cache with "data as of" timestamps and TTLs** | Protects the budget; users need to know data freshness | MEDIUM | In scope (shared data layer) | IndexedDB. TTLs: searches 72h (user-adjustable), market stats 30d, estimates 14d |
| **Local data export/import (JSON backup)** | Browser-only storage is lost when site data is cleared or the device changes. CRM, deals, and saved searches must be recoverable | LOW | **MISSING — add** | One-click full backup and restore, plus a nudge when data exists but no backup has been made in 14 days |
| Clear error and empty states (401 bad key, 429, cap reached, no results, LLM refusal) | BYOK apps fail in ways users can't diagnose | LOW | **MISSING — add** | |
| Mobile-responsive, WCAG AA | Majority of rental search is mobile; project constraint | MEDIUM | In scope | |
| Legal pages: privacy (no data collected; analytics disclosed), terms/disclaimers (not a brokerage, not financial/legal advice, data provided by third parties), Fair Housing statement | Real-estate + finance + AI products are expected to disclose; also protects the owner | LOW | **MISSING — add** | Required before any public GTM push |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "No account, your keys, your data never leaves your browser" positioning | Zillow, Apartments.com, and CRMs monetize user data and leads. Privacy by architecture is a credible, rare claim | LOW | Turns a constraint into a headline. Only claim it if analytics are cookieless and send no PII |
| Warm editorial brand (serif, cinematic imagery) | Competitors are utilitarian (DealCheck, FUB) or ad-dense (Zillow, Apartments.com) | MEDIUM | Design-system work, front-loaded |
| Cross-portal handoffs (renter/investor "Talk to an agent" → agent's lead form; investor deal → agent-ready memo) | One platform, three audiences is the structural moat; single-audience competitors can't do this | MEDIUM | Limited by C8 (see Agent lead inbox) |
| Transparent cost preview on every data action | Nobody else shows "this costs 1 call"; it builds trust in BYOK | LOW | Reuses the budget meter |

### Anti-Features (Platform)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Shared "demo" RentCast key embedded in the site | Removes onboarding friction | Violates key confidentiality (C7); public repo means anyone can drain the key; 50 calls would be gone in minutes | Synthetic fixture demo + guided key setup |
| Cloud sync / accounts "just for backup" | Users fear data loss | Needs a backend and auth, which are out of scope; privacy promise breaks | JSON export/import; optional "save backup to my own Drive/Dropbox" is v2 |
| Unconditional auto re-run on every app open | "Alerts" feel live | Exhausts 50 calls in days (budget math above) | TTL-gated re-run, manual "Refresh (1 call)" button, and a visible budget |
| Server/cron email alert digests | Matches Zillow/Zumper push alerts | No backend in v1 | Check-on-open plus `.ics` calendar reminder "Check Tran for new rentals" (zero infra) |
| Third-party tracking pixels (Meta/Google Ads) | Growth marketing | Conflicts with the privacy positioning; consent-banner burden | Cookieless Umami events + UTM parameters |

---

## 2. Renter Portal

**Competitor baseline (Sept 2026):**
- Zillow Rentals: saved searches with new-listing notifications synced across web/app, draw-on-map search, amenity filters (laundry, parking, pets), Rent Zestimate, renter profile, amenity overlays, full fees/lease-term details.
- Zumper: instant apply, fast push alerts, credit building, paid 24h holds.
- HotPads: map-first, draw boundaries, rent heat maps, transit/commute overlays.
- Apartments.com: deep metro coverage, affordability calculator, price-drop tracking on saved listings, tour scheduling including virtual.

### Table Stakes

| Feature | Why Expected | Complexity | v1 Status | Notes |
|---------|--------------|------------|-----------|-------|
| Search with filters: location (city/zip/radius), price range, beds, baths, property type | Every rental site | LOW | In scope | Map exactly to C4 params |
| **"Availability" filter** | PROJECT.md lists it; Zillow/Apartments.com show move-in dates | — | **IMPOSSIBLE (C3)** | Replace with **"Listed within N days"** (`daysOld`) + Active status + a "likely still available" heuristic (recent `lastSeenDate`) |
| Pet / laundry / parking / amenity filters | Top renter filters on Zillow | — | **IMPOSSIBLE (C3)** | State plainly: "Amenities aren't in our data source. Ask the landlord; your outreach draft includes these questions." Turn the gap into an outreach feature |
| Results list sortable by newest, price, days on market | Universal | LOW | **MISSING — add** | |
| **Map view of results** | HotPads/Zillow are map-first; renters search by neighborhood/commute | MEDIUM | **MISSING — add** | Leaflet + OpenStreetMap tiles (low volume is within the OSM tile usage policy; attribution required). Lat/long is in the data |
| **Listing detail view** | Universal | LOW | **MISSING — add (implied)** | Facts, HOA, days on market, price history (from `history`), listing agent/office contact, mini map |
| Listing photos | Universal; photo-less listings feel broken | — | **IMPOSSIBLE (C3)** | Graceful alternative: map pin, "Search this address" outbound links (Google Maps / web search URL; no scraping, no embedding) and property-type illustration placeholders in brand style |
| Favorites / shortlist | Universal | LOW | **MISSING — add** | Local storage |
| Saved searches with alerts | Zillow/Zumper/Apartments.com push new matches | MEDIUM | In scope — **degraded** | No push/email. "N new since last visit" by diffing listing `id`s against the last snapshot; TTL- and budget-gated (see budget math) |
| Contact landlord/agent | Universal | LOW | In scope (via AI outreach) | `mailto:` / `tel:` / `sms:` links pre-filled; the human sends |
| Rent estimate / is this a fair price | Zillow shows Rent Zestimate | MEDIUM | In scope (fair-rent check) | See differentiators for the version that goes beyond Zillow |
| Affordability calculator (income → max rent; 30% rule, 40x-rent landlord rule) | Apartments.com has one; renters ask it first | LOW | **MISSING — add** | 0 API calls; also a strong SEO page |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Fair-rent check with comps and range** (two tiers) | Zillow gives one opaque number. Tran shows the range and the 5–25 nearest comps with distance, which renters can use when negotiating | MEDIUM | **Quick signal (0 extra calls):** compare asking rent with the zip median for that bedroom count from cached market stats (C6). **Deep check (1 call):** rent estimate + comps (C5). Optional HUD SAFMR benchmark in v1.x (C11) |
| **AI outreach drafts (human sends)** | Competitors offer a generic "I'm interested" form. Tran drafts a personal, specific message that asks the questions the data can't answer (availability date, pets, parking, fees, lease terms) | MEDIUM | Uses `listingAgent`/`listingOffice` email/phone. Delivered as copy button + `mailto:` link. Renter profile (move date, household size optional, income optional) stays local |
| "Price drop" and "likely rented" badges | Apartments.com tracks price drops on saved listings; nobody explains *stale* listings | LOW | From `history` events, `removedDate`, `lastSeenDate`, and diffs between snapshots |
| Rental scam red-flag hints | Rental scams are a major renter fear. Tran can flag "asking rent X% below the estimate" and add safety tips (never wire deposits before a verified showing) | LOW | Depends on fair-rent check. Wording must be advisory, never accusatory about a specific landlord |
| **Zillow sponsored-listing hider (browser extension)** | Directly answers the origin story: Zillow sells top-of-search placement (C12). No competitor offers this | MEDIUM (build) / **HIGH (maintenance)** | Separate deliverable: MV3 content script, CSS/DOM hiding only on pages the user loads, zero data collection (C13), toggle + count of hidden cards. Zillow DOM changes will break selectors, so ship with a selector-update process. ToS posture LOW confidence: needs a legal-risk note, and it should not be a v1 launch blocker |
| Application-status tracker on shortlist (Contacted → Toured → Applied → Signed) | Renters juggle 10+ listings in spreadsheets | LOW | Local; pairs with outreach drafts |

### Anti-Features (Renter)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Rental applications, tenant screening, credit checks | Zumper/Zillow offer them | FCRA/PII handling, needs a backend, liability | Link out; the outreach draft asks "how do you accept applications?" |
| Neighborhood crime/"safety" scores, demographic or "good area" labels, "family-friendly" tags | Popular with renters | Steering risk under the Fair Housing Act (C9); the AI must not characterize residents | Objective, non-demographic facts only: distance, transit links, price trends |
| Scraping Zillow/Apartments.com for photos or missing fields | Fills the C3 data gaps | Violates ToS; explicit project constraint | Outbound "search this address" links; the extension only hides, never reads/exports |
| Auto-sending outreach to landlords | "Apply to 20 listings in one click" | CAN-SPAM/reputation risk, explicit constraint; RentCast Terms §2(iv) bars unsolicited commercial email via API data | Draft + copy/`mailto:` only |
| In-app chat with landlords | Feels modern | Needs a backend; landlords won't install anything | Email/SMS deep links |
| Rent payment, deposits, 24h holds | Zumper Select | Money transmission, backend | Out of scope |
| Landlord reviews | Renters want them | Defamation/moderation burden, needs a backend | Out of scope |

---

## 3. Investor Portal

**Competitor baseline (Sept 2026):**
- DealCheck: cap rate, CoC, DSCR, ROI, ROE, IRR, GRM, rent-to-value, break-even; 35-year projections; buy & hold, BRRRR/rehab, flips, STR, house hacking; PDF reports; RentCast-powered autofill.
- Mashvisor: property finder with estimated CoC/cap rate per listing, heatmaps, neighborhood scores, STR focus ($17.99–$49.99/mo).
- BiggerPockets calculators: full expense line items (taxes, insurance, utilities, repairs, capex, management, HOA, vacancy), shareable reports.
- Roofstock: marketplace with inspection/title reports and ROI calculators.
- RentCast app: zip rent trends, rent comps, branded PDF reports on Pro.

### Table Stakes

| Feature | Why Expected | Complexity | v1 Status | Notes |
|---------|--------------|------------|-----------|-------|
| Deal analyzer inputs: price, closing costs, rehab, down payment, rate, term, rent, full expense line items (taxes, insurance, vacancy %, maintenance %, capex %, management %, HOA, utilities) | DealCheck/BiggerPockets baseline; missing lines mean untrustworthy math | MEDIUM | In scope | Sensible defaults (vacancy 5–8%, maintenance/capex 5–10% each, management 8–10%) that users can edit. Label them as assumptions |
| Core metrics: monthly/annual cash flow, NOI, cap rate, cash-on-cash | Universal | LOW | In scope (cap rate, CF, CoC) | Add **NOI** explicitly |
| **DSCR** | Lenders qualify DSCR loans on it; DealCheck and every 2026 analyzer shows it | LOW | **MISSING — add** | Named in the brief; not in PROJECT.md |
| GRM, 1% rule, 50% rule, break-even occupancy | Quick screens investors expect | LOW | **MISSING — add** | Pure math |
| Manual entry mode (0 API calls) + optional autofill from address | Budget reality (C2); investors often have their own numbers | LOW | **MISSING — add** | Autofill = rent estimate + value estimate (2 calls); property record for taxes (+1) |
| Save, rename, and compare deals side-by-side | DealCheck core workflow | LOW | **MISSING — add** | Local |
| Printable/shareable report | DealCheck/BiggerPockets/RentCast all export | LOW | Partially (via memo) | Print-optimized CSS → "Save as PDF"; no PDF library needed |
| Mortgage payment/amortization | Universal | LOW | Implied | Rate is user input (FRED browser access unverified; treat live rates as v1.x) |
| Property finder / listing search with filters | Mashvisor/DealCheck search | MEDIUM | In scope (via buy-box) | Sale listings endpoint |
| Market data by area | Mashvisor heatmaps, RentCast trends | MEDIUM | In scope (dashboards) | Zip-only (C6) |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Deal-flow alerts on a saved buy-box, with estimated metrics per listing** | DealCheck has no buy-box alerts; Mashvisor charges $50/mo for scored search. Tran shows "3 new listings match your buy-box, 1 clears 8% cap" | MEDIUM-HIGH | **Budget design is critical:** 1 call per buy-box refresh. Per-listing quick metrics use **cached zip median rent by bedroom** (C6), not a rent-estimate call per listing. A "Deep analyze (2 calls)" button promotes a listing into the analyzer. Buy-box = location, price, beds, type, max days on market + a minimum quick-cap-rate threshold applied client-side |
| **Market dashboards per watched zip** | Rent and price trends, price-to-rent, days on market, inventory (new/total listings), by bedroom and property type, from one call per zip with history | MEDIUM | Charts over 12–24 months. Compare up to ~5 watched zips. Not metros (C6). HUD SAFMR overlay in v1.x |
| **AI investment memo** | One click turns an analysis into a lender/partner-ready narrative (thesis, numbers, assumptions, risks, sensitivity). DealCheck reports are tables with no narrative | MEDIUM | **Numbers are computed deterministically in code and passed to the LLM, which only narrates.** The LLM never does the math. Memo must list assumptions and data dates and carry a "not investment advice" disclaimer |
| Sensitivity sliders (rent ±, rate ±, vacancy ±, price ±) with live metric updates | Answers "what has to be true for this to work?" | LOW | Pure client math; feeds the memo's risk section |
| Shareable deal link (state encoded in URL fragment) | Share with a partner without accounts or servers | LOW-MEDIUM | Compressed JSON in `#hash` (never sent to the server). Includes inputs and computed results, not raw RentCast payloads, to keep links small |
| Rent-vs-market sanity check inside the analyzer | Flags pro-forma rent that is above the rent estimate range, a classic rookie mistake | LOW | Reuses fair-rent logic |

### Anti-Features (Investor)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Short-term rental (Airbnb) revenue projections | Mashvisor/DealCheck headline feature | RentCast is long-term rent only; STR data needs AirDNA-class paid sources; fabricated numbers kill credibility | Manual STR inputs in v2; say "long-term rentals" plainly |
| "Best neighborhoods to invest" rankings using demographics, crime, or school scores | Mashvisor neighborhood scores | Demographic proxies create steering/disparate-impact exposure and misleading AI narratives (C9) | Rank watched zips only on objective market metrics (yield, rent growth, days on market) the user chooses |
| Buy/sell "recommendations" or projected guaranteed returns | Users want a verdict | Advice liability; misleading | Show metrics vs the user's own thresholds ("meets your buy-box"), with disclaimers |
| Owner lookup / skip tracing / off-market direct-mail lists | PropStream/DealMachine staple | TCPA/CAN-SPAM exposure, PII, budget cost; turns Tran into a lead-gen spam tool | Out of scope v1 |
| Syndication, crowdfunding, or deal marketplace | Roofstock-style | Securities law, backend, escrow | Out of scope |
| Portfolio tracking with bank/loan account linking | Stessa-style | Backend, Plaid costs, PII | Manual "My properties" list in v2 |
| Metro/city-level dashboards | Investors think in metros | Zip-only API (C6); aggregating dozens of zips burns the budget | Watched-zip comparison; explain the scope |

---

## 4. Agent Portal

**Competitor baseline (Sept 2026):**
- Follow Up Boss: lead routing by source, Smart Lists, Action Plans (automated email/text drips), pipeline, tasks/reminders, calling/texting. AI features: smart summaries (beta), smart messages, suggested tasks, predictive lead prioritization, at no extra charge.
- BoldTrail (formerly kvCORE): IDX sites, AI drips, "draft my next reply" (now table stakes), behavior-based surfacing.
- Lofty: AI ISA, IDX, dialer, and an "Agentic Operating System" (Feb 2026).
- RPR (free to Realtors): AI CMA, branded 20+ page reports, dynamic report links refreshing every 48h.
- Cloud CMA: branded CMAs, buyer tours, Homebeat automated home-value nurture.
- AI listing tools (ListingAI, Write.Homes, EstatePass): **fair-housing compliance scanners that suggest alternative wording are standard.**

### Table Stakes

| Feature | Why Expected | Complexity | v1 Status | Notes |
|---------|--------------|------------|-----------|-------|
| Contacts/leads with source, stage, tags, notes, activity log | Every CRM | MEDIUM | In scope (local CRM) | IndexedDB |
| Pipeline/stage view (New → Contacted → Nurture → Active → Under contract → Closed) | FUB/BoldTrail/Lofty baseline | MEDIUM | **MISSING — add** | Kanban or grouped list; must work on mobile |
| Search, filter, and saved "smart lists" (e.g., "no contact in 7 days") | FUB Smart Lists are the core daily workflow | LOW-MEDIUM | **MISSING — add** | Client-side queries |
| Tasks and follow-up reminders | Universal | LOW | In scope — **degraded** | No push/background. Shows a "Due today" queue on open. **Add `.ics` export** so reminders reach the agent's real calendar (0 infra) |
| Lead capture from website forms | Every CRM ingests web leads | MEDIUM | In scope — **degraded (C8)** | Web3Forms delivers to email; the app can't read submissions on the free tier. Alternatives below |
| AI reply/follow-up drafts | "Now table stakes" per BoldTrail's own 2026 comparison | MEDIUM | In scope | Draft uses the lead's notes/stage; delivered via copy, `mailto:`, `sms:` |
| AI listing descriptions | Many free tools exist; agents expect it | LOW-MEDIUM | In scope | Inputs are property facts the agent types. Tran has no MLS remarks or photos |
| **Fair-housing compliance check on generated copy** | ListingAI/EstatePass ship it; its absence would be a red flag to brokers | MEDIUM | **MISSING — add (must-have)** | Two layers: (1) system prompt constrains the model to describe the property, not people; (2) a **deterministic lint pass** over output (and pasted text) flagging protected-class and steering terms with suggested rewrites. Run it on every AI output across all portals |
| Branded market reports, exportable | RPR (free) and Cloud CMA set the bar | MEDIUM | In scope — **degraded** | Zip market stats + active sale/rental listings. **Not a CMA**: no MLS closed-sale comps. Label it "Market Snapshot". Print-to-PDF with agent branding |
| **Agent profile: name, brokerage, license #, state, logo/headshot, colors, contact** | Needed by reports, content, and forms. State ad rules require brokerage (and in some states license #) disclosure (C10) | LOW | **MISSING — add** | Auto-append disclosure to generated social posts and reports |
| CSV import/export of contacts | Agents migrate from FUB/spreadsheets; data-loss fear with local storage | LOW | **MISSING — add** | Covered partly by platform JSON backup; CSV is the agent-native format |

### Lead inbox under C8: recommended graceful design

1. **Shareable lead-capture page generator (differentiator).** The agent enters a Web3Forms access key (designed to be public in client HTML) and gets a Tran-hosted URL (e.g., `/agent/form#config`) with branded fields (buying/renting/investing, timeline, budget). Submissions email the agent. No backend.
2. **"Import lead from email"**: paste the notification email → deterministic parser (fixed field labels in the form) creates a CRM contact. LLM parsing is a fallback only.
3. **Manual quick-add** for phone/walk-in leads.
4. Renter/investor portal "Talk to an agent" CTAs post to the **founder's/demo agent's** form in v1. There is **no agent directory or routing** (it would need accounts).

Speed-to-lead notification is covered by the email itself, so the app should not pretend to notify.

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Founder-story video script generator** (hook → manual pain → before/after moment → results → mission → CTA, ~60s) | No CRM offers structured short-form personal-brand scripts; directly modeled on the reference reel | LOW-MEDIUM | Output: timed beats, on-screen caption lines, B-roll shot list. Fair-housing lint applies |
| Social post pack from one listing or market snapshot (IG/FB/LinkedIn variants + hashtags + disclosure line) | Saves repetitive rewriting; auto-appended brokerage disclosure (C10) is rare in cheap tools | LOW | |
| **Fair-housing linter as a standalone free tool** | Useful to every agent, even non-users; top-of-funnel SEO page | LOW | Same engine as the content studio; zero API cost |
| Market snapshot reports with an AI-written "what this means for buyers/sellers" narrative | RPR is free but Realtor-only and MLS-bound; Tran works for any licensee/team and reads like editorial content | MEDIUM | Numbers computed in code; the LLM narrates. Data date stamp; "not an appraisal" |
| AI follow-up suggestions from stage + last-contact age ("3 leads went quiet; here are drafts") | FUB charges platform prices for AI nurture; Tran does it locally with the user's key | MEDIUM | Runs on open over local data; the human sends each message |
| Calendar (`.ics`) follow-up export | Solves "no background reminders" with zero infrastructure | LOW | |

### Anti-Features (Agent)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| IDX/MLS listing search on agent sites | kvCORE/Lofty core | No MLS authorization (explicit out of scope); displaying RentCast MLS-sourced listings *as IDX* misrepresents | Market snapshots with aggregate stats; link to the agent's brokerage site |
| Automated drip campaigns / auto-sent email & SMS (Action Plans) | FUB's signature feature | No backend; CAN-SPAM/TCPA (SMS consent) exposure; explicit constraint | Suggested drafts + reminders; human sends |
| Autonomous "AI ISA" that converses with leads | Lofty 2026 headline | Unsupervised AI talking to consumers = fair housing and license-law exposure; backend required | Drafts only |
| Calling as "CMA" or "valuation/appraisal" | Agents want CMA replacement | No closed-sale MLS comps; misleading to consumers | "Market Snapshot" naming + disclaimer |
| AI copy describing neighborhoods by residents, "ideal buyer," schools/churches as audience signals | AI tools produce it by default | §3604(c) statements indicating preference (C9) | Property-feature-only prompts + linter |
| Unlabeled AI-altered listing imagery / virtual staging | Popular AI add-on | MLS/state rules on digitally altered photos vary (LOW confidence); misrepresentation risk | Out of scope v1 |
| Buying leads, FSBO/expired scraping, contact enrichment | Lead-gen staple | Scraping ban; TCPA; PII | Shareable lead-capture page |
| Multi-agent team routing, ponds, admin dashboards | Brokerage feature | Needs accounts/backend | v2 with backend |

---

## 5. GTM Features for the Free Demo

| Feature | Category | Complexity | Notes |
|---------|----------|------------|-------|
| Audience landing pages with a clear "Try the demo — no signup" CTA | Table stakes | LOW | Primary CTA = demo, secondary = add a key |
| **Sample-data demo mode across all portals** | Table stakes | MEDIUM | Same as Platform; the whole GTM depends on it |
| First-run onboarding: choose portal → 30-second tour → "Try with sample data" / "Connect free key" | Table stakes | LOW-MEDIUM | Three screens max; skippable |
| **Waitlist / interest capture** ("Get email alerts & sync when accounts launch") | Table stakes for validation | LOW | Web3Forms to the founder inbox (250/mo free, C8). Tagged by portal and feature interest, which is the demand signal for paid v2 (email digests, sync, more data) |
| Privacy-friendly analytics with funnel events | Table stakes | LOW | Umami Cloud Hobby (C15). Events: portal_selected, demo_started, key_added, first_search, first_analysis, memo_generated, draft_copied, report_exported, waitlist_joined. Never send addresses, keys, or lead data |
| Prerendered SEO pages for **evergreen, zero-API tools**: rent affordability calculator, cap rate / cash-on-cash / DSCR calculators, fair-rent explainer, fair-housing listing-copy checker, "how to spot rental scams", founder-story script template | Differentiator (acquisition) | MEDIUM | High-intent search terms, no data or budget cost, work fully without a key, and funnel into portals. Per-page titles, meta descriptions, OG images, sitemap.xml, JSON-LD (`SoftwareApplication`, `FAQPage`) |
| Shareable artifacts: deal links (URL fragment), exported memos/reports with a subtle "Made with Tran Real Estate" footer, AI outreach "share this tool" | Differentiator (viral loop) | LOW-MEDIUM | Every export is a distribution channel; the agent-branded report footer must be removable for professionalism |
| Feedback widget ("What's missing?") → Web3Forms | Table stakes for an early demo | LOW | Shares the form quota; set a per-form budget |
| Social proof slots (testimonials, "used in N zips" counters) | Expected on SaaS landing pages | LOW | **Do not fabricate.** Leave empty or omit until real; no fake metrics |
| Public changelog / roadmap page | Differentiator (trust) | LOW | Shows momentum toward accounts/email alerts |

**GTM anti-features:** programmatic "rentals in [city]" SEO pages filled with RentCast data (thin/duplicate content risk, would burn the owner's key at build time, and goes stale); dark-pattern email gates on the demo; cookie-based ad retargeting.

---

## Feature Dependencies

```
[BYOK Settings + Key Onboarding]
    └──requires──> [Local Storage Layer (IndexedDB) + JSON Export/Import]

[RentCast Client: cache + TTL + budget meter + hard cap]
    └──requires──> [BYOK Settings]
    └──enables──> every live-data feature below

[Demo Fixtures (RentCast-shaped synthetic data)]
    └──substitutes-for──> [RentCast Client] (same interface; must be built with the client, not after)

[LLM Client (Anthropic/OpenAI; Gemini experimental)]
    └──requires──> [BYOK Settings]
[Fair-Housing Linter (deterministic) + Safe Prompt Library]
    └──gates──> ALL AI output: outreach drafts, investment memo, listing copy, social, scripts, report narrative, follow-ups

[Market Stats per Zip (cached 30d)]
    ├──enables──> [Renter Quick Fair-Rent Signal] (0 extra calls)
    ├──enables──> [Investor Buy-Box Quick Metrics] (0 extra calls)
    ├──enables──> [Investor Market Dashboards]
    └──enables──> [Agent Market Snapshot Report]

[Rental Listings Search] ──> [Saved Searches + "N new since last visit" (snapshot diff)]
                         ──> [Listing Detail] ──> [Deep Fair-Rent Check (Rent Estimate)]
                                              ──> [AI Outreach Draft] (needs listingAgent/Office + Renter Profile)
                                              ──> [Price-drop / Likely-rented badges] (needs snapshot history)
[Deep Fair-Rent Check] ──enhances──> [Scam Red-Flag Hints]

[Deal Analyzer Math Engine (pure functions, tested)]
    ├──requires──> nothing (manual mode works offline)
    ├──enhanced-by──> [Autofill: Rent Estimate + Value Estimate]
    ├──enables──> [Sensitivity Sliders]
    ├──enables──> [Shareable Deal Link]
    └──enables──> [AI Investment Memo] (LLM narrates computed numbers)
[Sale Listings Search] + [Math Engine] + [Market Stats] ──> [Buy-Box Deal-Flow Alerts]

[Agent Profile / Brand Kit + Disclosure]
    ├──required-by──> [Market Snapshot Report]
    ├──required-by──> [Content Studio outputs]
    └──required-by──> [Shareable Lead-Capture Page]
[Local CRM (contacts, stages, tasks)]
    ├──enables──> [Smart Lists] ──> [AI Follow-up Suggestions] ──> [.ics export]
    └──fed-by──> [Lead-Capture Page → email → Paste-Import Parser] + [Manual Quick-Add]

[Print/PDF Export Stylesheet] ──shared-by──> [Investment Memo] [Market Snapshot] [Deal Report]

[Zillow Sponsored Hider Extension] ── independent (separate package, no shared runtime)

[Umami Analytics events] ──enhances──> all GTM funnels
[Waitlist form] ── independent (Web3Forms)
```

### Dependency Notes

- **The RentCast client and demo fixtures must ship together.** If the demo is bolted on later, every feature gets built against live data and demo mode becomes a second code path full of gaps. Same interface, swappable source.
- **The budget meter precedes any auto-refresh feature.** Saved-search alerts and buy-box alerts are the two features that can silently burn the 50 calls.
- **The fair-housing linter precedes every AI feature.** It is cross-portal infrastructure, not an Agent-only feature; renter outreach and investor memos can also produce steering language.
- **Market stats per zip is the budget multiplier.** One cached call powers renter quick checks, investor per-listing metrics, dashboards, and agent reports. Build it early in the shared data layer.
- **The deal math engine is independent of data** and should be pure, unit-tested functions (cap rate, NOI, CoC, DSCR, GRM, amortization, IRR later). The memo and buy-box alerts depend on it.
- **The agent profile is a hidden prerequisite** for reports, content, and forms (license-law disclosure, C10).
- **Conflict: auto re-run on open vs. the 50-call budget.** They can't both be unconditional; resolve with TTL + cap.
- **Conflict: "no backend" vs. an in-app lead inbox.** Resolve with email delivery + paste-import (C8); don't promise a live inbox.
- **The extension is decoupled.** It can slip to v1.x without blocking the web app.

---

## MVP Definition

### Launch With (v1)

**Platform**
- [ ] Landing + 3 audience pages + portal switcher — entry to the GTM funnel
- [ ] Demo mode with RentCast-shaped synthetic fixtures across all portals — most visitors never add a key
- [ ] BYOK settings + key onboarding + forget-keys — architecture requirement
- [ ] RentCast client with IndexedDB cache, TTLs, "data as of" stamps, **budget meter and default-on hard cap** — prevents overage charges (C2)
- [ ] JSON backup export/import — browser-only data must be recoverable
- [ ] Fair-housing linter + safe prompt library (shared) — gates all AI features (C9)
- [ ] Legal pages (privacy, terms/disclaimers, Fair Housing statement)
- [ ] Umami funnel events + waitlist form

**Renter**
- [ ] Search (C4 filters incl. "listed within N days"), list + map, listing detail with price history
- [ ] Saved searches with TTL-gated "N new since last visit"
- [ ] Fair-rent check: quick zip-median signal + deep comps check
- [ ] AI outreach draft (copy/mailto) that asks for availability, pets, and fees
- [ ] Favorites/shortlist + affordability calculator

**Investor**
- [ ] Deal analyzer: full expense lines, NOI, cap rate, CF, CoC, **DSCR**, GRM, 1% rule; manual + autofill; save/compare
- [ ] Sensitivity sliders
- [ ] Buy-box deal-flow alerts with zip-median quick metrics
- [ ] Watched-zip market dashboards
- [ ] AI investment memo (numbers from code) + print-to-PDF

**Agent**
- [ ] Agent profile/brand kit with brokerage/license disclosure
- [ ] Local CRM: contacts, stages/pipeline, tasks, smart lists, CSV import/export
- [ ] Lead capture: shareable Web3Forms-backed form page + paste-import + manual add
- [ ] AI content studio: listing description, social pack, founder-story script (all linted)
- [ ] AI follow-up suggestions + `.ics` reminders
- [ ] Market Snapshot report (branded, print-to-PDF)

**GTM**
- [ ] 3–5 evergreen zero-API SEO tool pages (affordability, cap rate/CoC/DSCR calculator, fair-housing copy checker)

### Add After Validation (v1.x)

- [ ] Zillow sponsored-listing hider extension — trigger: web app stable; legal-risk note reviewed; selector maintenance plan in place (can ship in parallel if capacity allows, but must not block v1)
- [ ] HUD Small Area FMR overlay (free token, CORS verified) — trigger: users question RentCast estimates
- [ ] Shareable deal links (URL fragment) — trigger: users ask to send analyses to partners
- [ ] Scam red-flag hints — trigger: fair-rent check in active use
- [ ] Live mortgage-rate default — trigger: verify a CORS-friendly, keyless source
- [ ] Gemini BYOK — trigger: browser access with auth keys confirmed (C14)
- [ ] Public changelog + feedback widget iteration

### Future Consideration (v2+, requires backend/accounts)

- [ ] Server-side email/push alert digests — the most-requested renter/investor feature; the waitlist measures demand
- [ ] Accounts + cross-device sync — the data-loss pain point
- [ ] Agent in-app lead inbox with webhooks, routing, agent directory
- [ ] Billing (Stripe) + pooled data plan (removes the BYOK friction)
- [ ] STR analysis with a licensed STR data source
- [ ] Portfolio tracking
- [ ] MLS/IDX, only if a broker sponsor and authorization exist

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Demo mode (fixtures) | HIGH | MEDIUM | P1 |
| BYOK + onboarding | HIGH | LOW | P1 |
| Budget meter + hard cap + cache | HIGH | MEDIUM | P1 |
| JSON backup export/import | HIGH | LOW | P1 |
| Fair-housing linter (shared) | HIGH (risk) | MEDIUM | P1 |
| Legal/disclaimer pages | MEDIUM (risk) | LOW | P1 |
| Renter search + list + detail | HIGH | MEDIUM | P1 |
| Renter map view | MEDIUM | MEDIUM | P1 |
| Saved searches "N new" | HIGH | MEDIUM | P1 |
| Fair-rent check (quick + deep) | HIGH | MEDIUM | P1 |
| AI outreach draft | HIGH | MEDIUM | P1 |
| Affordability calculator | MEDIUM | LOW | P1 |
| Deal analyzer (full metrics incl. DSCR) | HIGH | MEDIUM | P1 |
| Save/compare deals | MEDIUM | LOW | P1 |
| Sensitivity sliders | MEDIUM | LOW | P2 |
| Buy-box deal-flow alerts | HIGH | MEDIUM-HIGH | P1 |
| Zip market dashboards | HIGH | MEDIUM | P1 |
| AI investment memo | HIGH | MEDIUM | P1 |
| Agent profile + disclosures | MEDIUM (risk) | LOW | P1 |
| Local CRM + pipeline + smart lists | HIGH | MEDIUM | P1 |
| Lead-capture page + paste-import | HIGH | MEDIUM | P1 |
| AI content studio (3 generators) | HIGH | MEDIUM | P1 |
| AI follow-ups + .ics | MEDIUM | LOW | P2 |
| Market Snapshot report | HIGH | MEDIUM | P1 |
| Evergreen SEO tool pages | MEDIUM | MEDIUM | P2 |
| Umami events + waitlist | HIGH (GTM) | LOW | P1 |
| Zillow sponsored hider extension | MEDIUM-HIGH | MEDIUM (+HIGH upkeep) | P2 |
| Price-drop / likely-rented badges | MEDIUM | LOW | P2 |
| Shareable deal links | MEDIUM | LOW-MEDIUM | P2 |
| HUD SAFMR overlay | MEDIUM | MEDIUM | P3 |
| Scam red-flag hints | MEDIUM | LOW | P2 |

**Priority key:** P1 = must have for launch; P2 = should have, add when possible; P3 = nice to have.

**Scope warning:** This P1 list is large for one static app. If the roadmap needs to cut, cut **depth per portal** (e.g., content studio ships listing descriptions first; dashboards ship one zip before comparison), not the shared infrastructure (demo fixtures, budget cap, linter, backup). The infrastructure is what makes every portal credible.

---

## Competitor Feature Analysis

| Feature | Market Leader(s) | Tran v1 Approach |
|---------|------------------|------------------|
| New-listing alerts | Zillow/Zumper: push + email, real time | Check-on-open "N new since last visit", TTL/budget gated, `.ics` nudge; email digests = v2 |
| Listing photos & amenities | Zillow/Apartments.com: rich media, amenity filters | Impossible with RentCast (C3); map + outbound "search this address" links; outreach asks the questions |
| Fair rent signal | Zillow Rent Zestimate (single number) | Range + visible comps + zip median by bedroom; HUD SAFMR later |
| Sponsored placement | Zillow Boost / Listing Spotlight rank paid ads first | Browser extension hides them on the user's own view |
| Contacting landlords | Generic inquiry forms | Personalized AI draft, human sends via mailto |
| Deal metrics | DealCheck: dozens of metrics, 35-yr projections, STR | Core long-term metrics incl. DSCR + sensitivity; no STR; projections/IRR v1.x |
| Investment search | Mashvisor: scored property finder, $18–$50/mo | Buy-box alerts with quick metrics from cached zip medians, free with BYOK |
| Investor reports | DealCheck PDF tables | AI narrative memo over code-computed numbers |
| Market data | Mashvisor heatmaps; RentCast zip trends | Watched-zip dashboards with history; no metro rollups |
| CRM core | FUB Smart Lists, Action Plans, routing | Local contacts/pipeline/smart lists; no drips (human sends); no routing |
| AI in CRM | FUB smart messages; BoldTrail reply drafts; Lofty agentic OS | Drafts + follow-up suggestions only; no autonomous outreach |
| Lead capture | IDX sites + portal integrations | Shareable Web3Forms lead page → email → paste-import |
| Listing copy | ListingAI/EstatePass with fair-housing scanners | Same baseline + deterministic linter + auto brokerage disclosure + founder-story scripts |
| Market reports | RPR (free, Realtor-only, MLS, 48h dynamic links); Cloud CMA (MLS CMAs, Homebeat) | "Market Snapshot" (not a CMA), branded print-to-PDF, AI narrative; static, not dynamic |
| Price | FUB/BoldTrail/Lofty $$$/mo; Mashvisor $18–$50/mo; DealCheck freemium | $0 + user's free RentCast tier + user's LLM key |

---

## Sources

**Data source / platform constraints (HIGH unless noted)**
- RentCast API docs index: https://developers.rentcast.io/llms.txt
- RentCast listings schema (full field list, no photos/URL/description): https://developers.rentcast.io/reference/property-listings-schema
- RentCast rental listings params (limit 500, daysOld, radius ≤100): https://developers.rentcast.io/reference/rental-listings-long-term
- RentCast rent estimate (compCount 5–25): https://developers.rentcast.io/reference/rent-estimate-long-term
- RentCast market statistics (zip-only, historyRange): https://developers.rentcast.io/reference/market-statistics
- RentCast billing (1 call per request regardless of size; errors unbilled; overage fee): https://developers.rentcast.io/reference/billing-and-pricing
- RentCast API Terms (Section 1 display/distribute; key confidentiality; §3.4 no attribution): https://www.rentcast.io/terms-api (MEDIUM-HIGH)
- RentCast pricing tiers: https://www.rentcast.io/pricing ; https://www.bnbcalc.com/reviews/rentcast-review-2026 (MEDIUM)
- Live CORS preflight probes to api.rentcast.io and huduser.gov (2026-09-13)
- HUD FMR API / SAFMR: https://www.huduser.gov/portal/dataset/fmr-api.html ; https://www.huduser.gov/portal/datasets/fmr/smallarea/index.html (MEDIUM)
- Web3Forms Submissions API (PRO): https://docs.web3forms.com/getting-started/submissions-api ; free-tier limits: https://splitforms.com/web3forms-pricing ; https://formtorch.com/compare/formspree-free-plan-limits (MEDIUM)
- Gemini API key changes / client-side guidance: https://ai.google.dev/gemini-api/docs/api-key
- Anthropic browser CORS header: https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/ (MEDIUM, 2024)
- OpenAI SDK browser option: https://developers.openai.com/api/reference/typescript
- Chrome Web Store 2026 policy updates: https://developer.chrome.com/blog/cws-policy-updates-2026
- Analytics: https://privacytools.io/app/umami ; https://privacytools.io/app/goatcounter ; https://klymentiev.com/blog/best-free-analytics-2026 (MEDIUM)

**Compliance**
- HUD withdrawal of FHEO guidance incl. 2024 digital advertising guidance: https://www.federalregister.gov/documents/2026/04/06/2026-06624/notification-of-withdrawal-of-fair-housing-and-equal-opportunity-guidance-documents ; https://naahq.org/news/hud-withdraws-fair-housing-related-guidance-documents
- §3604(c) discriminatory advertising: https://www.equalhousing.org/fair-housing-topics/discriminatory-advertising/ ; https://montaic.com/blog/fair-housing-listing-description-rules (MEDIUM)
- State advertising disclosure rules: https://www.floridarealtors.org/law-ethics/library/realtor-advertising-rules-florida ; https://www.law.cornell.edu/regulations/new-jersey/N-J-A-C-11-5-6-1 ; https://codes.ohio.gov/ohio-administrative-code/rule-1301:5-1-02 ; https://www.nar.realtor/legal/risk-management/nar-internet-advertising-policy (MEDIUM)
- Zillow Research data terms (attribution; commercial use requires permission): https://www.zillow.com/research/data/ (MEDIUM). Zillow main ToS could not be fetched (403), so extension ToS posture = LOW

**Competitors (MEDIUM)**
- Zillow Rentals app: https://apps.apple.com/us/app/zillow-rentals/id538946076 ; Zillow paid placement: https://www.zillow.com/rentals-network/boost/ ; https://www.housingwire.com/articles/zillow-rentals-launches-listing-spotlight-feature/ ; https://www.zillow.com/rentals-network/packages/
- Zumper / Apartments.com / HotPads: https://www.rentbottomline.com/blog/best-rental-websites-in-2026-a-complete-guide-for-apartment-hunters ; https://www.apartments.com/rent-affordability-calculator/
- DealCheck: https://dealcheck.io/features/rental-property-calculator/ ; https://help.dealcheck.io/en/collections/1141190-property-analysis-metrics
- Mashvisor: https://www.bnbcalc.com/reviews/mashvisor-review-2026 ; https://www.mashvisor.com/blog/real-estate-heatmap/
- BiggerPockets calculators: https://www.biggerpockets.com/rental-property-calculator ; Roofstock: https://rentalrealestate.com/tools/roofstock/
- Follow Up Boss: https://aiandrealtors.com/review-followupboss ; https://followupace.com/blog/mastering-follow-up-boss-action-plans-automation-secrets-for-busy-agents
- BoldTrail/kvCORE vs Lofty: https://boldtrail.com/blog/kvcore-vs-lofty/ ; https://bounti.ai/blog/ai/ai-for-real-estate-agents-2026-complete-guide
- RPR: https://www.rismedia.com/2026/08/13/rpr-wins-2026-real-estate-analytics-platform-year-proptech-breakthrough/ ; https://blog.narrpr.com/support/rpr-app-ai-cma/
- Cloud CMA: https://www.lwolf.com/engage/cma ; https://realestatetoolkit.ai/tools/cloud-cma/
- AI listing tools with fair-housing checks: https://www.estatepass.ai/best/listing-description-generator/ ; https://thetooljury.com/best-ai-listing-description-writer-for-real-estate-agents/
- Existing Zillow extensions (manual hide only, no sponsored filter found): https://chromewebstore.google.com/detail/zillow-quick-hide/nlpcoafjhhlikkojhagkkipflagidelf

---
*Feature research for: nationwide-US real-estate GTM SaaS (Renters / Investors / Agents), static BYOK v1*
*Researched: 2026-09-13*
