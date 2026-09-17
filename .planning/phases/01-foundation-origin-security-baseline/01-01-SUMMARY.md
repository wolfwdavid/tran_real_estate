---
phase: 01-foundation-origin-security-baseline
plan: 01
subsystem: infra
tags: [pnpm, corepack, eslint, prettier, gitleaks, simple-git-hooks, pre-commit, vitest, typescript]

# Dependency graph
requires: []
provides:
  - pnpm workspace root pinned to Node 24 / pnpm 11.27.0 with exact devDependency pins and a reproducible lockfile
  - Full root script surface (check, lint, test:unit, build:root/sub, csp:assert, test:e2e, guard, secrets:canary, secrets:scan, lint:workflows, verify)
  - ESLint 10 flat config with import boundaries, fetch ban outside adapter folders, and {@html} ban outside the sanitizer module
  - Prettier config (svelte plugin) and ignore list that keeps .planning/, .github/ and build outputs untouched
  - .gitleaks.toml (default ruleset + tran-canary-test-key rule, no path allowlists)
  - scripts/lib/real-data-rules.mjs pure rule functions and findProblems() for plan 06 table tests
  - scripts/guard-real-data.mjs (--all | --staged), scripts/gitleaks.mjs (staged | history, fail-closed), scripts/gitleaks-canary.mjs
  - Installed .git/hooks/pre-commit via simple-git-hooks running gitleaks staged + real-data guard staged
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, every later phase that commits]

# Tech tracking
tech-stack:
  added: [eslint@10.10.0, "@eslint/js@10.0.1", typescript-eslint@8.70.0, eslint-plugin-svelte@3.23.0, eslint-config-prettier@10.1.8, globals@17.12.0, prettier@3.9.6, prettier-plugin-svelte@4.1.1, prettier-plugin-tailwindcss@0.8.1, simple-git-hooks@2.14.0, svelte@5.57.0, typescript@~6.0.3, vitest@4.1.11, "@types/node@^24", gitleaks 8.30.1 (system binary)]
  patterns:
    - Hand-written configs with exact pins (no sv create, no pnpm add caret ranges)
    - pnpm-workspace.yaml allowBuilds committed up front so pnpm 11 never auto-writes placeholder keys
    - Pure rule module + thin CLI wrapper so guards are unit-testable without I/O
    - Fail-closed gates: missing gitleaks binary blocks the commit instead of skipping
    - Runtime-assembled canary so the scanner self-test never commits a matching literal
    - Single-owner package.json: the whole script surface is declared once, later plans only add files

key-files:
  created:
    - package.json
    - pnpm-workspace.yaml
    - pnpm-lock.yaml
    - .nvmrc
    - .prettierrc
    - .prettierignore
    - eslint.config.js
    - .gitleaks.toml
    - scripts/lib/real-data-rules.mjs
    - scripts/guard-real-data.mjs
    - scripts/gitleaks.mjs
    - scripts/gitleaks-canary.mjs
  modified:
    - .gitignore

key-decisions:
  - "Ran prettier --write on eslint.config.js and package.json after the first lint failure; only line wrapping changed, no semantic drift, and pnpm lint is green from the first commit as the plan requires"
  - "Did not add any gitleaks allowlist: the 16-commit history scan (including .planning docs carrying the gitleaks release SHA-256) reported no leaks, so the Pitfall 7 escape hatch was never needed"
  - "FND-04 and FND-05 are left unchecked in REQUIREMENTS.md: this plan delivers only the local half of both (hooks, guard scripts); the CI half lands in 01-08 and 01-09 carries all five FND requirements to closure"
  - "Left .planning/config.json uncommitted: its pending change predates this executor and is owned by the orchestrator"

patterns-established:
  - "Commit gate: every commit runs node scripts/gitleaks.mjs staged && node scripts/guard-real-data.mjs --staged via .git/hooks/pre-commit; SKIP_SIMPLE_GIT_HOOKS=1 is the only bypass and CI (plan 08) is the backstop"
  - "Real-data rules: emails must be @example.com/@example.org/*.test, US phones must be 555-01xx, and only text files under fixtures|data|mocks|samples|seed are content-scanned; any *costar* path fails regardless of content"
  - "Formatting scope: .planning/, CLAUDE.md, .github/, lockfile and build outputs are never Prettier-formatted; workflow YAML is validated by actionlint (plan 08) instead"

requirements-completed: [FND-04, FND-05]

# Metrics
duration: 6min
completed: 2026-09-17
---

# Phase 01 Plan 01: Workspace, Toolchain & Commit Gates Summary

