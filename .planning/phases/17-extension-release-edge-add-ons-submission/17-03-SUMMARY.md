---
phase: 17-extension-release-edge-add-ons-submission
plan: 03
subsystem: extension-release
tags: [github-actions, release, draft, checksums, gate-test]
requires: [17-01, 17-02]
provides:
  - extension-release.yml with workflow_dispatch dry run, fetch-depth 0, tag-on-main, version quadruple, privacy probe, checksum self-check, CHANGELOG notes, job summary, draft-only release
  - extension-release-gate.test.ts pins for every step plus planted-mutant non-vacuity tests
  - DEPLOY-CHECKLIST Step 9 and RUNBOOK "Release the extension" aligned with the flow
affects: [17-04 push and dry run, 17-05 submission]
tech-stack:
  added: []
  patterns: [one-line run steps calling scripts, planted-mutant predicates in text-pin tests]
key-files:
  modified:
    - .github/workflows/extension-release.yml
    - scripts/extension-release-gate.test.ts
    - docs/DEPLOY-CHECKLIST.md
    - docs/RUNBOOK.md
    - scripts/runbook.test.ts
key-decisions:
  - "The runbook heading list is pinned in runbook.test.ts, so the new section extends that pin (twelve headings) in the same commit"
requirements-completed: []
duration: ~25min
completed: 2026-11-16
---

# Phase 17 Plan 03: Hardened extension release workflow Summary

The extension release workflow now dry-runs on manual dispatch, and on a tag push enforces tag-on-main, tag/package/manifest/zip version agreement, the zip allowlist and the live privacy probe before creating a draft-only release with CHANGELOG notes. Every step is pinned in the gate test in the same commit.

## Commits (local only, nothing pushed, no tag)

- 84f65fd ci(17-03): workflow plus extension-release-gate.test.ts (one commit)
- b6dd005 docs(17-03): DEPLOY-CHECKLIST Step 9, RUNBOOK section, runbook heading pin

## Verification at head b6dd005

| Check | Result |
| --- | --- |
| `pnpm test:unit` (full, no deploy env) | exit 0, 373 files, 7458 tests passed |
| `pnpm lint:workflows` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm ext:build` and `pnpm ext:assert` (deploy env) | exit 0, oracle passed (6 files, zip root verified) |
| prettier on touched files | clean |
| `version` with RELEASE_TAG ext-v0.1.0 / empty / ext-v0.1.1 | exit 0 / 0 / 1 (mismatch reported) |
| `notes --out` | exit 0, CHANGELOG section written |
| `sha256sum -c SHA256SUMS.txt` in apps/extension/.output | OK (gitignored folder) |
| `summary` | exit 0, 263998 bytes, 18 entries, checksum line |
| `probe` against the live site | exit 0 |
| `ancestor` locally | exit 1, HEAD not an ancestor of origin/main (expected: the commits are unpushed; the real gate runs on the tag commit in CI) |
| commit trailers, AI mentions, config.json in commits | none, 0, 0 |

Acceptance greps: workflow_dispatch 1, fetch-depth 0 1, push-only if 2, gate variable 1, `uses:` 3, no forbidden strings, no `${{` in any run line.

## Deviations from Plan

**1. [Rule 3 - Blocking] runbook.test.ts heading pin extended.** The test pins the full H1/H2 list, so adding `## Release the extension` required adding it (and renaming "eleven" to "twelve") in the same commit, as the plan allowed.

Otherwise the plan was executed as written.

## Not verified (cannot be proven locally; 17-04 dry run must check)

- `gh release create --verify-tag` semantics on a tag-triggered run.
- `fetch-depth: 0` making `origin/main` resolvable on a tag-triggered run (the ancestor step depends on it).
- Also unproven until a real run: that a dispatch run with the repo variable set passes end to end on the runner.

## Known Stubs

None.

## Self-Check: PASSED

Both commits exist (84f65fd, b6dd005); workflow, gate test, docs and SUMMARY present.
