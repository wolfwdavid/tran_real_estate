---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 02
subsystem: infra
tags: [site-url, base-path, github-pages, wxt, extension, oracle, vitest]

# Dependency graph
requires:
  - phase: 10-launch
    provides: site-config.js owner-setting validators (resolveSiteOrigin), base-path.js resolveBasePath, __SITE_URL__ define
  - phase: 11-extension
    provides: apps/extension/src/lib/site.ts PRIVACY_URL, scripts/assert-extension.mjs urlAllowlist, scripts/site-url.test.ts groups (a)-(d)
provides:
  - resolveSiteUrl(env) in apps/web/src/lib/site-config.js: validated PUBLIC_SITE_URL origin + validated BASE_PATH, no trailing slash
  - DEFAULT_SITE_ORIGIN = https://wolfwdavid.github.io (the owner's Pages origin; the project site lives under /tran_real_estate)
  - Web __SITE_URL__, extension __TRAN_SITE_URL__ and the extension oracle allowlist all read resolveSiteUrl()
  - Extension TRAN_SITE_URL / TRAN_ORIGIN / PRIVACY_URL derived from one define (PRIVACY_URL carries the base path)
  - scripts/site-url.test.ts group (e): BASE_PATH alone moves resolveSiteUrl, the extension define and the oracle allowlist together
