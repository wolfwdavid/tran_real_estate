---
phase: 15-load-deterministic-test-lanes
plan: 05
subsystem: testing
tags: [playwright, e2e, smoke, timeouts, annotation, TEST-02]

# Dependency graph
requires:
  - phase: 15-load-deterministic-test-lanes
    provides: 15-02 rules module (playwrightTimeoutFindings, toPassFindings, MEASURED, CAUSE) used to list the work and prove zero findings
  - phase: 14-carried-debt
    provides: apps/web/test-results/e2e-report.json at 449ecc5 (4 workers, 2026-11-06), the duration source for every annotation
provides:
  - Every raised Playwright timeout and test.slow() in partition B (apps/web/tests/** minus studio-/snapshot-/agent- specs) carries a measured duration and a root cause
  - Three hoisted constants for repeated raises: MOCKED_MEMO_MS (print), FULL_FLOW_MS (demo), SWEEP_MS (sweep)
  - .tools/test-evidence/15-05-findings.txt, 15-05-values-before.txt, 15-05-values-after.txt (gitignored working evidence)
affects: [15-09 repo sweep, 15-11 evidence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Playwright raise annotation: `// Timeout: measured <n> s for \"<title>\" (<project>, 4 workers, e2e-report 449ecc5, 2026-11-06).` + `// Cause: <slow work>. <value> s keeps a <ratio>x margin.` directly above the statement, the carrying property, or the hoisted const"
    - "Shared waits inside helpers (expectDraftReady, draftMemo, seed) cite the whole duration of the slowest governing test and say so, since the report has no per-wait number"
    - "Route-walk budgets (ROUTES.length * N_000) state the computed total (44 x 4 s = 176 s) next to the measured walk"

key-files:
  created: []
  modified:
    - apps/web/tests/e2e/investor/print.spec.ts
    - apps/web/tests/e2e/investor/demo.spec.ts
    - apps/web/tests/e2e/investor/sweep.spec.ts
    - apps/web/tests/e2e/investor/memo.spec.ts
    - apps/web/tests/e2e/investor/deals.spec.ts
    - apps/web/tests/e2e/settings-a11y.spec.ts
    - apps/web/tests/e2e/settings-backup.spec.ts
    - apps/web/tests/e2e/settings-data.spec.ts
    - apps/web/tests/e2e/settings-security.spec.ts
    - apps/web/tests/e2e/app-notice-locked.spec.ts
    - apps/web/tests/e2e/backup-roundtrip.spec.ts
    - apps/web/tests/e2e/renter-outreach.spec.ts
    - apps/web/tests/e2e/renter-journey.spec.ts
    - apps/web/tests/e2e/renter-demo-credible.spec.ts
    - apps/web/tests/e2e/ai-guardrails.spec.ts
    - apps/web/tests/e2e/ai-a11y.spec.ts
    - apps/web/tests/e2e/ai-drafting.spec.ts
    - apps/web/tests/e2e/onboarding.spec.ts
    - apps/web/tests/e2e/third-party.spec.ts
    - apps/web/tests/e2e/routing.spec.ts
    - apps/web/tests/e2e/setup-rentcast.spec.ts
    - apps/web/tests/e2e/seo.spec.ts
    - apps/web/tests/e2e/sample-handoff.spec.ts
    - apps/web/tests/e2e/layout.spec.ts
    - apps/web/tests/e2e/data-status.spec.ts
    - apps/web/tests/e2e/csp.spec.ts
    - apps/web/tests/e2e/a11y-keyed.spec.ts
    - apps/web/tests/smoke/fixtures.ts

key-decisions:
  - "Helper-level waits (expectDraftReady, draftMemo, memoToPrint, seed) cite the slowest governing test's whole duration and say 'the whole test', because e2e-report.json has no per-assertion timing; the margin is stated against that whole-test number"
  - "tests/smoke/fixtures.ts keeps its existing measured install times (5.3 s live CDN, 6.7-8.3 s residential) and gains only the Cause line plus the latest live-smoke run (42292936697, 121 passed in 49.6 s); smoke:local was not run because sibling plans were active in the same tree and 14-11 recorded no per-target smoke:local totals"
  - "Only values repeated inside one file were hoisted (print 120_000 x2, demo 240_000 x2, sweep 300_000 x2); the 13 describe.configure({ timeout: 120_000 }) files each keep their own literal with a file-specific annotation, as the plan specifies"

patterns-established:
  - "Verification per group: rules-module findings == 0, grep -oE N_000 set before == after, git diff -U0 filtered to non-comment lines shows only hoists, then one commit per group"

requirements-completed: [TEST-02]

# Metrics
duration: 13min
completed: 2026-11-09
---

# Phase 15 Plan 05: Annotate raised Playwright timeouts, partition B Summary

**All 42 unannotated Playwright raises in partition B (28 spec files plus the smoke fixture) now carry a measured duration from e2e-report 449ecc5 and a concrete root cause, with the three in-file repeats hoisted to named constants and every timeout value left unchanged.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-11-09T07:46:53Z
- **Completed:** 2026-11-09T07:59:01Z (SUMMARY written after)
- **Tasks:** 2
- **Files modified:** 28

## Accomplishments

- `playwrightTimeoutFindings` + `toPassFindings` over every `apps/web/tests/**/*.ts` outside partition A: 42 findings before, 0 after (91 files scanned).
- Every annotation names the slow work visible in the test body (streamed Fixture/SSE drafts, PBKDF2 vault derivation, a 26 MB rejected upload, 44-route walks with `networkidle` or `document.fonts.ready`, axe at two widths, `page.pdf()`), not "slow CI".
- Values unchanged in 28/28 files; the two allowlisted `toPass()` loops (buybox, demo) are untouched and no new one appeared.
- `playwright test --list` exits 0 for the e2e config (2354 tests in 88 files) and the smoke config (121 tests in 10 files); `pnpm lint` (prettier + eslint) exits 0.

## Task Commits

Each task was committed atomically; Task 2 was split by group as the plan's executor rules require:

1. **Task 1: Snapshot the report, list partition-B findings, durations and value sets** - no commit (working files under `.tools/test-evidence/`, gitignored)
2. **Task 2: Annotate partition B until zero findings**
   - investor (print, demo, sweep, memo, deals) - `04c49fd` (test)
   - settings (settings-a11y, settings-backup, settings-data, settings-security, app-notice-locked, backup-roundtrip) - `246a21a` (test)
   - renter (renter-outreach, renter-journey, renter-demo-credible) - `8bc7b6b` (test)
   - ai (ai-guardrails, ai-a11y, ai-drafting) - `393fed6` (test)
   - misc (onboarding, third-party, routing, setup-rentcast, seo, sample-handoff, layout, data-status, csp, a11y-keyed) - `f6f238d` (test)
   - smoke (tests/smoke/fixtures.ts) - `cf79789` (test)

**Plan metadata:** see the final docs commit.

## Findings before

Duration source: `apps/web/test-results/e2e-report.json`, copied to `.tools/test-evidence/e2e-report-449ecc5.json` (`config.metadata.actualWorkers` = 4, `stats.startTime` 2026-11-06T21:04:48Z), flattened to `.tools/test-evidence/e2e-durations.tsv` (2353 results). Findings listed with the Task 1 one-liner into `.tools/test-evidence/15-05-findings.txt`: 42 findings in 28 files, none matching `tests/e2e/(studio|snapshot|agent)-`.

| File | Findings | Sites |
|------|----------|-------|
| investor/print.spec.ts | 4 | toBeVisible 60_000 (draftMemo); setTimeout 150_000; setTimeout 120_000 x2 |
| investor/sweep.spec.ts | 3 | toBeVisible 60_000 (seed); describe.configure 300_000 x2 |
| investor/demo.spec.ts | 3 | toBeVisible 60_000 (memoToPrint); setTimeout 240_000 x2 |
| third-party.spec.ts | 2 | setTimeout ROUTES.length * 5_000; setTimeout ROUTES.length * 4_000 |
| routing.spec.ts | 2 | setTimeout WALK_TIMEOUT x2 (const = ROUTES.length * 4_000) |
| renter-outreach.spec.ts | 2 | describe.configure 120_000; toBeVisible 20_000 |
| renter-journey.spec.ts | 2 | describe.configure 180_000; toBeVisible 20_000 |
| ai-guardrails.spec.ts | 2 | describe.configure 120_000; toBeVisible 20_000 |
| ai-a11y.spec.ts | 2 | describe.configure 120_000; toBeVisible 20_000 |
| investor/memo.spec.ts | 1 | toBeVisible 60_000 |
| investor/deals.spec.ts | 1 | test.slow() |
| settings-backup.spec.ts | 1 | setTimeout 90_000 |
| backup-roundtrip.spec.ts | 1 | setTimeout 180_000 |
| seo.spec.ts | 1 | setTimeout (APP_ROUTES.length + 1) * 6_000 |
| layout.spec.ts | 1 | setTimeout ROUTES.length * 4_000 |
| csp.spec.ts | 1 | setTimeout ROUTES.length * 4_000 |
| ai-drafting.spec.ts | 1 | toBeVisible 15_000 |
| a11y-keyed.spec.ts | 1 | describe.configure 60_000 |
| renter-demo-credible.spec.ts | 1 | describe.configure 90_000 |
| settings-a11y, settings-data, settings-security, app-notice-locked, onboarding, setup-rentcast, sample-handoff, data-status | 1 each (8) | describe.configure 120_000 |
| smoke/fixtures.ts | 1 | expect.poll timeout PRECACHE_INSTALL_TIMEOUT_MS (had "measured 6.7 to 8.3 s" but no "cause") |

Difference from the plan's `files_modified` list: none. The grep-expected set and the rules-module set are the same 28 files (27 e2e specs + `smoke/fixtures.ts`); `investor/buybox.spec.ts` is in the list only as the toPass allowlist control and needed no edit.

## Per-file annotations

Durations are the max across the root/sub projects in the report. "whole test" marks a helper-level wait annotated with its slowest governing test.

| File | Site | Measured | Value | Margin |
|------|------|----------|-------|--------|
| investor/print.spec.ts | `MOCKED_MEMO_MS = 120_000` (hoisted from 2 setTimeout) | 2.8 s notes-only, 2.2 s blocked | 120 s | 43x |
| investor/print.spec.ts | setTimeout 150_000 "ready: print view..." | 13.8 s | 150 s | 10.9x |
| investor/print.spec.ts | draftMemo toBeVisible 60_000 | 13.8 s whole test | 60 s | 4.3x |
| investor/demo.spec.ts | `FULL_FLOW_MS = 240_000` (hoisted from 2 setTimeout) | 16.0 s keyless, 14.4 s mocked | 240 s | 15x |
| investor/demo.spec.ts | memoToPrint toBeVisible 60_000 | 16.0 s whole test | 60 s | 3.7x |
| investor/sweep.spec.ts | `SWEEP_MS = 300_000` (hoisted from 2 describe.configure) | 31.9 s keyless, 21.1 s mocked | 300 s | 9.4x |
| investor/sweep.spec.ts | seed toBeVisible 60_000 | 31.9 s whole test | 60 s | 1.9x (whole test) |
| investor/memo.spec.ts | expectDraftReady toBeVisible 60_000 | 13.8 s whole test | 60 s | 4.3x |
| investor/deals.spec.ts | test.slow() | 7.1 s | 90 s (3 x 30) | 12.7x |
| settings-a11y.spec.ts | describe.configure 120_000 | 6.8 s "10. cooldown countdown" | 120 s | 17.6x |
| settings-backup.spec.ts | setTimeout 90_000 | 10.5 s "wrong files are rejected" | 90 s | 8.6x |
| settings-data.spec.ts | describe.configure 120_000 | 4.3 s "meter Near" | 120 s | 27.9x |
| settings-security.spec.ts | describe.configure 120_000 | 6.0 s "cooldown after 5 wrong passphrases" | 120 s | 20x |
| app-notice-locked.spec.ts | describe.configure 120_000 | 6.4 s "locked keys notice beats the backup reminder" | 120 s | 18.8x |
| backup-roundtrip.spec.ts | setTimeout 180_000 | 9.3 s | 180 s | 19.4x |
| renter-outreach.spec.ts | describe.configure 120_000 | 7.4 s "keyless: the sample draft streams" | 120 s | 16.2x |
| renter-outreach.spec.ts | expectDraftReady toBeVisible 20_000 | 7.4 s whole test | 20 s | 2.7x |
| renter-journey.spec.ts | describe.configure 180_000 | 9.0 s | 180 s | 20x |
| renter-journey.spec.ts | toBeVisible 20_000 | 9.0 s whole test | 20 s | 2.2x |
| renter-demo-credible.spec.ts | describe.configure 90_000 | 4.4 s "renter/listing/ (sample)" | 90 s | 20x |
| ai-guardrails.spec.ts | describe.configure 120_000 | 11.4 s "Draft history shows Draft, Reviewed..." | 120 s | 10.5x |
| ai-guardrails.spec.ts | expectDraftReady toBeVisible 20_000 | 11.4 s whole test (3 drafts) | 20 s | 5x per draft |
| ai-a11y.spec.ts | describe.configure 120_000 | 11.6 s "10. Draft history with all three statuses" | 120 s | 10.3x |
| ai-a11y.spec.ts | expectDraftReady toBeVisible 20_000 | 11.6 s whole test (3 drafts) | 20 s | 5x per draft |
| ai-drafting.spec.ts | toBeVisible 15_000 | 4.6 s whole test | 15 s | 3.3x |
| onboarding.spec.ts | describe.configure 120_000 | 2.8 s "axe tour at 375px: agent" | 120 s | 42.9x |
| third-party.spec.ts | setTimeout ROUTES.length * 5_000 | 28.0 s | 44 x 5 s = 220 s | 7.9x |
| third-party.spec.ts | setTimeout ROUTES.length * 4_000 | 7.2 s | 44 x 4 s = 176 s | 24x |
| routing.spec.ts | `WALK_TIMEOUT` const (2 setTimeout) | 14.8 s link walk, 9.4 s h1 walk | 176 s | 11.9x |
| setup-rentcast.spec.ts | describe.configure 120_000 | 2.4 s | 120 s | 50x |
| seo.spec.ts | setTimeout (APP_ROUTES.length + 1) * 6_000 | 4.7 s | 9 x 6 s = 54 s | 11.5x |
| sample-handoff.spec.ts | describe.configure 120_000 | 2.7 s | 120 s | 44x |
| layout.spec.ts | setTimeout ROUTES.length * 4_000 | 5.9 s | 176 s | 29.8x |
| data-status.spec.ts | describe.configure 120_000 | 3.6 s "live at the cap" | 120 s | 33x |
| csp.spec.ts | setTimeout ROUTES.length * 4_000 | 12.7 s | 176 s | 13.9x |
| a11y-keyed.spec.ts | describe.configure 60_000 | 3.2 s "settings/" | 60 s | 18.8x |
| smoke/fixtures.ts | `PRECACHE_INSTALL_TIMEOUT_MS` expect.poll | 8.3 s install (13-13 live), live-smoke 42292936697: 121 passed in 49.6 s | 20 s | 2.4x |

## Verification

Zero findings over partition B (timeouts + toPass), run after the last commit:

```
$ node --input-type=module -e "import {playwrightTimeoutFindings as f, toPassFindings as t} from './scripts/lib/test-lane-rules.mjs';import {execSync} from 'node:child_process';import {readFileSync} from 'node:fs';const A=/^apps\/web\/tests\/e2e\/(studio|snapshot|agent)-[^/]*\.spec\.ts$/;let n=0,files=0;for(const p of execSync('git ls-files apps/web/tests',{encoding:'utf8'}).split('\n').filter(x=>/\.ts$/.test(x)&&!A.test(x))){files++;const s=readFileSync(p,'utf8');const r=[...f(p,s),...t(p,s)];n+=r.length;for(const x of r)console.log(p+':'+x.line+' '+x.detail)}console.log('files scanned',files,'findings',n);process.exit(n?1:0)"
files scanned 91 findings 0
exit=0
```

- values unchanged: 28/28 files (`diff` of `15-05-values-before.txt` vs `15-05-values-after.txt` is empty)
- `grep -c "toPass()"` = 1 for investor/buybox.spec.ts and 1 for investor/demo.spec.ts (unchanged)
- `grep -c "Timeout: measured\|Timeout: test.slow()" apps/web/tests/e2e/investor/sweep.spec.ts` = 2
- `grep -L "Timeout: measured\|Timeout: test.slow()"` over all 28 edited files lists nothing
- Filtered diff of this plan's commits (`git diff -U0 ... | grep '^[-+]' | grep -vE '^[-+]{3}|^[-+]\s*//|^[-+]\s*\*|^[-+]\s*$'`), only constant hoisting:

```
+const FULL_FLOW_MS = 240_000;
-	test.setTimeout(240_000);
+	test.setTimeout(FULL_FLOW_MS);
-	test.setTimeout(240_000);
+	test.setTimeout(FULL_FLOW_MS);
+const MOCKED_MEMO_MS = 120_000;
-	test.setTimeout(120_000);
+	test.setTimeout(MOCKED_MEMO_MS);
-	test.setTimeout(120_000);
+	test.setTimeout(MOCKED_MEMO_MS);
+const SWEEP_MS = 300_000;
-	test.describe.configure({ mode: 'serial', timeout: 300_000 });
+	test.describe.configure({ mode: 'serial', timeout: SWEEP_MS });
-	test.describe.configure({ mode: 'serial', timeout: 300_000 });
+	test.describe.configure({ mode: 'serial', timeout: SWEEP_MS });
```

- `MSYS_NO_PATHCONV=1 corepack.cmd pnpm --filter web exec playwright test --list`: exit 0, "Total: 2354 tests in 88 files"
- `SMOKE_BASE_URL=http://127.0.0.1:4273/ SMOKE_ALLOW_HTTP=1 SMOKE_EXPECT_VERSION=<40 hex> ... playwright test --config playwright.smoke.config.ts --list`: exit 0, "Total: 121 tests in 10 files" (`parseSmokeEnv` also requires `SMOKE_EXPECT_VERSION` as a 40-hex SHA; `SMOKE_SITE_URL` and `SMOKE_ANALYTICS_HOST` are optional)
- `MSYS_NO_PATHCONV=1 corepack.cmd pnpm lint`: exit 0 (prettier --check and eslint clean)

## Decisions Made

- **Helper waits cite the whole governing test.** `expectDraftReady`, `draftMemo`, `memoToPrint` and `seed` are shared by several tests; the report has no per-assertion timing, so each comment names the slowest test that passes through the wait, says "the whole test", and states the margin against that number (for ai-a11y/ai-guardrails, where test 10 streams three drafts, the comment also derives the per-draft bound).
- **Smoke fixture: no `smoke:local` run.** The three builds exist, but 15-04/06/07/08 were executing in the same tree and 14-11-SUMMARY records no per-target `smoke:local` totals (only the live-smoke run 42292936697: 121 passed in 49.6 s). The existing comment already held the measured install times (5.3 s cold CDN, 6.7-8.3 s residential); the edit adds the `Cause` line and cites that live-smoke run.
- **Hoisting only within a file.** The 13 `describe.configure({ timeout: 120_000 })` files keep separate literals and file-specific annotations, per the plan's interfaces note; hoists were made only where one file repeats one value (print, demo, sweep).

## Deviations from Plan

None - plan executed exactly as written. The findings list matched the plan's expected `files_modified` set exactly (28 edited files; buybox needed no edit).

## Issues Encountered

- The plan's smoke `--list` hint names only `SMOKE_BASE_URL` and `SMOKE_ALLOW_HTTP`; `parseSmokeEnv` also throws without a 40-hex `SMOKE_EXPECT_VERSION`. Supplying a placeholder SHA made the parse-only `--list` run succeed.
- The repo-wide filtered diff since the branch point includes sibling plans' hoists (`AI_FLOW_MS`, `RUN_WAIT_MS`, `PACK_FLOW_MS`, ... from 15-04); the per-group filtered diffs above were taken against only this plan's files, which is what the acceptance criterion asks for.

## Known Stubs

None. Comment-only changes plus three constant hoists.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Partition B is clean for the 15-09 repo sweep; combined with 15-04 (partition A) and 15-03 (configs), `scanFile` should report 0 `unannotated-raise` for every Playwright file.
- `.tools/test-evidence/15-05-findings.txt`, `15-05-values-before.txt` and `15-05-values-after.txt` remain on disk (gitignored) for the verifier.

---
*Phase: 15-load-deterministic-test-lanes*
*Completed: 2026-11-09*

## Self-Check: PASSED

- Files: all 28 annotated test files and 15-05-SUMMARY.md exist on disk
- Commits: 04c49fd, 246a21a, 8bc7b6b, 393fed6, f6f238d, cf79789 present in git log
