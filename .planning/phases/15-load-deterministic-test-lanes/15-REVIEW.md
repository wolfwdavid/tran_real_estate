---
phase: 15-load-deterministic-test-lanes
reviewed: 2026-11-11T03:20:48Z
depth: standard
diff_base: 449ecc5
head: 72e4043
files_reviewed: 75
files_reviewed_list:
  - .github/workflows/ci.yml
  - apps/extension/e2e/extension.spec.ts
  - apps/extension/playwright.config.ts
  - apps/extension/vitest.browser.config.ts
  - apps/web/playwright.config.ts
  - apps/web/playwright.smoke.config.ts
  - apps/web/src/lib/components/tools/calculators.browser.test.ts
  - apps/web/src/lib/features/renter/outreach/OutreachSection.browser.test.ts
  - apps/web/src/lib/features/renter/search/ResultsView.browser.test.ts
  - apps/web/src/lib/features/shared/data/GatewayError.browser.test.ts
  - apps/web/src/lib/features/studio/boundaries.test.ts
  - apps/web/src/lib/seo/og-card.server.test.ts
  - apps/web/src/lib/storage/agent/import-commit.test.ts
  - apps/web/tests/e2e/a11y-keyed.spec.ts
  - apps/web/tests/e2e/agent-followup.spec.ts
  - apps/web/tests/e2e/agent-live-key.spec.ts
  - apps/web/tests/e2e/agent-no-rentcast.spec.ts
  - apps/web/tests/e2e/agent-share-link.spec.ts
  - apps/web/tests/e2e/ai-a11y.spec.ts
  - apps/web/tests/e2e/ai-drafting.spec.ts
  - apps/web/tests/e2e/ai-guardrails.spec.ts
  - apps/web/tests/e2e/app-notice-locked.spec.ts
  - apps/web/tests/e2e/backup-roundtrip.spec.ts
  - apps/web/tests/e2e/csp.spec.ts
  - apps/web/tests/e2e/data-status.spec.ts
  - apps/web/tests/e2e/investor/deals.spec.ts
  - apps/web/tests/e2e/investor/demo.spec.ts
  - apps/web/tests/e2e/investor/memo.spec.ts
  - apps/web/tests/e2e/investor/print.spec.ts
  - apps/web/tests/e2e/investor/sweep.spec.ts
  - apps/web/tests/e2e/layout.spec.ts
  - apps/web/tests/e2e/onboarding.spec.ts
  - apps/web/tests/e2e/renter-demo-credible.spec.ts
  - apps/web/tests/e2e/renter-journey.spec.ts
  - apps/web/tests/e2e/renter-outreach.spec.ts
  - apps/web/tests/e2e/routing.spec.ts
  - apps/web/tests/e2e/sample-handoff.spec.ts
  - apps/web/tests/e2e/seo.spec.ts
  - apps/web/tests/e2e/settings-a11y.spec.ts
  - apps/web/tests/e2e/settings-backup.spec.ts
  - apps/web/tests/e2e/settings-data.spec.ts
  - apps/web/tests/e2e/settings-security.spec.ts
  - apps/web/tests/e2e/setup-rentcast.spec.ts
  - apps/web/tests/e2e/snapshot-builder.spec.ts
  - apps/web/tests/e2e/snapshot-print.spec.ts
  - apps/web/tests/e2e/studio-keyless.spec.ts
  - apps/web/tests/e2e/studio-listing.spec.ts
  - apps/web/tests/e2e/studio-reel.spec.ts
  - apps/web/tests/e2e/studio-shell.spec.ts
  - apps/web/tests/e2e/studio-social.spec.ts
  - apps/web/tests/e2e/third-party.spec.ts
  - apps/web/tests/smoke/fixtures.ts
  - apps/web/vite.config.ts
  - apps/web/vitest.browser-serial.config.ts
  - apps/web/vitest.browser.config.ts
  - apps/web/vitest.serial.config.ts
  - packages/core/vitest.config.ts
  - packages/core/vitest.serial.config.ts
  - scripts/cpu-burn.mjs
  - scripts/cpu-burn.test.ts
  - scripts/flaky-gate.test.ts
  - scripts/lane-order.test.ts
  - scripts/lib/test-lane-rules.mjs
  - scripts/lib/windows-path.d.mts
  - scripts/lib/windows-path.mjs
  - scripts/runbook.test.ts
  - scripts/test-evidence.test.ts
  - scripts/test-lane-rules.test.ts
  - scripts/test-lanes.test.ts
  - scripts/vitest.config.ts
  - scripts/vitest.serial.config.ts
  - scripts/windows-path.test.ts
  - scripts/workflow-gate.test.ts
  - tooling/vitest/lanes.ts
  - vitest.config.ts
