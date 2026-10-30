---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 10
subsystem: infra
tags: [rehearsal, base-path, github-pages, playwright, smoke, extension-oracle, verify]

# Dependency graph
requires:
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-02 resolveSiteUrl() shared by the web define, the extension define and the oracle allowlist
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-06 targetEnv('root').BASE_PATH knob through build-web, serve-pages, the Playwright root project and smoke
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-07 privacy-shared-origin.spec.ts (first live run here)
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: 13-09 ci.yml root leg reads BASE_PATH (the env shape mirrored here)
provides:
  - Local proof that the go-live configuration (PUBLIC_SITE_URL + BASE_PATH=/tran_real_estate, root target) passes build, CSP/SEO/budget oracles, the full root E2E project, smoke:local --target root and the extension build + oracle
  - Local proof that the default configuration passes every gate of pnpm verify, including smoke:local --target sub (the production twin)
  - Root-cause fix for a red `pnpm ext:assert` on main since 13-02 (commit f4479c4), which CI's root leg would have hit on the first push
  - The 37-commit push bundle for plan 13-11 (listed below)
affects: [13-11 push and PR triage, 13-13 go-live, 13-18 LAUNCH-AUDIT regeneration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The extension site URL is read exactly once in src/lib/site.ts, inside the privacy path, so the bundler folds it into one `${siteUrl}/legal/privacy/#browser-extension` literal; the oracle's trailing-slash allowlist then verifies the exact navigation target"
    - "Playwright shards are planned with `--list`: when a shard nears 5 minutes the remainder is re-cut at double N and the two partitions are diffed for identical coverage before running; an empty shard exits 0 silently and is confirmed by `--list` rather than re-run"

key-files:
  created: []
  modified:
    - apps/extension/src/lib/site.ts
    - scripts/site-url.test.ts

key-decisions:
  - "13-10: TRAN_ORIGIN removed from the extension's site.ts (no consumer; its new URL() call kept a bare site-URL literal in the popup chunk that the oracle rejects by D-04 design); the oracle stays strict rather than allowlisting the bare URL"
  - "13-10: the plan's `tranrealestate` sweep leaves four lines, all negative assertions (`not.toMatch(/tranrealestate/)`, `RETIRED_HOST`) in test files that keep the name out; they are guards, not usages, and were left in place"
  - "13-10: LIVE-03 left unchecked on purpose; the local rehearsal is not the live deploy (13-13 closes it)"

patterns-established:
  - "A verify step that a parallel executor defers because of the build/Playwright lock (here `pnpm ext:assert` on the real bundle) must be run as that exact step after the wave; unit tests of an oracle do not stand in for the oracle on the real artifact"

requirements-completed: []

# Metrics
duration: 78min
completed: 2026-10-30
---

# Phase 13 Plan 10: Local rehearsal of the go-live and default configurations Summary

**Both rehearsals are green at `f4479c4`: the go-live configuration (`PUBLIC_SITE_URL=https://wolfwdavid.github.io BASE_PATH=/tran_real_estate`, root target) built with `target=root BASE_PATH=/tran_real_estate`, passed the CSP/SEO/budget oracles, 1153/1153 root E2E tests (privacy-shared-origin paragraph visible under the base), `smoke:local --target root` (121) and the extension build + oracle; the default configuration passed all eleven static gates, three builds, three oracles, 2339/2339 E2E (4 design skips, 0 failed, 0 flaky), `smoke:local --target sub` and `smoke:local` (121 x 3), and the four extension commands. One real red surfaced and was fixed at the root: `pnpm ext:assert` had been failing on main in every environment since 13-02, because an unused `TRAN_ORIGIN` export kept a bare site-URL literal in the popup chunk.**

## Performance

- **Duration:** 78 min
- **Started:** 2026-10-30T13:42:36Z
- **Completed:** 2026-10-30T15:00:45Z
- **Tasks:** 3
- **Files modified:** 2 (one fix commit)

Clock check (`node -e "let n=0;const t=setInterval(()=>{if(++n>1500)clearInterval(t)},1)"`) exited 0 before the first gate. Every tool call stayed under 7 minutes (longest: 259 s, root E2E shard 2/4).

## Task 1: Static gates (all exit 0)

| Command | Exit | Wall | Result |
| --- | --- | --- | --- |
| `corepack pnpm audit:deps` (first) | 0 | 2 s | 4 ignored low (the reviewed exceptions), no new advisories |
| `pnpm check` | 0 | 18 s | extension 1077 files, web 3256 files, 0 errors 0 warnings |
| `pnpm lint` | 0 | 85 s | prettier + eslint clean |
| `pnpm banned` | 0 | 0 s | 446 files |
| `pnpm ui:guard` | 0 | 0 s | 79 files |
| `pnpm test:unit` | 0 | 76 s | 353 files / 6939 tests |
| `pnpm lint:workflows` | 0 | 1 s | actionlint clean |
| `pnpm guard` | 0 | 1 s | 1956 files |
| `pnpm fixtures:check` | 0 | 1 s | 6 fixture files match |
| `pnpm secrets:canary` | 0 | 1 s | canary detected |
| `pnpm secrets:scan` | 0 | 2 s | 1291 commits, no leaks |
| `node scripts/commit-hygiene.mjs --history` | 0 | 0 s | 1292 commits, 0 attributed |

- `git log --format='%h %(trailers:key=Co-Authored-By,valueonly)' origin/main..HEAD`: no trailer values.
- `git status --short`: empty (`.planning/config.json` untouched).
- Repo-wide sweep `git grep -n "tranrealestate" -- . ':!.planning' ':!docs/LAUNCH-AUDIT.md' ':!docs/audit/' ':!scripts/workflow-gate.test.ts'` prints four lines, every one a negative assertion that keeps the retired name out: `scripts/deploy-checklist.test.ts:113` and `scripts/runbook.test.ts:81` (`expect(DOC).not.toMatch(/tranrealestate/)`), `scripts/extension-docs.test.ts:33` (`const RETIRED_HOST = /tranrealestate/`), `scripts/live-smoke-gate.test.ts:197` (`not.toMatch(/tranrealestate|wolfwdavid/i)`). No usage of the retired origin remains; the guards were left as they are (acceptance-grep note, not a deviation).
- Observation (no action): `pnpm test:unit` prints a happy-dom `appendChild` stack trace from `apps/extension/tests/reconcile.test.ts:167` while all tests pass; it is console output from a passing test, pre-existing, and out of this plan's scope.

## Task 2: Go-live rehearsal on the root target

Env for every call: `MSYS_NO_PATHCONV=1 PUBLIC_SITE_URL=https://wolfwdavid.github.io BASE_PATH=/tran_real_estate`.

| Step | Exit | Wall | Result |
| --- | --- | --- | --- |
| 1. `pnpm build:root` | 0 | 17 s | log `build-web: pnpm 11.27.0 target=root BASE_PATH=/tran_real_estate BUILD_DIR=build BUILD_SHA=0d59846...` |
| 2. `assert-csp ... --target root` | 0 | 0 s | 45 pages |
| 2. `assert-seo ... --target root` | 0 | 0 s | 44 pages, 14 sitemap URLs, 6 share cards |
| 2. `assert-budget apps/web/build --require-tools` | 0 | 1 s | 5 gated routes within 60 KB |
| 3. canonical grep | - | - | `href="https://wolfwdavid.github.io/tran_real_estate/"`; `_app` ref count 28; `_app/version.json` = HEAD |
| 4. root E2E shard 1/4 | 0 | 200 s | 290 passed |
| 4. root E2E shard 2/4 | 0 | 259 s | 465 passed (one large serial group; 4.3 min, so the remainder was re-cut) |
| 4. `--list` 3/4+4/4 vs 5/8..8/8 | - | - | identical 398 tests (2 privacy-shared-origin) |
| 4. root E2E shard 5/8 | 0 | 4 s | 0 tests (empty shard, confirmed by `--list`; Playwright exits 0 silently) |
| 4. root E2E shard 6/8 | 0 | 40 s | 112 passed, incl. `privacy-shared-origin.spec.ts` x2 (sub-path branch: paragraph visible, host named) |
| 4. root E2E shard 7/8 | 0 | 97 s | 143 passed |
| 4. root E2E shard 8/8 | 0 | 121 s | 143 passed |
| 5. `pnpm smoke:local --target root` | 0 | 21 s | emulator `http://127.0.0.1:4273/tran_real_estate -> apps/web/build`; 121 passed; stamp = HEAD |
| 6. `pnpm ext:build` | 0 | 3 s | |
| 6. `pnpm ext:assert` | **1** | 1 s | `chunks/popup-DKqL6RRg.js: URL not on allowlist: https://wolfwdavid.github.io/tran_real_estate` |
| 6. privacy URL grep | - | - | no file (the URL was assembled at runtime from a bare literal) |
| fix committed `f4479c4` (see Deviations) | | | |
| 6. `pnpm ext:build` (re-run) | 0 | 3 s | popup chunk now carries `https://wolfwdavid.github.io/tran_real_estate/legal/privacy/#browser-extension` as one literal |
| 6. `pnpm ext:assert` (re-run) | 0 | 1 s | 6 files scanned, zip root verified |
| 6. privacy URL grep (re-run) | - | - | `apps/extension/.output/chrome-mv3/chunks/popup-CsN9OWXh.js` |
| 5. `pnpm smoke:local --target root` (re-run) | 2 | 1 s | fail-closed on purpose: stamp `0d59846` vs HEAD `f4479c4` |
| 1. `pnpm build:root` (HEAD f4479c4) | 0 | 18 s | `target=root BASE_PATH=/tran_real_estate ... BUILD_SHA=f4479c4...` |
| 5. `pnpm smoke:local --target root` (re-run) | 0 | 23 s | 121 passed |

Root E2E total: 290 + 465 + 0 + 112 + 143 + 143 = **1153 passed, 0 failed, 0 flaky**. The fix touched only `apps/extension/src/lib/site.ts` and `scripts/site-url.test.ts`; `apps/web` is byte-identical between `0d59846` and `f4479c4` apart from the version stamp, so the root shards were not re-run on the go-live build (Task 3 re-covers the root project at `f4479c4`, 1153/1153).

## Task 3: Default configuration through the full verify gate set

No `PUBLIC_SITE_URL` / `BASE_PATH` in the env (`env -u`).

| Step | Exit | Wall | Result |
| --- | --- | --- | --- |
| `pnpm ext:build` / `pnpm ext:assert` | 0 / 0 | 3 s / 1 s | literal `https://wolfwdavid.github.io/legal/privacy/#browser-extension`; `sponsored-listing-filter-0.1.0-chrome.zip` |
| `pnpm build:root` | 0 | 18 s | `target=root BASE_PATH='' BUILD_SHA=f4479c4...` |
| `pnpm build:sub` | 0 | 20 s | `target=sub BASE_PATH=/tran_real_estate BUILD_DIR=build-sub` |
| `pnpm build:configured` | 0 | 19 s | `target=configured BASE_PATH='' BUILD_DIR=build-configured` |
| `pnpm csp:assert` | 0 | 1 s | 45 + 45 + 45 pages (configured analytics host 127.0.0.1:4275) |
| `pnpm seo:assert` | 0 | 1 s | 44 pages / 14 sitemap / 6 cards, x3 |
| `pnpm budget:assert` | 0 | 1 s | 5 gated routes within 60 KB, root and configured |
| `--list` whole suite | - | - | 2343 tests; N=10 shards of 198-265 |
| E2E shard 1/10 | 0 | 224 s | 241 passed |
| E2E shard 2/10 | 0 | 209 s | 249 passed |
| E2E shard 3/10 | 0 | 164 s | 265 passed |
| E2E shard 4/10 | 0 | 130 s | 198 passed, incl. `[root] privacy-shared-origin` x2 (origin root: paragraph absent) |
| E2E shard 5/10 | 0 | 257 s | 245 passed (4.3 min, so the remainder was re-cut at N=20) |
| `--list` 6/10..10/10 vs 11/20..20/20 | - | - | identical 1145 tests (2 privacy-shared-origin) |
| E2E shard 11/20 | 0 | 142 s | 126 passed |
| E2E shard 12/20 | 0 | 110 s | 88 passed |
| E2E shard 13/20 | 0 | 123 s | 145 passed |
| E2E shard 14/20 | 0 | 88 s | 86 passed |
| E2E shard 15/20 | 0 | 141 s | 265 passed (one indivisible group) |
| E2E shard 16/20 | 0 | 5 s | 0 tests (empty shard, confirmed by `--list`) |
| E2E shard 17/20 | 0 | 47 s | 81 passed, 4 skipped; incl. `[sub] privacy-shared-origin` x2 (paragraph visible) |
| E2E shard 18/20 | 0 | 115 s | 124 passed |
| E2E shard 19/20 | 0 | 162 s | 118 passed |
| E2E shard 20/20 | 0 | 85 s | 108 passed |
| `pnpm smoke:local --target sub` (production twin) | 0 | 26 s | `http://127.0.0.1:4274/tran_real_estate -> apps/web/build-sub`; 121 passed |
| `pnpm smoke:local` | 0 | 83 s | root 121, sub 121, configured 121; attacker page + beacon collector on 4275 |
| `pnpm ext:test:browser` | 0 | 5 s | 13 passed |
| `pnpm ext:e2e` | 0 | 5 s | 7 passed |
| `pnpm test:unit` (re-run at HEAD f4479c4) | 0 | 101 s | 353 files / 6939 tests |
| `node scripts/commit-hygiene.mjs --history` (re-run) | 0 | 0 s | 1293 commits, 0 attributed |

E2E totals (default env): **2339 passed, 4 skipped, 0 failed, 0 flaky**; by project root 1153, sub 1145, configured 41 (2343 = the `--list` total). The 4 skips are `perf.spec.ts` "landing CLS budget" on `[sub]`, by design: `test.skip(test.info().project.name !== 'root', 'measured once, on the root build')` (line 36); the same tests ran and passed on `[root]`. `privacy-shared-origin.spec.ts` ran on `root` (absent) and `sub` (visible); the `configured` project excludes it by `testMatch` (13-07).

`git status --short` is empty.

## Task Commits

| Task | Commit | Files |
| --- | --- | --- |
| 2 (fix found at step 6) | `f4479c4` fix(extension): drop the unused TRAN_ORIGIN so the privacy URL folds into one literal | `apps/extension/src/lib/site.ts`, `scripts/site-url.test.ts` |

`git log -1 --format=%B | grep -ciE "co-authored-by|claude|anthropic"` printed 0. Pre-commit hooks (gitleaks staged, real-data guard, commit-msg hygiene) passed; `--no-verify` was not used.

## Push bundle (`git log --oneline origin/main..HEAD`, 37 commits, for plan 13-11)

```
f4479c4 fix(extension): drop the unused TRAN_ORIGIN so the privacy URL folds into one literal
0d59846 docs(13-08): complete owner runbook and proof-shot script plan
7131fd2 test(smoke): proof-shot script for the launch-proof bundle
573afda docs(13-09): complete CI BASE_PATH wiring plan
4059de2 docs: owner runbook for redeploy, rollback, smoke results and local suites
290d558 ci(extension): release zip and oracle read BASE_PATH
8c27d0e ci: the root deploy leg builds and tests with the BASE_PATH variable
4f61266 docs(13-07): complete Dependabot toolchain-major ignores and shared-origin privacy copy plan
c99172c fix(privacy): deletion copy points to Forget all keys and names the shared storage origin
bd9a9c0 docs(13-06): complete root BASE_PATH knob plan
dc5bec0 fix(audit): launch-audit header names the deploy build's real base URL
bd9238e test(e2e): emulator, root project and local smoke follow the root base path
b1258d6 ci(dependabot): ignore toolchain majors until Phase 16
2bb1444 build: the root deploy target honours BASE_PATH
c8e9fc4 docs(13-01): complete planning-docs reconciliation plan
5fa624d docs(13): record owner decisions on origin rule, dependabot and privacy copy
7aee557 docs(13-02): complete resolveSiteUrl and extension site URL plan
a290e6c docs(13-05): complete human-UAT ledger consolidation plan
e2e3477 feat(extension): privacy URL and oracle allowlist follow the site origin plus base path
b1a8150 docs(13-04): complete deploy checklist and extension docs plan
ecce27a docs(uat): one human-UAT ledger for all phases with a no-row-dropped test
ec6f9e5 docs(uat): per-phase UAT files point to the consolidated ledger
d52c930 docs(13-03): complete live-smoke workflow plan
4131f6c docs(13-20): complete fixture-only origin substitution plan
4e268ee docs(extension): privacy URL points at the project site
aeadf71 feat(site): resolveSiteUrl joins the site origin and base path; default origin is wolfwdavid.github.io
a942855 docs: deploy checklist records the personal-account go-live
9dfc8f0 ci: live-smoke workflow runs the read-only smoke after every deploy
6f579f7 test: fixtures use the wolfwdavid.github.io origin
036d0e3 docs(13): reconcile planning docs to the wolfwdavid.github.io/tran_real_estate origin
5764feb docs(state): phase 13 planned, ready to execute
4c163d7 fix(13): revise plans based on checker feedback
d3226cf docs(13): create phase plan
f0c1ef2 docs(phase-13): add validation strategy
1f2401d docs(13): research phase domain
f6319d6 docs(state): record phase 13 context session
5b620db docs(13): capture phase context
```

(The final `docs(13-10)` metadata commit for this SUMMARY lands on top and is also part of the bundle.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `pnpm ext:assert` red on main since 13-02: unused `TRAN_ORIGIN` kept a bare site-URL literal in the popup chunk**
- **Found during:** Task 2, step 6 (go-live env); reproduced in the default env too (`URL not on allowlist: https://wolfwdavid.github.io`).
- **Root cause:** 13-02 (`e2e3477`) rewrote `apps/extension/src/lib/site.ts` to `TRAN_SITE_URL = __TRAN_SITE_URL__; TRAN_ORIGIN = new URL(TRAN_SITE_URL).origin; PRIVACY_URL = \`${TRAN_SITE_URL}/legal/privacy/#browser-extension\``. Nothing consumes `TRAN_ORIGIN` (repo-wide grep), but its `new URL()` call is not tree-shakeable, so the bundler kept `TRAN_SITE_URL` as a separate variable (`` var Na=`https://wolfwdavid.github.io[/tran_real_estate]` ``) instead of folding the define into the privacy link as it did before 13-02. The oracle's allowlist is `${resolveSiteUrl(env)}/` (prefix with trailing slash, so a lookalike host or a sibling project site is rejected, D-04), which correctly refuses the bare literal. 13-02 deferred the real-bundle `ext:assert` because of the parallel-wave Playwright/build lock, and the oracle's unit tests only ever fed it the full privacy link, never the bare `TRAN_SITE_URL` literal the real chunk carries. CI's root leg (`pnpm ext:build && pnpm ext:assert`) would have failed on the first push.
- **Fix:** Removed `TRAN_ORIGIN`; `TRAN_SITE_URL` is read exactly once (inside `PRIVACY_URL`), with a header comment stating the constraint. The popup chunk now carries one folded literal, `${siteUrl}/legal/privacy/#browser-extension`, which is the exact navigation target the oracle allowlists. The oracle was deliberately left strict rather than allowlisting the bare URL: its strictness is what exposed the dead export.
- **Pin:** `scripts/site-url.test.ts` test renamed `TRAN_SITE_URL comes from the define; PRIVACY_URL is its only consumer`: the non-comment source must contain exactly two `TRAN_SITE_URL` tokens, no `new URL(` and no `TRAN_ORIGIN`. Mutation-checked: re-adding the 13-02 line fails the test (1 failed / 14 passed); file restored byte-identical (`cmp`).
- **Verification:** `pnpm vitest run --project scripts scripts/site-url.test.ts scripts/assert-extension.test.ts` 90/90; eslint + prettier clean; `pnpm --filter extension check` 0 errors; `pnpm ext:build && pnpm ext:assert` green in both envs; the plan's privacy-URL grep now prints `chunks/popup-CsN9OWXh.js`; `pnpm ext:test:browser` 13/13 (the default `PRIVACY_URL` literal is unchanged); full `pnpm test:unit` 6939/6939 at HEAD.
- **Files modified:** `apps/extension/src/lib/site.ts`, `scripts/site-url.test.ts`
- **Commit:** `f4479c4`

### Procedure notes (not deviations)

- **Shard re-cuts:** root shard 2/4 (465 tests, 4.3 min) and default shard 5/10 (245 tests, 4.3 min) ran "near 5 minutes", so the remainders were re-cut at double N (5/8..8/8 and 11/20..20/20). Each re-cut was verified with `playwright test --list` to cover the identical test set (398 and 1145 tests respectively) before running. Two shards were empty (5/8 and 16/20): Playwright splits by test group and one 265-test serial group is indivisible, so an empty neighbouring shard is normal; both exit 0 with no output and were confirmed empty by `--list`.
- **Stale-stamp smoke after the fix commit:** `smoke:local --target root` exited 2 immediately with `stamp 0d59846..., HEAD f4479c4...; rebuild: pnpm build:root`. That is the fail-closed design from LIVE-04; the go-live root build was rebuilt at HEAD and the smoke re-run green.

## Issues Encountered

- One Bash invocation (a `bash -c` wrapper around the shard-20/20 run plus a log tally) was refused by the tool's built-in removal safety check as unreadable; nothing was deleted or intended to be. It was re-issued as a plain `env -u ... pnpm test:e2e ...` command, which ran normally.

## Known Stubs

None. No application code was added; the only source change removes an unused export.

## Lesson candidate for `tasks/lessons.md` (for the orchestrator; not edited here)

- When a parallel-wave executor defers a verify step because of the build/Playwright lock (13-02 deferred `pnpm ext:assert` on the real bundle), the orchestrator's post-wave check must run that exact step, not only lint and unit. Unit tests of an oracle (`assert-extension.test.ts`) feed it hand-built fixtures and cannot see what the real bundler emits; `ext:assert` was red on main for the whole wave until this plan ran it.

## Next Phase Readiness

- Plan 13-11 (owner push): the bundle above is green under both configurations; after the push the root leg should log `target=root BASE_PATH=/tran_real_estate` once the owner sets the variable, and `Extension build + manifest/zero-network oracle` should pass with the folded base-path privacy literal.
- Plan 13-13: LIVE-03 stays unchecked here; the live routing contract is observed at go-live.
- Plan 13-18: the LAUNCH-AUDIT regeneration will run the same oracles on the deployed commit.

## Self-Check: PASSED

- FOUND apps/extension/src/lib/site.ts
- FOUND scripts/site-url.test.ts
- FOUND commit f4479c4
- `git status --short` empty before the metadata commit; `origin/main..HEAD` carries no attribution trailers (hygiene 1293/0).
