---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 06
subsystem: infra
tags: [base-path, build-targets, github-pages, playwright, serve-pages, smoke, launch-audit, vitest]

# Dependency graph
requires:
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-02 resolveSiteUrl(env) = resolveSiteOrigin + resolveBasePath; DEFAULT_SITE_ORIGIN https://wolfwdavid.github.io
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-20 fixture files already on the owner origin
  - phase: 10-launch
    provides: scripts/lib/build-targets.mjs target table, serve-pages emulator, smoke.mjs, launch-audit collect()
provides:
  - targetEnv('root', env).BASE_PATH = resolveBasePath(env) (the owner knob, D-02); sub and configured ignore env.BASE_PATH
  - serve-pages mounts apps/web/build at the root target's base and frames it there on the attacker page
  - Playwright root project baseURL = http://127.0.0.1:${ROOT}${ROOT_BASE}/
  - smoke.mjs localTargets derive every base from the target overlay; remote smoke logs propagation seconds
  - routing.spec and agent-share-link.spec branch on the project's baseURL path, never on the project name
  - auditedBaseUrl(env) in scripts/launch-audit.mjs: the LAUNCH-AUDIT header from resolveSiteUrl over the root and sub target envs
  - build-web logs BASE_PATH alongside BUILD_DIR and BUILD_SHA
