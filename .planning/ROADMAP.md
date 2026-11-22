# Roadmap: Tran Real Estate Tools

## Milestones

- ✅ **v1.0 MVP** — Phases 1-11 (shipped 2026-10-29) — full details in `milestones/v1.0-ROADMAP.md`
- ✅ **v1.1 Launch & Hardening** — Phases 12-17 (shipped 2026-11-20) — full details in `milestones/v1.1-ROADMAP.md`
- 🔄 **v1.2 Maintenance & Release Hygiene** — Phases 18-21 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-11) — SHIPPED 2026-10-29</summary>

- [x] Phase 1: Foundation, Origin & Security Baseline (9/9 plans) — completed 2026-09-22
- [x] Phase 2: Brand System, Marketing & Legal Pages (12/12 plans) — completed 2026-10-05
- [x] Phase 3: Local Platform: Storage, Key Vault & Backup (17/17 plans) — completed 2026-10-05
- [x] Phase 4: Data Layer: RentCast Gateway, Budget Guard & Demo Fixtures (25/25 plans) — completed 2026-10-05
- [x] Phase 5: AI Layer: Providers, Streaming & Fair Housing Guardrails (16/16 plans) — completed 2026-10-05
- [x] Phase 6: Renter Portal (22/22 plans) — completed 2026-10-06
- [x] Phase 7: Investor Portal (21/21 plans) — completed 2026-10-06
- [x] Phase 8: Agent Portal: Profile, Lead Intake & CRM (27/27 plans) — completed 2026-10-07
- [x] Phase 9: Agent Content Studio & Market Snapshot Reports (25/25 plans) — completed 2026-10-13
- [x] Phase 10: Launch Hardening & Go-to-Market (23/23 plans) — completed 2026-10-14
- [x] Phase 11: Zillow Sponsored Listing Filter Extension (12/12 plans) — completed 2026-10-29

Every phase closed with verifier status `human_needed` (no code gaps); the owner rows live in each phase's `*-HUMAN-UAT.md`. Milestone audit: `milestones/v1.0-MILESTONE-AUDIT.md`.

</details>

<details>
<summary>✅ v1.1 Launch & Hardening (Phases 12-17) — SHIPPED 2026-11-20</summary>

- [x] Phase 12: Go-live Readiness & Local Smoke Suite (10/10 plans) — completed 2026-10-29
- [x] Phase 13: Live Origin: First CI Run, First Deploy, Post-Deploy Smoke & UAT Burn-down (21/21 plans) — completed 2026-11-01
- [x] Phase 14: Carried Debt (12/12 plans) — completed 2026-11-06
- [x] Phase 15: Load-Deterministic Test Lanes (11/11 plans) — completed 2026-11-11
- [x] Phase 16: Toolchain: pnpm 12 → SvelteKit 3 → Vitest 5 (13/13 plans) — completed 2026-11-16
- [x] Phase 17: Extension Release & Edge Add-ons Submission (5/5 plans) — completed 2026-11-20 (store submission cut by the owner; GitHub Release only)

Live at `https://wolfwdavid.github.io/tran_real_estate/`. Requirements 39/41: LIVE-05 partial (Search Console sitemap read carried), EXT-09 cut. Milestone audit: `milestones/v1.1-MILESTONE-AUDIT.md` (status `tech_debt`).

</details>

### 🔄 v1.2 Maintenance & Release Hygiene (In Progress)

- [ ] **Phase 18: Live Smoke Stability** - Live smoke stops hitting CDN 429s and stops false-failing on superseded pushes
- [ ] **Phase 19: JS Budget Accuracy & Headroom** - Budget oracle counts what a route really loads, routes get 2 KB headroom, Dependabot PR goes green
- [ ] **Phase 20: CI & Release Gates** - Smoke before deploy, actionlint, verify/CI hygiene parity, extension release gated on ci
- [ ] **Phase 21: Site, Docs & Rollback Drill** - Privacy contact, extension Releases link, README and stale records corrected, rollback drilled

## Phase Details

### Phase 18: Live Smoke Stability
**Goal**: The live smoke that follows each deploy is a trustworthy signal: green when the site is healthy, not red from CDN rate limiting or a superseded push
**Depends on**: Nothing (first phase of v1.2; every later push is judged by this smoke)
**Requirements**: SMOKE-07, SMOKE-08
**Success Criteria** (what must be TRUE):
  1. The suite's request volume against the live origin is measured and recorded, and the paced suite stays under the observed CDN limit
  2. Three consecutive pushes each produce a green chained live-smoke run with zero retries configured and no 429 ignored
  3. Two pushes in quick succession do not produce a red live smoke for the superseded SHA
  4. A test on the workflow or smoke entry script fails when the superseded-SHA handling is removed
**Research flag**: No (fix to existing code)
**UI hint**: no
**Plans**: 5 plans

Plans:
- [x] 18-01-PLAN.md - Baseline: emulator request counter, per-spec volume on the Kit 3 build, two local probes
- [x] 18-02-PLAN.md - Cut live volume: 9-route third-party sample, one shared service worker install, SEO share tags from HTML
- [x] 18-03-PLAN.md - No 429 ignored (API-context) and superseded-SHA outcome in smoke.mjs, token env in live-smoke.yml
- [x] 18-04-PLAN.md - Record volume in the RUNBOOK with an oracle, full pre-push verification
- [ ] 18-05-PLAN.md - Owner-gated proof: three sequential pushes, each with a green chained live-smoke run

