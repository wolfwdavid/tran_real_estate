---
phase: 16
slug: toolchain-pnpm-12-sveltekit-3-vitest-5
status: planned
nyquist_compliant: true
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
- **Max feedback latency:** 60 seconds for the per-task quick run; gate-level commands (`pnpm verify`, `pnpm smoke:local`, `pnpm budget:assert` on fresh builds, the evidence-protocol runs) are exempt from the per-task latency and run stage by stage under the 7-minute call cap
- **Kit sequence (D-01 deviation, recorded in 16-05, 16-10 and ROADMAP):** plans 05 to 10 are one Kit major with one push; plans 05 to 09 are gated by their targeted tests only (the full chain cannot pass while Kit 3 rejects remaining `$lib` imports and the budget is red) and nothing is pushed until 16-10

---

## Per-Task Verification Map

Task IDs are `16-<plan>-<task>`; plans run strictly serially (one plan per wave, D-01).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | Pre-flight D-07.1 | T-16-01-01 | A 429 smoke navigation exits 2, 500 exits 1, green stays 0; mutation-tested | unit + mutation | `pnpm exec vitest run scripts/smoke.test.ts scripts/runbook.test.ts scripts/live-smoke-gate.test.ts` | ❌ W0 (extend) | ⬜ pending |
| 16-01-02 | 01 | 1 | Pre-flight D-07.2 | T-16-01-03 | Service worker blocked outside the two worker specs; no retry, timeout or sleep added; request volume measured before/after | unit pin + local smoke | `pnpm exec vitest run scripts/smoke.test.ts scripts/test-lanes.test.ts`; `pnpm smoke:local` | ✅ | ⬜ pending |
| 16-01-03 | 01 | 1 | Pre-flight | T-16-01-03 | Local gate green at the pushed HEAD | local smoke | `pnpm smoke:local` | ✅ | ⬜ pending |
| 16-01-04 | 01 | 1 | Pre-flight D-07.2 / TOOL-06 | T-16-01-02 | Paced live run green on its own (owner-approved push) | live (checkpoint) | `gh run list --workflow live-smoke.yml --limit 1 --json conclusion,headSha` | n/a | ⬜ pending |
| 16-02-01 | 02 | 2 | Pre-flight D-08 (CR-01, WR-02) | T-16-02-01, T-16-02-02 | timeout 0 and options by reference/shorthand/spread are findings; each fix revert-proven | unit + mutation | `pnpm exec vitest run --project scripts --project scripts-serial scripts/test-lane-rules.test.ts scripts/test-lanes.test.ts` | ✅ (add cases) | ⬜ pending |
| 16-02-02 | 02 | 2 | Pre-flight D-08 (WR-03, WR-04) | T-16-02-03 | setDefault*Timeout, testInfo raises, lanes.ts, CLI flags, continue-on-error and || re-runs are findings | unit + mutation | `pnpm exec vitest run --project scripts --project scripts-serial scripts/test-lane-rules.test.ts scripts/test-lanes.test.ts scripts/workflow-gate.test.ts` | ✅ (add cases) | ⬜ pending |
| 16-02-03 | 02 | 2 | Pre-flight D-08 (WR-05, WR-06 slice, WR-08) | T-16-02-04 | Exclude pin behavioural; negated annotation rejected; serialTest refuses VITEST_MAX_WORKERS | unit + mutation | `pnpm exec vitest run --project scripts --project scripts-serial scripts/test-lanes.test.ts scripts/test-lane-rules.test.ts scripts/lane-order.test.ts` | ✅ (rewrite) | ⬜ pending |
| 16-03-01 | 03 | 3 | D-09 baseline | T-16-03-01 | Full verify green on Kit 2 / Vitest 4 / pnpm 11 at the pre-flight SHA | full chain | `pnpm verify` (stage by stage) | ✅ | ⬜ pending |
| 16-03-02 | 03 | 3 | D-09 baseline / TOOL-06 | T-16-03-02, T-16-03-03 | One green live-smoke run, link recorded (owner-approved push) | live (checkpoint) | `gh run list --workflow live-smoke.yml --limit 1 --json conclusion,headSha` | n/a | ⬜ pending |
| 16-04-01 | 04 | 4 | TOOL-01 | T-16-04-04 | All four spawners work with .js and native npm_execpath; no inline pair survives | unit + sweep | `pnpm exec vitest run scripts/pnpm-cmd.test.ts scripts/smoke.test.ts scripts/audit-evidence.test.ts scripts/launch-audit.test.ts` | ❌ W0 (pnpm-cmd.test.ts) | ⬜ pending |
| 16-04-02 | 04 | 4 | TOOL-01 | T-16-04-01, T-16-04-03, T-16-04-05 | Pin 12.18.0, one lockfile regeneration, two-document lockfile test, no 11.27.0 literal | unit + install | `pnpm install --frozen-lockfile && pnpm exec vitest run scripts/supply-chain.test.ts scripts/launch-audit.test.ts scripts/pnpm-cmd.test.ts` | ✅ (rewrite) | ⬜ pending |
| 16-04-03 | 04 | 4 | TOOL-01 / TOOL-06 | T-16-04-04 | Native-binary spawners and the full verify chain green under pnpm 12 | install + build | `pnpm install --frozen-lockfile && pnpm build:root`; `pnpm verify` | ✅ | ⬜ pending |
| 16-04-04 | 04 | 4 | TOOL-01 / TOOL-06 | T-16-04-03 | CI frozen install, live smoke, dependency graph (owner row) | live (checkpoint) | `gh run list --workflow live-smoke.yml --limit 1 --json conclusion,headSha` | n/a | ⬜ pending |
| 16-05-01 | 05 | 5 | TOOL-02 | T-16-05-01, T-16-05-05 | Exact Kit 3 pins in one reviewed lockfile change; JS type-checking preserved | install + typecheck | `pnpm install --frozen-lockfile && pnpm --filter web exec svelte-kit sync` | ✅ | ⬜ pending |
| 16-05-02 | 05 | 5 | TOOL-02 | T-16-05-02 | kit.options.js plugin-free and shared by CSP, models, site-url and worker-guard tests | unit | `pnpm exec vitest run apps/web/src/lib/csp-policy.test.ts apps/web/src/lib/ai/models.test.ts scripts/site-url.test.ts scripts/service-worker-guard.test.ts scripts/assert-csp.test.ts` | ✅ (re-point) | ⬜ pending |
| 16-05-03 | 05 | 5 | TOOL-02 | T-16-05-03 | Small codemod groups (environment, paths, app-state, imports, external-redirects, params) as separate footprint-checked commits | unit + review | `pnpm exec vitest run --project web apps/web/src/lib/features/agent apps/web/src/lib/features/renter apps/web/src/lib/features/investor` | ✅ | ⬜ pending |
| 16-05-04 | 05 | 5 | TOOL-02 | T-16-05-03, T-16-05-04 | Shallow-routing codemod in its own commit; every navigation handler guarded in a separate review commit | unit + review | `pnpm exec vitest run --project web apps/web/src/lib/features/agent apps/web/src/lib/features/renter/search apps/web/src/lib/features/investor/analyzer` | ✅ | ⬜ pending |
| 16-06-01 | 06 | 6 | TOOL-02 | T-16-06-01 | lib-alias codemod output isolated in one commit | git review | `git grep -c "from '#lib/" -- apps/web/src` | ✅ | ⬜ pending |
| 16-06-02 | 06 | 6 | TOOL-02 | T-16-06-01 | Hand fixes leave svelte-check clean except the old worker | typecheck | `pnpm --filter web exec svelte-check --tsconfig ./tsconfig.json` | ✅ | ⬜ pending |
| 16-06-02b | 06 | 6 | TOOL-02 | T-16-06-01 | The four `vi.mock('#lib/components/a11y/announcer.svelte')` sites resolve to the component's module id (typo mutant fails) | browser + mutation | `pnpm exec vitest run --project web-browser apps/web/src/lib/features/renter/fair-rent apps/web/src/lib/features/shared/data` | ✅ | ⬜ pending |
| 16-06-03 | 06 | 6 | TOOL-02 | T-16-06-04 | Stub mirrors Kit 3 resolve/asset; web unit and browser projects green | unit + browser | `pnpm exec vitest run apps/web/src/lib/testing/app-paths.stub.test.ts --project web`; web and browser projects | ❌ W0 (stub test) | ⬜ pending |
| 16-07-01 | 07 | 7 | TOOL-02 | T-16-07-01, T-16-07-03 | ESLint groups written with the escaped hash, non-vacuous; bare anchor reported | unit (planted violations) | `pnpm exec vitest run scripts/eslint-rules.test.ts scripts/agent-boundary.test.ts` | ✅ (rewrite, add escape case) | ⬜ pending |
| 16-07-02 | 07 | 7 | TOOL-02 | T-16-07-02 | Import-graph walkers and regex boundary tests still bite on #lib | unit + mutation | `pnpm exec vitest run apps/web/src/lib/ai/no-auto-send.test.ts apps/web/src/lib/features/investor/data/investor-port.test.ts apps/web/src/lib/features/investor/analyzer/analyzer-page.svelte.test.ts apps/web/src/lib/ai/ui/key-card-additions.test.ts apps/web/src/lib/features/studio/boundaries.test.ts apps/web/src/lib/features/shared/affordability/affordability.test.ts` | ✅ (add planted cases; affordability is the seventh guard) | ⬜ pending |
| 16-07-03 | 07 | 7 | TOOL-02 | T-16-07-05 | Zero $lib/@migration-task/$app/environment/$app/stores/svelte.config.js outside the allowlist; alias and components.json on #lib | grep gate | `pnpm exec vitest run scripts/kit3-migration.test.ts scripts/eslint-rules.test.ts scripts/agent-boundary.test.ts`; `pnpm lint` | ❌ W0 (kit3-migration.test.ts) | ⬜ pending |
| 16-07-04 | 07 | 7 | TOOL-02 | T-16-07-04 | shadcn-svelte add --dry-run leaves the tree unchanged (assumption A6); lint and unit gates green | dry run + lint | `pnpm lint && pnpm exec vitest run scripts/kit3-migration.test.ts` | ✅ | ⬜ pending |
| 16-08-01 | 08 | 8 | TOOL-03 | T-16-08-01, T-16-08-02, T-16-08-03 | Worker on $app/manifest; guard flipped not weakened; dotfile filter proven with a planted .nojekyll | unit + mutation | `pnpm exec vitest run scripts/service-worker-guard.test.ts scripts/kit3-migration.test.ts scripts/pwa-assets.test.ts scripts/eslint-rules.test.ts` (fetch-ban exemption follows the worker to its exact new path; sibling and old-path negative controls) | ✅ (rewrite) | ⬜ pending |
| 16-08-02 | 08 | 8 | TOOL-02 / TOOL-03 | T-16-08-04, T-16-08-05 | Three builds, csp/seo asserts, smoke:local, shallow-routing E2E; budget numbers recorded | build + assert + e2e | `pnpm check && pnpm csp:assert && pnpm seo:assert`; `pnpm smoke:local` | ✅ | ⬜ pending |
| 16-09-01 | 09 | 9 | TOOL-02 (D-04) | T-16-09-01 | Initial-JS attribution and oracle cross-check against real transfer | measurement | `node scripts/assert-budget.mjs apps/web/build --require-tools` | ✅ | ⬜ pending |
| 16-09-02 | 09 | 9 | TOOL-02 (D-04) | T-16-09-01, T-16-09-02 | All gated pages at or under 60 KB with the assert untouched | build + assert | `pnpm budget:assert` | ✅ | ⬜ pending |
| 16-09-03 | 09 | 9 | TOOL-02 (D-04) | T-16-09-04 | Owner decision only if the trim fell short | decision (checkpoint) | `pnpm budget:assert` | n/a | ⬜ pending |
| 16-10-01 | 10 | 10 | TOOL-05 | T-16-10-01 | Exceptions five to two in both files, equal, audit clean | unit + audit | `pnpm exec vitest run scripts/supply-chain.test.ts && pnpm audit --audit-level low` | ✅ (update count) | ⬜ pending |
| 16-10-02 | 10 | 10 | TOOL-02 / TOOL-05 / TOOL-06 | T-16-10-04, T-16-10-06 | ROADMAP (goal, criterion 5, phase-list bullet) and REQUIREMENTS (TOOL-05, TOOL-06) wording corrected, Kit-sequence deviation recorded, Dependabot Kit ignores released, RUNBOOK range-revert rollback recipe pinned | unit | `pnpm exec vitest run scripts/supply-chain.test.ts scripts/runbook.test.ts scripts/workflow-gate.test.ts` | ✅ | ⬜ pending |
| 16-10-03 | 10 | 10 | TOOL-02 / TOOL-06 | T-16-10-01 | Full verify chain green on Kit 3, budget at 60 KB | full chain | `pnpm budget:assert && pnpm smoke:local`; `pnpm verify` | ✅ | ⬜ pending |
| 16-10-04 | 10 | 10 | TOOL-03 / TOOL-06 | T-16-10-02, T-16-10-03, T-16-10-05 | Live origin serves the Kit 3 worker: scope, tran-shell-sha, no dotfile; stale-worker row (owner) | live (checkpoint) | `gh run list --workflow live-smoke.yml --limit 1 --json conclusion,headSha` | n/a | ⬜ pending |
| 16-11-01 | 11 | 11 | TOOL-04 | T-16-11-01, T-16-11-03 | Five Vitest-family pins in one lockfile commit; every render awaited (AST guard); .vitest/ ignored | unit + install | `pnpm install --frozen-lockfile && pnpm exec vitest run scripts/vitest5-migration.test.ts` | ❌ W0 (vitest5-migration.test.ts) | ⬜ pending |
| 16-11-02 | 11 | 11 | TOOL-04 | T-16-11-02 | Exact-text and locator semantics accounted for; no timeout or retry added | browser | `pnpm exec vitest run --project web-browser --project web-browser-serial` | ✅ (edit tests) | ⬜ pending |
| 16-11-03 | 11 | 11 | TOOL-04 / TOOL-06 | T-16-11-04 | JSON reporter shard shape; extension and lane projects; full verify green | integration + full chain | `pnpm exec vitest run scripts/audit-evidence.test.ts scripts/supply-chain.test.ts scripts/lane-order.test.ts scripts/vitest5-migration.test.ts`; `pnpm verify` | ✅ (add shard test) | ⬜ pending |
| 16-11-04 | 11 | 11 | TOOL-04 / TOOL-06 | T-16-11-02 | CI on Vitest 5 and live smoke (owner-approved push) | live (checkpoint) | `gh run list --workflow live-smoke.yml --limit 1 --json conclusion,headSha` | n/a | ⬜ pending |
| 16-12-01 | 12 | 12 | TOOL-06 | T-16-12-01, T-16-12-03 | Playwright and axe bumped one family per commit with their own gates | install + unit | `pnpm install --frozen-lockfile && pnpm exec vitest run scripts/supply-chain.test.ts` | ✅ | ⬜ pending |
| 16-12-02 | 12 | 12 | TOOL-06 | T-16-12-01, T-16-12-03 | wxt and the ESLint family bumped one family per commit with their own gates; boundary groups unchanged | install + lint | `pnpm install --frozen-lockfile && pnpm lint && pnpm exec vitest run scripts/eslint-rules.test.ts scripts/supply-chain.test.ts` | ✅ | ⬜ pending |
| 16-12-03 | 12 | 12 | TOOL-06 | T-16-12-02, T-16-12-05 | bits-ui/layerchart/shadcn CLI bumped within the 60 KB budget; minimatch exception resolved and TOOL-05/ROADMAP count reworded to the final state | build + audit | `pnpm install --frozen-lockfile && pnpm exec vitest run scripts/supply-chain.test.ts && pnpm audit --audit-level low` | ✅ | ⬜ pending |
| 16-12-04 | 12 | 12 | TOOL-06 | T-16-12-01 | Full verify chain green on the final toolchain | full chain | `pnpm exec vitest run scripts/runbook.test.ts && pnpm smoke:local`; `pnpm verify` | ✅ | ⬜ pending |
| 16-12-05 | 12 | 12 | TOOL-06 | T-16-12-04 | Live smoke; Dependabot PRs 9 and 10 superseded | live (checkpoint) | `gh run list --workflow live-smoke.yml --limit 1 --json conclusion,headSha` | n/a | ⬜ pending |
| 16-13-01 | 13 | 13 | TOOL-04 | T-16-13-01, T-16-13-02 | Evidence step 1 at one head: three consecutive clean verify runs | protocol runs | `pnpm install --frozen-lockfile && pnpm audit:deps` (then three `pnpm verify` runs, logged) | ✅ | ⬜ pending |
| 16-13-02 | 13 | 13 | TOOL-04 | T-16-13-01, T-16-13-02 | Evidence steps 2 and 4 at the same head: repeat-each 3, serial lane x3, shuffled seed, groupOrder re-verified | protocol runs | `pnpm vitest run --project "*-serial"` | ✅ | ⬜ pending |
| 16-13-03 | 13 | 13 | TOOL-04 | T-16-13-01 | Evidence steps 3 and 5: CPU-pressure E2E and CI observation | protocol runs | `gh run view <ci id> --json conclusion,headSha` | ✅ | ⬜ pending |
| 16-13-04 | 13 | 13 | TOOL-04 / TOOL-06 | T-16-13-03 | Evidence file and launch audit committed; pinned by existing tests | unit | `pnpm exec vitest run scripts/test-evidence.test.ts scripts/launch-audit.test.ts scripts/runbook.test.ts && pnpm lint` | ✅ | ⬜ pending |
| 16-13-05 | 13 | 13 | TOOL-06 | T-16-13-04, T-16-13-05 | Final deploy live-smoke green; TOOL-01..06 ticked with run links | live (checkpoint) | `gh run list --workflow live-smoke.yml --limit 1 --json conclusion,headSha` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/lib/pnpm-cmd.mjs` + `scripts/pnpm-cmd.test.ts` — both `npm_execpath` forms; fails if another script re-inlines the old pair
- [ ] `scripts/kit3-migration.test.ts` — zero-grep gates with an allowlist for planted fixtures
- [ ] `scripts/vitest5-migration.test.ts` — scoped bare-`render` assertion; `.vitest/` ignored
- [ ] ESLint `\#` non-vacuity case in `scripts/eslint-rules.test.ts`
- [ ] Planted-case rows for the regex-over-source boundary tests
- [ ] Smoke 429 relabel test (extend the existing smoke script tests)

Each test file is created inside the plan that needs it, before the change it guards: smoke 429 test (16-01-01), pnpm-cmd.test.ts (16-04-01), app-paths stub test (16-06-03), kit3-migration.test.ts (16-07-03), vitest5-migration.test.ts (16-11-01).

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s (per-task quick runs; gate-level commands such as `pnpm verify` and `pnpm smoke:local` are exempt, see Sampling Rate)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
