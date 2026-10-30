---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 03
subsystem: ci
tags: [github-actions, workflow_run, smoke, playwright, supply-chain, gate-test]

# Dependency graph
requires:
  - phase: 12
    provides: scripts/smoke.mjs remote mode, apps/web/tests/smoke/env.js env gate, playwright.smoke.config.ts
  - phase: 01
    provides: ci.yml (name ci, PAGES_ENABLED deploy gate, SHA-pinned actions), scripts/actionlint.mjs
provides:
  - .github/workflows/live-smoke.yml: post-deploy read-only smoke chained behind ci via workflow_run, plus workflow_dispatch
  - scripts/live-smoke-gate.test.ts: 30-test text gate over live-smoke.yml (9 describes), mutation-proven
affects: [13-09, 13-11, 13-12, 13-13]

# Tech tracking
tech-stack:
  added:
    - actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2 (literal pin; only workflow using it)
  patterns:
    - "workflow_run chain gated on conclusion == success && event == push && head_branch == main, checked out at workflow_run.head_sha"
    - "Gate test compares shared action pins against ci.yml text, not literals, so Dependabot bumps across all workflows stay green"

key-files:
  created:
    - .github/workflows/live-smoke.yml
    - scripts/live-smoke-gate.test.ts
  modified: []

key-decisions:
  - "13-03: PAGES_ENABLED gates workflow_dispatch too (stricter D-09): no red live-smoke runs while Pages is off, even by hand"
  - "13-03: concurrency group live-smoke with cancel-in-progress: false (plan) over RESEARCH's true: a later ci completion must never cancel an in-flight smoke of a real deploy; back-to-back deploys queue"
  - "13-03: upload-artifact is a literal pin in the gate (ci.yml has no upload-artifact to compare against); a Dependabot bump of it turns the gate red by design for hand review"
  - "13-03: live-smoke.yml carries no https:// anywhere (comments included) so the no-URL assertion is total over the file"

patterns-established:
  - "Workflow gate tests: read TEXT, one assertion per test so a planted regression names itself, slice the step by its - name: marker for step-scoped checks"

requirements-completed: [SMOKE-04]

# Metrics
duration: 7min
completed: 2026-10-30
---

# Phase 13 Plan 03: live-smoke workflow Summary

**Post-deploy read-only smoke wired behind `ci` with `workflow_run` + `workflow_dispatch`, checking out and expecting the deployed `head_sha`, gated on `PAGES_ENABLED` and a green push to `main`, with a 30-test text gate proven against 11 planted regressions.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-30T11:37:22Z
- **Completed:** 2026-10-30T11:44Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- `.github/workflows/live-smoke.yml` (SMOKE-04, D-09..D-12): `on: workflow_run` (`workflows: [ci]`, `types: [completed]`, `branches: [main]`) and `workflow_dispatch` (`base_url` required, `expect_version` optional). One single-line job `if:` requires `vars.PAGES_ENABLED == 'true'` and either a dispatch or a `success` + `push` + `main` ci run (the only runs that deploy). Checkout `ref:` and `SMOKE_EXPECT_VERSION` both start from `github.event.workflow_run.head_sha`, never the default-branch tip. `permissions: contents: read`, four SHA-pinned actions, `persist-credentials: false`, `timeout-minutes: 25`, `concurrency: live-smoke / cancel-in-progress: false`, `pnpm smoke` in remote mode with `SMOKE_BASE_URL`/`SMOKE_SITE_URL` from `inputs.base_url || format('{0}{1}/', vars.PUBLIC_SITE_URL, vars.BASE_PATH)` and `SMOKE_ANALYTICS_HOST` from `vars.PUBLIC_ANALYTICS_HOST`; traces uploaded `if: failure()` as `live-smoke-traces` for 14 days.
- `scripts/live-smoke-gate.test.ts` (244 lines, 30 tests in `trigger`, `job gate`, `deployed SHA`, `smoke env`, `permissions`, `supply chain`, `failure evidence`, `run hygiene`, `lint coverage`). Checkout/pnpm/setup-node pins are compared against `ci.yml`'s text; upload-artifact is a literal pin; `ci.yml` is asserted to still have exactly 7 `uses:` lines.
- TDD: gate run RED against the missing workflow (22 failed / 8 passed; the 8 were negative and cross-file assertions), GREEN after the workflow (30/30). `pnpm lint:workflows` (actionlint 1.7.12) exit 0 over all three workflows; `workflow-gate.test.ts` + `extension-release-gate.test.ts` unchanged and green (53/53).

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Gate test first, then live-smoke.yml | `9dfc8f0` | `.github/workflows/live-smoke.yml`, `scripts/live-smoke-gate.test.ts` |
| 2 | Mutation-check the gate | (no code change: every mutant was caught) | temporary edits to live-smoke.yml, restored via `git checkout --` |

## Mutation ledger (Task 2)

Each mutant was applied to `.github/workflows/live-smoke.yml`, the gate was run with `--reporter=verbose`, and the file was restored (`git diff --exit-code` clean afterwards).

