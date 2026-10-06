---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 01
subsystem: agent-core
tags: [agent, crm, contracts, zod, normalization, fast-check]
requires:
  - "Phase 3 syncable.ts (Syncable, SyncableSchema) - reused"
provides:
  - "@tran/core/agent/types: STAGES, STAGE_LABELS, CONTACT_SOURCES, SOURCE_LABELS, CONSENT_SOURCES, ConsentSource, LICENSE_TYPES, LICENSE_TYPE_LABELS, ACTIVITY_TYPES, CONTACT_MAKING, US_STATES, isLive, SyncableFields, Contact, Task, Activity, PostalAddress, StoredLogo, AgentProfile, ProfileInput, ContactDraft, IncomingLead, EMPTY_PROFILE_INPUT"
  - "@tran/core/agent/schemas: contactSchema, taskSchema, activitySchema, agentProfileSchema, MAX_* caps"
  - "@tran/core/agent/fixtures/sample-profile: SAMPLE_AGENT_PROFILE"
  - "@tran/core/leads/normalize: normalizeText, cleanText, normEmail, normPhoneUS, formatPhoneUS, firstName"
  - "Barrels: @tran/core/agent (types, schemas; 08-04 appended logo), @tran/core/leads (normalize)"
affects: [08-02..08-26]
tech-stack:
  added: []
  patterns:
    - "Deep-path import: @tran/core/agent/<file> and @tran/core/leads/<file> via new ./agent/* and ./leads/* exports"
    - "Fixpoint wrapper guarantees idempotence of normEmail/cleanText"
key-files:
  created:
    - packages/core/src/agent/types.ts
    - packages/core/src/agent/schemas.ts
    - packages/core/src/agent/schemas.test.ts
    - packages/core/src/agent/index.ts
    - packages/core/src/agent/fixtures/sample-profile.ts
    - packages/core/src/leads/normalize.ts
    - packages/core/src/leads/normalize.test.ts
    - packages/core/src/leads/index.ts
  modified:
    - packages/core/package.json
decisions:
  - "Core deep-path imports: @tran/core/agent/<file> and @tran/core/leads/<file> (explicit ./agent/* and ./leads/* subpath exports alongside the existing ./* -> dir/index.ts and ./renter/* wildcards)"
  - "Phase 3 Syncable reused as SyncableFields; deletedAt omitted on live rows, null rejected by schemas"
  - "ProfileInput keeps id ('profile'): Omit<AgentProfile, Exclude<keyof SyncableFields,'id'>> so EMPTY_PROFILE_INPUT/SAMPLE_AGENT_PROFILE match the plan literals; agentProfileSchema overrides the uuid id with literal 'profile'"
  - "Source files must hold non-ASCII only as backslash-u escapes (tool input turns them into literal invisible chars - Trojan Source risk)"
metrics:
  duration: "~25 min"
  completed: 2026-10-06
  tasks: 2
  files: 9
---

# Phase 8 Plan 01: Agent contracts and lead normalization Summary

This plan adds the Phase 8 interface-first base: typed agent CRM records (Contact, Task, Activity, AgentProfile) with zod/mini trust-boundary schemas built on Phase 3's `SyncableSchema`, a synthetic Avery Sample / Sample Realty profile, and property-tested normalization for text, email and US phone numbers. Later plans use that normalization for duplicate detection, the inquiry sanitizer and CSV import.

## Import form for later plans

- `import { STAGES, type Contact } from '@tran/core/agent/types'`
- `import { contactSchema } from '@tran/core/agent/schemas'`
- `import { normEmail, normPhoneUS } from '@tran/core/leads/normalize'`
- The barrels `@tran/core/agent` and `@tran/core/leads` also work.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Agent record contracts, schemas, sample profile, deep-path export | 4e453c1 |
| 2 | Text/email/phone normalization (TDD) | f7b408e (RED), 7b29ef2 (GREEN) |

## Verification

- `vitest --project core` passed: 62 files, 1736 tests. Plan files: agent 5 tests, normalize 28 tests, with 5 `fc.assert` properties at 200 runs each.
- `tsc --noEmit` is clean for this plan's files. The only error at the time was `src/agent/logo.test.ts` from 08-04's RED step, which 08-04 owns and which cleared once 08-04 GREEN landed.
- `guard-real-data --all` passed. `grep -c "code: '" types.ts` = 51.
- Mutation checks on normalize.ts: each of these made the tests fail, and the original was restored afterward.
  - Weakening the NANP regex to `\d{10}`: 1 test failed.
  - Dropping the `U+202A-U+202E` range from HOSTILE: 3 tests failed.
  - Removing `.toLowerCase()` from normEmail: 1 test failed.

## Deviations from Plan

**1. [Rule 3 - Blocking] Dependencies already present**
fast-check 4.10.2 (devDependency), zod 4.6.4 and `@tran/core: workspace:*` in apps/web were already installed by earlier phases. No install ran, so `pnpm-lock.yaml` and `apps/web/package.json` are unchanged. No other Phase 8 plan adds a dependency; research says Phase 8 adds no runtime dependency.

**2. [Rule 3 - Blocking] Exports scheme**
`./*` already maps to `./src/*/index.ts`, which handles directory barrels only. I added `"./agent/*": "./src/agent/*.ts"` and `"./leads/*": "./src/leads/*.ts"` and kept the existing entries, following the 07-01 rule of keeping exports additive.

**3. [Rule 1 - Bug] ProfileInput vs EMPTY_PROFILE_INPUT**
The plan's `Omit<AgentProfile, keyof SyncableFields>` drops `id`, but the plan's own literals include `id: 'profile'`. ProfileInput now keeps `id`. `agentProfileSchema` overrides the uuid `id` check with `z.literal('profile')`.

**4. [Rule 1 - Bug] Literal bidi and zero-width characters in source**
Tool input turned backslash-u escapes into literal invisible characters (Trojan Source risk). A node post-processor re-escaped every non-ASCII character in `leads/*.ts`, and all plan files are now pure ASCII.

**5. [Rule 2] Idempotence hardening**
`normEmail` and `cleanText` now run their steps until the output stops changing (at most 4 passes). This makes NFKC/lowercase/trim interactions idempotent on arbitrary binary strings.

**Additions:** `CONSENT_SOURCES` const, `ContactDraft` type, `MAX_*` cap constants, `leads/index.ts` barrel. The profile schema also validates the `licenseState`/`postal.state` 2-letter format and the zip format.

## Requirements advanced

AGT-01 (profile contract) and AGT-03 (duplicate keys via normEmail/normPhoneUS) are partly done. They stay open until the 08-26 gate, so `requirements mark-complete` was not run.

## Known Stubs

None.

## Self-Check: PASSED
