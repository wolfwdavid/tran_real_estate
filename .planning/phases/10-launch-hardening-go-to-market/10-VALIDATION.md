---
phase: 10
slug: launch-hardening-go-to-market
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-04
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11 (projects `web`, `core`, `brand`, `scripts`); Playwright 1.63.0 + @axe-core/playwright 4.13.0 (projects `root`, `sub`, and new `configured` on port 4276); Node build oracles `scripts/assert-csp.mjs` (extended), new `scripts/assert-seo.mjs`, new `scripts/assert-budget.mjs`; generator `scripts/launch-audit.mjs` |
| **Config file** | `vitest.config.ts`, `apps/web/vite.config.ts` (`define`), `apps/web/playwright.config.ts` (+ `configured` project), `scripts/serve-pages.mjs` (MIME types, configured listener, beacon collector), `scripts/lib/build-targets.mjs` (root / sub / configured env) |
| **Quick run command** | `corepack pnpm lint && corepack pnpm banned && corepack pnpm test:unit` |
| **E2E run (needs builds)** | `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm build:configured && corepack pnpm csp:assert && corepack pnpm test:e2e` |
| **Full suite command** | `corepack pnpm verify` (after 10-23: adds `seo:assert`, `budget:assert`, `audit:deps`), then `corepack pnpm audit:launch` |
| **Estimated runtime** | quick ~40 s; full ~4-6 min warm (three builds + three Playwright projects) |

---

## Sampling Rate

