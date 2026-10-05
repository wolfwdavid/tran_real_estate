# Phase 5: AI Layer: Providers, Streaming & Fair Housing Guardrails - Research

**Researched:** 2026-10-04
**Domain:** Browser-direct BYOK LLM streaming (raw `fetch` + SSE) for four providers, deterministic Fair Housing advertising linter, PII minimization, "no auto-send" enforcement, all inside a static SvelteKit 2 / Svelte 5 app under a meta CSP
**Confidence:** HIGH for provider wire protocols, CORS behavior (live probes today) and model IDs (official docs today). MEDIUM for lexicon legal sourcing (primary federal sources verified; state lists summarized). LOW items are flagged inline.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

The owner chose fully autonomous mode on 2026-10-04. Researched recommended defaults are adopted.

#### Providers & streaming
- **Raw `fetch` adapters, no SDKs** (SDK telemetry headers have broken browser CORS; fewer deps on a key-holding origin).
  - Anthropic Messages API with `anthropic-dangerous-direct-browser-access: true` and `anthropic-version` headers.
  - OpenAI Responses API (stream).
  - Gemini native `streamGenerateContent?alt=sse` with the key in the `x-goog-api-key` header, never `?key=`.
  - OpenRouter chat completions (stream) as the CORS-stable fallback.
- **Default models** in `models.ts` (user-overridable per provider, persisted via Phase 3 settings): Anthropic `claude-sonnet-5`, OpenAI `gpt-5.6-terra`, Gemini `gemini-3.8-flash`, OpenRouter `anthropic/claude-sonnet-5`. The planner re-checks these IDs during research; the registry is data so a wrong ID is a one-line fix.
- **Test connection** calls each provider's models-list endpoint (or a 1-token generation where CORS blocks the list) and reports one of: `ok`, `cors-blocked` (TypeError on fetch — "this provider is blocking browser access from this site right now; try OpenRouter"), `auth` (401/403), `quota` (429/402), `network`. Plugs into Phase 3's `testKey(provider)` hook.
- **Runner:** single `runGeneration({prompt, provider, model, signal})` async-iterable; `AbortController` wired to a Stop button; token deltas batched to the UI every ~50 ms; returns `{text, usage, estimatedCostUsd, provider, model, promptId}`. Partial text is kept on Stop.
- **Fixture provider** streams canned, pre-linted sample output word-by-word with realistic timing when no key is present or sample mode is forced; badged "Sample output".
- **CSP:** `connect-src` already lists all four hosts. No additions.

#### Fair Housing checker
- **Deterministic lexicon** in `packages/core/src/fair-housing/`: entries `{phrase | regex, category, severity: 'block'|'warn', explanation, alternative}`. Categories follow FHA §3604(c) protected classes (race, color, religion, sex, familial status, national origin, disability) plus common state additions (source of income, age, marital status, sexual orientation/gender identity) tagged `state`.
- **Sourcing:** HUD Achtenberg memo (1995) word lists plus commonly published state association lists, paraphrased into our own entries. No copying of a proprietary list verbatim. Each entry cites its basis in a `source` field.
- **Behavior:** runs on every generated text (and on user-edited text before copy/send). `block` findings disable Copy/Open-email until the user applies the alternative or edits; `warn` findings require an explicit acknowledgement checkbox. Findings render inline (highlight + popover with explanation and one-click "Use alternative").
- **Property-not-people system prompt** fragment is prepended by the prompt registry to every housing-copy prompt.
- **Test suite:** ≥30 known-bad phrases flagged (e.g. "perfect for young professionals", "no kids", "Christian community", "walking distance to church", "no Section 8", "able-bodied") and ≥30 neutral phrases pass (e.g. "two bedrooms", "near transit", "pet policy on request", "wheelchair accessible entrance" — accessibility *features* are fine, "handicap-only" style exclusions are not). A planted lexicon mutation test proves the suite can fail.

#### Privacy & safety
- **PII minimization before send:** prompt inputs are passed through `core.redactPii` (emails, phones, full names replaced with role tokens like `{client_first_name}`) unless the feature explicitly needs them; the panel shows "What will be sent" expandable preview.
- **Gemini free-tier warning:** before any prompt that includes client/lead data is sent to Gemini, a dialog explains that free-tier Gemini may use data for training, with Cancel as the default action. The warning can be acknowledged for the session only, never permanently.
- **No auto-send path:** no module may import a sending function; the only exits are Copy (Clipboard API), `mailto:` link built from the text, and "Mark as sent" (local log). A unit test asserts the AI module graph has no import from leads/web3forms, and the generation panel has exactly those three actions.
- **Output rendering:** plain text or DOMPurify-sanitized markdown only; never `{@html}` raw model output (lint rule exists).

#### Artifacts
- Every generation is stored (Phase 3 Dexie) as `{id, feature, promptId@version, provider, model, inputHash, text, findings, status: draft|acknowledged|sent, createdAt}`; registered in the backup export.

### Claude's Discretion
- SSE parser implementation details; cost table values; render throttle; exact lexicon wording and count beyond the minimums; prompt registry file layout.

### Deferred Ideas (OUT OF SCOPE)
- Local/Ollama provider (post-v1).
- Prompt A/B telemetry (post-v1, needs backend).

