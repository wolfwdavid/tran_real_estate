# Phase 1: Foundation, Origin & Security Baseline - Research

**Researched:** 2026-09-13
**Domain:** pnpm-workspace SvelteKit 2 static site (adapter-static) with meta CSP, anti-framing, local-first quality and secret gates, gated GitHub Pages deploy
**Confidence:** HIGH (core mechanics were verified by building and browser-testing a prototype with the exact version pins on this machine; see "Verification Evidence")

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Repo & Deploy (no org yet)
- `BASE_PATH` env var defaults to `''` (org root site `tranrealestate.github.io/`). CI and the local E2E suite ALSO run the built site under a non-root base path (`/tran_real_estate`) to prove base-path safety (no hard-coded root links, assets resolve, deep-link refresh works).
- Deploy workflow (`.github/workflows/deploy.yml` or a job in CI) is fully written using `actions/upload-pages-artifact` + `actions/deploy-pages`, with `concurrency` set, but runs only when repository variable `PAGES_ENABLED == 'true'`. It is a no-op until the owner enables it, so it never fails or blocks.
- No git remote is added and nothing is pushed. Local commits only.
- Toolchain pinned: Node 24 via `.nvmrc` (and `engines`), pnpm `11.27.0` via `packageManager` field (Corepack). The local machine currently has pnpm 11.0.9, so use Corepack to honor the pin, or document if unavailable.

### Security Baseline
- CSP via SvelteKit `kit.csp` in hash mode, emitted as a `<meta http-equiv="Content-Security-Policy">` on every prerendered page. `connect-src 'self'` plus exactly: `https://api.rentcast.io`, `https://api.anthropic.com`, `https://api.openai.com`, `https://generativelanguage.googleapis.com`, `https://openrouter.ai`, `https://api.web3forms.com`. The analytics beacon host is NOT added now; Phase 10 adds it. Also `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self' https://api.web3forms.com`, `script-src 'self'` + hashes, no `unsafe-inline`/`unsafe-eval` for scripts. A CI assertion (node script over `build/**/*.html`) fails if the meta tag is missing, not first in `<head>`, contains `unsafe-inline`/`unsafe-eval` in script-src, or `connect-src` differs from the allowlist. Research flag: confirm `kit.csp` meta emission on prerendered adapter-static pages and style-src handling (Svelte transitions / Tailwind may need `style-src` consideration — resolve in research).
- Anti-framing: standard anti-clickjacking pattern. `html` hidden by default via CSS, and a small hash-allowed inline script reveals the page only when `window.self === window.top`, otherwise attempts `top.location = self.location`. Meta CSP cannot use `frame-ancestors`, so this is the only mitigation. Covered by a Playwright test that loads a page inside an iframe from another origin/port and asserts the app content is not visible.
- Secret scanning: gitleaks in CI plus a local pre-commit hook (e.g., `simple-git-hooks` or `lefthook`) that runs gitleaks on staged changes. GitHub secret-scanning push protection is enabled later with the org (deferred owner action).
- Real-data guard: custom Node script run in CI and pre-commit that fails on real-looking emails (anything not `@example.com`/`@example.org`/`.test`) and US phone numbers (anything not `555-01xx`) inside fixture/data directories, plus a path rule failing on any file path matching `*costar*` (case-insensitive). `.gitignore` already ignores `data/costar/`.

### Skeleton Scope & Quality Gates
- Placeholder routes (all prerendered, no `[param]` routes): `(marketing)/` → `/`; `(app)/renter/`, `(app)/investor/`, `(app)/agent/`, `(app)/settings/`; `(print)/print/`; plus a branded-placeholder `404`. `trailingSlash: 'always'`, `.nojekyll` emitted into the build output.
- Tooling: ESLint flat config (+ `eslint-plugin-svelte`, `typescript-eslint`), Prettier (+ svelte plugin), `svelte-check`, Vitest 4.1.x, Playwright 1.63 + `@axe-core/playwright`. ESLint rules: `no-restricted-imports` import boundaries (portals may import only their feature folder + shared; marketing group may not import storage/AI/data modules), a ban on `fetch(` outside designated adapter folders, and a ban on `{@html}` outside a single sanitizer module (`svelte/no-at-html-tags` with an allowlisted file). A Vitest global setup makes `fetch` throw so no test hits the network.
- Workspace packages created now: `apps/web` (SvelteKit), `packages/core` (pure TS, no DOM; a trivial exported function + test to prove wiring), `packages/brand` (stub exporting an empty token map). `apps/extension` is NOT created until Phase 11.
- Styling: Tailwind CSS 4.3 installed and wired via `@tailwindcss/vite` with an empty `@theme`. Placeholder pages are minimal and unstyled beyond defaults. Brand tokens, fonts, and shadcn-svelte arrive in Phase 2 via UI/UX Pro Max.

### Stack Pins (from research, authoritative)
- SvelteKit 2.70.x, Svelte 5.57.x, adapter-static 3.0.x, Vite 8.3.x, TypeScript `~6.0.3` (NOT 7.x), Vitest 4.1.x (NOT 5.x). Do not use the SvelteKit 3 RC or `sv@next`.

### Claude's Discretion
- Exact CI job layout (single workflow vs. split ci/deploy), pre-commit tool choice (simple-git-hooks vs. lefthook), static server used for local E2E (`vite preview` vs. `sirv-cli`), and script names in `package.json`.

### Deferred Ideas (OUT OF SCOPE)
- Creating the GitHub org, enabling Pages, setting `PAGES_ENABLED=true`, enabling push protection, adding a remote, and pushing are owner actions after the org exists.
- Analytics beacon host in CSP comes in Phase 10.
- `apps/extension` workspace package comes in Phase 11.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-01 | Visitor can load the app at `tranrealestate.github.io` with every route prerendered and deep-link refresh working (base path configurable via environment variable) | `svelte.config.js` pattern (env `BASE_PATH`, validated), root `+layout.ts` `prerender`/`trailingSlash`, `fallback: '404.html'` for branded not-found, `.nojekyll` + `include-hidden-files: true`. The GitHub Pages emulator (`serve-pages.mjs`) reproduces 301 trailing-slash redirects and 404.html with status 404. It was verified under `/` and `/tran_real_estate`. Org root requires repo name `tranrealestate.github.io`. |
| FND-02 | Every deployed page carries a strict CSP meta tag whose `connect-src` allows only the listed hosts (analytics host added Phase 10) | Verified `kit.csp` hash-mode meta emission on all prerendered pages, including the `404.html` fallback. The meta sits at the `%sveltekit.head%` position, so place that placeholder directly after `<meta charset>`. `style-src-attr 'unsafe-inline'` is required for Svelte 5 transitions. The `assert-csp.mjs` script was verified against good and mutated builds. |
| FND-03 | App refuses to render inside a third-party frame | `<html hidden>` + external same-origin `frame-guard.js`, verified hidden in plain, sandboxed (no scripts) and sandboxed-with-scripts cross-origin iframes. Chromium blocks the `top.location` bust without a user gesture, and the content stays hidden. A Playwright framing spec was written against a third port. |
| FND-04 | Every push runs typecheck, lint, unit, E2E and a11y checks; deploys to Pages only when all pass | `ci.yml` validated with actionlint 1.7.12 (exit 0). The deploy job is gated by `vars.PAGES_ENABLED == 'true'` + `needs`. Actions are SHA-pinned (SHAs resolved). The ESLint 10 flat config rules were verified. Vitest `setupFiles` (not `globalSetup`) blocks `fetch`. Playwright + axe verified. |
| FND-05 | Repository blocks committed secrets and real listing or CoStar data | gitleaks 8.30.1 binary (CI: pinned + SHA-256; not `gitleaks-action`, which needs a license for org repos). `simple-git-hooks` pre-commit blocked a staged canary key (exit 1). `gitleaks stdin` canary self-test exits 1. `guard-real-data.mjs` caught a fixture email and a CoStar-named path, and passed a clean set. Push protection is a deferred owner action. |
</phase_requirements>

## Summary

The phase is well-trodden territory, but four details in CONTEXT.md do not survive contact with the current SvelteKit 2.70.3 source and a real browser. I built a prototype with the exact pins (Kit 2.70.3, Svelte 5.57.0, adapter-static 3.0.10, Vite 8.3.0, Tailwind 4.3.3, TS 6.0.3). I built it under both `BASE_PATH=''` and `/tran_real_estate`, served it through a GitHub-Pages-behavior emulator, and ran Playwright 1.63.0 + axe 4.13.0 against it: 8/8 checks passed with zero CSP violations after the adjustments below.

(1) `kit.csp` emits the CSP `<meta>` at the `%sveltekit.head%` position, not at the top of `<head>`. So "first in `<head>`" is achievable only by placing `%sveltekit.head%` immediately after `<meta charset>`. (2) `kit.csp` does NOT hash inline `<script>`/`<style>` written in `app.html`: it hashes only its own hydration boot script plus Svelte SSR hashes. A "hash-allowed inline script" in `app.html` would be blocked. An inline `<style>` would be blocked too by `style-src 'self'`, and the page would show inside frames (fail-open). The verified fix is `<html hidden>` + `<script src="%sveltekit.assets%/frame-guard.js">`, which `'self'` covers with no hash maintenance. (3) Svelte 5 transitions apply inline style attributes, blocked under `style-src 'self'` (observed `style-src-attr` violation). Adding `style-src-attr 'unsafe-inline'` keeps `style-src`/`script-src` strict and removes the violation. (4) A Vitest *global* setup cannot stub `fetch` for tests; it must be a `setupFiles` entry.

Tooling findings that change plans:
- **gitleaks in CI:** `gitleaks-action` requires a `GITLEAKS_LICENSE` for organization repos, so CI should download the pinned gitleaks binary with a checksum.
- **Hooks on pnpm 11:** pnpm 11 fails install (`ERR_PNPM_IGNORED_BUILDS`, exit 1) on dependency postinstall scripts. `pnpm-workspace.yaml` needs an `allowBuilds` entry for the hook tool.
- **`.nojekyll`:** `actions/upload-pages-artifact@v5` excludes dotfiles by default, so `.nojekyll` needs `include-hidden-files: true`.
- **Windows base path:** on this Windows machine, Git Bash rewrites `BASE_PATH=/tran_real_estate` into `C:/Program Files/Git/tran_real_estate`. Base-path builds must set the env from Node, not the shell.
- **Hook tool:** `lefthook` could not run (its pnpm-installed Windows package had no `lefthook.exe`); `simple-git-hooks` worked end to end.
- **Local gitleaks:** gitleaks is not installed locally but is available via `winget install Gitleaks.Gitleaks` (8.30.1).

