---
phase: 10-launch-hardening-go-to-market
plan: 15
subsystem: marketing/onboarding
tags: [onboarding, landing, gtm, a11y, localStorage, bundle-budget]
requires: ["10-03 (marketing-safe lint boundary)", "10-11 (SeoHead on landing)", "Phase 3 announce()", "Phase 2 ButtonLink"]
provides:
  - "onboarding-state.ts: ONBOARDING_KEY 'tran.onboarding.v1', OnboardingState, parseOnboarding, readOnboarding, writeOnboarding"
  - "content/onboarding.ts: ONBOARDING_COPY { guide, tours, setup, settings } + named GUIDE_COPY, TOURS, SETUP_COPY, SETTINGS_COPY, GUIDE_INTRO_COPY"
  - "content/onboarding-guide.ts: GUIDE_INTRO_COPY (landing-initial subset)"
  - "GetStartedGuide (#get-started) on the landing, lazy TourPanel, PortalTile, TourProgress"
affects: ["10-16 (setup route + ?source=sample)", "10-18 (Settings Getting started)", "10-20 (guide E2E)", "10-22 (audit guide/tour axe group)"]
tech-stack:
  added: []
  patterns: ["localStorage pref outside Dexie for marketing routes", "dynamic import() of interaction-only UI to protect the landing JS budget", "module split so Rollup keeps lazy copy out of the initial chunk"]
key-files:
  created:
    - apps/web/src/lib/components/onboarding/onboarding-state.ts
    - apps/web/src/lib/components/onboarding/onboarding-state.test.ts
    - apps/web/src/lib/components/onboarding/GetStartedGuide.svelte
    - apps/web/src/lib/components/onboarding/TourPanel.svelte
    - apps/web/src/lib/components/onboarding/PortalTile.svelte
    - apps/web/src/lib/components/onboarding/TourProgress.svelte
    - apps/web/src/lib/components/onboarding/guide-buttons.ts
    - apps/web/src/lib/content/onboarding.ts
    - apps/web/src/lib/content/onboarding-guide.ts
    - apps/web/tests/e2e/guide.spec.ts
  modified:
    - apps/web/src/routes/(marketing)/+page.svelte
    - apps/web/tests/e2e/marketing.spec.ts
decisions:
  - "Onboarding state is NOT registered in the backup registry: the registry lists Dexie tables only (contract map 'Non-Dexie localStorage key: NO'). The value holds no personal data."
  - "Tour steps 1-3 are a lazily imported TourPanel. The landing prerenders step 0 only, so the tour is never needed on first paint. A stored 'touring' state loads the panel in onMount before rendering it."
  - "Landing-initial guide strings live in content/onboarding-guide.ts (re-exported by content/onboarding.ts). Rollup chunks per module, so a single copy module shared by the guide and the lazy panel pulled all the tour copy into the landing's initial JS."
  - "The /setup/rentcast/ link is built as `${resolve('/')}setup/rentcast/?portal=…` because the route does not exist yet (10-16), so typed resolve() would fail svelte-check. 10-16 can switch it to resolve('/setup/rentcast/')."
  - "Hero 'Show me around' handling: a document click listener catches same-hash clicks (no hashchange fires), hashchange catches back/forward, and afterNavigate focuses the h2 on arrival at /#get-started (it runs after SvelteKit's focus reset)."
  - "'Change portal' (Back on step 1) returns to step 0 and focuses the guide h2, because step 0 has no h3."
requirements-completed: [GTM-01]
metrics:
  duration: "~1h45m wall (about 45 min of it waiting on the shared build lock)"
  completed: 2026-10-13
  tasks: 2
  files: 12
---

# Phase 10 Plan 15: Inline Get started guide Summary

The landing now has an inline, modal-free Get started guide. A visitor picks Renter, Investor or Agent, then takes a 3-step tour that ends in Try sample data (`/{portal}/?source=sample`) or Connect a free RentCast key (`/setup/rentcast/?portal=…`). Agents get Start with an empty pipeline (`/agent/`) instead. State is stored in localStorage `tran.onboarding.v1`, with a strict whitelist parse. The prerendered HTML is step 0, and the tour panel is lazy-loaded.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Onboarding state module and copy (TDD) | f4c25fd (RED test), 2de1b55 (GREEN) |
| 2 | GetStartedGuide and landing integration | 38b8927, cf028ab (perf: copy split) |
| - | Deferred-items log | cf5dfd7 |

## Verification (real output)

