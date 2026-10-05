---
phase: 02-brand-system-marketing-legal-pages
plan: 12
subsystem: gate-and-docs
tags: [verify, validation, readme, BRND-01, BRND-02, BRND-03, BRND-04, BRND-05]
requires:
  - "02-01..02-11: every Phase 2 slice (tokens, banned gate, fonts, routes, content, layout and axe specs)"
provides:
  - "One green `corepack pnpm verify` over both base paths, with `banned` in the chain"
  - "02-VALIDATION.md walked: 26 rows green, wave 0 complete, approval recorded"
  - "README: brand package row, banned command, Routes section, Fontsource note"
affects: [Phase 3 and Phase 11 (consume brand tokens), anyone adding a route]
tech-stack:
  added: []
  patterns:
    - "Adding a page means updating routes.ts and EXPECTED_PAGES; the README now says so"
key-files:
  created:
    - .planning/phases/02-brand-system-marketing-legal-pages/02-12-SUMMARY.md
  modified:
    - .planning/phases/02-brand-system-marketing-legal-pages/02-VALIDATION.md
    - README.md
key-decisions:
  - "The VALIDATION status legend no longer lists the pending glyph, so `grep -c \"⬜ pending\"` is 0 as the acceptance criterion requires"
  - "README verify timing changed from 'a little over a minute' to 'under two minutes' to match the measured 102 s"
requirements-completed: [BRND-01, BRND-02, BRND-03, BRND-04, BRND-05]
metrics:
  duration: ~11 min
  completed: 2026-10-04
  tasks: 2
  files: 2
---

# Phase 2 Plan 12: Full Gate, Validation Walk and README Summary

**`corepack pnpm verify` passed in one run (102 s): 205 unit tests, 306 E2E tests on both base paths, CSP checks on 14 pages per build, and the banned-terms, guard, gitleaks and actionlint steps. All 26 rows of the verification map passed when run one at a time, and the README now covers the routes, the brand package and the banned-terms gate.**

## Task 1: Full gate and verification-map walk (1c7b35f)

- Pre-flight: the working tree was clean, `git remote -v` printed nothing, and `corepack pnpm install --frozen-lockfile` finished in 2.2 s.
- `corepack pnpm verify` exited 0 and took **102 s** wall-clock. The Phase 1 baseline was 71-79 s; the extra time comes from the new layout, marketing and axe specs (306 E2E tests, up from Phase 1's count).
- Each row of the Per-Task Verification Map was then run on its own. All exited 0, and every test filter matched real tests, so no row passed by running nothing:

| Row | Result | Row | Result |
|-----|--------|-----|--------|
| 2-01-01 | 10 tests | 2-06-01 | 6 parity tests + check/lint/banned |
| 2-01-02 | 10 tests + brand check | 2-06-02 | 36 E2E (root) |
| 2-02-01 | 43 tests + CLI | 2-07-01 | 5 tests |
| 2-02-02 | 21 tests + actionlint | 2-07-02 | 72 E2E |
| 2-03-01 | check + build + CSP | 2-08-01 | check/lint/banned |
| 2-03-02 | 6 tests | 2-08-02 | guard + 72 E2E |
| 2-03-03 | 37 tests + csp:assert | 2-09-01 | check/lint/banned |
| 2-04-01 | check/lint/banned | 2-09-02 | 32 E2E (root) |
| 2-04-02 | 37 tests | 2-10-01/02 | 172 E2E (layout) |
| 2-04-03 | 306 E2E | 2-11-01 | 54 E2E (marketing) |
| 2-05-01 | 72 E2E | 2-11-02 | 58 E2E (a11y) |
| 2-05-02 | 4 E2E (drift) | 2-12-02 | lint + guard + secrets:scan |

- 02-VALIDATION.md: every row is marked `✅ green`. The frontmatter now reads `status: complete`, `wave_0_complete: true` and `nyquist_compliant: true`. All Wave 0 and Sign-Off boxes are ticked, and approval is recorded as 2026-10-04.
- Hygiene: after the walk, `git status --porcelain` showed only 02-VALIDATION.md, and ports 4273, 4274 and 4275 each returned ECONNREFUSED.

### verify output tail

```
$ node scripts/banned-terms.mjs
Banned-terms check passed (35 files)
 Test Files  14 passed (14)
      Tests  205 passed (205)
CSP assertion passed for 14 pages in apps/web/build
CSP assertion passed for 14 pages in apps/web/build-sub
  306 passed (51.4s)
$ node scripts/guard-real-data.mjs --all
Real-data guard passed (396 all files checked)
$ node scripts/gitleaks-canary.mjs
gitleaks canary detected as expected
$ node scripts/gitleaks.mjs history
INF 141 commits scanned.
INF no leaks found
$ node scripts/actionlint.mjs
(exit 0)
```

## Task 2: README and requirement status (b4c5ef6)

- The `packages/brand` row now describes the tokens, the contrast gate and the `@theme` parity test.
- The Commands table has a `banned` row. The `test:unit` row lists `web`, `core`, `brand` and `scripts`, and the `test:e2e` row lists layout and marketing coverage.
- The `verify` sentence lists `banned` right after `lint`.
- A new **Routes** section lists all 13 pages by group. It says a new page must also be added to `apps/web/tests/e2e/routes.ts` (a drift test enforces this) and to `EXPECTED_PAGES` in `scripts/assert-csp.mjs`.
- A Fontsource sentence states that Fraunces and Inter are self-hosted and the site makes no third-party requests.
- REQUIREMENTS.md: BRND-01 to BRND-05 were already ticked and marked Complete by earlier plans. `requirements mark-complete` reported all five as `already_complete`, so this plan made no change to that file.
- The plan's checks passed: `lint`, `guard` and `secrets:scan` (plus `banned`) all exit 0. The acceptance greps for `pnpm banned`, `legal/data-coverage`, `routes.ts` and `fontsource` each returned 1, the BRND tick count is 5, and no AI tool is mentioned.

## Deviations from Plan

None that change behaviour. Two small differences:
- The status legend line in 02-VALIDATION.md contained the pending glyph, which would have made the `grep -c "⬜ pending"` acceptance check return 1. The legend now reads "✅ green · ❌ red · ⚠️ flaky (every row walked in 02-12; none left unrun)".
- REQUIREMENTS.md was not modified because the earlier plans had already completed the BRND rows.

## Findings

- No drift. No step had to be fixed, and the `precommit.test.ts` HEAD-movement flake did not occur, even though planner agents committed planning docs during the run.
- Verify time grew from 71-79 s (Phase 1) to 102 s, mainly from E2E (51 s for 306 tests).

## Known Stubs

The `/renter/`, `/investor/`, `/agent/` and `/settings/` pages are intentional placeholders. Phases 3 and 6-9 replace them, and the README Routes table records this.

## Self-Check: PASSED

- FOUND: README.md, 02-VALIDATION.md, 02-12-SUMMARY.md
- FOUND: 1c7b35f, b4c5ef6
