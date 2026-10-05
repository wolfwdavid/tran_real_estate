---
phase: 5
slug: ai-layer-providers-streaming-fair-housing-guardrails
status: green
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-04
validated: 2026-10-05
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11 (projects `core`, `web`, `scripts`, plus `brand` from Phase 2; network globally blocked via `tooling/vitest/no-network.ts`); `svelte/server` `render()` for SSR structural tests (spike-verified in the `web` project); Playwright 1.63.0 + @axe-core/playwright 4.13.0 (projects `root`, `sub`; ports 4273-4275) |
| **Config file** | `vitest.config.ts` (root projects), `packages/core/vitest.config.ts`, `apps/web/vite.config.ts` (`test` block, env node), `scripts/vitest.config.ts`, `apps/web/playwright.config.ts` (all unchanged; no new framework) |
| **Quick run command** | `corepack pnpm exec vitest run --project core --project web` (~5-10 s) |
| **E2E run (needs builds)** | `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm --filter web exec playwright test ai-drafting ai-guardrails ai-a11y` |
| **Full suite command** | `corepack pnpm verify` (check, lint, Phase 2+ gates, unit, both builds, CSP assert, full E2E + axe, guard, secrets, actionlint) |
| **Estimated runtime** | quick ~10 s; full `corepack pnpm verify` measured at 296 s and 318 s (two runs) on the development machine at the 05-16 gate (2,541 unit tests + 566 E2E) |

---

## Sampling Rate

