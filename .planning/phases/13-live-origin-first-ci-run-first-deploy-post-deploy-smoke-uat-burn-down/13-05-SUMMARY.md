---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 05
subsystem: docs
tags: [human-uat, ledger, text-oracle, vitest, live-07]

# Dependency graph
requires:
  - phase: 01-12
    provides: the twelve per-phase ??-HUMAN-UAT.md files (99 owner-run rows under the counting rule)
  - phase: 13 research
    provides: 13-RESEARCH.md "HUMAN-UAT enumeration" (counting rule, tally, L01-L99 classification, P13 rows)
provides:
  - .planning/HUMAN-UAT.md: one ledger with 99 origin rows (L01-L99) plus P13-1..P13-4, each with origin id, title, class, result and evidence
  - scripts/human-uat-ledger.test.ts: no-row-dropped oracle (LIVE-07) that derives the 99 ids from the per-phase files and validates the ledger
  - twelve per-phase files marked status: superseded with superseded_by: .planning/HUMAN-UAT.md (bodies kept as history)
affects: [13-13, 13-14, 13-15, 13-16, 13-17, 13-18, 13-19, 13-21, 14, 17]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ledger oracle: pure exported helpers (parseOriginIds, parseLedger, ledgerProblems) + planted-defect tests built by string-editing the real ledger in memory"
    - "Per-phase file discovery walks .planning/phases/*/ and .planning/milestones/** and asserts each phase 01..12 is found exactly once, so a milestone archive cannot silently drop rows"

key-files:
  created:
    - .planning/HUMAN-UAT.md
    - scripts/human-uat-ledger.test.ts
  modified:
    - .planning/phases/01-foundation-origin-security-baseline/01-HUMAN-UAT.md
    - .planning/phases/02-brand-system-marketing-legal-pages/02-HUMAN-UAT.md
    - .planning/phases/03-local-platform-storage-key-vault-backup/03-HUMAN-UAT.md
    - .planning/phases/04-data-layer-rentcast-gateway-budget-guard-demo-fixtures/04-HUMAN-UAT.md
    - .planning/phases/05-ai-layer-providers-streaming-fair-housing-guardrails/05-HUMAN-UAT.md
    - .planning/phases/06-renter-portal/06-HUMAN-UAT.md
    - .planning/phases/07-investor-portal/07-HUMAN-UAT.md
    - .planning/phases/08-agent-portal-profile-lead-intake-crm/08-HUMAN-UAT.md
    - .planning/phases/09-agent-content-studio-market-snapshot-reports/09-HUMAN-UAT.md
    - .planning/phases/10-launch-hardening-go-to-market/10-HUMAN-UAT.md
    - .planning/phases/11-zillow-sponsored-listing-filter-extension/11-HUMAN-UAT.md
    - .planning/phases/12-go-live-readiness-local-smoke-suite/12-HUMAN-UAT.md

key-decisions:
  - "13-05: HUMAN-UAT count is 99 under the counting rule (one ### heading under ## Tests, or one | X<n> | table id); the roadmap's 77 was a miscount of the 06/07 tables (27 rows, not 8); the ledger header and the oracle record this"
  - "13-05: L92 (Showcase badge) recorded as decided 2026-10-29 from REQUIREMENTS EXT-F3 instead of pending; every other owner-decision row stays pending or carried because no other decision is recorded in PROJECT.md/REQUIREMENTS.md"
  - "13-05: the two task commits land superseded-files first, then ledger + test, so each commit is green at its own HEAD (the superseded tests live in the same oracle file as the last describe block)"

patterns-established:
  - "Ledger row grammar: | L<nn> | <phase>-<rowid> | title | class | result | evidence |; class in {smoke, human, owner-decision, cut} joined by ' + '; result starts with pending/passed/failed/carried/decided/cut/not applicable; passed needs evidence, passed smoke needs /actions/runs/"

requirements-completed: []

# Metrics
duration: 9min
completed: 2026-10-30
---

# Phase 13 Plan 05: Human-UAT ledger consolidation Summary

**One `.planning/HUMAN-UAT.md` ledger holds all 99 owner-run rows from Phases 1-12 (L01-L99) plus four Phase 13 rows, with a Vitest text oracle that derives the 99 ids from the twelve superseded per-phase files and fails if any row is dropped, duplicated or misclassified.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-10-30T11:36Z
- **Completed:** 2026-10-30T11:45Z
- **Tasks:** 2
- **Files modified:** 14 (2 created, 12 frontmatter edits)

## Accomplishments

