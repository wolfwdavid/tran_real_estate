# Phase 16: Toolchain: pnpm 12 -> SvelteKit 3 -> Vitest 5 - Research

**Researched:** 2026-11-10
**Domain:** Framework-major migration of a static SvelteKit + WXT pnpm monorepo (package manager, framework, test harness), plus a pre-flight on the live-smoke 429 and the Phase 15 test-lane guard
**Confidence:** HIGH for versions, Kit 3 / Vitest 5 / pnpm 12 behaviour and the blast radius (all read from registry tarballs, official docs, or reproduced in a scratch copy outside the repo); MEDIUM for the live-smoke 429 root cause (strong lead, not yet measured against the live CDN); LOW only for the Kit 3 bundle-budget trim (the growth is measured, the fix is not found).

> Method note. The repo working tree was not touched (`git status` clean at the end). All experiments ran in scratch copies under `%TEMP%` (`pn12/`, `k3spike/`, `v5/`): a `git archive HEAD` copy of the repo with pnpm 12.18.0, Kit 3.1.1 then 3.2.0, `sv@1.3.0`, Vitest 5.1.0, WXT 0.21.5. Where a claim below says "spike", it was reproduced there.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Carried forward (locked earlier, not re-asked)**
- **D-01:** Order is pnpm 12 -> Kit 3 -> Vitest 5, one plan each, no parallel plans, never two majors in one commit (`.planning/research/SUMMARY.md`, "Where the four files disagree (resolved)").
- **D-02:** No plan from any other phase executes while Phase 16 is in flight; Phase 17 is serialized against it (ROADMAP). Check for other live sessions on the repo before execution.
- **D-03:** The smoke keeps `retries: 0`; a flake or a red run is root-caused, never hidden with a retry, a raised timeout or a `toPass` loop (Phase 15 guards, `tasks/lessons.md`).
- **D-04:** A page over the 60 KB gzipped JS budget after the Rolldown change is trimmed; the budget is not raised (owner decision 2026-10-29).
- **D-05:** Blame-clean diffs outside the codemod's own task groups (14-CONTEXT D-15). Commits carry no co-author trailer in this repo (commit-msg hygiene hook).

**Pre-flight debts (discussed 2026-11-10)**
- **D-06:** The live-smoke HTTP 429 fix lands as the FIRST plan of Phase 16 (16-00), before pnpm 12. No decimal Phase 15.1, and it does not wait for Phase 17.
- **D-07:** The 429 fix does two things:
  1. Relabel, as defined in `15-.../deferred-items.md`: a 429 on any smoke navigation exits 2 (precondition, "CDN rate-limited, re-dispatch once"), any other status keeps exit 1, and a scripts-project unit test plants a 429 and asserts exit 2.
  2. Pace: find out why the live run trips the Pages limit (observed 2026-11-11: specs 1-108 pass, then every navigation answers 429) and pace the live target so a run goes green on its own (fewer workers or spaced navigations, live target only; the local emulator runs stay as fast as today). Zero retries added.
- **D-08:** From `15-REVIEW.md`, plan 16-00 fixes CR-01 (a timeout of `0` disables the timeout and passes every rule) and the warnings a Kit 3 / Vitest 5 migration could slip through: at minimum WR-02 (timeouts and retries passed by reference or shorthand), WR-03 (timeout-raising APIs outside the rule set) and WR-04 (`tooling/vitest/lanes.ts` and runner CLI flags outside the sweep). The planner judges the remaining warnings against the same test ("could a migration commit use this to go green?") and leaves the rest recorded, unfixed. Each guard fix is mutation-tested: plant the bypass, see the rule fail.
- **D-09:** Hard baseline gate. Plan 16-01 (pnpm 12) may not start until, at the pre-flight commit on the current toolchain (Kit 2 / Vitest 4), `pnpm verify` is green and one `live-smoke` run is green, with the run link recorded in the 16-00 summary. A later red then has the migration as its only candidate cause.

**Corrections to the roadmap text (facts, not choices)**
- **D-10:** Success criterion 3 names `https://tranrealestate.github.io/`. The live origin is `https://wolfwdavid.github.io/tran_real_estate/` (sub-path project site, owner decision 2026-10-29). The service-worker proof is against that origin, so registration scope and the precache list are under `/tran_real_estate/`. Fix the wording in ROADMAP when the phase is planned.
- **D-11:** Recorded audit exceptions are five today, not four: `GHSA-g3hv-75wg-m249` (minimatch, dev toolchain, revisit 2026-11-30) was added in `f169749` after the roadmap was written. Kit 3 clears the three Kit-related ones; deepmerge stays. See discretion item below for the target.

### Claude's Discretion

The owner chose not to discuss these three areas. Each has a stated default; research and planning may change it with a recorded reason, and anything that needs the owner (a push, a revert on the live site) is still asked at the time.

- **Landing and deploy cadence.** Default: work on `main`, push after each plan once its local gates are green, so each plan gets its own deploy and live-smoke run (the Kit 3 service-worker change is only observable live, and a red run then points at one plan). Pushes stay owner-approved as in 15-11. A red live smoke caused by the migration: roll back per `docs/RUNBOOK.md` (revert and push), then fix and re-land; a 429-only run exits 2 and is re-dispatched once.
- **Audit target and bumps.** Default: the three Kit 2 exceptions are removed in the Kit 3 plan from both `scripts/lib/audit-exceptions.mjs` and `pnpm-workspace.yaml`; deepmerge stays to 2027-01-31; minimatch is removed only if the ESLint family accepts minimatch >= 11.0.1 by then, otherwise it stays with a refreshed revisit date and TOOL-05 / criterion 5 are reworded to the honest count. Routine bumps (Playwright, axe, bits-ui, layerchart, shadcn CLI, wxt, ESLint family) are one final plan after Vitest 5, not mixed into the three major plans. Dependabot PRs #9 and #10 are not merged while the phase is in flight and are closed or superseded by that final plan; the Kit-major ignore in `.github/dependabot.yml` is revisited after Kit 3 lands. `@types/node` stays `^24` while `engines.node` is `>=24 <25`.
- **Proof after Vitest 5.** Default: the Phase 15 evidence protocol is re-run once on Vitest 5 and a new dated file is committed under `docs/test-evidence/` (the current file was measured on Vitest 4 and `scripts/test-evidence.test.ts` pins the newest file). The `groupOrder` single-invocation lane experiment is time-boxed; keep the two-invocation lanes if per-project `maxWorkers` does not hold.
- Exact patch versions (research named pnpm 12.16.1, Kit 3.1.0, Vitest 5.0.5 on 2026-10-29): the researcher re-checks the latest stable patches and pins exact versions.
- Whether 16-00 is one plan or two (smoke 429 work and guard fixes touch disjoint files).

### Deferred Ideas (OUT OF SCOPE)

- The `15-REVIEW.md` warnings and info items that 16-00 does not fix stay recorded there for a later quick task.
- A Node major move (and `@types/node` 26) is its own decision, not part of this phase.
- App-level recovery from a failed lazy chunk load (`15-.../deferred-items.md`, 15-01 root cause) is a product decision for a later phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOOL-01 | pnpm 12 pinned; lockfile regenerated once; no hardcoded `11.27.0`; frozen install passes locally and in CI | Spike: `pnpm install --lockfile-only` under 12.18.0 yields a two-document lockfile whose second document is byte-identical to today's file. **New:** pnpm 12 is a native binary, `npm_execpath` is now `pnpm.exe`, which breaks four scripts (build-web, smoke, audit-evidence, launch-audit) -> must be fixed in the same plan. Dependabot lockfile bug fixed upstream 2026-11-03. |
| TOOL-02 | SvelteKit 3.1 + adapter-static 4 via `sv migrate`; Kit options in `vite.config.ts` + plugin-free `kit.options.js`; `$lib` -> `#lib` everywhere incl. ESLint groups, `components.json`, alias, boundary tests; `resolve()` / `$app/env` / shallow routing in Kit 3 forms | Spike ran the codemod: which tasks work, which fail (`svelte-config` fails on this repo), which leave code behind (2 dynamic imports, ~10 `typeof import()` sites, 14 `resolve('/...')`). ESLint `no-restricted-imports` group `#lib/...` silently matches nothing (gitignore comment) and must be written `\#lib/...`. |
| TOOL-03 | Service worker on `$app/manifest` with in-worker dotfile filter; registers and precaches on the live origin | Spike SW passed the local `pwa.smoke.ts` contract on the `sub` build (121/121). Kit 3 manifest `assets` includes `.nojekyll` (tarball read). Manifest paths are base-relative objects -> the worker must map them through `resolve`/`asset`. |
| TOOL-04 | Vitest 5 + browser-playwright 5 + vitest-browser-svelte 3: awaited `render`, exact-text matchers, `clearMocks`, JSON reporter path, `pnpm verify` green | Spike on 5.1.0: `--reporter=dot --reporter=json --outputFile.json=` works incl. browser project; WXT 0.21.5 extension project 17 files/242 tests pass; lane tests pass; 23 `toHaveTextContent` + 1 `getByText` failures reproduced. Only 7 bare `render(` calls are real (the "198" figure counted SSR `render` from `svelte/server`). |
| TOOL-05 | Audit exceptions shrink to one | **Cannot be met as worded.** Spike `pnpm audit` with Kit 3 and the three Kit exceptions removed: clean except deepmerge (low) and minimatch (moderate). Honest target: five -> two. |
| TOOL-06 | Each step its own plan, gated by `pnpm verify` + `smoke:local`; closed by deploy + green live smoke | Gate matrix and live-origin proof list in Validation Architecture. |
</phase_requirements>

