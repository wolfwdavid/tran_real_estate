---
phase: 09-agent-content-studio-market-snapshot-reports
verified: 2026-10-13T15:40:20Z
status: human_needed
score: 10/10 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 9/10
  gaps_closed:
    - "Fair Housing, number, number-word and unsupported-feature checks gate every studio exit (copy, email, mark as sent), so a problem phrase can't be copied before it is checked (ROADMAP SC1, guarantee 2). Closed by 09-24 (PanelState, GenerationPanel, PlatformCard). 09-25 applies the same fix to snapshot Save and investor memo Print."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "UAT-1: real-key Market Snapshot printed to PDF in Chrome, Firefox and Safari (plus the ?id=sample printout)"
    expected: "Brand band uses the effective colors or the Tran fallback; the logo prints; the non-removable labels, Prepared by, Data sources and the EHO statement (when on) print; the sample watermark shows only on the sample; charts draw in every engine; 1-4 pages for a typical snapshot"
    why_human: "Needs the owner's RentCast key and non-Chromium print engines"
  - test: "UAT-2: paste each social card into the real Instagram, Facebook and LinkedIn composers"
    expected: "The whole text is accepted, disclosure included; counts roughly match; hashtag caps 5/2/3 hold"
    why_human: "Needs real social accounts, and the platforms do not document how they count characters"
  - test: "UAT-3: read the NY and CA disclosures against 19 NYCRR 175.25 and Cal. Bus. & Prof. Code 10140.6"
    expected: "Every required element is present and nothing is truncated"
    why_human: "Needs a legal read by counsel or the owner"
  - test: "UAT-4..8: owner decisions (EHO logo image, NY GBL 396-b and platform-policy recheck before launch, 6-page all-sections sample, Studio vs per-state license titles, duplicate memo block reason)"
    expected: "Owner accepts or files a follow-up for each"
    why_human: "Product, legal or policy decisions"
---

# Phase 9: Agent Content Studio & Market Snapshot Reports Verification Report

**Phase Goal:** An agent produces compliant, branded marketing content and client-ready market reports in minutes
**Verified:** 2026-10-13T15:40:20Z
**Status:** human_needed. Every automated must-have passes. The owner, counsel and real-browser items in 09-HUMAN-UAT.md are still open.
**Re-verification:** Yes. This run follows the gap closure in plans 09-24 and 09-25. The previous run was gaps_found at 9/10.

## Gap Closure (re-verified against the code)

The previous gap was truth 7 (guarantee 2): exits read findings up to 300 ms stale while the agent was editing.

| Exit | Fix in code | Evidence |
|------|-------------|----------|
| PanelState `copy()`, `emailClicked()`, `markSent()` (listing, reel and every GenerationPanel host) | `this.flushChecks();` is the first statement of all three (panel-state.svelte.ts:487, 505, 521). `flushChecks()` runs `recheckNow()` when `checkPending` is set (463-465). `checkPending` is set in `setText` (444) and cleared in `recheckNow` (451), `#run` (319) and `open` (549). | Read in full. |
| Email link href | `get emailHref()` returns `undefined` while `checkPending` is set or the exit is gated (179-181). The `<a>` uses `href={st.emailHref}`, keeps `role="link"`/`tabindex=0` when there is no href, and runs `onpointerdown={settle}` (GenerationPanel.svelte:770-775). | Read. |
| GenerationPanel handlers | `settle()` (flushChecks + `flushSync`, 399-404) is the first statement of `onCopy`, `onEmail`, `onEmailKey` and `onMarkSent` (407, 420, 433, 440). `onEmailKey` calls `onEmail` only when there is no href, so a click is not handled twice. The panel exports `flushChecks()` (274) and a read-only `checkPending` bindable (91, 255). It forwards `recheckMs` to PlatformCard (660). | Read. |
| PlatformCard Copy (social) | `onCopy` captures `current = text`. While editing it sets `checkedEdit = current` and cancels the timer before reading `gated`. It ticks before focusing the reason line and copies `cardPayload(spec, current)`, the exact text it checked (PlatformCard.svelte:355-380). `cardPayload(spec, text)` no longer appears. | Read. |
| Snapshot Save (09-25) | `save()` calls `panel?.flushChecks(); flushSync();` right after the `saving` guard and before it reads `gateReason` (SnapshotBuilder.svelte:338-339). The existing Must-fix `fresh` recheck is still there as a second check. | Read. |
| Investor memo Print (09-25, Phase 7 exit, same pattern) | `settlePrint()` = `panel?.flushChecks(); flushSync();` (MemoPage.svelte:154-157) runs first in `onPrint`, runs in `onPrintKey`, and is the link's `onpointerdown`. The link uses `href={printLive ? printHref : undefined}` with `printLive = printEnabled && !checkPending` (88, 353). `bind:checkPending` is wired (318). | Read. |

