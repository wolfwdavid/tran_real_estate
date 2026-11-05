---
phase: 14-carried-debt
plan: 03
subsystem: investor-memo-print
tags: [memo, print, number-check, artifact-meta, backup, DEBT-03]
requires:
  - "14-02 (serialized for the shared build dirs and Playwright ports)"
provides:
  - "memo-meta.ts: memoArtifactMeta(analysisHash, notes) and notesNumbersFromMeta(meta)"
  - "Memo artifacts carry the notes' allowed numerals under notesNumbers, notesNumbers.1 ... notesNumbers.11"
  - "/print/memo/ re-runs the number check with the analysis numerals plus the stored notes numerals"
  - "Unit pins for round-trip, chunking, overflow fail-closed, isMeta compatibility, and the backup export/import of memo meta"
  - "Print E2E notes-only case (root + sub)"
affects:
  - "14-05 (backup seed: the aiArtifacts memo row uses this meta shape; it survives the backup codec as proven here)"
  - "14-11 (close-out: HUMAN-UAT L66 row closes as decided (superseded by DEBT-03, ...), and its 'DEBT-02' label becomes DEBT-03 per D-07)"
tech-stack:
  added: []
  patterns:
    - "Numerals persisted as String(v) tokens (shortest round-trip form), so Number(token) restores the exact double the gate saw"
    - "Overflowing meta fails closed: store nothing rather than a partial allow-list"
key-files:
  created:
    - apps/web/src/lib/features/investor/memo/memo-meta.ts
    - apps/web/src/lib/features/investor/memo/memo-meta.test.ts
  modified:
    - apps/web/src/lib/features/investor/memo/MemoPage.svelte
    - apps/web/src/routes/(print)/print/memo/+page.svelte
    - apps/web/src/lib/ai/storage/artifacts.test.ts
    - apps/web/tests/e2e/investor/print.spec.ts
decisions:
  - "Notes numerals are stored as distinct String() values, single-space joined, greedy-packed into <= 200-char chunks under notesNumbers / notesNumbers.1 ... .11 (at most 12 chunks; with analysisHash and a possible copied key that is 14 of the store's 16 meta keys)"
  - "More than 12 chunks stores no notesNumbers at all, so the print page blocks on those numbers exactly as before (fail closed)"
  - "The reader skips empty tokens (Number('') is 0, which would silently allow a zero) and stops at the first missing chunk key"
  - "Old memos without notesNumbers keep the old fail-closed print until redrafted; no Dexie version bump because meta is not indexed"
  - "E2E notes sentence: notes 'Area rents rose 12% last year.', memo 'Monthly cash flow is $184. Area rents rose 12% last year.' Checked with runChecks + createMemoPostChecks: with the analysis numerals only it yields one block ('12%'); with the notes numerals added it yields no findings of any severity (no advice-language or Fair Housing warn)"
metrics:
  duration: "~15 min"
  completed: "2026-11-05"
  tasks: 2
  files: 6
---

# Phase 14 Plan 03: Memo print with notes-only numerals Summary

A memo that quotes a number found only in the user's notes now prints at `/print/memo/`. The notes' allowed numerals are written into the memo artifact `meta` when the memo is created, and the print page adds them back to the allowed set when it re-runs the gate. A memo with a Must fix number that is in neither the facts nor the notes is still blocked.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 (RED) | Pin meta round-trip, chunking, overflow, backup meta | 62b8b37 | memo-meta.test.ts, artifacts.test.ts |
| 1 (GREEN) | memo-meta module + write/read wiring | 1540bc4 | memo-meta.ts, memo-meta.test.ts (prettier), MemoPage.svelte, print/memo/+page.svelte |
| 2 | Print E2E notes-only case | 96f6264 | tests/e2e/investor/print.spec.ts |

## Meta format

- `analysisHash`: unchanged.
- `notesNumbers`, `notesNumbers.1` ... `notesNumbers.11`: the distinct finite values of `allowedFromText(notes, 'your notes')`, each in `String(v)` form, joined by single spaces, packed greedily so that each chunk is at most 200 chars and no value is split. Keys are written in order and only when there is at least one value.
- If the values need more than 12 chunks, none are written (fail closed).
- `notes` is `facts.notes`: trimmed, and `''` when the notes are over 1,000 characters, so over-limit notes add nothing.

Old memos (created before this plan) have no `notesNumbers`. They keep the old fail-closed print for a notes-only number until the user drafts again. There is no migration and no Dexie version bump, because `meta` is not indexed.

## Verification

- `vitest run --project web memo-meta.test.ts artifacts.test.ts`: 2 files, 37 tests passed (9 new in memo-meta.test.ts, 1 new in artifacts.test.ts).
- `pnpm --filter web check`: 3268 files, 0 errors, 0 warnings. ESLint and Prettier clean on all touched files.
- `playwright test tests/e2e/investor/print.spec.ts --project root --project sub`: 10 passed (the new notes-only case and the unchanged blocked case on both projects).
- `playwright test print.spec.ts memo.spec.ts --project root` after the final rebuild: 10 passed.
- `pnpm budget:assert` (root build and configured build): passed, 9 gated routes within 60 KB in each build, with the marketing routes unchanged at 59.6 to 59.8 KB. The new module loads only on the investor memo and print routes.

## Mutation ledger

| # | Mutation | Expected | Observed | Restored |
| - | -------- | -------- | -------- | -------- |
| 1 | `memoArtifactMeta` returns `{ analysisHash }` only (the dropped meta write, at unit level) | memo-meta round-trip and the artifacts backup meta test fail | 5 failed / 32 passed: round-trip, String() form, chunking, 12-chunk fill, and `backup export then import keeps memo meta (notes numerals, DEBT-03)` | Restored from a copy; `git status` clean for the file; 37/37 green |
| 2a | `MemoPage.svelte` back to `artifactMeta={{ analysisHash: hash }}`, rebuild root | notes-only E2E red | `notes-only` failed: `[data-ready]` not found | `git checkout`; rebuilt root; green |
| 2b | print page back to `createMemoPostChecks(memoFactsForDeal(current, '').allowed)`, rebuild root | notes-only E2E red | `notes-only` failed: `[data-ready]` not found; the page snapshot shows heading "This memo has flags to fix before printing" | `git checkout`; rebuilt root; print + memo specs 10/10 green |

## Deviations from Plan

**1. [Formatting] The print page diff is 5 lines, not the planned 3 or fewer**
- **Found during:** Task 1
- **Issue:** The one-line `createMemoPostChecks([...a, ...b])` call exceeds Prettier's print width, so Prettier wraps it over four lines. With the import line, the diff is 5 lines.
- **Fix:** None needed. Kept the Prettier output, since the repo's lint gate requires it. The change is still the single planned expression plus one import, and `grep -c "notesNumbersFromMeta(artifact.meta)"` returns 1.
- **Commit:** 1540bc4

**2. [Rule 2 - Correctness] Reader skips empty tokens**
- **Found during:** Task 1
- **Issue:** `Number('')` is `0`, so a stray double space in a hand-edited backup would add `0` to the allowed set.
- **Fix:** `notesNumbersFromMeta` skips empty tokens. A unit test pins this (`'Infinity NaN  -3 abc 0.5'` returns `[-3, 0.5]`).
- **Commit:** 1540bc4

Apart from these two, the plan was executed as written. memo-checks.ts was not changed (D-03).

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: apps/web/src/lib/features/investor/memo/memo-meta.ts
- FOUND: apps/web/src/lib/features/investor/memo/memo-meta.test.ts
- FOUND: commits 62b8b37, 1540bc4, 96f6264 (no Co-Authored-By trailers)
