---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 20
subsystem: studio-ui/social
tags: [studio, social, generation-panel, sections-mode, platform-card, disclosure, fair-housing, autosave, e2e, axe]
requires:
  - phase: 05
    provides: "GenerationPanel, DraftHistory, ArtifactRepo, Fixture provider, Phase 5 E2E AI mocks (routeAnthropic, saveKey)"
  - phase: 08
    provides: "NativeSelect, SampleChip, ConfirmDialog, SAMPLE_AGENT_PROFILE, the profile page"
  - phase: 09-12
    provides: "DisclosureStatus, InputFairHousingNote; hub counts drafts by feature (STUDIO_DRAFT_FEATURES.social = 'studio-social')"
  - phase: 09-13
    provides: "numberPostCheck('social', briefAllowedNumbers(brief, link)), numberWordsPostCheck, STUDIO_CHECKERS"
  - phase: 09-15
    provides: "the studio page pattern (lead, DisclosureStatus, action row, form, panel, Draft history, autosave, sample detection)"
  - phase: 09-19
    provides: "studio/social.v1, GenerationPanel `sections` mode, PlatformCard (SectionSpec, cardGate), the reference spec builder"
provides:
  - "features/studio/social/social-sections-spec.ts: buildSocialSections(profileDisclosure, brief, link) -> SectionSpec[] (instagram, facebook, linkedin), SOCIAL_CHECK_GROUPS, SOCIAL_CONSTRAINT_LINES, SOCIAL_FOOTER_LABEL"
  - "features/studio/social/social-form.ts: SocialForm/SocialBrief, validateSocialForm (UI-SPEC copy), isValidLink, sameBrief, toSocialInputs, restoreSocialForm, listingOptionLabel"
  - "features/studio/social/SocialBriefForm.svelte: one fieldset card; validate() / clearErrors() / focusFirst(); bind:form; listingOptions + onsource"
  - "features/studio/fixtures/sample-social-brief.ts: SAMPLE_SOCIAL_BRIEF (Harlow Springs)"
  - "features/studio/social/SocialStudio.svelte: the STU-02 page body; /agent/studio/social/ renders h1 + <SocialStudio />"
  - "ArtifactRepo.updateMeta?(id, patch) (optional on the interface, implemented by createArtifactRepo)"
  - "DraftHistory `rowNote?: (a) => string | null` prop (one muted line per row)"
  - "PlatformCard module: COPIED_META_KEY, withCopied, copiedNote; sections mode stores meta.copied on each card copy"
affects: [09-23 phase gate]
tech-stack:
  added: []
  patterns:
    - "Social sections built from core parseSocialPack / splitTrailingHashtags / assemblePost, so the disclosure is last by construction on every card"
    - "Draft history row extras come from artifact meta through a host-supplied rowNote, keeping DraftHistory feature-agnostic"
key-files:
  created:
    - apps/web/src/lib/features/studio/social/social-sections-spec.ts
    - apps/web/src/lib/features/studio/social/social-sections-spec.test.ts
    - apps/web/src/lib/features/studio/social/social-form.ts
    - apps/web/src/lib/features/studio/social/social-form.test.ts
    - apps/web/src/lib/features/studio/social/SocialBriefForm.svelte
    - apps/web/src/lib/features/studio/social/SocialStudio.svelte
    - apps/web/src/lib/features/studio/fixtures/sample-social-brief.ts
    - apps/web/tests/e2e/studio-social.spec.ts
  modified:
    - apps/web/src/routes/(app)/agent/studio/social/+page.svelte
    - apps/web/src/lib/ai/storage/artifacts.ts
    - apps/web/src/lib/ai/storage/artifacts.test.ts
    - apps/web/src/lib/ai/ui/DraftHistory.svelte
    - apps/web/src/lib/ai/ui/draft-history.test.ts
    - apps/web/src/lib/ai/ui/GenerationPanel.svelte
    - apps/web/src/lib/ai/ui/GenerationPanel.sections.test.ts
    - apps/web/src/lib/ai/ui/PlatformCard.svelte
