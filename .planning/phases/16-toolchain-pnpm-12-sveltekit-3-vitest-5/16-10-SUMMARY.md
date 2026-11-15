---
phase: 16-toolchain-pnpm-12-sveltekit-3-vitest-5
plan: 10
status: paused-at-task-4
---

# Phase 16 Plan 10: Kit 3 close-out (PAUSED at Task 4, owner-approved push pending)

Tasks 1 to 3 are done and committed. Task 4 (push, ci, live smoke, owner stale-worker row) is not done. TOOL-02, TOOL-03, TOOL-05 are not ticked (plan 13 Task 5 ticks them).

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

## Pending (Task 4)

Owner approval of `git push origin main`, ci run URL, live-smoke run URL with pwa spec proof, owner stale-worker answer.

## Task 4 progress (after the owner-approved push of 70e030a)

- Pushed 368b56e..70e030a. Rebase SHAs: bbf0291 is now fd09573, 33ad514 is now 70e030a (tree identical). KIT_FIRST_SHA 65c4575; last Kit code commit fd09573.
- ci run 43663793959 (https://github.com/wolfwdavid/tran_real_estate/actions/runs/43663793959): FAILURE. root and configured jobs green; sub job red on one flaky test (--fail-on-flaky-tests): investor/markets.spec.ts:184 "horizontal overflow in px" received 672 at the final instant read (helpers.ts expectNoHorizontalScroll after a 375 px viewport resize); passed on retry. Deploy skipped, so no live-smoke ran for 70e030a; production still serves the Kit 2 build.
- Root cause: not reproduced locally (30 repeats at 6 workers, 12 repeats with a per-frame probe, 20x and 6x CPU throttling: overflow 0 from the first frame). The only read in question is an instant, un-polled measurement after a viewport change, the same pattern as lessons 2026-10-25. No CI trace was uploaded. Treated as a test measuring too early; unproven.
- Fix: d7a7661 makes expectNoHorizontalScroll an expect.poll (a persistent overflow still fails at timeout). Test-only, so budget unchanged (configured: cash-on-cash 59.9, dscr 59.9, affordability 59.9, cap-rate 59.8).
- Local after fix: full sub project 1146 passed; the 3 failures were build-stamp specs on a stale build (HEAD moved); after `pnpm build:sub`, build-stamp + markets specs 12 passed.
- Dependabot (10 alerts reported on push): alerts 1 to 11 inspected via the API. Nine are now fixed by Kit 3 (GHSA-pxg6, pfhg, 27mw earlier; plus two new Kit 2 medium advisories GHSA-mw6w-2fmv-pvw3 on @sveltejs/kit and GHSA-jf9x-2fg2-hx4w on adapter-static, created 2026-11-14). Open: #7 minimatch GHSA-g3hv-75wg-m249 (medium) and #6 deepmerge GHSA-gcqx-w48m-w2h4 (low), exactly the two recorded exceptions. The 10 figure was the pre-fix count.
- live-smoke: NOT RUN (needs a green ci and deploy of a new push). Stale-worker owner row: PENDING.
