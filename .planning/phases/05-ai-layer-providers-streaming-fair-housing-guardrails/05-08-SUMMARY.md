---
phase: 05-ai-layer-providers-streaming-fair-housing-guardrails
plan: 08
subsystem: ai-web-providers
tags: [ai, providers, gemini, openrouter, sse, consent, fetch, tdd]
requires:
  - "05-05: ports.ts, models.ts (extrasFor, hostFor), providers/http.ts (openStream, readSse, safeJson), fake-sse.ts, test-connection.ts"
  - "05-01: @tran/core/ai (LlmError, classifyHttp, isAbort)"
provides:
  - "apps/web/src/lib/ai/providers/gemini.ts: geminiProvider(deps), geminiProbe"
  - "apps/web/src/lib/ai/providers/openrouter.ts: openrouterProvider(deps), openrouterProbe"
affects: [runner provider registry, Settings AI section (Test connection), Gemini consent dialog]
tech-stack:
  added: []
  patterns:
    - "Consent guard runs before getKey() and before any fetch (defense in depth behind the UI dialog)"
    - "Gemini key only in the x-goog-api-key header; every test asserts no ?key= in any URL"
    - "OpenRouter [DONE] checked on the raw data string before JSON.parse"
key-files:
  created:
    - apps/web/src/lib/ai/providers/gemini.ts
    - apps/web/src/lib/ai/providers/gemini.test.ts
    - apps/web/src/lib/ai/providers/openrouter.ts
    - apps/web/src/lib/ai/providers/openrouter.test.ts
  modified: []
decisions:
  - "Gemini modelListed counts the keyCheck response as page 1 and follows nextPageToken up to 5 pages total; a non-200 follow-up page returns undefined (unknown), not false"
  - "OpenRouter [DONE] (or end of body) with no finish_reason ever seen is LlmError('interrupted', {code:'truncated'}), so an error-free but empty stream never becomes a silent empty draft"
  - "Gemini usage is held until the terminal chunk and yielded once just before finish; OpenRouter yields finish and usage in arrival order"
  - "Mid-stream error codes are sanitized with the same /^[A-Za-z0-9_.-]{1,64}$/ rule as 05-07; numeric OpenRouter codes are stringified ('502')"
metrics:
  duration: 9min
  completed: 2026-10-05
  tasks: 2
  files: 4
---

# Phase 5 Plan 08: Gemini and OpenRouter streaming adapters Summary

Gemini now streams through native `streamGenerateContent?alt=sse` with the key carried only in the `x-goog-api-key` header. It refuses client-data prompts that lack an explicit ack before it reads the key or opens a connection, hides thought parts, and bills candidates plus thoughts. OpenRouter streams chat completions with `provider.data_collection: 'deny'` and passes through the cost the provider reports. An error that arrives inside a 200 stream is reported as an error, never as an empty draft. Both adapters ship zero-cost probes for Test connection.

## What was built

- **gemini.ts.** The consent guard (`containsClientData && clientDataAck !== true` throws `consent-required`) runs before `getKey()`. A missing key throws `locked`. The model in the path is percent-encoded. The body is `systemInstruction`, `contents`, and `generationConfig` with `maxOutputTokens` plus `extrasFor('gemini', model)` (so `thinkingConfig.thinkingLevel: 'low'` is added for `gemini-3.8-flash` only).
- **Gemini stream mapping.**
  - A top-level `error` throws `interrupted` with the sanitized `status`.
  - `promptFeedback.blockReason` with no candidates finishes as `refused`.
  - Each part where `part.thought !== true` and the text is non-empty is yielded as text.
  - Finish reasons map as follows: STOP to stop, MAX_TOKENS to length, the SAFETY/PROHIBITED_CONTENT/BLOCKLIST/SPII/RECITATION family to refused, anything else to stop.
  - `usageMetadata` (the last one received) is converted to `{inputTokens, outputTokens: candidates+thoughts, reasoningTokens}`.
  - A body that ends with no finish reason throws `truncated`. Data that fails to parse as JSON throws `bad-json`.
- **geminiProbe.**
  - `keyCheck` sends GET `models?pageSize=1000` with the key in the header.
  - `modelListed` follows `nextPageToken` through `&pageToken=` for up to 5 pages, keyed each time.
  - The canary is a keyless POST of `'{}'` to the `gemini-3.8-flash` stream URL (a 403 is expected).
- **openrouter.ts.** The request headers are exactly `authorization`, `content-type` and `x-openrouter-title: Tran Real Estate Tools`. The body includes `stream: true` and `provider: { data_collection: 'deny' }`.
- **OpenRouter stream mapping.**
  - `[DONE]` ends the stream.
  - A top-level `error` throws `interrupted` with `String(code)`.
  - Non-empty `delta.content` becomes text. `delta.reasoning` is ignored.
  - `finish_reason` maps stop to stop, length to length and content_filter to refused. `error` throws `finish-error`.
  - `usage` is converted to `{inputTokens, outputTokens, costUsd}`.
- **openrouterProbe.**
  - `keyCheck` sends GET `/api/v1/key` with the bearer key.
  - `modelListed` sends GET `/api/v1/models` without `authorization`.
  - The canary is a keyless POST of `'{}'` (a 401 is expected).

## Verification

- `vitest run --project web apps/web/src/lib/ai/providers`: 6 files and 126 tests passed. Gemini has 29 tests and OpenRouter 17. The rest come from 05-05 and 05-07 in the same folder.
- Mutation check: two mutants were each killed by a dedicated test. One weakened the consent guard to `clientDataAck === undefined`. The other disabled OpenRouter's error-chunk handling. The originals were restored afterwards.
- Key proofs:
  - Every Gemini call (stream, both model pages, canary) passes `not.toMatch(/[?&]key=/)` and goes to host `generativelanguage.googleapis.com`.
  - A 400 `API_KEY_INVALID` served as `text/event-stream` is classified as `auth`, with no provider text in the message.
  - With consent missing, `getKey` is never called and no request is made.
  - The canaries carry no key or bearer token.
  - Stop with `holdOpen` keeps the text already yielded and rejects with an abort.
- `corepack pnpm check`: no errors in this plan's files. The run reported 7 errors, all in `providers/fixture.test.ts`, which is 05-09's committed RED test whose implementation had not landed yet. A check earlier in Task 1 showed 0 errors.
- `corepack pnpm lint`: this plan's files pass prettier and eslint. Prettier flags `apps/web/src/lib/ai/ui/fair-housing-ui.test.ts`, which belongs to 05-12 and is out of scope.

## Requirement advanced

- **AI-01** (BYOK streaming for all four providers): the Gemini and OpenRouter adapters are done.
- **AI-03** (Gemini free-tier client-data consent): the adapter-side guard is done.

Both requirements stay open until the 05-16 phase gate, as the orchestrator directed.

## Deviations from Plan

None. The plan was executed as written. The extra tests go beyond the plan's behavior list:

- Gemini: the 5-page pagination cap, a model-not-listed result, an `ack: false` refusal, bad-json, and truncated.
- OpenRouter: `[DONE]` arriving without any finish reason, bad-json, and the locked state.

## Known Stubs

None.

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 RED | d4bc8c4 | test(05-08): add failing Gemini adapter tests |
| 1 GREEN | 2eec191 | feat(05-08): Gemini streaming adapter |
| 2 RED | be4eb99 | test(05-08): add failing OpenRouter adapter tests |
| 2 GREEN | d801fc1 | feat(05-08): OpenRouter streaming adapter |

## Self-Check: PASSED
