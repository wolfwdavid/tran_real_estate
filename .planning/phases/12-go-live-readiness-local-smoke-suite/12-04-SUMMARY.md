---
phase: 12-go-live-readiness-local-smoke-suite
plan: 04
subsystem: extension
tags: [wxt, vite-define, public-site-url, zero-network-oracle, live-08]

# Dependency graph
requires:
  - phase: 12-02
    provides: rewritten history and the commit-msg attribution hook
  - phase: 10
    provides: apps/web/src/lib/site-config.js resolveSiteOrigin (PUBLIC_SITE_URL validator)
provides:
  - apps/extension/src/lib/site.ts (TRAN_ORIGIN / PRIVACY_URL from the __TRAN_ORIGIN__ define)
  - __TRAN_ORIGIN__ define in wxt.config.ts and both extension Vitest configs, fed by resolveSiteOrigin()
  - apps/web/src/lib/site-config.d.ts (types for the plain-JS validator, needed by the non-allowJs extension tsconfig)
  - scripts/assert-extension.mjs urlAllowlist(env); scanBundle/checkOutput take an optional allowlist
affects: [12-07 CI env wiring + site-url e2e, 12-10 phase gate (ext:e2e), Phase 14 DEBT 5.4 origin-parity test]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Build-time origin define resolved on the Node side (config file), never bundling the validator"
    - "Oracle allowlist computed from the same env the build used; injectable for tests"

key-files:
  created:
    - apps/extension/src/lib/site.ts
    - apps/web/src/lib/site-config.d.ts
  modified:
    - apps/extension/src/lib/config.ts
    - apps/extension/src/entrypoints/popup/components/PopupFooter.svelte
    - apps/extension/tests/browser/popup.browser.test.ts
    - apps/extension/wxt.config.ts
    - apps/extension/vitest.config.ts
    - apps/extension/vitest.browser.config.ts
    - eslint.config.js
    - scripts/assert-extension.mjs
    - scripts/assert-extension.test.ts

key-decisions:
  - "Extension TRAN_ORIGIN comes from a __TRAN_ORIGIN__ define fed by the web resolveSiteOrigin(); a malformed PUBLIC_SITE_URL fails the extension build by name"
  - "site-config.d.ts was needed (TS7016 in the extension check); allowJs and the generated .wxt tsconfig stay untouched"
  - "scanBundle and checkOutput take an optional allowlist so tests can inject a probe-origin list; the CLI keeps using URL_ALLOWLIST = urlAllowlist(process.env)"

requirements-completed: []  # LIVE-08 extension half only; 12-07 (CI wiring + site-url test) and the 12-10 gate close it

# Metrics
duration: 16min
completed: 2026-10-29
---

# Phase 12 Plan 04: Extension Origin Follows PUBLIC_SITE_URL Summary

**The extension's `TRAN_ORIGIN` / `PRIVACY_URL` now come from a `__TRAN_ORIGIN__` build-time define fed by the web app's `resolveSiteOrigin()`, and the zero-network oracle allowlists the same origin through `urlAllowlist(env)`. A probe build with `PUBLIC_SITE_URL=https://probe.example` passes its own oracle run.**

## Performance

- **Duration:** about 16 min
- **Started:** 2026-10-29T19:29Z
- **Completed:** 2026-10-29T19:46Z
- **Tasks:** 2 (Task 2 run as TDD: RED, then GREEN)
- **Files modified:** 11 (2 created, 9 modified)

## Accomplishments

- `apps/extension/src/lib/site.ts` holds the origin: `export const TRAN_ORIGIN: string = __TRAN_ORIGIN__;`. `config.ts` has no site literal left.
- `wxt.config.ts`, `vitest.config.ts` and `vitest.browser.config.ts` each define `__TRAN_ORIGIN__: JSON.stringify(resolveSiteOrigin())`. ESLint knows the global.
- The popup browser test pins the default `PRIVACY_URL` (`https://tranrealestate.github.io/legal/privacy/#browser-extension`).
- `scripts/assert-extension.mjs` builds `STATIC_URL_ALLOWLIST` plus `${resolveSiteOrigin(env)}/`. The trailing slash keeps lookalike hosts (`<origin>.evil.test`) rejected. `scanBundle(files, allowlist?)` and `checkOutput(dir, allowlist?)` take an injected list.
- The oracle tests contain no origin literal (all come from `DEFAULT_SITE_ORIGIN`). 9 new LIVE-08 tests; 74/74 pass.