**Primary recommendation:** Build exactly the verified configuration in "Code Examples". Put `%sveltekit.head%` right after `<meta charset>`, use `<html hidden>` + external `frame-guard.js`, and add `style-src-attr 'unsafe-inline'`. Serve E2E through the Pages emulator on configurable ports. Gate hooks with `simple-git-hooks` + `allowBuilds`, and run gitleaks as a pinned binary.

## Findings That Refine or Contradict CONTEXT.md (flagged, not silently changed)

| # | CONTEXT.md says | Evidence | Recommended handling |
|---|-----------------|----------|----------------------|
| D1 | CSP meta must be "first in `<head>`" | Kit source `render.js` `Head.build()` puts `http_equiv` first *within* `%sveltekit.head%`. Prototype output shows it after whatever precedes the placeholder in `app.html`. | Place `%sveltekit.head%` directly after `<meta charset="utf-8" />`. The assertion becomes: "the CSP meta is the first element in `<head>`; only `<meta charset>` may precede it." `<meta charset>` must stay first for encoding detection, and it is not script/style. The assertion script was verified to catch a `<script>` placed before the meta. |
| D2 | Anti-framing = "`html` hidden via CSS + small hash-allowed inline script" | Kit's `csp.js` hashes only content passed to `add_script` (its init script) and Svelte SSR hashes. The prototype's `app.html` inline script got no hash. Placed after the CSP meta, inline `<style>` is blocked by `style-src 'self'`. | Same pattern, different mechanism: `<html lang="en" hidden>` + `<script src="%sveltekit.assets%/frame-guard.js"></script>` (static file, allowed by `'self'`). The browser's `[hidden]` UA rule does the hiding, and Tailwind preflight reinforces it with `!important`. It fails closed in sandboxed frames. Verified in Chromium. If the owner insists on inline, manually computed hashes would need `script-src` and `style-src` entries kept in sync with the file (brittle; not recommended). |
| D3 | `style-src` handling "resolve in research" | Svelte 5 transitions use WAAPI plus inline style attributes, and a real `style-src-attr inline` violation was observed with `style-src 'self'`. Kit docs say leave `style-src` unset or add `unsafe-inline`. MDN: `style-src-attr` governs only `style="..."`/`setAttribute('style')`/`cssText`, is Baseline widely available (Dec 2022), and does not govern `<style>` or `<link>`. | Directives: `style-src 'self'` + `style-src-attr 'unsafe-inline'`. There are zero violations after the change (verified). Do not add `unsafe-inline` to `style-src` or `style-src-elem`. The CI assertion allows `style-src-attr` to be exactly `'unsafe-inline'` and nothing else. |
| D4 | "A Vitest global setup makes `fetch` throw" | Vitest 4 docs: `globalSetup` "is running in a different global scope before test workers are even created, so your tests don't have access to global variables defined here." `setupFiles` "run before each test file in the same process." | Use `setupFiles: ['<root>/tooling/vitest/no-network.ts']` in every Vitest project, plus a wiring test per project asserting `fetch` throws. |
| D5 | "gitleaks in CI" | gitleaks-action README: "If you are scanning repos that belong to an organization account, you will need to obtain a free license key" (`GITLEAKS_LICENSE`). | Download the gitleaks 8.30.1 binary in CI with a SHA-256 check (linux_x64 `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb`). No license and no third-party action. |
| D6 | `.nojekyll` emitted into build output | `upload-pages-artifact` `action.yml`: `include-hidden-files` defaults to `false` and tar excludes `.[^/]*`. | `static/.nojekyll` (lands in `build/`, verified) + `include-hidden-files: true` on the upload step. |
| D7 | `trailingSlash: 'always'` (reads like a config key) | In Kit 2 `trailingSlash` is a page option; the configuration reference has no such key. | `export const trailingSlash = 'always'` in `src/routes/+layout.ts` alongside `export const prerender = true`. |
| D8 | Org root site at `tranrealestate.github.io/` with `BASE_PATH=''` | GitHub docs: user/org sites "must be stored in a repository named `<owner>.github.io`". Other repos publish at `/<repositoryname>`. | Add to the deferred owner checklist: the repo must be named `tranrealestate.github.io`, or the deploy must build with `BASE_PATH=/<repo>`. The non-root test already proves that path works. |
| D9 | pnpm 11.27.0 "via Corepack" | Verified: `corepack pnpm --version` → `11.27.0`, and the global pnpm 11.0.9 run inside a dir with `packageManager: pnpm@11.27.0` also reports `11.27.0` (self-switching). | Either works. Keep `packageManager` and `engineStrict: true`; no `corepack enable` is required on this machine. |

## Standard Stack

All versions verified with `npm view` on 2026-09-13 and installed together via `pnpm@11.27.0` in a scratch workspace, with no peer conflicts.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sveltejs/kit` | 2.70.3 | Framework, prerender, `kit.csp` | Locked; peers `vite ^8`, `typescript ^6` |
| `svelte` | 5.57.0 | UI runtime | Locked |
| `@sveltejs/adapter-static` | 3.0.10 | Static output for Pages | Locked; `fallback`, `strict` |
| `vite` | 8.3.0 | Build (rolldown) | Locked; required by vite-plugin-svelte 7 |
| `@sveltejs/vite-plugin-svelte` | 7.3.0 | Svelte in Vite | Kit peer |
| `typescript` | ~6.0.3 (resolves 6.0.3) | Types | `latest` is 7.0.2; do not install it |
| `tailwindcss` + `@tailwindcss/vite` | 4.3.3 | Styling pipeline (external CSS file, verified) | Locked |
| Node | 24 (`.nvmrc` `24`; local 24.18.0) | Runtime | ESLint 10 engines `^20.19 \|\| ^22.13 \|\| >=24` |
| pnpm | 11.27.0 (`packageManager`) | Workspace | Locked; `latest` is 12.4.1, so do not upgrade |

### Supporting (quality gate)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `eslint` | 10.10.0 | Lint (flat config only) | `@eslint/js@10` peers `eslint ^10` |
| `@eslint/js` | 10.0.1 | Base rules | Pair with ESLint 10 |
| `typescript-eslint` | 8.70.0 | TS lint | Peers `typescript >=4.8.4 <6.1.0`, `eslint ^8.57 \|\| ^9 \|\| ^10` |
| `eslint-plugin-svelte` | 3.23.0 | Svelte lint, `svelte/no-at-html-tags` | Peers `eslint ^10` OK |
| `eslint-config-prettier` | 10.1.8 | Disable style rules | With Prettier |
| `globals` | 17.12.0 | Browser/node globals | Flat config |
| `prettier` | 3.9.6 | Format | |
| `prettier-plugin-svelte` | 4.1.1 | Svelte format | Peers `svelte ^5` |
| `prettier-plugin-tailwindcss` | 0.8.1 | Class sort | Must be listed LAST; needs `tailwindStylesheet` |
| `svelte-check` | 4.7.6 | Typecheck `.svelte` | Peers `typescript ^5 \|\| ^6` |
| `vitest` | 4.1.11 | Unit tests | `latest` is 5.0.0, so do not upgrade |
| `@playwright/test` | 1.63.0 | E2E | Chromium headless shell v1243 installed locally during research |
| `@axe-core/playwright` | 4.13.0 | a11y (axe-core 4.13.0) | Default import works in ESM (verified) |
| `simple-git-hooks` | 2.14.0 | Pre-commit hook installer | Verified end to end on Windows Git Bash |
| `@types/node` | ^24 (resolves 24.13.4) | Node types for scripts/configs | Match Node 24 (latest `26.x` is for Node 26) |

### Non-npm tools
| Tool | Version | Purpose | Install |
|------|---------|---------|---------|
| gitleaks | 8.30.1 | Secret scan (CI + pre-commit) | Local: `winget install --id Gitleaks.Gitleaks -e` (winget package verified, **not installed**). CI: release tarball + SHA-256 |
| actionlint | 1.7.12 | Validate workflow YAML locally (no remote CI yet) | `gh release download v1.7.12 -R rhysd/actionlint -p 'actionlint_1.7.12_windows_amd64.zip'` into a gitignored `.tools/`, or `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12` (Docker 29.7.2 present; docker path not tested) |

### GitHub Actions (latest releases resolved to commit SHAs via GitHub API)
| Action | Tag | Commit SHA |
|--------|-----|------------|
| actions/checkout | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| actions/setup-node | v7.0.0 | `820762786026740c76f36085b0efc47a31fe5020` |
| pnpm/action-setup | v6.1.0 | `ea17c68df8912ef543352723c149a84f56e3d413` |
| actions/upload-pages-artifact | v5.0.0 | `fc324d3547104276b827a68afc52ff2a11cc49c9` |
| actions/deploy-pages | v5.0.1 | `368f82528645a54fb793d4d04e342629a3f51346` |
| actions/configure-pages | v6.0.0 | `45bfe0192ca1faeb007ade9deae92b16b8254a0d` (optional; not needed for a pre-built static artifact) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| simple-git-hooks | lefthook 2.1.12 | lefthook has richer job config, but locally `pnpm exec lefthook install` crashed: `spawn ...lefthook-windows-x64\bin\lefthook.exe ENOENT` (the pnpm-installed platform package had no exe; root cause not investigated). simple-git-hooks is pure Node and verified. |
| Pages emulator script (`serve-pages.mjs`) | `vite preview` | Kit's preview middleware (read from source) honors `paths.base` but uses **307** redirects for trailing slashes. For unknown paths it falls through to **SSR** (`server.respond`), which sends CSP as an HTTP header, not the built `404.html`. That hides exactly the bugs this phase must catch. |
| Pages emulator script | `sirv-cli` 3.0.1 | sirv serves files but does not emulate Pages' "directory without slash → 301" or "missing path → site `404.html` with status 404". |
| gitleaks binary in CI | `gitleaks/gitleaks-action@v3` | Requires a `GITLEAKS_LICENSE` for org repos (sign-up form). The binary is license-free and pinnable. |
| One `ci.yml` with a gated deploy job | Separate `deploy.yml` on `workflow_run` | `workflow_run` complicates "deploy only when all pass" and artifact passing. A single workflow with `needs:` is simpler and actionlint-verified. |

**Installation (root devDependencies; exact pins):**
```bash
corepack pnpm add -D -w eslint@10.10.0 @eslint/js@10.0.1 typescript-eslint@8.70.0 eslint-plugin-svelte@3.23.0 eslint-config-prettier@10.1.8 globals@17.12.0 prettier@3.9.6 prettier-plugin-svelte@4.1.1 prettier-plugin-tailwindcss@0.8.1 typescript@~6.0.3 vitest@4.1.11 @playwright/test@1.63.0 @axe-core/playwright@4.13.0 simple-git-hooks@2.14.0 @types/node@^24
corepack pnpm add -D --filter web @sveltejs/kit@2.70.3 svelte@5.57.0 @sveltejs/adapter-static@3.0.10 vite@8.3.0 @sveltejs/vite-plugin-svelte@7.3.0 tailwindcss@4.3.3 @tailwindcss/vite@4.3.3 svelte-check@4.7.6 typescript@~6.0.3 vitest@4.1.11
```
Hand-write the configs from "Code Examples" rather than running `sv create`. The scaffold writes caret ranges and a default `app.html` with `style="display: contents"` (an inline style attribute) and `%sveltekit.head%` at the bottom of `<head>`.

## Architecture Patterns

### Recommended Project Structure
```
tran_real_estate/
├── package.json                 # packageManager pnpm@11.27.0, engines, scripts, simple-git-hooks
├── pnpm-workspace.yaml          # packages + allowBuilds + engineStrict
├── .nvmrc                       # 24
├── .gitleaks.toml               # useDefault + canary rule
├── .prettierrc / .prettierignore  # ignore .planning/, build dirs, lockfile
├── eslint.config.js             # flat config: boundaries, fetch ban, {@html} ban
├── vitest.config.ts             # test.projects
├── tooling/vitest/no-network.ts # setupFiles: fetch throws
├── scripts/
│   ├── assert-csp.mjs           # built-HTML CSP + frame-guard + .nojekyll assertion
│   ├── guard-real-data.mjs      # PII-in-fixtures + *costar* path rule (--all | --staged)
│   ├── gitleaks.mjs             # resolves binary, runs `git --staged` or full history, fails closed
│   ├── gitleaks-canary.mjs      # runtime-built canary via `gitleaks stdin`, expects exit 1
│   ├── build-web.mjs            # root|sub targets; sets BASE_PATH/BUILD_DIR from Node (Windows-safe)
│   └── serve-pages.mjs          # GitHub Pages emulator: root, sub-path and attacker listeners
├── .github/workflows/ci.yml     # hygiene + quality jobs; deploy job gated on vars.PAGES_ENABLED
├── apps/web/
│   ├── svelte.config.js         # adapter-static, paths.base, prerender strictness, kit.csp
│   ├── vite.config.ts           # tailwindcss() + sveltekit(); test block (project "web")
│   ├── playwright.config.ts     # single webServer → serve-pages.mjs; projects root|sub
│   ├── static/.nojekyll
│   ├── static/frame-guard.js
│   ├── src/app.html             # <html hidden>, charset → %sveltekit.head% → frame-guard
│   ├── src/app.css              # @import 'tailwindcss'; @theme {}
│   ├── src/routes/
│   │   ├── +layout.ts           # prerender = true; trailingSlash = 'always'
│   │   ├── +layout.svelte       # imports app.css
│   │   ├── +error.svelte        # branded 404 placeholder
│   │   ├── (marketing)/+page.svelte
│   │   ├── (app)/+layout.svelte; renter/ investor/ agent/ settings/ (+page.svelte each)
│   │   └── (print)/+layout.svelte; print/+page.svelte
│   ├── src/lib/{features/{shared,renter,investor,agent},security,data,ai,storage}/  # folders the lint rules reference (placeholders)
│   └── tests/e2e/{routing,csp,framing,a11y}.spec.ts
└── packages/
    ├── core/   # package.json (exports ./src/index.ts), tsconfig (lib ES2024, no DOM), vitest.config.ts, src/index.ts + test
    └── brand/  # package.json, src/index.ts exporting `export const tokens = {} as const`
