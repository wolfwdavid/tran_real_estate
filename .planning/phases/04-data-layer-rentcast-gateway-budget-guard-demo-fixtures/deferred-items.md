# Phase 4 deferred items

## From 04-14

- **Phase 3 Badge/Button lose their font-size token class (pre-existing, out of scope).**
  `tailwind-variants`/`tailwind-merge` treat custom `text-label` / `text-body` as text-colour
  utilities, so the variant colour (`text-muted-foreground`, `text-foreground`, ...) drops them:
  `twMerge('text-label text-muted-foreground')` returns `text-muted-foreground`. Badge then renders
  at the inherited size instead of Label 14px. Fix: `extendTailwindMerge` with
  `classGroups: { 'font-size': [{ text: ['label', 'body', 'heading', 'display'] }] }` in
  `$lib/utils.ts` and the `tv()` config. 04-14's chips build their own class string (no merge) and
  are unaffected.
- **Vitest browser failure artifacts are untracked, not gitignored.** Failing browser tests write
  `apps/web/.vitest-attachments/` and `src/**/__screenshots__/`. Add both to `.gitignore`.

## From 04-23

- **RESOLVED in 7506489.** **A 404 key test shows up in the meter's "Not counted" line.** `testKeyWith` records every
  probe (intent `'key-test'`) in the ledger, and `@tran/core/budget` `summarize()` counts any
  404/400 row as `noResults` regardless of intent. After one free (404) Test key, the RentCast
  usage section reads "Not counted: 1 searches with no results.", but a key test is not a search.
  Billing counts are correct (a 200 probe is counted). Fix in the data layer: exclude
  `intent === 'key-test'` rows from `noResults` in `ledger-repo.usage()` (or pass intent to
  `summarize`), with a ledger test. Out of 04-23's scope (pre-existing 04-11/04-13 semantics).
  **Resolution (7506489):** `LedgerEntryLike` gained an optional `intent`, and `summarize()` leaves
  `intent === 'key-test'` 404/400 rows out of `noResults` (`KEY_TEST_INTENT`). Billed/pending/
  failed/cap counts are unchanged, so a 200 probe still counts toward the cap. `ledger-repo` passes
  its rows through unchanged because `LedgerRow` already carries `intent`. Covered by a core
  `summarize` test and a `ledger-repo` `record` test.
