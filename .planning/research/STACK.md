# Stack Research

**Domain:** Launch & hardening of an existing static, browser-only SvelteKit + MV3 extension monorepo (milestone v1.1 of Tran Real Estate Tools)
**Researched:** 2026-10-29
**Confidence:** HIGH for every version and peer range (pulled live from the npm registry, the Kit 3.1.0 / sv 1.1.1 tarballs and official docs today); MEDIUM where noted (Edge Add-ons API tier eligibility, GitHub Pages header behaviour, a few Vitest 5 CLI flag forms)

This file covers only what is NEW for v1.1. The validated v1.0 stack (SvelteKit + adapter-static, TypeScript 6.x, Tailwind 4 + shadcn-svelte, Dexie, Vitest browser mode, Playwright + axe, pnpm workspace, SHA-pinned Actions, hash-mode meta CSP, Umami beacon, Web3Forms, WXT MV3) is fixed and is documented in `.planning/milestones/v1.0-research/STACK.md`. Nothing below re-litigates those choices.

---

## Headline Findings (read first)

1. **SvelteKit 3 is stable, not RC any more.** `@sveltejs/kit@3.0.0` shipped 2026-10-01, `3.1.0` on 2026-10-14 and is the npm `latest`. `@sveltejs/adapter-static@4.0.0` is `latest` and its only breaking change is "requires Kit 3". `sv@1.1.1` ships the task-based `sv migrate sveltekit-3` codemod with eleven tasks, including `lib-alias` (`$lib` to `#lib`), `imports` (explicit extensions), `paths` (leading-slash removal), `svelte-config` (moves config into `vite.config.ts`) and `shallow-routing`. The v1.0 research's two blockers (RC status, shadcn-svelte `#lib` support) are both gone: shadcn-svelte CLI 1.6.0 (2026-09-01) auto-detects `#lib` subpath imports. (HIGH)
2. **Kit 3 touches this repo in five concrete places, three of them non-obvious.** (a) `svelte.config.js` is no longer read by Kit: `adapter`, `paths`, `prerender`, `csp`, `serviceWorker` move into `sveltekit({...})` in `apps/web/vite.config.ts`, and `prerender.origin` becomes `paths.origin`. (b) `kit.serviceWorker.files` (the dotfile filter that keeps `/.nojekyll` out of the precache) **no longer exists**; the Kit 3 type is `{ register: true; options? } | { register?: false }` only. (c) `$service-worker` is deleted; `apps/web/src/service-worker.ts` must import `immutable`/`assets`/`prerendered` from `$app/manifest`, `version` from `$app/env`, `resolve` from `$app/paths` and `self` from `$app/service-worker`, move to `src/service-worker/index.ts` with its own `tsconfig.json`, and `scripts/service-worker-guard.test.ts` currently REQUIRES `from '$service-worker'` and FORBIDS `$app/service-worker`, so the guard flips. (d) `$app/paths` loses `base`/`assets` (one importer: `AppNotice.svelte`) and the pathname form of `resolve()` drops the leading slash: the repo's 74 import sites / 45 distinct literals like `resolve('/settings/')` become `resolve('settings/')`; the codemod strips static leading slashes except `'/'`, and the Kit 3 `Path` type still includes the trailing-slash forms because the root layout sets `trailingSlash: 'always'`. (e) `$lib` becomes `#lib` with required extensions across 1,061 import statements in 412 files, plus `components.json`, the ESLint `no-restricted-imports` groups, two script tests and the Vitest `$lib` alias. (HIGH, from the 3.1.0 tarball types and `sv` 1.1.1 source)
3. **Kit 3 clears three of the four audit exceptions, not four.** `@sveltejs/kit@3.1.0` depends on `cookie ^2.0.1` (GHSA-pxg6-pf52-xh8x gone) and fixes GHSA-pfhg-q3qv-9q6r and GHSA-27mw-82g8-phjj. `@sveltejs/vite-plugin-svelte@7.3.1` (latest) still depends on `deepmerge ^4.3.1`, so GHSA-gcqx-w48m-w2h4 stays with its 2027-01-31 revisit. `supply-chain.test.ts` enforces equality between `scripts/lib/audit-exceptions.mjs` and `pnpm-workspace.yaml` `audit.ignore`, so both shrink in one commit. (HIGH)
4. **Vitest 5.0.5 is seven weeks old and the browser companions have caught up.** `@vitest/browser-playwright@5.0.5` (exact-pinned to the Vitest version) and `vitest-browser-svelte@3.1.0` (peers `vitest ^4 || ^5`, `render` is now async) are current. The determinism tools the milestone needs already exist in Vitest 4.1+ and survive in 5: per-project `isolate`, `fileParallelism`, `execArgv`, `sequence.groupOrder` (lower groups run first, equal groups run together), and object-form `retry: { count, delay, condition: RegExp }` for conditional, non-blind retries. `poolOptions`, `minWorkers`, `singleThread`/`singleFork` were removed in Vitest 4; `maxWorkers` (number or `'50%'`) replaced them, and in run mode its default is **all** available parallelism, which matches the memory-reaper symptom recorded in STATE. (HIGH)
5. **pnpm 12 is a drop-in for this repo.** Verified by running `pnpm@12.16.1` against a copy of this repo's `pnpm-workspace.yaml` keys (`packages`, `allowBuilds`, `engineStrict`, `audit.ignore`): no `ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS`, `lockfileVersion: '9.0'` unchanged, `--frozen-lockfile` passes. npm `latest` now points at 12.16.1 (2026-10-27); the package ships platform binaries through `optionalDependencies` (`@pnpm/exe.*`), `pnpm/action-setup@v6` documents pnpm 12 support and reads `packageManager`, and Corepack is still bundled in Node 24 (removed from Node 25). Expect a one-time lockfile diff (the `settings:` block disappears, `configDependencies`/`packageManagerDependencies` keys appear, cyclic peer variants may re-key). (HIGH, probe-verified)
6. **The live-origin smoke suite needs zero new dependencies.** Playwright 1.64.1 plus Node builtins cover every deferred check: `request.get(url, { maxRedirects: 0 })` for the 301 trailing-slash and 404 status checks, `context.waitForEvent('serviceworker')` + `navigator.serviceWorker.ready` for SW registration, a `securitypolicyviolation` collector plus `meta[http-equiv]` text for CSP, `page.waitForResponse()` on `${host}/api/send` for the Umami beacon (Playwright reports the real status even for a `no-cors` fetch), and `scripts/assert-seo.mjs`'s existing regex + PNG-header parsing for share cards. Two owner facts shape the design: Umami Cloud's free **Hobby plan has no API access** (so dashboard receipt stays a human row; the suite proves delivery at the HTTP layer), and Web3Forms has no sandbox key (a live submission costs 1 of 250/month, so it is opt-in behind an env var). (HIGH for the APIs, MEDIUM for Umami plan limits from the pricing page)
7. **Edge Add-ons: free account, manual first publish, API only for updates.** Registration has "no registration fee" (official). The Update REST API (v1.1, `Authorization: ApiKey` + `X-ClientID`) exists but "to initially publish a new extension, you use Partner Center"; there is no endpoint to create a product or edit metadata. Listing assets: logo 300x300 (min 128), up to 6 screenshots at exactly 640x480 or 1280x800, optional tiles 440x280 and 1400x560, description 250-10,000 characters, up to 7 search terms / 21 words. Certification up to 7 business days. The existing `extension-release.yml` + `wxt zip` already produce the right package shape. (HIGH)

