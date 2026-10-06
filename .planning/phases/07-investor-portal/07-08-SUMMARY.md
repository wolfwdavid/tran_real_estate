---
phase: 07-investor-portal
plan: 08
subsystem: finance-core
tags: [memo, facts, numeric-post-check, fair-housing, advice-language, hash, fast-check]
requires:
  - "07-01: usd/usdRange/pct/pctTrim/ratio/rateLabel/longDate"
  - "07-02: extractNumerals, checkNumbers, allowedFromText, AllowedNumber"
  - "07-05: analyze, DealInputs/DealAnalysis, METRIC_DEFINITIONS, ANALYZER_VERSION, REFERENCE_CASES, dealArb"
  - "Phase 5: checkFairHousing (@tran/core/fair-housing)"
provides:
  - "@tran/core/finance: buildMemoFacts(input) -> { factsText, lines, notes, allowed }, FieldSourceFact, MemoFactsInput, MemoFacts"
  - "@tran/core/finance: sampleMemo(facts) (deterministic keyless memo)"
  - "@tran/core/finance: checkAdviceLanguage(text) -> AdviceFinding[] (category 'advice-language')"
  - "@tran/core/finance: canonicalJson, fnv1a32, analysisHash(inputs) (8 hex, includes ANALYZER_VERSION)"
affects: [memo panel / LLM prompt, memo print, saved memo staleness]
tech-stack:
  added: []
  patterns: [FACTS-in narration-out, allowed set derived from the exact prompt text, template-only sample memo, sync FNV-1a fingerprint]
key-files:
  created:
    - packages/core/src/finance/memo-facts.ts
    - packages/core/src/finance/memo-facts.test.ts
    - packages/core/src/finance/memo-sample.ts
    - packages/core/src/finance/memo-sample.test.ts
    - packages/core/src/finance/memo-language.ts
    - packages/core/src/finance/memo-language.test.ts
    - packages/core/src/finance/analysis-hash.ts
    - packages/core/src/finance/analysis-hash.test.ts
  modified:
    - packages/core/src/finance/index.ts
decisions:
  - "Sample-data rent sources never carry an 'as of' date (synthetic fixture); only RentCast sources do"
  - "Advice lexicon is a superset of INVESTOR_BANNED plus BANNED's promissory entries; block = guaranteed/risk-free/will appreciate/can't lose, warn = deal/investment judgements, we recommend, you should, passive income, no-brainer, cash cow"
  - "Property counts (bedrooms, bathrooms, square feet, comps, loan term years) use a local Intl integer/1-dp formatter in memo-facts; all money/percent/ratio/date values use @tran/core/format"
  - "Raw-float guard: /\\d+\\.\\d{3,}/ holds for all reference cases; random deals are checked with /\\d+\\.\\d{4,}/ because rateLabel legitimately shows up to 3 decimals (7.125%)"
metrics:
  duration: ~25min
  completed: 2026-10-05
  tasks: 3
  files: 9
---

# Phase 7 Plan 08: Memo FACTS, sample memo, advice check and analysis hash Summary

The deal memo now has pure inputs and guards. `buildMemoFacts` writes the only text the memo model sees: pre-formatted analyzer lines with labels from `METRIC_DEFINITIONS`, plus the user's notes, and builds the allowed-number set from that exact text with `allowedFromText(factsText, 'analysis')` and `allowedFromText(notes, 'your notes')`. `sampleMemo` is a deterministic five-paragraph memo for keyless mode. All nine reference deals pass the numeric post-check, Fair Housing and advice-language checks with zero findings, and 300 random deals pass the numeric check. `checkAdviceLanguage` flags promissory and advice phrasing. `analysisHash` gives a synchronous FNV-1a fingerprint of the inputs plus `ANALYZER_VERSION`, used for memo staleness.

Advances requirement **INV-06** (left open until the phase gate; `requirements mark-complete` not run, per orchestrator).

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | FACTS builder, allowed set, format/extract round trip | acdf49a (RED), 519843c (GREEN) |
| 2 | Sample memo + advice-language check | bd8ca07 (RED), dae66b4 (GREEN) |
| 3 | Analysis hash | eafa713 (RED), d09b164 (GREEN) |

## Verification

- `vitest run --project core memo-facts`: 11 pass. Covers the case A lines in order, all cash, null-in-words, the vacancy base wording, rent sources, the allowed set, the property "every FACTS numeral is allowed" (300 runs), and round trips for usd/pct/ratio (500 runs each).
- `memo-sample memo-language`: 35 pass. Covers reference cases A-I against all three checks, source/notes/all-cash/property-detail variants, the digit sweep (no digit outside interpolated facts except the "1% rule" name), the property over dealArb with an optional source and comps 1..30 (300 runs), and the mutation guard. Also covers every lexicon phrase, neutral text, sort order and offsets.
- `analysis-hash`: 6 pass. Covers canonicalJson, the FNV-1a known vectors (''/a/foobar), key-order stability, the version suffix, single-input changes and the property (300 runs).
- Full core: **59 files, 1684 tests pass** (`--no-file-parallelism`). `pnpm --filter @tran/core check` (tsc) is clean. Prettier and ESLint are clean on `packages/core/src/finance`. Repo-wide `pnpm lint` was not run because parallel plans have in-flight files under apps/web.
- **Mutation tests (each applied alone, then reverted):**
  - A stray digit in the sample template ("over 5 years"): 11 tests fail.
  - Dropping the `cash cow` lexicon entry: 1 fails.
  - "great deal" injected into the template: 10 fail.
  - Hash version suffix changed to `v2`: 1 fails.
  - canonicalJson key sort removed: 3 fail.
  - All killed.

## Deviations from Plan

**1. [Rule 1 - Test correctness] Mutation guard amount**
- **Found during:** Task 2
- **Issue:** The plan says to add $500 to the first "$" amount. The first amount is the purchase price ($200,000), and +$500 is within the post-check's 0.5% relative tolerance, so that mutant is designed to pass.
- **Fix:** The test applies `2n + 500` to the first amount for every reference case, and also applies the plan's literal +$500 to the cash-flow figure ($184 to $684) for case A. Both are blocked.
- **Commit:** bd8ca07

**2. [Rule 1] Raw-float regex scope**
- **Issue:** `rateLabel` produces up to 3 decimals, so `/\d+\.\d{3,}/` would match "7.125%" on random deals.
- **Fix:** That regex is asserted on all reference cases, as specified. Random deals use `\d{4,}`.

**3. Additions within intent**
- Optional `Purchase price source` and property-detail lines are included.
- `closing` as a percent renders as "3% ($6,000)".
- The lexicon also covers "good investment", "best investment", "bad deal" and "guaranty" so it matches the copy gate.

Commit-message note: the first RED commit was amended once to remove a trailer, before any later commit landed.

## Known Stubs

None.

## Self-Check: PASSED
