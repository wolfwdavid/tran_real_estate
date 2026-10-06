---
phase: 07-investor-portal
plan: 20
subsystem: investor-overview + phase-7 sweep
tags: [overview, counts, zero-calls, stretched-link, a11y, axe, csp, text-spacing, 375px, e2e]
requires:
  - "07-09: listDeals, listWatchedZips (Dexie, tombstone-aware)"
  - "07-14/07-18: useBuyBoxRepo (listBuyBoxes, newMatchCount over the cache peek)"
  - "07-13 markets, 07-16 deals/compare, 07-17 memo, 07-19 print route"
  - "07-03: PortalSubNav, E2E helpers (blockRentCast, mockRentCast, useMocked*Key, mockAnthropicText, axe/scroll helpers)"
  - "06-22: renter-demo-credible matrix (the sweep precedent)"
provides:
  - "features/investor/overview/overview-counts.ts: OverviewCounts, OverviewSources, overviewCounts(sources), overviewLines(counts), OVERVIEW_LOADING"
  - "features/investor/overview/InvestorOverview.svelte (h1, lead, Analyze a deal, three stretched-link cards, disclaimer)"
  - "/investor/ live overview"
  - "tests/e2e/investor/overview.spec.ts and sweep.spec.ts (9 URLs x keyless/mocked x root/sub)"
affects: [07-21 phase gate (INV-01..06, ROADMAP SC5)]
tech-stack:
  added: []
  patterns:
    - "Overview counts: sources injected (buy-box repo needs Svelte context), module loaded by dynamic import in onMount, re-read in an untracked effect keyed on runtime.gateway + the live buy-box list (peeks only)"
    - "Sweep: seed once per mode through the UI, then visit every URL in the same page; per URL: ready marker, CSP collector, sample-chip rule on RENDERED blocks, axe at 1280, then 375px + WCAG 1.4.12 text spacing, overflow culprits, axe"
    - "overflowCulprits(): names the deepest elements past the viewport edge, ignoring content inside scroll/clip containers"
key-files:
  created:
    - apps/web/src/lib/features/investor/overview/overview-counts.ts
    - apps/web/src/lib/features/investor/overview/overview-counts.test.ts
    - apps/web/src/lib/features/investor/overview/InvestorOverview.svelte
    - apps/web/src/lib/features/investor/memo/MemoPrintout.ssr.test.ts
    - apps/web/tests/e2e/investor/overview.spec.ts
    - apps/web/tests/e2e/investor/sweep.spec.ts
    - .planning/phases/07-investor-portal/deferred-items.md
  modified:
    - apps/web/src/routes/(app)/investor/+page.svelte
    - apps/web/src/lib/features/investor/memo/MemoPrintout.svelte
    - apps/web/src/lib/features/investor/buybox/BuyBoxCard.svelte
    - apps/web/src/lib/features/investor/buybox/BuyBoxForm.svelte
    - apps/web/src/routes/(app)/investor/buy-boxes/+page.svelte
key-decisions:
  - "overviewCounts takes its sources as an argument (plan contract was zero-arg): the buy-box repo's port reads the data runtime from Svelte context, so the page builds it at setup with useBuyBoxRepo() and passes it in; deals/watched-ZIP lists come from the dynamic import"
  - "New matches = sum of newMatchCount over all buy boxes (cache peek only); a box whose cache read fails counts 0 so the overview still renders, and the buy-boxes page shows that error where it can be acted on"
  - "Singular copy for one match: '1 new match since your last visit' (UI-SPEC shows the plural template)"
  - "Counts are read once the gateway exists and re-read when the live buy-box list changes (Phase 4 check-on-open updates it) or the source switches; no get/refresh anywhere on the page"
  - "Sweep is one test per mode (seed once, sweep nine URLs with test.step), not a serial describe with beforeEach: Playwright's page and the harness's per-test net fixture cannot be shared across tests"
  - "Memo route in the sweep reopens the stored draft from Draft history (the panel does not auto-restore on revisit), so the gated print link is live while axe runs"
requirements-advanced: [INV-01, INV-02, INV-03, INV-04, INV-05, INV-06]
metrics:
  duration: ~45min
  completed: 2026-10-06
  tasks: 2
  files: 12
---

