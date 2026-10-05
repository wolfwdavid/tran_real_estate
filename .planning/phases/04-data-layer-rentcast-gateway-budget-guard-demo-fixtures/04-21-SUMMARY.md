---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 21
subsystem: data-runtime
tags: [browser-test, svelte5, runes, reactive-guard, mutation-testing, call-count]
requires:
  - "04-18 createDataRuntime / createPeekStore / inReactiveContext"
  - "04-13 ReactiveSpendError, gateway.get guard"
  - "04-07 no-restricted-syntax $effect spend rule"
  - "04-08 web-browser Vitest project conventions"
provides:
  - "rerender.browser.test.ts: 10-re-render call-count proof (fetch spy + ledger rows) and mutant non-vacuity proofs"
  - "testing/PeekView.svelte: sanctioned peek-only harness view"
  - "testing/MutantEffectView.svelte: deliberate spend-in-$effect view (test-only)"
affects: [Phases 6-9 portal views (pattern reference)]
tech-stack:
  added: []
  patterns:
    - "Count spends twice: injected spy fetch calls AND db.ledger.count()"
    - "Non-vacuity via a deliberately wrong component behind a targeted eslint-disable-next-line"
key-files:
  created:
    - apps/web/src/lib/data/testing/PeekView.svelte
    - apps/web/src/lib/data/testing/MutantEffectView.svelte
    - apps/web/src/lib/data/rerender.browser.test.ts
  modified: []
key-decisions:
  - "gateway.get is async (the guard throws inside read() before its first await), so the mutant detects the guard via the rejected promise (instanceof ReactiveSpendError), not a synchronous try/catch"
  - "Harness views import lib/data internals relatively (not via index.ts) so they stay independent of the 04-22 port edits"
  - "PeekView takes runtime as a fixed prop with a documented svelte-ignore state_referenced_locally (real views take it once via getDataRuntime())"
requirements-completed: [DATA-04, DATA-03]
metrics:
  duration: "~15 min"
  completed: 2026-10-05
  tasks: 2
  files: 3
---

# Phase 4 Plan 21: 10-Re-render Call-Count Proof Summary

Real Svelte views re-rendered 10 times in Chromium spend 0 extra RentCast calls (fetch spy + ledger rows), and a deliberately wrong spend-in-`$effect` view proves the count is non-vacuous: the runtime guard blocks it, and with the guard disabled the spy counts its calls.

## What was built

- **`testing/PeekView.svelte`**: reads via `createPeekStore(runtime, () => request)` only; renders `tick` and `rows` (slice length or `none`).
- **`testing/MutantEffectView.svelte`**: `$effect` that calls `gateway?.get(request)`; a rejection that is a `ReactiveSpendError` sets `blocked`. Carries the single suppression `eslint-disable-next-line no-restricted-syntax -- deliberate mutant: ...`. Verified that removing the comment makes the 04-07 rule fire.
- **`rerender.browser.test.ts`** (5 tests, real Chromium IndexedDB, unique DB per test, injected clock, `channel: null`):
  1. Live, warm cache: 1 explicit `requestSpend` → 10 re-renders (fresh props and fresh equal request objects) → still 1 call / 1 ledger row, rows = 74201 slice length (10), tick = 10.
  2. Live, empty cache: 10 re-renders → 0 calls, 0 ledger rows, rows `none`.
  3. Sample mode (key state `none`): rows = slice length, 0 live calls, 0 ledger rows.
  4. Mutant with `reactiveGuard: inReactiveContext`: `blocked` true, 0 calls, 0 ledger rows.
  5. Mutant with `reactiveGuard: () => false` and a distinct ZIP per re-render (`742NN`): calls > 0 and ledger rows > 0.

## Mutation runs (recorded, not committed; files restored, `git diff` clean)

| Mutation | Result |
|---|---|
| `createPeekStore` uses `gateway.refresh` instead of `peek` | 2 red (warm-cache and empty-cache tests) |
| `assertNotReactive` made a no-op in gateway.ts | 1 red (mutant-with-real-guard test) |
| Suppression comment removed from MutantEffectView | ESLint `no-restricted-syntax` error |

## Verification

- `corepack pnpm vitest run --project web-browser rerender`: 5 passed
- `corepack pnpm test:unit`: 84 files / 1346 passed
- `corepack pnpm lint`: clean. `corepack pnpm check`: 0 errors, 0 warnings. `corepack pnpm guard`: passed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] svelte-check `state_referenced_locally` warning in PeekView**
- **Found during:** Task 1
- **Fix:** Documented `svelte-ignore` for the fixed-lifetime runtime prop (request stays in a closure so it remains reactive).
- **Commit:** 79f97ac

Mutant detection uses the rejected-promise path (allowed by the plan, recorded above). Otherwise the plan ran as written.

## Commits

- 79f97ac test(04-21): add peek-only and spend-in-effect harness views
- e34f38e test(04-21): prove 10 re-renders spend no RentCast calls

## Known Stubs

None. Both views are test-only harnesses under `lib/data/testing/` and never ship.

## Self-Check: PASSED
