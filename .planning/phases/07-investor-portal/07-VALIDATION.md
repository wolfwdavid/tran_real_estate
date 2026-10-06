---
phase: 7
slug: investor-portal
status: verified
nyquist_compliant: true
wave_0_complete: true
approved: 2026-10-06
created: 2026-10-04
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11 (projects `core`, `web`, `scripts`, `brand`; network blocked by `tooling/vitest/no-network.ts`) + fast-check 4.10.2 (installed by 07-01) + `svelte/server` SSR render tests in the `web` project; Playwright 1.63.0 + @axe-core/playwright 4.13.0 (projects `root`, `sub`; investor specs under `apps/web/tests/e2e/investor/`); build oracle `scripts/assert-csp.mjs`; copy gate `scripts/banned-terms.mjs` |
| **Config file** | `vitest.config.ts` (root projects), `packages/core/vitest.config.ts`, `apps/web/vite.config.ts`, `apps/web/playwright.config.ts` (unchanged) |
| **Quick run command** | `corepack pnpm vitest run --project core` (finance, numbers, markets: a few seconds) plus `corepack pnpm vitest run --project web <filter>` when web units are touched |
| **E2E subset** | `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm --filter web exec playwright test tests/e2e/investor` |
| **Full suite command** | `corepack pnpm verify` |
| **Estimated runtime** | core quick ~5 s; web unit ~15 s; investor E2E ~3-4 min both bases; full verify ~4-6 min warm |

---

## Sampling Rate

