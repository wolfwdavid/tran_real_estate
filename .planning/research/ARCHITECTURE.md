# Architecture Research

**Domain:** Launch & hardening of an existing, feature-complete static SvelteKit 2 + MV3-extension pnpm workspace (Tran Real Estate Tools v1.1). Not a redesign: this file maps six new capabilities onto the architecture that shipped in v1.0 and proposes a build order.
**Researched:** 2026-10-29
**Confidence:** HIGH for integration points (read from the codebase), HIGH for Kit 3 / Vitest 5 facts (official docs + npm registry, 2026-10-29), MEDIUM for the CI post-deploy mechanics (official action README + general Actions semantics), LOW where flagged inline.

## Headline findings (read first)

| # | Finding | Evidence | Consequence |
|---|---------|----------|-------------|
| F1 | **SvelteKit 3 is stable, not RC.** `@sveltejs/kit` dist-tag `latest` = **3.1.0**; `@sveltejs/adapter-static` latest = **4.0.0** (peer `@sveltejs/kit ^3.0.0-next.0`); `runed@0.38.0` peers `@sveltejs/kit ^3.0.0` (0.37.1 peers `^2.21.0`). | `npm view` 2026-10-29 (HIGH) | The v1.0 research's "Kit 3 is RC, wait" is obsolete. The migration is a real phase with a known target. `runed` must move in lockstep (0.37.1 -> 0.38.0) or peer resolution breaks. |
| F2 | **Kit 3 removes `svelte.config.js`**; every `kit.*` option becomes a `sveltekit({...})` plugin option in `vite.config.ts`; `prerender.origin` -> `paths.origin`; `$lib` -> `#lib` (package.json `imports`) **with file extensions**; `$app/environment` -> `$app/env`; `$service-worker` removed (`version` from `$app/env`, `assets/immutable/prerendered` from `$app/manifest`); `$app/paths` `base`/`assets`/`resolveRoute` removed; root `tsconfig.json` extends `$app/tsconfig`; service worker gets its own `src/service-worker/tsconfig.json`. Minimums: Node 22.17, TS 6, Svelte **5.57.1**, Vite 8.0.12, vite-plugin-svelte 7. | [Migration guide](https://svelte.dev/docs/kit/migrating-to-sveltekit-3), [config reference](https://svelte.dev/docs/kit/configuration), [service workers](https://svelte.dev/docs/kit/service-workers), [$app/paths](https://svelte.dev/docs/kit/$app-paths) (HIGH) | This repo's blast radius is enumerated in Section 6: 1 config file deleted, 2 Vitest configs, 1 tsconfig + 1 new, 1 service worker (moved), 2 `$app/environment` files, 2 `base` users, 1062 static + 65 dynamic `$lib` imports (567 without extensions), 6 ESLint pattern entries, `components.json`, 3 tests that import or pin `svelte.config.js`. |
| F3 | **`serviceWorker.files` is no longer documented in Kit 3.** The Kit 3 reference lists only `serviceWorker.register` and `serviceWorker.options`; the service-worker page says `assets` is "everything in `static`". Our Phase 3 dotfile filter (`.nojekyll` out of the precache, because `cache.addAll` is all-or-nothing and Pages never serves dotfiles) lives in `svelte.config.js` and is pinned by `scripts/service-worker-guard.test.ts:66-75` by importing that config. | Config reference + SW docs (HIGH that it is undocumented; MEDIUM that it is gone) | Move the dotfile filter **into** `apps/web/src/service-worker/index.ts` (filter the `$app/manifest` `assets` list) regardless of whether the option survives, and re-point the guard test at the worker source. Otherwise the first Kit 3 deploy ships a worker whose install fails on `.nojekyll` (silent offline regression; `pwa.spec.ts` would catch it locally). |
| F4 | **Vitest 5 is stable** (`latest` = **5.0.5**; `@vitest/browser-playwright@5.0.5` peers `vitest 5.0.5` exactly; `vitest-browser-svelte@3.1.0` peers `vitest ^4 \|\| ^5` and makes `render` **async**). Breaking defaults that touch this repo: `clearMocks: true`, `browser.locators.exact: true`, strict `toHaveTextContent` (40 uses in `*.browser.test.ts`), `test.sequential` removed (1 use), `expect.poll` rejects on timeout (8 unit files), config no longer looked up from parent dirs, inline projects inherit root via `extends`, `--project` accepts `*`/`!` patterns. | [Vitest migration](https://vitest.dev/guide/migration), [projects guide](https://vitest.dev/guide/projects), npm (HIGH) | The `--project '*-serial'` / `'!*-serial'` pattern support is what makes the lane design in Section 4 a two-line `package.json` change. Do Vitest 5 **before** Kit 3 so the migrated suite is the oracle for the Kit migration. |
| F5 | **`sequence.groupOrder` is per-project and sequential across groups**: "Projects with the same group order number will run together, and groups are run from lowest to highest." `fileParallelism: false` forces `maxWorkers` to 1 but the docs do not state it is settable per project. | [sequence](https://vitest.dev/config/sequence), [fileParallelism](https://vitest.dev/config/fileparallelism) (HIGH / MEDIUM) | Recommended lane mechanism: separate `vitest run` invocations selected by `--project` pattern with `--no-file-parallelism` on the serial lane (root-level flag, certain). `groupOrder` is the single-invocation alternative to try once Vitest 5 is in. |
| F6 | **`actions/deploy-pages` exposes `page_url`** as a step output; the README recommends a dedicated job with `needs`, `pages: write` + `id-token: write`, and `environment.url`. It says nothing about propagation or post-deploy verification. The deploy job in `ci.yml` already matches that shape (`id: deployment`, `environment.url`). | [deploy-pages README](https://github.com/actions/deploy-pages) (HIGH), job-output plumbing is standard Actions (HIGH) | A post-deploy `smoke` job reads `needs.deploy.outputs.page_url` after the deploy job declares `outputs.page_url`. Treat propagation as unknown: poll `_app/version.json` (Kit writes `{"version":"<build stamp>"}`, present in `apps/web/build/_app/version.json` today) until it equals the deployed build's stamp before asserting anything. |
| F7 | **`ci.yml` and `extension-release.yml` have never run on GitHub** (no remote). `workflow-gate.test.ts` pins literal gate strings: the `PAGES_ENABLED` gate appears **exactly twice**, `uses:` appears **exactly 7** times, exactly 2 checkouts, 4 `env:` blocks in `quality`. `extension-release-gate.test.ts` pins the release step **order** and that every `uses:` SHA is already pinned in `ci.yml`. | `scripts/workflow-gate.test.ts`, `scripts/extension-release-gate.test.ts` (HIGH) | Every workflow change in this milestone is a **two-file diff** (workflow + gate test) by design. The first real GitHub run is the single largest unknown of the milestone and must happen before anything is layered on top (hence go-live is Phase 12, with `PAGES_ENABLED` **unset** on the first push so CI runs without deploying). |
| F8 | The repo's established pattern for cross-package constants is **literal duplicate + parity test**, never a runtime import: CSP allowlist (`csp-policy.js` vs `assert-csp.mjs`), manifest strings (`copy.ts` vs `assert-extension.mjs`), brand tokens (`apps/extension/tests/brand-parity.test.ts` reads `@tran/brand` and scans extension source text). `TRAN_ORIGIN` (`apps/extension/src/lib/config.ts:3`) and `DEFAULT_SITE_ORIGIN` (`apps/web/src/lib/site-config.js:12`) are the one such pair **without** a parity test. | Codebase (HIGH) | The drift test should follow the precedent (Section 2), not introduce a shared runtime package: `site-config.js` is plain JS loaded by Node from `scripts/*.mjs` and (today) `svelte.config.js`, so it cannot import a TS workspace package. |

## Standard Architecture

### System Overview (what exists, with the six new pieces marked NEW)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ GitHub (owner-created in Phase 12): org tranrealestate / repo tranrealestate.github.io│
│  .github/workflows/ci.yml                                                            │
│   hygiene ─┐                                                                         │
│   quality ─┴─ matrix root|sub|configured ─► upload-pages-artifact (root, main, gate) │
│   deploy  (needs hygiene+quality, PAGES_ENABLED) ─► outputs.page_url      NEW output │
│   smoke   (needs deploy) ─► pnpm smoke --base $page_url                   NEW job    │
│  .github/workflows/extension-release.yml (ext-v* tag, EXTENSION_RELEASES_ENABLED)    │
│   + popup axe + runtime E2E + live privacy-URL probe + CHANGELOG notes     NEW steps  │
│  .github/workflows/smoke.yml  workflow_dispatch(base_url)                  NEW file   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Repo root (pnpm workspace)                                                           │
│  package.json  test:unit = parallel lane + serial lane                     MODIFIED  │
│  vitest.config.ts  projects: web core brand scripts web-browser extension            │
│                    + web-serial core-serial scripts-serial web-browser-serial  NEW   │
│  scripts/  assert-csp.mjs (CONNECT, checkHtml) ◄── reused by smoke                   │
│            serve-pages.mjs (local Pages emulator) ◄── smoke local stand-in           │
│            smoke.mjs                                                       NEW       │
│            origin-parity.test.ts                                           NEW       │
│            test-lanes.test.ts                                              NEW       │
│            workflow-gate.test.ts / extension-release-gate.test.ts          MODIFIED  │
│  apps/web/  svelte.config.js (DELETED in Kit 3 phase) vite.config.ts (absorbs it)    │
│             playwright.config.ts (e2e, 3 projects, webServer=serve-pages)            │
│             playwright.smoke.config.ts                                     NEW       │
│             tests/e2e/routes.ts (single route list) ◄── reused by smoke              │
│             tests/e2e/backup-roundtrip.spec.ts                             NEW       │
│             tests/smoke/*.smoke.ts                                         NEW       │
│             src/service-worker.ts ─► src/service-worker/index.ts (Kit 3)  MOVED     │
│  apps/extension/  src/lib/config.ts TRAN_ORIGIN ◄── parity-tested          │
│                   store/ edge-listing.md edge-logo-300.png + screenshots/  NEW dir   │
│                   CHANGELOG.md                                              NEW       │
│  packages/core, packages/brand (unchanged)                                           │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Status | Key files |
|-----------|----------------|--------|-----------|
| Live-origin smoke suite | Re-run the deferred v1.0 live checks against **any** origin (serve-pages locally, `tranrealestate.github.io` after deploy); read-only, never submits forms or spends keys | NEW | `apps/web/tests/smoke/`, `apps/web/playwright.smoke.config.ts`, `scripts/smoke.mjs`, `ci.yml` `smoke` job, `.github/workflows/smoke.yml` |
| Origin parity test | Prove `TRAN_ORIGIN`, `PRIVACY_URL`, the Edge listing URL line, the install doc URL and the privacy page anchor all derive from `DEFAULT_SITE_ORIGIN` | NEW | `scripts/origin-parity.test.ts`; refactor `scripts/extension-docs.test.ts` and `scripts/assert-extension.test.ts` literals to import the constant |
| Backup round-trip spec | One Playwright spec: seed every registered table, export via Settings, import into a fresh profile, assert byte-equal rows | NEW | `apps/web/tests/e2e/backup-roundtrip.spec.ts`, new `apps/web/tests/e2e/helpers/seed-all.ts` |
| Test lanes | Parallel lane for everything; serial lane for wall-clock-sensitive files; a guard that no timing assertion lives outside the serial lane | NEW/MODIFIED | `vitest.config.ts`, `apps/web/vitest.serial.config.ts`, `apps/web/vitest.browser.serial.config.ts`, `packages/core/vitest.serial.config.ts`, `scripts/vitest.serial.config.ts`, `scripts/test-lanes.test.ts`, `package.json` |
| Kit 3 / Vitest 5 / pnpm 12 migration | One isolated phase, three plans in order pnpm -> Vitest -> Kit | MODIFIED (wide) | Section 6 inventory |
| Extension release | Make `ext-v0.1.0` publishable: changelog-driven notes, screenshots, full test parity, live privacy-URL gate, draft release | MODIFIED | `.github/workflows/extension-release.yml`, `apps/extension/CHANGELOG.md`, `apps/extension/store/screenshots/`, `apps/extension/scripts/make-screenshots.mjs`, `scripts/extension-release-gate.test.ts`, `docs/DEPLOY-CHECKLIST.md` Step 9 |

## Recommended Project Structure (additions only)

```
apps/web/
├── playwright.smoke.config.ts        # NEW: testDir tests/smoke, no webServer, baseURL from SMOKE_BASE_URL
├── tests/
│   ├── e2e/
│   │   ├── routes.ts                 # unchanged; imported by smoke via '../e2e/routes'
│   │   ├── backup-roundtrip.spec.ts  # NEW: PLAT-04 across all 18 registered tables
│   │   └── helpers/seed-all.ts       # NEW: raw-IDB seeders per table, Syncable envelope, schema-valid rows
│   └── smoke/                        # NEW: *.smoke.ts, read-only against a deployed origin
│       ├── fixtures.ts               # base URL, version poll, CSP collector, request recorder
│       ├── routes.smoke.ts           # every ROUTE 200 + h1 + zero CSP violations; 301 no-slash; 404 branded
│       ├── headers.smoke.ts          # checkHtml() from scripts/assert-csp.mjs over fetched HTML
│       ├── pwa.smoke.ts              # SW registers, scope, precache has no dotfiles, manifest/icons 200
│       ├── seo.smoke.ts              # sitemap/robots/og 200 + content types + absolute URLs on this origin
│       ├── third-party.smoke.ts      # no cross-origin request except the configured analytics host
│       ├── analytics.smoke.ts        # beacon POST observed to SMOKE_ANALYTICS_HOST (skipped when unset)
│       └── extension-link.smoke.ts   # /legal/privacy/#browser-extension anchor exists (PRIVACY_URL target)
├── vitest.serial.config.ts           # NEW: project 'web-serial', include studio/boundaries.test.ts
├── vitest.browser.serial.config.ts   # NEW: project 'web-browser-serial', include *.serial.browser.test.ts
└── src/service-worker/               # Kit 3 phase: index.ts + tsconfig.json (extends $app/tsconfig/service-worker)
apps/extension/
├── CHANGELOG.md                      # NEW: Keep-a-Changelog; 0.1.0 section = release notes
├── scripts/make-screenshots.mjs      # NEW: Playwright over e2e/zillow-page.ts synthetic page -> store/screenshots/*.png
└── store/screenshots/                # NEW: 1280x800 popup + dimmed-card captures (labelled "sample page")
packages/core/vitest.serial.config.ts # NEW: project 'core-serial' (fair-housing/mutation, numbers.property, leads/parse-freeform)
scripts/
├── smoke.mjs                         # NEW: --base <url> [--local] [--analytics-host] -> playwright smoke config
├── vitest.serial.config.ts           # NEW: project 'scripts-serial' (precommit.test.ts)
├── origin-parity.test.ts             # NEW
└── test-lanes.test.ts                # NEW: every file with a wall-clock assertion is in exactly one serial include
.github/workflows/smoke.yml           # NEW: workflow_dispatch { base_url } -> pnpm smoke
```

### Structure Rationale

- **`tests/smoke/` beside `tests/e2e/`, separate Playwright config:** the E2E config hard-wires `webServer: serve-pages.mjs`, three local projects and `reuseExistingServer: false`. Smoke needs no server, one project, a URL from the environment, and retries. Sharing `routes.ts` by relative import keeps the single route list; `routes-drift.spec.ts` already guarantees that list equals the build. Smoke files end in `.smoke.ts` so the E2E `testDir: tests/e2e` never picks them up and vice versa.
- **CSP allowlist reuse without duplication:** `scripts/assert-csp.mjs` exports `checkHtml(relPath, html, { analyticsHost })`, `CONNECT`, `EXACT`, `EXPECTED_PAGES`, `CARRIERS`. The smoke `headers.smoke.ts` fetches each page with `page.request.get()` and runs `checkHtml` on the body. That is the same oracle CI runs on the build directory, now run on what Pages actually serves. No third copy of the policy.
- **Serial lane as additional projects, not edits to existing ones:** the existing six projects keep their `include` globs minus the serial files (`exclude` entries). The serial projects are tiny configs that `mergeConfig` the parallel sibling and override `include`/`name`. The root `vitest.config.ts` lists all ten. Lane selection happens by `--project` pattern in `package.json`, so `ci.yml` keeps its single `run: pnpm test:unit` line and `workflow-gate.test.ts` stays true.
- **Extension assets stay in `apps/extension/store/`:** `extension-docs.test.ts` already reads `store/edge-listing.md`; screenshots and the changelog join the same folder family so `ext:assert`-style text oracles can cover them.

## Architectural Patterns

### Pattern 1: Smoke = E2E oracles re-pointed at a URL, never new assertions

**What:** Every smoke check is an existing proof (`routing.spec`, `csp.spec`, `pwa.spec`, `seo.spec`, `third-party.spec`, `assert-csp.mjs`) reduced to its origin-independent core and parameterised by `SMOKE_BASE_URL`. Nothing in smoke mutates state on the live origin: no form submission (Web3Forms would email the owner), no key entry, no RentCast call.
**When to use:** against `http://127.0.0.1:4273/` (serve-pages root listener, after `pnpm build:root`) during development; against `https://tranrealestate.github.io/` from the post-deploy job and from `workflow_dispatch`.
**Trade-offs:** cannot prove Web3Forms delivery, real-key CORS, Safari persistence or Umami dashboard counts; those stay HUMAN-UAT (Section "What stays human" below shrinks 77 rows to about 20). Pages serves no custom headers, so every header-level assertion is really a meta-tag assertion, which `checkHtml` already is.

**Example (config and base-URL plumbing):**
```typescript
// apps/web/playwright.smoke.config.ts
import { defineConfig, devices } from '@playwright/test';
const base = process.env.SMOKE_BASE_URL;
if (!base || !/^https?:\/\/[^/]+\/.*\/$/.test(base)) {
	throw new Error('SMOKE_BASE_URL must be an absolute URL ending in / (e.g. https://tranrealestate.github.io/)');
}
export default defineConfig({
	testDir: 'tests/smoke',
	testMatch: /\.smoke\.ts$/,
	retries: 2, // a live CDN edge may lag; retries are legitimate here, unlike in E2E
	workers: 2,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	use: { ...devices['Desktop Chrome'], baseURL: base, trace: 'retain-on-failure', reducedMotion: 'reduce' },
	projects: [{ name: 'smoke' }]
});
```
```typescript
// apps/web/tests/smoke/headers.smoke.ts  (reuses the build-time oracle verbatim)
import { test, expect } from '@playwright/test';
import { ROUTES } from '../e2e/routes';
import { checkHtml } from '../../../../scripts/assert-csp.mjs';
test('served HTML satisfies the CSP contract on every route', async ({ request }) => {
	for (const route of ROUTES) {
		const html = await (await request.get(route)).text();
		expect(checkHtml(route || 'index.html', html, { analyticsHost: process.env.SMOKE_ANALYTICS_HOST ?? '' })).toEqual([]);
	}
});
```
The `version.json` gate (fixture, runs once per worker): `GET _app/version.json` until `version === process.env.SMOKE_EXPECT_VERSION` or 5 minutes elapse; when the variable is unset (ad-hoc runs) skip the gate. In CI the `quality` root leg uploads `apps/web/build/_app/version.json` as a tiny artifact `web-version`; the `smoke` job downloads it and exports the value. (Kit writes this file today: `apps/web/build/_app/version.json` = `{"version":"1792988474126"}`; MEDIUM that Kit 3 keeps the path, verify in the migration phase.)

**CI wiring (two-file diff with `scripts/workflow-gate.test.ts`):**
```yaml
  deploy:
    # unchanged ... plus:
    outputs:
      page_url: ${{ steps.deployment.outputs.page_url }}
  smoke:
    name: live-origin smoke
    if: github.event_name == 'push' && github.ref == 'refs/heads/main' && vars.PAGES_ENABLED == 'true'
    needs: [deploy]
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@<same SHA>   # persist-credentials: false
      - uses: pnpm/action-setup@<same SHA>
      - uses: actions/setup-node@<same SHA>
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter web exec playwright install --with-deps chromium
      - uses: actions/download-artifact@<new pinned SHA>   # web-version
      - run: node scripts/smoke.mjs --base "$PAGE_URL" --expect-version-file web-version/version.json
        env:
          PAGE_URL: ${{ needs.deploy.outputs.page_url }}
          SMOKE_ANALYTICS_HOST: ${{ vars.PUBLIC_ANALYTICS_HOST }}
```
Gate-test deltas to make in the same commit: `PAGES_ENABLED` count 2 -> 3 (deploy, upload, smoke), `uses:` count 7 -> 11 (+checkout, pnpm, node, download-artifact), checkout count 2 -> 3, a new `describe('smoke job')` asserting `needs: [deploy]`, that the smoke job has **no** `pages`/`id-token` permissions, that `PAGE_URL` is passed through `env:` (never interpolated into `run:`), and that `vars.PUBLIC_ANALYTICS_HOST` now appears 5 times (the existing "no other use of the variable" assertion must be relaxed for exactly this job). `actions/download-artifact` is a new third-party pin: pin to a 40-hex SHA like the others and update "exactly N uses" accordingly. The `smoke` job failing turns the run red **after** deploy; that is the intent (alert, not gate), and the workflow comment must say so.

### Pattern 2: Cross-package constants = literal duplicate + parity test (origin drift)

**What:** Keep `TRAN_ORIGIN` as a literal in `apps/extension/src/lib/config.ts` (the extension bundle must stay free of web-app code; EXT-03 oracles scan the bundle) and `DEFAULT_SITE_ORIGIN` in `apps/web/src/lib/site-config.js` (plain JS loaded by Node from `scripts/*.mjs`). Add `scripts/origin-parity.test.ts` in the `scripts` Vitest project, which already imports across packages (`provider-hosts.test.ts` imports `packages/core` and `assert-csp.mjs`; `extension-docs.test.ts` reads extension files).
**When to use:** now, in the debt phase. Revisit only if a custom domain ever replaces `tranrealestate.github.io` (then the extension's literal needs a release anyway).
**Trade-offs:** does not catch a drift introduced through `PUBLIC_SITE_URL` at build time (the extension is built without env); the test should therefore also assert `resolveSiteOrigin({}) === TRAN_ORIGIN` and the `DEPLOY-CHECKLIST` must say that changing `PUBLIC_SITE_URL` requires an extension release.

**Example:**
```typescript
// scripts/origin-parity.test.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { DEFAULT_SITE_ORIGIN, resolveSiteOrigin } from '../apps/web/src/lib/site-config.js';
import { PRIVACY_URL, TRAN_ORIGIN } from '../apps/extension/src/lib/config.ts';
const ROOT = join(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
describe('one site origin', () => {
	test('extension TRAN_ORIGIN equals the web DEFAULT_SITE_ORIGIN (and the env-less resolution)', () => {
		expect(TRAN_ORIGIN).toBe(DEFAULT_SITE_ORIGIN);
		expect(resolveSiteOrigin({})).toBe(TRAN_ORIGIN);
	});
	test('PRIVACY_URL is the privacy page anchor on that origin', () => {
		expect(PRIVACY_URL).toBe(`${DEFAULT_SITE_ORIGIN}/legal/privacy/#browser-extension`);
		expect(read('apps/web/src/routes/(marketing)/legal/privacy/+page.svelte')).toContain('id="browser-extension"');
	});
	test('listing copy and install guide carry exactly that URL', () => {
		expect(read('apps/extension/store/edge-listing.md')).toContain(`## Privacy policy URL: ${PRIVACY_URL}`);
		expect(read('docs/EXTENSION-INSTALL.md')).toContain(PRIVACY_URL);
	});
	test('non-vacuity: a different origin would fail', () => {
		expect('https://wolfwdavid.github.io').not.toBe(DEFAULT_SITE_ORIGIN);
	});
});
```
Also refactor the hard-coded `'https://tranrealestate.github.io/legal/privacy/#browser-extension'` literals in `scripts/extension-docs.test.ts:103` and `scripts/assert-extension.test.ts:74,412` to import `PRIVACY_URL`, so there is one literal (extension) plus one (web), both under test. `config.ts` imports `selectors.v1.json`; the `scripts` project runs under Vite, which resolves JSON imports, so no config change is needed (verify once; LOW risk).

### Pattern 3: Backup round-trip = raw-IDB breadth seeding + real-UI export/import + fresh-context wipe

**What:** The registry (`apps/web/src/lib/storage/backup-registry.ts`) yields 18 backed-up tables; `meta` and `apiCache` are excluded. Today's `settings-backup.spec.ts` round-trips only `prefs`. The new spec seeds **every** table, exports through the real "Download backup" button, opens a fresh browser context (the wipe: a new context has empty IndexedDB, exactly as `settings-backup.spec.ts` "fresh-profile import" does), imports through the real `#backup-file` input and "Import backup" (Merge) and asserts the 18 tables are equal to the seeded rows.

| Phase | Tables (Dexie name -> label) | Seeding entry point that exists today | Recommended seeding in the spec |
|---|---|---|---|
| 3 | `prefs` -> Settings | `helpers/backup-files.ts makeBackup({prefs})` + import | raw IDB |
| 4 | `ledger`, `savedSearches`, `searchSnapshots`, `dataPrefs` | `helpers/data.ts seedLedger()`, `seedSavedSearches()` (raw IDB, exact row shapes); `saveCap()` writes `dataPrefs` via UI | reuse `seedLedger`/`seedSavedSearches`; raw IDB for `dataPrefs` (fixed uuids per 04 decision) |
| 5 | `aiArtifacts` -> AI drafts | fixture provider generation via `GenerationPanel` (UI, slow) | raw IDB, rows without `deletedAt` (SyncableSchema rejects null) |
| 6 | `renterShortlist`, `renterSearchMeta` | shortlist Save button (UI); search Save dialog (`renter-saved.spec.ts saveCurrentSearch`) | raw IDB (`&listingId` unique index; meta row shares `savedSearches` id) |
| 7 | `deals`, `investorDraft`, `buyBoxes`, `watchedZips` | analyzer autosave + Save deal (UI); `features/investor/analyzer/sample-deal.ts` | raw IDB using zod schemas' happy shapes; `deals` rows must satisfy `dealRecordSchema` |
| 8 | `contacts`, `tasks`, `activities`, `agentProfile` | "Load sample contacts" button (`agent-helpers.ts loadSampleContacts`, 12 contacts) ; profile form (UI) | **UI** for contacts (cheap, schema-valid by construction); raw IDB for tasks/activities/profile (profile carries `scanExemptPaths` for logo bytes and the Web3Forms key, so seed a logo blob to exercise the exemption) |
| 9 | `studioDraft`, `snapshots` | tool autosave (UI); `snapshot-print.spec.ts:363` and `studio-keyless.spec.ts:474` already `put` a `snapshots` row via raw IDB | raw IDB (reuse those row builders, moved into `helpers/seed-all.ts`) |

**Equality oracle without duplicating the registry:** in the browser, `db.objectStoreNames` minus `['meta','apiCache']` must equal `Object.keys(exported.tables)` (fails if a future table is added without registration, which `backup-registry.test.ts` also guards) and, after import in the fresh context, `readAll(table)` sorted by `id` must deep-equal the seeded rows for each table. Non-vacuity: assert the exported file has at least one row in every table **and** mutate one seeded row's `updatedAt` on the import side to prove the comparison sees differences (keep as a second test).
**Trade-offs:** raw-IDB seeding bypasses app writes, so it proves backup, not the writers; the per-store unit round-trips already cover writers. Rows must satisfy the per-table zod schemas (`deals`, `buyBoxes`, `watchedZips`, `contacts`, `tasks`, `activities`, `agentProfile`, `studioDraft`, `snapshots`) or the preview rejects the file; take row shapes from the existing unit fixtures (`sample-deal.ts`, `fixtures/sample-contacts.ts`, snapshot builders). Runs on `root` and `sub` under the deny-all `support/network.ts` fixture; budget about 60-90 s, so give it `test.setTimeout(180_000)` once, documented, not raised later.

### Pattern 4: Two lanes, one `test:unit`

**What:** Wall-clock-sensitive files move to `*-serial` projects that run after the parallel lane with `--no-file-parallelism`. Lane membership is a property of the file, enforced by `scripts/test-lanes.test.ts`.

Files that belong in the serial lane today (from `STATE.md` blockers and `grep performance.now()`):

| File | Current project | Why load-sensitive | Serial project |
|---|---|---|---|
| `packages/core/src/fair-housing/mutation.test.ts` | core | ReDoS budgets `< 50 ms` / `< 500 ms` (fastest-of-N) | `core-serial` |
| `packages/core/src/numbers/numbers.property.test.ts` | core | ReDoS budget `< 250 ms` | `core-serial` |
| `packages/core/src/leads/parse-freeform.test.ts` | core | uses `performance.now()` | `core-serial` |
| `apps/web/src/lib/features/studio/boundaries.test.ts` | web | 30 s import-graph walk over the tree | `web-serial` |
| `scripts/precommit.test.ts` | scripts | spawns git + gitleaks per test; 56 s of 60 s under load | `scripts-serial` |
| `apps/web/src/lib/features/renter/search/ResultsView.browser.test.ts` | web-browser | 60-card render + axe, lazy map chunks (`TEST_MS = 20_000`) | `web-browser-serial` (rename to `ResultsView.serial.browser.test.ts` so the include glob is mechanical) |

**Mechanism (certain today, Vitest 4 and 5):**
```jsonc
// package.json
"test:unit": "pnpm test:unit:parallel && pnpm test:unit:serial",
"test:unit:parallel": "vitest run --project '!*-serial'",
"test:unit:serial": "vitest run --project '*-serial' --no-file-parallelism"
```
Vitest 4.1.12 already supports `--project` with `*` and `!` patterns (HIGH: projects guide). `--no-file-parallelism` is a root CLI flag (HIGH). Each serial config is `mergeConfig(parallelSibling, { test: { name: 'core-serial', include: [...exact files...] } })` and the parallel sibling adds the same files to `exclude`, so every file runs in exactly one project (the rule `vitest.browser.config.ts` already documents).
**Alternative once on Vitest 5:** keep one invocation and set `sequence.groupOrder: 1` on the serial projects (docs: groups run lowest to highest) plus `maxWorkers: 1` **if** it proves per-project in practice (MEDIUM; the `fileParallelism` page does not say). Try it in the toolchain phase; keep the two-invocation script if it does not hold.
**Guard (`scripts/test-lanes.test.ts`):** walk `apps packages scripts` for `*.test.ts`; any file containing `performance.now(`, `process.hrtime`, `Date.now()` inside an `expect(...).toBeLessThan` within 5 lines, a `testTimeout`/`{ timeout: N }` above 15 s, or `spawnSync(` must be matched by a `*-serial` include; and every `*-serial` include must exist. Planted-case non-vacuity like `scripts/no-network.test.ts`. The rule "never raise a timeout blindly" from `STATE.md` becomes mechanical: a raised timeout outside the serial lane fails this test.
**CI:** `quality` keeps `run: pnpm test:unit` (one line, gate tests untouched). Runtime grows by one extra Chromium launch (`web-browser-serial`) and by the serial tail (precommit about 60 s, boundaries about 30 s, ResultsView about 20 s): acceptable.
**E2E flakes are a different problem:** `renter-saved.spec.ts:83` (1/10 under load) and the two in `10/deferred-items.md` are races, not budgets. Treatment per `tasks/lessons.md`: reproduce under CPU burners with trace, then `expect.poll` for any value set by an intercepted request; never `retries` in E2E config (CI has `retries: 1` already; keep).

### Pattern 5: Toolchain migration as three gated plans, suite-first

**Order inside the phase: pnpm 12 -> Vitest 5 -> Kit 3**, each followed by a full `pnpm verify` plus `pnpm smoke:local`, and each committed separately so a bisect is one commit.
- **pnpm 12.16.1 first:** smallest blast radius (`packageManager` pin, lockfile; pnpm 12 keeps the pnpm 11 lockfile/commands per the pnpm 12 release post, MEDIUM). Verify `pnpm-workspace.yaml` keys `allowBuilds`, `engineStrict`, `audit.ignore` are unchanged (`supply-chain.test.ts` parses `audit.ignore` as text and asserts a single-document lockfile). `pnpm/action-setup@6.1.0` reads `packageManager`, so CI follows automatically.
- **Vitest 5.0.5 second:** pin `vitest`, `@vitest/browser-playwright` (exact peer), `vitest-browser-svelte@3.1.0` in root, `apps/web`, `apps/extension`, `packages/*`. Touchpoints: `render` async (7 sync `render(` calls in web browser tests, plus `apps/extension/tests/browser/popup.browser.test.ts`); 40 `toHaveTextContent` uses now strict (switch to `toMatchTextContent` where partial); `browser.locators.exact` default `true`; 1 `sequential` use -> `concurrent: false`; `clearMocks: true` (6 explicit `mockClear/clearAllMocks` calls hint at tests that count calls across `it`s; audit the counting-spend tests of Phase 4 and 6); `expect.poll` rejecting on timeout (8 files; behaviour becomes stricter, not looser); `.vitest/` artifacts dir -> `.gitignore`; `extension-release.yml` runs `pnpm vitest run --project extension` from the repo root, unaffected by the no-parent-lookup change. The serial-lane `groupOrder` experiment belongs here.
- **Kit 3.1.0 last:** Section 6 inventory. Run `npx sv migrate sveltekit-3` (sv latest = 1.1.1) after bumping to the latest 2.x for deprecation warnings (guide). Bump `svelte` 5.57.0 -> ≥5.57.1 (Kit 3 peer), `@sveltejs/adapter-static` 3.0.10 -> 4.0.0, `runed` 0.37.1 -> 0.38.0, `@sveltejs/vite-plugin-svelte` 7.3.0 -> 7.3.1. Then delete the three `@sveltejs/kit <3` / `cookie` exceptions from **both** `scripts/lib/audit-exceptions.mjs` and `pnpm-workspace.yaml` `audit.ignore` (`supply-chain.test.ts` enforces equality) and re-run `pnpm audit:deps`; `deepmerge` stays unless vite-plugin-svelte dropped it.
**Trade-offs:** doing Kit 3 first would clear the audit exceptions sooner, but their revisit date is 2027-01-31 and the migrated test harness is the only oracle big enough (6,647 unit + 2,327 E2E) to trust a framework major. Suite first.

## Data Flow

### Smoke flow (post-deploy)

```
push main ─► hygiene + quality(root|sub|configured) ─► upload-pages-artifact + web-version artifact
   ─► deploy (deploy-pages) ─► outputs.page_url
   ─► smoke: poll {page_url}_app/version.json == web-version ─► Playwright smoke project
         routes.smoke  ─ GET each ROUTE: 200, <h1>, html[hidden] removed, 0 securitypolicyviolation
         headers.smoke ─ checkHtml(fetched HTML) from scripts/assert-csp.mjs
         pwa.smoke     ─ SW scope == base, precache ⊆ same-origin, no dotfile; manifest + 4 icons 200
         seo.smoke     ─ sitemap.xml (14+ <loc> on this origin), robots.txt Sitemap:, og/*.png 200 image/png
         third-party.smoke ─ recorded requests all same-origin except fetch to SMOKE_ANALYTICS_HOST
         analytics.smoke   ─ (only when host set) one POST {host}/api/send observed on a page load
         extension-link.smoke ─ /legal/privacy/ has id="browser-extension"
   ─► red run == live regression alert (deploy already happened)
```
Locally: `pnpm smoke:local` = `pnpm build:root && node scripts/smoke.mjs --local` (starts `serve-pages.mjs` itself with `SERVE_PAGES_EXIT_ON_STDIN_END=1`, base `http://127.0.0.1:4273/`). Ad hoc: `pnpm smoke --base https://tranrealestate.github.io/`.

### Lane flow

```
pnpm test:unit
  ├─ vitest run --project '!*-serial'            (web core brand scripts web-browser extension; parallel)
  └─ vitest run --project '*-serial' --no-file-parallelism
        (core-serial web-serial scripts-serial web-browser-serial; one file at a time)
scripts/test-lanes.test.ts (runs in the parallel lane) ─ asserts lane membership of every timing assertion
```

### Extension release flow (after the changes in Section 7)

```
git tag ext-v0.1.0 && git push origin ext-v0.1.0
  ─► extension-release.yml (EXTENSION_RELEASES_ENABLED == 'true')
       tag == apps/extension/package.json version
       CHANGELOG.md has a "## 0.1.0" section (new step; notes extracted from it)
       pnpm vitest run --project extension ─► playwright install chromium ─► ext:test:browser ─► ext:e2e   (new parity steps)
       pnpm --filter extension zip ─► assert-extension.mjs --zip-dir
       curl -fsS https://tranrealestate.github.io/legal/privacy/ | grep 'id="browser-extension"'   (new live gate)
       sha256sum ... > SHA256SUMS.txt && sha256sum -c SHA256SUMS.txt                               (new self-check)
       gh release create --draft --verify-tag --notes-file <changelog section> zip SHA256SUMS.txt     (--draft new)
  ─► owner reviews the draft, publishes; Edge Partner Center submission with store/ assets (owner)
```

## Section 6: SvelteKit 3 touchpoint inventory for THIS repo

All counts measured 2026-10-29 on the working tree. "Auto" = `sv migrate sveltekit-3` is expected to handle it (guide: "many breaking changes can be migrated automatically"); verify every item regardless.

| # | Touchpoint | Files | Change | Auto? |
|---|---|---|---|---|
| K1 | Config location | `apps/web/svelte.config.js` (delete), `apps/web/vite.config.ts` (absorb) | Move `adapter(...)`, `paths: { base }`, `serviceWorker.files` (see K7), `prerender: { entries, handleHttpError, handleMissingId, handleUnseenRoutes }`, `csp: buildCsp(...)` into `sveltekit({...})`. `prerender.origin: resolveSiteOrigin()` -> `paths.origin`. The Vitest branch (`isVitest ? [svelte()] : [tailwindcss(), sveltekit({...})]`) stays; re-test whether Kit 3's plugin still pins Vite root to `process.cwd()` (the Phase 1 reason for the plain `svelte()` workaround). | Partly |
| K2 | `$lib` -> `#lib` with extensions | 1062 static `from '$lib/...'` (495 with extension, 567 without), 65 dynamic `import('$lib/...')`; 47 shadcn files under `lib/components/ui` | `package.json` (apps/web) gains `"imports": { "#lib": "./src/lib/index.js", "#lib/*": "./src/lib/*" }`; codemod rewrites specifiers and adds `.ts`/`.js`/`.svelte` extensions. Dynamic imports in `BackupSection.svelte` ("BackupKit"), the analytics boot, map libs and provider adapters must keep their lazy-chunk behaviour (budget gate `assert-budget.mjs` will tell). | Yes (code); verify budget |
| K3 | Tooling that understands `$lib` | `eslint.config.js` (6 `$lib` pattern entries: `DATA_INTERNALS`, `forbid()`, `MARKETING_SAFE` paths, map/portal overrides), `apps/web/vite.config.ts` and `apps/web/vitest.browser.config.ts` (`$lib` alias: delete, Node `imports` resolves natively; `$app/paths` stub alias: keep), `apps/web/src/lib/testing/app-paths.stub.ts` (drop `base`/`assets`, add `asset()`), `components.json` aliases (`$lib` -> `#lib`; shadcn-svelte CLI 1.7.1 support for `#lib` unverified, LOW; CLI is only used to add components, not at build), `tooling/import-graph.ts` + `scripts/agent-boundary.test.ts` + `apps/web/src/lib/features/studio/boundaries.test.ts` (resolver must map `#lib/x.ts`), `scripts/ui-class-guard.mjs`/`banned-terms` (path-based, unaffected) | Manual |
| K4 | TypeScript config | `apps/web/tsconfig.json` (`extends: "./.svelte-kit/tsconfig.json"` -> `"$app/tsconfig"`, add `include`/`exclude` with `src/service-worker` excluded), new `apps/web/src/service-worker/tsconfig.json` extends `$app/tsconfig/service-worker`; `apps/web/package.json` `prepare: svelte-kit sync \|\| echo ''` and `check: svelte-kit sync && svelte-check` (guide silent on `svelte-kit sync`; keep until proven unnecessary, then drop the Phase 1 prepare hook) | Manual |
| K5 | `$app/environment` -> `$app/env` | `routes/(app)/+layout.svelte:3`, `routes/(app)/renter/listing/+page.svelte:10` | rename | Yes |
| K6 | `$app/paths` `base` removed | `lib/features/shared/app-notice/AppNotice.svelte:18,100` (`isSettingsPath(page.url.pathname, base)`), `lib/features/agent/profile/logo-pipeline.test.ts` | Use `page.route.id` (decision 04-22 already prefers route id over pathname-vs-resolve) or `resolve('/')`; 284 `resolve()` calls and 15 `$app/state` `page` users are unaffected; 0 `$app/stores`, 0 `resolveRoute`, 0 `asset(` | Manual (2 files) |
| K7 | Service worker | `apps/web/src/service-worker.ts` -> `src/service-worker/index.ts`; imports `build, files, prerendered, version` from `$service-worker` -> `version` from `$app/env`, `assets, immutable, prerendered` from `$app/manifest`; filter dotfiles **in the worker** (`assets.filter(a => !/(^|\/)\./.test(a))`) since `serviceWorker.files` is undocumented in Kit 3 (F3); registration becomes `type: 'module'` (Kit's injected script, nothing to do). `scripts/service-worker-guard.test.ts:66-75` currently imports `svelte.config.js` to test the filter: re-point it at the worker's exported filter function. `scripts/assert-csp.mjs` `CARRIERS` still expects `service-worker.js` in the build root; verify the emitted filename. `pwa.spec.ts` ("precache holds only build assets, never dotfiles") is the runtime proof. | Manual |
| K8 | `$app/navigation` | 5 `goto(`, 6 `replaceState(`, 6 `afterNavigate(`; no `goto` call passes `replaceState`/`keepFocus`/`noScroll`/`invalidateAll` options (grep 0), no `invalidateAll`, no `preloadData` | `goto` now rejects for URLs that do not resolve to a route: the 5 sites (`ContactHeader`, `MatchRow`, `MemoPage`, `SnapshotBuilder`, …) pass `resolve()` output already; confirm the `?id=` query forms still resolve. `replaceState` from `$app/navigation` is unchanged. | Verify |
| K9 | Comments/tests that name `svelte.config.js` | `scripts/assert-csp.mjs:3`, `apps/web/src/lib/csp-policy.test.ts:11`, `apps/web/src/lib/ai/models.test.ts:105`, `apps/web/tests/e2e/routes.ts:44,57`, `scripts/service-worker-guard.test.ts` | Update the prose to `vite.config.ts`; the CSP oracle's "deliberate literal duplicate" rule keeps holding (policy literal still lives in `src/lib/csp-policy.js`) | Manual |
| K10 | `app.html` | `data-sveltekit-preload-data="hover"` (value unchanged; only `'off'` -> `false` changed) | none | — |
| K11 | ESLint plugin | `eslint-plugin-svelte` 3.23.0 -> 3.23.1 (latest; no `next` needed). `svelte/no-navigation-without-resolve` keeps working because `resolve` still comes from `$app/paths`; the 8 `eslint-disable` comments and the `satisfies T[]` trick stay. Kit-3-specific rule changes: LOW confidence, check the plugin changelog in the phase. | Verify |
| K12 | Dependency pins | `@sveltejs/kit` 2.70.3 -> 3.1.0; `@sveltejs/adapter-static` 3.0.10 -> 4.0.0 (options `pages/assets/fallback/precompress/strict` unchanged per changelog); `runed` 0.37.1 -> 0.38.0; `svelte` 5.57.0 -> ≥5.57.1 (root, apps/web, apps/extension); `@sveltejs/vite-plugin-svelte` 7.3.0 -> 7.3.1; `svelte-check` 4.7.6 -> 4.7.7; TypeScript stays `~6.0.3`; Node 24 satisfies `>=22.17` | Manual |
| K13 | Audit exceptions | `scripts/lib/audit-exceptions.mjs` and `pnpm-workspace.yaml` `audit.ignore`: remove `GHSA-pxg6-pf52-xh8x` (cookie), `GHSA-pfhg-q3qv-9q6r`, `GHSA-27mw-82g8-phjj`; keep `GHSA-gcqx-w48m-w2h4` (deepmerge) unless vite-plugin-svelte 7.3.1 dropped it; `supply-chain.test.ts` enforces the two lists are equal | Manual |
| K14 | Build outputs the oracles pin | `scripts/assert-csp.mjs` `EXPECTED_PAGES`/`CARRIERS`, `assert-seo.mjs`, `assert-budget.mjs` (60 KB gate with ≈0.5-1.9 KB headroom on tool pages), `routes-drift.spec.ts`; Kit 3 is "Vite 8 + Rolldown" so chunking may shift | Run all three builds + `csp:assert`, `seo:assert`, `budget:assert` before anything else; budget headroom is the likeliest red |
| K15 | Prerender `?id=` shells | `prerender.entries` list of 11 explicit shells moves verbatim into the plugin options | Yes |

**Migration order within the Kit 3 plan:** K12 pins -> `sv migrate` (K2, K5, K1 partial) -> K1 finish + K15 -> K4 -> K7 -> K6 -> K3 -> K9 -> `pnpm check && pnpm lint` -> three builds + K14 oracles -> `pnpm test:unit` -> `pnpm test:e2e` -> K13 -> `pnpm verify` -> `pnpm smoke:local` -> push -> live smoke.

## Section 7: Extension release, what exists and what is missing for `ext-v0.1.0`

**Exists (`.github/workflows/extension-release.yml`, pinned by `scripts/extension-release-gate.test.ts`):** trigger `push.tags: ['ext-v*']`; job `if: vars.EXTENSION_RELEASES_ENABLED == 'true'`; `contents: write` on the job only; no cache; SHA-pinned actions already present in `ci.yml`; tag must equal `apps/extension/package.json` `version` (0.1.0); `pnpm vitest run --project extension` (241 unit tests); `pnpm --filter extension zip` (`sponsored-listing-filter-0.1.0-chrome.zip`); `assert-extension.mjs --zip-dir`; `sha256sum ... > SHA256SUMS.txt`; `gh release create "$TAG" --verify-tag --title ... --notes-file docs/EXTENSION-INSTALL.md` uploading the zip and checksums. Listing copy `apps/extension/store/edge-listing.md`, logo `store/edge-logo-300.png`, install guide `docs/EXTENSION-INSTALL.md` (banned-words gated).

**Missing / recommended:**

| Gap | Fix | Files |
|---|---|---|
| Release notes = the entire install guide | `apps/extension/CHANGELOG.md` (Keep a Changelog); a step extracts the `## 0.1.0` section to `$RUNNER_TEMP/notes.md`, appends the install link, and fails if the section is absent; `--notes-file` points at it | new `CHANGELOG.md`, `extension-release.yml`, gate test ORDER array |
| Release job runs fewer tests than CI | add `playwright install --with-deps chromium`, `pnpm ext:test:browser` (13 popup axe), `pnpm ext:e2e` (7 runtime incl. zero-network) before zipping | `extension-release.yml`, gate test |
| Checksums are written, never verified | `sha256sum -c SHA256SUMS.txt` right after writing | `extension-release.yml`, gate test |
| Popup links to a URL that may not be live | `curl -fsS "$TRAN_ORIGIN/legal/privacy/" \| grep -q 'id="browser-extension"'` with the origin read from `apps/extension/src/lib/config.ts` via `node -p`; this makes the release depend on go-live (correct: 11-HUMAN-UAT item 5 gates item 7) | `extension-release.yml`, gate test ("no hard-coded repository URL" rule: derive, do not literal) |
| Publish is immediate | `gh release create --draft`; owner publishes after checking the zip loads unpacked (11-HUMAN-UAT item 7) | `extension-release.yml`, gate test, `DEPLOY-CHECKLIST.md` Step 9.4 |
| Store screenshots do not exist (owner HUMAN-UAT) | `apps/extension/scripts/make-screenshots.mjs`: Playwright with the production build loaded (`apps/extension/e2e/extension.spec.ts` already launches a persistent context) over the synthetic `e2e/zillow-page.ts`, capture popup and a dimmed card at 1280x800 into `store/screenshots/`; label them "sample page" in the listing notes. Owner decides whether to swap for live captures (Edge policy prefers representative images; synthetic is honest if labelled). | new script + `store/screenshots/`, `edge-listing.md` Assets section, `extension-docs.test.ts` |
| Listing link placeholder in the install guide | stays an owner edit after certification; add a test that the placeholder sentence exists **or** a `https://microsoftedge.microsoft.com/addons/detail/` link exists (never neither) | `scripts/extension-docs.test.ts` |
| Owner decisions | Zillow ToU read (11-HUMAN-UAT 4) gates any public release; "Showcase" badge default (item 3); Firefox stays cut | `DEPLOY-CHECKLIST.md`, `11-HUMAN-UAT.md` |

Every workflow edit must land with its gate-test edit: `extension-release-gate.test.ts` pins the exact ORDER array, "each gate step appears exactly once", `uses:` count 3 and that each SHA is already in `ci.yml` (the Chromium install is a `run:` step, so no new `uses:`).

## Scaling Considerations (adapted: scale = routes, tests, origins)

| Scale axis | Today | What breaks first | Adjustment |
|---|---|---|---|
| Routes (47 pages) | one-test route walks sized `ROUTES.length * 4_000` ms | smoke route walk over a real CDN (≈0.5-2 s per page) | keep `ROUTES.length * 6_000` in smoke; two workers |
| Unit files (394) | 6,647 tests, one parallel run | memory-starved host kills Chromium (observed) | lanes (Section 4); cap Playwright workers in `verify` docs, never retry |
| Origins | 1 (`tranrealestate.github.io`) | a custom domain would drift `TRAN_ORIGIN` | origin-parity test + checklist note; extension release on domain change |
| CI minutes | 3-leg matrix + extension | smoke adds one short job per main push | smoke only on `main` push with Pages enabled; ad-hoc via `smoke.yml` |

## Anti-Patterns

### Anti-Pattern 1: Raising timeouts to make the parallel run green
**What people do:** bump `testTimeout` or a `waitFor` budget until the full run passes once.
**Why it's wrong:** `STATE.md` records this cost a diagnosis round in Phases 3, 8, 10 and 11; `tasks/lessons.md` records `guide.spec.ts:107` written off as a flake that was a real race.
**Do this instead:** move wall-clock assertions to the serial lane; keep assertion values unchanged; for E2E, reproduce under load with a trace, then `expect.poll` for anything set by an intercepted request.

### Anti-Pattern 2: Smoke tests that change state on the live origin
**What people do:** submit the feedback form or save a key in smoke "to prove it works".
**Why it's wrong:** each run emails the owner (Web3Forms 250/month), and keys on the live origin are the asset the CSP protects.
**Do this instead:** smoke is read-only (GET, SW registration, request recording). Delivery and real-key checks stay HUMAN-UAT, run once by the owner.

### Anti-Pattern 3: Importing web-app code into the extension to "share" the origin
**What people do:** make `apps/extension` depend on `apps/web` or `@tran/core` for one string.
**Why it's wrong:** the extension's eslint block, `assert-extension.mjs` bundle oracle and 2.5 KB popup CSP exist to keep the bundle minimal and network-free; `site-config.js` must stay plain Node JS for `scripts/*.mjs`.
**Do this instead:** literal + parity test in the `scripts` project (Pattern 2), the repo's existing convention.

### Anti-Pattern 4: Migrating Kit 3 on an unstable suite or in the same phase as feature debt
**What people do:** combine "while we are in there" fixes with a framework major.
**Why it's wrong:** a 1,100-import codemod plus config relocation plus service-worker rewrite is unreviewable when mixed with behaviour changes; the only reliable oracle is a suite known to be green and deterministic.
**Do this instead:** debt (Phase 14) and lanes (Phase 15) first; toolchain phase with three single-purpose plans; `pnpm verify` + `pnpm smoke:local` after each.

### Anti-Pattern 5: Editing a workflow without its gate test
**What people do:** add a job to `ci.yml` and watch `scripts/workflow-gate.test.ts` fail on "exactly 7 uses".
**Why it's wrong:** the gate tests are the review mechanism for files that never run locally.
**Do this instead:** every workflow change is a two-file commit; update the counts deliberately and add a `describe` for the new job.

## Integration Points

### External Services (new or changed in v1.1)

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub Pages (`tranrealestate.github.io`) | `actions/deploy-pages` -> `outputs.page_url` -> `smoke` job | First-ever run of `ci.yml` on GitHub. Push with `PAGES_ENABLED` unset first; fix CI reds; then set the variable. Propagation: poll `_app/version.json`. |
| GitHub Releases | `gh release create --draft` from `extension-release.yml` | Needs `EXTENSION_RELEASES_ENABLED=true` and the live privacy URL |
| Umami (optional) | smoke asserts one beacon POST to `vars.PUBLIC_ANALYTICS_HOST` when set | dashboard count stays owner; GPC behaviour stays owner |
| Web3Forms | smoke asserts only the "open" form state when `PUBLIC_WEB3FORMS_KEY` is set; never submits | delivery stays owner (10-HUMAN-UAT row 2) |
| Edge Partner Center | owner submits `store/` assets | screenshots generated by script, owner may replace |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `tests/smoke` ↔ `tests/e2e/routes.ts` | relative import | single route list; `routes-drift.spec.ts` keeps it equal to the build |
| `tests/smoke` ↔ `scripts/assert-csp.mjs` | import `checkHtml`, `CARRIERS`, `EXPECTED_PAGES` | the CSP oracle runs on served HTML; no third copy |
| `scripts/origin-parity.test.ts` ↔ `apps/web/src/lib/site-config.js` + `apps/extension/src/lib/config.ts` | import both constants | precedent: `provider-hosts.test.ts`, `brand-parity.test.ts` |
| `backup-roundtrip.spec.ts` ↔ Dexie `tran` DB | raw IndexedDB writes (existing `helpers/data.ts` pattern) + real Settings UI | equality oracle derived from `objectStoreNames` minus `['meta','apiCache']` |
| `package.json test:unit` ↔ `ci.yml` | unchanged `run: pnpm test:unit` | lanes live in the script, gate tests untouched |
| `extension-release.yml` ↔ `apps/extension/src/lib/config.ts` | `node -p` reads `TRAN_ORIGIN` for the live probe | satisfies the gate test's "no hard-coded repository URL" rule |

## What stays human after the smoke suite

Of the 77 HUMAN-UAT rows, the smoke suite converts the mechanical live-origin rows (01 rows 1-2, 02 live checks, 10 rows 4-6 partially, 11 row 5, the DEPLOY-CHECKLIST Step 7 items 1-6) into machine checks. Left for the owner: push-protection probe (server-side), Umami IP-storage answer and GPC behaviour, Web3Forms delivery to a real inbox, real-key CORS per provider (05 H1-H10, 04 U1-U14, 06 R-rows, 07 I-rows), real devices (Android/iOS install, Safari persistence, screen readers), link-preview debuggers, Search Console, Zillow ToU read, live zillow.com smoke, Showcase decision, Edge submission, legal copy reviews. Estimate about 20-25 rows remain, all requiring an account, a device or a judgement.

## Suggested build order (for the roadmapper; phases start at 12)

| Phase | Name | Depends on | Owner gate | Scope (new vs modified) |
|---|---|---|---|---|
| **12** | **Go-live readiness and local smoke suite** | — | **End of phase: owner creates org + repo, pushes `main` with `PAGES_ENABLED` unset, enables Pages source = Actions, secret scanning** | NEW `tests/smoke/*`, `playwright.smoke.config.ts`, `scripts/smoke.mjs`, `smoke:local` script; MODIFIED `DEPLOY-CHECKLIST.md` (add "first CI run without deploy" step); proof = smoke green against `serve-pages` for all three local builds |
| **13** | **Live origin: first CI run, deploy, post-deploy smoke, UAT burn-down** | 12 + owner | Owner sets `PAGES_ENABLED=true` after the first green CI; owner walks the remaining human rows | MODIFIED `ci.yml` (deploy `outputs`, `smoke` job, `web-version` artifact) + `workflow-gate.test.ts`; NEW `smoke.yml`; quick-fix plans for whatever the first GitHub run surfaces (runner memory, Playwright timing, action inputs); GTM-01..04 proof recorded; HUMAN-UAT files updated |
| **14** | **Carried debt** | 12 (none on 13) | none | NEW `scripts/origin-parity.test.ts`, `tests/e2e/backup-roundtrip.spec.ts`, `helpers/seed-all.ts`; MODIFIED `extension-docs.test.ts`/`assert-extension.test.ts` (import `PRIVACY_URL`), tailwind-merge font-size token class (Badge/Button), `ListingCard` address-link id, print recheck without notes, `save-gate.ts:50` reason text, `renter-saved.spec.ts:83` root-cause (trace under load, `expect.poll`) |
| **15** | **Load-deterministic test lanes** | 14 (can overlap: different files) | none | NEW four `*-serial` configs, `scripts/test-lanes.test.ts`; MODIFIED `vitest.config.ts`, `package.json` `test:unit*`, parallel configs' `exclude`, `ResultsView` rename; proof = 3 consecutive full `test:unit` runs under CPU burners green; `ci.yml` untouched |
| **16** | **Toolchain: pnpm 12 -> Vitest 5 -> SvelteKit 3** | 14, 15, and 13 (live smoke must exist to verify the Kit 3 build on the real origin) | none (but the post-deploy smoke is the acceptance) | Three plans in that order; Section 6 inventory; audit exceptions cleared; `pnpm verify` + `smoke:local` after each; a deploy and green live smoke close the phase |
| **17** | **Extension release `ext-v0.1.0`** | 13 (live privacy URL, remote); independent of 14-16, so it can run in parallel with 14/15 | Owner: Zillow ToU read, Showcase decision, set `EXTENSION_RELEASES_ENABLED`, push tag, publish draft, Edge submission | NEW `CHANGELOG.md`, `make-screenshots.mjs`, `store/screenshots/`; MODIFIED `extension-release.yml` + gate test, `edge-listing.md`, `DEPLOY-CHECKLIST.md` Step 9, `extension-docs.test.ts` |

**Ordering rationale:** the owner gate is at the end of Phase 12 (early, as decided), but the smoke suite must exist *before* the origin does so the first deploy is measured, not eyeballed. Phase 13 absorbs the unknowns of the first GitHub run before anything else depends on CI being trustworthy. Debt (14) and lanes (15) precede the toolchain phase (16) because a framework major needs a green, deterministic suite as its oracle, and Kit 3 is last inside 16 because Vitest 5 changes the harness that verifies it. The extension release (17) needs only the live origin and floats after 13; keep it off the critical path like Phase 11 was.

**Research flags for phases:** 13 (first live CI run: expect surprises, no further research possible until it runs), 16 (Kit 3 `serviceWorker.files` fate, `svelte-kit sync` fate, shadcn `#lib` alias support, Rolldown chunking vs the 60 KB budget, Vitest 5 `groupOrder`/`maxWorkers` per project). Phases 12, 14, 15, 17 use patterns already in the repo.

## Sources

- Codebase (HIGH): `.github/workflows/ci.yml`, `.github/workflows/extension-release.yml`, `package.json`, `pnpm-workspace.yaml`, `vitest.config.ts`, `apps/web/{svelte.config.js,vite.config.ts,vitest.browser.config.ts,playwright.config.ts,package.json,tsconfig.json,components.json,src/app.html,src/service-worker.ts,src/lib/site-config.js,src/lib/csp-policy.js,src/lib/base-path.js,src/lib/site.ts,src/lib/storage/backup-registry.ts,src/lib/storage/db.ts,src/lib/testing/app-paths.stub.ts}`, `apps/web/tests/e2e/{routes.ts,routes-drift.spec.ts,routing.spec.ts,csp.spec.ts,pwa.spec.ts,seo.spec.ts,third-party.spec.ts,analytics.configured.spec.ts,settings-backup.spec.ts,site-env.ts,helpers/*,support/*,agent-helpers.ts,investor/helpers.ts}`, `apps/extension/{package.json,wxt.config.ts,vitest.config.ts,vitest.browser.config.ts,playwright.config.ts,src/lib/config.ts,tests/brand-parity.test.ts,store/edge-listing.md}`, `scripts/{assert-csp.mjs,serve-pages.mjs,workflow-gate.test.ts,extension-release-gate.test.ts,extension-docs.test.ts,provider-hosts.test.ts,supply-chain.test.ts,service-worker-guard.test.ts,precommit.test.ts,vitest.config.ts,lib/build-targets.mjs,lib/audit-exceptions.mjs,launch-audit.mjs,audit-evidence.mjs}`, `packages/core/src/{fair-housing/mutation.test.ts,numbers/numbers.property.test.ts}`, `apps/web/src/lib/features/studio/boundaries.test.ts`, `apps/web/src/lib/features/renter/search/ResultsView.browser.test.ts`, `docs/{DEPLOY-CHECKLIST.md,EXTENSION-INSTALL.md}`, `.planning/{PROJECT.md,STATE.md,ROADMAP.md,RETROSPECTIVE.md}`, `.planning/milestones/{v1.0-MILESTONE-AUDIT.md,v1.0-ROADMAP.md,v1.0-research/ARCHITECTURE.md}`, `.planning/phases/{01,10,11}-*/…-HUMAN-UAT.md`, `.planning/phases/10-*/deferred-items.md`, `tasks/lessons.md`.
- [SvelteKit: Migrating to SvelteKit 3](https://svelte.dev/docs/kit/migrating-to-sveltekit-3) (HIGH): config move, `#lib`, `$app/tsconfig`, `$app/env`, `$app/manifest`, removed `base`/`assets`/`resolveRoute`, minimum versions, `sv migrate sveltekit-3`.
- [SvelteKit: Configuration](https://svelte.dev/docs/kit/configuration) (HIGH): `sveltekit({...})` option shape; `paths.origin` new in 3.0; `csrf.checkOrigin`/`preloadStrategy` removed; `serviceWorker.files` not listed.
- [SvelteKit: Service workers](https://svelte.dev/docs/kit/service-workers) (HIGH): `$app/manifest` exports, `type: 'module'` registration, `src/service-worker/tsconfig.json`.
- [SvelteKit: $app/paths](https://svelte.dev/docs/kit/$app-paths) (HIGH): `resolve`, `asset`, `match`; legacy note "`base`, `assets`, and `resolveRoute` were removed in 3.0".
- [adapter-static CHANGELOG](https://github.com/sveltejs/kit/blob/main/packages/adapter-static/CHANGELOG.md) (HIGH): 4.0.0 "breaking: require SvelteKit 3"; no option changes.
- [Vitest: Migration Guide](https://vitest.dev/guide/migration) (HIGH): Vitest 5 breaking list (clearMocks, locators.exact, toHaveTextContent, sequential removed, expect.poll, config lookup, projects `extends`, async `render` in vitest-browser-svelte, removed entry points).
- [Vitest: sequence](https://vitest.dev/config/sequence), [fileParallelism](https://vitest.dev/config/fileparallelism), [Projects](https://vitest.dev/guide/projects) (HIGH for `groupOrder` semantics and `--project` patterns; MEDIUM for per-project `fileParallelism`/`maxWorkers`).
- [actions/deploy-pages README](https://github.com/actions/deploy-pages) (HIGH): `page_url` output, recommended dedicated job with `needs`, `pages: write`, `id-token: write`, `environment.url`; silent on propagation.
- npm registry `npm view … dist-tags/peerDependencies` 2026-10-29 (HIGH): `@sveltejs/kit` 3.1.0 (peers vite ^8.0.12, svelte ^5.57.1, typescript ^6, vite-plugin-svelte ^7; node >=22.17), `@sveltejs/adapter-static` 4.0.0, `runed` 0.38.0 (kit ^3) / 0.37.1 (kit ^2.21), `vitest` 5.0.5 (vite ^6.4\|\|^7\|\|^8; node ^22.12\|\|^24), `@vitest/browser-playwright` 5.0.5 (vitest 5.0.5 exact), `vitest-browser-svelte` 3.1.0 (vitest ^4\|\|^5), `pnpm` 12.16.1, `svelte-check` 4.7.7, `eslint-plugin-svelte` 3.23.1, `@sveltejs/vite-plugin-svelte` 7.3.1, `sv` 1.1.1, `shadcn-svelte` 1.7.1, `bits-ui` 2.20.2, `wxt` 0.21.5.
- Web search summaries used only for orientation (LOW, superseded by the official pages above): SvelteKit 3 RC/migration write-ups; Vitest 5 blog digests; pnpm 12 release post (lockfile/commands carry over from 11 — MEDIUM, not re-verified against the pnpm changelog).

---
*Architecture research for: Tran Real Estate Tools v1.1 Launch & Hardening*
*Researched: 2026-10-29*
