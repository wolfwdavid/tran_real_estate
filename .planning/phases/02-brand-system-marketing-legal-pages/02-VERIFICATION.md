---
phase: 02-brand-system-marketing-legal-pages
verified: 2026-10-05T02:10:02Z
status: human_needed
score: 5/5 must-haves verified
human_verification:
  - test: "Open the built site at 375px in a device emulator (or a real phone) and compare the warm-editorial visual feel (texture, marks, type rhythm) against 02-UI-SPEC.md"
    expected: "Fraunces/Inter render correctly, hero texture and property-type marks look intentional, nothing looks broken or off-brand"
    why_human: "Aesthetic judgement; every functional and contrast property is already automated (axe + token contrast tests), per 02-VALIDATION.md Manual-Only Verifications"
  - test: "Professional legal review of the four /legal/ pages before the public GTM push"
    expected: "Privacy, Terms, Fair Housing and Data-coverage copy holds up to a lawyer's review"
    why_human: "Legal judgement; STATE.md/CONTEXT already flag this as pre-launch, not a Phase 2 gap"
  - test: "Once the GitHub org/Pages origin exists, reload every route on the live origin and confirm fonts and all assets are same-origin (no third-party requests) in the Network tab"
    expected: "Same CSP-oracle and same-origin guarantees verified locally against apps/web/build and apps/web/build-sub also hold on tranrealestate.github.io"
    why_human: "Hosting is owner-gated (no GitHub org yet); covered by docs/DEPLOY-CHECKLIST.md Step 7 once live. Not a Phase 2 gap — deferred per instructions."
---

# Phase 2: Brand System, Marketing & Legal Pages Verification Report