No other exits are left. Grep finds `copyText(` / `buildMailto(` only in panel-state.svelte.ts and PlatformCard.svelte, and only SnapshotBuilder and MemoPage bind the panel's `canExit`/`findings` for exits they own. Both now flush first.

**Independent reproduction of the original probe.** I wrote a throwaway vitest file with real timers and a real PanelState (deleted afterwards; `git status` is clean). It generates a clean draft, calls `setText('Perfect for young professionals.')`, then calls `copy()` at once.
- Current code: `copy()` returns `false`, the clipboard is untouched and `onExit` is not called. `emailHref` is `undefined`, `emailClicked()` returns `false`, `markSent()` does not mark the draft sent, and the clean-edit control copies the current text. 3/3 pass.
- Mutation run: I removed the three `this.flushChecks();` lines and ran the same probe. The copy and the email/markSent probes both fail; the control still passes. Then I restored the file with `git checkout`. So the probe measures the fix and does not pass by accident.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: listing description from entered facts; problem phrases flagged with alternatives before copying | ✓ VERIFIED | Unchanged since 10-07 (ListingStudio, listing-facts whitelist, `runChecks` incl. Fair Housing). Copying before the check is now closed too (truth 7). |
| 2 | SC2: IG/FB/LinkedIn pack ends with the brokerage disclosure | ✓ VERIFIED | Regression check only: `social-sections-spec`/`assemblePost` unchanged. PlatformCard changed only in `onCopy`, and its payload still comes from `cardPayload` (the assembled post with the disclosure). |
| 3 | SC3: reel script with code-owned timings, captions, B-roll, 8-item checklist, only agent-supplied results | ✓ VERIFIED | No reel files changed since 10-07. The studio tests are green. |
| 4 | SC4: branded Market Snapshot for a ZIP, labeled not-a-CMA, prints to PDF | ✓ VERIFIED | Only `save()` changed in SnapshotBuilder. 09-25 reports snapshot-print E2E 5/5 green. Snapshot unit tests re-run green. |
| 5 | SC5: keyless on every route, call budget, checker-clean AI copy, axe clean | ✓ VERIFIED | No prompt, data or route files changed. 09-24 reports studio-listing/reel/social E2E green on root. |
| 6 | Guarantee 1: disclosure on every exit; the sample agent's disclosure never shows under a real agent | ✓ VERIFIED | Unchanged. The `exitPayload(text, emailFooter, formatForExit)` path is untouched. |
| 7 | Guarantee 2: Fair Housing, number, number-word and unsupported-feature checks gate every exit | ✓ VERIFIED (was PARTIAL) | Every exit runs the pending recheck before it reads the gate (table above). The link exits have no href while a check is pending. My independent probe and its mutation control confirm it. The new tests are green in my runs: panel-state 7 unit tests, GenerationPanel 8 browser tests, PlatformCard 2 browser tests. |
| 8 | Guarantee 3: no addresses, agents, photos or raw responses in saved snapshots | ✓ VERIFIED | build-record.ts and snapshot-data.ts are unchanged. |
| 9 | Guarantee 4: RentCast only through the DataGateway; agent CRM makes zero calls | ✓ VERIFIED | `scripts/agent-boundary.test.ts` re-run green in this pass. No lib/data changes. |
| 10 | Guarantee 5: credible keyless demo | ✓ VERIFIED | Unchanged. The fixture and sample paths are untouched. |

**Score:** 10/10 truths verified

