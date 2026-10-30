# Roadmap: Tran Real Estate Tools

## Milestones

- ✅ **v1.0 MVP** — Phases 1-11 (shipped 2026-10-29) — full details in `milestones/v1.0-ROADMAP.md`
- 🔄 **v1.1 Launch & Hardening** — Phases 12-17 (in progress)

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

### 🔄 v1.1 Launch & Hardening (In Progress)

**Milestone Goal:** Take the locally verified v1.0 build live on its own origin (`https://tranrealestate.github.io/`), make go-live and every future deploy boring (a read-only smoke suite proves each deploy), and clear the debt and toolchain drift carried out of v1.0 so the platform sits on current, supported foundations. No new portal features.

**Requirements:** 41 (`REQUIREMENTS.md`): LIVE-01..09, SMOKE-01..06, DEBT-01..09, TEST-01..06, TOOL-01..06, EXT-05..09. Research: `research/SUMMARY.md` (2026-10-29); its "Where the four files disagree (resolved)" table is settled.

**Owner decisions honoured:** go-live happens EARLY (the owner gate closes Phase 12; the first deploy opens Phase 13), and the toolchain migration is its OWN phase (16) after the carried debt (14) and the deterministic lanes (15), and after the live origin exists (13), because the Kit 3 service-worker rewrite can only be proven by the live smoke.

**Phase Numbering:** integer phases continue from v1.0 (12-17). Decimal phases (12.1, 12.2) are urgent insertions via `/gsd:insert-phase`.

- [x] **Phase 12: Go-live Readiness & Local Smoke Suite** - Clean history, build stamp, `PUBLIC_SITE_URL` end to end, corrected deploy checklist, and a read-only smoke suite green against the local Pages emulator; closes with the owner creating the org and pushing `main` (completed 2026-10-29)
- [ ] **Phase 13: Live Origin: First CI Run, First Deploy, Post-Deploy Smoke & UAT Burn-down** - First green GitHub CI run, first deploy observed, `live-smoke.yml` chained behind every deploy, GTM-01..04 proven or cut, HUMAN-UAT rows reclassified, launch-proof bundle and runbook
- [ ] **Phase 14: Carried Debt** - The seven v1.0 follow-ups plus the emulator dotfile fix and the marketing-page JS trim, each closed to its sourced definition of done before the Kit 3 codemod
- [ ] **Phase 15: Load-Deterministic Test Lanes** - Timing-budget tests in serial lanes, mechanical guard against blind timeouts and retries, capped workers, recorded evidence protocol and shuffle seed
- [ ] **Phase 16: Toolchain: pnpm 12 → SvelteKit 3 → Vitest 5** - Three single-purpose migration plans gated by `pnpm verify` + local smoke, closed by a deploy and a green live smoke; audit exceptions 4 → 1
- [ ] **Phase 17: Extension Release & Edge Add-ons Submission** - Published `ext-v0.1.0` GitHub Release with checksums, changelog, hardened release workflow, Edge listing assets and submission; certification link is an owner follow-up

### Dependency Graph

```
12 (go-live readiness + local smoke; owner gate: org/repo/push)
 └─► 13 (live origin: first CI, first deploy, live-smoke.yml, UAT burn-down)
      ├─► 14 (carried debt)          ─┐
      ├─► 15 (deterministic lanes)   ─┼─► 16 (toolchain: pnpm 12 → Kit 3 → Vitest 5)
      └─► 17 (extension release)      │     (nothing else in flight while 16 runs)
            serialized against 16 ◄───┘
```

Execution order: 12 → 13 → {14, 15, 17 in any order or overlapping} → 16. Phase 17 may run before or after 16, never during it.

### Research and UI Flags

- `/gsd:research-phase` required: Phases 13, 16. Light check: Phase 17. Standard patterns (skip): Phases 12, 14, 15.
- `/gsd:ui-phase` (UI/UX Pro Max) before planning: Phase 14 (DEBT-02 copy is spec-owned, DEBT-09 touches the marketing and feedback forms).

## Phase Details

