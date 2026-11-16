---
phase: 16-toolchain-pnpm-12-sveltekit-3-vitest-5
plan: 12
status: complete (pushed 587c51c..ab1dc90; ci and live-smoke green)
requirements: [TOOL-06]
---

# Phase 16 Plan 12: Routine bumps (partial, local only)

Complete. The owner approved the push (587c51c..ab1dc90, 13 commits, the first is the 16-11 close-out). TOOL-06 and TOOL-05 stay unticked here (plan 13).

## Task 5: push and live evidence

- ci run 43790148391 on ab1dc90: success (hygiene, root, sub, configured, deploy).
- live-smoke run 43793250837: success, "smoke: ab1dc90c208f6dde3a3696b6505b903e09ed5ea8 live at https://wolfwdavid.github.io/tran_real_estate/ after 0 s", 121 passed.
- Dependabot: #9 was already closed by Dependabot; #10 (tailwind-variants major) stays open by owner decision. No PR changes made.

## Versions chosen (checked with `npm view` on 2026-11-15, 7-day rule: release on or before 2026-11-08)

| Package | Was | Now | Note |
|---------|-----|-----|------|
| @playwright/test, playwright (web, extension) | 1.63.0 | 1.65.0 | 1.65.1 is 2 days old |
| @axe-core/playwright, axe-core (web, extension) | 4.13.0 | 4.14.0 | released 2026-10-05 / 10-15 |
| wxt | 0.21.4 | 0.21.5 | |
| eslint | 10.10.0 | 10.14.0 | 10.15.0 is 2 days old |
| typescript-eslint | 8.70.0 | 8.72.1 | 8.72.2 (2026-11-09) is 6 days old |
| globals | 17.12.0 | 17.14.0 | |
| bits-ui | 2.19.2 | 2.20.6 | 2.21.0 (2026-11-11) is 4 days old; no qualifying 2.21.x, took the newest qualifying release |
| layerchart | 2.5.1 | 2.9.2 | 2.10.0 (11-10) and 2.10.1 are under 7 days; 2.9.2 is 2026-10-30 |
| shadcn-svelte CLI | 1.6.1 | 1.8.0 | 1.8.1 is 4 days old |

Unchanged: prettier 3.9.6 and plugins, eslint-plugin-svelte 3.24.1, @eslint/js 10.0.1, eslint-config-prettier 10.1.8 (not named in the plan, no qualifying need), `@types/node` ^24, Vitest/Kit/pnpm pins.

## Lockfile reviews (boot document byte-identical in every commit)