affects: [13-20 fixture substitution, 13-06 first deploy, 13-09 extension release workflow, 14 DEBT-03 origin parity, extension store listing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One build-time URL helper (resolveSiteUrl) shared by the web define, the extension define and the extension oracle, so origin/base mismatches are structurally impossible"
    - "Negative assertions on removed defines use whole-set checks (Object.keys(define) equals the one expected key; the regex set of __X__ globals in site.ts equals the one expected name) instead of naming the legacy key, so the repo-wide grep for the old name stays empty"

key-files:
  created: []
  modified:
    - apps/web/src/lib/site-config.js
    - apps/web/src/lib/site-config.d.ts
    - apps/web/src/lib/site-config.test.ts
    - apps/web/src/lib/site.ts
    - apps/web/src/lib/site.test.ts
    - apps/web/vite.config.ts
    - apps/extension/src/lib/site.ts
    - apps/extension/wxt.config.ts
    - apps/extension/vitest.config.ts
    - apps/extension/vitest.browser.config.ts
    - apps/extension/tests/browser/popup.browser.test.ts
    - eslint.config.js
    - scripts/assert-extension.mjs
    - scripts/assert-extension.test.ts
    - scripts/site-url.test.ts

key-decisions:
  - "13-02: DEFAULT_SITE_ORIGIN is https://wolfwdavid.github.io; the live site is a project site under BASE_PATH, so every absolute URL goes through resolveSiteUrl() = resolveSiteOrigin(env) + resolveBasePath(env) (D-03, D-04)"
  - "13-02: extension define renamed __TRAN_ORIGIN__ -> __TRAN_SITE_URL__; TRAN_ORIGIN is derived with new URL(TRAN_SITE_URL).origin and kept for Phase 14 DEBT-03 wording"
  - "13-02: urlAllowlist appends resolveSiteUrl(env) + '/', so the oracle rejects both a lookalike host and a sibling project site on the shared wolfwdavid.github.io origin"
  - "13-02: LIVE-03 left unchecked (origin/base helper half only); the plan that observes the first deploy and the live routing contract closes it"
  - "13-02: pnpm ext:test:browser deferred to the orchestrator's post-wave run (Playwright Chromium is barred for parallel executors); the only change in that file is the default PRIVACY_URL literal"

patterns-established:
  - "Each TDD task commit is independently green: a cross-task test literal that only changes the default origin is updated with the task that changes the origin, and the rename lands with the task that renames"

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-10-30
---

# Phase 13 Plan 02: resolveSiteUrl, owner Pages origin and extension site URL Summary

**One helper `resolveSiteUrl(env)` (validated `PUBLIC_SITE_URL` origin + validated `BASE_PATH`) now feeds the web `__SITE_URL__`, the extension `__TRAN_SITE_URL__` and the extension oracle allowlist, with `DEFAULT_SITE_ORIGIN` moved to `https://wolfwdavid.github.io`, so the extension privacy link resolves to `https://wolfwdavid.github.io/tran_real_estate/legal/privacy/#browser-extension` on the live project site instead of 404ing at the bare origin (Pitfall 10).**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-30T11:37:39Z
- **Completed:** 2026-10-30T11:45:32Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- `resolveSiteUrl(env)` added to `apps/web/src/lib/site-config.js` (plus the `.d.ts` stub), tested on six cases: default, probe origin + base, base alone, empty values treated as unset, Git Bash path-converted `BASE_PATH` rejected with the base-path error, and a path inside `PUBLIC_SITE_URL` still rejected (D-01: the origin validator is not loosened).
- `DEFAULT_SITE_ORIGIN` is `https://wolfwdavid.github.io`; the web `__SITE_URL__` define is `JSON.stringify(resolveSiteUrl())` (the `resolveBasePath` / `resolveSiteOrigin` imports in `vite.config.ts` had no other consumer and were dropped).
- Extension: `__TRAN_ORIGIN__` is gone everywhere outside `.planning/`. `src/lib/site.ts` exports `TRAN_SITE_URL` (the define), `TRAN_ORIGIN` (`new URL(TRAN_SITE_URL).origin`) and `PRIVACY_URL` (`${TRAN_SITE_URL}/legal/privacy/#browser-extension`); `wxt.config.ts`, `vitest.config.ts` and `vitest.browser.config.ts` define `__TRAN_SITE_URL__: JSON.stringify(resolveSiteUrl())`; the eslint global is renamed.
- Oracle: `scripts/assert-extension.mjs` `urlAllowlist(env)` returns `[...STATIC_URL_ALLOWLIST, \`${resolveSiteUrl(env)}/\`]`, so a sibling project site on the shared origin (e.g. `https://wolfwdavid.github.io/` or another repo's path) is not allowlisted.
- `scripts/site-url.test.ts`: `HOST` is `wolfwdavid.github.io` (the group (a) sweep still finds exactly one code-line hit, `DEFAULT_SITE_ORIGIN`); group (b) expects `__SITE_URL__: JSON.stringify(resolveSiteUrl())`; group (c) covers the renamed define with probe, probe + base path and unset cases and asserts the define holds exactly one key; new group (e) stubs only `BASE_PATH=/probe_base` and proves `resolveSiteUrl()`, the wxt define and `urlAllowlist()` all move to `https://wolfwdavid.github.io/probe_base` while the bare origin is absent from the allowlist.

## Task Commits

Each task was committed atomically:

1. **Task 1: resolveSiteUrl helper, new DEFAULT_SITE_ORIGIN, web define** - `aeadf71` (feat)
2. **Task 2: Extension define __TRAN_SITE_URL__ and oracle allowlist from resolveSiteUrl, base-path proof group** - `e2e3477` (feat)

Both tasks were TDD (RED observed: 7 failures each, then GREEN). RED and GREEN landed in one commit per task so that every commit in the sequence is green on its own.

## Files Created/Modified

- `apps/web/src/lib/site-config.js` - `DEFAULT_SITE_ORIGIN = 'https://wolfwdavid.github.io'`; new `resolveSiteUrl(env)`; imports `resolveBasePath` from `./base-path.js` (no cycle: base-path.js has no imports)
- `apps/web/src/lib/site-config.d.ts` - `resolveSiteUrl` signature; "six exports"
- `apps/web/src/lib/site-config.test.ts` - `describe('resolveSiteUrl')` with six behaviours; default-origin test renamed and retargeted
- `apps/web/src/lib/site.ts` - `SITE_URL` doc comment names the new origin
- `apps/web/src/lib/site.test.ts` - default `SITE_URL`/`SITE_ORIGIN` literals and test name
- `apps/web/vite.config.ts` - `__SITE_URL__: JSON.stringify(resolveSiteUrl())`
- `apps/extension/src/lib/site.ts` - `__TRAN_SITE_URL__` declare; `TRAN_SITE_URL`, derived `TRAN_ORIGIN`, `PRIVACY_URL` with base path
- `apps/extension/wxt.config.ts` - `resolveSiteUrl` import, `__TRAN_SITE_URL__` define, comment naming `PUBLIC_SITE_URL` + `BASE_PATH`
- `apps/extension/vitest.config.ts`, `apps/extension/vitest.browser.config.ts` - same define swap
- `apps/extension/tests/browser/popup.browser.test.ts` - default `PRIVACY_URL` literal is `https://wolfwdavid.github.io/legal/privacy/#browser-extension`
- `eslint.config.js` - `__TRAN_SITE_URL__: 'readonly'` replaces the old global
- `scripts/assert-extension.mjs` - `urlAllowlist` built from `resolveSiteUrl(env)`; header and doc comments updated
- `scripts/assert-extension.test.ts` - BASE_PATH allowlist case (probe + base, default origin + base, Git Bash path rejected)
- `scripts/site-url.test.ts` - header, `HOST`, group (b)/(c) updates, new group (e), hoisted `wxtDefine` helper, `urlAllowlist` import

## Decisions Made

- `DEFAULT_SITE_ORIGIN` is the owner's Pages origin and every absolute URL is composed by `resolveSiteUrl()` (D-03, D-04 as planned).
- Negative assertions for the removed define use whole-set checks (`Object.keys(define)` equals `['__TRAN_SITE_URL__']`; the set of `__X__` globals in `site.ts` equals `{'__TRAN_SITE_URL__'}`) rather than naming `__TRAN_ORIGIN__`, because the plan's acceptance grep requires the old name to be absent repo-wide while the plan's action text asked for a by-name negative. The whole-set form is also stronger (it would catch any stray extra define).
- The header comment says "(e) BASE_PATH on its own" so the acceptance grep `(e) BASE_PATH alone` counts exactly the `describe` title.
- LIVE-03 left unchecked: this plan delivers the origin/base helper half; the live deploy and routing contract are observed by a later Phase 13 plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Group (c) default literal moved with Task 1 so the Task 1 commit is green**
- **Found during:** Task 1 (resolveSiteUrl helper)
- **Issue:** Changing `DEFAULT_SITE_ORIGIN` made the group (c) "unset" assertion (`'"https://tranrealestate.github.io"'`) fail before Task 2's rename; the plan allowed one combined commit, but that would have left a red intermediate state and a non-atomic history.
- **Fix:** Updated only that literal to `'"https://wolfwdavid.github.io"'` in Task 1 and deferred the `resolveSiteUrl` import (unused until group (e)) to Task 2, so both commits pass `pnpm vitest run --project scripts scripts/site-url.test.ts` and eslint on their own.
- **Files modified:** scripts/site-url.test.ts
- **Verification:** scripts project 11/11 after Task 1; 90/90 (site-url + assert-extension) after Task 2
- **Committed in:** `aeadf71`, `e2e3477`

**2. [Rule 1 - Bug] Plan's by-name negative assertions contradicted its own acceptance grep**
- **Found during:** Task 2
- **Issue:** `expect('__TRAN_ORIGIN__' in define).toBe(false)` and `not.toContain('__TRAN_ORIGIN__')` put the legacy name back into the tree, failing `git grep -n "__TRAN_ORIGIN__" -- . ':!.planning'` (must print nothing).
- **Fix:** Whole-set assertions (see Decisions Made).
- **Files modified:** scripts/site-url.test.ts
- **Verification:** grep prints nothing; both tests pass and would fail if a second define key or a second `__X__` global appeared
- **Committed in:** `e2e3477`

---

**Total deviations:** 2 auto-fixed (1 Rule 3, 1 Rule 1)
**Impact on plan:** Both keep the planned behaviour and tighten the proofs; no scope change.

## Issues Encountered

- The first RED edit used a Python `\\'` escape that collapsed into a bare apostrophe inside a single-quoted JS string (parse error); fixed by switching that test title to double quotes.
- A long Bash heredoc for the Task 2 RED edit died with "unexpected EOF" (known machine issue); the edit scripts were written to the scratchpad with the Write tool and run with `python -I`.

## Verification

Targeted (this executor; full `pnpm lint` / `pnpm test:unit` belong to the orchestrator after the wave):

- `pnpm vitest run apps/web/src/lib/site-config.test.ts apps/web/src/lib/site.test.ts` - 37/37
- `pnpm vitest run --project scripts scripts/site-url.test.ts scripts/assert-extension.test.ts` - 90/90
- `pnpm vitest run --project extension` - 242/242 (17 files)
- `pnpm exec eslint` and `pnpm exec prettier --check` on all 15 changed files - clean
- `pnpm --filter extension check` (`wxt prepare && svelte-check`) - 0 errors, 0 warnings
- `node -e "import('./apps/web/src/lib/site-config.js').then(m=>console.log(m.resolveSiteUrl({PUBLIC_SITE_URL:'https://wolfwdavid.github.io',BASE_PATH:'/tran_real_estate'})))"` prints `https://wolfwdavid.github.io/tran_real_estate`; `MSYS_NO_PATHCONV=1 BASE_PATH=/tran_real_estate node -e ...resolveSiteUrl()` prints the same
- Acceptance greps: `export function resolveSiteUrl` 1; new `DEFAULT_SITE_ORIGIN` line 1; `.d.ts` mention 1; `__SITE_URL__: JSON.stringify(resolveSiteUrl())` 1; `tranrealestate` 0 in the four web files; `__TRAN_SITE_URL__: JSON.stringify(resolveSiteUrl())` 1 in each of three extension configs; `resolveSiteUrl(env)` 1 in the oracle; `(e) BASE_PATH alone` 1; `git grep __TRAN_ORIGIN__` outside `.planning` empty

**Deferred to the orchestrator's post-wave run:** `pnpm ext:test:browser` (real Chromium via `@vitest/browser-playwright`; parallel executors may not launch Playwright). The only change to that suite is the default `PRIVACY_URL` literal on one line, and the define it reads (`vitest.browser.config.ts`) is covered by the same `resolveSiteUrl()` the scripts project exercises.

## Known Stubs

None. `TRAN_ORIGIN` still has no runtime consumer (unchanged from Phase 11; kept for Phase 14 DEBT-03 wording), which is a documented carry-over, not a stub.

## Next Phase Readiness

- Plan 13-20 (fixture-only `tranrealestate.github.io` substitutions in eleven test files) can proceed; `DEFAULT_SITE_ORIGIN` and `HOST` already point at the owner origin.
- Plan 13-09's `extension-release.yml` comment still says "TRAN_ORIGIN / PRIVACY_URL" (left alone as planned).
- Phase 14 DEBT-03 can assert `PRIVACY_URL === resolveSiteUrl() + '/legal/privacy/#browser-extension'` directly.

## Self-Check: PASSED

All 15 modified source files and the SUMMARY exist on disk; commits `aeadf71` and `e2e3477` are in `git log`.
