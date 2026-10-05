---
phase: 05-ai-layer-providers-streaming-fair-housing-guardrails
verified: 2026-10-05T22:12:35Z
status: human_needed
score: 4/4 truths verified (automated); 10 owner-gated items pending in 05-HUMAN-UAT.md
human_verification:
  - test: "H1 — Per provider real-key Test connection, streaming, Stop, usage"
    expected: "Each provider accepted key + model-available line; text streams word by word; Stop halts within ~1s and keeps partial text; usage line shows plausible tokens/cost"
    why_human: "Needs the owner-created tranrealestate.github.io origin and real spend-limited keys; CI never calls providers"
  - test: "H2 — Wrong key per provider shows auth, not CORS (especially OpenAI)"
    expected: "'{Provider} didn't accept your key' with Open AI settings; OpenAI specifically distinguishes auth from CORS via the disambiguation probe"
    why_human: "Live CORS behavior of the provider edge"
  - test: "H3 — Gemini key types (AI Studio vs legacy unrestricted)"
    expected: "Key sent only in x-goog-api-key header, never ?key=; sensible copy for either key type"
    why_human: "Needs real Google keys"
  - test: "H4 — Default-model extras accepted by live APIs"
    expected: "No 400 on any default model for Gemini thinkingLevel, Anthropic thinking/effort, OpenAI reasoning.effort"
    why_human: "Live API validation of exact field names/casing"
  - test: "H5 — OpenRouter data_collection 'deny' routing"
    expected: "Stream succeeds with a no-data-collection provider; no 404 'no allowed providers'"
    why_human: "Live OpenRouter routing behavior"
  - test: "H6 — Network hygiene in DevTools on the real origin"
    expected: "No key in any URL; request headers match the verified sets; only the four provider hosts plus own origin are contacted; no CSP violations"
    why_human: "Real browser, real origin, real keys"
  - test: "H7 — Launch-day CORS re-probe + OpenAI 429/5xx header check"
    expected: "Keyless preflights/canaries for all four endpoints stay CORS-readable for the real origin"
    why_human: "Time-sensitive live provider-edge behavior"
  - test: "H8 — Model IDs and prices re-verified before launch"
    expected: "claude-sonnet-5-5, gpt-6.1-sol, gemini-3.8-flash, anthropic/claude-sonnet-5.5 still current; haiku retirement and 2027-01-01 Gemini price doubling tracked"
    why_human: "Provider model pages change over time; RESEARCH valid only until 2026-10-18"
  - test: "H9 — Legal review of the Fair Housing lexicon"
    expected: "A qualified reviewer signs off on wording/severities/alternatives before public GTM push"
    why_human: "Professional legal judgment, not a code check"
  - test: "H10 — Remembered key shows Test connection after reloads on the real origin"
    expected: "Every AI card with a key shows Test connection across multiple reloads"
    why_human: "Registration timing on a real device; automated proxies exist (testers.svelte.browser.test.ts) but the real-origin reload path is owner-gated"
---

# Phase 5: AI Layer, Providers, Streaming & Fair Housing Guardrails Verification Report

