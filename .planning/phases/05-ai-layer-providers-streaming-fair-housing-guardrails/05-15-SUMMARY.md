---
phase: 05-ai-layer-providers-streaming-fair-housing-guardrails
plan: 15
subsystem: ai-settings-integration
tags: [settings, svelte5, generation-panel, e2e, playwright, page-route, sse, cors, csp]
requires:
  - "05-14 AiProviderPicker, SampleOutputToggle, DraftHistory, AI ProviderKeyCard additions"
  - "05-13 GenerationPanel / PanelState"
  - "05-11 registerAiTestKeys, toAiKeyState, defaultPreferred, aiPrefs, createArtifactRepo"
  - "05-09 DEMO_INPUTS + fixture provider; 05-05/07/08 adapters, probes, disambiguation"
  - "Phase 3 Settings sections registry + settings context; Phase 4 RentCast usage (slot 2)"
provides:
  - "$lib/ai/ui/AiDraftingSection.svelte: Settings slot 3 (id=ai-drafting, data-ai-ready marker)"
  - "GenerationPanel: openArtifact(a) and refreshProvider() instance exports, read-only bindable savedId"
  - "tests/e2e/helpers/ai-mocks.ts: blockAiProviders, anthropicSse/openaiSse/geminiSse/openrouterSse, routeAnthropic/routeOpenAI/routeGemini/routeOpenRouter (request logs with kind), openAiSettings, saveKey, countRequests"
  - "tests/e2e/ai-drafting.spec.ts: spike + 6 core flows on both bases"
affects: [05-16 (axe states for the AI section, HUMAN-UAT), Phases 6-9 (ai-mocks helpers for portal generators)]
tech-stack:
  added: []
  patterns:
    - "Host-wide abort first (blockAiProviders), then a per-host route that classifies each request (generate / canary / models / key) and aborts anything unknown"
    - "Component instance exports (bind:this) for host-driven panel actions instead of lifting PanelState into the host"
key-files:
  created:
    - apps/web/src/lib/ai/ui/AiDraftingSection.svelte
    - apps/web/tests/e2e/helpers/ai-mocks.ts
    - apps/web/tests/e2e/ai-drafting.spec.ts
  modified:
    - apps/web/src/lib/ai/ui/GenerationPanel.svelte
    - apps/web/src/routes/(app)/settings/+page.svelte
    - apps/web/src/lib/features/shared/settings/sections.ts
    - apps/web/src/lib/features/shared/settings/sections.test.ts
    - apps/web/tests/e2e/settings-shell.spec.ts
key-decisions:
  - "The nav needed no edit: SettingsNav.svelte (real path lib/features/shared/settings/SettingsNav.svelte) renders availableSections(), so flipping ai-drafting to available adds the #ai-drafting link in slot 3"
  - "The picker's key state is derived from the Settings context's vaultStatus mirror (reactive), not keyStateFrom(vault) (a one-shot read)"
  - "registerAiTestKeys runs in the section's onMount through dynamic import (with the artifact repo), and unregisters on unmount; data-ai-ready marks when testers + repo are ready"
  - "Draft history Open goes through a GenerationPanel instance export (openArtifact: st.open + focus the output box) so the panel keeps building its own live PanelState"
  - "Draft history refreshes when the panel's savedId changes (save/open) and after every exit (status becomes Reviewed)"
  - "The panel's provider chip and What will be sent follow picker, sample toggle and vault changes via refreshProvider() (skipped while a run is active)"
requirements-advanced: [AI-01, AI-04]
metrics:
  duration: "~25 min"
  completed: 2026-10-05
  tasks: 2
  files: 8
---

# Phase 5 Plan 15: AI drafting in Settings + browser E2E Summary

Settings now has "AI drafting" as section 3: the provider picker, the sample output toggle, and "Try a draft" (the shared demo prompt in a GenerationPanel plus its Draft history). The four AI key cards get Test connection while Settings is mounted. A Playwright suite proves the whole path in a real browser with every provider mocked, under the meta CSP on both base paths: a mocked Anthropic stream, sample streaming with Stop, Test connection, and the OpenAI CORS-vs-bad-key disambiguation.

## Tasks and commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | AI drafting section in Settings (slot 3) and section nav | 430159f |
| 2a | E2E spike (RESEARCH Pitfall 8) | 8aae864 |
| 2b | E2E core flows | 82d2ee0 |

## What was built