---

## Recommended Stack

### Core Technologies (toolchain phase: versions to move to)

Current pins are quoted from the repo's `package.json` files on 2026-10-29.

| Technology | Current pin | Move to | Purpose | Why Recommended |
|------------|-------------|---------|---------|-----------------|
| `@sveltejs/kit` | 2.70.3 | **3.1.0** | App framework | Stable since 2026-10-01; fixes two of the three Kit audit advisories; `runed@0.38` already peers `^3`. Peers: `vite ^8.0.12`, `svelte ^5.57.1`, `typescript ^6.0.0`, `@sveltejs/vite-plugin-svelte ^7.0.0`; engines `node >=22.17`. |
| `svelte` | 5.57.0 (3 places) | **5.57.3** | UI runtime | Kit 3 requires `^5.57.1`; 5.57.3 (2026-10-26) is latest. Bump root, `apps/web`, `apps/extension` together (single version in the lockfile keeps the browser-mode "second Svelte runtime" guard honest). |
| `@sveltejs/adapter-static` | 3.0.10 | **4.0.0** | Static output for Pages | Peers `@sveltejs/kit ^3.0.0-next.0`. Options `pages`/`assets`/`fallback`/`precompress`/`strict` are unchanged; `fallback: '404.html'` still documented for GitHub Pages. |
| `@sveltejs/vite-plugin-svelte` | 7.3.0 | **7.3.1** | Svelte in Vite | Patch (2026-09-23). Still ships `deepmerge ^4.3.1`, so the GHSA-gcqx exception survives. |
| `vite` | 8.3.5 | 8.3.5 (keep) | Build | Already satisfies Kit 3's `^8.0.12`. |
| `typescript` | `~6.0.3` | `~6.0.3` (keep) | Types | Only 6.0.2 and 6.0.3 exist on the 6.x line; Kit 3 peers `^6.0.0` only, `typescript-eslint` `<6.1.0`. `latest` is 7.0.2 and must not be installed. |
| `svelte-check` | 4.7.6 | **4.7.7** | Typecheck `.svelte` | Patch (2026-10-16); peers `typescript ^5 || ^6`. |
| `sv` (run via `npx`, not a dependency) | n/a | **1.1.1** | Migration codemod | `npx sv migrate sveltekit-3` with `--tasks` to run one task per commit. Stable 1.x since 2026-10-01; 1.1.1 on 2026-10-06. Do not use `sv@next`. |
| `vitest` | 4.1.12 (5 places) | **5.0.5** | Unit + browser tests | 5.0.5 (2026-10-15) is the fifth patch since 5.0.0 (2026-09-03). Engines `^22.12 || ^24 || >=26`, Vite `>=6.4`. All five `vitest` pins (root, web, extension, core, brand) move together. |
| `@vitest/browser-playwright` | 4.1.12 (2 places) | **5.0.5** | Browser-mode provider | Peers `vitest 5.0.5` exactly; pin it to the same string as `vitest`. |
| `vitest-browser-svelte` | 2.2.1 (2 places) | **3.1.0** | Svelte render in browser mode | Peers `vitest ^4 || ^5`; 3.x makes `render()` async. The repo already awaits 124 of its 140 `render(` calls; the other 16 need `await`. |
| `pnpm` (`packageManager`) | 11.27.0 | **12.16.1** | Package manager | npm `latest` (2026-10-27); Rust rewrite; same lockfile version; probe-verified against this repo's workspace settings. Also bump `pnpm/action-setup` input only if a `version:` is ever added (today the action reads `packageManager`). |
| Node.js (`.nvmrc` = 24, `engines >=24 <25`) | 24.x | **24.22.2** (keep major) | Runtime | 24 "Krypton" LTS, 24.22.2 released 2026-10-27. Kit 3 needs `>=22.17`, Vitest 5 lists `^24`, Vite 8 `>=22.12`. Node 26 "Lithium" is already LTS (26.13.0) but nothing here needs it; changing the major is out of scope for a hardening milestone. |

### Supporting Libraries (routine bumps, same phase or a quick task)

These are safe patch/minor moves that keep the lockfile current; none is required by Kit 3 or Vitest 5 except `runed`.

| Library | Current | Latest | Purpose | When to bump |
|---------|---------|--------|---------|--------------|
| `runed` | 0.37.1 | **0.38.0** | Svelte 5 utilities | **With Kit 3.** 0.38.0 peers `@sveltejs/kit ^3.0.0` (optional); 0.37.1 peers `^2.21.0` (optional). `layerchart@2.9.1` still depends on `runed ^0.37.1`, so two copies coexist; `bits-ui` already carries a third (`^0.35.1`). Peers are optional, so pnpm warns but does not fail. |
| `bits-ui` | 2.19.2 | 2.20.2 | Headless primitives | Routine. Peers `svelte ^5.33`; no Kit peer. |
| `layerchart` | 2.5.1 | 2.9.1 | Charts | Routine; peers `svelte ^5` only. Re-run the investor dashboard E2E after. |
| `shadcn-svelte` (CLI) | 1.6.1 | 1.7.1 | Copy-in components | 1.6.0 added `#lib` auto-detection; 1.7.0 switched the generated `cn` helper. Bump before regenerating any component post-migration. |
| `@playwright/test` + `playwright` | 1.63.0 | **1.64.1** | E2E + live smoke | 1.64.1 (2026-10-14), Chromium 156. Adds `test.describe.configure({ lock })` and `--shuffle` (useful for proving order-independence). |
| `@axe-core/playwright` + `axe-core` | 4.13.0 | 4.14.0 | Accessibility | Keep the two at the same minor (`@axe-core/playwright` depends on `axe-core ~4.14.0`). |
| `dexie` | 4.4.6 | 4.4.7 | IndexedDB | Patch. |
| `fake-indexeddb` | 6.2.5 | 6.2.6 | Node IndexedDB | Patch (2026-10-16). |
| `wxt` | 0.21.4 | 0.21.5 | Extension build | 0.21.5 (2026-10-26) upgrades `publish-browser-extension` 5 to 6 and fixes zip stats. Its own devDependency is `vitest ^4.1.10`; the `WxtVitest` plugin is a plain Vite plugin, so Vitest 5 is low risk but unverified upstream (see Version Compatibility). |
| `eslint` / `typescript-eslint` / `eslint-plugin-svelte` | 10.10.0 / 8.70.0 / 3.23.0 | 10.13.0 / 8.72.1 / 3.23.1 | Lint | Routine; all still peer `typescript <6.1.0` and `svelte ^5`. |
| `@types/node` | `^24` (24.13.5) | 24.19.2 | Types | Stay on the 24 line to match `engines`; `latest` is 26.6.6. |