### Phase 12: Go-live Readiness & Local Smoke Suite
**Goal:** Everything that must be true before `git remote add` is true (clean history, re-derived gitleaks allowlist, build stamp, `PUBLIC_SITE_URL` honoured everywhere, a corrected deploy checklist), and a read-only, fail-closed smoke suite exists that proves the GitHub Pages contract against the local emulator for all three builds, so the first real deploy in Phase 13 is measured rather than eyeballed.
**Depends on:** Nothing (first phase of v1.1; builds on the shipped v1.0, Phase 11)
**Requirements:** LIVE-01, LIVE-04, LIVE-05, LIVE-08, SMOKE-01, SMOKE-02, SMOKE-03, SMOKE-05, SMOKE-06
**Success Criteria** (what must be TRUE):
  1. `git log` over the whole history shows zero AI co-author trailers and zero assistant mentions in commit messages (the 145 trailered 2026-10-13..14 commits rewritten, hashes quoted in `MILESTONES.md` and SUMMARY files remapped by subject), the `.gitleaks.toml` allowlist is re-derived for the rewritten commits, and the CI history scan (`secrets:scan` + `secrets:canary`) is green on the rewritten history.
  2. `pnpm smoke:local` runs the read-only smoke suite green against `scripts/serve-pages.mjs` for all three local builds (root, sub-path, configured) in under five minutes with zero retries and `--fail-on-flaky-tests`, reading the build stamp from the build directory; the suite refuses to start when `SMOKE_BASE_URL` is unset or non-`https://` (loopback only with `SMOKE_ALLOW_HTTP=1`), and a network monitor shows it never submits a form, enters a key, or calls RentCast or an LLM host.
  3. The suite asserts the whole live contract (landing 200 with brand title, trailing-slash redirect, deep-route refresh, HTTP 404 branded page, CSP meta first in `<head>` with the exact `connect-src` via the shared `assert-csp` oracle, every hashed asset 200, `sitemap.xml` URL count, `robots.txt` `Sitemap:` line, `manifest.webmanifest` 200, OG/Twitter absolute URLs on the audited origin with exactly one `og:image` returning `image/png`, zero third-party requests, same-origin service worker precaching only same-origin GETs, the `/legal/privacy/#browser-extension` anchor, build stamp equal to `SMOKE_EXPECT_VERSION` after polling up to ten minutes); exactly one GPC-off analytics spec lets one page-view beacon through and asserts the configured analytics host answers JSON 200, every other spec injects GPC; axe reports zero violations on `/`, one portal landing and `/legal/privacy/` against the built bundle.
  4. Every build serves `/_app/version.json` whose version equals the commit SHA (`kit.version.name` from `GITHUB_SHA`), and changing `PUBLIC_SITE_URL` alone changes canonical URLs, the sitemap, OG absolute URLs and the extension's `TRAN_ORIGIN` / `PRIVACY_URL`, proven by a test rather than a code hunt.
  5. `docs/DEPLOY-CHECKLIST.md` reads in the strict go-live order (empty public repo named exactly `tranrealestate.github.io`, never a README; Pages source = GitHub Actions before `PAGES_ENABLED`; push `main` with the variable unset; first CI green; then `PAGES_ENABLED=true` plus an empty commit), names the Umami collect host `gateway.umami.is` with the `curl` verification, places the Search Console meta tag after `%sveltekit.head%` in `app.html` with the slot pinned by a test, and carries the fresh-profile (InPrivate) rule on every post-redeploy check.
**Owner gate (closes the phase):** create the free `tranrealestate` org and the empty public repo `tranrealestate.github.io`, set Pages source = GitHub Actions, turn on secret scanning + push protection + Dependabot, `git remote add`, `git push -u origin main` with `PAGES_ENABLED` unset.
**Note on LIVE-05:** this phase owns the requirement and delivers its local half (the checklist corrections and the pinned Search Console meta slot). The live half ("Search Console verified, `sitemap.xml` submitted and read") can only happen once the origin exists and is completed in Phase 13 under LIVE-06's GTM-04 proof; LIVE-05 is ticked when Phase 13 records it.
**Research flag:** no (standard patterns: Playwright `APIRequestContext`, the emulator contract, `git filter-repo`, gitleaks allowlist shapes, Search Console meta method; all exercised in this repo already).
**UI hint:** no.
**Plans:** 10/10 plans complete