## Summary

All three migrations are feasible with the current stack, and the spike shows the repo-specific failure modes concretely. The three findings the milestone research did not have, and that change the plans, are: (1) **pnpm 12 is a Rust native binary and sets `npm_execpath` to `pnpm.exe`**; four repo scripts that spawn `node $npm_execpath ...` crash with `ERR_UNKNOWN_FILE_EXTENSION` (reproduced: `pnpm build:root` fails on 12.18.0), so TOOL-01 is not just a pin and a lockfile; (2) **Kit 3 adds about 4.4 KB gzip to the initial JS of the eight budget-gated pages** (59.7 -> 64.1 KB, same on 3.1.1 and 3.2.0, unchanged by `pollInterval: 0`), so `budget:assert` goes red and D-04 requires a trim of at least 4.2 KB, which no one has found yet; (3) **the `\#lib` ESLint trap**: `no-restricted-imports` groups starting with `#` are gitignore comments and match nothing, so a mechanical `$lib` -> `#lib` rewrite of `eslint.config.js` silently disables every architectural boundary rule.

The rest is mapped: `sv migrate sveltekit-3` has 12 tasks (2 always-on prerequisites); its `svelte-config` task **fails** on this repo (duplicate `resolveAnalytics` import), which is fine because the plan hand-writes `kit.options.js`; the `lib-alias` task rewrote about 1,060 imports with `.ts/.js/.svelte` extensions but left 2 dynamic imports, ~10 `typeof import('#lib/...')` type queries, and 14 `resolve('/...')` calls; the build, `svelte-check`, or `pnpm lint` surface each of those loudly, except the regex-over-source boundary tests (`investor-port.test.ts`, `analyzer-page.svelte.test.ts`, `key-card-additions.test.ts`) which go vacuous or red depending on form. `/_app/version.json` keeps its path and shape (`{"version": "<name>"}`, read from the 3.1.1 tarball and from the spike build). `svelte-kit sync` is still required (it writes `node_modules/$app/{tsconfig,types}` that `extends: "$app/tsconfig"` resolves through). Vitest 5.1.0 behaves as documented; the per-project `maxWorkers`/`groupOrder` question is answered yes (the lanes already run as a single invocation, and the lane behaviour tests pass on 5.1.0).

**Primary recommendation:** Sequence 16-00a (429 relabel + pacing; lead: every fresh-context page load registers the service worker and fetches ~379 precache entries) and 16-00b (guard hardening), a hard baseline gate, then 16-01 pnpm 12.18.0 (pin + `scripts/lib/pnpm-cmd.mjs` helper + lockfile once + test rewrites), 16-02 Kit 3.1.1 as ordered task groups ending in a bundle-trim gate, 16-03 Vitest 5.1.0, 16-04 routine bumps and evidence re-run; push and live-smoke after each plan; reword TOOL-05 to "five -> two" and ROADMAP criterion 3 to the sub-path origin.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Package-manager pin, lockfile, workspace settings | Build tooling (repo root) | CI (`pnpm/action-setup`) | `packageManager` is read by pnpm itself and by action-setup; no runtime tier involved |
| Spawning the pinned pnpm from scripts | Node scripts (`scripts/`) | -- | The `npm_execpath` contract changed with the native binary; a single shared helper owns it |
| Kit options (adapter, base path, CSP hashes, version stamp, prerender entries) | Build config (`kit.options.js` + `vite.config.ts`) | Tests importing `kit.options.js` | Plugin-free module so unit tests can import the policy without loading Kit's Vite plugin |
| Service-worker precache list and dotfile filter | Browser (service worker) | Build output (`$app/manifest`) | The worker is the only place that can filter; the manifest is raw static-dir content |
| `#lib` module resolution | `package.json` `imports` (Node/Vite native) | tsconfig (`$app/tsconfig`), ESLint groups, shadcn CLI | Subpath imports are resolved by Node/Vite; every other tool must be told separately |
| Architectural boundary enforcement | ESLint `no-restricted-imports` + AI-04 import-graph walker + boundary tests | -- | These are string-pattern tools; each needs its own `#lib` migration and a planted-violation proof |
| Test semantics (Vitest 5) | Test harness (Vitest projects) | Playwright browser provider | Behavioural changes are semantic, not type errors |
| Live-origin SW registration/precache proof | Live origin (GitHub Pages) via `live-smoke.yml` | Local Pages emulator (`serve-pages.mjs`) | Only the live origin proves the dotfile/Content-Type/CDN behaviour end to end |
| Pacing of live smoke traffic | Test harness (Playwright smoke config/fixtures) | `scripts/smoke.mjs` classification | Rate limiting is a property of the live CDN; local emulator must stay fast |

## Standard Stack

### Core (all pins verified against the npm registry on 2026-11-10)

| Library | Version | Purpose | Why / provenance |
|---------|---------|---------|------------------|
| pnpm | **12.18.0** | Package manager | `latest` dist-tag = 12.18.0 (published 2026-11-05); 12.19.0 is only `next-12` (published today). [VERIFIED: npm registry] |
| @sveltejs/kit | **3.1.1** | Framework | 3.1.1 (2026-10-29) is the latest patch of the 3.1 line named in the roadmap; 3.2.0 was published today (2026-11-10) and `latest` points to it, but spike budget results are identical on both. Pin 3.1.1 (matches "Kit 3.1", >= 12 days old for any release-age gate). [VERIFIED: npm registry + spike] |
| @sveltejs/adapter-static | **4.0.1** | Static adapter | `latest`; peer `@sveltejs/kit ^3.0.0-next.0` [VERIFIED: npm registry] |
| svelte | **5.57.3** | Compiler/runtime | Kit 3 peer `^5.57.1`; `sv` package-json task wants `^5.57.2`; `latest` = 5.57.3. Bump root, `apps/web`, `apps/extension` together. [VERIFIED: npm registry] |
| @sveltejs/vite-plugin-svelte | **7.3.1** | Svelte in Vite | Kit 3 peer `^7.0.0`; `latest` [VERIFIED: npm registry] |
| svelte-check | **4.7.8** | Type check | `latest`; sv minimum `^4.7.5` [VERIFIED: npm registry] |
| runed | **0.38.0** | Svelte utilities | `latest`; 0.37 peers Kit `^2.21` only [CITED: .planning/research/SUMMARY.md, registry] |
| eslint-plugin-svelte | **3.24.1** | Lint | 3.23.1 added "Recognize SvelteKit 3 in rule conditions" and "Enable no-navigation-without-resolve on SvelteKit 3"; the repo's 3.23.0 predates both. Bump inside the Kit plan. [CITED: plugin CHANGELOG] |
| vitest | **5.1.0** | Test runner | `latest` (2026-11-02). Spike-validated for the json reporter, per-project workers, WXT, lane tests. 5.0.5 is the alternative the milestone research named; no reason to prefer it. [VERIFIED: npm registry + spike] |
| @vitest/browser-playwright | **5.1.0** | Browser provider | Peer-pins `vitest 5.1.0` exactly [VERIFIED: npm registry] |
| vitest-browser-svelte | **3.1.0** | Browser component render | `latest`; `render()` is async; peers `vitest ^4 \|\| ^5` [VERIFIED: npm registry] |
| wxt | **0.21.5** | Extension | Spike: `vitest run --project extension` on Vitest 5.1.0 = 17 files / 242 tests green. [VERIFIED: spike] |

### Supporting

| Tool | Version | Purpose | When |
|------|---------|---------|------|
| sv (CLI, via `npx`/`pnpm dlx`, never a dependency) | 1.3.0 | `sv migrate sveltekit-3` | Kit plan only. `sv@1.3.0` published 2026-11-04. [VERIFIED: npm registry + tarball] |
| pnpm/action-setup | v6.1.0 already pinned by SHA in all workflows | CI pnpm install | 6.1.0 "support pnpm v12" [CITED: github.com/pnpm/action-setup releases]; v6.1.1 (2026-11-03) exists but no workflow edit is required (and `workflow-gate.test.ts` pins SHAs). |
| shadcn-svelte CLI | 1.6.1 now; 1.8.0 latest | `#lib` alias auto-detect since 1.6.0; 1.7.2 runs `svelte-kit sync` when `node_modules/$app` is missing | Final bumps plan; not needed for the migration itself [CITED: CLI CHANGELOG] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Kit 3.1.1 | Kit 3.2.0 | Newer (published today), same bundle result; a day-old release is also what pnpm's release-age policy tends to hold back. Take 3.1.1. |
| Codemod `svelte-config` task | Hand-written `kit.options.js` | The codemod task **crashes** on this repo (duplicate import); the locked decision already prefers the plugin-free module. |
| Vitest 5.0.5 | 5.1.0 | 5.1.0 is what the spike validated. |

