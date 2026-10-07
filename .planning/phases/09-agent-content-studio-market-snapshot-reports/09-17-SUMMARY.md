---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 17
subsystem: studio-snapshot-builder
tags: [studio, snapshot, builder, save-gate, generation-panel, rentcast-budget, e2e, axe]
requires:
  - phase: 03
    provides: "ConfirmDialog, SectionError, LiveAnnouncer"
  - phase: 04
    provides: "DataStatusBar (DataShell), ProvenanceRow, CostLabel/formatCost, requestSpend + cap prompt"
  - phase: 05
    provides: "GenerationPanel (read-only bindables), DraftHistory with subjectId, runChecks"
  - phase: 09-11
    provides: "addSnapshot (uuid ids only), listSnapshots, deleteSnapshot, createStudioAutosave('snapshot')"
  - phase: 09-12
    provides: "STUDIO_DRAFT_FEATURES (snapshot notes drafts are not hub draft counts; saves count via countSnapshots)"
  - phase: 09-13
    provides: "studio/snapshot.v1, numberPostCheck('snapshot', ...), numberWordsPostCheck"
  - phase: 09-14
    provides: "createSnapshotData(runtime), buildSnapshotRecord(ProfileInput), sample record and agent"
  - phase: 09-16
    provides: "ZipPicker, SnapshotSectionToggles, SnapshotKeyFigures, ListingsSummaryTable"
provides:
  - "features/studio/snapshot/save-gate.ts: saveGateReason, builderGateState, notesGateFields, missingLabels, CLEARED_ZIP, emptyPanelOutputs, parseChoices/choicesData/defaultInclude, spendText, notesSummary"
  - "SnapshotBuilder.svelte: the four-step builder (studio-snapshot / studio/snapshot.v1), 0-call save to /print/snapshot/?id={uuid}"
  - "SnapshotList.svelte { records, onDeleted, remove? }: Your snapshots with Open print view and Delete"
  - "/agent/studio/snapshot/ route body (builder by dynamic import after hydration)"
  - "ZipData.stale (gateway provenance flag); ZipPicker loadedProvenance(), initialZip, onCleared"
affects: [09-20, 09-22, 09-23]
tech-stack:
  added: []
  patterns:
    - "The builder's gate input is assembled in one pure function (builderGateState) used for the live reason line and for Save's click-time recheck"
    - "What a load spent: ZIP = fetchedAt at or after the click (captured by a function binding on ZipPicker's bind:busy); listings = free cost preview read by a SnapshotData wrapper just before the spend"
key-files:
  created:
    - apps/web/src/lib/features/studio/snapshot/save-gate.ts
    - apps/web/src/lib/features/studio/snapshot/save-gate.test.ts
    - apps/web/src/lib/features/studio/snapshot/SnapshotList.svelte
    - apps/web/src/lib/features/studio/snapshot/SnapshotBuilder.svelte
    - apps/web/tests/e2e/snapshot-builder.spec.ts
  modified:
    - apps/web/src/routes/(app)/agent/studio/snapshot/+page.svelte
    - apps/web/src/lib/features/studio/snapshot/snapshot-data.ts
    - apps/web/src/lib/features/studio/snapshot/ZipPicker.svelte
    - apps/web/src/lib/features/studio/snapshot/snapshot-calls.test.ts
    - apps/web/src/lib/features/studio/snapshot/snapshot-components.test.ts
key-decisions:
  - "Notes status comes from the panel's read-only bindables: no draft = none; text with no verdict (not exit-ready, no findings, since findings reset while streaming) = streaming; else ready. Review findings count only while unacknowledged"
  - "Save re-runs the checks on the current text before saving (Phase 7 memo pattern, the panel rechecks 300 ms after typing); a fresh block finding shows its reason at once"
  - "record.sample = the ZIP data is sample; the sample agent profile is frozen in only when the data is sample AND the profile is incomplete. Live data with an incomplete profile is gated with the profile reason"
  - "Narrative provider/model/sampleOutput come from the stored Phase 5 draft (artifactId); sample output stores provider and model null. The draft's text is updated and marked acknowledged before saving (best effort)"
  - "The notes panel is keyed on the report facts (ZIP, fetchedAt, listings summary), so a draft never outlives the numbers it was checked against; Choose a different ZIP unmounts it"
  - "Notes panel checkGroups: 'Number check' (numbers) and 'Numbers written as words' (number-words), so number findings do not show under the Fair Housing group"
  - "Pure builder helpers live in save-gate.ts, not the .svelte module script: Node vitest cannot resolve $app/navigation that the builder imports"
  - "Before step 1 has data, step 4's Save reason line doubles as the step's empty line (one 'Load a ZIP code's data first.', not two)"
