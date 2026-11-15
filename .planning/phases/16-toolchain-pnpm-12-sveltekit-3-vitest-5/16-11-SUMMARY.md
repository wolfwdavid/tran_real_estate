---
phase: 16-toolchain-pnpm-12-sveltekit-3-vitest-5
plan: 11
status: paused at Task 4 (owner-approved push checkpoint); Tasks 1-3 committed, verify chain green except two load-induced E2E failures (see Task 3)
---

# Phase 16 Plan 11: Vitest 5 migration (paused at Task 4)

Not complete. Nothing is pushed, ci and live smoke have not run, and TOOL-04 / TOOL-06 are not ticked (plan 13 ticks them). STATE.md and ROADMAP.md are untouched.

## Commits (unpushed; origin/main..HEAD is 5 commits, the first is the 16-10 close-out docs)

| Hash | Subject |
|------|---------|
| 2d7423f | docs(16-10): complete Kit 3 close-out plan (carried, unpushed) |
| 18d045b | build: pin Vitest 5 with browser-playwright 5 and vitest-browser-svelte 3 |
| d3ee4f7 | test(web): exact-text and locator semantics for Vitest 5 |
| 669797f | test: pin each Vitest project to the shared worker cap and the web project root |
| ee0b9bc | chore(deps): release the Vitest major ignores and pin the reporter shard shape |

## Task 1: pins, awaited renders, AST guard

- Versions checked with `npm view` on 2026-11-14: vitest and @vitest/browser-playwright latest 5.1.0, vitest-browser-svelte latest 3.1.0. Plan pins kept; no newer patch exists.
- Pinned exactly: vitest 5.1.0 in root, apps/web, apps/extension, packages/brand, packages/core; @vitest/browser-playwright 5.1.0 and vitest-browser-svelte 3.1.0 in apps/web and apps/extension. No other Vitest-family package is declared. `git grep 4.1.12 -- '*package.json'` is empty.
- Lockfile diff review (one lockfile commit, 18d045b): the boot document (first 12 lines, pnpm 12.18.0) is byte-identical. Only the vitest family and its transitive dependencies moved. Package names new to the lockfile: `@vitest/ui` (a dependency of `@vitest/browser` 5, same publisher) and `fflate` (its dependency). Names gone: `@vitest/expect`, `@vitest/runner`, `@vitest/snapshot`, `siginfo`, `stackback`. Version bumps of existing names: chai 6.3.0, tinybench 6.2.3, tinyrainbow 3.2.0, std-env 4.3.0, why-is-node-running 3.2.1, obug 3.0.0, magic-string 1.4.5, @blazediff/core 1.10.0. `pnpm audit:deps`: 2 ignored, exit 0. `pnpm peers check` reports only the existing runed-vs-Kit 3 peer warning.
- scripts/vitest5-migration.test.ts (TypeScript AST over every tracked `*.test.ts` that imports `render` from vitest-browser-svelte). RED before the edits: exactly the 7 sites (popup.browser.test.ts 134, 168, 183, 191, 205, 215; FairRentCheck.browser.test.ts 152). Planted cases: bare render reported at line 3; `await render` not reported; `render` from `svelte/server` ignored; `import { render as r }` tracked by local name (`r(C)` reported at line 3). Non-vacuity: 37 files are scanned (floor 20). Also asserts `.vitest/` plus the two old attachment dirs in `.gitignore` (added `.vitest/` and `**/.vitest/`).
- 7 renders awaited. FairRentCheck's `mount` helper became `async` with `await render(...)` (its callers already awaited it).
- Mutation check on the guard's premise: removing the awaits from popup.browser.test.ts made only 1 of 13 tests fail. A bare render mostly still mounts in time (the retrying `expect.element` hides it), so the guard protects against a latent race, not a certain failure.

## Task 2: exact-text, locators, mocks and timers

