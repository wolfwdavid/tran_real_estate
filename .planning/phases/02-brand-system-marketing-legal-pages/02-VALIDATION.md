---
phase: 2
slug: brand-system-marketing-legal-pages
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-04
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11 (projects `web`, `core`, `brand` (new in 02-01), `scripts`); Playwright 1.63.0 + @axe-core/playwright 4.13.0 (projects `root`, `sub`); build oracle `scripts/assert-csp.mjs`; copy gate `scripts/banned-terms.mjs` (new in 02-02) |
| **Config file** | `vitest.config.ts` (root projects), `packages/brand/vitest.config.ts` (new), `apps/web/vite.config.ts`, `apps/web/playwright.config.ts` (unchanged) |
| **Quick run command** | `corepack pnpm lint && corepack pnpm banned && corepack pnpm test:unit` |
| **E2E run (needs builds)** | `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert && corepack pnpm test:e2e` |
| **Full suite command** | `corepack pnpm verify` (includes `banned` and `lint:workflows`) |
| **Estimated runtime** | quick ~30 s; full ~1.5-2 min warm (Phase 1 baseline 71-79 s plus new specs) |

---

## Sampling Rate

- **After every task commit:** `corepack pnpm check && corepack pnpm lint && corepack pnpm banned` plus the task's own `<automated>` command (the pre-commit hook runs gitleaks staged + real-data guard automatically)
- **After every plan wave:** `corepack pnpm verify`
- **Before `/gsd:verify-work`:** `corepack pnpm verify` green in one invocation (plan 02-12)
- **Max feedback latency:** ~30 s for unit/lint/banned; E2E needs both builds (~60 s)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | BRND-03 | unit harness | `corepack pnpm vitest run --project brand` (RED expected) | ❌ W0 (packages/brand/vitest.config.ts) | ✅ green |
| 2-01-02 | 01 | 1 | BRND-01, BRND-03 | unit (contrast + planted failure) | `corepack pnpm vitest run --project brand && corepack pnpm --filter @tran/brand check` | ❌ W0 (packages/brand/src/contrast.test.ts) | ✅ green |
| 2-02-01 | 02 | 1 | BRND-02, BRND-04 | unit + CLI non-vacuity | `corepack pnpm vitest run --project scripts banned-terms && node scripts/banned-terms.mjs` | ❌ W0 (scripts/banned-terms.test.ts) | ✅ green |
| 2-02-02 | 02 | 1 | BRND-02, BRND-04 | unit (workflow gate, mutation-checked) | `corepack pnpm vitest run --project scripts workflow-gate && corepack pnpm lint:workflows` | ✅ modify | ✅ green |
| 2-03-01 | 03 | 2 | BRND-01 | build | `corepack pnpm check && corepack pnpm build:root && node scripts/assert-csp.mjs apps/web/build` | ✅ | ✅ green |
| 2-03-02 | 03 | 2 | BRND-01, BRND-03 | unit (parity + mutation + raw-hex ban) | `corepack pnpm vitest run --project web theme-parity` | ❌ W0 (apps/web/src/lib/brand/theme-parity.test.ts) | ✅ green |
| 2-03-03 | 03 | 2 | BRND-01 | unit + build oracle (data: URIs) | `corepack pnpm vitest run --project scripts assert-csp && corepack pnpm csp:assert` | ✅ extend | ✅ green |
| 2-04-01 | 04 | 3 | BRND-05 | check + lint | `corepack pnpm check && corepack pnpm lint && corepack pnpm banned` | ✅ | ✅ green |
| 2-04-02 | 04 | 3 | BRND-04 | check + oracle unit | `corepack pnpm check && corepack pnpm banned && corepack pnpm vitest run --project scripts assert-csp` | ✅ | ✅ green |
| 2-04-03 | 04 | 3 | BRND-03, BRND-04, BRND-05 | build + E2E (Phase 1 suite) | `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert && corepack pnpm test:e2e` | ✅ modify routing.spec | ✅ green |
| 2-05-01 | 05 | 4 | BRND-03 | E2E (all 13 routes) | `corepack pnpm --filter web exec playwright test routing csp a11y` | ❌ W0 (tests/e2e/routes.ts) | ✅ green |
| 2-05-02 | 05 | 4 | BRND-03 | E2E drift guard (mutation-checked) | `corepack pnpm --filter web exec playwright test routes-drift` | ❌ W0 (tests/e2e/routes-drift.spec.ts) | ✅ green |
| 2-06-01 | 06 | 4 | BRND-01 | check + lint + banned + parity | `corepack pnpm check && corepack pnpm lint && corepack pnpm banned && corepack pnpm vitest run --project web theme-parity` | ✅ | ✅ green |
| 2-06-02 | 06 | 4 | BRND-01 | build + E2E | `corepack pnpm build:root && node scripts/assert-csp.mjs apps/web/build && corepack pnpm --filter web exec playwright test a11y csp routing --project=root` | ✅ | ✅ green |
| 2-07-01 | 07 | 4 | BRND-02 | unit (content shape + banned) | `corepack pnpm vitest run --project web audiences` | ❌ W0 (apps/web/src/lib/content/audiences.test.ts) | ✅ green |
| 2-07-02 | 07 | 4 | BRND-02 | build + E2E | `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert && corepack pnpm --filter web exec playwright test a11y csp routing` | ✅ | ✅ green |
| 2-08-01 | 08 | 4 | BRND-04 | check + lint + banned | `corepack pnpm check && corepack pnpm lint && corepack pnpm banned` | ✅ | ✅ green |
| 2-08-02 | 08 | 4 | BRND-04 | build + E2E + guard | `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert && corepack pnpm guard && corepack pnpm --filter web exec playwright test a11y csp routing` | ✅ | ✅ green |
| 2-09-01 | 09 | 4 | BRND-05 | check + lint + banned | `corepack pnpm check && corepack pnpm lint && corepack pnpm banned` | ✅ | ✅ green |
| 2-09-02 | 09 | 4 | BRND-05 | E2E (CSP transition probe kept) | `corepack pnpm build:root && corepack pnpm --filter web exec playwright test csp a11y --project=root` | ✅ | ✅ green |
| 2-10-01 | 10 | 5 | BRND-01, BRND-04, BRND-05 | E2E (landmarks, raw aria-current, footer legal 200s, same-origin + fonts with bypassCSP control) | `corepack pnpm --filter web exec playwright test layout` | ❌ W0 (tests/e2e/layout.spec.ts) | ✅ green |
| 2-10-02 | 10 | 5 | BRND-03, BRND-05 | E2E (375/640, disclosure keyboard, text spacing, planted-overflow control, aria-current mutation) | `corepack pnpm --filter web exec playwright test layout` | ❌ W0 (tests/e2e/layout.spec.ts) | ✅ green |
| 2-11-01 | 11 | 5 | BRND-01, BRND-02, BRND-04 | E2E (content contracts, rendered banned-terms, unique descriptions) | `corepack pnpm --filter web exec playwright test marketing` | ❌ W0 (tests/e2e/marketing.spec.ts) | ✅ green |
| 2-11-02 | 11 | 5 | BRND-03 | E2E axe (1280, 375, 404, menu open) | `corepack pnpm --filter web exec playwright test a11y` | ✅ extend | ✅ green |
| 2-12-01 | 12 | 6 | BRND-01..05 | full gate | `corepack pnpm install --frozen-lockfile && corepack pnpm verify` | ✅ | ✅ green |
| 2-12-02 | 12 | 6 | BRND-01..05 | docs + hygiene | `corepack pnpm lint && corepack pnpm guard && corepack pnpm secrets:scan` | ✅ | ✅ green |

