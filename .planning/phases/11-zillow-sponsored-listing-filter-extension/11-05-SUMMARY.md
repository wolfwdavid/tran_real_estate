---
phase: 11-zillow-sponsored-listing-filter-extension
plan: 05
subsystem: extension
tags: [popup, state-model, dependency-injection, css-tokens, vitest]

requires:
  - phase: 11-01
    provides: "messages.ts (GET_COUNT, COUNT_PUSH, CountResponse, CountPush), copy.ts (COPY), extension Vitest project"
  - phase: 02
    provides: "@tran/brand themeVars() and motion.fast"
provides:
  - "apps/extension/src/lib/popup-model.ts: PopupState (7 kinds), PopupDeps, PopupStatus, loadStatus, applyPush, isZillowUrl, countLabel, stateCopy"
  - "apps/extension/src/entrypoints/popup/tokens.css: the 18 popup tokens on :root, a literal mirror of @tran/brand"
affects: [11-04, 11-09]

tech-stack:
  added: []
  patterns:
    - "Popup browser calls injected through PopupDeps (readEnabled, writeEnabled, activeTab, sendToTab, onCountPush); faked with vi.fn() because fakeBrowser lacks tabs.sendMessage"
    - "Token parity test parses tokens.css and compares each declaration to themeVars()"

key-files:
  created:
    - apps/extension/src/lib/popup-model.ts
    - apps/extension/src/entrypoints/popup/tokens.css
    - apps/extension/tests/popup-model.test.ts
    - apps/extension/tests/popup-tokens.test.ts
  modified: []

key-decisions:
  - "11-05: loadStatus validates the content script's reply; a malformed response (e.g. negative count) resolves to not-running instead of a bogus count"
  - "11-05: A Zillow tab with no tab id resolves to not-running without calling sendToTab; a rejected activeTab() resolves to not-zillow"
  - "11-05: applyPush ignores pushes when the active tab id or sender id is unknown; it can recover loading and not-running but never overrides not-zillow or storage-error"

patterns-established:
  - "popup-model.ts stays free of any browser import; the real deps wiring lands in 11-09 popup/deps.ts"

requirements-completed: []

duration: 8min
completed: 2026-10-26
---

# Phase 11 Plan 05: Popup State Model and Token Mirror Summary

**A pure, dependency-injected popup model that resolves all seven UI-SPEC states from the setting, the active tab and the content script's reply, plus a `tokens.css` locked to `@tran/brand` by a parity test.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-26T02:35:57Z
- **Completed:** 2026-10-26T02:44:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `loadStatus` applies the State Matrix precedence (storage-error, off, not-zillow, not-running, zero/counting). It sends exactly `{ type: 'tran-slf:get-count' }` to the active tab id, and only when the filter is on and the tab is on Zillow.
- `isZillowUrl` uses URL parsing (http/https only, `zillow.com` or `*.zillow.com`) and rejects `notzillow.com`, `zillow.com.evil.test`, `chrome://` and unparseable input.
- `applyPush` folds live pushes from the active tab only. `countLabel` uses `Intl.PluralRules('en-US')`, and `stateCopy` returns the exact COPY strings.
- 34 popup-model tests and 22 popup-token tests pass.
- Mutation-checked the token test: a planted `#006aff` failed 2 tests and an extra `a {}` selector failed 3. The file was restored afterwards.

## Task Commits

1. **Task 1 RED: failing popup model tests** - `c10ca50` (test)
2. **Task 1 GREEN: popup state model** - `ae76445` (feat)
3. **Task 2 RED: failing popup token mirror test** - `9c951d1` (test)
4. **Task 2 GREEN: popup token mirror** - `208959c` (feat)

## Files Created/Modified

- `apps/extension/src/lib/popup-model.ts`: the state model (no browser import; `grep -c "wxt/browser"` is 0).
- `apps/extension/src/entrypoints/popup/tokens.css`: 18 `:root` custom properties. Every value matched `themeVars()`, so no literal from the plan needed changing.
- `apps/extension/tests/popup-model.test.ts`: hand-made `PopupDeps` fakes with `vi.fn()`.
- `apps/extension/tests/popup-tokens.test.ts`: checks for a single `:root` block, exactly 18 names each declared once, values equal to `themeVars()` (`--duration-fast` equal to `${motion.fast}ms`), and lowercase hex.

## Decisions Made

See key-decisions in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Defensive handling beyond the behavior list**
- **Found during:** Task 1
- **Issue:** The plan did not cover a rejected `activeTab()`, a Zillow tab without an id, or a malformed content-script reply.
- **Fix:** They resolve to not-zillow, not-running (no send) and not-running respectively. Each case has a test.
- **Files modified:** apps/extension/src/lib/popup-model.ts, apps/extension/tests/popup-model.test.ts
- **Commit:** ae76445

**2. [Process] Separate RED commit for Task 2**
- The plan named a single `feat(11-05): popup token mirror` commit. Under the TDD protocol the failing test was committed first (`9c951d1`), then the stylesheet (`208959c`).

**Total deviations:** 2 (minor). **Impact:** none on scope.

## Issues Encountered

- The first commit (`c10ca50`) carries a co-author trailer. A parallel executor had already committed on top of it before this was noticed, so shared history was not rewritten. Later commits have no trailer.
- `corepack pnpm --filter extension check` reports 1 error in `tests/icons.test.ts` (owned by a parallel wave-2 plan). Out of scope. popup-model and popup-tokens type-check clean.
- The full `extension` project currently shows 2 failing files, `detect.test.ts` and `fixtures.test.ts`. Both are another plan's in-flight RED tests (`../src/lib/detect` does not exist yet). All 133 tests that load pass.
- `brand-parity.test.ts` (11-04) has not landed yet, so it could not be run against `tokens.css` in this plan.
- `pnpm lint` was scoped to this plan's files (ESLint and Prettier clean), because other executors' work-in-progress files share the tree.

## Known Stubs

None.

## Next Phase Readiness

11-09 can wire the real `PopupDeps` (`enabledSetting`, `browser.tabs.query({ active: true, currentWindow: true })`, `browser.tabs.sendMessage`, and `runtime.onMessage` filtered by `isCountPush` with `sender.tab?.id`) and render `stateCopy`/`countLabel` directly. EXT-02 stays open until the popup UI lands.

---
*Phase: 11-zillow-sponsored-listing-filter-extension*
*Completed: 2026-10-26*

## Self-Check: PASSED

All 4 key files exist; commits c10ca50, ae76445, 9c951d1, 208959c are present.