**Phase Goal:** Users can generate AI text with their own provider key safely: output streams in and can be stopped, is checked for Fair Housing problems, and never leaves the app without a human action.
**Verified:** 2026-10-05T22:12:35Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can choose Anthropic/OpenAI/Gemini/OpenRouter, test the key (errors distinguish CORS vs. auth vs. quota), watch streaming with working Stop; fixture provider streams sample output with no key | ✓ VERIFIED (automated) | `apps/web/src/lib/ai/models.ts` registry (4 live providers + fixture), `providers/{anthropic,openai,gemini,openrouter}.ts` (adapters, 107-174 lines each, substantive), `providers/test-connection.ts` + `test-connection.test.ts` (5 outcomes), `runner.test.ts` (Stop keeps partial text), `setup.ts` `selectProvider` (locked/sample/live resolution with reason), E2E `ai-drafting.spec.ts` (CORS vs auth distinguished in a real browser, both base paths). 788 targeted unit/SSR tests green; real-provider behavior deferred to H1/H2/H6/H7 (owner-gated, non-blocking per Phase 1 precedent) |
| 2 | AI housing copy with a problem phrase is flagged inline with explanation + alternative before copy/send; checker suite 30+/30+ passes | ✓ VERIFIED | `packages/core/src/fair-housing/lexicon.ts` (41 entries), `suite.ts` (39+ bad-phrase array entries, several multi-variant; 40 neutral phrases) — `check.test.ts` runs 296 passing assertions against the suite, exceeding the 30+/30+ contract; `mutation.test.ts` proves the suite is load-bearing (leave-one-out + planted mutation both red when weakened); `FairHousingText.svelte`/`FindingPopover.svelte`/`FindingsSummary.svelte` render inline highlights + popover (SSR-tested, no `{@html}`); `panel-controller.ts` `computeGate` blocks all three exits until resolved — verified live in `ai-guardrails.spec.ts` ("Perfect for young professionals" / "walking distance to church" flagged, exits gated, Use alternative + ack unlock, clipboard receives the fixed text) |
| 3 | User with a free-tier Gemini key is warned before client/lead data is sent and can cancel | ✓ VERIFIED | `gemini-gate.ts` `needsGeminiWarning` (true only for live Gemini + client data + no session ack) + `GeminiDataDialog.svelte` (default focus on "Don't send to Gemini") + `panel-state.svelte.ts` wiring (dialog before any provider call); `gemini.ts` adapter also refuses network calls without an explicit consent flag (defense in depth); E2E `ai-guardrails.spec.ts` asserts cancel/Escape → zero requests to `generativelanguage.googleapis.com`, confirm → exactly one, and the ack lives in `sessionStorage` only (`localStorage` keys checked empty) |
| 4 | Generation panel offers only copy / open-in-email-client / mark-as-sent; no code path sends automatically | ✓ VERIFIED | Structural proof confirmed directly in the live tree: `grep` for `mailto:` and `navigator.clipboard` across `apps/web/src/lib/ai/**` (excluding tests) returns only `exits.ts` for both; ESLint boundary in `eslint.config.js` bans lead-delivery imports, `sendBeacon`, `window.open`, XHR/WebSocket/EventSource under `lib/ai` (including `providers/`, confirmed by rule-override test at `scripts/eslint-rules.test.ts:514`); `apps/web/src/lib/ai/no-auto-send.test.ts` walks the real `lib/ai` import graph (TS `preProcessFile`, static+dynamic+`.svelte` script blocks) proving no path into `lib/leads` or any `web3forms` reference, with planted-graph tests proving the walker can fail; `GenerationPanel.test.ts` SSR-asserts exactly three exits in order |

**Score:** 4/4 truths verified by automated evidence. 10 items remain owner-gated per `05-HUMAN-UAT.md` (deployed origin + real provider keys), which is expected and documented as non-blocking (same pattern as Phase 1).

