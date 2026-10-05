---
phase: 05-ai-layer-providers-streaming-fair-housing-guardrails
plan: 16
subsystem: ai-verification-gate
tags: [e2e, playwright, axe, wcag22, fair-housing, gemini-consent, clipboard, human-uat, validation, phase-gate]
requires:
  - "05-15 AiDraftingSection, ai-mocks helpers, ai-drafting.spec"
  - "05-13 GenerationPanel / PanelState; 05-14 DraftHistory, picker, sample toggle"
  - "Phase 3 settings-a11y axe precedent and lock flow"
provides:
  - "tests/e2e/ai-guardrails.spec.ts: Fair Housing exit gating, Gemini consent + session-only ack, Draft history statuses, sample toggle override"
  - "tests/e2e/ai-a11y.spec.ts: axe (WCAG 2.2 A/AA) over every UI-SPEC Phase 5 Settings state on both bases, plus 375px popover/dialog checks"
  - "ai-mocks: error-status and raw-SSE generation answers, aborted canary / key check, Anthropic stop reason"
  - "Reactive key tester registry (SvelteMap)"
  - "'stopped-empty' run status"
  - "defaultPreferred falls back to a locked key"
  - "05-HUMAN-UAT.md (H1-H10), green 05-VALIDATION.md, AI-01..04 complete"
affects: [Phases 6-9 (generator panels reuse the guarded panel and the ai-mocks helpers), Phase 10 (deploy + HUMAN-UAT run)]
tech-stack:
  added: []
  patterns:
    - "Gated aria-disabled controls are exercised with focus + Enter, since Playwright treats aria-disabled as not enabled for click()"
    - "Clipboard assertions normalize CRLF (the Windows clipboard returns CRLF)"
    - "Offline network errors are simulated by overriding Navigator.prototype.onLine, not context.setOffline, so the page's lazy JS chunks still load"
key-files:
  created:
    - apps/web/tests/e2e/ai-guardrails.spec.ts
    - apps/web/tests/e2e/ai-a11y.spec.ts
    - apps/web/src/lib/storage/secrets/testers.svelte.browser.test.ts
    - .planning/phases/05-ai-layer-providers-streaming-fair-housing-guardrails/05-HUMAN-UAT.md
    - .planning/phases/05-ai-layer-providers-streaming-fair-housing-guardrails/deferred-items.md
  modified:
    - apps/web/tests/e2e/helpers/ai-mocks.ts
    - apps/web/tests/e2e/settings-keys.spec.ts
    - apps/web/src/lib/storage/secrets/testers.ts
    - apps/web/src/lib/ai/ui/ai-copy.ts
    - apps/web/src/lib/ai/ui/panel-state.svelte.ts
    - apps/web/src/lib/ai/setup.ts
    - .planning/phases/05-ai-layer-providers-streaming-fair-housing-guardrails/05-UI-SPEC.md
    - .planning/phases/05-ai-layer-providers-streaming-fair-housing-guardrails/05-VALIDATION.md
    - .planning/REQUIREMENTS.md
key-decisions:
  - "The key tester registry is a SvelteMap. AI testers register asynchronously, so a remembered-key card that renders first now updates when its tester arrives (it never did with a plain Map)."
  - "Stop before the first word gets its own status ('Stopped before any text arrived. Nothing was saved, so you can generate again.'). The old line claimed a partial draft was kept when there was none. Added as a UI-SPEC copy row."
  - "With no stored preference, defaultPreferred falls back from the first saved key to the first locked key. Only-locked users saw the false 'No AI key yet' sample notice. Now a run shows 'Your keys are locked' + Unlock in Settings."
  - "The Phase 3 test 'no Test key button without a registered tester' is rescoped to 'AI key cards offer Test connection, never Test key, including after a reload'. It now asserts the button is present instead of passing by accident."
  - "The GenerationError 'locked' state is covered in E2E (remember + passphrase lock, then a new tab), not skipped."
  - "tailwind-merge font-size debt is carried to Phase 6 (deferred-items.md), not fixed at the gate."
requirements-completed: [AI-01, AI-02, AI-03, AI-04]
metrics:
  duration: "~28 min"
  completed: 2026-10-05
  tasks: 3
  files: 14
---

# Phase 5 Plan 16: Phase 5 gate (guardrail E2E, axe matrix, HUMAN-UAT) Summary

