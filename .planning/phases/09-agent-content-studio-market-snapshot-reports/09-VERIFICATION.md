---
phase: 09-agent-content-studio-market-snapshot-reports
verified: 2026-10-07T23:55:00Z
status: gaps_found
score: 9/10 must-haves verified
gaps:
  - truth: "Fair Housing, number, number-word and unsupported-feature checks gate every studio exit (copy, email, mark as sent), so a problem phrase can't be copied before it is checked (ROADMAP SC1, guarantee 2)"
    status: partial
    reason: "Exits use findings that can be up to 300 ms stale. In edit mode the panel and card recheck 300 ms after the last keystroke, and no exit runs the checks first. So pasting or typing a Must-fix phrase and pressing Copy (or the live email link, or Mark as sent) inside that window passes the unchecked text through. A throwaway unit probe against PanelState confirmed it: generate a clean draft, setText('Perfect for young professionals.'), then copy() right away. copy() returned true and the clipboard got the phrase. The control (recheckNow() before copy()) is refused. The snapshot Save button already rechecks the current text (SnapshotBuilder.svelte save(), lines 340-357), so this hole affects the listing, reel and social exits only."
    artifacts:
      - path: "apps/web/src/lib/ai/ui/panel-state.svelte.ts"
        issue: "copy() / emailClicked() / markSent() call #gated(kind) on this.findings without flushing the pending #recheckTimer (setText lines 433-437). The mailto href (#mailto, line 137) comes from the current text and the link is live while the stale gate is open."
      - path: "apps/web/src/lib/ai/ui/GenerationPanel.svelte"
        issue: "The exit group (lines 715-735) renders while editing. onCopy and onEmail read gate.exits.* from the stale findings."
      - path: "apps/web/src/lib/ai/ui/PlatformCard.svelte"
        issue: "While editing, findings run on checkedEdit, which updates 300 ms after typing (onInput line 299). onCopy (line 355) copies cardPayload(spec, text) built from the newest override, so the copied text can differ from the checked text."
    missing:
      - "PanelState: in copy(), emailClicked() and markSent(), call recheckNow() first when a recheck is pending (or always), so the gate is computed on this.text. Keep the email link gated or without an href while a recheck is pending."
      - "PlatformCard onCopy: if editing and checkedEdit !== text, set checkedEdit = text and await tick() before reading `gated`, or copy only text that was checked."
      - "Regression tests: a PanelState unit test (setText of a block phrase, then an immediate copy() returns false and the clipboard is untouched; the same for markSent and the email gate) and a PlatformCard browser test (type a block phrase and click Copy inside recheckMs: nothing copied)."
human_verification:
  - test: "UAT-1: real-key Market Snapshot printed to PDF in Chrome, Firefox and Safari (plus the ?id=sample printout)"
    expected: "Brand band uses the effective colors or the Tran fallback; the logo prints; the non-removable labels, Prepared by, Data sources and the EHO statement (when on) print; the sample watermark shows only on the sample; charts draw in every engine; 1-4 pages for a typical snapshot"
    why_human: "Needs the owner's RentCast key and non-Chromium print engines"
  - test: "UAT-2: paste each social card into the real Instagram, Facebook and LinkedIn composers"
    expected: "The whole text is accepted, disclosure included; counts roughly match; hashtag caps 5/2/3 hold"
    why_human: "Real social accounts; platform counting rules are undocumented"
  - test: "UAT-3: read the NY and CA disclosures against 19 NYCRR 175.25 and Cal. Bus. & Prof. Code 10140.6"
    expected: "Every required element is present and nothing is truncated"
    why_human: "Counsel or owner legal read-through"
  - test: "UAT-4..8: owner decisions (EHO logo image, NY GBL 396-b and platform-policy recheck before launch, 6-page all-sections sample, Studio vs per-state license titles, duplicate memo block reason)"
    expected: "Owner accepts or files a follow-up for each"
    why_human: "Product, legal or policy decisions"
