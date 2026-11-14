---
phase: 16-toolchain-pnpm-12-sveltekit-3-vitest-5
plan: 04
subsystem: toolchain
tags: [pnpm-12, lockfile, spawners, ci, live-smoke, dependabot]

requires:
  - phase: 16-03
    provides: "D-09 baseline: green verify, ci and live smoke on the unchanged toolchain"
provides:
  - "pnpm 12.18.0 pinned in packageManager, lockfile regenerated once (two-document format)"
  - "Shared scripts/lib/pnpm-cmd.mjs helper used by all four spawners"
  - "Green local gate, ci (frozen install) and live smoke on the pnpm 12 commit"
affects: [16-05, 16-13]

key-files:
  created:
    - scripts/lib/pnpm-cmd.mjs
    - scripts/lib/pnpm-cmd.d.mts
    - scripts/pnpm-cmd.test.ts
  modified:
    - scripts/build-web.mjs
    - scripts/smoke.mjs
    - scripts/audit-evidence.mjs
    - scripts/launch-audit.mjs
    - scripts/launch-audit.test.ts
    - scripts/supply-chain.test.ts
    - package.json
    - pnpm-lock.yaml
    - README.md
    - tasks/lessons.md

key-decisions:
  - "Gate run with plain `pnpm`, not `corepack.cmd pnpm` (inner script calls resolved to the global pnpm 11 and refused the 12 pin); CI uses pnpm/action-setup and is unaffected"
  - "Lint-caught regex bug in 2a53e16 fixed forward in 9ff0435, history not rewritten, gate re-run from the start"

requirements-completed: [TOOL-01]  # TOOL-06 stays Pending (also carried by 16-10 and 16-13)

duration: n/a
completed: 2026-11-14
---

# Phase 16 Plan 04: pnpm 11.27.0 to 12.18.0 Summary

**pnpm 12.18.0 is pinned and live: the four spawners use one shared helper that handles a native `pnpm.exe` `npm_execpath`, the lockfile was regenerated once with its project document byte-identical, and the local gate, the ci frozen install and a 121-test live smoke are all green on 9ff0435.**

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Shared pnpm-cmd helper, its test, the four spawners on it | b25281d |
| 2 | Pin pnpm 12.18.0, one lockfile regeneration, test rewrites, docs | 2a53e16 |
| 2b (deviation) | Docs: corepack and a global pnpm 11 on this machine | 1db1e13 |
| 2c (deviation) | Lint fix: escape the importer regex in the lockfile test | 9ff0435 |
| 3 | Local gate under pnpm 12 | verification only |
| 4 | Owner-approved push, CI frozen install, live smoke, dependency graph | push f5c738d..9ff0435 |

## Lockfile review (T-16-04-01)

- One non-frozen `pnpm install` with the pin in place; `allowBuilds` untouched.
- Diff: 158 insertions, 0 deletions, two YAML documents. The new file ends with the old lockfile
  byte for byte (154206 to 158810 bytes). The added boot document holds
  `packageManagerDependencies`, `pnpm@12.18.0` and 13 `@pnpm/exe.*` platform packages with
  integrity hashes.
- `pnpm install --frozen-lockfile` passes locally and in CI.

## Local gate under pnpm 12.18.0 at 9ff0435 (every stage exit 0)

| Stage | Seconds | Note |
| ----- | ------- | ---- |
| audit:deps (first) | 2 | 5 ignored: 4 low, 1 moderate (baseline set) |
| install --frozen-lockfile | 1 | |
| native-binary spawner proof (audit-evidence.mjs) | 6 | 20 tests passed |
| check | 37 | |
| lint | 131 | |
| banned | 1 | 454 files |
| ui:guard | 1 | 81 files |
| test:unit (full) | 218 | 7305 passed (baseline 7282, 23 new) |
| build:root / sub / configured | 23 / 24 / 24 | log shows `build-web: pnpm 12.18.0` |
| csp:assert | 2 | 45 pages |
| seo:assert | 1 | 44 pages, 14 sitemap URLs, 6 share cards |
| budget:assert | 2 | 9 gated routes within 60 KB |
| test:e2e sub | 771 | 1149 passed |
| test:e2e configured | 23 | 44 passed |
| test:e2e root shards 1-4 | 223 / 278 / 61 / 254 | 1157 passed |
| smoke:local | 67 | 121 on each of three targets |
| audit:deps, guard, fixtures:check, secrets:canary, secrets:scan, lint:workflows | 3 / 4 / 2 / 2 / 5 / 2 | guard 2096 files, no leaks |
| ext:build, ext:assert, ext:test:browser, ext:e2e | 7 / 1 / 8 / 8 | 13 + 7 passed |

## Task 4 evidence

- ci (push) for 9ff0435: success, https://github.com/wolfwdavid/tran_real_estate/actions/runs/43022965174
- live-smoke (workflow_run) for 9ff0435: success, https://github.com/wolfwdavid/tran_real_estate/actions/runs/43026334381
  - `smoke: 9ff0435949715ffabf52d2e2c481a999ad382c5d live at https://wolfwdavid.github.io/tran_real_estate/ after 0 s`
  - `121 passed (44.9s)`
- Dependency graph: **ok**. Read 2026-11-14 from the public Insights page
  (`/network/dependencies`): 546 dependencies listed (e.g. `@axe-core/playwright`, `@eslint/js`,
  `@babel/parser`). The page's ecosystem filter showed a GitHub-side loading error; the list itself
  is populated. The SBOM export agrees (541 packages, including `@sveltejs/kit@2.70.3`).
- Dependabot minimatch run 43025429048 failed with `security_update_not_possible`, the same as on
  23c7aae before pnpm 12; minimatch is an accepted audit exception. Not a regression.

## Deviations

1. Gate run with plain `pnpm` instead of `corepack.cmd pnpm` (see key decisions). Documented in
   README.md and tasks/lessons.md (1db1e13).
2. 2a53e16 had a lockfile-test regex matching `s*` instead of whitespace; lint caught it, 9ff0435
   fixed it, and the whole gate was re-run at 9ff0435.
3. The WLAN 8003 log was checked before the run, not across the run window. No
   ERR_NETWORK_CHANGED and no libuv crash appeared.
4. The dependency-graph row was read from the public repository page instead of an owner reply,
   at the owner's request to complete the remaining steps.
