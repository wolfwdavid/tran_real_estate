---
phase: 11-zillow-sponsored-listing-filter-extension
plan: 08
subsystem: extension
tags: [mv3, mutation-observer, debounce, spa-navigation, virtualized-list, happy-dom, fake-timers]

requires:
  - phase: 11-03
    provides: "findContainer, itemsIn, classify, fixtures A-D + adSlotFill"
  - phase: 11-04
    provides: "ensurePill/removePill/pillButton, content stylesheet keyed on data-tran-slf*"
  - phase: 11-01
    provides: "CONFIG, PILL_TAG, DEBOUNCE_MS/MAX_WAIT_MS/RETRY_MIN_MS/RETRY_MAX_MS, EnabledSetting, COUNT_PUSH"
provides:
  - "reconcile(container, state, cfg) / unmarkAll(root): idempotent, reversible, recycled-node safe"
  - "observeContainer(container, onFlush, timers) / isOwnMutation(record): scoped, debounced, loop-free"
  - "startFilter(deps): DI controller (count, enabled, rescan, stop) for the 11-10 content-script entrypoint"
affects: [11-10, 11-11, 11-12]

tech-stack:
  added: []
  patterns:
    - "All timing through injected Timers so fake timers drive every path"
    - "Trailing debounce plus independent max-wait ceiling timer (no clock reads)"
    - "Container check loop shared by start-up discovery and post-navigation verification"

key-files:
  created:
    - apps/extension/src/lib/reconcile.ts
    - apps/extension/src/lib/observe.ts
    - apps/extension/src/lib/filter.ts
    - apps/extension/tests/reconcile.test.ts
    - apps/extension/tests/observe.test.ts
    - apps/extension/tests/filter.test.ts
  modified: []

key-decisions:
  - "Reconcile drops unregistered tran-slf-pill children (cloned hosts without a shadow root) via removeChild, since removePill only knows live hosts"
  - "After wxt:locationchange the controller re-acquires after the 150 ms debounce, then keeps re-checking the container 5 more times (250 ms doubling) to catch a late React container swap"
  - "Swapping containers unmarks the old one and disconnects its observer before observing the new one"
  - "The setting watch is registered before the initial getValue await, so a toggle during start-up is not lost"

requirements-completed: [EXT-01, EXT-02]

duration: 12min
completed: 2026-10-25
---

# Phase 11 Plan 08: Reconcile, Scoped Observer and Filter Controller Summary

**Content-script core: an idempotent label/ad-slot reconcile pass with WeakSet reveal memory, a container-scoped 150/600 ms debounced MutationObserver that ignores its own pills, and a DI `startFilter` controller that handles late fills, text swaps, container swaps, SPA navigation, on/off with a byte-exact restore, and deduplicated count publishing.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-10-25
- **Tasks:** 2 (both TDD, RED then GREEN)
- **Files created:** 6

## Accomplishments

- `reconcile` marks hits with `data-tran-slf="dimmed"|"revealed"`, adds `data-tran-slf-pos` only for static/empty computed position (kept until unmark, because the stylesheet then makes the item relative), keeps exactly one pill per item, and unmarks every non-hit, which covers recycled virtualized nodes. Revealed items are excluded from the count. A disabled pass and `unmarkAll` both restore the original `outerHTML` byte-for-byte.
- The live-Zillow case is covered: an ad-slot `li` whose "Loading..." placeholder is swapped for an `iframe` stays dimmed with the same pill. If React replaces every child (pill included), the next pass adds a fresh pill.
- `observeContainer` observes `{ childList: true, subtree: true, characterData: true }` on the container only. Records consisting only of pill hosts are ignored. The trailing debounce is 150 ms with a 600 ms cap.
- `startFilter` covers these cases:
  - Container discovery retries at 250/500/1000/2000/4000/4000 ms and never falls back to the document.
  - A flush re-acquires the container when `!container.isConnected`.
  - Navigation re-acquires after the debounce, then runs verification checks.
  - `setting.watch` either reconciles or restores the page.
  - Pill toggles recount and publish.
  - Publishes are deduplicated.
  - `stop()` disconnects the observer, unwatches the setting, cancels all timers (`vi.getTimerCount() === 0`) and restores the DOM.

