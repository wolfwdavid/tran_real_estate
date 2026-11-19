# Phase 17 Plan 05: Release and submission (in progress)

## Release record

### Task 1: preconditions (2026-11-19)

- origin/main: 6df24934c7b6b4c6ef0cafb0d42f3960abcba006, ci success (run 44355647692), live-smoke success.
- Local HEAD was one docs-only commit ahead (7da6345, the 17-04 records). Deviation from the plan's "HEAD equals origin/main" check: the tag was created on the pushed commit 6df2493 by SHA, not on local HEAD.
- L93: `decided 2026-11-17: go`.
- Gate variable: true. Dry-run 44362704933: success.
- No `ext-v*` tag locally or on the remote before tagging. Package version 0.1.0; CHANGELOG top entry 0.1.0.

### Task 2: tag and draft (2026-11-19)

Owner approval: "Tag and push (Recommended)" in the tag dialog.

- `git tag -a ext-v0.1.0 -m "ext-v0.1.0" 6df2493` and `git push origin ext-v0.1.0`.
- Run: https://github.com/wolfwdavid/tran_real_estate/actions/runs/44534979713, event `push`, success, no step skipped. "Tag commit is on main" and "Create draft release" both succeeded, which proves the two research assumptions (full-depth checkout resolves origin/main on a tag run; `--verify-tag` works).
- Draft: isDraft true, tag ext-v0.1.0, assets `SHA256SUMS.txt` and `sponsored-listing-filter-0.1.0-chrome.zip`. Body is the CHANGELOG `### Added` section, with no link-reference line and no install-guide text.
- No publish command was run.

### Task 3: download and checksum half (2026-11-19)

- `gh release download` into a new empty folder outside the repo; `sha256sum -c SHA256SUMS.txt`: `sponsored-listing-filter-0.1.0-chrome.zip: OK`.
- Zip SHA256: ec756e6d15fbca83ed5e0a69d7d34b60a0f0ee48ddb13a88a239cb680197ee27, 263998 bytes.
- Unzipped root holds `manifest.json`: name "Sponsored Listing Filter — for Zillow", version 0.1.0, permissions `storage`, host and content-script match `*://*.zillow.com/*`.
- Owner's unpacked load in Edge: pending.
