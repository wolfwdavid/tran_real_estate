# Tran Real Estate

## What This Is

Tran Real Estate is a go-to-market (GTM) SaaS platform: one Svelte web app with three portals — **Renters**, **Investors**, and **Agents** — covering the entire United States. It replaces "refreshing Zillow all day" with tools that bring matching listings, deal math, and outreach to the user, powered by legitimate listing data (RentCast) and AI drafting. v1 runs at $0 infrastructure cost: a static site on its own GitHub Pages origin where each user brings their own data and AI API keys.

## Core Value

A visitor in any of the three portals can go from "what I'm looking for" to an actionable result — matching listings, an analyzed deal, or a ready-to-send message — in minutes instead of hours, using only legitimate data sources.

## Requirements

### Validated

Validated in Phase 1: Foundation, Origin & Security Baseline (2026-09-22) — all locally provable behaviour verified (35/35 must-haves, `pnpm verify` green: 134 unit tests, 30 browser tests, CSP oracle, secret and real-data scans, actionlint). Live-origin checks stay deferred until the owner creates the GitHub org (see `docs/DEPLOY-CHECKLIST.md`).

- ✓ FND-01 — Every route prerendered; deep-link refresh and branded 404 proven under root and `/tran_real_estate` base paths (Phase 1)
- ✓ FND-02 — Strict hash-mode CSP meta on every page with the exact 7-host `connect-src`; independent oracle + mutation tests (Phase 1)
- ✓ FND-03 — App stays hidden inside cross-origin frames (`<html hidden>` + external frame guard), proven in three iframe variants (Phase 1)
- ✓ FND-04 — Typecheck, lint, unit, E2E and axe gates run locally and in the CI workflow; Pages deploy job fully written but gated on `PAGES_ENABLED` (Phase 1)
- ✓ FND-05 — Pre-commit gitleaks + real-data/CoStar guard proven to block staged secrets and PII; CI scans full history (Phase 1)

Validated in Phase 2: Brand System, Marketing & Legal Pages (2026-10-05) — 5/5 must-haves verified against the codebase; `pnpm verify` green in one run (205 unit tests, 306 browser tests on both base paths, CSP oracle on 14+14 pages, banned-terms gate, secret and real-data scans, actionlint). Three owner-gated items (375px aesthetic pass, professional legal review, live-origin checks) are parked in `02-HUMAN-UAT.md`.

- ✓ BRND-01 — Warm-editorial landing (Fraunces + Inter self-hosted, token palette with WCAG-AA contrast gate) routes to the three portals; no third-party requests (Phase 2)
- ✓ BRND-02 — For Renters / Investors / Agents pages from one typed content file and shared template; banned-terms gate in `verify` and CI with a non-vacuity test (Phase 2)
- ✓ BRND-03 — Every page passes axe WCAG 2.2 AA at 1280 and 375px, with the menu open and on the 404 page; no horizontal scroll (Phase 2)
- ✓ BRND-04 — Privacy, Terms (not a brokerage; not investment, legal or tax advice), Fair Housing and Data-coverage pages reachable from every page's footer (Phase 2)
- ✓ BRND-05 — Portals nav with prerendered `aria-current` on every app page; disclosure menu below 640px with keyboard/Escape behaviour (Phase 2)

Validated in Phase 3: Local Platform: Storage, Key Vault & Backup (2026-10-05) — 6/6 must-haves verified against the codebase; `pnpm verify` green in one run (577 unit tests, 454 browser tests on both base paths, CSP oracle on 14+14 pages, `ui:guard`, banned-terms gate, secret and real-data scans, actionlint); 37/37 validation rows walked, 28-row mutation ledger. Nine real-device checks (Android/desktop install, iOS Add to Home Screen, Firefox persist prompt, Safari persistence, offline launch, real-key smoke) are parked in `03-HUMAN-UAT.md` until the org origin exists.

