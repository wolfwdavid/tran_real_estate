# Feature Research

**Domain:** Launch-and-operations capabilities for an already-complete static SvelteKit site on a GitHub Pages organization root origin, plus a hide-only MV3 browser extension distributed for $0 (GitHub Releases + Microsoft Edge Add-ons). Milestone v1.1 "Launch & Hardening" of Tran Real Estate Tools.
**Researched:** 2026-10-29
**Confidence:** HIGH overall for go-live mechanics, Edge Add-ons requirements, release tooling and test-runner semantics (official docs). MEDIUM for post-deploy smoke structure (consistent practitioner pattern, no standard). LOW for numeric flake budgets and for share-card validator behaviour on X and iMessage (vendor or anecdotal sources that disagree).

This file does not repeat the v1.0 product research (`.planning/milestones/v1.0-research/FEATURES.md`). Nothing here is an end-user feature. The "features" are capabilities the owner and the repository gain, and "users" are the owner (as operator) and the next person who has to redeploy.

---

## 0. Constraint findings that shape this milestone (read first)

| # | Finding | Evidence / confidence | Consequence |
|---|---------|----------------------|-------------|
| L1 | An organization root site is served **only** from a repository named exactly `<org>.github.io`, one Pages site per account. | GitHub Docs "About GitHub Pages" (HIGH) | The repo name `tranrealestate.github.io` is load-bearing; any other name moves the site under `/<repo>/` and the deploy must use the `sub` base path (DEPLOY-CHECKLIST Step 2 already covers this). |
| L2 | Pages limits: 1 GB site, 100 GB/month soft bandwidth, 10-minute deployment timeout. The 10-builds/hour soft limit **does not apply** to custom GitHub Actions workflows. | GitHub Docs "GitHub Pages limits" (HIGH) | `ci.yml` deploys through Actions, so CI pushes are not build-rate-limited. Nothing in this project approaches the size/bandwidth limits. |
| L3 | Changes can take **up to 10 minutes** to publish after a push. `github.io` sites are HTTPS automatically; "Enforce HTTPS" redirects HTTP to HTTPS and is admin-only. | GitHub Docs "Creating a GitHub Pages site", "Securing your site with HTTPS" (HIGH) | A post-deploy smoke must poll/wait (10-minute ceiling), not fire the instant the deploy job ends. The HTTP-to-HTTPS redirect is a live-only check; the local emulator cannot reproduce it. |
| L4 | Pages' terms bar sites "primarily directed at facilitating commercial transactions or providing commercial SaaS." | GitHub Docs "GitHub Pages limits" (HIGH) | Already in PROJECT.md Out of Scope; v1.1 adds no monetization. Record it in launch proof so a future hosted tier knows it must move. |
| L5 | Edge Add-ons: **no registration fee**; sign in with a Microsoft account or a GitHub account; individual-account verification is the short path. Certification "can take up to seven business days". | Microsoft Learn "Register as a Microsoft Edge extension developer", "Publish a Microsoft Edge extension" (HIGH) | The $0 constraint holds. Plan a 7-business-day wait between submission and the listing-link edit in `docs/EXTENSION-INSTALL.md`. |
| L6 | Sept 2026 Edge blog: review turnaround has **increased** under submission volume; many repeatable checks are now automated; standards unchanged. | Microsoft Edge Dev blog 2026-09-08 (HIGH for the statement, no numbers given) | Treat "7 business days" as a ceiling that may be exceeded. Do not block any other v1.1 work on the listing going live. |
| L7 | Umami Cloud Hobby: 100K events/month, **1 website**, 6-month retention, **no API access**. IP is used in the session hash and for geolocation but "is not stored as a field in the analytics session record"; the salt rotates monthly by default; the tracker sets no cookies. | umami.is/pricing, docs.umami.is "Metric definitions" and FAQ (HIGH) | The "pageviews arrived" proof cannot be automated from the smoke suite (no API on Hobby); it stays a human dashboard check. The DEPLOY-CHECKLIST Step 8.1.3 wording ("IP addresses are not stored") should be recorded precisely: not stored as a session field, may exist transiently in operational logs. |
| L8 | Search Console URL-prefix property for `https://tranrealestate.github.io/` can be verified by **HTML meta tag in `<head>`** or **HTML file at the root**; the DNS method is impossible (no DNS control over `github.io`). Google ignores `<priority>`/`<changefreq>`, uses `<lastmod>` only when it is consistently accurate. | Google Search Central "Verify site ownership", "Build and submit a sitemap" (HIGH) | The verification token must live in the build (static file or `SeoHead`) and never be removed, or verification lapses after a grace period. |
| L9 | Playwright classifies results as passed / **flaky** (failed first, passed on retry) / failed, and offers `--fail-on-flaky-tests`, `--repeat-each N`, `--grep @tag`, tags via `{ tag: '@smoke' }`. Vitest `retry` defaults to 0; `fileParallelism: false` forces `maxWorkers` to 1; `sequence.shuffle` with a reproducible `seed` reveals order dependence. | playwright.dev test-retries, test-cli, test-annotations; vitest.dev config pages (v5.0.5) (HIGH) | "Deterministic under load" is measurable with built-in flags; no new tooling is needed. Current `apps/web/playwright.config.ts` sets `retries: CI ? 1 : 0`, which can hide a flaky-but-passing run in CI unless `--fail-on-flaky-tests` is also set. |
| L10 | GitHub artifact attestations (`actions/attest@v4`, permissions `id-token: write`, `contents: read`, `attestations: write`) give SLSA v1.0 Build Level 2 and are verified with `gh attestation verify <file> -R org/repo`; public repos use the Sigstore Public Good transparency log. | GitHub Docs "Artifact attestations", "Use artifact attestations" (HIGH; "free for public repos" is implied by Sigstore public instance, MEDIUM) | A cheap, real supply-chain upgrade over `SHA256SUMS.txt` alone for the extension zip. |
| L11 | Chrome manifest `version`: 1-4 dot-separated integers, each 0-65535, no leading zeros, not all zeros; compared left to right; `version_name` is display-only. | developer.chrome.com manifest/version (HIGH for Chrome; Edge follows the Chromium manifest, MEDIUM) | `0.1.0` is valid and semver-shaped. Keep the `ext-v` tag prefix separate from the web app's `v1.0` tags (already the case). |
| L12 | Share-card debuggers: Facebook Sharing Debugger ("Scrape Again") and LinkedIn Post Inspector exist and clear caches (LinkedIn cache can be sticky, reportedly up to 7 days). **X's Card Validator preview is effectively retired**; sources disagree whether any official tool remains. Slack reads Open Graph and X Card metadata; no public debugger. iMessage has **no validator**, reads `og:title`/`og:image`, and anecdotally mis-renders multiple `og:image` tags and expiring image URLs. | Nuxt SEO debugger page, swimburger.net guide, docs.slack.dev unfurling, Apple TN2444 (archived), community threads (MEDIUM for FB/LinkedIn, LOW for X/iMessage) | The share-card proof is: two validator screenshots (Facebook, LinkedIn) plus one real send each to Slack and iMessage. Do not plan an X validator step. Keep exactly one `og:image` per page with a stable absolute URL (already true per `assert-seo`). |

---

## 1. Go-live on the GitHub Pages organization root

The owner performs Steps 1-6 of `docs/DEPLOY-CHECKLIST.md` in a browser. Everything below is what the repository should make boring around those clicks.

### Table stakes

