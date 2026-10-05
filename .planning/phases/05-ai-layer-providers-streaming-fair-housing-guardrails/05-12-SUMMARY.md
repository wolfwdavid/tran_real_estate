---
phase: 05-ai-layer-providers-streaming-fair-housing-guardrails
plan: 12
subsystem: ai-fair-housing-ui
tags: [ai, fair-housing, ui, popover, textarea, shadcn-svelte, a11y, contrast, ssr-tests]
requires:
  - "@tran/core/fair-housing (Finding, FindingMember, STATE_SCOPE_NOTE, checkFairHousing)"
  - "$lib/ai/ui/panel-controller (segmentText, findingsTitle)"
  - "Phase 3 button/checkbox/label copy-ins"
provides:
  - "components/ui/popover (shadcn-svelte copy-in, 8 svelte files + index.ts), reconciled"
  - "components/ui/textarea (copy-in), reconciled like the Phase 3 input"
  - "ai/ui/FairHousingText.svelte: read-mode renderer with <mark> popover triggers (openId bindable)"
  - "ai/ui/FindingDetails.svelte: popover body, primary button carries data-finding-apply"
  - "ai/ui/FindingPopover.svelte: bits-ui popover (role=dialog, aria-labelledby, focus to primary action)"
  - "ai/ui/FindingsSummary.svelte: region, ordered findings list, acknowledgement (acknowledged bindable)"
  - "brand contrastPairs: 3 Phase 5 non-text rows (48 pairs total)"
affects: [05-13, Phase 9, Phase 10]
tech-stack:
  added: []
  patterns:
    - "Fair Housing UI copy is held in script constants, so prettier can't wrap it into multi-line text nodes"
    - "Inline triggers build their class strings directly (no tailwind-merge), so the custom text-* sizes survive"
    - "Popover tags hug (no whitespace text nodes) so an inline trigger adds no stray space to the draft"
key-files:
  created:
    - apps/web/src/lib/components/ui/popover/index.ts
    - apps/web/src/lib/components/ui/popover/popover.svelte
    - apps/web/src/lib/components/ui/popover/popover-content.svelte
    - apps/web/src/lib/components/ui/popover/popover-trigger.svelte
    - apps/web/src/lib/components/ui/popover/popover-close.svelte
    - apps/web/src/lib/components/ui/popover/popover-portal.svelte
    - apps/web/src/lib/components/ui/popover/popover-header.svelte
    - apps/web/src/lib/components/ui/popover/popover-title.svelte
    - apps/web/src/lib/components/ui/popover/popover-description.svelte
    - apps/web/src/lib/components/ui/textarea/index.ts
    - apps/web/src/lib/components/ui/textarea/textarea.svelte
    - apps/web/src/lib/ai/ui/FairHousingText.svelte
    - apps/web/src/lib/ai/ui/FindingDetails.svelte
    - apps/web/src/lib/ai/ui/FindingPopover.svelte
    - apps/web/src/lib/ai/ui/FindingsSummary.svelte
    - apps/web/src/lib/ai/ui/fair-housing-ui.test.ts
    - apps/web/src/lib/ai/ui/fair-housing-ui.browser.test.ts
  modified:
    - packages/brand/src/index.ts
    - packages/brand/src/contrast.test.ts
decisions:
  - "Popover/textarea use text-base + leading-[1.6] instead of text-body, which sidesteps the open tailwind-merge collision (text-body would be dropped by the colour class)"
  - "The trigger always carries aria-controls (bits-ui only sets it while open), as the plan contract requires"
  - "The finding trigger is a real <button>, which renders as inline-block, so a long phrase wraps inside its own box. The underline sits on the button because decorations don't propagate into inline-block boxes"
  - "FindingsSummary takes both titles from findingsTitle (single source of truth); the literal strings appear in its header comment"
metrics:
  duration: ~9min
  completed: 2026-10-05
  tasks: 2
  files: 19
---

# Phase 5 Plan 12: Fair Housing flag UI Summary

Fair Housing findings now render inline as `<mark>` popover triggers. Each one has four non-color cues: an OctagonAlert or TriangleAlert icon, a solid or dashed underline, a visually hidden prefix, and a worded row in the findings list. The popover is a keyboard-operable dialog that explains the category, the state-law scope, suggested wording (or "remove this phrase") and the basis, with Use alternative / Edit it myself buttons. `FindingsSummary` lists Must fix rows before Review rows and gates the acknowledgement checkbox. The new shadcn-svelte `popover` and `textarea` copy-ins are reconciled to the Phase 2/3 tokens, and the Phase 5 contrast pairs are guarded in `packages/brand`.

## Tasks

| # | Task | Commit(s) |
|---|------|-----------|
| 1 | popover + textarea copy-ins, Phase 5 contrast pairs | dbe511e |
| 2 | FairHousingText / FindingDetails / FindingPopover / FindingsSummary (TDD) | RED aa0f562, GREEN fa0d7b3 |

