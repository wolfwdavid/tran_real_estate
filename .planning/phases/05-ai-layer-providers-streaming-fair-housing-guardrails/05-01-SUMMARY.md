---
phase: 05-ai-layer-providers-streaming-fair-housing-guardrails
plan: 01
subsystem: ai-core
tags: [ai, sse, errors, pricing, core, tdd]
requires: []
provides:
  - "@tran/core/ai: LiveProviderId, AiProviderId, LlmUsage, LlmFinish, LlmErrorKind, PricingRow"
  - "createSseParser (chunk-boundary safe SSE parser)"
  - "LlmError, classifyHttp, isAbort, isFetchTypeError, toLlmError"
  - "pricingAt, estimateCostUsd, formatUsd"
affects: [05-04+ provider adapters, runner, Settings AI drafting section, usage line]
tech-stack:
  added: []
  patterns:
    - "Pure DOM-free AI primitives in packages/core/src/ai, table-driven Vitest"
    - "LlmError.message is always the kind; provider text never travels"
    - "Date-effective pricing rows compared as ISO UTC date strings"
key-files:
  created:
    - packages/core/src/ai/types.ts
    - packages/core/src/ai/sse.ts
    - packages/core/src/ai/sse.test.ts
    - packages/core/src/ai/errors.ts
    - packages/core/src/ai/errors.test.ts
    - packages/core/src/ai/cost.ts
    - packages/core/src/ai/cost.test.ts
    - packages/core/src/ai/index.ts
  modified: []
decisions:
  - "Core wiring (exports ./* wildcard, apps/web @tran/core workspace dep) was already in place from 04-01; no package.json or lockfile change, no pnpm install"
  - "classifyHttp code = first of error.type/code/status/details[0].reason matching /^[A-Za-z0-9_.-]{1,64}$/ (numbers stringified), so codes are safe identifiers only"
  - "Gemini 400 API_KEY_INVALID -> auth rule applies only when provider === 'gemini'"
metrics:
  duration: 5min
  completed: 2026-10-05
  tasks: 3
  files: 8
---

# Phase 5 Plan 01: AI core primitives (SSE parser, error classifier, cost math) Summary

`@tran/core/ai` now ships a hand-rolled CRLF-safe SSE parser proven at every split offset, an HTTP classifier that maps every live-probed provider failure to auth/quota/model-not-found/interrupted without echoing provider text, and date-effective cost math that doubles Gemini 3.8 Flash on 2027-01-01.

## What was built

- **types.ts**: the exact interface contract (`LiveProviderId`, `AiProviderId`, `LlmUsage`, `LlmFinish`, `LlmErrorKind`, `PricingRow`). Named so it never clashes with the Phase 3 `ProviderId`.
- **sse.ts**: `createSseParser()` with `push(chunk)` and `end()`, following RESEARCH Pattern 5. It handles LF, CR and CRLF endings (including a CRLF split across pushes), comments, multi-line data, stripping one leading space, `id`/`retry` ignored, `[DONE]` passed through, and the flush in `end()`. It has no imports. 18 tests, including a fuzz test with a curly quote, an emoji and CRLF endings, split at every character offset and fed in 1-character chunks.
- **errors.ts**: `LlmError`, `classifyHttp`, `isAbort`, `isFetchTypeError` and `toLlmError`. 67 tests: 24 table rows run twice (once for the kind, once for clean-error properties), plus the code-extraction, abort, fetch-error and passthrough cases.
- **cost.ts**: `pricingAt` (works on unsorted rows, uses the UTC date), `estimateCostUsd` (a provider-reported cost wins, unknown pricing returns `undefined`, reasoning tokens are not added twice) and `formatUsd` ("less than $0.01" below one cent). 16 tests.
- **index.ts**: barrel exporting types, sse, errors and cost.

## Verification

- `corepack pnpm exec vitest run --project core packages/core/src/ai`: 3 files, 101 tests passed
- Full `core` project: 505 passed. The only failing file is 05-02's in-progress RED `fair-housing/check.test.ts`, which belongs to the parallel plan.
- `corepack pnpm --filter @tran/core check`: no errors under `src/ai/`. The only tsc errors at run time came from the parallel 05-02 and 05-03 RED test files.
- `corepack pnpm lint` (prettier and eslint, whole repo): green
- `corepack pnpm check` (apps/web svelte-check): 0 errors, 0 warnings

## Deviations from Plan

### Already satisfied

**Task 1 steps 1-2 (core exports and the apps/web dependency):** `packages/core/package.json` already had `"./*": "./src/*/index.ts"` and `apps/web/package.json` already had `"@tran/core": "workspace:*"` from 04-01. Both acceptance greps returned 1. No package.json or lockfile edits and no `pnpm install`.

### Additions

- **style commit 344a413:** Prettier reformatted three files after the GREEN commits (line wrapping only) so `pnpm lint` stays green.
- Extra tests beyond the behavior list: the API_KEY_INVALID rule fires only for Gemini, codes that are too long or contain spaces are dropped, `toLlmError` never echoes the original message, unsorted rows are checked far in the future, and `formatUsd(0.01)`.

## Known Stubs

None.

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 RED | 3bd6f3b | test(05-01): add failing SSE parser tests |
| 1 GREEN | 8461e50 | feat(05-01): SSE parser and AI core types |
| 2 RED | 8246fe3 | test(05-01): add failing error classifier tests |
| 2 GREEN | a85b2b0 | feat(05-01): HTTP error classifier |
| 3 RED | 1bdbf3c | test(05-01): add failing cost math tests |
| 3 GREEN | bd80320 | feat(05-01): date-effective cost estimate |
| fmt | 344a413 | style(05-01): prettier format AI core files |

## Self-Check: PASSED
