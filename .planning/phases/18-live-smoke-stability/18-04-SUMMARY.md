---
phase: 18-live-smoke-stability
plan: 04
subsystem: testing
tags: [smoke, runbook, github-pages, rate-limit, docs-oracle]

requires:
  - phase: 18-live-smoke-stability
    provides: The per-spec baseline (18-01), the after-volume and projected live total (18-02), the 429 sources and the superseded outcome (18-03)
provides:
  - RUNBOOK subsection "Live smoke request volume" with the per-spec before/after table and the stated ceiling
  - LIVE_REQUEST_CEILING (1600) exported by scripts/smoke.mjs and tied to the RUNBOOK by a test
  - RUNBOOK prose for the superseded exit-0 outcome and the corrected exit 2 wording
  - A green local verification at one HEAD, with all three builds stamped with it
affects: [18-05]

tech-stack:
  added: []
  patterns:
    - "A documented number is exported as a constant and a docs oracle compares the two, with a non-vacuity case over a mutated copy"

key-files:
  created: []
  modified:
    - docs/RUNBOOK.md
    - scripts/runbook.test.ts
    - scripts/smoke.mjs
    - .planning/phases/18-live-smoke-stability/18-VALIDATION.md

key-decisions:
  - "The live request ceiling is 1600: the 1,535 projection rounded up to the next 100, under the 2,000 stop line"
  - "The RUNBOOK calls 1,535 a projection from local emulator measurements until the first live run"
  - "The volume checker reads every table row except the header and the separator, so a row cannot be skipped by its name"

patterns-established:
  - "Run the pre-push verification stage by stage, one shell call per stage, with logs under .tools/"

requirements-completed: [] # SMOKE-07 closes with the 18-05 proof runs. SMOKE-08 is left for the owner to mark after the first chained run

duration: 10min
completed: 2026-11-22
---

# Phase 18 Plan 04: Volume Record and Pre-Push Verification Summary

**The live smoke volume (5,939 before, 1,535 projected after) is in the RUNBOOK with a 1600-request ceiling that a test compares to a constant in smoke.mjs, the superseded outcome is documented, and every local stage is green at `c84cc6e`**

## Performance

- **Duration:** about 10 min
- **Completed:** 2026-11-22T14:43Z
- **Tasks:** 2
- **Files modified:** 4 (plus this summary)

## Accomplishments

- `docs/RUNBOOK.md` has `### Live smoke request volume` under "Read a live-smoke result": both build SHAs, one table, the ceiling sentence, the method, the three levers and the fourth.
- `scripts/smoke.mjs` exports `LIVE_REQUEST_CEILING = 1600`; `scripts/runbook.test.ts` fails when the table total exceeds it or the stated number differs from it.
- The exit-code table still has rows 0 to 4. Row 2 now says a 429 on any smoke request.
- The superseded outcome is prose under the table, and `#### Proof runs (SMOKE-07)` holds the acceptance rule only.

## Task Commits

1. **Task 1: volume table, superseded explanation, and the runbook oracle** - `c84cc6e` (docs)
2. **Task 2: full pre-push verification at the final code HEAD** - recorded in this summary (docs commit)

## Runbook changes

- **Exit row 2:** "a 429 on a smoke navigation" became "a 429 on any smoke request". A paragraph under the table lists the sources (navigation, sub-resource, service worker install, API-context request) and says a failed suite with a logged 429 exits 2 and a passing suite is never relabelled.
- **Superseded:** chained runs only (event `workflow_run`, repository and token present); a newer deployed commit that is ahead of the expected one ends the run green with a `::notice::` line and no test counts; every other state fails closed (behind, diverged, identical, a failed compare lookup, a version that is not a 40-character SHA); a dispatch or a local run is never superseded; such a run is not evidence that the suite passed and never counts toward the three-run proof.
- **Volume subsection:** states that GitHub Pages publishes no rate-limit figure, that the first 429 was observed after roughly 3.7k to 4k requests and that the threshold varied between runs; the table below; the sentence that the live suite stays under 1600 requests; that 1,535 is a projection from local emulator measurements until the first live run; 84 tests live, 119 tests in 9 spec files and 4,294 requests locally; the count file given as a Windows-style absolute path, and an empty or missing file being a failed measurement.