- **After every task commit:** the task's own `<automated>` command (core/web filter, ≤ ~15 s for unit tasks) plus `corepack pnpm check && corepack pnpm lint` for web tasks; `corepack pnpm banned` for any task that adds copy
- **After every plan wave:** `corepack pnpm test:unit && corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert && corepack pnpm --filter web exec playwright test tests/e2e/investor routing csp a11y`
- **Before `/gsd:verify-work`:** `corepack pnpm verify` green in one invocation (plan 07-21)
- **Max feedback latency:** ~15 s for unit tasks; E2E tasks need both builds (~60-90 s)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | INV-01 | unit + property (mulBps vs BigInt, parsers) | `corepack pnpm vitest run --project core money && corepack pnpm --filter @tran/core check` | ✅ created | ✅ green |
| 7-01-02 | 01 | 1 | INV-01 | unit + property (formatter, round trip) | `corepack pnpm vitest run --project core format` | ✅ created | ✅ green |
| 7-01-03 | 01 | 1 | INV-01 | unit + property (published payment anchors) | `corepack pnpm vitest run --project core amortization` | ✅ created | ✅ green |
| 7-02-01 | 02 | 1 | INV-06 | unit (numeral extraction table) | `corepack pnpm vitest run --project core numbers -t extract` | ✅ created | ✅ green |
| 7-02-02 | 02 | 1 | INV-06 | unit + property + ReDoS budget (passes 7.5%/$15,000; flags 20%/-5%/ranges) | `corepack pnpm vitest run --project core numbers` | ✅ created | ✅ green |
| 7-03-01 | 03 | 1 | INV-01..06 | unit (sub-nav current item) + check | `corepack pnpm vitest run --project web nav && corepack pnpm check && corepack pnpm lint` | ✅ created | ✅ green |
| 7-03-02 | 03 | 1 | INV-01..06 | unit (banned-terms, CSP oracle) + build oracle | `corepack pnpm vitest run --project scripts banned-terms assert-csp && corepack pnpm banned && corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert` | ✅ extended | ✅ green |
| 7-03-03 | 03 | 1 | INV-01..06 | E2E (route contract, ?query safety, routing/CSP/axe on 9 new routes) | `corepack pnpm --filter web exec playwright test tests/e2e/investor/routes routing csp a11y` | ✅ created | ✅ green |
| 7-04-01 | 04 | 1 | INV-06 | unit (createPostCheck returns Phase 5 bare `(text) => Finding[]`; gates via UNCHANGED Phase 5 runChecks/computeGate; groupFindings; artifact subjectId/meta + listBySubject/deleteBySubjectId; `grep -c "export type PostCheck = (text: string) => Finding\[\]"` panel-controller.ts == 1 and panel-controller.ts/.test.ts git-diff clean) | `corepack pnpm vitest run --project web post-check artifacts panel-controller` | ✅ created (post-check.test.ts) / extended (artifacts) | ✅ green |
| 7-04-02 | 04 | 1 | INV-06 | unit + SSR (PanelState done sentence per group, subject passthrough; exits still 3; Number check group via checkGroups; gated exits; read-only bindables artifactId/draftText; no onstatechange) | `corepack pnpm vitest run --project web panel-state GenerationPanel fair-housing-ui draft-history && corepack pnpm check` | ✅ extended | ✅ green |
| 7-04-03 | 04 | 1 | INV-06 | unit (PromptDef.sample → BuiltPrompt/LlmRequest fixtureText; Fixture streams it; live adapters never send it) | `corepack pnpm vitest run --project web fixture registry runner && corepack pnpm test:unit` | ✅ extended | ✅ green |
| 7-05-01 | 05 | 2 | INV-01 | unit (expense model, defaults, definitions) | `corepack pnpm vitest run --project core expenses` | ✅ created | ✅ green |
| 7-05-02 | 05 | 2 | INV-01 | unit (9 exact reference cases A-I, null guards) | `corepack pnpm vitest run --project core reference-cases analyze` | ✅ created | ✅ green |
| 7-05-03 | 05 | 2 | INV-01 | property (no NaN, identities, financing-independent cap, monotonic NOI, all-cash, 1% boundary) | `corepack pnpm vitest run --project core properties` | ✅ created | ✅ green |
| 7-06-01 | 06 | 2 | INV-05 | unit (gap-preserving series, price-to-rent, zip median rent) | `corepack pnpm vitest run --project core markets/series` | ✅ created | ✅ green |
| 7-06-02 | 06 | 2 | INV-05 | unit (summary copy, 5-ZIP cap) | `corepack pnpm vitest run --project core markets` | ✅ created | ✅ green |
| 7-07-01 | 07 | 3 | INV-03 | unit (best-in-row, ties, directions, RangeError) | `corepack pnpm vitest run --project core compare` | ✅ created | ✅ green |
| 7-07-02 | 07 | 3 | INV-04 | unit (quick metrics, targets, basis line) | `corepack pnpm vitest run --project core quick-metrics` | ✅ created | ✅ green |
| 7-08-01 | 08 | 4 | INV-06 | unit + property (FACTS, allowed set, format/extract round trip) | `corepack pnpm vitest run --project core memo-facts` | ✅ created | ✅ green |
| 7-08-02 | 08 | 4 | INV-06 | unit + property (sample memo passes number/FH/advice checks for A-I and random deals) | `corepack pnpm vitest run --project core memo-sample memo-language` | ✅ created | ✅ green |
| 7-08-03 | 08 | 4 | INV-06 | unit (analysis hash) | `corepack pnpm vitest run --project core analysis-hash` | ✅ created | ✅ green |
| 7-09-01 | 09 | 3 | INV-03 | unit fake-indexeddb (deals repo, backup round trip, delete with memos via 07-04 `deleteBySubjectId` in one transaction + rollback) | `corepack pnpm vitest run --project web dealsRepo` | ✅ created | ✅ green |
| 7-09-02 | 09 | 3 | INV-05 | unit (watched-zip cap incl. concurrent, markets port peek = 0 spend) | `corepack pnpm vitest run --project web watchedZipsRepo markets-port` | ✅ created | ✅ green |
| 7-09-03 | 09 | 3 | INV-02 | unit (investor port mapping, peek = 0 spend, canonical keys) | `corepack pnpm vitest run --project web investor-port` | ✅ created | ✅ green |
| 7-10-01 | 10 | 3 | INV-01 | unit (form model, validation copy, masking, round trip) | `corepack pnpm vitest run --project web form-model` | ✅ created | ✅ green |
| 7-10-02 | 10 | 3 | INV-01 | SSR (inputs, unit toggle not color-only) | `corepack pnpm vitest run --project web inputs.ssr` | ✅ created | ✅ green |
| 7-10-03 | 10 | 3 | INV-01 | SSR (expense lines, totals, cap note) | `corepack pnpm vitest run --project web inputs.ssr form-model` | ✅ created | ✅ green |
| 7-11-01 | 11 | 3 | INV-05 | unit (series styles, ticks) + brand contrast + theme parity | `corepack pnpm vitest run --project web series-style && corepack pnpm vitest run --project brand` | ✅ created | ✅ green |
| 7-11-02 | 11 | 3 | INV-05 | SSR (figure states, legend, table, print variant) | `corepack pnpm vitest run --project web charts.ssr` | ✅ created | ✅ green |
| 7-11-03 | 11 | 3 | INV-05 | SSR (rent trend / price-to-rent text alternatives) | `corepack pnpm vitest run --project web charts.ssr series-style` | ✅ created | ✅ green |
| 7-12-01 | 12 | 4 | INV-01, INV-03 | unit (autosave debounce, sample deal = case A) | `corepack pnpm vitest run --project web draftRepo sample-deal` | ✅ created | ✅ green |
| 7-12-02 | 12 | 4 | INV-01 | SSR (results panel copy, reasons, minus sign, Show the math) | `corepack pnpm vitest run --project web results.ssr` | ✅ created | ✅ green |
| 7-12-03 | 12 | 4 | INV-01, INV-02, INV-03 | E2E (manual = 0 RentCast requests with key, editable lines, save/reopen, draft, clear, axe, 375) | `corepack pnpm --filter web exec playwright test tests/e2e/investor/analyze` | ✅ created | ✅ green |
| 7-13-01 | 13 | 4 | INV-05 | unit (spend only on click; live mount = peek) | `corepack pnpm vitest run --project web market-load` | ✅ created | ✅ green |
| 7-13-02 | 13 | 4 | INV-05 | check + build oracle (LayerChart only via dynamic import) | `corepack pnpm check && corepack pnpm build:root && corepack pnpm csp:assert` | ✅ | ✅ green |
| 7-13-03 | 13 | 4 | INV-05 | E2E (≤5 ZIPs, cost labels, cached 0, role=img, table fallback, 14px ticks, token colors, CSP, states, axe) | `corepack pnpm --filter web exec playwright test tests/e2e/investor/markets` | ✅ created | ✅ green |
| 7-14-01 | 14 | 4 | INV-04 | unit (buy-box repo; scheduler 1 call then 0 within 24h; shared location 1 call) | `corepack pnpm vitest run --project web buyBoxRepo` | ✅ created | ✅ green |
| 7-14-02 | 14 | 4 | INV-04 | unit (filtering, new flags, quick metrics 0 calls, uncached zips listed) | `corepack pnpm vitest run --project web matches buyBoxRepo` | ✅ created | ✅ green |
| 7-15-01 | 15 | 5 | INV-02 | unit (fill rule, no-address 0 calls, cap retry, provenance) | `corepack pnpm vitest run --project web autofill` | ✅ created | ✅ green |
| 7-15-02 | 15 | 5 | INV-02 | check + SSR regression | `corepack pnpm check && corepack pnpm vitest run --project web autofill results.ssr inputs.ssr` | ✅ | ✅ green |
| 7-15-03 | 15 | 5 | INV-02 | E2E (cost shown first, 1 call per click, cached 0, Edited by you, few comps, keyless sample) | `corepack pnpm --filter web exec playwright test tests/e2e/investor/autofill tests/e2e/investor/analyze` | ✅ created | ✅ green |
| 7-16-01 | 16 | 5 | INV-03 | unit + SSR (sort, selection cap, compare table semantics, markers, ties) | `corepack pnpm vitest run --project web deals-view compare.ssr` | ✅ created | ✅ green |
| 7-16-02 | 16 | 5 | INV-03 | check + lint + banned | `corepack pnpm check && corepack pnpm lint && corepack pnpm banned` | ✅ | ✅ green |
| 7-16-03 | 16 | 5 | INV-03 | E2E (save via UI, cap at 3, compare at 1280 and 375, remove, delete, axe) | `corepack pnpm --filter web exec playwright test tests/e2e/investor/deals` | ✅ created | ✅ green |
| 7-17-01 | 17 | 5 | INV-06 | unit (FACTS-only prompt, no raw floats, sample passes) | `corepack pnpm vitest run --project web memo.v1` | ✅ created | ✅ green |
| 7-17-02 | 17 | 5 | INV-06 | unit (createMemoPostChecks returns Phase 5 bare-function PostChecks gating via runChecks/computeGate; MEMO_CHECK_GROUPS UI-SPEC copy; memoGateReasons) | `corepack pnpm vitest run --project web memo-checks` | ✅ created | ✅ green |
| 7-17-03 | 17 | 5 | INV-06 | E2E (keyless memo passes; planted number + FH gate exits and print link; edit clears; stale; FACTS-only body; axe) | `corepack pnpm --filter web exec playwright test tests/e2e/investor/memo` | ✅ created | ✅ green |
| 7-18-01 | 18 | 6 | INV-04 | unit (buy-box form copy, Deep analyze = 2 calls, partial failure, cap) | `corepack pnpm vitest run --project web buybox-form deep-analyze` | ✅ created | ✅ green |
| 7-18-02 | 18 | 6 | INV-04 | check + unit regression | `corepack pnpm check && corepack pnpm vitest run --project web buybox-form deep-analyze matches buyBoxRepo` | ✅ | ✅ green |
| 7-18-03 | 18 | 6 | INV-04 | E2E (check = 1 call, quick metrics 0, Load ZIP rents explicit, app-open once, Deep analyze 2 then 0, targets) | `corepack pnpm --filter web exec playwright test tests/e2e/investor/buybox` | ✅ created | ✅ green |
| 7-19-01 | 19 | 6 | INV-06 | unit (key figures, inputs with sources, provenance sentence, disclaimers) | `corepack pnpm vitest run --project web print-model` | ✅ created | ✅ green |
| 7-19-02 | 19 | 6 | INV-06 | SSR + build oracle (PrintReport shell, print.css only in print layout) | `corepack pnpm vitest run --project web PrintReport print-model && corepack pnpm build:root && corepack pnpm csp:assert` | ✅ created | ✅ green |
| 7-19-03 | 19 | 6 | INV-06 | E2E (print media, window.print once on click, disclaimer top+end, PDF 1-4 pages, states, axe) | `corepack pnpm --filter web exec playwright test tests/e2e/investor/print` | ✅ created | ✅ green |
| 7-20-01 | 20 | 7 | INV-01..06 | unit (overview counts, zero gateway calls) | `corepack pnpm vitest run --project web overview-counts` | ✅ created | ✅ green |
| 7-20-02 | 20 | 7 | INV-01..06 | E2E sweep (9 routes × keyless/mocked × 1280/375: axe, CSP, no scroll) | `corepack pnpm --filter web exec playwright test tests/e2e/investor/overview tests/e2e/investor/sweep` | ✅ created | ✅ green |
| 7-21-01 | 21 | 8 | INV-01..06 | E2E (keyless full flow 0 external requests; mocked key exactly 6 RentCast calls) | `corepack pnpm --filter web exec playwright test tests/e2e/investor/demo` | ✅ created | ✅ green |
| 7-21-02 | 21 | 8 | INV-01..06 | full gate | `corepack pnpm install --frozen-lockfile && corepack pnpm verify` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Success criterion → proof