```

### Pattern 1: Prerender-everything with env base path and branded 404
**What:** Every route is prerendered. `paths.base` comes from `BASE_PATH`, validated in config. `fallback: '404.html'` produces the not-found shell, which Pages serves for unknown paths. `strict: true` and `handleUnseenRoutes: 'fail'` make the build fail if any route is not prerendered.
**Evidence:**
- The build emitted `index.html`, `about/index.html`, `renter/index.html` (route group stripped) and `404.html`. Every page, including `404.html`, carried the CSP meta, and the fallback's own boot script was hashed.
- With the default `paths.relative: true`, normal pages use relative assets (`../_app/...`) while `404.html` uses absolute `/<base>/_app/...`. That is exactly what a 404 page served at arbitrary depth needs.
- Under the emulator, an unknown path returned HTTP 404 and rendered `+error.svelte`, for both bases.

### Pattern 2: Anti-framing that fails closed under meta CSP
**What:** The document is hidden by the `hidden` attribute on `<html>`. A same-origin classic script (render-blocking, in `<head>`) removes it only when `window.self === window.top`; otherwise it tries `top.location` and stays hidden. No inline code, so no hash upkeep.
**Evidence (Chromium 153 headless shell, Playwright 1.63):**
- **Plain cross-origin iframe:** `h1` not visible. Chrome logged "Unsafe attempt to initiate navigation ... neither same-origin with its target nor has it received a user gesture", so the top page stayed put.
- **`sandbox="allow-forms"` (no scripts):** hidden, because the script never runs.
- **`sandbox="allow-scripts allow-same-origin"`:** hidden, and top navigation was blocked by the sandbox.
- **Top-level load:** visible.
**Trade-off:** visitors with JavaScript disabled see a blank page. This matches the OWASP legacy frame-breaking guidance, which also hides content when JS cannot run. Do NOT add a `<noscript>` reveal: sandboxed frames without `allow-scripts` render `<noscript>`, which would re-open clickjacking.

### Pattern 3: CSP policy as a verified contract
**What:** `kit.csp` generates the policy. A dependency-free Node script (`assert-csp.mjs`) acts as an independent oracle over `build/**/*.html`. It checks:
- the meta is present and first after charset
- exact sets for `default-src`, `object-src`, `base-uri`, `form-action`, `connect-src`
- `script-src` contains only `'self'` and `'sha256-…'`
- every inline `<script>` body hash is present in `script-src`
- `style-src` contains only `'self'`, and `style-src-attr` (if present) contains only `'unsafe-inline'`
- no meta-ignored directives (`frame-ancestors`, `report-uri`, `sandbox`)
- `<html hidden>` is present
- `.nojekyll`, `404.html` and `frame-guard.js` exist
**Keep the allowlist in the script as a literal**, duplicated on purpose from `svelte.config.js`, so a change to both files at once is a reviewed diff rather than a silent pass.
**Evidence:** the script passed both prototype builds. It flagged `connect-src` drift. On a mutated copy it reported all four injected faults: missing `.nojekyll`, `'unsafe-inline'`, a script before the meta, and a missing `hidden` attribute.

### Pattern 4: Pages-emulating E2E under two bases on one machine
**What:** One Node process (`serve-pages.mjs`) listens on three configurable ports:
- **Root:** `apps/web/build` at `/`.
- **Sub:** `apps/web/build-sub` at `/tran_real_estate`.
- **Attacker:** a page that iframes the root origin.

Playwright has a single `webServer` entry and two projects (`root`, `sub`) with trailing-slash `baseURL`s. Tests use relative paths (`page.goto('renter/')`) so they run under both bases.
**Why one process:** during research, a three-entry `webServer` array stalled on readiness (partly port collisions and a crash). Ports 4173/4174 were already in use on this machine by another project's server. Use non-default ports from env (defaults 4273/4274/4275).

### Pattern 5: Import boundaries via per-directory flat-config blocks
**What:** `no-restricted-imports` blocks per route group or feature folder; `no-restricted-syntax` bans `fetch(` everywhere except adapter folders; `svelte/no-at-html-tags` (in `recommended`) is turned off only for `src/lib/security/sanitize-html.svelte`.
**Evidence:** ESLint 10.10.0 + typescript-eslint 8.70.0 + eslint-plugin-svelte 3.23.0 on TS 6.0.3 reported exactly four expected errors in a `(marketing)` Svelte file: restricted `$lib/storage/db` import, `fetch(...)`, `window.fetch(...)`, and `{@html}`. It reported none in the adapter file or the sanitizer module.

### Anti-Patterns to Avoid
- **Inline `<script>`/`<style>` in `app.html` after the CSP meta:** these are not hashed by `kit.csp` and get blocked (D2).
- **`style="..."` in `app.html`** (e.g. the default `display: contents` wrapper): use a class in `app.css`.
- **`%sveltekit.head%` at the bottom of `<head>`:** anything above it runs before the policy exists.
- **`frame-ancestors` in `kit.csp.directives`:** silently dropped from the meta, which gives a false sense of protection.
- **`BASE_PATH=/x pnpm build` typed in Git Bash on Windows:** MSYS path conversion mangles it into a Windows path (observed). Set env from Node (`scripts/build-web.mjs`) or prefix `MSYS_NO_PATHCONV=1`. Also avoid passing `/tran_real_estate` as a CLI argument from Git Bash; pass a target name (`sub`).
- **Leading-slash `page.goto('/renter/')` in Playwright:** it escapes the sub-path `baseURL`. Use `'renter/'`.
- **A single flat-config object that later objects "extend" for the same rule:** in flat config a later matching object replaces that rule's options entirely. Generate each directory's full restricted-pattern list with a helper.
- **`vitest.workspace.*` files:** deprecated since Vitest 3.2; use `test.projects`.
- **Relying on `vite preview` for base-path and 404 verification** (see Alternatives).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSP hashes for hydration scripts | Manual hashing of Kit's boot script | `kit.csp` `mode: 'hash'` | Boot script content differs per page (node ids, data); Kit hashes it exactly (verified) |
| Secret detection | Regex list of key formats | gitleaks 8.30.1 default rules + one canary rule | Hundreds of maintained provider rules, entropy, `git --staged` mode |
| Workflow YAML validation | Hand review | actionlint 1.7.12 | Catches expression/context misuse (e.g. `vars` in `if`) with no remote CI |
| Git hook installation | Writing `.git/hooks/pre-commit` by hand | `simple-git-hooks` + `prepare` script | Reproducible from `package.json`; runs on fresh install |
| Accessibility checks | Custom contrast/ARIA checks | `@axe-core/playwright` `AxeBuilder` | Standard WCAG tag sets |
| Pages deploy | `gh-pages` branch pushes | `upload-pages-artifact` + `deploy-pages` | Official, OIDC, concurrency-safe |
| Frame busting variants | Clever double-frame / `onbeforeunload` defenses | OWASP hide-until-verified pattern | Only the hide-by-default approach survives double framing and sandboxing |

**Key insight:** two small custom scripts are justified because no maintained tool fits: the CSP assertion (an oracle over deterministic Kit output) and the Pages emulator (neither `vite preview` nor sirv reproduces Pages' 301/404 semantics). Keep each well under ~100 lines and unit-test the pure rule functions. Everything else uses maintained tools.

## Common Pitfalls

### Pitfall 1: CSP meta not governing earlier head content
**What goes wrong:** Scripts/styles in `app.html` above `%sveltekit.head%` execute before the policy exists, so the policy never covers them.
**Why it happens:** Kit inserts the meta at the placeholder, not at `<head>` start (verified in source and output).
**How to avoid:** Put `%sveltekit.head%` immediately after `<meta charset>`; `assert-csp.mjs` enforces the order.
**Warning signs:** CSP meta preceded by anything other than `<meta charset>` in `build/index.html`.

### Pitfall 2: Fail-open anti-framing
**What goes wrong:** An inline `<style>html{display:none}</style>` below the CSP meta is blocked by `style-src 'self'`, so the page renders inside frames.
**How to avoid:** Use the `hidden` attribute + external script. Test all three iframe variants (plain, sandbox without scripts, sandbox with scripts), and assert both `html[hidden]` present AND `h1` not visible so an unloaded frame cannot pass vacuously.
**Warning signs:** a framing test that only calls `toBeHidden()` without first asserting the frame document loaded.

### Pitfall 3: Svelte transition style violations
**What goes wrong:** With `style-src 'self'` only, Svelte 5 transitions trigger `style-src-attr` violations (observed). The Phase 2 UI library will set `style` attributes too.
**How to avoid:** Add `style-src-attr 'unsafe-inline'`. The E2E CSP spec listens for `securitypolicyviolation` and asserts an empty list after interacting with a transition.
**Note:** In dev, Kit itself adds `'unsafe-inline'` to `style-src` (source `csp.js`, dev branch), so dev never shows these violations; only built output is authoritative.

### Pitfall 4: pnpm 11 install fails on dependency build scripts
**What goes wrong:** `ERR_PNPM_IGNORED_BUILDS: Ignored build scripts: simple-git-hooks@2.14.0` with exit 1. pnpm then **writes placeholder entries itself** into `pnpm-workspace.yaml` (`simple-git-hooks: set this to true or false`). A hand-appended second `allowBuilds:` block becomes a YAML "duplicated mapping key" error (observed).
**How to avoid:** Commit `allowBuilds: { simple-git-hooks: false }` up front (the root `prepare` script installs hooks). `onlyBuiltDependencies`/`ignoredBuiltDependencies` were removed in v11. Only auth/registry settings are read from `.npmrc`. With the full pinned dependency set, only the hook tools were flagged (Vite 8/rolldown and Tailwind 4.3 need no approval).
**Warning signs:** CI `pnpm install --frozen-lockfile` exits 1 with `ERR_PNPM_IGNORED_BUILDS`.

### Pitfall 5: Hook not installed after install
**What goes wrong:** The root `prepare` script ran on a fresh install (verified: `. prepare: [INFO] Successfully set all git hooks`). It did NOT run when pnpm reported "Already up to date", even with `--force`.
**How to avoid:** Also expose `pnpm hooks:install` (`simple-git-hooks`), and have the Wave 0 task run it explicitly. Verify `.git/hooks/pre-commit` exists.
**Bypass:** `SKIP_SIMPLE_GIT_HOOKS=1 git commit` skips the hook (verified). CI full-history gitleaks is the backstop, but **there is no remote CI yet**, so the local hook is the only secret gate until the org exists.

### Pitfall 6: gitleaks missing locally
**What goes wrong:** `gitleaks` is not on PATH on this machine. A hook that silently skips when the binary is absent provides no protection.
**How to avoid:** `scripts/gitleaks.mjs` fails closed with an install hint (`winget install --id Gitleaks.Gitleaks -e`) and warns if `gitleaks version` differs from 8.30.1. Installing via winget is a machine change: get owner consent in the Wave 0 checkpoint.

### Pitfall 7: Canary secret becomes a committed secret
**What goes wrong:** A literal test key in a fixture is committed, scanners flag it forever, and allowlisting that path creates a blind spot.
**How to avoid:** Build the canary string at runtime (`'TRANCANARY_' + ...`) and feed it to `gitleaks stdin` (verified exit 1). Never allowlist fixture paths in `.gitleaks.toml`.

### Pitfall 8: `.nojekyll` dropped by the Pages artifact
**What goes wrong:** `upload-pages-artifact@v5` defaults `include-hidden-files: false`.
**How to avoid:** Set `include-hidden-files: true`. With artifact deploys Jekyll may not run at all (MEDIUM, community sources), but keeping `.nojekyll` is harmless and satisfies the locked decision.

### Pitfall 9: Deploy job "fails" or runs unexpectedly
**What goes wrong:** A missing variable is treated as an error, or the deploy runs on PRs.
**How to avoid:** An unset `vars.X` evaluates to `''` (GitHub docs), so `if: github.event_name == 'push' && github.ref == 'refs/heads/main' && vars.PAGES_ENABLED == 'true'` skips cleanly. `vars` is available in `jobs.<id>.if`. Gate the upload step with the same condition to avoid stray artifacts. Use `concurrency: { group: pages, cancel-in-progress: false }` to avoid deploy-pages wedges.

### Pitfall 10: Fixture PII regex edge cases
**What goes wrong:** Over- or under-matching emails and phones.
**Evidence (dry run):**
- Allowed: `jane@example.com`, `x@foo.test`, `(512) 555-0142`, `512-555-0199`, `+1 512 555 0100`, `5125550142`.
- Flagged: `agent@brokerage.com`, `user@examples.com`, `512.555.1234`, `212-867-5309`.
- Not matched: zip+4 `78701-1234`, `20260913`, lat/long, `1.2.3-4567`.
- Strict per CONTEXT: `a@sub.example.org` is flagged (exact domain only).
**How to avoid:** Keep the rules as pure functions with a Vitest table test. Scan only data-like paths (`fixtures|data|mocks|samples|seed`) plus the global `*costar*` path rule. In `--staged` mode read blob contents via `git show :path` so unstaged edits don't mask staged content.

### Pitfall 11: Port collisions with other local projects
**What goes wrong:** Ports 4173/4174 (Vite preview defaults) were already bound by another session's `scripts/smoke-static.mjs` on this machine during research.
**How to avoid:** Use env-configurable E2E ports (defaults 4273/4274/4275) and `reuseExistingServer: false`. Never kill processes you did not start.

### Pitfall 12: Formatting planning docs
**What goes wrong:** `prettier --write .` reformats `.planning/**/*.md` and creates diff churn.
**How to avoid:** Put `.planning/`, `pnpm-lock.yaml`, `**/build`, `**/build-sub`, `**/.svelte-kit` and `test-results/` in `.prettierignore`.

## Code Examples

The following were verified in the prototype unless marked otherwise.

### `apps/web/svelte.config.js`
```js
// Verified pattern (prototype build under '' and '/tran_real_estate', Kit 2.70.3)
import adapter from '@sveltejs/adapter-static';

const base = process.env.BASE_PATH ?? '';
if (base !== '' && !/^\/[A-Za-z0-9._~-]+(\/[A-Za-z0-9._~-]+)*$/.test(base)) {
	throw new Error(
		`BASE_PATH must be '' or a root-relative path like '/tran_real_estate' (got ${JSON.stringify(base)}). ` +
			`On Git Bash set MSYS_NO_PATHCONV=1 or use scripts/build-web.mjs.`
	);
}
const out = process.env.BUILD_DIR ?? 'build';

/** @type {import('@sveltejs/kit').Config} */
export default {
	kit: {
		adapter: adapter({ pages: out, assets: out, fallback: '404.html', precompress: false, strict: true }),
		paths: { base },
		prerender: { handleHttpError: 'fail', handleMissingId: 'fail', handleUnseenRoutes: 'fail' },
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self'],
				'style-src-attr': ['unsafe-inline'],
				'connect-src': [
					'self',
					'https://api.rentcast.io',
					'https://api.anthropic.com',
					'https://api.openai.com',
					'https://generativelanguage.googleapis.com',
					'https://openrouter.ai',
					'https://api.web3forms.com'
				],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self', 'https://api.web3forms.com']
			}
		}
	}
};
```
Emitted meta (prototype, keywords auto-quoted by Kit): `default-src 'self'; connect-src 'self' https://api.rentcast.io ...; script-src 'self' 'sha256-…'; style-src 'self'; style-src-attr 'unsafe-inline'; object-src 'none'; base-uri 'self'; form-action 'self' https://api.web3forms.com`. `img-src`/`font-src` are omitted so they fall back to `default-src 'self'`; Phase 2 adds `data:` only if fonts/icons need it.

