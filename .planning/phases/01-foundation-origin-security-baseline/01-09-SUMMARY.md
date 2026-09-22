---
phase: 01-foundation-origin-security-baseline
plan: 09
subsystem: infra
tags: [verify, pnpm, vitest, playwright, gitleaks, actionlint, github-pages, docs]

# Dependency graph
requires:
  - phase: 01-01 through 01-08
    provides: every gate that `pnpm verify` composes (lint, unit harness, web skeleton, CSP oracle, Pages emulator + routing E2E, rule tests, browser security + axe specs, CI workflow + actionlint)
provides:
  - Proof that the whole Phase 1 gate composes: `corepack pnpm verify` green in one pass over both base paths (71-79 s wall-clock)
  - Every row of the 01-VALIDATION.md verification map re-run individually and marked green; `wave_0_complete: true`
  - docs/DEPLOY-CHECKLIST.md, the ordered owner runbook for the deferred hosting steps and the live-origin checks to record
  - README.md, the repository entry point (prerequisites, four setup steps, command table, E2E ports, Windows notes, what is not wired yet)
  - FND-01..FND-05 marked complete in REQUIREMENTS.md (checkboxes and traceability)
affects: [02-brand, every later phase that runs the gate or reads the deploy checklist, gsd-verifier for Phase 1]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Phase gate is one command (`corepack pnpm verify`); later phases budget about 1.5 minutes for it on a warm machine, not the 4-6 minutes originally estimated
    - Deferred live-origin behaviours are recorded as verification evidence to collect (docs/DEPLOY-CHECKLIST.md Step 7), never as gaps
    - Throwaway probes set `process.exitCode` and let the loop drain (01-05 note honoured; a net-based port probe was used because netstat is off this machine's PATH)

key-files:
  created:
    - docs/DEPLOY-CHECKLIST.md
    - README.md
    - .planning/phases/01-foundation-origin-security-baseline/01-09-SUMMARY.md
  modified:
    - .planning/phases/01-foundation-origin-security-baseline/01-VALIDATION.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Push-protection probe in the checklist recommends a freshly generated, zero-permission, one-day fine-grained GitHub PAT that is revoked right after the test, because GitHub push protection recognises only GitHub/partner formats and the TRANCANARY_ pattern would be accepted"
  - "Task 1 committed 01-VALIDATION.md alone (Status column + wave_0_complete flag): the walked map is the artifact of the task even though no source changed"
  - "verify runtime recorded as 71-79 s on this machine; the 4-6 minute estimate in 01-VALIDATION.md is left as written (it is CI-cold-cache realistic) and the README states the warm figure"

patterns-established:
  - "One-command phase gate: pnpm verify is the definition of green for Phase 1 and the baseline every later phase extends rather than replaces"
  - "Owner runbook lives in docs/, never in .planning/, so it survives milestone archiving and is readable from the repository root"

requirements-completed: [FND-01, FND-02, FND-03, FND-04, FND-05]

# Metrics
duration: 12min
completed: 2026-09-22
---

# Phase 1 Plan 09: Full-suite verification & deferred hosting handoff Summary

**`corepack pnpm verify` green in one pass over both base paths (71-79 s), all 21 verification-map rows individually re-proven, and the owner handed an exact runbook for the org, the `tranrealestate.github.io` repo, Pages, push protection and `PAGES_ENABLED`**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-22T19:06:08Z
- **Completed:** 2026-09-22T19:18:00Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 planning files updated)

## Accomplishments

