# Phase 5: AI Layer: Providers, Streaming & Fair Housing Guardrails - Context

**Gathered:** 2026-10-04
**Status:** Ready for planning

<domain>
## Phase Boundary

The AI layer every generator (Phases 6-9) sits on:
- `LlmProvider` port with raw-`fetch` adapters for Anthropic, OpenAI, Gemini, OpenRouter, and a Fixture provider for keyless demo mode
- shared SSE parser and a runner (abort, usage, cost estimate, `maxTokens`, render throttle)
- `models.ts` registry with models-list validation and a "Test connection" that distinguishes CORS vs auth vs quota
- versioned prompt registry with pre-send PII minimization
- deterministic Fair Housing checker (lexicon in `packages/core`) gating every output
- Gemini free-tier data warning
- a `GenerationPanel` component whose only exits are Copy, Open in email client (`mailto:`), and Mark as sent

Requirements: AI-01..04. Feature prompts (outreach, memo, listing description) belong to the portal phases; this phase ships the infrastructure plus one generic "demo prompt" to exercise it end to end.

</domain>

<decisions>
## Implementation Decisions

The owner chose fully autonomous mode on 2026-10-04. Researched recommended defaults are adopted.

### Providers & streaming
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

### Fair Housing checker
- **Deterministic lexicon** in `packages/core/src/fair-housing/`: entries `{phrase | regex, category, severity: 'block'|'warn', explanation, alternative}`. Categories follow FHA §3604(c) protected classes (race, color, religion, sex, familial status, national origin, disability) plus common state additions (source of income, age, marital status, sexual orientation/gender identity) tagged `state`.
- **Sourcing:** HUD Achtenberg memo (1995) word lists plus commonly published state association lists, paraphrased into our own entries. No copying of a proprietary list verbatim. Each entry cites its basis in a `source` field.
- **Behavior:** runs on every generated text (and on user-edited text before copy/send). `block` findings disable Copy/Open-email until the user applies the alternative or edits; `warn` findings require an explicit acknowledgement checkbox. Findings render inline (highlight + popover with explanation and one-click "Use alternative").
- **Property-not-people system prompt** fragment is prepended by the prompt registry to every housing-copy prompt.
- **Test suite:** ≥30 known-bad phrases flagged (e.g. "perfect for young professionals", "no kids", "Christian community", "walking distance to church", "no Section 8", "able-bodied") and ≥30 neutral phrases pass (e.g. "two bedrooms", "near transit", "pet policy on request", "wheelchair accessible entrance" — accessibility *features* are fine, "handicap-only" style exclusions are not). A planted lexicon mutation test proves the suite can fail.

### Privacy & safety
- **PII minimization before send:** prompt inputs are passed through `core.redactPii` (emails, phones, full names replaced with role tokens like `{client_first_name}`) unless the feature explicitly needs them; the panel shows "What will be sent" expandable preview.
- **Gemini free-tier warning:** before any prompt that includes client/lead data is sent to Gemini, a dialog explains that free-tier Gemini may use data for training, with Cancel as the default action. The warning can be acknowledged for the session only, never permanently.
- **No auto-send path:** no module may import a sending function; the only exits are Copy (Clipboard API), `mailto:` link built from the text, and "Mark as sent" (local log). A unit test asserts the AI module graph has no import from leads/web3forms, and the generation panel has exactly those three actions.
- **Output rendering:** plain text or DOMPurify-sanitized markdown only; never `{@html}` raw model output (lint rule exists).

### Artifacts
- Every generation is stored (Phase 3 Dexie) as `{id, feature, promptId@version, provider, model, inputHash, text, findings, status: draft|acknowledged|sent, createdAt}`; registered in the backup export.

### Amendments (2026-10-04, cross-phase reconciliation)
- Settings section order is fixed as: 1 API keys · 2 RentCast usage (Phase 4) · 3 AI drafting (Phase 5) · 4 Key security · 5 Backup & restore · 6 Storage status · 7 Install app · 8 Getting started (Phase 10). Phase 5's UI-SPEC placed "AI drafting" second; it is third. Data before AI mirrors phase order.

### Claude's Discretion
- SSE parser implementation details; cost table values; render throttle; exact lexicon wording and count beyond the minimums; prompt registry file layout.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Reserved dir `apps/web/src/lib/ai/providers/`.
- Phase 3 vault (`getKey(provider)`), settings store, Dexie base, backup registry, confirmation dialog pattern.
- Phase 2 tokens/components; Phase 4 `ProvenanceChip` pattern for the "Sample output" badge.

### Established Patterns
- Network blocked in unit tests; adapters tested with fake `fetch` returning `ReadableStream` SSE bodies.
- Pure logic in `packages/core` (lexicon, redaction, cost math).
- `fetch(` ban lint rule requires targeted disables in adapter files only.

### Integration Points
- Settings (Phase 3): provider picker, per-provider key + model override, Test connection.
- Portals (6-9): `GenerationPanel` with a feature prompt; `useFairHousing(text)` for user-typed copy too (listing descriptions in Phase 9).
- Phase 10 standalone Fair Housing checker page reuses the lexicon with zero API cost.

</code_context>

<specifics>
## Specific Ideas

- Error copy is specific and actionable: CORS errors name the fallback (OpenRouter); auth errors deep-link to Settings; quota errors say "your provider account", never "Tran".

</specifics>

<deferred>
## Deferred Ideas

- Local/Ollama provider (post-v1).
- Prompt A/B telemetry (post-v1, needs backend).

</deferred>
