# Phase 15: Load-Deterministic Test Lanes - Research

**Researched:** 2026-11-06
**Domain:** Test infrastructure: Vitest 4.1.12 projects/lanes, Playwright 1.63 flake policy, worker caps, static guard tests, evidence protocol
**Confidence:** HIGH (every Vitest/Playwright behaviour below was read from the installed `node_modules` source or reproduced in a throwaway experiment on this machine; durations were measured today)

<user_constraints>
## User Constraints

No `15-CONTEXT.md` exists (no `/gsd:discuss-phase` was run). The binding constraints come from ROADMAP, REQUIREMENTS, CLAUDE.md and `tasks/lessons.md`:

### Locked (from ROADMAP Phase 15 success criteria and REQUIREMENTS TEST-01..06)
- `pnpm test:unit` runs the parallel lane, then the `*-serial` Vitest projects with file parallelism off, as a separate stage. **`ci.yml`'s single `run: pnpm test:unit` line stays unchanged.**
- The serial lane holds: ReDoS scans, property-test timing, studio boundaries, precommit hook duration, the load-sensitive ResultsView browser test.
- A guard test fails when a timing assertion or raised timeout appears outside the serial lane, or when a serial include does not exist.
- Every raised timeout that remains carries a measured number and a root-cause comment. **No retries are added anywhere.**
- Playwright in CI runs with `--fail-on-flaky-tests`; the retry policy is documented in the config.
- Vitest `maxWorkers` and Playwright `workers` are capped, with known-good values recorded for the dev machine and CI.
- The Windows PATH/taskkill teardown guard from Phase 1 is covered by a test.
- `docs/test-evidence/<date>.md` records: 3 consecutive clean full `pnpm verify` runs; `--repeat-each 3` green on every spec a deferred-items file names as load-sensitive; one full E2E run under artificial CPU pressure with 0 failures; one green unit run with shuffled file and test order, with its seed.
- The lanes are defined on **Vitest 4** (Phase 16 migrates to Vitest 5 afterwards). Phase 15 must finish before Phase 16.

### Project rules that bind this phase (CLAUDE.md, lessons.md, MEMORY.md)
- pnpm workspace, `vitest` pinned 4.1.12, TypeScript `~6.0.3`, Node 24, Windows 11 dev machine + `ubuntu-24.04` CI.
- Commit messages never mention AI assistants. No `Co-Authored-By` model trailers.
- No real RentCast data, synthetic fixtures only. Never write `NAME_KEY=value` shapes in docs (the gitleaks hook catches them).
- In Git Bash use `MSYS_NO_PATHCONV=1 corepack.cmd pnpm ...`. Write multi-line files with Write/Edit, not heredocs.
- **Cap every Bash call at 7 minutes (`timeout 420000`).** Long runs (a full `pnpm verify` takes about 35 minutes) go to background jobs with log files and are polled.
- "Isolation is not proof of a flake": reproduce under artificial load before classifying anything as load-sensitive.
- Run `pnpm audit` first in any close-out, before the long chain (advisories move under unchanged pins).

### Claude's Discretion (no CONTEXT.md, so these are research recommendations)
- Where the lane manifest lives, the guard's detection technique, the annotation format, the CPU-pressure tool, the exact worker numbers, and whether TEST-02's annotation rule also covers Playwright specs (recommended: yes, see Open Question 1).

### Deferred Ideas (OUT OF SCOPE)
- Vitest 5 / Kit 3 / pnpm 12 (Phase 16). Extension release (Phase 17).
- **Carried from Phase 14 D-10, not in TEST-01..06:** live-smoke HTTP 429 hardening (`scripts/smoke.mjs` exit-2 path). See Open Question 3.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-01 | Wall-clock-budget tests live in `*-serial` Vitest projects with file parallelism off, run as a separate stage; the parallel lane has zero elapsed-time assertions; a guard test enforces it | Pattern 1 (file-based serial projects + `sequence.groupOrder: 1` + `fileParallelism: false`, verified to run strictly after the parallel group); Inventory A (exact files); Pattern 3 (AST guard); Pitfalls 1-4 |
| TEST-02 | Any raised test/expect timeout above the default carries a measured number and a root-cause comment, enforced by the same guard; no blind retries | Resolved defaults table (5 s node / 15 s browser / 1 s poll+waitFor / Playwright 30 s + 5 s); Inventory A+B; Pattern 4 (annotation format and constant-hoisting); retry inventory (Inventory C) |
| TEST-03 | Playwright in CI runs with `--fail-on-flaky-tests`; retry policy documented in config | Verified flag and `failOnFlakyTests` config in playwright 1.63.0; Pattern 5; ci.yml line and `workflow-gate.test.ts` pins |
| TEST-04 | Vitest `maxWorkers` and Playwright `workers` capped with known-good values; Windows PATH/taskkill guard covered by a test | Measured CPU counts (dev 16, CI 4 vCPU), CI log "using 2 workers", Vitest group-maxWorkers rule, browser pool ignoring root `maxWorkers`; Pattern 2 (MAX_WORKERS), Pattern 6 (`scripts/lib/windows-path.mjs` replacing 5 copies) |
| TEST-05 | Evidence: 3 consecutive clean `pnpm verify`, `--repeat-each 3` on every deferred-items load-sensitive spec, one full E2E under CPU pressure with 0 failures, in `docs/test-evidence/<date>.md` | Inventory D (complete load-sensitive spec list from all 9 deferred-items files); Pattern 7 (`scripts/cpu-burn.mjs`); evidence protocol with exact commands |
| TEST-06 | One green shuffled unit run with recorded seed stored in the evidence file | Verified `--sequence.shuffle.files --sequence.shuffle.tests --sequence.seed=N`, the printed line `Running tests with seed "N"`, and that shuffle keeps the serial stage last for file-based projects |
</phase_requirements>

## Summary

The repo has six Vitest projects in one root `vitest.config.ts` (`web`, `core`, `brand`, `scripts`, `web-browser (chromium)`, `extension`), no `maxWorkers` anywhere, and one blanket raise: `scripts/vitest.config.ts` sets `testTimeout: 60_000` with no comment. It has been there since Phase 1 (commit 1b7be52). A full parallel `vitest run` measured today (16-CPU dev box, default 15 workers, 75 s, 6,998 passed) shows that raise is load-bearing. `scripts/eslint-rules.test.ts` takes 13.5 s, `origin-parity` 7.2 s and `precommit` 7.0 s, all above the 5 s default. So "remove the raise" is not an option: those files have to move to a serial lane that keeps an annotated raise.

Vitest 4.1.12 already has the right mechanism, verified in source and by experiment. A project with `sequence.groupOrder: 1` and `fileParallelism: false` runs in its own group **after** every group-0 project finishes, one file at a time, inside a single `vitest run`. So `"test:unit": "vitest run"` and the `ci.yml` line do not change. Two traps came out of the experiments:
1. In **inline** project definitions, any CLI `--sequence.*` flag (the TEST-06 shuffle run) silently drops `groupOrder`. File-based project configs keep it.
2. The `VITEST_MAX_WORKERS` env var overrides `fileParallelism: false`, and serial files then run concurrently.

So serial projects must be separate `vitest.serial.config.ts` files, and the root config must fail closed when `VITEST_MAX_WORKERS` is set.

