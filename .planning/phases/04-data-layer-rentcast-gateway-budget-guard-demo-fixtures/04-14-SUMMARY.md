---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 14
subsystem: ui
tags: [svelte5, provenance, cost-label, accessibility, vitest-browser, axe, date-fns]
requires:
  - "04-01: platform-ui.ts (Button, announce), @lucide/svelte, date-fns"
  - "04-02: @tran/core/budget formatCount"
  - "04-03: @tran/core/request Provenance"
  - "04-08: web-browser Vitest project + axeViolations"
provides:
  - "features/shared/data/relative-time.ts: formatRelative(fetchedAt, now, { timeZone }), toIso(epochMs)"
  - "features/shared/data/copy/provenance.ts: CHIP_SAMPLE, chipText, REFRESH_LABEL, REFRESHING, REFRESH_DONE, formatCost, newSinceText, detailText, CHECKED_PREFIX, checkedSuffix, checkedText, CostEstimate type"
  - "ProvenanceChip.svelte ({ provenance, now? }) with data-provenance-chip=sample|live|stale"
  - "ProvenanceRow.svelte ({ provenance, onRefresh?, now? }) with Refresh (1 call)"
  - "CostLabel.svelte ({ estimate: CostEstimate | 'free' | null })"
  - "NewSinceBadge.svelte ({ newCount, priceChanged, gone, checkedAt, source, now? })"
  - "sample-chip-check.ts: findUnbadgedSampleCards(root)"
affects: [04-19, 04-20, phase-06, phase-07, phase-08, phase-09]
tech-stack:
  added: []
  patterns:
    - "Relative-time components take an optional `now`; without it they keep a $state clock ticked by a 60 s setInterval inside $effect (never call the gateway)"
    - "Component tests mount into a hand-built host with render(C, { props, target }) to test a component inside a caller's <button>"
    - "Chips build their own class strings (no cn/twMerge) so text-label survives"
key-files:
  created:
    - apps/web/src/lib/features/shared/data/relative-time.ts
    - apps/web/src/lib/features/shared/data/relative-time.test.ts
    - apps/web/src/lib/features/shared/data/copy/provenance.ts
    - apps/web/src/lib/features/shared/data/ProvenanceChip.svelte
    - apps/web/src/lib/features/shared/data/ProvenanceRow.svelte
    - apps/web/src/lib/features/shared/data/CostLabel.svelte
    - apps/web/src/lib/features/shared/data/NewSinceBadge.svelte
    - apps/web/src/lib/features/shared/data/sample-chip-check.ts
    - apps/web/src/lib/features/shared/data/ProvenanceRow.browser.test.ts
    - apps/web/src/lib/features/shared/data/CostLabel.browser.test.ts
    - apps/web/src/lib/features/shared/data/NewSinceBadge.browser.test.ts
  modified: []
key-decisions:
  - "formatRelative uses formatDistanceStrict with roundingMethod 'floor' so 59.9 minutes reads '59 minutes ago', never '60 minutes ago'; a future fetchedAt (clock skew) reads 'just now'"
  - "ProvenanceChip renders its own <span> with the Phase 3 badge recipe instead of <Badge>, because twMerge drops text-label when a text colour follows it"
  - "ProvenanceRow resets the button in finally and announces only on success; a rejected onRefresh propagates (callers handle it and render GatewayError)"
  - "CostEstimate is declared structurally in copy/provenance.ts (no dependency on the 04-13 gateway module); sample-chip helper is DOM-only, so no $lib/data import was needed"
requirements-completed: [DATA-01, DATA-02, DATA-04]
metrics:
  duration: 20min
  completed: 2026-10-05
  tasks: 2
  files: 11
---

# Phase 4 Plan 14: Provenance and cost primitives Summary

**Sample/live/stale provenance chips with `<time datetime>`, a "Refresh (1 call)" row that announces completion, an in-button CostLabel covering all five UI-SPEC cost strings, a NewSinceBadge, and a `findUnbadgedSampleCards` coverage helper. Every one has exact-text, icon and axe browser tests.**

## Performance

- Duration: about 20 min
- Completed: 2026-10-05
- Tasks: 2 (both TDD, RED then GREEN)
- Files: 11 created

## Accomplishments

