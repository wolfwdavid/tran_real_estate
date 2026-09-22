---
phase: 01-foundation-origin-security-baseline
verified: 2026-09-22T19:23:02Z
status: human_needed
score: 35/35 plan must-have truths verified; 5/5 roadmap success criteria verified locally (3 live-origin sub-items deferred to the owner)
human_verification:
  - test: "Load https://tranrealestate.github.io/, navigate to /renter/, refresh; visit /renter (no slash); visit a bogus path; view source"
    expected: "Landing page loads; deep-link refresh returns the page, not a 404; no-slash URL redirects to /renter/; bogus path shows the branded 404; the CSP meta is directly after <meta charset> with no unsafe-inline/unsafe-eval in script-src"
    why_human: "Requires the tranrealestate GitHub org, a repo named exactly tranrealestate.github.io, Pages enabled and a push. No remote exists yet (owner constraint 2026-09-13). Recorded in docs/DEPLOY-CHECKLIST.md Step 7 items 1-5."
  - test: "After setting the repository variable PAGES_ENABLED=true, push to main and open the Actions tab; download the github-pages artifact"
    expected: "hygiene and quality (root + sub) jobs pass, the deploy job runs only after both and publishes; the artifact contains .nojekyll at its root"
    why_human: "The deploy job is fully written but dormant behind vars.PAGES_ENABLED == 'true' and needs a live GitHub Actions run. Recorded in docs/DEPLOY-CHECKLIST.md Step 7 item 6."
  - test: "With secret scanning + push protection enabled, commit a GitHub-recognised test token on a throwaway branch with SKIP_SIMPLE_GIT_HOOKS=1 and push it"
    expected: "GitHub push protection rejects the push; the branch is then deleted and the token revoked"
    why_human: "Server-side GitHub feature; cannot be exercised without a remote. The local half (gitleaks pre-commit + CI history scan) is proven. Recorded in docs/DEPLOY-CHECKLIST.md Step 7 item 7."
---

# Phase 1: Foundation, Origin & Security Baseline Verification Report

**Phase Goal:** The app is live on its own dedicated origin with a strict security baseline, and a CI gate blocks any broken, insecure, or secret-leaking push from deploying
**Verified:** 2026-09-22T19:23:02Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Verification method

Nothing in this report is taken from the SUMMARY files. Every claim below was re-derived from the working tree and from commands run during this verification:

- `corepack pnpm verify` run once (exit 0, ~2 min wall clock). Stages observed in the log: `check` (svelte-check 360 files, 0 errors, 0 warnings; `tsc --noEmit` in core and brand), `lint` (Prettier clean, ESLint clean), `test:unit` (10 files, 134/134), `build:root` and `build:sub` (both print `build-web: pnpm 11.27.0`), `csp:assert` (`7 pages in apps/web/build`, `7 pages in apps/web/build-sub`), `test:e2e` (30/30 across `root` and `sub`), `guard` (108 files), `secrets:canary` (`detected as expected`), `secrets:scan` (51 commits, no leaks), `lint:workflows` (actionlint silent).
- Independent probes outside the suite: live mutations of the real `apps/web/build/index.html` against `checkHtml`, a staged-secret probe through `scripts/gitleaks.mjs staged` and `scripts/guard-real-data.mjs --staged` in this repository (no commit made, HEAD unchanged, tree clean afterwards), fail-closed probes of both tool runners, a `node:net` port probe after the E2E run, and grep/read inspection of every artifact.
- `git remote -v` prints nothing. All 26 commit hashes cited across the nine SUMMARY files exist (`gsd-tools verify commits`: 26/26 valid).

`gsd-tools verify artifacts` / `verify key-links` could not parse the nested `must_haves` frontmatter block ("No must_haves.artifacts found"), so artifacts and key links were verified manually (existence, required pattern, named exports via a real ESM import, minimum line counts).

## Goal Achievement

