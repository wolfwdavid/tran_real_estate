---
phase: 16-toolchain-pnpm-12-sveltekit-3-vitest-5
plan: 06
subsystem: toolchain
tags: [sveltekit-3, lib-alias, subpath-imports, paths-stub, codemod]
requires: [16-05]
provides:
  - "#lib/* subpath imports (apps/web/package.json imports) replacing the $lib alias in application code"
  - svelte-check clean (0 errors) on Kit 3.1.1
  - app-paths.stub.ts mirroring Kit 3 resolve()/asset()
affects: [16-07, 16-08, 16-09, 16-10]
tech-stack:
  added: []
  patterns:
    - "#lib/* resolved natively through package.json imports, explicit file extensions"
    - "root link = resolve('/(marketing)') (route ID); other links = pathname without leading slash"
key-files:
  created:
    - apps/web/src/lib/testing/app-paths.stub.test.ts
  modified:
    - apps/web/package.json
    - apps/web/kit.options.js
    - apps/web/src/lib/testing/app-paths.stub.ts
    - apps/web/src/lib/features/shared/nav/PortalSubNav.svelte
requirements-completed: []
duration: resumed session
completed: 2026-11-14
---

# Phase 16 Plan 06: lib-alias codemod, hand fixes, Kit 3 paths stub

`$lib` is gone from application code: the sv@1.3.0 `lib-alias` codemod ran as one isolated commit, a second commit closed what it left open, and the test stub now follows Kit 3. `svelte-check` reports 0 errors. Nothing was pushed; the tree stays red by design until 16-10 (plan 07 and 08 files below). TOOL-02 spans plans 05 to 10 and stays Pending.

## Commits

| Task | Commit | Subject |
|------|--------|---------|
| 1 | de9b4a4 | refactor(web): sveltekit-3 codemod lib-alias |
| 2 | f953fa4 | fix(web): complete the #lib migration the codemod left open |
| 3 | 1231f5b | test(web): mirror Kit 3 resolve and asset in the paths stub |

No commit carries a trailer.

## Task 1: codemod, committed untouched

- Census before: 436 files with `$lib`, 1,184 occurrences (`git grep -c`, summed).
- The codemod refuses a dirty tree (`.planning/config.json` is dirty and not part of the plan). I copied it aside, `git checkout`-ed it, ran the codemod, then copied it back. The file was never staged.
- Command: `npx sv@1.3.0 migrate sveltekit-3 --cwd apps/web --tasks lib-alias --no-install --confirm`. The CLI listed package-json, tsconfig and lib-alias as the steps; only lib-alias changed anything (package-json and tsconfig were already done in 16-05). Its closing `format` step ran.
- Unlike 16-05's `paths` and `shallow-routing` groups, the raw output was clean, so it was committed as is. Proof (checked on the working-tree diff before commit): across 425 changed files, 1,136 removed lines all contain `$lib`, 1,136 added lines contain `#lib`, zero removed lines are anything else; the 55 added lines without `#lib` are multi-line import lists that prettier re-wrapped after the longer specifier (named imports only); every one of the 424 src files has at least one `$lib` removal. No file outside apps/web/src plus apps/web/package.json changed, no MIGRATION_TASKS.md was left (`git ls-files | grep MIGRATION_TASKS` empty).
- package.json gained `"imports": { "#lib": "./src/lib/index.js", "#lib/*": "./src/lib/*" }`. The bare `#lib` target is whatever the codemod wrote; no `src/lib/index.js` exists and nothing imports bare `#lib`.
- Commit stat: 424 files, 1,195 insertions, 1,136 deletions.
- Specifiers carry explicit extensions (`.ts`, `.svelte.ts`, `.svelte`, `.js` where the source file is `.ts`, e.g. `#lib/components/ui/button/index.js`; TS and Vite map `.js` to `.ts` for TS importers). A script outside the repo (scratchpad) resolved all 1,138 `#lib` specifier strings against src/lib: 11 do not resolve, all of them strings, not imports (comments, plan-07 test needles, import-graph prefix checks).
- Remaining `$lib` worklist after the codemod (27 lines): 2 dynamic imports; ~16 comments/docstrings; the plan-07 boundary strings (no-auto-send.test.ts:161-163, key-card-additions.test.ts:149-151, investor-port.test.ts:299-310, analyzer-page.svelte.test.ts:68, boundaries.test.ts:121-137, boot.test.ts:11 and renter-data.test.ts:174 are titles only).
- Item (f): the four announcer `vi.mock` calls were already rewritten by the codemod, to `#lib/components/a11y/announcer.svelte.ts`, the exact spelling every component imports. `git grep -nF "vi.mock('$lib"` is empty. Bite proof below.

## Task 2: hand fixes

svelte-check census right after the codemod (`--output machine`): 25 errors in 12 files.

| Group | Fix |
|-------|-----|
| (a) 2 dynamic imports | `settings/+page.svelte:61`, `setup/rentcast/+page.svelte:90`: `import('#lib/storage/secrets/index.ts')` and `import('#lib/storage/db.ts')` (secrets is a directory module) |
| (b) directory modules | none beyond (a); the resolve script finds no `#lib` import that targets a directory |
| (c) type queries | AppNotice.svelte (4) and BackupSection.svelte (6): `backup`, `meta`, `persistence`, `live.svelte` got `.ts`/`.svelte.ts` |
| (d) resolve() | see deviation 1 |
| (e) other `$lib` code strings | none; the rest are comments or plan-07 boundary strings |

Further Kit 3 type errors that were not in the plan's list and had to be fixed for a clean check (all Rule 1/3):

