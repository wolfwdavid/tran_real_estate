---
phase: 16-toolchain-pnpm-12-sveltekit-3-vitest-5
plan: 05
subsystem: toolchain
tags: [sveltekit-3, kit-options, codemod, shallow-routing, tsconfig]
requires: [16-04]
provides:
  - Kit 3.1.1 and companions pinned in one lockfile commit
  - apps/web/kit.options.js (plugin-free) consumed by vite.config.ts and the tests
  - resolve() pathname form, $app/env, shallow goto() with navigation-handler guards
affects: [16-06, 16-07, 16-08, 16-09, 16-10]
tech-stack:
  added: []
  patterns:
    - Kit options in a plugin-free module passed to sveltekit(kitOptions)
    - tsconfig extends $app/tsconfig with explicit include/exclude
key-files:
  created:
    - apps/web/kit.options.js
    - apps/web/src/lib/precache-filter.ts
  modified:
    - package.json
    - apps/web/package.json
    - apps/extension/package.json
    - pnpm-lock.yaml
    - apps/web/tsconfig.json
    - apps/web/vite.config.ts
    - apps/web/src/lib/testing/app-paths.stub.ts
  deleted:
    - apps/web/svelte.config.js
requirements-completed: [TOOL-02]
duration: resumed session
completed: 2026-11-14
---

# Phase 16 Plan 05: SvelteKit 3 pins, options module, small codemod groups, shallow routing

Kit 3.1.1 and companions are pinned, Kit options moved to a plugin-free `kit.options.js` consumed by `vite.config.ts` and the tests, `svelte.config.js` is gone, and the `environment`, `paths` and `shallow-routing` codemod groups landed as their own commits. The tree is red by design until plans 06 to 08 (remaining `$lib` and `$service-worker` imports); nothing was pushed.

## Kit range

- KIT_FIRST_SHA: 65c4575 (`build(web): pin SvelteKit 3.1.1 and companions`)
- KIT_BASE_SHA: db6a2b8 (`git rev-parse HEAD^` of the first Kit commit)
- Plan 10 records the last Kit SHA for `git revert --no-commit 65c4575^..<last>`.

## Commits

| Task | Commit | Subject |
|------|--------|---------|
| 1 | 65c4575 | build(web): pin SvelteKit 3.1.1 and companions |
| 2 | 2924974 | refactor(web): move Kit options to kit.options.js and sveltekit() in vite.config |
| 3 | 6758ce9 | refactor(web): sveltekit-3 codemod environment |
| 3 | e249013 | refactor(web): sveltekit-3 codemod paths |
| 3 | 604bbdb | test(web): make the resolve() stub follow the Kit 3 pathname form |
| 4 | 4d27005 | refactor(web): sveltekit-3 codemod shallow-routing |
| 4 | b92ef95 | fix(web): keep shallow replaces from re-triggering navigation handlers |

No commit carries a trailer (checked with `git log --format='%(trailers:key=Co-Authored-By)'`).

## Task 1: pins (resumed from uncommitted edits)

The pre-existing working-tree edits were verified against the plan, not redone. Every pin matched: kit 3.1.1, adapter-static 4.0.1, svelte 5.57.3 (root, web, extension), vite-plugin-svelte 7.3.1 (web, extension), svelte-check 4.7.8 (web, extension), runed 0.38.0, eslint-plugin-svelte 3.24.1; nothing extra was touched. `npm view` at commit time: adapter-static, svelte, vite-plugin-svelte, svelte-check, runed, eslint-plugin-svelte are still latest; kit latest is now 3.2.0, and 3.1.1 was kept as the plan states.

Lockfile diff review (40 hunks, all in the project document; the boot document, the first `---` block, is untouched):

- New package names: none. `runed@0.38.0` and `cookie@2.0.2` are new versions of names already present.
- Dropped by Kit 3: `@types/cookie`, `cookie@0.6.0`, `kleur`, `set-cookie-parser`, `@sveltejs/acorn-typescript` direct dependency.
- Kit 3 newly depends on: `@rolldown/pluginutils` 1.0.1, `magic-string` 1.4.1, `cookie` 2.0.2, all already resolved elsewhere in the lockfile.
- Transitive bumps: svelte-eslint-parser 1.8.1 to 1.10.1, postcss 8.5.28 to 8.5.31.
- `pnpm install --frozen-lockfile` exits 0.

Fallback applied, as the plan allows. `svelte-kit sync` against the old `svelte.config.js` fails on Kit 3 with `config_file_unsupported`, so Task 1 was committed with the pins only; the tsconfig change, the loud `prepare` and the planted-type-error proof moved to Task 2. `git grep "|| echo" -- apps/web/package.json` is empty after Task 2.

## Task 2: kit.options.js

