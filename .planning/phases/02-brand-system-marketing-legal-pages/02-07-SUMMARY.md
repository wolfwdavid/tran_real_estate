---
phase: 02-brand-system-marketing-legal-pages
plan: 07
subsystem: marketing
tags: [svelte, content, audience-pages, banned-terms, lucide]
requires:
  - phase: 02-04
    provides: ButtonLink, (marketing) group layout, audience route stubs
  - phase: 02-02
    provides: scripts/lib/banned-terms-rules.mjs (findBanned)
provides:
  - "$lib/content/audiences.ts: typed renter/investor/agent copy (Audience, Feature, FeatureIcon, PortalId)"
  - "$lib/components/marketing/AudiencePage.svelte: shared audience template"
  - "/for-renters/, /for-investors/, /for-agents/ rendered from one template"
affects: [02-home-page, 04-sample-mode (Try sample data CTA target), 10-launch]
tech-stack:
  added: []
  patterns:
    - "Marketing copy in typed $lib/content modules, tested against findBanned with a planted-claim control"
    - "Portal-keyed map of typed resolve() literals instead of a template-string resolve()"
    - "Lucide icon lookup via Record<FeatureIcon, typeof Search> and {@const Icon = ...}"
key-files:
  created:
    - apps/web/src/lib/content/audiences.ts
    - apps/web/src/lib/content/audiences.test.ts
    - apps/web/src/lib/components/marketing/AudiencePage.svelte
  modified:
    - apps/web/src/routes/(marketing)/for-renters/+page.svelte
    - apps/web/src/routes/(marketing)/for-investors/+page.svelte
    - apps/web/src/routes/(marketing)/for-agents/+page.svelte
key-decisions:
  - "Both audience CTAs point at the portal root until Phase 4 sample mode ships"
  - "The 'Good to know' h2 is a literal in the template; limitsHeading stays in the type as a literal-typed guard"
requirements-completed: [BRND-02]
duration: 6min
completed: 2026-10-05
---

# Phase 2 Plan 07: Audience Pages Summary

**One typed content module (`$lib/content/audiences.ts`) drives a shared `AudiencePage` template that renders For Renters, For Investors and For Agents, each with 4 Lucide feature cards, a "Good to know" limits callout and Open-portal / Try-sample-data CTAs.**

## Performance

- **Duration:** about 6 min
- **Completed:** 2026-10-05
- **Tasks:** 2
- **Files:** 3 created, 3 modified

## Accomplishments

- All audience copy is verbatim from the UI-SPEC, in one typed module under `$lib/content` (not `$lib/data`).
- 5 Vitest tests cover the key set, 4 features and 3 limits per audience, no empty strings, the docTitle suffix and slug, the banned-terms pass, and a planted "guaranteed returns" control that must fail.
- `AudiencePage.svelte` owns `<svelte:head>` (title and description), a single h1, the features grid (1 column, 2 from md up), the `border-l-4` secondary limits callout and the surface closing band.
- Route pages are 6-line wrappers: `<AudiencePage audience={audiences.renter|investor|agent} />`.

## Task Commits

1. **Task 1 (TDD RED): failing audience content tests**: `292c906` (test)
2. **Task 1 (GREEN): typed audience content**: `197982b` (feat)
3. **Task 2: shared audience template and three audience pages**: `f01fc66` (feat)

## Verification

- `corepack pnpm check`: 0 errors, 0 warnings. `lint` and `banned` (35 files) pass.
- `corepack pnpm test:unit`: 14 files, 205 tests pass.
- `build:root`, `build:sub` and `csp:assert` (14 pages each) pass.
- `playwright test a11y csp routing`: 40 passed. Full `test:e2e`: 48 passed. All runs held the shared build lock, which was then released.
- Built HTML: "Try sample data" appears in build/for-investors, "Open agent portal" in build-sub/for-agents, and build/for-renters has exactly one `<h1`.
- All 12 Lucide icons exist in @lucide/svelte 1.45.0, so no substitutions were needed.

## Deviations from Plan

None. The plan ran as written.

## Known Stubs

- "Try sample data" links to the same portal root as "Open {portal} portal". This is intentional per CONTEXT: sample mode arrives in Phase 4, which should point this CTA at the sample-mode entry.

## Self-Check: PASSED

- FOUND: apps/web/src/lib/content/audiences.ts, audiences.test.ts, components/marketing/AudiencePage.svelte
- FOUND commits: 292c906, 197982b, f01fc66
