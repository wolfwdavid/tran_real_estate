---
phase: 01-foundation-origin-security-baseline
plan: 03
subsystem: infra
tags: [sveltekit, adapter-static, csp, anti-framing, base-path, tailwind, vitest, prerender, github-pages]

# Dependency graph
requires:
  - phase: 01-foundation-origin-security-baseline
    plan: 01
    provides: pnpm workspace root, root scripts (build:root/build:sub already point at scripts/build-web.mjs), ESLint boundary rules naming the lib folders, Prettier config, pre-commit gate
  - phase: 01-foundation-origin-security-baseline
    plan: 02
    provides: root vitest.config.ts projects list, tooling/vitest/no-network.ts setupFiles kill-switch, the no-network.test.ts wiring pattern
provides:
  - apps/web SvelteKit 2.70.3 / Svelte 5.57.0 / Vite 8.3.0 package with exact pins (incl. @playwright/test 1.63.0 and @axe-core/playwright 4.13.0 for plans 05/07)
  - apps/web/src/lib/base-path.js resolveBasePath/resolveBuildDir, unit-tested (10 assertions) incl. the MSYS-mangled case
  - svelte.config.js: adapter-static (fallback 404.html, strict), env-driven paths.base, fail-fast prerender, hash-mode CSP with style-src-attr and the exact 7-host connect-src
  - CSP-safe document shell (<html lang="en" hidden>, charset then %sveltekit.head%, external static/frame-guard.js, no inline script/style)
  - Seven prerendered placeholder routes with stable <h1>/<title>/data-testid hooks, +error.svelte showing the status code
  - scripts/build-web.mjs root|sub (BASE_PATH/BUILD_DIR set from Node, drives the pinned pnpm via npm_execpath)
  - apps/web/build and apps/web/build-sub, each with 7 pages + 404.html + .nojekyll + frame-guard.js
  - web Vitest project wired into the root harness with its own no-network wiring test
affects: [01-04, 01-05, 01-06, 01-07, 01-08, 01-09, every phase that adds routes or lib code under apps/web]

