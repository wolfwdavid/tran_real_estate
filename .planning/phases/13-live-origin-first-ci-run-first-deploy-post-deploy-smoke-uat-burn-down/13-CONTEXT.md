# Phase 13: Live Origin: First CI Run, First Deploy, Post-Deploy Smoke & UAT Burn-down - Context

**Gathered:** 2026-10-29 (auto mode; recommended defaults, reviewed against the live GitHub state)
**Status:** Ready for planning

<domain>
## Phase Boundary

The v1.0 build goes live on the owner's personal-account project site, CI proves itself on GitHub, every
deploy of `main` is followed automatically by the live smoke, GTM-01..04 are proven or cut, and the owner
holds a runbook, a dated launch-proof bundle and one consolidated human-UAT ledger. Requirements:
LIVE-02, LIVE-03, LIVE-06, LIVE-07, LIVE-09, SMOKE-04, plus LIVE-05's live half (Search Console) and
the GTM-01..04 proofs.

**Origin correction (owner decision 2026-10-29, Phase 12 gate):** there is no `tranrealestate` org. The
repo is `wolfwdavid/tran_real_estate`; the live origin is `https://wolfwdavid.github.io/tran_real_estate/`.
Every ROADMAP / REQUIREMENTS sentence that says `https://tranrealestate.github.io/` means that URL. The
first plan of this phase edits ROADMAP.md (Phase 13 goal + success criteria 2, 3) and REQUIREMENTS.md
(LIVE-02, LIVE-03) to the real origin and records the reconciliation in PROJECT.md Key Decisions.

**Already true when planning started (do not re-plan as work):** `main` and `v1.0` are pushed; three
`ci` runs on `main` are green with `deploy` skipped (40961373692, 40965347969, 40980243892); Pages
`build_type=workflow`, `https_enforced=true`, `github-pages` environment exists; secret scanning, push
protection and Dependabot are on; no repository variables exist yet. Success criterion 1 is therefore
observed, not pending: record the three run links and the per-leg durations (root 21m52s, sub 26m13s,
configured 5m36s on run 40965347969) as the CI baseline.

</domain>

<decisions>
## Implementation Decisions

### Origin and base path mechanism (the sub-path deploy)
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

### Dependabot triage (surfaced by the first live CI runs)
- **D-06:** `.github/dependabot.yml` ignores **major** updates for the Phase 16 toolchain set
  (`@sveltejs/kit`, `@sveltejs/adapter-static`, `vitest`, `@vitest/*`, `vitest-browser-svelte`, and
  `pnpm` if it ever appears) with a comment naming Phase 16; the weekly minor/patch group stays.