Failure set before (after pins + awaited renders, web-browser + web-browser-serial, 262 tests): 24 failed in 6 files (the spike's 32 minus the 8 href cases already fixed by the plan 06 stub), each 15 s expect timeouts (run took 296 s):

| File | Failures |
|------|----------|
| DataShell.browser.test.ts | 16 |
| DueSearchesDialog | 3 |
| CapConfirmDialog | 2 |
| CapEditor | 1 |
| ShortlistToggle | 1 |
| affordability (getByText partial) | 1 |

After: 0 failed, 34 files, 262 tests, 48 s.

Fixes (no timeout option, retry or `toPass` added; `git diff` has zero added "timeout" lines):

- `toHaveTextContent` to `toMatchTextContent` (confirmed in @vitest/browser 5.1.0 jest-dom.d.ts: substring for strings, RegExp allowed, same argument kept) wherever a dialog or region assertion meant "contains": all of DueSearchesDialog, CapConfirmDialog 56/71/72, CapEditor 181-183, ShortlistToggle 60, DataShell except the three `outcome` testid reads. Negated uses (`not.toHaveTextContent('Sample data')` etc.) had to move too: under exact semantics they would pass vacuously. Left exact on purpose (already whole-text and passing): rerender.browser 6 uses, `Save`/`Saved`, `Spending…`, `Saving…`, the `outcome` testid reads.
- `getByText(..., { exact: false })` on two affordability calls (`within the 30% guideline`, and `above the 40% check`, which the first failure had masked). The project-wide `browser.locators.exact` is unchanged.

Audit table:

| Item | Sites | Action |
|------|-------|--------|
| clearMocks default true | 6 explicit `mockClear` calls (panel-state, scheduler, FairRentCheck, DataShell, GatewayError, RentCastUsageSection) plus 30 `restoreAllMocks` | none needed: all call counts are asserted within one `it`; full unit run and both browser projects green |
| `vi.mock` / `vi.hoisted` top-level | 8 `vi.mock`, 3 `vi.hoisted` | none needed: all top-level; green |
| browser automocks returning undefined | 4 `vi.mock(..., { spy: true })` for the announcer | none needed: already spy mode |
| `expect.poll` | 9 browser files | none needed: none started failing |
| fake timers / Temporal | 7 files use `useFakeTimers`; no `Temporal` in app code | none needed: green |

Per-file durations (sum of test durations, web browser projects, Vitest 4 run vs Vitest 5 run after fixes): no file is faster by more than 2x except sub-300 ms files (primitives 222 to 162 ms, renter-storage 251 to 131 ms, CostLabel 273 to 153 ms, NewSinceBadge 132 to 106 ms, spike 103 to 63 ms), all of which assert visible content. Most files are 1.0x to 2.4x slower (e.g. CapEditor 5.5 s to 13.3 s, dropdown-menu 0.56 s to 2.5 s). Extension popup.browser.test.ts: 1311 ms to 650 ms, uniformly about 2x on every one of the 13 tests including the axe and text-assertion tests, so not an unmounted component (the mutation check above shows the assertions bite).

## Task 3: reporter, lanes, extension, verify chain

- Reporter: `node scripts/audit-evidence.mjs unit smoke-check --project brand` wrote `.tools/audit-evidence/unit-smoke-check.json` (the plan said apps/web/test-results; the real shard dir is `.tools/audit-evidence`) with numTotalTests 29, testResults array of 2; file deleted. New test in scripts/audit-evidence.test.ts spawns a real `vitest run --root <tmp> --globals --reporter=dot --reporter=json --outputFile.json=<tmp>/shard.json` over one fixture test outside the repo, asserts numTotalTests > 0 and a testResults array, and feeds it to `mergeVitestReports`. It takes about 1-2 s and stays in the parallel lane.
- `vitest run --project extension`: 17 files, 242 tests green. `pnpm ext:test:browser`: 13 tests green. Lane tests (test-lanes, test-lane-rules, lane-order, lane-configs): 229 tests green, and the full `pnpm test:unit` shows the three ordered groups (parallel, node serial, browser serial) working on 5.1.0 in one invocation; the two-invocation fallback is not needed.
- Dependabot: removed the vitest, `@vitest/*`, vitest-browser-svelte major ignores; `TOOLCHAIN_MAJOR_IGNORES` is now `['pnpm', '@types/node']`; RUNBOOK sentence updated; runbook.test.ts non-vacuity floor lowered from 5 to 2. PRs #9 and #10 untouched (plan 12).

### Stage table (HEAD ee0b9bc, all three targets rebuilt at that commit; `apps/web/build/_app/version.json` = ee0b9bc)

| Stage | Exit | Seconds | Result |
|-------|------|---------|--------|
| install --frozen-lockfile | 0 | 2 | |
| audit:deps | 0 | 2 | 2 ignored (1 low, 1 moderate) |
| check | 0 | 48 | |
| lint | 0 | 291 | 0 errors, the 1 accepted GenerationPanel.svelte:83 warning |
| banned, ui:guard | 0, 0 | 2, 1 | |
| test:unit | 0 | 229 | 371 files, 7391 tests |
| build:root / sub / configured | 0 / 0 / 0 | 41 / 41 / 43 | |
| csp:assert, seo:assert, budget:assert | 0 | 2, 2, 3 | budget identical to plan 10: cash-on-cash 59.9, dscr 59.9, affordability 59.9, cap-rate 59.8 KB (limit 60) |
| test:e2e run 1 | 1 | 1811 | 2344 passed, 6 failed, 4 skipped; 4 WLAN event 8003 inside the window |
| test:e2e run 2 | 1 | 1753 | 2348 passed, 2 failed, 4 skipped; no 8003 event |
| smoke:local | 0 | 84 | 121 passed on each of 3 targets |
| guard, fixtures:check, secrets:canary, secrets:scan, lint:workflows | 0 | 6, 3, 3, 9, 3 | |
| ext:build, ext:assert, ext:test:browser, ext:e2e | 0 | 17, 2, 11, 10 | 13 and 7 passed |

WLAN evidence: last 8003 before the first E2E run was 19:02:14 (quiet 4 h 56 min). Run 1 started 23:59 and saw 8003 at 00:01:27, 00:03:47, 00:10:10, 00:19:20. After 10+ quiet minutes the six run-1 specs (168 parametrised tests) were re-run: 168 passed. Run 2 started 00:30:42 with no 8003 event until its end (01:00).

### E2E: red, root-caused to a pre-existing load-sensitive race, not to this plan

- Run 2 failures: `studio-social.spec.ts:278` [root] (`[data-disclosure-status="ready"]` not visible in 5 s) and `agent-followup.spec.ts:251` [sub] (`Add a lead` dialog not visible in 5 s after the click). Each passed on the other target in the same run.
- Reproduced in isolation: `agent-followup.spec.ts:251` failed 1 of 8 runs at HEAD.
- Attribution: a throwaway worktree at 2d7423f (Kit 3 plus Vitest 4, i.e. before this plan), `build:root`, `playwright test agent-followup.spec.ts:251 --project=root --repeat-each=20` failed 5 of 20 with the identical `getByRole('dialog', { name: 'Add a lead' })` error on the same machine load. The worktree was removed.
- Cause of the pressure: `llama-server` (a local model server, not started by this plan) holds the CPU at 100% (about 8 cores, measured 32 CPU-seconds per 4 s). Everything is about 2x slower than plan 10's green run (lint 291 s vs 117 s, unit 229 s vs 115 s, E2E 1750 s vs 899 s). No Vitest code runs in E2E; the only non-test diffs are `apps/web/vite.config.ts` (the new `root` is set only when VITEST is true) and package/lockfile pins, and the budget numbers are identical.
- The test passes the hydration helper first (`expectHydrated`), then clicks, so the remaining race is inside the app or the helper under load. It is not fixed here: that is a separate root-cause job on a pre-existing flake (candidate for a deferred item), and a fix would change E2E behaviour outside this plan.
- Net: the chain is not literally green. Stages other than the two full E2E runs are green. The decision whether to push with this known pre-existing load flake, or to wait for a quiet machine and re-run `pnpm test:e2e`, is the owner's at Task 4.

## Deviations from Plan

1. **[Rule 3 - Blocking] Vitest 5 rejects mixed `maxWorkers` in one group.** Under `pnpm test:unit`, "Projects web and web-browser (chromium) have different maxWorkers but same sequence.groupOrder": Vitest 5 resolves a default per project instead of inheriting the root value. Fix: `maxWorkers: MAX_WORKERS` in the web, core, brand, scripts and extension project configs (669797f). The plan said the lane tests passed in the spike; they do, but the real run did not.
2. **[Rule 3 - Blocking] 28 web unit files failed to load (`Unknown file extension ".svelte"` for @lucide/svelte and bits-ui) under the root run only.** Vitest 5 applies the project root after the Svelte plugin's config hook, so the plugin scanned the repo root package.json and left Svelte libraries external. Fix: `root: isVitest ? <apps/web dir> : undefined` in apps/web/vite.config.ts (669797f). Build and dev are unaffected.
3. The two Vitest-5 exact-text and `{ exact: false }` edits needed a prettier pass, folded into ee0b9bc.
4. Plain `pnpm` used instead of `corepack.cmd pnpm` (tasks/lessons.md 2026-11-11; global pnpm 11).
5. The reporter shard dir is `.tools/audit-evidence`, not `apps/web/test-results`.
6. The plan said the migration test's `.gitignore` check reads via a CRLF-normalising helper; done.

CLAUDE.md still describes Vitest 4.1.12 in its stack table; left for plan 13 (docs).

## Known Stubs

None.

## Resume point

Task 4 only: owner approval, `git push origin main` (5 commits), ci run, live-smoke run, then record both URLs. TOOL-04 and TOOL-06 are ticked in plan 13.
