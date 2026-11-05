---
phase: 14-carried-debt
plan: 05
subsystem: backup-e2e
tags: [backup, e2e, settings, rentcast-budget, DEBT-05, PLAT-04]
requires:
  - "14-03 (memo artifact meta with notesNumbers; the seeded memo row uses memoArtifactMeta)"
provides:
  - "support/seed-all.ts: seedAllBackupTables(page), SEEDED, SEEDED_COUNTS, BACKUP_STORES, expectEveryTableSeeded(page)"
  - "backup-roundtrip.spec.ts: seed -> Settings export -> wipe -> preview import -> every portal -> 0 RentCast calls"
affects:
  - "14-11 (close-out: DEBT-05 is closed by this spec; the full verify chain runs it on root and sub)"
tech-stack:
  added: []
  patterns:
    - "Raw IndexedDB seeding refuses to run when the 'tran' database does not exist (indexedDB.open without a version would create an empty version 1)"
    - "In-place profile wipe sets the withRentCastKey seeded flag, so the tab really is keyless until the key is put back"
key-files:
  created:
    - apps/web/tests/e2e/support/seed-all.ts
    - apps/web/tests/e2e/backup-roundtrip.spec.ts
  modified: []
decisions:
  - "The database is opened at its current version by visiting renter/ first (the marketing home never opens it), then rows are seeded from the home page so no check-on-open pass races the write"
  - "savedSearches holds 2 rows (the renter saved search and the buy box each own a savedSearches row), every other table 1; the preview check reads SEEDED_COUNTS"
  - "Live and sample mode are checked on renter/ (Settings has no Data source bar)"
  - "The memo number is 19%, which is in the notes only; 12% was also derivable from the seeded deal facts, so the print check passed without the meta"
  - "The non-vacuity escape is a real app path: Watch ZIP on investor/markets/ spends one call through the counting mock"
metrics:
  duration: "~35 min"
  completed: "2026-11-05"
  tasks: 2
  files: 2
---

# Phase 14 Plan 05: Backup round-trip through the Settings UI Summary

One Playwright spec now seeds every registered backup table (18), downloads a backup with the Settings "Download backup" button, wipes the profile, imports the file through the preview, and checks that each portal shows its row again. The run uses live mode (a real-format test key) with the counting RentCast mock installed, and it spends 0 RentCast calls.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | seed-all.ts writes one schema-valid row per registered backup table | 956f4b6 | apps/web/tests/e2e/support/seed-all.ts |
| 2 | backup-roundtrip.spec.ts: seed, export, wipe, preview, import, portals, 0 RentCast calls | 67e5ef5 | apps/web/tests/e2e/backup-roundtrip.spec.ts, apps/web/tests/e2e/support/seed-all.ts |

## Tables exported (all 18, each with at least 1 row)

prefs (Settings, 1), ledger (RentCast call history, 1), savedSearches (Saved searches, 2), searchSnapshots (Saved search results, 1), dataPrefs (Data settings, 1), aiArtifacts (AI drafts, 1, an investor memo with the 14-03 `notesNumbers` meta), renterShortlist (Rental shortlist, 1), renterSearchMeta (Saved rental searches, 1), deals (Saved deals, 1), investorDraft (Deal analyzer draft, 1), buyBoxes (Buy boxes, 1), watchedZips (Watched ZIP codes, 1), contacts (Contacts, 1), tasks (Tasks, 1), activities (Activity, 1), agentProfile (Agent profile, 1, including both scan-exempt fields: a 1x1 PNG logo and a uuid-shaped placeholder form id), studioDraft (Studio forms, 1, the social tool), snapshots (Market Snapshots, 1, aggregate-only).

The spec checks that the file's table keys equal the 18 registered stores and that every table has `rows.length > 0`, by name. The preview row of every label reads `[label, count, '0', '0']`. The import result reads `Import complete. 19 added, 0 updated, 0 unchanged.` After the import, the raw row counts equal SEEDED_COUNTS again.

## Per-portal assertions after import

