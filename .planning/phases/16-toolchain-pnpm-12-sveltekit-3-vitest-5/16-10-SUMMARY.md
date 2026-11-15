---
phase: 16-toolchain-pnpm-12-sveltekit-3-vitest-5
plan: 10
status: complete
---

# Phase 16 Plan 10: Kit 3 close-out (complete; Kit 3 live on ed3210e)

All four tasks are done. Kit 3 was pushed (final HEAD ed3210e) and verified live. TOOL-02, TOOL-03, TOOL-05 stay unticked here (plan 13 Task 5 ticks them, citing the runs below).

## Kit range (for the rollback recipe)

- KIT_BASE_SHA: db6a2b8
- KIT_FIRST_SHA: 65c4575
- Last code/doc commit before the push: bbf0291 (update to the pushed HEAD at push time)
- Rollback: `git revert --no-commit 65c4575^..<last>`, `pnpm install --frozen-lockfile`, gate, owner-approved push

## Commits

| Task | Commit | Subject |
|------|--------|---------|
| 1 | 40e14e0 | chore(deps): drop the Kit 2 audit exceptions |
| 2 | bbf0291 | docs: correct Phase 16 origin and audit-exception counts; release the Kit major ignores |

## Task 1: minimatch check, 2026-11-14 (npm view + pnpm why)

- eslint 10.15.0 and @eslint/config-array 0.23.6 now accept minimatch ^11.0.5.
- @typescript-eslint/typescript-estree 8.72.2 (typescript-eslint latest 8.72.2) still declares ^10.2.2. wxt has no direct minimatch dependency.
- Lockfile resolves eslint 10.10.0, config-array 0.23.5, typescript-eslint 8.70.0 on minimatch 10.2.6 (single version).
- Result: not every dependent accepts 11, so minimatch stays; revisitBy 2026-12-31. Plan 12 may remove it after the ESLint family bump if typescript-estree follows.
- Greps on fresh builds (HEAD bbf0291): minimatch and deepmerge/mergeObject files = 0 in apps/web/build/_app, apps/web/src, apps/extension/.output.
- `pnpm audit --audit-level low`: "All found vulnerabilities were already reviewed and decided to be ignored / 2 ignored: 1 low | 1 moderate".

## Task 3 stage table (HEAD bbf0291, Wi-Fi: last event 8003 at 19:02:14, run started 20:02, quiet over 60 min)

| Stage | Exit | Seconds | Note |
|-------|------|---------|------|
| check | 0 | 19 | |
| lint | 0 | 117 | 0 errors, 1 pre-existing warning (GenerationPanel.svelte:83) |
| banned | 0 | 1 | |
| ui:guard | 0 | 0 | |
| test:unit | 0 | 115 | 370 files, 7383 tests |
| build:root / sub / configured | 0 / 0 / 0 | 15 / 15 / 14 | |
| csp:assert, seo:assert | 0 | 1, 1 | |
| budget:assert | 0 | 2 | 60 KB; configured: cash-on-cash 59.9, dscr 59.9, affordability 59.9, cap-rate 59.8 |
| test:e2e | 0 | 899 | 2350 passed, 4 skipped, 0 failed |
| smoke:local | 0 | 42 | 121 passed per target |
| audit:deps | 0 | 2 | 2 ignored |
| guard, fixtures:check, secrets:canary, secrets:scan, lint:workflows | 0 | 2, 1, 1, 2, 2 | |
| ext:build, ext:assert | 0 | 3, 0 | |
| ext:test:browser | 0 | 5 | 13 passed |
| ext:e2e | 0 | 5 | 7 passed |

`apps/web/build/_app/version.json` equals `git rev-parse HEAD` (bbf0291). `git diff origin/main..HEAD -- scripts/assert-budget.mjs` is empty.

## Deviations

- Ran plain `pnpm` instead of `corepack.cmd pnpm` (tasks/lessons.md 2026-11-11: global pnpm 11 breaks corepack inside spawning scripts; plain pnpm self-switches to 12.18.0).
- README.md needed no change (no Kit version text).
- runbook.test.ts non-vacuity floor lowered from 6 to 5 ignores to match the five remaining Dependabot ignores.


## Task 4 progress (after the owner-approved push of 70e030a)

