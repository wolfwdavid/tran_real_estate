---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 09
subsystem: agent-studio/shell
tags: [agent, studio, routing, prerender, csp, navigation, data-status, e2e]
requires:
  - phase: 02
    provides: "shared e2e routes.ts, routes-drift guard, assert-csp EXPECTED_PAGES"
  - phase: 04
    provides: "DataShell / DataStatusBar (showStatusBar)"
  - phase: 08
    provides: "AgentNav, (app)/agent layout, profile page, isAgentCrm runAlerts gate (08-27)"
provides:
  - "Six prerendered skeleton routes: /agent/studio/, /agent/studio/listing|social|reel|snapshot/, /print/snapshot/"
  - "STUDIO_ROUTES and PRINT_SNAPSHOT in tests/e2e/routes.ts (in ROUTES, PORTAL_ROUTES, PRINT_ROUTES); EXPECTED_PAGES 38"
  - "AgentNav sixth link Studio, current on every /agent/studio/* route (route-id prefix match)"
  - "Data source bar on /agent/studio/snapshot/ only; runAlerts still on for every Studio route"
  - "Sample contacts notice skipped on Studio routes"
  - "Profile 'Create Market Snapshot' outline link (ChartColumn 16px) to /agent/studio/snapshot/"
  - "studio-shell.spec.ts"
affects: [09-12 hub cards, 09-15 listing, 09-17 social, 09-21 reel, 09-22 snapshot builder, 09-18 snapshot print, 09-23 phase gate]
tech-stack:
  added: []
  patterns:
    - "Studio routes kept out of AGENT_ROUTES so the Phase 8 CRM specs keep walking only CRM pages"
    - "Route-walk E2E tests budget their timeout as ROUTES.length * 4 s"
key-files:
  created:
    - apps/web/src/routes/(app)/agent/studio/+page.svelte
    - apps/web/src/routes/(app)/agent/studio/listing/+page.svelte
    - apps/web/src/routes/(app)/agent/studio/social/+page.svelte
    - apps/web/src/routes/(app)/agent/studio/reel/+page.svelte
    - apps/web/src/routes/(app)/agent/studio/snapshot/+page.svelte
    - apps/web/src/routes/(print)/print/snapshot/+page.svelte
    - apps/web/tests/e2e/studio-shell.spec.ts
  modified:
    - apps/web/tests/e2e/routes.ts
    - scripts/assert-csp.mjs
    - scripts/assert-csp.test.ts
    - apps/web/svelte.config.js
    - apps/web/src/lib/features/agent/ui/AgentNav.svelte
    - apps/web/src/lib/features/agent/ui/AgentNav.test.ts
    - apps/web/src/routes/(app)/+layout.svelte
    - apps/web/src/routes/(app)/agent/+layout.svelte
    - apps/web/src/routes/(app)/agent/profile/+page.svelte
    - apps/web/tests/e2e/agent-shell.spec.ts
    - apps/web/tests/e2e/routing.spec.ts
    - apps/web/tests/e2e/csp.spec.ts
    - apps/web/tests/e2e/layout.spec.ts
key-decisions:
  - "Data bar gate uses route ids, not base-stripped pathnames: showStatusBar = not settings, not isAgentCrm, and (not Studio or id === '/(app)/agent/studio/snapshot'). runAlerts stays !isAgentCrm, so every Studio route keeps the check-on-open pass"
  - "STUDIO_ROUTES is separate from AGENT_ROUTES (joins ROUTES and PORTAL_ROUTES); print/snapshot/ joins PRINT_ROUTES so it is chrome-exempt like print/memo/"
  - "/agent/studio/ and /print/snapshot/ also listed in prerender.entries (Planner Note 11) so later plans can render the hub links however they like"
  - "The Sample contacts notice is skipped on Studio routes (09-UI-SPEC: it is about contacts)"
requirements-completed: []
duration: 2h05m
completed: 2026-10-07
---

# Phase 9 Plan 09: Studio and snapshot print route shell Summary

**Six prerendered Studio and snapshot-print skeleton routes, listed once in every route list. AgentNav gains a sixth Studio link, the RentCast data bar shows on the snapshot builder only (the saved-search check still runs on every Studio route), and the profile page links to Create Market Snapshot.**

## Performance

- **Duration:** about 2h05m (single core, with eight other executors running)
- **Started:** 2026-10-07T08:20Z
- **Completed:** 2026-10-07T10:25Z
- **Tasks:** 2 (plus two test-budget and test-pin follow-ups)
- **Files:** 7 created, 13 modified

## Accomplishments

- Hub `/agent/studio/`: h1 Studio, the exact lead line, static links in this order: "Write a listing description", "Write a post pack", "Write a reel script", "Build a Market Snapshot", then "Preview a sample report" (`${resolve('/print/snapshot/')}?id=sample`).
- Each tool route has its UI-SPEC title, a ghost back link "Studio" (ArrowLeft 16px, h-11) to the hub above the h1, and a muted "Loading your studio…" line.
- `/print/snapshot/` renders in the chrome-free (print) layout with h1 "Market Snapshot", "Preparing your printout…" and title "Market Snapshot · Tran Real Estate Tools". It has no gateway or `lib/data` import (grep is empty).
- routes.ts has `STUDIO_ROUTES` (5 routes) and `PRINT_SNAPSHOT`. EXPECTED_PAGES +6 (38 per base). The routes-drift, routing, csp, a11y and layout suites now cover all six.
- AgentNav: Studio comes after Profile and is current (aria-current="page", weight 600, primary underline) on the hub and on all four tools. The five earlier links are unchanged in order and markup. At 375px the nav still wraps to two rows.
- The (app) layout shows the Data source bar only on `/agent/studio/snapshot/`. The 08-27 `runAlerts = !isAgentCrm(...)` gate is unchanged: CRM routes skip the saved-search pass, and Studio routes keep it (an E2E proves the pass runs on a full load of `/agent/studio/listing/`).
- Profile: a "Create Market Snapshot" outline link (ChartColumn 16px; the icon exists in @lucide/svelte 1.45.0) sits under the BrandPreview caption.

