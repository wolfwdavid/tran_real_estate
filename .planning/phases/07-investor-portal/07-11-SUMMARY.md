---
phase: 07-investor-portal
plan: 11
subsystem: shared/markets charts
tags: [layerchart, charts, a11y, data-table, tokens, csp, ssr, tdd]
requires:
  - "@tran/core/markets (07-06): rentTrendSeries, priceToRentSeries, hasEnoughData, timeRangeLine, rentTrendSummary, priceToRentSummary, fewListingsSuffix"
  - "@tran/core/format (07-01): usd, ratio, monthYear"
  - "layerchart 2.5.1 (07-01)"
provides:
  - "features/shared/markets/series-style.ts: SERIES_STYLE, PRICE_TO_RENT_STYLE, CHART_HEIGHT, CHART_PADDING(_LABELLED), PRINT_SIZE, strokeClass, fillClass, xTickEvery, tickLabel, monthDate"
  - "ChartFigure.svelte (+ module exports ChartState, LOADING_TEXT, EMPTY_TEXT): figure wrapper with every text alternative, states and print variant"
  - "ChartLegend.svelte (LegendItem), SeriesMarker.svelte, SeriesMarkers.svelte (PlotRow), ChartDataTable.svelte (ChartTable)"
  - "LinePlot.svelte: the client-only LayerChart plot shared by both charts"
  - "ZipTrendChart.svelte, PriceToRentChart.svelte (exported for Phase 9)"
  - "app.css: unlayered LayerChart variable mapping + 14px tick labels; brand: 3 chart-on-card UI contrast pairs"
affects: [07-13 ZIP dashboard route + E2E, 07-19 print, Phase 9 Market Snapshot]
tech-stack:
  added: []
  patterns:
    - "LayerChart primitives composed directly with explicit token classes AND token-variable stroke/fill props (no LayerChart default palette relied on)"
    - "Null months: Spline `defined` breaks the line, SeriesMarkers skips the month, the table says No data"
    - "Provenance snippet receives { print } so print drops Refresh without ChartFigure knowing ProvenanceRow"
key-files:
  created:
    - apps/web/src/lib/features/shared/markets/series-style.ts
    - apps/web/src/lib/features/shared/markets/series-style.test.ts
    - apps/web/src/lib/features/shared/markets/ChartFigure.svelte
    - apps/web/src/lib/features/shared/markets/ChartLegend.svelte
    - apps/web/src/lib/features/shared/markets/SeriesMarker.svelte
    - apps/web/src/lib/features/shared/markets/SeriesMarkers.svelte
    - apps/web/src/lib/features/shared/markets/ChartDataTable.svelte
    - apps/web/src/lib/features/shared/markets/LinePlot.svelte
    - apps/web/src/lib/features/shared/markets/ZipTrendChart.svelte
    - apps/web/src/lib/features/shared/markets/PriceToRentChart.svelte
    - apps/web/src/lib/features/shared/markets/charts.ssr.test.ts
  modified:
    - apps/web/src/app.css
    - packages/brand/src/index.ts
    - packages/brand/src/contrast.test.ts
decisions:
  - "The shared plot lives in LinePlot.svelte (Chart + Svg + Grid + Axis + Spline + SeriesMarkers) instead of being duplicated in both charts; the charts build rows/legend/table/summary and pass LinePlot as the ChartFigure plot snippet"
  - "Only 3 brand pairs were new (secondary, foreground, muted-foreground on card, kind ui); primary/card ui, border-strong/card ui and muted-foreground/card text 4.5 already existed and were skipped"
  - "ChartFigure's provenance snippet is Snippet<[{ print }]>; callers render ProvenanceRow without onRefresh when print is true (ProvenanceRow hides Refresh when onRefresh is absent)"
  - "Data-table wrapper is role=region + tabindex=0 + aria-label=caption (aria-label on a bare div is prohibited)"
  - "x-axis uses LayerChart's inferred time scale with explicit tick Date arrays (every 1/2/3 months via xTickEvery(containerWidth)) and our UTC tickLabel formatter; no d3-scale import (not a web dependency)"
  - "Belt and braces on colors: token classes (stroke-primary, fill-muted-foreground, …) plus stroke/fill props set to var(--color-<token>), so a LayerChart inline style can only ever resolve to a Phase 2 token"
metrics:
  duration: ~35min
  completed: 2026-10-05
  tasks: 3
  files: 14
---

# Phase 7 Plan 11: Shared accessible market charts on LayerChart Summary

This plan adds `ChartFigure`, `ZipTrendChart` and `PriceToRentChart` with their legend, markers and data table, on LayerChart 2.5.1. Each figure has a title and a visible summary sentence that together name and describe it. It also has a legend that tells series apart by color, dash and marker shape, a caveat, and a "Show data table" table holding every value. Loading, empty and error states keep the title and frame, and a print variant opens the table and drops Refresh. The app-level CSS maps LayerChart's variables onto Phase 2 tokens and sets tick labels to 14px.

