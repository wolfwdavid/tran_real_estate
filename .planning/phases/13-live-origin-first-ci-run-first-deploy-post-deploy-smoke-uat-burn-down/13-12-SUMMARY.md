---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 12
subsystem: infra
tags: [ci, github-actions, repository-variables, base-path, rehearsal, owner-checkpoint, live-smoke]

# Dependency graph
requires:
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-11 origin/main at f26cf24 with green ci, live-smoke registered and skipped, Dependabot triaged, gh variable list empty
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-09 ci.yml root leg reads vars.BASE_PATH (D-02) and every leg reads vars.PUBLIC_SITE_URL (D-01)
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-10 local rehearsal of the base-path build under MSYS_NO_PATHCONV=1
provides:
  - Repository variables PUBLIC_SITE_URL=https://wolfwdavid.github.io and BASE_PATH=/tran_real_estate set with exact values (no Git Bash path mangling); PAGES_ENABLED still absent
  - Rehearsal ci run 41106746719 on ab70bbb green in 21m26s with the root leg logging `target=root BASE_PATH=/tran_real_estate`, deploy skipped, live-smoke run 41109758676 skipped
  - origin/main = local main = ab70bbb (`chore: rehearse sub-path deploy build`, carrying the 13-11 metadata commit 14f1cf7)
