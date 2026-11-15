# 16-09 Budget forensics: where the Kit 3 initial JS lives and what was trimmed

Measured at 2603421 (Kit 3.1.1, Svelte 5.57.3, Vite 8.3.5, rolldown 1.2.15). All numbers are gzip -9 KB, the
oracle's unit (`scripts/assert-budget.mjs`, unchanged). Budget 60 KB on the gated pages.

## 1. Before (fresh builds at 2603421)

| Page | root | configured |
|------|------|------------|
| feedback/ | 60.6 | 60.8 |
| for-agents/ | 64.0 | 64.2 |
| for-investors/ | 64.1 | 64.3 |
| for-renters/ | 64.1 | 64.3 |
| tools/affordability/ | 63.4 | 63.6 |
| tools/cap-rate/ | 63.2 | 63.4 |
| tools/cash-on-cash/ | 63.4 | 63.5 |
| tools/dscr/ | 63.4 | 63.5 |
| tools/ | 55.8 | 56.0 |

Identical to the 16-08 numbers.

## 2. Contributors on the worst page (for-renters, root build, sourcemapped scratch build)

Sourcemap segments summed per original source, scaled to each file's gzip size. The scratch build adds a
sourcemap comment to every file, so the total reads 65.05 against the oracle's 64.08 (0.97 KB apart).

| Contributor | KB gz |
|-------------|-------|
| Svelte runtime (`svelte/src/internal/client/*`, one shared chunk, 22.2 KB file) | 21.3 |
| Kit client runtime (`@sveltejs/kit/src/runtime/client`) | 10.5 |
| unmapped (bundler glue, minified helpers, import lists) | 11.2 |
| app code (all `src/lib` and `src/routes`) | 7.2 |
| devalue (inside the Kit client chunk) | 3.8 |
| `@lucide/svelte` (Icon runtime + 12 audience icons + form icons) | 3.7 |
| Kit generated `app.js` (route dictionary + `__vite__mapDeps` table) | 3.3 |
| `@sveltejs/kit` other | 2.1 |
| files with no map (Vite preload helper 0.78, rolldown runtime 0.42, pwa-capture 0.34, frame-guard 0.24) | 1.8 |

Tool pages (cash-on-cash) differ only in the app slice: no Lucide, 0.5 to 1.2 KB each of tool content,
`ToolPage`, `CalculatorShell`, `calculator-form`, and core finance code.

Findings that shaped the trim:

- `app.js` is 19 KB raw / 5.3 KB gz. 2.2 KB gz of it is `__vite__mapDeps`, a 267-entry table of every chunk each
  route node needs, plus 52 index lists that point into it. Every page downloads it. It exists so that a dynamic
  `import()` of a node can preload that node's JS and CSS.
- No Lucide on tool pages (they already use `ToolIcon`); on audience pages and the feedback form Lucide cost 3.7 KB.
- Marketing routes stay free of Dexie, LLM adapters, pdfmake and LayerChart: none of them appears in any gated
  page's initial set (checked in the contributor list above).
- The shared Svelte chunk exports 103 symbols; the cash-on-cash page imports 51 of them. The rest (transitions,
  select and input bindings, boundary) is reachable from Kit's `start` entry, not from this page, so it is Kit 3's
  fixed cost. `output.experimental.chunkOptimization.mergeCommonChunks: false` was tried and changed nothing.

## 3. Real transfer cross-check (Playwright, fresh context, service worker blocked, every `.js` response gzip -9)

Scratch script, not committed. "Before" is a build of 2603421 made into a scratch directory; "after" is the build of
the two trim commits.

| Page | transfer before | transfer after | delta | oracle before | oracle after | oracle delta |
|------|-----------------|----------------|-------|---------------|--------------|--------------|
| for-renters/ | 64.95 | 57.51 | -7.44 | 64.08 | 56.64 | -7.44 |
| tools/cash-on-cash/ | 66.44 | 62.85 | -3.59 | 63.38 | 59.78 | -3.60 |