key-decisions:
  - "09-20: the social tool saves its packs under exactly 'studio-social' (literal in SocialStudio), proven in E2E by the Studio hub reading '1 draft saved' on the Social post pack card"
  - "09-20: the appended disclosure is the agent's ad-inline disclosure once the profile is complete, the Avery Sample one while the unedited sample brief is in the form, otherwise none (every Copy is gated with the profile reason anyway); same rule as 09-15 listing and 09-22 reel"
  - "09-20: 'Copied: {platforms}' (UI-SPEC Draft history extra) implemented additively: ArtifactRepo.updateMeta (optional on the interface so lightweight test repos still type-check), meta.copied in card order, DraftHistory rowNote slot"
  - "09-20: the brief textarea has no maxlength so 'Keep your brief under 2,000 characters.' can show; the live count reads '{n} of 2,000'"
  - "09-20: a link must be http(s) with a dotted host; an invalid link is never passed to the prompt"
  - "09-20: number checks use the current brief and link, falling back to those of the last run while the brief is invalid"
  - "09-20: card edits are still not written back into the stored pack text (deferred to 09-23, as 09-19 noted)"
requirements-completed: []  # STU-02 advanced; ids are closed by the 09-23 phase gate
duration: ~35 min (15:00Z to 15:35Z, single core 0x100; 09-21 and 09-22 committed alongside)
completed: 2026-10-07
---

# Phase 9 Plan 20: Social post pack studio Summary

**STU-02 now works end to end on /agent/studio/social/. The agent writes one brief: post type, an optional listing description to start from, the brief itself, a place for hashtags, an optional link and a tone. They get Instagram, Facebook and LinkedIn cards. Each card counts its characters with the ad-inline disclosure included, runs its own Fair Housing, number and number-word checks, and has one Copy whose clipboard text ends with the disclosure. Instagram over 2,200 characters, hashtags past the cap after an edit, a Must fix phrase, a missing section and an incomplete profile each gate the affected card's Copy. The keyless sample brief produces three clean cards with zero provider or RentCast requests, and the Studio hub counts the pack.**

## Performance

- **Duration:** about 35 min (15:00Z to 15:35Z, single core, mask 0x100)
- **Tasks:** 2 of 2, plus 1 additive shared-file commit and 1 follow-up fix
- **Files:** 8 created, 8 modified

## Accomplishments

- **buildSocialSections.** Returns the three specs in the fixed order with labels Instagram / Facebook / LinkedIn and the UI-SPEC constraint lines verbatim. Each spec has these parts:
  - `emailFooter` is the disclosure plus "Added to the end of this post".
  - `extract` uses parseSocialPack. A section is 'streaming' only while it is the one arriving. After the stream, a missing or empty section is 'error'.
  - `assemble` re-parses the trailing hashtags, then calls core assemblePost with the disclosure last, plus `tagsOverCap`.
  - `postChecks` are numberPostCheck('social', briefAllowedNumbers(brief, link)) and numberWordsPostCheck().
  - SOCIAL_CHECK_GROUPS gives "Number check passed" / "Number check: {n} to fix" and "Numbers as words".
- **SocialBriefForm.** One fieldset card (legend "Your post") with these fields in UI-SPEC order:
  - "What's the post about?" chips, default Just listed.
  - "Start from a listing description (optional)" NativeSelect: "Don't use one" plus the 20 newest `studio-listing` drafts as "{Mon D} · {first 40 characters}…". With none saved, a helper says where they come from.
  - "Your brief": min-height 160px, live "{n} of 2,000" count, the verbatim helper, InputFairHousingNote.
  - "City or area for hashtags" (max 40) and "Link to include (optional)" (type url, max 200), with the verbatim helpers.
  - Tone chips.
  - Errors use the Phase 3 invalid pattern with the three UI-SPEC strings.
- **SocialStudio.** Lead, then DisclosureStatus (sample variant while the unedited sample brief is in the form and the profile is incomplete), then the action row: "Use a sample brief" and "Clear brief", which opens the "Clear this brief?" ConfirmDialog with "Keep them", plus a SampleChip. Then the form, then GenerationPanel in sections mode (cards span the 1120px container, three columns from 1280px), then Draft history.
  - Panel props: feature "studio-social", prompt "studio/social.v1", title "Post pack", run label "Write post pack", `containsClientData={false}`. Profile gate: `exitDisabled={{ copy: 'Add your {missing} in your profile so your disclosure can be added.' }}`.
  - The run validates first and focuses the first invalid field.
  - Announcements: "Sample brief filled in.", "Form cleared.", "Listing description copied into your brief.".
  - Autosave goes through `createStudioAutosave('social')` (500 ms). Dexie and the profile load by dynamic import in onMount.