# Phase 7 Plan 20: Investor overview and cross-route sweep Summary

**`/investor/` is now a real overview with three live, zero-call count lines (saved deals, new buy-box matches since the last visit, watched ZIPs out of 5) and entry points. A sweep proves all nine investor URLs, including the memo print route, are axe-clean (WCAG 2.0/2.1/2.2 A+AA), CSP-clean and free of sideways scroll at 375px with WCAG text-spacing overrides. Every URL is checked with real data loaded, in both keyless and mocked-key modes, on both bases. The sweep found three real defects in earlier plans, and all three are fixed at the root.**

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Overview counts + `/investor/` overview (TDD) | 700490c (test, RED), 86d0f76 (feat, GREEN) |
| 2 | Overview E2E + cross-route sweep | 4a70712 (test) |
| - | Sweep findings fixed at the root | 81077fe (fix: print tables), 0d8d8bf (fix: buy-box buttons + form runtime race) |

## What was built

- **overview-counts.ts**
  - `overviewCounts(sources)` returns `{ deals, buyBoxes, newMatches, watchedZips }` from Dexie lists plus the buy-box repo's cache-only `newMatchCount`.
  - `overviewLines(counts)` produces the UI-SPEC copy: "None saved yet" / "{n} saved"; "No buy boxes yet" / "No new matches" / "{n} new matches since your last visit"; "{n} of 5 ZIP codes watched".
  - `OVERVIEW_LOADING` is "Loading your investor data…".
- **InvestorOverview.svelte**
  - h1 "Investor portal", the lead (max 640px), and the primary **Analyze a deal** ButtonLink with Calculator 16px.
  - A `ul` of three cards: 1 column below 768px, 3 from 768px, 24px gap. Each card has a 24px icon in `text-secondary` (FolderOpen, SearchCheck, ChartLine), an h2 in Body 16/600, a tabular count line and a link (Open saved deals / Open buy boxes / Open markets).
  - The cards use the Phase 2 PortalCard stretched-link pattern: the whole card is clickable, it is one tab stop, and the focus ring and hover lift are on the card.
  - The disclaimer line sits under the cards.
- **Page:**
  - PortalSubNav plus InvestorOverview.
  - The buy-box repo is built at setup.
  - `overview-counts`, `dealsRepo` and `watchedZipsRepo` are loaded by dynamic import in onMount.
  - The counts are read when the gateway exists and again on buy-box list or source changes.

## Verification

- **Unit and static checks**
  - `vitest --project web overview-counts`: 8/8. These cover the line copy, an empty database, tombstoned deals and unwatched ZIPs excluded, a summed new-match count (seen box 1 + never-opened box 2 = 3), and a failing box counting 0. Spies on `gateway.get`, `gateway.refresh`, `requestSpend` and fetch all stay unchanged while counting.
  - `MemoPrintout.ssr` 2/2. It was mutation-checked: the old markup turns both tests red.
  - `test:unit`: 4137/4139 passed. The 2 failures were the known `precommit.test.ts` and `ResultsView.browser` flakes, and both pass when re-run alone (10/10, 3/3).
  - `pnpm check`: 0 errors, 0 warnings. `pnpm lint` (Prettier + ESLint) is clean. `banned` passed (250 files). `ui:guard` passed.
- **Build:** `build:root` + `build:sub` + `csp:assert`: 25 pages per base.
- **Playwright, targeted runs**
  - `investor/overview` + `investor/sweep` + `investor/print` + `investor/buybox`: 28/28.
  - `investor/sweep` + `investor/overview` with `--repeat-each=2`: 16/16.
- **Playwright, wide run** (`investor` + `csp` + `a11y` + `routing` + `layout` + `data-status` + `app-notice` + `routes-drift`): 595/596. The 1 failure is the pre-existing `investor/autofill` keyless load flake (deferred, see below), which passes 42/42 when run alone.
- **Full `test:e2e`:** **1056 passed, 2 skipped, 0 failed** (7.2 min, root + sub; 1058 tests). This includes the new sweep and overview specs and the autofill spec that flaked in the wide runs.
- **Sweep assertions:**
  - Keyless: `blockRentCast` saw 0 RentCast URLs, the harness saw no AI request, and there were more than 0 visible Sample data chips.
  - Mocked: exactly 1 generate call to the mocked Anthropic provider, and the RentCast count is unchanged across the whole sweep (only the seeding calls were spent).
