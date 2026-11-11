---
phase: 16
slug: toolchain-pnpm-12-sveltekit-3-vitest-5
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-11-10
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `16-RESEARCH.md` §"Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.12 now (5.1.0 after the Vitest plan); Playwright (e2e + smoke) |
| **Config file** | root `vitest.config.ts` (10 projects), `apps/web/vite.config.ts`, `apps/web/vitest.browser.config.ts`, `*-serial` configs, `apps/web/playwright.config.ts`, `apps/web/playwright.smoke.config.ts` |
| **Quick run command** | `pnpm exec vitest run <file>` (name `*-serial` projects explicitly); `pnpm check` for Kit tasks |
| **Full suite command** | `pnpm verify` (includes `smoke:local` against all three builds) |
| **Estimated runtime** | quick: under 60 seconds; full: several minutes, may be run stage by stage |

---

## Sampling Rate

- **After every task commit:** the narrowest relevant `pnpm exec vitest run <files>`, plus `pnpm check` for Kit tasks
- **After every plan:** `pnpm install --frozen-lockfile`, then `pnpm verify` with all three builds rebuilt at HEAD (the build stamp is the commit SHA, so stale builds fail `smoke:local`)
- **After every push (owner-approved):** CI green, then one `live-smoke` run for that SHA (retries 0; exit 2 means HTTP 429, re-dispatch once); run links recorded in the plan summary
- **Before `/gsd:verify-work`:** full `pnpm verify` green on Vitest 5, evidence protocol re-run, `docs/LAUNCH-AUDIT.md` regenerated at the deployed commit, green live smoke
- **Max feedback latency:** 60 seconds for the per-task quick run

---

## Per-Task Verification Map