- **AiDraftingSection.svelte**: `<section id="ai-drafting" aria-labelledby="ai-drafting-heading" class="scroll-mt-4">` with the h2 and intro (verbatim UI-SPEC). `AiProviderPicker` is bound to `aiPrefs.provider`, and `SampleOutputToggle` to `aiPrefs.sample`. Both show "Checking this browser…" until the Settings context is ready. A 1px border divider with 32px gap follows, then the h3 **Try a draft**, the paragraph, and `GenerationPanel` (`feature="demo"`, `promptId="shared/demo"`, `inputs={DEMO_INPUTS}`, title "Sample inquiry", h3). `DraftHistory` (h4) sits 32px below. `onMount` dynamically imports `setup`, `testers` and `artifacts`, registers the four testers, creates the repo, and sets `data-ai-ready`.
- **Settings page / registry**: `ai-drafting` is `available: true`, and `SECTION_COMPONENTS` maps it. Built HTML order: `rentcast-usage` at 16325, then `ai-drafting` at 17222, then `key-security` at 26659 (true). `csp-transition-toggle` is still present (it lives in StorageSection), and `#ai-drafting` is in the nav.
- **GenerationPanel (additive)**: `export async function openArtifact(a)` calls `st.open(a)`, ticks and focuses the output box (UI-SPEC focus table). `export function refreshProvider()` runs `st.preview()` when the panel is not running. The new `savedId` bindable is read-only, like `canExit`.
- **ai-mocks.ts**: `CORS = { 'access-control-allow-origin': '*' }` on every fulfill, `text/event-stream` SSE bodies per the plan's frame shapes, and `route.abort('failed')` for blocked generations and unknown paths. Each `route*` helper returns a live call log tagged with `kind`, so specs assert request counts.
- **ai-drafting.spec.ts** (both projects): the spike, then sample with Stop, sample to completion (clean Fair Housing check, three exits enabled, row in Draft history), Test connection, OpenAI CORS block with a good key, OpenAI with a bad key, and What will be sent. An `afterEach` checks every request URL for saved fake keys and for `/[?&]key=/`.

## Verification

- `corepack pnpm check`: 0 errors, 0 warnings. `corepack pnpm lint`: clean.
- `build:root` + `build:sub`; `node scripts/assert-csp.mjs apps/web/build`: passed for 14 pages.
- `vitest --project web` on settings + ai/ui: 209/209. `--project web-browser` on ai/ui: 21/21.
- `playwright test ai-drafting --repeat-each=3`: 42/42 (root + sub).
- `playwright test ai-drafting routing csp a11y settings` on both projects: 228/228. This run covers settings-a11y axe at 1280/375 with the new section, settings-shell, settings-keys and settings-data.
- `grep -rE "sk-(ant|proj)|AIza" apps/web/tests/e2e` finds nothing. `corepack pnpm secrets:canary` exits 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Path] The nav component path differs, and the nav needed no edit**
- The plan expected `apps/web/src/lib/components/settings/SettingsNav.svelte`. The real file is `apps/web/src/lib/features/shared/settings/SettingsNav.svelte`. It renders `availableSections()`, so flipping the registry entry adds the link with no source change. The registry is the nav source, and `sections.ts` holds `ai-drafting`.

**2. [Rule 3 - Blocking] Section-list tests updated for slot 3**
- `sections.test.ts` lists 7 available sections, and owners 3/4/5 are available. In `settings-shell.spec.ts`, SECTIONS includes AI drafting, and only `getting-started` stays reserved. The assertions are no weaker.

**3. [Rule 2 - Missing wiring] GenerationPanel instance exports + savedId**
- Draft history Open must load a draft into the panel and focus its output box, and the history must refresh after saves. The panel had no hook for either without lifting its PanelState into the host and duplicating its live resolve wiring. Added `openArtifact`, `refreshProvider` and the read-only `savedId` binding. All are additive, and the existing panel tests pass.

**4. [Rule 1 - Test bug] Stop test waited on the placeholder**
- The first run clicked Stop before any word streamed, because the empty output box's placeholder matched "has words". The test now waits for the placeholder to go and for "Hi,", then checks that the kept draft starts with "Hi," and lacks the final "·" line.

## Notes for 05-16

- The Phase 3 test `settings-keys.spec.ts` "no Test key button without a registered tester" still passes, because AI cards read "Test connection", not "Test key". Since 05-15 registers AI testers, that test now only covers the absence of a "Test key" label. 05-16 may want to rename it or scope it.
- UX observation, outside this plan's scope: pressing Stop before the first token shows "Stopped. The partial draft is kept…" over an empty draft, and the run button reads "Generate draft". Consider a dedicated "Stopped before any text arrived" line.
- The tester registration is async in the section's onMount. A card that is already saved and rendered before registration finishes shows no Test connection until it re-renders. E2E waits on `data-ai-ready` before saving keys. A reload with a remembered key could race in theory, so put it on the HUMAN-UAT list for the deployed origin.
- Deployed-origin checks for HUMAN-UAT: real-provider CORS (especially OpenAI `/v1/responses`) and real keys. These are owner-gated and all mocked here.

## Known Stubs

None. The section is fully wired: vault status, aiPrefs, the artifact repo, the live panel and the registered testers.

## Requirements advanced

AI-01 now works end to end in Settings: provider choice, a live mocked stream, the sample fallback, Stop, Test connection, and CORS-vs-auth reporting. AI-04 is covered by the three exits enabled after a clean check and by Draft history in Settings. Neither is marked complete, because the 05-16 gate owns that.

## Self-Check: PASSED
