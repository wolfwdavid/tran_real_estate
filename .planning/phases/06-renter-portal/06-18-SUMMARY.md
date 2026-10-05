---
phase: 06-renter-portal
plan: 18
subsystem: renter-outreach
tags: [renter, outreach, ai, fair-housing, generation-panel, draft-history, e2e, tdd, a11y]
requires:
  - "06-06 renter/outreach.v1 prompt, buildOutreachInputs, RenterOutreachForm/Listing types, subjectId on artifacts + DraftHistory"
  - "06-14 OutreachSection stub ({ row, provenance }), listing/address.ts streetLine"
  - "06-03 @tran/core/renter/contact-links mailtoHref"
  - "06-09 renter E2E harness (net fixture, mockRentCast, withRentCastKey, rentcastFixtures)"
  - "Phase 5 GenerationPanel contract, DraftHistory, Fixture provider, tests/e2e/helpers/ai-mocks.ts"
provides:
  - "features/renter/outreach/outreach-form.ts: validateOutreachForm, newOutreachForm, DEFAULT_OUTREACH_FORM, OCCUPANTS_ERROR, TOPICS_ERROR, OutreachValidation"
  - "features/renter/outreach/OutreachForm.svelte (bindable form, instance export validate())"
  - "features/renter/outreach/OutreachSection.svelte (form + GenerationPanel + per-listing DraftHistory)"
  - "GenerationPanel optional prop beforeGenerate?: () => boolean (additive; Phase 7-9 hosts may use it)"
  - "tests/e2e/renter-outreach.spec.ts"
affects: [06-22 gate (RENT-07 evidence), phases 7-9 generators (beforeGenerate hook available)]
tech-stack:
  added: []
  patterns:
    - "Host-form validation before a GenerationPanel run: pass beforeGenerate={() => formRef.validate()}; Stop is never gated"
    - "E2E AI key seeding without Settings: addInitScript writes the fake key into sessionStorage 'tran.vault.session.v1' and the provider into localStorage 'tran.ai.provider' (JSON)"
key-files:
  created:
    - apps/web/src/lib/features/renter/outreach/outreach-form.ts
    - apps/web/src/lib/features/renter/outreach/outreach-form.test.ts
    - apps/web/src/lib/features/renter/outreach/OutreachForm.svelte
    - apps/web/src/lib/features/renter/outreach/OutreachSection.browser.test.ts
    - apps/web/tests/e2e/renter-outreach.spec.ts
  modified:
    - apps/web/src/lib/features/renter/outreach/OutreachSection.svelte
    - apps/web/src/lib/ai/ui/GenerationPanel.svelte
decisions:
  - "No pre-generate hook existed in Phase 5, so GenerationPanel gains an optional beforeGenerate?: () => boolean (default: run). It is checked only on the generate press (not Stop). Additive: every Phase 5 test stays green (web 510, web-browser 22)."
  - "Recipient = the agent email if mailtoHref validates it, else the office email, else none (the no-recipient note shows and the mailto has no address)"
  - "OutreachSection also renders DraftHistory filtered by subjectId = listing id (UI-SPEC: history filtered to the current listing), with the repo loaded by dynamic import in onMount, the same wiring as Phase 5's AiDraftingSection"
  - "Field errors appear after the first Draft message press and then track edits live; focus moves to the first invalid field (people input, else the first topic checkbox)"
metrics:
  duration: 25min
  completed: 2026-10-05
---

# Phase 6 Plan 18: Renter outreach drafting Summary

The listing detail now has a working "Message the listing contact" section. The renter fills a short form (move-in date, number of people, pets, topics, an optional question). **Draft message** validates the form, then the Phase 5 GenerationPanel drafts the message from minimized inputs. The Fair Housing checker gates the exits, and the text leaves only through Copy text, a `mailto:` link to the listing contact, or a local Mark as sent. Advances **RENT-07** (left open until the 06-22 gate, per the orchestrator).

## What was built