- **After every task commit:** `corepack pnpm exec vitest run --project core --project web` (+ `--project scripts` when `eslint.config.js` changes, + `--project brand` when contrast pairs change) plus the task's own `<automated>` command
- **After every plan wave:** `corepack pnpm check && corepack pnpm lint && corepack pnpm test:unit`; from wave 6 also `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm --filter web exec playwright test ai-drafting`
- **Before `/gsd:verify-work`:** `corepack pnpm verify` green in one invocation (plan 05-16)
- **Max feedback latency:** ~10 s for unit/SSR; E2E needs both builds (~60-90 s)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | AI-01 | unit (SSE spec cases + every-offset fuzz, ’ and 🏠) | `corepack pnpm exec vitest run --project core packages/core/src/ai/sse.test.ts` | ✅ | ✅ green |
| 5-01-02 | 01 | 1 | AI-01 | unit (error classifier table, no message echo) | `corepack pnpm exec vitest run --project core packages/core/src/ai/errors.test.ts` | ✅ | ✅ green |
| 5-01-03 | 01 | 1 | AI-01 | unit (date-effective cost, 2027-01-01 boundary) | `corepack pnpm exec vitest run --project core packages/core/src/ai/cost.test.ts` | ✅ | ✅ green |
| 5-02-01 | 02 | 1 | AI-02 | unit (p`` helper, Unicode boundaries, ReDoS guard) | `corepack pnpm exec vitest run --project core packages/core/src/fair-housing/pattern.test.ts` | ✅ | ✅ green |
| 5-02-02 | 02 | 1 | AI-02 | unit (offsets, allow-list, overlap merge, foreign-checker merge) | `corepack pnpm exec vitest run --project core packages/core/src/fair-housing/engine.test.ts` | ✅ | ✅ green |
| 5-02-03 | 02 | 1 | AI-02 | unit (applyAlternative capitalization + remove tidy) | `corepack pnpm exec vitest run --project core packages/core/src/fair-housing/apply.test.ts` | ✅ | ✅ green |
| 5-03-01 | 03 | 1 | AI-03, AI-04 | unit (redactPii; no false hits on prices/zips/years) | `corepack pnpm exec vitest run --project core packages/core/src/privacy/redact-pii.test.ts` | ✅ | ✅ green |
| 5-03-02 | 03 | 1 | AI-03, AI-04 | unit (restorePii round trip, literal $ values) | `corepack pnpm exec vitest run --project core packages/core/src/privacy/restore-pii.test.ts` | ✅ | ✅ green |
| 5-04-01 | 04 | 2 | AI-02 | unit (≥30 bad flagged / ≥30 neutral clean, 41 entries) | `corepack pnpm exec vitest run --project core packages/core/src/fair-housing/check.test.ts` | ✅ | ✅ green |
| 5-04-02 | 04 | 2 | AI-02 | mutation (leave-one-out per entry, planted familial-status + severity mutation) + ReDoS 50 ms budget | `corepack pnpm exec vitest run --project core packages/core/src/fair-housing/mutation.test.ts` | ✅ | ✅ green |
| 5-05-01 | 05 | 2 | AI-01 | unit (registry defaults, exact-ID extras, pricing valid today, hosts ⊆ CSP connect-src) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/models.test.ts` | ✅ | ✅ green |
| 5-05-02 | 05 | 2 | AI-01 | unit (free-function fetch / Illegal invocation, 1-byte UTF-8 split readSse, abort, safeJson) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/providers/http.test.ts` | ✅ | ✅ green |
| 5-05-03 | 05 | 2 | AI-01 | unit (Test connection 5 outcomes + model listed; canary never carries key; disambiguation probe) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/providers/test-connection.test.ts` | ✅ | ✅ green |
| 5-06-01 | 06 | 2 | AI-02, AI-04 | unit (gating incl. postChecks + per-exit disable, ack rules, copy, tokens/footer payloads, segments) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/ui/panel-controller.test.ts` | ✅ | ✅ green |
| 5-06-02 | 06 | 2 | AI-03, AI-04 | unit (buildMailto %0D%0A + encoding + 1,800 threshold; copyText; markSent; Gemini gate truth table + sessionStorage only) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/exits.test.ts apps/web/src/lib/ai/gemini-gate.test.ts` | ✅ | ✅ green |
| 5-06-03 | 06 | 2 | AI-01, AI-02 | unit (error / Test connection / status copy verbatim) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/ui/ai-copy.test.ts` | ✅ | ✅ green |
| 5-07-01 | 07 | 3 | AI-01 | unit fake-SSE (Anthropic: 4 headers on every request, exact-ID extras, thinking hidden, error event, truncation, Stop keeps partial) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/providers/anthropic.test.ts` | ✅ | ✅ green |
| 5-07-02 | 07 | 3 | AI-01 | unit fake-SSE (OpenAI: store:false, reasoning hidden, incomplete/refusal, bad-key TypeError → auth) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/providers/openai.test.ts` | ✅ | ✅ green |
| 5-08-01 | 08 | 3 | AI-01, AI-03 | unit fake-SSE (Gemini: no ?key=, consent-required before fetch, thoughts hidden, 400 API_KEY_INVALID → auth, paginated probe) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/providers/gemini.test.ts` | ✅ | ✅ green |
| 5-08-02 | 08 | 3 | AI-01 | unit fake-SSE (OpenRouter: data_collection deny, [DONE], error-in-200, cost, /key probe) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/providers/openrouter.test.ts` | ✅ | ✅ green |
| 5-09-01 | 09 | 3 | AI-02, AI-03 | unit (guardrail prepended, redaction before send, sha256 inputHash of redacted payload) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/prompts` | ✅ | ✅ green |
| 5-09-02 | 09 | 3 | AI-01 | unit (50 ms batching with injected clock, Stop → 'stopped' + partial text, usage merge, cost, refused/error mapping) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/runner.test.ts` | ✅ | ✅ green |
| 5-09-03 | 09 | 3 | AI-01, AI-02 | unit (fixture streams word by word, abort, every fixture output has zero findings) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/providers/fixture.test.ts` | ✅ | ✅ green |
| 5-10-01 | 10 | 4 | AI-04 | unit lintText (lib/ai incl. providers: leads import, sendBeacon, window.open, XHR/WebSocket/EventSource; mutation-checked) | `corepack pnpm exec vitest run --project scripts scripts/eslint-rules.test.ts` | ✅ | ✅ green |
| 5-10-02 | 10 | 4 | AI-04 | unit (TS-compiler import graph, planted non-vacuity, text bans, clipboard/mailto only in exits.ts) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/no-auto-send.test.ts` | ✅ | ✅ green |
| 5-11-01 | 11 | 4 | AI-04 | unit fake-indexeddb (artifact repo, paging, tombstones, backup 'AI drafts', no raw inputs) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/storage apps/web/src/lib/storage` | ✅ | ✅ green |
| 5-11-02 | 11 | 4 | AI-01 | unit (selectProvider live/sample/locked, defaultPreferred, 4 testKey hooks, model prefs) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/setup.test.ts` | ✅ | ✅ green |
| 5-12-01 | 12 | 3 | AI-02 | unit (brand contrast gate incl. Phase 5 pairs) + check/lint of copy-ins | `corepack pnpm exec vitest run --project brand && corepack pnpm check && corepack pnpm lint` | ✅ | ✅ green |
| 5-12-02 | 12 | 3 | AI-02 | SSR (marks + hidden prefixes, popover body rows, summary order, ack only with 0 block, no {@html}) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/ui/fair-housing-ui.test.ts` | ✅ | ✅ green |
| 5-13-01 | 13 | 5 | AI-01..04 | unit controller (stream/Stop/sample/locked, Gemini dialog zero requests + session ack, postChecks gating, tokens never sent, emailFooter, exitDisabled, onExit once per exit, history open re-check) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/ui/panel-state.test.ts` | ✅ | ✅ green |
| 5-13-02 | 13 | 5 | AI-01, AI-03 | SSR (GenerationError links, Gemini dialog copy + button order, ProviderChip) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/ui/panel-parts.test.ts` | ✅ | ✅ green |
| 5-13-03 | 13 | 5 | AI-04 | SSR (exactly three exits in order, one mailto, gated `<a>` without href, per-exit reason, footer preview, tokens display) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/ui/GenerationPanel.test.ts` | ✅ | ✅ green |
| 5-14-01 | 14 | 5 | AI-04 | SSR (Draft history rows/badges/actions, empty state, paging) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/ui/draft-history.test.ts` | ✅ | ✅ green |
| 5-14-02 | 14 | 5 | AI-01 | SSR (provider picker states, no-key status, sample toggle) | `corepack pnpm exec vitest run --project web apps/web/src/lib/ai/ui/settings-controls.test.ts` | ✅ | ✅ green |
| 5-14-03 | 14 | 5 | AI-01 | SSR (model field validation/default, Test connection result lines, key-{provider} ids) | `corepack pnpm exec vitest run --project web` | ✅ | ✅ green |
| 5-15-01 | 15 | 6 | AI-01 | build + CSP oracle + existing E2E (section order 3, nav link) | `corepack pnpm build:root && node scripts/assert-csp.mjs apps/web/build && corepack pnpm --filter web exec playwright test routing csp a11y --project=root` | ✅ | ✅ green |
| 5-15-02 | 15 | 6 | AI-01, AI-04 | E2E both bases (spike, sample stream + Stop, mocked live stream, Test connection, CORS vs auth, What will be sent, no key in URLs) | `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm --filter web exec playwright test ai-drafting` | ✅ | ✅ green |
| 5-16-01 | 16 | 7 | AI-02, AI-03, AI-04 | E2E (block+warn gate, popover focus, Use alternative, ack, clipboard, Gemini dialog request counter + sessionStorage only, Draft history, sample toggle) | `corepack pnpm --filter web exec playwright test ai-guardrails` | ✅ | ✅ green |
| 5-16-02 | 16 | 7 | AI-01..04 | E2E + axe (every UI-SPEC Phase 5 state, both bases, 375px) | `corepack pnpm --filter web exec playwright test ai-a11y` | ✅ | ✅ green |
| 5-16-03 | 16 | 7 | AI-01..04 | full gate | `corepack pnpm verify` | ✅ | ✅ green |

*Status legend: ✅ green · ❌ red · ⚠️ flaky (no row is left pending)*

---

## Wave 0 Requirements

Test files are created inside the task that needs them (TDD: RED first). No framework install is needed.

- [x] `packages/core/src/ai/{sse,errors,cost}.test.ts` (05-01)
- [x] `packages/core/src/fair-housing/{pattern,engine,apply}.test.ts` (05-02), `{check,mutation}.test.ts` (05-04)
- [x] `packages/core/src/privacy/{redact-pii,restore-pii}.test.ts` (05-03)
- [x] `apps/web/src/lib/ai/providers/fake-sse.ts` shared fake SSE / route fetch helper (05-05) before any adapter test
- [x] `apps/web/src/lib/ai/{models,runner}.test.ts`, `providers/{http,test-connection,anthropic,openai,gemini,openrouter,fixture}.test.ts`, `prompts/registry.test.ts` (05-05, 05-07, 05-08, 05-09)
- [x] `apps/web/src/lib/ai/ui/{panel-controller,ai-copy}.test.ts`, `apps/web/src/lib/ai/{exits,gemini-gate}.test.ts` (05-06)
- [x] `scripts/eslint-rules.test.ts` extended + `apps/web/src/lib/ai/no-auto-send.test.ts` (05-10)
- [x] `apps/web/src/lib/ai/storage/artifacts.test.ts`, `apps/web/src/lib/ai/setup.test.ts` (05-11; `fake-indexeddb` from Phase 3, else added)
- [x] SSR tests `fair-housing-ui`, `panel-state`, `panel-parts`, `GenerationPanel`, `draft-history`, `settings-controls`, `key-card-additions` (05-12..05-14)
- [x] `apps/web/tests/e2e/ai-drafting.spec.ts` with the **spike first** (mocked Anthropic SSE renders in `/settings/` under both bases; RESEARCH Pitfall 8) (05-15)
- [x] `apps/web/tests/e2e/{ai-guardrails,ai-a11y}.spec.ts` (05-16)

Cross-phase additions covered (coordinator requests from Phase 7 and Phase 8 research):
- `postChecks` block finding disables all three exits: 5-06-01 (pure), 5-13-01 (controller), 5-13-03 (SSR)
- Gating state exposed (`canExit`, `blocked`, `findings` bindable): 5-06-01 (`GateState.canExit/blocked`), 5-13-03 (props)
- `emailFooter` appended to the mailto body and copied text: 5-06-01, 5-13-01, 5-13-03
- Per-exit disable with a visible reason: 5-06-01, 5-13-01, 5-13-03
- `tokens` restored in copy + mailto body, absent from the prompt sent to the provider: 5-03-02 (restorePii), 5-06-01, 5-13-01
- `onExit(kind, payload)` fires once per exit with the right kind: 5-13-01
- Exactly-three-exits still passes with all additions: 5-13-03, 5-16-01

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-key Test connection, streaming, Stop and usage per provider from the deployed origin | AI-01 | Needs the owner-created origin `tranrealestate.github.io` and real spend-limited keys; CI never calls providers | `05-HUMAN-UAT.md` H1 |
| OpenAI bad key shows auth (not CORS) against the real API | AI-01 | Live CORS behavior of the provider edge | `05-HUMAN-UAT.md` H2 |
| Gemini key types (legacy unrestricted vs AI Studio auth key) | AI-01, AI-03 | Needs real Google keys | `05-HUMAN-UAT.md` H3 |
| Default-model extras accepted (Gemini thinkingLevel casing, Anthropic between_tools/effort, OpenAI reasoning effort) | AI-01 | Live API validation | `05-HUMAN-UAT.md` H4 |
| OpenRouter data_collection 'deny' routing | AI-01, AI-03 | Live routing | `05-HUMAN-UAT.md` H5 |
| No key in URLs/headers in DevTools; no off-CSP hosts | AI-01, AI-04 | Real browser on the real origin | `05-HUMAN-UAT.md` H6 |
| Launch-day CORS re-probe; model ID re-check; lexicon legal review | AI-01, AI-02 | Time-sensitive / professional review | `05-HUMAN-UAT.md` H7-H9 |
| Remembered key shows Test connection after reloads on the real origin | AI-01 | Registration timing on a real device (automated by the settings-keys reload test and the reactive-registry browser test) | `05-HUMAN-UAT.md` H10 |

---

## Gate results (05-16)

| Gate | Result |
|------|--------|
| `corepack pnpm verify` (check, lint, banned, ui:guard, unit, build:root, build:sub, csp:assert, E2E, guard, fixtures:check, secrets canary + scan, actionlint) | exit 0 |
| Unit (Vitest projects incl. `web-browser`) | 125 files, 2,541 tests passed |
| CSP oracle | 14 pages per base (`build`, `build-sub`) |
| Playwright, both bases | 566 passed, 2 skipped (the pre-existing Phase 3 `settings-backup` "older backup shows the migration line" fixme), 0 failed |
| `ai-guardrails` | 4 tests × 2 projects |
| `ai-a11y` | 24 tests × 2 projects (every UI-SPEC Phase 5 state, plus popover and Gemini dialog at 375px) |
| `ai-drafting` | 7 tests × 2 projects |

## Mutation proofs (recorded in SUMMARYs; never committed)

| Guard | Mutation | Observed red | Record |
|-------|----------|--------------|--------|
| Fair Housing engine (05-02) | ReDoS throw removed; allow-list off; overlap merge off; group severity = last; tie-break removed | 8 / 2 / 4 / 2 / 1 tests fail | 05-02-SUMMARY |
| Lexicon (05-04) | `|no section 8` appended to `soi.no-vouchers`; planted familial-status + severity mutations | load-bearing + exclusivity fail; planted cases caught by `flagsRow` | 05-04-SUMMARY |
| Gemini consent at the adapter (05-08) | consent guard weakened to `clientDataAck === undefined`; OpenRouter error-chunk handling off | each killed by a dedicated test | 05-08-SUMMARY |
| No auto-send (05-10) | lint rules / leads pattern / data-port boundary removed; runner imports `lib/leads`; `gemini-gate.ts` touches `navigator.clipboard` | 4 / 2 / 2 lint tests fail; import-graph and single-exit tests fail | 05-10-SUMMARY |
| Storage + selection (05-11) | AI backup tables dropped; schema v3 removed; sample toggle no longer wins; quota → failed | 10 / schema + artifact / 1 / 1 tests fail | 05-11-SUMMARY |
| Gemini dialog in the browser (05-16) | `needsGeminiWarning` returns false | `ai-guardrails` Gemini test: dialog not found | 05-16-SUMMARY |
| Copy gate in the browser (05-16) | `PanelState.copy` skips `#gated('copy')` | `ai-guardrails` Fair Housing test: clipboard no longer `sentinel` | 05-16-SUMMARY |
| Tester registry reactivity (05-16) | plain `Map` (the pre-fix code) | `testers.svelte.browser.test.ts`: `[false]` instead of `[false, true]` | 05-16-SUMMARY (RED commit run) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s for unit/SSR (E2E is per-wave)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** green (2026-10-05, plan 05-16). `corepack pnpm verify` exited 0 in one invocation (wall time in 05-16-SUMMARY). Live-origin behaviour is deferred evidence in `05-HUMAN-UAT.md` (owner-gated, `blocking: false`), not a gap (Phase 1 precedent).