### Required Artifacts (gap-closure plans)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/lib/ai/ui/panel-state.svelte.ts` | checkPending, flushChecks(), emailHref; exits flush first | ✓ VERIFIED | gsd-tools artifacts passed; wired into GenerationPanel and every host |
| `apps/web/src/lib/ai/ui/GenerationPanel.svelte` | settle() before every exit; href withheld; flushChecks export + checkPending bindable | ✓ VERIFIED | Used by MemoPage, SnapshotBuilder and PanelBindHarness |
| `apps/web/src/lib/ai/ui/PlatformCard.svelte` | onCopy checks current text and copies only the checked text | ✓ VERIFIED | `checkedEdit = current` at 360; `cardPayload(spec, current)` at 371 |
| `apps/web/src/lib/ai/ui/panel-state.test.ts` | "inside the recheck window" regression tests | ✓ VERIFIED | Green (44 with probe, re-run) |
| `apps/web/src/lib/ai/ui/PlatformCard.browser.test.ts` | real-browser regression | ✓ VERIFIED | 13/13 green together with GenerationPanel.browser.test.ts |
| `apps/web/src/lib/ai/ui/testing/PanelBindHarness.svelte` | test harness for the bindable | ✓ VERIFIED | Test-only |
| `apps/web/src/lib/features/studio/snapshot/SnapshotBuilder.svelte` | Save flushes before gate | ✓ VERIFIED | 338-339 |
| `apps/web/src/lib/features/investor/memo/MemoPage.svelte` | settlePrint + printLive | ✓ VERIFIED | 88, 154-162, 181-186, 318, 353-358 |
| E2E: `snapshot-builder.spec.ts`, `investor/memo.spec.ts` | Review phrase inside the window refused; Print href null while pending | ✓ EXISTS | 09-25 SUMMARY reports RED-first runs and both mutation checks. I did not re-run Playwright here; the build plus E2E is too slow for this pass. |

The plan artifacts from the 10-07 run (09-01..09-23) are unchanged. Since a1d9524, `git diff --stat` touches only the 11 files above, and none under `packages/`.

### Key Link Verification

`gsd-tools verify key-links` reports "Source file not found" for all 7 links, because each plan's `from` field adds prose after the path. This is the same false negative as in the previous run. I checked every link by hand:

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| panel-state copy/emailClicked/markSent | recheckNow() | `this.flushChecks();` first | WIRED | 3 occurrences (487, 505, 521) |
| GenerationPanel email `<a>` | PanelState.emailHref | `href={st.emailHref}`, `onpointerdown={settle}` | WIRED | 770, 775 |
| PlatformCard onCopy | findings/reason/gated deriveds | `checkedEdit = current` | WIRED | 360, then `gated` read at 363 |
| GenerationPanel bindables $effect | PanelState.checkPending | `checkPending = st.checkPending;` | WIRED | 255 |
| SnapshotBuilder save() | GenerationPanel.flushChecks | `panel?.flushChecks(); flushSync();` | WIRED | 338-339 |
| MemoPage settlePrint() | GenerationPanel.flushChecks | `panel?.flushChecks(); flushSync();` | WIRED | 155-156 |
| MemoPage print `<a>` | checkPending bindable | `bind:checkPending`; `href={printLive ? printHref : undefined}` | WIRED | 318, 353 |

All key links from the previous report (23 rows) are in files this round did not touch, except the PlatformCard Copy → `exits.ts copyText` link. That one is still wired (PlatformCard.svelte:372).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| STU-01 | 09-03/04/13/15, 09-24 | Listing description from facts, checked by the Fair Housing checker | ✓ SATISFIED | Truths 1, 7 |
| STU-02 | 09-01/06/19/20, 09-24 | IG/FB/LinkedIn pack with brokerage disclosure appended | ✓ SATISFIED | Truths 2, 7 (card Copy) |
| STU-03 | 09-06/21/22, 09-24 | Founder-story reel script with timed beats, captions, B-roll, AI-disclosure checklist | ✓ SATISFIED | Truths 3, 7 |
| STU-04 | 09-05/11/14/16/17/18, 09-25 | Branded Market Snapshot to PDF, labeled not a CMA or appraisal | ✓ SATISFIED | Truths 4, 7 (Save) |

