---
phase: 10-launch-hardening-go-to-market
verified: 2026-10-14T06:05:00Z
status: human_needed
score: 5/5 success criteria verified (automated); 23/23 plans' must-haves verified
human_verification:
  - test: "Umami usage counts arrive from the deployed origin (10-HUMAN-UAT 1)"
    expected: "Two page views recorded for two pages; none with GPC on; Umami confirms IPs not stored. Cut line: if nothing arrives, unset both vars, move GTM-04 to v2, record in PROJECT.md"
    why_human: "Needs an Umami website, repo variables and the live tranrealestate.github.io origin (cross-origin collector CORS can only be proven there)"
  - test: "Web3Forms waitlist and feedback emails arrive (10-HUMAN-UAT 2)"
    expected: "'Tran waitlist: Renter' and 'Tran feedback: <topic>' emails reach the owner inbox; captcha OFF in the Web3Forms dashboard"
    why_human: "Needs the owner's Web3Forms key, deployed site and inbox"
  - test: "Contact email mailto fallbacks (10-HUMAN-UAT 3, optional)"
    expected: "With PUBLIC_CONTACT_EMAIL set, error/closed states show a working mailto to that address"
    why_human: "Owner must choose a contact address; mailbox delivery is external"
  - test: "Share cards in a link-preview debugger (10-HUMAN-UAT 4)"
    expected: "Landing and /tools/cap-rate/ show correct title, description and 1200x630 image"
    why_human: "Third-party unfurlers only reach the live origin"
  - test: "Sitemap in Search Console, robots.txt at org root (10-HUMAN-UAT 5)"
    expected: "sitemap.xml read with 14 URLs, no errors; robots.txt served with Sitemap line"
    why_human: "Needs Search Console account and live origin"
  - test: "Live-origin checks, DEPLOY-CHECKLIST Step 7 (10-HUMAN-UAT 6)"
    expected: "Deep-route hard refresh works; /renter redirects; branded 404; real Anthropic/OpenAI/Gemini key tests pass from deployed URL; Forget all keys clears; Safari 17+ shows persistence result"
    why_human: "Needs GitHub Pages deploy, owner's real provider keys and a Safari device"
  - test: "Dependabot alerts + secret scanning push protection (10-HUMAN-UAT 7)"
    expected: "Enabled in repo settings; throwaway-branch probe rejected at push"
    why_human: "Server-side GitHub settings; repo has no remote yet"
  - test: "Report-only pages over the 60 KB JS budget (10-HUMAN-UAT 8, owner decision)"
    expected: "Owner records 'accepted' or schedules the trim for /feedback/ (~102.5 KB) and /for-* (~96.5 KB)"
    why_human: "UI-SPEC makes these pages report-only; shipping vs. trimming is a product decision"
---

# Phase 10: Launch Hardening & Go-to-Market Verification Report

