---
phase: 07-investor-portal
verified: 2026-10-06T08:50:00Z
status: human_needed
score: 6/6 must-haves verified (automated); 13 owner-gated items + 2 sign-offs pending (non-blocking)
human_verification:
  - test: "I1-I8: Real RentCast key journey (manual analyze, autofill rent/value, save/compare, watch ZIP, buy-box check, deep analyze, total spend = 6 calls)"
    expected: "Exact call counts per 07-HUMAN-UAT.md rows; usage matches RentCast dashboard"
    why_human: "Owner has not created the dedicated RentCast key (deferred Phase 4 owner action); CI never calls real RentCast"
  - test: "I9: Memo with a real AI key"
    expected: "One request with FACTS-only body, no raw floats; number/Fair-Housing/advice checks pass or correctly flag"
    why_human: "Requires a real AI key with spend limit; CI only exercises the deterministic/mocked fixtures"
  - test: "I10: Print to PDF on real browsers (Chrome, Safari desktop+iOS, Firefox)"
    expected: "Disclaimer top+end, no split rows, 1-4 pages, margin-box page numbers on Chrome 131+/Safari 18.2+ only"
    why_human: "Playwright PDF generation is Chromium-only; cross-browser print rendering can't be automated"
  - test: "I11: Real phones (iOS Safari, Android Chrome)"
    expected: "No sideways scroll at 200% zoom, compare view stacks, cost buttons wrap, tap targets usable"
    why_human: "Real-device rendering and touch behavior not covered by Playwright viewport emulation"
  - test: "I12: Screen reader pass (VoiceOver, NVDA)"
    expected: "Autofill announcements, compare table captions/headers, chart title+summary, memo Must-fix focus trap"
    why_human: "Real assistive-tech behavior requires a human listener; axe checks structure, not announcements"
  - test: "I13: Deployed CSP and third-party hosts"
    expected: "No console CSP violations; only api.rentcast.io and the chosen AI provider contacted"
    why_human: "Requires the live deployed origin (https://tranrealestate.github.io/), not yet deployed"
  - test: "S1: Owner sign-off on the unspecified empty-fields save message wording"
    expected: "Approve 'Enter a purchase price and monthly rent before saving.' or supply replacement copy"
    why_human: "Copy decision reserved for the product owner, not specified in UI-SPEC"
  - test: "S2: Owner sign-off on notes-only numbers failing closed at print"
    expected: "Accept current fail-closed behavior, or plan a fix to pass notes' allowed numerals to the print re-check"
    why_human: "Product/UX tradeoff decision, not a code defect"
---

# Phase 7: Investor Portal Verification Report

