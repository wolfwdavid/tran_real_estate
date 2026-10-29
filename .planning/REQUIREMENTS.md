# Requirements: Tran Real Estate Tools — v1.1 Launch & Hardening

**Defined:** 2026-10-29
**Core Value:** A visitor in any of the three portals can go from "what I'm looking for" to an actionable result in minutes instead of hours, using only legitimate data sources.
**Milestone goal:** Take the locally verified v1.0 build live on its own origin, make go-live and every future deploy boring, and clear the debt and toolchain drift carried out of v1.0.

Research: `.planning/research/SUMMARY.md` (2026-10-29). v1.0 requirements (58, archived): `.planning/milestones/v1.0-REQUIREMENTS.md`. New IDs continue existing category numbering (EXT-05+) or open new categories (LIVE, SMOKE, DEBT, TEST, TOOL).

## v1.1 Requirements

### Go-live (LIVE)

- [ ] **LIVE-01**: Before any remote is added, the git history contains no AI co-author trailers or assistant mentions in commit messages (145 trailered commits from 2026-10-13..14 rewritten), the gitleaks SHA allowlist is re-derived for the rewritten commits, and the CI history scan passes on the rewritten history
- [ ] **LIVE-02**: Owner can create the `tranrealestate` org and the empty `tranrealestate.github.io` repo, set the Pages source to GitHub Actions, push `main` with `PAGES_ENABLED` unset, and see the first-ever GitHub run of `ci.yml` green (hygiene, quality, three-leg matrix) with the deploy job skipped
- [ ] **LIVE-03**: After `PAGES_ENABLED=true`, a push deploys to `https://tranrealestate.github.io/` and the live routing contract holds: landing 200, `/renter` redirects to `/renter/`, deep route survives hard refresh, unknown path returns the branded 404 with HTTP 404, HTTPS enforced
- [ ] **LIVE-04**: Every deployed build carries a build stamp (Kit `version.name` = commit SHA, served at `/_app/version.json`) so a deploy can be identified and a post-deploy check can wait for the right build behind the Pages CDN cache
- [ ] **LIVE-05**: `docs/DEPLOY-CHECKLIST.md` is corrected (Pages source before `PAGES_ENABLED`, exact repo name, Umami host `gateway.umami.is`, meta-tag Search Console method placed after `%sveltekit.head%`, fresh-profile rule for live checks) and Search Console is verified with `sitemap.xml` submitted and read
- [ ] **LIVE-06**: GTM-01..GTM-04 are proven on the live origin (Umami pageviews with GPC respected, Web3Forms waitlist + feedback delivery, share cards in the Facebook and LinkedIn debuggers, Search Console) and ticked, or GTM-04 is cut per the documented cut line with the decision recorded
- [ ] **LIVE-07**: The 77 owner HUMAN-UAT rows are reclassified: rows the smoke suite verifies are closed with run links; the truly human rows are consolidated into one file with their results; a launch-proof bundle (dated screenshots and run links) is committed under `docs/launch-proof/<date>/` and `docs/LAUNCH-AUDIT.md` is regenerated at the deployed commit
- [ ] **LIVE-08**: `PUBLIC_SITE_URL` is honoured end to end (canonical URLs, sitemap, OG absolute URLs, extension `TRAN_ORIGIN`/`PRIVACY_URL`) so a future custom domain is a variable change, not a code hunt
- [ ] **LIVE-09**: Owner can follow `docs/RUNBOOK.md` to redeploy, roll back (re-run the deploy on the previous commit or revert and push), read a smoke result, and run the suites at the known-good worker counts for the dev machine and CI

### Live-origin smoke suite (SMOKE)