**pnpm 11.27.0 workspace root with exact pins, ESLint 10 boundary rules, and a live simple-git-hooks pre-commit gate that provably rejects a staged gitleaks canary and real-looking fixture PII**

## Performance

- **Duration:** 6 min (332 s)
- **Started:** 2026-09-17T03:55:35Z
- **Completed:** 2026-09-17T04:01:07Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Repository installs reproducibly: `corepack pnpm install --frozen-lockfile` exits 0 with no `ERR_PNPM_IGNORED_BUILDS`, `packageManager` is `pnpm@11.27.0`, `engines.node` is `>=24 <25`, and the five critical devDependencies carry exact pins
- `pnpm lint` (Prettier check + ESLint 10 flat config) is green from the very first commit; the ESLint config already encodes the marketing/portal import boundaries, the `fetch(` ban, and the `{@html}` allowlist for `lib/security/sanitize-html.svelte`
- `.git/hooks/pre-commit` is installed and was exercised live: a staged runtime-built canary was rejected by gitleaks (exit 1, "leaks found: 1") and a staged `fixtures/lead.json` with a real-looking email and phone was rejected by the guard (exit 1, "Real-data guard failed (2)"); HEAD never moved and no scratch file remained
- `pnpm secrets:canary` prints `gitleaks canary detected as expected`; `pnpm secrets:scan` reports `no leaks found` across all 16 commits; `pnpm guard` reports `Real-data guard passed (36 all files checked)`
- `scripts/lib/real-data-rules.mjs` passes the full RESEARCH Pitfall 10 dry-run table (9 allowed, 5 flagged, CoStar path rule, non-data paths skipped, regex state reset between calls)
- No git remote exists and nothing was pushed (`git remote -v` prints nothing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Workspace root, pinned toolchain, lint/format configuration** - `21bce66` (chore)
2. **Task 2: Secret-scanning and real-data commit gates** - `8e8d1b6` (feat) — this commit itself passed through the newly installed hook ("Real-data guard passed (6 staged files checked)")

**Plan metadata:** see final docs commit below

## Files Created/Modified

- `package.json` - Pinned toolchain, full script surface, `prepare`/`hooks:install`, `simple-git-hooks.pre-commit`
- `pnpm-workspace.yaml` - `apps/*`, `packages/*`, `allowBuilds: { simple-git-hooks: false }`, `engineStrict: true`
- `pnpm-lock.yaml` - Reproducible lockfile (199 packages resolved)
- `.nvmrc` - `24`
- `.gitignore` - Appended `build-sub/`, `test-results/`, `playwright-report/`, `.tools/`, `**/__lintfix__/`
- `.prettierrc` - Tabs, single quotes, no trailing commas, width 100, svelte plugin only (Tailwind plugin arrives in plan 03)
- `.prettierignore` - Excludes `.planning/`, `CLAUDE.md`, `.github/`, lockfile, build outputs
- `eslint.config.js` - Flat config: recommended sets, `no-restricted-syntax` fetch ban with adapter-folder override, `no-restricted-imports` per route group/portal, sanitizer `{@html}` override
- `.gitleaks.toml` - `useDefault = true` plus `tran-canary-test-key` rule; no allowlists
- `scripts/lib/real-data-rules.mjs` - Exports `COSTAR_PATH`, `DATA_PATH`, `TEXT_EXT`, `EMAIL`, `ALLOWED_EMAIL`, `PHONE`, `isFictionalPhone`, `findProblems`
- `scripts/guard-real-data.mjs` - CLI: `--all` via `git ls-files -z`, `--staged` via `git diff --cached ... -z` + `git show :path`
- `scripts/gitleaks.mjs` - Fail-closed runner; honours `GITLEAKS_BIN`; warns on non-8.30.1; `staged` vs history dispatch
- `scripts/gitleaks-canary.mjs` - Feeds a runtime-assembled canary to `gitleaks stdin`, expects exit 1

## Decisions Made

- Applied `prettier --write` to `eslint.config.js` and `package.json` after the first `pnpm lint` run flagged them. The plan's inline `package.json` used a one-line `engines` object and the RESEARCH `eslint.config.js` used long single lines; Prettier at `printWidth: 100` reflows both. Content is byte-for-byte equivalent semantically (all acceptance greps and `node -p` checks pass on the formatted files).
- No `[allowlist]` entry was added to `.gitleaks.toml`. The plan permitted a narrowly scoped `regexTarget = "match"` exception if the history scan flagged a documentation-only literal; the scan was clean, so the file stays exactly as RESEARCH specifies.
- `requirements mark-complete` was NOT run for FND-04/FND-05. Both IDs are shared with plans 02, 06, 07, 08 and 09; this plan provides the local hooks half only. Checking the boxes now would claim a CI gate that plan 08 has not yet written. Plan 09 (which lists all five FND IDs) closes them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prettier-formatted two hand-written files so `pnpm lint` passes**
- **Found during:** Task 1 (verification step `corepack pnpm lint`)
- **Issue:** `prettier --check .` reported code-style issues in `eslint.config.js` and `package.json` (line wrapping at `printWidth: 100`, expanded `engines` object). The plan's acceptance criterion requires `pnpm lint` exit 0.
- **Fix:** `corepack pnpm exec prettier --write eslint.config.js package.json`; re-ran the full acceptance grep list to confirm nothing semantic changed.
- **Files modified:** eslint.config.js, package.json
- **Verification:** `corepack pnpm lint` exit 0; all 30 Task 1 acceptance checks pass
- **Committed in:** 21bce66 (Task 1 commit)

### Acceptance criterion not satisfiable as written (documented, not patched)

**2. `grep -q "simple-git-hooks" .git/hooks/pre-commit` exits 1**
- **Found during:** Task 2 acceptance checks
- **Issue:** simple-git-hooks 2.14.0 generates the hook from its own template. The generated file contains `SKIP_SIMPLE_GIT_HOOKS`, `SIMPLE_GIT_HOOKS_RC` and the raw command line, but never the lowercase hyphenated string `simple-git-hooks`. The hook is regenerated on every `hooks:install`, so hand-editing it would be lost and would be the wrong fix.
- **Equivalent evidence verified:** `grep -q "SIMPLE_GIT_HOOKS" .git/hooks/pre-commit` exit 0; `grep -q "node scripts/gitleaks.mjs staged && node scripts/guard-real-data.mjs --staged" .git/hooks/pre-commit` exit 0 (the frontmatter `key_links` pattern); `hooks:install` printed `[INFO] Successfully set the pre-commit with command: ...`; the hook blocked a staged canary and staged PII live.
- **Recommendation:** plan 06's pre-commit integration test (and any future acceptance grep) should match `SIMPLE_GIT_HOOKS` or the command string, not the package name.

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking), 1 unsatisfiable-as-written criterion documented with equivalent evidence
**Impact on plan:** No scope change. Formatting fix was required by the plan's own green-lint criterion; the hook-grep issue is a planner assumption about third-party output, and the underlying behaviour (hook installed and enforcing) is proven.

