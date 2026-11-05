---
phase: 14
slug: carried-debt
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-11-05
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.12 (projects `web`, `web-browser`, `scripts`, `packages/core`, `extension`); Playwright 1.63.0 (projects `root`, `sub`, `configured`) |
| **Config files** | `vitest.config.ts` (root, projects list), `apps/web/vite.config.ts` (`web`), `apps/web/vitest.browser.config.ts` (`web-browser`), `scripts/vitest.config.ts` (`scripts`), `apps/web/playwright.config.ts` |
| **Quick run command** | `MSYS_NO_PATHCONV=1 corepack.cmd pnpm exec vitest run --project <web\|web-browser\|scripts> <path>` |
| **E2E (one spec)** | `MSYS_NO_PATHCONV=1 corepack.cmd pnpm --filter web exec playwright test <spec> --project root --project sub` (needs `pnpm build:root` / `build:sub` / `build:configured` first) |
| **Full suite command** | `MSYS_NO_PATHCONV=1 corepack.cmd pnpm verify` (local gate, no deploy env); `ci.yml` on GitHub is the verifier |
| **Estimated runtime** | single-file Vitest < 30 s; one spec on root+sub 1-3 min; `pnpm verify` ~25-40 min |

---

## Sampling Rate

- **After every task commit:** the task's `<automated>` command (single file / single spec) plus `prettier --check` on touched files
- **After every plan wave:** `corepack.cmd pnpm test:unit` + the wave's Playwright specs on root and sub (orchestrator re-runs any step an executor deferred)
- **Before `/gsd:verify-work`:** `pnpm verify` green locally, then CI + live-smoke green on GitHub (14-11 Task 2)
- **Max feedback latency:** 180 seconds per task command (E2E specs on two projects may take up to ~3 min)

---

## Execution note: shared build dirs

