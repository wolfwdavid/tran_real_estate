---
phase: 13
slug: live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
status: planned
nyquist_compliant: true
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
- **Wave 1-3 executors run targeted commands only; the orchestrator runs full `pnpm lint` + `pnpm test:unit` once after each of those waves.**
- **After every plan wave:** Run `pnpm lint:workflows && pnpm test:unit`, then the affected Playwright project(s) and `pnpm smoke:local --target sub` (the production twin)
- **Before `/gsd:verify-work`:** Full suite must be green; the live `live-smoke` run on the deployed SHA must be green
- **Max feedback latency:** 30 s (quick), 300 s (smoke:local per target)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | LIVE-02, LIVE-03, LIVE-07 | evidence + text | `gh run view 40961373692 --repo wolfwdavid/tran_real_estate --json conclusion,jobs`; `grep -c 40961373692 .planning/REQUIREMENTS.md` | ✅ | ⬜ pending |
| 13-01-02 | 01 | 1 | (owner decisions A/B/C) | checkpoint | `git status --short CLAUDE.md` | ✅ | ⬜ pending |
| 13-01-03 | 01 | 1 | LIVE-02 | text | `grep -cE "Owner decision (A\|B\|C)" .planning/PROJECT.md` | ✅ | ⬜ pending |
| 13-02-01 | 02 | 1 | LIVE-03 (D-03/D-04) | unit | `pnpm vitest run apps/web/src/lib/site-config.test.ts apps/web/src/lib/site.test.ts` | ✅ (extend) | ⬜ pending |
| 13-02-02 | 02 | 1 | LIVE-03 (LIVE-08 regression, BASE_PATH) | unit | `pnpm vitest run --project scripts scripts/site-url.test.ts scripts/assert-extension.test.ts && pnpm vitest run --project extension` | ✅ (extend: group (e)) | ⬜ pending |
| 13-20-01 | 20 | 1 | LIVE-03 (D-03 fixtures, split from 13-02) | unit | `pnpm vitest run --project scripts scripts/assert-seo.test.ts scripts/service-worker-guard.test.ts scripts/smoke-env.test.ts scripts/smoke.test.ts` (+ the seven web fixture files) | ✅ | ⬜ pending |
| 13-03-01 | 03 | 1 | SMOKE-04 | unit + lint | `pnpm vitest run --project scripts scripts/live-smoke-gate.test.ts --reporter=verbose && pnpm lint:workflows` (9 named describes, 4 uses:, cancel-in-progress false) | ❌ W0 (created in task) | ⬜ pending |
| 13-03-02 | 03 | 1 | SMOKE-04 | mutation | `git diff --exit-code .github/workflows/live-smoke.yml && pnpm vitest run --project scripts scripts/live-smoke-gate.test.ts` | ✅ after 13-03-01 | ⬜ pending |
| 13-04-01 | 04 | 1 | LIVE-05, LIVE-09 | text | `pnpm vitest run --project scripts scripts/deploy-checklist.test.ts` | ✅ (update) | ⬜ pending |
| 13-04-02 | 04 | 1 | LIVE-05 | text | `pnpm vitest run --project scripts scripts/extension-docs.test.ts` | ✅ (update) | ⬜ pending |
| 13-05-01 | 05 | 1 | LIVE-07 | text oracle | `pnpm vitest run --project scripts scripts/human-uat-ledger.test.ts` | ❌ W0 (created in task) | ⬜ pending |
| 13-05-02 | 05 | 1 | LIVE-07 | text oracle | `pnpm vitest run --project scripts scripts/human-uat-ledger.test.ts` | ✅ after 13-05-01 | ⬜ pending |
| 13-06-01 | 06 | 2 | LIVE-03 (D-02) | unit | `pnpm vitest run --project scripts scripts/build-targets.test.ts scripts/workflow-gate.test.ts` | ✅ (extend) | ⬜ pending |
| 13-06-02 | 06 | 2 | LIVE-03 (Pitfall 1 blocker) | unit + lint | `pnpm vitest run --project scripts scripts/smoke.test.ts && pnpm exec eslint <7 touched files>` | ✅ (extend) | ⬜ pending |
| 13-06-03 | 06 | 2 | LIVE-07 (D-22 header) | unit | `pnpm vitest run --project scripts scripts/launch-audit.test.ts` | ✅ (update) | ⬜ pending |
| 13-07-01 | 07 | 2 | LIVE-02 (D-06) | unit | `pnpm vitest run --project scripts scripts/supply-chain.test.ts` | ✅ (extend) | ⬜ pending |
| 13-07-02 | 07 | 2 | LIVE-03 (decision C) | gate + E2E in 13-10 | `pnpm banned && pnpm vitest run --project scripts scripts/site-url.test.ts && pnpm --filter web check` | ❌ spec created in task | ⬜ pending |
| 13-08-01 | 08 | 3 | LIVE-09 (+ decision B policy text) | text oracle | `pnpm vitest run --project scripts scripts/runbook.test.ts` | ❌ W0 (created in task) | ⬜ pending |
| 13-08-02 | 08 | 3 | LIVE-07 (D-20 proof shots, Sec-GPC, .mjs guard) | unit | `pnpm vitest run --project scripts scripts/proof-shots.test.ts scripts/smoke-readonly.test.ts` | ❌ W0 (created in task) | ⬜ pending |
| 13-09-01 | 09 | 3 | LIVE-03, SMOKE-04 (uses = 7) | unit + lint | `pnpm vitest run --project scripts scripts/workflow-gate.test.ts scripts/live-smoke-gate.test.ts && pnpm lint:workflows` | ✅ (update) | ⬜ pending |
| 13-09-02 | 09 | 3 | LIVE-03 (Pitfall 10) | unit + lint | `pnpm vitest run --project scripts scripts/extension-release-gate.test.ts && pnpm lint:workflows` | ✅ (update) | ⬜ pending |
| 13-10-01 | 10 | 4 | LIVE-03 | full static gates | `pnpm test:unit && pnpm lint:workflows && node scripts/commit-hygiene.mjs --history` | ✅ | ⬜ pending |
| 13-10-02 | 10 | 4 | LIVE-03 (go-live config rehearsal) | build + E2E + smoke | `MSYS_NO_PATHCONV=1 PUBLIC_SITE_URL=https://wolfwdavid.github.io BASE_PATH=/tran_real_estate pnpm smoke:local --target root` (+ sharded root E2E) | ✅ | ⬜ pending |
| 13-10-03 | 10 | 4 | LIVE-03 (production twin) | build + E2E + smoke | `pnpm smoke:local` (incl. `--target sub`) + sharded `pnpm test:e2e` | ✅ | ⬜ pending |
| 13-11-01 | 11 | 5 | LIVE-02 | hygiene | `node scripts/commit-hygiene.mjs --history` | ✅ | ⬜ pending |
| 13-11-02 | 11 | 5 | LIVE-02, SMOKE-04 | live evidence | `gh run list --repo wolfwdavid/tran_real_estate --workflow ci.yml --branch main --limit 1 --json headSha,conclusion` | n/a (live) | ⬜ pending |
| 13-11-03 | 11 | 5 | LIVE-02 (D-07) | live evidence | `gh pr list --repo wolfwdavid/tran_real_estate --state all --limit 10 --json number,state` | n/a (live) | ⬜ pending |
| 13-12-01 | 12 | 6 | LIVE-03 | live evidence | `gh variable list --repo wolfwdavid/tran_real_estate` | n/a (live) | ⬜ pending |
| 13-12-02 | 12 | 6 | LIVE-03, SMOKE-04 | live evidence | `gh run list ... --workflow ci.yml` + root job log grep `target=root BASE_PATH=/tran_real_estate` | n/a (live) | ⬜ pending |
| 13-13-01 | 13 | 7 | LIVE-03 | live evidence | `gh variable list --repo wolfwdavid/tran_real_estate` | n/a (live) | ⬜ pending |
| 13-13-02 | 13 | 7 | LIVE-03, SMOKE-04 | live smoke | `curl -s https://wolfwdavid.github.io/tran_real_estate/_app/version.json` + live-smoke run green (routing/version/csp/seo specs) | ✅ specs | ⬜ pending |
| 13-13-03 | 13 | 7 | LIVE-03 | manual + curl | `curl -s -o /dev/null -w "%{http_code}" https://wolfwdavid.github.io/tran_real_estate/does-not-exist/` | n/a | ⬜ pending |
| 13-21-01 | 21 | 8 | LIVE-03 (ledger L03, L88) | manual + git | `git ls-remote --heads origin push-protection-probe` (empty) | n/a | ⬜ pending |
| 13-21-02 | 21 | 8 | LIVE-03 (ledger L26, L36) | manual | `curl -s -o /dev/null -w "%{http_code}" https://wolfwdavid.github.io/tran_real_estate/settings/` + owner per-provider results | n/a | ⬜ pending |
| 13-14-01 | 14 | 8 | LIVE-06 (GTM-04) | manual | `gh variable list --repo wolfwdavid/tran_real_estate` | n/a | ⬜ pending |
| 13-14-02 | 14 | 8 | LIVE-06 (GTM-04) | live smoke + curl | `curl -s https://wolfwdavid.github.io/tran_real_estate/ \| grep -o "connect-src[^;]*" \| grep -c gateway.umami.is` | ✅ analytics.smoke.ts | ⬜ pending |
| 13-14-03 | 14 | 8 | LIVE-06 (GTM-04) | manual | owner dashboard screenshot | n/a | ⬜ pending |
| 13-15-01 | 15 | 9 | LIVE-06 (cut line) | text | `git status --short .planning/REQUIREMENTS.md .planning/PROJECT.md` | ✅ | ⬜ pending |
| 13-15-02 | 15 | 9 | LIVE-06 (GTM-02) | live evidence | `gh variable list` + `curl ... /for-renters/ \| grep -c "open yet"` = 0 | n/a | ⬜ pending |
| 13-15-03 | 15 | 9 | LIVE-06 (GTM-01/02) | manual | owner inbox + walk screenshots | n/a | ⬜ pending |
| 13-16-01 | 16 | 10 | LIVE-06 (GTM-03) | manual + curl | `curl -s https://wolfwdavid.github.io/tran_real_estate/tools/cap-rate/ \| grep -c og:image` | ✅ seo.smoke.ts | ⬜ pending |
| 13-16-02 | 16 | 10 | LIVE-05 | manual | `grep -n search-console apps/web/src/app.html` | ✅ | ⬜ pending |
| 13-16-03 | 16 | 10 | LIVE-05 | unit | `pnpm vitest run --project scripts scripts/app-html.test.ts`; `grep -cP` slot check | ✅ | ⬜ pending |
| 13-17-01 | 17 | 11 | LIVE-05, LIVE-06 | live evidence | `curl -s https://wolfwdavid.github.io/tran_real_estate/sitemap.xml \| grep -c "<loc>"` = 14 | n/a | ⬜ pending |
| 13-17-02 | 17 | 11 | LIVE-05 | manual | Search Console screenshots | n/a | ⬜ pending |
| 13-17-03 | 17 | 11 | LIVE-05 | hygiene | `git log -1 --format=%B \| grep -ciE "co-authored-by\|claude\|anthropic"` = 0 | ✅ | ⬜ pending |
| 13-18-01 | 18 | 12 | LIVE-07 | evidence chain | `node scripts/audit-evidence.mjs merge` | ✅ | ⬜ pending |
| 13-18-02 | 18 | 12 | LIVE-07 (D-22) | generated doc | `grep -c "Base URL audited: https://wolfwdavid.github.io/tran_real_estate/ (root/deploy build)" docs/LAUNCH-AUDIT.md` | ✅ | ⬜ pending |
| 13-19-01 | 19 | 13 | LIVE-07 | text oracle | `pnpm vitest run --project scripts scripts/human-uat-ledger.test.ts && pnpm lint` | ✅ | ⬜ pending |
| 13-19-02 | 19 | 13 | LIVE-09 | text oracle | `pnpm vitest run --project scripts scripts/runbook.test.ts && pnpm lint` | ✅ | ⬜ pending |
| 13-19-03 | 19 | 13 | LIVE-03, SMOKE-04 | live evidence | `gh run list --repo wolfwdavid/tran_real_estate --workflow live-smoke.yml --limit 1 --json headSha,conclusion` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Created test-first inside their own tasks (RED before GREEN), so no separate Wave 0 plan is needed:

- [ ] `scripts/live-smoke-gate.test.ts` — gate test for `.github/workflows/live-smoke.yml` (SMOKE-04), 13-03-01
- [ ] `scripts/site-url.test.ts` — base-path group (e) (BASE_PATH alone changes extension privacy URL, define and allowlist), 13-02-02
- [ ] `scripts/workflow-gate.test.ts` — expectations updated for `BASE_PATH` on the root leg, 13-09-01
- [ ] `scripts/human-uat-ledger.test.ts` — LIVE-07 no-row-dropped oracle, 13-05-01
- [ ] `scripts/runbook.test.ts` — LIVE-09 runbook oracle, 13-08-01
- [ ] `scripts/proof-shots.test.ts` — D-20 proof-shot script, 13-08-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Fresh-profile live checks (landing, redirect, deep refresh, branded 404, HTTPS) | LIVE-03 | Real browser profile on the live CDN | 13-13 Task 3 |
| Umami pageviews with GPC respected | LIVE-06 / GTM-04 | Third-party dashboard | 13-14 Task 3 |
| Web3Forms waitlist + feedback delivery; GTM-01 walk | LIVE-06 / GTM-01, GTM-02 | Owner inbox | 13-15 Task 3 |
| Share cards in LinkedIn / Facebook debuggers | LIVE-06 / GTM-03 | External tools, logins | 13-16 Task 1 |
| Search Console verified, sitemap read | LIVE-05 / LIVE-06 | Google account | 13-16 Task 2, 13-17 Task 2 |
| Push-protection probe | DEPLOY-CHECKLIST Step 7 (ledger L03/L88) | Needs a throwaway PAT | 13-21 Task 1 (declined = carried with an explicit target) |
| Real-key CORS from the live origin per provider | ledger L26/L36 | Owner's real keys | 13-21 Task 2 (status/host/count only) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 300s (per call; Playwright chunked)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-10-29 (execution fills the Status column)
