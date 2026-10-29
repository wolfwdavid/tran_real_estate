# Pitfalls Research

**Domain:** Milestone v1.1 "Launch & Hardening" of Tran Real Estate Tools: first push and GitHub Pages org-root go-live of a never-deployed static SvelteKit 2 + MV3 extension repo (1,208 commits), a live-origin smoke suite, load-flake elimination across 6,647 unit + 2,327 E2E tests, the SvelteKit 2 -> 3 / Vitest 4 -> 5 / pnpm 11 -> 12 migration, and the Edge Add-ons + GitHub Releases extension release.
**Researched:** 2026-10-29
**Confidence:** MEDIUM-HIGH overall. HIGH where the claim comes from this repo's own files, the npm registry, or official docs fetched today (SvelteKit 3 migration/config pages, Vitest 5 migration page, pnpm 12 release/lockfile docs, GitHub Pages/secret-scanning docs, Edge Partner Center docs and developer policies, the live Umami Cloud script, live GitHub Pages response headers). MEDIUM where it is an inference from documented behaviour (Pages CDN staleness window, Kit 3 service-worker manifest contents). LOW where only secondary sources exist (Web3Forms quota accounting, Edge rejection folklore).

> **Scope note.** This file covers only pitfalls created by ADDING the v1.1 work to the existing system. The v1.0 pitfalls (RentCast overage, key theft via XSS, Fair Housing, meta-CSP limits, Safari eviction, Zillow ToU, base-path breakage, secrets in the public repo) live in `.planning/milestones/v1.0-research/PITFALLS.md` and are not repeated. Lessons already recorded in `.planning/RETROSPECTIVE.md` and `tasks/lessons.md` (poll async flags, cap Playwright workers, run `audit` first, strip trailers per wave, re-check third-party DOM live) are referenced, not re-taught.

> **Phase labels.** The milestone names six work areas; this file tags every pitfall with one of them so the roadmapper can attach it: **Go-live** (org, remote, first push, Pages), **Smoke suite** (configurable-origin live checks), **Debt** (carried follow-ups), **Test lanes** (load-flake elimination), **Toolchain** (Kit 3 / Vitest 5 / pnpm 12), **Extension release** (`ext-v0.1.0` + Edge Add-ons). Where ordering matters, it is called out.

---

## Facts verified today that change the plan

Read these first; several contradict assumptions in the current docs and checklists.

| Assumption in the repo today | What was verified (2026-10-29) | Consequence |
|---|---|---|
| History is clean of model trailers (RETROSPECTIVE: "forcing a filter-branch rewrite") | `git log --format='%(trailers:key=Co-Authored-By)' \| grep -c .` = **145** commits still carry `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (2026-10-13 .. 2026-10-14, Phases 9-10); 168 commits mention Claude/AI in subject or body | A history rewrite must happen **before** `git remote add`. After the first push it is a force-push to a public repo. See Pitfall 1. |
| `.gitleaks.toml` allowlists two commits by SHA (`4e453c1…`, `05793bf…`) | Any history rewrite changes every SHA after the earliest rewritten commit | The CI `hygiene` history scan goes red on the first push unless the allowlist is re-derived (or switched to path + regex). Pitfall 1. |
| DEPLOY-CHECKLIST Step 8.1.2: Umami host "for example `https://cloud.umami.is`" | The Umami Cloud tracker (`https://cloud.umami.is/script.js`) POSTs to **`https://gateway.umami.is/api/send`**; `POST https://cloud.umami.is/api/send` returns **404** | With `mode: 'no-cors'` the 404 is invisible. The checklist example would silently lose every pageview. Pitfall 5. |
| Kit 3 is "still RC" (STACK.md, 2026-09-13) | `@sveltejs/kit@latest` = **3.1.0**; `@sveltejs/adapter-static@latest` = **4.0.0** (peer `kit ^3.0.0-next.0`); `vitest@latest` = **5.0.5**; `@vitest/browser-playwright@5.0.5` exact-pins `vitest 5.0.5`; `vitest-browser-svelte@3.1.0` (peer `vitest ^4 \|\| ^5`); `pnpm@latest` = **12.16.1**; `runed@0.38.0` peers `@sveltejs/kit ^3.0.0` while the installed 0.37.1 peers `^2.21.0` | The migration targets are stable; the peer graph has one wrinkle (runed) and several repo-specific codemod gaps. Pitfalls 12-14. |
| Kit 3 keeps `serviceWorker.files` | Kit 3 config reference documents `serviceWorker.register` and `options` only; `$service-worker` is removed in favour of `$app/manifest` (`assets`, `immutable`, `prerendered`) | The dotfile filter that keeps `.nojekyll` out of the precache (all-or-nothing `cache.addAll`) must move into `service-worker.ts`. Pitfall 12. |
| pnpm 12 "keeps the pnpm 11 lockfile" (STACK.md) | `lockfileVersion` stays `'9.0'`, but once `packageManager` pins pnpm >= 12 the file gains a **leading boot YAML document** (`packageManagerDependencies`); `pnpm install --frozen-lockfile` fails with `ERR_PNPM_FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE` when the pin changes without a regenerated lockfile | `scripts/supply-chain.test.ts:104` ("pnpm-lock.yaml is a single YAML document") fails by design; `scripts/build-web.mjs:20` and `scripts/launch-audit.test.ts:233` hardcode `11.27.0`. Pitfall 14. |
| GitHub Pages caching is not a smoke-suite concern | Live headers on a Pages page today: `Cache-Control: max-age=600`, `Via: 1.1 varnish`, `X-Cache: HIT/MISS`, `X-Fastly-Request-ID`; no custom headers possible | A smoke run in the first ~10 minutes after `deploy-pages` can assert against the previous deploy (or GitHub's own 404 page for a brand-new site). Pitfall 3. |
| Push protection is something the owner switches on later (Step 5) | GitHub docs: user-level push protection "is enabled by default" and "stops you from pushing secrets to public repositories"; since 2026-10-13 Anthropic `sk-ant-…` keys are blocked by default on free public repos | The owner's first push IS scanned. The repo currently contains zero `sk-ant-`/`sk-proj-`/`AIza` shaped strings (verified by grep); the smoke suite must keep it that way. Pitfall 8. |
| The CSP oracle only checks pages it knows | `scripts/assert-csp.mjs` pins the exact page set (`PAGES` list + `sameSet`) and requires the CSP `<meta>` to be first in `<head>` after `<meta charset>` | A Search Console **HTML-file** verification (`static/google….html`) breaks `csp:assert`; the **meta-tag** method must be placed after `%sveltekit.head%`. Pitfall 7. |

---

## Critical Pitfalls

### Pitfall 1: The first push publishes 145 model trailers and breaks the gitleaks SHA allowlist

**What goes wrong:**
The repo's rule (CLAUDE.md, lessons 2026-10-25) is that commits never mention AI assistants. The retrospective records a `filter-branch` cleanup, yet 145 commits between 2026-10-13 and 2026-10-14 still carry `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and 168 commits mention Claude/AI somewhere in the message. The moment `git push -u origin main` succeeds, that history is public, forkable and indexed. Cleaning it afterwards means a force-push to a public default branch, which also invalidates every commit hash quoted in `.planning/MILESTONES.md` (`213f4b6`, `e1acd0a`), the phase SUMMARY files and `v1.0-MILESTONE-AUDIT.md`.

Second-order failure: `.gitleaks.toml` allowlists two commits **by SHA** (`4e453c1bbce…`, `05793bfa1b1…`). A history rewrite changes those SHAs, so the CI `hygiene` job's `gitleaks git` full-history scan fails on the very first run after the push, blocking the deploy.

**Why it happens:**
Trailers were stripped per wave in Phase 11 but Phases 9-10 ran before the rule hardened. Nobody re-checked the whole history at milestone close because there was no remote to push to.

**How to avoid:**
1. In the Go-live phase, before `git remote add`: `git filter-branch --msg-filter 'grep -v "^Co-Authored-By:"' -- --all` (or `git filter-repo --message-callback`), then assert `git log --format='%(trailers:key=Co-Authored-By,valueonly)' | grep -c .` prints `0`.
2. Triage the 168 body mentions by category: model IDs that are product content (`claude-sonnet-5` in a registry commit) may stay; narrative mentions of the assistant go. Do this as a reviewed list, not a blind sed.
3. Re-derive the two gitleaks allowlist SHAs from the rewritten history by subject (`git log --format='%H %s' | grep '<subject>'`) or replace the `commits = […]` allowlist with the existing `paths` + a `regexes` entry so it no longer depends on SHAs. Re-run `pnpm secrets:scan` and `pnpm secrets:canary`.
4. Remap hashes quoted in MILESTONES.md, SUMMARY files and the audit by commit subject (lesson 5 from the retrospective).
5. Add a CI hygiene step that fails on any `Co-Authored-By` trailer in `origin/main..HEAD` so the problem cannot recur after go-live.

**Warning signs:**
`git log --grep='Co-Authored-By' | head` is non-empty; `hygiene` job red with "allowlisted commit not found" semantics; MILESTONES.md hashes no longer resolve.

**Phase to address:** Go-live (pre-push task; blocks `git remote add`).

---

### Pitfall 2: Pages is "enabled" but nothing deploys, or `deploy-pages` 404s

**What goes wrong:**
Three ordering traps around the first deploy:
- The checklist pushes `main` (Step 3) before `PAGES_ENABLED=true` exists (Step 6). The deploy job is gated on `github.event_name == 'push' && github.ref == 'refs/heads/main' && vars.PAGES_ENABLED == 'true'`, so the first run skips the upload and deploy, and because `workflow_dispatch` is excluded by the gate, setting the variable afterwards deploys **nothing** until another push to `main`.
- If the variable is set but the Pages source is still "Deploy from a branch" (or Pages was never enabled), `actions/deploy-pages` fails at "create deployment" with an HTTP 404 ("Not Found"). The workflow uses no `actions/configure-pages` step with `enablement: true`, so the fix is manual.
- If the owner creates the org repo **with** a README/licence, the first push is rejected as non-fast-forward; and if the repo name is anything but `tranrealestate.github.io`, the site publishes under `/<repo>` and the root build's absolute OG/sitemap URLs are wrong (the `sub` CI leg proves the build, not the owner's variables).

