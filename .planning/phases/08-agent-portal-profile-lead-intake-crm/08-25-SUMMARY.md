---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 25
subsystem: agent-followup
tags: [ai, follow-up, can-spam, disclosure, generation-panel, fair-housing, prompt-registry, fixture-provider, playwright, axe]

# Dependency graph
requires:
  - phase: 05
    provides: GenerationPanel (emailFooter, tokens, exitDisabled, onExit, beforeGenerate, subjectId), panel-controller exitPayload/displayText, prompt registry registerPrompt/getPrompt, FIXTURE_OUTPUTS, DraftHistory (subjectId filter), redactPii/restorePii
  - phase: 08-08
    provides: composeEmailFooter, missingForDrafts, OPT_OUT_LINE, AD_IDENTIFICATION_LINE, PROFILE_FIELD_LABELS, formatPostal
  - phase: 08-12
    provides: markFollowupSent, useProfile
  - phase: 08-16
    provides: SAMPLE_AGENT_PROFILE (via @tran/core/agent/fixtures/sample-profile), profile route the prerequisite links to
  - phase: 08-23
    provides: contact route with the <section id="follow-up"> slot, afterNavigate id handling
provides:
  - "features/agent/followup/followup-prompt.ts: agent/followup v1 PromptDef (FOLLOWUP_PROMPT_ID, FOLLOWUP_FEATURE, FollowupInputs), registered on import"
  - "features/agent/followup/followup-compose.ts: followupState({ contact, profile }) -> opted-out | profile-incomplete | ready { usingSampleProfile, emailFooter, tokens, exitDisabled }, SUBJECT_DEFAULTS, PURPOSES, validateSubject, buildFollowupInputs, FOOTER_LABEL, MAX_SUBJECT, MAX_POINTS"
  - "features/agent/followup/FollowUpComposer.svelte { contact, profile }: Purpose / Email subject / Points + GenerationPanel + per-contact DraftHistory"
  - "FIXTURE_OUTPUTS['agent/followup@1'] keyless sample draft"
  - "tests/e2e/agent-followup.spec.ts (10 tests x 2 bases)"
affects: [08-26 AGT gate (AGT-06, AGT-01 draft half), Phase 9 studio drafts reuse the footer/disclosure pattern]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Portal prompt registered from the feature module (idempotent guard) instead of editing the Phase 5 registry file"
    - "Deterministic CAN-SPAM footer passed as GenerationPanel emailFooter: never in the prompt, appended to every exit payload"
    - "Subject validation through GenerationPanel beforeGenerate; field error + focus, no run"

key-files:
  created:
    - apps/web/src/lib/features/agent/followup/followup-prompt.ts
    - apps/web/src/lib/features/agent/followup/followup-compose.ts
    - apps/web/src/lib/features/agent/followup/followup-compose.test.ts
    - apps/web/src/lib/features/agent/followup/FollowUpComposer.svelte
    - apps/web/tests/e2e/agent-followup.spec.ts
  modified:
    - apps/web/src/lib/ai/providers/fixture-outputs.ts
    - apps/web/src/routes/(app)/agent/contact/+page.svelte

key-decisions:
  - "08-25: the 'They aren't sent to {Provider}' line lives in FollowUpComposer above the panel (GenerationPanel has no slot inside What will be sent); followupState therefore takes { contact, profile } only, and the label is the chosen live provider from aiPrefs or 'your AI provider' while the keyless sample is in use"
  - "08-25: no Phase 5 prop was missing; subject validation uses beforeGenerate and Draft history is filtered to the contact with subjectId (DraftHistory supports it, no gap)"
  - "08-25: the panel's footer preview is Phase 5's single muted '<label>: <text>' paragraph, not the UI-SPEC pre-wrap surface block; left unchanged because it is a Phase 5 file outside files_modified (text and payloads are correct)"
  - "08-25: prompt id follows the plan ('agent/followup', fixture key agent/followup@1), not the UI-SPEC's 'agent/followup.v1'"
  - "08-25: missing profile items are lower-cased PROFILE_FIELD_LABELS joined with Intl.ListFormat ('Missing: license number and mailing address.'); the state also returns missingText"
  - "08-25: the contact page renders the composer only after useProfile() has loaded (Checking this browser... until then), keyed by contact id, so a real contact never flashes the prerequisite block and a same-route navigation starts a fresh form"

patterns-established:
  - "Follow-up exits: draft + '\\n\\n' + footer in Copy, mailto body (CRLF per RFC 6068) and Mark as sent"

requirements-completed: [AGT-06]  # advanced here; left open in REQUIREMENTS.md until the 08-26 gate (Phase 8 convention)

# Metrics
duration: 37 min
completed: 2026-10-07
---

