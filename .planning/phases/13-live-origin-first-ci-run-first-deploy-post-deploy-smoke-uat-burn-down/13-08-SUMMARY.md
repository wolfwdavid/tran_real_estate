---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 08
subsystem: docs
tags: [runbook, github-pages, live-smoke, playwright, launch-proof, gpc, dependabot, text-oracle]

# Dependency graph
requires:
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: "13-01 owner decision B (B-ignore) recorded; 13-03 live-smoke.yml with the live-smoke-traces artifact (14 days); 13-06 smoke.mjs logs propagation seconds; 13-07 seven-entry Dependabot ignore list"
  - phase: 12-go-live-readiness-local-smoke-suite
    provides: "scripts/smoke.mjs exit codes 0-4, apps/web/tests/smoke/env.js URL gate, fixtures.ts GPC pattern, scripts/smoke-readonly.test.ts guard"
provides:
  - "docs/RUNBOOK.md (LIVE-09, D-21): variables, redeploy, roll back, read a live-smoke result, run the suites locally, fresh-profile rule, Dependabot policy, synthetic pageviews, launch proof screenshots, first deploy facts placeholder"
  - "scripts/runbook.test.ts: 23-test oracle pinning heading order and reading the smoke worker line and budget, the live-smoke artifact name and retention, the smoke.mjs exit-code wording and the Dependabot ignore list from the real files"
  - "apps/web/tests/smoke/proof-shots.mjs (D-20): parseProofArgs, proofPlan, checkMisses and a GPC-on Chromium main that writes five viewport screenshots and checks.json"
  - "scripts/proof-shots.test.ts: 25 browser-free tests over the argument gate, the plan and the miss wording"
  - "scripts/smoke-readonly.test.ts walks .mjs too, with a planted .mjs case and a real-file coverage assertion"
