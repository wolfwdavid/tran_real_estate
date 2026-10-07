---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 16
subsystem: agent-profile-ui
tags: [agent, profile, disclosure, svelte5, indexeddb, playwright, axe, can-spam]

# Dependency graph
requires:
  - phase: 08-08
    provides: "@tran/core/disclosure composeDisclosure({ placeholders }), ruleFor, PROFILE_FIELD_LABELS"
  - phase: 08-10
    provides: "NativeSelect, Phase 3 announce() and SectionError"
  - phase: 08-11
    provides: "(app)/agent layout + AgentNav, /agent/profile/ route skeleton"
  - phase: 08-12
    provides: "profile-repo getProfile/saveProfile, live.svelte useProfile()"
provides:
  - "apps/web/src/lib/features/agent/profile/profile-form: FIELD_ORDER, FieldId, validateProfile, normalizeWebsite, isDirty, toProfileInput (+36 unit tests)"
  - "ProfileForm.svelte: Your details + Mailing address fieldsets, validation/focus, Save profile row, status line, SectionError on storage failure; props { initial, onchange?, extraFieldsets? }"
  - "DisclosurePreview.svelte: live composer lines with placeholders, state rule note, 'Incomplete: add your ...', NY title warning"
  - "/agent/profile/ page: live profile from IndexedDB, 640px form column + sticky 352px preview aside (lg)"
  - "tests/e2e/agent-profile.spec.ts: 5 tests on root and sub"
affects: [08-22 logo + brand colors (extraFieldsets, BrandPreview above DisclosurePreview), 08-24 share link builder, 08-26 AGT gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live view created in onMount into $state.raw (prerender-safe); the form adopts a changing `initial` as its dirty baseline and replaces the draft only while untouched ($effect + untrack)"
    - "Reusable field snippet: Label + optional helper + Input (one-way value + oninput) + Phase 3 field error, ids profile-{fieldId}, focus-first-invalid via querySelector"
    - "Enter-does-not-submit enforced on the inputs (onkeydown preventDefault), not on the <form> (a11y_no_noninteractive_element_interactions)"

key-files:
  created:
    - apps/web/src/lib/features/agent/profile/ProfileForm.svelte
    - apps/web/src/lib/features/agent/profile/DisclosurePreview.svelte
    - apps/web/tests/e2e/agent-profile.spec.ts
  modified:
    - apps/web/src/lib/features/agent/profile/profile-form.ts
    - apps/web/src/lib/features/agent/profile/profile-form.test.ts
    - apps/web/src/routes/(app)/agent/profile/+page.svelte

key-decisions:
  - "IABS helper reworded to 'Texas agents: link to your IABS form from TREC. It goes under your disclosure.' because the plan's literal helper contained the banned phrase 'Brokerage Services' (the IABS form title is rendered only by the core composer, outside the banned-terms scope)"
  - "'Saved.' is session state (savedOnce): after a reload the status line is empty until the next save; 'You have unsaved changes.' comes from isDirty against the stored copy"
  - "After a successful save the draft is replaced by the stored (cleanText-normalized) copy so the status line stays 'Saved.' even when the typed text had stray whitespace"
  - "Website and IABS link are normalized (https:// prefix) only after validation passes, so an invalid value is never rewritten under the agent"
  - "requirements mark-complete not run for AGT-01 (Phase 8 convention: AGT ids close at the 08-26 gate)"

patterns-established:
  - "Form-with-live-preview: form owns the draft, reports $state.snapshot(draft) via onchange, page holds it in $state.raw and passes it to pure-core-driven previews"
  - "extraFieldsets snippet slot lets a later plan add <fieldset> panels inside the same <form> without touching the save row"

requirements-completed: []  # AGT-01 advanced (details + disclosure); closes at the 08-26 gate with 08-22/08-24

# Metrics
duration: ~55min active (Task 1 09:55-09:58; Task 2 resumed 20:10-20:57 after a stalled executor)
completed: 2026-10-06
---

# Phase 8 Plan 16: Agent profile details with live disclosure preview Summary

**The /agent/profile/ page saves name, brokerage, team, license type/number/state, brokerage license and phone, phone, email, website, Texas IABS link and a postal address to IndexedDB, and shows the exact brokerage-first disclosure line the core composer appends, with the state rule named and missing items bracketed.**

## Performance

- **Duration:** ~55 min active across two executors (the first stalled on the machine's clock-skew Node crash after writing DisclosurePreview; this run finished Task 2 on a single pinned core)
- **Started:** 2026-10-06T13:55:26Z (Task 1 RED commit)
- **Completed:** 2026-10-07T00:56:42Z (Task 2 commit)
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- `ProfileForm.svelte`: one `<form novalidate>` with "Your details" (12 fields incl. the amendment fields Team name, License type, Brokerage license number, Brokerage phone, Texas IABS link) and "Mailing address" (CAN-SPAM helper, City/State/ZIP three columns from 640px); Phase 3 error pattern with focus to the first invalid field in DOM order; sticky Save profile row with "Saving…", "Saved." / "You have unsaved changes."; `announce('Profile saved.')`; focus stays on the button; SectionError "Your profile wasn't saved" on storage failure; `extraFieldsets` slot for 08-22.
- `DisclosurePreview.svelte`: `composeDisclosure(profile, 'email', { placeholders: true })` lines as `<p>`, "{State} rule included." or the generic-format note, the not-legal-advice note, "Incomplete: add your {items}." with `TriangleAlert`, and the NY sales-associate warning.
- Route page: `useProfile()` live view (EMPTY_PROFILE_INPUT until loaded), lead copy verbatim, two-column grid from 1024px with the preview sticky at `top: 24px`.
- E2E (10/10 on root + sub): TX line `Example Realty · Sample Agent, Real Estate Salesperson · Lic. #SAMPLE-0001 (TX) · (555) 555-0100` + CPN line + "Texas rule included.", save, reload persistence; NY "Licensed Real Estate Salesperson", cleared brokerage phone -> "Incomplete: add your brokerage phone." + `[Brokerage phone]`, sales-associate warning; invalid ZIP error + focus + `aria-invalid`; dirty state + Enter in a text field does not submit; axe clean and no horizontal scroll at 1280 (with a field error shown) and 375.

## Task Commits

1. **Task 1: Profile form validation and normalization (TDD)** - `75bc804` (test, RED), `af45e28` (feat, GREEN)
2. **Task 2: ProfileForm, DisclosurePreview, profile route, details E2E** - `d6f868b` (feat)

**Plan metadata:** see the docs commit that adds this file.

## Files Created/Modified
- `apps/web/src/lib/features/agent/profile/profile-form.ts` - FIELD_ORDER, validateProfile, normalizeWebsite, isDirty, and (Task 2) `toProfileInput` which turns a saved AgentProfile into a fresh plain ProfileInput (Syncable fields dropped, nested objects copied)
- `apps/web/src/lib/features/agent/profile/profile-form.test.ts` - 36 unit tests incl. toProfileInput
- `apps/web/src/lib/features/agent/profile/ProfileForm.svelte` - the form (see Accomplishments)
- `apps/web/src/lib/features/agent/profile/DisclosurePreview.svelte` - the live preview
- `apps/web/src/routes/(app)/agent/profile/+page.svelte` - skeleton rewritten into the real page
- `apps/web/tests/e2e/agent-profile.spec.ts` - details-part E2E

## Decisions Made
- See `key-decisions` in the frontmatter. The main one: the IABS helper copy had to be reworded because the plan's literal text would have failed the banned-terms gate the same plan requires.
- Field ids are `profile-{FieldId}` so `validateProfile().firstInvalid` maps straight to the DOM element (the two NativeSelects expose no ref).
- The status line is plain text (not a live region); screen-reader feedback is the single `announce()` call, per UI-SPEC "Profile saved.".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] IABS helper copy contained a banned term**
- **Found during:** Task 2 (ProfileForm copy)
- **Issue:** The plan's helper "Texas agents: link to your Information About Brokerage Services form." matches the `brokerage services` rule in `scripts/lib/banned-terms-rules.mjs` (case-insensitive, scoped to `features/agent`), so `pnpm banned` would fail; the same plan's acceptance criteria require the phrase count to be 0.
- **Fix:** Helper reads "Texas agents: link to your IABS form from TREC. It goes under your disclosure." The form title itself still appears in the composed preview line, rendered by the core composer for TX.
- **Files modified:** apps/web/src/lib/features/agent/profile/ProfileForm.svelte
- **Verification:** `pnpm banned` passed (304 files); `grep -ci "brokerage services" profile/*.svelte` = 0
- **Committed in:** d6f868b

**2. [Rule 1 - Bug] Enter guard moved off the `<form>`**
- **Found during:** Task 2 (svelte-check)
- **Issue:** A `keydown` listener on `<form>` raised `a11y_no_noninteractive_element_interactions`.
- **Fix:** `onkeydown` with `preventDefault` on Enter is attached to each text `Input` through the field snippet. E2E "dirty state and Enter in a text field" proves Enter does not submit.
- **Committed in:** d6f868b

**3. [Rule 2] `toProfileInput` helper (added by the first executor, kept)**
- The page and the form need a plain, unfrozen ProfileInput from a saved AgentProfile (Syncable fields dropped) because `$state` cannot proxy the frozen `EMPTY_PROFILE_INPUT` and the repo rebuilds only known fields. Covered by a unit test.

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug, 1 missing helper)
**Impact on plan:** Copy wording only; no scope change.

