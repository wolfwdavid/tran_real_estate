---
phase: 05-ai-layer-providers-streaming-fair-housing-guardrails
plan: 14
subsystem: ai-settings-ui
tags: [svelte5, settings, radio-group, checkbox, draft-history, key-card, test-connection, axe, tdd]
requires:
  - "05-11 aiPrefs (provider/sample/models), setup defaultPreferred + AiKeyTestResult, artifacts ArtifactRepo"
  - "05-05 models PROVIDER_ORDER/PROVIDER_LABELS/defaultModel/hostFor/validateModelId"
  - "05-06 ai-copy testResultCopy"
  - "Phase 3 ProviderKeyCard, ConfirmDialog, badge/radio-group/checkbox/input/label, announce(); Phase 4 RentCast branch of the card"
provides:
  - "$lib/ai/ui/AiProviderPicker.svelte ({ keyState, selected (bindable), onChange? }) + providerAnnouncement()"
  - "$lib/ai/ui/SampleOutputToggle.svelte ({ checked (bindable), providerLabel }) + sampleAnnouncement()"
  - "$lib/ai/ui/AiModelField.svelte ({ provider, value, onSave(model|null) }) + modelFieldError(), modelSavedAnnouncement()"
  - "$lib/ai/ui/TestConnectionResult.svelte ({ provider, model, result, testing }) + codeParts()"
  - "$lib/ai/ui/ArtifactStatusBadge.svelte ({ status })"
  - "$lib/ai/ui/DraftHistory.svelte ({ feature, repo, headingLevel, onOpen, refreshKey?, initial? }) + formatWhen(), preview(), sourceLine(), flagsLine(), PAGE_SIZE"
  - "ProviderKeyCard: AI cards render the Model field and read 'Test connection' with the five-outcome result line"
affects: [05-15 (mounts the AI drafting section, registerAiTestKeys, DraftHistory under the demo panel), 05-16 (E2E/axe gate)]
tech-stack:
  added: []
  patterns:
    - "Pure copy helpers exported from each component's <script module>, so SSR tests assert exact UI-SPEC strings without a DOM"
    - "Function bindings (bind:value={() => current, choose}) so a derived default can show as checked without writing a preference"
    - "Writable $derived for an editable field that follows its saved prop"
key-files:
  created:
    - apps/web/src/lib/ai/ui/ArtifactStatusBadge.svelte
    - apps/web/src/lib/ai/ui/DraftHistory.svelte
    - apps/web/src/lib/ai/ui/draft-history.test.ts
    - apps/web/src/lib/ai/ui/AiProviderPicker.svelte
    - apps/web/src/lib/ai/ui/SampleOutputToggle.svelte
    - apps/web/src/lib/ai/ui/settings-controls.test.ts
    - apps/web/src/lib/ai/ui/AiModelField.svelte
    - apps/web/src/lib/ai/ui/TestConnectionResult.svelte
    - apps/web/src/lib/ai/ui/key-card-additions.test.ts
    - apps/web/src/lib/ai/ui/settings-ai.browser.test.ts
  modified:
    - apps/web/src/lib/features/shared/settings/ProviderKeyCard.svelte
key-decisions:
  - "The real card is apps/web/src/lib/features/shared/settings/ProviderKeyCard.svelte (not lib/components/settings); it already had id=\"key-{provider.id}\" for every provider, so no id change was needed and the #api-keys anchors are untouched"
  - "AI detection in the card is PROVIDER_ORDER membership; RentCast and any non-AI card render exactly as before (Test key label, KeyTestResult, pointer line)"
  - "The card shows TestConnectionResult only when the tester returns the additive AiKeyTestResult.ai field (05-11 registerAiTestKeys); otherwise the Phase 3 testLine path still runs, so AI cards stay safe before 05-15 registers testers"
  - "The tested model is captured from aiPrefs.effectiveModel at click time, matching what registerAiTestKeys probes when 05-15 passes the same reader"
  - "The Model field is shown on every AI card once the Settings context is ready (it is a per-device pref, not key material); Test connection stays in the Phase 3 slot, shown only with a saved key and a registered tester"
  - "Typing the default model back in saves as Use default (onSave(null)), so no redundant override is stored"
  - "The picker shows defaultPreferred as checked without writing aiPrefs.provider; only a user choice persists and announces"
  - "DraftHistory helpers live in its <script module> (formatWhen normalises ICU's narrow no-break space so copy reads 'Today at 3:42 PM')"
  - "DraftHistory adds one non-spec line for a failed IndexedDB read (\"Couldn't read Draft history in this browser. Reload the page to try again.\") and one failed-delete announcement"