| Capability | Why expected | Complexity | Depends on (v1.0) | Notes |
|------------|--------------|------------|-------------------|-------|
| Deploy from `main` through the existing gated `deploy` job, first run observed end to end | The only unproven half of the v1.0 definition of done ("live demo") | LOW | `ci.yml` (`PAGES_ENABLED`, `needs: [hygiene, quality]`, `include-hidden-files: true`), `apps/web/build` | The first run is the proof that the dormant job is correct. Record the run URL. Confirm the `github-pages` artifact root contains `.nojekyll` (01-HUMAN-UAT 2). |
| Live routing contract: landing 200, `/renter` 301 to `/renter/`, deep route survives hard refresh, bogus path returns the **branded 404 with HTTP 404** | Phase 1 proved it on the emulator; Pages is the real host | LOW | `scripts/serve-pages.mjs` (emulator), `static/404.html` via adapter-static fallback | Official docs say `404.html` at the publishing-source root is the custom page but do not state the status code; the emulator asserts 404. Keep the live check as the first smoke assertion (01-HUMAN-UAT 1, 10-HUMAN-UAT 6, LAUNCH-AUDIT row 6). |
| CSP meta present on the real origin, exact `connect-src`, no `unsafe-inline`/`unsafe-eval` in `script-src` | Keys live in the browser; this is the main defense | LOW | `scripts/assert-csp.mjs`, `svelte.config.js` `buildCsp` | `assert-csp` runs on the build directory; the live check is a fetch of the served HTML and the same oracle logic against it (or a tiny subset of it). |
| HTTPS by default and "Enforce HTTPS" on | Mixed content or plain HTTP would leak nothing secret but breaks the "keys stay in your browser" story | LOW | none | Live-only check; the emulator is plain HTTP. |
| Repository security switches: secret scanning + push protection on, Dependabot alerts + security updates on, push-protection probe rejected | DEPLOY-CHECKLIST Step 5 and 7.7; 10-HUMAN-UAT 7; 01-HUMAN-UAT 3 | LOW | gitleaks hook + CI history scan (complementary, not replaced) | Owner clicks plus one throwaway-branch probe with a real GitHub-format token generated with no permissions and revoked after. Never the `TRANCANARY_` pattern (push protection ignores it). |
| Launch services switched on by repo **Variables** (not Secrets): `PUBLIC_WEB3FORMS_KEY`, optional `PUBLIC_ANALYTICS_HOST` + `PUBLIC_ANALYTICS_WEBSITE_ID` (set both or neither), optional `PUBLIC_CONTACT_EMAIL`, optional `PUBLIC_SITE_URL` | GTM-02/04 proof; the build fails on a half pair | LOW | `scripts/lib/build-targets.mjs`, `site-config.ts`, `ci.yml` root-leg env wiring | Only the `root` matrix leg reads them; `sub` and `configured` ignore them by design. |
| Search Console property verified, `sitemap.xml` submitted and read (14 URLs), `robots.txt` served with the `Sitemap:` line | GTM-03 proof; 10-HUMAN-UAT 5 | LOW-MEDIUM | `scripts/assert-seo.mjs`, `SeoHead.svelte`, static `robots.txt` | Verification token must be committed (meta tag or root HTML file) and stay forever (L8). Add the token to `assert-seo` so a refactor cannot drop it silently. |
| Share cards render in Facebook Sharing Debugger and LinkedIn Post Inspector for `/` and `/tools/cap-rate/` | GTM-03 proof; 10-HUMAN-UAT 4 | LOW | `build/og/*.png` (6 cards, 1200x630), `assert-seo` | Plus one real Slack message and one real iMessage send as "unfurl in the wild" evidence (L12). No X step. |
| Web3Forms delivery: one waitlist entry, one feedback message arrive with the documented subjects; captcha OFF in the dashboard | GTM-02 proof; 10-HUMAN-UAT 2 | LOW | Phase 10 `owner-forms`, hidden trap field + 3-second gate | Human-only (needs the inbox). Spends 2 of 250 monthly submissions. |
| Umami pageviews arrive from the live origin; none with GPC on; IP-handling answer recorded | GTM-04 proof; 10-HUMAN-UAT 1; cut line if nothing arrives | LOW | `lib/analytics/boot.ts`, `consent.ts`, CSP `connect-src` from the analytics host | Human-only (Hobby plan has no API, L7). Record the precise answer: IP hashed with a monthly salt and not stored as a session field. |
| Live provider "Test connection" for Anthropic, OpenAI, Gemini from the deployed URL; "Forget all keys" clears | 05-HUMAN-UAT H-rows; 10-HUMAN-UAT 6 | LOW | Phase 5 adapters, Phase 3 vault | Human-only (real spend-limited keys). CORS can only be proven from the real origin. |
| **Launch proof bundle**: every HUMAN-UAT row that went live is recorded with date, URL, and a screenshot or run link; `docs/LAUNCH-AUDIT.md` regenerated at the deployed commit | A solo founder's "we launched" evidence is otherwise a memory | LOW | `scripts/launch-audit.mjs` (`DEFERRED (human)` rows 1-10), the 11 `*-HUMAN-UAT.md` files | Keep screenshots under `docs/launch-proof/<date>/` (or `.planning/launch-proof/`), never in `docs/LAUNCH-AUDIT.md` (generated). |

### Differentiators

| Capability | Value | Complexity | Depends on | Notes |
|------------|-------|------------|------------|-------|
| **Post-deploy smoke job in `ci.yml`**: `smoke` job `needs: deploy`, runs the live smoke against `${{ needs.deploy.outputs.page_url }}`, gated by the same `PAGES_ENABLED` | Every future deploy proves itself; no human has to remember Step 7 again | MEDIUM | `deploy-pages` already exposes `page_url` (used for the environment URL); Section 2 suite | Must poll until the new build is actually served (L3: up to 10 minutes); compare a build stamp (e.g. commit SHA in a `<meta>` or `/__build.json`) to avoid asserting against the previous deploy. |
| Build stamp in the page (`<meta name="build" content="<sha>">` or `/__build.json`) | Lets the smoke prove "this deploy", not "some deploy"; lets a bug report name a build | LOW | `SeoHead` or `app.html`, `assert-seo` to pin it | Static JSON is simplest and cacheable; a meta tag is already in the oracle's reach. |
| `PUBLIC_SITE_URL` honoured end to end (canonical, sitemap, OG absolute URLs, extension `TRAN_ORIGIN`) with the drift test | Makes a future custom domain a variable change, not a code hunt | LOW | `site-config.ts` `DEFAULT_SITE_ORIGIN`, `apps/extension/src/lib/config.ts` `TRAN_ORIGIN` (audit low finding) | Carried debt item; see Section 5. |
| Single `docs/RUNBOOK.md` ("how to redeploy, how to roll back, how to read the smoke") | Future-you at 2 a.m. | LOW | DEPLOY-CHECKLIST (one-time) vs runbook (repeatable) | Rollback on Pages = re-run the deploy job on the previous commit or `git revert` and push; document the exact commands. |

### Anti-features

| Anti-feature | Why requested | Why problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Custom domain in this milestone | "Looks more real" | Costs money (domain), adds DNS/cert provisioning and a second origin for stored keys to drift across; GTM-03 share cards and Search Console would need redoing | Launch on `tranrealestate.github.io`; keep `PUBLIC_SITE_URL` single-sourced so a later domain is one variable (and one Search Console property). |
| Deploy-from-branch (`gh-pages`) as a fallback | Familiar | Loses `needs: [hygiene, quality]` gating; Jekyll runs by default and drops `_app/`; subject to the 10 builds/hour limit | Keep the Actions publishing source; it is already written and gated. |
| Putting owner keys/addresses in Secrets | Habit | Every one of these values ends up in public page source by design; Secrets would mask that and confuse the "nothing secret is committed" story | Repository **Variables**, as DEPLOY-CHECKLIST Step 8 says. |
| Adding a third-party uptime/analytics `<script>` for "launch monitoring" | Convenient dashboards | Any script on the origin can read stored keys (PROJECT.md decision) | First-party beacon only; uptime via an external HTTP poller that never runs on the page. |
| Treating "pageviews did not arrive" as a bug to fix in code | Natural reaction | Ad blockers and GPC make counts a lower bound; chasing it costs time with no product value | Apply the documented cut line (10-HUMAN-UAT 1): remove the two variables, move GTM-04 to v2, record the decision. |

