---
phase: 18
slug: live-smoke-stability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-21
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `18-RESEARCH.md`, section "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 5.1.0 (projects `scripts`, `scripts-serial`) for the pins; Playwright 1.65.0 for the smoke suite |
| **Config file** | `scripts/vitest.config.ts`, `scripts/vitest.serial.config.ts`, `apps/web/playwright.smoke.config.ts` |
| **Quick run command** | `pnpm vitest run --project scripts scripts/smoke.test.ts scripts/live-smoke-gate.test.ts scripts/runbook.test.ts scripts/smoke-readonly.test.ts` |
| **Full suite command** | `pnpm vitest run --project scripts --project scripts-serial`, then `pnpm smoke:local` after rebuilding the three targets |
| **Estimated runtime** | ~30 seconds quick; under 5 minutes for the local smoke |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run the full `scripts` projects, `pnpm lint:workflows`, `pnpm check`
- **Before the proof pushes:** rebuild the three targets, `pnpm smoke:local` green at HEAD
- **Before `/gsd:verify-work`:** Full suite green and three consecutive green chained live-smoke runs recorded
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

Filled by the planner; task IDs are assigned in the PLAN files. Requirement-level map:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| SMOKE-07 | Live sample is a subset of the route list and spans every route group; the local run keeps the full list | unit | `pnpm vitest run --project scripts scripts/smoke.test.ts` | ❌ W0 (new case) | ⬜ pending |
| SMOKE-07 | One shared service worker install for the pwa and assets specs; no per-hash GET loop; worker still blocked elsewhere | unit (text pin) | `pnpm vitest run --project scripts scripts/smoke.test.ts` | ✅ update | ⬜ pending |
| SMOKE-07 | Retries stay 0; no `toPass`; no sleeps | unit | `pnpm vitest run --project scripts scripts/test-lane-rules.test.ts scripts/smoke-env.test.ts` | ✅ | ⬜ pending |
| SMOKE-07 | No 429 ignored: an API-context 429 is logged; any 429 maps to exit 2 | unit | `pnpm vitest run --project scripts scripts/smoke.test.ts` | ✅ + new | ⬜ pending |
| SMOKE-07 | Request volume recorded and under the stated maximum | unit + docs oracle | `pnpm vitest run --project scripts scripts/runbook.test.ts` | ❌ W0 | ⬜ pending |
| SMOKE-08 | A newer served SHA is classified superseded; behind, diverged or a failed lookup is not | unit | `pnpm vitest run --project scripts scripts/smoke.test.ts` | ❌ W0 | ⬜ pending |
| SMOKE-08 | Removing the handling fails a test | unit (mutation) | `pnpm vitest run --project scripts scripts/smoke.test.ts` | ❌ W0 | ⬜ pending |
| SMOKE-08 | Workflow passes the token, stays read-only, four pinned actions, `cancel-in-progress: false` | unit (text) | `pnpm vitest run --project scripts scripts/live-smoke-gate.test.ts` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Opt-in request counter in `scripts/serve-pages.mjs` and a place to record its output
- [ ] Served-version classification with an injectable compare in `scripts/smoke.mjs`, with its tests in `scripts/smoke.test.ts`
- [ ] Live-sample pin test; fixture volume and 429 needle pins
- [ ] Runbook volume table and an oracle assertion for it in `scripts/runbook.test.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Three consecutive pushes each followed by a green chained live-smoke run | SMOKE-07 | Needs real pushes to `main` (owner approval each time) and the live CDN | Push three times in sequence, each time waiting for the chained run; accept a run only if the event is `workflow_run`, the head SHA matches, the log shows passed with zero failed and no 429, and retries is 0; record the run links |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