findings:
  critical: 1
  warning: 9
  info: 7
  total: 17
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-11-11T03:20:48Z
**Depth:** standard
**Files Reviewed:** 75
**Status:** issues_found

## Summary

Reviewed the Phase 15 diff (`449ecc5..72e4043`): the lane manifest, the ten Vitest and Playwright
configs, the mechanical guard (`scripts/lib/test-lane-rules.mjs`) with its repo sweep, the CI
change, `cpu-burn.mjs`, `windows-path.mjs`, and the annotate-only spec changes.

**The lane mechanism itself is sound today.** Checked, not assumed:

- `vitest list --filesOnly --json` on the real root config returns 366 files, each in exactly one
  project. No file runs in two lanes and no file is dropped. The 20 serial files are the 20
  manifest entries. The only test-like file outside the root projects is
  `apps/extension/tests/browser/popup.browser.test.ts`, which is deliberate (`ext:test:browser`).
- Vitest 4.1.12 source (`groupSpecs`, `resolveMaxWorkers`) confirms the three node-serial projects
  share one pool capped at 1 in group 1, and that `VITEST_MAX_WORKERS` is applied after
  `fileParallelism: false` as the root config claims.
- The ~50 annotated spec files changed no timeout value. Every hoisted `*_MS` constant equals the
  literal it replaced. Two deliberate behaviour changes: `ResultsView.browser.test.ts` drops its
  20 s describe timeout for the 15 s browser default, and the parallel `scripts` project drops
  `testTimeout: 60_000` for the 5 s default (the 60 s moved to `scripts-serial`).
- The five inline Windows PATH blocks became `ensureSystem32OnPath()` with equivalent behaviour.

**The defects are in the guard.** All findings below were reproduced by feeding probe sources to
`scanFile` (probe script kept outside the repo); none is exploited by a file in the tree today.
The guard accepts a disabled timeout (`0`) everywhere, the elapsed-time rule misses the most common
way to write an elapsed-time assertion, several timeout and retry forms pass by indirection, and one
lane pin is satisfied by a comment. A future change can therefore reintroduce the Phase 15 failure
modes while the sweep stays green.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01 (BLOCKER): A timeout of `0` disables the timeout and passes every rule

**File:** `scripts/lib/test-lane-rules.mjs:150` (`isRaised`), used at `:408`, `:528`, `:537`, `:555`, `:589`
**Issue:** `isRaised` is `value === null || value > max`, so the literal `0` is never raised. In
both runners `0` means "no timeout": Vitest's runner skips the timer when `timeout <= 0`
(`@vitest/runner` `chunk-artifact.js:2262`), and Playwright documents "Zero means no timeout" for
`test.setTimeout`, test timeouts, and expect/action timeouts. Reproduced, all returning no finding:

- parallel-lane Vitest: `test('a', { timeout: 0 }, fn)` and `test('a', fn, 0)`
- Playwright: `test.setTimeout(0)` and `expect(l).toBeVisible({ timeout: 0 })`
- configs: `testTimeout: 0, hookTimeout: 0` and Playwright `timeout: 0, expect: { timeout: 0 }`

**Failure scenario:** a test that times out under load gets `test.setTimeout(0)` or
`{ timeout: 0 }`. No annotation is demanded, the file may stay in the parallel lane, and a hang now
runs until the CI job limit. This is the largest possible raise and the guard cannot see it.
**Fix:**
```js
/** 0 and negatives disable the timeout in Vitest and Playwright, so they are the largest raise. */
const isRaised = (value, max) => value === null || value <= 0 || value > max;
```
Add unit cases for each of the six forms above. `vi.waitFor(fn, { timeout: 0 })` then also reports,
which is harmless (it is not a valid wait).