**Phase Goal:** Visitors land on a warm-editorial, accessible marketing surface that explains Tran Real Estate Tools, routes them to the right portal, and states plainly what Tran is and is not.
**Verified:** 2026-10-05T02:10:02Z
**Status:** human_needed (all automated checks pass; see human_verification items above — none are code gaps)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Visitor sees a warm-editorial landing page (warm palette, serif headings, self-hosted fonts, no third-party requests) that explains Tran and routes to Renter/Investor/Agent portals | ✓ VERIFIED | `apps/web/src/routes/(marketing)/+page.svelte` renders hero h1 "Real estate tools that do the refreshing for you" (Fraunces), `#portals` with 3 `PortalCard`s linking to `/for-renters/` `/for-investors/` `/for-agents/`; `theme-parity.test.ts` + brand contrast suite green (10/10); fonts self-hosted via `@fontsource-variable/*`; `assert-csp.mjs` passed 14/14 pages on both `apps/web/build` and `apps/web/build-sub` with zero `data:` URIs; `layout.spec.ts` same-origin + fonts-loaded assertions green (226/226 E2E) |
| 2 | Visitor can read For Renters/Investors/Agents pages describing each portal's value; no brokerage/appraisal/advice language (banned-terms CI grep); no fabricated testimonials/metrics | ✓ VERIFIED | `apps/web/src/lib/content/audiences.ts` + `AudiencePage.svelte` drive all three audience pages (built at `for-renters/`, `for-investors/`, `for-agents/`); `node scripts/banned-terms.mjs` → "Banned-terms check passed (35 files)"; `marketing.spec.ts` rendered-copy banned-terms checks green on every route including a non-vacuity planted-phrase control |
| 3 | Visitor can reach, from any page, privacy, terms (software tool; not brokerage; not investment/legal/tax advice), Fair Housing, and data-coverage | ✓ VERIFIED | `SiteFooter.svelte` renders all 4 legal links on every non-print page; built `/legal/{privacy,terms,fair-housing,data-coverage}/index.html` exist in both builds; terms page contains verbatim sentence (grep-confirmed); fair-housing links `hud.gov` complaint page; data-coverage names MLS/IDX, CoStar, LoopNet exclusions; `layout.spec.ts` "footer legal links return 200 from every route" green |
| 4 | User can switch between Renter/Investor/Agent portals from any app page | ✓ VERIFIED | `PortalSwitcher.svelte` renders in both `(marketing)` and `(app)` group layouts; `aria-current` computed from route id and present in raw prerendered HTML (confirmed by mutation-checked E2E, 02-10 SUMMARY); disclosure menu (Escape/Enter/Space/resize/navigate) all green in `layout.spec.ts` |
| 5 | Every page passes axe WCAG 2.2 AA color contrast and is fully usable at 375px with no horizontal scrolling | ✓ VERIFIED | `a11y.spec.ts` axe run (1280px, 375px, 404, menu-open) → 58/58 passed, zero violations (only a benign "incomplete" log for hero-gradient text, not a violation); `layout.spec.ts` 375px no-horizontal-scroll + text-spacing-override assertions on all 13 routes green, including a planted-overflow non-vacuity control |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/brand/src/index.ts` | tokens, contrastPairs, luminance/contrastRatio/failingPairs, themeVars() | ✓ VERIFIED | 118 lines; exports present; parity-tested against `app.css` |
| `packages/brand/src/contrast.test.ts` | WCAG gate + non-vacuity | ✓ VERIFIED | brand project: 4 suites / 10 tests, all green (confirmed via isolated `--no-file-parallelism` run) |
| `scripts/lib/banned-terms-rules.mjs` + `scripts/banned-terms.mjs` | Rules + CLI | ✓ VERIFIED | 59 + 45 lines; `node scripts/banned-terms.mjs` passes 35 files; wired into `package.json` `verify` and `.github/workflows/ci.yml` line 46 |
| `apps/web/src/app.css` `@theme` | Mirrors `@tran/brand`, resets Tailwind default palette | ✓ VERIFIED | `--color-*: initial;` present; theme-parity test green |
| `apps/web/src/lib/components/layout/{SiteHeader,PortalSwitcher,SiteFooter}.svelte` | Shared chrome | ✓ VERIFIED | PortalSwitcher 118 lines (nav wraps whole header row — recorded deviation, see below); SiteFooter 89 lines with 4 legal links + disclaimer + EHO + © |
| `apps/web/src/routes/(marketing)/+page.svelte` | Landing: hero, portals, how-it-works, trust strip | ✓ VERIFIED | 99 lines, contains exact h1 string |
| `apps/web/src/lib/content/audiences.ts` + `AudiencePage.svelte` | Shared audience template | ✓ VERIFIED | 167 + 95 lines; built routes exist for all 3 audiences |
| `apps/web/src/lib/components/legal/LegalPage.svelte` + 4 legal routes | Prose layout + legal pages | ✓ VERIFIED | 64 lines; verbatim terms sentence, HUD link, MLS/CoStar/LoopNet exclusions all grep-confirmed in built source |
| `apps/web/tests/e2e/{routes.ts,routes-drift.spec.ts,layout.spec.ts,marketing.spec.ts}` | Shared route list + drift guard + chrome/content E2E | ✓ VERIFIED | All referenced by passing E2E runs (226 + 58 = 284 assertions across layout/marketing/a11y, both `root` and `sub` base projects) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `vitest.config.ts` | `packages/brand` | root Vitest projects array | WIRED | `test.projects` includes `'packages/brand'`; brand suite runs and passes |
| `package.json` verify | `scripts/banned-terms.mjs` | `pnpm banned` step | WIRED | present in `verify` script string, confirmed by direct run |
| `.github/workflows/ci.yml` | `scripts/banned-terms.mjs` | CI step | WIRED | line 46: `run: node scripts/banned-terms.mjs` |
| Landing `PortalCard`s | `/for-renters/`, `/for-investors/`, `/for-agents/` | `resolve('/for-…/')` | WIRED | built pages exist; E2E "three portal cards link to the three audience pages" green |
| `PortalSwitcher` | `/renter/`, `/investor/`, `/agent/` | `resolve()` + `aria-current` by route id | WIRED | grep-confirmed in source; raw-HTML mutation-checked E2E green |
| Audience pages | `/renter/`, `/investor/`, `/agent/` | CTA `resolve()` | WIRED | "Open {portal} portal" / "Try sample data" both resolve to the portal (sample-data CTA intentionally points to the portal per CONTEXT, pending Phase 4) |
| `SiteFooter` | 4 legal routes | `resolve('/legal/…/')` | WIRED | 200-status E2E check on every non-print route |
| `apps/web/tests/e2e/{routing,csp,a11y,layout,marketing}.spec.ts` | `apps/web/tests/e2e/routes.ts` | shared `ROUTES` import | WIRED | drift guard (`routes-drift.spec.ts`) asserts build `index.html` set == `ROUTES` |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|-------------|--------|----------|
| BRND-01 | 01, 03, 04, 06, 10, 11, 12 | Warm-editorial landing, routes to 3 portals | ✓ SATISFIED | Token gate, fonts/CSP oracle, landing content, E2E same-origin/fonts |
| BRND-02 | 02, 07, 11, 12 | Audience pages, no banned language/fabrication | ✓ SATISFIED | `audiences.ts`, banned-terms CLI + rendered-copy E2E |
| BRND-03 | 01, 03, 04, 05, 10, 11, 12 | WCAG 2.2 AA contrast + 375px usability | ✓ SATISFIED | Token contrast unit tests, axe E2E (1280/375/404/menu), 375px no-scroll + text-spacing E2E |
| BRND-04 | 02, 04, 08, 09, 11, 12 | 4 legal pages, software-tool/not-brokerage language | ✓ SATISFIED | 4 built legal routes, verbatim terms sentence, footer reachability E2E |
| BRND-05 | 04, 09, 10, 12 | Switch portals from any app page | ✓ SATISFIED | PortalSwitcher in both layout groups, aria-current mutation-checked, disclosure keyboard E2E |

No orphaned requirements: REQUIREMENTS.md maps exactly BRND-01..05 to Phase 2, and every plan's `requirements:` frontmatter field covers exactly this set. All 5 are checked `[x]` and marked "Complete" in the Phase 2 status table.

### Anti-Patterns Found

None blocking. Scanned the key-files list (components, routes, scripts) for TODO/FIXME/placeholder/empty-return/hardcoded-empty patterns:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/lib/components/marketing/PortalPlaceholder.svelte` (app portal pages) | n/a | "being built" placeholder copy | ℹ️ Info | Intentional and in-scope — Phase 2 explicitly keeps portal functionality as honest placeholders (CONTEXT: "Portal functionality itself... belongs to Phases 6-9"); the copy is UI-SPEC-mandated, not a stub bug |
| Audience "Try sample data" CTA | n/a | Links to the portal root, not a distinct sample-mode entry | ℹ️ Info | Documented, intentional deviation per CONTEXT ("the sample-data mode arrives in Phase 4"); not a Phase 2 gap |

