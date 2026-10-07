---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 12
subsystem: studio-ui/hub
tags: [studio, hub, disclosure, fair-housing, character-count, ssr, a11y]
requires:
  - phase: 05
    provides: "checkFairHousing (Phase 5 deterministic checker + lexicon), artifacts repo countByFeature"
  - phase: 07
    provides: "OverviewCard stretched-link card pattern"
  - phase: 08
    provides: "Alert info prerequisite style, buttonVariants outline link, profile repo"
  - phase: 09-09
    provides: "/agent/studio/ skeleton route, studio-shell.spec"
  - phase: 09-10
    provides: "$lib/features/shared/agent-profile (loadAgentProfile, toDisclosureProfile, SAMPLE_AGENT_PROFILE), composeDisclosure(p, { variant }), DISCLOSURE_FIELD_LABELS, missingFor"
  - phase: 09-11
    provides: "countSnapshots()"
provides:
  - "DisclosureStatus.svelte { profile: ProfileInput | null; usingSample: boolean } - Ready / Incomplete / Sample states, data-disclosure-status={mode}"
  - "InputFairHousingNote.svelte { text; id } - 300 ms debounced warn-only note; module exports INPUT_NOTE_DELAY_MS, noteRows(findings), noteRowsFor(text), NoteRow"
  - "CharacterCount.svelte { length; limit?; overText?; text } - over state when limit && length > limit"
  - "StudioToolCard.svelte { href; title; description; meta; linkText; icon }"
  - "StudioHub.svelte - module exports STUDIO_LOADING, draftsLine(n), snapshotsLine(n), STUDIO_DRAFT_FEATURES"
  - "/agent/studio/ renders h1 + <StudioHub />"
affects: [09-15 listing, 09-17 social, 09-21 reel, 09-22 snapshot builder, 09-23 phase gate]
tech-stack:
  added: []
  patterns:
    - "Debounced component logic tested through pure helpers exported from <script module> (SSR never runs $effect)"
    - "Described-by target always rendered (empty wrapper) so aria-describedby never dangles"
key-files:
  created:
    - apps/web/src/lib/features/studio/DisclosureStatus.svelte
    - apps/web/src/lib/features/studio/InputFairHousingNote.svelte
    - apps/web/src/lib/features/studio/CharacterCount.svelte
    - apps/web/src/lib/features/studio/StudioToolCard.svelte
    - apps/web/src/lib/features/studio/StudioHub.svelte
    - apps/web/src/lib/features/studio/studio-components.test.ts
  modified:
    - apps/web/src/routes/(app)/agent/studio/+page.svelte
key-decisions:
  - "No `useFairHousing` store exists in Phase 5 code (it was a planning name). InputFairHousingNote calls the shipped Phase 5 checker `checkFairHousing` from @tran/core/fair-housing after a 300 ms $effect debounce; the lexicon and checker are reused, nothing is re-implemented"
  - "Input-note explanation = the finding's first member's lexicon explanation (members are ordered block-first); the phrase is quoted with straight double quotes, in the original casing the checker matched"
  - "DisclosureStatus takes ProfileInput | null (AgentProfile is assignable), matching 09-10's shared API. A null profile lists the five base fields; brokerage phone only for NY/NJ via missingFor"
  - "Hub lead moved from the route into StudioHub (the route keeps title, meta description and h1); the disclosure slot and each meta slot show 'Loading your studio…' until the browser read finishes"
  - "Draft counts use artifact features 'studio-listing', 'studio-social', 'studio-reel' (STUDIO_DRAFT_FEATURES); snapshots use countSnapshots(). A count that fails to read shows an empty meta line rather than a wrong 'No drafts yet'"
  - "The hub never shows the sample variant (no form there): usingSample={false}"
requirements-completed: []
duration: ~30min
completed: 2026-10-07
---

# Phase 9 Plan 12: Shared studio components and the Studio hub Summary

**DisclosureStatus (Ready / Incomplete / Sample, composed from the ad-inline variant), a 300 ms warn-only InputFairHousingNote over the Phase 5 checker, CharacterCount with an icon-plus-words over-limit state, and the Studio hub: four stretched-link tool cards with live drafts/snapshots counts, the disclosure status first, and the sample report link, all prerendered with static hrefs.**

## Performance

- **Duration:** about 30 min (single core, mask 0x100; 09-14 ran alongside)
- **Completed:** 2026-10-07
- **Tasks:** 2
- **Files:** 6 created, 1 modified

## Accomplishments

