---
phase: 1
slug: foundation-origin-security-baseline
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.11 (unit; projects `web`, `core`, `scripts`) · Playwright 1.63.0 + @axe-core/playwright 4.13.0 (E2E; projects `root`, `sub`) · Node assertion scripts · gitleaks 8.30.1 (installed locally 2026-09-16) · actionlint 1.7.12 (downloaded to gitignored `.tools/` by plan 01-08) |
| **Config file** | none yet (greenfield) — created by plans 01-01/01-02 (`vitest.config.ts`, per-project configs) and 01-03 (`apps/web/vite.config.ts`, `apps/web/playwright.config.ts`) |
| **Quick run command** | `corepack pnpm lint && corepack pnpm test:unit` |
| **Full suite command** | `corepack pnpm verify` (check, lint, unit, build root+sub, CSP assert both builds, E2E+axe both projects, real-data guard, gitleaks canary + history scan, `lint:workflows` via actionlint) |
| **Estimated runtime** | ~30s quick · ~4-6 min full (two builds and two E2E projects) |

---

## Sampling Rate

- **After every task commit:** pre-commit hook runs automatically (gitleaks staged + real-data guard), then `corepack pnpm lint && corepack pnpm test:unit`
- **After every plan wave:** `corepack pnpm verify` + `corepack pnpm lint:workflows`
- **Before `/gsd:verify-work`:** full suite green under BOTH base paths, `.git/hooks/pre-commit` present, actionlint clean
- **Max feedback latency:** 30 seconds (quick loop). Four verifies exceed this by design (two builds + Playwright, or full `pnpm verify`); they are wave-gate checks, not per-task checks.

---

## Per-Task Verification Map

Final plan/task ownership after plan revision (7 waves, 0-6).

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | FND-04 | wiring | `corepack pnpm install --frozen-lockfile` exits 0; `git remote -v` prints nothing | ❌ W0 | ✅ green |
| 01-01-02 | 01 | 0 | FND-05 | integration | `corepack pnpm secrets:canary` (gitleaks config rejects runtime-assembled canary) | ❌ W0 | ✅ green |
| 01-01-02 | 01 | 0 | FND-05 | integration | `corepack pnpm secrets:scan` (full history clean); `.git/hooks/pre-commit` exists | ❌ W0 | ✅ green |
| 01-02-01 | 02 | 1 | FND-04 | unit | `corepack pnpm vitest run --project scripts no-network` (fetch throws) | ❌ W0 | ✅ green |
| 01-02-02 | 02 | 1 | FND-04 | unit | `corepack pnpm vitest run --project core no-network` (fetch throws); core wiring test passes | ❌ W0 | ✅ green |
| 01-03-01 | 03 | 2 | FND-01 | unit | `corepack pnpm vitest run --project web base-path` (validator rejects mangled Windows path) | ❌ W0 | ✅ green |
| 01-03-01 | 03 | 2 | FND-04 | unit | `corepack pnpm vitest run --project web no-network` (web project setupFiles wiring proven) | ❌ W0 | ✅ green |
| 01-03-03 | 03 | 2 | FND-01 | build assertion | `corepack pnpm build:root && corepack pnpm build:sub` (adapter `strict: true`, `handleUnseenRoutes: 'fail'`; output shows `build-web: pnpm 11.27.0`) | ❌ W0 | ✅ green |
| 01-04-01 | 04 | 3 | FND-02 | build assertion | `corepack pnpm csp:assert` (meta on every page incl. 404.html, only `<meta charset>` precedes, exact connect-src, strict script/style, inline-script hashes, `<html hidden>`, `.nojekyll`) | ❌ W0 | ✅ green |
| 01-04-02 | 04 | 3 | FND-02 | unit (mutation) | `corepack pnpm vitest run --project scripts assert-csp` (injected faults: missing meta, `unsafe-inline`, script before meta, connect-src drift, missing `hidden`) | ❌ W0 | ✅ green |
| 01-06-01 | 06 | 3 | FND-04 | unit | `corepack pnpm vitest run --project scripts eslint-rules` (`lintText` only — marketing import ban, `fetch(` ban, `{@html}` ban fire; adapter + sanitizer allowlists clean; nothing written to `apps/web/src`) | ❌ W0 | ✅ green |
| 01-06-02 | 06 | 3 | FND-05 | unit | `corepack pnpm vitest run --project scripts real-data-rules` (email/phone allowlist table + `*costar*` path rule) | ❌ W0 | ✅ green |
| 01-06-03 | 06 | 3 | FND-05 | integration | `corepack pnpm vitest run --project scripts precommit` (temp git repo: staged canary makes `git commit` exit non-zero) | ❌ W0 | ✅ green |
| 01-05-02 | 05 | 4 | FND-01 | e2e | `corepack pnpm --filter web exec playwright test routing` (301 deep link, refresh survives, unknown path → 404 status + branded page; both projects) | ❌ W0 | ✅ green |
| 01-07-01 | 07 | 5 | FND-02 | e2e | `corepack pnpm --filter web exec playwright test csp` (zero `securitypolicyviolation` events incl. during a transition) | ❌ W0 | ✅ green |
| 01-07-02 | 07 | 5 | FND-03 | e2e | `corepack pnpm --filter web exec playwright test framing --project=root` (plain, sandbox-no-scripts, sandbox-with-scripts hidden; top-level visible); `--project=sub --pass-with-no-tests` exits 0 | ❌ W0 | ✅ green |
| 01-07-03 | 07 | 5 | FND-04 | a11y | `corepack pnpm --filter web exec playwright test a11y` (axe wcag2a/2aa/21a/21aa/22aa, zero violations, both projects) | ❌ W0 | ✅ green |
| 01-08-01 | 08 | 5 | FND-04 | static | `ACTIONLINT_BIN=definitely-not-a-binary node scripts/actionlint.mjs` exits 1 (fail-closed probe; runner created here, workflow not yet written) | ❌ W0 | ✅ green |
| 01-08-02 | 08 | 5 | FND-04 | static | `corepack pnpm lint:workflows` (actionlint 1.7.12 against `.github/workflows/ci.yml`; gitleaks install present in BOTH `hygiene` and `quality` jobs) | ❌ W0 | ✅ green |
| 01-08-03 | 08 | 5 | FND-04 | unit | `corepack pnpm vitest run --project scripts workflow-gate` (deploy `if` has `vars.PAGES_ENABLED == 'true'`, `needs: [hygiene, quality]`, `concurrency: pages`, `include-hidden-files: true`, SHA-pinned actions) | ❌ W0 | ✅ green |
| 01-09-01 | 09 | 6 | FND-01..05 | full suite | `corepack pnpm verify` green; walks this map | ❌ W0 | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Split across plans 01-01 (wave 0) and 01-02 (wave 1) so neither exceeds context budget:

- [x] ~~Human checkpoint: owner approves gitleaks install~~ **RESOLVED 2026-09-16** — gitleaks 8.30.1 installed via winget, on PATH in PowerShell and Git Bash.
- [ ] 01-01: root `package.json` (full script surface, `packageManager: pnpm@11.27.0`, `engines`), `pnpm-workspace.yaml` with `allowBuilds: { simple-git-hooks: false }`, `.nvmrc` (24), `.gitignore` additions, `.prettierrc`/`.prettierignore` (ignores `.planning/`), `eslint.config.js`, `.gitleaks.toml` (canary rule, no path allowlists), `scripts/{gitleaks,gitleaks-canary,guard-real-data}.mjs` + `scripts/lib/real-data-rules.mjs`, then `simple-git-hooks` config + `hooks:install` executed
- [ ] 01-02: `vitest.config.ts` (`test.projects`), per-project Vitest configs, `tooling/vitest/no-network.ts` as **`setupFiles`** (NOT `globalSetup`) + wiring tests for `scripts` and `core`, `packages/core` (function + test), `packages/brand` (empty token map)
- [ ] 01-03: `apps/web` SvelteKit skeleton (`svelte.config.js`, `vite.config.ts`, `app.html` with `<html hidden>` and `%sveltekit.head%` right after `<meta charset>`, `static/.nojekyll`, `static/frame-guard.js`, placeholder routes each with `<title>` and `<h1>`, `+error.svelte`), `web` no-network wiring test, `base-path` test, `scripts/build-web.mjs` (pinned pnpm via `npm_execpath`), Playwright + axe devDependencies pinned in `apps/web/package.json`
- [ ] 01-05: `scripts/serve-pages.mjs` (ports 4273/4274/4275), `apps/web/playwright.config.ts` (single `webServer`), `playwright install chromium`
- [ ] 01-08: `.github/workflows/ci.yml`, `.github/dependabot.yml`, `scripts/actionlint.mjs`, actionlint 1.7.12 into gitignored `.tools/`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live site loads at `https://tranrealestate.github.io/`, deep-link refresh works on the real host | FND-01 | Requires the GitHub org + Pages (deferred owner action) | Create org `tranrealestate` and repo named exactly `tranrealestate.github.io`, set `PAGES_ENABLED=true`, push, load `/`, navigate to `/renter/`, refresh, confirm no 404 |
| Pages deploy job runs and publishes | FND-04 | Requires a remote and Pages enabled | Confirm `deploy` runs only on `main` pushes with `PAGES_ENABLED=true`; `.nojekyll` present in the published artifact |
| GitHub secret-scanning push protection rejects a token push | FND-05 | Server-side GitHub feature | With push protection enabled, push a branch containing a canary pattern and confirm rejection |

*All other phase behaviors have automated local verification. The three rows above are deferred human verification, NOT gaps — the owner has no org/domain yet ("keep going until we do"). Plan 01-09 records them in `docs/DEPLOY-CHECKLIST.md`.*

*Note on FND-02 wording:* the roadmap's literal text names an analytics beacon host in `connect-src`; per CONTEXT.md that host is deliberately deferred to Phase 10, so its absence in Phase 1 is compliant, not a gap.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (`vitest run`, never `vitest`)
- [x] Feedback latency < 30s on the quick loop; wave-gate verifies documented as exceptions
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-16 (after plan revision; all 16 original verification commands mapped to owning tasks)