### Observable Truths (roadmap success criteria)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| SC1 | Visitor loads the site, opens a portal route, refreshes on the deep link and gets the page; the same build passes an E2E smoke under a non-root `BASE_PATH` in CI | ✓ VERIFIED locally / ? live origin deferred | `routing.spec.ts` 8/8 on `root` (`/`) and `sub` (`/tran_real_estate/`): every route 200 with visible `h1`, `goto('renter')` lands on `/renter/` and survives `page.reload()`, unknown path is HTTP 404 with `404` in the `h1`, every link resolves to a trailing-slash path under the current base. Both builds contain `index.html`, `renter/`, `investor/`, `agent/`, `settings/`, `print/index.html`, `404.html`, `.nojekyll`, `frame-guard.js`; `build-sub/404.html` references `/tran_real_estate/_app/`, root build has zero `/tran_real_estate/` occurrences. `ci.yml` quality matrix runs `--project=root` and `--project=sub` per leg. Live-host check deferred (owner has no org/remote). |
| SC2 | Every deployed page has the CSP meta first in `<head>`; `connect-src` allows only RentCast, Anthropic, OpenAI, Gemini, OpenRouter, Web3Forms (+ beacon host, deferred to Phase 10 per CONTEXT); no `unsafe-inline`/`unsafe-eval` in script-src; a CI assertion fails on regression | ✓ VERIFIED | Built `index.html`: `<meta charset>` then `<meta http-equiv="content-security-policy" content="default-src 'self'; connect-src 'self' https://api.rentcast.io https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https://openrouter.ai https://api.web3forms.com; object-src 'none'; script-src 'self' 'sha256-…'; style-src 'self'; style-src-attr 'unsafe-inline'; base-uri 'self'; form-action 'self' https://api.web3forms.com">`. CSP meta count = 1 and `<html lang="en" hidden>` present on every sampled page in both builds. `scripts/assert-csp.mjs` (`CONNECT` = exactly the 7 tokens above) runs in `pnpm csp:assert` and in `ci.yml` per matrix leg; live mutations of the real built page (`unsafe-inline` in script-src, extra/removed connect-src host, meta removed, `<script>` before meta, `frame-ancestors` added) were each caught by `checkHtml`. `csp.spec.ts` 6/6: zero `securitypolicyviolation` events on all six routes under both bases, through a fade transition and an inline `style` attribute write, with a provoked inline-script violation as the non-vacuity control. The analytics beacon host is absent from both `svelte.config.js` and `assert-csp.mjs` by design (CONTEXT Research Amendments; Phase 10 adds it to both files together). |
| SC3 | Loading any app page inside a third-party iframe does not render the app inside the frame | ✓ VERIFIED | `app.html` ships `<html lang="en" hidden>` and an external `frame-guard.js` (same-origin, covered by `script-src 'self'`) that removes `hidden` only when `window.self === window.top`. `framing.spec.ts` 4/4 on `root`: `#plain`, `#sandboxed` (`allow-forms`), `#sandboxed-scripts` (`allow-scripts allow-same-origin`) frames served from the attacker origin on port 4275 each have `html[hidden]` present (document proven loaded) and the `h1` hidden, with the attacker page URL intact; positive control at top level shows `html` without `hidden` and a visible `h1`. `assert-csp.mjs` fails any page lacking `hidden` or any build lacking `frame-guard.js`. |
| SC4 | A push failing typecheck, lint, unit, E2E or axe does not deploy; a passing push deploys to Pages automatically with `concurrency` | ✓ VERIFIED (CI definition) / ? live deploy deferred | `.github/workflows/ci.yml`: `quality` matrix (root, sub) runs `pnpm check`, `pnpm lint`, `pnpm test:unit`, build, `assert-csp.mjs`, `playwright test --project=<target>` (routing + csp + framing + a11y); `hygiene` runs canary, full-history gitleaks, real-data guard. `deploy` has `needs: [hygiene, quality]`, `if: github.event_name == 'push' && github.ref == 'refs/heads/main' && vars.PAGES_ENABLED == 'true'`, `concurrency: { group: pages, cancel-in-progress: false }`, `actions/deploy-pages`; upload step has `include-hidden-files: true` for `.nojekyll`. All 7 `uses:` are 40-hex SHA-pinned, no floating tags, `persist-credentials: false` on both checkouts, no `gitleaks-action`. actionlint 1.7.12 reports no findings; `workflow-gate.test.ts` (20 tests, part of 134/134) pins every gate string. `a11y.spec.ts` 12/12 (six routes × two bases, WCAG 2.0/2.1/2.2 A+AA, `passes.length > 0` guard). The actual Pages run needs a remote and `PAGES_ENABLED=true` (deferred). |
| SC5 | A commit with a test API-key pattern is rejected by push protection; a commit adding PII-shaped listing data or a CoStar-pattern path fails CI | ✓ VERIFIED (local + CI halves) / ? push protection deferred | Live probe in this repo: staged `fixtures/verifier-probe.json` containing a runtime-assembled `TRANCANARY_…` value and a real-looking email → `node scripts/gitleaks.mjs staged` exit 1 and `node scripts/guard-real-data.mjs --staged` exit 1 (`real-looking email (use @example.com/@example.org/.test)`); HEAD unchanged, probe removed. `.git/hooks/pre-commit` contains exactly `node scripts/gitleaks.mjs staged && node scripts/guard-real-data.mjs --staged`. `precommit.test.ts` (10 tests) drives real `git commit` in temp repos: canary, PII email, PII phone and `costar`-named path all block; clean file commits; index (not worktree) is what is scanned. `real-data-rules.test.ts` 36 cases match the documented table. CI `hygiene` runs the same canary + history scan + guard from a SHA-256-verified gitleaks 8.30.1 binary. GitHub push protection itself is server-side and deferred to the owner's checklist. |

