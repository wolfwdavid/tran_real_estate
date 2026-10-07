---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 18
subsystem: agent-crm-ui
tags: [crm, contacts-list, search, smart-lists, paging, csv, export, bom, formula-injection, svelte5, playwright, axe]

# Dependency graph
requires:
  - phase: 08-07
    provides: "@tran/core/csv exportContactsCsv (BOM, quote-all, CRLF, formula escape, samples and tombstones excluded), EXPORT_COLUMNS"
  - phase: 08-14
    provides: "tasks-live useOpenTasks(); core nextOpenTask, countLists, matchesList"
  - phase: 08-15
    provides: "contacts page h1 + QuickAddDialog (onadded) + CrmEmptyState; E2E helpers announcer, loadSampleContacts, addLeadByHand; sample fixture"
  - phase: 08-17
    provides: "ContactCard (variant list), DueBadge, SmartListFilter, list-state (readListParam, readQueryParam, withParams, filterContacts)"
  - phase: 08-10
    provides: "StageBadge, dates (formatMonDay, relativeDays, todayLocal, localDateOf)"
  - phase: 03
    provides: "object-URL <a download> mechanism, LiveAnnouncer announce(), table scroll-wrapper pattern"
provides:
  - "features/agent/import/csv-export.ts: buildExport(contacts, today) -> { filename, text, count } | null; downloadText(filename, text)"
  - "features/agent/import/CsvExportButton.svelte: Export contacts (CSV) with helper, empty line and Downloaded announcement"
  - "features/agent/crm/ContactsTable.svelte: 1024px+ table (Name, Stage, Next task, Last contact, Added) in the focusable labelled scroll region"
  - "features/agent/crm/ContactsView.svelte: toolbar (search, SmartListFilter, Add a lead, export) + table/cards + 50-row paging + no-match states + ?list=/?q= mirror; exported focusContact(id)"
  - "/agent/contacts/ renders the list once contacts exist and moves focus after a quick add to the new contact's link (h1 fallback)"
  - "tests/e2e/agent-contacts.spec.ts and agent-csv.spec.ts"
