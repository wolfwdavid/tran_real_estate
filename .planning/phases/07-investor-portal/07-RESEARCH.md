# Phase 7: Investor Portal - Research

**Researched:** 2026-10-04
**Domain:** Deterministic rental-property finance math, SVG charts under a strict meta CSP, browser print-to-PDF, LLM-narration guardrails (numeric provenance), buy-box alerts over a budgeted API
**Confidence:** HIGH for finance formulas, LayerChart internals, print pipeline, and the post-check algorithm (each verified by a tarball read or a local run). MEDIUM for expense conventions and DSCR flavor, which vary by source. MEDIUM for integration seams with Phases 3-5, which are planned but not executed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

The owner chose fully autonomous mode on 2026-10-04. Recommended defaults adopted.

#### Finance core
- `packages/core/src/finance/`: pure, property-tested functions — NOI, cap rate, monthly cash flow, cash-on-cash, DSCR, GRM, 1% rule, plus amortization (P&I) and vacancy/management/maintenance/capex/insurance/tax/HOA expense lines. All money in integer cents internally; outputs rounded for display only.
- **Reference cases:** a fixture of ≥8 hand-checked deals (with worked math in comments) asserted exactly; property tests for monotonicity (higher rent → higher NOI, etc.) and no-NaN invariants.

#### Analyzer
- `/investor/analyze/`: purchase price, down payment %, rate, term, closing costs, rent, other income, editable expense lines (defaults as % of rent or fixed), results panel with each metric labeled and a one-line definition tooltip. Fully manual = **0 calls**.
- **Autofill** button per field group: "Autofill rent estimate (1 call)" / "Autofill value estimate (1 call)" via the Phase 4 gateway with cost shown first and provenance chips on filled values; user can overwrite.
- **Save deal** (Dexie, backup-registered); `/investor/deals/` list; **compare** up to 3 deals side by side in a metric table with best-in-row highlighting (color + icon, never color alone).

#### Buy-box & dashboards
- **Buy-box saved search:** for-sale listings by location + price/beds/type + target cap rate / 1% threshold; on app open the Phase 4 scheduler re-runs due searches; new matches show quick metrics computed from zip-median rent (0 extra calls) with a "Deep analyze (2 calls)" action that opens the analyzer with autofill.
- **Dashboards** `/investor/markets/`: up to 5 watched zips from the shared market-stats cache; LayerChart line charts for rent trend (by bedroom) and price-to-rent ratio; "as of" stamps; adding a zip costs 1 call (shown first) only if not cached.

#### Memo & print
- Prompt `investor/memo.v1` receives ONLY analyzer outputs + user notes; the LLM narrates, never computes — a post-check asserts every number in the memo text appears in the analyzer output set (tolerant formatting), flagging any other numeral.
- `/print/memo/` (query param deal id) renders the memo + metric tables with print CSS (`@page`, page-break rules), a "Not investment, legal, or tax advice" disclaimer, and the data provenance line; user prints to PDF via the browser. pdfmake is NOT used in this phase (browser print is the pipeline; Phase 9 may add pdfmake if needed).
- Memo passes the Fair Housing checker (neighborhood descriptions are the risk) and exits only via copy/print/mailto.

#### Demo credibility
- Every investor route works keyless on fixtures; E2E with mocks; axe on all routes incl. the print route.

### Claude's Discretion
- Expense default percentages; chart styling within tokens; compare table layout at 375px (stacked cards).

### Deferred Ideas (OUT OF SCOPE)
- Sensitivity sliders (INV-V2-01), portfolio tracking (INV-V2-02).
- Cut line: extra metrics (50% rule, break-even) → compare capped at 2 → charts beyond rent trend + price-to-rent.

### Code context carried from CONTEXT.md
- Reusable: Phase 4 gateway (`saleListings`, `valueEstimate`, `rentEstimate`, `marketStats`), scheduler, meter/cost/cap/provenance components, fixtures. Phase 5 `GenerationPanel`, checker. Phase 3 repos/backup. Phase 2 tokens. `(print)` group layout from Phase 1 (chrome-free).
- Patterns: pure math in `packages/core`; query-param detail routes; feature import boundaries (`investor` never imports `renter`/`agent`). LayerChart 2.5 is the sanctioned chart library (SVG output).
- Integration: `(print)` layout gets print CSS and a shared `PrintReport` shell that Phase 9's Market Snapshot reuses. Dashboard components (`ZipTrendChart`, `PriceToRentChart`) are exported from `features/shared` for Phase 9.
- Specific: false-precision guard. Estimates show ranges and comp counts, and memo wording uses "estimated" and "based on N comparables".
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INV-01 | Analyze a property for NOI, cap rate, monthly cash flow, CoC, DSCR, GRM, and the 1% rule, with editable expense lines | §Finance Definitions (formulas and conventions), §Integer-Cents Strategy, §Reference Cases (9 cases computed by script, payment values cross-checked against published amortization values), §Property Invariants (fast-check 4.10.2) |
| INV-02 | Manual entry (0 calls) or autofill of rent/value with cost shown first | Pattern 3 (analyzer state as `$derived(analyze(inputs))`, with no gateway call in any effect), Pattern 4 (autofill via the gateway click handler plus `CostLabel` and `ProvenanceChip`), and the E2E request collector that proves 0 RentCast requests |
| INV-03 | Save deals and compare side by side | Dexie `deals` table storing inputs only, with outputs recomputed. `core.finance.compare()` gives best-in-row with metric direction and ties. Compare table a11y pattern plus stacked cards at 375px |
| INV-04 | Buy-box saved searches over for-sale listings with new matches and quick metrics on open | RentCast `/v1/listings/sale` params (verified), the Phase 4 scheduler and `diffSnapshots`, `core.finance.quickMetrics()` from cached zip-median rent (0 calls), and "Deep analyze (2 calls)", which spends in the click handler and then navigates |
| INV-05 | Rent-trend and price-to-rent dashboards for ≤5 watched zips | RentCast market-stats `history` / `dataByBedrooms` shape (verified). LayerChart 2.5.1 internals (client-only render, `props.svg` passthrough, per-series dash and markers, token mapping). `<figure>` + data-table fallback |
| INV-06 | AI memo with analyzer-only numbers, printed to PDF with a disclaimer | Numeric post-check algorithm (prototyped and run), a template-driven Fixture memo, the `GenerationPanel` validator seam, the `(print)/print/memo/` route, print CSS, and Playwright `emulateMedia` + `page.pdf()` page counting (verified locally on Playwright 1.63) |
</phase_requirements>

## Summary

