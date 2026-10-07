---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 13
subsystem: studio-prompts
tags: [studio, prompts, post-checks, numbers, fair-housing, fixture-provider, tdd]
requires:
  - phase: 05
    provides: "prompt registry (registerPrompt/getPrompt/buildPrompt + property-not-people guardrail), PostCheck, Finding/FindingMember, mergeFindings, runChecks/computeGate"
  - phase: 07
    provides: "createPostCheck factory (07-04), memo number post-check as the reference shape, PromptDef.sample -> BuiltPrompt.fixtureText, @tran/core/format, @tran/core/numbers checkNumbers"
  - phase: 09-04
    provides: "Phase 9 advertising lexicon entries the samples must stay clean against"
  - phase: 09-08
    provides: "proof that PromptDef.sample drives keyless Fixture output"
  - phase: 09-10
    provides: "@tran/core/studio barrel (validateListingFacts, pickListingFacts, listingFreeText, LENGTH_WORDS, findUnsupportedFeatures, allowedSet, factsForPrompt, snapshotFigureValues, snapshotFactLines, snapshotAllowedNumbers)"
provides:
  - "features/studio/post-checks.ts: NUMBER_CATEGORIES, numberPostCheck(kind, allowed), numberWordsPostCheck(), unsupportedFeaturePostCheck(facts), listingAllowedNumbers, briefAllowedNumbers, reelAllowedNumbers, STUDIO_CHECKERS, NUMBER_WORD_CATEGORY/EXPLANATION, UNSUPPORTED_FEATURE_CATEGORY, unsupportedFeatureExplanation"
  - "ai/prompts/studio/listing.v1.ts: studioListingV1 (id 'studio/listing.v1', fixture key studio/listing.v1@1), STUDIO_LISTING_SYSTEM, renderListingUser, sampleListing"
  - "ai/prompts/studio/snapshot.v1.ts: studioSnapshotV1 (id 'studio/snapshot.v1'), SnapshotNotesInputs { metrics, sample, asOf }, STUDIO_SNAPSHOT_SYSTEM, renderSnapshotUser, sampleSnapshotNotes"
  - "Both prompts registered in registry.ts"
affects: [09-14, 09-15, 09-16, 09-17, 09-19, 09-20, 09-23]
tech-stack:
  added: []
  patterns:
    - "Studio post-checks are thin adapters over @tran/core matchers, built with Phase 7's createPostCheck (number checks) or mergeFindings directly when the explanation varies per hit (unsupported features)"
    - "Keyless sample = deterministic template over the same validated inputs, proven zero-findings by running Fair Housing + every post-check over it per fixture"
key-files:
  created:
    - apps/web/src/lib/features/studio/post-checks.ts
    - apps/web/src/lib/features/studio/post-checks.test.ts
    - apps/web/src/lib/ai/prompts/studio/listing.v1.ts
    - apps/web/src/lib/ai/prompts/studio/listing.v1.test.ts
    - apps/web/src/lib/ai/prompts/studio/snapshot.v1.ts
    - apps/web/src/lib/ai/prompts/studio/snapshot.v1.test.ts
  modified:
    - apps/web/src/lib/ai/prompts/registry.ts
key-decisions:
  - "09-13: maxTokens is 2048 for both studio prompts, not the plan's 700/600: the shipped PromptDef contract says 'At least 2048: thinking tokens count against it on some providers' (renter outreach asserts it); 700 would truncate drafts on thinking models"
  - "09-13: the PromptDef shape is build() -> { system, user, known }, not render(); the plan's render is exported as renderListingUser / renderSnapshotUser and build() calls it. Listing build validates with validateListingFacts(input, new Date()) and throws, listing the failing keys, so buildPrompt rejects off-whitelist input such as 'schools'"
  - "09-13: numberPostCheck drops checkNumbers' spelled-out warn hits so a number word is reported once, by numberWordsPostCheck (category 'Number written as a word')"
  - "09-13: checker ids are 'numbers' (block), 'number-words' (warn) and 'unsupported-features' (warn) so a tool's checkGroups can group or split them; categoryLabel carries the UI-SPEC category"
  - "09-13: unsupportedFeaturePostCheck treats garageSpaces > 0 as the Garage chip, so 'a 2-car garage' built from typed garage spaces is not a Review finding"
  - "09-13: the Phase 5 Finding shape has no per-finding action labels, so the UI-SPEC 'Edit it myself' / 'Show in draft' buttons for unsupported features are a tool-UI concern (alternative is '' and the group copy's allowRemovePhrase decides the Remove phrase action)"
  - "09-13: no FIXTURE_OUTPUTS entries were added: PromptDef.sample supplies fixtureText for both prompts, and the Fixture provider streams it in preference to the canned map"