### `apps/web/src/app.html`
```html
<!doctype html>
<html lang="en" hidden>
	<head>
		<meta charset="utf-8" />
		%sveltekit.head%
		<script src="%sveltekit.assets%/frame-guard.js"></script>
		<meta name="viewport" content="width=device-width, initial-scale=1" />
	</head>
	<body data-sveltekit-preload-data="hover">
		<div class="app-root">%sveltekit.body%</div>
	</body>
</html>
```
`%sveltekit.assets%` resolved to `../frame-guard.js` on nested pages and `/tran_real_estate/frame-guard.js` in `404.html` (verified). Do not use `%sveltekit.nonce%`: Kit throws when prerendering with nonce mode.

### `apps/web/static/frame-guard.js`
```js
// Reveal only when top-level; otherwise stay hidden (OWASP hide-until-verified pattern).
(function () {
	if (window.self === window.top) {
		document.documentElement.removeAttribute('hidden');
	} else {
		try {
			window.top.location = window.self.location.href;
		} catch (e) {
			/* cross-origin top navigation blocked; content stays hidden */
		}
	}
})();
```

### `apps/web/src/routes/+layout.ts`
```ts
export const prerender = true;
export const trailingSlash = 'always';
```
Links: `import { resolve } from '$app/paths'` → `href={resolve('/renter/')}` rendered `/tran_real_estate/renter/` (verified). Whether the typed `resolve()` accepts trailing-slash pathnames under `svelte-check` is unverified; see Open Questions.

