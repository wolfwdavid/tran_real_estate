---
phase: 16-toolchain-pnpm-12-sveltekit-3-vitest-5
verified: 2026-11-16T12:46:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 16: Toolchain: pnpm 12, SvelteKit 3, Vitest 5 Verification Report

**Phase Goal:** The platform runs on current, supported majors (pnpm 12, SvelteKit 3.1 + adapter-static 4, Vitest 5 with its browser companions), migrated one tool per plan in that order with the full `pnpm verify` chain and the local smoke as the gate after each and a deploy plus a green live smoke closing the phase, clearing the three Kit-related audit exceptions.
**Verified:** 2026-11-16T12:46:00Z
**Status:** passed
**Re-verification:** No, initial verification

Verified at local HEAD `f525407` (origin/main `679b0a1`; the two local commits above it touch only `.planning/`, the project instructions file and `docs/test-evidence/2026-11-16.md`). Must-haves are the five ROADMAP success criteria; plan frontmatter truths were used as supporting detail and do not narrow them.

Method limits: no build, `pnpm verify`, Playwright or full unit run was executed here (owner constraint). Runtime claims rest on GitHub Actions runs queried with `gh` in this session, on 12 guard test files run here, and on `pnpm audit:deps` run here. `pnpm install --frozen-lockfile` was not re-run locally (it re-runs prepare scripts); the CI log is the evidence for it.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `packageManager` pins pnpm 12; lockfile regenerated once; no hardcoded `11.27.0` in the supply-chain test, `build-web.mjs` or the launch-audit test; frozen install passes | VERIFIED | `package.json:5` is `pnpm@12.18.0`; `pnpm --version` prints 12.18.0. `pnpm-lock.yaml` has the pnpm 12 boot document (lines 1 to 157, `packageManagerDependencies` 12.18.0) and the project document from line 158. `git log -S'pnpm@12' -- package.json` gives one commit, `2a53e16`, which is also the only lockfile commit of the pnpm step (+158 lines, the boot document). `git grep "11\.27"` outside `.planning` hits only the project instructions file line 129 (rollback note), `docs/test-evidence/2026-11-10.md:3` (historic record) and `tasks/lessons.md:140`; zero hits under `scripts/`. `scripts/supply-chain.test.ts` and `scripts/launch-audit.test.ts` pass here. CI run 43864552755 at `679b0a1`: `pnpm install --frozen-lockfile` logged "Lockfile is up to date" on all three legs; the live-smoke job logged the same. |
| 2 | Web app on SvelteKit 3.1 + adapter-static 4; options in `vite.config.ts` via plugin-free `kit.options.js`; zero `$lib`, `$service-worker`, `@migration-task`; `#lib` with explicit extensions everywhere; Kit 3 forms; three builds pass the oracles | VERIFIED | `apps/web/package.json`: `@sveltejs/kit` 3.1.1, `@sveltejs/adapter-static` 4.0.1; lockfile resolves the same (lines 806, 811). No `apps/web/svelte.config.js`. `apps/web/vite.config.ts:27` calls `sveltekit(kitOptions)`; `apps/web/kit.options.js` imports only the adapter and local modules (no Kit Vite plugin) and is imported by `src/lib/csp-policy.test.ts:4`, `src/lib/ai/models.test.ts:3` and read by `scripts/site-url.test.ts:112`; the worker guard is `scripts/service-worker-guard.test.ts`. Greps for the three retired tokens hit only the two guard tests that must spell them (`scripts/kit3-migration.test.ts`, `scripts/service-worker-guard.test.ts`). `#lib` imports without an extension: only three planted string literals inside tests. `apps/web/package.json` `imports` maps `#lib` and `#lib/*`; `apps/web/components.json` aliases are all `#lib`; `eslint.config.js:41-46,65,228-232` use the escaped `\\#lib` groups. Worker imports `$app/manifest`, `$app/env`, `$app/paths` (`resolve`, `asset`); shallow routing uses `goto(href, { shallow: true, replace: true, state: page.state })` (ContactsView.svelte:92, StageBoard.svelte:111, `(app)/+layout.svelte:66`). `scripts/kit3-migration.test.ts`, `scripts/eslint-rules.test.ts`, `scripts/assert-budget.test.ts` pass here (planted cases keep them non-vacuous). CI run 43864552755: Build, CSP oracle and SEO oracle green on root, sub and configured; JS budget green on root and configured (the two builds `budget:assert` covers by definition). |
| 3 | After the Kit 3 deploy the live smoke shows the rewritten worker registering on the live origin with scope `/tran_real_estate/` and precaching only same-origin non-dotfile GETs, cache `tran-shell-<sha>` | VERIFIED | `apps/web/src/service-worker/index.ts:19-21,26-37` builds the precache from `$app/manifest` and filters dotfiles in the worker through `apps/web/src/lib/precache-filter.ts`. `apps/web/tests/smoke/pwa.smoke.ts:11-36` asserts scope equals the base URL, one cache named `tran-shell-` + expected version, same-origin URLs under the base with no dot segment. Live-smoke run 43867700929 (head `679b0a1`, success, base `https://wolfwdavid.github.io/tran_real_estate/`): both worker tests and the version test passed, 121 passed. First Kit 3 live proof: live-smoke 43675572754 at `ed3210e`, success. |
| 4 | Unit and browser tests on Vitest 5 with `@vitest/browser-playwright` 5 and `vitest-browser-svelte` 3; every render awaited; exact-text and `clearMocks` accounted for; JSON reporter path works; full verify green | VERIFIED | `vitest` 5.1.0 in all five manifests, `@vitest/browser-playwright` 5.1.0 and `vitest-browser-svelte` 3.1.0 in web and extension; lockfile lines 1043, 2562, 2568 agree; the runner banner here is `RUN v5.1.0`. No un-awaited `render(` in any file importing `vitest-browser-svelte` (135 awaited calls); the remaining bare calls are `svelte/server` SSR renders, which are synchronous. `scripts/vitest5-migration.test.ts` enforces this with planted cases and passes. `scripts/audit-evidence.mjs:260-262` uses `--reporter=json` with `--outputFile.json=`; `scripts/audit-evidence.test.ts` passes. `clearMocks`: no config override exists; the new default is absorbed by explicit `mockClear`/`restoreAllMocks` calls, and the proof is the green suite. Full chain: CI 43864552755 green at `679b0a1` with `Test Files 372 passed (372)` on each leg plus build, oracles, E2E and extension steps; `docs/test-evidence/2026-11-16.md` records three local `pnpm verify` runs at `c14e964`, and `git diff c14e964 679b0a1` touches only `docs/` and `tasks/lessons.md`. |
| 5 | Audit exceptions five to two in both files; audit clean apart from them; each step its own plan sequence gated and closed by a deploy with a green live smoke | VERIFIED | `scripts/lib/audit-exceptions.mjs` holds exactly GHSA-gcqx-w48m-w2h4 (deepmerge, revisitBy 2027-01-31) and GHSA-g3hv-75wg-m249 (minimatch, revisitBy 2026-12-31); `pnpm-workspace.yaml:9-10` lists the same two. The three Kit 2 advisories appear only in `scripts/supply-chain.test.ts:87,94` as a removed-list assertion. `pnpm audit:deps` run here: exit 0, "2 ignored: 1 low, 1 moderate"; same line in CI. History: pnpm pin `2a53e16` (2026-11-11), Kit pins and codemod `65c4575` to `aee4eb8` (2026-11-14), Vitest pin `18d045b` (2026-11-15), in that order. Each step has a green ci plus live-smoke pair on its pushed head: pnpm `9ff0435` (43022965174 / 43026334381), Kit 3 `ed3210e` (43673499633 / 43675572754), Vitest 5 `587c51c` (43712512564 / 43714943846), routine bumps `ab1dc90` (43790148391 / 43793250837), close `679b0a1` (43864552755 / 43867700929). See note 1 on the "one push" wording. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `package.json` | pnpm 12 pin, Vitest 5 | VERIFIED | `pnpm@12.18.0`, `vitest` 5.1.0 |
| `pnpm-lock.yaml` | two-document pnpm 12 lockfile | VERIFIED | boot document + project document; checked by `scripts/supply-chain.test.ts` |
| `apps/web/kit.options.js` | plugin-free Kit options | VERIFIED | adapter, paths, version, prerender, csp; imported by build config and tests |
| `apps/web/vite.config.ts` | `sveltekit(kitOptions)` | VERIFIED | Kit plugin for dev/build, plain Svelte plugin under Vitest |
| `apps/web/src/service-worker/index.ts` | worker on `$app/manifest` | VERIFIED | in-worker dotfile filter, cache-first allowlist, no runtime caching |
| `vitest.config.ts` + lane configs | Vitest 5 projects | VERIFIED | ten projects, serial lanes file-based |
| `scripts/lib/audit-exceptions.mjs` / `pnpm-workspace.yaml` | two matching exceptions | VERIFIED | equality enforced by the supply-chain test |
| `docs/LAUNCH-AUDIT.md` | regenerated on the final toolchain | VERIFIED | Commit `c14e964`, pnpm 12.18.0, nine checks PASS; code identical to the deployed `679b0a1` |
| `docs/test-evidence/2026-11-16.md` | Vitest 5 evidence protocol | VERIFIED | shape checked by `scripts/test-evidence.test.ts` (passes); CI section matches `gh` output |
| `.github/workflows/ci.yml`, `live-smoke.yml` | frozen install, audit, oracles, flaky gate, live smoke | VERIFIED | `scripts/workflow-gate.test.ts` and `scripts/live-smoke-gate.test.ts` pass |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `vite.config.ts` | `kit.options.js` | default import passed to `sveltekit()` | WIRED | line 7 and line 27 |
| CSP and models tests | `kit.options.js` | direct import | WIRED | `csp-policy.test.ts:4`, `models.test.ts:3` |
| service worker | `precache-filter.ts` | `precacheFiles(assets)` | WIRED | `index.ts:21,32` |
| `audit-exceptions.mjs` | `pnpm-workspace.yaml` | supply-chain equality test | WIRED | test passes; both list the same two IDs |
| `audit-evidence.mjs` | Vitest JSON report | `--outputFile.json=` | WIRED | lines 260-262; test passes |
| ci.yml | live-smoke.yml | `workflow_run` on completed ci | WIRED | run 43867700929 has event `workflow_run`, head `679b0a1` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Migration and supply-chain guards | `pnpm exec vitest run --project scripts` on kit3-migration, vitest5-migration, service-worker-guard, supply-chain | 4 files, 49 tests passed on Vitest 5.1.0 | PASS |
| Evidence, audit and workflow guards | `pnpm exec vitest run` on audit-evidence, launch-audit, test-evidence, pnpm-cmd, live-smoke-gate, workflow-gate, eslint-rules, assert-budget | 8 files, 299 tests passed | PASS |
| Dependency audit | `pnpm audit:deps` | exit 0, 2 ignored (1 low, 1 moderate) | PASS |
| CI at the deployed commit | `gh run view 43864552755` | success, head `679b0a1`, deploy job success | PASS |
| Live smoke at the deployed commit | `gh run view 43867700929` | success, head `679b0a1`, 121 passed | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist and no plan declares one. Skipped.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| TOOL-01 | 16-04 | SATISFIED | Truth 1 |
| TOOL-02 | 16-05 to 16-10 | SATISFIED | Truth 2 |
| TOOL-03 | 16-08, 16-10 | SATISFIED | Truth 3 |
| TOOL-04 | 16-11, 16-13 | SATISFIED | Truth 4 |
| TOOL-05 | 16-10 | SATISFIED | Truth 5 |
| TOOL-06 | 16-01 to 16-04, 16-10 to 16-13 | SATISFIED | Truth 5 |

