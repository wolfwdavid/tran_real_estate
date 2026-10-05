---
phase: 03-local-platform-storage-key-vault-backup
plan: 06
subsystem: ui
tags: [shadcn-svelte, bits-ui, tailwind, design-tokens, contrast, ci-guard]
requires:
  - phase: 02-brand-system-marketing-legal-pages
    provides: app.css @theme tokens, @tran/brand tokens + parity/contrast tests, @lucide/svelte 1.45.0
  - phase: 03-01
    provides: Phase 3 core contracts and lint guardrails
provides:
  - nine shadcn-svelte primitives under $lib/components/ui (button, input, label, alert-dialog, dialog, radio-group, checkbox, badge, alert)
  - cn() in $lib/utils via clsx + tailwind-merge
  - 8 alias color tokens in app.css @theme and @tran/brand (parity + contrast tested)
  - key-digits utility for key inputs
  - pnpm ui:guard (scripts/ui-class-guard.mjs) in verify and CI hygiene
affects: [03-10, 03-11, 03-12, 03-13, 03-14, 03-15, phases 4-9 UI work]
tech-stack:
  added: [shadcn-svelte 1.6.1, bits-ui 2.19.2, "@internationalized/date 3.12.4", tailwind-variants 3.3.1, tailwind-merge 3.7.0, clsx 2.1.1, tw-animate-css 1.4.0]
  patterns: [copy-in primitives restyled to Phase 2 tokens only, pure-rules + fs-walker fail-closed guard]
key-files:
  created:
    - apps/web/components.json
    - apps/web/src/lib/utils.ts
    - apps/web/src/lib/components/ui/{button,input,label,alert-dialog,dialog,radio-group,checkbox,badge,alert}/
    - scripts/lib/ui-class-rules.mjs
    - scripts/ui-class-guard.mjs
    - scripts/ui-class-guard.test.ts
  modified:
    - apps/web/src/app.css
    - apps/web/package.json
    - pnpm-lock.yaml
    - packages/brand/src/index.ts
    - packages/brand/src/contrast.test.ts
    - package.json
    - .github/workflows/ci.yml
key-decisions:
  - "Button variants: default/outline/ghost/destructive/destructive-outline/link; sizes default (h-12) and icon (size-11); secondary variant and anchor href branch deleted"
  - "Badge variants are neutral/positive/attention; Alert variants are info/destructive (shadcn defaults removed)"
  - "tw-animate-css kept; every animation is motion-safe:-prefixed and enforced by ui:guard"
  - "Input drops the type=file branch (no Phase 3 use); file pickers are styled labels"
requirements-completed: [PLAT-01, PLAT-03, PLAT-04]
duration: 9min
completed: 2026-10-05
---

# Phase 3 Plan 06: shadcn-svelte init reconciled to Phase 2 tokens Summary