- Options are flat in Kit 3 (no `kit:` wrapper). `paths: { base, origin: resolveSiteOrigin() }` replaces `prerender.origin`; the `serviceWorker.files` filter is removed from the options. Typed with a JSDoc `import('@sveltejs/kit/vite').Config` type reference; this is a type-only reference, not a runtime import. The plan's `git grep "kit/vite"` acceptance would match that JSDoc type, but there is no import of Kit's plugin, which was the intent.
- `vite.config.ts` calls `sveltekit(kitOptions)` in the non-Vitest branch; the `isVitest` branch, `$lib` alias and `$app/paths` stub are unchanged.
- The dotfile filter moved to `apps/web/src/lib/precache-filter.ts` (`isPrecacheable`, regex copied character for character); the service-worker-guard block keeps the identical assertion table. Plan 08 wires the worker to it.
- site-url test now asserts the `paths` fragment, that `origin:` does not appear under `prerender`, and carries an in-test non-vacuity case that moves the origin back and requires the assertion to fail. csp-policy.test.ts and models.test.ts import `kit.options.js` and assert its `csp` equals `buildCsp({ analyticsHost })`; the verbatim Phase 10 literal comparison is untouched.
- tsconfig: `extends: "$app/tsconfig"`. The generated config sets `allowJs` and `checkJs`, so JS type checking is preserved. Kit 3's generated tsconfig carries no `include`/`exclude`, so the repo file now declares them, copied from the old generated lists (service worker excluded as before). Planted proof: appending `/** @type {number} */ export const X = "s"` to build-stamp.js made svelte-check report `build-stamp.js 23:14 Type 'string' is not assignable to type 'number'`; the plant was reverted.
- Gate: `vitest run` on csp-policy, models, site-url, service-worker-guard and assert-csp tests: 5 files, 152 tests pass. `prettier --check` clean and `eslint` 0 problems on touched files.
- `svelte-kit sync` now exits clean; svelte-check reports 1600 errors, the expected red from remaining `$lib` and `$service-worker` usage.

## Task 3: codemod groups

Census (apps/web/src): `$app/environment` 2 files; `$app/stores` 0; `$app/state` 18 files; `resolve(` 283 calls in 116 files; `goto(` 5 files; `redirect(` 0.

| Task id | Result | Footprint |
|---------|--------|-----------|
| environment | committed 6758ce9 | 2 svelte files, plus the tsconfig prerequisite residue: compilerOptions keys that `$app/tsconfig` already sets were dropped (allowJs, checkJs, esModuleInterop, forceConsistentCasingInFileNames, resolveJsonModule, skipLibCheck, moduleResolution). 3 files, 3 insertions, 10 deletions |
| paths | committed e249013 | 74 files, 157 insertions, 161 deletions |
| app-state | empty diff, not committed | 0 `$app/stores` uses |
| imports | empty diff, not committed | |
| external-redirects | empty diff, not committed | 0 `redirect(` uses |
| params | empty diff, not committed | no matchers |
| shallow-routing | committed 4d27005 | 11 files, 35 insertions, 17 deletions |

package.json prerequisite: no diff from the codemod (Task 1 applied it by hand).

## Deviations from plan