**Installation (executor, per plan; not run by research):**
```bash
# 16-01
corepack use pnpm@12.18.0        # or edit packageManager; then ONE non-frozen install to regenerate the lockfile
# 16-02
npx sv@1.3.0 migrate sveltekit-3 --cwd apps/web --tasks <one group at a time> --no-install --confirm   # never --tasks all
# 16-03: bump vitest, @vitest/browser-playwright, vitest-browser-svelte in root, apps/web, apps/extension together
```

**Version verification:** every version above was read with `npm view <pkg> dist-tags.latest` / `time` on 2026-11-10.

## Package Legitimacy Audit

slopcheck could not be installed (the install command was denied by the environment's permission policy), so it was not run. Every package below is already in the repo's lockfile (this phase bumps versions, it adds nothing new except none), and each was checked against the registry for age, repository, downloads and install scripts. Because the slopcheck gate did not run, the planner should treat the version bumps as `[ASSUMED]`-class for the legitimacy gate and keep the lockfile-diff review (names only change version) as the compensating control.

| Package | Registry | Age | Weekly downloads | Source Repo | install scripts | slopcheck | Disposition |
|---------|----------|-----|------------------|-------------|-----------------|-----------|-------------|
| pnpm | npm | 13 yrs | 326 M | github.com/pnpm/pnpm | `preinstall`/`postinstall: node install.js` (links the platform native binary; expected for pnpm >= 11/12) | not run | Approved (official); lockfile gains `@pnpm/exe.*` platform packages in the boot document |
| @sveltejs/kit | npm | 6 yrs | 5.0 M | github.com/sveltejs/kit | none | not run | Approved |
| @sveltejs/adapter-static | npm | 6 yrs | 1.6 M | github.com/sveltejs/kit | none | not run | Approved |
| sv | npm | name since 2013; current package from sveltejs/cli | 77 k | github.com/sveltejs/cli | none | not run | Approved for `npx` use only, never a dependency |
| vitest | npm | 4.9 yrs | 180 M | github.com/vitest-dev/vitest | none | not run | Approved |
| @vitest/browser-playwright | npm | 1.1 yrs | 15 M | github.com/vitest-dev/vitest | none | not run | Approved |
| vitest-browser-svelte | npm | 2.3 yrs | 358 k | github.com/vitest-community/vitest-browser-svelte | none | not run | Approved |
| runed | npm | 2.7 yrs | 4.4 M | github.com/svecosystem/runed | none | not run | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck not run).
**Packages flagged [SUS]:** none. Note for the planner: pnpm's own install script is expected; do not add it to `allowBuilds` (that setting governs dependencies, not the manager itself; the spike installed with `allowBuilds: simple-git-hooks: false` unchanged).

## Architecture Patterns

### System Architecture Diagram (migration pipeline, not runtime)

```
                      +-----------------------------+
 owner push --------> | ci.yml (hygiene, quality x3)| -- deploy (Pages) --+
                      +-----------------------------+                     |
                               ^  pnpm install --frozen-lockfile          v
                               |  (pnpm/action-setup reads packageManager)   https://wolfwdavid.github.io/tran_real_estate/
 16-01 pnpm 12 ----------------+                                          ^
   packageManager pin                                                     |
   lockfile (boot doc + main doc)        live-smoke.yml (workflow_run) ---+
   scripts/lib/pnpm-cmd.mjs  <--- build-web, smoke, audit-evidence, launch-audit
                                         |
 16-02 Kit 3 --------------------------> | version poll (_app/version.json) -> 121 specs, retries 0
   pins -> kit.options.js + vite.config.ts   exit 0/1/2(429, precondition)/3/4
   codemod groups (one commit each)
   service-worker/index.ts ($app/manifest, in-worker dotfile filter, resolve()/asset())
   #lib: package.json imports, eslint (\#lib), components.json, stubs, tests
   builds x3 -> csp:assert, seo:assert, budget:assert (<= 60 KB)  <-- gate that goes red
 16-03 Vitest 5 ------------------------ vitest run (projects: parallel lane group 0, serial lane groups 1/2)
   await render, toMatchTextContent, locators.exact, .vitest/ gitignore
   audit-evidence.mjs --reporter=json --outputFile.json=...
 16-04 routine bumps + docs/test-evidence/<date>.md + LAUNCH-AUDIT.md regenerated
```

### Recommended Project Structure (after Kit 3)

```
apps/web/
├── kit.options.js            # plugin-free Kit options (adapter, paths, version, prerender, csp); imported by vite.config.ts AND tests
├── vite.config.ts            # sveltekit(kitOptions) in the non-Vitest branch; no $lib alias
├── package.json              # "imports": {"#lib": "./src/lib/index.js"?, "#lib/*": "./src/lib/*"}
├── tsconfig.json             # extends "$app/tsconfig"; exclude ["src/service-worker"]
└── src/
    ├── service-worker/       # index.ts + tsconfig.json (extends "$app/tsconfig/service-worker")
    └── lib/testing/app-paths.stub.ts   # mirrors Kit 3 resolve()/asset() semantics
scripts/lib/pnpm-cmd.mjs      # (16-01) one place that decides how to spawn the pinned pnpm
```

### Pattern 1: Spawn the pinned pnpm regardless of its form (16-01)
**What:** `process.env.npm_execpath` is a `.js` file for pnpm <= 11 and `pnpm.exe` (native binary) for pnpm 12. Spawn it directly unless it is JS.
**When to use:** `scripts/build-web.mjs`, `scripts/smoke.mjs` (`runPlaywright`), `scripts/audit-evidence.mjs` (`pnpm`), `scripts/launch-audit.mjs` (`pnpmSpawn`). All four contain the identical `[process.execPath, [execPath]]` pair (grep: 4 hits).
```js
// Source: reproduced in spike; fix verified by running `pnpm build:root` and `node scripts/smoke.mjs --local --target sub`
const isJs = execPath && /\.[cm]?js$/.test(execPath);
const [bin, pre] = execPath ? (isJs ? [process.execPath, [execPath]] : [execPath, []]) : ['corepack', ['pnpm']];
```
Put it in one module and unit-test both branches (a `.js` path and an `.exe` path).

### Pattern 2: Plugin-free Kit options consumed by config and tests (16-02)
**What:** `apps/web/kit.options.js` default-exports the options object (adapter, `paths: { base, origin }`, `version.name`, `prerender`, `csp`); `vite.config.ts` calls `sveltekit(kitOptions)`; `csp-policy.test.ts`, `models.test.ts`, `service-worker-guard.test.ts`, `site-url.test.ts` import `kit.options.js` instead of `svelte.config.js`. `prerender.origin` becomes `paths.origin`. The `serviceWorker.files` filter is deleted from options and re-expressed in the worker.
**Type note (spike):** `svelte-check` flags `sveltekit(kitOptions)` (vite.config.ts:26) when the module is untyped JS; add a JSDoc `@type` on the default export.

### Pattern 3: Service worker on `$app/manifest` (16-02)
Verified facts from the 3.1.1 tarball: `assets` = every file under `static/` as `{ path }` with no leading slash and no base (`walk()` has no dotfile filter, so `.nojekyll` is in it); `immutable` and `prerendered` are `{ path }` relative to base; `$app/env` exports `version`. The worker must therefore (a) drop dotfiles, (b) map each path through `$app/paths` `resolve()` (pathnames and immutable files) or `asset()` (static files), because the current guard `ASSETS.has(url.pathname)` compares against base-prefixed absolute paths.
```ts
// Source: spike apps/web/src/service-worker/index.ts (passed pwa.smoke.ts on the sub build)
import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { resolve, asset } from '$app/paths';
const hidden = (p: string) => /(^|[\\/])\./.test(p);
const ASSETS = new Set([
  ...immutable.map((e) => resolve(e.path as never)),
  ...assets.filter((e) => !hidden(e.path)).map((e) => asset(e.path)),
  ...prerendered.map((e) => resolve(e.path as never))
]);
```
Export the filter (or put it in a tiny `precache.ts` imported by the worker) so `service-worker-guard.test.ts` can call it directly, as it calls `serviceWorker.files` today. The guard's REQUIRED list (`from '$service-worker'`) and FORBIDDEN list (`$app/service-worker`) must be flipped: require `$app/manifest`/`$app/env`, forbid `$service-worker`. Add `"exclude": ["src/service-worker"]` to `apps/web/tsconfig.json` and a `src/service-worker/tsconfig.json` extending `$app/tsconfig/service-worker` (Kit hard-fails the build with `tsconfig_invalid` otherwise; spike). Build output stays `build/service-worker.js` (`assert-csp.mjs` CARRIERS unchanged).

