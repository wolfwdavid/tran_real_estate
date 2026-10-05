---
phase: 05-ai-layer-providers-streaming-fair-housing-guardrails
plan: 05
subsystem: ai-web-transport
tags: [ai, providers, sse, fetch, cors, test-connection, registry, tdd]
requires:
  - "05-01: @tran/core/ai (createSseParser, classifyHttp, LlmError, isAbort, isFetchTypeError, toLlmError, pricingAt)"
provides:
  - "apps/web/src/lib/ai/ports.ts: LlmRequest, LlmEvent, LlmProvider, FetchDeps, AdapterDeps, ProviderProbe, ProbeResponse, TestOutcome, TestConnectionResult"
  - "apps/web/src/lib/ai/models.ts: PROVIDERS, PROVIDER_ORDER, PROVIDER_LABELS, defaultModel, hostFor, extrasFor, pricingFor, validateModelId"
  - "apps/web/src/lib/ai/providers/http.ts: resolveFetch, readSse, safeJson, openStream"
  - "apps/web/src/lib/ai/providers/test-connection.ts: runTestConnection, disambiguateFetchFailure"
  - "apps/web/src/lib/ai/providers/fake-sse.ts: fakeSseFetch, fakeRouteFetch (test-only)"
affects: [05-07, 05-08 provider adapters, runner, Settings AI section (Test connection)]
tech-stack:
  added: []
  patterns:
    - "Injected fetch always called as a free function; globalThis.fetch resolved at call time"
    - "Model extras keyed by exact model ID and returned as structuredClone copies"
    - "Keyed CORS-readable probe disambiguates generation fetch TypeErrors"
key-files:
  created:
    - apps/web/src/lib/ai/ports.ts
    - apps/web/src/lib/ai/models.ts
    - apps/web/src/lib/ai/models.test.ts
    - apps/web/src/lib/ai/providers/http.ts
    - apps/web/src/lib/ai/providers/http.test.ts
    - apps/web/src/lib/ai/providers/fake-sse.ts
    - apps/web/src/lib/ai/providers/test-connection.ts
    - apps/web/src/lib/ai/providers/test-connection.test.ts
  modified: []
  deleted:
    - apps/web/src/lib/ai/providers/.gitkeep
decisions:
  - "Registry lookups use Object.hasOwn so a model ID like 'constructor' or 'toString' never resolves to prototype members"
  - "readSse checks signal.aborted before each read (throws signal.reason) in addition to relying on the body erroring, so a body not tied to the signal still stops promptly"
  - "openStream tests live in test-connection.test.ts because they exercise the disambiguation path"
  - "No ESLint disable needed: eslint.config.js already turns the fetch ban off for lib/ai/providers/**"
metrics:
  duration: 12min
  completed: 2026-10-05
  tasks: 3
  files: 9
---

# Phase 5 Plan 05: AI port, model registry, provider HTTP and Test connection Summary

The web app now has the shared AI layer that every adapter builds on. It includes the `LlmProvider` port, a model registry with the verified defaults (`claude-sonnet-5-5`, `gpt-6.1-sol`, `gemini-3.8-flash`, `anthropic/claude-sonnet-5.5`) and extras that apply only to the exact model ID they were verified for, and a transport that never hits "Illegal invocation". The transport also reads SSE byte by byte and survives UTF-8 characters split across chunks. Finally, one Test connection and disambiguation algorithm fixes the OpenAI case where a bad key looks like a CORS block, for all four providers.

## What was built

