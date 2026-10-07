---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 21
subsystem: studio-reel-engine
tags: [studio, reel, prompts, post-checks, ai-disclosure, checklist, tdd]
requires:
  - phase: 05
    provides: "prompt registry (registerPrompt/buildPrompt + property-not-people guardrail), PromptDef build()/sample() contract (maxTokens >= 2048), runChecks/computeGate"
  - phase: 07
    provides: "createPostCheck factory, @tran/core/numbers checkNumbers"
  - phase: 09-06
    provides: "@tran/core/studio reel: BEAT_KEYS, BEAT_OUTPUT_LABELS, REEL_TEMPLATES, RESULTS_PLACEHOLDER, CAPTION_LINE_MAX, WORDS_PER_SECOND, parseReel, timeBeats, checkResultsBeat, findAttributedQuotes, formatReelScript"
  - phase: 09-12
    provides: "STUDIO_DRAFT_FEATURES.reel = 'studio-reel' (hub draft count)"
  - phase: 09-13
    provides: "numberPostCheck('reel', reelAllowedNumbers(beats)), numberWordsPostCheck(); render-as-renderXUser + build() pattern"
  - phase: 09-19
    provides: "fence guard pattern (agent text cannot close its own fence)"
provides:
  - "ai/prompts/studio/reel.v1.ts: studioReelV1 (id 'studio/reel.v1', feature 'studio-reel'), ReelInputs, REEL_LENGTHS, STUDIO_REEL_SYSTEM, renderReelUser, sampleReel, captionFrom, HOOK_FALLBACK, SAMPLE_BROLL"
  - "registry.ts registers studio/reel.v1"
  - "features/studio/reel/checklist.ts: REEL_CHECKLIST (8 items), REEL_CHECKLIST_FOOTNOTE"
  - "features/studio/reel/reel-checks.ts: resultsBeatPostCheck(resultsEmpty), quotePostCheck(), REEL_CHECKERS, RESULTS_BEAT_CATEGORY/EXPLANATION, QUOTE_CATEGORY/EXPLANATION"
  - "features/studio/reel/reel-export.ts: reelFooter(disclosure) -> emailFooter.text, formatReelForExit(draft, footerText, length) -> formatForExit, CAPTION_HEADING, CHECKLIST_HEADING"
affects: [09-22, 09-23]
tech-stack:
  added: []
  patterns:
    - "Each beat field is fenced in its own tag named after its beat key; the guard strips all six tag names from agent text so no field can close or open a fence"
    - "The model gets per-block word ceilings derived from the code-owned slots (never a time); times stay in REEL_TEMPLATES"
    - "Sample captions are the first clause of the agent's own text, cut at a word boundary to 42 characters; trailing words are dropped while the cut would leave a number the agent did not type"
key-files:
  created:
    - apps/web/src/lib/ai/prompts/studio/reel.v1.ts
    - apps/web/src/lib/ai/prompts/studio/reel.v1.test.ts
    - apps/web/src/lib/features/studio/reel/checklist.ts
    - apps/web/src/lib/features/studio/reel/reel-checks.ts
    - apps/web/src/lib/features/studio/reel/reel-checks.test.ts
    - apps/web/src/lib/features/studio/reel/reel-export.ts
  modified:
    - apps/web/src/lib/ai/prompts/registry.ts
key-decisions:
  - "09-21: maxTokens 2048, not the plan's 900 (shipped PromptDef contract: at least 2048 because thinking tokens count; same call as 09-13/09-19)"
  - "09-21: render is the exported renderReelUser and build() returns { system, user, known: [] }; build validates length and the four required beats and throws listing the failing keys"
  - "09-21: resultsBeatPostCheck reports the digit runs when there are any, and the whole RESULTS beat only when there are no digits but the placeholder is missing, so a planted '47' is one mark over '47' (not swallowed by a whole-beat merge)"
  - "09-21: checker ids 'results-beat' (block) and 'quotes' (warn), alongside 13's 'numbers' and 'number-words', for the reel panel's checkGroups"
  - "09-21: the checklist's section sign is built with String.fromCharCode(0xa7) to keep .ts sources ASCII-only (briefing rule); the test asserts the rendered item contains 'General Business Law \\u00a7 396-b'"
  - "09-21: reelFooter puts a blank line between the last '[ ]' line and the footnote; an unparseable draft with an empty footer copies as the trimmed draft alone"
  - "09-21: the prompt feature id is exactly 'studio-reel' and the test asserts it equals StudioHub's STUDIO_DRAFT_FEATURES.reel"
