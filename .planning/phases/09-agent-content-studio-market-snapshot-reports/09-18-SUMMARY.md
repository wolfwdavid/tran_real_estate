---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 18
subsystem: studio-snapshot-print
tags: [studio, snapshot, print, pdf, brand, layerchart, foreignobject, import-graph, playwright, axe]
requires:
  - phase: 07
    provides: "PrintReport shell, print.css, ZipTrendChart / PriceToRentChart / ChartFigure / ChartDataTable, NotFoundPanel, print/memo route pattern"
  - phase: 08
    provides: "effectiveBrandColors, logo object URLs (CSP img-src blob:), tooling/import-graph.ts walker"
  - phase: 09-08
    provides: "PrintReport preparedLine; ChartFigure print variant (672-unit viewBox + foreignObject)"
  - phase: 09-11
    provides: "SnapshotRecord types, getSnapshot"
  - phase: 09-14
    provides: "SAMPLE_SNAPSHOT_RECORD (id 'sample'), buildSnapshotRecord, agent.hasLogo"
  - phase: 09-16
    provides: "SnapshotKeyFigures print prop, ListingsSummaryTable"
provides:
  - "features/studio/snapshot/report-copy.ts: SHORT_LABEL, fullLabel, dataSourcesSentence, preparedLine, EHO_TITLE, EHO_STATEMENT, TRAN_FOOTER, SAMPLE_FOOTER, SAMPLE_SENTENCE, NOTES_AI_NOTE, PRINT_HELP, reportDate, notesPrinted, snapshotDocumentTitle"
  - "BrandBand.svelte { agent, logoUrl? } + module bandColors(agent); the only print-color-adjust element"
  - "SnapshotReport.svelte { record, logoUrl?, preparing?, onprint? }: the whole printout (PrintReport + sections + Prepared by + EHO) from a frozen record"
  - "routes/(print)/print/snapshot: ?id= in onMount; hydrating / missing / not found / sample / ready; Preparing until fonts + logo decode"
  - "features/studio/boundaries.test.ts: studio and print-route import-graph boundaries with planted controls"
  - "PrintReport sampleSentence? / preparing? props; ChartFigure + ChartDataTable + ListingsSummaryTable print compaction"
affects: [09-17, 09-20, 09-22, 09-23]
tech-stack:
  added: []
  patterns:
    - "Brand custom properties set with style: directives (CSSOM, CSP-safe) from strictly re-validated #RRGGBB values"
    - "Print overrides of print.css go in unlayered component <style> blocks: a Tailwind print: utility lives in a cascade layer and cannot beat the unlayered print.css"
    - "Import-graph boundary walks treat the shared schema registries (storage/db.ts, storage/backup-registry.ts) as opaque, then prove the full walk only adds their schema modules"
key-files:
  created:
    - apps/web/src/lib/features/studio/snapshot/report-copy.ts
    - apps/web/src/lib/features/studio/snapshot/BrandBand.svelte
    - apps/web/src/lib/features/studio/snapshot/SnapshotReport.svelte
    - apps/web/src/lib/features/studio/snapshot/snapshot-report.test.ts
    - apps/web/src/lib/features/studio/boundaries.test.ts
    - apps/web/tests/e2e/snapshot-print.spec.ts
  modified:
    - apps/web/src/routes/(print)/print/snapshot/+page.svelte
    - apps/web/src/lib/features/shared/print/PrintReport.svelte
    - apps/web/src/lib/features/shared/markets/ChartFigure.svelte
    - apps/web/src/lib/features/shared/markets/ChartDataTable.svelte
    - apps/web/src/lib/features/studio/snapshot/ListingsSummaryTable.svelte
    - apps/web/src/lib/features/studio/fixtures/sample-snapshot.ts
key-decisions:
  - "SnapshotReport renders the whole PrintReport (not only its children), so SSR tests see the labels, Data sources and Important, and one wrapper sets --brand-*-effective for the h1 (a sibling of the band)"
  - "Not-found states keep the prerendered h1 'Market Snapshot' and show the NotFoundPanel heading as an h2 that takes focus (memo-route pattern; the shipped studio-shell E2E asserts exactly one 'Market Snapshot' h1 on print/snapshot/)"
  - "The foreignObject print plot works in Chromium print: both charts draw (non-zero LayerChart SVG with drawn paths) on screen, in print media and in the real PDF; no ChartFigure plot change was needed"
  - "The full sample printout is 6 Letter pages, not the plan's 1-4: with every section on and both 24-month chart data tables printed open (UI-SPEC) at Body 16 / Label 14, the content alone is about 4.7 pages at 672 x 912 px. The E2E budget is 6 for the full sample and 1-2 for a saved record with three sections"
  - "Studio import-graph exemptions: lib/data/tables.ts (Phase 8 leaf) and features/investor/deals/{tables,schema}.ts, reached only through the shared schema registries"
requirements-completed: []
duration: ~80 min (Stage 1 ~25 min, Stage 2 ~55 min; single core, mask 0x400)
completed: 2026-10-07
---

# Phase 9 Plan 18: Market Snapshot print view Summary

