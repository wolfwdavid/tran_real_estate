---
phase: 17-extension-release-edge-add-ons-submission
plan: 01
subsystem: extension-release
tags: [release-gates, zip-allowlist, changelog, vitest]
requires: []
provides:
  - scripts/extension-release-checks.mjs (checkVersions, checkAncestor, probePrivacyUrl, extractNotes, summarize, CLI)
  - ZIP_ENTRY_ALLOWLIST and checkZipEntries in the oracle
  - apps/extension/CHANGELOG.md with the 0.1.0 entry
affects: [17-03 workflow wiring, 17-05 release]
tech-stack:
  added: []
  patterns: [importable pure checks returning string[] problems, injected fetch, temp git repo tests]
key-files:
  created:
    - scripts/extension-release-checks.mjs
    - scripts/extension-release-checks.test.ts
    - apps/extension/CHANGELOG.md
  modified:
    - scripts/assert-extension.mjs
    - scripts/assert-extension.test.ts
key-decisions:
  - "CHANGELOG 0.1.0 dated 2026-11-17 (UTC date of writing); owner may adjust before the tag in 17-05"
requirements-completed: []
duration: ~15min
completed: 2026-11-17
---

# Phase 17 Plan 01: Release check scripts, zip allowlist, CHANGELOG Summary

Every new release gate (version quadruple, tag-on-main ancestor, live privacy probe, changelog notes extractor, job summary) now exists as a unit-tested Node script, the oracle rejects any zip entry outside a default-deny allowlist, and `apps/extension/CHANGELOG.md` carries the 0.1.0 entry tied to package.json by test. No workflow file was touched.

## Commits

- b4cab64 feat(17-01): extension release checks and tests
- a1c4ec1 feat(17-01): default-deny zip entry allowlist in the oracle
- 4415961 feat(17-01): CHANGELOG with the 0.1.0 entry and tests

## Verification

- `pnpm vitest run --project scripts` (whole scripts project): 39 files, 1242 tests passed.
- Quick command files (release-checks, assert-extension, extension-docs, extension-release-gate): 4 files, 152 tests passed.
- `pnpm ext:build && pnpm ext:assert`: built, "Extension oracle passed (6 files scanned ..., zip root verified)"; the real zip passes the allowlist (also covered by the drift test).
- `node scripts/extension-release-checks.mjs notes --out .tools/notes-check.md` exits 0 with the Added section.
- prettier --check on the five files passes; no `shell:` in the checks script; no workflow or package.json change.

## Deviations from Plan

None to behavior. One test-authoring slip fixed before commit: a heredoc collapsed backslashes in one regex of the CHANGELOG test, caught by the test itself and rewritten with Edit.

## Notes

- `pnpm test:unit` (all projects) was not run; only the scripts project, as the task directed.
- Requirements EXT-05, EXT-06, EXT-08 are only partly delivered here (workflow wiring in 17-03), so REQUIREMENTS.md was not ticked.

## Self-Check: PASSED

Files exist and commits b4cab64, a1c4ec1, 4415961 are in git log.