# Phase 8 Plan 25: AI follow-up email drafts Summary

**Contact pages now draft follow-up emails through Phase 5's GenerationPanel with the `agent/followup` v1 prompt (Fixture provider when keyless). The agent's signature, mailing address, the "Reply STOP or unsubscribe…" line, the state disclosure and, for contacts without inquiry-form consent, the solicitation line are appended in the browser. That footer reaches all three exits and never the provider. Opted-out contacts get no panel, an incomplete profile blocks real contacts (sample contacts use the sample agent profile), and no-email contacts lose only Open in email app. Mark as sent logs "Follow-up email marked as sent" and updates last contact. Playwright proves it on both bases.**

## Performance

- **Duration:** 37 min of active work in two stages: implementation and unit tests first, then builds and E2E once the shared build directory was free. Waiting time between the stages is not counted.
- **Started:** 2026-10-07T03:18:00Z
- **Completed:** 2026-10-07T04:10:00Z
- **Tasks:** 3 of 3
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- **Prompt (`agent/followup` v1):** the plan's system prompt (keep `{client_first_name}`, no subject, signature, contact details, address, unsubscribe or license text, no invented facts or urgency). The user block holds purpose, subject, stage label, property, days since contact, notes and points. Name, first name, email and phone are declared PII (empty values dropped), so the registry's redactPii turns them, and any stray email or phone in the notes, into tokens. The prompt registers itself on import, with a guard against the registry's duplicate throw.
- **Fixture output** `agent/followup@1`: passes checkFairHousing with zero findings and has no signature block. Phase 5's fixture lint stays green.
- **followupState:** opt-out first, then the profile gate (sample contacts fall back to SAMPLE_AGENT_PROFILE), then ready. Ready includes `emailFooter = { text: composeEmailFooter(...).text, label: 'Added to the end of every follow-up' }`, `tokens = { client_first_name, client_name }` and `exitDisabled.email` when the contact has no email.
- **FollowUpComposer:** a Purpose NativeSelect (defaults from the stage); Email subject (required, max 120, follows Purpose until edited, validated through `beforeGenerate` with an error and focus); Points (max 500, min-height 160px, helper); the sample-profile line with SampleChip and a Set up your profile link; the "not sent to {Provider}" line; GenerationPanel (`Follow-up draft`, h3, `Draft follow-up email`, containsClientData, mailto to/subject, `subjectId={contact.id}`, `onExit` → `markFollowupSent` on marked-sent); and DraftHistory filtered to the contact. The prerequisite is an info Alert (`role={null}`) with an h3, the missing list and an outline **Finish your profile** link.
- **Contact route:** the composer sits under the existing h2 in `#follow-up`, waits for `useProfile()` to load and is keyed by contact id.

## Task Commits

1. **Task 1 (RED): failing follow-up compose tests** - `e315fda` (test)
2. **Task 1 (GREEN): follow-up prompt and CAN-SPAM compose module** - `95f3fe7` (feat)
3. **Task 2: AI follow-up composer with CAN-SPAM footer** - `c3725ee` (feat)
4. **Task 3: follow-up drafts E2E** - `d00eec4` (test)

**Plan metadata:** the docs(08-25) commit that follows.

## Files Created/Modified

- `apps/web/src/lib/features/agent/followup/followup-prompt.ts`: the prompt definition and its registration
- `apps/web/src/lib/features/agent/followup/followup-compose.ts`: gates, footer, tokens, subject defaults and validation, inputs builder
- `apps/web/src/lib/features/agent/followup/followup-compose.test.ts`: 18 unit tests
- `apps/web/src/lib/features/agent/followup/FollowUpComposer.svelte`: the composer
- `apps/web/src/lib/ai/providers/fixture-outputs.ts`: one new entry, `agent/followup@1`
- `apps/web/src/routes/(app)/agent/contact/+page.svelte`: mounts the composer
- `apps/web/tests/e2e/agent-followup.spec.ts`: the spec

## Verification

Every Node command ran through the single-core wrapper on mask 0x100, and Playwright ran with `--workers=1`.

- vitest `--project web src/lib/features/agent/followup src/lib/ai`: 28 files, 575/575, including Phase 5's three-exits and fixture Fair Housing lint. The followup suite alone is 18/18.
- `pnpm check`: 0 errors and 0 warnings. `pnpm lint` (Prettier and eslint, repo-wide) is clean, and `pnpm banned` passed (342 files).
- `build:root` and `build:sub` both succeeded.
- Playwright `agent-followup`: **20/20 (10 root + 10 sub)**. The AI-host record and the RentCast tripwire were empty in every test.
- Regression `agent-contact.spec` (the route changed): **22/22 (11 root + 11 sub)**.
- `vitest --project scripts agent-boundary`: 4/5. The failure predates this plan (see Deferred Issues). The 08-26 gate owns that test.
- All acceptance greps are met, and `sms:` appears 0 times in FollowUpComposer. `apps/web/test-results/` was removed.