**Why it happens:**
The gates were designed to be fail-closed with no remote. Nobody has walked the sequence against a real repo.

**How to avoid:**
Rewrite DEPLOY-CHECKLIST steps 2-6 into a strict order with a verification after each: (a) create an **empty** public repo named exactly `tranrealestate.github.io`; (b) Settings > Pages > Source = **GitHub Actions** (this creates the `github-pages` environment); (c) set `PAGES_ENABLED=true`; (d) `git push -u origin main`; (e) if `main` was already pushed, `git commit --allow-empty -m "chore: go live" && git push`. Add to the Go-live phase a smoke step that reads `needs.deploy.outputs.page_url` and fails the run if it is empty. Keep `.nojekyll` (harmless; adapter-static docs say it is only required when not deploying through Actions).

**Warning signs:**
Actions UI shows `deploy` as "skipped" on the first main push; `deploy-pages` log contains `HttpError: Not Found`; `git push` says "fetch first".

**Phase to address:** Go-live.

---

### Pitfall 3: The smoke suite tests the CDN cache (or the previous deploy), not the deploy that just finished

**What goes wrong:**
GitHub Pages serves through Fastly with `Cache-Control: max-age=600` (verified live today: `Via: 1.1 varnish`, `X-Cache`, `X-Fastly-Request-ID`). A smoke job chained directly after `deploy-pages` can be answered by an edge still holding the previous build for up to ten minutes, or, on the very first deploy, by GitHub's generic 404 page (which carries GitHub's own `Content-Security-Policy` **header**, not Tran's meta tag). Assertions pass against the wrong build or fail for the wrong reason, and the team "fixes" a non-problem.

**Why it happens:**
Kit's default `version.name` is a build timestamp that nobody records, so there is no way to ask "is the origin serving build X yet?".

**How to avoid:**
- In CI, set `kit.version.name` to `GITHUB_SHA` (Kit docs: if specified it "must be deterministic"). The build then emits `/_app/version.json` = `{"version":"<sha>"}` and the service-worker cache key becomes `tran-shell-<sha>`.
- The smoke runner's first step polls `GET {origin}/_app/version.json?_=<sha>` with `cache: 'no-store'` until `version === expectedSha` (bounded, about 12 minutes), logging `Age`/`X-Cache`; only then does it run assertions. In CI the expected SHA is `github.sha`; locally it is read from `apps/web/build/_app/version.json`.
- Expose the origin and expected version as inputs (`SMOKE_ORIGIN`, `SMOKE_EXPECT_VERSION`), never hardcode `tranrealestate.github.io`, so the same suite runs against `serve-pages.mjs` today and the real origin later (PROJECT.md: "local stand-in first").
- Assert the CSP from the HTML `<meta>` (as `assert-csp` does), never from response headers: Pages cannot send custom headers, and the presence of a `content-security-policy` **header** means you are looking at GitHub's 404 page.

**Warning signs:**
Smoke passes while the owner's browser shows old content; smoke fails only on the first run after a deploy and passes on re-run; assertions on `response.headers()['content-security-policy']`.

**Phase to address:** Smoke suite (version poll, inputs); Go-live (set `version.name` in CI before the first deploy so the first smoke has something to poll).

---

### Pitfall 4: The owner's own browser keeps serving stale HTML and a stale CSP after redeploys

**What goes wrong:**
`apps/web/src/service-worker.ts` is deliberately cache-first for prerendered pages, never skips waiting, never claims clients, and precaches every page. After the owner redeploys with `PUBLIC_ANALYTICS_HOST` set (which changes `connect-src` inside the HTML meta CSP), any Tran tab or installed PWA on the owner's machine keeps the **old** HTML until every Tran tab is closed. Visible symptom: the console says "Refused to connect to https://gateway.umami.is … connect-src", the dashboard shows no pageviews, and the cut line in DEPLOY-CHECKLIST 8.1.8 ("remove both variables and redeploy, move GTM-04 to v2") gets applied to a non-bug.

**Why it happens:**
The SW design is correct for users (it protects lazy-loaded chunks that Pages has already deleted), but it makes the owner the worst possible tester of a fresh deploy.

**How to avoid:**
- Every live-origin UAT row that follows a redeploy starts with "open an InPrivate/incognito window or a fresh profile". Write this into 10-HUMAN-UAT rows 1, 2, 4, 6 and DEPLOY-CHECKLIST Step 7.
- The smoke suite runs in fresh Playwright contexts (no persisted SW), and adds one check in page context: `caches.keys()` contains `tran-shell-<expectedSha>` after `navigator.serviceWorker.ready`, which proves the new worker installed on the live origin (dotfile-free precache, see Pitfall 12).
- Settings already shows storage state; consider surfacing the running build version (`version` from `$app/environment`/`$app/env`) in Settings > About so "which build am I on?" is answerable in one glance.

**Warning signs:**
"Works in incognito, broken in my normal window"; DevTools > Application > Service Workers shows a worker in "waiting".

**Phase to address:** Smoke suite (cache-key check); Go-live (UAT wording).

---

### Pitfall 5: Umami beacons go to the wrong host, or arrive and are silently dropped as bot traffic

