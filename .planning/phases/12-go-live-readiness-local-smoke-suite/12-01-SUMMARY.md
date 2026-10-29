---
phase: 12-go-live-readiness-local-smoke-suite
plan: 01
subsystem: tooling
tags: [vitest, git-hooks, simple-git-hooks, commit-hygiene, launch-audit]

# Dependency graph
requires:
  - phase: 10
    provides: launch-audit generator (scripts/launch-audit.mjs) and the PITFALLS evidence map
provides:
  - PITFALLS_DOC constant, so launch-audit reads the archived v1.0 checklist through one path
  - scripts/commit-hygiene.mjs (ATTRIBUTION_PATTERNS, attributionOffences, stripCommentLines, parseLog + CLI)
  - commit-msg hook (simple-git-hooks) that rejects attributed messages before the commit exists
  - "--history mode, ready for 12-02 to wire into test:unit and CI after the rewrite"
affects: [12-02 history rewrite, 12-10 phase gate, ci hygiene job]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fail-closed node CLI behind the import.meta.url === pathToFileURL(argv[1]) guard, exit 2 on usage/git errors"
    - "Planted attribution strings are assembled at runtime in tests so the source never reads as a trailer"

key-files:
  created:
    - scripts/commit-hygiene.mjs
    - scripts/commit-hygiene.test.ts
  modified:
    - scripts/launch-audit.mjs
    - scripts/launch-audit.test.ts
    - package.json

key-decisions:
  - "LIVE-01 is NOT marked complete: this plan only installs the guard. The rewrite (12-02) and the final checks (12-10) finish it"
  - "The --message-file mode also drops everything below git's verbose-commit scissors line, so diff text in `git commit -v` can never trip the check"
  - "The PITFALLS_DOC JSDoc is worded without the literal old path, so the plan's own `grep .planning/research/PITFALLS` criterion stays empty"

patterns-established:
  - "Commit-message guard: pure pattern list + message-file hook + history scan, sharing one function"

requirements-completed: []

# Metrics
duration: 9min
completed: 2026-10-29
---

# Phase 12 Plan 01: Green test:unit + commit-msg hygiene guard Summary

**launch-audit now reads the archived v1.0 PITFALLS checklist through one `PITFALLS_DOC` constant (11 failing tests fixed, `pnpm test:unit` green at 6672/6672), and a simple-git-hooks commit-msg hook rejects any model co-author trailer, anthropic noreply address, "Generated with" footer, "Claude Code" mention or robot emoji before the commit is created.**

> Hash note: the hashes below will be remapped by 12-02. The history rewrite changes every commit after the first trailered one (fc71580, 2026-10-13), and that includes this plan's commits. Subjects stay the same; look commits up by subject after the rewrite.

## Performance

- **Duration:** about 9 min
- **Started:** 2026-10-29T19:05:00Z
- **Completed:** 2026-10-29T19:14:00Z
- **Tasks:** 2/2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- Baseline before Task 1: `vitest run --project scripts scripts/launch-audit.test.ts` = **11 failed | 17 passed (28)**. After: **29 passed (29)** (28 existing tests plus the new `PITFALLS_DOC` test).
- Full `corepack pnpm test:unit` is green: **342 files, 6672 tests passed** (first green run of v1.1). `corepack pnpm lint` passes.
- `node scripts/commit-hygiene.mjs --history` on this repository reports `1216 commits scanned, 145 with assistant attribution`. That is the same 145 that 12-RESEARCH counted with its broad grep, so the patterns catch exactly the known set. This scan is not in any test yet (12-02 adds it after the rewrite).
- Live proof: an `--allow-empty` commit carrying a model trailer was rejected in this repository by the installed hook (exit 1, HEAD unchanged). Task 2's own commit ran through the real pre-commit and commit-msg hooks without `--no-verify`.

## Task Commits

1. **Task 1: Repoint the launch audit at the archived v1.0 PITFALLS checklist** - `01072e2` (fix)
2. **Task 2: Commit-message hygiene check with a commit-msg hook** - `ac55917` (feat)

Neither commit has a trailer or mentions an assistant (`git log -2 --format=%B | grep -ciE "claude|anthropic|co-authored-by"` = 0).

## Files Created/Modified

- `scripts/launch-audit.mjs` - `export const PITFALLS_DOC = '.planning/milestones/v1.0-research/PITFALLS.md'`; `collect()` and the rendered checklist intro both use it
- `scripts/launch-audit.test.ts` - imports `PITFALLS_DOC`; adds a test that pins it
- `scripts/commit-hygiene.mjs` - five frozen patterns, `attributionOffences`, `stripCommentLines`, `parseLog`, and a CLI with `--message-file` and `--history`
- `scripts/commit-hygiene.test.ts` - 24 tests: product-content negatives, a human co-author allowed, one planted positive per pattern, scissors/comment stripping, the NUL log parser, CLI exit codes 0/1/2, `--history` on throwaway repos (1 offender, then clean after amend), package.json wiring, the installed hook, and an end-to-end temp-repo commit rejected by the package.json command
- `package.json` - `"commit-msg": "node scripts/commit-hygiene.mjs --message-file $1"`; `pre-commit` is byte-identical

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's JSDoc text conflicted with its own acceptance grep**
- **Found during:** Task 1
- **Issue:** The comment the plan specified contained `.planning/research/PITFALLS.md`. That made the criterion "`grep -n "\.planning/research/PITFALLS"` prints nothing" fail.
- **Fix:** Reworded it to "The v1.1 research overwrote the live research PITFALLS.md on 2026-10-29; the v1.0 copy is archived here."
- **Files modified:** scripts/launch-audit.mjs
- **Commit:** 01072e2

**2. [Rule 2 - Correctness] Scissors-line handling in --message-file**
- **Found during:** Task 2
- **Issue:** With `git commit -v`, git puts the staged diff below a `# --- >8 ---` line in the message file. Diff lines do not start with `#`, so dropping `#` lines alone would scan diff content. A diff of this very script would then reject a clean commit.
- **Fix:** `stripCommentLines` cuts at the scissors line before dropping `#` lines. A test covers it.
- **Files modified:** scripts/commit-hygiene.mjs, scripts/commit-hygiene.test.ts
- **Commit:** ac55917

**3. [Minor] Header comment wording**
- The plan's header comment said "assistant attribution" and "LLM providers". To follow the executor rule that added comments never mention assistants, the comment now says "tool attribution trailers" and "model providers". The stderr message is exactly the plan's text.

### TDD note

Task 2's RED step ran with the implementation moved aside, and the suite failed (`Cannot find module './commit-hygiene.mjs'`). Before the hook was wired, only the two wiring tests failed (22/24 passed). RED and GREEN went into one commit per task, not separate `test(...)` commits.

## Issues Encountered

None. The Node clock check passed and no load-sensitive tests failed.

## Known Stubs

None.

## Next Phase Readiness

- 12-02 can run the rewrite. The guard is in place, so no commit made after the rewrite can bring a trailer back. 12-02 should add the `--history` test against this repository and the CI step once the history is clean.

## Self-Check: PASSED
