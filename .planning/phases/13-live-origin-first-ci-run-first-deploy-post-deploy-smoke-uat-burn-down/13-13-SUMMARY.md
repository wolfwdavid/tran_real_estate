---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 13
subsystem: infra
tags: [go-live, github-pages, deploy, live-smoke, service-worker, precache, launch-proof, owner-checkpoint, d-13, d-14, d-15]

# Dependency graph
requires:
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-12 variables BASE_PATH and PUBLIC_SITE_URL set, rehearsal ci run 41106746719 green with the base path, origin/main at ab70bbb
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-08 proof-shots.mjs and 13-09 ci.yml deploy job gated on vars.PAGES_ENABLED, live-smoke.yml chained on workflow_run
  - phase: 12-go-live-readiness-local-smoke-suite
    provides: the read-only smoke suite and scripts/smoke.mjs remote mode
provides:
  - The site is public at https://wolfwdavid.github.io/tran_real_estate/ (PAGES_ENABLED=true, go-live push ad5fd08, deploy job success, page_url evaluated)
  - LIVE-03 observed: landing 200, slashless 301, deep-route refresh, branded 404 with HTTP 404, http->https 301, all five owner fresh-profile checks passed
  - SMOKE-04 live half observed: live-smoke run 41149881068 green (121 passed) on deployed SHA f070c74, SMOKE_EXPECT_VERSION = head_sha = version.json
  - docs/launch-proof/2026-10-30/ (five PNGs + checks.json, 504 KB, all checks ok) committed in f070c74
  - Smoke precache wait sized by measurement (shared installedPrecache helper, 20 s, per-run install-time log) after the first live-smoke failed on Playwright's 5 s poll default
  - D-13 facts and CDN facts (max-age=600, cold MISS, propagation 0 s, cold precache install 5.3 to 9.7 s on CI) for the runbook (13-19)
affects: [13-14 Umami proof (next push carries nothing pending), 13-18 LAUNCH-AUDIT, 13-19 runbook first-deploy facts and launch-proof README, 13-21 probes, Phase 15 CI timing, Phase 16 Kit 3 service-worker proof]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Smoke waits on asynchronous browser work (service-worker install) are sized from measured live numbers and logged every run, never left at a library default"
    - "A proof screenshot of a client-rendered page waits for its h1, not for load"
    - "A failed live-smoke is diagnosed from the trace artifact, fixed at the root, committed locally and proven by a new push plus a new observed ci + deploy + live-smoke pair; never re-run in place"

key-files:
  created:
    - docs/launch-proof/2026-10-30/01-landing.png
    - docs/launch-proof/2026-10-30/02-renter.png
    - docs/launch-proof/2026-10-30/03-deep-route-refresh.png
    - docs/launch-proof/2026-10-30/04-not-found.png
    - docs/launch-proof/2026-10-30/05-version-json.png
    - docs/launch-proof/2026-10-30/checks.json
    - .planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-13-SUMMARY.md
  modified:
    - apps/web/tests/smoke/fixtures.ts
    - apps/web/tests/smoke/assets.smoke.ts
    - apps/web/tests/smoke/pwa.smoke.ts
    - apps/web/tests/smoke/proof-shots.mjs
    - scripts/proof-shots.test.ts
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "13-13: GO_LIVE_SHA is ad5fd08 (the deploy that made the site public and the SHA version.json reported while the D-13 facts were taken); the SHA proven by a green live-smoke is f070c74, one deploy later, because the first live-smoke on ad5fd08 failed on a test timeout and a fix means a new push and a new observed pair"
  - "13-13: the smoke precache wait is 20 s (2.4x the slowest local measurement; CI's cold first visit then measured 9.7 s), shared by assets.smoke.ts and pwa.smoke.ts through one fixtures helper that logs every run's install time; the version poll was not raised"
  - "13-13: the raw 404 body is the SPA fallback shell with no <title>; the branded title is client-rendered, so the 404 proof is the screenshot and the browser-side smoke, not a grep of the body"
  - "13-13: four mutating remote commands ran in total, each under a verbatim owner approval: one gh variable set, one empty commit, two pushes"

