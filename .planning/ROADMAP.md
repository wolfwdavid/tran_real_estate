# Roadmap: Tran Real Estate Tools

## Overview

Tran Real Estate Tools ships as one static SvelteKit app on its own dedicated origin (`tranrealestate.github.io`) with three portals (Renter, Investor, Agent) plus a companion Zillow sponsored-listing filter extension, all at $0 infrastructure cost. The journey builds shared infrastructure first and portals second, ordered so every risk mitigation lands before the feature that triggers it. The order is: the security baseline and dedicated origin before any key storage; storage, key vault, and backup before the data gateway and AI layer; the RentCast budget cap and synthetic fixtures before any portal spends a call; the Fair Housing checker before any AI generator; and the agent profile before studio and report features. Every portal phase must be demo-credible and has a named cut line. When scope pressure hits, cut depth inside a portal. Never cut the shared infrastructure (demo fixtures, budget cap, Fair Housing checker, backup). The extension depends only on the foundation and brand phases and never blocks the web launch.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

**Numbering note vs. research:** `research/SUMMARY.md` lists the extension as P10 and launch as P11. This roadmap swaps them (Launch = Phase 10, Extension = Phase 11), so the default numeric order launches the web app first and the slippable extension can never block it. The extension can still be pulled forward any time after Phase 2.

