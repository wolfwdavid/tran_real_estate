# Phase 11: Zillow Sponsored Listing Filter Extension - Context

**Gathered:** 2026-10-04
**Status:** Ready for planning

<domain>
## Phase Boundary

A hide-only MV3 browser extension (`apps/extension`, WXT) that dims sponsored/promoted listing cards on Zillow search results with one-click reveal, a toolbar popup with on/off toggle + hidden count, zero network, permissions `storage` + `*://*.zillow.com/*` only, distributed as a GitHub Releases zip (load-unpacked instructions) and Microsoft Edge Add-ons. Requirements EXT-01..04. Depends on Phases 1-2 only.

</domain>

<decisions>
## Implementation Decisions

The owner chose fully autonomous mode on 2026-10-04. Recommended defaults adopted.

### Detection & behavior
- **Label-text/ARIA-first detection** ("Sponsored", "Featured", "Promoted", "Ad") within listing-card containers, plus a **versioned selectors file** (`selectors.v1.json`) as a secondary hint; no reliance on obfuscated class names alone.
- Scoped, debounced `MutationObserver` on the results container + WXT `locationchange` for SPA navigation.
- **Dim-with-reveal** default (opacity + "Sponsored — show" button injected with accessible label); the card is never removed from DOM (no layout shifts, no "hide" mode in v1).
- **Synthetic-DOM matcher tests** (Vitest + happy-dom/jsdom fixtures capturing 3+ card variants) — fixtures are hand-written HTML approximating structure, no copied Zillow markup/assets.

### Popup & branding
- Svelte popup using Phase 2 brand tokens: toggle, hidden-count, "collects nothing, sends nothing" line, "Not affiliated with or endorsed by Zillow Group" line, link to the Tran privacy page. No Zillow logo/colors.
- Name: "Sponsored Listing Filter — for Zillow" (nominative use); single purpose statement.

### Privacy & permissions
- Manifest permissions exactly `["storage"]` + host permission `*://*.zillow.com/*`; no `tabs`, no `webRequest`. A test asserts the manifest and a static scan asserts no `fetch`/`XMLHttpRequest`/`WebSocket`/`sendBeacon` in extension source. Settings stored in `chrome.storage.local`.

### Distribution
- `wxt zip` artifacts attached to GitHub Releases by a tag-triggered workflow (gated like the Pages deploy — runs only when the remote exists); `docs/EXTENSION-INSTALL.md` with load-unpacked steps; Edge Add-ons submission is an owner HUMAN-UAT item (account needed). Firefox optional/deferred.

### Owner-gated items (non-blocking)
- Manual read of Zillow Terms of Use before any public release (automated fetch 403s) — recorded as HUMAN-UAT; Edge Partner Center account.

### Claude's Discretion
- WXT version pin (verify stability at planning), debounce timing, popup layout.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 2 tokens (`packages/brand`) consumed by the popup; CI patterns (gated workflows, actionlint, gitleaks).

### Established Patterns
- pnpm workspace; Vitest per package; no network in tests.

### Integration Points
- New workspace package `apps/extension`; root `verify` runs its tests; CI matrix adds it.

</code_context>

<specifics>
## Specific Ideas

- Never scrape, extract, or transmit listing data — the extension only toggles presentation.

</specifics>

<deferred>
## Deferred Ideas

- Chrome Web Store listing (EXT-V2-02, $5), Tran-site install page (EXT-V2-01), hide mode, Firefox listing.

</deferred>