## Decisions Made

See key-decisions in the frontmatter. In short: where the provider line lives and the narrower followupState signature; no Phase 5 prop gaps, with DraftHistory filtered by subjectId; the Phase 5 footer preview styling left alone; the plan's prompt id; lower-cased missing labels joined into a phrase; and the composer waiting for the profile and keyed by contact.

## Deviations from Plan

### Auto-fixed / adjusted

**1. [Rule 3 - Blocking] Provider line moved into the component; `providerLabel` dropped from followupState**
- **Found during:** Task 2
- **Issue:** The plan's signature takes `providerLabel`, but its acceptance grep requires `They aren't sent to` inside FollowUpComposer.svelte. GenerationPanel also has no slot inside "What will be sent".
- **Fix:** The line is rendered in the composer just above the panel. followupState takes `{ contact, profile }`. The label is `PROVIDER_LABELS[aiPrefs.provider]` for a live provider, otherwise "your AI provider", because the sample provider sends nothing.
- **Commit:** `c3725ee`

**2. Phase 5 props: no deviation needed**
- `emailFooter`, `tokens`, `exitDisabled`, `onExit`, `beforeGenerate` and `subjectId` all exist. Subject validation uses `beforeGenerate`. DraftHistory supports `subjectId`, so the history is filtered to this contact and nothing needed recording as a gap.

**3. Footer preview styling is Phase 5's (not changed)**
- GenerationPanel renders the footer as one muted `<p>{label}: {text}</p>`, not the UI-SPEC's surface-filled pre-wrap block. The text and every exit payload are correct. A restyle belongs to a Phase 5 follow-up because the file is outside this plan's files_modified.

**4. Prompt id per the plan, not the UI-SPEC**
- `promptId="agent/followup"` (fixture key `agent/followup@1`), as the plan's interfaces specify. The UI-SPEC's `agent/followup.v1` was not used.

**5. Missing items as a lower-cased phrase**
- `missing` holds lower-cased `PROFILE_FIELD_LABELS`, and `missingText` joins them with `Intl.ListFormat`. The body reads "Missing: full name, brokerage, ... and email."

**6. [Rule 1 - Bug] Composer waits for the profile and is keyed by contact**
- **Issue:** Before the profile live query loads, `profile.current` is null, which would flash the prerequisite block for every real contact. The 08-23 same-route navigation would also keep the previous contact's subject and points.
- **Fix:** `{#if profile.loaded}{#key c.id}<FollowUpComposer …/>{/key}{:else}Checking this browser…{/if}`.
- **Commit:** `c3725ee`

**E2E adjustments in my own spec (Task 3, `d00eec4`):** the mailto body uses CRLF line breaks (RFC 6068, Phase 5 `buildMailto`), and the Windows clipboard returns CRLF too. Both are normalized before comparing with the footer. The spec also asserts that the raw mailto body contains CRLF. The "Marked as sent on …" locator is not anchored because the status line's text begins with whitespace.

---

**Total deviations:** 6 recorded (1 blocking, 1 bug, 4 documentation-only). **Impact:** none of them changes behavior beyond the plan, and there was no scope creep.

## Deferred Issues

- `scripts/agent-boundary.test.ts` "never reach lib/data" was already failing. The path is `features/agent/samples/samples.ts` (08-15) → `lib/storage/db.ts` → `$lib/data/tables`, which every agent repo has shared since 08-12. This plan adds no new path. It is logged in `deferred-items.md`, and the 08-26 gate owns the fix.

## Issues Encountered

- The machine needs every Node process pinned to one core (wrapper mask 0x100). The two stages exist because the Vite build output is shared with 08-24's executor.

## Known Stubs

None. The 08-23 `#follow-up` stub is now filled.

## Requirements

`requirements-completed` copies the plan's `[AGT-06]`. This plan also covers the "appended to every generated draft" half of AGT-01. Per the Phase 8 convention, `requirements mark-complete` was **not** run, so AGT ids stay open until the 08-26 gate.

## User Setup Required

None. Drafting works keyless with the Fixture provider. With the agent's own AI key, the same panel uses their provider.

## Next Phase Readiness

- 08-26 can verify AGT-06 from `agent-followup.spec.ts` and the compose unit tests. It also owns the agent-boundary fix.
- No blockers.

---
*Phase: 08-agent-portal-profile-lead-intake-crm*
*Completed: 2026-10-07*

## Self-Check: PASSED

All 7 plan files and this SUMMARY exist on disk; commits e315fda, 95f3fe7, c3725ee and d00eec4 are in `git log`.
