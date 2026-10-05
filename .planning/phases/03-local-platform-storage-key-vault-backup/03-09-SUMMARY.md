---
phase: 03-local-platform-storage-key-vault-backup
plan: 09
subsystem: infra
tags: [pwa, service-worker, offline, playwright, cdp, csp, assert-csp, github-pages]

# Dependency graph
requires:
  - phase: 03-03
    provides: manifest, icons, pwa-capture.js, CARRIERS list, serve-pages MIME types
  - phase: 03-01
    provides: ESLint no-restricted-syntax override for apps/web/src/service-worker.ts only
provides:
  - Allowlist-only, cache-first app-shell service worker (tran-shell-<version>) on both bases
  - serviceWorker.files dotfile filter (no .nojekyll in the precache)
  - service-worker.js as a required build carrier in assert-csp
  - Static source guard over the worker's safety shape
  - pwa.spec.ts covering scope, control, precache contents, 404 fidelity, route-mock interception, offline, CSP, CDP manifest and icons
affects: [03-14 install section UI, Phase 4 RentCast E2E mocks, Phase 5 LLM E2E mocks, Phase 10 update prompt]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Service worker answers only same-origin GETs whose pathname is in build/files/prerendered; everything else falls through to the network"
    - "No runtime cache writes and no early activation; a new version takes over once every tab closes"
    - "Source-shape guards are text assertions with planted-mutation non-vacuity checks"

key-files:
  created:
    - apps/web/src/service-worker.ts
    - scripts/service-worker-guard.test.ts
    - apps/web/tests/e2e/pwa.spec.ts
  modified:
    - apps/web/svelte.config.js
    - scripts/assert-csp.mjs
    - scripts/assert-csp.test.ts

key-decisions:
  - "The worker header comment says 'no skip-waiting, no claiming of open clients' in prose. Naming the APIs literally would trip the guard and the plan's grep acceptance check."
  - "The guard also forbids '$app/service-worker' (a Kit 3 module), 'http://' and 'https://', so the worker cannot hard-code any host"
  - "The precache test checks that no path segment of any cached URL starts with '.', which is stricter than checking the .nojekyll suffix alone"
  - "Page.getInstallabilityErrors is recorded as a test annotation and never asserted (RESEARCH Pitfall 12)"

patterns-established:
  - "Use pwa.spec.ts controlled(page) (goto, wait for ready, reload, poll for a controller) for any E2E that must run under the worker"

requirements-completed: [PLAT-06]

# Metrics
duration: 8min
completed: 2026-10-04
---

# Phase 3 Plan 09: Offline PWA Service Worker Summary

**A deliberately narrow SvelteKit service worker. It is allowlist-only, handles same-origin GETs only, serves the app shell cache-first and does no runtime caching. A dotfile precache filter, a build-oracle carrier and a static shape guard back it up, and Playwright proves offline launch, real 404s, intact provider mocks, zero CSP violations and a Chromium-valid manifest on both bases.**

## Performance

- **Duration:** about 8 min
- **Started:** 2026-10-04T22:31 local
- **Completed:** 2026-10-04T22:38 local
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- `src/service-worker.ts` follows RESEARCH Pattern 7. The cache is named `tran-shell-${version}`, and `ASSETS` is the union of `build`, `files` and `prerendered`. Install runs `addAll`. Activate deletes only other `tran-shell-*` caches. The fetch handler returns early for:
  - non-GET requests
  - cross-origin requests
  - pathnames outside `ASSETS`

  The header comment documents the three deliberate deviations from Kit's docs example. svelte-check passed (0 errors over 1346 files) with no tsconfig change.
- `svelte.config.js` now has `serviceWorker: { files: (filepath) => !/(^|[\\/])\./.test(filepath) }`. Every other key is byte-identical, so the CSP mirror in assert-csp.mjs is unaffected.
- `grep -c nojekyll` returned **0** for both `apps/web/build/service-worker.js` and `apps/web/build-sub/service-worker.js`.
- Kit's hashed inline boot script registers the worker with a relative URL. In the sub build, `renter/index.html` contains `'../service-worker.js'`. The assert-csp oracle passed for 14 pages on each base.
- `CARRIERS` now includes `service-worker.js`. The explicit test and the per-carrier `test.each` both report `missing service-worker.js`.
- `pwa.spec.ts` ran 16/16 green (8 tests on each of `root` and `sub`). The full E2E suite passed **322/322** with the worker active on both bases. `test:unit` passed 519/519 across 35 files.