patterns-established:
  - "Studio prompt modules live in lib/ai/prompts/studio and register in registry.ts with '.v1' ids (like investor/memo.v1)"
requirements-completed: []  # STU-01/STU-04 advanced; ids are closed by the 09-23 phase gate
duration: ~12 min
completed: 2026-10-07
---

# Phase 9 Plan 13: Studio listing and market-notes prompts plus post-checks Summary

**Two facts-only prompts (`studio/listing.v1`, `studio/snapshot.v1`) are now registered. Each builds its keyless Fixture text from the agent's own inputs, and that text passes Fair Housing and every studio check with zero findings. The new studio post-check factories block invented numbers using per-tool category labels, and they flag number words and listing features the facts don't back for review.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-10-07T10:55Z
- **Completed:** 2026-10-07T11:08Z
- **Tasks:** 2 of 2
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments

- **post-checks.ts.** `numberPostCheck(kind, allowed)` delegates matching to `@tran/core/numbers` `checkNumbers` and returns Phase 5 block findings. The four UI-SPEC labels and explanations are copied verbatim: 'Number not in your facts', 'Number not in your brief', "Number you didn't provide" and 'Number not in this report'. Findings never carry a replacement number. `numberWordsPostCheck()` (findNumberWords) returns warn findings, 'Number written as a word'. `unsupportedFeaturePostCheck(facts)` (findUnsupportedFeatures over chips + listingFreeText) returns warn findings, 'Not in your facts', with the per-feature explanation `This mentions "fireplace", ...`. The allowed sets are `listingAllowedNumbers` (typed numbers plus numbers in free text), `briefAllowedNumbers` and `reelAllowedNumbers`. The module does not import features/investor.
- **studio/listing.v1.** The plan's seven system lines are verbatim, and the registry prepends the guardrail. The user message is `<facts>` with the JSON of `pickListingFacts` (no tone, length or siteCharLimit), then `Tone: warm. Length: about 150 words.`. Validation runs first. `sampleListing` has warm, concise and luxury templates with type phrases, article-aware feature phrases, garage spaces as "a 2-car garage", "Nearby: …" plus nearbyPlaces verbatim, "Built in {year}.", and "Offered at $X." / "Available for $X a month.". A studio (0 bedrooms) reads "studio".
- **studio/snapshot.v1.** The required lines are verbatim: copied numbers, 2-3 paragraphs, no predictions or advice, digits only. The user message is `<facts>\n${factsForPrompt(...)}\n</facts>`. `sampleSnapshotNotes` writes renters, buyers and sellers paragraphs, plus the listings-summary sentence. Every figure comes from `snapshotFigureValues` and `monthYear`, the report's own formatters, and any sentence whose figure is missing is skipped.

## Task Commits

1. **Task 1: studio number, number-word and unsupported-feature post-checks**: `83bf697` (feat)
2. **Task 2: listing and market-notes prompts with input-built samples**: `fd18ba2` (feat)

**Plan metadata:** the docs(09-13) commit that follows.

## Verification

Every Node command ran through the single-core wrapper on mask 0x200.

