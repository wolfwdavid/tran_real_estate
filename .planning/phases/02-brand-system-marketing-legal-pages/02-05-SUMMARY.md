---
phase: 02-brand-system-marketing-legal-pages
plan: 05
subsystem: e2e-testing
tags: [playwright, routes, axe, csp, drift-guard, external-links]
requires:
  - "02-04: 13 prerendered pages, same-origin link filter in routing.spec.ts"
provides:
  - "apps/web/tests/e2e/routes.ts: ROUTES, MARKETING_ROUTES, LEGAL_ROUTES, APP_ROUTES, PRINT, CHROME_ROUTES, NOT_FOUND, EXTERNAL_HOSTS"
  - "routing, CSP and axe specs iterate all 13 pages on both bases"
  - "Cross-origin links must be on the EXTERNAL_HOSTS allowlist (https, no target)"
  - "routes-drift.spec.ts: build index.html set == ROUTES per Playwright project"
affects: [02-06..02-09 page content (external links must use allowlisted hosts), any future page (must be added to routes.ts)]
tech-stack:
  added: []
  patterns:
    - "Shared plain module (not *.spec.ts) imported by every page-iterating spec"
    - "Build-folder drift guard with pure diffRoutes helper and an in-memory non-vacuity test"
key-files:
  created:
    - apps/web/tests/e2e/routes.ts
    - apps/web/tests/e2e/routes-drift.spec.ts
  modified:
    - apps/web/tests/e2e/routing.spec.ts
    - apps/web/tests/e2e/csp.spec.ts
    - apps/web/tests/e2e/a11y.spec.ts
decisions:
  - "routes-drift.spec.ts reads the project via test.info() instead of `({}, testInfo)` because ESLint no-empty-pattern rejects the empty fixture destructure"
  - "The drift test asserts diffRoutes(...) == {unlisted: [], missing: []} before the sorted-equality check, so a failure names the drifting route directly"
metrics:
  duration: 6min
  completed: 2026-10-04
  tasks: 2
  files: 5
---

# Phase 2 Plan 05: Shared Route List and Build Drift Guard Summary

A single `tests/e2e/routes.ts` now drives the routing, CSP and axe specs across all 13 prerendered pages on both bases. Off-site links must use a host from an explicit HTTPS allowlist and may not open a new tab. A new drift spec fails E2E whenever the build emits an `index.html` that is not in the route list, or the list names a page the build did not emit.

## What Was Built

- **Task 1 (4e00445):** `routes.ts` holds the marketing, legal and app route groups, plus `PRINT`, `CHROME_ROUTES`, `NOT_FOUND` and `EXTERNAL_HOSTS` (7 hosts). `routing.spec.ts`, `csp.spec.ts` and `a11y.spec.ts` dropped their local copies of the route list and import from `./routes`. In `routing.spec.ts` the literal `'print/'` is now `PRINT`, and the cross-origin branch also asserts `expect(EXTERNAL_HOSTS, href).toContain(url.hostname)`.
- **Task 2 (3dc90ee):** `routes-drift.spec.ts` picks `build` or `build-sub` from the project name. It walks the folder recursively, maps every `index.html` to a route path, and checks three things:
  - the folder exists;
  - there are at least 13 pages;
  - `diffRoutes(built, ROUTES)` comes back empty and the sorted lists match.

  A second, in-memory test uses `diffRoutes` directly to prove it reports an extra `unlisted/` page and a missing route.

## Verification

- `corepack pnpm check`: 0 errors and 0 warnings. ESLint and Prettier are clean on `apps/web/tests/e2e`.
- Under `.tools/build.lock`:
  - `build:root` and `build:sub` succeeded.
  - `csp:assert` passed for 14 pages in each build.
  - `test:e2e`: **48/48 passed**. This includes axe once per route, 13 per project on both root and sub (26 in total), plus 4 drift tests.
- `playwright test routes-drift`: 4/4 passed (2 tests × 2 projects).
- **Mutation check (not committed):**
  - I deleted `'legal/terms/'` from `ROUTES` and ran `playwright test routes-drift --project=root`. It went **RED**, and the drift test reported `unlisted: ["legal/terms/"]`.
  - I then restored the file (`git diff` empty) and re-ran it: **GREEN** (2 passed).
- The lock was released after the sequence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESLint `no-empty-pattern` on the `({}, testInfo)` test signature**
- **Found during:** Task 2
- **Fix:** The test now takes no arguments and calls `test.info()` to read the project name. Behaviour is unchanged.
- **Commit:** 3dc90ee

**2. Formatting scope:** The plan's step 3 calls for `corepack pnpm format`. I ran Prettier only on the five plan files, because a repo-wide `--write` could rewrite files that the parallel 02-06..02-09 executors are editing. `prettier --check` is clean on the test folder.

## Notes

- The E2E run used builds that also contained uncommitted page edits from the parallel executors. Their external links (if any) passed the allowlist check.

## Known Stubs

None.

## Self-Check: PASSED
