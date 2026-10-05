---
phase: 05-ai-layer-providers-streaming-fair-housing-guardrails
plan: 09
subsystem: ai-web-pipeline
tags: [ai, prompts, guardrail, redaction, runner, streaming, fixture, tdd]
requires:
  - "05-01: @tran/core/ai (LlmError, isAbort, toLlmError, estimateCostUsd)"
  - "05-03: @tran/core/privacy (redactPii, KnownPii, Redaction)"
  - "05-04: @tran/core/fair-housing (checkFairHousing, populated lexicon)"
  - "05-05: ports.ts (LlmRequest/LlmEvent/LlmProvider), models.ts (pricingFor)"
provides:
  - "apps/web/src/lib/ai/prompts/guardrail.ts: HOUSING_COPY_GUARDRAIL (guardrail.property-not-people v1)"
  - "apps/web/src/lib/ai/prompts/types.ts: PromptBuild, PromptDef, BuiltPrompt"
  - "apps/web/src/lib/ai/prompts/hash.ts: sha256Hex"
  - "apps/web/src/lib/ai/prompts/registry.ts: registerPrompt, getPrompt, buildPrompt"
  - "apps/web/src/lib/ai/prompts/shared/demo.v1.ts: demoV1, DEMO_INPUTS, DemoInputs"
  - "apps/web/src/lib/ai/runner.ts: runGeneration, RunStatus, GenerationResult, RunUpdate, RunOptions"
  - "apps/web/src/lib/ai/providers/fixture.ts: fixtureProvider, FixtureDeps"
  - "apps/web/src/lib/ai/providers/fixture-outputs.ts: FIXTURE_OUTPUTS"
affects: [panel controller wiring (runner.svelte.ts), Settings "Try a draft", Stop E2E, portal-phase prompts]
tech-stack:
  added: []
  patterns:
    - "Guardrail prepended and PII redacted inside buildPrompt, so no caller can skip either"
    - "inputHash = sha256(system + '\\n\\n' + user) computed on the redacted payload only"
    - "Runner batching uses an injected clock (no global fake timers); every text update is the full text"
    - "Fixture output lookup uses Object.hasOwn (same rule as the 05-05 model registry)"
key-files:
  created:
    - apps/web/src/lib/ai/prompts/guardrail.ts
    - apps/web/src/lib/ai/prompts/types.ts
    - apps/web/src/lib/ai/prompts/hash.ts
    - apps/web/src/lib/ai/prompts/registry.ts
    - apps/web/src/lib/ai/prompts/shared/demo.v1.ts
    - apps/web/src/lib/ai/prompts/registry.test.ts
    - apps/web/src/lib/ai/runner.ts
    - apps/web/src/lib/ai/runner.test.ts
    - apps/web/src/lib/ai/providers/fixture.ts
    - apps/web/src/lib/ai/providers/fixture-outputs.ts
    - apps/web/src/lib/ai/providers/fixture.test.ts
  modified: []
decisions:
  - "registerPrompt rejects a duplicate id+version; a different version of the same id replaces the entry (portal phases bump versions)"
  - "Runner emits 'first-token' only on the first text event; a run that errors before any text never emits it"
  - "A 'refused' finish turns a 'done' run into status 'error' with LlmError('refused') but keeps finish 'refused' and the partial text; Stop wins over a refused finish"
  - "Fixture output lookup is own-property only, so promptIds like 'constructor' or '__proto__' fall back to the default sample"
  - "Fixture checks signal.aborted before the first word, so a pre-aborted run never yields text"
metrics:
  duration: 6min
  completed: 2026-10-05
  tasks: 3
  files: 11
---

# Phase 5 Plan 09: Prompt registry, generation runner and Fixture provider Summary

The web app now has a provider-independent generation pipeline. `buildPrompt` prepends the versioned property-not-people guardrail to every housing-copy prompt, swaps declared client names, emails and phones for `{role}` tokens, and returns a SHA-256 of exactly what will be sent. `runGeneration` streams any `LlmProvider` with full-text updates at most every 50 ms, keeps partial text on Stop, and reports merged usage and date-effective cost. `fixtureProvider` streams pre-linted sample output word by word with no key and no network.

## What was built