affects: [13-13 proof-shot run against the live site, 13-19 first-deploy facts appended to the runbook, 13-11 PR triage reads the Dependabot policy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Doc oracles read the numbers they pin from the real config files (smoke config, smoke.mjs header, live-smoke.yml, dependabot.yml) rather than hard-coding them, and tolerate Prettier table-cell padding with \\s* between cells"
    - "Smoke-side scripts are .mjs run directly with node, export their pure parts for the scripts Vitest project, and gate main() on import.meta.url === pathToFileURL(process.argv[1]).href so a test import never launches a browser"

key-files:
  created:
    - docs/RUNBOOK.md
    - scripts/runbook.test.ts
    - apps/web/tests/smoke/proof-shots.mjs
    - scripts/proof-shots.test.ts
  modified:
    - scripts/smoke-readonly.test.ts

key-decisions:
  - "13-08: the runbook oracle does not read ci.yml (13-09 edits it in the same wave); the deploy gate and Pages artifact facts in the runbook are owned by scripts/workflow-gate.test.ts, and retention-days: 1 is the upload-pages-artifact@v5 default, not a line in ci.yml"
  - "13-08: proof-shot expectations are JSON-serialisable objects (expectLocation {endsWith|startsWith}, expectVersionSha) so checks.json carries the expectation next to the observed value; checkMisses is exported and tested rather than inlined in main()"
  - "13-08: proof-shots.mjs exits 2 on bad arguments and 1 on a missed fact or a bundle over 5 MB, mirroring smoke.mjs's precondition-vs-failure split"

patterns-established:
  - "Owner-facing docs under docs/ get a scripts/<name>.test.ts oracle in the same commit; the oracle's non-vacuity is a cross-file read, not a literal"

requirements-completed: []

# Metrics
duration: 10min
completed: 2026-10-30
---

# Phase 13 Plan 08: Owner runbook and launch-proof screenshot script Summary

**`docs/RUNBOOK.md` gives the owner one document for redeploy, rollback (revert first; re-run with the 1-day Pages-artifact and 30-day re-run windows), reading a `live-smoke` result (artifact, `show-trace`, exit codes 0-4), the known-good worker counts, the eight variables, the fresh-profile rule, the Dependabot policy and the synthetic-pageview note, pinned by a 23-test oracle that reads its numbers from the real configs; `apps/web/tests/smoke/proof-shots.mjs` reproduces the D-20 launch-proof screenshots and HTTP facts from any deployed base URL with GPC on.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-30T13:25:43Z
- **Completed:** 2026-10-30T13:36Z
- **Tasks:** 2 (both TDD)
- **Files:** 4 created, 1 modified

## Accomplishments

- **Runbook (LIVE-09, D-21).** Eleven headings in the locked order (one `#`, ten `##`). Variables table with the eight repository variables, example values and the workflow/leg that reads each, plus the `MSYS_NO_PATHCONV=1 gh variable set` form. Redeploy = `git commit --allow-empty -m "chore: redeploy" && git push`, with the note that a `workflow_dispatch` of `ci` deploys nothing. Roll back prefers `git revert <bad-sha>` + push; the re-run alternative names "Re-run all jobs" (about 27 min, up to 30 days), the deploy-job-only re-run window (1 day, `actions/upload-pages-artifact@v5.0.0` `retention-days: 1`), the original actor's privileges and the `live-smoke` re-trigger with the old `head_sha`. Read a live-smoke result: `gh run list/view/download` commands, `live-smoke-traces` (14 days), `playwright show-trace`, a five-row exit-code table whose wording matches the `smoke.mjs` header, the skipped-run meaning, the hand dispatch command, and the CDN note (`smoke: <sha> live at <url> after <n> s`; never raise the poll). Run the suites locally: a table for Vitest, web E2E (`--workers=4` dev, 2 workers CI, retries CI 1 / local 0), smoke (`workers: process.env.CI ? 2 : 4`, 300 s budget), extension E2E (`workers: 1`) and `pnpm verify`, plus the `MSYS_NO_PATHCONV=1 BASE_PATH=/tran_real_estate` build/test/smoke triple. Fresh-profile rule with both reasons (`max-age=600`, cache-first service worker). Dependabot policy names the seven ignored majors, decision B for `@types/node`, the `pnpm audit` gate ("never merged blind") and the green-CI rule for `github-actions` PRs. Analytics: "at most one" synthetic `/` pageview per smoke run, counts are a lower bound. Launch proof screenshots: the exact command, `Sec-GPC: 1`, `checks.json`, redaction and the 5 MB cap. First deploy facts: `Recorded at go-live (plan 13-19).`
- **Runbook oracle.** `scripts/runbook.test.ts` (23 tests, 11 describes) reads `docs/RUNBOOK.md`, `apps/web/playwright.smoke.config.ts`, `scripts/smoke.mjs`, `.github/workflows/live-smoke.yml` and `.github/dependabot.yml`. It extracts the smoke `workers:` line and `globalTimeout`, the upload-artifact step's `name:` and `retention-days:`, the header phrases `precondition` / `not propagated` / `5-minute budget`, and every `dependency-name` under `ignore:`, and asserts each appears in the matching section. The First-deploy-facts test accepts the placeholder or a measured list matching `/after \d+ s/`, so 13-19 can replace the line without touching the test. Mutation sanity: changing the runbook's worker line to `? 2 : 8` fails exactly one test.
- **Proof-shot script (D-20).** `apps/web/tests/smoke/proof-shots.mjs` exports `parseProofArgs` (https, absolute, trailing slash, `--out` required, unknown flags rejected, every error named), `proofPlan` (shots `01-landing.png` .. `05-version-json.png` with only the deep route reloading; checks landing 200, `renter` 301 ending `/renter/`, `proof-not-found-13/` 404, `http://` variant 301 to an `https://` Location, `version.json` 200 with a 40-hex `version`) and `checkMisses`. `main()` runs only when invoked directly: Chromium 1280x800, `reducedMotion: 'reduce'`, `Sec-GPC: 1` on both the browser context and the API request context, the `navigator.globalPrivacyControl` init script copied from `fixtures.ts`, viewport-only screenshots, `api.get(url, { maxRedirects: 0 })`, pretty `checks.json` (`baseUrl`, `capturedAt`, per-check expectation + observed status/Location/version + `ok`/`misses`), per-file and total byte counts, exit 1 over 5 MB or on any miss, exit 2 on bad arguments.
- **Guard coverage.** `scripts/smoke-readonly.test.ts` `walk()` now matches `/\.(ts|js|mjs)$/`; a new test asserts the real walk contains `apps/web/tests/smoke/proof-shots.mjs`, and a planted `planted.mjs` with `.click(` is flagged as `interaction .click(`. The real-suite rule pass stays green with the script included (no `.click(`/`.fill(`/POST/"seed"; the only imports are `node:` builtins and a dynamic `import('playwright')`).

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Runbook oracle (RED) then docs/RUNBOOK.md (GREEN) | `4059de2` | `docs/RUNBOOK.md`, `scripts/runbook.test.ts` |
| 2 | Proof-shot script for the launch-proof bundle | `7131fd2` | `apps/web/tests/smoke/proof-shots.mjs`, `scripts/proof-shots.test.ts`, `scripts/smoke-readonly.test.ts` |

RED observed for both tasks before the GREEN edit (Task 1: ENOENT on `docs/RUNBOOK.md`; Task 2: "Cannot find module ../apps/web/tests/smoke/proof-shots.mjs"). RED and GREEN are in one commit per task so every commit is green on its own, as in 13-06.

## Files Created/Modified

- `docs/RUNBOOK.md` (created, 181 lines after Prettier) - the owner runbook; Prettier-formatted (`docs/` is Prettier-checked)
- `scripts/runbook.test.ts` (created) - the text oracle; `section()` slices by `## ` heading, `tableRows()` keys rows by their first code span and tolerates Prettier cell padding, `dependabotIgnores()` reads the npm `ignore:` block
- `apps/web/tests/smoke/proof-shots.mjs` (created) - ES module with JSDoc types, no TypeScript; `playwright` (an `apps/web` dependency) is imported dynamically inside `main()` only
- `scripts/proof-shots.test.ts` (created) - 25 tests: `parseProofArgs` (8), `proofPlan` shots (3) and checks (7), `checkMisses` (7); no browser
- `scripts/smoke-readonly.test.ts` (modified) - `.mjs` in the walk, coverage assertion, planted `.mjs` case (30 tests)

## Decisions Made

- **ci.yml is not read by the runbook oracle.** Plan 13-09 edits `ci.yml` concurrently in this wave, and the plan's `key_links` name only `playwright.smoke.config.ts`, `smoke.mjs` and `live-smoke.yml`. The runbook's `ci.yml` facts (the deploy gate requires a push on `main`; the Upload Pages artifact step) were checked against the committed HEAD version during execution and are pinned by `scripts/workflow-gate.test.ts`. `retention-days: 1` is the `actions/upload-pages-artifact@v5` input default, not a line in `ci.yml`, so it is pinned as runbook text only.
- **Expectations in `checks.json` are plain objects.** `expectLocation: { endsWith }` / `{ startsWith }` and `expectVersionSha: true` instead of regexes, so the written JSON carries the expectation beside the observed value and a reader of the proof bundle sees both.
- **`checkMisses` is exported.** The exit-1 decision is the one piece of `main()` with branching logic; exporting it makes the miss wording testable without a browser (7 tests) and leaves `main()` as plain wiring.
- **Exit codes split 2 (arguments) vs 1 (facts/size)**, mirroring `smoke.mjs` so a reader of either log reads the codes the same way.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Oracle table regexes assumed unpadded cells**
- **Found during:** Task 1 GREEN (first run after `prettier --write`)
- **Issue:** `tableRows()` and the exit-code row regex matched `| \`NAME\` |` with single spaces; Prettier pads every cell to the column width, so only the widest key (`PUBLIC_ANALYTICS_WEBSITE_ID`) matched and four tests failed on a correct document.
- **Fix:** `\s*` between the first cell and its closing `|` in both regexes.
- **Files modified:** scripts/runbook.test.ts
- **Verification:** 23/23; the `? 2 : 8` mutant still fails exactly one test
- **Committed in:** `4059de2`

**2. [Rule 2 - Missing test coverage] `checkMisses` added and tested; unknown-flag rejection added**
- **Found during:** Task 2 GREEN
- **Issue:** The plan's `main()` "exit 1 if any check misses its expected status/Location (print which)" was untestable without a browser if left inline, and `parseProofArgs` as specified silently ignored unknown flags (a typo such as `--out-dir` would have run with `--out` missing and thrown a misleading message).
- **Fix:** Exported `checkMisses(check, got)` with 7 tests; `parseProofArgs` throws `unknown argument <flag>` and `<flag> needs a value`.
- **Files modified:** apps/web/tests/smoke/proof-shots.mjs, scripts/proof-shots.test.ts
- **Verification:** 25/25 in `scripts/proof-shots.test.ts`; `node tests/smoke/proof-shots.mjs --base-url http://x/ --out y` exits 2 with the named message
- **Committed in:** `7131fd2`

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 2)
**Impact on plan:** None on scope; both tighten the planned behaviour.

