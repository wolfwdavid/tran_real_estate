---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 15
subsystem: studio-ui/listing
tags: [studio, listing, generation-panel, fair-housing, disclosure, autosave, e2e, axe]
requires:
  - phase: 05
    provides: "GenerationPanel (postChecks, emailFooter, exitDisabled, beforeGenerate, checkGroups), DraftHistory, Fixture provider, FindingsSummary rows (Show in draft / Edit it myself)"
  - phase: 06
    provides: "radio/checkbox chip anatomy (FilterFields)"
  - phase: 08
    provides: "NativeSelect, SampleChip, ConfirmDialog, SAMPLE_AGENT_PROFILE"
  - phase: 09-08
    provides: "formatForExit on GenerationPanel"
  - phase: 09-10
    provides: "composeDisclosure(p, { variant: 'ad-block' }), isProfileComplete, missingFor, DISCLOSURE_FIELD_LABELS"
  - phase: 09-11
    provides: "createStudioAutosave('listing') with load() taking no argument"
  - phase: 09-12
    provides: "DisclosureStatus, InputFairHousingNote, CharacterCount; hub counts drafts by feature 'studio-listing'"
  - phase: 09-13
    provides: "studio/listing.v1 (build() validates and throws), numberPostCheck / numberWordsPostCheck / unsupportedFeaturePostCheck, listingAllowedNumbers, STUDIO_CHECKERS"
provides:
  - "features/studio/listing/ListingFactsForm.svelte: four fieldset cards, exposes validate() / clearErrors() / focusFirst(), bind:form"
  - "features/studio/listing/listing-form.ts: ListingForm (typed strings), emptyListingForm, toFactsInput (closed whitelist), validateListingForm, factsToForm, restoreListingForm, sameForm, fieldId, firstInvalidKey, formatNumberText"
  - "features/studio/listing/listing-count.ts: wordCount, withDisclosure (also the panel's formatForExit), countLine, siteLimitLine"
  - "features/studio/fixtures/sample-listing-facts.ts: SAMPLE_LISTING_FACTS (12 Example Lane, no Fireplace)"
  - "features/studio/listing/ListingStudio.svelte: the STU-01 page body; module export LISTING_CHECK_GROUPS"
  - "/agent/studio/listing/ renders h1 + <ListingStudio />"
  - "PanelState.preview() no longer rejects when the host's inputs do not build yet"
affects: [09-17 social (same studio page pattern), 09-21 reel, 09-23 phase gate]
tech-stack:
  added: []
  patterns:
    - "Studio form kept as typed strings, converted to the core whitelist only at validation; autosave stores the strings"
    - "Unedited-sample detection by value equality with factsToForm(SAMPLE), so it survives a reload"
    - "formatForExit = the same pure function the count line uses, so the count and the clipboard always agree"
key-files:
  created:
    - apps/web/src/lib/features/studio/listing/ListingFactsForm.svelte
    - apps/web/src/lib/features/studio/listing/ListingStudio.svelte
    - apps/web/src/lib/features/studio/listing/listing-count.ts
    - apps/web/src/lib/features/studio/listing/listing-count.test.ts
    - apps/web/src/lib/features/studio/listing/listing-form.ts
    - apps/web/src/lib/features/studio/listing/listing-form.test.ts
    - apps/web/src/lib/features/studio/fixtures/sample-listing-facts.ts
    - apps/web/tests/e2e/studio-listing.spec.ts
  modified:
    - apps/web/src/routes/(app)/agent/studio/listing/+page.svelte
    - apps/web/src/lib/ai/ui/panel-state.svelte.ts
key-decisions:
  - "09-15: the appended disclosure is the agent's ad-block disclosure once the profile is complete, the Avery Sample one while the form holds unedited sample facts, otherwise none (emailFooter undefined) because every exit is gated with the profile reason anyway"
  - "09-15: formatForExit = withDisclosure (draft.trimEnd() + blank line + disclosure), the same function the count line measures"
  - "09-15: three checkGroups after Fair Housing (Number check / Facts check / Numbers as words), all allowRemovePhrase false, so unsupported-feature and number-word rows get the UI-SPEC 'Show in draft' and 'Edit it myself' through the shipped FindingsSummary, with no shared-component change"
  - "09-15: checks run against the current valid facts (so adding a feature the draft mentions clears it on the next text event), falling back to the facts of the last run while the form is invalid"
  - "09-15: profile gate reason lists the missing items with Intl.ListFormat ('full name, brokerage, license type, license number, and license state')"
  - "09-15: PanelState.preview() catches a build() refusal and leaves built null (the empty listing form made every page load raise an unhandled rejection)"
requirements-completed: []
duration: ~24min
completed: 2026-10-07
---

# Phase 9 Plan 15: Listing description studio Summary

