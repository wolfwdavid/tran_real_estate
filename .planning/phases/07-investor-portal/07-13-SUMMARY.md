---
phase: 07-investor-portal
plan: 13
subsystem: shared/markets UI + investor market routes
tags: [markets, watched-zips, layerchart, cost-first, csp, a11y, e2e]
requires:
  - "07-09: useMarketsPort (estimateCost/peek/load), watchedZipsRepo (watchZip/unwatchZip/watchedZipsLive)"
  - "07-11: ChartFigure, ZipTrendChart, PriceToRentChart (LinePlot/LayerChart)"
  - "07-03: route stubs, PortalSubNav, NotFoundPanel, investor E2E helpers"
  - "Phase 4: CostLabel, ProvenanceRow, GatewayError, runtime CapPrompt (DataShell)"
provides:
  - "features/shared/markets/market-load.ts: loadMarket (click-only spend, LoadOutcome) and readMarketOnMount (free peek)"
  - "features/shared/markets/WatchZipForm.svelte, ZipCard.svelte"
  - "/investor/markets/ (watch up to 5 ZIPs) and /investor/market/?zip= (dashboard with both charts)"
  - "tests/e2e/investor/markets.spec.ts: the live-chart proof 07-11 deferred"
affects: [07-19 print, 07-21 phase gate, Phase 9 agent market reports]
tech-stack:
  added: []
  patterns:
    - "Cost label from estimateCost in the input handler (never an effect); the one spend is the submit click"
    - "Watch form rendered only once runtime.gateway exists and {#key}ed on it, so the cost always matches the active source"
    - "Optimistic added/removed lists over watchedZipsLive so focus can move before the liveQuery catches up"
    - "Charts via Promise.all([import(ZipTrendChart), import(PriceToRentChart)]) in onMount; ChartFigure (LayerChart-free) renders the loading placeholders"
key-files:
  created:
    - apps/web/src/lib/features/shared/markets/market-load.ts
    - apps/web/src/lib/features/shared/markets/market-load.test.ts
    - apps/web/src/lib/features/shared/markets/markets-ui.ssr.test.ts
    - apps/web/src/lib/features/shared/markets/WatchZipForm.svelte
    - apps/web/src/lib/features/shared/markets/ZipCard.svelte
    - apps/web/tests/e2e/investor/markets.spec.ts
  modified:
    - apps/web/src/routes/(app)/investor/markets/+page.svelte
    - apps/web/src/routes/(app)/investor/market/+page.svelte
decisions:
  - "No grantFor on the port (07-09): over-cap confirmation stays the runtime CapPrompt. LoadOutcome 'cap' carries the error, a `dismissed` flag (\"Not now\": nothing spent, keep the screen) and `retry`, which asks again through the same prompt"
  - "readMarketOnMount(port, zip) peeks in BOTH modes (no mode parameter): sample-mode peek answers from the fixtures at 0 calls, so the view never enters the spend path (which would trip the reactive spend guard inside an effect)"
  - "Watch ZIP always goes through loadMarket: a cached or sample ZIP resolves at 0 calls and returns the figures for the new card; the ZIP is stored only after its data loaded"
  - "Refresh (1 call) lives once, in the row under the dashboard h1; the provenance inside each ChartFigure is the chip only (no onRefresh, so print gets the same)"
metrics:
  duration: ~45min
  completed: 2026-10-05
  tasks: 3
  files: 8
---

# Phase 7 Plan 13: Markets page and ZIP dashboard Summary

**Investors can watch up to 5 ZIP codes. Each Watch ZIP button shows its cost before the click: "(1 call)", "(0 calls · cached)" or "(0 calls · sample data)". Each ZIP gets a dashboard with the rent-trend-by-bedroom chart and the price-to-rent chart, loaded lazily. Opening, reloading or re-watching a cached ZIP spends nothing. All of this is proven on the real build at both bases.**

This plan advances **INV-05** (ROADMAP SC4, first half). It was not marked complete, because the orchestrator owns that at the 07-21 gate.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Market load helper, WatchZipForm, ZipCard | a971063 (test), fb2f6b5 (feat) |
| 2 | /investor/markets/ and /investor/market/?zip= | 443fe92 (feat), 4b9d64d (fix found by E2E) |
| 3 | Markets and dashboard E2E | ce11886 |

## What was built

- **market-load.ts:** `loadMarket(port, zip, {refresh?})` never throws. It returns `{ok:true,result}`, `{kind:'cap', error, dismissed, retry}` or `{kind:'error', error}`. `readMarketOnMount(port, zip)` calls `peek` only.
- **WatchZipForm:** "ZIP code" input (`inputmode="numeric"`, `maxlength=5`, `autocomplete="postal-code"`, 48px, 144px wide from 640px) and a primary **Watch ZIP {CostLabel}** button, full width below 640px.
  - Validation messages: "Enter a 5-digit ZIP code." and "You're already watching {zip}." (checked before any spend).
  - While adding, the button shows "Adding…" with a `motion-safe:animate-spin` LoaderCircle.
  - A GatewayError renders inside the form and takes focus. "Continue past cap" runs `retry`.
  - On success: announces "Now watching ZIP {zip}.", clears the input, and the page focuses the new card heading.
