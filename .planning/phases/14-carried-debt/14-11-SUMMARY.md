---
phase: 14-carried-debt
plan: 11
subsystem: launch-gate
tags: [close-out, ledger, ci, deploy, live-smoke, launch-audit, deployed-sha, DEBT-01, DEBT-02, DEBT-03, DEBT-04, DEBT-05, DEBT-06, DEBT-07, DEBT-08, DEBT-09]
requires:
  - "14-01..14-10 and 14-12 (every DEBT fix, test and owner decision)"
  - "13-18 (the audit-at-the-deployed-commit procedure)"
provides:
  - "HUMAN-UAT ledger: L66 decided (superseded by DEBT-03), L89 decided (superseded by DEBT-09); tally decided 6, carried 7"
  - "REQUIREMENTS: DEBT-01..DEBT-09 ticked, traceability rows Complete"
  - "Phase 14 head 449ecc5 pushed: ci 42289609809 success (deploy job success), live-smoke 42292936697 success (121 passed), live version.json = 449ecc5"
  - "docs/LAUNCH-AUDIT.md regenerated at 449ecc5: /feedback/ and /for-{agents,investors,renters}/ are HARD PASS in both build sections, report-only list reads None, 0 FAIL cells"
affects:
  - "Phase 15 (next phase; the audit and the deploy are current at 449ecc5)"
  - "Owner: 1 local docs commit ahead of origin (the audit) plus this plan's metadata commit"
tech-stack:
  added: []
  patterns:
    - "When DEPLOYED_SHA equals main HEAD, the 13-18 carry-back is still run as written (detach, generate, copy out, switch, copy back) so the procedure stays uniform"
key-files:
  created:
    - .planning/phases/14-carried-debt/14-11-SUMMARY.md
  modified:
    - .planning/HUMAN-UAT.md
    - .planning/REQUIREMENTS.md
    - docs/LAUNCH-AUDIT.md
    - docs/audit/banned.txt
    - docs/audit/budget.txt
    - docs/audit/csp.txt
    - docs/audit/pitfalls.txt
key-decisions:
  - "No 429 re-dispatch: the workflow_run live-smoke passed on its first run, so no workflow_dispatch was sent"
  - "The plan's literal grep 'for-renters/index.html' matches docs/audit/budget.txt, not LAUNCH-AUDIT.md (the audit labels routes as /for-renters/); the PASS rows were verified on the route-form labels and in budget.txt"
duration: "Task 1 in the previous session; resume (Tasks 2-3) about 60 min, 20:34Z-21:35Z"
completed: 2026-11-06
---

# Phase 14 Plan 11: Phase close-out (ledger, push, CI, audit at the deployed commit) Summary

**Phase 14 is closed. L66 and L89 are decided and DEBT-01..09 are ticked. The local gate was green, and the owner-approved push of 449ecc5 ran green on GitHub: ci 42289609809 (deploy job included) and live-smoke 42292936697 (121 passed, live after 0 s). The launch audit was then regenerated at DEPLOYED_SHA 449ecc5 with the deploy variables. In it, /feedback/ and the three /for-*/ pages are HARD PASS under 60 KB in both build sections, the report-only list reads "None.", and there are zero FAIL cells.**

## Performance

- **Duration:** Task 1 ran in the previous session. The resume ran from 20:34Z (pre-push check) to 21:35Z (audit commit), about 60 min, and 24 min of that was the ci run.
- **Tasks:** 3 of 3
- **Files modified:** 2 planning files (Task 1) and 5 generated audit files (Task 3)

## Task 1: Close L66/L89, tick DEBT-01..09, full local gate (commit 449ecc5)