### `apps/web/src/app.css`
```css
@import 'tailwindcss';
@theme {
}
.app-root {
	display: contents;
}
```
Tailwind 4.3 via `@tailwindcss/vite` emitted an external `<link rel="stylesheet">` (no inline styles). Its preflight includes a `[hidden]` rule with `display: none !important`, which reinforces the frame guard.

### `apps/web/vite.config.ts`
```ts
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	test: {
		name: 'web',
		environment: 'node',
		include: ['src/**/*.{test,spec}.ts'],
		setupFiles: ['../../tooling/vitest/no-network.ts']
	}
});
```

### `vitest.config.ts` (root) + `tooling/vitest/no-network.ts`
```ts
// vitest.config.ts — Vitest 4 projects (vitest.workspace is deprecated)
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { projects: ['apps/web', 'packages/core', 'scripts'] } });
```
```ts
// tooling/vitest/no-network.ts — must be setupFiles, NOT globalSetup (different global scope)
import { beforeEach } from 'vitest';

const blocked = (() => {
	throw new Error('Network access is disabled in unit tests. Inject a fake fetch into the unit under test.');
}) as unknown as typeof fetch;

globalThis.fetch = blocked;
beforeEach(() => {
	globalThis.fetch = blocked; // re-assert in case a test replaced it
});
```
Each project (`packages/core/vitest.config.ts`, `scripts/vitest.config.ts`) repeats `setupFiles: ['../../tooling/vitest/no-network.ts']` (path relative to the project root; for `scripts/` use `'../tooling/vitest/no-network.ts'`). Each has a `no-network.test.ts` asserting `expect(() => fetch('https://example.com')).toThrow()`. The config shape follows Vitest 4 docs, but these files were not executed during research (MEDIUM).

### `pnpm-workspace.yaml` (verified with pnpm 11.27.0)
```yaml
packages:
  - apps/*
  - packages/*
allowBuilds:
  simple-git-hooks: false
engineStrict: true
```

### Root `package.json` (key fields)
```json
{
	"name": "tran-real-estate",
	"private": true,
	"type": "module",
	"packageManager": "pnpm@11.27.0",
	"engines": { "node": ">=24 <25" },
	"scripts": {
		"prepare": "simple-git-hooks",
		"hooks:install": "simple-git-hooks",
		"dev": "pnpm --filter web dev",
		"check": "pnpm -r --if-present check",
		"lint": "prettier --check . && eslint .",
		"format": "prettier --write .",
		"test:unit": "vitest run",
		"build:root": "node scripts/build-web.mjs root",
		"build:sub": "node scripts/build-web.mjs sub",
		"csp:assert": "node scripts/assert-csp.mjs apps/web/build && node scripts/assert-csp.mjs apps/web/build-sub",
		"test:e2e": "pnpm --filter web exec playwright test",
		"guard": "node scripts/guard-real-data.mjs --all",
		"secrets:canary": "node scripts/gitleaks-canary.mjs",
		"secrets:scan": "node scripts/gitleaks.mjs history",
		"verify": "pnpm check && pnpm lint && pnpm test:unit && pnpm build:root && pnpm build:sub && pnpm csp:assert && pnpm test:e2e && pnpm guard && pnpm secrets:canary && pnpm secrets:scan"
	},
	"simple-git-hooks": {
		"pre-commit": "node scripts/gitleaks.mjs staged && node scripts/guard-real-data.mjs --staged"
	}
}
```
apps/web scripts: `"build": "vite build"`, `"check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"`. packages/core: `"check": "tsc --noEmit"` with `tsconfig` `lib: ["ES2024"]`, `types: []` (no DOM).

### `scripts/build-web.mjs` (Windows-safe base path)
```js
import { spawnSync } from 'node:child_process';
const targets = {
	root: { BASE_PATH: '', BUILD_DIR: 'build' },
	sub: { BASE_PATH: '/tran_real_estate', BUILD_DIR: 'build-sub' }
};
const t = targets[process.argv[2] ?? 'root'];
if (!t) {
	console.error('usage: node scripts/build-web.mjs root|sub');
	process.exit(2);
}
const r = spawnSync('pnpm', ['--filter', 'web', 'build'], {
	stdio: 'inherit',
	env: { ...process.env, ...t },
	shell: process.platform === 'win32'
});
process.exit(r.status ?? 1);
```
Add `build-sub/`, `test-results/` and `playwright-report/` to `.gitignore`.

### `.gitleaks.toml` (canary rule verified; blocks staged commit and `stdin`)
```toml
title = "tran-real-estate gitleaks config"

[extend]
useDefault = true

[[rules]]
id = "tran-canary-test-key"
description = "Canary pattern proving the scanner blocks commits (never a real credential)"
regex = '''TRANCANARY_[A-Z0-9]{32}'''
keywords = ["trancanary_"]
```
No path allowlists. The default ruleset also caught an Anthropic-style key in a staged file (verified).

### `scripts/gitleaks.mjs` and `scripts/gitleaks-canary.mjs`
```js
// gitleaks.mjs — fail closed if the binary is missing
import { spawnSync } from 'node:child_process';
const bin = process.env.GITLEAKS_BIN || 'gitleaks';
const probe = spawnSync(bin, ['version'], { encoding: 'utf8' });
if (probe.error) {
	console.error('gitleaks not found. Install: winget install --id Gitleaks.Gitleaks -e (or set GITLEAKS_BIN). Commit blocked.');
	process.exit(1);
}
if (!probe.stdout.includes('8.30.1')) console.warn(`gitleaks ${probe.stdout.trim()} found; pinned version is 8.30.1`);
const mode = process.argv[2] ?? 'staged';
const args = mode === 'staged'
	? ['git', '--staged', '--no-banner', '--redact', '--config', '.gitleaks.toml', '.']
	: ['git', '--no-banner', '--redact', '--config', '.gitleaks.toml', '.'];
process.exit(spawnSync(bin, args, { stdio: 'inherit' }).status ?? 1);
```
```js
// gitleaks-canary.mjs — prove the config rejects the canary (verified: exit 1 on detection)
import { spawnSync } from 'node:child_process';
const canary = 'TRANCANARY_' + 'A1B2C3D4E5F6G7H8J9K0L1M2N3P4Q5R6'; // assembled at runtime, never a literal match in git
const r = spawnSync(process.env.GITLEAKS_BIN || 'gitleaks',
	['stdin', '--no-banner', '--redact', '--config', '.gitleaks.toml'], { input: `const k = "${canary}";\n` });
if (r.status !== 1) { console.error('Canary NOT detected: secret scanning is misconfigured'); process.exit(1); }
console.log('gitleaks canary detected as expected');
```
Note: the source line above contains `'TRANCANARY_' + '...'` split across a `+`, so the committed file does not match the rule regex. The gitleaks 8.30.1 CLI has `git`, `dir` and `stdin` (and a legacy `protect`); `git --staged` is the pre-commit mode.

### `scripts/guard-real-data.mjs` (verified: 2 problems found, clean set passes)
```js
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const mode = process.argv.includes('--staged') ? 'staged' : 'all';
const files = (mode === 'staged'
	? execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
	: execFileSync('git', ['ls-files', '-z'])
).toString('utf8').split('\0').filter(Boolean);

const COSTAR_PATH = /costar/i;
const DATA_PATH = /(^|\/)(fixtures?|data|mocks?|samples?|seed)(\/|$)/i;
const TEXT_EXT = /\.(json|jsonl|csv|tsv|ts|js|mjs|svelte|md|txt|ya?ml|html|eml)$/i;
const EMAIL = /[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g;
const ALLOWED_EMAIL = /@(?:example\.(?:com|org)|(?:[A-Za-z0-9-]+\.)*[A-Za-z0-9-]+\.test)$/i;
const PHONE = /(?<![\d-])(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})(?![\d-])/g;
const fictionalPhone = (exchange, line) => exchange === '555' && /^01\d\d$/.test(line);

const problems = [];
for (const file of files) {
	if (COSTAR_PATH.test(file)) problems.push(`${file}: path matches *costar* (CoStar data is prohibited)`);
	if (!DATA_PATH.test(file) || !TEXT_EXT.test(file)) continue;
	const text = mode === 'staged'
		? execFileSync('git', ['show', `:${file}`]).toString('utf8')
		: existsSync(file) ? readFileSync(file, 'utf8') : '';
	text.split(/\r?\n/).forEach((line, n) => {
		for (const m of line.matchAll(EMAIL)) if (!ALLOWED_EMAIL.test(m[0])) problems.push(`${file}:${n + 1}: real-looking email (use @example.com/@example.org/.test)`);
		for (const m of line.matchAll(PHONE)) if (!fictionalPhone(m[2], m[3])) problems.push(`${file}:${n + 1}: real-looking US phone (use 555-01xx)`);
	});
}
if (problems.length) { console.error(`Real-data guard failed (${problems.length}):\n- ` + problems.join('\n- ')); process.exit(1); }
console.log(`Real-data guard passed (${files.length} ${mode} files checked)`);
```
Planner: extract `EMAIL`/`PHONE`/`ALLOWED_EMAIL`/`fictionalPhone`/path regexes into `scripts/lib/real-data-rules.mjs` for a Vitest table test. Unit-test fixtures must build real-looking values at runtime (string concatenation), or the guard flags its own tests when they live under a data-like path.

