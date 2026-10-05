---
phase: 05-ai-layer-providers-streaming-fair-housing-guardrails
plan: 02
subsystem: fair-housing
tags: [fair-housing, regex, unicode, redos, tdd, core]
requires: []
provides:
  - "@tran/core/fair-housing: Category, Severity, LexiconEntry, FindingMember, Finding, CATEGORY_LABELS, STATE_SCOPE_NOTE"
  - "p`` authoring helper, assertSafePattern (ReDoS guard), compilePattern (Unicode boundaries, giu)"
  - "checkFairHousing, mergeFindings (cross-checker overlap merging)"
  - "applyAlternative (replace with capitalization / remove with punctuation tidy)"
  - "ALLOW_PHRASES (Achtenberg-neutral + accessibility features), empty LEXICON placeholder"
affects: [05-04, 05-06, 05-12, portal phases]
tech-stack:
  added: []
  patterns:
    - "Matcher runs on the original string only (no lowercase/normalize) so offsets are exact"
    - "Pattern scanner (group stack, escape + char-class skipping) rejects nested unbounded quantifiers"
    - "compilePattern caches compiled RegExps but returns fresh clones (no shared lastIndex)"
key-files:
  created:
    - packages/core/src/fair-housing/types.ts
    - packages/core/src/fair-housing/pattern.ts
    - packages/core/src/fair-housing/pattern.test.ts
    - packages/core/src/fair-housing/allow.ts
    - packages/core/src/fair-housing/lexicon.ts
    - packages/core/src/fair-housing/check.ts
    - packages/core/src/fair-housing/engine.test.ts
    - packages/core/src/fair-housing/apply.ts
    - packages/core/src/fair-housing/apply.test.ts
    - packages/core/src/fair-housing/index.ts
  modified: []
decisions:
  - "ReDoS guard treats only open-ended quantifiers (+, *, {n,}) inside a group as dangerous; bounded {n,m} inside a repeated group is allowed"
  - "p`` rejects any authored character class containing a space or hyphen (checked before the tolerance transform)"
  - "Remove-phrase on a final list item ('a, X.') drops the dangling left separator instead of the period"
metrics:
  duration: 6min
  completed: 2026-10-05
  tasks: 3
  files: 10
---

# Phase 5 Plan 02: Fair Housing Matching Engine Summary

Deterministic Fair Housing engine in `packages/core/src/fair-housing/`: a `p` pattern helper that makes spaces, hyphens, NBSP and apostrophes tolerant and blocks ReDoS-prone patterns at authoring time, a matcher with Unicode-aware boundaries that runs on the original text (so offsets are exact), allow-list suppression, overlap merging across checkers, and `applyAlternative` for one-click replace or remove. The lexicon data arrives in 05-04.

## Tasks

| # | Task | RED commit | GREEN commit |
|---|------|-----------|--------------|
| 1 | Types, p`` helper, ReDoS guard | 1eb7f99 | 60ab9e4 |
| 2 | Matcher, allow-list suppression, overlap merging | 14cc955 | 92cca65 |
| 3 | applyAlternative (capitalization + remove tidy) | 7b2fc9a | eb80fd2 |

## Verification

- `corepack pnpm exec vitest run --project core`: 25 files, 535 tests pass (58 in fair-housing)
- `corepack pnpm --filter @tran/core check`: clean
- `corepack pnpm lint`: clean
- **Mutation tests** (each guard disabled, then restored; every mutant killed):
  - ReDoS guard throw removed: 8 tests fail
  - Allow-list suppression disabled: 2 tests fail
  - Overlap merging disabled (`member.start < end` -> `false`): 4 tests fail
  - Group severity set to last member instead of "any block": 2 tests fail
  - Block-before-warn tie-break removed: 1 test fails

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Double space after mid-list removal**
- **Found during:** Task 3 (applying the plan's step list literally)
- **Issue:** Step 2's ",;:" branch dropped only the right-hand comma, leaving `'Two bedrooms,  utilities'`.
- **Fix:** Both punctuation-drop branches also strip the spaces after the dropped character.
- **Commit:** eb80fd2

**2. [Rule 1 - Bug] Steps 2 and 3 conflicted for "a, X."**
- **Issue:** Step 2 would drop the final period when the left ended in a comma.
- **Fix:** When the left ends in `,;:` and the right starts with `.!?`, drop the left separator and keep the period (`'Utilities included, no Section 8.'` -> `'Utilities included.'`). Covered by a test.
- **Commit:** eb80fd2

**3. [Rule 2 - Correctness] Scanner handles `\p{...}`, `\u{...}`, `\k<...>` escapes**
- **Issue:** Without it, the `{` in `\p{L}` could be read as a quantifier.
- **Fix:** `skipEscape` skips braced or angled escape bodies. A `\p{L}+` acceptance test covers it.
- **Commit:** 60ab9e4

Additional tests beyond the plan bullets: chained overlaps, touching ranges stay separate, a warn-only overlap stays warn, no match inside a longer word ("Bachelorette"), whole-text removal, inline removal collapses to one space, and fresh-clone `lastIndex` isolation.

## Known Stubs

- `packages/core/src/fair-housing/lexicon.ts`: `LEXICON = []` is intentional. Plan 05-04 (wave 2) fills it. The engine tests use injected lexicons, and the only empty-lexicon assertion passes `[]` explicitly, so 05-04 won't break it.

## Self-Check: PASSED