## Probe-build proof (Task 2 step 3)

| Check | Result |
| --- | --- |
| `PUBLIC_SITE_URL=https://probe.example pnpm ext:build && ... ext:assert` | exit 0, "Extension oracle passed (6 files scanned ..., zip root verified)" |
| G1 `grep -rl "https://probe.example/legal/privacy/#browser-extension" .output/chrome-mv3` | `chunks/popup-BKy05_Uw.js` |
| G2 `grep -rl "tranrealestate.github.io" .output/chrome-mv3` (probe build) | nothing |
| G3 `grep -rl "site-config" .output/chrome-mv3` | nothing (the validator is not bundled) |
| Negative: default-env `ext:assert` against the probe bundle | fails: `URL not on allowlist: https://probe.example/legal/privacy/#browser-extension` |
| Malformed: `PUBLIC_SITE_URL=https://probe.example/ pnpm ext:build` | fails: `PUBLIC_SITE_URL must be an https origin with no path or trailing slash` |
| Default rebuild `pnpm ext:build && pnpm ext:assert` | exit 0 |
| G4 `grep -rl "https://tranrealestate.github.io/legal/privacy/#browser-extension" .output/chrome-mv3` | `chunks/popup-phJa5coz.js` (no probe residue) |

The default build was the last one run, so `apps/extension/.output` contains the default bundle.

## Task Commits

1. **Task 1: define-backed site.ts wired into every config:** `5cb3af5` (feat)
2. **Task 2 RED: failing tests for urlAllowlist and injected allowlists:** `0ce571b` (test)
3. **Task 2 GREEN: oracle allowlists the PUBLIC_SITE_URL origin:** `ad8fbe9` (feat)

## Verification

- `corepack pnpm --filter extension check`: 0 errors (1077 files)
- `corepack pnpm --filter web check` (inside the build lock): 0 errors
- `corepack pnpm vitest run --project extension`: 242/242
- `corepack pnpm ext:test:browser`: 13/13
- `corepack pnpm vitest run --project scripts scripts/assert-extension.test.ts`: 74/74
- `corepack pnpm test:unit`: 345/345 files, 6738 tests (second run; see Deferred Issues for the first)
- `corepack pnpm lint`: exit 0
- No commit message mentions an assistant, and none has a trailer (`git log -3 --format=%B` checked)

## Deviations from Plan

### Judgment calls (no rule-triggered fixes)

**1. `site-config.d.ts` was needed.** The extension check reported TS7016 for all three config imports. The file declares exactly the five exports. `web check` stays green with it.

**2. `checkOutput` also takes an optional allowlist.** The plan named only the URL-scan function. Threading the list one level further lets a test prove the end-to-end output path with a probe origin. The CLI is unchanged.

**3. Dropped an extra `PUBLIC_SITE_URL is unset` assertion.** The "URL_ALLOWLIST is urlAllowlist(process.env)" test checks only equality. That holds whether or not 12-07's CI sets a test origin, so the test does not depend on the environment.

**4. Extra malformed-value and negative checks** were added to the probe proof (both in the table above).

## Deferred Issues

- One full `pnpm test:unit` run failed `scripts/precommit.test.ts > pre-commit gate in an isolated repository` while four executors were running. It passed alone (10/10), and the next full run was 345/345. Nothing in that file touches 12-04's changes. It is logged in `deferred-items.md` with a note to reproduce it under load before calling it a flake.

## Known Stubs

None.

## Overlap note for Phase 14

Overlap note for Phase 14 (DEBT item 5.4, origin-parity test): TRAN_ORIGIN now resolves from the same function as the web DEFAULT_SITE_ORIGIN, and popup.browser.test.ts asserts the default PRIVACY_URL; Phase 14 should only add the edge-listing / install-guide literal checks and the anchor-id check, not re-derive TRAN_ORIGIN parity.

## Next Phase Readiness

- 12-07 can set `PUBLIC_SITE_URL` in CI for the extension build and `ext:assert` without code changes. Both read the same variable.
- `ext:e2e` was not run here (owned by the 12-10 gate).

## Self-Check: PASSED

- Files: apps/extension/src/lib/site.ts, apps/web/src/lib/site-config.d.ts present
- Commits: 5cb3af5, 0ce571b, ad8fbe9 present; none carries an attribution trailer
