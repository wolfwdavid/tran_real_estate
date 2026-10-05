# Phase 2: Brand System, Marketing & Legal Pages - Context

**Gathered:** 2026-10-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the warm-editorial, accessible marketing surface and the brand system every later phase consumes:
- landing page (`/`)
- For Renters / For Investors / For Agents pages
- four legal pages
- global header portal switcher
- footer
- design tokens in `packages/brand`

Requirements are BRND-01..05. Portal functionality itself (search, analyzer, CRM) belongs to Phases 6-9. Key storage belongs to Phase 3. This phase only routes to the portals, which remain placeholder pages.

</domain>

<decisions>
## Implementation Decisions

Proposals were presented 2026-09-23. The owner accepted all of them as recommended on 2026-10-04.

### Typography & palette
- Fraunces (headings) + Inter (body), both variable fonts.
  - Self-hosted from the repo or `@fontsource-variable` packages bundled by Vite.
  - No Google Fonts CDN and no third-party requests.
- Palette:
  - warm ivory ground
  - espresso text
  - terracotta accent
  - sage secondary
- WCAG 2.2 AA contrast is enforced at the token level:
  - every text/background token pair is asserted by a unit test (≥4.5:1 body text, ≥3:1 large text and UI components).
- Light-only in v1, with no dark mode.
- Tokens live in `packages/brand` (currently an empty `tokens` contract) and are exposed to Tailwind v4 via `@theme` in `apps/web/src/app.css`.
  - The extension popup (Phase 11) will reuse them.

### Landing & audience pages
- Landing structure:
  - hero (headline, subhead, three portal cards: Renter / Investor / Agent)
  - "How it works" in 3 steps
  - trust strip ("Your keys never leave your browser", "Not a brokerage")
  - footer
- One shared audience-page template drives /for-renters/, /for-investors/ and /for-agents/ (exact slugs at planner discretion; must be prerendered with trailing slashes).
  - Each page has an "Open portal" CTA and a "Try sample data" CTA (the sample-data mode arrives in Phase 4, so the CTA links to the portal for now).
- Imagery:
  - no stock photos of people
  - warm abstract textures (CSS/SVG) plus illustrated property-type marks (inline SVG, no external assets)
- No fabricated metrics, testimonials, user counts or ratings.
- Copy never implies brokerage, appraisal, or investment/legal/tax advice.
- A banned-terms grep runs in CI and in `pnpm verify` over marketing and legal copy. It fails on terms like "appraisal", "guaranteed", "best investment", "we represent", "brokerage services" and fake-testimonial markers. A non-vacuity test proves the grep catches a planted term.

### Navigation, legal & footer
- Header has a "Tran Real Estate Tools" text-only wordmark (no SVG logo in v1) and portal nav Renter · Investor · Agent.
  - Below ~640px the nav collapses into an accessible disclosure menu (button with aria-expanded, keyboard and focus correct).
  - The portal switcher is reachable from every app page (BRND-05).
- Four prerendered legal pages under `/legal/`:
  - privacy
  - terms ("software tool; not a brokerage; not investment, legal, or tax advice")
  - fair-housing
  - data-coverage (RentCast-sourced, no MLS/IDX, no photos, coverage gaps; no CoStar)
- Footer appears on every page (marketing and app) with:
  - a disclaimer line
  - the four legal links
  - an Equal Housing Opportunity statement
  - © Tran Real Estate Tools

### Locked from earlier (do not re-ask)
- Public brand "Tran Real Estate Tools".
- Warm editorial direction.
- Self-hosted fonts.
- No third-party scripts.
- No brokerage, appraisal or advice implications.
- The strict meta CSP from Phase 1 must stay green. `default-src 'self'` already covers self-hosted fonts.
- Inline style attributes are allowed (`style-src-attr 'unsafe-inline'`). Inline `<style>`/`<script>` in app.html are not.

### Claude's Discretion
- Exact hex values, type scale, spacing scale and radius tokens, chosen through the UI/UX Pro Max design contract (`/gsd:ui-phase 2`) within the palette above.
- Exact legal copy wording, within the stated constraints. It is plain-language and not legal advice.
- Route slugs for the audience pages and component file layout.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/brand/src/index.ts`: empty `tokens` contract awaiting Phase 2.
- `apps/web/src/app.css`: Tailwind v4 (`@import 'tailwindcss'`) with an empty `@theme {}`.
- Routes are grouped `(marketing)`, `(app)` (renter/investor/agent/settings, with a basic `<nav aria-label="Portals">`) and `(print)`. The root `+layout.svelte` has a skip link + `<main id="main-content">`.
- `resolve()` from `$app/paths` is used for all internal links (base-path safe, trailing slashes).

### Established Patterns
- Static adapter, every route prerendered. `handleUnseenRoutes: 'fail'`, so every new route must be linked or listed.
- Dual-base builds (root + `/tran_real_estate` sub-path), each verified by the CSP oracle and by Playwright (routing, CSP, framing, axe) on both bases.
- The E2E route lists in `tests/e2e/*.spec.ts` must gain every new page. The axe spec iterates the route list.
- The `print/` page intentionally has no nav, so the routing spec skips its link guard.
- The real-data guard and gitleaks run in `pnpm verify`. No network calls are allowed in unit tests (setupFiles block fetch).

### Integration Points
- Header/footer go in the root or group layouts. The `(print)` group must stay chrome-free.
- New routes: landing content, 3 audience pages, 4 legal pages. Update the routing/CSP/a11y E2E route lists and add a 375px no-horizontal-scroll assertion.
- Banned-terms grep script in `scripts/`, wired into `verify` and CI (`.github/workflows/ci.yml`).

</code_context>

<specifics>
## Specific Ideas

- The warm editorial reference is the Callen Faulkner reel feel: serif headings, cinematic warmth. It is expressed through texture and type, not photos of people.
- The trust strip states facts the architecture guarantees (browser-only keys, no backend). It makes no marketing claims.

</specifics>

<deferred>
## Deferred Ideas

- Dark mode (post-v1).
- SVG logo mark (post-v1).
- Licensed photography (post-v1, if ever).

</deferred>