The Phase 5 guardrails are proven in a real browser on both base paths. A Must fix phrase locks Copy / Open in email app / Mark as sent until it is fixed and the rest acknowledged. Gemini asks before client details leave, and the "don't ask again" choice lives only in sessionStorage. Only the user's own clicks move a draft out. axe reports zero WCAG 2.2 A/AA violations in all 24 Phase 5 Settings states. `corepack pnpm verify` is green, and AI-01..04 are complete. Three real bugs surfaced at the gate. Each was fixed at its root with a RED-first test.

## Tasks and commits

| # | Name | Commit |
|---|------|--------|
| pre | Reactive key tester registry (carried item c) | 748d4e9 |
| pre | Honest status for Stop before any text (carried item b) | 826a61d |
| 1 | Guardrail E2E + Test key test rescoped (carried item a) | bf4e042 |
| 2a | Locked-key default (bug found by the axe locked state) | d9aa087 |
| 2 | axe across Phase 5 Settings states | 52b07b1 |
| 3 | HUMAN-UAT, VALIDATION, REQUIREMENTS, deferred items | e8f9069 |

## What was built

- **ai-guardrails.spec.ts** (4 tests × root/sub):
  1. Mocked Anthropic "Perfect for young professionals. It is walking distance to church." The panel shows "Fair Housing check: 1 to fix, 1 to review". The exits group has exactly 3 controls, all `aria-disabled="true"`, the email link has no `href`, and the block reason line shows. A gated Copy (focus + Enter) leaves a `sentinel` clipboard untouched and announces the reason. In the popover, focus lands on Use alternative, Must fix / Category: Familial status / Suggested wording: are shown, and Escape returns focus to the trigger. Use alternative gives "Close to transit and downtown." Then the acknowledgement checkbox appears with the warn reason, and checking it enables the exits. Copy puts exactly the fixed text on the clipboard. The `mailto:` href carries the encoded draft and `%0D%0A`. Clicking it shows the "Opened in your email app…" status (navigation cancelled in-page). Mark as sent becomes "Marked as sent" with `aria-pressed`, and the history row follows. Generation count stays 1.
  2. Gemini: focus starts on "Don't send to Gemini". Escape gives "Canceled. Nothing was sent to Google." with focus back on Generate, and 0 requests. Don't send gives 0 requests. Checking "Don't ask again until I close this tab" and choosing Send gives exactly 1 `streamGenerateContent`, with the key only in `x-goog-api-key`. Storage reads `['1', []]` (sessionStorage only, no `gemini` key in localStorage). Generate again shows no dialog. A fresh browser context asks again.
  3. Draft history shows Draft / Marked as sent / Reviewed. Mark as not sent turns the badge to Reviewed, announces, and moves focus to the row's Open. Delete: the dialog "Delete this draft?" opens with Keep draft focused, Escape keeps the row, and Delete draft removes it, focuses the "Draft history" heading and announces "Draft deleted.".
  4. With an Anthropic key saved, the sample toggle shows "Sample output", and generating sends 0 requests to api.anthropic.com.
- **ai-a11y.spec.ts** (24 tests × root/sub): no keys · six Test connection outcomes (ok listed, ok not listed, cors-blocked, auth, quota, network) · streaming (`aria-busy`) · stopped with partial text · planted block+warn with the popover open · acknowledgement visible · edit mode · seven GenerationErrors (cors-blocked, auth, quota, network, model-not-found, refused, **locked**) · Gemini dialog · Draft history with all statuses · delete confirm open. At 375px the popover and the Gemini dialog give `scrollWidth <= 375`, with their boxes inside the viewport, and are axe clean.
- **ai-mocks.ts** (additive): `stream` also accepts `{ status, body }` (CORS-readable JSON error) and `{ rawSse }`. `modelsStatus` / `canaryStatus` accept `'abort'`. `anthropicSse(text, n, stopReason)`.
- **05-HUMAN-UAT.md**: H1-H10 with exact steps, expected lines, "If different" file pointers, the verified header-name table, and a launch-day keyless curl re-probe.
- **05-VALIDATION.md**: frontmatter `status: green`, `wave_0_complete: true`, `nyquist_compliant: true`. Every row is ✅ green, Wave 0 is ticked, and it now has a Gate results section and a mutation-proof ledger.

## Verification

