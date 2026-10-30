---
status: superseded
superseded_by: .planning/HUMAN-UAT.md
phase: 11-zillow-sponsored-listing-filter-extension
source: [11-VALIDATION.md, 11-RESEARCH.md, 11-03-SUMMARY.md, 11-07-SUMMARY.md, 11-11-SUMMARY.md]
started: 2026-10-26T03:45:00Z
updated: 2026-10-26T03:45:00Z
---
> Superseded on 2026-10-30 by `.planning/HUMAN-UAT.md` (Phase 13 ledger). This file is kept as history; record results in the ledger.

## Current Test

[awaiting human testing. Items 1-3 need only the owner's browser and the local production build. Items 4-7 gate a PUBLIC release (store listing, GitHub Release), not the build. Items 5 and 7 are also blocked on the deferred GitHub org / remote (Phase 1 deferred item; the repo has NO remote today). None of these block the phase: every locally verifiable behaviour already passes in `corepack pnpm verify`.]

Build the artifact once before items 1-2: `corepack pnpm ext:build` writes the unpacked production
extension to `apps/extension/.output/chrome-mv3/` and the store/release zip to
`apps/extension/.output/sponsored-listing-filter-0.1.0-chrome.zip`. Load it from
`chrome://extensions` (or `edge://extensions`) with Developer mode on and **Load unpacked**,
following `docs/EXTENSION-INSTALL.md`.

## Tests

### 1. Live zillow.com smoke (Chrome + Edge)
expected: With the production build loaded unpacked, open a **rentals** search and a **for-sale** search for Brooklyn, NY on zillow.com.
- The interleaved ad-slot list items (`li[data-testid="search-list-first-ad"]`, `search-list-second-ad`, `search-list-third-ad`) are dimmed, each with a working reveal pill: one click shows the slot at full opacity, a second click dims it again, and the click never opens the listing underneath.
- Dimming survives scrolling the virtualized results list (recycled `li` nodes never leave an organic card dimmed), going to page 2, changing a filter, and any other in-page navigation.
- The popup count matches the toolbar badge and the number of dimmed items on the page; the On/Off switch un-dims and re-dims everything in place.
- Today the ad slots are the ONLY items expected to dim. On 2026-10-25 an inspection of live Brooklyn rentals and for-sale results found no card with a visible "Sponsored" or "Featured" label, so a page with zero dimmed cards outside the ad slots is correct behaviour, not a bug. Paid "Featured" rentals can carry no visible label at all, and the extension never reads Zillow's page JSON (that would be listing-data extraction). This is a documented limitation.
- Record every visible paid label text seen on cards (exact strings) and whether ad slots appeared. If labels differ from `apps/extension/src/lib/selectors.v1.json`, update that file (and bump its `observed` field) through `/gsd:quick`.
result: [pending — owner action, non-blocking]

### 2. Zero-network check in a real browser session
expected: During a browsing session on zillow.com (search, scroll, page 2, toggle the popup switch, reveal a card):
- `chrome://extensions` → the extension's **service worker** link → DevTools **Network** tab stays empty.
- The popup's own inspector (right-click the popup → Inspect) shows no requests.
- In the zillow.com tab's DevTools Network tab, no request has an initiator under `chrome-extension://<id>/content-scripts/…` (filter or sort by Initiator).
The automated E2E already proves this on a synthetic page with planted controls (11-11); this item confirms it on the live site.
result: [pending — owner action, non-blocking]

### 3. Owner decision: dim the "Showcase" badge?
expected: "Showcase" is Zillow's paid listing-enhancement product (seen as a badge on live Brooklyn results on 2026-10-25). It is outside the locked v1 vocabulary, so it is opt-in only today: `selectors.v1.json` lists it under `optInLabels`, the detector supports `optIn: ['showcase']`, and nothing exposes that switch in v1. Decide one of:
- **Keep excluded** (current behaviour; Showcase listings are real listings, just promoted), or
- **Add to the default vocabulary** (move it from `optInLabels` into `labels` via `/gsd:quick`; the fixture tests that assert Showcase is not dimmed by default must flip with it).
Record the decision here and in `.planning/PROJECT.md` Key Decisions.
result: [pending — owner decision, non-blocking]

### 4. Read the current Zillow Terms of Use before any public release
expected: The owner reads the CURRENT Zillow Terms of Use in a browser (automated fetch returns 403, so this cannot be automated) and records here the page's "Updated" date and the exact §5 Prohibited Use wording. The archived text (snapshot 2026-05-02, "Updated October 28, 2025") forbids users to "reproduce, modify, distribute, display … any portion of the Services". A hide-only, local, presentation-only extension is a grey zone under "modify". Make a go/no-go decision BEFORE submitting to any store or publishing a GitHub Release. This blocks the public release, not the build. If Zillow objects later, the recovery is to delist and rename.
result: [pending — owner action, blocks public release only]

### 5. Privacy URL is live
expected: `https://tranrealestate.github.io/legal/privacy/#browser-extension` loads and scrolls to the "Sponsored Listing Filter browser extension" section. It depends on Phase 1 Pages enablement (docs/DEPLOY-CHECKLIST.md Steps 1-7). This URL is the `PRIVACY_URL` constant the popup links to and the value for the Edge Partner Center privacy-policy field, so confirm it before item 6.
result: [pending — requires the org, the remote and Pages]

### 6. Microsoft Edge Add-ons listing (Partner Center)
expected: Create a free Microsoft Edge Add-ons Partner Center developer account. Submit `sponsored-listing-filter-<version>-chrome.zip` with:
- the listing copy from `apps/extension/store/edge-listing.md` (description 250-10,000 characters; single-purpose description; a justification for each permission, `storage` and the zillow.com host; remote code "No"; data collection "none"),
- the logo `apps/extension/store/edge-logo-300.png`,
- screenshots at 640×480 or 1280×800 of the popup and of a dimmed card,
- the privacy URL from item 5.
Certification takes up to 7 business days. Once live, replace the placeholder sentence under "Install from Microsoft Edge Add-ons" in `docs/EXTENSION-INSTALL.md` with the listing link (keep the copy within the banned-words gate, which `pnpm verify` checks).
result: [pending — owner action, non-blocking]

### 7. Enable GitHub Releases and publish `ext-v0.1.0`
expected: After the GitHub org and remote exist (Phase 1 deferred item; there is NO remote today), set the repository variable `EXTENSION_RELEASES_ENABLED=true` (Settings → Secrets and variables → Actions → Variables) and push the tag `ext-v0.1.0` (it must match `apps/extension/package.json` `version`). The `extension-release` workflow builds, tests and oracle-checks the extension, then publishes a GitHub Release with `sponsored-listing-filter-0.1.0-chrome.zip` and `SHA256SUMS.txt`. Download both, confirm `sha256sum -c SHA256SUMS.txt` passes, then load the downloaded zip unpacked once.
result: [pending — requires the remote; owner action, non-blocking]

### 8. Firefox Add-ons listing
expected: Optional and explicitly below the cut line: Firefox Add-ons is CUT for v1 per ROADMAP cut line (2). When un-deferred it needs `browser_specific_settings.gecko.id`, a `data_collection_permissions` manifest key, and `wxt zip -b firefox` (which also builds a sources zip).
result: [skipped — cut per ROADMAP cut line (2); not required for v1]

## Summary

total: 8
passed: 0
issues: 0
pending: 7
skipped: 1
blocked: 0

## Gaps

None recorded. These items are deferred owner actions and decisions, not defects. Every locally verifiable behaviour behind them passes in the composed `corepack pnpm verify` run (11-12): the extension unit suite (detector, reconcile, observer, reveal pill, popup model, badge, settings, banned copy), the production build + zip, the manifest/bundle/zip zero-network oracle (`scripts/assert-extension.mjs`, mutation-tested), the popup axe suite in real Chromium, and the runtime E2E with the production extension loaded (dimming, reveal, SPA navigation, popup count, zero-network session with planted controls).
