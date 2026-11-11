---
phase: 16-toolchain-pnpm-12-sveltekit-3-vitest-5
plan: 03
subsystem: testing
tags: [baseline, verify, live-smoke, ci, d-09]

requires:
  - phase: 16-02
    provides: "Hardened test-lane guard, in force for the baseline run"
provides:
  - "D-09 baseline: full pnpm verify chain green stage by stage at the pre-flight SHA on the unchanged toolchain"
  - "One green ci run and one green live-smoke run at that SHA, links recorded"
affects: [16-04, phase-16 final gate]

key-files:
  created: []
  modified: []

key-decisions:
  - "docs/RUNBOOK.md untouched: nothing in the plan text calls for a change to it (it is listed in files_modified only as the reference for the procedure)"

requirements-completed: []  # TOOL-06 is the phase final-gate requirement (also carried by 16-10 and 16-13); left Pending

duration: n/a
completed: 2026-11-11
---

# Phase 16 Plan 03: D-09 baseline gate Summary

**Every stage of the `verify` chain exited 0 at PRE-FLIGHT SHA f5c738ddd7e198a949aa7f6fa007c2063ae50213 with all three targets built at it, and after the owner-approved push the ci run and a live-smoke run (121 passed) were both green on that same SHA.**

PRE-FLIGHT SHA: `f5c738ddd7e198a949aa7f6fa007c2063ae50213` (HEAD = origin/main at close-out, working tree clean). No dependency or source change in this plan (`pnpm-lock.yaml` and `package.json` untouched).

## Task 1: full verify chain, stage by stage

| stage | result | seconds | note |
|---|---|---|---|
| audit:deps (first) | exit 0 | 2 | 5 ignored: 4 low, 1 moderate |
| check | exit 0 | 60 | |
| lint | exit 0 | 262 | |
| banned | exit 0 | 3 | 454 files |
| ui:guard | exit 0 | 1 | 81 files |
| unit-web | exit 0 | 93 | 2659 passed |
| unit-core | exit 0 | 21 | 2452 passed |
| unit-brand | exit 0 | 9 | 29 passed |
| unit-scripts | exit 0 | 21 | 1144 passed |
| unit-web-browser | exit 0 | 30 | 208 passed |
| unit-extension | exit 0 | 19 | 242 passed |
| unit-core-serial | exit 0 | 14 | 249 passed |
| unit-web-serial | exit 0 | 21 | 35 passed |
| unit-web-browser-serial | exit 0 | 37 | 54 passed |
| unit-scripts-serial | exit 0 | 100 | 210 passed |
| test:unit-full | exit 0 | 265 | 7282 passed (7282) |
| build:root | exit 0 | 51 | |
| build:sub | exit 0 | 53 | |
| build:configured | exit 0 | 51 | |
| csp:assert | exit 0 | 2 | 45 pages (sub, configured) |
| seo:assert | exit 0 | 2 | 44 pages, 14 sitemap URLs, 6 share cards |
| budget:assert | exit 0 | 4 | 9 gated routes within 60 KB, 5 reported |
| e2e-sub | exit 0 | 865 | 1149 passed (14.4 min) |
| e2e-configured | exit 0 | 30 | 44 passed |
| e2e-root shard 1 of 4 | exit 0 | 250 | 290 passed |
| e2e-root shard 2 of 4 | exit 0 | 374 | 467 passed |
| e2e-root shard 3 of 4 | exit 0 | 76 | 112 passed |
| e2e-root shard 4 of 4 | exit 0 | 306 | 288 passed (root total 1157) |
| smoke:local | exit 0 | 86 | configured pass 27.8 s |
| audit:deps | exit 0 | 2 | 5 ignored: 4 low, 1 moderate |
| guard | exit 0 | 7 | real-data guard, 2092 files |
| fixtures:check | exit 0 | 3 | |
| secrets:canary | exit 0 | 3 | |
| secrets:scan | exit 0 | 8 | no leaks found |
| lint:workflows | exit 0 | 2 | |
| ext:build | exit 0 | 10 | |
| ext:assert | exit 0 | 1 | 6 files scanned, zip root verified |
| ext:test:browser | exit 0 | 11 | 13 passed |
| ext:e2e | exit 0 | 11 | 7 passed |

Notes:
- test:unit: 7282 passed. E2E: sub 1149, configured 44, root 1157 over 4 shards.
- audit:deps: 5 ignored advisories, the same five as before the phase.
- The WLAN 8003 gate was checked before the run (last event 2026-11-10 19:15:35). The log was not re-checked for the run window.
- Harness slip: the first root-shard loop used a log filename containing "/" and died in 0 s before Playwright started. The 4 shards were re-run with safe names; no retry, timeout or worker change.
- Sub E2E ran 14.4 min as one background job polled under the 7-minute call cap.
- No libuv crash, no memory-reaper kill, no ERR_NETWORK_CHANGED.

## Task 2: owner-approved push and live-smoke baseline

The owner approved the push (e04ba10..f5c738d, 6 commits, pushed by the orchestrator).

| run | event | head SHA | conclusion | URL |
|---|---|---|---|---|
| ci | push | f5c738ddd7e198a949aa7f6fa007c2063ae50213 | success | https://github.com/wolfwdavid/tran_real_estate/actions/runs/42999080477 |
| live-smoke | workflow_run (not a dispatch) | f5c738ddd7e198a949aa7f6fa007c2063ae50213 | success | https://github.com/wolfwdavid/tran_real_estate/actions/runs/43003187733 |

Re-read with `gh run view 43003187733 --json conclusion,headSha,event`: conclusion success, headSha f5c738d (equals the pre-flight SHA), event workflow_run. From its log:
- `smoke: f5c738ddd7e198a949aa7f6fa007c2063ae50213 live at https://wolfwdavid.github.io/tran_real_estate/ after 0 s`
- `121 passed (35.7s)`

Nothing was dispatched or re-run in this close-out. Baseline green; plan 16-04 Task 1 may verify this record.

## Deviations from Plan

None to the plan itself. The only slip was the harness one noted above (no effect on results). `docs/RUNBOOK.md` was not edited.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED
- Pre-flight SHA equals HEAD and origin/main; working tree clean before this record.
- Both run URLs and the live-smoke head SHA, event, conclusion and pass count were re-read with `gh`.
- TOOL-06 left Pending in REQUIREMENTS.md.