No `console.log`-only implementations, no empty handlers, no raw hex bypassing tokens (enforced by `theme-parity.test.ts`'s raw-hex ban) found in the scanned files.

### Recorded Deviations — Judged

| Deviation | Judgement |
|-----------|-----------|
| Token renames `--container-prose` → `--container-reading`, `--duration-*` dropped for Tailwind's built-in `duration-150` | Preserves goal — same visual/contrast outcome, avoids a Tailwind `prose` class collision; parity test still enforces consistency |
| Portals `<nav>` wraps the entire header row (wordmark + inline list + Menu button + panel) instead of UI-SPEC's header/nav split | Preserves goal — keeps the mobile panel inside one `navigation` landmark at every width (fixes a potential double-landmark issue); landmark-count E2E (exactly one `nav[aria-label="Portals"]`) still passes |
| Footer link arrays as their own grid/columns | Preserves goal — matches UI-SPEC's 3-column footer intent exactly; no behavioral difference found |
| Trust-strip copy "Your keys stay in your browser" instead of CONTEXT's literal "never leave your browser" | Preserves goal — UI-SPEC explicitly corrected this for factual accuracy (keys do travel to RentCast/AI providers); wording verified present in built output |
| Sentences moved into script `const`s to survive Prettier reflow | Preserves goal — purely a source-organization fix so line-based acceptance greps aren't fooled by word-wrap; rendered output unchanged (confirmed by rendered-copy E2E) |

None of the recorded deviations weaken any Phase 2 success criterion; all are either accessibility improvements or mechanical fixes with unchanged rendered behavior.

### Human Verification Required

See YAML frontmatter `human_verification`. Summary:
1. **Visual polish on a real device at 375px** — aesthetic-only, every functional/contrast property already automated.
2. **Professional legal review of the 4 `/legal/` pages** — pre-launch gate already flagged in STATE.md/CONTEXT, not a Phase 2 gap.
3. **Live-origin verification once the GitHub org/Pages exists** — hosting is owner-gated and explicitly deferred per the verification instructions; local build/CSP-oracle/E2E evidence already covers the equivalent same-origin and font-loading guarantees.

### Gaps Summary

No gaps found. All 5 observable truths (mapped 1:1 to the ROADMAP Phase 2 success criteria) are verified against the actual codebase, not just SUMMARY claims:

- Ran `corepack pnpm banned` directly → passed.
- Ran unit tests per-project with `--no-file-parallelism` (required to work around an unrelated Windows/libuv worker-fork crash in this sandbox, `Assertion failed: new_time >= loop->time` — a pre-existing environment flake also noted in 02-02-SUMMARY, not a regression): brand 10/10, web 22/22, core 11/11, scripts 162/162, all green.
- Ran `corepack pnpm check` (0 errors) and `corepack pnpm lint` (prettier + eslint, exit 0).
- Ran `node scripts/assert-csp.mjs` against both existing builds (`apps/web/build`, `apps/web/build-sub`) → 14/14 pages pass, no `data:` URIs.
- Ran fresh Playwright E2E for `layout.spec.ts` + `marketing.spec.ts` (226/226 green across `root`/`sub`) and `a11y.spec.ts` (58/58 green, zero axe violations).
- Grep-confirmed verbatim terms sentence, HUD link, MLS/CoStar/LoopNet exclusions, aria-current wiring, and footer→legal routing directly in source and build output.
- Cross-referenced all 5 BRND requirement IDs against REQUIREMENTS.md: no orphans, all marked complete, consistent with plan frontmatter.
- Working tree left clean; build lock acquired and released around the Playwright run per instructions.

The `status: human_needed` reflects only the three pre-existing, owner-gated/aesthetic items above — none are code gaps, and the phase goal is achieved.

---

_Verified: 2026-10-05T02:10:02Z_
_Verifier: Claude (gsd-verifier)_
