---
phase: 10-launch-hardening-go-to-market
plan: 20
subsystem: onboarding/e2e
tags: [onboarding, gtm, e2e, a11y, cls, rentcast, sample-mode]
requires: ["10-05 (E2E harness, both bases)", "10-15 (Get started guide)", "10-16 (/setup/rentcast/, ?source=sample hand-off)"]
provides:
  - "onboarding.spec.ts: GTM-01 guide journey on root + sub (focus, persistence, exits, never modal, axe at 375/1280 for step 0, 9 tour steps, compact row)"
  - "setup-rentcast.spec.ts: catch-all RentCast recorder + sample hand-off on all three portals"
  - "perf.spec.ts: landing CLS at 375x812 / 1280x800, first-visit + returning, written to apps/web/test-results/cls.json"
  - "GetStartedGuide data-ready hydration marker + latest-request-wins guard for the lazy tour load"
affects: ["10-22/10-23 (launch audit reads cls.json; guide/tour and setup axe groups)", "10-23 (guide.spec.ts:107 flake root-caused and fixed)"]
tech-stack:
  added: []
  patterns:
    - "version counter: an async action captures a ticket before its await and applies only if no later state change happened"
    - "deterministic race repro: hold the lazily loaded chunk with page.route, then wait for its resource-timing entry before instant (non-retrying) reads"
key-files:
  created:
    - apps/web/tests/e2e/onboarding.spec.ts
    - apps/web/tests/e2e/perf.spec.ts
  modified:
    - apps/web/tests/e2e/setup-rentcast.spec.ts
    - apps/web/tests/e2e/guide.spec.ts
    - apps/web/src/lib/components/onboarding/GetStartedGuide.svelte
decisions:
  - "The guide.spec.ts:107 flake was a real product race, fixed in GetStartedGuide (latest request wins), not with retries or waits only"
  - "GetStartedGuide exposes data-ready after onMount; specs drive the guide only after it (prerendered tiles are inert buttons before hydration)"
  - "guide.spec.ts (10-15) kept as is apart from the hydration wait; onboarding.spec.ts is the full journey spec"
  - "CLS fallback (static/onboarded.js) NOT needed: returning-visitor CLS equals first-visit CLS (the compact-row swap happens below the fold)"
requirements-completed: [GTM-01]
metrics:
  duration: "~45 min"
  completed: 2026-10-13
  tasks: 3
  files: 5
---

# Phase 10 Plan 20: GTM-01 end-to-end proof Summary

The first-run journey is now proven end to end on both bases: guide focus and persistence for all three portals, both exits, the setup page with zero real RentCast calls, and a landing CLS of 0.011 or less. The recurring `guide.spec.ts:107` failure turned out to be a real race in the guide. It is now fixed and has a deterministic regression test.

## What was built

- **Task 1, `onboarding.spec.ts`** (56 tests with guide.spec on root + sub). It covers:
  - The prerendered raw HTML is step 0, with no `role="dialog"` or aria-modal.
  - Nothing is focused on load.
  - For each portal: focus lands on each step h3; Next, Back, Change portal (focus goes to the h2) and Skip tour work; step 3 shows Back first in DOM order; the exit hrefs are checked as absolute URLs against the project baseURL (`<base>/{portal}/?source=sample`, `<base>/setup/rentcast/?portal=…`, agent `<base>/agent/` with no key link); and the step survives a reload.
  - The Try sample data exit: the URL is cleaned, "Showing sample data." is announced, the Data source bar reads Sample data, the stored value is `{status:'done',lastPortal:'renter'}`, and the compact row shows Open renter portal.
  - The Connect a free RentCast key exit lands on `setup/rentcast/?portal=investor`.
  - Hide this guide: focus moves to Show me around, the announcement plays, the compact row persists after reload, and Show me around returns to step 0 with the h2 focused.
  - Hero Show me around: the URL gets `#get-started`, the h2 is focused, and a second click with the same hash still resets. Arriving at `/#get-started` focuses the h2.
  - Never modal: no dialog, inert or aria-modal in any state, and Tab from each step heading leaves the guide forward.
  - A corrupt `'{oops'` stored value falls back to step 0.
  - axe (WCAG A/AA tags) at 375 and 1280 px for step 0, the compact row and all 9 tour steps.
- **Task 2, `setup-rentcast.spec.ts`** extends the 10-16 spec:
  - The `blockRentCast` call is replaced by a catch-all `https://api.rentcast.io/**` route that records each request and aborts it. `afterEach` asserts the recorder is empty, so only `mockRentCast` may answer.
  - Adds checks that `main ol > li` has exactly 3 items and that no Data source bar shows on the setup page.
  - Adds sample hand-off tests: renter and investor (parameter stripped, announced, Sample data indicator), agent (sample contacts appear in an empty CRM), and the finish row's "Use sample data for now" (investor hand-off plus onboarding marked done).
  - Coverage that already existed in the spec: the dashboard link (exact href, no target, "(opens external site)"), the To do and Default: 40 badges with cap value 40, Test key with the 404 zero-cost probe giving Done, axe for no key / saved untested / tested, cap 30 giving Done, and `?portal=investor` / `?portal=hacker` giving the stored onboarding state.
  - Following the 10-16 limitation, nothing assumes the step-2 badge persists across a reload.
- **Task 3, `perf.spec.ts`**: runs on root only (skipped on sub). It uses a buffered `layout-shift` PerformanceObserver that sums entries without `hadRecentInput`. The first-visit and returning (`{"status":"done","lastPortal":"renter"}`) states are measured at 375x812 and 1280x800, after networkidle, `data-ready`, the compact row being visible (returning only) and a further 1 s. `beforeAll` resets `apps/web/test-results/cls.json` and each test appends its row.

