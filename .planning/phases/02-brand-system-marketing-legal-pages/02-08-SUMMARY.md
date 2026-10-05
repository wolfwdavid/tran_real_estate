---
phase: 02-brand-system-marketing-legal-pages
plan: 08
subsystem: web-legal
tags: [legal, privacy, terms, fair-housing, data-coverage, external-links, prose-layout, BRND-04]
requires:
  - "02-02: banned-terms gate"
  - "02-04: legal route stubs, footer links, routing spec same-origin filter"
provides:
  - "LegalPage prose layout (h1, Last updated: 4 October 2026, plain-language notice, body slot, scoped prose styles)"
  - "ExternalLink: same-tab rel=external link with 14px ExternalLink icon and sr-only '(opens external site)'"
  - "Prerendered /legal/privacy/, /legal/terms/, /legal/fair-housing/, /legal/data-coverage/ with full plain-language copy"
affects: [footer legal links (now land on real content), Phase 10 launch hardening (professional legal review)]
tech-stack:
  added: []
  patterns:
    - "Verbatim contract sentences that must stay grep-able live in a script constant (Prettier reflows prose text across lines)"
    - "External links are same-tab with rel=\"external\" (Kit full navigation; satisfies svelte/no-navigation-without-resolve for prop hrefs)"
key-files:
  created:
    - apps/web/src/lib/components/legal/LegalPage.svelte
    - apps/web/src/lib/components/legal/ExternalLink.svelte
  modified:
    - apps/web/src/routes/(marketing)/legal/privacy/+page.svelte
    - apps/web/src/routes/(marketing)/legal/terms/+page.svelte
    - apps/web/src/routes/(marketing)/legal/fair-housing/+page.svelte
    - apps/web/src/routes/(marketing)/legal/data-coverage/+page.svelte
key-decisions:
  - "Verbatim sentences that acceptance greps target (legal notice, estimates disclaimer) are held in script constants so Prettier cannot split them across lines"
requirements-completed: [BRND-04]
metrics:
  duration: ~15 min
  completed: 2026-10-04
  tasks: 2
  files: 6
---

# Phase 2 Plan 08: Legal Pages Summary

**Four prerendered plain-language legal pages (privacy, terms, Fair Housing, data coverage) on a shared LegalPage prose layout, with same-tab `rel="external"` provider/HUD links that announce they leave the site.**

## What was built

- **LegalPage.svelte**: `<svelte:head>` title + meta description, `article.legal` at `max-w-page`, body at `max-w-reading` (640px), Display h1, "Last updated: 4 October 2026" label line, the notice "This page explains, in plain language, how Tran Real Estate Tools works. It is not legal advice.", then the children snippet. Scoped `:global` prose styles (h2 48px top, h3 32px, 16px paragraph/list spacing, disc lists, inline link rule with `overflow-wrap: anywhere` and pointer-only hover).
- **ExternalLink.svelte**: `<a {href} rel="external">` + Lucide `external-link` icon (14px, aria-hidden) + sr-only " (opens external site)". No `target` attribute.
- **Terms**: What Tran is / is not (verbatim "Tran Real Estate Tools is not a real estate brokerage and does not act as an agent for anyone. Nothing in the app is investment, legal, or tax advice."), keys and provider accounts (RentCast monthly limit + card overage warning), AI drafts, Fair Housing (internal `resolve('/legal/fair-housing/')` link), data accuracy, "provided as is, without warranties of any kind", changes.
- **Privacy**: short version (no accounts, no server that stores your data), browser storage + session keys / "remember on this device", where requests go with a list of six provider privacy-policy ExternalLinks, no third-party analytics/ads/tracking, deleting data, contact placeholder.
- **Fair Housing**: commitment, the seven federal protected characteristics (prose + `<ul>`), state/local note, tool behavior, HUD complaint ExternalLink.
- **Data coverage**: RentCast API source (ExternalLink, not affiliated), exclusions list (No MLS or IDX feeds / No listing photos / No CoStar or LoopNet data), coverage gaps, verbatim estimates disclaimer, synthetic sample data.

## Verification

- `pnpm check` 0 errors / 0 warnings; `pnpm lint` clean; `pnpm banned` passed (35 files); `pnpm guard` passed; `find apps/web/src -iname "*costar*"` empty.
- `build:root` + `build:sub` OK; `csp:assert` passed 14 pages in both builds.
- Built `legal/fair-housing/index.html`: 0 `target=`, 1 `rel="external"`.
- `playwright test a11y csp routing`: 40/40 passed (root + sub); full `test:e2e`: 48/48 passed.
- All plan acceptance greps return >= 1 (and `target=` in ExternalLink.svelte = 0).

## Commits

| Task | Commit | Message |
| ---- | ------ | ------- |
| 1 | 0ec55a0 | feat(02-08): legal page layout, terms and privacy |
| 1 (fix) | 44e8191 | fix(02-08): keep legal notice sentence on one searchable line |
| 2 | c9a6b24 | feat(02-08): fair housing statement and data coverage explainer |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prettier split verbatim sentences across lines, breaking the acceptance greps**
- **Found during:** Task 2 verification
- **Issue:** prettier-plugin-svelte reflows paragraph text at the print width, so "It is not legal advice." (LegalPage) and "They are not professional valuations of a property and can be wrong." (data coverage) were split across source lines. Rendered text was correct, but the line-based acceptance greps failed.
- **Fix:** Held both sentences in `const` strings in the component script and rendered them with `{notice}` / `{estimatesNote}`. Rendered output is unchanged.
- **Files modified:** LegalPage.svelte, data-coverage/+page.svelte
- **Commits:** 44e8191, c9a6b24

## Notes

- Legal copy is directionally sound but is flagged for professional review before the public GTM push (per STATE.md); the "Contact" section is an intentional placeholder until launch.
- The first `pnpm check` run failed transiently while parallel executors were mid-write; it passed on rerun with no change on this side.

## Known Stubs

- `apps/web/src/routes/(marketing)/legal/privacy/+page.svelte` "Contact" section: "Contact details will be posted here before public launch." Intentional per UI-SPEC; resolved in launch hardening (Phase 10).

## Self-Check: PASSED

- FOUND: all 6 files listed in key-files
- FOUND commits: 0ec55a0, 44e8191, c9a6b24