- **prompts/guardrail.ts**: `HOUSING_COPY_GUARDRAIL` (`guardrail.property-not-people`, version 1). The text is the plan's wording verbatim, and a test confirms it passes `checkFairHousing` itself.
- **prompts/registry.ts**: a module-level `Map` pre-registered with `shared/demo@1`. `buildPrompt` builds, prefixes the guardrail when `housingCopy` is true, runs `redactPii` on the user content, and hashes `system + '\n\n' + user` after redaction. The result carries only the sent payload and the redaction list, never the raw inputs (a test pins the exact key set).
- **prompts/shared/demo.v1.ts**: the generic demo prompt with fictional inputs (`Jordan Rivera`, `jordan.rivera@example.com`, `(212) 555-0147`, `18 Example Lane`). maxTokens is 2048 and containsClientData is true.
- **runner.ts**: `runGeneration` follows RESEARCH Pattern 6 with the plan's refinements: `last = -Infinity`, a single `first-token` update, an explicit `LlmRequest` (including `clientDataAck` and `promptId`), abort → `'stopped'`, other errors → `toLlmError`, refused → error, one final flush before `done`, and injectable `now`, `flushMs` and `at`. It contains no `fetch(`.
- **providers/fixture.ts + fixture-outputs.ts**: id `'fixture'`. It splits the output into words that keep their trailing whitespace, plus any leading whitespace, so the stream concatenates back exactly. Between words it waits `20 + floor(random * 41)` ms (20 to 60). The default sleep is `setTimeout`-based and rejects with an `AbortError` on abort. It emits no usage event, so cost stays undefined. The demo sample signs off with `{client_name}`, `{client_email}` and `{client_phone}`.

## Verification

- `vitest run --project web apps/web/src/lib/ai`: 305 tests passed across my 3 files and the existing ones. This plan adds 10 registry tests, 13 runner tests and 9 fixture tests. The only failing file is 05-12's in-flight RED test `ui/fair-housing-ui.test.ts`, which fails because its `.svelte` components don't exist yet. That file isn't owned by this plan.
- `corepack pnpm check`: 0 errors in this plan's files. All 20 reported errors are in 05-12's `ui/fair-housing-ui.test.ts`. An earlier run also showed 05-08's RED `providers/gemini.test.ts`, which cleared once that adapter landed. After Task 2 the whole web project checked clean (0 errors).
- `prettier --check` and `eslint` on all 11 files: clean. `corepack pnpm guard`: passed. `corepack pnpm banned`: passed.
- Notable proofs:
  - The sha256 `abc` vector matches.
  - The batching trace with 50 ms windows gives exactly `['a', 'abcd', 'abcde']`.
  - After Stop, the result is `'stopped'` with `'Hello there'` and no error.
  - Merged usage of 1000 in and 1000 out at `claude-sonnet-5-5` costs 0.012 (to within 1e-12).
  - The fixture's Stop through `runGeneration`, using the real default sleep, returns a strict non-empty prefix of the demo text.
  - Every `FIXTURE_OUTPUTS` value returns `checkFairHousing(...) == []` and has no redactable email or phone.

## Requirement advanced

AI-01 gains streaming with Stop and the keyless demo path. AI-02 gains the guardrail prepended by the registry. AI-03 gains client-data minimization before send and a hash of the redacted payload. Per the orchestrator, all three stay open until the 05-16 phase gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixture output lookup on the prototype chain**
- **Found during:** Task 3
- **Issue:** The plan's `outputs[req.promptId ?? '']` would return `Object.prototype` members (a function) for a promptId like `constructor`, and `text.match` would then throw.
- **Fix:** Lookups are now own-property only (`Object.hasOwn`) and fall back to `default`. The test covers `constructor` and `__proto__`.
- **Files modified:** apps/web/src/lib/ai/providers/fixture.ts, fixture.test.ts
- **Commit:** fff2f14

### Additions

- The default sleep removes its abort listener when the timer resolves, so listeners don't build up across about 70 words on one signal.
- The fixture throws an `AbortError` if the signal is already aborted before the first word.
- Extra tests cover the default 50 ms window boundary (49 vs 50 ms), a run with no usage (undefined cost), an error that never echoes the provider's message, and whitespace round-tripping for injected outputs.

## Known Stubs

None. The `default` fixture output is intentional sample copy, and portal phases add their own per-prompt samples.

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 RED | 767fa04 | test(05-09): add failing prompt registry tests |
| 1 GREEN | b6511fd | feat(05-09): prompt registry with guardrail and PII minimization |
| 2 RED | 7ef161a | test(05-09): add failing generation runner tests |
| 2 GREEN | a8fec84 | feat(05-09): generation runner |
| 3 RED | 109b6dc | test(05-09): add failing fixture provider tests |
| 3 GREEN | fff2f14 | feat(05-09): fixture provider |

## Self-Check: PASSED