affects: [08-20 CSV import (same column contract), 08-21 contact detail (list links), 08-26 gate (AGT-03, AGT-07)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "List breakpoint via svelte/reactivity MediaQuery so only one copy of each contact link id is in the DOM (table OR cards), never both hidden with CSS"
    - "URL view state: read ?list=/?q= once in onMount, mirror with replaceState(resolve(path) + withParams(...), page.state); list changes announce 'Showing {List}: {n} contact(s).'"
    - "Post-add focus: the page queues the new id and an $effect waits for the live query to deliver the contact before asking the list to focus its link"
    - "In .svelte files, group into a plain record and wrap in an unmutated new Map(Object.entries(...)) to satisfy svelte/prefer-svelte-reactivity without SvelteMap"
    - "Build the UTF-8 BOM with String.fromCharCode(0xfeff) in tests so no formatter turns a \\uFEFF escape into a literal character"

key-files:
  created:
    - apps/web/src/lib/features/agent/import/csv-export.ts
    - apps/web/src/lib/features/agent/import/csv-export.test.ts
    - apps/web/src/lib/features/agent/import/CsvExportButton.svelte
    - apps/web/src/lib/features/agent/crm/ContactsTable.svelte
    - apps/web/src/lib/features/agent/crm/ContactsView.svelte
    - apps/web/tests/e2e/agent-contacts.spec.ts
    - apps/web/tests/e2e/agent-csv.spec.ts
  modified:
    - apps/web/src/routes/(app)/agent/contacts/+page.svelte
    - apps/web/tests/e2e/agent-entry.spec.ts

key-decisions:
  - "The export reads listContacts() at click time instead of a $state proxy, so the serializer sees plain records and the count is current"
  - "Smart-list counts are computed over all live contacts (not the search-filtered set) so the four buttons stay stable while typing; the caption and announcement use the filtered count"
  - "When both a search and a smart list match nothing, the search message and Clear search win (the search is the narrower, more recent input)"
  - "The header Add a lead button renders only while the list is not shown, so the empty state keeps two Add a lead buttons (agent-entry asserts 2) and the populated page has exactly one"
  - "Caption and announcement pluralize ('1 contact' / '12 contacts'); the UI-SPEC's '{n} contacts' template is kept for n != 1"
  - "The 08-15 agent-entry assertion 'focus moves to the page h1 after a quick add' was a declared placeholder for this plan; it now asserts the new contact's link per the UI-SPEC focus table"

patterns-established:
  - "Contacts link ids are contact-{id}-name in both the table and ContactCard; focus helpers resolve them with getElementById scoped to the view"

requirements-completed: [AGT-07, AGT-03]

# Metrics
duration: ~36 min
completed: 2026-10-07
---

# Phase 8 Plan 18: Contacts list and CSV export Summary

**The Contacts page is now a deep-linkable list of the agent's CRM (search by name / email / phone digits, the four smart lists with live counts and announcements, newest-first rows 50 at a time, a table from 1024px and cards below), and Export contacts (CSV) downloads an Excel-safe, injection-safe tran-contacts-YYYY-MM-DD.csv through the one core serializer, proven byte-for-byte by Playwright on both bases.**

## Performance

- **Duration:** ~36 min
- **Started:** 2026-10-07T01:05:30Z
- **Completed:** 2026-10-07T01:41:28Z
- **Tasks:** 3 of 3
- **Files modified:** 9 (7 created, 2 modified)

## Accomplishments

- **CSV export** (Task 1): `buildExport(contacts, today)` returns null when there is no live non-sample contact (so nothing downloads with only samples or an empty CRM), otherwise `{ filename: tran-contacts-${today}.csv, text: exportContactsCsv(contacts), count }`. `downloadText` is the Phase 3 object-URL `<a download>` mechanism with a `text/csv;charset=utf-8` blob. `CsvExportButton` (outline, Download 16px) carries the UI-SPEC helper line, reads `listContacts()` at click time, shows and announces "There are no contacts of yours to export yet." or downloads and announces "Downloaded {filename}.". Eight unit tests cover the null cases, the injected date, the BOM + quoted header, exactly one header row (no disclosure row, Planner Note 6), sample exclusion and the `"'=HYPERLINK(""http://evil.test"",""x"")"` escape.
- **Contacts list** (Task 2): `ContactsTable` renders Name (link + Sample data chip), Stage (StageBadge), Next task (DueBadge or "None"), Last contact (relative or "Never") and Added (Mon D) inside the Phase 3 scroll wrapper (`tabindex="0"`, `role="region"`, `aria-label` = the caption "{n} contacts"). `ContactsView` owns the toolbar (sr-only-labelled **Search contacts** input with a leading Search icon, `SmartListFilter` with counts from `countLists`, **Add a lead** via `onaddlead`, `CsvExportButton`), filters with `filterContacts` + `matchesList` using `useOpenTasks()` grouped by contact, sorts by `createdAt` desc, pages 50 at a time with **Show more contacts**, switches between the table and a `<ul>` of `ContactCard` (variant `list`) with a `MediaQuery('min-width: 1024px')`, and renders the two no-match states ("No contacts match "{q}"." + **Clear search**; "No contacts match {List} right now." + **Show all contacts**). `?list=` and `?q=` are read once in `onMount` and mirrored with `replaceState`; a list change announces "Showing {List}: {n} contacts.". The route shows `CrmEmptyState` when empty, the view once contacts exist, and the loading line only while loading; after a quick add an `$effect` waits for the live query to deliver the new contact, then focuses its link (or the h1 when the filter hides it).
- **E2E** (Task 3): `agent-contacts.spec.ts` (7 tests) proves the 12 samples newest first with chips at 1280 (caption "12 contacts", headers, Due today / Overdue / None / Never cells, detail links) and at 375 (cards, Emerson's "No emails"), search by name, email and `0105` with `?q=0105` surviving a reload, Due today (5) / New this week (3) / No contact in 7 days (3, Closed Logan excluded) with the exact announcement, `?list=` on reload and a combined deep link, both no-match states, focus on the new contact after a quick add, and axe at both widths with no horizontal scroll. `agent-csv.spec.ts` (2 tests) proves that samples alone download nothing (no download event in 1 s) and that a real export's bytes start `EF BB BF`, use CRLF only, hold exactly one header row (the 12-column header), one data row, no sample email, and the apostrophe-neutralized HYPERLINK cell, with "Downloaded tran-contacts-YYYY-MM-DD.csv." announced. The RentCast tripwire is asserted empty after every test.

## Task Commits

1. **Task 1: CSV export builder and button** - `dcbb007` (feat)
2. **Task 2: Contacts view, table and route** - `12bf222` (feat)
3. **Task 3: Contacts and CSV export E2E** - `56f10a4` (test)
4. **Task 3 follow-through: agent-entry's placeholder focus assertion** - `403ee14` (test; see Deviations)

**Plan metadata:** see the docs(08-18) commit that follows this file.

## Files Created/Modified

- `apps/web/src/lib/features/agent/import/csv-export.ts` - `buildExport`, `downloadText`, `ContactsExport`
- `apps/web/src/lib/features/agent/import/csv-export.test.ts` - 8 tests (null cases, filename, BOM/header, one header row, sample exclusion, formula escape)
- `apps/web/src/lib/features/agent/import/CsvExportButton.svelte` - the export action with helper, empty line and announcements
- `apps/web/src/lib/features/agent/crm/ContactsTable.svelte` - the 1024px+ table in its scroll region
- `apps/web/src/lib/features/agent/crm/ContactsView.svelte` - toolbar, filtering, paging, breakpoint switch, URL mirror, `focusContact`
- `apps/web/src/routes/(app)/agent/contacts/+page.svelte` - empty state / list / loading, header button while the list is absent, post-add focus
- `apps/web/tests/e2e/agent-contacts.spec.ts` - the list spec
- `apps/web/tests/e2e/agent-csv.spec.ts` - the export bytes spec
- `apps/web/tests/e2e/agent-entry.spec.ts` - one assertion updated from the h1 placeholder to the new contact's link

## Verification

Every Node command ran through the single-core affinity wrapper (mask 0x800); plain git was unaffected.

- `vitest run --project web src/lib/features/agent/import`: 8/8. `src/lib/features/agent`: 15 files, 172 tests passed.
- `pnpm check`: 0 errors and 0 warnings in this plan's files (first full run: 2457 files, 0 errors, 0 warnings). Later runs reported errors only in other wave-5 executors' then-uncommitted files (`profile/logo-pipeline.test.ts`, `import/ImportReview.svelte`), which were neither touched nor staged.
- `pnpm lint`: prettier and eslint clean on every file of this plan (scoped runs over `features/agent/crm`, `features/agent/import`, the contacts route and the three specs); the repo-wide run failed only in concurrent executors' uncommitted pipeline / tasks files.
- `pnpm banned`: passed (323 files). Pre-commit gitleaks and the staged real-data guard passed on all four commits.
- `pnpm build:root` and `pnpm build:sub`: both wrote their sites (27 s / 23 s).
- Playwright (`--workers=1`): `agent-contacts agent-csv` **18/18** (root 9, sub 9) on the first run. Regression check `agent-entry`: 2 failures on the placeholder focus assertion, then **8/8** (root 4, sub 4) after the assertion followed the list (see Deviations).
- Acceptance greps: csv-export.ts exports `buildExport`, calls `exportContactsCsv`, contains `tran-contacts-`; the button contains all four copy strings; the test contains `HYPERLINK` and the one-header-row assertion; ContactsTable contains `<caption`, `tabindex="0"`, `Next task`, `Last contact`, `Added`; ContactsView contains `Search contacts`, `Show more contacts`, `Clear search`, `Show all contacts`, `replaceState`, `Showing `, `SmartListFilter`, `CsvExportButton`; the page contains `CrmEmptyState` and `ContactsView`; agent-csv.spec.ts contains `0xef`, `EF BB BF`, `\r\n`, `'=HYPERLINK`, `suggestedFilename`; agent-contacts.spec.ts contains `?list=due-today`, `Showing Due today`, `No contacts match`.
- `apps/web/test-results/` (created by the failing agent-entry run) was deleted after the green rerun.

## Decisions Made

- Export reads `listContacts()` at click time rather than a `$state` proxy: the serializer gets plain records and the count is current even if the live view lags.
- Smart-list counts cover all live contacts; the caption and the "Showing ..." announcement use the filtered rows. With both a search and a list matching nothing, the search message wins.
- Only one of table / cards is in the DOM (`MediaQuery`), so the shared `contact-{id}-name` link id is never duplicated and axe passes at both widths.
- The header **Add a lead** renders only while the list is absent: the empty state still has two Add a lead buttons (agent-entry asserts 2) and the populated page has exactly one (the toolbar's).
- Pluralized caption / announcement ("1 contact") rather than the literal "{n} contacts" template for n = 1.
- `@tran/core/csv` is imported from the barrel: the core package exports `./*` as `src/*/index.ts`, so the plan's `@tran/core/csv/contact-columns` path does not resolve (the key-link pattern `exportContactsCsv` still holds).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] agent-entry asserted the 08-15 placeholder focus target**
- **Found during:** Task 3 (regression run of `agent-entry` after the list replaced the stub)
- **Issue:** 08-15's plan said "move focus to the page h1 (the list arrives in 08-18)" and its spec asserted exactly that. With the list present, the UI-SPEC focus table applies ("focus moves to the new contact's link in the list ... or the page h1 if not visible"), so the old assertion failed on both bases.
- **Fix:** The single assertion (and its comment) in `apps/web/tests/e2e/agent-entry.spec.ts` now expects the link "Avery Example" to be focused. No other line of that file changed; `agent-helpers.ts` (wave 5+ must not edit) was not touched.
- **Files modified:** `apps/web/tests/e2e/agent-entry.spec.ts` (outside this plan's `files_modified`; flagged for the orchestrator)
- **Verification:** `agent-entry` 8/8 on root and sub; `agent-contacts` "quick add from the list focuses the new contact" covers the same behaviour.
- **Committed in:** `403ee14`

**2. [Rule 3 - Blocking] Core CSV import path**
- **Found during:** Task 1 (first vitest run: "Cannot find package '@tran/core/csv/contact-columns'")
- **Issue:** `packages/core/package.json` exports only `./*` -> `src/*/index.ts` (plus `agent/*`, `leads/*`, `renter/*`); there is no `csv/*` subpath.
- **Fix:** Import `exportContactsCsv` / `EXPORT_COLUMNS` from `@tran/core/csv`.
- **Committed in:** `dcbb007`

**3. [Rule 1 - Bug] Formatter turned the BOM escape into a literal character**
- **Found during:** Task 1 (eslint `no-irregular-whitespace` after `prettier --write`; 08-07 saw the same)
- **Fix:** The test builds the BOM with `String.fromCharCode(0xfeff)`; sources stay ASCII.
- **Committed in:** `dcbb007`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking). **Impact:** all three were required for the plan's own tests and must-haves to pass; the agent-entry change is the follow-through the 08-15 summary's "Known Stubs" entry anticipated. No scope creep.

## Issues Encountered

- **Machine constraint:** the host's performance counter runs backwards across cores after a sleep resume, so every Node command (vitest, svelte-check, prettier, eslint, vite builds, Playwright) ran through the single-core wrapper on mask 0x800 with Playwright at `--workers=1`.
- **Concurrent executors:** four other wave-5 executors shared the tree. Repo-wide `check` and `lint` were red only in their uncommitted files; those were never edited or staged, and builds / Playwright ran only after the coordinator handed over the shared build directory (both builds succeeded on the first attempt).
- **eslint rules met along the way:** `svelte/prefer-svelte-reactivity` rejects a mutated `Map` in a component (grouping now builds a record and wraps it once), and `eslint-disable-next-line` for `svelte/no-navigation-without-resolve` must sit directly above a single-line `replaceState(...)` call after Prettier wraps it.

## Known Stubs

None. The "Loading your contacts..." line from 08-15 now appears only while the live query is loading; the list, search, smart lists, paging and export are all wired to IndexedDB data.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- AGT-07's export half is complete and the contacts CSV round-trips through the same `EXPORT_COLUMNS` contract 08-20's import consumes.
- The Contacts page links every contact to `/agent/contact/?id=` for 08-21's detail page; `focusContact(id)` is available to any caller that adds a contact from the list.
- Ready for the remaining wave-5 plans and the 08-26 gate.

## Requirements

`requirements-completed` copies the plan's `requirements` field verbatim, as the template requires. Following the Phase 8 convention (08-12, 08-14, 08-15, 08-16), `requirements mark-complete` was **not** run for AGT-07 or AGT-03: AGT-07's import half lands in 08-20 and AGT-03's paste path in its own plan, and the AGT ids stay open until the 08-26 gate closes them.

---
*Phase: 08-agent-portal-profile-lead-intake-crm*
*Completed: 2026-10-07*

## Self-Check: PASSED

- All 9 plan files plus this SUMMARY exist on disk; commits dcbb007, 12bf222, 56f10a4 and 403ee14 are in `git log`.