**STU-01 works keyless end to end on /agent/studio/listing/: a four-fieldset facts form that can only produce the closed listing-facts whitelist, a Write description run that validates first, a Fixture draft built from the facts with zero findings, Fair Housing plus number, unsupported-feature and number-word checks that gate Copy, the ad-block disclosure appended to every exit and shown under the draft, a words/characters/with-disclosure count line with an optional listing-site limit, Draft history, and 500 ms autosave.**

## Performance

- **Duration:** about 24 min (11:47Z to 12:11Z, single core, mask 0x100; 09-16, 09-17 and 09-18 committed alongside)
- **Tasks:** 2 of 2
- **Files:** 8 created, 2 modified

## Accomplishments

- **ListingFactsForm.** `<form novalidate>` with the legends The home, Features, Nearby and Style. Every label, helper, tone description and the length helper are verbatim from the UI-SPEC. Chips follow the Phase 6 anatomy (a real radio or checkbox covers each chip; a check icon and weight show the selected state). Property type uses the Phase 8 NativeSelect. Numeric fields are `type="text"` with an inputmode and format on blur (price, square feet and the site limit get separators). Blur shows format errors only; the run control shows all of them. Errors use the core validateListingFacts copy with the Phase 3 invalid pattern (aria-invalid, CircleAlert plus words, aria-describedby). Price relabels to Monthly rent for rentals, with a `$` adornment and a hidden ", in dollars". Other features, Name nearby places and Anything else each carry an InputFairHousingNote. The textarea has a live "{n} of 500" count with `aria-live="off"`. No schools, worship, safety or demographic field exists.
- **listing-form.ts.** The form keeps typed strings. `toFactsInput` emits only whitelisted keys, so the prompt's `build()` sees nothing else. `restoreListingForm` rebuilds a stored studioDraft row and drops unknown or malformed keys.
- **listing-count.ts.** `countLine('Hello there friend', 'DISCLOSURE')` returns `3 words · 18 characters. With your disclosure: 30 characters.`. `siteLimitLine` returns "{c} of {limit} characters for your listing site." and the over-limit text. The line is informational and never gates.
- **ListingStudio.** Order: lead, DisclosureStatus (sample variant while the form holds unedited sample facts and the profile is incomplete), the action row (Fill with sample facts, Clear facts with the "Clear these facts?" ConfirmDialog, SampleChip), the form, the "isn't sent to {Provider}" note, GenerationPanel, the count line, then Draft history (feature `studio-listing`, so the hub count moves).
  - GenerationPanel props: `feature="studio-listing"`, `promptId="studio/listing.v1"`, title "Listing description", headingLevel 2, generateLabel "Write description", `containsClientData={false}`, and the mailto subject "Listing description: {street or area}" (falls back to "Listing description").
  - postChecks: `[numberPostCheck('listing', …), unsupportedFeaturePostCheck(…), numberWordsPostCheck()]`.
  - The rest: the checkGroups, `emailFooter` with the label "Added to the end of this description", `formatForExit`, `exitDisabled` (the profile reason on all three exits) and `beforeGenerate`.
  - Announcements: "Sample facts filled in." and "Form cleared.". Focus goes to the first field after both, and to the first invalid field when a run is refused.
  - Dexie (autosave and artifacts) and the profile load by dynamic import in onMount. The page shows "Loading your studio…" until those reads finish.

## Task Commits

1. **Task 1: listing facts form and count line:** `5e1eed2` (feat)
2. **Task 2: listing description studio with keyless E2E:** `ade7dd8` (feat)

Both commits used `git commit -- <explicit paths>`, and I checked `git diff --cached --name-only` before each one.

## Verification

All Node commands ran through the single-core wrapper on mask 0x100.

- `vitest --project web listing-count listing-form`: 2 files, **15 passed**. That includes the sample facts validating and their keyless draft having zero findings from Fair Housing and every studio check.
- `vitest --project web src/lib/ai/ui src/lib/features/studio/listing`: 12 files, **254 passed**. This covers the panel-state change against the Phase 5/7/8/9 panel suites.
- `vitest --project scripts agent-boundary`: 9 passed.
- `pnpm check`: 0 errors, 0 warnings (2588 files). `pnpm lint` (repo-wide prettier --check and eslint): clean. `pnpm banned`: passed (371 files). `pnpm guard`: passed. The guard also ran on staged files in each commit hook.
  - Earlier runs showed transient errors in other executors' in-progress files: `snapshot-components.test.ts` failed check and `BrandBand.svelte` failed banned. Neither file is mine, and both were clean on the final run.
