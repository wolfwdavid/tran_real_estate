---
phase: 05-ai-layer-providers-streaming-fair-housing-guardrails
plan: 13
subsystem: ai-generation-panel
tags: [ai, generation-panel, streaming, fair-housing, gemini-gate, exits, ssr-tests, browser-tests, a11y]
requires:
  - "$lib/ai/runner (runGeneration)"
  - "$lib/ai/ui/panel-controller (runChecks, computeGate, nextAck, findingsSentence, usageLine, displayText, exitPayload)"
  - "$lib/ai/ui/ai-copy (errorCopy, statusCopy, sampleNotice)"
  - "$lib/ai/exits (copyText, buildMailto, markSent)"
  - "$lib/ai/gemini-gate (needsGeminiWarning, readGeminiAck, writeGeminiAck)"
  - "$lib/ai/setup (Selection, selectProvider, resolveProvider, keyStateFrom), $lib/ai/prefs.svelte (aiPrefs)"
  - "$lib/ai/storage/artifacts (ArtifactRepo, createArtifactRepo)"
  - "05-12 FairHousingText / FindingsSummary, reconciled textarea"
  - "Phase 3 announce(), alert, alert-dialog, button, checkbox, label; $lib/storage/secrets getVault()"
provides:
  - "ai/ui/panel-state.svelte.ts: PanelState controller ($state/$derived class) + PanelDeps/PanelInitial/Resolved/ExitEventPayload types"
  - "ai/ui/GenerationPanel.svelte: the shared generation panel (props per cross-phase contract)"
  - "ai/ui/GenerationError.svelte, ai/ui/GeminiDataDialog.svelte, ai/ui/ProviderChip.svelte"
affects: [05-14, 05-15, 05-16, Phase 6, Phase 7, Phase 8, Phase 9]
tech-stack:
  added: []
  patterns:
    - "View-over-controller: GenerationPanel only renders PanelState fields and calls its methods; all rules are node-tested"
    - "Own PanelState deps are getter objects over props, so prop changes stay reactive without re-creating the state"
    - "Dialog copy lives in script constants so prettier never wraps the acceptance strings"
    - "GeminiDataDialog `inline` seam disables the bits-ui portal so SSR can render the open dialog"
key-files:
  created:
    - apps/web/src/lib/ai/ui/panel-state.svelte.ts
    - apps/web/src/lib/ai/ui/panel-state.test.ts
    - apps/web/src/lib/ai/ui/GenerationError.svelte
    - apps/web/src/lib/ai/ui/GeminiDataDialog.svelte
    - apps/web/src/lib/ai/ui/ProviderChip.svelte
    - apps/web/src/lib/ai/ui/panel-parts.test.ts
    - apps/web/src/lib/ai/ui/GenerationPanel.svelte
    - apps/web/src/lib/ai/ui/GenerationPanel.test.ts
    - apps/web/src/lib/ai/ui/GenerationPanel.browser.test.ts
  modified: []
decisions:
  - "onExit payload.text is the exit payload (draft + emailFooter), i.e. exactly what left the app; href is added for 'email'"
  - "Artifacts store the token-restored display text (what the user sees and exports); the provider only ever received the redacted BuiltPrompt"
  - "ProviderChip mirrors Phase 4 ProvenanceChip's sample visual instead of wrapping it: ProvenanceChip takes a data Provenance and a fixed 'Sample data' label"
  - "When the `state` prop is passed it is authoritative (its deps carry postChecks/tokens/emailFooter/exitDisabled); otherwise the panel builds its own PanelState synchronously (SSR-safe) and only loads the artifact repo and provider preview in onMount"
  - "apply() of an empty alternative announces 'Removed the phrase. {n} flags left.'; singular '1 flag left.' (UI-SPEC only defines the Replaced form)"
metrics:
  duration: "~45 min"
  completed: "2026-10-05"
  tasks: 3
  files: 9
---

# Phase 5 Plan 13: GenerationPanel Summary

The shared AI generation panel: a `PanelState` runes controller (streaming with Stop, sample fallback, the Gemini free-tier gate, Fair Housing + postCheck exit gating, local token restore, email footer, per-exit disables, onExit, debounced edit rechecks, Draft history open) and a thin `GenerationPanel` view with exactly three human-initiated exits, plus `GenerationError`, `GeminiDataDialog` and `ProviderChip`.

## What was built

**Task 1 — PanelState (`b70eae2`).** Class with `$state` fields (`phase`, `text`, `findings`, `warnAck`, `statusLine`, `error`, `usageText`, `artifactId`, `artifactStatus`, `editing`, `geminiDialogOpen`, `built`, `selection`, `model`, `sentAt`) and `$derived` `gate` (via `computeGate`; an empty ready text counts as empty) and `mailto` (`buildMailto` over `exitPayload`). `generate()` resolves the selection, returns the locked error without any provider call, builds the prompt, and opens the Gemini dialog (zero requests) when `needsGeminiWarning` holds; `confirmGemini(dontAsk)` writes the session ack only when asked and runs with `clientDataAck: true`; `cancelGemini()` announces "Canceled. Nothing was sent to Google." The run sets the connecting/sample copy and announcement, a one-shot "Still waiting" timer (`waitMs`), restores tokens into `text` on every update, then checks, sets the done/stopped/length/error copy and usage line, and persists one artifact. Exits re-check the gate first (gated → announce the reason only), call `copyText`/`buildMailto`/`markSent` from exits.ts, mark Draft → Reviewed, and call `onExit` once. 28 node tests.

