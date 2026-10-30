# Phase 13: Live Origin: First CI Run, First Deploy, Post-Deploy Smoke & UAT Burn-down - Research

**Researched:** 2026-10-29
**Domain:** GitHub Actions (`workflow_run`, Pages deploy/rollback), GitHub Pages project-site behaviour on a shared origin, sub-path base wiring through CI/E2E/extension, live GTM proofs, human-UAT consolidation
**Confidence:** HIGH for repo facts, GitHub run/Pages state (read live with `gh`, read-only) and action inputs (read from the pinned `action.yml` files); MEDIUM for CDN propagation and rollback-by-rerun; LOW items are flagged inline.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
(Copied verbatim from `13-CONTEXT.md` `<decisions>`.)

#### Origin and base path mechanism (the sub-path deploy)
- **D-01:** `PUBLIC_SITE_URL` stays an https **origin with no path** (the `site-config.js` validator is
  not loosened). The owner sets the repository variable `PUBLIC_SITE_URL=https://wolfwdavid.github.io`.
  The handoff's `.../tran_real_estate` value is wrong and must not be used.
- **D-02:** The base path becomes an owner knob: a new repository variable **`BASE_PATH`** (value
  `/tran_real_estate`), read by the **root (deploy) leg only** in `ci.yml` (`BASE_PATH: ${{ vars.BASE_PATH }}`
  on Build, CSP oracle, SEO oracle, budget, E2E and extension steps) and by `extension-release.yml`.
  `targetEnv('root')` passes `env.BASE_PATH` through `resolveBasePath` instead of forcing `''`; unset
  still means `''`, so the org-root layout stays a valid configuration. The `sub` target keeps its
  hard-coded `/tran_real_estate` with blank owner settings (it is the proof that a non-root base path
  works regardless of owner variables) and the `configured` target keeps `''`.