requirements-completed: []
duration: ~2 h 10 min wall clock across two stages (Stage 2 waited for the build directory)
completed: 2026-10-07
---

# Phase 9 Plan 17: Market Snapshot builder Summary

**An agent can build a Market Snapshot end to end: choose a ZIP, choose the sections, draft market notes that are number-checked against the report, then save one frozen record (0 calls) and open `/print/snapshot/?id={uuid}`. Keyless runs on fixture data with the sample agent and makes zero requests to RentCast or any AI host. With a key, a new ZIP plus the listings summary is exactly 2 calls, and a cached reload is 0. Save is gated by the UI-SPEC reasons in priority order. A planted "$9,999" in the notes blocks Save until it is removed.**

## Performance

- **Duration:** Stage 1 about 45 minutes plus a 10-minute follow-up (onCleared). Stage 2 about 40 minutes (builds, E2E, docs). All on a single core, mask 0x200.
- **Tasks:** 2 of 2
- **Files:** 5 created, 5 modified

## Accomplishments

- **save-gate.ts**
  - `saveGateReason` checks five reasons, in this order:
    1. "Load a ZIP code's data first."
    2. "Choose at least one section with market data."
    3. "Draft the market notes, or turn them off in step 2."
    4. "Fix the {n} items marked Must fix in the market notes, and review any others."
    5. "Add your {missing items} in your profile so your disclosure can be added." This one applies to live data only, using DISCLOSURE_FIELD_LABELS.
  - `builderGateState` is the single place the gate input is assembled.
- **SnapshotBuilder**
  - **Layout:** the lead, the report label line, four `<section aria-labelledby>` step cards (48px apart, 64px from 768px), then Your snapshots. Steps 2-4 show the no-data line until step 1 has data.
  - **Step 3:** shows the notes-uses copy and a GenerationPanel exactly as specified in `<interfaces>`. Its inputs are `{ metrics, sample, asOf }`, its postChecks are numberPostCheck plus numberWordsPostCheck, its mailto subject is "Market notes: ZIP {zip}" and its subjectId is the ZIP. DraftHistory sits below the panel. With Market notes off, the step shows only "Market notes are turned off in step 2."
  - **Step 4:** a cost `<dl>` (ZIP data "{cost} · as of {date}", Listings summary, Market notes), then **Save and open print view**. While gated it uses `aria-disabled` and `aria-describedby`, and activating it focuses and announces the reason. It shows **Saving…** while saving, and a SectionError if the save fails.
  - **Autosave:** the ZIP, sections, statements and listings kind are saved, never stats.
- **SnapshotList**
  - Rows run newest first: "ZIP {zip}" (h3, tabindex -1), the place name, a SampleChip on sample records and the line "Saved {Mon D, YYYY} · data as of {Mon D, YYYY} · {n} sections".
  - Each row has **Open print view** and **Delete**. Delete opens a ConfirmDialog titled "Delete the ZIP {zip} snapshot from {Mon D}?", with **Delete snapshot** / **Deleting…** / **Keep snapshot**.
  - A delete announces "Deleted the ZIP {zip} snapshot." Focus then moves to the next row, else the previous one, else the section heading.
  - The empty state links "Preview a sample report".
- **Route:** the back link, h1 and hydration line stay. SnapshotBuilder (with the gateway, Dexie and the AI runner) is loaded by dynamic import in onMount.

## Task Commits

1. **Task 1: save gate, SnapshotList, SnapshotBuilder.** `c7f11ce` (feat), followed by:
   - `413f39d` (fix): Choose a different ZIP clears the builder (coordinator follow-up).
   - `b619f29` (fix): step 4's no-data line shows once (found in E2E).
