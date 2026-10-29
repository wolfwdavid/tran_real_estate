---
phase: 10-launch-hardening-go-to-market
plan: 21
subsystem: launch-audit-evidence
tags: [a11y, axe, disclaimers, csp, e2e]
requires:
  - 10-22 (launch-audit title contracts: AXE_KEYED, EXTRA_A11Y, DISCLAIMER_PREFIX, DISCLAIMER_CHECKS parser)
  - 10-14, 10-18, 10-19, 10-20 (every Phase 10 route built and in routes.ts)
provides:
  - apps/web/tests/e2e/a11y-keyed.spec.ts (keyed axe matrix column, root + sub)
  - apps/web/tests/e2e/disclaimers.spec.ts (DISCLAIMER_CHECKS + `disclaimer: <name>` tests)
  - scripts/assert-csp.mjs EXPECTED_PAGES with the Phase 10 pages and SEO files
affects:
  - 10-23 (final E2E invocation + pnpm audit:launch consume these titles)
tech-stack:
  added: []
  patterns:
    - "Keyed state = fake keys in the vault session store (support/seed.ts format) + one due saved search seeded from the agent CRM; provider hosts abort-and-record over the deny-all harness"
    - "Disclaimer checks as flat object literals so launch-audit.mjs can parse the required text from source"
key-files:
  created:
    - apps/web/tests/e2e/a11y-keyed.spec.ts
    - apps/web/tests/e2e/disclaimers.spec.ts
  modified:
    - scripts/assert-csp.mjs
    - scripts/assert-csp.test.ts
decisions:
  - "Keys are seeded straight into the vault session store (tran.vault.session.v1, same format as 06-09 withRentCastKey) instead of typing five keys into Settings per test; a dedicated test proves Settings shows 'Key ending in …' for all five providers, so the seed is a real keyed state"
  - "Provider requests are aborted and recorded (10-20 pattern), not fulfilled with '{}' as the plan text said: an empty 200 is not a valid RentCast/AI body, and aborting guarantees nothing reaches a real host"
  - "Spend-triggering data: one saved search due now. Portal routes whose layout runs check-on-open (renter/*, investor/*, settings/, setup/rentcast/, agent/studio/*) must try exactly that one rental-listings call (polled before axe, so the live state is real and settled); every other route (marketing, legal, tools, feedback, agent CRM, public, print) must try zero RentCast calls; no route may try any AI call"
  - "Footer disclaimer runs once per CHROME_ROUTE under a single audit name `disclaimer: site footer` (describe = route), so the audit prints one row with the required text and any failing route fails it; plan text suggested one name per route, which the audit could not attach required text to"
  - "Fair-rent disclaimer checked in its result state (sample data shows the estimate): 'Estimates can be wrong. Use them as one input when you talk to the listing contact.' (06-UI-SPEC). The contract map's intro sentence ('…not a professional valuation…') only renders before a live estimate is requested; renter-fair-rent.spec.ts:136 covers it"
  - "Added beyond the plan: renter affordability ('…not financial advice.') and investor overview disclaimers"
  - "a11y.spec.ts and routes.ts needed no change: ROUTES already lists every built page (tools/ + 4 calculators, feedback/, setup/rentcast/), EXTERNAL_HOSTS already has app.rentcast.io; routes-drift green on root + sub"
metrics:
  duration: ~55 min
  completed: 2026-10-13
  tasks: 2
  files: 4
requirements: [GTM-01, GTM-02, GTM-03, GTM-04]
---

# Phase 10 Plan 21: Keyed axe, disclaimer audit and final route lists Summary

Every prerendered route is now axe-clean (WCAG 2.0/2.1/2.2 A+AA) with a real-format fake key for all five providers plus spend-triggering data, on both bases. Every page and export that must carry a not-a-brokerage or not-advice disclaimer is proven to carry it. The CSP oracle requires the Phase 10 pages and the SEO/share-card files in every build.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 5374246 | test(10-21): keyed-state axe on every route; final route lists |
| 2 | d3964d2 | test(10-21): disclaimer presence audit |

