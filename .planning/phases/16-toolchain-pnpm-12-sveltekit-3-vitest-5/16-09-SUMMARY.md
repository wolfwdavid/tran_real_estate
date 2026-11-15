---
phase: 16-toolchain-pnpm-12-sveltekit-3-vitest-5
plan: 09
subsystem: toolchain
tags: [sveltekit-3, bundle-budget, vite-modulepreload, inline-icons]
requires: [16-08]
provides:
  - "all 9 gated pages under 60 KB gz initial JS on root and configured, assert-budget.mjs untouched"
  - "16-09-BUDGET-FORENSICS.md: byte attribution, real-transfer cross-check, candidate table"
affects: [16-10]
tech-stack:
  added: []
  patterns:
    - "build.modulePreload.resolveDependencies keeps only CSS in the dynamic-import table of app.js"
    - "ui/SiteIcon.svelte inlines Lucide path data for pages gated on initial JS"
key-files:
  created:
    - apps/web/src/lib/components/ui/SiteIcon.svelte
    - .planning/phases/16-toolchain-pnpm-12-sveltekit-3-vitest-5/16-09-BUDGET-FORENSICS.md
  modified:
    - apps/web/vite.config.ts
    - apps/web/src/lib/components/ui/ButtonLink.svelte
    - apps/web/src/lib/components/marketing/AudiencePage.svelte
    - apps/web/src/lib/components/forms/ComingSoonPanel.svelte
    - apps/web/src/lib/components/forms/FeedbackForm.svelte
    - apps/web/src/lib/components/forms/FormError.svelte
    - apps/web/src/lib/components/forms/FormSuccess.svelte
    - apps/web/src/lib/components/forms/WaitlistForm.svelte
requirements-completed: []
duration: one session
completed: 2026-11-14
---

# Phase 16 Plan 09: Kit 3 bundle-budget trim

Two behaviour-preserving trims took 3.7 KB off every gated page and another 3.7 KB off the audience pages, so all nine gated pages pass `pnpm budget:assert` at the unchanged 60 KB on the root and configured builds. The owner escalation was not needed. Nothing was pushed.

## Commits

| Task | Commit | Subject |
|------|--------|---------|
| 1 | aa14287 | docs(16): record the Kit 3 initial-JS attribution |
| 2 | ed4b0e5 | perf(web): keep only CSS in the dynamic-import dependency table of app.js |
| 2 | 565c489 | perf(web): inline the Lucide icons used on audience pages and forms |
| 3 | none | escalation not needed (skip condition met) |

No commit carries a trailer. `scripts/assert-budget.mjs` and its test are unchanged (`git diff 2603421..HEAD -- scripts/` is empty); `pnpm-lock.yaml` and both package.json files are untouched.

## What was found