- `corepack pnpm verify`: **exit 0, twice.** The first run took 296 s after Tasks 1-2. The final run took **318 s**, on restored source after the mutation runs and the doc edits. Results: 125 unit files / **2,541 tests**, CSP 14 pages per base, **566 E2E passed**, 2 skipped (the pre-existing Phase 3 `settings-backup` fixme), 0 failed. The real-data guard, fixtures check, gitleaks canary + scan (470 commits) and actionlint all pass.
- `playwright test ai-guardrails ai-drafting settings-keys --repeat-each=2`: 92/92. `ai-a11y ai-guardrails ai-drafting settings`: 210/210.
- RED first: the reactivity browser test failed with `[false]` against the Map; the stopped-empty copy + panel tests failed (2); the locked-default unit test failed (1).

## Mutation proofs (none committed; sources restored, `git status` clean)

| Mutation | Observed red |
|----------|--------------|
| `needsGeminiWarning` returns false | ai-guardrails Gemini test: `expect(dialog).toBeVisible()`, element not found |
| `PanelState.copy` skips `#gated('copy')` | ai-guardrails Fair Housing test: clipboard was no longer `sentinel` |
| Tester registry as a plain `Map` (pre-fix) | testers.svelte.browser.test: expected `[false, true]`, got `[false]` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Remembered-key cards could miss Test connection**
- **Found during:** Pre-task (executor note c, confirmed by reading the code)
- **Issue:** `hasKeyTester` read a plain `Map`, so `{#if hasKeyTester(id)}` never re-ran when the AI testers registered after the card rendered.
- **Fix:** `SvelteMap` registry. Proven by a runes browser test (RED → GREEN) and by an E2E remembered-key reload.
- **Files:** `apps/web/src/lib/storage/secrets/testers.ts`, `testers.svelte.browser.test.ts`
- **Commit:** 748d4e9

**2. [Rule 1 - Bug] "The partial draft is kept" over an empty draft**
- **Found during:** Pre-task (executor note b)
- **Fix:** new `stopped-empty` status used when `text === ''`. Unit tests for the copy and the panel cover it (no announcement of "Partial draft kept", no row saved). UI-SPEC copy row added.
- **Files:** `ai-copy.ts`, `panel-state.svelte.ts`, their tests, `05-UI-SPEC.md`
- **Commit:** 826a61d

**3. [Rule 1 - Bug] Only-locked keys showed the false "No AI key yet" notice**
- **Found during:** Task 2, locked GenerationError state
- **Issue:** `defaultPreferred` ignored locked keys. With no stored preference, the panel silently used sample output, said there was no AI key, and never offered unlock.
- **Fix:** fall back to the first locked provider (saved, then locked, then none). Unit test RED → GREEN.
- **Files:** `apps/web/src/lib/ai/setup.ts`, `setup.test.ts`
- **Commit:** d9aa087

**4. [Rule 3 - Test infrastructure] ai-mocks error answers**
- Error states needed CORS-readable error statuses, raw SSE (refusal) and aborted canaries / key checks. These are additive options, and the existing specs are unchanged.
- **Commit:** 52b07b1

**5. [Rule 1 - Test honesty] Rescoped the accidental Phase 3 test** (executor note a). See key-decisions.
- **Commit:** bf4e042

### Test-technique notes
- Playwright's `click()` refuses `aria-disabled` elements. Gated exits are exercised with focus + Enter, which is the keyboard path the contract keeps focusable.
- The Windows clipboard reads back CRLF, so clipboard text is normalized before comparing (the app copies LF).
- "network" GenerationError: `Navigator.prototype.onLine` is overridden to false. `context.setOffline` would also block the lazy JS chunks the panel imports.

## Carried / deferred

- tailwind-merge `text-label`/`text-body` collision: carried to Phase 6 in `deferred-items.md` (fix via `extendTailwindMerge`). Not fixed here.
- Testing lesson from 05-14: ref binding and focus need a browser test or an E2E step. SSR render-only tests are not enough. Recorded in `deferred-items.md`.
- Orchestrator fix 01b3375 (`settings-keys` `code.first()`) recorded.
- Real-provider CORS (especially OpenAI `/v1/responses`), real keys, extras acceptance, OpenRouter routing, model re-check and lexicon legal review are owner-gated in `05-HUMAN-UAT.md` (`blocking: false`).

## Known Stubs

None. Both specs drive the real built site, and the HUMAN-UAT rows are deferred evidence, not stubs.

## Self-Check: PASSED