## Issues Encountered
- The machine's performance counter runs backwards across cores since a sleep/resume, so every Node process crashes with `Assertion failed: new_time >= loop->time` unless pinned to one core. All Node commands in this run went through the single-core wrapper (check ~40 s, each build ~25 s, Playwright 24 s for 10 tests).
- The wrapper's cmd layer rejects literal `(app)` paths; Prettier was pointed at the glob `apps/web/src/routes/*/agent/profile/*.svelte`.

## Verification
- `vitest run --project web src/lib/features/agent/profile`: 36 passed.
- `pnpm check`: svelte-check 2434 files, 0 errors, 0 warnings; core/scripts tsc clean.
- `pnpm lint`: prettier + eslint clean. `pnpm banned`: passed.
- `pnpm build:root` and `pnpm build:sub`: both built.
- `playwright test agent-profile --workers=1`: 10 passed (5 root, 5 sub).
- Acceptance greps: all ProfileForm / DisclosurePreview / spec strings present; "brokerage services" count 0.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None. Logo, brand colors and the inquiry share builder are deliberately absent (plans 08-22 and 08-24 extend this page).

## Next Phase Readiness
- 08-22 can add Logo and Brand colors fieldsets through `ProfileForm`'s `extraFieldsets` snippet and place `BrandPreview` above `DisclosurePreview` in the aside; the draft it needs is already reported through `onchange`.
- 08-24 adds the inquiry page section below the form (outside the `<form>`).
- AGT-01 stays open until the 08-26 gate per the Phase 8 convention.

---
*Phase: 08-agent-portal-profile-lead-intake-crm*
*Completed: 2026-10-06*

## Self-Check: PASSED

All six plan files and the SUMMARY exist on disk; commits 75bc804, af45e28 and d6f868b are in `git log`.
