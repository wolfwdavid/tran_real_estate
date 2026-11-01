---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
verified: 2026-11-01T17:35:00Z
status: human_needed
score: 4/5 success criteria fully verified; criterion 4 verified except one explicitly carried item (Search Console sitemap read, LIVE-05 live half)
human_verification:
  - test: "Search Console > Sitemaps for property https://wolfwdavid.github.io/tran_real_estate/: read the row for sitemap.xml"
    expected: "Status Success with 14 discovered pages; then add docs/launch-proof/2026-10-30/41-search-console-sitemap.png, set ledger rows L86/L99 to passed, tick LIVE-05 and set its traceability row to Complete. If still 'Couldn't fetch' on 2026-11-04: resubmit once with the full URL, then investigate."
    why_human: "Google's sitemap processing is external and only visible in the owner's signed-in Search Console; carried by owner decision 2026-11-01 (target 2026-11-04)"
  - test: "Work the 68 ledger rows still 'pending (owner)' in .planning/HUMAN-UAT.md (device installs, real-key RentCast/LLM journeys, counsel review, contact-email decision)"
    expected: "Each row moves to passed/failed/cut/decided with evidence"
    why_human: "Physical devices, real paid/free keys and legal judgement; out of scope of the phase goal, which is consolidation and reclassification, not completion"
---

# Phase 13: Live Origin: First CI Run, First Deploy, Post-Deploy Smoke & UAT Burn-down Verification Report

