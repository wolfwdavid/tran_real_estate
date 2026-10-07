---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 16
subsystem: studio-snapshot-ui
tags: [studio, snapshot, svelte, ssr, rentcast-budget, aggregates-only, tdd]
requires:
  - phase: 04
    provides: "CostLabel, ProvenanceRow / ProvenanceChip, GatewayError, requestSpend cap prompt, SAMPLE_METROS, SampleChip"
  - phase: 07
    provides: "features/shared/markets: watched-ZIP repo, markets port peek, marketStatsRequest; ChartDataTable scroll-wrapper pattern"
  - phase: 09-05
    provides: "snapshotFigureValues, buildSnapshotMetrics, bedroomLabel, AggregatedSample"
  - phase: 09-10
    provides: "BrandPreview, effectiveBrandColors via features/shared/agent-profile"
  - phase: 09-11
    provides: "SNAPSHOT_SECTION_KEYS, SnapshotSectionKey"
  - phase: 09-14
    provides: "createSnapshotData(runtime) / useSnapshotData(): snapshotZipCost, loadZipData, listingsSummaryCost, loadListingsSummary; SAMPLE_SNAPSHOT_RECORD"
provides:
  - "SnapshotKeyFigures.svelte { metrics, print? } + module keyFigureItems(metrics), MISSING_LINE"
  - "ListingsSummaryTable.svelte { sample, zip } + module LISTINGS_SUMMARY_COLUMNS, listingsSummaryCaption, listingsSummaryRows"
  - "ZipPicker.svelte { onLoaded, sampleMode, data?, options?, now?, busy (bindable) } + module ZipOption, LoadedZip, ANOTHER, ZIP_INVALID, ZIP_REQUIRED, SAMPLE_ZIP_OPTIONS, toEstimate, savedText, chooseZip, loadedAnnouncement, loadChosenZip"
  - "SnapshotSectionToggles.svelte { value (bindable), zip, profile, onListings, data?, now? } + module SnapshotIncludeValue, DEFAULT_INCLUDE, SECTION_ROWS, DATA_SECTION_KEYS, validateSections, SECTIONS_REQUIRED, EHO_TITLE, EHO_SENTENCE, ALWAYS_INCLUDED, brandFallbackNotes, LoadedListings"
affects: [09-17, 09-18, 09-20, 09-22, 09-23]
tech-stack:
  added: []
  patterns:
    - "Builder components take an optional `data?: SnapshotData` (default: the runtime from Svelte context), so SSR tests inject a spy and prove nothing is read or spent"
    - "Click logic lives in exported module-script functions (loadChosenZip, chooseZip, validateSections) so the spend and validation paths are unit-testable without a browser"
key-files:
  created:
    - apps/web/src/lib/features/studio/snapshot/SnapshotKeyFigures.svelte
    - apps/web/src/lib/features/studio/snapshot/ListingsSummaryTable.svelte
    - apps/web/src/lib/features/studio/snapshot/ZipPicker.svelte
    - apps/web/src/lib/features/studio/snapshot/SnapshotSectionToggles.svelte
    - apps/web/src/lib/features/studio/snapshot/snapshot-components.test.ts
  modified: []
