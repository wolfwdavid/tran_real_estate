---
phase: 15-load-deterministic-test-lanes
plan: 07
subsystem: testing
tags: [windows, taskkill, playwright, vitest, browser-mode, teardown, runbook, worker-caps, tdd]

# Dependency graph
requires:
  - phase: 15-load-deterministic-test-lanes
    provides: 15-01 MAX_WORKERS (CI 3 / dev 8) on tooling/vitest/lanes.ts and both browser configs; 15-03 web E2E workers CI 2 / dev 4, failOnFlakyTests and the extension 60 s timeout annotation
  - phase: 01-foundation
    provides: the inline Windows PATH/taskkill teardown guard copied into five configs
provides:
  - scripts/lib/windows-path.mjs exporting ensureSystem32OnPath(env, platform), the one PATH/taskkill guard
  - scripts/lib/windows-path.d.mts typing it for consumers checked without allowJs (apps/extension)
  - scripts/windows-path.test.ts: 6 pure cases, a source pin over the 5 configs, and a win32 cmd.exe taskkill probe
  - the five Playwright/Vitest browser configs call ensureSystem32OnPath() at top level; zero inline copies remain
  - RUNBOOK "Run the suites locally" names both Vitest lanes and the known-good worker values, pinned to lanes.ts and playwright.config.ts by runbook.test.ts
