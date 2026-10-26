---
phase: 11-zillow-sponsored-listing-filter-extension
plan: 07
subsystem: extension-distribution
tags: [github-actions, release, actionlint, edge-add-ons, privacy, docs]

requires:
  - phase: 11
    provides: "11-01 zip name template (sponsored-listing-filter-{{packageVersion}}-{{browser}}.zip), COPY strings, PRIVACY_URL"
  - phase: 02
    provides: "/legal/privacy/ page inside LegalPage, banned-terms CLI"
provides:
  - "Tag-triggered (ext-v*), variable-gated (EXTENSION_RELEASES_ENABLED) release workflow publishing the zip + SHA256SUMS.txt via gh release create --verify-tag"
  - "scripts/actionlint.mjs lints every .github/workflows/*.yml|*.yaml by default, fails closed on an empty list"
  - "docs/EXTENSION-INSTALL.md load-unpacked + checksum + update guide (also the release notes)"
  - "apps/extension/store/edge-listing.md paste-ready Partner Center copy"
  - "#browser-extension section on /legal/privacy/ (the PRIVACY_URL target)"
affects: [11-06, 11-12]

tech-stack:
  added: []
  patterns:
    - "Release gate test reads the workflow as text and asserts every uses: SHA is already pinned in ci.yml"
    - "Docs tests collapse whitespace before matching Svelte prose (Prettier wraps at 100)"

key-files:
  created:
    - .github/workflows/extension-release.yml
    - scripts/extension-release-gate.test.ts
    - scripts/extension-docs.test.ts
    - docs/EXTENSION-INSTALL.md
    - apps/extension/store/edge-listing.md
  modified:
    - scripts/actionlint.mjs
    - apps/web/src/routes/(marketing)/legal/privacy/+page.svelte

key-decisions:
  - "11-07: The release workflow's header comment does not name EXTENSION_RELEASES_ENABLED, so the variable appears exactly once (on the release job's if: line)"
  - "11-07: The privacy section is appended after Contact, inside LegalPage; the page's updated date (13 October 2026) is left unchanged because marketing.spec.ts pins it — owner may bump it at launch"
  - "11-07: Release notes reuse docs/EXTENSION-INSTALL.md (--notes-file), so every release carries the install and checksum steps"

patterns-established:
  - "Any new workflow file is linted automatically by pnpm lint:workflows (no per-file list to maintain)"

requirements-completed: [EXT-04]

duration: 14min
completed: 2026-10-26
---

# Phase 11 Plan 07: Extension Distribution and Privacy Section Summary

**Dormant `ext-v*` release workflow (ci.yml SHA pins, no cache, no persisted credentials, `--verify-tag`, SHA256SUMS.txt) gated on `EXTENSION_RELEASES_ENABLED`, actionlint over every workflow, a load-unpacked install guide, paste-ready Edge Add-ons copy, and the `/legal/privacy/#browser-extension` section the popup links to.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-26T02:33:00Z
- **Completed:** 2026-10-26T02:46:18Z
- **Tasks:** 2 (each TDD: RED + GREEN)
- **Files modified:** 7

## Accomplishments

- `.github/workflows/extension-release.yml` runs only on an `ext-v*` tag push when the repository variable is `'true'`. It checks that the tag matches `apps/extension/package.json`'s version, runs the extension tests, zips, runs the 11-06 oracle with `--zip-dir`, writes SHA256SUMS.txt and publishes with `gh release create --verify-tag`, using only `github.token`.
- `scripts/extension-release-gate.test.ts` has 15 text-level invariants covering the trigger, the single-line gate, permissions, token use, SHA reuse from ci.yml, no cache, concurrency, step order and the actionlint default list.
- `pnpm lint:workflows` now lints both `ci.yml` and `extension-release.yml`.
- `scripts/extension-docs.test.ts` has 13 tests over the install guide, the Edge listing and the privacy section.

