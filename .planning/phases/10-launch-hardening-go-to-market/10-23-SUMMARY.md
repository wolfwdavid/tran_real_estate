---
phase: 10-launch-hardening-go-to-market
plan: 23
subsystem: launch-gate
tags: [gate, ci, launch-audit, budget, seo, flakes, a11y]
requires:
  - 10-04 (audit:deps)
  - 10-05 (build targets, configured project, ci.yml matrix)
  - 10-19 (beacon, privacy)
  - 10-21 (keyed axe, disclaimers, CSP expected pages)
  - 10-22 (launch-audit generator)
provides:
  - pnpm seo:assert / budget:assert (deploy + analytics-on builds) in verify and CI
  - scripts/audit-evidence.mjs (sharded E2E/Vitest evidence, outside test-results, merged for the audit)
  - docs/LAUNCH-AUDIT.md + docs/audit/*.txt (generated, every Summary row PASS)
  - 10-HUMAN-UAT.md (8 owner items), 10-VALIDATION.md signed off
affects:
  - orchestrator (open scheduler-lock decision; owner decision on oversize report-only pages)
tech-stack:
  added: []
  patterns:
    - "Chunked gate: each Playwright shard writes its JSON report to .tools/audit-evidence/ (gitignored), cls.json copied per shard, merged into apps/web/test-results/ right before pnpm audit:launch"
    - "Delayed screen-reader announcements check the announcer sequence and drop themselves if anything newer was announced"
    - "Timing-budget tests judge the fastest of N runs (budgets unchanged)"
key-files:
  created:
    - scripts/audit-evidence.mjs
    - scripts/audit-evidence.test.ts
    - docs/LAUNCH-AUDIT.md
    - docs/audit/a11y.txt, banned.txt, budget.txt, csp.txt, deps.txt, disclaimers.txt, pitfalls.txt, seo.txt
    - .planning/phases/10-launch-hardening-go-to-market/10-HUMAN-UAT.md
  modified:
    - package.json
    - .github/workflows/ci.yml
    - scripts/workflow-gate.test.ts
    - scripts/launch-audit.mjs, scripts/launch-audit.test.ts, scripts/lib/pitfalls-evidence.mjs
    - apps/web/src/lib/components/a11y/announcer.svelte.ts
    - apps/web/src/lib/features/renter/search/search-state.svelte.ts, search-state.test.ts, SearchPage.svelte
    - apps/web/src/lib/features/renter/search/ResultsView.browser.test.ts
    - packages/core/src/fair-housing/mutation.test.ts, packages/core/src/numbers/numbers.property.test.ts
    - scripts/precommit.test.ts, apps/web/src/lib/features/studio/boundaries.test.ts
    - .planning/phases/10-launch-hardening-go-to-market/10-CONTRACT-MAP.md, 10-VALIDATION.md, deferred-items.md
decisions:
  - "budget:assert gates apps/web/build AND apps/web/build-configured (production ships with analytics on); CI runs it on the root leg (build/) and the configured leg (build-configured/), never via matrix.build_dir"
  - "The SEO oracle runs on every CI leg with the same owner-variable env block as the CSP oracle (it needs PUBLIC_SITE_URL); workflow-gate now expects 4 env blocks; uses: count stays 7"
  - "budget:assert drops the plan's `--json apps/web/test-results/budget.json`: the directory may not exist (writeFileSync throws) and Playwright wipes it in the next verify step; the launch audit measures budgets in-process"
  - "The launch audit's Performance row needs both builds within 60 KB on every tool page, and lists every report-only page over 60 KB with measured size, overage, cause and fix; the owner decides (new Human UAT step)"
  - "The generated LAUNCH-AUDIT.md is formatted with the repo's Prettier config by the CLI (pnpm lint checks it); auditFailed accepts padded rows"
  - "renter-journey.spec.ts:43 was a real race (stale debounced filter summary replaced a newer pin-selection announcement): fixed in product code"
  - "renter-saved.spec.ts:83 left open for the orchestrator: busy-lock skip in the check-on-open scheduler is a Phase 4 concurrency design; proposed fix recorded, not applied in the gate plan"
  - "E2E evidence run at --workers=4: an external llama-server process held about 8 of 16 cores for the whole session"
metrics:
  duration: ~2 h
  completed: 2026-10-14
  tasks: 3
  files: 30
requirements: [GTM-01, GTM-02, GTM-03, GTM-04]
---

# Phase 10 Plan 23: Phase gate and launch audit Summary

Every Phase 10 oracle now runs in `pnpm verify` and on the matching CI legs. The JS budget gates both the deploy build and the analytics-on build. The full gate ran green in chunks. `docs/LAUNCH-AUDIT.md` was generated from that run and committed, with every Summary row PASS and the owner-only items DEFERRED (human). A committed tool (`scripts/audit-evidence.mjs`, unit-tested) now produces the sharded E2E evidence. Seven load-sensitive tests were root-caused. One was a real screen-reader race, fixed in product code. One scheduler race is left open for an owner/orchestrator decision.

## Commits

| Task / item | Commit | Message |
|---|---|---|
| Task 1 | 6b5ea6b | ci(10-23): SEO, budget and dependency gates in verify and CI |
| ORCH-b | a2bc256 | feat(10-23): sharded launch-audit evidence tool |
| ORCH-a + ORCH-d | 1b758af | feat(10-23): launch audit gates the analytics-on build and calls out oversize report-only pages |
| ORCH-e | 81562a8 | docs(10-23): contract map fair-rent disclaimer row names the checked result text |
| ORCH-c | 315aed7 | test(10-23): ResultsView browser test waits for the lazy map and allows for its real cost |
| ORCH-c | 2f8c5d7 | test(10-23): ReDoS budget tests judge the fastest of five runs |
| ORCH-c | b9895f4 | test(10-23): pre-commit gate suite copies one template repo and checks leaks by author |
| ORCH-c | e8d6939 | test(10-23): studio import-graph boundary tests state their real time limit |
| ORCH-c | 0ad7c49 | fix(10-23): a pending filter summary never overwrites a newer screen-reader announcement |
| ORCH-d | 7005f19 | docs(10-23): oversize report-only notes name the measured chunks |
| Task 2 (fix) | 6f5319d | fix(10-23): launch audit writes a Prettier-clean document and reads it back |
| Task 2 | 02cf740 | docs(10-23): launch audit |
| Task 3 | 0c76bab | docs(10-23): human UAT record and validation sign-off |

## Gate results (real output, chunked equivalent of `pnpm verify`)

A single `pnpm verify` takes well over the 7-minute per-call cap (`pnpm check` alone took about 5 minutes in the first run, and E2E takes about 40 minutes). So I ran the same steps in the same order, one or a few per call:

| Step | Result |
|---|---|
| `pnpm check` | svelte-check: 2747 files, 0 errors, 0 warnings. Re-run after the last product change: same result. |
| `pnpm lint` | Prettier: "All matched files use Prettier code style!" ESLint: exit 0. Final run after all commits: exit 0. |
| `pnpm banned` / `pnpm ui:guard` | Banned terms passed (446 files). UI class guard passed (79 files). |
| `pnpm test:unit` | Final single invocation: **321 files, 6291 tests passed** (101 s). The audit's vitest.json came from per-project shards (scripts 656, core 2701, brand 29, web 2646, web-browser 258 = **6290 passed**, 0 failed). The new formatted-doc test is the 6291st. |
| `pnpm build:root` / `build:sub` / `build:configured` | All exit 0 (36 s, then 65 s for sub + configured). |
| `pnpm csp:assert` | "CSP assertion passed for 45 pages" on build, build-sub and build-configured (analytics host http://127.0.0.1:4275). |
| `pnpm seo:assert` | "SEO assertion passed for 44 pages, 14 sitemap URLs, 6 share cards" on all three builds. |
| `pnpm budget:assert` | build: 5 gated routes within 60 KB, 9 reported. build-configured: 5 gated routes within 60 KB, 9 reported. |
| `pnpm test:e2e` (23 shards) | Merged: **2331 tests, 2327 passed, 0 failed, 4 skipped**. The skips are perf.spec on sub, by design. No test ran in more than one shard. The configured project had 41 passed. |
| `pnpm audit:deps` | exit 0. 1 low advisory ignored, recorded in audit-exceptions. |
| `pnpm guard` / `fixtures:check` | Real-data guard passed (1751 files). Fixtures match (6 files). |
| `pnpm secrets:canary` / `secrets:scan` | Canary detected as expected. History scan of 14.70 MB found no leaks. |
| `pnpm lint:workflows` | actionlint exit 0. |
| `pnpm audit:launch` | "Launch audit: every Summary row PASS". |

Per-route budget, initial JS in KB gzip -9, shown as build / build-configured:

| Route | build | build-configured |
|---|---|---|
| tools/ | 51.1 | 51.3 |
| affordability | 58.7 | 58.8 |
| cap-rate | 58.5 | 58.7 |
| cash-on-cash | 58.7 | 58.9 |
| dscr | 58.7 | 58.8 |
| landing (report) | 57.7 | 57.9 |

Landing CLS was 0.011 / 0.011 / 0.000 / 0.000 for 375 first-visit, 375 returning, 1280 first-visit and 1280 returning.

### Launch audit Summary (docs/LAUNCH-AUDIT.md)

| # | Check | Command | Result | Evidence |
|---|---|---|---|---|
| 1 | axe (keyless) | `pnpm test:e2e` | PASS | docs/audit/a11y.txt |
| 2 | axe (mocked key) | `pnpm test:e2e` | PASS | docs/audit/a11y.txt |
| 3 | CSP review | `pnpm csp:assert` | PASS | docs/audit/csp.txt |
| 4 | Dependency audit | `pnpm audit --json --audit-level low` | PASS | docs/audit/deps.txt |
| 5 | Banned terms | `pnpm banned` | PASS | docs/audit/banned.txt |
| 6 | Disclaimer presence | `pnpm test:e2e disclaimers` | PASS | docs/audit/disclaimers.txt |
| 7 | Performance budget | `pnpm budget:assert` | PASS | docs/audit/budget.txt |
| 8 | Sitemap/robots/OG | `node scripts/assert-seo.mjs <build> --target <t>` | PASS | docs/audit/seo.txt |
| 9 | PITFALLS checklist | `pnpm audit:launch` | PASS | docs/audit/pitfalls.txt |

Accessibility extra states:

| State | Passed |
|---|---|
| 375px | 112/112 |
| guide/tour | 26/26 |
| calculators | 24/24 |
| waitlist/feedback | 18/18 |
| setup | 6/6 |
| other axe checks | 260/260 |

The plan's Task 2 node check reports all 11 sections present and no `| FAIL |` cell. The only "FAIL" text in the document is in the status-word legend. Pages deploy is DEFERRED (human). Extension and Extension listing are N/A (Phase 11). The Human UAT section lists 10 owner steps.

## ORCH items

- **ORCH-a: budget on build-configured. DONE.**
  - `budget:assert` runs on `build` and `build-configured`.
  - CI has two budget steps: the root leg runs it on `build`, the configured leg on `build-configured`.
  - The launch audit's Performance row now FAILs if the configured build is missing, has errors, or has a tool page over 60 KB.
  - Tests for this are in `launch-audit.test.ts`.
- **ORCH-b: committed shard-merge tool. DONE.** `scripts/audit-evidence.mjs` has these commands:
  - `clean`
  - `e2e <name> [playwright args]`: writes the JSON report to `.tools/audit-evidence/e2e-<name>.json` and copies perf.spec's `cls.json`.
  - `unit <name> [vitest args]`
  - `merge`: writes `e2e-report.json`, `vitest.json` and `cls.json` into apps/web/test-results.

  It is exposed as `pnpm evidence:clean`, `evidence:e2e`, `evidence:unit` and `evidence:merge`. It has 15 unit tests, including the audit's own `e2eTests`/`a11yMatrix` run on a merged report. A mutation check that dropped later shards failed 4 tests. This run's evidence was produced with it.
  - CI wiring: its tests run in `pnpm test:unit` on every leg.
  - Not added: a CI job that runs the whole audit. Its evidence spans all three legs, and collecting it would need a new `uses:` action, which the plan forbids.
- **ORCH-c: load-sensitive tests.** Full evidence is in deferred-items.md.

  Fixed:
  - **renter-journey.spec.ts:43**: a real product race, fixed in 0ad7c49.
    - The debounced "Showing N of M rentals." summary could overwrite a newer "…, selected." announcement.
    - A unit test fails RED first.
    - The full E2E run passed after the fix.
  - **ResultsView.browser.test.ts**: two causes, both fixed.
    - The map assertion used the default 1 s poll for two chained lazy imports. A 1.5 s delay on the leaflet import reproduced it; it now passes with 1.5 s and 4 s delays.
    - The 5 s default test timeout was too tight for the paging test, which took 3.9 s under full load.
  - **mutation.test.ts and numbers.property.test.ts** (ReDoS time budgets):
    - Reproduced with 40 CPU burners: 1 of 3 runs failed, with a 153 ms scan.
    - Fix: judge the fastest of 5 runs. Budgets are unchanged.
    - 4/4 runs green under the same burners. A planted 0.0001 ms budget still fails all 76 timed cases.
  - **precommit.test.ts**:
    - The "never commits here" HEAD comparison raced with anyone else committing. It is now an author check.
    - Hook work is halved by a template repo copied per test.
    - Separately, one full-suite run failed in the hook with `VirtualAlloc failed`. That was external memory pressure: other processes held about 35 GB of private memory and only 9 GB of commit was left.
  - **studio/boundaries.test.ts**: given an explicit 30 s limit. It is a synchronous full-tree walk: 1.9 s under burners, 2.5 s under full load, against a 5 s default.

  Still open or not reproduced:
  - **OPEN: renter-saved.spec.ts:83.**
    - It failed once under 40 burners. The page still showed "Checked 1 day ago", meaning the check-on-open pass never ran.
    - A scratch probe holding the `tran-alerts` lock for 3 s during the reload made the pass skip as `busy` with no retry. Without the lock, the same flow passes.
    - Proposed fix: a bounded wait for the lock, then recompute due searches inside it. This changes Phase 4's cross-tab design, so it was not applied here. The orchestrator decides.
  - **CPU starvation only: agent-contact.spec.ts:351 and agent-followup.spec.ts:169.**
    - Both failed only as 30 s test timeouts, with 40 burners plus the external llama-server.
    - Under 16 burners: 0 failures.
  - **Not reproduced: autofill.spec.ts:195, csp.spec.ts:46, buybox.spec.ts:217.** 0 failures in about 16 runs each under burners.
- **ORCH-d: oversize report-only pages. DONE.**
  - The audit has a "Report-only pages over the tool budget" table with these sizes (build / configured, KB gz):

    | Page | build | build-configured | Over 60 KB by |
    |---|---|---|---|
    | feedback/ | 102.5 | 102.7 | 42.5 / 42.7 |
    | for-renters/ | 96.5 | 96.6 | 36.5 / 36.6 |
    | for-investors/ | 96.5 | 96.7 | 36.5 / 36.7 |
    | for-agents/ | 96.5 | 96.6 | 36.5 / 36.6 |

  - The causes are measured from the chunks, and correct the earlier notes:
    - shadcn Button: tailwind-variants 13.0 KB + tailwind-merge 8.6 KB
    - zod: 9.2 KB
    - bits-ui RadioGroup on feedback: about 3 KB
  - Recommendation: plain buttons and native radios, as the tool pages already use, plus a lazy-loaded zod or form. That covers about 31-34 KB of each overage.
  - Recorded as owner decision Human UAT test 8, plus a new audit Human UAT step. Not trimmed.
- **ORCH-e: contract map. DONE.** The fair-rent row now quotes "Estimates can be wrong. Use them as one input when you talk to the listing contact." It names RentEstimateResult.svelte and the disclaimers.spec check.

## Deviations from Plan

1. **[Rule 1] `budget:assert` without `--json apps/web/test-results/budget.json`.**
   - `writeFileSync` throws when the directory is missing (fresh clone).
   - Playwright wipes that directory in the next verify step anyway.
   - Nothing reads the file.
2. **[ORCH-a] The budget gate covers the analytics-on build too.**
   - CI has two budget steps (root, configured) instead of the plan's one on root.
   - verify runs both builds.
3. **[Rule 3] Two launch-audit fixes so the committed doc passes `pnpm lint`.**
   - The CLI formats the doc with Prettier.
   - `auditFailed` failed closed on padded rows; it now reads them (6f5319d).
4. **[Rule 3] The 10-VALIDATION legend line was reworded** ("⬜ = pending") because the plan's own check (`/⬜ pending/`) matched the legend. "Feedback latency < 10s" stays unchecked and is marked not met but accepted, same as Phases 1-2. Ticking it would be false.
5. **Plan Task 2 step 1 ("one invocation of `pnpm verify`").**
   - Not possible under the 7-minute per-call cap. It was run in chunks with the same steps and order.
   - Two environment-only re-runs, both caused by external load from processes that are not mine (llama-server, about 8 cores; python processes about 19 GB), and I did not touch them:
     - The first E2E shard ran at 8 workers and got 6 × 30 s timeouts. Re-run at 4 workers: green.
     - The first single-invocation unit run hit `VirtualAlloc failed`. The final single invocation was green.
   - Marked ⚠️ in 10-VALIDATION row 10-23-02.
6. **10-HUMAN-UAT.md has 8 tests instead of 7.** Test 8 is the ORCH-d owner decision on oversize pages.
7. **ORCH-c partly open.** renter-saved.spec.ts:83 needs a scheduler design decision (see above).

## Known Stubs

None. The audit's Sign-off lines (Audited by / Date / Notes) are blank on purpose for the owner.

## Notes for the orchestrator

- STATE/ROADMAP/REQUIREMENTS not touched (per executor rules). Requirements: GTM-01, GTM-02, GTM-03, GTM-04.
- DEPLOY-CHECKLIST Step 8.1.3/8.7 say to record owner results "in docs/LAUNCH-AUDIT.md, section Human UAT". That file is generated and must not be hand-edited, so record them in 10-HUMAN-UAT.md, which the checklist also names. A one-line checklist fix is suggested.
- `.tools/audit-evidence/` (gitignored) still holds this run's shard reports. `pnpm evidence:merge && pnpm audit:launch` regenerates the audit from them.

## Self-Check: PASSED

- FOUND: scripts/audit-evidence.mjs, scripts/audit-evidence.test.ts, docs/LAUNCH-AUDIT.md, docs/audit/{a11y,banned,budget,csp,deps,disclaimers,pitfalls,seo}.txt, 10-HUMAN-UAT.md
- FOUND commits: 6b5ea6b, a2bc256, 1b758af, 81562a8, 315aed7, 2f8c5d7, b9895f4, e8d6939, 0ad7c49, 7005f19, 6f5319d, 02cf740, 0c76bab