affects: [15-10, 15-11, 16-vitest-5-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Process-environment fixes live in scripts/lib as pure (env, platform) functions with a unit test, and configs call them at top level; never an inline copy per config"
    - "A scripts/lib *.mjs consumed by a package without allowJs gets a sibling *.d.mts (precedent scripts/assert-csp.d.mts)"
    - "RUNBOOK numbers are read back from their source file by runbook.test.ts (regex over lanes.ts / playwright.config.ts), never retyped as literals in the test"

key-files:
  created:
    - scripts/lib/windows-path.mjs
    - scripts/lib/windows-path.d.mts
    - scripts/windows-path.test.ts
  modified:
    - apps/web/playwright.config.ts
    - apps/web/playwright.smoke.config.ts
    - apps/extension/playwright.config.ts
    - apps/web/vitest.browser.config.ts
    - apps/extension/vitest.browser.config.ts
    - docs/RUNBOOK.md
    - scripts/runbook.test.ts

key-decisions:
  - "norm() in ensureSystem32OnPath also maps / to \\ so C:/Windows/System32/ counts as present, as behaviour (b) requires; the Pattern 6 snippet only stripped trailing slashes"
  - "The 'no literal System32 in the configs' pin applies to the source with the identifier ensureSystem32OnPath removed, because the identifier itself contains System32"
  - "Typed the module with a sibling .d.mts instead of enabling allowJs in the wxt-generated extension tsconfig"

patterns-established:
  - "TDD for infra helpers: RED commit with the module missing, GREEN commit for the module, the config-replacement commit turns the source-pin cases green"

requirements-completed: [TEST-04]

# Metrics
duration: 12min
completed: 2026-11-09
---

# Phase 15 Plan 07: Windows PATH guard module and RUNBOOK worker table Summary

**The Phase 1 Windows PATH/taskkill teardown guard is now one tested function, `ensureSystem32OnPath()` in `scripts/lib/windows-path.mjs`, called at top level by all five Playwright and Vitest browser configs (zero inline copies left), with a win32 probe that reproduces the root cause; the RUNBOOK records both Vitest lanes and the known-good worker values (Vitest CI 3 / dev 8, web E2E CI 2 / dev 4, extension 1), pinned to their config sources by `runbook.test.ts`.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-11-09T07:47:02Z
- **Completed:** 2026-11-09T07:59:27Z
- **Tasks:** 3 (Task 1 TDD: 2 commits)
- **Files modified:** 10 (3 created, 7 modified)

## Accomplishments

- `ensureSystem32OnPath(env = process.env, platform = process.platform)` is pure on its inputs, matches case-insensitively, ignores trailing slashes, treats `/` and `\` alike, writes back to whichever spelling of the PATH key the env has, and returns `true` only when it changed PATH.
- `scripts/windows-path.test.ts` (13 cases, all green on Windows): (a) prepend, (b) present in other case / trailing backslash / forward slashes, (c) `SystemRoot` unset, (d) linux and darwin no-op with deep-equal, (e) `Path`-spelled key, (f) empty and missing PATH with no trailing `;`, (g) source pin over the five configs, (h) `test.runIf(win32)` cmd.exe probe.
- Root cause reproduced on the dev machine (case h and a standalone Node probe): with PATH reduced to Node's own directory, `cmd.exe /d /c taskkill /?` exits **1** (`'taskkill' is not recognized as an internal or external command`); after `ensureSystem32OnPath(env)` the same call exits **0** and stdout contains `TASKKILL`.
- The five configs each carry one import line and one top-level `ensureSystem32OnPath();` under a two-line comment; wave 1's additions (TEST-03 retry comment, `failOnFlakyTests`, `workers`, `maxWorkers: MAX_WORKERS`, the annotated extension `timeout: 60_000`) are untouched.
- Teardown proven clean on Windows after the replacement (each run finished; no hang):
  - `pnpm ext:e2e`: 7 passed, Playwright 8.0 s, **12.9 s wall** including pnpm start-up and teardown
  - `pnpm --filter extension test:browser`: 13 passed, Vitest 2.29 s, **4.3 s wall**
  - `pnpm vitest run --project web-browser`: 30 files / 208 tests passed, Vitest 10.71 s, **14.4 s wall**
  - `pnpm --filter web exec playwright test --list`: 2354 tests in 88 files (config loads)
- RUNBOOK "Run the suites locally": the Vitest row names the parallel lane (web, core, brand, scripts, web-browser, extension), the serial lane (core-serial, web-serial, web-browser-serial, scripts-serial), the cap `MAX_WORKERS = process.env.CI ? 3 : 8` with its measured times (CI 93.7-108.2 s, run 42289609809; dev 124.3 s, 2026-11-09), the VITEST_MAX_WORKERS fail-closed behaviour and the `--project scripts` caveat. The Web E2E row quotes `workers: process.env.CI ? 2 : 4`, the "using 2 workers" CI log line, the 10-23 eight-worker timeouts, and the `failOnFlakyTests` / `--fail-on-flaky-tests` gate. The Extension E2E row gains `failOnFlakyTests` in CI.
- `runbook.test.ts` gains two tests that regex-read the cap from `tooling/vitest/lanes.ts` and the workers line from `apps/web/playwright.config.ts` and require the RUNBOOK section to contain them verbatim, plus the four serial project names and `VITEST_MAX_WORKERS`. Mutation proof: cap text changed to `? 3 : 9` -> exactly that test fails (1 failed / 24 passed); restored -> 25/25.

## Task Commits

1. **Task 1 (RED): failing tests for the guard module** - `b1f23bd` (test)
2. **Task 1 (GREEN): `scripts/lib/windows-path.mjs`** - `d416906` (feat)
3. **Task 2: replace the five inline copies + `.d.mts`** - `4a4ba06` (feat)
4. **Task 3: RUNBOOK worker table + runbook.test.ts pins** - `d36e3bc` (docs)

All commits made with `--no-verify` (parallel executor wave); sibling plans' commits (15-06, 15-08) are interleaved in the log.

## Files Created/Modified

- `scripts/lib/windows-path.mjs` - `ensureSystem32OnPath(env, platform)`: the one PATH/taskkill guard
- `scripts/lib/windows-path.d.mts` - its signature for consumers checked without `allowJs`
- `scripts/windows-path.test.ts` - TEST-04 unit cases, source pin over the five configs, win32 taskkill probe
- `apps/web/playwright.config.ts`, `apps/web/playwright.smoke.config.ts`, `apps/extension/playwright.config.ts`, `apps/web/vitest.browser.config.ts`, `apps/extension/vitest.browser.config.ts` - import + top-level call replace the inline block
- `docs/RUNBOOK.md` - Vitest, Web E2E and Extension E2E rows of "Run the suites locally"
- `scripts/runbook.test.ts` - two new pins inside `describe('Run the suites locally')`

## Proof that zero inline PATH blocks remain

```
$ for f in <5 configs>; do grep -v ensureSystem32OnPath "$f" | grep -ci system32; done
0 0 0 0 0
$ grep -c "^ensureSystem32OnPath();" <each of the 5 configs>
1 1 1 1 1
$ grep -c "process.platform === 'win32'" <each of the 5 configs>
0 0 0 0 0
$ grep -rln "entries.some((e) => e.toLowerCase() === system32" --include=*.ts --include=*.mjs --exclude-dir=node_modules .
(none)
```

Raw `grep -c System32` is 2 per file, not 0: both the import line and the call line contain the identifier `ensureSystem32OnPath`, whose name includes `System32`. The acceptance intent (no inline copy, no literal outside the identifier) is what case (g) pins and what the first grep above shows.

## Verification results

| Check | Result |
|---|---|
| `vitest run --project scripts scripts/windows-path.test.ts` | 13 passed (h ran, not skipped) |
| `vitest run --project scripts scripts/runbook.test.ts` | 25 passed (23 existing + 2 new) |
| windows-path + runbook + workflow-gate + test-lane-rules together | 4 files, 193 passed |
| `pnpm check` | exit 0 (extension 1079 files 0 errors; web 3271 files 0 errors) |
| `pnpm banned` | passed (454 files) |
| prettier `--check` + eslint on the 10 plan files | exit 0 |
| `pnpm lint` (whole repo) | exit 1, only on `scripts/flaky-gate.test.ts` and `scripts/lane-order.test.ts`: uncommitted, unformatted files owned by sibling executors (15-05/15-06/15-08) this wave; none of this plan's files are flagged. Out of scope; the orchestrator's post-wave validation covers it |
| `git diff docs/RUNBOOK.md \| grep -E "^[+].*[A-Z_]+_KEY="` | empty |

Acceptance-criterion note: `grep -c "workers: process.env.CI ? 2 : 4" docs/RUNBOOK.md` is **2**, not 1. The Smoke row already quoted the same string before this plan (pinned by the existing smoke test); the Web E2E row now carries it exactly once, as intended.

## Decisions Made

- **Slash normalisation in `norm()`**: behaviour (b) requires `C:/Windows/System32/` to count as present; the Pattern 6 snippet's `norm` only stripped trailing separators and lowercased, so `c:/windows/system32` would never equal `c:\windows\system32`. The test drove the one-token change (`replace(/\//g, '\\')`). Windows accepts either separator in PATH entries, so this is also the correct behaviour.
- **Source pin strips the identifier**: `ensureSystem32OnPath` contains `System32`, so "literal `System32` appears in none of them" is checked on `src.replace(/ensureSystem32OnPath/g, '')`, case-insensitively, and additionally on the absence of `process.platform === 'win32'`.
- **`.d.mts` over `allowJs`**: `apps/extension/tsconfig.json` extends the wxt-generated `.wxt/tsconfig.json`, which has no `allowJs`; editing a generated file or forking it is heavier than the repo's existing `scripts/assert-csp.d.mts` pattern.
- **Targeted prettier instead of `pnpm format <file>`**: `pnpm format` is `prettier --write .`, so the plan's `pnpm format docs/RUNBOOK.md` would have rewritten sibling executors' uncommitted files. Used `pnpm exec prettier --write docs/RUNBOOK.md scripts/runbook.test.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Forward-slash PATH entry not recognised by the verbatim snippet**
- **Found during:** Task 1 (RED test design against the Pattern 6 function)
- **Issue:** Behaviour (b) `C:/Windows/System32/` -> unchanged could not pass with `norm = p => p.replace(/[\\/]+$/, '').toLowerCase()`
- **Fix:** `norm = p => p.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase()`
- **Files modified:** `scripts/lib/windows-path.mjs`
- **Verification:** case (b) both halves green
- **Committed in:** `d416906`

**2. [Rule 3 - Blocking] `pnpm check` failed in apps/extension: no declaration for the `.mjs` import**
- **Found during:** Task 2 verification
- **Issue:** `svelte-check` in `apps/extension` reported "Could not find a declaration file for module '../../scripts/lib/windows-path.mjs'" for both configs (wxt tsconfig has no `allowJs`; `apps/web` has `allowJs`/`checkJs` and was fine)
- **Fix:** added `scripts/lib/windows-path.d.mts` with the exact signature (repo precedent `scripts/assert-csp.d.mts`)
- **Files modified:** `scripts/lib/windows-path.d.mts` (new)
- **Verification:** `pnpm check` exit 0, extension 0 errors
- **Committed in:** `4a4ba06`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both required for correctness/typecheck; no scope change. One extra file (`windows-path.d.mts`) beyond `files_modified`.

## Issues Encountered

- Whole-repo `pnpm lint` cannot reach exit 0 during this wave because two sibling executors have unformatted uncommitted test files in `scripts/`; verified this plan's files with targeted `prettier --check` and `eslint` instead (both exit 0). Not touched, per the parallel-execution rules.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TEST-04 is complete on both halves: worker caps recorded in RUNBOOK and pinned to sources; the PATH/taskkill guard is one module with unit, source-pin and root-cause coverage.
- 15-10 (evidence protocol) can quote the RUNBOOK worker values and rely on clean Windows teardown for its repeated runs.
- Phase 16 (Vitest 5) must keep `maxWorkers: MAX_WORKERS` on the browser configs and may reuse `ensureSystem32OnPath()` unchanged.

---
*Phase: 15-load-deterministic-test-lanes*
*Completed: 2026-11-09*

## Self-Check: PASSED

Files: scripts/lib/windows-path.mjs, scripts/lib/windows-path.d.mts, scripts/windows-path.test.ts present. Commits b1f23bd, d416906, 4a4ba06, d36e3bc present.
