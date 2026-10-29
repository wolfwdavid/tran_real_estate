---
phase: 11-zillow-sponsored-listing-filter-extension
verified: 2026-10-29T00:00:00Z
status: human_needed
score: 4/4 must-haves verified (automated); 7 owner rows pending
human_verification:
  - test: "Live zillow.com smoke (Chrome + Edge), rentals and for-sale (UAT 1)"
    expected: "Ad-slot li[data-testid=search-list-*-ad] items dimmed with working reveal; survives scroll, page 2, filter change; popup count matches badge"
    why_human: "Zillow DOM is not fetchable (403) and not committed"
  - test: "Zero-network check in a real session (UAT 2)"
    expected: "Service worker, popup and tab DevTools show no extension-initiated requests"
    why_human: "Automated E2E covers a synthetic page only"
  - test: "Showcase badge decision (UAT 3)"
    expected: "Owner decision recorded"
    why_human: "Product decision"
  - test: "Read current Zillow ToS before public release (UAT 4)"
    expected: "Go/no-go recorded"
    why_human: "Legal judgment"
  - test: "Privacy URL live (UAT 5)"
    expected: "Privacy page loads with the extension section"
    why_human: "Needs org, remote and Pages (Phase 1 deferred)"
  - test: "Edge Add-ons listing (UAT 6)"
    expected: "Submission accepted"
    why_human: "Owner account and certification"
  - test: "Publish ext-v0.1.0 GitHub Release (UAT 7)"
    expected: "Release has zip + SHA256SUMS.txt; downloaded zip loads unpacked"
    why_human: "Repo has no remote"
---

# Phase 11: Zillow Sponsored-Listing Filter Extension Verification Report

**Phase Goal:** A Zillow user sees listings without paid placements pushed in front of them, via a hide-only extension that collects and sends nothing.
**Verified:** 2026-10-29
**Status:** human_needed
**Re-verification:** No, initial verification

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sponsored cards dimmed with one-click reveal; detection survives dynamic updates and SPA navigation | VERIFIED (synthetic) | Source modules present: detect, observe, reconcile, reveal-host, filter, content-wiring, selectors.v1.json. `vitest --project extension` 17 files / 241 tests pass. `ext:e2e` 7/7 on the production build (dim + pill, one-click reveal without navigation, late-inserted card, SPA navigation re-acquire). Live-site behaviour is owner UAT 1. |
| 2 | Toggle on/off and count of hidden listings in the popup | VERIFIED | Popup components (FilterSwitch, CountStatus), settings.ts, badge.ts, messages.ts. E2E tests 5 and 6 cover the count message, badge, and toggle restoring the page. Browser tests 13/13 per VALIDATION (not re-run). |
| 3 | Permissions limited to storage and zillow.com; zero network; privacy and non-affiliation notices | VERIFIED | Built manifest: `permissions:["storage"]`, `host_permissions:["*://*.zillow.com/*"]`, CSP `connect-src 'none'`. `ext:assert` oracle passed (6 files scanned, zip root verified). Grep of src for fetch/XHR/sendBeacon/WebSocket/EventSource found nothing. E2E "zero network requests" passes. Notices in copy.ts (notAffiliated), edge-listing.md, and the privacy page section `#browser-extension`. |
| 4 | Installable from GitHub Releases zip (load-unpacked docs) or Edge Add-ons | VERIFIED (artifacts); publication pending | `docs/EXTENSION-INSTALL.md` exists. `.github/workflows/extension-release.yml` triggers on `ext-v*`, checks the tag against package.json version, builds the zip and SHA256SUMS, and publishes via `gh release create`. It is gated on `EXTENSION_RELEASES_ENABLED`. `apps/extension/store/edge-listing.md` and `edge-logo-300.png` are present. ci.yml runs `ext:build`, `ext:assert`, `ext:test:browser` and `ext:e2e`. Actual publication and store submission are owner rows 5-7 (the repo has no remote). |

**Score:** 4/4 truths verified at the level achievable without owner action.

## Requirements Coverage

| Requirement | Source Plans | Status | Evidence |
|-------------|--------------|--------|----------|
| EXT-01 | Declared in 11-01..11-11 plan frontmatter | SATISFIED (live smoke pending) | Truth 1 |
| EXT-02 | Declared in plan frontmatter | SATISFIED | Truth 2 |
| EXT-03 | Declared in plan frontmatter | SATISFIED | Truth 3 |
| EXT-04 | Declared in plan frontmatter | SATISFIED for artifacts; publication is owner-gated. The Firefox option is cut per the ROADMAP cut line. | Truth 4 |

All four IDs appear in plan frontmatter and are marked Complete in REQUIREMENTS.md (lines 89-92, 203-206). There are no orphaned requirements.

## Anti-Patterns

None blocking. The one stack trace in the vitest output comes from a test that passes (241/241). The `pnpm verify` chain was not re-run here. VALIDATION records it as executed stage by stage on 2026-10-29, because the host's low-memory reaper killed two single-invocation runs. I did not independently confirm that evidence.

## Known Limitations (documented, not gaps)

- Live zillow.com shows no visible "Sponsored" label. Detection relies on the `li[data-testid="search-list-{first,second,third}-ad"]` ad slots, which the detector classifies as sponsored. This is covered only by synthetic fixtures, so UAT 1 is the real proof.
- "Showcase" is opt-in only, pending the owner decision (UAT 3).
- Public release is gated on the Zillow ToS read (UAT 4), the remote and Pages (Phase 1 deferred), and Edge Partner Center.

## Gaps Summary

No code gaps. Every automatable check passes. The phase is human_needed because of 7 pending owner rows (live-site smoke, live zero-network check, Showcase decision, ToS review, privacy URL, Edge listing, release publish). The Firefox row is skipped by design.

---
_Verified: 2026-10-29_
_Verifier: Claude (gsd-verifier)_