**The frozen Market Snapshot now prints from `/print/snapshot/?id=` in the Phase 7 PrintReport shell. It has the agent's brand band (re-validated effective colors, the only `print-color-adjust` element), every enabled section, Prepared by, the EHO statement, Data sources and the not-removable labels, and it spends 0 calls. A real-browser E2E shows the 09-08 foreignObject chart plot drawing in Chromium print and in the PDF. Getting there meant fixing three print defects at their root: an empty sample rent-trend chart, a clipped listings table, and figures that wasted pages.**

## Performance

- **Duration:** about 80 min in two stages: Stage 1 was implementation and unit tests, Stage 2 was builds and Playwright.
- **Tasks:** 2 of 2
- **Files:** 6 created, 6 modified

## Accomplishments

- **report-copy.ts** holds the verbatim UI-SPEC strings and the builders that fill them from the record: dates are "Mon D, YYYY" in UTC, the provider label comes from `providerById`, and the notes and summary sentences are conditional. It is ASCII-only and never names the banned terms.
- **BrandBand** builds its colors with `bandColors()`: a strict `^#[0-9A-Fa-f]{6}$` check, then `effectiveBrandColors`, then upper-casing. Any failing or malformed color becomes `#A4452A` / `#F6E3D8`. The band shows the brokerage or team line in Heading 24/600 over the agent and license type in Body 16/600, and shows a logo only when a blob URL is passed in.
- **SnapshotReport**:
  - It renders the sections (only those enabled) in UI-SPEC order, using the Phase 7 charts with `print`.
  - The Rent by bedroom table carries the few-listings suffix, and the Days on market table has Homes for sale / Rentals rows. ListingsSummaryTable is included when the record holds a summary.
  - Market notes print as paragraphs plus the AI note.
  - Prepared by (always shown, `.print-keep`) uses `formatDisclosure(..., 'print')`: brokerage at 16/600, agent at 16/400, then the "License #… (ST)" line at 14px.
  - The EHO block and the Tran / sample footers appear only when their options are on.
  - The h1 takes `--brand-primary-effective`.
- **The print route** reads `?id=` in `onMount`.
  - `sample` uses the built-in record with no storage read. Any other id goes through a dynamic `getSnapshot` import.
  - When the record says `hasLogo`, the logo loads through features/shared/agent-profile (never for the sample record), and the object URL is revoked on destroy.
  - The button shows **Preparing…** with a spinner until `document.fonts.ready` resolves and the logo's `img.decode()` settles. It is then enabled and focused.
  - `window.print()` runs only from the button. `document.title` is `Market Snapshot - ZIP {zip} - {YYYY-MM-DD}`.
- **boundaries.test.ts** has 5 tests:
  - features/studio never reaches features/investor, features/agent/crm or lib/leads.
  - The print route never reaches lib/data. The only exemption is the schema leaf.
  - The print route reaches no forbidden folder beyond the shared schemas.
  - Two planted controls use real files under `os.tmpdir()`: one `$lib/data/x` import, and a barrel that reaches the CRM, the investor portal and lib/leads, including through a dynamic import.

## Task Commits

1. **Task 1, report body, brand band and report copy:** `cc8ae3e` (feat)
2. **Task 2, print route and studio boundary test:** `c1d6275` (feat)
3. **Task 2, print fixes found by the browser E2E:** `9685ac2` (fix)
4. **Task 2, print E2E:** `7a736ed` (test)

The plan named a single commit for Task 2. It was split into four because of the two-stage execution: in Stage 1 the spec was written but could not be run. Every commit used an explicit pathspec after `git diff --cached --name-only`.

## Verification

All commands ran through the single-core wrapper with mask 0x400.

**Unit tests**
- `vitest --project web snapshot-report`: 19/19. `boundaries`: 5/5.
- Regression over features/shared, features/studio and investor/memo: 33 files, **422/422**.
- `vitest --project scripts agent-boundary banned-terms`: 141/141.
- **Mutation proof (reverted):** planting a features/investor import in report-copy.ts and a `$lib/data/runtime` import in the route failed 3 of 5 boundary tests.

**Static checks**
- `pnpm check`: 0 errors, 0 warnings (2588 files).
- Scoped eslint and prettier on all plan files: clean.
- `pnpm banned`: passed (371 files). `pnpm ui:guard`: passed.

**Builds and Playwright** (`--workers=1`, foreground, every chunk under 10 min)
- `build:root` and `build:sub` succeeded. `csp:assert` passed for 38 pages on each.
- `snapshot-print` + `studio-shell` on root and sub: **46/46** (1.1 min).
- `routing.spec` + `csp.spec` + `investor/print.spec` on both: **28/28** (3.5 min).
- `a11y.spec` (matches a11y, agent-a11y, ai-a11y and settings-a11y): **147/147** root (6.0 min) and **147/147** sub (6.0 min).
- `test.slow()` is used in snapshot-print for the sample-report, sample-axe and saved-record tests.