### Required Artifacts (spot-checked across all 16 plans' must_haves)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/ai/{sse,errors,cost}.ts` | SSE parser, error classifier, date-effective cost | ✓ VERIFIED | `gsd-tools verify artifacts` passed; tests green |
| `packages/core/src/fair-housing/{types,pattern,allow,lexicon,check,apply}.ts` | Matcher engine, allow-list, 41-entry lexicon, applyAlternative | ✓ VERIFIED (see note) | `allow.ts` flagged by the automated grep checker for not literally containing "mother in law suite" — the file contains `p\`mother in law (?:suite|apartment|unit)\``, a regex that *matches* "mother in law suite" at runtime; this is a string-literal false positive in the grep-based checker, not a real gap. Confirmed against the plan's own acceptance_criteria text ("contains `mother in law`") |
| `packages/core/src/privacy/{redact-pii,restore-pii}.ts` | PII tokenization + local restore | ✓ VERIFIED | Tests green, barrel exports confirmed |
| `apps/web/src/lib/ai/{ports,models}.ts` | Provider port + registry with CSP-matching hosts | ✓ VERIFIED | All 4 provider hosts (`api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com`, `openrouter.ai`) present in `svelte.config.js` `connect-src`; model IDs match CLAUDE.md-verified defaults |
| `apps/web/src/lib/ai/providers/{http,anthropic,openai,gemini,openrouter,fixture,test-connection,fake-sse}.ts` | HTTP/SSE plumbing + 4 live adapters + fixture + test tooling | ✓ VERIFIED | All substantive (87-174 lines), no stub patterns found |
| `apps/web/src/lib/ai/{runner,exits,gemini-gate,prompts/*}.ts` | Streaming runner, single-exit module, Gemini gate, guardrail+redaction prompt builder | ✓ VERIFIED | `mailto:`/`navigator.clipboard` isolated to `exits.ts`; `prompts/registry.ts` prepends guardrail + redacts before hashing (confirmed by `buildPrompt` tests) |
| `apps/web/src/lib/ai/ui/*` (panel-controller, panel-state, GenerationPanel, GeminiDataDialog, FairHousingText, FindingPopover, FindingsSummary, DraftHistory, AiProviderPicker, SampleOutputToggle, AiModelField, TestConnectionResult, AiDraftingSection) | Full UI layer | ✓ VERIFIED | SSR tests green for all; `GenerationPanel.test.ts` confirms exactly-three-exits; `AiDraftingSection` mounted as Settings section 3 |
| `apps/web/src/lib/features/shared/settings/ProviderKeyCard.svelte` | Model field + Test connection per AI provider card | ✓ VERIFIED | File lives at this path (moved by Phase 3 from the plan's expected `components/settings/` path, documented in 05-14-SUMMARY); imports and renders `AiModelField` + `TestConnectionResult` for the 4 AI provider ids |
| `apps/web/src/lib/features/settings/sections.ts` | Section registry, order, nav | ✓ VERIFIED | `ai-drafting` at position 3 (after api-keys, rentcast-usage; before key-security), matching both `sections.ts` and `+page.svelte` component map |
| `eslint.config.js` (05-10 boundary) | lib/ai import/global/property restrictions | ✓ VERIFIED | Boundary block present with `AI modules must never import lead delivery` message; override-does-not-clobber proven by dedicated test |
| `apps/web/tests/e2e/{ai-drafting,ai-guardrails,ai-a11y}.spec.ts` + `helpers/ai-mocks.ts` | E2E coverage for streaming, guardrails, a11y | ✓ VERIFIED | All four files exist with substantive content (sessionStorage assertions, Gemini dialog focus, countRequests helper, axe wcag22aa tags) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `apps/web/package.json` | `packages/core` | workspace dependency | ✓ WIRED (tool false negative) | `"@tran/core": "workspace:*"` present; the automated checker searched for the literal substring "packages/core" which isn't how pnpm workspace deps are declared |
| `scripts/eslint-rules.test.ts` | `eslint.config.js` | lintText fixtures under `lib/ai/**` incl. providers | ✓ WIRED (tool false negative) | Real fixture path is `${AI}/providers/__lintfix__` (constant `PROVIDERS_FIX`), not the literal string the checker searched for; confirmed by reading the file directly — providers-folder coverage exists (lines 496-521) |
| `apps/web/src/lib/components/settings/ProviderKeyCard.svelte` → `AiModelField.svelte` | rendered for the 4 AI providers | ✓ WIRED (tool false negative — stale path) | Real file is at `apps/web/src/lib/features/shared/settings/ProviderKeyCard.svelte` (Phase 3 moved it); import and render of `AiModelField`/`TestConnectionResult` confirmed directly |
| `apps/web/src/lib/ai/ui/FairHousingText.svelte` → `panel-controller.ts` | `segmentText` | ✓ WIRED | Confirmed via `gsd-tools verify key-links` |
| All other declared key_links across 05-01..05-16 | — | — | ✓ WIRED | `gsd-tools verify key-links` returned `all_verified: true` for 13/16 plans; the 3 exceptions above are tool-pattern false negatives, not real gaps, each manually confirmed against the live file tree |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AI-01 | 05-01, 05-05, 05-06, 05-07, 05-08, 05-09, 05-11, 05-13, 05-14, 05-15, 05-16 | Choose provider, stream, Stop | ✓ SATISFIED | Models registry, 4 adapters, runner, panel-state/GenerationPanel, E2E `ai-drafting.spec.ts`. Live-origin/real-key behavior deferred to H1/H2/H4/H5/H6/H7/H8/H10 (owner-gated) |
| AI-02 | 05-02, 05-04, 05-06, 05-09, 05-12, 05-13, 05-16 | Fair Housing checker gates copy/send | ✓ SATISFIED | 41-entry lexicon, 296-assertion suite test, mutation-proof load-bearing suite, UI gating confirmed in SSR + E2E. H9 (legal review of wording) is owner-gated, non-blocking |
| AI-03 | 05-03, 05-08, 05-09, 05-13, 05-16 | Gemini free-tier client-data warning | ✓ SATISFIED | `gemini-gate.ts`, `GeminiDataDialog.svelte`, adapter-level consent guard, E2E request-count + sessionStorage-only proof. H3/H5 (real Gemini key types / OpenRouter routing) owner-gated |
| AI-04 | 05-03, 05-06, 05-10, 05-11, 05-13, 05-14, 05-15, 05-16 | No automatic send | ✓ SATISFIED | Single-exit structural proof (`mailto:`/`clipboard` only in `exits.ts`), ESLint boundary, TS import-graph walk with planted-failure proof, SSR exactly-three-exits test |

No orphaned requirements: REQUIREMENTS.md maps AI-01..04 exclusively to Phase 5, and all four appear in at least one plan's `requirements` frontmatter. REQUIREMENTS.md marks all four `[x]` Complete, which this verification independently confirms is genuinely delivered at the automated-evidence level — not just claimed.

### Fix-Commit Verification (05-16 post-hoc fixes)

| Commit | Fix | Test present | Confirmed |
|--------|-----|--------------|-----------|
| `748d4e9` | Reactive `SvelteMap` tester registry (card rendered before tester registers now updates) | `apps/web/src/lib/storage/secrets/testers.svelte.browser.test.ts` | ✓ Ran green (1/1) in isolation under `--project web-browser` |
| `826a61d` | Honest "Stopped before any text arrived" status (was falsely claiming a partial draft was kept) | `apps/web/src/lib/ai/ui/ai-copy.test.ts` + `panel-state.test.ts` additions | ✓ Ran green as part of the 144-test targeted run |
| `d9aa087` | `defaultPreferred` prefers saved key, then locked key, then none (was falsely showing "No AI key yet" when only locked keys existed) | `apps/web/src/lib/ai/setup.test.ts` addition | ✓ Ran green as part of the 144-test targeted run |

### Anti-Patterns Found

None blocking. Scanned `apps/web/src/lib/ai/**`, `packages/core/src/{ai,fair-housing,privacy}/**` for TODO/FIXME/placeholder/stub-return patterns. The only "placeholder" hits are legitimate doc-comments describing the `{token}` redaction mechanism, not incomplete code. `return null` sites in `models.ts` (`validateModelId`) and `AiModelField.svelte` are valid-input returns, not stubs. All provider adapter files are 87-174 lines of substantive logic (headers, SSE parsing, error classification, consent gating) — none are placeholder shells.

### Human Verification Required

See YAML frontmatter `human_verification` (H1-H10, sourced directly from `05-HUMAN-UAT.md`). These are explicitly owner-gated (require the `tranrealestate` GitHub organization, a deployed origin, and real spend-limited provider keys) and are documented in the phase's own validation artifacts as `blocking: false`, consistent with the Phase 1 precedent for deferred live-origin checks. They do not represent gaps in the delivered code — every behavior they cover already has automated coverage with all four providers mocked (unit, SSR, and Playwright under the production meta CSP).

### Gaps Summary

No gaps found. All four phase success criteria are backed by passing automated tests (unit, SSR, mutation, and E2E) that were independently re-run during this verification (144 + 788 + 296 targeted tests, all green) rather than merely trusted from SUMMARY claims. The `gsd-tools verify key-links` tool flagged 3 links as unverified across 16 plans; each was manually traced and confirmed to be a tool string-matching limitation (stale expected path from a Phase 3 file move, or a literal-substring search against a regex/constant), not an actual broken wire. The structural "no auto-send" proof (`mailto:`/`navigator.clipboard` isolated to `exits.ts`, ESLint boundary, TS import-graph walker with planted-failure tests) was independently re-verified against the live tree rather than taken from SUMMARY claims. The 10 items in `05-HUMAN-UAT.md` are correctly deferred, owner-gated, non-blocking checks requiring real infrastructure (deployed origin, real provider keys, legal review) that cannot be verified from this environment — hence `status: human_needed` rather than `passed`.

---

_Verified: 2026-10-05T22:12:35Z_
_Verifier: Claude (gsd-verifier)_
