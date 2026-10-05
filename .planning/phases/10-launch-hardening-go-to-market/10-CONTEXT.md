# Phase 10: Launch Hardening & Go-to-Market - Context

**Gathered:** 2026-10-04
**Status:** Ready for planning

<domain>
## Phase Boundary

First-run onboarding, per-portal waitlist + feedback, free zero-API SEO calculator pages with sitemap/share cards, first-party analytics beacon, and the full launch audit. Requirements GTM-01..04. Depends on Phases 1-9, not Phase 11.

</domain>

<decisions>
## Implementation Decisions

The owner chose fully autonomous mode on 2026-10-04. Recommended defaults adopted.

### Onboarding (GTM-01)
- First visit (flag in Phase 3 prefs): modal-free inline onboarding on the landing → choose portal → 3-step tour (what it does, where keys go, sample vs live) → "Try sample data" (sets sample mode, opens portal) or "Connect a free RentCast key" guide: (1) create a dedicated endpoint-restricted key at RentCast, (2) paste + Test, (3) set the call cap (default 40). Re-openable from Settings.

### Waitlist & feedback (GTM-02)
- Forms post to Web3Forms using **the owner's** access key (public-safe), tagged by portal; honeypot + timing; **owner key deferred** — read from a build-time env `PUBLIC_WEB3FORMS_KEY` that, when absent, renders the form in "coming soon" state with a mailto fallback. No third-party scripts.

### SEO tool pages (GTM-03)
- `/tools/affordability/`, `/tools/cap-rate/`, `/tools/cash-on-cash/`, `/tools/dscr/` reusing `core.finance` and the Phase 6 affordability component; zero API calls; each with title/description, JSON-LD `WebApplication`/`FAQPage`, OG share card (static PNG generated at build from brand tokens via a Node script — no runtime canvas), `sitemap.xml` + `robots.txt` generated at build for the configured base URL. Marketing JS budget: tool pages ≤ 60 KB gz JS (asserted by a build-size test).

### Analytics (GTM-04)
- First-party **fetch beacon** to a self-hosted Umami collection endpoint host configured via `PUBLIC_ANALYTICS_HOST`; payload = path, portal, referrer host only, screen class; **no IDs, no IP logic, no cookies**; respects `navigator.doNotTrack`/GPC; CSP `connect-src` gains that host only when configured (build-time). If no host configured → beacon no-op. **Owner has no Umami instance yet → ship no-op; CORS verification is a HUMAN-UAT item; cut line applies.**

### Launch audit (success criterion 5)
- Scripted: axe on every route in keyless and mocked-key states (E2E), CSP review test (no `unsafe-inline` except `style-src-attr`, meta first in head), `pnpm audit --prod` clean (or documented exceptions), banned-terms + disclaimer presence audit (every portal page footer has the disclaimer), Lighthouse-style perf budget check, PITFALLS "Looks Done But Isn't" checklist walked and recorded in `docs/LAUNCH-AUDIT.md`.

### Claude's Discretion
- Tour implementation (inline steps vs. popovers); OG image generation lib (prefer `@resvg/resvg-js` or `sharp` dev-dependency only).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `core.finance` (Phase 7), affordability component (Phase 6), Settings/prefs (Phase 3), Web3Forms pattern (Phase 8), banned-terms grep (Phase 2), CI/verify pipeline (Phase 1).

### Established Patterns
- Build-time env via Node (never set BASE_PATH from Git Bash); CSP contract test lists hosts explicitly.

### Integration Points
- Landing (Phase 2) gets onboarding entry; footer gets Tools links; CI adds sitemap/OG/perf-budget checks.

</code_context>

<specifics>
## Specific Ideas

- No programmatic "rentals in [city]" pages filled with RentCast data (anti-feature): SEO pages are calculators only.

</specifics>

<deferred>
## Deferred Ideas

- "What Tran never does" trust page (GTM-V2-01) — include if time allows as a legal-style page.
- Analytics moves to v2 if Umami CORS fails from the deployed origin (owner records decision).

</deferred>
