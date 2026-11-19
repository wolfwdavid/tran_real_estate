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
- Owner's unpacked load: done in Chrome, not Edge (owner: "use chrome not edge please"). The owner's paste of the extensions page shows version 0.1.0, ID ghefnekmdmfebomempilhpifjjkplkfn, site access `*://*.zillow.com/*`, no errors.

### Task 4: live Zillow check (2026-11-19)

The owner asked for the check to be done for them ("do it for me please"). The extension did not run in the Chrome window the browser tools drive, so the released zip was loaded unpacked in a clean Chromium by a one-off script kept outside the repo. One page load of a Brooklyn rentals search; only the extension's own markers were read.

- (a) Dimming: 3 advertising-slot list items dimmed, 3 pills, no property card marked. The certification note ("only ad-slot items dim") is confirmed as written.
- (b) Badge "3" on the Zillow tab. Popup switch off cleared all marks and pills; on restored them. The popup's own count line was not checked (the popup was opened as a tab, where it shows the "open a Zillow search page" text).
- (c) Reveal click: not run. A Zillow bot-check overlay covered the page; it was not bypassed and no further automated loads were made.
- (d) Network: the extension's only requests were its own popup files. Captured by automation, not read from the service worker's Network tab.
- Edge: not run.
- L90 and L91 are `passed 2026-11-19` with these limits in the evidence cells.


### Task 5: publish (2026-11-19)

Owner approval: "Publish (Recommended)" in the publish dialog.

- `gh release edit ext-v0.1.0 --repo wolfwdavid/tran_real_estate --draft=false`; published 2026-11-19T17:01:11Z, not a prerelease: https://github.com/wolfwdavid/tran_real_estate/releases/tag/ext-v0.1.0
- Anonymous `curl` of both assets into a new empty folder; `sha256sum -c SHA256SUMS.txt`: OK. Zip SHA256 ec756e6d15fbca83ed5e0a69d7d34b60a0f0ee48ddb13a88a239cb680197ee27, 263998 bytes, the same as the draft.
- L96 is `passed 2026-11-19`.

### Task 7 (partial, 2026-11-19)

- The five release test files: 5 files, 193 tests passed. `docs/EXTENSION-INSTALL.md` is unchanged this phase and still holds the placeholder sentence.
- REQUIREMENTS: EXT-05, EXT-06 and EXT-08 ticked with evidence. EXT-07 stays unticked until the Partner Center submission (Task 6) is recorded. EXT-09 stays unticked with the follow-up note.

## Follow-up (does not block phase close)

When Partner Center certifies the listing (at least 7 business days after submission): copy the listing URL from the Overview page, replace the placeholder sentence under "Install from Microsoft Edge Add-ons" in `docs/EXTENSION-INSTALL.md` with a link that matches `https://microsoftedge.microsoft.com/`, run `pnpm vitest run --project scripts scripts/extension-docs.test.ts`, then update L95 to `passed <date>`.

## Not verified

- The reveal click on live Zillow, the popup count line, and Edge (see Task 4).
- L93 still lacks the Zillow terms "Updated" date and quoted wording.
