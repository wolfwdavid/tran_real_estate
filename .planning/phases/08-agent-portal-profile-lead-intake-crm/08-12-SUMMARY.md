---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 12
subsystem: agent-storage
tags: [dexie, indexeddb, crm, backup, transactions, live-query]
requires:
  - "08-01 @tran/core/agent/{types,schemas} (Contact, Task, Activity, AgentProfile, CONTACT_MAKING)"
  - "08-09 @tran/core/crm applyMove"
  - "08-05 @tran/core/leads/inquiry-params ACCESS_KEY_RE"
  - "Phase 3 getDb/_resetDb, live(), backup registry, buildBackupText/previewImport/applyImport, META.firstRecordAt"
provides:
  - "Dexie v6 block: contacts, tasks, activities, agentProfile (AGENT_STORES)"
  - "$lib/storage/agent/tables: table names, AGENT_RECORD_SCHEMA_VERSION, PROFILE_ROW_ID, AgentProfileRow, contactsTable/tasksTable/activitiesTable/agentProfileTable"
  - "$lib/storage/agent/profile-repo: getProfile, saveProfile, saveAccessKey"
  - "$lib/storage/agent/contacts-repo: addContact, buildContactRecord, getContact, listContacts, findDuplicates, updateContact, moveStage, undoMove, logContact, setOptOut, markFollowupSent, deleteContact, listActivities, ADDED_TEXT, MoveUndo, NewContact, LogType"
  - "$lib/storage/agent/live.svelte: useContacts, useContact, useActivities, useProfile ({ current, error, loaded })"
  - "$lib/storage/agent/backup: AGENT_BACKUP_TABLES, agentProfileRowSchema, AGENT_PROFILE_SCAN_EXEMPT_PATHS"
  - "BackupTable.scanExemptPaths (Phase 3 registry + export scan)"
affects: [08-14 tasks + CSV import commit, 08-15+ CRM UI, 08-22 profile UI, 08-23 inquiry intake]
tech-stack:
  added: []
  patterns:
    - "Free-function repos over the getDb() singleton; tests isolate with _resetDb() + getDb(freshIdb())"
    - "Contact write first, activity write second, inside one rw transaction (a failing activity rolls the contact back)"
    - "Singleton domain id 'profile' mapped to a fixed uuid row id at the repo boundary"
key-files:
  created:
    - apps/web/src/lib/storage/agent/tables.ts
    - apps/web/src/lib/storage/agent/backup.ts
    - apps/web/src/lib/storage/agent/backup.test.ts
    - apps/web/src/lib/storage/agent/profile-repo.ts
    - apps/web/src/lib/storage/agent/profile-repo.test.ts
    - apps/web/src/lib/storage/agent/contacts-repo.ts
    - apps/web/src/lib/storage/agent/contacts-repo.test.ts
    - apps/web/src/lib/storage/agent/live.svelte.ts
  modified:
    - apps/web/src/lib/storage/db.ts
    - apps/web/src/lib/storage/db.test.ts
    - apps/web/src/lib/storage/backup-registry.ts
    - apps/web/src/lib/storage/backup-registry.test.ts
    - apps/web/src/lib/storage/backup.ts
    - apps/web/src/lib/features/investor/deals/dealsRepo.test.ts
decisions:
  - "Dexie version 6 = AGENT_STORES (one additive block after Phase 7's v5)"
  - "Profile row id is the fixed uuid 00000000-0000-4000-8000-000000a6e170: the Phase 3 backup envelope requires uuid ids, so an id of 'profile' would make every backup with a profile fail import. profile-repo maps row <-> domain id 'profile'; the backup validator is agentProfileSchema with id = PROFILE_ROW_ID"
  - "Key scan exemptions by PATH only (agentProfile logo.base64, web3formsAccessKey) via a new optional BackupTable.scanExemptPaths; the export scans a copy of the tables with only those values blanked. Needed because random base64 can contain the Gemini key shape (about 1 in 100 for a 300 KB logo)"
  - "setOptOut is a no-op (no duplicate activity) when the contact is already in the requested state"
  - "useContact/useProfile return null while loading; callers read `loaded` to tell loading from missing"
metrics:
  duration: ~45 min
  completed: 2026-10-06
  tasks: 2
  files: 14
---

# Phase 8 Plan 12: Agent CRM persistence layer Summary

This plan adds the agent CRM's IndexedDB layer:

