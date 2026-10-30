---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 09
subsystem: ci
tags: [github-actions, base-path, build-targets, extension-release, gate-test, mutation-check]

# Dependency graph
requires:
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-06 targetEnv('root', env).BASE_PATH = resolveBasePath(env); sub and configured ignore env.BASE_PATH
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-03 live-smoke-gate.test.ts asserting ci.yml keeps exactly 7 uses: lines
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-02 resolveSiteUrl(env) = resolveSiteOrigin + resolveBasePath (extension PRIVACY_URL and oracle allowlist)
provides:
  - ci.yml root (deploy) leg reads the BASE_PATH repository variable in Build, CSP oracle, SEO oracle and E2E (gated to root) and in the root-only extension build step
  - extension-release.yml passes BASE_PATH to the zip step and the oracle step
  - workflow-gate.test.ts and extension-release-gate.test.ts pin the BASE_PATH wiring (counts, step slices, env-free budget steps)
affects: [13-10 local rehearsal, 13-11 push, 13-13 go-live, 13-18 LAUNCH-AUDIT regeneration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Owner variables in ci.yml matrix env blocks use the gated idiom ${{ matrix.target == 'root' && vars.X || '' }}; root-only steps (if: matrix.target == 'root') and single-leg workflows use ${{ vars.X }} directly"
    - "Steps whose script reads only the build directory (assert-budget.mjs) carry no env block; the gate test asserts the absence so an inert block cannot drift in"

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - scripts/workflow-gate.test.ts
    - .github/workflows/extension-release.yml
    - scripts/extension-release-gate.test.ts

key-decisions:
  - "13-09: matrix env blocks use the gated form ${{ matrix.target == 'root' && vars.BASE_PATH || '' }} (same idiom as the owner keys, root-only by construction); the root-only extension step and extension-release.yml use ${{ vars.BASE_PATH }}"
  - "13-09: the JS budget steps keep no env block; assert-budget.mjs reads no env and no targetEnv, so the deploy build it measures is already the BASE_PATH build, and a new gate test pins the absence"
  - "13-09: the extension-release step-slice assertion ends at the last env line without a trailing newline, because stepOf() slices up to (not including) the next step's leading newline; count(text, BASE) === 2 covers exhaustiveness"
  - "13-09: LIVE-03 left unchecked: CI now builds, checks and tests the BASE_PATH artifact, but the live routing contract is observed at go-live (13-13)"

patterns-established:
  - "Gate-test needles that end a step must not carry the trailing newline when the step is sliced by the next '\\n      - ' marker"

requirements-completed: [SMOKE-04]

# Metrics
duration: 8min
completed: 2026-10-30
---

# Phase 13 Plan 09: CI BASE_PATH wiring (root leg + extension release) Summary

**The `BASE_PATH` repository variable now reaches CI's deploy leg (Build, CSP oracle, SEO oracle, E2E gated to `matrix.target == 'root'`, plus the root-only extension build) and both steps of `extension-release.yml`, so after the owner sets `BASE_PATH=/tran_real_estate` CI builds, checks and tests exactly the project-site artifact it deploys and a released zip links to the base-path privacy URL; both workflow gate tests pin the wiring and were proven against three planted mutants.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-30T13:26:03Z
- **Completed:** 2026-10-30T13:34Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- **ci.yml (D-02):** each of the four matrix env blocks (Build, CSP oracle, SEO oracle, E2E + axe) gains `BASE_PATH: ${{ matrix.target == 'root' && vars.BASE_PATH || '' }}` directly after `PUBLIC_SITE_URL`; the root-only `Extension build + manifest/zero-network oracle` step gains `BASE_PATH: ${{ vars.BASE_PATH }}`. The sub and configured legs receive `''`, which `targetEnv` ignores anyway (sub fixes `/tran_real_estate`, configured fixes `''`). Comments above Build and above the extension step rewritten per the plan. Deploy gate, the 7 pinned `uses:` lines and both JS budget steps are byte-identical (`git diff HEAD~2 -- ci.yml | grep "^[-+] *- uses:"` prints nothing).
- **extension-release.yml (Pitfall 10):** `Zip the extension` and `Manifest and zero-network oracle` each carry `BASE_PATH: ${{ vars.BASE_PATH }}` next to `PUBLIC_SITE_URL`, so the popup's `PRIVACY_URL` (through `resolveSiteUrl`) and the oracle's URL allowlist agree on the deployed site URL. Comment rewritten; still 3 `uses:` lines, all pins already present in ci.yml.
- **scripts/workflow-gate.test.ts:** new `GATED_BASE_PATH` constant; the Build-step test asserts 4 gated lines (replacing `not.toContain('BASE_PATH:')`) and still forbids `BUILD_DIR:`; the build-targets test adds the knob pass-through for root and the fixed values for sub/configured; the owner-variables test keeps `blocks === 5` and adds `count(quality, GATED_BASE_PATH) === 4` and `count(text, 'vars.BASE_PATH') === 5`; the extension-step test (renamed `carries only the site URL variables`) expects the exact two-line env block and `count(step, '${{') === 2`; a new test `the JS budget steps carry no env block (assert-budget reads only the build dir)` slices both `- name: JS budget` steps and asserts `not.toContain('env:')`. 38 tests.
- **scripts/extension-release-gate.test.ts:** the zip/oracle step test (renamed `... carry PUBLIC_SITE_URL and BASE_PATH in their own step`) expects `env:\n PUBLIC_SITE_URL ...\n BASE_PATH: ${{ vars.BASE_PATH }}` inside each step slice and `count(text, 'vars.BASE_PATH') === 2`. 16 tests.

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | ci.yml root-leg BASE_PATH + workflow-gate.test.ts | `8c27d0e` | `.github/workflows/ci.yml`, `scripts/workflow-gate.test.ts` |
| 2 | extension-release.yml BASE_PATH on zip and oracle + gate test | `290d558` | `.github/workflows/extension-release.yml`, `scripts/extension-release-gate.test.ts` |

## Mutation ledger

Each mutant was applied to the workflow file (backed up to the scratchpad, restored with `cp` and confirmed with `cmp` afterwards), and the gate was run with `--reporter=verbose`.

| # | Workflow | Mutant | Failing test(s) |
| - | -------- | ------ | --------------- |
| a | ci.yml | first gated `BASE_PATH` line changed to `${{ vars.BASE_PATH }}` | `quality matrix > the Build step runs the build-targets script for the matrix target`; `quality matrix > owner variables reach only the root leg, in every env block` |
| b | ci.yml | `BASE_PATH` deleted from the extension build step | `quality matrix > owner variables reach only the root leg, in every env block`; `extension (Phase 11) > the extension build step carries only the site URL variables` |
| c | extension-release.yml | `BASE_PATH` deleted from the oracle step | `steps > the zip and oracle steps each carry PUBLIC_SITE_URL and BASE_PATH in their own step` |

3/3 caught; 38/38 and 16/16 green again after each restore.

## Files Created/Modified

- `.github/workflows/ci.yml` - five `BASE_PATH` env lines (four gated, one plain), two comments rewritten
- `scripts/workflow-gate.test.ts` - `GATED_BASE_PATH`, five assertions updated/added, one new test, one test renamed
- `.github/workflows/extension-release.yml` - two `BASE_PATH` env lines, one comment rewritten
- `scripts/extension-release-gate.test.ts` - zip/oracle step test extended and renamed

## Decisions Made

- Gated form in the matrix blocks, plain form in root-only/single-leg steps (the plan's recorded D-02 decision; mirrors the owner-key idiom so a future reader sees one pattern).
- No env block on the JS budget steps: `grep -n "process.env\|targetEnv" scripts/assert-budget.mjs` prints nothing, so the step measures whatever `pnpm run build:root` produced, which is already the BASE_PATH build. A gate test now pins the absence so a well-meaning "consistency" edit cannot move the block count.
- The extension-release step-slice needle omits the trailing `\n` (see Deviations).
- LIVE-03 stays unchecked (plan constraint): CI consumes the knob, 13-10 rehearses it locally, go-live observes the live contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Step-slice needle in extension-release-gate.test.ts carried a trailing newline that can never match**
- **Found during:** Task 2
- **Issue:** The plan's wording ("each step slice contains `BASE_PATH: ${{ vars.BASE_PATH }}`") was first implemented as the full block `env:\n PUBLIC_SITE_URL ...\n BASE_PATH ...\n`. `stepOf()` slices up to the next `\n      - ` marker, so a step slice ends with the last env line and no newline; the assertion failed on the correct workflow.
- **Fix:** Dropped the trailing `\n` from the needle; `count(text, BASE) === 2` and the existing no-job/workflow-level `env:` regex cover "nothing else follows".
- **Files modified:** scripts/extension-release-gate.test.ts
- **Verification:** 16/16 green on the real file; mutant (c) still red.
- **Committed in:** `290d558`

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** none; the asserted behaviour is exactly the plan's.

## Issues Encountered

- A heredoc-authored node edit script on this machine collapsed `\\n` to `\n` and `\\.` to `.` inside JS template literals (the quoted heredoc still processes backslash escapes here), so two regex/escape-bearing needles failed to match. Those two replacements were applied with the Edit tool instead; nothing was written to the test file by the failed runs (the script wrote only on success). Recorded in `tasks/lessons.md` is out of scope for this executor; flagged here for the orchestrator.
- The parallel 13-08 executor's untracked `docs/RUNBOOK.md` and `scripts/runbook.test.ts` were visible in `git status`; they were never staged here.

## Verification

Targeted only (parallel-execution rules; the orchestrator runs the full suites after the wave and 13-10 runs the serialized rehearsal):

- `pnpm vitest run --project scripts scripts/workflow-gate.test.ts scripts/live-smoke-gate.test.ts` - 68/68 (Task 1)
- `pnpm vitest run --project scripts scripts/extension-release-gate.test.ts scripts/workflow-gate.test.ts scripts/live-smoke-gate.test.ts` - 84/84 (Task 2)
- `pnpm lint:workflows` (actionlint over all three workflows) - exit 0 after each task
- `pnpm exec eslint` + `pnpm exec prettier --write` on both test files - clean
- Acceptance greps on ci.yml: gated `BASE_PATH` line = 4; `vars.BASE_PATH` = 5; `uses: ` = 7; `vars.PAGES_ENABLED == 'true'` = 2
- Acceptance greps on extension-release.yml: `BASE_PATH: ${{ vars.BASE_PATH }}` = 2; `uses: ` = 3
- `git diff HEAD~2 -- .github/workflows/ci.yml | grep "^[-+] *- uses:"` - empty (no pin moved)
- Commit hygiene: `git log -1 --format=%B | grep -ciE "co-authored-by|claude|anthropic"` printed 0 after each commit

**Not run here (by design):** `pnpm lint`, `pnpm test:unit`, `pnpm verify`, web builds, Playwright.

## Known Stubs

None. The change is env wiring over existing consumers (`targetEnv('root')`, `resolveSiteUrl`); nothing is placeholder.

## Next Phase Readiness

- 13-10's rehearsal (`MSYS_NO_PATHCONV=1 BASE_PATH=/tran_real_estate pnpm build:root` + root E2E + `smoke:local`) now exercises the same env shape CI will use on the root leg.
- After the owner sets `BASE_PATH=/tran_real_estate` (13-11/13-13), the root leg's build log should read `target=root BASE_PATH=/tran_real_estate`, the CSP/SEO oracles and E2E run against that build, and `live-smoke.yml` already composes `PUBLIC_SITE_URL + BASE_PATH` for its remote target.
- If `BASE_PATH` is unset, every new line expands to `''`, which `resolveBasePath` treats as the site root: no behaviour change for the current wolfwdavid origin.

## Self-Check: PASSED

- FOUND .github/workflows/ci.yml
- FOUND scripts/workflow-gate.test.ts
- FOUND .github/workflows/extension-release.yml
- FOUND scripts/extension-release-gate.test.ts
- FOUND commit 8c27d0e
- FOUND commit 290d558
