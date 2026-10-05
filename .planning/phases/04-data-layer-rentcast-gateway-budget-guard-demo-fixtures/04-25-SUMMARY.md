---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 25
subsystem: phase-gate
tags: [phase-gate, validation, human-uat, rentcast, mutation-ledger, playwright, reduced-motion, readme]
requires:
  - "04-01..04-24 (all SUMMARYs present)"
  - "04-VALIDATION.md Per-Task Verification Map"
  - "03-HUMAN-UAT.md format precedent"
provides:
  - "04-HUMAN-UAT.md: owner real-key checklist U1-U14 (non-blocking) with exact Settings steps and expected lines"
  - "04-VALIDATION.md: every row re-run green, status complete, wave_0_complete true, consolidated mutation ledger, approved"
  - "README data-layer section and fixtures:gen / fixtures:check command rows"
  - "Playwright suite default reducedMotion 'reduce' (smooth-scroll click race fixed at the root)"
affects: [Phase 5+ (E2E click stability, tailwind-merge tech debt), /gsd:verify-work 4]
tech-stack:
  added: []
  patterns:
    - "Phase gate = composed `corepack pnpm verify` on a clean tree plus a scripted walk of every validation-map command with per-row exit codes"
    - "Copy failing Playwright traces out of test-results/ before any re-run, then read the action log before touching timeouts"
key-files:
  created:
    - .planning/phases/04-data-layer-rentcast-gateway-budget-guard-demo-fixtures/04-HUMAN-UAT.md
  modified:
    - .planning/phases/04-data-layer-rentcast-gateway-budget-guard-demo-fixtures/04-VALIDATION.md
    - .planning/phases/04-data-layer-rentcast-gateway-budget-guard-demo-fixtures/deferred-items.md
    - .planning/phases/03-local-platform-storage-key-vault-backup/deferred-items.md
    - .planning/REQUIREMENTS.md
    - README.md
    - apps/web/playwright.config.ts
    - apps/web/tests/e2e/data-status.spec.ts
    - apps/web/tests/e2e/settings-data.spec.ts
key-decisions:
  - "Reduced motion is the Playwright suite default, not a per-spec opt-in: traces proved smooth scrolling made clicks land mid-scroll on Settings (the Phase 3 'import preview' flake was the same bug). No timeout raised; product CSS unchanged."
  - "HUMAN-UAT combines the plan's U1-U14 table with 03-HUMAN-UAT-style step blocks for the Settings key test (404 -> valid-free, 401 -> invalid, 403 -> restricted, 200 -> billed and meter '1 of 50')"
  - "DATA-01..05 were ticked early in wave 1; 04-25 re-confirmed each against shipped code and green proofs and left them Complete"
  - "tailwind-merge font-size collision stays open as Phase 5+ UI tech debt (noted in HUMAN-UAT 'Carried forward' and deferred-items)"
requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-05]
metrics:
  duration: "~20 min"
  completed: 2026-10-05
  tasks: 2
  files: 9
---

# Phase 4 Plan 25: Phase 4 Gate Summary

**Phase 4 closes green: `corepack pnpm verify` exits 0 in 229 s on a clean tree (1384 unit tests, 496 E2E + 2 skipped on both bases, CSP 14 pages each, fixtures match). Every validation-map row was re-run green. The owner has a non-blocking U1-U14 real-key checklist. A suite-wide E2E click race was root-caused from traces and fixed.**

## Performance

- **Duration:** ~20 min (2026-10-05T12:42Z to 12:59Z, plus documentation)
- **Tasks:** 2 of 2, plus 1 out-of-plan fix
- **Files modified:** 9

## Accomplishments