Task IDs are assigned by the planner; rows are keyed by requirement and behavior until then.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | pre-flight | — | Pre-flight (D-07) | — | A 429 on a smoke navigation exits 2, any other status exits 1 | unit | `pnpm exec vitest run scripts/smoke.test.ts` | ❌ W0 (extend) | ⬜ pending |
| TBD | pre-flight | — | Pre-flight (D-08) | Timeouts/retries raised to mask a regression | Each planted bypass (`{ timeout: 0 }`, shorthand retries, `page.setDefaultTimeout`, `serialTest()` retry, `--timeout=` flag) fails its rule | unit + mutation | `pnpm exec vitest run scripts/test-lane-rules.test.ts scripts/test-lanes.test.ts` | ✅ (add cases) | ⬜ pending |
| TBD | pnpm 12 | — | TOOL-01 | Supply chain | Pin is 12.x, no `11.27.0` literal, two-document lockfile, frozen install passes | unit + install | `pnpm exec vitest run scripts/supply-chain.test.ts scripts/launch-audit.test.ts scripts/pnpm-cmd.test.ts`; `pnpm install --frozen-lockfile`; `git grep -n "11\.27\.0" -- scripts package.json` | ✅ rewrite / ❌ W0 `pnpm-cmd.test.ts` | ⬜ pending |
| TBD | pnpm 12 | — | TOOL-01 | — | All four spawners work with a native `npm_execpath` | unit + build | `pnpm exec vitest run scripts/pnpm-cmd.test.ts`; `pnpm build:root` | ❌ W0 | ⬜ pending |
| TBD | Kit 3 | — | TOOL-02 | — | Zero `$lib`, `$service-worker`, `@migration-task`, `$app/environment`, `svelte.config.js` outside planted fixtures | grep gate | `pnpm exec vitest run scripts/kit3-migration.test.ts` | ❌ W0 | ⬜ pending |
| TBD | Kit 3 | — | TOOL-02 | Silent loss of boundary lint (`#` group is a comment) | ESLint boundary groups written `\#lib` and non-vacuous | unit (planted violations) | `pnpm exec vitest run scripts/eslint-rules.test.ts scripts/agent-boundary.test.ts` | ✅ (rewrite, add `\#` case) | ⬜ pending |
| TBD | Kit 3 | — | TOOL-02 | Boundary integrity | Regex-over-source boundary tests still bite | unit + mutation | `pnpm exec vitest run apps/web/src/lib/features/investor/data/investor-port.test.ts apps/web/src/lib/features/investor/analyzer/analyzer-page.svelte.test.ts apps/web/src/lib/ai/ui/key-card-additions.test.ts apps/web/src/lib/features/studio/boundaries.test.ts` | ✅ (add planted cases) | ⬜ pending |
| TBD | Kit 3 | — | TOOL-02 | CSP integrity | `kit.options.js` is plugin-free and shared | unit | `pnpm exec vitest run apps/web/src/lib/csp-policy.test.ts apps/web/src/lib/ai/models.test.ts scripts/site-url.test.ts scripts/service-worker-guard.test.ts` | ✅ (re-point) | ⬜ pending |
| TBD | Kit 3 | — | TOOL-02 | CSP integrity | Three builds pass the oracles, every gated page at or under 60 KB | build + assert | `pnpm build:root && pnpm build:sub && pnpm build:configured && pnpm csp:assert && pnpm seo:assert && pnpm budget:assert` | ✅ | ⬜ pending |
| TBD | Kit 3 | — | TOOL-02 | — | `resolve()` forms, `$app/env`, shallow routing | typecheck + e2e | `pnpm check`; `pnpm --filter web exec playwright test --project=root` | ✅ | ⬜ pending |
| TBD | Kit 3 | — | TOOL-03 | Worker caching cross-origin or key-bearing responses | Worker filter excludes dotfiles, maps through resolve/asset, allowlist only | unit | `pnpm exec vitest run scripts/service-worker-guard.test.ts` | ✅ (rewrite) | ⬜ pending |
| TBD | Kit 3 | — | TOOL-03 | — | Scope is the base path, `caches.keys()` is `[tran-shell-<sha>]`, no dotfiles | local smoke | `pnpm smoke:local` | ✅ (`pwa.smoke.ts`) | ⬜ pending |
| TBD | Vitest 5 | — | TOOL-04 | — | Zero bare `render(` in files importing `vitest-browser-svelte` | grep gate | `pnpm exec vitest run scripts/vitest5-migration.test.ts` | ❌ W0 | ⬜ pending |
| TBD | Vitest 5 | — | TOOL-04 | — | Exact-text and locator semantics accounted for | browser | `pnpm exec vitest run --project web-browser --project web-browser-serial`; `pnpm ext:test:browser` | ✅ (edit tests) | ⬜ pending |
| TBD | Vitest 5 | — | TOOL-04 | — | JSON reporter path still works | integration | `node scripts/audit-evidence.mjs unit smoke-check <one fast file>` writes JSON with `numTotalTests > 0` | ✅ script (add test) | ⬜ pending |
| TBD | Vitest 5 | — | TOOL-04 | Test integrity | Lanes still ordered and serial | unit | `pnpm exec vitest run scripts/lane-order.test.ts scripts/test-lanes.test.ts scripts/test-lane-rules.test.ts` | ✅ | ⬜ pending |
| TBD | Vitest 5 | — | TOOL-04 | — | Extension project runs under WXT | unit | `pnpm exec vitest run --project extension` | ✅ | ⬜ pending |
| TBD | Kit 3 | — | TOOL-05 | Advisory exceptions outliving their reason | Exception lists equal in both files and shrunk; audit clean apart from them | unit + audit | `pnpm exec vitest run scripts/supply-chain.test.ts`; `pnpm audit --audit-level low` | ✅ (update count) | ⬜ pending |
| TBD | every plan | — | TOOL-06 | — | Each step gated; phase closed by a deploy and a green live smoke | process | `pnpm verify`; `gh run list --workflow live-smoke` shows success for the pushed SHA | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/lib/pnpm-cmd.mjs` + `scripts/pnpm-cmd.test.ts` — both `npm_execpath` forms; fails if another script re-inlines the old pair
- [ ] `scripts/kit3-migration.test.ts` — zero-grep gates with an allowlist for planted fixtures
- [ ] `scripts/vitest5-migration.test.ts` — scoped bare-`render` assertion; `.vitest/` ignored
- [ ] ESLint `\#` non-vacuity case in `scripts/eslint-rules.test.ts`
- [ ] Planted-case rows for the regex-over-source boundary tests
- [ ] Smoke 429 relabel test (extend the existing smoke script tests)

Each test file is created inside the plan that needs it, before the change it guards.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Kit 3 service worker on the real CDN: scope `https://wolfwdavid.github.io/tran_real_estate/`, `caches.keys()` is `['tran-shell-<sha>']`, no dotfile precached | TOOL-03 | Only the live origin serves through Pages/Fastly | Owner-approved push, then read the `live-smoke` run for that SHA |
| `_app/version.json` propagates the new SHA | TOOL-03, TOOL-06 | CDN `max-age=600` | Covered by the live-smoke poll; read the run |
| The paced live run stays under the Pages rate limit | Pre-flight (D-07) | The limit cannot be exercised locally | One `live-smoke` run goes green without a re-dispatch (D-09 baseline) |
| GitHub dependency graph reads the two-document lockfile | TOOL-01 | Owner-visible GitHub UI only | After the pnpm 12 push, owner opens Insights → Dependency graph and confirms real packages are listed |
| Stale worker for a returning visitor | TOOL-03 | The smoke uses fresh contexts | Owner opens the site in a normal window after the Kit 3 deploy, reloads once, confirms the new build stamp |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
