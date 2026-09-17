---
phase: 01-foundation-origin-security-baseline
plan: 02
subsystem: testing
tags: [vitest, vitest-projects, setupFiles, no-network, typescript, pnpm-workspace, tdd]

# Dependency graph
requires:
  - phase: 01-foundation-origin-security-baseline
    plan: 01
    provides: pnpm workspace root, root test:unit/check/lint scripts, vitest 4.1.11 + typescript ~6.0.3 pins, pre-commit gate
provides:
  - Vitest 4 `test.projects` root harness (`vitest.config.ts`) discovering `packages/core` and `scripts`
  - `tooling/vitest/no-network.ts` setupFiles kill-switch that makes any `fetch` call in a unit test throw and re-asserts itself in `beforeEach`
  - `scripts` Vitest project (60s timeout) ready for plan 06's process-spawning tests
  - `@tran/core` workspace package: DOM-free TypeScript, `PORTALS` frozen tuple, `Portal` type, `isPortal` guard
  - `@tran/brand` workspace package: empty `tokens` contract and `BrandTokens` type for Phase 2
  - Green `pnpm check`, `pnpm test:unit`, `pnpm lint`, `pnpm install --frozen-lockfile`
affects: [01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, every phase that writes unit tests or imports @tran/core]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Vitest 4 `test.projects` in root `vitest.config.ts`; no `vitest.workspace.ts`
    - Network kill-switch is a `setupFiles` entry per project (never `globalSetup`), plus one `no-network.test.ts` wiring test per project
    - Per-project `setupFiles` paths are relative to the project root (`../tooling/...` for `scripts/`, `../../tooling/...` for `packages/*`)
    - Workspace packages export TypeScript source directly (`exports: { ".": "./src/index.ts" }`) with `tsc --noEmit` as their `check`
    - Pure packages keep `lib: ["ES2024"]` + `types: []`; a test that needs a Node global uses `/// <reference types="node" />` instead of widening the tsconfig
    - `as const` tuples that are shared state are also `Object.freeze`d so the readonly type has a runtime guarantee
    - `no-network.test.ts` files carry a targeted `eslint-disable-next-line no-restricted-syntax` because the ESLint fetch ban applies to every `.ts` file, and these tests exist to prove the ban holds

key-files:
  created:
    - vitest.config.ts
    - tooling/vitest/no-network.ts
    - scripts/vitest.config.ts
    - scripts/no-network.test.ts
    - packages/core/package.json
    - packages/core/tsconfig.json
    - packages/core/vitest.config.ts
    - packages/core/src/index.ts
    - packages/core/src/index.test.ts
    - packages/core/src/no-network.test.ts
    - packages/brand/package.json
    - packages/brand/tsconfig.json
    - packages/brand/src/index.ts
  modified:
    - pnpm-lock.yaml

key-decisions:
  - "PORTALS is Object.freeze(['renter','investor','agent'] as const): the plan's behaviour says frozen, and as const alone is compile-time only (a mutation test proved push() succeeded and leaked into the next test)"
  - "no-network wiring tests use eslint-disable-next-line no-restricted-syntax rather than an eslint.config.js override: the fetch ban stays global and the exemption is visible at the only two call sites that intentionally invoke fetch"
  - "Aligned the machine's global pnpm (npm -g) from 11.0.9 to 11.27.0 so nested `pnpm -r` inside `corepack pnpm check` matches the packageManager pin; no repo file changed for this"
  - "FND-04 left unchecked, consistent with 01-01: this plan delivers the unit-test half; plan 09 closes the requirement once CI runs the gates"

patterns-established:
  - "Every new Vitest project: add its path to root vitest.config.ts projects, set setupFiles to tooling/vitest/no-network.ts, and add a no-network.test.ts wiring test"
  - "Unit tests never reach the network; units under test receive a fake fetch by injection"
  - "New workspace packages ship package.json + tsconfig.json (ES2024, no DOM, types: []) + src/index.ts and are linked with corepack pnpm install (lockfile change is the link only)"