**shadcn-svelte 1.6.1 with nine token-only primitives (bits-ui 2.19.2), eight parity- and contrast-tested alias tokens, and a fail-closed `pnpm ui:guard` class guard in verify and CI.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-10-05T02:20:53Z
- **Completed:** 2026-10-05T02:29:23Z
- **Tasks:** 3 (Task 1 folded into Task 2's commit, as the plan allows when generated sources fail lint)
- **Files modified:** ~55

## Accomplishments

- Components live under `apps/web/src/lib/components/ui/`: `button/`, `input/`, `label/`, `alert-dialog/`, `dialog/`, `radio-group/`, `checkbox/`, `badge/`, `alert/` (import via `$lib/components/ui/<name>/index.js`). Phase 2's `ButtonLink.svelte` is unchanged.
- Alias tokens (app.css `@theme` and `tokens.color`): `--color-card-foreground`, `--color-popover`, `--color-popover-foreground`, `--color-muted`, `--color-accent`, `--color-accent-foreground`, `--color-input`, `--color-destructive-foreground`. All reuse Phase 2 hex values. Six pairs joined `contrastPairs` (destructive-foreground/destructive, input on card/surface/background, primary on card, card on primary); `failingPairs()` stays `[]`.
- app.css gained exactly `@import 'shadcn-svelte/tailwind.css';`, `@import 'tw-animate-css';`, the 8 aliases, and `@utility key-digits`. No oklch, `.dark`, `@custom-variant dark`, or `var(--radius)`.
- Class guard: `corepack pnpm ui:guard` (= `node scripts/ui-class-guard.mjs`) scans 43 files and runs in `verify` right after `pnpm banned`. CI hygiene has a matching `run:` step, so the SHA-pinned `uses:` count is unchanged.

## Future shadcn `add` procedure (Phases 4-9)

`components.json` stays as written (style vega, official registry, `tailwind.css: src/app.css`). Any later `shadcn-svelte@1.6.1 add` must repeat the reconciliation. First back up `apps/web/src/app.css` and `apps/web/package.json` outside `src/`. Then run `add <names> --yes --no-deps-install`. Next restore `app.css`, because `add` can rewrite CSS for components that carry `cssVars`. Remove any caret entries the CLI wrote and reinstall exact pins with `corepack pnpm --filter web add -D -E ...`. Then run `git diff --exit-code pnpm-workspace.yaml`, `corepack pnpm format`, and the token reconciliation, and run `pnpm ui:guard` before committing.

## Task Commits

1. **Task 2 RED: alias token contrast tests** - `115b022` (test)
2. **Tasks 1+2: init, pins, utils, aliases, reconciled primitives** - `fcf12f0` (feat)
3. **Task 3 RED: UI class guard tests** - `1126cc8` (test)
4. **Task 3 GREEN: guard in verify and CI** - `4d50493` (feat)

## Decisions Made

See frontmatter `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] init's CSS confirm prompt aborted on piped stdin**
- **Found during:** Task 1
- **Issue:** With no TTY, the piped Enter did not answer the "Updates to your src/app.css… Continue?" prompt. init exited after writing `components.json` and `utils.ts`, and it skipped its CSS and dependency writes.
- **Fix:** I continued with `add`, which succeeded with the existing `components.json`. Because app.css is restored from backup anyway and deps are re-pinned by hand, the end state matches the verified procedure. `cmp` confirmed app.css was byte-identical to the backup before editing.
- **Commit:** fcf12f0

**2. [Rule 1 - Bug] stray `minimumReleaseAgeExclude: '@lucide/svelte@1.52.0'` in pnpm-workspace.yaml**
- **Found during:** Task 2 verification
- **Issue:** The entry appeared after the dependency install had already checked clean. It was most likely left by the CLI's dependency step or by a concurrent install from another executor. The lockfile only has 1.45.0.
- **Fix:** I ran `git checkout -- pnpm-workspace.yaml`, then `pnpm install --frozen-lockfile` to confirm it is not re-added. `git diff --exit-code pnpm-workspace.yaml` passes.

**3. [Rule 1 - Bug] Alert's `group/alert` and default variant**
- **Issue:** alert-title uses `group-has-[>svg]/alert:`, so `group/alert` was kept on the base. The script default `variant = 'default'` was changed to `'info'` (svelte-check error).
- **Commit:** fcf12f0

## Issues Encountered

- `svelte-check` shows 2 errors in `apps/web/src/lib/storage/secrets/vault.test.ts`. That file belongs to a parallel executor and is still in progress (it was out of scope and was not touched). Check was clean for every file this plan owns.

## Verification

- `corepack pnpm vitest run --project brand` 13/13, web theme-parity 6/6, `test:unit` 480/480
- `build:root`, `build:sub`, `csp:assert` (14 pages each), `test:e2e` 306 passed (run under `.tools/build.lock`, which was released)
- `pnpm lint`, `pnpm banned`, `pnpm ui:guard` (43 files), `lint:workflows`, `workflow-gate` all pass
- `git diff --exit-code pnpm-workspace.yaml` passes

## Known Stubs

None.

## Self-Check: PASSED
