---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 20
subsystem: agent-import-ui
tags: [paste-import, csv-import, tran-lead, dry-run, dexie, svelte5, playwright, axe, textdecoder]

# Dependency graph
requires:
  - phase: 08-05
    provides: "@tran/core/leads/lead-block parseLeadBlocks, parse-freeform parseFreeform, fixtures/mangled-blocks"
  - phase: 08-06
    provides: "@tran/core/leads/diff-leads diffLeads, LeadDiff, LeadDiffRow"
  - phase: 08-07
    provides: "@tran/core/csv parseCsv, detectDelimiter, CsvError, autoMap, validateMapping, rowsToIncomingLeads, countDataRows, checkRowCap, MAX_CSV_BYTES, MAPPING_TARGETS, MAPPING_LABELS, RowReason"
  - phase: 08-14
    provides: "$lib/storage/agent/import-commit planFromDiff, commitImport, ImportCommitError, ImportResult, LeadEdits"
  - phase: 08-15
    provides: "QuickAddDialog, crm/quick-add validateQuickAdd, tests/e2e/agent-helpers (announcer, addLeadByHand, rentcastTripwire, axe helpers)"
  - phase: 08-12
    provides: "contacts-repo listContacts"
  - phase: 08-10
    provides: "ui/NativeSelect"
  - phase: 03
    provides: "SectionError, Textarea, Checkbox, Badge, Button, Input, Label, announce()"
provides:
  - "features/agent/import/paste-to-leads.ts: pasteToLeads(text) -> { mode: blocks | freeform | none | empty | too-long, leads, newerVersion, invalid }, MAX_PASTE_CHARS"
  - "features/agent/import/decode.ts: decodeCsvBytes(buf) -> { text, encoding: utf-8 | windows-1252 }"
  - "features/agent/import/ImportReview.svelte: shared dry-run review (counts, include checkboxes, bulk controls, status badges + detail lines, editable free-form rows, CSV table at 1024px+, single-transaction commit, Import complete result)"
  - "features/agent/import/PasteImport.svelte, CsvImport.svelte, ColumnMapper.svelte"
  - "/agent/import/ page: Import leads with Add one lead by hand, paste and CSV sections"
  - "tests/e2e/agent-import.spec.ts: 11 tests x 2 bases"