requirements-completed: []

# Metrics
duration: 7min
completed: 2026-09-17
---

# Phase 01 Plan 02: Vitest Harness, No-Network Kill-Switch & Core/Brand Packages Summary

**Vitest 4 multi-project harness (`packages/core` + `scripts`) whose `setupFiles` hook makes every `fetch` throw, plus the DOM-free `@tran/core` (`PORTALS`/`isPortal`) and empty `@tran/brand` workspace packages, all green under `pnpm check`, `pnpm test:unit` and `pnpm lint`**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-17T04:04:40Z
- **Completed:** 2026-09-17T04:11:30Z
- **Tasks:** 2 (both TDD: RED commit then GREEN commit)
- **Files modified:** 14

## Accomplishments

- `corepack pnpm test:unit` exits 0 with `3 passed (3)` test files and `14 passed (14)` tests; the verbose reporter names both `|core|` and `|scripts|` projects
- Each project has a `no-network.test.ts` that passes only because `tooling/vitest/no-network.ts` is loaded via `setupFiles`; the RED run (kill-switch absent) showed both fetch assertions failing, the GREEN run shows them passing, and the leak test proves `beforeEach` re-asserts the stub after a test overwrites `globalThis.fetch`
- `corepack pnpm check` exits 0 running `tsc --noEmit` in `packages/core` and `packages/brand` (`Scope: 2 of 3 workspace projects`); `packages/core` typechecks with `lib: ["ES2024"]`, `types: []`, no DOM
- `corepack pnpm vitest run --project core` exits 0 (`2 passed (2)` files, `11 passed (11)` tests), so later plans can select a single project
- `corepack pnpm lint` exits 0 and `corepack pnpm install --frozen-lockfile` exits 0 after the lockfile linked the two new packages
- `apps/extension` does not exist; `vitest.workspace.ts` does not exist; no file contains `--watch`; the root script is still `vitest run`
- No git remote exists (`git remote -v` prints nothing); nothing was pushed

## Task Commits

Each task was committed atomically through the installed pre-commit hook (gitleaks staged scan + real-data guard passed on every commit):

1. **Task 1: Vitest project harness with network kill-switch**
   - RED `1b7be52` (test): root `vitest.config.ts`, `scripts/vitest.config.ts` without `setupFiles`, `scripts/no-network.test.ts`; run showed `2 failed | 1 passed`
   - GREEN `6d6bf69` (feat): `tooling/vitest/no-network.ts` + `setupFiles` wiring; run showed `3 passed`
2. **Task 2: packages/core and packages/brand workspace packages**
   - RED `03f12c0` (test): both packages minus `packages/core/src/index.ts`, core Vitest project, root projects list, lockfile; run showed `Cannot find module './index.js'` for core while core's `no-network` test already passed
   - GREEN `19f97cf` (feat): `packages/core/src/index.ts`; run showed `14 passed (14)`

**Plan metadata:** see final docs commit below

## Files Created/Modified

- `vitest.config.ts` - `defineConfig({ test: { projects: ['packages/core', 'scripts'] } })`
- `tooling/vitest/no-network.ts` - Throwing `fetch` stub assigned at load and re-asserted in `beforeEach` (RESEARCH verbatim)
- `scripts/vitest.config.ts` - Project `scripts`, node env, `**/*.test.ts`, `setupFiles: ['../tooling/vitest/no-network.ts']`, `testTimeout: 60_000`
- `scripts/no-network.test.ts` - Three wiring tests: throws, replacement does not leak, re-asserted
- `packages/core/package.json` - `@tran/core`, `exports . -> ./src/index.ts`, `check: tsc --noEmit`, devDeps typescript + vitest (Prettier-expanded)
- `packages/core/tsconfig.json` - ES2024 target/lib, bundler resolution, `types: []`, strict, noEmit, isolatedModules
- `packages/core/vitest.config.ts` - Project `core`, `src/**/*.test.ts`, `setupFiles: ['../../tooling/vitest/no-network.ts']`
- `packages/core/src/index.ts` - `PORTALS` (frozen `as const` tuple), `Portal`, `isPortal`
- `packages/core/src/index.test.ts` - PORTALS order/length/immutability; `isPortal` accepts the three portals and rejects `marketing`, `''`, `Renter`, `renters`, `' agent'`
- `packages/core/src/no-network.test.ts` - Starts with `/// <reference types="node" />`; asserts `fetch` throws
- `packages/brand/package.json` - `@tran/brand`, same shape as core without vitest (Prettier-expanded)
- `packages/brand/tsconfig.json` - Identical compilerOptions to core
- `packages/brand/src/index.ts` - `export const tokens = {} as const; export type BrandTokens = typeof tokens;`
- `pnpm-lock.yaml` - Links `packages/brand` and `packages/core` importers (no new third-party packages)

