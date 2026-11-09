---
phase: 15-load-deterministic-test-lanes
plan: 03
subsystem: testing
tags: [playwright, flake-policy, failOnFlakyTests, workers, ci, workflow-gate]

# Dependency graph
requires:
  - phase: 11-browser-extension
    provides: apps/extension/playwright.config.ts and the 7-test production-extension E2E this plan measures
  - phase: 14-launch-hardening
    provides: known-good dev worker count 4 for the web E2E (14-07, 14-11)
provides:
  - TEST-03 retry policy documented in both Playwright configs; failOnFlakyTests in CI; --fail-on-flaky-tests on the ci.yml E2E line, pinned by workflow-gate.test.ts
  - Web E2E workers pinned to CI 2 / dev 4 (Playwright half of TEST-04)
  - Extension 60 s timeout annotated with a measured number and a cause (satisfies the 15-02 MEASURED and CAUSE regexes)
  - Extension E2E per-test durations, 2 runs (read by 15-04 to annotate apps/extension/e2e/extension.spec.ts)
affects: [15-04, 15-07, 15-08, 15-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flake policy: retries CI 1 / local 0 exist only to classify a failure; failOnFlakyTests (config) plus --fail-on-flaky-tests (CLI, overrides config) make a pass-on-retry fail the job"
    - "Worker counts are pinned to recorded known-good values with the evidence in the comment, never left to os.cpus()"
    - "Timeout raises carry 'measured <n> s' and 'Cause:' in the comment directly above the value"

key-files:
  created: []
  modified:
    - apps/web/playwright.config.ts
    - apps/extension/playwright.config.ts
    - .github/workflows/ci.yml
    - scripts/workflow-gate.test.ts

key-decisions:
  - "Pin the flaky flag by counting run: lines that carry it (exactly one) rather than raw substring count, because the plan's own comment line above the step also contains the flag"
  - "Extension comments describe the real launch shape (one persistent context in beforeAll for a serial describe), not the plan's 'every test launches its own context' wording, which the spec contradicts"

patterns-established:
  - "Mutation proof for workflow pins: strip the string from ci.yml, run workflow-gate.test.ts (red), restore (green); record in the SUMMARY"

requirements-completed: [TEST-03, TEST-04]

# Metrics
duration: 10min
completed: 2026-11-09
---

# Phase 15 Plan 03: Playwright flake policy and worker caps Summary

**CI can no longer turn a red E2E green through a retry: `--fail-on-flaky-tests` on the ci.yml E2E line plus `failOnFlakyTests: !!process.env.CI` in both Playwright configs, with the retry policy written down next to the values, web workers pinned to CI 2 / dev 4, and the extension's 60 s timeout annotated from two fresh measured runs.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-11-09T06:44:30Z
- **Completed:** 2026-11-09T06:54:52Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `apps/web/playwright.config.ts`: TEST-03 retry-policy comment, `retries: process.env.CI ? 1 : 0` (value unchanged), `failOnFlakyTests: !!process.env.CI`, and `workers: process.env.CI ? 2 : 4` with the evidence (CI run 42289609809 at 2 workers; dev green at 4, six 30 s timeouts at 8 in 10-23). The Windows PATH block (lines 4-15, owned by 15-07) was not touched.
- `apps/extension/playwright.config.ts`: same policy comment, `failOnFlakyTests: !!process.env.CI`, `workers: 1` kept with a one-worker rationale, and `timeout: 60_000` kept with a comment carrying `measured 0.447 s` and `Cause:`. Both 15-02 regexes (`MEASURED`, `CAUSE`) match; no `<max>`/`<title>`/`<date>` placeholders remain.
- `.github/workflows/ci.yml`: the E2E + axe step runs `playwright test --project=${{ matrix.target }} --fail-on-flaky-tests`, with a one-line comment above the step. Diff is exactly 2 insertions / 1 deletion; `run: pnpm test:unit` byte-identical (1 occurrence); `uses:` lines still 7; actionlint green.
- `scripts/workflow-gate.test.ts`: new test `E2E fails on a test that passes only on retry (TEST-03)` pins the full run line, that exactly one `run:` line carries the flag, that the flag appears twice in the quality job (comment + run line), and that `run: pnpm test:unit` appears once. 39/39 tests pass.

## Task Commits

1. **Task 1: Retry policy, failOnFlakyTests and worker caps in both Playwright configs; measure and annotate the extension timeout** - `ef6cde5` (feat)
2. **Task 2: --fail-on-flaky-tests on the CI E2E line, pinned by workflow-gate.test.ts** - `e7113a9` (test)

## Files Created/Modified

- `apps/web/playwright.config.ts` - policy comment, failOnFlakyTests, pinned workers CI 2 / dev 4
- `apps/extension/playwright.config.ts` - policy comment, failOnFlakyTests, one-worker rationale, measured timeout annotation
- `.github/workflows/ci.yml` - `--fail-on-flaky-tests` on the E2E run line plus its comment
- `scripts/workflow-gate.test.ts` - TEST-03 pin

## Extension E2E durations

Measured with `pnpm ext:build` (fresh `wxt zip`, 3.5 s) then `pnpm --filter extension exec playwright test --reporter=list`, 1 worker, headless Chromium, Windows 11 dev machine (16 logical CPUs), 2026-11-09. Titles are from `apps/extension/e2e/extension.spec.ts` (describe `production extension in Chromium`, serial).

| # | Test (spec line) | Run 1 | Run 2 |
|---|---|---|---|
| 1 | dims sponsored cards with a reveal pill (:124) | 177 ms | 151 ms |
| 2 | reveal is one click and does not navigate (:144) | **447 ms** | 250 ms |
| 3 | late-inserted card is dimmed (:157) | 211 ms | 219 ms |
| 4 | SPA navigation re-acquires the container (:172) | 238 ms | 242 ms |
| 5 | content script answers the count message and the badge shows it (:196) | 16 ms | 13 ms |
| 6 | popup renders under CSP and the toggle restores the page (:216) | 352 ms | 282 ms |
| 7 | zero network requests from the extension (:248) | 10 ms | 13 ms |
| | Whole suite (includes the single `beforeAll` launch) | 3.6 s | 2.4 s |

- `<max>` = **0.447 s** (test 2, run 1). `60 / 0.447` = 134x margin, written into the config comment.
- The per-test `timeout` also bounds each hook. The `beforeAll` hook, not any test, is what the 60 s protects: `launchPersistentContext` + `waitForEvent('serviceworker', { timeout: 15_000 })`, and off CI a missing worker triggers a second, headed launch with another 15 s wait.
- Verification run after the config edit (`pnpm ext:e2e`): 7 passed in 2.8 s (test 6 at 318 ms, test 7 at 16 ms).

## Mutation note (Task 2)

Removed ` --fail-on-flaky-tests` from the ci.yml run line -> `pnpm vitest run --project scripts scripts/workflow-gate.test.ts`: 1 failed (`E2E fails on a test that passes only on retry (TEST-03)`), 38 passed. Restored the line -> 39 passed. The ci.yml diff after restore is unchanged (2 insertions, 1 deletion).

## Decisions Made

- **Flag pin counts `run:` lines, not raw substrings.** The plan's test template asserted `count(quality, '--fail-on-flaky-tests') === 1` while also instructing a comment line containing the flag above the step (its own acceptance criterion expects `grep -c` = 2). The intent, "exactly one run line carries the flag", is pinned with `quality.match(/^ +run: .*--fail-on-flaky-tests.*$/gm)` having length 1, and the substring count is pinned at 2 so a dropped comment or a second run line both fail.
- **Extension comments match the spec, not the template.** The plan's suggested wording ("every test launches its own persistent Chromium context") is contradicted by `extension.spec.ts`, which launches one context in `beforeAll` for a serial describe. Research Pitfall 5 is exactly "a comment that is factually wrong", so the one-worker and timeout comments describe the real shape while still carrying the measured number, the cause and the margin the plan asked for. The `60_000` value is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's test assertion contradicted the plan's own ci.yml edit**
- **Found during:** Task 2
- **Issue:** `expect(count(quality, '--fail-on-flaky-tests')).toBe(1)` fails (actual 2) once the plan's required comment line is present.
- **Fix:** Pin exactly one `run:` line carrying the flag and a substring count of 2; all other assertions kept verbatim.
- **Files modified:** scripts/workflow-gate.test.ts
- **Verification:** 39/39 green; mutation (flag removed) turns only the new test red.
- **Committed in:** e7113a9

**2. [Rule 1 - Bug] Plan's extension comment text was factually wrong**
- **Found during:** Task 1 (read_first: apps/extension/e2e/extension.spec.ts)
- **Issue:** The template said each test launches its own persistent context; the spec launches one in `beforeAll`.
- **Fix:** Rewrote the one-worker and timeout comments to the real launch shape, keeping `measured <n> s`, `Cause:` and the margin.
- **Files modified:** apps/extension/playwright.config.ts
- **Verification:** 15-02 regexes match (`MEASURED true CAUSE true`), placeholders absent, `pnpm ext:e2e` green.
- **Committed in:** ef6cde5

---

**Total deviations:** 2 auto-fixed (2 bugs in the plan's literal text; no scope change)
**Impact on plan:** Both fixes keep the plan's must-haves intact and make the artifacts truthful. No scope creep.

## Issues Encountered

- `pnpm lint` (repo-wide) exited 2 with `ENOENT ... apps/web/vitest.browser.serial.config.ts`: sibling plan 15-01 renamed its uncommitted serial config to `vitest.browser-serial.config.ts` while ESLint was walking the tree. Not caused by this plan's files. Lint was run on this plan's four files directly instead: `prettier --check` and `eslint` both exit 0 for `apps/web/playwright.config.ts`, `apps/extension/playwright.config.ts`, `scripts/workflow-gate.test.ts`. The orchestrator's post-wave hook validation covers the full tree.
- `pnpm check` exit 0 (web 3271 files, extension 1077 files, 0 errors). The `vite.config.ts` extension-less import warning it printed belongs to 15-01's in-flight edit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 15-04 can read the durations table above to annotate `apps/extension/e2e/extension.spec.ts`.
- 15-07 owns the RUNBOOK worker table and `scripts/runbook.test.ts` (dev E2E workers now 4 by config, CI 2) and the Windows PATH blocks in both configs; nothing in those regions was touched here.
- 15-08's `scripts/flaky-gate.test.ts` provides the behavioural proof that a pass-on-retry exits non-zero; 15-11 observes it in the CI log. Nothing was pushed.

---
*Phase: 15-load-deterministic-test-lanes*
*Completed: 2026-11-09*

## Self-Check: PASSED

- 5/5 files present on disk; commits ef6cde5 and e7113a9 present in history.
