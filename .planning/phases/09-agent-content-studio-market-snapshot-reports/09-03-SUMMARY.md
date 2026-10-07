---
phase: 09-agent-content-studio-market-snapshot-reports
plan: 03
subsystem: studio-core
tags: [studio, listing, whitelist, validation, fair-housing, unsupported-feature, tdd]
requires:
  - "Nothing beyond Phase 1 (pure packages/core/src/studio module)"
provides:
  - "packages/core/src/studio/listing-facts.ts: LISTING_FEATURES, NEARBY_AMENITIES, PROPERTY_TYPES_STUDIO, LENGTH_WORDS, ListingFacts, ListingFeature, NearbyAmenity, StudioPropertyType, ListingTone, ListingLength, LISTING_FACT_KEYS, ListingFactErrors, ListingFactsResult, validateListingFacts(input, now), pickListingFacts(f), listingFreeText(f)"
  - "packages/core/src/studio/unsupported-claims.ts: FeatureConcept, FEATURE_VOCAB (48 concepts), CHIP_CONCEPTS, UnsupportedHit, UnsupportedFacts, findUnsupportedFeatures(text, facts)"
affects: [09-listing prompt (listing.v1), listing route postChecks, 09-23 phase gate]
tech-stack:
  added: []
  patterns:
    - "Closed key whitelist: any own key outside LISTING_FACT_KEYS fails the whole input (errors._unknown = 'Unsupported fact.', unknownKeys listed in input order)"
    - "Clock injected as a parameter (now: Date) for the year-built bound; no argless Date in the module"
    - "One regex per vocab concept, terms longest-first, flags giu, Unicode letter/number lookaround boundaries, inner spaces match \\s+"
key-files:
  created:
    - packages/core/src/studio/listing-facts.ts
    - packages/core/src/studio/listing-facts.test.ts
    - packages/core/src/studio/unsupported-claims.ts
    - packages/core/src/studio/unsupported-claims.test.ts
  modified: []
decisions:
  - "validateListingFacts returns a clean copy: strings trimmed, empty/whitespace-only/null optional values dropped, features/nearby default [] and are de-duplicated, tone defaults 'warm', length defaults 'medium' (UI-SPEC defaults)"
  - "Copy beyond the UI-SPEC list (only reachable by programmatic input, never by the form): 'Choose a tone.', 'Choose a length.', 'Enter text.' (non-string in a text field), 'Unsupported fact.' (non-object input or unknown key)"
  - "Number fields (squareFeet, garageSpaces, price, siteCharLimit): non-finite or non-number -> 'Enter a number, like 1450.', negative -> 'Use 0 or more.'; yearBuilt non-integer/out of range -> the year copy; nearby chip errors reuse 'Choose from the listed features.' per the plan"
  - "Text max lengths are inclusive and measured on the trimmed value"
  - "A concept is supported by a chip mapping OR by any of its terms appearing in any free-text string (tested with a non-global regex so lastIndex never leaks across strings)"
metrics:
  duration: "~10 min"
  completed: 2026-10-07
  tasks: 2
  files: 4
---

# Phase 9 Plan 03: Listing facts whitelist and unsupported-feature check Summary

Closed-whitelist listing facts schema with verbatim UI-SPEC validation copy, a prompt-facts picker that never carries style keys or empty values, and a deterministic 48-concept vocabulary check that flags any amenity in a listing draft the agent did not select or type.

## What was built

- **listing-facts.ts**: chip lists (16 features, 9 nearby amenities, 5 property types), `LENGTH_WORDS` (75/150/250), the 18-key `LISTING_FACT_KEYS` whitelist, `validateListingFacts(input, now)`, `pickListingFacts` (drops tone/length/siteCharLimit and empty values, keeps 0) and `listingFreeText` (otherFeatures, nearbyPlaces, anythingElse, lotSize, streetOrArea, non-empty, in that order). No neighborhood-profile field exists in the file (acceptance grep returns nothing).
- **unsupported-claims.ts**: `FEATURE_VOCAB` exactly as the plan's implementation block, `CHIP_CONCEPTS` for all 16 feature chips plus the Waterfront amenity, and `findUnsupportedFeatures` returning hits sorted by start, with overlapping matches of one concept merged. Memo-safe room names are absent from the vocabulary.

## Verification

- `vitest run --project core studio/listing-facts studio/unsupported-claims`: 2 files, 81 tests passed (60 listing-facts, 21 unsupported-claims).
- RED runs failed on the missing modules before each GREEN commit.
- `eslint` and `prettier --check` on the 4 files: clean. Repo-wide `pnpm lint`: prettier passed for all files and eslint reported nothing.
- `tsc --noEmit` for core: my files clean; the only errors are in `team-name.test.ts` (another wave-1 plan's in-progress RED file).
- `pnpm banned`: passed (348 files).
- Acceptance greps: the required strings are present; `school|crime|church|demograph` in listing-facts.ts: none; `new Date()` count: 0; `family room` in unsupported-claims.ts: none. All 4 files are ASCII-only.
- The plan-level `vitest run --project core studio` also picked up other executors' in-progress RED files (`reel.test.ts`, `team-name.test.ts`, which fail on missing modules). Those belong to concurrent plans. The other 6 studio files (158 tests) passed.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 RED | 680882b | test(09-03): add failing listing facts tests |
| 1 GREEN | c33333c | feat(09-03): listing facts whitelist and validation |
| 2 RED | da8a4ae | test(09-03): add failing unsupported-feature tests |
| 2 GREEN | 4c267ff | feat(09-03): unsupported-feature check for listing drafts |

After the orchestrator's shared-index warning, I ran `git show --stat` on all four commits. Each one contains only this plan's files, and none of my files were committed by another plan.

## Deviations from Plan

None in behavior. One small change: prettier turned a `é` escape in `unsupported-claims.test.ts` into a literal glyph, so I rebuilt the character with `String.fromCharCode(0xe9)` to keep the .ts source ASCII-only (repo rule). This went into the Task 2 GREEN commit.

## Notes for consumers

- `@tran/core` has no `./studio/*` subpath export, and this plan adds no `studio/index.ts` barrel, because neither is in files_modified. Web consumers need whichever studio barrel or export another Phase 9 plan provides, or a `./studio/*` export like the existing `./agent/*` one.
- The warn finding copy ("Not in your facts: '{matched}'. Remove it or add it to your facts.") belongs to the listing route's postCheck wiring. This module returns only offsets, the concept id and the matched text.
- I did not run `requirements mark-complete` for STU-01: the phase gate (09-23) closes requirement ids.

## Known Stubs

None.

## Self-Check: PASSED
