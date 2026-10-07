---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 10
subsystem: studio-wiring
tags: [studio, barrel, disclosure, agent-profile, boundary, import-graph, tdd]
requires:
  - phase: 08
    provides: "composeDisclosure + STATE_RULES, AgentProfile/ProfileInput, profile-repo getProfile, BrandPreview, logo-url, SAMPLE_AGENT_PROFILE (core fixture), effectiveBrandColors (@tran/brand), scripts/agent-boundary.test.ts"
  - phase: 09-01
    provides: "formatDisclosure, missingFor, DisclosureProfile/Variant/Field, PrintDisclosure, LICENSE_TYPE_OPTIONS"
  - phase: 09-02..09-06
    provides: "allowed-numbers, listing-facts, unsupported-claims, snapshot-metrics, snapshot-facts, social-sections, reel"
  - phase: 09-09
    provides: "studio route skeletons under routes/(app)/agent/studio (make the boundary exclusion non-vacuous)"
provides:
  - "@tran/core/studio barrel (packages/core/src/studio/index.ts) re-exporting all nine Phase 9 core modules"
  - "composeDisclosure(p, { variant: 'ad-inline' | 'ad-block' | 'print' }) -> DisclosureResult & { print?: PrintDisclosure }; StudioDisclosureRequest, StudioDisclosureResult types"
  - "toDisclosureProfileCore(p: ProfileInput): DisclosureProfile (exported from @tran/core/disclosure)"
  - "$lib/features/shared/agent-profile: loadAgentProfile, toDisclosureProfile, isProfileComplete, SAMPLE_AGENT_PROFILE, effectiveBrandColors, BrandPreview, logoObjectUrl"
  - "$lib/features/shared/agent-profile/logo-url: logoObjectUrl, base64ToBytes"
  - "scripts/agent-boundary.test.ts: isStudioPath-scoped agent entries + non-vacuity + unit cases"
affects: [09-11, 09-12, 09-13, 09-14, 09-15, 09-16, 09-17, 09-18, 09-21, 09-22, 09-23]
tech-stack:
  added: []
  patterns:
    - "Object-form overload on an existing function keeps every Phase 8 string-context call byte-identical"
    - "Shared feature module re-exports a core fixture instead of copying it (single sample-profile source)"
    - "Dexie loaded by dynamic import inside loadAgentProfile so prerendered routes can import the module"
key-files:
  created:
    - packages/core/src/studio/index.ts
    - packages/core/src/studio/barrel.test.ts
    - apps/web/src/lib/features/shared/agent-profile/index.ts
    - apps/web/src/lib/features/shared/agent-profile/agent-profile.test.ts
  modified:
    - packages/core/src/disclosure/compose.ts
    - packages/core/src/disclosure/compose.test.ts
    - apps/web/src/lib/features/shared/agent-profile/BrandPreview.svelte (git mv from features/agent/profile)
    - apps/web/src/lib/features/shared/agent-profile/logo-url.ts (git mv from features/agent/profile)
    - apps/web/src/lib/features/agent/profile/logo-pipeline.ts
    - apps/web/src/lib/features/agent/profile/LogoUpload.svelte
    - apps/web/src/routes/(app)/agent/profile/+page.svelte
    - scripts/agent-boundary.test.ts
key-decisions:
  - "Barrel uses extensionless re-exports (as alerts/backup barrels do) so the acceptance literal `export * from './disclosure-format'` matches; no export-name clash exists (social-sections' SocialPlatform is module-private), so social-sections.ts is unchanged"
  - "Studio license-type labels per the plan: salesperson -> Licensed Real Estate Salesperson, associate-broker -> Licensed Associate Real Estate Broker, broker -> Licensed Real Estate Broker; the Phase 8 enum's 4th value sales-associate -> Sales Associate (a LICENSE_TYPE_OPTIONS label); unknown strings pass through"
  - "toDisclosureProfileCore formats both phones the way Phase 8 does (normPhoneUS + formatPhoneUS, unparseable values kept as typed) and upper-cases the license state"
  - "Object-form results keep the Phase 8 DisclosureResult shape: missing is mapped back to Phase 8 ProfileField names in canonical order (fullName -> name), rule = ruleFor(state).id, warnings carries 'ny-title' exactly as the string form does"
  - "Sample agent stays single-sourced in packages/core/src/agent/fixtures/sample-profile.ts (core tests import it; already a scanned fixtures/ path); the shared module re-exports it rather than moving or copying it"
  - "logo-url.ts moved with BrandPreview (BrandPreview imports it and features/shared may not import a portal folder); base64ToBytes moved into it and logo-pipeline.ts re-exports it, so its tests and callers are unchanged"
  - "The profile page imports BrandPreview by file path, not through the shared barrel, so the CRM import graph only reaches BrandPreview + logo-url"
  - "ESLint unchanged: Phase 8 has no rule banning features/studio -> features/agent, so no lintText case was added (09-18's studio import-graph test covers it, as the plan directs)"
