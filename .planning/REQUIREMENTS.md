# Requirements: Tran Real Estate Tools

**Defined:** 2026-09-13
**Core Value:** A visitor in any of the three portals can go from "what I'm looking for" to an actionable result — matching listings, an analyzed deal, or a ready-to-send message — in minutes instead of hours, using only legitimate data sources.

**Scope depth:** All three portals at capped depth. Every portal phase must be demo-credible: works fully on sample data with no key, works under the call budget with a real key, passes the Fair Housing checker where AI copy exists, passes axe accessibility checks. Cut depth per portal, never shared infrastructure (demo fixtures, budget cap, Fair Housing checker, backup).

## v1 Requirements

### Foundation & Security

- [x] **FND-01**: Visitor can load the app at `tranrealestate.github.io` with every route prerendered and deep-link refresh working (base path configurable via environment variable)
- [x] **FND-02**: Every deployed page carries a strict Content-Security-Policy meta tag whose `connect-src` allows only RentCast, Anthropic, OpenAI, Gemini, OpenRouter, Web3Forms, and the analytics beacon host
- [x] **FND-03**: App refuses to render inside a third-party frame
- [x] **FND-04**: Every push runs typecheck, lint, unit, end-to-end, and accessibility checks, and deploys to GitHub Pages only when all pass
- [x] **FND-05**: Repository blocks committed secrets (secret scanning with push protection) and real listing or CoStar data (PII scan and path rules in CI)

### Brand & Marketing

- [x] **BRND-01**: Visitor sees a warm-editorial landing page that explains Tran Real Estate Tools and routes to the Renter, Investor, and Agent portals
- [ ] **BRND-02**: Visitor can read dedicated For Renters, For Investors, and For Agents pages describing each portal's value
- [x] **BRND-03**: Every page meets WCAG 2.2 AA color contrast and is fully usable at 375px viewport width
- [ ] **BRND-04**: Visitor can read legal pages: privacy policy, terms stating Tran is a software tool (not a brokerage; not investment, legal, or tax advice), Fair Housing statement, and data-coverage explainer
- [ ] **BRND-05**: User can switch between portals from any app page

### Local Platform

- [ ] **PLAT-01**: User can paste, test, and forget a RentCast key and AI provider keys (Anthropic, OpenAI, Gemini, OpenRouter), with a plain-language "where your key goes" explanation
- [ ] **PLAT-02**: Keys are kept for the browser session only by default; user can opt into "remember on this device"
- [ ] **PLAT-03**: User can lock remembered keys behind a passphrase
- [ ] **PLAT-04**: User can export all app data (never keys) to a JSON file and import it back after previewing what will change
- [ ] **PLAT-05**: User can see whether the browser granted persistent storage and receives a "last backup N days ago" reminder
- [ ] **PLAT-06**: User can install the app to their home screen or desktop as a progressive web app

### Data Layer & Demo

- [ ] **DATA-01**: Visitor without a RentCast key can use every portal on clearly badged synthetic sample data
- [ ] **DATA-02**: User can see RentCast calls used this month and the call cost of an action before running it
- [ ] **DATA-03**: App stops RentCast calls at a user-editable cap (default 40 of 50) and requires explicit confirmation to go beyond it
- [ ] **DATA-04**: Repeated identical requests are served from a local cache showing an "as of" timestamp, with a manual "Refresh (1 call)" option
- [ ] **DATA-05**: User sees clear, specific messages for invalid key, restricted key, rate limit, budget cap reached, and no results

### AI & Compliance

- [ ] **AI-01**: User can choose Anthropic, OpenAI, Gemini, or OpenRouter as the AI provider and watch output stream in, with the ability to stop generation
- [ ] **AI-02**: Every piece of AI-generated housing copy is scanned by a Fair Housing checker that flags problem phrases with an explanation and a compliant alternative before the user can copy or send it
- [ ] **AI-03**: User is warned before sending client or lead data to a free-tier Gemini key
- [ ] **AI-04**: No AI output is ever sent automatically — user copies it or opens it in their own email client

### Renter Portal

- [ ] **RENT-01**: Renter can search rentals in any US city or zip by price range, bedrooms, property type, and "listed within N days"
- [ ] **RENT-02**: Renter can view search results as a sortable list and on a map
- [ ] **RENT-03**: Renter can open a listing detail showing price history and the listing agent/office contact details
- [ ] **RENT-04**: Renter can save searches and see "N new since last visit" when opening the app (each search re-runs at most once per 24 hours)
- [ ] **RENT-05**: Renter can shortlist listings and track each one's status (Contacted, Toured, Applied, Signed)
- [ ] **RENT-06**: Renter can compare a listing's asking rent to market rent (zip median by bedroom count, plus an optional rent estimate showing range and comparables)
- [ ] **RENT-07**: Renter can generate an AI outreach draft to the listing agent that asks about availability, pets, fees, and lease terms
- [ ] **RENT-08**: Renter can calculate affordable rent from their income without using any API calls

