---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 11
subsystem: agent-portal/shell
tags: [agent, navigation, routing, prerender, csp, e2e, a11y]
requires:
  - "08-01 agent contracts (feature folder)"
  - "08-03 CSP img-src blob: and agent banned-terms list"
provides:
  - "AgentNav (nav aria-label='Agent tools'): Today, Pipeline, Contacts, Import, Profile; optional dueCount pill"
  - "(app)/agent/+layout.svelte: AgentNav container, then a mt-8 page slot"
  - "Six prerendered skeleton routes: /agent/today|pipeline|contacts|contact|import|profile/"
  - "Data source status bar hidden on /agent/* (route-id match; a future /agent/studio/ is exempt)"
  - "AGENT_ROUTES in tests/e2e/routes.ts (in ROUTES and PORTAL_ROUTES); EXPECTED_PAGES +6 (31 per base)"
  - "agent-shell.spec.ts"
affects: [08-13 public inquiry route, 08-15 SampleContactsNotice, 08-21 Today count, 08-23 contact detail, 08-24 profile, every wave-5 agent page plan, Phase 9 studio nav]
tech-stack:
  added: []
  patterns:
    - "Current nav item from page.route.id (prerender-safe under both bases), as RenterNav/PortalSwitcher"
    - "Layout owns the nav container; each page owns its own max-w-page container"
    - "SSR structural component test with a hoisted $app/state mock (RenterNav precedent)"
key-files:
  created:
    - apps/web/src/lib/features/agent/ui/AgentNav.svelte
    - apps/web/src/lib/features/agent/ui/AgentNav.test.ts
    - apps/web/src/routes/(app)/agent/+layout.svelte
    - apps/web/src/routes/(app)/agent/today/+page.svelte
    - apps/web/src/routes/(app)/agent/pipeline/+page.svelte
    - apps/web/src/routes/(app)/agent/contacts/+page.svelte
    - apps/web/src/routes/(app)/agent/contact/+page.svelte
    - apps/web/src/routes/(app)/agent/import/+page.svelte
    - apps/web/src/routes/(app)/agent/profile/+page.svelte
    - apps/web/tests/e2e/agent-shell.spec.ts
  modified:
    - apps/web/src/routes/(app)/+layout.svelte
    - apps/web/src/lib/components/marketing/PortalPlaceholder.svelte
    - apps/web/svelte.config.js
    - apps/web/tests/e2e/routes.ts
    - apps/web/tests/e2e/data-status.spec.ts
    - apps/web/tests/e2e/app-notice.spec.ts
    - apps/web/tests/e2e/app-notice-locked.spec.ts
    - scripts/assert-csp.mjs
    - scripts/assert-csp.test.ts
decisions:
  - "AgentNav marks the current item by route id, not page.url.pathname vs resolve(): resolve() is relative while prerendering, so the pathname comparison would miss in static HTML"
  - "DataStatusBar existed (Phase 4 DataShell showStatusBar); hidden for /(app)/agent and /(app)/agent/*, except /(app)/agent/studio[/*]"
  - "/agent/contact/ added to prerender.entries (linked only from client-rendered lists)"
  - "AGENT_ROUTES joins PORTAL_ROUTES too, so layout.spec checks the Portals switcher marks Agent aria-current=true on every agent sub-page"
  - "Titles use the &middot; entity to keep sources ASCII; the rendered titles are the exact UI-SPEC strings (E2E asserts them)"
  - "Agent home title changed from 'Agent portal - ...' (em dash) to 'Agent portal: Tran Real Estate Tools' per the UI-SPEC Routes table"
metrics:
  duration: ~35min
  completed: 2026-10-06
  tasks: 2
  files: 19
---

# Phase 8 Plan 11: Agent portal shell Summary

AgentNav ("Agent tools", five links in fixed order, route-id current marking, optional Today due pill read as "Today, 3 tasks due"), the `(app)/agent` layout, six prerendered skeleton pages with exact h1/title/description, the Data source bar hidden across the agent CRM, and every shared route registry (routes.ts, EXPECTED_PAGES with the count pin, prerender.entries) updated once.

## What was built

