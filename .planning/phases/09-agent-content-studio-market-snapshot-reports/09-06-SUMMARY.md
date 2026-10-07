---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 06
subsystem: studio-core
tags: [studio, social-pack, reel-script, parser, timing, tdd]
requires:
  - phase: 01-foundation
    provides: packages/core workspace package, core vitest project, tsc check
provides:
  - "social-sections.ts: SOCIAL_MARKERS, SocialSection, SocialPack, SocialPostType, parseSocialPack, splitTrailingHashtags, parseHashtagLine, buildHashtagCandidates"
  - "reel.ts: ReelLength, BeatKey, BEAT_KEYS, BEAT_OUTPUT_LABELS, BEAT_NAMES, REEL_TEMPLATES, WORDS_PER_SECOND, CAPTION_LINE_MAX, RESULTS_PLACEHOLDER, formatTime, formatSlot, estimateSpokenSeconds, ParsedBeat, ReelParse, parseReel, TimedBeat, timeBeats, ResultsViolation, checkResultsBeat, findAttributedQuotes, formatReelScript"
affects: [09-10-studio-barrel, studio-social-ui, studio-reel-ui, 09-23-phase-gate]
tech-stack:
  added: []
  patterns:
    - "Model output split by line-anchored marker/label regexes; first occurrence wins; prose before the first marker ignored"
    - "Times are code-owned: timeBeats reads only REEL_TEMPLATES[length]"
    - "Non-ASCII regex characters built with String.fromCharCode + new RegExp (String.raw) so Prettier cannot turn escapes into glyphs"
key-files:
  created:
    - packages/core/src/studio/social-sections.ts
    - packages/core/src/studio/social-sections.test.ts
    - packages/core/src/studio/reel.ts
    - packages/core/src/studio/reel.test.ts
  modified: []
key-decisions:
  - "A section that holds only a hashtag line is 'empty', not an ok card with a blank body"
  - "Instagram tags come from the INSTAGRAM HASHTAGS section when present, otherwise from a trailing hashtag-only line in the Instagram body"
  - "checkResultsBeat returns [] when there is no RESULTS block (parseReel already reports missing-beats); placeholder-missing spans the whole results block; digits are reported per number run over the exact digits"
  - "Reel field lines accept continuation lines (non-field, non-blank lines after a field), so multi-line captions are kept and each line is length-checked"
  - "overrunSeconds is rounded to 0.1 s with a 0.1 s floor whenever the estimate exceeds the slot"
  - "formatReelScript separates header, beats, shot list and footer with blank lines; shot list skips beats with no B-roll; an empty footer is omitted"
patterns-established:
  - "Local SocialPlatform union mirrors disclosure-format Platform; 09-10 aligns them through the barrel"
requirements-completed: []
duration: 11min
completed: 2026-10-07
---

# Phase 9 Plan 06: Social pack parser and reel parser/timing Summary

**Pure core parsers for the two cut-line tools: one social generation splits into Instagram, Facebook and LinkedIn sections with explicit missing/empty errors, a streaming active-platform signal and people-free hashtag candidates; reel scripts parse from readable label blocks, get their times only from code templates (hook 0-3 s, ending at exactly 30 or 60 s), and gain the results-placeholder rule, attributed-quote detection and the copied-script format.**

## Performance

- **Duration:** about 11 min
- **Completed:** 2026-10-07
- **Tasks:** 2 (each TDD RED, then GREEN)
- **Files created:** 4

## Accomplishments