All six IDs mapped to Phase 16 in REQUIREMENTS.md are claimed by a plan; none orphaned.

### Anti-Patterns Found

No TBD, FIXME or XXX marker in any file changed since the pnpm pin commit (outside `.planning`).

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `apps/web/src/lib/ai/ui/GenerationPanel.svelte` | 83 | unused `eslint-disable` directive (lint warning) | Info | Accepted and recorded; lint exits 0 |
| `docs/audit/budget.txt` | - | calculator pages about 0.2 KB under the 60 KB budget, landing about 0.6 KB under | Info | Carried risk, recorded; any growth trips the gate |
| Vitest config files | - | Vite warns that extensionless config imports are unsupported by the future native config loader | Info | No effect today; a chore for the next Vite major |

### Notes

1. "One push" wording. ROADMAP criterion 5 says the Kit 3 major was "one major, one push". The Kit code range was pushed once (to `70e030a`), but ci went red on it (run 43663793959, a flaky sub E2E), and two more pushes also went red (43668365203 at test:unit after a workflow edit, 43669219058 on a second sub flake) before `ed3210e` went green and deployed. The follow-ups were test and CI fixes, no red run deployed, and 16-10-SUMMARY records all of it. The gate clause of the criterion holds; the "one push" phrase is loose. Not a gap; the owner may want the wording aligned.
2. ROADMAP bookkeeping is stale for this phase: line 43 checkbox unchecked, line 216 says "10/13 plans executed", line 310 says "8/13 In Progress", while all 13 plans are ticked. Expected to be fixed by the phase-complete step.
3. The project instructions file (stack table, line 73) lists svelte-check 4.7.6; the manifests pin 4.7.8. Doc drift only.
4. Local HEAD is two docs-only commits above the deployed commit. Pushing them changes the build stamp and triggers a new deploy and live smoke; that run is not covered by this report.

### Human Verification Required

None. The worker and deploy behaviour that would need a human is asserted by the automated live smoke.

### Gaps Summary

No gaps. All five success criteria hold in the repository and in the CI and live-smoke runs for the deployed commit.

---

_Verified: 2026-11-16T12:46:00Z_
_Verifier: gsd-verifier_
