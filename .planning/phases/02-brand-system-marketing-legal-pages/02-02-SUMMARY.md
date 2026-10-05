---
phase: 02-brand-system-marketing-legal-pages
plan: 02
subsystem: tooling/compliance
tags: [banned-terms, copy-compliance, ci, verify, BRND-02, BRND-04]
requires: []
provides:
  - "scripts/lib/banned-terms-rules.mjs (BANNED, SCOPE, SCANNED_EXT, EXCLUDED, findBanned)"
  - "scripts/banned-terms.mjs CLI (collectFiles, --root, fail-closed zero-files guard)"
  - "pnpm banned in verify; hygiene CI step; workflow-gate assertion"
affects:
  - "every later Phase 2 plan that writes copy under apps/web/src/routes, lib/components or lib/content"
tech-stack:
  added: []
  patterns:
    - "Pure rules module + thin CLI (mirrors real-data-rules.mjs / guard-real-data.mjs)"
    - "Whole-text regex matching with \\s+ joins so Prettier-wrapped phrases are caught"
key-files:
  created:
    - scripts/lib/banned-terms-rules.mjs
    - scripts/banned-terms.mjs
    - scripts/banned-terms.test.ts
  modified:
    - package.json
    - .github/workflows/ci.yml
    - scripts/workflow-gate.test.ts
decisions:
  - "collectFiles returns a sorted list so CLI output and test equality are deterministic"
  - "CLI header comment says 'filesystem (not the git index)' so the file never contains the literal ls-files (acceptance criterion)"
  - "No allowlist, per the UI-SPEC banned-terms contract"
metrics:
  duration: 5min
  completed: 2026-10-04
  tasks: 2
  files: 6
---

# Phase 2 Plan 02: Banned-terms Copy-Compliance Gate Summary

This plan adds a dependency-free banned-terms gate. A pure rules module holds 15 whitespace-tolerant, case-insensitive patterns. A CLI walks the scope folders on the filesystem with `fs` and fails closed on any hit or on an empty scope. The gate runs as `pnpm banned` inside `verify` and as a `hygiene` CI step, and a workflow-gate unit test fails if that step is removed.

## Tasks

| Task | Name | Commits | Files |
| ---- | ---- | ------- | ----- |
| 1 | Banned-terms rules module and CLI (TDD) | 8d3b300 (RED), b873d5e (GREEN) | scripts/lib/banned-terms-rules.mjs, scripts/banned-terms.mjs, scripts/banned-terms.test.ts |
| 2 | Wire gate into verify and CI hygiene | 5793916 | package.json, .github/workflows/ci.yml, scripts/workflow-gate.test.ts |

## Verification

- `corepack pnpm vitest run --project scripts banned-terms`: 43/43 pass. This covers 26 positives (including `best\n\t\tinvestments` and `We\nrepresent`), 7 UI-SPEC negatives, the planted `guaranteed returns` line reported at `a.svelte:2`, a Prettier-split phrase failing the CLI, clean copy printing `(1 files)`, the zero-files guard exiting 1, a `x.test.ts` file being excluded, and real-scope coverage checked against an independent walk.
- RED was confirmed before implementation: the suite failed because the modules did not exist yet.
- `node scripts/banned-terms.mjs` on the real repo prints `Banned-terms check passed (11 files)` and exits 0.
- `grep -c "node:fs" scripts/lib/banned-terms-rules.mjs` returns 0. `grep -c ls-files scripts/banned-terms.mjs` returns 0.
- The `uses:` count in ci.yml was **7 before and 7 after** the change.
- Grep checks for `"banned": "node scripts/banned-terms.mjs"`, `pnpm lint && pnpm banned && pnpm test:unit` and `run: node scripts/banned-terms.mjs` each return 1.
- **Mutation check:** with the ci.yml step reverted via `git checkout`, `vitest run --project scripts workflow-gate` failed: `× runs the banned marketing/legal terms gate`, 1 failed / 20 passed, exit 1. After the step was restored, 21/21 passed. The mutation was never committed.
- `corepack pnpm lint`, `corepack pnpm banned` and `corepack pnpm lint:workflows` all exit 0.
- `corepack pnpm test:unit` passed in full (188 tests, exit 0) on a run with no concurrent commits. See the note below.

## Deviations from Plan

**1. [Rule 3 - Blocking] Reworded the CLI header comment.** My first comment said "never `git ls-files`", which broke the acceptance criterion that the file must not contain `ls-files`. It now reads "on the filesystem (not the git index)". This was fixed before the Task 1 commit.

Otherwise, the plan was executed exactly as written.

## Notes

- **Parallel-execution flake (not a regression):** `precommit.test.ts` asserts that HEAD in this repository never moves during the suite. While 02-01 and another session were committing at the same time (HEAD moved dc0e145 -> a82039a mid-run), 3-5 precommit tests failed on that assertion. A run with no concurrent commit passed with exit 0. No change is needed. Sequential `pnpm verify` and CI are unaffected.
- The 11 files currently scanned are Phase 1 routes and components. Later plans add `lib/content` and the marketing and legal components, which are scanned automatically.

## Known Stubs

None.

## Self-Check: PASSED