## What was built

- **a11y-keyed.spec.ts** (root, sub; 44 routes + 1 seed check per project):
  - The shared deny-all harness (support/network) runs, with the five provider hosts routed after it to an abort-and-record handler. RentCast, Anthropic, OpenAI, Gemini and OpenRouter are covered.
  - Fake keys come from `fakeKey()` (runtime-assembled, gitleaks-safe) and go into the vault session store. The AI provider pref is set to anthropic.
  - The spec opens `agent/`, waits for the `tran` DB, and seeds one due saved search with `seedSavedSearches`. The seeding step must try zero provider calls.
  - Each route: goto, `html` not hidden, h1 visible, `nav[data-hydrated]` on chrome routes. On spending routes it polls until exactly one saved-search call was tried. Then it runs axe with `passes.length > 0` and `violations == []`, rule ids included in the message.
  - Assertions per route: zero AI calls. RentCast calls are exactly the one saved-search GET on spending routes and `[]` everywhere else.
  - Title: `axe (keyed) reports no WCAG A/AA violations on "<route>"`.
- **disclaimers.spec.ts** (root, sub): exports `DISCLAIMER_CHECKS` (13 entries `{ name, route, text, scope }`). Tests are titled `disclaimer: <name>`. They cover:
  - the footer on all 40 chrome routes
  - 4 calculators
  - renter affordability
  - investor overview
  - deal analyzer (sample deal)
  - investor memo and memo printout (saved sample deal, "Print the analysis without a memo")
  - fair-rent check (SAMPLE-74201-R017, sample mode)
  - Market Snapshot builder and printout (`print/snapshot/?id=sample`)

  All of it runs on the deny-all harness.
- **assert-csp.mjs EXPECTED_PAGES** now has 48 entries. New: tools hub, 4 calculators, feedback, setup/rentcast, sitemap.xml, robots.txt, og/default.png. Test changes:
  - The fixture writes non-HTML files as placeholders.
  - New case: "a build missing sitemap.xml is rejected".
  - New pin test: "EXPECTED_PAGES pins the Phase 10 pages and SEO files".

## Verification (real output)

- `vitest run --project scripts assert-csp`: 101 passed. Full scripts project: 19 files, 635 passed.
- `build:root`, `build:sub`, `build:configured`: all OK. `csp:assert`: "CSP assertion passed for 45 pages" × 3 (build, build-sub, build-configured).
- `playwright test a11y-keyed --project=root --project=sub`: 90 passed (1.3m).
- `playwright test a11y.spec routes-drift --project=root --project=sub`: 326 passed (3.5m).
- `playwright test disclaimers --project=root --project=sub`: 106 passed (31.2s).
- **Mutation check (keyed guard):** I removed `settings/` from SPENDING_ROUTES and ran the settings/ test. It failed with "RentCast calls on "settings/"" (the one saved-search call was caught). The file was restored and compared byte-identical (`cmp`).
- **Real-break check (disclaimers):** the first run failed `disclaimer: fair-rent check` on root + sub because the intro sentence is absent in the result state. That shows the check fires. Corrected per 06-UI-SPEC, see decisions.
- **Full E2E** (lock held per shard; JSON reports written to the scratchpad, outside test-results):
  - a11y.spec: 322 passed.
  - 9 shards over the other 80 root/sub spec files: 236 / 424 / 58 / 223 / 241 / 224 / 310 / 154 (+4 skipped) / 234 passed.
  - configured: 41 passed.
  - Merged: 2331 unique tests, **0 failed**, 4 skipped. The skips are `perf.spec.ts` landing CLS on sub, which is by design.
  - The a11y filter also matched agent-/ai-/settings-a11y specs, so 140 tests ran twice. Both runs passed.
  - No load flakes appeared in this run.
- `pnpm check`: 0 errors, 0 warnings. `pnpm lint`: exit 0. `banned`: passed (446 files).