| ROADMAP Phase 7 success criterion | Proven by |
|-----------------------------------|-----------|
| 1. Analyze NOI, cap rate, cash flow, CoC, DSCR, GRM, 1% rule with editable expense lines; results match hand-checked reference cases | 7-01-01..03 (exact money, payment anchors), 7-05-01..03 (9 reference cases + invariants), 7-10-01..03 (editable lines), 7-12-02/03 (live results, editable lines in browser) |
| 2. Every number manual with zero calls, or autofill after seeing the cost; save and compare side by side | 7-12-03 (0 RentCast requests with key), 7-09-03 + 7-15-01..03 (cost-first autofill, 1 call per click, cached 0), 7-09-01 + 7-16-01..03 (save, list, compare 2-3, a11y markers, 375px) |
| 3. Buy-box searches over for-sale listings; new matches with quick metrics on app open | 7-07-02 (quick metrics), 7-14-01/02 (scheduler once a day, 0-call metrics), 7-18-01..03 (UI, Load ZIP rents explicit, Deep analyze = 2 calls) |
| 4. Rent-trend and price-to-rent dashboards for ≤5 ZIPs; AI memo with analyzer-only numbers printed to PDF with disclaimer | 7-06-01/02 + 7-09-02 + 7-11-01..03 + 7-13-01..03 (dashboards, cap 5, a11y, tokens); 7-02-01/02 + 7-04-01..03 + 7-08-01..03 + 7-17-01..03 (numeric post-check gates every exit); 7-19-01..03 (print, disclaimer top+end, PDF pages) |
| 5. Demo-credible: keyless on sample data, under budget with a key, memo passes Fair Housing, axe passes | 7-08-02 (sample memo passes FH/number/advice for A-I), 7-17-03 (FH gating), 7-20-02 (axe/CSP/375 sweep both modes), 7-21-01 (keyless 0 external requests; keyed exactly 6 calls), 7-21-02 (full verify) |

