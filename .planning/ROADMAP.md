# Roadmap: Tran Real Estate Tools

## Overview

Tran Real Estate Tools ships as one static SvelteKit app on its own dedicated origin (`tranrealestate.github.io`) with three portals (Renter, Investor, Agent) plus a companion Zillow sponsored-listing filter extension, all at $0 infrastructure cost. The journey builds shared infrastructure first and portals second, ordered so every risk mitigation lands before the feature that triggers it. The order is: the security baseline and dedicated origin before any key storage; storage, key vault, and backup before the data gateway and AI layer; the RentCast budget cap and synthetic fixtures before any portal spends a call; the Fair Housing checker before any AI generator; and the agent profile before studio and report features. Every portal phase must be demo-credible and has a named cut line. When scope pressure hits, cut depth inside a portal. Never cut the shared infrastructure (demo fixtures, budget cap, Fair Housing checker, backup). The extension depends only on the foundation and brand phases and never blocks the web launch.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

**Numbering note vs. research:** `research/SUMMARY.md` lists the extension as P10 and launch as P11. This roadmap swaps them (Launch = Phase 10, Extension = Phase 11), so the default numeric order launches the web app first and the slippable extension can never block it. The extension can still be pulled forward any time after Phase 2.

- [ ] **Phase 1: Foundation, Origin & Security Baseline** - Dedicated-origin static deploy with strict meta CSP, frame-bust, CI gate, and secret/PII blocking
- [ ] **Phase 2: Brand System, Marketing & Legal Pages** - Warm-editorial accessible landing, per-audience pages, legal pages, and portal switcher
- [ ] **Phase 3: Local Platform: Storage, Key Vault & Backup** - Browser-only key vault (session / remember / passphrase), JSON backup, persistence status, PWA install
- [ ] **Phase 4: Data Layer: RentCast Gateway, Budget Guard & Demo Fixtures** - Single metered, cached, hard-capped RentCast gateway plus synthetic sample data and check-on-open alerts engine
- [ ] **Phase 5: AI Layer: Providers, Streaming & Fair Housing Guardrails** - BYOK streaming across four providers with a deterministic Fair Housing checker and no auto-send path
- [ ] **Phase 6: Renter Portal** - Nationwide rental search, map, saved-search alerts, shortlist, fair-rent check, affordability, AI agent outreach
- [ ] **Phase 7: Investor Portal** - Deal analyzer, manual/autofill modes, deal compare, buy-box alerts, watched-zip dashboards, AI memo to PDF
- [ ] **Phase 8: Agent Portal: Profile, Lead Intake & CRM** - Agent profile with disclosures, Web3Forms inquiry page, paste import, pipeline, tasks, AI follow-ups, CSV
- [ ] **Phase 9: Agent Content Studio & Market Snapshot Reports** - Listing descriptions, social post pack, founder-story reel scripts, branded Market Snapshot PDF
- [ ] **Phase 10: Launch Hardening & Go-to-Market** - First-run onboarding, waitlist/feedback, SEO calculator pages, first-party analytics, full launch audit
- [ ] **Phase 11: Zillow Sponsored Listing Filter Extension** - Hide-only MV3 extension with zero network, distributed via GitHub Releases + Edge Add-ons

## Dependency Graph & Parallelization

```
P1 Foundation ─┬─► P2 Brand/Marketing ──────────────────────────────┬─► P11 Extension (slippable, never blocks P10)
               │                                                     │
               └─► P3 Local Platform ─┬─► P4 Data Layer ─┬─► P6 Renter ───┐
                                      │                  ├─► P7 Investor ─┼─► P9 Studio + Reports ─► P10 Launch & GTM
                                      └─► P5 AI Layer ───┴─► P8 Agent CRM ┘
```

