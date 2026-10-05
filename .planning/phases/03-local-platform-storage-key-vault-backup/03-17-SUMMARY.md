---
phase: 03-local-platform-storage-key-vault-backup
plan: 17
subsystem: phase-gate
tags: [validation, mutation-ledger, human-uat, pwa, docs]
requires:
  - phase: 03-local-platform-storage-key-vault-backup
    provides: "plans 03-01..03-16 (vault, storage, backup, PWA, Settings UI, a11y/CSP gate)"
provides:
  - "Signed-off 03-VALIDATION.md (status complete, 37 rows green, 28-row mutation ledger)"
  - "03-HUMAN-UAT.md: 9 deferred real-device checks"
  - "README 'Local data, API keys and backups' section"
affects: [phase-04-data-gateway, verify-work]
tech-stack:
  added: []
  patterns: ["per-row validation walk: every Automated Command run on its own, then one composed verify"]
key-files:
  created:
    - .planning/phases/03-local-platform-storage-key-vault-backup/03-HUMAN-UAT.md
    - .planning/phases/03-local-platform-storage-key-vault-backup/deferred-items.md
  modified:
    - .planning/phases/03-local-platform-storage-key-vault-backup/03-VALIDATION.md
    - README.md
key-decisions:
  - "Real-device install/persistence checks are deferred HUMAN-UAT (non-blocking) until tranrealestate.github.io exists"
  - "A load-only E2E flake (import preview click not reflected in 5 s) is tracked in deferred-items.md, not papered over with a longer timeout"
requirements-completed: [PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, PLAT-06]
duration: ~40min
completed: 2026-10-05
---

# Phase 3 Plan 17: Phase gate, validation walk and device UAT Summary

**The Phase 3 gate (`corepack pnpm verify`, now including `ui:guard`) passed in one 210-second run. All 37 validation rows were run one at a time and passed. 28 recorded mutation proofs are consolidated in a ledger, and 9 real-device checks are queued as deferred HUMAN-UAT.**

## Performance

- **Duration:** about 40 min
- **Completed:** 2026-10-05
- **Tasks:** 2/2
- **Files modified:** 4 (+1 deferred-items log)

## Accomplishments

- **Composed gate:** `corepack pnpm verify` exited 0 in one invocation with a **210 s wall time**. It covered 577 unit tests in 37 files, 14 pages × 2 bases through `csp:assert`, 454 E2E passed with 2 skipped, guard, secrets canary and scan, and actionlint. The tree was clean apart from the untracked new 03-HUMAN-UAT.md draft, which no gate scans.
- **Row walk:** I ran each Automated Command in the Per-Task Verification Map on its own, in table order, and all 37 exited 0. The two rows that run the full suite (3-03-02, 3-16-02) both got 454 passed / 2 skipped. Statuses are now ✅ green, the File Exists cells are flipped, and a walk note was added.
- **Mutation ledger:** the 28 rows come from the 03-02..03-16 SUMMARYs. All 15 mutation classes the plan requires are covered, each with the named test that failed. The table also includes 03-03's static oracle mutations, 03-04's receiver bonus, 03-07's cross-tab bonus, 03-15's non-vacuity mutation and 03-16's overlay-paint mutation. No mutation had to be re-run, because every required class already had a recorded failing test.
- **Sign-off:** frontmatter is now `status: complete`, `nyquist_compliant: true`, `wave_0_complete: true`. All Wave 0 and sign-off boxes are checked, with `Approval: approved 2026-10-05`.
- **03-HUMAN-UAT.md** (status `deferred`, `blocking: false`) has 9 items, each with exact steps, the expected result and where to record evidence:
  1. Android install
  2. Desktop Chrome/Edge install
  3. iPhone Add to Home Screen
  4. iPad desktop-UA detection
  5. Firefox persistent-storage permission prompt
  6. Safari persistence
  7. Offline launch in airplane mode
  8. Firefox session restore (accepted limitation)
  9. Optional real-key smoke test

  It points to docs/DEPLOY-CHECKLIST.md Steps 1-7 as the prerequisite. Every UI string it quotes was grepped against the components.