---

## 2. Live-origin smoke suite (configurable base URL)

How mature teams split it: the **pre-deploy** suite is the full, mocked, exhaustive run against a local build (this project already has it: 2,327 Playwright tests plus axe on both base paths and the configured build). The **post-deploy** suite is small, read-only, un-mocked, tagged, runs against a real URL from an environment variable, finishes in minutes, has zero retries, and fails the pipeline. Practitioner sources agree on these properties; none is a formal standard (MEDIUM).

### Table stakes

| Check | Why expected | Complexity | Depends on | Local stand-in behaviour |
|-------|--------------|------------|------------|--------------------------|
| Base URL from `SMOKE_BASE_URL` (or `--base-url`); **fail closed** when unset or not `https://` for a live run; never default to production | Prevents accidental runs against the wrong origin | LOW | `apps/web/playwright.config.ts` (add a `live` project with `testMatch: /\.smoke\.spec\.ts$/` and **no** `webServer`) | Allow `http://127.0.0.1:<port>/` only when an explicit `SMOKE_ALLOW_HTTP=1` is set; the emulator `scripts/serve-pages.mjs` is the stand-in. |
| Landing `GET /` is 200 and contains the brand title | The one check that catches "deploy published nothing" | LOW | none | Same on the emulator. |
| Trailing-slash redirect: `/renter` 301/302 to `/renter/` | FND-01 | LOW | emulator already answers 301 | Same. |
| Deep-route hard refresh: `GET /investor/deals/` 200 serving the app shell | FND-01; LAUNCH-AUDIT row 6 | LOW | prerendered routes | Same. |
| Unknown path: `GET /does-not-exist/` returns **HTTP 404** and the branded not-found page | FND-01 | LOW | `404.html` | Same. |
| CSP meta immediately after `<meta charset>`, exact `connect-src` host set, no `unsafe-inline`/`unsafe-eval` in `script-src` | FND-02 | LOW-MEDIUM | `scripts/assert-csp.mjs` (reuse its parsing by exporting the checker or running it on fetched HTML) | Same. The `connect-src` must include the analytics host only when the live build is configured; read the expectation from the same variables. |
| Hashed asset reachability: every `<script src>`/`<link href>` in the landing HTML returns 200 (proves `.nojekyll` took effect for `_app/`) | The classic Pages failure mode | LOW | none | Same. |
| `sitemap.xml` 200 with the expected URL count; `robots.txt` 200 with `Sitemap: https://<origin>/sitemap.xml`; `manifest.webmanifest` 200 | GTM-03 | LOW | `assert-seo` expectations (14 URLs) | Same. |
| OG/Twitter tags on `/` and one tool page: absolute URLs pointing at **the audited origin**, exactly one `og:image`, and the image URL returns 200 with `image/png` | GTM-03; L12 (iMessage multiple-image quirk) | LOW | `assert-seo` | Same. |
| Zero third-party requests on marketing pages (collect requests during load; allow only same-origin plus the configured analytics host) | BRND-01, security story | LOW | existing `third-party.spec.ts` logic | Same. |
| Service worker registers from the same origin and precaches only same-origin GETs | PLAT-06 | MEDIUM | Phase 3 SW | Same, but note Playwright SW support needs `serviceWorkers: 'allow'` and Chromium. |
| `/legal/privacy/#browser-extension` anchor exists in the served HTML | The Edge listing's privacy URL (11-HUMAN-UAT 5) | LOW | privacy page anchor pinned by test | Same. Cross-dependency: Section 3 cannot submit until this passes live. |
| Build stamp equals the commit the pipeline just deployed (poll up to 10 minutes) | Otherwise the smoke can pass against the previous deploy | LOW | Section 1 differentiator (stamp) | On the emulator the stamp is read from the build directory. |
| Read-only, no form posts, no key entry, no RentCast or LLM calls | A smoke that spends quota or sends emails is a cost, not a check | n/a (rule) | none | Assert the forms are in the "open" state when `PUBLIC_WEB3FORMS_KEY` is set (key is public by design), never submit. |
| `retries: 0`, `--fail-on-flaky-tests`, under 5 minutes, runs in CI after deploy and on demand (`workflow_dispatch` with a URL input) | Smoke flakiness is a defect, not a nuisance | LOW | `ci.yml` | Same. |

### Nice-to-have

| Check | Value | Complexity | Notes |
|-------|-------|------------|-------|
| HTTP to HTTPS redirect (`http://tranrealestate.github.io/` 301 to https) | Confirms "Enforce HTTPS" | LOW | **Live-only** (tag `@live-only`; skip on loopback). |
| axe on `/`, one portal landing, `/legal/privacy/` on the live origin | Proves the deployed bundle, not just the build directory | LOW | Already exhaustive pre-deploy; a 3-route live sample is enough. |
| PageSpeed Insights / Lighthouse run on `/` and `/tools/cap-rate/` with the JSON saved as launch proof | Core Web Vitals evidence on the real CDN | LOW | Manual or `npx lighthouse`; no key needed for the web UI (MEDIUM). Not a gate. |
| Response header sanity: `content-type` for `.webmanifest`, `.xml`, `.woff2` | Pages sets these; the emulator has its own table | LOW | Live-only informational. |
| Cross-check `assert-csp`/`assert-seo` **oracle versions**: run the same scripts against HTML fetched from the live origin written to a temp directory | Reuses mutation-tested oracles instead of re-implementing | MEDIUM | A `fetch-site.mjs` that mirrors the sitemap URLs into a directory the existing oracles accept. |

### Anti-features

| Anti-feature | Why requested | Why problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Running the full 2,327-test E2E against the live origin | "More coverage" | Needs mocks that cannot exist on a real origin, spends RentCast/LLM budgets, takes an hour, and flakes on network | Full suite stays pre-deploy against the emulator; smoke stays small. |
| Submitting real Web3Forms entries or Umami beacons from the smoke | Automates two human rows | Burns 250/month submissions, pollutes analytics, and Hobby Umami has no API to assert against anyway (L7) | Keep those two as human rows with screenshots; assert only the pre-conditions (form open state, beacon code present). |
| Default `SMOKE_BASE_URL` to production | Convenience | A local run that accidentally targets production reads as "live is green" when it tested the wrong thing | Fail closed; require the variable. |
| Retries on the smoke | Network blips | Hides the exact class of problem a smoke exists to catch | `retries: 0`, `--fail-on-flaky-tests`, and a wait-for-stamp poll instead. |

---

## 3. Extension release engineering on $0

### Table stakes

