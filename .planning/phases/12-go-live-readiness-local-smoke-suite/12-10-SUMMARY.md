---
phase: 12-go-live-readiness-local-smoke-suite
plan: 10
subsystem: infra
tags: [verify, smoke, phase-gate, git-history, commit-hygiene, go-live]

# Dependency graph
requires:
  - phase: 12-09
    provides: ten-spec smoke suite green on root, sub and configured (scripts/smoke.mjs --local)
  - phase: 12-02
    provides: rewritten history, commit-hygiene --history, backup bundle and remap-hashes.mjs
provides:
  - pnpm verify runs pnpm smoke:local right after pnpm test:e2e (pinned in workflow-gate.test.ts)
  - full Phase 12 gate green at one commit (a61db44), with the evidence below
  - final pre-remote history check (0 attributed commits by both counts, hygiene exit 0, no remote)
  - owner go-live gate handed over (DEPLOY-CHECKLIST Steps 1-6.1), Task 3 awaiting the owner
affects: [13 (first push, first CI run, PAGES_ENABLED), 14 (DEBT 5.4 origin-parity overlap), 15 (load determinism)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase gate run as stages A-G at one HEAD, each stage its own tool call under 7 minutes, build lock held from C through F"

key-files:
  created:
    - .planning/phases/12-go-live-readiness-local-smoke-suite/12-10-SUMMARY.md
  modified:
    - package.json
    - scripts/workflow-gate.test.ts

key-decisions:
  - "smoke:local sits after test:e2e and before audit:deps: the three builds exist at HEAD inside verify, Playwright ownership stays sequential, and it is the only local gate for the served stamp and the configured-origin proof at the HTTP layer (about 65 s measured, under the 2.5-3 min estimate)"
  - "LIVE-01 closed here on the final stage-G evidence; LIVE-05 left unticked: its local half is done, and ROADMAP says it is ticked when Phase 13 records the live half"
  - "Phase 12 is not marked complete in ROADMAP: gsd-tools ticked the phase and the 12-10 line, which were reverted because Task 3 (the owner gate that closes the phase) is pending"
  - "Task 2 made no commit: the gate found no failures, so deferred-items.md was not touched"

patterns-established:
  - "Close-out gate order: audit first, then static checks and unit, then builds under the lock, then E2E per project, then smoke, then guards and extension, then history"

requirements-completed: [LIVE-01, LIVE-04, LIVE-08, SMOKE-01, SMOKE-02, SMOKE-03, SMOKE-05, SMOKE-06]

# Metrics
duration: 29min
completed: 2026-10-29
---

# Phase 12 Plan 10: Phase Close (smoke in verify, full gate, owner hand-off) Summary

**`pnpm verify` now runs `pnpm smoke:local` right after the E2E suite (pinned by a test). The full Phase 12 gate passed at one commit, `a61db44`: 6,803 unit tests, 2,335 E2E tests over three projects, 363 smoke tests in 63.7 s, all guards and the extension suite, and a clean history (0 attributed commits by both counts, 1,251 commits scanned, no remote). The go-live steps are now with the owner.**

## Performance

- **Duration:** about 29 min
- **Started:** 2026-10-29T20:36:00Z
- **Completed:** 2026-10-29T21:05:00Z
- **Tasks:** 2 of 3 done (Task 3 is the owner gate and is awaiting the owner)
- **Files modified:** 2

## Accomplishments

- `package.json` `verify`: `... && pnpm test:e2e && pnpm smoke:local && pnpm audit:deps && ...`. The ext tail is unchanged.
- `scripts/workflow-gate.test.ts`: new test `verify runs the local smoke right after the E2E suite`. It checks that `smoke:local` is `node scripts/smoke.mjs --local`, that `pnpm smoke:local` appears exactly once, that the exact ` && pnpm test:e2e && pnpm smoke:local && pnpm audit:deps && ` segment is present, and that it comes after `build:configured` and `test:e2e` and before `ext:build`. The ext-tail test was not changed.
- The whole phase gate passed at one HEAD, with no commits between stages.

## Phase gate at a61db44 (stages A-G, no commits in between)

Build stamp: all three builds logged `BUILD_SHA=a61db4485b142bcd0364a09be3769fd8d8a251c8`. Node clock check passed before the gate. `.tools/build.lock` was held from stage C through stage F and then released (`test ! -d .tools/build.lock` passed).

| Stage | Command | Result | Duration |
| --- | --- | --- | --- |
| A | `corepack pnpm audit --audit-level low` | exit 0, 4 low already ignored, no new advisories | 3 s |
| B | `corepack pnpm check` | exit 0 | 18 s |
| B | `corepack pnpm lint` | exit 0 | 90 s |
| B | `corepack pnpm banned` | exit 0 | 1 s |
| B | `corepack pnpm ui:guard` | exit 0 | <1 s |
| B | `corepack pnpm test:unit` | exit 0, 349 files, 6803 tests passed | 67 s |
| C | `corepack pnpm build:root` / `build:sub` / `build:configured` | exit 0 each | 17 s / 17 s / 18 s |
| C | `corepack pnpm csp:assert` | exit 0 (45 pages per build) | 1 s |
| C | `corepack pnpm seo:assert` | exit 0 (44 pages, 14 sitemap URLs, 6 share cards) | 1 s |
| C | `corepack pnpm budget:assert` | exit 0 (5 gated routes within 60 KB) | 4 s |
| D | `playwright test --project=root` | exit 0, 1151 passed | 472 s (7.9 min) |
| D | `playwright test --project=sub` | exit 0, 1143 passed, 4 skipped | 474 s (7.9 min) |
| D | `playwright test --project=configured` | exit 0, 41 passed | 18 s |
| E | `corepack pnpm smoke:local` | exit 0, 363 passed, zero retries | 65 s wall (63.7 s reported) |
| F | `corepack pnpm guard` | exit 0 (1908 files) | 2 s |
| F | `corepack pnpm fixtures:check` | exit 0 (6 files) | 2 s |
| F | `corepack pnpm secrets:canary` | exit 0 (canary detected) | 2 s |
| F | `corepack pnpm secrets:scan` | exit 0, 1250 commits scanned, no leaks | 2 s |
| F | `corepack pnpm lint:workflows` | exit 0 | 1 s |
| F | `corepack pnpm ext:build` | exit 0 | 24 s |
| F | `corepack pnpm ext:assert` | exit 0 (6 files, zip root verified) | <1 s |
| F | `corepack pnpm ext:test:browser` | exit 0, 13 passed | 7 s |
| F | `corepack pnpm ext:e2e` | exit 0, 7 passed | 5 s |

Every stage passed on its first run. None of the load-sensitive specs listed in STATE.md (ResultsView browser test, precommit.test.ts, ReDoS budgets, studio boundaries, renter-saved) failed, so `deferred-items.md` was left alone. The precommit.test.ts item from 12-04 did not recur in this full run.

The root and sub Playwright projects each ran for about 7.9 minutes. That is longer than the 7-minute per-call cap, so they ran in the background and were polled. No retries were added and no timeouts were changed.

### Smoke timing (stage E, `corepack pnpm smoke:local`, builds stamped a61db44)

| Target | Base | Tests | Result | Seconds |
| --- | --- | --- | --- | --- |
| root | http://127.0.0.1:4273/ | 121 | pass | 19.9 |
| sub | http://127.0.0.1:4274/tran_real_estate/ | 121 | pass | 21.8 |
| configured | http://127.0.0.1:4276/ | 121 | pass | 21.9 |
| **total** | | 363 | exit 0 | **63.7** (budget 300) |

### Final history check (stage G, LIVE-01)

| Check | Result |
| --- | --- |
| `git log --all --format='%(trailers:key=Co-Authored-By,valueonly)' \| grep -ciE 'anthropic\|claude'` | `0` |
| `git log --all -i -E --grep='co-authored-by:.*(claude\|anthropic)\|noreply@anthropic\.com\|generated with \[?claude\|claude code\|🤖' --format=%H \| wc -l` | `0` |
| `node scripts/commit-hygiene.mjs --history` | `1251 commits scanned, 0 with assistant attribution`, exit 0 |
| `git remote -v` | (empty) |
| `git cat-file -t v1.0` | `tag` |
| `remap-hashes.mjs --check` (backup dir, per 12-02) | `467 files scanned, 0 stale tokens, 0 unresolved replacements (of 167)` |
| `secrets:scan` / `secrets:canary` | green (stage F) |

Compared with 12-02: 1218 commits right after the rewrite, 1251 now, and still 0 attributed. The backup bundle is still at `../tran_real_estate-rewrite-2026-10-29/`.

## Notes

- Phase 14 overlap: the origin-parity test of DEBT item 5.4 is partly delivered here (TRAN_ORIGIN resolves from the web resolver; popup.browser.test.ts pins the default PRIVACY_URL; scripts/site-url.test.ts proves the derivation). Phase 14 should only add the docs/edge-listing/install-guide literal checks and the anchor-id-in-source check.
- LIVE-05 local half done (checklist + pinned Search Console slot); the live half (Search Console verified, sitemap read) is recorded in Phase 13 under LIVE-06/GTM-04.

## Task Commits

1. **Task 1: smoke:local joins pnpm verify:** `a61db44` (build). TDD: RED was 1 failed and 36 passed (the new pin failed on the count of `pnpm smoke:local`, which was 0). GREEN was 37 of 37 after the `package.json` change. The plan asked for a single commit for the task, so the RED and GREEN steps were not committed separately.
2. **Task 2: phase gate at one commit, final history check:** no commit by design. The gate made no commits, and with no failures there was nothing to record in `deferred-items.md`.
3. **Task 3: owner gate:** awaiting the owner (checkpoint:human-action). No org, repo or remote was created, and nothing was pushed.

The Task 1 commit went through the real pre-commit and commit-msg hooks. `git log -1 --format=%B | grep -ciE "claude|anthropic|co-authored-by"` returned `0`.

## Requirements

- LIVE-01 ticked in this plan. LIVE-04, LIVE-08 and SMOKE-01/02/03/05/06 were already ticked by 12-03, 12-07, 12-08 and 12-09, and this gate re-proved them.
- LIVE-05 deliberately stays unticked, even though it is in this plan's requirements list. ROADMAP Phase 12 says "LIVE-05 is ticked when Phase 13 records it", and REQUIREMENTS.md now reads "Pending (local half done; live half in Phase 13)".

## Deviations from Plan

None. The plan ran as written. ROADMAP state was corrected by hand (see key-decisions). The only extra was the `remap-hashes.mjs --check` that 12-02 recommended for 12-10; it passed.

## Issues Encountered

None.

## Known Stubs

None.

## Owner gate (Task 3, pending)

The owner follows `docs/DEPLOY-CHECKLIST.md` Step 1 (create org `tranrealestate`), Step 2 (empty public repo `tranrealestate.github.io`), Step 3 (Pages Source = GitHub Actions), Step 4 (Dependabot alerts + security updates), Step 5 (secret scanning + push protection), then Step 6.1:

```sh
git remote add origin https://github.com/tranrealestate/tranrealestate.github.io.git
git push -u origin main
git push origin v1.0   # optional
```

`PAGES_ENABLED` stays unset. Steps 6.2-6.3 (first green CI, then `PAGES_ENABLED=true` plus an empty commit) belong to Phase 13.

## Build-dir state for Phase 13

All three build directories are stamped `a61db44`. The docs commit for this SUMMARY moves HEAD, so they are stale by design. Rebuild all three before any local `smoke:local` run.

## Self-Check: PASSED

- `package.json`, `scripts/workflow-gate.test.ts` and this SUMMARY are present; commit `a61db44` is present.