**Task 1 (commits 1f4a0a2 RED, 5393a52 GREEN, 2647a1a)**
- `outreach-form.ts` returns `validateOutreachForm(f) → { ok: true } | { ok: false; errors; first }`. The people count must be blank or a plain whole number from 1 to 12 ("3 adults", "2.5", "1e1" and "two" are rejected). A form with no topic checked and only whitespace in the question box fails the topics check. `first` puts occupants ahead of topics. There are 17 unit tests.
- `OutreachForm.svelte` is a plain `<form>` with no submit button. It has a 48px date input, a numeric text input for the people count with the PII helper, No pets / Yes radio chips that reveal **What pets?** (maxlength 60), four 44px topic checkboxes (all checked), and a textarea (maxlength 500) with a counter set to `aria-live="off"`. Errors use the Phase 3 invalid pattern (CircleAlert, `aria-invalid`, `aria-describedby`). The `validate()` instance export shows errors and focuses the first invalid field.
- `OutreachSection.svelte` contains the h2, the intro, OutreachForm, a `border-t` divider, the no-recipient note when needed, and `GenerationPanel` (`feature="renter-outreach"`, `promptId="renter/outreach.v1"`, `title="Your message"`, `generateLabel="Draft message"`, `subjectId={row.id}`, mailto `{ to: recipient, subject: "Question about {street line}" }`, `containsClientData`, `beforeGenerate`). Below the panel is `DraftHistory` filtered to the same `subjectId`. Inputs are `buildOutreachInputs(listingFacts, $state.snapshot(form))`.
- `GenerationPanel.svelte` adds the optional `beforeGenerate` prop. That is the only change to the file.
- `OutreachSection.browser.test.ts` has 7 browser tests: the form and exactly three exits, the pets reveal and counter, both validation paths with focus and no run, the no-recipient note with a bare mailto, the office-email fallback, and a keyless sample draft whose mailto carries the subject and body. Axe runs where relevant.

**Task 2 (commit 4914b9e)**: `renter-outreach.spec.ts` has 6 tests on each base (12 runs), and all pass:
1. Keyless sample draft: the "Sample output" chip shows, the exits group has exactly 3 children, and the mailto goes to the fixture agent email with `subject=Question%20about%20…` and `body=`. The draft mentions pet, deposit and lease. No LLM host and no RentCast request were made. Axe is clean.
2. Validation: people `13` shows the error and focuses that field. Unchecking all four topics shows the topics error and focuses the first checkbox. No generation runs. Axe is clean.
3. Block gate: a seeded Anthropic key plus a mocked SSE answer containing "no kids" produces the Must fix reason. Copy and Email get `aria-disabled="true"` and the email link has no href. Axe is clean with the finding popover open. After **Remove phrase**, the exits are enabled and the href is `mailto:`. Exactly one generate request was made.
4. Gemini: the data dialog opens with focus on **Don't send to Gemini**. Choosing it sends 0 requests to `generativelanguage.googleapis.com`. Axe is clean on the dialog.
5. No recipient: a mocked live listing with every email removed is loaded with exactly 1 mocked call. The note shows, and the mailto starts `mailto:?subject=`.
6. Draft history: listing A has 1 saved draft. Listing B shows 0 and no rows. Back on A it shows 1 again.
- After every test, no request URL contains a seeded key or `key=`. The deny-all harness also proves that no unexpected external request was made.

## Verification

- `corepack pnpm vitest run --project web src/lib/features/renter/outreach`: 17/17 pass
- `corepack pnpm vitest run --project web-browser src/lib/features/renter/outreach`: 7/7 pass
- Phase 5 regression: `--project web apps/web/src/lib/ai` 510/510; `--project web-browser apps/web/src/lib/ai` 22/22
- `corepack pnpm check`: 0 errors. `banned` passed. ESLint and Prettier are clean on every file this plan touched.
- `corepack pnpm test:unit`: 3135/3136. The one failure was the known `precommit.test.ts` HEAD-moved flake, which passed 10/10 on re-run.
- Built with build:root and build:sub under the shared lock: `playwright test renter-outreach` 12/12 passed. `renter-listing` and `ai-guardrails` also passed 22/22 with the new section on the page. The lock was released.
- `grep -rn "fetch(\|navigator.clipboard\|sendBeacon" apps/web/src/lib/features/renter/outreach` returns nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a pre-generate hook to GenerationPanel**
- **Found during:** Task 1
- **Issue:** Phase 5 had no `beforeGenerate`/`canGenerate` hook, so the form could not stop a run.
- **Fix:** Added an optional `beforeGenerate?: () => boolean` prop, which the plan allowed as a fallback. It is checked only on the generate press. The change is additive and the Phase 5 suites are green.
- **Files modified:** apps/web/src/lib/ai/ui/GenerationPanel.svelte
- **Commit:** 2647a1a

**2. [Rule 2 - Missing functionality] Per-listing Draft history rendered in the section**
- **Found during:** Task 1
- **Issue:** UI-SPEC and E2E item 6 need this listing's Draft history, but the plan's composition snippet listed only the panel.
- **Fix:** OutreachSection renders `DraftHistory` with `subjectId={row.id}`, wired with `bind:savedId` / `onExit` / `openArtifact` the same way as AiDraftingSection.
- **Commit:** 2647a1a

**3. [Rule 2 - Tests] Added OutreachSection.browser.test.ts** (component tests plus axe, per the phase convention). It was not listed in the plan's files.

### Out-of-scope observations
- `corepack pnpm lint` reports Prettier warnings in sibling wave-5 files (`fair-rent/ComparablesTable.svelte`, `tests/e2e/renter-results.spec.ts`). They belong to 06-17/06-16 and were not touched here.

## Known Stubs

None. The section is wired end to end.

## Self-Check: PASSED