patterns-established:
  - "installedPrecache(page) in tests/smoke/fixtures.ts is the one way a smoke spec waits for the worker; new specs reuse it instead of polling caches themselves"
  - "Proof-shot plan entries carry a ready selector for pages that hydrate after load"

requirements-completed: [LIVE-03, SMOKE-04]

# Metrics
duration: 5h 31m wall (about 1h 15m of executor work; 4h 18m waiting on the owner's push decision and fresh-profile checks between 19:36Z and 23:54Z)
completed: 2026-10-31
---

# Phase 13 Plan 13: Go-live and first-deploy observation Summary

**`PAGES_ENABLED=true` plus the empty `chore: go live` push `ad5fd08` produced ci run 41111039721 with a real `deploy` job (`Evaluated environment url: https://wolfwdavid.github.io/tran_real_estate/`), the site answered the D-13 routing contract (200 / 301 slashless / 404 branded / 301 http->https / version.json = GO_LIVE_SHA, propagation 0 s) and the owner's five fresh-profile checks passed; the first live-smoke run failed on a 5 s test poll that a cold Pages CDN precache install (5.3 s, later 9.7 s) could not meet, the wait was sized from measurement and the fix push `f070c74` gave the green pair: ci 41147247922 (deploy success) and live-smoke 41149881068 (121 passed on SMOKE_EXPECT_VERSION = f070c74).**

## Performance

- **Duration:** 5h 31m wall. Executor work about 1h 15m; the rest was the owner's decision window.
- **Started:** 2026-10-30T18:55:17Z (precondition check before the go-live commands)
- **Completed:** 2026-10-31T00:25:04Z (live version.json = f070c74, Task 3 verify curl 404)
- **Tasks:** 3 (two owner checkpoints satisfied under verbatim approvals, one autonomous observation task that ran twice: first pair red on live-smoke, second pair green)
- **Files modified:** 5 source files (smoke fixtures and two specs, proof-shots script, its unit test) + 6 proof files + planning docs

Every tool call stayed under 7 minutes. Both ci runs were watched with `timeout 360 gh run watch ... --interval 30` followed by a status read (five polls each); full job logs came from `gh api repos/<o>/<r>/actions/jobs/<id>/logs` (the 13-12 pattern).

## Owner approvals (verbatim)

- **Task 1 (go-live).** The orchestrator asked: "Plan 13-13 checkpoint 1, conditional on the rehearsal run being green: who sets PAGES_ENABLED=true and pushes the empty \"chore: go live\" commit? (If the rehearsal is red, nothing happens and I come back to you.)" The owner chose the option **"Approve executor go-live"** (description: "Once the rehearsal is green, the executor runs exactly the three commands (set PAGES_ENABLED=true, empty commit, push), then watches deploy + live-smoke. Approval recorded verbatim; site becomes public at https://wolfwdavid.github.io/tran_real_estate/."). The rehearsal (13-12, run 41106746719) was green, so the condition was met.
- **Push decision (after the first live-smoke failed).** The orchestrator asked: "Push decision: the two local commits (smoke-wait fix + proof bundle) need a deploy for live-smoke to go green. Push them now, or let the 13-14 analytics redeploy carry them later?" The owner chose **"Approve executor push now"** (description: "Executor runs exactly `git push origin main` once, then watches the new ci + deploy + live-smoke pair (~30 min). Closes SMOKE-04's live half before wave 8. Recommended.").

## Owner results (verbatim)

- **Task 3 (fresh-profile checks, D-15).** The orchestrator listed the five fresh-profile checks verbatim from the plan and asked "What did you see?" The owner chose **"Fresh checks pass"** (description: "All five checks passed in fresh private windows."). No owner screenshots were supplied.

Exactly four mutating remote commands ran across the plan: `gh variable set PAGES_ENABLED ... --body "true"`, `git commit --allow-empty -m "chore: go live"`, `git push origin main` (go-live), `git push origin main` (fix). No `gh variable delete`, no settings change, no PR action, no force, no retry.

## Task 1: Pages on and the go-live push

Preconditions at 18:55:17Z: `git fetch origin && git status -sb` -> `## main...origin/main [ahead 1]`; HEAD `f0592908cf18409a6c999df82676e5b695af52d5` (13-12 metadata); origin/main `ab70bbb222691ef0a54b69a159868a0702421511`; `gh variable list` -> exactly `BASE_PATH /tran_real_estate` and `PUBLIC_SITE_URL https://wolfwdavid.github.io`.

| # | Command | Exit | Output |
| --- | --- | --- | --- |
| 1 | `gh variable set PAGES_ENABLED --repo wolfwdavid/tran_real_estate --body "true"` | 0 | (silent) |
| 2 | `git commit --allow-empty -m "chore: go live"` | 0 | gitleaks `0 commits scanned ... no leaks found`; `Real-data guard passed (0 staged files checked)`; `[main ad5fd08] chore: go live` |
| 3 | `git push origin main` | 0 | `ab70bbb..ad5fd08  main -> main`; banner `GitHub found 6 vulnerabilities ... (6 low)` (unchanged since 13-11; owned by the `pnpm audit:deps` gate) |

- **LAUNCH_DATE = 2026-10-30**. **Push time = 2026-10-30T18:55:47Z**. **GO_LIVE_SHA = ad5fd08188c7cdd37cc5fcb2bc45c58c7f631684**. The push carried f059290 (13-12 planning docs) and ad5fd08.
- Verification: `gh variable list` -> `BASE_PATH /tran_real_estate 2026-10-30T18:21:10Z`, `PAGES_ENABLED true 2026-10-30T18:55:45Z`, `PUBLIC_SITE_URL https://wolfwdavid.github.io 2026-10-30T18:21:10Z`; `git log -1 --format=%s origin/main` -> `chore: go live`; `git status -sb` -> `## main...origin/main`; attribution grep -> 0.

## Task 2, first pair: ci 41111039721 (green, real deploy) and live-smoke 41115004823 (red)

### ci run 41111039721

- URL: https://github.com/wolfwdavid/tran_real_estate/actions/runs/41111039721 (push, main, headSha ad5fd08..., attempt 1)
- conclusion **success**; createdAt 18:55:48Z, updatedAt 19:24:27Z, wall **28m39s**

| Job (id) | Conclusion | Started | Completed | Duration |
| --- | --- | --- | --- | --- |
| secrets + real-data guard (124253230626) | success | 18:55:50Z | 18:55:59Z | 9 s |
| check, lint, unit, build, csp, e2e+axe (configured) (124253230861) | success | 18:55:50Z | 19:01:57Z | 6m07s |
| check, lint, unit, build, csp, e2e+axe (root) (124253230952) | success | 18:55:51Z | 19:22:25Z | 26m34s |
| check, lint, unit, build, csp, e2e+axe (sub) (124253230903) | success | 18:55:51Z | 19:24:02Z | 28m11s |
| **deploy** (124266587341) | **success** | 19:24:08Z | 19:24:26Z | 18 s |

- Plan record: `gh run view 41111039721 --json jobs --jq '.jobs[]|select(.name=="deploy")|.conclusion+" "+.completedAt'` -> `success 2026-10-30T19:24:26Z`.
- Deploy log: `artifact_name: github-pages`, `Found 1 artifact(s)`, `"artifact_id": 13004233262`, `Created deployment for ad5fd08188c7cdd37cc5fcb2bc45c58c7f631684, ID: ad5fd08188c7cdd37cc5fcb2bc45c58c7f631684`, **`Evaluated environment url: https://wolfwdavid.github.io/tran_real_estate/`** (page_url).
- Root leg (3810-line log): `build-web: pnpm 11.27.0 target=root BASE_PATH=/tran_real_estate BUILD_DIR=build BUILD_SHA=ad5fd08188c7cdd37cc5fcb2bc45c58c7f631684`; `CSP assertion passed for 45 pages (analytics host: none)`; `SEO assertion passed for 44 pages, 14 sitemap URLs, 6 share cards`; `1153 passed (21.0m)`; `Extension oracle passed (6 files scanned ..., zip root verified)`; `7 passed (2.5s)`; `actions/upload-pages-artifact` Archive artifact outcome=success (the first run of that step); `##[error]` count 0.

### live-smoke run 41115004823 (FAILURE, exit 1 = suite)

- URL: https://github.com/wolfwdavid/tran_real_estate/actions/runs/41115004823 (workflow_run, createdAt 19:24:30Z, job 124266805631 19:24:32Z -> 19:25:57Z, 1m25s)
- `gh api .../runs/41115004823 --jq .head_sha` -> `ad5fd08188c7cdd37cc5fcb2bc45c58c7f631684`
- Log: `SMOKE_BASE_URL: https://wolfwdavid.github.io/tran_real_estate/`, `SMOKE_EXPECT_VERSION: ad5fd08188c7cdd37cc5fcb2bc45c58c7f631684`, **`smoke: ad5fd08188c7cdd37cc5fcb2bc45c58c7f631684 live at https://wolfwdavid.github.io/tran_real_estate/ after 0 s`** (propagation 0 s), `Running 121 tests using 2 workers`, **120 passed, 1 failed**, `Process completed with exit code 1`. Env gate and version poll both passed; classification: exit 1, suite.
- Failing test: `tests/smoke/assets.smoke.ts:18:1 > every hashed asset in the precache answers 200 (5.5s)`, `Error: Timeout 5000ms exceeded while waiting on the predicate` at the `expect.poll(... keys.length === 1 && urls.length > 0)`.
- Artifact `live-smoke-traces` (256,271 B, id 13006196791) downloaded into an empty scratch directory and read.

**Root cause.** The service worker's install is one atomic `cache.addAll` of the whole build (380 entries live: 321 `_app/immutable` chunks plus files and prerendered pages), so Cache Storage holds zero entries until the last chunk lands. The trace's network log: 364 requests, 350 to `_app/immutable/`, all started 19:25:14.910Z, last response 19:25:20.179Z, so the **install took 5.27 s**; `x-cache` 227 MISS / 134 HIT (the test was #5, among the first visits to the just-deployed site, CDN cold). Playwright's `expect.poll` default timeout is 5 s. The identical poll in `pwa.smoke.ts` (tests #52/#53) ran six seconds later against a warmed CDN and passed in 3.5 to 3.7 s. The local emulator never approached 5 s, so the Phase 12 local smoke never saw it. Live measurement from the development machine: 6,647 ms (cold context), 3,597 ms (second context); full suite against live with 4 workers: 6,666 / 7,629 / 8,344 ms. The site contract itself held (all 380 entries present, cache key `tran-shell-ad5fd08...`, every hashed asset 200 once the fixed test ran).

**Fix: commit `79f82bc`** `fix(13-13): size the smoke precache wait for a cold CDN and screenshot the 404 after it renders`

- `apps/web/tests/smoke/fixtures.ts`: exported `installedPrecache(page)` (goto base, `expect.poll` with `PRECACHE_INSTALL_TIMEOUT_MS = 20_000` and a named message, then `console.log('precache: N entries installed after M ms')`), plus the shared `swCache` reader; the comment records the measurements. 20 s is 2.4x the slowest local measurement and leaves the assets test's ~2.6 s of GETs inside the 30 s test timeout.
- `assets.smoke.ts`, `pwa.smoke.ts`: dropped their duplicated local helpers and call `installedPrecache` (the duplication is what let the two specs behave differently).
- `proof-shots.mjs` and `scripts/proof-shots.test.ts`: see the proof-shot bug below.
- Verified before commit: `pnpm format`; eslint on the five files; `vitest run` over `smoke-readonly`, `proof-shots`, `smoke-env`, `smoke`, `pwa-assets`, `service-worker-guard` tests -> 6 files, 117 passed; `pnpm check` -> web 3256 files 0 errors, extension 0 errors; the fixed suite run read-only against the live site (`SMOKE_EXPECT_VERSION=ad5fd08...`, 4 workers) -> `live at ... after 0 s`, **121 passed (32.9s)**, exit 0. Attribution grep -> 0.
- Per the executor rules: no re-run of the failed live-smoke, no raise of the version poll; the proof is the second pair below.

### D-13 facts (curl at 19:26:12Z against GO_LIVE_SHA)

| Fact | Command | Output |
| --- | --- | --- |
| Unknown path status | `curl -s -o /dev/null -w "%{http_code}\n" https://wolfwdavid.github.io/tran_real_estate/proof-not-found-13/` | `404` |
| Unknown path title | `curl -s https://wolfwdavid.github.io/tran_real_estate/proof-not-found-13/ \| grep -c "<title>"` | **`0`**. The raw 404 body (3,082 B, `Content-Type: text/html; charset=utf-8`) is the adapter-static SPA fallback shell: `<html lang="en" hidden>`, no `<title>`, no `<h1>`; `frame-guard.js` removes `hidden` top-level and the SvelteKit client renders `+error.svelte`. Rendered 297 ms after `load` (Playwright): title **`Page not found: Tran Real Estate Tools`**, h1 `404: Page not found`. The branded page is proven by `routing.smoke.ts` "an unknown path answers HTTP 404 with the branded page" (green in both live-smoke runs), `04-not-found.png`, and owner check 4. |
| http -> https | `curl -sI http://wolfwdavid.github.io/tran_real_estate/ \| grep -iE "^HTTP\|^location"` | `HTTP/1.1 301 Moved Permanently` / `Location: https://wolfwdavid.github.io/tran_real_estate/` |
| Slashless directory | `curl -sI https://wolfwdavid.github.io/tran_real_estate/renter \| grep -iE "^HTTP\|^location"` | `HTTP/1.1 301 Moved Permanently` / `Location: https://wolfwdavid.github.io/tran_real_estate/renter/` |
| version.json | `curl -s https://wolfwdavid.github.io/tran_real_estate/_app/version.json` | `{"version":"ad5fd08188c7cdd37cc5fcb2bc45c58c7f631684"}` (= GO_LIVE_SHA; at 00:25:04Z after the fix deploy: `{"version":"f070c746cfb2ef1e0f1151cca2f5779cab00ecd3"}`) |
| `.nojekyll` (ledger L02) | `curl -sI https://wolfwdavid.github.io/tran_real_estate/.nojekyll \| head -1` | `HTTP/1.1 200 OK` |
| CDN headers on `/tran_real_estate/` | `curl -sI https://wolfwdavid.github.io/tran_real_estate/ \| grep -iE "^cache-control\|^x-cache\|^age"` | `Cache-Control: max-age=600`, `Age: 0`, `X-Cache: MISS`, `X-Cache-Hits: 0` (also `Server: GitHub.com`, `X-Served-By: cache-lga-kjfk8660041-LGA`); the 404 path a minute later `X-Cache: HIT`, `X-Cache-Hits: 1` |
| workflow_run head_sha | `gh api repos/wolfwdavid/tran_real_estate/actions/runs/<lsid> --jq .head_sha` | `ad5fd08...` for 41115004823; `f070c74...` for 41149881068 (each equals its deploy SHA) |
| Propagation | `smoke: <sha> live at ... after <n> s` | **0 s** in both live-smoke runs: the Pages CDN served the new `version.json` on the first poll after `deploy-pages` reported success |

### Proof shots (docs/launch-proof/2026-10-30/)

`pnpm --filter web exec node tests/smoke/proof-shots.mjs --base-url https://wolfwdavid.github.io/tran_real_estate/ --out ../../docs/launch-proof/2026-10-30`

- First run (19:28:03Z, original script): exit 0, five checks `ok`, 427,254 B, but `04-not-found.png` was 4,718 B and blank (background only): the script took its screenshot at `load`, before the fallback shell had hydrated. Fixed in `79f82bc` (`ready: 'h1'` on every HTML shot, `locator.waitFor()` before the screenshot; unit test pins `['h1','h1','h1','h1',null]`).
- Second run (fixed script, 19:35Z): exit 0; `ok landing 200`, `ok slashless-redirect 301 -> .../renter/`, `ok not-found 404`, `ok http-upgrade 301 -> https://wolfwdavid.github.io/tran_real_estate/`, `ok version-json 200` (version ad5fd08...). Files: `01-landing.png` 274,193 B; `02-renter.png` 77,320 B; `03-deep-route-refresh.png` 68,632 B; `04-not-found.png` 77,282 B (header, "404: Page not found", copy, "Go to the home page", footer); `05-version-json.png` 7,555 B; `checks.json` 1,360 B; total 506,342 B; `du -sk` -> **504** (< 5120). `checks.json`: five checks, all `"ok": true`, no misses, `capturedAt` 2026-10-30T19:35Z, `baseUrl` https://wolfwdavid.github.io/tran_real_estate/.
- Commit **`f070c74`** `docs(launch-proof): first-deploy screenshots and HTTP facts` (amended once before any push to carry the Prettier-formatted `checks.json`). Attribution grep -> 0.

## Task 2, second pair: ci 41147247922 and live-smoke 41149881068 (both green on f070c74)

Pre-push check at 23:54:52Z: `## main...origin/main [ahead 2]`, HEAD `f070c746cfb2ef1e0f1151cca2f5779cab00ecd3`, origin/main `ad5fd08...`, tree clean, variables BASE_PATH / PAGES_ENABLED=true / PUBLIC_SITE_URL. The approved `git push origin main` (exit 0, `ad5fd08..f070c74  main -> main`, 23:55:01Z) carried `79f82bc` and `f070c74`.

### ci run 41147247922

- URL: https://github.com/wolfwdavid/tran_real_estate/actions/runs/41147247922 (push, main, headSha f070c74...)
- conclusion **success**; createdAt 23:55:03Z, updatedAt 00:23:11Z, wall **28m08s**

| Job (id) | Conclusion | Started | Completed | Duration |
| --- | --- | --- | --- | --- |
| secrets + real-data guard (124375115814) | success | 23:55:06Z | 23:55:16Z | 10 s |
| configured leg (124375115724) | success | 23:55:05Z | 23:59:43Z | 4m38s |
| root leg (124375115572) | success | 23:55:05Z | 00:16:51Z | 21m46s |
| sub leg (124375116024) | success | 23:55:06Z | 00:22:57Z | 27m51s |
| **deploy** (124383527778) | **success** | 00:23:01Z | 00:23:10Z | 9 s |

- Deploy log: `"artifact_id": 13021544951`, `Created deployment for f070c746cfb2ef1e0f1151cca2f5779cab00ecd3, ID: f070c746...`, **`Evaluated environment url: https://wolfwdavid.github.io/tran_real_estate/`**.
- Root leg: `build-web: pnpm 11.27.0 target=root BASE_PATH=/tran_real_estate BUILD_DIR=build BUILD_SHA=f070c746cfb2ef1e0f1151cca2f5779cab00ecd3`; CSP 45 pages, SEO 44 pages; `1153 passed (17.3m)`; extension oracle passed; `7 passed (2.3s)`; `##[error]` count 0.

### live-smoke run 41149881068 (SUCCESS)

- URL: https://github.com/wolfwdavid/tran_real_estate/actions/runs/41149881068 (workflow_run, createdAt 00:23:14Z, job 124383616869 00:23:16Z -> 00:24:28Z, 1m12s)
- `gh api .../runs/41149881068 --jq .head_sha` -> `f070c746cfb2ef1e0f1151cca2f5779cab00ecd3`
- Log: `SMOKE_BASE_URL: https://wolfwdavid.github.io/tran_real_estate/`, **`SMOKE_EXPECT_VERSION: f070c746cfb2ef1e0f1151cca2f5779cab00ecd3`**, **`smoke: f070c746cfb2ef1e0f1151cca2f5779cab00ecd3 live at https://wolfwdavid.github.io/tran_real_estate/ after 0 s`**, `Running 121 tests using 2 workers`, `version.smoke.ts > version.json equals SMOKE_EXPECT_VERSION` passed, **`121 passed (39.3s)`**.
- Precache install times measured on CI by the new log line: **9,731 ms** (assets.smoke, the cold first visit; the old 5 s default would have failed again), **4,816 ms** and **2,368 ms** (pwa.smoke, warmed). Test durations: assets 10.9 s, pwa registers 5.0 s, pwa precache 3.0 s. The 20 s wait held with 2x headroom on the cold visit.
- Live site at 00:25:04Z: `curl -s .../_app/version.json` -> `{"version":"f070c746cfb2ef1e0f1151cca2f5779cab00ecd3"}`; `/tran_real_estate/` `Cache-Control: max-age=600`, `X-Cache: MISS`, `Age: 0`.

**Which SHA is proven.** GO_LIVE_SHA stays `ad5fd08` (the push that turned Pages on, the first real deploy, and the SHA the D-13 facts and the proof bundle were taken against). The SHA on which ci, deploy and live-smoke are all green is `f070c74`, one deploy later, because the first live-smoke failed on a test timeout (not a site defect) and the plan's rule is that a fix means a new push and a new observed pair rather than a re-run. Both deploys evaluated the same page_url and both live-smoke runs reported 0 s propagation on their own SHA.

## Task 3: owner fresh-profile checks (D-15)

Owner result recorded verbatim above: **"Fresh checks pass"** ("All five checks passed in fresh private windows."), covering (1) landing renders without console errors, (2) `/tran_real_estate/renter` lands on `/tran_real_estate/renter/`, (3) `/investor/` survives Ctrl+Shift+R, (4) `/does-not-exist/` shows the branded not-found page with a 404 document status, (5) `http://` lands on https with the lock icon. No owner screenshots were supplied, so nothing to check for personal data. Executor `<verify>`: `curl -s -o /dev/null -w "%{http_code}" https://wolfwdavid.github.io/tran_real_estate/does-not-exist/` -> **404** (00:25:04Z).

## Task Commits

1. **Task 1: go-live push** - `ad5fd08` (`chore: go live`, empty, pushed)
2. **Task 2: smoke wait + proof-shot fix** - `79f82bc` (`fix(13-13): size the smoke precache wait for a cold CDN and screenshot the 404 after it renders`, pushed in the approved fix push)
3. **Task 2: proof bundle** - `f070c74` (`docs(launch-proof): first-deploy screenshots and HTTP facts`, pushed in the approved fix push; the deployed SHA of the green pair)

**Plan metadata:** `docs(13-13): complete go-live and first-deploy observation plan` (this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md; local, carried by the next push).

## Files Created/Modified

- `docs/launch-proof/2026-10-30/*.png`, `checks.json` - the mechanical proof bundle (README index comes in 13-19)
- `apps/web/tests/smoke/fixtures.ts` - `PRECACHE_INSTALL_TIMEOUT_MS`, `swCache`, `installedPrecache` (logs install time)
- `apps/web/tests/smoke/assets.smoke.ts`, `pwa.smoke.ts` - use the shared helper
- `apps/web/tests/smoke/proof-shots.mjs` - `ready` selector per HTML shot, waited before the screenshot
- `scripts/proof-shots.test.ts` - pins the `ready` column of the plan
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` - position 13-14, 13-13 ticked, LIVE-03 complete with evidence, SMOKE-04 evidence extended

## Decisions Made

- Executor ran the owner commands only under the verbatim approvals recorded above; four mutating remote commands in total.
- The precache wait is sized from measurement (20 s) and logged every run; the 10-minute version poll in `scripts/smoke.mjs` was not touched.
- GO_LIVE_SHA = ad5fd08 for LAUNCH_DATE purposes; green-pair SHA = f070c74 for SMOKE-04 (reasoning above).
- The 404 proof is browser-side (smoke + screenshot + owner check), since the raw body is the shell.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Smoke precache poll sized for the emulator, not a cold CDN**
- **Found during:** Task 2 (live-smoke 41115004823)
- **Issue:** `assets.smoke.ts` and `pwa.smoke.ts` waited for the worker's install with Playwright's 5 s `expect.poll` default; the atomic 380-entry `addAll` took 5.27 s on the cold Pages CDN (9.7 s on the second run's cold visit), so the first live-smoke after the real deploy failed with exit 1.
- **Fix:** one `installedPrecache` helper in `fixtures.ts` with a 20 s wait (2.4x the slowest local measurement) and a per-run install-time log; both specs use it.
- **Files modified:** `apps/web/tests/smoke/fixtures.ts`, `assets.smoke.ts`, `pwa.smoke.ts`
- **Verification:** 117 guard tests, `pnpm check` clean, 121/121 locally against live, then live-smoke 41149881068 green on CI (install 9,731 ms on the cold visit, inside the wait)
- **Committed in:** `79f82bc`

**2. [Rule 1 - Bug] proof-shots screenshot of the 404 taken before the fallback shell hydrated**
- **Found during:** Task 2 (first proof run; `04-not-found.png` 4,718 B, blank)
- **Issue:** the script screenshots at `load`; the 404 is the SPA fallback shell and renders `+error.svelte` client-side afterwards.
- **Fix:** `ready: 'h1'` on each HTML shot and a `waitFor` before the screenshot; unit test added.
- **Files modified:** `apps/web/tests/smoke/proof-shots.mjs`, `scripts/proof-shots.test.ts`
- **Verification:** regenerated bundle shows the branded 404 (77,282 B); `proof-shots.test.ts` passes
- **Committed in:** `79f82bc`

### Plan expectation corrected by observation (no code change)

**3. Raw 404 body has no `<title>`.** The plan expected `grep -c "<title>"` on the 404 body to show the branded title; the fallback shell carries none and the title (`Page not found: Tran Real Estate Tools`) is client-rendered. Recorded as a D-13 fact.

### Owner-approved substitutions

**4. Executor ran the owner commands** (go-live trio and the fix push) under the verbatim approvals; two local commits instead of the plan's one (`fix` then `docs(launch-proof)`), because the bundle had to be regenerated with the fixed script.

**5. A second deploy before the plan closed.** The plan expected one SHA with deploy and live-smoke green; the first live-smoke was red, so the green pair is on f070c74. Handled by the plan's own rule (fix, new push, new observed pair) under the owner's push approval.

---

**Total deviations:** 2 auto-fixed (both Rule 1, test/tooling code), 1 expectation correction, 2 owner-approved substitutions.
**Impact on plan:** No change to the site's code or configuration. SMOKE-04's live half is proven one deploy later than GO_LIVE_SHA; LIVE-03 is proven on GO_LIVE_SHA and re-confirmed on f070c74.

## Issues Encountered

- `tar -xf` cannot read the Playwright trace zip on Git Bash; `powershell Expand-Archive` did. The per-page network log is `2-trace.network` (the `0-`/`1-` files were empty).
- The Pages CDN served `X-Cache: MISS` with `Age: 0` on the landing page both immediately after the deploy and 5 hours later; expect cold-ish first visits after each deploy, which is what the precache measurement now records.
- Root-leg Playwright time varied 15.7m (rehearsal) / 21.0m (go-live) / 17.3m (fix); wall 28m39s and 28m08s for the two runs, inside the 21-33 min band.

## Known Stubs

None. No application code changed in this plan.

## Next Phase Readiness

- Wave 8: 13-14 (GTM-04 Umami proof or cut) and 13-21 (probes). Nothing local is pending a push except this plan's metadata commit; the next push deploys again and live-smoke will log three more precache install times.
- 13-19 runbook "First deploy facts": propagation 0 s (both deploys), `Cache-Control: max-age=600`, cold `X-Cache: MISS`, 380-entry precache installing in 5.3 to 9.7 s on CI's first visit, raw 404 body is the shell (branded title client-rendered), deploy job 9-18 s, live-smoke 1m12s-1m25s.
- 13-18 LAUNCH-AUDIT and the launch-proof README (13-19) can index `docs/launch-proof/2026-10-30/` as the GO_LIVE_SHA bundle; a later bundle for f070c74 is optional (same page_url, same facts).
- Still unset by design: `PUBLIC_WEB3FORMS_KEY`, `PUBLIC_CONTACT_EMAIL`, `PUBLIC_ANALYTICS_HOST`, `PUBLIC_ANALYTICS_WEBSITE_ID`, `EXTENSION_RELEASES_ENABLED`.

## Self-Check: PASSED

- FOUND docs/launch-proof/2026-10-30/{01-landing,02-renter,03-deep-route-refresh,04-not-found,05-version-json}.png and checks.json (504 KB)
- FOUND commits ad5fd08 (go live), 79f82bc (fix), f070c74 (proof) on origin/main; `git log -1 --format=%s origin/main` -> `docs(launch-proof): first-deploy screenshots and HTTP facts`
- FOUND `gh run list --workflow ci.yml --branch main --limit 1` -> f070c74 success; live-smoke 41149881068 success with head_sha f070c74
- `requirements-completed: [LIVE-03, SMOKE-04]` copied verbatim from 13-13-PLAN.md
- Live `_app/version.json` = f070c74; `/does-not-exist/` -> 404

---
*Phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down*
*Completed: 2026-10-31*
