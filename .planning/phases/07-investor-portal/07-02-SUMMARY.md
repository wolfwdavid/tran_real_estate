---
phase: 07-investor-portal
plan: 02
subsystem: core/numbers
tags: [numeric-post-check, memo, provenance, pure-functions, fast-check]
requires: []
provides:
  - "@tran/core/numbers: extractNumerals, NumeralToken"
  - "@tran/core/numbers: checkNumbers, matchesAllowed, allowedFromText, NUMERIC_CATEGORY, NumberFinding, AllowedNumber"
  - "@tran/core/numbers: findSpelledQuantities"
affects: [07-04 (PostCheck wrapper), 07-08 (formatter round-trip), Phase 9 features/studio]
tech-stack:
  added: []
  patterns: ["pre-strip by same-length blanking so offsets survive", "table-driven boundary tests per tolerance rule (mutation-verified)"]
key-files:
  created:
    - packages/core/src/numbers/extract.ts
    - packages/core/src/numbers/check.ts
    - packages/core/src/numbers/spelled.ts
    - packages/core/src/numbers/index.ts
    - packages/core/src/numbers/numbers.test.ts
    - packages/core/src/numbers/numbers.property.test.ts
  modified: []
decisions:
  - "Accounting-paren negatives apply only to unit-less numerals closed by ')': '(183.52)' and '($183.52)' are negative, '(7.49%)' and '(1.17x)' are ordinary parentheticals (avoids blocking a very common memo phrasing)"
  - "Markdown bullets at line start ('- ', '* ', '• ') are pre-stripped so '- 30-year' is not read as -30"
  - "Line-anchored pre-strip rules use [ \\t]* instead of \\s* so ^ cannot scan across blank lines (linear scan)"
  - "Spelled-out words that are part of a digit numeral ('20 million') are never reported; spelled.ts excludes them itself so standalone use is correct"
  - "User-notes numerals belong in the allowed set (tag source 'your notes'); derived numbers do not"
metrics:
  duration: ~25 min
  completed: 2026-10-05
  tasks: 2
  files: 6
---

# Phase 7 Plan 02: Numeric post-check Summary

Pure numeral extractor plus allowed-set checker in `packages/core/src/numbers/`: every digit numeral in generated text is matched against the analyzer's figures with half-unit or 0.5% relative tolerance, and anything else comes back as a `block` finding with exact offsets. Spelled-out quantities come back as `warn` findings, and the category label is a parameter that Phase 9 can override.

## What was built

- **extract.ts**: the RESEARCH Pattern 5 `NUM` regex, used verbatim. It handles sign (`-`, `−`, accounting parens), currency, scale (k/K/thousand/M/million) and `%`/`percent`/`x`/`×` units. Before matching, it blanks the 1%/50% rule phrases, list enumerators and markdown bullets with spaces of the same length. Values are computed as `digits × scale / 10^decimals`, so `1.85k` is exactly 1850. Leading and trailing whitespace is trimmed from every span, so `text.slice(start, end) === raw` always holds.
- **check.ts**: `matchesAllowed` uses the plan's rule verbatim (sign match, then half unit + 1e-9, or `sig ≥ 2` and within 0.5%). `checkNumbers(text, allowed, { category })` drops non-finite allowed values, merges in spelled-out warns that don't overlap a block, and sorts findings by start. `allowedFromText(text, source)` builds the allowed set. The header comment documents the unit-agnostic matching, the `$0.2 million` coincidence and the user-notes decision.
- **spelled.ts**: reports maximal runs of number words (joined by space, hyphen or "and") that contain a word above ten or "dozen", plus any run directly followed by "percent".
- **Tests (113)**: every Pattern 5 prototype pass and flag, a full sample memo that flags exactly `20%`, `1,800`, `2,100` and `-5%`, the UI-SPEC tolerance examples, boundary tables for each rule, spelled-out cases, and the category override. Properties (500 runs each) cover any formatting of an allowed number passing and 1.5× an allowed integer being flagged. A ReDoS budget test checks 100k random characters, a 50k comma chain and a 100k digit run in under 250 ms.

## Verification

- `corepack pnpm vitest run --project core numbers`: 113/113 pass.
- `tsc --noEmit` reports 0 errors in `numbers/`. While this plan ran, the package-wide `check` was red only because of 07-01's in-progress `format/` RED test, which is not in scope here.
- ESLint is clean and Prettier is clean on `packages/core/src/numbers`.
- **Mutation test:** 14 mutants were run against the tolerance and extraction rules, and every one was killed:
  - removing the sign check, the relative rule or the named-rule pre-strip
  - half-unit factor set to 1 or 0.4
  - relative factor set to 0.01 or 0.003
  - sig threshold set to ≥1 or ≥3
  - dropping the unit guard on accounting parens or the trailing-zero sig rule
  - removing the spelled-out above-ten guard or the digit-overlap guard

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Markdown bullet pre-strip added**
- **Found during:** Task 1
- **Issue:** A memo bullet `- 30-year fixed` would parse as -30 and block a correct memo.
- **Fix:** Added the pre-strip rule `/^[ \t]*[-*•][ \t]/gm`, with a test.
- **Commit:** f020fde

**2. [Rule 1 - Bug] Enumerator rule made linear**
- **Issue:** The plan's `/^\s*\d+[.)]\s/gm` can scan across blank lines from every line start, which is quadratic on blank-heavy input.
- **Fix:** Changed the rule to `^[ \t]*\d+[.)]\s`.
- **Commit:** f020fde

**3. [Rule 1 - Bug] Parenthetical percents are not accounting negatives**
- **Issue:** The plan accepted reading `(7%)` as negative. That blocks the common LLM phrasing "cap rate of ≈7.5% (7.49%)".
- **Fix:** The accounting form now requires a unit-less numeral. `(183.52)` is still flagged for sign mismatch, as the plan requires.
- **Commit:** f020fde

**4. [Rule 1 - Bug] Leading and trailing whitespace trimmed from spans**
- **Issue:** The regex's optional `\s?` groups can capture surrounding spaces.
- **Fix:** Spans are trimmed so offsets highlight only the numeral.
- **Commit:** f020fde

## Notes for downstream plans

- **07-04:** `NumberFinding` keeps the plan contract `{ start, end, text, severity, category, reason }`. It maps to Phase 5's `FindingMember` as `phrase = text`, with `severity`, `category`, `start` and `end` unchanged.
- **Phase 9:** call `checkNumbers(text, allowedFromText(facts), { category: '<label>' })`.
- **Requirement advanced:** INV-06 (the numeric gate). It stays open until the 07-21 gate.

## Known Stubs

None. The Task 1 throwing stubs in check.ts and spelled.ts were replaced in 9987219.

## Commits

- 3238410 test(07-02): add failing numeral extraction tests
- f020fde feat(07-02): numeral extraction
- ea54f4f test(07-02): add failing tolerance and spelled-out tests
- 9987219 feat(07-02): numeric post-check

## Self-Check: PASSED