### Pattern 4: ESLint boundary groups under `#lib` (16-02)
`no-restricted-imports` `group` entries are matched with gitignore semantics; a leading `#` is a comment. Reproduced on ESLint 10.10.0: `['#lib/data/*','#lib/data/**']` -> NO FINDINGS; `['\\#lib/data/*','\\#lib/data/**']` -> reports. Write `'\\#lib/data/**'` (and `'!\\#lib/data/tables'`), keep the `**/lib/...` relative-path globs. Every group in `eslint.config.js` (DATA_INTERNALS and the `mods.flatMap` families, the `!` exemption at line ~216) and every sample in `scripts/eslint-rules.test.ts` (about 60 `'$lib/...'` strings) moves together; the planted-violation sweep is the proof.

### Pattern 5: Test stub that mirrors Kit 3 `resolve`
`apps/web/src/lib/testing/app-paths.stub.ts` today exports `base`, `assets`, and `resolve(path) { return path; }`. Kit 3 `resolve('settings/')` returns `base + '/' + 'settings/'`, and route IDs (leading `/`) go through `resolve_route`. After the codemod, tests that assert hrefs fail because the stub returns `settings/` (spike: 8 browser-test failures). The stub must become `resolve = (id) => id.startsWith('/') ? id : '/' + id`, `asset = (f) => '/' + f`, with `base`/`assets` removed; used by both `vite.config.ts` and `vitest.browser.config.ts` alias blocks.

### Anti-Patterns to Avoid
- **`sv migrate ... --tasks all`:** `svelte-config` crashes and leaves a half-written tree (spike: `vite.config.ts` modified, `svelte.config.js` deleted, "Identifier 'resolveAnalytics' has already been declared"). Run named task groups; `package-json` and `tsconfig` are prerequisites and always run (passing them to `--tasks` is rejected as "Unknown migration tasks").
- **Trusting the codemod's formatter:** after tasks it runs the project's `format` script (`prettier --write .`). Run it on a clean tree and commit the codemod's own diff separately from hand fixes.
- **Mechanical `$lib` -> `#lib` replace in regex/string tests:** `investor-port.test.ts:310` (`/import\s+(?!type\b)[^;]*from\s+'\$lib\/data'/`), `analyzer-page.svelte.test.ts:68` (`/investor-port|\$lib\/data/`), `key-card-additions.test.ts:149-151`, `no-auto-send.test.ts:163` (`startsWith('$lib/')`), `boundaries.test.ts` fixtures, `tooling/import-graph.ts:38` and `src/lib/ai/import-graph.ts:38` (the latter was rewritten by the codemod to `#lib`). These encode the old spelling; after migration they pass for the wrong reason or go red. Each needs the new spelling and a planted-case proof.
- **Combining the three majors or the routine bumps with a major commit** (D-01, D-05).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| `$lib` -> `#lib` rewrite of ~1,060 imports | Custom sed | `sv migrate sveltekit-3` `lib-alias` task | It resolves the right extension per target (`.ts`, `.js`, `/index.ts`, `.svelte`); then hand-fix the known leftovers |
| `await render(` insertion | Regex over every `render(` | Targeted edit of the 7 real sites plus a scoped assertion | `render` from `svelte/server` (SSR tests) must not be touched; see Pitfall 6 |
| Dotfile filtering of the precache | Build-step post-processing of `static/` | In-worker filter on `$app/manifest` assets | Kit 3 removed `serviceWorker.files`; the manifest is raw |
| Reading the pinned pnpm version | Hardcoded literals | `JSON.parse(readFileSync('package.json')).packageManager` | Three hardcoded copies is exactly the debt TOOL-01 names |
| Worker-count pacing for the live smoke | `retries`, bigger timeouts, `toPass` | Block service workers in specs that do not test them (`serviceWorkers: 'block'`), then measure | D-03 forbids hiding; this removes the requests instead |

**Key insight:** every silent-failure mode in this phase is a *string* that stopped matching (an ESLint group, a regex over source, an `ASSETS.has(pathname)` lookup, an exact-text matcher). The codemods fix imports; they do not fix strings. Each string family needs a planted-case proof, not a green suite.

## Runtime State Inventory

> This phase is a toolchain migration, not a rename, but a package-manager/path change leaves runtime state. Answered explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. The app is a static site; user data lives in each visitor's IndexedDB under unchanged Dexie schema names. No `$lib`/Kit identifier is a stored key. | None -- verified by grep: no storage key contains `lib`/`kit` module paths. |
| Live service config | **The deployed service worker.** Existing visitors hold a worker registered by the Kit 2 build (cache `tran-shell-<sha>`, scope `/tran_real_estate/`). The Kit 3 worker registers with `type: 'module'`; the old worker stays until every tab closes (by design, no `skipWaiting`). GitHub Pages repo variables (`PAGES_ENABLED`, `BASE_PATH`, `PUBLIC_*`) are unchanged. | Verify on the live origin from a **fresh browser context** (the smoke does); owner UAT rows that say "open an InPrivate window after a redeploy" already cover the stale-worker case. No data migration. |
| OS-registered state | None for this repo. Machine-level: a global pnpm 11.0.9/11.27.0 exists; with `packageManager: pnpm@12.18.0` the global pnpm **self-switches** to 12.18.0 (spike: `pnpm --version` inside the scratch project printed 12.18.0) and `corepack pnpm` downloads the 12.18.0 binary (corepack 0.35.0). | Document; no re-registration. `tasks/lessons.md` / README / RUNBOOK wording about `corepack pnpm` becomes optional. |
| Secrets / env vars | None renamed. `npm_execpath`, `BASE_PATH`, `BUILD_SHA`, `SMOKE_*` keep their names; only the *form* of `npm_execpath` changes (see Pitfall 1). | Code edit (helper), no secret change. |
| Build artifacts / installed packages | `apps/*/node_modules/.pnpm` layout, `.svelte-kit/` (stale `tsconfig.json`, generated types), `apps/web/build*`, `.vite` caches, `.vitest-attachments/` -> `.vitest/`. `node_modules/$app/{tsconfig,types}` is created by `svelte-kit sync`. Stale build dirs fail `smoke:local` by design (stamp = HEAD). | After each plan: rebuild all three targets; delete `.svelte-kit` once after the Kit plan; add `.vitest/` to `.gitignore`; delete the codemod's `apps/web/MIGRATION_TASKS.md` before committing. |

## Common Pitfalls

### Pitfall 1: pnpm 12 `npm_execpath` is a native binary (NEW, reproduced)
**What goes wrong:** `pnpm build:root` -> `node scripts/build-web.mjs` -> `spawnSync(process.execPath, [npm_execpath, ...])` -> `TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".exe"`. Same in `smoke.mjs`, `audit-evidence.mjs`, `launch-audit.mjs`. Under pnpm 12 `pnpm verify` dies at `build:root`.
**Why:** pnpm 12 is a Rust rewrite; `npm_execpath` = `...\node_modules\pnpm\pnpm.exe` (spike, printed from a pnpm 12.18.0 script).
**How to avoid:** Pattern 1 helper, unit-tested, in the same commit as the pin. Add a test that fails if any `scripts/*.mjs` contains `[process.execPath, [execPath]]` outside the helper.
**Warning signs:** `ERR_UNKNOWN_FILE_EXTENSION` in the first `pnpm verify` after the pin.

### Pitfall 2: The two-document lockfile and Dependabot / the old single-document test
**What goes wrong:** `scripts/supply-chain.test.ts:176` asserts zero `---` lines. The pnpm 12 lockfile has a leading boot document (`importers: .: packageManagerDependencies: pnpm: 12.18.0` plus `@pnpm/exe.*` platform packages) then the real document; spike: the second document is **byte-identical** to the current lockfile, so the only diff is the 157-line boot document. Both documents declare `lockfileVersion: '9.0'` and *both* contain `importers:`.
**How to avoid:** Rewrite the test to parse the YAML stream (`yaml` is not a dependency; split on the `---` document separator), assert exactly two documents with the first holding `packageManagerDependencies` and the *last* holding the project importers (`apps/web`, `apps/extension`, `packages/*`), and keep the "no other documents" intent. A naive "read the first document" check would see an empty graph. `docs`/comments must stop saying Dependabot ignores later documents: dependabot-core #15904 ("pnpm v12 env lockfile document is parsed as an empty dependency graph") closed as completed 2026-11-03 and users confirmed the fix on 2026-11-06 [CITED: github.com/dependabot/dependabot-core/issues/15904]. Still verify once after the push: Insights -> Dependency graph lists the real packages (owner row; research cannot see it).
**Frozen install:** with the pin changed and the old lockfile, `pnpm install --frozen-lockfile` fails (`Cannot update packageManagerDependencies with "frozen-lockfile" because the lockfile is not up to date`, spike). Regenerate **once** with a non-frozen `pnpm install`, commit pin + lockfile together. `--frozen-lockfile false` is no longer accepted [CITED: pnpm.io/blog/releases/12.0].

