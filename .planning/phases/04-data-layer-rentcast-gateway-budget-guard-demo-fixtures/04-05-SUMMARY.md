---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 05
subsystem: core/alerts
tags: [alerts, scheduler, diff, budget, tdd]
requires: []
provides:
  - "@tran/core alerts: SnapshotLike, ObservedItem, SnapshotDiff, buildSnapshot, diffSnapshots, countNewSince"
  - "@tran/core alerts: DUE_AFTER_MS, CLAIM_TTL_MS, CONFIRM_ABOVE, DueCandidate, isDue, dueSearches, planRun, RunPlan"
affects: [04-18 web alerts scheduler]
tech-stack:
  added: []
  patterns: ["pure scheduling decisions with injected now/used/cap", "truncation-safe diff (unknown vs gone)"]
key-files:
  created:
    - packages/core/src/alerts/index.ts
    - packages/core/src/alerts/diff.ts
    - packages/core/src/alerts/schedule.ts
    - packages/core/src/alerts/diff.test.ts
    - packages/core/src/alerts/schedule.test.ts
  modified: []
decisions:
  - "Off-market items (status 'Inactive' or removedDate set) are reported gone only if they were on-market in prev; never new, never price-changed"
  - "Prev items already off-market are not re-reported as gone on later runs"
  - "countNewSince ignores off-market items so the badge never counts removals"
  - "buildSnapshot keeps only observed items; ids dropped by a truncated window are not carried forward (reappearing later re-stamps firstSeenAt)"
metrics:
  duration: "~10 min"
  completed: 2026-10-05
  tasks: 2
  files: 5
---

# Phase 4 Plan 05: Alerts diff and run plan Summary

Pure check-on-open alerts logic in `packages/core/src/alerts/`: snapshot building with `firstSeenAt` carry-over, a truncation-safe `diffSnapshots` (new / price-changed / gone / unknown), `countNewSince` for the "N new since your last visit" badge, and `isDue` / `dueSearches` / `planRun`, which never schedule more uncached calls than `cap - used`.

## Tasks

| Task | Name | Commits |
| ---- | ---- | ------- |
| 1 | buildSnapshot, diffSnapshots, countNewSince | 71bebad (RED), 51b4896 (GREEN) |
| 2 | dueSearches and planRun | 093d878 (RED), 2a8d0e5 (GREEN) |

## Verification

- `corepack pnpm vitest run --project core src/alerts`: 2 files, 28 tests pass.
- Mutation checks (not committed, reverted):
  - Truncated guard dropped (`unknown` never produced) → 2 tests fail.
  - Cap admission changed to `<= cap + 1` → 5 tests fail.
- `tsc --noEmit` in packages/core: 0 errors in `alerts/`. `eslint packages/core/src/alerts`: clean. Prettier: clean.

## Deviations from Plan

None to behavior. Two notes:
- The full `corepack pnpm vitest run --project core`, `pnpm --filter @tran/core check` and `pnpm lint` currently fail only in `src/request/**` and `src/listings/**`, which are concurrent wave-1 plans with RED tests committed. Those are out of scope here. The alerts files are clean under every one of those tools when run scoped.
- `packages/core/package.json` has no `./alerts` subpath export yet. 04-01 owns that file, and this plan does not list it. Tests import relatively. Consumers (04-18) need `"./alerts": "./src/alerts/index.ts"` added by 04-01 or the phase gate.

## Known Stubs

None.

## Self-Check: PASSED