This plan advances requirement **INV-05**. It stays open until the 07-21 phase gate. `requirements mark-complete` was not run.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Series styles, tick rules, token CSS mapping, brand contrast pairs | 9b7ec55 (RED), 2e88a5f (GREEN) |
| 2 | ChartFigure, legend, markers, data table (states + print) | 4929609 (RED), 91a8fc7 (GREEN) |
| 3 | ZipTrendChart and PriceToRentChart on LayerChart | 9ba65e7 (RED), d20d455 (GREEN), 5071842 (comment reword) |

## LayerChart 2.5.1 API names confirmed from the shipped `.d.ts`/`.svelte`

- Exports from `layerchart`: `Chart`, `Svg`, `Axis`, `Grid`, `Spline`, and `getChartContext` (not used; the scales come from the `children` snippet's `{ context }`).
- `Chart`: `data`, `x`, `y` (Accessor: key string, function or array), `yDomain`, `yNice`, `padding {top,right,bottom,left}`, `width`/`height` (optional, otherwise 100% of the parent), `ssr` (default false, so nothing renders on the server), `motion`. `context` exposes `xScale`, `yScale`, `width`, `containerWidth`.
- `Svg`: forwards SVG attributes (`role`, `aria-labelledby`) to `<svg>`; `pointerEvents={false}`.
- `Axis`: `placement`, `ticks` (number, array or function), `format` (custom `(v) => string`), `rule`, `tickMarks`, `tickOcclusion`, `stroke`, `fill`, `classes {root,label,rule,tick,tickLabel}`. Tick labels carry class `lc-axis-tick-label`.
- `Grid`: `y` (boolean or `{class, style, stroke, strokeWidth, opacity, dashArray}`), `yTicks`.
- `Spline`: `y` (override accessor), `defined`, `class`, `stroke`, plus the pass-through `stroke-dasharray`/`stroke-width` attributes.
- CSP: no runtime `<style>` injection was found in `dist` (a `createElement('style')`/`insertRule`/`adoptedStyleSheets` grep only hit a test file). Component `<style>` blocks compile into the external stylesheet. `Chart` writes its size through `style:` directives, which are CSSOM writes at runtime and `style-src-attr 'unsafe-inline'` in SSR, so they are allowed either way. No blocker.

## Verification

- `vitest --project web charts.ssr series-style`: 46/46 passed. `--project brand`: 16/16. `theme-parity`: passed.
- Full `test:unit`: **188 files, 3856 passed**.
- svelte-check (web): 0 errors in this plan's files. The only errors are in 07-10's in-flight RED `investor/analyzer/inputs.ssr.test.ts` (missing components that belong to that plan).
- ESLint: clean on this plan's files and `packages/brand`. `banned`: passed (212 files). Prettier is clean on every touched file.
- `build:root` + `assert-csp` on `apps/web/build`: passed for 25 pages. The `lc-axis-tick-label` mapping is in the external `_app/immutable/assets/*.css`. The build lock (`.tools/build.lock`) was taken and released.
- Acceptance greps:
  - No `onmouseenter`/`onmouseover`/`tooltip` in `markets/*.svelte`.
  - No `tweened`/`motion=`/`area` in the chart files.
  - No hex in `.svelte`.
  - The app.css diff adds no `#`.
  - series-style contains `'12 4 2 4'`, `'diamond'` and `'ring'`.
- **Null months are gaps, not zeros.** In the 24-month fixture, the studio month is missing. The tests assert the table row reads "No data" and that `$0` never appears. On the plot, `Spline defined` and `SeriesMarkers` both skip non-numbers.

## Deviations from Plan

**1. [Rule 3 - Structure] Shared `LinePlot.svelte` (new file).** Both charts need the same Chart/Svg/Grid/Axis/Spline/SeriesMarkers composition, so it lives in one component instead of two copies. As a result, the `layerchart` import and `role="img"` sit in `LinePlot.svelte`, not literally in `ZipTrendChart.svelte`, which is the plan's Task 3 grep target. ZipTrendChart still imports `@tran/core/markets` and calls `rentTrendSeries(`. LinePlot is imported statically by both charts, so routes still reach LayerChart only through their dynamic import of a chart component.

**2. [Rule 2] Data-table wrapper has `role="region"`.** A `tabindex` + `aria-label` on a plain `div` violates ARIA (`aria-label` is prohibited on a generic element), so the wrapper is a named region.

**3. Phase 7 contrast test added** to `packages/brand/src/contrast.test.ts` (the plan listed only `index.ts`). It guards the five series-on-card UI pairs and the axis text pair.

## Notes for downstream plans

- **07-13 (dashboard route + E2E):** the live checks are still to do: the SVG `role="img"` and `aria-labelledby`, computed stroke and fill per token, gaps in the line, zero CSP violations with the chart mounted, and axe. Render ProvenanceRow inside the `provenance` snippet without `onRefresh` when `print` is true. Import the charts with `import()` in `onMount`.
- **07-09 (not my file):** `corepack pnpm eslint` reports `no-restricted-imports` in `features/shared/markets/watchedZipsRepo.ts`, which imports `$lib/features/investor/deals/tables` (shared must not import a portal folder). My markets-directory Prettier run may also have reformatted 07-09's untracked `markets-port.ts`. Both are left untouched in git and belong to 07-09.

## Known Stubs

None.

## Self-Check: PASSED
