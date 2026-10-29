---
phase: 12
slug: go-live-readiness-local-smoke-suite
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-29
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.12 (root `vitest.config.ts` projects: web, core, brand, scripts, web-browser, extension; plus `extension-browser` via `pnpm ext:test:browser`) + Playwright 1.63.0 (`apps/web/playwright.config.ts` E2E; NEW `apps/web/playwright.smoke.config.ts` smoke) |
| **Config file** | `vitest.config.ts`, `scripts/vitest.config.ts`, `apps/web/playwright.config.ts`, `apps/web/playwright.smoke.config.ts` (created in 12-06) |
| **Quick run command** | `corepack pnpm vitest run --project scripts` (~17 s; add `--project web` / `--project extension` when those files change) |
| **Full suite command** | `corepack pnpm verify` (includes `pnpm smoke:local` from 12-10 on) |
| **Estimated runtime** | quick ~17 s; `smoke:local` < 300 s (hard budget, exit 4 if exceeded); full verify ~15-20 min, run in stages of < 7 min each |

---

## Sampling Rate

- **After every task commit:** `corepack pnpm vitest run --project scripts` (plus the project of the files touched) and `node scripts/commit-hygiene.mjs --message-file` runs automatically as the commit-msg hook from 12-01 on
- **After every plan wave:** `corepack pnpm test:unit`; after any build-affecting wave: the three builds + `csp:assert` + `seo:assert`; from wave 5 on: `corepack pnpm smoke:local`; after every wave: `git log --all --format='%(trailers:key=Co-Authored-By,valueonly)' | grep -ciE 'anthropic|claude'` = 0 (from wave 2 on)
- **Before `/gsd:verify-work`:** 12-10 Task 2 phase gate (stages A-G) green at one commit
- **Max feedback latency:** ~20 s for the quick command; smoke runs are per wave, not per commit

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | LIVE-01 (pre-req: green test:unit) | unit | `corepack pnpm vitest run --project scripts scripts/launch-audit.test.ts` | ✅ (11 red today) | ⬜ pending |
| 12-01-02 | 01 | 1 | LIVE-01 | unit + hook | `corepack pnpm vitest run --project scripts scripts/commit-hygiene.test.ts scripts/precommit.test.ts` | ❌ W0 (created in task) | ⬜ pending |
| 12-02-01 | 02 | 2 | LIVE-01 | CLI assertion | `test "$(git log --all --format='%(trailers:key=Co-Authored-By,valueonly)' \| grep -ciE 'anthropic\|claude')" = 0 && node scripts/commit-hygiene.mjs --history && corepack pnpm secrets:scan && corepack pnpm secrets:canary` | ✅ | ⬜ pending |
| 12-02-02 | 02 | 2 | LIVE-01 | script check | `node <$BK>/remap-hashes.mjs --check && corepack pnpm secrets:scan && corepack pnpm secrets:canary` (+ no-allowlist gitleaks report = exactly 2 findings) | ❌ one-off script outside repo | ⬜ pending |
| 12-02-03 | 02 | 2 | LIVE-01 | unit + workflow pin | `corepack pnpm vitest run --project scripts scripts/commit-hygiene.test.ts scripts/workflow-gate.test.ts && corepack pnpm lint:workflows` | ✅ (edit) | ⬜ pending |
| 12-03-01 | 03 | 3 | LIVE-04 | unit | `corepack pnpm vitest run --project web src/lib/build-stamp.test.ts && corepack pnpm vitest run --project scripts scripts/service-worker-guard.test.ts` | ❌ W0 (created in task) | ⬜ pending |
| 12-03-02 | 03 | 3 | LIVE-04 | E2E + build | `GITHUB_SHA=<built-at> corepack pnpm --filter web exec playwright test build-stamp pwa routing --project=root --project=sub` + `csp:assert seo:assert budget:assert` | ❌ (created in task) | ⬜ pending |
| 12-04-01 | 04 | 3 | LIVE-08 | unit + browser | `corepack pnpm --filter extension check && corepack pnpm vitest run --project extension && corepack pnpm ext:test:browser` | ✅ (edit) | ⬜ pending |
| 12-04-02 | 04 | 3 | LIVE-08 | unit + probe build | `corepack pnpm vitest run --project scripts scripts/assert-extension.test.ts && PUBLIC_SITE_URL=https://probe.example corepack pnpm ext:build && PUBLIC_SITE_URL=https://probe.example corepack pnpm ext:assert` | ✅ (edit) | ⬜ pending |
| 12-05-01 | 05 | 3 | LIVE-05 | unit (text oracle) | `corepack pnpm vitest run --project scripts scripts/deploy-checklist.test.ts scripts/launch-audit.test.ts` | ❌ (created in task) | ⬜ pending |
| 12-05-02 | 05 | 3 | LIVE-05 | unit (order pin) | `corepack pnpm vitest run --project scripts scripts/app-html.test.ts` (built-HTML proof: `csp:assert` in 12-08 T2) | ❌ (created in task) | ⬜ pending |
| 12-06-01 | 06 | 3 | SMOKE-01 | unit + config load | `corepack pnpm vitest run --project scripts scripts/smoke-env.test.ts`; `SMOKE_BASE_URL= corepack pnpm --filter web exec playwright test -c playwright.smoke.config.ts --list` exits non-zero | ❌ (created in task) | ⬜ pending |
| 12-06-02 | 06 | 3 | SMOKE-01 | type/lint (runtime proof in 12-08/12-09) | `corepack pnpm check && corepack pnpm lint` | ❌ (created in task) | ⬜ pending |
| 12-06-03 | 06 | 3 | SMOKE-01, SMOKE-03 | unit | `corepack pnpm vitest run --project scripts scripts/smoke.test.ts scripts/smoke-env.test.ts` | ❌ (created in task) | ⬜ pending |
| 12-07-01 | 07 | 4 | LIVE-08 | unit + oracle + E2E | `corepack pnpm vitest run --project scripts scripts/build-targets.test.ts && node scripts/assert-seo.mjs apps/web/build-configured --target configured && corepack pnpm --filter web exec playwright test --project=configured` | ✅ (edit) | ⬜ pending |
| 12-07-02 | 07 | 4 | LIVE-08 | workflow pins | `corepack pnpm vitest run --project scripts scripts/workflow-gate.test.ts scripts/extension-release-gate.test.ts && corepack pnpm lint:workflows` | ✅ (edit) | ⬜ pending |
| 12-07-03 | 07 | 4 | LIVE-08 | unit | `corepack pnpm vitest run --project scripts scripts/site-url.test.ts` | ❌ (created in task) | ⬜ pending |
| 12-08-01 | 08 | 5 | SMOKE-02, SMOKE-03 | smoke | `node scripts/smoke.mjs --local -- routing.smoke.ts version.smoke.ts extension-link.smoke.ts` | ❌ (created in task) | ⬜ pending |
| 12-08-02 | 08 | 5 | SMOKE-02, LIVE-08 (HTTP level) | smoke + oracle | `node scripts/smoke.mjs --local -- csp.smoke.ts seo.smoke.ts && corepack pnpm csp:assert` | ❌ (created in task) | ⬜ pending |
| 12-08-03 | 08 | 5 | SMOKE-06 | smoke | `node scripts/smoke.mjs --local` | ❌ (created in task) | ⬜ pending |
| 12-09-01 | 09 | 6 | SMOKE-02 | smoke | `node scripts/smoke.mjs --local -- assets.smoke.ts pwa.smoke.ts third-party.smoke.ts` | ❌ (created in task) | ⬜ pending |
| 12-09-02 | 09 | 6 | SMOKE-05 | smoke + E2E | `node scripts/smoke.mjs --local -- analytics.smoke.ts && corepack pnpm --filter web exec playwright test analytics.configured --project=configured` | ❌ (created in task) | ⬜ pending |
| 12-09-03 | 09 | 6 | SMOKE-01 | unit (static) + smoke | `corepack pnpm vitest run --project scripts scripts/smoke-readonly.test.ts && corepack pnpm smoke:local` | ❌ (created in task) | ⬜ pending |
| 12-10-01 | 10 | 7 | SMOKE-03 | workflow pin | `corepack pnpm vitest run --project scripts scripts/workflow-gate.test.ts` | ✅ (edit) | ⬜ pending |
| 12-10-02 | 10 | 7 | all nine | phase gate | stages A-G (audit, check/lint/unit, builds+oracles, E2E x3, `smoke:local`, guards+secrets+ext tail, history counts + `git remote -v` empty) | ✅ | ⬜ pending |
| 12-10-03 | 10 | 7 | (owner gate) | manual | `git remote -v \| grep -q tranrealestate/tranrealestate.github.io && test "$(git rev-parse main)" = "$(git rev-parse origin/main)"` after the owner pushes | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Phase 12 has no separate Wave 0 plan: every test file below is created by the same task that needs it (TDD tasks write the test first), and the one pre-existing red suite is fixed in wave 1.

