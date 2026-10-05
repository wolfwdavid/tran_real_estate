---
phase: 05-ai-layer-providers-streaming-fair-housing-guardrails
plan: 04
subsystem: fair-housing
tags: [fair-housing, lexicon, mutation-testing, redos, tdd, core]
requires:
  - "05-02: p``, compilePattern, checkFairHousing, ALLOW_PHRASES, LexiconEntry types"
provides:
  - "@tran/core/fair-housing LEXICON: 41 phrase-level entries (federal FHA classes + state-scope SOI/age/marital/SOGI)"
  - "@tran/core/fair-housing BAD_PHRASES (42 rows), NEUTRAL_PHRASES (40), BadPhrase type, flagsRow comparison helper"
affects: [05-06, 05-12, phase-10 checker page]
tech-stack:
  added: []
  patterns:
    - "Suite-driven test.each over exported data reused by the product (Phase 10 checker page)"
    - "Leave-one-out + exclusivity: every entry's examples are matched by that entry and no other"
    - "Planted mutations asserted through the same flagsRow comparison the suite uses"
key-files:
  created:
    - packages/core/src/fair-housing/suite.ts
    - packages/core/src/fair-housing/check.test.ts
    - packages/core/src/fair-housing/mutation.test.ts
  modified:
    - packages/core/src/fair-housing/lexicon.ts
    - packages/core/src/fair-housing/index.ts
decisions:
  - "The suite's row comparison lives in suite.ts as flagsRow(text, row, lexicon = LEXICON) so the planted severity mutation is detected by the exact function the suite uses"
  - "lexicon.ts header names the withdrawn guidance by its FR citation (91 FR 17291) without the year, so the no-'2024' acceptance grep holds"
  - "No banned-terms scope change needed: the gate scans apps/web routes/components/content only, and no lexicon phrase is a banned term"
metrics:
  duration: 12min
  completed: 2026-10-05
  tasks: 2
  files: 5
---

# Phase 5 Plan 04: Fair Housing Lexicon and Suites Summary

41-entry Fair Housing lexicon paraphrased from 24 CFR 100.75, the HUD Achtenberg memo (1995) and state and local protections, with a 42-row bad suite and a 40-phrase neutral suite. Tests prove every entry is load-bearing and exclusive to its own examples, show that planted mutations are caught, and keep every pattern within a ReDoS time budget.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Suites + suite tests (RED), 41-entry lexicon (GREEN) | 95fd342 (RED), 784daec (GREEN) |
| 2 | Leave-one-out, exclusivity, planted mutations, ReDoS budget | 83eaa92 |

## Verification

- `corepack pnpm exec vitest run --project core packages/core/src/fair-housing`: 5 files, 494 tests pass (41 load-bearing cases, 41 exclusivity cases, 54 ReDoS cases covering 41 entries and 13 allow patterns × 7 adversarial 50 KB strings)
- `corepack pnpm exec vitest run --project core`: 27 files, 971 tests pass
- `corepack pnpm --filter @tran/core check`: clean
- prettier + eslint on `packages/core/src/fair-housing`: clean
- `corepack pnpm banned`: passed (79 files)
- Acceptance greps: `grep -c "id: '" lexicon.ts` = 41; `grep -c 2024 lexicon.ts` = 0
- RED was confirmed: 132 failing tests against the empty LEXICON before the GREEN commit
- Extra mutant (not committed): I appended `|no section 8` to `soi.no-vouchers`. That made both the load-bearing and exclusivity tests fail for `soi.no-section-8`, and I then restored the file (empty diff).

All 41 entries passed the bad and neutral suites on the first GREEN run. No pattern needed tightening, and the allow-list was not changed.

## Requirement advanced

AI-02 (the test half of ROADMAP Phase 5 criterion 2). Per the orchestrator, AI-02 was **not** marked complete; it stays open until the phase gate (05-16).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Consistency] Header wording vs the no-"2024" acceptance grep**
- **Issue:** The plan's header text says "withdrawn 2024 advertising guidance", but the acceptance criteria require `grep -c 2024 lexicon.ts` = 0.
- **Fix:** The header reads "Never cite HUD's withdrawn advertising guidance (91 FR 17291)". The meaning is the same and the grep passes.
- **Commit:** 784daec

**2. [Rule 2 - Correctness] Shared comparison function**
- **Issue:** The planted severity mutation must be "detected by the same comparison function the suite uses". The function started out private to check.test.ts.
- **Fix:** Exported it as `flagsRow` from suite.ts. Both check.test.ts and mutation.test.ts now use it.
- **Commit:** 83eaa92

Additional tests beyond the plan bullets: every BAD row points at a real entry and every entry has a BAD row; the whole-text budget test also asserts that findings are non-empty, so it cannot pass vacuously.

## Known Stubs

None.

## Self-Check: PASSED
