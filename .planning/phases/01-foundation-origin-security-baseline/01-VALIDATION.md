---
phase: 1
slug: foundation-origin-security-baseline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11 (unit; projects `web`, `core`, `scripts`) · Playwright 1.63.0 + @axe-core/playwright 4.13.0 (E2E; projects `root`, `sub`) · Node assertion scripts · gitleaks 8.30.1 (installed locally 2026-09-16) · actionlint 1.7.12 |
| **Config file** | none yet (greenfield) — Wave 0 creates `vitest.config.ts`, `apps/web/vite.config.ts`, `packages/core/vitest.config.ts`, `scripts/vitest.config.ts`, `apps/web/playwright.config.ts` |
| **Quick run command** | `pnpm lint && pnpm test:unit` |
| **Full suite command** | `pnpm verify` (check, lint, unit, build root+sub, CSP assert both builds, E2E+axe both projects, real-data guard, gitleaks canary + history scan) plus `actionlint .github/workflows/ci.yml` |
| **Estimated runtime** | ~30s quick · ~4-6 min full (includes two builds and two E2E projects) |

---

## Sampling Rate

- **After every task commit:** pre-commit hook runs automatically (gitleaks staged + real-data guard), then `pnpm lint && pnpm test:unit`
- **After every plan wave:** `pnpm verify` + `actionlint .github/workflows/ci.yml`
- **Before `/gsd:verify-work`:** full suite green under BOTH base paths, `.git/hooks/pre-commit` present, actionlint clean
- **Max feedback latency:** 30 seconds (quick loop)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-* | 01 | 0 | FND-04 | wiring | `pnpm install --frozen-lockfile && pnpm test:unit` (no-network wiring test per project) | ❌ W0 | ⬜ pending |
| 1-02-* | 02 | 1 | FND-01 | build assertion | `pnpm build:root && pnpm build:sub` (adapter `strict: true`, `handleUnseenRoutes: 'fail'`) | ❌ W0 | ⬜ pending |
| 1-02-* | 02 | 1 | FND-01 | unit | `pnpm vitest run --project web base-path` (BASE_PATH validator rejects mangled Windows path) | ❌ W0 | ⬜ pending |
| 1-02-* | 02 | 1 | FND-01 | e2e | `pnpm --filter web exec playwright test routing` (301 deep link, refresh survives, unknown path → 404 status + branded page) | ❌ W0 | ⬜ pending |
| 1-03-* | 03 | 1 | FND-02 | build assertion | `pnpm csp:assert` (meta present on every page incl. 404.html, only `<meta charset>` may precede, exact connect-src, strict script/style, inline-script hashes) | ❌ W0 | ⬜ pending |
| 1-03-* | 03 | 1 | FND-02 | unit (mutation) | `pnpm vitest run --project scripts assert-csp` (injected faults: missing meta, `unsafe-inline`, script before meta, connect-src drift, missing `hidden`) | ❌ W0 | ⬜ pending |
| 1-03-* | 03 | 1 | FND-02 | e2e | `pnpm --filter web exec playwright test csp` (zero `securitypolicyviolation` events incl. during a transition) | ❌ W0 | ⬜ pending |
| 1-04-* | 04 | 1 | FND-03 | e2e | `pnpm --filter web exec playwright test framing --project=root` (plain, sandbox-no-scripts, sandbox-with-scripts all hidden; top-level visible) | ❌ W0 | ⬜ pending |
| 1-05-* | 05 | 2 | FND-04 | unit | `pnpm vitest run --project scripts eslint-rules` (marketing import ban, `fetch(` ban, `{@html}` ban all fire; adapter + sanitizer allowlists clean) | ❌ W0 | ⬜ pending |
| 1-05-* | 05 | 2 | FND-04 | unit | `pnpm test:unit` (each project's `no-network.test.ts` asserts `fetch` throws) | ❌ W0 | ⬜ pending |
| 1-06-* | 06 | 2 | FND-04 | a11y | `pnpm --filter web exec playwright test a11y` (axe wcag2a/2aa/21a/21aa/22aa, zero violations, both projects) | ❌ W0 | ⬜ pending |
| 1-07-* | 07 | 2 | FND-04 | static | `actionlint .github/workflows/ci.yml` + `pnpm vitest run --project scripts workflow-gate` (deploy `if` contains `vars.PAGES_ENABLED == 'true'`, `needs: [hygiene, quality]`, `concurrency: pages`, `include-hidden-files: true`, SHA-pinned actions) | ❌ W0 | ⬜ pending |
| 1-08-* | 08 | 2 | FND-05 | integration | `pnpm secrets:canary` (gitleaks config rejects runtime-assembled canary; exit 1 expected) | ❌ W0 | ⬜ pending |
| 1-08-* | 08 | 2 | FND-05 | integration | `pnpm vitest run --project scripts precommit` (temp git repo: staged canary file makes `git commit` exit non-zero) | ❌ W0 | ⬜ pending |
| 1-08-* | 08 | 2 | FND-05 | integration | `pnpm secrets:scan` (full history clean) | ❌ W0 | ⬜ pending |
| 1-08-* | 08 | 2 | FND-05 | unit | `pnpm vitest run --project scripts real-data-rules` (email/phone allowlist table + `*costar*` path rule) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are provisional; the planner assigns final plan/task numbering and must keep every row mapped.*

---

## Wave 0 Requirements

- [ ] Workspace scaffold: root `package.json` (scripts, `packageManager: pnpm@11.27.0`, `engines`), `pnpm-workspace.yaml` with `allowBuilds: { simple-git-hooks: false }`, `.nvmrc` (24), `.gitignore` additions (`build-sub/`, `test-results/`, `playwright-report/`, `.tools/`)
- [ ] `vitest.config.ts` (`test.projects`), per-project Vitest configs, `tooling/vitest/no-network.ts` as **`setupFiles`** (NOT `globalSetup`) + a wiring test per project
- [ ] `apps/web` SvelteKit skeleton so E2E has a target: `svelte.config.js`, `vite.config.ts`, `app.html` (`<html hidden>`, `%sveltekit.head%` right after `<meta charset>`), `static/.nojekyll`, `static/frame-guard.js`, placeholder routes each with `<title>` and `<h1>`, `+error.svelte`
- [ ] `packages/core` (exported function + test), `packages/brand` (empty token map)
- [ ] `scripts/serve-pages.mjs` (Pages emulator; ports from env, defaults 4273/4274/4275 — NOT 4173/4174), `apps/web/playwright.config.ts` (single `webServer`, projects `root`/`sub`)
- [ ] `scripts/{assert-csp,guard-real-data,gitleaks,gitleaks-canary,build-web}.mjs` + `scripts/lib/real-data-rules.mjs` with unit tests (fixtures build real-looking values at runtime so the guard doesn't flag its own tests)
- [ ] `eslint.config.js`, `.prettierrc`, `.prettierignore` (must ignore `.planning/`, lockfile, build dirs, `test-results/`)
- [ ] `.gitleaks.toml` (canary rule, no path allowlists); `simple-git-hooks` config + `pnpm hooks:install` executed and `.git/hooks/pre-commit` verified present
- [ ] `.github/workflows/ci.yml` + actionlint run (re-run after any edit)
- [ ] `pnpm --filter web exec playwright install chromium`
- [ ] ~~Human checkpoint: owner approves gitleaks install~~ **RESOLVED 2026-09-16** — gitleaks 8.30.1 installed via winget, on PATH in PowerShell and Git Bash. No checkpoint needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live site loads at `https://tranrealestate.github.io/`, deep-link refresh works on the real host | FND-01 | Requires the GitHub org + Pages (deferred owner action) | After creating org `tranrealestate` and repo `tranrealestate.github.io`, set `PAGES_ENABLED=true`, push, then load `/`, navigate to `/renter/`, refresh, and confirm no 404 |
| Pages deploy job actually runs and publishes | FND-04 | Requires a remote and Pages enabled | Confirm the `deploy` job runs only on `main` pushes with `PAGES_ENABLED=true`, and that `.nojekyll` is present in the published artifact |
| GitHub secret-scanning push protection rejects a token push | FND-05 | Server-side GitHub feature | With push protection enabled, attempt to push a branch containing a canary pattern and confirm rejection |

*All other phase behaviors have automated local verification. The three rows above are deferred human verification, NOT gaps — the owner has no org/domain yet ("keep going until we do").*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, never `vitest`)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
