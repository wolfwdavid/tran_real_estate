---
phase: 10-launch-hardening-go-to-market
plan: 03
subsystem: tooling/guardrails
tags: [eslint, boundaries, banned-terms, marketing-budget]
requires: ["10-01"]
provides:
  - "lib/analytics fetch allowlist (beacon is the only new fetch)"
  - "MARKETING_SAFE import boundary (tools, onboarding, forms, seo, analytics, content, shared/affordability)"
  - "(marketing) routes fenced from portal features"
  - "banned-terms SCOPE covers apps/web/src/lib/seo"
affects: [10-04, 10-05, 10-06, 10-07, 10-08, 10-09]
tech-stack:
  added: []
  patterns:
    - "One no-restricted-imports block per file set, placed last for that set (flat config replaces options)"
key-files:
  created: []
  modified:
    - eslint.config.js
    - scripts/eslint-rules.test.ts
    - scripts/lib/banned-terms-rules.mjs
    - scripts/banned-terms.test.ts
decisions:
  - "Phase 6 affordability boundary block folded into the MARKETING_SAFE block (no duplicate rule blocks); message keeps 'marketing page' so the Phase 6 tests still bind"
  - "MARKETING_SAFE block repeats MAP_LIBS only; forbid(['data']) already subsumes DATA_INTERNALS"
  - "Banned-terms SCOPE only gains lib/seo: shared/affordability, lib/components (tools/onboarding/forms) and lib/content were already in scope"
requirements: [GTM-01, GTM-02, GTM-03, GTM-04]
metrics:
  duration: "~12 min"
  completed: 2026-10-13
  tasks: 2
  files: 4
---

# Phase 10 Plan 03: Phase 10 lint boundaries and banned-terms scope Summary

The analytics beacon folder joins the fetch allowlist. A single MARKETING_SAFE ESLint block fences the Phase 10 folders (calculators, onboarding, forms, SEO, analytics, content, and the shared affordability calculator) from storage, AI, data and portal features. Marketing routes can no longer import a portal feature. The banned-terms copy gate now scans `lib/seo`. Rule tests prove each boundary fires where it should and stays silent where it should not.

## Tasks

| Task | Name | Commits |
| ---- | ---- | ------- |
| 1 | Fetch allowlist for lib/analytics + marketing-safe import boundary | dc5f1b2 (RED), 2513ae9 (GREEN) |
| 2 | Banned-terms scope covers the new copy folders | 810b1d1 (RED), a91950b (GREEN) |

## What changed

- `eslint.config.js`:
  - Added `${WEB}/lib/analytics/**` to the fetch-allowlist block.
  - Both `noFetch` messages now read "fetch is allowed only in adapter folders (lib/data/rentcast, lib/ai/providers, lib/leads, lib/analytics)."
  - New `MARKETING_SAFE` and `MARKETING_FORBIDDEN` constants.
  - The `(marketing)` block forbids `storage`, `ai`, `data` and `features/renter|investor|agent`. `features/shared` stays importable.
  - The MARKETING_SAFE block replaces the old Phase 6 affordability block in the same position, after the per-portal, studio, public and features/shared blocks. It is the last `no-restricted-imports` entry for those files, and it re-states MAP_LIBS.
- `scripts/eslint-rules.test.ts`: added a `Phase 10 boundaries` describe block (17 cases). It covers:
  - beacon fetch is silent; a WaitlistForm `fetch` raises exactly one error.
  - a CapRateCalculator importing storage or a portal feature is rejected; importing `@tran/core` is allowed.
  - imports into onboarding-state, SeoHead, content/tools and AffordabilityCalculator are rejected.
  - a storage/ai/data/leaflet sweep across the marketing-safe folders.
  - forms may import lib/leads.
  - a marketing route importing a portal feature is rejected; importing shared affordability or ToolPage is allowed.
  - regression: portals can still import their own features and features/shared.
- `scripts/lib/banned-terms-rules.mjs`: `SCOPE` gains `'apps/web/src/lib/seo'`.
- `scripts/banned-terms.test.ts`: added a SCOPE-membership test and a non-vacuity test (a temp tree where `lib/seo/x.ts` contains "guaranteed" makes the CLI exit 1).

## Verification (real output)

- RED, Task 1: `vitest run --project scripts eslint-rules` gave 10 failed / 85 passed. Some new cases already passed because existing rules covered them (data internals, the forms fetch ban).
- GREEN, Task 1: `vitest run --project scripts eslint-rules` gave **95 passed (95)**.
- RED, Task 2: 2 failed / 133 passed. GREEN, Task 2: **135 passed (135)**.
- `corepack pnpm banned`: "Banned-terms check passed (384 files)", exit 0.
- `corepack pnpm lint` (prettier --check + eslint .): exit 0. An earlier run hit a Prettier warning on `packages/core/src/finance/calculators.test.ts`. That file belongs to a parallel executor and was in progress at the time; the later run was clean.
- Full `vitest run --project scripts`: **16 files, 560 tests passed**.
- None of these steps needs the build lock (no build or E2E), so the lock was never acquired.

## Deviations from Plan

None. The plan was executed as written.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: eslint.config.js (contains `lib/analytics/**`, `MARKETING_SAFE`, `lib/components/onboarding/**`, `lib/components/forms/**`, `lib/seo/**`, `features/${p}` via PORTAL_FOLDERS)
- FOUND commits: dc5f1b2, 2513ae9, 810b1d1, a91950b
