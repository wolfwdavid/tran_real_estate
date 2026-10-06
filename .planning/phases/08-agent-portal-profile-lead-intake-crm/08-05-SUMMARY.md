---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 05
subsystem: leads-core
tags: [leads, parser, tran-lead, paste-import, fast-check, mutation-tested]
requires:
  - "08-01 @tran/core/leads/normalize (normalizeText, cleanText, normEmail, normPhoneUS, formatPhoneUS)"
  - "08-01 @tran/core/agent/schemas MAX_NAME / MAX_EMAIL / MAX_PROPERTY"
provides:
  - "@tran/core/leads/lead-block: LEAD_KEYS, LeadKey, LEAD_BLOCK_HEADER, LEAD_BLOCK_END, MAX_LEAD_MESSAGE, LeadBlockFields, ParsedLead, ParsedLeadBlock, canonicalLeadField, buildLeadBlock, parseLeadBlocks"
  - "@tran/core/leads/parse-freeform: FreeformLead, parseFreeform"
  - "packages/core/src/leads/fixtures/mangled-blocks.ts: CLEAN_LEAD, CLEAN_BLOCK, MANGLED (13), SECOND_LEAD, TWO_BLOCKS, V2_THEN_V1"
affects: [08-06, 08-10, 08-11, inquiry page, paste import]
tech-stack:
  added: []
  patterns:
    - "Forward-only fixed-order key search + explicit END terminator (newline-agnostic parsing)"
    - "Builder-side neutralization (forged keys -> 'key :', TRAN-LEAD -> 'TRAN LEAD', '>' lines indented)"
    - "Linear-time scanning on bounded tokens for untrusted 100k pastes"
key-files:
  created:
    - packages/core/src/leads/lead-block.ts
    - packages/core/src/leads/lead-block.test.ts
    - packages/core/src/leads/fixtures/mangled-blocks.ts
    - packages/core/src/leads/parse-freeform.ts
    - packages/core/src/leads/parse-freeform.test.ts
  modified:
    - packages/core/src/leads/index.ts
decisions:
  - "Message lines starting with '>' get a TWO-space guard (plan said one): quote stripping /^(>\\s?)+/ eats one space, so one space loses the visitor's '>' under bare '>' forwarding"
  - "Every 'TRAN-LEAD' in any value (case-insensitive) becomes 'TRAN LEAD', covering both END and header forms, in single-line fields as well as the message"
  - "Parsed values are cleanText'ed again (single-line: soft-wrap newlines healed to a space) so hand-crafted blocks cannot smuggle bidi/control characters; identity on builder output"
  - "A block missing any key, or with version v0, is { ok:false, error:'invalid' }; email additionally capped at MAX_EMAIL (254) and returned as the normEmail key"
  - "parseFreeform display names only from header-shaped lines (optional 'Label:' then quoted or bare name with no , ; : @) directly before <address>; reply attributions never match"
metrics:
  duration: "~35 min"
  completed: 2026-10-06
  tasks: 2
  files: 6
---

# Phase 8 Plan 05: TRAN-LEAD v1 block and free-form lead parsing Summary

The `TRAN-LEAD v1` builder, its tolerant multi-block parser and the free-form fallback are in place. The parser is property-tested and mutation-tested, and it survives every email mangling covered by the fixtures. Hostile text inside a visitor's message cannot change the parsed fields.

## Import form

