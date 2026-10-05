---
phase: 06-renter-portal
plan: 06
subsystem: ai-web-pipeline
tags: [ai, prompts, renter, outreach, fair-housing, artifacts, draft-history, tdd]
requires:
  - "05-09: prompt registry (registerPrompt, getPrompt, buildPrompt), PromptDef, FIXTURE_OUTPUTS"
  - "05-11: aiArtifacts repo (createArtifactRepo, ArtifactRepo, AiArtifact in tables.ts)"
  - "05-13/05-15: GenerationPanel props contract, PanelState deps"
  - "05-14: DraftHistory"
provides:
  - "apps/web/src/lib/ai/prompts/renter/outreach.v1.ts: renterOutreachV1, buildOutreachInputs, RenterOutreachListing, RenterOutreachForm, RenterOutreachInputs, RENTER_OUTREACH_PROMPT_ID, RENTER_OUTREACH_FEATURE"
  - "FIXTURE_OUTPUTS['renter/outreach.v1@1'] (checker-clean sample draft)"
  - "AiArtifact.subjectId?: string; ArtifactInput.subjectId?; ArtifactRepo.listBySubject(feature, subjectId, {limit, offset}) / countBySubject(feature, subjectId)"
  - "PanelDeps.subjectId?; GenerationPanel prop subjectId?; DraftHistory prop subjectId?"
affects: [06-18 OutreachSection, 07-04 (subjectId/listBySubject/countBySubject already exist; 07-04 adds only meta + deleteBySubjectId), phases 8-9 generators]
tech-stack:
  added: []
  patterns:
    - "PII minimization enforced by the input type: RenterOutreachInputs has exactly six keys (expectTypeOf-locked)"
    - "Non-indexed optional field filtered in memory after the [feature+createdAt] range: no Dexie version bump"
    - "Optional fields are spread in only when defined, so Phase 5 rows keep their exact key set"
key-files:
  created:
    - apps/web/src/lib/ai/prompts/renter/outreach.v1.ts
    - apps/web/src/lib/ai/prompts/renter/outreach.v1.test.ts
  modified:
    - apps/web/src/lib/ai/prompts/registry.ts
    - apps/web/src/lib/ai/providers/fixture-outputs.ts
    - apps/web/src/lib/ai/storage/artifacts.ts
    - apps/web/src/lib/ai/storage/tables.ts
    - apps/web/src/lib/ai/storage/artifacts.test.ts
    - apps/web/src/lib/ai/ui/panel-state.svelte.ts
    - apps/web/src/lib/ai/ui/panel-state.test.ts
    - apps/web/src/lib/ai/ui/GenerationPanel.svelte
    - apps/web/src/lib/ai/ui/DraftHistory.svelte
    - apps/web/src/lib/ai/ui/draft-history.test.ts
    - apps/web/src/lib/ai/ui/settings-ai.browser.test.ts
key-decisions:
  - "Prompt registered with id 'renter/outreach.v1' (version 1), so hosts pass promptId=\"renter/outreach.v1\" as 06-18 expects; the stored/fixture promptId is therefore 'renter/outreach.v1@1'"
  - "subjectId listing uses listBySubject/countBySubject (the 07-04 signatures) instead of an options flag on listByFeature, so 07-04 only adds meta + deleteBySubjectId"
  - "subjectId validated at create(): non-empty string of at most 200 chars ('artifact-subject-id'), keeping it an opaque id rather than prompt input"
  - "No artifact Zod schema exists in Phase 5 (backup rows validate through core's looseObject SyncableSchema), so subjectId survives import without a schema change; proven by an export→preview→apply round trip test"
metrics:
  duration: ~35min
  completed: 2026-10-05
  tasks: 2
  files: 13
---

# Phase 6 Plan 06: Renter outreach prompt and per-listing draft history Summary

Adds the `renter/outreach.v1` prompt to the AI-layer registry. Its inputs can only carry an occupant count, a pet yes/no with a short description, and a redacted free-text question. A Fair-Housing-clean sample draft is keyed to it. Generation artifacts now carry an optional `subjectId`, so outreach Draft history can be filtered to the current listing.

## What was built

