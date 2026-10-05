---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 07
subsystem: lint-boundaries
tags: [eslint, flat-config, budget-guard, data-port, tdd]
requires: []
provides:
  - "no-restricted-syntax $effect/$effect.pre RentCast spend ban (shared restrictedSyntax array)"
  - "DATA_INTERNALS no-restricted-imports pattern: only $lib/data is importable outside lib/data"
affects: [04-17 (public $lib/data port), every wave 2-3 data-layer and portal plan]
tech-stack:
  added: []
  patterns:
    - "Shared rule-option arrays re-merged into every flat-config entry that sets the same rule"
    - "Mutation check on the merge: removing DATA_INTERNALS from portal entries fails 3 cases"
key-files:
  created: []
  modified:
    - eslint.config.js
    - scripts/eslint-rules.test.ts
key-decisions:
  - "Catch-all data-port entry sits before marketing/portal entries and ignores lib/data/**; portal entries re-merge DATA_INTERNALS; marketing keeps forbidding all of data"
  - "Spend-call list: get, refresh, testKey, rentalListingById, runDue, runDueSearches on objects named *gateway/*scheduler (case-insensitive); peek is the allowed reactive read"
requirements-completed: [DATA-03, DATA-04]
metrics:
  duration: 5min
  completed: 2026-10-05
  tasks: 2
  files: 2
---

# Phase 4 Plan 07: Data-layer lint boundaries Summary

ESLint now rejects any gateway/scheduler spend call inside `$effect`/`$effect.pre` and any import past the `$lib/data` port from outside `lib/data`. Both rules are proven by in-memory `lintText` cases. The existing fetch ban, marketing ban and portal boundaries still fire.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Failing lint cases for the $effect spend ban and data-port boundary (RED: 9 new cases failed, 24 old passed) | c2dd45b |
| 2 | Merge the $effect selector and DATA_INTERNALS into eslint.config.js (GREEN: 33/33) | 0ac0ef1 |

## Verification

- `corepack pnpm vitest run --project scripts eslint-rules`: 33/33 pass.
- Mutation: removing `DATA_INTERNALS` from the portal entries makes 3 cases fail. This shows the flat-config replacement hazard (Pitfall 6) is real and that the merge is load-bearing.
- `corepack pnpm eslint .` on the real tree: exit 0. `prettier --check` on both owned files is clean.
- `corepack pnpm lint` (prettier step) currently fails only on `packages/core/src/alerts/diff.test.ts` and `packages/core/src/budget/budget.test.ts`. These are in-progress files from parallel wave-1 plans and are out of scope here.
- `vitest --project scripts`: everything passes except `precommit.test.ts`, which hits the documented HEAD-moved flake while parallel executors commit.

## Deviations from Plan

None. The plan was executed as written. The test fixtures declare `gateway`/`dataGateway`/`scheduler` types so the virtual files parse cleanly. The `beforeAll` also asserts that the renter and features/shared `__lintfix__` folders are virtual.

## Known Stubs

None.

## Self-Check: PASSED
