---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 07
subsystem: compliance-gates
tags: [banned-terms, copy-compliance, fair-housing, studio, tdd]
requires:
  - phase: 02-brand-system-marketing-legal-pages
    provides: scripts/lib/banned-terms-rules.mjs (BANNED, SCOPE, findBanned) and scripts/banned-terms.mjs CLI
  - phase: 08-agent-portal
    provides: SCOPED_LISTS pattern (RENTER/INVESTOR/AGENT path-scoped lists)
provides:
  - STUDIO_SCOPE (features/studio/, routes/(app)/agent/studio/, routes/(print)/print/snapshot/)
  - STUDIO_BANNED (13 studio-only phrases, CMA case-sensitive)
  - SCOPE entry apps/web/src/lib/features/studio
  - path-aware findBanned applying BANNED + STUDIO_BANNED on studio paths
affects: [09-studio-ui-plans, 09-23-phase-gate]
tech-stack:
  added: []
  patterns: [path-scoped banned list appended to SCOPED_LISTS; still no allowlist]
key-files:
  created: []
  modified:
    - scripts/lib/banned-terms-rules.mjs
    - scripts/banned-terms.test.ts
key-decisions:
  - "Studio list wired as a fourth SCOPED_LISTS entry ({ scopes: STUDIO_SCOPE, list: STUDIO_BANNED }) instead of the plan's inline ternary; behavior is identical and matches the Phase 6-8 pattern"
  - "No allowlist: the UI-SPEC report labels (short/full label, checklist items, DisclosureStatus note, EHO statement) pass the studio gate verbatim"
  - "Studio route paths under routes/(app)/agent/ get AGENT_BANNED as well as STUDIO_BANNED (prefix overlap is intended)"
patterns-established:
  - "Studio phrase list: literal regexes with \\s+ between words so Prettier wraps still match"
requirements-completed: []
duration: 6min
completed: 2026-10-07
---

# Phase 9 Plan 07: Studio banned-terms scope and phrases Summary

**The banned-terms gate now covers the studio feature folder, the studio routes and the snapshot printout with 13 studio-only phrases (CMA, valuations, agent rankings, Fair Housing steering terms) and still has no allowlist; the UI-SPEC report labels pass verbatim and a planted "free CMA" fixture fails the CLI.**

## Performance

- **Duration:** about 6 min
- **Completed:** 2026-10-07
- **Tasks:** 2 (TDD RED, then GREEN)
- **Files modified:** 2

## Accomplishments
- `STUDIO_SCOPE`, `STUDIO_BANNED` exported. `SCOPE` gains `apps/web/src/lib/features/studio`. `findBanned` applies the studio list by path prefix through `SCOPED_LISTS`.
- 33 new tests in `describe('studio scope (Phase 9)')`: 20 positive phrase cases, a check that the list is exact, CMA case sensitivity, scoping (studio-only phrases plus global terms everywhere), 8 verbatim UI-SPEC negatives, studio route paths, the Prettier wrap case, CLI non-vacuity (studio fixture fails, the same line in components passes), collectFiles walking features/studio, lib/ai/prompts/studio and packages/core staying out of scope, and no allowlist export.
- The real-repo gate passes over 348 files, including the 6 studio/snapshot route pages that concurrent wave-1 executors created during this run.

## Task Commits

1. **Task 1: Failing studio scope tests (RED)**: `bbaf0fd` (test). 26 failed and 106 passed before the rules change.
2. **Task 2: STUDIO_SCOPE, STUDIO_BANNED, path-aware findBanned (GREEN)**: `25c1434` (feat)

## Verification
- `vitest run --project scripts banned-terms`: 132/132 passed
- `pnpm banned`: passed (348 files)
- `vitest run --project scripts`: 501/502. The one failure is `assert-csp.test.ts > EXPECTED_PAGES pins the Phase 8 agent pages`, caused by 09-09's uncommitted in-progress `scripts/assert-csp.mjs`. It is not in this plan's files.
- Mutation check (not committed): with the studio entry's scopes forced empty, 24 studio tests fail, including the CLI non-vacuity test. Reverted, and the file was confirmed restored.
- `grep -niE "NEGATED_ALLOW|allowlist *=|ALLOW_"` on the rules file finds nothing. The diff removes no line inside `BANNED`. The only `-` lines are the trailing-comma edits on `LEADS` and on the AGENT `SCOPED_LISTS` entry.
- Prettier and ESLint scoped to both files: clean. Repo-wide `pnpm lint` fails only on Prettier warnings in other executors' in-progress files: `packages/core/src/numbers/number-words.ts` and `packages/core/src/studio/{disclosure-format,disclosure-format.test,listing-facts.test}.ts`. These are out of scope and were not touched.

## Decisions Made
- I followed the established `SCOPED_LISTS` structure rather than adding the plan's separate ternary. The effect is the same: on studio paths, BANNED plus STUDIO_BANNED apply.

## Deviations from Plan

None. The plan executed as written apart from the structural note above, which is equivalent to the planned implementation. The plan's fallback for missing studio files was not needed: the CLI non-vacuity tests use temp trees, and real studio route files already existed by the time Task 2 ran.

## Issues Encountered
- My first scripted edit, a Python heredoc, turned `\b` into backspace characters. I caught this in the diff and rewrote the regexes as plain literals before testing or committing. The committed file contains no control characters.

## Next Phase Readiness
- Studio UI plans now have the full studio phrase list applied to their copy. Any planted violation in `features/studio`, `routes/(app)/agent/studio` or `routes/(print)/print/snapshot` fails `pnpm banned`.
- Requirement IDs STU-01 to STU-04 were deliberately not marked complete, because the phase gate (09-23) closes them.

## Self-Check: PASSED
- FOUND: scripts/lib/banned-terms-rules.mjs (contains STUDIO_SCOPE, STUDIO_BANNED)
- FOUND: scripts/banned-terms.test.ts (contains `studio scope (Phase 9)`)
- FOUND: commits bbaf0fd, 25c1434

---
*Phase: 09-agent-content-studio-market-snapshot-reports*
*Completed: 2026-10-07*