| Wave | Phases | Can run in parallel because |
|------|--------|------------------------------|
| A | 1 | Root of everything |
| B | 2, 3 | Both need only Phase 1. Phase 3 Settings UI adopts brand tokens once Phase 2 lands. |
| C | 4, 5 | Both need only Phase 3 (and Phase 2 for UI) |
| D | 6, 7, 8 | Renter and Investor need 4+5. Agent CRM needs only 3+5 and can start as soon as Phase 5 is done. ESLint portal-import boundaries prevent collisions. |
| E | 9 | Needs Phase 7 (print pipeline, market stats) and Phase 8 (agent profile) |
| F | 10 | Needs all web phases 1-9 (not Phase 11) |
| Floating | 11 | Needs only Phases 1+2. It can run in any wave after B and may slip past launch. |

**Ordering constraints enforced (from research):**
- Origin/CSP/security baseline (P1) comes before any key storage (P3)
- Storage/vault/backup (P3) comes before the data gateway (P4) and the AI layer (P5)
- The RentCast budget cap and synthetic fixtures (P4) come before any portal spends calls (P6, P7, P9)
- The Fair Housing checker AI-02 (P5) comes before any AI generator (P6 RENT-07, P7 INV-06, P8 AGT-06, P9 STU-01..04)
- The agent profile AGT-01 (P8) comes before studio/report features (P9)
- The extension (P11) depends only on P1+P2 and does not block the web launch (P10)

**Demo-credible standard (applies to every portal phase: 6, 7, 8, 9):**
1. Works fully on clearly badged synthetic sample data with no keys
2. Works under the RentCast call budget with a real key (hard cap never bypassed without confirmation)
3. All AI copy passes the Fair Housing checker before it can be copied or sent
4. axe accessibility checks pass on every route in the phase (keyless and keyed states)

**Cut-line policy:** If a portal phase overruns, cut in the named order. Cutting a v1 requirement moves it to v2 in REQUIREMENTS.md. Never cut shared infrastructure.

## Phase Details

### Phase 1: Foundation, Origin & Security Baseline
**Goal**: The app is live on its own dedicated origin with a strict security baseline, and a CI gate blocks any broken, insecure, or secret-leaking push from deploying
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05
**Success Criteria** (what must be TRUE):
  1. Visitor loads `https://tranrealestate.github.io/`, navigates to a portal route, refreshes on that deep link, and gets the page, not a 404. The same build passes an end-to-end smoke test under a non-root `BASE_PATH` in CI.
  2. Viewing the source of any deployed page shows the Content-Security-Policy meta tag first in `<head>`. Its `connect-src` allows only RentCast, Anthropic, OpenAI, Gemini, OpenRouter, Web3Forms, and the analytics beacon host, with no `unsafe-inline`/`unsafe-eval`. A CI assertion fails the build if this regresses.
  3. Loading any app page inside a third-party iframe does not render the app inside the frame.
  4. A push with a failing typecheck, lint, unit, end-to-end, or axe check does not deploy. A push where everything passes deploys to GitHub Pages automatically (deploy job uses `concurrency`).
  5. Pushing a commit containing a test API-key pattern is rejected by secret-scanning push protection. A commit adding PII-shaped listing data or a CoStar-pattern path fails CI.
**Plans**: 9 plans (waves 0-6)
- [x] 01-01-PLAN.md - Workspace, toolchain & commit gates (wave 0)
- [x] 01-02-PLAN.md - Unit-test harness & workspace packages (wave 1)
- [x] 01-03-PLAN.md - Web skeleton, base path & prerendered routes (wave 2)
- [x] 01-04-PLAN.md - CSP contract assertion & mutation tests (wave 3)
- [ ] 01-05-PLAN.md - Pages emulator, Playwright harness & routing E2E (wave 4)
- [ ] 01-06-PLAN.md - Quality-gate rule tests (lint boundaries, PII rules, pre-commit) (wave 3)
- [ ] 01-07-PLAN.md - Browser security & accessibility specs (CSP, framing, axe) (wave 5)
- [ ] 01-08-PLAN.md - CI workflow, actionlint & gated Pages deploy (wave 5)
- [ ] 01-09-PLAN.md - Full-suite verification & deferred hosting handoff (wave 6)