| Capability | Why expected | Complexity | Depends on | Notes |
|------------|--------------|------------|------------|-------|
| `ext-v0.1.0` GitHub Release with `sponsored-listing-filter-0.1.0-chrome.zip` + `SHA256SUMS.txt`, tag must equal `apps/extension/package.json` `version` | EXT-04; 11-HUMAN-UAT 7 | LOW | `.github/workflows/extension-release.yml` (gated on `EXTENSION_RELEASES_ENABLED`, `--verify-tag`), `scripts/assert-extension.mjs` | First real run is the proof. `sha256sum -c SHA256SUMS.txt` on the downloaded files, then load unpacked once. |
| **CHANGELOG** per release (Keep-a-Changelog style `apps/extension/CHANGELOG.md`) and release notes drawn from it | Users of a load-unpacked zip get no auto-update (install guide says so); the changelog is how they decide to upgrade | LOW | release workflow currently passes `--notes-file docs/EXTENSION-INSTALL.md` | Switch to `--notes-file` pointing at the version's changelog section (or `--generate-notes` plus the install link). Keep the install guide linked, not pasted. |
| Zillow Terms of Use read and go/no-go recorded **before** any public artifact | 11-HUMAN-UAT 4 gates the Release and the listing | n/a (owner) | none | Blocks publishing, not building. Recovery if Zillow objects: delist and rename (already documented). |
| Privacy URL live: `https://tranrealestate.github.io/legal/privacy/#browser-extension` | Edge Partner Center privacy field; popup `PRIVACY_URL` | LOW | Section 1 go-live; Section 2 smoke check | Hard dependency: go-live precedes the store submission. |
| Edge Add-ons listing content that meets Partner Center's rules | Reviewer rejects incomplete forms | LOW | `apps/extension/store/edge-listing.md`, `edge-logo-300.png` | See the field audit below; two gaps (screenshots, support contact). |
| Screenshots: up to 6, **640x480 or 1280x800**, of the popup and a dimmed card | Partner Center size rule (optional field, but a listing without screenshots reads as abandoned) | LOW | a live or fixture Zillow page; `apps/extension/e2e` fixture pages can produce a deterministic dimmed-card screenshot | Capture at exactly 1280x800 with Playwright on the synthetic fixture to avoid shipping real listing data in a screenshot; the live Brooklyn page only if no addresses/prices are legible. |
| Permission justifications (`storage`, host access to `zillow.com`), single-purpose statement, remote code "No", data collection "None", privacy URL | Partner Center Privacy page; "incomplete, misleading, or inaccurate disclosures" delay or reject | LOW | listing copy already has all five | Already written. |
| Notes for certification | Reviewers must see a dimmed card; today only ad-slot `li`s dim on live Zillow (no visible Sponsored label) | LOW | 11-HUMAN-UAT 1 findings | State: "Open a Brooklyn, NY rentals search; the interleaved advertising list items dim; organic cards do not; some paid placements carry no visible label and are intentionally left alone." Without this note a reviewer may file "does nothing". |
| Versioning scheme: `MAJOR.MINOR.PATCH` with 0-65535 integers, no leading zeros; `ext-v<version>` tags; bump `package.json` first, tag second | L11; workflow asserts tag = version | LOW | WXT `{{packageVersion}}` zip template | Document in the changelog header. Optional `version_name` for display is unnecessary. |
| Replace the placeholder under "Install from Microsoft Edge Add-ons" in `docs/EXTENSION-INSTALL.md` with the listing URL once "In the Store" | 11-HUMAN-UAT 6 | LOW | banned-terms gate (`pnpm banned`) still applies | One-line follow-up after certification. |

**Edge listing field audit against the official Partner Center requirements** (publish-extension doc, 2026-05-05 revision):

| Partner Center field | Rule | `edge-listing.md` today | Status |
|---|---|---|---|
| Extension name / short description | Read-only from the manifest `name`/`description` | Manifest `name` "Sponsored Listing Filter — for Zillow", `description` 132-char max enforced by `assert-extension.mjs` | OK |
| Description | 250-10,000 chars, full functionality, nothing misleading | ~900 chars, states what it does, what it doesn't, "Not affiliated" | OK |
| Extension logo | 1:1, recommended 300x300, min 128x128 | `edge-logo-300.png` | OK |
| Screenshots | Optional, max 6, 640x480 or 1280x800 | Listed as owner item, none captured | **Gap** (produce 2-3) |
| Small / large promo tiles | Optional, 440x280 / 1400x560 PNG | none | Skip (anti-feature for v1) |
| Search terms | Max 7 terms, 21 words total, 30 chars each | 7 terms, 11 words | OK |
| Category | Required | "Shopping" | OK (consider "Search tools" if available; owner call) |
| Website | Optional, must be your own site | not in file | Add `https://tranrealestate.github.io/` |
| Support contact | Optional URL or email | not in file | **Gap**: add the GitHub Issues URL once the remote exists (or `PUBLIC_CONTACT_EMAIL`) |
| Single purpose, permission justifications, remote code, data usage, privacy URL | Required, must match behaviour | all present | OK (privacy URL must resolve live first) |
| Notes for certification | Optional, strongly advised here | not in file | **Gap**: add a "Notes for certification" section |

### Differentiators

| Capability | Value | Complexity | Depends on | Notes |
|------------|-------|------------|------------|-------|
| **Build provenance attestation** on the release zip (`actions/attest@v4`, `subject-path: apps/extension/.output/*.zip`) and a verify line in the install guide: `gh attestation verify <zip> -R tranrealestate/tranrealestate.github.io` | Proves the zip came from this repo's workflow at this commit (SLSA Build L2); costs nothing on a public repo | LOW | release workflow permissions (`id-token: write`, `attestations: write`, `contents: write` already for the release) | Keep `SHA256SUMS.txt` for people without `gh`. |
| Release workflow dry-run on a `workflow_dispatch` input (build + oracle + checksums, **no** publish) | Lets the pipeline be exercised before the first real tag | LOW | `extension-release.yml` | Avoids a broken first public release. |
| `apps/extension/README.md` (does not exist today) linking install guide, changelog, store copy, privacy section, and the oracle | Reviewers and contributors land there | LOW | none | Small docs item. |
| Release checklist file `apps/extension/RELEASING.md` (bump version, update changelog, `pnpm ext:build && pnpm ext:assert`, tag, push, verify assets, submit to Partner Center, update install guide) | Makes the second release boring | LOW | none | Mirrors DEPLOY-CHECKLIST Step 9 in repo-local form. |

### Anti-features

| Anti-feature | Why requested | Why problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Chrome Web Store listing | Largest audience | $5 fee breaks the $0 rule (PROJECT.md Out of Scope) | Load-unpacked zip + Edge Add-ons (Edge installs run on Chromium; the same zip works in Chrome/Brave unpacked). |
| Firefox Add-ons | "Free too" | Cut by the v1 roadmap (needs `browser_specific_settings.gecko.id`, `data_collection_permissions`, a sources zip); another review queue to babysit | Revisit after the Edge listing is live and stable. |
| Self-hosted `update_url` auto-updates for the zip | Users of the zip never update | Chromium blocks externally hosted extensions on Windows/macOS outside the store; adds a network surface the zero-network oracle would have to carve out | Say plainly in the install guide that zip installs do not auto-update (already there); Edge Add-ons provides auto-update. |
| Promotional tiles, YouTube video | Listing polish | Time with no install impact for a utility extension | Screenshots only. |
| Reading Zillow page JSON to detect unlabeled paid placements "so the demo looks better for reviewers" | Live Zillow shows few visible labels | Crosses into data extraction (ToU, EXT-03 oracle, PROJECT.md) | Certification notes that explain the limitation (above); Showcase badge decision stays an owner call (11-HUMAN-UAT 3). |

---

## 4. Test-suite hardening as a deliverable

### What "deterministic under load" means in mature projects

- **Classification is explicit.** Playwright reports `passed` / `flaky` / `failed`; a run with any `flaky` result is a failure when `--fail-on-flaky-tests` is set. Vitest does not retry unless `retry` is set (default 0), so a Vitest flake is simply a red run. (HIGH)
- **Flake budgets** are quality SLOs. Vendor guidance lands around under 0.5% for pre-merge smoke and under 2% for post-merge comprehensive suites, with quarantine counted against the budget so it cannot be gamed. These are opinions, not a standard. (LOW)
- **Quarantine is time-boxed and owned**: an entry has an owner, an expiry date and an exit plan; CI fails when the expiry lapses; readmission after about 10 consecutive green runs. (LOW-MEDIUM, consistent across sources)
- **Retries are a measurement tool, not a fix.** Zero retries locally; at most one in CI and only when `flaky` results are tracked separately. (MEDIUM)
- **This project's own rule** (tasks/lessons.md 2026-10-13): "a test that passes in isolation is not proven to be a flake"; reproduce under an artificial delay or throttled CPU and look for a write that can land after a newer user action; `expect.poll` for anything set by an intercepted request (2026-10-25). Three of Phase 10's "load flakes" were real races (renter-journey announcer, guide.spec tour panel, autofill route-handler flag). (HIGH, internal evidence)

