---
phase: 8
slug: agent-portal-profile-lead-intake-crm
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-04
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11 (projects `core`, `brand`, `web`, `scripts`; network blocked by `tooling/vitest/no-network.ts`) + fast-check 4.10.2 (core devDependency, added by 08-01) + fake-indexeddb 6.2.5 (Phase 3 test stack, `freshIdb()`) · Playwright 1.63.0 + @axe-core/playwright 4.13.0 (projects `root`, `sub`; Web3Forms and every AI host mocked or aborted with `page.route()`; RentCast tripwire on every agent spec) |
| **Config file** | existing: `vitest.config.ts`, `packages/core/vitest.config.ts`, `packages/brand/vitest.config.ts` (Phase 2), `apps/web/vite.config.ts`, `scripts/vitest.config.ts`, `apps/web/playwright.config.ts`. No new config files. |
| **Quick run command** | `corepack pnpm vitest run --project core --project web` (plus `--project brand` for 08-04 and `--project scripts` when touching ESLint, CSP, banned terms or the boundary test) |
| **Full suite command** | `corepack pnpm verify` |
| **Estimated runtime** | quick ≈ 20-40 s · agent E2E subset (`playwright test agent-`) ≈ 3-5 min after `build:root` + `build:sub` · full verify ≈ 6-9 min warm |

---

## Sampling Rate