requirements-advanced: [AI-01, AI-04]
metrics:
  duration: "~17 min"
  completed: 2026-10-05
---

# Phase 5 Plan 14: Settings AI controls and Draft history Summary

Settings-side AI controls are ready to mount: a "Draft with" radio group, the sample output toggle, a validated per-provider Model field, and a "Test connection" result line that distinguishes all five outcomes on the existing AI key cards. Draft history lists stored drafts with status badges, and lets the user open, mark as not sent and delete them. Every string matches 05-UI-SPEC.

## What was built

- **ArtifactStatusBadge**: Draft (`FilePen`, neutral), Reviewed (`CircleCheck`, positive), Marked as sent (`MailCheck`, positive). Icons are aria-hidden and the text alone carries the state.
- **DraftHistory**: shows the title (h3 or h4, `tabindex="-1"`), the "{n} saved in this browser" count and the legend. Rows run newest first and show badge · timestamp · "{Provider} · {model}" or "Sample output", a 120-character preview, and "{n} Fair Housing flags when generated". Actions are Open, Mark as not sent (sent rows only) and Delete (Phase 3 `ConfirmDialog` with the verbatim copy). Rows load ten at a time with **Show older drafts**. The list loads in the browser through `repo.listByFeature`/`countByFeature` and reloads when `refreshKey` changes; prerender shows "Checking this browser…". A confirmed delete focuses the title and announces "Draft deleted."; Mark as not sent announces and moves focus to the row's Open button.
- **AiProviderPicker**: a fieldset with the legend "Draft with" and four 44px label rows. Each row describes its key state: saved shows the model in `<code>`, plus the none and locked variants. With no AI keys the no-key status line appears with an **Add an AI key** link to `#api-keys`. A choice writes `aiPrefs.provider`, announces "{Provider} will write your drafts." and calls `onChange`. Keyless providers can still be chosen.
- **SampleOutputToggle**: a checkbox row that writes `aiPrefs.sample` and announces on and off. Turning it off names the provider when one is known.
- **AiModelField**: a 48px input (`autocomplete="off"`, `spellcheck="false"`, `autocapitalize="off"`, tabular-nums) with the helper "Default: `{model}`. …". It saves on blur or Enter when the value is valid and has changed. **Use default** appears only when the value differs from the default and keeps focus on the field. Invalid input uses the Phase 3 pattern: `aria-invalid`, a CircleAlert error, and the error linked through `aria-describedby`.
- **TestConnectionResult**: renders `testResultCopy` lines with the UI-SPEC icons. The model ID and host appear in `<code>`, the CORS line links to `#key-openrouter`, and testing shows "Testing…". It renders only fixed copy, the model and the host.
- **ProviderKeyCard** (additive): AI cards label the Phase 3 tester button **Test connection**, render `TestConnectionResult` from `AiKeyTestResult.ai` and announce the same line. They also show `AiModelField`, bound to `aiPrefs.effectiveModel`/`setModel`. The AI result clears on every path that cleared `testLine` (save, replace, remove, new test).

## Tasks and commits

| Task | Commits |
| ---- | ------- |
| 1. ArtifactStatusBadge + DraftHistory | 66f725a (RED), e7ab8c6 (GREEN) |
| 2. AiProviderPicker + SampleOutputToggle | f2b2dc2 (RED), bef5863 (GREEN) |
| 3. Model field + Test connection in AI key cards | 1f20c0f (RED), a45e23b (GREEN) |
| Browser axe/focus coverage + fix | ba9119f, 0fcc328 |

