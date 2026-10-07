---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 08
subsystem: ui
tags: [svelte, generation-panel, fixture-provider, print, layerchart, svg]

requires:
  - phase: 05-ai-layer-providers-streaming-fair-housing-guardrails
    provides: GenerationPanel, PanelState, exitPayload, exits.ts, Fixture provider
  - phase: 07-investor-portal
    provides: PromptDef.sample -> BuiltPrompt.fixtureText, PrintReport, ChartFigure print prop
  - phase: 08-agent-portal-profile-lead-intake-crm
    provides: emailFooter { text, label } and exitDisabled on GenerationPanel
provides:
  - "GenerationPanel/PanelState `formatForExit?: (draft, footerText) => string` shaping Copy text, the mailto body and Mark as sent"
  - "exitPayload(text, emailFooter?, formatForExit?) with an additive third parameter"
  - "End-to-end test proving PromptDef.sample(input) drives keyless Fixture output"
  - "PrintReport `preparedLine?: string`"
  - "ChartFigure print contract: Body 16/600 title, plot in a fixed 672-unit viewBox scaled to full width"
affects: [09-studio-tools, 09-snapshot-print, 09-20]

tech-stack:
  added: []
  patterns:
    - "Additive optional props whose absence reproduces earlier output byte-for-byte"
    - "Print plots laid out in a fixed 672 x H foreignObject inside a viewBox svg (w-full h-auto) so scaling is pure SVG"

key-files:
  created:
    - apps/web/src/lib/features/shared/print/PrintReport.test.ts
  modified:
    - apps/web/src/lib/ai/ui/panel-controller.ts
    - apps/web/src/lib/ai/ui/panel-controller.test.ts
    - apps/web/src/lib/ai/ui/panel-state.svelte.ts
    - apps/web/src/lib/ai/ui/GenerationPanel.svelte
    - apps/web/src/lib/ai/ui/GenerationPanel.test.ts
    - apps/web/src/lib/ai/providers/fixture.test.ts
    - apps/web/src/lib/features/shared/print/PrintReport.svelte
    - apps/web/src/lib/features/shared/markets/ChartFigure.svelte

key-decisions:
  - "Studio plans use exactly these shipped names: `emailFooter` ({ text, label }; label = disclosure label), `exitDisabled` (Partial<Record<ExitKind, string>>), `formatForExit` ((draft, footerText) => string, footerText = emailFooter?.text ?? ''). No footer/footerLabel/gate prop exists"
  - "When formatForExit is given it alone shapes the payload (the default draft + blank line + footer join is NOT applied first)"
  - "Fixture sample hook was already present (Phase 7: registry sets BuiltPrompt.fixtureText from PromptDef.sample; fixture.ts streams it). Only tests added"
  - "ChartFigure print keeps honoring an explicit headingLevel 3 (Phase 7 ZipTrendChart test asserts an h3 in print); the default is h2, now styled Body 16/600 in print"
  - "Print plot uses an svg viewBox 0 0 672 H wrapping a foreignObject (672 x H) that holds the LayerChart plot, so LayerChart measures a fixed 672px box and the svg scales it; height = `height` prop or 320; `width` is ignored in print"

patterns-established:
  - "PrintReport.test.ts holds the Phase 9 print additions; PrintReport.ssr.test.ts stays the Phase 7 shell suite"

requirements-completed: []

duration: 17min
completed: 2026-10-07
---

# Phase 9 Plan 08: Shared component extensions for the studio Summary

**GenerationPanel `formatForExit` layered on the existing `emailFooter`/`exitDisabled`, a proven PromptDef.sample keyless path, PrintReport `preparedLine`, and a ChartFigure print variant with a fixed 672-unit viewBox. Every default stays byte-identical to Phases 5-8.**

## Performance

- **Duration:** about 17 min
- **Started:** 2026-10-07T07:57Z
- **Completed:** 2026-10-07T08:14Z
- **Tasks:** 2/2
- **Files modified:** 9 (1 created, 8 modified)

## Accomplishments