- **04-HUMAN-UAT.md**: rows U1-U14 in the plan's table format. Each row names the one-line switch to change if RentCast behaves differently: `validateKeyFormat` and `PROBE_REQUEST` in `probe.ts`, `isBilled` in `policy.ts`, the `detail` mapping in `errors.ts`, `schemas.ts`, `toRentCastFilterParams`, and the `byBedrooms` mapper. There are step blocks A/B/C for the Settings key test with the exact UI lines and meter text, ground rules (local dev only, dedicated endpoint-restricted key, never committed, status codes and counts only, never response bodies), clean-up, and "How to record". Frontmatter has `blocking: false`.
- **Composed gate**: the first run (on a clean tree after `install --frozen-lockfile`) failed 2 of 498 E2E tests. The fix is below. The re-run on a clean tree at 72b6875 exited 0 in **229 s**. Unit: 87 files, 1384 tests, including `web-browser`. Builds and CSP: 14 pages each. E2E: 496 passed and 2 skipped (2.3 min, down from 2.8 because nothing animates). Guard: 734 files. Fixtures: 6 files match. Gitleaks history: 367 commits, no leaks. actionlint is clean.
- **Validation walk**: 51 of the 54 rows were run one by one with their exact commands and exit codes (a script for 49, then 4-23-01 with 33 tests and 4-23-02 with 8 tests run by hand; the build-bound rows ran under the build lock). Every row exited 0. 4-23-03, 4-24-02 and 4-25-02 are covered by the composed gate. Frontmatter: `status: complete`, `nyquist_compliant: true`, `wave_0_complete: true`. Wave 0 boxes are ticked, and the doc says "Approval: approved 2026-10-05".
- **Mutation ledger** consolidated in 04-VALIDATION.md "Mutation proofs". It covers the 8 planned guards (04-02, 03, 05, 06, 11, 13, 19, 21), each confirmed against its SUMMARY record; 15 further executor mutation runs (04-01, 07, 09, 12, 13, 16, 17, 18, 19, 21, 22, 23); the non-vacuity cases (04-08, 04-10, component axe); and the three out-of-plan fixes (7506489, af05ac7, 72b6875).
- **README**: new "Data layer (RentCast, sample data, budget)" section. It covers sample mode, BYOK Test key semantics, the gateway and meter, the cap, cache lifetimes (estimates are **7 days** per the locked CONTEXT, overriding CLAUDE.md's 14 d), saved-search alerts, backup coverage (ledger, savedSearches, searchSnapshots and dataPrefs in; apiCache excluded; schema-registry test), code locations, and a pointer to HUMAN-UAT. Also added: `fixtures:gen` and `fixtures:check` command rows, `web-browser` in the `test:unit` row, a Chromium note for the browser project, `fixtures:check` in the verify order, and the verify time changed to "about four minutes". Settings now lists RentCast usage. The pages note now mentions the `404.html` fallback (14 HTML files per build). The `packages/core` description and the E2E coverage description are updated.
- **REQUIREMENTS.md**: DATA-01..05 were already `[x]` and Complete from the early wave-1 tick. All five are re-confirmed (see below), and the footer date is updated.

## DATA requirement confirmation

| Req | Delivered by (proof rows, all green today) |
|-----|---------------------------------------------|
| DATA-01 sample data, badged | 04-06 generator, PII guard and drift check; 04-10 schemas (0 dropped rows); 04-12 rebased fixture fetch; 04-17 keyless gateway (0 spend); 04-14/20/22 "Sample data" chip and status bar; 04-24 E2E keyless. Portals stay placeholders until Phases 6-9. Phase 4's scope is that every data type answers from badged fixtures with no key. |
| DATA-02 meter + cost before spend | 04-02 budget; 04-13 estimateCost; 04-14 CostLabel; 04-15 CallMeter; 04-23 usage section; 04-24 E2E meter states |
| DATA-03 cap 40/50 + confirm | 04-11 transactional reserve (mutation-proven); 04-13 "60 calls block #41"; 04-16 dialogs; 04-18 per-call prompt; 04-19 "5 due once / 24 h"; 04-21 "10 re-renders spend 0" |
| DATA-04 cache + "as of" + Refresh (1 call) | 04-03 canonical keys; 04-13 repeat spends 0 with original fetchedAt; 04-14 ProvenanceRow; 04-07/21 reactive-spend lint and guard |
| DATA-05 specific messages | 04-03 error taxonomy and probe mapping; 04-09 probe; 04-15 GatewayError (8 variants); 04-20 KeyTestResult; 04-23/24 six Test key outcomes in E2E |

## Task Commits

1. **Task 1: deferred real-key HUMAN-UAT list**: `47ceb05` (docs)
2. **Out-of-plan fix: E2E reduced motion**: `72b6875` (fix)
3. **Task 2: validation walk, requirements, README**: `9ced66c` (docs)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] E2E clicks raced smooth scrolling (root cause of the Phase 3 "import preview" flake)**
- **Found during:** Task 2, first composed `verify` (exit 1 in 257 s).
- **Issue:** 2 of 498 E2E tests failed: `app-notice` "Remind me tomorrow hides the notice for 24 hours" on root (the `seed()` **Import backup** click) and `settings-keys` "keys are session-only by default" on sub (the **Save key** click). The traces were copied out of `test-results/` before any re-run. Both action logs read "element is not stable", then "element is outside of the viewport", then "click action done", with no effect. `app.css` turns on `html { scroll-behavior: smooth }` under `no-preference`, so Playwright's scroll-into-view animated while Settings was still filling in (RentCast usage, data status), and the click landed mid-scroll. 04-24 had found the same cause, but applied `reducedMotion: 'reduce'` to its two new specs only.
- **Fix:** `reducedMotion: 'reduce'` is now the suite default in `apps/web/playwright.config.ts`, with a comment that records the trace evidence. The now-redundant per-spec `test.use` lines in `data-status.spec.ts` and `settings-data.spec.ts` are removed. No timeout was raised. Product CSS is unchanged. No spec asserts no-preference motion behaviour.
- **Verification:** `playwright test settings-keys app-notice settings-backup --repeat-each 3` passed 156 and skipped 6 (the existing skips). The full `verify` re-run is green.
- **Files modified:** `apps/web/playwright.config.ts`, `apps/web/tests/e2e/data-status.spec.ts`, `apps/web/tests/e2e/settings-data.spec.ts`. The Phase 3 and Phase 4 `deferred-items.md` entries are marked RESOLVED.
- **Commit:** 72b6875

