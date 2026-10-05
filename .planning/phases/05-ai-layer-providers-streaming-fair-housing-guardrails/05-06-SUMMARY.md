---
phase: 05-ai-layer-providers-streaming-fair-housing-guardrails
plan: 06
subsystem: ai-panel-logic
tags: [ai, fair-housing, gating, exits, mailto, clipboard, gemini, copy, tdd]
requires:
  - "@tran/core/fair-housing (checkFairHousing, mergeFindings)"
  - "@tran/core/privacy (restorePii)"
  - "@tran/core/ai (formatUsd, LlmUsage, LlmErrorKind, AiProviderId, LiveProviderId)"
provides:
  - "ui/panel-controller.ts: runChecks, computeGate, warnSignature, nextAck, findingsSentence, findingsTitle, blockReason, WARN_REASON, usageLine, displayText, exitPayload, segmentText"
  - "exits.ts: copyText, buildMailto, markSent, MAILTO_LONG_THRESHOLD (the only exit implementations)"
  - "gemini-gate.ts: needsGeminiWarning, readGeminiAck, writeGeminiAck, GEMINI_ACK_KEY"
  - "ui/ai-copy.ts: errorCopy, testResultCopy, statusCopy, sampleNotice, CopyLink"
affects: [05-10, 05-12, 05-13, Phase 7, Phase 8, Phase 9]
tech-stack:
  added: []
  patterns:
    - "Panel behavior is pure functions; Svelte components only bind state to them"
    - "Global gating (phase/block/warn) always wins over per-exit disables; disables never un-gate"
    - "Browser globals (navigator.clipboard, sessionStorage) resolved via parameter defaults at call time"
key-files:
  created:
    - apps/web/src/lib/ai/ui/panel-controller.ts
    - apps/web/src/lib/ai/ui/panel-controller.test.ts
    - apps/web/src/lib/ai/exits.ts
    - apps/web/src/lib/ai/exits.test.ts
    - apps/web/src/lib/ai/gemini-gate.ts
    - apps/web/src/lib/ai/gemini-gate.test.ts
    - apps/web/src/lib/ai/ui/ai-copy.ts
    - apps/web/src/lib/ai/ui/ai-copy.test.ts
  modified: []
decisions:
  - "usageLine returns '' for a done/error draft without usage; the 'didn't report usage' copy is only for stopped drafts (UI-SPEC defines no other case)"
  - "gemini-gate.ts header says 'persistent local storage' instead of the literal API name so the source-text assertion (no 'localStorage') holds"
  - "writeGeminiAck swallows storage errors (blocked/full storage just means the dialog asks again)"
metrics:
  duration: ~10min
  completed: 2026-10-05
  tasks: 3
  files: 8
---

# Phase 5 Plan 06: GenerationPanel decision logic Summary

The `GenerationPanel` logic is now pure, DOM-free and unit-tested. It covers exit gating across Fair Housing findings, consumer `postChecks` and per-exit disables, plus the warn acknowledgement keyed to the set of warn phrases, the findings and usage copy, and exit payloads (`tokens` restore and `emailFooter`). It also includes the three exits (`copyText` on the Clipboard API only, `buildMailto` with CRLF encoding and no extra params, `markSent` as a local note), a session-only Gemini client-data gate, and one module holding every AI error, Test connection and run-state string from 05-UI-SPEC.

## Tasks

| # | Task | RED | GREEN |
|---|------|-----|-------|
| 1 | Panel controller (gating, ack, copy, payloads, segments) | 312692b | 2745ed1 |
| 2 | Exits + Gemini client-data gate | 55f844b | 87374a5 |
| 3 | AI copy module | 2fba24d | 99bf355 |


## Cross-phase contract honoured

- `postChecks: PostCheck[]` go through `runChecks`, are merged with Fair Housing findings, and gate all three exits the same way a Fair Housing block does. A throwing postCheck is not swallowed.
- `exitDisabled` sets a visible reason on one exit. `canExit` ignores it, and it never overrides the block or warn reason.
- `tokens` → `displayText` (restorePii). `emailFooter {text,label}` → `exitPayload`.
- No `footer`/`footerLabel`/`gate`/`onstatechange` concepts were introduced.

## Requirements advanced

AI-02 (gating), AI-03 (Gemini consent) and AI-04 (human-in-the-loop exits) all advanced. Per the orchestrator decision, none are marked complete until the 05-16 phase gate.

## Verification

- `corepack pnpm exec vitest run --project web apps/web/src/lib/ai`: 6 files, 160 tests pass (this includes 05-05's provider tests)
- `corepack pnpm --filter ./apps/web check`: 0 errors / 0 warnings
- `corepack pnpm lint`: clean
- `corepack pnpm banned`: passed (79 files)
- `grep -c localStorage apps/web/src/lib/ai/gemini-gate.ts` → 0. `exits.ts` contains no `location.` or `window.open`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's header comment for gemini-gate.ts contradicted its own acceptance check**
- **Issue:** The planned comment says "never localStorage", but both the test and the acceptance criterion assert that the source never contains `localStorage`.
- **Fix:** The comment now says "never persistent local storage".
- **Commit:** 87374a5

**2. [Rule 1 - Bug] usageLine misreported finished drafts without usage**
- **Issue:** With the planned fallthrough, a done draft whose provider reported no usage would read "...didn't report usage for this stopped draft."
- **Fix:** That copy now applies only when `status === 'stopped'`. Other statuses return `''` so the line is omitted. A test covers it.
- **Commit:** 2745ed1

**3. [Rule 2 - Robustness] Storage access hardening**
- `sessionStorage` access itself can throw when storage is blocked, so it is wrapped. `writeGeminiAck` also swallows `setItem` errors. Both cases are tested.

Additional tests beyond the plan: `warnSignature` ignores block findings, an empty footer is a no-op, `aborted` falls back to the generic error copy, and statusCopy 'done' without a findings sentence.

## Known Stubs

None.

## Self-Check: PASSED