- **Draft history "Copied: {platforms}".** On each card copy, sections mode merges the platform into the pack artifact's `meta.copied` (card order, no repeats) through the new `ArtifactRepo.updateMeta`. SocialStudio's `rowNote` renders "Copied: LinkedIn" in Draft history. The row still becomes Reviewed on the first copy (09-19).

## Task Commits

1. **Task 1: social brief form and per-platform section specs:** `b6f25c0` (feat)
2. **Shared, additive: copied platforms on Draft history rows:** `7f7fb84` (feat)
3. **Task 2: social post pack studio with E2E:** `d58bb97` (feat)
4. **Follow-up: no sample disclosure under the agent's own brief:** `a5aef21` (fix)

Every commit used `git commit -- <explicit paths>` after `git diff --cached --name-only`.

## Verification

Every Node command ran through the single-core wrapper on mask 0x100.

- `vitest --project web social-sections-spec social-form`: 2 files, **19 passed**. These include zero Fair Housing and number findings on all three sample cards, disclosure-last for every card, the FACEBOOK-missing error after the stream, and 7 Instagram tags giving `tagsOverCap` 2.
- `vitest --project web` over `lib/ai/ui`, `lib/ai/storage` and `lib/features/studio`: 25 files, **458 passed** (includes the new updateMeta, rowNote and withCopied/copiedNote tests and the studio import-boundary test). The final re-run over studio + sections + draft-history + storage: **250 passed**.
- `vitest --project web-browser PlatformCard.browser GenerationPanel.browser`: **3 passed** (the sections-mode copy path changed).
- `pnpm check`: 0 errors, 0 warnings (2614 files). `pnpm banned`: passed (384 files). `pnpm guard --all`: passed (1585 files).
- `pnpm lint`: prettier clean repo-wide. eslint reported one parsing error, in `apps/web/src/lib/features/studio/reel/reel-view.test.ts`. That file belongs to 09-22 and was in progress, so I did not touch it. Scoped eslint on every file of this plan: clean.
- `build:root` and `build:sub`: pass (rebuilt after the last app change).
- Playwright, `--workers=1`, all foreground:
  - Final run of `studio-social` plus `studio-shell` on root and sub: **52 passed** (3.9 min).
  - `studio-listing` (shared panel and DraftHistory) on root and sub: **12 passed**.
  - `ai-guardrails` on root, the Phase 5 DraftHistory statuses and delete regression: **4 passed**.
- **What studio-social asserts:**
  - Keyless sample: three articles with h3 Instagram, Facebook, LinkedIn in order. Each count line matches the UI-SPEC format. Each card's block shows the same one-line Avery Sample ad-inline disclosure. There is no panel-level exits group, and `exits-linkedin` holds exactly one control.
  - Copy LinkedIn: clipboard ends with `\n\n{disclosure}` and the status reads "Copied.". Draft history then shows "1 saved", "Reviewed" and "Copied: LinkedIn".
  - Edit Facebook with 3 extra tags: "Facebook uses up to 2 hashtags. Remove 3 to copy this post.". Instagram is unaffected.
  - Edit LinkedIn with "family-friendly neighborhood": a Must fix mark, LinkedIn Copy gated, Instagram unaffected.
  - Hub: the Social post pack card reads "1 draft saved".
  - Over limit: after saving a TX profile through the profile page, a 1,990-character brief makes Instagram Copy `aria-disabled` with "{n} characters over Instagram's limit. Shorten the post to copy it.". Facebook and LinkedIn stay enabled and show the agent's own disclosure.
  - Incomplete profile with the agent's own brief: every Copy is gated with the profile reason and no disclosure block is shown.
  - Parse error: a fake Anthropic key is saved through Settings and the SSE is mocked without FACEBOOK. Exactly 1 generate call is made. The Facebook card shows "The Facebook post didn't come through", and Instagram and LinkedIn stay copyable.
  - Validation: "Write a short brief." focuses the brief; a bad link shows its error and focuses the link; no run starts.
  - Listing source: a keyless listing description is written, then chosen in the select. The announcement fires, and the brief holds the description without the disclosure.
  - axe, zero violations, at 1280px and 375px: before a run, after a mocked run with Instagram over the limit and Facebook missing, and with the Clear confirm open. `scrollWidth <= width` holds in each state.
  - In afterEach: zero requests leave the local origin (the Anthropic mock is the only provider route), and there are zero uncaught page errors.
