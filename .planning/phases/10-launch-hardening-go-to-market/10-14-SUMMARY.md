---
phase: 10-launch-hardening-go-to-market
plan: 14
subsystem: marketing/tools
tags: [gtm, tools, calculators, affordability, footer, budget, e2e, a11y, json-ld]
requires: ["10-05", "10-12 calculators", "10-13 ToolPage + per-tool copy", "Phase 6 shared affordability calculator"]
provides:
  - "/tools/affordability/ (prerendered, in sitemap, share card)"
  - "SiteFooter Tools column (four calculators + All calculators), 1 / 2x2 / 4-column grid"
  - "AFFORDABILITY_READY = true (hub card + Other-calculators links)"
  - "tests/e2e/tools.spec.ts (100 tests root+sub: zero network, figures, states, announcements, JSON-LD, axe, footer)"
  - "@tran/core renter/dates.ts (utcDayDiff, re-exported from filters.ts)"
affects: ["10-18 (footer Learn gains Send feedback; sitemap reaches 14)", "10-22/10-23 launch audit (EXTRA_A11Y calculators group, budget gate)"]
tech-stack:
  added: []
  patterns:
    - "Heavy UI primitives on a budget-gated page load via a dynamic import() after mount, with a same-size placeholder (no CLS, same visuals)"
    - "Footer nav uses display: contents so its groups join the outer grid; the Footer landmark stays in the a11y tree (E2E-proven)"
key-files:
  created:
    - apps/web/src/routes/(marketing)/tools/affordability/+page.svelte
    - apps/web/tests/e2e/tools.spec.ts
    - packages/core/src/renter/dates.ts
  modified:
    - apps/web/src/lib/components/layout/SiteFooter.svelte
    - apps/web/src/lib/content/tools/meta.ts
    - apps/web/src/lib/components/tools/ToolPage.svelte
    - apps/web/src/lib/components/tools/ToolIcon.svelte
    - apps/web/src/routes/(marketing)/tools/+page.svelte
    - apps/web/src/lib/features/shared/affordability/AffordabilityResult.svelte
    - apps/web/src/lib/features/shared/affordability/AffordabilityForm.svelte
    - apps/web/src/lib/features/shared/affordability/GoodToKnow.svelte
    - apps/web/src/lib/features/shared/affordability/affordability.test.ts
    - apps/web/src/lib/features/shared/affordability/affordability.browser.test.ts
    - apps/web/tests/e2e/routes.ts
    - packages/core/src/renter/filters.ts
    - packages/core/src/renter/format.ts
key-decisions:
  - "Affordability component stays at features/shared/affordability (already import-clean, lint-fenced); no move needed"
  - "bits-ui Slider in AffordabilityResult is imported after mount (44px placeholder until it lands): the slider + tailwind-merge + runed/toolbelt were ~24 KB gz of initial JS; first measure of the page was 81.8 KB"
  - "Affordability icons use inline SVG (ToolIcon gains circle-check, triangle-alert, search); the search CTA carries ButtonLink's primary classes inline (ButtonLink pulls Lucide's runtime via ArrowRight)"
  - "utcDayDiff moved to @tran/core renter/dates.ts (filters.ts re-exports it) so format.ts no longer drags renter search defaults (~1.1 KB gz) onto the page"
  - "Footer nav is display: contents inside a grid-cols-1 / md:grid-cols-2 / lg:grid-cols-4 grid, giving the UI-SPEC 2x2 at 768 and 4 columns at 1024 without splitting the Footer landmark"
  - "AFFORDABILITY_READY kept (now true) rather than deleted; hub and ToolPage link /tools/affordability/ with a typed resolve()"
requirements-completed: [GTM-03]
metrics:
  duration: "~55 min (19:31 to 20:25)"
  completed: 2026-10-13
  tasks: 2
  commits: 3
---

# Phase 10 Plan 14: Affordability tool page, footer Tools column, tools E2E Summary