- **DisclosureStatus:** Ready shows `CircleCheck`, "Your disclosure is ready", the lead-in, the composed `ad-inline` line in a `surface` block (`overflow-wrap: anywhere`) and "Edit in your profile". Incomplete uses the Phase 8 `Alert` info style (4px secondary left rule): the title, "Missing: {list}." from `DISCLOSURE_FIELD_LABELS`, "You can still write drafts now." and the outline link "Finish your profile". Sample uses `accent-surface` with a `border-strong` border and `FlaskConical`, plus the Avery Sample line. The legal note sits under every state.
- **InputFairHousingNote:** the wrapper `<div id>` always renders. Rows (`TriangleAlert` 16px foreground, Label 14/400) appear 300 ms after typing stops. It is warn-only and never blocks anything.
- **CharacterCount:** within the limit it shows a muted Label line. Over the limit it shows `TriangleAlert` plus the over text in Label 14/600 foreground (not destructive, not terracotta). It uses `tabular-nums` and is not a live region.
- **StudioToolCard:** follows the OverviewCard pattern with exactly one `<a`. The stretched link gives one tab stop, and the focus ring is drawn on the card. It has a 24px secondary icon (aria-hidden), an h2 title, a muted description, a muted meta line, and link text with ArrowRight.
- **StudioHub and route:** the order is lead, DisclosureStatus, then a `<ul>` of 4 cards (1 column, 2 x 2 from 768px, 24px gap), then "Preview a sample report" pointing to `${resolve('/print/snapshot/')}?id=sample`. Counts and the profile load in `onMount` (Dexie by dynamic import, zero RentCast calls).

## Task Commits

1. **Task 1: disclosure status, input Fair Housing note, character count:** `0c9717f` (feat)
2. **Task 2: studio hub with tool cards:** `2b504ce` (feat)

Both commits used `git commit -- <explicit paths>`, and `git diff --cached --name-only` was checked first. After the orchestrator's heads-up, `git diff` confirmed the Task 1 files were unchanged after their commit (09-14's `prettier --write` left them untouched).

## Verification

- `vitest run --project web studio-components`: **21 passed** (16 Task 1 + 5 Task 2).
- `pnpm check`: 0 errors, 0 warnings (2563 files). `pnpm lint` (repo-wide prettier + eslint): clean. Scoped eslint with `--report-unused-disable-directives` on my files: clean.
- `pnpm banned`: passed (356 files). `pnpm ui:guard`: passed. Hex grep over my 6 files: none. The repo-wide `grep -rnE "#[0-9A-Fa-f]{6}\b" apps/web/src/lib/features/studio` does match `snapshot/build-record.test.ts`, a 09-14 test file with brand-colour fixtures. That file is not mine.
- `build:root`: passes. `apps/web/build/agent/studio/index.html` contains `agent/studio/listing/` and `print/snapshot/?id=sample`.
- Playwright root (`--workers=1`):
  - `routing a11y studio-shell`: **169 passed** (9.1 min). The `a11y` filter also matches settings-a11y and agent-a11y. This includes the axe route walk on `agent/studio/` and the studio-shell hub-link test.
  - `agent-a11y` separately: **35 passed**.
- A **temporary runtime probe** (created, run, and deleted; never staged) checked the post-mount hub on root:
  - Incomplete state with all five missing fields, and the four meta lines "No drafts yet" x3 and "No snapshots yet".
  - axe clean at 1280px and 375px, with no horizontal scroll.
  - After saving a TX profile, the Ready state with the composed line "Example Realty · Sample Agent, Licensed Real Estate Salesperson · Lic. #SAMPLE-0001 (TX) · (555) 555-0100", also axe clean at both widths.
  - The RentCast tripwire caught zero requests. Result: 1 passed.
- `apps/web/test-results` deleted.
- Not run (per briefing, targeted runs only): the full `vitest run --project web` and the sub-path base for Playwright. The 09-23 gate covers them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `useFairHousing` does not exist; used the shipped Phase 5 checker**
- **Found during:** Task 1
- **Issue:** The plan's requires_phase lists Phase 5 `useFairHousing(text)` (a debounced checker store). No such export exists in the codebase. Phase 5 shipped the deterministic checker `checkFairHousing` plus its lexicon in `@tran/core/fair-housing`, which `panel-controller.ts` already uses.
- **Fix:** InputFairHousingNote calls `checkFairHousing` inside a 300 ms `$effect` debounce. No checker logic, lexicon or pattern was re-implemented, so the "never re-implement" rule holds. I judged that this does not need the STOP path, because the substance (the audited checker) exists and only the wrapper name was missing.
- **Commit:** `0c9717f`

**2. Prop type `ProfileInput | null` instead of `AgentProfile | null`**
- This follows the 09-10 shared API (`isProfileComplete` and `toDisclosureProfile` take `ProfileInput`). `AgentProfile` is assignable, and the sample constant is a `ProfileInput`.

**Total deviations:** 1 auto-fixed (Rule 3), 1 type alignment. No scope creep.

## Requirements

STU-01 and STU-04 are not marked complete. Per the briefing, the 09-23 phase gate closes requirement ids.

## Known Stubs

None. Every meta line, the disclosure status and every link are wired to shipped data.

## Notes for later plans

- Tool routes: `<DisclosureStatus profile={...} usingSample={formHoldsUneditedSample && !isProfileComplete(profile, 'ad-inline')} />`.
- Put `<InputFairHousingNote text={value} id="x-fh" />` under each free-text input, with `aria-describedby="x-fh"` on the input.
- `<CharacterCount length={t.length} limit={2200} text="..." overText="..." />`.
- The hub counts drafts by artifact `feature`: 09-15 / 09-17 / 09-21 must save with `studio-listing` / `studio-social` / `studio-reel` (see `STUDIO_DRAFT_FEATURES`) for the hub counts to move.

## Self-Check: PASSED
