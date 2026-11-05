---
phase: 14-carried-debt
plan: 06
subsystem: web-ui-primitives
tags: [tailwind-merge, tailwind-variants, badge, button, alert, vitest-browser, axe, DEBT-06]
requires: []
provides:
  - "TW_MERGE_CONFIG (font-size group: label, body, heading, display) shared by cn() and every tv() call"
  - "Real-Chromium computed-style + axe test for Badge, Button and Alert"
  - "Tailwind utilities available in the web-browser Vitest project"
affects: [14-09 (marketing trim measures after this config widens), 14-11 (verify chain)]
tech-stack:
  added: []
  patterns:
    - "Copy-in tv() calls go through `const tv = createTV({ twMergeConfig: TW_MERGE_CONFIG })` in the module script"
key-files:
  created:
    - apps/web/src/lib/utils.test.ts
    - apps/web/src/lib/components/ui/primitives.browser.test.ts
    - apps/web/src/lib/components/ui/PrimitivesHarness.svelte
  modified:
    - apps/web/src/lib/utils.ts
    - apps/web/src/lib/components/ui/badge/badge.svelte
    - apps/web/src/lib/components/ui/button/button.svelte
    - apps/web/src/lib/components/ui/alert/alert.svelte
    - apps/web/vitest.browser.config.ts
decisions:
  - "tv() gets the shared merge config through createTV() in each copy-in's module script instead of a second tv() argument: Prettier re-wraps the whole tv({...}) object for the two-argument form, which breaks D-15 blame-clean; createTV(cfg) is literally (o, c) => tv(o, c ? merge(cfg, c) : cfg) in tailwind-variants 3.3.1, so behaviour is identical"
  - "createTV stays out of $lib/utils.ts (per plan), so cn() consumers do not pull in tailwind-variants"
metrics:
  duration: "~14 min"
  completed: 2026-11-05
  tasks: 2
  files: 8
---

# Phase 14 Plan 06: text-label token survives class merging (DEBT-06) Summary

`cn()` now runs on `extendTailwindMerge(TW_MERGE_CONFIG)` and Badge, Button and Alert build their variants through `createTV({ twMergeConfig: TW_MERGE_CONFIG })`, so `text-label` / `text-body` are no longer dropped as "colours". A node unit test and a real-Chromium computed-style + axe test prove it (Badge 14px / 19.6px / 600, Button 16px / 25.6px / 600 inside a 20px container).

## Tasks

| # | Task | Commit |
|---|------|--------|
| 1 | Shared TW_MERGE_CONFIG for cn() and every tv() call, node unit tests | 3f910c8 |
| 2 | Tailwind in web-browser project; computed-size + axe test; budget re-measure | 1ba0de9 |

## Verification

- `vitest run --project web apps/web/src/lib/utils.test.ts`: RED before the fix (10 failed), GREEN after (10 passed).
- `vitest run --project web-browser .../primitives.browser.test.ts`: RED before the config change (4 failed: font-weight 400, Badge/Button 20px), GREEN after (4 passed).
- Full `vitest run --project web-browser`: 34 files, 262 tests passed.
- `pnpm --filter web check`: 0 errors, 0 warnings (3259 files).
- `prettier --check` and `eslint` on all 8 touched files: clean. `pnpm ui:guard`: passed (81 files).
- `pnpm build:root`, `build:configured`, `build:sub`: exit 0. `pnpm budget:assert`: passed in both builds.
- `playwright test tests/e2e/a11y.spec.ts tests/e2e/a11y-keyed.spec.ts --project root --project sub`: 272 passed (2.7m).

### leading-* grep (step 6)

`grep -rnE "leading-[^ \"']+ [^\"']*text-(label|body|heading|display)" apps/web/src --include=*.svelte --include=*.ts` printed nothing (exit 1). No caller writes a `leading-*` class before a text token, so the new font-size/leading conflict has no victim today.

### Test-only CSS

Not needed. With `tailwindcss()` in `vitest.browser.config.ts`, importing `app.css` from the test was enough: the sanity assertion (`font-semibold` computes `600`) passed on the first run, so `primitives.browser.css` was not created.

