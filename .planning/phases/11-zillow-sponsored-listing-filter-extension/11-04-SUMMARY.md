---
phase: 11-zillow-sponsored-listing-filter-extension
plan: 04
subsystem: extension
tags: [mv3, shadow-dom, constructable-stylesheet, a11y, brand-tokens, happy-dom]

requires:
  - phase: 11-01
    provides: "COPY pill strings, PILL_TAG, happy-dom extension test project"
  - phase: 02
    provides: "@tran/brand tokens, themeVars(), motion"
provides:
  - "ensurePill/removePill/pillButton: one closed-shadow reveal pill per dimmed item, first child, click-safe"
  - "PILL_CSS constructable-sheet text (UI-SPEC Color B, focus triple ring, forced-colors, reduced motion)"
  - "zillow.content/style.css manifest content CSS (dim rule, host positioning, isolation, reduced motion, print)"
  - "brand-parity gate over every src/**/*.{css,ts,svelte} file"
affects: [11-05, 11-08, 11-10]

tech-stack:
  added: []
  patterns:
    - "Closed shadow root reachable only through a module-private WeakMap (pillButton accessor)"
    - "One CSSStyleSheet per Document, built with the document's own realm constructor"
    - "Latest onToggle stored in a WeakMap so re-ensure never stacks listeners"

key-files:
  created:
    - apps/extension/src/lib/reveal-host.ts
    - apps/extension/src/lib/pill-css.ts
    - apps/extension/src/entrypoints/zillow.content/style.css
    - apps/extension/tests/reveal-host.test.ts
    - apps/extension/tests/brand-parity.test.ts
  modified: []

key-decisions:
  - "11-04: Pill isolation = closed shadow root + shared constructable sheet (RESEARCH Pattern 4), not UI-SPEC 'No shadow DOM'; data-tran-slf-pill sits on the host, the button is inside the root; visual contract unchanged"
  - "11-04: reveal-host makes no assumption about item contents; it works on a property-card article, its li, or an ad-slot li wrapping only an iframe (live zillow.com 2026-10-25)"
  - "11-04: ensurePill only rewrites button text when the state changes, so the focused button is never replaced and focus stays on the pill"

patterns-established:
  - "Brand parity: any hex in src must be a tokens.color value; .svelte files carry no hex; --color/--radius/--font/--ease decls equal themeVars(); --duration-fast equals motion.fast"

requirements-completed: []

duration: 12min
completed: 2026-10-25
---

# Phase 11 Plan 04: Reveal Pill and Content Stylesheet Summary

**A closed-shadow-root `<button type="button">` reveal pill per dimmed item, styled by one constructable sheet per document, plus attribute-scoped manifest dimming CSS and a brand-parity gate that rejects any non-token color (Zillow blue included).**

## Performance

- **Duration:** about 12 min
- **Tasks:** 2 (Task 1 as TDD RED and GREEN)
- **Files created:** 5

## Accomplishments

- `ensurePill(item, revealed, onToggle)` prepends exactly one `<tran-slf-pill data-tran-slf-pill>` host. The host has a closed root (`host.shadowRoot === null`) that holds a real button. The visible text is "Sponsored — show" or "Sponsored — dim", followed by a `.vh` hidden suffix taken from COPY. The button has no `aria-label` and no `aria-pressed`.
- Click calls `preventDefault` and `stopPropagation`, then the latest callback. `pointerdown/up`, `mousedown/up` and `auxclick` are swallowed too. Zillow's card, item and body listeners never fire (tested).
- Every root in a document shares one sheet. A second happy-dom Window gets its own sheet, because sheets are per realm. No `<style>` element, no `innerHTML`, no `createShadowRootUi`, no fetch.
- `removePill` restores the item's `outerHTML` byte for byte.
- `style.css` follows the UI-SPEC values exactly. Every selector starts with `[data-tran-slf`, there is no `url(`, and `display: none` appears only inside `@media print`.
- Live-Zillow finding covered: tests mount the pill on `li[data-testid="search-list-first-ad"]` when it wraps only an `iframe`, and on a bare `article`. A parity-file test runs the real dim selector from `style.css` through `querySelectorAll`. It matches the card's `article` and the ad slot's `iframe`, and never matches the pill host or a revealed item.
- Tests: reveal-host 19 and brand-parity 18 (one case per scanned src file, so the count grows as wave-2 files land).