- [ ] `scripts/launch-audit.mjs` + `scripts/launch-audit.test.ts` PITFALLS path (12-01 T1; `test:unit` is red until this lands, so it is wave 1 alone)
- [ ] `scripts/commit-hygiene.mjs` + `scripts/commit-hygiene.test.ts` + commit-msg hook (12-01 T2; history test added in 12-02 T3 after the rewrite)
- [ ] `apps/web/src/lib/build-stamp.js` + `build-stamp.test.ts` (12-03 T1)
- [ ] `apps/web/tests/smoke/env.js` + `scripts/smoke-env.test.ts` (12-06 T1); `scripts/smoke.test.ts` (12-06 T3); `scripts/smoke-readonly.test.ts` (12-09 T3)
- [ ] `scripts/site-url.test.ts` (12-07 T3), `scripts/app-html.test.ts` + `scripts/deploy-checklist.test.ts` (12-05)
- [ ] `scripts/serve-pages.mjs` collector JSON response, `analytics.configured.spec.ts` kept green (12-09 T2)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Org, empty repo, Pages source, security switches, first push | (owner gate closing the phase) | Organizations cannot be created via API/CLI; pushing is owner-only by project rule | `docs/DEPLOY-CHECKLIST.md` Steps 1-6.1; 12-10 Task 3 checkpoint |
| Search Console verified, sitemap submitted and read | LIVE-05 (live half) | Needs the live origin and the owner's Google account | Phase 13 (LIVE-06 / GTM-04 proof); LIVE-05 is ticked there |
| Umami host answers JSON 200 for the real website id | SMOKE-05 (live) | Needs the owner's Umami account | Phase 13 live smoke runs `analytics.smoke.ts` against the deployed origin; locally the emulator collector is the analytics host |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < 20 s for the quick command (smoke runs are per wave)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