---

# Phase 9: Agent Content Studio & Market Snapshot Reports Verification Report

**Phase Goal:** An agent produces compliant, branded marketing content and client-ready market reports in minutes
**Verified:** 2026-10-07T23:55:00Z
**Status:** gaps_found (one narrow gating race; everything else verified. The owner-only items in 09-HUMAN-UAT.md are human_needed, not gaps)
**Re-verification:** No (initial verification)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: The agent writes a listing description from the facts they enter, and problem phrases are flagged with alternatives before copying | ✓ VERIFIED (flagging) / see #7 | `ListingStudio.svelte` passes `promptId="studio/listing.v1"`, postChecks = number (block), unsupported feature (warn), number words (warn). `runChecks` always includes `checkFairHousing` (panel-controller.ts:43). The closed fact whitelist is in `listing-facts.ts`, and the form has no school, worship, safety or demographic field. Copy is gated by `computeGate`. |
| 2 | SC2: The Instagram, Facebook and LinkedIn pack ends with the brokerage disclosure from the profile | ✓ VERIFIED | `social-sections-spec.ts` assemble = core `assemblePost(key, body, tags, disclosure)` (disclosure last, never truncated, `over` reported). `SocialStudio.svelte` uses `variant: 'ad-inline'`. Hashtag caps come from `HASHTAG_CAPS[platform]`. The prompt receives the disclosure only through `postBudget` sizing (social.v1.ts:123-125). |
| 3 | SC3: The reel script runs hook, manual pain, before/after, results, mission, call to action, with code-owned times, captions, a B-roll list and an 8-item AI-disclosure checklist, using only results the agent supplies | ✓ VERIFIED | `reel.ts timeBeats` uses only `REEL_TEMPLATES[length]`. The `RESULTS_PLACEHOLDER` rule is enforced by `resultsBeatPostCheck` (block). The reel number check blocks "Number you didn't provide". `checklist.ts` has 8 items incl. GBL § 396-b (built from a code point) and the footnote. `reel-export.ts` appends the caption disclosure and the checklist. |
| 4 | SC4: The branded Market Snapshot for a ZIP is labeled not-a-CMA and prints to PDF | ✓ VERIFIED | `/print/snapshot/+page.svelte` reads `?id` in onMount and renders the sample record or `getSnapshot(id)` through `SnapshotReport`/`PrintReport`. The SHORT_LABEL, full label, Prepared by, Data sources and EHO/Tran-footer toggles are wired from `record.options`. `BrandBand.bandColors` re-validates colors with the Tran fallback. The print button waits for stylesheets, fonts and the logo decode. |
| 5 | SC5: Demo-credible: keyless on every route, snapshot within the call budget, AI copy passes the checker, axe clean | ✓ VERIFIED | `studio-keyless.spec.ts` iterates `STUDIO_ROUTES` + the sample print, blocks the RentCast and four AI hosts, and runs axe at 375 and 1280. The 09-23 run is green on both bases (studio-1/2 reruns are green after a real print-stylesheet fix). The prompt `sample()` output gives zero findings (09-13/19/21 unit tests, re-run here). The 0/1/2 call budget is covered by `snapshot-calls.test.ts`. |
| 6 | Guarantee 1: every studio exit ends with the agent's disclosure, and the sample agent's disclosure never appears under a real agent's own content | ✓ VERIFIED | Listing, social and reel use the same rule: own disclosure when the profile is complete; Avery Sample only while unedited sample inputs are in the form AND the profile is incomplete; otherwise no footer and every exit is gated with the profile reason (`exitDisabled` copy/email/marked-sent). The reel's copied text ends with the caption-disclosure block plus the checklist, by spec (09-21). Snapshot: live data with an incomplete profile is gated (`saveGateReason`); sample data with an incomplete profile records the sample agent with `sample: true`. Covered by E2E checks (studio-reel.spec:283 `not.toContainText('Avery Sample')`, studio-social.spec:370). |
| 7 | Guarantee 2: Fair Housing, number, number-word and unsupported-feature checks gate every exit | ⚠️ PARTIAL | Severities are correct and the gate is enforced in `computeGate`, but exits use findings up to 300 ms stale while editing. A probe proved copy() succeeds with an unchecked Must-fix phrase right after setText(). See the gaps section. Snapshot Save is not affected: it rechecks the current text. |
| 8 | Guarantee 3: a saved snapshot never stores addresses, listing agents, photos or raw RentCast responses | ✓ VERIFIED | `build-record.ts` rebuilds every field key by key (`copySample` keeps only kind/seenAt/total/byBedroom{beds,count,min,max,median,medianDom}); the series come from `toMarketStatsInput` (medians and counts only); the logo is stored as `hasLogo` only. `snapshot-data.ts loadListingsSummary` reduces to `aggregateListings` before returning. `SnapshotRecord` type has no raw field. |
| 9 | Guarantee 4: RentCast calls go only through the DataGateway with the budget guard; agent CRM routes still make zero RentCast calls | ✓ VERIFIED | `snapshot-data.ts` spends only through `runtime.requestSpend(marketStatsRequest(zip))` and `buildListingsRequest`. The only network clients are under lib/data. Load functions are called only from click handlers (ZipPicker:106/339, SectionToggles:221). `scripts/agent-boundary.test.ts` (agent CRM, lib/leads and (public) never reach lib/data; studio excluded with a non-vacuity check and a planted control) and `features/studio/boundaries.test.ts` (print route never reaches lib/data) were re-run here: 147/147 green with banned-terms. Agent layout hides the DataStatusBar outside `/agent/studio/snapshot/`. |
| 10 | Guarantee 5: the studio is credible in a keyless demo | ✓ VERIFIED | Fixture provider streams `prompt.sample(input)`; `SAMPLE_SNAPSHOT_RECORD` is built from `buildSnapshotMetrics` with no lib/data import; hub, listing, social, reel, snapshot and `?id=sample` are covered by the keyless E2E. |