**Phase Goal:** First-time visitors become active users, new visitors find Tran through free tools, and the owner can measure usage, all on an audited, hardened site
**Verified:** 2026-10-14T06:05:00Z
**Status:** human_needed
**Re-verification:** No (initial verification)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | First-time visitor picks a portal, sees a short tour, and chooses "Try sample data" or a guided free RentCast key setup that includes setting the call cap | VERIFIED | Landing `(marketing)/+page.svelte:89` renders `GetStartedGuide`; guide links `{portal}?source=sample` (line 182) and `/setup/rentcast/?portal=` (line 31); `(app)/setup/rentcast/+page.svelte` embeds `ProviderKeyCard` (196) and `CapEditor` (228). E2E evidence: onboarding.spec 42/42, setup-rentcast.spec 20/20, perf CLS measured 0.011 / 0.00015 (< 0.1) |
| 2 | Visitor can join a per-portal waitlist and send feedback | VERIFIED | `AudiencePage.svelte` imports and renders `WaitlistForm` (used by all three for-* pages); `WaitlistForm` calls `submitOwnerForm(waitlistBody(...))`; `/feedback/` page + `FeedbackForm`; footer + Settings `GettingStartedSection`. E2E: waitlist 12+15 (configured), feedback 12+17 (configured), all passed |
| 3 | Free affordability, cap rate, cash-on-cash, DSCR calculator pages discoverable via sitemap.xml and share cards, no key, zero API calls | VERIFIED | Built `apps/web/build/sitemap.xml` lists 14 URLs incl. `/tools/` + 4 calculators; `build/og/` has 6 PNGs; `tools/dscr/index.html` has absolute canonical, og:image, twitter:card, 2 JSON-LD blocks, no third-party script. Re-ran `pnpm seo:assert` (44 pages/14 URLs/6 cards x3 builds PASS). Tool components import only `@tran/core` finance (no storage/data/AI). tools.spec 100/100, third-party.spec 6/6 |
| 4 | Owner sees page/portal usage counts via first-party beacon; no third-party scripts, no personal data | VERIFIED (delivery = human UAT 1) | `lib/analytics/payload.ts` whitelist (website, hostname, url path-only, referrer origin-only, coarse screen, data.portal); `consent.ts` GPC/DNT; root `+layout.svelte` gates on build-time defines and lazily imports `lib/analytics/boot` (which calls `createTracker`). Configured-build CSP connect-src adds only the analytics host. analytics.configured.spec 5/5 asserts no Cookie, no Referer, key whitelist, query/fragment stripped, GPC/DNT suppress. Unit: analytics/seo/onboarding/leads/calculator-form 177/177 passed (re-run) |
| 5 | Launch audit passes: axe keyless+keyed every route, CSP review, pnpm audit clean, banned-terms + disclaimer audit, PITFALLS checklist | VERIFIED | `docs/LAUNCH-AUDIT.md` (generated): all 9 Summary rows PASS; 44 routes x 4 axe columns PASS, 0 violations; only DEFERRED (human) / N/A rows are live-origin item 6 and Phase 11 extension items 15-16. Status derivation in `scripts/launch-audit.mjs` is evidence-driven ("Never PASS by default": missing report / no matching test / all-skipped / non-zero exit => FAIL). Re-ran `pnpm csp:assert` (45 pages x3 PASS), `pnpm budget:assert` (5 tool routes <= 60 KB on build and build-configured; max 58.9 KB) and launch-audit/audit-evidence/assert-seo/assert-budget/supply-chain tests (97/97) |

**Score:** 5/5 truths verified by automated evidence; live-origin delivery items routed to human UAT.

### Evidence pipeline re-check

`.tools/audit-evidence/` holds 23 E2E shard files + 5 unit shards + cls. Independent tally of the E2E shards: **2327 expected, 4 skipped, 0 failed, 0 flaky** (total 2331). The 4 skips are `perf.spec.ts:48` on non-root projects (`test.skip(project.name !== 'root', 'measured once, on the root build')`), by design; the root CLS values are present in `cls-g10.json`. `scripts/audit-evidence.mjs` (290 lines) refuses to merge unreadable shards and keeps duplicate runs; its unit tests pass. (`apps/web/test-results/` is currently empty because Playwright clears it per run; the shard store is the durable source.)

### Required Artifacts

gsd-tools `verify artifacts` across 23 plans: 57/61 auto-pass. The 4 misses were checked by hand and are false negatives:

| Artifact | Tool issue | Actual |
|----------|-----------|--------|
| `scripts/assert-csp.mjs` | Missing `application/ld+json` | Implemented as `ld+json` block validation (lines 8, 109, 196-198): must parse as JSON and \u-escape `<`/`&` |
| `lib/seo/SeoHead.svelte` | Missing `svelte:element this={'script'}` | Line 53: `<svelte:element this={scriptTag} type="application/ld+json">` (compiler rejects the literal) |
| `components/tools/CalculatorShell.svelte` | Missing "Fill in an example" | Copy comes from content module (`{C.fillExample}`, line 71); browser test clicks the button by that name |
| `routes/+layout.svelte` | Missing `createTracker` | Moved to lazy `lib/analytics/boot.ts` by orchestrator fix 241feeb (budget); layout dynamically imports it |

### Key Link Verification

gsd-tools `verify key-links`: 21/36 auto-verified. All 15 misses were hand-checked; every one is wired. Cause: plan YAML over-escapes regexes (`\\(` → "Invalid regex") or names a value as `from`.