- **After every task commit:** pre-commit hook (gitleaks staged + real-data guard), then the task's `<automated>` command (unit tasks: the single test file; UI tasks: `check && lint && banned`).
- **After every plan wave:** `corepack pnpm vitest run --project core --project web --project scripts` + `build:root` + `build:sub` + `csp:assert` + `playwright test agent-` (both projects).
- **Before `/gsd:verify-work`:** `corepack pnpm verify` green (plan 08-26 Task 3) and 08-HUMAN-UAT.md written.
- **Max feedback latency:** ≈ 40 s for unit tasks; E2E tasks are bounded by the two builds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 1 | AGT-01, AGT-03 | unit | `vitest run --project core packages/core/src/agent` (schemas.test.ts) | ✅ created | ✅ green (4e453c1) |
| 8-01-02 | 01 | 1 | AGT-03 | unit + property | `vitest run --project core packages/core/src/leads/normalize.test.ts` | ✅ created | ✅ green (f7b408e, 7b29ef2; gate fix 70253af) |
| 8-02-01 | 02 | 1 | AGT-02, AGT-04 | unit (lint fixtures) | `vitest run --project scripts eslint-rules` | ✅ extend | ✅ green (59c61c1) |
| 8-02-02 | 02 | 1 | AGT-02, AGT-04 | unit (import graph + planted control) | `vitest run --project scripts agent-boundary` | ✅ created | ✅ green (7fb73fc; gate fix e8b048e) |
| 8-03-01 | 03 | 1 | AGT-01 | unit (CSP oracle mutation) | `vitest run --project scripts assert-csp && pnpm csp:assert` | ✅ extend | ✅ green (bd84fca) |
| 8-03-02 | 03 | 1 | AGT-01 | E2E (built-site blob: probe) + unit (banned scope) | `playwright test csp` · `vitest run --project scripts banned-terms` | ✅ extend | ✅ green (8962314) |
| 8-04-01 | 04 | 1 | AGT-01 | unit (contrast, fallback never reaches output) | `vitest run --project brand brand-color` | ✅ created | ✅ green (da751f2, 6c3dc0c) |
| 8-04-02 | 04 | 1 | AGT-01 | unit (logo magic bytes, sizes) | `vitest run --project core packages/core/src/agent/logo.test.ts` | ✅ created | ✅ green (e0e4ac0, 22b771f, 194794c) |
| 8-05-01 | 05 | 2 | AGT-02, AGT-03 | unit + property (mangled fixtures, round trip, collapsed) | `vitest run --project core packages/core/src/leads/lead-block.test.ts` | ✅ created | ✅ green (296dc62, 1c4412f) |
| 8-05-02 | 05 | 2 | AGT-03 | unit (free-form) | `vitest run --project core packages/core/src/leads/parse-freeform.test.ts` | ✅ created | ✅ green (2bd210a, 8c7a04a) |
| 8-06-01 | 06 | 2 | AGT-03 | unit (dedupe diff) | `vitest run --project core packages/core/src/leads/diff-leads.test.ts` | ✅ created | ✅ green (bc0cd81, 9210710) |
| 8-06-02 | 06 | 2 | AGT-02 | unit + property (param contract) | `vitest run --project core packages/core/src/leads/inquiry-params.test.ts` | ✅ created | ✅ green (4305d02, 066bcf2, bd57fe9) |
| 8-07-01 | 07 | 2 | AGT-07 | unit + property (RFC 4180 round trip, formula escape inverse) | `vitest run --project core packages/core/src/csv/csv.test.ts` | ✅ created | ✅ green (d7fec4b, 3250afe, 7875927) |
| 8-07-02 | 07 | 2 | AGT-07 | unit + property (columns, 5,000 cap, export→import) | `vitest run --project core packages/core/src/csv` | ✅ created | ✅ green (5e16e27, 326945e) |
| 8-08-01 | 08 | 2 | AGT-01 | unit (7 rules, brokerage-first, planted control) | `vitest run --project core packages/core/src/disclosure/compose.test.ts` | ✅ created | ✅ green (92becfe, 681e80b) |
| 8-08-02 | 08 | 2 | AGT-06 | unit + property (CAN-SPAM footer presence) | `vitest run --project core packages/core/src/disclosure` | ✅ created | ✅ green (f42b1ff, 27d2431) |
| 8-09-01 | 09 | 2 | AGT-04 | unit (applyMove, counts, sort, date math) | `vitest run --project core packages/core/src/crm/pipeline.test.ts` | ✅ created | ✅ green (27e040a, a5d76f1) |
| 8-09-02 | 09 | 2 | AGT-05 | unit (due-today groups, smart lists, TZ injection) | `vitest run --project core packages/core/src/crm` | ✅ created | ✅ green (bfc5e1a, f83fcaa) |
| 8-10-01 | 10 | 2 | AGT-04, AGT-05 | static (check, lint, forbidden-class grep) | `pnpm check && pnpm lint && pnpm banned` | n/a | ✅ green (c9b3f69) |
| 8-10-02 | 10 | 2 | AGT-04, AGT-05 | unit (SSR structure, local dates in America/Los_Angeles) | `vitest run --project web src/lib/features/agent` | ✅ created | ✅ green (cc18084) |
| 8-11-01 | 11 | 2 | AGT-04, AGT-05 | build (6 routes prerendered) | `pnpm check && pnpm lint && pnpm build:root` | n/a | ✅ green (9fe1523; gate fix cbb6a26) |
| 8-11-02 | 11 | 2 | AGT-04, AGT-05 | E2E (nav, aria-current, 375px) + oracle | `playwright test agent-shell routing a11y csp` · `pnpm csp:assert` | ✅ created | ✅ green (5b69a9f; gate fix 177dbea) |
| 8-12-01 | 12 | 3 | AGT-01 | unit (fake-indexeddb: profile, backup scan with logo + key, planted key refused) | `vitest run --project web src/lib/storage/agent` | ✅ created | ✅ green (721bb6b, 7679396, 984e2d5) |
| 8-12-02 | 12 | 3 | AGT-03, AGT-04 | unit (transactional move/undo, atomicity, opt-out, cascade delete) | `vitest run --project web src/lib/storage/agent` | ✅ created | ✅ green (710ffc0, 7c43408) |
| 8-13-01 | 13 | 3 | AGT-02 | unit (sink payload/no botcheck/error mapping, URL round trip both bases, gate) | `vitest run --project web src/lib/leads src/lib/components/inquiry` | ✅ created | ✅ green (4b68323, e8e4408) |
| 8-13-02 | 13 | 3 | AGT-02 | build + oracle + graph (public page isolated, noindex) | `pnpm build:root && pnpm build:sub && pnpm csp:assert && vitest run --project scripts agent-boundary` | n/a | ✅ green (3c59a0d, 05ad5e3) |
| 8-13-03 | 13 | 3 | AGT-02 | E2E (mocked Web3Forms: payload, honeypot, 3 s gate, failures, demo, incomplete, axe 375) | `playwright test agent-inquire` | ✅ created | ✅ green (188d43e; gate fix bab386d) |
| 8-14-01 | 14 | 4 | AGT-05 | unit (tasks: done/reopen/delete/restore, atomicity, index) | `vitest run --project web src/lib/storage/agent` | ✅ created | ✅ green (c1c2274) |
| 8-14-02 | 14 | 4 | AGT-03, AGT-07 | unit (single-transaction commit, never overwrite, 5,000 rows) | `vitest run --project web src/lib/storage/agent` | ✅ created | ✅ green (3a4e1e9) |
| 8-15-01 | 15 | 4 | AGT-03 | unit (12-contact fixture, 2/3/4 task split, load/remove/restore) + guard | `vitest run --project web src/lib/features/agent/samples && node scripts/guard-real-data.mjs --all` | ✅ created | ✅ green (56497ce) |
| 8-15-02 | 15 | 4 | AGT-03 | unit (quick-add validation + duplicate precedence) | `vitest run --project web src/lib/features/agent` | ✅ created | ✅ green (711f96d) |
| 8-15-03 | 15 | 4 | AGT-03 | E2E (empty state, samples + undo, quick add + duplicates, axe) | `playwright test agent-entry` | ✅ created | ✅ green (b48027b, 7d5e4cf; gate fix 98a321a) |
| 8-16-01 | 16 | 4 | AGT-01 | unit (profile validation) | `vitest run --project web src/lib/features/agent/profile` | ✅ created | ✅ green (75bc804, af45e28) |
| 8-16-02 | 16 | 4 | AGT-01 | E2E (save + reload, TX/NY disclosure preview, invalid ZIP focus, axe) | `playwright test agent-profile` | ✅ created | ✅ green (d6f868b) |
| 8-17-01 | 17 | 3 | AGT-04 | unit (?list/?q, search filter) | `vitest run --project web src/lib/features/agent/crm/list-state.test.ts` | ✅ created | ✅ green (164e35a, 0b3ca9d) |
| 8-17-02 | 17 | 3 | AGT-04, AGT-05 | unit (SSR: card chips, due badge, one pressed filter) | `vitest run --project web src/lib/features/agent/crm` | ✅ created | ✅ green (568518d) |
| 8-18-01 | 18 | 5 | AGT-07 | unit (export: BOM, one header row, formula escape, samples excluded) | `vitest run --project web src/lib/features/agent/import` | ✅ created | ✅ green (dcbb007) |
| 8-18-02 | 18 | 5 | AGT-03 | build | `pnpm check && pnpm lint && pnpm banned && pnpm build:root` | n/a | ✅ green (12bf222) |
| 8-18-03 | 18 | 5 | AGT-07, AGT-03 | E2E (list/search/smart lists; download bytes EF BB BF + CRLF + escape) | `playwright test agent-contacts agent-csv` | ✅ created | ✅ green (56f10a4, 403ee14) |
| 8-19-01 | 19 | 5 | AGT-04 | unit (drag id guard, media query) | `vitest run --project web src/lib/features/agent/pipeline` | ✅ created | ✅ green (f629df2) |
| 8-19-02 | 19 | 5 | AGT-04 | build (svelte-ignore present, no transitions) | `pnpm check && pnpm lint && pnpm build:root` | n/a | ✅ green (d4f1dde) |
| 8-19-03 | 19 | 5 | AGT-04 | E2E (keyboard through 5 stages, dragTo at 1280, undo, announcements, focus, axe menu open) | `playwright test agent-pipeline` | ✅ created | ✅ green (7d61c92; gate fix 8b18958) |
| 8-20-01 | 20 | 5 | AGT-03, AGT-07 | unit (paste modes, UTF-8 → windows-1252 fallback) | `vitest run --project web src/lib/features/agent/import` | ✅ created | ✅ green (53f8750, a4de201) |
| 8-20-02 | 20 | 5 | AGT-03, AGT-07 | build + honest-copy grep | `pnpm check && pnpm lint && pnpm banned && pnpm build:root` | n/a | ✅ green (50f2c56) |
| 8-20-03 | 20 | 5 | AGT-03, AGT-07 | E2E (block + mangled + free-form paste, duplicate/update, CSV mapping, invalid rows, caps, 1252, axe) | `playwright test agent-import` | ✅ created | ✅ green (a29c89a) |
| 8-21-01 | 21 | 5 | AGT-05 | unit (counts, focus target, checklist) | `vitest run --project web src/lib/features/agent/tasks src/lib/features/agent/home` | ✅ created | ✅ green (b95f7be, 2b67f2e) |
| 8-21-02 | 21 | 5 | AGT-05 | build | `pnpm check && pnpm lint && pnpm banned && pnpm build:root` | n/a | ✅ green (768a393, a8a416d) |
| 8-21-03 | 21 | 5 | AGT-05 | E2E (queue on /agent/, nav pill, complete/reopen, home counts, axe) | `playwright test agent-today` | ✅ created | ✅ green (0a28f7b; gate fix cbb6a26) |
| 8-22-01 | 22 | 5 | AGT-01 | unit (logo pipeline, base64, rasterize retries) | `vitest run --project web src/lib/features/agent/profile` | ✅ created | ✅ green (1dc4e88) |
| 8-22-02 | 22 | 5 | AGT-01 | build + oracle | `pnpm build:root && pnpm build:sub && pnpm csp:assert` | n/a | ✅ green (71028d8) |
| 8-22-03 | 22 | 5 | AGT-01 | E2E (logo renders from blob: under CSP, refusals, verdicts + fallbacks) | `playwright test agent-profile` | ✅ created | ✅ green (5c40339) |
| 8-23-01 | 23 | 6 | AGT-04, AGT-05 | unit (detail copy helpers) | `vitest run --project web src/lib/features/agent/contact` | ✅ created | ✅ green (f0db223, 0ac1d41) |
| 8-23-02 | 23 | 6 | AGT-04, AGT-05 | build (no window.confirm, no sms:) | `pnpm check && pnpm lint && pnpm banned && pnpm build:root` | n/a | ✅ green (c7fbd07) |
| 8-23-03 | 23 | 6 | AGT-04, AGT-05 | E2E (stage select + undo + activity, tasks, log call, edit duplicate, opt-out, delete cascade, not found) | `playwright test agent-contact` | ✅ created | ✅ green (a4513c7; gate fix ff96d70) |
| 8-24-01 | 24 | 6 | AGT-02 | unit (profile → public params only, round trip both bases) | `vitest run --project web src/lib/features/agent/profile/share-link.test.ts` | ✅ created | ✅ green (af14d32, 0f525a7) |
| 8-24-02 | 24 | 6 | AGT-02 | build + oracle | `pnpm build:root && pnpm build:sub && pnpm csp:assert` | n/a | ✅ green (4bedc7f) |
| 8-24-03 | 24 | 6 | AGT-02 | E2E (blockers, key validation, params subset, copy, open → public page → mocked send) | `playwright test agent-share-link agent-inquire` | ✅ created | ✅ green (a151752) |
| 8-25-01 | 25 | 7 | AGT-06 | unit (gates, footer in every exitPayload, ad-id line, redaction, fixture passes FH) | `vitest run --project web src/lib/features/agent/followup src/lib/ai` | ✅ created | ✅ green (e315fda, 95f3fe7) |
| 8-25-02 | 25 | 7 | AGT-06 | build + graph | `pnpm build:root && vitest run --project scripts agent-boundary` | n/a | ✅ green (c3725ee) |
| 8-25-03 | 25 | 7 | AGT-06, AGT-01 | E2E (Fixture provider draft, footer in Copy/mailto/Mark as sent, opt-out, no-email gate, incomplete profile, zero AI/RentCast requests) | `playwright test agent-followup` | ✅ created | ✅ green (d00eec4) |
| 8-26-01 | 26 | 8 | all | E2E sweep (axe + 375 on every agent route empty/samples, RentCast tripwire across all flows, CSV browser round trip, no sms:) | `playwright test agent-` · `vitest run --project scripts agent-boundary` | ✅ created | ✅ green (7ea8cf3) |
| 8-26-02 | 26 | 8 | all | docs (HUMAN-UAT, validation, requirements) | `pnpm lint && pnpm guard && pnpm secrets:scan` | n/a | ✅ green (docs(08-26) commit) |
| 8-26-03 | 26 | 8 | all | full gate | `corepack pnpm verify` | ✅ | ⬜ pending (08-26 Task 3) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

