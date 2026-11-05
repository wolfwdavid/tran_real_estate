---
phase: 14-carried-debt
plan: 02
subsystem: agent-studio-snapshot
tags: [save-gate, copy, fair-housing, e2e, DEBT-02]
requires:
  - "14-01 (serialized for the shared build dirs and Playwright ports)"
provides:
  - "NOTES_REVIEW_REASON constant and a pluralizing notesFindingsReason in save-gate.ts"
  - "Unit cases for review-only (0), singular (1), plural (2+), must-fix-over-review priority and a never-'Fix the 0' sweep"
  - "Snapshot builder E2E: warn-only draft shows the full 4c string, Save refused, acknowledgement enables Save"
affects: [14-11 (full verify chain runs these specs on all projects)]
tech-stack:
  added: []
  patterns:
    - "Gate reasons mirror panel-controller.ts: a constant for the review-only string and an n === 1 ? singular : plural builder for the must-fix string"
key-files:
  created: []
  modified:
    - apps/web/src/lib/features/studio/snapshot/save-gate.ts
    - apps/web/src/lib/features/studio/snapshot/save-gate.test.ts
    - apps/web/tests/e2e/snapshot-builder.spec.ts
decisions:
  - "The E2E activates Save right after typing the Review phrase (urgent path) and asserts focus plus the full 4c string, then repeats the refusal after Done editing, so both the urgent and the settled gate are pinned before the acknowledgement"
  - "The old clear-the-phrase step is kept after the acknowledgement as a short regression check that Save stays open; the must-fix removal earlier in the same test already covers the clearing path"
metrics:
  duration: "~12 min"
  completed: "2026-11-05"
  tasks: 2
  files: 3
---

# Phase 14 Plan 02: Market Snapshot save-gate reason copy Summary

The Market Snapshot Save gate now reads "Fix the 1 item ..." for one Must fix, "Fix the {n} items ..." for two or more, and "Review the flagged phrases in the market notes and check the box in step 3 to continue." for a review-only, unacknowledged draft (strings copied verbatim from 14-UI-SPEC §DEBT-02). Unit cases and a warn-only E2E pin all three.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 (RED) | Failing unit cases for 4a/4b/4c, priority and never "Fix the 0" | 5e1a431 | save-gate.test.ts |
| 1 (GREEN) | NOTES_REVIEW_REASON + pluralizing notesFindingsReason, split gate line | 425390c | save-gate.ts (+8/-2) |
| 2 | Warn-only E2E: 4c text, refusal (focus, URL), acknowledgement enables Save | fbba721 | snapshot-builder.spec.ts |

## Verification

- `vitest run --project web save-gate.test.ts`: RED 5 failed / 21 passed, then GREEN 26/26.
- `grep -rn "notesFindingsReason\|NOTES_REVIEW_REASON" apps/web/src`: no consumer outside save-gate.ts and its test.
- Built root and sub, then ran `snapshot-builder.spec.ts` + `snapshot-print.spec.ts` on `--project root --project sub`: 20 passed (24.5s). The print spec is unchanged (D-01 cap of 6 untouched).
- Rebuilt root and configured after the E2E mutant and ran `pnpm budget:assert`: both builds pass (9 gated routes within 60 KB, 5 reported; for-* at 59.8 KB, unchanged, since the snapshot builder is not on a marketing route).
- eslint + prettier clean on the three files.
- Acceptance greps: 4c string in save-gate.ts = 1, 4a string = 1, `R.fix(0)` in the test = 0; in the spec "check the box in step 3 to continue." = 1, "items? marked Must fix" = 1, "do not lock it in" = 0, "They describe the property, not who should live there." = 1.

## Mutation ledger

| # | Mutant | Result | Restored |
| - | ------ | ------ | -------- |
| a | `if (s.notesOn && s.unackedReview) return notesFindingsReason(s.mustFix);` in save-gate.ts | Unit: 2 failed ("unacknowledged review only", "never \"Fix the 0\"") | 26/26 green |
| b | Drop the `n === 1` branch of `notesFindingsReason` | Unit: 4 failed ("one must-fix", "must-fix wins over review", "never \"Fix the 0\"", "priority order") | 26/26 green |
| c | Mutant (a) built into root, E2E keyless test on root | Failed at snapshot-builder.spec.ts:202 toHaveText: expected the 4c string, received "Fix the 0 items marked Must fix in the market notes, and review any others." | Rebuilt root, 1 passed |

## Deviations from Plan

None in scope. Two small execution notes:
- The E2E asserts focus before the 4c text on the urgent (still editing) path, then asserts the text again after Done editing and refuses a second time before checking the box. The plan listed the text assertion first; both orders are covered now.
- The mutation step's restore trap ran `git checkout` from `apps/web` and missed the path; the file was restored by hand right after (verified with grep and `git status`) before the green rebuild.

## Known Stubs

None.

## Self-Check: PASSED
