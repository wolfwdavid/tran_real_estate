---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 01
subsystem: planning-docs
tags: [github-pages, origin, base-path, ci-baseline, human-uat, dependabot, privacy-copy, owner-decisions]

# Dependency graph
requires:
  - phase: 12-go-live-readiness-local-smoke-suite
    provides: "wolfwdavid/tran_real_estate pushed, Pages source = GitHub Actions, first ci.yml runs green with deploy skipped"
provides:
  - "ROADMAP Phase 13, REQUIREMENTS LIVE-02/03/07 and PROJECT.md name the real origin https://wolfwdavid.github.io/tran_real_estate/"
  - "LIVE-02 complete with the three green run links (40961373692, 40965347969, 40980243892) and the CI baseline table in PROJECT.md"
  - "HUMAN-UAT count corrected to 99 rows with the counting rule recorded"
  - "Project-instructions Origin rule aligned to D-01..D-05 (decision A applied)"
  - "Owner decisions B and C recorded verbatim for plan 13-07"
affects: [13-07, 13-08, 13-11, 13-12, 13-13, 13-19, phase-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Owner decisions are captured verbatim in the SUMMARY of the plan that asked, and applied by the plan that owns the file"

key-files:
  created:
    - .planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-01-SUMMARY.md
  modified:
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/PROJECT.md
    - CLAUDE.md

key-decisions:
  - "Origin = PUBLIC_SITE_URL=https://wolfwdavid.github.io (origin only) + BASE_PATH=/tran_real_estate; one helper composes origin and base for web and extension (D-01..D-04)"
  - "HUMAN-UAT count is 99 rows, not 77 (06/07 owner lists were 27 rows, not 8)"
  - "Project-site robots.txt is inert; sitemap.xml in Search Console plus noindex layouts carry the crawl policy (accepted)"
  - "Owner decision A: project-instructions Origin rule replaced with the project-site line (A-approve)"
  - "Owner decision B: @types/node majors go into the Dependabot ignore list with a Phase 14/16 comment (B-ignore; applied by 13-07)"
  - "Owner decision C: privacy 'Deleting your data' copy names the shared storage origin and points to Forget all keys (C-approve; applied by 13-07)"

patterns-established:
  - "Decision handoff: plan 13-07 greps `Decision B:|Decision C:` in this file instead of re-asking the owner"

requirements-completed: [LIVE-02]

# Metrics
duration: 2 sessions (Task 1 + checkpoint 2026-10-30 07:39; Task 3 2026-10-30)
completed: 2026-10-30
---

# Phase 13 Plan 01: Planning-docs reconciliation to the real origin Summary

**ROADMAP, REQUIREMENTS, PROJECT and the project instructions now name `https://wolfwdavid.github.io/tran_real_estate/`; LIVE-02 is closed on three observed green CI runs; the 99-row HUMAN-UAT count and the owner's A/B/C decisions are on record for the plans that apply them.**

## Performance

- **Duration:** two executor sessions split by the owner checkpoint (Task 1 committed 2026-10-30 07:39 -0400; Task 3 later the same day)
- **Started:** 2026-10-30
- **Completed:** 2026-10-30
- **Tasks:** 3 of 3 (Task 2 was a blocking owner decision checkpoint)
- **Files modified:** 4 (+ this SUMMARY)

## Accomplishments

- Phase 13 section of ROADMAP.md names only the real origin, the corrected `/tran_real_estate/renter` redirect, the 99-row count, the `PUBLIC_SITE_URL` + `BASE_PATH` variable pair, and the observed CI baseline; Phase 14 SC3 is annotated with the 13 D-04 wording so DEBT-03 is not written against the old sentence.
- REQUIREMENTS.md: LIVE-02 checked with the three run IDs and its traceability row set to Complete; LIVE-03 and LIVE-07 reworded to the real origin and 99 rows and left unchecked (they close in 13-13 and 13-19).
- PROJECT.md: the dedicated-org out-of-scope line and Key Decisions row are marked superseded 2026-10-29; six new Key Decisions rows (origin composition, 99-vs-77 count, inert project robots.txt, owner decisions A/B/C); the CI baseline table sits under the Phase 12 status paragraph.
- Project instructions: the "Never deploy under `wolfwdavid.github.io`" Origin override is replaced with the project-site rule (decision A), so future sessions no longer read a rule that contradicts the deployed origin.

## Owner decisions

The owner's verbatim reply to the Task 2 checkpoint was: "A-approve, B-ignore, C-approve".

Decision A: A-approve — `- **Origin:** \`https://wolfwdavid.github.io/tran_real_estate/\`, a project site under the owner's account (decision 2026-10-29). \`PUBLIC_SITE_URL\` is the origin only (\`https://wolfwdavid.github.io\`) and \`BASE_PATH=/tran_real_estate\`. Browser storage is shared with sibling project sites on that origin (accepted; revisit with a custom domain).` (applied to the project instructions in `5fa624d`)

Decision B: B-ignore — add `@types/node` majors to the `.github/dependabot.yml` ignore list with a comment naming Phase 14/16 (applied by plan 13-07; this plan only records it)

Decision C: C-approve — "Deleting your data" copy, both paragraphs, applied by plan 13-07 (this plan only records it):
Paragraph 1 (always): "To remove the keys Tran has stored, open Settings and choose **Forget all keys**. Saved searches, deals, contacts and drafts can be deleted where you saved them, or all at once by clearing site data in your browser settings."
Paragraph 2 (rendered only when the site runs under a sub-path, so a future custom domain drops it): "This site shares its browser storage area with other sites hosted at {host}. Clearing site data in your browser settings also clears what those sites stored, and a key you chose to remember on this device can be read by scripts on those sites. Keys stay session-only unless you choose to remember them."
({host} is rendered from the build's site origin, never hard-coded.)

## Task Commits

1. **Task 1: Reconcile ROADMAP, REQUIREMENTS and PROJECT to the real origin and record the CI baseline** - `036d0e3` (docs)
2. **Task 2: Owner decisions A, B and C** - checkpoint, no commit (owner replied "A-approve, B-ignore, C-approve")
3. **Task 3: Apply decision A and record A, B, C** - `5fa624d` (docs)

**Plan metadata:** see the final `docs(13-01)` commit on this SUMMARY.

## Files Created/Modified

- `.planning/ROADMAP.md` - Phase 13 goal, depends-on, success criteria 1/2/5, owner-steps variable list; Phase 14 SC3 annotation
- `.planning/REQUIREMENTS.md` - LIVE-02 checked with run IDs and traceability Complete; LIVE-03 and LIVE-07 reworded, still unchecked
- `.planning/PROJECT.md` - superseded org lines, CI baseline table, six Key Decisions rows (three origin/count/robots, three owner decisions)
- `CLAUDE.md` - Research Reconciliation Overrides: Origin line replaced (decision A); nothing else touched
- `.planning/phases/13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down/13-01-SUMMARY.md` - this file, read by plan 13-07 for decisions B and C

## CI baseline (re-verified read-only in Task 1)

All three runs: `success push main skipped` (conclusion, event, head branch, deploy job).

| Run | Head SHA | hygiene | root | sub | configured |
|-----|----------|---------|------|-----|------------|
| https://github.com/wolfwdavid/tran_real_estate/actions/runs/40961373692 | 62d9973 | 8 s | 27m03s | 21m33s | 6m08s |
| https://github.com/wolfwdavid/tran_real_estate/actions/runs/40965347969 | 396b5aa | 8 s | 21m52s | 26m13s | 5m36s |
| https://github.com/wolfwdavid/tran_real_estate/actions/runs/40980243892 | eed27e6 | 8 s | 26m38s | 25m29s | 5m30s |

## Decisions Made

- Decision rows for B and C are written as "✓ Phase 13" in PROJECT.md even though 13-07 applies the file edits: the owner's call is final now; 13-07 only executes it.
- Decision A was applied in the same commit as the PROJECT.md rows (one `docs(13)` commit), with the SUMMARY carried by the plan-metadata commit, as the plan allows.

## Deviations from Plan

None - plan executed exactly as written. Wave-1 plans 13-02, 13-03, 13-04, 13-05 and 13-20 landed between Task 1 and Task 3; CLAUDE.md and PROJECT.md were re-read before editing and the target lines were unchanged.

## Issues Encountered

None.

## Known Stubs

None. This plan edits planning documents only.

## Handoff to later plans

- **13-07**: apply Decision B (`.github/dependabot.yml` ignore for `@types/node` majors, comment "Phase 14/16") and Decision C (privacy `+page.svelte` "Deleting your data", two paragraphs, `{host}` from the build's site origin via `resolveSiteUrl()`; second paragraph only under a sub-path). The banned-terms gate still applies to the new copy.
- **13-08**: the runbook's Dependabot policy cites Decision B.
- **13-13 / 13-19**: LIVE-03 and LIVE-07 remain unchecked here on purpose; they close once the deploy lands and the ledger is burned down.

## Self-Check: PASSED

- `036d0e3` and `5fa624d` exist in `git log`.
- `grep -c "Never deploy under" CLAUDE.md` = 0; `grep -c "wolfwdavid.github.io/tran_real_estate/" CLAUDE.md` = 1.
- `grep -cE "Owner decision (A|B|C)" .planning/PROJECT.md` = 3.
- LIVE-02 `[x]` with the three run IDs; LIVE-03 and LIVE-07 `[ ]`.
- Both task commits: `git log -1 --format=%B | grep -ciE "co-authored-by|claude|anthropic"` = 0.