The deltas agree to 0.01 KB, so the trims remove bytes the browser really fetches; none of the saving is a change in
what the oracle counts. The absolute numbers differ from the oracle by a constant that is not part of the trim:
Kit 3 fetches the error node (`nodes/1`, 0.9 KB) after boot, and on tool pages also the chunks only that node
uses (2.2 KB before, 1.7 + 0.6 KB after). The oracle does not count them (they are not modulepreload links or boot
imports). The plan's wording asked for the absolute transfer to sit within 0.5 KB of the oracle; it does not (0.9 KB
on for-renters, 3.1 and 3.1 KB on cash-on-cash), and the cause is above. This is recorded as a deviation.

## 4. Candidates and measured savings (worst page for-renters; tools pages where stated)

| # | Candidate | File | Measured saving | Risk | Outcome |
|---|-----------|------|-----------------|------|---------|
| 1 | Keep only CSS in Vite's dynamic-import dependency table | `apps/web/vite.config.ts` (`build.modulePreload.resolveDependencies`) | 3.7 KB on every gated page (for-renters 64.08 to 60.37, tools/affordability 63.4 to 59.69) | JS chunks of a route node load through the module graph instead of in parallel (one extra round trip per chunk depth, only on a client navigation to a cold route; the service worker precaches everything) | applied |
| 2 | Inline SVG `SiteIcon` for the audience, waitlist, feedback and ButtonLink-arrow icons | `ui/SiteIcon.svelte` and 7 consumers | 3.7 KB on audience pages (60.37 to 56.64), 1.2 KB on feedback (56.9 to 55.7) | same SVG output and `lucide lucide-<name>` classes; dropped the `lucide-icon` class and Lucide's prop passthrough | applied |
| 3 | `/* @__PURE__ */` on the top-level `Intl` formatters in `core/format` and `core/renter/format` | `packages/core/src/format/index.ts`, `renter/format.ts` | 0.0 KB (no change at the oracle's 0.1 KB print resolution on any tool page) | none | reverted |
| 4 | `chunkOptimization.mergeCommonChunks: false` | `vite.config.ts` | 0.0 KB | none | reverted |
| 5 | `kit.version.pollInterval: 0` | `kit.options.js` | 0.0 KB (research) | none | not applied |
| 6 | Defer `WaitlistForm` on audience pages | `AudiencePage.svelte` | about 3 KB, audience pages only | the prerendered form and its pre-hydration native fallback would disappear | not needed, not applied |

Candidates 1 and 2 together exceed the 4.2 KB the research asked for on the worst page (7.4 KB).

## 5. After (fresh builds at 565c489)

Headroom is 60 KB minus the page's initial JS.

| Page | root KB | root headroom | configured KB | configured headroom |
|------|---------|---------------|---------------|---------------------|
| feedback/ | 55.74 | 4.26 | 55.92 | 4.08 |
| for-agents/ | 56.58 | 3.42 | 56.76 | 3.24 |
| for-investors/ | 56.64 | 3.36 | 56.83 | 3.17 |
| for-renters/ | 56.64 | 3.36 | 56.83 | 3.17 |
| tools/ | 52.21 | 7.79 | 52.38 | 7.62 |
| tools/affordability/ | 59.69 | 0.31 | 59.85 | 0.15 |
| tools/cap-rate/ | 59.62 | 0.38 | 59.79 | 0.21 |
| tools/cash-on-cash/ | 59.78 | 0.22 | 59.94 | 0.06 |
| tools/dscr/ | 59.76 | 0.24 | 59.92 | 0.08 |

The four tool pages are under the 0.5 KB headroom the plan hoped for (worst: cash-on-cash on the configured build,
0.06 KB). Everything that touches every page, or any tool page, will now need a re-measure on the configured build
(tasks/lessons.md 2026-10-13). No further behaviour-preserving saving of 0.4 KB was found without touching tool copy
or the Kit/Svelte runtime.