- The whole Phase 1 gate composes: `corepack pnpm install --frozen-lockfile && corepack pnpm verify` exits 0 in a single invocation on a clean tree, twice (before and after this plan's commits). No assertion was relaxed and no step was dropped from `verify`.
- Every row of the 01-VALIDATION.md Per-Task Verification Map was run individually with its exact command and recorded green (table below); the map now reads `✅ green` on all 21 rows with `wave_0_complete: true`.
- `docs/DEPLOY-CHECKLIST.md` gives the owner seven ordered steps, states the root-site repo-name constraint (`named exactly tranrealestate.github.io`, RESEARCH D8), explains the `PAGES_ENABLED` gate, and turns the three manual-only verifications into concrete evidence-collection steps including a safe push-protection probe.
- `README.md` lets a contributor install, run every gate, and understand the E2E ports and Windows caveats without reading `package.json`.
- FND-01 through FND-05 flipped to complete in REQUIREMENTS.md, closing the deferrals every prior plan (01-01..01-08) recorded in its Requirements Status table.

## Full-suite runtime (for later phases to budget)

| Run | Wall-clock | Stages (all exit 0) |
| --- | --- | --- |
| First (`install --frozen-lockfile` + `verify`, before Task 2) | **79 s** including install | check: 360 files 0 errors · lint: Prettier + ESLint clean · test:unit 134/134 (10 files) · build:root (pnpm 11.27.0) · build:sub · csp:assert 7+7 pages · test:e2e 30/30 in 10.8 s (7 workers) · guard 105 files · canary detected · secrets:scan 48 commits, no leaks · lint:workflows clean |
| Final (`verify` only, after both commits) | **71 s** | same, with guard 107 files and secrets:scan 50 commits |

The 01-VALIDATION.md estimate was 4-6 minutes; on this machine with a warm pnpm store and cached Chromium it is well under two. The two Vite builds and the two Playwright projects are the bulk of it. Ports 4273/4274/4275 were confirmed released after every E2E run (Node `net.connect` probe: all three `ECONNREFUSED`).

## Verification map walk (each command run individually)

| Task ID | Command | Result |
| --- | --- | --- |
| 01-01-01 | `corepack pnpm install --frozen-lockfile`; `git remote -v` empty | exit 0; remote prints nothing |
| 01-01-02 | `corepack pnpm secrets:canary` | canary detected as expected |
| 01-01-02 | `corepack pnpm secrets:scan`; `.git/hooks/pre-commit` | 48 (then 50) commits scanned, no leaks; hook present |
| 01-02-01 | `vitest run --project scripts no-network` | 3/3 |
| 01-02-02 | `vitest run --project core no-network` | 1/1 |
| 01-03-01 | `vitest run --project web base-path` | 10/10 |
| 01-03-01 | `vitest run --project web no-network` | 1/1 |
| 01-03-03 | `build:root && build:sub` | both green, `build-web: pnpm 11.27.0 target=root/sub` |
| 01-04-01 | `csp:assert` | 7 pages in `build`, 7 pages in `build-sub` |
| 01-04-02 | `vitest run --project scripts assert-csp` | 31/31 |
| 01-06-01 | `vitest run --project scripts eslint-rules` | 12/12 |
| 01-06-02 | `vitest run --project scripts real-data-rules` | 36/36 |
| 01-06-03 | `vitest run --project scripts precommit` | 10/10 (17 s, temp git repos) |
| 01-05-02 | `playwright test routing` | 8/8 (root + sub) |
| 01-07-01 | `playwright test csp` | 6/6 (root + sub) |
| 01-07-02 | `playwright test framing --project=root`; `--project=sub --pass-with-no-tests` | 4/4; exit 0 with no tests |
| 01-07-03 | `playwright test a11y` | 12/12 (six routes x two bases) |
| 01-08-01 | `ACTIONLINT_BIN=definitely-not-a-binary node scripts/actionlint.mjs` | exit 1 with the install instructions (fail-closed) |
| 01-08-02 | `corepack pnpm lint:workflows` | exit 0, actionlint silent |
| 01-08-03 | `vitest run --project scripts workflow-gate` | 20/20 |
| 01-09-01 | `corepack pnpm verify` | exit 0 (79 s, then 71 s) |

Plus the plan's extra acceptance checks: full `corepack pnpm test:unit` 134/134, `corepack pnpm guard` 105 files, `git status --porcelain` empty at start and after each commit (no `__lintfix__`, temp repos, `sanitize-html.svelte`, `test-results/` or `playwright-report/` left behind), `git remote -v` empty throughout.

## Task Commits

Each task was committed atomically (through the live pre-commit hook: gitleaks staged + real-data guard):

1. **Task 1: Full-suite phase gate** - `d70579f` (chore) - 01-VALIDATION.md Status column all green, `wave_0_complete: true`
2. **Task 2: Deferred hosting checklist and repository README** - `009b3a8` (docs) - `docs/DEPLOY-CHECKLIST.md`, `README.md`

**Plan metadata:** see the final docs commit (SUMMARY, STATE, ROADMAP, REQUIREMENTS).

## Files Created/Modified

- `docs/DEPLOY-CHECKLIST.md` - Seven ordered owner steps: create org `tranrealestate`; create the repo **named exactly** `tranrealestate.github.io` (or build with `BASE_PATH=/<repo>`, which the CI `sub` leg already proves); add remote + push `main` (owner-only); Pages source = GitHub Actions; enable secret scanning + push protection; add repo variable `PAGES_ENABLED=true` (unset evaluates to `''`, upload/deploy skip cleanly); live-origin verification (load `/`, `/renter/` refresh, no-slash redirect, bogus path 404, CSP meta after `<meta charset>`, deploy job ran with `.nojekyll` in the artifact, push-protection probe on a throwaway branch with `SKIP_SIMPLE_GIT_HOOKS=1` and a GitHub-recognised format, never `TRANCANARY_`). Closes with the Phase 4/8 key notes and the Phase 10 rule that the beacon host goes into `apps/web/svelte.config.js` and `scripts/assert-csp.mjs` in one commit.
- `README.md` - What the project is; prerequisites (Node 24, corepack pnpm 11.27.0, gitleaks 8.30.1 via `winget install --id Gitleaks.Gitleaks -e`); the four ordered setup steps (`install`, `hooks:install`, `playwright install chromium`, actionlint 1.7.12 into `.tools/` via `gh release download v1.7.12 -R rhysd/actionlint` or `ACTIONLINT_BIN`); the 13-row command table; E2E ports 4273/4274/4275 with their env overrides and why they are not the Vite defaults; three Windows notes (System32/`taskkill` guard, never set `BASE_PATH` from Git Bash, `check` before `test:unit` on a stale checkout); "Not wired yet" (no remote, no deploy until `PAGES_ENABLED`, no analytics host or keys) pointing at the checklist.
- `.planning/phases/01-foundation-origin-security-baseline/01-VALIDATION.md` - Status column only (21 rows to `✅ green`) and `wave_0_complete: true`.
- `.planning/REQUIREMENTS.md` - FND-01..05 checkboxes ticked and traceability rows set to Complete via `gsd-tools requirements mark-complete`.

## Decisions Made

- **Push-protection probe uses a real GitHub token format, not the canary.** The checklist tells the owner to generate a zero-permission, one-day fine-grained PAT, commit it on a throwaway branch with `SKIP_SIMPLE_GIT_HOOKS=1`, expect the push to be rejected, then revoke the token and delete the branch. Push protection only knows GitHub/partner formats, so `TRANCANARY_` would sail through and prove nothing; a revoked PAT is a recognised format with no live value.
- **Task 1's commit is the walked map.** The plan expected no source changes; the verification map's Status column and the `wave_0_complete` flag are the task's tangible output, so they were committed as `chore(01-09)` on their own.
- **Runtime estimate left in 01-VALIDATION.md, warm figure in README.** The 4-6 minute figure is realistic for a cold CI runner; the README states "a little over a minute on a warm machine" so contributors are not surprised either way.

## Deviations from Plan

None - plan executed exactly as written. No drift surfaced between plans 01-01..01-08: no stale assertion, no renamed script, no leaked fixture. Nothing was relaxed.

## Issues Encountered

- **Harness-only:** the first attempt at the row-by-row walk prepended `C:\Windows\System32` to `PATH` (netstat is absent from this machine's PATH). That made `sort -u` resolve to Windows `sort.exe` and `bash -c` resolve to WSL's `bash.exe`, so three wrapper rows reported exit 1 with empty summaries while every direct row was green. Re-ran from a script file on the normal PATH: 21/21 rows green with evidence lines. No repository change; ports were probed with a `node:net` connect loop (`process.exitCode`, no `process.exit()`).
- Prettier re-aligned two README tables on `--write` (column padding only); `docs/DEPLOY-CHECKLIST.md` was already Prettier-clean.

## Authentication Gates

None.

## Deferred human verification (recorded, not gaps)

Per 01-VALIDATION.md "Manual-Only Verifications", carried verbatim into `docs/DEPLOY-CHECKLIST.md` Step 7:

| Behaviour | Requirement | Where it is recorded |
| --- | --- | --- |
| Live site loads at `https://tranrealestate.github.io/`, deep-link refresh on `/renter/` works, no-slash redirect, branded 404 | FND-01 | Checklist Step 7 items 1-4 |
| Pages deploy job runs and publishes with `.nojekyll` present | FND-04 | Checklist Step 7 item 6 |
| Secret-scanning push protection rejects a token push | FND-05 | Checklist Step 7 item 7 |

The owner has no org or domain yet ("keep going until we do"); every behaviour above is already proven locally and in CI against the Pages emulator under both base paths.

## Requirements Status

| ID | Status | Evidence in this plan |
| --- | --- | --- |
| FND-01 | Complete | routing E2E 8/8 both bases, base-path unit 10/10, both builds green, `.nojekyll` + `404.html` asserted; live-host check deferred to checklist |
| FND-02 | Complete | csp:assert 7+7 pages, assert-csp mutation suite 31/31, csp E2E 6/6 with non-vacuity control; beacon host deferred to Phase 10 by CONTEXT |
| FND-03 | Complete | framing E2E 4/4 (plain, sandboxed, sandboxed-with-scripts hidden; top-level visible), `<html hidden>` + `frame-guard.js` asserted per page |
| FND-04 | Complete | `verify` green end to end; workflow-gate 20/20; actionlint clean and fail-closed; axe 12/12; CI matrix runs both bases and gates deploy on `PAGES_ENABLED` |
| FND-05 | Complete | canary detected, 50-commit history clean, precommit suite 10/10, real-data rules 36/36, guard 107 files, hook installed; push protection is the owner's checklist step |

## User Setup Required

None for local development. The hosting steps are owner actions documented in `docs/DEPLOY-CHECKLIST.md` and remain non-blocking per the owner's instruction.

## Known Stubs

None. Both documents are complete; nothing placeholder flows anywhere.

## Next Phase Readiness

- Phase 1 is fully executed (9/9 plans). Ready for `/gsd:verify-work` against the five ROADMAP success criteria; criteria 1, 4 (deploy half) and 5 (push-protection half) have their live-origin portion deferred to the checklist by design.
- Phase 2 (brand, marketing, legal) starts from a green `corepack pnpm verify`, seven placeholder routes, an empty `packages/brand` token map, and the E2E/axe harness already covering every route under both bases.
- Still no remote, no push, no committed secret.

---

_Phase: 01-foundation-origin-security-baseline_
_Completed: 2026-09-22_

## Self-Check: PASSED

- Files: docs/DEPLOY-CHECKLIST.md, README.md, 01-09-SUMMARY.md, 01-VALIDATION.md (21 green rows, wave_0_complete: true)
- Commits: d70579f (Task 1), 009b3a8 (Task 2)
- REQUIREMENTS.md: FND-01..05 checked, five traceability rows Complete