| From | To | Status | Evidence |
|------|----|--------|----------|
| svelte.config.js | resolveSiteOrigin / buildCsp | WIRED | line 29 `origin: resolveSiteOrigin()`, line 56 `buildCsp({ analyticsHost: ... })` |
| ci.yml | build targets | WIRED | line 95 `pnpm run build:${{ matrix.target }}`, csp/seo/budget asserts per target |
| og-card.server.ts | @tran/brand tokens | WIRED | `import { tokens }`, `tokens.color` line 82 |
| core calculators.ts | monthlyPayment / mulBps | WIRED | lines 8-9 imports, used 17, 64, 66, 108 |
| SeoHead.svelte | SITE_URL + canonicalPath | WIRED | line 32 `SITE_URL + canonicalPath(page.route.id)` |
| CapRateCalculator | capRateCalc, toolPercent/toolMoney | WIRED | lines 3-4, 17, 19 |
| ToolPage | webApplication + faqPage | WIRED | lines 59-60 |
| SiteFooter | /tools/ + 4 calculators | WIRED | lines 20-33 `resolve('/tools/...')` |
| GetStartedGuide | onboarding-state | WIRED | readOnboarding line 95 |
| WaitlistForm | owner-forms | WIRED | line 99 `submitOwnerForm(...)` |
| Settings | #get-started | WIRED | via `GettingStartedSection.svelte` (writeOnboarding + `/#get-started`) |
| privacy page | ANALYTICS.host | WIRED | lines 7, 62, 90 |
| launch-audit.mjs | assert-csp/seo/budget, banned rules | WIRED | lines 15-20 in-process imports |
| package.json verify | seo/budget/audit:deps | WIRED | `verify` script chains csp:assert, seo:assert, budget:assert, test:e2e, audit:deps |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GTM-01 | 10-03,04,15,16,18,20,21,22,23 | Portal pick, tour, sample data or guided RentCast setup | SATISFIED | Truth 1 |
| GTM-02 | 10-01,03,04,05,17,18,19,21,22,23 | Per-portal waitlist + feedback | SATISFIED (email delivery = UAT 2) | Truth 2 |
| GTM-03 | 10-01,02,03,04,07-14,21,22,23 | Free SEO tool pages via sitemap + share cards | SATISFIED | Truth 3 |
| GTM-04 | 10-01,02,03,04,05,06,19,21,22,23 | First-party beacon, no personal data | SATISFIED (live delivery = UAT 1; cut line documented) | Truth 4 |

All four phase IDs are claimed by plans; REQUIREMENTS.md maps no other ID to Phase 10 (no orphans). Info: REQUIREMENTS.md checkboxes and traceability rows for GTM-01..04 still read "Pending"; the orchestrator should flip them on phase completion.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| Phase 10 new modules (analytics, seo, onboarding, forms, tools, setup, launch-audit, audit-evidence) | - | TODO/FIXME/placeholder scan | none | Clean |
| tools/*/index.html | - | Initial JS 58.7-58.9 KB vs 60 KB gate | Info | Within budget but ~1 KB headroom; future changes to shared layout will trip the gate |
| /feedback/, /for-* | - | 96.5-102.7 KB initial JS | Warning (report-only) | Not gated by UI-SPEC; owner decision UAT 8 |

### Known open items classification

- **renter-saved.spec.ts:83 cross-tab race** — Non-blocking for Phase 10. It is Phase 4 scheduler behaviour (`ifAvailable` lock on `tran-alerts` skips a due pass with no retry) surfacing as a 1-in-10 flake under 40 CPU burners; it passed in the gate evidence (6/6). Fix changes the Phase 4 cross-tab design and needs mutation-tested concurrency guards; track as a follow-up/owner decision (deferred-items.md), not a Phase 10 gap.
- **Report-only pages over 60 KB** — Owner decision (UAT 8), explicitly report-only per UI-SPEC; the gated tool routes pass.
- **10-VALIDATION "feedback latency < 10s" unchecked** — Developer-loop speed target (~40 s); accepted as in Phases 1-2; not a user-facing goal.

### Human Verification Required

The 8 owner items in 10-HUMAN-UAT.md (all pending, needing the `tranrealestate` org, Pages deploy, Umami, Web3Forms and provider accounts) are listed in the frontmatter. All locally verifiable behaviour behind them passed.

### Gaps Summary

No goal-blocking gaps. Every ROADMAP success criterion is backed by real, wired code, passing unit tests (re-run here) and E2E evidence (independently tallied, 0 failures). The launch audit is generated from evidence with fail-closed status logic, and its CSP/SEO/budget oracles re-pass on the current builds. What remains is live-origin confirmation and two owner decisions, so the status is human_needed.

---

_Verified: 2026-10-14T06:05:00Z_
_Verifier: Claude (gsd-verifier)_
