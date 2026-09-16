# Phase 1: Foundation, Origin & Security Baseline - Context

**Gathered:** 2026-09-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the pnpm-workspace SvelteKit skeleton (placeholder routes only), statically prerendered with an environment-driven base path, carrying a strict meta Content-Security-Policy, an anti-framing guard, and a local-first quality gate (typecheck, lint, unit, E2E, axe, secret scan, real-data/CoStar guard). The GitHub Actions CI + gated deploy workflow is fully written. Requirements: FND-01..FND-05.

**Owner constraint (2026-09-13):** "I do not have a domain site just yet. Just keep going until we do." The GitHub org `tranrealestate`, Pages enablement, secret-scanning push protection, and any git remote/push are DEFERRED owner actions. This phase must be completable and verifiable entirely locally:
- Live-origin success criteria (visiting `https://tranrealestate.github.io/`, push-protection rejection, actual Pages deploy) are proven locally: `vite preview` / static server under root AND non-root base path with deep-link refresh, a built-HTML CSP assertion, a local gitleaks run that rejects a test key pattern, and deploy workflow YAML validated but gated off.
- Verification should mark live-deploy items as deferred human verification, not gaps.

Out of this phase: brand/design tokens and real page content (Phase 2), key storage (Phase 3), any data or AI code (Phases 4-5), extension package (Phase 11), analytics host (Phase 10).

</domain>

<decisions>
## Implementation Decisions

### Repo & Deploy (no org yet)
- `BASE_PATH` env var defaults to `''` (org root site `tranrealestate.github.io/`). CI and the local E2E suite ALSO run the built site under a non-root base path (`/tran_real_estate`) to prove base-path safety (no hard-coded root links, assets resolve, deep-link refresh works).
- Deploy workflow (`.github/workflows/deploy.yml` or a job in CI) is fully written using `actions/upload-pages-artifact` + `actions/deploy-pages`, with `concurrency` set, but runs only when repository variable `PAGES_ENABLED == 'true'`. It is a no-op until the owner enables it, so it never fails or blocks.
- No git remote is added and nothing is pushed. Local commits only.
- Toolchain pinned: Node 24 via `.nvmrc` (and `engines`), pnpm `11.27.0` via `packageManager` field (Corepack). The local machine currently has pnpm 11.0.9, so use Corepack to honor the pin, or document if unavailable.

### Security Baseline
- CSP via SvelteKit `kit.csp` in hash mode, emitted as a `<meta http-equiv="Content-Security-Policy">` on every prerendered page. `connect-src 'self'` plus exactly: `https://api.rentcast.io`, `https://api.anthropic.com`, `https://api.openai.com`, `https://generativelanguage.googleapis.com`, `https://openrouter.ai`, `https://api.web3forms.com`. The analytics beacon host is NOT added now; Phase 10 adds it. Also `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self' https://api.web3forms.com`, `script-src 'self'` + hashes, no `unsafe-inline`/`unsafe-eval` for scripts. A CI assertion (node script over `build/**/*.html`) fails if the meta tag is missing, not first in `<head>`, contains `unsafe-inline`/`unsafe-eval` in script-src, or `connect-src` differs from the allowlist. Research flag: confirm `kit.csp` meta emission on prerendered adapter-static pages and style-src handling (Svelte transitions / Tailwind may need `style-src` consideration — resolve in research).
- Anti-framing: standard anti-clickjacking pattern. `html` hidden by default via CSS, and a small hash-allowed inline script reveals the page only when `window.self === window.top`, otherwise attempts `top.location = self.location`. Meta CSP cannot use `frame-ancestors`, so this is the only mitigation. Covered by a Playwright test that loads a page inside an iframe from another origin/port and asserts the app content is not visible.

### Research Amendments (2026-09-13, evidence-backed; SUPERSEDE conflicting bullets above)
Phase research (01-RESEARCH.md) prototyped the exact stack and proved these corrections. They preserve the intent of the accepted decisions:
- **D1 CSP placement:** `kit.csp` injects the meta tag at `%sveltekit.head%`, not first in `<head>`. `app.html` places `%sveltekit.head%` immediately after `<meta charset>`. The CI assertion allows only `<meta charset>` before the CSP meta.
- **D2 Anti-framing mechanism:** `kit.csp` does NOT hash inline scripts or styles in `app.html`, so a hash-allowed inline script/style would be blocked and fail open. Use `<html hidden>` (attribute) plus an external `static/frame-guard.js` (loaded as `'self'` script) that removes `hidden` only when `window.self === window.top`. This was proven to stay hidden in cross-origin and sandboxed iframes. The top-navigation attempt is optional (Chrome blocks it).
- **D3 Style CSP:** Svelte 5 transitions set inline style attributes. Use `style-src 'self'` + `style-src-attr 'unsafe-inline'`. `script-src` stays strict (`'self'` + hashes, no `unsafe-inline`/`unsafe-eval`), and `style-src` elements stay strict.
- **D4 No-network tests:** make `fetch` throw via Vitest `setupFiles`, not `globalSetup`.
- **Pre-commit tool:** `simple-git-hooks` (lefthook's Windows binary failed). pnpm 11 needs `allowBuilds: { simple-git-hooks: false }` in `pnpm-workspace.yaml`.
- **gitleaks in CI:** download the pinned gitleaks 8.30.1 binary with SHA-256 verification (`gitleaks-action` requires a paid license for org repos).
- **Pages upload:** `actions/upload-pages-artifact` needs `include-hidden-files: true` so `.nojekyll` ships.
- **Base-path builds on Windows:** set `BASE_PATH` from a Node script (Git Bash rewrites `/tran_real_estate` into a Windows path).
- **Local E2E server:** use a tiny Pages-emulating static server (not `vite preview`: 307 redirects, SSR-style 404s), on ports other than 4173/4174 (used by another local project). Use a single Playwright `webServer`.
- **Org root site:** a root site at `tranrealestate.github.io/` requires the repo to be named `tranrealestate.github.io` (deferred owner action).
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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None. Greenfield repository with only `.planning/`, `.gitignore`, and `CLAUDE.md`.

### Established Patterns
- `CLAUDE.md` "Research Reconciliation Overrides" section is authoritative (raw-fetch LLM adapters, print-CSS PDF, prerender-all routing with `?id=`, no third-party scripts, never deploy under `wolfwdavid.github.io`).
- `.gitignore` already covers `node_modules/`, `.svelte-kit/`, `build/`, `dist/`, `.env*`, `data/costar/`.

### Integration Points
- Sibling project `Websites/Tran/Tran_desktop/frontend` is a Svelte app but is a separate repo; do not share code with it.
- `.planning/research/STACK.md` and `ARCHITECTURE.md` contain the folder layout, CSP details, and Pages pitfalls; `PITFALLS.md` has the Pages deploy traps (`.nojekyll`, hard-coded root links, module-level `localStorage` in prerender, deploy-pages wedges).

</code_context>

<specifics>
## Specific Ideas

- The owner's global rule: commit messages must never mention AI assistants or tools; keep them focused on the change.
- No git push, no remote creation during autonomous execution.
- Future origin is `tranrealestate.github.io` (org root Pages repo). The non-root base-path test exists so a later move (custom domain or project Pages path) costs zero code.

</specifics>

<deferred>
## Deferred Ideas

- Creating the GitHub org, enabling Pages, setting `PAGES_ENABLED=true`, enabling push protection, adding a remote, and pushing are owner actions after the org exists.
- Analytics beacon host in CSP comes in Phase 10.
- `apps/extension` workspace package comes in Phase 11.

</deferred>