- L66 now reads `decided (superseded by DEBT-03, 2026-11-06)` and L89 reads `decided (superseded by DEBT-09, 2026-11-06)`. The tally was refreshed to decided 6 (L66, L79, L80, L81, L89, L92) and carried 7, and the ledger oracle passes with 99 rows.
- DEBT-01..DEBT-09 are `[x]` in REQUIREMENTS.md, and all 9 traceability rows read Complete.
- The full local gate ran with no deploy env and every one of the 23 `verify` steps exited 0:
  - test:unit: 359 files, 6998 tests
  - test:e2e: 2350 passed, 4 skipped by design
  - budget: 9 HARD routes under 60 KB
- Before the push, the trailer sweep and the AI-mention sweep over origin/main..HEAD both came back empty.

## Task 2: Push, CI, deploy, live-smoke

| Step | Result |
| --- | --- |
| Pre-push state | tree clean, HEAD `449ecc578b947416a74a9111334af543887c03d3`, `origin/main...HEAD` = `0 49`, trailer sweep empty |
| `git push origin main` (the only push) | `7372b61..449ecc5 main -> main`; origin/main = `449ecc5` |
| ci.yml run **42289609809** | **success**, created 20:35:14Z, completed 20:59:21Z (about 24 min) |
| ci jobs | secrets + real-data guard success (11 s); configured success (4m52s); sub success (21m04s); root success (23m51s) |
| deploy job | **success** (20:59:10Z-20:59:20Z, 10 s) |
| live-smoke.yml run **42292936697** (event workflow_run, headSha 449ecc5) | **success**: `smoke: 449ecc5... live at https://wolfwdavid.github.io/tran_real_estate/ after 0 s`, `121 passed (49.6s)`, job 20:59:26Z-21:01:10Z |
| 429 dispatch | not needed (first run green) |
| `curl https://wolfwdavid.github.io/tran_real_estate/_app/version.json` | `{"version":"449ecc578b947416a74a9111334af543887c03d3"}` = pushed HEAD |

**DEPLOYED_SHA:** `449ecc578b947416a74a9111334af543887c03d3` (short `449ecc5`)

## Task 3: Launch audit at DEPLOYED_SHA (13-18 procedure)

### Setup

- `.tools/deploy.env` was written from `gh variable list`. The repository has exactly BASE_PATH, PAGES_ENABLED, PUBLIC_SITE_URL and PUBLIC_WEB3FORMS_KEY, and the file holds MSYS_NO_PATHCONV, BASE_PATH, PUBLIC_SITE_URL and PUBLIC_WEB3FORMS_KEY. Values were written straight to the file and never printed. `git check-ignore` confirmed the file is ignored.
- `git switch --detach 449ecc5`; HEAD stayed at DEPLOYED_SHA for the whole evidence run. The Node timer loop passed, and `pnpm install --frozen-lockfile` reported the lockfile up to date.
- Every build and Playwright call held the build lock, and the lock was released at the end of each call.

### Gates and builds (deploy env, `corepack.cmd`)

| Step | Exit | Time | Output |
| --- | --- | --- | --- |
| `pnpm audit:deps` (first) | 0 | - | `5 ignored: 4 low \| 1 moderate`, no new advisory |
| `pnpm build:root` | 0 | 29 s | `target=root BASE_PATH=/tran_real_estate BUILD_DIR=build BUILD_SHA=449ecc57...` |
| `pnpm build:sub` | 0 | 23 s | `target=sub BASE_PATH=/tran_real_estate BUILD_DIR=build-sub` |
| `pnpm build:configured` | 0 | 21 s | `target=configured BASE_PATH='' BUILD_DIR=build-configured` |
| three `_app/version.json` | - | - | all `449ecc578b947416a74a9111334af543887c03d3` |

### E2E shards (`audit-evidence.mjs e2e`, `--workers=4`, sized from `--list`)

The `--list` totals were root 1157 tests in 84 files, sub 1153 in 83 files and configured 44 in 4 files, for 2354 in all. Shard 5/8 is empty on both root and sub, and was run anyway so the evidence set is complete.