**Task 1: prompt (commits 25ccbae RED, b554991 GREEN)**
- `outreach.v1.ts` follows the PromptDef fields exactly as Phase 5 shipped them: `id: 'renter/outreach.v1'`, `version: 1`, `feature: 'renter-outreach'`, `housingCopy: true` (so the registry prepends `HOUSING_COPY_GUARDRAIL`), `containsClientData: true`, `maxTokens: 2048`, and `build(i) → { system, user, known }`.
- `buildOutreachInputs(listing, form)` sets `occupants` to a number only when it matches `/^\d+$/` and falls in 1..12, otherwise null. It trims `petDescription` and caps it at 60 characters, trims `extraQuestion` and caps it at 500, sets an empty move-in date to null, and copies `topics` so the form object isn't shared.
- The system text uses the plan's wording word for word (describe the home, not people; no area residents, schools or places of worship; only the occupant number; never call an assistance animal a pet; never claim the home is open; sign off with `{your_name}`).
- The user text lists the listing facts as bullets (`$2,150 a month`, bedrooms/bathrooms, type, days on market), skipping any fact that is null. It then lists only the topics that are switched on, plus the move-in date, `People who would live there: N`, `Pets: none|<desc>` and `Also ask: …`.
- `known` declares `contactName` → `{contact_name}`. `buildPrompt`'s `redactPii` also replaces any email or phone in the free text.
- The canned sample output is stored in `FIXTURE_OUTPUTS['renter/outreach.v1@1']`. It has zero `checkFairHousing` findings, contains none of the phrases "still available", "is available" or "available now", and passes `pnpm banned`. The existing fixture.test.ts loop over all outputs also covers it.

**Task 2: subjectId (commits 3712f60 RED, c8b31a1 GREEN)**
- `tables.ts`: `AiArtifact.subjectId?: string`. It isn't indexed, so there is no Dexie version change.
- `artifacts.ts`: `ArtifactInput.subjectId?`, which is checked and stored only when present. Phase 5 rows keep their exact key set. Adds `listBySubject` (newest first, tombstones excluded, 10 per page, same `[feature+createdAt]` range and an in-memory filter) and `countBySubject`.
- `panel-state.svelte.ts`: `PanelDeps.subjectId?` is passed to `repo.create` only when defined.
- `GenerationPanel.svelte`: new optional prop `subjectId`, passed through a getter in the deps.
- `DraftHistory.svelte`: new optional prop `subjectId`. When it's set, the component uses `listBySubject`/`countBySubject` (paging stays correct). Without it, the Phase 5 calls are unchanged. It reloads when the subject changes.

## Verification

- `corepack pnpm vitest run --project web apps/web/src/lib/ai`: 25 files, 510 tests pass.
- `corepack pnpm vitest run --project web-browser apps/web/src/lib/ai`: 3 files, 22 tests pass. This includes a new DraftHistory browser test (filter, subject switch reload, empty state, axe), added per the 05-14 lesson.
- Mutation check: forcing DraftHistory to ignore `subjectId` makes the new browser test fail. The original code was restored.
- `corepack pnpm check`: 0 errors. `eslint apps/web/src/lib/ai`: clean. `prettier --check apps/web/src/lib/ai`: clean. `corepack pnpm banned`: passed.
- The Phase 5 demo-panel Playwright E2E was not run, because it needs a production build while five parallel executors are editing the tree. The panel change is additive (an optional prop with an undefined default), and the GenerationPanel browser and unit suites pass. The orchestrator's post-wave gate covers E2E.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The subjectId pass-through needed panel-state.svelte.ts**
- **Found during:** Task 2
- **Issue:** GenerationPanel doesn't call `repo.create`; PanelState does. GenerationPanel also doesn't render DraftHistory (the host does).
- **Fix:** Added `PanelDeps.subjectId?` and an additive spread into `create()`. The host passes `subjectId` to both GenerationPanel and DraftHistory.
- **Files modified:** apps/web/src/lib/ai/ui/panel-state.svelte.ts (+ panel-state.test.ts)
- **Commit:** c8b31a1

**2. [Rule 3 - Blocking] Fake repos had to implement the new interface members**
- **Found during:** Task 2
- **Fix:** Added `listBySubject`/`countBySubject` to the in-test fakes in draft-history.test.ts, panel-state.test.ts and settings-ai.browser.test.ts.
- **Commit:** 3712f60

**3. [Plan premise] There is no artifact Zod schema**
- The plan assumed one in artifacts.ts. Phase 5 validates backup rows only through core's `z.looseObject` SyncableSchema, so `subjectId` is already preserved. I didn't add a schema, because nothing on the import path would use it. Instead, the export→`previewImport`→`applyImport` round-trip test proves that `subjectId` is kept and that a row without it still imports. `create()` validates the field instead.

**4. [Plan wording] The list API is `listBySubject` rather than `list({ feature, subjectId? })`**
- I matched the signatures 07-04 already plans to add (`listBySubject(feature, subjectId, o?)`, `countBySubject`), so Phase 7 doesn't add the same capability a second time.

**5. Test-data fixes during GREEN (test bugs, not behavior changes)**
- The `form()` helper shallow-copied `topics`, so one test changed the shared fixture. The helper now deep-copies `topics`.
- The redaction test's email used `casey@…`, which overlapped the contact's first name ("Casey"). redactPii correctly replaced the derived first-name part, so the email no longer matched as a whole. I changed the email local part.

## Requirements

- Advances **RENT-07** (the prompt and storage prerequisites). It is NOT marked complete; RENT-07 stays open until the 06-22 gate, as the orchestrator instructed. 06-18 does the UI wiring and E2E.

## Known Stubs

None.

## Self-Check: PASSED