**Task 2 — parts (`3f5e4f5`).** `GenerationError` = Phase 3 destructive alert visual with `role={null}`, model wrapped in `<code>`, action link `resolve('/settings/') + '#' + hash`. `GeminiDataDialog` = caller-owned alert-dialog, verbatim copy, unchecked session-only checkbox (reset on each open), "Choose another provider" → `#ai-drafting`, footer order Don't send (primary, initial focus, Escape) → Send (outline), overlay ignored. `ProviderChip` live "{Provider} · `<code>model</code>`" (surface/muted, Cpu) and sample "Sample output" (Phase 4 sample chip classes, FlaskConical). 8 SSR tests.

**Task 3 — GenerationPanel (`bfc3984`).** Regions 1-12 per UI-SPEC anatomy; one run button swapping Generate draft/Stop/Generate again (focus never moves); Edit draft/Done editing with textarea "Edit your draft"; output box `tabindex="-1"` `role="group"` `aria-label="Draft"` (not live) with a CSS steps(1) caret that is static under reduced motion; email footer preview outside the exits; findings summary (`bind:acknowledged={st.warnAck}`, apply → focus next trigger or findings title, Show in draft → scroll + focus); long-mailto note; exits group with exactly Copy text (button), Open in email app (`<a>`, href removed + `role="link"` `tabindex="0"` while gated), Mark as sent (ghost, `aria-pressed` + "Marked as sent"); distinct reason lines linked by each exit's `aria-describedby`; helper line; Gemini dialog outside all branches returning focus to the run button. 13 SSR tests + 2 browser tests (focus swap, gated exit → findings title, dialog default focus, Escape = zero requests, axe).

## Verification

- `vitest run --project web apps/web/src/lib/ai`: 24 files / 483 tests pass (includes no-auto-send: `mailto:` and `navigator.clipboard` still only in exits.ts; import graph clean).
- `vitest run --project web`: 64 files / 1009 tests pass.
- `vitest run --project web-browser GenerationPanel.browser.test.ts`: 2/2 pass.
- `svelte-check`: 0 errors, 0 warnings. `corepack pnpm lint` (prettier + eslint): clean. `ui:guard`, `banned`: pass.
- Acceptance greps: panel contains every required token; `grep -cE "\{@html|navigator\.clipboard|mailto:|window\.open|location\." GenerationPanel.svelte` = 0; panel-state has no `fetch(`, `localStorage` or `navigator.clipboard`.

## Phase 3/4 name mappings

- `LiveAnnouncer`/`announce()` → `$lib/components/a11y/announcer.svelte` `announce`.
- `SectionError` visual → `$lib/components/ui/alert` `Alert variant="destructive" role={null}` (same as Phase 3 SectionError).
- `alert-dialog` → `$lib/components/ui/alert-dialog` (pattern from `CapConfirmDialog`: `onOpenAutoFocus` → cancel ref, `onEscapeKeydown` preventDefault → cancel, `interactOutsideBehavior="ignore"`, `onCloseAutoFocus`).
- Vault → `getVault()` from `$lib/storage/secrets`; key state via `keyStateFrom(vault)`; model via `aiPrefs.effectiveModel`.
- `ProvenanceChip` exists (`features/shared/data/ProvenanceChip.svelte`) but is mirrored, not wrapped (see decisions).

## Deviations from Plan

### Auto-fixed / additive

1. **[Rule 3 - Blocking] bits-ui portal renders nothing in SSR.** Added an `inline` prop to `GeminiDataDialog` (passes `portalProps={{ disabled: true }}`) so `panel-parts.test.ts` renders the open dialog; default behavior unchanged (portalled). Chosen over a separate `GeminiDataDialogBody.svelte` because Title/Description need the dialog context.
2. **[Rule 2 - Missing functionality] Additive PanelState surface** needed by the view: `containsClientData?` and `openRouterKeySaved?` deps; `copy()` resolves `boolean` and `emailClicked()` returns `boolean` (view selects text on copy failure / cancels navigation when gated); `apply()` returns `{ nextFindingId }` for focus; `running`, `hasDraft`, `sample`, `providerLabel` getters. All compatible with the plan contract.
3. **[Rule 2] Added `GenerationPanel.browser.test.ts`** (not in the plan's file list) to prove focus behavior, the Gemini default and axe in a real browser. Component tests load no CSS, so the 44px `<summary>` renders at 20px and trips axe `target-size`; that one rule is filtered there with a comment (E2E axe covers sizing).
4. **Lint accommodations:** `svelte/prefer-svelte-reactivity` disabled on two immutable `new Date` lines; `no-useless-assignment` disabled around the three read-only bindable defaults; the email link's `svelte/no-navigation-without-resolve` disabled in a block with justification (the comment avoids the literal scheme string so the no-auto-send text ban stays exact).

## Requirements advanced (not marked complete; 05-16 gate owns that)

- AI-01 (streaming generation with Stop, sample fallback, usage), AI-02 (inline Fair Housing gating before any exit, postChecks), AI-03 (Gemini client-data dialog with Cancel default, session-only ack), AI-04 (exactly three human-initiated exits, SSR-counted).

## Known Stubs

None. The panel's own-state path is fully wired (vault + prefs + artifact repo); no consumer mounts it yet (Settings "Try a draft" and portal features are later plans).

## Self-Check: PASSED

- All 9 created files exist; commits b70eae2, 3f5e4f5, bfc3984 are in `git log`.