- **After every task commit:** `corepack pnpm check && corepack pnpm lint && corepack pnpm banned` plus the task's own `<automated>` command
- **After every plan wave:** the E2E run above (three builds, CSP oracle, all Playwright projects); from wave 6 on also `node scripts/assert-seo.mjs apps/web/build --target root` and `node scripts/assert-budget.mjs apps/web/build --require-tools`
- **Before `/gsd:verify-work`:** `corepack pnpm verify` green in one invocation and `corepack pnpm audit:launch` exit 0 (plan 10-23)
- **Max feedback latency:** ~40 s for unit/lint/banned; E2E needs the three builds (~2-3 min)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | GTM-01..04 | gate + contract map | `node -e "…10-CONTRACT-MAP.md has no TBD and all rows…"` | ❌ W0 (10-CONTRACT-MAP.md) | ✅ green |
| 10-01-02 | 01 | 1 | GTM-02, GTM-04 | unit (TDD) | `corepack pnpm vitest run --project web site-config` | ❌ W0 | ✅ green |
| 10-01-03 | 01 | 1 | GTM-03 | unit + builds + E2E | `corepack pnpm vitest run --project web site && corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert && corepack pnpm test:e2e` | ❌ W0 (site.ts) | ✅ green |
| 10-02-01 | 02 | 2 | GTM-04 | unit (TDD) + oracle | `corepack pnpm vitest run --project web csp-policy && corepack pnpm build:root && node scripts/assert-csp.mjs apps/web/build` | ❌ W0 | ✅ green |
| 10-02-02 | 02 | 2 | GTM-03, GTM-04 | unit mutation (oracle) | `corepack pnpm vitest run --project scripts build-targets assert-csp && corepack pnpm csp:assert` | ✅ extend | ✅ green |
| 10-03-01 | 03 | 2 | GTM-01..04 | lint rule tests | `corepack pnpm vitest run --project scripts eslint-rules && corepack pnpm lint` | ✅ extend | ✅ green |
| 10-03-02 | 03 | 2 | GTM-03 | unit + CLI | `corepack pnpm vitest run --project scripts banned-terms && corepack pnpm banned` | ✅ extend | ✅ green |
| 10-04-01 | 04 | 2 | audit (SC5) | CLI | `corepack pnpm audit:deps && corepack pnpm install --frozen-lockfile && corepack pnpm build:root` | n/a | ✅ green |
| 10-04-02 | 04 | 2 | audit (SC5) | unit | `corepack pnpm vitest run --project scripts supply-chain && corepack pnpm lint:workflows` | ❌ W0 | ✅ green |
| 10-05-01 | 05 | 3 | GTM-02, GTM-04 | E2E harness smoke | `node scripts/build-web.mjs configured && corepack pnpm --filter web exec playwright test harness --project=configured` | ❌ W0 | ✅ green |
| 10-05-02 | 05 | 3 | GTM-02, GTM-04 | unit (workflow) + full E2E | `corepack pnpm vitest run --project scripts workflow-gate && corepack pnpm lint:workflows && … && corepack pnpm test:e2e` | ✅ extend | ✅ green |
| 10-06-01 | 06 | 3 | GTM-04 | unit (TDD) | `corepack pnpm vitest run --project web analytics/payload analytics/consent` | ❌ W0 | ✅ green |
| 10-06-02 | 06 | 3 | GTM-04 | unit (TDD, injected fetch) | `corepack pnpm vitest run --project web analytics` | ❌ W0 | ✅ green |
| 10-07-01 | 07 | 3 | GTM-03 | unit (TDD) | `corepack pnpm vitest run --project web seo/jsonld seo/paths && corepack pnpm audit:deps` | ❌ W0 | ✅ green |
| 10-07-02 | 07 | 3 | GTM-03 | unit (dark-pixel, non-vacuity, determinism) | `corepack pnpm vitest run --project web seo` | ❌ W0 | ✅ green |
| 10-08-01 | 08 | 2 | GTM-03 | unit (TDD, exact UI-SPEC examples) | `corepack pnpm vitest run --project core calculators` | ❌ W0 | ✅ green |
| 10-08-02 | 08 | 2 | GTM-03 | unit (TDD) | `corepack pnpm vitest run --project core tool-inputs calculators` | ❌ W0 | ✅ green |
| 10-09-01 | 09 | 3 | GTM-03 | unit mutation (oracle on fixtures) | `corepack pnpm vitest run --project scripts assert-seo` | ❌ W0 | ✅ green |
| 10-09-02 | 09 | 3 | GTM-03 | unit mutation (planted 200 KB chunk) | `corepack pnpm vitest run --project scripts assert-budget` | ❌ W0 | ✅ green |
| 10-10-01 | 10 | 4 | GTM-03 | unit (content) | `corepack pnpm vitest run --project web content/tools && corepack pnpm banned` | ❌ W0 | ✅ green |
| 10-10-02 | 10 | 4 | GTM-03 | unit + build artifacts | `corepack pnpm vitest run --project web seo/sitemap && corepack pnpm build:root && corepack pnpm build:sub && <8 files + IHDR check> && corepack pnpm csp:assert` | ❌ W0 | ✅ green |
| 10-11-01 | 11 | 5 | GTM-03 | build oracle | `node scripts/assert-seo.mjs apps/web/build --target root --min-urls 8` (+ sub) | ✅ (10-09) | ✅ green |
| 10-11-02 | 11 | 5 | GTM-03 | E2E | `corepack pnpm --filter web exec playwright test seo --project=root --project=sub` | ❌ W0 | ✅ green |
| 10-12-01 | 12 | 5 | GTM-03 | unit (TDD) | `corepack pnpm vitest run --project web calculator-form` | ❌ W0 | ✅ green |
| 10-12-02 | 12 | 5 | GTM-03 | check + lint + banned | `corepack pnpm check && corepack pnpm lint && corepack pnpm banned` | n/a | ✅ green |
| 10-13-01 | 13 | 6 | GTM-03 | check + lint + banned | `corepack pnpm check && corepack pnpm lint && corepack pnpm banned` | n/a | ✅ green |
| 10-13-02 | 13 | 6 | GTM-03 | oracles + full E2E | `… assert-seo --min-urls 12 && assert-budget --require-tools && corepack pnpm test:e2e` | ✅ | ✅ green |
| 10-14-01 | 14 | 7 | GTM-03 | oracles + full E2E | `… assert-seo --min-urls 13 && assert-budget --require-tools && corepack pnpm test:e2e` | ✅ | ✅ green |
| 10-14-02 | 14 | 7 | GTM-03 | E2E (zero requests, example figures, JSON-LD runtime, axe states) | `corepack pnpm --filter web exec playwright test tools --project=root --project=sub` | ❌ W0 | ✅ green |
| 10-15-01 | 15 | 6 | GTM-01 | unit (TDD, SSR-safe, corrupt state) | `corepack pnpm vitest run --project web onboarding-state && corepack pnpm banned` | ❌ W0 | ✅ green |
| 10-15-02 | 15 | 6 | GTM-01 | build + prerender content + full E2E | `… build:* && csp:assert && <landing contains step 0> && corepack pnpm test:e2e` | ✅ | ✅ green |
| 10-16-01 | 16 | 8 | GTM-01 | unit + build | `corepack pnpm vitest run --project web setup-params && … build:root && csp:assert` | ❌ W0 | ✅ green |
| 10-16-02 | 16 | 8 | GTM-01 | full E2E (no portal regression) | `… build:* && csp:assert && corepack pnpm test:e2e` | ✅ | ✅ green |
| 10-17-01 | 17 | 6 | GTM-02 | unit (TDD; Phase 8 sink unchanged) | `corepack pnpm vitest run --project web form-gate owner-forms web3forms-sink` | ❌ W0 | ✅ green |
| 10-17-02 | 17 | 6 | GTM-02 | build HTML + full E2E | `… build:* && csp:assert && corepack pnpm test:e2e` | ✅ | ✅ green |
| 10-17-03 | 17 | 6 | GTM-02 | E2E (mocked Web3Forms, honeypot/timing, coming-soon) | `corepack pnpm --filter web exec playwright test waitlist` | ❌ W0 | ✅ green |
| 10-18-01 | 18 | 9 | GTM-02 | unit + oracle (14 URLs) | `corepack pnpm vitest run --project web feedback-counter && … assert-seo --min-urls 14` | ❌ W0 | ✅ green |
| 10-18-02 | 18 | 9 | GTM-01, GTM-02 | full E2E | `… build:* && csp:assert && corepack pnpm test:e2e` | ✅ | ✅ green |
| 10-18-03 | 18 | 9 | GTM-01, GTM-02 | E2E (key scan, gates, Settings restart) | `corepack pnpm --filter web exec playwright test feedback` | ❌ W0 | ✅ green |
| 10-19-01 | 19 | 6 | GTM-02, GTM-04 | build HTML variants + oracle | `… build:root && build:configured && <privacy variants> && csp:assert` | ✅ | ✅ green |
| 10-19-02 | 19 | 6 | GTM-04 | doc content check | `node -e "…DEPLOY-CHECKLIST Step 8 strings…" && corepack pnpm lint` | ✅ extend | ✅ green |
| 10-19-03 | 19 | 6 | GTM-04 | E2E (third-party none; beacon schema, no cookie/referer/preflight, GPC/DNT) — analytics spec is the first cut | `corepack pnpm --filter web exec playwright test third-party analytics` | ❌ W0 | ✅ green |
| 10-20-01 | 20 | 9 | GTM-01 | E2E + axe per guide state | `corepack pnpm --filter web exec playwright test onboarding --project=root --project=sub` | ❌ W0 | ✅ green |
| 10-20-02 | 20 | 9 | GTM-01 | E2E (mocked RentCast, cap 40, sample hand-off) | `corepack pnpm --filter web exec playwright test setup-rentcast --project=root --project=sub` | ❌ W0 | ✅ green |
| 10-20-03 | 20 | 9 | GTM-01 | E2E perf (CLS < 0.1, 375/1280, first + returning) | `corepack pnpm --filter web exec playwright test perf --project=root` | ❌ W0 | ✅ green |
| 10-21-01 | 21 | 10 | audit (SC5) | E2E axe keyless + keyed, drift, oracle unit | `corepack pnpm vitest run --project scripts assert-csp && … && playwright test a11y routes-drift` | ✅ extend | ✅ green |
| 10-21-02 | 21 | 10 | audit (SC5) | E2E (disclaimer presence) | `corepack pnpm --filter web exec playwright test disclaimers --project=root --project=sub` | ❌ W0 | ✅ green |
| 10-22-01 | 22 | 4 | audit (SC5) | unit (PITFALLS coverage, non-vacuity) | `corepack pnpm vitest run --project scripts launch-audit` | ❌ W0 | ✅ green |
| 10-22-02 | 22 | 4 | audit (SC5) | unit (renderer, fail-honest statuses) | `corepack pnpm vitest run --project scripts launch-audit && corepack pnpm lint` | ❌ W0 | ✅ green |
| 10-23-01 | 23 | 11 | audit (SC5) | unit (workflow) + actionlint | `corepack pnpm vitest run --project scripts workflow-gate && corepack pnpm lint:workflows` | ✅ extend | ✅ green |
| 10-23-02 | 23 | 11 | GTM-01..04 | composed gate + generated audit | `corepack pnpm verify && corepack pnpm audit:launch && <LAUNCH-AUDIT sections, no FAIL>` | ❌ W0 (docs/LAUNCH-AUDIT.md) | ⚠️ flaky (environment: full single `vitest run` hit a VirtualAlloc failure from external memory pressure, green per project 6290/6290; first E2E shard at 8 workers hit 6 x 30 s timeouts beside an external llama-server using ~8 cores, green at 4 workers; see 10-23-SUMMARY) |
| 10-23-03 | 23 | 11 | GTM-01..04 | doc check | `node -e "…10-HUMAN-UAT.md + VALIDATION sign-off…"` | ❌ W0 | ✅ green |