- ✓ PLAT-01 — Settings API-keys section for RentCast, Anthropic, OpenAI, Gemini and OpenRouter from one provider registry (hosts ⊆ CSP `connect-src`, header auth only); "where your key goes" explanation; one-action forget-all broadcast to every open tab (Phase 3)
- ✓ PLAT-02 — Session-only keys by default (`sessionStorage`); opt-in "remember on this device" migrates keys into the `tran-secrets` IndexedDB table and asks for persistent storage inside the click (Phase 3)
- ✓ PLAT-03 — Passphrase lock with envelope encryption (per-tab DEK), 12-char minimum, 5-attempt cooldown doubling 30 s → 300 s persisted across reload, cross-tab lock, honest "what a passphrase does and does not do" callout (Phase 3)
- ✓ PLAT-04 — JSON export over registered tables only with a raw + JSON-escaped key scan that refuses key-bearing data; import previews added/changed/replaced rows, merges newest-wins in one rw transaction, migrates older schema versions (Phase 3)
- ✓ PLAT-05 — Storage section shows the persistence grant; app-wide `AppNotice` shows "last backup N days ago" once overdue (and "Your keys are locked" first when both apply), live-updating on export, snooze and import (Phase 3)
- ✓ PLAT-06 — PWA manifest, allowlist-only precache service worker (same-origin GET, no runtime caching), pre-hydration `beforeinstallprompt` capture, Install section with iOS Add-to-Home-Screen tip (Phase 3)

Validated in Phase 4: Data Layer: RentCast Gateway, Budget Guard & Demo Fixtures (2026-10-05) — 5/5 must-haves verified against the codebase; `pnpm verify` green in one run (1384 unit tests including the new real-Chromium component project, 496 browser tests on both base paths, CSP oracle on 14+14 pages, fixture drift check, secret and real-data scans over 734 files, actionlint); 54/54 validation rows walked; 8 planned guards plus 15 further mutation runs recorded. Fourteen real-key checks (U1–U14) are parked in `04-HUMAN-UAT.md` until the owner creates a dedicated endpoint-restricted RentCast key.

- ✓ DATA-01 — Without a key every data type (rental and sale listings, rent/value estimates, zip market stats) is served from seeded synthetic fixtures for three invented metros through the same gateway port, badged "Sample data" in the status bar and on every provenance chip; fixtures are PII-scanned with planted-case proof and drift-checked in verify and CI (Phase 4)
- ✓ DATA-02 — Compact meter on every portal route and the full meter in Settings "RentCast usage"; every call-spending action carries a `CostLabel` computed by `estimateCost()` before it runs (Phase 4)
- ✓ DATA-03 — Append-only ledger with reserve-then-settle in one IndexedDB transaction, user-editable cap (default 40, typed "overage" above 50), single-use over-cap grants behind a confirm dialog; proven by call-count tests: 60 calls block #41, 10 re-renders spend 0, 5 due saved searches run once per 24 h even across two tabs (Phase 4)
- ✓ DATA-04 — Cache-first reads return the original "as of" stamp and spend 0; in-flight dedupe and a serial queue; explicit "Refresh (1 call)" bypass (Phase 4)
- ✓ DATA-05 — Locked error taxonomy from `@tran/core/request` rendered by `GatewayError` with specific copy for invalid key, restricted key, rate limit (with countdown), budget cap reached and no results; "Test key (0 calls)" in Settings reports valid / invalid / restricted without a billed call (Phase 4)

Validated in Phase 5: AI Layer: Providers, Streaming & Fair Housing Guardrails (2026-10-05) — 4/4 must-haves verified against the codebase; `pnpm verify` green in one run (2541 unit tests including real-Chromium component tests, 566 browser tests on both base paths with every provider mocked, CSP oracle on 14+14 pages, secret and real-data scans, actionlint). Ten owner-gated checks (H1–H10: deployed-origin CORS per provider, real spend-limited keys, model-ID recheck by 2026-10-18, legal review of the lexicon wording) are parked in `05-HUMAN-UAT.md`.

