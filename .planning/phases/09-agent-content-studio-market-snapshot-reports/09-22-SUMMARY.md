---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 22
subsystem: studio-reel-ui
tags: [studio, reel, generation-panel, ai-disclosure, checklist, e2e, axe]
requires:
  - phase: 05
    provides: "GenerationPanel (postChecks, checkGroups, emailFooter, exitDisabled, beforeGenerate), DraftHistory"
  - phase: 09-08
    provides: "GenerationPanel formatForExit"
  - phase: 09-12
    provides: "StudioHub counts reel drafts under STUDIO_DRAFT_FEATURES.reel = 'studio-reel'; DisclosureStatus; InputFairHousingNote"
  - phase: 09-15
    provides: "tool page pattern (ListingStudio: sample/clear row, profile gate, autosave)"
  - phase: 09-21
    provides: "studio/reel.v1 (sampleReel), REEL_CHECKLIST, resultsBeatPostCheck, quotePostCheck, REEL_CHECKERS, reelFooter, formatReelForExit"
provides:
  - "features/studio/reel/ReelBeatsForm.svelte: Your story form + module helpers (BEAT_FIELDS, emptyReelForm, validateReelForm, restoreReelForm, sameStory, slotFor, reelFieldId)"
  - "features/studio/reel/ReelScriptView.svelte: Script at a glance (table from 1024px, stacked cards below, row notes, B-roll list; scriptView/beatNotes helpers)"
  - "features/studio/reel/AiDisclosureChecklist.svelte: 8 local, unsaved checkboxes + footnote"
  - "features/studio/reel/ReelStudio.svelte: the reel page body; REEL_CHECK_GROUPS; reelEmailFooter(profile, usingSampleBeats)"
  - "features/studio/fixtures/sample-reel-beats.ts: SAMPLE_REEL_BEATS, SAMPLE_REEL_BEATS_NO_RESULTS, ReelBeats"
  - "/agent/studio/reel/ renders ReelStudio"
  - "tests/e2e/studio-reel.spec.ts"
affects: [09-23]
tech-stack:
  added: []
  patterns:
    - "Derived read-only view of the panel's live draftText (edits included); times only from REEL_TEMPLATES"
    - "CSS-only table/cards swap at lg (1024px) so one variant is in the accessibility tree"
    - "The footer disclosure is chosen by a pure exported function (reelEmailFooter) so the gated state is unit-testable"
key-files:
  created:
    - apps/web/src/lib/features/studio/reel/ReelBeatsForm.svelte
    - apps/web/src/lib/features/studio/reel/ReelScriptView.svelte
    - apps/web/src/lib/features/studio/reel/AiDisclosureChecklist.svelte
    - apps/web/src/lib/features/studio/reel/ReelStudio.svelte
    - apps/web/src/lib/features/studio/reel/reel-view.test.ts
    - apps/web/src/lib/features/studio/fixtures/sample-reel-beats.ts
    - apps/web/tests/e2e/studio-reel.spec.ts
  modified:
    - apps/web/src/routes/(app)/agent/studio/reel/+page.svelte
key-decisions:
  - "09-22: the reel sample state matches either sample (with or without results) and ignores the length, so 60 s and the empty-results path stay on the Avery Sample disclosure"
  - "09-22: with the agent's own beats and an incomplete profile the footer carries NO disclosure (emailFooter undefined) and all three exits are gated with the profile reason; the sample disclosure is only for the sample beats (same rule as 09-15/09-20)"
  - "09-22: the script view and the copy use the length captured at run start; a draft reopened from history uses the form's current length"
  - "09-22: the form model lives in ReelBeatsForm's module script (no reel-form.ts in files_modified)"
requirements-completed: []  # STU-03 is closed by the 09-23 phase gate
duration: ~45 min of active work (stage 1 11:15-11:27, stage 2 11:36-12:00, plus waiting for the build directory)
completed: 2026-10-07
---

# Phase 9 Plan 22: Reel script studio Summary