affects: [13-09 ci.yml BASE_PATH wiring, 13-10 local rehearsal with BASE_PATH=/tran_real_estate, 13-13 go-live, 13-18 LAUNCH-AUDIT regeneration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The root build's base is read from one table (targetEnv('root').BASE_PATH) by every local consumer: emulator mount, framing page, Playwright baseURL, smoke base URL. No consumer hard-codes '/' for root."
    - "E2E specs that assert on the base path read new URL(project.use.baseURL).pathname instead of branching on project.name; only build-DIR choices may branch on the name."

key-files:
  created: []
  modified:
    - scripts/lib/build-targets.mjs
    - scripts/build-targets.test.ts
    - scripts/build-web.mjs
    - scripts/serve-pages.mjs
    - apps/web/playwright.config.ts
    - scripts/smoke.mjs
    - scripts/smoke.test.ts
    - apps/web/tests/e2e/framing.spec.ts
    - apps/web/tests/e2e/routing.spec.ts
    - apps/web/tests/e2e/agent-share-link.spec.ts
    - scripts/launch-audit.mjs
    - scripts/launch-audit.test.ts

key-decisions:
  - "13-06: the root target's BASE_PATH is resolveBasePath(env), so a malformed value (Git Bash path conversion) fails by name at targetEnv time, in build-web, serve-pages, the Playwright config and smoke alike, instead of producing a build at a bad base"
  - "13-06: launch-audit's SEO siteUrl also uses resolveSiteUrl(tEnv) (it was the same expression spelled out), which let the resolveSiteOrigin and resolveBasePath imports go; header wording is 'root/deploy build' per the plan's behaviour spec"
  - "13-06: LIVE-03 left unchecked: this plan closes the research blocker in code; the base-path build + E2E rehearsal is plan 13-10 and the live routing contract is observed at go-live"

patterns-established:
  - "Base-path assertions in E2E read the project's baseURL path; project-name branches are reserved for choosing a build directory"

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-10-30
---

# Phase 13 Plan 06: Root BASE_PATH knob through the local tooling Summary

**`targetEnv('root').BASE_PATH` is now `resolveBasePath(env)`, and every local consumer of the root build (the Pages emulator mount and its framing page, the Playwright root project, `smoke.mjs` local targets, the routing and share-link specs, and the LAUNCH-AUDIT header) reads that base instead of assuming `/`, so a root build made with `BASE_PATH=/tran_real_estate` is served, framed, tested and audited at the path it deploys to.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-10-30T13:10:07Z
- **Completed:** 2026-10-30T13:16:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- **Build table (D-02):** `scripts/lib/build-targets.mjs` imports `resolveBasePath` and the root branch returns `{ BASE_PATH: resolveBasePath(env), BUILD_DIR: 'build', ...owner, ...site }`. Unset or `''` stays the site root, `/tran_real_estate` passes through, `C:/Program Files/Git/tran_real_estate` throws `BASE_PATH must be ...`. `sub` keeps `/tran_real_estate` and `configured` keeps `''` whatever `env.BASE_PATH` says. Five new tests in a `BASE_PATH (D-02)` describe; `workflow-gate.test.ts` (which calls `targetEnv(name, {})`) stays green.
- **Build log:** `build-web` prints `target=${name} BASE_PATH=${t.BASE_PATH || "''"} BUILD_DIR=... BUILD_SHA=...`, so the rehearsal run's root leg will show `target=root BASE_PATH=/tran_real_estate` in CI output.
- **Emulator:** `serve-pages.mjs` imports `targetEnv`, computes `ROOT_BASE = targetEnv('root').BASE_PATH`, mounts `apps/web/build` at `ROOT_BASE || '/'` (the existing `site()` prefix logic already handles a non-`/` mount, which is how the sub listener works) and the attacker page's three iframes point at `http://127.0.0.1:${ROOT}${ROOT_BASE}/`, `.../renter/`, `.../agent/`. Header comment updated; still only `node:` builtins plus the repo's own target table.
- **Playwright:** the root project's `baseURL` is `` `http://127.0.0.1:${ROOT}${ROOT_BASE}/` ``. `MSYS_NO_PATHCONV=1 BASE_PATH=/tran_real_estate pnpm --filter web exec playwright test --list --project=root` lists 1151 tests in 82 files (no server started); a malformed `BASE_PATH` makes the config load fail with the base-path error.
- **Smoke:** `localTargets` computes `base = resolveBasePath({ ...env, ...overlay }) + '/'` for every target (the project-name ternary is gone). Two new tests: with `{ BASE_PATH: '/tran_real_estate' }` root is `http://127.0.0.1:4273/tran_real_estate/` and its `siteUrl` ends in `/tran_real_estate/` while sub and configured are unchanged; a malformed value throws by name. `remote()` records `started` before `waitForVersion` and logs `smoke: <sha> live at <base> after N s` on success (Pitfall 3: measured, the 10-minute poll untouched).
- **Specs:** `framing.spec.ts` TARGETS carry `ROOT_BASE`; `routing.spec.ts` asserts link paths against `new URL(testInfo.project.use.baseURL!).pathname` whenever it is not `/` (the `SUB_BASE` constant is gone); `agent-share-link.spec.ts` expects `` `${new URL(baseURL!).pathname}agent/inquire/` ``. The sweep `grep -rnE "project\.name === 'sub'|127\.0\.0\.1:\$\{ROOT\}/"` over `apps/web/tests/e2e` and `scripts` leaves only the build-DIR choice in `routes-drift.spec.ts` (allowed; `build-stamp.spec.ts` uses a different form).
- **LAUNCH-AUDIT (Pitfall 8):** `export function auditedBaseUrl(env)` builds `` `${resolveSiteUrl(rootEnv)}/ (root/deploy build); ${resolveSiteUrl(subEnv)}/ (sub-path build)` `` from the two target envs; `collect()` uses it for `header.baseUrl`. With the knob set both halves read `https://wolfwdavid.github.io/tran_real_estate/`; with nothing set the root half is `https://wolfwdavid.github.io/`. Test fixtures no longer mention `tranrealestate`.

## Task Commits

Each task was committed atomically (RED and GREEN in one commit per TDD task so every commit is green on its own):

1. **Task 1: Root BASE_PATH knob in build-targets (+ build-web log)** - `2bb1444` (build)
2. **Task 2: Emulator, Playwright root project, smoke localTargets and specs follow the root base** - `bd9238e` (test)
3. **Task 3: LAUNCH-AUDIT header follows resolveSiteUrl** - `dc5bec0` (fix)

RED observed for Task 1 (2 failures: pass-through and malformed) and Task 3 (2 failures: `auditedBaseUrl is not a function`) before the GREEN edits.

## Files Created/Modified

- `scripts/lib/build-targets.mjs` - `resolveBasePath` import; root branch `BASE_PATH: resolveBasePath(env)`; header table comment
- `scripts/build-targets.test.ts` - `describe('BASE_PATH (D-02)')`, five tests
- `scripts/build-web.mjs` - log line carries `BASE_PATH=`
- `scripts/serve-pages.mjs` - `targetEnv` import, `ROOT_BASE`, root mount at `ROOT_BASE || '/'`, framing iframes under the base, header comments
- `apps/web/playwright.config.ts` - `targetEnv` import, `ROOT_BASE`, root project baseURL
- `scripts/smoke.mjs` - `localTargets` base from the overlay; propagation-seconds log in `remote()`
- `scripts/smoke.test.ts` - knob-set / unset localTargets case; malformed-knob case
- `apps/web/tests/e2e/framing.spec.ts` - `ROOT_BASE` in TARGETS
- `apps/web/tests/e2e/routing.spec.ts` - base check from `project.use.baseURL`; `SUB_BASE` removed
- `apps/web/tests/e2e/agent-share-link.spec.ts` - public page path from `baseURL`
- `scripts/launch-audit.mjs` - `auditedBaseUrl(env)`; `collect()` header uses it; SEO `siteUrl = resolveSiteUrl(tEnv)`; `resolveSiteOrigin`/`resolveBasePath` imports dropped
- `scripts/launch-audit.test.ts` - `auditedBaseUrl` tests; four fixture literals moved to `wolfwdavid.github.io`

## Decisions Made

- The root target validates `BASE_PATH` through `resolveBasePath` rather than passing the raw string, so every consumer that calls `targetEnv('root')` (build-web, serve-pages, Playwright config, smoke) fails by name on a Git Bash-converted path instead of building or serving at a bogus base.
- `launch-audit.mjs` line 1090 (`resolveSiteOrigin(tEnv) + resolveBasePath(tEnv)`) was the definition of `resolveSiteUrl(tEnv)`; it now calls the helper, which removed both older imports. Same value, one source.
- Header wording is `(root/deploy build)` as the plan's `<behavior>` block specifies; `docs/LAUNCH-AUDIT.md` is regenerated at the deployed commit in plan 13-18, not here.
- LIVE-03 stays unchecked (the blocker is closed in code; 13-10 proves it with a build + E2E run and go-live observes the live contract).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing validation proof] Malformed-knob test added to smoke.test.ts**
- **Found during:** Task 2
- **Issue:** The plan's smoke test cases covered the knob set and unset; nothing pinned that `localTargets` rejects a malformed `BASE_PATH` (the failure mode Pitfall 1 describes on Git Bash).
- **Fix:** One extra test: `localTargets({ BASE_PATH: 'C:/Program Files/Git/tran_real_estate' })` throws `/BASE_PATH must be/` (via `targetEnv('root')`).
- **Files modified:** scripts/smoke.test.ts
- **Verification:** 13/13 in `scripts/smoke.test.ts`
- **Committed in:** `bd9238e`

