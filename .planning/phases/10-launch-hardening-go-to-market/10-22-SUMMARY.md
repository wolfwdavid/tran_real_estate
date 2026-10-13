---
phase: 10-launch-hardening-go-to-market
plan: 22
subsystem: launch-audit
tags: [audit, pitfalls, gates, tooling]
requires:
  - 10-04 (audit-exceptions, audit:deps)
  - 10-05 (build-targets, configured E2E project)
  - 10-09 (assert-seo checkSeo, assert-budget checkBudget)
provides:
  - scripts/launch-audit.mjs (collect, renderAudit, a11yMatrix, parsePitfallsChecklist, auditFailed, evidenceFiles, CLI --write)
  - scripts/lib/pitfalls-evidence.mjs (PITFALLS_EVIDENCE, HUMAN_UAT)
  - pnpm audit:launch
affects:
  - 10-23 (runs audit:launch for real and commits docs/LAUNCH-AUDIT.md + docs/audit/*.txt)
  - 10-11..10-21 (register gates via COMMAND_GATES / PITFALLS_EVIDENCE / EXTRA_A11Y; the titles they emit are what the audit matches)
tech-stack:
  added: []
  patterns:
    - "Pure renderer over collected data: every status derived from oracle return values, exit codes or JSON reports; missing report / unmatched test / skipped-only match / non-zero exit = FAIL"
    - "Data-driven registries: COMMAND_GATES, EXTRA_A11Y, PERF_ROUTES in launch-audit.mjs; PITFALLS_EVIDENCE + HUMAN_UAT in lib/pitfalls-evidence.mjs"
key-files:
  created:
    - scripts/launch-audit.mjs
    - scripts/launch-audit.test.ts
    - scripts/lib/pitfalls-evidence.mjs
  modified:
    - package.json
decisions:
  - "Evidence matching: 'unit'/'e2e' match is a substring of '<test file> > <describe...> > <title>' (Vitest paths slash-normalized, Playwright spec-relative), so a row can name a test file or a test title; 'command' names a COMMAND_GATES id"
  - "A pitfall with kind 'auto' plus a `human` step prints its automated status and links the numbered Human UAT step (BYOK, Storage persistence, Secrets); 'Pages deploy' is DEFERRED (human); Extension + Extension listing are N/A (Phase 11)"
  - "The Accessibility matrix uses only the exact keyless/keyed axe titles on projects root/sub; a missing cell is FAIL (not run). The 'axe (keyless)' Summary row also requires the extra-state groups (375px, guide/tour, calculators, waitlist/feedback forms, setup) to have >= 1 passing axe test each"
  - "Landing is measured against the same 60 KB budget and its CLS rows (cls.json, every row < 0.1) are required; a missing cls.json or an unbuilt tools/calculator page fails the Performance row"
  - "The CLI exits 1 whenever any Summary row is FAIL (with or without --write); with --write the document is still written so the failure is visible"
  - "Disclaimer 'Required text' is parsed from DISCLAIMER_CHECKS in apps/web/tests/e2e/disclaimers.spec.ts (10-21) when it exists; otherwise the row points at that spec"
  - "PITFALLS.md currently has 17 checklist lines (plan text said 16); all 17 have evidence"
metrics:
  duration: ~25 min
  completed: 2026-10-13
  tasks: 2
  files: 4
requirements: [GTM-01, GTM-02, GTM-03, GTM-04]
---

# Phase 10 Plan 22: Launch audit generator Summary

`pnpm audit:launch` regenerates `docs/LAUNCH-AUDIT.md` (11 UI-SPEC sections, status words PASS / FAIL / N/A / DEFERRED (human) only) plus raw `docs/audit/*.txt` evidence. Every status comes from real results: CSP/SEO/budget/banned oracles run in-process, command gates are spawned for their exit codes, and the Playwright, Vitest and CLS JSON reports are parsed. All 17 PITFALLS "Looks Done But Isn't" lines are reproduced verbatim, each with its evidence.

## What was built

- **scripts/lib/pitfalls-evidence.mjs**: `PITFALLS_EVIDENCE` maps each checklist label to `auto` (real test files and titles from Phases 3-9, plus command gates), `human` or `na`. `HUMAN_UAT` lists the 9 owner steps: Umami delivery with GPC and no stored IPs, Web3Forms end to end with captcha off, contact email, share-card debugger, Search Console sitemap, Pages deep-link refresh, provider key tests from the deployed URL, Safari persistence, and secret scanning with push protection.
- **scripts/launch-audit.mjs**:
  - `parsePitfallsChecklist`, `pitfallLabel`, `uncoveredPitfalls`, `evidenceMapErrors`
  - `e2eTests` / `unitTests` report normalizers, `evaluateEvidence`, `pitfallRows`
  - `a11yMatrix` (route × keyless/keyed × root/sub, with violation rule lines pulled from the axe assertion message, plus extra-state groups)
  - `disclaimerRows`, `perfRows`, `cspStatus`, `summaryRows`, `renderAudit`, `auditFailed`, `evidenceFiles`
  - `collect({ root })` and the CLI
- **package.json**: `"audit:launch": "node scripts/launch-audit.mjs --write"`.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 RED | 388998e | test(10-22): add failing PITFALLS coverage tests |
| 1 GREEN | 5c5411c | feat(10-22): PITFALLS evidence map |
| 2 RED | 830d99a | test(10-22): add failing launch audit renderer tests |
| 2 GREEN | d8de263 | feat(10-22): launch audit generator |

## Verification (real output)

- RED 1: `vitest run --project scripts launch-audit`: `Test Files 1 failed`, module missing.
- GREEN 1: `Tests 10 passed (10)`.
- RED 2: `Tests 15 failed | 10 passed (25)`.
- GREEN 2: `Tests 25 passed (25)`.
- Plan verification: `corepack pnpm vitest run --project scripts` gave `Test Files 19 passed (19)`, `Tests 633 passed (633)`. `corepack pnpm lint` passed (Prettier reported "All matched files use Prettier code style!" and ESLint exited 0).
- Non-vacuity is covered by tests. Each of the following is reported or renders FAIL:
  - a fake `**Brand new:**` line
  - a stale map entry
  - malformed entries
  - a failing matched test
  - an unmatched evidence title
  - skipped-only matches
  - failing or missing command gates
  - a missing Playwright report
  - a failing keyed axe cell
  - a missing matrix cell
  - CSP errors, meta not first, or `unsafe-inline` in script-src
  - banned hits, or zero files scanned
  - SEO errors
  - a budget miss, a missing calculator page, or a missing cls.json
  - a failing disclaimer
  - a non-zero dependency audit exit
- **Smoke run** (not committed): under the build lock, `node scripts/launch-audit.mjs` (no `--write`) took 8.8 s and exited 1. CSP, dependency audit and banned terms are PASS on the current builds. Axe, disclaimers, performance, SEO and PITFALLS are FAIL. The reasons are honest:
  - no e2e, vitest or cls reports exist yet
  - the stale `apps/web/build` has no tools pages
  - SEO reports 391 faults on the pre-10-07 builds

  Guard, fixtures:check, secrets:canary and secrets:scan all exited 0. Output was kept in the scratchpad only. The lock was released right after.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The test fixture was missing a 375px axe test**
- **Found during:** Task 2 GREEN.
- **Issue:** The keyless Summary row correctly requires the existing `axe reports no WCAG A/AA violations at 375px on ...` group (a11y.spec.ts), but the green fixture had no such test.
- **Fix:** Added one 375px title to the fixture. The generator was not changed.
- **Commit:** d8de263

### Additions within scope
- Beyond the five evidence files the plan named (csp, seo, budget, banned, deps), the generator also writes `docs/audit/a11y.txt`, `disclaimers.txt` and `pitfalls.txt`. This gives every Summary row an evidence path under `docs/audit/`, as UI-SPEC requires.
- `fixtures:check` is also a command gate. The Fixtures pitfall evidence is `guard` plus `fixtures:check`.

No fake audit doc was committed. `docs/LAUNCH-AUDIT.md` is produced only by 10-23's real run.

## Notes for later plans (10-11..10-21, 10-23)

- Keyed axe tests must be titled `axe (keyed) reports no WCAG A/AA violations on "<route>"`.
- Extra-state axe tests need "axe" in the title, and the spec path or title must contain guide/tour, calculator/tools/, waitlist/feedback, or setup. Each group must have at least one passing test, or the keyless row fails.
- Disclaimer tests must be titled `disclaimer: <name>`. Exporting `DISCLAIMER_CHECKS` with `name` and `text` lets the audit print the required text.
- 10-23 must produce `apps/web/test-results/e2e-report.json` (`PLAYWRIGHT_JSON_OUTPUT_NAME`, `--reporter=json,list`), `apps/web/test-results/vitest.json` and `apps/web/test-results/cls.json` before running `pnpm audit:launch`.
- Each evidence row in `PITFALLS_EVIDENCE` names a real current test file or title. If a test is renamed, that pitfall renders FAIL ("no matching test"), never PASS.

## Known Stubs

None. The Sign-off lines (`Audited by:`, `Date:`, `Notes:`) are left blank on purpose for the owner.

## Self-Check: PASSED

- FOUND: scripts/launch-audit.mjs, scripts/launch-audit.test.ts, scripts/lib/pitfalls-evidence.mjs, package.json (audit:launch)
- FOUND commits: 388998e, 5c5411c, 830d99a, d8de263