- **ZipCard:** `h2` "ZIP {zip}", then a `<dl>` with Median rent, Median sale price and Price-to-rent ratio (Figure 24/600, "—" when nothing is saved, never $0). Below that: ProvenanceRow (with Refresh (1 call) in live mode), **Open dashboard** (outline link via `resolve()` + `?zip=`) and **Stop watching** (ghost).
- **Markets page:**
  - Lead copy, then the empty state when no ZIP is watched.
  - The form, which the limit note replaces at 5 ZIPs.
  - The count line `{n} of 5 ZIP codes watched` and a card grid of 1/2/3 columns.
  - Stop watching announces "Stopped watching ZIP {zip}. Its saved data stays in this browser." and moves focus to the next card heading, or to the ZIP input when no cards remain.
- **Dashboard:**
  - `?zip=` is read via `new URL(location.href)` in onMount. An invalid or missing ZIP shows NotFoundPanel "Pick a ZIP code to see its dashboard".
  - A valid ZIP sets the h1 and `document.title`, then shows ProvenanceRow and a stat `<dl>` (plus Listings counted).
  - An unwatched ZIP shows "You're not watching this ZIP." with an outline **Watch ZIP ({cost})**.
  - Below, ZipTrendChart then PriceToRentChart, stacked 24px apart (32px from 768px). Both come from `await import()`-style dynamic imports in onMount, with ChartFigure loading placeholders until they arrive.

## Verification

- `vitest --project web market-load markets-ui`: 11/11. Full `test:unit`: 203 files, 4018 tests. The one failure was the known `precommit.test.ts` HEAD-move flake, which passed 10/10 on re-run.
- `pnpm check`: 0 errors. ESLint and Prettier are clean on every touched file. `banned`: passed (225 files). `ui:guard`: passed.
- `build:root`, `build:sub` and `csp:assert`: passed (25 pages each). No route imports `layerchart` statically (`grep -rn "from 'layerchart'" apps/web/src/routes` is empty).
- `playwright test tests/e2e/investor/markets`: **48/48 with `--repeat-each 3` on root + sub.** The wider `tests/e2e/investor csp a11y routing` run passed 251/252 before the fix below; its one failure was the race that fix addresses.
- E2E covers:
  - Keyless sample: RentCast requests `[]`.
  - Live, cost shown first: `count('/v1/markets')` is 0 before the click, 1 after it, still 1 after a reload, a cached re-watch ("(0 calls · cached)") and opening the dashboard.
  - 5-ZIP cap: limit note shown, form gone, "5 of 5 ZIP codes watched".
  - Charts: `svg[role="img"]` `aria-labelledby` contains the title id and the summary id. The summary starts "Median rent in ZIP 79999.". Legend items (5) equal the drawn `path.stroke-2` lines. Data tables have a caption and ≥24 rows, a "(few listings:" cell, and the gap month reads "No data" in the 3-bedroom column.
  - Every `.lc-axis-tick-label` computes to `14px`.
  - Every SVG stroke and fill resolves to a token color, `none` or transparent.
  - Zero `securitypolicyviolation` events with the charts mounted.
  - States: invalid ZIP, single-month "Not enough monthly data…", and a 500 on watch, where the GatewayError title is focused and nothing is watched.
  - axe on markets empty, at 5 ZIPs, watch error, dashboard loaded, tables open and empty data. No horizontal scroll at 375×812.
- Build lock `.tools/build.lock` was taken for every build/E2E run and released.

## Deviations from Plan

1. **[Rule 3] Cap handling adapted to 07-09's port (no `grantFor`).** The runtime CapPrompt (CapConfirmDialog in DataShell) already confirms the spend and issues the grant. `LoadOutcome.cap` adds `error` and `dismissed`. `retry()` calls `port.load` exactly once more, through the same prompt (unit-tested).
2. **[Rule 1] `readMarketOnMount` has no `mode` parameter and peeks in sample mode too.** The plan said "sample: load". Peek already answers from the fixtures at 0 calls, and calling `load` from the page's read effect would enter the spend path (reactive spend guard and lint). The unit test checks that the load spy stays at 0.
3. **[Rule 1] Watch form waited for the data runtime (found by E2E, commit 4b9d64d).** A ZIP typed before `runtime.gateway` existed got no cost label, because estimateCost threw "not started". The form now renders once the gateway exists, `{#key}`ed on it, so a mode switch never leaves a stale cost.
4. **Live-mode ZIPs in E2E:** the plan's literal "79999" ZIPs are not in the sample fixtures. The spec answers `/v1/markets` for any ZIP with the MOCK_ZIP body relabelled (24 months, gap and thin months). Sample mode uses only `MOCK_ZIP`.
5. **Token-color probe:** each token is resolved both from its `text-*` utility and from `var(--color-*)`, because Tailwind does not emit utilities the sources never use (`text-border` and `text-card` resolved to the inherited color). `<line>` fill is skipped because a line has no interior.
6. **Extra test file** `markets-ui.ssr.test.ts`, for the WatchZipForm/ZipCard SSR behaviours in the plan's `<behavior>` list. It is additive and sits in this plan's directory.
7. **Commit trailer:** the first two commits (a971063, fb2f6b5) carry a co-author trailer line. Later commits omit it, following the user's global instruction to keep assistant mentions out of commit messages. Other agents had already committed on top, so the two were not rewritten. They are unpushed.

## Requirements advanced (not marked complete)

- INV-05: watch up to 5 ZIPs, with rent-trend and price-to-rent dashboards, cost shown first and cached reads free.

## Known Stubs

None. The ZipCard place name (UI-SPEC "when the data includes it") is omitted, because the market-stats payload has no place name.

## Self-Check: PASSED