- **AgentNav** (`features/agent/ui/AgentNav.svelte`): `<nav aria-label="Agent tools">`, `flex flex-wrap gap-x-2 sm:gap-x-4`, links `min-h-11 px-2 sm:px-4`, current link gets `aria-current="page"`, weight 600 and a 2px primary underline at 6px offset (the PortalSwitcher/RenterNav treatment). `/agent/contact/` marks Contacts; `/agent/` marks none. `dueCount > 0` (integer) renders an `aria-hidden` accent-surface pill plus a `sr-only` ", N tasks due" / ", 1 task due" suffix. Five `resolve()` calls, no hard-coded hrefs. 16 SSR unit tests.
- **Agent layout**: AgentNav in a `max-w-page` container (pt-6), then a `mt-8` wrapper around the page. It inherits the `(app)` layout's `DataShell` + `AppNotice`.
- **Skeleton pages**: Today, Pipeline, Contacts, Contact, Import leads, Your profile. Each has the UI-SPEC `<title>`, a unique meta description, the Display h1 and a muted Label "Loading your contacts..." line ("Loading your profile..." on Profile). Profile does not link to `/agent/inquire/` yet.
- **Data source bar**: existed (Phase 4). `(app)/+layout.svelte` now hides it for the agent home and sub-pages by route id, keeping a future `/agent/studio/` visible.
- **Registries**: `AGENT_ROUTES` in `ROUTES` + `PORTAL_ROUTES`; `EXPECTED_PAGES` has the six pages and `assert-csp.test.ts` pins them plus the total (31); `prerender.entries` has `/agent/contact/` (only that key touched).
- **agent-shell.spec.ts**: per route h1, title, nav order, single `aria-current="page"`, no Studio, no Data source bar, base-correct hrefs, and the agent home's nav with no current item. Also client-side navigation updates the current item, and at 375px: `scrollWidth <= 375`, two rows, all links in the viewport.

## Verification

- `pnpm --filter web check` 0 errors; eslint/prettier clean on touched files; `pnpm banned` and `pnpm ui:guard` pass.
- `build:root` and `build:sub` green; `csp:assert` passed for **31 pages** in both builds.
- Playwright (both bases): agent-shell, routing, routes-drift, layout, marketing, a11y, csp, data-status, app-notice and app-notice-locked all pass. The full first run was 738 passed. The only non-agent-shell failures were two sub-base transients ("500: Something went wrong" on `renter/shortlist/`), and they passed on a clean rerun.
- `scripts/assert-csp.test.ts` 82/82; `AgentNav.test.ts` 16/16.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `/agent/contact/` in `prerender.entries` landed in Task 1, not Task 2**
- `handleUnseenRoutes: 'fail'` would fail Task 1's `build:root` without it.
- Commit: 9fe1523

**2. [Rule 1 - Bug] Phase 3/4 E2E asserted the Data source bar on `agent/`**
- `data-status.spec.ts` moved `agent/` to the "no bar" list. `app-notice.spec.ts` and `app-notice-locked.spec.ts` now expect AppNotice as main's first child on `agent/`.
- Commit: 9fe1523

**3. [Rule 1 - Spec reconciliation] 375px wrap split**
- The UI-SPEC illustrates two rows as "Today · Pipeline · Contacts / Import · Profile". With real label widths at 375px the split is 4 + 1 (Profile on row two). The binding contract still holds: two rows, nothing hidden, no horizontal scroll. The spec asserts exactly two rows in reading order with every link in the viewport, rather than forcing a break. The break also moves once the Today pill appears.
- Commit: 5b69a9f

**4. Plan named `scripts/assert-csp.mjs` only; the page-count pin lives in `scripts/assert-csp.test.ts`**
- Updated both in the same commit, as the orchestrator instructed.

**5. Agent home title**
- `PortalPlaceholder`'s agent `docTitle` was "Agent portal — Tran Real Estate Tools" (Phase 2). Per the plan's conditional it is now "Agent portal: Tran Real Estate Tools".

## Known Stubs

These are intentional skeletons. Later plans fill them, as the plan objective states:
- `routes/(app)/agent/{today,pipeline,contacts,contact,import}/+page.svelte`: static "Loading your contacts..." line (filled by the wave-5 page plans; 08-23 replaces the Contact h1 with the contact's name).
- `routes/(app)/agent/profile/+page.svelte`: "Loading your profile..." line (08-24 adds the form and the inquiry preview link).
- `(app)/agent/+layout.svelte`: AgentNav renders without `dueCount` (08-21 wires the live count; 08-15 inserts SampleContactsNotice).

## Self-Check: PASSED