**Wave summary**: 0 = 01-01 | 1 = 01-02 | 2 = 01-03 | 3 = {01-04, 01-06} | 4 = 01-05 (sole owner of `apps/web/build*` while the E2E suite serves them) | 5 = {01-07, 01-08} | 6 = 01-09
**Research flag**: YES. Needs `/gsd:research-phase`: org Pages setup (org root repo vs. project repo + `BASE_PATH`), `kit.csp` meta emission on prerendered adapter-static pages, Pages `trailingSlash` and `.nojekyll` behavior.
**UI hint**: no (smoke shell only)
**Human action required (before deploy)**: The owner must create the free GitHub organization `tranrealestate` in the browser, because organizations cannot be created via the API. The owner then creates or transfers the repo into the org and enables GitHub Pages and secret scanning with push protection in the org/repo settings. Deploy steps block until this is done.

### Phase 2: Brand System, Marketing & Legal Pages
**Goal**: Visitors land on a warm-editorial, accessible marketing surface that explains Tran Real Estate Tools, routes them to the right portal, and states plainly what Tran is and is not
**Depends on**: Phase 1 (can run in parallel with Phase 3)
**Requirements**: BRND-01, BRND-02, BRND-03, BRND-04, BRND-05
**Success Criteria** (what must be TRUE):
  1. Visitor sees a warm-editorial landing page (warm palette, serif headings, self-hosted fonts, no third-party requests) that explains Tran Real Estate Tools and routes to the Renter, Investor, and Agent portals.
  2. Visitor can read For Renters, For Investors, and For Agents pages describing each portal's value. The copy contains no brokerage, appraisal, or advice language (banned-terms CI grep passes) and no fabricated testimonials or metrics.
  3. Visitor can reach, from any page, the privacy policy, terms (software tool; not a brokerage; not investment, legal, or tax advice), Fair Housing statement, and data-coverage explainer.
  4. User can switch between the Renter, Investor, and Agent portals from any app page.
  5. Every page passes axe with WCAG 2.2 AA color contrast and is fully usable at 375px viewport width with no horizontal scrolling.
**Plans**: TBD
**Research flag**: no (standard patterns)
**UI hint**: yes. Use the UI/UX Pro Max skill via `/gsd:ui-phase 2` before planning. This phase defines the brand tokens consumed by every portal and the extension popup.

### Phase 3: Local Platform: Storage, Key Vault & Backup
**Goal**: Users can safely hold their API keys and data in their own browser, protect them, and never silently lose their work to browser storage eviction
**Depends on**: Phase 1 (can run in parallel with Phase 2)
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, PLAT-06
**Success Criteria** (what must be TRUE):
  1. User can paste a RentCast key and AI provider keys (Anthropic, OpenAI, Gemini, OpenRouter) in Settings, read a plain-language "where your key goes" explanation, and forget all keys in one action. By default the keys are gone after the browser session ends unless the user opted into "remember on this device".
  2. User who chose "remember on this device" can lock keys behind a passphrase. After reopening the app, keys stay unusable until the passphrase is entered.
  3. User can export all app data to a JSON file that is verified to contain no keys. The user can import it into a fresh browser profile after previewing what will be added, changed, or replaced.
  4. Settings shows whether the browser granted persistent storage, and a "last backup N days ago" reminder appears once a backup is overdue.
  5. User can install the app to their home screen or desktop as a PWA and launch it standalone. iOS users see an Add-to-Home-Screen tip.
