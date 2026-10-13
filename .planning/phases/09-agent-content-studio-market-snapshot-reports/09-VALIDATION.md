---
phase: 9
slug: agent-content-studio-market-snapshot-reports
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-04
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Every task in plans 09-01 … 09-24 (09-24 is the verifier gap closure) carries an `<automated>` verify command. Plan 09-23 flips row statuses and sets `wave_0_complete: true` after the final `corepack pnpm verify`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11 (projects `core`, `web`, `brand`, `scripts`, all network-blocked) + Playwright 1.63.0 with `@axe-core/playwright` 4.13.0 (projects `root`, `sub`) |
| **Config file** | `vitest.config.ts` (root projects), `packages/core/vitest.config.ts`, `apps/web/vite.config.ts`, `scripts/vitest.config.ts`, `apps/web/playwright.config.ts` |
| **Quick run command** | `corepack pnpm vitest run --project core packages/core/src/studio && corepack pnpm vitest run --project web apps/web/src/lib/features/studio apps/web/src/lib/ai/prompts/studio && corepack pnpm banned` |
| **Full suite command** | `corepack pnpm verify` (check, lint, banned, unit, build root/sub, csp:assert, e2e, guard, secrets canary/scan, workflow lint) |
| **E2E only (studio)** | `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm --filter web exec playwright test studio-listing snapshot-builder snapshot-print studio-social studio-reel studio-keyless` |
| **Estimated runtime** | quick < 30 s; studio E2E ~3-4 min warm; full verify ~6-9 min warm |

---

## Sampling Rate