**Score:** 5/5 success criteria verified locally; 3 live-origin sub-items (SC1 live host, SC4 actual deploy, SC5 push protection) are human verification, recorded in `docs/DEPLOY-CHECKLIST.md` Step 7, not gaps.

### Observable Truths (plan must_haves, 35 total)

| Plan | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 01-01 | Repo installs reproducibly with pinned toolchain, no build-script prompt | ✓ | `packageManager: pnpm@11.27.0`, `engines >=24 <25`, `.nvmrc` = 24, `allowBuilds: { simple-git-hooks: false }`; `verify` ran on Node v24.18.0 / pnpm 11.27.0 |
| 01-01 | A commit containing a canary secret is rejected locally | ✓ | Live staged probe exit 1; hook installed; `precommit.test.ts` |
| 01-01 | A commit with real-looking email/phone in a fixture path, or any `*costar*` path, is rejected locally | ✓ | Live staged probe (guard exit 1); `precommit.test.ts` phone + costar cases |
| 01-01 | `pnpm lint` runs green | ✓ | `verify` log: Prettier "All matched files use Prettier code style!", ESLint silent |
| 01-02 | `pnpm test:unit` discovers and runs every Vitest project | ✓ | `vitest.config.ts` projects `['apps/web','packages/core','scripts']`; 10 files / 134 tests |
| 01-02 | A unit test calling `fetch` fails loudly | ✓ | `tooling/vitest/no-network.ts` (throwing stub + `beforeEach` re-assert) wired via `setupFiles` in all three project configs; `no-network.test.ts` in each project |
| 01-02 | `pnpm check` typechecks workspace packages | ✓ | `verify` log: core + brand `tsc --noEmit` Done, svelte-check 0 errors |
| 01-03 | Every placeholder route prerenders under `''` and `/tran_real_estate` | ✓ | Both build dirs hold all 7 pages; `handleUnseenRoutes: 'fail'`, `strict: true` |
| 01-03 | Mangled `BASE_PATH` fails the build with an actionable error | ✓ | `base-path.js` regex + message naming `BASE_PATH` and `MSYS_NO_PATHCONV`; `base-path.test.ts` (10) green |
| 01-03 | Every built page carries the CSP meta immediately after `<meta charset>` | ✓ | Built HTML inspected; oracle enforces on all 14 pages |
| 01-03 | Every built page ships `<html hidden>` and an external same-origin frame guard | ✓ | Sampled pages: `hidden=1`; `frame-guard.js` in both build roots |
| 01-03 | `fetch` throws inside the `web` Vitest project | ✓ | `apps/web/vite.config.ts` `setupFiles`; `apps/web/src/lib/no-network.test.ts` |
| 01-04 | A build whose CSP meta is missing, weakened or displaced fails the check | ✓ | Live mutations caught: `CSP meta missing`, `script-src token 'unsafe-inline' not allowed`, `CSP meta must be first in <head>` |
| 01-04 | `connect-src` drift fails the check | ✓ | Live mutations caught for an added and a removed host |
| 01-04 | Losing `<html hidden>`, `.nojekyll`, `404.html` or `frame-guard.js` fails the check | ✓ | `hidden` removal caught live; missing-dir run lists all nine carriers and exits 1 |
| 01-04 | The oracle is mutation tested | ✓ | `assert-csp.test.ts` 322 lines, in the 134/134 run |
| 01-05 | Deep link without trailing slash is redirected and gets the page | ✓ | `routing.spec.ts` test 2 on both projects |
| 01-05 | Refresh on a deep link gets the page | ✓ | `page.reload()` assertion, both projects |
| 01-05 | Unknown path returns HTTP 404 with the branded page | ✓ | `routing.spec.ts` test 3; `serve-pages.mjs` serves `404.html` with status 404 |
| 01-05 | All of the above hold under root and `/tran_real_estate` | ✓ | 4 root + 4 sub tests green |
| 01-06 | Architectural lint boundaries actually fire | ✓ | `eslint-rules.test.ts` (12 cases, in-memory `lintText`, `projectService: false` only) |
| 01-06 | Allowlists produce no false positives | ✓ | Adapter folders and the virtual `sanitize-html.svelte` path yield 0 errors; the file does not exist on disk |
| 01-06 | Real-data guard flags real-looking values and passes fictional forms | ✓ | `real-data-rules.test.ts` 36 cases; `findProblems` clones global regexes per call |
| 01-06 | A staged secret is rejected by the installed hook; a clean commit is not | ✓ | `precommit.test.ts` + live probe |
| 01-07 | Zero CSP violations on any route in a real browser, including during a transition | ✓ | `csp.spec.ts` 6/6 with provoked-violation control |
| 01-07 | Top-level shows the app; the same page in a third-party iframe shows nothing | ✓ | `framing.spec.ts` 4/4 |
| 01-07 | Hiding holds in plain, sandboxed-no-scripts and sandboxed-with-scripts frames | ✓ | One test per variant, `html[hidden]` asserted present first |
| 01-07 | Every route passes axe WCAG A/AA under both bases | ✓ | `a11y.spec.ts` 12/12 |
| 01-08 | A push failing any gate cannot deploy | ✓ | `needs: [hygiene, quality]` + gated `if:` |
| 01-08 | Deploy stays dormant until `PAGES_ENABLED=true`, never fails or blocks | ✓ | Unset `vars.PAGES_ENABLED` evaluates to `''`; both gated steps skip |
| 01-08 | Workflow is valid GitHub Actions YAML, verified locally without a remote | ✓ | actionlint 1.7.12 via `.tools/actionlint.exe`, silent; `ACTIONLINT_BIN=definitely-not-a-binary` exits 1 even with the local binary present |
| 01-08 | The published artifact would include `.nojekyll` | ✓ | `include-hidden-files: true`, `path: apps/web/build`, `.nojekyll` present in build |
| 01-09 | The entire phase gate runs green in one command | ✓ | `corepack pnpm verify` exit 0 this session |
| 01-09 | Owner has an exact ordered checklist with the repo-name constraint | ✓ | `docs/DEPLOY-CHECKLIST.md` Steps 1-7, "named exactly `tranrealestate.github.io`", `PAGES_ENABLED` |
| 01-09 | A contributor can run the local gates without reverse-engineering package.json | ✓ | `README.md`: prerequisites, 4 setup steps, 13-row command table, ports, Windows notes, "Not wired yet" |