Details and tables are in 16-09-BUDGET-FORENSICS.md. In short: of the 64.1 KB on for-renters, 21.3 is the Svelte runtime, 10.5 the Kit client (3.8 of that is devalue), 7.2 app code, 3.7 Lucide, and `app.js` was 5.3 KB, of which 2.2 KB was a 267-entry table of every chunk each route node needs (Vite's `__vite__mapDeps`), downloaded by every page. The Kit and Svelte runtime cost is fixed; the app-side slack was the table and Lucide.

## Trims

| Trim | Measured saving | Proof it preserves behaviour |
|------|-----------------|------------------------------|
| 1. `build.modulePreload.resolveDependencies` keeps only `.css` for JS hosts (`vite.config.ts`) | 3.7 KB on every gated page (for-renters 64.08 to 60.37; tools/affordability 63.4 to 59.69) | CSS still loads on client navigations (entries kept); JS chunks load through the module graph; E2E below |
| 2. `SiteIcon.svelte` replaces `@lucide/svelte` on audience pages, waitlist, feedback, ButtonLink arrow | 3.7 KB audience pages (60.37 to 56.64), 1.2 KB feedback | same SVG, same `lucide lucide-<name>` classes; unit, E2E and axe below |

Tried and reverted, no measured effect: `@__PURE__` on top-level `Intl` formatters in the two core format modules; `chunkOptimization.mergeCommonChunks: false`.

### Before and after (initial JS gz KB, budget 60)

| Page | root before | root after | headroom | configured before | configured after | headroom |
|------|-------------|------------|----------|-------------------|------------------|----------|
| feedback/ | 60.6 | 55.74 | 4.26 | 60.8 | 55.92 | 4.08 |
| for-agents/ | 64.0 | 56.58 | 3.42 | 64.2 | 56.76 | 3.24 |
| for-investors/ | 64.1 | 56.64 | 3.36 | 64.3 | 56.83 | 3.17 |
| for-renters/ | 64.1 | 56.64 | 3.36 | 64.3 | 56.83 | 3.17 |
| tools/affordability/ | 63.4 | 59.69 | 0.31 | 63.6 | 59.85 | 0.15 |
| tools/cap-rate/ | 63.2 | 59.62 | 0.38 | 63.4 | 59.79 | 0.21 |
| tools/cash-on-cash/ | 63.4 | 59.78 | 0.22 | 63.5 | 59.94 | 0.06 |
| tools/dscr/ | 63.4 | 59.76 | 0.24 | 63.5 | 59.92 | 0.08 |
| tools/ | 55.8 | 52.21 | 7.79 | 56.0 | 52.38 | 7.62 |

The four calculator pages are thin (0.06 to 0.38 KB), under the 0.5 KB the plan hoped for. No further behaviour-preserving saving was found for them without touching calculator copy or the Kit/Svelte runtime. Any change to a shared layout or a tool page needs a configured-build re-measure.

### Real-transfer cross-check (Playwright, fresh context, service worker blocked, gzip -9 of every JS response)

| Page | before | after | delta | oracle delta |
|------|--------|-------|-------|--------------|
| for-renters/ | 64.95 | 57.51 | -7.44 | -7.44 |
| tools/cash-on-cash/ | 66.44 | 62.85 | -3.59 | -3.60 |

The trims remove real fetched bytes (deltas match the oracle to 0.01 KB).

## Verification

`pnpm budget:assert` exit 0 on fresh root and configured builds (9 gated routes within 60 KB, 5 reported). Escalation not needed.

| Gate | Result |
|------|--------|
| `pnpm check` | 0 errors, 0 warnings (web 3,212 files, extension 1,079) |
| `pnpm lint` | exit 0; 1 pre-existing warning (GenerationPanel.svelte:83) |
| `pnpm banned`, `pnpm ui:guard` | pass (455 and 82 files) |
| Vitest web + scripts projects | 217 files, 3,877 tests pass |
| Playwright root + sub + configured: waitlist, feedback, marketing, a11y, csp, analytics, perf, layout, disclaimers, framing | 1,154 passed, 4 skipped, 0 failed (includes `waitlist.configured`, `feedback.configured`, `analytics.configured`, axe on audience routes) |
| `csp:assert` (3 targets) | pass, 45 pages each |
| `seo:assert` (3 targets) | pass, 44 pages, 14 sitemap URLs, 6 share cards each |
| `smoke:local` (fresh builds at the last commit) | 121 passed on root, sub and configured; 41.1 s total |

WLAN gate: last event 8003 at 19:02:14; the browser run started at 19:47, so about 45 quiet minutes. Plain `pnpm` was used for every script (tasks/lessons.md 2026-11-11).

## Deviations from plan

**1. [Measurement] Absolute real transfer is not within 0.5 KB of the oracle.** It is 0.9 KB above on for-renters and 3.1 KB above on cash-on-cash, constant before and after. Cause: Kit 3 fetches the error node (`nodes/1`) after boot, plus chunks only that node uses on tool pages; the oracle does not count them. The deltas, which are what proves the trims, agree to 0.01 KB. The plan's "at least 4.2 KB lower" is met on the worst audience page (7.44) and the tool page drop is 3.59 (its oracle baseline was only 3.4 over).

**2. [Judgement] Trim 1 is a Vite preload-table option.** The plan forbids preload-strategy tweaks that do not reduce real bytes; this one does (app.js is fetched by every page, cross-check above), so it is allowed, but a reviewer should know it trades a parallel JS preload on a cold client navigation for a smaller first load. The service worker precaches all chunks.

**3. [Rule 3] Baseline build for the cross-check** was made by temporarily checking out the 2603421 versions of the eight touched files, building into a scratch directory, and restoring them; the scratch directory was deleted. The working tree is clean apart from the pre-existing `.planning/config.json`.

No auth gates, no installs.

## Threat flags

None. T-16-09-01 to -04 and -SC are met: assert and its test have an empty diff, deltas are real, no install, no CSP change (csp:assert green).

## Known stubs

None.

## Requirements

TOOL-02 is NOT marked complete: it spans plans 05 to 10.

## Self-Check: PASSED

Commits aa14287, ed4b0e5 and 565c489 exist; SiteIcon.svelte and 16-09-BUDGET-FORENSICS.md exist; no background process is left running.