## Launch-audit parse proof (scripts/launch-audit.mjs imported)

I merged the shard JSON reports and fed them to `a11yMatrix`. I fed `disclaimerRows` the same reports, plus required text parsed from disclaimers.spec.ts with the audit's own regex (13 entries parsed).

- **Real results:**
  - a11y matrix: `keyless=PASS keyed=PASS routes=44 cells=176 nonPASS=0`.
  - Extras, all PASS:
    - 375px: 112/112
    - guide/tour: 26/26
    - calculators: 24/24
    - waitlist/feedback: 18/18
    - setup: 6/6
  - disclaimers: `rows=13 PASS=13`, each row printed with its required text.
- **Mutated report:**
  - I renamed `axe (keyed) … on "tools/dscr/"` (root). Result: `keyed=FAIL`, cell `tools/dscr/ keyed/root FAIL (not run)`.
  - I failed `disclaimer: deal analyzer` (sub) and renamed `disclaimer: market snapshot printout`. Result: `PASS=11 FAIL=deal analyzer, market snapshot printout [not run]`.

## For 10-23: specs that must be in the final Playwright invocation before `pnpm audit:launch`

Playwright empties `apps/web/test-results/` at the start of every run. These must all be in the last invocation, or their shard reports merged into `e2e-report.json`:

- Accessibility matrix: `a11y.spec.ts` (keyless + 375px) and `a11y-keyed.spec.ts`, on `--project=root --project=sub`.
- Extra-state groups:
  - `guide.spec.ts` / `onboarding.spec.ts` (guide/tour)
  - `tools.spec.ts` (calculators, also 375px)
  - `feedback.spec.ts` + `waitlist.spec.ts` (root/sub), plus `feedback.configured.spec.ts` + `waitlist.configured.spec.ts` (configured)
  - `setup-rentcast.spec.ts`
- Disclaimers: `disclaimers.spec.ts` (root, sub).
- `perf.spec.ts`, which writes cls.json.
- Every spec named in `scripts/lib/pitfalls-evidence.mjs`.

In practice that means the whole suite. The full run does not fit one 7-minute call, so the workable path is this: write each shard's JSON report outside test-results (`PLAYWRIGHT_JSON_OUTPUT_NAME=<scratch>/e2e-<shard>.json --reporter=json,dot`), then concatenate the reports' `suites` arrays into `apps/web/test-results/e2e-report.json` after the last run. That is what I did for the proof above (merge script: `scratchpad/audit-proof.mjs`). The audit's `e2eTests` accepts the merged report as-is. Re-running perf.spec last, or copying cls.json out and back, keeps cls.json.

## Deviations from Plan

### Auto-fixed / adjusted

**1. [Rule 1 - Wrong expectation] Fair-rent disclaimer string**
- **Found during:** Task 2 (first run, root + sub failed).
- **Issue:** The contract map lists the pre-estimate intro as the fair-rent disclaimer. In sample mode, and after any estimate, the component shows the 06-UI-SPEC result disclaimer instead.
- **Fix:** The test now checks the result-state disclaimer after the estimate is visible. No product change.
- **Commit:** d3964d2

**2. [Plan text vs orchestrator] Provider mocks abort instead of fulfilling `{}`.** See decisions. The acceptance strings (`api.rentcast.io`, `api.anthropic.com`, `openrouter.ai`, `passes.length`, `axe (keyed)`) are all present.

**3. Footer test naming:** one audit name across routes (describe per route) instead of `footer on <route>`. See decisions.

**4. Keys seeded via session store, not typed through Settings per test.** See decisions. A non-vacuity test covers it.

None of these touched product code. All four plan files changed or were confirmed; a11y.spec.ts and routes.ts were already final.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: apps/web/tests/e2e/a11y-keyed.spec.ts, apps/web/tests/e2e/disclaimers.spec.ts, scripts/assert-csp.mjs, scripts/assert-csp.test.ts
- FOUND commits: 5374246, d3964d2