## Decisions Made

- **`Object.freeze` on `PORTALS`.** The plan's `<behavior>` says "PORTALS has length 3 and is frozen/`as const`". My immutability test called `push('marketing')` on the tuple and it succeeded at runtime, which then made `isPortal('marketing')` return `true` in the next test. `as const` is a type-level readonly only. Freezing gives the runtime guarantee the behaviour asks for; the exported type is unchanged (`readonly ['renter', 'investor', 'agent']`), so the `<interfaces>` contract holds exactly.
- **Inline `eslint-disable-next-line` in the two wiring tests.** The 01-01 ESLint config bans `fetch(` in every `.ts` file outside adapter folders. The wiring tests must call `fetch` to prove it throws. A targeted inline disable with a reason comment keeps the ban global and avoids editing `eslint.config.js` (a 01-01 artefact); the exemption is visible at the exact call site.
- **Prettier-expanded the two package.json files.** Same reflow 01-01 hit: `printWidth: 100` expands the single-line `exports`/`scripts`/`devDependencies` objects. `node -p` confirms identical JSON.
- **Global pnpm aligned to 11.27.0 (machine, not repo).** See deviation 2 below.
- **FND-04 not marked complete.** Consistent with 01-01's decision: this plan provides the unit-test harness half; CI enforcement (01-08) and phase verification (01-09) close it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `PORTALS` was mutable at runtime despite `as const`**
- **Found during:** Task 2 GREEN run (verbose reporter)
- **Issue:** `is a readonly tuple that cannot be mutated` failed (`push` did not throw) and, because the push mutated the shared tuple, `rejects "marketing"` failed too. The plan's behaviour requires "frozen".
- **Fix:** `export const PORTALS = Object.freeze(['renter', 'investor', 'agent'] as const);`
- **Files modified:** packages/core/src/index.ts
- **Verification:** `corepack pnpm test:unit` 14/14, `corepack pnpm check` exit 0
- **Committed in:** 19f97cf

**2. [Rule 3 - Blocking] `corepack pnpm check` failed before reaching `tsc` because of a stale global pnpm**
- **Found during:** Task 2 verification (`corepack pnpm check`)
- **Issue:** `check` is `pnpm -r --if-present check`. The nested `pnpm` resolves via PATH to `C:\Users\Mkaru\AppData\Roaming\npm\pnpm` (npm-global v11.0.9). Outside corepack that binary auto-switches to the pinned 11.27.0, but inside a corepack-launched script it detects `COREPACK_ROOT` and refuses: "This project is configured to use 11.27.0 of pnpm. Your current pnpm is v11.0.9 ... pnpm does not switch versions when running under corepack". `pnpm check` (direct) already passed, proving the repo scripts are correct.
- **Fix:** `npm i -g pnpm@11.27.0` (machine-level; aligns the global with `packageManager`). No repo file changed. Rejected alternatives: writing `corepack pnpm -r` into scripts (couples the repo to corepack, which Node 25 no longer ships) or `pmOnFail=ignore` (would silently run a mismatched pnpm).
- **Files modified:** none in the repository
- **Verification:** `corepack pnpm check` exit 0 with `packages/core check: Done` and `packages/brand check: Done`; `corepack pnpm test:unit`, `lint`, `install --frozen-lockfile` all exit 0 afterwards
- **Committed in:** n/a (environment)