### Table stakes

| Capability | Why expected | Complexity | Depends on | Definition of done |
|------------|--------------|------------|------------|--------------------|
| **Timing lane**: tests that assert wall-clock budgets (ReDoS scan budgets, debounce/announcer timing, lock waits, `precommit.test.ts` hook duration) move to a Vitest project (`*.timing.test.ts`) that runs with `fileParallelism: false` (forces `maxWorkers` 1), `sequence.concurrent: false`, and is executed as its own `pnpm test:timing` stage, never inside the parallel `test:unit` | PROJECT.md: "timing-budget tests separated from the parallel run; no blind timeout raises" | MEDIUM | `vitest.config.ts` `projects` list; 10-23 fixes (fastest-of-5 ReDoS; `studio/boundaries.test.ts` 30 s limit) | `pnpm test:unit` contains zero assertions on elapsed milliseconds (grep-enforced by a small script test, as `agent-boundary` does for imports); the timing lane passes 10/10 alone and 3/3 beside `test:unit` running concurrently. |
| **No blind timeout raises**: any raised `timeout`/`expect` timeout must cite a measured number and a root cause in a comment | PROJECT.md target | LOW | lessons 2026-10-13 | A repo script fails when a `test.setTimeout`/`timeout:` literal above the default appears without an adjacent `// measured:` comment (optional but cheap), or at minimum a review rule in `RUNBOOK.md`. |
| **Evidence protocol**: N consecutive green **full** runs recorded as shard files via `scripts/audit-evidence.mjs` (already keeps shards and refuses unreadable ones), with `--fail-on-flaky-tests` on Playwright so retried passes count as failures | "Deterministic" needs proof, not a feeling | LOW | `.tools/audit-evidence/`, `evidence:*` scripts | Recommended bar: **3 consecutive full `pnpm verify`-equivalent runs** at the default worker count with zero `flaky`/failed, **plus** `--repeat-each 3` on every spec named in a deferred-items file as load-sensitive (`renter-saved`, `guide`, `agent-contact:351`, `agent-followup:169`, `autofill:195`, `csp:46`, `buybox:217`, `ResultsView.browser`, `precommit`), **plus** one full E2E run under artificial CPU pressure (the 10-23 "16 burners" setup) with zero failures. Write the tallies into a dated `docs/test-evidence/<date>.md` (or `.planning/`). |
| **Open race resolved, not quarantined**: `renter-saved.spec.ts:83` (scheduler `navigator.locks('tran-alerts', { ifAvailable: true })` skips the due pass when a departing document holds the lock during reload) | 10-23 classified it as a product decision; it is the only known unresolved non-determinism | MEDIUM-HIGH | `apps/web/src/lib/data/scheduler.ts`, `scheduler.test.ts` two-tab tests, Phase 4 cross-tab design | Owner decision recorded first (keep `ifAvailable` and accept a skipped pass, or bounded wait). If fixed: lock requested with an `AbortSignal` bounded wait (~10 s) and due searches recomputed inside the lock; two-tab tests updated; **concurrency guards mutation-tested** (feedback_migration_verification: a green suite alone proves nothing); `--repeat-each 10` green under 40 burners. |
| CI retry policy made explicit: keep `retries: CI ? 1 : 0` only together with `--fail-on-flaky-tests` (so a retry still fails the job but the trace shows both attempts), or set retries to 0 | Today a CI retry can mask a flake as green | LOW | `apps/web/playwright.config.ts`, `ci.yml` | Documented in the config comment; CI job red on any `flaky`. |
| Worker-count guidance pinned: the host's memory reaper killed the single-invocation gate twice; the 2026-10-29 gate ran Playwright at three workers | Reproducibility of the gate itself | LOW | milestone audit notes | `RUNBOOK.md` states the known-good worker counts for the dev machine and CI (`ubuntu-24.04` default 50% of cores). |

### Differentiators

| Capability | Value | Complexity | Depends on | Notes |
|------------|-------|------------|------------|-------|
| **Order-independence proof**: one unit run with `sequence.shuffle: { files: true, tests: true }` and a recorded `seed`, green | Catches hidden inter-test state (shared fake-indexeddb, module singletons) that load exposes as "flakes" | LOW | Vitest `sequence.seed` | Record the seed in the evidence file so a failure is reproducible. |
| **Flake ledger** `docs/test-evidence/FLAKES.md`: every failure seen in a full run gets a row (spec:line, date, run, classification: real race / test wait / CPU starvation / not reproduced, fix commit) | Turns deferred-items prose into a table the next milestone can audit | LOW | existing deferred-items content (Phase 3, 4, 7, 10) | Seed it from the 10-23 and 07-21 findings. |
| **Quarantine lane with expiry** (`test.fixme` plus an `annotation: { type: 'quarantine', description: 'expires 2026-12-01 owner:…' }` and a script test that fails when an expiry passes) | If anything ever has to be quarantined, it cannot be forgotten | LOW | Playwright custom annotations | Build the mechanism; the goal is an empty lane. |
| **CPU-pressure job** in CI (`workflow_dispatch` only): runs the formerly flaky specs with `--repeat-each 5` while a stress process burns cores | Reproduces the dev-machine conditions on a clean runner | MEDIUM | `stress-ng` on ubuntu runners | Not on every push; on demand and before milestone close. |

### Anti-features

| Anti-feature | Why requested | Why problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| `retries: 2` everywhere | Green CI fast | Hides exactly the races this milestone exists to remove; three Phase 10 "flakes" were real bugs | Zero locally; `--fail-on-flaky-tests` in CI. |
| Raising the global `expect` timeout or `testTimeout` | Stops red runs | PROJECT.md forbids blind raises; 10-23 showed each case had a specific cause (smooth scroll, lazy chunk, HEAD race) | Per-test, measured, commented raises only; `expect.poll` for async flags. |
| Permanent `test.fixme` / `.skip` on load-sensitive specs | Quick | Silent coverage loss; the 06/07 specs cover 0-call budget guarantees | Quarantine with expiry and owner, or fix. |
| Serial mode for everything (`fullyParallel: false`, `workers: 1`) | "Deterministic" | A 2,327-test suite at one worker is hours; hides parallel-safety problems the extension and multi-tab code must survive | Serial lane only for timing assertions; keep the main suite parallel and fix real races. |
| A new test framework or a flake-detection SaaS | Dashboards | Cost, context, and the tooling already exists in Playwright/Vitest flags plus `audit-evidence.mjs` | Built-in flags plus the evidence protocol above. |

---

## 5. Carried debt: definition of done per item

Each item cites the `.planning` file it came from. "Done" is what the roadmap should plan and the verifier should check.

### 5.1 ListingCard address-link id (OPEN since 06-22)

**Source:** `.planning/phases/06-renter-portal/deferred-items.md` ("OPEN, found in 06-22"); `06-HUMAN-UAT.md` "Known limitations" (R12 note); `v1.0-MILESTONE-AUDIT.md` tech_debt phase 06.