**Plans**: TBD
**Research flag**: light. Covers Safari/WebKit 7-day eviction and `navigator.storage.persist()` on iOS 17+, plus service-worker/manifest behavior under a meta CSP on Pages.
**UI hint**: yes (Settings / key vault / backup screens). Use `/gsd:ui-phase 3`.
**Note**: Provider-specific "test key" behavior completes in Phase 4 (RentCast) and Phase 5 (AI providers). This phase delivers the paste/test/forget flow and the vault those tests plug into.

### Phase 4: Data Layer: RentCast Gateway, Budget Guard & Demo Fixtures
**Goal**: Every RentCast call flows through one gateway that caches, meters, and hard-stops before the user is charged, and every portal has realistic synthetic sample data when no key is present
**Depends on**: Phase 3 (can run in parallel with Phase 5)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):
  1. Visitor without a RentCast key gets clearly badged "Sample data" synthetic fixtures for rental listings, sale listings, rent/value estimates, and zip market stats, enough to drive every portal. The CI PII scan passes on all fixtures.
  2. User sees a meter of RentCast calls used this month, and every call-spending action shows its call cost before it runs.
  3. With a real key, the app blocks the next RentCast call at the user-editable cap (default 40 of 50) and requires explicit confirmation to go beyond it. Call-count tests prove that 60 simulated calls block call #41, that re-rendering a view 10 times spends no extra calls, and that opening the app with 5 due saved searches re-runs each at most once per 24 hours.
  4. Repeating an identical request returns cached data with an "as of" timestamp and spends zero calls. "Refresh (1 call)" refetches on demand.
  5. Testing a RentCast key in Settings reports valid / invalid / restricted without a billed call. User sees specific messages for invalid key, restricted key, rate limit, budget cap reached, and no results.
**Plans**: TBD
**Research flag**: YES. Needs `/gsd:research-phase` with a real dedicated, endpoint-restricted key: whether 404s are unbilled, how pagination is billed, field coverage including listing-agent contacts, whether the free plan requires a card, and endpoint-restriction behavior. Real responses are never committed.
**UI hint**: yes, light (call meter, cost labels, cap-confirm dialog, error states, provenance chips). Use `/gsd:ui-phase 4`.
**Human action required**: The owner creates a dedicated, endpoint-restricted RentCast key for verification (stored only in the browser, never committed).

### Phase 5: AI Layer: Providers, Streaming & Fair Housing Guardrails
**Goal**: Users can generate AI text with their own provider key safely: output streams in and can be stopped, is checked for Fair Housing problems, and never leaves the app without a human action
**Depends on**: Phase 3 (can run in parallel with Phase 4)
**Requirements**: AI-01, AI-02, AI-03, AI-04
**Success Criteria** (what must be TRUE):
  1. User can choose Anthropic, OpenAI, Gemini, or OpenRouter, test the key from the deployed site (errors distinguish CORS vs. authentication vs. quota), and watch a generation stream in with a working Stop control. With no key, a fixture provider streams sample output.
  2. AI-generated housing copy containing a problem phrase (e.g., "perfect for young professionals", "no kids") is flagged inline with an explanation and a compliant alternative before the user can copy or send it. The checker's test suite of 30+ known-bad and 30+ neutral phrases passes.
  3. User with a free-tier Gemini key is warned before any client or lead data is sent and can cancel.
  4. The generation panel offers only copy, open in the user's own email client, and mark as sent. No code path sends AI output automatically.
**Plans**: TBD
**Research flag**: YES. Needs `/gsd:research-phase`: current model IDs and a models-list validation path, streaming event shapes per provider, Gemini key types and browser viability, models-endpoint CORS, and legal sourcing of Fair Housing phrase lists (Achtenberg memo + state lists).
**UI hint**: yes (generation panel, Fair Housing flag UI, provider picker). Use `/gsd:ui-phase 5`.