# Tech tracking
tech-stack:
  added: ["@sveltejs/kit@2.70.3", "@sveltejs/adapter-static@3.0.10", "@sveltejs/vite-plugin-svelte@7.3.0", vite@8.3.0, svelte-check@4.7.6, tailwindcss@4.3.3, "@tailwindcss/vite@4.3.3", "@playwright/test@1.63.0", "@axe-core/playwright@4.13.0"]
  patterns:
    - apps/web/vite.config.ts uses plain svelte() + a $lib alias when process.env.VITEST === 'true' and tailwindcss() + sveltekit() otherwise (Kit's plugin pins Vite root to process.cwd(), which breaks the root projects harness)
    - apps/web has a prepare script (svelte-kit sync || echo '') so .svelte-kit/tsconfig.json exists on a fresh install; pnpm check also runs sync first
    - Base-path validation lives in a plain JS module imported by svelte.config.js so it is unit-testable
    - Internal links use resolve('/route/') from $app/paths with the trailing slash (svelte-check accepts it); never hard-coded root hrefs
    - Every page has exactly one <h1> and a <svelte:head><title>; the root layout supplies the skip link and <main id="main-content">
    - Build outputs are produced only through scripts/build-web.mjs, never by typing BASE_PATH in a shell

key-files:
  created:
    - apps/web/package.json
    - apps/web/tsconfig.json
    - apps/web/svelte.config.js
    - apps/web/vite.config.ts
    - apps/web/src/lib/base-path.js
    - apps/web/src/lib/base-path.test.ts
    - apps/web/src/lib/no-network.test.ts
    - apps/web/src/app.html
    - apps/web/src/app.css
    - apps/web/static/.nojekyll
    - apps/web/static/frame-guard.js
    - apps/web/src/routes/.gitkeep
    - apps/web/src/routes/+layout.ts
    - apps/web/src/routes/+layout.svelte
    - apps/web/src/routes/+error.svelte
    - apps/web/src/routes/(marketing)/+page.svelte
    - apps/web/src/routes/(app)/+layout.svelte
    - apps/web/src/routes/(app)/renter/+page.svelte
    - apps/web/src/routes/(app)/investor/+page.svelte
    - apps/web/src/routes/(app)/agent/+page.svelte
    - apps/web/src/routes/(app)/settings/+page.svelte
    - apps/web/src/routes/(print)/+layout.svelte
    - apps/web/src/routes/(print)/print/+page.svelte
    - apps/web/src/lib/{features/shared,features/renter,features/investor,features/agent,security,data/rentcast,ai/providers,leads,storage}/.gitkeep
    - scripts/build-web.mjs
  modified:
    - vitest.config.ts
    - .prettierrc
    - pnpm-lock.yaml

key-decisions:
  - "vite.config.ts swaps sveltekit() for the plain svelte() plugin plus a $lib alias under Vitest: Kit's plugin captures process.cwd() as Vite root at import time, so the root projects harness found no tests and looked for svelte.config.js in the repo root"
  - "apps/web gets the sv-create-style prepare script (svelte-kit sync || echo '') because Vite's oxc transform reads tsconfig.json, which extends .svelte-kit/tsconfig.json, and the plain Svelte plugin does not run sync"
  - "resolve('/renter/') with the trailing slash typechecks under svelte-check 4.7.6 / Kit 2.70.3, so the RESEARCH Open Question 1 fallback (resolve('/renter')) was not needed"
  - "FND-01/02/03 left unchecked, consistent with 01-01 and 01-02: this plan ships the carriers (prerendered pages, CSP meta, hidden+frame-guard); the assertion script (04), routing/framing/CSP E2E (05, 07) and phase verify (09) close them"

patterns-established:
  - "New Vitest project under apps/*: keep the Vitest branch of vite.config.ts free of the Kit plugin; use relative imports or $lib in tests"
  - "Run svelte-kit sync (or pnpm check) before pnpm test:unit on a machine where pnpm reported 'Already up to date' and skipped prepare"
  - "Placeholder copy names the product 'Tran Real Estate Tools' and never implies brokerage, appraisal or investment advice"

requirements-completed: [FND-01, FND-02, FND-03]

# Metrics
duration: 8min
completed: 2026-09-17
---

# Phase 01 Plan 03: apps/web SvelteKit Skeleton, CSP Shell & Dual-Base Builds Summary

**SvelteKit 2.70.3 static skeleton with a unit-tested `BASE_PATH` validator, hash-mode meta CSP (`style-src-attr 'unsafe-inline'`, 7-host `connect-src`), `<html hidden>` + external frame guard, seven prerendered placeholder routes, and a Node-driven `build-web.mjs` that produced both `build/` and `build-sub/` under the pinned pnpm 11.27.0**

## Performance

- **Duration:** 8 min (495 s)
- **Started:** 2026-09-17T04:13:43Z
- **Completed:** 2026-09-17T04:21:58Z
- **Tasks:** 3 (Task 1 TDD: RED commit then GREEN commit)
- **Files modified:** 36

## Accomplishments

- `corepack pnpm build:root` and `corepack pnpm build:sub` both exit 0 and print `build-web: pnpm 11.27.0 target=... BUILD_DIR=...`; `apps/web/build/` and `apps/web/build-sub/` each contain `index.html`, `renter/`, `investor/`, `agent/`, `settings/`, `print/index.html`, `404.html`, `.nojekyll` and `frame-guard.js` (plan 04's `EXPECTED_PAGES` set, confirmed)
- All 14 built HTML files carry `<html lang="en" hidden>` and a `<meta http-equiv="content-security-policy">` preceded in `<head>` only by `<meta charset="utf-8" />` (checked per file with a small Node walker, same logic plan 04's `assert-csp.mjs` uses)
- Emitted policy (root build, `index.html`): `default-src 'self'; connect-src 'self' https://api.rentcast.io https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https://openrouter.ai https://api.web3forms.com; object-src 'none'; script-src 'self' 'sha256-…'; style-src 'self'; style-src-attr 'unsafe-inline'; base-uri 'self'; form-action 'self' https://api.web3forms.com` (D1, D2, D3 implemented; no `frame-ancestors`/`report-uri`/`sandbox`; no analytics host)
- `build-sub/404.html` references absolute `/tran_real_estate/frame-guard.js` and `/tran_real_estate/_app/`; `build-sub/renter/index.html` uses relative `../frame-guard.js`; `build/index.html` contains no `/tran_real_estate/`; rendered portal links are `./renter/`, `./investor/`, `./agent/` (trailing slash, base-relative)
- `corepack pnpm test:unit` exits 0 with `5 passed (5)` files / `25 passed (25)` tests across projects `web`, `core`, `scripts`; the `web` project's `base-path` (10 assertions) and `no-network` wiring tests are green
- `corepack pnpm check` exits 0 (`svelte-check` 347 files, 0 errors, 0 warnings; core and brand `tsc --noEmit` Done); `corepack pnpm lint` exits 0 after every task
- `git status --porcelain apps/web/build apps/web/build-sub` prints nothing (both gitignored); `git remote -v` prints nothing; every commit passed the gitleaks + real-data pre-commit hook

## Task Commits

Each task was committed atomically through the installed pre-commit hook:

1. **Task 1: apps/web package, base-path validator, CSP policy and document shell**
   - RED `96930fb` (test): package pins + lockfile, tsconfig, vite.config.ts, tests, app.html, app.css, static files, routes/.gitkeep, root vitest projects, Prettier Tailwind plugin; run showed `no-network` passing and `base-path` failing with `Cannot find module './base-path.js'`
   - GREEN `828f0ab` (feat): `src/lib/base-path.js` + `svelte.config.js`; run showed `10 passed (10)`
2. **Task 2: Prerendered placeholder routes and lint-boundary folders** - `b640081` (feat)
3. **Task 3: Windows-safe dual-base build script and both prerendered builds** - `3ba15a9` (feat)

**Plan metadata:** see final docs commit below

## Files Created/Modified

- `apps/web/package.json` - Exact pins (Kit 2.70.3, Svelte 5.57.0, adapter-static 3.0.10, Vite 8.3.0, vite-plugin-svelte 7.3.0, Tailwind 4.3.3, svelte-check 4.7.6, TS ~6.0.3, Vitest 4.1.11, Playwright 1.63.0, axe 4.13.0); `prepare`, `dev`, `build`, `check` scripts
- `apps/web/tsconfig.json` - Extends `.svelte-kit/tsconfig.json`; `allowJs` + `checkJs` so the JS validator is typechecked
- `apps/web/svelte.config.js` - RESEARCH config with the validator imported from `src/lib/base-path.js`
- `apps/web/vite.config.ts` - `tailwindcss() + sveltekit()` for dev/build/check; `svelte()` + `$lib` alias under Vitest; `test` block `name: 'web'`, node env, `setupFiles: ['../../tooling/vitest/no-network.ts']`
- `apps/web/src/lib/base-path.js` - `resolveBasePath(env)` (regex `^\/[A-Za-z0-9._~-]+(\/[A-Za-z0-9._~-]+)*$`, actionable error naming `BASE_PATH` and `MSYS_NO_PATHCONV`) and `resolveBuildDir(env)`
- `apps/web/src/lib/base-path.test.ts` - 10 tests: unset/empty/valid, MSYS-mangled, no leading slash, trailing slash, `/a//b`, message contents, build dir default/override
- `apps/web/src/lib/no-network.test.ts` - Proves the `web` project's `setupFiles` kill-switch (targeted `eslint-disable-next-line no-restricted-syntax`, same as 01-02)
- `apps/web/src/app.html` - `<html lang="en" hidden>`, `<meta charset>` then `%sveltekit.head%`, external `frame-guard.js`, viewport, `<div class="app-root">`; no inline script/style, no `style=`, no nonce
- `apps/web/src/app.css` - `@import 'tailwindcss'; @theme {}` and `.app-root { display: contents }`
- `apps/web/static/frame-guard.js` - IIFE: removes `hidden` only when `window.self === window.top`, else tries `top.location` inside try/catch and stays hidden
- `apps/web/static/.nojekyll` - Empty
- `apps/web/src/routes/+layout.ts` - `prerender = true`, `trailingSlash = 'always'` (D7)
- `apps/web/src/routes/+layout.svelte` - Imports `app.css`; skip link `href="#main-content"`; `<main id="main-content">`
- `apps/web/src/routes/+error.svelte` - `<title>` and `<h1>` include `page.status` (404 for unknown paths via the fallback)
- `apps/web/src/routes/(marketing)/+page.svelte` - `<h1>Tran Real Estate Tools</h1>` + three portal links via `resolve()`
- `apps/web/src/routes/(app)/+layout.svelte` - `<nav aria-label="Portals">` linking `/`, `/renter/`, `/investor/`, `/agent/`, `/settings/` via `resolve()`
- `apps/web/src/routes/(app)/{renter,investor,agent}/+page.svelte` - One `<h1>` + `<title>` each
- `apps/web/src/routes/(app)/settings/+page.svelte` - `<h1>Settings</h1>`, `data-testid="csp-transition-toggle"` button, `data-testid="csp-transition-target"` with `transition:fade`
- `apps/web/src/routes/(print)/+layout.svelte` - Children only, no nav
- `apps/web/src/routes/(print)/print/+page.svelte` - `<h1>Print preview</h1>`
- `apps/web/src/lib/**/.gitkeep` - The nine folders `eslint.config.js` references (no `sanitize-html.svelte` created)
- `scripts/build-web.mjs` - `root|sub` targets; env injected from Node; re-invokes the launching pnpm via `npm_execpath` (fallback `corepack pnpm`); prints the driving pnpm version
- `vitest.config.ts` - `projects: ['apps/web', 'packages/core', 'scripts']`
- `.prettierrc` - `prettier-plugin-tailwindcss` last in `plugins`, `tailwindStylesheet: ./apps/web/src/app.css`
- `pnpm-lock.yaml` - 49 packages added for the `web` importer; no `ERR_PNPM_IGNORED_BUILDS`, so `allowBuilds` was untouched

## Decisions Made

- **Kit plugin only outside Vitest.** `@sveltejs/kit/src/exports/vite/index.js` reads `process.cwd()` at import and forces `root: cwd`. Under the root `vitest run --project web` harness that made Kit search the repo root for `svelte.config.js`/`src/app.html` and hid `apps/web/src/**`. Kit itself branches on `process.env.VITEST === 'true'`, so the config does the same: the Svelte compiler plugin plus a `$lib` alias is all unit tests need. Dev, build and `svelte-check` (which loads the config with `VITEST` unset) still use `tailwindcss() + sveltekit()`, verified by both builds and `pnpm check`.
- **`prepare: svelte-kit sync || echo ''`.** This is the `sv create` default. Without the Kit plugin, nothing generates `.svelte-kit/tsconfig.json`, and Vite's oxc transform fails with `TSCONFIG_ERROR` because `apps/web/tsconfig.json` extends it. The plan's package.json is otherwise verbatim.
- **`resolve('/renter/')` kept.** `svelte-check` accepted the trailing-slash pathnames (0 errors), so the plan's fallback procedure was not triggered. Rendered output confirms `./renter/`-style hrefs.
- **`catch {}` in `frame-guard.js`.** ESLint 10's `no-unused-vars` (`caughtErrors: 'all'`) would flag an unused `catch (e)`; the optional catch binding is ES2019 and behaviourally identical.
- **Requirements not marked complete.** Same reasoning as 01-01/01-02: the plan's three FND IDs need plans 04/05/07/09 to be provably closed. Listed in frontmatter as this plan's targets; `requirements mark-complete` deferred to 01-09.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Kit's Vite plugin broke the root Vitest projects harness**
- **Found during:** Task 1 (first RED run)
- **Issue:** `corepack pnpm vitest run --project web` printed `No Svelte config file found in <repo root>`, `src\app.html does not exist`, and `No test files found` because `sveltekit()` overrides Vite `root` with `process.cwd()` (repo root). RESEARCH marked the projects wiring as docs-only (MEDIUM); this is the first execution.
- **Fix:** `apps/web/vite.config.ts` selects `[svelte()]` + `resolve.alias.$lib` when `process.env.VITEST === 'true'`, otherwise `[tailwindcss(), sveltekit()]`. The `test` block is unchanged from the plan.
- **Files modified:** apps/web/vite.config.ts
- **Verification:** `--project web` finds and runs both test files; `pnpm test:unit` 25/25; `pnpm check`, `build:root`, `build:sub` all use the Kit branch and pass
- **Committed in:** 96930fb

**2. [Rule 3 - Blocking] `.svelte-kit/tsconfig.json` missing for Vite's TS transform**
- **Found during:** Task 1 (second RED run)
- **Issue:** `[TSCONFIG_ERROR] Failed to load tsconfig 'apps/web/.svelte-kit/tsconfig.json'` from `vite:oxc`; without the Kit plugin nothing runs `svelte-kit sync`.
- **Fix:** Added `"prepare": "svelte-kit sync || echo ''"` to `apps/web/package.json` (the `sv create` default) and ran `svelte-kit sync` once explicitly (pnpm reported `Already up to date` and skipped `prepare`, exactly as RESEARCH Pitfall 5 describes).
- **Files modified:** apps/web/package.json
- **Verification:** RED run then reached the intended `Cannot find module './base-path.js'` failure; GREEN 10/10
- **Committed in:** 96930fb

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking, both in the same RED commit)
**Impact on plan:** No scope change. Every file the plan enumerates exists with the specified content; the only source-level differences from the plan's verbatim snippets are the Vitest branch in `vite.config.ts`, the one-line `prepare` script, and `catch {}` in `frame-guard.js`.

## Issues Encountered

- **`svelte-kit sync` with a `.gitkeep`-only routes directory:** sync's `init` step (which writes `tsconfig.json` and `ambient.d.ts`) succeeds, but `all_types` throws `No routes found` (Kit 2.70.3 `create_manifest_data`). So the `.gitkeep` did what Task 1 needed (the transform had its tsconfig) while `pnpm check` only becomes green in Task 2 once routes exist. No action needed now; noted for anyone scaffolding a routes-less Kit package.
- **Commit-message hygiene:** the RED commit was first written with tool-attribution trailers, then amended (before any further commit, no remote) to the trailer-free form the project's CLAUDE.md requires and the 01-01/01-02 commits use. Final hash `96930fb`.
- Vite 8 prints a `[PLUGIN_TIMINGS]` advisory (Kit's `writeBundle` dominates the ~4 s build). Informational only.

## Known Stubs

- The seven routes are intentionally placeholder pages (one `<h1>`, one `<p>`, unstyled). That is this plan's deliverable per CONTEXT.md "Skeleton Scope"; Phase 2 replaces the copy and adds brand tokens. No component receives hard-coded empty data.

## User Setup Required

None - no external service configuration required. No machine-level changes were made in this plan.

## Requirements Status

| ID | This plan delivers | Still open | Closed by |
|----|-------------------|------------|-----------|
| FND-01 | Every route prerendered under `''` and `/tran_real_estate`; `404.html` fallback; `.nojekyll`; validated env base path with unit tests; `trailingSlash = 'always'` | Deep-link redirect + refresh E2E under both bases, `EXPECTED_PAGES` assertion | 01-04 (assert-csp), 01-05 (routing spec), 01-09 |
| FND-02 | CSP meta on all 14 built pages, first after `<meta charset>`, exact `connect-src`, strict `script-src`/`style-src`, `style-src-attr 'unsafe-inline'` | Independent assertion script + mutation test, runtime-violation E2E incl. the fade transition | 01-04, 01-07, 01-09 |
| FND-03 | `<html hidden>` + external `frame-guard.js` shipped on every page (`'self'`-covered, no hash upkeep) | Cross-origin/sandboxed iframe E2E | 01-05 (framing spec), 01-09 |

## Next Phase Readiness

- Plan 04 can assert against `apps/web/build` and `apps/web/build-sub` immediately; the page set matches its `EXPECTED_PAGES` literal and the policy string matches its `EXACT`/`CONNECT` literals
- Plans 05 and 07 find `@playwright/test@1.63.0` and `@axe-core/playwright@4.13.0` already in `apps/web/package.json` and the lockfile; they must not edit that file. Stable hooks: one `<h1>` and `<title>` per page, `csp-transition-toggle`/`csp-transition-target`, error `<h1>` contains the status code
- Rendered internal links are base-relative (`./renter/`) with trailing slashes, so the routing spec's "hrefs end with `/`" assertion holds under both bases
- Anyone running `pnpm test:unit` on a machine where pnpm skipped `prepare` should run `pnpm check` (or `svelte-kit sync`) first; CI's `pnpm install --frozen-lockfile` on a fresh checkout runs `prepare`
- No remote, no push, branch `main`, tree clean after the final docs commit

## Self-Check: PASSED

All 36 created/modified source files plus this SUMMARY exist on disk (`git ls-files` counts 36 tracked); commits `96930fb`, `828f0ab`, `b640081`, `3ba15a9` are present in `git log`.

---
*Phase: 01-foundation-origin-security-baseline*
*Completed: 2026-09-17*