Phase 7 is mostly deterministic code with a thin AI layer, and most of the risk sits in **conventions, not libraries**. The metric formulas are simple and well defined: cap rate = NOI ÷ price, CoC = annual pre-tax cash flow ÷ total cash invested, GRM = price ÷ gross annual rent, 1% rule = monthly rent ≥ 1% of price, and the standard amortizing payment. The sources diverge on three choices, and the plan must fix each one and show it to the user: (1) whether CapEx reserves sit above NOI (DealCheck lists CapEx as an operating expense; commercial underwriting often doesn't), (2) the DSCR flavor (NOI ÷ annual debt service vs. the residential-lender "rent ÷ PITIA"), and (3) the base each percentage line applies to (gross rent vs. collected income). Recommended choices are below. A script computed the nine reference cases, and the payment function reproduces the published values ($100k at 6%/30y = $599.55; $200k at 6.5%/30y = $1,264.14; $200k at 7%/30y = $1,330.60).

LayerChart **2.5.1** (published 2026-10-01; the stack note says 2.5.0) was read from its tarball. It is CSP-safe here: no `{@html}`, no runtime `<style>` injection, and component `<style>` blocks compile into Kit's external CSS (`style-src 'self'`). It uses `style:` directives, which are inline style attributes already allowed by `style-src-attr 'unsafe-inline'`. By default (`ssr = false`) `Chart` renders **nothing on the server**, so prerendered HTML never contains a chart and wrappers must supply the static placeholder and data table. It reads CSS variables (`--color-primary`, `--color-surface-content`, `--color-surface-100`) that Phase 2's token set doesn't define, and its axis labels are 10px/300. Both need a small app-level override to meet Phase 2's 14px minimum and contrast rules. `props.svg` forwards attributes to the `<svg>`, so `role="img"` + `aria-label` replace its default `role="figure"`. Per-series `props` accept `stroke-dasharray` and `markerMid`/`markerEnd` (`circle | square | triangle | …`), so series can be told apart without color.

The print pipeline is browser-native: a `(print)/print/memo/` page reads `?deal=` **only in `onMount`**, because accessing `url.searchParams` during prerender throws. It renders a shared `PrintReport` shell with `@page` / `break-inside` rules and a "Print or save as PDF" button that awaits `document.fonts.ready` and then calls `window.print()`, which is allowed under CSP because it's a bundled handler. Playwright 1.63 in this repo was verified locally: `page.emulateMedia({ media: 'print' })` hides `@media print`-hidden controls, and `page.pdf({ preferCSSPageSize: true })` yields a PDF whose `/Count N` gives the page count. The memo's numeric post-check was prototyped (regex extraction of currency, percent, multiplier, k/M scale, and sign). It correctly flagged the invented numbers (`20%`, `-5%`, an invented `1,800–2,100` range) in a sample memo and passed natural rounding (`7.5%` for 7.488%, `$15,000` for $14,976) under the recommended rule: a match within the half-unit of the last displayed digit, or within 0.5% when the numeral has 2 or more significant digits.

**Primary recommendation:** Build `packages/core/src/finance/` first. Use an integer-cents, monthly-canonical model with exact integer basis-point math and null (never NaN or Infinity) for undefined ratios, and gate it with 9 exact reference cases plus fast-check invariants. Then layer the analyzer, deals/compare, buy-box, markets, and memo/print on top. Every number shown or narrated derives from `analyze()` output, and the memo's allowed-number set is extracted from the exact FACTS text sent to the model.

## Standard Stack

### Core
| Library | Version (verified 2026-10-04) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `layerchart` | **2.5.1** (npm `latest`, published 2026-10-01) | Rent-trend and price-to-rent SVG line charts | Sanctioned in CONTEXT/CLAUDE.md. Svelte-5-native, SVG output (vector in print), peer `svelte ^5`. 2.5.1 supersedes the 2.5.0 in STACK.md: pin `2.5.1`. Pulls `runed ^0.37.1` (Phase 3 also pins 0.37.1, so there's no duplicate) plus d3 modules. |
| `fast-check` | **4.10.2** (published 2026-09-19; engines node ≥12.17; sole dep `pure-rand`) | Property-based tests for `core/finance` and the memo post-check | The de facto JS PBT library. Not installed yet: **add as a devDependency of `packages/core`**. |
| Dexie | 4.4.6 (Phase 3 installs it) | `deals`, buy-box saved searches, `watchedZips` | Already the platform store, with the backup registry. |
| `@playwright/test` + `@axe-core/playwright` | 1.63.0 / 4.13.0 (installed) | E2E, print emulation, PDF page count, axe | Already the repo harness (root and sub bases). |
| Vitest | 4.1.11 (installed; projects `core`, `web`, `scripts`) | Unit and property tests | Network is blocked by `tooling/vitest/no-network.ts`. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@fast-check/vitest` | 0.5.0 (peer `vitest ^4.1 \|\| ^5`) | `test.prop([...])` sugar | **Optional.** Plain `fc.assert(fc.property(...))` inside `it()` is enough and adds no dependency. Recommend plain fast-check. |
| `Intl.NumberFormat` (built in) | Node 24 / evergreen browsers | Currency and percent display, memo FACTS strings | Always. A single `format.ts` in core is the only formatter, so the post-check parser and the formatter round-trip. |
| `@lucide/svelte` | 1.45.0 (Phase 2) | Best-in-row icon, chart and print icons | Verify `Trophy`/`Award`/`ArrowUp`/`ArrowDown`/`Printer`/`ChartLine` names at build (same practice as Phase 4 note 6). |
| date-fns | 4.4.0 (Phase 4) | "as of" relative stamps | Via Phase 4 `ProvenanceChip`. Don't re-implement. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Integer cents + `number` | `BigInt` or decimal.js | Cents × basis points stays below 2^53 for any realistic price (≤ $100M × 10,000 bps = 10^15), so plain integers are exact. `BigInt` adds friction with `Math.pow` (payment) and JSON. Not needed. |
| Browser print | pdfmake 0.3.11 | Locked out of Phase 7 by CONTEXT. |
| LayerChart `LineChart` | Hand-drawn SVG `<polyline>` | Hand-rolling loses axes, ticks, scales, and time formatting. LayerChart is sanctioned. |
| `@fast-check/vitest` | Plain fast-check | Optional sugar only. |

**Installation:**
```bash
pnpm --filter @tran/core add -D fast-check@4.10.2
pnpm --filter web add layerchart@2.5.1
```
(Phase 3/4/5 dependencies such as Dexie, bits-ui, runed, and lucide are assumed installed by those phases. Phase 7 must not add them again with different pins.)

## Architecture Patterns

### Recommended Project Structure
```
packages/core/src/finance/
├── money.ts            # Cents type, mulBps (exact integer half-away rounding), parseMoneyInput, toCents
├── format.ts           # the ONLY display/FACTS formatter (Intl en-US): usd(cents), pct(n,dp), ratio(n,dp)
├── amortization.ts     # monthlyPayment(principalC, annualRatePct, years) (+ optional schedule)
├── expenses.ts         # ExpenseLine model + DEFAULT_EXPENSES + lineMonthlyCents()
├── analyze.ts          # analyze(DealInputs): DealAnalysis — pure, null for undefined ratios
├── compare.ts          # METRIC_DIRECTION + bestInRow(analyses) with ties
├── quick-metrics.ts    # quickMetrics(listing, zipMedianRent, buyBoxAssumptions)
├── market-series.ts    # rentTrendSeries(stats, beds[]), priceToRentSeries(stats) from history
├── memo-facts.ts       # buildMemoFacts(analysis, provenance, notes) -> {factsText, allowed}
├── numeric-check.ts    # extractNumerals(text), checkNumbers(text, allowed) -> Finding[]
├── reference-cases.ts  # the 9 hand-checked fixtures (exported for tests + docs)
└── *.test.ts           # exact cases + fast-check properties

apps/web/src/lib/features/investor/       # investor-only UI + stores (never imported by renter/agent)
├── analyzer/  (DealForm, ExpenseLinesEditor, ResultsPanel, MetricTerm toggletip, AutofillButton)
├── deals/     (dealsRepo.ts — Dexie, backup-registered; DealList; CompareTable; CompareCards)
├── buybox/    (buyBoxRepo, BuyBoxForm, MatchList w/ QuickMetrics, DeepAnalyzeButton)
├── memo/      (memo.v1 prompt registration incl. sample(inputs) renderer; MemoPanel wrapper)
apps/web/src/lib/features/shared/charts/  # exported for Phase 9
├── ZipTrendChart.svelte, PriceToRentChart.svelte, ChartFigure.svelte (figure+caption+table fallback)
apps/web/src/lib/features/shared/print/
├── PrintReport.svelte  # shell: header, provenance line, disclaimer, slots; print CSS
└── print.css           # @page + break rules (imported by (print) layout)

apps/web/src/routes/(app)/investor/
├── +page.svelte                 # hub: buy-box new-match summary, links
├── analyze/+page.svelte         # ?deal= (edit) | ?listing= (from buy-box) — read in onMount
├── deals/+page.svelte
├── compare/+page.svelte         # ?ids=a,b,c
├── buy-box/+page.svelte
├── markets/+page.svelte
└── memo/+page.svelte            # ?deal= — GenerationPanel + "Print or save as PDF" link
apps/web/src/routes/(print)/print/memo/+page.svelte   # ?deal= — PrintReport
```
Route slugs are at the planner's discretion, but every new route must be added to the shared e2e route list (Phase 2 `tests/e2e/routes.ts`) **and** `scripts/assert-csp.mjs` `EXPECTED_PAGES`. That file deliberately duplicates the list.

### Finance Definitions (the contract; tooltips quote these)

All amounts are **monthly integer cents**. Annual figures equal monthly × 12 exactly.

| Term | Definition (as implemented) | Source / note |
|------|-----------------------------|---------------|
| Loan amount | price − down payment, where down = mulBps(price, downBps) | standard |
| Monthly P&I | `M = L·r(1+r)^n / ((1+r)^n − 1)`, r = annual%/1200, n = years·12. If r = 0, `M = L/n`. Rounded half-away to cents | Standard annuity formula. Values match published tables (see Reference Cases). |
| Gross scheduled income (GSI) | rent + other income | |
| Vacancy | mulBps(GSI, vacancyBps) | % of gross scheduled income (common analyzer convention) |
| Effective gross income (EGI) | GSI − vacancy | |
| Management | mulBps(EGI, mgmtBps). **% of collected income**, because managers charge on collected rent | MEDIUM (some calculators use gross rent) |
| Maintenance, CapEx reserve | mulBps(rent, bps). % of gross rent | BiggerPockets/DealCheck-style |
| Taxes, insurance | fixed annual → monthly = round(annual/12) **once at normalization**, or % of price / yr → round(price·bps/120000) | |
| HOA, utilities, other | fixed monthly | |
| Operating expenses (OpEx) | management + maintenance + CapEx + taxes + insurance + HOA + utilities + other. **CapEx is included** (DealCheck lists CapEx among operating expenses). The tooltip says so. | MEDIUM: commercial underwriting may put reserves below NOI |
| NOI | EGI − OpEx. Excludes debt service and income tax. | DealCheck/Investopedia |
| Monthly cash flow | NOI − monthly P&I | |
| Cap rate | annual NOI ÷ purchase price. Independent of financing. | standard |
| Total cash invested | down payment + closing costs (+ optional upfront repairs, default 0) | |
| Cash-on-cash | annual cash flow ÷ total cash invested. `null` if cash invested = 0 | |
| DSCR | annual NOI ÷ annual debt service (12 × P&I). `null` if there's no loan. Labeled "DSCR (NOI ÷ debt payments)". The tooltip notes that many residential DSCR lenders instead use rent ÷ PITIA. | Two lender conventions exist (search 2026). MEDIUM |
| GRM | price ÷ (rent × 12), using gross scheduled rent before vacancy and excluding other income. `null` if rent = 0 | Wikipedia/industry |
| 1% rule | pass ⇔ rent × 100 ≥ price (integer compare, so it's exact at the boundary). Display rent ÷ price as a %. | rule of thumb |
| Price-to-rent (market) | median listing price ÷ (median rent × 12) per month from market-stats history. Labeled **"asking price-to-rent"**, because RentCast sale data are on-market listing prices, not closed sales. | Common definition (median price ÷ median annual rent) |

**Recommended default expense lines (discretion, all editable and labeled "starting assumption"):** vacancy 5% of GSI · management 8% of EGI · maintenance 5% of rent · CapEx 5% of rent · property tax 1.0% of price/yr (copy: "varies widely by county; enter your tax bill") · insurance 0.5% of price/yr · HOA $0/mo · utilities $0/mo. The interest rate is pre-filled as an example (7.00%) with the copy "enter your lender's quote". Never fetch or claim a "current market rate".

### Integer-Cents Strategy
- Inputs are parsed by `parseMoneyInput("$1,234.56") → 123456`, which rejects NaN, negative prices, and more than 2 decimals. Percent lines are stored as **integer basis points** (5.5% = 550). The **interest rate is a number in percent with ≤3 decimals** (7.125% isn't an integer in bps). It's used only in the float payment formula, whose result is rounded once to cents.
- `mulBps(cents, bps)` must round exactly: `n = cents*bps` (an exact integer < 2^53). Then `q = trunc(n/10000)`, `r = n % 10000`, and adjust by `|r| ≥ 5000` with sign. **Never** use `Math.round(cents*bps/10000)`: float division can land on x.4999999, and `Math.round(-2.5) = -2`.
- All sums are integer adds. Ratios are floats computed at the end from integers, and display rounding happens only in `format.ts`.
- Undefined ratio → `null`, never NaN or ±Infinity. The UI shows "Not applicable (no loan)" and similar.
- Known rounding consequence: an annual tax of $2,401 becomes 20008 c/mo, so the annual display is $2,400.96. This is documented in the tooltip ("monthly figures are rounded to the cent; annual = 12 × monthly").

### Reference Cases (computed 2026-10-04 by script; assert EXACT integers, ratios to 1e-9)

Inputs are in cents and bps; rate is in percent. Shared defaults: other = 0, HOA = 0, utilities = 0, rehab = 0. Expected values: P = monthly P&I, EGI, OpEx, NOI = monthly NOI, CF = monthly cash flow, cash = total cash invested.

| # | Case | Inputs | Expected |
|---|------|--------|----------|
| A | Baseline SFR | price 20,000,000; down 2000; rate 7; 30y; closing 600,000; rent 200,000; vac 500; mgmt 800; maint 500; capex 500; tax 20,000/mo; ins 10,000/mo | loan 16,000,000; **P 106,448** ($1,064.48, matches published $160k@7%/30y); vacancy 10,000; EGI 190,000; mgmt 15,200; OpEx 65,200; **NOI 124,800** (annual 1,497,600); **CF 18,352** (annual 220,224); cash 4,600,000; **cap 7.488%**; **CoC 4.787478…%**; **DSCR 1.172403…**; GRM 8.3333…; 1% rule pass (exactly 1.00%) |
| B | All cash | price 15,000,000; down 10000; closing 300,000; rent 150,000; vac 500; mgmt 0; maint 500; capex 500; tax 15,000; ins 8,000 | loan 0; P 0; EGI 142,500; OpEx 38,000; NOI 104,500; CF 104,500 (= NOI); cash 15,300,000; cap 8.36%; CoC 8.196078…%; **DSCR null**; 1% pass |
| C | 0% rate (division guard) | price 12,000,000; down 2500; rate 0; 15y; closing 0; rent 120,000; all % 0; tax 10,000; ins 5,000 | loan 9,000,000; **P 50,000** (= L/180); NOI 105,000; CF 55,000; cash 3,000,000; cap 10.5%; CoC 22%; DSCR 2.1 |
| D | Negative cash flow + HOA | price 40,000,000; down 2000; 7.5; 30y; closing 1,200,000; rent 250,000; vac 500; mgmt 1000; maint 500; capex 500; tax 40,000; ins 15,000; HOA 25,000 | loan 32,000,000; **P 223,749** ($2,237.49 published for $320k@7.5%); EGI 237,500; mgmt 23,750; OpEx 128,750; NOI 108,750; **CF −114,999**; cash 9,200,000; cap 3.2625%; CoC −14.99987%; DSCR 0.486036…; GRM 13.333…; 1% **fail** (0.625%) |
| E | 1% boundary, 8% vacancy | price 10,000,000; down 2500; 6; 30y; closing 300,000; rent 100,000; vac 800; mgmt 800; maint 500; capex 500; tax 10,000; ins 6,000 | loan 7,500,000; P 44,966; vacancy 8,000; EGI 92,000; mgmt 7,360; OpEx 33,360; NOI 58,640; CF 13,674; cash 2,800,000; cap 7.0368%; CoC 5.860286%; DSCR 1.304096…; **1% pass at exact boundary** |
| F | Duplex + other income + utilities | price 30,000,000; down 2500; 6.5; 30y; closing 900,000; rent 320,000; other 10,000; vac 500; mgmt 800; maint 600; capex 500; tax 30,000; ins 12,000; util 15,000 | GSI 330,000; vacancy 16,500; EGI 313,500; mgmt 25,080; maint 19,200; capex 16,000; OpEx 117,280; P 142,215; NOI 196,220; CF 54,005; cash 8,400,000; cap 7.8488%; CoC 7.715%; DSCR 1.379742…; **GRM 7.8125 (rent only)**; 1% pass (1.0667%) |
| G | Zero rent (null guards) | price 10,000,000; down 2000; 7; 30y; closing 0; rent 0; vac 500; mgmt 800; maint 500; capex 500; tax 10,000; ins 5,000 | P 53,224; NOI −15,000; CF −68,224; cap −1.8%; CoC −40.9344%; DSCR −0.281828 (shown, negative); **GRM null**; 1% fail |
| H | Odd numbers (rounding stress) | price 17,777,700; down 3333; 6.25; 15y; closing 444,444; rent 177,777; vac 333; mgmt 777; maint 500; capex 500; tax 18,518; ins 9,259 | down 5,925,307; loan 11,852,393; P 101,625; vacancy 5,920; EGI 171,857; mgmt 13,353; maint 8,889; capex 8,889; OpEx 58,908; NOI 112,949; CF 11,324; cash 6,369,751; cap 7.624091%; CoC 2.133333%; DSCR 1.111429… |
| I | Published-payment anchor | price 12,500,000; down 2000; 6; 30y; everything else 0; rent 125,000 | loan 10,000,000; **P 59,955** ($599.55, the textbook $100k@6%/30y); NOI 125,000; CF 65,045 |

Extra anchors for `amortization.test.ts`: $200,000 @ 6.5% / 30y → 126,414 c ($1,264.14). $200,000 @ 7% / 30y → 133,060 c ($1,330.60). Each case file carries worked math in comments, e.g. for A: `vacancy = 200000×500/10000 = 10000; EGI = 190000; mgmt = 190000×0.08 = 15200; …`.

### Property Invariants (fast-check; generators bounded to realistic ranges)
1. **No NaN/Infinity:** for every generated valid input, every numeric output is finite or `null`.
2. **Identities:** `cashFlow === noi − payment`; `annual === 12 × monthly`; `egi === gsi − vacancy`; `opex === Σ lines`.
3. **Cap rate is financing-independent:** changing down%, rate, or term doesn't change NOI or cap rate.
4. **Monotonic in rent:** with Σ(% lines) ≤ 60% and a rent step ≥ 100 c, NOI(rent + step) ≥ NOI(rent). Per-line rounding is at most ½ cent per line, so steps of $1 or more are safe. Test the inequality, not strict growth.
5. **Payment:** non-decreasing in rate, non-increasing in term, `P·n ≥ L` for r > 0, and |P·n − L| ≤ n/2 c at r = 0. **All-cash ⇒ P = 0, DSCR = null, CF = NOI.**
6. **1% rule boundary:** `rent·100 === price ⇒ pass`.
7. **mulBps:** matches a BigInt reference implementation for random (cents, bps) pairs, including negatives.
8. **Formatter/parser round-trip:** `parseMoneyInput(usd(c)) === c`, and `extractNumerals(usd(c))[0].value === c/100`.

### Pattern 1: Pure analyze() with null-safe ratios
```typescript
// packages/core/src/finance/money.ts
export type Cents = number; // integer
export function mulBps(c: Cents, bps: number): Cents {
	const n = c * bps; // exact: |n| < 2^53 enforced by input validation
	const q = Math.trunc(n / 10000);
	const r = n - q * 10000;
	return Math.abs(r) >= 5000 ? q + Math.sign(r) : q; // half away from zero, exact
}
const ratio = (num: number, den: number): number | null => (den === 0 ? null : num / den);
```
```typescript
// packages/core/src/finance/amortization.ts
export function monthlyPayment(principal: Cents, annualRatePct: number, years: number): Cents {
	if (principal === 0) return 0;
	const n = years * 12;
	if (annualRatePct === 0) return roundHalfAway(principal / n);
	const r = annualRatePct / 1200;
	const f = Math.pow(1 + r, n);
	return roundHalfAway((principal * r * f) / (f - 1));
}
```

### Pattern 2: Client-only chart inside an accessible figure (LayerChart 2.5.1)
**What:** `Chart` returns nothing when `typeof window === 'undefined'` (verified in `Chart.base.svelte`: `{#if ssr === true || typeof window !== 'undefined'}`), so the prerendered HTML has an empty container. The wrapper owns height, caption, summary, and the table fallback.
```svelte
<!-- lib/features/shared/charts/ZipTrendChart.svelte (sketch) -->
<script lang="ts">
	import { LineChart } from 'layerchart';
	let { rows, series, title, summary, asOf }: Props = $props(); // rows from core.market-series
	const DASH = ['', '6 3', '2 3', '8 3 2 3', '1 3']; // series 0..4
	const MARK = ['circle', 'square', 'triangle', 'circle-stroke', 'square-stroke'] as const;
	const COLOR = ['var(--color-foreground)', 'var(--color-primary)', 'var(--color-secondary)',
		'var(--color-muted-foreground)', 'var(--color-border-strong)']; // all ≥3:1 on background
</script>
<figure aria-labelledby="{id}-cap" class="chart-figure">
	<figcaption id="{id}-cap">{title} <ProvenanceChip … /></figcaption>
	<div class="h-64"> <!-- explicit height: LayerChart sizes to 100% of the parent -->
		<LineChart data={rows} x="month" {...}
			series={series.map((s, i) => ({ key: s.key, label: s.label, color: COLOR[i],
				props: { 'stroke-dasharray': DASH[i] || undefined, markerMid: MARK[i], 'stroke-width': 2 } }))}
			legend
			props={{ svg: { role: 'img', 'aria-label': summary } }} />
	</div>
	<details><summary>Show the data as a table</summary><table>…</table></details>
</figure>
```
`summary` is a sentence produced by core, e.g. "2-bedroom median rent went from $1,450 in Oct 2024 to $1,620 in Sep 2026." Because `role="img"` makes the SVG's children presentational, screen readers don't read tick soup. The legend renders as HTML (outside the SVG) and includes each series' dash or marker sample, so color isn't the only cue.

**Token mapping (add once to `app.css`, unlayered so it beats LayerChart's `@layer components :where()` rules):**
```css
.lc-root-container, .lc-tooltip-root {
	--color-surface-content: var(--color-foreground);
	--color-surface-100: var(--color-card);
	--color-surface-200: var(--color-surface);
	--lc-user-select: text;
}
:where(.lc-axis-tick-label, .lc-axis-label) { font-size: 0.875rem; font-weight: 400; } /* Phase 2: no text < 14px */
```

### Pattern 3: Analyzer state = derived pure math (0 calls by construction)
`let inputs = $state(defaultInputs()); const result = $derived(analyze(normalize(inputs)));`. The gateway is touched only in `AutofillButton`'s `onclick`. Phase 4's lint/unit guard (no gateway calls in `$effect`) already covers this. Add an E2E request collector as the user-visible proof.

### Pattern 4: Autofill and "Deep analyze" spend in the click handler, then render from cache
- Analyzer autofill: `onclick → gateway.rentEstimate(req)` (cost shown via `CostLabel` from `gateway.estimateCost(req)`). This handles cap → `CapConfirmDialog` and errors → `GatewayError`. Write the value into the input with `provenance` stored per field (`{source, fetchedAt, range, comps}`), and show a `ProvenanceChip` next to the field. A manual edit clears that field's provenance ("entered by you").
- Buy-box "Deep analyze (2 calls)": run **both** gateway calls in the click handler on the buy-box page (sequentially, each through the cap check), then `goto(resolve('/investor/analyze/') + '?listing=' + id)`. The analyzer reads listing, rent, and value from the gateway **cache** in `onMount` (`(0 calls · cached)`). Never let page load spend calls.
- False-precision guard: the rent estimate shows `rentRangeLow–High` and "based on N comparables". If comps < 3, add a low-confidence badge (Phase 6 convention).

### Pattern 5: Memo = FACTS in, narration out, numeric post-check gate
1. `buildMemoFacts(analysis, provenance, notes)` returns `factsText`, a labeled list of **pre-formatted strings** from `format.ts` (e.g. `Monthly cash flow: $183.52`). It also returns `allowed`, built by running `extractNumerals(factsText)` over the exact text that is sent. Whatever is in the prompt is allowed, and nothing else is.
2. Prompt `investor/memo.v1` (system, in addition to Phase 5's property-not-people fragment): "Use only numbers that appear in FACTS, copied exactly as written. Do not calculate, round, sum, convert, annualize, or estimate any new number. Write numbers as digits. Do not describe the neighborhood, its residents, schools, safety, or who the property suits. Do not recommend buying or selling. Use 'estimated' for estimates, and 'based on N comparables' where FACTS gives N."
3. After the stream ends (and after every edit, debounced like the FH checker), run `checkNumbers(text, allowed)` → `Finding[]` with `severity: 'block'` and category `numeric-provenance` ("This number isn't in your analysis. Remove it or replace it with a number from the analysis."). Render the findings through the same `FairHousingText` marks.
4. **Integration seam (must be planned):** Phase 5's `GenerationPanel` has props `feature, promptId, inputs, …`, exactly three exits, and gating driven only by FH findings. Phase 7 needs a backward-compatible prop such as `validators?: ((text: string) => Finding[])[]`, whose findings merge into the gating. Without it, Copy/mailto could export a hallucinated number. If Phase 5 is still being planned, add the prop there. Otherwise, a Phase 7 task extends the component and its exit-count test.
5. Print isn't a panel exit (Phase 5 allows exactly 3). The memo page renders a separate **"Print or save as PDF"** link to `/print/memo/?deal=…`. It's gated by the same latest state (no block findings, warn acknowledged), so the panel must expose its gating state (`bind:status` or an `onstatechange` callback).
6. **Fixture provider:** canned text can't pass the post-check for an arbitrary deal. The memo prompt registration must supply `sample(inputs) => string`, a deterministic template that interpolates `factsText` values. The keyless demo then streams a memo that passes the post-check and the FH checker for any deal. Add a property test over random analyses: `checkNumbers(sample(facts), allowed).length === 0`.
7. Staleness: store `analysisHash` (a hash of normalized inputs + `ANALYZER_VERSION`) on the memo artifact. The print route recomputes the hash. If it differs, show "This memo was written for an earlier version of this deal. Regenerate it before printing." and hide the memo body (tables still print).

**Numeric post-check algorithm (prototyped and run against a sample memo):**
```typescript
// packages/core/src/finance/numeric-check.ts
const NUM = /(?<![\w.])(?<neg>[-−(])?\s?(?<cur>\$)?(?<int>\d{1,3}(?:,\d{3})+|\d+)(?:\.(?<dec>\d+))?\s?(?<scale>k\b|K\b|thousand\b|M\b|million\b)?(?<unit>\s?%|\s?percent\b|x\b|×)?/g;
// Pre-strip (replace with spaces so indices survive): named rules /\b(1|50)%\s+rule\b/gi,
// list enumerators /^\s*\d+[.)]\s/gm. Ranges "1,800–2,100" are handled by the (?<![\w.]) lookbehind
// (the second number parses positive). Accounting "(183.52)" and "−"/"-" are negative.
// value = sign × number × scale; halfUnit = 0.5 × 10^(−decimals) × scale;
// sig = significant digits of the typed numeral (leading zeros dropped; for integers without decimals,
// trailing zeros dropped too, so "15,000" → 2 and "1,064.48" → 6).
// match(n, a) := sign(n) == sign(a) && ( |n − a| ≤ halfUnit + 1e-9
//                                     || (sig(n) ≥ 2 && |n − a| ≤ 0.005 × |a|) )
// Any extracted numeral with no allowed match → Finding{start, end, severity:'block', category:'numeric-provenance'}.
// Spelled-out quantities (/\b(one|two|…|ten|twenty|hundred|thousand|million)\b\s+(percent|dollars)/i) → 'warn'.
```
Prototype result (final rule, run 2026-10-04) on a sample memo with allowed = case A facts: **flagged** `20%` (down % deliberately left out of allowed), `1,800` and `2,100` (an invented range; the en-dash form parsed both numbers as positive, as intended), and `-5%` (invented). **Passed:** `$200,000`, `7.49%`, `≈7.5%` (sig 2, 0.16% off 7.488), `$183.52`, `$2,202.24`, `4.79%`, `1.17x`, `8.3`, `$1,064.48`, `30-year`, `7%`, `$46k`, and `$15,000` (sig 2 after dropping trailing zeros, 0.16% off 14,976). A first version without the relative rule wrongly flagged `$15,000`. Encode all of these as table-driven tests. Note that a low-precision form can collide with a real fact by coincidence (`$0.2 million` matched the $200,000 price). This is acceptable, because the number is then factually present.

### Pattern 6: Print route and shared `PrintReport` shell
```svelte
<!-- routes/(print)/print/memo/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	let state = $state<'loading' | 'missing' | 'stale' | 'ready'>('loading');
	onMount(async () => {
		const id = new URL(location.href).searchParams.get('deal'); // NEVER page.url.searchParams at top level: prerender throws
		…load deal + latest memo artifact from Dexie, recompute analyze(), compare analysisHash…
	});
	async function printNow() { await document.fonts.ready; window.print(); } // bundled handler: CSP-safe
</script>
<PrintReport title="Investment memo" provenance={…} disclaimer={NOT_ADVICE}>…</PrintReport>
<div class="print:hidden" data-ready={state === 'ready' || undefined}><button onclick={printNow}>Print or save as PDF</button> <a href=…>Back to the deal</a></div>
```
```css
/* lib/features/shared/print/print.css (imported by the (print) layout only) */
@page { size: letter; margin: 0.75in; }
@page { @bottom-center { content: "Page " counter(page) " of " counter(pages); font: 10pt var(--font-sans); } } /* Chrome 131+/Safari 18.2+; Firefox ignores it, which is harmless */
@media print {
	html, body { background: #fff; }
	a[href="#main-content"], .print\:hidden { display: none !important; }
	section, figure, table, .metric-card, .disclaimer { break-inside: avoid; }
	h1, h2, h3 { break-after: avoid; }
	thead { display: table-header-group; } /* repeat header rows across pages */
	.best-cell { print-color-adjust: exact; -webkit-print-color-adjust: exact; } /* and it still has icon+text */
	a[href^="http"]::after { content: " (" attr(href) ")"; } /* external links only, never ?deal= links */
}
```
Defining any margin box suppresses Chrome's default header and footer (URL with `?deal=<uuid>`, date), so you don't need to tell users to untick "Headers and footers". Treat this as MEDIUM: support data comes from secondary sources. The disclaimer sits at the **top** and repeats at the **end** of the report (not only in the footer box, which Firefox doesn't render). Don't auto-print on load; the user clicks.

### Pattern 7: Compare table with best-in-row (a11y)
- `core.compare.bestInRow(analyses)` uses `METRIC_DIRECTION = { noi: 'max', capRate: 'max', cashFlow: 'max', coc: 'max', dscr: 'max', grm: 'min', onePct: 'max' }`. Price, cash invested, and payment are **neutral** (no highlight, because "best" price is a judgment). It returns every index tied for best and skips nulls. If all values are equal, there's no highlight.
- ≥640px: `<table>` with `<caption>` ("Comparing 3 saved deals"), `<th scope="col">` per deal (name + address), and `<th scope="row">` per metric. A best cell gets a token background **plus** a Lucide icon (`aria-hidden`) **plus** visible text "Highest" or "Lowest". Never write "best investment" (Phase 2 banned-terms gate).
- <640px: CSS swaps to stacked cards (`hidden sm:table` / `sm:hidden`). There's one card per deal with a `<dl>` of metrics and the same icon+text marker. `display:none` removes the inactive variant from the a11y tree, so there's no duplicate reading. Deal cap 3 is enforced in the UI and core (the cut line allows 2).

### Pattern 8: Buy-box over sale listings
- RentCast `GET /v1/listings/sale` params (verified from the docs): `city`+`state` | `zipCode` | `latitude`+`longitude`+`radius` (≤100 mi), `propertyType` (Single Family, Condo, Townhouse, Manufactured, Multi-Family, Apartment, Land), `bedrooms`/`bathrooms`/`price`/`squareFootage`/`yearBuilt` with range syntax `min:max`, `status` (Active default), `daysOld`, `limit` 1-500 (default 50), `offset`. **One call per run with `limit=500` and no pagination** (Phase 4 rule). Show a truncation note at 500.
- Target cap rate and the 1% threshold are **client-side filters/badges**, not API params.
- Quick metrics (0 calls): `quickMetrics(listing, zipMedianRent, assumptions)` uses zip-median rent for the listing's bedroom count (`rentalData.dataByBedrooms[beds].medianRent`, falling back to the overall `medianRent`, labeled), the buy-box's financing assumptions, default expense lines, and the listing's HOA when present. It returns est. cap rate, est. monthly cash flow, and 1% pass, labeled **"Quick estimate from ZIP median rent"**. If the listing's zip stats **aren't cached**, show "Load ZIP stats (1 call)" per zip. **Never auto-fetch.** A city buy-box spans many zips, so auto-fetching would burn the budget.
- New matches come from the Phase 4 scheduler: `core.diffSnapshots` with the two-cursor model. The investor hub and nav badge show "N new" per buy-box, and new rows get `NewSinceBadge`.

### Pattern 9: Watched-zip dashboards
- `watchedZips` lives in Dexie (backup-registered), and `addWatchedZip` rejects a 6th entry (core-validated, unit-tested). Adding a zip shows `(1 call)` or `(0 calls · cached)` from `gateway.estimateCost({endpoint:'markets', zipCode, historyRange: 24})` and spends only on click.
- `marketStats` must request `historyRange` ≥ 24 (Phase 4 fixtures carry 24 months). Rent trend per bedroom comes from `history[YYYY-MM].dataByBedrooms[].medianRent`. Price-to-rent per month = `saleData.history[m].medianPrice / (rentalData.history[m].medianRent × 12)`. Skip months missing either value (`defined` accessor), never zero-fill.
- Every chart carries an "as of" `ProvenanceChip` (fetchedAt) and the stats' `lastUpdatedDate`.

### Anti-Patterns to Avoid
- **Reading `page.url.searchParams` in script top level or `load`:** prerender throws "Cannot access url.searchParams on a page with prerendering enabled". Read it in `onMount` only.
- **`Math.round(x*bps/10000)` for money:** inexact and wrong for negatives. Use `mulBps`.
- **Letting the LLM see raw floats** (e.g. `0.07488`): it will format them its own way and fail the post-check. Send pre-formatted strings only.
- **Storing computed outputs as the source of truth for deals:** store inputs + `ANALYZER_VERSION` and recompute. Outputs are only snapshotted inside memo artifacts (via hash) for staleness detection.
- **Hover-only metric tooltips:** they fail WCAG 1.4.13 and touch. Use a toggletip (button "About cap rate" → bits-ui Popover) or a visible one-line definition.
- **Charts without explicit container height:** LayerChart sizes to 100% of the parent, so a parent without height renders a 0-height chart.
- **Using `--color-deco-sage` (2.54:1) for a data line:** WCAG 1.4.11 needs 3:1 for meaningful graphics. Use only the five ≥3:1 tokens listed above.
- **Auto-printing on page load,** or printing before data and fonts are ready.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart axes, scales, time ticks | Custom SVG math | LayerChart `LineChart` | Sanctioned, and already handles scales, ticks, and legend |
| PDF generation | Canvas→image or a JS PDF lib | Browser print + print CSS | Locked decision. Gives vector text and zero dependencies. |
| Random-input testing | Hand loops with `Math.random` | fast-check (shrinking, seeds, replay) | Gives minimal counterexamples and reproducible seeds |
| Currency formatting | String concatenation | `Intl.NumberFormat('en-US', {style:'currency',currency:'USD'})` in core `format.ts` | Handles locale grouping and negatives consistently, and the parser round-trips it |
| Call budget, cache, cost labels, cap dialog | Anything investor-specific | Phase 4 gateway + `CostLabel`/`CapConfirmDialog`/`ProvenanceChip`/`GatewayError` | Single choke point for the 50-call budget |
| Snapshot diffing for "new matches" | Ad-hoc id set compare | Phase 4 `core.diffSnapshots` + scheduler | Shared with renter saved searches, with the two-cursor semantics already tested |
| Fair Housing gating, PII redaction, exits | Memo-specific checks | Phase 5 `GenerationPanel` + checker (+ the new `validators` prop) | One audited gate |
| Dialogs and popovers | Custom focus traps | Phase 3 shadcn/bits-ui `alert-dialog`, `popover` | Focus management is already contract-tested |

**Key insight:** The investor portal's correctness lives in a few hundred lines of pure core code. Everything visual or networked should be a thin consumer of Phase 3-5 primitives, so that the exact reference cases and invariants cover every number a user or the LLM ever sees.

## Common Pitfalls

### Pitfall 1: Convention drift between UI, memo, and tests
**What goes wrong:** The tooltip says management is "% of rent", the code uses % of EGI, and the memo narrates a third thing.
**Why it happens:** The sources disagree. DealCheck lets each line pick its base.
**How to avoid:** One `DEFINITIONS` object in core holds each metric's formula text and base. Tooltips, memo FACTS labels, and test comments all import it.
**Warning signs:** A reference case that passes only after "adjusting" expected numbers.

### Pitfall 2: Fixture memo fails its own post-check
**What goes wrong:** The keyless demo streams canned text with fixed numbers, so the post-check blocks Copy and Print for every user deal.
**How to avoid:** `sample(inputs)` template plus a property test (Pattern 5.6).

### Pitfall 3: Panel exits bypass the numeric check
**What goes wrong:** Phase 5 gating knows only FH findings, so a hallucinated "$2,400/mo" gets copied or emailed.
**How to avoid:** The `validators` prop (Pattern 5.4). Extend the Phase 5 exit-gating unit test with a numeric-block case.

### Pitfall 4: Stale memo printed against edited deal
**How to avoid:** Use `analysisHash` on the artifact and compare it on the print route (Pattern 5.7). E2E: edit the deal after generating, and the print page shows the stale notice.

### Pitfall 5: Prerender/route registry misses
**What goes wrong:** New routes aren't in `EXPECTED_PAGES` (csp:assert passes vacuously for them) or the e2e `ROUTES` list (no axe or CSP coverage). Also, a `?deal=` read at top level crashes the build.
**How to avoid:** A Wave 0 task updates both lists. Note that `kit.prerender.entries` defaults to `['*']`, which covers all non-dynamic routes, so `handleUnseenRoutes: 'fail'` is not an issue for static routes.

### Pitfall 6: Chart CSS variables undefined / too-small text
**What goes wrong:** Axis text falls back to `currentColor` at 50% `color-mix` at 10px/300 weight, so it's illegible and breaks the Phase 2 type scale.
**How to avoid:** The token mapping + font override (Pattern 2), plus a visual check in the markets E2E (computed `font-size` of `.lc-axis-tick-label` = 14px).

### Pitfall 7: Charts in print at screen width
**What goes wrong:** LayerChart measures the container once and then follows ResizeObserver. Print layout may not trigger a re-measure, so the SVG overflows the page.
**How to avoid:** In `PrintReport`, pass explicit `width`/`height` (e.g. 640×240 CSS px fits Letter at 0.75in margins: 7in = 672px) and add `@media print { .lc-root-container svg { max-width: 100%; height: auto; } }`. The memo itself is tables-first. Charts in print are mainly Phase 9's concern, but the shell must support them.

### Pitfall 8: Buy-box budget burn via per-zip stats
**How to avoid:** Quick metrics only from cached zips, with explicit "Load ZIP stats (1 call)". E2E with a mocked key asserts the RentCast request count after opening the buy-box page = 0 extra.

### Pitfall 9: Advice language and banned terms
**What goes wrong:** The model writes "guaranteed cash flow", "will appreciate", "great investment", or "passive income". Page copy in `routes/` and `lib/components` is also scanned by the Phase 2 banned-terms gate.
**How to avoid:** Add a small promissory-language lexicon to the memo validators (`warn` for "great investment" and similar, `block` for "guarantee*", "risk-free", "will appreciate"). The compare UI uses "Highest/Lowest", never "best investment".

### Pitfall 10: DSCR misread by lender-minded users
**How to avoid:** The label carries its formula. The tooltip mentions the rent ÷ PITIA variant. Don't compute the second variant (it's past the cut line).

### Pitfall 11: Phase 6/7 parallel-wave collisions
**What goes wrong:** Both phases edit `routes.ts`, `EXPECTED_PAGES`, the backup registry, `features/shared`, and the saved-search table and its `kind` discriminator.
**How to avoid:** Phase 7 adds `kind: 'sale-buybox'` (or its own table) and touches shared registries in small, isolated tasks. Run the Phase 1 lesson's concurrency check before execution.

## Code Examples

### Playwright: print emulation and PDF page count (verified locally, Playwright 1.63, Chromium)
```typescript
// tests/e2e/investor-print.spec.ts (sketch)
await page.addInitScript(() => { (window as any).__printed = 0; window.print = () => { (window as any).__printed++; }; });
await page.goto(`print/memo/?deal=${id}`);
await expect(page.locator('[data-ready]')).toBeVisible();
await page.getByRole('button', { name: 'Print or save as PDF' }).click();
expect(await page.evaluate(() => (window as any).__printed)).toBe(1);

await page.emulateMedia({ media: 'print' });
await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeHidden();
await expect(page.getByText('Not investment, legal, or tax advice')).toBeVisible();
const pdf = await page.pdf({ preferCSSPageSize: true }); // Chromium only
const pages = Number(pdf.toString('latin1').match(/\/Count\s+(\d+)/)?.[1]);
expect(pages).toBeGreaterThanOrEqual(1); expect(pages).toBeLessThanOrEqual(4);
```
(Probe result: a 3-section document with `break-before: page` gave `/Count 3`, and the print-hidden button reported `isVisible() === false` after `emulateMedia`.)

### Playwright: proving 0 RentCast calls in manual mode
```typescript
const rentcast: string[] = [];
page.on('request', (r) => { if (r.url().startsWith('https://api.rentcast.io/')) rentcast.push(r.url()); });
await page.route('https://api.rentcast.io/**', (route) => route.fulfill({ status: 500 })); // must never be hit
// …fill every field manually (with a mocked key present), read results…
expect(rentcast).toEqual([]);
```

### fast-check property (plain, no plugin)
```typescript
import fc from 'fast-check';
it('cap rate does not depend on financing', () => {
	fc.assert(fc.property(dealArb, fc.integer({ min: 0, max: 10000 }), fc.double({ min: 0, max: 15, noNaN: true }),
		(d, downBps, rate) => {
			const a = analyze(d), b = analyze({ ...d, downBps, annualRatePct: Math.round(rate * 1000) / 1000 });
			expect(b.noiMonthly).toBe(a.noiMonthly); expect(b.capRatePct).toBe(a.capRatePct);
		}), { numRuns: 500 });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LayerChart `layerchart@next` (shadcn docs) | `layerchart@2.5.1` stable | 2.0.0 stable 2026-07-01; 2.5.1 on 2026-10-01 | Pin 2.5.1. The docs' `@next` note is stale. |
| Print headers/footers via browser checkbox | CSS `@page` margin boxes (`@bottom-center`, `counter(page)`) | Chrome 131 (Nov 2024), Safari 18.2 | Page numbers without JS. Firefox still ignores them (graceful). |
| `@fast-check/vitest` required for Vitest | Plain fast-check works in any runner; plugin 0.5.0 supports Vitest 4/5 | 2026-09 | No plugin dependency needed |

**Deprecated/outdated:**
- STACK.md's "pdfmake renders LayerChart SVGs" path: deferred out of Phase 7 by CONTEXT.
- `page.url.searchParams` at module level in prerendered routes: never valid. Use `onMount`.

## Open Questions

1. **Phase 4 gateway method names.** 07-CONTEXT says `saleListings/valueEstimate/rentEstimate/marketStats`, while 04-CONTEXT says `gateway.search/rentEstimate/marketStats/refresh/estimateCost`.
   - Recommendation: Phase 7 plans code against a narrow `InvestorDataPort` interface (`saleListings`, `rentEstimate`, `valueEstimate`, `marketStats`, `estimateCost`), adapted to whatever Phase 4 actually ships in one adapter file.
2. **`GenerationPanel` validator seam and gating-state exposure** (Pattern 5.4/5.5).
   - Recommendation: add `validators` and a `bind:gate` (or `onstatechange`) prop. If Phase 5 is executed first without them, include a Phase 7 task that extends the panel and its exit test.
3. **CapEx above or below NOI.**
   - Recommendation: above (in OpEx), matching DealCheck's residential convention, and state it in the tooltip. Revisit if users object.
4. **DSCR flavor.**
   - Recommendation: NOI ÷ annual debt service, with a tooltip note on rent ÷ PITIA. The second metric is out of scope (cut line).
5. **Numbers from user notes in the memo.**
   - What we know: CONTEXT says "analyzer output set".
   - Recommendation: include the numerals the user typed in notes in `allowed`, tagged `source: 'your notes'`, because they are user-supplied facts. Derived numbers (e.g. "5% below asking" turned into a price) are still flagged. Record this as a decision in the plan.
6. **No 07-UI-SPEC.md exists yet.** STATE.md lists Phase 7 as a UI phase (`ui_safety_gate: true`).
   - Recommendation: the orchestrator runs `/gsd:ui-phase 7` before or alongside planning. The patterns here (toggletip, compare cards, chart figure, print shell) are UI-SPEC inputs, not final visual contracts.
7. **Phases 3-5 are planned but not executed.** Phase 7 tasks depend on their APIs (vault, Dexie base/backup registry, gateway, scheduler, GenerationPanel, fixtures).
   - Recommendation: the plan's first wave builds `core/finance` (no dependencies) plus Wave 0 test scaffolding. UI waves start only after Phases 3-5 are verified.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.11 (projects `core`, `web`, `scripts`; network blocked) + fast-check 4.10.2 (to install) · Playwright 1.63.0 + @axe-core/playwright 4.13.0 (projects `root`, `sub`) |
| Config file | `vitest.config.ts` (root projects), `packages/core/vitest.config.ts`, `apps/web/vite.config.ts`, `apps/web/playwright.config.ts` |
| Quick run command | `pnpm vitest run --project core` (finance + post-check, a few seconds) |
| Full suite command | `pnpm verify` (check, lint, unit, both builds, csp:assert, E2E both bases, guard, secrets, workflows) |
| E2E subset | `pnpm build:root && pnpm --filter web exec playwright test tests/e2e/investor --project root` |

### Phase Requirements → Test Map (per success criterion)
| Criterion / Req | Behavior | Test Type | Automated Command | File | Failure mode caught |
|-----------------|----------|-----------|-------------------|------|---------------------|
| SC1 / INV-01 | 9 reference cases exact (cents, ratios to 1e-9) | unit | `pnpm vitest run --project core finance/reference` | `packages/core/src/finance/reference-cases.test.ts` ❌ W0 | Formula or convention drift, rounding errors, wrong base for % lines |
| SC1 / INV-01 | Invariants: no NaN/Infinity, identities, financing-independent cap, monotonic NOI, payment monotonicity, 1% boundary, mulBps == BigInt reference | property | `pnpm vitest run --project core finance/properties` | `packages/core/src/finance/properties.test.ts` ❌ W0 | Division by zero, float rounding, negative rounding |
| SC1 / INV-01 | Published payment anchors ($599.55, $1,064.48, $1,264.14, $1,330.60, $2,237.49) | unit | `pnpm vitest run --project core amortization` | `packages/core/src/finance/amortization.test.ts` ❌ W0 | Wrong r or n, 0% rate crash |
| SC1 / INV-01 | Editable expense lines change results; tooltips present and keyboard-operable | E2E | `playwright test investor-analyze` | `apps/web/tests/e2e/investor-analyze.spec.ts` ❌ W0 | UI not wired to `analyze()`, hover-only tooltips |
| SC2 / INV-02 | Manual mode makes 0 RentCast requests with a mocked key present; ledger unchanged | E2E | `playwright test investor-analyze` | same | A reactive effect spends calls |
| SC2 / INV-02 | Autofill buttons show "(1 call)" before click and "(0 calls · cached)" after; provenance chip on the filled field; user overwrite clears provenance | E2E (mocked `api.rentcast.io`) + unit for the store | `playwright test investor-analyze`; `pnpm vitest run --project web autofill` | spec above + `apps/web/src/lib/features/investor/analyzer/autofill.test.ts` ❌ W0 | Cost hidden, double spend, provenance lies |
| SC3 / INV-03 | Save → list → compare 3 deals; best-in-row with ties/null/direction | unit + E2E (desktop and 375px) | `pnpm vitest run --project core compare`; `playwright test investor-deals` | `packages/core/src/finance/compare.test.ts`, `apps/web/tests/e2e/investor-deals.spec.ts` ❌ W0 | Color-only marking, GRM direction inverted, duplicate a11y content at 375px |
| SC3 / INV-03 | Deals in backup export/import round-trip | unit (fake-indexeddb) | `pnpm vitest run --project web deals-repo` | `apps/web/src/lib/features/investor/deals/dealsRepo.test.ts` ❌ W0 | Table not registered with backup |
| SC4 / INV-04 | `quickMetrics` from zip-median (bedroom fallback, HOA, labels) | unit | `pnpm vitest run --project core quick-metrics` | `packages/core/src/finance/quick-metrics.test.ts` ❌ W0 | Wrong rent source, NaN on missing stats |
| SC4 / INV-04 | On open, a due buy-box runs once (1 call); new matches badged; uncached zips show "Load ZIP stats (1 call)" and never auto-fetch; Deep analyze = exactly 2 calls, then the analyzer renders from cache | unit (scheduler, fake-indexeddb, mocked fetch) + E2E (mock key, request counter) | `pnpm vitest run --project web buybox`; `playwright test investor-buybox` | `apps/web/src/lib/features/investor/buybox/buybox.test.ts`, `apps/web/tests/e2e/investor-buybox.spec.ts` ❌ W0 | Budget burn, page-load spending |
| SC5 / INV-05 | Price-to-rent and rent-trend series math; missing months skipped; ≤5 zip cap | unit | `pnpm vitest run --project core market-series` | `packages/core/src/finance/market-series.test.ts` ❌ W0 | Zero-filled gaps, ratio inverted, 6th zip accepted |
| SC5 / INV-05 | Charts render client-side with `role="img"` + aria-label summary; table fallback present in DOM; "as of" chip; add-zip cost label; axis tick font-size 14px | E2E | `playwright test investor-markets` | `apps/web/tests/e2e/investor-markets.spec.ts` ❌ W0 | Inaccessible SVG, unstyled axes, call spent for a cached zip |
| SC6 / INV-06 | Numeral extraction formats; tolerant matching table; property: `sample(facts)` passes; mutating any number beyond tolerance fails | unit + property | `pnpm vitest run --project core numeric-check` | `packages/core/src/finance/numeric-check.test.ts` ❌ W0 | Hallucinated numbers pass, natural rounding blocked |
| SC6 / INV-06 | Panel gating includes numeric findings (Copy/mailto/Print gated) | unit (web) | `pnpm vitest run --project web generation-panel` | extend the Phase 5 panel test ❌ W0 | Exits bypass the post-check |
| SC6 / INV-06 | Print route: `?deal=` read in onMount; disclaimer top and end; provenance line; controls hidden in print media; `window.print` called once; PDF has 1-4 pages; stale-memo notice after deal edit | E2E | `playwright test investor-print` | `apps/web/tests/e2e/investor-print.spec.ts` ❌ W0 | Prerender crash, missing disclaimer, UI in PDF, stale numbers printed |
| SC7 (demo, budget) | Keyless full flow (analyze → save → compare → buy-box → markets → memo → print) with **zero** requests to rentcast/AI hosts; mocked-key flow total RentCast requests ≤ 6 (2 autofill + 1 buy-box + 1 zip + 2 deep) | E2E | `playwright test investor-demo` | `apps/web/tests/e2e/investor-demo.spec.ts` ❌ W0 | Fixture gaps, hidden spending |
| SC8 (FH, axe, CSP) | Fixture memo for each reference case passes the FH checker; axe WCAG A/AA on every investor route + `print/memo/` (empty and loaded, keyless and mocked key); zero CSP violations incl. chart and print routes; csp:assert covers the new pages | unit + E2E + build oracle | `pnpm vitest run --project web memo-fh`; `playwright test a11y csp`; `pnpm csp:assert` | `apps/web/src/lib/features/investor/memo/memo-fh.test.ts`; extend `a11y.spec.ts`, `csp.spec.ts`, `routes.ts`, `scripts/assert-csp.mjs` ❌ W0 | Steering language, a11y regressions, CSP-blocked chart CSS |

### Sampling Rate
- **Per task commit:** `pnpm vitest run --project core` (plus `--project web` when web units are touched)
- **Per wave merge:** `pnpm test:unit && pnpm build:root && pnpm --filter web exec playwright test --project root`
- **Phase gate:** `pnpm verify` green (both bases) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `pnpm --filter @tran/core add -D fast-check@4.10.2`; `pnpm --filter web add layerchart@2.5.1`
- [ ] `packages/core/src/finance/` skeleton + `reference-cases.ts` fixture (the 9 cases above) + failing test stubs
- [ ] Shared arbitraries `packages/core/src/finance/arbitraries.ts` (dealArb with bounded ranges)
- [ ] Add the new routes to `apps/web/tests/e2e/routes.ts` (Phase 2) and `scripts/assert-csp.mjs` `EXPECTED_PAGES`
- [ ] E2E helpers: request collector, `window.print` stub, mocked-key setup (depends on Phase 3 vault storage format), Dexie seeding via UI flow
- [ ] `GenerationPanel` `validators` + gating-state prop (if absent from Phase 5)

## Sources

### Primary (HIGH confidence)
- `layerchart@2.5.1` tarball (npm pack, 2026-10-04): `package.json` exports and deps; `Chart.base.svelte` (`ssr=false` client-only guard, measuring, inline `style:`), `layers/Svg.svelte` (`role="figure"`, `title`, restProps), `ChartChildren.base.svelte` (`props.svg`, points/labels lazy imports), `Spline.shared` / `Path.shared` (`marker*`, SVG attrs), `Marker` types, `Axis.base.svelte` and `Text.svg.svelte` (CSS vars, 10px labels), `styles/*.css`; no `{@html}` or runtime style injection found
- npm registry (`npm view`, 2026-10-04): layerchart 2.5.1, fast-check 4.10.2 (2026-09-19), @fast-check/vitest 0.5.0 (peer vitest ^4.1 || ^5), dexie 4.4.6
- Local Playwright 1.63 probe: `emulateMedia({media:'print'})` hides print-hidden elements; `page.pdf({preferCSSPageSize:true})` → `/Count 3` for 3 forced pages
- Local finance script: 9 reference cases and payment anchors (matching standard amortization tables)
- Repo: `apps/web/svelte.config.js` (CSP directives, prerender strictness), `scripts/assert-csp.mjs` (`EXPECTED_PAGES`, style-src rules), `tests/e2e/*.spec.ts`, `playwright.config.ts`, `eslint.config.js` (portal boundaries, fetch ban), `packages/core` setup
- [RentCast sale listings reference](https://developers.rentcast.io/reference/sale-listings): params, ranges, limit 500
- [RentCast market statistics reference](https://developers.rentcast.io/reference/market-statistics): `zipCode`, `dataType`, `historyRange`, `saleData`/`rentalData`, `dataByBedrooms`, `history`
- [SvelteKit page options](https://svelte.dev/docs/kit/page-options) and [kit discussion #6849](https://github.com/sveltejs/kit/discussions/6849): searchParams not accessible during prerender; use onMount

### Secondary (MEDIUM confidence)
- [DealCheck: Operating Expenses](https://help.dealcheck.io/en/articles/2029719-operating-expenses): CapEx listed among operating expenses; % of gross rent with or without vacancy
- [DealCheck glossary PDF](https://dealcheck.io/wp-content/uploads/media/Real%20Estate%20Investing%20Glossary%20|%20DealCheck.pdf): NOI excludes debt service
- [DSCR Authority: how DSCR is calculated](https://dscrauthority.com/learn/how-dscr-is-calculated/), [Griffin Funding DSCR loans](https://griffinfunding.com/non-qm-mortgages/debt-service-coverage-ratio-investor-loans/): residential rent ÷ PITIA vs commercial NOI ÷ debt service
- [Wikipedia: Gross rent multiplier](https://en.wikipedia.org/wiki/Gross_rent_multiplier), [Apartments.com GRM](https://www.apartments.com/rental-manager/resources/expenses/how-calculate-and-use-gross-rent-multiplier-formula): GRM = price ÷ gross annual rent
- [Wall Street Prep: price-to-rent](https://www.wallstreetprep.com/knowledge/price-to-rent-ratio/), [SmartAsset price-to-rent](https://smartasset.com/mortgage/price-to-rent-ratio-in-us-cities): median price ÷ median annual rent
- [Doppio: CSS page margin boxes](https://doppio.sh/guide/css-page-margin-boxes), [W3C css-page-3](https://www.w3.org/TR/css-page-3/): Chrome 131+/Safari 18.2+ margin boxes; Firefox not shipped

### Tertiary (LOW confidence)
- Whether axe's `color-contrast` evaluates SVG `<text>`: not verified. Mitigated by token mapping and role="img" (children presentational).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Versions come from the registry today, and LayerChart internals come from the tarball.
- Finance formulas: HIGH for formulas and payment math (computed and cross-checked). MEDIUM for conventions (CapEx placement, management base, DSCR flavor), which are documented as decisions.
- Architecture/integration: MEDIUM. Phases 3-5 aren't executed, and the seams are listed in Open Questions.
- Print pipeline: HIGH for Chromium (probed locally). MEDIUM for cross-browser margin boxes.
- Post-check algorithm: MEDIUM-HIGH. Prototyped and run, but final tolerance needs the test table.

**Research date:** 2026-10-04
**Valid until:** 2026-11-03 (30 days). Re-check the layerchart patch version and the Phase 3-5 APIs at plan time.
