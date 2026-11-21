# Milestones

## v1.1 Launch & Hardening (Shipped: 2026-11-20)

**Delivered:** The v1.0 build is live at `https://wolfwdavid.github.io/tran_real_estate/`, every deploy is followed by a read-only live smoke, the debt carried out of v1.0 is closed, the test suites are deterministic under load, the toolchain is on pnpm 12, SvelteKit 3 and Vitest 5, and the Zillow extension is published as the `ext-v0.1.0` GitHub Release. No new portal features.

**Phases completed:** 6 phases (12-17), 72 plans, 143 tasks
**Timeline:** 2026-10-29 → 2026-11-20 (22 days), 332 commits, 960 files changed (+55,343 / −5,870)
**Git range:** `a60413c` (docs(v1.0): milestone audit) → `1679237` (docs(17-05): record the green ci and live-smoke runs)
**Audit:** `milestones/v1.1-MILESTONE-AUDIT.md` (status `tech_debt`: 39/41 requirements, 6/6 phases verified, integration 20/24 clean with 0 broken, 3/3 flows)

**Key accomplishments:**

1. **Go-live readiness and a local smoke suite (Phase 12).** History rewritten to carry no assistant attribution, every build stamped with its commit SHA, `PUBLIC_SITE_URL` driving every absolute URL and the extension's origin, and a fail-closed, read-only smoke suite green on three local builds.
2. **Live origin (Phase 13).** First green CI on GitHub, first deploy, `live-smoke.yml` chained behind every deploy, GTM-01..03 proven and GTM-04 cut, one owner HUMAN-UAT ledger in place of twelve files, a launch-proof bundle and `docs/RUNBOOK.md`.
3. **Carried debt closed (Phase 14).** Nine v1.0 follow-ups closed to their sourced definitions of done, including the UI-level backup round-trip, the bounded-wait scheduler lock and the 60 KB JS budget as a hard gate on the marketing pages.
4. **Load-deterministic test lanes (Phase 15).** Timing-budget tests in serial lanes, a mechanical guard against unannotated timeout raises and retries, capped workers, pass-on-retry fails CI, and a dated evidence file.
5. **Toolchain (Phase 16).** pnpm 12, SvelteKit 3.1 with adapter-static 4 and the service worker on `$app/manifest`, Vitest 5; each step gated by `pnpm verify` and the local smoke, closed by a deploy and a green live smoke; audit exceptions down from five to two.
6. **Extension release (Phase 17).** `ext-v0.1.0` published from a hardened release workflow (dispatch dry-run, draft releases, tag-on-main and version checks, zip entry allowlist) with checksums and a changelog; checked on live Zillow (three ad-slot items dimmed, no property card marked).

### Known Gaps

Accepted as tech debt at completion (owner choice 2026-11-20; full list in `milestones/v1.1-MILESTONE-AUDIT.md`):

