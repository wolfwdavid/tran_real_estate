---
phase: 05-ai-layer-providers-streaming-fair-housing-guardrails
plan: 03
subsystem: ai-privacy
tags: [pii, redaction, privacy, core, tdd]
requires: []
provides:
  - "@tran/core/privacy: redactPii, restorePii, tokensFromRedactions, KnownPii, Redaction, RedactionResult, PiiKind"
affects:
  - "05 prompt registry / GenerationPanel 'What will be sent' preview (consumes redactPii)"
  - "Phase 8 GenerationPanel tokens prop (consumes restorePii + tokensFromRedactions)"
tech-stack:
  added: []
  patterns:
    - "Structured (declared-value) redaction instead of NER; Unicode-boundary regexes with the u flag"
    - "Later passes skip existing {token} spans, so no pass can corrupt an earlier token"
    - "Replacer functions everywhere so $-sequences in values are inserted literally"
key-files:
  created:
    - packages/core/src/privacy/redact-pii.ts
    - packages/core/src/privacy/redact-pii.test.ts
    - packages/core/src/privacy/restore-pii.ts
    - packages/core/src/privacy/restore-pii.test.ts
    - packages/core/src/privacy/index.ts
  modified: []
decisions:
  - "Phone lookahead is (?!\\d|[,.]\\d), not the planned (?![\\d,]): the planned form rejected any phone followed by a comma in prose"
  - "Declared known values win over derived first/last-name parts with the same text (case-insensitive)"
  - "Undeclared phones reuse one token per normalized 10-digit number (leading country code 1 dropped)"
metrics:
  duration: "~5 min"
  completed: 2026-10-05
  tasks: 2
  files: 5
---

# Phase 5 Plan 03: PII minimization (redactPii + restorePii) Summary

`@tran/core/privacy` turns declared client names, emails and phones into role tokens such as `{client_name}`. A full name also yields `{client_first_name}` and `{client_last_name}`. Undeclared emails and US phones become `{email_N}` and `{phone_N}`. Prices, zips, bed/bath counts, years and 7-digit numbers are left alone. `restorePii` puts the real values back locally after generation.

## What was built

- **`redactPii(text, known)`** (`redact-pii.ts`)
  - Expands multi-word `name` entries into first and last parts. The prefix is the token with any trailing `_name` removed.
  - Drops values with fewer than 2 characters and sorts longest first.
  - Matches case-insensitively on `\p{L}\p{N}` lookaround boundaries. Whitespace inside a name matches flexibly, and the original casing is recorded.
  - Every pass runs only outside existing `{token}` spans.
  - Emails get `{email_N}` with case-insensitive reuse. Phones get `{phone_N}` with reuse by normalized digits.
  - Redactions are deduped by original+token.
- **`restorePii(text, tokens)`** (`restore-pii.ts`): replaces `\{([a-z][a-z0-9_]*)\}` only for own keys (`Object.hasOwn`). A replacer function inserts values literally, so `$&` and `$1` stay as typed.
- **`tokensFromRedactions(redactions)`**: the first original per token wins. Built with `Object.fromEntries`, so a token key can never write to the prototype.
- **`index.ts`** barrel: re-exports both modules. The `./*` export (owned by 05-01) resolves `@tran/core/privacy` to it.

## Commits

| Task | Step | Commit | Message |
| ---- | ---- | ------ | ------- |
| 1 | RED | d9ef0d5 | test(05-03): add failing redactPii tests |
| 1 | GREEN | 532b187 | feat(05-03): structured PII redaction |
| 2 | RED | 49c4316 | test(05-03): add failing restorePii tests |
| 2 | GREEN | 97c7d4e | feat(05-03): restorePii |

## Verification

- `corepack pnpm exec vitest run --project core`: 22 files, 489 tests passed. This includes 23 redactPii tests and 12 restorePii tests.
- `corepack pnpm --filter @tran/core check` (tsc): clean.
- ESLint and Prettier on `packages/core/src/privacy`: clean.
- `corepack pnpm guard`: passed (751 files). Test data uses only `@example.com`/`@example.org` and 555-01xx numbers. There are no gmail/yahoo/outlook addresses.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Phone lookahead rejected phones followed by a comma**
- **Found during:** Task 1 GREEN
- **Issue:** The planned `(?![\d,])` failed on `'Call 212-555-0148, +1 212 555 0149, ...'`, because a comma in ordinary prose follows the number.
- **Fix:** Changed the lookahead to `(?!\d|[,.]\d)`. It still rejects a following digit group (new test: `'Parcel 1234567890,12'` is not a phone).
- **Files modified:** packages/core/src/privacy/redact-pii.ts, redact-pii.test.ts
- **Commit:** 532b187

**2. [Rule 2 - Robustness] Extra test coverage**
- Added tests for these cases:
  - no re-match inside inserted tokens (a known value `Client` vs `{client_name}`)
  - flexible whitespace in names
  - deduping repeated values
  - phone token reuse
  - inherited-key safety in restorePii
  - a round trip for undeclared emails and phones

## Known Stubs

None.

## Self-Check: PASSED