**/agent/studio/reel/ is now the full STU-03 tool. The agent types six beats and picks 30 or 60 seconds, and keyless generation writes a script whose "Script at a glance" view shows code-owned times, captions and a B-roll shot list. The view is a table from 1024px and stacked cards below. With "Your results" empty a notice explains the placeholder, the results beat keeps `[Add a real result you can document]`, and a typed number there is a Must fix that gates Copy. Copy text is the timecoded script, then the caption disclosure, then the 8-item "Before you post this video" checklist. The page makes zero provider or RentCast requests and is axe-clean at 375px and 1280px on both bases.**

## Performance

- **Tasks:** 2 of 2, run in two stages. Stage 1 was the components, unit tests and spec. Stage 2 was the E2E, run once the build directory was free.
- **Files:** 7 created, 1 modified

## Accomplishments

- **ReelBeatsForm.**
  - Legend "Your story", plus "Reel length" chips (30 seconds by default, or 60 seconds).
  - Six textareas, min height 96px, with the UI-SPEC labels and helpers. Each label is followed by its slot for the chosen length; at 60 seconds, Call to action shows "0:52 to 1:00".
  - Counts "{n} of 300" ("of 120" for the call to action). Each field has an `InputFairHousingNote`, and "Your results" has the persistent reminder.
  - Validation copy is verbatim and checked on submit; focus goes to the first invalid beat.
- **ReelScriptView.**
  - Derived from the panel's current draft text with `parseReel` and `timeBeats`, so edits are included.
  - Table: caption "{30|60}-second reel, 6 beats", columns Time, Beat, Voiceover, On-screen caption, B-roll, with row headers. It sits in a focusable scroll wrapper.
  - Stacked variant: an `<ol>` of cards, each with an h3 "{Beat} · {slot}" and a `<dl>`.
  - Row notes cover voiceover overrun, captions over 42 characters, and the placeholder ("Replace this with a real result before you record."). The placeholder itself is set at weight 600.
  - h3 "B-roll shot list" with each shot prefixed by its start time.
  - Two other states: the empty line before any draft, and the "Tran couldn't split this script into beats" panel.
- **AiDisclosureChecklist.** h2 "Before you post this video", 8 native checkboxes from REEL_CHECKLIST, and the footnote. There is no storage import and no approval wording, and the boxes reset on reload.
- **ReelStudio.**
  - Page order follows the UI-SPEC: lead, DisclosureStatus, then the row with **Fill with sample beats** and **Clear beats** (behind the "Clear these beats?" confirm), the form, the results notice, GenerationPanel, ReelScriptView, the checklist, and Draft history (`studio-reel`).
  - The panel uses the 09-21 / 09-08 interfaces:
    - `formatForExit = (d, f) => formatReelForExit(d, f, length)`
    - `emailFooter = reelEmailFooter(profile, usingSampleBeats)` (label "Added to the end of the copied script")
    - the four post-checks, plus `REEL_CHECK_GROUPS`
    - the profile `exitDisabled` gate and `mailto.subject` "Reel script"
  - Autosave uses `createStudioAutosave('reel')`. Announcements are "Sample beats filled in." and "Form cleared.".

## Task Commits

1. **Task 1: beats form, script view, checklist, sample beats**: `6e87276` (feat)
2. **Task 2a: reel studio page and route body**: `b48d4d1` (feat)
3. **Deviation 5 fix: no sample disclosure for the agent's own beats**: `3db38c7` (fix)
4. **Task 2b: E2E spec**: `0c63266` (feat)

Every commit used `git commit -- <explicit paths>` after `git diff --cached --name-only`.

## Verification

Every Node command ran through the single-core wrapper on mask 0x200.

- `vitest --project web reel`: 50/50, covering reel-view, reel-checks and reel.v1. The reel-view tests include:
  - the sample beats give zero findings at 30 s and 60 s, with and without results;
  - the 20-word-hook overrun note ("about 5 seconds") and the 43-character caption note;
  - a planted "0:00 to 0:09" in the draft does not change the code-owned times;
  - three `reelEmailFooter` states: the agent's own disclosure, the sample disclosure, and none.
