---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 06
subsystem: agent-core
tags: [leads, dedupe, inquiry-link, fast-check, tdd]
requires:
  - "08-01 @tran/core/leads/normalize (cleanText, normEmail, normPhoneUS, formatPhoneUS)"
  - "08-01 @tran/core/agent/types (Contact, IncomingLead, LicenseType, US_STATES, isLive)"
provides:
  - "@tran/core/leads/diff-leads: diffLeads, FILLABLE_FIELDS, FillableField, TargetRef, KeptValue, LeadDiffRow, LeadDiff"
  - "@tran/core/leads/inquiry-params: parseInquiryParams, inquiryParamPairs, ACCESS_KEY_RE, TITLE_CODES, INQUIRY_VERSION, InquiryConfig, InquiryParse"
  - "Both appended to the @tran/core/leads barrel"
affects: [08-07, 08-10, 08-11, 08-13]
tech-stack:
  added: []
  patterns:
    - "Two-pass diff: in-batch merge into the first occurrence (on copies), then classification against live contacts"
    - "Plain record/pair contract for URL params so core needs no URL types"
key-files:
  created:
    - packages/core/src/leads/diff-leads.ts
    - packages/core/src/leads/diff-leads.test.ts
    - packages/core/src/leads/inquiry-params.ts
    - packages/core/src/leads/inquiry-params.test.ts
  modified:
    - packages/core/src/leads/index.ts
decisions:
  - "An email/phone that matches a different contact than the target (id-matched case) is never filled: it goes to keeps, so an import cannot give one contact another person's identity key"
  - "In-batch merge never copies a phone that another batch row already owns (found by the idempotence property). Email needs no guard because email is looked up first"
  - "Any `v` other than absent or '1' is newer-version, per RESEARCH Pattern 2 ('Unknown -> newer version')"
  - "parseInquiryParams checks key, then name, then brokerage; demo=1 wins over everything"
metrics:
  duration: "~30 min"
  completed: 2026-10-06
  tasks: 2
  files: 5
---

# Phase 8 Plan 06: Dedupe dry-run diff and inquiry link contract Summary

This plan adds two pure core modules. `diffLeads` classifies every incoming lead as new, update, duplicate, conflict or same-as-row against live contacts, and an import never overwrites a non-empty field. `parseInquiryParams` and `inquiryParamPairs` define the inquiry link contract (`v,k,n,b,tm,t,st,lic,ph,p`, plus `demo=1`). Both are covered by property tests.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | diffLeads dry-run classification (TDD) | bc0cd81 (RED), 9210710 (GREEN) |
| 2 | Inquiry link parameter contract (TDD) | 4305d02 (RED), 066bcf2 (GREEN) |
| - | Leads barrel exports | bd57fe9 |

## Verification

- `vitest --project core packages/core/src/leads`: diff-leads 25 tests and inquiry-params 23 tests pass. normalize is still green. The only failing file is 08-05's in-progress `lead-block.test.ts`, which this plan does not own.
- Property tests: re-importing after applying the diff gives no new rows (except leads with no identity key) and no updates, and classification is deterministic. Checked at 200 runs, and once at 20,000 runs during development. A second property checks that the inquiry params round-trip cleaned name and brokerage values (200 runs).
- Mutation checks. Each mutation below made the tests fail, and the original was restored afterward.
  - diff-leads:
    - Removing the email-vs-phone conflict rule: 1 test failed.
    - Removing the phone match: 3 failed.
    - Ignoring tombstones: 1 failed.
    - Overwriting instead of keeping: 13 failed.
    - Removing the in-batch phone-ownership guard: property counterexample found, plus a deterministic regression test.
  - inquiry-params:
    - Replacing cleanText with trim: 2 failed.
    - Removing the state uppercasing: 1 failed.
    - Removing the license regex: 1 failed.
    - Emitting the phone in E.164: 1 failed.
- `tsc --noEmit` shows no errors in this plan's files. The remaining errors are sibling RED files: 08-05 lead-block and 08-07 csv. ESLint is clean on the four files, and all four are pure ASCII.

## Deviations from Plan

**1. [Rule 1 - Bug] In-batch merge could merge strangers**
- **Found during:** Task 1 GREEN, by the idempotence property.
- **Counterexample:** row1 `a@`, row2 `555-0101`, row3 `a@` + `555-0101`. Row 3 merged into row 1 and copied row 2's phone. The next import then attached row 2 to row 1's contact.
- **Fix:** the merge skips a phone that a different batch row already owns. A regression test was added.
- **Commit:** 9210710

**2. [Rule 2] Identity-key collision guard on fills**
- The plan only specified the id-match email collision. The guard now applies to both email and phone: a key matching a different live contact is never filled and is listed in keeps.

**3. Barrel export** (`leads/index.ts`): appended two lines, as the parallel-execution note instructs.

## Deferred Issues

- `corepack pnpm secrets:scan` (history mode) exits 1 on a pre-existing gitleaks `generic-api-key` finding in `packages/core/src/agent/schemas.test.ts:73` (08-01, commit 4e453c1). This plan adds no findings. Details and suggested fix are in `deferred-items.md`.

## Known Stubs

None.

## Self-Check: PASSED