### Investor Portal

- [ ] **INV-01**: Investor can analyze a property for NOI, cap rate, monthly cash flow, cash-on-cash return, DSCR, GRM, and the 1% rule, with editable expense lines
- [ ] **INV-02**: Investor can enter every number manually (zero API calls) or autofill rent and value estimates with the call cost shown first
- [ ] **INV-03**: Investor can save analyzed deals and compare them side by side
- [ ] **INV-04**: Investor can save buy-box searches over for-sale listings and see new matches with quick metrics when opening the app
- [ ] **INV-05**: Investor can view market dashboards (rent trend, price-to-rent) for up to 5 watched zip codes
- [ ] **INV-06**: Investor can generate an AI investment memo whose numbers all come from the analyzer, and print it to PDF with a not-investment-advice disclaimer

### Agent Portal — CRM & Leads

- [ ] **AGT-01**: Agent can set up a profile (name, brokerage, license number, state, logo, brand colors, postal address) that automatically appends required disclosures to exports and generated content
- [ ] **AGT-02**: Agent can publish a shareable inquiry page that emails new leads to them through their own Web3Forms key, with spam protection
- [ ] **AGT-03**: Agent can import leads by pasting a lead email or adding them manually, with duplicate detection
- [ ] **AGT-04**: Agent can move contacts through a drag-and-drop pipeline (New → Contacted → Touring → Offer → Closed)
- [ ] **AGT-05**: Agent can create follow-up tasks and see a due-today queue when opening the app
- [ ] **AGT-06**: Agent can generate AI follow-up email drafts that include CAN-SPAM elements (postal address, opt-out line)
- [ ] **AGT-07**: Agent can import contacts from CSV and export contacts to CSV

### Agent Portal — Content Studio & Reports

- [ ] **STU-01**: Agent can generate a listing description from facts they enter, checked by the Fair Housing checker
- [ ] **STU-02**: Agent can generate an Instagram, Facebook, and LinkedIn post pack with their brokerage disclosure appended
- [ ] **STU-03**: Agent can generate a founder-story reel script (hook → manual pain → before/after → results → mission → call to action) with timed beats, captions, B-roll list, and an AI-disclosure checklist
- [ ] **STU-04**: Agent can create a branded Market Snapshot report for a zip code and print it to PDF, labeled as not a CMA or appraisal

### Zillow Sponsored Listing Filter Extension

- [ ] **EXT-01**: Zillow user with the extension installed sees sponsored or promoted listing cards dimmed, with a one-click reveal on each
- [ ] **EXT-02**: User can toggle the filter on/off and see the count of hidden sponsored listings from the toolbar popup
- [ ] **EXT-03**: Extension makes no network requests and collects no data (permissions limited to storage and zillow.com)
- [ ] **EXT-04**: User can install the extension from a GitHub Releases zip (with load-unpacked instructions), Microsoft Edge Add-ons, or Firefox Add-ons

### Go-to-Market

- [ ] **GTM-01**: First-time visitor picks a portal, sees a short tour, and chooses "Try sample data" or a guided free RentCast key setup
- [ ] **GTM-02**: Visitor can join a per-portal waitlist and send feedback
- [ ] **GTM-03**: Visitor can use free SEO tool pages (affordability, cap rate / cash-on-cash / DSCR calculators) discoverable via sitemap and share cards
- [ ] **GTM-04**: Owner can see page and portal usage counts through a first-party analytics beacon that sends no personal data

## v2 Requirements

Deferred. Tracked but not in the current roadmap.

### Renter
- **RENT-V2-01**: Renter sees "price dropped" and "likely rented" badges derived from listing history
- **RENT-V2-02**: Renter receives email alert digests for saved searches (requires backend)

### Investor
- **INV-V2-01**: Investor can adjust rent, rate, and vacancy with live sensitivity sliders
- **INV-V2-02**: Investor can track an owned portfolio

### Agent
- **AGT-V2-01**: Agent can export follow-up tasks to calendar (.ics)
- **AGT-V2-02**: Agent receives leads live in-app via webhook (requires backend)
- **STU-V2-01**: Visitor can use a standalone public Fair Housing copy checker page

### Platform & GTM
- **PLAT-V2-01**: User can sign in and sync data across devices (requires backend)
- **PLAT-V2-02**: User can pay for a subscription via Stripe (requires backend and a non-Pages host)
- **PLAT-V2-03**: User sees HUD Fair Market Rent benchmarks next to RentCast estimates
- **GTM-V2-01**: Visitor can read a "What Tran never does" trust page
- **EXT-V2-01**: Visitor can follow a step-by-step extension install page on the Tran site
- **EXT-V2-02**: Extension listed on the Chrome Web Store ($5 one-time fee)