### Tool-route budget (initial JS, gzip -9 bytes, HARD limit 61,440)

| Route | build before | build after | build-configured before | build-configured after |
|-------|-------------:|------------:|------------------------:|-----------------------:|
| tools/affordability | 60,279 | 60,201 | 60,356 | 60,349 |
| tools/cap-rate | 60,146 | 60,071 | 60,225 | 60,217 |
| tools/cash-on-cash | 60,305 | 60,228 | 60,382 | 60,375 |
| tools/dscr | 60,286 | 60,209 | 60,363 | 60,356 |
| tools/ (index) | 52,522 | 52,444 | 52,597 | 52,592 |

"Before" figures are the plan's baseline. The "after" builds ran on a shared working tree with parallel wave-1 plans, so the small decreases are not attributed to this change. What matters is that every HARD route stays under 61,440 B in both builds.

## Mutation ledger

| # | Mutant | Failing test(s) |
|---|--------|-----------------|
| 1 | Remove `'label', ` from `TW_MERGE_CONFIG` (utils.ts) | utils.test.ts: 6 failed (cn text-label case, cn text-sm case, badgeVariants x3, TW_MERGE_CONFIG shape) |
| 2 | badge.svelte `createTV({ twMergeConfig: TW_MERGE_CONFIG })` -> `createTV({})` (drops the config) | utils.test.ts: badgeVariants(undefined/positive/attention) failed (3) |
| 3 | Same badge mutant as #2, browser project | primitives.browser.test.ts: "default Badge ... 14px" failed, `expected '20px' to be '14px'` |
| 4 | Remove `tailwindcss(),` from vitest.browser.config.ts | primitives.browser.test.ts: 4 failed (sanity `expected '400' to be '600'`, Badge and Button 20px, axe 1 violation) |

**4/4 caught.** Each mutant was restored by copying the saved file back. Afterwards `git diff --stat` on badge.svelte was empty against the committed fix, and utils.ts and vitest.browser.config.ts matched their pre-mutation diffs. The re-runs were green (10/10 and 4/4).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tv() wiring via createTV instead of a second tv() argument**
- **Found during:** Task 1, `prettier --check`
- **Issue:** The plan's `}, { twMergeConfig: TW_MERGE_CONFIG });` close is not Prettier-stable. Prettier re-indents the whole `tv({...})` object into `tv(\n {...},\n {...}\n)` and touches every line, which breaks the D-15 blame-clean rule and the "at most 4 lines" diff criterion.
- **Fix:** In each module script the tailwind-variants import becomes `createTV`, and `const tv = createTV({ twMergeConfig: TW_MERGE_CONFIG });` is added, so the `tv({...})` bodies stay byte-identical. In tailwind-variants 3.3.1, `createTV(cfg)` is `(options, config) => tv(options, config ? mergeObjects(cfg, config) : cfg)`, which is the same behaviour as the inline argument. The `twMergeConfig: TW_MERGE_CONFIG` grep still finds exactly one hit per file.
- **Diff size:** badge 4, alert 4, utils.ts 8 (all within the criterion). button has 5 lines (3 insertions, 2 deletions), one over the "at most 4", because both its existing imports change (`tv` -> `createTV`, plus `TW_MERGE_CONFIG` added to the existing `$lib/utils.js` import).
- **Files modified:** badge.svelte, button.svelte, alert.svelte
- **Commit:** 3f910c8

### Notes

- The Button harness includes `size="icon"` with `aria-label="Close"` so the icon size is axe-scanned with an accessible name.
- Now that the browser test loads real CSS, its axe run also checks colour contrast and target size for the primitives. Without CSS (mutant 4) axe reported one violation, so the green axe result depends on the styles being loaded.
- The four existing workarounds (FairHousingText, dropdown-menu-content, popover-content, StageBadge) were left untouched, as deferred in CONTEXT.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: apps/web/src/lib/utils.test.ts, apps/web/src/lib/components/ui/primitives.browser.test.ts, apps/web/src/lib/components/ui/PrimitivesHarness.svelte
- FOUND commits: 3f910c8, 1ba0de9
