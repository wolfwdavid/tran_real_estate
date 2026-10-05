---
phase: 03-local-platform-storage-key-vault-backup
plan: 15
subsystem: app-shell
tags: [app-notice, backup-reminder, vault, dexie, live-query, e2e, page-clock]
requires:
  - phase: 03-01
    provides: backupReminderDue / BACKUP_REMINDER_DAYS (calendar-day math)
  - phase: 03-05
    provides: META, setMeta, readReminderInput, live(), firstRecordAt on first write/import
  - phase: 03-07
    provides: vault.getStatus() hasLock/locked + onChange
  - phase: 03-08
    provides: exportBackup(db, vault) + BackupError codes
  - phase: 03-10
    provides: announce(), SectionError, E2E helpers (openSettings, cspCollector, announcer)
  - phase: 03-13
    provides: makeBackup/fileFrom backup fixtures, import UI
provides:
  - lib/features/shared/app-notice/notice-logic.ts (selectNotice, isSettingsPath, backupCopy, SNOOZE_MS)
  - lib/features/shared/app-notice/AppNotice.svelte (locked + backup variants)
  - (app) layout renders AppNotice as first child of <main>
affects: [03-16 locked-variant E2E, Phase 4 DataStatusBar insertion]
tech-stack:
  added: []
  patterns:
    - "Layout-level component loads Dexie, vault, backup and @tran/core via dynamic import() in onMount; renders nothing until resolved, so no prerendered HTML or marketing chunk carries it"
    - "Reminder is a live() liveQuery re-created per navigation (reads page.url.pathname) so exports, snoozes and imports re-evaluate without reload and 'now' is fresh per page"
key-files:
  created:
    - apps/web/src/lib/features/shared/app-notice/notice-logic.ts
    - apps/web/src/lib/features/shared/app-notice/notice-logic.test.ts
    - apps/web/src/lib/features/shared/app-notice/AppNotice.svelte
    - apps/web/tests/e2e/app-notice.spec.ts
  modified:
    - apps/web/src/routes/(app)/+layout.svelte
decisions:
  - "Locked notice is suppressed only on Settings; the backup notice still shows there (UI-SPEC priority + plan behavior)"
  - "Reminder uses the live() liveQuery helper rather than a one-shot read, so the notice disappears the moment lastBackupAt / snoozedUntil is written (no manual re-evaluate path)"
  - "After Download/Snooze removes the notice, focus moves to #main-content (preventScroll) so keyboard focus never falls back to <body>"
  - "Storage blocked or vault failure resolve to null (no notice, no crash); Settings remains the place that explains blocked storage"
metrics:
  duration: ~40min
  completed: 2026-10-04
  tasks: 2
  files: 5
---

# Phase 3 Plan 15: App Notice (Backup Reminder + Locked Keys) Summary

Every `(app)` page now carries one in-flow `AppNotice` chosen by unit-tested pure logic: "Your keys are locked" (outside Settings) beats "Back up your saved data", which appears once the last backup (or first saved item) is 7+ calendar days old, is satisfiable with one-click Download backup, and snoozes for exactly 24 hours via the meta table, with no permanent dismiss.

## What was built

