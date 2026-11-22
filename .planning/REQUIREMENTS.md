# Requirements: Tran Real Estate Tools — v1.2 Maintenance & Release Hygiene

**Defined:** 2026-11-21
**Core Value:** A visitor in any of the three portals can go from "what I'm looking for" to an actionable result in minutes instead of hours, using only legitimate data sources.
**Milestone goal:** Clear the debt carried out of v1.1 so routine dependency updates and deploys pass without manual help. No new portal features.

Source: `.planning/milestones/v1.1-MILESTONE-AUDIT.md` (warnings W1 to W5, info items I1 to I8) and the two rate-limited live-smoke runs on `f91b91b` (44932727516, 44959696791). No domain research was run (owner choice 2026-11-21: fixes to existing code). Earlier requirements are archived in `.planning/milestones/v1.0-REQUIREMENTS.md` and `v1.1-REQUIREMENTS.md`. IDs continue existing category numbering (SMOKE-07+, EXT-10+) or open new categories (BUDGET, CI, DOCS).

## v1.2 Requirements

### Live smoke (SMOKE)

- [ ] **SMOKE-07**: The live smoke that follows a deploy finishes green without being rate-limited by the Pages CDN: the suite's request volume against the live origin is measured and kept under the observed limit (fewer or paced navigations), with zero retries kept, proven by three consecutive pushes whose chained live-smoke runs are green
- [ ] **SMOKE-08**: Two pushes in quick succession do not produce a false-red live smoke (the superseded-SHA case from audit item I3), pinned by a test on the workflow or the smoke entry script
- [ ] **SMOKE-09**: The runbook's rollback path (re-run the deploy on the previous commit) is drilled once on the live site and the result is recorded in `docs/RUNBOOK.md`

### JS size budget (BUDGET)

- [ ] **BUDGET-01**: The budget oracle counts the JavaScript a route actually loads under SvelteKit 3: on every gated route its figure agrees with a measured browser transfer within a stated tolerance, and a planted undercount turns a test red (audit W2: 59.78 KB counted against 62.85 KB measured on `tools/cash-on-cash`). This makes the gate stricter; the 60 KB limit itself is not raised
- [ ] **BUDGET-02**: Every gated route ships under the 60 KB gzipped limit by the corrected count, with at least 2 KB of headroom on each route
- [ ] **BUDGET-03**: The weekly Dependabot minor/patch update passes CI: PR #18 or its successor is green on the two budget steps and merged (audit W1)

### CI and workflows (CI)

- [ ] **CI-01**: `ci.yml` runs the smoke suite against the local build before the deploy job, and a smoke failure blocks the deploy (audit W3)
- [ ] **CI-02**: actionlint runs in CI over every workflow file and fails the run on an error (audit I1)
- [ ] **CI-03**: `pnpm verify` runs the same commit-hygiene history check that CI runs, with the parity pinned by a test (audit I2)

### Extension release (EXT)

- [ ] **EXT-10**: `extension-release.yml` refuses to create a release unless `ci` concluded with success for the tagged commit, with `extension-release-gate.test.ts` updated in the same commit (audit W4)
- [ ] **EXT-11**: A visitor can reach the extension's GitHub Releases page from the site in one click, and `docs/EXTENSION-INSTALL.md` gives the Releases URL; the copy passes the existing banned-word and non-affiliation tests (audit I8)

### Site and docs (DOCS)

- [ ] **DOCS-01**: The live privacy page no longer says contact details will be posted before public launch; it shows the contact route the owner chooses (audit W5)
- [ ] **DOCS-02**: `README.md` matches the repository after phases 12 to 17 (verify chain, `test:unit` project list, build count, script table) (audit I4)
- [ ] **DOCS-03**: Stale records are corrected: `pnpm audit` ignored count equals the recorded exceptions, the Vitest configs import the lane manifest without the native-loader warning, and the guard comments cite Vitest 5 (audit I5, I6)

## Future Requirements

Deferred. Tracked but not in this roadmap.

- **LIVE-05 (carried from v1.1)**: Search Console reads the submitted `sitemap.xml` (owner item, HUMAN-UAT L86/L99); tick when the owner records it
- **GTM-04 (moved to v2 in Phase 13)**: Umami usage counts from the deployed origin with GPC respected
- New portal features, monetization (hosted tier, accounts, billing)

### Owner items (no phase work)

- 68 pending rows in `.planning/HUMAN-UAT.md`
- Minimatch audit exception review due 2026-12-31
- Decision on Dependabot PRs #10 and #13
- Zillow terms "Updated" date and quoted section 5 wording for HUMAN-UAT L93
- Live Zillow checks not run in v1.1: the reveal click, the popup count line, Edge

## Out of Scope

| Feature | Reason |
|---------|--------|
| New portal features | v1.2 is a maintenance milestone |
| Raising the 60 KB JS budget | The fix is headroom and an accurate count, not a looser gate |
| Retries, timeout raises or ignoring 429 to make the live smoke green | Root causes only; zero retries stays |
| Any store listing for the extension | Owner decision 2026-11-20: GitHub Release only |
| Hosted tier, accounts, billing | Needs a host other than GitHub Pages |
| Custom domain | Costs money; $0 budget stands |
| TypeScript 7, Node 26 | Outside the tested pins |

## Traceability

Which phases cover which requirements. Filled during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SMOKE-07 | Phase 18 | Pending |
| SMOKE-08 | Phase 18 | Pending |
| SMOKE-09 | Phase 21 | Pending |
| BUDGET-01 | Phase 19 | Pending |
| BUDGET-02 | Phase 19 | Pending |
| BUDGET-03 | Phase 19 | Pending |
| CI-01 | Phase 20 | Pending |
| CI-02 | Phase 20 | Pending |
| CI-03 | Phase 20 | Pending |
| EXT-10 | Phase 20 | Pending |
| EXT-11 | Phase 21 | Pending |
| DOCS-01 | Phase 21 | Pending |
| DOCS-02 | Phase 21 | Pending |
| DOCS-03 | Phase 21 | Pending |

**Coverage:** 14 requirements, 14 mapped to phases 18-21, 0 unmapped.

---
*Defined 2026-11-21 at the start of milestone v1.2*
