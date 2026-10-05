---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 18
subsystem: data-runtime
tags: [runtime, svelte5, runes, liveQuery, broadcastchannel, budget, cap-prompt, tdd, mutation-testing]
requires:
  - "04-13/04-17 createDataGateway / createSampleGateway / ReactiveSpendError / DataGateway port"
  - "04-17 resolveMode, createPrefsRepo"
  - "04-11 createLedgerRepo (usage/writeCap), createCacheRepo, single-use grants"
  - "04-01 getRentCastKey / getRentCastKeyState / onRentCastKeyChange / getDataDb"
  - "04-12 loadFixtureSet, SAMPLE_METROS"
provides:
  - "$lib/data (index.ts): the public port - createDataRuntime, setDataRuntime, getDataRuntime, createPeekStore, SAMPLE_METROS, GatewayError, isGatewayError, ReactiveSpendError + types"
  - "runtime.svelte.ts: DataRuntime (mode, usage, gateway, capPrompt, lastRemoteChange, start, requestSpend, confirmCapPrompt, cancelCapPrompt, setSourcePreference, saveCap, testKey), KeyPort, CapPrompt, KeyTestRecord, RuntimeUsage"
  - "stores.svelte.ts: createPeekStore(runtime, getRequest) - 0-call liveQuery over gateway.peek"
  - "broadcast.ts: createDataChannel() over BroadcastChannel('tran-data'), DataMessage, ChannelLike"
  - "reactive-guard.svelte.ts: inReactiveContext() = $effect.tracking()"
  - "testing/effect-root.svelte.ts: withEffectRoot / reactiveBox rune helpers for plain .ts tests"
affects: [04-19 (may add exports to index.ts), 04-21, 04-22 ((app) layout wiring), 04-23 (Settings wiring), Phases 6-9 portals]
tech-stack:
  added: []
  patterns:
    - "Runtime class with private $state fields behind getters; readonly interface for consumers"
    - "Latest-rebuild-wins generation counter; spends wait for the newest rebuild before using the gateway"
    - "Over-cap prompt: BudgetCapReached parks {req, kind, resolve, reject}; confirm issues a fresh grantOverCap per prompt; cancel rejects detail 'dismissed'"
    - "Reactive guard checked synchronously at the top of requestSpend (before any await) AND passed to every gateway"
    - "Usage = liveQuery(ledger.usage()) + an awaited refresh after each runtime action, generation-ordered"
key-files:
  created:
    - apps/web/src/lib/data/runtime.svelte.ts
    - apps/web/src/lib/data/runtime.test.ts
    - apps/web/src/lib/data/broadcast.ts
    - apps/web/src/lib/data/reactive-guard.svelte.ts
    - apps/web/src/lib/data/stores.svelte.ts
    - apps/web/src/lib/data/stores.browser.test.ts
    - apps/web/src/lib/data/index.ts
    - apps/web/src/lib/data/testing/effect-root.svelte.ts
  modified: []
key-decisions:
  - "One over-cap prompt at a time: a second over-cap request while a prompt is open rejects with its original BudgetCapReached error instead of queueing"
  - "confirmCapPrompt always resolves; the spend's result or error goes to the parked requestSpend promise (the dialog just closes)"
  - "start() cleanup dismisses a parked prompt (rejects 'dismissed') so no caller hangs after unmount"
  - "Peek store clears current to undefined on every request/gateway change so one request's or mode's data never shows under another"
  - "Port also exports ReactiveSpendError, DataRequest, DataSourcePref, ResolvedMode, RentCastKeyState and RuntimeUsage types (additive, needed by 04-22/04-23 wiring)"
requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04]
metrics:
  duration: "~20 min"
  completed: 2026-10-05
  tasks: 2
  files: 8
---

# Phase 4 Plan 18: Data Runtime, Peek Store and Public $lib/data Port Summary

One app-wide data runtime that picks sample or live mode from key state plus preference, rebuilds the gateway on every change (key, preference, other tab), keeps usage reactive, turns an over-cap user spend into a per-call confirm prompt, and syncs cap/source changes across tabs; plus the 0-call `createPeekStore` and the single `$lib/data` import surface.

## What was built