Unchanged on purpose: `tailwindcss`/`@tailwindcss/vite` 4.3.3 (latest), `zod` 4.6.7 (latest), `tailwind-merge` 3.7.0 (latest), `fast-check` 4.10.2 (latest), `happy-dom` 21.0.4 (latest), `prettier-plugin-svelte` 4.1.1 (latest), `@wxt-dev/module-svelte` 2.0.5 (latest).

### Development Tools (new capabilities, no new packages)

| Tool | Purpose | Notes |
|------|---------|-------|
| **Second Playwright config** `apps/web/playwright.live.config.ts` | Live-origin smoke suite against a deployed origin | `testDir: 'tests/live'`, **no `webServer`**, `use.baseURL` from `LIVE_ORIGIN` (fail fast if unset or not `https://`), `workers: 2`, `retries: 0`, `fullyParallel: false`, `expect.timeout` 10_000 (CDN latency, not local), `trace: 'retain-on-failure'`. Reuse `tests/e2e/support/network.ts` with `NON_LOCAL` parameterised to allow the live origin and still abort every provider host, so a smoke run can never spend a RentCast or LLM call. Script: `"smoke:live": "pnpm --filter web exec playwright test -c playwright.live.config.ts"`. |
| `APIRequestContext` (Playwright) | Status/redirect/header checks without a browser | `request.get(\`${origin}/renter\`, { maxRedirects: 0 })` expects 301 with `location: /renter/`; `/does-not-exist/` expects 404 and the branded body; `/_app/version.json` 200 proves `.nojekyll` took effect (underscore dirs served); `sitemap.xml`, `robots.txt`, `manifest.webmanifest`, each `og/*.png` 200 with the right `content-type`. Also use it for the Search Console file: `GET /google<token>.html` must be 200 with the exact issued content (file lives in `apps/web/static/`, owner-supplied name). |
| `context.waitForEvent('serviceworker')` + `page.evaluate(() => navigator.serviceWorker.ready)` | SW registration on the real origin | Chromium-only (fine: the suite runs Desktop Chrome). Then `caches.keys()` has exactly one `tran-shell-` key and `context.setOffline(true)` + reload still renders. Note Kit 3 registers with `type: 'module'`. |
| `securitypolicyviolation` init script + `meta[http-equiv="Content-Security-Policy"]` | CSP on the live origin | Reuse `tests/e2e/csp.spec.ts`'s collector. Assert the meta content equals the text `buildCsp()` renders (import `csp-policy.js` directly, the same way `assert-csp.mjs` keeps its literal), and that **no** `content-security-policy` response header is present (GitHub Pages sets none; a header appearing would mean the origin is not Pages). |
| `page.waitForResponse(r => r.url() === \`${host}/api/send\` && r.request().method() === 'POST')` | Umami beacon receipt | Assert `status() === 200` and that no `OPTIONS` preflight was issued. Umami's `/api/send` requires a real `User-Agent`; Playwright's Chromium sends one. Dashboard confirmation stays owner because Hobby has no API. The analytics host comes from `PUBLIC_ANALYTICS_HOST` at build time, so the smoke reads it from the page's CSP meta `connect-src` rather than hard-coding. |
| Opt-in Web3Forms probe (`LIVE_WEB3FORMS_SUBMIT=1`) | Delivery check | Submits one `/feedback/` message with subject prefix `[smoke]`, asserts the JSON `success: true` and the page's success state, and records the ISO timestamp for the owner to match in the inbox. Off by default: each run spends 1 of 250 free submissions and there is no sandbox key. |
| Share-card validation (reuse `scripts/assert-seo.mjs` helpers) | OG/unfurl | Fetch each indexable page from the live origin, regex-extract `og:url`, `og:image`, `canonical` (the oracle already has these patterns), require `og:url === canonical === siteUrl + path`, GET the image, check PNG signature, 1200x630 and `< 200 KB`. LinkedIn Post Inspector / Facebook Debugger require logins and stay owner rows. |
| **`live-smoke.yml`** (new workflow) | Run the suite after a deploy and on demand | `workflow_dispatch` + a `smoke` job that `needs: [deploy]` and passes `${{ needs.deploy.outputs.page_url }}` as `LIVE_ORIGIN`; gated on `vars.PAGES_ENABLED == 'true'`. Use only actions already SHA-pinned in `ci.yml` (`actions/checkout@3d3c42e…`, `pnpm/action-setup@ea17c68…`, `actions/setup-node@8207627…`) so `extension-release-gate.test.ts`'s "no new pins" rule generalises; add a `live-smoke-gate.test.ts` mirroring `workflow-gate.test.ts`. `workflow-gate.test.ts` asserts `ci.yml` has exactly 7 `uses:` lines, so adding the smoke job inside `ci.yml` would need that count updated; a separate file avoids it. |
| Vitest projects split: `timing` group | Deterministic parallel unit runs | Move the ReDoS budget test (`packages/core/src/fair-housing/pattern.test.ts`), the `numRuns: 500` property suites (`numbers.property.test.ts`, `amortization.test.ts`, `money`, `quick-metrics`), and `scripts/precommit.test.ts` (spawns git) into a project with `test.sequence.groupOrder: 1`, `fileParallelism: false`, `isolate: true`; everything else stays `groupOrder: 0`. Set root `maxWorkers: process.env.CI ? '75%' : '50%'` (the run-mode default is 100 %). Use `retry: { count: 1, condition: /ETIMEDOUT|EBUSY|ECONNRESET/ }` only on the `scripts` project for OS-level transient errors; everywhere else `retry: 0`. |
| Playwright determinism knobs (existing `playwright.config.ts`) | Deterministic E2E under load | Keep `fullyParallel` false (default), `workers: process.env.CI ? 2 : '50%'`, `retries: 0` locally and in CI once the known flake (`renter-saved.spec.ts:83`) is fixed; replace instant reads with `expect.poll`/`toPass`; use `test.describe.configure({ mode: 'serial' })` only where tests share IndexedDB state; add `--shuffle` runs (1.64) to the verify chain as a periodic proof. `retryStrategy: 'isolated'` (1.62) is the only acceptable retry mode if retries are ever re-enabled, because it reruns failures alone at the end instead of under load. |
| Extension screenshots via Playwright | Edge listing assets | Generate the 1280x800 screenshots deterministically from the existing synthetic Zillow-like page in `apps/extension/e2e` (`page.setViewportSize({ width: 1280, height: 800 })`, `page.screenshot()`), commit them under `apps/extension/store/screenshots/`. Exactly 640x480 or 1280x800 is enforced by Partner Center. |

---

## Installation