requirements-completed: []  # STU-03 advanced; ids are closed by the 09-23 phase gate
duration: ~13 min
completed: 2026-10-07
---

# Phase 9 Plan 21: Reel script engine (prompt, checks, checklist, copy formatter) Summary

**`studio/reel.v1` is registered under the hub's `studio-reel` feature id. It receives only the agent's six beat fields (each fenced) and the length. It must write six labelled blocks with Voiceover, Caption and B-roll lines, and it never writes times, client quotes or numbers the agent didn't type. With results empty it must write the exact `[Add a real result you can document]` placeholder, and `resultsBeatPostCheck` blocks any digits or a missing placeholder. The 8-item AI-disclosure checklist (including the NY GBL 396-b line) and the caption disclosure are appended to the copied, timecoded script through `reelFooter` and `formatReelForExit`. The keyless sample has zero findings on every check, with and without results.**

## Performance

- **Duration:** about 13 min (14:58Z to 15:11Z)
- **Tasks:** 2 of 2
- **Files:** 6 created, 1 modified

## Accomplishments

- **checklist.ts.** The 8 UI-SPEC items in order and the footnote are copied verbatim. They contain none of "testimonial", "guarantee", "compliant" or "approved". The banned-terms gate scans them (378 files).
- **reel-checks.ts.** `resultsBeatPostCheck(resultsEmpty)` wraps core `checkResultsBeat` as block findings with the copy 'Result you didn't provide' / "You left Your results blank, so this beat must keep the placeholder [Add a real result you can document] and no numbers." It is off when results were typed, and `numberPostCheck('reel', ...)` covers that case with 'Number you didn't provide'. `quotePostCheck()` wraps `findAttributedQuotes` as warn findings, 'Quote to confirm', with the UI-SPEC explanation.
- **reel-export.ts.** `reelFooter('DISC')` is `ADD TO YOUR POST CAPTION\nDISC\n\nBEFORE YOU POST THIS VIDEO\n`, then the 8 `[ ] item` lines, then a blank line and the footnote. `formatReelForExit(draft, footerText, length)` parses the draft, times the beats from `REEL_TEMPLATES` and calls `formatReelScript`. Output starts with `REEL SCRIPT (30 seconds)`, holds `0:00 to 0:03 HOOK` and `B-ROLL SHOT LIST`, and ends with footerText. When the draft won't parse, the result is the raw draft, a blank line and the footer. A planted "0:00 to 0:09" in the model text changes no time.
- **reel.v1.ts.** The seven required system lines are verbatim. Further system lines set the label-line format, first-person voiceover, captions of 42 characters or fewer, neutral B-roll, no disclosure or hashtags, and plain text. The user message holds the fenced fields, `Reel length: N seconds.` and per-block word ceilings (for example HOOK 7, from 3 s x 2.5 words per second). When the hook is empty, a line asks for a hook written from the story. When results are empty, the exact placeholder line appears and no `<results>` tag is sent. Extra input keys (client name, neighborhood) never reach the prompt. `sampleReel` builds six blocks: the agent's own text as the Voiceover (or the hook fallback "Here's why I changed how I work."), a first-clause Caption, and the plan's six fixed B-roll shots.

## Task Commits

1. **Task 1: Checklist, reel post-checks, copy formatter**: `8aa70b9` (feat)
2. **Task 2: studio/reel.v1 prompt with sample()**: `90324b8` (feat)

Both were committed with `git commit -- <explicit paths>` after `git diff --cached --name-only`. The concurrent 09-20 commit `b6f25c0` sits between them and touches none of these files.

## Verification

Every Node command ran through the single-core wrapper on mask 0x200. No build or Playwright run (09-20 owned them).

