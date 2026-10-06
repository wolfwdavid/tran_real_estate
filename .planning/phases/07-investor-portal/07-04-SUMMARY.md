---
phase: 07-investor-portal
plan: 04
subsystem: ai-layer
tags: [post-check, generation-panel, findings, artifacts, fixture-provider]
requires:
  - Phase 5 GenerationPanel / panel-controller (PostCheck, runChecks, computeGate)
  - Phase 5 artifact repo (05-11) + Phase 6 subjectId/listBySubject/countBySubject (06-06)
provides:
  - createPostCheck(spec) -> Phase 5 bare PostCheck; CheckGroupCopy; groupFindings; markMember; groupCopyFor; FAIR_HOUSING_CHECKER
  - GenerationPanel props checkGroups / artifactMeta + read-only bindables artifactId / draftText
  - FindingsSummary / FairHousingText / FindingPopover / FindingDetails checkGroups prop; FindingsSummary onEdit
  - AiArtifact.meta + ArtifactRepo.deleteBySubjectId
  - PromptDef.sample -> BuiltPrompt.fixtureText -> LlmRequest.fixtureText -> Fixture provider
affects: [07-17, 07-19, phase-9 studio]
tech-stack:
  added: []
  patterns:
    - "Post-checks are bare (text) => Finding[] functions; labels baked into FindingMember; UI grouping is presentational copy only"
key-files:
  created:
    - apps/web/src/lib/ai/ui/post-check.ts
    - apps/web/src/lib/ai/ui/post-check.test.ts
    - apps/web/src/lib/ai/ui/post-check.fixtures.ts
  modified:
    - apps/web/src/lib/ai/storage/artifacts.ts
    - apps/web/src/lib/ai/storage/tables.ts
    - apps/web/src/lib/ai/storage/artifacts.test.ts
    - apps/web/src/lib/ai/ui/panel-state.svelte.ts
    - apps/web/src/lib/ai/ui/panel-state.test.ts
    - apps/web/src/lib/ai/ui/GenerationPanel.svelte
    - apps/web/src/lib/ai/ui/GenerationPanel.test.ts
    - apps/web/src/lib/ai/ui/FindingsSummary.svelte
    - apps/web/src/lib/ai/ui/FairHousingText.svelte
    - apps/web/src/lib/ai/ui/FindingPopover.svelte
    - apps/web/src/lib/ai/ui/FindingDetails.svelte
    - apps/web/src/lib/ai/ui/fair-housing-ui.test.ts
    - apps/web/src/lib/ai/ui/draft-history.test.ts
    - apps/web/src/lib/ai/ui/settings-ai.browser.test.ts
    - apps/web/src/lib/ai/prompts/types.ts
    - apps/web/src/lib/ai/prompts/registry.ts
    - apps/web/src/lib/ai/prompts/registry.test.ts
    - apps/web/src/lib/ai/ports.ts
    - apps/web/src/lib/ai/runner.ts
    - apps/web/src/lib/ai/runner.test.ts
    - apps/web/src/lib/ai/providers/fixture.ts
    - apps/web/src/lib/ai/providers/fixture.test.ts
decisions:
  - "Post-checks plug into Phase 5's postChecks prop as bare functions; panel-controller.ts and its test are byte-identical (git diff clean)"
  - "Group severity for a merged finding = highest severity among that group's own members; unlisted checkers stay in the Fair Housing group"
  - "Popover/summary hide the automatic fix only when the member has no alternative AND its group sets allowRemovePhrase false; 'Edit it myself' becomes primary (and the focus target)"
  - "deleteBySubjectId / list / count by subject use filter scans (subjectId not indexed, no Dexie version bump); acceptable for the small per-browser drafts table"
  - "fixtureText is not hashed (inputHash stays over system + user) and only spread into requests when defined; live adapters build bodies from named fields so it is never sent"
metrics:
  duration: ~35m
  completed: 2026-10-05
  tasks: 3
  files: 25
---

# Phase 7 Plan 04: Phase 5 AI-layer seams for investor memos Summary

Post-check factory returning Phase 5's bare `PostCheck`, grouped findings UI driven by presentational `checkGroups` copy, read-only `artifactId`/`draftText` bindables, deal-scoped artifact `meta` + `deleteBySubjectId`, and prompt-supplied `sample` text streamed by the Fixture provider. All additive; Phase 5 contracts unchanged.

Advances requirement **INV-06** (memo numeric post-check gating seam). Not marked complete: INV-* stay open until the 07-21 gate.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Post-check factory, grouping, subject-scoped artifacts | 806d1aa (RED), ba46ed5 (GREEN) |
| 2 | Panel checkGroups / artifactMeta / read-only bindables, grouped FindingsSummary, post-check marks + popover | 1a5a480 |
| 3 | Prompt sample text for the Fixture provider | 0fb544e (RED), d9e77d5 (GREEN) |

## What was built