## CLI output and import mappings

- `shadcn-svelte add popover textarea --yes --no-deps` (v1.6.1, official registry) wrote **popover**: `index.ts`, `popover.svelte`, `popover-content.svelte`, `popover-trigger.svelte`, `popover-close.svelte`, `popover-portal.svelte`, `popover-header.svelte`, `popover-title.svelte`, `popover-description.svelte`, and **textarea**: `index.ts`, `textarea.svelte`. bits-ui was already installed, so `--no-deps` was used.
- Imports: `$lib/components/ui/popover/index.js` (`* as Popover`), `$lib/components/ui/button/index.js` (`Button`), `checkbox/index.js` (`Checkbox`), `label/index.js` (`Label`), `$lib/utils.js` (`cn`). Icons come from `@lucide/svelte/icons/{octagon-alert,triangle-alert,circle-check}`.

## Reconciliation

- **popover-content**: `bg-popover` (card), 1px `border-border`, `rounded-lg`, `shadow-card-hover`, `p-4`, `w-80 max-w-[calc(100vw-2rem)]`, `gap-2`, Phase 2 outline focus, and `motion-safe:` fade-in/out at 150ms only. Removed: every zoom/slide class, `ring-foreground/10`, `shadow-md`, `text-sm` and `outline-hidden`. `sideOffset` is 8 and `collisionPadding` is 16.
- **popover-header/title**: `text-sm` removed, `font-medium` changed to `font-semibold`.
- **textarea**: `bg-card`, `border-input`, `rounded-md`, `p-4`, `text-base leading-[1.6]`, `min-h-60`, `resize-y`, `aria-invalid:border-destructive`, Phase 2 outline focus and the Phase 3 disabled visuals. Removed: every `dark:`, `ring-ring/50`, `field-sizing-content` and `md:text-sm`.

## Contrast pairs added (packages/brand)

All 12 text pass rows from the UI-SPEC were already covered by the `TEXT_FOREGROUNDS x SURFACES` matrix, and the ring and input rows by the existing ui rows. Three non-text rows were added:
- `destructive` on `accent-surface` (ui, ≥3): block underline and OctagonAlert, 5.98
- `foreground` on `surface` (ui, ≥3): warn dashed underline and TriangleAlert, 13.53
- `foreground` on `background` (ui, ≥3): streaming caret, 15.24

`contrast.test.ts` gains a "Phase 5 contrast record" block. It asserts that every UI-SPEC pass row is in the frozen matrix and checks four computed ratios. The brand project passes 15/15.

## Requirements advanced

AI-02: findings are flagged inline with an explanation and a compliant alternative. Not marked complete; that waits for the 05-16 gate.

## Verification

- `vitest run --project web apps/web/src/lib/ai/ui`: 3 files, 112 tests pass (18 are the new SSR tests)
- `vitest run --project web-browser .../fair-housing-ui.browser.test.ts`: 5 pass. Enter opens a labelled dialog with `aria-controls` equal to the dialog id, focus lands on Use alternative, Escape closes and returns focus to the trigger, Use alternative reports the finding id and closes, and axe is clean for open, closed, summary and no-findings states.
- `vitest run --project brand`: 15 pass
- `pnpm --filter ./apps/web check`: 0 errors, 0 warnings
- prettier and eslint are clean on the touched paths; `pnpm banned` passed (90 files); `pnpm ui:guard` passed (54 files)
- `grep -l "{@html" apps/web/src/lib/ai/ui/*.svelte` matches nothing, and the SSR test enforces it too

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stray spaces around inline triggers**
- **Found during:** Task 2 GREEN
- **Issue:** Whitespace text nodes between `Popover.Trigger` and `Popover.Content` rendered a space after each flagged phrase ("professionals ."), so the draft no longer rendered exactly.
- **Fix:** The tags in FindingPopover now hug. The SSR round-trip test (strip tags and prefixes, compare with the original text) guards this.
- **Commit:** fa0d7b3

**2. [Rule 1 - Bug] Prettier wrapped UI copy into multi-line text**
- **Issue:** Svelte keeps the newline and indentation inside a wrapped text node, so the exact UI-SPEC sentences didn't match.
- **Fix:** The copy now lives in script constants (`CHECKING`, `LIMITS_NOTE`, `LEGAL_NOTE`, `ACK`).

**3. [Rule 2 - Coverage] Added a browser test file**
- The plan specified SSR tests only. `fair-housing-ui.browser.test.ts` adds proof of the keyboard, focus and axe contract, which SSR can't exercise.

**4. [Rule 1] The `{@html` source check matched a comment**
- The FairHousingText header comment originally said "never {@html}". It now says "never raw HTML injection", so the source rule holds.

## Known Stubs

None. The `onApply`, `onEdit` and `onShow` callbacks are intentionally consumer-wired by 05-13 GenerationPanel. The "applied" announcements and the focus moves after apply/show belong to the panel, per the UI-SPEC focus table.

## Self-Check: PASSED