### Also locked (approved 05-UI-SPEC.md, treat as contract)
No new routes; Settings gains "AI drafting" section between "API keys" and "Key security"; model override + Test connection live inside Phase 3 `ProviderKeyCard`; `GenerationPanel` anatomy, exactly three exits (`data-testid="generation-exits"`), exit gating table, `GeminiDataDialog` (Cancel = **Don't send to Gemini**, initial focus, `sessionStorage` ack only), `FairHousingText`/`FindingPopover`/`FindingsSummary`, `DraftHistory`, all copy strings, 50 ms render flush, no new npm deps except `dompurify` *only if* markdown is rendered, shadcn `popover` + `textarea` copy-ins only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AI-01 | User can choose Anthropic, OpenAI, Gemini, or OpenRouter as the AI provider and watch output stream in, with the ability to stop generation | §Provider Wire Protocols (verified request/response shapes for all four), §SSE parser, §Runner (abort + 50 ms flush), §Error classification (CORS vs auth vs quota, incl. the OpenAI 401-without-CORS finding), §Test connection (zero-cost, all list endpoints verified CORS-OK), §models.ts registry (corrected IDs), §Fixture provider |
| AI-02 | Every piece of AI-generated housing copy is scanned by a Fair Housing checker that flags problem phrases with an explanation and a compliant alternative before the user can copy or send it | §Fair Housing lexicon (primary sources: 24 CFR 100.75, Achtenberg memo text extracted today; memo NOT in the 2026 HUD withdrawal list), matcher design (Unicode boundaries, offsets, overlaps, allow-list), ≥30/≥30 candidate suite, leave-one-out mutation test, ReDoS guard |
| AI-03 | User is warned before sending client or lead data to a free-tier Gemini key | §Gemini key types & data terms (verbatim "Unpaid Services" clause, tier undetectable from key, auth-key transition), §GeminiDataDialog gate placement (before `fetch`), sessionStorage-only ack test |
| AI-04 | No AI output is ever sent automatically — user copies it or opens it in their own email client | §No-auto-send enforcement: ESLint `no-restricted-imports` + extra globals/properties bans, TS-compiler import-graph test (no new deps), SSR exits test (spike-verified in this repo today), mailto encoding rules |
</phase_requirements>

## Summary

All four providers accept direct browser calls from the future origin today. Live preflights and real error responses were sent on 2026-10-04 from `Origin: https://tranrealestate.github.io`, without any key. Anthropic, OpenAI and OpenRouter return `Access-Control-Allow-Origin: *`. Gemini echoes the origin. Every header the adapters need is allowed. Every models-list endpoint (and OpenRouter's `/api/v1/key`) is CORS-readable, including on 401/400 error responses. That means **Test connection needs no 1-token generation for any provider and costs $0**. **One critical trap was found:** OpenAI's `POST /v1/responses` (and `/v1/chat/completions`) returns **401 for a wrong key *without* `Access-Control-Allow-Origin`**. A browser therefore sees a mistyped OpenAI key as a `TypeError`, which looks exactly like a CORS block. The adapter must disambiguate with a follow-up `GET /v1/models` (whose 401 *is* CORS-readable) before it reports `cors-blocked`. Anthropic behaves the same way when the `anthropic-dangerous-direct-browser-access` header is missing, so that header must be sent on every request.

The default model IDs in CONTEXT are stale by one release. CONTEXT explicitly delegates re-checking them to research, so these are corrections, not deviations. `claude-sonnet-5-5` is now Anthropic's latest Sonnet (released 2026-09-28, $2/$10). OpenAI's docs now feature `gpt-6.1-sol` as the balanced default ($2/$10); `gpt-5.6-terra` is still active and is a valid fallback. On OpenRouter the slug is `anthropic/claude-sonnet-5.5`, with a **dot**. `gemini-3.8-flash` is confirmed, but its paid price **doubles on 2027-01-01**, so the cost table must be date-effective. All three first-party defaults now "think" by default, and thinking tokens count against `max_tokens` and are billed as output. Each default model therefore carries per-model request extras (low effort / low thinking) as registry *data*. Extras are sent only for the exact model ID they were verified for, because sending them to other models returns 400.

The Fair Housing lexicon rests on two public-domain federal sources, verified today: 24 CFR 100.75 and the HUD Achtenberg memo of 1995-01-09. The memo text was extracted, and it is **not** among the guidance HUD withdrew in its 2026-04-06 Federal Register notice (91 FR 17291). The memo cuts both ways. It names illegal phrasings ("white family home", "no Irish", "Christian home", "no wheelchairs", "adults/couples/singles" preferences). It also names phrases that are **explicitly lawful** and that naive word lists over-flag: "master bedroom", "bachelor apartment", "mother-in-law suite", "family room", "walk to bus-stop", "kosher meals available", "apartment complex with chapel", "fourth-floor walk-up", "wheelchair ramp", "non-smoking". Those make an authoritative neutral suite. Matching should be phrase-level regex with Unicode-aware boundaries, run on the original string so offsets stay exact. Every entry carries its own positive examples, and a leave-one-out mutation test proves every entry is load-bearing.

**Primary recommendation:** Build `packages/core` pure modules first: the SSE line parser, error classifier, cost math, `redactPii`, and the lexicon with its matcher. They are fully unit-testable in Node with zero network. Then build thin `lib/ai/providers/*` adapters that take an injected fetch and are tested against fake `ReadableStream` SSE bodies. Then the runner. The Svelte UI comes last, with structural tests via `svelte/server` `render()` (verified working in this repo's `web` Vitest project today) and interaction plus axe via Playwright with `page.route()`.

## Standard Stack

### Core (no new runtime dependencies for Phase 5)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native `fetch` + `ReadableStream` + `TextDecoder` | Web platform / Node 24 | Provider HTTP and SSE body reading | Locked: raw fetch, no SDKs. Node 24 has identical globals, so adapter tests run in the existing `node` Vitest env |
| `AbortController` | Web platform | Stop button, abort mid-stream | Aborting `fetch` rejects pending `reader.read()` with `AbortError`. OpenRouter documents that abort stops billing on supported providers |
| `typescript` (already installed, ~6.0.3) | 6.0.3 | `ts.preProcessFile()` for the import-graph test | Avoids adding `es-module-lexer`/`madge`. Handles static and dynamic `import()` |
| `svelte/server` `render()` | svelte 5.57.0 (installed) | SSR structural test of `GenerationPanel` exits | **Spike-verified 2026-10-04** in the `web` Vitest project (node env, plain `svelte()` plugin): a component rendered and its exits group parsed in 1.0 s |
| bits-ui / shadcn-svelte `popover`, `textarea` | bits-ui 2.19.2 / shadcn-svelte CLI 1.6.1 | Finding popover, edit mode | UI-SPEC locked. Copy-ins via official registry, reconciled per Phase 3 rules |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dompurify` | 3.4.16 (npm, modified 2026-09-23) | Sanitize rendered markdown | **Not in Phase 5.** The demo prompt asks for plain text and `GenerationPanel` renders text. Add it lazily in the first portal phase that renders markdown (likely 7 or 9), inside `lib/security/sanitize-html.svelte`, the only file where `{@html}` is lint-allowed |
| `@vitest/browser-playwright` + `vitest-browser-svelte` | 4.1.11 + **2.2.1** (3.x requires Vitest 5) | Real-browser component tests | Not needed. SSR render covers structure and Playwright E2E covers interaction. Do not add a third test runner mode this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled SSE parser (~70 LOC) | `eventsource-parser` 4.1.1 (zero deps, recommended by OpenRouter docs) | It is spec-complete, but it is one more package on a key-holding origin. The reconciliation (CLAUDE.md) prefers fewer deps. Hand-roll it with a byte-split fuzz test (below). That makes the custom parser *verified*, not just "custom" |
| Gemini native `streamGenerateContent` | Gemini Interactions API (`/v1beta/interactions`, now featured in Google docs) | Locked out anyway. Also verified today: Interactions is **beta** ("For production workloads, you should continue to use the standard `generateContent` API"), and its REST examples require an `Api-Revision` header, which is the exact non-allowlisted header that broke CORS in js-genai #1723 |
| OpenRouter `/api/v1/chat/completions` | OpenRouter `/api/v1/responses` or `/api/v1/messages` | Chat Completions is locked, the simplest, and its usage chunk is documented |

**Installation:** none for runtime. UI copy-ins:
```bash
corepack pnpm --filter web exec shadcn-svelte add popover textarea   # exact CLI per Phase 3 init contract
```

**Version verification (2026-10-04, `npm view`):** dompurify 3.4.16, eventsource-parser 4.1.1, vitest-browser-svelte 3.1.0 (latest; use 2.2.1 for Vitest 4). Everything else is already pinned in the repo.

## Architecture Patterns

### Recommended Project Structure
```
packages/core/src/
├── ai/
│   ├── sse.ts                 # createSseParser(): pure, push(chunk: string) → SseEvent[]; flush()
│   ├── sse.test.ts            # spec cases + byte-split fuzz
│   ├── errors.ts              # LlmErrorKind, classifyHttp(provider, status, body), isAbort(err)
│   ├── errors.test.ts
│   ├── cost.ts                # estimateCostUsd(usage, pricing[], at: Date) with date-effective rows
│   ├── cost.test.ts
│   └── types.ts               # LlmUsage, LlmFinish, ProviderId
├── privacy/
│   ├── redact-pii.ts          # redactPii(text, known[]) → { text, redactions[] }
│   └── redact-pii.test.ts
└── fair-housing/
    ├── lexicon.ts             # LexiconEntry[] (data + helper p`…` builder)
    ├── allow.ts               # neutral allow-list phrases that suppress overlapping matches
    ├── check.ts               # checkFairHousing(text, lexicon?) → Finding[] (merged, ordered)
    ├── apply.ts               # applyAlternative(text, finding) → { text, cursor }
    ├── suite.ts               # BAD_PHRASES / NEUTRAL_PHRASES (≥30 each) exported for tests + Phase 10 page
    ├── check.test.ts          # suite, offsets, overlaps, boundaries, ReDoS budget
    └── mutation.test.ts       # leave-one-out + planted mutation

apps/web/src/lib/ai/
├── models.ts                  # registry data: defaults, known models, pricing rows, extras, hosts
├── ports.ts                   # LlmProvider interface, LlmRequest, LlmEvent
├── runner.ts                  # runGeneration(): AsyncIterable + 50 ms batching (injected clock)
├── runner.svelte.ts           # thin $state wrapper used by GenerationPanel
├── gemini-gate.ts             # needsGeminiWarning(); sessionStorage ack read/write
├── exits.ts                   # copyText(), buildMailto(), markSent(): the ONLY exit implementations
├── prompts/
│   ├── registry.ts            # getPrompt(id) → PromptDef; prepends HOUSING_COPY_GUARDRAIL
│   ├── guardrail.ts           # property-not-people system fragment (versioned)
│   └── shared/demo.v1.ts      # the one generic demo prompt (containsClientData: true)
├── providers/                 # ← ONLY folder where fetch( is lint-allowed (eslint.config.js already)
│   ├── anthropic.ts  openai.ts  gemini.ts  openrouter.ts  fixture.ts
│   ├── http.ts                # doFetch(deps), readSse(res, signal) → AsyncIterable<SseEvent>
│   ├── test-connection.ts     # testKey(provider) impls + keyless CORS canaries + disambiguation probe
│   ├── fake-sse.ts            # test helper: fakeSseFetch(frames, opts) (test-only import)
│   └── *.test.ts
├── storage/artifacts.ts       # Dexie table + repo + backup registration (Phase 3 APIs)
└── ui/                        # GenerationPanel, FairHousingText, FindingPopover, FindingsSummary,
                               # GeminiDataDialog, GenerationError, DraftHistory, ArtifactStatusBadge,
                               # AiProviderPicker, SampleOutputToggle
```
Rationale: the parser, classifier, cost math, redaction and lexicon are pure and DOM-free. They belong in `packages/core` (CONTEXT "Pure logic in packages/core") so Phase 10's standalone checker page reuses them at zero cost. All `fetch` stays in `lib/ai/providers/**`. **Correction to CONTEXT wording:** `eslint.config.js` *already* turns `no-restricted-syntax` off for that whole folder (verified), so adapter files need **no** targeted `eslint-disable` comments. Only a test *outside* that folder that calls `fetch(` literally needs one (pattern: `apps/web/src/lib/no-network.test.ts`).

### Pattern 1: Provider wire protocols (verified 2026-10-04)

| | Anthropic | OpenAI | Gemini | OpenRouter |
|---|---|---|---|---|
| Stream URL | `POST https://api.anthropic.com/v1/messages` | `POST https://api.openai.com/v1/responses` | `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse` | `POST https://openrouter.ai/api/v1/chat/completions` |
| Headers (exact set; preflight-verified) | `content-type: application/json`, `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true` | `authorization: Bearer …`, `content-type` | `content-type`, `x-goog-api-key` | `authorization: Bearer …`, `content-type`, optional `x-openrouter-title: Tran Real Estate Tools` (allowed; `X-Title` also accepted) |
| Body | `{model, max_tokens, system, messages:[{role:'user',content}], stream:true, ...extras}` | `{model, instructions, input, max_output_tokens, stream:true, store:false, ...extras}` | `{systemInstruction:{parts:[{text}]}, contents:[{role:'user',parts:[{text}]}], generationConfig:{maxOutputTokens, ...extras}}` | `{model, messages:[{role:'system',…},{role:'user',…}], max_tokens, stream:true, provider:{data_collection:'deny'}}` |
| SSE framing | `event:` + `data:` lines | `event:` + `data:` (JSON has `type`, `sequence_number`) | `data:` only; each is a full `GenerateContentResponse` | `data:` only; `: OPENROUTER PROCESSING` comments; ends `data: [DONE]` |
| Text delta | `content_block_delta` with `delta.type==='text_delta'` → `delta.text` (ignore `thinking_delta`, `signature_delta`, `input_json_delta`) | `response.output_text.delta` → `delta` | `candidates[0].content.parts[*].text` where `part.thought !== true` | `choices[0].delta.content` (ignore `delta.reasoning`) |
| Usage | `message_start.message.usage.input_tokens` (+cache fields); `message_delta.usage.output_tokens` (**cumulative**; take last) | `response.completed.response.usage.{input_tokens, output_tokens, output_tokens_details.reasoning_tokens}` | last `usageMetadata.{promptTokenCount, candidatesTokenCount, thoughtsTokenCount}`; output billed = candidates + thoughts | final chunk `usage.{prompt_tokens, completion_tokens, cost}` (`cost` is provider-reported USD credits: use it directly) |
| Normal end | `message_delta.delta.stop_reason: 'end_turn'` then `message_stop` | `response.completed` | `finishReason: 'STOP'` | `finish_reason: 'stop'` then `[DONE]` |
| Length limit | `stop_reason: 'max_tokens'` | `response.incomplete` with `incomplete_details.reason: 'max_output_tokens'` | `finishReason: 'MAX_TOKENS'` | `finish_reason: 'length'` |
| Refusal / filter | `stop_reason: 'refusal'` | `response.refusal.delta` events, or incomplete `reason: 'content_filter'` | `promptFeedback.blockReason` (no candidates) or `finishReason` ∈ `SAFETY, PROHIBITED_CONTENT, BLOCKLIST, SPII, RECITATION` | `finish_reason: 'content_filter'` |
| Mid-stream error | `event: error` `{"type":"error","error":{"type":"overloaded_error",…}}` | `{"type":"error","code","message"}` or `response.failed` with `response.error` | a `data:` JSON with top-level `error` | `data:` chunk with top-level `error` and `finish_reason:'error'` (may be the **only** chunk on a 200) |
| Unknown events | "handle unknown event types gracefully" (docs). Also `ping` | many tool/reasoning events: ignore | n/a | comments: ignore |

Sources: Anthropic streaming + errors docs, OpenAI streaming-events and create reference (`.md`), Gemini `generate-content` API reference, OpenRouter streaming docs. All fetched 2026-10-04.

**Privacy-minimizing body fields (recommended, HIGH):** OpenAI `store: false`. The docs say store "Defaults to true … stored for at least 30 days". OpenRouter `provider: { data_collection: 'deny' }` routes only to providers that don't collect data. Anthropic and Gemini have no equivalent request field; the Gemini paid/free difference is account-level (see AI-03).

### Pattern 2: Error classification (the CORS vs auth vs quota contract)

Live findings that drive the design (2026-10-04, keyless or invalid-key requests with `Origin` set):

| Request | Status | `Access-Control-Allow-Origin` on the *actual* response? | Browser sees |
|---|---|---|---|
| Anthropic `GET /v1/models`, bad key, **with** browser header | 401 `authentication_error` | yes (`*`) | 401 JSON → `auth` |
| Anthropic `POST /v1/messages`, bad key, **without** browser header | 401 | **no** | **TypeError** (looks like CORS) |
| OpenAI `GET /v1/models`, bad key | 401 `invalid_api_key` | yes | 401 JSON → `auth` |
| **OpenAI `POST /v1/responses`, bad key** (stream and non-stream; also `/v1/chat/completions`) | 401 `text/plain` | **no** (only `Access-Control-Expose-Headers`) | **TypeError** |
| OpenAI `POST /v1/responses`, **no** auth header | 401 | yes | 401 JSON |
| Gemini `GET /v1beta/models`, bad key | **400** `INVALID_ARGUMENT`, `details[].reason: 'API_KEY_INVALID'` | yes (echo) | 400 JSON → must map to `auth` |
| Gemini stream, bad key | **400** with `content-type: text/event-stream` but a **plain JSON** body | yes | non-OK: parse the body as JSON, not SSE |
| Gemini, no key | 403 `PERMISSION_DENIED` | yes | 403 |
| OpenRouter `GET /api/v1/key` / chat, bad key | 401 | yes | 401 JSON → `auth` |
| OpenRouter `GET /api/v1/models`, no key | **200** (public list) | yes | does NOT validate a key |

Classifier rules (pure, `packages/core/src/ai/errors.ts`):

| Kind | Rule |
|---|---|
| `aborted` | `signal.aborted` or `err.name === 'AbortError'`. Never shown as an error; runner status = `stopped` |
| `auth` | 401; 403 (Anthropic `permission_error`; Gemini `PERMISSION_DENIED` when a key was sent); Gemini 400 whose `error.details[].reason` is `API_KEY_INVALID` (or message `/API key not valid/i`) |
| `quota` | 429 (all); 402 (Anthropic `billing_error`, OpenRouter insufficient credits); Anthropic **400** whose message matches `/spend limit\|credit balance/i` (the docs say a spend limit returns 400); Gemini `RESOURCE_EXHAUSTED`; OpenAI 429 `insufficient_quota` |
| `model-not-found` | 404, or 400 whose message/param names `model` (OpenRouter "Invalid model specified"; OpenRouter 404 "no endpoints"/"no allowed providers" from `data_collection: 'deny'` also lands here with the UI's model copy) |
| `refused` | finish/stop reasons in the table above |
| `interrupted` | 5xx, 529 `overloaded_error`, mid-stream `error` event, body ends without a terminal event |
| `cors-blocked` vs `network` | Only after a fetch `TypeError` (not abort) **and** the disambiguation probe below |

**Disambiguation probe (recommended, closes the OpenAI trap):** when a *generation* fetch throws a TypeError, run that provider's `testKey()` once before reporting:
1. If the keyed models/key probe returns an HTTP status → map it (401 → `auth`, 429 → `quota`, …). For OpenAI this turns a mistyped key into the correct "didn't accept your key" error.
2. If the keyed probe returns 200 but generation was unreachable → `cors-blocked` (the generation endpoint is blocking this origin while the key is fine; this is the Jan-2026 OpenAI Responses incident shape).
3. If the probe also throws a TypeError → `network` when `navigator.onLine === false`, otherwise `cors-blocked`. A browser cannot tell a DNS failure from a CORS block; the UI copy for both is actionable.

### Pattern 3: Test connection (zero-cost; no generation needed)

| Provider | Key check (keyed) | Model availability | Generation-path CORS canary (keyless, zero cost) |
|---|---|---|---|
| Anthropic | `GET /v1/models?limit=1000` + all 3 Anthropic headers | `data[].id` includes model | `POST /v1/messages` `{}` without `x-api-key` (but with the browser header) → expect 401 (CORS-readable, verified) |
| OpenAI | `GET /v1/models` | `data[].id` includes model | `POST /v1/responses` `{}` **without** `authorization` → expect 401 (CORS-readable, verified) |
| Gemini | `GET /v1beta/models?pageSize=1000` with `x-goog-api-key` (follow `nextPageToken`) | `models[].name === 'models/' + id` (note the prefix) | `POST …:streamGenerateContent?alt=sse` `{}` with no key → expect 403 (CORS-readable, verified) |
| OpenRouter | `GET /api/v1/key` (returns `limit_remaining`, `usage`, `is_free_tier`) | public `GET /api/v1/models`, `data[].id` | `POST /api/v1/chat/completions` `{}` no auth → expect 401 (verified) |

The canary proves the *generation* endpoint is browser-reachable from this origin without sending the key or spending tokens. That matters because models-list CORS ≠ generation CORS (the OpenAI incidents hit only the generation endpoints). Result mapping: key check status → `ok | auth | quota | network`; key ok + canary TypeError → `cors-blocked`; key ok + model missing → `ok` with the UI's "didn't list `{model}`" variant. Never send the key on the canary. Never include key material in thrown errors or announcements.

### Pattern 4: `models.ts` registry (data, verified 2026-10-04)

| Provider | Recommended default | Confidence | Pricing (USD / MTok in / out) | Default-model extras (send ONLY for this exact ID) |
|---|---|---|---|---|
| Anthropic | **`claude-sonnet-5-5`** (latest, released 2026-09-28; retire ≥ 2027-09-28). `claude-sonnet-5` still works but is legacy | HIGH | 2 / 10 | `output_config: { effort: 'low' }`, `thinking: { type: 'between_tools' }`. Docs: adaptive thinking is on by default, thinking counts toward `max_tokens`, `between_tools` is "the lowest thinking setting" on Sonnet 5.5 and returns **400 on any other model**. Non-default `temperature/top_p/top_k` also return 400, so never send them |
| OpenAI | **`gpt-6.1-sol`** (docs: "Choose GPT-6.1 Sol to balance intelligence and cost"). `gpt-5.6-terra` ($2/$12) still active, no deprecation | HIGH | 2 / 10 | `reasoning: { effort: 'low' }`. Default is `medium`; `none`/`minimal` are **not supported** on 6.1 Sol |
| Gemini | **`gemini-3.8-flash`** (stable; docs: "For any new projects, use … 3.5 Flash-Lite or 3.8 Flash") | HIGH | paid tier: **0.75 / 3.75 through 2026-12-31; 1.50 / 7.50 from 2027-01-01** (output includes thinking). Free tier: $0 | `generationConfig.thinkingConfig.thinkingLevel: 'low'` (3.8 Flash default is medium; supports low/medium/high, not minimal). Casing in the generateContent REST JSON: LOW confidence, verify in live UAT |
| OpenRouter | **`anthropic/claude-sonnet-5.5`** (dot, not dash: verified in the live `/api/v1/models` list) | HIGH | use `usage.cost` from the stream; fallback table 2 / 10 | none (OpenRouter normalizes `reasoning`; keep the body minimal) |

Registry shape (data only; unit-tested for "every default has a pricing row valid today" and "every host ⊆ CSP connect-src"):
```ts
// apps/web/src/lib/ai/models.ts
export type PricingRow = { from: string /* ISO date */; inUsdPerMTok: number; outUsdPerMTok: number };
export type ModelInfo = { pricing: PricingRow[]; extras?: Record<string, unknown>; note?: string };
export const PROVIDERS = {
  anthropic: { host: 'api.anthropic.com', defaultModel: 'claude-sonnet-5-5', models: {
    'claude-sonnet-5-5': { pricing: [{ from: '2026-09-28', inUsdPerMTok: 2, outUsdPerMTok: 10 }],
      extras: { output_config: { effort: 'low' }, thinking: { type: 'between_tools' } } },
    'claude-opus-5-5': { pricing: [{ from: '2026-01-01', inUsdPerMTok: 4, outUsdPerMTok: 20 }] },
    'claude-haiku-4-5': { pricing: [{ from: '2025-10-01', inUsdPerMTok: 1, outUsdPerMTok: 5 }], note: 'retirement not sooner than 2026-10-15' } } },
  openai: { host: 'api.openai.com', defaultModel: 'gpt-6.1-sol', models: {
    'gpt-6.1-sol': { pricing: [{ from: '2026-01-01', inUsdPerMTok: 2, outUsdPerMTok: 10 }], extras: { reasoning: { effort: 'low' } } },
    'gpt-5.6-terra': { pricing: [{ from: '2026-01-01', inUsdPerMTok: 2, outUsdPerMTok: 12 }] } } },
  gemini: { host: 'generativelanguage.googleapis.com', defaultModel: 'gemini-3.8-flash', models: {
    'gemini-3.8-flash': { pricing: [ { from: '2026-01-01', inUsdPerMTok: 0.75, outUsdPerMTok: 3.75 },
                                     { from: '2027-01-01', inUsdPerMTok: 1.5,  outUsdPerMTok: 7.5 } ],
      extras: { thinkingConfig: { thinkingLevel: 'low' } } } } },
  openrouter: { host: 'openrouter.ai', defaultModel: 'anthropic/claude-sonnet-5.5', models: {
    'anthropic/claude-sonnet-5.5': { pricing: [{ from: '2026-09-28', inUsdPerMTok: 2, outUsdPerMTok: 10 }] } } }
} as const;
```
A user-overridden model with no registry row gets **no extras** and **no cost estimate** (usage tokens only, see Open Question 2).

### Pattern 5: SSE parser (pure, chunk-boundary safe)

```ts
// packages/core/src/ai/sse.ts: WHATWG event-stream subset; [Discretion: implementation]
export type SseEvent = { event: string; data: string };
export function createSseParser() {
  let buf = '';
  let event = '';
  let data: string[] = [];
  let sawCR = false;
  const out: SseEvent[] = [];
  const dispatch = () => {
    if (data.length) out.push({ event: event || 'message', data: data.join('\n') });
    event = ''; data = [];
  };
  const line = (l: string) => {
    if (l === '') return dispatch();
    if (l.startsWith(':')) return;                     // comment, e.g. ": OPENROUTER PROCESSING"
    const i = l.indexOf(':');
    const field = i === -1 ? l : l.slice(0, i);
    let value = i === -1 ? '' : l.slice(i + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
    // id / retry ignored (no reconnection for POST streams)
  };
  return {
    push(chunk: string): SseEvent[] {
      buf += chunk;
      let start = 0;
      for (let i = 0; i < buf.length; i++) {
        const c = buf[i];
        if (c === '\n' && sawCR) { sawCR = false; start = i + 1; continue; } // CRLF second half
        sawCR = false;
        if (c === '\r' || c === '\n') { line(buf.slice(start, i)); sawCR = c === '\r'; start = i + 1; }
      }
      buf = buf.slice(start);
      return out.splice(0);
    },
    end(): SseEvent[] { if (buf) line(buf); buf = ''; dispatch(); return out.splice(0); }
  };
}
```
```ts
// apps/web/src/lib/ai/providers/http.ts: byte → text → events, abort-aware
export async function* readSse(res: Response, signal: AbortSignal) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();                      // stream:true below handles split UTF-8
  const p = createSseParser();
  try {
    for (;;) {
      const { value, done } = await reader.read();    // rejects with AbortError on abort
      if (done) break;
      yield* p.push(dec.decode(value, { stream: true }));
    }
    yield* p.push(dec.decode());
    yield* p.end();
  } finally {
    if (signal.aborted) await reader.cancel().catch(() => {});
    reader.releaseLock?.();
  }
}
```
Gemini and OpenRouter `data` payloads are each one JSON object (`[DONE]` is OpenRouter's sentinel). Anthropic and OpenAI also carry `type` inside the JSON, so adapters switch on `JSON.parse(data).type` and ignore the SSE `event` name.

### Pattern 6: Runner with 50 ms batching (deterministic under fake timers)

```ts
// apps/web/src/lib/ai/runner.ts (pure TS; the clock is injected for tests)
export type RunUpdate =
  | { type: 'text'; text: string }                                   // full text so far, flushed ≤ every 50 ms
  | { type: 'done'; result: GenerationResult };
export async function* runGeneration(o: {
  prompt: BuiltPrompt; provider: LlmProvider; model: string; signal: AbortSignal;
  now?: () => number; flushMs?: number;
}): AsyncGenerator<RunUpdate> {
  const now = o.now ?? (() => performance.now()); const flushMs = o.flushMs ?? 50;
  let text = ''; let last = 0; let usage: LlmUsage | undefined; let finish: LlmFinish = 'stop';
  let status: 'done' | 'stopped' | 'error' = 'done'; let error: LlmError | undefined;
  try {
    for await (const ev of o.provider.stream({ ...o.prompt, model: o.model }, o.signal)) {
      if (ev.type === 'text') { text += ev.text; if (now() - last >= flushMs) { last = now(); yield { type: 'text', text }; } }
      else if (ev.type === 'usage') usage = { ...usage, ...ev.usage };
      else if (ev.type === 'finish') finish = ev.reason;
    }
  } catch (e) {
    if (isAbort(e, o.signal)) status = 'stopped'; else { status = 'error'; error = toLlmError(e); }
  }
  yield { type: 'text', text };                                        // final flush, partial kept on Stop
  yield { type: 'done', result: { text, usage, status, finish, error, provider: o.provider.id, model: o.model,
    promptId: `${o.prompt.id}@${o.prompt.version}`, estimatedCostUsd: estimateCostUsd(usage, pricingFor(o.provider.id, o.model), new Date()) } };
}
```
The UI wrapper (`runner.svelte.ts`) writes `text` into `$state` and may additionally `requestAnimationFrame`-align the DOM write (UI-SPEC). Time-based batching lives in the runner so it is unit-testable.

### Pattern 7: Fake SSE fetch for Vitest (network stays globally blocked)

```ts
// apps/web/src/lib/ai/providers/fake-sse.ts: test-only helper
export function fakeSseFetch(frames: string[], o: { status?: number; headers?: Record<string, string>;
  splitEvery?: number; holdOpen?: boolean } = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = async (url: string | URL, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const signal = init.signal;
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const bytes = new TextEncoder().encode(frames.join(''));
    const step = o.splitEvery ?? bytes.length;
    const body = new ReadableStream<Uint8Array>({
      start(ctrl) {
        signal?.addEventListener('abort', () => ctrl.error(new DOMException('Aborted', 'AbortError')));
        for (let i = 0; i < bytes.length; i += step) ctrl.enqueue(bytes.slice(i, i + step));
        if (!o.holdOpen) ctrl.close();                       // holdOpen = stream never ends → Stop test
      }
    });
    return new Response(body, { status: o.status ?? 200, headers: { 'content-type': 'text/event-stream', ...o.headers } });
  };
  return { fetchImpl: fetchImpl as typeof fetch, calls };
}
// Simulate CORS block / network failure: const fetchImpl = async () => { throw new TypeError('Failed to fetch'); };
```
Adapters take `deps: { fetch?: typeof fetch }` and call it as a **free function** (see Pitfall 3). Tests assert on `calls[0]`: URL has no `key=`, headers are exactly the verified set, body fields (`store:false`, `stream:true`, extras only for the default ID).

### Pattern 8: Fair Housing lexicon and matcher

Entry shape (extends CONTEXT's locked fields with test hooks):
```ts
export type Category = 'race' | 'color' | 'religion' | 'sex' | 'familial-status' | 'national-origin' | 'disability'
  | 'source-of-income' | 'age' | 'marital-status' | 'sogi';
export interface LexiconEntry {
  id: string;                    // stable: 'familial.no-children'
  pattern: string;               // authored via p`` helper → RegExp source; flags added by matcher: 'giu'
  category: Category;
  scope: 'federal' | 'state';    // 'state' → popover line "Protected under many state and local laws."
  severity: 'block' | 'warn';
  explanation: string;           // plain language, our own words
  alternative: string;           // '' → "Remove phrase"
  source: string;                // e.g. 'HUD Achtenberg memo (1995) §5 Familial status'
  examples: string[];            // ≥1 positive example that MUST match this entry (drives the suite)
}
```
Matcher rules:
- Run regexes on the **original** string with flags `giu` (no lowercasing/normalizing copy), so `start/end` offsets are exact for `<mark>` rendering and `applyAlternative`.
- Boundaries: wrap every pattern as `(?<![\p{L}\p{N}])(?:…)(?![\p{L}\p{N}])` with the `u` flag. JS `\b` is ASCII-only, so it mis-handles "café" and similar. This also prevents "Christiansen" matching "Christian".
- Tolerance in the `p` helper: spaces → `[\s -]+` (handles "able bodied" / "able-bodied" / NBSP); `'` → `['’]`; optional plural `s?` where meaningful; `-` ↔ space.
- **Allow-list suppression:** a match fully inside an allow-list span is dropped. The allow-list holds Achtenberg's explicit neutral phrases: "master bedroom", "bachelor apartment", "mother-in-law suite", "family room", "walk to bus stop", "kosher meals", "chapel", "wheelchair ramp", "wheelchair accessible", "Section 8 … welcome/accepted".
- Overlaps: sort by start; merge overlapping ranges into one finding group with the highest severity, keeping the member findings in order (UI-SPEC: one mark, the popover lists each).
- Prefer **phrase-level** entries ("christian (community|neighborhood|home|household|building)") over single words, to avoid flagging street names, "English garden", "family room", and so on.

Candidate suites (authoring guide; the planner/executor finalizes wording. `[A]` = explicitly addressed in the Achtenberg memo, quoted from the extracted text):

**Known-bad (≥30; severity → rationale):**
| # | Phrase | Category | Sev | Basis |
|---|---|---|---|---|
| 1 | no kids | familial | block | [A] §5 "limitations on the number or ages of children" |
| 2 | no children | familial | block | [A] §5 |
| 3 | adults only | familial | block | [A] §5 "preference for adults" |
| 4 | perfect for young professionals | familial + age(state) | block | [A] §5 preference for adults/singles; CONTEXT example |
| 5 | ideal for couples | familial | block | [A] §5 "couples" |
| 6 | perfect for singles | familial | block | [A] §5 "singles" |
| 7 | great for empty nesters | familial | block | [A] §5 adult preference |
| 8 | no more than one child | familial | block | [A] §5 number of children |
| 9 | not suitable for children | familial | block | 24 CFR 100.75(c)(1) |
| 10 | family-friendly neighborhood | familial | warn | Common association guidance; describes who, not what |
| 11 | white neighborhood | race | block | [A] §1 "racial or ethnic terms" |
| 12 | white family home | race | block | [A] §1 verbatim example |
| 13 | no Irish | national-origin | block | [A] §1 verbatim example |
| 14 | English speakers only | national-origin | block | 100.75(c)(1) |
| 15 | must speak English | national-origin | block | 100.75(c)(1) |
| 16 | Hispanic neighborhood | national-origin | block | [A] §1 describing neighbors in ethnic terms |
| 17 | integrated neighborhood | race | warn | Historic HUD ad-guideline code word (1989 guidelines, public domain) |
| 18 | exclusive neighborhood | race | warn | Same; also steering signal |
| 19 | safe neighborhood | race | warn | Steering proxy (PITFALLS research); describe features instead |
| 20 | Christian community | religion | block | CONTEXT; [A] §2 "Christian home" |
| 21 | Christian home | religion | block | [A] §2 verbatim example |
| 22 | Jewish neighborhood | religion | block | [A] §2 / §1 |
| 23 | Catholic family preferred | religion | block | [A] §2 explicit preference |
| 24 | walking distance to church | religion | warn | CONTEXT; naming one house of worship can suggest preference |
| 25 | near the synagogue | religion | warn | Same pattern family (church/synagogue/mosque/temple) |
| 26 | female tenants only | sex | block | [A] §3 (shared-living exception does not apply to whole units) |
| 27 | no men | sex | block | [A] §3 |
| 28 | perfect for a bachelor | sex + marital(state) | block | Preference for a person (vs. "bachelor apartment" = physical description, neutral) |
| 29 | no wheelchairs | disability | block | [A] §4 verbatim example |
| 30 | able-bodied tenants | disability | block | CONTEXT example |
| 31 | must be able to climb stairs | disability | block | 100.75(c)(1) limitation by handicap |
| 32 | not suitable for handicapped persons | disability | block | 100.75(c)(1) |
| 33 | no mentally ill tenants | disability | block | 100.75(c)(1) |
| 34 | no Section 8 | source-of-income | block | CONTEXT; state/local SOI laws (scope `state`) |
| 35 | no vouchers | source-of-income | block | Same |
| 36 | no housing assistance | source-of-income | block | Same |
| 37 | seniors only | age | warn | Lawful only if the property qualifies as housing for older persons (HOPA; [A] discusses the older-persons exemption) |
| 38 | 55 and older only | age | warn | Same |
| 39 | no retirees | age | block | State age protections |
| 40 | married couples only | marital-status | block | State marital-status protections |
| 41 | straight couples only | sogi | block | State SOGI protections |

**Neutral (≥30; must produce zero findings):** master bedroom [A] · rare find [A] · desirable neighborhood [A] · apartment complex with chapel [A] · kosher meals available [A] · Merry Christmas [A] · mother-in-law suite [A] · bachelor apartment [A] · great view [A] · fourth-floor walk-up [A] · walk-in closets [A] · jogging trails [A] · walk to bus stop [A] · non-smoking [A] · wheelchair ramp [A] · two bedroom [A] · cozy [A] · family room [A] · no bicycles allowed [A] · quiet streets [A] · two bedrooms (CTX) · near transit (CTX) · pet policy on request (CTX) · wheelchair accessible entrance (CTX) · elevator building · in-unit laundry · close to shops and parks · grab bars in the bathroom · fenced backyard · children's play area on site · first-floor unit · utilities included · rent is $1,850 per month · Section 8 vouchers welcome · senior center nearby · Christiansen Avenue (boundary) · English garden (boundary) · able to schedule tours on weekends (boundary).

**Legal-sourcing notes (verified):**
- 24 CFR 100.75(a)/(c)(1) (Cornell LII): unlawful to publish words or phrases that "convey that dwellings are available or not available to a particular group … because of race, color, religion, sex, handicap, familial status, or national origin". 100.75(b) covers "all written or oral notices or statements", including flyers, applications and signs, so the checker applies to outreach messages too.
- The Achtenberg memo is a US federal government work (public domain), so citing its examples is fine. The "no verbatim copying" rule in CONTEXT targets proprietary association lists. Paraphrase explanations in our own words and cite `source` strings like `"HUD Achtenberg memo (1995) §4 Handicap"`. Use "Disability" as the user-facing category label (UI-SPEC) while citing the regulation's term.
- HUD's 2026-04-06 notice (91 FR 17291, effective 2025-09-17) withdrew the **2024 digital-platforms advertising guidance**, the SOI testing memo and the EO 13988 implementation memo. It did **not** list the 1995 Achtenberg memo, and it states that conduct violating the Act's text "continue[s] to be subject to enforcement". Never cite the withdrawn 2024 guidance in `source` fields.
- SOGI and source of income are `state` scope (the federal EO-13988 implementation guidance was withdrawn). This matches CONTEXT's tagging.

### Pattern 9: PII minimization (`packages/core/src/privacy/redact-pii.ts`)

Do not attempt free-text name detection (no NER in a static app). Use **structured redaction**: feature prompt inputs declare which fields are PII, and `redactPii` replaces those *known values* plus regex-detectable emails and phones.
```ts
type Known = { value: string; token: string; kind: 'name' | 'email' | 'phone' | 'address' };
export function redactPii(text: string, known: Known[]): { text: string; redactions: { original: string; token: string }[] }
// 1. known values longest-first, case-insensitive, Unicode-boundary; a full name also yields first-name and last-name parts
//    ("Jane Doe" → {client_name}; standalone "Jane" → {client_first_name})
// 2. emails: /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu → {email_1}, {email_2}…
// 3. US phones: /(?<!\d)(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g → {phone_1}…
//    (tests: must NOT match "$1,850", zip "11201", "2 bed 1 bath", a year range "2024-2026")
```
`inputHash` = SHA-256 hex (`crypto.subtle.digest`, available in Node 24 and browsers) of the **post-redaction** prompt, so the artifact never stores raw inputs (UI-SPEC security rule). The demo prompt (`shared/demo.v1`) feeds a fictional client name, email and phone so the "Replaced before sending" list is exercised.

### Pattern 10: "No auto-send" enforcement (AI-04): four layers

1. **ESLint boundary** (add to `eslint.config.js`):
```js
{ files: [`${WEB}/lib/ai/**`],
  rules: {
    'no-restricted-imports': ['error', { patterns: [forbid(['leads'], 'AI modules must never import lead delivery (no auto-send).')] }],
    'no-restricted-globals': ['error', 'XMLHttpRequest', 'WebSocket', 'EventSource'],
    'no-restricted-properties': ['error',
      { object: 'navigator', property: 'sendBeacon', message: 'No sending from the AI layer.' },
      { object: 'window', property: 'open', message: 'No programmatic navigation from the AI layer.' }]
  } }
```
Use *different rule names* from `no-restricted-syntax`, because the providers-folder override turns `no-restricted-syntax` fully `off` (flat-config rule options replace, not merge). Prove the rule fires with the existing `scripts/eslint-rules.test.ts` `lintText` pattern (virtual path `apps/web/src/lib/ai/ui/X.svelte` importing `$lib/leads/web3forms` → error).
2. **Import-graph unit test** (`apps/web/src/lib/ai/no-auto-send.test.ts`): walk every file under `lib/ai/**`, extract `<script>` blocks from `.svelte`, run `ts.preProcessFile(src, true, true).importedFiles` (includes dynamic `import()`), resolve `$lib/` and relative specifiers, and recurse. Assert no resolved path is under `lib/leads/`, and that no file text contains `web3forms`, `sendBeacon`, `XMLHttpRequest`, `location.href =` or `location.assign(`. Include a non-vacuity case: a planted in-memory graph containing a leads import makes the walker return it.
3. **Single implementation of exits**: `navigator.clipboard` and `mailto:` appear **only** in `lib/ai/exits.ts`; a grep test asserts the count per file.
4. **SSR structural test** (`GenerationPanel.test.ts`): `render(GenerationPanel, { props })` from `svelte/server`, then parse `data-testid="generation-exits"`. Expect exactly 3 interactive children in order with names **Copy text**, **Open in email app**, **Mark as sent**. Expect no other `a[href^="mailto:"]` anywhere in the panel HTML. When gated, the `<a>` has no `href` and has `aria-disabled="true"`.

`buildMailto({to, subject, text})`: normalize `\r?\n` → `\r\n` before `encodeURIComponent` (RFC 6068 body line breaks are `%0D%0A`), and encode `to`/`subject`/`body` separately. Compute the encoded length for the UI-SPEC 1,800-character long-draft note. Never assign it to `location`; the user clicks the `<a>`.

### Pattern 11: Gemini free-tier gate (AI-03)

- Gate placement: `GenerationPanel` → `if (provider === 'gemini' && !sample && prompt.containsClientData && !sessionAck()) open dialog` **before** `runGeneration` is called. The adapter itself also asserts `req.geminiAckToken` for client-data prompts (defense in depth), so a future caller cannot bypass the dialog.
- Ack storage: `sessionStorage['tran.ai.gemini-client-data-ack'] = '1'` only when the checkbox is checked and **Send to Gemini** is pressed. Never `localStorage`, never Dexie, so it is excluded from backups by construction.
- Tier is undetectable from the key (no API exposes billing state; HIGH, docs show the tier is decided by "a Cloud Project associated with an active billing account"). The UI-SPEC copy already says "asks every time".
- Verbatim policy basis to cite in docs and the explainer (Gemini API Additional Terms, effective 2026-03-23): "When you use Unpaid Services, including … the unpaid quota on Gemini API, Google uses the content you submit … to provide, improve, and develop Google products …" and "human reviewers may read, annotate, and process your API input and output … **Do not submit sensitive, confidential, or personal information to the Unpaid Services.**" Paid: "Google doesn't use your prompts … or responses to improve our products". The pricing page row reads "Used to improve our products: Free Tier Yes / Paid Tier No".

### Anti-Patterns to Avoid
- **Sending model-specific extras to a user-overridden model:** `thinking:{type:'between_tools'}` returns 400 on every model except Sonnet 5.5, and `reasoning.effort:'minimal'` returns 400 on 6.1 Sol. Key extras by exact model ID.
- **Treating every fetch TypeError as CORS:** the OpenAI bad-key case would tell users "OpenAI is blocking this site" when the real problem is the key. Always run the disambiguation probe.
- **Using OpenRouter's `/api/v1/models` to validate a key:** it is public and returns 200 with no key. Use `/api/v1/key`.
- **Parsing Gemini error bodies as SSE:** the error arrives with `content-type: text/event-stream` but is plain JSON. Check `res.ok` first.
- **Lowercasing or normalizing the text before matching:** offsets drift. Match on the original with `iu` flags.
- **Single-word lexicon entries** ("family", "Christian", "English", "senior", "adult"): massive false positives on Achtenberg-neutral phrases.
- **Storing findings from history as truth:** re-run the checker on open (UI-SPEC).
- **`{@html}` for highlights:** build `<mark>` spans from `{#each}` segments; the lint rule already forbids `{@html}` outside the sanitizer.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Name detection in free text | NER / capitalized-word heuristics | Structured `known[]` PII values from the feature inputs + email/phone regex | Heuristics both miss names and redact street names, brands, cities. Inputs are structured in every portal feature |
| Module import graph | Regex scan of `import` lines | `ts.preProcessFile` (TypeScript, already installed) | Handles `import type`, side-effect imports, `export … from` and dynamic `import()` |
| Svelte structural rendering in tests | A jsdom/happy-dom install + custom mount | `svelte/server` `render()` (spike-verified here) + Playwright for interaction | No new deps; the real browser path is already in CI |
| Cross-origin route mocking | A local mock server | Playwright `page.route()` + `route.fulfill({ headers: { 'access-control-allow-origin': '*' } })`, `route.abort('failed')` for CORS/network | Existing harness; preflights for routed requests are handled by Playwright internally (MEDIUM, see Pitfall 8) |
| Key validation | 1-token generation calls | Models-list / `/key` endpoints + keyless canary | $0, no tokens, verified CORS-readable for all four |
| Markdown → safe HTML | Regex tag stripping | Plain text this phase; DOMPurify later in `sanitize-html.svelte` | XSS on a key-holding origin is the top risk |
| Price math with dates | Inline constants in UI | `estimateCostUsd(usage, rows, at)` in core with date-effective rows | Gemini doubles on 2027-01-01; OpenRouter reports `cost` itself |

**Key insight:** the dangerous parts of this phase are *classification* (CORS vs auth vs quota) and *matching* (false positives and negatives), not transport. Both are pure functions. Put them in `packages/core`, where exhaustive table-driven tests are cheap.

## Common Pitfalls

### Pitfall 1: OpenAI wrong key reported as "blocking browser access"
**What goes wrong:** `POST /v1/responses` with a bad key returns 401 without ACAO. The browser throws a TypeError, and the UI blames OpenAI's CORS and recommends OpenRouter.
**Why it happens:** OpenAI's edge omits ACAO on authenticated-request 401s for the generation endpoints. Verified live 2026-10-04 (twice, both origins, stream and non-stream).
**How to avoid:** Disambiguation probe (Pattern 2). Test connection uses `/v1/models`, which is CORS-readable on 401.
**Warning signs:** Users report "OpenAI blocked" right after pasting a key; Test connection says "didn't accept this key" while generation says "blocking".

### Pitfall 2: Thinking tokens eat `max_tokens`
**What goes wrong:** Drafts end mid-sentence or come back empty with `max_tokens`/`MAX_TOKENS`/`max_output_tokens`.
**Why it happens:** Sonnet 5.5 (adaptive thinking on by default, effort `high`), GPT-6.1 Sol (reasoning `medium`) and Gemini 3.8 Flash (thinking `medium`) all spend output budget on hidden reasoning, which also counts toward the limit. Docs: "Thinking counts toward `max_tokens` even when the thinking content isn't returned."
**How to avoid:** Per-model extras lowering effort/thinking (Pattern 4). Set a generous `maxTokens` (≥ 2,048 for drafts). Map every length stop to the UI's "Hit length limit" state. Compute cost on billed output (Gemini: candidates + thoughts).
**Warning signs:** Long "Connecting…" then a short draft; the "still waiting 10 s" message appears often.

### Pitfall 3: `Illegal invocation` from an injected fetch
**What goes wrong:** `deps.fetch(url)` where `deps = { fetch: window.fetch }` throws `TypeError: Failed to execute 'fetch' on 'Window': Illegal invocation`, which the classifier then labels `cors-blocked`.
**Why it happens:** Browser `fetch` must be called with `this === window` (or none). Node does not enforce this, so unit tests pass.
**How to avoid:** `const doFetch: typeof fetch = deps.fetch ?? ((i, init) => globalThis.fetch(i, init));` and always call `doFetch(...)` as a free function. Resolve `globalThis.fetch` at **call** time, not module load (the Vitest setup swaps globals). An E2E with a mocked provider route catches regressions.
**Warning signs:** Every provider reports `cors-blocked` in the browser while unit tests are green.

### Pitfall 4: Anthropic header omission looks like CORS
**What goes wrong:** Without `anthropic-dangerous-direct-browser-access: true`, Anthropic answers 401 with no ACAO, which the browser surfaces as a TypeError.
**How to avoid:** Adapter unit test asserts all four headers on every Anthropic request, including models list and canary.

### Pitfall 5: SSE chunk boundaries
**What goes wrong:** Lost or garbled tokens; JSON.parse errors on half lines; mojibake in curly quotes and emoji.
**Why it happens:** Network chunks split lines, CRLF pairs and multi-byte UTF-8 sequences arbitrarily.
**How to avoid:** `TextDecoder.decode(chunk, { stream: true })`, a buffered line parser with CR/LF/CRLF handling, and a **fuzz test that re-splits a recorded stream at every byte offset** (and in 1-byte chunks) and asserts identical events. Include a `’` and an emoji in the fixture.

### Pitfall 6: Lexicon false positives destroy trust
**What goes wrong:** "master bedroom", "family room" or "Christiansen Ave" gets flagged; users learn to ignore or bypass the checker.
**How to avoid:** Phrase-level entries, Unicode boundaries, the allow-list, and the Achtenberg-explicit neutral suite (Pattern 8). Leave-one-out mutation proves each entry is needed. A neutral-suite failure blocks merge.

### Pitfall 7: Catastrophic regex backtracking
**What goes wrong:** The checker runs on every edit (300 ms debounce, UI-SPEC). A nested-quantifier pattern hangs the tab on long pasted text.
**How to avoid:** Authoring helper forbids nested quantifiers. A test runs every compiled pattern against a 50 KB adversarial string (repeated "no no no …", long whitespace runs) within a 50 ms budget per pattern.

### Pitfall 8: Playwright cross-origin mocks
**What goes wrong:** A mocked provider response is rejected by the page's CORS check, so E2E sees TypeErrors.
**Why it happens:** Routed cross-origin responses still need ACAO for the page's `fetch` to read them. Preflights for intercepted requests are handled by Playwright and are not visible to `page.route` (MEDIUM: GitHub issues #3331/#37245).
**How to avoid:** Always `route.fulfill({ status, headers: { 'access-control-allow-origin': '*', 'content-type': 'text/event-stream' }, body })`. Use `route.abort('failed')` to simulate CORS/network. In Wave 0, write one spike spec that proves a mocked Anthropic SSE renders in `/settings/` before building more E2E on it.
**Note:** `route.fulfill` delivers the whole body at once, so **Stop-mid-stream E2E must use the Fixture provider** (which streams on timers in-page). Stop for real adapters is unit-tested with `holdOpen` fake streams.

### Pitfall 9: Date-dependent pricing
**What goes wrong:** Gemini cost estimates are 50% low from 2027-01-01.
**How to avoid:** Date-effective pricing rows plus a unit test with an injected date on both sides of the boundary.

### Pitfall 10: Gemini key URL leakage
**What goes wrong:** Copying Google's REST examples (which still use `?alt=sse&key=${GEMINI_API_KEY}`) puts the key in the URL, history and logs.
**How to avoid:** Adapter test `expect(calls[0].url).not.toMatch(/[?&]key=/)` and assert the `x-goog-api-key` header. Also encode the model with `encodeURIComponent`.

### Pitfall 11: Flat-config rule clobbering
**What goes wrong:** Adding a new `no-restricted-syntax` ban for `lib/ai/**` silently does not apply in `lib/ai/providers/**` (overridden to `off`). Or a later config block with `no-restricted-imports` for overlapping files replaces the leads ban.
**How to avoid:** Use distinct rule names (Pattern 10), and add `lintText` tests for the providers folder too.

### Pitfall 12: Phase 3 / Phase 4 prerequisites not built yet
**What goes wrong:** Phase 5 UI depends on Phase 3's vault (`getKey`, `testKey` hook registry), settings `PersistedState`, Dexie base + backup registry, `LiveAnnouncer`, `ConfirmDialog`, `SectionError`, `ProviderKeyCard`, shadcn init, and Phase 4's `ProvenanceChip`. **None are executed as of today** (`apps/web/src/lib/{storage,security}` hold only `.gitkeep`).
**How to avoid:** Order plans so `packages/core` work (parser, classifier, cost, redaction, lexicon) and provider adapters (pure TS with an injected key getter) run first and are independent of Phase 3. UI/storage plans declare an explicit dependency on Phase 3 completion. If Phase 4 has not shipped `ProvenanceChip`, build `ProviderChip` per the UI-SPEC fallback in a shared location Phase 4 can adopt.

## Code Examples

### Anthropic adapter core (shape; all fetch lives in providers/)
```ts
// apps/web/src/lib/ai/providers/anthropic.ts
export function anthropicProvider(deps: { getKey: () => Promise<string | null>; fetch?: typeof fetch }): LlmProvider {
  const doFetch: typeof fetch = deps.fetch ?? ((i, init) => globalThis.fetch(i, init));
  return {
    id: 'anthropic',
    async *stream(req, signal) {
      const key = await deps.getKey(); if (!key) throw new LlmError('locked');
      const res = await doFetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal, credentials: 'omit', cache: 'no-store',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01',
                   'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: req.model, max_tokens: req.maxTokens, system: req.system,
          messages: [{ role: 'user', content: req.user }], stream: true, ...extrasFor('anthropic', req.model) })
      });
      if (!res.ok) throw classifyHttp('anthropic', res.status, await safeJson(res));
      for await (const { data } of readSse(res, signal)) {
        const ev = JSON.parse(data);
        switch (ev.type) {
          case 'message_start': yield { type: 'usage', usage: { inputTokens: ev.message.usage?.input_tokens } }; break;
          case 'content_block_delta': if (ev.delta?.type === 'text_delta') yield { type: 'text', text: ev.delta.text }; break;
          case 'message_delta':
            if (ev.usage?.output_tokens != null) yield { type: 'usage', usage: { outputTokens: ev.usage.output_tokens } };
            if (ev.delta?.stop_reason) yield { type: 'finish', reason: mapAnthropicStop(ev.delta.stop_reason) }; break;
          case 'error': throw new LlmError('interrupted', ev.error?.type); // e.g. overloaded_error; never echo raw messages into UI
          default: break; // ping, content_block_start/stop, message_stop, unknown future events
        }
      }
    }
  };
}
```

### Stop test (unit, fake timers)
```ts
test('Stop keeps partial text and reports stopped', async () => {
  const { fetchImpl } = fakeSseFetch([
    'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":12,"output_tokens":1}}}\n\n',
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello there"}}\n\n'
  ], { holdOpen: true });
  const ctrl = new AbortController();
  const it = runGeneration({ prompt, provider: anthropicProvider({ getKey: async () => 'k', fetch: fetchImpl }),
                             model: 'claude-sonnet-5-5', signal: ctrl.signal, flushMs: 0 });
  const first = await it.next();                         // receives "Hello there"
  expect(first.value).toEqual({ type: 'text', text: 'Hello there' });
  ctrl.abort();
  const rest = []; for await (const u of it) rest.push(u);
  const done = rest.at(-1)!;
  expect(done.type === 'done' && done.result.status).toBe('stopped');
  expect(done.type === 'done' && done.result.text).toBe('Hello there');
});
```

### Leave-one-out mutation test
```ts
test.each(LEXICON.map((e) => [e.id, e] as const))('entry %s is load-bearing', (_id, entry) => {
  const without = LEXICON.filter((e) => e !== entry);
  const missed = entry.examples.filter((ex) => checkFairHousing(ex, without).length === 0);
  expect(missed.length).toBeGreaterThan(0);              // removing the entry must make the suite fail
});
test('planted mutation: dropping familial-status entries un-flags "no kids"', () => {
  const mutated = LEXICON.filter((e) => e.category !== 'familial-status');
  expect(checkFairHousing('No kids, please.', mutated)).toHaveLength(0);
  expect(checkFairHousing('No kids, please.')).not.toHaveLength(0);
});
```
If two entries legitimately overlap (both match an example), give each a distinct example that only it catches. Otherwise the entry is redundant and should be removed.

### SSR exits test (spike-verified pattern)
```ts
import { render } from 'svelte/server';
import GenerationPanel from './GenerationPanel.svelte';
test('exactly three exits, in order', () => {
  const { body } = render(GenerationPanel, { props: demoProps({ initialText: 'Hi', findings: [] }) });
  const group = body.match(/data-testid="generation-exits"[^>]*>([\s\S]*?)<\/div>/)![1];
  const controls = [...group.matchAll(/<(button|a)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => strip(m[2]).trim());
  expect(controls).toEqual(['Copy text', 'Open in email app', 'Mark as sent']);
  expect(body.match(/href="mailto:/g) ?? []).toHaveLength(1);
});
```
Note: `onMount`-loaded state does not run in SSR, so the panel needs props (or a pure controller) that let tests render the "draft exists" state without IndexedDB.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `claude-sonnet-5` | `claude-sonnet-5-5` (adaptive thinking on by default; `between_tools` lowest setting) | 2026-09-28 | Update the default; send extras only for this ID |
| `gpt-5.6-terra` as balanced default | `gpt-6.1-sol` featured as balanced; Terra still active | 2026 (6.1 Sol knowledge cutoff 2026-04-30) | Update the default; reasoning effort `low` |
| Gemini standard API keys | Auth keys default for new AI Studio keys (2026-05-28); **unrestricted standard keys rejected**; dormant unrestricted keys blocked (2026-05-07) | 2026-05 | Users with an old unrestricted key get auth errors. Add to the Gemini `auth` copy/explainer: "create a new key in AI Studio" (no UI-SPEC copy change needed: "create a new key" is already in the auth line) |
| Gemini `generateContent` featured in docs | Interactions API featured (beta); `generateContent` "remains fully supported" and recommended for production | 2026 | Locked choice stands; avoid Interactions (`Api-Revision` header breaks CORS) |
| Gemini 3.8 Flash $0.75/$3.75 | $1.50/$7.50 | 2027-01-01 | Date-effective pricing rows |
| HUD 2024 digital-advertising guidance | Withdrawn (91 FR 17291, effective 2025-09-17) | 2026-04-06 notice | Cite statute/regulation + Achtenberg memo only |

**Deprecated/outdated:**
- `claude-haiku-4-5` retirement "not sooner than 2026-10-15" (11 days out): may be listed as an option, never the default.
- Google REST samples with `?key=`: never copy them.

## Open Questions

1. **Gemini `thinkingLevel` JSON casing on `generateContent`.**
   - Known: the enum is documented as `LOW/MEDIUM/HIGH`; Interactions REST examples use lowercase `"low"`.
   - Unclear: whether generateContent REST accepts lowercase.
   - Recommendation: ship `'low'` in registry data. Live UAT step confirms. If it returns 400, change the one data value (or drop the extra). Low blast radius because extras are data.
2. **Cost line for unknown-price models and free-tier Gemini.**
   - Known: the UI-SPEC usage line always says "about {cost} on your {Provider} account".
   - Unclear: a user-overridden model has no pricing row, and a free-tier Gemini key costs $0.
   - Recommendation: unknown pricing → show tokens only and omit the cost clause (no fabricated metric). Gemini → show the paid-tier estimate with the existing "(estimate)" note. Record this as a UI-SPEC clarification in the plan.
3. **Re-inserting redacted names into the draft.**
   - Known: drafts will contain `{client_first_name}` tokens.
   - Unclear: whether portals should locally substitute originals after generation (keeps PII local and gives a usable draft).
   - Recommendation: add `restorePii(text, redactions)` to core now (tiny, pure, tested), but do not wire it in Phase 5's demo. Portal phases decide per feature.
4. **Exact Phase 3 APIs** (`testKey` registration signature, backup registry, Dexie base) are not built yet. Recommendation: Phase 5 plans code against the Phase 3 CONTEXT contract names (`getKey(provider)`, `testKey(provider)`, backup registry) and re-check them when Phase 3 lands.
5. **OpenAI 429 / 5xx CORS headers on the generation endpoints** could not be observed without a key. The disambiguation probe covers this either way; verify in live UAT.

## Deferred Live Checks (HUMAN-UAT, from the deployed origin `https://tranrealestate.github.io/`)

Owner-gated: the origin does not exist yet, and real keys are needed. Record these in the phase HUMAN-UAT file.
1. For each provider with a real, spend-limited key: Test connection → `ok` and the model is listed; generation streams; Stop halts within ~1 s and the partial text is kept; the usage line shows plausible tokens/cost.
2. Wrong key per provider → `auth` (specifically verify OpenAI generation with a bad key shows the auth error, not CORS, via the disambiguation probe).
3. Gemini with an **old unrestricted standard key** (if available) → auth error copy is sensible; a new auth key works via `x-goog-api-key`.
4. Gemini default extras (`thinkingLevel: 'low'`) accepted (Open Question 1); Anthropic `between_tools` + `effort: low` accepted on `claude-sonnet-5-5`; OpenAI `reasoning.effort: low` accepted on `gpt-6.1-sol`.
5. OpenRouter with `provider.data_collection: 'deny'` routes `anthropic/claude-sonnet-5.5` (no 404 "no allowed providers").
6. DevTools Network: no key in any URL; the request headers match the verified sets; no request leaves to a host outside the CSP list.
7. Re-run the keyless preflight/canary script (curl commands in Sources) on the day of launch, since provider CORS has changed without notice before.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.11 (projects `core`, `web`, `scripts`; network globally blocked via `tooling/vitest/no-network.ts`); Playwright 1.63.0 + @axe-core/playwright 4.13.0 (dual base, ports 4273-4275) |
| Config file | `vitest.config.ts` (root projects), `packages/core/vitest.config.ts`, `apps/web/vite.config.ts` (`test` block, env `node`), `apps/web/playwright.config.ts` |
| Quick run command | `corepack pnpm exec vitest run --project core --project web` (~5-10 s) |
| Full suite command | `corepack pnpm verify` (check, lint, unit, both builds, CSP assert, E2E+axe, guards; ~75 s warm) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AI-01 | SSE parser: spec cases (comments, CRLF/CR/LF, multi-line data, no-space after colon, `[DONE]`) + every-byte-offset re-split equality incl. UTF-8 `’` and emoji | unit | `corepack pnpm exec vitest run --project core packages/core/src/ai/sse.test.ts` | ❌ Wave 0 |
| AI-01 | Each adapter: exact URL/headers/body (no `key=` in URL; Anthropic 4 headers; OpenAI `store:false`; OpenRouter `data_collection:'deny'`; extras only for the default ID), text deltas, usage normalization, length/refusal/mid-stream error mapping, ignores thinking/reasoning deltas | unit (fake SSE) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/providers` | ❌ Wave 0 |
| AI-01 | Error classifier table (401/403/Gemini 400 API_KEY_INVALID/402/429/Anthropic 400 spend-limit/404/529/TypeError/AbortError) | unit | `corepack pnpm exec vitest run --project core packages/core/src/ai/errors.test.ts` | ❌ Wave 0 |
| AI-01 | Disambiguation probe: generation TypeError + models 401 → `auth`; + models 200 → `cors-blocked`; + models TypeError & offline → `network` | unit | `… --project web apps/web/src/lib/ai/providers/test-connection.test.ts` | ❌ Wave 0 |
| AI-01 | Test connection outcomes `ok / cors-blocked / auth / quota / network` + model-listed variant; canary never carries the key | unit | same file | ❌ Wave 0 |
| AI-01 | Runner: 50 ms batching (fake timers), Stop keeps partial text and status `stopped`, final flush, cost estimate with date-effective rows | unit | `… --project web apps/web/src/lib/ai/runner.test.ts` + `--project core packages/core/src/ai/cost.test.ts` | ❌ Wave 0 |
| AI-01 | Fixture provider streams word-by-word, respects abort, and every fixture text has zero Fair Housing findings | unit | `… apps/web/src/lib/ai/providers/fixture.test.ts` | ❌ Wave 0 |
| AI-01 | models.ts: every default has a pricing row valid today; every provider host ⊆ `svelte.config.js` connect-src | unit | `… apps/web/src/lib/ai/models.test.ts` | ❌ Wave 0 |
| AI-01 | `/settings/` AI drafting: sample mode streams and Stop works (Fixture); mocked Anthropic SSE renders; `route.abort` → cors-blocked error with **Set up OpenRouter** link; axe clean in each state | E2E + axe | `corepack pnpm build:root && corepack pnpm test:e2e -- tests/e2e/ai-drafting.spec.ts` | ❌ Wave 0 |
| AI-02 | ≥30 bad phrases each flagged with the expected category/severity; ≥30 neutral phrases yield zero findings; counts asserted (non-vacuity) | unit | `corepack pnpm exec vitest run --project core packages/core/src/fair-housing/check.test.ts` | ❌ Wave 0 |
| AI-02 | Offsets exact (`text.slice(start,end)`), overlap merge, Unicode boundaries, `applyAlternative` capitalization and remove-phrase tidy, ReDoS 50 ms budget | unit | same | ❌ Wave 0 |
| AI-02 | Leave-one-out per entry + planted familial-status mutation → suite fails | unit (mutation) | `… packages/core/src/fair-housing/mutation.test.ts` | ❌ Wave 0 |
| AI-02 | Gating: block → exits `aria-disabled` + reason; warn → ack checkbox required; ack cleared only when the warn set changes | unit (controller) + E2E | `… apps/web/src/lib/ai/ui/panel-controller.test.ts`; E2E planted block+warn fixture via mocked provider | ❌ Wave 0 |
| AI-03 | `needsGeminiWarning` truth table (provider × sample × containsClientData × session ack); ack written to sessionStorage only (never localStorage) | unit | `… apps/web/src/lib/ai/gemini-gate.test.ts` | ❌ Wave 0 |
| AI-03 | Dialog opens with initial focus on **Don't send to Gemini**; Escape/Don't send → zero requests to `generativelanguage.googleapis.com` (`page.on('request')` counter); Send → request made | E2E | `… tests/e2e/ai-drafting.spec.ts -g gemini` | ❌ Wave 0 |
| AI-04 | ESLint: `lib/ai/**` importing `$lib/leads/**` errors; `sendBeacon`/`window.open`/`XMLHttpRequest` error in `lib/ai/**` incl. providers | unit (lintText) | `corepack pnpm exec vitest run --project scripts scripts/eslint-rules.test.ts` | ✅ (extend) |
| AI-04 | Import-graph walk over `lib/ai/**` finds no `lib/leads` and no `web3forms`/`sendBeacon` text; planted graph proves the walker detects it | unit | `… --project web apps/web/src/lib/ai/no-auto-send.test.ts` | ❌ Wave 0 |
| AI-04 | SSR: exits group has exactly [Copy text, Open in email app, Mark as sent]; only one `mailto:` in panel HTML; gated `<a>` has no href; `navigator.clipboard` only in `exits.ts` | unit (SSR) | `… apps/web/src/lib/ai/ui/GenerationPanel.test.ts` | ❌ Wave 0 |
| AI-04 | `buildMailto` encoding (`\r\n` → `%0D%0A`, `&`/`?`/`#` encoded, length for the 1,800-char note) | unit | `… apps/web/src/lib/ai/exits.test.ts` | ❌ Wave 0 |
| (privacy) | `redactPii`: emails/phones/known names → tokens; no false hits on prices/zips/years; `inputHash` from the redacted payload only | unit | `… --project core packages/core/src/privacy/redact-pii.test.ts` | ❌ Wave 0 |

Failure modes each test catches: parser drops or splits tokens; adapter leaks the key into the URL or sends the wrong headers (CORS break); OpenAI bad key mislabeled as CORS; Stop loses partial text; lexicon over- or under-flags, or an entry is dead; Gemini data sent before consent or consent persisted; a fourth exit or a programmatic send path appears.

### Sampling Rate
- **Per task commit:** `corepack pnpm exec vitest run --project core --project web` (+ `--project scripts` when eslint config changes)
- **Per wave merge:** `corepack pnpm check && corepack pnpm lint && corepack pnpm test:unit && corepack pnpm build:root && corepack pnpm test:e2e -- tests/e2e/ai-drafting.spec.ts`
- **Phase gate:** `corepack pnpm verify` green before `/gsd:verify-work`; Deferred Live Checks recorded in HUMAN-UAT

### Wave 0 Gaps
- [ ] `apps/web/src/lib/ai/providers/fake-sse.ts`: shared fake SSE fetch helper (Pattern 7)
- [ ] `packages/core/src/ai/{sse,errors,cost}.test.ts`, `packages/core/src/fair-housing/{check,mutation}.test.ts`, `packages/core/src/privacy/redact-pii.test.ts`
- [ ] `apps/web/tests/e2e/ai-drafting.spec.ts` with a **spike first**: prove a `page.route`-fulfilled Anthropic SSE (with ACAO header) renders in `/settings/` under both bases (Pitfall 8)
- [ ] Extend `scripts/eslint-rules.test.ts` for the new `lib/ai/**` boundary rules
- [ ] No framework install needed (SSR render verified; no jsdom/browser-mode)

## Sources

### Primary (HIGH confidence)
- **Live probes 2026-10-04** (curl, `Origin: https://tranrealestate.github.io`, no keys / invalid keys): preflights for all 9 endpoints; actual-response ACAO on 401/400/403 for models lists, generation endpoints, OpenRouter `/key`; the OpenAI `/v1/responses` + `/v1/chat/completions` bad-key 401 **without** ACAO (reproduced, both origins); Anthropic without the browser header → 401 without ACAO; keyless canaries all CORS-readable; OpenRouter live model slugs and pricing from `/api/v1/models`
- Anthropic: [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview), [Claude Sonnet 5.5](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [Streaming](https://platform.claude.com/docs/en/build-with-claude/streaming), [Effort](https://platform.claude.com/docs/en/build-with-claude/effort), [Errors](https://platform.claude.com/docs/en/api/errors), [List Models](https://platform.claude.com/docs/en/api/models/list)
- OpenAI: [Models](https://developers.openai.com/api/docs/models), [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra), [Streaming events reference](https://developers.openai.com/api/reference/resources/responses/streaming-events), [Create response reference](https://developers.openai.com/api/reference/resources/responses/methods/create) (`store` default, `reasoning.effort`), [Deprecations](https://developers.openai.com/api/docs/deprecations)
- Google: [API keys (standard vs auth keys)](https://ai.google.dev/gemini-api/docs/api-key), [Models](https://ai.google.dev/gemini-api/docs/models), [Pricing](https://ai.google.dev/gemini-api/docs/pricing), [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms) (effective 2026-03-23), [generateContent API reference](https://ai.google.dev/api/generate-content), [Models API](https://ai.google.dev/api/models), [Interactions overview](https://ai.google.dev/gemini-api/docs/interactions), [Thinking](https://ai.google.dev/gemini-api/docs/thinking)
- OpenRouter: [Streaming](https://openrouter.ai/docs/api/reference/streaming), [API overview (attribution headers, usage.cost)](https://openrouter.ai/docs/api/reference/overview), [Limits / `GET /api/v1/key`](https://openrouter.ai/docs/api/reference/limits), [Provider selection (`data_collection`)](https://openrouter.ai/docs/guides/routing/provider-selection)
- Fair housing: [24 CFR 100.75 (Cornell LII)](https://www.law.cornell.edu/cfr/text/24/100.75); HUD Achtenberg memo, Jan 9 1995, full text extracted from [copy hosted by Miami Valley Fair Housing Center](https://metrofairhousing.org/wp-content/uploads/2020/07/HUD-Advertising-Guidance.pdf); [Federal Register 2026-06624 (91 FR 17291)](https://www.federalregister.gov/documents/2026/04/06/2026-06624/notification-of-withdrawal-of-fair-housing-and-equal-opportunity-guidance-documents) via its API/text (withdrawal list read in full)
- Repo verification: `eslint.config.js` (providers folder `no-restricted-syntax: off`), `svelte.config.js` connect-src, `tooling/vitest/no-network.ts`, `apps/web/vite.config.ts`; SSR `render()` spike in the `web` Vitest project (passed, then deleted)
- npm registry (`npm view`, 2026-10-04): dompurify 3.4.16, eventsource-parser 4.1.1, vitest-browser-svelte 3.1.0

### Secondary (MEDIUM confidence)
- [Fair Housing Council of South Texas: Achtenberg memo resource](https://fairhousingtx.org/resource/hud-memo-guidance-regarding-advertisements-under-%C2%A7804c-of-the-fair-housing-act-january-9-1995/) (corroborates the memo text)
- Playwright cross-origin mocking behavior: [#3331](https://github.com/microsoft/playwright/issues/3331), [#12929](https://github.com/microsoft/playwright/issues/12929), [#37245](https://github.com/microsoft/playwright/issues/37245)
- [Simon Willison: Anthropic CORS header (2024)](https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/) (behavior re-verified live today)

### Tertiary (LOW confidence)
- Gemini `thinkingLevel` lowercase acceptance on generateContent REST (Open Question 1)
- State protected-class coverage counts (SOI, SOGI, age, marital status): summarized from prior project research, not re-verified per state; the copy says "many state and local laws", which avoids a count

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new runtime deps; SSR test path spike-verified in-repo.
- Provider protocols and CORS: HIGH. Official docs plus live probes today; LOW only on Gemini thinkingLevel casing.
- Model IDs and pricing: HIGH. Official model pages today; OpenRouter slugs from the live list.
- Fair Housing sourcing: MEDIUM-HIGH. Primary federal texts read in full; severity assignments are a product judgment, so legal review is advised before the GTM push (already a STATE.md note).
- Pitfalls: HIGH for 1-5, 9-11 (verified); MEDIUM for 8 (Playwright preflight internals).

**Research date:** 2026-10-04
**Valid until:** 2026-10-18 for model IDs and CORS (fast-moving: Haiku 4.5 retirement window opens 10-15; re-run the probe script before launch); 2026-11-04 for everything else.