- No `test.slow()` was needed beyond the two axe tests. The over-limit test waits up to 180 s for "Draft ready.", because the keyless Fixture streams a 2,000-character brief three times at a reading pace (about 45 s on one core).
- Acceptance greps: SocialStudio contains `studio-social`, `studio/social.v1`, `Write post pack`, `Use a sample brief`, `Clear this brief?`, `buildSocialSections(`, `exitDisabled` and `variant: 'ad-inline'`. The `footerLabel|footer:|gate=` grep over `features/studio/social` returns nothing. The spec contains `Copy LinkedIn post`, `over Instagram's limit`, `didn't come through`, `family-friendly neighborhood`, `AxeBuilder` and `scrollWidth`.
- `apps/web/test-results` deleted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - UI-SPEC requirement] "Copied: {platforms}" in Draft history (shared Phase 5/9 files)**
- **Found during:** Task 2. The UI-SPEC "Social post pack" copy block lists "Draft history extra: 'Copied: {platforms}'", and 09-19 deferred it to this plan.
- **Fix, minimal and additive, with tests:**
  - `ArtifactRepo.updateMeta?` merges validated meta in one transaction; a missing id is a no-op. It is optional on the interface so the typed test fakes in three Phase 5 test files still compile.
  - The sections-mode copy path stores `meta.copied`. A failed bookkeeping write never undoes the copy.
  - `DraftHistory` has an optional `rowNote` prop.
  - `PlatformCard` exports `withCopied` and `copiedNote`.
  - No concurrent plan lists these files.
- **Files modified:** artifacts.ts (+test), DraftHistory.svelte (+draft-history.test.ts), GenerationPanel.svelte (+GenerationPanel.sections.test.ts), PlatformCard.svelte
- **Commit:** `7f7fb84`

**2. [Rule 3 - Structure] Form model in social-form.ts + social-form.test.ts**
- The plan lists only the .svelte form. Validation, sample detection, restore, the prompt-input conversion and the option label are pure, so they live in a tested module beside the component. This is the same split as 09-15. Both files are new.
- **Commit:** `b6f25c0`

**3. [Interpretation] No disclosure block while gated on the agent's own brief**
- The plan's interface reads `composeDisclosure(profile ?? SAMPLE_AGENT_PROFILE, ...)`. Showing the sample agent's line under a real agent's own brief would mislabel them. So, like 09-15 and 09-22, the block is absent while every Copy is gated with the profile reason.
- The disclosure is the agent's own once the profile is complete, or the Avery Sample one for the unedited sample brief.
- **Commit:** `a5aef21`

**4. [Interpretation] Small copy and markup choices the UI-SPEC leaves open**
- Fieldset legend: "Your post". The UI-SPEC names no legend, and "Your brief" is the textarea's label.
- Empty listing-source helper: "Listing descriptions you write in the Studio appear here."
- Social number-check notes: "Every number matches your brief."

**Total deviations:** 1 UI-SPEC requirement in shared files, 1 structural, 2 interpretations.

## Deferred Issues

- **Card edits are not written back into the stored pack text.** SectionSpec has no serializer, so Draft history reopens the generated pack. This is carried over from 09-19 for the 09-23 gate.
- **Before the first run, the cards row is rendered with each card's empty line.** That is the 09-19 PlatformCard behavior. The UI-SPEC says the row is not rendered before a run. It is unchanged here and noted for 09-23.

## Requirements

STU-02 is demonstrable in E2E. I did not run `requirements mark-complete`, because the 09-23 phase gate closes requirement ids, as the briefing directs.

## Known Stubs

None. Every control is wired:
- The form autosaves to Dexie.
- The listing source reads `studio-listing` artifacts.
- The panel drafts with the registered prompt.
- Draft history reads the artifacts repo and its meta.

## Self-Check: PASSED