- `.planning/HUMAN-UAT.md`: 99 origin rows copied from the research classification (Id, Origin, Title, Class verbatim; L87 is `smoke + human`) plus P13-1..P13-4. Header states the counting rule, the real count (99), that "77" was a miscount, and that `scripts/human-uat-ledger.test.ts` enforces the rule. Initial results as recorded today: 1 passed (L98, run 40961373692), 1 decided (L92, REQUIREMENTS EXT-F3), 4 cut (L23, L24, L71, L97), 10 carried (L66 DEBT-02, L79-L81 Phase 14 owner decisions, L89 DEBT-09, L90/L91/L93/L95/L96 Phase 17), 83 pending with owner and target (plan 13-21 for the push-protection probe and CORS rows; Phase 13 go-live for the smoke and GTM rows).
- `scripts/human-uat-ledger.test.ts` (24 tests, `scripts` Vitest project): `parseOriginIds` implements the counting rule, `findUatFiles` walks `.planning/phases/*/` and `.planning/milestones/**` and asserts phases 01..12 are each found exactly once, `parseLedger` + `ledgerProblems` check contiguity, origin completeness/uniqueness, class and result vocabularies, and the two evidence rules. Five planted-defect tests (removed row, duplicated row, class `maybe`, passed smoke without a run link, passed with empty evidence) prove the oracle bites.
- Twelve per-phase files: `status: superseded`, `superseded_by: .planning/HUMAN-UAT.md`, one pointer line after the frontmatter; bodies untouched (the oracle's 99-id derivation over the edited files proves it).

## Task Commits

1. **Task 2: Mark the twelve per-phase files superseded** - `ec6f9e5` (docs)
2. **Task 1: Ledger oracle test (RED) then the ledger (GREEN)** - `ecce27a` (docs)

Commit order is 2 then 1 on purpose: the superseded-frontmatter tests are the last describe block of the same oracle file, so committing the twelve files first keeps both commits green at their own HEAD (the plan's "finish Task 2 before committing" note). The RED run before the ledger existed: 4 passed (parser + 99-id derivation), 20 failed. GREEN after the ledger: 12 passed, 12 superseded tests failed. After Task 2: 24/24.

## Files Created/Modified

- `.planning/HUMAN-UAT.md` - the consolidated ledger (99 + 4 rows, counting rule, classes/results vocabulary, tally)
- `scripts/human-uat-ledger.test.ts` - no-row-dropped oracle (LIVE-07)
- `.planning/phases/??-*/??-HUMAN-UAT.md` (12) - frontmatter status/superseded_by + pointer line

## Decisions Made

- Count is 99, "77" was a miscount: the roadmap figure counted the 06/07 owner tables as 8 rows; they hold 12 + 15 = 27. Recorded in the ledger header; the oracle hard-codes the per-file counts (3,3,9,14,10,12,15,7,8,8,8,2) as the recorded truth.
- L92 uses the decision already recorded in REQUIREMENTS.md EXT-F3 (`decided 2026-10-29: Showcase stays excluded by default`). A grep of PROJECT.md and REQUIREMENTS.md found no other recorded decision for the owner-decision rows, so they stay `pending (owner)` or `carried`.
- `findUatFiles` also walks `.planning/milestones/**` so the oracle keeps working after the v1.1 archive moves phase directories.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 02-HUMAN-UAT.md has CRLF line endings in the working copy**
- **Found during:** Task 2
- **Issue:** The supersede script asserted a `---\n` frontmatter start; file 02 starts `---\r\n` (working copy CRLF; git stores LF under `core.autocrlf=input`).
- **Fix:** The script normalises to LF for the edit and restores CRLF for that file, so the diff is exactly the frontmatter lines (1 deletion, 3 insertions per file).
- **Files modified:** scratchpad script only; the committed blob is LF as before.
- **Commit:** ec6f9e5

**2. [Rule 1 - Lint] `no-useless-assignment` in the new test**
- **Found during:** Task 1 targeted eslint run
- **Issue:** `let phaseDirs: string[] = []` followed by assignment in both try and catch branches.
- **Fix:** Declared without the initialiser.
- **Commit:** ecce27a

None of these change the plan's behaviour. Everything else executed as written.

## Not done here (orchestrator / wave)

- `roadmap update-plan-progress 13` and `requirements mark-complete LIVE-07` were NOT run: the parallel-execution instructions reserve ROADMAP.md and REQUIREMENTS.md for plan 13-01 during this wave. LIVE-07's consolidation half is done; its burn-down half (plans 13-13..13-19, 13-21) is still open, so LIVE-07 should not be ticked yet anyway.
- Full `pnpm lint` / `pnpm test:unit` left to the orchestrator after the wave; this executor ran only `prettier --check` + `eslint` on the new test file and the targeted Vitest command.

## Issues Encountered

None beyond the two auto-fixes above.

## Known Stubs

None. Evidence cells with `—` are intentional "nothing recorded yet" markers for non-passed rows, documented in the ledger's "Classes and results" section and enforced by the oracle (a `passed` result with `—` fails).

## Next Phase Readiness

- Plans 13-13..13-19 and 13-21 fill Result/Evidence cells in `.planning/HUMAN-UAT.md`; the oracle keeps the row set fixed and rejects a `passed` smoke row without a `/actions/runs/` link.
- Phase 14 (DEBT-02, DEBT-09, owner decisions) and Phase 17 (extension release) inherit the `carried` rows L66, L79-L81, L89, L90, L91, L93, L95, L96.

## Self-Check: PASSED

- FOUND: .planning/HUMAN-UAT.md (99 L rows, 4 P13 rows)
- FOUND: scripts/human-uat-ledger.test.ts (24 tests green)
- FOUND: commit ec6f9e5 (twelve files superseded)
- FOUND: commit ecce27a (ledger + oracle)
- Hygiene: `git log -1 --format=%B | grep -ciE "co-authored-by|claude|anthropic"` printed 0 for both commits