- ✓ AI-01 — Anthropic, OpenAI, Gemini and OpenRouter raw-`fetch` streaming adapters (no SDKs; Gemini key in the `x-goog-api-key` header only) behind one `LlmProvider` port; `runGeneration` streams with a working Stop that keeps partial text; "Test connection" distinguishes ok / cors-blocked / auth / quota / network; a keyless Fixture provider streams pre-linted sample output; "AI drafting" is Settings section 3 (Phase 5)
- ✓ AI-02 — Deterministic 41-entry Fair Housing lexicon (FHA §3604(c) classes plus state additions, each entry sourced) with a ReDoS-guarded Unicode matcher; 42 bad / 40 neutral suite rows, every entry proven load-bearing by leave-one-out; `block` findings disable all exits until the alternative is applied, `warn` findings need an explicit acknowledgement; inline highlights with popover explanation and one-click "Use alternative" (Phase 5)
- ✓ AI-03 — Prompt inputs pass through `redactPii` with a "What will be sent" preview; a Gemini client-data dialog (Cancel default, session-only acknowledgement) plus an adapter-level `consent-required` guard; E2E proves cancel sends zero requests (Phase 5)
- ✓ AI-04 — `GenerationPanel` exposes exactly Copy, Open in email (`mailto:`) and Mark as sent; enforced by an ESLint boundary for `lib/ai/**`, a TypeScript import-graph walk with a planted non-vacuity case, and a single-implementation assertion (`mailto:` and `navigator.clipboard` appear only in `exits.ts`) (Phase 5)

Validated in Phase 6: Renter Portal (2026-10-06) — 8/8 must-haves verified against the codebase; `pnpm verify` green in one run (3180 unit tests, 774 browser tests on both base paths with a deny-all network harness, CSP oracle on 17+17 pages, scoped renter banned-terms gate, secret and real-data scans, actionlint); 44/44 validation rows walked; a full live-mode renter journey spends exactly 3 RentCast calls. Twelve owner-gated checks (R1–R12: real-key journey, real OSM tiles and attribution, the real 24-hour saved-search boundary, real AI key, real phones and screen readers) are parked in `06-HUMAN-UAT.md`.

- ✓ RENT-01 — Search any US city or ZIP with one fetch-wide RentCast call; price, bedrooms, property type and "listed within N days" filter locally at 0 calls; URL state restores without spending; 500-row truncation offers one explicit "Narrow on RentCast (1 call)"; keyless sample search (Phase 6)
- ✓ RENT-02 — Sortable list in pages of 24 and a lazily loaded Leaflet + OpenStreetMap map with clustering, keyboard-operable pins, desktop split view and list↔map linking; sample mode draws a backdrop with zero tile requests (Phase 6)
- ✓ RENT-03 — Listing detail resolves at 0 calls from shortlist, cache or fixtures, with price/event history including Delisted/Relisted, sparkline, safe `tel:`/`mailto:` contact links and look-it-up-elsewhere links (Phase 6)
- ✓ RENT-04 — Save/rename/delete up to 10 searches; "N new since last visit" counts only listings still matching the saved filters; re-runs ride Phase 4's once-per-24-hour scheduler, proven under a controlled clock (Phase 6)
- ✓ RENT-05 — Shortlist board with Saved/Contacted/Toured/Applied/Signed status sections, explicit notes, confirmed removal and rent-change notices, all from stored snapshots at 0 calls (Phase 6)
- ✓ RENT-06 — Fair-rent check: ZIP median by bedroom count (0 calls when cached) and an optional rent estimate with range, confidence and up to 10 comparables, each cost shown before the single call (Phase 6)
- ✓ RENT-07 — Outreach draft from six Fair-Housing-safe inputs through the Phase 5 panel; a flagged phrase blocks every exit; the only outbound path is the renter's own email client (Phase 6)
- ✓ RENT-08 — Zero-call affordability calculator at `/renter/affordability/` as an import-free shared component (Phase 6)