- **Tables.** A new Dexie version 6 adds `contacts`, `tasks`, `activities` and `agentProfile`, using the index strings from the research notes.
- **Profile repo.** The singleton profile has an upsert, and the Web3Forms access key has its own setter.
- **Contacts and activities repo.** Every change that also writes an activity happens in one rw transaction.
- **Live views.** Svelte 5 wrappers over Phase 3's `live()`.
- **Backups.** All four tables are registered for backup. The two profile values that could look like keys are exempt from the key scan by path.

## Phase 3 APIs used

- `getDb` / `_resetDb` / `TranDb` (db.ts), with the v6 block appended.
- `live()` (live.svelte.ts).
- Backup registry `DEFAULT_TABLES`, the same built-in-list path Phases 4 to 7 use. `registerBackupTable` now also keeps `scanExemptPaths`.
- `buildBackupText`, `previewImport` and `applyImport` (backup.ts).
- `META.firstRecordAt`. `addContact` and `saveProfile` set it, as `createRepo` and the deals repo do.
- `newSyncable` / `tombstone` from `@tran/core`.
- `freshIdb()` and `fakeKey()` in the tests.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Tables, profile repo, backup registration with scan exemptions | 721bb6b, 7679396, 984e2d5 (ASCII-only test fixes) |
| 2 | Contacts/activities repo, transactional move/undo, live views | 710ffc0, 7c43408 (Phase 7 schema test follow-up) |

## Verification

- `vitest --project web`: 122 files, 1913 tests passed. The agent storage tests are 47: profile 9, backup 6 and contacts 32.
- `pnpm check` reported 0 errors and `pnpm lint` (prettier + eslint) was clean.
- `pnpm secrets:scan` found no leaks. The `scripts` project's agent-boundary test was green.
- `contacts-repo.ts` has 8 `transaction('rw'` calls.

**Mutation tests.** I applied each mutant, confirmed the tests went red, then restored the code.

- Removing `AGENT_BACKUP_TABLES` from the registry failed 12 tests, including the registered-XOR-excluded coverage test.
- Scanning the raw text instead of the exempt-path view failed 2 tests.
- Removing the v6 block failed 38 tests.
- I ran the callback outside its transaction for 7 functions: moveStage, undoMove, addContact, logContact, setOptOut, markFollowupSent and deleteContact. Each one failed its atomicity test.

**logContact write order.** logContact first wrote the activity and then the contact, so a failure on the activity write left no partial state. That order meant the atomicity test could not detect a missing transaction. I swapped it so the contact is written first, then the activity, which matches the other functions, and the test now catches it.

## Deviations from Plan

1. **[Rule 1 - Bug] The profile id breaks backup import.** `SyncableSchema` in the envelope requires a uuid `id`, but the 08-01 domain profile uses the literal `'profile'`. Every backup that included a profile would have failed import with `invalid`. The fix is that the stored row uses `PROFILE_ROW_ID`, a fixed uuid like Phase 7's `DRAFT_ID`, and the repo maps it to `'profile'`. Core types are unchanged.
2. **[Rule 2] A real false positive in the key scan.** The scanner has no entropy or uuid heuristic, but its Gemini shape can match inside random base64. I added `BackupTable.scanExemptPaths` and had the export scan a copy with only those values blanked, which follows the plan's "extend the scanner minimally" fallback. The vault-exact-value and shape checks still run on every other field. Tests show that a key-shaped value in a contact note, and a vault value in another profile field, are still refused.
3. **[Rule 3] Existing tests pinned to version 5.** `db.test.ts` (table list, verno), `backup-registry.test.ts` (DEFAULTS) and the Phase 7 `dealsRepo.test.ts` schema test were updated for v6. I also added a v5 to v6 upgrade test that checks Phase 7 rows are kept and checks the agent indexes.
4. **Extra exports.** `LogType`, `LiveView`, `AgentProfileRow`, `PROFILE_ROW_ID`, `agentProfileRowSchema` and `AGENT_PROFILE_SCAN_EXEMPT_PATHS`.
5. **Process note.** A `git commit --amend` on my own fix commit landed after a parallel 08-17 docs commit and folded my one-line change into it. I reset `--soft` to that commit, which restored e4cc342 exactly (empty tree diff), and re-committed my change separately as 984e2d5. I did not amend again.

## Requirements advanced

AGT-01 (profile persistence), AGT-03 (dedupe keys and lookups) and AGT-04 (stage moves with Undo, activity log) are advanced at the storage layer. Per the orchestrator, `requirements mark-complete` was not run.

## Known Stubs

None. `useTasks()` is intentionally left to plan 08-14, as the plan specifies.

## Self-Check: PASSED