key-decisions:
  - "Key figure values are snapshotFigureValues strings verbatim (the same source factsForPrompt uses); a missing value renders the em dash plus \"Not in RentCast's data for this ZIP\". Median days on market shows the missing line only when BOTH sides are missing (otherwise 'Homes for sale: —. Rentals: 12.' keeps the known figure); 'Homes for sale' reads 'Active listings.' when the new-listings count is missing"
  - "ListingsSummaryTable renders a single price ('$1,500') when min equals max, like the 09-05 fact lines, so a 1-listing row never shows '$1,500 to $1,500'"
  - "onLoaded receives ZipData plus the zip (LoadedZip), matching the contract shape { zip, placeName, stats, fetchedAt, source }"
  - "ZipPicker owns the loaded state (h3 'ZIP {zip}', place name, ProvenanceRow, SnapshotKeyFigures preview, Choose a different ZIP). Refresh (live only) spends through runtime.requestSpend(marketStatsRequest(zip), 'refresh'), the Phase 7 canonical request; 'Choose a different ZIP' moves focus to the Load ZIP data button"
  - "Sample mode lists all six fixture ZIPs (SAMPLE_METROS) with a SampleChip and a static '(0 calls · sample data)'; live mode reads up to 5 watched ZIPs plus each one's free cost preview and cache peek ('Saved {relative}' / 'Not saved in this browser') from an $effect that only reads"
  - "SnapshotSectionToggles writes the bindable value by reassignment only (never a deep mutation of the parent's object); profile may be AgentProfile, ProfileInput or null (null previews with EMPTY_PROFILE_INPUT and Tran colors, no fallback notes)"
  - "Brand fallback notes mirror the Phase 8 BrandColorField copy: 'No {role} color chosen. Reports use Tran's {terracotta|sand}.' / '{Role} color is too low in contrast. Reports will use Tran's ...'"
  - "The listings summary provenance chip reads sample vs RentCast from the cost preview taken before the load (ListingsSummary carries no source)"
requirements-completed: []
duration: ~16 min
completed: 2026-10-07
---

# Phase 9 Plan 16: Market Snapshot builder steps 1-2 and the shared print components Summary

**Four Svelte components for the Market Snapshot builder: ZipPicker (step 1), SnapshotSectionToggles (step 2), and SnapshotKeyFigures plus ListingsSummaryTable, which the print route (09-18) reuses as they are. The key figures show `snapshotFigureValues` strings, the same formatter output the AI facts are checked against. The listings table can only render counts, ranges and medians by bedroom count. Every spend happens in a click handler through the 09-14 data path.**

## Performance

- **Duration:** about 16 min (single core, mask 0x200, alongside 09-12)
- **Started:** 2026-10-07T11:32Z
- **Completed:** 2026-10-07T11:48Z
- **Tasks:** 2 of 2
- **Files:** 5 created

## Accomplishments

- **SnapshotKeyFigures** renders a `<dl>` with six terms in contract order, each with its definition line. The grid is 1, 2 or 3 columns on screen. With `print`, it is 2 columns and gets `.print-keep`. Values use the Figure role (24/600, tabular).
- **ListingsSummaryTable** sits in a focusable `overflow-x-auto` region named by its caption ("Active {homes for sale | rentals} in ZIP {zip} that RentCast saw on {Mon D, YYYY}: {n} listings. Counts and ranges only. Individual listings aren't shown."). It has the five `scope="col"` headers and `bedroomLabel` row headers, and contains no link and no image. A test passes a leaky input carrying extra fields and shows none of them render.
- **ZipPicker** has three modes:
  - Watched-ZIP radio rows, each with "Saved {relative}" or "Not saved in this browser" and a cost label, then **Another ZIP code**, which reveals the input.
  - The input shown directly with the no-watched helper.
  - Sample mode: the six fixture rows with SampleChips, plus the note and the **Add a RentCast key** link to `/settings/#api-keys`.

  The **Load ZIP data {CostLabel}** button shows **Loading…** with a spinner while it runs, and the picker sets `aria-busy`. Success announces "ZIP {zip} loaded. Median rent {value}." (in sample mode, "… from sample data."), calls `onLoaded` and focuses the `h3`. A failure renders GatewayError. "Not now" on the cap prompt leaves the screen unchanged.
- **SnapshotSectionToggles** covers step 2:
  - The six section rows, all checked, with the contract descriptions. A live `validateSections` message appears when no data section is checked; market notes alone don't count.
  - The opt-in **Active listings summary (1 call)**. Checking it reveals the **Homes for sale** / **Rentals** chips and **Load listings summary {CostLabel}**. A successful load renders the ProvenanceChip and the ListingsSummaryTable, then announces "Listings summary loaded: {n} listings."
  - **Branding and statements**: the BrandPreview, the fallback notes, **Edit logo and colors in your profile**, the EHO checkbox (checked) with the HUD statement below it, the Tran-footer checkbox (checked), and the always-included note.

## Task Commits