## Warnings

### WR-01 (WARNING): The elapsed-time rule only sees three callees and a direct `Date.now()` operand

**File:** `scripts/lib/test-lane-rules.mjs:73`, `:349-375`
**Issue:** The rule matches `performance.now`, `process.hrtime`, `process.hrtime.bigint`, and a
subtraction where one operand is literally the call `Date.now()`. Reproduced as no finding in a
parallel-lane file:

- `const s = Date.now(); work(); const e = Date.now(); expect(e - s).toBeLessThan(50)` (both
  operands are identifiers)
- `new Date().getTime() - s`
- `expect(Date.now() < deadline).toBe(true)` (comparison, not subtraction)
- `globalThis.performance.now()`, `const { now } = performance; now()`
- `process.uptime()`, `process.cpuUsage()`

**Failure scenario:** a new wall-clock budget written with two named timestamps lands in the
parallel lane and flakes under load. Non-vacuity test A still passes, because it only pins the five
files the rule already finds.
**Fix:** flag the clock read rather than the arithmetic. Any call whose callee name ends in
`Date.now`, `performance.now`, `hrtime`, `hrtime.bigint`, `process.uptime`, or `process.cpuUsage`,
plus `new Date()` with no arguments, is a finding outside the serial lane. Files that only stamp
fixture data (`fetchedAt: Date.now()` in `FairRentCheck.browser.test.ts:16` and
`ProvenanceRow.browser.test.ts:68`) then need a fixed date or an allowlist entry, which is the
fail-closed direction the module header promises.

### WR-02 (WARNING): Timeouts and retries passed by reference or shorthand are not seen

**File:** `scripts/lib/test-lane-rules.mjs:422-451`, `:552-563`, `:598-617`, `:686-720`
**Issue:** The header says non-literal values "always count as raised", but that holds only when
the object literal is written inline at the call. Reproduced as no finding:

- Vitest: `const o = { timeout: 600000 }; test('a', o, fn)` and `test('a', { ...o }, fn)`
- Vitest: `test('a', run, 600000)` and `test('a', wrap(fn), 600000)`. The trailing-timeout branch
  needs an inline arrow or function expression to locate the callback (`args.findIndex(isFunction)`
  at `:433` and `:442`), so `beforeAll(setup, 600000)` passes too.
- Vitest: `expect.poll(fn, opts)`; retry via `const o = { retry: 3 }; test('a', o, fn)`
- Playwright: `expect(l).toBeVisible(opts)`; `test.describe.configure(opts)` carrying both
  `retries` and `timeout`
- Configs: `const retries = 5; defineConfig({ retries })` and `{ testTimeout, retry }`. The config
  rules test `ts.isPropertyAssignment` only, so shorthand properties are skipped, which also
  defeats `PINNED_RETRIES`.
- Configs: `const c = { timeout: 600000 }; export default defineConfig(c)` (`isConfigRoot` needs
  the literal as the direct argument)

**Failure scenario:** a routine refactor hoists options into a shared `const opts` and silently
takes the site out of the guard.
**Fix:** fail closed on what cannot be read. Treat a non-literal, non-function argument in an
options position as a raise (and as a retry). Treat any argument after the title as a trailing
timeout when no inline callback is found. Handle `ts.isShorthandPropertyAssignment` in
`configTimeoutFindings` and in both config branches of `retryFindings` (`propOf` already does).
Report a `defineConfig(...)` argument that is not an object literal.

### WR-03 (WARNING): Several timeout-raising APIs are outside the rule set

**File:** `scripts/lib/test-lane-rules.mjs:500-566` (Playwright), `:390-454` (Vitest)
**Issue:** Reproduced as no finding:

- Playwright: `page.setDefaultTimeout(600000)`, `page.setDefaultNavigationTimeout(...)`,
  `context.setDefaultTimeout(...)`
- Playwright: `testInfo.setTimeout(600000)` and `testInfo.slow()` (the rule requires the root
  identifier `test`; `test.info().setTimeout` is caught)