**Today:** `ListingCard.svelte:54` derives `addrId = card-${row.id}-addr`; the card renders in up to three containers on the Map tab (hidden List panel `ResultsList.svelte`, split list `SplitList.svelte` from 1024px, `SelectedListingPreview.svelte`), so the same `id` appears up to three times. `ResultsList.svelte:49` and `SplitList.svelte:53` scope their `querySelector` to their own container, so behaviour is correct and axe (WCAG 2.2 tags) passes.

**Done when:**
1. `ListingCard` takes an `idPrefix` (or `scope`) prop and builds `addrId` from it; `ResultsList`, `SplitList` and `SelectedListingPreview` pass distinct prefixes (`list`, `split`, `preview`) and look up `#${prefix}-card-${id}-addr` in their own container.
2. A `renter-map*.spec.ts` assertion at 1280px on the Map tab with a selected pin (all three render) proves `document.querySelectorAll('[id]')` has no duplicate ids, and the focus-after-"Show more" and focus-after-pin-select behaviours (`ResultsList.showMore`, `SplitList` scroll effect) still land on the right link.
3. `renter-journey.spec.ts` still scopes its click to the selected card; axe stays green; the 06-HUMAN-UAT "Known limitations" sentence about duplicate ids is removed (R12 remains for the screen-reader pass itself).

**Complexity:** LOW. **Depends on:** Phase 6 renter map/list components and their specs.

### 5.2 Snapshot save-gate reason text (Phase 9 debt)

**Source:** `v1.0-MILESTONE-AUDIT.md` tech_debt phase 09: "Snapshot Save reason reads 'Fix the 0 items marked Must fix' when only Review phrases block (save-gate.ts:50)".

**Today:** `apps/web/src/lib/features/studio/snapshot/save-gate.ts` `saveGateReason` returns `notesFindingsReason(s.mustFix)` when `s.notesOn && (s.mustFix > 0 || s.unackedReview)`, so a warn-only draft yields "Fix the 0 items marked Must fix in the market notes, and review any others." The shared panel uses a distinct review-only string (`panel-controller.ts` `WARN_REASON`: "Review the flagged phrases and check the box above to continue.") and pluralizes "1 phrase / 2 phrases".

**Done when:**
1. `saveGateReason` distinguishes three notes states: Must-fix present (count pluralized "1 item"/"N items"), review-only unacknowledged (a dedicated string, consistent in voice with `WARN_REASON`, e.g. "Review the flagged phrases in the market notes and check the box to continue."), and clear. The string is recorded in the 09-UI-SPEC (or its successor) because UI copy is spec-owned.
2. `save-gate.test.ts` gains a review-only case and a `mustFix === 1` singular case; the existing `fix: (n) => …` fixture is updated.
3. An E2E in the snapshot spec drives a warn-only notes draft (the deny-all harness with a fixture provider) and asserts the reason line text and that Save stays refused until the acknowledgement; the `urgentReason` path (`SnapshotBuilder.svelte:348`, stale recheck) uses the same function so it inherits the fix.
4. `pnpm banned` and the Phase 9 disclosure gates stay green.

**Complexity:** LOW. **Depends on:** Phase 9 `SnapshotBuilder`, Phase 5 `panel-controller` strings.

### 5.3 Print recheck without notes (07-19 Known Limitation, 07-HUMAN-UAT S2)

**Source:** `.planning/phases/07-investor-portal/07-19-SUMMARY.md` "Known Limitations"; `07-HUMAN-UAT.md` row S2; `07 deferred-items.md` ("RECORDED for owner sign-off as S2… fails closed"); `v1.0-MILESTONE-AUDIT.md` tech_debt phase 07.

**Today:** `/print/memo/+page.svelte` `isBlocked()` re-runs `runChecks(artifact.text, createMemoPostChecks(memoFactsForDeal(current, '').allowed))` with an **empty** notes string, because the memo page (`MemoPage.svelte:59`) computes `facts` with the live `notes` textarea value that is never stored with the artifact. A memo that quotes a number present only in the notes passes on the memo page and is **blocked at print** (fails closed; nothing unchecked prints).

**Done is one of two owner-chosen states (S2 wording):**
- **(a) Accept as is:** S2 marked accepted in `07-HUMAN-UAT.md`; the limitation sentence stays in the print "blocked" panel copy or the memo notes helper ("numbers that appear only in your notes will be flagged at print"), with a unit test pinning the copy. Complexity: LOW.
- **(b) Fix:** when the memo artifact is created, the notes' allowed numerals (or the notes text itself) are persisted in the artifact `meta` (the repo supports `meta` with at most 16 keys and 200-char values, `artifacts.ts:51`; notes are capped at 1,000 chars, so either the extracted numeral list or the text split across keys fits). `/print/memo/` reads them back and passes them to `memoFactsForDeal(current, notesFromMeta)`. Done when: a unit test round-trips `meta` through `createArtifactRepo`; `investor/print.spec.ts` gains "a memo quoting a notes-only number prints" (green only after the fix) while "blocked: a memo with a Must fix number is never printed" stays green; a mutation run that drops the `meta` write turns the new test red; backup export/import of the artifacts table carries `meta` (PLAT-04 registry test). Complexity: MEDIUM.

**Depends on:** Phase 5 artifact repo, Phase 7 memo checks (`memo-checks.ts` `checkNumbers`), Phase 7 print route and spec.

### 5.4 Origin drift test (extension vs web app)

**Source:** `v1.0-MILESTONE-AUDIT.md` integration finding (low): `apps/extension/src/lib/config.ts` `TRAN_ORIGIN = 'https://tranrealestate.github.io'` duplicates `apps/web/src/lib/site-config.ts` `DEFAULT_SITE_ORIGIN` with no drift test.