## guide.spec.ts:107 finding (root cause + fix)

**Root cause:** a real product race in `GetStartedGuide.svelte`. The first tour click calls `go(1)`, which `await`s the lazy `import('./TourPanel.svelte')` and then calls `save({status:'touring',…})` unconditionally. If the user (or the spec) clicks hero "Show me around" or "Hide this guide" while that import is still pending, `showGuide()`/`hide()` runs first. The stale `go(1)` continuation then overwrites the newer state and the guide jumps back into the tour. Load explains why it was intermittent: under parallel load the chunk fetch takes longer than the gap between the two clicks. This matches every logged symptom:
- "the guide still showed the agent tour" (10-14);
- "times out clicking Agent Start the tour" (10-16): the tiles are gone because the stale write put the tour back.

**Proof:**
- A debug run held `.js` requests for 1.5 s after load. Clicking the Agent tile and then the hero link ended with storage `{"status":"touring","portal":"agent","step":1}` after the hero had written `{"status":"new","step":0}`.
- The regression tests `a slow tour load never overrides a later hero Show me around / Hide this guide` failed **4/4 (root + sub) on the pre-fix build** and passed after the fix.

**Fix (commit bea3f1a), latest request wins:**
- A `version` counter is bumped by every `save()` and by each `go()` request. `go()` captures `++version` before the await and returns without writing if anything changed meanwhile. So a later Show me around, Hide, or another tile wins.
- The stored-tour resume in `onMount` is guarded the same way.
- A second, smaller source of flakiness: the prerendered tiles are real buttons with no handler before hydration. The guide now sets `data-ready` once `onMount` ran, and both guide.spec.ts and onboarding.spec.ts wait on it. guide.spec.ts:107 also now waits for the step-1 heading before clicking the hero link, so it really tests "reset from a tour".

**Stress:** `-g "Show me around|slow tour" --repeat-each=10 --workers=8` on root + sub: **100/100 passed**.

## cls.json compatibility (10-22 launch audit)

- Rows are `{ route: '', viewport: '375x812' | '1280x800', state: 'first-visit' | 'returning', cls: number }`. This is exactly what `perfRows()` in `scripts/launch-audit.mjs` filters on (`c.route === ''`, `c.state === 'first-visit'`, every `c.cls < 0.1`).
- Checked by importing the generator and feeding it the real file. The landing row came out `cls: "0.011", status: "PASS"`. Mutating the returning rows to 0.2 flipped it to `FAIL`, and a null report gave `missing`.
- Measured values: 375x812 was **0.0113** in both states; 1280x800 was **0.0002** in both states. The RESEARCH fallback (`static/onboarded.js`) was not needed.
- **Caveat for 10-23:** Playwright empties `apps/web/test-results/` at the start of **every** run. In my sharded full run, shard 7 wrote cls.json and shard 8 wiped it. 10-23 must run `perf.spec.ts` (or the run that produces the reports) as the **last** Playwright invocation before `pnpm audit:launch`, or merge shards first. The same applies to anything else stored in test-results/.

## Verification (real output)

- Task 1: `playwright test onboarding guide --project=root --project=sub`: **56 passed (36.1s)**.
- Task 2: `playwright test setup-rentcast sample-handoff --project=root --project=sub`: **30 passed (14.3s)**.
- Task 3: `playwright test perf --project=root --project=sub`: 4 passed, 4 skipped (sub). The plan's node check on cls.json printed 4 rows and `verify=0`.
- Plan verification: `build:root` and `build:sub` exited 0. The full E2E in 8 shards (root + sub) gave 269 + 378 + 143 + 253 + 269 + 378 + 128 + 260 = **2078 passed, 4 skipped, 0 failed**. There were no load flakes this time, including guide.spec.ts:107.
  - Note: this build included 10-18's uncommitted in-progress work (footer, settings, setup page), which shares the tree.
- `pnpm --filter web check`: 0 errors, 0 warnings. eslint on the changed files: clean. `vitest run src/lib/components/onboarding`: 21 passed.
- Budget: `assert-budget apps/web/build`: index.html is 58.6 KB gz (report-only; the build includes 10-18's footer work). The guide change is a few dozen bytes. Tool pages are untouched by this plan (the guide is only on the landing).
- Not mutation-tested: the setup-rentcast catch-all `afterEach` (no test in the spec performs an unmocked call to trigger it).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale lazy tour load overrode a later Show me around / Hide**
- **Found during:** Task 1 (orchestrator asked to root-cause guide.spec.ts:107)
- **Fix:** latest-request-wins `version` guard in `go()` and the onMount resume; `data-ready` hydration marker
- **Files modified:** apps/web/src/lib/components/onboarding/GetStartedGuide.svelte, apps/web/tests/e2e/guide.spec.ts
- **Commit:** bea3f1a

**2. [Scope] setup-rentcast.spec.ts already existed (10-16)**
- I extended it rather than recreating it. The plan items that were already covered were kept, and the missing items were added (catch-all recorder, `ol > li` count, status bar absence, per-portal sample hand-off, finish-row hand-off).

## Known Stubs

None.

## Commits

- bea3f1a fix(10-20): a slow tour load can no longer override a later guide action
- d98a485 test(10-20): onboarding guide E2E
- 24442b8 test(10-20): RentCast setup and sample hand-off E2E
- 266bc64 test(10-20): landing CLS budget

## Self-Check: PASSED
