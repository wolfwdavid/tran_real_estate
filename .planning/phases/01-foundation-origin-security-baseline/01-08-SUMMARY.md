---
phase: 01-foundation-origin-security-baseline
plan: 08
subsystem: infra
tags: [github-actions, ci, actionlint, gitleaks, github-pages, dependabot, sha-pinning, vitest]

# Dependency graph
requires:
  - phase: 01-foundation-origin-security-baseline
    plan: 01
    provides: package.json script surface (check, lint, test:unit, csp:assert, guard, secrets:canary, secrets:scan, lint:workflows), .gitleaks.toml, gitignored .tools/, .github/ in .prettierignore, scripts/gitleaks.mjs fail-closed pattern
  - phase: 01-foundation-origin-security-baseline
    plan: 04
    provides: scripts/assert-csp.mjs invoked per matrix leg against apps/web/${{ matrix.build_dir }}
  - phase: 01-foundation-origin-security-baseline
    plan: 05
    provides: apps/web/playwright.config.ts with the attacker-listener readiness URL and root|sub projects the quality matrix runs
  - phase: 01-foundation-origin-security-baseline
    plan: 06
    provides: scripts/precommit.test.ts (fail-closed on missing gitleaks), which is why the quality job installs gitleaks before pnpm test:unit
provides:
  - .github/workflows/ci.yml with hygiene (checksum-verified gitleaks, canary, full-history scan, real-data guard), quality (root|sub matrix running check, lint, unit, build, csp assert, Playwright per target) and a Pages deploy job that is fully written but dormant behind vars.PAGES_ENABLED == 'true'
  - scripts/actionlint.mjs, a dependency-free fail-closed actionlint 1.7.12 runner (ACTIONLINT_BIN override is absolute; else .tools/ then PATH)
  - scripts/workflow-gate.test.ts, 20 text-level assertions that pin every gate, wiring and supply-chain invariant of the workflow plus the Playwright readiness contract
  - .github/dependabot.yml weekly github-actions updates so the SHA pins stay current once a remote exists
  - actionlint 1.7.12 binary in the gitignored .tools/ directory (never committed)
affects: [01-09 (composed pnpm verify and requirement closure), every later phase that pushes to main]

# Tech tracking
tech-stack:
  added: [actionlint 1.7.12 (local binary, gitignored), actions/checkout v7.0.1, actions/setup-node v7.0.0, pnpm/action-setup v6.1.0, actions/upload-pages-artifact v5.0.0, actions/deploy-pages v5.0.1 (all SHA-pinned)]
  patterns:
    - Every third-party action pinned to a full commit SHA with the version tag in a trailing comment; Dependabot keeps the pins current
    - Non-npm tools are downloaded once into gitignored .tools/ and resolved by a fail-closed runner script; an explicit *_BIN override never falls through
    - Deploy is gated on a repository variable that evaluates to '' when unset, so the job skips rather than fails until the owner enables Pages
    - Workflow gate invariants are locked by a text-level Vitest suite that reads the YAML as written (single-line if: expressions) and was mutation-checked
    - The same checksum-verified tool install step is duplicated per job as a plain run: step so it never counts as a uses: pin

key-files:
  created:
    - scripts/actionlint.mjs
    - .github/workflows/ci.yml
    - .github/dependabot.yml
    - scripts/workflow-gate.test.ts
  modified: []

key-decisions:
  - "ACTIONLINT_BIN is an absolute override: if it does not run, the script exits 1 without falling back to .tools/ or PATH, so the fail-closed check cannot be satisfied by the binary the task itself downloaded"
  - "The quality job installs gitleaks with the byte-identical checksum-verified run: step used by hygiene (not in the RESEARCH example) because pnpm test:unit runs the fail-closed precommit suite; SHA-pinned uses: count stays exactly 7"
  - "No .gitleaks.toml allowlist was added: history, directory and staged scans of ci.yml with the 64-hex GITLEAKS_SHA256 literal all reported no leaks, so the conditional step 2b was not triggered"
  - "workflow-gate.test.ts was mutation-checked against seven gate regressions (drop/fold the deploy if:, remove the quality gitleaks install, float a tag, drop include-hidden-files, drop needs, flip cancel-in-progress) and each one fails the suite"
  - "FND-01/FND-04/FND-05 left unchecked, consistent with 01-01..01-06: this plan delivers the CI half; 01-09 runs the composed suite and closes all five FND requirements"