- [ ] **SMOKE-01**: Operator can run a read-only smoke suite against any origin via `SMOKE_BASE_URL`; it fails closed when the variable is unset or not `https://` (loopback allowed only with `SMOKE_ALLOW_HTTP=1`), runs with zero retries and `--fail-on-flaky-tests`, never submits forms, enters keys, or calls RentCast or an LLM, and finishes in under five minutes
- [ ] **SMOKE-02**: The suite asserts the live contract: landing 200 with brand title, trailing-slash redirect, deep-route refresh, HTTP 404 branded page, CSP meta first in `<head>` with the exact `connect-src` (reusing the `assert-csp` oracle, no third copy), every hashed asset 200, `sitemap.xml` with the expected URL count, `robots.txt` with the `Sitemap:` line, `manifest.webmanifest` 200, OG/Twitter tags with absolute URLs on the audited origin and exactly one `og:image` returning `image/png`, zero third-party requests, service worker registering from the same origin and precaching only same-origin GETs, the `/legal/privacy/#browser-extension` anchor present, and the build stamp equal to `SMOKE_EXPECT_VERSION` after polling up to ten minutes
- [ ] **SMOKE-03**: The suite is green against `scripts/serve-pages.mjs` for all three local builds (root, sub-path, configured) before the origin exists, with the build stamp read from the build directory
- [ ] **SMOKE-04**: After every deploy, a separate `live-smoke.yml` workflow (`workflow_run` after the deploy, plus `workflow_dispatch` with a URL input) runs the suite against the deployed URL and fails the run on any failure, with its own gate test and without changing the pinned action count in `ci.yml`
- [ ] **SMOKE-05**: One analytics spec with GPC off lets exactly one page-view beacon through and asserts the configured analytics host answers with JSON 200 (a 404 means the wrong host); every other spec injects GPC so the smoke never pollutes the dashboard
- [ ] **SMOKE-06**: The suite runs axe on `/`, one portal landing, and `/legal/privacy/` against the deployed bundle with zero violations

### Carried debt (DEBT)

- [ ] **DEBT-01**: `ListingCard` takes an id prefix so the hidden list, split list, and selected-listing preview render distinct ids; at 1280px on the Map tab with a pin selected the document has no duplicate ids, and focus-after-"Show more" and focus-after-pin-select still land on the right link (06 deferred-items)
- [ ] **DEBT-02**: The Market Snapshot save-gate reason distinguishes must-fix items (pluralized), review-only unacknowledged phrases (dedicated string recorded in the UI spec), and clear; unit cases for review-only and singular, and an E2E on a warn-only draft asserts the text and that Save stays refused until acknowledgement (audit tech_debt 09)
- [ ] **DEBT-03**: An investor memo that quotes a number present only in the notes prints: the notes' allowed numerals are persisted in the artifact `meta` at creation and read back at `/print/memo/`; a unit test round-trips `meta`, the print spec gains the notes-only case while the Must-fix block case stays green, a mutation that drops the `meta` write turns the new test red, and backup export/import carries `meta` (07-HUMAN-UAT S2, owner chose fix)
- [ ] **DEBT-04**: A non-vacuous scripts-project test asserts the extension `TRAN_ORIGIN` equals the web app `DEFAULT_SITE_ORIGIN`, `PRIVACY_URL` equals that origin plus `/legal/privacy/#browser-extension`, and the anchor id exists in the privacy page source; literal URLs in the existing extension doc tests import the constant (audit low finding)
- [ ] **DEBT-05**: One Playwright spec seeds at least one row in every registered backup table (renter, investor, agent, studio stores and AI artifacts with `meta`), exports through the Settings UI, wipes the profile, imports with preview, and asserts each portal shows its row at zero RentCast calls (audit low finding, PLAT-04)
- [ ] **DEBT-06**: `cn()` and the `tv()` config use a tailwind-merge extended with the custom font-size class group so `text-label` survives merging; a unit test asserts `cn('text-label text-muted-foreground')` keeps both, a real-Chromium browser test reads the computed font-size on Badge and Button, and axe stays green across the copied-in primitives (04-14 deferred)
- [ ] **DEBT-07**: The saved-search scheduler requests the `tran-alerts` lock with a bounded wait (abort signal, about ten seconds) instead of `ifAvailable`, recomputes due searches inside the lock, updates the two-tab tests, mutation-tests the concurrency guard, and `renter-saved.spec.ts` is green under `--repeat-each 10` with CPU pressure (10-23 open race, owner chose bounded wait)
- [ ] **DEBT-08**: `scripts/serve-pages.mjs` answers 404 for dotfiles like GitHub Pages does, so a service-worker precache that lists `.nojekyll` fails locally instead of only on the live origin
- [ ] **DEBT-09**: `/feedback/` and the three `/for-*/` pages ship under the 60 KB gzipped JS budget (plain form controls, lazy-loaded validation) and the budget becomes a hard gate for them in the launch audit (10-HUMAN-UAT 8, owner chose trim)

### Deterministic tests (TEST)