- `parseSocialPack` matches `=== INSTAGRAM ===` style markers case- and spacing-insensitively (INSTAGRAM HASHTAGS tried first, CRLF tolerated). It returns `{ ok:false, reason:'missing' | 'empty' }` per platform and reports `active` (the last marker's platform, with HASHTAGS mapping to instagram) only when `streaming` is set.
- `splitTrailingHashtags` and `parseHashtagLine` split, normalise and deduplicate tags and drop a bare `#`. `buildHashtagCandidates` builds tags in a fixed order from the post type, the typed area (`#{Area}RealEstate`, `#{Area}`), the property type (`#SingleFamilyHome`, `#MultiFamily`, otherwise PascalCase) and `#RealEstate`. Its only inputs are places and property kinds, never people.
- `parseReel` reads the six UI-SPEC Note 10 labels (case-insensitive, optional colon) with `Voiceover:` / `Caption:` / `B-roll:` fields in any order. It returns `missing-beats` with the missing keys, or `out-of-order`. Beat offsets cover each block in the source.
- `timeBeats` copies start and end seconds from `REEL_TEMPLATES[length]` and never from model text. A test shows that a voiceover containing "0:00 to 0:09" changes nothing. Overrun (2.5 words per second) and caption lines over 42 characters become notes, and the text is never shortened.
- `checkResultsBeat` enforces the empty-results rule (placeholder required, no digits, exact offsets over `47`) and is off when the agent typed results. `findAttributedQuotes` catches `"..." said/says/told me/wrote` within 20 characters, with straight or curly quotes, plus the phrases "my client(s) say/said/tell me", "a client said/told me" and "one buyer said/told me". The regexes have no nested quantifiers.
- `formatReelScript` produces `REEL SCRIPT (N seconds)`, a `{slot} {LABEL}` block per beat, `B-ROLL SHOT LIST` with numbered `1. 0:00 ...` lines, and the footer last.

## Task Commits

1. **Task 1 RED: failing social pack parser tests**: `f46c2dc` (test)
2. **Task 1 GREEN: social pack section parser and hashtag helpers**: `93aadbf` (feat)
3. **Task 2 RED: failing reel timing and parser tests**: `12d23ae` (test)
4. **Task 2 GREEN: reel parser, code-owned timing and results rule**: `d93f954` (feat)
5. **Follow-up: keep studio parser sources ASCII-only**: `8a44676` (fix, social-sections.ts)

All five commits contain only this plan's files (checked with `git show --name-only`). None of my files were committed by another executor.

## Verification

- `vitest run --project core social-sections`: 19/19 passed
- `vitest run --project core reel social-sections`: 46/46 passed
- `vitest run --project core studio`: 9 files, 239/239 passed (this includes the concurrent 09-01/02/03/05 studio files present at the time)
- `pnpm --filter @tran/core check` (tsc): exit 0
- Scoped `eslint` on the 4 files: clean. Scoped `prettier --write`: no changes after formatting.
- `pnpm banned`: passed (348 files)
- Repo-wide `pnpm lint`: failed at `prettier --check` on `packages/core/src/fair-housing/lexicon.ts`. That file belongs to a concurrent plan (09-04 listing lexicon work), not this one, so I did not touch it.
- Mutation check: changing the 30 s `['hook', 0, 3]` to `['hook', 0, 4]` made `vitest run --project core reel` exit 1. I reverted the change and confirmed the file is byte-identical to the original with `diff`.
- ASCII check: all 4 files contain 0 non-ASCII bytes.
- Acceptance greps: every required literal is present (`'INSTAGRAM HASHTAGS'`, `'#JustListed'`, `'#PriceImprovement'`, `RESULTS_PLACEHOLDER = '[Add a real result you can document]'`, `WORDS_PER_SECOND = 2.5`, `CAPTION_LINE_MAX = 42`, `['hook', 0, 3]`, `['cta', 52, 60]`, `'MANUAL PAIN'`, `'CALL TO ACTION'`, `REEL_TEMPLATES[length]`; the tests contain `'Here are your posts:'`, `reason: 'missing'`, `'47 families'` and `'My clients say I answer fast.'`).

## Decisions Made

See `key-decisions` in the frontmatter. These are the behaviours the plan left open: hashtag-only sections, Instagram tag fallback, offsets for the results violation, caption continuation lines, overrun rounding, and the copy layout's blank lines.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prettier turned regex Unicode escapes into literal glyphs**
- **Found during:** Task 2 (ASCII check after formatting)
- **Issue:** Prettier rewrote `“`/`”` in the quote regex literal (reel.ts) and `’` in the apostrophe regex (social-sections.ts) as literal curly glyphs, which breaks the repo's ASCII-only `.ts` rule.
- **Fix:** Built both regexes with `new RegExp(...)` from `String.fromCharCode` constants. The quote pattern uses `String.raw` so `\b` and `\n` stay regex escapes.
- **Files modified:** packages/core/src/studio/reel.ts, packages/core/src/studio/social-sections.ts
- **Commit:** `d93f954` (reel.ts, folded into Task 2 GREEN) and `8a44676` (social-sections.ts, a follow-up fix commit because Task 1 GREEN was already committed)

**Total deviations:** 1 auto-fixed (Rule 1). No scope creep.

## Requirements

STU-02 and STU-03 are not marked complete here. Per the phase briefing, the 09-23 phase gate closes requirement IDs.

## Known Stubs

None. Both modules are pure functions with no UI or data wiring.

## Issues Encountered

- The repo-wide lint was red because of another executor's in-progress `fair-housing/lexicon.ts`. I logged it and left it alone.

## Next Phase Readiness

- 09-10 can re-export both modules through the studio barrel and align `SocialPlatform` with `Platform` from disclosure-format.ts.
- The social and reel UI plans can consume `parseSocialPack(text, { streaming: true }).active`, `timeBeats`, `checkResultsBeat` (block finding), `findAttributedQuotes` (warn finding) and `formatReelScript` as `formatForExit`.

## Self-Check: PASSED

- All 4 source/test files and this SUMMARY exist; commits f46c2dc, 93aadbf, 12d23ae, d93f954 and 8a44676 exist; no uncommitted changes remain in this plan's files.
