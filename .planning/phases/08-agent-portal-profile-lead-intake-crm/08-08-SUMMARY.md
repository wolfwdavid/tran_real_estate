---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 08
subsystem: disclosure-core
tags: [agent, disclosure, can-spam, state-rules, tdd, fast-check]
requires:
  - "08-01 @tran/core/agent/types (ProfileInput, LicenseType, ConsentSource, EMPTY_PROFILE_INPUT, SAMPLE_AGENT_PROFILE)"
  - "08-01 @tran/core/leads/normalize (normPhoneUS, formatPhoneUS)"
provides:
  - "@tran/core/disclosure barrel: STATE_RULES (FL/NJ/OH/CA/NY/TX), GENERIC_RULE, ruleFor, PROFILE_FIELDS, PROFILE_FIELD_LABELS, BASE_TEMPLATE, RuleTable, ProfileField"
  - "composeDisclosure(p, ctx, { placeholders?, rules? }) -> { lines, text, missing, warnings, rule }, missingForDrafts, DISCLOSURE_SEPARATOR"
  - "OPT_OUT_LINE, AD_IDENTIFICATION_LINE, formatPostal, composeEmailFooter, appendFooter"
affects: [08-profile-ui, 08-followup-composer, 09-studio-reports]
tech-stack:
  added: []
  patterns:
    - "Data-driven state rules with a per-rule segment template (injectable rule table for planted-failure tests)"
    - "Footer appended locally outside the LLM; appendFooter is the single exit path"
key-files:
  created:
    - packages/core/src/disclosure/state-rules.ts
    - packages/core/src/disclosure/compose.ts
    - packages/core/src/disclosure/compose.test.ts
    - packages/core/src/disclosure/email-footer.ts
    - packages/core/src/disclosure/email-footer.test.ts
    - packages/core/src/disclosure/index.ts
  modified: []
decisions:
  - "Import form is the barrel @tran/core/disclosure (./* -> src/*/index.ts); no package.json exports edit was allowed in this wave"
  - "Separator ' \\u00b7 ' is exported as DISCLOSURE_SEPARATOR and written as an escape (sources stay ASCII); the plan's literal grep for ' · ' is satisfied semantically, not textually"
  - "StateRule gains a `template(segments)` field (brokerage-first BASE_TEMPLATE) so the planted control can mutate FL's segment order through the public rules option"
  - "Missing-field lists use one canonical order: name, brokerage, licenseType, licenseNumber, licenseState, brokeragePhone, postal, email"
  - "NY 'sales-associate' has no allowed title: licenseType is reported missing and warning 'ny-title' is raised; no title is printed"
metrics:
  duration: "~20 min"
  completed: 2026-10-06
  tasks: 2
  files: 6
---

# Phase 8 Plan 08: Disclosure composer and CAN-SPAM footer Summary

Pure core modules that produce the locked, brokerage-first agent disclosure (`Example Realty · Sample Agent, Real Estate Salesperson · Lic. #12345 (WA) · (555) 555-0100`, team variant `{Team} at {Brokerage} · ...`) with FL/NJ/OH/CA/NY/TX rules plus a generic default, each citing its source, and a CAN-SPAM email footer (name, brokerage, contact line, postal address, verbatim opt-out line, ad-identification line for non-inquiry consent, disclosure lines) that every follow-up exit appends locally via `appendFooter`.

## Consumer notes

- `import { composeDisclosure, composeEmailFooter, appendFooter, missingForDrafts, PROFILE_FIELD_LABELS } from '@tran/core/disclosure'`
- DisclosurePreview: `composeDisclosure(p, 'web', { placeholders: true })`; `rule === 'generic'` selects the "Tran doesn't have a specific rule for {State}" note; `missing.map(f => PROFILE_FIELD_LABELS[f])` feeds "Incomplete: add your ...".
- Phase 5 `GenerationPanel.emailFooter {text,label}`: pass `{ text: composeEmailFooter(p, { consentSource: contact.consentSource }).text, label: 'Added to the end of every follow-up' }`; gate drafting on `footer.missing.length === 0`.
- Phase 9: the second arg (`DisclosureContext`) is reserved for ad-inline / ad-block / print variants.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | State rule table + composeDisclosure (TDD, planted control) | 92becfe (RED), 681e80b (GREEN) |
| 2 | CAN-SPAM email footer (TDD, fast-check presence property) | f42b1ff (RED), 27d2431 (GREEN) |

## Verification

- `vitest run --project core packages/core/src/disclosure`: 2 files, 45 tests green (compose 35, footer 10; one `fc.assert` at 200 runs).
- `tsc --noEmit` on @tran/core: no errors in `src/disclosure/`. The only errors are in `src/leads/diff-leads.test.ts` (a sibling plan's RED step, out of scope).
- ESLint clean; all disclosure sources are pure ASCII (grep for non-ASCII = 0).
- Planted control: a FL template without the brokerage segment is flagged by the same `brokerageFirstFailure` helper the real presence test uses.
- Mutation testing (each mutation reverted afterwards). Every one failed at least one test:
  - FL salesperson title changed: 1 failure
  - NJ brokeragePhone requirement dropped: 1
  - OH licenseNumber requirement added: 1
  - CA brokerage-license line disabled: 1
  - CA licenseNumber requirement dropped: 2
  - NY sales-associate given a title: 1
  - TX CPN line removed: 1; TX IABS line disabled: 1
  - Generic associate-broker title changed: 2
  - Team variant `{Team} at {Brokerage}` replaced by brokerage only: 8
  - BASE_TEMPLATE order swapped (name before brokerage): 18
  - Footer: disclosure line dropped 2, ad-ID always omitted 1, opt-out removed 4, postal removed 3

## Deviations from Plan

**1. [Rule 3 - Blocking] ASCII sources vs the `' · '` acceptance grep**
Orchestrator rule: keep sources ASCII. The separator is `' · '` (exported as `DISCLOSURE_SEPARATOR`), so `compose.ts` doesn't contain the literal `' · '`, but the composed output does. Tool input turns escapes into literal characters, so a node post-processor re-escaped them (the same fix as 08-01).

**2. [Rule 2] StateRule.template + `rules` option**
The plan's interface had no hook for a "mutated rule table". I added a `template` field (all rules use the brokerage-first `BASE_TEMPLATE`) and a `rules?: RuleTable` option on `composeDisclosure`, which also lets `ruleFor` take the table.

**3. [Rule 2] `index.ts` barrel**
The orchestrator asked for this barrel. It is the only import path, because deep `@tran/core/disclosure/*` exports would need a package.json edit, which was not allowed this wave.

## Known Stubs

None.

## Self-Check: PASSED