- `vitest --project web reel-checks`: 17/17.
- `vitest --project web reel`: 2 files, 35/35. That includes 18 reel.v1 tests. Five sample fixtures (30 s and 60 s, with and without results, no hook, typed numbers in the story) each give zero findings from `checkFairHousing`, `numberPostCheck('reel', reelAllowedNumbers(beats))`, `numberWordsPostCheck()`, `resultsBeatPostCheck(resultsEmpty)`, `quotePostCheck()`, `findUnsupportedFeatures` (backed only by the agent's beat text), and the panel's `runChecks` set. They also produce no caption lines over 42 characters.
- `vitest --project web apps/web/src/lib/ai apps/web/src/lib/features/studio`: 45 files, **803/803**. This covers the registry and the fixture provider.
- Full `vitest --project web`: 159 files, **2388/2388**.
- `pnpm check`: 0 errors, 0 warnings (2605 files). `pnpm lint` (repo-wide prettier --check + eslint): clean. `pnpm banned`: passed (378 files).
- **Mutation proof (plan, not committed):** I made `sampleReel` write 'Helped 12 clients.' as the RESULTS voiceover when results are empty. Three tests failed: both no-results zero-findings fixtures and the placeholder test. The file was restored from a scratch copy, and `grep -c "Helped 12 clients"` returns 0. A committed test also plants that line and asserts block findings from both the results-beat check and the number check, and plants "My clients say I answer fast." and asserts one quote finding.
- ASCII check: all 6 new .ts files contain 0 non-ASCII bytes.
- Acceptance greps match: `Do not write times or durations.`, `Do not write quotes from clients or anyone else.`, `RESULTS_PLACEHOLDER` and `export function sampleReel` in reel.v1.ts; `studio/reel` in registry.ts; `'Answered every inquiry within an hour last spring.'` (as the RESULTS const) in the test; `"Result you didn't provide"` and `'Quote to confirm'` in reel-checks.ts; `ADD TO YOUR POST CAPTION` and `BEFORE YOU POST THIS VIDEO` in reel-export.ts; `This checklist is a reminder, not legal advice.` in checklist.ts. The literal `§` grep is the one exception (deviation 3).
- GenerationPanel and PanelState were not touched, so the browser tests were not needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Contract] maxTokens 2048 instead of 900**
- The shipped PromptDef contract requires at least 2048, and the test asserts `>= 2048`. This is the same call 09-13 and 09-19 made.

**2. [Rule 3 - Contract] `render` mapped onto `build()`**
- The plan's `render(input)` is the exported `renderReelUser`, and `build()` returns `{ system, user, known: [] }`, following the 09-13 pattern.

**3. [Briefing rule] Section sign built from its code point**
- The acceptance grep asks for a literal `General Business Law § 396-b` in checklist.ts. The executor briefing requires ASCII-only .ts sources, so the item uses `${String.fromCharCode(0xa7)}`. The rendered string is exactly the UI-SPEC text, and the test asserts it. A literal grep for `§` in checklist.ts will not match. `grep "General Business Law"` does match.

**4. [Rule 2 - Correctness] Fence guard and caption number guard**
- Agent text has all six beat tag names stripped, so it can't close or open a fence. This follows the 09-19 guard, and a test covers it.
- `captionFrom` drops trailing words while the cut would leave a number the agent didn't type. Without this, "$1.2 million" cut to "$1.2" would be a 'Number you didn't provide' finding on the keyless sample. A test covers it.

**5. Results-beat finding shape (interpretation)**
- Core `checkResultsBeat` returns both the whole-beat placeholder-missing range and each digit run, and `mergeFindings` would fuse them into one whole-beat mark. To meet "one block finding over '47'", the check reports only the digit runs when any exist. Once the digits are removed, the missing placeholder is still a block finding over the beat.

**6. TDD order**
- In both tasks the tests and the implementation were committed together, one feat commit per task as the plan's commit messages specify. The mutation proof shows the zero-findings tests catch an invented result.

**Total deviations:** 6 (2 contract, 1 briefing rule, 1 correctness, 2 documentation). No scope creep, and no file outside files_modified was touched.

## Issues Encountered

None. The 09-20 executor's untracked `features/studio/social/` files were never staged.

## Requirements

STU-03 moves forward with this plan, but I did not run `requirements mark-complete`. The 09-23 phase gate closes the requirement ids, as the briefing directs.

## Known Stubs

None. The engine is fully wired and registered. The reel route, the beat form, the script view and the checklist component belong to 09-22.

## Notes for 09-22

- `postChecks: [numberPostCheck('reel', reelAllowedNumbers(beats)), resultsBeatPostCheck(!beats.results?.trim()), numberWordsPostCheck(), quotePostCheck()]`. Here `reelAllowedNumbers` takes a `Record<string, string>` of the beat fields.
- `emailFooter: { text: reelFooter(adInlineDisclosure), label: 'Added to the end of the copied script' }`, `formatForExit: (d, f) => formatReelForExit(d, f, length)`.
- The `inputs` shape is `ReelInputs` from `$lib/ai/prompts/studio/reel.v1` (`{ length, hook?, pain, beforeAfter, results?, mission, cta }`). Its `build()` throws on empty required beats, and `preview()` already tolerates that.
- The checker ids for checkGroups are `REEL_CHECKERS.resultsBeat` ('results-beat') and `REEL_CHECKERS.quotes` ('quotes').

## Self-Check: PASSED

All 6 created files and the modified registry exist, and commits 8aa70b9 and 90324b8 are in the log.