### `scripts/assert-csp.mjs` (verified against good and mutated builds)
```js
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

const dir = process.argv[2] ?? 'build';
const CONNECT = "'self' https://api.rentcast.io https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https://openrouter.ai https://api.web3forms.com".split(' ');
const EXACT = {
	'default-src': ["'self'"], 'object-src': ["'none'"], 'base-uri': ["'self'"],
	'form-action': ["'self'", 'https://api.web3forms.com'], 'connect-src': CONNECT
};
const EXPECTED_PAGES = ['index.html', 'renter/index.html', 'investor/index.html', 'agent/index.html', 'settings/index.html', 'print/index.html', '404.html'];
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const errors = [];
for (const f of ['.nojekyll', 'frame-guard.js', ...EXPECTED_PAGES]) if (!existsSync(join(dir, f))) errors.push(`missing ${f}`);
const pages = walk(dir).filter((f) => f.endsWith('.html'));
for (const file of pages) {
	const rel = relative(dir, file).split(sep).join('/');
	const html = readFileSync(file, 'utf8');
	if (!/<html\b[^>]*\shidden[\s>]/i.test(html)) errors.push(`${rel}: <html> must carry the hidden attribute (anti-framing)`);
	const head = (/<head>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? '').replace(/<!--[\s\S]*?-->/g, '');
	const tags = [...head.matchAll(/<([a-z]+)\b[^>]*>/gi)].map((m) => m[0]);
	const i = tags.findIndex((t) => /http-equiv="content-security-policy"/i.test(t));
	if (i === -1) { errors.push(`${rel}: CSP meta missing`); continue; }
	const before = tags.slice(0, i);
	if (!(before.length === 0 || (before.length === 1 && /^<meta charset=/i.test(before[0]))))
		errors.push(`${rel}: CSP meta must be first in <head> (only <meta charset> may precede it); found ${before.join(' ')}`);
	const policy = Object.fromEntries(decode(/content="([^"]*)"/i.exec(tags[i])[1]).split(';')
		.map((d) => d.trim().split(/\s+/)).filter((p) => p[0]).map(([k, ...v]) => [k, v]));
	for (const [k, v] of Object.entries(EXACT)) if (!sameSet(policy[k] ?? [], v)) errors.push(`${rel}: ${k} is [${policy[k]?.join(' ')}], expected [${v.join(' ')}]`);
	for (const k of ['frame-ancestors', 'report-uri', 'sandbox']) if (policy[k]) errors.push(`${rel}: ${k} is ignored in meta CSP; remove it`);
	const scriptSrc = policy['script-src'] ?? [];
	for (const t of scriptSrc) if (!(t === "'self'" || /^'sha256-[A-Za-z0-9+/]+=*'$/.test(t))) errors.push(`${rel}: script-src token ${t} not allowed`);
	for (const t of policy['style-src'] ?? []) if (t !== "'self'") errors.push(`${rel}: style-src token ${t} not allowed`);
	if (policy['style-src-attr'] && !sameSet(policy['style-src-attr'], ["'unsafe-inline'"])) errors.push(`${rel}: style-src-attr must be exactly 'unsafe-inline'`);
	for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
		const hash = `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`;
		if (!scriptSrc.includes(hash)) errors.push(`${rel}: inline script not covered by script-src hash ${hash}`);
	}
}
if (errors.length) { console.error(`CSP assertion failed (${errors.length}):\n- ` + errors.join('\n- ')); process.exit(1); }
console.log(`CSP assertion passed for ${pages.length} pages in ${dir}`);
```
(`EXPECTED_PAGES` was added after the verification run; the rest ran as shown.)

### `eslint.config.js` (core verified; portal helper is an extension of the verified pattern)
```js
import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

const WEB = 'apps/web/src';
const PORTALS = ['renter', 'investor', 'agent'];
const noFetch = [
	{ selector: "CallExpression[callee.name='fetch']", message: 'fetch is allowed only in adapter folders (lib/data/rentcast, lib/ai/providers, lib/leads).' },
	{ selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='fetch'][callee.object.name=/^(window|globalThis|self)$/]", message: 'fetch is allowed only in adapter folders.' }
];
const forbid = (mods, message) => ({ group: mods.flatMap((m) => [`$lib/${m}`, `$lib/${m}/**`, `**/lib/${m}`, `**/lib/${m}/**`]), message });

export default defineConfig(
	{ ignores: ['**/build/', '**/build-sub/', '**/.svelte-kit/', '**/test-results/', '.planning/'] },
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{ languageOptions: { globals: { ...globals.browser, ...globals.node } } },
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: { parserOptions: { projectService: true, extraFileExtensions: ['.svelte'], parser: ts.parser } }
	},
	{ files: ['**/*.{ts,js,mjs,svelte}'], rules: { 'no-restricted-syntax': ['error', ...noFetch] } },
	{ files: [`${WEB}/lib/data/rentcast/**`, `${WEB}/lib/ai/providers/**`, `${WEB}/lib/leads/**`], rules: { 'no-restricted-syntax': 'off' } },
	{
		files: [`${WEB}/routes/(marketing)/**`],
		rules: { 'no-restricted-imports': ['error', { patterns: [forbid(['storage', 'ai', 'data'], 'Marketing routes must not import storage, AI, or data modules.')] }] }
	},
	...PORTALS.map((p) => ({
		files: [`${WEB}/routes/(app)/${p}/**`, `${WEB}/lib/features/${p}/**`],
		rules: {
			'no-restricted-imports': ['error', { patterns: [
				forbid(PORTALS.filter((o) => o !== p).map((o) => `features/${o}`), `The ${p} portal may import only features/${p} and features/shared.`)
			] }]
		}
	})),
	{ files: [`${WEB}/lib/security/sanitize-html.svelte`], rules: { 'svelte/no-at-html-tags': 'off' } }
);
```
A later config object that matches the same file replaces `no-restricted-imports` options entirely. If a directory needs both marketing-style and portal-style bans, build one combined pattern list for it.

### `apps/web/playwright.config.ts`
```ts
import { defineConfig, devices } from '@playwright/test';

const ROOT = Number(process.env.E2E_PORT_ROOT ?? 4273);
const SUB = Number(process.env.E2E_PORT_SUB ?? 4274);
const ATTACKER = Number(process.env.E2E_PORT_ATTACKER ?? 4275);

export default defineConfig({
	testDir: 'tests/e2e',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
	webServer: {
		command: 'node ../../scripts/serve-pages.mjs',
		env: { E2E_PORT_ROOT: String(ROOT), E2E_PORT_SUB: String(SUB), E2E_PORT_ATTACKER: String(ATTACKER) },
		url: `http://127.0.0.1:${ROOT}/`,
		reuseExistingServer: false,
		timeout: 30_000
	},
	projects: [
		{ name: 'root', use: { baseURL: `http://127.0.0.1:${ROOT}/` } },
		{ name: 'sub', use: { baseURL: `http://127.0.0.1:${SUB}/tran_real_estate/` }, testIgnore: /framing\.spec/ }
	]
});
```
The single-`webServer` form is a MEDIUM recommendation. Research verified the specs against manually started emulator listeners; the multi-entry array stalled.

### `scripts/serve-pages.mjs` (GitHub Pages behavior emulator; core logic verified)
```js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const web = path.resolve(import.meta.dirname, '../apps/web');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

