---
status: superseded
superseded_by: .planning/HUMAN-UAT.md
phase: 09-agent-content-studio-market-snapshot-reports
source: [09-23-PLAN.md, 09-VALIDATION.md "Manual-Only Verifications", 09-RESEARCH.md "Sampling Rate" and Open Questions 3-5, 09-04/09-10/09-15/09-17/09-18/09-19/09-20/09-14 SUMMARY gate notes]
started: 2026-10-07T17:00:00Z
updated: 2026-10-07T17:00:00Z
---
> Superseded on 2026-10-30 by `.planning/HUMAN-UAT.md` (Phase 13 ledger). This file is kept as history; record results in the ledger.

## Current Test

[awaiting the owner — NON-BLOCKING. Everything that can be checked locally passes on both base
paths with no keys and every provider host mocked or blocked: the five Studio routes and the sample
printout render, axe is clean at 375px and 1280px, the generators stream sample output with zero
RentCast or AI requests, snapshot print options and brand-color fallbacks hold through the real UI,
and the saved-record logo path decodes before printing. The items below need a real key, real
browsers other than Chromium, real social composers, counsel, or an owner decision.]

## Tests

### UAT-1. Real-key Market Snapshot printed in Chrome, Firefox and Safari
steps: 1. Add a RentCast key in Settings. 2. Complete your profile (with a logo and brand colors).
3. On `/agent/studio/snapshot/` load a real ZIP (1 call), optionally the listings summary (1 more),
draft the market notes, save and open the print view. 4. Choose **Print or save as PDF** in Chrome,
Firefox and Safari and save each as PDF. 5. Also print `/print/snapshot/?id=sample` in each.
expected: The brand band fills with your accent color and primary rule (or Tran's terracotta/sand
when a color fails contrast); the logo prints; the not-removable labels, Prepared by, Data sources
and (when on) the Equal Housing Opportunity statement print; the sample printout shows its sample
watermark lines ("Sample data, not a real market." and the sample sentence) and the real one does
not; charts draw in every engine (Chromium is automated, Firefox/Safari foreignObject printing is
not); page count is 1-4 for a typical saved snapshot (see UAT-6 for the all-sections sample).
result: [pending — requires the owner's RentCast key and Firefox/Safari]

### UAT-2. Social cards pasted into the real Instagram, Facebook and LinkedIn composers
steps: On `/agent/studio/social/` write a post pack (sample brief or your own), copy each card and
paste it into the real Instagram caption, Facebook post and LinkedIn post composers (do not publish).
expected: Each composer accepts the whole text, including the disclosure at the end; the
character counts roughly match Tran's count line (platform counting rules are undocumented); the
hashtag caps hold: at most 5 on Instagram, 2 on Facebook and 3 on LinkedIn.
result: [pending — requires the owner's social accounts]

### UAT-3. NY and CA sample disclosures read against the rule text
steps: Save a NY profile and a CA profile in turn. Read the Studio's ad-inline/ad-block disclosure
(listing and social) and the snapshot's Prepared by block against 19 NYCRR 175.25 (NY advertising:
broker name, licensed title, brokerage phone) and Cal. Bus. & Prof. Code 10140.6 (CA: name and
license number in advertising).
expected: Every required element is present and nothing is truncated. This is a read-through for
counsel, not legal advice.
result: [pending — counsel / owner read-through]

### UAT-4. Equal Housing Opportunity logo image (follow-up)
steps: Decide whether the printout should also carry the HUD EHO logo image.
expected: The text statement "Equal Housing Opportunity." ships today and is on by default; the
logo image is a follow-up only if the owner wants it (asset licensing and print contrast to check).
result: [pending — owner decision]

### UAT-5. Re-check NY GBL § 396-b and platform labelling policies before the Phase 10 launch
steps: Before GTM, re-read NY General Business Law § 396-b (AI-generated content in advertising)
and the current Instagram/Facebook/LinkedIn AI-content label and hashtag policies.
expected: The reel checklist item and the Studio's disclosure guidance still match the law and
platform rules; update the checklist copy if they changed.
result: [pending — pre-launch check, Phase 10]

### UAT-6. Owner decision: the all-sections sample snapshot prints on 6 Letter pages (09-18)
steps: Print `/print/snapshot/?id=sample` (every section on, both 24-month chart data tables
printed open as the UI-SPEC requires).
expected: The owner either accepts 6 pages for the all-sections report (the E2E caps it at 6; a
typical three-section saved snapshot prints on 1-2 pages), or approves condensed print data tables
(fewer months or a compact table) so it fits the planned 1-4 pages. Getting to 4 pages without that
would mean dropping required content or going below the UI-SPEC type sizes.
result: [pending — owner decision]

### UAT-7. Counsel/owner decision: Studio license titles vs Phase 8 per-state titles (09-10)
steps: Compare the Studio disclosure with the Phase 8 email footer for a non-NY agent, e.g. an FL
salesperson.
expected: Today the Studio uses fixed NY-safe labels ("Licensed Real Estate Salesperson") while
the Phase 8 email footer uses per-state titles ("Sales Associate" in FL). Counsel/owner decides
whether the Studio should switch to the per-state titles; until then both are lawful in their own
context and the Studio label is the conservative one.
result: [pending — counsel / owner decision]

### UAT-8. Informational: investor memos with an advertising phrase list two block reasons (09-04)
steps: In the investor memo, type a phrase that is both an advertising claim and advice language
(e.g. "will appreciate in value") and look at the gate reasons.
expected: The memo is correctly blocked and lists both the Fair Housing (advertising claim) and the
advice-language reasons. This is harmless; the owner may ask for the duplicate to be filtered
(drop `category === 'advertising'` members from the memo's Fair Housing group).
result: [pending — owner acknowledgement]

## Deferred (with reasons, not blocking)

- **Card edits are not written back into the stored social pack (09-19/09-20).** Draft history
  reopens the generated pack, not the edited cards. Writing edits back needs a per-section
  serializer in SectionSpec plus an artifact text update in the shared Phase 5 panel; the copied
  text (what actually leaves the page) always reflects the edit, so nothing wrong is ever pasted.
  Follow-up for a later Studio polish plan.
- **Draft history rows do not show the listing's street or area (09-15).** The listing form's
  helper says the field is shown "in the subject line and Draft history"; today it reaches only the
  email subject. Showing it needs a row label from artifact meta in the shared DraftHistory (09-20
  added a `rowNote` slot that can carry it). Follow-up; alternatively the helper copy can drop
  "and Draft history".
- **Snapshot provenance "stale" flag is future-proofing only (09-17).** The live gateway refetches
  any row past its TTL, so a snapshot load never returns a stale row today; the flag is wired so the
  provenance row stays truthful if the gateway ever serves stale data (e.g. offline).
- **Live RentCast data has no place name (09-14).** The markets endpoint carries no place name, so
  a live snapshot shows only "ZIP {zip}"; the sample metro name exists only in sample mode. A place
  lookup would cost an extra call against the 50-call budget, so it is not added.

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0

## Gaps

[none blocking — all 8 items are owner, counsel or real-browser checks]