**1. [Rule 1/3 - codemod output unusable raw] paths and shallow-routing applied as the codemod's rewrite rule, not its file output**
- **Found during:** Task 3 and Task 4
- **Issue:** the sv printer re-prints every file it touches, not only the changed expressions: it moved doc comments out of `$props()` type literals (GenerationPanel, ContactsView, StageBoard), expanded one-line objects, rewrote `{x}` shorthands and `<path />` elements, and in one case turned a block `DataShell` child list inline (whitespace-semantic change). Running its `format` step did not undo this. Committing it would have violated "only that task's output" and risked behaviour changes.
- **Fix:** ran each codemod to learn the exact rewrite, then re-applied only that rewrite to a clean tree. For `paths`: `resolve('/x/')` becomes `resolve('x/')` and `resolve('/')` becomes `resolve('')` for static single-quoted arguments in files importing `$app/paths` (150 of the codemod's 151 resolve edits were reproduced exactly; I verified the multiset of changed resolve calls and the file set match). For `shallow-routing`: `replaceState(u, s)` becomes `goto(u, { shallow: true, replace: true, state: s })` (the compare page passed `{}`, so no `state`), and every `afterNavigate` handler (PortalSwitcher, GetStartedGuide, (app)/+layout, agent/+layout, agent contact page, root +layout) gets `if (shallow && type === 'goto') return;`. The codemod's format step was never allowed to run broadly (stubbed with a no-op `format` script in apps/web/package.json during runs, then restored with `git checkout`; the file is clean in all commits except the Task 2 `prepare` edit).
- **Difference from codemod:** my rule also rewrote `resolve('/')` in `routes/+error.svelte` and `components/forms/FeedbackForm.svelte`, which the codemod skipped (plus one `settings/` and one `feedback/` call it missed); 74 files changed in total, 2 of which the codemod did not touch. Three files needed `prettier --write` after the rewrite because shorter lines collapse (GeminiDataDialog, CrmEmptyState, TaskRow); each was formatted at HEAD before.
- **Commits:** e249013, 4d27005

**2. [Rule 3 - blocking] tsconfig needs explicit include/exclude**
- `svelte-kit sync` failed (`tsconfig_invalid`, "src/service-worker should be added to the exclude array") once tsconfig extended `$app/tsconfig`, since Kit 3's generated config has no include/exclude. Added them, mirroring the old generated lists. Commit 2924974.

**3. [Rule 1 - test ripple] resolve() stub follows the Kit 3 pathname form**
- After the `paths` codemod six unit tests failed because the Vitest `$app/paths` stub returned its argument unchanged (`'renter/'` instead of `'/renter/'`). Plan 06 rewrites the stub; I made the one-line change now so the targeted gate is meaningful. Commit 604bbdb.

**4. [Hand review, Task 4]**
- The six shallow `goto` calls are `void goto(...)` (old `replaceState` was synchronous and nothing awaits the URL mirror). Two now-unused `eslint-disable` directives were removed (layout, compare page). No `page.url` mutation exists in the repo, so the plan's `new URL(page.url)` fix at SearchPage:58 and layout:72 was not needed (those lines only read `page.url.searchParams`). Commit b92ef95.

**5. [Rule 3 - not auto-fixed, plan 06]** `PortalSubNav` (and `nav.ts` items) pass absolute pathnames (`'/investor/analyze/'`) through `resolve(item.href)`. With the Kit 3 stub this yields `//investor/...`, so `features/shared/nav/nav.test.ts` "hrefs through resolve()" fails. This is one of the "old form" call sites the plan assigns to plan 06 (dynamic arguments the codemod does not rewrite); left red on purpose.

## Navigation handler review (Task 4)

`git grep -nE "afterNavigate|beforeNavigate|onNavigate" -- apps/web/src` finds `afterNavigate` in six components and no `beforeNavigate`/`onNavigate`. All six carry the `shallow`/`type === 'goto'` guard:

| File | Guard |
|------|-------|
| apps/web/src/lib/components/layout/PortalSwitcher.svelte | yes |
| apps/web/src/lib/components/onboarding/GetStartedGuide.svelte | yes |
| apps/web/src/routes/+layout.svelte (analytics pageview) | yes |
| apps/web/src/routes/(app)/+layout.svelte | yes |
| apps/web/src/routes/(app)/agent/+layout.svelte | yes |
| apps/web/src/routes/(app)/agent/contact/+page.svelte | yes |

`git grep replaceState -- apps/web/src` returns only a comment in ContactsView, a docstring in list-state.ts and the affordability test's forbidden-token list.

## Verification

- `pnpm install --frozen-lockfile`: exit 0.
- Targeted vitest (csp-policy, models, site-url, service-worker-guard, assert-csp): 152 passed.
- `vitest run --project web` (whole web project, after the stub fix): 2660 passed, 1 failed (nav.test.ts, plan 06, deviation 5).
- Task 4 gate `vitest run --project web` on agent, renter/search, investor/analyzer: 27 files, 427 tests pass.
- prettier and eslint on all touched files: clean.
- `pnpm check`, `pnpm lint` and builds: not run as gates; svelte-check shows 1600 errors from remaining `$lib` usage as expected.
- `git ls-files | grep MIGRATION_TASKS`: empty. `git status --short` shows only the two non-plan files (.planning/STATE.md, .planning/config.json).

## E2E specs to run in plan 08 (no build possible before then)

apps/web/tests/e2e/: `sample-handoff.spec.ts` (layout shallow `?source` strip and handler guard), `renter-search.spec.ts` (search URL mirroring), `renter-saved.spec.ts` (saved list state), `agent-contacts.spec.ts` and `agent-pipeline.spec.ts` (list state), `agent-contact.spec.ts` (contact `?id=` afterNavigate), the investor analyzer and compare specs (`?id=`, `?ids=`), plus a prerender/`csp:assert` run for the `paths.origin` move.

## Known follow-ups left red

- `PortalSubNav` absolute-pathname `resolve()` (plan 06, nav.test.ts).
- `$lib` alias, `$service-worker`, the worker rewrite and the 60 KB budget: plans 06 to 09.
- vite.config.ts imports `../../tooling/vitest/lanes` without a file extension; Vite warns that this breaks under a future native config loader. Pre-existing, not changed here.

## Self-Check: PASSED

Commits 65c4575, 2924974, 6758ce9, e249013, 604bbdb, 4d27005, b92ef95 exist; kit.options.js, precache-filter.ts exist; svelte.config.js absent.
