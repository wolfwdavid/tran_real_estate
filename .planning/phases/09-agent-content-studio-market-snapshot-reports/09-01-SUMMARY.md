---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 01
subsystem: core-studio
tags: [studio, disclosure, platforms, hashtags, team-name, compliance, tdd]
requires:
  - "Nothing from earlier phases at runtime (pure TS in packages/core/src/studio); Phase 8 packages/core/src/disclosure read for naming only, unchanged"
provides:
  - "packages/core/src/studio/disclosure-format.ts: Platform, PLATFORMS, PLATFORM_LIMITS, HASHTAG_CAPS, PLATFORM_LABELS, SAFETY_MARGIN, DisclosureProfile, DisclosureVariant, DisclosureField, DISCLOSURE_FIELD_LABELS, BROKERAGE_PHONE_STATES, missingFor, brokerageLine, PrintDisclosure, FormattedDisclosure, formatDisclosure, appendDisclosure, hashtagBlock, postBudget, AssembledPost, assemblePost"
  - "packages/core/src/studio/team-name.ts: LICENSE_TYPE_OPTIONS, StudioWarning, validateTeamName, validateLicenseTitle"
affects: [09-10, 09-11, 09-12, 09-13, 09-14, 09-15, 09-16]
tech-stack:
  added: []
  patterns:
    - "Disclosure is code-assembled and always last; over-limit posts report `over > 0` and are never sliced"
    - "Seeded 32-bit LCG property loop (seed 9, 500 iterations x 3 platforms) instead of fast-check"
    - "Glyphs built with String.fromCharCode / String.fromCodePoint so .ts sources stay ASCII"
    - "Unicode-aware word boundaries (?<![\\p{L}\\p{N}]) / (?![\\p{L}\\p{N}]) with the `iu` flags for team-name words"
key-files:
  created:
    - packages/core/src/studio/disclosure-format.ts
    - packages/core/src/studio/disclosure-format.test.ts
    - packages/core/src/studio/team-name.ts
    - packages/core/src/studio/team-name.test.ts
  modified: []
decisions:
  - "brokerageLine with a team but an empty brokerage returns the team alone (no dangling ' at '); the missing brokerage is still reported by missingFor"
  - "postBudget counts the capped tag block (tags.slice(0, HASHTAG_CAPS[platform])), matching what assemblePost actually emits"
  - "Team-name warnings quote the word as the agent typed it (e.g. 'Group', 'Realty'), one warning per forbidden word in list order; words listed with a trailing period (Corp., Inc.) also match without the period"
  - "TX suffix rule: the trimmed name must end with the whole word Team or Group (case-insensitive)"
metrics:
  duration: "~9 min"
  completed: 2026-10-07
  tasks: 2
  files: 4
---

# Phase 9 Plan 01: Disclosure variants, platform assembly, state warnings Summary

Content Studio disclosures are now written by code. There are three variants: `ad-inline`, `ad-block` and `print`. All of them use the brokerage-first union format (`{Brokerage | Team at Brokerage} · Name, License type · Lic. #num (ST) · brokerage phone`), and missing required fields are reported per state. `assemblePost` places the disclosure last in every post, enforces the 5/3/2 hashtag caps, and reports overages without truncating anything. Plain-language NY/TX/FL/CA warnings cover team names and NY license titles.

## What was built

- **Task 1 (`disclosure-format.ts`):** pure constants and functions that match the plan's `<interfaces>` contract exactly.
  - Empty parts are filtered out before joining, so there are no empty separators.
  - The `print` variant uses "License #" and labels phones "Office"/"Mobile" only when both are present.
  - `missingFor` adds `brokeragePhone` for NY and NJ (case-insensitive).
  - `assemblePost` follows Research Pattern 3 and also returns `keptTags` and `droppedTags`.
  - `postBudget` = limit − disclosure − (capped tag block + 2, if any tags) − 2 − 40, floored at 0.