## Out of Scope

| Feature | Reason |
|---------|--------|
| MLS / IDX / VOW data | No broker or agent sponsor; cannot be obtained legitimately |
| Scraping Zillow or any site | Violates Zillow Terms of Use; extension is hide-only with no network |
| NYU CoStar data in any form | CoStar academic terms prohibit direct or indirect benefit |
| Shared or bundled RentCast demo key | RentCast terms make keys confidential and non-shareable |
| Committing real RentCast responses | Listing-agent PII and anti-scraping duty; synthetic fixtures only |
| Auto-sending email or SMS, drip campaigns | CAN-SPAM/TCPA risk; human-in-the-loop only |
| Tenant screening, applicant scoring, applications, payments | Fair Housing risk; restricted by AI provider usage policies |
| Demographic, crime, school, or "family-friendly" overlays | Fair Housing steering risk |
| Buy/sell recommendations, "appraisals", "CMAs" | Unlicensed advice/appraisal optics |
| Lead routing between agents or per-lead fees | State referral-fee and licensing rules |
| Metro-level dashboards | RentCast market stats are zip-only; budget-prohibitive |
| Nationwide queries without a location | RentCast requires city/state, zip, or radius |
| Third-party analytics or tracking scripts | Any script on the origin can read stored keys |
| Hosting on shared `wolfwdavid.github.io` origin | Browser storage shared with sibling sites exposes keys |
| Short-term rental (Airbnb) analysis | No licensed STR data source |
| Programmatic "rentals in [city]" SEO pages with RentCast data | Thin content; data-usage and spam risk |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Complete |
| FND-02 | Phase 1 | Complete |
| FND-03 | Phase 1 | Complete |
| FND-04 | Phase 1 | Complete |
| FND-05 | Phase 1 | Complete |
| BRND-01 | Phase 2 | Complete |
| BRND-02 | Phase 2 | Pending |
| BRND-03 | Phase 2 | Complete |
| BRND-04 | Phase 2 | Pending |
| BRND-05 | Phase 2 | Pending |
| PLAT-01 | Phase 3 | Pending |
| PLAT-02 | Phase 3 | Pending |
| PLAT-03 | Phase 3 | Pending |
| PLAT-04 | Phase 3 | Pending |
| PLAT-05 | Phase 3 | Pending |
| PLAT-06 | Phase 3 | Pending |
| DATA-01 | Phase 4 | Pending |
| DATA-02 | Phase 4 | Pending |
| DATA-03 | Phase 4 | Pending |
| DATA-04 | Phase 4 | Pending |
| DATA-05 | Phase 4 | Pending |
| AI-01 | Phase 5 | Pending |
| AI-02 | Phase 5 | Pending |
| AI-03 | Phase 5 | Pending |
| AI-04 | Phase 5 | Pending |
| RENT-01 | Phase 6 | Pending |
| RENT-02 | Phase 6 | Pending |
| RENT-03 | Phase 6 | Pending |
| RENT-04 | Phase 6 | Pending |
| RENT-05 | Phase 6 | Pending |
| RENT-06 | Phase 6 | Pending |
| RENT-07 | Phase 6 | Pending |
| RENT-08 | Phase 6 | Pending |
| INV-01 | Phase 7 | Pending |
| INV-02 | Phase 7 | Pending |
| INV-03 | Phase 7 | Pending |
| INV-04 | Phase 7 | Pending |
| INV-05 | Phase 7 | Pending |
| INV-06 | Phase 7 | Pending |
| AGT-01 | Phase 8 | Pending |
| AGT-02 | Phase 8 | Pending |
| AGT-03 | Phase 8 | Pending |
| AGT-04 | Phase 8 | Pending |
| AGT-05 | Phase 8 | Pending |
| AGT-06 | Phase 8 | Pending |
| AGT-07 | Phase 8 | Pending |
| STU-01 | Phase 9 | Pending |
| STU-02 | Phase 9 | Pending |
| STU-03 | Phase 9 | Pending |
| STU-04 | Phase 9 | Pending |
| EXT-01 | Phase 11 | Pending |
| EXT-02 | Phase 11 | Pending |
| EXT-03 | Phase 11 | Pending |
| EXT-04 | Phase 11 | Pending |
| GTM-01 | Phase 10 | Pending |
| GTM-02 | Phase 10 | Pending |
| GTM-03 | Phase 10 | Pending |
| GTM-04 | Phase 10 | Pending |

**Coverage:**
- v1 requirements: 58 total
- Mapped to phases: 58
- Unmapped: 0

---
*Requirements defined: 2026-09-13*
*Last updated: 2026-09-13 after roadmap creation (traceability mapped)*
