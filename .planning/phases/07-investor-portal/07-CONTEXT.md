# Phase 7: Investor Portal - Context

**Gathered:** 2026-10-04
**Status:** Ready for planning

<domain>
## Phase Boundary

The Investor portal under `/investor/`: deal analyzer (pure finance math), manual/autofill modes, saved deals + side-by-side compare, buy-box saved searches over for-sale listings with quick metrics, watched-zip dashboards (rent trend, price-to-rent), AI investment memo printed to PDF via the `(print)` pipeline. Requirements INV-01..06.

This phase establishes the `(print)` route pattern + print CSS and the zip market-stats dashboard components that Phase 9 reuses.

</domain>

<decisions>
## Implementation Decisions

The owner chose fully autonomous mode on 2026-10-04. Recommended defaults adopted.

### Finance core
- `packages/core/src/finance/`: pure, property-tested functions — NOI, cap rate, monthly cash flow, cash-on-cash, DSCR, GRM, 1% rule, plus amortization (P&I) and vacancy/management/maintenance/capex/insurance/tax/HOA expense lines. All money in integer cents internally; outputs rounded for display only.
- **Reference cases:** a fixture of ≥8 hand-checked deals (with worked math in comments) asserted exactly; property tests for monotonicity (higher rent → higher NOI, etc.) and no-NaN invariants.

### Analyzer
- `/investor/analyze/`: purchase price, down payment %, rate, term, closing costs, rent, other income, editable expense lines (defaults as % of rent or fixed), results panel with each metric labeled and a one-line definition tooltip. Fully manual = **0 calls**.
- **Autofill** button per field group: "Autofill rent estimate (1 call)" / "Autofill value estimate (1 call)" via the Phase 4 gateway with cost shown first and provenance chips on filled values; user can overwrite.
- **Save deal** (Dexie, backup-registered); `/investor/deals/` list; **compare** up to 3 deals side by side in a metric table with best-in-row highlighting (color + icon, never color alone).

### Buy-box & dashboards
- **Buy-box saved search:** for-sale listings by location + price/beds/type + target cap rate / 1% threshold; on app open the Phase 4 scheduler re-runs due searches; new matches show quick metrics computed from zip-median rent (0 extra calls) with a "Deep analyze (2 calls)" action that opens the analyzer with autofill.
- **Dashboards** `/investor/markets/`: up to 5 watched zips from the shared market-stats cache; LayerChart line charts for rent trend (by bedroom) and price-to-rent ratio; "as of" stamps; adding a zip costs 1 call (shown first) only if not cached.

### Memo & print
- Prompt `investor/memo.v1` receives ONLY analyzer outputs + user notes; the LLM narrates, never computes — a post-check asserts every number in the memo text appears in the analyzer output set (tolerant formatting), flagging any other numeral.
- `/print/memo/` (query param deal id) renders the memo + metric tables with print CSS (`@page`, page-break rules), a "Not investment, legal, or tax advice" disclaimer, and the data provenance line; user prints to PDF via the browser. pdfmake is NOT used in this phase (browser print is the pipeline; Phase 9 may add pdfmake if needed).
- Memo passes the Fair Housing checker (neighborhood descriptions are the risk) and exits only via copy/print/mailto.

### Demo credibility
- Every investor route works keyless on fixtures; E2E with mocks; axe on all routes incl. the print route.

### Claude's Discretion
- Expense default percentages; chart styling within tokens; compare table layout at 375px (stacked cards).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 4 gateway (`saleListings`, `valueEstimate`, `rentEstimate`, `marketStats`), scheduler, meter/cost/cap/provenance components, fixtures.
- Phase 5 `GenerationPanel`, checker; Phase 3 repos/backup; Phase 2 tokens; `(print)` group layout from Phase 1 (chrome-free).

### Established Patterns
- Pure math in `packages/core`; query-param detail routes; feature import boundaries (`investor` never imports `renter`/`agent`).
- LayerChart 2.5 is the sanctioned chart lib (SVG output).

### Integration Points
- `(print)` layout gets print CSS and a shared `PrintReport` shell reused by Phase 9's Market Snapshot.
- Dashboard components (`ZipTrendChart`, `PriceToRentChart`) exported from `features/shared` for Phase 9.

</code_context>

<specifics>
## Specific Ideas

- False-precision guard: estimates show ranges and comp counts; memo wording uses "estimated", "based on N comparables".

</specifics>

<deferred>
## Deferred Ideas

- Sensitivity sliders (INV-V2-01), portfolio tracking (INV-V2-02).
- Cut line: extra metrics (50% rule, break-even) → compare capped at 2 → charts beyond rent trend + price-to-rent.

</deferred>