| Spec | Before | After (live) |
| --- | --- | --- |
| third-party | 3,337 | 576 |
| pwa | 841 | 421 |
| assets | 742 | 0 |
| seo | 504 | 19 |
| routing | 225 | 225 |
| a11y | 177 | 177 |
| csp | 45 | 45 |
| analytics | 38 | 38 |
| extension-link | 33 | 33 |
| version | 1 | 1 |
| **Total** | **5,939** | **1,535** |

The before total is the full-suite run; its rows sum to 5,943 (routing varies by a few requests).

## The oracle

- Every row's before and after are integers (thousands separators allowed), the after column sums to the bold total, the total is at most `LIVE_REQUEST_CEILING`, the constant is at most 2000, and `stays under 1600 requests` appears in the subsection.
- Non-vacuity: an empty text reports no rows and no total; raising one after value reports the sum mismatch; raising the value and the total together reports the ceiling; a non-integer cell is reported.
- The superseded prose and the row 2 wording are pinned as text.

## Verification

All stages ran at `c84cc6e2c13b00c75b4a6da50e54f233e41585c2`, which equals `git rev-parse HEAD` and `_app/version.json` in all three builds.

| Stage | Command | Exit | Result |
| --- | --- | --- | --- |
| 1 | `pnpm vitest run --project scripts --project scripts-serial` | 0 | 50 files, 1,585 tests passed, 48.2 s (log `.tools/unit-18-04.log`) |
| 2 | `pnpm lint:workflows` | 0 | no findings |
| 3 | `pnpm check` | 0 | brand, core, extension and web all done, 0 errors |
| 4 | `pnpm build:root`, `pnpm build:sub`, `pnpm build:configured` | 0, 0, 0 | three builds stamped `c84cc6e` |
| 5 | `pnpm smoke:local` | 0 | see the table below |
| 6 | `git grep -n "retries: 0" apps/web/playwright.smoke.config.ts` | 0 | line 18 |
| 6 | `git grep -nE "toPass\|waitForTimeout" apps/web/tests/smoke` | 1 | prints nothing |

| Target | Tests | Time |
| --- | --- | --- |
| root | 119 passed | 14.3 s |
| sub | 119 passed | 14.2 s |
| configured | 119 passed | 14.3 s |
| **Total** | | **42.7 s** (budget 300 s) |

