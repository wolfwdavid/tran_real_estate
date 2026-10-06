---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 07
subsystem: agent-core
tags: [csv, rfc4180, import, export, formula-injection, fast-check, zod]
requires:
  - "08-01 @tran/core/agent/{types,schemas} (Contact, IncomingLead, STAGES, CONTACT_SOURCES, MAX_* caps)"
  - "08-01 @tran/core/leads/normalize (cleanText, normEmail, normPhoneUS, formatPhoneUS)"
provides:
  - "@tran/core/csv (barrel) and csv/csv.ts: toCsv, parseCsv, detectDelimiter, escapeFormula, unescapeFormula, CsvError, CsvDelimiter"
  - "csv/contact-columns.ts: EXPORT_COLUMNS, MAPPING_TARGETS, MAPPING_LABELS, autoMap, validateMapping, rowsToIncomingLeads, exportContactsCsv, countDataRows, checkRowCap, MAX_CSV_ROWS, MAX_CSV_BYTES, types MappingTarget, MappingError, RowReason, RowsToLeadsResult, RowsToLeadsOptions"
affects: [08-20 CSV import UI, contacts export button]
tech-stack:
  added: []
  patterns:
    - "Hand-written RFC 4180: quote-all, CRLF, BOM on export; lenient CR/LF/CRLF + optional BOM on import"
    - "OWASP formula escaping with an injective rule (escape already-escaped-looking values too) so unescape is an exact inverse"
    - "One column contract shared by export and import, proven by an export->import fast-check property"
key-files:
  created:
    - packages/core/src/csv/csv.ts
    - packages/core/src/csv/csv.test.ts
    - packages/core/src/csv/contact-columns.ts
    - packages/core/src/csv/contact-columns.test.ts
    - packages/core/src/csv/index.ts
  modified: []
decisions:
  - "Hand-written parser passed the full edge-case suite; papaparse fallback NOT triggered (no dependency added)"
  - "RowReason gains 'too-long' (cell over a contact field cap) so oversize rows are listed, never truncated"
  - "Row numbers count records (header = 1), so a quoted cell with an embedded line break is still one spreadsheet row"
  - "Opt-out import is conservative: any non-empty email_opt_out_at that is not a clear no (no/n/false/0/none) counts as opted out; non-date markers are stamped with options.now (default current time)"
  - "Malformed id (non-uuid) and createdAt are dropped (undefined); malformed lastContactedAt becomes null"
  - "Export sort is stable by createdAt only (input order breaks ties)"
metrics:
  duration: "~12 min"
  completed: "2026-10-06"
  tasks: 2
  files: 5
---

# Phase 8 Plan 07: RFC 4180 CSV and Contacts Column Contract Summary

Dependency-free RFC 4180 CSV layer (BOM, quote-all, CRLF, OWASP formula escaping with an exact inverse, semicolon auto-detect) plus the contacts column contract (12 export columns, header-synonym auto-mapping, zod/mini row validation, 5,000-row cap), with round-trip and export-to-import fast-check properties.

## What was built

- **csv.ts**: `toCsv` (always `,`, every field quoted and formula-escaped, `\uFEFF` prefix, CRLF), `parseCsv(text, ',' | ';')` (BOM strip, quoted delimiters/quotes/CR/LF/CRLF, empty fields, no phantom trailing row, lone `""` kept, `CsvError('unterminated-quote')`), `detectDelimiter` (unquoted `,` vs `;` on the first line; tie -> `,`), `escapeFormula` / `unescapeFormula`.
- **contact-columns.ts**: `EXPORT_COLUMNS` (`name,email,phone,stage,source,property_of_interest,notes,consent_source,email_opt_out_at,added_at,last_contacted_at,id`), `exportContactsCsv` (skips samples and tombstones, national-format US phones, ids for stage/source, one header row, no disclosure row), `MAPPING_TARGETS` / `MAPPING_LABELS`, `autoMap` (synonyms + Tran headers 1:1, later duplicates -> skip), `validateMapping` (`need-name`, `need-contact`, `{kind:'duplicate'}`), `rowsToIncomingLeads` (unescape + cleanText per cell, first+last join, blank rows skipped, invalid rows by line and reason, unknown stages -> `new` and listed, source/consent whitelists, zod/mini caps), `countDataRows`, `checkRowCap`, `MAX_CSV_ROWS = 5000`, `MAX_CSV_BYTES = 5 * 1024 * 1024`.
- **index.ts** barrel so `@tran/core/csv` resolves through the existing `./*` export.

## Verification

- `corepack pnpm vitest run --project core packages/core/src/csv`: 108 tests pass (csv 39, contact-columns 69), including 500-run round-trip, two 500-run escape-inverse properties, and a 200-run export-to-import property.
- Mutation testing (each mutation applied, suite run, reverted): row cap `<=` -> `<`, counting the header, not skipping blank rows, removing BOM strip, removing BOM write, weakened unescape, non-injective escape, dropping the lone-`""` case, `< 10` -> `< 7` phone digits: every one killed.
- `tsc --noEmit` reports no errors in `src/csv` (the package-wide check currently fails only in a sibling plan's in-progress `src/leads/diff-leads.test.ts`, out of scope).
- eslint and prettier clean on `packages/core/src/csv`; `node scripts/guard-real-data.mjs --all` passes; sources are ASCII-only; `papaparse` count in core package.json is 0.

## Commits

- d7fec4b test(08-07): failing RFC 4180 CSV tests
- 3250afe feat(08-07): RFC 4180 CSV with formula-injection escaping
- 7875927 fix(08-07): write the BOM as an escape so CSV sources stay ASCII
- 5e16e27 test(08-07): failing contacts CSV column tests
- 326945e feat(08-07): contacts CSV column contract

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Literal BOM character in committed sources**
- **Found during:** Task 2 (ASCII scan)
- **Issue:** The first commit of csv.ts / csv.test.ts contained a literal U+FEFF instead of the `'\uFEFF'` escape the acceptance criteria require (and the ASCII-source rule).
- **Fix:** Rewrote it as the escape sequence; tests still green.
- **Commit:** 7875927

**2. [Rule 2 - Critical] 'too-long' row reason**
- **Issue:** The plan requires zod/mini caps per lead but its RowReason union had no reason for a cap violation; silently truncating would violate "never truncate".
- **Fix:** Added `'too-long'` to `RowReason`; the web import (08-20) needs copy for it.
- **Commit:** 326945e

**3. [Rule 2 - Critical] Conservative opt-out import**
- **Issue:** Other CRMs export opt-out as "Yes"/"true", not an ISO timestamp; dropping those would lose a CAN-SPAM opt-out.
- **Fix:** Any non-empty value other than a clear no counts as opted out, stamped with `options.now` (defaults to the current time).
- **Commit:** 326945e

**4. [Rule 1 - Bug] Lone quoted empty field at end of input**
- **Issue:** The RESEARCH reference parser dropped a final `""` with no line ending.
- **Fix:** The flush condition also checks `quotedField`.
- **Commit:** 3250afe

## Known Stubs

None.

## Self-Check: PASSED
