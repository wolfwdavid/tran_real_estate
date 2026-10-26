---
phase: 11-zillow-sponsored-listing-filter-extension
plan: 03
subsystem: extension
tags: [detector, happy-dom, vitest, fixtures, label-first]

requires:
  - phase: 11-01
    provides: "CONFIG (selectors.v1.json), normalizeLabel, MAX_TEXT_LEN/MAX_ATTR_LEN, PILL_TAG, happy-dom extension project"
provides:
  - "apps/extension/src/lib/detect.ts: pure findContainer / itemsIn / classify with Hit { category, via }"
  - "apps/extension/tests/fixtures/cards.ts: synthetic fixtures A-D, adSlotFill, FIXTURES, mount()"
affects: [11-08, 11-10, 11-11]

tech-stack:
  added: []
  patterns:
    - "Ad-slot hook wins first (label-independent); then exact short text labels; then exact short aria-label/title/alt"
    - "Exact Map lookup on normalized strings, never substring; reveal pill, script, style, noscript, template subtrees ignored"
    - "itemsIn returns outermost elements in document order; the ad-slot li itself is the dim target"

key-files:
  created:
    - apps/extension/src/lib/detect.ts
    - apps/extension/tests/fixtures/cards.ts
    - apps/extension/tests/detect.test.ts
    - apps/extension/tests/fixtures.test.ts
  modified: []

key-decisions:
  - "11-03: Ad slots (li[data-testid=search-list-*-ad]) classify as { category: 'ad', via: 'ad-slot' } and the li is returned as the item, because live ad slots hold an iframe and no property-card article"
  - "11-03: Fixture B gained b-7 (search-list-third-ad, iframe-only) and b-3 uses a generic 'Loading...' pre-load state, covering both live ad-slot shapes"
  - "11-03: Showcase stays out of the default vocabulary; it is an owner decision candidate for 11-HUMAN-UAT"

requirements-completed: []

duration: 7min
completed: 2026-10-26
---

# Phase 11 Plan 03: Label-First Detector and Synthetic Fixtures Summary

**A pure detector that marks interleaved ad slots no matter what label they carry, plus exact-match Sponsored/Promoted/Featured/Ad labels in short text and aria-label/title/alt values. Four hand-written fixtures (A-D) prove it never flags organic look-alikes such as "Featured amenities", "Address", "Ad-free building" or Showcase.**

## Performance

- **Duration:** about 7 min
- **Started:** 2026-10-26T02:35:30Z
- **Completed:** 2026-10-26T02:42:30Z
- **Tasks:** 2 (3 commits, TDD RED then GREEN)
- **Files created:** 4

## Accomplishments

- `findContainer`, `itemsIn` and `classify` are pure DOM functions. They read only the bundled hook selectors, text nodes of 32 characters or fewer, and `aria-label`/`title`/`alt` values of 48 characters or fewer. The acceptance grep for ids, hrefs, zpid, page JSON and `.textContent` finds 0 matches.
- Ad-slot classification is label-independent and covers all three live shapes: the pre-load "Loading..." spinner state (b-3), a text fill (b-6), and the loaded iframe-only unit (b-7). `adSlotFill` is exported for the late-fill tests in 11-08.
- Showcase classifies only with `{ optIn: ['showcase'] }`. By default it returns null.
- 27 new tests (9 fixture, 18 detector). The whole `extension` project passes: 12 files, 178 tests.
- Mutation check: switching the label lookup to substring `includes` failed 6 fixture tests across A, B and C. The detector file was then reverted and `git diff --exit-code` passed.

## Task Commits

1. **Task 1: Synthetic fixtures A-D** - `837092c` (test)
2. **Task 2 RED: failing detector and fixture tests** - `e0ea581` (test)
3. **Task 2 GREEN: label-first detector** - `796ce8e` (feat)

## Fixture Coverage

