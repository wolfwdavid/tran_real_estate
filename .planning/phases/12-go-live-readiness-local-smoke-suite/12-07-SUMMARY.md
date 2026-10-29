---
phase: 12-go-live-readiness-local-smoke-suite
plan: 07
subsystem: build
tags: [public-site-url, build-targets, github-actions, wxt, seo, live-08]

# Dependency graph
requires:
  - phase: 12-04
    provides: extension __TRAN_ORIGIN__ define from resolveSiteOrigin(); oracle urlAllowlist(env)
  - phase: 12-03
    provides: build stamp (version.json = commit SHA) used to judge build-dir staleness
provides:
  - TEST_SITE_ORIGIN (https://tran-configured.example) on the configured build target, owner values cannot override it
  - ci.yml extension build/oracle step receives PUBLIC_SITE_URL (5th quality env block)
  - extension-release.yml zip and oracle are named steps, each with PUBLIC_SITE_URL
  - scripts/site-url.test.ts, the LIVE-08 proof (literal sweep, web wiring, extension define, configured origin)
affects: [12-08 smoke:local (configured target now serves tran-configured.example URLs), 12-10 phase gate, 13 live deploy, Phase 14 DEBT 5.4]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A test-only site origin on the configured target so every CI/smoke run exercises PUBLIC_SITE_URL, not just the default"
    - "Source-literal sweep as a pure function over {path,text}[] so planted cases run the same code as the real tree"

key-files:
  created:
    - scripts/site-url.test.ts
  modified:
    - scripts/lib/build-targets.mjs
    - scripts/build-targets.test.ts
    - .github/workflows/ci.yml
    - scripts/workflow-gate.test.ts
    - .github/workflows/extension-release.yml
    - scripts/extension-release-gate.test.ts

key-decisions:
  - "The configured target always uses TEST_SITE_ORIGIN; an env PUBLIC_SITE_URL is ignored there (root and sub still pass it through)"
  - "The CI extension step carries only PUBLIC_SITE_URL; owner settings stay in the four web env blocks"
  - "The literal sweep uses the git pathspec ':(glob)packages/*/src/**' because a bare 'packages/*/src' matches no files"

requirements-completed: [LIVE-08]

# Metrics
duration: 11min
completed: 2026-10-29
---

# Phase 12 Plan 07: PUBLIC_SITE_URL End to End Summary

**The configured build target now builds on its own test origin `https://tran-configured.example`. CI and the release workflow pass `PUBLIC_SITE_URL` to the extension build and its oracle. `scripts/site-url.test.ts` proves by test that the variable alone moves every absolute URL and the extension's `TRAN_ORIGIN` / `PRIVACY_URL`. That closes LIVE-08.**

## Performance

- **Duration:** about 11 min
- **Started:** 2026-10-29T19:54Z
- **Completed:** 2026-10-29T20:05Z
- **Tasks:** 3 (Task 1 and Task 2 run as TDD, RED then GREEN)
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- `scripts/lib/build-targets.mjs` exports `TEST_SITE_ORIGIN = 'https://tran-configured.example'`. The configured overlay ends with `PUBLIC_SITE_URL: TEST_SITE_ORIGIN`. Every consumer merges `{ ...process.env, ...targetEnv(name) }`, so the overlay wins over CI's `vars.PUBLIC_SITE_URL`.
- `build-targets.test.ts` has the 7-key configured shape, a new test `configured ignores an owner PUBLIC_SITE_URL`, and `resolveSiteOrigin(t)` is checked to be TEST_SITE_ORIGIN and not DEFAULT_SITE_ORIGIN.
- `ci.yml`: the "Extension build + manifest/zero-network oracle" step has `env: PUBLIC_SITE_URL: ${{ vars.PUBLIC_SITE_URL }}`. Its `if:` is still `matrix.target == 'root'`, and there are still 7 `uses:` lines. `workflow-gate.test.ts` now expects 5 env blocks: owner keys gated 4 times each and `vars.PUBLIC_SITE_URL` 5 times. A new test checks that the extension step carries only PUBLIC_SITE_URL, with exactly one expression.
- `extension-release.yml`: "Zip the extension" and "Manifest and zero-network oracle" are named steps, each with its own `PUBLIC_SITE_URL` env. The run lines are byte-identical, so the order and exactly-once pins still hold. `EXTENSION_RELEASES_ENABLED` and `github.token` each still appear once. The new gate test also forbids a workflow-level or job-level `env:`.
- `scripts/site-url.test.ts` has 11 tests in groups (a) to (d):
  - (a) Literal sweep over the tracked web, extension and package sources, plus 3 planted cases. The planted cases cover a flagged URL, four comment forms that are ignored, and a second literal in site-config.js that is flagged.
  - (b) `__SITE_URL__` and `origin: resolveSiteOrigin()` wiring. `resolveSiteOrigin` handles a probe value, unset, empty and a malformed value.
  - (c) The WXT config's `vite().define.__TRAN_ORIGIN__` under `vi.stubEnv('PUBLIC_SITE_URL', ...)` (probe, then unset), and PRIVACY_URL derived in site.ts.
  - (d) The configured target's origin.

## Build-level proof (Task 1 step 3, inside the build lock)

| Check | Result |
| --- | --- |
| `pnpm build:configured`, then `assert-seo --target configured` | passed: 44 pages, 14 sitemap URLs, 6 share cards |
| `assert-csp --target configured` | passed: 45 pages |
| `grep -c "https://tran-configured.example/sitemap.xml" robots.txt` | 1 |
| `grep -c "<loc>https://tran-configured.example/" sitemap.xml` | 14 |
| `grep -rl tranrealestate.github.io build-configured (*.html, *.xml, *.txt)` | nothing |
| `playwright test --project=configured` | 41 passed |
| `pnpm build:root`, then `assert-seo --target root` | passed. `<loc>https://tranrealestate.github.io/` appears 14 times (the default is unchanged) |

## Mutation checks (site-url.test.ts is not vacuous)

- Replacing the wxt.config define with a hard-coded `JSON.stringify('https://tranrealestate.github.io')` fails the probe test in group (c).
- Appending `const x = 'https://tranrealestate.github.io/a';` to `packages/core/src/index.ts` fails the sweep with `packages/core/src/index.ts:13`.
- Both files were restored with `git checkout`.

## Task Commits

1. **Task 1 RED: failing tests for the configured target's own origin:** `9afac19` (test)
2. **Task 1 GREEN: configured target proves PUBLIC_SITE_URL:** `2f7e0aa` (feat)
3. **Task 2a: PUBLIC_SITE_URL to the CI extension build and oracle:** `eb28463` (ci)
4. **Task 2b: release workflow builds the extension for the configured origin:** `0b56781` (ci)
5. **Task 3: site-url.test.ts LIVE-08 proof:** `77e3b95` (test)

Task 2 RED was run for both gate tests before each workflow edit: 2 failures in workflow-gate, 1 in extension-release-gate. Each gate test was committed together with its workflow, as the plan requires.

## Verification

- `vitest run --project scripts` on build-targets, workflow-gate, extension-release-gate and site-url: 75/75
- `corepack pnpm test:unit`: 348 files, 6774 tests, all green. `scripts/precommit.test.ts` passed; this run had no other executor on the machine.
- `corepack pnpm lint`: exit 0. `corepack pnpm lint:workflows` (actionlint): exit 0.
- `grep -c 'PUBLIC_SITE_URL: ${{ vars.PUBLIC_SITE_URL }}'`: ci.yml 5, extension-release.yml 2. `uses:` in ci.yml: 7.
- No commit message mentions an assistant, and none has a trailer (`git log -5 --format=%B` checked).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's `packages/*/src` pathspec matched no files**
- **Found during:** Task 3
- **Issue:** `git ls-files -- 'packages/*/src'` returns 0 files. A git pathspec wildcard has to match the whole path, so the sweep silently skipped `packages/core` and `packages/brand`. The new coverage test caught it.
- **Fix:** Use `':(glob)packages/*/src/**'` (222 files). The coverage test asserts that at least one `packages/<name>/src/` file is swept.
- **Files modified:** scripts/site-url.test.ts
- **Commit:** 77e3b95

### Judgment calls

- Task 1 was split into a RED commit and a GREEN commit (TDD protocol). The GREEN commit uses the plan's message.
- The gate tests got a few extra pins beyond the behavior list: `vars.PUBLIC_SITE_URL` appears 5 times in all of ci.yml and 2 times in extension-release.yml, and the release workflow has no workflow-level or job-level `env:`.
- Group (b) also checks that an empty or malformed `PUBLIC_SITE_URL` behaves correctly. Group (c) also checks the default against `JSON.stringify(DEFAULT_SITE_ORIGIN)`.

## Deferred Issues

None. The precommit.test.ts item in deferred-items.md did not reproduce in this solo full run (it passed).

## Known Stubs

None.

## Overlap note for Phase 14

LIVE-08 proof. Overlap: Phase 14 item 5.4 (origin parity) is satisfied for TRAN_ORIGIN by group (c) of `scripts/site-url.test.ts`. Phase 14 keeps only the docs/listing literal checks.

## Build-dir state for the next plan (12-08 smoke:local)

All three build dirs are STALE relative to HEAD:

- `apps/web/build` and `apps/web/build-configured` are stamped `9afac19` (the Task 1 RED commit). `build-configured` already has the tran-configured.example origin.
- `apps/web/build-sub` is still stamped `ad8fbe9` (from 12-03).

12-08 must rebuild all three targets (`pnpm build:root && pnpm build:sub && pnpm build:configured`) before smoke or E2E. The smoke's configured leg will now see `https://tran-configured.example` canonical, sitemap and OG URLs. The extension `.output` was not rebuilt in this plan.

## Next Phase Readiness

- LIVE-08 is complete. The web app (already correct), the extension, the CI workflow and the release workflow all follow PUBLIC_SITE_URL.
- The owner only has to set the `PUBLIC_SITE_URL` repository variable for a custom domain. No code change is needed.

## Self-Check: PASSED

- Files: scripts/site-url.test.ts, scripts/lib/build-targets.mjs (TEST_SITE_ORIGIN) present
- Commits: 9afac19, 2f7e0aa, eb28463, 0b56781, 77e3b95 present; none carries an attribution trailer