Validated in Phase 7: Investor Portal (2026-10-06) — 6/6 must-haves verified against the codebase; `pnpm verify` green in one run (4140 unit tests, 1062 browser tests on both base paths, CSP oracle on 25+25 pages, nine hand-checked reference deals exact to the cent, secret and real-data scans, actionlint); 57/57 validation rows walked; a keyed investor demo journey spends exactly 6 RentCast calls. Thirteen owner-gated checks (I1–I13) and two copy sign-offs (S1–S2) are parked in `07-HUMAN-UAT.md`.

- ✓ INV-01 — Pure integer-cents deal analyzer (NOI, cap rate, cash flow, cash-on-cash, DSCR, GRM, 1% rule, amortization, editable expense lines) matching nine reference cases exactly, with property-tested invariants; `/investor/analyze/` with live results and draft autosave (Phase 7)
- ✓ INV-02 — Fully manual entry proven at zero calls; "Autofill rent/value estimate (1 call)" shows cost first, never overwrites typed values without confirmation, and tags filled fields with provenance (Phase 7)
- ✓ INV-03 — Saved deals list with sort and confirmed delete; compare up to three deals with Highest/Lowest marks by color and icon, stacked at phone width (Phase 7)
- ✓ INV-04 — Buy boxes over for-sale listings on Phase 4's saved-search scheduler (no second scheduler), new-since flags, zero-call quick metrics from ZIP median rent, "Load ZIP rents (1 call)" and "Deep analyze (2 calls)" (Phase 7)
- ✓ INV-05 — Watch up to five ZIPs; rent-trend-by-bedroom and price-to-rent LayerChart dashboards with data-table alternatives and null months as gaps; a ZIP costs one call only when uncached (Phase 7)
- ✓ INV-06 — `investor/memo.v1` receives only formatted analyzer facts and notes; a numeric post-check flags any number not in the analysis, an advice-language check blocks promises; chrome-free `/print/memo/` prints to PDF with the not-investment-advice disclaimer top and bottom (Phase 7)

Validated in Phase 8: Agent Portal: Profile, Lead Intake & CRM (2026-10-07) — 5/5 success criteria and 7/7 requirements verified against the codebase; artifacts and key links of all 27 plans verified. Seven owner-gated checks (real Web3Forms delivery, paste-back from real mail clients and more) are parked in `08-HUMAN-UAT.md`.

- ✓ AGT-01 — Agent profile (name, brokerage, license number, state, logo, brand colors, postal address) automatically appends the required disclosures to exports and generated content (Phase 8)
- ✓ AGT-02 — Shareable inquiry page emails new leads through the agent's own Web3Forms key, with spam protection (Phase 8)
- ✓ AGT-03 — Lead import by pasting a lead email or manual entry, with duplicate detection (Phase 8)
- ✓ AGT-04 — Drag-and-drop pipeline New → Contacted → Touring → Offer → Closed (Phase 8)
- ✓ AGT-05 — Follow-up tasks with a due-today queue on opening the app (Phase 8)
- ✓ AGT-06 — AI follow-up email drafts with CAN-SPAM elements (postal address, opt-out line) (Phase 8)
- ✓ AGT-07 — Contact CSV import and export (Phase 8)

Validated in Phase 9: Agent Content Studio & Market Snapshot Reports (2026-10-13) — 10/10 must-haves verified after one gap-closure round (09-24/09-25: every studio and host exit (Copy, email, Mark as sent, social-card Copy, Snapshot Save, memo Print) flushes a pending edit recheck before reading the Fair Housing gate; the original stale-gate probe is now refused and mutation-checked). Full unit suite 5851/5852 (one isolated-pass load flake), svelte-check, lint and guards clean. Eight owner/counsel checks (UAT-1..8: real-key prints in three browsers, real social composers, NY/CA disclosure read-through, owner decisions) are parked in `09-HUMAN-UAT.md`.