- `ReadonlyURLSearchParams`: `SearchPage.svelte:58` and `(app)/+layout.svelte:71` pass `new URL(page.url.href)` to functions that take a mutable `URL`/`URLSearchParams` (16-05 had judged this unnecessary; Kit 3's types say otherwise).
- `AppNotice.svelte` imported `base` from `$app/paths`, which no longer exists. `isSettingsPath(page.url.pathname, base)` now gets `resolve('/(marketing)').slice(0, -1)`, the same base string.
- `kit.options.js`: `base` cast to `'' | `/${string}``, `csp` cast to the Kit `Config['csp']` type (Kit 3's `Config` rejects `string[]` for `default-src`).
- `PortalSubNav.svelte` (16-05 deviation 5): items carry rooted pathnames (`'/investor/analyze/'`); in Kit 3 a leading slash means a route ID, so `resolve(item.href)` was wrong at runtime as well as in the stub. `hrefOf` strips the leading slash. `features/shared/nav/nav.test.ts` is green (33 tests).

Final census: `svelte-check --tsconfig ./tsconfig.json`: COMPLETED 3217 FILES, 0 ERRORS, 0 WARNINGS. The service worker is excluded from this tsconfig, so no error is reported for `src/service-worker.ts`; plan 08 still owns its `$service-worker` import. Prettier clean on all touched files.

Acceptance greps: `git grep -n "import('\$lib"` returns 0 lines; no type query is extensionless; no `resolve('/x...')` call remains in code (only comments mentioning `resolve('/settings/')` in prose); `git grep -nF "vi.mock('$lib"` is empty. Route-ID forms with a group in code: `resolve('/(marketing)')` x6 (FeedbackForm, PortalSwitcher, Breadcrumb, AppNotice, GettingStartedSection, +error.svelte).

## Task 3: stub and test projects

- `app-paths.stub.ts` now exports `resolve` and `asset` only (`base`/`assets` removed; `git grep` found no importer, only three comments mention them). `app-paths.stub.test.ts` holds the table: 9 tests pass. The `$lib` alias in vite.config.ts and vitest.browser.config.ts is untouched.
- Unit projects (`--project web --project web-serial`): 184 files, 2,705 tests, 5 failed, all in plan-07-owned files (below).
- Browser projects (`--project web-browser --project web-browser-serial`): the first run lost its browser session and a second run lost one suite to `Failed to fetch dynamically imported module`; both coincide with WLAN event 8003 inside the run window (18:44:48; 19:02:14). After a wait, `DueSearchesDialog.browser.test.ts` alone passed (9 tests). Net: 34 files, 262 tests, all pass. The `lib/…` imports were not the cause.
- Announcer `vi.mock` bite proof: typo in `GatewayError.browser.test.ts` (`announcerX`), run in `web-browser-serial`: 40 of 40 tests fail. Reverted; the file is clean.

### Failures owned by plan 07

- `ai/ui/key-card-additions.test.ts` "AI cards render the Model field and TestConnectionResult": regex over source still expects `from '$lib/ai/ui/AiModelField.svelte'`.
- `features/studio/boundaries.test.ts` (4): "features/studio never reaches …", "the snapshot print route never reaches lib/data", and the two planted controls; they match `$lib/...` prefixes.
- Pass vacuously and need plan 07 rewrites: `features/shared/affordability/affordability.test.ts` (needles `$lib/storage`, `$lib/data`, `$lib/ai` at ~225-227), `ai/no-auto-send.test.ts` (`startsWith('$lib/')`, line 163), `features/investor/data/investor-port.test.ts` (regex at 310), `features/investor/analyzer/analyzer-page.svelte.test.ts` (68). ESLint groups and scripts/eslint-rules.test.ts were not run here.

## Deviations from plan

**1. [Rule 1] Root links use the route ID, not `resolve('')`.** 16-05 (following the plan's note) had rewritten `resolve('/')` to `resolve('')` in 5 files. Kit 3's generated types reject `''` (the root pathname is not callable through the pathname overload; a leading slash is a route ID). The home link is `resolve('/(marketing)')`, the layout group of the root page; the real Kit `resolve` strips groups at runtime.

**2. [Rule 1] Stub strips route-ID groups.** The plan's table says `resolve('/(app)/renter')` is unchanged. Kit 3.1.1's own `resolve` (`resolve_route`) removes `(group)` segments, so the stub does the same (`'/(app)/renter'` becomes `'/renter'`, `'/(marketing)'` becomes `'/'`). Unchanged would make browser href assertions disagree with real Kit.

**3. [Rule 3] Extra Kit 3 type fixes** listed under Task 2 (readonly URL, `base` import, kit.options.js casts, PortalSubNav). PortalSubNav closes 16-05 deviation 5.

**4. [Rule 3] Clean-tree requirement.** `.planning/config.json` was moved aside for the codemod run and restored; it remains an uncommitted, unstaged trailing-newline diff.

No auth gates, no installs (`pnpm-lock.yaml` and root `package.json` untouched).

## Known stubs

None.

## Left red beyond this plan

- Plan 07: the boundary-string tests above, ESLint config and scripts/eslint-rules tests, removal of the `$lib` alias.
- Plan 08: `src/service-worker.ts` (`$service-worker`), the worker rewrite.
- vite.config.ts and the other configs still warn about `../../tooling/vitest/lanes` without an extension (pre-existing).
- `pnpm lint`, `pnpm build` and E2E were not run (not gated by this plan).

## Self-Check: PASSED

Commits de9b4a4, f953fa4, 1231f5b exist; app-paths.stub.test.ts exists; package.json `imports` has `#lib/*`.