affects: [13-13 go-live (PAGES_ENABLED=true + "chore: go live" push), 13-14/13-15 optional variables, 13-18 LAUNCH-AUDIT regeneration, Phase 15 CI lane timing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Owner checkpoints are satisfied by a verbatim recorded approval for the executor to run exactly the printed commands; nothing else mutates the remote (D-14)"
    - "The REST endpoint `gh api repos/<o>/<r>/actions/jobs/<id>/logs` is the oracle for a completed job's full log; `gh run view --job <id> --log` and the job-steps metadata can lag for minutes after completion"

key-files:
  created:
    - .planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-12-SUMMARY.md
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "13-12: the two `gh variable set` commands and the single rehearsal commit + push were run by the executor only under the owner's verbatim approvals (recorded below); PAGES_ENABLED, Web3Forms, contact and Umami variables were deliberately left unset"
  - "13-12: with no PowerShell tool exposed in the session, the variables were set from Git Bash with `MSYS_NO_PATHCONV=1` on the BASE_PATH command (the plan's sanctioned Git Bash form); the value landed exactly on the first attempt, no corrective re-set was needed"
  - "13-12: LIVE-03 stays unticked (13-13 closes it on the real deploy); SMOKE-04 inline evidence extended with the third skipped live-smoke run"

patterns-established:
  - "Rehearse-before-go-live: the first CI run whose root leg builds with the base path happens with PAGES_ENABLED unset, so the go-live run is never the first to exercise BASE_PATH (Pitfall 1 closed)"

requirements-completed: [LIVE-03, SMOKE-04]

# Metrics
duration: 34min
completed: 2026-10-30
---

# Phase 13 Plan 12: Origin variables and rehearsal run Summary

**Repository variables `PUBLIC_SITE_URL=https://wolfwdavid.github.io` and `BASE_PATH=/tran_real_estate` are set with exact values, and the rehearsal push `ab70bbb` (`chore: rehearse sub-path deploy build`, PAGES_ENABLED still unset) produced ci run 41106746719: green in 21m26s, root leg `build-web: pnpm 11.27.0 target=root BASE_PATH=/tran_real_estate`, CSP/SEO/budget oracles passed, 1153 E2E + axe tests passed under the base path, extension oracle passed, `deploy` skipped, and live-smoke run 41109758676 skipped. Go-live is now one variable plus one empty commit.**

## Performance

- **Duration:** 34 min wall (one ~21 min CI run and two owner checkpoints)
- **Started:** 2026-10-30T18:20:49Z
- **Completed:** 2026-10-30T18:55:00Z
- **Tasks:** 2 (both owner checkpoints, both satisfied under verbatim executor approvals)
- **Files modified:** 0 source files; planning docs only (this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md)

Every tool call stayed under 7 minutes: CI was watched with `timeout 360 gh run watch ... --interval 30` followed by a status read, four polls in total.

## Owner approvals (verbatim)

- **Task 1.** The orchestrator asked: "Plan 13-12 checkpoint 1: set PUBLIC_SITE_URL=https://wolfwdavid.github.io and BASE_PATH=/tran_real_estate as repository variables (PAGES_ENABLED stays unset). How do you want to proceed?" The owner chose the option **"Approve executor set"** (description: "Let the executor run exactly the two `gh variable set` commands (PowerShell form, no path mangling), then verify with `gh variable list`. Approval recorded verbatim.").
- **Task 2.** The orchestrator asked: "Plan 13-12 checkpoint 2: after the variables are verified, who runs the rehearsal commit and push (`git commit --allow-empty -m "chore: rehearse sub-path deploy build"` then `git push origin main`, PAGES_ENABLED still unset)?" The owner chose the option **"Approve executor push"** (description: "Let the executor run exactly those two commands once the variable list is confirmed, then watch the ~30 min CI run and prove the root leg built with BASE_PATH=/tran_real_estate. Approval recorded verbatim.").

Exactly four mutating remote commands ran across the plan: two `gh variable set`, one `git commit --allow-empty`, one `git push origin main`. No `gh variable delete`, no PAGES_ENABLED, no settings change, no PR action.

## Task 1: Origin variables

Pre-state (18:20Z): `gh variable list --repo wolfwdavid/tran_real_estate` EMPTY (as 13-11 left it). No PowerShell tool was exposed in this session, so both commands ran through Git Bash with `MSYS_NO_PATHCONV=1` on the `BASE_PATH` command, the form docs/DEPLOY-CHECKLIST.md Step 6.3 and docs/RUNBOOK.md prescribe for Git Bash.

| # | Command | Exit |
| --- | --- | --- |
| 1 | `gh variable set PUBLIC_SITE_URL --repo wolfwdavid/tran_real_estate --body "https://wolfwdavid.github.io"` | 0 |
| 2 | `MSYS_NO_PATHCONV=1 gh variable set BASE_PATH --repo wolfwdavid/tran_real_estate --body "/tran_real_estate"` | 0 |

Verification (`gh variable list --repo wolfwdavid/tran_real_estate`, exit 0; values are public by design):

```
BASE_PATH	/tran_real_estate	2026-10-30T18:21:10Z
PUBLIC_SITE_URL	https://wolfwdavid.github.io	2026-10-30T18:21:10Z
```

`--json name,value`: `[{"name":"BASE_PATH","value":"/tran_real_estate"},{"name":"PUBLIC_SITE_URL","value":"https://wolfwdavid.github.io"}]`. Bracketed strict check: `BASE_PATH=[/tran_real_estate]`, `PUBLIC_SITE_URL=[https://wolfwdavid.github.io]`. No `C:/Program Files/Git` prefix, no trailing slash, `PAGES_ENABLED` absent. First attempt succeeded; no corrective re-set. Re-confirmed unchanged at 18:24Z immediately before the push. The optional Web3Forms / contact-email / Umami variables were not set (plans 13-14/13-15).

## Task 2: Rehearsal push and base-path root leg

### Pre-push check (18:24Z)

`git fetch origin && git status -sb` -> `## main...origin/main [ahead 1]`, HEAD `14f1cf7`, origin/main `f26cf24`. Variables unchanged (two entries, no PAGES_ENABLED).

### The two approved commands

| # | Command | Exit | Output |
| --- | --- | --- | --- |
| 1 | `git commit --allow-empty -m "chore: rehearse sub-path deploy build"` | 0 | pre-commit hooks ran (gitleaks: `0 commits scanned ... no leaks found`; `Real-data guard passed (0 staged files checked)`); `[main ab70bbb] chore: rehearse sub-path deploy build` |
| 2 | `git push origin main` | 0 | `f26cf24..ab70bbb  main -> main`; banner `GitHub found 6 vulnerabilities on wolfwdavid/tran_real_estate's default branch (6 low)` (same count as 13-11; the `pnpm audit:deps` gate owns this, recorded only) |

After the push: `git status -sb` -> `## main...origin/main` (no ahead/behind); `git rev-parse HEAD` = `ab70bbb222691ef0a54b69a159868a0702421511`. The push carried two commits: `14f1cf7` (13-11 planning metadata) and `ab70bbb` (empty rehearsal commit). `git log -1 --format=%B | grep -ciE "co-authored-by|claude|anthropic"` -> 0.

### ci run 41106746719

- URL: https://github.com/wolfwdavid/tran_real_estate/actions/runs/41106746719
- headSha `ab70bbb222691ef0a54b69a159868a0702421511` = `git rev-parse HEAD`; event `push`, branch `main`, attempt 1
- conclusion **success**; createdAt 18:25:00Z, updatedAt 18:46:26Z, wall **21m26s**
- Plan `<verify>`: `gh run list --workflow ci.yml --branch main --limit 1 --json headSha,conclusion` -> `[{"conclusion":"success","headSha":"ab70bbb222691ef0a54b69a159868a0702421511"}]`

| Job | Conclusion | Started | Completed | Duration | 13-11 baselines (41089068534 / 41099425596) |
| --- | --- | --- | --- | --- | --- |
| secrets + real-data guard | success | 18:25:03Z | 18:25:14Z | 11 s | 11 s / 9 s |
| check, lint, unit, build, csp, e2e+axe (configured) | success | 18:25:02Z | 18:29:46Z | 4m44s | 3m58s / 5m55s |
| check, lint, unit, build, csp, e2e+axe (root) | success | 18:25:03Z | 18:44:56Z | **19m53s** | 28m32s / 18m34s |
| check, lint, unit, build, csp, e2e+axe (sub) | success | 18:25:03Z | 18:46:26Z | 21m23s | 22m06s / 26m39s |
| deploy | **skipped** | 18:46:26Z | 18:46:26Z | - | skipped / skipped |

`gh api repos/wolfwdavid/tran_real_estate/actions/runs/41106746719/jobs` -> `total_count` 5 with `deploy=completed/skipped` (this time `gh run view --json jobs` also listed it right away). Root-leg duration 19m53s is inside the 13-11 range (18m34s to 28m32s) and inside the plan's 21-27 min baseline band's lower edge; no large change. The deploy job registered at 18:46:26Z, the same second the last quality job finished (13-11 saw a 6m32s GitHub-side gap on run 41099425596).

### Root-leg proof (job 124238456894)

Full log fetched with `gh api repos/wolfwdavid/tran_real_estate/actions/jobs/124238456894/logs` (3300 lines, 468,577 bytes).

The grep line (`... | grep -m1 "build-web: .*target=root"`):

```
2026-10-30T18:28:49.5106098Z build-web: pnpm 11.27.0 target=root BASE_PATH=/tran_real_estate BUILD_DIR=build BUILD_SHA=ab70bbb222691ef0a54b69a159868a0702421511
```

Contains `BASE_PATH=/tran_real_estate` (13-11's runs logged `BASE_PATH=''` because the variable was unset). Other root-leg evidence from the same log:

| Step (log group) | Started | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` / `pnpm audit:deps` | 18:25:14Z / 18:25:19Z | passed |
| `pnpm check` / `pnpm lint` / `gen-fixtures --check` | 18:25:43Z / 18:26:02Z / 18:27:21Z | passed; `Fixtures match generator output (6 files)` |
| `pnpm test:unit` | 18:27:21Z | passed (1m27s) |
| `pnpm run build:root` | 18:28:48Z | build-web line above (14 s) |
| `node scripts/assert-csp.mjs apps/web/build --target root` | 18:29:03Z | `CSP assertion passed for 45 pages in apps/web/build (analytics host: none)` |
| `node scripts/assert-seo.mjs apps/web/build --target root` | 18:29:03Z | `SEO assertion passed for 44 pages, 14 sitemap URLs, 6 share cards in apps/web/build` (the assert does not print the canonical URL; nothing to grep) |
| `node scripts/assert-budget.mjs apps/web/build --require-tools` | 18:29:03Z | passed |
| `playwright test --project=root` | 18:29:03Z | `1153 passed (15.7m)` |
| `pnpm ext:build && pnpm ext:assert` | 18:44:44Z | WXT 0.21.4 built chrome-mv3 in 340 ms, zip `sponsored-listing-filter-0.1.0-chrome.zip` 263.88 kB; **`Extension oracle passed (6 files scanned in apps/extension/.output/chrome-mv3, zip root verified)`** |
| `pnpm ext:test:browser && pnpm ext:e2e` | 18:44:46Z | `7 passed (2.1s)` |
| `Upload Pages artifact` | - | not run (gated on `vars.PAGES_ENABLED == 'true'`; no log group present) |

`grep -c "##\[error\]"` on the full log -> 0; ci.yml contains no `continue-on-error`, so the job's `success` means every step passed.

### live-smoke run 41109758676

- URL: https://github.com/wolfwdavid/tran_real_estate/actions/runs/41109758676
- event `workflow_run`, headSha `ab70bbb222691ef0a54b69a159868a0702421511`, createdAt 18:46:29Z, completed 18:46:30Z (1 s; 13-11's second run queued about four minutes)
- run conclusion `skipped`; `gh api .../runs/41109758676/jobs` -> `total_count` 1, **`read-only smoke of the deployed site=skipped`** (status completed). Not `failure`, as D-09 specifies while `PAGES_ENABLED` is unset.

## Task Commits

No source commits. The plan's own commit is the approved empty rehearsal commit:

1. **Task 2: rehearsal push** - `ab70bbb` (`chore: rehearse sub-path deploy build`, empty, pushed to origin/main)

**Plan metadata:** `docs(13-12): complete origin variables and rehearsal run plan` (this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md).

## Files Created/Modified

- `.planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-12-SUMMARY.md` - this record
- `.planning/STATE.md` - position 13-13, metrics, decisions, session; stale "Next:" line refreshed to the 13-13 go-live step
- `.planning/ROADMAP.md` - 13-12 ticked, 13/21
- `.planning/REQUIREMENTS.md` - SMOKE-04 inline evidence extended with live-smoke run 41109758676 (`ab70bbb`); LIVE-03 stays unticked for 13-13

## Decisions Made

- Executor-run remote mutations happened only under the two verbatim approvals above; exactly four mutating commands ran (two `gh variable set`, `git commit --allow-empty`, `git push origin main`).
- Git Bash + `MSYS_NO_PATHCONV=1` used for the variable set because no PowerShell tool was available; the plan lists this as an equivalent form and the value verified exact.
- LIVE-03 left open: the rehearsal proves the build and tests under the base path, not the live routing contract, which only the 13-13 deploy can show.

## Deviations from Plan

### Approved substitution (owner approval, not a Rule 1-3 fix)

**1. Executor ran the owner commands under verbatim approvals**
- **Found during:** Tasks 1 and 2
- **Issue:** The plan's default is that the owner runs the printed commands; the owner chose "Approve executor set" and "Approve executor push" instead.
- **Resolution:** The executor ran exactly the printed commands, once each, and nothing else that mutates the remote. Both approvals recorded verbatim above.

### Tooling substitution (no effect on outcome)

**2. Git Bash form instead of PowerShell form for `gh variable set`**
- **Found during:** Task 1
- **Issue:** The approval description named the PowerShell form; the session exposed no PowerShell tool.
- **Resolution:** Used the plan's Git Bash form with `MSYS_NO_PATHCONV=1` on the BASE_PATH command. Verified exact (`BASE_PATH=[/tran_real_estate]`), so the approved intent (exact value) was met on the first attempt.

---

**Total deviations:** 0 auto-fixed; 1 owner-approved substitution; 1 tooling substitution.
**Impact on plan:** None on scope or outcome.

## Issues Encountered

- `gh run view --job 124238456894 --log` returned a truncated 427-line log (only steps up to `gen-fixtures --check` plus the post-step) twice, 1-2 minutes after the job completed, and `gh api .../actions/jobs/124238456894` still reported `null` conclusions for steps 4 onward. The REST `.../actions/jobs/<id>/logs` endpoint returned the full 3300-line log immediately and is the oracle used for the grep line and step evidence above. Recorded as a pattern for 13-13.
- The push banner reports 6 low Dependabot alerts (unchanged from 13-11). Owned by the `pnpm audit:deps` gate (passed on this run); no action in this plan.

## Known Stubs

None. No application code changed in this plan.

## Next Phase Readiness

- Plan 13-13 (go-live): the owner sets `PAGES_ENABLED=true` and pushes `chore: go live`; the deploy job and the Upload Pages artifact step un-gate, and live-smoke runs for real against `https://wolfwdavid.github.io/tran_real_estate/`. LIVE-03 closes there.
- The deploy configuration has now passed CI once with nothing deployed: variables read correctly by the root leg (`BASE_PATH=/tran_real_estate`), CSP/SEO/budget/E2E/extension oracles green under the base path, deploy and live-smoke skipped as designed.
- Still unset (by design): `PAGES_ENABLED`, `PUBLIC_WEB3FORMS_KEY`, `PUBLIC_CONTACT_EMAIL`, `PUBLIC_ANALYTICS_HOST`, `PUBLIC_ANALYTICS_WEBSITE_ID`, `EXTENSION_RELEASES_ENABLED`.
- Phase 15 lane timing: root 19m53s / sub 21m23s / configured 4m44s on this run, alongside 13-11's two data points.

## Self-Check: PASSED

- FOUND .planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-12-SUMMARY.md
- FOUND commit ab70bbb (rehearsal commit, HEAD = origin/main)
- FOUND commits 14f1cf7 (13-11 metadata, pushed in the same bundle) and f26cf24 (previous origin/main)
- `requirements-completed: [LIVE-03, SMOKE-04]` copied verbatim from 13-12-PLAN.md; LIVE-03 stays `[ ]` / Pending in REQUIREMENTS.md by design (13-13 closes it)
- `gh variable list` -> exactly BASE_PATH and PUBLIC_SITE_URL; `gh run list --workflow ci.yml --branch main --limit 1 --json headSha,conclusion` -> ab70bbb success
- `git diff .planning/ROADMAP.md` -> only the 13-12 tick and the 12->13 counts; `git status -sb` -> `## main...origin/main` before the metadata commit

---
*Phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down*
*Completed: 2026-10-30*