*Status: ✅ green · ❌ red · ⚠️ flaky (every row walked in 02-12; none left unrun)*

### Success criterion → proof

| Phase 2 success criterion | Proven by |
|---------------------------|-----------|
| 1. Warm-editorial landing, serif headings, self-hosted fonts, no third-party requests, routes to 3 portals | 2-01-02 tokens, 2-03-01/03 fonts + data: oracle, 2-03-02 parity, 2-10-01 same-origin + fonts loaded, 2-11-01 landing contract |
| 2. For Renters/Investors/Agents pages; no brokerage/appraisal/advice language; no fabricated testimonials or metrics | 2-07-01/02, 2-02-01 banned gate (source), 2-11-01 rendered banned check + audience contract |
| 3. Privacy, terms, Fair Housing, data coverage reachable from any page | 2-04-02/03 footer + stubs, 2-08-01/02 content, 2-10-01 footer legal links 200 from every route, 2-11-01 verbatim terms sentence |
| 4. Switch portals from any app page | 2-04-01/03 switcher, 2-10-01 landmarks + raw aria-current, 2-10-02 disclosure keyboard + 640 switch |
| 5. axe WCAG 2.2 AA contrast on every page, usable at 375px with no horizontal scroll | 2-01-02 token contrast, 2-05-01 + 2-11-02 axe on all routes (1280/375/404/menu open), 2-10-02 375px overflow + text spacing |