- `import { buildLeadBlock, parseLeadBlocks, canonicalLeadField } from '@tran/core/leads/lead-block'`
- `import { parseFreeform } from '@tran/core/leads/parse-freeform'`
- Both modules are also exported from the `@tran/core/leads` barrel (export lines appended after 08-06's).

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | TRAN-LEAD v1 builder and tolerant parser (TDD) | 296dc62 (RED), 1c4412f (GREEN) |
| 2 | Free-form lead extraction (TDD) | 2bd210a (RED), 8c7a04a (GREEN) |

## Verification

- `vitest --project core packages/core/src/leads` passes: 5 files, 152 tests. Plan files: lead-block has 49 tests, with properties A (300 runs), B collapsed (300 runs) and C multi-block (100 runs). parse-freeform has 27 tests, including one property at 300 runs.
- The property arbitraries mix printable text, arbitrary code points (`unit: 'binary'`) and a token alphabet built from the format's own syntax: keys, `TRAN-LEAD`, ` v1`, `END `, `>`, CR/LF, NBSP, ZWSP, RLO, U+2028, a fullwidth colon and fullwidth "name". That means forged keys and markers show up in most runs.
- Fixtures: 13 `MANGLED` entries. (a)-(j) are the plan's fixtures (two blocks and v2-then-v1 are separate exports). (k) soft-wrapped lines, (l) HTML-to-text blank lines and tabs, and (m) an Outlook-style forward combining CRLF, `> `, NBSP and ZW are additions.
- **Mutation testing** used a scratch harness that applied each mutation, ran the suite and restored the file.
  - lead-block.ts: 25 of 25 mutants were killed. Two survived the first pass ("block runs past next header" and "no cleanText on parsed message"), and each got a new test. Killed mutants include the one-space quote guard, dropped marker or forged-key neutralization, neutralizing before NFKC, no wrap healing, the END-before filter, case-sensitive consent and every length limit.
  - parse-freeform.ts: 16 of 18 mutants were killed. Two survived the first pass ("display name without a `<` check" and "unanchored Name line"), and each got a new test. Two equivalent mutants remain:
    - Dropping the `NANP_E164` check: `normPhoneUS` already yields `+1` for every shape the phone regex matches.
    - Name-line `\s*` instead of `[^\S\n]*`: this only affects cross-line matching and performance.
- `tsc --noEmit` (core) is clean, eslint is clean on `src/leads/`, and `guard-real-data --all` passed on 1332 files.
- All sources are pure ASCII. Non-ASCII characters were re-escaped with a `String.fromCharCode(92)` script, and a control-character scan found 0.

## Deviations from Plan

**1. [Rule 1 - Bug] Two-space quote guard instead of one.** With one space, a forward quoted with a bare `>` turns `> >quoted` into `quoted`, and stripping eats the visitor's `>`. Two spaces survive the `> `, `>`, `> > `, `>>` and `>> ` markers, and a test covers all five. (1c4412f)

**2. [Rule 2 - Security] Marker and key neutralization scope.** `TRAN-LEAD` is neutralized in every field, single-line fields included. The plan only listed this for the message, but a name containing `TRAN-LEAD v1` would otherwise start a phantom block. Parsed values are cleaned again, and soft-wrap newlines in single-line values heal to a space. A missing key, a v0 block and an email longer than 254 characters are all reported as `invalid`. (1c4412f)

**3. [Rule 2 - Security] ReDoS-safe free-form scanning.** The UI-SPEC allows 100,000-character pastes. The email pattern now runs on whitespace and punctuation tokens of at most 254 characters, the name-line regex avoids `\s*` across lines, and the phone regex has `(?<![\dA-Za-z@])`/`(?!\d)` boundaries so it never takes digits out of a longer number. A timing test covers this. (8c7a04a)

**4. [Rule 2] Conservative display names.** A display name is only read from a header-shaped line directly before `<address>`, so Gmail reply attributions such as "On Mon, Oct 5, ... Morgan Demo <...> wrote:" are never taken as names. (8c7a04a)

**5. Barrel.** Appended `lead-block` and `parse-freeform` to `leads/index.ts` per the orchestrator. That file is not in the plan's `files_modified`.

## Requirements advanced

This plan partly advances AGT-02 (inquiry block format) and AGT-03 (paste import parsing). Both stay open for the 08-26 gate, and `requirements mark-complete` was not run (orchestrator instruction).

## Known Stubs

None.

## Self-Check: PASSED