function site(port, mount, dir) {
	const prefix = mount === '/' ? '' : mount;
	const send = (res, status, file) => {
		if (!fs.existsSync(file)) { res.writeHead(status); return res.end(); }
		res.writeHead(status, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
		fs.createReadStream(file).pipe(res);
	};
	http.createServer((req, res) => {
		const url = new URL(req.url, 'http://x');
		const notFound = () => send(res, 404, path.join(dir, '404.html'));
		if (prefix && !url.pathname.startsWith(prefix)) return notFound();
		const target = path.join(dir, decodeURIComponent(url.pathname.slice(prefix.length)) || '/');
		if (!target.startsWith(path.resolve(dir))) return notFound();
		let stat;
		try { stat = fs.statSync(target); } catch { return notFound(); }
		if (stat.isDirectory()) {
			if (!url.pathname.endsWith('/')) { res.writeHead(301, { location: url.pathname + '/' + url.search }); return res.end(); }
			return send(res, fs.existsSync(path.join(target, 'index.html')) ? 200 : 404, fs.existsSync(path.join(target, 'index.html')) ? path.join(target, 'index.html') : path.join(dir, '404.html'));
		}
		send(res, 200, target);
	}).listen(port, '127.0.0.1');
}

const ROOT = Number(process.env.E2E_PORT_ROOT ?? 4273);
const SUB = Number(process.env.E2E_PORT_SUB ?? 4274);
const ATTACKER = Number(process.env.E2E_PORT_ATTACKER ?? 4275);
if (fs.existsSync(path.join(web, 'build'))) site(ROOT, '/', path.join(web, 'build'));
if (fs.existsSync(path.join(web, 'build-sub'))) site(SUB, '/tran_real_estate', path.join(web, 'build-sub'));
http.createServer((_req, res) => {
	res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
	res.end(`<!doctype html><title>attacker</title><h2>attacker</h2>
<iframe id="plain" src="http://127.0.0.1:${ROOT}/"></iframe>
<iframe id="sandboxed" sandbox="allow-forms" src="http://127.0.0.1:${ROOT}/renter/"></iframe>
<iframe id="sandboxed-scripts" sandbox="allow-scripts allow-same-origin" src="http://127.0.0.1:${ROOT}/agent/"></iframe>`);
}).listen(ATTACKER, '127.0.0.1');
```

### E2E specs (adapted from the verified prototype spec)
```ts
// tests/e2e/csp.spec.ts
import { test, expect } from '@playwright/test';
const ROUTES = ['', 'renter/', 'investor/', 'agent/', 'settings/', 'print/'];
test('no CSP violations on any route', async ({ page }) => {
	await page.addInitScript(() => {
		(window as any).__csp = [];
		document.addEventListener('securitypolicyviolation', (e) => (window as any).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
	});
	for (const r of ROUTES) {
		const res = await page.goto(r);
		expect(res?.status()).toBe(200);
		await expect(page.locator('html')).not.toHaveAttribute('hidden');
		expect(await page.evaluate(() => (window as any).__csp)).toEqual([]);
	}
});

// tests/e2e/routing.spec.ts
test('deep link without trailing slash redirects and survives refresh', async ({ page }) => {
	await page.goto('renter');
	expect(page.url()).toMatch(/\/renter\/$/);
	await page.reload();
	await expect(page.locator('h1')).toBeVisible();
});
test('unknown path serves branded 404 with status 404', async ({ page }) => {
	const res = await page.goto('does-not-exist/deeper/');
	expect(res?.status()).toBe(404);
	await expect(page.locator('h1')).toContainText('404');
});

// tests/e2e/framing.spec.ts (root project only)
const ATTACKER = Number(process.env.E2E_PORT_ATTACKER ?? 4275);
test('app is not visible inside cross-origin frames', async ({ page }) => {
	await page.goto(`http://127.0.0.1:${ATTACKER}/`);
	await page.waitForLoadState('load');
	for (const id of ['plain', 'sandboxed', 'sandboxed-scripts']) {
		const frame = page.frameLocator(`#${id}`);
		await expect(frame.locator('html')).toHaveAttribute('hidden', ''); // document loaded, guard kept it hidden
		await expect(frame.locator('h1')).toBeHidden();
	}
});

// tests/e2e/a11y.spec.ts
import AxeBuilder from '@axe-core/playwright';
test('axe: no WCAG A/AA violations', async ({ page }) => {
	for (const r of ['', 'renter/', 'investor/', 'agent/', 'settings/', 'print/']) {
		await page.goto(r);
		const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
		expect(results.violations).toEqual([]);
	}
});
```
Every placeholder page needs an `<h1>` and a `<title>` so the specs and axe have stable targets. The root layout also needs `lang` (already on `<html>`).

### `.github/workflows/ci.yml` (actionlint 1.7.12 exit 0 on this structure)
```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  GITLEAKS_VERSION: 8.30.1
  GITLEAKS_SHA256: 551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb

jobs:
  hygiene:
    name: secrets + real-data guard
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .nvmrc
      - name: Install gitleaks (pinned, checksum-verified)
        run: |
          curl -sSfL -o "$RUNNER_TEMP/gitleaks.tgz" \
            "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz"
          echo "${GITLEAKS_SHA256}  $RUNNER_TEMP/gitleaks.tgz" | sha256sum -c -
          tar -xzf "$RUNNER_TEMP/gitleaks.tgz" -C "$RUNNER_TEMP" gitleaks
          echo "$RUNNER_TEMP" >> "$GITHUB_PATH"
      - name: Canary self-test (config must reject the test pattern)
        run: node scripts/gitleaks-canary.mjs
      - name: Scan full git history
        run: gitleaks git --no-banner --redact --config .gitleaks.toml .
      - name: Real-data / CoStar guard
        run: node scripts/guard-real-data.mjs --all

  quality:
    name: check, lint, unit, build, csp, e2e+axe (${{ matrix.target }})
    runs-on: ubuntu-24.04
    strategy:
      fail-fast: false
      matrix:
        include:
          - target: root
            base_path: ''
            build_dir: build
          - target: sub
            base_path: /tran_real_estate
            build_dir: build-sub
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm check
      - run: pnpm lint
      - run: pnpm test:unit
      - name: Build
        run: pnpm --filter web build
        env:
          BASE_PATH: ${{ matrix.base_path }}
          BUILD_DIR: ${{ matrix.build_dir }}
      - run: node scripts/assert-csp.mjs apps/web/${{ matrix.build_dir }}
      - run: pnpm --filter web exec playwright install --with-deps chromium
      - name: E2E + axe
        run: pnpm --filter web exec playwright test --project=${{ matrix.target }}
      - name: Upload Pages artifact
        if: matrix.target == 'root' && github.event_name == 'push' && github.ref == 'refs/heads/main' && vars.PAGES_ENABLED == 'true'
        uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0
        with:
          path: apps/web/build
          include-hidden-files: true

  deploy:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main' && vars.PAGES_ENABLED == 'true'
    needs: [hygiene, quality]
    runs-on: ubuntu-24.04
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    concurrency:
      group: pages
      cancel-in-progress: false
    steps:
      - id: deployment
        uses: actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346 # v5.0.1
```
The matrix `include:` form and the E2E/build command strings changed after the actionlint run. **Re-run actionlint in the task that writes this file.** On Linux runners `BASE_PATH` in `env:` is safe; MSYS mangling is Windows-only.

### `.prettierrc`
```json
{
	"useTabs": true,
	"singleQuote": true,
	"trailingComma": "none",
	"printWidth": 100,
	"plugins": ["prettier-plugin-svelte", "prettier-plugin-tailwindcss"],
	"overrides": [{ "files": "*.svelte", "options": { "parser": "svelte" } }],
	"tailwindStylesheet": "./apps/web/src/app.css"
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.eslintrc` configs | Flat `eslint.config.js`; ESLint 10 (`@eslint/js@10` peers only `eslint ^10`) | ESLint 9 → 10 | Use `defineConfig` from `eslint/config` |
| `vitest.workspace.ts` | `test.projects` | Vitest 3.2 (deprecated) | Root `vitest.config.ts` with `projects` |
| `onlyBuiltDependencies` / `.npmrc` settings | `allowBuilds` in `pnpm-workspace.yaml`; `strictDepBuilds` default `true` | pnpm 10.3 → 11 (old keys removed in 11) | Install fails until builds are approved/denied |
| Svelte 4 transitions inject `<style>` keyframes (the Kit docs note) | Svelte 5 uses WAAPI (`element.animate`) + inline style attributes | Svelte 5 | `style-src-attr 'unsafe-inline'` suffices; `<style>` elements stay blocked |
| `gitleaks protect --staged` | `gitleaks git --staged` (commands: `git`, `dir`, `stdin`) | gitleaks 8.19+ | Use the new subcommands |
| `$app/paths` `base` string concatenation | `resolve()` from `$app/paths` | Kit 2.26+ | Kit's own TODO notes `base`/`assets` removal in 3.0 |
| `upload-pages-artifact` included dotfiles | `include-hidden-files` default `false` | v4/v5 | Set `true` for `.nojekyll` |
| `actions/setup-node@v6` (Kit docs sample) | `@v7.0.0` | 2026-07 | Pin v7 by SHA |

**Deprecated/outdated:**
- The SvelteKit docs' GitHub Pages sample (`fallback: '404.html'` + `setup-node@v6`) is fine structurally, but its action versions lag.
- The Kit docs' transition guidance ("leave `style-src` unspecified or add `unsafe-inline`") is broader than needed for Svelte 5.

## Open Questions

1. **Typed `resolve()` with trailing-slash pathnames**
   - What we know: `resolve('/renter/')` rendered correctly in a JS-typed prototype.
   - What's unclear: whether `svelte-check` accepts `'/renter/'` as a valid `Pathname` when routes live in groups.
   - Recommendation: the first Wave 0 route task runs `pnpm check`. If typing rejects trailing slashes, use `resolve('/renter')` + `trailingSlash: 'always'` (Kit emits `/renter/` hrefs for prerendered links, and the Pages 301 is avoided at build time), then assert hrefs end with `/` in the routing spec.

2. **Playwright multi-entry `webServer` stall on this Windows machine**
   - What we know: port collisions with another project's server and an emulator crash caused failures. After fixing both, one run still stalled for 240s waiting for plugin setup. Manually started servers worked (8/8 green).
   - Recommendation: single `webServer` entry launching `serve-pages.mjs`, custom ports, `timeout: 30_000`. If it still stalls, start the emulator in `globalSetup` and stop it in teardown.

3. **lefthook binary missing under pnpm 11 on Windows**
   - Not root-caused (the platform optional dependency installed with an empty-looking `bin/`).
   - Recommendation: use simple-git-hooks (verified); no action needed.

4. **Local gitleaks installation needs owner consent**
   - `winget install --id Gitleaks.Gitleaks -e` is a machine-level change. Until installed, the pre-commit hook fails closed (intended). There is no remote CI backstop yet.
   - Recommendation: make it a human checkpoint at the start of the secret-scanning plan.

5. **JavaScript-disabled visitors and crawlers**
   - `<html hidden>` hides the site without JS. Major crawlers render JS, but this is a Phase 2/10 SEO consideration.
   - Recommendation: accept for Phase 1 (security fail-closed); record it for Phase 10 review.

6. **RentCast key format for a dedicated gitleaks rule**
   - Unknown without a real key (Phase 4 has one).
   - Recommendation: Phase 1 ships only the canary rule + defaults; add a RentCast rule in Phase 4.

7. **Dependabot for SHA-pinned Actions**
   - Research SUMMARY listed Dependabot under Phase 1, but CONTEXT.md does not.
   - Recommendation: optional `.github/dependabot.yml` (`package-ecosystem: github-actions`, weekly) keeps SHA pins current once a remote exists. The planner may include it as a trivial file or defer it.

8. **Live GitHub Pages semantics**
   - The directory-without-slash 301 and 404.html-with-404-status behaviors are emulated from community sources (MEDIUM).
   - Recommendation: deferred human verification after the org exists: visit `https://tranrealestate.github.io/renter` (expect redirect to `/renter/`) and a bogus path (expect the branded 404), and check push protection rejects a test token.

9. **Repo branch state**
   - The session git snapshot showed `Current branch: HEAD` (possibly detached) with main branch `main`.
   - Recommendation: the executor confirms `git branch --show-current` before the first commit.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.11 (unit, projects `web`, `core`, `scripts`); Playwright 1.63.0 + @axe-core/playwright 4.13.0 (E2E, projects `root`, `sub`); Node assertion scripts; gitleaks 8.30.1; actionlint 1.7.12 |
| Config file | none yet (greenfield). Wave 0 creates `vitest.config.ts`, `apps/web/vite.config.ts`, `packages/core/vitest.config.ts`, `scripts/vitest.config.ts`, `apps/web/playwright.config.ts` |
| Quick run command | `pnpm lint && pnpm test:unit` (under 30s on a skeleton) |
| Full suite command | `pnpm verify` (check, lint, unit, build root+sub, CSP assert both, E2E+axe both projects, real-data guard, gitleaks canary + history scan) plus `actionlint .github/workflows/ci.yml` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FND-01 | All placeholder routes prerendered under `''` and `/tran_real_estate` | build assertion | `pnpm build:root && pnpm build:sub && pnpm csp:assert` (`EXPECTED_PAGES`) | ❌ Wave 0 |
| FND-01 | Deep link without slash → 301 → page; refresh works; unknown path → 404 + branded page | e2e | `pnpm --filter web exec playwright test routing --project=root --project=sub` | ❌ Wave 0 |
| FND-01 | `BASE_PATH` validation rejects mangled values | unit | `pnpm vitest run --project web base-path` (extract the validator into `apps/web/base-path.js` and test it) | ❌ Wave 0 |
| FND-02 | CSP meta on every page, first after charset, exact allowlist, strict script/style, hashes cover inline scripts | build assertion | `pnpm csp:assert` | ❌ Wave 0 |
| FND-02 | Assertion script catches injected faults (mutation test) | unit | `pnpm vitest run --project scripts assert-csp` (temp HTML fixtures: missing meta, `unsafe-inline`, script before meta, connect-src drift, no `hidden`) | ❌ Wave 0 |
| FND-02 | No runtime CSP violations incl. a transition interaction | e2e | `pnpm --filter web exec playwright test csp` | ❌ Wave 0 |
| FND-03 | Hidden in plain, sandboxed and sandboxed-with-scripts cross-origin frames; visible top-level | e2e | `pnpm --filter web exec playwright test framing --project=root` | ❌ Wave 0 |
| FND-04 | Typecheck, lint, unit, E2E and axe gates pass locally | smoke | `pnpm verify` | ❌ Wave 0 |
| FND-04 | Lint rules fire (marketing import ban, `fetch(` ban, `{@html}` ban) and allowlists work | unit | `pnpm vitest run --project scripts eslint-rules` (ESLint Node API `lintText` on fixture snippets) | ❌ Wave 0 |
| FND-04 | Unit tests cannot hit the network | unit | `pnpm test:unit` (each project's `no-network.test.ts`) | ❌ Wave 0 |
| FND-04 | Workflow valid; deploy gated on `vars.PAGES_ENABLED`, `needs` both jobs, `concurrency` set | static | `actionlint .github/workflows/ci.yml` + `pnpm vitest run --project scripts workflow-gate` (parse YAML text, assert gate strings) | ❌ Wave 0 |
| FND-05 | gitleaks config rejects canary | integration | `pnpm secrets:canary` | ❌ Wave 0 |
| FND-05 | Pre-commit blocks a staged canary file (temp repo) | integration | `pnpm vitest run --project scripts precommit` (temp git repo, `git commit` exits non-zero) | ❌ Wave 0 |
| FND-05 | History clean | integration | `pnpm secrets:scan` | ❌ Wave 0 |
| FND-05 | Real-data rules: emails/phones allowlist table + `*costar*` path rule | unit | `pnpm vitest run --project scripts real-data-rules` | ❌ Wave 0 |
| FND-01..05 (live) | Live origin loads, Pages deploy runs, push protection rejects a token | manual (deferred) | Owner after org creation. Deferred human verification, not a gap | n/a |

### Sampling Rate
- **Per task commit:** the pre-commit hook (gitleaks staged + real-data guard) runs automatically, then `pnpm lint && pnpm test:unit`.
- **Per wave merge:** `pnpm verify` + `actionlint .github/workflows/ci.yml`.
- **Phase gate:** full `pnpm verify` green under both bases, the actionlint pass, `.git/hooks/pre-commit` present, then `/gsd:verify-work`. Live checks are recorded as deferred human verification.

### Wave 0 Gaps
- [ ] Workspace scaffold: root `package.json`, `pnpm-workspace.yaml` (`allowBuilds`), `.nvmrc`, `.gitignore` additions (`build-sub/`, `test-results/`, `playwright-report/`, `.tools/`)
- [ ] `apps/web` SvelteKit skeleton (config, `app.html`, `static/.nojekyll`, `static/frame-guard.js`, routes, `+error.svelte`)
- [ ] `packages/core` (function + test), `packages/brand` (empty token map)
- [ ] `vitest.config.ts`, per-project Vitest configs, `tooling/vitest/no-network.ts` + wiring tests
- [ ] `apps/web/playwright.config.ts`, `scripts/serve-pages.mjs`, `tests/e2e/{routing,csp,framing,a11y}.spec.ts`
- [ ] `scripts/{assert-csp,guard-real-data,gitleaks,gitleaks-canary,build-web}.mjs` + `scripts/lib/real-data-rules.mjs` + unit tests
- [ ] `eslint.config.js`, `.prettierrc`, `.prettierignore` (incl. `.planning/`)
- [ ] `.gitleaks.toml`; simple-git-hooks config + `pnpm hooks:install` executed
- [ ] `.github/workflows/ci.yml` + actionlint run
- [ ] Browser install: `pnpm --filter web exec playwright install chromium` (headless shell v1243 already cached locally)
- [ ] Human checkpoint: owner approves `winget install --id Gitleaks.Gitleaks -e` (gitleaks absent locally)

## Verification Evidence (research-time prototype, scratch directory only)

| Check | Result |
|-------|--------|
| Kit 2.70.3 hash-mode CSP meta on prerendered pages incl. `404.html` fallback | Present on all 4 pages; boot script hashed; meta placed at `%sveltekit.head%` |
| `app.html` inline script hashed by Kit? | No; only Kit's init script hash appeared |
| Base path `/tran_real_estate` | Assets and links prefixed; `404.html` absolute; nested pages relative |
| Git Bash `BASE_PATH=/tran_real_estate` | Mangled to `C:/Program Files/Git/tran_real_estate`, so Kit config validation error |
| Playwright (Chromium headless shell 153, emulator) | 8/8 passed after `style-src-attr 'unsafe-inline'`: routes 200 both bases, 301 deep link + reload, 404 status + branded page, 3 iframe variants hidden, axe (wcag2a/aa, 21aa, 22aa) 0 violations, 0 CSP violations |
| Before the `style-src-attr` fix | 2 failures: `style-src-attr inline` violation during the Svelte `fade` transition |
| ESLint 10 flat config | 4 expected errors, allowlisted files clean |
| pnpm 11.27.0 install of full pinned set | No peer conflicts; `ERR_PNPM_IGNORED_BUILDS` (exit 1) until `allowBuilds` set; pnpm auto-writes placeholder keys |
| simple-git-hooks pre-commit (Windows Git Bash) | Canary commit blocked (exit 1); clean commit passed; `SKIP_SIMPLE_GIT_HOOKS=1` bypasses |
| gitleaks 8.30.1 (windows_x64 zip SHA-256 matched release checksums) | `git --staged` exit 1 on canary; `stdin` exit 1 on canary; default rules caught an Anthropic-style key |
| `assert-csp.mjs` | Passed good builds; reported connect-src drift and all 4 injected faults |
| `guard-real-data.mjs --staged` | Flagged fixture email + CoStar-named path (exit 1); clean set exit 0 |
| actionlint 1.7.12 | Gated `ci.yml` exit 0 |

## Sources

### Primary (HIGH confidence)
- `@sveltejs/kit@2.70.3` source (installed): `src/runtime/server/page/csp.js` (hashing, meta-ignored directives, dev `unsafe-inline` for styles), `render.js` (`Head.build()` ordering, `add_http_equiv` only when prerendering, nonce+prerender error), `src/exports/vite/preview/index.js` (307 redirects, SSR fallthrough), `src/core/postbuild/fallback.js`
- `svelte@5.57.0` source: `src/internal/client/dom/elements/transitions.js` (WAAPI `element.animate`, `element.style` writes), `src/internal/server/renderer.js` (script hashes)
- npm registry (`npm view`, 2026-09-13): all versions, peerDependencies, engines, `scripts`/`optionalDependencies` of lefthook and simple-git-hooks
- GitHub API releases + git refs: action tags and commit SHAs; gitleaks 8.30.1 assets + checksums; actionlint 1.7.12 assets
- [SvelteKit configuration](https://svelte.dev/docs/kit/configuration): csp (meta on prerendered pages, ignored directives, transitions note), paths, prerender options
- [SvelteKit adapter-static](https://svelte.dev/docs/kit/adapter-static): options, GitHub Pages config and workflow sample
- [OWASP Clickjacking Defense Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html): hide-until-verified frame breaking; meta cannot carry X-Frame-Options/frame-ancestors
- [MDN style-src-attr](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src-attr): scope, fallback, Baseline widely available
- [GitHub Docs: What is GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages): `<owner>.github.io` repo naming
- [GitHub Docs: Using custom workflows with GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages): permissions, environment, artifact constraints
- [GitHub Docs: Custom 404 page](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site)
- [GitHub Docs: Contexts](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts): `vars` empty-string default, availability in `jobs.<id>.if`
- [actions/upload-pages-artifact action.yml](https://raw.githubusercontent.com/actions/upload-pages-artifact/main/action.yml): `include-hidden-files` default false
- [actions/setup-node](https://github.com/actions/setup-node): `node-version-file`, `cache: pnpm` requires pre-installed pnpm
- [pnpm/action-setup](https://github.com/pnpm/action-setup): version from `packageManager`
- [gitleaks-action](https://github.com/gitleaks/gitleaks-action): organization license requirement
- [pnpm settings](https://pnpm.io/settings) and [pnpm build settings](https://pnpm.io/settings/build): `allowBuilds`, `strictDepBuilds` default true, removed v10 keys, settings location
- [Vitest setupFiles](https://v4.vitest.dev/config/setupfiles), [Vitest globalSetup](https://v4.vitest.dev/config/globalsetup), [Vitest projects](https://v4.vitest.dev/guide/projects)
- [Playwright webServer](https://playwright.dev/docs/test-webserver)
- [@axe-core/playwright README](https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/README.md)
- [eslint-plugin-svelte README](https://github.com/sveltejs/eslint-plugin-svelte/blob/main/README.md) and [no-at-html-tags](https://sveltejs.github.io/eslint-plugin-svelte/rules/no-at-html-tags/)
- [prettier-plugin-tailwindcss](https://github.com/tailwindlabs/prettier-plugin-tailwindcss): `tailwindStylesheet`, load last

### Secondary (MEDIUM confidence)
- GitHub Pages trailing-slash 301 and subdirectory 404 behavior: [Avoiding the Trailing Slash Tax on GitHub Pages](https://justoffbyone.com/posts/trailing-slash-tax/), [community discussion #22296](https://github.com/orgs/community/discussions/22296), [trailing-slash-guide](https://github.com/slorber/trailing-slash-guide)
- `.nojekyll` with artifact deploys: [community discussion #73729](https://github.com/orgs/community/discussions/73729), [actions/deploy-pages issue #20](https://github.com/actions/deploy-pages/issues/20), [configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

### Tertiary (LOW confidence)
- lefthook Windows binary absence under pnpm 11: single local observation, not root-caused

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Registry-verified, co-installed with pnpm 11.27.0, peer ranges checked.
- Architecture (CSP, anti-framing, base path, 404): HIGH. Prototype built with exact pins and browser-tested under both bases.
- CI workflow: HIGH for structure (actionlint, official docs); MEDIUM for live Pages behavior (deferred).
- Pitfalls: HIGH. Most were directly reproduced on this machine (MSYS mangling, pnpm build approvals, port collisions, style-src-attr violation).
- Vitest projects/setupFiles wiring and the single-webServer Playwright form: MEDIUM. Docs-verified but not executed in the prototype.

**Research date:** 2026-09-13
**Valid until:** 2026-10-13 (fast-moving: Vitest 5, pnpm 12, TypeScript 7 and SvelteKit 3 are all released or in RC; re-verify pins before upgrading)