### Phase 19: JS Budget Accuracy & Headroom
**Goal**: The JS size gate measures what a route really loads under SvelteKit 3, every route passes it with margin, and routine dependency updates can merge
**Depends on**: Phase 18 (green live smoke judges the pushes)
**Requirements**: BUDGET-01, BUDGET-02, BUDGET-03
**Success Criteria** (what must be TRUE):
  1. On every gated route the oracle's figure agrees with a measured browser transfer within a stated tolerance (tools/cash-on-cash no longer reads 59.78 KB against 62.85 KB measured)
  2. A planted undercount in the oracle turns a test red
  3. Every gated route is under 60 KB gzipped by the corrected count with at least 2 KB of headroom, and the 60 KB limit is unchanged
  4. Dependabot PR #18 or its successor is green on both budget steps and merged
**Research flag**: No (fix to existing code)
**UI hint**: no
**Plans**: TBD

### Phase 20: CI & Release Gates
**Goal**: A broken build, a malformed workflow, a hygiene violation, or an unverified tag can no longer reach deploy or release
**Depends on**: Phase 18 (the suite added to CI is the paced one)
**Requirements**: CI-01, CI-02, CI-03, EXT-10
**Success Criteria** (what must be TRUE):
  1. ci.yml runs the smoke suite against the local build before the deploy job, and a failing smoke blocks the deploy
  2. actionlint runs in CI over every workflow file and a workflow error fails the run
  3. pnpm verify runs the same commit-hygiene history check as CI, and a test pins the parity
  4. extension-release.yml creates no release unless ci concluded with success for the tagged commit, and extension-release-gate.test.ts covers it in the same commit
**Research flag**: No (fix to existing code)
**UI hint**: no
**Plans**: TBD

### Phase 21: Site, Docs & Rollback Drill
**Goal**: What the live site, the README, and the records say matches the repository, and the rollback path is proven on the live site
**Depends on**: Phase 20 (the rollback drill runs through the final deploy path)
**Requirements**: SMOKE-09, EXT-11, DOCS-01, DOCS-02, DOCS-03
**Success Criteria** (what must be TRUE):
  1. The live privacy page shows the owner's chosen contact route and no longer says contact details will be posted before public launch
  2. A visitor reaches the extension's GitHub Releases page from the site in one click, docs/EXTENSION-INSTALL.md gives the Releases URL, and the banned-word and non-affiliation tests pass
  3. README.md matches the repository: verify chain, test:unit project list, build count, and script table
  4. The pnpm audit ignored count equals the recorded exceptions, the Vitest configs import the lane manifest without the native-loader warning, and guard comments cite Vitest 5
  5. The rollback (re-run the deploy on the previous commit) is performed once on the live site and the result is recorded in docs/RUNBOOK.md
**Research flag**: No
**UI hint**: yes
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation, Origin & Security Baseline | v1.0 | 9/9 | Complete | 2026-09-22 |
| 2. Brand System, Marketing & Legal Pages | v1.0 | 12/12 | Complete | 2026-10-05 |
| 3. Local Platform: Storage, Key Vault & Backup | v1.0 | 17/17 | Complete | 2026-10-05 |
| 4. Data Layer: RentCast Gateway, Budget Guard & Demo Fixtures | v1.0 | 25/25 | Complete | 2026-10-05 |
| 5. AI Layer: Providers, Streaming & Fair Housing Guardrails | v1.0 | 16/16 | Complete | 2026-10-05 |
| 6. Renter Portal | v1.0 | 22/22 | Complete | 2026-10-06 |
| 7. Investor Portal | v1.0 | 21/21 | Complete | 2026-10-06 |
| 8. Agent Portal: Profile, Lead Intake & CRM | v1.0 | 27/27 | Complete | 2026-10-07 |
| 9. Agent Content Studio & Market Snapshot Reports | v1.0 | 25/25 | Complete | 2026-10-13 |
| 10. Launch Hardening & Go-to-Market | v1.0 | 23/23 | Complete | 2026-10-14 |
| 11. Zillow Sponsored Listing Filter Extension | v1.0 | 12/12 | Complete | 2026-10-29 |
| 12. Go-live Readiness & Local Smoke Suite | v1.1 | 10/10 | Complete    | 2026-10-29 |
| 13. Live Origin: First CI Run, First Deploy, Post-Deploy Smoke & UAT Burn-down | v1.1 | 21/21 | Complete   | 2026-11-01 |
| 14. Carried Debt | v1.1 | 12/12 | Complete    | 2026-11-06 |
| 15. Load-Deterministic Test Lanes | v1.1 | 11/11 | Complete    | 2026-11-11 |
| 16. Toolchain: pnpm 12 → SvelteKit 3 → Vitest 5 | v1.1 | 13/13 | Complete    | 2026-11-16 |
| 17. Extension Release & Edge Add-ons Submission | v1.1 | 5/5 | Complete    | 2026-11-20 |
| 18. Live Smoke Stability | v1.2 | 4/5 | In Progress|  |
| 19. JS Budget Accuracy & Headroom | v1.2 | 0/0 | Not started | - |
| 20. CI & Release Gates | v1.2 | 0/0 | Not started | - |
| 21. Site, Docs & Rollback Drill | v1.2 | 0/0 | Not started | - |