- `vitest --project web reel-view boundaries` (studio import graph): 20/20.
- `pnpm check`: 0 errors, 0 warnings (2614 files).
- `pnpm lint` (repo-wide prettier + eslint): clean. 09-20 had reported a transient parse error at reel-view.test.ts:259. It was a quote inside my in-progress edit, fixed before `3db38c7`.
- `pnpm banned`: passed (384 files). `pnpm guard`: passed.
- `pnpm build:root`, `pnpm build:sub`: OK.
- Playwright, `--workers=1`, foreground chunks:
  - `studio-reel` root: 5/5 non-axe and 2/2 axe.
  - `studio-reel` sub: 7/7.
  - `studio-shell` on both bases: 36/36.
  - `studio-social` root, re-run because the panel is shared: 8/8.
- Acceptance greps all pass:
  - No storage/Dexie/localStorage in AiDisclosureChecklist.svelte.
  - No `footerLabel|footer=|gate=` in ReelStudio.svelte.
  - The required strings are present in the components and the spec.
- The .ts sources are ASCII-only; the middle dot and section sign are built with `String.fromCharCode`.

## Deviations from Plan

1. **[Rule 3 - Structure] Form model in ReelBeatsForm's module script.** files_modified has no reel-form.ts, so the helpers (`BEAT_FIELDS`, validation, restore, `sameStory`, `slotFor`) are exported from the component's module script and tested from there.
2. **[Interpretation] Sample state ignores the length and accepts both samples.** The beats count as sample beats when they match SAMPLE_REEL_BEATS or SAMPLE_REEL_BEATS_NO_RESULTS, whatever the length. Otherwise the plan's own E2E flow (switch to 60 s, clear results, then Copy) would hit the profile gate.
3. **[Interpretation] Script length.** The view and the copy keep the length the current draft was written for, captured in `beforeGenerate`, so moving the chip doesn't retime an existing draft. Drafts reopened from history use the form's length, because artifacts don't store one.
4. **[Interpretation] "Restore" in the E2E.** It is an edit that puts the placeholder back in place of "I helped 47 families.", followed by Copy.
5. **[Rule 2 - Correctness] Footer disclosure for the agent's own beats. FIXED in `3db38c7`.**
   - Stage 1 showed the Avery Sample disclosure in the footer preview even with the agent's own beats, while the exits were gated.
   - The coordinator ruled that this mislabels the agent, so the reel now follows 09-15 deviation 4 and 09-20: no disclosure, and all three exits gated with the profile reason.
   - It is covered by a unit test (`reelEmailFooter` returns undefined) and by an E2E test. That test checks there is no footer preview and no "Avery Sample", and that Copy, Open in email app and Mark as sent are all `aria-disabled`, with the exact reason shown.
6. **[Scope] Extra E2E cases.** Beyond the plan, the spec also covers validate-first, the Clear beats confirm (focus moves to the first field), the own-beats profile gate, and the hub count proven in its own test ("1 draft saved" under `studio-reel`).

**Stage 2 spec fixes** (my own file; no product change):
- After the first draft, the run control reads "Generate again". The spec's `writeScript` now accepts either label and waits for Stop to clear.
- The profile-reason locator now uses the exact string.

## Issues Encountered

- My first Stage 2 Playwright run was piped through `tail`. Three failures each ran into their 240 s timeout, which pushed the run past the 10-minute window and moved it to the background, where I stopped it. I re-ran it in smaller foreground chunks (non-axe, axe, then sub), each 2 minutes or less.
- No axe test needed more than the existing `test.slow()` plus a 240 s timeout. Each axe test took about 20 s.
- `apps/web/test-results` was deleted.

## Requirements

STU-03 is now covered end to end. I did not run `requirements mark-complete`; the 09-23 phase gate closes the requirement ids, as the briefing directs.

## Known Stubs

None.

## Self-Check: PASSED

All 7 created files and the modified route exist, and commits 6e87276, b48d4d1, 3db38c7 and 0c63266 are in the log.