## Task Commits

1. **Task 1: Idempotent reconcile**: `32a4090` (test, RED), `5b0d466` (feat, GREEN)
2. **Task 2: Scoped observer + filter controller**: `cb26736` (test, RED), `8b9974c` (feat, GREEN; includes 3 extra controller tests added after mutation testing)

## Verification

- `corepack pnpm vitest run --project extension reconcile`: 10 passed.
- `corepack pnpm vitest run --project extension observe filter`: 22 passed (7 observe + 15 filter).
- Full `--project extension` suite passed. `corepack pnpm --filter extension check`: 0 errors. `corepack pnpm lint`: exit 0.
- Acceptance greps: `.remove()|display:none` in reconcile.ts = 0. `attributes:|document.body` = 0 in both observe.ts and filter.ts. filter.ts imports no `wxt/*`.
- Mutation sanity (none committed, all reverted):
  - Adding `attributes: true` to the observer options turned 3 tests RED, including the no-loop test.
  - Removing the reconcile unmark branch turned the recycled-node tests RED (2).
  - Removing the own-mutation filter turned the no-loop test RED.
  - Removing the max-wait timer turned the max-wait test RED.
  - Removing the backoff doubling turned 2 retry tests RED.
  - Disabling the `isConnected` re-acquire turned 2 tests RED. The new tests were added for this, because the mutation first survived.
  - Dropping the post-navigation verification turned the late-swap test RED. This was also added after the mutation first survived.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cloned items carried a dead pill host**
- **Found during:** Task 1 (clone test)
- **Issue:** `cloneNode(true)` on a marked item copies the `<tran-slf-pill>` element but not its closed shadow root or WeakMap registration. `ensurePill` then added a second host, and `removePill` could never remove the stray.
- **Fix:** `reconcile.ts` drops unregistered pill-tag children (`pillButton(child) === null`) in mark, unmark and `unmarkAll`, using `removeChild`. Live pills are still removed only through `removePill`.
- **Files modified:** apps/extension/src/lib/reconcile.ts
- **Commit:** 5b0d466

**2. [Rule 2 - Missing critical] Post-navigation container verification and mutation-gap tests**
- **Found during:** Task 2 mutation sanity
- **Issue:** the plan's single re-acquire at navigation debounce misses a container that React swaps after 150 ms. A detached container's observer never fires again, so the filter would silently stop. The `isConnected` branch was also untested.
- **Fix:** after a navigation, the controller runs up to 5 extra container checks (250 ms doubling, reusing the retry loop). Three tests were added: late swap after navigation, swap during a mutation burst, and `rescan()` re-acquire.
- **Files modified:** apps/extension/src/lib/filter.ts, apps/extension/tests/filter.test.ts
- **Commit:** 8b9974c

**Total deviations:** 2. **Impact:** none on scope or interfaces.

## Known Stubs

None. The content-script entrypoint (`zillow.content/index.ts`) is still the 11-06 stub. Plan 11-10 wires `startFilter` into it.

## Next Phase Readiness

- 11-10 can wire `startFilter({ doc: document, setting: enabledSetting, timers: { setTimeout: ctx.setTimeout, clearTimeout }, onNavigate: cb => ctx.addEventListener(window, 'wxt:locationchange', cb), publish: push => browser.runtime.sendMessage(push) })` and call `stop()` from `ctx.onInvalidated`.

## Self-Check: PASSED

- FOUND: apps/extension/src/lib/reconcile.ts, observe.ts, filter.ts and the three test files
- FOUND commits: 32a4090, 5b0d466, cb26736, 8b9974c