---

## Wave 0 Requirements

Wave 0 work is folded into the first task that needs it (every test file is created RED-first inside its own task, so no `<automated>` command references a file that a previous task has not created):

- [x] `fast-check@4.10.2` (packages/core dev) and `layerchart@2.5.1` (apps/web) installed, single `runed` copy — 07-01 Task 1
- [x] `@tran/core` subpath exports `./finance`, `./format`, `./numbers`, `./markets` — 07-01 Task 1
- [x] Shared fast-check arbitraries `packages/core/src/finance/arbitraries.ts` (extended with `dealArb` in 07-05) — 07-01 Task 1
- [x] Nine investor/print routes in `tests/e2e/routes.ts`, `scripts/assert-csp.mjs` EXPECTED_PAGES and `prerender.entries` — 07-03 Task 2
- [x] E2E helpers (request collector, RentCast/Anthropic mocks, mocked-key setup through Settings, print stub, axe/scroll helpers, `MOCK_ZIP`) — 07-03 Task 3
- [x] `createPostCheck` factory returning Phase 5's bare `PostCheck` (Phase 5 `postChecks` prop and `panel-controller.ts` unchanged), `checkGroups` grouped `FindingsSummary` titles, gate state via Phase 5 bindable `canExit`/`blocked`/`findings` + additive read-only `artifactId`/`draftText` (no `onstatechange`), `DraftHistory` `subjectId`, artifact `subjectId`/`meta` + `listBySubject`/`deleteBySubjectId`, prompt `sample` → Fixture `fixtureText` — 07-04