patterns-established:
  - "Workflow YAML is validated by actionlint (pnpm lint:workflows), never by Prettier; .github/ stays in .prettierignore and every if: stays on one line"
  - "Any new job that runs pnpm test:unit must include the gitleaks install step first; workflow-gate.test.ts enforces the ordering inside quality"
  - "Any new uses: line must be a 40-hex SHA with a version comment; the suite fails on @vN or @main"

requirements-completed: [FND-04, FND-01, FND-05]

# Metrics
duration: 7min
completed: 2026-09-22
---

# Phase 01 Plan 08: CI Workflow, Gated Pages Deploy & Workflow Gate Tests Summary

**actionlint-clean `.github/workflows/ci.yml` with a hygiene job (checksum-verified gitleaks 8.30.1, canary, full-history scan, real-data guard), a root|sub quality matrix that installs gitleaks before the fail-closed unit suite and runs Playwright per target, and a fully written Pages deploy job dormant behind `vars.PAGES_ENABLED == 'true'`; every action SHA-pinned (7), locked by a 20-test mutation-checked gate suite and validated locally by a fail-closed actionlint 1.7.12 runner**

## Performance

- **Duration:** 7 min (409 s)
- **Started:** 2026-09-22T18:37:27Z
- **Completed:** 2026-09-22T18:44:16Z
- **Tasks:** 3
- **Files modified:** 4 (all created)

## Accomplishments

- `corepack pnpm lint:workflows` exits 0: actionlint 1.7.12 (downloaded via `gh release download` into gitignored `.tools/`, `git status --porcelain .tools` empty) reports no findings on the workflow as written, including the matrix `include:` form and the command strings RESEARCH flagged as unvalidated
- `ACTIONLINT_BIN=definitely-not-a-binary node scripts/actionlint.mjs` exits 1 with the install hint even though `.tools/actionlint.exe` is present (no fallthrough); with the override unset, the runner resolves `.tools/actionlint.exe` and forwards actionlint's exit code (exit 3 was observed before the workflow existed, exit 0 after)
- All Task 2 acceptance greps pass: `vars.PAGES_ENABLED == 'true'` x2, `needs: [hygiene, quality]`, `include-hidden-files: true`, `group: pages` + `cancel-in-progress: false`, SHA-256 literal present, `gitleaks-action` absent, SHA-pinned `uses:` count 7, `gitleaks_${GITLEAKS_VERSION}_linux_x64` x2 and `sha256sum -c` x2 (both jobs), no floating `@vN` tags, `persist-credentials: false`, `tran_real_estate` sub leg, `^\.github/$` still in `.prettierignore`
- `corepack pnpm vitest run --project scripts workflow-gate` exits 0 with 20 passing tests; seven mutations of `ci.yml` each turned the suite red (details under Decisions) and the file was restored byte-identical
- `corepack pnpm secrets:scan` (40 commits) exits 0 with `no leaks found`; `gitleaks dir` on `.github/` and a real `gitleaks git --staged` scan of the two new files were also clean, so `.gitleaks.toml` was not touched
- `corepack pnpm lint` exits 0 after each task; `git remote -v` prints nothing; no repo, remote, push or repository variable was created

## Task Commits

Each task was committed atomically with `--no-verify` (parallel wave with 01-07; the orchestrator runs the post-wave scans, and this plan ran `secrets:scan` plus direct scans of its own files before committing):

1. **Task 1: Local actionlint runner and pinned binary** - `672ae6b` (feat)
2. **Task 2: CI workflow with hygiene, dual-base quality matrix and gated Pages deploy** - `926b8e8` (feat)
3. **Task 3: Workflow gate assertions** - `d72bbc7` (test)

**Plan metadata:** see final docs commit below

_TDD note (Task 3): the suite asserts against a workflow that Task 2 had already written, so the RED phase cannot come from a missing implementation. RED was demonstrated instead by mutating `ci.yml` (seven distinct gate removals, each failing 1-2 tests) and restoring it, which is the regression the suite exists to catch. RED and GREEN therefore collapse into the single test commit, as in 01-06._

## Files Created/Modified