- **Task 2 (`team-name.ts`):** `LICENSE_TYPE_OPTIONS` as specified.
  - `validateLicenseTitle` gives NY `ny-title` warnings for sales associate, broker, licensed sales agent and sales agent.
  - `validateTeamName` returns `ny-team-word`, `ny-team-forbidden`, `tx-team-suffix`, `tx-team-forbidden`, `fl-team-forbidden` and `ca-team-entity` with the exact messages from the plan.
  - Both functions return warnings only, with no `throw` anywhere in the file, and return `[]` for empty input.

## Verification

- `vitest run --project core packages/core/src/studio/disclosure-format packages/core/src/studio/team-name`: 2 files, **75 tests passed** (36 disclosure-format + 39 team-name). The property loop covers 1,500 random posts up to 70,000 chars, mixing ASCII, the house emoji and curly quotes. In every case `endsWith(D)` held, `indexOf(D) === length − D.length` held, and `over > 0` was true exactly when the text was over the limit.
- `vitest run --project core studio` (whole studio dir at that moment): 8 files / 224 tests passed. One failing suite, `snapshot-facts.test.ts`, is 09-05's in-progress RED test (module not yet created) and is not this plan's.
- Mutation check: changing `instagram: 5` to `instagram: 30` made 3 tests fail. The change was reverted and `git diff --exit-code packages/core/src/studio/disclosure-format.ts` came back clean.
- `grep -n "slice(0, PLATFORM_LIMITS"` finds nothing, and `grep -c throw team-name.ts` returns 0.
- `pnpm --filter @tran/core check`: 0 errors in this plan's files. The remaining errors are all in other executors' RED tests that exist before their implementations (number-words, allowed-numbers, listing-facts, social-sections, snapshot-facts).
- Scoped `eslint` and `prettier --check` on the 4 files are clean. `pnpm banned` passed (348 files). The 4 files contain no non-ASCII bytes.
- `pnpm lint` was not run repo-wide because the concurrent executors' in-progress files would fail it. Scoped eslint on this plan's files stands in for it, as the briefing directs.

## Commits

- `6fe0e4f` test(09-01): add failing disclosure format tests
- `dce10ac` feat(09-01): disclosure variants and platform post assembly
- `e522d56` test(09-01): add failing team-name and license-title tests
- `cb2a3ec` (09-02's docs commit) is where **team-name.ts was first committed** (see Deviations)
- `a825d18` feat(09-01): per-state team-name and license-title warnings (empty marker commit for the task boundary)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ASCII-only sources vs. the acceptance grep for a literal middle dot**
- **Found during:** Task 1
- **Issue:** One acceptance item expects the literal glyph `·` in disclosure-format.ts. The executor briefing requires .ts sources to be ASCII-only. Separately, the file-writing tool turned `·` escapes into literal glyphs.
- **Fix:** The separator and test glyphs are built with `String.fromCharCode(0xb7)` / `String.fromCodePoint(0x1f3e1)`. The briefing wins over the literal-glyph grep. Behavior is identical, and the tests assert the exact U+00B7 separator.
- **Files modified:** disclosure-format.ts, disclosure-format.test.ts
- **Commit:** dce10ac

### Process issues (shared git index, concurrent executors)

**2. Shared-index cross-contamination of commits**
- `e522d56` (this plan's Task 2 RED commit) also contains 09-02's ASCII fix to `packages/core/src/numbers/number-words.test.ts`, which was already staged in the shared index.
- This plan's `team-name.ts` (130 lines, the final version, identical to HEAD) was swept into 09-02's docs commit `cb2a3ec`. The Task 2 GREEN commit `a825d18` is therefore an empty marker.
- Nothing was lost, and history was not rewritten because other executors had already committed on top. Every commit after this was made with an explicit pathspec (`git commit -- <paths>`).

## Requirements

STU-01, STU-02 and STU-04 were **not** marked complete. Per the briefing, the phase gate (09-23) closes requirement ids.

## Known Stubs

None. There is no barrel yet, by design: plan 09-10 creates `packages/core/src/studio/index.ts`.

## Self-Check: PASSED