- ✓ STU-01 — Listing description from agent-entered facts, gated by the Fair Housing checker (Phase 9)
- ✓ STU-02 — Instagram, Facebook and LinkedIn post pack with the brokerage disclosure appended (Phase 9)
- ✓ STU-03 — Founder-story reel script (hook → manual pain → before/after → results → mission → CTA) with timed beats, captions, B-roll list and an AI-disclosure checklist (Phase 9)
- ✓ STU-04 — Branded Market Snapshot report for a ZIP code that prints to PDF, labeled not a CMA or appraisal (Phase 9)

Phase 10: Launch Hardening & Go-to-Market shipped 2026-10-14 (23/23 plans, 5/5 success criteria verified locally). GTM-01..04 stay Active on purpose: their proof (Umami pageviews, Web3Forms delivery, share cards, Search Console) needs the live origin and the owner's accounts (10-HUMAN-UAT.md, 8 rows).

Validated in Phase 11: Zillow Sponsored Listing Filter Extension (2026-10-29) — 4/4 must-haves verified against the production build (241 extension unit tests, 13 popup axe tests, 7 runtime E2E incl. a zero-network monitored session, manifest/bundle/zip oracle). `human_needed`: 7 owner rows in 11-HUMAN-UAT.md (live zillow.com smoke, real-browser zero-network check, the "Showcase" badge decision, Zillow ToU read, privacy URL live, Edge Add-ons submission, `ext-v0.1.0` release once the remote exists); Firefox Add-ons cut per the roadmap cut line.

- ✓ EXT-01 — Zillow user with the extension installed sees sponsored or promoted listing cards dimmed, with a one-click reveal on each (Phase 11)
- ✓ EXT-02 — User can toggle the filter on/off and see the count of hidden sponsored listings from the toolbar popup (Phase 11)
- ✓ EXT-03 — Extension makes no network requests and collects no data (permissions limited to storage and zillow.com) (Phase 11)
- ✓ EXT-04 — User can install the extension from a GitHub Releases zip (with load-unpacked instructions), Microsoft Edge Add-ons, or Firefox Add-ons (Phase 11)

### Active

**Platform (shared)**
- [x] One SvelteKit app, statically built for GitHub Pages under a dedicated free GitHub organization (own origin `tranrealestate.github.io`), with the landing page, audience pages, legal pages and branded portal placeholders — skeleton in Phase 1, real marketing surface in Phase 2
- [x] Bring-your-own-key settings: user pastes a RentCast API key and an LLM key (Claude / OpenAI / Gemini / OpenRouter); keys stored only in that browser, sent only to the provider — shipped in Phase 3 (key testing hook lands with each provider in Phases 4–5)
- [x] Demo mode with synthetic fixture data when no key is present, plus onboarding on getting a free RentCast key (never a bundled shared key) — shipped in Phase 4 (sample gateway + fixtures; the "Getting started" onboarding section lands in Phase 10)
- [x] Shared RentCast data layer: single gateway with IndexedDB cache, request dedupe, visible monthly call meter, and a default hard stop before the free 50-call limit (overage is $0.20/call with no provider-side cap) — shipped in Phase 4
- [x] Local data durability: JSON export/import backup and persistent-storage request (Safari evicts after 7 days idle) — shipped in Phase 3
- [x] Deterministic Fair Housing copy checker gating all AI-generated housing text, plus not-financial-advice / not-a-brokerage disclaimers — checker shipped in Phase 5, disclaimers on the Phase 2 legal pages
- [ ] Warm editorial visual identity (warm palette, elegant serif headings, cinematic imagery) designed with UI/UX Pro Max
- [x] GTM surface: marketing landing pages per audience that explain the value and drive usage — shipped in Phase 2 (`/`, `/for-renters/`, `/for-investors/`, `/for-agents/`)

