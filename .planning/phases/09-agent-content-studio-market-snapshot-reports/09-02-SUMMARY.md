---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 02
subsystem: core-numbers
tags: [studio, numbers, number-words, allowed-set, tdd]
requires:
  - "Phase 7 packages/core/src/numbers (extractNumerals, checkNumbers, matchesAllowed, allowedFromText, findSpelledQuantities) - reused unchanged"
provides:
  - "@tran/core/numbers: findNumberWords(text) -> NumberWordHit[] ({ start, end, word }), next to the Phase 7 exports"
  - "packages/core/src/studio/allowed-numbers.ts: numbersInTexts(texts), allowedSet(values, texts?) (09-10's studio barrel re-exports them)"
affects: [09-03, 09-04, 09-05, 09-06, 09-10]
tech-stack:
  added: []
  patterns:
    - "Unicode letter/digit boundaries ((?<![\\p{L}\\p{N}]) / (?![\\p{L}\\p{N}]), giu) instead of ASCII \\b for word detectors"
    - "Allowed sets are parsed with the same extractor the checker runs on output"
key-files:
  created:
    - packages/core/src/numbers/number-words.ts
    - packages/core/src/numbers/number-words.test.ts
    - packages/core/src/studio/allowed-numbers.ts
    - packages/core/src/studio/allowed-numbers.test.ts
  modified:
    - packages/core/src/numbers/index.ts
decisions:
  - "Task 1 was case (a): Phase 7 already put the pure check in packages/core/src/numbers with an index.ts barrel, and package.json already exports ./numbers. No move, no package.json change, no refactor commit"
  - "findNumberWords skips scale words and 'percent' when the previous non-space character is a digit or '%', and skips any hit overlapping a digit numeral, so '$1.2 million' and '20 thousand' (already covered by the digit check) are not double-reported"
  - "findNumberWords reports one hit per word (studio contract), separate from Phase 7's run-based findSpelledQuantities (memo warn findings), which stays unchanged"
metrics:
  duration: "~10 min"
  completed: 2026-10-07
  tasks: 2
  files: 5
---

# Phase 9 Plan 02: Shared number check, number words, allowed sets Summary

The studio can now import the memo's number check plus a new Unicode-safe `findNumberWords` detector from `@tran/core/numbers`. A generic `allowedSet` builder turns the agent's typed values and own free text into the set of numbers the output check allows.

## What was built

- **Task 1 (case a, no move needed):** Phase 7's pure extractor and matcher already live in `packages/core/src/numbers/` (`extract.ts`, `check.ts`, `spelled.ts`, `index.ts`). `packages/core/package.json` already declares `"./numbers": "./src/numbers/index.ts"`, and web code already imports `checkNumbers` from `@tran/core/numbers`. Exported names: `extractNumerals`, `NumeralToken`, `checkNumbers`, `matchesAllowed`, `allowedFromText`, `AllowedNumber`, `NumberFinding`, `NUMERIC_CATEGORY`, `findSpelledQuantities`, and now `findNumberWords`, `NumberWordHit`. `grep -rn "features/investor" packages/core/src` returns nothing.
- **Task 2:** `findNumberWords` reports eleven through nineteen, twenty through ninety (each optionally followed by `-one` through `-nine` as a single hit), hundred, thousand, million, billion and dozen. It also reports `percent` when no numeral or `%` comes before it. Words one through ten are never reported. The regex is a flat alternation with at most one optional suffix (no nested quantifiers), and a 40k-token adversarial input runs well under the 2 s guard. `numbersInTexts` collects every `extractNumerals` value from non-empty texts. `allowedSet` returns the finite, de-duplicated, ascending union of typed values and text numbers.

## Verification

- `vitest run --project core number-words allowed-numbers`: 2 files, 19 tests passed
- `vitest run --project core` (full core): 78 files, 2186 tests passed (includes the Phase 7 memo-facts and memo-sample tests)
- `vitest run --project web src/lib/features/investor/memo src/lib/ai/prompts/investor`: 4 files, 34 tests passed (Phase 7 memo tests unchanged)
- Mutation check: removing `dozen` from the word list made 2 number-word tests fail. Reverted, not committed
- Scoped prettier and eslint on all 5 files: clean. `pnpm banned`: passed (342 files). All 4 new .ts files are ASCII-only
- `pnpm --filter @tran/core check` and repo-wide `pnpm check`: the only errors were in other wave-1 plans' in-progress RED tests (`studio/snapshot-metrics.test.ts`, then `studio/team-name.test.ts`, whose modules did not exist yet). Nothing in 09-02's files
- The full web suite was not run, per the briefing's "targeted vitest only" rule for concurrent executors

## Commits

- 502dd93 `test(09-02): add failing number-word and allowed-set tests` (RED: both suites failed on missing modules)
- ba21100 `feat(09-02): number-word detector and allowed-number sets` (GREEN)
- e522d56 (09-01's commit) also contains the 09-02 ASCII fix to `number-words.test.ts`, see Deviations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test source was not ASCII, and one Unicode-boundary case tested nothing**
- **Found during:** Task 2 (post-GREEN ASCII check)
- **Issue:** Prettier turned the `é` escapes in `number-words.test.ts` into literal glyphs, which breaks the repo's ASCII-only .ts rule. The case `'preéleven'` also never contained "eleven", so it passed without testing anything.
- **Fix:** Added `const E_ACUTE = String.fromCharCode(0xe9)`. The cases are now template literals, and the first one is `` `pr${E_ACUTE}eleven` ``, which puts a non-ASCII letter directly before "eleven". ASCII `\b` would match there. The `\p{L}` lookbehind correctly does not.
- **Commit:** I staged the fix and committed it as `test(09-02): ...`, but a concurrent 09-01 executor's `git commit` ran first on the shared index. The change landed inside e522d56 (`test(09-01): add failing team-name and license-title tests`), and my own commit then had nothing to commit. The content is correct and committed. I left the history alone so I would not rewrite other executors' commits.

**2. [Scope note] Extra test coverage beyond the behavior bullets:** a barrel test (Phase 7 functions plus `findNumberWords` resolve from `numbers/index`), digit-scale overlap, `percentage` non-match, infinity filtering and a linear-time guard.

## Requirements

STU-01, STU-02 and STU-03 are not marked complete here. Per the briefing, the phase gate (09-23) closes requirement ids.

## Known Stubs

None. `packages/core/src/studio/index.ts` (the studio barrel) belongs to 09-10, so `@tran/core/studio` does not re-export `allowedSet` until that plan lands. Until then, import it from `packages/core/src/studio/allowed-numbers.ts` directly.

## Self-Check: PASSED

All 4 created files exist; commits 502dd93, ba21100, e522d56 present.
