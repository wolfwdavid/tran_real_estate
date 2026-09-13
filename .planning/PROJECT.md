# Tran Real Estate

## What This Is

Tran Real Estate is a go-to-market (GTM) SaaS platform: one Svelte web app with three portals — **Renters**, **Investors**, and **Agents** — covering the entire United States. It replaces "refreshing Zillow all day" with tools that bring matching listings, deal math, and outreach to the user, powered by legitimate listing data (RentCast) and AI drafting. It runs at $0 infrastructure cost: a static site on GitHub Pages where each user brings their own data and AI API keys.

## Core Value

A visitor in any of the three portals can go from "what I'm looking for" to an actionable result — matching listings, an analyzed deal, or a ready-to-send message — in minutes instead of hours, using only legitimate data sources.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Platform (shared)**
- [ ] One SvelteKit app, statically built and deployed to GitHub Pages, with a landing page that routes to Renter / Investor / Agent portals
- [ ] Bring-your-own-key settings: user pastes a RentCast API key and an LLM key (Claude / OpenAI / Gemini); keys stored only in that browser, never sent anywhere except the provider
- [ ] Demo-safe experience when no key is present (clear onboarding explaining how to get a free RentCast key)
- [ ] Shared data layer: typed RentCast client with caching to conserve the 50-call/month free tier
- [ ] Warm editorial visual identity (warm palette, elegant serif headings, cinematic imagery) designed with UI/UX Pro Max
- [ ] GTM surface: marketing landing pages per audience that explain the value and drive sign-up/usage

**Renter portal**
- [ ] Saved-search alerts: filter nationwide rentals by price, location, bedrooms, property type, availability; saved searches re-run on app open and highlight "N new since last visit"
- [ ] AI outreach drafts: draft an interest message to the listing agent/landlord; human reviews and sends
- [ ] Fair-rent check: compare a listing's asking rent against estimated market rent
- [ ] Zillow sponsored filter: browser extension that hides promoted/sponsored listing cards on Zillow pages the user is viewing (client-side only, no scraping)

**Investor portal**
- [ ] Deal analyzer: cap rate, cash flow, cash-on-cash return using rent estimates and comps
- [ ] Deal-flow alerts: saved buy-box searches over for-sale listings, re-run on app open
- [ ] Market dashboards: rent trends, price-to-rent, and related market stats by zip/metro
- [ ] AI investment memo: one-click proposal/report generated from a deal analysis

**Agent portal**
- [ ] Lead inbox: renter/investor inquiries delivered to the agent via a free form service (Web3Forms/Formspree)
- [ ] AI content studio: generate listing descriptions, social posts, and founder-story video scripts
- [ ] Client CRM + follow-ups: track leads locally with AI follow-up reminders and drafted messages
- [ ] Market reports: branded neighborhood/market reports agents can export and send to clients

### Out of Scope

- MLS API / IDX / VOW data — no broker or agent sponsor; authorization cannot be obtained legitimately right now
- Scraping Zillow (or any site) — violates Zillow Terms of Use; no public Zillow API since 2021
- Faking credentials or implying Tran is licensed — explicit user requirement: legitimate access only
- CoStar data in the product or repo — NYU Libraries access is academic-licensed; used for offline market research only
- Hosted backend, user accounts, and Stripe billing — v1 is free-only and browser-only; paid SaaS mechanics come after the demo validates demand
- Server-side scheduled jobs / email alert digests — no backend in v1; alerts are check-on-open
- Publishing RentCast data into the public repo or static JSON — RentCast license likely forbids redistribution; data is fetched per-user with their own key
- Auto-sending outreach emails — human-in-the-loop send only (CAN-SPAM and reputation risk)

## Context

- **Origin:** A viral thread argued Zillow shows a "limited slice" (paid listings promoted first) and proposed pulling MLS rentals via a legitimate API into a database, auto-filtering, and drafting agent outreach. Feasibility review concluded the code is medium difficulty but MLS *access* is the hard, non-code part; MLS also doesn't include all rentals (landlord-direct, large property managers).
- **Data source decision:** RentCast API offers nationwide active rental and sale listings, rent/value estimates, comps, and market stats without MLS sponsorship; free tier is 50 calls/month, so caching and BYOK are essential.
- **Reference content:** Callen Faulkner / The Uncommon Business 63-second founder-story reel (real-estate investor turned AI educator; "a task that took an hour now takes two minutes"). Serves as (a) a GTM content template — hook → manual pain → before/after moment → results → mission → CTA — for the Agent content studio and marketing pages, and (b) the visual mood reference (warm cinematic B-roll, serif captions).
- **Brand:** "Tran Real Estate" is the working brand name. Tran is also the client behind the sibling AI trading desk project (`Websites/Tran/Tran_desktop`), which already uses a Svelte frontend.
- **NYU CoStar:** The user has CoStar access through NYU Libraries (NYU login + Duo). Use only for the user's own offline research to validate assumptions (e.g., rent benchmarks); never ingest, commit, or display it.
- **Owner context:** Mechanical-engineer/ML full-stack developer; comfortable with Svelte, GitHub Pages, Hugging Face Spaces.

## Constraints

- **Tech stack**: Svelte/SvelteKit with static adapter — user requirement
- **Workflow**: GSD for planning/execution; UI/UX Pro Max skill active for all UI work — user requirement
- **Hosting**: GitHub Pages from public repo `wolfwdavid/tran_real_estate`; Hugging Face only if needed — user requirement, $0
- **Budget**: $0/month to start — RentCast free tier + BYOK; no paid infra
- **No backend**: browser-only; all secrets are user-supplied and stored client-side; nothing secret ever committed (public repo)
- **Legal/compliance**: legitimate data only — no scraping, no MLS without authorization, no CoStar in product, respect RentCast terms, human-in-the-loop outreach, Fair Housing-safe AI copy
- **Market**: nationwide US from day one
- **Accessibility/responsive**: must work on mobile widths and meet WCAG AA contrast (UI/UX Pro Max standard)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| GTM = go-to-market SaaS for renters, investors, agents | User clarified; one product per audience | — Pending |
| One platform, three portals (not three sites) | Shared data layer, brand, and deploy; less duplication | — Pending |
| RentCast as listing data source instead of MLS | No sponsor → MLS not legitimately accessible; RentCast is nationwide and has a free tier | — Pending |
| BYOK for RentCast and LLM keys, stored in browser | $0 budget + no backend + public repo; avoids redistributing licensed data | — Pending |
| No backend / accounts / billing in v1 | User chose free-only; v1 done = live demo of all 3 portals | — Pending |
| Lead inbox via Web3Forms/Formspree free tier | Delivers inquiries to agents with no server | — Pending |
| Alerts re-run on app open | No background server in v1 | — Pending |
| Zillow filter as client-side browser extension | Only ToS-safe way to hide sponsored results; no scraping | — Pending |
| CoStar (NYU) offline research only | Academic license prohibits commercial product use | — Pending |
| Warm editorial visual direction | Matches reference video's premium, trustworthy mood | — Pending |
| Brand = "Tran Real Estate" (working name) | User choice | — Pending |

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
*Last updated: 2026-09-13 after initialization*