**3. [Rule 3 - Blocking] ESLint `no-restricted-syntax` fetch ban flagged the wiring tests**
- **Found during:** Task 1 (writing `scripts/no-network.test.ts` against the 01-01 lint rules)
- **Issue:** The plan's verbatim test calls `fetch('https://example.com')`, which the global fetch ban rejects, so `pnpm lint` would fail.
- **Fix:** `// eslint-disable-next-line no-restricted-syntax -- this test exists to prove the fetch ban holds` on the two `fetch` lines (scripts test) and the one in core; no config change.
- **Files modified:** scripts/no-network.test.ts, packages/core/src/no-network.test.ts
- **Verification:** `corepack pnpm lint` exit 0
- **Committed in:** 1b7be52, 03f12c0

**4. [Rule 3 - Blocking] Prettier reflow of `packages/*/package.json`**
- **Found during:** Task 2 RED commit pre-lint
- **Issue:** `prettier --check` flagged the plan's single-line object style.
- **Fix:** `prettier --write` on both files; `node -p JSON.stringify(...)` confirmed identical content.
- **Committed in:** 03f12c0

### Acceptance criterion note (satisfied, with a reporter caveat)

- "`corepack pnpm test:unit` output contains `scripts`" / "names both the `core` and `scripts` projects": Vitest 4's default reporter in a non-TTY only prints per-file `|project|` lines on failure. Project names were verified with `corepack pnpm vitest run --reporter=verbose` (all 14 lines prefixed `|core|` or `|scripts|`) and with `--project core`. In a TTY the default reporter prints them too.

---

**Total deviations:** 4 auto-fixed (1 bug, 3 blocking), 1 acceptance-reporter caveat documented
**Impact on plan:** No scope change. All artifacts match the plan's `<interfaces>` and `must_haves`; the only source-level difference from the plan's verbatim snippets is `Object.freeze(...)` around `PORTALS` and the three targeted lint-disable comments.

## Issues Encountered

- None beyond the deviations above. The pre-commit hook passed on all four commits ("no leaks found", "Real-data guard passed").

## Known Stubs

- `packages/brand/src/index.ts` exports `tokens = {}`. This is the plan's intended empty contract ("Empty brand token map consumed from Phase 2 onward"); Phase 2 (UI/UX Pro Max) populates it. Nothing renders from it in Phase 1.

## User Setup Required

None. One machine-level side effect to be aware of: the npm-global pnpm on this Windows machine is now 11.27.0 (was 11.0.9). Revert with `npm i -g pnpm@11.0.9` if ever needed; the repo does not depend on it.

## Requirements Status

| ID | This plan delivers | Still open | Closed by |
|----|-------------------|------------|-----------|
| FND-04 | Unit-test harness with per-project no-network proof; `check`/`test:unit`/`lint` green locally | CI running the gates on every push | 01-08 (workflow), 01-09 (phase verify) |

## Next Phase Readiness

- Plan 03 (`apps/web`) appends `'apps/web'` to `vitest.config.ts` projects and sets `setupFiles: ['../../tooling/vitest/no-network.ts']` in `apps/web/vite.config.ts`; it should also add its own `no-network.test.ts`
- Plan 06 can rely on the `scripts` project's 60s timeout for git/ESLint process tests
- Any package may `import { PORTALS, isPortal } from '@tran/core'` once it lists `@tran/core: workspace:*`
- No remote, no push, branch `main`, tree clean after the final docs commit

## Self-Check: PASSED

All 13 created files and `pnpm-lock.yaml` exist on disk; commits `1b7be52`, `6d6bf69`, `03f12c0`, `19f97cf` are present in `git log`.

---
*Phase: 01-foundation-origin-security-baseline*
*Completed: 2026-09-17*
