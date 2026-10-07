---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 04
subsystem: core-fair-housing
tags: [studio, fair-housing, lexicon, hashtags, advertising, tdd]
requires:
  - phase: 05
    provides: "packages/core/src/fair-housing (p helper, assertSafePattern, checkFairHousing, LEXICON, ALLOW_PHRASES, BAD_PHRASES/NEUTRAL_PHRASES, leave-one-out mutation test)"
provides:
  - "Category 'advertising' with CATEGORY_LABELS.advertising === 'Advertising claim'; LexiconEntry.scope gains 'other' (no state-law note in FindingDetails)"
  - "LexiconEntry.phase?: number; the 22 Phase 9 entries carry phase: 9 (LEXICON.filter((e) => e.phase === 9))"
  - "Hashtag forms flagged: #FamilyHome / #FamilyFriendly / #SafeNeighborhood / #KidFriendly / #1Agent"
  - "Guarantee language blocks (ad.guarantee, ad.cant-lose, ad.will-appreciate); superlatives warn (ad.top-agent, ad.top-producer, ad.best-investment)"
  - "BAD_PHRASES 42 -> 72 rows, NEUTRAL_PHRASES 40 -> 50 (Achtenberg safe-harbor listing phrases)"
affects: [09-10, 09-11, 09-12, 09-13, 09-14, 10]
tech-stack:
  added: []
  patterns:
    - "Hashtag forms: optional leading '#' plus an optional separator group (?: )? so 'family-friendly' and '#FamilyFriendly' share one entry"
    - "Context-dependent claims use lookaheads instead of blanket matches ('will appreciate' only at a clause end or before 'in value')"
    - "Replacement wording only where it fabricates nothing ('#JustListed', 'bonus room'); otherwise alternative '' (Remove phrase) with the guidance in the explanation"
key-files:
  created:
    - packages/core/src/fair-housing/listing-additions.test.ts
  modified:
    - packages/core/src/fair-housing/types.ts
    - packages/core/src/fair-housing/lexicon.ts
    - packages/core/src/fair-housing/suite.ts
    - packages/core/src/fair-housing/check.test.ts
    - packages/core/src/fair-housing/mutation.test.ts
    - packages/core/src/fair-housing/pattern.test.ts
key-decisions:
  - "Advertising entries use scope 'other' (new LexiconEntry scope value; FindingMember already had it) so the UI does not show 'Protected under many state and local laws.' on a non-protected-class claim"
  - "The plan's advertising/steering 'alternatives' are instructions ('Remove the promise.'). Because applyAlternative pastes `alternative` into the copy, that guidance lives in the explanation and alternative is '' (Remove phrase) or neutral replacement wording"
  - "'will appreciate' blocks only at a clause end or before 'in value'; 'Buyers will appreciate the updated kitchen' stays clean (a neutral row proves it)"
  - "familial.family-friendly-area severity warn -> block (plan: block in neighborhood context) and gained plurals plus the hashtag form; the new familial.family-friendly (warn) excludes the area context with a negative lookahead so each phrase has exactly one entry"
  - "#SafeNeighborhood is its own entry (race.safe-area-tag, alternative '#JustListed') rather than widening race.safe-area, so a hashtag is never replaced with plain-text wording"
  - "Many plan BAD phrases were already covered by Phase 5 entries (no children, adults only, Christian community, no Section 8, ...); they are asserted in the new test, not duplicated in the lexicon"
patterns-established:
  - "Phase-tagged lexicon entries: new lexicon waves set phase: N and get their own leave-one-out over that subset"
requirements-completed: []
duration: ~25 min
completed: 2026-10-07
---

# Phase 9 Plan 04: Listing and advertising lexicon additions Summary

**The Fair Housing checker now flags listing-copy hot spots, their hashtag forms and studio advertising claims (22 new phase-9 entries under a new 'Advertising claim' category). The Achtenberg safe-harbor phrases still produce zero findings.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-10-07T03:55Z
- **Completed:** 2026-10-07T04:20Z
- **Tasks:** 2 (TDD RED, GREEN)
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- 22 new lexicon entries, each with `phase: 9`, an explanation and a fix. They cover: ideal for families, mature couple, family-friendly (alone, warn), #FamilyHome, kid-friendly, English only, #SafeNeighborhood, low crime / crime-free, up-and-coming / gentrifying, private / restricted community, great / top-rated schools, bachelor pad, man cave / she shed, professionals only, great for retirees, 55+ / senior / active adult community (HOPA warn), and the advertising guarantee and superlative entries.
- Added the `advertising` category. Its label is `'Advertising claim'` and every entry cites `NY 19 NYCRR 175.25(c)(10); NAR Code of Ethics Art. 12`. Guarantees block. Superlatives warn.
- 'family-friendly neighborhood' now blocks, and 'family-friendly' on its own warns.
- The Phase 5 suite grew from 42 to 72 BAD rows and from 40 to 50 neutrals, so the Phase 5 per-row, in-sentence, capitalized, ReDoS and leave-one-out tests now cover every addition.
- listing-additions.test.ts (101 tests) covers:
  - 22 block phrases and 24 warn phrases, each alone and in a sentence
  - a hashtag block with exact flagged phrases
  - family-friendly context
  - will-appreciate context
  - 21 neutrals
  - the advertising label, sources and scope
  - per-entry fix shape
  - leave-one-out over the 22 phase-9 entries

