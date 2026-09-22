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

### Active

**Platform (shared)**
- [x] One SvelteKit app, statically built for GitHub Pages under a dedicated free GitHub organization (own origin `tranrealestate.github.io`), with placeholder routes for the landing page and Renter / Investor / Agent portals — skeleton shipped in Phase 1; real pages arrive in Phase 2
- [ ] Bring-your-own-key settings: user pastes a RentCast API key and an LLM key (Claude / OpenAI / Gemini); keys stored only in that browser, sent only to the provider
- [ ] Demo mode with synthetic fixture data when no key is present, plus onboarding on getting a free RentCast key (never a bundled shared key)
- [ ] Shared RentCast data layer: single gateway with IndexedDB cache, request dedupe, visible monthly call meter, and a default hard stop before the free 50-call limit (overage is $0.20/call with no provider-side cap)
- [ ] Local data durability: JSON export/import backup and persistent-storage request (Safari evicts after 7 days idle)
- [ ] Deterministic Fair Housing copy checker gating all AI-generated housing text, plus not-financial-advice / not-a-brokerage disclaimers
- [ ] Warm editorial visual identity (warm palette, elegant serif headings, cinematic imagery) designed with UI/UX Pro Max
- [ ] GTM surface: marketing landing pages per audience that explain the value and drive usage

**Renter portal**
- [ ] Saved-search alerts: filter nationwide rentals by price, location, bedrooms, property type, and days-on-market; saved searches re-run on app open only when cache is stale, highlighting "N new since last visit"
- [ ] AI outreach drafts: draft an interest message to the listing agent (asking about availability, pets, amenities not in the data); human reviews and sends
- [ ] Fair-rent check: compare a listing's asking rent against estimated market rent
- [ ] Zillow sponsored filter: MV3 browser extension that only hides promoted/sponsored listing cards on Zillow pages the user views (no network calls, no scraping); distributed free via load-unpacked zip + Edge Add-ons

**Investor portal**
- [ ] Deal analyzer: cap rate, NOI, cash flow, cash-on-cash return, DSCR using rent estimates and comps
- [ ] Deal-flow alerts: saved buy-box searches over for-sale listings, re-run on app open when stale
- [ ] Market dashboards: rent trends, price-to-rent, and related market stats by zip
- [ ] AI investment memo: one-click proposal/report generated from a deal analysis, exportable

**Agent portal**
- [ ] Lead capture + inbox: shareable inquiry form delivering to the agent's email via Web3Forms (free tier); agent imports leads into the app by pasting the email (free tiers have no read API)
- [ ] AI content studio: generate listing descriptions, social posts, and founder-story video scripts
- [ ] Client CRM + follow-ups: track leads locally with AI follow-up reminders and drafted messages
- [ ] Market reports: branded market reports (no demographic/school/crime data) agents can export and send to clients

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
*Last updated: 2026-09-22 after Phase 1 completion*
