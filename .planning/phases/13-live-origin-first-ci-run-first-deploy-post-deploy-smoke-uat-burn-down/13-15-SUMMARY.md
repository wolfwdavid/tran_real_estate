---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 15
subsystem: infra
tags: [gtm-01, gtm-02, gtm-04, web3forms, cut-line, audit-exception, minimatch, launch-proof, owner-checkpoint, d-14, d-16, d-17, d-20]
wave: 9
depends_on: ["13-14"]

# Dependency graph
requires:
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-14 outcome "umami cut" (owner decision P13-4 b); 13-13 live origin at f070c74 with the ci + deploy + live-smoke chain; 13-16 Search Console tag commit 9c16e6e waiting for a push
  - phase: 10-launch-services
    provides: the waitlist and feedback forms gated on PUBLIC_WEB3FORMS_KEY, the documented GTM-04 cut line, the audit-exceptions list and its supply-chain test
provides:
  - "GTM-04 cut recorded where the cut line requires: REQUIREMENTS.md future section (### Analytics) and LIVE-06 annotation; PROJECT.md Key Decisions row plus the Umami beacon row marked cut"
  - "PUBLIC_WEB3FORMS_KEY set (captcha off); live site at f169749 renders both forms open; green pair ci 41200919587 (deploy success) + live-smoke 41202355014 (121 passed)"
  - "GTM-02 proven: one waitlist entry and one feedback message from the live origin delivered with subjects 'Tran waitlist: Renter' and 'Tran feedback: Free calculators' (20-web3forms-inbox.png)"
  - "GTM-01 proven: portal pick -> tour -> Try sample data -> sample results on the live origin (21-gtm01-sample-data.png)"
  - "Reviewed audit exception for GHSA-g3hv-75wg-m249 (minimatch <11.0.1, dev toolchain only) with grep proof, so pnpm audit:deps is green again on CI"
  - "Carried for 13-17: google-site-verification meta count 1 and sitemap <loc> count 14 on the live origin at f169749"
