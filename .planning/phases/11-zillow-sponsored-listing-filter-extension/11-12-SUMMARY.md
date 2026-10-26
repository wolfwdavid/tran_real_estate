---
phase: 11-zillow-sponsored-listing-filter-extension
plan: 12
subsystem: ci
tags: [ci, verify, github-actions, extension, human-uat, validation]
requires:
  - phase: 11-zillow-sponsored-listing-filter-extension
    provides: "11-07 release workflow + docs, 11-10 production build/oracle, 11-09 popup axe suite, 11-11 runtime E2E"
provides:
  - "Root ext:build / ext:assert / ext:test:browser / ext:e2e scripts appended to `pnpm verify`"
  - "Two root-leg CI quality steps (build + oracle, popup axe + E2E) locked by workflow-gate tests"
  - "11-HUMAN-UAT.md owner checklist (8 items) and DEPLOY-CHECKLIST Step 9"
  - "11-VALIDATION.md sign-off (per-task rows green)"
affects: [verify-work, phase-complete, release]
tech-stack:
  added: []
  patterns: ["Root-leg-only CI steps for target-independent artifacts", "Text-asserted CI step ordering and if: lines"]
key-files:
  created:
    - .planning/phases/11-zillow-sponsored-listing-filter-extension/11-HUMAN-UAT.md
  modified:
    - package.json
    - .github/workflows/ci.yml
    - scripts/workflow-gate.test.ts
    - apps/extension/tests/copy-banned.test.ts
    - docs/DEPLOY-CHECKLIST.md
    - .planning/phases/11-zillow-sponsored-listing-filter-extension/11-VALIDATION.md
key-decisions:
  - "Extension CI steps run only on the root matrix leg: the extension has no BASE_PATH or owner variables, so one run is enough"
  - "No xvfb: 11-11 proved new-headless Chromium loads the MV3 extension, so the CI run line stays plain"
  - "HUMAN-UAT has 8 items (7 pending, 1 skipped): the plan's 6 plus the real-browser zero-network check and the Showcase owner decision"
requirements-completed: [EXT-01, EXT-02, EXT-03, EXT-04]
duration: 10min
completed: 2026-10-26
---

# Phase 11 Plan 12: Extension Verify/CI Wiring and Phase Sign-off Summary

**The extension build, zero-network oracle, popup axe suite and runtime E2E now run at the end of root `pnpm verify` and as two root-leg CI steps, locked by workflow-gate tests (still exactly 7 SHA-pinned `uses:`). Owner-only items are recorded as non-blocking HUMAN-UAT. The single composed verify run was killed by the host for low memory and still has to be re-run.**

## Performance

- **Duration:** about 10 min (2026-10-26T03:37Z to 03:47Z)
- **Tasks:** 2
- **Files modified:** 7 (1 created)

## Accomplishments

- `package.json`: added `ext:build` (`pnpm --filter extension zip`), `ext:assert`, `ext:test:browser` and `ext:e2e`. `verify` now ends with `… && pnpm lint:workflows && pnpm ext:build && pnpm ext:assert && pnpm ext:test:browser && pnpm ext:e2e`. `simple-git-hooks` is unchanged.
- `ci.yml` quality job: added "Extension build + manifest/zero-network oracle" and "Extension popup axe + runtime E2E", each `if: matrix.target == 'root'`, placed after web `E2E + axe` and before `Upload Pages artifact`. No new action.
- `workflow-gate.test.ts`: a new `describe('extension (Phase 11)')` block checks the two run lines, that the `if:` sits exactly on each step, the order (after the Chromium install and web E2E, before the Pages upload), and the exact ext scripts plus the verify suffix.
- `copy-banned.test.ts`: the scanned scope must stay at 9 or more surfaces, including App.svelte, edge-listing.md and EXTENSION-INSTALL.md.
- `11-HUMAN-UAT.md` (8 items): live Brooklyn smoke (only the ad slots are expected to dim today), real-browser zero-network check, Showcase decision, ToU read, privacy URL, Edge Partner Center, `EXTENSION_RELEASES_ENABLED` + `ext-v0.1.0`, and Firefox (skipped per cut line 2).
- `DEPLOY-CHECKLIST.md` Step 9 "Browser extension release (Phase 11)".
- `11-VALIDATION.md`: every per-task row is green, Wave 0 is ticked, and `wave_0_complete: true` is set. The composed row is marked interrupted (see below).

