---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 08
subsystem: testing
tags: [vitest, browser-mode, playwright, axe-core, vitest-browser-svelte, ci]
requires:
  - "04-01: @vitest/browser-playwright 4.1.11, vitest-browser-svelte 2.2.1, playwright 1.63.0, axe-core 4.13.0"
  - "Phase 1 tooling/vitest/no-network.ts fetch ban"
provides:
  - "Vitest project 'web-browser' (apps/web/vitest.browser.config.ts), part of the root projects list and of pnpm test:unit"
  - "$lib/testing/axe: WCAG_TAGS, axeViolations(root) -> string[] ('id: help')"
  - "$lib/testing/app-paths.stub.ts aliased as $app/paths in both the web and web-browser projects"
  - "CI quality job installs Chromium before pnpm test:unit"
affects: [04-14, 04-15, 04-16, 04-19, 04-20]
tech-stack:
  added: []
  patterns:
    - "Component tests live in src/**/*.browser.test.ts; import page from 'vitest/browser' and render from 'vitest-browser-svelte' (await render(...))"
    - "Every component axe check pairs a clean scan with a planted-violation non-vacuity case"
key-files:
  created:
    - apps/web/vitest.browser.config.ts
    - apps/web/src/lib/testing/app-paths.stub.ts
    - apps/web/src/lib/testing/axe.ts
    - apps/web/src/lib/testing/Spike.svelte
    - apps/web/src/lib/testing/spike.browser.test.ts
  modified:
    - apps/web/vite.config.ts
    - vitest.config.ts
    - .github/workflows/ci.yml
    - scripts/workflow-gate.test.ts
key-decisions:
  - "The shared Node no-network setup file works unchanged in browser mode (Pitfall 14 resolved), so no browser-specific ban file was needed"
  - "The browser config repeats playwright.config.ts's System32 PATH guard so Chromium teardown cannot stall on this machine"
  - "In Vitest 4, 'page' is imported from 'vitest/browser' (not '@vitest/browser/context')"
requirements-completed: [DATA-02]
metrics:
  duration: 12min
  completed: 2026-10-05
  tasks: 2
  files: 9
---

# Phase 4 Plan 08: Browser component test project, axe helper and CI ordering Summary

Svelte 5 components now render in real Chromium through the `web-browser` Vitest project, with the shared network ban active. An `axeViolations` helper scans on the WCAG 2.0/2.1/2.2 A+AA tags. A four-test spike proves that rendering, the fetch ban, a clean axe scan and a planted `image-alt` violation all work together. CI installs Chromium before `pnpm test:unit`.

## Tasks

| Task | Name | Commit |
| --- | --- | --- |
| 1 | web-browser Vitest project, $app/paths stub, axe helper, coexistence spike | e8c9494 |
| 2 | Install Chromium before unit tests in CI (TDD: gate test written first and seen failing) | c94007f |

## Verification

- `corepack pnpm vitest run --project web-browser`: 1 file, 4/4 pass, about 1.5s.
- `corepack pnpm vitest run --project web`: `spike.browser.test.ts` is not listed (grep count 0). The only failures are other wave-2 plans' in-flight RED tests (`cache-repo`, `ledger-repo`, later `fixture-fetch`).
- `corepack pnpm vitest run --reporter=verbose`: the run includes `|web-browser (chromium)|` and all four spike tests pass inside the root run.
- `corepack pnpm check`: 0 errors, 0 warnings. One mid-run error came from a parallel executor's half-written file and cleared on the re-run.
- `corepack pnpm lint`: exit 0.
- Task 2 RED: the new gate test failed against the old ci.yml. GREEN: 23/23 workflow-gate tests pass, `lint:workflows` (actionlint) exits 0, and `grep -c "playwright install --with-deps chromium" ci.yml` = 1.
- Full `pnpm test:unit`: 57/58 files and 1020/1027 tests pass. The 7 failures are all in `src/lib/data/fixtures/fixture-fetch.test.ts`, which belongs to a parallel plan and is not touched by this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Svelte compiler and lint on the planted violation**
- **Found during:** Task 1
- **Issue:** The `<img>` without `alt` that the non-vacuity case needs makes the Svelte compiler warn (`a11y_missing_attribute`). A reason written inline in the `svelte-ignore` comment gets parsed as extra warning codes, which trips `svelte/no-unused-svelte-ignore`.
- **Fix:** I put a plain `<!-- svelte-ignore a11y_missing_attribute -->` on the line before the `<img>` and moved the explanation into a separate comment above it.
- **Commit:** e8c9494

**2. [Rule 3 - Blocking] Windows PATH guard added to the browser config**
- The config prepends the same System32 PATH that `playwright.config.ts` does, following the project convention that Chromium teardown can stall when PATH omits System32. Runs finished cleanly.
- **Commit:** e8c9494

The step-7 fallback (`no-network-browser.ts`) was not needed. The Node setup file is unchanged.

## Notes for later UI plans (04-14, 04-15, 04-16, 04-19, 04-20)

- Name files `*.browser.test.ts` anywhere under `apps/web/src`. Use `await render(Component, { props })`, `page.getByRole(...)` and `expect.element(...)`.
- `axeViolations(container)` should equal `[]`. Contrast is not checked here because no CSS is loaded; the token tests and the E2E axe runs cover it.
- `$app/paths` resolves to the stub (`base = ''`, `resolve(p) = p`) in both test projects.

## Known Stubs

None. `Spike.svelte` is a test fixture by design.

## Self-Check: PASSED