No requirements are orphaned. REQUIREMENTS.md maps only STU-01..04 to Phase 9 (lines 199-202, all Complete), and plans claim all four. 09-25 also hardens the Phase 7 INV-06 memo Print exit with the same fix. It deliberately does not re-claim INV-06.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| apps/web/src/lib/features/studio/snapshot/save-gate.ts | 50 | A Review-only notes gate calls `notesFindingsReason(s.mustFix)` with mustFix = 0 | ⚠️ Warning (copy) | The Save reason reads "Fix the 0 items marked Must fix in the market notes, and review any others." It is clumsy, but the gate still works. 09-25 already logged it as a follow-up. |
| apps/web/src/lib/features/studio/listing/ListingStudio.svelte | 142-147 | The sample disclosure follows the form state, not the draft | ℹ️ Info | Carried over from 10-07, by design |
| apps/web/src/routes/(print)/print/snapshot/+page.svelte | 103-114 | The logo is loaded from the current profile at print time | ℹ️ Info | Carried over from 10-07, documented |

The new code has no TODO/FIXME/placeholder stubs and no programmatic navigation (`location.*` / `window.open(`). `no-auto-send.test.ts` passed in the lib/ai run.

### Commands run during this re-verification

- Throwaway PanelState probe (real timers): 3/3 pass on current code. Mutation run with the three `this.flushChecks();` lines removed: 2 probes fail, the control passes. File restored with `git checkout` and the probe deleted; tree clean.
- `vitest --project web panel-state.test.ts` + probe: 44 passed
- `vitest --project web-browser GenerationPanel.browser.test.ts PlatformCard.browser.test.ts`: 13 passed
- `vitest --project web features/studio, lib/ai, storage/studio, features/investor/memo, scripts/agent-boundary.test.ts`: 50 files / 887 passed
- `gsd-tools verify artifacts` on 09-24 (5/5) and 09-25 (2/2): all passed. `verify key-links`: tool false negatives, all checked by hand.
- 09-VALIDATION.md has the 5 new rows (9-24-01..03, 9-25-01..02)
- The orchestrator observed and I relied on: full vitest 5851/5852 (the one failure is a renter axe-timeout load flake that passes in isolation, in files this round did not touch), svelte-check 0 errors, prettier/eslint/banned/ui:guard clean. I did not re-run Playwright here; the 09-24/09-25 SUMMARYs report studio-listing/reel/social, snapshot-builder, snapshot-print and investor/memo green on root.
- No Node clock abort occurred, so no pin was needed.

### Human Verification Required

These are in 09-HUMAN-UAT.md, unchanged by this round:

1. **UAT-1 real-key snapshot in Chrome, Firefox and Safari.** Print a live snapshot and `?id=sample`. Expected: brand band, logo, labels, EHO and sample watermark as specified, 1-4 pages.
2. **UAT-2 social composers.** Paste each card into the real IG, FB and LinkedIn composers. Expected: accepted in full, disclosure intact, caps hold.
3. **UAT-3 NY/CA disclosure read-through** against 19 NYCRR 175.25 and B&P 10140.6.
4. **UAT-4..8 owner decisions:** EHO logo image, GBL 396-b and platform-policy recheck before launch, 6-page all-sections sample, Studio vs per-state license titles, duplicate memo reason.

### Gaps Summary

The single gap from 10-07 is closed. Every studio exit now runs a pending edit recheck on the current text before it reads the gate: Copy text, Open in email app, Mark as sent, social card Copy, snapshot Save and investor memo Print. Link exits (email, memo Print) carry no href while a check is pending, so a middle-click or new-tab open cannot follow unchecked text either. `flushSync` makes sure focus lands on the live findings title after the findings summary is re-rendered. The 09-24 and 09-25 mutation checks show the flush and the `flushSync` are both needed, and my independent probe reproduces the original failure against the pre-fix logic and shows it fixed now. Nothing else regressed: the change touches only 11 files, all in the exit path, and the studio, AI, storage, memo and boundary suites are green. The phase goal is met as far as automated checks can tell. Only the owner, counsel and real-browser UAT items remain.

---

_Verified: 2026-10-13T15:40:20Z_
_Verifier: gsd-verifier_