- **README:** new "Local data, API keys and backups" section. It covers session-only keys by default, the `tran-secrets` IndexedDB, PBKDF2 600k + AES-GCM protecting keys at rest only, forget-all across tabs, `tran-backup-v1` backups that never contain keys with a Merge/Replace preview, a service worker that never touches API traffic, where the code lives, and `ui:guard` plus the shadcn `add` procedure. I also fixed stale facts:
  - `ui:guard` was missing from the commands table and the verify order.
  - The `/settings/` row still read "placeholder until Phase 3".
  - The verify duration still read "under two minutes".
- **REQUIREMENTS.md:** PLAT-01..06 were already `[x]` with `Complete` traceability. The plan's node check passes, so the file needed no edit.

## Task Commits

1. **Task 1: Composed verify, validation-row walk, mutation ledger**: `568265a` (docs)
2. **Task 2: HUMAN-UAT checklist, README, requirements**: `70568cb` (docs)

## Files Created/Modified

- `.planning/phases/03-local-platform-storage-key-vault-backup/03-VALIDATION.md`: statuses, walk note, mutation ledger, sign-off
- `.planning/phases/03-local-platform-storage-key-vault-backup/03-HUMAN-UAT.md`: device checklist (new)
- `.planning/phases/03-local-platform-storage-key-vault-backup/deferred-items.md`: E2E flake record (new)
- `README.md`: platform section, command table, verify order, Settings route

## Decisions Made

- Device checks stay deferred and non-blocking, the same policy as Phase 1's live-origin evidence and Phase 2's 02-HUMAN-UAT.
- The first-run E2E flake was not "fixed" by raising timeouts. There is no deterministic root cause yet, so it is logged with instructions for capturing a trace next time.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale README facts**
- **Found during:** Task 2
- **Issue:** The README listed `verify` without `ui:guard`, the commands table had no `ui:guard` row, `/settings/` was described as "placeholder until Phase 3", and the verify run time read "under two minutes" (it is now about 210 s).
- **Fix:** Corrected all four in the same README edit.
- **Files modified:** README.md
- **Commit:** 70568cb

### Not changed

- REQUIREMENTS.md already had PLAT-01..06 checked and `Complete` (set by earlier plans), so it is not in either commit.

## Issues Encountered

- **First `verify` attempt failed 2 of 456 E2E tests under full parallel load:**
  - `app-notice.spec.ts` "never-backed-up notice at 8 days on every app page" [root]
  - `settings-backup.spec.ts` "fresh-profile import with preview" [sub]

  In both, a click on the import preview (Import backup / Close) was not reflected within the 5 s expect timeout. Neither reproduced: both specs passed 140/140 with `--repeat-each 5`, the second full `verify` passed in one invocation, and both full-suite rows of the walk passed. 03-15 recorded the same symptom once. The rerun overwrote the first run's traces, so the root cause is still open. Next steps are in `deferred-items.md`.

## Deferred Issues

- Load-dependent import-preview E2E flake (see `deferred-items.md`).
- 9 real-device HUMAN-UAT items (see `03-HUMAN-UAT.md`), blocked only on the owner creating the `tranrealestate` GitHub org and Pages origin.

## User Setup Required

None now. The device UAT runs after docs/DEPLOY-CHECKLIST.md Steps 1-7.

## Next Phase Readiness

- Phase 3 is ready for `/gsd:verify-work`. All five success criteria have automated proof on both bases, and the device-only checks are queued in 03-HUMAN-UAT.md.

## Self-Check: PASSED

- FOUND: 03-HUMAN-UAT.md, 03-VALIDATION.md (status complete, nyquist_compliant true, 28 ledger rows, no pending cells), deferred-items.md, README.md section
- FOUND commits: 568265a, 70568cb