```bash
# 0. Toolchain (Node 24 stays; move pnpm first, in its own commit)
corepack use pnpm@12.16.1          # writes "packageManager": "pnpm@12.16.1" (Corepack is bundled in Node 24)
pnpm install                       # one-time lockfile diff expected (settings block gone, peer cycles re-keyed)
pnpm install --frozen-lockfile     # must pass before continuing

# 1. SvelteKit 3 (one task per commit; read the diff each time)
pnpm dlx sv@1.1.1 migrate sveltekit-3 --tasks            # lists tasks without running
pnpm dlx sv@1.1.1 migrate sveltekit-3 --tasks package-json tsconfig
pnpm dlx sv@1.1.1 migrate sveltekit-3 --tasks svelte-config
pnpm dlx sv@1.1.1 migrate sveltekit-3 --tasks lib-alias imports
pnpm dlx sv@1.1.1 migrate sveltekit-3 --tasks environment paths shallow-routing app-state
pnpm dlx sv@1.1.1 migrate sveltekit-3 --tasks external-redirects params
grep -rn "@migration-task" apps/web/src                   # resolve every marker by hand

# Expected post-codemod pins in apps/web/package.json
pnpm --filter web add -D @sveltejs/kit@3.1.0 @sveltejs/adapter-static@4.0.0 \
  @sveltejs/vite-plugin-svelte@7.3.1 svelte@5.57.3 svelte-check@4.7.7 runed@0.38.0
pnpm -r add -D svelte@5.57.3                               # root + extension too

# 2. Vitest 5 (all five workspaces in one commit; browser companions pinned to the same string)
pnpm -r add -D vitest@5.0.5
pnpm --filter web --filter extension add -D @vitest/browser-playwright@5.0.5 vitest-browser-svelte@3.1.0

# 3. Routine bumps (separate quick task)
pnpm --filter web add -D @playwright/test@1.64.1 playwright@1.64.1 @axe-core/playwright@4.14.0 axe-core@4.14.0 \
  bits-ui@2.20.2 shadcn-svelte@1.7.1 dexie@4.4.6 fake-indexeddb@6.2.6
pnpm --filter web add layerchart@2.9.1
pnpm --filter extension add -D wxt@0.21.5 @playwright/test@1.64.1 playwright@1.64.1 axe-core@4.14.0
pnpm add -D -w eslint@10.13.0 typescript-eslint@8.72.1 eslint-plugin-svelte@3.23.1

# 4. Live smoke (no packages)
LIVE_ORIGIN=https://tranrealestate.github.io pnpm smoke:live
```

### Kit 3 touchpoints in THIS repo (what the codemod will and will not do)

| Surface | Count / location | Codemod task | Manual work |
|---------|------------------|--------------|-------------|
| `svelte.config.js` (adapter, `paths.base`, `prerender.{origin,entries,handle*}`, `serviceWorker.files`, `csp`) | 1 file; imported by `scripts/service-worker-guard.test.ts`, referenced by `csp-policy.test.ts`, `models.test.ts`, `assert-csp.mjs`, `eslint.config.js` | `svelte-config` moves supported keys into `sveltekit({...})`; `prerender.origin` becomes `paths.origin` | Extract the options object to a plain module (e.g. `apps/web/kit.options.js`, importing `base-path.js`, `csp-policy.js`, `site-config.js`) and spread it into `sveltekit(kitOptions)` so the two tests keep importing a plugin-free module instead of `vite.config.ts`. **`serviceWorker.files` has no Kit 3 equivalent**: move the dotfile filter into the worker (`assets.filter(a => !/(^|\/)\./.test(a.path))`) and have the guard test assert that filter in the SW source. |
| `vite.config.ts` `isVitest ? [svelte()] : [tailwindcss(), sveltekit()]` branch | 1 file | none | `sveltekit(kitOptions)`; the Vitest branch's `$lib` alias is replaced by the package.json `imports` map (Vite resolves `#lib/*` natively); keep the `$app/paths` stub alias. |
| `$lib` imports | 1,061 statements / 412 files in `apps/web/src`; `components.json` aliases; `eslint.config.js` `no-restricted-imports` groups (`$lib/data/*`, `$lib/ai/**` boundary); `scripts/agent-boundary.test.ts`, `scripts/eslint-rules.test.ts`; `apps/web/vitest.browser.config.ts` alias | `lib-alias` writes `"imports": { "#lib": "./src/lib/index.js", "#lib/*": "./src/lib/*" }` and rewrites source; `imports` adds explicit extensions | ESLint groups, the two script tests, `components.json` (`shadcn-svelte@1.7.1` reads `#lib` automatically), both Vitest configs. The AI-exit import-graph walk (AI-04) and the `lib/data` boundary must be re-proven with their planted non-vacuity cases after the rename. |
| `$app/paths` `base` | 1 file (`AppNotice.svelte`: `import { base, resolve }`) | `paths` collapses `base + '...'` into `resolve(...)` | Review the generated call. |
| `resolve('/x/')` pathname form | 74 import sites, 45 distinct literals (`/settings/` x20, `/renter/` x14, `/investor/analyze/` x9, ...) | `paths` strips the static leading slash when the literal has no `[` or `(`; `resolve('/')` is left as-is (valid root route ID) | Template literals with dynamic first segments and the test stub `app-paths.stub.ts` (make it prefix `'/'` for pathnames so URL assertions keep passing). Kit 3's generated `Path` type includes `'settings/'`-style members because `trailingSlash: 'always'` is set in `+layout.ts`. |
| `$app/environment` | 2 files (`browser`) | `environment` renames to `$app/env` | none |
| `replaceState` from `$app/navigation` | 6 call sites (`ContactsView`, `StageBoard`, `AnalyzerPage`, `SearchPage`, `(app)/+layout.svelte`, `investor/compare/+page.svelte`) | `shallow-routing` rewrites to `goto(url, { shallow: true, replace: true, state })` | `goto` now rejects URLs that do not resolve to a route; all six are same-route query changes, so they pass, but re-run the investor/agent E2E. |
| `$service-worker` | `apps/web/src/service-worker.ts`; `scripts/service-worker-guard.test.ts`; `scripts/pwa-assets.test.ts` | none (the codemod only adds `@migration-task` markers) | Rewrite imports (`$app/manifest`: `immutable`, `assets`, `prerendered`; `$app/env`: `version`; `$app/paths`: `resolve`; `$app/service-worker`: `self`), map `a.path` through `resolve()` because manifest paths are base-relative, move to `src/service-worker/index.ts`, add `src/service-worker/tsconfig.json` extending `$app/tsconfig/service-worker`, exclude it from the root tsconfig, update the guard's REQUIRED/FORBIDDEN lists (today `$app/service-worker` is forbidden). Registration becomes `type: 'module'`; `tests/e2e/pwa.spec.ts` assertions on scope and controller still hold. |
| `tsconfig.json` `extends ./.svelte-kit/tsconfig.json` | 1 file | `tsconfig` switches to `$app/tsconfig` and adds `include`/`exclude` | `svelte-kit sync` still exists and still runs via `prepare`; it now writes to `node_modules/$app/tsconfig`. |
| `$app/state` `page`, `afterNavigate`, `goto` | 15 + 6 + 4 sites | none needed | `page.url` is `ReadonlyURL`; any `page.url.searchParams.set(...)` must copy into `new URL(page.url)` first (svelte-check will flag). |
| Audit exceptions | `scripts/lib/audit-exceptions.mjs` + `pnpm-workspace.yaml` `audit.ignore` | none | Remove GHSA-pxg6-pf52-xh8x, GHSA-pfhg-q3qv-9q6r, GHSA-27mw-82g8-phjj from both; keep GHSA-gcqx-w48m-w2h4 (deepmerge, `vite-plugin-svelte@7.3.1`). `supply-chain.test.ts` enforces the pair. |