- **D-03:** `DEFAULT_SITE_ORIGIN` changes to `https://wolfwdavid.github.io` (drop the "never
  wolfwdavid.github.io" comment; test fixtures that pin the old org string follow by substitution). With
  that, the local `sub` build served by `scripts/serve-pages.mjs` at `/tran_real_estate/` is an exact
  stand-in for production paths. The privacy page, `docs/EXTENSION-INSTALL.md`,
  `apps/extension/store/edge-listing.md` and `docs/DEPLOY-CHECKLIST.md` are edited to the real URL.
- **D-04:** The extension's `PRIVACY_URL` (and the `assert-extension.mjs` allowlist entry) must be
  **origin + base path** + `/legal/privacy/#browser-extension`, derived from one shared helper in the
  web app's plain-JS config layer (origin from `PUBLIC_SITE_URL`, path from `BASE_PATH`) so a wrong
  combination is impossible. `scripts/site-url.test.ts` gains the base-path case (changing `BASE_PATH`
  alone changes the extension privacy URL and the web canonical/sitemap/OG URLs).
- **D-05:** PROJECT.md's Out-of-scope line "Hosting under the shared `wolfwdavid.github.io` origin" is
  marked superseded by the 2026-10-29 decision (storage shared with sibling project sites, accepted by
  the owner; revisit with a custom domain). The smoke, the CSP and the key vault are unchanged by this.

#### Dependabot triage (surfaced by the first live CI runs)
- **D-06:** `.github/dependabot.yml` ignores **major** updates for the Phase 16 toolchain set
  (`@sveltejs/kit`, `@sveltejs/adapter-static`, `vitest`, `@vitest/*`, `vitest-browser-svelte`, and
  `pnpm` if it ever appears) with a comment naming Phase 16; the weekly minor/patch group stays.
- **D-07:** The open major PRs (#2, #3, #5, #6) are **closed** with a one-line comment pointing at
  Phase 16. The failing 20-package minor/patch group PR (#4) and `@types/node` 24 -> 26 (#7, a major)
  are closed too; their bumps are re-evaluated in Phase 14/16 by the normal `pnpm audit` gate, not merged
  blind in this phase. The `actions/setup-node` 7.0.0 -> 7.1.0 PR (#1) is merged only if its CI is green
  and `scripts/workflow-gate.test.ts` still passes on that tree; otherwise closed.
- **D-08:** No dependency pin changes in Phase 13 beyond what a red CI run forces at the root cause.

#### `live-smoke.yml` shape (SMOKE-04)
- **D-09:** Triggers: `workflow_run` on `workflows: [ci]`, `types: [completed]`, and
  `workflow_dispatch` with inputs `base_url` (required, trailing slash) and `expect_version`
  (optional 40-hex; default = the SHA of the dispatched ref). The job runs only when the `ci` run
  concluded `success`, its `head_branch` is `main`, and `vars.PAGES_ENABLED == 'true'`; otherwise it is
  skipped exactly like the `deploy` job (no red runs while Pages is off).
- **D-10:** The deployed SHA is `github.event.workflow_run.head_sha`; the workflow checks out **that
  SHA** (not the default branch) so the smoke specs match the deployed build. Smoke env:
  `SMOKE_BASE_URL = vars.PUBLIC_SITE_URL + vars.BASE_PATH + '/'`, `SMOKE_SITE_URL` the same,
  `SMOKE_EXPECT_VERSION = head_sha`, `SMOKE_ANALYTICS_HOST = vars.PUBLIC_ANALYTICS_HOST`; then `pnpm smoke`
  (remote mode: 10-minute version poll, 2 workers in CI, zero retries, `--fail-on-flaky-tests`).
- **D-11:** `permissions: contents: read` only. Pinned-SHA actions only: the same checkout, pnpm and
  setup-node pins as `ci.yml`, plus `actions/upload-artifact` (pinned) to upload the Playwright report
  and traces **on failure** with a 14-day retention. `ci.yml`'s `uses:` count stays exactly 7; the new
  workflow has its own gate test `scripts/live-smoke-gate.test.ts` (same shape as `workflow-gate.test.ts`:
  triggers, head_sha source, conditions, pins, env wiring, no third-party URLs) and `pnpm lint:workflows`
  covers it.
- **D-12:** The one GPC-off analytics spec sends exactly one page-view beacon per smoke run, so every
  deploy adds one synthetic `/` pageview to Umami. Accepted; the runbook says so and tells the owner to
  read counts as a lower bound anyway. No other smoke traffic is counted (GPC on everywhere else).
- **D-13:** The research flags are verified against the live origin during the first deploy and
  recorded in the SUMMARY: Pages serves `404.html` with HTTP 404 (not 200), the `workflow_run`
  payload carries `head_sha`, `http://` redirects to `https://` (Pages API already reports
  `https_enforced: true`).

#### GitHub-side actions: who does what
- **D-14:** Repository variables, pushes to `main`, PR closures/merges and any Pages setting are
  **owner checkpoints**: the plan prints the exact `gh variable set ...` / `git push` / `gh pr close`
  command, the executor stops at a checkpoint, the owner runs it (or explicitly approves the executor
  running it under the already-authenticated `gh` session) and reports back. Executors never push or
  set variables on their own. Order inside the phase: code changes for D-02/D-04/D-06 and
  `live-smoke.yml` land and go green on `main` first; then `PUBLIC_SITE_URL`, `BASE_PATH` and the launch
  variables; then `PAGES_ENABLED=true` + `git commit --allow-empty -m "chore: go live"` + push.
- **D-15:** The first deploy is observed end to end: `deploy` job green, `live-smoke` run green on the
  same SHA, then the fresh-profile human checks of success criterion 2 (landing, `/renter` -> `/renter/`,
  deep-route refresh, branded 404 with HTTP 404, HTTPS) recorded in the proof bundle.

#### GTM proofs and cut lines (LIVE-06, LIVE-05 live half)
- **D-16:** Order: (1) Umami, because it carries the only cut line; (2) Web3Forms waitlist on
  `/for-renters/` + one `/feedback/` message; (3) share cards in the LinkedIn Post Inspector and the
  Facebook Sharing Debugger for `/tools/cap-rate/`; (4) Search Console last, because the meta token is a
  source commit (`apps/web/src/app.html`, pinned slot, `scripts/app-html.test.ts`) and needs one more
  deploy, then Verify + submit `sitemap.xml` and confirm it is read with 14 URLs.
- **D-17:** Umami preconditions kept from the checklist: IP storage confirmed off in Umami settings
  before the variables are set; the `curl` probe against `https://gateway.umami.is/api/send` with the
  real website id returns 200 JSON; two pageviews from a fresh GPC-off profile arrive; none arrive with
  GPC on. If no pageviews arrive from the deployed origin: apply the cut line (remove both variables,
  redeploy, GTM-04 -> v2 in REQUIREMENTS.md, decision in PROJECT.md Key Decisions).
- **D-18:** Every live check follows the fresh-profile rule (new InPrivate/Incognito window after every
  redeploy). If the owner has no Facebook account, the LinkedIn inspector plus one additional public
  card validator is recorded as the substitute, with the substitution noted in the ledger.

#### UAT ledger, launch-proof bundle, runbook (LIVE-07, LIVE-09)
- **D-19:** One ledger at `.planning/HUMAN-UAT.md`. Columns: id, origin phase + row id, title,
  classification (`smoke` = closed by a smoke spec with the run link; `human` = done by the owner with
  result and proof link; `owner-decision` = recorded decision; `cut` = out of v1.1 with reason), result,
  evidence link. The twelve per-phase `*-HUMAN-UAT.md` files are **kept** (history) with a frontmatter
  `status: superseded` and a pointer to the ledger. The planner enumerates every row across the twelve
  files (formats differ: `### N.`, `### UAT-N.`, `### A.`), reconciles the count to the roadmap's 77 or
  records the real count with the counting rule, and never drops a row.
- **D-20:** Launch-proof bundle under `docs/launch-proof/2026-MM-DD/` with a `README.md` index (deployed
  SHA, run links for ci / deploy / live-smoke, timestamps, who captured what) and PNG screenshots named
  by check. No PII: e-mail addresses and dashboard account details are redacted before commit; subject
  lines and counts stay. Screenshots Playwright can take (landing, redirect, 404, version.json) are
  produced by a tiny script in the smoke harness or by the smoke run artifacts; dashboard screenshots
  (Umami, Web3Forms inbox, debuggers, Search Console) are the owner's. Keep the bundle under 5 MB.
- **D-21:** `docs/RUNBOOK.md` is the owner's operational doc (DEPLOY-CHECKLIST stays the one-time go-live
  record, rewritten to the personal-account reality with a "completed 2026-10-29" marker on Steps 1-6).
  Runbook sections: variables table (names, example values, which leg reads them); redeploy (empty
  commit); roll back (preferred: `git revert` + push; alternative: re-run the previous green run's
  `deploy` job, with the Pages artifact retention caveat); read a `live-smoke` result (where the report
  artifact is, what exit codes 2/3/4 of `scripts/smoke.mjs` mean); run the suites locally with the
  known-good worker counts (dev machine and CI values recorded from `playwright.config.ts`,
  `playwright.smoke.config.ts` and the Vitest configs); the fresh-profile rule; the Dependabot policy
  (D-06/D-07); the one-synthetic-pageview-per-deploy note (D-12).
- **D-22:** `docs/LAUNCH-AUDIT.md` is regenerated with `pnpm audit:launch` at the deployed commit with
  `PUBLIC_SITE_URL` and `BASE_PATH` set, so its "Base URL audited" line names the live origin; it is
  never edited by hand.

### Claude's Discretion
- Exact names/shape of the shared origin+base helper (D-04) and where it lives (`site-config.js` is the
  natural home), as long as web and extension read the same function.
- Whether `live-smoke.yml` uses one job or two (poll, then test); the matrix is not needed.
- How the Playwright-produced proof screenshots are generated (a smoke-side script vs. the failure
  artifacts), as long as they are reproducible from the deployed SHA.
- Ledger table layout details and the exact `docs/launch-proof/<date>/` file names.
- CI worker counts stay as they are unless a red run forces a root-cause fix (never a blind raise).

### Deferred Ideas (OUT OF SCOPE)
- Custom domain (would remove the shared-origin storage trade-off) — future milestone, variable change by design (LIVE-08).
- The 20-package minor/patch Dependabot group and `@types/node` 26 — re-evaluate in Phase 14 (debt) / Phase 16 (toolchain), never merged blind.
- Kit 3 / Vitest 5 Dependabot PRs — Phase 16 by roadmap; dependabot.yml ignores them until then (D-06).
- The `configured` CI leg finishing in ~6 min while `root`/`sub` take 22-26 min: find out why (Playwright project scope vs. a silently skipped step) — Phase 15 (deterministic lanes), noted here so it is not lost.
- `scripts/precommit.test.ts` once failed under four parallel executors (Phase 12 deferred item) — Phase 15.
- Edge Add-ons submission and `ext-v0.1.0` release — Phase 17 (needs the live privacy URL from this phase).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (origin-corrected per CONTEXT) | Research Support |
|----|-------------|------------------|
| LIVE-02 | Repo + Pages source = Actions + `main` pushed with `PAGES_ENABLED` unset; first CI green with deploy skipped | **Already observed** (read live 2026-10-29): runs 40961373692, 40965347969, 40980243892 all `success`, `deploy` skipped. Per-leg durations table in "CI baseline". Plan = record evidence + ROADMAP/REQUIREMENTS wording fix. |
| LIVE-03 | After `PAGES_ENABLED=true`, a push deploys to `https://wolfwdavid.github.io/tran_real_estate/`; routing contract holds | Live probes of the same origin today: `http://` -> 301 absolute `https://` Location; slashless project dir -> 301 absolute `https://wolfwdavid.github.io/<repo>/`; a sibling SvelteKit project site serves its `404.html` with HTTP 404. `routing.smoke.ts` (4 tests) asserts all of it. Requires the root-leg base-path work in "Pattern 1" (BLOCKER if skipped). |
| LIVE-05 (live half) | Search Console verified via the pinned meta slot, `sitemap.xml` submitted and read | URL-prefix property `https://wolfwdavid.github.io/tran_real_estate/`; tag in `app.html` slot (already pinned by `scripts/app-html.test.ts`); sitemap inside the prefix. NEW finding: a project-site `robots.txt` is ignored by crawlers (Pitfall 6). |
| LIVE-06 | GTM-01..04 proven live or GTM-04 cut | Umami Hobby is free (100K events/month, 1 website, 6-month retention, official pricing page); `gateway.umami.is/api/send` preflight from `Origin: https://wolfwdavid.github.io` answers 200 with `Access-Control-Allow-Origin: *` (probed today). Debugger URLs + login requirements in "GTM proofs". |
| LIVE-07 | UAT rows reclassified into one ledger; launch-proof bundle; LAUNCH-AUDIT regenerated at the deployed commit | Full row enumeration (99 rows, counting rule) with a proposed classification for every row (section "HUMAN-UAT enumeration"); `launch-audit.mjs` header needs a code change to follow `BASE_PATH` (Pitfall 8). |
| LIVE-09 | `docs/RUNBOOK.md`: redeploy, roll back, read a smoke result, known-good worker counts | Rollback facts from `upload-pages-artifact@v5.0.0` `action.yml` (`retention-days` default **1**) and GitHub re-run docs (30-day limit, same `GITHUB_SHA`); worker counts read from configs and CI logs ("Runbook facts"). |
| SMOKE-04 | `live-smoke.yml` (`workflow_run` + `workflow_dispatch`), fails on any failure, own gate test, `ci.yml` `uses:` count unchanged | Exact `workflow_run` fields verified against the REST run object of run 40980243892; recommended YAML in "Code Examples"; `actions/upload-artifact` v7.0.2 = `cf430e030ddbb5b0abf93d22962f4752f3646cd9` (GitHub API). |
</phase_requirements>

## Summary

Most of Phase 13 is wiring and evidence, not new logic: `scripts/smoke.mjs` remote mode already does the version poll and the fail-closed run, the gate-test pattern exists twice, and CI has already proven itself on GitHub (three green `main` runs, deploy skipped). The research found four things the CONTEXT does not yet account for, and one of them is a hard blocker.

**Blocker: setting `BASE_PATH` on the root leg breaks the root E2E harness as written.** `scripts/serve-pages.mjs` mounts `apps/web/build` at `/` on port 4273, `apps/web/playwright.config.ts` gives the `root` project `baseURL: http://127.0.0.1:4273/`, the framing attacker page iframes `http://127.0.0.1:4273/`, and `scripts/smoke.mjs` `localTargets()` hard-codes `base = name === 'sub' ? '/tran_real_estate/' : '/'`. Once the root build is built with `/tran_real_estate`, every asset URL is `/tran_real_estate/_app/...` while the emulator serves the build at `/`, so the root E2E leg of the go-live run turns red. The fix is small and mechanical (derive the root mount and root baseURL from `resolveBasePath(targetEnv('root'))` in all four places, and make the two specs that branch on `project.name === 'sub'` branch on the base instead), but it must land and be rehearsed locally with `BASE_PATH=/tran_real_estate` before the owner sets the variable. Because of D-14's order, the first CI run that sees `BASE_PATH` would otherwise be the go-live run itself; this research recommends an extra checkpoint: set the variables, push an empty commit with `PAGES_ENABLED` still unset, and require that run green before go-live.

**Shared origin is much bigger than assumed.** The owner's `wolfwdavid.github.io` origin hosts about 250 Pages project sites today (`gh api users/wolfwdavid/repos`). D-05 accepts storage sharing, and the service worker was checked: it only deletes caches prefixed `tran-shell-`, so it never wipes a sibling site's caches. Two consequences still need copy decisions: the privacy page tells users to "clear this site's data in your browser settings", which on this origin wipes every sibling site too, and any script on any of those ~250 sites can read the BYOK keys a user chose to remember. The project `CLAUDE.md` "Research Reconciliation Overrides" still says "Never deploy under `wolfwdavid.github.io`" and needs an owner-approved edit alongside PROJECT.md (D-05).

**The CDN does not honour the cache-busting query.** A first request with a random `?_=` returned `X-Cache: HIT` from a different edge node, and `Cache-Control: max-age=600` is on every response, including a sibling site's `/_app/version.json`. The 10-minute poll in `waitForVersion` is therefore exactly at the cache TTL, and it relies on GitHub purging the CDN on deploy. Expect it to work, but measure the deploy-to-match time at the first deploy and record it. **Roll back by re-running only the `deploy` job works for one day at most**, because `actions/upload-pages-artifact@v5.0.0` defaults `retention-days` to `"1"`. After that, the options are "Re-run all jobs" on the old run (rebuilds the same SHA, about 27 minutes, possible up to 30 days) or `git revert` + push (preferred).

**Primary recommendation:** Do the work in five waves. (1) Origin and base-path code: the shared `resolveSiteUrl` helper, root-leg `BASE_PATH` wiring through `build-targets`, serve-pages, the Playwright root project and `smoke.mjs`, the extension define, the launch-audit header, `DEFAULT_SITE_ORIGIN`, and the doc/test substitutions. Rehearse it with `PUBLIC_SITE_URL=https://wolfwdavid.github.io BASE_PATH=/tran_real_estate pnpm build:root` plus root E2E and `smoke:local --target root`. (2) Add `live-smoke.yml` with its gate test and the dependabot `ignore` block. (3) Owner checkpoints: PR triage, variables (set `BASE_PATH` with `MSYS_NO_PATHCONV=1` from Git Bash), then a rehearsal push that must go green with deploy skipped, then go-live. (4) Observe the deploy, the live smoke and the fresh-profile checks, then run the GTM proofs in D-16 order. (5) Ledger, proof bundle, RUNBOOK and audit regeneration.

## CI baseline (success criterion 1, already true; record, do not re-run)

Read with `gh run view <id> --json jobs` (2026-10-29/30). All `event: push`, `head_branch: main`, `conclusion: success`, `deploy` skipped.

| Run | Head SHA | hygiene | root | sub | configured |
|-----|----------|---------|------|-----|------------|
| [40961373692](https://github.com/wolfwdavid/tran_real_estate/actions/runs/40961373692) | 62d9973 | 8 s | 27m03s | 21m33s | 6m08s |
| [40965347969](https://github.com/wolfwdavid/tran_real_estate/actions/runs/40965347969) | 396b5aa | 8 s | 21m52s | 26m13s | 5m36s |
| [40980243892](https://github.com/wolfwdavid/tran_real_estate/actions/runs/40980243892) | eed27e6 | 8 s | 26m38s | 25m29s | 5m30s |

From the run 40980243892 logs: `pnpm test:unit` takes 349 files in 117-121 s on every leg. E2E logs "Running 1151 tests using 2 workers" (root, 21.1 min), 1147 (sub, 1143 passed and 4 skipped, 20.1 min), and 41 (configured, 27.8 s, which explains the 6-minute leg; deferred to Phase 15). The extension E2E runs 7 tests on 1 worker. Zero flaky. The go-live latency is therefore about 27 min of CI plus the deploy plus the smoke (install, then poll, then a run of at most 5 min).

## Standard Stack

No new npm dependency. One new pinned action.

### Core
| Item | Version / pin | Purpose | Source |
|------|---------------|---------|--------|
| `actions/checkout` | `3d3c42e5aac5ba805825da76410c181273ba90b1` # v7.0.1 | live-smoke checkout of `head_sha` | copy from `ci.yml` (latest release v7.0.1, verified via GitHub API) |
| `pnpm/action-setup` | `ea17c68df8912ef543352723c149a84f56e3d413` # v6.1.0 | pnpm from `packageManager` | copy from `ci.yml` (latest) |
| `actions/setup-node` | `820762786026740c76f36085b0efc47a31fe5020` # v7.0.0 | Node from `.nvmrc` | copy from `ci.yml`. **If PR #1 merges first, the pin becomes `949feb2413d6458794dcd2491c4babbbce0c15c1` # v7.1.0.** Make the gate test compare against `ci.yml` instead of a literal (Pattern 3). |
| `actions/upload-artifact` | **`cf430e030ddbb5b0abf93d22962f4752f3646cd9` # v7.0.2** (released 2026-10-07) | upload `apps/web/test-results/` on failure | `gh api repos/actions/upload-artifact/releases/latest` + `commits/v7.0.2`; `action.yml` at v7.0.2: `runs.using: node24`, inputs `retention-days` (1-90), `if-no-files-found` (`warn` default), `include-hidden-files` (`false` default) |
| Existing smoke harness | `scripts/smoke.mjs`, `apps/web/playwright.smoke.config.ts`, `apps/web/tests/smoke/*` | remote run | Phase 12 |
| `@playwright/test` | 1.63.0 | browsers via `pnpm --filter web exec playwright install --with-deps chromium` | repo |
| actionlint | 1.7.12 (`scripts/actionlint.mjs`, lints every `.github/workflows/*.yml`) | `pnpm lint:workflows` covers `live-smoke.yml` automatically | repo |

### Not used / rejected
| Instead of | Could use | Why not |
|------------|-----------|---------|
| `workflow_run` workflow | a `smoke` job inside `ci.yml` after `deploy` | Violates SMOKE-04 (separate workflow) and the `uses:` count = 7 gate |
| Upload the Playwright HTML report | `test-results/` (traces, `retain-on-failure`) | The smoke config's CI reporter is `[['github'], ['list']]`, so no HTML report exists. Upload `apps/web/test-results/` with `if-no-files-found: ignore`, or add `['html', { open: 'never' }]` to the CI reporter list in `playwright.smoke.config.ts` (a one-line change). Both satisfy D-11. |
| A third-party "wait for Pages" action | `waitForVersion` in `smoke.mjs` | Already exists, dependency-free |

## Architecture Patterns

### Pattern 1: One base-path source for the root leg (D-02), applied everywhere the root build is served (BLOCKER)
`targetEnv('root', env)` returns `BASE_PATH: resolveBasePath(env)` instead of `''`. Every consumer that assumes the root build lives at `/` must read that value instead:

| File | Today | Change |
|------|-------|--------|
| `scripts/lib/build-targets.mjs` | root `BASE_PATH: ''` | `BASE_PATH: resolveBasePath(env)` (import from `../../apps/web/src/lib/base-path.js`; unset or `''` -> `''`; malformed value -> named error) |
| `scripts/serve-pages.mjs:100` | `site(ROOT, '/', build)` | `site(ROOT, rootBase \|\| '/', build)` with `rootBase = targetEnv('root').BASE_PATH`; the framing page iframes (`http://127.0.0.1:${ROOT}/`, `/renter/`, `/agent/`) gain `rootBase` |
| `apps/web/playwright.config.ts` root project | `baseURL: http://127.0.0.1:${ROOT}/` | `http://127.0.0.1:${ROOT}${rootBase}/` |
| `scripts/smoke.mjs` `localTargets()` | `base = name === 'sub' ? '/tran_real_estate/' : '/'` | `base = resolveBasePath(e) + '/'` for every target (`e` already merges the overlay) |
| `apps/web/tests/e2e/routing.spec.ts:78`, `agent-share-link.spec.ts:156` | branch on `project.name === 'sub'` | branch on `new URL(baseURL).pathname !== '/'` (or the resolved base) |
| `apps/web/tests/e2e/routes-drift.spec.ts:33`, `build-stamp.spec.ts` | choose the build dir by project | unchanged (dir, not base) |
| `scripts/assert-csp.mjs`, `assert-seo.mjs`, `launch-audit.mjs` | already read `targetEnv(target)` | follow automatically; `launch-audit.mjs` header needs a code change (Pitfall 8) |

Proof before the owner sets variables (local, serialized per lessons): `MSYS_NO_PATHCONV=1 PUBLIC_SITE_URL=https://wolfwdavid.github.io BASE_PATH=/tran_real_estate pnpm build:root`, then `pnpm csp:assert` (root only), `node scripts/assert-seo.mjs apps/web/build --target root`, `node scripts/assert-budget.mjs apps/web/build --require-tools`, root E2E in chunks of about 5 minutes at `--workers=4`, `pnpm smoke:local --target root`, and `pnpm ext:build && pnpm ext:assert` with the same env. Then rebuild root without the env so `pnpm verify` stays green.

### Pattern 2: Shared origin+base helper (D-04), the recommended shape
```js
// apps/web/src/lib/site-config.js (add; base-path.js has no imports, so no cycle)
import { resolveBasePath } from './base-path.js';
/**
 * Absolute site URL with no trailing slash: validated PUBLIC_SITE_URL origin + validated BASE_PATH.
 * The ONE place web (__SITE_URL__), extension (__TRAN_SITE_URL__) and the extension oracle agree on.
 * @param {Record<string, string | undefined>} [env]
 */
export function resolveSiteUrl(env = process.env) {
	return resolveSiteOrigin(env) + resolveBasePath(env);
}
```
- `apps/web/vite.config.ts`: `__SITE_URL__: JSON.stringify(resolveSiteUrl())`. `site-url.test.ts` (b) pins that string, so update it in the same commit.
- Extension: **rename the define to a single `__TRAN_SITE_URL__`** instead of adding a second define. A second define (`__TRAN_BASE__`) would recreate the "two halves that can disagree" problem that D-04 forbids, and keeping the old name `__TRAN_ORIGIN__` for a value that now carries a path would mislead readers. Touch points: `apps/extension/wxt.config.ts` `vite().define`, `apps/extension/vitest.config.ts:10`, `apps/extension/vitest.browser.config.ts:23`, `eslint.config.js:130` globals, `apps/extension/src/lib/site.ts`:
  ```ts
  declare const __TRAN_SITE_URL__: string;
  export const TRAN_SITE_URL: string = __TRAN_SITE_URL__;
  export const TRAN_ORIGIN: string = new URL(TRAN_SITE_URL).origin; // kept for Phase 14 DEBT-03 parity
  export const PRIVACY_URL = `${TRAN_SITE_URL}/legal/privacy/#browser-extension`;
  ```
  `TRAN_ORIGIN` has no consumer today (only `PopupFooter.svelte` imports `PRIVACY_URL`), so dropping it is also fine. Keep it only if Phase 14's DEBT-03 wording is not changed.
- `scripts/assert-extension.mjs:100`: `` `${resolveSiteUrl(env)}/` ``. The trailing slash plus the path now also keeps sibling project sites (for example `/tran_real_estate_x/` or `/raj_one/`) off the allowlist, which matters on a 250-site origin.
- The existing `.d.ts` (`apps/web/src/lib/site-config.d.ts`) gains the declaration.

### Pattern 3: `live-smoke.yml` (SMOKE-04, D-09..D-12)
Facts, each with its source:
- `workflow_run` fires "only if the workflow file exists on the default branch". `GITHUB_SHA` is the "last commit on default branch" and `GITHUB_REF` is the default branch, **not** the deployed commit. "A workflow run is triggered regardless of the conclusion", so gate on `github.event.workflow_run.conclusion == 'success'`. You "can't chain more than three levels". The `requested` type does not fire on re-runs. `branches:` filters on the triggering run's branch. (docs.github.com, events-that-trigger-workflows; HIGH)
- `github.event.workflow_run` is the run object. The live REST object for 40980243892 has `name: "ci"`, `event: "push"`, `head_branch: "main"`, `head_sha: "eed27e6..."`, `conclusion: "success"`, `run_attempt: 1`, `html_url`. (HIGH)
- `workflows: [ci]` matches the workflow `name:` (`name: ci` in `ci.yml`). (HIGH)
- **Add `github.event.workflow_run.event == 'push'` to the job `if:`.** `ci.yml` also runs on `workflow_dispatch` and `pull_request`. A green `workflow_dispatch` run of `ci` on `main` deploys nothing (the deploy gate requires `push`), so a smoke keyed only on success + `main` would poll for a SHA that was never deployed and fail red with exit 3. A pull request from a fork branch named `main` also reports `head_branch: main`. D-09 lists success + main + `PAGES_ENABLED`, and this `event` check is the one condition missing to make that intent hold. (HIGH, derived from `ci.yml`'s deploy `if:`)
- `actions/checkout` `ref:` accepts a commit SHA. Use `ref: ${{ github.event.workflow_run.head_sha || github.sha }}` (on dispatch `github.sha` is the dispatched ref). (HIGH)
- `inputs.*` is empty on `workflow_run`, so `inputs.base_url || format(...)` works for both triggers. (HIGH)
- Re-running an old `ci` run (rollback alternative) completes a `workflow_run` with `types: [completed]`, so the smoke follows a rollback re-run too, with the old `head_sha`. (MEDIUM: the docs only say `requested` does not fire on re-runs, which implies `completed` does. Verify on the first re-run.)
- Concurrency: `group: live-smoke`, `cancel-in-progress: true`. When two deploys land back to back, the older smoke would otherwise poll for a SHA that the newer deploy already replaced and end red (exit 3). A cancelled run is grey, not red.
- `timeout-minutes: 25` (install about 2 min + browser install about 1 min + poll up to 10 min + `globalTimeout` 5 min + slack).
- Gate test: compare every `uses:` against `ci.yml`'s pins except `actions/upload-artifact`, which it pins as a literal. The same approach as `extension-release-gate.test.ts` "every uses: is a 40-hex SHA that ci.yml already pins" keeps Dependabot's github-actions PRs (which update every workflow file in one PR, as PR #1 did for `ci.yml` + `extension-release.yml`) green.

### Pattern 4: Owner checkpoint commands (D-14), Windows-safe
```bash
# Git Bash mangles a leading-slash argument into C:/Program Files/Git/... (base-path.js already warns about this)
MSYS_NO_PATHCONV=1 gh variable set BASE_PATH --repo wolfwdavid/tran_real_estate --body "/tran_real_estate"
gh variable set PUBLIC_SITE_URL --repo wolfwdavid/tran_real_estate --body "https://wolfwdavid.github.io"
gh variable list --repo wolfwdavid/tran_real_estate        # verify the exact values before any push
# rehearsal: variables set, PAGES_ENABLED still unset -> must be green with deploy + live-smoke skipped
git commit --allow-empty -m "chore: rehearse sub-path deploy build" && git push
gh variable set PAGES_ENABLED --repo wolfwdavid/tran_real_estate --body "true"
git commit --allow-empty -m "chore: go live" && git push
```
PowerShell has no MSYS mangling. `gh variable set` is the documented CLI, and `--body` takes the value.

### Recommended plan/wave shape
1. ROADMAP/REQUIREMENTS/PROJECT origin reconciliation, CI-baseline evidence, and the `CLAUDE.md` Origin override line (owner-approved).
2. Code: Pattern 1 + Pattern 2 + `DEFAULT_SITE_ORIGIN` + substitutions + launch-audit header + `ci.yml`/`extension-release.yml` `BASE_PATH` + gate tests (two-file commits) + local rehearsal.
3. `live-smoke.yml` + `scripts/live-smoke-gate.test.ts` + dependabot `ignore` + `supply-chain.test.ts`. (Can run in parallel with wave 2; different files except `docs/`.)
4. Owner: PR triage, variables, rehearsal push, go-live push. Observe deploy, live-smoke and fresh-profile checks (D-13/D-15 evidence).
5. GTM proofs (Umami, then Web3Forms, then cards, then Search Console token commit + deploy + verify).
6. Ledger, proof bundle, RUNBOOK, DEPLOY-CHECKLIST rewrite, LAUNCH-AUDIT regeneration at the deployed SHA.

### Anti-Patterns to Avoid
- Setting `BASE_PATH` before Pattern 1 lands, or going live without a rehearsal run where the root leg built with the base.
- `SMOKE_EXPECT_VERSION: ${{ github.sha }}` on `workflow_run` (that is the default-branch tip, not the deployed SHA).
- Checking out the default branch in `live-smoke` (the specs would not match the deployed build).
- Gating only on `conclusion == 'success'` (fires for PRs and dispatch runs).
- Raising the 10-minute poll or adding retries if propagation is slow. Measure first; the root cause would be the CDN TTL (Pitfall 3).

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Waiting for the deploy | a curl loop in YAML | `pnpm smoke` (`waitForVersion`, exit 3 on timeout) | Already tested in `scripts/smoke.test.ts` |
| Live contract checks | new live specs | the 10 existing `*.smoke.ts` specs | Same oracles as E2E; SMOKE-02 already green on three local builds |
| Origin + base composition | string concatenation in each config | `resolveSiteUrl()` (Pattern 2) | D-04: one function, so a wrong combination is impossible |
| Workflow structure checks | YAML parser dependency | text gate test + `pnpm lint:workflows` | Repo precedent (`.github/` is Prettier-ignored so `if:` lines stay single-line) |
| Proof screenshots | manual browser captures for mechanical checks | a small Playwright script reading `SMOKE_BASE_URL` (landing, `/renter` redirect via `request` + Location text, 404, `_app/version.json`) | D-20, reproducible from the deployed SHA |
| Rollback | a "deploy SHA X" workflow | `git revert` + push (preferred) / re-run old run | No new workflow surface |

## Runtime State Inventory (origin rename: `tranrealestate.github.io` -> `wolfwdavid.github.io` + `/tran_real_estate`)

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None. Nothing has ever been deployed (the live URL answers 404 today), so no visitor IndexedDB/localStorage/SW caches exist under either origin. The SW cleanup only touches `tran-shell-*` caches (verified in `apps/web/src/service-worker.ts`), so it is safe on the shared origin. | None |
| Live service config | GitHub: no repository variables (`gh api .../actions/variables` -> `[]`); environment `github-pages` with a branch policy for `main` only (verified); Pages `build_type: workflow`, `https_enforced: true`, `custom_404: false` (the flag is irrelevant for Actions deploys). Umami website (hostname), Web3Forms key, Search Console property: none exist yet. When created they must use `wolfwdavid.github.io` (the Umami website "domain") and the URL-prefix `https://wolfwdavid.github.io/tran_real_estate/`. | Owner checkpoints set `PUBLIC_SITE_URL`, `BASE_PATH`, launch vars, `PAGES_ENABLED` |
| OS-registered state | None. Verified: no scheduled tasks or services are involved; everything is GitHub-hosted. | None |
| Secrets/env vars | No secrets used. Variable names unchanged except the new `BASE_PATH`. `PUBLIC_SITE_URL` value is origin-only (D-01). | Set `BASE_PATH` (Pattern 4) |
| Build artifacts | Local `apps/web/build*` are stamped with pre-Phase-13 SHAs and the old default origin; the `apps/extension/.output` zip carries the old `PRIVACY_URL`. | Rebuild after the code wave (`smoke:local` refuses stale stamps anyway). Rebuild the extension before any Phase 17 release. |
| Text literals (git) | `tranrealestate` appears in 30+ tracked non-planning files (list under "Tests that move"). `CLAUDE.md:247` says "Never deploy under `wolfwdavid.github.io`". `docs/LAUNCH-AUDIT.md` is generated. | Substitute; owner-approved CLAUDE.md edit; regenerate the audit |

## Tests that move (research question 6)

### `scripts/workflow-gate.test.ts` (ci.yml)
| Test name | Why it changes |
|-----------|----------------|
| `quality matrix` > `the Build step runs the build-targets script for the matrix target` | asserts `expect(quality).not.toContain('BASE_PATH:')`, which fails once any `BASE_PATH:` env line exists. Replace with an assertion on the exact gated line. |
| `quality matrix` > `build-targets.mjs maps each target to its BASE_PATH and BUILD_DIR` | still passes with `{}`; add the case `targetEnv('root', { BASE_PATH: '/tran_real_estate' }).BASE_PATH === '/tran_real_estate'`, plus "sub/configured ignore env.BASE_PATH" |
| `quality matrix` > `owner variables reach only the root leg, in every env block` | `blocks` stays 5 if `BASE_PATH` is added to the existing Build/CSP/SEO/E2E/extension env blocks. Add a `BASE_PATH` count. Note: the JS-budget step has **no env block** today. If D-02's "budget" step gets one, `blocks` becomes 6 and `PUBLIC_SITE_URL` count assertions move. `assert-budget.mjs` does not read `targetEnv`, so recommend NOT adding env to the budget step (budget is path-agnostic; verify by reading `assert-budget.mjs` during planning). |
| `extension (Phase 11)` > `the extension build step carries only PUBLIC_SITE_URL` | asserts `count(step, '${{') === 1` and the step contains only `PUBLIC_SITE_URL`; becomes 2 expressions. Rename the test. |
| `no remote side effects` > `the workflow never pushes...` | forbids `/tranrealestate\.github\.io\|wolfwdavid/i` in `ci.yml`. Still passes as long as no literal URL is written. Keep it (copy it into the live-smoke gate). |
| `supply chain` > `... exactly 7 uses: lines` | must stay 7 (`live-smoke.yml` is a separate file) |

Recommended `ci.yml` line (root-only, same shape as the owner keys): `BASE_PATH: ${{ matrix.target == 'root' && vars.BASE_PATH || '' }}`. D-02's parenthetical writes `BASE_PATH: ${{ vars.BASE_PATH }}`. Both are root-leg-only in effect because `targetEnv('sub'|'configured')` overwrites `BASE_PATH`, but the gated form matches the established "owner settings reach only the root leg" pattern and the existing test idiom. If the planner keeps the literal D-02 string, the gate test must instead prove that `targetEnv` ignores `env.BASE_PATH` for sub and configured. Either way, update the ci.yml comments "BASE_PATH and BUILD_DIR come from scripts/lib/build-targets.mjs" and "The extension is target-independent (no BASE_PATH...)".

### `scripts/extension-release-gate.test.ts`
- `steps` > `the zip and oracle steps each carry PUBLIC_SITE_URL in their own step` still passes; extend it with `BASE_PATH: ${{ vars.BASE_PATH }}` in both steps (count 2) and `vars.BASE_PATH` count 2.

### Files pinning `tranrealestate.github.io` (grep, non-planning)
- Must change (they compare against `DEFAULT_SITE_ORIGIN` or the shipped URL): `apps/web/src/lib/site-config.test.ts:26-27`, `apps/web/src/lib/site.test.ts:6-7`, `apps/extension/tests/browser/popup.browser.test.ts:152` (`PRIVACY_URL` literal; with no env in tests the value is the bare origin + `/legal/privacy/...`), `scripts/site-url.test.ts:17` (`HOST`) and `:139`, `scripts/deploy-checklist.test.ts:16` (Step 2 heading) and `:79` (remote URL), `scripts/extension-docs.test.ts:103` (edge listing privacy URL), `scripts/launch-audit.test.ts:235/262/263` (header/fixture, see Pitfall 8).
- Fixture-only (pass either way; substitute for consistency per D-03): `apps/web/src/lib/analytics/{beacon,boot,payload}.test.ts`, `features/agent/profile/share-link.test.ts`, `leads/inquiry-url.test.ts`, `seo/jsonld.test.ts`, `seo/sitemap.test.ts`, `scripts/assert-seo.test.ts:11`, `scripts/service-worker-guard.test.ts:97`, `scripts/smoke-env.test.ts`, `scripts/smoke.test.ts` (`:142` regex).
- Docs/source: `apps/web/src/lib/site-config.js:11-12`, `apps/web/src/lib/site.ts:6` (comment), `apps/extension/src/lib/site.ts:3` (comment), `apps/extension/store/edge-listing.md:53`, `docs/EXTENSION-INSTALL.md:72`, `docs/DEPLOY-CHECKLIST.md` (13 lines), `docs/LAUNCH-AUDIT.md` (regenerated, never hand-edited), `CLAUDE.md:247`.
- `scripts/site-url.test.ts` (a) sweep: with `HOST = 'wolfwdavid.github.io'`, the only shipped hit is the `site-config.js` doc comment (comment lines are exempt). The sweep stays meaningful.

### `docs/DEPLOY-CHECKLIST.md` pin: `scripts/deploy-checklist.test.ts`
Pins all nine `## Step N:` headings verbatim (Step 1 "Create the organization", Step 2 "...named exactly `tranrealestate.github.io`"), the remote URL in Step 6, the Umami host/curl, Search Console item 4 ("HTML-tag method only", `14 URLs`), and the fresh-profile rule twice. Keep nine steps (other files cite step numbers "Step 5/7", "8.1.3", "8.1.8", "8.7"). Rewrite the headings of Steps 1-2 to the personal-account reality and update `HEADINGS` + the remote assertion in the same commit. The curl body's `"hostname":"tranrealestate.github.io"` becomes `wolfwdavid.github.io`.

## Common Pitfalls

### Pitfall 1: Root E2E red on the go-live run (BLOCKER)
**What goes wrong:** root build at `/tran_real_estate` served at `/` by `serve-pages`. **How to avoid:** Pattern 1 + local rehearsal + a rehearsal push before `PAGES_ENABLED`. **Warning sign:** root leg E2E fails en masse on asset 404s while sub is green.

### Pitfall 2: Smoke on a run that deployed nothing
**What goes wrong:** `workflow_dispatch`/PR `ci` runs with `head_branch: main` and success trigger the smoke, which then times out (exit 3). **Avoid:** `github.event.workflow_run.event == 'push'` in the `if:`, plus `branches: [main]` on the trigger to cut noise from skipped runs.

### Pitfall 3: CDN cache vs the 10-minute poll
**Observed live (2026-10-29, same origin):** `Cache-Control: max-age=600` on HTML and on a sibling's `/_app/version.json`. A brand-new `?_=<random>` got `X-Cache: HIT` (Age 1) from a different edge node, and a request `Cache-Control: no-cache` header also got a HIT. The query string is evidently not part of the Fastly cache key. The poll therefore depends on GitHub purging the CDN on deploy (widely observed, but not documented here: LOW-MEDIUM). **Avoid:** do not raise the timeout; log the elapsed seconds when `waitForVersion` matches (a one-line change in `smoke.mjs`) and record the first-deploy number in the SUMMARY. If it ever exceeds about 8 min, the root-cause discussion is the TTL, not retries. Browsers keep the 600 s cache too, which is why the fresh-profile rule exists.

### Pitfall 4: Rollback by "re-run deploy" after the artifact expired
`actions/upload-pages-artifact@v5.0.0` `retention-days` default `"1"` (read from its `action.yml`). Re-running only the `deploy` job of a run older than a day has no `github-pages` artifact to deploy. "Re-run all jobs" works up to 30 days and uses "the same `GITHUB_SHA` ... and `GITHUB_REF`" with "the privileges of the actor who initially triggered the workflow" (docs, HIGH). It rebuilds the old commit (about 27 min) and passes the deploy gate (event still `push`, ref `main`, environment policy `main`). Preferred path stays `git revert <sha> && git push`. Do not change `retention-days` in Phase 13 (D-08 spirit; and the RUNBOOK documents the caveat per D-21).

### Pitfall 5: Git Bash path mangling of `/tran_real_estate`
`gh variable set BASE_PATH --body /tran_real_estate` from Git Bash stores `C:/Program Files/Git/tran_real_estate`. `resolveBasePath` then fails the CI build by name, which is safe but wastes a run. Use `MSYS_NO_PATHCONV=1` or PowerShell, then `gh variable list`.

### Pitfall 6: Project-site `robots.txt` is ignored
Google: robots.txt "must be located at the root of the site host... It cannot be placed in a subdirectory (for example, at https://example.com/pages/robots.txt)" (developers.google.com, HIGH). `https://wolfwdavid.github.io/robots.txt` is a 404 (no user site), so crawlers treat everything as allowed. The `Disallow: /tran_real_estate/print/` and `/agent/inquire/` lines and the `Sitemap:` line in the project robots are inert. The sitemap must be submitted in Search Console (D-16 does). Mitigation already in place: `noindex` is emitted by the `(app)`, `(print)`, `(public)` layouts and `+error.svelte` (grep). 10-HUMAN-UAT row 5's "robots.txt at the org root" cannot be met on a project site; record the substitution in the ledger.

### Pitfall 7: Shared origin side effects (D-05 accepted, copy still wrong)
About 250 sibling project sites share `wolfwdavid.github.io`. The privacy page line 98 ("clear this site's data in your browser settings") would wipe all of them. Remembered BYOK keys are readable by any sibling site's script. Recommend a copy edit pointing users to the in-app "Forget all keys" / data-delete controls and a one-line shared-origin note on the privacy page (banned-terms + legal tone apply). This is owner-visible legal copy, so it goes to the owner as a checkpoint, not silently.

### Pitfall 8: `LAUNCH-AUDIT.md` header ignores `BASE_PATH`
`scripts/launch-audit.mjs:1046` builds `baseUrl` as `` `${origin}/ (root build); ${origin}/tran_real_estate/ (sub-path build)` ``, so with D-22 env it would claim the deploy build is at `https://wolfwdavid.github.io/`. Change it to `${resolveSiteUrl(rootEnv)}/ (root/deploy build); ${resolveSiteUrl(subEnv)}/ (sub-path build)` and update `scripts/launch-audit.test.ts`. Regeneration also needs the evidence chain (`apps/web/test-results/` reports via `scripts/audit-evidence.mjs clean | e2e <shard> | unit <shard> | merge`, then `pnpm audit:launch`), with all three builds built at the deployed SHA with the same env as the deploy (`PUBLIC_SITE_URL`, `BASE_PATH`, analytics host/id, Web3Forms key, contact email). Otherwise the CSP oracle's analytics host differs from the deployed build.

### Pitfall 9: Umami bot drop makes D-12's synthetic pageview at most one
The smoke's `route.fetch()` sends a HeadlessChrome UA from an Azure IP. Umami may answer `200 {"beep":"boop"}` and record nothing (12-RESEARCH LOW item, still unverifiable without the account). The spec passes either way. RUNBOOK wording: "each deploy adds **at most one** synthetic `/` pageview".

### Pitfall 10: Extension built without `BASE_PATH`
After Pattern 2, an extension zip built with `PUBLIC_SITE_URL` set and `BASE_PATH` unset links to `https://wolfwdavid.github.io/legal/privacy/...` (a 404 on this origin), and the oracle allowlist (same env) passes it. `extension-release.yml` must carry `BASE_PATH` on both the zip and oracle steps (D-02). Phase 17 should add a release-time check that the privacy URL answers 200 on the live origin (out of scope here; note it in the ledger row 11-5).

### Pitfall 11: Commit hygiene
Executors add model trailers unless told not to (lessons 2026-10-25). CI's hygiene job runs `commit-hygiene.mjs --history` on every push, so one trailer makes the go-live run red. Every executor prompt must forbid it. Run the trailer check before every owner push checkpoint.

## Code Examples

### `.github/workflows/live-smoke.yml` (recommended; single job)
```yaml
name: live-smoke

on:
  workflow_run:
    workflows: [ci]
    types: [completed]
    branches: [main]
  workflow_dispatch:
    inputs:
      base_url:
        description: Deployed origin + base path with a trailing slash
        required: true
        type: string
      expect_version:
        description: 40-hex build SHA (default = the dispatched commit)
        required: false
        type: string

permissions:
  contents: read

concurrency:
  group: live-smoke
  cancel-in-progress: true

jobs:
  smoke:
    name: read-only smoke of the deployed site
    if: github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push' && github.event.workflow_run.head_branch == 'main' && vars.PAGES_ENABLED == 'true')
    runs-on: ubuntu-24.04
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ github.event.workflow_run.head_sha || github.sha }}
          persist-credentials: false
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter web exec playwright install --with-deps chromium
      - name: Smoke the deployed build
        run: pnpm smoke
        env:
          SMOKE_BASE_URL: ${{ inputs.base_url || format('{0}{1}/', vars.PUBLIC_SITE_URL, vars.BASE_PATH) }}
          SMOKE_SITE_URL: ${{ inputs.base_url || format('{0}{1}/', vars.PUBLIC_SITE_URL, vars.BASE_PATH) }}
          SMOKE_EXPECT_VERSION: ${{ github.event.workflow_run.head_sha || inputs.expect_version || github.sha }}
          SMOKE_ANALYTICS_HOST: ${{ vars.PUBLIC_ANALYTICS_HOST }}
      - name: Upload traces on failure
        if: failure()
        uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
        with:
          name: live-smoke-traces
          path: apps/web/test-results/
          retention-days: 14
          if-no-files-found: ignore
```
Notes: the dispatch branch deliberately ignores `PAGES_ENABLED`, because a dispatch is an explicit operator action and the env gate still fails closed on a bad URL. If the planner prefers the stricter reading of D-09, append `&& vars.PAGES_ENABLED == 'true'` to the whole expression. `vars.PUBLIC_SITE_URL` empty gives `"/tran_real_estate/"`, which the env gate rejects (exit 2, red): correct fail-closed behaviour once Pages is on. Dispatch smoke against a non-analytics origin with `PUBLIC_ANALYTICS_HOST` set would fail the analytics spec; the RUNBOOK should say dispatch targets the live origin.

### `scripts/live-smoke-gate.test.ts` assertions (shape)
Triggers (`workflow_run` + `workflows: [ci]` + `types: [completed]` + `branches: [main]`; `workflow_dispatch` with `base_url` required, `expect_version` optional; no `push`/`pull_request`/`schedule`); the exact single-line `if:` (contains `conclusion == 'success'`, `event == 'push'`, `head_branch == 'main'`, `vars.PAGES_ENABLED == 'true'`); checkout `ref:` uses `workflow_run.head_sha`; `SMOKE_EXPECT_VERSION` starts with `github.event.workflow_run.head_sha`, and `github.sha` never appears as the only source; `permissions:\n  contents: read\n` and no `write`/`id-token`/`secrets.`; every `uses:` 40-hex, checkout/pnpm/setup-node equal to `ci.yml`'s, upload-artifact equal to the literal pin, exactly 5 `uses:`; `persist-credentials: false`; `run: pnpm smoke` exactly once and never `smoke:local`; upload step `if: failure()` + `retention-days: 14`; no `https://` URL at all and no `tranrealestate|wolfwdavid`; concurrency group; `ci.yml` still has 7 `uses:` (a cross-file assertion). Plus `actionlint.mjs` lints every workflow (already asserted in `extension-release-gate.test.ts`).

### dependabot.yml `ignore` (D-06)
```yaml
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    # Majors of the toolchain set belong to Phase 16 (pnpm 12 -> Vitest 5 -> SvelteKit 3).
    ignore:
      - dependency-name: '@sveltejs/kit'
        update-types: ['version-update:semver-major']
      - dependency-name: '@sveltejs/adapter-static'
        update-types: ['version-update:semver-major']
      - dependency-name: 'vitest'
        update-types: ['version-update:semver-major']
      - dependency-name: '@vitest/*'
        update-types: ['version-update:semver-major']
      - dependency-name: 'vitest-browser-svelte'
        update-types: ['version-update:semver-major']
      - dependency-name: 'pnpm'
        update-types: ['version-update:semver-major']
    groups:
      npm-minor-patch:
        update-types: [minor, patch]
```
Source: Dependabot options reference (`dependency-name` supports `*`; `ignore.update-types` values are `version-update:semver-{patch,minor,major}`, while `groups.update-types` uses `patch|minor|major`; HIGH). PR #2 was opened for `/apps/web` under the single `directory: /` entry, so the root entry covers workspace manifests (MEDIUM). Assert the ignore block in `scripts/supply-chain.test.ts` `describe('dependabot')` (it already parses entries). Whether `ignore` also suppresses Dependabot *security* updates is not stated on the page (LOW). It does not matter here because security updates are separate PRs that the `pnpm audit` gate reviews.

## GTM proofs (research question 9)

| Proof | Facts | Confidence |
|-------|-------|------------|
| Umami Cloud | Hobby plan $0/month: 100K events/month, **1 website**, 6-month retention (umami.is/pricing). Collect endpoint `https://gateway.umami.is/api/send`; an `OPTIONS` preflight with `Origin: https://wolfwdavid.github.io` answered `200`, `Access-Control-Allow-Origin: *`, methods include POST (probed 2026-10-29). The site's beacon is `no-cors` anyway, so CORS cannot trigger the cut line; ad-blockers and bot filtering are the realistic failure modes. The website "domain" in Umami should be `wolfwdavid.github.io`. | HIGH (pricing, CORS) |
| Umami "IP not stored" | Umami says it collects no personal data and uses the IP transiently for geolocation and the session hash. **No official settings toggle named "store IP addresses" could be found.** D-17's precondition "IP storage confirmed off in Umami settings" may have no UI. Record the owner's finding as an `owner-decision` row ("Umami Cloud does not store IP addresses per its docs/privacy policy; no toggle exists"), with a screenshot of the policy/settings page. | LOW (third-party sources only; flag for owner) |
| Web3Forms | Free plan is browser-only (non-browser requests answer 403 "Pro plan is required"; a curl preflight from this machine also got 403, which is consistent with bot blocking). Captcha must be OFF because the CSP forbids hCaptcha scripts (checklist + 10-HUMAN-UAT row 2). Subjects: "Tran waitlist: Renter", "Tran feedback: <topic>". | MEDIUM |
| LinkedIn Post Inspector | `https://www.linkedin.com/post-inspector/` (200 today); requires a LinkedIn sign-in to inspect. | MEDIUM |
| Facebook Sharing Debugger | `https://developers.facebook.com/tools/debug/` (200 today); requires a Facebook login. D-18 substitute if no account: LinkedIn plus one login-free public OG validator (choose at run time; record its URL). | MEDIUM |
| Search Console | URL-prefix property `https://wolfwdavid.github.io/tran_real_estate/` (a Domain property would need DNS for github.io, which is impossible). HTML-tag verification reads the static HTML of the property root, so the prerendered `index.html` carries it from the pinned `app.html` slot (and so does `404.html`, harmlessly). Submit `https://wolfwdavid.github.io/tran_real_estate/sitemap.xml` (inside the prefix); expect 14 URLs. Keep the tag forever (Google re-checks). | MEDIUM (general Google guidance; the exact Search Console UI is owner-verified) |

GTM-01 (portal pick, tour, "Try sample data") and GTM-03 (tool pages discoverable via sitemap and share cards) have no row of their own in `10-HUMAN-UAT.md`. Prove GTM-01 with one fresh-profile walk recorded in the ledger as a new `P13-` row. GTM-03 is covered by `seo.smoke.ts` (sitemap 14 URLs, share tags on every route, og:image `image/png`) plus the debugger screenshots.

## HUMAN-UAT enumeration (research question 8; the planner copies this)

### Counting rule and the real number
Rule: one row = one `### ` heading under `## Tests` (files 01, 02, 03, 08, 09, 10, 11, 12) or one table row with an id `| X<n> |` (04 `U`, 05 `H`, 06 `R`, 07 `I` and `S`). `### A./B./C.` headings in 04/05 are **step recipes** for rows, not rows. Counted with `awk`/`grep` on 2026-10-29:

| File | Rows | Already resolved |
|------|------|------------------|
| 01 | 3 | 0 |
| 02 | 3 | 0 |
| 03 | 9 | 0 |
| 04 | 14 (U1-U14) | 0 |
| 05 | 10 (H1-H10) | 0 |
| 06 | 12 (R1-R12) | 0 |
| 07 | 15 (I1-I13 + sign-off S1-S2) | 0 |
| 08 | 7 | 0 |
| 09 | 8 | 0 |
| 10 | 8 | 0 |
| 11 | 8 | 1 skipped (row 8, cut) |
| 12 | 2 | 1 passed (row 1) |
| **Total** | **99** (97 in phases 01-11) | 2 |

**The roadmap's "77" cannot be reproduced.** `v1.0-MILESTONE-AUDIT.md` derives it as "3+3+9+14+10+7+8+8+7 counted (= 69), plus the 06/07 owner-gated lists". The 06/07 lists actually hold 27 rows (12 + 15), not 8. Record **99 rows (counting rule above; 77 was a miscount of the 06/07 tables)** in the ledger header and in REQUIREMENTS LIVE-07 wording.

### Proposed classification (P13 = closed in this phase; P14/P17 = carried to that phase, ledger result "carried", never dropped)
Smoke spec names are files under `apps/web/tests/smoke/`.

| Ledger id | Origin | Title | Class | Closure / evidence |
|---|---|---|---|---|
| L01 | 01-1 | Live origin routing and CSP on the real host | smoke | `routing.smoke.ts` (4 tests) + `csp.smoke.ts`; first `live-smoke` run link + D-15 fresh-profile screenshots |
| L02 | 01-2 | Gated Pages deploy runs; artifact has `.nojekyll` | smoke | go-live `ci` run link (deploy job green after hygiene + quality) + `workflow-gate.test.ts`; `curl -sI <live>/.nojekyll` 200 (a sibling site on this origin serves `.nojekyll` 200 today) |
| L03 | 01-3 | Push protection rejects a token push | human | P13 throwaway-branch probe (DEPLOY-CHECKLIST Step 7.7); same probe as L88 |
| L04 | 02-1 | 375px warm-editorial visual feel | human | P13 owner glance on a phone, live origin; screenshot |
| L05 | 02-2 | Legal review of the four /legal/ pages | owner-decision | owner records "counsel reviewed" or "launch without counsel review, accepted risk" |
| L06 | 02-3 | Fonts/assets same-origin on the live origin | smoke | `third-party.smoke.ts` (every route, zero cross-origin) + `assets.smoke.ts` |
| L07 | 03-1 | Android Chrome install standalone | human | device |
| L08 | 03-2 | Desktop Chrome/Edge install | human | dev machine, live origin |
| L09 | 03-3 | iPhone Safari Add to Home Screen | human | device |
| L10 | 03-4 | iPad desktop UA shows iOS steps | human | device (if no iPad: `cut`, reason "no device") |
| L11 | 03-5 | Firefox persistent-storage prompt | human | dev machine |
| L12 | 03-6 | Safari real persistence status | human | device (same session as L09) |
| L13 | 03-7 | Offline launch on a real device | human | device; precache contents already proven by `pwa.smoke.ts` |
| L14 | 03-8 | Firefox session restore of session keys | human | record observation (accepted limitation) |
| L15 | 03-9 | Real-key card shows last 4 only (optional) | human | fold into L18 (same session) |
| L16 | 04-U1 | Card required at RentCast sign-up? | human | account creation |
| L17 | 04-U2 | Key format | human | dashboard |
| L18 | 04-U3 | Test key valid | human | live origin, steps A |
| L19 | 04-U4 | Test key invalid | human | steps B |
| L20 | 04-U5 | Restricted key 403 | human | steps C (optional second key) |
| L21 | 04-U6 | Empty listing search | human | 1 call |
| L22 | 04-U7 | Does a 404 bill? | human | dashboard before/after |
| L23 | 04-U8 | Page 2 billed separately | cut | only observable with 500+ results; reason "not reachable on the free tier without waste" (or human if it occurs) |
| L24 | 04-U9 | 403 body on cancelled plan | cut | optional; only if the owner cancels a plan |
| L25 | 04-U10 | Field coverage of a real listing | human | after a billed search |
| L26 | 04-U11 | Browser fetch from the deployed origin (CORS) | human | P13 live origin |
| L27 | 04-U12 | Open-ended range bounds | human | 3 calls |
| L28 | 04-U13 | Highest bedroom bucket | human | 1 call |
| L29 | 04-U14 | Listing in its own comparables | human | 1 call |
| L30 | 05-H1 | Per-provider test, streaming, Stop, usage | human | real keys, live origin |
| L31 | 05-H2 | Wrong key per provider | human | |
| L32 | 05-H3 | Gemini key types | human | |
| L33 | 05-H4 | Default-model extras accepted | human | |
| L34 | 05-H5 | OpenRouter privacy routing | human | |
| L35 | 05-H6 | Network hygiene in DevTools | human | keyless half already proven by `third-party.smoke.ts` |
| L36 | 05-H7 | Launch-day CORS re-probe | human | P13 from the live origin |
| L37 | 05-H8 | Model IDs and prices re-verified | owner-decision | record date checked + any registry change |
| L38 | 05-H9 | Legal review of the Fair Housing lexicon | owner-decision | counsel or accepted risk |
| L39 | 05-H10 | Remembered key shows Test connection after reload | human | |
| L40 | 06-R1 | Real search (1 call) | human | |
| L41 | 06-R2 | Filters, sort, reload, shared URL (0 calls) | human | |
| L42 | 06-R3 | Real OSM tiles | human | |
| L43 | 06-R4 | Split view and pins | human | (layout covered by E2E; live glance) |
| L44 | 06-R5 | Listing detail (0 calls) | human | |
| L45 | 06-R6 | Fair-rent check (2 calls) | human | |
| L46 | 06-R7 | Renter journey budget = 3 | human | |
| L47 | 06-R8 | Saved-search re-run over a day | human | needs 24 h |
| L48 | 06-R9 | Outreach with a real AI key | human | |
| L49 | 06-R10 | Zillow/Google look-up links | human | |
| L50 | 06-R11 | Real phones, renter routes | human | |
| L51 | 06-R12 | Screen reader pass, renter | human | |
| L52 | 07-I1 | Manual analysis (0 calls) | human | |
| L53 | 07-I2 | Autofill rent estimate (1 call) | human | |
| L54 | 07-I3 | Autofill value estimate (1 call) | human | |
| L55 | 07-I4 | Save, reload, compare | human | |
| L56 | 07-I5 | Watch a real ZIP (1 call) | human | |
| L57 | 07-I6 | Buy box check (1 call) | human | |
| L58 | 07-I7 | Deep analyze (2 calls) | human | |
| L59 | 07-I8 | Investor journey budget = 6 | human | |
| L60 | 07-I9 | Memo with a real AI key | human | |
| L61 | 07-I10 | Print to PDF on real browsers | human | |
| L62 | 07-I11 | Real phones, investor routes | human | |
| L63 | 07-I12 | Screen reader pass, investor | human | |
| L64 | 07-I13 | Deployed CSP and hosts | smoke | `csp.smoke.ts` + `third-party.smoke.ts` (keyless); keyed provider hosts are part of L30/L35 |
| L65 | 07-S1 | Unspecified save message wording | owner-decision | approve or replace |
| L66 | 07-S2 | Notes-only numbers blocked at print | owner-decision | carried: Phase 14 DEBT-02 fixes the behaviour; result "superseded by DEBT-02" |
| L67 | 08-UAT-1 | Real delivery via agent's Web3Forms key | human | |
| L68 | 08-UAT-2 | `tran_lead_v1` field visible | human | with L67 |
| L69 | 08-UAT-3 | Paste-back from Gmail/Outlook/Apple Mail | human | |
| L70 | 08-UAT-4 | hCaptcha on shows the captcha-required state | human | |
| L71 | 08-UAT-5 | Spam and free-tier quota behaviour | cut | reason: needs abusive volume on a real key; "may stay unobserved" per the row |
| L72 | 08-UAT-6 | Follow-up draft in real email apps | human | |
| L73 | 08-UAT-7 | Counsel review (agent copy) | owner-decision | |
| L74 | 09-UAT-1 | Real-key snapshot printed in 3 browsers | human | |
| L75 | 09-UAT-2 | Social cards in IG/FB/LinkedIn composers | human | |
| L76 | 09-UAT-3 | NY/CA disclosures read-through | owner-decision | counsel/owner |
| L77 | 09-UAT-4 | Equal Housing Opportunity logo | owner-decision | |
| L78 | 09-UAT-5 | Re-check NY GBL § 396-b and platform labels | owner-decision | dated check |
| L79 | 09-UAT-6 | 6-page all-sections snapshot | owner-decision | P14 rider (ROADMAP Phase 14 "owner decisions riding along") |
| L80 | 09-UAT-7 | Studio license titles vs per-state titles | owner-decision | P14 rider |
| L81 | 09-UAT-8 | Memo lists two block reasons | owner-decision | P14 rider ("duplicate memo block reason") |
| L82 | 10-1 | Umami counts arrive; GPC respected; IP not stored | human | P13 GTM-04 (D-17) + `analytics.smoke.ts` JSON 200; or cut line |
| L83 | 10-2 | Web3Forms waitlist + feedback arrive | human | P13 GTM-02 |
| L84 | 10-3 | Contact email mailto fallbacks (optional) | owner-decision | set `PUBLIC_CONTACT_EMAIL` and verify, or record "unset" (unset state already E2E-verified) |
| L85 | 10-4 | Share cards in a link-preview debugger | human | P13 GTM-03; tags already by `seo.smoke.ts` |
| L86 | 10-5 | Sitemap in Search Console; robots at the org root | human | P13 GTM-04/LIVE-05; robots-at-host-root part recorded as not applicable on a project site (Pitfall 6) |
| L87 | 10-6 | Live-origin checks (Step 7): deep route, redirect, 404 / provider keys / Safari | smoke + human | routing half: `routing.smoke.ts`; keys half = L30/L36; Safari half = L12 |
| L88 | 10-7 | Dependabot + push protection on; probe rejected | human | settings already observed via API at the 12 gate; probe = L03 |
| L89 | 10-8 | Report-only pages over the 60 KB budget | owner-decision | carried: Phase 14 DEBT-09 makes it a hard gate; result "superseded by DEBT-09" |
| L90 | 11-1 | Live zillow.com smoke (Chrome + Edge) | human | P17 |
| L91 | 11-2 | Zero-network real session | human | P17 |
| L92 | 11-3 | Dim the "Showcase" badge? | owner-decision | P17 |
| L93 | 11-4 | Read current Zillow ToU | human | P17 (blocks public release only) |
| L94 | 11-5 | Privacy URL is live | smoke | `extension-link.smoke.ts` on the live run + one click from a popup built with `BASE_PATH` (Pitfall 10) |
| L95 | 11-6 | Edge Add-ons listing | human | P17 |
| L96 | 11-7 | Enable Releases, publish `ext-v0.1.0` | human | P17 |
| L97 | 11-8 | Firefox Add-ons listing | cut | already skipped: ROADMAP v1 cut line (2) |
| L98 | 12-1 | Owner go-live gate | human | **passed 2026-10-29** (personal account; run 40961373692) |
| L99 | 12-2 | LIVE-05 live half | human | P13 = L86 |

Tally by primary class: smoke 5 (L01, L02, L06, L64, L94), smoke + human 1 (L87), human 74, owner-decision 15, cut 4 (L23, L24, L71, L97) = 99. The planner may re-cut, but the 99 ids must all survive. Recommended additional P13 rows (new, not origin rows): P13-1 GTM-01 fresh-profile portal walk, P13-2 first-deploy D-13 facts (404 status, `head_sha`, HTTPS redirect, propagation seconds), P13-3 shared-origin copy decision (Pitfall 7), P13-4 Umami "IP not stored" evidence.

Realistic burn-down in Phase 13: the smoke rows plus the GTM/live-origin human rows (L01-L03, L06, L26, L36, L64, L82-L88, L94, L98-L99). The device, real-key and counsel rows get honest `pending` results with owner + target date, which is allowed: the ledger records results, it does not require every human row to pass in this phase.

## Runbook facts (research questions 4 and 11)

| Topic | Fact | Source |
|-------|------|--------|
| Redeploy | `git commit --allow-empty -m "chore: redeploy" && git push`. `workflow_dispatch` of `ci` deploys nothing (gate requires `push`). | `ci.yml` |
| Roll back (preferred) | `git revert <bad-sha> && git push`, then watch `ci`, `deploy` and `live-smoke` on the revert SHA | standard |
| Roll back (alternative) | Actions -> previous green `ci` run -> "Re-run all jobs" (same SHA/ref, rebuilds about 27 min, up to 30 days). "Re-run deploy job" only within 1 day of that run (Pages artifact `retention-days: 1`). Re-runs use the original actor's privileges. | upload-pages-artifact v5.0.0 `action.yml`; GitHub re-run docs |
| Read a live-smoke result | Run page summary (`github` reporter annotations); artifact `live-smoke-traces` (14 days) -> `npx playwright show-trace <zip>`. Exit codes of `scripts/smoke.mjs`: 0 ok, 1 suite failed, **2 precondition** (env gate: URL/SHA/host malformed, or variables unset), **3 version never propagated within 10 min** (deploy failed or CDN), **4 over the 5-minute budget** (local three-target mode only). | `scripts/smoke.mjs` header |
| Web E2E workers | `playwright.config.ts` sets no `workers`, so Playwright's default (half the logical CPUs) applies. CI ubuntu-24.04 (4 vCPU): **2** (log: "using 2 workers", all legs). Dev machine (16 logical): default would be 8, but 10-23 recorded "8 workers -> 6 x 30 s timeouts; re-run at 4 workers: green" -> known-good **`--workers=4`**. Retries: CI 1, local 0. | config + run 40980243892 log + 10-23-SUMMARY |
| Smoke workers | `playwright.smoke.config.ts`: `workers: process.env.CI ? 2 : 4`, retries 0, `failOnFlakyTests`, `globalTimeout` 300 s | config |
| Extension E2E | `workers: 1`, timeout 60 s, CI retries 1 | `apps/extension/playwright.config.ts` |
| Vitest | Root `vitest.config.ts` projects (web, core, brand, scripts, web-browser, extension); no `maxWorkers`/pool pinned, so Vitest defaults apply. CI: 349 files in 117-121 s. Dev: default, but run alone (lessons: precommit test once failed under four parallel executors, Phase 15). | config + CI log |
| Fresh-profile rule | New InPrivate window after every redeploy (HTML `max-age=600`, observed) | DEPLOY-CHECKLIST + live headers |
| Variables table | `PAGES_ENABLED` (deploy gate + live-smoke gate), `PUBLIC_SITE_URL` (all ci legs' env, `targetEnv` passes it to root+sub; live-smoke; extension-release), `BASE_PATH` (root leg + extension-release + live-smoke), `PUBLIC_ANALYTICS_HOST`/`_WEBSITE_ID`, `PUBLIC_WEB3FORMS_KEY`, `PUBLIC_CONTACT_EMAIL` (root leg only; analytics host also live-smoke), `EXTENSION_RELEASES_ENABLED` (extension-release) | workflows |

## State of the Art

| Old assumption | Current reality | Impact |
|----------------|-----------------|--------|
| Org root site `tranrealestate.github.io` | Project site `wolfwdavid.github.io/tran_real_estate/` on an origin with ~250 sibling sites | Pattern 1/2, Pitfalls 6/7 |
| "77 owner rows" | 99 rows by an explicit rule | Ledger header |
| Cache-busting query defeats the Pages CDN | Query string appears not to be in the cache key; deploy purge is what makes the poll work | Measure at first deploy |
| Re-run deploy = easy rollback | Artifact lives 1 day by default | RUNBOOK caveat |

## Open Questions

1. **Does GitHub purge the Pages CDN on deploy fast enough for the 10-minute poll?** Known: TTL 600 s, query ignored. Unclear: purge latency. Recommendation: log elapsed seconds in `waitForVersion`, record at first deploy (D-13 evidence).
2. **Umami "IP addresses not stored" setting.** Known: Umami states it collects no personal data. Unclear: a UI toggle does not appear to exist. Recommendation: the owner records what the dashboard/policy says; treat it as an `owner-decision` row rather than blocking D-17.
3. **`@types/node` major (PR #7) will reappear** for the next major release after closure. Recommendation: either add `@types/node` major to the D-06 ignore list with a Phase 14 comment, or accept the reopen. It is the owner's call; D-06 does not list it.
4. **Does the `completed` `workflow_run` fire for a re-run of `ci`?** Docs imply yes (only `requested` is excluded). Verify on the first rollback drill if one is done.
5. **D-02 literal vs gated `BASE_PATH` expression.** Both are root-only in effect; this research recommends the gated form (see "Tests that move").
6. **`CLAUDE.md` Origin override line** contradicts the locked decisions. It needs an owner-approved edit (project instructions); planner adds it to the reconciliation plan as an owner checkpoint.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.12 (scripts project for gate/text tests), Playwright 1.63.0 (E2E + smoke), actionlint 1.7.12 |
| Config files | `vitest.config.ts` (projects), `apps/web/playwright.config.ts`, `apps/web/playwright.smoke.config.ts`, `scripts/actionlint.mjs` |
| Quick run command | `pnpm vitest run --project scripts` (gate, site-url, supply-chain, deploy-checklist, launch-audit tests; about 30 s) |
| Full suite command | `pnpm verify` (serialized; chunk Playwright into ≤5-minute calls per lessons) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIVE-02 | First CI green, deploy skipped | evidence | `gh run view 40961373692 --repo wolfwdavid/tran_real_estate --json jobs` (recorded links) | n/a (observed) |
| LIVE-03 | Root leg builds/tests with `BASE_PATH`; live routing contract | unit + E2E + live smoke | `pnpm vitest run scripts/workflow-gate.test.ts scripts/build-targets.test.ts`; local rehearsal `BASE_PATH=/tran_real_estate` root build + `pnpm --filter web exec playwright test --project=root` + `pnpm smoke:local --target root`; live: `live-smoke` run green on the go-live SHA (`routing.smoke.ts`) | ✅ (tests updated) |
| LIVE-03 | Production twin | local smoke | `pnpm smoke:local --target sub` (exact production paths after D-03) | ✅ |
| LIVE-05 live | Search Console slot + verify | unit + human | `pnpm vitest run scripts/app-html.test.ts` (token line passes the pinned regex); owner screenshot | ✅ |
| LIVE-06 | GTM proofs | smoke + human | `analytics.smoke.ts`, `seo.smoke.ts` in the live run; ledger rows L82-L86 with screenshots | ✅ specs / ❌ ledger |
| LIVE-07 | Ledger complete, 99 ids, no row dropped | unit (text oracle) | NEW `scripts/human-uat-ledger.test.ts`: parses the twelve files with the counting rule and asserts every `<phase>-<row>` id appears exactly once in `.planning/HUMAN-UAT.md` with a class in {smoke, human, owner-decision, cut}, and each per-phase file has `status: superseded` | ❌ Wave 0 (recommended) |
| LIVE-07 | Audit regenerated at deployed SHA, base URL names the live origin | unit + generated doc | `pnpm vitest run scripts/launch-audit.test.ts` (header follows `resolveSiteUrl`); `grep "Base URL audited: https://wolfwdavid.github.io/tran_real_estate/" docs/LAUNCH-AUDIT.md` | ✅ (update) |
| LIVE-08 regression | `BASE_PATH` alone changes web URLs + extension privacy URL + oracle allowlist | unit | `pnpm vitest run scripts/site-url.test.ts scripts/assert-extension.test.ts` (new base-path group: stub `BASE_PATH`, assert `__TRAN_SITE_URL__`, `urlAllowlist`, `resolveSiteUrl`) | ✅ (extend) |
| LIVE-09 | RUNBOOK sections present | unit (text oracle) | NEW `scripts/runbook.test.ts`: headings (variables, redeploy, roll back, read a smoke result, worker counts, fresh-profile, Dependabot, synthetic pageview), exit codes 2/3/4, `retention-days` caveat, `--workers=4` | ❌ Wave 0 (recommended) |
| SMOKE-04 | `live-smoke.yml` shape | unit + lint | `pnpm vitest run scripts/live-smoke-gate.test.ts` + `pnpm lint:workflows` | ❌ Wave 0 |
| SMOKE-04 | Live behaviour | live | the first `live-smoke` run: skipped while `PAGES_ENABLED` unset (run link), green on the go-live SHA (run link), `head_sha` recorded | n/a (live) |
| D-06 | Dependabot ignores | unit | `pnpm vitest run scripts/supply-chain.test.ts` (ignore block assertions) | ✅ (extend) |
| DEPLOY-CHECKLIST | rewritten headings/URLs | unit | `pnpm vitest run scripts/deploy-checklist.test.ts scripts/extension-docs.test.ts` | ✅ (update) |

### Sampling Rate
- **Per task commit:** `pnpm vitest run --project scripts` (+ `pnpm lint:workflows` for workflow commits; workflow + gate test are one two-file commit)
- **Per wave merge:** `pnpm check && pnpm lint && pnpm test:unit`; after the base-path wave, the local `BASE_PATH` rehearsal (Pattern 1) and `pnpm smoke:local`
- **Phase gate:** full `pnpm verify` green, then a green `ci` + `deploy` + `live-smoke` trio on the same SHA (run links in the proof bundle) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/live-smoke-gate.test.ts`: SMOKE-04 (new)
- [ ] `scripts/human-uat-ledger.test.ts`: LIVE-07 no-row-dropped oracle (recommended)
- [ ] `scripts/runbook.test.ts`: LIVE-09 (recommended)
- [ ] Extend `scripts/site-url.test.ts` (base-path group), `scripts/workflow-gate.test.ts`, `scripts/extension-release-gate.test.ts`, `scripts/supply-chain.test.ts`, `scripts/build-targets.test.ts`, `scripts/launch-audit.test.ts`, `scripts/deploy-checklist.test.ts`
- [ ] No framework install needed

## Sources

### Primary (HIGH)
- Live, read-only `gh`: `gh run list/view` (runs 40961373692, 40965347969, 40980243892 jobs and logs), `gh api repos/wolfwdavid/tran_real_estate/{pages,actions/variables,environments,actions/runs/40980243892}`, `gh pr list` (PR #1-#7 checks), `gh api users/wolfwdavid/repos` (has_pages)
- GitHub API releases + tag commits: `actions/upload-artifact` v7.0.2 `cf430e03...`, `actions/checkout` v7.0.1 `3d3c42e5...`, `actions/setup-node` v7.1.0 `949feb24...`, `pnpm/action-setup` v6.1.0 `ea17c68d...`, `actions/upload-pages-artifact` v5.0.0 `fc324d35...`, `actions/deploy-pages` v5.0.1 `368f8252...`
- `action.yml` at those tags: upload-artifact v7.0.2 inputs; upload-pages-artifact v5.0.0 (`retention-days` default "1", hidden-file exclusion); deploy-pages v5.0.1 inputs
- [Events that trigger workflows: workflow_run](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [Re-running workflows and jobs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)
- [Dependabot options reference](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference)
- [Google: create a robots.txt file](https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt)
- [Umami pricing](https://umami.is/pricing)
- Repo files read today: `ci.yml`, `extension-release.yml`, `dependabot.yml`, `workflow-gate.test.ts`, `extension-release-gate.test.ts`, `site-url.test.ts`, `assert-extension.mjs(+test)`, `build-targets.mjs`, `site-config.js`, `base-path.js`, `site.ts`, extension `site.ts`/`wxt.config.ts`/both Vitest configs, `smoke.mjs`, `tests/smoke/*`, both Playwright configs, `serve-pages.mjs`, `launch-audit.mjs`, `deploy-checklist.test.ts`, `supply-chain.test.ts`, `service-worker.ts`, all twelve HUMAN-UAT files

### Secondary (MEDIUM)
- Live curl probes (2026-10-29): `http://` -> 301 absolute https; slashless project dir -> 301 absolute; sibling SvelteKit site 404 page with HTTP 404; `Cache-Control: max-age=600`; `X-Cache: HIT` on a fresh query string; Umami preflight ACAO `*`; Web3Forms preflight 403 from curl; LinkedIn/Facebook tool URLs answer 200
- [Umami Cloud FAQ](https://umami.is/docs/cloud/faq), [toolpick Umami pricing](https://www.toolpick.dev/pricing/umami) (free-tier cross-check)

### Tertiary (LOW)
- Umami IP handling and absence of a "store IP" toggle ([macmyths write-up](https://macmyths.com/what-umami-analytics-tracks-and-what-it-doesnt/), [openapps.pro](https://openapps.pro/apps/umami)); Umami bot drop body (12-RESEARCH); Search Console project-site specifics ([bluehost URL-prefix overview](https://www.bluehost.com/blog/?p=267786)); whether `ignore` affects security updates

## Metadata

**Confidence breakdown:**
- Standard stack / pins: HIGH (GitHub API + `action.yml` at the tags)
- Architecture (base-path blocker, live-smoke shape): HIGH (read from code; `workflow_run` semantics from official docs + live run object)
- Pages behaviour: HIGH for redirects and the 404 status (live, same origin); MEDIUM for CDN purge timing
- GTM services: MEDIUM (Umami pricing/CORS HIGH; IP-setting LOW)
- UAT enumeration: HIGH for counts (scripted); classification is a proposal for the planner

**Research date:** 2026-10-29
**Valid until:** 2026-11-12 (live GitHub state and Dependabot PRs move weekly; re-check `gh variable list` and PR state at plan time)