**What goes wrong:**
Two independent ways to end up with "no pageviews" while everything looks correct:
1. **Wrong host.** The checklist's example host `https://cloud.umami.is` is the dashboard/script origin; the Cloud script actually posts to `https://gateway.umami.is/api/send` (read from the live script today; `POST cloud.umami.is/api/send` -> 404). The Tran beacon uses `mode: 'no-cors'`, so the 404 is an opaque response and `send()` swallows every error by design. CSP would also allow the wrong host, so `csp:assert` passes.
2. **Bot filter.** Umami's `/api/send` returns `200 {beep:'boop'}` and records nothing when `isbot(userAgent)` is true (source: `src/app/api/send/route.ts`, gated by `DISABLE_BOT_CHECK`, which Cloud users cannot set). Playwright's default UA contains `HeadlessChrome`. A smoke test that "sends a pageview and checks the dashboard" can never pass; a smoke test that only checks the request fired passes while real users' hits are fine. The two failure modes look identical from the dashboard.

**Why it happens:**
The configured E2E leg proves the beacon against a local Umami-shaped collector (`serve-pages.mjs /api/send`) that accepts anything, which is right for CI but proves nothing about Umami's own validation.

**How to avoid:**
- Fix DEPLOY-CHECKLIST 8.1.2: "use the origin the tracking script POSTs to (open `https://cloud.umami.is/script.js` and search for `/api/send`; today it is `https://gateway.umami.is`). Verify with `curl -i -X POST <host>/api/send -H 'content-type: application/json' --data '{"type":"event","payload":{"website":"<id>","hostname":"tranrealestate.github.io","url":"/"}}'`: a JSON body with `cache` means accepted; a 404 means the wrong host."
- Smoke suite: in the configured context, intercept `**/api/send` and assert the request URL's origin equals the build's `__ANALYTICS_HOST__` (read from `/_app/version.json`-adjacent env or from the privacy page text, which names the host), and assert the beacon is **absent** when GPC is injected. Do not assert dashboard counts from automation.
- Keep the dashboard check an owner row, run from a normal (non-headless) browser, after Pitfall 4's fresh-profile rule.

**Warning signs:**
Privacy page names the host correctly yet no pageviews; `curl -X POST <host>/api/send` returns 404 or HTML.

**Phase to address:** Go-live (checklist correction, a one-line doc fix) and Smoke suite (URL-origin assertion).

---

### Pitfall 6: Smoke runs burn the 250/month Web3Forms quota and pollute analytics

**What goes wrong:**
Web3Forms free is 250 submissions/month and stops accepting at 100% (secondary sources; the official FAQ does not say whether spam-flagged or test submissions count, so assume they do). The site's own key is public in the page source by design and domain restriction is a Pro feature. A smoke job that runs on every push to `main` and submits the waitlist/feedback forms "to prove delivery" will exhaust the quota in a few weeks, and real visitors will see failures. Likewise every automated pageview is a fake visitor in Umami.

**Why it happens:**
"Prove GTM-02 live" is a milestone goal, and the obvious way is to submit the form.

**How to avoid:**
- Default-deny in the smoke harness exactly as the E2E deny-all harness does: `page.route('https://api.web3forms.com/**', abort)` plus an assertion that zero requests reached it; one explicit `--allow-forms` flag for the single owner-driven delivery proof (10-HUMAN-UAT row 2), run once per environment, recorded with the Web3Forms dashboard count before/after.
- Analytics: the beacon already honours GPC/DNT (`createTracker` returns early). The smoke contexts `addInitScript` a `navigator.globalPrivacyControl = true` getter, so zero pageviews are sent and no new code path is needed. One `--allow-analytics` flag for the owner's dashboard proof.
- The smoke job in CI must be `workflow_dispatch`/manual or run only on tags, not on every push (Pages has a soft 100 GB/month bandwidth limit as well; irrelevant at this scale but the principle holds).

**Warning signs:**
Web3Forms dashboard count climbing on days with no marketing; Umami shows "visitors" with 0 s sessions and `HeadlessChrome` UA strings (if not bot-filtered).

**Phase to address:** Smoke suite.

---

### Pitfall 7: Search Console verification collides with the CSP oracle, or is attempted via DNS

**What goes wrong:**
Without a custom domain the DNS method is impossible (Domain properties need a TXT record). The HTML-file method requires `https://tranrealestate.github.io/googleXXXX.html` served 200 without redirects. Dropping that file into `apps/web/static/` makes it part of the build; `scripts/assert-csp.mjs` walks the build with an exact page set (`sameSet`) and requires every HTML carrier to have the CSP meta first in `<head>`, so `csp:assert` (and the `quality` CI job) fails. Adding the file to the allowlist means teaching the oracle to accept a page with no CSP, which weakens the gate. The meta-tag method, if pasted at the top of `<head>` in `app.html`, breaks the oracle's "CSP meta must be first; only `<meta charset>` may precede it" rule.

**Why it happens:**
Both Google methods assume you control the server; the repo's oracles assume every HTML file is one of theirs.

**How to avoid:**
Use the **meta-tag** method and place `<meta name="google-site-verification" content="…">` in `apps/web/src/app.html` **after** `%sveltekit.head%` (the CSP meta is emitted inside `%sveltekit.head%`, so order is preserved). The token is public-safe. Add the tag to the PAGES contract test so a future head reorder cannot drop it. Verify with Search Console "URL inspection > Test live URL" that the rendered page is not blank (the `<html hidden>` + `frame-guard.js` design unhides at top level; Googlebot renders JS, link-preview debuggers only read meta tags). Submit `sitemap.xml` after verification and treat "Couldn't fetch" in the first hours as pending, not failure.

**Warning signs:**
`csp:assert` lists an unexpected `.html`; Search Console says "verification file not found" (Pages 301s `/x` to `/x/` only for directories, so a root file works, but the oracle breaks first).

**Phase to address:** Go-live.

---

### Pitfall 8: A provider-shaped test key gets the push rejected by GitHub even though gitleaks passed

**What goes wrong:**
GitHub user-level push protection is on by default for public repos and scans every commit in the push; since 2026-10-13 Anthropic API keys (`anthropic_service_api_key`, `anthropic_user_api_key`) are blocked by default on free public repos, alongside OpenAI and many partner patterns. The repo's gitleaks rules and allowlist are not the same ruleset. A future smoke spec or fixture that seeds a "real-format" Anthropic/OpenAI key (the 2026-10-07 lesson asks for real-format keys in at least one test) can pass `pnpm secrets:scan` locally and still be blocked at `git push` with a bypass link that is only valid for three hours. If the owner bypasses with "It's used in tests", GitHub opens a closed alert and the fake key sits in public history looking real.

**Why it happens:**
Two scanners with different pattern sets; the local one is the only one the team has ever seen fail.

**How to avoid:**
- Verified today: `apps/`, `packages/`, `scripts/`, `tooling/` contain zero `sk-ant-…`, `sk-proj-…`, `sk-or-v1-…`, `AIza…`, `ghp_…`, `github_pat_…` strings. Keep it that way with a `secrets:canary`-style test that greps the tree for those prefixes (planted-case non-vacuity, like the existing canary).
- Real keys for any live keyed check come from the owner's browser (HUMAN-UAT) or from `secrets.*` at runtime, never from a committed file. The RentCast seed in `tests/e2e/support/seed.ts` is not a GitHub pattern and is fine.
- Keep the push-protection probe (DEPLOY-CHECKLIST 7.7) as written: a zero-permission, one-day fine-grained PAT, revoked after.

**Warning signs:**
`remote: —— Anthropic API Key ——` in push output; a spec file with a 100-character base64-ish literal.

**Phase to address:** Smoke suite (guard test); Go-live (first push).

---

### Pitfall 9: Real keys leak into CI logs and Playwright traces

**What goes wrong:**
`playwright.config.ts` keeps `trace: 'retain-on-failure'`; traces capture request headers and bodies, including `x-api-key`, `x-goog-api-key` and `Authorization`. The `github` reporter prints assertion values into annotations. If a keyed smoke is run in CI against the live origin with a real key, one failing test uploads the key inside a trace artifact readable by anyone with repo read access (the repo is public).