## Task Commits

1. **Task 1 RED: failing release gate tests**: `2537cef` (test)
2. **Task 1 GREEN: gated release workflow + actionlint over all workflows**: `19baefd` (feat)
3. **Task 2 RED: failing docs tests**: `d94962f` (test)
4. **Task 2 GREEN: install guide, Edge listing, privacy section**: `35c025e` (docs)

## Verification

- `corepack pnpm vitest run --project scripts`: 23 files, 764 tests passed.
- `corepack pnpm vitest run --project extension`: 12 files, 178 tests passed. `copy-banned` now scans `store/edge-listing.md` and `docs/EXTENSION-INSTALL.md`.
- `corepack pnpm lint:workflows`: exit 0 on both workflows.
- `corepack pnpm banned`: passed (446 files).
- `corepack pnpm --filter web check`: 0 errors and 0 warnings.
- Prettier and ESLint are clean on every file this plan touched.
- Mutation checks (not committed):
  - Adding `cache: pnpm` to the release setup-node step turned the gate test red.
  - Adding a bogus job key to `extension-release.yml` made `lint:workflows` fail and point at that file, which proves the new default list covers it.
- Grep acceptance checks:
  - The banned-word count in `EXTENSION-INSTALL.md` is 0.
  - The other-browser count in `edge-listing.md` is 0.
  - `cache:` appears 0 times in the release workflow.

## Decisions Made

See key-decisions in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Gate-variable name in a comment broke the "exactly once" invariant**
- **Found during:** Task 1 GREEN
- **Issue:** The first draft's header comment named `EXTENSION_RELEASES_ENABLED`, so the gate test counted the name twice.
- **Fix:** Reworded the comment to refer to "the repository variable named in the release job's if: line".
- **Commit:** 19baefd

**2. [Note] Line-based grep of the privacy notice**
- Prettier (printWidth 100) wraps ¶3 of the privacy section, so a literal line grep for `Not affiliated with or endorsed by Zillow Group.` in the `.svelte` file does not match on one line. The plan's test compares the whitespace-collapsed source, as the plan directs, and that test passes. The rendered text is exact. No prettier-ignore was added.

**Total deviations:** 1 auto-fix, 1 note. **Impact:** none on scope.

## Issues Encountered

- `corepack pnpm check` (recursive) failed in `apps/extension` with errors in `packages/brand/src/index.ts` and `apps/extension/tests/icons.test.ts`. Those files belong to parallel wave-2 plans that were still in progress. They are out of scope and were not touched. The web check, which covers this plan's only `.svelte` change, is clean.

## Owner Follow-ups (HUMAN-UAT, owned by 11-12's DEPLOY-CHECKLIST update)

- Create the remote and the org. Then set the repository variable `EXTENSION_RELEASES_ENABLED=true` and push an `ext-v0.1.0` tag.
- Edge Partner Center: paste `apps/extension/store/edge-listing.md`, upload `store/edge-logo-300.png` and add screenshots.
- Replace the Edge Add-ons placeholder in `docs/EXTENSION-INSTALL.md` with the live listing link.
- Optionally bump the privacy page's `updated` date at launch. `apps/web/tests/e2e/marketing.spec.ts` pins the current date, so update the two together.

## Known Stubs

- `docs/EXTENSION-INSTALL.md` "Install from Microsoft Edge Add-ons" contains a deliberate placeholder sentence until the owner's listing is live (UI-SPEC-mandated).
- `edge-listing.md` references `store/edge-logo-300.png`, which is produced by the icons plan; screenshots are an owner item.

---
*Phase: 11-zillow-sponsored-listing-filter-extension*
*Completed: 2026-10-26*

## Self-Check: PASSED

All 5 created files exist; commits 2537cef, 19baefd, d94962f, 35c025e are present. EXT-03 is not marked complete here (popup notice lands in the popup plan); this plan supplies only its privacy-URL target.