## Mutation proofs (Task 2)
| Mutation (temporary, root build only) | Observed | Restored |
|---|---|---|
| Removed the `serviceWorker.files` filter | `build/service-worker.js` nojekyll count went 0 to 1. **The "precache holds only build assets… never dotfiles" test FAILED** with `http://127.0.0.1:4273/.nojekyll`. Install itself succeeded locally because serve-pages serves the dotfile. On GitHub Pages, `addAll` would reject the whole install. | yes, via `git status` (clean) |
| Deleted `if (url.origin !== sw.location.origin) return;` | All 8 pwa tests still passed. The rentcast route **was hit** (`hits === 1`, body `{ok:true}`), because the `!ASSETS.has(url.pathname)` check independently skips `/v1/ping`. Defense in depth means this mutation is caught statically instead: the guard test's non-vacuity case "dropping the cross-origin early return is caught" fails on it. | yes |

Both mutations were reverted, and both bases were rebuilt and re-verified before the final full E2E run.

## Task Commits

1. **Task 1: Allowlist-only service worker, dotfile filter, oracle carrier, static guard**: `513341a` (test, RED), `8f4183a` (feat, GREEN)
2. **Task 2: PWA E2E on both bases**: `26baf50` (test)

## Files Created/Modified
- `apps/web/src/service-worker.ts`: the allowlist-only app-shell worker
- `apps/web/svelte.config.js`: the `kit.serviceWorker.files` dotfile filter
- `scripts/assert-csp.mjs`: adds `'service-worker.js'` to CARRIERS
- `scripts/assert-csp.test.ts`: adds the carrier to the expected list, plus an explicit missing-worker case
- `scripts/service-worker-guard.test.ts`: required and forbidden source tokens, two planted non-vacuity cases, and the real-config dotfile filter cases (including a Windows `sub\.hidden` path)
- `apps/web/tests/e2e/pwa.spec.ts`: 8 PWA tests that run under both projects

## Decisions Made
See the key-decisions frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The header comment tripped the guard's forbidden-token list**
- **Found during:** Task 1 GREEN
- **Issue:** The deviation comment named the two forbidden APIs literally. The static guard flagged them, and so would the plan's `grep -cE` acceptance check.
- **Fix:** I reworded the comment in prose ("no skip-waiting, no claiming of open clients"). The grep acceptance check now outputs 0.
- **Files modified:** apps/web/src/service-worker.ts
- **Commit:** 8f4183a

**Other notes:**
- To avoid touching the parallel executors' files, I formatted only this plan's files with `prettier --write` instead of running repo-wide `pnpm format`.
- I declared no global `Window` types in the spec. I used local casts for `__csp` and `__tranInstallPrompt` to avoid declaration merging with csp.spec.ts.

## Issues Encountered
- Repo-wide `pnpm lint` failed on the `prettier --check` step. The two flagged files belong to concurrent executors and are uncommitted works-in-progress: `apps/web/src/lib/components/a11y/LiveAnnouncer.svelte` and `apps/web/src/lib/features/shared/settings/SecretInput.svelte`. This is out of scope, and those files are not mine. `eslint .` exits 0, and every 03-09 file passes `prettier --check`.
- The builds included other executors' uncommitted working-tree changes (for example `routes/+layout.svelte`). The full E2E suite was still green at 322/322.

## Known Stubs
None.

## Next Phase Readiness
- Phase 4/5 E2E can keep using `page.route()` on provider hosts while the worker controls the page.
- 03-14 (Install UI) reads `window.__tranInstallPrompt`, which this plan proved is captured with `defaultPrevented`.
- Phase 10 can add an "update available" prompt. The worker deliberately waits for all tabs to close before a new version takes over.

## Self-Check: PASSED