| Fixture | Shape | Dimmed | Clean (negatives) |
|---------|-------|--------|-------------------|
| A | `#grid-search-results > ul > li[List.Item] > article[property-card]` with BadgeArea/Badge | a-1 Featured, a-2 Sponsored, a-7 "PROMOTED ·" | a-3 Showcase (opt-in off), a-4 Gas fireplace, a-5 Special Offer, a-6 "Featured amenities" |
| B | Same container with ad-slot `li`s and no card inside | b-3 first-ad (Loading... + svg), b-6 second-ad ("Promoted community"), b-7 third-ad (bare iframe) | b-1, b-2 "Address", b-4 "Modern finishes", b-5 |
| C | `#search-page-list-container > ul > li > div`, no data-testid/c11n anywhere | c-1 Sponsored, c-2 "sponsored listing:", c-3 Ad | c-4 "Ad-free building", c-5 a sentence over 32 chars |
| D | Card grid with labels only in attributes | d-1 aria-label "Sponsored listing", d-2 img alt "Promoted" (no src), d-3 title "Featured listing" | d-4 aria-label "Save this home", d-5 aria-label over 48 chars |

Fixtures contain no `src=`, `href=`, `url(` or `http` (grep count 0), and all text is fictional. `node scripts/guard-real-data.mjs --all` passed (1780 files). No Zillow class names or copied markup are used. The only hooks are the `data-testid` / `data-c11n-component` names already in `selectors.v1.json`.

## Owner Decision Candidate (for 11-HUMAN-UAT)

- **Showcase.** On 2026-10-25 the orchestrator inspected live zillow.com results for Brooklyn rentals and for-sale and saw "Showcase" as a badge. Showcase is Zillow's paid listing-enhancement product. It is outside the locked v1 vocabulary, so it was **not** added to the selectors or the default labels. The detector already supports it as an opt-in category (`optIn: ['showcase']`). The owner decides whether to expose an opt-in toggle.
- **Context from the same inspection:** no rendered card (0 of about 47) showed a visible "Sponsored", "Featured", "Promoted" or "Ad" label. On today's Zillow, the ad-slot path is the signal that actually fires. Label-first matching is kept as the forward-compatible vocabulary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] Ad-slot fixture extended to the live shapes**
- **Found during:** Task 1
- **Issue:** The plan's b-3 was an empty `div`. The live findings show ad slots render a "Loading..." spinner first and then an iframe unit, with no property-card article.
- **Fix:** b-3 now holds a generic `<div><p>Loading...<svg aria-hidden="true"></svg></p></div>`. A new b-7 (`search-list-third-ad`) holds only `<div><iframe></iframe></div>` (no src). B's `dimmed` list is now b-3, b-6, b-7.
- **Commit:** 837092c

**2. [Rule 2 - Correctness] Extra ignored subtrees and tests**
- `noscript` and `template` are ignored along with the pill, `script` and `style`. Extra tests cover: a wrapper containing an ad slot, a late-filled slot, `optIn: []`, normalized "ADVERTISEMENT:" and "Featured Listing —", pill attributes, document order, and an empty container. The fixtures suite also asserts that ad-slot, label and attribute paths are all exercised.

**3. Commit message trailer removed**
- The first Task 1 commit (837092c) was amended to 837092c to drop an attribution trailer. Under the project rules, commit messages must not mention assistants. The commit was local and unpushed, and HEAD was verified as mine before amending.

**Total deviations:** 3, all minor. **Impact:** none on scope.

## Issues Encountered

- `corepack pnpm --filter extension check` reports 3 errors, none in this plan's files: `tests/icons.test.ts:14` and `packages/brand/src/index.ts:72` (pulled in by parallel wave-2 popup/icon work). The plan's own files type-check clean. Out of scope (parallel plans own them).
- A Bash heredoc with nested template literals failed to parse, so the test files were written with the file tool instead. Nothing functional changed.

## Known Stubs

None.

## Next Phase Readiness

11-08 (reconcile loop) can import `findContainer`/`itemsIn`/`classify` and reuse `FIXTURES`, `adSlotFill` and `mount`. The dim target for ad slots is the `li` itself, so the reveal host attaches as its direct child.

---
*Phase: 11-zillow-sponsored-listing-filter-extension*
*Completed: 2026-10-26*

## Self-Check: PASSED

All 4 created files exist; commits 837092c, e0ea581, 796ce8e are present.