**What snapshot-print proves in Chromium**
- Both print plots draw: the LayerChart SVG inside `[data-print-plot] foreignObject` is visible, has non-zero size and contains drawn paths. This holds on screen, in print media, and in print media at a 672px viewport (the Letter box with 0.75in margins).
- No figure and no table region is clipped at 672px.
- Prominence: the band brokerage size is at least the band agent size, the Prepared by brokerage size is at least the agent line size, and the license line is at least 14px. This holds on screen and in print.
- All labels and sample lines are visible in print, and the toolbar is hidden.
- A saved record seeded in IndexedDB prints with EHO, the Tran footer and the sample marking all absent, and its h1 is `rgb(31, 78, 121)`.
- PDF page counts are 6 or fewer for the sample and 1 to 2 for the saved record.
- Zero RentCast or AI requests. axe is clean for the sample, missing-id, not-found and saved-record states.
- I also rendered the PDF pages to images and checked them by eye: band, charts, tables and footers are all present.

`apps/web/test-results` was deleted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The sample rent-trend chart was empty (file outside files_modified: 09-14's sample-snapshot.ts)**
- **Found during:** Task 2 E2E. Only 1 of 2 print plots drew.
- **Issue:** The Phase 7 rent trend reads `history[month].dataByBedrooms`. The sample rental history points had no `byBedrooms`, so the keyless sample report printed "Not enough monthly data". The foreignObject plot was fine; it drew the price-to-rent chart.
- **Fix:** Rental history months now carry a bedroom breakdown that moves with the overall median. Metrics and notes are unchanged, because they read the top-level `byBedrooms` and the overall medians. An SSR test now asserts 2 print plots and no empty-chart text.
- **Commit:** `9685ac2`

**2. [Rule 1 - Bug] Print tables were clipped (ChartDataTable, ListingsSummaryTable)**
- **Found during:** Task 2 E2E and the rendered PDF. At 672px the rent-trend data table needed 644px in a 623px region. On the PDF page, the listings summary lost its "Median days on market" column and the end of its caption.
- **Fix:**
  - ChartDataTable `print` prop: cells use Label 14px, tight padding, and may wrap. A month plus 1 value prints 3-up, and a month plus 2-3 values prints 2-up. Each block is a named region with an sr-only caption, and every month appears once.
  - ListingsSummaryTable `print` prop: cells wrap with tighter padding.
  - ChartFigure print: the card padding, border and shadow drop in print media.
  - The E2E checks that every table region on the sheet is unclipped.
- **Commit:** `9685ac2`

**3. [Rule 1 - Bug] Figures pushed whole onto the next page**
- **Issue:** print.css sets `figure { break-inside: avoid }`, so a 700px figure left a near-empty page before it. A Tailwind `print:break-inside-auto` utility cannot override it, because utilities sit in a cascade layer and print.css is unlayered.
- **Fix:** An unlayered rule in ChartFigure's `<style>` lets print-variant figures break between table rows. The title, provenance, time range and legend keep `break-after: avoid` up to the plot, and the plot is `break-inside-avoid`. Section gaps tighten to 16px in print, and snapshot plots are 240 units tall.
- **Commit:** `9685ac2`

**4. [Rule 3] PrintReport got two additive props (outside files_modified)**
- `sampleSentence?`: the investor default "the property, the estimates…" is wrong for a snapshot.
- `preparing?`: the button shows Preparing… until the route says it is ready.
- Leaving both out gives the same output as before. The only other change is a print-only `print:gap-4`. The Phase 7 and 09-08 PrintReport suites stay green.
- **Commits:** `cc8ae3e`, `9685ac2`

### Plan conflicts (recorded, not silently loosened)

- **PDF page count:** the plan expects 1 to 4 pages. After compaction, the full sample is 6 Letter pages. The content is about 4247 to 4535px at the 672px print width, against 912px per page: roughly 4.7 pages before any page breaks. The rest is break waste: a chart's title, legend and plot must stay together.

  4 pages would require dropping content the UI-SPEC requires, or going below its type sizes. That content is every section, both 24-month chart data tables printed open, Body 16 and Label 14. I tried 3-column key figures and 220-unit plots. Neither changed the page count, so I reverted both to stay on spec.

  The E2E budget is 6 for the all-sections sample and 1 to 2 for a three-section saved record. **The owner should decide:** accept 6 pages, or allow an abbreviated or condensed print table.
- **Not-found headings are h2, not h1.** The page keeps one h1, because the shipped studio-shell E2E asserts it. The panel heading takes focus.
- **The walker export is `importGraph`, not `graph()`.** The two schema-registry exemptions are proven narrow, as described above.

**Total deviations:** 4 auto-fixed (3 bugs, 1 blocking) and 3 recorded plan conflicts.

## Issues Encountered

- An injected `<style>` in a probe was blocked by the hash-mode CSP. Measurements used the built site's real CSS, and the probe spec was deleted.
- In Stage 1, `pnpm check` briefly showed 4 errors in 09-17's in-progress files. They cleared once 09-17 committed.

## Requirements

STU-04 is advanced. I did not run `requirements mark-complete`, because the 09-23 phase gate closes requirement ids.

## Known Stubs

None. Every section renders from the frozen record. Logos load from the agent profile when `hasLogo` is set; that path has no automated test (no E2E seeds a logo).

## Self-Check: PASSED
