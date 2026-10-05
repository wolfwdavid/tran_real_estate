---
phase: 06-renter-portal
plan: 05
subsystem: guardrails
tags: [eslint, banned-terms, service-worker, leaflet, supercluster, osm, renter]
requires:
  - phase: 02-02
    provides: banned-terms rules + CLI (fail-closed, no allowlist)
  - phase: 03-09
    provides: allowlist-only same-origin service worker + static guard test
  - phase: 04-07
    provides: DATA_INTERNALS merged into every no-restricted-imports entry
  - phase: 05-10
    provides: lib/ai no-auto-send block with distinct rule names
provides:
  - MAP_LIBS lint boundary (leaflet/supercluster only in lib/features/shared/listings/map)
  - features/shared never imports a portal folder
  - shared/affordability is storage/data/AI/portal-free (Phase 10 marketing reuse)
  - RENTER_BANNED honesty phrases scoped to RENTER_SCOPES; SCOPE extended to 3 renter/shared folders
  - service-worker guard pins that tile.openstreetmap.org is never handled
affects: [06-19 map tab, 06 renter features, 10 marketing affordability page]
tech-stack:
  added: []
  patterns:
    - "MAP_LIBS merged into every no-restricted-imports entry + a first catch-all; the map folder override comes LAST and drops it"
    - "restricted(...patterns) helper for no-restricted-imports entries"
    - "Path-scoped banned lists: findBanned applies RENTER_BANNED only when file starts with a RENTER_SCOPES prefix"
key-files:
  created: []
  modified:
    - eslint.config.js
    - scripts/eslint-rules.test.ts
    - scripts/lib/banned-terms-rules.mjs
    - scripts/banned-terms.test.ts
    - scripts/service-worker-guard.test.ts
key-decisions:
  - "New MAP_LIBS catch-all covers ALL apps/web/src files (including lib/data, which the DATA_INTERNALS catch-all ignores); every later entry, including storage, marketing, portals, shared, affordability and lib/ai, repeats MAP_LIBS"
  - "shared/affordability is in SCOPE (global list) but NOT in RENTER_SCOPES, matching the plan: it is reused on a marketing page"
  - "overpriced/underpriced also match the hyphenated form; plural forms accepted for deal/value/report"
  - "service-worker.ts untouched: the existing origin early return already ignores OSM tiles; the guard now pins that and that it precedes respondWith"
requirements-completed: []
duration: ~20min
completed: 2026-10-05
---

# Phase 6 Plan 05: Renter guardrails (map libs, shared boundaries, renter banned terms, OSM tiles) Summary

**Leaflet and supercluster are lint-confined to `lib/features/shared/listings/map`, shared features cannot reach a portal, the affordability calculator cannot touch storage/data/AI, renter copy is scanned for the 11 Phase 6 honesty phrases, and the service worker provably never handles OSM tiles.**

## Performance
- Duration: ~20 min
- Completed: 2026-10-05
- Tasks: 2/2
- Files modified: 5

## Accomplishments
- `eslint.config.js`: `MAP_LIBS`, `PORTAL_FOLDERS`, `SHARED_NO_PORTALS`, `restricted()` helper; MAP_LIBS catch-all first, merged into data catch-all, storage, marketing, all three portals, lib/ai; new `features/shared/**` and `features/shared/affordability/**` entries; `shared/listings/map/**` override placed last (keeps portal + DATA_INTERNALS bans, drops MAP_LIBS).
- `scripts/eslint-rules.test.ts`: 22 new in-memory cases (8 rejection paths incl. lib/data and lib/ai, map-folder allow, map-folder still portal/data-banned, affordability 3-error and allow cases, per-portal shared/affordability bans, regressions).
- Mutation-checked 5 ways (portal entry without MAP_LIBS, no catch-all, no shared portal ban, affordability without storage ban, map override keeping MAP_LIBS): every mutation failed at least one test; config restored.
- `banned-terms-rules.mjs`: SCOPE +3 folders (real scan 79 -> 95 files, passes), `RENTER_SCOPES`, `RENTER_BANNED`; `findBanned` output format unchanged.
- `banned-terms.test.ts`: planted "This unit is still available" non-vacuity, scoping negative, line-wrap, all-scopes positives, exact 11-label list, UI-SPEC negatives, SCOPE contents, CLI planted renter route + CLI scan of each new folder. Mutations (drop RENTER_BANNED: 12 fail; apply unscoped: 2 fail).
- `service-worker-guard.test.ts`: OSM describe (origin early return precedes `respondWith`, no `openstreetmap`/`https://` in worker, tile host cross-origin to deployed and test origins, planted tile cache rule caught).

## Task Commits
1. Task 1: lint boundaries for map libraries and shared renter components - `fc3d484`
2. Task 2: renter banned terms and no offline map tiles - `7d5ed48`

## Requirements advanced
RENT-02 (map tab library boundary + OSM tile policy) and RENT-08 (renter honesty copy). Not marked complete; they close at the 06-22 gate.

## Deviations from Plan
None in substance. Additive extras: MAP_LIBS also merged into the lib/storage/*.ts and lib/ai entries (both set no-restricted-imports and would otherwise drop it), with test cases for lib/storage, lib/data and lib/ai.

## Verification
- `corepack pnpm vitest run --project scripts eslint-rules` 68/68; `banned-terms service-worker-guard` 75/75
- `node scripts/banned-terms.mjs` passes (95 files); `corepack pnpm check` 0 errors; prettier clean on my files; `grep -c https:// apps/web/src/service-worker.ts` = 0
- Repo-wide `eslint .` / `test:unit`: only failures are in other in-flight wave-1 plans' files (06-04 RenterNav mustaches + assert-csp build drift, 06-06 artifacts/panel subjectId tests + outreach test formatting, core/renter contact-links no-useless-escape, precommit HEAD-move flake). None caused by this plan's rules.

## Known Stubs
None.

## Next Phase Readiness
06-19 can import leaflet/supercluster (lazily) only from `lib/features/shared/listings/map/`. Any new no-restricted-imports entry on apps/web/src must repeat MAP_LIBS (and DATA_INTERNALS) and sit BEFORE the map override.

## Self-Check: PASSED