- [x] **Phase 1: Foundation, Origin & Security Baseline** - Dedicated-origin static deploy with strict meta CSP, frame-bust, CI gate, and secret/PII blocking (completed 2026-09-22)
- [x] **Phase 2: Brand System, Marketing & Legal Pages** - Warm-editorial accessible landing, per-audience pages, legal pages, and portal switcher (completed 2026-10-05)
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
- [x] 01-05-PLAN.md - Pages emulator, Playwright harness & routing E2E (wave 4)
- [x] 01-06-PLAN.md - Quality-gate rule tests (lint boundaries, PII rules, pre-commit) (wave 3)
- [x] 01-07-PLAN.md - Browser security & accessibility specs (CSP, framing, axe) (wave 5)
- [x] 01-08-PLAN.md - CI workflow, actionlint & gated Pages deploy (wave 5)
- [x] 01-09-PLAN.md - Full-suite verification & deferred hosting handoff (wave 6)

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
**Plans**: 12 plans in 6 waves
Plans:
- [x] 02-01-PLAN.md — Brand tokens in @tran/brand + WCAG contrast gate (wave 1)
- [x] 02-02-PLAN.md — Banned-terms copy gate: rules, CLI, verify + CI hygiene step (wave 1)
- [x] 02-03-PLAN.md — Tailwind @theme + parity test, self-hosted fonts, Lucide pin, data: URI oracle (wave 2)
- [x] 02-04-PLAN.md — Site chrome: header/portal switcher, footer, skip link, layouts, 404, 7 route stubs (wave 3)
- [x] 02-05-PLAN.md — Shared E2E route list, routing/CSP/axe on all routes, drift guard (wave 4)
- [x] 02-06-PLAN.md — Landing page: hero, portal cards with marks, How it works, trust strip (wave 4)
- [x] 02-07-PLAN.md — Audience template + For Renters / Investors / Agents pages (wave 4)
- [x] 02-08-PLAN.md — Legal pages: privacy, terms, Fair Housing, data coverage (wave 4)
- [x] 02-09-PLAN.md — Branded portal and settings placeholders (wave 4)
- [x] 02-10-PLAN.md — Layout E2E: landmarks, aria-current, footer legal links, 375/640, disclosure, same-origin (wave 5)
- [x] 02-11-PLAN.md — Marketing content E2E + axe at 375px, 404 and menu open (wave 5)
- [x] 02-12-PLAN.md — Full verify, validation map walk, README + requirements (wave 6)
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
**Plans**: 17 plans in 7 waves
Plans:
- [x] 03-01-PLAN.md — Exact-pinned deps, core provider registry (hosts ⊆ CSP, header-only auth), Syncable + reminder math, test fakes, lint guardrails (wave 1)
- [x] 03-02-PLAN.md — Core backup: tran-backup-v1 envelope + error codes, migrations, merge/replace diff, key scan, filename (wave 2)
- [x] 03-03-PLAN.md — PWA manifest (relative URLs), brand-generated icons, beforeinstallprompt capture, CSP oracle carriers (wave 2)
- [x] 03-04-PLAN.md — Key vault core: WebCrypto, tran-secrets DB, session default / remember opt-in, forget-all broadcast, tester hook (wave 2)
- [x] 03-05-PLAN.md — Dexie data layer: TranDb, Syncable repos, meta, backup registry, persist()/estimate, liveQuery helper (wave 2)
- [x] 03-06-PLAN.md — shadcn-svelte 1.6.1 init reconciled to Phase 2 tokens, 9 primitives, alias tokens, UI class guard (wave 2; needs Phase 2)
- [x] 03-07-PLAN.md — Passphrase lock: PBKDF2 600k + wrapped AES-GCM data key, persisted 5-attempt cooldown, cross-tab lock (wave 3)
- [x] 03-08-PLAN.md — Backup service: key-free export + download, 25 MB preview, single-transaction merge/replace (wave 3)
- [x] 03-09-PLAN.md — Allowlist-only service worker + offline/404/route-mock/manifest E2E on both bases (wave 3)
- [x] 03-10-PLAN.md — Settings shell: 8-slot section order, LiveAnnouncer, ConfirmDialog, SecretInput, forget-all, hydration, E2E helpers (wave 3)
- [x] 03-11-PLAN.md — API keys section: 5 provider cards, paste/show/save/last4/replace/remove, forget all + E2E (wave 4)
- [x] 03-13-PLAN.md — Backup and restore section: export, import preview, merge/replace confirm + fresh-profile E2E (wave 4)
- [x] 03-14-PLAN.md — Storage status + Install the app sections, iOS tip, persist/install stubs E2E (wave 4)
- [ ] 03-12-PLAN.md — Key security section: storage mode, passphrase lock/unlock/change/remove, cooldown + at-rest E2E (wave 5)
- [ ] 03-15-PLAN.md — AppNotice (backup overdue / keys locked) in the (app) layout + clock-controlled E2E (wave 5)
- [ ] 03-16-PLAN.md — Settings axe matrix (11 states × 2 bases), real-dialog CSP check, overlay paint, 375px, locked-notice E2E (wave 6)
- [ ] 03-17-PLAN.md — Full verify, validation walk + mutation ledger, HUMAN-UAT device checklist, README, PLAT-01..06 complete (wave 7)
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
**Plans**: 25 plans in 9 waves
Plans:
- [ ] 04-01-PLAN.md — Phase 3 gate, platform adapter, Phase 4 Dexie tables + backup registration, exact-pin deps, schema-registry test
- [ ] 04-02-PLAN.md — core budget: UTC period, isBilled policy, usage summary, cap validation, meter states
- [ ] 04-03-PLAN.md — core request: endpoints (incl. rental listing by id), canonical key, TTLs, error taxonomy, zero-cost probe mapping
- [ ] 04-04-PLAN.md — core normalizeLocation, listings domain types, filterListings, fetch-wide + narrow request builders
- [ ] 04-05-PLAN.md — core alerts: diffSnapshots, due-search selection, cap-aware run plan
- [ ] 04-06-PLAN.md — fixture guard rules + planted-PII proof, seeded fixture generator, drift check in verify/CI
- [ ] 04-07-PLAN.md — ESLint: ban spends in $effect, data layer only through $lib/data
- [ ] 04-08-PLAN.md — web-browser Vitest project (Chromium + axe) spike, CI Chromium order
- [ ] 04-09-PLAN.md — RentCast GET client (only fetch site) + zero-cost key probe
- [ ] 04-10-PLAN.md — tolerant zod/mini schemas + mappers, proven on fixtures
- [ ] 04-11-PLAN.md — transactional ledger reserve/settle, single-use grants, cache repo, cross-connection race proof
- [ ] 04-12-PLAN.md — fixture fetch for every endpoint with date rebasing at load
- [ ] 04-13-PLAN.md — live DataGateway: cache/dedupe/peek/by-id/cost + 60-calls-block-#41 and identical-repeat tests
- [ ] 04-14-PLAN.md — ProvenanceChip/Row, CostLabel, NewSinceBadge, sample-chip helper
- [ ] 04-15-PLAN.md — CallMeter (full/compact) and GatewayError (8 variants)
- [ ] 04-16-PLAN.md — CapConfirmDialog (A/B), CapAboveLimitDialog, CapEditor
- [ ] 04-17-PLAN.md — sample-mode gateway, mode resolution, data-source preference
- [ ] 04-18-PLAN.md — data runtime (mode, usage, per-call cap prompt, cross-tab), peek store, public $lib/data port
- [ ] 04-19-PLAN.md — saved-search repo + check-on-open scheduler (5 due searches once / 24 h)
- [ ] 04-20-PLAN.md — KeyTestResult, DataSourceChoice, DueSearchesDialog, DataStatusBar
- [ ] 04-21-PLAN.md — 10 re-renders spend 0 (browser) with mutant proofs
- [ ] 04-22-PLAN.md — DataShell in the (app) layout: status bar, cap prompt host, on-open alerts, announcements
- [ ] 04-23-PLAN.md — Settings "RentCast usage" section + Test key (0 calls) hook
- [ ] 04-24-PLAN.md — E2E + axe: status bar, due-search dialog, Settings data states (RentCast fully mocked)
- [ ] 04-25-PLAN.md — real-key HUMAN-UAT (U1-U14), validation walk, requirements, full verify
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
**Plans**: 16 plans in 7 waves
Plans:
- [ ] 05-01-PLAN.md — Core AI primitives: SSE parser (every-offset fuzz), error classifier, date-effective cost; web depends on @tran/core (wave 1)
- [ ] 05-02-PLAN.md — Fair Housing engine: types, p`` helper + ReDoS guard, Unicode matcher, allow-list, overlap merge, applyAlternative (wave 1)
- [ ] 05-03-PLAN.md — PII minimization: redactPii + restorePii (wave 1)
- [ ] 05-04-PLAN.md — Fair Housing lexicon (41 entries) + 42 bad / 40 neutral suite, leave-one-out + planted mutation, ReDoS budget (wave 2)
- [ ] 05-05-PLAN.md — LlmProvider port, models.ts registry, HTTP/SSE helpers, fake SSE, Test connection + TypeError disambiguation (wave 2)
- [ ] 05-06-PLAN.md — Panel controller (gating incl. postChecks/per-exit disable, tokens/footer payloads), exits, Gemini gate, AI copy module (wave 2)
- [ ] 05-07-PLAN.md — Anthropic + OpenAI streaming adapters and probes (wave 3)
- [ ] 05-08-PLAN.md — Gemini + OpenRouter streaming adapters and probes (wave 3)
- [ ] 05-09-PLAN.md — Prompt registry (guardrail, redaction, inputHash), runGeneration runner, fixture provider (wave 3)
- [ ] 05-12-PLAN.md — popover/textarea copy-ins, FairHousingText, FindingPopover, FindingsSummary, contrast pairs (wave 3)
- [ ] 05-10-PLAN.md — No-auto-send enforcement: ESLint lib/ai boundary + TS import-graph test (wave 4)
- [ ] 05-11-PLAN.md — Phase 3 integration: aiArtifacts table + backup, AI prefs, provider selection, testKey hooks (wave 4)
- [ ] 05-13-PLAN.md — GenerationPanel + PanelState, GenerationError, GeminiDataDialog, ProviderChip; exactly-three-exits SSR test (wave 5)
- [ ] 05-14-PLAN.md — Draft history, provider picker, sample toggle, model override + Test connection in key cards (wave 5)
- [ ] 05-15-PLAN.md — Settings "AI drafting" section (position 3) + E2E spike and core flows (wave 6)
- [ ] 05-16-PLAN.md — Guardrail E2E, axe across all states, HUMAN-UAT, VALIDATION, pnpm verify (wave 7)
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
**Plans**: 22 plans in 8 waves
Plans:
- [ ] 06-01-PLAN.md — Core renter types, location normalization, fetch-wide params and local filters (TDD)
- [ ] 06-02-PLAN.md — Core fair-rent comparison and affordability math (TDD)
- [ ] 06-03-PLAN.md — Core history, sparkline, safe contact links, honest recency status, formatters (TDD)
- [ ] 06-04-PLAN.md — Renter route shells + sub-nav, OSM img-src in both CSP files, E2E route lists
- [ ] 06-05-PLAN.md — Guardrails: map-library and shared-affordability lint boundaries, scoped renter banned terms, SW tile exclusion
- [ ] 06-06-PLAN.md — renter/outreach.v1 prompt with minimized inputs + artifact subjectId
- [ ] 06-07-PLAN.md — Core sort, URL state codec, filter labels, filtered new-since (TDD)
- [ ] 06-08-PLAN.md — Core shortlist and saved-search record schemas (TDD)
- [ ] 06-09-PLAN.md — No-network E2E harness: deny-all, synthetic tile, RentCast mocks, mocked key
- [ ] 06-10-PLAN.md — Shared listing components: property marks, LocationField, PriceHistory, status chip
- [ ] 06-11-PLAN.md — Renter request builders, gateway 0-call/by-id contract, Dexie shortlist + search-meta repos
- [ ] 06-12-PLAN.md — Zero-call affordability calculator (shared) + route + E2E
- [ ] 06-13-PLAN.md — Search controller, form, filters, results header, truncation + Narrow, sample search + E2E
- [ ] 06-14-PLAN.md — Listing detail (?id=) with 0-call resolution, contact, history, not-found, shortlist toggle + E2E
- [ ] 06-15-PLAN.md — Shortlist board with status tracking and notes + E2E
- [ ] 06-16-PLAN.md — Listing cards, paginated list, List/Map tabs + E2E
- [ ] 06-17-PLAN.md — Fair-rent check: ZIP median (Tier 1) + rent estimate (Tier 2) + E2E
- [ ] 06-18-PLAN.md — AI outreach section via GenerationPanel (Fair Housing gated) + E2E
- [ ] 06-19-PLAN.md — Lazy Leaflet + OSM map with supercluster, sample backdrop, selection + E2E
- [ ] 06-20-PLAN.md — Saved searches with "N new since last visit" (page.clock 24h) + E2E
- [ ] 06-21-PLAN.md — Map split view and list-map linking polish (cut line 1) + E2E
- [ ] 06-22-PLAN.md — Demo-credibility matrix, 3-call journey, validation close-out, pnpm verify
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
**Plans**: 21 plans in 8 waves
Plans:
- [ ] 07-01-PLAN.md — Core money (exact mulBps), single formatter, amortization anchors; fast-check + layerchart installs (wave 1)
- [ ] 07-02-PLAN.md — Core numeric post-check in packages/core/src/numbers (tolerant matching, spelled-out warns) (wave 1)
- [ ] 07-03-PLAN.md — Nine route stubs, shared PortalSubNav + NotFoundPanel, route registries, banned-terms scope, E2E helpers (wave 1)
- [ ] 07-04-PLAN.md — GenerationPanel postChecks + gate state, grouped findings, DraftHistory subjectId, prompt sample text (wave 1)
- [ ] 07-05-PLAN.md — analyze(), expense lines, defaults, definitions, 9 exact reference cases, fast-check invariants (wave 2)
- [ ] 07-06-PLAN.md — Market series math (rent trend, price-to-rent), summaries, 5-ZIP watch rules (wave 2)
- [ ] 07-07-PLAN.md — Best-in-row comparison and zero-call quick metrics (wave 3)
- [ ] 07-08-PLAN.md — Memo FACTS + allowed set, sample memo, analysis hash, advice-language check (wave 4)
- [ ] 07-09-PLAN.md — Dexie tables + backup, deals and watched-ZIP repos, InvestorDataPort and MarketsPort (wave 3)
- [ ] 07-10-PLAN.md — Analyzer form model, money/percent inputs, unit toggle, expense-lines editor (wave 3)
- [ ] 07-11-PLAN.md — Shared accessible charts (ChartFigure, ZipTrendChart, PriceToRentChart) on LayerChart + token mapping (wave 3)
- [ ] 07-12-PLAN.md — Analyzer page, results panel, draft autosave, save/sample/clear; E2E manual = 0 calls (wave 4)
- [ ] 07-13-PLAN.md — Markets page + ZIP dashboard; E2E cap 5, cost labels, chart a11y/tokens/CSP (wave 4)
- [ ] 07-14-PLAN.md — Buy-box repo on Phase 4 saved searches/scheduler, local matches, 0-call quick metrics (wave 4)
- [ ] 07-15-PLAN.md — Autofill rent/value with cost first and provenance chips; E2E (wave 5)
- [ ] 07-16-PLAN.md — Saved deals list + side-by-side compare (table / stacked at 375px); E2E (wave 5)
- [ ] 07-17-PLAN.md — Memo prompt (FACTS only), number/advice post-checks, memo page; E2E gating (wave 5)
- [ ] 07-18-PLAN.md — Buy boxes page, Load ZIP rents, Deep analyze (2 calls); E2E call counts (wave 6)
- [ ] 07-19-PLAN.md — (print) PrintReport shell + print.css, /print/memo/; E2E print media + PDF pages (wave 6)
- [ ] 07-20-PLAN.md — Investor overview + cross-route axe/CSP/375px sweep in both modes (wave 7)
- [ ] 07-21-PLAN.md — Demo + budget E2E (keyless 0 calls, keyed exactly 6), validation walk, full verify (wave 8)
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
**Plans**: 26 plans (waves 1-8)
- [ ] 08-01-PLAN.md - Core agent contracts, schemas, sample profile and normalization (wave 1)
- [ ] 08-02-PLAN.md - Merged agent gateway ban, (public) boundary and transitive import-graph test (wave 1)
- [ ] 08-03-PLAN.md - CSP img-src blob: two-file change, oracle tests and banned-terms scope (wave 1)
- [ ] 08-04-PLAN.md - Brand color contrast assessment and logo byte sniffing (wave 1)
- [ ] 08-05-PLAN.md - TRAN-LEAD v1 builder, tolerant parser and free-form extraction (wave 2)
- [ ] 08-06-PLAN.md - Dedupe dry-run diff and inquiry link parameter contract (wave 2)
- [ ] 08-07-PLAN.md - RFC 4180 CSV module and contacts column contract (wave 2)
- [ ] 08-08-PLAN.md - State-aware disclosure composer and CAN-SPAM email footer (wave 2)
- [ ] 08-09-PLAN.md - Stage transitions, due-today grouping and smart lists (wave 2)
- [ ] 08-10-PLAN.md - Agent UI primitives, dropdown-menu copy-in and local dates (wave 2)
- [ ] 08-11-PLAN.md - Agent shell: AgentNav, layout, skeleton routes and route lists (wave 2)
- [ ] 08-12-PLAN.md - Dexie tables, profile and contacts repos, backup registration (wave 3)
- [ ] 08-13-PLAN.md - Public inquiry page, Web3Forms sink and mocked E2E (wave 3)
- [ ] 08-17-PLAN.md - ContactCard, DueBadge and SmartListFilter (wave 3)
- [ ] 08-14-PLAN.md - Tasks repository and single-transaction import commit (wave 4)
- [ ] 08-15-PLAN.md - Sample contacts, quick add with duplicates, empty state and notice (wave 4)
- [ ] 08-16-PLAN.md - Profile details and live disclosure preview (wave 4)
- [ ] 08-18-PLAN.md - Contacts page and CSV export (wave 5)
- [ ] 08-19-PLAN.md - Pipeline board with Move menu and native drag and drop (wave 5)
- [ ] 08-20-PLAN.md - Paste and CSV import with dry-run review (wave 5)
- [ ] 08-21-PLAN.md - Due-today queue, agent home and task rows (wave 5)
- [ ] 08-22-PLAN.md - Logo upload, brand colors and brand preview (wave 5)
- [ ] 08-23-PLAN.md - Contact detail: tasks, notes, activity, stage, delete (wave 6)
- [ ] 08-24-PLAN.md - Inquiry share-link builder (wave 6)
- [ ] 08-25-PLAN.md - AI follow-up composer with CAN-SPAM footer (wave 7)
- [ ] 08-26-PLAN.md - Demo-credibility sweep, HUMAN-UAT and full verify (wave 8)
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
**Plans**: 23 plans in 10 waves
Plans:
- [ ] 09-01-PLAN.md — Disclosure variants (ad-inline/ad-block/print), platform limits, disclosure-last assembly, state team/title warnings (wave 1)
- [ ] 09-02-PLAN.md — Number check exposed from @tran/core/numbers, number-word detector, allowed-number sets (wave 1)
- [ ] 09-03-PLAN.md — Listing facts whitelist + validation, unsupported-feature check (wave 1)
- [ ] 09-04-PLAN.md — Fair Housing lexicon: listing hot spots, hashtag forms, advertising category, safe-harbor neutrals (wave 1)
- [ ] 09-05-PLAN.md — Snapshot metrics, aggregate-only listings summary, shared figure formatting, allowed numbers (wave 1)
- [ ] 09-06-PLAN.md — Social pack section parser + hashtags; reel parser, code-owned timing, results placeholder rule (wave 1)
- [ ] 09-07-PLAN.md — Banned-terms gate: studio scope + studio phrases, no allowlist, non-vacuity (wave 1)
- [ ] 09-08-PLAN.md — GenerationPanel footerLabel/formatForExit, Fixture sample hook, PrintReport preparedLine, ChartFigure print sizing (wave 1)
- [ ] 09-09-PLAN.md — Six prerendered studio/print routes, route lists, AgentNav Studio, snapshot-only DataStatusBar (wave 1)
- [ ] 09-10-PLAN.md — @tran/core/studio barrel, composer variant overload, shared agent-profile module, Phase 8 boundary scope (wave 2)
- [ ] 09-11-PLAN.md — Studio storage: studioDraft + snapshots tables, backup, autosave (wave 3)
- [ ] 09-12-PLAN.md — DisclosureStatus, InputFairHousingNote, CharacterCount, Studio hub (wave 4)
- [ ] 09-13-PLAN.md — listing.v1 + snapshot.v1 prompts with input-built samples, studio post-checks (wave 3)
- [ ] 09-14-PLAN.md — Snapshot data via shared market request (0/1/2 calls), frozen record builder, sample record (wave 4)
- [ ] 09-15-PLAN.md — STU-01 listing description page + keyless E2E (wave 5)
- [ ] 09-16-PLAN.md — Snapshot ZIP picker, key figures, section toggles, aggregate listings table (wave 5)
- [ ] 09-17-PLAN.md — STU-04 snapshot builder steps 3-4, save gate, saved list + E2E (wave 6)
- [ ] 09-18-PLAN.md — STU-04 print route, brand band, labels, prominence, studio boundaries + print E2E (wave 6)
- [ ] 09-19-PLAN.md — social.v1 prompt + GenerationPanel sections mode with PlatformCard (wave 7)
- [ ] 09-20-PLAN.md — STU-02 social post pack page + E2E (wave 8)
- [ ] 09-21-PLAN.md — reel.v1 prompt, results/quote checks, AI-disclosure checklist, copy formatter (wave 8)
- [ ] 09-22-PLAN.md — STU-03 reel script page + E2E (wave 9)
- [ ] 09-23-PLAN.md — Cross-route keyless/axe proof, validation map, human UAT, full verify (wave 10)
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
**Plans**: 23 plans