---

## Wave 0 Requirements

Test scaffolds are created inside the plans that need them (RED first where the plan is TDD):

- [x] `packages/brand/vitest.config.ts` + `vitest@4.1.11` devDep + `'packages/brand'` in root `vitest.config.ts` — 02-01 Task 1
- [x] `packages/brand/src/contrast.test.ts` — 02-01 Task 2 (RED before tokens)
- [x] `scripts/banned-terms.test.ts` — 02-02 Task 1 (RED before rules/CLI)
- [x] `apps/web` devDeps: `@fontsource-variable/fraunces@5.3.0`, `@fontsource-variable/inter@5.3.0`, `@lucide/svelte@1.45.0`, `@tran/brand@workspace:*`; `pnpm-workspace.yaml` unchanged — 02-03 Task 1
- [x] `apps/web/src/lib/brand/theme-parity.test.ts` — 02-03 Task 2 (RED before @theme)
- [x] `data:` URI tests in `scripts/assert-csp.test.ts` — 02-03 Task 3 (RED before checkAssetText)
- [x] Stubs for all 7 new routes in the same plan as the footer — 02-04 Task 2
- [x] `apps/web/tests/e2e/routes.ts` + specs refactored to import it — 02-05 Task 1
- [x] `apps/web/tests/e2e/routes-drift.spec.ts` — 02-05 Task 2
- [x] `apps/web/src/lib/content/audiences.test.ts` — 02-07 Task 1 (RED before content)
- [x] `apps/web/tests/e2e/layout.spec.ts` — 02-10
- [x] `apps/web/tests/e2e/marketing.spec.ts` — 02-11

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual polish of the warm-editorial look (texture, marks, type rhythm) on a real phone | BRND-01, BRND-03 | Aesthetic judgement; every functional and contrast property is automated | Optional: open the built site at 375px in a device emulator, compare against 02-UI-SPEC.md |
| Legal copy professional review | BRND-04 | Legal judgement; STATE.md flags it before the public GTM push | Owner action before Phase 10 launch; not a Phase 2 gap |
| Live-origin checks (fonts and pages served from tranrealestate.github.io) | BRND-01 | Hosting is deferred (owner has no org yet) | Covered by docs/DEPLOY-CHECKLIST.md Step 7 once live |

All other phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30 s for unit/lint (E2E requires builds)
- [x] `nyquist_compliant: true` set in frontmatter (planning-time; 02-12 re-confirms after the walk)

**Approval:** approved 2026-10-04 (02-12: `corepack pnpm verify` exit 0 in 102 s; all 26 map rows re-run individually, all green)
