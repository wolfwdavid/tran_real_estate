---
phase: 15-load-deterministic-test-lanes
plan: 02
subsystem: testing
tags: [vitest, playwright, typescript-ast, guard, tdd, timeouts, retries]

# Dependency graph
requires:
  - phase: 14-carried-debt
    provides: the e2e-report.json durations and the Inventory A/B/C baselines the rules were calibrated against
provides:
  - scripts/lib/test-lane-rules.mjs: pure TypeScript-AST rules over {path, text} for TEST-01/TEST-02/TEST-03
  - laneOf/fileKind path routing for every Vitest project, Playwright tree, config, package.json, workflow and scripts/*.mjs
  - frozen contract constants DEFAULTS, MEASURED, CAUSE, TO_PASS_ALLOWLIST, PINNED_RETRIES
  - scripts/test-lane-rules.test.ts: 116 planted-violation and negative-control cases, one per behaviour bullet
affects: [15-04, 15-05, 15-06, 15-09, test-lanes sweep, annotation plans]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rules module + planted-violation test (scripts/lib/*.mjs + scripts/*.test.ts), AST via ts.createSourceFile, no I/O in the rules"
    - "Fail-closed timeout values: anything that is not a numeric literal counts as raised"
    - "Test-API detection by modifier chain (test/it/describe/suite + each/for/only/skip/todo/fails/concurrent/sequential/shuffle/skipIf/runIf), never by root identifier alone"

key-files:
  created:
    - scripts/lib/test-lane-rules.mjs
    - scripts/test-lane-rules.test.ts
  modified: []

key-decisions:
  - "toPass findings point at the .toPass token, not the start of a multi-line expect(async () => {...}) chain"
  - "A Vitest test API is test/it/describe/suite or a chain of known modifiers over it; a local variable named it (an async iterator in fixture.test.ts) is not a raise site"
  - "scripts/*.mjs retry flags are read from string literals via the JS AST, not a line regex, so comments (including the guard's own JSDoc) never trip the rule; workflow comment lines are skipped"
  - "Identifiers and arithmetic stay non-literal = raised per the plan contract; declaration resolution is used only to find the annotation comment, not to compute the value"

patterns-established:
  - "hasAnnotation looks at three sites: the carrying PropertyAssignment, the enclosing statement, and the VariableStatement of an identifier value; the comment must match MEASURED and CAUSE"
  - "Playwright rules: setTimeout/describe.configure > 30 s, test.slow() always, any other call option timeout > 5 s; configs: defineConfig/projects timeout > 30 s, expect.timeout > 5 s, webServer and globalTimeout ignored"

requirements-completed: [TEST-01, TEST-02]

# Metrics
duration: 25min
completed: 2026-11-09
---

# Phase 15 Plan 02: Test-lane rules module Summary

**Pure TypeScript-AST guard rules (`scripts/lib/test-lane-rules.mjs`) that detect elapsed-time measurement, raised Vitest and Playwright timeouts, missing `measured <n> <unit>` + `cause` annotations, retries and excess `.toPass()` over `{path, text}`, proven non-vacuous by 116 planted-violation tests and three mutants.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-11-09T06:45:19Z
- **Completed:** 2026-11-09T07:09:50Z
- **Tasks:** 2 (TDD: RED, GREEN, plus one fix cycle)
- **Files modified:** 2

## Accomplishments

- `scripts/lib/test-lane-rules.mjs` exports exactly the 14-symbol contract 15-04/05/06/09 consume: `DEFAULTS`, `MEASURED`, `CAUSE`, `TO_PASS_ALLOWLIST`, `PINNED_RETRIES` (all `Object.freeze`d), `laneOf`, `fileKind`, `elapsedTimeFindings`, `vitestTimeoutFindings`, `playwrightTimeoutFindings`, `configTimeoutFindings`, `retryFindings`, `toPassFindings`, `scanFile`. One `import ts from 'typescript'`, zero file-system calls, runs under plain `node`.
- `scripts/test-lane-rules.test.ts` (740+ lines, 116 tests, 135 `test(` lines) covers every bullet of the plan's behaviour block: lane resolution for all seven projects, every file kind, each elapsed-time form and its negatives, every Vitest raise form (options, trailing arg, hooks, waits, identifiers, arithmetic, `vi.setConfig`) in node, browser and serial lanes, all five annotation placements, every Playwright raise form, Vitest and Playwright config raises, every retry surface, the toPass allowlist, and `scanFile` routing.
- Calibrated against the real tree: with an empty manifest the rules find exactly Inventory A's five elapsed-time files (8 sites), Inventory A's six raised-Vitest-timeout files, zero retries (Inventory C) and 88 unannotated Playwright/config raises (Inventory B's "about 70 raises + 15 test.slow" set, the 15-04/15-05 work). 523 files scan in about 2.3 s including file reads.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED - planted-violation and negative-control tests** - `653bcb6` (test)
2. **Task 2: GREEN - implement scripts/lib/test-lane-rules.mjs** - `c5b8c3c` (feat)
3. **Task 2 fix cycle (deviations below)** - `0cbfc8b` (fix)

**Plan metadata:** see the final docs commit.

## Files Created/Modified

- `scripts/lib/test-lane-rules.mjs` - The rules module. Path routing (`laneOf`, `fileKind`), AST helpers (callee root, modifier-chain test-API check, numeric literal extraction, enclosing statement, declaration lookup, leading/trailing comment join), the five rule families, and the `scanFile` router.
- `scripts/test-lane-rules.test.ts` - Planted sources in template literals; asserts `[rule, line]` pairs with exact rule names and 1-based lines; negative controls for lowered timeouts, non-test APIs, strings, comments, product code named `retry`, `test.info().retry`, pinned Playwright `retries` expressions.

## Mutation ledger

Each mutant was applied with `sed`, the test file run, and the module restored with `git checkout`; the restored run is 116/116 green. Re-run on the final code at `0cbfc8b`.

| # | Mutant | Expected red | Observed |
|---|--------|--------------|----------|
| 1 | `hasAnnotation` returns `true` unconditionally | serial-lane unannotated cases | 23 failed / 93 passed: all 4 serial Vitest cases, all 9 Playwright raise cases, all 6 config raise cases, 4 `scanFile` routing cases |
| 2 | Drop the `Date.now()` subtraction branch (`(isDateNow(left) \|\| isDateNow(right))` -> `false`) | the two `Date.now()` elapsed cases | 2 failed / 114 passed: "flags Date.now() on the left of a subtraction", "...on the right of a subtraction" |
| 3 | `DEFAULTS.browserTest` 15000 -> 5000 | the browser 15_000 negative | 3 failed / 113 passed: "does not flag a test timeout at the 15 s browser default", "does not flag testTimeout 15000 in a browser config", and the DEFAULTS contract test |

## Decisions Made

- **toPass line = the `.toPass` token.** A multi-line `expect(async () => { ... }).toPass()` chain starts at `expect`; reporting the token line is what an annotator needs. The behaviour tests assert the token line.
- **Test-API detection by modifier chain, not root identifier.** `it.next().then(onOk, onErr)` in `apps/web/src/lib/ai/providers/fixture.test.ts:121` (a local async iterator named `it`) was reported as a trailing-timeout raise by the first implementation. The chain must now consist of `each/for/only/skip/todo/fails/concurrent/sequential/shuffle/skipIf/runIf` over `test/it/describe/suite`, and a function-typed trailing argument is never a timeout.
- **scripts/*.mjs retry flags via the JS AST.** The plan's line regex matched the guard's own JSDoc (`` `--retry` `` in backticks), which would have failed the 15-09 sweep on `scripts/lib/test-lane-rules.mjs` itself. String literals (plain, no-substitution and template tokens) are now scanned after parsing with `ts.ScriptKind.JS`; workflow lines starting with `#` are skipped. The planted `spawn('npx', ['playwright', 'test', '--retries=1'])` case still fires, and a template-literal case was added.
- **Non-literal values stay "raised".** Declaration lookup is used only to find the annotation comment above a `const`, never to compute the value, per the must-have "treats non-literal values as raised".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Local variable named `it` treated as a Vitest test API**
- **Found during:** Task 2 (informational sweep of the real tree after GREEN)
- **Issue:** `rootName` walked any `a.b().c(...)` chain to its root identifier, so `it.next().then(() => undefined, (e) => e)` in `fixture.test.ts:121` produced a false `raised-timeout-outside-serial` finding that Inventory A does not list.
- **Fix:** `testApiRoot` accepts only known modifier chains; function-typed trailing arguments are skipped. Tests added: "does not flag a local variable named it used as an iterator", "still flags a trailing timeout through a skipIf modifier chain".
- **Files modified:** scripts/lib/test-lane-rules.mjs, scripts/test-lane-rules.test.ts
- **Verification:** 116/116; real-tree sweep drops from 7 to the 6 Inventory A files.
- **Committed in:** 0cbfc8b

**2. [Rule 1 - Bug] `script-mjs` retry regex matched the guard's own comments**
- **Found during:** Task 2 (same sweep)
- **Issue:** `/['"\`]--retr(?:y|ies)\b/` over raw lines hit three JSDoc lines in `scripts/lib/test-lane-rules.mjs`, so the module would have failed its own future sweep; the same class of false positive applies to YAML comments in workflows.
- **Fix:** Parse `.mjs` as JS and test string-literal nodes only; skip `#` comment lines in workflows. Tests added: template-literal positive, `.mjs` comment negative, workflow comment negative.
- **Files modified:** scripts/lib/test-lane-rules.mjs, scripts/test-lane-rules.test.ts
- **Verification:** 116/116; real-tree sweep reports 0 `retry` findings, matching Inventory C.
- **Committed in:** 0cbfc8b

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both are false-positive fixes inside the plan's own files, caught by running the rules over the real tree before hand-off. The exported contract is unchanged. No scope creep.

## Issues Encountered

- The first GREEN run was 109/111: the two `toPass` cases expected the `.toPass` token line while the implementation reported the chain start. Resolved by reporting the token (decision above).
- Vite printed "import without a file extension" warnings for `tooling/vitest/lanes` during test runs. Those come from the sibling 15-01 agent's uncommitted config files in the shared tree, not from this plan; not touched.

## Known Stubs

None. Every exported function is wired and exercised by the test file.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 15-04/15-05/15-06 can list what to annotate with a one-liner over `scanFile(path, text, SERIAL)`; today's counts with an empty manifest: 88 `unannotated-raise` (Playwright specs/configs plus `scripts/vitest.config.ts` and friends), 6 `raised-timeout-outside-serial`, 8 `elapsed-time`, 0 `retry`, 0 `to-pass`.
- 15-09 (repo sweep): 523 files scan in about 2.3 s on this machine including file reads. Research Pitfall 10 sets a 2.5 s under-load threshold for keeping the sweep in the parallel `scripts` lane; measure it in the first green sweep and place `scripts/test-lanes.test.ts` in `scripts-serial` if it exceeds that.
- `laneOf` expects manifest file entries relative to the project root (`packages/core/`, `apps/web/`, `apps/extension/`, `scripts/`), matching the `SERIAL` shape the plan specifies for `tooling/vitest/lanes.ts`.

---
*Phase: 15-load-deterministic-test-lanes*
*Completed: 2026-11-09*

## Self-Check: PASSED

- Files: scripts/lib/test-lane-rules.mjs, scripts/test-lane-rules.test.ts, 15-02-SUMMARY.md exist on disk
- Commits: 653bcb6 (test), c5b8c3c (feat), 0cbfc8b (fix) present in git log
