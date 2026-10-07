---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 19
subsystem: studio-social-engine
tags: [studio, social, prompts, generation-panel, sections-mode, platform-card, disclosure, fair-housing, tdd]
requires:
  - phase: 05
    provides: "GenerationPanel + PanelState (emailFooter, exitDisabled, postChecks, onExit, checkGroups), exits.ts copyText, FairHousingText, FindingsSummary (ack checkbox), runChecks/warnSignature/blockReason/WARN_REASON"
  - phase: 09-08
    provides: "formatForExit and the shipped prop names (emailFooter { text, label }, exitDisabled); no footer/footerLabel/gate prop"
  - phase: 09-10
    provides: "@tran/core/studio: PLATFORMS, PLATFORM_LIMITS, HASHTAG_CAPS, PLATFORM_LABELS, postBudget, assemblePost, parseSocialPack, splitTrailingHashtags, buildHashtagCandidates"
  - phase: 09-13
    provides: "numberPostCheck('social', briefAllowedNumbers(brief, link)), numberWordsPostCheck(); PromptDef build()/sample() contract with maxTokens >= 2048"
  - phase: 09-15
    provides: "PanelState.preview() tolerates a refused prompt build (kept unchanged)"
provides:
  - "ai/prompts/studio/social.v1.ts: studioSocialV1 (id 'studio/social.v1', feature 'studio-social'), SocialPackInputs, SocialTone, SOCIAL_POST_TYPES, SOCIAL_TONES, SOCIAL_MARKER_LINES, STUDIO_SOCIAL_SYSTEM, renderSocialUser, socialHashtagCandidates, socialBudgets, sampleSocialPack"
  - "registry.ts registers studio/social.v1"
  - "ai/ui/PlatformCard.svelte (module exports): SectionSpec, SectionKey, SectionState, SectionAssembly, cardGate, cardPayload, countLine, droppedLine, cardSentence, packAnnouncement, parseErrorTitle, PARSE_ERROR_BODY, CARD_EMPTY_LINE, COPY_FAILED"
  - "GenerationPanel `sections?: SectionSpec[]` prop (module export `type SectionSpec`)"
affects: [09-20, 09-23]
tech-stack:
  added: []
  patterns:
    - "Per-card state (edit override, debounced recheck, warn acknowledgement by warn signature) lives in PlatformCard; the pack text and the run stay in PanelState"
    - "Card copy payload is always spec.assemble(text).text, so disclosure-last is a property of the host's assemble, tested over 300 seeded random sections"
key-files:
  created:
    - apps/web/src/lib/ai/prompts/studio/social.v1.ts
    - apps/web/src/lib/ai/prompts/studio/social.v1.test.ts
    - apps/web/src/lib/ai/ui/PlatformCard.svelte
    - apps/web/src/lib/ai/ui/GenerationPanel.sections.test.ts
    - apps/web/src/lib/ai/ui/PlatformCard.browser.test.ts
  modified:
    - apps/web/src/lib/ai/prompts/registry.ts
    - apps/web/src/lib/ai/ui/GenerationPanel.svelte
key-decisions:
  - "09-19: maxTokens 2048, not the plan's 1200 (shipped PromptDef contract: at least 2048 because thinking tokens count; same call as 09-13)"
  - "09-19: build() validates postType, tone and a non-empty brief and throws; preview() already tolerates the refusal (09-15). The disclosure is input only for the budgets and never appears in the prompt text (asserted)"
  - "09-19: the agent brief is fenced in <brief> and stripped of <brief>/</brief> tags so it cannot close its own fence"
  - "09-19: SectionSpec and cardGate live in PlatformCard's module script (the plan's file list); GenerationPanel re-exports `type SectionSpec` from its own module script for hosts"
  - "09-19: hashtag cap reason gates only an agent edit (override present); tags the model over-supplied are dropped by assemble and reported on the dropped-hashtags line"
  - "09-19: an Edit post Done with the text unchanged returns the card to the generated text (no override)"
  - "09-19: pack announcement = 'Post pack ready. {Platform}: {s}.' for the cards that came through, then 'The {Platform} post didn't come through.' once per missing card, as ONE announcement replacing Phase 5's 'Draft ready.' (only after a clean done run)"
  - "09-19: cards are keyed on the panel's artifactId and reset their edits when a new stream starts, so a new run or a Draft history open never keeps a stale edit"
  - "09-19: in sections mode the panel is full width (cards row 1 column, 3 columns from xl = 1280px, 24px gap); the panel-level Edit draft, findings summary, email footer preview, long-mailto note and three-exit group are not rendered"