| Shard | Tests | Result | Wall |
| --- | --- | --- | --- |
| configured | 44 | 44 passed | 27 s |
| root-1of8 | 171 | 171 passed | 125 s |
| root-2of8 | 119 | 119 passed | 93 s |
| root-3of8 | 147 | 141 passed, 6 skipped (feedback coming-soon: key configured on this build) | 94 s |
| root-4of8 | 320 | 320 passed | 146 s |
| root-5of8 | 0 | empty | 4 s |
| root-6of8 | 112 | 112 passed (perf.spec, 4 CLS rows) | 45 s |
| root-7of8 | 145 | 145 passed | 99 s |
| root-8of8 | 143 | 137 passed, 6 skipped (waitlist coming-soon, same reason) | 116 s |
| sub-1of8 | 171 | 171 passed | 112 s |
| sub-2of8 | 119 | 119 passed | 89 s |
| sub-3of8 | 147 | 147 passed | 96 s |
| sub-4of8 | 320 | 320 passed | 143 s |
| sub-5of8 | 0 | empty | 4 s |
| sub-6of8 | 108 | 104 passed, 4 skipped (perf.spec measured on root) | 41 s |
| sub-7of8 | 149 | 149 passed | 100 s |
| sub-8of8 | 139 | 139 passed | 117 s |

Every shard exited 0. The 16 skips are the same by-design set recorded in 13-18.

### Unit shards (no deploy env)

`env | grep -E '^(BASE_PATH|PUBLIC_|MSYS_NO_PATHCONV)'` printed nothing before these runs.

| Project | Files | Tests | Wall |
| --- | --- | --- | --- |
| scripts | 36 | 1070 passed | 18 s |
| core | 87 | 2701 passed | 9 s |
| brand | 2 | 29 passed | 3 s |
| extension | 17 | 242 passed | 6 s |
| web | 183 | 2694 passed | 47 s |
| web-browser | 34 | 262 passed | 23 s |

Total: 359 files, 6998 passed, which matches the local gate figure.

### Merge and generate

```
Merged 17 E2E shard(s) -> apps/web/test-results/e2e-report.json: 2354 tests, 2338 passed, 0 failed, 16 skipped, 0 ran in more than one shard
Merged 6 unit shard(s) -> apps/web/test-results/vitest.json: 6998 tests, 0 failed
Merged 4 CLS row(s) -> apps/web/test-results/cls.json
```

`pnpm audit:launch` ran with the deploy env, still detached, and exited 0 in 8 s: `Launch audit: every Summary row PASS`.

### Acceptance

| Check | Result |
| --- | --- |
| Header `- Commit:` | `449ecc5` (= short DEPLOYED_SHA) |
| Header `- Base URL audited:` | `https://wolfwdavid.github.io/tran_real_estate/ (root/deploy build); https://wolfwdavid.github.io/tran_real_estate/ (sub-path build)` |
| Performance table, root build | /feedback/ 56.2 KB, /for-agents/ 59.7 KB, /for-investors/ 59.8 KB, /for-renters/ 59.8 KB, all **PASS** |
| Performance table, analytics-on build | same four routes, **PASS** |
| "Report-only pages over the tool budget" | `None.` |
| `grep -c "\| FAIL" docs/LAUNCH-AUDIT.md` | **0** |
| `docs/audit/budget.txt` | `feedback/index.html` and `for-{agents,investors,renters}/index.html` are `PASS` in both build sections; the largest is for-investors at js 61244 B (configured), under 61,440 B. `report-only over budget` lines: **0** |
| `tranrealestate` in the audit | 0 |
| Prettier on the regenerated audit (on main) | clean |

### Diff against the previous audit (f169749)

- **Performance:** the four routes moved from "Report-only pages over the tool budget" (about 97-103 KB) into the HARD gated tables as PASS. The report-only list now reads "None.", and no status went from PASS to anything else.
- **Raw outputs:**
  - `banned.txt`: 454 files scanned (was 446), 0 matches.
  - `csp.txt`: script-src hashes rotated for index and renter; connect-src unchanged.
  - `pitfalls.txt`: real-data guard 2024 files (was 1971); gitleaks 1373 commits, no leaks; scheduler.test.ts 22 passed (was 18, from 14-07).