**Done when:** one `scripts`-project test imports both constants (or reads both files) and asserts equality, and asserts `PRIVACY_URL` equals `DEFAULT_SITE_ORIGIN + '/legal/privacy/#browser-extension'` and that the anchor id exists in the privacy page source. A planted mismatch turns it red (non-vacuity, as the project's other guards do). Complexity: LOW. Also surfaces in the live smoke (Section 2) as the privacy-anchor check.

### 5.5 UI-level backup round-trip across all portal stores

**Source:** `v1.0-MILESTONE-AUDIT.md` integration finding (low): no single Playwright spec round-trips seeded rows from every Phase 6-9 store through the Settings backup UI; per-store unit round-trips and the registry test exist.

**Done when:** one `settings-backup-all.spec.ts` seeds at least one row in every registered table (renter saved searches, shortlist, investor deals, buy boxes, watched ZIPs, agent contacts, tasks, studio drafts, AI artifacts with `meta`), exports via the Settings UI, wipes the profile, imports with preview, and asserts each portal shows its row at 0 RentCast calls (deny-all harness). The key-scan refusal path is already covered; this spec is the breadth check. Complexity: MEDIUM (long but mechanical). Depends on: Phase 3 backup registry `DEFAULT_TABLES`.

### 5.6 tailwind-merge drops the custom font-size token class (OPEN since 04-14)

**Source:** `.planning/phases/04-…/deferred-items.md` "From 04-14"; carried in 05 and 06 `deferred-items.md`; `v1.0-MILESTONE-AUDIT.md` tech_debt phase 04.

**Done when:** `extendTailwindMerge({ extend: { classGroups: { 'font-size': [{ text: ['label', 'body', 'heading', 'display'] }] } } })` is the merge used by `cn()` in `$lib/utils.ts` and by the `tv()` config; a unit test asserts `cn('text-label text-muted-foreground')` keeps both; Phase 3 Badge/Button render at Label 14px (a real-Chromium `*.browser.test.ts` reads computed `font-size`, per the Phase 5 testing lesson); the `text-base leading-[1.6]` workarounds noted in Phases 5-6 may stay (they are correct) but new UI stops needing them. Complexity: LOW, but it touches every copied-in primitive, so it needs its own plan and a full axe/visual pass (the 06 note says exactly this).

### 5.7 Load-sensitive saved-search spec (`renter-saved.spec.ts:83`)

**Source:** `.planning/phases/10-…/deferred-items.md` "From 10-23 … OPEN, product decision"; `10-VERIFICATION.md` "Known open items"; `v1.0-MILESTONE-AUDIT.md` tech_debt phase 10.

**Done when:** see Section 4 table stakes "Open race resolved, not quarantined". The product decision (keep `ifAvailable` semantics vs bounded wait) is recorded in PROJECT.md Key Decisions either way.

### 5.8 Owner decisions riding along (no code until decided)

| Decision | Source | Options |
|---|---|---|
| Report-only pages over the 60 KB JS budget (`/feedback/` 102.5 KB, `/for-*` 96.5 KB) | 10-HUMAN-UAT 8 | Accept as is, or schedule the trim (plain buttons/radios, lazy zod) |
| "Showcase" badge default | 11-HUMAN-UAT 3 | Keep excluded (current) or move to default `labels` |
| Sample snapshot prints at 6 Letter pages; Studio license titles NY-safe vs per-state | audit tech_debt phase 09 | Accept or condense; pick one title scheme |
| Investor memo lists two block reasons for an advertising phrase | 09-HUMAN-UAT UAT-8 | Acknowledge or filter the duplicate |

---

## Feature Dependencies

```
Owner creates org + repo named tranrealestate.github.io, pushes main, Pages source = Actions, PAGES_ENABLED=true
    └──requires──> first deploy job run observed (artifact has .nojekyll)
                       └──requires──> Live-origin smoke (Section 2) green against https://tranrealestate.github.io/
                                          ├──enables──> 01-HUMAN-UAT 1-2, 10-HUMAN-UAT 6, LAUNCH-AUDIT row 6 close as MACHINE-verified
                                          ├──enables──> Privacy anchor live ──> Edge Add-ons submission (11-HUMAN-UAT 5 then 6)
                                          ├──enables──> Search Console property + sitemap (token committed first)
                                          ├──enables──> Share-card validators (FB, LinkedIn) + real Slack/iMessage sends
                                          └──enables──> Launch services variables (Web3Forms, Umami, contact) then 10-HUMAN-UAT 1-3

Local stand-in (scripts/serve-pages.mjs) ──enables──> Smoke suite developed and green BEFORE the origin exists
Build stamp (meta or /__build.json) ──enhances──> Smoke (asserts "this deploy", not "a deploy")
Post-deploy smoke job in ci.yml ──requires──> Smoke suite + build stamp + deploy outputs.page_url

Zillow ToU read + go/no-go (11-HUMAN-UAT 4) ──gates──> ext-v0.1.0 Release AND Edge listing
Remote exists ──requires──> EXTENSION_RELEASES_ENABLED=true ──> tag ext-v0.1.0 ──> Release zip + SHA256SUMS (+ attestation)
Edge listing live (up to 7 business days, may be longer) ──> install-guide link edit

Timing lane + evidence protocol ──should precede──> Kit 3 / Vitest 5 / pnpm 12 toolchain phase
    (so the migration is measured against a known-deterministic baseline; a flaky baseline hides migration regressions)
Carried debt (5.1-5.7) ──should precede──> toolchain phase (PROJECT.md: "in one isolated phase after the debt is cleared")
Origin drift test (5.4) ──conflicts-if-absent──> any later PUBLIC_SITE_URL / custom-domain change
```

### Dependency notes

- **Go-live is first, not last.** Every GTM proof, the Edge privacy URL, the Release workflow and half the HUMAN-UAT rows wait on the origin; the owner has already decided to create it early (STATE.md 2026-10-29).
- **The smoke suite can be built before the origin exists** because `scripts/serve-pages.mjs` already emulates Pages' 301/200/404 behaviour; only the `@live-only` subset (HTTPS redirect, cert, third-party unfurlers) waits.
- **Edge submission has an unavoidable external wait** (certification). Submit as soon as the privacy anchor is live and the ToU decision is recorded, then continue other phases.
- **Test hardening before the toolchain phase**, so Kit 3 / Vitest 5 / pnpm 12 regressions are distinguishable from pre-existing non-determinism. Vitest 5 also changes the pool/`projects` surface the timing lane depends on; define the lane on Vitest 4 first, migrate second.

---

## MVP Definition (for this milestone)

### Must ship in v1.1

- [ ] First real deploy observed; live routing/CSP/404/HTTPS contract verified; launch proof recorded (Section 1 table stakes).
- [ ] Live smoke suite with fail-closed base URL, read-only checks, build stamp, running green against the emulator first and the real origin second; CI `smoke` job after `deploy`.
- [ ] HUMAN-UAT rows reclassified: machine-verified rows closed by the smoke; the truly human rows (real keys, real devices, dashboards, inboxes, store accounts, ToU, product decisions) listed in one place with their results.
- [ ] GTM-01..04 ticked (or GTM-04 cut per the documented cut line).
- [ ] `ext-v0.1.0` Release published with zip + `SHA256SUMS.txt` (+ attestation); Edge listing submitted with screenshots, support contact, certification notes; changelog started.
- [ ] Timing lane separated; evidence protocol run (3 consecutive clean full runs, repeat-each on the named specs, one CPU-pressure run); `renter-saved:83` decided and resolved; CI flaky results fail the job.
- [ ] Carried debt 5.1-5.7 closed with the sourced definitions of done.
- [ ] Toolchain phase (Kit 3, Vitest 5, pnpm 12) after the above, clearing the four low audit exceptions before 2027-01-31.

### Add after the origin is stable (v1.1.x)

- [ ] Order-independence shuffle run and flake ledger — trigger: first full green evidence set exists.
- [ ] On-demand CPU-pressure CI job — trigger: a load-only failure reappears on a clean runner.
- [ ] `RUNBOOK.md`, `apps/extension/README.md`, `RELEASING.md` — trigger: the second deploy or second release approaches.

### Deferred (v2+)

- [ ] Custom domain (needs money and a second Search Console property).
- [ ] Firefox Add-ons; Chrome Web Store (paid).
- [ ] Any hosted tier (must leave GitHub Pages per its terms).

---

## Feature Prioritization Matrix

| Capability | Owner/operator value | Implementation cost | Priority |
|------------|----------------------|---------------------|----------|
| First deploy + live contract verified + proof bundle | HIGH | LOW | P1 |
| Smoke suite (emulator first, live second), fail-closed URL | HIGH | MEDIUM | P1 |
| CI post-deploy smoke job + build stamp | HIGH | LOW-MEDIUM | P1 |
| Search Console token committed + sitemap submitted | MEDIUM | LOW | P1 |
| Share-card proof (FB, LinkedIn, Slack, iMessage) | MEDIUM | LOW | P1 (human) |
| Web3Forms + Umami live proof / cut line | MEDIUM | LOW | P1 (human) |
| `ext-v0.1.0` Release + changelog | HIGH | LOW | P1 (after ToU go) |
| Edge listing: screenshots, support contact, certification notes, submission | MEDIUM | LOW | P1 (after privacy URL live) |
| Attestation on the release zip | MEDIUM | LOW | P2 |
| Timing lane + evidence protocol + CI fail-on-flaky | HIGH | MEDIUM | P1 |
| `renter-saved:83` decision + mutation-tested fix | HIGH | MEDIUM-HIGH | P1 |
| Carried debt 5.1 ListingCard id | LOW | LOW | P2 |
| Carried debt 5.2 save-gate reason | MEDIUM (user-facing copy bug) | LOW | P1 |
| Carried debt 5.3 print recheck | MEDIUM | LOW (accept) / MEDIUM (fix) | P2 (owner picks) |
| Carried debt 5.4 origin drift test | MEDIUM | LOW | P1 (tiny) |
| Carried debt 5.5 backup round-trip spec | MEDIUM | MEDIUM | P2 |
| Carried debt 5.6 tailwind-merge tokens | MEDIUM | LOW + wide blast radius | P2 (own plan) |
| Flake ledger, shuffle run, quarantine-with-expiry mechanism | MEDIUM | LOW | P2 |
| RUNBOOK / README / RELEASING docs | MEDIUM | LOW | P2 |
| Toolchain Kit 3 / Vitest 5 / pnpm 12 | HIGH (audit exceptions) | HIGH | P1, last |

---

## How comparable projects do it (reference patterns, not competitors)

| Concern | Common pattern in static-site + Actions projects | Our approach |
|---------|--------------------------------------------------|--------------|
| Go-live checklist | A one-time markdown checklist plus a repeatable runbook; proof kept as screenshots and run links | `docs/DEPLOY-CHECKLIST.md` exists (one-time); add `RUNBOOK.md` (repeatable) and a `launch-proof/` folder |
| Post-deploy verification | Small tagged smoke against `BASE_URL` from env, run by a job that `needs` the deploy; zero retries; read-only | Same, plus the build-stamp poll because Pages publishes asynchronously (up to 10 minutes) |
| Local stand-in for a host | A static server with host-specific redirect/404 semantics | Already built: `scripts/serve-pages.mjs` |
| Extension release | Tag-driven workflow, zip + checksums, changelog, store listing copy in-repo | Already built; add changelog, attestation, screenshots, certification notes |
| Flake policy | Flaky status tracked, budgets, time-boxed quarantine with owner/expiry, serial lane for timing | Adopt flags already in Playwright/Vitest; evidence shards already exist (`audit-evidence.mjs`) |

---

## Sources

**Official documentation (HIGH)**
- GitHub Docs, About GitHub Pages (org site repo naming, one site per account): https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages
- GitHub Docs, GitHub Pages limits (1 GB, 100 GB/month, 10 builds/hour not for Actions, 10-minute deploy timeout, prohibited SaaS use): https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- GitHub Docs, Creating a GitHub Pages site ("up to 10 minutes" to publish): https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- GitHub Docs, Securing your GitHub Pages site with HTTPS: https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https
- GitHub Docs, Creating a custom 404 page: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site
- GitHub Docs, Artifact attestations (SLSA Build L2, Sigstore public instance) and Use artifact attestations (`actions/attest@v4`, permissions, `gh attestation verify -R`): https://docs.github.com/en/actions/concepts/security/artifact-attestations and https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations
- GitHub CLI manual, `gh release create` flags: https://cli.github.com/manual/gh_release_create
- Microsoft Learn, Publish a Microsoft Edge extension (field rules, 250-10,000 char description, logo 300x300, screenshots 640x480/1280x800 max 6, search terms 7/21/30, privacy page sections, "up to seven business days"): https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension
- Microsoft Learn, Register as a Microsoft Edge extension developer (no fee, MSA or GitHub sign-in, individual vs company): https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account
- Microsoft Edge Dev blog 2026-09-08, Faster reviews and quality recognition (turnaround increased, automation): https://blogs.windows.com/msedgedev/2026/09/08/faster-reviews-and-quality-recognition-for-microsoft-edge-extensions/
- Chrome for Developers, Manifest `version`: https://developer.chrome.com/docs/extensions/reference/manifest/version
- Google Search Central, Build and submit a sitemap: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google Search Console Help, Verify your site ownership: https://support.google.com/webmasters/answer/9008080
- Playwright, Retries (passed/flaky/failed, serial mode): https://playwright.dev/docs/test-retries ; CLI (`--repeat-each`, `--fail-on-flaky-tests`, `--grep`, `--workers`): https://playwright.dev/docs/test-cli ; Annotations and tags: https://playwright.dev/docs/test-annotations
- Vitest v5.0.5 config: `retry` https://vitest.dev/config/retry ; `sequence` https://vitest.dev/config/sequence ; `fileParallelism` https://vitest.dev/config/fileparallelism
- Umami pricing (Hobby: 100K events, 1 website, 6-month retention, no API): https://umami.is/pricing ; Umami docs, Metric definitions (IP hashed with monthly salt, not stored as a field) https://docs.umami.is/docs/metric-definitions ; FAQ (no cookies) https://docs.umami.is/docs/faq
- Slack developer docs, Unfurling links in messages (reads Open Graph and X Card metadata): https://docs.slack.dev/messaging/unfurling-links-in-messages/

**Project files (HIGH, internal)**
- `.planning/PROJECT.md`, `.planning/MILESTONES.md`, `.planning/milestones/v1.0-MILESTONE-AUDIT.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`
- `docs/DEPLOY-CHECKLIST.md`, `docs/EXTENSION-INSTALL.md`, `docs/LAUNCH-AUDIT.md` (generated)
- `.planning/phases/01-…/01-HUMAN-UAT.md`, `06-…/06-HUMAN-UAT.md`, `07-…/07-HUMAN-UAT.md`, `09-…/09-HUMAN-UAT.md`, `10-…/10-HUMAN-UAT.md`, `10-VERIFICATION.md`, `11-…/11-HUMAN-UAT.md`
- `.planning/phases/{03,04,05,06,07,08,10,11}-…/deferred-items.md`; `.planning/phases/07-…/07-19-SUMMARY.md`
- `.github/workflows/ci.yml`, `.github/workflows/extension-release.yml`, `scripts/serve-pages.mjs`, `scripts/assert-extension.mjs`, `apps/web/playwright.config.ts`, `vitest.config.ts`
- `apps/extension/store/edge-listing.md`, `apps/extension/wxt.config.ts`, `apps/extension/src/lib/config.ts`, `apps/extension/package.json`
- `apps/web/src/lib/features/studio/snapshot/save-gate.ts`, `apps/web/src/lib/ai/ui/panel-controller.ts`, `apps/web/src/routes/(print)/print/memo/+page.svelte`, `apps/web/src/lib/features/investor/memo/{memo-facts-for-deal,memo-checks}.ts`, `apps/web/src/lib/ai/storage/artifacts.ts`, `apps/web/src/lib/features/renter/search/{ListingCard,ResultsList}.svelte`, `apps/web/src/lib/features/renter/map/{SplitList,SelectedListingPreview}.svelte`, `apps/web/src/lib/data/scheduler.ts`
- `tasks/lessons.md` (2026-10-13 and 2026-10-25 flake rules)

**Practitioner and vendor sources (MEDIUM/LOW, cross-checked where possible)**
- Post-deploy smoke structure: testdino.com "Playwright staging vs production", currents.dev "Playwright testing staging vs production", dev.to/playwright "Testing staging and production environments", qaskills.sh "production smoke suite" (consistent pattern; MEDIUM)
- Flake budgets and quarantine: shiplight.ai "Test flakiness budget" glossary (0.5% / 2%), oneuptime.com 2026-07-28 "How to quarantine flaky tests", tenki.cloud "Flaky test quarantine GitHub Actions", qaskills.sh "flaky test tracking data model" (vendor opinions; LOW for the numbers, MEDIUM for the time-box/owner/expiry pattern)
- Share-card validators: nuxtseo.com social share debugger notes (Facebook "Scrape Again", LinkedIn sticky cache), swimburger.net verification guide, onurdan.medium.com "How to validate Twitter cards after X removed Card Validator", opentweet.io X card validator page (X validator retired/broken; conflicting; LOW), Apple TN2444 (archived) and Apple Developer Forums threads on iMessage `og:image` (LOW)

---
*Feature research for: Tran Real Estate Tools v1.1 Launch & Hardening (go-live, live smoke, extension release, test hardening, carried debt)*
*Researched: 2026-10-29*
