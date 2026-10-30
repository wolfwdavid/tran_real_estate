---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 07
subsystem: infra
tags: [dependabot, supply-chain, privacy-copy, shared-origin, base-path, playwright, owner-decisions]

# Dependency graph
requires:
  - phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
    provides: "13-01 owner decisions B (B-ignore) and C (C-approve) recorded verbatim; 13-02 SITE_BASE / SITE_ORIGIN from resolveSiteUrl(); 13-06 root Playwright project baseURL follows BASE_PATH"
provides:
  - "Dependabot npm entry ignores semver-major updates of @sveltejs/kit, @sveltejs/adapter-static, vitest, @vitest/*, vitest-browser-svelte, pnpm and @types/node; the weekly minor/patch group and the github-actions entry are unchanged"
  - "scripts/supply-chain.test.ts pins the exact ignore list, the Phase 16 comment, the @types/node decision-B comment and the absence of an ignore list on github-actions"
  - "Privacy 'Deleting your data' copy points to Settings > Forget all keys and, only on a sub-path build, names the shared storage host rendered from SITE_ORIGIN"
  - "apps/web/tests/e2e/privacy-shared-origin.spec.ts proves both paragraphs on root (with or without BASE_PATH) and sub; first live run in plan 13-10"
affects: [13-08 runbook Dependabot policy, 13-10 serialized E2E rehearsal, 13-11 PR triage, 13-13 LIVE-03 close, phase-16 toolchain majors]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Copy that depends on the deploy shape (origin root vs sub-path) branches on SITE_BASE and renders the host from SITE_ORIGIN, so a custom domain changes the page without a code edit and the site-url group (a) sweep stays empty"
    - "E2E specs that assert deploy-shape copy branch on new URL(testInfo.project.use.baseURL).pathname !== '/' and derive expected values with the site-env.ts env rule (root = process.env, others = env + targetEnv overlay)"

key-files:
  created:
    - apps/web/tests/e2e/privacy-shared-origin.spec.ts
  modified:
    - .github/dependabot.yml
    - scripts/supply-chain.test.ts
    - apps/web/src/routes/(marketing)/legal/privacy/+page.svelte
    - apps/web/tests/e2e/marketing.spec.ts

key-decisions:
  - "13-07: Dependabot ignore list is exactly the D-06 toolchain set plus @types/node (owner decision B = B-ignore), each limited to version-update:semver-major; minor/patch stays grouped weekly"
  - "13-07: privacy deletion copy is the owner-approved text verbatim (decision C = C-approve); the second paragraph renders under {#if SITE_BASE} with the host from new URL(SITE_ORIGIN).host"
  - "13-07: the privacy page's Last updated date moved to 30 October 2026 because the policy text changed materially; marketing.spec.ts pin updated with it"

patterns-established:
  - "Owner-decision application: read the `## Owner decisions` section of the recording plan's SUMMARY, apply the text exactly, and pin it with a test so the decision cannot drift"

requirements-completed: []

# Metrics
duration: 16min
completed: 2026-10-30
---

# Phase 13 Plan 07: Dependabot toolchain-major ignores and shared-origin privacy copy Summary

**Dependabot now ignores semver-major updates for the Phase 16 toolchain set plus `@types/node` (owner decision B) with a test pinning the exact list, and the privacy page's "Deleting your data" section sends visitors to Settings > Forget all keys and, only when built under a sub-path, tells them the browser storage area is shared with other sites on the build's host (owner decision C), proven by a new Playwright spec that runs in 13-10.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-10-30T13:10:58Z
- **Completed:** 2026-10-30T13:27:00Z
- **Tasks:** 2
- **Files modified:** 5 (4 modified, 1 created)

## Accomplishments