**Why it happens:**
Copying the E2E config into a smoke config carries the trace setting along.

**How to avoid:**
The live smoke suite has no keyed path; the deployed-origin CORS checks for Anthropic/OpenAI/Gemini (05-HUMAN-UAT H1) stay owner-manual. If a keyed path is ever added: `trace: 'off'`, keys only via `secrets.*`, `echo "::add-mask::$KEY"` before use, no `actions/upload-artifact` of `test-results/`, and `persist-credentials: false` as today.

**Warning signs:**
A smoke spec importing anything from `tests/e2e/support/seed.ts` with a non-fixture value; `upload-artifact` of `test-results` in a job that reads `secrets`.

**Phase to address:** Smoke suite.

---

### Pitfall 10: Load flakes get "fixed" with timeouts, retries and worker counts that only match one machine

**What goes wrong:**
The retrospective already banned blind timeout raises. The new trap is lane design: ReDoS budgets (`fair-housing/mutation.test.ts`, `numbers.property.test.ts`) are wall-clock measurements that fail under CPU burners even as fastest-of-5; `precommit.test.ts` spawns git; `ResultsView.browser.test.ts` chains lazy imports. Playwright's default `workers` is **half the logical cores** (docs), so the owner's 16-core machine runs 8 workers next to a 7-10 GB Chrome and an external llama-server (the memory-reaper kills in the retrospective), while GitHub's `ubuntu-24.04` runner has 4 vCPUs and runs 2. A fix tuned on one machine fails on the other. New Playwright/Vitest configs written for the smoke suite also forget the Windows `System32` PATH guard and reintroduce the silent `taskkill` teardown hang the repo already root-caused.

**Why it happens:**
"Passes in isolation" is treated as proof of a flake (lesson 2026-10-13 says it is not); timing budgets are measured in the wrong unit; config files are copy-pasted.

**How to avoid:**
- Split lanes by **what they measure**, not by how slow they are: `test:unit` (parallel, default), `test:timing` (ReDoS/perf budgets, `fileParallelism: false`, `maxWorkers: 1`, budgets measured with `process.cpuUsage()` or a step counter rather than wall-clock), `test:process` (git/subprocess suites, serial). `pnpm verify` runs all three; CI runs them as separate steps so a red lane names its cause.
- Playwright: `workers: process.env.CI ? 2 : Math.max(1, Math.floor(os.cpus().length / 4))`, documented, with `retries: 1` only in CI and `expect.poll` for anything set by a route handler (existing lesson).
- Before classifying anything as a flake: reproduce under an injected delay (route-level delay on the lazy chunk, `--cpu-throttling`), per the 2026-10-13 rule. `renter-saved.spec.ts:83` is already known to be a real `navigator.locks` `ifAvailable` race, see Pitfall 11.
- Every new Playwright or Vitest-browser config copies the `System32` PATH guard block verbatim (it exists in three files today); add a `scripts/*.test.ts` check that every `playwright.config.ts` and `vitest.browser.config.ts` under `apps/` contains the guard.

**Warning signs:**
A diff that only changes `timeout:` numbers; a lane that passes at `--maxWorkers=1` and fails at default; "hangs for minutes at teardown" on Windows.

**Phase to address:** Test lanes (and Smoke suite for the config guard).

---

### Pitfall 11: The carried saved-search race is "fixed" without mutation-testing the concurrency guard

**What goes wrong:**
10-23 diagnosed `renter-saved.spec.ts:83`: the scheduler takes `navigator.locks` with `ifAvailable`, so a lock held by a page that is unloading makes the check-on-open pass skip as `busy` with no retry. The proposed fix (bounded wait with `AbortSignal`, recompute due searches inside the lock) touches the Phase 4 two-tab proofs ("5 due saved searches run once per 24 h even across two tabs"). A fix that makes the spec green but lets two tabs double-spend RentCast calls is worse than the flake, and a green suite alone does not prove the guard (feedback_migration_verification).

**Why it happens:**
The failing assertion is about UI text ("Checked 1 day ago"), so the natural fix is in the UI layer.

**How to avoid:**
Fix in the scheduler with a RED-first unit test reproducing the unload-while-holding-lock case, then mutation-test: remove the lock, remove the claim-then-run transaction, remove the bounded wait, and prove each mutant fails a test. Re-run the Phase 4 two-tab call-count proofs. Only then touch the E2E.

**Warning signs:**
A PR that changes `renter-saved.spec.ts` and nothing under `lib/data/**`.

**Phase to address:** Debt.

---

### Pitfall 12: Kit 3 codemod gaps that are specific to this repo

**What goes wrong:**
`npx sv migrate sveltekit-3` moves "supported configuration" from `svelte.config.js` into `vite.config.*`, migrates `$app/paths`, `$app/environment` -> `$app/env`, `$app/stores` -> `$app/state`, params and shallow routing, and leaves `@migration-task` comments for the rest. In this repo the leftovers are the dangerous part:
- **Service worker precache.** `serviceWorker.files` (the dotfile filter) does not exist in Kit 3; `$service-worker` is removed in favour of `$app/manifest` (`assets` = "the files in your static directory"). Without a filter, `.nojekyll` enters `ASSETS`, `cache.addAll` is all-or-nothing, and GitHub Pages never serves dotfiles, so the worker fails to install **on the live origin only**. `scripts/serve-pages.mjs` serves whatever exists, so `pwa.spec.ts` keeps passing locally. (`pwa.spec.ts:34` asserts no dotfiles in the precache and would catch it if the emulator refused dotfiles.)
- **`$lib` -> `#lib`.** The codemod rewrites import statements; it cannot rewrite the 54 `$lib` string literals in `eslint.config.js` (DATA_INTERNALS, MAP_LIBS, portal bans), `tooling/import-graph.ts`, `scripts/agent-boundary.test.ts`, `scripts/eslint-rules.test.ts`, `apps/web/components.json`, the Vitest `resolve.alias` entries in `apps/web/vite.config.ts` and `vitest.browser.config.ts`, or `src/lib/testing/app-paths.stub.ts`. Lint groups that match nothing are silently vacuous; the AI-04 import-graph walker and the agent boundary test have planted non-vacuity cases, the ESLint groups mostly do not.
- **`vite.config.ts` branch.** Kit options must now live in `sveltekit({...})`, which this repo only loads in the non-Vitest branch (`isVitest ? [svelte()] : [tailwindcss(), sveltekit()]`), so `csp`, `prerender.entries`, `paths.origin` (renamed from `prerender.origin`), `adapter` all move into that branch; `svelte.config.js` stays for compiler options only. `buildCsp` keeps working (`csp.mode: 'hash'` still exists).
- **`$app/paths`.** `base` and `assets` are removed; one file imports `{ base, resolve }`; the test stub exports both. Pathnames no longer start with `/` for `asset()`.
- **`version.pollInterval`** now defaults to one hour, so every open tab polls `/_app/version.json` hourly; the SW allowlist does not cache it, so it is harmless, but set `0` to keep Kit 2 behaviour unless the smoke suite's version poll (Pitfall 3) wants it.
- **Peers.** `runed@0.37.1` peers `kit ^2.21.0` (verified: it imports nothing from `$app`, so it is a warning, not a break); `runed@0.38.0` peers `^3`; `layerchart@2.9.1` still depends on `runed ^0.37.1` and `bits-ui` on `^0.35.1`, so three runed copies coexist. Do not enable `strict-peer-dependencies`.
- **Audit exceptions.** Three of the four `AUDIT_EXCEPTIONS` are "fixed only in Kit 3"; the migration must delete them from both `scripts/lib/audit-exceptions.mjs` and `pnpm-workspace.yaml audit.ignore` (the equality test enforces both) and regenerate `docs/LAUNCH-AUDIT.md`.

**Why it happens:**
The codemod only "changes patterns it can identify safely"; this repo's safety net is unusually string-literal-heavy.