1. **Task 1: SnapshotKeyFigures and ListingsSummaryTable (shared with print):** `5360498` (feat)
2. **Task 2: ZipPicker (step 1) and SnapshotSectionToggles (step 2):** `229dbf3` (feat)

Both commits used an explicit pathspec after `git diff --cached --name-only`. Each task's tests went in with its implementation in a single feat commit, using the plan's messages.

## Verification

Every Node command ran through the single-core wrapper, mask 0x200.

- `vitest --project web snapshot-components`: **22/22**. That is 7 for Task 1 and 15 for Task 2: SSR renders of all four components, plus the pure choice, load, validation, announcement, cost-mapping and fallback-note helpers.
- The SSR renders inject a spy `SnapshotData`, and every case asserts that no method was called. `loadChosenZip` is proven to return before any gateway call on invalid input, and to call `loadZipData` exactly once with the chosen ZIP on valid input. The keyless outside-coverage `NoResults` is returned as an error, and a non-gateway error is rethrown.
- Regression over `apps/web/src/lib/features/studio`: 5 files, **72/72**.
- `pnpm check`: 0 errors, 0 warnings (2569 files). `pnpm banned`: passed (360 files).
- `pnpm lint`: `prettier --check .` reported "All matched files use Prettier code style!". The first `eslint .` run crashed on ENOENT for `apps/web/tests/e2e/zz-tmp-studio-hub-probe.spec.ts`, a temporary probe file the concurrent 09-12 executor deleted mid-run. The rerun of `eslint .` was clean, and scoped eslint and prettier on all five files are clean.
- Acceptance greps:
  - Every required string is present in its file. The EHO sentence and the always-included note are single-line module constants, so they grep exactly.
  - `ListingsSummaryTable.svelte` has no `address|photo|agentName|listingAgent|<img`.
  - The `$effect`s in ZipPicker and SnapshotSectionToggles never call `loadZipData` or `loadListingsSummary`. SnapshotSectionToggles has no `$effect` at all.
  - `SnapshotKeyFigures.svelte` contains `snapshotFigureValues`.
- All .ts sources are ASCII-only. The test builds U+00B7 with `String.fromCharCode` and uses `NOT_AVAILABLE` for the dash. The .svelte files hold literal `…` per repo practice.
- No build or Playwright run was made, as the briefing requires. `apps/web/test-results/` was already there and belongs to the concurrent Playwright owner, so I left it alone.

## Deviations from Plan

### Interface additions (no behaviour change to the contract)

**1. Optional injection props.** ZipPicker and SnapshotSectionToggles accept `data?: SnapshotData` and `now?: number`, and ZipPicker also takes `options?: readonly ZipOption[]` and a bindable `busy`. Without `data`, both use the app runtime from Svelte context. These props let the SSR tests prove that nothing is read or spent.

**2. `profile` widened.** It accepts `AgentProfile | ProfileInput | null`, because the shipped sample agent is a `ProfileInput` (the same adaptation 09-14 made).

**3. The binding is reassigned, never mutated.** SnapshotSectionToggles updates `value` by reassignment rather than with `bind:checked` on nested fields. That avoids an ownership mutation of the parent's object.

**4. Provenance is not stale.** The loaded ZIP's ProvenanceRow is built from `ZipData` with `stale: false`, because 09-14's `ZipData` carries no stale flag. A stale cache entry shows as live. Covering it would need a field on `snapshot-data.ts` (09-14's file), so I didn't change it.

**Total deviations:** 0 auto-fixes and 4 interface notes. Nothing outside files_modified was touched.

## Issues Encountered

- One `eslint .` crash, caused by another executor's temporary file. It was transient, as described above.
- `svelte/no-navigation-without-resolve` doesn't honour a `disable-next-line` placed above a multi-line `<a>`. I used a block disable/enable pair around the Settings link instead.

## Requirements

STU-04 is advanced. Per the briefing, I did not run `requirements mark-complete`, because the 09-23 phase gate closes requirement ids.

## Known Stubs

None. The builder page (09-17) composes these components, and the print route (09-18) reuses SnapshotKeyFigures and ListingsSummaryTable.

## Self-Check: PASSED
