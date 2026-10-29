---
phase: 12-go-live-readiness-local-smoke-suite
plan: 02
subsystem: tooling
tags: [git, git-filter-repo, gitleaks, commit-hygiene, ci, history-rewrite]

# Dependency graph
requires:
  - phase: 12
    provides: "12-01 commit-hygiene.mjs --history mode and the commit-msg hook"
provides:
  - Rewritten history with zero assistant attribution in every ref (main + annotated v1.0)
  - Backup bundle, commit-map and ref-map outside the repo (the only undo)
  - Every quoted rewritten hash in tracked files remapped to its same-subject twin
  - gitleaks allowlist proven load-bearing and its re-derivation recorded in .gitleaks.toml
  - Recurrence guard in test:unit (this-repository history test) and in the CI hygiene job
affects: [12-03 rebuild (build dirs still carry pre-rewrite stamps), 12-10 phase gate, 13 LIVE-07 launch-audit regeneration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Message-only filter-repo callback that returns untouched any message without the trailer, so pre-range SHAs stay byte-identical"
    - "Hash remap by commit-map with a per-replacement subject check before any file is written"

key-files:
  created:
    - .planning/phases/12-go-live-readiness-local-smoke-suite/12-02-SUMMARY.md
  modified:
    - .gitleaks.toml
    - .github/workflows/ci.yml
    - scripts/commit-hygiene.test.ts
    - scripts/workflow-gate.test.ts
    - docs/LAUNCH-AUDIT.md
    - .planning/MILESTONES.md
    - .planning/research/PITFALLS.md
    - ".planning/phases/09-*, 10-*, 11-*, 12-* SUMMARY/VALIDATION/VERIFICATION/RESEARCH/PLAN files (46 files in total, list in remap-report.txt)"

key-decisions:
  - "Rewrite ran with no path filters and no remote; v1.0 was rewritten by filter-repo as an annotated tag on a commit with the identical tree"
  - "docs/LAUNCH-AUDIT.md (generated) had its Commit: hash substituted mechanically so it stays resolvable; Phase 13 LIVE-07 regenerates it"
  - "This SUMMARY names pre-rewrite hashes only by evidence-file reference, so remap-hashes.mjs --check stays at 0 stale tokens for 12-10"
  - "LIVE-01 is NOT marked complete here: 12-10 re-checks both history counts before the owner gate"

patterns-established:
  - "History hygiene guard in three layers: commit-msg hook (12-01), test:unit history test, CI hygiene step"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-10-29
---

# Phase 12 Plan 02: History rewrite without assistant attribution Summary

**git filter-repo removed all 145 model co-author trailers from the 240 commits after the first trailered one, while the 978 earlier commits, the HEAD tree, the v1.0 tree and both gitleaks-allowlisted SHAs stayed identical. 411 quoted hashes in 46 tracked files were remapped by subject, the allowlist was shown to be load-bearing (exactly 2 findings without it, 0 with it), and the recurrence guard now runs in `test:unit` and in the CI hygiene job.**

## Performance

- **Duration:** about 12 min
- **Started:** 2026-10-29T19:15:00Z
- **Completed:** 2026-10-29T19:27:00Z
- **Tasks:** 3/3
- **Files modified:** 50 (46 remapped, `.gitleaks.toml`, `ci.yml`, 2 test files)

## Census and rewrite (Task 1)

Backup and evidence directory (outside the repo, its parent is not a git repo):
`C:/Users/Mkaru/Documents/Hello_World/hugginface_profile/Websites/Tran/tran_real_estate-rewrite-2026-10-29/`

| Measure | Before | After |
| --- | --- | --- |
| Commits on HEAD | 1218 | 1218 |
| Model co-author trailers (`%(trailers)` count) | 145 | 0 |
| Broad attribution grep (trailer, noreply, footer, robot emoji) | not 0 | 0 |
| `commit-hygiene.mjs --history` | 145 attributed | `1218 commits scanned, 0 with assistant attribution` |
| HEAD tree | `1041401` | `1041401` (identical) |
| v1.0 tree | `f4dd5b5` | `f4dd5b5` (identical); `git cat-file -t v1.0` = `tag` |
| commit-map lines that changed | expected 240 | 240 |
| commit-map lines that stayed identical | expected 978 | 978 |
| gitleaks `secrets:scan` / `secrets:canary` | green | green (1217 commits scanned, no leaks; canary detected) |

- First changed commit ("test(09-24): add failing tests for exits inside the recheck window", 2026-10-13 10:57) is now `7f14834`. Its old hash is in `first-changed-commits` in the backup directory.
- After the rewrite, `main` pointed at `e85d183` (the 12-01 docs commit) and the v1.0 tag object is `fc4b1a3` on commit `8e70201`. Old values are in `ref-map`.
- Both allowlisted commits `4e453c1bbceefe392ad720eaa049bbd1dae8cc43` and `05793bfa1b15bc5d55d0650cea17e8f17707a27e` are still ancestors of main.
- Bundle: `tran_real_estate-pre-rewrite-2026-10-29.bundle`, 6,524,307 bytes. `git bundle verify` printed "is okay", and a test clone of the bundle had all 1218 commits.
- Saved next to it: `commit-map`, `ref-map`, `first-changed-commits`, `suboptimal-issues`, `already_ran`, `callback.py`, `pre-rewrite-log.tsv`, and the pre-count, pre-tree and expected-count files.
- `suboptimal-issues` lists one item: `20261004`, a date inside a message that filter-repo's hash-reference heuristic flagged. No commit was dropped, so this is harmless.
- `git remote -v` printed nothing before and after. Nothing was pushed.

## Remap and allowlist (Task 2)

- `remap-hashes.mjs` (in the backup directory, node builtins only) reported: **46 files changed, 411 tokens replaced, 167 distinct commits, 0 subject mismatches, 0 lengthened tokens**. The full report is in `remap-report.txt`.
- 21 replaced tokens were all digits (for example `c8a0e53` in 10-02-SUMMARY). I reviewed each one in context: they are all task-table or deviation commit references, not numbers.
- `remap-hashes.mjs --check` result: 456 files scanned, 0 stale tokens, and all 167 replacement targets resolve with `rev-parse --verify`.
- `.planning/STATE.md` quotes no commit hashes, so it needed no change. The 12-01 SUMMARY now quotes `8817d7f` and `cdc9872`.
- `docs/LAUNCH-AUDIT.md` is a generated file. Its `Commit:` hash was swapped mechanically on purpose so it stays resolvable until Phase 13 LIVE-07 regenerates it. It was not regenerated here.
- Allowlist re-derivation with gitleaks 8.30.1 and the `[allowlist]` table removed: exit 1 with **exactly 2 findings**, both `generic-api-key`:
  - `4e453c1…` in `packages/core/src/agent/schemas.test.ts`
  - `05793bf…` in `.planning/phases/08-agent-portal-profile-lead-intake-crm/deferred-items.md`
- With the table restored there were 0 findings. I also confirmed that a `commits`-only table and a `paths`-only table each clear both findings on their own, which is what the new comment claims. The `commits` and `paths` values are unchanged; only the comment above `[allowlist]` was replaced.

## Recurrence guard (Task 3)

- `scripts/commit-hygiene.test.ts` has a new `describe('this repository')` test. It runs `--history` on this repo and expects exit 0 and ` 0 with assistant attribution`. The scanned count must be > 1000 on a full clone and > 0 on a shallow one.
- `.github/workflows/ci.yml` hygiene job has a new step, "Commit messages carry no assistant attribution" (`run: node scripts/commit-hygiene.mjs --history`), after setup-node and before the gitleaks install. There are still exactly 7 `uses:` lines.
- `scripts/workflow-gate.test.ts` pins that step and checks it sits after the checkout and before `Scan full git history`.
- TDD: on the RED run, only the new workflow-gate test failed (59/60). After the ci.yml step was added, all 60/60 passed.
- Mutation proof: I created a throwaway attributed commit with `commit-tree` on a temporary ref (no reflog, main untouched). The repository test went red (`1 with assistant attribution`). I then deleted the ref and ran `git prune --expire=now`; the object no longer exists.
- Full `corepack pnpm test:unit`: **342 files, 6674 tests passed**. `pnpm lint` and `pnpm lint:workflows` are green.

## Task Commits

1. **Task 1: Back up, rewrite, prove**: no commit by design (only the object database and refs changed)
2. **Task 2: Remap quoted hashes and record the allowlist re-derivation**: `a60e17a` (chore)
3. **Task 3: Recurrence guard in test:unit and CI**: `fe7d076` (ci)

Both commits went through the real pre-commit and commit-msg hooks (no `--no-verify`). Neither has a trailer: `git log -2 --format=%B | grep -ciE "claude|anthropic|co-authored-by"` = 0.

## Restore

The bundle is the only undo. To return the repository exactly to its pre-rewrite state, run this from the repository root:

```bash
BK="C:/Users/Mkaru/Documents/Hello_World/hugginface_profile/Websites/Tran/tran_real_estate-rewrite-2026-10-29"
git fetch --force --update-head-ok "$BK/tran_real_estate-pre-rewrite-2026-10-29.bundle" 'refs/heads/main:refs/heads/main' 'refs/tags/v1.0:refs/tags/v1.0' && git reset --hard main
```

This also discards a60e17a, fe7d076 and any later commit, because they are not in the bundle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] remap-hashes.mjs `--check` refused to run after the Task 2 commit**
- **Found during:** Task 2 (the post-commit `--check`)
- **Issue:** As first written, the sanity guard required the current commit count to equal the pre-rewrite count, so it exited 2 as soon as a60e17a existed (1219 vs 1218). The plan's verify command, and 12-10, run `--check` after new commits.
- **Fix:** The guard now fails only when the current count is lower than the pre-rewrite count. Re-run: 0 stale, 0 unresolved.
- **Files modified:** `remap-hashes.mjs` in the backup directory (outside the repo)
- **Commit:** none (not tracked)

### Notes

- STATE.md was in the plan's expected remap set but quotes no hashes, so it was not touched.
- I used the hooks for both commits rather than the optional `--no-verify`.

## Issues Encountered

None. The Node clock check passed before the rewrite.

## Known Stubs

None.

## Next Phase Readiness

- The history is final for Phase 12, and later plans commit on top of it, so no further remap pass is needed.
- The `apps/web/build*` directories still carry pre-rewrite commit stamps. 12-03 rebuilds them; do not run E2E against the current build output.
- 12-10 should re-run `node scripts/commit-hygiene.mjs --history`, both `git log --all` counts and `remap-hashes.mjs --check` before the owner gate.

## Self-Check: PASSED