## Issues Encountered

- No `python3` on this machine (the Microsoft Store alias answered); the regex fix was applied with the Edit tool instead. Nothing else.
- The parallel 13-09 executor's files never appeared in `git status` during this plan's commits; both commits staged only this plan's five files by explicit path, with `--no-verify`.

## Verification

Targeted only, per the parallel-execution rules (full `pnpm lint` / `pnpm test:unit` / builds / Playwright belong to the orchestrator and plan 13-10; the proof-shot script's first real run is plan 13-13 against the live site):

- `pnpm vitest run --project scripts scripts/runbook.test.ts` - 23/23 (RED: ENOENT before the doc existed)
- `pnpm vitest run --project scripts scripts/proof-shots.test.ts scripts/smoke-readonly.test.ts` - 55/55 (RED: module missing before the script existed)
- `pnpm exec prettier --check docs/RUNBOOK.md scripts/runbook.test.ts apps/web/tests/smoke/proof-shots.mjs scripts/proof-shots.test.ts scripts/smoke-readonly.test.ts` - clean
- `pnpm exec eslint scripts/runbook.test.ts apps/web/tests/smoke/proof-shots.mjs scripts/proof-shots.test.ts scripts/smoke-readonly.test.ts` - clean
- Direct node run of the script: bad scheme and missing slash exit 2 with named messages; `import()` of the module from node prints its three exports without launching a browser
- Acceptance greps: `grep -c "^## " docs/RUNBOOK.md` = 10; `retention-days: 1` = 1; `live-smoke-traces` = 2; `--workers=4` = 2; `at most one` = 1; `tranrealestate` = 0; `export function (parseProofArgs|proofPlan)` = 2; `\.click\(|\.fill\(|method: *'POST'|seed` in the script = 0; `Sec-GPC` = 2; `mjs` in smoke-readonly.test.ts = 6
- Mutation: runbook worker line `? 2 : 4` -> `? 2 : 8` fails `the smoke worker line and budget are the ones in playwright.smoke.config.ts` only; restored
- Both commits: `git log -1 --format=%B | grep -ciE "co-authored-by|claude|anthropic"` = 0

## Known Stubs

- `docs/RUNBOOK.md` `## First deploy facts` holds the placeholder `Recorded at go-live (plan 13-19).` by design; plan 13-19 replaces it with the measured list (the oracle accepts either form, and requires a `/after \d+ s/` propagation line in the measured form).

## Requirements

- LIVE-09 (runbook) is not ticked here: it closes in plan 13-19 when the first-deploy facts are appended. LIVE-07 is not ticked (closes with the UAT burn-down). `requirements mark-complete` was not run.

## Next Phase Readiness

- **13-13:** run `pnpm --filter web exec node tests/smoke/proof-shots.mjs --base-url https://wolfwdavid.github.io/tran_real_estate/ --out ../../docs/launch-proof/<YYYY-MM-DD>` after the go-live smoke is green; read `checks.json` `ok` flags. If Pages does not 301 the `http://` variant (Enforce HTTPS off), the `http-upgrade` miss names it.
- **13-19:** replace the `## First deploy facts` body with the measured list; keep a line matching `after <n> s` from the live-smoke log. `scripts/runbook.test.ts` needs no change.
- **13-09:** if the `ci.yml` edit changes the deploy gate wording, the runbook's Redeploy section ("the deploy gate requires a push event on `main` with `PAGES_ENABLED=true`") should be re-read; the oracle does not pin it.

## Self-Check: PASSED

- FOUND docs/RUNBOOK.md (181 lines, min 90), scripts/runbook.test.ts, apps/web/tests/smoke/proof-shots.mjs, scripts/proof-shots.test.ts, scripts/smoke-readonly.test.ts, this SUMMARY
- FOUND commits `4059de2` and `7131fd2` in `git log`
- Both task commits: `git log -1 --format=%B | grep -ciE "co-authored-by|claude|anthropic"` = 0