| Route | Assertion |
| ----- | --------- |
| renter/shortlist/ | "12 Maple Ct" visible |
| renter/ | live mode; saved search "Seeded rentals near Maple Ct" visible |
| investor/deals/ | heading "Seeded duplex on Maple Ct" |
| investor/buy-boxes/ | "Seeded Maple Ct buy box" visible |
| investor/markets/ | heading "ZIP 74201" (watched ZIP) |
| agent/contacts/ | "Avery Quill" visible |
| agent/today/ | task "Call Avery about the Maple Ct showing" visible (due today in the browser's local calendar) |
| agent/profile/ | "Full name" field has the value "Rowan Seedwell" |
| agent/studio/social/ | `#social-brief` restored from the Studio forms row |
| agent/studio/snapshot/ | `[data-snapshot-row=<id>]` contains "ZIP 74201" |
| investor/memo/?id=<deal> | the seeded memo text is visible |
| print/memo/?id=<deal>&memo=<artifact> | `[data-ready]` attached and the memo text is in the print sheet (the notes-only 19% prints, so the meta survived) |

The run ends with `expect(rentcastCalls(net)).toBe(0)`. The wipe is checked as well: every table count is 0 (the database is absent), renter/ shows sample mode, and Settings shows "Nothing to back up yet."

## Verification

- `playwright test backup-roundtrip.spec.ts settings-backup.spec.ts --project root --project sub`: 14 passed (22.6s). The round-trip ran in 12.0s (sub) and 12.8s (root).
- `playwright test backup-roundtrip.spec.ts --project root --repeat-each 3`: 3 passed (11.4s).
- `pnpm --filter web check`: 3270 files, 0 errors, 0 warnings. ESLint and Prettier clean on both files. Real-data guard and gitleaks passed on the staged files.
- The builds were reused: root, sub and configured were built after the last source commit (17:40) and this plan changes tests only, so `budget:assert` was not re-run and no shared code was added.

## Mutation ledger

All runs used `--project root --retries=0` through a scratchpad runner that applied the edit, ran the spec, and restored the files (git status confirmed only the intended changes after each run).

| # | Mutation | Expected | Observed | Restored |
| - | -------- | -------- | -------- | -------- |
| a | Seed with `skip: ['buyBoxes']` (and drop the immediate count check so the export check is reached) | every-table export check red, naming buyBoxes | `Error: buyBoxes`, Expected > 0, Received 0, at `expect(rows.length, name).toBeGreaterThan(0)` | yes; green |
| b | Skip the "Import backup" click (and the result and count checks after it) | portal assertions red | `getByText('12 Maple Ct').first()` not found on renter/shortlist/ | yes; green |
| c | Remove `addKeyNow(page)` after the wipe | live-mode check red, so the 0 is measured in live mode | Data source bar reads "Sample data ... Add a RentCast key", not "RentCast calls:" | yes; green |
| d | Deliberate escape: Watch ZIP 74202 on investor/markets/ before moving on | zero-call check red | `expect(rentcastCalls(net)).toBe(0)`: Expected 0, Received 1 | yes; green |
| e | Seed the memo with `{ analysisHash }` only (no notes numerals) | export meta check red | Expected "19", Received undefined | yes; green |
| f | As e, with the export meta check also disabled | print gate red | `[data-ready]` not found on print/memo/ | yes; green |

Mutation d shows that the counting mock is on the request path of a real app action, so the 0 is not vacuous.

## Deviations from Plan

**1. [Rule 1 - Bug] Seeding from the home page created an empty version 1 database**
- **Found during:** Task 2 (first run)
- **Issue:** The marketing home never opens the app database, so `indexedDB.open('tran')` without a version created an empty version 1 and the write failed with every store missing.
- **Fix:** The spec visits renter/ first (it opens the database at its current version and shows live mode), then seeds from the home page as planned. seedAllBackupTables now throws a clear error when the database does not exist, instead of creating it.
- **Files modified:** apps/web/tests/e2e/support/seed-all.ts, apps/web/tests/e2e/backup-roundtrip.spec.ts
- **Commit:** 67e5ef5

**2. [Rule 3 - Blocking] Settings has no Data source bar**
- **Found during:** Task 2
- **Issue:** The plan put `expectLiveMode` on settings/, but the bar is only on the portal pages.
- **Fix:** Live and sample mode are checked on renter/ before the export, after the wipe (sample), and after the key is put back (live).
- **Commit:** 67e5ef5

**3. [Rule 1 - Bug] The in-place wipe could not leave the tab keyless**
- **Found during:** Task 2 (designing mutation c)
- **Issue:** withRentCastKey's init script re-seeds whenever its sessionStorage flag is missing, so clearing sessionStorage brought the key back on the next load. Mutation c could never turn red.
- **Fix:** The wipe sets the flag after clearing storage, so the tab is keyless until `addKeyNow` writes the key back into the vault session store. The spec asserts sample mode in between.
- **Commit:** 67e5ef5

**4. [Rule 1 - Bug] 12% was not a notes-only number for the seeded deal**
- **Found during:** Task 2 (mutation f)
- **Issue:** With the notes meta removed, the print page still reached `[data-ready]`, because 12 is also in the seeded deal's allowed numbers. The print check was vacuous.
- **Fix:** The memo and notes use 19%. Mutation f is now red.
- **Commit:** 67e5ef5

**5. [Scope] Extra assertions**
- The spec also checks the Studio forms row (agent/studio/social/ brief restored) and the raw row counts before the export and after the import. Neither was in the plan; both are cheap and tighten the round-trip.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: apps/web/tests/e2e/support/seed-all.ts
- FOUND: apps/web/tests/e2e/backup-roundtrip.spec.ts
- FOUND: commits 956f4b6, 67e5ef5 (no Co-Authored-By trailers)