No test file was renamed during execution. The gate added `apps/web/tests/e2e/agent-a11y.spec.ts` and `agent-no-rentcast.spec.ts` (8-26-01) and extended `agent-csv.spec.ts` and `scripts/agent-boundary.test.ts`.

Success-criterion coverage:
1. Profile + disclosures appended: 8-08-01/02 (composer + footer presence), 8-16-02 (preview), 8-22-03 (logo/colors), 8-25-01/03 (every draft exit), 8-13-03 (inquiry page shows the disclosure).
2. Inquiry page with spam protection + paste/manual with duplicate detection: 8-13-01/03, 8-24-03, 8-05-01, 8-06-01, 8-15-03, 8-20-03; real delivery = HUMAN-UAT-1..4.
3. Pipeline + tasks + due-today on open: 8-09-01/02, 8-12-02, 8-14-01, 8-19-03, 8-21-03, 8-23-03.
4. AI follow-up with postal address + opt-out, Fair Housing, copy/mailto only; CSV import/export: 8-08-02, 8-25-01/03, 8-07-01/02, 8-18-03, 8-20-03, 8-26-01 (round trip).
5. Demo-credible: 8-15-01/03 (samples keyless), 8-02-02 + 8-26-01 (zero RentCast, structural + runtime), 8-25-03 (Fixture provider, FH), 8-11-02 + 8-26-01 (axe everywhere).

