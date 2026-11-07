---
phase: 15
slug: load-deterministic-test-lanes
status: draft
nyquist_compliant: true
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
| **Config file** | `vitest.config.ts` (root projects), `tooling/vitest/lanes.ts` (manifest + MAX_WORKERS), `scripts/vitest.config.ts`, `apps/web/vite.config.ts`, `apps/web/vitest.browser.config.ts`, `apps/web/playwright.config.ts`, plus the four `*.serial.config.ts` files |
| **Quick run command** | `MSYS_NO_PATHCONV=1 corepack.cmd pnpm vitest run --project scripts scripts/test-lanes.test.ts scripts/test-lane-rules.test.ts scripts/windows-path.test.ts` (< 10 s) |
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
| 15-01-01 | 01 | 1 | TEST-01 | config | `pnpm vitest run --config packages/core/vitest.serial.config.ts && pnpm vitest run --config scripts/vitest.serial.config.ts` | new configs | pending |
| 15-01-02 | 01 | 1 | TEST-01, TEST-04 | config + full suite | `pnpm test:unit && pnpm check && pnpm lint` | new configs | pending |
| 15-01-03 | 01 | 1 | TEST-01, TEST-04 | measurement | `pnpm test:unit` (+ JSON ordering/threshold one-liners) | n/a | pending |
| 15-02-01 | 02 | 1 | TEST-01, TEST-02 | unit (RED) | `pnpm vitest run --project scripts scripts/test-lane-rules.test.ts` (expected fail) | W0 creates | pending |
| 15-02-02 | 02 | 1 | TEST-01, TEST-02 | unit (GREEN) | `pnpm vitest run --project scripts scripts/test-lane-rules.test.ts && pnpm lint` | W0 creates | pending |
| 15-03-01 | 03 | 1 | TEST-03, TEST-04 | config | `pnpm --filter web exec playwright test --list && pnpm ext:e2e && pnpm lint` | exists | pending |
| 15-03-02 | 03 | 1 | TEST-03 | workflow pin | `pnpm vitest run --project scripts scripts/workflow-gate.test.ts && pnpm lint:workflows` | exists (extend) | pending |
| 15-04-01 | 04 | 2 | TEST-02 | inventory | `test -s .tools/test-evidence/15-04-findings.txt` | n/a | pending |
| 15-04-02 | 04 | 2 | TEST-02 | static (rules) | partition-A `playwrightTimeoutFindings` one-liner prints 0 + `playwright test --list` + `pnpm lint` | n/a | pending |
| 15-05-01 | 05 | 2 | TEST-02 | inventory | `test -s .tools/test-evidence/15-05-findings.txt` | n/a | pending |
| 15-05-02 | 05 | 2 | TEST-02 | static (rules) | partition-B findings + toPass one-liner prints 0 + `playwright test --list` + `pnpm lint` | n/a | pending |
| 15-06-01 | 06 | 2 | TEST-02 | measurement | `test -s .tools/test-evidence/15-06-serial.json` | n/a | pending |
| 15-06-02 | 06 | 2 | TEST-01, TEST-02 | static (rules) + unit | `node .tools/test-evidence/15-06-check.mjs && pnpm vitest run --project web-serial --project web-browser-serial --project web --project web-browser` | n/a | pending |
| 15-07-01 | 07 | 2 | TEST-04 | unit | `pnpm vitest run --project scripts scripts/windows-path.test.ts -t ensureSystem32OnPath` | W0 creates | pending |
| 15-07-02 | 07 | 2 | TEST-04 | unit + teardown | `pnpm vitest run --project scripts scripts/windows-path.test.ts && pnpm vitest run --project web-browser && pnpm ext:e2e` | W0 creates | pending |
| 15-07-03 | 07 | 2 | TEST-04 | doc pin | `pnpm vitest run --project scripts scripts/runbook.test.ts && pnpm lint && pnpm banned` | exists (extend) | pending |
| 15-08-01 | 08 | 2 | TEST-01 | integration (fixture) | `pnpm vitest run --project scripts-serial scripts/lane-order.test.ts` | W0 creates | pending |
| 15-08-02 | 08 | 2 | TEST-03 | integration (fixture) | `pnpm vitest run --project scripts-serial scripts/flaky-gate.test.ts` | W0 creates | pending |
| 15-08-03 | 08 | 2 | TEST-05 | unit | `pnpm vitest run --project scripts-serial scripts/cpu-burn.test.ts && pnpm test:unit` | W0 creates | pending |
| 15-09-01 | 09 | 3 | TEST-01, TEST-02 | guard (sweep) | `pnpm vitest run --project scripts scripts/test-lanes.test.ts` | W0 creates | pending |
| 15-09-02 | 09 | 3 | TEST-01..TEST-04 | guard (pins) + full | `pnpm test:unit && pnpm check && pnpm lint` | W0 creates | pending |
| 15-10-01 | 10 | 4 | TEST-05 | evidence (verify x3) | `grep -c "^exit=0$" .tools/test-evidence/verify-{1,2,3}.log` | n/a | pending |
| 15-10-02 | 10 | 4 | TEST-05, TEST-06 | evidence (repeat/pressure/shuffle) | `grep -c "^exit=0$" .tools/test-evidence/pressure-e2e.log .tools/test-evidence/shuffle.log` | n/a | pending |
| 15-10-03 | 10 | 4 | TEST-05, TEST-06 | doc pin | `pnpm vitest run --project scripts scripts/test-evidence.test.ts && pnpm test:unit` | W0 creates | pending |
| 15-11-01 | 11 | 5 | TEST-03 | checkpoint | `git log --format=%B origin/main..HEAD` has no assistant mention | n/a | pending |
| 15-11-02 | 11 | 5 | TEST-03, TEST-04, TEST-05 | CI observation | `grep -c "## 5. CI observation" docs/test-evidence/*.md` | n/a | pending |