- **ports.ts** (types only): the exact contract from the plan, covering `LlmRequest` (with `clientDataAck` and `promptId`), `LlmEvent`, `LlmProvider`, `FetchDeps`, `AdapterDeps`, `ProviderProbe`, `ProbeResponse`, `TestOutcome` and `TestConnectionResult`.
- **models.ts**: the RESEARCH Pattern 4 registry, unchanged. Anthropic Sonnet 5.5 gets `output_config.effort: 'low'` and `thinking.type: 'between_tools'`. GPT-6.1 Sol gets `reasoning.effort: 'low'`. Gemini 3.8 Flash gets `thinkingConfig.thinkingLevel: 'low'` and a price increase on 2027-01-01. Terra, Opus, Haiku and the OpenRouter model have no extras. `extrasFor` returns `structuredClone` copies. `pricingFor('fixture', …)` and unknown models return undefined. `validateModelId` returns `'empty'`, `'spaces'` or null.
- **providers/http.ts**: `resolveFetch` (calls fetch as a free function and resolves the global at call time), `readSse` (`TextDecoder` with `{ stream: true }` feeding `createSseParser`, cancels and releases the reader on abort), `safeJson` (parses JSON whatever the content-type, otherwise returns the text or undefined, never throws) and `openStream` (sets `credentials: 'omit'` and `cache: 'no-store'`; aborts propagate unchanged; a TypeError is disambiguated into an `LlmError`; a non-OK response goes through `classifyHttp`).
- **providers/test-connection.ts**: `runTestConnection` runs the keyed check, then the model listing (which may be unknown), then the keyless canary, and returns `ok | cors-blocked | auth | quota | network`. `disambiguateFetchFailure` maps a 401 to auth, a 200 to cors-blocked, and a thrown probe to network only when `navigator.onLine === false`.
- **providers/fake-sse.ts**: `fakeSseFetch` (character or byte splitting, `holdOpen`, aborts tied to the signal) and `fakeRouteFetch` (the first matching route wins, `'typeerror'`, pre-aborted calls throw AbortError, all calls recorded). Its header comment marks it as test-only.

## Verification

- `vitest run --project web apps/web/src/lib/ai`: 7 files, 182 tests passed. This plan contributes 18 registry tests, 13 HTTP tests and 22 Test connection or openStream tests. The rest are 05-06's files in the same folder.
- Full `web` project: 47 files, 705 tests passed.
- `corepack pnpm check`: 0 errors, 0 warnings. `corepack pnpm lint` (prettier and eslint): green.
- Notable proofs: a strict-mode `function` that throws `Illegal invocation` when `this !== undefined` is called successfully. `’` and `🏠` decode correctly from 1-byte chunks. An abort settles within 100 ms with `isAbort` true and `reader.cancel` called. The canary never carries `k-secret` in its URL, init or headers, and the result never contains it. A generation TypeError with a probe 401 becomes `auth`, not `cors-blocked`. A Gemini 400 `API_KEY_INVALID` body served as `text/event-stream` is classified as `auth`.

## Requirement advanced

AI-01 (BYOK provider layer) gets its shared transport, registry and Test connection here. The requirement stays open until the phase gate (05-16), as the orchestrator decided.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Registry lookup on the prototype chain**
- **Found during:** Task 1
- **Issue:** Plain indexing such as `models[model]` would return `Object.prototype` members for user-typed model IDs like `constructor`, which would produce bogus extras or pricing.
- **Fix:** Lookups now use `Object.hasOwn`, and tests cover `constructor` and `toString`.
- **Files modified:** apps/web/src/lib/ai/models.ts
- **Commit:** 8fbfa22

### Additions

- In Task 2, a stub `disambiguateFetchFailure` let `http.ts` compile (the plan allowed this). Task 3 replaced it with the real implementation.
- Tests for `openStream` (credentials and cache, a JSON error under an SSE content-type, TypeError followed by a probe 401 giving auth, aborts propagating without a probe call) were added to `test-connection.test.ts`. The plan's behavior lists did not include them.

## Known Stubs

None. (The Task 2 disambiguation stub was replaced in commit 959472e.)

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 RED | a43561d | test(05-05): add failing model registry tests |
| 1 GREEN | 8fbfa22 | feat(05-05): LlmProvider port and model registry |
| 2 RED | c2d7615 | test(05-05): add failing provider HTTP helper tests |
| 2 GREEN | 154d1e6 | feat(05-05): provider HTTP helpers and fake SSE |
| 3 RED | e3737fa | test(05-05): add failing test connection and disambiguation tests |
| 3 GREEN | 959472e | feat(05-05): test connection and fetch-failure disambiguation |

## Self-Check: PASSED