requirements-completed: []
duration: ~22min
completed: 2026-10-07
---

# Phase 9 Plan 10: Studio barrel, composer variants, shared agent-profile, boundary scope Summary

**`@tran/core/studio` now exports every Phase 9 core module. `composeDisclosure(profile, { variant })` serves the ad-inline / ad-block / print studio formats through `formatDisclosure`, and every Phase 8 string-context call returns exactly what it did before. `$lib/features/shared/agent-profile` gives the Studio the profile, brand colors, BrandPreview, logo URLs and the sample agent without touching the agent CRM folder. The Phase 8 "agent spends zero RentCast calls" boundary test is scoped to exclude the Studio, and mutation runs prove it still bites.**

## Performance

- **Duration:** about 22 min (single core, sole executor)
- **Started:** 2026-10-07T10:33Z
- **Completed:** 2026-10-07T10:55Z
- **Tasks:** 2
- **Files:** 4 created, 8 modified (2 of them moved with `git mv`)

## Accomplishments

- **Barrel:** `packages/core/src/studio/index.ts` re-exports disclosure-format, team-name, allowed-numbers, listing-facts, unsupported-claims, snapshot-metrics, snapshot-facts, social-sections and reel. `@tran/core/studio` resolves through the existing `"./*": "./src/*/index.ts"` export, so `package.json` is unchanged. `barrel.test.ts` checks 19 names.
- **Composer overload:** the TypeScript overloads keep `composeDisclosure(p, ctx?, opts?) : DisclosureResult` and add `composeDisclosure(p, { variant }, opts?) : DisclosureResult & { print?: PrintDisclosure }`. The object form maps the profile with `toDisclosureProfileCore` and delegates to `formatDisclosure(...)`. The string path is untouched apart from the dispatch line.
- **Shared module:** `features/shared/agent-profile/index.ts` contains `loadAgentProfile` (dynamic import of the Phase 8 profile repo), `toDisclosureProfile`, `isProfileComplete(p, variant)` (null-safe, built on `missingFor`), and re-exports of `SAMPLE_AGENT_PROFILE`, `effectiveBrandColors`, `BrandPreview` and `logoObjectUrl`.
- **Boundary test:** the agent entries are features/agent/**, routes/(app)/agent/**, lib/leads and the public routes, minus `isStudioPath` (`/lib/features/studio/` or `/routes/(app)/agent/studio/`). The lib/data assertion, the `lib/data/tables.ts` leaf exemption and its leaf/no-network test, the public-route test, the planted two-hop control and the sms: check are all unchanged. New tests: the exclusion removes at least one real file and only files under the studio routes, plus 9 `isStudioPath` unit cases (including `/agent/studiox/` and `features/agent/studio-notes.ts` as negatives).

## Task Commits

1. **Task 1: studio core barrel and composer ad/print variants:** `d224c2b` (feat)
2. **Task 2: shared agent-profile access and studio-aware boundary test:** `c727636` (refactor)

Both commits were made with an explicit pathspec, and `git show --stat` lists only this plan's files.

## Verification

- `vitest run --project core`: 85 files, **2652 passed**. This includes the 19-case barrel test, 8 new compose cases, and every pre-existing compose and email-footer test unchanged. `git diff` on compose.test.ts removes only the one import line, which was widened; no assertion changed.
- `vitest run --project web`: 140 files, **2114 passed** (agent-profile 8, logo-pipeline, profile-repo).
- `vitest run --project scripts`: 14 files, **504 passed** (agent-boundary 9).
- `vitest run --project brand --project web-browser`: **272 passed** across 33 files. The first combined run reported 1 failure under load. A standalone web-browser rerun and a second combined run were both fully green. This plan changes no browser-test code.
- `pnpm check`: 0 errors, 0 warnings (2537 files). `pnpm lint` (prettier + eslint, repo-wide): clean. `pnpm guard`: passed (1501 files). `pnpm banned`: passed. `pnpm ui:guard`: passed.
- `build:root` and `build:sub` both pass. `csp:assert`: 38 pages per base.
- Playwright `agent-profile-brand.spec` and `agent-profile.spec` (root, `--workers=1`): **12 passed**, so the moved BrandPreview and logo upload still render on the profile page. `apps/web/test-results` was deleted.
- Acceptance greps:
  - `grep -rln "features/agent" apps/web/src/lib/features/shared` finds nothing.
  - `git ls-files | grep -c BrandPreview.svelte` is 1.
  - The boundary test contains `agent/studio` and `features/studio`.
  - The required barrel and composer literals are present.
  - All new and changed .ts files are ASCII-only.
- **Boundary mutation proofs.** Each planted file was temporary and never staged, and each edit was restored from a copy:
  - M1: a planted `features/agent/zz-planted.ts` importing `$lib/data` fails the lib/data test.
  - M2: the same import planted under `routes/(app)/agent/studio/` passes (excluded).
  - M3: the same import planted under `routes/(app)/agent/profile/` fails.
  - M4: a `$lib/data` import added to the moved shared `logo-url.ts` fails, because the CRM graph still reaches the shared files it uses.
  - M5: `isStudioPath` forced to false fails the non-vacuity test and the unit cases.
  - M6: `isStudioPath` broadened to `/agent/` fails both new tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Moved logo-url.ts with BrandPreview and re-homed base64ToBytes**
- **Found during:** Task 2
- **Issue:** BrandPreview imports `./logo-url`, and logo-url imported `base64ToBytes` from `features/agent/profile/logo-pipeline`. `features/shared` may not import a portal folder (eslint `SHARED_NO_PORTALS`), and the acceptance grep forbids `features/agent` anywhere under `features/shared`.
- **Fix:** `git mv` logo-url.ts into `features/shared/agent-profile/` and moved the 5-line `base64ToBytes` into it. `logo-pipeline.ts` re-exports it so its tests and API stay the same. `LogoUpload.svelte` imports the shared path. No other plan lists these files.
- **Commit:** `c727636`

**2. [Plan conditional] Sample profile not moved; the web fixture file was not created**
- The plan moves the sample agent only if it lives under `lib/data/**` or `features/agent/**`. It lives in `packages/core/src/agent/fixtures/sample-profile.ts`, which is already a scanned `fixtures/` path and is imported by core tests (schemas, email-footer). Core cannot import web code, so moving it would mean keeping two copies. The shared index re-exports it instead.
- Consequence: the acceptance grep `grep -rn "Avery Sample" apps/web/src ... | grep -v test` lists 0 web files, not 1. Repo-wide, the single source is the core fixture. It already uses `licenseType: 'salesperson'` (maps to "Licensed Real Estate Salesperson"), `(555) 555-01xx` phones and `@example.com`, so it needed no edit. `apps/web/.../fixtures/sample-profile.ts` from files_modified was not created.
- The interface sketch said `SAMPLE_AGENT_PROFILE: AgentProfile` with `sample: true`. The shipped Phase 8 constant is a `ProfileInput`, which has no `sample` field and no Syncable stamps. The shared API therefore takes `ProfileInput`, and `AgentProfile` is assignable to it.

**3. Planner Note 7 contingency not needed:** the Phase 8 profile already has `licenseType`, `teamName` and `brokeragePhone`. There was no schema, Dexie or backup change.

**Total deviations:** 1 auto-fixed (Rule 3), 1 plan conditional applied as written. No scope creep.

## Open question for review

- The studio license labels are fixed and NY-safe, as the plan specifies. In other states they can differ from the Phase 8 per-state titles: for example, an FL salesperson's studio line reads "Licensed Real Estate Salesperson" while the Phase 8 email line reads "Sales Associate". This follows 09-01's union-format decision, but counsel or the 09-23 gate may want state-specific studio titles.

## Requirements

STU-01..04 were not marked complete. Per the briefing, the 09-23 phase gate closes requirement ids.

## Known Stubs

None. Every export is wired to shipped code.

## Self-Check: PASSED