**Phase Goal:** The v1.0 build is live at `https://wolfwdavid.github.io/tran_real_estate/`, CI has proven itself on GitHub, every deploy of `main` is followed automatically by the live smoke, the GTM proofs are ticked or cut, and the owner holds a runbook, a launch-proof bundle and one consolidated human-UAT ledger instead of 99 scattered rows.
**Verified:** 2026-11-01T17:35:00Z
**Status:** human_needed (one carried external item; no code or documentation gap)
**Re-verification:** No (initial verification)

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence (gathered live / from the repo, not from SUMMARYs) |
|---|-------|--------|-------------------------------------------------------------|
| 1 | First GitHub `ci.yml` run on `main` green with deploy skipped while `PAGES_ENABLED` unset | VERIFIED | `gh run list --workflow ci.yml`: 41099425596 (`f26cf24`) and 41106746719 (`ab70bbb`) push/success before go-live; 41089068534 and the three baseline runs recorded in REQUIREMENTS LIVE-02 and the proof README runs table. Close-out run 41218226897 jobs: hygiene, root, sub, configured legs and deploy all `success`. The only non-green runs are a `pull_request` failure (44cf92c, Dependabot triage) and 41199555797 (`5ebdf79`) cancelled after an `audit:deps` advisory, fixed at the root in `f169749` (advisory exception recorded), not retried. |
| 2 | Push with `PAGES_ENABLED=true` deploys; fresh visitor sees landing 200, `/renter` -> `/renter/`, deep route survives refresh, branded 404 with HTTP 404, HTTPS enforced | VERIFIED | Live curl 2026-11-01: `/` 200, title "Tran Real Estate Tools: tools for renters, investors, and agents"; `/renter` 301 -> `https://wolfwdavid.github.io/tran_real_estate/renter/`; `/renter/` 200; `/does-not-exist-verify13/` 404; `http://` 301 -> `https://`; `Strict-Transport-Security: max-age=31556952`; `/legal/privacy/`, `/feedback/`, `/manifest.webmanifest` 200. `checks.json` (2026-10-30T19:35Z, `ad5fd08`) all five checks `ok: true`. 404 body is the SPA fallback shell; branded title renders client-side (documented, screenshot `04-not-found.png`, `routing.smoke.ts`). Deep-route refresh: `03-deep-route-refresh.png` + smoke. Owner fresh-profile result recorded in ledger L01/P13-2. |
| 3 | Every completed `ci.yml` on `main` followed by `live-smoke.yml` (workflow_run + dispatch with URL input), polls `version.json` to the deployed SHA, fails on any assertion; ci.yml uses count unchanged; own gate test | VERIFIED | `.github/workflows/live-smoke.yml`: `workflow_run: workflows [ci], types [completed], branches [main]` + `workflow_dispatch` with `base_url` (required) and `expect_version`; job gated on `PAGES_ENABLED` and green push to main; checks out `workflow_run.head_sha`; `SMOKE_EXPECT_VERSION` = head_sha. `ci.yml` has 7 `uses:` (unchanged). `gh run list --workflow live-smoke.yml`: one live-smoke per ci push run (skipped pre-go-live / on the cancelled run, real afterwards). Failing-run behaviour proven twice: 41115004823 (`ad5fd08`, precache wait) and 41220466187 (`7372b61`, 35 failed, 92 log lines mention 429). Green: 41149881068, 41202355014, 41220812811 (log: "7372b61... live at ... after 0 s", "121 passed"). Live `/_app/version.json` = `7372b611be76dda8ffc8943b4a7cfde33cb22932` = `origin/main`. `scripts/live-smoke-gate.test.ts` green. |
| 4 | GTM-01..03 ticked with live proof; GTM-04 ticked or cut with decision in PROJECT.md; Search Console verified with `sitemap.xml` submitted and read (LIVE-05 live half) | PARTIAL (carried, owner-decided) | GTM-01 `21-gtm01-sample-data.png` (viewed: "10 rentals in 74201", Sample data badges). GTM-02 `20-web3forms-inbox.png` (viewed: "Tran feedback: Free calculators" + "Tran waitlist: Renter", no addresses). GTM-03 `30-linkedin-card.png` (viewed: cap-rate card on wolfwdavid.github.io) + `31-og-validator-card.png` (D-18 substitution for the login-walled Facebook debugger, documented in README "Substitutions"). GTM-04 cut by owner decision P13-4 (b) before any analytics existed; recorded in PROJECT.md Key Decisions line 248 and REQUIREMENTS v2 line 90 (the plan's documented cut line). Search Console: live page has exactly 1 `<meta name="google-site-verification" content="Na8x...">`; `40-search-console-verified.png` (viewed: "You are a verified owner"); sitemap submitted. Live sitemap.xml 200 with 14 `<loc>`; robots.txt carries the `Sitemap:` line. NOT met: Search Console has not read the sitemap ("Couldn't fetch" after ~28 h). Carried by owner decision 2026-11-01 to 2026-11-04; LIVE-05 correctly left unticked; ledger L86/L99 `carried`; README row `41-search-console-sitemap.png` marked pending, never fabricated. |
| 5 | 99 HUMAN-UAT rows reclassified into one ledger with results; launch-proof bundle committed; LAUNCH-AUDIT regenerated at deployed commit; runbook covers redeploy, rollback, reading a smoke result, worker counts | VERIFIED | `.planning/HUMAN-UAT.md`: 99 `L` rows + P13-1..4, counting rule documented; tally: 7 smoke/smoke+human rows all `passed` with `/actions/runs/` links, 8 human passed + P13 rows, 5 cut, 12 carried, 3+2 decided, 68 pending owner action with targets. `scripts/human-uat-ledger.test.ts` green. Bundle `docs/launch-proof/2026-10-30/` (10 PNGs, checks.json, README index, 1640 KB). `docs/LAUNCH-AUDIT.md` header "Commit: f169749", 9/9 PASS, 0 FAIL; `git diff --stat f169749..HEAD -- apps packages scripts .github` is empty, so the audited code is the deployed code. `docs/RUNBOOK.md` sections: Redeploy, Roll back (revert + push preferred; re-run alternative), Read a live-smoke result, Run the suites locally (Vitest, E2E `--workers=4` dev / 2 in CI, smoke 4/2, extension 1), Fresh-profile rule, First deploy facts. `scripts/runbook.test.ts` green. |

**Score:** 4/5 fully verified; criterion 4 partial with an explicitly carried, owner-decided external item.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/live-smoke.yml` | Post-deploy smoke workflow | VERIFIED | Substantive, triggers and gates correct, exercised by 8 real runs |
| `scripts/live-smoke-gate.test.ts` | Gate test for live-smoke.yml | VERIFIED | Green in the scripts project |
| `.github/workflows/ci.yml` | BASE_PATH wiring, 7 pinned actions, gated deploy | VERIFIED | 7 `uses:`; `BASE_PATH` only on the root leg; deploy job success on 4 deploys |
| `.planning/HUMAN-UAT.md` + `scripts/human-uat-ledger.test.ts` | One ledger, no row dropped | VERIFIED | 103 rows, oracle green |
| `docs/launch-proof/2026-10-30/` | Dated screenshots + run links | VERIFIED | Every run and file indexed; red and green runs on 7372b61 both recorded (README line 36) |
| `docs/RUNBOOK.md` + `scripts/runbook.test.ts` | Owner runbook with oracle | VERIFIED | All required sections; oracle green |
| `docs/LAUNCH-AUDIT.md` + `docs/audit/` | Regenerated at deployed commit | VERIFIED | Commit f169749, all PASS |
| `docs/launch-proof/2026-10-30/41-search-console-sitemap.png` | Sitemap read proof | CARRIED | Intentionally absent; README states pending, owner target 2026-11-04 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| ci.yml (push main) | GitHub Pages | `deploy` job, `PAGES_ENABLED` | WIRED | 41218226897 deploy success; live version.json = 7372b61 |
| ci.yml completion | live-smoke.yml | `workflow_run` | WIRED | Each ci push run has a matching live-smoke run with the same head SHA |
| live-smoke.yml | deployed SHA | `SMOKE_EXPECT_VERSION` = `workflow_run.head_sha`, version.json poll | WIRED | Logs "live at ... after 0 s" for the expected SHA |
| app.html meta slot | Search Console | `google-site-verification` meta | WIRED | Exactly one tag live; property verified |
| sitemap.xml | Search Console read | Google fetch | NOT YET (external) | Googlebot-UA fetch 200 / 14 URLs per records; Search Console row "Couldn't fetch"; carried |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| LIVE-02 | First CI green with deploy skipped | SATISFIED | Truth 1 |
| LIVE-03 | Live deploy and routing contract | SATISFIED | Truth 2, live curl today |
| LIVE-05 (live half) | Search Console verified, sitemap submitted and read | PARTIAL / CARRIED | Verified + submitted; read pending; correctly unticked in REQUIREMENTS (`[ ]`, traceability "Pending") |
| LIVE-06 | GTM-01..03 proven, GTM-04 cut per cut line | SATISFIED | Truth 4 (GTM-04 cut recorded in PROJECT.md Key Decisions) |
| LIVE-07 | Ledger reclassified, bundle, audit regenerated | SATISFIED | Truth 5 |
| LIVE-09 | Runbook | SATISFIED | Truth 5 |
| SMOKE-04 | live-smoke.yml after every deploy, gate test, ci uses count unchanged | SATISFIED | Truth 3 |

No orphaned requirements: ROADMAP maps LIVE-02, LIVE-03, LIVE-06, LIVE-07, LIVE-09, SMOKE-04 to Phase 13, all claimed; LIVE-05's live half is explicitly routed here by the Phase 12 note.

### Hygiene Checks

| Check | Result |
|-------|--------|
| E-mail-shaped byte scan of every file in `docs/launch-proof/2026-10-30/` (PNGs, checks.json, README) | 0 matches per file; no `gmail`/owner address, `ghp_`, `github_pat_`, `sk-` strings |
| Visual check of 20, 21, 30, 40 PNGs | No e-mail addresses or account identifiers visible; inbox crop shows display name and subjects only |
| `git diff --stat f169749..HEAD -- apps packages scripts .github` | Empty (docs-only rule held for 12 commits) |
| `pnpm vitest run --project scripts` | 34 files, 1049 tests passed (includes ledger, runbook and live-smoke gate oracles: 77 tests) |
| `pnpm lint` | Prettier clean, ESLint clean |
| Red chained run kept in the record | Yes: README runs table row for `7372b61` lists 41220466187 failure (429) and 41220812811 success; PROJECT.md Current State repeats both |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/smoke.mjs` (behaviour) | n/a | HTTP 429 from the Pages CDN fails the chained live-smoke as a test failure instead of an env precondition (exit 2) | Warning | A rate-limit can paint a deploy red with no code fault (happened on 7372b61); documented as open hardening in README line 38 and PROJECT.md. Not a goal blocker. |
| local `main` | n/a | 3 docs-only commits (`4dd2d33`, `5421807`, `2106804`) not yet pushed to `origin/main` | Info | Orchestrator's push; the remote ledger and README do not yet carry the "carried" wording until pushed |

No TODO/placeholder or stub patterns relevant to the goal; the only "pending" proof file is honestly labeled.

### Human Verification Required

#### 1. Search Console sitemap read (LIVE-05 live half)

**Test:** Open Search Console for `https://wolfwdavid.github.io/tran_real_estate/` > Sitemaps and read the `sitemap.xml` row.
**Expected:** Status Success, 14 discovered pages. Then capture `41-search-console-sitemap.png`, set L86/L99 to passed, tick LIVE-05.
**Why human:** Google-side processing visible only in the owner's account. Carried by owner decision 2026-11-01, target 2026-11-04.

#### 2. Remaining owner ledger rows

**Test:** Work the 68 `pending (owner)` rows in `.planning/HUMAN-UAT.md`.
**Expected:** Each row gets a result and evidence.
**Why human:** Devices, real keys, legal review. These are not required by the phase goal (which asks for consolidation and reclassification), but they remain owner work.

### Gaps Summary

No code, workflow or documentation gaps. The phase goal is met in substance: the site is live and matches the routing contract today, CI is proven on GitHub, every deploy is chained to a live smoke that has demonstrably failed and passed on real assertions, GTM-01..03 are proven with clean screenshots and GTM-04 is cut by a recorded owner decision on its documented cut line, and the owner holds a runbook, an indexed proof bundle, a regenerated audit at the deployed commit and one 103-row ledger guarded by tests.

The single unmet clause is criterion 4's "sitemap.xml ... read" (LIVE-05 live half). It depends on Google, not on the repo; all repo-side preconditions are proven (sitemap live with 14 URLs, robots `Sitemap:` line, property verified). The owner closed the phase with it explicitly carried, LIVE-05 stays unticked, and the follow-up steps are written in the README, PROJECT.md and ledger. It is reported here as a carried human item, not passed silently. The CDN-429 handling in `scripts/smoke.mjs` is an open hardening warning for a later phase.

---

_Verified: 2026-11-01T17:35:00Z_
_Verifier: Claude (gsd-verifier)_