- `a11y.txt`, `deps.txt`, `disclaimers.txt` and `seo.txt` are byte-identical.

### Carry-back and cleanup

- The generated files were copied to the scratchpad, `git checkout -- docs/` was run, then `git switch main`, then the files were copied back.
- Commit **`8e85527` `docs(14-11): launch audit at 449ecc5`**. Pre-commit ran gitleaks (no leaks) and the real-data guard (5 staged files). Attribution grep on the message: 0. **Not pushed.**
- `.tools/deploy.env` was deleted; `test -f` is false and `git status --short .tools` is empty.
- `apps/web/build*` now carry 449ecc5 built with the deploy env. Because 449ecc5 is main's code, they are current, but they are not default-env builds, so rebuild before any default-env local smoke.

## Task Commits

1. **Task 1: Close L66/L89, tick DEBT-01..09, local gate**: `449ecc5` (pushed)
2. **Task 2: Push, CI, deploy, live-smoke**: no commit (run ids above)
3. **Task 3: Launch audit at DEPLOYED_SHA**: `8e85527` (local)

**Plan metadata:** `docs(14-11): complete phase close-out plan` covers this SUMMARY, STATE.md and ROADMAP.md (local).

**For the owner:** main is ahead of origin by the audit commit `8e85527` and the metadata commit, both docs-only. They were not pushed, by instruction. The next push carries them, and since that push is a docs-only deploy, its ci/live-smoke trio can be read the usual way.

## Files Created/Modified

- `.planning/HUMAN-UAT.md`: L66 and L89 decided, tally refreshed (Task 1)
- `.planning/REQUIREMENTS.md`: DEBT-01..09 ticked and Complete (Task 1)
- `docs/LAUNCH-AUDIT.md`, `docs/audit/{banned,budget,csp,pitfalls}.txt`: regenerated at 449ecc5 (Task 3)

## Decisions & Deviations

- **No 429 dispatch.** The workflow_run smoke was green on its first run.
- **[Plan expectation] Grep string.** The plan's verify command `grep -c "for-renters/index.html" docs/LAUNCH-AUDIT.md` prints 0, because the audit's tables label routes as `/for-renters/`; the `index.html` form appears only in `docs/audit/budget.txt`. The substance of the criterion (four rows, PASS, both builds) was verified on the route labels and in budget.txt. No file changed.
- **[Out of scope, noted for the owner/Phase 15] Stale UAT item text.** The generated "Human UAT (deferred)" item 9 still tells the owner to read the report-only section, which now reads "None.". That text comes from `scripts/lib/pitfalls-evidence.mjs` (HUMAN_UAT), and this plan does not hand-edit generated output. The owner decision it asks for is already recorded as L89 decided. A one-line wording update can be made in a later plan.
- L51 (06-R12) stays pending for the owner. DEBT-01 makes the re-check possible (D-09/D-10/D-11 rows untouched).

## Known Stubs

None. The audit's Sign-off lines are blank by design for the owner.

## Next Phase Readiness

- Phase 14 is complete: all nine DEBT requirements are closed, the deploy is live and smoke-green at 449ecc5, and the audit describes exactly that commit.
- Phase 15 can start from main. The next push carries `8e85527` and this plan's metadata commit.

## Self-Check: PASSED

- FOUND `docs/LAUNCH-AUDIT.md` with `- Commit: 449ecc5` (1 match) and `| FAIL` (0)
- FOUND `docs/audit/budget.txt` with the four routes PASS twice and 0 report-only lines
- FOUND commits `449ecc5` (on origin/main) and `8e85527` (local)
- Run ids 42289609809 and 42292936697 were read from `gh run view` in this session
- No key value, e-mail address or variable assignment appears in this file