- **LIVE-05 partial.** The checklist corrections are done; the Search Console sitemap read is still carried (HUMAN-UAT L86, L99).
- **EXT-09 cut.** The owner decided on 2026-11-20 to distribute through the GitHub Release only; nothing was submitted to Edge Add-ons. The listing copy, logo and screenshots are kept unused.
- **W1/W2: JS budget.** The weekly Dependabot minor/patch PR (#18) fails CI on the budget (0.06 KB headroom on `tools/cash-on-cash`), and the budget oracle undercounts under Kit 3 (59.78 KB counted against 62.85 KB measured).
- **W3/W4: workflow order.** CI does not run the smoke suite before deploying; the release workflow does not check that ci was green for the tagged commit.
- **W5: privacy page.** The live page still says contact details will be posted before public launch.
- **Not checked on live Zillow:** the reveal click, the popup count line and Edge. L93 lacks the terms "Updated" date and quoted wording.
- **68 owner HUMAN-UAT rows pending**, 2 carried.

Known deferred items at close: 26 (see STATE.md Deferred Items)

## v1.0 MVP (Shipped: 2026-10-29)

**Delivered:** Tran Real Estate Tools v1: one statically built SvelteKit app with three portals (renters, investors, agents), a $0 browser-only architecture where every user brings their own RentCast and LLM keys, a launch surface with SEO tool pages and a first-party analytics beacon, and a hide-only Zillow sponsored-listing browser extension. Built and verified locally; the live demo waits on the owner creating the `tranrealestate` GitHub org and pushing.

**Phases completed:** 11 phases, 209 plans, 475 tasks
**Timeline:** 2026-09-13 → 2026-10-29 (47 days), 1,206 commits, 1,849 files, ~165k lines of TypeScript, Svelte, CSS and scripts (excluding generated output)
**Git range:** `213f4b6` (chore: workspace root) → `a60413c` (docs(v1.0): milestone audit)
**Audit:** `milestones/v1.0-MILESTONE-AUDIT.md` (status `tech_debt`: 58/58 requirements wired, 0 broken flows, owner-gated debt)

**Key accomplishments:**

1. **Security-first static platform (Phases 1-3).** Hash-mode meta CSP with a seven-host `connect-src`, frame guard, SHA-pinned CI with gitleaks and a real-data guard on every commit, and a local key vault (per-tab session by default, opt-in remember, optional PBKDF2 + AES-GCM passphrase lock) with Dexie storage, JSON backup/restore and persistent-storage handling.
2. **Budget-guarded data and AI layers (Phases 4-5).** A single RentCast gateway with IndexedDB cache, request dedupe, a visible monthly call meter and a hard stop at 40 of 50 free calls; synthetic demo fixtures with onboarding; raw-fetch streaming adapters for Claude, OpenAI, Gemini and OpenRouter behind one `GenerationPanel`; a deterministic Fair Housing checker that gates every AI housing text before it can be copied or sent.
3. **Three demo-credible portals (Phases 6-9).** Renter saved searches with "new since last visit", fair-rent check and outreach drafts; investor deal analyzer (cap rate, NOI, cash flow, cash-on-cash, DSCR), buy-box alerts, market dashboards and an exportable AI memo; agent lead form via Web3Forms with paste-import, local CRM with follow-ups, a content studio (listing, social pack, reel script) and a printable Market Snapshot report with disclosure gates.
4. **Launch hardening and go-to-market (Phase 10).** Portal tour and sample-data onboarding, per-portal waitlist and feedback forms, free SEO calculator pages with sitemap and share cards, a GPC/DNT-honouring first-party Umami beacon switched on by repo variables, 60 KB per-route JS budgets, and a generated launch audit (`docs/LAUNCH-AUDIT.md`) whose every row derives from test evidence.
5. **Zillow sponsored-listing filter extension (Phase 11).** WXT MV3 extension with label-first detection plus ad-slot selectors, dim-with-reveal, a toolbar popup with toggle and count, permissions limited to storage and zillow.com, a mutation-tested zero-network oracle over the production manifest/bundle/zip, a gated GitHub Releases workflow, install guide and Edge Add-ons listing copy.
6. **Verification discipline.** 6,647 unit tests, 2,327 Playwright E2E tests with axe at WCAG 2.2 AA on every route in keyless and keyed states, Nyquist-compliant validation maps for all 11 phases, mutation-tested oracles for CSP, SEO, budget, supply chain and the extension, and a composed `pnpm verify` chain that CI mirrors.

### Known Gaps

Accepted as tech debt at completion (owner-gated; see `milestones/v1.0-MILESTONE-AUDIT.md`):

- **GTM-01..GTM-04 (Phase 10) stay `Pending`.** The code shipped and verified locally; proof (Umami pageviews, Web3Forms delivery, share-card unfurl, Search Console) needs the live origin and the owner's accounts.
- **No live demo yet.** The repository has no git remote; the owner must create the `tranrealestate` org and `tranrealestate.github.io` repo, push `main`, enable Pages and walk `docs/DEPLOY-CHECKLIST.md`.
- **77 owner HUMAN-UAT rows** across the 11 phases (real keys, real devices, live origin, Edge Partner Center, Zillow Terms of Use read, three product decisions).
- Small follow-ups carried forward: origin drift test between the extension and the web app, a UI-level backup round-trip spec across all portal stores, tailwind-merge dropping a font-size token class, ListingCard address-link id, print recheck without notes, save-gate reason text, one load-sensitive saved-search spec, four low audit exceptions to revisit by 2027-01-31 or on the Kit 3 migration.
