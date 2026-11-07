---
phase: 15
slug: load-deterministic-test-lanes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-06
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.12 (node + browser-playwright projects) / Playwright 1.63.0 (E2E) |
| **Config file** | `vitest.config.ts` (root projects), `scripts/vitest.config.ts`, `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts`, plus new `*-serial` project configs |
| **Quick run command** | `pnpm vitest run --project <project>` |
| **Full suite command** | `pnpm test:unit` (parallel lane then `*-serial` lane) |
| **Estimated runtime** | ~75 seconds (unit, full load, dev machine) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --project <affected project>`
- **After every plan wave:** Run `pnpm test:unit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | TEST-01 | guard | `pnpm vitest run --project scripts` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | TEST-02 | guard | `pnpm vitest run --project scripts` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 1 | TEST-03 | config + CI | `grep -- --fail-on-flaky-tests .github/workflows/ci.yml` | n/a | ⬜ pending |
| 15-02-02 | 02 | 1 | TEST-04 | unit | `pnpm vitest run --project scripts` | ❌ W0 | ⬜ pending |
| 15-03-01 | 03 | 2 | TEST-05 | evidence | `test -f docs/test-evidence/<date>.md` | n/a | ⬜ pending |
| 15-03-02 | 03 | 2 | TEST-06 | evidence | `pnpm vitest run --sequence.shuffle --sequence.seed=<seed>` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*The planner refines this table; task IDs above are placeholders until PLAN.md files exist.*

---

## Wave 0 Requirements

- [ ] Guard test for serial-lane boundary and annotated timeouts (TEST-01, TEST-02)
- [ ] Unit test for the Windows PATH/taskkill teardown module (TEST-04)
- [ ] `*-serial` Vitest project config files with `fileParallelism: false` and `sequence.groupOrder: 1`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Three consecutive clean `pnpm verify` runs | TEST-05 | Wall-clock evidence run on the dev machine | Run `pnpm verify` three times; record exit codes and durations in `docs/test-evidence/<date>.md` |
| E2E under artificial CPU pressure | TEST-05 | Needs a concurrent load generator | Start the load script from RESEARCH.md, run `pnpm test:e2e`, record zero failures |
| CI `--fail-on-flaky-tests` observed | TEST-03 | Requires a GitHub Actions run | Inspect the CI log for the Playwright invocation flag |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
