---
phase: 05-ai-layer-providers-streaming-fair-housing-guardrails
plan: 07
subsystem: ai-web-providers
tags: [ai, providers, anthropic, openai, sse, cors, tdd]
requires:
  - "05-05: ports.ts, models.ts (extrasFor, hostFor), providers/http.ts (openStream, readSse, safeJson), fake-sse.ts, test-connection.ts"
  - "05-01: @tran/core/ai (LlmError, isAbort, classifyHttp)"
provides:
  - "apps/web/src/lib/ai/providers/anthropic.ts: anthropicProvider(deps), anthropicProbe"
  - "apps/web/src/lib/ai/providers/openai.ts: openaiProvider(deps), openaiProbe"
affects: [runner wiring, Settings AI section (Test connection), 05-10 no-auto-send guard, 05-16 phase gate]
tech-stack:
  added: []
  patterns:
    - "Adapters only map protocol events; transport, classification and CORS disambiguation come from openStream"
    - "Events parsed into loose records (rec/num helpers), switch on JSON type, unknown types ignored"
    - "Terminal-event tracking: no terminal event -> LlmError('interrupted', {code:'truncated'})"
key-files:
  created:
    - apps/web/src/lib/ai/providers/anthropic.ts
    - apps/web/src/lib/ai/providers/anthropic.test.ts
    - apps/web/src/lib/ai/providers/openai.ts
    - apps/web/src/lib/ai/providers/openai.test.ts
  modified: []
decisions:
  - "Adapters break out of the SSE loop on the terminal event (message_stop / response.completed / response.incomplete) instead of draining the body"
  - "OpenAI emits at most one finish per stream: a refusal delta finishes 'refused' and a later response.completed only adds usage"
  - "Unknown response.incomplete reasons finish as 'length' (output was cut short); content_filter -> 'refused'"
  - "OpenAI error-event code read from top-level code, falling back to error.code; codes outside /^[A-Za-z0-9_.-]{1,64}$/ are dropped"
metrics:
  duration: 9min
  completed: 2026-10-05
  tasks: 2
  files: 4
---

# Phase 5 Plan 07: Anthropic and OpenAI streaming adapters Summary

Raw-fetch Anthropic Messages and OpenAI Responses streaming adapters with zero-cost Test connection probes, both verified against fake `ReadableStream` SSE bodies, including the two live-verified CORS traps (Anthropic browser header, OpenAI bad-key 401 without ACAO).

## What was built

- **anthropic.ts**: `POST https://api.anthropic.com/v1/messages` with exactly `content-type`, `x-api-key`, `anthropic-version: 2023-06-01` and `anthropic-dangerous-direct-browser-access: true`; body `{model, max_tokens, system, messages, stream: true, ...extrasFor('anthropic', model)}` (no sampling params). Event mapping: `message_start` -> input usage, `text_delta` -> text (thinking/signature/tool-input deltas ignored), `message_delta` -> output usage + finish (`end_turn`/`stop_sequence` -> stop, `max_tokens` -> length, `refusal` -> refused), `message_stop` terminal, `error` -> `interrupted` with sanitized code. Probe: `GET /v1/models?limit=1000` keyed check, `data[].id` model listing, keyless `POST /v1/messages '{}'` canary — every probe call carries both Anthropic headers.
- **openai.ts**: `POST https://api.openai.com/v1/responses` with exactly `authorization` + `content-type`; body `{model, instructions, input, max_output_tokens, stream: true, store: false, ...extrasFor('openai', model)}`. Event mapping: `response.output_text.delta` -> text, `response.completed` -> usage (reasoning tokens reported but not double-counted) + stop, `response.incomplete` -> usage + length/refused, `response.refusal.delta` -> refused once (text never yielded), `error`/`response.failed` -> `interrupted` with sanitized code. Probe: `GET /v1/models`, keyless `POST /v1/responses '{}'` canary with only `content-type`.
- Both: `getKey()` null/undefined -> `LlmError('locked')` before any fetch; malformed frame -> `interrupted/bad-json`; missing terminal event -> `interrupted/truncated`; Stop propagates the abort while already-yielded text stays delivered.

## Verification

- `vitest run --project web apps/web/src/lib/ai/providers`: 5 files, 109 tests passed (anthropic 22, openai 27 of them).
- THE TRAP proven end to end: generation `TypeError('Failed to fetch')` + `GET /v1/models` 401 `invalid_api_key` -> `LlmError` kind `auth` (not `cors-blocked`); models 200 -> `cors-blocked`; both TypeError while offline -> `network`.
- Every request URL host asserted (`api.anthropic.com` / `api.openai.com`); canaries never carry key material.
- ESLint + Prettier clean on all four files; no `eslint-disable`, no SDK imports, no `temperature`, no `chat/completions`.
- `corepack pnpm check`: the only error was in parallel plan 05-08's RED test (`openrouter.test.ts` importing a not-yet-written module) — not this plan's files; zero errors in 05-07 files.

## Requirement advanced

AI-01 (BYOK provider layer): two of the four live providers (Anthropic, OpenAI) now stream with Stop support and correct error classification. Left open for the 05-16 phase gate per orchestrator instruction.

## Deviations from Plan

None - plan executed exactly as written. Small additions beyond the behavior lists: tests for unsafe error codes being dropped, malformed JSON (`bad-json`), `stop_sequence`, OpenAI HTTP 401/500 mapping, and `modelListed` false/undefined shapes.

## Known Stubs

None.

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 RED | fd7974f | test(05-07): add failing Anthropic adapter tests |
| 1 GREEN | 9174c3a | feat(05-07): Anthropic streaming adapter |
| 2 RED | bf35cbc | test(05-07): add failing OpenAI Responses adapter tests |
| 2 GREEN | 4f3d620 | feat(05-07): OpenAI Responses adapter |

## Self-Check: PASSED