requirements-completed: []  # STU-02 advanced; ids are closed by the 09-23 phase gate
duration: ~95 min wall clock (13:19Z to 14:54Z, single core 0x100, including a ~10 min stalled stream)
completed: 2026-10-07
---

# Phase 9 Plan 19: Social post pack engine (prompt + GenerationPanel sections mode) Summary

**`studio/social.v1` is registered. Its per-platform budgets are computed in code from the limit minus the disclosure and hashtag block, its hashtag candidates come only from the place, property type and generic tags, and its keyless sample has zero findings on all three cards. GenerationPanel gains an additive `sections` mode that renders one PlatformCard per platform, each with its own checks, count line, read-only disclosure block, Edit post, findings and exactly one gated "Copy {Platform} post" exit through exits.ts. Default mode is unchanged.**

## Performance

- **Duration:** about 95 min wall clock (13:19Z to 14:54Z). The orchestrator reported one ~10 minute stalled stream after Task 1 was committed.
- **Tasks:** 2 of 2
- **Files:** 5 created, 2 modified

## Accomplishments

- **social.v1.** The system prompt states the facts-only rules, the hashtag rules (Instagram only in INSTAGRAM HASHTAGS, at most 5; Facebook at most 2 and LinkedIn at most 3 on a final line; only candidates), the link rule (Facebook/LinkedIn carry it, Instagram says "Link in bio.") and the exact four marker lines. The user message is the fenced brief, post type, tone, place, link, candidates and "at most {postBudget(...)} characters" per platform. `sampleSocialPack` follows the plan's templates verbatim (headline per post type, omitted city clause, first 5/2/3 candidates).
- **PlatformCard.** Each card is an `<article aria-labelledby>` with an h3 and the constraint line. Its output box (`aria-label="{Platform} post"`) runs FairHousingText over the section text, and the checks are Fair Housing plus `spec.postChecks`, never the disclosure. Other parts of the card:
  - The `emailFooter` block shows its label and text.
  - The count line follows the UI-SPEC: Facebook names its 63,206 limit, and an over-limit post adds the over sentence. A dropped-hashtags line appears when needed.
  - **Edit post** / **Done editing** open a textarea labelled "Edit your {Platform} post". The recheck is debounced 300 ms and applying an alternative edits the card.
  - FindingsSummary has h4 titles and the ack checkbox, bound by warn signature.
  - The exits group (`data-testid="exits-{key}"`, "Use the {Platform} post") holds one Copy button. Copy goes through `copyText(spec.assemble(text).text)`, sets "Copied." and announces "{Platform} post copied.".
  - Gated Copy uses `aria-disabled` and a `tabindex="-1"` reason line linked by aria-describedby, and focus moves to that line. The gate order is: Must fix, unacknowledged Review, over the limit, hashtags over the cap after an edit, then `exitDisabled.copy`.
  - A section missing after the stream shows the parse-error title and body (neutral surface with a SearchX icon), and its Copy is gated.
- **GenerationPanel sections mode.** The panel keeps the header, sample notice, "What will be sent" (plus "Your disclosure is added in this browser after the draft is written. It isn't sent to {Provider}."), the run control, status, usage and error. While streaming, the card being written gets aria-busy and the caret. On the first card copy, the pack's Draft history row becomes Reviewed (`setStatus('acknowledged')`), then `onExit('copy', { text, artifactId })` is called.

## Task Commits

1. **Task 1: studio/social.v1 prompt with budgets and sample()**: `b311c08` (feat)
2. **Task 2: GenerationPanel sections mode and PlatformCard**: `5fb20b1` (feat)

Both commits used `git commit -- <explicit paths>` after `git diff --cached --name-only`.

## Verification

Every Node command ran through the single-core wrapper on mask 0x100.

- `vitest --project web src/lib/ai/prompts`: 6 files, 67 passed. That includes 10 new social.v1 tests: zero findings from Fair Housing, the social number check and number words on all three sample cards and every hashtag; 6 fixtures clean with tags from the candidates; a 2,000-character brief gives Instagram `over > 0`; the disclosure is not in the prompt.
- `vitest --project web apps/web/src/lib/ai`: 31 files, **612 passed**.
- Full `vitest --project web`: 155 files, **2330 passed**.
- `vitest --project web-browser PlatformCard.browser GenerationPanel.browser`: 3 passed. The new browser test checks these behaviors:
  - The stream fills three cards and the pack announcement fires.
  - Copy LinkedIn writes exactly the assembled post ending in `\n\n{disclosure}`, keeps focus on the button, announces, and calls onExit.
  - Editing Facebook to 5 tags gates Copy with "Facebook uses up to 2 hashtags. Remove 3 to copy this post.", and a gated Enter moves focus to the reason line.
  - Instagram is unaffected, and axe finds zero violations.