### Phase 6: Renter Portal
**Goal**: A renter goes from "what I'm looking for" to matching listings, a fair-rent read, and a ready-to-send message to the listing agent in minutes
**Depends on**: Phase 2, Phase 4, Phase 5 (can run in parallel with Phases 7 and 8)
**Requirements**: RENT-01, RENT-02, RENT-03, RENT-04, RENT-05, RENT-06, RENT-07, RENT-08
**Success Criteria** (what must be TRUE):
  1. Renter can search rentals in any US city or zip by price range, bedrooms, property type, and "listed within N days", view results as a sortable list and on a map, and open a listing detail with price history and listing agent/office contact details.
  2. Renter can save a search, reopen the app later, and see "N new since last visit" (each search re-runs at most once per 24 hours). Renter can shortlist listings and track each one as Contacted, Toured, Applied, or Signed.
  3. Renter can compare a listing's asking rent to the zip median for that bedroom count and optionally to a rent estimate with range and comparables (call cost shown first). Renter can also calculate affordable rent from income with zero API calls.
  4. Renter can generate an AI outreach draft to the listing agent asking about availability, pets, fees, and lease terms. The draft passes the Fair Housing checker and goes out only via copy or the renter's own email client.
  5. Demo-credible: every renter route works fully on sample data with no key, stays under the call budget with a real key, has all AI copy passing the Fair Housing checker, and passes axe checks.
**Plans**: TBD
**Research flag**: no (standard patterns). Verify the OSM tile usage policy and add the tile host to CSP `img-src` when the map ships.
**UI hint**: yes. Use the UI/UX Pro Max skill via `/gsd:ui-phase 6`.
**Cut line** (cut in this order if the phase overruns): (1) map clustering and visual polish; (2) RENT-05 status tracking, keeping the plain shortlist; (3) the optional rent-estimate tier of RENT-06, keeping the zero-call zip-median comparison.

### Phase 7: Investor Portal
**Goal**: An investor goes from a property or buy box to a fully analyzed, comparable, memo-ready deal in minutes
**Depends on**: Phase 2, Phase 4, Phase 5 (can run in parallel with Phases 6 and 8)
**Requirements**: INV-01, INV-02, INV-03, INV-04, INV-05, INV-06
**Success Criteria** (what must be TRUE):
  1. Investor can analyze a property for NOI, cap rate, monthly cash flow, cash-on-cash return, DSCR, GRM, and the 1% rule with editable expense lines. Results match hand-checked reference cases in the finance test suite.
  2. Investor can enter every number manually with zero API calls, or autofill rent and value estimates after seeing the call cost. Investor can save analyzed deals and compare them side by side.
  3. Investor can save buy-box searches over for-sale listings and, on opening the app, see new matches with quick metrics.
  4. Investor can view rent-trend and price-to-rent dashboards for up to 5 watched zip codes. Investor can generate an AI investment memo whose numbers all come from the analyzer and print it to PDF with a not-investment-advice disclaimer.
  5. Demo-credible: every investor route works fully on sample data with no key, stays under the call budget with a real key, has the memo copy passing the Fair Housing checker, and passes axe checks.
**Plans**: TBD
**Research flag**: no (standard patterns)
**UI hint**: yes. Use the UI/UX Pro Max skill via `/gsd:ui-phase 7`.
**Note**: This phase establishes the `(print)` route + print-CSS pipeline and zip market-stats dashboards that Phase 9 reuses.
**Cut line** (cut in this order): (1) extra metrics beyond INV-01 (50% rule, break-even occupancy); (2) side-by-side compare capped at 2 deals; (3) dashboard charts beyond rent trend and price-to-rent.