- `vitest run --project web onboarding-state`: 6/6 passed. Full web unit project: 176 files, 2617 tests passed.
- `svelte-check`: 0 errors, 0 warnings. `pnpm check` failed twice early on because of other executors' in-progress files, then passed on rerun. eslint on all touched files: clean. `pnpm lint` (full, prettier + eslint) exit 0 on the first Task 2 version; later edits re-checked with prettier + eslint on the touched files. `pnpm banned`: passed (440 files).
- `build:root`, `build:sub`, `build:configured`: all exit 0. `csp:assert`: passed for 42 pages × 3 builds.
- `grep -c "Where do you want to start?" apps/web/build/index.html` → 1 (the first-visit state is prerendered).
- `node scripts/assert-budget.mjs apps/web/build --require-tools`: **landing `index.html` 57.9 KB gz JS (REPORT)**, 11.8 KB CSS. The tool pages pass (59.8 / 59.9 / 59.9, hub 51.8). Measured in the same tree, the landing was 54.9 KB without the guide. The first version of the guide made it 59.2, and the lazy panel plus the copy split brought it to 57.9, so the guide costs about 3.0 KB gz of initial JS. The tour copy is confirmed absent from every script the landing loads initially.
- `assert-seo --target root --min-urls 13`: fails with `sitemap.xml: 12 URLs, expected at least 13`. That is the known pending sitemap entry (feedback page, 10-17/10-14 territory). It is not caused by this plan, because the landing was already in the sitemap.
- E2E, root+sub: guide.spec + marketing.spec 124/124 passed. a11y + routing + layout + seo + csp + routes-drift: 714/714 passed (this includes handleMissingId for `#get-started` and the 375px axe sweep).
- Full E2E in 4 shards: 622+1F / 385+1F / 537+1F / 321 passed. Failures:
  - `investor/buybox.spec.ts:217` and `renter-saved.spec.ts:83`: load flakes. Both passed in isolation (6/6 and 3/3).
  - `agent-inquire.spec.ts:48`: deterministic duplicate `noindex` meta on /agent/inquire/ (10-11's group layout plus the page's own tag). This predates 10-15, was already logged by 10-13/10-19, and I re-confirmed it in deferred-items.md.

## Guide axe tests (10-22 naming contract)

`tests/e2e/guide.spec.ts` has the titles `axe guide: step 0 …`, `axe tour: {renter|investor|agent} tour steps 1-3 …` and `axe guide: hide moves focus to the compact row …`. Each one runs axe (WCAG 2.0/2.1/2.2 A/AA) scoped to `#get-started`, on root and sub. The spec also covers: no dialog/inert, nothing focused on load, h3 focus on every step, exit hrefs, persisted JSON `{"status":"done","lastPortal":"renter"}` after Try sample data, compact row after reload, and hero Show me around resetting and focusing the h2 (including a second same-hash click).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing landing E2E asserted the old hero CTA**
- **Found during:** Task 2
- **Issue:** `marketing.spec.ts` expected a link "How it works" → `#how-it-works`, which the plan replaces.
- **Fix:** Now asserts "Show me around" → `#get-started`, and that both `#get-started` and `#how-it-works` exist. Only my hunk was in the file when I committed. Another agent's earlier hunk had already been committed.
- **Commit:** 38b8927

**2. [Rule 2 - Performance budget] Tour panel lazy-loaded and copy split**
- **Found during:** Task 2 budget check (landing at 59.2 of 60 KB gz)
- **Fix:** Added `TourPanel.svelte` (dynamic import), `guide-buttons.ts` (shared button classes) and `content/onboarding-guide.ts`. GetStartedGuide still builds every href (`?source=sample`, `/setup/rentcast/`), so the acceptance greps hold.
- **Acceptance-grep impact:** "New here, or want a refresher?" is now in `content/onboarding-guide.ts`, not `content/onboarding.ts`. `onboarding.ts` re-exports it, and `ONBOARDING_COPY.guide` includes it. All the other listed strings are still in `onboarding.ts`.
- **Commits:** 38b8927, cf028ab

**3. [Plan-sanctioned] Not registered in the backup registry**
- The contract map says the registry cannot hold non-Dexie localStorage keys. As the plan instructs, I recorded this here rather than registering it.

**4. Added guide.spec.ts** (not in files_modified). The orchestrator asked for guide/tour axe tests under the 10-22 naming contract. The full journey E2E is still 10-20's.

## Known Stubs

- `/setup/rentcast/` does not exist yet, so the guide's "Connect a free RentCast key" link points to a route that 10-16 will add. No test clicks it, and the prerender crawler never sees it because step 3 is client-only.
- `?source=sample` is not handled yet. 10-16 owns the (app) layout hand-off. Today the link opens the portal normally.

## Self-Check: PASSED

- All 12 key files exist on disk.
- Commits f4c25fd, 2de1b55, 38b8927, cf028ab and cf5dfd7 are present in `git log`.