*Status legend: ⬜ = pending · ✅ = green · ❌ = red · ⚠️ = flaky*

Sampling continuity: every task has an automated command; the longest run of build-only/check-only tasks is one (10-12-02, 10-13-01), each followed by a task with tests.

---

## Wave 0 Requirements

- [x] `10-CONTRACT-MAP.md` — Phase 2-9 real names (10-01 Task 1; plan stops if Phases 2-9 are not executed)
- [x] `apps/web/src/lib/site-config.js` + `site-config.test.ts`, `site.ts` + `site.test.ts`, `app.d.ts` globals, ESLint globals, Vite `define`, `prerender.origin` (10-01)
- [x] `apps/web/src/lib/csp-policy.js` + test; `scripts/lib/build-targets.mjs` + test; `scripts/assert-csp.mjs` ld+json exemption, optional analytics host, `--target` + mutation tests (10-02)
- [x] ESLint: `lib/analytics` fetch allowlist + marketing-safe import boundary + rule tests; banned-terms SCOPE (10-03)
- [x] `pnpm audit` clean + `audit.ignore` + `scripts/lib/audit-exceptions.mjs` + dependabot npm + `scripts/supply-chain.test.ts` (10-04)
- [x] `scripts/serve-pages.mjs` MIME types, configured listener, beacon collector; Playwright `configured` project; `tests/e2e/site-env.ts`; CI configured leg (10-05)
- [x] `scripts/assert-seo.mjs`, `scripts/assert-budget.mjs` + fixture tests (10-09); `scripts/launch-audit.mjs` + `scripts/lib/pitfalls-evidence.mjs` + tests (10-22)
- [x] Test files created test-first inside their feature plans: analytics (10-06), seo libs (10-07), core calculators (10-08), tools content/sitemap (10-10), calculator form (10-12), onboarding state (10-15), setup params (10-16), form gate/owner sink (10-17), feedback counter (10-18)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Umami receives pageviews from the deployed origin; none with GPC; IPs not stored | GTM-04 | Needs the owner's Umami site and the deployed Pages origin | DEPLOY-CHECKLIST Step 8.1; record in 10-HUMAN-UAT.md. Cut line: no events → remove the vars, move GTM-04 to v2, record in PROJECT.md |
| Waitlist and feedback emails arrive with the portal/topic subject; captcha off | GTM-02 | Needs the owner's Web3Forms key and inbox | DEPLOY-CHECKLIST Step 8.2 |
| Share cards render on real platforms | GTM-03 | Third-party scrapers | DEPLOY-CHECKLIST Step 8.5 (link-preview debugger) |
| Sitemap accepted by Search Console | GTM-03 | Needs the domain property | DEPLOY-CHECKLIST Step 8.4 |
| Live-origin PITFALLS rows (deep-link refresh, provider key tests from the deployed URL, Safari persistence, push protection) | audit (SC5) | Live origin / real devices only | DEPLOY-CHECKLIST Step 7 and Step 8.6; listed as DEFERRED (human) in docs/LAUNCH-AUDIT.md |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < 10s: not met (quick loop is ~40 s with three Vitest projects plus lint); accepted, same as Phases 1-2
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-14 (plan 10-23: composed gate green, docs/LAUNCH-AUDIT.md every Summary row PASS, owner items in 10-HUMAN-UAT.md)
</content>
</invoke>