## Issues Encountered

- gitleaks with `--redact` (non-verbose, as RESEARCH specifies) prints only `leaks found: 1` on rejection, not the rule id. This is expected CLI behaviour, not a config problem; the canary self-test and the live hook rejection both exit 1 as required.

## Known Stubs

None. Scripts referenced by `package.json` but not yet present (`scripts/build-web.mjs`, `scripts/assert-csp.mjs`, `scripts/actionlint.mjs`) are intentional forward declarations per the plan's single-owner `package.json` rule and are created by plans 03/05, 04 and 08 respectively. None of them is invoked by any gate this plan promises green (`lint`, `guard`, `secrets:canary`, `secrets:scan`).

## User Setup Required

None - no external service configuration required. gitleaks 8.30.1 was already installed on PATH; no owner action was needed.

## Requirements Status

| ID | This plan delivers | Still open | Closed by |
|----|-------------------|------------|-----------|
| FND-04 | `pnpm lint` green from first commit; script surface for check/unit/e2e/verify declared | CI workflow running the gates on every push, Pages deploy gating | 01-08 (workflow), 01-09 (phase verify) |
| FND-05 | Local pre-commit secret scan + real-data/CoStar guard, canary self-test, clean history | Same gates in CI; push protection (deferred owner action after org creation) | 01-08, 01-09 |

## Next Phase Readiness

- Every later plan in Phase 1 commits through the installed hook; plan 02 (Vitest + no-network setup) and plan 03 (`apps/web` skeleton) can start immediately (Wave 1 / Wave 2)
- `.prettierrc` deliberately omits `prettier-plugin-tailwindcss`; plan 03 adds it together with `apps/web/src/app.css`
- `.planning/config.json` carries a pre-existing uncommitted change owned by the orchestrator; it was intentionally left out of this plan's commits
- No remote, no push, branch `main`

## Self-Check: PASSED

All 13 created/modified files plus `.git/hooks/pre-commit` exist on disk; commits `21bce66` and `8e8d1b6` are present in `git log`.

---
*Phase: 01-foundation-origin-security-baseline*
*Completed: 2026-09-17*
