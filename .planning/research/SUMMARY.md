# Project Research Summary

**Project:** Tran Real Estate
**Domain:** Nationwide-US real-estate go-to-market SaaS — one static SvelteKit app with Renter, Investor, and Agent portals, browser-only BYOK (RentCast + LLM keys), $0 hosting, plus a companion MV3 "hide sponsored Zillow listings" browser extension
**Researched:** 2026-09-13
**Confidence:** MEDIUM-HIGH (platform/API mechanics HIGH via live CORS preflights and npm registry; legal/compliance MEDIUM; Zillow ToU and NYU CoStar license text LOW)

---

## Executive Summary

Tran Real Estate is a local-first, bring-your-own-key client application that gives three professional audiences tools over a licensed listing API — with no server. Research confirms the core bet is technically sound: RentCast, Anthropic, OpenAI, Gemini, Web3Forms, and Formspree all accept direct browser calls (live preflights 2026-09-13), so no proxy is required. Experts build this class of app as a **ports-and-adapters client**: pure domain logic (finance math, filter matching, snapshot diffs, fair-housing lexicon) in a DOM-free core package, every billable call funneled through one budget-enforcing gateway, demo fixtures and live providers as interchangeable adapters behind the same interfaces, and every persisted record shaped "sync-ready" so a v2 backend is an adapter swap rather than a rewrite.

The recommended stack is SvelteKit 2.70 (not the Kit 3 RC) + Svelte 5 runes + adapter-static, TypeScript pinned to 6.0.x (TS 7 breaks Kit/svelte-check/typescript-eslint peer ranges), Tailwind v4 `@theme` tokens with shadcn-svelte/bits-ui, Dexie for IndexedDB, Zod at trust boundaries, LayerChart for dashboards, print-CSS PDFs as the primary export path, and a pnpm workspace that also hosts a WXT extension.

The binding constraint is not code but **budget and trust**: RentCast's free tier is 50 calls/month with *no provider-side hard cap* (overage bills the user's card at $0.20/call, final), and the shared `wolfwdavid.github.io` origin would expose browser-stored keys to every sibling Pages site the owner publishes (resolved: dedicated `tranrealestate` GitHub org).

Research overturns several PROJECT.md assumptions (see "Corrections to PROJECT.md" — already applied to PROJECT.md on 2026-09-13). The top risks, in order: (1) surprise RentCast overage charges, (2) key theft via shared origin/XSS, (3) Fair Housing violations in AI-generated copy, (4) three-portal scope creep for a solo $0 build. Each has a concrete mitigation that must land *before* the features that trigger it: a client-side hard cap in the data layer, a dedicated origin plus meta CSP in the foundation phase, a deterministic fair-housing linter in the AI layer ahead of any generator, and a "demo-credible" exit criterion on every portal phase.

---

## Corrections to PROJECT.md

Research contradicts or sharpens the following. All have been applied to PROJECT.md (2026-09-13).

| # | PROJECT.md said | Research says | Requirement / roadmap impact | Confidence |
|---|-----------------|---------------|------------------------------|------------|
| 1 | "RentCast license likely forbids redistribution" | RentCast API Terms §1(iv)-(v) **permit** sublicensing, display, resale, distribution, and storage of API Data; §3.4 requires no attribution. Binding constraints: **(a) key confidentiality** — "The API Key may not be shared with any person or entity for its own independent use" (a bundled demo key is a violation); **(b) anti-scraping duty** — commercially reasonable measures so third parties can't scrape API data through the app; **(c) no hard cap** — overage **$0.20/request**, billed at renewal or immediately at $500, non-refundable. RentCast's security doc says keys should "never" be exposed client-side and supports per-key endpoint restrictions. | BYOK correct for key-confidentiality reasons. Agents *may* send exported reports containing RentCast-derived stats. Add **client-side budget meter with default-on hard cap**, per-action cost preview, onboarding to create a dedicated endpoint-restricted key. **Still never commit real RentCast responses** (listing-agent PII, anti-scraping duty) — synthetic fixtures only. | HIGH |
| 2 | "NYU CoStar: offline research only" | CoStar Academic Engagement terms prohibit commercial use and "any use involving direct or indirect benefit — financial or otherwise," including industry/development projects; breach risks campus-wide access loss. NYU's specific license not retrieved. | **Resolved: no CoStar for Tran in any form.** Benchmarks from RentCast market stats, HUD FMR/SAFMR, Census ACS. Repo policy + gitleaks path rule: no CoStar-derived files, numbers, or screenshots. | MEDIUM |
| 3 | "Fair Housing-safe AI copy" (anchored to HUD AI guidance) | HUD **withdrew** April 2024 digital-advertising guidance (effective 2025-09-17; Federal Register notice 2026-04-06). **FHA §3604(c) and 24 CFR 100.75 apply unchanged.** NY AI Transparency in Advertising Act (effective 2026-06-09) requires disclosure of synthetic performers ($1,000/$5,000 penalties); CA FEHA ADS rules; Colorado SB 26-189. State license-law ad rules (FL, NJ, OH, CA…) require brokerage name and sometimes license number on ads incl. social/web. | Anchor guardrails to statute/regulation + Achtenberg memo word lists + state law. **Deterministic fair-housing linter** gates *all* AI output across all portals. Founder-story scripts include AI-disclosure checklist (NY) and never fabricate results. Agent exports auto-append brokerage/license disclosure. No demographic/crime/school overlays. | HIGH / MEDIUM |
| 4 | "Lead inbox delivered via Web3Forms/Formspree" | Both free tiers are **email delivery only**: Web3Forms Submissions API is Pro-only; Formspree Submissions API is Professional/Business-only. Web3Forms free ≈ 250/month, 30-day retention, public access key (spam risk). Formspree free ≈ 50/month account-wide. | Inbox = **"import from email"**: submissions embed a `TRAN-LEAD v1 {json}` block; agent pastes email / drops `.eml` / manual add. Each agent uses **own** Web3Forms key. Honeypot + optional hCaptcha; never render agent email raw in HTML. Live inbox = v2 webhook + backend. | HIGH / MEDIUM |
| 5 | "GitHub Pages from `wolfwdavid/tran_real_estate`" | **(a)** Storage is per-origin, not per-path — `wolfwdavid.github.io` is shared with raj fleet, michelle_ngo_*, Eman_dashboard, DID sites, etc.; any XSS or compromised dependency there can read Tran keys. **(b)** Pages ToS disallows commercial SaaS and sensitive transactions. **(c)** No custom headers — CSP only via `<meta>` (ignores `frame-ancestors`, `report-uri`, `sandbox`). | **Resolved: dedicated free GitHub org `tranrealestate` → `tranrealestate.github.io`.** `BASE_PATH` env var. Paid v2 must move hosts. JS frame-bust as only clickjacking mitigation. | HIGH |
| 6 | Renter "filter by availability" / rich listing cards | RentCast listings have **no photos, listing URL, description, amenities, pet policy, or availability date**. They *do* have address, lat/long, type, beds, baths, sqft, lot, year built, HOA, status, price, listed/removed/lastSeen dates, daysOnMarket, MLS name/number, **listing agent/office name/phone/email/website**, and dated price/event history. | "Availability" → **"listed within N days"** (`daysOld`) + Active status + "likely still available" heuristic. Drop pet/amenity filters; AI outreach *asks* those. Cards use map pin + property-type illustrations + outbound "search this address" links. Cinematic imagery = marketing only. Fixtures must be PII-free. | HIGH |
| 7 | "Market dashboards by zip/metro" | RentCast market statistics are **ZIP-only**; one call returns full zip history by property type and bedrooms. Metro would need many calls. | v1 = **watched-zip dashboards** (≤ ~5 zips from cache). Zip medians by bedroom = zero-extra-call fair-rent signal and buy-box quick metrics. | HIGH |
| 8 | "Saved searches re-run on app open" | Unconditional re-run can't fit 50 calls (2 searches × daily ≈ 60/month). Deal autofill = 2–3 calls → ~10–15 deep analyses/month. No true nationwide query: every listings call needs city/state, zip, or radius ≤100 mi; max 500 rows. | **TTL-gated (≤ once/search/24h), budget-allocated** re-run; fetch wide, filter local; no auto-pagination; "nationwide" = "any US city or zip"; location required. | HIGH |
| 9 | Brand "Tran Real Estate" with outreach, fair-rent "check", investment "memo" | "Real Estate" and conversion copy ("we find you", "our agents", "appraisal", "valuation") imply brokerage/appraisal/advice; locator/referral-fee rules vary by state. | Site-wide "software tool — not a brokerage, not investment/legal/tax advice" disclaimers; banned-marketing-terms CI grep; "estimate range, not an appraisal"; "Market Snapshot, not a CMA". Record: **Tran never takes per-lead/per-closing compensation and never routes leads between agents.** Consider descriptor before public launch. | MEDIUM |