Plans:
- [x] 12-01-PLAN.md — Wave 1: repoint launch audit to the archived v1.0 PITFALLS (test:unit green) + commit-msg hygiene hook (LIVE-01)
- [x] 12-02-PLAN.md — Wave 2 (alone): git filter-repo message rewrite, commit-map remap, gitleaks allowlist re-derivation, hygiene guard in test:unit + CI (LIVE-01)
- [x] 12-03-PLAN.md — Wave 3: build stamp, kit.version.name = commit SHA via build-web BUILD_SHA, E2E stamp spec (LIVE-04)
- [x] 12-04-PLAN.md — Wave 3: extension TRAN_ORIGIN/PRIVACY_URL from PUBLIC_SITE_URL, oracle allowlist, probe build (LIVE-08)
- [x] 12-05-PLAN.md — Wave 3: deploy checklist in strict go-live order + pinned Search Console slot in app.html (LIVE-05)
- [x] 12-06-PLAN.md — Wave 3: smoke harness: fail-closed env gate, zero-retry config, GPC + read-only monitor fixtures, smoke.mjs + pnpm smoke:local (SMOKE-01)
- [x] 12-07-PLAN.md — Wave 4: configured target test origin, PUBLIC_SITE_URL in CI/release workflows, site-url.test.ts (LIVE-08)
- [x] 12-08-PLAN.md — Wave 5: routing/version/anchor/CSP/SEO/axe smoke specs green on three builds (SMOKE-02, SMOKE-03, SMOKE-06)
- [x] 12-09-PLAN.md — Wave 6: assets/SW/third-party specs, single GPC-off analytics spec + JSON collector, static read-only guard (SMOKE-01, SMOKE-02, SMOKE-05)
- [x] 12-10-PLAN.md — Wave 7: smoke:local in pnpm verify, phase gate, owner go-live checkpoint (all)