### Pitfall 3: `sv migrate` leftovers (reproduced)
After running every task except `svelte-config` on the repo (Kit 3.1.1 era toolchain), a build and `svelte-check` show: (a) 2 dynamic imports missed (`routes/(app)/settings/+page.svelte:61`, `routes/(app)/setup/rentcast/+page.svelte:90`, both `Promise.all([import('#lib/...'), import('$lib/storage/db')])`); Kit 3 hard-errors the build with `module_removed_lib` but does not name the file. (b) Directory modules: the codemod's extension probe produced `#lib/storage/secrets.ts` for a directory `secrets/index.ts`; Rolldown failed with "failed to resolve import". (c) ~10 `typeof import('#lib/storage/backup')`-style type queries in `AppNotice.svelte` and `BackupSection.svelte` left extensionless (svelte-check "Cannot find module"). (d) 14 `resolve('/...')` calls left in the old form (5 root `resolve('/')` -> `resolve('')`, 9 `resolve('/x/')`; 152 were converted), flagged by svelte-check as "not assignable to parameter of type 'never'". (e) `page.url` readonly: `SearchPage.svelte:58` and `(app)/+layout.svelte:72` need `new URL(page.url)` / `new URLSearchParams(...)`. (f) 20 svelte-check errors in 10 files in total at that point.
**How to avoid:** order the task groups so each leaves the tree buildable; fix leftovers in a separate "hand fixes" commit per group; gate each group with `pnpm check` + a build.