Cross-phase precondition: Phases 2, 3, 4 and 5 are executed before any web plan (07-03 Task 1 checks and stops with a blocker report otherwise). The core plans 07-01/02/05/06/07/08 have no cross-phase dependency except 07-08's Fair Housing test (Phase 5 core checker).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Printed PDF looks right in Safari and Firefox (margin-box page numbers are Chrome 131+/Safari 18.2+ only; Firefox ignores them) | INV-06 | Playwright PDF generation is Chromium-only | Open `/print/memo/?id=…&memo=…` in Safari and Firefox, print to PDF, confirm the disclaimer is at the top and in the closing "Important" block, tables do not split rows, and no toolbar appears |
| Real RentCast billing of autofill, buy-box and market-stats calls | INV-02, INV-04, INV-05 | Owner has not created the dedicated RentCast key (deferred Phase 4 owner action); CI never calls RentCast | With a real key, run the mocked-key flow from `demo.spec.ts` by hand and confirm the RentCast dashboard shows exactly 6 requests |

All other phase behaviors have automated verification. The owner runbook for these rows, plus
real-device, screen-reader, real-AI-key and deployed-CSP checks, is `07-HUMAN-UAT.md` (I1-I13,
sign-off items S1-S2, `blocking: false`).

---

## Gate results (07-21)