**Renter portal**
- [x] Saved-search alerts: filter nationwide rentals by price, location, bedrooms, property type, and days-on-market; saved searches re-run on app open only when cache is stale, highlighting "N new since last visit" — shipped in Phase 6
- [x] AI outreach drafts: draft an interest message to the listing agent (asking about availability, pets, amenities not in the data); human reviews and sends — shipped in Phase 6
- [x] Fair-rent check: compare a listing's asking rent against estimated market rent — shipped in Phase 6
- [x] Zillow sponsored filter: MV3 browser extension that only hides promoted/sponsored listing cards on Zillow pages the user views (no network calls, no scraping); distributed free via load-unpacked zip + Edge Add-ons — shipped in Phase 11 (`apps/extension`: dim-with-reveal, popup toggle + count, storage + zillow.com permissions only, gated GitHub Release workflow, Edge listing copy; store submission and the live-site smoke are owner steps)

**Investor portal**
- [x] Deal analyzer: cap rate, NOI, cash flow, cash-on-cash return, DSCR using rent estimates and comps — shipped in Phase 7
- [x] Deal-flow alerts: saved buy-box searches over for-sale listings, re-run on app open when stale — shipped in Phase 7
- [x] Market dashboards: rent trends, price-to-rent, and related market stats by zip — shipped in Phase 7
- [x] AI investment memo: one-click proposal/report generated from a deal analysis, exportable — shipped in Phase 7

**Agent portal**
- [x] Lead capture + inbox: shareable inquiry form delivering to the agent's email via Web3Forms (free tier); agent imports leads into the app by pasting the email (free tiers have no read API) — shipped in Phase 8
- [x] AI content studio: generate listing descriptions, social posts, and founder-story video scripts — shipped in Phase 9
- [x] Client CRM + follow-ups: track leads locally with AI follow-up reminders and drafted messages — shipped in Phase 8
- [x] Market reports: branded market reports (no demographic/school/crime data) agents can export and send to clients — shipped in Phase 9 (Market Snapshot)

### Out of Scope

- MLS API / IDX / VOW data — no broker or agent sponsor; authorization cannot be obtained legitimately right now
- Scraping Zillow (or any site) — violates Zillow Terms of Use; no public Zillow API since 2021
- Faking credentials or implying Tran is a licensed brokerage — explicit user requirement: legitimate access only
- NYU CoStar in any form (product, repo, or offline research for Tran) — CoStar academic terms prohibit use with direct or indirect benefit, financial or otherwise
- Hosted backend, user accounts, and Stripe billing — v1 is free-only and browser-only; paid SaaS must also move off GitHub Pages (Pages terms disallow commercial SaaS)
- Server-side scheduled jobs / email alert digests — no backend in v1; alerts are check-on-open
- A shared/bundled RentCast demo key — RentCast terms make keys confidential and non-shareable
- Committing real RentCast responses to the public repo — use synthetic fixtures only
- Auto-sending outreach emails/SMS — human-in-the-loop send only (CAN-SPAM/TCPA and reputation risk)
- Tenant screening or housing-eligibility decisions — Fair Housing risk; restricted by LLM provider usage policies
- Hosting under the shared `wolfwdavid.github.io` origin — browser storage is shared with every sibling Pages site, exposing stored keys
- Paid Chrome Web Store listing in v1 — $5 fee breaks $0 budget; load-unpacked + Edge Add-ons instead

## Context