**Score:** 35/35 plan truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `package.json` | Pinned toolchain, script surface, hook wiring | ✓ VERIFIED | `pnpm@11.27.0`, all 13 scripts, `simple-git-hooks.pre-commit` string |
| `pnpm-workspace.yaml` | Globs + `allowBuilds` | ✓ VERIFIED | contains `allowBuilds` |
| `.gitleaks.toml` | Default ruleset + canary rule, no path allowlist | ✓ VERIFIED | `useDefault = true`, `tran-canary-test-key`, no `allowlist` |
| `scripts/lib/real-data-rules.mjs` | Pure rules, 8 exports | ✓ VERIFIED | All 8 exports confirmed by ESM import |
| `scripts/guard-real-data.mjs` / `gitleaks.mjs` / `gitleaks-canary.mjs` | CLI gates, fail-closed, runtime-assembled canary | ✓ VERIFIED | `GITLEAKS_BIN=definitely-not-a-binary` → exit 1; canary split across `+`; no `TRANCANARY_[A-Z0-9]{32}` literal anywhere in sources |
| `eslint.config.js` | Import boundaries, fetch ban, `{@html}` ban | ✓ VERIFIED | `no-restricted-imports`, `no-restricted-syntax`, `svelte/no-at-html-tags` override for `sanitize-html.svelte` |
| `vitest.config.ts`, `tooling/vitest/no-network.ts` | Projects harness + kill-switch | ✓ VERIFIED | `projects` array; `beforeEach` re-assert; no `vitest.workspace.ts` |
| `packages/core/src/index.ts`, `packages/brand/src/index.ts` | `PORTALS`/`isPortal`; empty `tokens` | ✓ VERIFIED | `Object.freeze` tuple; `tokens = {} as const` is the intended Phase-2 contract |
| `apps/web/svelte.config.js` | adapter-static + base + strict prerender + hash CSP | ✓ VERIFIED | Exact 7-host `connect-src`, `style-src-attr 'unsafe-inline'` is the only `unsafe` token, no `frame-ancestors`/`report-uri`/`sandbox`, no analytics host |
| `apps/web/src/lib/base-path.js` | Validated base/build-dir resolution | ✓ VERIFIED | Both exports; imported by `svelte.config.js` |
| `apps/web/src/app.html`, `static/frame-guard.js`, `static/.nojekyll` | CSP-safe shell + guard + Jekyll opt-out | ✓ VERIFIED | `<html lang="en" hidden>`, charset then `%sveltekit.head%`, one external `<script>`, no inline script/style/nonce; guard checks `window.self === window.top` |
| `scripts/build-web.mjs` | Windows-safe dual-base build | ✓ VERIFIED | `BASE_PATH`/`BUILD_DIR` injected from Node; drives `npm_execpath`; log shows `pnpm 11.27.0` |
| `scripts/assert-csp.mjs`, `scripts/assert-csp.test.ts` | Oracle + mutation tests | ✓ VERIFIED | 5 exports; 322-line suite; live mutations caught |
| `scripts/serve-pages.mjs` | Pages emulator, 3 listeners | ✓ VERIFIED | 301/404 semantics, traversal guard, ports 4273/4274/4275 env-overridable, loopback only, three contract iframe ids, no non-`node:` imports |
| `apps/web/playwright.config.ts` | Single webServer, attacker readiness probe | ✓ VERIFIED | one `webServer:`, `url: http://127.0.0.1:${ATTACKER}/`, `reuseExistingServer: false`, `sub` ignores `framing.spec`, System32 PATH guard |
| `apps/web/tests/e2e/{routing,csp,framing,a11y}.spec.ts` | Runtime proofs | ✓ VERIFIED | Present, no `page.goto('/…')`, 30/30 green |
| `scripts/{eslint-rules,real-data-rules,precommit}.test.ts` | Gate proofs | ✓ VERIFIED | 197 / 157 / 199 lines; no `lintFiles`, no `--no-verify`, no bypass var name, runtime-assembled values |
| `.github/workflows/ci.yml`, `.github/dependabot.yml`, `scripts/actionlint.mjs`, `scripts/workflow-gate.test.ts` | Gated CI + local linter + gate suite | ✓ VERIFIED | See SC4; `.github/` is Prettier-ignored so `if:` lines stay single-line |
| `docs/DEPLOY-CHECKLIST.md`, `README.md` | Owner runbook, contributor entry point | ✓ VERIFIED | Required strings present; neither mentions an AI assistant or tool |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `package.json` | `.git/hooks/pre-commit` | simple-git-hooks | ✓ WIRED | Hook file present; contains `SIMPLE_GIT_HOOKS_RC` guard and the exact command string |
| `.git/hooks/pre-commit` | `gitleaks.mjs` + `guard-real-data.mjs` | command string | ✓ WIRED | Live staged probe rejected by both |
| `vitest.config.ts` | per-project configs | `test.projects` | ✓ WIRED | 3 projects, all discovered (10 files) |
| each project config | `tooling/vitest/no-network.ts` | `setupFiles` | ✓ WIRED | `scripts/`, `packages/core/`, `apps/web/` all reference it; wiring tests pass |
| `svelte.config.js` | `base-path.js` | import | ✓ WIRED | line 2 import, used on lines 4-5 |
| `app.html` | `frame-guard.js` | `%sveltekit.assets%/frame-guard.js` | ✓ WIRED | Built pages load it; CSP spec proves it is not blocked (page reveals) |
| `build-web.mjs` | `apps/web/build*` | env from Node | ✓ WIRED | Both dirs regenerated during `verify` |
| `assert-csp.mjs` | both builds | `pnpm csp:assert` | ✓ WIRED | 7 + 7 pages passed |
| `assert-csp.test.ts` | `assert-csp.mjs` | import | ✓ WIRED | line 11 |
| `playwright.config.ts` | `serve-pages.mjs` | `webServer.command` | ✓ WIRED | Server started/stopped by the run; ports released afterwards (`ECONNREFUSED` ×3) |
| `routing.spec.ts` | builds | relative `page.goto` | ✓ WIRED | 5 gotos, all relative |
| `eslint-rules.test.ts` | `eslint.config.js` | `new ESLint({ cwd: repoRoot })` | ✓ WIRED | line 12 |
| `real-data-rules.test.ts` | `real-data-rules.mjs` | import | ✓ WIRED | line 14 |
| `precommit.test.ts` | hook scripts | temp-repo hook from `package.json` string | ✓ WIRED | Equivalence asserted in-test |
| `framing.spec.ts` | attacker listener | `E2E_PORT_ATTACKER` + iframe ids | ✓ WIRED | ids `plain`/`sandboxed`/`sandboxed-scripts` match `serve-pages.mjs` |
| `csp.spec.ts` | settings page | `csp-transition-toggle` | ✓ WIRED | testid present in `+page.svelte` |
| `ci.yml deploy` | `hygiene` + `quality` | `needs:` | ✓ WIRED | line 98 |
| `ci.yml` | `scripts/*.mjs` gates | `run:` steps | ✓ WIRED | canary, gitleaks git, guard, assert-csp all invoked |
| `DEPLOY-CHECKLIST.md` | `ci.yml` | `PAGES_ENABLED` | ✓ WIRED | Step 6 names the variable and both gated locations |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| FND-01 | 01-03, 01-05, 01-08, 01-09 | Load at `tranrealestate.github.io`, every route prerendered, deep-link refresh works, base path configurable via env | ✓ SATISFIED (local) / ? live host human | 7 prerendered pages under both bases, `BASE_PATH` env validated, routing E2E 8/8, CI matrix per base; live origin deferred |
| FND-02 | 01-03, 01-04, 01-07, 01-09 | Strict CSP meta on every page; `connect-src` limited to the named hosts | ✓ SATISFIED | Built policy matches the 7-token allowlist; oracle + runtime E2E; beacon host deferred to Phase 10 per CONTEXT (compliant) |
| FND-03 | 01-03, 01-04, 01-07, 01-09 | App refuses to render inside a third-party frame | ✓ SATISFIED | `<html hidden>` + `frame-guard.js`, framing E2E 4/4, oracle carriers |
| FND-04 | 01-01, 01-02, 01-06, 01-07, 01-08, 01-09 | Every push runs typecheck, lint, unit, E2E, a11y; deploys only when all pass | ✓ SATISFIED (workflow) / ? actual deploy human | `ci.yml` as described; actionlint clean; gate suite 20/20; `verify` composes the same steps locally |
| FND-05 | 01-01, 01-06, 01-08, 01-09 | Repo blocks committed secrets (push protection) and real listing / CoStar data (PII scan + path rules in CI) | ✓ SATISFIED (local + CI) / ? push protection human | Pre-commit hook + CI hygiene job proven; GitHub push protection is a deferred owner action |