- **D-07:** The open major PRs (#2, #3, #5, #6) are **closed** with a one-line comment pointing at
  Phase 16. The failing 20-package minor/patch group PR (#4) and `@types/node` 24 -> 26 (#7, a major)
  are closed too; their bumps are re-evaluated in Phase 14/16 by the normal `pnpm audit` gate, not merged
  blind in this phase. The `actions/setup-node` 7.0.0 -> 7.1.0 PR (#1) is merged only if its CI is green
  and `scripts/workflow-gate.test.ts` still passes on that tree; otherwise closed.
- **D-08:** No dependency pin changes in Phase 13 beyond what a red CI run forces at the root cause.

### `live-smoke.yml` shape (SMOKE-04)
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

### GitHub-side actions: who does what
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

### GTM proofs and cut lines (LIVE-06, LIVE-05 live half)
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

### UAT ledger, launch-proof bundle, runbook (LIVE-07, LIVE-09)
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and prior decisions
- `.planning/ROADMAP.md` §"Phase 13" (lines ~94-107) — goal, success criteria 1-5, owner steps, research flag; URLs to be corrected per D-01..D-05
- `.planning/REQUIREMENTS.md` — LIVE-02, LIVE-03, LIVE-05, LIVE-06, LIVE-07, LIVE-09, SMOKE-04 wording and the LIVE-05 split note
- `.planning/PROJECT.md` §"Key Decisions" (personal-account row), §"Out of scope" (line to supersede), §"Current Milestone"
- `.planning/HANDOFF-2026-10-29-phase13.md` — the interrupted planning session and its findings (its `PUBLIC_SITE_URL` suggestion is overridden by D-01/D-02)
- `.planning/phases/12-go-live-readiness-local-smoke-suite/deferred-items.md` — owner decision at the 12-10 gate and the consequences handed to Phase 13
- `.planning/phases/12-go-live-readiness-local-smoke-suite/12-HUMAN-UAT.md` — gate result (run 40961373692) and the pending LIVE-05 live half
- `.planning/phases/12-go-live-readiness-local-smoke-suite/12-RESEARCH.md` — smoke suite contract, remote-mode poll, GPC-off single beacon, checklist order, Search Console slot
- `.planning/milestones/v1.0-ROADMAP.md` §"Phase 10" cut line (GTM-04 → v2 if Umami fails from the deployed origin)
- `tasks/lessons.md` — orchestration rules (no trailers, serialize builds, 7-minute tool-call cap, audit first on resume, no flake write-offs)

### UAT rows to consolidate (LIVE-07)
- `.planning/phases/*/??-HUMAN-UAT.md` (twelve files, Phases 01-12) — every owner row; `10-HUMAN-UAT.md` holds the GTM rows, `11-HUMAN-UAT.md` the extension rows

### Workflows, smoke harness and oracles
- `.github/workflows/ci.yml` — deploy gate (`vars.PAGES_ENABLED`), root-leg variable wiring, 7 pinned `uses:` lines
- `.github/workflows/extension-release.yml` — reads `PUBLIC_SITE_URL`; must also read `BASE_PATH` (D-02)
- `.github/dependabot.yml` — current weekly config (D-06)
- `scripts/workflow-gate.test.ts`, `scripts/extension-release-gate.test.ts` — the gate-test shape to copy for `scripts/live-smoke-gate.test.ts`
- `scripts/smoke.mjs` — remote mode (`pnpm smoke`), `waitForVersion`, exit codes 0-4
- `apps/web/tests/smoke/env.js` — fail-closed env gate (`SMOKE_BASE_URL` https + trailing slash, 40-hex `SMOKE_EXPECT_VERSION`, `SMOKE_ANALYTICS_HOST` origin)
- `apps/web/tests/smoke/fixtures.ts` — GPC-on monitor, provider-host block, beacon budget
- `apps/web/tests/smoke/*.smoke.ts`, `apps/web/playwright.smoke.config.ts` — the ten specs, 2 CI workers, zero retries
- `scripts/lib/build-targets.mjs` — `targetEnv` (root forces `BASE_PATH: ''` today, D-02 changes that)
- `apps/web/src/lib/site-config.js`, `apps/web/src/lib/base-path.js`, `apps/web/src/lib/site.ts` — origin validator, `BASE_PATH` validator, `SITE_URL = origin + base`
- `apps/extension/src/lib/site.ts`, `apps/extension/wxt.config.ts`, `scripts/assert-extension.mjs` — `TRAN_ORIGIN`/`PRIVACY_URL` and the URL allowlist (D-04)
- `scripts/site-url.test.ts` — the LIVE-08 proof to extend with the base-path case
- `apps/web/svelte.config.js` — `paths.base`, `version.name`, prerender origin, CSP

### Owner-facing docs
- `docs/DEPLOY-CHECKLIST.md` — Steps 1-9 (rewrite to the personal-account reality; a scripts test pins step headings and hosts)
- `docs/EXTENSION-INSTALL.md`, `apps/extension/store/edge-listing.md` — privacy URL lines to update
- `docs/LAUNCH-AUDIT.md` (generated by `scripts/launch-audit.mjs`) — regenerate at the deployed commit (D-22)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/smoke.mjs` remote mode already does everything `live-smoke.yml` needs (env gate, 10-minute
  version poll, Playwright run with `--fail-on-flaky-tests`); the workflow is wiring, not new logic.
- `scripts/workflow-gate.test.ts` is the template for `scripts/live-smoke-gate.test.ts` (string-level
  assertions on triggers, pins, conditions, env wiring, URL allowlist).
- `apps/web/src/lib/site.ts` already composes `SITE_URL = origin + BASE_PATH` for canonical/OG/sitemap;
  only the extension and the CI root leg lack the base path.
- `scripts/launch-audit.mjs` (`pnpm audit:launch`) regenerates `docs/LAUNCH-AUDIT.md`.
- `scripts/serve-pages.mjs` serves the `sub` build at `/tran_real_estate/` on 4274: the local twin of the
  live site once D-03 lands.
- `gh` CLI is authenticated as the owner on the dev machine (`gh auth status`), so owner checkpoints can
  be verified immediately (`gh run list`, `gh api repos/.../pages`, `gh variable list`).

### Established Patterns
- Owner settings reach only the root (deploy) leg; `sub` blanks them; `configured` overrides them with
  test values. `BASE_PATH` must follow the same root-only rule (D-02).
- Pinned-SHA actions with a `uses:` count test; gitleaks pinned by version + SHA-256; no third-party URLs
  in workflows except the gitleaks release download.
- Zero retries, `--fail-on-flaky-tests`, never raise a timeout to pass; measured numbers with root-cause
  comments only.
- Generated docs (`LAUNCH-AUDIT.md`) are never hand-edited; HUMAN-UAT results live in `.planning`.
- Commit messages: focused on the change, no assistant attribution (CI hygiene job enforces it on the
  whole history).

### Integration Points
- `ci.yml` root leg env blocks (Build, CSP, SEO, E2E, extension) gain `BASE_PATH: ${{ vars.BASE_PATH }}`;
  the gate test's exact-string expectations move with it.
- `scripts/lib/build-targets.mjs` `targetEnv('root')` honours `env.BASE_PATH`; `scripts/smoke.mjs`
  `localTargets()` already derives `siteUrl` from `resolveBasePath(e)`.
- New: `.github/workflows/live-smoke.yml`, `scripts/live-smoke-gate.test.ts`, `docs/RUNBOOK.md`,
  `docs/launch-proof/<date>/`, `.planning/HUMAN-UAT.md`.
- Edits: `apps/web/src/lib/site-config.js` (default origin, shared origin+base helper),
  `apps/extension/src/lib/site.ts` + `wxt.config.ts` + both extension Vitest configs (`__TRAN_ORIGIN__`
  → origin+base or a second define), `scripts/assert-extension.mjs` allowlist, `.github/dependabot.yml`,
  `docs/DEPLOY-CHECKLIST.md`, `docs/EXTENSION-INSTALL.md`, `apps/extension/store/edge-listing.md`,
  privacy page copy, `apps/web/src/app.html` (Search Console token, owner-supplied), ROADMAP /
  REQUIREMENTS / PROJECT origin reconciliation.

</code_context>

<specifics>
## Specific Ideas

- The live origin is a project site under the owner's account: `https://wolfwdavid.github.io/tran_real_estate/`.
  Two variables express it: `PUBLIC_SITE_URL=https://wolfwdavid.github.io` and `BASE_PATH=/tran_real_estate`.
- "Deploy what you test": after D-02/D-03 the local `sub` build is byte-for-byte the production layout
  minus owner settings, so `pnpm smoke:local --target sub` is the pre-flight for every live change.
- Success criterion 1 is already satisfied by observation; the plan records evidence, it does not
  re-run anything to "make" it true.
- Order of operations is fixed by D-14: code green on `main` → variables → `PAGES_ENABLED=true` + empty
  commit → observe deploy + live-smoke → human checks → GTM proofs → ledger, bundle, runbook, audit.

</specifics>

<deferred>
## Deferred Ideas

- Custom domain (would remove the shared-origin storage trade-off) — future milestone, variable change by design (LIVE-08).
- The 20-package minor/patch Dependabot group and `@types/node` 26 — re-evaluate in Phase 14 (debt) / Phase 16 (toolchain), never merged blind.
- Kit 3 / Vitest 5 Dependabot PRs — Phase 16 by roadmap; dependabot.yml ignores them until then (D-06).
- The `configured` CI leg finishing in ~6 min while `root`/`sub` take 22-26 min: find out why (Playwright project scope vs. a silently skipped step) — Phase 15 (deterministic lanes), noted here so it is not lost.
- `scripts/precommit.test.ts` once failed under four parallel executors (Phase 12 deferred item) — Phase 15.
- Edge Add-ons submission and `ext-v0.1.0` release — Phase 17 (needs the live privacy URL from this phase).

### Reviewed Todos (not folded)
None — `gsd-tools todo match-phase 13` returned no pending todos.

</deferred>

---

*Phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down*
*Context gathered: 2026-10-29*