**How to avoid:**
Before the migration (Debt or Test lanes phase): make `serve-pages.mjs` answer 404 for dotfiles so the emulator matches Pages, and confirm `pwa.spec` still passes. During the migration (Toolchain phase, one branch, no parallel plans): run the codemod, then (1) move the dotfile filter into `service-worker.ts` (`assets.filter(a => !/(^|\/)\./.test(a.path))`) and update `service-worker-guard.test.ts`; (2) a one-shot script replaces `$lib` with `#lib` in the five config/test files and the two Vitest alias blocks, then a **planted-violation sweep**: for every `no-restricted-imports` group, write a throwaway file that violates it and assert `eslint` reports it (extend `scripts/eslint-rules.test.ts`); (3) grep for `@migration-task`, `$service-worker`, `from '$app/paths'` with `base`/`assets`, and `svelte.config.js` kit keys until all are zero; (4) bump `@sveltejs/adapter-static` to 4.x, `runed` to 0.38; (5) run the full `pnpm verify` and the three builds; (6) clear the three Kit audit exceptions. Upgrade to the latest Kit 2.x first for targeted deprecation warnings, as the migration guide recommends.

**Warning signs:**
`pnpm lint` passes with fewer errors than a planted violation should produce; `caches.keys()` on the live origin is empty; `svelte-check` complains about `$lib` in `components.json`-driven files.

**Phase to address:** Toolchain (with the emulator fix landing earlier, in Debt).

---

### Pitfall 13: Vitest 5 changes that silently alter what this suite proves

**What goes wrong:**
From the official migration page, the items that hit this repo:
- `vitest-browser-svelte` 3.x: `render()` **returns a promise**. The 44 `*.browser.test.ts` files call it synchronously; without `await`, locators run against an unmounted component and assertions can pass or fail for the wrong reason.
- `toHaveTextContent` now requires exact equality and rejects regexes (40 uses); partial matches must become `toMatchTextContent`.
- `clearMocks` defaults to `true`: spies are cleared before each test, so any test counting calls accumulated in `beforeAll` or across tests changes meaning.
- Browser-mode automocks (`vi.mock` in 4 browser files) now return `undefined` unless `{ spy: true }`.
- `vi.mock`/`vi.hoisted` inside a function or suite callback now throw.
- `expect.poll` rejects when it does not settle in `timeout` (the suite already relies on polling; this is a good change but may surface latent timeouts).
- `@vitest/browser-playwright@5.0.5` exact-pins `vitest@5.0.5`: `vitest`, `@vitest/browser-playwright`, `vitest-browser-svelte`, and the root `vitest` devDependency move together in one lockfile commit (wave-1 rule).
- Artifact paths move under `.vitest/`; `.gitignore` lists `.vitest-attachments/` and `__screenshots__/` today.
- Fake timers now mock `Temporal`; 13 `useFakeTimers` sites.
- Config lookup no longer searches parent directories (the repo always passes `--config` or runs from the root; verify `pnpm --filter extension test:browser` and `WxtVitest({ root })` under Vitest 5, which is unverified).

**Why it happens:**
Semantic changes without type errors.

**How to avoid:**
Codemod the `await render(` change with a script and assert there are zero bare `render(` calls in browser tests; run the browser project first and alone; grep `toHaveTextContent(/` for regex uses; set `clearMocks: false` only if a specific test needs it and document why; add `{ spy: true }` where automocks were implicit. Treat a browser-test file that gets **faster** after the migration as suspicious (likely unmounted).

**Warning signs:**
Browser project time drops sharply; axe scans report zero nodes; `toHaveTextContent` failures with "expected exact".

**Phase to address:** Toolchain.

---

### Pitfall 14: pnpm 12 breaks the supply-chain test, CI's frozen install and the hardcoded pins