### Vitest 5 touchpoints in THIS repo

| Change in Vitest 5 | Repo exposure | Action |
|--------------------|---------------|--------|
| `vitest-browser-svelte@3` `render()` is async | 140 `render(` calls in 30 `*.browser.test.ts`, 124 already awaited; extension popup tests 6 calls | Add `await` to the remaining 16 (+ check the extension's 6). |
| Browser locators match text **exactly** by default; `toHaveTextContent` requires equality and drops regex (`toMatchTextContent` for partial) | 56 `getByText(` and 40 `toHaveTextContent(` in web browser tests; 11 `getByText(` in the extension | Audit for substring/regex uses; prefer `{ exact: false }` only where the UI-SPEC says "contains". |
| `clearMocks: true` by default | 6 explicit `mockClear` calls; any test relying on call counts accumulated across `test()`s changes behaviour | Run the suite; the default is the safer one, keep it. |
| `expect.poll` now **rejects** on timeout and passes an `AbortSignal` | 62 `expect.poll(` uses | Good for determinism (silent passes become failures); no code change expected. |
| Nested `vi.mock` inside functions throws | 8 files use `vi.mock(` | Confirm all are top-level. |
| `test.sequential`/`describe.sequential` removed | 0 uses | none |
| JSON reporter default path `.vitest/json/output.json`; artifacts under `.vitest/` | `scripts/audit-evidence.mjs` passes `--reporter=json --outputFile.json=<out>`; `launch-audit.mjs` reads `apps/web/test-results/vitest.json` | Keep the explicit path; verify the dotted `--outputFile.json=` form still works in 5.0.5 (docs show `--outputFile=`); add `.vitest/` to `.gitignore`. MEDIUM. |
| Root `projects` referenced by path do not inherit root options (`extends` default applies to inline projects only) | `vitest.config.ts` lists six path/dir projects | Unchanged behaviour; keep per-project `setupFiles: no-network.ts`. |
| Config files are not looked up in parent directories | `scripts/vitest.config.ts`, per-package configs are explicit | none |
| `browser.isolate` deprecated for top-level `isolate` | not set | none |
| `VITEST_POOL_ID`/`VITEST_WORKER_ID` start at 1 | grep before relying on them for port offsets | none today |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Kit 3.1.0 now, in an isolated phase after the carried debt is cleared | Stay on Kit 2.70.3 until 2027-01-31 | If the owner go-live slips so far that the toolchain phase would collide with the live-origin gates. Kit 2 keeps working; the cost is three ignored low advisories and `runed` staying on 0.37. |
| `sv migrate sveltekit-3` one task per commit | Hand-migration | Never for the 1,061 `$lib` imports; the codemod also inserts the now-required file extensions, which a regex pass gets wrong for directory imports (`#lib/data` becomes `#lib/data/index.js`). |
| Separate `playwright.live.config.ts` with no `webServer` | One config with `webServer` disabled when `LIVE_ORIGIN` is set | Works too, but the live suite has different `expect.timeout`, no `projects` matrix and must not inherit `reuseExistingServer: false` semantics; a second file keeps `pnpm test:e2e` untouched. |
| Live smoke as a post-deploy job using `needs.deploy.outputs.page_url` | A scheduled (`cron`) run | Add a daily schedule later if the owner wants drift detection; each scheduled run also loads the Umami counter and must keep `LIVE_WEB3FORMS_SUBMIT` unset. |
| Vitest `sequence.groupOrder` + per-project `fileParallelism: false` for timing tests | Raising `testTimeout` on those files | Never: the milestone goal is "no blind timeout raises"; a budget test that needs a longer budget under load is measuring the machine, not the code. |
| Conditional `retry: { condition: /ETIMEDOUT\|EBUSY\|ECONNRESET/ }` on the `scripts` project only | Global `retry: 1` | Never (blind). The `condition` RegExp is matched against the error message, so only OS-level transient failures in the git-spawning tests are retried. |
| Playwright `retries: 0` + `expect.poll`/`toPass` | `retries: 1` + `retryStrategy: 'isolated'` (1.62) | Only if a genuinely nondeterministic external dependency enters the suite (none today; the live suite's only external party is the origin itself, where `toPass` is the right tool). |
| Manual first publish on Edge Partner Center, zip from the gated GitHub Release | `wxt submit` / `publish-browser-extension@6` with the Edge API | Only from the second release on: the Update API cannot create a product or edit metadata, and it needs a Client ID + API key stored as repository secrets. Revisit after `ext-v0.1.0` is live. |
| Deterministic Playwright screenshots of the synthetic fixture page | Screenshots of live zillow.com | Live screenshots show real listings (agent names, addresses) in a public store listing; the fixture page is PII-free and reproducible. |
| pnpm 12.16.1 via `packageManager` + Corepack | `pnpm self-update latest-12` global install | Equivalent locally; the `packageManager` pin is what CI (`pnpm/action-setup@v6`) reads, so it must change regardless. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `typescript@7.x` (npm `latest` = 7.0.2) | Kit 3 peers `^6.0.0` only; `typescript-eslint@8.72.1` peers `<6.1.0`; `svelte-check` `^5 || ^6`. | `typescript@~6.0.3` (6.0.3 is the newest 6.x). |
| `sv@next` (1.0.0-next.8), `@sveltejs/kit@next` (3.0.0-next.32), `adapter-static@next` | Pre-releases older than the stable tags. | `sv@1.1.1`, `@sveltejs/kit@3.1.0`, `@sveltejs/adapter-static@4.0.0`. |
| Any third-party `<script>` on the origin (Lighthouse CI badges, status widgets, hosted Umami `script.js`, Search Console's GA/GTM verification methods) | The origin holds BYOK provider keys in `sessionStorage`/IndexedDB; any script can read them. Also breaks `script-src 'self'`. | HTML-file or `<meta name="google-site-verification">` verification (both are URL-prefix methods and need no script); the existing first-party fetch beacon. |
| Umami API / `umami` npm client in the smoke suite | Hobby (free) plan has no API access (pricing page); an API key would also be a secret in CI. | Assert the `/api/send` POST returns 200 in Playwright; dashboard confirmation stays an owner row. |
| A scheduled smoke that submits Web3Forms | No sandbox key exists; every submission costs 1 of 250/month and lands in the owner's inbox. | Opt-in `LIVE_WEB3FORMS_SUBMIT=1`, tagged subject, manual runs only. |
| Lighthouse / `@lhci/cli`, `puppeteer`, `open-graph-scraper`, `cheerio`, `jsdom`, `linkedom`, `node-html-parser` | New supply-chain surface for checks the repo already does dependency-free (`assert-seo.mjs` regexes, PNG header parsing) or with Playwright. | Playwright + Node builtins; reuse the oracle helpers. |
| Blind `retries`/`testTimeout` increases (Vitest or Playwright), `test.describe.configure({ mode: 'serial' })` as a flake fix | Hides the race the milestone exists to remove; serial mode also retries whole groups together. | `expect.poll`/`toPass`, `sequence.groupOrder` isolation, `maxWorkers` caps, conditional `retry.condition`, `--shuffle` proofs. |
| `pool: 'vmThreads'`/`'vmForks'` for speed | ESM cache never clears, `instanceof Error` breaks across the VM boundary, memory leaks; the browser project does not use pools anyway. | Default `forks` with `isolate: true`; `isolate: false` only on pure-function projects (`core`, `brand`) if measured to help. |
| `poolOptions`, `minWorkers`, `singleThread`, `singleFork`, `workspace` | Removed in Vitest 4; configs carrying them error in 5. | `maxWorkers`, `isolate`, `fileParallelism`, `execArgv`, `projects`. |
| Node 26 in this milestone | Nothing requires it; `engines >=24 <25`, `.nvmrc` 24 and `@types/node ^24` are all consistent, and `pnpm`'s Node shim features are irrelevant here. | Node 24.22.2; revisit the major in a later milestone. |
| `pnpm install --frozen-lockfile false` | Removed form in pnpm 12. | `--no-frozen-lockfile` (local only); CI keeps bare `--frozen-lockfile`. |
| Chrome Web Store listing, paid Umami/Web3Forms tiers, Edge "Company" account | $0 budget; the Edge **Individual** account is free and verifies faster. | Edge Individual developer account; GitHub Release zip for Chrome/Brave. |
| New GitHub Actions in the smoke/release workflows (e.g. `softprops/action-gh-release`, `actions/upload-artifact`) | `extension-release-gate.test.ts` requires every `uses:` SHA to already be pinned in `ci.yml`; `gh release create` already does the job. | The three actions `ci.yml` pins; `gh` CLI steps. |
| Hard-coding the analytics host or site URL in `tests/live` | The deploy build takes them from repository variables. | Derive the origin from `LIVE_ORIGIN` and the analytics host from the live page's CSP `connect-src`. |

---

## Stack Patterns by Variant

**If the owner has created the org and the site is live before the toolchain phase starts:**
- Run `smoke:live` on Kit 2 output first and record a green baseline, then migrate, then re-run; the smoke suite becomes the acceptance gate for the Kit 3 deploy.
- Because the Kit 3 service-worker rewrite (`type: 'module'`, new precache list derivation) is the one change the local Pages emulator cannot fully prove: real GitHub Pages caching and the `_app/immutable` 404-after-redeploy path only exist on the live origin.

**If the site is still not live when the toolchain phase starts:**
- Point `LIVE_ORIGIN` at `http://127.0.0.1:4273` (the `serve-pages.mjs` root listener) and allow `http://` only when the host is loopback; the suite then runs in `pnpm verify` as a stand-in and flips to the real origin with no code change.
- Because the milestone explicitly asks for "local stand-in first, real origin once it exists".

**If `pnpm audit --audit-level low` surfaces a new advisory during the migration:**
- Fix forward (bump) when a patched version exists; add an exception only with the shipped-output grep proof the existing `audit-exceptions.mjs` entries carry.
- Because the Phase 11 decision ("audit exceptions only for code that never ships, with proof") still governs.

**If `layerchart` or `bits-ui` log a `runed` peer warning after Kit 3:**
- Accept the three-copy `runed` graph (0.35.1 via bits-ui, 0.37.1 via layerchart, 0.38.0 direct); do not use `pnpm.overrides` to force one.
- Because all three peers on `@sveltejs/kit` are optional and the packages were tested against their own ranges; an override would silently run layerchart on an untested runed.

**If Vitest 5's exact-text locators break many browser component tests:**
- Fix the tests to the exact UI-SPEC strings rather than setting `browser.locators.exact: false` globally.
- Because exact matching is the behaviour the primitives' "assert exact text" contract already promised.

**If the first `ext-v0.1.0` release is published and a second version is needed:**
- Only then evaluate `wxt submit` (via `publish-browser-extension@6`, bundled in `wxt@0.21.5`) with the Edge Update API v1.1 (`Authorization: ApiKey`, `X-ClientID`, `POST /v1/products/{productID}/submissions/draft/package`).
- Because the API cannot create the product or edit the listing; the first publish is manual by design.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@sveltejs/kit@3.1.0` | `vite ^8.0.12`, `svelte ^5.57.1`, `typescript ^6.0.0` (optional), `@sveltejs/vite-plugin-svelte ^7.0.0`, Node `>=22.17` | Registry peers. Depends on `cookie ^2.0.1`, `sirv ^3.0.2`, `devalue ^5.9.4`, `@standard-schema/spec ^1.1.0`. |
| `@sveltejs/adapter-static@4.0.0` | `@sveltejs/kit ^3.0.0-next.0` | No runtime deps. |
| `@sveltejs/vite-plugin-svelte@7.3.1` | `vite ^8.0.0`, `svelte ^5.46.4`, Node `^20.19 || ^22.12 || >=24` | Still depends on `deepmerge ^4.3.1` (GHSA-gcqx stays). |
| `svelte@5.57.3` | everything above; `bits-ui ^5.33`, `eslint-plugin-svelte ^5`, `prettier-plugin-svelte ^5`, `vitest-browser-svelte ^5` | 5.57.1 is the Kit 3 floor. |
| `typescript@6.0.3` | `@sveltejs/kit ^6.0.0`, `svelte-check ^5 || ^6`, `typescript-eslint >=4.8.4 <6.1.0`, `wxt >=5.4` | 7.x breaks Kit, svelte-check and typescript-eslint. |
| `runed@0.38.0` | `svelte ^5.7`, `zod ^4.1` (optional), `@sveltejs/kit ^3.0.0` (optional) | `runed@0.37.1` peers Kit `^2.21.0` (optional); `layerchart@2.9.1` pins `runed ^0.37.1`. |
| `vitest@5.0.5` | `vite ^6.4 || ^7 || ^8`, `@types/node ^22 || >=24`, Node `^22.12 || ^24 || >=26`, `happy-dom *` | `@vitest/browser-playwright` must be exactly `5.0.5`. |
| `vitest-browser-svelte@3.1.0` | `vitest ^4.0.0 || ^5.0.0`, `svelte ^5` | Depends on `@testing-library/svelte-core ^1.1.3`; `render` async. |
| `wxt@0.21.5` | `vite ^6.3.4 || ^7 || ^8.0.0-0`, `typescript >=5.4`, `eslint ^8.57 || ^9 || ^10`, Node `>=22` | Upstream devDependency is `vitest ^4.1.10`; `wxt/testing/vitest-plugin` is a Vite plugin with no Vitest peer, so Vitest 5 is expected to work but is **not upstream-verified** (MEDIUM). Validate with `pnpm vitest run --project extension` early in the phase. |
| `@wxt-dev/module-svelte@2.0.5` | `wxt >=0.18.6`, `svelte >=5` | OK. |
| `@playwright/test@1.64.1` | Chromium 156; `@axe-core/playwright@4.14.0` (`playwright-core >=1.0.0`) | Repo configs already set `reducedMotion`, Windows `taskkill` PATH guard; nothing in 1.63→1.64 breaking applies (device descriptors now forward `screen`; `Desktop Chrome` is used, harmless). |
| `pnpm@12.16.1` | Node `>=18`; `pnpm/action-setup@v6.1.0` (reads `packageManager`; `standalone` input is a no-op for v12); Corepack (bundled in Node `<25`) | `lockfileVersion: '9.0'` unchanged (probe). Workspace keys `packages`, `allowBuilds`, `engineStrict`, `audit.ignore` accepted (probe). `--frozen-lockfile false` form removed. |
| `shadcn-svelte@1.7.1` | `svelte ^5`; detects `#lib` from `package.json` `imports` (since 1.6.0) | Generated `cn` helper changed in 1.7.0; existing copied components are unaffected until regenerated. |
| GitHub Actions pins in `ci.yml` | `actions/checkout@v7.0.1` (latest, SHA `3d3c42e…` matches), `actions/setup-node@v7.0.0` (v7.1.0 released 2026-10-08; optional bump, resolve its commit SHA via the GitHub API when bumping), `pnpm/action-setup@v6.1.0` (latest), `actions/upload-pages-artifact@v5.0.0` (latest), `actions/deploy-pages@v5.0.1` (latest) | No pin changes are required for this milestone. |

---

## Capability-specific facts the planner needs

### Live-origin behaviour (GitHub Pages)
- Pages serves `404.html` with status 404 for unknown paths and 301-redirects directory URLs without a trailing slash; the repo's `serve-pages.mjs` emulates exactly this, so the live specs can be written against the emulator first. (HIGH for the emulator contract; the Pages behaviour itself is what `docs/DEPLOY-CHECKLIST.md` step 7 already expects, MEDIUM until observed live.)
- Pages cannot set custom response headers, so CSP exists only as the `<meta http-equiv>` Kit emits for prerendered pages (Kit 3 keeps `csp.mode: 'hash'` and the same `directives` shape; `frame-ancestors`, `report-uri`, `sandbox` are ignored in meta form). (HIGH for Kit; MEDIUM for Pages header behaviour, not in GitHub's docs.)
- Limits: 1 GB site, 100 GB/month soft bandwidth, 10 min deployment timeout; the 10 builds/hour soft limit does not apply to Actions-driven deploys. (HIGH)

### Search Console
- URL-prefix property for `https://tranrealestate.github.io/`. Verification methods that need no script: an HTML file at the site root with the exact issued name and content (same-domain redirects allowed, must stay in place; Search Console re-checks periodically), or `<meta name="google-site-verification" content="…">` inside `<head>` within the first 2 MB of the homepage. DNS verification is impossible for `github.io`. Sitemap submission is a UI/API action by the owner; the sitemap is already declared in `robots.txt`. (HIGH)
- Repo integration: the owner's `google<token>.html` goes in `apps/web/static/`; `assert-seo.mjs` must not treat it as an indexable page (it is not `index.html`, so the current walker ignores it), and the SW dotfile filter is unaffected (no leading dot).

### Umami
- Collect contract: `POST {host}/api/send` with `{ type: 'event', payload: { website, hostname, url, title, referrer, screen, language, name?, data?, tag?, id? } }`, requires a real `User-Agent`, needs no auth, returns JSON (`cache`, `sessionId`, `visitId`). Umami Cloud's documented collect host is `https://gateway.umami.is`; the repo takes the host verbatim from the dashboard tracking code, which is correct. (HIGH)
- Read API (`https://api.umami.is/v1`, `Authorization: Bearer <api-key>`, 50 calls / 15 s) is a paid-plan (Pro) feature; Hobby is 100K events/month, 6-month retention, 1 website, no API. (MEDIUM: pricing page wording.)

### Web3Forms
- `POST https://api.web3forms.com/submit`, `access_key` (public by design), honeypot `botcheck`, success `{ success: true, body: { message: 'Email sent successfully!' } }`, 429 has `message` at the top level, 500 has no `success` field. Client-side only on the free plan; submissions are not stored (forwarded only). No test mode or sandbox key is documented. Free quota (250/month) comes from the v1.0 research, MEDIUM. (HIGH for the contract.)

### Edge Add-ons
- Account: free, Individual type recommended (shorter verification; "Publisher display name" must be available). (HIGH)
- Package: the `.zip` with `manifest.json` at the root, exactly what `wxt zip` produces (`sponsored-listing-filter-0.1.0-chrome.zip`); `name`/`description` from the manifest are read-only in the listing; MV3 forbids remote code (answer "No" on the Privacy page, matching `assert-extension.mjs`'s `connect-src 'none'` oracle). (HIGH)
- Listing fields: Description 250-10,000 chars (the existing `edge-listing.md` copy qualifies), logo 300x300 PNG (exists: `store/edge-logo-300.png`), screenshots 640x480 or 1280x800 up to 6 (to generate), optional tiles 440x280 and 1400x560, YouTube URL optional, search terms up to 7 / 21 words / 30 chars each (the listing lists 7), privacy policy URL (`/legal/privacy/#browser-extension`, must be live before submission), category Shopping. Certification up to 7 business days. (HIGH)
- Update REST API v1.1: `https://api.addons.microsoftedge.microsoft.com`, enable on Partner Center "Publish API" page, `Authorization: ApiKey <key>` + `X-ClientID`, upload `POST /v1/products/{productID}/submissions/draft/package` (`Content-Type: application/zip`, 202 + `Location` operation id), publish `POST /v1/products/{productID}/submissions` with `{ "notes": "…" }`. Only for products already published once; no create/metadata endpoints. No paid tier is mentioned anywhere in the docs (MEDIUM on eligibility; HIGH on the endpoints).

### GitHub Release (`ext-v0.1.0`)
- `extension-release.yml` already: tag `ext-v*` push, `vars.EXTENSION_RELEASES_ENABLED == 'true'`, tag-matches-`package.json`-version check, `pnpm vitest run --project extension`, `wxt zip`, `assert-extension.mjs`, `sha256sum` → `SHA256SUMS.txt`, `gh release create --verify-tag`. Under Vitest 5 the `--project extension` invocation is unchanged. Under pnpm 12 nothing changes. No new pins needed. (HIGH)

---

## Sources

- npm registry (`npm view`, 2026-10-29): dist-tags, versions, publish times, `peerDependencies`, `peerDependenciesMeta`, `engines`, `dependencies` for `@sveltejs/kit`, `@sveltejs/adapter-static`, `@sveltejs/vite-plugin-svelte`, `svelte`, `svelte-check`, `typescript`, `vite`, `vitest`, `@vitest/browser-playwright`, `vitest-browser-svelte`, `runed`, `bits-ui`, `layerchart`, `shadcn-svelte`, `wxt`, `@wxt-dev/module-svelte`, `@playwright/test`, `@axe-core/playwright`, `pnpm`, `sv`, `eslint`, `typescript-eslint`, `eslint-plugin-svelte`, `prettier-plugin-svelte`, `fake-indexeddb`, `happy-dom`, `dexie`, `@types/node`. HIGH.
- Tarball inspection (`npm pack`, 2026-10-29): `@sveltejs/kit@3.1.0` `types/index.d.ts` (`serviceWorker` option shape, `csp` shape, `$app/manifest`/`$app/env` declarations, `resolve` typing), `src/runtime/app/paths/client.js` (`resolve` leading-slash semantics), `src/core/sync/write_app_types.js` (`Path` generation with `trailingSlash`); `@sveltejs/kit@2.70.3` `write_non_ambient.js` for comparison; `sv@1.1.1` `dist/bin.mjs` (task ids `package-json`, `tsconfig`, `svelte-config`, `lib-alias`, `imports`, `environment`, `paths`, `external-redirects`, `shallow-routing`, `params`, `app-state`; `looksLikeRouteId`, `removeStaticLeadingSlash`, `$service-worker` migration-task text). HIGH.
- Live probe (2026-10-29): `pnpm@12.16.1` vs `pnpm@11.27.0` `install --lockfile-only` and `--frozen-lockfile` on a copy of this repo's `pnpm-workspace.yaml` keys. HIGH.
- Repo inspection: all `package.json` files, `pnpm-lock.yaml` header, `svelte.config.js`, `vite.config.ts`, both Vitest browser configs, root/`scripts`/`core`/`brand` Vitest configs, both Playwright configs, `ci.yml`, `extension-release.yml`, `audit-exceptions.mjs`, `serve-pages.mjs`, `audit-evidence.mjs`, `launch-audit.mjs`, `assert-seo.mjs`, `assert-extension.mjs`, `service-worker.ts`, `service-worker-guard.test.ts`, `tests/e2e/support/network.ts`, `pwa.spec.ts`, `csp.spec.ts`, `helpers/beacons.ts`, `wxt.config.ts`, `store/edge-listing.md`, `docs/EXTENSION-INSTALL.md`, `docs/DEPLOY-CHECKLIST.md`; grep counts for `$lib`, `$app/*`, `resolve(`, `replaceState(`, `render(`, `getByText(`, `toHaveTextContent(`, `expect.poll(`, `vi.mock(`, `mockClear`. HIGH.
- [SvelteKit: Migrating to SvelteKit 3](https://svelte.dev/docs/kit/migrating-to-sveltekit-3), [Configuration](https://svelte.dev/docs/kit/configuration), [$app/paths](https://svelte.dev/docs/kit/$app-paths), [Service workers](https://svelte.dev/docs/kit/service-workers), [adapter-static](https://svelte.dev/docs/kit/adapter-static), [Page options](https://svelte.dev/docs/kit/page-options), [CLI](https://svelte.dev/docs/kit/cli), [sv migrate](https://svelte.dev/docs/cli/sv-migrate), `packages/kit/CHANGELOG.md` and `packages/adapter-static/CHANGELOG.md` on GitHub. HIGH.
- [Vitest: Migration guide (v5)](https://vitest.dev/guide/migration), [v4 migration](https://v4.vitest.dev/guide/migration.html), [projects](https://vitest.dev/guide/projects), config pages for [pool](https://vitest.dev/config/pool), [sequence](https://vitest.dev/config/sequence), [retry](https://vitest.dev/config/retry), [fileParallelism](https://vitest.dev/config/fileparallelism), [maxWorkers](https://vitest.dev/config/maxworkers), [isolate](https://vitest.dev/config/isolate), [reporters](https://vitest.dev/guide/reporters). HIGH (the `--outputFile.json=` CLI form is MEDIUM: not shown on the current reporters page).
- [pnpm 12.0 release blog](https://pnpm.io/blog/releases/12.0), [GitHub release v12.0.0](https://api.github.com/repos/pnpm/pnpm/releases/tags/v12.0.0) (published 2026-08-26), [settings reference](https://pnpm.io/settings), [pnpm/action-setup README](https://github.com/pnpm/action-setup), [Corepack README](https://github.com/nodejs/corepack#readme) ("distributed with Node.js from 14.19.0 up to but not including 25.0.0"). HIGH.
- [Playwright TestConfig](https://playwright.dev/docs/api/class-testconfig), [TestProject](https://playwright.dev/docs/api/class-testproject), [Parallelism](https://playwright.dev/docs/test-parallel), [Retries](https://playwright.dev/docs/test-retries), [webServer](https://playwright.dev/docs/test-webserver), [BrowserContext](https://playwright.dev/docs/api/class-browsercontext) (service workers, Chromium-only, `route()` does not intercept SW requests), [Release notes](https://playwright.dev/docs/release-notes) (1.62 `retryStrategy`, 1.63 locks, 1.64). HIGH.
- [Microsoft Edge: Publish an extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension) (asset sizes, description limits, certification time), [Register as a developer](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account) ("There is no registration fee"), [Update REST API](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api) (v1.1 API key auth, endpoints, "to initially publish a new extension, you use Partner Center"). HIGH for content; MEDIUM for tier eligibility (not stated).
- [Google Search Console: Verify your site ownership](https://support.google.com/webmasters/answer/9008080). HIGH.
- [Umami API overview](https://docs.umami.is/docs/api), [Sending stats](https://docs.umami.is/docs/api/sending-stats), [Cloud API key](https://docs.umami.is/docs/cloud/api-key), [Pricing](https://umami.is/pricing) (Hobby: no API access). MEDIUM for plan features (marketing page), HIGH for the collect contract.
- [Web3Forms API reference](https://docs.web3forms.com/getting-started/api-reference), [FAQ](https://docs.web3forms.com/getting-started/faq). HIGH for the contract; free-tier quota carried from v1.0 research, MEDIUM.
- [GitHub Pages usage limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). HIGH.
- GitHub API `releases/latest` and `git/ref/tags` for `actions/checkout`, `actions/setup-node`, `pnpm/action-setup`, `actions/upload-pages-artifact`, `actions/deploy-pages`; `wxt-dev/wxt` and `huntabyte/shadcn-svelte` release feeds. HIGH.
- Node.js release index (`nodejs.org/dist/index.json`): v24.22.2 LTS Krypton (2026-10-27), v26.13.0 LTS Lithium (2026-10-28). HIGH.

---
*Stack research for: Tran Real Estate Tools v1.1 Launch & Hardening (Kit 3 / Vitest 5 / pnpm 12 migration, live-origin smoke suite, deterministic parallel tests, extension release packaging)*
*Researched: 2026-10-29*