| Gate | Result |
|------|--------|
| `corepack pnpm install --frozen-lockfile && corepack pnpm verify` | exit 0 in **600 s (10 min)** warm, one invocation, on the 07-21 tree (after 33ecefa, 43c2a28, 477beae, 84db8b6, 0769526) |
| `check` | svelte-check 2317 files, 0 errors, 0 warnings; `@tran/core` and `@tran/brand` tsc clean |
| Unit (`test:unit`, incl. `web-browser`) | 214 files, **4140 tests** passed, 0 flaky |
| Builds + `csp:assert` | root and sub, **25 HTML files per base** (24 pages + `404.html`) |
| E2E (`test:e2e`, both bases) | **1062 passed**, 2 skipped (pre-existing conditional skips, same count as 06-22), 0 flaky, 7.2 min |
| Investor E2E (`tests/e2e/investor`, both bases) | **150** (75 per base): routes 48, analyze 22, autofill 16, markets 16, buybox 12, memo 10, print 8, deals 6, demo 4, overview 4, sweep 4; with `routing csp a11y` 268 passed in 2.7 min |
| Guards | `guard` (1238 files), `fixtures:check` (6 files), gitleaks canary + history (720 commits, no leaks), actionlint |
| Row walk | All 57 rows run one by one with their own command after the gate (43 unit/check rows, 3 build-oracle rows, 11 E2E rows via the investor + routing/csp/a11y run on the gate's builds): every row exit 0 on the first run |

ROADMAP criterion 5, as proven: keyless, the composed journey (analyze → save → compare → buy box
→ markets → memo → print) runs on sample data with zero requests to RentCast or any AI host
(`demo.spec.ts` asserts `toEqual([])`); with a mocked key it spends exactly 6 RentCast calls
(rent AVM 2, value AVM 2, sale listings 1, markets 1; `toBe(6)`), and reloading every visited page
keeps it at 6; the memo passes the number, Fair Housing and advice checks; `sweep.spec.ts` runs
axe, CSP and the 375px no-scroll rule on all nine investor routes plus the print view in both modes.

## Mutation proofs (recorded in SUMMARYs; never committed)

| Plan | Mutations | Result |
|------|-----------|--------|
| 07-01 | `mulBps` trunc/remainder rounding → `Math.round` | killed (2 tests) |
| 07-02 | tolerance and extraction rules (sign, relative, named-rule pre-strip, half-unit, sig thresholds, paren unit guard, spelled-out and digit-overlap guards) | 14/14 killed |
| 07-03 | banned-terms: investor entry dropped from `SCOPED_LISTS` | killed (11 tests) |
| 07-05 | 15 operator/operand mutants on reference + analyze; 3 property-suite mutants | 18/18 killed (cap-rate divide-by-zero unreachable by `dealArb`, covered by "price 0") |
| 07-06 | price-to-rent inverted, `* 12` dropped, limit `>=` → `>`, cap = 6 | 4/4 killed |
| 07-07 | compare directions, all-equal rule, tie epsilon, null filter, price guard, set-aside, rounding, `>=` boundary | all behavioural killed; **2 equivalent no-op mutants survive by construction** (`present.length < 2` → `< 1`; removing the no-targets early return) |
| 07-08 | stray template digit, lexicon entry, injected "great deal", hash version, key sort | 5/5 killed |
| 07-09 | per-month bedroom mapping, backup registry, import schema check, `deleteBySubjectId`, watched-ZIP read outside the transaction, v5 block | 6/6 killed |
| 07-10 | form-model (mask overwrite, term/bedroom bounds, cash guard, …) | 10/10 killed |
| 07-14 | buyBoxRepo (4) and matches (6) | 10/10 killed |
| 07-16 | marker render dropped (SSR); capped-checkbox `preventDefault`, post-delete focus (E2E) | 3/3 killed |
| 07-18 | Deep analyze cap retry dropped | killed (2 tests) |
| 07-20 | old MemoPrintout markup | killed (2 SSR tests) |
| 07-21 | AnalyzerForm renders AutofillButton before the runtime's gateway exists (the pre-fix state) | "cost label appears when the data runtime starts late" red (33ecefa), green after 43c2a28 + 0769526 |
| 07-21 | buy-box app-open test leaves the overview as soon as the request is counted (the pre-fix state) | flaky under `--repeat-each 3`; 10/10 after 477beae |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s for unit tasks (E2E tasks need builds)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-06 (07-21: every row green, `corepack pnpm verify` exit 0 in 600 s; owner-gated live checks in `07-HUMAN-UAT.md`, non-blocking)
