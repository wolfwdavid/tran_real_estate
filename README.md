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
| `packages/core`  | Shared pure logic                                                                                                                       |
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
finishes with `test:e2e` (needs Chromium) and `lint:workflows` (needs actionlint). Do them in
this order.

1. Install dependencies:

   ```sh
   corepack pnpm install
   ```

2. Install the pre-commit hook (gitleaks on staged files plus the real-data guard):

   ```sh
   corepack pnpm hooks:install
   ```

3. Install the Chromium build that Playwright expects, for `test:e2e`:

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

| Command                        | What it does                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm dev`            | Vite dev server for `apps/web`                                                                                                              |
| `corepack pnpm check`          | `svelte-kit sync` plus `svelte-check` and `tsc --noEmit` across the workspace                                                               |
| `corepack pnpm lint`           | Prettier check and ESLint (import boundaries, `fetch` and `{@html}` bans)                                                                   |
| `corepack pnpm banned`         | Banned marketing/legal terms check over routes, components and content                                                                      |
| `corepack pnpm ui:guard`       | Class guard over the shadcn-svelte primitives: brand tokens only, no `dark:`, every animation `motion-safe:`                                |
| `corepack pnpm test:unit`      | Vitest across the `web`, `core`, `brand`, and `scripts` projects                                                                            |
| `corepack pnpm build:root`     | Build for the root origin into `apps/web/build`                                                                                             |
| `corepack pnpm build:sub`      | Build under `BASE_PATH=/tran_real_estate` into `apps/web/build-sub`                                                                         |
| `corepack pnpm csp:assert`     | Assert the CSP contract on every page of both builds                                                                                        |
| `corepack pnpm test:e2e`       | Playwright: routing, CSP, framing, layout (375px/640px, landmarks, footer legal links), marketing content, and axe WCAG A/AA on both builds |
| `corepack pnpm guard`          | Real-data and CoStar guard over every tracked file                                                                                          |
| `corepack pnpm secrets:canary` | Prove the gitleaks config rejects the repository's canary pattern                                                                           |
| `corepack pnpm secrets:scan`   | gitleaks over the full git history                                                                                                          |
| `corepack pnpm lint:workflows` | actionlint over `.github/workflows`                                                                                                         |
| `corepack pnpm verify`         | All of the above in order, as one gate                                                                                                      |

`verify` is `check`, `lint`, `banned`, `ui:guard`, `test:unit`, `build:root`, `build:sub`, `csp:assert`, `test:e2e`,
`guard`, `secrets:canary`, `secrets:scan`, `lint:workflows`. It runs in about three and a half minutes on a
warm machine; the two builds and the two Playwright projects are the bulk of it. CI runs the
same steps, split across a hygiene job and a two-leg quality matrix (root and sub base paths).

## Local data, API keys and backups

- **Keys are session-only by default.** A pasted key lives in this tab's `sessionStorage` and is gone when the tab closes. "Remember on this device" is opt-in and stores keys in a separate `tran-secrets` IndexedDB database, never in the app data database.
- **Optional passphrase.** Remembered keys can be sealed with a passphrase (PBKDF2-SHA-256, 600,000 iterations, wrapping an AES-GCM data key). It protects keys at rest only: anyone using an unlocked tab can still use them. "Forget all keys" clears every open Tran tab.
- **Backups never contain keys.** Export writes a `tran-backup-v1` JSON file from the registered app tables only, and refuses to download if any key-shaped value or known key appears. Import shows a preview and offers Merge (newer edit wins) or Replace (after a confirmation).
- **The PWA service worker never touches API traffic.** It precaches same-origin build assets only and ignores every cross-origin request.
- **Where the code lives:** `apps/web/src/lib/storage/` (Dexie database, persistence, backup; the key vault is in `storage/secrets/`), `packages/core/src/backup/` (envelope, migrations, merge/replace diff, key scan), and `apps/web/src/service-worker.ts`.
- **UI gate:** `corepack pnpm ui:guard` scans the copied-in shadcn-svelte primitives in `apps/web/src/lib/components/ui/` and fails on raw palette colors, `dark:` variants, `ring-ring/*` focus styles and animations without `motion-safe:`. Before running `shadcn-svelte add` in a later phase, follow the add procedure in `.planning/phases/03-local-platform-storage-key-vault-backup/03-06-SUMMARY.md` (back up `app.css` and `package.json`, add with `--no-deps-install`, restore `app.css`, re-pin exact versions), then run `ui:guard` before committing.

## Routes

Every page is prerendered with a trailing slash. Thirteen pages ship today:

| Route                   | Group                                             |
| ----------------------- | ------------------------------------------------- |
| `/`                     | Marketing (landing)                               |
| `/for-renters/`         | Marketing                                         |
| `/for-investors/`       | Marketing                                         |
| `/for-agents/`          | Marketing                                         |
| `/legal/privacy/`       | Legal                                             |
| `/legal/terms/`         | Legal                                             |
| `/legal/fair-housing/`  | Legal                                             |
| `/legal/data-coverage/` | Legal                                             |
| `/renter/`              | App (placeholder until Phase 6)                   |
| `/investor/`            | App (placeholder until Phase 7)                   |
| `/agent/`               | App (placeholder until Phases 8-9)                |
| `/settings/`            | App: keys, key security, backup, storage, install |
| `/print/`               | Chrome-free print surface                         |

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