On the Playwright side, `apps/web/playwright.config.ts` sets no `workers`. CI gets 2 (50% of 4 vCPU, confirmed in run 42289609809's log) and the dev box gets 8, a count that has produced 30 s timeouts before. The known-good dev value is 4 (14-07, 14-11). Retries are `CI ? 1 : 0` and there is no flaky gate. `--fail-on-flaky-tests` and the `failOnFlakyTests` config both exist in playwright 1.63.0. The Windows PATH guard is copy-pasted into five config files (3 Playwright, 2 Vitest browser) and has no test.

**Primary recommendation:** Add one lane manifest (`tooling/vitest/lanes.ts`: serial file lists with reasons, `MAX_WORKERS`, `SERIAL_GROUP_ORDER`). Add four file-based `*-serial` configs (`core-serial`, `web-serial`, `web-browser-serial`, `scripts-serial`) that spread their base config. Enforce everything with one TypeScript-AST guard test in the `scripts` project (`scripts/lib/test-lane-rules.mjs` + `scripts/test-lanes.test.ts`), following the repo's existing rules-module-plus-planted-violations pattern. Extract the PATH guard into `scripts/lib/windows-path.mjs` with a unit test. Run the evidence protocol last, with a committed `scripts/cpu-burn.mjs`.

## Current State Inventory (the domain of this phase)

### Installed versions (verified from `package.json` + `node_modules`)
| Package | Version | Where |
|---|---|---|
| vitest | 4.1.12 | root, apps/web, apps/extension |
| @vitest/browser-playwright | 4.1.12 | apps/web, apps/extension |
| vitest-browser-svelte | 2.2.1 | apps/web, apps/extension |
| @playwright/test / playwright | 1.63.0 | apps/web, apps/extension |
| typescript | ~6.0.3 | root (AST guard uses `import ts from 'typescript'`; precedent: `apps/web/src/lib/ai/import-graph.ts:8`) |
| Node | v24.18.0 local, `.nvmrc` = 24 | |

### Vitest projects as resolved by `createVitest()` today (run 2026-11-06)
| Project | Config file | include | testTimeout | hookTimeout | pool | maxWorkers |
|---|---|---|---|---|---|---|
| web | `apps/web/vite.config.ts` | `src/**/*.{test,spec}.ts` (excl. `*.browser.test.ts`) | 5000 | 10000 | forks | unset → 15 dev / 3 CI |
| core | `packages/core/vitest.config.ts` | `src/**/*.test.ts` | 5000 | 10000 | forks | unset |
| brand | `packages/brand/vitest.config.ts` | `src/**/*.test.ts` | 5000 | 10000 | forks | unset |
| scripts | `scripts/vitest.config.ts` | `**/*.test.ts` | **60000 (raised, no comment, since 1b7be52)** | 10000 | forks | unset |
| extension | `apps/extension/vitest.config.ts` | `tests/**/*.test.ts` (excl. `tests/browser/**`, `e2e/**`) | 5000 | 10000 | forks | unset |
| web-browser (chromium) | `apps/web/vitest.browser.config.ts` | `src/**/*.browser.test.ts` | **15000** (browser default) | **30000** | browser | browser pool: `min(12, cpus-1)` |
| (not in root) extension-browser | `apps/extension/vitest.browser.config.ts` | `tests/browser/**/*.browser.test.ts` | 15000 | 30000 | browser | run by `pnpm ext:test:browser` |

Defaults, verified in `vitest/dist/chunks/coverage.DM_a_rWm.js:538-539` and `test.DNmyFkvJ.js:3361,3409`:
- `testTimeout` 5000 (node), 15000 (browser).
- `hookTimeout` 10000 / 30000.
- `expect.poll`, `expect.element` and `vi.waitFor`: timeout 1000, interval 50.
- `retry` 0.
- When `maxWorkers` is unset: `availableParallelism - 1` (`cli-api…js:3832-3838`).

Playwright defaults: test 30000 ms, expect 5000 ms. `test.slow()` triples the test timeout.

### Scripts (exact strings today)
- `"test:unit": "vitest run"`
- `"test:e2e": "pnpm --filter web exec playwright test"`
- `"verify": "pnpm check && pnpm lint && pnpm banned && pnpm ui:guard && pnpm test:unit && pnpm build:root && pnpm build:sub && pnpm build:configured && pnpm csp:assert && pnpm seo:assert && pnpm budget:assert && pnpm test:e2e && pnpm smoke:local && pnpm audit:deps && pnpm guard && pnpm fixtures:check && pnpm secrets:canary && pnpm secrets:scan && pnpm lint:workflows && pnpm ext:build && pnpm ext:assert && pnpm ext:test:browser && pnpm ext:e2e"`
- apps/extension: `"test:browser": "vitest run --config vitest.browser.config.ts"`, `"e2e": "playwright test"`
- Pre-commit hook: `node scripts/gitleaks.mjs staged && node scripts/guard-real-data.mjs --staged`

### CI (`.github/workflows/ci.yml`, job `quality`, `ubuntu-24.04`, matrix root/sub/configured)
- Line 91: `      - run: pnpm test:unit` (**must not change**; `scripts/workflow-gate.test.ts:249` pins `run: pnpm test:unit` and its order after check/lint).
- Line 132: `        run: pnpm --filter web exec playwright test --project=${{ matrix.target }}`. `workflow-gate.test.ts:184` pins the substring `playwright test --project=${{ matrix.target }}`, so appending ` --fail-on-flaky-tests` keeps it green.
- Root leg also runs `pnpm ext:test:browser && pnpm ext:e2e`.
- `extension-release.yml:36`: `run: pnpm vitest run --project extension`. Pinned by `scripts/extension-release-gate.test.ts:107`. Unaffected, since `--project extension` is an anchored exact match.
- `workflow-gate.test.ts` pins exactly 7 `uses:` lines. Add no actions.
- **Observed CI values (run 42289609809, 449ecc5):** Vitest `359 passed`, Duration 93.7 s (sub), 94.8 s (configured), 108.2 s (root). Playwright `Running 1157 tests using 2 workers` (root, 18.8 m), `1153 … 2 workers` (sub, 16.8 m), `44 … 2 workers` (configured). Extension E2E `7 tests using 1 worker`. Runner spec: public-repo standard Linux runner = **4 CPU / 16 GB** (GitHub docs).

### Playwright configs
| Config | workers | retries | failOnFlakyTests | timeout | notes |
|---|---|---|---|---|---|
| `apps/web/playwright.config.ts` | **unset** (CI 2, dev 8) | `process.env.CI ? 1 : 0` | unset | unset (30 s) | `forbidOnly: !!CI`, reporter CI `[['github'],['list']]`, `reducedMotion: 'reduce'`, single webServer `serve-pages.mjs` (timeout 30_000), projects root/sub/configured |
| `apps/web/playwright.smoke.config.ts` | `process.env.CI ? 2 : 4` | 0 | **true** | `globalTimeout: 300_000` | already the target shape; `runbook.test.ts` regex-pins `workers: process.env.CI ? \d+ : \d+` |
| `apps/extension/playwright.config.ts` | 1 | `process.env.CI ? 1 : 0` | unset | **60_000 (raise, has no measured number)** | |

### Dev machine
`os.availableParallelism()` = 16 (Intel Core Ultra 9 285H, 31 GB), Windows 11. RUNBOOK already records "16 logical CPUs; CI 4 vCPUs", and `docs/RUNBOOK.md:122-123` records "no worker pin" for Vitest and `--workers=4` for dev E2E. **Those rows and `scripts/runbook.test.ts:180-200` must be updated together.**

### Windows PATH/taskkill guard (Phase 1): 5 identical inline copies, 0 tests
`apps/web/playwright.config.ts:9-15`, `apps/web/playwright.smoke.config.ts:7-13`, `apps/extension/playwright.config.ts:12-18`, `apps/web/vitest.browser.config.ts:14-20`, `apps/extension/vitest.browser.config.ts:13-19`. Each one does this: on win32, compute `${SystemRoot ?? 'C:\\Windows'}\\System32`, split `PATH` on `;`, and prepend System32 if no entry matches case-insensitively. It exists because Playwright stops processes on Windows with `taskkill /pid <pid> /T /F` through cmd.exe, which fails silently without System32 on PATH and hangs teardown.

### Inventory A: Vitest timing assertions and raised timeouts (complete; AST-equivalent grep over 362 Vitest files)
"Raised" means above the API default for that project. Lowered timeouts, such as `scheduler.test.ts:291 { timeout: 2_000 }`, are fine anywhere.

| File | Line | Snippet | Class | Measured number + root cause today? | Disposition |
|---|---|---|---|---|---|
| packages/core/src/fair-housing/mutation.test.ts | 83-111 | `performance.now()` fastest-of-5, `< 50` / `< 500` ms | timing (ReDoS) | Yes (153 ms under 40 burners, 10-23) | → core-serial (whole file; launch-audit `pitfalls-evidence.mjs:161` matches this exact path, so **do not split or rename**) |
| packages/core/src/numbers/numbers.property.test.ts | 52-74 | fastest-of-5 `< 250` ms | timing (property/ReDoS) | Yes | → core-serial |
| packages/core/src/leads/parse-freeform.test.ts | 125-128 | `performance.now() - started < 1000` | timing (ReDoS) | No | → core-serial |
| packages/core/src/numbers/number-words.test.ts | 106-108 | `Date.now() - t0 < 2000` | timing (ReDoS) | No | → core-serial |
| apps/web/src/lib/storage/agent/import-commit.test.ts | 227-233 | `Date.now() - started < 10_000`, `}, 30_000)` | timing + raise | No | → web-serial |
| apps/web/src/lib/features/studio/boundaries.test.ts | 65-67 | `GRAPH_WALK_MS = 30_000` describe timeout | raise | Yes (1.9 s / 2.5 s, 10-23) | → web-serial |
| apps/web/src/lib/seo/og-card.server.test.ts | 100 | `describe(..., { timeout: 30_000 })` | raise | Cause only ("loaded CI runner"), no number | → web-serial |
| apps/web/src/lib/features/renter/search/ResultsView.browser.test.ts | 17, 22, 75, 116 | `LAZY_MAP_MS = 10_000` poll, `TEST_MS = 20_000` describe | raise | Has numbers, but **the comment is factually wrong**: it says "Vitest's 5 s default"; the resolved browser default is 15 s. Today's full-load max is 3.3 s | → web-browser-serial; rewrite the comment (or drop `TEST_MS`, since 15 s default ≥ 4.5× measured) |
| apps/web/src/lib/features/renter/outreach/OutreachSection.browser.test.ts | 64-66 | `vi.waitFor(..., { timeout: 20_000 })` | raise (waitFor default 1 s) | No | → web-browser-serial (file 15 s; tests 4.4-5.5 s under load) |
| apps/web/src/lib/features/shared/data/GatewayError.browser.test.ts | 224 | `expect.element(ready, { timeout: 4000 })` | raise (functional: real 2 s countdown) | No | → web-browser-serial (or rewrite with fake timers; moving is the zero-code-change path) |
| apps/web/src/lib/components/tools/calculators.browser.test.ts | 31 | `expect.poll(..., { timeout: 2000 })` | raise (debounced announcement) | No | → web-browser-serial |
| scripts/vitest.config.ts | 9 | `testTimeout: 60_000` | **config-level raise** | **No comment at all** | Remove from the parallel `scripts` project; `scripts-serial` carries an annotated raise |
| scripts/precommit.test.ts | whole | spawns real `git commit` + gitleaks; relies on 60 s | raise (inherited) | Partly (56 s worst case, 10-23) | → scripts-serial |
| scripts/eslint-rules.test.ts | whole | ESLint `lintText`: **13.5 s under full load**, 6.7 s alone | raise (inherited), 271% of 5 s | No | → scripts-serial |
| scripts/origin-parity.test.ts | whole | 7.2 s under load (144%) | raise (inherited) | No | → scripts-serial |
| scripts/site-url.test.ts | whole | 4.3 s under load (86%) | margin < 2× | No | → scripts-serial |
| scripts/gen-fixtures.test.ts | whole | 3.7 s under load (74%) | margin < 2× | No | → scripts-serial |
| scripts/commit-hygiene.test.ts | whole | 2.6 s under load (51%) | margin ≈ 2× | No | → scripts-serial |

The detection rules (Pattern 3) find exactly 5 elapsed-time files (`performance.now`, `process.hrtime`, `Date.now() -`) and no false positives. `Date.now()` used only as a value (`FairRentCheck.browser.test.ts:16`, `ProvenanceRow.browser.test.ts:68`) is not elapsed time.

**Lane-safety threshold (recommended, record it in the manifest header):** a test belongs in the parallel lane only if its max duration in a full parallel `vitest run` is ≤ 50% of that lane's default timeout. Data source: `vitest run --reporter=json`. In today's run, the rest of the scripts files are at ≤ 36% (assert-csp 1.8 s, banned-terms 1.6 s, agent-boundary 1.6 s). Every browser test is ≤ 36% of 15 s.

### Inventory B: Playwright raised timeouts (TEST-02 annotation scope; see Open Question 1)
About 82 timeout sites in `apps/web/tests/e2e/**`, `apps/web/tests/smoke/**` and `apps/extension/e2e/**`. About 70 are raises above default (test > 30 s, expect > 5 s), plus **15 `test.slow()` calls in 8 files** (agent-share-link, investor/deals, snapshot-builder, snapshot-print, studio-listing, studio-reel, studio-shell, studio-social). Only about 21 have a nearby comment with a number. The heaviest clusters are `studio-keyless.spec.ts` (6× `test.setTimeout(240_000)` + 300_000), `studio-social`, `studio-reel`, `studio-listing`, `investor/demo`, `investor/print`, `investor/sweep` (`describe.configure({ mode: 'serial', timeout: 300_000 })` ×2), plus 13 `describe.configure({ timeout: 120_000 })` files. Config-level: extension `timeout: 60_000`.

**The measured numbers already exist.** `apps/web/test-results/e2e-report.json` (14-11 launch audit at 449ecc5, 2026-11-06, 4 workers, retries 0, 2,354 results) has every test's duration. Slowest: `studio-social.spec.ts:260` 48.6 s, `investor/sweep.spec.ts:378` 31.9 s, `third-party.spec.ts:37` 28.0 s, `studio-reel.spec.ts:148` 27.4 s. 16 tests take more than 15 s and 4 take more than 30 s. CI durations at 2 workers come from the CI logs.

### Inventory C: retry constructs (TEST-02 "no retries added")
- Vitest: no `retry` in any config or test option (resolved `retry` undefined = 0).
- Playwright: `retries: process.env.CI ? 1 : 0` in web and extension configs; `retries: 0` in smoke. No `describe.configure({ retries })`. No `--retries` / `--retry` in any `package.json`, workflow or script.
- **Retrying assertions:** `expect(async () => …).toPass()` at `investor/buybox.spec.ts:97` and `investor/demo.spec.ts:107`. These are pre-existing and justified in a comment (the disclosure may auto-open). The guard should allowlist exactly these two and forbid new ones.
- `expect.poll` / `vi.waitFor` are polling waits, not test retries. They stay allowed.

### Inventory D: specs that deferred-items files name as load-sensitive (all 9 files scanned)
| Spec | Named in | Status |
|---|---|---|
| `tests/e2e/app-notice.spec.ts` | 03 deferred-items | resolved 72b6875 (reducedMotion) |
| `tests/e2e/settings-backup.spec.ts` | 03 | resolved 72b6875 |
| `tests/e2e/settings-keys.spec.ts` | 04 (04-25) | resolved 72b6875 |
| `tests/e2e/investor/autofill.spec.ts` | 07, 10 | fixed 07-21; not reproduced in 10-23 |
| `tests/e2e/investor/buybox.spec.ts` | 07, 10 | fixed 477beae; not reproduced in 10-23 |
| `tests/e2e/agent-inquire.spec.ts` | 08 (single-core machine, clock), 10 (dup meta: deterministic, fixed) | include: CPU-sensitive by its own description |
| `tests/e2e/csp.spec.ts` | 10 | not reproduced |
| `tests/e2e/renter-saved.spec.ts` | 10, 14-07 | fixed f1313d5 (60/60 under pressure) |
| `tests/e2e/guide.spec.ts` | 10 | real race, fixed (lessons.md) |
| `tests/e2e/agent-contact.spec.ts` | 10 | CPU starvation only (40 burners) |
| `tests/e2e/agent-followup.spec.ts` | 10 | CPU starvation only |
| `tests/e2e/renter-journey.spec.ts` | 10 (10-23) | fixed 616c052 |
| `src/lib/features/renter/search/ResultsView.browser.test.ts` (Vitest) | 10 | fixed 5fd93cc |
| `scripts/precommit.test.ts` (Vitest) | 10, 12 | fixed e3a9e2a |
| ReDoS `mutation.test.ts`, `numbers.property.test.ts`, `studio/boundaries.test.ts` (Vitest) | 10 (10-23 section) | fixed ff20762 / 1ad1efd |

Paths are relative to `apps/web/` unless shown otherwise. All 12 E2E files exist (verified). Phases 05, 06 and 11 deferred-items name nothing load-related.

## Standard Stack

No new dependencies. Everything below is already installed.

### Core
| Library | Version | Purpose | Why |
|---|---|---|---|
| vitest | 4.1.12 | `projects`, `sequence.groupOrder`, `fileParallelism`, `maxWorkers`, `sequence.shuffle`/`seed` | All lane features verified in the installed source; the lanes must be defined on Vitest 4 before Phase 16 |
| @playwright/test | 1.63.0 | `failOnFlakyTests` / `--fail-on-flaky-tests`, `--repeat-each`, `workers` | Verified in `playwright/lib/program.js:194,212,227` and `runner/index.js:6290` |
| typescript | ~6.0.3 | `ts.createSourceFile` for the AST guard | Accurate call/option/comment detection; no type-check cost; repo precedent |
| node:worker_threads / node:os | Node 24 | `scripts/cpu-burn.mjs` | Cross-platform CPU pressure with no install (stress-ng is Linux-only) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| `groupOrder` inside one `vitest run` | `"test:unit": "vitest run --project '!*-serial' && vitest run --project '*-serial'"` | pnpm runs scripts through cmd.exe on Windows, where single quotes are passed through literally, so the filter matches nothing. Two Vitest startups. Rejected. |
| AST guard (TS compiler API) | ESLint `no-restricted-syntax` blocks with `ignores: SERIAL` | Cannot check "comment carries a measured number + cause". The requirement says "a guard test". Rejected. |
| AST guard | Pure regex | Misses `{ timeout: TEST_MS }` indirection and multi-line options; false positives on product `.retry()` APIs (`out.retry()` in autofill/market-load tests). Rejected. |
| `scripts/cpu-burn.mjs` | Concurrent `pnpm test:unit` loop (Phase 14 D-16 shape) | The D-16 loop is bursty (146 s iterations with gaps) and hard to quantify. The burner gives constant, recorded load. D-16 remains a valid supplementary check. |
| Moving whole files to serial | Splitting timing tests into new `*.timing.test.ts` files | Splitting breaks launch-audit evidence (`pitfalls-evidence.mjs:161` matches `packages/core/src/fair-housing/mutation.test.ts`) and blame. Whole-file moves change only config. |

**Installation:** none.

## Architecture Patterns

### Recommended file layout
```
tooling/vitest/
├── no-network.ts            # existing
└── lanes.ts                 # NEW: SERIAL manifest {file, reason}, MAX_WORKERS, SERIAL_GROUP_ORDER, serialTest()
packages/core/vitest.serial.config.ts      # NEW: core-serial
apps/web/vitest.serial.config.ts           # NEW: web-serial (spreads vite.config.ts)
apps/web/vitest.browser.serial.config.ts   # NEW: web-browser-serial (spreads vitest.browser.config.ts)
scripts/vitest.serial.config.ts            # NEW: scripts-serial (keeps annotated testTimeout)
scripts/lib/windows-path.mjs               # NEW: ensureSystem32OnPath() replacing 5 inline copies
scripts/lib/test-lane-rules.mjs            # NEW: pure AST rules (timing, raise, annotation, retry)
scripts/test-lanes.test.ts                 # NEW: guard over git ls-files + planted violations
scripts/windows-path.test.ts               # NEW: TEST-04 PATH guard unit test (+ win32-only taskkill probe)
scripts/cpu-burn.mjs                       # NEW: CPU pressure tool for the evidence protocol
docs/test-evidence/2026-11-DD.md           # NEW: the dated evidence file
```
Config file names must match `/^vite(?:st)?(?:\.[\w-]+)?\.config\./` (`cli-api…js:11146`). `vitest.serial.config.ts` and `vitest.browser.serial.config.ts` match. A name like `serial.config.ts` is rejected at startup (reproduced).

### Pattern 1: Serial lane = file-based projects with `groupOrder: 1` + `fileParallelism: false`
**What:** Each serial project is its own config file. It spreads the base config object (spread replaces arrays; Vite `mergeConfig`/`extends` concatenates `include`) and overrides name, include and exclude, and sets `fileParallelism: false` and `sequence: { groupOrder: 1 }`. The parallel sibling excludes the same files. The root `projects` array lists the new files.
**Verified behaviour (experiment, 4 parallel files + 3 serial files, Vitest 4.1.12):**
- With `groupOrder: 1` + `fileParallelism: false`, all 4 parallel files run concurrently. The serial files start only after the last parallel file ends, and run strictly one at a time.
- `groupSpecs()` (`cli-api…js:3849-3910`) builds one task group per `groupOrder`. `executeTests` awaits each group fully before the next (`:3762-3779`). A project with `maxWorkers === 1` and default order 0 also goes into a trailing "sequential" group, but set `groupOrder` explicitly so the intent is visible and guardable.
- **File-based** serial projects keep `groupOrder` under `--sequence.shuffle.files --sequence.shuffle.tests --sequence.seed=7`. **Inline** projects lose it: CLI `sequence` is shallow-spread over the inline `test` object (`cli-api…js:11195-11198`), so in the experiment the serial files ran mixed into the parallel group.
- `RandomSequencer.sort` shuffles all files, but `groupSpecs` still buckets by `groupOrder`, so shuffling never moves serial files into the parallel stage (verified).
- Within group 1, node serial files run one at a time across all serial projects (the pool is set to 1). The browser-serial files run one tab at a time, concurrently with at most one node file.

```ts
// tooling/vitest/lanes.ts (shape; planner fills exact entries from Inventory A)
import { configDefaults } from 'vitest/config';

export type SerialEntry = { file: string; reason: string };
// Paths are relative to each project root. Literal files, never globs, so the guard can prove each exists.
export const SERIAL = {
	core: [
		{ file: 'src/fair-housing/mutation.test.ts', reason: 'timing: ReDoS budgets' },
		{ file: 'src/numbers/numbers.property.test.ts', reason: 'timing: property-test ReDoS budget' },
		{ file: 'src/leads/parse-freeform.test.ts', reason: 'timing: 100k-char paste budget' },
		{ file: 'src/numbers/number-words.test.ts', reason: 'timing: adversarial-input budget' }
	],
	web: [/* boundaries, import-commit, og-card.server */],
	'web-browser': [/* ResultsView, OutreachSection, GatewayError, calculators */],
	scripts: [/* precommit, eslint-rules, origin-parity, site-url, gen-fixtures, commit-hygiene */]
} as const satisfies Record<string, readonly SerialEntry[]>;

export const SERIAL_GROUP_ORDER = 1;
export const files = (lane: keyof typeof SERIAL) => SERIAL[lane].map((e) => e.file);

/** The `test` overrides every *-serial project shares. */
export function serialTest(lane: keyof typeof SERIAL) {
	return {
		name: `${lane}-serial`,
		include: files(lane),
		exclude: [...configDefaults.exclude],
		fileParallelism: false,
		sequence: { groupOrder: SERIAL_GROUP_ORDER }
	};
}
```
```ts
// packages/core/vitest.serial.config.ts
import { defineConfig } from 'vitest/config';
import base from './vitest.config';
import { serialTest } from '../../tooling/vitest/lanes';

export default defineConfig({ ...base, test: { ...base.test, ...serialTest('core') } });
```
```ts
// packages/core/vitest.config.ts (parallel sibling): add the exclude
exclude: [...configDefaults.exclude, ...files('core')],
```
Root `vitest.config.ts` `projects` gains `'packages/core/vitest.serial.config.ts'`, `'apps/web/vitest.serial.config.ts'`, `'apps/web/vitest.browser.serial.config.ts'`, `'scripts/vitest.serial.config.ts'`. `"test:unit": "vitest run"` is unchanged.

### Pattern 2: One worker cap, set where Vitest actually reads it
**Verified rules:**
- Group-0 projects must share one `maxWorkers`, or Vitest throws `Projects "a" and "b" have different 'maxWorkers' but same 'sequence.groupOrder'` (`cli-api…js:3890-3893`).
- Node projects without their own value inherit the root `maxWorkers` (`resolveMaxWorkers`, `:3832-3834`). **The browser pool ignores the root value.** It uses the project's own `maxWorkers` or `min(12, cpus-1)` (`:2401-2405, 2479-2483`). So the cap must be set on the root config **and** in `apps/web/vitest.browser.config.ts`, from one constant.
- `maxWorkers` is not a CLI-to-project override. `--maxWorkers=N` on the CLI changes only the root value (verified: it capped the parallel group and the serial lane stayed serial).
- **`VITEST_MAX_WORKERS` env is applied after `fileParallelism: false` (`coverage…js:222-225` then `:380`) and breaks the serial lane** (verified: serial files ran concurrently).

```ts
// tooling/vitest/lanes.ts
// Known-good, measured: CI ubuntu-24.04 = 4 vCPU; Vitest's old default (cpus-1) = 3 gave 359 files green in
// 93.7-108.2 s (run 42289609809). Dev = 16 logical CPUs; 8 leaves headroom for E2E + Chromium beside it.
export const MAX_WORKERS = process.env.CI ? 3 : 8;
```
```ts
// vitest.config.ts (root)
import { defineConfig } from 'vitest/config';
import { MAX_WORKERS } from './tooling/vitest/lanes';
if (process.env.VITEST_MAX_WORKERS) {
	throw new Error('VITEST_MAX_WORKERS overrides fileParallelism:false and breaks the *-serial lane; unset it.');
}
export default defineConfig({ test: { maxWorkers: MAX_WORKERS, projects: [/* … */] } });
```
Dev value 8 is a recommendation (MEDIUM). Today the dev box ran green at 15 workers (75 s). The plan must measure wall time at 8 and record it. CI value 3 preserves exact current CI behaviour.

Playwright web: `workers: process.env.CI ? 2 : 4`. This is the same shape as `playwright.smoke.config.ts`. CI 2 equals today's default ("using 2 workers"). Dev 4 is the known-good count from 14-07 and 14-11 (8 gave six 30 s timeouts in 10-23). Extension keeps `workers: 1`.

### Pattern 3: AST guard test (TEST-01 + TEST-02 enforcement)
**What:** `scripts/lib/test-lane-rules.mjs` holds pure functions over `{ path, text }`. `scripts/test-lanes.test.ts`:
- (a) runs them over `git ls-files` (precedent: `scripts/site-url.test.ts:56-63`) and expects zero findings;
- (b) plants one violation of each rule into synthetic text and expects a finding (non-vacuity; precedent: `ui-class-guard.test.ts`, `fixtures-guard.test.ts`);
- (c) checks the manifest and configs.

**Rules (fail-closed):**
1. **Elapsed time outside serial:** in a Vitest test file whose lane is not serial, any `performance.now()`, `process.hrtime()` / `.bigint()`, or a `-` BinaryExpression with a `Date.now()` operand. (Today: exactly the 5 files above.)
2. **Raised timeout outside serial:** in a non-serial Vitest file, any of the following:
   - a `timeout` property in the options object of `test`/`it`/`describe` (including `.each`, `.only`, `.skip`, `.concurrent` chains), `vi.waitFor`, `vi.waitUntil`, `expect.poll` or `expect.element`, whose value is not a numeric literal ≤ that API's default;
   - a trailing numeric argument after a test or hook callback (`}, 30_000)`);
   - any `vi.setConfig({ testTimeout | hookTimeout })`.
   Non-literal values (identifiers, `ROUTES.length * 4_000`) count as raised. Lane defaults: node test 5000, browser test 15000, poll/waitFor 1000.
3. **Annotation on every remaining raise** (serial Vitest files, configs, and Playwright specs/configs if Open Question 1 is accepted): the contiguous comment block directly above the statement (or above the `const` declaration of an identifier used as the value) must match `/\bmeasured\b[^\n]*\d+(?:\.\d+)?\s*(?:ms|s|min)\b/i` **and** `/\bcause\b/i`. Playwright raises: `test.setTimeout(x > 30_000)`, `describe.configure({ timeout > 30_000 })`, `test.slow()`, expect/locator options `timeout > 5_000`, config `timeout`.
4. **No retries:** no `retry` key in Vitest test options or any Vitest config. No `describe.configure({ retries })`. Playwright config `retries` must be the exact expressions `process.env.CI ? 1 : 0` (web, extension) / `0` (smoke). No `--retry`/`--retries` in any `package.json` script, workflow `run:` or `scripts/*.mjs` spawn args. `.toPass(` only at the two allowlisted sites.
5. **Manifest integrity:**
   - every `SERIAL` file exists (`existsSync`; the "serial include does not exist" criterion);
   - every serial project config exists and is listed in root `projects`;
   - each serial config text contains `serialTest('<lane>')` and each parallel sibling's text references `files('<lane>')` in its exclude;
   - no file is listed in two lanes.
6. **CI line pinned:** `.github/workflows/ci.yml` contains exactly one `run: pnpm test:unit`, and the root `package.json` `test:unit` equals `vitest run`.

**Lane-of-file resolution:** map the path prefix to a project root (`packages/core/`, `apps/web/` + `.browser.test.ts`, `scripts/`, …), then check membership in `SERIAL`.

```js
// scripts/lib/test-lane-rules.mjs (core of rule 1; shape)
import ts from 'typescript';
export function elapsedTimeFindings(path, text) {
	const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const out = [];
	const isCall = (n, obj, prop) =>
		ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) &&
		n.expression.name.text === prop && n.expression.expression.getText(sf) === obj;
	const visit = (n) => {
		if (isCall(n, 'performance', 'now') || isCall(n, 'process', 'hrtime')) out.push(at(n));
		if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.MinusToken &&
			[n.left, n.right].some((s) => isCall(s, 'Date', 'now'))) out.push(at(n));
		ts.forEachChild(n, visit);
	};
	const at = (n) => ({ path, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, rule: 'elapsed-time' });
	visit(sf);
	return out;
}
```
Comments: use `ts.getLeadingCommentRanges(text, node.getFullStart())` on the enclosing statement.

### Pattern 4: Annotation format, with constants hoisted to cut repetition
```ts
// Timeout: measured 6.7 s alone and 13.5 s in a full parallel run (2026-11-06, 16 CPUs).
// Cause: each lintText loads the flat config and the TypeScript parser cold. 60 s keeps a 4x margin.
testTimeout: 60_000,
```
Several identical raises in one spec (for example `studio-keyless.spec.ts`'s six `test.setTimeout(240_000)`) become one file-level `const AI_FLOW_MS = 240_000` with one annotated comment. The guard resolves the identifier to its declaration. That turns about 70 E2E comments into far fewer.

### Pattern 5: Playwright flake policy (TEST-03)
```ts
// apps/web/playwright.config.ts
// Retry policy: CI retries once ONLY to classify a failure. With failOnFlakyTests a test that fails
// and then passes on the retry is reported "flaky" and still fails the job, so a retry can never turn
// red into green. Locally retries are 0. Never raise retries; root-cause the flake (lessons.md).
retries: process.env.CI ? 1 : 0,
failOnFlakyTests: !!process.env.CI,
workers: process.env.CI ? 2 : 4,
```
- Also put the literal flag in `ci.yml`: `run: pnpm --filter web exec playwright test --project=${{ matrix.target }} --fail-on-flaky-tests`. This satisfies the criterion's wording and shows in the CI log. CLI overrides config (`takeFirst(configCLIOverrides.failOnFlakyTests, userConfig.failOnFlakyTests, false)`, `playwright/lib/common/index.js:509`).
- Mirror `failOnFlakyTests: !!process.env.CI` plus the comment in `apps/extension/playwright.config.ts`, because `pnpm ext:e2e` runs in CI with retries 1.
- Exit status: `runner/index.js:6290` returns "failed" when `failOnFlakyTests && hasFlakyTests`.
- Extend `workflow-gate.test.ts` with a pin for the flag.

### Pattern 6: Windows PATH guard as a tested module (TEST-04)
```js
// scripts/lib/windows-path.mjs
/**
 * Playwright stops child processes on Windows with `taskkill /pid <pid> /T /F` through cmd.exe, using the
 * runner's PATH, and discards the output. Without %SystemRoot%\System32 on PATH that call fails silently
 * and teardown hangs for minutes. Prepend System32 when it is missing. Pure on (env, platform).
 * @returns {boolean} true when PATH was changed
 */
export function ensureSystem32OnPath(env = process.env, platform = process.platform) {
	if (platform !== 'win32') return false;
	const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
	const system32 = `${env.SystemRoot ?? 'C:\\Windows'}\\System32`;
	const norm = (p) => p.replace(/[\\/]+$/, '').toLowerCase();
	const entries = (env[key] ?? '').split(';');
	if (entries.some((e) => norm(e) === norm(system32))) return false;
	env[key] = [system32, ...entries.filter(Boolean)].join(';');
	return true;
}
```
All 5 configs replace their inline block with `ensureSystem32OnPath();`. Web `playwright.config.ts` already imports `../../scripts/lib/build-targets.mjs`, so the import style has precedent.

`scripts/windows-path.test.ts`:
- (a) missing → prepended;
- (b) present with other case or a trailing `\` → unchanged;
- (c) `SystemRoot` unset → `C:\Windows\System32`;
- (d) linux/darwin → untouched;
- (e) env key spelled `Path` (a plain object is case-sensitive, unlike Windows `process.env`);
- (f) source pin: each of the 5 config files imports and calls `ensureSystem32OnPath`, and the literal `System32` appears nowhere else in them;
- (g) `test.runIf(process.platform === 'win32')`: with PATH stripped to a directory that lacks System32, `spawnSync(process.env.ComSpec, ['/d', '/c', 'where taskkill'])` fails. After `ensureSystem32OnPath(env)`, it resolves. This proves the root cause on the dev machine. CI (Linux) runs (a)-(f).

### Pattern 7: Evidence protocol (TEST-05, TEST-06)
**Order:** run only after every code change is committed, the tree is clean and CI is green. Record the HEAD SHA. Run `pnpm audit:deps` first (lessons). Each long command runs as a background job writing `.tools/test-evidence/<step>.log` (`.tools/` is gitignored). Poll; never one Bash call over 7 minutes.

| Step | Command (Git Bash) | Record |
|---|---|---|
| 1. 3× verify | `MSYS_NO_PATHCONV=1 corepack.cmd pnpm verify` three times back to back. A failed run resets the count to 0 after root-causing, and the failure is recorded. | start/end UTC, exit code, `Test Files` line, each Playwright `N passed` line |
| 2. repeat-each (E2E) | `… pnpm --filter web exec playwright test app-notice.spec.ts settings-backup.spec.ts settings-keys.spec.ts investor/autofill.spec.ts investor/buybox.spec.ts agent-inquire.spec.ts csp.spec.ts renter-saved.spec.ts guide.spec.ts agent-contact.spec.ts agent-followup.spec.ts renter-journey.spec.ts --repeat-each 3 --project root --project sub --fail-on-flaky-tests` (split into chunks of about 5 minutes) | passed/failed/flaky per spec |
| 2b. repeat (Vitest-named) | `… pnpm vitest run --project "*-serial"` three consecutive times (Vitest 4 has no `--repeat-each`; verified in the cac option table) | 3 exit codes, file/test counts |
| 3. CPU pressure | background `node scripts/cpu-burn.mjs --threads 16 --stop-file .tools/test-evidence/stop --max-seconds 5400`, then `… pnpm test:e2e` (all three projects, capped 4 workers), then create the stop file | burner threads, `availableParallelism`, workers, wall time, `0 failed, 0 flaky` |
| 4. Shuffle | `SEED=$(date +%s); … pnpm test:unit --sequence.shuffle.files --sequence.shuffle.tests --sequence.seed=$SEED` | the seed from the command **and** the output line `Running tests with seed "<SEED>"` (`cli-api…js:1993`), totals |

Pressure level: 16 burner threads on 16 logical CPUs. 10-23 recorded 0 failures at "16 burners". At 40 burners plus llama-server, failures were pure 30 s starvation timeouts, which is not a fair zero-failure target. Burners run at normal priority (lowering priority makes them fake pressure).

```js
// scripts/cpu-burn.mjs (shape): constant CPU pressure, cross-platform, self-terminating.
import { Worker, isMainThread } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { existsSync } from 'node:fs';
// args: --threads N (default availableParallelism()), --stop-file PATH, --max-seconds S (hard stop, default 3600)
// main: spawn N workers running `for (;;) {}` style busy loops in 50 ms slices; poll stop file every 1 s;
// print "cpu-burn: N threads on M CPUs, started <iso>" and "cpu-burn: stopped <iso> after <s> s".
```
A `scripts/cpu-burn.test.ts` can cover argument parsing and the `--max-seconds 1` self-stop (in the serial lane, because it is a deliberate CPU hog with a wall-clock stop).

**Evidence file pin (recommended):** `scripts/test-evidence.test.ts` reads the newest `docs/test-evidence/*.md` and asserts:
- 3 verify rows with exit 0;
- a repeat-each row for every spec in a `LOAD_SENSITIVE_SPECS` constant (lanes.ts) with 0 failed and 0 flaky;
- a CPU-pressure row with `0 failed`;
- a seed that equals in the command and the `Running tests with seed` line.

This is the same pattern as `runbook.test.ts` / `deploy-checklist.test.ts`. The file must pass `prettier --check` (`pnpm lint` covers `.md`), `banned-terms`, and gitleaks (no `NAME_KEY=value` shapes).

### Anti-Patterns to Avoid
- **Inline serial projects in the root `projects` array.** CLI `--sequence.*` drops their `groupOrder` (reproduced).
- **`mergeConfig` / `extends` to derive serial configs.** Arrays concatenate, so `include` would become the union of both globs. Use object spread.
- **Globs in `SERIAL`.** The guard cannot prove "the include exists" for a glob that matches zero files without a glob engine. Use literal paths.
- **Combining `--project web --project "!*-serial"`.** Filters are OR-ed (`matchesProjectFilter` uses `.some`), so this selects everything except serial **plus** web.
- **Setting `exclude: [...files('core')]` without `configDefaults.exclude`.** It replaces Vitest's default exclude list.
- **"Fixing" a lane failure with a raised timeout or a retry.** That is exactly what the guard forbids. Root-cause it (lessons.md).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Ordering parallel then serial | A wrapper script running two `vitest run`s | `sequence.groupOrder` + `fileParallelism: false` | One process, one report, `ci.yml` unchanged, no shell quoting |
| Parsing tests for timeouts/comments | Regex scanners | `ts.createSourceFile` + `ts.getLeadingCommentRanges` | Indirect identifiers, multi-line options, chained `test.each`, comment association |
| Flaky detection | Parsing JSON reports for retried passes | `failOnFlakyTests` / `--fail-on-flaky-tests` | Built into the runner's exit status |
| Shuffle with a seed | Custom sequencer | `--sequence.shuffle.files --sequence.shuffle.tests --sequence.seed=N` | Built in; seed is printed |
| Repeating E2E specs | Bash loops | `--repeat-each 3` | Per-test repeat inside one run, with retries counted as flaky |
| Glob matching for "include exists" | picomatch dependency | Literal paths + `existsSync` | Simpler and stricter |

## Common Pitfalls

### Pitfall 1: Inline projects lose `groupOrder` under CLI `--sequence.*`
**What goes wrong:** the TEST-06 shuffle run interleaves serial files into the parallel stage. **Why:** `test: { ...options.test, ...cliOverrides }` shallow-replaces `sequence` for inline projects. **Avoid:** file-based serial configs only. The guard checks that root `projects` entries are strings ending in `.config.ts` or directory names. **Detect:** an ordering log shows serial files starting before the parallel ones finish.

### Pitfall 2: `VITEST_MAX_WORKERS` silently disables the serial lane
**Avoid:** the root config throws when it is set (Pattern 2). Document it in RUNBOOK.

### Pitfall 3: Browser project ignores root `maxWorkers`
**What goes wrong:** the cap "works" for node projects while Chromium still opens `min(12, cpus-1)` tabs. **Avoid:** set `maxWorkers: MAX_WORKERS` in `apps/web/vitest.browser.config.ts` too, with the same value, or Vitest throws the group mismatch error.

### Pitfall 4: Removing the scripts 60 s raise without moving its dependants
**What goes wrong:** `eslint-rules.test.ts` (13.5 s), `origin-parity` (7.2 s) and `precommit` (7.0 s) time out at 5 s under load. **Avoid:** move them to `scripts-serial` first. Then re-run the full suite with `--reporter=json` and re-check the ≤ 50% threshold for every remaining scripts file.

### Pitfall 5: ResultsView's comment is factually wrong
The comment says "Vitest's 5 s default". The browser-mode default is 15 s (verified by `createVitest`). The annotation rewrite must state the real default and today's measured 3.3 s, or drop `TEST_MS`.

### Pitfall 6: Second browser project and Vite dep optimisation
`optimizeDeps` re-optimisation mid-run has already caused `effect_orphan` (see `vitest.browser.config.ts` comment). Vitest keys `cacheDir` per project label (`VitestCache.resolveCacheDir(root, dir, label)`, `cli-api…js:10092`; separate hash dirs exist under `apps/web/node_modules/.vite/vitest/`), so the risk is low (MEDIUM). **Verify:** delete `apps/web/node_modules/.vite` and run `pnpm test:unit` twice; both must be green.

### Pitfall 7: Windows shell quoting
In `package.json` scripts (cmd.exe), `'*-serial'` keeps its quotes and matches no project. In Git Bash, use double quotes. Pattern 1 needs no globbed script at all.

### Pitfall 8: Docs and tests that pin today's strings
- `docs/RUNBOOK.md:122-123` ("no worker pin", "sets no `workers`") and `scripts/runbook.test.ts:180-200`.
- `scripts/workflow-gate.test.ts:184,249`.
- `docs/RUNBOOK.md` project list ("web, core, brand, scripts, web-browser, extension").
- The 13-18 launch-audit procedure ("unit shards covering every Vitest project") must now include the 4 serial projects. `--project scripts` is an anchored match and does **not** select `scripts-serial` (`wildcardPatternToRegExp`: `^scripts$`).

### Pitfall 9: The evidence run outlives the tool budget
A full `pnpm verify` is about 35 minutes (unit 1.3 m, builds about 1.3 m, E2E at 4 workers about 25 m, plus smoke, gitleaks history and extension). Run it in the background with logs. `audit:deps` can turn a run red on a new advisory under unchanged pins, so run it first and record it.

### Pitfall 10: Guard runtime itself
Parsing about 480 files with `createSourceFile` takes roughly 1-2 s. Measure it in the first green run. If it exceeds 2.5 s under full load (the 50% rule), put `scripts/test-lanes.test.ts` in `scripts-serial`.

## Code Examples

### Verified CLI forms (Vitest 4.1.12, Playwright 1.63.0)
```bash
# whole suite: parallel group 0, then the *-serial group 1 (no flags needed)
MSYS_NO_PATHCONV=1 corepack.cmd pnpm test:unit
# serial lane only / everything except it (double quotes in Git Bash)
MSYS_NO_PATHCONV=1 corepack.cmd pnpm vitest run --project "*-serial"
MSYS_NO_PATHCONV=1 corepack.cmd pnpm vitest run --project "!*-serial"
# shuffled files + tests with a recorded seed; output prints: Running tests with seed "<N>"
MSYS_NO_PATHCONV=1 corepack.cmd pnpm test:unit --sequence.shuffle.files --sequence.shuffle.tests --sequence.seed=1794021906
# Playwright: flaky gate, repeat, worker cap
pnpm --filter web exec playwright test csp.spec.ts --repeat-each 3 --project root --project sub --fail-on-flaky-tests --workers 4
```

### Measuring numbers for annotations
```bash
# unit: per-test durations under full parallel load
./node_modules/.bin/vitest run --reporter=dot --reporter=json --outputFile.json=.tools/test-evidence/unit.json
# E2E: durations already in apps/web/test-results/e2e-report.json (14-11 audit, 4 workers, 449ecc5)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `vitest.workspace` file | `test.projects` in root config | Vitest 3.2 (workspace deprecated) | Already on `projects` |
| Separate runs per lane | `sequence.groupOrder` | Vitest 3.2+ | One `vitest run` holds both lanes |
| `browser.fileParallelism` | top-level `fileParallelism` | Vitest 4 (`browser.fileParallelism` @deprecated in types) | Set top-level only |
| Raising timeouts for flakes | Root-cause + `failOnFlakyTests` | Playwright 1.52+ (flag present in 1.63) | CI cannot go green on a retry |

## Open Questions

1. **Does TEST-02's annotation rule cover Playwright specs?**
   - What we know: TEST-02 says "Any raised test or expect timeout", which is Playwright vocabulary too. Success criterion 1 says "every raised timeout that remains". About 70 E2E raises plus 15 `test.slow()` exist, and about 60 lack a measured number. The measured numbers are already in `e2e-report.json`.
   - What's unclear: whether the owner meant Vitest only.
   - Recommendation: **include the E2E specs and Playwright configs in rule 3 (annotation) but not in rules 1-2 (lane placement is Vitest-only).** Plan it as its own mechanical plan, with identifier hoisting (Pattern 4) to keep it small. Do not change E2E timeout values in this phase; annotate only. If the owner narrows the scope, delete the Playwright scan target from the guard.
2. **Dev `MAX_WORKERS`: 8 or keep 15?** 15 is green today with no timing tests in the parallel lane. 8 is the safer cap beside concurrent E2E and the burner. Recommendation: 8. Record the measured wall time at 8 against 75 s at 15. Revisit only if the slowdown is above 50%.
3. **Phase 14 D-10 (live-smoke 429 hardening) was deferred "to Phase 15" but has no TEST-0x ID.** Recommendation: the planner asks the owner in the plan-check, or adds one small plan ("map 429 on navigation to exit 2, zero retries, unit-tested") flagged as carried, not as a TEST requirement. Do not silently drop it.
4. **GatewayError / calculators: move or rewrite?** Moving costs about 6 s of serial time and no code. Fake-timer rewrites would let them stay parallel. Recommendation: move now (Phase 16 rewrites tests anyway).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.12 (node forks + browser via @vitest/browser-playwright 4.1.12); Playwright 1.63.0 |
| Config file | root `vitest.config.ts` (projects), `apps/web/playwright.config.ts`, `apps/extension/playwright.config.ts` |
| Quick run command | `MSYS_NO_PATHCONV=1 corepack.cmd pnpm vitest run --project scripts scripts/test-lanes.test.ts scripts/windows-path.test.ts` (< 10 s) |
| Full suite command | `MSYS_NO_PATHCONV=1 corepack.cmd pnpm test:unit` (about 80-110 s) and, at phase gate, `pnpm verify` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | No elapsed-time assertion or raised timeout in a non-serial Vitest file; every SERIAL file exists; serial configs have `fileParallelism:false` + `groupOrder:1`; parallel siblings exclude them; `ci.yml` has exactly one `run: pnpm test:unit` | unit (static guard + planted violations) | `pnpm vitest run --project scripts scripts/test-lanes.test.ts` | ❌ Wave 0 |
| TEST-01 | Serial stage really runs after the parallel stage, one file at a time | integration (behavioural) | `pnpm test:unit` log ordering check: a guard sub-test spawns `vitest run --root <tmp fixture> --config <tmp>/vitest.config.ts` with 2 parallel + 2 serial fixture files that log timestamps (same as the experiment), and asserts serial start > max parallel end and no serial overlap. Put it in `scripts-serial` (wall-clock based) | ❌ Wave 0 |
| TEST-02 | Every remaining raise has a `measured <n><unit>` + `cause` comment; no `retry`, no new `toPass`, Playwright `retries` exact | unit (static guard) | same `test-lanes.test.ts` | ❌ Wave 0 |
| TEST-03 | CI E2E line carries `--fail-on-flaky-tests`; web + extension configs set `failOnFlakyTests: !!process.env.CI` with a retry-policy comment | unit (workflow/config pin) | `pnpm vitest run --project scripts scripts/workflow-gate.test.ts scripts/test-lanes.test.ts` | ✅ workflow-gate.test.ts exists (extend) |
| TEST-03 | A pass-on-retry fails the run | integration | sub-test spawns Playwright on a tmp fixture spec that fails on attempt 0 and passes on retry 1 (`test.info().retry`), with `CI=1`; asserts exit ≠ 0 and "flaky" in output. Put it in `scripts-serial` | ❌ Wave 0 |
| TEST-04 | `MAX_WORKERS` used by root + browser configs; Playwright web `workers: process.env.CI ? 2 : 4`; RUNBOOK lists the same values | unit (config + doc pin) | `pnpm vitest run --project scripts scripts/test-lanes.test.ts scripts/runbook.test.ts` | ✅ runbook.test.ts (extend) |
| TEST-04 | PATH guard behaviour + all 5 configs use the module; win32 taskkill probe | unit (+ win32-only integration) | `pnpm vitest run --project scripts scripts/windows-path.test.ts` | ❌ Wave 0 |
| TEST-05 | Evidence file has 3 clean verify runs, repeat-each rows for every LOAD_SENSITIVE spec, CPU-pressure row with 0 failed | unit (doc pin) + manual run | `pnpm vitest run --project scripts scripts/test-evidence.test.ts`; the runs themselves are manual-background (about 2.5 h total) | ❌ Wave 0 |
| TEST-06 | Shuffled run green; seed in command equals seed in output and in the file | unit (doc pin) + manual run | same `test-evidence.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the quick run command plus the tests the task touched.
- **Per wave merge:** `pnpm test:unit` (full, both lanes) and `pnpm lint`.
- **Phase gate:** the full evidence protocol (Pattern 7). `pnpm verify` ×3 is itself the gate; then a CI push must be green with `--fail-on-flaky-tests` visible in the E2E step log and "using 2 workers".

### Wave 0 Gaps
- [ ] `tooling/vitest/lanes.ts`: manifest, `MAX_WORKERS`, `serialTest()`, `files()`, `LOAD_SENSITIVE_SPECS`
- [ ] `scripts/lib/test-lane-rules.mjs` + `scripts/test-lanes.test.ts`: covers TEST-01, TEST-02, part of TEST-03 and TEST-04
- [ ] `scripts/lib/windows-path.mjs` + `scripts/windows-path.test.ts`: TEST-04
- [ ] `scripts/cpu-burn.mjs` (+ optional `scripts/cpu-burn.test.ts`): TEST-05
- [ ] `scripts/test-evidence.test.ts`: TEST-05/06 (written red-first against a missing file, green once the evidence exists)
- Framework install: none.

## Sources

### Primary (HIGH confidence)
- Installed `vitest@4.1.12` dist:
  - `chunks/coverage.DM_a_rWm.js`: resolveConfig: fileParallelism → maxWorkers 1 (222-225), `VITEST_MAX_WORKERS` (380), shuffle object and seed (470-481), timeout defaults (538-539), RandomSequencer (91-95), groupOrder sort (51-53)
  - `chunks/cli-api.B0Pz1_R7.js`: groupSpecs (3849-3910), group-serial execution (3762-3779), resolveMaxWorkers (3832-3838), browser pool threads (2401-2405, 2479-2483), cliOverrides list (11147-11170), inline project spread (11177-11199), config-name regexp (11146), seed log (1993), project filter (14111-14118)
  - `chunks/index.UpGiHP7g.js:40-46`: wildcard and `!` negation
  - `chunks/test.DNmyFkvJ.js:3361,3409`: waitFor/poll defaults
  - `chunks/reporters.d.DtoKVV2s.d.ts`: groupOrder docs, `fileParallelism`/`maxWorkers`/`retry` docs
- `createVitest()` resolution of this repo's projects (run 2026-11-06).
- Throwaway experiments on Vitest 4.1.12 (2026-11-06, deleted afterwards): groupOrder+fileParallelism ordering; shuffle with file-based vs inline projects; `VITEST_MAX_WORKERS` vs `--maxWorkers`.
- Installed `playwright@1.63.0`: `lib/program.js:194,212,227`; `lib/common/index.js:509`; `lib/runner/index.js:6290`; `types/test.d.ts:1266-1274`.
- Full parallel `vitest run --reporter=json` on the dev box, 2026-11-06: 359 files, 6,998 tests, 75.4 s.
- `apps/web/test-results/e2e-report.json` and `vitest.json` (14-11 launch audit at 449ecc5).
- CI run 42289609809 log (`gh run view --log`).
- GitHub-hosted runner specs, https://docs.github.com/en/actions/reference/runners/github-hosted-runners (public repo Linux: 4 CPU / 16 GB).

### Secondary (MEDIUM confidence)
- Phase history: `.planning/phases/{03,04,07,08,10,12}/deferred-items.md`, `14-07-SUMMARY.md` (CPU-pressure method), `14-11-SUMMARY.md` (shards, workers), `10-23-SUMMARY.md` (burner levels), `tasks/lessons.md`.

### Tertiary (LOW confidence)
- None used for recommendations.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new dependencies; versions read from `node_modules`.
- Lane mechanics: HIGH. Source-read and reproduced, including the two traps.
- Serial-lane membership: HIGH for the 5 named groups and for the elapsed-time files; MEDIUM for the scripts threshold list (one full-load sample; re-measure in plan).
- Worker values: HIGH for CI (observed); MEDIUM for dev 8 (to be measured).
- Pitfalls: HIGH (each one verified, except Pitfall 6, which is MEDIUM).

**Research date:** 2026-11-06
**Valid until:** Phase 16 starts (Vitest 5 changes these internals). Otherwise 30 days.
