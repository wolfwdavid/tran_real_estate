# Tran Real Estate Tools

A static SvelteKit app with three portals (Renter, Investor, Agent) for people who want
matching listings, deal math, and outreach drafts without refreshing listing sites all day.

There is no backend. Every route is prerendered and served from GitHub Pages on its own origin.
Users bring their own RentCast and model-provider keys, and those keys stay in the user's
browser: a strict Content-Security-Policy meta tag on every page limits `connect-src` to the
provider hosts, and the app refuses to render inside a third-party frame.

This repository is a pnpm workspace:

| Path             | What it is                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`       | The SvelteKit app (adapter-static), its E2E specs, and Playwright config                                                                |
| `packages/core`  | Shared pure logic: backup, RentCast budget and request rules, listings, saved-search alerts                                             |
| `packages/brand` | Design tokens (colors, fonts, radii, shadows) and the WCAG contrast gate; mirrored in `apps/web/src/app.css` `@theme` and parity-tested |
| `scripts`        | Build, CSP assertion, Pages emulator, secret and real-data guards, workflow lint                                                        |
| `docs`           | Owner runbooks such as the deploy checklist                                                                                             |

## Prerequisites

- **Node 24** (`.nvmrc`). The `engines` field pins `>=24 <25`.
- **pnpm 11.27.0** through corepack. `package.json` pins `packageManager`; use `corepack pnpm`
  for every command below so the pinned version is the one that runs.
- **gitleaks 8.30.1** on `PATH`. The pre-commit hook and the unit suite fail closed without it.
  On Windows: `winget install --id Gitleaks.Gitleaks -e`. On other platforms use the release
  binary for that exact version.

## Setup

All four steps are required before `corepack pnpm verify` can pass end to end, because `verify`
runs browser component tests and `test:e2e` (both need Chromium) and finishes with
`lint:workflows` (needs actionlint). Do them in this order.

1. Install dependencies:

   ```sh
   corepack pnpm install
   ```

2. Install the pre-commit hook (gitleaks on staged files plus the real-data guard):

   ```sh
   corepack pnpm hooks:install
   ```

3. Install the Chromium build that Playwright expects, for the `web-browser` Vitest project and
   `test:e2e`:

   ```sh
   corepack pnpm --filter web exec playwright install chromium
   ```

4. Install actionlint 1.7.12 into the gitignored `.tools/` directory, for `lint:workflows`:

   ```sh
   gh release download v1.7.12 -R rhysd/actionlint -p 'actionlint_1.7.12_windows_amd64.zip' -D .tools
   ```

   then extract `actionlint.exe` into `.tools/`. On other platforms pick the matching asset name
   from that release. Alternatively set `ACTIONLINT_BIN` to an actionlint binary. The workflow
   lint fails closed when the linter is absent; it never skips.

Then run the whole gate:

```sh
corepack pnpm verify
```

## Commands

| Command                        | What it does                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `corepack pnpm dev`            | Vite dev server for `apps/web`                                                                                                       |
| `corepack pnpm check`          | `svelte-kit sync` plus `svelte-check` and `tsc --noEmit` across the workspace                                                        |
| `corepack pnpm lint`           | Prettier check and ESLint (import boundaries, `fetch` and `{@html}` bans)                                                            |
| `corepack pnpm banned`         | Banned marketing/legal terms check over routes, components and content                                                               |
| `corepack pnpm ui:guard`       | Class guard over the shadcn-svelte primitives: brand tokens only, no `dark:`, every animation `motion-safe:`                         |
| `corepack pnpm test:unit`      | Vitest across the `web`, `web-browser`, `core`, `brand`, and `scripts` projects                                                      |
| `corepack pnpm build:root`     | Build for the root origin into `apps/web/build`                                                                                      |
| `corepack pnpm build:sub`      | Build under `BASE_PATH=/tran_real_estate` into `apps/web/build-sub`                                                                  |
| `corepack pnpm csp:assert`     | Assert the CSP contract on every page of both builds                                                                                 |
| `corepack pnpm test:e2e`       | Playwright: routing, CSP, framing, layout, marketing content, settings, data status and RentCast usage, axe WCAG A/AA on both builds |
| `corepack pnpm guard`          | Real-data and CoStar guard over every tracked file                                                                                   |
| `corepack pnpm fixtures:gen`   | Regenerate the synthetic sample data in `apps/web/src/lib/data/fixtures/` from `scripts/gen-fixtures.mjs`                            |
| `corepack pnpm fixtures:check` | Drift check: fail if the committed sample data differs from what the generator produces (part of `verify`)                           |
| `corepack pnpm secrets:canary` | Prove the gitleaks config rejects the repository's canary pattern                                                                    |
| `corepack pnpm secrets:scan`   | gitleaks over the full git history                                                                                                   |
| `corepack pnpm lint:workflows` | actionlint over `.github/workflows`                                                                                                  |
| `corepack pnpm verify`         | All of the above in order, as one gate                                                                                               |

`verify` is `check`, `lint`, `banned`, `ui:guard`, `test:unit`, `build:root`, `build:sub`, `csp:assert`, `test:e2e`,
`guard`, `fixtures:check`, `secrets:canary`, `secrets:scan`, `lint:workflows`. It runs in about four minutes on a
warm machine; the two builds and the two Playwright projects are the bulk of it. CI runs the
same steps, split across a hygiene job and a two-leg quality matrix (root and sub base paths).

The browser component tests (`*.browser.test.ts`, the `web-browser` project) run inside
`corepack pnpm test:unit` in real Chromium, so `test:unit` also needs
`corepack pnpm --filter web exec playwright install chromium`.

## Local data, API keys and backups

- **Keys are session-only by default.** A pasted key lives in this tab's `sessionStorage` and is gone when the tab closes. "Remember on this device" is opt-in and stores keys in a separate `tran-secrets` IndexedDB database, never in the app data database.
- **Optional passphrase.** Remembered keys can be sealed with a passphrase (PBKDF2-SHA-256, 600,000 iterations, wrapping an AES-GCM data key). It protects keys at rest only: anyone using an unlocked tab can still use them. "Forget all keys" clears every open Tran tab.
- **Backups never contain keys.** Export writes a `tran-backup-v1` JSON file from the registered app tables only, and refuses to download if any key-shaped value or known key appears. Import shows a preview and offers Merge (newer edit wins) or Replace (after a confirmation).
- **The PWA service worker never touches API traffic.** It precaches same-origin build assets only and ignores every cross-origin request.
- **Where the code lives:** `apps/web/src/lib/storage/` (Dexie database, persistence, backup; the key vault is in `storage/secrets/`), `packages/core/src/backup/` (envelope, migrations, merge/replace diff, key scan), and `apps/web/src/service-worker.ts`.
- **UI gate:** `corepack pnpm ui:guard` scans the copied-in shadcn-svelte primitives in `apps/web/src/lib/components/ui/` and fails on raw palette colors, `dark:` variants, `ring-ring/*` focus styles and animations without `motion-safe:`. Before running `shadcn-svelte add` in a later phase, follow the add procedure in `.planning/phases/03-local-platform-storage-key-vault-backup/03-06-SUMMARY.md` (back up `app.css` and `package.json`, add with `--no-deps-install`, restore `app.css`, re-pin exact versions), then run `ui:guard` before committing.

## Data layer (RentCast, sample data, budget)

- **Sample mode without a key.** With no RentCast key saved, every data request is answered from
  synthetic fixtures (fictional addresses, generated by `scripts/gen-fixtures.mjs`, dates shifted
  relative to today at load) and the status bar shows a "Sample data" badge. Sample mode never
  touches the network and never spends a call. Never commit real RentCast responses.
- **Bring your own RentCast key.** Paste a key in Settings → API keys. **Test key** is free: it asks
  RentCast for market data on the never-assigned ZIP `00000`, so a valid key gets a 404 that
  RentCast does not bill; 401 means invalid, 403 means the key is restricted, and a 200 would be
  billed and is labelled as 1 call.
- **One gateway, metered.** Every RentCast call goes through the data gateway in
  `apps/web/src/lib/data/`: cache first, then a ledger reservation, then the fetch. Settings →
  RentCast usage shows "N of 50 calls used this month" (this browser only; the RentCast dashboard
  is authoritative), and buttons that spend show their cost first.
- **Cap.** The default cap is 40 of the free plan's 50 calls, editable in Settings. Past the cap,
  every call asks for confirmation; a cap above 50 shows the possible overage cost first.
- **Cache.** Identical requests are served from the local cache with their original "as of" time
  and a "Refresh (1 call)" option. Lifetimes: listings 24 hours, estimates 7 days, market data
  30 days, no-result (404/400) answers 24 hours.
- **Saved-search alerts.** Due saved searches are checked when the app opens, at most once per
  24 hours each, inside the cap; more than 3 due asks first.
- **Backups.** The RentCast call history, saved searches, saved search results and data settings
  are in backups; the response cache (`apiCache`) is deliberately excluded. A schema-registry test
  fails if a new table is neither registered nor excluded.
- **Where the code lives:** `packages/core/src/{budget,request,listings,alerts}/` (pure rules),
  `apps/web/src/lib/data/` (gateway, ledger, cache, scheduler, runtime, RentCast client and
  schemas, fixtures), `apps/web/src/lib/features/shared/data/` (meter, status bar, dialogs).
- **Owner real-key checks** (billing behaviour that only a real key can show) are listed in
  `.planning/phases/04-data-layer-rentcast-gateway-budget-guard-demo-fixtures/04-HUMAN-UAT.md`.

## Routes

Every page is prerendered with a trailing slash. Thirteen pages ship today, plus the `404.html`
fallback (14 HTML files per build, all checked by `csp:assert`):

| Route                   | Group                                                             |
| ----------------------- | ----------------------------------------------------------------- |
| `/`                     | Marketing (landing)                                               |
| `/for-renters/`         | Marketing                                                         |
| `/for-investors/`       | Marketing                                                         |
| `/for-agents/`          | Marketing                                                         |
| `/legal/privacy/`       | Legal                                                             |
| `/legal/terms/`         | Legal                                                             |
| `/legal/fair-housing/`  | Legal                                                             |
| `/legal/data-coverage/` | Legal                                                             |
| `/renter/`              | App (placeholder until Phase 6)                                   |
| `/investor/`            | App (placeholder until Phase 7)                                   |
| `/agent/`               | App (placeholder until Phases 8-9)                                |
| `/settings/`            | App: keys, RentCast usage, key security, backup, storage, install |
| `/print/`               | Chrome-free print surface                                         |

Adding or removing a page means updating two lists as well: `apps/web/tests/e2e/routes.ts`
(a drift test fails if the build and the list disagree) and `EXPECTED_PAGES` in
`scripts/assert-csp.mjs`.

The fonts (Fraunces for headings, Inter for body text) are self-hosted through Fontsource, so
the site makes no third-party requests.

## End-to-end ports

`test:e2e` starts `scripts/serve-pages.mjs`, a small GitHub Pages emulator, on three loopback
ports:

| Port | Serves                                                  | Override            |
| ---- | ------------------------------------------------------- | ------------------- |
| 4273 | `apps/web/build` at `/`                                 | `E2E_PORT_ROOT`     |
| 4274 | `apps/web/build-sub` at `/tran_real_estate`             | `E2E_PORT_SUB`      |
| 4275 | An attacker page that frames the root origin three ways | `E2E_PORT_ATTACKER` |

The defaults sit 100 above the Vite preview defaults (4173 and up) because those ports belong to
another project on the original development machine. The emulator reproduces the Pages
behaviours that `vite preview` does not: a directory without a trailing slash answers 301, an
unknown path serves `404.html` with status 404, and `.nojekyll` is honoured.

## Windows notes

- If the machine `PATH` omits `C:\Windows\System32`, Playwright cannot find `taskkill` and its
  web-server teardown appears to hang. `apps/web/playwright.config.ts` guards this inside the
  runner, so no machine change is required for the suite.
- Never set `BASE_PATH` from Git Bash: MSYS rewrites a leading `/` as a Windows path. Use
  `corepack pnpm build:root` and `corepack pnpm build:sub`, which set it internally.
- `pnpm install` reporting "Already up to date" skips the `prepare` step. On a stale checkout
  run `corepack pnpm check` (which runs `svelte-kit sync`) before `corepack pnpm test:unit`.

## Not wired yet

- **No remote.** This repository has no `origin` and is never pushed by automation. Adding the
  remote is an owner step.
- **No Pages deploy.** The `deploy` job in `.github/workflows/ci.yml` is dormant until the
  repository variable `PAGES_ENABLED` is set to `true`, and even then it runs only for pushes to
  `main` after every other job passes.
- **No analytics host, no provider keys.** The analytics beacon host joins `connect-src` in
  Phase 10; RentCast and Web3Forms keys are entered by each user in the browser and never live
  in this repository.

The ordered owner runbook for the hosting steps, and the live-origin checks to record once the
site is up, is in [`docs/DEPLOY-CHECKLIST.md`](docs/DEPLOY-CHECKLIST.md).