- `.github/dependabot.yml` npm entry carries an `ignore:` list of seven `version-update:semver-major` entries (`@sveltejs/kit`, `@sveltejs/adapter-static`, `vitest`, `@vitest/*`, `vitest-browser-svelte`, `pnpm`, `@types/node`) under a comment naming Phase 16 (pnpm 12 -> Vitest 5 -> SvelteKit 3); `@types/node` sits under its own comment `# @types/node majors: owner decision B (Phase 13), re-evaluated in Phase 14/16.` The `npm-minor-patch` weekly group and the github-actions entry are untouched.
- `scripts/supply-chain.test.ts`: new `majorIgnores(body)` helper (only returns a dependency whose next line is the semver-major update-types line) with a non-vacuity case; the npm entry's list must equal `TOOLCHAIN_MAJOR_IGNORES` exactly and have no extra `dependency-name` lines; the Phase 16 comment and the decision-B comment are matched by regex; the minor/patch group stays; github-actions has no `ignore:`. TDD: RED showed 2 failures (ignore list and Phase 16 comment absent), GREEN 14/14.
- Privacy page: imports `SITE_BASE, SITE_ORIGIN` from `$lib/site`, derives `siteHost = new URL(SITE_ORIGIN).host`, replaces the "clear this site's data ... arrives with Settings" paragraph with the approved paragraph 1 (`<strong>Forget all keys</strong>` matches the ForgetAllDialog confirm label) and renders the approved paragraph 2 as `<p data-shared-origin>` inside `{#if SITE_BASE}`. No host literal in the source (`grep -c wolfwdavid` = 0; `scripts/site-url.test.ts` 15/15).
- `apps/web/tests/e2e/privacy-shared-origin.spec.ts` (relative `page.goto('legal/privacy/')`, web-first assertions, no `waitForTimeout`): test 1 asserts "open Settings and choose Forget all keys." and the saved-data sentence, and that neither "clear this site's data" nor "arrives with Settings" remains; test 2 branches on `new URL(testInfo.project.use.baseURL).pathname !== '/'`: under a sub-path `[data-shared-origin]` is visible, has count 1 and contains `other sites hosted at ${host}.` where `host = new URL(resolveSiteOrigin(env)).host` with the site-env.ts env rule; at an origin root it has count 0 and "shares its browser storage area" is absent. `playwright test --list` shows 4 tests (root x2, sub x2).

## Task Commits

Each task was committed atomically (`--no-verify`, parallel wave; hygiene grep printed 0 for both):

1. **Task 1: Dependabot ignores majors of the Phase 16 toolchain set (D-06, decision B)** - `b1258d6` (ci)
2. **Task 2: Privacy "Deleting your data" copy for the shared origin (decision C)** - `c99172c` (fix)

**Plan metadata:** see the final `docs(13-07)` commit on this SUMMARY.

## Files Created/Modified

- `.github/dependabot.yml` - npm `ignore:` list (7 semver-major entries) with the Phase 16 and decision-B comments; groups and github-actions entry unchanged
- `scripts/supply-chain.test.ts` - `majorIgnores` helper, `TOOLCHAIN_MAJOR_IGNORES`, five new `describe('dependabot')` tests
- `apps/web/src/routes/(marketing)/legal/privacy/+page.svelte` - `SITE_BASE`/`SITE_ORIGIN` import, `siteHost`, two-paragraph "Deleting your data" section, `updated="30 October 2026"`
- `apps/web/tests/e2e/marketing.spec.ts` - `LAST_UPDATED['legal/privacy/']` follows the new date (one line)
- `apps/web/tests/e2e/privacy-shared-origin.spec.ts` - new spec (2 tests, runs on root and sub)

## Owner decisions applied

- **Decision B = B-ignore**: `@types/node` added as the seventh ignore with the comment the plan specified.
- **Decision C = C-approve**: both paragraphs applied verbatim from 13-01-SUMMARY `## Owner decisions`; `{host}` is `new URL(SITE_ORIGIN).host` and the second paragraph is gated on `SITE_BASE`, so an origin-root build (a future custom domain) drops it with no code change.

## Decisions Made