- Playwright config: `expect: { toPass: { timeout: 600000 } }`
- Vitest browser: `expect.element(loc).toBeVisible({ timeout: 60000 })` and
  `page.getByRole(...).click({ timeout: 60000 })`. Only the second argument of `expect.element` is
  checked. Whether Vitest honours a timeout in each of these positions was not run-tested; the
  guard ignores them either way.
- Vitest: `const t = test.extend({}); t('a', fn, 600000)` and `import { test as t } from 'vitest'`

**Failure scenario:** `page.setDefaultTimeout(120_000)` in a `beforeEach` lifts every action and
assertion wait in a spec with no annotation.
**Fix:** add the `setDefault*Timeout` family and `<anything>.setTimeout` / `.slow` inside Playwright
files to the raise sites. In Vitest files apply the generic "any call with `{ timeout }` above the
wait default" rule already used for Playwright. Resolve `test.extend` results and import aliases to
the test API, or report an alias as a finding.

### WR-04 (WARNING): `tooling/vitest/lanes.ts` and runner CLI flags are outside the sweep

**File:** `scripts/lib/test-lane-rules.mjs:116-128` (`fileKind`), `:74` (`RETRY_FLAG`); `scripts/test-lanes.test.ts:113`
**Issue:**

1. `fileKind('tooling/vitest/lanes.ts')` is `null`, yet `serialTest()` there supplies the `test`
   block of all four serial projects. Reproduced: `{ testTimeout: 600000, retry: 3 }` returned from
   `serialTest()` gives no finding, and `scripts/test-lanes.test.ts:234-244` asserts only five of
   its keys.
2. Only `*.config.ts` is classified. `vitest.config.mts`, `apps/web/vitest.config.js`,
   `apps/web/playwright.config.mts`, and `vitest.workspace.ts` are `null`, and the coverage check
   uses the same `.ts`-only pattern, so it cannot notice.
3. Only `--retry` / `--retries` is searched in package.json scripts, workflows, and
   `scripts/*.mjs`. Vitest applies `--testTimeout` and `--retry` from the CLI to every project
   (`cliOverrides` in `cli-api`), and Playwright takes `--timeout` and `--workers`. The CI pins are
   substring checks (`scripts/workflow-gate.test.ts:189`), so appending ` --timeout=600000` or
   ` --workers=8` to the E2E line passes. `test:e2e` and the extension scripts are not pinned.
4. Workflow retries that are not a flag pass: `run: pnpm test:unit || pnpm test:unit`,
   `continue-on-error: true`, a retry action (reproduced).

**Failure scenario:** `retry: 2` added to `serialTest()` "to steady the serial lane" turns every
serial flake green, and the sweep, which exists to forbid retries, reports nothing.
**Fix:** classify `tooling/vitest/lanes.ts` as `vitest-config`. Match `[cm]?[jt]s` config
extensions and workspace files. Extend the flag pattern to
`--(retry|retries|testTimeout|hookTimeout|timeout|workers|maxWorkers|max-workers)`. Pin the CI E2E
line by equality. Flag `continue-on-error` and `||` re-runs on test steps.

### WR-05 (WARNING): The lane-exclusion pin for `web` is satisfied by a comment, and other pins are substring checks

**File:** `scripts/test-lanes.test.ts:230`, `:322`; `apps/web/vite.config.ts:51-53`
**Issue:** The test "each lane has a ... parallel sibling that excludes it" asserts
`read(parallelSibling)).toContain("files('web')")`. `apps/web/vite.config.ts:51` carries that exact
string in a comment, so deleting `...files('web')` from the `exclude` array on line 53 keeps the
pin green. The same weakness applies to
`toContain('failOnFlakyTests: !!process.env.CI')` at `:322`, which a commented-out line satisfies,
and `apps/web/playwright.smoke.config.ts` is not pinned at all.
**Failure scenario:** the web exclusion is dropped during a config edit. `boundaries.test.ts`,
`import-commit.test.ts`, and `og-card.server.test.ts` then run in both `web` and `web-serial`. The
parallel copy still carries raised timeouts and a wall-clock budget under full load, which is the
pre-Phase-15 flake, and no test fails.
**Fix:** assert on behaviour. Import each parallel config and check that
`config.test.exclude` contains every `files(lane)` entry, or keep a `vitest list --filesOnly --json`
test asserting each file appears in exactly one project (that command confirmed the current state
in this review). For the Playwright configs, parse the property with the TypeScript API as
`retryFindings` already does for `retries`.