### Phase 13: Live Origin: First CI Run, First Deploy, Post-Deploy Smoke & UAT Burn-down
**Goal:** The v1.0 build is live at `https://wolfwdavid.github.io/tran_real_estate/`, CI has proven itself on GitHub, every deploy of `main` is followed automatically by the live smoke, the GTM proofs are ticked or cut, and the owner holds a runbook, a launch-proof bundle and one consolidated human-UAT ledger instead of 99 scattered rows (counting rule in `.planning/HUMAN-UAT.md`; the earlier figure 77 was a miscount of the 06/07 tables).
**Depends on:** Phase 12 (owner gate passed 2026-10-29 under the owner's account: repo `wolfwdavid/tran_real_estate`, Pages source = GitHub Actions, `main` pushed with `PAGES_ENABLED` unset)
**Requirements:** LIVE-02, LIVE-03, LIVE-06, LIVE-07, LIVE-09, SMOKE-04
**Success Criteria** (what must be TRUE):
  1. The first-ever GitHub run of `ci.yml` on `main` is green (hygiene, quality, three-leg matrix) with the deploy job skipped while `PAGES_ENABLED` is unset; anything the 4-vCPU runner surfaces is fixed at the root (no retries, no blind timeout raises). Observed 2026-10-29: runs 40961373692, 40965347969 and 40980243892 green with `deploy` skipped (CI baseline in PROJECT.md).
  2. After the owner sets `PAGES_ENABLED=true`, a push deploys to `https://wolfwdavid.github.io/tran_real_estate/` and a visitor in a fresh profile sees: landing 200, `/tran_real_estate/renter` redirecting to `/tran_real_estate/renter/`, a deep route surviving hard refresh, an unknown path returning the branded 404 with HTTP 404, and HTTPS enforced.
  3. Every completed `ci.yml` run on `main` is followed by a `live-smoke.yml` run (`workflow_run`, plus `workflow_dispatch` with a URL input) that polls `/_app/version.json` until it matches the deployed SHA and then goes green, failing its run on any assertion; `ci.yml`'s pinned action count is unchanged and the new workflow has its own gate test (`scripts/live-smoke-gate.test.ts`).
  4. GTM-01..GTM-04 are ticked with live proof (Umami pageviews with GPC respected from a fresh-profile normal browser, one Web3Forms waitlist and one feedback delivery, share cards in the Facebook and LinkedIn debuggers, Search Console verified by the meta tag with `sitemap.xml` submitted and read, which also completes LIVE-05's live half), or GTM-04 is cut per its documented cut line with the decision recorded in `PROJECT.md` Key Decisions.
  5. The 99 owner HUMAN-UAT rows are reclassified (rows the smoke verifies closed with run links; the truly human rows consolidated into one file with their results), a launch-proof bundle of dated screenshots and run links is committed under `docs/launch-proof/<date>/`, `docs/LAUNCH-AUDIT.md` is regenerated at the deployed commit, and the owner can follow `docs/RUNBOOK.md` to redeploy, roll back (re-run the deploy on the previous commit or revert and push), read a smoke result, and run the suites at the known-good worker counts for the dev machine and CI.
**Owner steps inside the phase:** set `PAGES_ENABLED=true` and the launch Variables (`PUBLIC_WEB3FORMS_KEY`, `PUBLIC_ANALYTICS_HOST` + `PUBLIC_ANALYTICS_WEBSITE_ID`, `PUBLIC_SITE_URL=https://wolfwdavid.github.io` (origin only, D-01), `BASE_PATH=/tran_real_estate` (D-02), optional `PUBLIC_CONTACT_EMAIL`); Search Console property; Umami and Web3Forms accounts; share-card debugger runs; real-key CORS checks per provider; the push-protection probe with a throwaway zero-permission PAT.
**Research flag:** YES. Run `/gsd:research-phase 13`: the first live run of `ci.yml` on a 4-vCPU `ubuntu-24.04` runner (three-leg E2E runtime, memory, Playwright worker count) cannot be pre-verified and is planned as "run, observe, quick-fix"; verify live that Pages returns HTTP 404 (not 200) for `404.html`, that the `workflow_run` payload carries `head_sha`, and the HTTP → HTTPS redirect.
**UI hint:** no.
**Plans:** 9/21 plans executed

Plans:
- [x] 13-01-PLAN.md — Wave 1: planning docs reconciled to wolfwdavid.github.io/tran_real_estate, CI baseline evidence (LIVE-02), owner decisions A/B/C (checkpoint)
- [x] 13-02-PLAN.md — Wave 1: resolveSiteUrl helper, DEFAULT_SITE_ORIGIN, extension __TRAN_SITE_URL__ + oracle allowlist, base-path proof group (D-03/D-04)
- [x] 13-20-PLAN.md — Wave 1: fixture-only test files substituted to the wolfwdavid.github.io origin (split from 13-02)
- [x] 13-03-PLAN.md — Wave 1: live-smoke.yml (workflow_run + dispatch) + live-smoke-gate.test.ts, mutation-checked (SMOKE-04)
- [x] 13-04-PLAN.md — Wave 1: DEPLOY-CHECKLIST personal-account rewrite + extension docs privacy URL, with their oracles
- [x] 13-05-PLAN.md — Wave 1: one HUMAN-UAT ledger (99 + 4 rows) + no-row-dropped test; twelve per-phase files superseded (LIVE-07)
- [x] 13-06-PLAN.md — Wave 2: root BASE_PATH knob through build-targets, emulator, Playwright root project, smoke.mjs, specs; launch-audit header (blocker)
- [x] 13-07-PLAN.md — Wave 2: Dependabot toolchain-major ignores (D-06) + shared-origin privacy copy (decision C)
- [ ] 13-08-PLAN.md — Wave 3: docs/RUNBOOK.md + runbook oracle (Dependabot policy per decision B); GPC-on proof-shot script (LIVE-09, D-20)
- [x] 13-09-PLAN.md — Wave 3: ci.yml + extension-release.yml BASE_PATH wiring with gate tests (uses count stays 7)
- [ ] 13-10-PLAN.md — Wave 4: local rehearsal of the go-live config + full verify gate set (production twin)
- [ ] 13-11-PLAN.md — Wave 5: owner push of the code wave, CI green, live-smoke skipped; Dependabot PR triage (checkpoints)
- [ ] 13-12-PLAN.md — Wave 6: owner sets PUBLIC_SITE_URL + BASE_PATH; rehearsal push green with Pages off (checkpoints)
- [ ] 13-13-PLAN.md — Wave 7: PAGES_ENABLED + go-live push; deploy and live-smoke green on one SHA; D-13 facts; fresh-profile checks
- [ ] 13-14-PLAN.md — Wave 8: GTM-04 Umami proof (IP finding with stop condition, probe, GPC off/on) or cut
- [ ] 13-21-PLAN.md — Wave 8: owner push-protection probe and live-origin CORS re-probe per provider (ledger L03, L88, L26, L36)
- [ ] 13-15-PLAN.md — Wave 9: cut line if needed; Web3Forms waitlist + feedback delivery; GTM-01 walk
- [ ] 13-16-PLAN.md — Wave 10: share cards in the debuggers; Search Console token in the pinned slot
- [ ] 13-17-PLAN.md — Wave 11: token deploy, property verified, sitemap read with 14 URLs (LIVE-05 live half)
- [ ] 13-18-PLAN.md — Wave 12: LAUNCH-AUDIT regenerated at the deployed commit with the deploy env (D-22)
- [ ] 13-19-PLAN.md — Wave 13: ledger results, launch-proof index, runbook facts, requirement ticks, final green trio

### Phase 14: Carried Debt
**Goal:** Every follow-up carried out of v1.0 is closed to its sourced definition of done (ListingCard ids, save-gate reason copy, memo print with notes-only numerals, origin-parity test, UI-level backup round-trip, tailwind-merge font-size token, saved-search scheduler lock, emulator dotfile fidelity, marketing-page JS budget) while `git blame` is still clean, before the Kit 3 codemod rewrites hundreds of files.
**Depends on:** Phase 13 (CI proven on GitHub, so every debt fix is the first code verified by a real run; may overlap Phase 15 — different files — and Phase 17)
**Requirements:** DEBT-01, DEBT-02, DEBT-03, DEBT-04, DEBT-05, DEBT-06, DEBT-07, DEBT-08, DEBT-09
**Success Criteria** (what must be TRUE):
  1. At 1280px on the renter Map tab with a pin selected, the document has no duplicate ids (hidden list, split list and selected-listing preview render distinct `ListingCard` ids), and focus after "Show more" and after pin-select still lands on the right listing link.
  2. A Market Snapshot draft with only review-only unacknowledged phrases shows the dedicated spec-owned reason string and Save stays refused until acknowledgement; must-fix reasons are pluralized correctly and a singular case is covered; an investor memo quoting a number present only in the notes prints at `/print/memo/` (notes numerals persisted in artifact `meta`, round-tripped by unit test, carried by backup export/import, with the Must-fix block case still green and a dropped-`meta`-write mutation turning the new test red).
  3. A non-vacuous scripts-project test asserts the extension `TRAN_ORIGIN` equals the web app `DEFAULT_SITE_ORIGIN`, `PRIVACY_URL` equals that origin plus `/legal/privacy/#browser-extension` (since Phase 13: origin + base path, i.e. `resolveSiteUrl()` + `/legal/privacy/#browser-extension`, per 13 D-04), and the anchor id exists in the privacy page source (literal URLs in the extension doc tests now import the constant); one Playwright spec seeds at least one row in every registered backup table, exports through the Settings UI, wipes the profile, imports with preview, and asserts each portal shows its row at zero RentCast calls.
  4. `cn('text-label text-muted-foreground')` keeps both classes, Badge and Button render the `text-label` computed font-size in real Chromium, and axe stays green across the copied-in primitives.
  5. The saved-search scheduler takes the `tran-alerts` lock with a bounded wait (about ten seconds, abort signal) and recomputes due searches inside the lock, the concurrency guard is mutation-tested, the two-tab proofs are green, and `renter-saved.spec.ts` is green under `--repeat-each 10` with CPU pressure; `scripts/serve-pages.mjs` answers 404 for dotfiles so a precache listing `.nojekyll` fails locally; `/feedback/` and the three `/for-*/` pages ship under the 60 KB gzipped JS budget as a hard gate in the launch audit.
**Owner decisions riding along (record in Key Decisions when taken):** snapshot page count / Studio license-title scheme, the duplicate memo block reason, the Showcase badge default (needed by Phase 17).
**Research flag:** no (standard patterns; every item has a sourced definition of done and existing test coverage).
**UI hint:** yes. Run `/gsd:ui-phase 14` with UI/UX Pro Max before planning: DEBT-02's reason copy is spec-owned (the dedicated string lives in the UI spec), and DEBT-09 touches the marketing/feedback forms (plain form controls, lazy-loaded validation) on the pages the UI spec governs.
**Plans:** TBD

### Phase 15: Load-Deterministic Test Lanes
**Goal:** Full `test:unit` and E2E runs are deterministic under parallel load: wall-clock budgets live in serial lanes, blind timeout raises and retries are mechanically impossible, worker counts are capped and recorded, and a dated evidence file proves it, so the Phase 16 migration has a trustworthy oracle.
**Depends on:** Phase 13 (CI runs on GitHub so the CI-side flags and worker counts can be observed; may overlap Phase 14 — different files — and Phase 17). Must finish before Phase 16; the lanes are defined on Vitest 4.
**Requirements:** TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06
**Success Criteria** (what must be TRUE):
  1. `pnpm test:unit` runs the parallel lane and then the `*-serial` Vitest projects (ReDoS scans, property-test timing, studio boundaries, precommit hook duration, the load-sensitive ResultsView browser test) with file parallelism off as a separate stage, while `ci.yml`'s single `pnpm test:unit` line is unchanged; a guard test fails when a timing assertion or a raised timeout appears outside the serial lane, or when a serial include does not exist, and every raised timeout that remains carries a measured number and a root-cause comment; no retries were added anywhere.
  2. Playwright in CI runs with `--fail-on-flaky-tests`, so a test that passes only on retry fails the job, and the retry policy is documented in the config.
  3. Vitest `maxWorkers` and Playwright `workers` are capped with the known-good values recorded for the dev machine and CI, and the Windows PATH/taskkill teardown guard from Phase 1 is covered by a test.
  4. `docs/test-evidence/<date>.md` records three consecutive clean full `pnpm verify` runs, `--repeat-each 3` green on every spec a deferred-items file names as load-sensitive, one full E2E run under artificial CPU pressure with zero failures, and one green unit run with shuffled file and test order whose seed is stored in the file.
**Research flag:** no (standard patterns: Vitest `--project` patterns, `--no-file-parallelism`, `sequence.shuffle`/`seed`; Playwright `--repeat-each`, `--fail-on-flaky-tests`, all verified on the installed versions).
**UI hint:** no.
**Plans:** TBD

### Phase 16: Toolchain: pnpm 12 → SvelteKit 3 → Vitest 5
**Goal:** The platform runs on current, supported majors (pnpm 12, SvelteKit 3.1 + adapter-static 4, Vitest 5 with its browser companions), migrated one tool per plan in that order with the full `pnpm verify` chain and the local smoke as the gate after each and a deploy plus a green live smoke closing the phase, clearing three of the four low audit exceptions before their 2027-01-31 revisit.
**Depends on:** Phase 13 (the live smoke is the only place the Kit 3 service-worker change is observable), Phase 14 (debt landed before the codemod), Phase 15 (deterministic oracle on Vitest 4). No plan from any other phase executes while this phase is in flight; Phase 17 is serialized against it.
**Requirements:** TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, TOOL-06
**Success Criteria** (what must be TRUE):
  1. `packageManager` pins pnpm 12, the lockfile was regenerated exactly once, the supply-chain test, `build-web.mjs` and the launch-audit test no longer hardcode `11.27.0`, and `pnpm install --frozen-lockfile` passes locally and in CI.
  2. The web app runs on SvelteKit 3.1 with adapter-static 4 (migrated with `sv migrate sveltekit-3`, one task group per commit): Kit options live in `vite.config.ts` with a plugin-free `kit.options.js` that the CSP, models and service-worker guard tests import; greps for `$lib`, `$service-worker` and `@migration-task` return zero with `#lib` (explicit extensions) across source, ESLint import groups, `components.json`, the Vitest alias and the still-non-vacuous boundary tests; `resolve()` pathnames, `$app/env` and shallow routing follow the Kit 3 forms; all three builds pass `csp:assert`, `seo:assert` and `budget:assert`.
  3. After the Kit 3 deploy, the live smoke shows the service worker (rewritten on `$app/manifest` with the dotfile filter inside the worker) registering on `https://tranrealestate.github.io/` and precaching only same-origin, non-dotfile GETs (`caches.keys()` contains `tran-shell-<sha>`).
  4. Unit and browser tests run on Vitest 5 with `@vitest/browser-playwright` 5 and `vitest-browser-svelte` 3: every `render` is awaited (zero bare `render(`), exact-text matchers and the `clearMocks` default are accounted for, the JSON reporter path used by `audit-evidence.mjs` still works, and the full `pnpm verify` is green.
  5. The recorded audit exceptions shrink from four to one (build-time deepmerge, revisit 2027-01-31) in both `scripts/lib/audit-exceptions.mjs` and `pnpm-workspace.yaml`, `pnpm audit --audit-level low` is clean apart from it, and the phase history shows each toolchain step as its own plan gated by `pnpm verify` + `pnpm smoke:local`, closed by a deploy with a green live smoke.
**Research flag:** YES. Run `/gsd:research-phase 16`: whether `/_app/version.json` keeps its path and shape under Kit 3 (the smoke's poll depends on it); whether `svelte-kit sync` is still needed in `prepare`; Rolldown chunking against the 60 KB per-page budget (0.5-1.9 KB headroom today); shadcn-svelte CLI 1.7.1 `#lib` behaviour on one `add` dry run; whether `fileParallelism` / `maxWorkers` is per-project in Vitest 5 (the `groupOrder` single-invocation experiment); WXT 0.21.5 under Vitest 5 (`pnpm vitest run --project extension` first); the `--outputFile.json=` CLI form; `eslint-plugin-svelte` 3.23.1 Kit-3 rule changes.
**UI hint:** no (a full axe and visual pass over the migrated app is part of the gate, not new UI).
**Plans:** TBD

### Phase 17: Extension Release & Edge Add-ons Submission
**Goal:** The Zillow extension is published as a verifiable `ext-v0.1.0` GitHub Release from a hardened release workflow, and the Edge Add-ons listing is complete and submitted; certification and the install-guide link are owner follow-ups that never block another phase.
**Depends on:** Phase 13 only (the remote and the live privacy URL). Runs alongside Phases 14 and 15 as soon as 13 is green; serialized against Phase 16 (never in flight while 16's plans are executing; if the owner's Zillow ToU decision slips, it lands after 16, never during).
**Requirements:** EXT-05, EXT-06, EXT-07, EXT-08, EXT-09
**Success Criteria** (what must be TRUE):
  1. A user can download the zip and `SHA256SUMS.txt` from the published `ext-v0.1.0` GitHub Release, verify them with `sha256sum -c`, and load the zip unpacked once from the downloaded release; the tag equals the extension package and manifest version.
  2. `apps/extension/CHANGELOG.md` (Keep a Changelog) exists with the 0.1.0 entry and the Release notes are drawn from it instead of the install guide.
  3. The Edge Add-ons listing is submitted with two or three screenshots at exactly 1280x800 captured from the synthetic fixture page, website and support contact fields, a "Notes for certification" section telling reviewers only ad-slot list items dim on live Zillow today, and no other browser named anywhere in the listing copy (enforced by a store-copy test); the Zillow Terms of Use go/no-go is recorded before submission and the privacy URL resolves live.
  4. A `workflow_dispatch` dry-run of `extension-release.yml` builds, asserts and checksums without publishing; real releases are created as drafts, fail unless the tag is an ancestor of `main` and the manifest version equals the tag, reject zip entries outside the allowlist (no `.map`, `.ts`, `.env`), and probe the live privacy URL, with `extension-release-gate.test.ts` updated for each step in the same commit.
  5. After certification, `docs/EXTENSION-INSTALL.md` carries the Edge listing URL in place of the placeholder (owner follow-up, non-blocking for phase close; the install-guide test accepts the placeholder sentence or a real listing link, never neither).
**Owner gate:** Zillow ToU read with go/no-go recorded, Showcase badge decision, `EXTENSION_RELEASES_ENABLED=true`, push the tag, confirm the draft loads unpacked, publish, submit the Release zip to Partner Center, record the SHA256 in the consolidated UAT file, edit the install guide after certification (7 business days is a floor).
**Research flag:** light. Re-read the Partner Center form fields and the Edge developer policies on the day of submission (last read on the 2026-09 / 2026-07 revisions; review turnaround is rising per the 2026-09 Edge dev blog).
**UI hint:** no (screenshots are captures of the existing popup and fixture page).
**Plans:** TBD

## Progress

**Execution Order (v1.1):** 12 → 13 → {14, 15, 17} → 16 (17 never overlaps 16)

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
| 13. Live Origin: First CI Run, First Deploy, Post-Deploy Smoke & UAT Burn-down | v1.1 | 9/21 | In Progress|  |
| 14. Carried Debt | v1.1 | 0/TBD | Not started | - |
| 15. Load-Deterministic Test Lanes | v1.1 | 0/TBD | Not started | - |
| 16. Toolchain: pnpm 12 → SvelteKit 3 → Vitest 5 | v1.1 | 0/TBD | Not started | - |
| 17. Extension Release & Edge Add-ons Submission | v1.1 | 0/TBD | Not started | - |