Every plan that builds `apps/web/build*` or runs Playwright (14-06, 14-09, 14-12, 14-01, 14-02, 14-03, 14-05, 14-07, 14-11) is chained by `depends_on` so only one executor builds or binds the webServer ports (4273-4276) at a time. 14-04, 14-08 and 14-10 run scripts-project Vitest or edit docs only and run alongside.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-06-01 | 14-06 | 1 | DEBT-06 | unit | `vitest run --project web apps/web/src/lib/utils.test.ts` | W0 (new) | ⬜ pending |
| 14-06-02 | 14-06 | 1 | DEBT-06 | browser + budget + E2E a11y | `vitest run --project web-browser apps/web/src/lib/components/ui/primitives.browser.test.ts`; `pnpm budget:assert`; `playwright test a11y.spec.ts a11y-keyed.spec.ts --project root --project sub` | W0 (new; config adds `tailwindcss()`) | ⬜ pending |
| 14-04-01 | 14-04 | 1 | DEBT-04 | unit (scripts) | `vitest run --project scripts scripts/origin-parity.test.ts` | W0 (new) | ⬜ pending |
| 14-04-02 | 14-04 | 1 | DEBT-04 | unit (scripts) | `vitest run --project scripts scripts/origin-parity.test.ts scripts/extension-docs.test.ts scripts/assert-extension.test.ts scripts/site-url.test.ts` | yes | ⬜ pending |
| 14-10-01 | 14-10 | 1 | DEBT-02, DEBT-03 (D-01..D-04 record) | doc grep | `grep -c "Owner decision D-0[1-4]" .planning/PROJECT.md` (= 4) | yes | ⬜ pending |
| 14-10-02 | 14-10 | 1 | DEBT-02, DEBT-03 (ledger) | unit (scripts) + audit-uat | `vitest run --project scripts scripts/human-uat-ledger.test.ts`; `gsd-tools audit-uat` (no `tranrealestate`) | yes | ⬜ pending |
| 14-09-01 | 14-09 | 2 | DEBT-09 | unit | `vitest run --project web apps/web/src/lib/components/forms/form-classes.test.ts` | W0 (new) | ⬜ pending |
| 14-09-02 | 14-09 | 2 | DEBT-09 | build + budget measure | `pnpm build:configured && node scripts/assert-budget.mjs apps/web/build-configured` | yes | ⬜ pending |
| 14-09-03 | 14-09 | 2 | DEBT-09 | Playwright | `playwright test feedback.configured.spec.ts waitlist.configured.spec.ts --project configured` | yes (extended) | ⬜ pending |
| 14-08-01 | 14-08 | 2 | DEBT-08 | live probe | `curl -sI https://wolfwdavid.github.io/tran_real_estate/.nojekyll` (+3 URLs) | n/a | ⬜ pending |
| 14-08-02 | 14-08 | 2 | DEBT-08 | script (spawn) | `vitest run --project scripts scripts/serve-pages.test.ts` | W0 (new; `SERVE_PAGES_WEB_DIR` override) | ⬜ pending |
| 14-12-01 | 14-12 | 3 | DEBT-09 | budget measure | `node scripts/assert-budget.mjs apps/web/build && node scripts/assert-budget.mjs apps/web/build-configured` | yes | ⬜ pending |
| 14-12-02 | 14-12 | 3 | DEBT-09 | unit (scripts) + gate | `vitest run --project scripts scripts/assert-budget.test.ts scripts/launch-audit.test.ts && pnpm budget:assert` | yes | ⬜ pending |
| 14-01-01 | 14-01 | 4 | DEBT-01 | Playwright (+browser) | `playwright test renter-map-split.spec.ts renter-map.spec.ts renter-results.spec.ts renter-journey.spec.ts --project root --project sub` | yes (extended) | ⬜ pending |
| 14-02-01 | 14-02 | 5 | DEBT-02 | unit | `vitest run --project web apps/web/src/lib/features/studio/snapshot/save-gate.test.ts` | yes | ⬜ pending |
| 14-02-02 | 14-02 | 5 | DEBT-02 | Playwright | `playwright test snapshot-builder.spec.ts --project root --project sub` | yes | ⬜ pending |
| 14-03-01 | 14-03 | 6 | DEBT-03 | unit | `vitest run --project web apps/web/src/lib/features/investor/memo/memo-meta.test.ts apps/web/src/lib/ai/storage/artifacts.test.ts` | W0 (new memo-meta.test.ts) | ⬜ pending |
| 14-03-02 | 14-03 | 6 | DEBT-03 | Playwright | `playwright test investor/print.spec.ts --project root --project sub` | yes (extended) | ⬜ pending |
| 14-05-01 | 14-05 | 7 | DEBT-05 | lint + type-check | `eslint apps/web/tests/e2e/support/seed-all.ts && pnpm --filter web check` | W0 (new) | ⬜ pending |
| 14-05-02 | 14-05 | 7 | DEBT-05 | Playwright | `playwright test backup-roundtrip.spec.ts --project root --project sub` | W0 (new) | ⬜ pending |
| 14-07-01 | 14-07 | 8 | DEBT-07 | unit (real Node navigator.locks) | `vitest run --project web apps/web/src/lib/data/scheduler.test.ts` | yes | ⬜ pending |
| 14-07-02 | 14-07 | 8 | DEBT-07 | Playwright under CPU pressure | `playwright test renter-saved.spec.ts --repeat-each 10 --workers 4 --project root --project sub` while `pnpm test:unit` loops | yes | ⬜ pending |
| 14-11-01 | 14-11 | 9 | DEBT-01..09 | ledger + full gate | `vitest run --project scripts scripts/human-uat-ledger.test.ts`; `pnpm verify` | yes | ⬜ pending |
| 14-11-02 | 14-11 | 9 | DEBT-01..09 | CI on GitHub (checkpoint) | `gh run list --repo wolfwdavid/tran_real_estate --limit 3` | n/a | ⬜ pending |
| 14-11-03 | 14-11 | 9 | DEBT-09 | audit regeneration | `grep -c "for-renters/index.html" docs/LAUNCH-AUDIT.md` (>= 1, PASS) | yes | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Mutation targets per row are listed in each task's acceptance criteria and recorded in each SUMMARY's `## Mutation ledger`.

---

## Wave 0 Requirements

- [ ] `apps/web/vitest.browser.config.ts`: add `@tailwindcss/vite` so the computed-font-size test reads real CSS (14-06 Task 2)
- [ ] `apps/web/src/lib/utils.test.ts`, `apps/web/src/lib/components/ui/primitives.browser.test.ts` (14-06)
- [ ] `scripts/origin-parity.test.ts` (14-04)
- [ ] `scripts/serve-pages.mjs` `SERVE_PAGES_WEB_DIR` override + `scripts/serve-pages.test.ts` (14-08)
- [ ] `apps/web/src/lib/components/forms/form-classes.test.ts` (14-09)
- [ ] `apps/web/src/lib/features/investor/memo/memo-meta.test.ts` (14-03)
- [ ] `apps/web/tests/e2e/support/seed-all.ts` + `apps/web/tests/e2e/backup-roundtrip.spec.ts` (14-05)

Each is created inside the task that needs it (test written before or with the fix); no separate Wave 0 plan.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Push approval before CI | DEBT-01..09 | The owner approves pushes to `main` (repo rule) | 14-11 Task 2: review commit list, type "push"; executor pushes and records ci/deploy/live-smoke run ids |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 180s (single-file/spec commands)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planned 2026-11-05
