---
phase: 17-extension-release-edge-add-ons-submission
plan: 04
subsystem: extension-release
tags: [owner-gates, terms-of-use, push, repository-variable, dry-run]
requires: [17-03]
provides:
  - HUMAN-UAT L93 decided go, L92 reconfirmed
  - Phase 17 commits on origin/main with ci and live-smoke green
  - EXTENSION_RELEASES_ENABLED set to true
  - a green workflow_dispatch dry-run that created no release
affects: [17-05 tag push and submission]
key-files:
  modified:
    - .planning/HUMAN-UAT.md
key-decisions:
  - "All three screenshots, the feedback page as support contact and the 2026-11-17 changelog date are kept"
  - "Zillow Terms of Use: go (owner, 2026-11-17)"
requirements-completed: []
completed: 2026-11-18
---

# Phase 17 Plan 04: Owner gates before the tag Summary

Everything that must precede a tag is done. No tag and no release exist.

## Task 1: screenshots, support contact, changelog date, Showcase

Owner answer, verbatim: "approved as is".

- All three shots kept (`01-dimmed-results.png`, `02-reveal-card.png`, `03-popup.png`).
- Support contact stays `https://wolfwdavid.github.io/tran_real_estate/feedback/` (returns 200).
- Changelog date for 0.1.0 stays 2026-11-17.
- Showcase stays excluded from dimming (L92 reconfirmed).

No file changed.

## Task 2: Zillow Terms of Use

Owner answer, verbatim: "go" (2026-11-17).

- L93 is now `decided 2026-11-17: go`; L92 evidence carries "reconfirmed 2026-11-17 in Phase 17"; the tally moved L93 from carried to decided (decided 7, carried 6).
- `scripts/human-uat-ledger.test.ts`: 24 passed.
- Commit 6df2493.

Gap: the owner did not supply the page's "Updated" date or the quoted section 5 wording, so the L93 evidence cell says so. The plan's acceptance criterion (evidence with the Updated date) is not met until the owner supplies them.

## Task 3: push and ci

Owner approval: "Push (Recommended)" in the push dialog, 2026-11-18.

- Pre-push: status clean except the unstaged `.planning/config.json`; 0 trailers or assistant mentions in 14 commit messages; `pnpm secrets:scan` reported no leaks.
- `git push origin main`: `872999c..6df2493`.
- ci: https://github.com/wolfwdavid/tran_real_estate/actions/runs/44355647692, success at 6df24934c7b6b4c6ef0cafb0d42f3960abcba006 (guard, three build matrices, deploy).
- live-smoke for the same SHA: success.

## Task 4: repository variable

The owner sent the exact `gh variable set` command in chat; it was run as sent. Listing afterwards:

```
BASE_PATH	/tran_real_estate
EXTENSION_RELEASES_ENABLED	true
PUBLIC_SITE_URL	https://wolfwdavid.github.io
```

## Task 5: dry-run

Run: https://github.com/wolfwdavid/tran_real_estate/actions/runs/44362704933, event `workflow_dispatch`, conclusion success, head 6df24934c7b6b4c6ef0cafb0d42f3960abcba006 (the pushed SHA).

| Step | Result |
|---|---|
| Tag commit is on main | skipped |
| vitest extension project | success |
| Zip the extension | success |
| Manifest and zero-network oracle | success (6 files scanned, zip root verified) |
| Tag, package, built manifest and zip versions agree | success (versions agree: 0.1.0) |
| Live privacy URL | success (probed the live /legal/privacy/ page) |
| Checksums | success (`sponsored-listing-filter-0.1.0-chrome.zip: OK`) |
| Release notes from the changelog | success |
| Job summary | success |
| Create draft release | skipped |

`gh release list` printed nothing and `git ls-remote --tags origin 'ext-v*'` printed nothing.

## Not verified

- The job summary content (size, entry count, SHA256 value) was not read: the step log does not echo it and the CLI does not expose step summaries. The step succeeded; the values are on the run page.
- `gh release create --verify-tag` and the ancestor check with `fetch-depth: 0` on a tag-triggered run: both steps are skipped on dispatch and first run in 17-05.
- The L93 evidence gap above.