- `vitest --project web src/lib/features/studio/post-checks`: 12/12.
- `vitest --project web src/lib/ai/prompts/studio`: 21/21. The listing tests cover 6 fixtures (every tone x short/long, with and without price, with and without the optional numbers) at zero findings each from checkFairHousing, the number check, number words and unsupported features, plus `runChecks`. The snapshot tests cover 3 fixtures (full, missing rentalData, with a listings sample and a negative rent change) at zero findings. A planted '$2,450' gets one block finding, 'Number not in this report', and every factsForPrompt line used as a sentence passes. The 'schools' key is refused by render and by buildPrompt.
- `vitest --project web src/lib/ai src/lib/features/studio src/lib/features/investor/memo src/lib/features/agent/followup`: 34 files, **641/641**. This includes the Phase 5 registry tests and the fixture Fair Housing lint (FIXTURE_OUTPUTS).
- **Mutation check (not committed):** making `sampleListing` append ' Over 2,000 square feet.' failed 9 of the 12 listing tests, including all 6 zero-findings fixtures. The file was then restored, and `grep -c "Over 2,000"` returns 0.
- `pnpm check`: 0 errors, 0 warnings (2548 files). `pnpm lint` (repo-wide Prettier + eslint) is clean. `pnpm banned` passed (347 files).
- Acceptance greps all match: the six category strings in post-checks.ts, the `@tran/core/numbers` and `@tran/core/studio` imports, no `features/investor` import, the system lines, `studio/listing` and `studio/snapshot` in registry.ts, `'$2,450'` and `'schools'` in the tests, and `export function sampleListing`.
- I did not run the full `vitest run --project web` suite. The executor briefing asks for targeted runs because memory is shared. Every suite that imports the changed modules (registry, prompts, fixture provider, the panel controller and the memo/followup prompt users) was run and passed.

## Decisions Made

The frontmatter key-decisions list every choice. The ones that matter most: maxTokens is 2048 (the Phase 5 contract) instead of 700/600; render is the exported `renderListingUser`/`renderSnapshotUser`, and `build()` calls it; number words are reported only once; garage spaces count as the Garage chip; and no FIXTURE_OUTPUTS edit was needed because `sample()` supplies fixtureText.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] maxTokens 2048 instead of 700 / 600**
- **Found during:** Task 2
- **Issue:** The `PromptDef.maxTokens` doc in the shipped Phase 5 types requires at least 2048, because thinking tokens count against the cap on some providers, and the renter outreach test asserts it. A cap of 700 or 600 would cut drafts short on those models.
- **Fix:** Both prompts use 2048, and the tests assert `>= 2048`.
- **Commit:** `fd18ba2`

**2. [Rule 3 - Blocking] `render` mapped onto the shipped `build()` contract**
- **Issue:** The plan describes `{ system, render(input), maxTokens, sample }`, but the shipped PromptDef is `{ id, version, feature, housingCopy, containsClientData, maxTokens, build(inputs) -> { system, user, known }, sample? }`.
- **Fix:** I exported `renderListingUser` and `renderSnapshotUser` as the render step, and `build()` returns `{ system, user: render(i), known: [] }`. Neither prompt declares PII (no client data).

**3. [Rule 2 - Correctness] Garage spaces back the garage feature**
- **Issue:** A typed garageSpaces value with no Garage chip would make "a 2-car garage" a 'Not in your facts' finding, even though the agent entered it.
- **Fix:** `unsupportedFeaturePostCheck` adds Garage to the supported chips when garageSpaces > 0. A test covers both directions.

**4. Unsupported-feature action labels (documentation)**
- The Phase 5 Finding shape has no per-finding action labels, so the UI-SPEC buttons "Edit it myself" and "Show in draft" are left to the listing tool UI (09-14 and later). `alternative` is '', and the group copy's `allowRemovePhrase` controls Remove phrase.

**5. TDD order**
- In both tasks the tests and the implementation were committed together, one feat commit per task as the plan's commit messages specify, rather than as separate RED and GREEN commits. The mutation check above shows the zero-findings tests catch a regression.

**Total deviations:** 5 (1 bug, 1 blocking, 1 correctness, 2 documentation). **Impact:** there was no scope creep, and none of the deviations touches another plan's files.

## Issues Encountered

None. Files from the concurrent 09-11 run (storage/db, backup-registry) showed up in `git diff` but were never staged or committed here. Every commit used an explicit pathspec.

## Requirements

STU-01 and STU-04 move forward with this plan, but I did not run `requirements mark-complete`. The 09-23 phase gate closes the requirement ids, as the executor briefing directs.

## Known Stubs

None. Both samples are built only from their inputs, and the prompts are wired into the registry. The tool UIs that consume them come in later plans.

## Next Phase Readiness

Studio tool UIs can now call `getPrompt('studio/listing.v1')` or `getPrompt('studio/snapshot.v1')` through GenerationPanel. They attach `[numberPostCheck(kind, allowed), numberWordsPostCheck(), unsupportedFeaturePostCheck(facts)]` as `postChecks`, and their keyless output passes those checks.

## Self-Check: PASSED

All 6 created files exist; commits 83bf697 and fd18ba2 are in the log.