**2. [Rule 1 - Duplicate expression] SEO siteUrl in launch-audit.mjs switched to `resolveSiteUrl`**
- **Found during:** Task 3
- **Issue:** After the header moved to `resolveSiteUrl`, `collect()` still spelled the same value out as `resolveSiteOrigin(tEnv) + resolveBasePath(tEnv)` for the SEO oracle, leaving two imports whose only job was to duplicate the helper.
- **Fix:** `const siteUrl = resolveSiteUrl(tEnv);` and dropped the two imports (the plan said to keep them only if still used).
- **Files modified:** scripts/launch-audit.mjs
- **Verification:** `scripts/launch-audit.test.ts` 48/48; eslint clean (no unused imports)
- **Committed in:** `dc5bec0`

---

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 1)
**Impact on plan:** No scope change; both tighten the planned behaviour.

## Issues Encountered

- None. The parallel 13-07 executor's uncommitted `.github/dependabot.yml` and `scripts/supply-chain.test.ts` showed in `git diff --stat` mid-run; they were never staged here and were committed by that executor before this plan's final commit.

## Verification

Targeted only, per the parallel-execution rules (full `pnpm lint` / `pnpm test:unit` / builds / Playwright belong to the orchestrator and plan 13-10):

- `pnpm vitest run --project scripts scripts/build-targets.test.ts scripts/workflow-gate.test.ts scripts/smoke.test.ts scripts/launch-audit.test.ts` - 98/98
- `pnpm exec eslint` + `pnpm exec prettier --check` on all 12 modified files - clean
- `pnpm --filter web check` (`svelte-kit sync && svelte-check`) - 3255 files, 0 errors, 0 warnings
- `MSYS_NO_PATHCONV=1 BASE_PATH=/tran_real_estate pnpm --filter web exec playwright test --list --project=root` - 1151 tests in 82 files (config loads with the knob; no server started); same count without the knob; `BASE_PATH='C:/Program Files/Git/x'` fails the config load with `BASE_PATH must be`
- `node -e "...targetEnv('root',{BASE_PATH:'/tran_real_estate'}).BASE_PATH, JSON.stringify(targetEnv('root',{}).BASE_PATH), targetEnv('sub',{BASE_PATH:'/x'}).BASE_PATH"` prints `/tran_real_estate "" /tran_real_estate`
- `node -e "...auditedBaseUrl({})"` and `auditedBaseUrl({BASE_PATH:'/tran_real_estate'})` print the two expected headers
- Acceptance greps: `BASE_PATH: resolveBasePath(env)` 1; `BASE_PATH=${t.BASE_PATH` 1; `site(ROOT, ROOT_BASE || '/'` 1; `127.0.0.1:${ROOT}${ROOT_BASE}/` 3 in serve-pages and 1 in the Playwright config; old smoke ternary 0; `after ${Math.round` 1; `project.name === 'sub'` absent from routing and share-link specs; `export function auditedBaseUrl` 1; `resolveSiteUrl(rootEnv)` 1; hard-coded `/tran_real_estate/ (sub-path build)\`` 0; `tranrealestate` 0 in launch-audit.test.ts
- Commit hygiene: `git log -1 --format=%B | grep -ciE "co-authored-by|claude|anthropic"` printed 0 after each of the three commits