### Phase 8: Agent Portal: Profile, Lead Intake & CRM
**Goal**: An agent captures leads through their own inquiry page, works them through a pipeline, and never misses a follow-up, with required disclosures built in
**Depends on**: Phase 2, Phase 3, Phase 5 (not Phase 4; can run in parallel with Phases 4, 6, and 7 once Phase 5 is done)
**Requirements**: AGT-01, AGT-02, AGT-03, AGT-04, AGT-05, AGT-06, AGT-07
**Success Criteria** (what must be TRUE):
  1. Agent can set up a profile (name, brokerage, license number, state, logo, brand colors, postal address), and the required disclosures are automatically appended to every export and generated draft.
  2. Agent can publish a shareable inquiry page on their own Web3Forms key with spam protection. A test submission arrives in their email. Pasting that email, or adding a lead manually, creates a contact with duplicate detection.
  3. Agent can drag contacts through New → Contacted → Touring → Offer → Closed, create follow-up tasks, and see a due-today queue when opening the app.
  4. Agent can generate an AI follow-up email draft that includes their postal address and an opt-out line, passes the Fair Housing checker, and is sent only via copy or their own email client. Agent can import contacts from CSV and export them to CSV.
  5. Demo-credible: every agent CRM route works fully on sample contacts with no keys, spends zero RentCast calls with a real key present, has all AI copy passing the Fair Housing checker, and passes axe checks.
**Plans**: TBD
**Research flag**: YES. Needs `/gsd:research-phase`: Web3Forms free-tier limits, captcha and domain-restriction options, whether the `TRAN-LEAD v1` payload survives major email clients, and the Formspree fallback.
**UI hint**: yes. Use the UI/UX Pro Max skill via `/gsd:ui-phase 8`.
**Human action required**: The owner creates a free Web3Forms access key to verify end-to-end lead delivery.
**Cut line** (cut in this order): (1) smart lists beyond 3 presets; (2) `.eml` file drop, keeping paste import; (3) CSV import in AGT-07, keeping CSV export.

### Phase 9: Agent Content Studio & Market Snapshot Reports
**Goal**: An agent produces compliant, branded marketing content and client-ready market reports in minutes
**Depends on**: Phase 7 (print pipeline, market stats), Phase 8 (agent profile). Transitively Phases 4 and 5.
**Requirements**: STU-01, STU-02, STU-03, STU-04
**Success Criteria** (what must be TRUE):
  1. Agent can generate a listing description from facts they enter. The Fair Housing checker flags any problem phrases with alternatives before the text can be copied.
  2. Agent can generate an Instagram, Facebook, and LinkedIn post pack with their brokerage disclosure appended automatically from their profile.
  3. Agent can generate a founder-story reel script (hook → manual pain → before/after → results → mission → call to action) with timed beats, captions, B-roll list, and an AI-disclosure checklist, using only results the agent supplies.
  4. Agent can create a branded Market Snapshot report for a zip code (their logo, colors, and disclosures), labeled as not a CMA or appraisal, and print it to PDF.
  5. Demo-credible: every studio and report route works fully on sample data with no keys, the Market Snapshot stays under the call budget with a real key, all AI copy passes the Fair Housing checker, and axe checks pass.
**Plans**: TBD
**Research flag**: light (state license-law ad disclosure requirements, NY AI advertising disclosure checklist)
**UI hint**: yes. Use the UI/UX Pro Max skill via `/gsd:ui-phase 9`.
**Cut line** (cut in this order): ship STU-01 (listing descriptions) and STU-04 (Market Snapshot) first. If the phase overruns, cut (1) STU-03 reel script generator, then (2) STU-02 social post pack.

### Phase 10: Launch Hardening & Go-to-Market
**Goal**: First-time visitors become active users, new visitors find Tran through free tools, and the owner can measure usage, all on an audited, hardened site
**Depends on**: Phases 1-9 (does NOT depend on Phase 11)
**Requirements**: GTM-01, GTM-02, GTM-03, GTM-04
**Success Criteria** (what must be TRUE):
  1. First-time visitor picks a portal, sees a short tour, and chooses "Try sample data" or a guided free RentCast key setup that includes setting the call cap.
  2. Visitor can join a per-portal waitlist and send feedback.
  3. Visitor can find and use free affordability, cap rate, cash-on-cash, and DSCR calculator pages via `sitemap.xml` and share cards, with no key and zero API calls.
  4. Owner can see page and portal usage counts through a first-party analytics beacon. Network inspection shows no third-party script tags and no personal data in beacon payloads.
  5. Launch audit passes: axe on every route in keyless and keyed states, CSP review, `pnpm audit` clean, banned-terms and disclaimer audit, and the PITFALLS "Looks Done But Isn't" checklist.