### Other notes

- The `.vitest-attachments` / `__screenshots__` deferred item (04-14) is marked RESOLVED (orchestrator `.gitignore` housekeeping).
- 04-HUMAN-UAT.md gained a "Carried forward" note for the tailwind-merge collision, as the orchestrator directed. It is not a `| U` row, so the U-row count stays 14.
- No flakes recurred apart from the one above: no `precommit.test.ts` HEAD race even though Task 1 committed mid-run, and no libuv worker crash.

## Known Stubs

None. This plan changed docs and test config only.

## Owner-gated (non-blocking)

- U1-U14 in `04-HUMAN-UAT.md`. They need a dedicated, endpoint-restricted RentCast key that is never committed. U6, U8, U12, U13 and U14 also need Phase 6 surfaces, and U11 needs the deployed origin.

## Next Phase Readiness

Phase 4 is ready for `/gsd:verify-work 4`. Phase 5 can rely on the suite-wide reduced-motion E2E default and the `helpers/data.ts` RentCast mocks.

## Self-Check: PASSED

- FOUND: 04-HUMAN-UAT.md (14 `| U` rows), 04-VALIDATION.md (`nyquist_compliant: true`, `wave_0_complete: true`, `Mutation proofs`, 0 pending rows), README `fixtures:check` + `fixtures:gen`, REQUIREMENTS `[x] **DATA-0` x 5
- FOUND commits: 47ceb05, 72b6875, 9ced66c