## Task Commits

1. **Task 1 RED:** `2ed9c74` test(11-12): add failing extension CI gate assertions
2. **Task 1 GREEN:** `9211bf3` ci(11-12): run extension build, oracle, axe and e2e in verify and CI
3. **Task 2:** `5f069d2` docs(11-12): extension HUMAN-UAT, release checklist, validation sign-off

## Verification

- RED: 4 new workflow-gate tests failed before the wiring. GREEN: `vitest --project scripts workflow-gate extension-release-gate` 49/49; `copy-banned` 5/5; `lint:workflows` and `lint` exit 0.
- Mutation sanity (not committed, reverted): deleting the `pnpm ext:build && pnpm ext:assert` line turned 2 gate tests RED. Dropping the `if:` from the axe/E2E step turned 1 RED.
- `uses:` count is 7 both before and after (`git show HEAD:.github/workflows/ci.yml`).
- Standalone Phase 11 gates after the change: `pnpm ext:build && pnpm ext:assert` passed (oracle: 6 files, zip root verified); `pnpm ext:test:browser` 13/13; `pnpm ext:e2e` 7/7; `vitest --project extension` 241/241; the scripts suites for eslint-rules, assert-extension, extension-release-gate, extension-docs and workflow-gate passed 240/240; `guard-real-data --all` passed; `pnpm banned` passed (446 files).
- **Composed `corepack pnpm verify`: NOT completed.** `pnpm install --frozen-lockfile` was up to date. In the run, `check` (0 errors in web and extension), `lint`, `banned` and `ui:guard` passed. During `pnpm test:unit` the host reaped the background shell for critically low system memory. While memory was starved, `scripts/precommit.test.ts` reported 6/10 failures (it spawns git and gitleaks per test). Run alone right afterwards, it passed 10/10, so this is resource starvation and not a regression (this plan does not touch the hook or the guard). Per the reap notice, the run was not restarted automatically. The steps after `test:unit` (web builds, CSP/SEO/budget oracles, web Playwright, audit, fixtures, secrets, actionlint, ext:*) did not run inside the composed chain. The ext:* steps, actionlint and the guard were run standalone, all green.

## Deferred-items check

All three 11-09 findings in `deferred-items.md` were closed by 11-10: the modulepreload `fetch(` by `96f6b80` (`modulePreload.polyfill: false`), and the two inert WXT URLs by `0ae70e4` (exact-prefix oracle allowlist). Today's oracle run passes on the production output.

## Deviations from Plan

- **[Rule 2 - Scope] HUMAN-UAT has 8 items, not 6.** Added the real-browser zero-network check and the Showcase owner decision, as the orchestrator required. Summary: total 8, pending 7, skipped 1.
- **[Environment] Composed verify was interrupted** by the host memory reaper (see Verification). VALIDATION `status` is `approved-pending-composed-verify`, not `approved`, so the record stays honest.
- The copy-banned scope assertion passed on first run (it is a guard against the scope shrinking, and the scope was already 9). Only the workflow-gate tests were truly RED.

## Known Stubs

- `docs/EXTENSION-INSTALL.md`: the Edge Add-ons placeholder sentence stays until the owner's listing is live (HUMAN-UAT item 6, intentional per UI-SPEC).

## Next Phase Readiness

- Re-run `corepack pnpm install --frozen-lockfile && corepack pnpm verify` with free memory (close other browsers and IDEs), then `/gsd:verify-work 11`. After that run, set 11-VALIDATION `status: approved` and the 11-12-02 row to green.
- Nothing pushed or tagged; there is no remote.

## Self-Check: PASSED

- FOUND: .planning/phases/11-zillow-sponsored-listing-filter-extension/11-HUMAN-UAT.md
- FOUND: commits 2ed9c74, 9211bf3, 5f069d2

---
*Phase: 11-zillow-sponsored-listing-filter-extension*
*Completed: 2026-10-26*