**Plans**: TBD
**Research flag**: light (verify Umami collection-API CORS from the deployed origin)
**UI hint**: yes (onboarding tour, SEO tool pages, waitlist/feedback). Use `/gsd:ui-phase 10`.
**Cut line**: If Umami collection-API CORS fails from the deployed origin, ship without analytics and move GTM-04 to v2. The owner then records the decision in PROJECT.md.

### Phase 11: Zillow Sponsored Listing Filter Extension
**Goal**: A Zillow user sees listings without paid placements pushed in front of them, via a hide-only extension that collects and sends nothing
**Depends on**: Phase 1, Phase 2 only (can run in parallel with Phases 3-10; slippable; never blocks the Phase 10 web launch)
**Requirements**: EXT-01, EXT-02, EXT-03, EXT-04
**Success Criteria** (what must be TRUE):
  1. On Zillow search results, sponsored or promoted listing cards appear dimmed with a one-click reveal on each. Detection keeps working as results update during scrolling and in-page navigation (synthetic-DOM matcher tests pass).
  2. User can toggle the filter on/off and see the count of hidden sponsored listings from the toolbar popup.
  3. Extension permissions are limited to storage and zillow.com. Monitoring a browsing session shows zero network requests from the extension. The listing and popup show a "collects nothing, sends nothing" privacy notice and a "Not affiliated with or endorsed by Zillow Group" notice.
  4. User can install the extension from a GitHub Releases zip by following load-unpacked instructions, or from Microsoft Edge Add-ons (Firefox Add-ons optional).
**Plans**: TBD
**Research flag**: YES. Needs `/gsd:research-phase`: current Zillow sponsored-card DOM and labels, store naming tolerance for "for Zillow", and WXT 0.x stability.
**UI hint**: yes, small (toolbar popup using Phase 2 brand tokens). Use `/gsd:ui-phase 11`.
**Human action required**: The owner reads the Zillow Terms of Use manually before release (automated fetch returns 403). The owner also creates a free Microsoft Edge Add-ons Partner Center account and, optionally, a Firefox AMO account.
**Cut line** (cut in this order): (1) hide mode beyond dim-with-reveal; (2) the Firefox Add-ons listing in EXT-04, keeping Releases zip + Edge Add-ons. The whole phase may slip past launch without blocking v1 web delivery.

## Progress

**Execution Order:**
Default numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11.
With parallelization enabled: 1 → {2, 3} → {4, 5} → {6, 7, 8} → 9 → 10. Phase 11 floats anywhere after Phase 2.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation, Origin & Security Baseline | 0/9 | Planned | - |
| 2. Brand System, Marketing & Legal Pages | 0/TBD | Not started | - |
| 3. Local Platform: Storage, Key Vault & Backup | 0/TBD | Not started | - |
| 4. Data Layer: RentCast Gateway, Budget Guard & Demo Fixtures | 0/TBD | Not started | - |
| 5. AI Layer: Providers, Streaming & Fair Housing Guardrails | 0/TBD | Not started | - |
| 6. Renter Portal | 0/TBD | Not started | - |
| 7. Investor Portal | 0/TBD | Not started | - |
| 8. Agent Portal: Profile, Lead Intake & CRM | 0/TBD | Not started | - |
| 9. Agent Content Studio & Market Snapshot Reports | 0/TBD | Not started | - |
| 10. Launch Hardening & Go-to-Market | 0/TBD | Not started | - |
| 11. Zillow Sponsored Listing Filter Extension | 0/TBD | Not started | - |