## Verification

- `vitest run --project web`: 63 files / 996 tests passed. That run came after Task 3 and included 05-13's files present at the time.
- New SSR tests: draft-history 16, settings-controls 10, key-card-additions 15. Browser `settings-ai.browser.test.ts` passed 14/14 on two consecutive runs. It covers axe on the picker (no keys; saved + locked), the toggle, the model-field error, all six Test connection lines, Draft history with all three statuses, and the open delete confirmation. It also checks focus after Use default, the delete focus moving to the title, and Show older drafts paging.
- `svelte-check` reported 0 errors and 0 warnings for this plan's files. `pnpm lint` (prettier + eslint), `pnpm banned` and `pnpm ui:guard` all passed.
- E2E was not run here because the card change needs a build. The orchestrator's post-wave run covers `settings-keys`/`settings-data`/`settings-a11y`. Expected impact: the AI cards gain one labelled "Model" input. No Test key/Test connection button appears until 05-15 registers AI testers, so "no Test key button without a registered tester" stays true.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `bind:ref` into an empty record crashed DraftHistory in the browser**
- **Found during:** the browser test pass after Task 3
- **Issue:** `bind:ref={openRefs[a.id]}` binds `undefined`, and Button's `ref` has a fallback, so Svelte throws `props_invalid_value` and no rows render. The SSR tests could not catch this.
- **Fix:** the Open button gets an id. After Mark as not sent, `tick()` runs and that id is focused.
- **Files modified:** apps/web/src/lib/ai/ui/DraftHistory.svelte
- **Commit:** ba9119f

**2. [Rule 3 - Path] The ProviderKeyCard path differs from the plan**
- The plan expected `apps/web/src/lib/components/settings/ProviderKeyCard.svelte`. The real file is `apps/web/src/lib/features/shared/settings/ProviderKeyCard.svelte`, and that is the file edited. The card source assertions in `key-card-additions.test.ts` read it at that path. The card already rendered `id="key-{provider.id}"` for every provider.

**3. [Rule 2 - Coverage] Added `settings-ai.browser.test.ts`**
- The plan listed SSR tests only. The orchestrator asked for browser and axe coverage where focus or axe matter, so this file was added beyond the plan. It caught deviation 1.

**4. [Rule 1 - Lint] svelte/prefer-writable-derived**: AiModelField's draft uses a writable `$derived(value)` instead of `$state` + `$effect.pre`.

## Known Stubs

None. Every component is wired to real data sources (aiPrefs, ArtifactRepo, testResultCopy). Mounting is not part of this plan: 05-15 places the components in the Settings "AI drafting" section and calls `registerAiTestKeys`. Until then the AI cards show the Model field, but no Test connection button appears because no tester is registered.

## Requirements advanced

AI-01 (provider choice, model override, Test connection with CORS/auth/quota/network distinguished) and AI-04 (Draft history and Mark as not sent copy: "Tran doesn't send or track email"). Neither is marked complete; both stay open until the 05-16 gate.

## Notes for 05-15

- Pass `keyState={keyStateFrom(vault)}` and `bind:selected` to aiPrefs.provider (or leave `selected` null to show the default). The picker writes aiPrefs itself.
- `SampleOutputToggle bind:checked={aiPrefs.sample}`. Pass `providerLabel` as the label of the selected or default provider.
- `registerAiTestKeys(registerKeyTester, { model: (id) => aiPrefs.effectiveModel(id) })` keeps the probed model and the card's result line in agreement.
- `DraftHistory feature="demo" repo={createArtifactRepo()} headingLevel={4} onOpen={...} refreshKey={n}`. Bump `refreshKey` after the panel saves. Open must move focus to the panel output box (UI-SPEC focus table).

## Self-Check: PASSED