*All pnpm commands run as `MSYS_NO_PATHCONV=1 corepack.cmd pnpm ...` in Git Bash. Status: pending / green / red / flaky.*

---

## Wave 0 Requirements

- [ ] `scripts/lib/test-lane-rules.mjs` + `scripts/test-lane-rules.test.ts` (15-02) and the repo sweep `scripts/test-lanes.test.ts` (15-09) (TEST-01, TEST-02)
- [ ] `scripts/lib/windows-path.mjs` + `scripts/windows-path.test.ts` (15-07) (TEST-04)
- [ ] Behavioural fixtures `scripts/lane-order.test.ts`, `scripts/flaky-gate.test.ts`, tool `scripts/cpu-burn.mjs` + test (15-08) (TEST-01, TEST-03, TEST-05)
- [ ] `scripts/test-evidence.test.ts` written after the evidence file exists (15-10) (TEST-05, TEST-06)
- [ ] `tooling/vitest/lanes.ts` + four `*.serial.config.ts` files with `fileParallelism: false` and `sequence.groupOrder: 1` (15-01)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Three consecutive clean `pnpm verify` runs | TEST-05 | Wall-clock evidence run on the dev machine | Run `pnpm verify` three times; record exit codes and durations in `docs/test-evidence/<date>.md` |
| E2E under artificial CPU pressure | TEST-05 | Needs a concurrent load generator | 15-10 Task 2: `node scripts/cpu-burn.mjs --threads 16 --stop-file .tools/test-evidence/stop --max-seconds 7200` in the background, then `pnpm test:e2e`; record 0 failed / 0 flaky |
| CI `--fail-on-flaky-tests` observed | TEST-03 | Requires a GitHub Actions run | 15-11: owner approves push; `gh run view <id> --log` shows the flag and `using 2 workers`; recorded in evidence section 5 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