## Task Commits

1. **Task 1: six prerendered route skeletons and the route lists**: `85c1bd7` (feat)
2. **Task 1 follow-up: EXPECTED_PAGES length pin**: `03905a6` (fix)
3. **Task 2: Studio nav link, snapshot-only data bar, profile link, studio-shell.spec**: `7861269` (feat)
4. **Layout route-walk budget**: `59cc5d5` (test)

All commits used `git commit -- <explicit paths>`. None of my files had already been committed by another executor.

## Verification

- `pnpm check`: 0 errors on the final tree. One earlier run failed on another executor's in-progress `PrintReport.test.ts`; that file is not mine.
- Scoped prettier and eslint on every touched file: clean. `pnpm banned`: passed (348 files). `pnpm ui:guard`: passed (79 files).
- vitest `AgentNav.test.ts` + `scripts/assert-csp.test.ts`: 105 passed.
- `build:root` and `build:sub` both pass with `handleUnseenRoutes: 'fail'`. `csp:assert`: 38 pages per base.
- Playwright (`--workers=1`):
  - routing + csp + routes-drift, both projects: 24 passed
  - a11y.spec root: 77 passed; sub: 28 + 49 passed
  - studio-shell + agent-shell root: 18 (studio-shell rerun after locator fixes) + 22 passed; with routes-drift on sub: 42 passed
  - agent-shell + agent-live-key + agent-no-rentcast + agent-profile + data-status root: 44 passed, 1 timeout (see Issues)
  - agent-no-rentcast root: passed on rerun with `--timeout=100000`
  - agent-a11y + agent-profile-brand + routing root: 46 passed
  - layout root: 220 passed + the route walk (fixed in `59cc5d5`). The route walk then passed on both projects (2). layout sub: 114 + 106 passed.
  - agent-live-key + agent-a11y sub: 37 passed. agent-no-rentcast sub: passed on rerun with `--timeout=100000`.
- `apps/web/test-results` deleted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added the hub and printout to prerender.entries**
- **Found during:** Task 1
- **Issue:** Before Task 2's nav link exists, nothing links to `/agent/studio/`, so the Task 1 commit could not build with `handleUnseenRoutes: 'fail'`.
- **Fix:** Added `'/agent/studio/'` and `'/print/snapshot/'` to `apps/web/svelte.config.js` prerender.entries, as Planner Note 11 allows. No concurrent plan lists this file.
- **Commit:** `85c1bd7`

**2. [Rule 3 - Blocking] Route-walk tests outgrew the 30 s default**
- **Found during:** Task 1 and Task 2 verification
- **Issue:** On one core each page takes about 2 s (probed for all 38 routes). That pushed the single-test walks over 30 s: routing (2 tests), csp "every route", and layout "same-origin requests".
- **Fix:** `test.setTimeout(ROUTES.length * 4_000)` on those four tests only.
- **Files:** routing.spec.ts, csp.spec.ts, layout.spec.ts
- **Commits:** `85c1bd7`, `59cc5d5`

**3. [Rule 1 - Bug] assert-csp.test.ts pinned the EXPECTED_PAGES length at 32**
- **Fix:** The Phase 8 pin keeps its page list. A new Phase 9 pin checks the six new pages and length 38.
- **Commit:** `03905a6`

**4. [Rule 2 - Spec] Sample contacts notice kept off Studio routes**
- **Issue:** The agent layout rendered the notice on every /agent/* route. 09-UI-SPEC says it does not render on Studio routes.
- **Fix:** `{:else if !inStudio}` in `(app)/agent/+layout.svelte`. An E2E navigates client-side with sample contacts loaded and checks the notice is gone in the Studio and back on Pipeline.
- **Commit:** `7861269`

**5. Updated Phase 8 tests for the sixth link**
- `AgentNav.test.ts` now expects six links, checks Studio is current on all five Studio ids, and adds a `/(app)/agent/studiox` control for the prefix match.
- `agent-shell.spec.ts` now expects NAV_ORDER with Studio, the studio href, and 6 link tops at 375px. Its "no Studio" assertions were removed.
- **Commit:** `7861269`

**Plan wording vs implementation:** the plan said to gate the data bar on the "base-stripped pathname". I used route ids instead, as Phase 8 does, because `resolve()` is relative during prerender. The layout comment names `/agent/studio/snapshot/`, so the acceptance grep still matches.

## Issues Encountered

- `agent-no-rentcast.spec.ts` (Phase 8, `test.slow()` = 90 s) timed out once on root and once on sub, at different steps (clicking the draft button, a fill). It passed on both projects with `--timeout=100000`. The spec walks only CRM routes (AGENT_ROUTES, unchanged), so this plan does not change its workload. It is a load-sensitive budget on a shared single core. I did not change it; the 09-23 gate may want to raise its budget.

## Known Stubs

These skeleton bodies are intentional and filled by later plans:
- Tool routes show "Loading your studio…" (filled by 09-15/17/21/22).
- `/print/snapshot/` shows "Preparing your printout…" (filled by 09-18).
- The hub's plain link list is replaced by StudioToolCards in 09-12, which keeps the same hrefs.

## Requirements

STU-01..04 are not marked complete. Per the briefing, the 09-23 phase gate closes the requirement ids.

## Self-Check: PASSED