- `post-check.ts`: `createPostCheck(spec)` -> `(text) => mergeFindings(members, text)` with every member fully populated (scope 'other', alternative/source default ''), empty ranges dropped. `groupFindings` (Fair Housing first, then each group in prop order, always present), `markMember` (highest severity, ties prefer Fair Housing, then member order), `groupCopyFor`, `FAIR_HOUSING_CHECKER`. `PostCheck` is a type-only re-export from `panel-controller`.
- Proven against the unchanged controller: `runChecks`/`computeGate` gate all three exits on a post-check block; FH + numbers add up; warn post-check needs the acknowledgement and `nextAck` resets on phrase-set change.
- Artifacts: optional `meta` (<= 16 keys, string values <= 200 chars, copied, absent unless given; rejects with `artifact-meta`), `deleteBySubjectId(subjectId, at)` tombstones live rows in any feature in one rw transaction, returns the count, leaves earlier tombstones, other subjects and subject-less rows untouched. Backup export/import round-trips `subjectId` + `meta`; older rows import cleanly.
- `PanelState`: `checkGroups`, `artifactMeta` deps; done/stopped/opened announcements are `findingsSentence(FH counts)` + each group's `doneSentence` (byte-identical to Phase 5 with no groups). `meta` passed to `repo.create` only when defined.
- `GenerationPanel`: props `checkGroups = []`, `artifactMeta`, read-only `artifactId = $bindable(null)`, `draftText = $bindable('')`, mirrored by the existing `$effect`. No new callback, no `onstatechange`, no `PanelGateState`, no fetch.
- `FindingsSummary`: grouped sections (FH title from FH-only counts, keeps `${idPrefix}-findings-title`; each group's `passedTitle`/`passedNote` or `findingsTitle(b, w)`); post-check rows with no fix show Show in draft + Edit it myself (new optional `onEdit`, wired to the panel's `onEditFinding`). Acknowledgement logic unchanged (global counts).
- `FairHousingText`: hidden prefix from `markMember` -> `${label}, must fix: ` / `${label}, review: ` for grouped checkers; Phase 5 prefixes otherwise; same visual treatment.
- `FindingDetails` (popover body): no "Suggested fix" row for no-fix members, "Based on" omitted when `source === ''`, "Edit it myself" primary with `data-finding-apply` when no automatic action.
- `DraftHistory` subjectId filter: already shipped by 06-06 (uses `listBySubject`/`countBySubject`); verified, no change.
- `PromptDef.sample?`, `BuiltPrompt.fixtureText?`, `LlmRequest.fixtureText?`; runner copies it; Fixture provider streams a non-empty `fixtureText` word by word (abort keeps a strict prefix).

## Verification

- `corepack pnpm vitest run --project web apps/web/src/lib/ai apps/web/src/lib/features/renter/outreach`: 27 files, 561 tests green (before Task 3; Task 3 suite 187/187 incl. all adapters).
- `--project web-browser` ai + renter: 9 files, 45 tests green.
- `corepack pnpm test:unit`: 3512 pass; only `precommit.test.ts` failed (known HEAD-moved-mid-run flake from parallel executors) and passed 10/10 on re-run.
- `corepack pnpm check` 0 errors; `corepack pnpm lint` clean; `banned` and `ui:guard` pass.
- `grep -c "export type PostCheck = (text: string) => Finding\[\]" panel-controller.ts` = 1; `git diff --exit-code` on panel-controller.ts/.test.ts clean; `grep -rcE "onstatechange|PanelGateState" apps/web/src/lib/ai` = 0 in every file.
- `grep fixtureText` in anthropic/openai/gemini/openrouter/http adapters: none.
- Not run: `build:root` + Playwright `ai-drafting` E2E (left to the orchestrator's post-wave run while other wave-1 executors are changing the tree).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `AiArtifact` type lives in `storage/tables.ts`**
- `meta` added to the interface there (not listed in the plan's files).

**2. [Rule 3 - Blocking] Test fakes of `ArtifactRepo` needed the new method**
- Added `deleteBySubjectId` to fakes in `draft-history.test.ts`, `panel-state.test.ts`, `settings-ai.browser.test.ts` so `satisfies ArtifactRepo` / type-check stays green.

**3. [Rule 2 - Missing functionality] FindingsSummary had no "Edit it myself" callback**
- Added optional `onEdit` prop; GenerationPanel passes its existing `onEditFinding`.

**4. Popover body lives in `FindingDetails.svelte`** (Phase 5 split it out of `FindingPopover`); variants implemented there, `FindingPopover` just forwards `checkGroups`.

**5. Shared test fixture** `post-check.fixtures.ts` (numbersStub + numbersCopy) used by panel-state, GenerationPanel and fair-housing-ui tests.

**6. SSR assertion adjusted**: "Category: Number not in your analysis" is popover content (closed in SSR), so the panel SSR test asserts the row label and the popover wording is asserted on `FindingDetails` directly.

Task 2 tests and implementation landed in one commit (plan specified a single feat commit for the task).

## Known Stubs

None.

## Self-Check: PASSED