affects: [08-23 inquiry intake (same block format), 08-26 gate (AGT-03, AGT-07 UI half), contacts list (imported contacts appear there)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Import UI = parse (pure) -> diffLeads against listContacts() -> ImportReview -> planFromDiff + commitImport; the parsed text / file bytes live only in component state"
    - "Review panels are remounted per check with {#key seq}; the view model is $derived from props and the agent's choices (include set, edits) are captured once with untrack"
    - "Hidden file input nested inside a label styled with buttonVariants (focus-within ring); input.value reset after every attempt"
    - "E2E seeds through the feature under test when a shared helper is timing-sensitive (multi-block paste instead of four quick-add dialogs)"

key-files:
  created:
    - apps/web/src/lib/features/agent/import/paste-to-leads.ts
    - apps/web/src/lib/features/agent/import/paste-to-leads.test.ts
    - apps/web/src/lib/features/agent/import/decode.ts
    - apps/web/src/lib/features/agent/import/decode.test.ts
    - apps/web/src/lib/features/agent/import/ImportReview.svelte
    - apps/web/src/lib/features/agent/import/PasteImport.svelte
    - apps/web/src/lib/features/agent/import/CsvImport.svelte
    - apps/web/src/lib/features/agent/import/ColumnMapper.svelte
    - apps/web/tests/e2e/agent-import.spec.ts
  modified:
    - apps/web/src/routes/(app)/agent/import/+page.svelte

key-decisions:
  - "08-20: text that holds any TRAN-LEAD block never falls back to free-form (a block email is an inquiry; its prose must not yield a second lead), so only-newer-version blocks report mode none with newerVersion counted"
  - "08-20: ImportReview is remounted per check through {#key}; rows/groups/counts are $derived from props and the include set + free-form edits are captured once with untrack"
  - "08-20: re-pasting an inquiry email that carries a message is an update that only logs the message (diffLeads treats a message as new information); Already in contacts is proven with a message-less block"
  - "08-20: the Keeps line names the source (CSV: file has; paste: pasted email has); Import more is a button that resets the section, Open your pipeline is a resolve() link"
  - "08-20: the axe E2E seeds four contacts through one multi-block paste instead of addLeadByHand, which clicked the contacts toolbar before the list page hydrated"

patterns-established:
  - "Dry-run import: parse -> diff -> review -> one transaction, with the input never stored"
  - "Free-form (pattern-found) rows are editable and validated with the quick-add rules before commit"

requirements-completed: [AGT-03, AGT-07]

# Metrics
duration: ~51 min
completed: 2026-10-07
---

# Phase 8 Plan 20: Paste and CSV import with dry-run review Summary

**The Import leads page: pasted inquiry emails (exact TRAN-LEAD blocks in any mangled form, or one lead found by pattern) and CSV files (UTF-8 or Excel windows-1252, comma or semicolon, mapped column by column) both land through one shared dry-run review that shows New / Updates / Already in contacts / Can't import per row, fills only blank fields, and commits in a single Dexie transaction.**

## Performance

- **Duration:** ~51 min (two-stage execution: implementation + unit/check/lint first, builds + Playwright once the shared build directory was free)
- **Started:** 2026-10-07T01:04:13Z
- **Completed:** 2026-10-07T01:54:30Z
- **Tasks:** 3
- **Files modified:** 10 (9 created, 1 modified)

## Accomplishments

- **Paste glue (Task 1).** `pasteToLeads` turns every `TRAN-LEAD v1` block into an `IncomingLead` (`source: 'inquiry'`, `consentSource` from the consent line, property and message kept), counts newer-version and unreadable blocks, and only when the text holds no block at all runs `parseFreeform` for at most one `source: 'paste'` lead. Blank input is `'empty'`, more than 100,000 characters is `'too-long'` (refused, never cut). All 13 `MANGLED` fixtures parse in the web package too.
- **Byte decoding (Task 1).** `decodeCsvBytes` tries `TextDecoder('utf-8', { fatal: true })` (BOM dropped) and falls back to `windows-1252` for Excel's plain CSV, reporting which encoding won.
- **ImportReview (Task 2).** One panel for paste and CSV: `h3` "Review before adding" focused on mount; a `<dl>` of New / Updates / Already in contacts / Can't import (the last term always for CSV, for paste only when a conflict exists); Select all new / Clear all; include checkboxes (labelled "Include {name}") for new and update rows only; badges New contact / Updates {Name} / Already in contacts / Can't import plus "Same person as row {r}"; detail lines "Adds phone, adds property. Logs the inquiry message.", "Keeps {field} {old} (file has {new}).", "Matches {Name}. Nothing new to add.", "Row {r}: {reason}" (including 08-07's `too-long` reason) and the unknown-stage note. Free-form rows render Name / Email / Phone inputs under "Found by pattern. Check these details before adding." and are validated with the quick-add rules before anything is written (first invalid field focused). CSV rows at 1024px and up render as one `<table>` per status inside a labelled, focusable scroll region, 20 rows per group with "Show all {n}"; narrower viewports and paste use card lists. The commit is `commitImport(planFromDiff(rows, checked, edits))`; `ImportCommitError` becomes the "Import didn't finish" SectionError; success swaps in the focused "Import complete" heading, "{a} added, {u} updated, {s} skipped.", **Open your pipeline** and **Import more**, with the exact live-region strings for checked / complete / canceled.
- **PasteImport (Task 2).** Honest copy ("Tran doesn't connect to your inbox; pasting is how leads get in"), the Lead email text textarea (no `maxlength`, so a long paste is refused with a message instead of silently truncated), Paste from clipboard only when `navigator.clipboard.readText` exists (denied copy per spec), "Paste an email before checking.", a neutral SearchX "No lead details found" block whose title takes focus and whose **Add one lead by hand** opens the page's QuickAddDialog, pluralized notes for skipped newer-version / unreadable blocks, and the textarea cleared after a successful import.
- **CsvImport + ColumnMapper (Task 2).** A visually hidden `<input type="file" accept=".csv,text/csv">` inside a `buttonVariants` label (focus-within ring, "Reading file..." while reading); size over `MAX_CSV_BYTES` is refused before reading; decode, `detectDelimiter` on the first line, `parseCsv` (`CsvError` -> "This file can't be read as CSV"), blank header or zero data rows -> "This file has no contacts", `checkRowCap` -> "This file has more than 5,000 contacts"; the input value is reset after every attempt. The mapper lists each header with "e.g. {first non-empty value}" (40 chars) and a NativeSelect over every `MAPPING_TARGETS` entry, auto-mapped by `autoMap`; `validateMapping` errors use the three spec strings; Check file runs `rowsToIncomingLeads(rows, mapping, { firstLine: 2 })` then `diffLeads` and announces the counts including "{x} can't be imported".
- **Route (Task 2).** `/agent/import/` has the h1 (focusable), the lead paragraph, a ghost **Add one lead by hand** with the QuickAddDialog (focus back to the h1 after an add), then the paste and CSV sections 48px / 64px apart.
- **E2E (Task 3).** 11 tests on both bases: block paste with focus and announcement checks; re-paste (update-that-only-logs, then Already in contacts with no checkbox, "Add 0 leads" -> "Choose at least one lead to add.", Cancel announcement); collapsed and `> `-quoted CRLF variants; phone fill as an update, then a different phone kept and listed; editable free-form row with blank-name validation and the edited name proven on re-paste; nothing found -> quick-add dialog and the empty-text error; CSV mapping (five auto-mapped headers, example value, mapping error), invalid rows, unknown stage, table regions at 1280, "Import 2 contacts" and the imported contact showing as a duplicate on paste; semicolon + windows-1252 "Jose" with an accent; 5,001 rows, 5 MB + 1 byte, unterminated quote and header-only rejections; axe at 1280 (page, block review, free-form review, nothing found, mapping, every-status review, result) and at 375 with no horizontal scroll and card rendering. The RentCast tripwire is asserted empty after every test.

## Task Commits

1. **Task 1 (RED): failing tests for paste-to-leads and CSV decoding** - `53f8750` (test)
2. **Task 1 (GREEN): paste-to-leads and CSV decoding** - `a4de201` (feat)
3. **Task 2: paste and CSV import with dry-run review** - `50f2c56` (feat)
4. **Task 3: paste and CSV import E2E** - `a29c89a` (test)

**Plan metadata:** the docs(08-20) commit that follows this file.

## Files Created/Modified

- `apps/web/src/lib/features/agent/import/paste-to-leads.ts` - `pasteToLeads`, `MAX_PASTE_CHARS`, `PasteResult`
- `apps/web/src/lib/features/agent/import/paste-to-leads.test.ts` - 9 tests (two blocks, all 13 mangled fixtures, v2+v1, only v2, invalid block, free-form, none, empty, too-long)
- `apps/web/src/lib/features/agent/import/decode.ts` - `decodeCsvBytes`
- `apps/web/src/lib/features/agent/import/decode.test.ts` - 6 tests (BOM, plain UTF-8, 1252 fallback, 1252 upper range, typed-array view, empty)
- `apps/web/src/lib/features/agent/import/ImportReview.svelte` - the shared review and result panel
- `apps/web/src/lib/features/agent/import/PasteImport.svelte` - paste section
- `apps/web/src/lib/features/agent/import/CsvImport.svelte` - CSV section (choose, limits, decode, parse)
- `apps/web/src/lib/features/agent/import/ColumnMapper.svelte` - column matching step
- `apps/web/src/routes/(app)/agent/import/+page.svelte` - the page (replaced the 08-11 skeleton)
- `apps/web/tests/e2e/agent-import.spec.ts` - the E2E spec

## Verification

Every Node command ran through the single-core affinity wrapper (mask 0x2000); builds and Playwright ran only after the orchestrator handed over the shared build directory.

- `vitest run --project web src/lib/features/agent/import`: 23 tests pass (15 from this plan; the other 8 are 08-18's csv-export tests in the same folder). `src/lib/features/agent`: 172 tests pass.
- `pnpm check`: 0 errors in every run; the only warnings were in other executors' uncommitted files (`tasks/TodayQueue.svelte`, `tasks/AddTaskForm.svelte`, `profile/BrandColorField.svelte`). This plan's files: 0 errors, 0 warnings.
- `prettier --check` and `eslint` clean on `features/agent/import`, `apps/web/src/routes` and the spec. Repo-wide `pnpm lint` and `pnpm banned` failed only on other executors' uncommitted profile / debug files (not touched).
- Task 2 acceptance greps: every required string present; `grep -rciwE "sync|inbox connection"` is 0 for every `import/*.svelte`.
- Task 3 acceptance greps: `TRAN-LEAD v1`, `Already in contacts`, `Adds phone.`, `Found by pattern`, `No lead details found`, `setInputFiles`, `more than 5,000 contacts` and the accented name all present.
- `pnpm build:root` and `pnpm build:sub`: both wrote their sites (HEAD cc965b8 + this plan's commits).
- `playwright test agent-import --workers=1`: **22 passed (11 root + 11 sub)**, run twice in a row with identical results. `apps/web/test-results` deleted afterwards.

## Decisions Made

- **Blocks win outright.** If the pasted text contains any `TRAN-LEAD` block, free-form never runs, even when every block is invalid or from a newer version; a block email is an inquiry notification and its prose must not become a second lead. Only-v2 text therefore reports `mode: 'none'` with `newerVersion: 1`, as the plan's behavior table asks.
- **Review state captured once per check.** `ImportReview` derives rows, groups and counts from its props with `$derived`, while the include set and the free-form edits are initialised once with `untrack` (parents remount the panel through `{#key seq}` on every check). This cleared the compiler's `state_referenced_locally` warnings honestly instead of silencing them.
- **Kind-aware Keeps copy.** CSV says "(file has {new})" per the spec; paste says "(pasted email has {new})", since there is no file.
- **Import more is a button.** A same-URL link would not remount the page, so **Import more** resets the owning section and moves focus to the textarea (paste) or the file input (CSV); **Open your pipeline** is a `resolve()` link.
- **Prettier keeps literal ellipses in Svelte files.** The svelte Prettier plugin rewrote `…` escapes to the literal character; committed Phase 8 Svelte files (QuickAddDialog, CrmEmptyState) already carry it literally, so the Svelte files follow repo practice while the `.ts` sources and unit tests stay pure ASCII.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Deep `@tran/core/csv/*` paths are not exported**
- **Found during:** Task 2 (`pnpm check`)
- **Issue:** The plan's interface list names `@tran/core/csv/csv` and `@tran/core/csv/contact-columns`, but core's `exports` map only has `./*` -> `src/*/index.ts` for csv (no `./csv/*` entry like `./leads/*`).
- **Fix:** Import everything from the `@tran/core/csv` barrel (08-07 re-exports both modules).
- **Files modified:** ImportReview.svelte, CsvImport.svelte, ColumnMapper.svelte
- **Verification:** `pnpm check` 0 errors.
- **Committed in:** `50f2c56`

**2. [Rule 1 - Bug] E2E expectation vs. diffLeads semantics for a re-pasted email**
- **Found during:** Task 3 (first Playwright run; 4 failures on root and sub)
- **Issue:** The plan's test expected re-pasting the same TRAN-LEAD email to show "Already in contacts", but 08-06's `diffLeads` classifies any lead that carries a message as an `update` (`logsInquiry`), so the UI correctly showed "Updates Jordan Paste" / "Logs the inquiry message." with no field changes.
- **Fix:** The spec now asserts that real behavior for the full email (update with only "Logs the inquiry message.", no "Adds") and proves "Already in contacts" (no checkbox, "Add 0 leads" error, Cancel) and the collapsed / quoted variants with the same lead minus its message. Core was not changed.
- **Files modified:** agent-import.spec.ts
- **Verification:** 22/22 on both bases.
- **Committed in:** `a29c89a`

**3. [Rule 1 - Bug] Seeding four contacts through `addLeadByHand` raced the contacts page**
- **Found during:** Task 3 (the 1280 and 375 axe tests timed out inside the shared helper, once on sub and twice on root; the snapshot showed the toolbar's "Add a lead" button but no dialog, with the first contact already listed)
- **Issue:** `agent-helpers.addLeadByHand` navigates to `/agent/contacts/` and clicks immediately; now that 08-18 renders the real list there, the prerendered button can be clicked before hydration, so the dialog never opens. The helper and the contacts page belong to other plans (wave 5 must not edit the helper).
- **Fix:** The axe tests seed Riley / Jordan / Morgan / Taylor through one four-block paste on the page under test (`importPaste`), which is deterministic and also covers multi-block paste; the never-overwrite test keeps its single `addLeadByHand` call, which passes.
- **Files modified:** agent-import.spec.ts
- **Verification:** two consecutive 22/22 runs.
- **Committed in:** `a29c89a`

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs in the plan's test expectations). **Impact on plan:** No scope change; the import UI matches the UI-SPEC and the proven core semantics. Deviation 2 is worth a product look (see Known limitations).

## Issues Encountered

- **Two-stage execution.** Four wave-5 executors shared the Vite build directory, so implementation, unit tests, check and lint ran first and builds + Playwright only after the orchestrator's "run E2E". The repo-wide `pnpm lint` / `pnpm banned` gates were red on other executors' uncommitted files during this plan (profile/LogoUpload.svelte, profile/BrandColorField.svelte "sync", tests/e2e/zz-debug-drag.spec.ts); none were touched or staged.
- **Single-core machine constraint.** Every Node command used the affinity wrapper; Playwright ran with `--workers=1` (~55 s per full run of this spec).

## Known limitations (for the verifier and later plans)

- **Free-form edits are not re-diffed.** A pattern-found row's Name / Email / Phone can be edited in the review, and the edits are applied at commit, but the duplicate check ran on the parsed values. If the agent changes the email or phone to one that already belongs to a contact, the add is not re-classified. A follow-up could re-run `diffLeads` on edit or warn before commit.
- **"Add {n} leads" is the spec's literal string**, so the button reads "Add 1 leads" / "Add 0 leads". A singular form ("Add 1 lead") would be a copy follow-up that also needs the UI-SPEC and the E2E updated.
- **Re-pasting an inquiry email with a message is offered as an update** that logs the inquiry again (diffLeads `logsInquiry`). The agent can uncheck it, but a product decision could suppress an inquiry whose text already exists as an activity for that contact.
- **Deferred (not this plan's files):** `tests/e2e/agent-helpers.addLeadByHand` clicks right after `page.goto` without waiting for hydration; with the real contacts list it can miss the dialog. The 08-15/08-18 owners may want an `await expect(page.locator('html')).not.toHaveAttribute('hidden')` guard in the helper.

## Requirements

`requirements-completed` above copies the plan's `requirements` field verbatim as the template requires. `requirements mark-complete` was **not** run for AGT-03 or AGT-07: the Phase 8 convention (08-12, 08-14, 08-15, 08-16) keeps the AGT ids open until the 08-26 gate closes them. This plan delivers the paste half of AGT-03 (with duplicate detection) and the import half of AGT-07 (export shipped in 08-18).

## Known Stubs

None. Every control is wired: parsing to core, duplicate detection to `listContacts` + `diffLeads`, the commit to `commitImport`, and the result to the pipeline route.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `/agent/import/` is complete for the 08-26 gate; imported contacts appear in 08-18's list and 08-19's pipeline.
- 08-23 (inquiry intake) shares `pasteToLeads`' expectations of the block format; nothing else depends on this plan's internals.

---
*Phase: 08-agent-portal-profile-lead-intake-crm*
*Completed: 2026-10-07*

## Self-Check: PASSED

All 10 plan files and this SUMMARY exist on disk; commits 53f8750, a4de201, 50f2c56 and a29c89a are in history.