- Pushed 368b56e..70e030a. Rebase SHAs: bbf0291 is now fd09573, 33ad514 is now 70e030a (tree identical). KIT_FIRST_SHA 65c4575; last Kit code commit fd09573.
- ci run 43663793959 (https://github.com/wolfwdavid/tran_real_estate/actions/runs/43663793959): FAILURE. root and configured jobs green; sub job red on one flaky test (--fail-on-flaky-tests): investor/markets.spec.ts:184 "horizontal overflow in px" received 672 at the final instant read (helpers.ts expectNoHorizontalScroll after a 375 px viewport resize); passed on retry. Deploy skipped, so no live-smoke ran for 70e030a; production still serves the Kit 2 build.
- Root cause: not reproduced locally (30 repeats at 6 workers, 12 repeats with a per-frame probe, 20x and 6x CPU throttling: overflow 0 from the first frame). The only read in question is an instant, un-polled measurement after a viewport change, the same pattern as lessons 2026-10-25. No CI trace was uploaded. Treated as a test measuring too early; unproven.
- Fix: d7a7661 makes expectNoHorizontalScroll an expect.poll (a persistent overflow still fails at timeout). Test-only, so budget unchanged (configured: cash-on-cash 59.9, dscr 59.9, affordability 59.9, cap-rate 59.8).
- Local after fix: full sub project 1146 passed; the 3 failures were build-stamp specs on a stale build (HEAD moved); after `pnpm build:sub`, build-stamp + markets specs 12 passed.
- Dependabot (10 alerts reported on push): alerts 1 to 11 inspected via the API. Nine are now fixed by Kit 3 (GHSA-pxg6, pfhg, 27mw earlier; plus two new Kit 2 medium advisories GHSA-mw6w-2fmv-pvw3 on @sveltejs/kit and GHSA-jf9x-2fg2-hx4w on adapter-static, created 2026-11-14). Open: #7 minimatch GHSA-g3hv-75wg-m249 (medium) and #6 deepmerge GHSA-gcqx-w48m-w2h4 (low), exactly the two recorded exceptions. The 10 figure was the pre-fix count.
- live-smoke: NOT RUN (needs a green ci and deploy of a new push). Stale-worker owner row: PENDING.

## Final close-out (Task 4)

Pushed HEAD: ed3210e9d3575b7769da49258b03934087292549. Rebase SHAs from the owner-requested reword: bbf0291 became fd09573, 33ad514 became 70e030a (tree identical). KIT_FIRST_SHA 65c4575; last Kit code commit fd09573 (later commits are test, ci and docs fixes listed below).

| Run | URL | Result |
|-----|-----|--------|
| ci for 70e030a | https://github.com/wolfwdavid/tran_real_estate/actions/runs/43663793959 | failure (sub flake, see below), deploy skipped |
| ci for ef60a6d | https://github.com/wolfwdavid/tran_real_estate/actions/runs/43668365203 | failure at test:unit (live-smoke-gate.test.ts expected 7 uses: lines) |
| ci for 60e71e8 | https://github.com/wolfwdavid/tran_real_estate/actions/runs/43669219058 | failure (a11y-keyed sub flake, see below) |
| ci for ed3210e | https://github.com/wolfwdavid/tran_real_estate/actions/runs/43673499633 | SUCCESS, deploy ran, live version.json = ed3210e |
| live-smoke for ed3210e | https://github.com/wolfwdavid/tran_real_estate/actions/runs/43675572754 | SUCCESS, 121 passed |

This is the evidence for TOOL-02 and TOOL-03, and provisional evidence for TOOL-05 (plan 12 may change the exception count again). Live-smoke log lines:
- `smoke: ed3210e9d3575b7769da49258b03934087292549 live at https://wolfwdavid.github.io/tran_real_estate/ after 0 s`
- pwa.smoke.ts:11 "the worker registers from this origin with scope = base" passed
- pwa.smoke.ts:18 "precache is one tran-shell-<version> cache of same-origin GETs under the base, no dotfiles" passed
- pwa.smoke.ts:38 "manifest.webmanifest is served as a named web app manifest" passed

### Deviations (extra commits after the checkpoint)

1. [Rule 1] d7a7661 test(web): poll the horizontal-overflow check. ci 43663793959 flaked once on markets.spec.ts:184 (overflow 672 px at an instant read after a 375 px resize). Not reproduced locally (30 repeats, throttled probes); the cause is unproven and mitigated by polling. CI now uploads traces on failure if it recurs.
2. ef60a6d ci: upload E2E traces on failure or flake, and 60e71e8 test(ci): live-smoke-gate counts 8 uses: lines. ef60a6d was pushed after running only workflow-gate.test.ts, so ci 43668365203 failed at test:unit; 60e71e8 fixed the count. Lesson recorded: run the full unit suite after any workflow change.
3. [Rule 1] a29fd53 test(web): wait for the agent CRM to read the database before seeding. Root cause (proven, reproduced with a 500 ms delay on nodes/1, 495/495 under load): seedDueSearch used page.waitForFunction with an async predicate, which Playwright 1.63 never awaits, so the wait was a no-op; Kit 3 awaits the root error node before hydrating, so on a slow runner a version-less indexedDB.open created an empty v1 before the app opened 'tran'. The fix waits for the "Loading your contacts" text to clear. ed3210e records the lessons. Debug file .planning/debug/a11y-keyed-seed-empty-db.md set to resolved.
4. Plain `pnpm` was used instead of `corepack.cmd pnpm` (tasks/lessons.md 2026-11-11).

### Dependabot after the push
The push reported 10 alerts, the pre-fix count. Nine were fixed by Kit 3 (the three Kit 2 low advisories plus GHSA-mw6w-2fmv-pvw3 on @sveltejs/kit and GHSA-jf9x-2fg2-hx4w on adapter-static, as duplicate alert pairs). Two remain open: minimatch GHSA-g3hv-75wg-m249 and deepmerge GHSA-gcqx-w48m-w2h4, exactly the two recorded exceptions. Nothing was changed in dependencies.

### Stale-worker owner row
Skipped by owner decision 2026-11-14; before-state captured; not verified. Before the deploy the owner's Chrome had a registered worker with scope https://wolfwdavid.github.io/tran_real_estate/ and caches.keys() = ['tran-shell-9ff0435949715ffabf52d2e2c481a999ad382c5d']. The after check did not run (the Chrome extension disconnected). Recorded as not verified, not as passed.

## Self-Check: PASSED
- Commits d7a7661, a29fd53, ef60a6d, 60e71e8, ed3210e present in git log; SUMMARY, debug file, ROADMAP and STATE updated.
