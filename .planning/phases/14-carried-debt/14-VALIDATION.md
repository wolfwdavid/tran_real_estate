---
phase: 14
slug: carried-debt
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-05
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (node + browser-mode projects) / @playwright/test 1.x |
| **Config file** | `apps/web/vitest.config.ts`, `apps/web/vitest.browser.config.ts`, `apps/web/playwright.config.ts` (see RESEARCH.md Validation Architecture for exact paths) |
| **Quick run command** | `pnpm -C apps/web test:unit -- <file>` |
| **Full suite command** | `pnpm -r test` then `pnpm -C apps/web test:e2e` |
| **Estimated runtime** | ~120 seconds unit; ~600 seconds E2E |

---

## Sampling Rate

- **After every task commit:** Run `{quick run command}` against the test file named in the task
- **After every plan wave:** Run `{full suite command}`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD — filled by planner from RESEARCH.md `## Validation Architecture` | | | DEBT-01..09 | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/vitest.browser.config.ts` — add `@tailwindcss/vite` so computed-font-size test (DEBT-06) reads real CSS
- [ ] `scripts/serve-pages.mjs` — `SERVE_PAGES_WEB_DIR` env override so the emulator can be spawned under test (DEBT-08)

*Otherwise existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | | | |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