### Pitfall 4: Kit 3 grows the initial JS by about 4.4 KB gz; the 60 KB budget goes red (reproduced)
**What goes wrong:** `budget:assert` on the spike root build: for-agents 64.0, for-investors/for-renters 64.1, tools/* 63.2-63.4, feedback 60.6 (8 gated pages FAIL; baseline 59.6-59.7 with 0.3-0.4 KB headroom, identical to the repo's own build, so the baseline comparison is apples to apples). `csp:assert` (45 pages) and `seo:assert` (44 pages, 14 sitemap URLs, 6 share cards) pass.
**Why:** The Kit client chunk grew from about 10.5 KB gz to 14.6 KB gz on `for-renters` (Kit 2.70.3 -> 3.1.1); the Kit runtime source is 11% larger (201 -> 224 KB in `runtime/client`). Not caused by version polling (`pollInterval: 0` changed nothing). Kit 3.2.0 is the same. Kit 2 was already on Vite 8 / Rolldown, so the "Rolldown chunking" worry is not the cause; the framework runtime is.
**How to avoid:** D-04 forbids raising the budget. Budget a dedicated forensic-and-trim task group *inside* the Kit plan, after the build is green and before the plan can close: (1) attribute bytes with sourcemaps of the shared initial chunk; (2) try Kit options that gate client code (research did not find one that helps; `pollInterval: 0` does not); (3) look for app imports in the shared layout/marketing initial chunks (bits-ui, zod, Dexie, runed) that can move behind a dynamic import or a lighter helper; (4) need at least 4.2 KB on the worst page. This is the highest-risk item in the phase; if the trim cannot reach 60 KB, the plan must stop and escalate to the owner rather than raise the budget.

### Pitfall 5: Vitest 5 semantics (reproduced where possible)
On the combined spike (Kit 3 + Vitest 5.1.0), the `web-browser` project ran 208 tests: 176 passed, 32 failed in 9 files (`DataShell` 16, `DataStatusBar` 4, `DueSearchesDialog` 3, `ShortlistToggle` 2, `CapConfirmDialog` 2, `DataSourceChoice` 2, `affordability`, `CallMeter`, `CapEditor` 1 each). Causes: 23 x `toHaveTextContent` now exact (all 40 current uses are string arguments, 6 files; none use regex, so each partial string becomes a failure and waits the 15 s expect timeout); 8 x `toHaveAttribute("href", "/settings/#...")` (the stub, Pattern 5, a Kit effect not a Vitest one); 1 x `getByText('within the 30% guideline')` ("Cannot find element": `browser.locators.exact` now defaults to `true`).
Other documented changes that apply [CITED: vitest.dev/guide/migration]: `clearMocks` defaults to `true` (6 explicit clear calls exist; audit tests that count calls across `it`s); `vi.mock`/`vi.hoisted` must be top-level (8 `vi.mock` sites); browser automocks return `undefined` unless `{ spy: true }`; `expect.poll` rejects when it does not settle; fake timers mock `Temporal` (7 files use fake timers); artifacts move to `.vitest/` (the spike created `.vitest/attachments/failure-screenshots/`; `.gitignore` only lists `.vitest-attachments/` and `__screenshots__/`); default browser API port changes to 23315; config lookup no longer climbs parents (the repo always passes `--config`, unchanged).
**`render`:** `vitest-browser-svelte` 3 makes `render` async. Real bare calls: **7** (`apps/extension/tests/browser/popup.browser.test.ts` x6, `apps/web/.../FairRentCheck.browser.test.ts:147` x1). The context's "about 198 `render(` call sites" counts `render` from `svelte/server` in 35 SSR-style `*.test.ts` files (e.g. `shortlist-ui.test.ts`), which must **not** be awaited. The "zero bare `render(`" acceptance must be scoped to files that import `vitest-browser-svelte` (36 files today), not a repo-wide grep. A browser test that gets markedly faster after the migration is suspect (unmounted component).

### Pitfall 6: `eslint-plugin-svelte` 3.23.0 does not recognise Kit 3
3.23.1 added "Recognize SvelteKit 3 in rule conditions" and "Enable no-navigation-without-resolve on SvelteKit 3" [CITED: plugin CHANGELOG]. The repo has 70 `eslint-disable ... svelte/no-navigation-without-resolve` comments; on 3.23.0 the rule may turn off under Kit 3 and the disables become unused-directive noise, silently losing the "every internal link goes through `resolve()`" guard. Bump to 3.24.1 in the Kit plan and prove it with a planted bare `<a href="/x">` (rule must report).

### Pitfall 7: `svelte-kit sync` is still needed
`extends: "$app/tsconfig"` and `$app/types` resolve through `apps/web/node_modules/$app/{tsconfig,types}`, written by `svelte-kit sync` (spike; shadcn CLI 1.7.2 independently fixed "run `svelte-kit sync` when `node_modules/$app` is missing in SvelteKit v3 projects"). Keep `prepare: svelte-kit sync || echo ''` and `check: svelte-kit sync && svelte-check`. Note the `|| echo ''` swallows a sync failure; consider failing loudly in the Kit plan so a broken tsconfig is not hidden. `$app/tsconfig` also drops `allowJs`/`checkJs`/`esModuleInterop` from the repo's `tsconfig.json` (the codemod removed them); the repo relies on `checkJs` for its `.js` modules, so confirm `svelte-check` still type-checks the `*.js` files or restore the flags.

### Pitfall 8: The live-smoke 429 (lead, not yet measured)
**Evidence from run 42950864036 (commit `11b58f9`):** 121 specs, 2 workers; specs 1-108 pass in 33 s; specs 109-111 (`third-party.smoke.ts` `/agent/contact/`, `/agent/import/`, `/agent/profile/`) answer 429 at `page.goto`. Log lines show `precache: 379 entries installed after 3.4-7.6 s` for each service-worker spec.
**Lead:** `third-party.smoke.ts` navigates every route (about 45) in a fresh context; each page load auto-registers the service worker, whose install does `cache.addAll` of 379 same-origin GETs. About 45 x (page + 379) is on the order of 17,000 requests from one IP in under a minute, on top of `assets.smoke` and `pwa.smoke` doing the same. GitHub documents no Pages request-rate figure, so the threshold is unknown [ASSUMED]. Confirm first by counting requests per spec (`context.on('request')`, including worker-originated ones) on the local emulator.
**Fix direction (zero retries, no hidden waits):** set `serviceWorkers: 'block'` in the smoke config (or `test.use` per spec) for every spec that is not about the worker (`third-party`, `a11y`, `csp`, `analytics`, `seo`, `routing`, `extension-link`), leaving `pwa.smoke.ts` and `assets.smoke.ts` on `'allow'` and ensuring only one of them installs per run; then, only if the measured live run still trips, space navigations on the live target (guard on `SMOKE_BASE_URL` being non-loopback) rather than lowering workers globally. The relabel (exit 2 on any 429 navigation) is separate and still required. The scripts-project unit test plants a 429 response and asserts exit 2 and that a 500 stays exit 1. Note `workers: process.env.CI ? 2 : 4` is also the 15-REVIEW WR-07 finding; do not touch it for the local run.

### Pitfall 9: Guard rules that a migration commit could use to go green (15-REVIEW)
CR-01/WR-02/WR-03/WR-04 as scoped in D-08. Specific to this phase: Vitest 5 changes `expect.poll`/timeout behaviour and `vi.waitFor`, so the temptation to add `timeout: 0` or a shared `opts` object is real; the new guard must flag `0`, non-literal option arguments, `page.setDefault*Timeout`, `testInfo.setTimeout/slow`, `tooling/vitest/lanes.ts` `serialTest()`, CLI flags `--testTimeout/--timeout/--workers/--retry` in package.json scripts and workflows, and `continue-on-error`/`||` re-runs on test steps. WR-05 (pin satisfied by a comment) is also cheap to fix and matters because `apps/web/vite.config.ts` will be rewritten in 16-02: replace the `toContain("files('web')")` substring pin with a behavioural check that imports the config and asserts `exclude` contains every `files(lane)` entry. WR-08 (`VITEST_MAX_WORKERS` refusal only in the root config) is a one-line move into `serialTest()`.

### Pitfall 10: Shallow routing semantics
5 `replaceState` call sites (`ContactsView`, `StageBoard`, `AnalyzerPage`, `SearchPage`, `(app)/+layout`). The codemod turns them into un-awaited `goto(url, { shallow: true, replace: true, state: page.state })` and, in the layout, adds `if (nav.shallow && nav.type === 'goto') return;` to the `afterNavigate` handler. In Kit 3 shallow navigations *do* fire `beforeNavigate`/`onNavigate`/`afterNavigate`, so any handler that reacts to navigation can now loop on its own URL rewrite. Re-test each site by its E2E (sample handoff, search URL mirroring, saved list state) and keep the guard in every `afterNavigate` that coexists with a shallow replace.

## Code Examples

### JSON reporter path used by `audit-evidence.mjs` (verified on Vitest 5.1.0)
```bash
# Source: spike; works for Node projects and the browser project, writes the file, exit code preserved
vitest run --reporter=dot --reporter=json --outputFile.json=<path>
```
[CITED: vitest.dev/config/outputfile] documents `--outputFile.json=./path`; Vitest 5's `json` reporter writes `.vitest/json/output.json` by default and only prints with `stdout: true`, so keeping the explicit `--outputFile.json=` is correct.

### Per-project serial lane in one invocation (verified on Vitest 5.1.0)
```ts
// Source: spike v5/vitest.config.ts -- 4 files in 'par' ran concurrently, then 4 files in 'ser' one at a time (offsets 0.9 s apart)
projects: [
  { test: { name: 'par', include: ['a/*.test.ts'] } },
  { test: { name: 'ser', include: ['b/*.test.ts'], fileParallelism: false, maxWorkers: 1, sequence: { groupOrder: 1 } } }
]
```
The repo already runs its lanes this way (`vitest.config.ts` + `serialTest()`), as a single `vitest run`; `scripts/lane-order.test.ts`, `test-lanes.test.ts` and `test-lane-rules.test.ts` (146 tests) pass on 5.1.0 in the spike. So the roadmap's "groupOrder single-invocation experiment" is already the shipped design; Plan 16-03 only re-verifies it.

### Kit 3 form of the root pathname
```svelte
<!-- Kit 2 --> <a href={resolve('/')}>      <!-- Kit 3 --> <a href={resolve('')}>
<!-- Kit 2 --> resolve('/renter/')            <!-- Kit 3 --> resolve('renter/')
<!-- route IDs keep the slash --> resolve('/(app)/renter')
```
[CITED: svelte.dev/docs/kit/migrating-to-sveltekit-3; Kit 3.1.1 `resolve()` source]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `svelte.config.js` | `sveltekit({...})` in `vite.config.*` | Kit 3.0 (2026-10-01) | Tests that import the config need a plugin-free module |
| `$lib` alias | `#lib` via package.json `imports`, explicit extensions | Kit 3.0 | 1,265 `$lib` lines in 445 files; Vite resolves `#lib/*` natively (the Vitest alias is no longer needed) |
| `$service-worker` | `$app/manifest` + `$app/env` | Kit 3.0 | Worker rewrite, `serviceWorker.files` gone |
| `$app/environment` | `$app/env` | Kit 3.0 | 2 files |
| `replaceState` | `goto(..., { shallow: true, replace: true })` | Kit 3.0 | 5 sites |
| pnpm JS bundle | pnpm 12 native Rust binary | 12.0 (2026-08-26) | `npm_execpath` form, lockfile boot document, `ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS` when pin satisfied |
| `vitest-browser-svelte` sync `render` | async `render` | 3.x | 7 real call sites |
| `.vitest-attachments/` | `.vitest/attachments/` | Vitest 5 | `.gitignore` |

**Deprecated/outdated claims in earlier research:** "pnpm 12 keeps the pnpm 11 lockfile/commands so upgrading is trivial" (CLAUDE.md, STACK.md) -- true for the lockfile body, false for `npm_execpath`; "Rolldown chunking is the likeliest budget red" -- the growth is the Kit 3 client runtime, not the bundler; "16 of 140 web `render(` calls plus the extension's 6" -- the real web figure is 1; "Kit 3 clears three of four exceptions, leaving deepmerge" -- five exist and two remain; `/_app/version.json` open question -- resolved (path and shape unchanged).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The GitHub Pages / Fastly rate limit trips on request volume from one IP over a short window, and the per-page service-worker precache (about 379 GETs x ~45 fresh-context page loads) is the dominant source | Pitfall 8 | The pacing fix addresses the wrong cause and the live run still 429s; mitigated by measuring request counts first and verifying with a live dispatch before the baseline gate |
| A2 | slopcheck would return OK for the eight version-bumped packages | Package Legitimacy Audit | Low: all are long-lived, high-download packages already in the lockfile; compensating control is the lockfile diff review |
| A3 | A 4.2 KB trim of the shared initial JS is achievable without feature loss | Pitfall 4 | If not, D-04 cannot be met; plan must escalate rather than raise the budget |
| A4 | `eslint-plugin-svelte` 3.23.0 silently disables `no-navigation-without-resolve` on Kit 3 (inferred from the 3.23.1 changelog wording, not run) | Pitfall 6 | If it works on 3.23.0, the bump is merely routine; the planted-case proof settles it either way |
| A5 | `$app/tsconfig` dropping `allowJs`/`checkJs` reduces type coverage of the repo's `.js` modules | Pitfall 7 | If `$app/tsconfig` already sets them, no action; check in the first Kit task |
| A6 | `shadcn-svelte` 1.6.1 `add` handles a `#lib/...` `components.json` without writing `$lib` back | Standard Stack (Supporting) | Not dry-run (changelog says auto-detect since 1.6.0); one `add --dry-run` in the Kit plan settles the roadmap flag |

## Open Questions

1. **How to recover 4.2 KB of initial JS after Kit 3?**
   - What we know: growth is in the Kit client chunk (+4.1 KB gz), identical on 3.1.1 and 3.2.0, unaffected by `pollInterval`.
   - What's unclear: which app-side imports in the shared initial chunk can be deferred, and whether any Kit config flag drops client code.
   - Recommendation: dedicated forensic task with sourcemap attribution before any other Kit work is declared done; escalate to the owner with numbers if blocked.
2. **Does the live Pages CDN's 429 threshold allow the paced run?**
   - Recommendation: 16-00a measures request counts locally, applies `serviceWorkers: 'block'`, then dispatches `live-smoke` on the pre-flight commit until it is green on its own (the D-09 baseline gate is the verification).
3. **Reword TOOL-05 and ROADMAP criterion 5/3.** TOOL-05 should read "five -> two (deepmerge, minimatch)"; minimatch cannot clear (ESLint 10.14.0 and typescript-estree 8.72.2 still depend on `minimatch ^10.2.x`; minimatch 11.0.7 exists). Its `revisitBy` of 2026-11-30 falls inside the phase window: refresh it with the check date. Needs owner awareness (requirement text), not a decision.
4. **`typescript-eslint` / ESLint family bumps** (routine plan): `typescript-eslint` is at 8.70.0 and 8.72.2 exists; unrelated to the migration, keep out of the three major plans.
5. **Dependabot dependency-graph proof** after the pnpm 12 push is an owner-visible check (cannot be read from the repo).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | yes | 24.18.0 (repo `engines` `>=24 <25`; Kit 3 needs `>=22.17`, Vitest 5 `^22.12 \|\| ^24 \|\| >=26`) | -- |
| pnpm (global) | install | yes | global 11.x self-switches to the pinned 12.18.0 | `corepack pnpm` (corepack 0.35.0 downloads the 12.18.0 binary, verified) |
| Chromium for Playwright | `ext:*`, browser tests, smoke | yes | `ms-playwright` cache holds chromium 1223-1243 | -- |
| gh CLI | live-smoke run lookup/dispatch | yes | authenticated (read worked) | -- |
| gitleaks | `precommit.test.ts`, `secrets:*` | not probed | CI installs a pinned binary | machine-local per earlier phases |
| WLAN stability | long browser runs | machine-dependent | Intel BE201 drops (lessons 2026-11-10) | require 10 min without event 8003 before `pnpm verify` |

**Missing dependencies with no fallback:** none found.
**Missing dependencies with fallback:** slopcheck (install denied; see Package Legitimacy Audit).

## Validation Architecture

> Nyquist validation is enabled (`workflow.nyquist_validation: true`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.12 now (5.1.0 after 16-03), Playwright 1.63.0 (e2e + smoke) |
| Config files | root `vitest.config.ts` (10 projects), `apps/web/vite.config.ts`, `apps/web/vitest.browser.config.ts`, `*-serial` configs, `apps/web/playwright.config.ts`, `apps/web/playwright.smoke.config.ts` |
| Quick run command | `pnpm exec vitest run <file>`; per-project `pnpm exec vitest run --project web --project scripts` (name `*-serial` projects explicitly) |
| Full suite command | `pnpm verify` (chain: check, lint, banned, ui:guard, test:unit, build x3, csp/seo/budget assert, test:e2e, smoke:local, audit:deps, guard, fixtures:check, secrets x2, lint:workflows, ext:build/assert/test:browser/e2e) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOOL-01 | pin is 12.x, no `11.27.0` literals, lockfile two-document shape, frozen install | unit + install | `pnpm exec vitest run scripts/supply-chain.test.ts scripts/launch-audit.test.ts scripts/pnpm-cmd.test.ts`; `pnpm install --frozen-lockfile`; `git grep -n "11\.27\.0" -- scripts package.json` returns nothing | supply-chain, launch-audit: yes (rewrite); `pnpm-cmd.test.ts`: Wave 0 |
| TOOL-01 | all four spawners work with a native `npm_execpath` | unit (both branches) + e2e | `pnpm exec vitest run scripts/pnpm-cmd.test.ts`; `pnpm build:root` (real) | Wave 0 |
| TOOL-02 | `$lib`, `$service-worker`, `@migration-task`, `$app/environment`, `svelte.config.js` greps = 0 outside planning docs and planted fixtures | grep gate | `git grep -nF '$lib' -- apps scripts tooling eslint.config.js` -> only allowed planted strings; `git grep -n "@migration-task\|\$service-worker\|\$app/environment\|\$app/stores"` | new `scripts/kit3-migration.test.ts` (Wave 0) wraps these greps |
| TOOL-02 | ESLint boundary groups non-vacuous under `\#lib` | unit (planted violations) | `pnpm exec vitest run scripts/eslint-rules.test.ts scripts/agent-boundary.test.ts` | yes (rewrite samples to `#lib`, add a `\#`-escape non-vacuity case that fails if a group is written unescaped) |
| TOOL-02 | boundary regex tests still bite | unit + mutation | `pnpm exec vitest run apps/web/src/lib/features/investor/data/investor-port.test.ts apps/web/src/lib/features/investor/analyzer/analyzer-page.svelte.test.ts apps/web/src/lib/ai/ui/key-card-additions.test.ts apps/web/src/lib/features/studio/boundaries.test.ts` + a planted `#lib/data/x.ts` import per test | yes; planted cases to add |
| TOOL-02 | `kit.options.js` is plugin-free and shared | unit | `pnpm exec vitest run apps/web/src/lib/csp-policy.test.ts apps/web/src/lib/ai/models.test.ts scripts/site-url.test.ts scripts/service-worker-guard.test.ts` | yes (re-point) |
| TOOL-02 | three builds pass oracles, budget <= 60 KB | build + assert | `pnpm build:root && pnpm build:sub && pnpm build:configured && pnpm csp:assert && pnpm seo:assert && pnpm budget:assert` | yes |
| TOOL-02 | `resolve()` forms, `$app/env`, shallow routing | typecheck + e2e | `pnpm check`; `pnpm --filter web exec playwright test --project=root` | yes |
| TOOL-03 | worker filter excludes dotfiles, maps through resolve/asset, allowlist-only shape | unit | `pnpm exec vitest run scripts/service-worker-guard.test.ts` (flip REQUIRED/FORBIDDEN; call exported filter) | yes (rewrite) |
| TOOL-03 | registration scope = base, `caches.keys()` = `[tran-shell-<sha>]`, no dotfiles, `renter/` and manifest precached | local smoke | `pnpm smoke:local` (all three targets; spike `sub` target 121/121) | yes (`pwa.smoke.ts`) |
| TOOL-03 | same, on the real CDN | **live only** | `live-smoke` run on the pushed commit | yes |
| TOOL-04 | zero bare `render(` in files importing `vitest-browser-svelte` | grep gate | scoped assertion inside `scripts/vitest5-migration.test.ts` (Wave 0): for each file importing `vitest-browser-svelte`, every `render(` is preceded by `await` | Wave 0 |
| TOOL-04 | exact-text and locator semantics accounted for | browser | `pnpm exec vitest run --project web-browser --project web-browser-serial`; `pnpm ext:test:browser` | yes (edit tests) |
| TOOL-04 | JSON reporter path | integration | `node scripts/audit-evidence.mjs unit smoke-check <one fast file>` writes `apps/web/test-results/unit-smoke-check.json` with `numTotalTests > 0` | script yes; add a test asserting the shard JSON has `testResults` |
| TOOL-04 | lanes still ordered/serial | unit | `pnpm exec vitest run scripts/lane-order.test.ts scripts/test-lanes.test.ts scripts/test-lane-rules.test.ts` (146 tests green on 5.1.0 in spike) | yes |
| TOOL-04 | extension project under WXT | unit | `pnpm exec vitest run --project extension` (spike: 17 files / 242 tests) | yes |
| TOOL-05 | exceptions lists equal and shrunk; audit clean | unit + audit | `pnpm exec vitest run scripts/supply-chain.test.ts`; `pnpm audit --audit-level low` -> "2 ignored" | yes (update expected count) |
| TOOL-06 | each step gated, phase closed by deploy + green live smoke | process | per-plan: `pnpm verify` + `pnpm smoke:local`; after push: `gh run list --workflow live-smoke` shows success for the pushed SHA | n/a |
| Pre-flight | 429 relabel | unit | `pnpm exec vitest run scripts/smoke.test.ts` (planted 429 -> exit 2; 500 -> exit 1) | extend existing smoke tests |
| Pre-flight | guard hardening, mutation-tested | unit + mutation | `pnpm exec vitest run --project scripts --project scripts-serial scripts/test-lane-rules.test.ts scripts/test-lanes.test.ts`; plant each bypass (`{ timeout: 0 }`, shorthand retries, `page.setDefaultTimeout`, `serialTest()` retry, `--timeout=` flag) and see the rule fail | yes (add cases) |

### Gate After Each Toolchain Step

Run on a clean checkout of the plan's commit, in this order, with all three builds rebuilt (build stamp = HEAD makes stale builds fail `smoke:local`):
1. `pnpm install --frozen-lockfile` (proves the lockfile)
2. `pnpm verify` (full chain, includes `smoke:local` against all three emulated builds)
3. push (owner-approved), CI green, then `live-smoke` for that SHA (retries 0; exit 2 = 429 -> re-dispatch once)
4. record run links in the plan summary

### What Only the Live Origin Can Prove
- `https://wolfwdavid.github.io/tran_real_estate/` serves the Kit 3 worker: registration with scope `https://wolfwdavid.github.io/tran_real_estate/`, script URL `.../service-worker.js` (type module), `caches.keys()` equals `['tran-shell-<40-hex sha>']`, precache contains no dotfile (Pages never serves `.nojekyll`, so an unfiltered worker fails `cache.addAll` only there) and does contain `manifest.webmanifest` and `renter/`. The emulator already 404s dotfiles (Phase 14), so the live run is the CDN/Content-Type/propagation confirmation, not the first catch.
- `_app/version.json` propagation (`{"version": sha}`) through Fastly (`max-age=600`).
- The 429 behaviour of the paced run (cannot be exercised locally).
- Dependabot's dependency graph reading the two-document lockfile (owner-visible).
- Stale-worker behaviour for returning visitors (fresh context only in the smoke; owner uses an InPrivate window).

### Sampling Rate
- **Per task commit:** the narrowest relevant `vitest run <files>` plus `pnpm check` for Kit tasks.
- **Per wave/plan merge:** `pnpm verify` + `pnpm smoke:local`.
- **Phase gate:** full `pnpm verify` green on Vitest 5, evidence protocol re-run (new dated file under `docs/test-evidence/`), `docs/LAUNCH-AUDIT.md` regenerated at the deployed commit, green live smoke.

### Wave 0 Gaps
- [ ] `scripts/lib/pnpm-cmd.mjs` + `scripts/pnpm-cmd.test.ts` (both `npm_execpath` forms; fails if another script re-inlines the old pair)
- [ ] `scripts/kit3-migration.test.ts` (zero-grep gates for `$lib`, `$service-worker`, `$app/environment`, `@migration-task`, `svelte.config.js`; allowlist for planted fixtures)
- [ ] `scripts/vitest5-migration.test.ts` (scoped bare-`render` assertion; `.vitest/` ignored)
- [ ] ESLint `\#` non-vacuity case in `scripts/eslint-rules.test.ts`
- [ ] Planted-case rows for the regex-over-source boundary tests listed in Pitfall 3/Anti-patterns
- [ ] Smoke 429 relabel test (extend the existing smoke script tests)
- [ ] Budget forensic helper (throwaway script is acceptable; do not commit unless reused)

## Security Domain

> `security_enforcement` is not set to false; included. This phase changes tooling, not request handling; the relevant controls are supply-chain and CSP/boundary integrity.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication / V3 Session Management | no | static site, no sessions |
| V4 Access Control | no (architectural boundaries are import-level) | ESLint `no-restricted-imports` + import-graph walker -- must stay non-vacuous (Pitfall: `\#lib`) |
| V5 Input Validation | no change | existing zod boundaries untouched |
| V6 Cryptography | no change | key vault untouched |
| V10 Malicious Code / V14 Configuration (supply chain) | yes | pinned `packageManager`, committed two-document lockfile, `pnpm audit` gate with reviewed exceptions equal in two files, SHA-pinned actions, Dependabot, gitleaks |
| CSP integrity | yes | `kit.options.js` -> `buildCsp`; `csp:assert` on 3 builds; service worker allowlist-only (no runtime caching, same-origin GET only) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hallucinated / typosquatted dependency during bumps | Tampering | exact pins, lockfile diff review (names unchanged), `pnpm audit`; slopcheck was unavailable |
| Silent loss of boundary lint (`#` group = comment) | Tampering / Elevation | `\#lib` escape + planted-violation sweep in `eslint-rules.test.ts` |
| Service worker caching cross-origin or key-bearing responses | Information disclosure | keep the early return on `url.origin !== sw.location.origin` and the guard test's REQUIRED/FORBIDDEN lists (flipped, not weakened) |
| Dependabot blind to the real dependency graph (two-document lockfile) | Repudiation (alerts lost) | upstream fix 2026-11-03; verify the dependency graph once after the push |
| Advisory exceptions outliving their reason | Tampering | `AUDIT_EXCEPTIONS` and `pnpm-workspace.yaml audit.ignore` stay equal (`supply-chain.test.ts`); remove three Kit entries; refresh minimatch `revisitBy` |
| Timeouts/retries raised to mask a migration regression | Tampering (test integrity) | 16-00 guard hardening, each bypass mutation-tested |

## Plan Sequence Recommendation (for the planner)

| Plan | Scope | Gate to leave |
|------|-------|---------------|
| **16-00a** Live-smoke 429 | measure per-spec request counts; `serviceWorkers: 'block'` for non-SW specs (live and local, requests drop everywhere; local stays fast); exit-2 relabel in `scripts/smoke.mjs` + test; pace live only if still tripped | unit tests green, local smoke still ~30 s/target |
| **16-00b** Guard hardening | CR-01, WR-02, WR-03, WR-04; cheap extras WR-05 (behavioural exclude pin; the config is rewritten next) and WR-08; each with a planted bypass | mutation proof table in the summary |
| **Baseline gate (D-09)** | `pnpm verify` green on Kit 2 / Vitest 4 at the 16-00 commit; push; one `live-smoke` green on its own; run link in the summary | owner-approved push |
| **16-01** pnpm 12.18.0 | `scripts/lib/pnpm-cmd.mjs` + 4 call sites; pin; ONE non-frozen install; supply-chain test rewrite (two documents); read pin from `package.json` in `build-web.mjs` and `launch-audit.test.ts`; docs (`README`, `CLAUDE.md` stack row, `RUNBOOK`, `LAUNCH-AUDIT` regenerated, lessons note); Dependabot `pnpm` major ignore kept until after the phase | frozen install + `pnpm verify` + smoke:local; push + live smoke |
| **16-02** Kit 3.1.1 | ordered task groups, one commit each: (1) pins incl. svelte/vite-plugin-svelte/svelte-check/runed/eslint-plugin-svelte/adapter-static, tsconfig prerequisite; (2) `kit.options.js` + `vite.config.ts`, delete `svelte.config.js`, re-point the 5 string/import users; (3) `environment`, `paths`, `app-state`, `imports`, `external-redirects`, `params`; (4) `shallow-routing` + per-site re-test; (5) `lib-alias` codemod then hand fixes (2 dynamic imports, ~10 type queries, 14 `resolve('/')`, ReadonlyURL, stub); (6) non-codemod `#lib` users: `eslint.config.js` (`\#lib`), `tooling/import-graph.ts`, `src/lib/ai/import-graph.ts`, `scripts/*.test.ts`, regex boundary tests, `components.json`, Vitest alias removal; (7) service worker + guard flip; (8) budget forensic/trim; (9) audit exceptions 5 -> 2 in both files, `LAUNCH-AUDIT.md`, ROADMAP/REQUIREMENTS wording | per-group: `pnpm check` + build + targeted tests; plan: `pnpm verify`, smoke:local; push; live smoke shows `tran-shell-<sha>` |
| **16-03** Vitest 5.1.0 | all five pins in one lockfile commit; `await render` (7 sites); `toHaveTextContent` -> `toMatchTextContent` where partial (6 files, 40 uses); `locators.exact` fix(es); `clearMocks` audit; `.vitest/` ignore; `--outputFile.json=` check; extension project + `pnpm ext:test:browser`; lane tests; new dated `docs/test-evidence/`; `scripts/test-evidence.test.ts` follows | `pnpm verify` green; push; live smoke |
| **16-04** Routine bumps | Playwright 1.65.0, axe, bits-ui 2.21.0, layerchart 2.10.0, shadcn CLI 1.8.0, wxt 0.21.5, ESLint family (typescript-eslint 8.72.2), supersede Dependabot #9/#10, revisit the Kit-major ignore | `pnpm verify`; push; live smoke; phase close |

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`, 2026-11-10): pnpm 12.18.0 (`latest`, 2026-11-05; 12.19.0 `next-12`), @sveltejs/kit 3.1.1 / 3.2.0, adapter-static 4.0.1, sv 1.3.0, svelte 5.57.3, vite-plugin-svelte 7.3.1, svelte-check 4.7.8, runed 0.38.0, vitest 5.1.0, @vitest/browser-playwright 5.1.0, vitest-browser-svelte 3.1.0, wxt 0.21.5, eslint-plugin-svelte 3.24.1, shadcn-svelte 1.8.0, bits-ui 2.21.0, layerchart 2.10.0, @playwright/test 1.65.0
- Tarballs read: `@sveltejs/kit@3.1.1` (`version.json` emit path and shape, `$app/manifest` contents via `walk()`, `resolve()`/`asset()` source, `svelte-kit sync`), `sv@1.3.0` (12 migration task ids, `lib-alias`, `paths`, package-json minimums)
- Kit docs: svelte.dev/docs/kit/migrating-to-sveltekit-3, /service-workers, /$app-manifest, /configuration
- Vitest docs: vitest.dev/guide/migration, /config/outputfile, /guide/reporters
- pnpm 12 release notes: pnpm.io/blog/releases/12.0
- Scratch reproductions (this session): pnpm 12.18.0 `npm_execpath` and lockfile regen; `sv migrate` runs; Kit 3.1.1/3.2.0 builds with csp/seo/budget assertions; `svelte-check` census; ESLint 10.10.0 `#` group probe; Vitest 5.1.0 json reporter, per-project workers, browser project (208 tests), extension project (242 tests), lane tests (146); local `smoke:local` sub target 121/121 with the spike service worker; `pnpm audit` with three exceptions removed
- Repo (internal): `package.json`, `pnpm-workspace.yaml`, `scripts/lib/audit-exceptions.mjs`, `apps/web/{svelte.config.js,vite.config.ts,vitest.browser.config.ts,src/service-worker.ts,tests/smoke/*,playwright.smoke.config.ts}`, `tooling/vitest/lanes.ts`, `scripts/{build-web,smoke,audit-evidence,launch-audit,supply-chain.test,service-worker-guard.test,eslint-rules.test}`, `.github/workflows/{ci,live-smoke}.yml`, `.planning/phases/15-*/{15-REVIEW,deferred-items}.md`, live-smoke run 42950864036 log

### Secondary (MEDIUM confidence)
- dependabot-core issue #15904 (closed 2026-11-03) and #14794/#14919 via `gh api`; GitHub changelog 2026-10-20 (Dependabot version updates for pnpm 11/12, silent on alerts)
- eslint-plugin-svelte and shadcn-svelte CHANGELOGs (raw GitHub)
- pnpm/action-setup releases (v6.1.0 "support pnpm v12")

### Tertiary (LOW confidence)
- GitHub Pages / Fastly request-rate limit (undocumented; inferred only from the observed 429 onset)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- registry + tarballs + spike installs
- Architecture / migration mechanics: HIGH -- reproduced in a scratch copy of HEAD
- Pitfalls: HIGH for 1, 2, 3, 5, 7 (reproduced); MEDIUM for 6, 8 (inferred); LOW for the trim path in 4
- Validation architecture: HIGH for commands that exist today; new test files are Wave 0

**Research date:** 2026-11-10
**Valid until:** 2026-11-17 for version pins (Kit, Vitest, pnpm all shipped patches within the last week); structural findings stable for 30 days