- `build:root` and `build:sub`: pass. `pnpm csp:assert`: passed for 38 pages on each base.
- Playwright, `--workers=1`:
  - `studio-listing` on root and sub: **12 passed** (1.5 min).
  - `studio-shell` on root and sub: **36 passed** (1.1 min).
  - `a11y.spec` filtered to `studio/listing` (1280px and 375px route walk, both bases): **4 passed**.
- **What studio-listing asserts:**
  - No label matches school, crime, safety, worship or demographic.
  - An empty-form run shows "Choose For sale or For rent.", focuses the For sale radio and starts no generation.
  - With sample facts, the draft shows Sample output, no Must fix, "Number check passed" and "Facts check passed".
  - The clipboard ends with `\n\n` plus the Avery Sample ad-block disclosure, read from the "Added to the end of this description" block.
  - The count line matches the expected format.
  - After " Perfect for young professionals." is appended, Copy has `aria-disabled="true"` and shows the Phase 5 Must fix reason. Use alternative re-enables it.
  - Editing a sample fact (tone) brings back the profile gate reason. Restoring the fact clears it.
  - The form survives a reload through autosave.
  - axe finds zero violations at 1280px and 375px in five states: empty, sample-filled, one Must fix plus Review findings, edit mode, and the Clear confirm open. `scrollWidth <= width` holds in each.
  - In afterEach, zero requests go to any non-local host (including api.rentcast.io and the four AI hosts), and there are zero uncaught page errors.
- **Mutation proof for the panel-state change:** with the original `preview()` restored, a rebuilt root fails "the page asks for property facts only" on the page-error assertion. I restored the fixed file afterwards and checked it was byte-identical to my copy.
- Not run, per the briefing's single-core rule (plan specs plus studio-shell only): the full `routing` spec and the full `a11y` walks. The 09-23 gate covers them.
- `apps/web/test-results` deleted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PanelState.preview() raised an unhandled rejection on the empty listing form**
- **Found during:** Task 2
- **Issue:** GenerationPanel calls `st.preview()` on mount, and preview builds the prompt. The studio/listing.v1 `build()` (09-13) throws on invalid facts, which every empty form has. So every page load raised an uncaught promise rejection, and the spec's page-error check caught it.
- **Fix:** `preview()` wraps `buildPrompt` in try/catch and leaves `built` null, so "What will be sent" shows only the destination line. `generate()` is unchanged; ListingStudio's `beforeGenerate` validates first. This adds 7 lines to a file outside files_modified. No concurrent plan lists it (09-19, a later wave, does).
- **Files modified:** apps/web/src/lib/ai/ui/panel-state.svelte.ts
- **Commit:** `ade7dd8`

**2. [Rule 3 - Structure] Form model split into listing-form.ts and listing-form.test.ts**
- The plan lists only the .svelte form. The string-to-facts conversion, restore, first-invalid and format-on-blur logic is pure, so it lives in a tested module beside the component, in the plan's own folder. These two files are new and no other plan touches them.
- **Commit:** `5e1eed2`

**3. [Interpretation] checkGroups added for the studio checks**
- The plan's interface lists no `checkGroups`, but the UI-SPEC requires the number group titles ("Number check passed" and "Number check: {n} to fix") and "Edit it myself" / "Show in draft" for unsupported features.
- The shipped FindingsSummary already renders those buttons for a group with `allowRemovePhrase: false`. So LISTING_CHECK_GROUPS gives the three checker ids their own groups, and no shared component changed.
- The Facts check and Numbers as words group titles are my wording. The UI-SPEC defines none for them.

**4. [Interpretation] No disclosure footer in the gated state**
- With an incomplete profile and the agent's own facts, `emailFooter` is undefined, so no disclosure is shown under the draft. Every exit is already gated with "Add your {missing items} in your profile so your disclosure can be added.". Showing the sample agent's disclosure there would mislabel the agent.

**Total deviations:** 1 bug fix, 1 structural, 2 interpretations. No scope creep.

## Requirements

STU-01 is now demonstrable keyless in E2E. I did not run `requirements mark-complete`, because the briefing says the 09-23 phase gate closes requirement ids.

## Known Stubs

None. Every control is wired:
- The form autosaves to Dexie.
- The panel drafts with the registered prompt, and its checks and disclosure come from shipped modules.
- Draft history reads the artifacts repo.

## Notes for later plans

- 09-17 (social) and 09-21 (reel) can reuse the same page shape:
  - The `sameForm(form, factsToForm(SAMPLE))` sample detection.
  - The emailFooter / exitDisabled split.
  - A preview-safe `inputs`. The panel now tolerates a build() refusal.
- Draft history rows do not show the street or area. Phase 5 DraftHistory has no per-row title slot, so "Shown in the subject line and Draft history" holds only for the subject line today. Showing it in Draft history would need an `artifactMeta`-driven row label in DraftHistory, which is a shared component.

## Self-Check: PASSED