- `exitPayload(text, emailFooter?, formatForExit?)`: with no formatter it is unchanged (`'Hi\n\nFOOT'`, `'Hi'`). With one it returns `formatForExit(text, emailFooter?.text ?? '')` (`'Hi|FOOT'`, `'Hi|'`).
- `PanelDeps.formatForExit` and the `GenerationPanel` prop are passed through a reactive getter. `copy()`, the `mailto` derivation, `emailClicked()` and `markSent()` all go through the one `exitPayload` call. `exits.ts` is still the only clipboard/mailto code.
- The emailFooter preview is the same element as before. Its only change is a `whitespace-pre-wrap` class so a multi-line disclosure keeps its line breaks.
- An end-to-end test (registry -> runner -> fixture) shows that `sample: (input) => 'Sample for ' + input.name` streams `'Sample for Oak'`, and a prompt without `sample` streams the canned default unchanged.
- PrintReport `preparedLine` defaults to `Prepared ${longDate(preparedAt)} with Tran Real Estate Tools`.
- ChartFigure `print`:
  - The title is styled Body 16/600 (`text-base leading-[1.6] font-semibold`) and is an h2 by default.
  - The plot sits in `<svg viewBox="0 0 672 {H}" class="block h-auto w-full max-w-full" data-print-plot>` wrapping a `<foreignObject width=672 height=H>`.
  - No style attributes are used (CSP-safe).
  - Screen mode is unchanged.

## Task Commits

1. **Task 1: panel exit formatter over emailFooter, fixture sample hook**: `777479c` (feat)
2. **Task 2: print report prepared line and chart print sizing**: `7ff67b4` (feat)

Both commits contain only this plan's files (checked with `git show --stat`). Task 2 was committed with an explicit pathspec, following the orchestrator's shared-index rule. Task 1 was committed just before that rule arrived; I checked afterwards and it holds only my 6 files. None of my files were committed by another executor.

## Verification

- `vitest --project web apps/web/src/lib/ai`: 27 files, 564 tests passed
- `vitest --project web-browser GenerationPanel.browser.test.ts`: 2/2 passed
- `vitest --project web shared`: 19 files, 254 tests passed (includes the Phase 7 charts.ssr and PrintReport.ssr suites, which are unchanged and green)
- Full `vitest --project web`: 139 files, 2100 tests passed
- `pnpm --filter web check` (svelte-check): 0 errors, 0 warnings
- `eslint .` repo-wide: clean. Scoped `prettier --check` on all my files: clean
- `pnpm banned`: passed (348 files)
- Acceptance greps:
  - No `footerLabel|footer?:|gate?:` in GenerationPanel.svelte or panel-state.svelte.ts.
  - No `navigator.clipboard`/`mailto:` outside exits.ts and tests.
  - The default-mode "exactly three exits" SSR test is unchanged and green.

## Deviations from Plan

1. **Fixture sample hook already present.** Phase 7 already wired `PromptDef.sample` to `BuiltPrompt.fixtureText` to the fixture provider. As the plan instructs, I added only the test (`'Sample for Oak'`) and changed no provider code.
2. **PanelState tests placed in GenerationPanel.test.ts.** The formatForExit PanelState behavior tests (copy / mailto / markSent) are in GenerationPanel.test.ts, which is in files_modified. panel-state.test.ts is not in files_modified, so I left it alone. The existing Phase 5 emailFooter PanelState test there is still green.
3. **ChartFigure print heading level.** The plan says print renders the title as an h2. The Phase 7 test `ZipTrendChart ... uses an h3 and drops Refresh in print` passes `headingLevel: 3` explicitly. To keep Phase 7 green, print keeps an explicit h3. The default (h2) is what the snapshot print route gets, now in Body 16/600.
4. **Both behaviors tested in PrintReport.test.ts.** The plan names `PrintReport.test.ts`, and the Phase 7 suite is `PrintReport.ssr.test.ts`. I created the new file for both the preparedLine and the ChartFigure print-contract tests, and left the Phase 7 file untouched.

## Issues Encountered

- Repo-wide `pnpm check` failed in `packages/core/src/studio/*.test.ts` (another executor's RED tests). Repo-wide `prettier --check` flagged `packages/core/src/fair-housing/lexicon.ts` (another executor's file). I did not fix either. Scoped runs prove my files clean.

## Known Stubs

None.

## Notes for downstream plans

- Requirements STU-01/STU-04 are NOT marked complete here; the phase gate (09-23) closes requirement ids.
- `state advance-plan` returned "Cannot parse Current Plan or Total Plans in Phase from STATE.md" (parallel wave-1 execution); update-progress, record-metric, add-decision, record-session and roadmap update-plan-progress 9 all succeeded, and the ROADMAP diff had no stray ticks.
- The foreignObject print plot renders correctly in Chromium (the primary target). Older WebKit had foreignObject scaling quirks. The snapshot print E2E (Pitfall 11 check: `emulateMedia({ media: 'print' })` with no figure where `scrollWidth > clientWidth`) should confirm the layout. Live LayerChart SVG inside the foreignObject is client-only and was not exercised here, because no browser test of the print route exists yet.

## Self-Check: PASSED

- FOUND: apps/web/src/lib/features/shared/print/PrintReport.test.ts
- FOUND: 777479c, 7ff67b4
