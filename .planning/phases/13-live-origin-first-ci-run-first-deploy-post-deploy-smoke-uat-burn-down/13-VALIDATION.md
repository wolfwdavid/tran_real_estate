---
phase: 13
slug: live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-29
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.12 (scripts project: gate / text / site-url tests), Playwright 1.63.0 (E2E + smoke), actionlint 1.7.12 |
| **Config file** | `vitest.config.ts`, `apps/web/playwright.config.ts`, `apps/web/playwright.smoke.config.ts`, `scripts/actionlint.mjs` |
| **Quick run command** | `pnpm vitest run --project scripts` |
| **Full suite command** | `pnpm verify` (serialized; Playwright chunked into ≤5-minute calls) |
| **Estimated runtime** | quick ~30 s; full ~45-60 min on the dev machine |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --project scripts`
- **After every plan wave:** Run `pnpm lint:workflows && pnpm test:unit`, then the affected Playwright project(s) and `pnpm smoke:local --target sub` (the production twin)
- **Before `/gsd:verify-work`:** Full suite must be green; the live `live-smoke` run on the deployed SHA must be green
- **Max feedback latency:** 30 s (quick), 300 s (smoke:local per target)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-XX-XX | — | — | LIVE-02 | evidence | `gh run view <id> --json conclusion,jobs` | ✅ | ⬜ pending |
| 13-XX-XX | — | — | LIVE-03 | smoke | `pnpm smoke` against the live origin (routing.smoke.ts, version.smoke.ts) | ✅ | ⬜ pending |
| 13-XX-XX | — | — | SMOKE-04 | unit | `pnpm vitest run --project scripts scripts/live-smoke-gate.test.ts` + `pnpm lint:workflows` | ❌ W0 | ⬜ pending |
| 13-XX-XX | — | — | LIVE-08 regression (BASE_PATH) | unit | `pnpm vitest run --project scripts scripts/site-url.test.ts scripts/workflow-gate.test.ts` | ✅ (extend) | ⬜ pending |
| 13-XX-XX | — | — | LIVE-05 (live half) / LIVE-06 | manual + text | `pnpm vitest run --project scripts scripts/app-html.test.ts`; owner proof in `docs/launch-proof/<date>/` | ✅ | ⬜ pending |
| 13-XX-XX | — | — | LIVE-07 | text | ledger row count test (planner names it) + `pnpm audit:launch` | ❌ W0 | ⬜ pending |
| 13-XX-XX | — | — | LIVE-09 | text | runbook section test (planner names it) + `pnpm vitest run --project scripts scripts/deploy-checklist.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*The planner fills the Task ID / Plan / Wave columns from the PLAN.md files; the research file's "Phase Requirements -> Test Map" is the source.*

---

## Wave 0 Requirements

- [ ] `scripts/live-smoke-gate.test.ts` — gate test for `.github/workflows/live-smoke.yml` (SMOKE-04)
- [ ] `scripts/site-url.test.ts` — base-path case (BASE_PATH alone changes extension privacy URL and web absolute URLs)
- [ ] `scripts/workflow-gate.test.ts` — expectations updated for `BASE_PATH` on the root leg
- [ ] ledger / runbook text tests as the planner names them (LIVE-07, LIVE-09)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fresh-profile live checks (landing, redirect, deep refresh, branded 404, HTTPS) | LIVE-03 | Real browser profile on the live CDN | New InPrivate window per check; screenshot into `docs/launch-proof/<date>/` |
| Umami pageviews with GPC respected | LIVE-06 / GTM-04 | Third-party dashboard | Two pages GPC-off, zero with GPC-on; dashboard screenshot (redacted) |
| Web3Forms waitlist + feedback delivery | LIVE-06 / GTM-02 | Owner inbox | Submit on `/for-renters/` and `/feedback/`; inbox screenshot with addresses redacted |
| Share cards in LinkedIn / Facebook debuggers | LIVE-06 / GTM-03 | External tools, logins | Paste `/tools/cap-rate/` URL; screenshot |
| Search Console verified, sitemap read | LIVE-05 / LIVE-06 | Google account | Meta tag commit, Verify, submit sitemap, confirm URL count |
| Push-protection probe | DEPLOY-CHECKLIST Step 7 | Needs a throwaway PAT | Follow the checklist; delete the branch |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 300s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