- [ ] **TEST-01**: Tests that assert wall-clock budgets (ReDoS scans, property-test timing, studio boundaries, precommit hook duration, the load-sensitive ResultsView browser test) live in `*-serial` Vitest projects that run with file parallelism off as a separate stage; the parallel `test:unit` lane contains zero elapsed-time assertions, enforced by a guard test that fails when a timing assertion or raised timeout appears outside the serial lane
- [ ] **TEST-02**: Any raised test or expect timeout above the default carries a measured number and a root cause comment, enforced by the same guard; no blind retries are added anywhere
- [ ] **TEST-03**: Playwright runs in CI with `--fail-on-flaky-tests` so a test that passes only on retry fails the job, and the retry policy is documented in the config
- [ ] **TEST-04**: Worker counts are capped (`maxWorkers` for Vitest, workers for Playwright) with the known-good values recorded, and the Windows PATH/taskkill teardown guard from Phase 1 is covered by a test
- [ ] **TEST-05**: An evidence protocol records three consecutive clean full `pnpm verify` runs, `--repeat-each 3` green on every spec a deferred-items file names as load-sensitive, and one full E2E run under artificial CPU pressure with zero failures, written to a dated `docs/test-evidence/<date>.md`
- [ ] **TEST-06**: One unit run with shuffled file and test order and a recorded seed is green, and the seed is stored in the evidence file

### Toolchain (TOOL)

- [ ] **TOOL-01**: pnpm 12 is the pinned `packageManager`; the lockfile is regenerated once; the supply-chain test, `build-web.mjs`, and the launch-audit test no longer hardcode `11.27.0`; `pnpm install --frozen-lockfile` passes locally and in CI
- [ ] **TOOL-02**: The web app runs on SvelteKit 3.1 with adapter-static 4, migrated with `sv migrate sveltekit-3` one task per commit: Kit options move into `vite.config.ts` with a plugin-free `kit.options.js` that the CSP, models, and service-worker guard tests import; `$lib` becomes `#lib` with explicit extensions across source, ESLint import groups, `components.json`, the Vitest alias, and the boundary tests (which stay non-vacuous); `resolve()` pathnames, `$app/env`, and shallow routing follow the Kit 3 forms
- [ ] **TOOL-03**: The service worker is rewritten on `$app/manifest` with the dotfile filter inside the worker (Kit 3 removes `serviceWorker.files`), and it registers and precaches on the live origin as proven by the live smoke
- [ ] **TOOL-04**: Unit and browser tests run on Vitest 5 with `@vitest/browser-playwright` 5 and `vitest-browser-svelte` 3: every `render` is awaited, exact-text matchers and `clearMocks` defaults are accounted for, the JSON reporter path used by `audit-evidence.mjs` still works, and the full `pnpm verify` is green
- [ ] **TOOL-05**: The recorded audit exceptions shrink from four to one (build-time deepmerge, revisit 2027-01-31) in both `scripts/lib/audit-exceptions.mjs` and `pnpm-workspace.yaml`, and `pnpm audit --audit-level low` is clean apart from it
- [ ] **TOOL-06**: Each toolchain step (pnpm, Kit, Vitest) is landed as its own plan gated by a full `pnpm verify` and a local smoke run, and the phase closes with a deploy and a green live smoke

### Extension release (EXT, continues v1.0 numbering)

- [ ] **EXT-05**: The `ext-v0.1.0` GitHub Release is published with the zip and `SHA256SUMS.txt`, the tag equals the extension package and manifest version, the checksums verify with `sha256sum -c`, and the zip loads unpacked once from the downloaded release
- [ ] **EXT-06**: `apps/extension/CHANGELOG.md` (Keep a Changelog) exists with the 0.1.0 entry and release notes are drawn from it instead of the install guide
- [ ] **EXT-07**: The Edge Add-ons listing gaps are closed: two or three screenshots at exactly 1280x800 captured from the synthetic fixture page, website and support contact fields, a "Notes for certification" section telling reviewers only ad-slot list items dim on live Zillow today, no other browser named in listing copy; the listing is submitted after the Zillow Terms of Use go/no-go is recorded and the privacy URL resolves live
- [ ] **EXT-08**: The release workflow is hardened with a `workflow_dispatch` dry-run (build, assert, checksums, no publish), `--draft` releases, a tag-on-`main` ancestor check, manifest-version-equals-tag check, a zip entry allowlist (no `.map`, `.ts`, `.env`), and a live privacy-URL probe, with the release gate test updated for each
- [ ] **EXT-09**: After certification, the Edge Add-ons placeholder in `docs/EXTENSION-INSTALL.md` is replaced by the listing URL (owner follow-up; non-blocking)

