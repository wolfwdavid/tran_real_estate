# Phase 4 deferred items

## From 04-14

- **OPEN, carried to Phase 5+ (UI).** **Phase 3 Badge/Button lose their font-size token class (pre-existing, out of scope).**
  `tailwind-variants`/`tailwind-merge` treat custom `text-label` / `text-body` as text-colour
  utilities, so the variant colour (`text-muted-foreground`, `text-foreground`, ...) drops them:
  `twMerge('text-label text-muted-foreground')` returns `text-muted-foreground`. Badge then renders
  at the inherited size instead of Label 14px. Fix: `extendTailwindMerge` with
  `classGroups: { 'font-size': [{ text: ['label', 'body', 'heading', 'display'] }] }` in
  `$lib/utils.ts` and the `tv()` config. 04-14's chips build their own class string (no merge) and
  are unaffected.
- **RESOLVED (orchestrator housekeeping, before 04-25).** `.gitignore` now ignores
  `apps/web/.vitest-attachments/` and `**/__screenshots__/`.
  **Vitest browser failure artifacts are untracked, not gitignored.** Failing browser tests write
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

## From 04-25

- **RESOLVED in 72b6875.** **Lost E2E clicks under smooth scrolling (Phase 3's "import preview
  click" flake, root-caused).** The first 04-25 `verify` failed 2 of 498 E2E tests:
  `app-notice` "Remind me tomorrow" (root, `Import backup` click) and `settings-keys` "keys are
  session-only by default" (sub, `Save key` click). Both traces show "element is not stable", then
  "element is outside of the viewport", then "click action done" with no effect: `app.css` sets
  `html { scroll-behavior: smooth }` under `prefers-reduced-motion: no-preference`, so Playwright's
  scroll-into-view animated while Settings was still filling in, and the click landed mid-scroll.
  04-24 had applied `reducedMotion: 'reduce'` to its two new specs only. Fix: `reducedMotion:
  'reduce'` is the suite default in `apps/web/playwright.config.ts` (per-spec copies removed). No
  timeout was raised. Proof: the three affected specs pass 156/156 with `--repeat-each 3`, and the
  re-run `verify` is green (496 passed + 2 skipped).