---

## Wave 0 Requirements

Phase 8 has no separate Wave 0 plan: every test file is created RED in the same task that implements it (TDD tasks) or in the plan's E2E task. Infrastructure added before first use:
- [x] `fast-check@4.10.2` devDependency in `packages/core` (08-01 Task 1)
- [x] `tooling/import-graph.ts` + `scripts/agent-boundary.test.ts` with planted control (08-02 Task 2)
- [x] `apps/web/tests/e2e/agent-helpers.ts` (08-13 Task 3; seeding helpers appended by 08-15 Task 3)
- [x] CSP `img-src 'self' blob:` in both files + oracle cases (08-03 Task 1)
- [x] Route lists: `AGENT_ROUTES` (08-11), `PUBLIC_ROUTES` (08-13) in `tests/e2e/routes.ts` and `EXPECTED_PAGES`
- [x] Synthetic fixtures under scanned paths only (`packages/core/src/leads/fixtures/`, `apps/web/src/lib/features/agent/fixtures/`, `packages/core/src/agent/fixtures/`): @example.com, 555-01xx; low-entropy test access key `00000000-0000-4000-8000-000000000000`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real inquiry arrives by email through the agent's own Web3Forms key | AGT-02 | The owner has no Web3Forms key yet; server delivery cannot be mocked meaningfully | 08-HUMAN-UAT.md UAT-1 |
| The `tran_lead_v1` field appears in the notification email | AGT-02, AGT-03 | Web3Forms notification rendering is undocumented | UAT-2 |
| Pasting real notification emails from Gmail web, Outlook and Apple Mail parses exactly | AGT-03 | Real mail-client mangling | UAT-3 |
| hCaptcha enabled on the key shows the "can't send" copy | AGT-02 | Requires dashboard change on a real key | UAT-4 |
| Free-tier limit behavior | AGT-02 | Undocumented, needs volume | UAT-5 |
| Follow-up opens intact in desktop/mobile email apps | AGT-06 | OS mail handlers vary | UAT-6 |
| State disclosure + CAN-SPAM wording reviewed by counsel | AGT-01, AGT-06 | Legal review, not engineering | UAT-7 (before Phase 10 GTM) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (each test file is created by the task that needs it)
- [x] No watch-mode flags
- [x] Feedback latency < 40 s for unit tasks (confirmed during execution: single unit files run in 1-2 s on one pinned core)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-07 (plan 08-26 gate; see 08-26-SUMMARY.md for the verify run)