**Phase Goal:** An investor goes from a property or buy box to a fully analyzed, comparable, memo-ready deal in minutes.
**Verified:** 2026-10-06T08:50Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (derived from ROADMAP success criteria + PLAN must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Investor can analyze NOI, cap rate, cash flow, CoC, DSCR, GRM, 1% rule with editable expense lines, matching hand-checked cases | ✓ VERIFIED | `packages/core/src/finance/analyze.ts`, `reference-cases.ts` (9 cases A-I), `expenses.ts`; `vitest --project core` 1684 tests green incl. reference-cases, analyze, properties (invariants) |
| 2 | Manual entry = zero API calls; autofill shows cost first; deals save and compare side by side | ✓ VERIFIED | `apps/web/src/lib/features/investor/analyzer/`, `deals/` (dealsRepo, draftRepo), `compare/`; `analyze.spec.ts`/`autofill.spec.ts`/`deals.spec.ts` E2E assert 0 RentCast requests manually, 1 call/click on autofill, cached=0 |
| 3 | Buy-box saved searches over for-sale listings; new matches with quick metrics on app open | ✓ VERIFIED | `apps/web/src/lib/features/investor/buybox/`; `packages/core/src/finance/quick-metrics.ts`; scheduler reuse from Phase 4; `buybox.spec.ts` (incl. 07-21 flake fix 477beae — waits for "new match" line) |
| 4 | Rent-trend/price-to-rent dashboards for ≤5 ZIPs; AI memo with analyzer-only numbers, printable to PDF with disclaimer | ✓ VERIFIED | `packages/core/src/markets/series.ts`, `watched-zips.ts`; `apps/web/src/lib/ai/prompts/investor/memo.v1.ts`; `apps/web/src/lib/features/shared/print/`; `(print)/print/memo` route; `memo.spec.ts`, `print.spec.ts` |
| 5 | Demo-credible: all routes work keyless on sample data, under budget with a key, memo passes Fair Housing checker, axe passes | ✓ VERIFIED (automated layer) | `demo.spec.ts` (keyless 0 external requests; mocked key exactly 6 calls), `sweep.spec.ts` (axe/CSP/375px on 9 routes + print, both bases); `memo-sample.test.ts` passes FH/number/advice for A-I |

**Score:** 6/6 truths verified by automation (includes INV-01..06 all closed per REQUIREMENTS.md). 13 owner-gated UAT rows (I1-I13) and 2 copy/UX sign-offs (S1-S2) remain — explicitly non-blocking (`blocking: false` in 07-HUMAN-UAT.md) and require a deployed origin, a real RentCast key and a real AI key that don't yet exist.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/finance/*` | money, amortization, expenses, analyze, reference-cases, compare, quick-metrics, memo-facts, memo-language, memo-sample, analysis-hash | ✓ VERIFIED | All files present with matching `.test.ts`; core suite 1684 tests green |
| `packages/core/src/numbers/*` | extract, check, spelled (numeral post-check engine) | ✓ VERIFIED | Present with `numbers.test.ts` + `numbers.property.test.ts` |
| `packages/core/src/markets/*` | series, summary, watched-zips, types | ✓ VERIFIED | Present with tests |
| `packages/core/src/format/*` | format | ✓ VERIFIED | Present with test |
| `apps/web/src/lib/features/investor/{analyzer,deals,compare,buybox,memo,overview,data}` | feature UI/state modules | ✓ VERIFIED | All subdirectories present |
| `apps/web/src/lib/features/investor/nav.ts` | sub-nav | ✓ VERIFIED | Present |
| `apps/web/src/lib/ai/prompts/investor/memo.v1.ts` | FACTS-only memo prompt | ✓ VERIFIED | Present with test |
| `apps/web/src/lib/ai/ui/post-check.ts` | Phase 5 bare PostCheck factory reused by investor memo checks | ✓ VERIFIED | Present |
| `apps/web/src/routes/(app)/investor/**` | overview, analyze, deals, compare, buy-boxes, markets/market, memo | ✓ VERIFIED | All 7+ route dirs present with `+page.svelte` |
| `apps/web/src/routes/(print)/**` | print + print/memo | ✓ VERIFIED | Present |
| `apps/web/src/lib/storage/db.ts` | Dexie v5 investor stores | ✓ VERIFIED | `version(5).stores(INVESTOR_STORES)` confirmed, version history append-only (v1-v5 intact) |
| `apps/web/src/lib/storage/backup-registry.ts` | investor tables registered | ✓ VERIFIED | Imports `INVESTOR_BACKUP_TABLES`, comment documents deals/draft/buyBoxes/watchedZips |
| `apps/web/src/lib/data/rentcast/mappers.ts` | per-month `byBedrooms` breakdown | ✓ VERIFIED | `byBedrooms: breakdowns(h.dataByBedrooms, p)` and value variant present (07-09 out-of-plan fix) |
| `apps/web/tests/e2e/investor/**` | routes, analyze, autofill, markets, buybox, memo, print, deals, demo, overview, sweep specs | ✓ VERIFIED | All 12 spec/helper files present matching 07-VALIDATION's row counts (150 investor E2E tests claimed) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| Analyzer form | `@tran/core` analyze() | editable inputs → live results | WIRED | `analyze.spec.ts` asserts live-updating metrics with 0 RentCast calls |
| AutofillButton | RentCast gateway (investor data port) | click handler, cost-shown-first | WIRED | 07-21 fix (33ecefa/43c2a28/0769526) gates button render on `port.source()`/`runtime.gateway` non-null — resolves the 07-20 deferred race; `autofill.spec.ts` green |
| Buy-box scheduler | matches + quick-metrics | app-open once/24h | WIRED | `buybox.spec.ts` + 07-21 flake fix (477beae) waits for match-count update before asserting call count |
| Memo prompt | post-check (number/FH/advice) | gated exits (Copy/email/print disabled until pass) | WIRED | `memo-checks` tests + `memo.spec.ts` E2E assert gating |
| Memo | Print view | FACTS-only re-check at print | WIRED (with documented limitation) | `print.spec.ts`; S2 in HUMAN-UAT documents the notes-only-number fail-closed limitation — not a bug, a recorded tradeoff awaiting owner sign-off |
| Deals repo | Backup export/import | round trip | WIRED | `dealsRepo.test.ts` per 07-VALIDATION row 7-09-01 |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| INV-01 | 07-01, 07-05, 07-10, 07-12, 07-20, 07-21 | Analyze NOI/cap/cash flow/CoC/DSCR/GRM/1% with editable expenses | ✓ SATISFIED | Core finance suite + editable-line E2E (analyze.spec.ts) |
| INV-02 | 07-09, 07-12, 07-15, 07-20, 07-21 | Manual zero-call entry or cost-shown autofill | ✓ SATISFIED | autofill.spec.ts, demo.spec.ts call-count assertions |
| INV-03 | 07-07, 07-09, 07-12, 07-16, 07-20, 07-21 | Save and compare deals side by side | ✓ SATISFIED | deals.spec.ts (save/cap-3/compare at 1280+375/remove/delete/axe) |
| INV-04 | 07-07, 07-14, 07-18, 07-20, 07-21 | Buy-box saved searches with quick metrics on open | ✓ SATISFIED | buybox.spec.ts, buyBoxRepo/matches unit tests |
| INV-05 | 07-06, 07-09, 07-11, 07-13, 07-20, 07-21 | Market dashboards for ≤5 watched ZIPs | ✓ SATISFIED | markets.spec.ts, charts.ssr, series-style tests |
| INV-06 | 07-02, 07-04, 07-08, 07-17, 07-19, 07-20, 07-21 | AI memo (analyzer-only numbers) printable with disclaimer | ✓ SATISFIED | memo.spec.ts, print.spec.ts, memo-sample FH/number/advice pass |

No orphaned requirements found — REQUIREMENTS.md rows 186-191 map all six INV IDs to Phase 7 and all are claimed across the 21 plans' frontmatter and marked Complete (line 219 confirms gate-level close-out dated 2026-10-06).

### Anti-Patterns Found

None found. Grep for `TODO|FIXME|XXX|HACK|not yet implemented|coming soon` across `apps/web/src/lib/features/investor`, `apps/web/src/lib/ai/prompts/investor`, and `packages/core/src/{finance,markets,numbers}` (excluding `.test.ts`) returned zero matches.

### Human Verification Required

See YAML frontmatter `human_verification` block (13 items: I1-I13 owner-gated real-key/real-device/real-browser/real-deploy checks, plus S1/S2 copy and UX sign-offs). All are explicitly marked `blocking: false` in `07-HUMAN-UAT.md` and are gated on infrastructure the owner has not yet provisioned (GitHub org `tranrealestate`, deployed Pages origin, dedicated RentCast key, spend-limited AI key) — not on missing code or failing tests.

### Gaps Summary

No gaps found in the automated verification layer. All 21 phase plans' must_haves artifacts exist, are substantive (not stubs — core suite 1684 tests pass, zero TODO/placeholder patterns), and are wired (autofill/scheduler races that were flagged as deferred-items from 07-20 were independently confirmed fixed by 07-21's commits 33ecefa/43c2a28/0769526/477beae, with new regression tests). `07-VALIDATION.md` records a green `corepack pnpm verify` (4140 unit tests, 1062 E2E, 0 flaky) and a row-by-row walk of all 57 verification rows, which this verifier did not re-run per instructions but cross-checked by independently running `vitest --project core` (1684/1684 green) and confirming file-level existence/wiring for every artifact path named in the phase brief.

The only open items are the 13 owner-gated UAT checks and 2 sign-offs, which require infrastructure (deployment, real API keys, real devices) outside this codebase's control and are correctly classified as non-blocking by the phase's own validation contract. Status is `human_needed` rather than `passed` to surface these to the orchestrator/owner, not because any code-level gap was found.

---

_Verified: 2026-10-06T08:50:00Z_
_Verifier: Claude (gsd-verifier)_