## Task Commits

1. **Task 1: Failing additions suite (RED)**: `8cdc346` (test). The RED run had 40 of 79 tests failing.
2. **Task 2: Lexicon entries, advertising category, suite update (GREEN)**: `3597f8b` (feat)

## Verification

- `vitest run --project core listing-additions` failed at RED (exit 1, 40 failed), as the plan requires.
- `vitest run --project core fair-housing`: 6 files, 815 tests passed.
- `vitest run --project core`: 84 files, 2625 tests passed.
- `vitest run --project web`: 139 files, 2100 tests passed. This run covers every consumer that pipes fixture and sample copy through `checkFairHousing` (fixture outputs, prompt guardrails, outreach, follow-up, memo checks, panel controller), and none picked up a false positive.
- `pnpm --filter @tran/core check` (tsc): exit 0.
- `pnpm lint` (prettier --check plus eslint, repo-wide): exit 0.
- Mutation check (not committed): I deleted the `race.safe-area` entry and `listing-additions` failed ('safe neighborhood' asks for review; leave-one-out). Then I restored the file.
- Acceptance greps:
  - types.ts contains `'advertising'` and `Advertising claim`.
  - lexicon.ts contains `175.25(c)(10)` and `#?`.
  - No `'family room'`, `'master bedroom'` or `'walk-in closet'` in lexicon.ts.
  - All touched .ts files are ASCII.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated Phase 5 hard-coded count assertions outside files_modified**
- **Found during:** Task 2
- **Issue:** check.test.ts asserted 42 BAD, 40 neutral and 41 entries, and that every non-state entry is `federal`. mutation.test.ts asserted 41 entries. pattern.test.ts asserted 11 category labels. The plan's own additions make these fail.
- **Fix:**
  - The counts are now 72, 50 and 63, and the label list has 12 entries ending in 'Advertising claim'.
  - The scope assertion now expects 'other' for `advertising`.
  - No other test logic changed. No concurrent Phase 9 plan lists these files (checked by grep).
- **Files modified:** packages/core/src/fair-housing/check.test.ts, mutation.test.ts, pattern.test.ts
- **Commit:** 3597f8b

**2. [Rule 1 - Bug] Instructional "alternatives" would be pasted into copy**
- **Found during:** Task 2
- **Issue:** The plan says every new entry needs a non-empty alternative and suggests strings like "Remove the promise.". `applyAlternative` inserts `alternative` verbatim, and FindingDetails shows it as "Suggested wording", so an instruction would end up inside the listing text.
- **Fix:**
  - The guidance sentence is part of each explanation.
  - `alternative` is either neutral replacement wording ('#JustListed' for hashtags, 'bonus room') or '' (rendered as "Suggested fix: remove this phrase.").
  - The test asserts that an alternative never reads as an instruction.
- **Commit:** 3597f8b

**3. [Rule 1 - Bug] 'will appreciate' scoped to value claims**
- **Issue:** A blanket 'will appreciate' block would flag ordinary listing praise ("Buyers will appreciate the updated kitchen"), which is Pitfall 1.
- **Fix:**
  - A lookahead matches only at a clause end or before 'in value'.
  - The listing-additions test asserts 'will appreciate' alone.
  - The shared BAD_PHRASES row is 'will appreciate in value', because the Phase 5 capitalized-sentence harness appends " today." and that row must still match.
- **Commit:** 3597f8b

**4. [Rule 2 - Missing critical] Extra neutral rows**
- Added 'single-family home' and 'Buyers will appreciate the updated kitchen' to the neutral sets as false-positive guards for the new #FamilyHome and will-appreciate patterns.

### Notes

- No `requirements mark-complete` was run, per the briefing. The 09-23 phase gate closes STU-01 and STU-02.
- Concurrency: both commits used explicit pathspecs. `git show --stat` confirms that 8cdc346 contains only listing-additions.test.ts and 3597f8b contains only the 6 files above. None of my files were committed by another executor.
- Playwright was not run (only 09-09 does). The fair-housing UI browser tests were not run here.

## Known Stubs

None.

## Next Phase Readiness

- Studio drafts (09-10 onward) get the new findings automatically through `checkFairHousing`/`runChecks`. Hashtag lists should be checked as one joined string, as the hashtag test does.
- Overlap to watch: some advertising claims are also in the investor memo's `checkAdviceLanguage`:
  - 'guaranteed return'
  - 'will appreciate'
  - "can't lose"
  - 'best investment'

  In a memo, one such phrase is now one merged mark with two members. Because `memoGateReasons` groups findings by checker, a memo blocked on, for example, 'will appreciate' lists both the Fair Housing and the advice-language reasons. The memo is still correctly gated, and the web suite is green. If the duplicate reason is unwanted, the investor memo can filter `category === 'advertising'` members out of its Fair Housing group. That is a follow-up decision, out of scope here.

## Self-Check: PASSED

- FOUND: packages/core/src/fair-housing/listing-additions.test.ts
- FOUND: commits 8cdc346, 3597f8b