- `scripts/actionlint.mjs` (65 lines) - `node:` builtins only; `PINNED_VERSION = '1.7.12'`; `probe(bin)` runs `-version`; `resolveBinary()` treats a non-empty `ACTIONLINT_BIN` as the sole candidate and exits 1 with the `gh release download` hint if it does not run, otherwise tries `.tools/actionlint(.exe)` then bare `actionlint`; warns on a non-pinned version; runs the binary against argv files (default `.github/workflows/ci.yml`) with `cwd: repoRoot` and `stdio: 'inherit'`, forwarding the exit code
- `.github/workflows/ci.yml` (111 lines) - `on: push[main] / pull_request / workflow_dispatch`; `permissions: contents: read`; `concurrency: ci-${{ github.ref }}` cancel-in-progress; env `GITLEAKS_VERSION: 8.30.1` and `GITLEAKS_SHA256`; **hygiene** on `ubuntu-24.04` (checkout `fetch-depth: 0` + `persist-credentials: false`, setup-node from `.nvmrc`, curl + `sha256sum -c -` + tar + `$GITHUB_PATH` gitleaks install, canary self-test, `gitleaks git --no-banner --redact --config .gitleaks.toml .`, `guard-real-data.mjs --all`); **quality** with `fail-fast: false` and matrix `include:` `{root, '', build}` / `{sub, /tran_real_estate, build-sub}` (checkout, pnpm/action-setup, setup-node with `cache: pnpm`, the same gitleaks install step, `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm lint`, `pnpm test:unit`, `pnpm --filter web build` with `BASE_PATH`/`BUILD_DIR` from the matrix, `assert-csp.mjs apps/web/${{ matrix.build_dir }}`, `playwright install --with-deps chromium`, `playwright test --project=${{ matrix.target }}`, and the upload-pages-artifact step gated on `matrix.target == 'root' && <gate>` with `path: apps/web/build` and `include-hidden-files: true`); **deploy** gated on `github.event_name == 'push' && github.ref == 'refs/heads/main' && vars.PAGES_ENABLED == 'true'`, `needs: [hygiene, quality]`, `pages: write` + `id-token: write`, `environment: github-pages` with the deployment URL, `concurrency: { group: pages, cancel-in-progress: false }`, single `actions/deploy-pages` step with `id: deployment`
- `.github/dependabot.yml` (6 lines) - `version: 2`, `github-actions` ecosystem, directory `/`, weekly
- `scripts/workflow-gate.test.ts` (186 lines) - reads `ci.yml` and `apps/web/playwright.config.ts` via `import.meta.dirname`; a `jobs()` splitter (regex on two-space job keys) so assertions target one job; 20 tests across `deploy gate` (6), `artifact` (1), `supply chain` (6), `quality matrix` (4), `hygiene job` (1), `no remote side effects` (2)

## Decisions Made

- **Absolute `ACTIONLINT_BIN` override.** Mirrors `GITLEAKS_BIN` in `scripts/gitleaks.mjs`. Without this, the plan's own fail-closed check would pass vacuously by running the binary Task 1 had just downloaded.
- **Gitleaks install duplicated into `quality` as a `run:` step.** RESEARCH's workflow only installed gitleaks in `hygiene`, but `pnpm test:unit` executes `scripts/precommit.test.ts` (01-06), which fails closed without gitleaks on PATH. Duplicating the plain `run:` step (rather than a shared action) keeps the SHA-pinned `uses:` count at exactly 7 and keeps the checksum verification inline where a reviewer reads it. The suite pins that the install precedes `pnpm test:unit`.
- **No `.gitleaks.toml` change.** The plan's conditional step 2b applied only if `secrets:scan` flagged the 64-hex `GITLEAKS_SHA256` literal. Three scans (history after commit, `gitleaks dir .github`, real `--staged`) were all clean; gitleaks' generic rules require a keyword context that a bare hex value in a YAML env block does not have.
- **Mutation-checked the gate suite before committing.** Seven `ci.yml` mutations (drop the deploy `if:`, fold it onto two lines with `>-`, remove the `quality` gitleaks install, float `deploy-pages@v5`, drop `include-hidden-files`, drop `needs`, flip pages `cancel-in-progress` to `true`) each failed 1-2 tests; the unmutated file passes 20/20. `playwright.config.ts` was NOT mutated because the sibling plan's Playwright runs read it mid-wave; its assertion is a plain `includes()` on the literal `url` line.
- **Requirements not marked complete.** FND-01/04/05 are shared with 01-09, which runs the composed `pnpm verify` and closes all five FND requirements; every earlier plan in this phase followed the same convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prettier reflow of `scripts/actionlint.mjs` and `scripts/workflow-gate.test.ts`**
- **Found during:** Task 1 and Task 3 (`prettier --check`)
- **Issue:** Long `join(...)` call and long string constants exceeded `printWidth: 100`; the plan requires `pnpm lint` exit 0 after each task
- **Fix:** `corepack pnpm exec prettier --write` on each file (line wrapping only); the fail-closed probe was re-run after formatting and still exits 1
- **Files modified:** scripts/actionlint.mjs, scripts/workflow-gate.test.ts
- **Verification:** `corepack pnpm lint` exit 0
- **Committed in:** 672ae6b, d72bbc7