- **After every task commit:** the task's own `<automated>` command (always ≤ the quick run scope, plus `corepack pnpm banned` whenever studio UI copy changed).
- **After every plan wave:** `corepack pnpm vitest run` (all projects) + `corepack pnpm build:root` + the studio E2E specs that exist so far.
- **Before `/gsd:verify-work`:** `corepack pnpm verify` green on root and sub bases (plan 09-23).
- **Max feedback latency:** 30 s for unit-level tasks; E2E tasks run only their own spec.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 1 | STU-01, STU-02, STU-04 | unit + property | `corepack pnpm vitest run --project core disclosure-format` | ✅ | ✅ green |
| 9-01-02 | 01 | 1 | STU-02 | unit | `corepack pnpm vitest run --project core studio` (team-name) | ✅ | ✅ green |
| 9-02-01 | 02 | 1 | STU-01, STU-02, STU-03 | unit (regression) | `corepack pnpm vitest run --project core && corepack pnpm vitest run --project web` | ✅ | ✅ green |
| 9-02-02 | 02 | 1 | STU-01, STU-02, STU-03 | unit | `corepack pnpm vitest run --project core numbers allowed-numbers` | ✅ | ✅ green |
| 9-03-01 | 03 | 1 | STU-01 | unit | `corepack pnpm vitest run --project core listing-facts` | ✅ | ✅ green |
| 9-03-02 | 03 | 1 | STU-01 | unit | `corepack pnpm vitest run --project core studio` (unsupported-claims) | ✅ | ✅ green |
| 9-04-01 | 04 | 1 | STU-01, STU-02 | unit (RED) | `corepack pnpm vitest run --project core listing-additions` (must fail) | ✅ | ✅ green |
| 9-04-02 | 04 | 1 | STU-01, STU-02 | unit + leave-one-out | `corepack pnpm vitest run --project core fair-housing` | ✅ | ✅ green |
| 9-05-01 | 05 | 1 | STU-04 | unit | `corepack pnpm vitest run --project core snapshot-metrics` | ✅ | ✅ green |
| 9-05-02 | 05 | 1 | STU-04 | unit | `corepack pnpm vitest run --project core studio` (snapshot-facts) | ✅ | ✅ green |
| 9-06-01 | 06 | 1 | STU-02 | unit | `corepack pnpm vitest run --project core social-sections` | ✅ | ✅ green |
| 9-06-02 | 06 | 1 | STU-03 | unit | `corepack pnpm vitest run --project core studio` (reel) | ✅ | ✅ green |
| 9-07-01 | 07 | 1 | STU-01..04 | unit (RED) | `corepack pnpm vitest run --project scripts banned-terms` (must fail) | ✅ | ✅ green |
| 9-07-02 | 07 | 1 | STU-01..04 | unit + CLI non-vacuity | `corepack pnpm vitest run --project scripts banned-terms && corepack pnpm banned` | ✅ | ✅ green |
| 9-08-01 | 08 | 1 | STU-01 | unit (SSR) | `corepack pnpm vitest run --project web apps/web/src/lib/ai` | ✅ | ✅ green |
| 9-08-02 | 08 | 1 | STU-04 | unit (SSR) | `corepack pnpm vitest run --project web shared` | ✅ | ✅ green |
| 9-09-01 | 09 | 1 | STU-01..04 | build + e2e | `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert && corepack pnpm --filter web exec playwright test routing csp a11y routes-drift` | ✅ | ✅ green |
| 9-09-02 | 09 | 1 | STU-04 | e2e | `corepack pnpm build:root && corepack pnpm --filter web exec playwright test agent routing --project=root` | ✅ | ✅ green |
| 9-10-01 | 10 | 2 | STU-01..04 | unit | `corepack pnpm vitest run --project core` | ✅ | ✅ green |
| 9-10-02 | 10 | 2 | STU-04 | unit (import graph) | `corepack pnpm vitest run --project scripts agent-boundary && corepack pnpm vitest run --project web && corepack pnpm guard` | ✅ | ✅ green |
| 9-11-01 | 11 | 3 | STU-01, STU-04 | unit (fake-indexeddb) | `corepack pnpm vitest run --project web studio-storage schema-registry` | ✅ | ✅ green |
| 9-11-02 | 11 | 3 | STU-01 | unit (fake timers) | `corepack pnpm vitest run --project web studio-storage` | ✅ | ✅ green |
| 9-12-01 | 12 | 4 | STU-01, STU-04 | unit (SSR) | `corepack pnpm vitest run --project web studio-components && corepack pnpm banned` | ✅ | ✅ green |
| 9-12-02 | 12 | 4 | STU-01, STU-04 | unit + e2e | `corepack pnpm build:root && corepack pnpm --filter web exec playwright test routing a11y --project=root` | ✅ | ✅ green |
| 9-13-01 | 13 | 3 | STU-01, STU-04 | unit | `corepack pnpm vitest run --project web post-checks` | ✅ | ✅ green |
| 9-13-02 | 13 | 3 | STU-01, STU-04 | unit (zero-findings samples, planted $2,450) | `corepack pnpm vitest run --project web prompts/studio post-checks` | ✅ | ✅ green |
| 9-14-01 | 14 | 4 | STU-04 | unit (call count 0/1/2) | `corepack pnpm vitest run --project web snapshot-calls` | ✅ | ✅ green |
| 9-14-02 | 14 | 4 | STU-04 | unit + guard | `corepack pnpm vitest run --project web build-record && corepack pnpm guard` | ✅ | ✅ green |
| 9-15-01 | 15 | 5 | STU-01 | unit | `corepack pnpm vitest run --project web listing-count` | ✅ | ✅ green |
| 9-15-02 | 15 | 5 | STU-01 | e2e + axe | `corepack pnpm --filter web exec playwright test studio-listing` | ✅ | ✅ green |
| 9-16-01 | 16 | 5 | STU-04 | unit (SSR) | `corepack pnpm vitest run --project web snapshot-components` | ✅ | ✅ green |
| 9-16-02 | 16 | 5 | STU-04 | unit (SSR) | `corepack pnpm vitest run --project web snapshot-components` | ✅ | ✅ green |
| 9-17-01 | 17 | 6 | STU-04 | unit | `corepack pnpm vitest run --project web save-gate snapshot-components` | ✅ | ✅ green |
| 9-17-02 | 17 | 6 | STU-04 | e2e + axe (budget 0/1/2) | `corepack pnpm --filter web exec playwright test snapshot-builder` | ✅ | ✅ green |
| 9-18-01 | 18 | 6 | STU-04 | unit (SSR) | `corepack pnpm vitest run --project web snapshot-report` | ✅ | ✅ green |
| 9-18-02 | 18 | 6 | STU-04 | unit (import graph) + e2e print media + axe | `corepack pnpm vitest run --project web boundaries && corepack pnpm --filter web exec playwright test snapshot-print` | ✅ | ✅ green |
| 9-19-01 | 19 | 7 | STU-02 | unit | `corepack pnpm vitest run --project web social.v1` | ✅ | ✅ green |
| 9-19-02 | 19 | 7 | STU-02 | unit (SSR exit count + property) | `corepack pnpm vitest run --project web apps/web/src/lib/ai` | ✅ | ✅ green |
| 9-20-01 | 20 | 8 | STU-02 | unit | `corepack pnpm vitest run --project web social-sections-spec` | ✅ | ✅ green |
| 9-20-02 | 20 | 8 | STU-02 | e2e + axe | `corepack pnpm --filter web exec playwright test studio-social` | ✅ | ✅ green |
| 9-21-01 | 21 | 8 | STU-03 | unit | `corepack pnpm vitest run --project web reel-checks && corepack pnpm banned` | ✅ | ✅ green |
| 9-21-02 | 21 | 8 | STU-03 | unit (zero-findings samples) | `corepack pnpm vitest run --project web reel` | ✅ | ✅ green |
| 9-22-01 | 22 | 9 | STU-03 | unit (SSR) | `corepack pnpm vitest run --project web reel-view` | ✅ | ✅ green |
| 9-22-02 | 22 | 9 | STU-03 | e2e + axe | `corepack pnpm --filter web exec playwright test studio-reel` | ✅ | ✅ green |
| 9-23-01 | 23 | 10 | STU-01..04 | e2e (keyless, no-network, axe matrix) + scripts | `corepack pnpm --filter web exec playwright test studio-keyless && corepack pnpm vitest run --project scripts banned-terms` | ✅ | ✅ green |
| 9-23-02 | 23 | 10 | STU-01..04 | full gate | `corepack pnpm verify` | ✅ | ✅ green (run step by step, see 09-23-VERIFY-PROGRESS.md) |
| 9-24-01 | 24 | 1 | STU-01, STU-03 | unit (gap: stale-gate exits) | `corepack pnpm vitest run --project web apps/web/src/lib/ai/ui/panel-state.test.ts` | ✅ | ✅ green |
| 9-24-02 | 24 | 1 | STU-01, STU-03 | browser (gap: panel exits + email href) | `corepack pnpm vitest run --project web-browser apps/web/src/lib/ai/ui/GenerationPanel.browser.test.ts` | ✅ | ✅ green |
| 9-24-03 | 24 | 1 | STU-02 | browser (gap: card Copy) | `corepack pnpm vitest run --project web-browser apps/web/src/lib/ai/ui/PlatformCard.browser.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Success criterion → evidence

| ROADMAP SC | Evidence |
|------------|----------|
| SC1 listing + checker gating | 09-04 lexicon additions, 09-13 zero-findings sample + number check, 09-15 E2E (Must fix gates Copy; Use alternative re-enables; copy ends with disclosure) |
| SC2 post pack + disclosure | 09-01 disclosure-last property, 09-19 sections-mode SSR exit count + property, 09-20 E2E (three cards, counts, over-limit gate, parse error) |
| SC3 reel script | 09-06 timing/placeholder unit tests, 09-21 checklist + results/quote checks, 09-22 E2E (30/60 s slots, placeholder rule, checklist in copy) |
| SC4 branded snapshot, labelled, print to PDF | 09-05 metrics/allowed numbers, 09-14 frozen record, 09-18 SSR + print-media E2E (labels, prominence, EHO/footer, PDF page count), 09-23 options + brand fallback through the UI |
| SC5 demo-credible | 09-14 call-count 0/1/2 test, 09-17 mocked-key budget E2E, 09-07/09-23 banned-terms scope, 09-18 import-graph boundaries, 09-23 keyless no-network + axe matrix |

---

## Wave 0 Requirements

Wave 0 is folded into each TDD plan's RED step (tests are written first in the same plan). Infrastructure prerequisites:

- [x] `packages/core/src/numbers/` exposes the Phase 7 extractor/matcher (09-02 Task 1)
- [x] `@tran/core/studio` barrel (09-10 Task 1)
- [x] Phase 8 profile fields `licenseType`, `teamName`, `brokeragePhone` present (09-10 contingency if not)
- [x] `apps/web/tests/e2e/routes.ts` STUDIO_ROUTES + EXPECTED_PAGES (09-09)
- [x] Import-graph helper `tooling/import-graph.ts` from Phase 8 reused by 09-10 and 09-18
- [x] No framework install needed: Vitest, Playwright, axe and fake-indexeddb already present (no new dependency is allowed this phase; 09-23 checks the diff)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-key snapshot prints correctly in Chrome, Firefox and Safari (sample lines, brand band fill, 1-4 pages) | STU-04 | Only Chromium is automated; Firefox/Safari print engines differ (RESEARCH Open Question 4) | 09-HUMAN-UAT.md item (a) |
| Pasted social posts fit the real Instagram/Facebook/LinkedIn composers and hashtag caps | STU-02 | Platform counting is undocumented (RESEARCH Open Question 5) | 09-HUMAN-UAT.md item (b) |
| NY and CA sample disclosures read correctly against the rule text | STU-02, STU-04 | Legal read-through, not legal advice | 09-HUMAN-UAT.md item (c) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (tests are created in each plan's RED step)
- [x] No watch-mode flags
- [x] Feedback latency < 30 s for unit tasks
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-07 (09-23: every row green; `corepack pnpm verify` run step by step on one core because Node must be pinned to a single core on this machine; results in 09-23-VERIFY-PROGRESS.md)