**Score:** 9/10 truths verified (1 partial)

### Required Artifacts

All artifacts declared in the 23 plans' must_haves exist and are substantive (`gsd-tools verify artifacts`: every plan passed except three pattern misses, which were checked by hand and are false negatives).

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/core/src/studio/*` (disclosure-format, team-name, allowed-numbers, listing-facts, unsupported-claims, snapshot-metrics, snapshot-facts, social-sections, reel, index barrel) | ✓ VERIFIED | Exported through `@tran/core/studio`. Core tests re-run: 21 files / 1,252 tests green |
| `packages/core/src/numbers/*`, `fair-housing/lexicon.ts` + `listing-additions.test.ts` | ✓ VERIFIED | Included in the core run above |
| `apps/web/src/routes/(app)/agent/studio/+page.svelte` | ✓ VERIFIED | The tool missed the `print/snapshot/` pattern because the link lives in `StudioHub.svelte:81` (`resolve('/print/snapshot/')?id=sample`). It is wired. |
| `apps/web/src/lib/ai/prompts/studio/reel.v1.ts` | ✓ VERIFIED | The tool missed the placeholder pattern because the prompt uses the `RESULTS_PLACEHOLDER` constant (`'[Add a real result you can document]'`, reel.ts:69) |
| `apps/web/src/lib/features/studio/reel/checklist.ts` | ✓ VERIFIED | The tool missed the "§ 396-b" pattern because the section sign is built from `String.fromCharCode(0xa7)` (ASCII source rule) |
| GenerationPanel / panel-controller `formatForExit`, PlatformCard, PrintReport `preparedLine` | ✓ VERIFIED (with the gap above) | Web tests re-run: 34 files / 571 tests green |
| Storage: `storage/studio/{types,tables,snapshots-repo,studio-draft-repo}.ts`, `db.ts` `this.version(7).stores(STUDIO_STORES)` | ✓ VERIFIED | Backup registration test is green |
| E2E specs: studio-listing, studio-social, studio-reel, studio-shell, studio-keyless, snapshot-builder, snapshot-print | ✓ VERIFIED | All exist; green in the 09-23 chunked run on root and sub |

### Key Link Verification

`gsd-tools verify key-links` reported most links as "Source file not found" or "invalid regex" because the plans' `from` fields are prose or double-escaped. Every link was checked by hand:

| From | To | Status | Evidence |
|------|----|--------|----------|
| assemblePost | HASHTAG_CAPS / PLATFORM_LIMITS | WIRED | disclosure-format.ts:210-213 |
| allowed-numbers.ts | ../numbers | WIRED | tool-verified |
| reel.ts timeBeats | REEL_TEMPLATES[length] | WIRED | reel.ts:217 |
| banned-terms findBanned | STUDIO_SCOPE | WIRED | banned-terms-rules.mjs:137,166; `pnpm banned` passed on 384 files |
| GenerationPanel exits | exitPayload(text, emailFooter, formatForExit) | WIRED | panel-state.svelte.ts:141,460 |
| assert-csp EXPECTED_PAGES | six new pages | WIRED | assert-csp.mjs:63-68 |
| compose.ts | formatDisclosure | WIRED | compose.ts:188 |
| agent-boundary.test | studio exclusion | WIRED | lines 13-21, 83-95 |
| db.ts | STUDIO_STORES | WIRED | db.ts:86 |
| DisclosureStatus | composeDisclosure ad-inline via shared/agent-profile | WIRED | DisclosureStatus.svelte:15-19,40-42 |
| post-checks | @tran/core/numbers checkNumbers | WIRED | post-checks.ts:11,73 |
| registry | studio prompts | WIRED | registry.ts:12-15,63-68 |
| snapshot-data | shared/markets marketStatsRequest | WIRED | snapshot-data.ts:23-28 |
| sample-snapshot | buildSnapshotMetrics( | WIRED | tool regex error only; confirmed by grep |
| ListingStudio | ad-block footer + post-checks | WIRED | ListingStudio.svelte:139-153,341-346 |
| SnapshotKeyFigures | snapshotFigureValues | WIRED | single formatter source |
| SnapshotBuilder | buildSnapshotRecord + addSnapshot + goto print | WIRED | SnapshotBuilder.svelte:363-381 |
| print route | getSnapshot / SAMPLE_SNAPSHOT_RECORD | WIRED | +page.svelte:91-97 |
| BrandBand | effectiveBrandColors / --brand-accent-effective | WIRED | BrandBand.svelte:2,17,50-51 |
| PlatformCard Copy | exits.ts copyText | WIRED | PlatformCard.svelte:155,364 |
| social.v1 render | postBudget / buildHashtagCandidates | WIRED | social.v1.ts:112,123-125 |
| SocialStudio | sections mode, ad-inline | WIRED | SocialStudio.svelte:75-88 |
| reel-export | parseReel/timeBeats/formatReelScript | WIRED | reel-export.ts |
| ReelStudio | formatReelForExit + reelFooter | WIRED | ReelStudio.svelte:65-77,172-173 |
| studio-keyless.spec | STUDIO_ROUTES | WIRED | tool-verified |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| STU-01 | 09-03/04/13/15 (+ shared) | Listing description from facts, checked by the Fair Housing checker | ✓ SATISFIED (gating race is in the gap) | Truth 1 |
| STU-02 | 09-01/06/19/20 | IG/FB/LinkedIn pack with brokerage disclosure appended | ✓ SATISFIED | Truth 2 |
| STU-03 | 09-06/21/22 | Founder-story reel script with timed beats, captions, B-roll, AI-disclosure checklist | ✓ SATISFIED | Truth 3 |
| STU-04 | 09-05/11/14/16/17/18 | Branded Market Snapshot printed to PDF, labeled not a CMA or appraisal | ✓ SATISFIED | Truth 4 |

No orphaned requirements: REQUIREMENTS.md maps only STU-01..04 to Phase 9, and every plan claims them.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| apps/web/src/lib/ai/ui/panel-state.svelte.ts | 433-437, 451-505 | Exit gating reads debounced findings | ⚠️ Warning → gap | A unchecked edit can leave through copy, email or mark-sent within 300 ms |
| apps/web/src/lib/ai/ui/PlatformCard.svelte | 220, 299, 355 | Same pattern: findings on `checkedEdit`, payload from `text` | ⚠️ Warning → gap | Same, per social card |
| apps/web/src/lib/features/studio/listing/ListingStudio.svelte | 142-147 | The sample disclosure follows the form state, not the draft | ℹ️ Info | With an incomplete profile, the unedited sample facts and a draft reopened from history (or rewritten by hand), the copy carries the Avery Sample disclosure. Behavior is by design (sample inputs mean sample output); worth a note in UX polish. |
| apps/web/src/routes/(print)/print/snapshot/+page.svelte | 103-114 | The logo is loaded from the current profile at print time | ℹ️ Info | A later logo change alters older printouts (documented: the record stores `hasLogo` only) |

No TODO/FIXME/placeholder stubs found in phase 9 sources. Phase 9 added no npm dependency (no package.json or lockfile diff since the first 09 commit). The banned-terms gate passed: 384 files, studio scope included.

### Commands run during this verification

- `gsd-tools verify artifacts` and `verify key-links` on all 23 plans
- `pnpm banned`: passed (384 files)
- vitest: `scripts/agent-boundary.test.ts`, `features/studio/boundaries.test.ts`, banned-terms tests: 3 files / 147 tests green
- vitest core: studio, fair-housing, numbers, disclosure: 21 files / 1,252 tests green
- vitest web: features/studio, ai/prompts, ai/ui, storage/studio, shared/agent-profile: 34 files / 571 tests green
- A temporary PanelState probe (deleted afterwards; tree clean) confirmed the recheck-window race and its control

### Human Verification Required

See 09-HUMAN-UAT.md (8 items, all owner, counsel or real-browser checks):

1. **UAT-1 real-key snapshot in Chrome, Firefox and Safari.** Print a live snapshot and `?id=sample`. Expected: brand band, logo, labels, EHO and sample watermark as specified, 1-4 pages.
2. **UAT-2 social composers.** Paste each card into the real IG, FB and LinkedIn composers. Expected: accepted in full, disclosure intact, caps hold.
3. **UAT-3 NY/CA disclosure read-through** against 19 NYCRR 175.25 and B&P 10140.6.
4. **UAT-4..8 owner decisions:** EHO logo image, GBL 396-b and platform-policy recheck before launch, 6-page all-sections sample, Studio vs per-state license titles, duplicate memo reason.

### Gaps Summary

The phase goal is met in substance. All four tools work end to end, keyless and with keys. Disclosures are code-appended last and never sent to the AI. The sample/real disclosure rule is consistent across all four tools. Snapshot records hold only aggregates. RentCast spending stays behind the gateway, and the agent CRM still makes zero RentCast calls.

One concrete hole stands against SC1 ("flagged before the text can be copied") and the exit-gating guarantee. The exits trust findings that are rechecked only 300 ms after the last keystroke. A Must-fix phrase typed or pasted in edit mode can go out through Copy, the email link or Mark as sent if the agent acts inside that window. A unit probe proved it. The root cause is shared: Phase 5 `PanelState` (the listing and reel exits) and the new Phase 9 `PlatformCard` (social). The fix is small: flush the recheck before any exit, and test it. Snapshot Save already does exactly this, so that pattern can be reused.

---

_Verified: 2026-10-07T23:55:00Z_
_Verifier: gsd-verifier_