- `pnpm check`: 0 errors, 0 warnings (2593 files). `pnpm lint` (repo-wide prettier --check + eslint): clean. `pnpm banned`: passed (371 files). `pnpm guard --all`: passed (1562 files).
- `build:root`: passed. Playwright on root, `--workers=1`: `studio-listing` and `agent-followup` **16 passed** (2.0 min), and `snapshot-builder` **5 passed** (34 s). These are the specs whose pages use the panel. No `test.slow()` was needed.
- Acceptance greps:
  - No `footerLabel|gate?:` in GenerationPanel or PlatformCard.
  - `navigator.clipboard` appears under lib/ai/ui only in the Phase 5 test's banned-list literal. The new sections test asserts the PlatformCard source has none.
  - `git diff` shows GenerationPanel.test.ts and panel-state.svelte.ts unchanged, so the 09-15 preview() fix and its test are untouched and green.
  - PlatformCard contains `exits-`, `Use the`, `Added to the end of this post`, `Edit your`, `didn't come through`, `emailFooter` and `copyText`.
- `apps/web/test-results` and a failure screenshot from an intermediate browser run were deleted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Contract] maxTokens 2048 instead of 1200**
- The shipped PromptDef contract requires at least 2048. 09-13 made the same change. The test asserts `>= 2048`.

**2. [Rule 3 - Contract] `render` mapped onto `build()`**
- The plan's `render()` is the exported `renderSocialUser`, and `build()` returns `{ system, user, known: [] }`. This follows the 09-13 pattern.

**3. [Rule 2 - Correctness] Brief fence hardening**
- `<brief>` / `</brief>` inside the agent's text are stripped, so the brief cannot close its fence. A test covers it.

**4. [Rule 2 - Testing] Added PlatformCard.browser.test.ts (outside files_modified)**
- SSR cannot click, so I added one real-browser test of copy, edit, gating and focus. It is a new file, and no other plan lists it.

**5. [Rule 1 - Bug, during Task 2] eslint no-import-assign on the SectionSpec re-export**
- `export type { SectionSpec } from` in the module script clashed with the instance import. It is now `import type { SectionSpec as PlatformSectionSpec }` plus `export type SectionSpec = PlatformSectionSpec`.

### Interpretations

- The pure gate helper and SectionSpec live in PlatformCard's `<script module>`, because no separate .ts file is in files_modified. Hosts can import `type SectionSpec` from either GenerationPanel.svelte or PlatformCard.svelte.
- The card empty line is shown in every card before the first run. While streaming, cards that have not started are blank.
- A card in state `empty` after the stream ends (pack text present) is treated like `error`, so a missing section never shows a silent empty card.
- In the pack announcement, a missing card is announced with the exact parse-error sentence in place of a status word. This avoids saying it twice, because announcer messages replace each other.

## Deferred Issues

- **Draft history "Copied: {platforms}" row extra (UI-SPEC Artifact paragraph).** This needs an artifact meta update (ArtifactRepo has no updateMeta) and a DraftHistory row slot. Both are shared Phase 5 files outside this plan. Already done: the pack row is stored once per run (the full pack text holds all three sections), it becomes Reviewed on the first card copy, and Mark as sent is not offered. 09-20 or 09-23 should decide whether to add `updateMeta` + a DraftHistory meta line.
- The card edit is not written back into the stored pack artifact. SectionSpec has no serializer, so Draft history reopens the generated pack.

## Requirements

STU-02 moves forward with this plan, but I did not run `requirements mark-complete`. The 09-23 phase gate closes the requirement ids, as the briefing directs.

## Known Stubs

None. The engine is fully wired. The social route itself (brief form, `buildSocialSections`, page) is 09-20's scope.

## Notes for 09-20

- Build each SectionSpec the way `spec()` does in GenerationPanel.sections.test.ts:
  - `extract` uses `parseSocialPack(text, { streaming })` and returns 'streaming' for `pack.active`, 'empty' while not yet started, and 'error' after the stream.
  - `assemble` uses `splitTrailingHashtags` then `assemblePost`, plus `tagsOverCap = max(0, tags - HASHTAG_CAPS[key])`.
- Pass `inputs` as SocialPackInputs with `disclosure` set to the ad-inline disclosure text. Pass `exitDisabled={{ copy: reason }}` for the profile gate.

## Self-Check: PASSED