- `relative-time.ts`: "just now" under 60 s. Strict distance ("5 minutes ago", "2 hours ago", "3 days ago") under 7 days. Then "Sep 28", with the year added when it differs (computed in the given time zone).
- `copy/provenance.ts`: every provenance, cost and new-since string from 04-UI-SPEC, verbatim (U+00B7 middle dot, U+2026 ellipsis). Includes `formatCost`, which groups thousands through `formatCount`.
- `ProvenanceChip`: `FlaskConical` / `Database` / `History` icons with `aria-hidden`. Sample uses `bg-accent-surface` plus `border-border-strong`. Live uses `bg-secondary-surface text-secondary`. Stale uses `bg-surface` and may wrap with `rounded-lg` below `sm`. The relative part sits in `<time datetime={ISO fetchedAt} aria-live="off">`.
- `ProvenanceRow`: an outline Button with accessible name "Refresh (1 call)", shown for RentCast rows only. While running it shows a `LoaderCircle` with "Refreshing…" and is disabled, which also guards against double clicks. On success it calls `announce('Refreshed from RentCast. 1 call used.')`.
- `CostLabel`: `<span class="font-normal tabular-nums">` inside the caller's button. It renders nothing while the estimate is null.
- `NewSinceBadge`: badge text plus a `BellDot` icon when new > 0. A detail line lists only non-zero parts. A "Checked {relative} from RentCast / (sample data)" line wraps the relative part in `<time>`.
- `findUnbadgedSampleCards(root)`: returns `[data-provenance="sample"]` cards that lack a visible `[data-provenance-chip="sample"]` (one with client rects). A test shows it also catches a chip hidden with `display:none`.

## Task Commits

1. Task 1 RED: `b68fd1f` test(04-14): add failing provenance copy tests
2. Task 1 GREEN: `a6ae613` feat(04-14): provenance copy and relative time
3. Task 2 RED: `b6a35fd` test(04-14): add failing provenance and cost component tests
4. Task 2 GREEN: `c28f890` feat(04-14): provenance chip, refresh row, cost label, new-since badge

## Verification

- `vitest run --project web relative-time`: 11/11 pass
- `vitest run --project web-browser ProvenanceRow CostLabel NewSinceBadge`: 18/18 pass, every axe assertion `[]`
- `vitest run --project web`: 406/406 pass
- `pnpm check`: 0 errors. `pnpm lint`: exit 0. `pnpm guard`: pass. `pnpm ui:guard`: pass.
- No hex in `features/shared/data/*.svelte`. No `gateway.get|refresh` in those files (the comment was reworded so the grep stays clean).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The test harness could not mount into a caller element through `{ container }`**
- **Found during:** Task 2 GREEN
- **Issue:** vitest-browser-svelte ignores a `container` key in the third (setup) argument, so CostLabel mounted outside the harness `<button>`.
- **Fix:** Pass `target` in the mount options: `render(C, { props, target })`.
- **Files modified:** CostLabel.browser.test.ts, ProvenanceRow.browser.test.ts
- **Commit:** c28f890

**2. [Rule 1 - Bug] `chipText` type was too narrow**
- **Issue:** `Pick<Provenance,'source'|'stale'>` rejected full Provenance object literals under svelte-check.
- **Fix:** Changed the parameter to `Provenance`.
- **Commit:** c28f890

**3. [Rule 2 - Addition] `CHECKED_PREFIX` / `checkedSuffix` exports**
- Added so NewSinceBadge can wrap `{relative}` in `<time>` while keeping one copy source. `checkedText` is built from them.

**4. [Design note] Own `<span>` instead of the Phase 3 `<Badge>`**
- The Badge's `tv()`/twMerge chain drops `text-label` whenever a text colour follows it, which is a pre-existing Phase 3 issue. The chips use the same recipe with a plain class string. The Badge fix is logged in `deferred-items.md`.

Icons: all six exist in @lucide/svelte 1.45.0. `history` is an alias of `rotate-ccw-clock`, so no `CircleAlert` fallback was needed.

## Deferred Issues

See `deferred-items.md`:
- Badge/Button twMerge drops `text-label` / `text-body`.
- `.vitest-attachments/` and `__screenshots__/` failure artifacts are not gitignored.

## Known Stubs

None. The primitives are props-driven by design, and Phases 6-9 wire them to gateway results.

## Self-Check: PASSED