### WR-06 (WARNING): The annotation check accepts text that says the opposite, and comments that belong elsewhere

**File:** `scripts/lib/test-lane-rules.mjs:30-32`, `:281-294`, `:301-305`, `:316-328`
**Issue:** Reproduced as accepted:

- `// not measured; 60 s is a guess, cause unknown` (the pattern needs only the word "measured",
  a number with a unit on that line, and the word "cause")
- an annotation separated from the statement by a blank line and an unrelated comment
  (`getLeadingCommentRanges` returns every comment in the leading trivia, so for the first
  statement of a block that is everything back to the `{`)
- a raise through identifier `T` where a different `const T` in another function carries the
  comment (`declarationOf` returns the first declaration of that name anywhere in the file, with
  no scope check)

**Failure scenario:** two helpers each declare `const TIMEOUT_MS`. Annotating the small one
satisfies the guard for the large one.
**Fix:** use only the last contiguous comment block directly above the node. Require the
`Timeout: measured <n> <unit>` and `Cause:` labels the phase already uses, and reject
`\b(not|un)\s*measured`. Resolve the identifier to the nearest enclosing declaration, and report
when a name is declared more than once.

### WR-07 (WARNING): Worker counts are pinned, not capped, so smaller machines are oversubscribed

**File:** `tooling/vitest/lanes.ts:129`; `apps/web/playwright.config.ts:31`; `apps/web/playwright.smoke.config.ts:22`
**Issue:** `MAX_WORKERS = process.env.CI ? 3 : 8` and `workers: process.env.CI ? 2 : 4` are the
values measured on one 16-CPU machine. Off CI they apply to any machine. On a 4-core or 8-core
laptop this raises concurrency above the old defaults (Vitest `cpus - 1`, Playwright half the
cores). The config's own comment records six 30 s timeouts at 8 workers on 16 CPUs, a ratio of 0.5;
4 workers on 4 cores is a ratio of 1.0. The Vitest browser pool takes the same constant separately
(`getThreadsCount` reads the project's `maxWorkers`), so group 0 can run 8 forks plus 8 Chromium
tabs.
**Failure scenario:** a contributor on an 8-core machine runs `pnpm test:unit` with 16 concurrent
workers and sees the load timeouts this phase removed.
**Fix:**
```ts
import { availableParallelism } from 'node:os';
export const MAX_WORKERS = process.env.CI ? 3 : Math.max(1, Math.min(8, availableParallelism() >> 1));
```
and `workers: process.env.CI ? 2 : Math.max(1, Math.min(4, availableParallelism() >> 2))`, with the
pin tests in `test-lanes.test.ts:294` and `runbook.test.ts` updated to match.

### WR-08 (WARNING): The `VITEST_MAX_WORKERS` refusal exists only in the root config

**File:** `vitest.config.ts:6-10`; `packages/core/vitest.serial.config.ts:6`, `apps/web/vitest.serial.config.ts:6`, `apps/web/vitest.browser-serial.config.ts:7`, `scripts/vitest.serial.config.ts:6`
**Issue:** The fail-closed throw runs only when the root config loads. The serial configs do not
import it, and Vitest applies the variable in every config resolution
(`coverage.DM_a_rWm.js:380`). `vitest run --config scripts/vitest.serial.config.ts` with
`VITEST_MAX_WORKERS=4` therefore runs the serial files concurrently with no error. This path was
read from source, not executed.
**Failure scenario:** someone reruns one serial lane directly from its config in a shell that
exports the variable, and the timing tests fail for the reason the lane was built to remove.
**Fix:** move the check into `serialTest()` in `tooling/vitest/lanes.ts`, so every serial config
refuses to load, and keep the root check.

### WR-09 (WARNING): `test-evidence.test.ts` hard-codes one machine's row shapes against "the newest" file

**File:** `scripts/test-evidence.test.ts:102`, `:170-175`
**Issue:** The test always reads the newest `docs/test-evidence/YYYY-MM-DD.md`. Two planted
negatives locate the pressure row with `/^\| 12\s+\| 16\s+\|/`, and `dropLine` throws when nothing
matches. `checkEvidence` also needs an absolute `>= 12` burner threads (`:102`).
**Failure scenario:** the next evidence file is recorded on a machine with a different CPU count,
or at a different pressure level. The planted-negative tests throw `no line matches ...`, and on a
machine with fewer than 12 logical CPUs the main check can only pass with more burners than CPUs.
A correct new evidence file breaks `pnpm test:unit`.
**Fix:** derive the row from the document (first data row of the section 3 table) instead of
literal `12` / `16`, and express the threshold only as the 75%-of-CPUs ratio already in the
condition.

## Info

### IN-01: `LOAD_SENSITIVE_VITEST` is exported and never used

**File:** `tooling/vitest/lanes.ts:147-153`
**Issue:** No file imports it. Its comment says "All sit in the serial lane", which nothing checks.
**Fix:** delete it, or assert in `test-lanes.test.ts` that each entry resolves to `serial: true`
through `laneOf`.

### IN-02: The `.toPass()` allowlist is a per-file count

**File:** `scripts/lib/test-lane-rules.mjs:35-38`, `:782-789`
**Issue:** `calls.slice(allowed)` exempts the first N calls in the file. Removing the justified
call and adding a new one elsewhere in `buybox.spec.ts` or `demo.spec.ts` passes.
`expect(fn)['toPass']()` is also unseen (reproduced).
**Fix:** allowlist by enclosing test title, and match element-access calls too.

### IN-03: `SystemRoot` is read case-sensitively while `PATH` is not

**File:** `scripts/lib/windows-path.mjs:19-20`
**Issue:** The PATH key is found case-insensitively for plain-object envs, but `env.SystemRoot` is
a direct read. A copied env that spells it `SYSTEMROOT` falls back to `C:\Windows`, which is wrong
only when Windows is installed elsewhere. `process.env` itself is unaffected. A `SystemRoot` with a
trailing backslash yields `C:\Windows\\System32`, which does not equal an existing entry, so a
duplicate is prepended (harmless).
**Fix:** look the key up as PATH is, and strip a trailing separator before joining.

### IN-04: `cpu-burn.mjs` reports the requested thread count, not the running one

**File:** `scripts/cpu-burn.mjs:80-86`, `:108`
**Issue:** The start line prints `args.threads` right after constructing the workers. No `error`
or `exit` listener exists, so a worker that dies takes the process down with an unhandled error
rather than a `cpu-burn:` line. The entry check compares `import.meta.url` with
`pathToFileURL(process.argv[1])`; if the two ever differ (a symlinked checkout, not verified here)
the script exits 0 without burning or printing. Case differences were tested and work.
**Fix:** wait for each worker's `online` event before printing, attach `error` handlers that print
and exit non-zero, and compare `realpathSync` of both paths.

### IN-05: `lane-order.test.ts` reads the log before checking the exit status

**File:** `scripts/lane-order.test.ts:76`
**Issue:** `run()` calls `readFileSync(log)` unconditionally. If the child Vitest fails before any
fixture writes, the test dies with `ENOENT` and the captured output, which holds the real reason,
is never shown.
**Fix:** return empty lanes when the log is missing, so `expect(r.status, r.out).toBe(0)` reports
the output.

### IN-06: `process.env.CI` is tested for truthiness

**File:** `tooling/vitest/lanes.ts:129`; `apps/web/playwright.config.ts:26-27,31`; `apps/extension/playwright.config.ts:21-22`
**Issue:** `CI=false` or `CI=0` selects the CI branch (1 retry, the flaky gate, CI worker counts).
This is consistent across the files and with Playwright convention, so it is noted only.
**Fix:** none required.

### IN-07: The `scripts` serial lane has no padding check

**File:** `scripts/test-lanes.test.ts:191-206`
**Issue:** Test C pins the size of the `core`, `web`, and `web-browser` lanes to the files with a
real timing or raise site. `scripts` is excluded, so any scripts test can move into
`SERIAL.scripts`, where the elapsed-time rule is off and the 60 s project timeout applies, with
only a `reason` longer than 10 characters.
**Fix:** pin the `scripts` list by name, or require each `reason` to carry a measured duration.

---

_Reviewed: 2026-11-11T03:20:48Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