The Phase 6 rent affordability calculator now has its own page at /tools/affordability/, inside the ToolPage frame (breadcrumb, header, disclaimer, "How it's calculated", FAQ, Go further, other calculators). Every page footer has a Tools column linking all four calculators and the hub. A new tools.spec.ts proves on root and sub that the calculators make no network calls while used, reproduce every UI-SPEC example figure, handle their states accessibly, and ship JSON-LD that is intact at runtime. All five tool routes fit the 60 KB gz budget on all three builds, and the budget was not raised.

## Tasks

| # | Task | Commit | Notes |
|---|------|--------|-------|
| 1 | Affordability page, footer Tools column, route list (+ budget work) | 7c52683 | |
| 2 | Tools E2E: zero requests, example figures, states, JSON-LD runtime, axe, footer | 2a81239 | 100/100 on the first run |
| - | Contract map (affordability imports) + deferred flake log | 3f6af31 | |

## Budget: initial JS, KB gz (`node scripts/assert-budget.mjs <dir> --require-tools`)

| Route | Before 10-14 (build / sub / configured, from handoff) | First measure with the page (build) | Final `build/` | Final `build-sub/` | Final `build-configured/` |
|---|---|---|---|---|---|
| tools/ | 51.6 / 51.6 / 51.7 | 51.8 | 51.7 PASS | 51.8 PASS | 51.9 PASS |
| tools/affordability/ | n/a | **81.8 FAIL** | **59.3 PASS** | **59.3 PASS** | **59.4 PASS** |
| tools/cap-rate/ | 58.1 / 58.2 / 58.3 | 58.9 | 59.2 PASS | 59.2 PASS | 59.3 PASS |
| tools/cash-on-cash/ | 58.3 / 58.3 / 58.4 | 59.1 | 59.3 PASS | 59.4 PASS | 59.5 PASS |
| tools/dscr/ | 58.3 / 58.3 / 58.4 | 59.0 | 59.3 PASS | 59.3 PASS | 59.5 PASS |
| index (report only) | 57.9 / 58.0 / 58.1 | 58.2 | 58.1 | 58.2 | 58.3 |
| legal/* (report only) | - | - | 48.8-51.6 | 48.8-51.6 | 48.9-51.7 |
| for-* (report only) | - | - | 96.3 | 96.3 | 96.4 |

All three runs print "Budget assertion passed: 5 gated route(s) within 60 KB, 8 reported".

The affordability page went from 81.8 to 62.0 KB with the lazy slider plus inline icons, then to 59.3 KB with the inline CTA and the dates.ts split. On the affordability page the bits-ui slider costs about 10.3 KB gz, plus tailwind-merge (via `cn`) at 8.8 KB, svelte-toolbelt at 3.2 KB and runed helpers at 2.2 KB.

**Calculator pages grew by about 1.0-1.1 KB.** I measured this against a clean HEAD build (d27fb13, built in a temporary worktree) for cap-rate: 58,935 B before and 60,017 B after.
- The footer Tools column accounts for about 0.2-0.3 KB. It is on every page; the landing page went 57.9 to 58.1.
- The rest is chunk splitting. ToolPage, the shared tool copy and ToolIcon are now also imported by the affordability page, so Rolldown splits them out of the single calculator chunk (7,096 B) into three chunks: frame + copy 3,402 B, calculator infrastructure 3,604 B, and ToolIcon 970 B.
- Headroom on the configured build is now about 0.5-0.7 KB per tool page. I measured the alternatives and they cost more than they save, so I did not apply them:
  - Separate icons for the affordability component: affordability +0.3 KB, calculators about -0.2 KB.
  - A manual chunk group: per 10-19, it adds +0.4 KB on portal routes.

## Verification (real output)

- `pnpm check`: 0 errors, 0 warnings (2729 files). `pnpm lint`: exit 0. `pnpm banned`: passed (441 files). `pnpm ui:guard`: passed (79 files).
- `pnpm test:unit` (vitest, all projects): **318 files, 6240 tests passed**.
- Affordability unit tests: SSR 45/45 and browser 9/9.
- `build:root`, `build:sub` and `build:configured`: exit 0.
- `assert-seo`:
  - `build --target root --min-urls 13`: "SEO assertion passed for 42 pages, 13 sitemap URLs, 6 share cards". Sub gives the same result.
  - Remaining shortfall vs 14: `--min-urls 14` fails with "sitemap.xml: 13 URLs, expected at least 14". The missing URL is /feedback/ from 10-18.
- `csp:assert`: passed for 43 pages × 3 builds (build, build-sub, build-configured).
- `playwright tools --project=root --project=sub`: **100 passed** (54 s).
- Targeted Task 1 E2E (`layout seo renter-affordability routing routes-drift marketing`, root + sub): 672 passed.
- **Full E2E**, sharded at about 3 min per shard:
  - **root** (984 tests): 265 + 366 + 116 + 237, all passed.
  - **sub** (980 tests): shards 1, 3 and 4 passed (265 / 105 / 244). Shard 2 had 365 passed and **1 failed**: `guide.spec.ts:107` "hero Show me around resets the guide and focuses its heading". The guide still showed the agent tour. Re-run alone it passed 3/3, and the whole guide.spec on root + sub passed 14/14. It is a load flake, the same test 10-13 saw fail on sub, and is logged in deferred-items.md for 10-23. Nothing in 10-14 touches the guide.
  - **configured**: 24 passed.

## Deviations from Plan

1. **[Rule 3 - Blocking] Budget: the Phase 6 component was internally slimmed.** The plan said to embed the component unchanged, but the page measured 81.8 KB against a 60 KB gate. Visible behavior and copy are unchanged. The bytes changed as follows:
   - The bits-ui `Slider` is now a dynamic `import()` in `onMount`, with a 44 px `aria-hidden` placeholder in its place until it lands. It is only shown once a result exists, and the result is never present at prerender.
   - The Lucide icons are now inline SVG via `ToolIcon`.
   - The search CTA uses ButtonLink's classes inline.
   - `utcDayDiff` moved to `renter/dates.ts`.

   The renter portal page (/renter/affordability/) uses the same component, and its E2E stayed green.
2. **[Rule 3] Phase 6 unit tests updated for the lazy slider.** The SSR test asserted `role="slider"` and the slider ARIA in the server output, which no longer happens. It now asserts the placeholder and the number input (`max="10000"`, `value="1800"`). The slider's `aria-valuemax="10000"` and `aria-labelledby="afford-try-label"` assertions moved to the browser test, which also waits for the lazily loaded thumb before focusing it.
3. **Footer `Send feedback`** was not added, per the plan; 10-18 owns it.
4. **Tools spec extras beyond the plan:**
   - The affordability page is included in zero-network, JSON-LD and axe (empty and filled at 375 and 1280).
   - Added a footer geometry test (1 column at 375, 2×2 at 800, 4 columns at 1280). It proves the `display: contents` layout.
   - The footer links test uses `getByRole('navigation', { name: 'Footer' })`, which proves the landmark survives `display: contents` in Chromium.
5. **Axe test titles** follow the 10-22 contract for extra-state groups: `axe: <slug> calculator <state> at <w>px on "tools/<slug>/"`. They contain "axe", "calculator" and "tools/", and do not match the keyless or keyed per-route title patterns.
6. **Announcement test** uses a real 750 ms wait (`toHaveText` auto-retry), not `page.clock`. It passed on root and sub on the first run.

## Known Stubs

None. With `AFFORDABILITY_READY = true` the hub card and every Other-calculators list link the live page.

## Self-Check: PASSED

- Files: `apps/web/src/routes/(marketing)/tools/affordability/+page.svelte`, `apps/web/tests/e2e/tools.spec.ts` and `packages/core/src/renter/dates.ts` all exist.
- Commits: 7c52683, 2a81239 and 3f6af31 are all in `git log`.
- The build lock was released, `apps/web/test-results/` was removed and the temporary worktree was pruned.