**What goes wrong:**
- Once `packageManager` is `pnpm@12.x`, pnpm records its own version in the lockfile as a **leading YAML document** (`packageManagerDependencies`). `scripts/supply-chain.test.ts:104` asserts "pnpm-lock.yaml is a single YAML document" and fails.
- Changing the pin without regenerating the lockfile makes `pnpm install --frozen-lockfile` fail in CI with `ERR_PNPM_FROZEN_LOCKFILE_WITH_OUTDATED_LOCKFILE`.
- `scripts/build-web.mjs:20` warns on any pnpm other than `11.27.0`; `scripts/launch-audit.test.ts:233` pins `pnpm: '11.27.0'`.
- Unknown keys in `pnpm-workspace.yaml` become `ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS` when the running pnpm satisfies the pin (today's keys `allowBuilds`, `engineStrict`, `audit.ignore` are all recognized; a typo in a future edit is now fatal instead of ignored).
- `engineStrict` enforcement now follows dependency edges, so an optional-dependency subtree can fail the install.
- `--frozen-lockfile false` is no longer accepted.
- Corepack is gone from Node 25; the repo's `engines` (`>=24 <25`) and `.nvmrc` (24) keep it alive for now, but every doc and lesson says `corepack pnpm`. pnpm 12 manages its own version from `packageManager`, and `pnpm/action-setup` (used in CI without a `version` input) reads `packageManager`/`devEngines.packageManager` and "supports pnpm v12".

**Why it happens:**
The lockfile format is "the same" at the version-number level and different at the document level.

**How to avoid:**
One commit: bump `packageManager`, run `pnpm install` (not frozen) on a clean clone, commit the regenerated two-document lockfile, replace the single-document assertion with "the last YAML document holds `importers`" (keep the intent: no stray documents beyond the boot one), replace the two `11.27.0` literals with a read of `package.json#packageManager`, run `pnpm verify`. Decide the Corepack exit now: document `npm i -g pnpm@<pin>` (pnpm self-switches to the pinned version) and stop writing `corepack pnpm` in new docs. Record `minimumReleaseAge` as an optional supply-chain hardening in the same phase (pnpm 12 setting; not required).

**Warning signs:**
`supply-chain.test.ts` red with "single YAML document"; CI red at `pnpm install --frozen-lockfile`; `build-web: pnpm 12.x found; pinned version is 11.27.0`.

**Phase to address:** Toolchain.

---

### Pitfall 15: Edge Add-ons certification fails on listing details, not on code

**What goes wrong:**
Partner Center requirements (publish-extension page, 2026-09) and developer policies (2026-07) that this submission can trip:
- **Testability (policy 1.3).** Today only the ad-slot `li`s dim on live zillow.com; label-bearing cards do not exist. A reviewer who opens a random Zillow page sees nothing happen and fails "fully functional" unless **Notes for certification** gives a reproducible search URL, explains that ad slots are the visible effect, and shows where the count appears.
- **Other browsers (policy 1.1.2).** The listing "must not reference other browsers". `apps/extension/store/edge-listing.md` is clean; `docs/EXTENSION-INSTALL.md` (reused verbatim as GitHub Release notes) mentions Chrome and Brave. Never paste it into Partner Center.
- **Third-party name (policy 2.2).** The name "Sponsored Listing Filter — for Zillow" uses a trademark; the policy accepts a disclaimer "if not created or appropriately licensed". Keep "Not affiliated with or endorsed by Zillow Group" in the first screen of the description, not only at the end.
- **Assets.** Logo 1:1, 300x300 recommended (min 128); screenshots max **6**, exactly 640x480 or 1280x800, "clear, not stretched or blurry", taken in Edge; description 250-10,000 characters (the current copy is about 900, fine). The manifest `name`/`description`/`short_name` are read-only in Partner Center; changing them means a new zip.
- **Privacy.** The privacy URL must be reachable at submission, which depends on Go-live (11-HUMAN-UAT item 5). The data-usage checkboxes must match "collects nothing" and the privacy page text; a mismatch is a stated rejection cause.
- **Version.** `0.1.0` is valid (1-4 dot-separated integers, each 0-65535, not all zero); every resubmission after a package change needs a **higher** version, so a failed certification costs a version bump and a new tag.
- Certification "can take up to seven business days"; plan the milestone gate around that, not the submission.

**Why it happens:**
The code is proven (zero-network oracle, axe); the listing is prose and images nobody has reviewed against the policy text.

**How to avoid:**
Make `edge-listing.md` carry a "Notes for certification" section with the Zillow search URL, the expected visible effect, and the popup count; add a store-copy test that fails on "Chrome", "Firefox", "Brave", "Safari" in `edge-listing.md`; produce the six screenshots from the real build in Edge at 1280x800 and check dimensions in a test (`scripts/extension-docs.test.ts` already pins docs; extend it to PNG dimensions); schedule the submission after the privacy URL is live; keep `version` bump + tag in one commit.

**Warning signs:**
Rejection mail citing 1.1.2/1.3/2.2; "Fields require your attention" on screenshot sizes.

**Phase to address:** Extension release (after Go-live).

---

### Pitfall 16: The Release zip, the store zip and `HEAD` are three different artifacts

**What goes wrong:**
`extension-release.yml` checks that the tag equals `apps/extension/package.json` `version` and rebuilds from the tag, but nothing checks that the tag is reachable from `main`, so a tag on a stray branch publishes a Release that CI never fully verified. The owner may then upload a **locally** built zip to Partner Center (the checklist offers both), so the bytes users install from the store differ from the Release zip whose SHA256 is published, and nobody can prove which code is live. `assert-extension.mjs` verifies `manifest.json` at the zip root and scans text for network primitives; it has no file-type allowlist, so a `.map`, a stray `.ts`, `.env`, or a `node_modules/` folder in the zip would pass. If `EXTENSION_RELEASES_ENABLED` is set after the tag is pushed, the run is skipped and re-pushing the same tag is a no-op.

**Why it happens:**
The workflow was written and tested without a remote.

**How to avoid:**
Add to the release job: `git fetch origin main --depth=1 && git merge-base --is-ancestor "$GITHUB_SHA" origin/main` (fails on tags off `main`), and an oracle check that the zip's `manifest.json` `version` equals `${GITHUB_REF_NAME#ext-v}`. Extend `assert-extension.mjs` with a zip entry allowlist (`manifest.json`, `*.js`, `*.css`, `*.html`, `icon/*.png`, `_locales/**`) and a deny on `*.map`, `*.ts`, `.env*`, `node_modules/`, with a planted-violation test. Make the Partner Center upload the **Release** zip (downloaded, `sha256sum -c`), record the hash in 11-HUMAN-UAT item 6, and remove the "or a local build" wording from the checklist. Document the variable-before-tag order and the recovery (`git push --delete origin ext-v0.1.0`, retag).

**Warning signs:**
Release assets without a matching commit on `main`; store listing version equals the Release but file size differs.

**Phase to address:** Extension release.

---

### Pitfall 17: Go-live happens before the smoke suite exists, and Kit 3 lands while go-live is still moving

**What goes wrong:**
The owner wants to push early (decision 2026-10-29). If the smoke suite is not runnable against `serve-pages.mjs` before that push, the 77 HUMAN-UAT rows get walked by hand once, the deferred checks become folklore, and every later deploy is "boring" only in the sense that nobody checks it. If the Kit 3 migration starts while the first deploy is still being debugged, every live symptom has two candidate causes (Pages vs migration), and the migration's codemod touches hundreds of files, so any debt fix that lands afterwards is a rebase through noise and `git blame` for the debt items is lost. The milestone already says "Kit 3 after the debt is cleared"; the risk is a wave schedule that overlaps them.

**Why it happens:**
Both the push and the migration are "big, exciting" items with owner momentum.

**How to avoid:**
Order: **Go-live** (which ships the smoke suite's local stand-in mode as its first plan, then the owner pushes, then the live smoke run is the phase gate) -> **Smoke suite** hardening (CI job, version poll, flags) -> **Debt** (including the emulator dotfile fix and the scheduler race) -> **Test lanes** -> **Toolchain** (one branch, one wave, no other plans) -> **Extension release** (needs the live privacy URL; independent of Toolchain, so it can run as soon as Go-live is green). Put "no plan from another phase executes while Toolchain is in flight" into the roadmap.

**Warning signs:**
A phase plan that mentions both `deploy-pages` and `sv migrate`; debt commits rebased over the migration.

**Phase to address:** Milestone roadmap (ordering), with the smoke stand-in as the first Go-live plan.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Push first, strip the 145 trailers "later" | Owner sees the site today | Force-push to a public default branch; hashes in MILESTONES/SUMMARY files invalidated twice; forks/caches keep the old history | Never |
| Keep the SHA-based gitleaks allowlist after a rewrite and bypass the red hygiene job | Deploy goes through | A permanently red or disabled history scan | Never |
| Retry the smoke job until the CDN catches up | Green badge | Hides real deploy failures behind cache timing | Never; poll `version.json` instead |
| Re-run the flaky E2E with `retries: 2` | Suite green | Real races (saved-search lock, lazy-tour overwrite) ship to users | Never (lesson 2026-10-13) |
| Keep `$lib` alive through Kit 3's deprecated `alias` | Zero churn in 165k lines | Two import spellings forever; `alias` is deprecated and goes away in Kit 4; shadcn-svelte CLI expects `#lib` | Only as a one-day bridge inside the migration branch |
| Delete `supply-chain.test.ts` "single YAML document" assertion | Unblocks pnpm 12 | Loses the "no injected lockfile document" supply-chain check | Never; rewrite it for the two-document shape |
| Upload a locally built zip to Partner Center | Skips waiting for the Release workflow | Store bytes ≠ published SHA256; no provenance | Never |
| Submit the form from the smoke suite on every push | GTM-02 "proven" continuously | 250/month quota gone; real users see failures | Never; one gated owner run |
| Set `PAGES_ENABLED` before the Pages source | One fewer click | `deploy-pages` 404s on the first run | Never |
| Keep `corepack pnpm` in docs after pnpm 12 | No doc churn | Node 25 bump strands every instruction | Until the Toolchain phase; fix there |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub Pages (org root) | Repo named anything but `tranrealestate.github.io`; repo initialised with a README; expecting custom response headers or HSTS from us | Empty public repo with the exact name; HTTPS is automatic for `github.io` (docs); CSP stays a `<meta>`; `.nojekyll` harmless with Actions |
| GitHub Pages CDN | Smoke immediately after deploy; asserting `cache-control` headers | `max-age=600` via Fastly; poll `/_app/version.json` for the expected SHA before asserting |
| `actions/deploy-pages` | Deploy job gated on a variable set after the push; Pages source not "GitHub Actions" | Source first, variable second, then push (or an empty commit); read `outputs.page_url` for the smoke job |
| GitHub secret scanning | Trusting gitleaks as the only scanner | User-level push protection is on by default for public repos; Anthropic keys blocked by default since 2026-10-13; bypass link valid 3 h; probe only with a throwaway PAT |
| Umami Cloud | Host = `https://cloud.umami.is` | Host = the origin the script POSTs to (`https://gateway.umami.is` today); bot UAs are dropped with 200; `no-cors` hides 404s; owner checks the dashboard from a normal browser |
| Web3Forms | Live submissions from automation; captcha on | 250/month, stops at 100%, no sandbox documented; captcha must stay OFF (CSP); default-deny in smoke with one owner-gated run |
| Google Search Console | DNS method; HTML-file method in `static/` | Meta-tag method after `%sveltekit.head%`; sitemap "couldn't fetch" is pending for hours, not failure |
| Edge Partner Center | Pasting `EXTENSION-INSTALL.md` (mentions Chrome/Brave); screenshots of odd sizes; empty "Notes for certification" | `edge-listing.md` only; 640x480 or 1280x800, max 6; notes with a Zillow search URL and the expected ad-slot effect; up to 7 business days |
| GitHub Releases workflow | Tag pushed before `EXTENSION_RELEASES_ENABLED`; tag off `main` | Variable first; `merge-base --is-ancestor` check; delete + retag to re-trigger |
| `pnpm/action-setup` | Passing `version:` that conflicts with `packageManager` | Omit `version`; the action reads `packageManager` and supports pnpm 12 |
| SvelteKit 3 `$app/manifest` | Assuming `assets` excludes dotfiles | Filter dotfiles in the worker; make the emulator 404 dotfiles so the test can catch it |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Playwright default workers = half the logical cores | Memory-reaper kills on the 16-core owner box beside Chrome and llama-server; 6 timeouts at 8 workers | `workers` derived from cores/4 locally, 2 in CI; shard the 22-minute suite | Any machine with < 1 GB free per worker |
| Wall-clock ReDoS budgets in the parallel lane | 2-3 ms scans measured at 153 ms under load | Separate `test:timing` lane, serial, CPU-time or step-count budgets | Whenever CI or the owner box is contended |
| Smoke suite that walks all 42 routes with axe against the live origin | Minutes per run, Pages 429 rate limiting under parallel workers | Smoke = contract checks + 3 short journeys; the full axe suite stays local/CI against the emulator | > ~4 parallel workers against Pages |
| Kit 3 `version.pollInterval` default 1 h | Hourly `/_app/version.json` request per open tab | Set `0`, or accept (not cached by the SW) | Negligible at this scale; noted for completeness |
| Hourly `pnpm audit` drift (retrospective) | Close-out red on untouched pins | Run `audit:deps` first in every Toolchain and Extension-release plan | Every few weeks |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Real provider keys in smoke specs or CI variables (`PUBLIC_*` are public by design) | Key in public history or page source | Keys only from the owner's browser or `secrets.*`; grep guard for provider prefixes; never a Variable |
| `trace: 'retain-on-failure'` in a keyed live run | Key inside an uploaded trace | No keyed live path; if ever, `trace: 'off'`, `::add-mask::`, no artifact upload |
| Asserting CSP from response headers on Pages | False confidence (the header you see is GitHub's 404 page) | Assert the `<meta>` content like `assert-csp` |
| Letting `.nojekyll`/dotfiles into the SW precache after Kit 3 | Worker never installs; offline launch and PWA promises silently void | Filter in the worker + emulator fidelity + `pwa.spec:34` |
| Bypassing push protection with "It's used in tests" | Realistic-looking key in public history; closed alert nobody reads | Remove the string; use clearly fake shapes that are not partner patterns |
| Edge data-usage declarations that differ from the privacy page | Rejection, or worse, a published listing that misstates data handling | One source of truth (privacy page text) reviewed against the Partner Center checkboxes |
| Release zip with source maps or `.env` | Source exposure; store rejection | Zip entry allowlist in `assert-extension.mjs` |
| Rewriting history after the push | Force-push on a public repo; clones diverge | Rewrite before `git remote add` (Pitfall 1) |

## UX Pitfalls

Owner- and reviewer-facing experience during this milestone (end-user UX is unchanged).

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Owner tests redeploys in a browser with the old SW | "Umami broken", "CSP blocks the beacon", wrong cut-line decision | Fresh profile/InPrivate for every live check; surface the build version in Settings |
| Edge reviewer sees "nothing happens" on Zillow | Certification failure, 7-business-day retry | Notes for certification with a search URL and the expected ad-slot dimming |
| Smoke failures that name the CDN instead of the deploy | Alert fatigue, ignored red runs | Version poll first; distinct exit codes for "not propagated" vs "assertion failed" |
| HUMAN-UAT rows written as free text | 77 rows get walked once, never again | Each row either becomes a smoke assertion or is tagged "human-only" with the reason |
| Search Console "Couldn't fetch" minutes after submit | Owner believes the sitemap is broken | Checklist says "re-check after 24-72 h" |
| Showcase-badge / budget-trim decisions reopened mid-milestone | Scope creep into product changes | Park in backlog; the milestone's out-of-scope line already excludes portal features |

## "Looks Done But Isn't" Checklist

- [ ] **First push:** Often missing the trailer strip and allowlist re-derivation. Verify `git log --format='%(trailers:key=Co-Authored-By)' | grep -c .` = 0 and `pnpm secrets:scan` green **before** `git remote add`.
- [ ] **Pages deploy:** Often "enabled" with the deploy job skipped. Verify the Actions run shows `deploy` succeeded and `page_url` is set; `curl -sI https://tranrealestate.github.io/ | grep -i cache-control` returns `max-age=600`, not GitHub's 404.
- [ ] **Smoke suite:** Often asserts the previous build. Verify it polls `/_app/version.json` for the expected SHA and that `kit.version.name` is `GITHUB_SHA` in CI.
- [ ] **Umami:** Often the wrong host. Verify `curl -X POST <host>/api/send …` returns JSON with `cache`, the privacy page names the same host, and a non-headless browser produces a dashboard pageview.
- [ ] **Web3Forms:** Often proven by automation. Verify exactly one owner submission per form and the dashboard count moved by one.
- [ ] **Search Console:** Often attempted via a root HTML file. Verify the meta tag sits after `%sveltekit.head%` and `csp:assert` is green.
- [ ] **Load flakes:** Often "fixed" by timeouts. Verify each fix has a RED reproduction under injected delay and that `test:timing` runs serially.
- [ ] **Saved-search race:** Often fixed in the spec. Verify the scheduler change has mutation-tested guards and the two-tab call-count proofs still pass.
- [ ] **Kit 3:** Often green lint that proves nothing. Verify the planted-violation sweep fires every `no-restricted-imports` group and `grep -rn '\$lib' eslint.config.js tooling scripts apps/web/components.json` is empty.
- [ ] **Kit 3 service worker:** Often passes locally only. Verify `serve-pages.mjs` 404s dotfiles and `caches.keys()` on the live origin contains `tran-shell-<sha>`.
- [ ] **Vitest 5 browser tests:** Often faster and emptier. Verify zero bare `render(` calls and no `toHaveTextContent(/regex/)`.
- [ ] **pnpm 12:** Often CI red at install. Verify the regenerated two-document lockfile is committed with the pin, and no `11.27.0` literal remains.
- [ ] **Extension release:** Often a tag off `main` or a local zip in the store. Verify `merge-base --is-ancestor`, the Release SHA256 recorded in 11-HUMAN-UAT, and the zip entry allowlist.
- [ ] **Edge listing:** Often rejected for prose. Verify no other browser names in `edge-listing.md`, six screenshots at a legal size, notes for certification present, privacy URL live.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Trailers pushed to the public repo | MEDIUM (within minutes, nobody has cloned) to HIGH (after forks/indexing) | Rewrite, force-push `main`, re-derive gitleaks SHAs, remap SUMMARY hashes by subject, add the CI trailer guard |
| `deploy-pages` 404 / deploy skipped | LOW | Set Source = GitHub Actions, confirm the variable, push an empty commit |
| Wrong Umami host deployed | LOW | Change the two variables, redeploy, owner closes every Tran tab, re-check from a fresh profile |
| Web3Forms quota exhausted by automation | MEDIUM (wait for month rollover or rotate the key) | Rotate the access key in the dashboard, update the variable, redeploy, add the default-deny |
| Smoke suite flaky against the CDN | LOW | Add the version poll; separate "not propagated" from "failed" |
| Kit 3 lints vacuous | MEDIUM | Planted-violation sweep; fix groups; re-run `pnpm lint` on a deliberately violating fixture |
| Kit 3 SW fails to install live | LOW once noticed | Filter dotfiles in the worker, redeploy; fix the emulator so it cannot recur |
| pnpm 12 frozen-install red | LOW | `pnpm install` unfrozen on a clean clone, commit lockfile, rerun |
| Edge certification failed | MEDIUM (version bump + up to 7 business days) | Fix listing/notes, bump `version`, new tag, new Release, resubmit the Release zip |
| Release workflow skipped (variable set late) | LOW | `git push --delete origin ext-v0.1.0`, set the variable, re-push the tag |
| Push blocked by GitHub push protection | LOW | Remove the string (or re-shape the fake key), amend/rebase, push; never bypass |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Trailers + gitleaks SHA allowlist | Go-live (pre-push) | Trailer count 0; `secrets:scan` green post-rewrite; CI trailer guard present |
| 2 Pages enablement order | Go-live | `deploy` job succeeded; `page_url` set; live `cache-control: max-age=600` |
| 3 CDN staleness / wrong build | Smoke suite (+ Go-live for `version.name`) | Smoke logs show the version poll converging on `github.sha` |
| 4 Stale SW in the owner's browser | Smoke suite + Go-live UAT wording | `caches.keys()` contains `tran-shell-<sha>`; UAT rows say "fresh profile" |
| 5 Umami host / bot filter | Go-live (checklist) + Smoke suite | Beacon URL origin equals the configured host; owner dashboard pageview from a normal browser |
| 6 Quota burn / analytics pollution | Smoke suite | Zero `api.web3forms.com` requests without `--allow-forms`; GPC injected by default |
| 7 Search Console vs CSP oracle | Go-live | Meta tag after `%sveltekit.head%`; `csp:assert` green; property verified |
| 8 Provider-shaped keys blocked at push | Smoke suite guard + Go-live | Grep guard test with planted case; first push accepted |
| 9 Keys in traces/logs | Smoke suite | No keyed path; config review |
| 10 Lanes, workers, PATH guard | Test lanes (+ Smoke suite config) | Three lanes in `verify`; config guard test; no flake fixed by timeout alone |
| 11 Saved-search lock race | Debt | RED-first unit test; mutation ledger; two-tab proofs green |
| 12 Kit 3 codemod gaps | Toolchain (emulator fix in Debt) | Planted-violation sweep; zero `$lib` literals; live SW cache key present |
| 13 Vitest 5 semantics | Toolchain | Zero bare `render(`; no regex `toHaveTextContent`; browser project runtime sane |
| 14 pnpm 12 lockfile/pins | Toolchain | Two-document lockfile committed; no `11.27.0` literals; CI frozen install green |
| 15 Edge listing/certification | Extension release | Store-copy test; screenshot dimension test; notes for certification; listing live |
| 16 Release provenance | Extension release | `merge-base` check; manifest-version-equals-tag check; zip allowlist with planted case; SHA256 recorded |
| 17 Ordering (smoke before push, Kit 3 isolated) | Roadmap | Phase order as listed; Toolchain is a single-phase wave |

## Sources

**Repository (HIGH):** `.planning/PROJECT.md`, `MILESTONES.md`, `STATE.md`, `RETROSPECTIVE.md`, `tasks/lessons.md`, `milestones/v1.0-MILESTONE-AUDIT.md`, `docs/DEPLOY-CHECKLIST.md`, `docs/EXTENSION-INSTALL.md`, `.github/workflows/ci.yml`, `.github/workflows/extension-release.yml`, `apps/web/svelte.config.js`, `apps/web/vite.config.ts`, `apps/web/vitest.browser.config.ts`, `apps/web/playwright.config.ts`, `apps/web/src/service-worker.ts`, `apps/web/src/lib/site-config.js`, `apps/web/src/lib/csp-policy.js`, `apps/web/src/lib/analytics/beacon.test.ts`, `apps/extension/wxt.config.ts`, `apps/extension/store/edge-listing.md`, `scripts/assert-csp.mjs`, `scripts/assert-extension.mjs`, `scripts/supply-chain.test.ts`, `scripts/build-web.mjs`, `scripts/lib/audit-exceptions.mjs`, `.gitleaks.toml`, `pnpm-workspace.yaml`, phase 10/11 HUMAN-UAT and deferred-items files; `git log` trailer and grep counts run 2026-10-29.

**Registry (HIGH, `npm view` 2026-10-29):** `@sveltejs/kit` 3.1.0 (peers vite ^8.0.12, svelte ^5.57.1, TS ^6, node >=22.17; bin `svelte-kit` present), `@sveltejs/adapter-static` 4.0.0, `vitest` 5.0.5, `@vitest/browser-playwright` 5.0.5 (exact vitest peer), `vitest-browser-svelte` 3.1.0, `pnpm` 12.16.1, `runed` 0.37.1 (peer kit ^2.21.0, no `$app` imports in dist) / 0.38.0 (peer kit ^3), `layerchart` 2.9.1 (dep runed ^0.37.1), `bits-ui` 2.20.2 (dep runed ^0.35.1), `wxt` 0.21.5, `svelte-check` 4.7.7, `eslint-plugin-svelte` 3.23.1.

**Official docs (HIGH unless noted):**
- [SvelteKit: Migrating to SvelteKit 3](https://svelte.dev/docs/kit/migrating-to-sveltekit-3), [Configuration (Kit 3)](https://svelte.dev/docs/kit/configuration), [$app/manifest](https://svelte.dev/docs/kit/$app-manifest), [adapter-static](https://svelte.dev/docs/kit/adapter-static), [sv migrate](https://svelte.dev/docs/cli/sv-migrate)
- [Vitest: Migration Guide (4 -> 5)](https://vitest.dev/guide/migration)
- [pnpm 12.0 release](https://pnpm.io/blog/releases/12.0), [pnpm lockfile (two-document format)](https://pnpm.io/lockfile), [pnpm settings](https://pnpm.io/settings), [pnpm/action-setup README](https://github.com/pnpm/action-setup)
- [GitHub: About push protection](https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection), [Working with push protection from the command line](https://docs.github.com/en/code-security/secret-scanning/working-with-secret-scanning-and-push-protection/working-with-push-protection-from-the-command-line), [Changelog 2026-10-13: Anthropic keys blocked by default](https://github.blog/changelog/2026-10-13-secret-scanning-blocks-anthropic-keys-by-default-adds-salesforce) (MEDIUM: changelog summary via search)
- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [Securing your GitHub Pages site with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https), [What is GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [actions/deploy-pages README](https://github.com/actions/deploy-pages)
- [Google Search Console: Verify your site ownership](https://support.google.com/webmasters/answer/9008080)
- [Microsoft Edge: Publish an extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension), [Update an extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/update-extension), [Developer policies for Edge Add-ons](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies)
- [Chrome: manifest `version`](https://developer.chrome.com/docs/extensions/reference/manifest/version)
- [Playwright: TestConfig.workers](https://playwright.dev/docs/api/class-testconfig), [Parallelism](https://playwright.dev/docs/test-parallel)
- [WXT: Publishing](https://wxt.dev/guide/essentials/publishing.html) (MEDIUM: does not document zip contents)
- [Umami Cloud tracker script](https://cloud.umami.is/script.js) (fetched today: default host `https://gateway.umami.is`), [Umami `/api/send` route source](https://raw.githubusercontent.com/umami-software/umami/master/src/app/api/send/route.ts) (`isbot` drop, `DISABLE_BOT_CHECK`)
- Live probes 2026-10-29 (HIGH for today's state): `POST https://cloud.umami.is/api/send` -> 404; `curl -sI https://wolfwdavid.github.io/<site>/` -> `Cache-Control: max-age=600`, `Via: 1.1 varnish`, `X-Cache`, `X-Fastly-Request-ID`.

**Secondary (LOW):** Web3Forms free-tier accounting (250/month, stop at 100%) from third-party comparisons; Edge rejection folklore (vague feedback, screenshot mismatches) from blogs. Treat as leads, verify against Partner Center feedback and the Web3Forms dashboard.

---
*Pitfalls research for: Tran Real Estate Tools, milestone v1.1 Launch & Hardening*
*Researched: 2026-10-29*
