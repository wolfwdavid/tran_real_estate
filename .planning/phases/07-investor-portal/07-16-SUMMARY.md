---
phase: 07-investor-portal
plan: 16
subsystem: investor-deals-compare
tags: [deals, compare, selection-cap, table-semantics, stacked-375, focus-management, e2e, a11y, svelte5]
requires:
  - "07-07: buildComparison / COMPARE_ROWS / MIN_COMPARE / MAX_COMPARE"
  - "07-09: dealsRepo (getDeal, deleteDeal tombstones memo drafts, dealsLive)"
  - "07-12: analyzer ?id= open and ?sample=1 links"
  - "07-03: PortalSubNav, route stubs, investor E2E helpers"
provides:
  - "deals/deals-view.ts: SORT_OPTIONS, isSortKey, sortDeals, toggleSelection, compareBarStatus, parseCompareIds, compareHref, droppedNote, COMPARE_CAP_REASON, COMPARE_MIN_REASON"
  - "compare/CompareTable.svelte (table >=768px + stacked-by-metric <768px, COMPARE_CAPTION, CompareColumn)"
  - "deals/DealCard.svelte, DealsList.svelte, CompareBar.svelte"
  - "/investor/deals/ and /investor/compare/ live pages; tests/e2e/investor/deals.spec.ts"
affects: [07-17 memo (deal cards link Memo to /investor/memo/?id=), 07-21 phase gate]
tech-stack:
  added: []
  patterns:
    - "Both compare layouts in the DOM, display:none hides the inactive one (no duplicate reading)"
    - "Focus after remove targets the remove button in whichever layout has client rects"
    - "Capped native checkbox: aria-disabled + click preventDefault keeps it focusable and unchecked"
key-files:
  created:
    - apps/web/src/lib/features/investor/deals/deals-view.ts
    - apps/web/src/lib/features/investor/deals/deals-view.test.ts
    - apps/web/src/lib/features/investor/deals/DealCard.svelte
    - apps/web/src/lib/features/investor/deals/DealsList.svelte
    - apps/web/src/lib/features/investor/deals/CompareBar.svelte
    - apps/web/src/lib/features/investor/compare/CompareTable.svelte
    - apps/web/src/lib/features/investor/compare/compare.ssr.test.ts
    - apps/web/tests/e2e/investor/deals.spec.ts
  modified:
    - apps/web/src/routes/(app)/investor/deals/+page.svelte
    - apps/web/src/routes/(app)/investor/compare/+page.svelte
key-decisions:
  - "Compare checkbox is a native input (size-5, accent-primary) rather than the bits-ui Checkbox: a native box can stay focusable with aria-disabled and refuse the check via preventDefault, with no controlled-state desync"
  - "The aria-disabled Compare link is <a role=link tabindex=0 aria-disabled aria-describedby> without href, with Phase 3 disabled visuals; its label shows 'Compare 2 deals' below 2 selected"
  - "Cap reason line appears in the compare bar after a refused 4th selection and is announced; the status line already states the cap at 3"
  - "Selection is filtered against the live deal list, so a deleted deal never stays selected"
  - "Remove from comparison focuses the deal that shifted into the removed column's place, else the h1 (also when fewer than 2 remain and the empty state shows)"
requirements-advanced: [INV-03]
metrics:
  duration: ~50min
  completed: 2026-10-05
  tasks: 3
  files: 10
---

# Phase 7 Plan 16: Saved deals list and compare Summary

**`/investor/deals/` lists saved deals as cards (monthly cash flow, cap rate, cash-on-cash and DSCR recomputed from the stored inputs). You can sort five ways, select up to 3 deals (a 4th is refused, and the reason is shown and announced), and delete with confirmation, after which focus moves to the next card. `/investor/compare/?ids=` shows 2 or 3 deals side by side: a real `<table>` from 768px, and stacked by metric below that. Each row's top figure is marked with a background, a chevron icon and the word Highest or Lowest. Everything runs at 0 RentCast calls.**

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Deals view helpers + CompareTable | ce5bc5d (test), 21c13d0 (feat), 3479e33 (fix: svelte-ignore comment lint) |
| 2 | Deals list and compare pages | cf8a70c |
| 3 | Deals and compare E2E | 4f4ee10 |

## Verification

- `vitest --project web deals-view compare.ssr`: 25 passed. A mutation that drops the marker render turned 4 SSR tests red.
- `pnpm --filter web check`: 0 errors, 0 warnings. `pnpm lint` passed. `pnpm banned` passed (239 files) and so did `ui:guard`.
- `build:root` + `build:sub`, then Playwright `investor/deals`: 6 of 6 passed (3 tests on each of root and sub).
- E2E mutations: removing `preventDefault` on the capped checkbox made the 4th box check, which `not.toBeChecked` caught. Removing the pending-focus call after a delete was caught by the `h2:focus` count. Both were reverted and the build was rebuilt clean.
- `test:unit`: 4082 of 4083 passed. The one failure was `renter/search/ResultsView.browser.test.ts`, which is unrelated to this plan and is a load flake. It passed 3/3 when re-run on its own.
- Acceptance greps: CompareTable has no "best" (an SSR test asserts this too). The compare page contains `new URL(location.href)`, `buildComparison(` and `Pick at least 2 deals to compare`. The spec has no `indexedDB` and contains `th[scope="row"]`, `Lowest`, the cap status string, `setViewportSize({ width: 375` and the empty-state heading.

## Deviations from Plan

1. **[Rule 3] Native checkbox instead of the Phase 3 bits-ui Checkbox.** The cap rule needs the box to stay focusable and refuse to check. A native input with `aria-disabled` and click `preventDefault` does this without a controlled-state desync. It is styled `size-5 accent-primary`, inside a 44px label row.
2. **[Rule 3] Text-spacing check uses a constructed stylesheet.** `page.addStyleTag` is blocked by the CSP (`style-src 'self'`), so the spec uses an adopted `CSSStyleSheet`, the same approach as analyze.spec.
3. **[Rule 1] Lint fix commit.** A `svelte-ignore` comment had a trailing description, which the linter rejected. This was fixed in 3479e33.
4. **Additive accessible names.** Open, Memo and Delete each carry the deal name as sr-only text, so they read "Open {name}", "Memo for {name}" and "Delete {name}". This keeps them unique in a list of cards. The visible labels match the UI-SPEC.

## Requirements advanced (not marked complete; orchestrator owns that)

- INV-03: save and compare side by side. The list, the selection cap, the comparison at 1280px and 375px, and delete are all proven end to end.

## Known Stubs

None. The Memo link points to `/investor/memo/?id=`, which 07-17 builds in this wave.

## Self-Check: PASSED