- The privacy page's "Last updated" date moved from 13 October 2026 to 30 October 2026, with the `marketing.spec.ts` pin updated in the same commit. The plan did not ask for it, but a privacy policy whose deletion guidance changes materially must carry a current date (Rule 2, legal-copy correctness). This is the only edit outside the plan's `files_modified` list.
- `majorIgnores` requires the `update-types` line to be the very next line after `dependency-name`, and the test also counts every `- dependency-name:` line, so a bare ignore (which would silence all updates) or a minor/patch ignore cannot hide in the list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Privacy "Last updated" date bumped with the copy change**
- **Found during:** Task 2
- **Issue:** The approved copy changes what the policy tells visitors to do; leaving `updated="13 October 2026"` would misstate when the policy last changed.
- **Fix:** `updated="30 October 2026"` and the matching `LAST_UPDATED` pin in `apps/web/tests/e2e/marketing.spec.ts` (not one of the files the parallel 13-06 executor edits).
- **Files modified:** apps/web/src/routes/(marketing)/legal/privacy/+page.svelte, apps/web/tests/e2e/marketing.spec.ts
- **Verification:** `pnpm banned`, eslint, prettier, `pnpm --filter web check` clean; the pinned string is the only consumer of the date
- **Committed in:** `c99172c`

### Acceptance-grep note (not a deviation)

- `grep -c "@types/node" .github/dependabot.yml` prints **2**, not the 1 the plan's acceptance line expects, because the plan's own action text requires a comment line naming `@types/node` directly above the entry. There is exactly one `dependency-name: '@types/node'` entry; `grep -c "dependency-name: '@types/node'"` prints 1 and the test pins the list length at 7.

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** None on scope; the approved copy and the Dependabot list are exactly as decided.

## Issues Encountered

- Prettier re-wrapped both the test additions and the Svelte paragraph once each (`--write`, then `--check` clean); no content change.
- The plan's `interfaces` block described the pre-13-06 Playwright root baseURL (`http://127.0.0.1:${ROOT}/`); 13-06 landed `${ROOT}${ROOT_BASE}/` during this plan, which is exactly what the spec's `pathname !== '/'` rule needs for the root-with-base run in 13-10.

## Verification

Targeted (this executor; full `pnpm lint` / `pnpm test:unit` and all Playwright runs belong to the orchestrator and plan 13-10):

- `pnpm vitest run --project scripts scripts/supply-chain.test.ts` - RED 2 failed / 12 passed, GREEN 14/14
- `pnpm vitest run --project scripts scripts/site-url.test.ts` - 15/15 (group (a) sweep still finds no host literal)
- `pnpm banned` - passed (446 files)
- `pnpm exec eslint` and `pnpm exec prettier --check` on `.github/dependabot.yml`, `scripts/supply-chain.test.ts`, the privacy page, `marketing.spec.ts` and the new spec - clean
- `pnpm --filter web check` - 3256 files, 0 errors, 0 warnings (the spec is inside the `../tests/**/*.ts` include set; `tsc --listFilesOnly` confirms)
- `pnpm exec playwright test --list tests/e2e/privacy-shared-origin.spec.ts` - 4 tests listed (root, sub); **not executed here**: the spec's first live run is plan 13-10 (root-with-base, sub)
- Acceptance greps: `version-update:semver-major` 7; `Phase 16` 1; `npm-minor-patch:` 1; `dependency-name: '@types/node'` 1; privacy page `Forget all keys` 1, `clear this site's data` 0, `{#if SITE_BASE}` 1, `wolfwdavid` 0
- Both commits: `git log -1 --format=%B | grep -ciE "co-authored-by|claude|anthropic"` = 0

## Known Stubs

None. The only conditional content (`{#if SITE_BASE}`) is intentional per decision C and is covered by the spec in both branches.

## Next Phase Readiness

- 13-08: the runbook's Dependabot policy can cite the seven-entry list and decision B.
- 13-10: run `privacy-shared-origin.spec.ts` with the serialized Playwright rehearsal (root-with-base and sub); the configured project excludes it by `testMatch`.
- 13-11: existing open Dependabot major PRs for the ignored packages are closed by the owner at PR triage; the new ignore list stops new ones.
- LIVE-03 stays unchecked (closed by 13-13 after the live routing contract is observed); LIVE-02 was closed by 13-01.

## Self-Check: PASSED

- All 5 source files and this SUMMARY exist on disk; commits `b1258d6` and `c99172c` are in `git log`.
- Both task commits: `git log -1 --format=%B | grep -ciE "co-authored-by|claude|anthropic"` = 0.
- LIVE-02 already Complete (13-01); LIVE-03 left Pending on purpose (closes in 13-13), so `requirements mark-complete` was not run.