**Not run here (by design):** `pnpm build:*`, `pnpm test:e2e`, `pnpm smoke:local`, `pnpm audit:launch`. Plan 13-10 performs the serialized `BASE_PATH=/tran_real_estate` build + root E2E + smoke:local rehearsal that proves the blocker is closed end to end.

## Known Stubs

None.

## Next Phase Readiness

- Plan 13-09 can wire `BASE_PATH: ${{ vars.BASE_PATH }}` into ci.yml's root leg; `build-targets.mjs` consumes it and the gate test's `targetEnv(name, {})` expectations are unchanged.
- Plan 13-10's rehearsal: `MSYS_NO_PATHCONV=1 BASE_PATH=/tran_real_estate pnpm build:root` then `pnpm test:e2e --project=root` and `pnpm smoke:local --target root`; the emulator, config, framing page and smoke targets all agree on `/tran_real_estate`. Expect the build-web log line `target=root BASE_PATH=/tran_real_estate`.
- Plan 13-18 regenerates `docs/LAUNCH-AUDIT.md` with the deploy env; its "Base URL audited" line will read `https://wolfwdavid.github.io/tran_real_estate/ (root/deploy build); https://wolfwdavid.github.io/tran_real_estate/ (sub-path build)`.

## Self-Check: PASSED

All 12 modified files exist on disk; commits `2bb1444`, `bd9238e` and `dc5bec0` are in `git log`.
