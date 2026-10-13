---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 25
subsystem: ai-ui
tags: [gap-closure, fair-housing, exits, svelte5, flushSync, debounce, snapshot, memo]
requires:
  - phase: 09
    provides: GenerationPanel.flushChecks() export and read-only checkPending bindable (09-24)
  - phase: 07
    provides: investor memo page and print link (INV-06)
provides:
  - SnapshotBuilder save() that flushes the notes panel's pending recheck before reading gateReason
  - MemoPage settlePrint() (flushChecks + flushSync) on onPrint, onPrintKey and pointerdown
  - Memo print link that carries no href while an edit recheck is pending (printLive)
affects: [Phase 9 re-verification, every host-owned exit that reads GenerationPanel bindables]
tech-stack:
  added: []
  patterns:
    - "Host-owned exits outside the panel settle first: panel?.flushChecks(); flushSync(); then read the bound gate"
    - "Host-owned link exits bind checkPending and withhold href while it is true; aria-disabled stays gate-based"
key-files:
  created: []
  modified:
    - apps/web/src/lib/features/studio/snapshot/SnapshotBuilder.svelte
    - apps/web/tests/e2e/snapshot-builder.spec.ts
    - apps/web/src/lib/features/investor/memo/MemoPage.svelte
    - apps/web/tests/e2e/investor/memo.spec.ts
    - .planning/phases/09-agent-content-studio-market-snapshot-reports/09-VALIDATION.md
key-decisions:
  - "Snapshot Save and memo Print flush the panel recheck and flushSync before reading the gate; the existing Must-fix rechecks stay as belt and braces"
  - "Memo print link uses printLive (printEnabled && !checkPending) for href/role/tabindex only; aria-disabled and the reason line stay on printEnabled so the link does not flicker while typing"
  - "No await tick() was needed before refuse() in SnapshotBuilder: flushSync renders the reason line and binds reasonEl synchronously"
requirements-completed: [STU-04]
duration: 16min
completed: 2026-10-13
---

# Phase 9 Plan 25: Snapshot Save and memo Print inside the recheck window Summary

**Snapshot Save and the investor memo Print link now run the panel's pending edit recheck (09-24 `flushChecks()` + `flushSync()`) before reading the gate, and the Print link has no href while an edit is unchecked, so a Review phrase typed while still editing can no longer save or print without its acknowledgement.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-10-13T15:16:29Z
- **Completed:** 2026-10-13T15:32:49Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- SnapshotBuilder: `flushSync` imported; `save()` calls `panel?.flushChecks(); flushSync();` directly after the `saving` guard, so `gateReason` reflects the current notes text and Review acknowledgement.
- MemoPage: `flushSync` imported; `checkPending` mirror bound from GenerationPanel; `printLive = printEnabled && !checkPending` drives `href`/`role`/`tabindex`; `settlePrint()` runs first in `onPrint`, in the reworked `onPrintKey` (calls `onPrint` only when the link is still not live, so a live link is never handled twice) and as the link's `onpointerdown` (middle-click / Ctrl-click see the settled href).
- E2E: keyless snapshot test types "Walking distance to church." while editing and presses Enter on Save (reason line focused, URL unchanged); memo test probes the pending href in one `evaluate` (null while pending, restored by pointerdown) and presses Enter on Print after typing the Review phrase (findings title focused, no navigation, link gated with no href).
- 09-VALIDATION.md: rows 9-25-01 and 9-25-02 added; title note now reads 09-01 … 09-25.

## Task Commits

1. **Task 1: Snapshot Save flushes the notes recheck first + E2E step** - `3fd0ae8` (fix)
2. **Task 2: Memo Print settles first, href withheld while pending + E2E steps + validation rows** - `985eb3f` (fix)

## Failing-first and mutation evidence

- **Task 1 RED (pre-fix build):** the new step failed at `expect(saveReason(page)).toBeFocused()` with `unexpected value "inactive"`: Save took the un-gated path inside the 300 ms window. This run is also the "remove both lines" mutation (the code was exactly the pre-fix save()).
- **Task 1 extra mutation:** keeping `panel?.flushChecks();` but deleting `flushSync();` failed the same assertion (`element(s) not found`), so the flushSync is load-bearing here too (same finding as 09-24). Restored; 5/5 green.
- **Task 2 RED (pre-fix build):** `expect(probe.pending).toBeNull()` failed with `Received: "/print/memo/?id=…&memo=…"` (live href during the pending recheck).
- **Task 2 mutation (a), deterministic:** `href={printEnabled ? printHref : undefined}` failed `probe.pending` the same way. Restored.
- **Task 2 mutation (b), timing-dependent:** removing `settlePrint();` from onPrint and onPrintKey (pointerdown kept) failed the Review-phrase step at `[id$="-findings-title"]` toBeFocused (`element(s) not found`: Enter followed the stale live href). Restored and rebuilt; 5/5 green.

## Verification run

- `corepack pnpm --filter web check`: 2616 files, 0 errors, 0 warnings
- eslint on both feature dirs and both specs; `prettier --check apps/web/src/lib/features apps/web/tests/e2e`; `pnpm lint`: clean
- `pnpm banned`: passed (384 files)
- `vitest --project web apps/web/src/lib/features/studio/snapshot apps/web/src/lib/features/investor/memo`: 8 files / 109 passed
- `pnpm build:root`, then Playwright root: snapshot-builder 5 passed, investor/memo 5 passed, snapshot-print 5 passed
- Grep criteria: `panel?.flushChecks();` directly followed by `flushSync();` in both hosts; `settlePrint();` x2; `onpointerdown={settlePrint}`; `href={printLive ? printHref : undefined}` present and no `href={printEnabled ? printHref`; `bind:checkPending`; both `flushSync` imports; 2 `| 9-25-0` rows.

No Node pin was needed: the health probe passed and no run hit the libuv assertion.

## Decisions Made

- No `await tick()` before `refuse()` in the Save gate branch: the E2E proved the reason line is focused without it.
- `aria-disabled` on the memo print link stays tied to `printEnabled` (gate), not to the pending state, matching 09-24's email link.

## Deviations from Plan

None - plan executed exactly as written. (Order adjusted only to show failing-first: each E2E step was written and run red before the source fix.)

## Issues Encountered

None.

## Follow-ups

- **Review-only Save reason copy (not fixed here, outside gap scope):** `save-gate.ts` passes `s.mustFix` to `notesFindingsReason` for a Review-only gate too, so the Save reason reads "Fix the 0 items marked Must fix in the market notes, and review any others." (seen in this plan's RED run output). Suggested fix: a separate Review-only reason when `mustFix === 0 && unackedReview`. The new E2E step matches only the stable substring 'in the market notes', so it survives that change.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

- All host-owned AI exits (snapshot Save, memo Print) and all panel exits (09-24) now read the gate only after a pending recheck runs. Phase 9 is ready for re-verification.

## Self-Check: PASSED

- FOUND: .planning/phases/09-agent-content-studio-market-snapshot-reports/09-25-SUMMARY.md
- FOUND commits: 3fd0ae8, 985eb3f
