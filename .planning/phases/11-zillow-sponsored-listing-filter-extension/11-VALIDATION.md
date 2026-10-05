---
phase: 11
slug: zillow-sponsored-listing-filter-extension
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-04
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11: `extension` project (happy-dom 20.14.5 + WxtVitest fake-browser), `extension-browser` (Vitest browser mode, Playwright/Chromium, axe-core), existing `scripts` project (node). Playwright 1.63.0 for the runtime extension E2E. |
| **Config file** | `apps/extension/vitest.config.ts` (11-01, in root `projects`), `apps/extension/vitest.browser.config.ts` (11-09, NOT in root projects), `apps/extension/playwright.config.ts` (11-11) |
| **Quick run command** | `corepack pnpm vitest run --project extension` |
| **Full suite command** | `corepack pnpm verify` (appended by 11-12: `… && pnpm ext:build && pnpm ext:assert && pnpm ext:test:browser && pnpm ext:e2e`) |
| **Estimated runtime** | quick ~8 s; extension build+zip+oracle ~30 s; popup axe ~20 s; runtime E2E ~30 s |

---

## Sampling Rate

- **After every task commit:** `corepack pnpm vitest run --project extension` (or `--project scripts <suite>` for scripts-side tasks)
- **After every plan wave:** `corepack pnpm test:unit && corepack pnpm check && corepack pnpm lint` plus, from wave 4 on, `corepack pnpm --filter extension zip && node scripts/assert-extension.mjs apps/extension/.output/chrome-mv3 --zip-dir apps/extension/.output`
- **Before `/gsd:verify-work`:** `corepack pnpm verify` green
- **Max feedback latency:** ~10 s for the quick command

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | EXT-03 | unit (non-vacuity) | `corepack pnpm vitest run --project extension no-network && corepack pnpm --filter extension check` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | EXT-01, EXT-02 | unit (schema, fakeBrowser, messaging) | `corepack pnpm vitest run --project extension selectors settings messages` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | EXT-03 | unit (banned copy + planted control) | `corepack pnpm vitest run --project extension copy-banned` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 2 | EXT-04 | script output | `corepack pnpm --filter extension icons` | ❌ | ⬜ pending |
| 11-02-02 | 02 | 2 | EXT-04 | unit (PNG IHDR) | `corepack pnpm vitest run --project extension icons` | ❌ | ⬜ pending |
| 11-03-01 | 03 | 2 | EXT-01 | guard | `node scripts/guard-real-data.mjs --all` | ❌ | ⬜ pending |
| 11-03-02 | 03 | 2 | EXT-01 | unit (synthetic-DOM matcher, 4 fixtures, Showcase/Gas-fireplace negatives) | `corepack pnpm vitest run --project extension detect fixtures` | ❌ | ⬜ pending |
| 11-04-01 | 04 | 2 | EXT-01 | unit (pill a11y, closed shadow, shared sheet, stopPropagation) | `corepack pnpm vitest run --project extension reveal-host` | ❌ | ⬜ pending |
| 11-04-02 | 04 | 2 | EXT-01 | unit (token parity, rejects planted #006AFF) | `corepack pnpm vitest run --project extension brand-parity` | ❌ | ⬜ pending |
| 11-05-01 | 05 | 2 | EXT-02 | unit (7 popup states, injected sendToTab) | `corepack pnpm vitest run --project extension popup-model` | ❌ | ⬜ pending |
| 11-05-02 | 05 | 2 | EXT-02 | unit (token mirror) | `corepack pnpm vitest run --project extension popup-tokens` | ❌ | ⬜ pending |
| 11-06-01 | 06 | 2 | EXT-03 | unit (ESLint planted violations) | `corepack pnpm vitest run --project scripts eslint-rules` | ✅ (extend) | ⬜ pending |
| 11-06-02 | 06 | 2 | EXT-03 | unit (manifest/bundle/zip oracle mutation suite) | `corepack pnpm vitest run --project scripts assert-extension` | ❌ | ⬜ pending |
| 11-07-01 | 07 | 2 | EXT-04 | unit (release gate) + actionlint | `corepack pnpm vitest run --project scripts extension-release-gate && corepack pnpm lint:workflows` | ❌ | ⬜ pending |
| 11-07-02 | 07 | 2 | EXT-04, EXT-03 | unit (docs, Edge copy, privacy section) | `corepack pnpm vitest run --project scripts extension-docs && corepack pnpm banned` | ❌ | ⬜ pending |
| 11-08-01 | 08 | 3 | EXT-01 | unit (idempotent reconcile, recycled nodes, byte-exact restore) | `corepack pnpm vitest run --project extension reconcile` | ❌ | ⬜ pending |
| 11-08-02 | 08 | 3 | EXT-01, EXT-02 | unit (MutationObserver debounce, locationchange re-scan, toggle) | `corepack pnpm vitest run --project extension observe filter` | ❌ | ⬜ pending |
| 11-09-01 | 09 | 3 | EXT-02, EXT-03 | typecheck + build | `corepack pnpm --filter extension check && corepack pnpm --filter extension build` | ❌ | ⬜ pending |
| 11-09-02 | 09 | 3 | EXT-02, EXT-03 | browser (popup axe, all 7 states, planted control) | `corepack pnpm --filter extension test:browser` | ❌ | ⬜ pending |
| 11-10-01 | 10 | 4 | EXT-01, EXT-02 | unit (badge, content wiring/messaging) | `corepack pnpm vitest run --project extension badge content-wiring` | ❌ | ⬜ pending |
| 11-10-02 | 10 | 4 | EXT-03, EXT-04 | integration (production manifest + bundle + zip oracle) | `corepack pnpm --filter extension zip && node scripts/assert-extension.mjs apps/extension/.output/chrome-mv3 --zip-dir apps/extension/.output` | ❌ | ⬜ pending |
| 11-11-01 | 11 | 5 | EXT-01 | typecheck | `corepack pnpm --filter extension check` | ❌ | ⬜ pending |
| 11-11-02 | 11 | 5 | EXT-01, EXT-02, EXT-03 | E2E (loaded extension, zero-network session) | `corepack pnpm --filter extension build && corepack pnpm --filter extension e2e` | ❌ | ⬜ pending |
| 11-12-01 | 12 | 6 | EXT-01..04 | unit (CI gate) + actionlint | `corepack pnpm vitest run --project scripts workflow-gate && corepack pnpm lint:workflows` | ✅ (extend) | ⬜ pending |
| 11-12-02 | 12 | 6 | EXT-01..04 | composed gate | `corepack pnpm verify` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Sampling continuity: no three consecutive tasks lack an automated command (every task above has one).

---

## Wave 0 Requirements

Plan 11-01 is the Wave 0 / foundation plan:

- [ ] `apps/extension/package.json` + one-shot install of every phase dependency (WXT 0.21.4 + explicit `vite@8.3.0`, no `web-ext`)
- [ ] `apps/extension/vitest.config.ts` with `WxtVitest({ root })`, happy-dom, network-disabling settings; root `vitest.config.ts` projects += `'apps/extension'` (verified FROM THE REPO ROOT)
- [ ] `apps/extension/tests/setup-no-network.ts` + `no-network.test.ts` non-vacuity
- [ ] `.gitignore` / `.prettierignore` / ESLint ignores += `**/.wxt/`, `**/.output/`
- [ ] Contracts: `selectors.v1.json`, `config.ts`, `copy.ts`, `messages.ts`, `settings.ts` with tests
- [ ] Precondition: Phase 2 executed (`themeVars` exported, `/legal/privacy/` exists) — fail closed otherwise

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live zillow.com detection matches the synthetic fixtures; observed labels recorded | EXT-01 | Zillow DOM cannot be fetched (403) or committed; only the owner's browser sees it | 11-HUMAN-UAT item 1 (Chrome + Edge, rentals + for-sale, scroll/page 2/filter change, DevTools Network) |
| Zero network in a real session on zillow.com | EXT-03 | Automated E2E covers a synthetic page; the live site is owner-only | 11-HUMAN-UAT item 1 DevTools checks |
| Zillow Terms of Use read before public release | EXT-04 | Automated fetch returns 403; legal judgment | 11-HUMAN-UAT item 2 |
| Edge Partner Center account + listing submission + screenshots | EXT-04 | Account creation and certification are owner-only | 11-HUMAN-UAT item 3 |
| Release workflow publishes on tag | EXT-04 | Needs the GitHub remote + `EXTENSION_RELEASES_ENABLED=true` | 11-HUMAN-UAT item 4 |
| Privacy URL live | EXT-03 | Depends on Phase 1 Pages enablement | 11-HUMAN-UAT item 5 |

All are non-blocking for the build (owner fully autonomous). Firefox Add-ons is cut per ROADMAP cut line (2).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 11s (quick command)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (11-12 Task 2 sets approved after the composed verify)