affects: [13-17 Search Console verify and sitemap submit (the tag is live), 13-18 LAUNCH-AUDIT regeneration (carries the new audit exception), 13-19 ledger rows P13-1 and L82 and LIVE-06 tick, Phase 16 toolchain majors (minimatch 11 via eslint)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A new audit advisory in a dev-only dependency with no accepting upstream is recorded as a reviewed exception with a never-ships grep proof and a revisit date, not silenced with an override outside every dependent's declared range"
    - "A red CI leg means a fix commit and a new push with a new observed ci + deploy + live-smoke pair; the proof SHA is the green one, never a re-run"
    - "Owner approvals are quoted verbatim with the reading applied to them, and the proofs say who actually performed each step"

key-files:
  created:
    - docs/launch-proof/2026-10-30/20-web3forms-inbox.png
    - docs/launch-proof/2026-10-30/21-gtm01-sample-data.png
    - .planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-15-SUMMARY.md
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/PROJECT.md
    - scripts/lib/audit-exceptions.mjs
    - pnpm-workspace.yaml

key-decisions:
  - "13-15: GTM-04 is recorded as cut by owner decision P13-4 (b) before any Umami website, probe, or analytics variable existed, with no pageview data ever collected; the plan's drafted 'no pageviews arrived' wording was not used because it is not what happened"
  - "13-15: GHSA-g3hv-75wg-m249 (minimatch <11.0.1, moderate) is a reviewed audit exception: it reaches the lockfile only through the eslint / typescript-eslint / wxt dev toolchain, eslint 10.14.0 still declares minimatch ^10.2.x, and 0 matches ship in build/_app or the extension output; revisit at the first eslint release on minimatch >=11.0.1 and by 2026-11-30 at the latest"
  - "13-15: the Task 2 proof SHA is f169749 (the fix push), not the redeploy commit 5ebdf79 whose ci run went red on the new advisory and was cancelled by the next push"
  - "13-15: docs/LAUNCH-AUDIT.md is not regenerated here on purpose; 13-18 regenerates it at DEPLOYED_SHA (at or after f169749), so the regenerated audit carries the new exception"

patterns-established:
  - "Proof screenshots of an inbox are crops of the result rows only (sender display name, subject, snippet, time); addresses and account chrome never appear"

requirements-completed: [LIVE-06]

# Metrics
duration: 9h 8m wall (about 1h 15m of executor work across three sessions; the rest was the orchestrator's owner relay, the Web3Forms key creation, and the form submissions)
completed: 2026-10-31
---

# Phase 13 Plan 15: GTM proofs 2 (Umami outcome, Web3Forms, GTM-01 walk) Summary

**GTM-04's cut is written into REQUIREMENTS.md and PROJECT.md as an owner decision taken before analytics ever existed; `PUBLIC_WEB3FORMS_KEY` was set (captcha off) and the redeploy, after a one-commit audit exception for a brand-new minimatch advisory that reddened the first ci run, landed as f169749 with ci 41200919587 (deploy success) and live-smoke 41202355014 (121 passed); both forms render open on the live origin, one waitlist entry and one feedback message arrived with the subjects "Tran waitlist: Renter" and "Tran feedback: Free calculators", and the GTM-01 tour-to-sample-results walk rendered 10 sample rentals, with both proofs committed under docs/launch-proof/2026-10-30/.**

## Performance

- **Duration:** 9h 8m wall; about 1h 15m of executor work (Task 1 ~10 min, Task 2 ~55 min including two 20-minute ci watches, Task 3 ~10 min)
- **Started:** 2026-10-31T03:45Z (Task 1 reads; its commit landed 03:54:53Z)
- **Completed:** 2026-10-31T12:53Z (proof commit 32caa72)
- **Tasks:** 3 of 3 (one autonomous, two owner checkpoints satisfied under verbatim approvals)
- **Files modified:** 4 repository files (two planning docs, two audit-exception files) + 2 proof PNGs

Every Bash call stayed under 7 minutes; ci was watched with `timeout 360 gh run watch ... --interval 30 --exit-status`, a fresh call per window. No secret, token, or non-public key was requested, seen, or recorded (the Web3Forms access key is public by design and ships in the page bundle).

## Owner approvals and results (verbatim)

Given through the orchestrator, 2026-10-30/31. Recorded with the reading applied to each.

1. **Key creation.** `do it for me please`: the orchestrator created the Web3Forms access key in the owner's signed-in Web3Forms dashboard.
2. **Standing approval.** `signed in check please and auto aproove everything please`: read as covering, for this plan, the `gh variable set PUBLIC_WEB3FORMS_KEY`, the `git push origin main` of the redeploy commit, the follow-up fix push (option A below), and the orchestrator performing the Task 3 owner steps 1-4 in the owner's signed-in Chrome.
3. **Option A decision (coordinator, after the red run).** "Decision: option A, the reviewed exception (Phase 11 pattern)."
4. **Task 3 result.** `forms + walk pass` (relayed by the orchestrator with the facts recorded under Task 3 below).

Exactly three mutating remote commands ran in this plan, each under approval 2: one `gh variable set`, two `git push origin main`. No `gh variable delete`, no repository or Pages setting change, no PR action, no rebase, squash, amend, or force. Nothing was pushed after the proof commit; the next owner push (13-17) carries `32caa72` and this plan's metadata commit.

## Task 1: the Umami outcome (cut line applied)

13-14's outcome is **umami cut** (owner decision P13-4 b). The plan's template sentence "No pageviews arrived from https://wolfwdavid.github.io/tran_real_estate/ in the Phase 13 live check" was **not** written: the owner cut analytics before any Umami website, probe, or variable existed, so no pageview data was ever collected. Edits:

- `.planning/REQUIREMENTS.md`: LIVE-06 line appended with ` (GTM-04 cut 2026-10-30 per its cut line; recorded in PROJECT.md)`; the checkbox stays `[ ]` (13-19 ticks it once GTM-03 and Search Console are proven). New `### Analytics` block under "## v1.1.x / Future Requirements" (after `### Extension`, before `### Owner decisions still open`): `- **GTM-04 (moved to v2 by the Phase 10 cut line, 2026-10-30)**: Umami usage counts from the deployed origin with GPC respected. Cut by owner decision P13-4 (b) in the Phase 13 live check before any Umami website, probe, or analytics variable existed; no pageview data was ever collected (13-14-SUMMARY.md).`
- `.planning/PROJECT.md` Key Decisions (three columns `Decision | Rationale | Outcome`): new last row `| Ship without usage counts; GTM-04 moved to v2 | Phase 10 cut line, applied by owner decision P13-4 (b) in the Phase 13 live check (2026-10-30): analytics was never switched on (no Umami website, probe, or variable), so no pageview data exists | ✓ Phase 13 |`; the existing "Analytics = first-party fetch beacon to Umami free tier" row keeps its text and its Outcome cell becomes `✗ Cut 2026-10-30 (GTM-04 to v2)`.
- Acceptance: `grep -c "GTM-04 (moved to v2" .planning/REQUIREMENTS.md` -> 1; `grep -c "GTM-04 moved to v2" .planning/PROJECT.md` -> 1. `pnpm lint` exit 0 (`.planning/` is in `.prettierignore`, so `pnpm format` had nothing to touch).
- The plan's two `gh variable delete PUBLIC_ANALYTICS_*` commands had nothing to act on: `gh variable list` showed only BASE_PATH, PAGES_ENABLED, PUBLIC_SITE_URL. They were not printed as owner work.
- Commit **`26f57a0`** `docs(13): apply the analytics cut line (GTM-04 to v2)`; attribution grep 0; tree clean, `ahead 5` at the time (nothing pushed).

## Task 2: Web3Forms on, redeploy, green pair

### Web3Forms facts (settings read 2026-10-31 by the orchestrator in the owner's dashboard)

Form "Tran Real Estate Tools", website URL wolfwdavid.github.io/tran_real_estate, created 2026-10-31. Captcha Protection = **None** (captcha already OFF; nothing to change, which the CSP requires), Spam Protection Level = Basic, Recipient Emails 1/1 = the account inbox, data retention 3 years, Free plan 0/250 submissions at the start. Access key (public by design, client-side): `8e437c3d-7403-404a-8fb6-3db8284cfd80`.

### Pre-state (2026-10-31T12:04:48Z)

`git status -sb` -> `## main...origin/main [ahead 9]`, tree clean; `git log --oneline origin/main..HEAD` -> a6f68a1, f1fb427, 9c16e6e (feat(seo): Search Console verification tag, plan 13-16), c963f61, 26f57a0, a1a9ed1, 73ec821, 74c799e, a0ed201; variables exactly BASE_PATH / PAGES_ENABLED / PUBLIC_SITE_URL; live `/_app/version.json` = f070c746... (no deploy since 13-13).

### Commands (in order)

| # | Command | Exit | Result |
| --- | --- | --- | --- |
| 1 | `gh variable set PUBLIC_WEB3FORMS_KEY --repo wolfwdavid/tran_real_estate --body "8e437c3d-7403-404a-8fb6-3db8284cfd80"` | 0 | 12:05:01Z. `gh variable list` -> exactly four: `BASE_PATH /tran_real_estate`, `PAGES_ENABLED true`, `PUBLIC_SITE_URL https://wolfwdavid.github.io`, `PUBLIC_WEB3FORMS_KEY 8e437c3d-...`. No `PUBLIC_ANALYTICS_*`. |
| 2 | `git commit --allow-empty -m "chore: redeploy with forms"` | 0 | `[main 5ebdf79]`; `git log -1 --format=%B` is the bare subject; attribution grep 0; gitleaks no leaks; real-data guard passed. |
| 3 | `git push origin main` | 0 | `f070c74..5ebdf79  main -> main` at 12:05:25Z (the nine commits + 5ebdf79). Dependabot banner "6 vulnerabilities (6 low)" unchanged since 13-11. |
| 4 | `timeout 360 gh run watch 41199555797 ...` | 124 | **ci run 41199555797 on 5ebdf79: root leg FAILED** at step 7 `pnpm audit:deps`, 18 s after start (see below). Stopped per the rule; failing log tail handed to the coordinator. |
| 5 | (option A) commit `f169749` `chore(deps): record the minimatch advisory exception` | 0 | body: advisory, dev-only paths, grep proof, revisit date; no trailer; attribution grep 0; pre-commit hook exit 0. |
| 6 | `git push origin main` | 0 | `5ebdf79..f169749  main -> main` at 12:23:53Z. **Task 2 proof SHA = `f16974962e3b6ace66655342387cd270f3d120b6`.** |

### The red run: ci 41199555797 (5ebdf79)

https://github.com/wolfwdavid/tran_real_estate/actions/runs/41199555797. `secrets + real-data guard` success (13 s); configured leg success (12:05:29Z-12:09:19Z); root leg (job 124532467830) **failure** at step 7 `Run pnpm audit:deps` (12:05:29Z-12:05:47Z); steps 8-21 (playwright install, check, lint, fixtures, unit, Build, CSP/SEO oracles, budgets, E2E, extension, Upload Pages artifact) skipped. The audit runs only on the root leg (`if: matrix.target == 'root'`), hence the green configured leg. No deploy job, so no live-smoke was created and the live site stayed f070c74. The run was later marked `cancelled` by the f169749 push's concurrency group; a live-smoke 41200947140 (workflow_run, 12:24:16Z) shows `skipped` because its triggering run was not a success.

Failing step log tail:

```
$ pnpm audit --audit-level low
│ moderate            │ minimatch has potential denial of service via globparts amplification │
│ Package             │ minimatch                                              │
│ Vulnerable versions │ <11.0.1                                                │
│ Patched versions    │ >=11.0.1                                               │
│ Paths               │ .>@eslint/js>eslint>@eslint/config-array>minimatch     │
│                     │ ... Found 43 paths, run `pnpm why minimatch` for more information │
│ More info           │ https://github.com/advisories/GHSA-g3hv-75wg-m249      │
1 vulnerabilities found
Severity: 1 moderate
4 ignored: 4 low
[ELIFECYCLE] Command failed with exit code 1.
##[error]Process completed with exit code 1.
```

Diagnosis (read-only): reproduced locally (`pnpm audit --audit-level low` exit 1); the lockfile holds one minimatch, `10.2.6` (published 2026-10-28); the only patched line is `>=11.0.1` (11.0.1 published 2026-10-27, latest 11.0.3; no patched 10.x). Parents: eslint@10.10.0, @eslint/config-array@0.23.5, @eslint/js, @eslint-community/eslint-utils, the typescript-eslint 8.70.0 family, eslint-plugin-svelte 3.23.0, eslint-config-prettier, wxt@0.21.4, @wxt-dev/module-svelte. eslint latest 10.14.0 declares `minimatch ^10.2.6` and @eslint/config-array 0.23.5 `^10.2.4`, so no dependent accepts 11 yet; a `pnpm.overrides` to 11 would sit outside every declared range for a dev-only DoS advisory. Options presented: A reviewed exception (Phase 11 pattern), B override to ^11.0.1, C wait. Coordinator chose **A**.

### Option A: the reviewed exception (commit `f169749`)

- `scripts/lib/audit-exceptions.mjs`: fifth entry `ghsa: 'GHSA-g3hv-75wg-m249'`, `package: 'minimatch'`, `severity: 'moderate'`, `path: 'eslint / typescript-eslint / wxt dev toolchain > minimatch@10.2.6'`, `why` (DoS through globparts amplification; lint- and build-time glob matching on trusted config patterns only; 0 matches in build/_app, apps/web/src and the extension output; eslint 10.14.0 and @eslint/config-array 0.23.5 still declare ^10.2.x; revisit at the first eslint release that depends on minimatch >=11.0.1), `revisitBy: '2026-11-30'` (the schema requires an ISO date).
- `pnpm-workspace.yaml` `audit.ignore`: `- GHSA-g3hv-75wg-m249 # minimatch <11.0.1 via the eslint / typescript-eslint / wxt dev toolchain, lint- and build-time only; not in build/_app or the extension output. Re-check at the first eslint release on minimatch 11.`
- **Never-ships proof** (clean rebuild; `MSYS_NO_PATHCONV=1 BASE_PATH=/tran_real_estate pnpm build:root` logged `target=root BASE_PATH=/tran_real_estate BUILD_DIR=build`; `pnpm ext:build` zipped 263.87 kB):

| Check | Count |
| --- | --- |
| `grep -rl minimatch apps/web/build/_app \| wc -l` (322 files) | **0** |
| `grep -rl minimatch apps/web/build \| wc -l` (whole output) | 0 |
| `grep -rl minimatch apps/web/src \| wc -l` | **0** |
| `grep -rl minimatch apps/extension/.output/chrome-mv3 \| wc -l` | **0** |
| extension zip: `unzip -l ... \| grep -c minimatch` / `unzip -p ... \| grep -c minimatch` | 0 / 0 |
| `grep -rl minimatch apps/extension/src \| wc -l` | 0 |

- Local gates before the commit: `pnpm audit:deps` exit **0** (`All found vulnerabilities were already reviewed and decided to be ignored`, `5 ignored: 4 low | 1 moderate`); `pnpm vitest run scripts/supply-chain.test.ts scripts/launch-audit.test.ts` -> 2 files, **45 passed** (the equality test between the module and `audit.ignore`, the schema test, and the launch-audit exceptions table); `pnpm lint` exit **0**; `git hook run pre-commit` exit **0** (gitleaks no leaks, real-data guard 2 files).
- `docs/LAUNCH-AUDIT.md` was **not** regenerated in this commit on purpose: plan 13-18 regenerates it at DEPLOYED_SHA, which is at or after f169749, so the regenerated audit carries the new exception.

### The green pair on f169749

**ci run 41200919587** https://github.com/wolfwdavid/tran_real_estate/actions/runs/41200919587 (push, main, headSha f1697496...): **success**; created 12:23:55Z, updated 12:43:15Z, wall **19m20s**.

| Job | Conclusion | Window |
| --- | --- | --- |
| secrets + real-data guard | success | 12:24:15Z-12:24:25Z (10 s) |
| check, lint, unit, build, csp, e2e+axe (configured) | success | 12:24:15Z-12:29:53Z |
| check, lint, unit, build, csp, e2e+axe (sub) | success | 12:24:15Z-12:42:46Z |
| check, lint, unit, build, csp, e2e+axe (root), job 124536452054 | success | 12:24:15Z-12:43:00Z |
| **deploy**, job 124540432159 | **success** | 12:43:03Z-12:43:14Z (11 s) |

Root leg log: step 7 `pnpm audit:deps` success (`5 ignored: 4 low | 1 moderate`); `build-web: pnpm 11.27.0 target=root BASE_PATH=/tran_real_estate BUILD_DIR=build BUILD_SHA=f16974962e3b6ace66655342387cd270f3d120b6`; `CSP assertion passed for 45 pages in apps/web/build (analytics host: none)`; `SEO assertion passed for 44 pages, 14 sitemap URLs, 6 share cards`; `1141 passed (15.0m)`; `Extension oracle passed (6 files scanned ..., zip root verified)`; `7 passed (1.9s)`; `##[error]` count 0. Deploy log: `Created deployment for f16974962e3b6ace66655342387cd270f3d120b6`, `Evaluated environment url: https://wolfwdavid.github.io/tran_real_estate/`.

**live-smoke run 41202355014** https://github.com/wolfwdavid/tran_real_estate/actions/runs/41202355014 (workflow_run): **success**; created 12:43:17Z, job 124540491832 12:43:19Z-12:44:48Z (1m29s); `gh api .../runs/41202355014 --jq .head_sha` -> f1697496...; log: `SMOKE_BASE_URL: https://wolfwdavid.github.io/tran_real_estate/`, `SMOKE_EXPECT_VERSION: f16974962e3b6ace66655342387cd270f3d120b6`, `smoke: f1697496... live at https://wolfwdavid.github.io/tran_real_estate/ after 0 s` (propagation 0 s again), `Running 121 tests using 2 workers`, `version.json equals SMOKE_EXPECT_VERSION` passed, **`121 passed (45.6s)`**; precache installs 4718 / 2962 / 2783 ms (inside the 20 s wait from 13-13).

### Live checks (2026-10-31T12:45:33Z, after live-smoke green)

| Command | Output |
| --- | --- |
| `curl -s https://wolfwdavid.github.io/tran_real_estate/_app/version.json` | `{"version":"f16974962e3b6ace66655342387cd270f3d120b6"}` (= pushed SHA) |
| `curl -s .../for-renters/ \| grep -c "open yet"` | **0** (`Join the waitlist` count 1: the form is open) |
| `curl -s .../feedback/ \| grep -c "open yet"` | **0** (`Send feedback` count 3: heading, button, meta) |
| `curl -s .../ \| grep -o "connect-src[^;]*" \| grep -c "gateway.umami.is"` | **0** |
| same for `api.web3forms.com` | 1; the live `connect-src` is `'self'` plus the six provider/form hosts of the Phase 10 CSP (api.rentcast.io, the three LLM hosts, openrouter.ai, api.web3forms.com); no analytics host |
| key string in the prerendered HTML of either page | 0 (it ships inside the hashed `_app` JS; the open-state render is the proof) |
| `curl -sI .../for-renters/` | `HTTP/1.1 200 OK`, `Cache-Control: max-age=600`, `X-Cache: HIT`, `Age: 2` |

### Carried for 13-17

Recorded from the same deploy (f169749), which also carried 13-16's Search Console tag commit 9c16e6e:

| Command | Output |
| --- | --- |
| `curl -s https://wolfwdavid.github.io/tran_real_estate/ \| grep -o '<meta name="google-site-verification"' \| wc -l` | **1** |
| `curl -s https://wolfwdavid.github.io/tran_real_estate/sitemap.xml \| grep -c "<loc>"` | **14** |

## Task 3: deliveries (GTM-02) and the GTM-01 walk

Performed 2026-10-31 by the **orchestrator in the owner's signed-in Chrome** (not by the owner by hand), under the standing approval `signed in check please and auto aproove everything please`; the owner's relayed result: **`forms + walk pass`**.

- **Waitlist** (`/for-renters/`): the open form rendered (no "open yet"); a placeholder address on the reserved example.com domain (no personal data); 4 s wait before submitting; on-page result "You're on the renter waitlist / Thanks. Your email was sent to the Tran team."
- **Feedback** (`/feedback/`): topic "Free calculators", message "Launch check: the cap rate calculator loads and computes on the live site. Delivery test from the first deploy."; 3 s wait; on-page result "Thanks. Your feedback was sent."
- **Web3Forms Submissions page:** two rows, Oct 31 08:47 AM "Tran waitlist: Renter" (portal renter) and 08:48 AM "Tran feedback: Free calculators"; usage 2/250.
- **Inbox:** both mails arrived 8:50 AM from "Tran Real Estate To." with subjects exactly **"Tran waitlist: Renter"** and **"Tran feedback: Free calculators"** (GTM-02).
- **GTM-01 walk:** home -> Renter "Start the tour" -> steps 1-3 -> "Try sample data" -> `/renter/` with the Sample data banner -> "Try a sample search" -> `/renter/?loc=74201` showing "10 rentals in 74201" with Sample data badges on every card (ledger P13-1 evidence).
- **Browser profile deviation:** the walk ran in the owner's signed-in Chrome tab, not an InPrivate window. The page served the new build (open forms visible, sample results rendered, no "open yet"), so the cache-first service worker did not mask the deploy; recorded, not repeated.

### Proof files (D-20 check and commit)

Both PNGs were opened and read before committing. `20-web3forms-inbox.png` (58,813 B) is a crop of the two mail result rows only: sender display name "Tran Real Estate To.", the "Inbox" label, the two subjects, snippet text "Form Submission Data from your website...", and the 8:50 AM times; no e-mail address, avatar, or account name. `21-gtm01-sample-data.png` (391,048 B, 1416x659) shows the renter sample results: "10 rentals in 74201", Sample data badges, fictional streets in "Harlow Springs, OK 74201" (synthetic fixtures). A byte scan of both files for `@<domain>` strings prints 0 and 0. `du -sk docs/launch-proof/2026-10-30` -> **1516** (< 5120; the folder also holds 13-13's five PNGs + checks.json and 13-16's 30-/31- cards).

Commit **`32caa72`** `docs(launch-proof): form deliveries and portal walk` (two files, no trailer, attribution grep 0, gitleaks no leaks, real-data guard passed). Local only: `## main...origin/main [ahead 1]` after it; not pushed.

## Task Commits

1. **Task 1: cut line applied** - `26f57a0` (docs) `docs(13): apply the analytics cut line (GTM-04 to v2)` (pushed in the 12:05Z push)
2. **Task 2: redeploy commit** - `5ebdf79` (chore, empty) `chore: redeploy with forms` (pushed; its ci run went red on the new advisory and was cancelled)
3. **Task 2: audit exception** - `f169749` (chore) `chore(deps): record the minimatch advisory exception` (pushed; the proof SHA)
4. **Task 3: proofs** - `32caa72` (docs) `docs(launch-proof): form deliveries and portal walk` (local, carried by the next owner push)

**Plan metadata:** `docs(13-15): complete GTM proofs 2 plan` (this SUMMARY, STATE.md, ROADMAP.md; local, not pushed per D-14).

## Files Created/Modified

- `.planning/REQUIREMENTS.md` - `### Analytics` future entry for GTM-04; LIVE-06 line annotated (checkbox untouched)
- `.planning/PROJECT.md` - Key Decisions row "Ship without usage counts; GTM-04 moved to v2"; Umami beacon row marked `✗ Cut 2026-10-30 (GTM-04 to v2)`
- `scripts/lib/audit-exceptions.mjs` - fifth reviewed exception (GHSA-g3hv-75wg-m249, moderate, revisit 2026-11-30)
- `pnpm-workspace.yaml` - matching `audit.ignore` line
- `docs/launch-proof/2026-10-30/20-web3forms-inbox.png` - the two delivered mails (crop, no addresses)
- `docs/launch-proof/2026-10-30/21-gtm01-sample-data.png` - renter sample results after the tour

## Decisions Made

- The GTM-04 cut is recorded as an owner decision (P13-4 b) taken before the service existed, with the plan's "no pageviews arrived" phrasing replaced by what happened.
- The new minimatch advisory is a reviewed exception (option A), chosen over a `pnpm.overrides` jump to a major outside every dependent's range; the grep proof and the eslint-release revisit trigger are in the entry.
- The Task 2 proof SHA is f169749; the red run on 5ebdf79 is recorded, not retried.
- The two `gh variable delete` commands from the plan were not printed: no analytics variable ever existed.
- LIVE-06 is not ticked here: GTM-03 (13-16) and Search Console (13-17) still need their live halves; 13-19 ticks it with the ledger.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] New audit advisory reddened the root ci leg before Build**
- **Found during:** Task 2 (ci run 41199555797 on 5ebdf79)
- **Issue:** GHSA-g3hv-75wg-m249 (minimatch <11.0.1, moderate) was attached to `minimatch@10.2.6` between the last green run (2026-10-30T23:55Z) and this push; `pnpm audit --audit-level low` exits 1, so `Upload Pages artifact` never ran and no deploy or live-smoke could happen. No dependent accepts minimatch 11 yet (eslint 10.14.0 declares ^10.2.6).
- **Fix:** reviewed exception in `scripts/lib/audit-exceptions.mjs` and `pnpm-workspace.yaml` (coordinator decision: option A), with a clean-build grep proof that minimatch ships nowhere (all counts 0) and revisit date 2026-11-30.
- **Files modified:** `scripts/lib/audit-exceptions.mjs`, `pnpm-workspace.yaml`
- **Verification:** `pnpm audit:deps` exit 0 locally and on CI (`5 ignored: 4 low | 1 moderate`); supply-chain + launch-audit tests 45 passed; `pnpm lint` 0; ci 41200919587 green through deploy; live-smoke 41202355014 green.
- **Committed in:** `f169749`

### Owner-approved substitutions (no code change)

**2. Executor ran the owner commands** (`gh variable set`, the empty redeploy commit, two pushes) under the verbatim standing approval, as in 13-13.

**3. A second push before the plan closed.** The plan expected one redeploy SHA; the first ci run went red on the advisory, so the proof pair is on f169749 (fix push), per the rule that a fix means a new push and a new observed pair.

**4. The Task 3 steps were performed by the orchestrator** in the owner's signed-in Chrome (approval quoted above), and in that signed-in tab rather than an InPrivate window; the new build was demonstrably served (open forms, sample results), so the fresh-profile rule's purpose (not seeing a stale service-worker build) was met.

### Wording corrections (planning docs only)

**5. The cut-line sentence.** The plan's drafted "No pageviews arrived ..." was replaced with the owner-decision wording (13-14 flagged it; the coordinator confirmed).

**6. No variable deletions printed.** The plan's "on cut print the two `gh variable delete` commands" had nothing to act on.

---

**Total deviations:** 1 auto-fixed (Rule 3, dev-toolchain audit exception), 3 owner-approved substitutions, 2 wording corrections.
**Impact on plan:** No change to the site's code or runtime configuration beyond the intended `PUBLIC_WEB3FORMS_KEY`. GTM-01, GTM-02 are proven on f169749; GTM-04 is settled per its cut line; the audit gate is green with a dated, proven exception.

## Issues Encountered

- `gh run view --json jobs` with a nested `.steps[]` filter stalled once in the 120 s window while a job was still running; the plain REST call `gh api repos/<o>/<r>/actions/jobs/<id>` answered in seconds and was used instead.
- `pnpm build:root` without an exported `BASE_PATH` builds with `BASE_PATH=''` (CI supplies it from the repository variable); the proof build was re-run with `BASE_PATH=/tran_real_estate` exported so the grep covered the exact deploy shape.
- ci wall time 19m20s (root Playwright 15.0m) against the 13-13 band of 28 minutes; the Pages CDN again served the new `version.json` on live-smoke's first poll (0 s).

## Known Stubs

None. No application code changed in this plan.

## Next Phase Readiness

- Wave 9 is done. 13-17 (Search Console verify + sitemap submit) can start immediately: the verification tag is live (count 1) and `sitemap.xml` lists 14 URLs on f169749, so the owner only needs to press Verify and submit the sitemap; its push carries `32caa72` and this plan's metadata commit.
- 13-18 regenerates `docs/LAUNCH-AUDIT.md` at DEPLOYED_SHA >= f169749 and will list five audit exceptions.
- 13-19 ledger: P13-1 (GTM-01 walk) evidence = `21-gtm01-sample-data.png` + this SUMMARY; GTM-02 evidence = `20-web3forms-inbox.png`; P13-4 / L82 = cut (13-14); LIVE-06 tick after 13-17.
- Still unset by design: `PUBLIC_CONTACT_EMAIL`, `EXTENSION_RELEASES_ENABLED`; permanently unset for v1.1: `PUBLIC_ANALYTICS_HOST`, `PUBLIC_ANALYTICS_WEBSITE_ID`.
- Revisit GHSA-g3hv-75wg-m249 at the first eslint release on minimatch >=11.0.1 (by 2026-11-30): bump eslint, drop the exception from both files, and let `supply-chain.test.ts` confirm the lists still agree.

## Self-Check: PASSED

- FOUND `docs/launch-proof/2026-10-30/20-web3forms-inbox.png`, `21-gtm01-sample-data.png`, `scripts/lib/audit-exceptions.mjs`, `pnpm-workspace.yaml`, and this SUMMARY on disk
- FOUND commits `26f57a0` (cut line), `5ebdf79` (redeploy), `f169749` (audit exception; = origin/main), `32caa72` (proofs; local); attribution grep on each message prints 0
- `gh variable list` shows exactly BASE_PATH, PAGES_ENABLED, PUBLIC_SITE_URL, PUBLIC_WEB3FORMS_KEY; live `version.json` = f169749; "open yet" greps 0 / 0; Umami `connect-src` grep 0; Search Console meta count 1; sitemap `<loc>` count 14
- `du -sk docs/launch-proof/2026-10-30` -> 1516 (< 5120); both PNGs opened and checked: no e-mail address or account detail
- `requirements-completed: [LIVE-06]` copied verbatim from 13-15-PLAN.md; LIVE-06's checkbox is left for 13-19 by instruction
- No personal e-mail address, token, or non-public key in this file (the Web3Forms access key is public by design)

---
*Phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down*
*Completed: 2026-10-31*