---

## Owner Decisions

| Decision | Options considered | Status | Blocks |
|----------|--------------------|--------|--------|
| **Origin / hosting** | Shared `wolfwdavid.github.io` / free GitHub org Pages / custom domain / Cloudflare Pages | **✓ Decided 2026-09-13: free GitHub org `tranrealestate` → `tranrealestate.github.io`** (owner must create org in browser; API can't create orgs). Plan custom domain or other host before paid v2. | Phase 1 gate; key storage (Phase 3) |
| **CoStar** | Offline research / stop / ask NYU | **✓ Decided: do not use CoStar for Tran at all.** | — |
| **Extension distribution** | $5 Chrome Web Store / load-unpacked + Edge Add-ons / defer | **✓ Decided: load-unpacked zip (GitHub Releases) + Edge Add-ons, $0.** Firefox AMO (free) optional. $5 Chrome listing revisitable at GTM push. | Extension phase |
| **Gemini inclusion** | Full / experimental flag / defer / Claude-only | **✓ Decided: include in v1 with free-tier training/PII warning.** Research recommends native `streamGenerateContent` + `x-goog-api-key` header, flagged as less stable than Anthropic/OpenAI. | AI layer phase |
| **v1 scope depth** | Full P1 depth / capped depth all 3 portals / one portal + shells | **✓ Decided: all three portals at capped depth**, demo-credible exit criteria and named cut line per portal phase | Roadmap creation |
| **Analytics** | Umami Cloud script / first-party beacon / none | **✓ Decided: first-party `fetch` beacon to Umami free tier** — no third-party `<script>` tags, page/portal events only, never PII; verify Umami collection-API CORS in launch phase | Launch phase |
| **Brand descriptor** | "Tran Real Estate" / add "Tools" etc. | **✓ Decided: public brand "Tran Real Estate Tools"** | Brand/marketing copy |

---

## Key Findings

### Recommended Stack

Optimized for a static, prerendered, SEO-friendly marketing surface plus a browser-only app shell with heavy libraries lazy-loaded. Versions pulled live from npm 2026-09-13. Biggest traps: `typescript@latest` (now 7.x) and `sv@next`/Kit 3 RC (moves `$lib`→`#lib`, conflicts with shadcn-svelte/runed). pnpm workspace: `apps/web`, `apps/extension`, `packages/core` (pure TS), `packages/brand` (tokens). See `STACK.md`.

**Core technologies:**
- **SvelteKit 2.70.3 + Svelte 5.57 + adapter-static 3.0.10 + Vite 8.3** — user constraint; latest stable line (Kit 3 still RC)
- **TypeScript ~6.0.3 (pinned)** — TS 7 outside Kit/svelte-check/typescript-eslint peer ranges
- **Node 24 LTS + pnpm 11.27** — satisfies WXT (Node ≥22); hold pnpm 12
- **Tailwind 4.3 `@theme` + shadcn-svelte 1.6 / bits-ui 2.19** — tokens become CSS vars *and* utilities; copied components make warm-editorial restyle plain edits
- **Dexie 4.4.6 (IndexedDB)** — CRM, response cache, quota ledger, saved searches, snapshots need indexes/migrations/transactions; wrap `liveQuery` in a tiny runes helper (avoid `dexie-svelte-query`)
- **Zod 4.6 (`zod/mini`)** — validate RentCast responses, backup imports, CSV/lead imports
- **LLM providers via raw `fetch` + shared SSE parser** — Anthropic Messages (`anthropic-dangerous-direct-browser-access: true`), OpenAI Responses API, Gemini native `streamGenerateContent`
- **LayerChart 2.5** — Svelte 5-native SVG charts; prints as vectors
- **Print CSS + `window.print()` primary; pdfmake 0.3.11 lazy optional**
- **WXT 0.21.4** — MV3 extension, built-in `wxt:locationchange`; plain-TS content script, Svelte only in popup
- **Testing:** Vitest 4.1.11 (not 5.0), fake-indexeddb, Playwright 1.63 with `page.route()` mocks (CI never hits RentCast/LLMs), `@axe-core/playwright` on every route in demo + key states
- **Self-hosted fonts** (`@fontsource-variable/fraunces` + `inter`, or Source Serif 4) — no Google Fonts CDN

**Model registry defaults** (single `models.ts`, user-overridable, validated against provider models-list endpoints): Anthropic `claude-sonnet-5` (don't default to `claude-haiku-4-5`, retirement window opens 2026-10-15); OpenAI `gpt-5.6-terra`; Gemini `gemini-3.8-flash`.

### Expected Features

Competitor baseline: Zillow/Zumper/HotPads/Apartments.com (renters); DealCheck/Mashvisor/BiggerPockets (investors); Follow Up Boss/BoldTrail/Lofty/RPR/Cloud CMA/AI listing writers (agents). **Cut depth per portal, never shared infrastructure** (demo fixtures, budget cap, linter, backup).

**Must have (table stakes):**
- **Platform:** landing + three audience pages + portal switcher; **full demo mode with RentCast-shaped synthetic fixtures across every portal**, badged "Sample data"; BYOK settings with "where your key goes", test-connection, forget-keys; **budget meter + default-on hard cap + per-action cost preview**; IndexedDB cache with "data as of" stamps; **JSON backup export/import with schema migrations**; clear 401/403/429/cap-reached/empty/refusal states; **legal pages** (privacy, not-a-brokerage/not-advice, Fair Housing statement, data-coverage explainer); mobile + WCAG AA.
- **Renter:** search on RentCast's exact filters incl. "listed within N days"; sortable list, **map view** (Leaflet + OSM), **listing detail with price history**; favorites/shortlist; TTL-gated saved searches with "N new since last visit"; `mailto:`/`tel:` contact; **affordability calculator** (0 calls).
- **Investor:** full expense lines, NOI, cap rate, cash flow, CoC, **DSCR**, GRM, 1% rule; **manual (0-call) mode + optional autofill**; save & compare deals; printable report; watched-zip dashboards.
- **Agent:** contacts (source, stage, notes, activity); **pipeline view + smart lists**; tasks/due-today; AI reply drafts; AI listing descriptions; **fair-housing compliance check on all generated copy**; **agent profile with brokerage/license/state disclosures**; CSV import/export.

**Should have (differentiators):**
- **"No account, your keys, your data never leaves your browser"** positioning
- **Two-tier fair-rent check** — 0-call zip-median-by-bedroom signal + 1-call rent estimate with range and 5–25 comps
- **AI outreach draft that asks what the data can't answer** (availability, pets, parking, fees, lease terms); human sends
- **Buy-box deal-flow alerts with per-listing quick metrics from cached zip medians**
- **AI investment memo where code computes every number and the LLM only narrates**, with assumptions, data dates, disclaimer
- Sensitivity sliders; price-drop and "likely rented" badges from `history`/`lastSeenDate`
- **Shareable lead-capture page generator** (per-agent Web3Forms key) + **TRAN-LEAD paste import**
- **Founder-story reel script generator** (hook → manual pain → before/after → results → mission → CTA)
- **Social post pack with auto-appended brokerage disclosure**
- **"Market Snapshot" branded report** (not a CMA) with AI narrative over computed stats
- **Standalone fair-housing copy checker** (free SEO top-of-funnel, zero API cost)
- Evergreen zero-API SEO tool pages (affordability, cap rate/CoC/DSCR, fair-housing checker, rental-scam tips)
- **Zillow sponsored-listing filter extension** — no competitor hides Zillow's paid placements
- Cross-portal handoffs ("Talk to an agent" → demo/founder agent form in v1; no directory/routing)

**Defer (v1.x):** HUD Small Area FMR overlay; shareable deal links in URL fragment; scam red-flag hints; live mortgage-rate default; remote selector-config for extension; public changelog.

**Defer (v2+, needs backend/accounts):** server/email alert digests; accounts + cross-device sync; live agent inbox via webhooks, routing, directory; Stripe billing / pooled data plan; STR analysis; portfolio tracking; MLS/IDX only with a broker sponsor.

**Anti-features (never in v1):** shared/embedded RentCast demo key; unconditional/background refetch; scraping or extension data extraction; auto-sent email/SMS, drips, autonomous AI ISA; tenant screening/scoring/applications/payments; demographic/crime/school/"family-friendly" overlays; buy/sell recommendations; "appraisals"/"CMAs"; skip tracing/lead buying; programmatic "rentals in [city]" SEO pages filled with RentCast data; third-party tracking pixels; fabricated testimonials/metrics.

### Architecture Approach

Hexagonal (ports & adapters) client with a single runtime composition root (`container.ts`) wiring fixture adapters in demo mode and live adapters once keys exist (v2: server/proxy adapters). **All prerendered routes, no `[param]` routes** — record IDs travel as `?id=` read only in the browser. Route groups `(marketing)` / `(app)` / `(print)` separate bundle profiles so marketing pages never import storage/keys/LLM code. Portals import only their feature folder + `shared` (ESLint `no-restricted-imports`); `fetch(` lint-banned outside adapter folders; `{@html}` banned outside one sanitizer module. See `ARCHITECTURE.md` for data-flow diagrams.

**Major components:**
1. **`packages/core`** (pure TS) — domain types, Zod schemas, finance math, filter matching, snapshot diff, budget math, backup migrations, fair-housing lexicon; reusable unchanged in a v2 edge function.
2. **`packages/brand`** — warm-editorial tokens (CSS custom properties + TS export + Tailwind `@theme`) and fonts; the only thing shared with the extension.
3. **`lib/data` DataGateway** — canonical request key → in-flight dedupe → IndexedDB cache with per-endpoint TTL → **budget check / hard stop / confirm** → RentCast or fixture adapter → ledger → normalized rows with provenance `{source, fetchedAt, stale}`. Fetch wide, filter local. 404 negatively cached; 401/403 → Settings; 429 backoff. Sole path to RentCast.
4. **`lib/ai`** — `LlmProvider` port (`validateKey`, `stream`) with raw-fetch Anthropic/OpenAI/Gemini/Fixture adapters, shared SSE parser, runner (abort, usage, cost estimate); versioned prompt registry (`prompts/<feature>/<name>.v<N>.ts`) with pre-send PII minimization and post-receive fair-housing scan; artifacts stored with `promptId@version`, provider, model.
5. **`lib/storage`** — Dexie schema/migrations; `Syncable` records (UUID, `ownerId:'local'`, timestamps, soft-delete tombstones, `schemaVersion`); typed async repos. **Secrets vault is a separate DB** (session default / remember / passphrase AES-GCM-PBKDF2), never exported. Backup export/import with dry-run merge/replace; `navigator.storage.persist()`.
6. **`lib/alerts`** — check-on-open scheduler with budget allocation grouped by geography key; `core.diffSnapshots` → `{added, priceChanged, statusChanged, removed}`; **two cursors** (last fetched vs. last viewed). Serves renter saved searches and investor buy-boxes.
7. **`lib/leads`** — Web3Forms `LeadSink` (per-agent key, honeypot, embedded `TRAN-LEAD v1` JSON) and paste/`.eml`/CSV parsers; LLM extraction only as user-triggered fallback.
8. **`lib/export`** — `(print)` routes with print CSS, CSV, lazy pdfmake.
9. **`apps/extension` (WXT MV3)** — label-text/ARIA-first detection with versioned selectors as secondary signal; dim-by-default with one-click reveal; `MutationObserver` scoped to results container; `storage` + Zillow host permissions only; **zero network, zero keys, zero messaging to the web app**.

**Security architecture:** dedicated origin; SvelteKit `kit.csp` `mode:'hash'` meta with exact `connect-src` allowlist (rentcast, anthropic, openai, generativelanguage, web3forms, + analytics beacon host if chosen), `form-action` web3forms, `object-src 'none'`, `base-uri 'self'`; **`img-src` must add OSM tile host when the map ships**; JS frame-bust; DOMPurify-only markdown; no third-party scripts; self-hosted fonts; lockfile + `pnpm audit` + Dependabot + SHA-pinned Actions + gitleaks + GitHub secret scanning with push protection; CI assertion that built HTML has CSP meta first in `<head>` with no `unsafe-inline`/`unsafe-eval`.

### Critical Pitfalls

1. **Surprise RentCast overage on the user's card** — no provider cap; a reactive `$effect` or pagination loop can burn hundreds of calls. **Avoid:** DataGateway budget ledger *before any feature calls the API*; user-editable **default hard stop at 40/50** with "≈$0.20" confirm past cap; header meter and per-button cost labels; no auto-pagination; saved-search re-run ≤ once/24h per search, sequential, confirm when >3 due; call-count unit tests ("open app with 5 saved searches", "re-render 10×", "60 simulated calls blocks call #41").
2. **Key theft via shared origin, XSS, or third-party scripts** — **Avoid:** dedicated origin in Phase 1; session-only key storage default with "remember on this device" opt-in and optional passphrase (labeled at-rest protection only); never `{@html}` LLM/listing/pasted-email content; strict `connect-src` CSP; no third-party scripts; Gemini key in header, never `?key=`; keys excluded from backups/logs/URLs; advise dedicated, endpoint-restricted, spend-limited keys.
3. **Fair Housing violations in AI copy** — **Avoid:** property-not-people system prompt *plus* deterministic linter (Achtenberg + state phrase lists) with inline explanations, compliant rewrites, and acknowledgement before copy; 30+ known-bad / 30 neutral phrase test suite; no demographic/crime/school overlays; never build screening/scoring.
4. **Three-portal scope creep** — **Avoid:** every portal phase has a hard exit criterion (works fully in demo mode, works under budget with a real key, passes linter where relevant, passes axe); ≤ ~4 features per plan; named cut line per portal; extension in its own slippable phase.
5. **Local-only data silently lost** — Safari/WebKit (all iOS browsers) evicts script-writable storage after 7 days without interaction. **Avoid:** versioned JSON export/import in the storage phase; `storage.persist()` result in Settings; "last backup N days ago" nudges; iOS Add-to-Home-Screen tip; lost baseline degrades to "all results new."

**Also high-impact:** LLM CORS fragility (OpenAI browser CORS broke 2025-10-15 and 2026-01-29 — test-connection from the *deployed* URL, clear CORS-vs-auth-vs-quota errors, optional OpenRouter fallback); unlicensed-brokerage/advice optics (disclaimers + banned-terms CI grep); Zillow extension creep into scraping or trademark misuse (nominative naming "Sponsored Listing Filter — for Zillow", "not affiliated" notice, no Zillow logo/colors, single purpose, no network); demo with real data (synthetic fixtures + CI PII scan); Pages deploy traps (`.nojekyll`, hard-coded root links, module-level `localStorage` during prerender, deploy-pages wedges — `concurrency` on deploy job); CAN-SPAM/TCPA (postal address + opt-out in email templates; no SMS/bulk/voice); false precision (ranges, comp count, low-confidence badge, "long-term rentals only"); warm palette failing WCAG AA (contrast-check tokens, scrims on hero text, tabular sans numerals in financial tables).

---

## Reconciliation of Conflicting Research

| Topic | Conflict | Resolved |
|-------|----------|----------|
| LLM client | STACK: official SDKs lazy-loaded; ARCHITECTURE/PITFALLS: raw fetch | **Raw-fetch adapters** — SDK telemetry headers (`x-stainless-*`, `Api-Revision`) have broken Gemini CORS; fewer deps on a key-holding origin; one CSP list; trivial fake-fetch tests (~100–150 LOC/provider). |
| Routing on Pages | STACK/PITFALLS: `fallback: '404.html'`; ARCHITECTURE: no SPA fallback | **Prerender every route; no dynamic `[param]` routes; IDs in query strings read in `onMount`.** Emit a branded `404.html` for true not-founds; `trailingSlash: 'always'`; Phase 1 live deep-link refresh test; verify `kit.csp` meta on prerendered pages. |
| Budget cap default | 45/50 vs 40/50 vs confirm-only | **40/50 default**, user-editable, user-set billing reset day, manual "calls used elsewhere" adjustment; only 200s counted, all attempts logged. |
| Cache TTLs | Various | **Listings 24h; rent/value estimates 14d; market stats 30d; property records 90d; 404 negative cache 24h** — per-endpoint config, "as of" stamp + manual "Refresh (1 call)". |
| RentCast key validation | Lazy vs empty-query 404 vs test button | **Zero-cost validation**: format check + deliberately-empty query (404 = OK, 401 = bad, 403 = restricted/billing). **Verify with a real key** in data-layer phase; fall back to lazy validation. |
| Key storage default | Three modes vs session default | **Session default; "remember on this device" opt-in; optional passphrase.** Revisit once dedicated origin is live. |
| Workspace layout | Various | **`apps/web`, `apps/extension`, `packages/core`, `packages/brand`.** Share only brand tokens with the extension. |
| PDF export | pdfmake primary vs print CSS | **Print CSS primary**; pdfmake lazy optional. |
| Analytics | Umami script vs none | **No third-party script tags**; optional first-party beacon (owner decision pending; Umami collection-API CORS unverified). |
| Fair-housing linter placement | Various | **AI Layer phase** (lexicon in `packages/core`); every generator gated behind it. |
| LLM layer timing | Foundation vs separate phase | **Separate AI Layer phase** depending only on storage/keys, parallel with Data Layer. Foundation carries CSP `connect-src` hosts only. |
| Extension timing | v1.x vs early GTM hook vs slippable | **Own v1 phase depending only on Foundation + Brand**, scheduled after portals by default; may be pulled forward, never blocks web launch; bundled matchers only (no remote config). |
| Extension test fixtures | Synthetic DOM vs saved Zillow HTML | **Commit only synthetic minimal DOM**; real snapshots local and gitignored. |
| Gemini | HIGH vs LOW confidence | **Included in v1 (owner decision) with free-tier PII warning**; native endpoint + header key. |
| Extension distribution | Edge/Firefox/Releases vs $5 Chrome | **Load-unpacked Releases zip + Edge Add-ons (owner decision)**; Firefox AMO optional. |
| v1 scope | Full P1 vs one portal + shells | **All three portals at capped depth** (pending owner confirmation) with per-portal cut lines. |

---

## Implications for Roadmap

Suggested structure: **11 phases** (owner chose "fine" granularity — the roadmapper may split further). P4 ∥ P5 after P3; P6 ∥ P7 after P4+P5; P8 needs only P3+P5; P10 needs only P1+P2.

```
P1 Foundation & Origin ─┬─► P2 Brand + Marketing + Legal shells ──────────────┬─► P10 Extension
                        └─► P3 Local Platform (storage, vault, backup) ─┬─► P4 Data Layer ─┬─► P6 Renter ───┐
                                                                        │                  ├─► P7 Investor ─┼─► P9 Studio + Reports
                                                                        └─► P5 AI Layer ───┴─► P8 Agent CRM ┘
All ─► P11 Launch Hardening & GTM
```

### Phase 1: Foundation, Origin & Security Baseline
**Rationale:** Origin, CSP, base path, secret hygiene, deploy mechanics are expensive to retrofit.
**Delivers:** pnpm workspace; SvelteKit 2.70 + adapter-static with env `BASE_PATH`, `trailingSlash: 'always'`, `.nojekyll`, `(marketing)`/`(app)`/`(print)` groups, root `prerender = true`, no `[param]` routes; `kit.csp` hash-mode meta with exact `connect-src` + CI assertion; JS frame-bust; ESLint import boundaries and `fetch(`/`{@html}` bans; CI (typecheck, lint, Vitest, Playwright smoke under non-root base path incl. live deep-link refresh); deploy workflow with `concurrency`; SHA-pinned Actions; gitleaks + secret scanning push protection + Dependabot; tests with global `fetch` throwing. Deploy target `tranrealestate.github.io` (org created by owner).
**Avoids:** Pitfalls 2 (origin), 7 (meta CSP), 11 (Pages routing), 12 (secrets in repo).

### Phase 2: Brand System, GTM Marketing Pages & Legal Shells
**Rationale:** Marketing surface is data-independent and is the GTM funnel; tokens needed before portal UI and by the extension.
**Delivers:** warm-editorial tokens (WCAG AA contrast-checked) in `packages/brand`/Tailwind `@theme`; self-hosted serif+sans; shadcn-svelte restyle (UI/UX Pro Max); landing + `/for-renters`, `/for-investors`, `/for-agents` + extension teaser; portal switcher shell; legal pages; disclaimer, provenance-chip, "Sample data" badge components; axe per route; banned-terms grep.
**Avoids:** Pitfalls 5, 19; no fabricated social proof.

### Phase 3: Local Platform — Storage, Key Vault & Backup
**Rationale:** Cache, ledger, secrets, CRM, snapshots all live in storage; durability is core on Safari.
**Delivers:** Dexie schema/migrations, `Syncable` records, typed repos, runes `liveQuery` helper; separate secrets DB (session default, remember opt-in, passphrase AES-GCM); Settings/keys UX ("where your key goes", restricted-key advice, forget-all); JSON backup export/import (secrets excluded, dry-run merge/replace, migrations); `storage.persist()` status; last-backup nudge; `BroadcastChannel` signals.
**Research flag:** light (Safari eviction / `persist()` on iOS 17+).

### Phase 4: Data Layer — RentCast Gateway, Budget Guard, Demo Fixtures & Alerts Engine
**Rationale:** Budget guard must exist before any feature spends calls; fixtures ship with the client; alerts engine shared by renter and investor.
**Delivers:** typed RentCast client (`X-Api-Key` only), endpoint defs, mappers, Zod; error taxonomy; location normalization; DataGateway (canonical keys, dedupe, TTL cache, ledger, **40/50 hard cap + confirm**, projected-burn screen, provenance chips); fetch-wide/filter-local with 500-row truncation warning; shared zip market-stats cache; zero-cost key validation; synthetic fixture metros + CI PII scan; `core.diffSnapshots` + two-cursor check-on-open scheduler; call-count unit tests.
**Research flag: YES** — with a real dedicated restricted key verify 404-unbilled, pagination billing, field coverage incl. listing-agent contacts, free-plan card requirement, endpoint restrictions. Never commit responses.

### Phase 5: AI Layer — Providers, Streaming, Prompts & Compliance Guardrails
**Rationale:** Depends only on storage/keys (parallel with P4); must precede every generator.
**Delivers:** `LlmProvider` port + raw-fetch Anthropic/OpenAI/Gemini/Fixture adapters; SSE parser; runner (abort, usage, cost, `maxTokens`, ~50ms render throttle); `models.ts` registry validated via models-list; test-connection distinguishing CORS/auth/quota from the deployed URL; versioned prompt registry; **deterministic fair-housing linter** (lexicon in `packages/core`, 30+/30 test suite) with explanations, rewrites, required acknowledgement; PII minimization/redaction; Gemini free-tier PII warning; DOMPurify sanitizer; generation panel (copy / `mailto:` / "mark sent", no auto-send path); artifact store.
**Research flag: YES** — model IDs, streaming event shapes, Gemini key types, models-endpoint CORS, legal sourcing of phrase lists.

### Phase 6: Renter Portal
**Delivers:** location-required search ("listed within N days", Active); sortable list + Leaflet/OSM map (clustering, `img-src` CSP, attribution); listing detail with price history, agent/office contact, price-drop / likely-rented badges; favorites with status; TTL-gated saved searches; two-tier fair-rent check; AI outreach draft asking about availability/pets/fees/lease terms; affordability calculator; disclaimers.
**Exit criteria:** all renter routes keyless, under budget with real key, outreach passes linter, axe clean.
**Cut line:** badges, application-status tracker, map clustering polish.

### Phase 7: Investor Portal
**Delivers:** `core.finance` pure property-tested functions (NOI, cap rate, cash flow, CoC, DSCR, GRM, 1%/50% rules, break-even occupancy, amortization); analyzer with editable expense lines; manual (0-call) mode + autofill with call cost shown; rent-vs-market check; save/compare deals; sensitivity sliders; buy-box alerts with zip-median quick metrics + "Deep analyze (2 calls)"; watched-zip LayerChart dashboards (≤ ~5 zips); AI investment memo (code computes, LLM narrates); `(print)` routes + print CSS.
**Exit criteria:** as Phase 6. **Cut line:** sensitivity sliders, multi-zip compare, 50%/break-even extras.

### Phase 8: Agent Portal — Profile, Lead Intake & CRM
**Rationale:** Needs storage + AI layer but **not** the data layer; agent profile is prerequisite for Phase 9.
**Delivers:** agent profile/brand kit (name, brokerage, license #, state, logo, colors, postal address) with auto disclosures; shareable `/inquire` lead page on agent's own Web3Forms key (honeypot, optional hCaptcha, min time-to-submit, no raw email in HTML); `TRAN-LEAD v1` block; paste/`.eml`/CSV import with dedupe + dry-run diff; manual quick-add; honest "import from email" copy; local CRM (contacts, pipeline, tasks, smart lists, activity log, CSV import/export); due-today queue; `.ics` export; AI follow-up drafts with CAN-SPAM elements + PII minimization; backup nudges.
**Exit criteria:** as Phase 6. **Cut line:** smart lists beyond 3 presets, `.ics`, CSV import (keep export).
**Research flag: YES** — Web3Forms free limits/captcha/domain restriction; payload survival through email clients.

### Phase 9: Agent Content Studio & Market Snapshot Reports
**Rationale:** Depends on P7 dashboards/print, P8 profile, P5 linter.
**Delivers:** listing description generator (agent-typed facts only); social post pack with auto disclosure; founder-story reel script generator (timed beats, captions, B-roll list, user-supplied results only, NY AI-disclosure checklist); standalone fair-housing checker page; branded "Market Snapshot" report (zip stats + active listings, AI narrative over computed numbers, "not a CMA/appraisal", Equal Housing Opportunity option, removable footer), print-to-PDF; everything linted.
**Cut line:** listing descriptions + snapshot report first; social pack and script generator second.

### Phase 10: Zillow Sponsored Listing Filter Extension
**Rationale:** Decoupled (P1+P2 only), strong GTM hook, high maintenance/ToS uncertainty — own slippable phase.
**Delivers:** WXT MV3 extension, plain-TS content script; label-text/ARIA-first detection ("Sponsored", "Featured", "Promoted") + versioned selectors; dim-by-default with reveal, or hide mode; scoped debounced `MutationObserver` + `wxt:locationchange`; Svelte popup (toggle + hidden count) with brand tokens; permissions `storage` + `*://*.zillow.com/*` only; **zero network, zero data collection**; synthetic-DOM matcher tests; nominative naming + "Not affiliated with or endorsed by Zillow Group"; privacy page ("collects nothing, sends nothing") and install page; `wxt zip` release to GitHub Releases (load-unpacked) + Edge Add-ons.
**Research flag: YES** — current Zillow sponsored-card DOM/labels; **manual read of Zillow ToU**; store naming tolerance; WXT 0.x stability.

### Phase 11: Launch Hardening & GTM
**Delivers:** first-run onboarding (choose portal → tour → "Try sample data" or "Connect free RentCast key" 3-step guide incl. setting the cap); evergreen zero-API SEO tool pages with titles, OG images, `sitemap.xml`, JSON-LD; waitlist + feedback forms tagged by portal; analytics per owner decision; "What Tran never does" / key-handling page; CSP review, `pnpm audit`, axe audit all routes keyless + key states, marketing JS performance budget; disclaimer/banned-terms audit; full "Looks Done But Isn't" checklist from `PITFALLS.md`; v2 seam review.

### Phase Ordering Rationale

- **Dependency-driven:** storage (P3) before gateway (P4) and AI layer (P5); gateway and AI layer before every portal; agent reports (P9) last (consume P7 print pipeline and P8 profile).
- **Parallelism designed in:** P4∥P5; P6∥P7 (alerts engine extracted into P4); P8 needs only P3+P5; P10 needs only P1+P2; ESLint portal isolation prevents merge collisions.
- **Pitfalls before triggers:** budget cap (P4) before any auto-refresh; linter/sanitizer (P5) before any generator; origin/CSP (P1) before key storage (P3); backup (P3) before CRM (P8); synthetic fixtures (P4) before any portal demo.
- **Scope control:** every portal phase has a demo-credible exit criterion and named cut line; cut *depth per portal*, never shared infrastructure.
- **Requirement rewrites:** "availability filter" → "listed within N days"; "zip/metro dashboards" → "watched-zip dashboards"; "lead inbox" → "lead capture page + import from email"; "re-run on open" → "TTL-gated, budget-allocated re-run"; add budget meter + cap, JSON backup, legal pages, fair-housing linter, agent profile disclosures, DSCR/NOI/GRM, manual deal mode, map, listing detail, favorites, affordability calculator.

### Research Flags

Needs `/gsd:research-phase` during planning: **Phase 1** (org Pages setup, `kit.csp` meta emission on prerendered pages, Pages `trailingSlash`), **Phase 4** (real-key billing semantics, field coverage, card requirement, key restrictions), **Phase 5** (model IDs, streaming shapes, Gemini key types, fair-housing lexicon sourcing), **Phase 8** (Web3Forms limits, email payload survival), **Phase 10** (Zillow DOM/labels, manual ToU read, store naming, WXT stability).

Standard patterns (skip research): Phase 2, Phase 3 (light Safari check), Phases 6–7, Phase 9 (light state-disclosure check), Phase 11.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm versions/peer ranges live 2026-09-13; live CORS preflights; SDK flags confirmed in tarballs; official model pages. MEDIUM: pnpm 12 timing, Web3Forms limits, Kit 3 timing. |
| Features | MEDIUM-HIGH | RentCast schema/filters/billing/terms HIGH; competitor features MEDIUM; Zillow ToS LOW (403); form read-API gating HIGH, exact free limits MEDIUM. |
| Architecture | HIGH | CORS, per-origin storage, SvelteKit prerender/CSP docs, Pages ToS verified. Lead-inbox import design and extension heuristics MEDIUM; zero-cost key validation MEDIUM until real-key test. |
| Pitfalls | MEDIUM | RentCast billing/terms, CSP3 meta limits, Safari eviction, provider data policies HIGH. Legal interpretation (licensing, state ad rules, CoStar as applied to NYU, TCPA consent status) MEDIUM-LOW — not legal advice. |

**Overall confidence:** MEDIUM-HIGH. Technical plan is well-grounded; legal/compliance items are directionally sound but warrant professional review before the public GTM push.

### Gaps to Address

- **RentCast billing edge cases** (404 unbilled? pagination billing? card required?) — Phase 4 with a dedicated restricted key; never commit responses.
- **NYU CoStar license specifics** — moot: owner decided not to use CoStar.
- **Zillow Terms of Use text** — 403 to automated fetch; read manually before extension release (Phase 10); keep hide-only, no network.
- **Web3Forms official free-tier limits and captcha/domain options** — verify on signup in Phase 8; keep form adapter pluggable (Formspree alternative).
- **Gemini browser BYOK viability** — conflicting signals; re-check in Phase 5; warn on free-tier PII.
- **OpenAI browser CORS stability** — unofficial path, two same-day outages; test-connection, clear errors, optional OpenRouter adapter.
- **`kit.csp` meta emission with adapter-static and OSM tile host** — verify in Phase 1; add tile host to `img-src` in Phase 6; confirm OSM tile usage policy.
- **Analytics without third-party scripts** — Umami collection-API CORS unverified; decide in Phase 11 or ship without analytics.
- **FCC one-to-one consent rule status** — irrelevant while no SMS features exist.
- **State licensing optics** — record "no per-lead/per-closing compensation, no routing" now; counsel review before monetization.
- **Model churn** (`claude-haiku-4-5` retirement ≥ 2026-10-15) — registry + live models-list check; never hard-code models in feature code.
- **SvelteKit 3 stable mid-roadmap** — don't migrate mid-phase; dedicated migration once shadcn-svelte supports `#lib`.

---

## Sources

### Primary (HIGH confidence)
- Live CORS preflight probes from `Origin: https://wolfwdavid.github.io` (2026-09-13): `api.rentcast.io`, `api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com`, `api.web3forms.com`, `formspree.io`, `huduser.gov`.
- npm registry (`npm view`, 2026-09-13) — versions, peerDependencies, engines; tarball inspection of `@anthropic-ai/sdk`, `openai`, `@google/genai`, `layerchart`, `pdfmake`, `sv`, `runed`.
- RentCast: [API Terms](https://www.rentcast.io/terms-api); [pricing](https://www.rentcast.io/api); [billing](https://developers.rentcast.io/reference/billing-and-pricing); [listings schema](https://developers.rentcast.io/reference/property-listings-schema); [rental listings](https://developers.rentcast.io/reference/rental-listings-long-term); [rent estimate](https://developers.rentcast.io/reference/rent-estimate-long-term); [market statistics](https://developers.rentcast.io/reference/market-statistics); [rate limits](https://developers.rentcast.io/reference/rate-limits); [security](https://developers.rentcast.io/reference/security.md).
- GitHub Pages [limits & prohibited uses](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits); MDN [same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy), [storage quotas / persist()](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria); [CSP3](https://www.w3.org/TR/CSP3/).
- SvelteKit [adapter-static](https://svelte.dev/docs/kit/adapter-static), [configuration](https://svelte.dev/docs/kit/configuration), [page options](https://svelte.dev/docs/kit/page-options), [Kit 3 RC announcement](https://svelte.dev/blog/sveltekit-3-release-candidate).
- Providers: [Claude models](https://platform.claude.com/docs/en/about-claude/models/overview), [OpenAI models](https://developers.openai.com/api/docs/models), [Gemini models](https://ai.google.dev/gemini-api/docs/models), [Gemini API terms](https://ai.google.dev/gemini-api/terms), [Gemini API key guidance](https://ai.google.dev/gemini-api/docs/api-key), [Anthropic usage policy](https://www.anthropic.com/legal/aup), [OpenAI usage policies](https://openai.com/policies/usage-policies/).
- [Web3Forms Submissions API (Pro)](https://docs.web3forms.com/getting-started/submissions-api); [Formspree Submissions API](https://help.formspree.io/hc/en-us/articles/360015233153-Form-Submissions-API).
- Fair housing: [24 CFR 100.75](https://www.law.cornell.edu/cfr/text/24/100.75); [Federal Register 2026-06624](https://www.federalregister.gov/documents/2026/04/06/2026-06624/notification-of-withdrawal-of-fair-housing-and-equal-opportunity-guidance-documents).
- Chrome Web Store [quality guidelines](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines), [impersonation/IP](https://developer.chrome.com/docs/webstore/program-policies/impersonation-and-intellectual-property), [2026 policy updates](https://developer.chrome.com/blog/cws-policy-updates-2026), [MV3 remote code](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security); [WXT docs](https://wxt.dev/guide/installation.html).

### Secondary (MEDIUM confidence)
- Competitor feature sets (Zillow Rentals/Boost/Listing Spotlight, Zumper, HotPads, Apartments.com, DealCheck, Mashvisor, BiggerPockets, Roofstock, Follow Up Boss, BoldTrail, Lofty, RPR, Cloud CMA, AI listing writers) — URLs in `FEATURES.md`.
- Web3Forms/Formspree free limits (splitforms, formtorch, formgrid comparisons).
- [CoStar Academic Engagement Terms](https://www.costar.com/CoStarTerms-and-Conditions/AcademicEngagement).
- [NY AI Transparency in Advertising Act analysis](https://www.koeglelaw.com/2026/06/04/new-york-just-blinked-first-on-ai-advertising-california-employers-youre-next/); [NAA on HUD withdrawal](https://naahq.org/news/hud-withdraws-fair-housing-related-guidance-documents); [FHCCI advertising guidance](https://www.fhcci.org/programs/education/advertising/); [NAR 2026 Code of Ethics](https://www.nar.realtor/about-nar/governing-documents/code-of-ethics/2026-code-of-ethics-standards-of-practice).
- [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/).
- OpenAI browser CORS incidents ([Oct 2025](https://community.openai.com/t/chat-completions-api-endpoint-down-blocked-any-web-browser-request/1362527), [Jan 2026](https://community.openai.com/t/has-the-cors-policy-changed-responses-api/1372791)); [Gemini OpenAI-compat CORS](https://discuss.ai.google.dev/t/gemini-api-cors-error-with-openai-compatability/58619); [js-genai #1723](https://github.com/googleapis/js-genai/issues/1723); [OpenRouter browser CORS](https://simonwillison.net/2026/Aug/15/cors-chat/); [Anthropic browser header](https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/).
- Dexie + Svelte 5 `liveQuery` issues ([#2075](https://github.com/dexie/Dexie.js/issues/2075), [#2231](https://github.com/dexie/Dexie.js/issues/2231)); [GitHub Pages wedged deployments](https://github.com/orgs/community/discussions/200884); [Chrome Web Store registration](https://developer.chrome.com/docs/webstore/register); [Edge Add-ons developer account](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account).

### Tertiary (LOW confidence — needs validation)
- [Zillow Terms of Use](https://www.zillow.com/z/corp/terms/) — 403 to automated fetch.
- "for Zillow" naming precedent ([Zillow Quick Hide](https://chromewebstore.google.com/detail/zillow-quick-hide/nlpcoafjhhlikkojhagkkipflagidelf)) — tolerance ≠ permission.
- Google rejecting "Standard" Gemini API keys from September 2026 — single source.
- Rental-locator licensing / referral fees ([TREC](https://www.trec.texas.gov/article/use-unlicensed-assistants-real-estate-transactions), [Inman](https://www.inman.com/2015/08/25/referrals-from-non-real-estate-agents-can-be-tricky-or-even-illegal/)) — state-specific.
- FCC one-to-one consent rule status — conflicting claims.

---
*Research completed: 2026-09-13*
*Ready for roadmap: yes (after owner confirms v1 scope depth)*