- **Origin:** A viral thread argued Zillow shows a "limited slice" (paid listings promoted first) and proposed pulling MLS rentals via a legitimate API into a database, auto-filtering, and drafting agent outreach. Feasibility review concluded the code is medium difficulty but MLS *access* is the hard, non-code part; MLS also doesn't include all rentals.
- **Data source:** RentCast API — nationwide active rental and sale listings, rent/value estimates, comps, zip-level market stats. Browser-callable (CORS `*`, GET + `x-api-key` only). Terms permit display/redistribution; keys are confidential. Only HTTP 200 responses are billed; free tier 50 calls/month, overage $0.20/call. Listings lack photos, descriptions, amenities, pet policy, and availability date; listing agent email/phone are present. One search returns up to 500 listings, so client-side filtering stretches calls.
- **LLM providers:** Anthropic (official browser header), OpenAI (`dangerouslyAllowBrowser`, Responses API; historically brittle CORS), Gemini (browser build; free tier may use content for training → warn before sending client/CRM data).
- **Lead forms:** Web3Forms free = 250 submissions/month, email delivery only; read API is paid.
- **Compliance:** HUD withdrew its 2024 AI/digital-advertising guidance (2025/2026), but the Fair Housing Act and 24 CFR 100.75 still apply; New York AI advertising disclosure law effective June 2026; state rules require brokerage/license disclosure on agent ads.
- **Reference content:** Callen Faulkner / The Uncommon Business 63-second founder-story reel. Serves as a GTM content template (hook → manual pain → before/after → results → mission → CTA) for the agent content studio and marketing pages, and as the visual mood reference (warm cinematic B-roll, serif captions).
- **Brand:** Public brand is "Tran Real Estate Tools" (descriptor avoids implying a licensed brokerage); Tran is also the client behind the sibling AI trading desk (`Websites/Tran/Tran_desktop`, Svelte frontend).
- **Research:** `.planning/research/` (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY) — 2026-09-13.

## Current State

**Shipped v1.0 MVP on 2026-10-29** (11 phases, 209 plans, 475 tasks, 1,206 commits, ~165k lines). Everything in the v1 scope is built and verified locally: three portals, the key vault and budget-guarded data layer, four BYOK LLM providers behind the Fair Housing gate, the launch surface, and the Zillow extension. Gates: 6,647 unit tests, 2,327 E2E with axe on every route, launch audit all rows PASS, dependency audit clean with four reviewed low exceptions.

**Not yet live.** The repository has no git remote. The `tranrealestate` GitHub org and `tranrealestate.github.io` repo do not exist. The "live demo of all 3 portals" half of the v1 definition of done is owner action (`docs/DEPLOY-CHECKLIST.md` steps 1-9), as are the 77 HUMAN-UAT rows and GTM-01..04.

Archive: `.planning/milestones/v1.0-ROADMAP.md`, `v1.0-REQUIREMENTS.md`, `v1.0-MILESTONE-AUDIT.md`; summary in `.planning/MILESTONES.md`; lessons in `.planning/RETROSPECTIVE.md` and `tasks/lessons.md`.

## Next Milestone Goals

Not yet defined (`/gsd:new-milestone`). Candidates from the v1.0 audit:

- **Go live:** org + repo + Pages, then the owner UAT burn-down and GTM-01..04 proof on the real origin.
- **Extension release:** Edge Add-ons listing, `ext-v0.1.0` GitHub Release, the "Showcase" badge decision, a live-Zillow smoke.
- **Carry-forward debt:** origin drift test, backup round-trip spec across all portal stores, tailwind-merge font-size token class, ListingCard address-link id, print recheck without notes, save-gate reason text, one load-sensitive spec.
- **Maintenance:** SvelteKit 3 migration (clears three low audit exceptions), Vitest 5, pnpm 12.
- **Product (parked since v1 questioning):** paid tiers need a host other than GitHub Pages (commercial-use terms); accounts and billing were explicitly out of v1 scope.

## Constraints