- **notice-logic.ts** (pure, no Svelte or storage imports): `selectNotice({ isSettings, vault, reminder })` → `'locked' | 'backup' | null`; `isSettingsPath(pathname, base)` (base-aware, rejects `/settings-old/`); `backupCopy({ days, never })` with the exact UI-SPEC copy; `SNOOZE_MS = 24 * 60 * 60 * 1000`. 11 unit tests.
- **AppNotice.svelte**: onMount `Promise.all([import('$lib/storage/db'), …/meta, …/backup, …/live.svelte, …/secrets, '@tran/core'])` (there is no `$lib/storage` index, so it imports exact modules). It only uses type-only references to storage at module scope. Vault status syncs through `vault.onChange`. Markup follows the UI-SPEC App notice slot exactly (`role="region"`, `aria-labelledby="app-notice-title"`, accent-surface, 4px primary left rule, Lock / HardDriveDownload 20px icons, `mt-4 max-w-page px-6 md:px-8`). Download backup reuses `exportBackup`, has a busy state ("Preparing backup…"), and shows the Settings SectionError copy on BackupError. Remind me tomorrow writes `META.snoozedUntil`. Announcements: "Backup downloaded: {filename}." / "Backup reminder hidden until tomorrow.". The locked link is `${resolve('/settings/')}#key-security` (one justified eslint-disable line).
- **(app)/+layout.svelte**: `<AppNotice />` is the first child of `<main id="main-content">`, before `{@render children()}`, with the comment `<!-- Phase 4 inserts DataStatusBar before AppNotice (04-UI-SPEC). -->`. **Phase 4 hand-off:** add `<DataStatusBar />` on the line above `<AppNotice />`. That is a one-line change, and AppNotice needs no edits.
- `(marketing)` and `(print)` layouts are untouched (0 AppNotice references). Build check: `grep -rl "liveQuery|Dexie" build/_app/immutable/entry/` returned nothing. Neither `build/index.html` nor `build/renter/index.html` contains `app-notice-title`, because the notice is client-only after hydration.

## E2E (app-notice.spec.ts, root + sub, 12/12)

Data is seeded through the real Settings import UI with `page.clock.install({ time: 2026-10-01T10:00 local })`:
1. 6 days → no notice on `renter/`.
2. 8 days, never backed up → the notice shows on renter/investor/agent/settings with the never copy. It is `main > :first-child`, the region and its wrapper are `position: static`, and the page is CSP-clean.
3. Marketing `''` and `print/` show no region and no `#app-notice-title`, after first proving the notice is due on `renter/`.
4. Settings export on 10-01, then 10-08 → "Your last backup was 7 days ago. …".
5. The notice's Download backup gives a `tran-backup-YYYY-MM-DD.json` download, the announcement, and removes the notice. It stays gone after reload, and the flow is CSP-clean.
6. Remind me tomorrow removes the notice and announces. It stays gone after reload and comes back at +25h.

**Mutation proofs (root build):**
- `n >= days` → `n > days` in `backupReminderDue`: test 4 **failed** (no notice at 7 days), test 1 passed. Restored.
- `BACKUP_REMINDER_DAYS = 6`: test 1 **failed** (notice shown at 6 days), so the negative test is not vacuous. Restored and rebuilt.

**Stability:** 72/72 under `--repeat-each 6 --workers 6`. Test 4 failed once on root in the first full-suite run (425 others passed) and did not repeat in 3 isolated runs, the stress run, or a second full-suite run. It is probably a 5 s expect timeout under machine load from the parallel executor. Watch it in CI.

## Verification

- `pnpm check`: 0 errors, 0 warnings. eslint is clean on the plan files. `banned` and `ui:guard` pass. `test:unit` passes 577/577.
- `build:root`, `build:sub` and `csp:assert` pass (14 pages each).
- Full Playwright run: every pre-existing spec plus app-notice passes. The one failure in the second full run was `settings-security.spec.ts` "switching to This tab only while locked is refused" (2.0 min timeout). That is the parallel 03-12 executor's uncommitted in-progress spec, outside this plan's files, and it is left to 03-12.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - A11y] Focus moves to `#main-content` after the notice removes itself**
- **Found during:** Task 1
- **Issue:** Clicking Download backup or Remind me tomorrow unmounts the focused button, which drops keyboard focus to `<body>`.
- **Fix:** `focusMain()` calls `focus({ preventScroll: true })` on `#main-content` (already `tabindex="-1"`).
- **Files modified:** AppNotice.svelte
- **Commit:** 07b436a

The plan said to "re-evaluate" after an export. The `live()` liveQuery does this automatically, so there is no imperative re-evaluate call. This is an implementation choice and does not change behavior.

## Known Stubs

None. The locked variant is wired to the real vault status; its E2E is planned in 03-16, as the plan specifies.

## Commits

- 910356a test(03-15): add failing app notice logic tests
- 07b436a feat(03-15): app notice for overdue backups and locked keys
- 422d776 test(03-15): backup reminder notice E2E with controlled clock

## Self-Check: PASSED