## v1.1.x / Future Requirements

Deferred, tracked, not in this roadmap.

### Smoke
- **SMOKE-F1**: HTTP to HTTPS redirect check (live-only tag)
- **SMOKE-F2**: Oracle cross-check: mirror sitemap URLs to a temp dir and run `assert-csp`/`assert-seo` on fetched HTML
- **SMOKE-F3**: PageSpeed Insights JSON saved as launch proof

### Tests
- **TEST-F1**: Flake ledger `docs/test-evidence/FLAKES.md`
- **TEST-F2**: Quarantine lane with expiry annotations and a guard
- **TEST-F3**: On-demand CPU-pressure CI job (`workflow_dispatch`, stress-ng)

### Extension
- **EXT-F1**: Build provenance attestation on the release zip (needs a new action pin; widen the release gate test first)
- **EXT-F2**: `apps/extension/README.md` and `RELEASING.md`
- **EXT-F3**: Dim "Showcase" placements by default (owner kept them excluded 2026-10-29)

### Owner decisions still open (no code until decided)
- Sample snapshot prints at six Letter pages; Studio license-title scheme (NY-safe vs per-state) (audit tech_debt 09)
- Investor memo lists two block reasons for one advertising phrase (09-HUMAN-UAT UAT-8)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New portal features | v1.1 is an operations milestone; the build has zero production evidence yet |
| Hosted tier, accounts, Stripe billing | Needs a host other than GitHub Pages (commercial-use terms); v2.0-sized |
| Chrome Web Store listing | $5 fee breaks the $0 budget (v1.0 decision stands) |
| Firefox Add-ons submission | Not required for EXT-04 proof; revisit after Edge certification |
| Custom domain | Costs money and needs a second Search Console property |
| TypeScript 7, `@next` tags, Node 26 | Kit 3 requires TS ^6; keep Node 24 LTS this milestone |
| Third-party scripts on the origin (hosted analytics script, GA/GTM verification) | Any script on the origin can read stored keys |
| Umami API client or scheduled Web3Forms submissions in CI | Hobby plan has no API; submissions cost quota and send email |
| Lighthouse CI as a gate | Informational only; budgets are already enforced by the launch audit |
| Blind retries, timeout raises, or serial-everything as a flake fix | PROJECT.md target: root causes only |

## Traceability

Which phases cover which requirements. Filled during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LIVE-01 | — | Pending |
| LIVE-02 | — | Pending |
| LIVE-03 | — | Pending |
| LIVE-04 | — | Pending |
| LIVE-05 | — | Pending |
| LIVE-06 | — | Pending |
| LIVE-07 | — | Pending |
| LIVE-08 | — | Pending |
| LIVE-09 | — | Pending |
| SMOKE-01 | — | Pending |
| SMOKE-02 | — | Pending |
| SMOKE-03 | — | Pending |
| SMOKE-04 | — | Pending |
| SMOKE-05 | — | Pending |
| SMOKE-06 | — | Pending |
| DEBT-01 | — | Pending |
| DEBT-02 | — | Pending |
| DEBT-03 | — | Pending |
| DEBT-04 | — | Pending |
| DEBT-05 | — | Pending |
| DEBT-06 | — | Pending |
| DEBT-07 | — | Pending |
| DEBT-08 | — | Pending |
| DEBT-09 | — | Pending |
| TEST-01 | — | Pending |
| TEST-02 | — | Pending |
| TEST-03 | — | Pending |
| TEST-04 | — | Pending |
| TEST-05 | — | Pending |
| TEST-06 | — | Pending |
| TOOL-01 | — | Pending |
| TOOL-02 | — | Pending |
| TOOL-03 | — | Pending |
| TOOL-04 | — | Pending |
| TOOL-05 | — | Pending |
| TOOL-06 | — | Pending |
| EXT-05 | — | Pending |
| EXT-06 | — | Pending |
| EXT-07 | — | Pending |
| EXT-08 | — | Pending |
| EXT-09 | — | Pending |

**Coverage:**
- v1.1 requirements: 41 total
- Mapped to phases: 0
- Unmapped: 41 ⚠️ (roadmap pending)

---
*Requirements defined: 2026-10-29*
*Last updated: 2026-10-29 after initial definition*