2. **Task 2: route body and E2E.** `6c49c7d` (feat, route body) and `1c451d9` (feat, the E2E spec, with the plan's Task 2 message).

Every commit used an explicit pathspec after `git diff --cached --name-only`.

## Verification

Every Node command ran through the single-core wrapper, mask 0x200.

- **Unit:** vitest `save-gate snapshot-components snapshot-calls` passed 54/54. The `features/studio` regression passed 10 files, 136/136.
- **Static checks:** `pnpm check` has 0 errors and 0 warnings (2588 files). eslint and prettier are clean on `features/studio/snapshot/`, `apps/web/src/routes/` and the spec. `pnpm banned` passed (371 files). The grep for "CMA" and "apprais" over features/studio finds nothing.
- **Builds:** `pnpm build:root` and `pnpm build:sub` both succeeded.
- **Playwright** (`--workers=1`, foreground chunks):
  - `snapshot-builder` + `studio-shell`, root and sub: **46/46**.
  - `snapshot-print`, root: **5/5**. It covers the saved-record print path that this builder writes into.
  - `routing.spec` + `a11y.spec` patterns, root: **151/151**.
- **Spec contents:** all five tests use `test.slow()` except the GatewayError test. Axe runs on these states:
  - before load
  - loaded (sample)
  - number finding with Save gated
  - Save enabled
  - no-data-section gate
  - Delete confirm open
  - listings summary loaded (mocked live)
  - GatewayError (mocked 500)

  The spec also checks 375px for horizontal scroll and asserts that the RentCast call count is 2 after ZIP plus summary and still 2 after the cached reload.
- `apps/web/test-results` is deleted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The loaded ZIP's provenance row always said "fresh" (gap noted by 09-16, assigned to this plan)**
- **Fix:** `ZipData` gains `stale`, taken from the gateway's `r.provenance.stale` (in `snapshot-data.ts`, a 09-14 file). ZipPicker's ProvenanceRow is now fed by a new exported `loadedProvenance()`, and Refresh carries `stale` as well.
- **Tests:**
  - snapshot-calls: two stub-runtime cases, fresh and stale, each keeping the original fetchedAt. The real-runtime live and sample cases also assert `stale: false`.
  - snapshot-components: a fresh/stale `loadedProvenance` test. Its two ZipData literals gained `stale: false`.
- **Note:** through the live gateway, `requestSpend` never returns a stale row today. `read()` refetches any row past its TTL, so `stale` is always false on loads. The fix makes the row truthful to the gateway's provenance; it changes nothing visible today.
- **Commit:** `c7f11ce`

**2. [Rule 2 - Missing functionality] `ZipPicker initialZip` (additive prop, 09-16 file)**
- The plan autosaves the ZIP. Restoring it needed a preselect: a matching sample row, else the typed input, switching to a watched row once the list arrives. Preselecting never loads data.
- **Commit:** `c7f11ce`

**3. [Rule 1 - Bug] "Choose a different ZIP" kept the old ZIP's figures (coordinator follow-up)**
- **Issue:** ZipPicker returned to the picker without telling the builder. Steps 2-4 kept the old ZIP's data, so a save could pair one ZIP's numbers with another's label, and the notes panel kept the old draft.
- **Fix:** an additive `onCleared` callback on ZipPicker (09-16 file). The builder applies `CLEARED_ZIP` and `emptyPanelOutputs()`, which drops the data, the listings summary, the spends and the notes outputs. The panel unmounts, and the gate shows its no-data reason.
- **Tests:** 4 unit tests and an E2E test (load, draft, choose a different ZIP, Save gated, no old figures, reload starts the notes over).
- **Commit:** `413f39d`

**4. [Rule 1 - Bug] Duplicate no-data text in step 4 (found in E2E)**
- Before data, step 4 showed the step-empty line and the identical Save reason line. The reason line now doubles as the empty line.
- **Commit:** `b619f29`

**5. [Rule 3 - Blocking] Pure builder helpers placed in save-gate.ts**
- Importing them from the .svelte module script failed in Node vitest, because `$app/navigation` cannot be resolved there.

### Interface notes

- **Commit split:** the route body was committed apart from the spec, because the spec had to wait for Stage 2.
- **E2E keyboard activation:** Playwright's click refuses `aria-disabled` controls, so the gated-Save checks focus the button and press Enter. That is the real keyboard path; the button stays focusable.

**Total deviations:** 4 auto-fixed (Rules 1 and 2), 1 blocking placement (Rule 3) and 2 interface notes. Every change outside files_modified is in 09-14 or 09-16 files that no open plan lists.

## Known limitations

- The step 4 ZIP cost relies on fetchedAt being at or after the click time. It is exact for a single tab. If another tab fetched the same ZIP after this tab's click, this tab would read "1 call" while actually having been served from cache.

## Requirements

STU-04 is advanced: the builder half is proven in E2E. Per the briefing, I did not run `requirements mark-complete`, because the 09-23 phase gate closes requirement ids.

## Known Stubs

None.

## Self-Check: PASSED
