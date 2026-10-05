---
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
plan: 06
subsystem: data
tags: [fixtures, real-data-guard, generator, determinism, ci, DATA-01]
requires: []
provides:
  - "Synthetic RentCast-shaped fixtures (metros, rentals, sales, estimates, markets, meta) at apps/web/src/lib/data/fixtures/"
  - "scripts/gen-fixtures.mjs: generateFixtureData(), renderFixtureFiles(), FIXTURE_FILES, ANCHOR, SEED; --check / --out CLI"
  - "scripts/lib/real-data-rules.mjs: FIXTURE_PATH, SAMPLE_ZIP3, ALLOWED_URL_HOST, findFixtureProblems"
  - "pnpm fixtures:check / fixtures:gen; drift check in verify and CI quality"
affects: [04 fixture-fetch adapter, 04 gateway sample mode, portal phases 6-9 sample data]
tech-stack:
  added: []
  patterns:
    - "Seeded mulberry32 generator with fixed ANCHOR; Prettier API output resolved from the canonical fixture path"
    - "Structural JSON guard for fixture files on top of the line-based email/phone scan"
key-files:
  created:
    - scripts/gen-fixtures.mjs
    - scripts/gen-fixtures.test.ts
    - scripts/fixtures-guard.test.ts
    - apps/web/src/lib/data/fixtures/metros.json
    - apps/web/src/lib/data/fixtures/rentals.json
    - apps/web/src/lib/data/fixtures/sales.json
    - apps/web/src/lib/data/fixtures/estimates.json
    - apps/web/src/lib/data/fixtures/markets.json
    - apps/web/src/lib/data/fixtures/meta.json
  modified:
    - scripts/lib/real-data-rules.mjs
    - scripts/real-data-rules.test.ts
    - scripts/workflow-gate.test.ts
    - package.json
    - .github/workflows/ci.yml
decisions:
  - "Fixture JSON rules apply only to apps/web/src/lib/data/fixtures/*.json; invalid JSON there is a guard failure"
  - "Prettier config for fixture rendering is always resolved from the canonical fixture path, so --out copies in tmp dirs format identically"
  - "Land sale listings carry null bedrooms/bathrooms/squareFootage/yearBuilt (RentCast-style not-applicable nulls)"
  - "Estimates comparables are chosen deterministically by bedroom distance then id (same metro, same kind, never the subject)"
metrics:
  duration: 7min
  completed: 2026-10-05
  tasks: 3
  files: 15
requirements: [DATA-01]
---

# Phase 4 Plan 06: Synthetic Fixtures, Guard Extension and Drift Check Summary

Seeded (20261004) mulberry32 generator emits six Prettier-stable RentCast-shaped fixture files for three fictional metros in unassigned ZIP3 prefixes 742/702/858; the real-data guard now enforces ZIP prefix, URL host, MLS and id rules on fixture JSON, and `pnpm verify` plus CI fail on any hand edit.

## What Was Built

- **Guard extension** (`scripts/lib/real-data-rules.mjs`, still pure): `FIXTURE_PATH`, `SAMPLE_ZIP3`, `ALLOWED_URL_HOST`, `findFixtureProblems` (JSON walk: `zipCode`, `zipCodes[]`, ZIPs inside `formattedAddress`, every URL host in any string, `mlsNumber` prefix `SAMPLE-`, `mlsName` = `Sample MLS`, `id` must contain a sample prefix, invalid JSON flagged). `findProblems` appends these for fixture paths after the existing line scan.
- **Generator** (`scripts/gen-fixtures.mjs`): Node built-ins + Prettier API only; no `Math.random`/`Date.now`. Output: 60 rentals, 40 sales (incl. 3 Land, 2 New Construction with builder), 100 rent + 40 sale estimates with 5 same-metro comps each, 6 ZIP markets with RentCast field names and 24 months of history (2024-10..2026-09), metros, meta. 12 rentals / 9 sales listed within 7 days of the anchor, 3 + 2 Inactive with removedDate, 26 listings with a price-change history event. All phones bare 10-digit 555-01xx, emails/URLs on example.com.
- **Tests**: `gen-fixtures.test.ts` (determinism, drift via tmp copy + spawned `--check`, missing-file drift, counts, phone shape, unique ids); `fixtures-guard.test.ts` (6 clean files + 36 planted cases: phone, email, ZIP, URL host, MLS number, id per file; all values fragment-built); `workflow-gate.test.ts` asserts the CI drift step follows `pnpm install --frozen-lockfile`.
- **Wiring**: `fixtures:check` / `fixtures:gen` scripts; `verify` runs `pnpm guard && pnpm fixtures:check`; CI quality runs `node scripts/gen-fixtures.mjs --check` after `pnpm lint`.

## Verification

- `corepack pnpm vitest run --project scripts` → 13 files, 339 tests passed
- `corepack pnpm guard` → passed (616 files); `corepack pnpm fixtures:check` → "Fixtures match generator output (6 files)"; `corepack pnpm lint` → exit 0; `corepack pnpm lint:workflows` → exit 0
- Mutation check: disabling the `findFixtureProblems` hook in `findProblems` makes 24 planted cases fail (ZIP, URL host, MLS number, id × 6 files); phone/email stay caught by the line scan. Restored afterwards.

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 RED | ad57a9e | test(04-06): add failing fixture guard rule tests |
| 1 GREEN | 3c33b79 | feat(04-06): fixture-specific real-data guard rules |
| 2 | 2a815de (swept) + 2d5226c | fixture JSON + first generator version landed in 04-04's docs commit; 2d5226c is the lint-fixed generator |
| 3 RED | a8f30a2 | test(04-06): add fixture determinism, drift and planted-PII tests |
| 3 GREEN | 826ae48 | feat(04-06): fixture drift check in verify and CI |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Existing line-scan tests used a fixture JSON path**
- **Found during:** Task 1 GREEN
- **Issue:** `scripts/real-data-rules.test.ts` used `DATA_FILE = 'apps/web/src/lib/data/fixtures/sample.json'` with plain-text bodies; once fixture JSON rules apply there, every plain-text case also reported "not valid JSON" (the plan's "existing tests keep passing unchanged" conflicted with its "invalid JSON is a problem" rule).
- **Fix:** Moved `DATA_FILE` to `apps/web/src/lib/data/samples/sample.json` (still a data-like path, so the line rules are exercised exactly as before).
- **Files modified:** scripts/real-data-rules.test.ts
- **Commit:** 3c33b79

**2. [Rule 3 - Blocking] ESLint no-unused-vars on the areaCode destructure**
- **Fix:** `omitAreaCode()` helper via `Object.fromEntries`. Commit 2d5226c.

### Process Notes

- **Shared-index race:** the six fixture JSON files and the first `gen-fixtures.mjs` were staged when a parallel executor's docs commit (2a815de, docs(04-04)) swept the shared index. Content is correct and in history; 2d5226c carries the final generator. Later commits used `git commit -- <paths>` to commit only this plan's files.
- Lint was transiently red during execution on other executors' in-progress files (`apps/web/src/lib/data/platform.ts`, `backup.test.ts`, `db.test.ts`); out of scope, and `pnpm lint` was green at the end.

## Known Stubs

None. The fixtures are the intended sample dataset; the fixture `fetch` adapter that serves them is a separate Phase 4 plan.

## Self-Check: PASSED
