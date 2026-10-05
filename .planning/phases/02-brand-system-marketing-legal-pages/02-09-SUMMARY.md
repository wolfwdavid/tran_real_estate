---
phase: 02-brand-system-marketing-legal-pages
plan: 09
subsystem: web-app-pages
tags: [portal-placeholder, settings, csp-probe, meta-description, brand]
requires:
  - "02-04: ButtonLink, group-layout chrome with PortalSwitcher, /for-* audience route stubs"
provides:
  - "PortalPlaceholder component (renter/investor/agent copy table, unique title + meta description, secondary ButtonLink to the audience page)"
  - "Branded renter/investor/agent placeholder pages"
  - "Branded Settings placeholder that still carries the Phase 1 csp-transition-toggle / csp-transition-target fade probe"
affects: [06-renter-portal, 07-investor-portal, 08-agent-portal, 03 key vault settings page]
tech-stack:
  added: []
  patterns:
    - "Per-portal copy table with literal resolve('/for-*/') calls so typed routes and the no-navigation-without-resolve lint can trace them"
key-files:
  created:
    - apps/web/src/lib/components/marketing/PortalPlaceholder.svelte
  modified:
    - apps/web/src/routes/(app)/renter/+page.svelte
    - apps/web/src/routes/(app)/investor/+page.svelte
    - apps/web/src/routes/(app)/agent/+page.svelte
    - apps/web/src/routes/(app)/settings/+page.svelte
decisions:
  - "Settings toggle gets aria-expanded so the disclosure state is announced; csp.spec still targets testids only"
metrics:
  duration: "~4 min"
  completed: 2026-10-04
  tasks: 2
  files: 5
requirements: [BRND-05]
---

# Phase 2 Plan 09: Portal Placeholder Pages Summary

Renter, investor and agent pages now share one PortalPlaceholder component with the UI-SPEC copy verbatim, a unique meta description each, and a secondary arrow ButtonLink to `/for-renters/`, `/for-investors/` or `/for-agents/`. Settings is a branded placeholder ("Settings for your API keys arrive in the next release. Nothing is stored yet.") whose "Show what's coming" toggle is still the Phase 1 CSP transition probe.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | PortalPlaceholder and the three portal pages | 8b8b80d | PortalPlaceholder.svelte, (app)/renter, investor, agent +page.svelte |
| 2 | Settings placeholder keeping the CSP transition probe | daa4fcd | (app)/settings/+page.svelte |

## Verification

- `corepack pnpm lint`, `corepack pnpm banned`: pass. `svelte-check`: 0 errors, 0 warnings after Task 2. During Task 1 it showed 3 errors, all in `src/lib/content/audiences.test.ts`. That file belongs to a parallel executor's in-progress RED test, not this plan.
- With the build lock held: `build:root`, `build:sub`, and `csp:assert` passed (14 pages in each build). The full `test:e2e` run passed 48 of 48 across the root and sub projects. That run includes the csp spec "a Svelte transition and an inline style attribute run without a style-src-attr violation", axe on renter/investor/agent/settings, and the routing h1 checks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Accessibility] aria-expanded on the Settings toggle**
- **Found during:** Task 2
- **Issue:** The toggle shows and hides a panel but did not expose its state to assistive tech.
- **Fix:** Added `aria-expanded={open}`. Testids and `transition:fade` are unchanged.
- **Files modified:** apps/web/src/routes/(app)/settings/+page.svelte
- **Commit:** daa4fcd

## Known Stubs

These pages are intentional placeholders, as planned. Phases 6 to 9 replace the portal tools, and the Phase 3 key vault replaces Settings. The copy says plainly that the tools are being built.

## Self-Check: PASSED