Stages beyond the plan's list, run because the builds were fresh:

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm lint` | 0 | Prettier clean; one ESLint warning in `apps/web/src/lib/ai/ui/GenerationPanel.svelte` (unused disable directive) that predates this phase |
| `pnpm banned` | 0 | 455 files |
| `pnpm csp:assert` | 0 | 45 pages on each of the three builds |
| `pnpm seo:assert` | 0 | 44 pages, 14 sitemap URLs, 6 share cards on each build |
| `pnpm budget:assert` | 0 | 9 gated routes within 60 KB; `tools/cash-on-cash` at 59.8 to 59.9 KB (headroom about 0.1 KB, Phase 19's scope, not touched) |
| `pnpm secrets:scan` | 0 | 1,567 commits, no leaks |

Acceptance greps: the commit-message scan for assistant names or trailers over `origin/main..HEAD` prints 0; `.planning/config.json` appears in no unpushed commit; `git show --stat c84cc6e` lists the three task files only.

## Unpushed commits

`git log --oneline origin/main..HEAD` before this summary's commit:

```
c84cc6e docs(smoke): record live request volume and the superseded outcome
a3e8367 docs(18-03): complete the 429 evidence and superseded outcome plan
77081a8 ci(smoke): pass the read-only token to the superseded commit check
4a5901e fix(smoke): treat a newer deployed commit as superseded instead of failing
a40bb58 test(smoke): record every 429 as rate-limit evidence, whatever its source
81ed0db docs(18-02): complete the live smoke volume cut plan
2aeff6b test(smoke): share one service worker install between the pwa and asset checks
cc23f9d test(smoke): sample third-party routes live and read seo share tags from html
445df86 docs(18-01): complete the live smoke baseline plan
bb3ae81 docs(18-01): record the listener and cached-status probe results
26bb461 docs(18-01): record the Kit 3 per-spec smoke request baseline
8f4541c fix(smoke): write the emulator request count when traffic goes idle
6d4e39d test(smoke): count emulator requests per spec behind SERVE_PAGES_COUNT_FILE
6b69e91 docs(18): plan the live smoke stability phase (5 plans)
b7b675f docs(18): research the live smoke rate limit and add the validation strategy
07af9c6 docs: create milestone v1.2 roadmap (4 phases)
130ed1b docs: define milestone v1.2 requirements
439c59e docs: start milestone v1.2 Maintenance & Release Hygiene
```

The planning-only commits in that list (the `docs(18...)` and milestone commits, and this plan's closing docs commit) go up with the first proof push in plan 05. Nothing was pushed.

## Findings for later plans

1. **18-05, the build stamp.** The builds are stamped `c84cc6e`. The closing docs commit of this plan moves HEAD past it, so `pnpm smoke:local` will refuse the builds (exit 2) until they are rebuilt. Rebuild before any local smoke in 18-05.
2. **18-05, first live facts to record in the RUNBOOK.** The live test count (84 expected), the real request volume if it can be read, and the proof-run bullets under `#### Proof runs (SMOKE-07)`. If the live total differs from 1,535, update the table and the constant together.
3. **18-05, a superseded run** has a `::notice::` line and no test counts and is not a proof run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The volume checker skipped a row by name**
- **Found during:** Task 1
- **Issue:** The first row pattern accepted lowercase letters and hyphens only, so the `a11y` row was not read and the sum came out 177 short. The oracle failed, which is how it was found.
- **Fix:** The checker reads every table row except the header and the separator.
- **Files modified:** scripts/runbook.test.ts
- **Commit:** `c84cc6e`

### Other differences

- **Numbers come from the measured facts, not the plan's estimates:** 1,535 projected, ceiling 1600, 84 tests live.
- **The exit row 2 text was corrected** (the plan said to keep rows 0 to 4 exactly; the row set is unchanged, the wording of row 2 follows the code).
- **The oracle also pins the superseded prose and the row 2 wording**, and has three non-vacuity cases, not one.
- **The RUNBOOK names both build SHAs** (before at `8f4541c`, after at `2aeff6b`).
- **The unit run was a foreground call with a log** (48 s), not a background run with polling.
- **Six extra stages were run** (lint, banned, the three build oracles, the secret scan).
- **VALIDATION:** besides the task map and `wave_0_complete`, the eight rows are marked green and the four Wave 0 items ticked. `nyquist_compliant` and the sign-off list are untouched.

## Not done

- No push, no workflow dispatch, no live run (by rule).
- The full `pnpm verify` chain was not run: the complete `pnpm test:unit` (only the `scripts` and `scripts-serial` projects ran), the web E2E, `audit:deps`, `guard`, `fixtures:check`, `secrets:canary` and the extension stages. No file they cover changed in this plan.
- `requirements.mark-complete` was not run.

## Self-Check: PASSED

- Files found: docs/RUNBOOK.md, scripts/runbook.test.ts, scripts/smoke.mjs, .planning/phases/18-live-smoke-stability/18-VALIDATION.md
- Commit found: c84cc6e
- Nothing under .tools/ is tracked; .planning/config.json was never staged