Plans:
- [ ] 10-01-PLAN.md — Wave 0 gate + Phase 2-9 contract map; validated site-config (PUBLIC_* optional), SITE_URL define, prerender.origin
- [ ] 10-02-PLAN.md — Host-aware CSP builder; build targets root/sub/configured; CSP oracle JSON-LD exemption + optional analytics host
- [ ] 10-03-PLAN.md — Lint boundaries (lib/analytics fetch allowlist, marketing-safe imports) + banned-terms scope
- [ ] 10-04-PLAN.md — Full pnpm audit clean with reviewed exceptions; Dependabot npm; supply-chain test
- [ ] 10-05-PLAN.md — E2E harness: configured build/project, MIME types, beacon collector, siteEnv, CI configured leg
- [ ] 10-06-PLAN.md — Analytics beacon modules (payload whitelist, GPC/DNT, no-cors transport) test-first
- [ ] 10-07-PLAN.md — SEO libs: JSON-LD serializer, canonical paths, WOFF->SFNT + resvg share-card renderer
- [ ] 10-08-PLAN.md — Core finance calculators (cap rate, cash-on-cash, DSCR) + input parsing/formatting
- [ ] 10-09-PLAN.md — SEO and JS-budget build oracles with mutation tests
- [ ] 10-10-PLAN.md — Calculator content module, SeoHead, sitemap/robots and six OG endpoints
- [ ] 10-11-PLAN.md — SeoHead on marketing pages, noindex elsewhere, SEO E2E
- [ ] 10-12-PLAN.md — Calculator components (shell, fields, three calculators)
- [ ] 10-13-PLAN.md — ToolPage frame, /tools/ hub and three calculator pages
- [ ] 10-14-PLAN.md — Affordability tool page, footer Tools column, tools E2E
- [ ] 10-15-PLAN.md — Onboarding state + inline Get started guide on the landing
- [ ] 10-16-PLAN.md — /setup/rentcast/ guided key setup + ?source=sample hand-off
- [ ] 10-17-PLAN.md — Form gates + owner Web3Forms sink + per-portal waitlist (+ E2E)
- [ ] 10-18-PLAN.md — Feedback form/page, footer + Settings Getting started (+ E2E)
- [ ] 10-19-PLAN.md — Beacon wiring, privacy Usage counts, owner go-live steps, beacon/third-party E2E
- [ ] 10-20-PLAN.md — Onboarding, setup and CLS E2E
- [ ] 10-21-PLAN.md — Keyed-state axe on every route, disclaimer audit, final route lists
- [ ] 10-22-PLAN.md — Launch-audit generator + PITFALLS evidence map
- [ ] 10-23-PLAN.md — Compose verify/CI, generate docs/LAUNCH-AUDIT.md, HUMAN-UAT, validation sign-off
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
**Plans:** 12/12 plans complete
Plans:
- [ ] 11-01-PLAN.md — Scaffold apps/extension (WXT 0.21.4), one-shot deps, test harness, contracts (selectors, copy, messages, settings)
- [ ] 11-02-PLAN.md — Brand icons + Edge 300x300 logo from a committed generator
- [ ] 11-03-PLAN.md — Label-first detector + synthetic fixtures A-D
- [ ] 11-04-PLAN.md — Closed-shadow reveal pill, manifest content CSS, brand parity gate
- [ ] 11-05-PLAN.md — Popup state model (DI'd messaging) + token mirror
- [ ] 11-06-PLAN.md — Zero-network: ESLint ban + production manifest/bundle/zip oracle (mutation-tested)
- [ ] 11-07-PLAN.md — Gated release workflow, install guide, Edge listing copy, privacy #browser-extension section
- [ ] 11-08-PLAN.md — Reconcile, scoped debounced observer, filter controller (scroll + SPA)
- [ ] 11-09-PLAN.md — Svelte popup components + browser-mode axe across all states
- [ ] 11-10-PLAN.md — Content + badge entrypoints, first production build through the oracle
- [ ] 11-11-PLAN.md — Runtime Playwright E2E with a zero-network monitored session
- [ ] 11-12-PLAN.md — Verify/CI wiring, HUMAN-UAT, validation sign-off
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
| 1. Foundation, Origin & Security Baseline | 9/9 | Complete    | 2026-09-22 |
| 2. Brand System, Marketing & Legal Pages | 0/TBD | Complete    | 2026-10-05 |
| 3. Local Platform: Storage, Key Vault & Backup | 0/TBD | Not started | - |
| 4. Data Layer: RentCast Gateway, Budget Guard & Demo Fixtures | 0/TBD | Not started | - |
| 5. AI Layer: Providers, Streaming & Fair Housing Guardrails | 0/TBD | Not started | - |
| 6. Renter Portal | 0/TBD | Not started | - |
| 7. Investor Portal | 0/TBD | Not started | - |
| 8. Agent Portal: Profile, Lead Intake & CRM | 0/TBD | Not started | - |
| 9. Agent Content Studio & Market Snapshot Reports | 0/23 | Planned | - |
| 10. Launch Hardening & Go-to-Market | 0/23 | Planned | - |
| 11. Zillow Sponsored Listing Filter Extension | 0/TBD | Not started | - |