## Task Commits

1. **Task 1 RED: failing reveal pill tests** - `7387215` (test)
2. **Task 1 GREEN: closed-shadow reveal pill** - `349c214` (feat)
3. **Task 2: content stylesheet and brand parity gate** - `5c514d4` (feat)

## Deviation from UI-SPEC

- **Isolation mechanism:** the pill uses a CLOSED shadow root on an unregistered `<tran-slf-pill>` host with one shared constructable `CSSStyleSheet` per document (RESEARCH Pattern 4). The UI-SPEC's "No shadow DOM, `all: initial` + `!important` on the button" is not used. Reason: page `style-src` cannot block an adopted sheet, page CSS cannot reach into the root, and WXT's `createShadowRootUi`/`cssInjectionMode: 'ui'` would bundle a `fetch()` and add `web_accessible_resources` (EXT-03).
- **Attribute placement:** `data-tran-slf-pill` is on the host element, and the button is inside the shadow root. The dim rule `[data-tran-slf='dimmed'] > :not([data-tran-slf-pill])` therefore skips the host.
- **Visual contract unchanged:** text, two-tone neutral colors, 2px ring, 32px min-height, `inset: -8px 0` hit area, focus triple ring, forced-colors, reduced motion, print, dim opacity .35 + grayscale, first-child placement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `new URL(..., import.meta.url)` fails in the happy-dom project**
- **Found during:** Task 2
- **Issue:** under happy-dom, `import.meta.url` is not a `file:` URL, so `fileURLToPath` threw.
- **Fix:** used `join(import.meta.dirname, '..', 'src')`, the same as `copy-banned.test.ts`.
- **Commit:** 5c514d4

**2. [Rule 2 - Correctness] Extra tests beyond the behavior list**
- Added: click `defaultPrevented`, re-ensure swaps the callback without stacking listeners, the `removePill` no-op, `pillButton(null-case)`, the ad-slot `li`+`iframe` and bare `article` mounts, the dim-selector match test, and accept-cases for the parity checker (uppercase token hex, `--ease-out`, `--duration-fast`).

**Total deviations:** 2 (minor). **Impact:** none on scope.

## Verification

- `corepack pnpm vitest run --project extension brand-parity reveal-host`: 37 passed.
- Mutation sanity (not committed, reverted): `#5c4a3e` changed to `#006aff` in pill-css.ts turned brand-parity RED (`lib/pill-css.ts: #006aff is not a Phase 2 token`). Removing the click `stopPropagation()` turned reveal-host RED (1 failed). Appending `.foo { display: none; }` to style.css turned 2 style tests RED.
- Acceptance greps: `innerHTML|createElement('style')|aria-label|aria-pressed|createShadowRootUi` count in reveal-host.ts = 0; `url(` count in style.css = 0.
- ESLint is clean on `apps/extension`, and Prettier is clean on all files in this plan.

## Issues Encountered (out of scope, owned by parallel wave-2 plans)

- `corepack pnpm --filter extension check` reports 1 error in `tests/icons.test.ts:14` (another plan's file). This plan's files type-check clean.
- Root `corepack pnpm lint` flags `apps/web/src/routes/(marketing)/legal/privacy/+page.svelte` formatting (another plan's in-flight edit).
- The full extension project shows 7 failures in `detect.test.ts` and `fixtures.test.ts`. Those belong to plans 11-02/11-03, which were mid-execution.

## Known Stubs

None. `style.css` is not imported yet; plan 11-10 adds `import './style.css'` to the content entry as designed.

## Next Phase Readiness

11-10 can wire `ensurePill(item, revealed, toggle)` and `removePill(item)` from the reconciler, set `data-tran-slf` / `data-tran-slf-pos` on the dim target, and import `style.css`. The parity gate covers popup `tokens.css`, which is already present from 11-05, as well as any later src file.

---
*Phase: 11-zillow-sponsored-listing-filter-extension*
*Completed: 2026-10-25*

## Self-Check: PASSED

All 5 key files exist; commits 7387215, 349c214, 5c514d4 are present.