**2. [Rule 1 - Bug] ESLint `no-regex-spaces` on the job-splitting regex**
- **Found during:** Task 3 (`corepack pnpm lint`)
- **Issue:** The `jobs()` splitter used a two-space literal (`^  ([a-z_]+)`), which ESLint's recommended set rejects
- **Fix:** Replaced both occurrences with `^ {2}`; re-ran the suite (20/20) and a `needs`-removal mutation (1 failed) to confirm the splitter still isolates jobs
- **Files modified:** scripts/workflow-gate.test.ts
- **Verification:** `corepack pnpm lint` exit 0; suite green; mutation red
- **Committed in:** d72bbc7

### Transient, not fixed (sibling-owned)

- `corepack pnpm lint` failed once during Task 2 on `apps/web/.probe-style.tmp.mjs`, a scratch file written by plan 01-07 that had already been deleted by the time the failure was inspected. Per the wave rule the check was re-run once and passed; nothing outside this plan's file ownership was touched.

---

**Total deviations:** 2 auto-fixed (1 Rule 3 formatting, 1 Rule 1 lint error), 1 transient sibling artifact re-run
**Impact on plan:** No scope change. All fixes are confined to the two script files this plan owns; `ci.yml` is exactly the plan's specification.

## Issues Encountered

- **Parallel wave interplay:** plan 01-07's untracked `apps/web/tests/e2e/{csp,a11y,framing}.spec.ts` appeared in `git status` during Tasks 1-3 and its commit `1992ccf` landed between this plan's Task 2 and Task 3 commits. Nothing from 01-07 was staged; every commit here named its files explicitly. No `.git/index.lock` collision occurred (the retry path was in place).
- `git add -N` (intent-to-add) does not stage content, so a staged gitleaks scan under it reports 0 bytes; the proof used a real `git add .github` followed by `git reset`.

## Known Stubs

None. `ci.yml` is the complete workflow; the deploy job is dormant by design (gated on an unset repository variable), not a placeholder. `scripts/actionlint.mjs` has no fallback or skip path.

## User Setup Required

None for local verification. Deferred owner actions (unchanged from STATE.md): create the `tranrealestate` org and the `tranrealestate.github.io` repo, enable Pages, set the repository variable `PAGES_ENABLED=true`, and enable secret-scanning push protection. Until then the workflow's `deploy` job and the artifact upload skip cleanly on every run.

## Requirements Status

| ID | This plan delivers | Still open | Closed by |
|----|-------------------|------------|-----------|
| FND-04 | CI workflow running check, lint, unit, build, csp, E2E+axe on both bases; deploy gated on all of it plus `PAGES_ENABLED`; actionlint-clean; gate suite | Composed `pnpm verify` run; live deploy after org creation | 01-09 |
| FND-05 | Secret scan (canary + full history) and real-data guard as CI gates from a checksum-verified pinned binary; gitleaks present wherever the fail-closed unit suite runs | Push protection (owner action after org creation) | 01-09 |
| FND-01 | Per-target matrix proving routing under `/` and `/tran_real_estate/` on every push | Live deep-link refresh on the real host (deferred) | 01-09 |

## Next Phase Readiness

- 01-09 can run the composed `pnpm verify` (which ends with `pnpm lint:workflows`) and `corepack pnpm test:unit`; the `scripts` project now includes `workflow-gate.test.ts` (~1 s)
- Any future workflow edit must keep `if:` gates on one line, keep every `uses:` SHA-pinned, and keep the gitleaks install ahead of `pnpm test:unit`; the gate suite and actionlint enforce all three
- `.tools/actionlint.exe` is machine-local; a fresh clone gets the exact `gh release download` command from the runner's failure message
- No remote, no push, branch `main`

## Self-Check: PASSED

`scripts/actionlint.mjs`, `.github/workflows/ci.yml`, `.github/dependabot.yml` and `scripts/workflow-gate.test.ts` exist on disk; commits `672ae6b`, `926b8e8` and `d72bbc7` are present in `git log`.

---
*Phase: 01-foundation-origin-security-baseline*
*Completed: 2026-09-22*