Orphaned requirements: none. `REQUIREMENTS.md` maps exactly FND-01..FND-05 to Phase 1 and every ID appears in at least one plan's `requirements` field. All five are marked complete in REQUIREMENTS.md, consistent with this verification.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `apps/web/src/routes/(app)/{renter,investor,agent}/+page.svelte`, `(print)/print/+page.svelte`, `(app)/settings/+page.svelte` | 6 / 16 | "Placeholder …" copy | ℹ️ Info | Intended Phase 1 scope (CONTEXT: "placeholder routes only"); Phase 2 replaces the copy. The settings paragraph is a load-bearing E2E hook. No hard-coded empty data flows to rendering. |
| `packages/brand/src/index.ts` | 2 | `tokens = {}` | ℹ️ Info | Declared empty contract for Phase 2; nothing renders from it in Phase 1. |
| `.planning/phases/01-…/01-VALIDATION.md` | 88 | Manual row says "push a branch containing a canary pattern" | ℹ️ Info | `docs/DEPLOY-CHECKLIST.md` correctly says the `TRANCANARY_` pattern must NOT be used for the push-protection probe (GitHub recognises only its own/partner formats). The checklist is the owner-facing document and is right; the planning row is a stale wording only. |

No TODO/FIXME/HACK markers, no `return null`/empty-return stubs, no `console.log`-only handlers, no `{@html}` in source, no `[param]` routes, no hard-coded root `href="/…"` in routes, no canary literal, no analytics host in either policy file, no floating action tags. `git status --porcelain` is empty after the full run (no fixture leakage). `apps/web/src/lib/security/sanitize-html.svelte`, `__lintfix__`, and `apps/extension` do not exist, as required.