- **`createDataRuntime(deps?)`** (`runtime.svelte.ts`): defaults `getDataDb()`, `() => Date.now()` (the only `Date.now()` in lib/data), `browserFetch`, the platform key accessors, `createDataChannel()`, `inReactiveContext`, `loadFixtureSet` (loaded once, sample mode only). `start()` subscribes key changes, the channel and a usage `liveQuery`, resolves the first mode and returns a cleanup. `requestSpend` parks `BudgetCapReached` behind `capPrompt`; `confirmCapPrompt` spends exactly one call with `gateway.grantOverCap(req)`; `cancelCapPrompt` rejects `BudgetCapReached`/`'dismissed'`. `setSourcePreference`/`saveCap` persist, update local state and post `source-changed`/`cap-changed`. `testKey()` returns `{ outcome, formatError?, at }`. `setDataRuntime`/`getDataRuntime` use `Symbol('tran-data-runtime')` context.
- **`createPeekStore(runtime, getRequest)`**: `$effect` + `liveQuery(() => gateway.peek(req))`; re-peeks on request or gateway change; null request clears. Never calls get/refresh.
- **`index.ts`**: explicit additive re-export list; no client, fetch bridge, repo, grant or gateway factory.
- **`broadcast.ts`** (`'tran-data'`) and **`reactive-guard.svelte.ts`** (`$effect.tracking()` with the after-`await` limit documented).

## Mutation runs (recorded, not committed; files restored, `git diff` clean)

| Mutation | Result |
|---|---|
| `#post` no longer calls `channel.postMessage` | cross-tab test red ("source and cap changes reach the other tab…") |
| Sync guard check removed from `requestSpend` | first run stayed green (gateway guard caught the always-true guard), so a sync-only tracking test was added; re-run: "requestSpend checks the guard synchronously, before its first await" red |
| `reactiveGuard` not passed to built gateways | 2 red (live + sample gateway guard tests) |
| Confirm without a grant | 3 red (confirm, prompt-again, refresh-past-cap) |
| Peek store uses `get` instead of `peek` | browser "empty cache → 0 fetches" red |
| Peek store keeps stale `current` on request change | browser "re-peeks when the request changes" red |

## Verification

- `corepack pnpm vitest run --project web runtime`: 21 passed
- `corepack pnpm vitest run --project web-browser stores`: 3 passed; full `web-browser`: 13 files / 138 passed
- `corepack pnpm vitest run --project web`: 38 files / 503 passed (includes 04-19's files present at the time)
- `corepack pnpm check`: 0 errors. `corepack pnpm lint`: clean. `corepack pnpm guard`: passed
- `grep -c "Date.now()"` across lib/data/*.ts: 1 (runtime default)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Runes in a plain `.ts` browser test**
- **Issue:** `stores.browser.test.ts` needs `$effect.root` and a reactive request box, but runes compile only in `.svelte.ts` modules, and the browser project only includes `*.browser.test.ts`.
- **Fix:** Added test-only `testing/effect-root.svelte.ts` (`withEffectRoot`, `reactiveBox`).
- **Commit:** 42cc509

**2. [Rule 1 - Bug] Usage stale right after a spend**
- **Issue:** The first GREEN refreshed usage fire-and-forget, so `usage` lagged the ledger when `requestSpend` resolved.
- **Fix:** The success path awaits a generation-ordered usage refresh before returning; liveQuery still covers external changes.
- **Commit:** 4a6c1f6

**3. [Rule 2 - Missing critical] Sync-only guard test**
- The plan's always-true guard test could not prove the synchronous `requestSpend` check (the gateway's own check also caught it). Added a test where the guard is true only during the synchronous call, matching `$effect.tracking()` semantics.
- **Commit:** 4a6c1f6

## Commits

- 72c2198 test(04-18): add failing data runtime tests
- 4a6c1f6 feat(04-18): data runtime with mode switching, cap prompt and cross-tab sync
- 42cc509 test(04-18): add failing peek store and port surface tests
- e080777 feat(04-18): peek store and public data port

## Known Stubs

None. Wiring the runtime into the (app) layout (setDataRuntime + start in onMount, DataStatusBar, CapConfirmDialog bound to `capPrompt`) is 04-22; Settings wiring is 04-23.

## Self-Check: PASSED