- **Tech stack**: SvelteKit 2 (Svelte 5) + adapter-static, TypeScript pinned to 6.x, Tailwind 4 + shadcn-svelte, Dexie, pnpm workspace — user requirement (Svelte) + research
- **Workflow**: GSD for planning/execution; UI/UX Pro Max skill active for all UI work — user requirement
- **Hosting**: GitHub Pages under a dedicated free GitHub organization (own origin); Hugging Face only if needed — user decision, $0
- **Budget**: $0/month — RentCast free tier + BYOK; no paid infra, no paid store listings
- **No backend**: browser-only; secrets user-supplied and stored client-side; nothing secret committed (public repo); CSP via meta tag restricting connect-src to provider hosts
- **Legal/compliance**: legitimate data only — no scraping, no MLS without authorization, no CoStar, respect RentCast terms, human-in-the-loop outreach, Fair Housing-safe AI copy, not-a-brokerage disclaimers
- **Market**: nationwide US from day one (any US city/zip; every search requires a location)
- **Accessibility/responsive**: mobile widths and WCAG AA contrast

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| GTM = go-to-market SaaS for renters, investors, agents | User clarified; one product per audience | — Pending |
| One platform, three portals (not three sites) | Shared data layer, brand, and deploy | — Pending |
| RentCast as listing data source instead of MLS | No sponsor → MLS not legitimately accessible; nationwide + free tier + browser CORS | — Pending |
| BYOK for RentCast and LLM keys, stored in browser | $0 budget + no backend + public repo; RentCast keys non-shareable | — Pending |
| No backend / accounts / billing in v1 | User chose free-only; v1 done = live demo of all 3 portals | — Pending |
| Dedicated free GitHub org for Pages origin | Shared wolfwdavid.github.io origin would expose stored keys to sibling sites | — Pending |
| Client-side hard stop before RentCast free limit | Overage billed at $0.20/call with no provider cap | — Pending |
| Lead inbox = Web3Forms email delivery + paste-to-import | Free tiers have no read API | — Pending |
| Alerts re-run on app open when cache is stale | No background server; protects call budget | — Pending |
| Zillow filter as hide-only MV3 extension, load-unpacked + Edge Add-ons | ToS-safe, no scraping; $0 distribution | — Pending |
| No CoStar at all | Academic terms prohibit indirect/financial benefit (reversed earlier "offline research" decision) | — Pending |
| Include Gemini in v1 with training-data warning | User choice; Claude + OpenAI + Gemini | — Pending |
| Deterministic Fair Housing checker on AI copy | FHA still applies after HUD guidance withdrawal; NY AI ad law | — Pending |
| Warm editorial visual direction | Matches reference video's premium, trustworthy mood | — Pending |
| Public brand = "Tran Real Estate Tools" | "Real Estate" alone implies a licensed brokerage; descriptor signals a software tool | — Pending |
| Analytics = first-party fetch beacon to Umami free tier, no third-party scripts | Any script on the origin can read stored keys; page/portal events only, no PII | — Pending |
| GitHub org name `tranrealestate` → `tranrealestate.github.io` | Dedicated origin; name available 2026-09-13; owner creates org in browser | — Pending |
| v1 depth = all three portals at capped depth | Honors "live demo of all 3 portals" without solo-build scope creep; each portal phase has demo-credible exit criteria and a named cut line | — Pending |
| Zillow detection: ad-slot list items are the primary signal; label text is secondary | Live zillow.com (2026-10-25) shows no visible "Sponsored/Featured" label on any card; paid placements render as iframe ad-slot `li`s (`search-list-{first,second,third}-ad`). The "Showcase" paid badge stays opt-in until the owner decides (11-HUMAN-UAT row 3) | ✓ Phase 11 |
| Audit exceptions only for code that never ships, with proof | `pnpm audit --audit-level low` moves between phases (12 advisories on unchanged pins appeared 2026-10-23). Patch-level bumps are applied; a major-only fix (Kit 2→3, build-time deepmerge) is recorded in `scripts/lib/audit-exceptions.mjs` with a grep of the shipped output and a revisit date | ✓ Phase 11 close-out |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-29 after v1.0 milestone*