- Playwright: only playwright, playwright-core, @playwright/test and the peers keyed on them. No new names.
- axe: only axe-core and @axe-core/playwright. No new names.
- wxt: wxt, `@1natsu/wait-element` 4.2.0 to 5.0.0, `dotenv-expand` 13.0.0 removed. No new names.
- ESLint family: eslint, typescript-eslint and its @typescript-eslint/* members, globals. No new names.
- bits-ui: bits-ui, svelte-toolbelt 0.10.7, tabbable 6.5.1. No new names.
- layerchart: NEW names `d3-geo-polygon` 2.0.1 and `d3-geo-projection` 4.0.0 (maintained under github.com/d3, mbostock a maintainer; d3-geo-projection depends on commander 7, d3-array, d3-geo, all already present).
- shadcn-svelte: NEW name `cn` 0.3.3 (publisher shadcn, repo shadcn-ui/cn); removed nanoid 3.3.19 and postcss 8.5.28 from the CLI's tree.
- `pnpm audit:deps` is exit 0 with 2 ignored after every commit.

## Commits (oldest first, all after 49623b9)

| Hash | Subject |
|------|---------|
| b089a7b | build(deps): bump Playwright to 1.65.0 |
| f326241 | build(deps): bump axe-core and @axe-core/playwright to 4.14.0 (plus two markup fixes below) |
| 35cf518 | build(deps): bump wxt to 0.21.5 |
| 926a1ff | fix(agent): render the Today pill space through a variable and pin it in a test |
| 69909a5 | build(deps): bump the ESLint family |
| 95ac21f | build(deps): bump bits-ui to 2.20.6 |
| ed367f2 | build(deps): bump layerchart to 2.9.2 |
| adc3b70 | build(deps): bump the shadcn-svelte CLI to 1.8.0 |
| a4f74c7 | chore(deps): refresh the minimatch audit exception evidence |
| 9e37125 | test(web): find the portal tiles by title and action now that the name includes the description |
| bd4d6a8 | test(web): a lazy-chunk retry recovers on Chromium 158 without a reload |

No `Co-Authored-By` trailer on any commit (checked with the trailer query). `scripts/assert-budget.mjs` is untouched.

## Per-family gates

- Playwright: build x3 exit 0, `smoke:local` 121 x 3 exit 0, layout+routing root subset 267 passed, web-browser project 208 passed (30 files), supply-chain test 18 passed.
- axe 4.14.0: new default rule `label-content-name-mismatch` (WCAG 2.5.3) failed 36 of 412 a11y tests. Root-caused in markup, rule not disabled: see deviations 1 and 2. After the fixes 412 passed on root+sub.
- wxt: `ext:build`, `ext:assert`, `ext:test:browser` (13), `vitest --project extension` (17 files, 242 tests), `ext:e2e` (7) all exit 0.
- ESLint family: `pnpm lint` exit 0 (0 errors, the one accepted GenerationPanel.svelte:83 warning), `pnpm check` exit 0, eslint-rules + agent-boundary + supply-chain 164 passed; `eslint.config.js` untouched.
- bits-ui: web-browser + serial 262 passed, a11y E2E 412 passed (root+sub).
- layerchart: same two gates, same results.

## Budget (configured, analytics-on build; KB gzip, limit 60)

| Page | Before (49623b9) | After bits-ui | After layerchart | Final HEAD |
|------|------------------|---------------|------------------|-----------|
| cash-on-cash | 59.9 | 59.9 | 59.9 | 59.9 |
| dscr | 59.9 | 59.9 | 59.9 | 59.9 |
| affordability | 59.8 | 59.8 | 59.8 | 59.8 |
| cap-rate | 59.8 | 59.8 | 59.8 | 59.8 |

Root build: cash-on-cash 59.8, dscr 59.8, affordability 59.7, cap-rate 59.6, unchanged across all bumps. Neither bump moved any gated page, so no bump was held back for budget.

## shadcn-svelte CLI 1.8.0 and Kit 3 `$app/tsconfig`

The CLI has no `--dry-run`. Used scratch copies outside the repo (junctioned node_modules, removed afterwards; repo `git status` unchanged):
- With `node_modules/$app` present (what `pnpm install` produces through `prepare`): `add button -y --no-deps-install` resolved the `#lib` alias from components.json, resolved `extends: "$app/tsconfig"` and wrote `src/lib/components/ui/button` only inside the scratch tree.
- With `node_modules/$app` absent: the CLI tried `npx svelte-kit sync` (the 1.7.2 behaviour) and errored because the scratch node_modules has no `.bin`; that failure is an artifact of the scratch setup, but it confirms the sync path triggers. No component was regenerated in the repo.

## minimatch exception: kept (final TOOL-05 count is five to two)

`pnpm why minimatch` still resolves one version, 10.2.6, under @eslint/config-array 0.23.5 and @typescript-eslint/typescript-estree 8.72.1. `npm view` shows eslint 10.15.0 (2026-11-13) and @eslint/config-array 0.23.6 on `minimatch ^11.0.5`, but `@typescript-eslint/typescript-estree` 8.72.2, the latest, still declares `^10.2.2`, so no available family combination leaves 10.x. Zero matches for minimatch in `apps/web/build/_app` and the extension output. `scripts/lib/audit-exceptions.mjs` why-text refreshed with these facts (a4f74c7); `revisitBy` stays 2026-12-31 (already inside the 2027-01-31 ceiling), so REQUIREMENTS.md, ROADMAP.md criterion 5 and the phase-list bullet already state the final state ("five to two", deepmerge 2027-01-31, minimatch 2026-12-31) and were not edited. `pnpm audit:deps` exit 0 with 2 ignored; GHSA count 2 equals the pnpm-workspace.yaml ignore count.

## Task 4: full verify chain at HEAD bd4d6a8 (`apps/web/build/_app/version.json` equals bd4d6a8)

Preconditions: clean tree apart from the never-staged `.planning/config.json`; last WLAN 8003 event 07:09 on 2026-11-15, none in the 6 hours before the chain; no llama-server running (only an idle `ollama` process, not started by this plan, CPU load about 47%); audit first.

| Stage | Exit | Seconds | Result |
|-------|------|---------|--------|
| install --frozen-lockfile | 0 | 0 | |
| audit:deps | 0 | 2 | 2 ignored |
| check | 0 | 26 | |
| lint | 0 | 122 | 0 errors, 1 accepted warning |
| banned | 0 | 1 | |
| ui:guard | 0 | 1 | |
| test:unit | 0 | 107 | 371 files, 7391 tests |
| build:root | 0 | 19 | |
| build:sub | 0 | 18 | |
| build:configured | 0 | 17 | |
| csp:assert | 0 | 1 | |
| seo:assert | 0 | 1 | |
| budget:assert | 0 | 2 | table above |
| test:e2e | 0 | 964 | 2350 passed, 4 skipped, 0 failed |
| smoke:local | 0 | 49 | 121 passed on each of 3 targets |
| guard | 0 | 3 | |
| fixtures:check | 0 | 2 | |
| secrets:canary | 0 | 1 | |
| secrets:scan | 0 | 3 | |
| lint:workflows | 0 | 2 | |
| ext:build | 0 | 3 | |
| ext:assert | 0 | 1 | |
| ext:test:browser | 0 | 5 | |
| ext:e2e | 0 | 5 | 7 passed |

An earlier full E2E run at an intermediate HEAD (a4f74c7) failed 46 tests (see deviations 1 to 3), took 2880 s because of 2-minute onboarding timeouts, and had no 8003 events in its window. It is not the evidence run.

## Deviations from Plan

1. **[Rule 1 - Bug, axe 4.14.0 finding] Today link in AgentNav**: visible text "Today" plus the due-count pill with no text space ("Today3") does not appear in the accessible name "Today, N tasks due". Fix: a real space (`{space}` variable, because a bare space is trimmed by Svelte and a `{' '}` literal trips `svelte/no-useless-mustaches`) and a unit assertion pinning it. I first committed the `{' '}` form in f326241 without running lint; the lint error surfaced in the ESLint family gate and 926a1ff corrected it.
2. **[Rule 1 - Bug, axe 4.14.0 finding] PortalTile**: the button name was title + action while the description is visible text inside the button. `aria-labelledby` now lists title, description, action and the redundant `aria-describedby` is gone. `aria-hidden` on the description does not satisfy the rule (tried, reverted).
3. **[Rule 1 - Bug] Specs located the tile by the old name** ("Renter Start the tour"): 38 onboarding, guide and feedback specs failed (many with 2-minute timeouts). Locators are now `^Title.*Start the tour$` regexes (9e37125).
4. **[Rule 1 - Bug] Chromium 158 behavior change**: `feedback.configured.spec.ts:312` and `waitlist.configured.spec.ts:190` encoded Chromium's old rule that a failed dynamic import stays failed for the page life. Reproduced standalone with both browsers: Chromium 153 (Playwright 1.63) retry after a served module fails, Chromium 158 (Playwright 1.65) retry succeeds. The tests now assert the first failure registers, then that the retry sends and shows success without a reload (bd4d6a8). Reproduced in isolation first; not a flake.
5. **Version-age exceptions**: bits-ui 2.20.6 instead of the plan's 2.21.0, layerchart 2.9.2 instead of 2.10.0, typescript-eslint 8.72.1 instead of 8.72.2, eslint 10.14.0 (7-day rule from the plan). Playwright 1.65.0 and wxt 0.21.5 as planned; shadcn-svelte 1.8.0 as planned.
6. **CLAUDE.md stack rows NOT updated**: Task 4 lists them, but the edit was refused by the permission system in this run and the caller's rule defers the stack table to plan 13. Rows still showing old versions: bits-ui 2.19.2, shadcn-svelte 1.6.1, LayerChart 2.5.0, WXT 0.21.4, Vitest 4.1.12 family, Playwright 1.63.0, and the compatibility rows. docs/RUNBOOK.md and README.md have no bumped-version mentions to change, so there is no "docs: record the final toolchain versions" commit. The plan's `git grep 1.63.0|4.1.12|2.70.3 CLAUDE.md` acceptance is therefore open until plan 13.
7. Plain `pnpm` used (global pnpm 11, lessons 2026-11-11).

## Dependabot state (read-only, nothing touched)

#9 is already CLOSED (superseded by Dependabot's own newer group PRs #12 closed, #15 open). #10 (tailwind-variants 3.3.1 to 4.0.1, a major this plan does not take) is OPEN and should stay open. #11, #13, #15 are open and untouched.

## Known Stubs

None.

## Resume point

Plan 13: close-out, TOOL ticks, CLAUDE.md stack table.