- The build lock `.tools/build.lock` was held for every build and E2E run, then released.

## Deviations from Plan

### Auto-fixed Issues (sweep findings in earlier plans, fixed at the root)

**1. [Rule 1 - Bug] The memo printout scrolled the page sideways at 375px with text spacing (07-19)**
- **Found during:** Task 2 (mocked sweep, `print/memo/`): the inputs tables ended at 406px.
- **Fix:** each of the four tables (key figures and the three inputs tables) now sits in a `role="region" tabindex="0"` named `overflow-x-auto` region, following the ChartDataTable precedent. The regions have `print:overflow-visible`, so paper layout is unchanged. A new SSR test pins one named region per table.
- **Files:** `MemoPrintout.svelte`, `MemoPrintout.ssr.test.ts`. **Commit:** 81077fe.

**2. [Rule 1 - Bug] "Check now (0 calls · sample data)" overflowed a 375px buy-box card with text spacing (07-18)**
- **Cause:** the Button base class has `shrink-0`, so in the card's `flex-wrap` row the button could not shrink below its single-line width, even with `whitespace-normal`.
- **Fix:** add `max-w-full shrink` to Check now and to the form's Save and check now, which is in the same kind of row. The sweep now also checks the open form at 375px with text spacing.
- **Commit:** 0d8d8bf.

**3. [Rule 1 - Bug] The buy-box form's cost label was missing when the data runtime started late (07-18)**
- **Found during:** the wide E2E run under load, where the keyless sweep saw "Save and check now" with no cost label.
- **Cause:** the form reads the free cost only on mount and on Location input. When the Dexie list loaded before `runtime.gateway` existed, `estimateCost` threw and nothing re-read the cost.
- **Fix:** the new and edit forms render once `runtime.gateway` exists and are `{#key}`ed on it. This is the 07-13 WatchZipForm rule, and the form's "never from an effect" design is unchanged.
- **Commit:** 0d8d8bf.

### Other adjustments

4. **[Rule 3] `overviewCounts(sources)` takes an argument** instead of the planned zero-arg signature. The buy-box repo needs Svelte context, as noted under key-decisions.
5. **[Rule 3] Sweep structure:** each mode is one test that seeds once and steps through the nine URLs, with `describe.configure({ mode: 'serial', timeout: 300_000 })`. A `beforeEach` cannot share the seeded page because `page` and the `net` deny-all fixture are per test.
6. **The sample-chip rule only counts rendered blocks.** CompareTable keeps both layouts in the DOM, and the inactive one is `display:none` (07-16). A hidden block is not presented, and its visible twin is still checked. A non-vacuous chip count guards the rule.
7. **The memo route's ready marker reopens the stored draft** from Draft history, because the panel does not auto-restore on a revisit. With the draft open, the gated print link is live while axe runs.
8. **The mocked live ZIP 79999** is answered with the relabelled MOCK_ZIP market body (the 07-13 markets.spec approach), since 79999 is outside the fixtures.

## Deferred Issues

Logged in `deferred-items.md`: **the AutofillButton cost label (07-15) has the same late-runtime race.** It makes `autofill.spec` "keyless sample autofill spends nothing" flaky under full load. It was seen in 07-17's run and in two of 07-20's wide runs, and passes 42/42 alone. It is out of this plan's scope (the sweep did not find it, and it belongs to 07-15), so it is a candidate for the 07-21 gate.

## Requirements

INV-01..06 are advanced through the overview entry points and the Phase 7 accessibility, CSP and 375px proof (ROADMAP SC5). `requirements mark-complete` was not run, because 07-21 closes them.

## Known Stubs

None. Every count line is wired to live data. "Loading your investor data…" shows only until the first read resolves.

## Self-Check: PASSED

- All 6 created source/spec files exist on disk.
- Commits 700490c, 86d0f76, 4a70712, 81077fe and 0d8d8bf are in `git log`.
- The acceptance greps pass: the sweep has the CSP/axe/scroll/print/market strings and the keyless and mocked describes; InvestorOverview has the three links and the disclaimer; the page calls `overviewCounts(`.
