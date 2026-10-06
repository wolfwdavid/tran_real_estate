---
phase: 07-investor-portal
plan: 17
subsystem: investor-memo
tags: [memo, prompt, post-check, numbers, advice-language, fair-housing, generation-panel, e2e]
requires:
  - "07-04: createPostCheck, CheckGroupCopy, groupFindings, GenerationPanel checkGroups/subjectId/artifactMeta + read-only artifactId/draftText, PromptDef.sample"
  - "07-08: buildMemoFacts, sampleMemo, checkAdviceLanguage, analysisHash"
  - "07-02: checkNumbers"
  - "07-09: getDeal, DealRecord"
  - "Phase 5: registry/buildPrompt, runChecks, computeGate, blockReason, WARN_REASON, DraftHistory"
provides:
  - "Prompt investor/memo.v1 (FACTS + notes only, keyless sample memo, containsClientData false)"
  - "memoFactsForDeal(deal, notes) -> MemoFacts; PROPERTY_TYPE_LABEL"
  - "createMemoPostChecks(allowed): PostCheck[] (numbers, advice); MEMO_CHECK_GROUPS; memoGateReasons(findings, blocked, canExit)"
  - "/investor/memo/?id= page (MemoPage.svelte) with gated print link to /print/memo/?id=&memo= and data-artifact-id hook"
affects: [07-19 print route, 07-21 phase gate]
tech-stack:
  added: []
  patterns:
    - "Host-side gating of a non-panel exit (print link) from the panel's read-only bindables plus a synchronous runChecks recheck at activation"
key-files:
  created:
    - apps/web/src/lib/ai/prompts/investor/memo.v1.ts
    - apps/web/src/lib/ai/prompts/investor/memo.v1.test.ts
    - apps/web/src/lib/features/investor/memo/memo-facts-for-deal.ts
    - apps/web/src/lib/features/investor/memo/memo-checks.ts
    - apps/web/src/lib/features/investor/memo/memo-checks.test.ts
    - apps/web/src/lib/features/investor/memo/MemoPage.svelte
    - apps/web/tests/e2e/investor/memo.spec.ts
  modified:
    - apps/web/src/lib/ai/prompts/registry.ts
    - apps/web/src/routes/(app)/investor/memo/+page.svelte
decisions:
  - "Prompt id follows the renter convention: id 'investor/memo.v1', version 1 (promptId 'investor/memo.v1@1'); housingCopy true so the guardrail is prepended"
  - "build() reads only factsText and notes; `facts` is carried for sample() and never serialized into the prompt"
  - "Advice group gating reason (discretion): 'Rewrite the {n} advice phrase(s) marked Must fix to copy, email, or print this memo.'; done sentence 'No advice language found.' / '{n} advice phrase(s) to fix.'"
  - "Number group findingsTitle/doneSentence count block + warn (spelled-out quantities are warn findings in the same group)"
  - "Print reasons are hidden until a stored draft exists (artifactId and draftText set), matching Phase 5's null reason before ready"
  - "Notes over 1,000 characters block Draft memo via beforeGenerate (focus the textarea) and are excluded from FACTS until shortened"
  - "DraftHistory uses headingLevel 3 (its prop allows 3 | 4)"
metrics:
  duration: ~40min
  completed: 2026-10-05
  tasks: 3
  files: 9
---

# Phase 7 Plan 17: Investment memo page Summary

The investor memo is live at `/investor/memo/?id=`. The new `investor/memo.v1` prompt sends the model only the pre-formatted FACTS text and the user's notes, and keyless mode streams the deterministic `sampleMemo`. Two post-checks run alongside the Fair Housing checker and gate Copy, Open in email app, Mark as sent and the print link:

- **Numbers:** every numeral must match a figure in the analysis or the notes.
- **Advice language:** no promises and no buy-or-sell advice.

A stale note appears when the latest memo's `analysisHash` differs from the saved deal's current inputs.

Advances requirement **INV-06** (generation half). `requirements mark-complete` was not run, per orchestrator. The print route is 07-19.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Prompt investor/memo.v1 + memoFactsForDeal | a43d648 (RED), 6541d3a (GREEN) |
| 2 | Number and advice post-checks, groups, gate reasons | 580ba4f (RED), b92381e (GREEN) |
| 3 | Memo page + memo E2E | bdca4d1 (feat), 973d05f (test) |

## Verification

- `vitest --project web memo.v1 memo-checks`: green. Covered:
  - guardrail-first system prompt
  - FACTS/NOTES-only user message, which ignores a tampered `facts` object
  - "Monthly cash flow: $184" with no `/\d+\.\d{3,}/`
  - for all 9 reference cases, the sample memo has zero findings from both `checkNumbers` and Fair Housing
  - `fixtureText` stays out of the sent payload
  - source mapping
  - Phase 5 `runChecks`/`computeGate` integration
  - group copy
  - `memoGateReasons` cases
- `vitest --project web apps/web/src/lib/ai + memo`: 28 files, 568 tests green. This includes the GenerationPanel "exactly three exits" SSR test and the unchanged panel-controller tests.
- `corepack pnpm test:unit`: 208 files, 4083 tests pass.
- `corepack pnpm check`: 0 errors. Prettier and ESLint are clean on every touched file. `corepack pnpm banned` passed (239 files).
- `grep onstatechange|PanelGateState|gate.phase|gate.artifactId` on `features/investor/memo`: 0 in every file.
- After `build:root` and `build:sub`, Playwright `tests/e2e/investor/memo` passes 5/5 on root and 5/5 on sub. A combined run of `investor` + `ai-drafting` + `renter-outreach` had 141 passed and 1 failed. The failure was `investor/autofill.spec.ts` "keyless sample autofill spends nothing", which belongs to parallel plan 07-15. Its spec was committed while this build was in flight, so it was out of scope and not touched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan fixture] The planted number changed from 20% to 12%**
- **Found during:** Task 2 (RED → GREEN)
- **Issue:** The sample deal (reference case A) has a 20% down payment, so "20%" is a figure from the analysis. It correctly passes the number check, so the plan's planted memo would never produce "Number check: 1 to fix".
- **Fix:** Unit tests and the E2E plant "Expect 12% growth next year." A unit test also asserts that "Down payment is 20%." passes.
- **Commits:** 580ba4f, 973d05f

**2. [Rule 1] E2E draft-ready wait**
- The status line has to be matched exactly (`'Draft ready.'`, as in renter-outreach).
- The keyless sample memo streams about 300 words at 20-60ms each, so the wait is 60s.

## Known Stubs

None. The `/print/memo/` target is built by 07-19 (next wave). Until then the enabled print link points at the existing placeholder route, which is intended.

## Self-Check: PASSED