### Human Verification Required

All three items are the live-origin half of the phase goal. They are blocked on owner actions (create org `tranrealestate`, create repo named exactly `tranrealestate.github.io`, add remote, push, enable Pages, enable push protection, set `PAGES_ENABLED=true`) and are recorded as evidence to collect in `docs/DEPLOY-CHECKLIST.md` Step 7. They are not gaps: every behaviour is already proven locally against the Pages emulator under both base paths.

#### 1. Live origin routing and CSP

**Test:** Load `https://tranrealestate.github.io/`; navigate to `/renter/` and refresh; visit `https://tranrealestate.github.io/renter` (no slash); visit `/does-not-exist/`; view source on any page.
**Expected:** Landing page; deep-link refresh returns the page (no 404); no-slash URL redirects to `/renter/`; bogus path shows the branded 404; CSP meta is directly after `<meta charset>` with no `unsafe-inline`/`unsafe-eval` in `script-src`.
**Why human:** Requires the GitHub org, the root-site repo name, Pages enabled and a push. No remote exists (owner constraint).

#### 2. Gated Pages deploy actually runs

**Test:** After Steps 1-6 of the checklist, push to `main`, open the Actions tab, download the `github-pages` artifact.
**Expected:** `hygiene` and both `quality` legs pass, `deploy` runs only after them and publishes; `.nojekyll` is at the artifact root.
**Why human:** The deploy job is dormant behind `vars.PAGES_ENABLED == 'true'`; needs a live Actions run.

#### 3. Push protection rejects a token

**Test:** On a throwaway branch, commit a GitHub-recognised test token (a zero-permission, one-day fine-grained PAT that is revoked afterwards) with `SKIP_SIMPLE_GIT_HOOKS=1`, push the branch.
**Expected:** Push rejected by GitHub push protection; branch deleted, token revoked. Do not use the `TRANCANARY_` pattern (push protection does not recognise it).
**Why human:** Server-side GitHub feature; the local gitleaks half is proven, the remote half cannot be exercised without a remote.

### Gaps Summary

No gaps. Every locally verifiable must-have across all nine plans exists, is substantive, and is wired; the composed gate is green in one command; the CSP oracle and the commit gates were each shown to reject bad input in this session, not just to pass good input. The only unverified items are the three live-origin behaviours that depend on hosting actions the owner has explicitly deferred, and they are documented with exact steps in `docs/DEPLOY-CHECKLIST.md`. Phase 2 can start from this baseline.

---

_Verified: 2026-09-22T19:23:02Z_
_Verifier: gsd-verifier_
