---
phase: 02-brand-system-marketing-legal-pages
plan: 06
subsystem: web-marketing
tags: [landing, hero, portal-card, how-it-works, trust-strip, inline-svg, brand-marks]
requires:
  - "02-03: Tailwind @theme utilities, Fraunces/Inter fonts, @lucide/svelte"
  - "02-04: ButtonLink, (marketing) layout chrome, /for-* audience stubs"
provides:
  - "Landing page / with hero (radial-gradient texture + contour motif), #portals, #how-it-works, trust strip"
  - "RenterMark, InvestorMark, AgentMark inline-SVG decorative marks ($lib/components/brand/marks)"
  - "PortalCard: whole-card-clickable article with one link and card-level focus ring"
  - "HowItWorks and TrustStrip marketing sections"
affects: [02-07 audience pages (may reuse marks/PortalCard), later layout/visual E2E]
tech-stack:
  added: []
  patterns:
    - "Whole-card link: single <a> with after:absolute after:inset-0, focus ring on card via has-[a:focus-visible]"
    - "Decorative SVG uses fill-*/stroke-* token utilities only, no hex, no style="
    - "Hero texture in a component <style> block (stylesheet, CSP-safe), not inline style or data: URI"
key-files:
  created:
    - apps/web/src/lib/components/brand/marks/RenterMark.svelte
    - apps/web/src/lib/components/brand/marks/InvestorMark.svelte
    - apps/web/src/lib/components/brand/marks/AgentMark.svelte
    - apps/web/src/lib/components/marketing/PortalCard.svelte
    - apps/web/src/lib/components/marketing/HowItWorks.svelte
    - apps/web/src/lib/components/marketing/TrustStrip.svelte
  modified:
    - apps/web/src/routes/(marketing)/+page.svelte
decisions:
  - "PortalCard keeps an eslint-disable/enable pair for svelte/no-navigation-without-resolve (verified the rule fires without it; callers pass resolve() output)"
  - "Contour motif: 7 generated closed cubic paths centred near the top-right, stored as a const array and rendered with {#each}; paths extend past the viewBox and are clipped by the SVG"
  - "Landing meta description lives in a script const (same pattern as 02-04 stubs) so Prettier keeps the tag on one line"
metrics:
  duration: 7min
  completed: 2026-10-05
  tasks: 2
  files: 7
---

# Phase 2 Plan 06: Warm-Editorial Landing Page Summary

The landing page at `/` now shows the Fraunces hero "Real estate tools that do the refreshing for you" on an ivory ground with two layered radial-gradient tints and a topographic contour motif (768px and up). It routes visitors to the three audience pages through illustrated portal cards, explains the product in three steps, and closes with a trust strip of architectural facts. There are no images, external assets, metrics or testimonials.

## What Was Built

- **Task 1 (22f527f):** Three 64x64 inline-SVG marks (apartment block with a 3x3 window grid and terracotta door; sage duplex with a ruled ledger card leaning on it, no arrows or charts; house with a terracotta roof and a sage speech bubble). All are `aria-hidden`, `focusable="false"` and styled only with token classes. `PortalCard` is an `<article>` with a mark disc, h3, body and one link whose `::after` covers the card. Hover and focus-within lift the card (motion-safe), and the focus ring is drawn on the card.
- **Task 2 (0d4f2a5):** `HowItWorks` (`#how-it-works`, an `<ol>` of 3 steps with aria-hidden tabular-nums discs), `TrustStrip` (sr-only h2, KeyRound/ServerOff/Database items) and the rewritten `(marketing)/+page.svelte` (title and meta from the UI-SPEC, hero, CTAs to `#portals` and `#how-it-works`, and three PortalCards to `resolve('/for-renters/' | '/for-investors/' | '/for-agents/')`). All copy is verbatim from the plan/UI-SPEC.

## Verification

- `corepack pnpm check`: 0 errors, 0 warnings. `lint`: exit 0. `banned`: passed. `theme-parity`: 6/6. `test:unit`: 14 files, 205 tests.
- With the build lock held: `build:root` and `build:sub` succeed, `csp:assert` passes 14 pages in each build, and `test:e2e` passes 48/48 (both bases: a11y, csp, framing, routing).
- `grep -c "Real estate tools that do the refreshing for you" apps/web/build/index.html` = 1. There are no `<img` tags in any plan file, and no `style=` in the marks.
- Ad-hoc Playwright check against the built root (not committed):
  - `scrollWidth` equals the viewport at 375, 768 and 1280.
  - The h1 renders in Fraunces Variable.
  - The contour SVG is hidden at 375 and visible from 768.
  - Heading order is h1 > h2 Pick a portal > h3 x3 > h2 Three steps > h3 x3 > h2 (sr-only) > h3 x3, then the footer.
  - A keyboard-focused card link draws a 2px solid outline on the card.
  - Clicking the card body (not the link text) navigates to `/for-investors/`.
  - A full-page screenshot was reviewed visually.

## Deviations from Plan

None. The plan was executed as written. The conditional eslint disable in PortalCard was applied because lint flags the `{href}` prop. It uses the disable/enable block form from 02-04, because the rule reports on the attribute line.

## Known Stubs

None in this plan's files. The cards link to `/for-*` pages whose bodies are added by 02-07.

## Self-Check: PASSED