| # | Mutant | Failing test(s) |
| - | ------ | --------------- |
| 1 | delete ` && github.event.workflow_run.event == 'push'` from the `if:` | `job gate > the only PAGES_ENABLED if: line is the exact single-line gate`; `job gate > the workflow_run branch requires a successful push to main` |
| 2 | `SMOKE_EXPECT_VERSION` -> `${{ github.sha }}` | `deployed SHA > the expected version is the deployed commit first, dispatch input second`; `deployed SHA > github.sha is never the only source of the expected version` |
| 3 | checkout `ref: main` | `deployed SHA > checkout targets the deployed commit, never the default-branch tip` |
| 4 | upload-artifact SHA -> `v7` | `supply chain > exactly four uses: lines, each pinned to a 40-hex commit SHA`; `supply chain > upload-artifact is the literal v7.0.2 pin` |
| 5 | add `  pull_request:` under `on:` | `trigger > runs after every completed ci run on main, plus workflow_dispatch`; `trigger > no push, pull_request or schedule trigger` |
| 6 | `contents: read` -> `contents: write` | `permissions > workflow-level permissions are read-only`; `permissions > no write scope, no OIDC token, no secrets, no pushes` |
| 7 | delete `if: failure()` | `failure evidence > traces upload only on failure` |
| 8 | `retention-days: 14` -> `90` | `failure evidence > the artifact is the smoke test-results folder, kept 14 days, no-op when empty` |
| 9 | delete `vars.PAGES_ENABLED == 'true' && (` and the closing `)` | `job gate > the only PAGES_ENABLED if: line is the exact single-line gate`; `job gate > vars.PAGES_ENABLED == 'true' appears exactly once`; `job gate > the workflow_run branch requires a successful push to main` |
| 10 | `run: pnpm smoke` -> `run: pnpm smoke:local` | `smoke env > runs the remote smoke exactly once and never the local one`; `smoke env > installs dependencies from the lockfile and Chromium before the smoke` |
| 11 | `cancel-in-progress: false` -> `true` | `run hygiene > smokes are serialized and never cancelled mid-run` |

11/11 caught; no surviving mutant, so no gate amendment was needed.

## Files Created/Modified

- `.github/workflows/live-smoke.yml` (created): the post-deploy smoke workflow, exact shape from the plan; setup-node pin copied from `ci.yml` at execution time (`820762786026740c76f36085b0efc47a31fe5020 # v7.0.0`, the Dependabot bump to v7.1.0 has not merged).
- `scripts/live-smoke-gate.test.ts` (created): text gate, Prettier-formatted and ESLint-clean.

## Decisions Made

- `PAGES_ENABLED` also gates `workflow_dispatch` (plan's stricter D-09 reading), so a hand-run while Pages is off is skipped rather than red on exit 2/3.
- `cancel-in-progress: false` (plan) instead of RESEARCH Pattern 3's `true`: an in-flight smoke of a real deploy must finish; a newer completion queues behind it.
- Shared action pins are asserted against `ci.yml`'s text, not literals; `upload-artifact` is the one literal pin with a comment explaining why.
- The workflow header comment avoids `https://` so the `no hard-coded URL` test is total over the file.

## Deviations from Plan

None - plan executed exactly as written. (The only addition beyond the plan's listed assertions is an install -> Chromium -> smoke ordering check inside `smoke env`, which also fires on mutant 10; it is a strict superset of the plan's checks.)

## Known Stubs

None. The workflow is complete wiring over existing `scripts/smoke.mjs` remote mode; nothing is placeholder.

## Verification

- `pnpm vitest run --project scripts scripts/live-smoke-gate.test.ts --reporter=verbose`: 30 passed, all nine describe names present.
- `pnpm lint:workflows`: exit 0.
- `pnpm vitest run --project scripts scripts/workflow-gate.test.ts scripts/extension-release-gate.test.ts`: 53 passed.
- Acceptance greps: `workflows: [ci]` = 1; exact `if:` line = 1; `uses: ` live-smoke = 4, ci.yml = 7; `cf430e03...` = 1; `retention-days: 14` = 1; `cancel-in-progress: false` = 1.
- `git diff --exit-code .github/workflows/live-smoke.yml` exit 0 after the mutation pass.
- Commit hygiene: `git log -1 --format=%B | grep -ciE "co-authored-by|claude|anthropic"` printed 0.

## Not run here (orchestrator / later plans)

- Full `pnpm lint` / `pnpm test:unit` / builds / Playwright: run once by the orchestrator after the wave.
- The live half of SMOKE-04 (`live-smoke` skipped while Pages is off, green on the go-live SHA) is observed in 13-11..13-13 after the owner pushes; `workflow_run` only fires once the file is on `main`.

## Next Phase Readiness

- `live-smoke.yml` is ready to land on `main` with the rest of wave 1-3 (plan 13-11 push). Variables it reads: `PAGES_ENABLED`, `PUBLIC_SITE_URL`, `BASE_PATH`, `PUBLIC_ANALYTICS_HOST`.
- If Dependabot bumps `actions/upload-artifact`, update the literal in both `live-smoke.yml` and `scripts/live-smoke-gate.test.ts` in the same commit (by design).

## Self-Check: PASSED

- FOUND .github/workflows/live-smoke.yml
- FOUND scripts/live-smoke-gate.test.ts
- FOUND commit 9dfc8f0
