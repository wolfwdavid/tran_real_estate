# Phase 12: Go-live Readiness & Local Smoke Suite - Research

**Researched:** 2026-10-29
**Domain:** git history rewrite before first push, build stamping, site-origin plumbing, deploy-checklist correction, and a read-only Playwright smoke suite against a local GitHub Pages emulator
**Confidence:** HIGH (every repo fact below was checked against the working tree today; the history rewrite and the gitleaks scan were dry-run on a scratch clone; the no-cors beacon behaviour and the Umami host were probed live)

<user_constraints>
## User Constraints

No `12-CONTEXT.md` exists (no `/gsd:discuss-phase` was run). The constraints below come from the ROADMAP success criteria (the orchestrator says to treat them as locked) and from the project's `CLAUDE.md`.

### Locked Decisions (ROADMAP Phase 12 success criteria, verbatim)
1. `git log` over the whole history shows zero AI co-author trailers and zero assistant mentions in commit messages (the 145 trailered 2026-10-13..14 commits rewritten, hashes quoted in `MILESTONES.md` and SUMMARY files remapped by subject), the `.gitleaks.toml` allowlist is re-derived for the rewritten commits, and the CI history scan (`secrets:scan` + `secrets:canary`) is green on the rewritten history.
2. `pnpm smoke:local` runs the read-only smoke suite green against `scripts/serve-pages.mjs` for all three local builds (root, sub-path, configured) in under five minutes with zero retries and `--fail-on-flaky-tests`, reading the build stamp from the build directory; the suite refuses to start when `SMOKE_BASE_URL` is unset or non-`https://` (loopback only with `SMOKE_ALLOW_HTTP=1`), and a network monitor shows it never submits a form, enters a key, or calls RentCast or an LLM host.
3. The suite asserts the whole live contract (landing 200 with brand title, trailing-slash redirect, deep-route refresh, HTTP 404 branded page, CSP meta first in `<head>` with the exact `connect-src` via the shared `assert-csp` oracle, every hashed asset 200, `sitemap.xml` URL count, `robots.txt` `Sitemap:` line, `manifest.webmanifest` 200, OG/Twitter absolute URLs on the audited origin with exactly one `og:image` returning `image/png`, zero third-party requests, same-origin service worker precaching only same-origin GETs, the `/legal/privacy/#browser-extension` anchor, build stamp equal to `SMOKE_EXPECT_VERSION` after polling up to ten minutes); exactly one GPC-off analytics spec lets one page-view beacon through and asserts the configured analytics host answers JSON 200, every other spec injects GPC; axe reports zero violations on `/`, one portal landing and `/legal/privacy/` against the built bundle.
4. Every build serves `/_app/version.json` whose version equals the commit SHA (`kit.version.name` from `GITHUB_SHA`), and changing `PUBLIC_SITE_URL` alone changes canonical URLs, the sitemap, OG absolute URLs and the extension's `TRAN_ORIGIN` / `PRIVACY_URL`, proven by a test rather than a code hunt.
5. `docs/DEPLOY-CHECKLIST.md` reads in the strict go-live order (empty public repo named exactly `tranrealestate.github.io`, never a README; Pages source = GitHub Actions before `PAGES_ENABLED`; push `main` with the variable unset; first CI green; then `PAGES_ENABLED=true` plus an empty commit), names the Umami collect host `gateway.umami.is` with the `curl` verification, places the Search Console meta tag after `%sveltekit.head%` in `app.html` with the slot pinned by a test, and carries the fresh-profile (InPrivate) rule on every post-redeploy check.

**Owner gate (closes the phase, not agent work):** create the free `tranrealestate` org and the empty public repo, Pages source = GitHub Actions, secret scanning + push protection + Dependabot on, `git remote add`, push `main` with `PAGES_ENABLED` unset. No agent ever adds a remote or pushes.

### Project rules that bind every plan (CLAUDE.md, tasks/lessons.md)
- **Commit messages never mention AI assistants and never carry a `Co-Authored-By` model trailer.** Every executor prompt must say so explicitly (lesson 2026-10-25: parallel executors add one unless forbidden). This phase is the one that cleans history, so a new trailer after the rewrite is a regression the guard must catch.
- Literal duplicate + parity test for cross-package constants; no shared runtime package between `apps/web` and `apps/extension`.
- Every workflow change is a two-file commit (workflow + its gate test).
- No blind timeout raises; `expect.poll` for anything set by an intercepted request; cap any single tool call at 7 minutes.
- Only one executor may own `pnpm build:*` / Playwright at a time (shared build dirs and `.svelte-kit/output`).

### Claude's Discretion (no CONTEXT.md, so these are research recommendations)
- Smoke suite file layout, env-variable names beyond `SMOKE_BASE_URL` / `SMOKE_EXPECT_VERSION` / `SMOKE_ALLOW_HTTP`, and how `smoke:local` orchestrates three builds.
- How LIVE-08's "proven by a test" is structured.
- Whether `smoke:local` joins `pnpm verify`.
- How the local emulator satisfies "analytics host answers JSON 200".

### Deferred Ideas (OUT OF SCOPE for Phase 12)
- `live-smoke.yml`, `workflow_run` wiring and its gate test (SMOKE-04, Phase 13).
- First CI run, `PAGES_ENABLED=true`, GTM-01..04 live proof, HUMAN-UAT burn-down, `LAUNCH-AUDIT.md` regeneration at the deployed commit (Phase 13).
- `serve-pages.mjs` dotfile 404 fidelity, origin-parity test item 5.4 (Phase 14; see the overlap note under LIVE-08).
- Kit 3 / Vitest 5 / pnpm 12 (Phase 16), extension release (Phase 17).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIVE-01 | History has no AI trailers or assistant mentions (145 commits rewritten), gitleaks SHA allowlist re-derived, CI history scan passes on rewritten history | Exact counts and grep patterns, `git filter-repo` installed and dry-run proven (233 commits change, 978 unchanged), allowlisted SHAs proven unchanged and load-bearing, `commit-map` remap procedure, guard test (sections "History rewrite" and Pitfalls 1-3) |
| LIVE-04 | Every build carries `kit.version.name` = commit SHA served at `/_app/version.json` | Kit 2.70.3 `version.name` contract read from the installed types; resolver + fallback design; SW cache key becomes `tran-shell-<sha>` (Pattern 2) |
| LIVE-05 | DEPLOY-CHECKLIST corrected (order, repo name, `gateway.umami.is`, meta tag after `%sveltekit.head%`, fresh-profile rule) | Current checklist read line by line; Umami host re-probed live today; no test pins `app.html` today; step-number cross-references located (Pattern 6) |
| LIVE-08 | `PUBLIC_SITE_URL` honoured end to end incl. extension `TRAN_ORIGIN`/`PRIVACY_URL` | Web half proven today with a probe build (zero default-origin strings, `seo:assert` green on the probe origin); extension half is a hard-coded literal and `assert-extension.mjs` allowlists the literal (Pattern 3) |
| SMOKE-01 | Read-only, fail-closed, zero retries, `--fail-on-flaky-tests`, < 5 min, never submits/enters keys/calls providers | Playwright 1.63.0 supports `failOnFlakyTests` (config) and `--fail-on-flaky-tests` (CLI); env-gate module design; network monitor + static read-only guard (Pattern 4) |
| SMOKE-02 | Full live contract asserted | Each assertion mapped to an existing E2E oracle or exported function (`checkHtml`, `ROUTES`, `MARKETING_ROUTES`+`LEGAL_ROUTES` = 14 sitemap URLs) (Pattern 5 table) |
| SMOKE-03 | Green against `serve-pages.mjs` for root, sub, configured with stamp read from build dir | Emulator contract read; ports and baked analytics host constraint; measured ~50 s per build for an equivalent E2E subset at 4 workers (Pattern 4, "smoke:local orchestration") |
| SMOKE-05 | One GPC-off spec: exactly one beacon, configured host answers JSON 200; others inject GPC | Probed today: a `no-cors` beacon's response is opaque to `waitForResponse` (no headers, no body) but `route.fetch()` passthrough yields status + JSON with exactly one request reaching the host; emulator collector must return JSON (Pattern 5) |
| SMOKE-06 | axe zero violations on `/`, one portal landing, `/legal/privacy/` | `@axe-core/playwright` 4.13.0 installed; reuse `WCAG_TAGS` and the `passes.length > 0` non-vacuity from `a11y.spec.ts` |
</phase_requirements>

## Summary

Phase 12 is four independent pre-push corrections plus one new test harness. None needs a new dependency: `git filter-repo` is already installed (`C:\Users\Mkaru\AppData\Local\Programs\Python\Python313\Scripts\git-filter-repo.exe`), gitleaks is 8.30.1 (the CI pin), Playwright is 1.63.0 with `@axe-core/playwright` 4.13.0, and every oracle the smoke needs already exists as an importable function or constant.

The history rewrite is much smaller and safer than the milestone research implied. Exactly **145** commits carry `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (2026-10-13 10:57 `7f14834` .. 2026-10-14 `38512f8`); there are **zero** other assistant mentions (the "168 mentions" figure counted provider product names like "Anthropic streaming adapter" and "Gemini dialog", which are product content and stay). A message-only `git filter-repo --message-callback` that touches only trailered messages rewrites exactly **233** commits (the trailered range and its descendants) and leaves the first **978** commits byte-identical, so the two gitleaks-allowlisted SHAs (`4e453c1`, `05793bf`, both 2026-10-06) **do not change**. On the scratch clone the rewritten history scanned green with the unmodified `.gitleaks.toml`, the canary still fired, the HEAD tree hash was identical, and the annotated tag `v1.0` was carried through. The remap of quoted hashes is mechanical: filter-repo writes `.git/filter-repo/commit-map` (old -> new), and 371 references to 153 rewritten commits sit in 43 tracked files.

Two findings change the plan. First, **`pnpm test:unit` is red today**: `scripts/launch-audit.test.ts` (11 tests) parses `.planning/research/PITFALLS.md`, which the v1.1 research overwrote; the v1.0 copy now lives at `.planning/milestones/v1.0-research/PITFALLS.md`. The first CI run would fail on it, so it must be fixed in this phase. Second, a `no-cors` beacon's response is opaque to Playwright's `waitForResponse` (status is visible, content-type and body are not), so "answers JSON 200" must be measured with `page.route()` + `route.fetch()` passthrough, which was proven today to reach the host exactly once and expose status, content-type and the JSON body. The local collector in `serve-pages.mjs` currently answers an empty 200 and must answer JSON.

**Primary recommendation:** do the history rewrite first, as its own solo plan with a bundle backup, then land a commit-hygiene guard so no later Phase 12 commit can reintroduce a trailer; fix the launch-audit path; then build stamp, site-origin plumbing and the checklist in parallel; then the smoke suite as `apps/web/playwright.smoke.config.ts` + `apps/web/tests/smoke/*.smoke.ts` + `scripts/smoke.mjs`, re-pointing existing E2E oracles at a URL.

## Standard Stack

### Core (all already installed, verified today)
| Tool | Version | Purpose | Why standard |
|------|---------|---------|--------------|
| git-filter-repo | `a40bce548d2c` (pip, Python 3.13 Scripts) | Message-only history rewrite | Officially recommended by git over `filter-branch`; writes `commit-map` / `ref-map`; rewrites annotated tags; auto-updates hash references in messages |
| git | 2.53.0.windows.1 | | |
| gitleaks | 8.30.1 (WinGet link) | `secrets:scan`, `secrets:canary` oracle | Same pin and checksum as `ci.yml` |
| @playwright/test / playwright | 1.63.0 (apps/web) | Smoke runner | Already the E2E runner; `failOnFlakyTests` config + `--fail-on-flaky-tests` CLI both present in 1.63.0 |
| @axe-core/playwright | 4.13.0 | SMOKE-06 | Already used in `a11y.spec.ts` with the WCAG tag set |
| @sveltejs/kit | 2.70.3 | `kit.version.name` | Installed types document "must be deterministic (e.g. a commit ref)", default = build timestamp |
| Node | 24 (`.nvmrc`), pnpm 11.27.0 via corepack | | |

### Supporting (in-repo modules the smoke must reuse, never copy)
| Module | Export | Use |
|--------|--------|-----|
| `scripts/assert-csp.mjs` | `checkHtml(relPath, html, { analyticsHost })`, `CONNECT` | CSP meta first + exact `connect-src` on served HTML; `CONNECT` minus `'self'` is the provider deny-list for the network monitor (no third copy of the host list) |
| `apps/web/tests/e2e/routes.ts` | `ROUTES`, `MARKETING_ROUTES`, `LEGAL_ROUTES`, `NOT_FOUND`, `PORTAL_ROUTES` | Route walk; expected sitemap count = `MARKETING_ROUTES.length + LEGAL_ROUTES.length` = 14 (matches today's build) |
| `scripts/lib/build-targets.mjs` | `targetEnv(name)`, `TARGETS` | Per-build env for `smoke:local` |
| `apps/web/src/lib/site-config.js` | `resolveSiteOrigin`, `resolveAnalytics`, `DEFAULT_SITE_ORIGIN` | Expected site URL and analytics host per build |
| `apps/web/src/lib/base-path.js` | `resolveBasePath` | Expected base path |
| `scripts/serve-pages.mjs` | (process) | Local Pages emulator: 301 for slashless dirs, 404.html with 404, root 4273, sub 4274 at `/tran_real_estate`, configured 4276, attacker/collector 4275 |

### Alternatives Considered
| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| `git filter-repo --message-callback` | `git filter-branch --msg-filter 'grep -v "^Co-Authored-By:"'` (lessons.md 2026-10-25) | Works, but slower, deprecated by git, leaves `refs/original/`, no commit-map (remap must be by subject only), and `grep -v` also drops non-AI co-author lines. Use filter-repo; it is installed. |
| `git rebase` | | Not acceptable for 233 commits (orchestrator rule); also re-applies trees and can rewrite authorship dates |
| Reading the beacon response with `page.waitForResponse` | `page.route` + `route.fetch()` + `route.fulfill({ response })` | Verified today: `waitForResponse` on a `no-cors` fetch gives `status()` = 200 but `content-type` undefined (even via `allHeaders()`) and `response.json()` throws. `route.fetch()` gives status, content-type and JSON, and the host still sees exactly one request. |
| Lighthouse CI, cheerio/jsdom, open-graph-scraper | | Rejected in milestone research (no new deps; regex oracles already exist) |

**Installation:** none. If `git filter-repo` were missing: `py -3.13 -m pip install git-filter-repo` (it is a single Python script).

## History Rewrite (LIVE-01)

### Verified facts (2026-10-29, working tree at `5b8d633`)
| Fact | Command | Result |
|------|---------|--------|
| Remote | `git remote -v` | none |
| Refs | `git for-each-ref` | `refs/heads/main`, `refs/tags/v1.0` (annotated, message has no AI mention) only; no stash, no notes, no replace refs, single worktree |
| Total commits | `git rev-list --count HEAD` | 1211 (no merges, none signed: `%G?` = N for all) |
| Authors | | all `David White Wolf <cdw8481@nyu.edu>` (author and committer) |
| Trailered commits | `git log --all --format='%(trailers:key=Co-Authored-By,valueonly)' \| grep -ciE 'anthropic\|claude'` | **145** |
| Attribution commits, broad net | `git log --all -i -E --grep='co-authored-by:.*(claude\|anthropic)\|noreply@anthropic\.com\|generated with \[?claude\|claude code\|🤖' --format=%H \| wc -l` | **145** (same set) |
| "claude" outside trailer lines | `git log --all --format=%B \| grep -v -i '^co-authored-by:' \| grep -ci claude` | **0** |
| Other AI words | subject/body grep for `anthropic\|gemini\|openai\|llm\|gpt` excluding trailers | 36 lines in 28 commits, all product content (provider adapters, `LlmError`, `CallMeter`, "Gemini dialog"); keep them |
| First trailered commit | | `7f14834` 2026-10-13 10:57 "test(09-24): add failing tests for exits inside the recheck window" |
| Last trailered commit | | `38512f8` 2026-10-14 "docs(10): owner records UAT results in 10-HUMAN-UAT.md, ..." |
| Commits whose SHA changes | `git rev-list --count 7f14834^..HEAD` | **233** (plus every commit made after this research) |
| Allowlisted commits | `4e453c1` (2026-10-06, feat(08-01)), `05793bf` (2026-10-06, docs(08-06)) | both ancestors of `7f14834`: **SHAs unchanged by the rewrite** |

### Dry run on a scratch clone (`git clone --no-local`)
- Callback that only touches trailered messages: 233 commits changed, 978 unchanged, `first-changed-commits` = `7f14834 -> 7f14834`, `ref-map` rewrote `refs/heads/main` and `refs/tags/v1.0`.
- A first attempt that normalised every message (`rstrip` + `\n`) changed **593** commits, because older messages end in `\n\n`. The callback must return the message untouched unless it contains the trailer.
- After rewrite: trailer count 0, broad-net count 0, HEAD tree hash identical (`a3a9ead…`), `v1.0` still an annotated tag, `node scripts/gitleaks.mjs history` → "1210 commits scanned … no leaks found" (exit 0), `node scripts/gitleaks-canary.mjs` → detected (exit 0). Whole rewrite took ~1.5 s.
- The allowlist is load-bearing and redundant: with no allowlist at all gitleaks reports exactly 2 `generic-api-key` findings (`05793bf` `.planning/phases/08-…/deferred-items.md:5`, `4e453c1` `packages/core/src/agent/schemas.test.ts:73`); with only `commits` or only `paths` it reports 0.
- `suboptimal-issues` mentions `b'20261004'` (a date string filter-repo mistook for a short hash). Harmless; no message contains a real stale hash afterwards (verified).

### The callback (verified)
```python
# --message-callback body (filter-repo passes `message` as bytes)
import re
pat = re.compile(rb'(?im)^co-authored-by:[^\n]*(?:anthropic|claude)[^\n]*(?:\n|$)')
if not pat.search(message):
    return message
return pat.sub(b'', message).rstrip(b'\n') + b'\n'
```

### Procedure (in place, so `node_modules`, builds and ignored files survive)
1. Preconditions: clean worktree, no other session or executor running in the repo (user feedback memory: check for concurrent sessions first; rewriting under a live agent invalidates its SHAs).
2. Backup outside the repo: `git bundle create ../tran_real_estate-pre-rewrite-2026-10-29.bundle --all` then `git bundle verify` on it. filter-repo expires reflogs and gcs immediately, so the bundle is the only undo.
3. `git filter-repo --force --message-callback "$(cat <callback file>)"` (`--force` because an in-place repo is not a fresh clone).
4. Copy `.git/filter-repo/commit-map` and `ref-map` outside `.git` (a second filter-repo run overwrites them).
5. Assert: trailer count 0, broad-net count 0, `git rev-list --count HEAD` unchanged, `git rev-parse HEAD^{tree}` unchanged, `git cat-file -t v1.0` = `tag`, `git rev-parse 4e453c1bbceefe392ad720eaa049bbd1dae8cc43^{commit}` and `05793bfa1b15bc5d55d0650cea17e8f17707a27e^{commit}` resolve and are ancestors of `main`, `pnpm secrets:scan` and `pnpm secrets:canary` exit 0, `git remote -v` empty.
6. Re-derive the allowlist: re-run gitleaks with the allowlist removed and record that the only two findings are in exactly those two SHAs (by subject). Keep `commits` + `paths` (both still valid); add a comment line recording the re-derivation date and method. Optionally add a planted check as a test (see Validation).
7. Remap quoted hashes with a one-off script driven by `commit-map` (not by guessing): for each `[0-9a-f]{7,40}` token in tracked text files that is a unique prefix of an **old changed** SHA, replace it with the new SHA truncated to the same length (lengthen if that prefix is ambiguous among new SHAs); then verify each replaced pair by subject (`git log -1 --format=%s <new>` equals the old subject read from the bundle or from `commit-map` + saved `git log` output). This satisfies "remapped by subject" with an exact oracle. 40-hex action pins in `.planning/` are not local commits and are never touched by the prefix rule.
8. Commit the remap (new commit on top, plain message, no trailer).
9. Rebuild before any smoke run: every `apps/web/build*/_app/version.json` is stamped with a pre-rewrite SHA.

### Files quoting rewritten hashes (371 refs, 153 distinct commits, 43 files)
`.planning/phases/10-launch-hardening-go-to-market/*-SUMMARY.md` (22 files, plus `deferred-items.md`, `10-VERIFICATION.md`), `.planning/phases/11-*/*-SUMMARY.md` (12 files, plus `11-VALIDATION.md`), `.planning/phases/09-*/09-24-SUMMARY.md`, `09-25-SUMMARY.md`, `.planning/MILESTONES.md` (`a60413c`; `213f4b6` predates the rewrite and stays valid), `.planning/research/PITFALLS.md` (1), `docs/LAUNCH-AUDIT.md` (`Commit: aaf00d9`). Phase 1-8 SUMMARY hashes are all pre-rewrite and stay valid. `docs/LAUNCH-AUDIT.md` says "Generated, do not edit by hand"; a mechanical commit-map substitution of the header hash keeps it resolvable until Phase 13 regenerates it (LIVE-07). Recommend: remap it mechanically and say so in the SUMMARY.

### Ordering decision: rewrite FIRST
Every commit after `7f14834`, including this research commit and every Phase 12 commit, gets a new SHA. Rewriting last would force a second remap of Phase 12's own SUMMARY files. Rewriting first means every later SUMMARY quotes final hashes. The risk of rewriting first (an executor adds a new trailer later) is closed by the guard below and by a final count check at phase end. The rewrite plan runs **alone in its wave**.

### Keep it from recurring
`scripts/commit-hygiene.mjs` (pure function over messages + CLI over `git log --format=%B%x00`) with `scripts/commit-hygiene.test.ts` (planted trailered message fails, product mentions like "Anthropic streaming adapter" pass), and a hygiene-job step `run: node scripts/commit-hygiene.mjs` (the hygiene job already has `fetch-depth: 0`). That is a `run:` step, so the 7 pinned `uses:` lines do not move; add one assertion to `scripts/workflow-gate.test.ts` in the same commit. If the planner prefers not to touch `ci.yml` in Phase 12, the unit test alone still guards local history on every `pnpm test:unit`.

## Architecture Patterns

### Recommended Project Structure (additions only)
```
apps/web/
├── playwright.smoke.config.ts      # testDir tests/smoke, testMatch /\.smoke\.ts$/, no webServer,
│                                   # retries 0, failOnFlakyTests true, throws via parseSmokeEnv()
├── src/lib/build-stamp.js          # resolveBuildStamp(env, readHead): GITHUB_SHA or git HEAD, 40-hex
└── tests/smoke/
    ├── env.ts                      # parseSmokeEnv(env) -> {baseUrl, siteUrl, expectVersion, analyticsHost} | throws
    ├── fixtures.ts                 # `test` (GPC on + network monitor + provider deny) and `testGpcOff`
    ├── routing.smoke.ts            # landing 200 + brand title, 301 slashless, deep-route refresh, 404 branded
    ├── csp.smoke.ts                # checkHtml() over every ROUTE's served HTML + 404 page
    ├── assets.smoke.ts             # SW precache list -> every _app/immutable URL 200
    ├── pwa.smoke.ts                # SW same-origin scope, precache only same-origin under base, tran-shell-<version>, manifest 200
    ├── seo.smoke.ts                # sitemap count/locs, robots Sitemap:, OG/Twitter absolute on site URL, one og:image -> image/png
    ├── third-party.smoke.ts        # every ROUTE: zero cross-origin requests (GPC on)
    ├── version.smoke.ts            # /_app/version.json == SMOKE_EXPECT_VERSION
    ├── extension-link.smoke.ts     # legal/privacy/ has #browser-extension
    ├── a11y.smoke.ts               # axe on '', 'renter/', 'legal/privacy/'
    └── analytics.smoke.ts          # the ONLY testGpcOff user
scripts/
├── smoke.mjs                       # --local (three builds via serve-pages) | remote (SMOKE_BASE_URL); version poll
├── smoke-env.test.ts               # parseSmokeEnv planted cases (scripts project) -- or co-locate under apps/web
├── smoke-readonly.test.ts          # static guard over tests/smoke/*.ts (no fill/type/press/check/submit/POST/seed imports; exactly one testGpcOff importer)
├── commit-hygiene.mjs + .test.ts   # LIVE-01 recurrence guard
├── site-url.test.ts                # LIVE-08 proof (see Pattern 3)
└── app-html.test.ts                # Search Console slot pin (LIVE-05)
```

### Pattern 1: Smoke = existing E2E oracles re-pointed at a URL
**What:** every smoke assertion is an existing E2E or build-time oracle with the origin parameterised: `routing.spec.ts`, `seo.spec.ts`, `pwa.spec.ts`, `third-party.spec.ts`, `analytics.configured.spec.ts`, `a11y.spec.ts`, and `checkHtml()` from `assert-csp.mjs`. No new policy literals; import `ROUTES` from `../e2e/routes` and `checkHtml` / `CONNECT` from `../../../../scripts/assert-csp.mjs` (the same relative-import style `tests/e2e/site-env.ts` already uses for `build-targets.mjs`).
**Base vs site URL:** locally the served origin (`http://127.0.0.1:4273/`) differs from the build's site URL (`https://tranrealestate.github.io/`), and canonical/OG/sitemap/robots carry the site URL. Use two variables: `SMOKE_BASE_URL` (where to fetch) and `SMOKE_SITE_URL` (what absolute URLs must say; defaults to `SMOKE_BASE_URL`, which is the live case). When they differ, map absolute asset URLs onto the base by path (exactly what `seo.spec.ts` "og:image of the landing resolves" does today).

### Pattern 2: Build stamp from the commit (LIVE-04)
```js
// apps/web/src/lib/build-stamp.js (plain JS like site-config.js; no node: imports here)
const SHA = /^[0-9a-f]{40}$/;
/** @param {Record<string,string|undefined>} env @param {() => string} readHead */
export function resolveBuildStamp(env, readHead) {
	const v = env.GITHUB_SHA || readHead();
	if (!SHA.test(v)) throw new Error(`build stamp must be a 40-hex commit SHA (got ${JSON.stringify(v)})`);
	return v;
}
```
```js
// apps/web/svelte.config.js (add)
import { spawnSync } from 'node:child_process';
import { resolveBuildStamp } from './src/lib/build-stamp.js';
const head = () => (spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout ?? '').trim();
// kit: { ..., version: { name: resolveBuildStamp(process.env, head) } }
```
- Kit writes `{"version":"<name>"}` to `<build>/_app/version.json` (today: a timestamp, e.g. `1792988474126`). `$service-worker`'s `version` follows, so the cache key becomes `tran-shell-<sha>`, which the smoke can assert via `caches.keys()`.
- `svelte.config.js` is also imported by `scripts/service-worker-guard.test.ts` and loaded by `svelte-kit sync` (`prepare`), `svelte-check` and vite-plugin-svelte; the git spawn is cheap and CI checkouts always have `HEAD`. In CI, `GITHUB_SHA` wins (for `pull_request` it is the merge commit, which is what was built).
- Two builds at the same HEAD with a dirty tree share a stamp. Accept it: the smoke's local check is "build dir stamp == `git rev-parse HEAD`", which catches stale builds (the common failure), and every deploy is a distinct commit.
- Inline-script CSP hashes change with the version string; Kit computes them per build and `checkHtml` recomputes them, so nothing pins them.

### Pattern 3: `PUBLIC_SITE_URL` end to end (LIVE-08)
**Web half is already correct (verified today):** a probe build with `PUBLIC_SITE_URL=https://probe-origin.example BUILD_DIR=build-probe` (18.5 s) contained the probe origin in 17 files and the default origin in **zero**; `robots.txt` read `Sitemap: https://probe-origin.example/sitemap.xml`; `sitemap.xml` had 14 `<loc>`; `PUBLIC_SITE_URL=https://probe-origin.example node scripts/assert-seo.mjs apps/web/build-probe --target root` passed. Consumers: `vite.config.ts` `__SITE_URL__` define → `$lib/site` → `SeoHead.svelte` (canonical, `og:url`, `og:image`), `ToolPage.svelte` (JSON-LD), `sitemap.xml/+server.ts`, `robots.txt/+server.ts`, `analytics/boot.ts`; `svelte.config.js` `prerender.origin`.

**Gaps (all extension-side):**
1. `apps/extension/src/lib/config.ts:3` hard-codes `TRAN_ORIGIN = 'https://tranrealestate.github.io'`; `PRIVACY_URL` derives from it; `PopupFooter.svelte` renders it.
2. `scripts/assert-extension.mjs:89` allowlists the literal `'https://tranrealestate.github.io/'` in `URL_ALLOWLIST`; with a different origin the zero-network oracle would reject the new URL.
3. `ci.yml` "Extension build + manifest/zero-network oracle" step and `extension-release.yml` zip/assert steps get no `PUBLIC_SITE_URL`.

**Recommended shape (mirrors the web app's `__SITE_URL__` precedent):**
- Move `TRAN_ORIGIN` / `PRIVACY_URL` into their own module (e.g. `apps/extension/src/lib/site.ts`) so the many tests that import `config.ts` for `CONFIG`/`PILL_TAG` are untouched; `export const TRAN_ORIGIN: string = __TRAN_ORIGIN__;`.
- `wxt.config.ts` (Node-side build config, never bundled) imports `resolveSiteOrigin` from `../web/src/lib/site-config.js` and adds `define: { __TRAN_ORIGIN__: JSON.stringify(resolveSiteOrigin()) }` to its `vite()` block; the same define goes in `apps/extension/vitest.browser.config.ts` (popup browser test imports `PRIVACY_URL`) and in any other config whose tests import the module. Add `__TRAN_ORIGIN__` to the eslint globals block. This is a build-time read of a plain-JS validator, not a runtime import of web code, so Anti-Pattern 3 (web code in the extension bundle) does not apply; confirm with `pnpm ext:build && pnpm ext:assert` and a grep that the bundle has no `site-config` code.
- `assert-extension.mjs`: build `URL_ALLOWLIST`'s site entry from `resolveSiteOrigin(process.env) + '/'`; update `scripts/assert-extension.test.ts` literals (lines 74, 185, 396, 412) to derive from the same function or from `DEFAULT_SITE_ORIGIN`.
- Give the `configured` build target a test site origin (it already "carries a test value for every owner setting"): e.g. `PUBLIC_SITE_URL: 'https://tran-configured.example'` placed **after** any owner value so CI's `vars.PUBLIC_SITE_URL` cannot override it. Then every CI run and every `smoke:local` proves canonical/sitemap/OG/robots honour the variable via the existing `seo:assert --target configured`. Update `scripts/build-targets.test.ts` (lines 70-114) in the same commit. Verified: no configured E2E spec depends on the default origin.
- `scripts/site-url.test.ts`: (a) static sweep: in shipped source (`apps/web/src`, `apps/web/static`, `apps/extension/src`, `apps/extension/public`, `packages/*/src`, excluding `*.test.ts`) the literal `tranrealestate.github.io` occurs only in `site-config.js` `DEFAULT_SITE_ORIGIN` (comments allowed or not, planner's call), with a planted-literal non-vacuity case; (b) derivation: with `{ PUBLIC_SITE_URL: 'https://probe.example' }` the shared define helper(s) yield the probe origin for both `__SITE_URL__` and `__TRAN_ORIGIN__`, and `PRIVACY_URL` would be `https://probe.example/legal/privacy/#browser-extension`; (c) the configured target's `PUBLIC_SITE_URL` differs from `DEFAULT_SITE_ORIGIN`. Extracting `siteDefines(env)` into `site-config.js` and calling it from both `vite.config.ts` and `wxt.config.ts` gives one tested function.
- Workflow env: add `PUBLIC_SITE_URL: ${{ vars.PUBLIC_SITE_URL }}` to the ci.yml extension build step (and to the `extension-release.yml` zip + assert steps). `workflow-gate.test.ts:152-163` pins `quality` env blocks at exactly 4 and requires every block to carry all owner keys; this must be a two-file commit that teaches the test about the fifth, site-URL-only block. `extension-release-gate.test.ts` pins run-line order and counts only, so adding `env:` there is compatible.
- **Overlap with Phase 14 item 5.4 (origin-parity test):** once `TRAN_ORIGIN` comes from the same resolver, "TRAN_ORIGIN === DEFAULT_SITE_ORIGIN" becomes "both resolve from one function", and the edge-listing / install-guide literal checks remain Phase 14 work. Record this in the SUMMARY so Phase 14 does not duplicate it.

### Pattern 4: Fail-closed smoke config and the network monitor (SMOKE-01)
```ts
// apps/web/tests/smoke/env.ts  (pure; unit-tested with planted cases)
const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\//;
export function parseSmokeEnv(env: Record<string, string | undefined>) {
	const base = env.SMOKE_BASE_URL;
	if (!base) throw new Error('SMOKE_BASE_URL is required (absolute URL ending in /)');
	const u = new URL(base); // throws on garbage
	if (!base.endsWith('/')) throw new Error('SMOKE_BASE_URL must end with /');
	const httpOk = env.SMOKE_ALLOW_HTTP === '1' && LOOPBACK.test(base);
	if (u.protocol !== 'https:' && !httpOk)
		throw new Error('SMOKE_BASE_URL must be https:// (http only for loopback with SMOKE_ALLOW_HTTP=1)');
	const expectVersion = env.SMOKE_EXPECT_VERSION ?? '';
	if (!/^[0-9a-f]{40}$/.test(expectVersion)) throw new Error('SMOKE_EXPECT_VERSION must be the 40-hex build SHA');
	return {
		baseUrl: base,
		siteUrl: env.SMOKE_SITE_URL || base,
		expectVersion,
		analyticsHost: env.SMOKE_ANALYTICS_HOST ?? ''
	};
}
```
```ts
// apps/web/playwright.smoke.config.ts
import { defineConfig, devices } from '@playwright/test';
import { parseSmokeEnv } from './tests/smoke/env';
// (copy the Windows System32 PATH block from playwright.config.ts; Phase 15 will guard every config for it)
const smoke = parseSmokeEnv(process.env); // throws at config load: nothing runs, not even --list
export default defineConfig({
	testDir: 'tests/smoke',
	testMatch: /\.smoke\.ts$/,
	retries: 0,
	failOnFlakyTests: true,
	forbidOnly: true,
	fullyParallel: true,
	workers: process.env.CI ? 2 : 4,
	globalTimeout: 300_000,
	reporter: process.env.CI ? [['github'], ['list']] : 'list',
	use: { ...devices['Desktop Chrome'], baseURL: smoke.baseUrl, trace: 'retain-on-failure', reducedMotion: 'reduce' }
});
```
- `SMOKE_EXPECT_VERSION` required (recommended, not mandated by the criteria): it makes "which build did we test" unforgeable; `scripts/smoke.mjs` fills it (local: from the build dir; remote: flag or env).
- Pass `--fail-on-flaky-tests` on the command line too (criterion wording); with `retries: 0` nothing can be "flaky", so it is belt and braces.
- **Network monitor** (auto fixture in `fixtures.ts`, applied to every test): `context.on('request')` records `{method, url, resourceType}`; `context.route()` aborts any request to a host in `CONNECT` minus `'self'` (RentCast, Anthropic, OpenAI, Gemini, OpenRouter, Web3Forms) and records it. Teardown asserts: zero provider-host requests, zero non-GET/HEAD requests except the single analytics beacon in `analytics.smoke.ts`, zero requests carrying `x-api-key` / `authorization` / `x-goog-api-key` headers. Pair with `scripts/smoke-readonly.test.ts`, a static scan of `tests/smoke/**/*.ts` that fails on `.fill(`, `.type(`, `.press(`, `.check(`, `.selectOption(`, `.setInputFiles(`, `.click(` on submit buttons (simplest: ban `.click(` outright except an allowlisted nav link if one is needed), `request.post`, `method: 'POST'`, and imports from `tests/e2e/support/seed`, `tests/support/fake-keys`, `rentcast-mocks`; plus "exactly one file imports `testGpcOff`". Planted-case non-vacuity for each rule.
- **GPC by default:** `test.use({ extraHTTPHeaders: { 'Sec-GPC': '1' } })` and an auto fixture `context.addInitScript(() => Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true }))` (the exact form `analytics.configured.spec.ts` "GPC suppresses" uses). The app's consent check reads `navigator.globalPrivacyControl` (`lib/analytics/consent.ts:15`); the header is extra signal. Verified today that `extraHTTPHeaders` rides on a `no-cors` cross-origin fetch without breaking it.

### Pattern 5: Assertion map (SMOKE-02/05/06)
| Contract | Implementation (reuse) |
|----------|------------------------|
| Landing 200 + brand title | `page.goto('')` status 200, `title` matches `/Tran Real Estate Tools/` (current `<title>`: "Tran Real Estate Tools: tools for renters, investors, and agents") |
| Trailing-slash redirect | `request.get('renter', { maxRedirects: 0 })` → 301; `new URL(location, requestUrl).href === base + 'renter/'` (emulator sends a relative `Location`, Pages likely absolute; resolve both) |
| Deep-route refresh | `page.goto('investor/deals/')` 200 + `h1`, `page.reload()` still 200 + `h1` |
| HTTP 404 branded | `page.goto(NOT_FOUND)` status 404, `h1` contains `404` |
| CSP meta first + exact `connect-src` | for each ROUTE + `404.html`: `checkHtml(route, await (await request.get(route)).text(), { analyticsHost })` → `[]`. Never read a `content-security-policy` **header** (on Pages a CSP header means GitHub's own 404 page) |
| Every hashed asset 200 | after `navigator.serviceWorker.ready`, read the single `tran-shell-*` cache's request URLs; every `/_app/immutable/` URL → `request.get` 200 (321 files today; SW `addAll` is all-or-nothing, so a successful install already implies it). Run concurrently in chunks; local ~seconds |
| `sitemap.xml` URL count | 200, `application/xml`, `<loc>` set equals `[...MARKETING_ROUTES, ...LEGAL_ROUTES].map(r => siteUrl + r)` (14) |
| `robots.txt` Sitemap line | 200, `text/plain`, contains `Sitemap: ${siteUrl}sitemap.xml` |
| `manifest.webmanifest` 200 | `request.get('manifest.webmanifest')` 200 + `application/manifest+json`; optional CDP `Page.getAppManifest` errors `[]` like `pwa.spec.ts` |
| OG/Twitter absolute on audited origin | for MARKETING+LEGAL routes: exactly one `og:image`, `og:url === canonical`, every `og:*`/`twitter:*` URL starts with `siteUrl`; map `og:image` path onto base, GET → 200 `image/png` |
| Zero third-party requests | `third-party.spec.ts` "keyless" walk per ROUTE with `networkidle`, GPC on → offenders `[]`; non-vacuity: total requests > ROUTES.length |
| SW same-origin, precache same-origin GETs | registration scope = base, `active.scriptURL` origin = page origin, cache keys `['tran-shell-' + expectVersion]`, every cached URL same-origin, under base, no dotfile segment (`pwa.spec.ts` logic). SW code shape is already pinned by `service-worker-guard.test.ts` |
| `/legal/privacy/#browser-extension` | `page.goto('legal/privacy/')`, `locator('#browser-extension')` count 1 |
| Build stamp | `request.get('_app/version.json?_=' + expectVersion, { headers: { 'cache-control': 'no-cache' } })` → `version === expectVersion`. The up-to-10-minute poll lives in `scripts/smoke.mjs` **before** Playwright starts, so it does not eat the 5-minute `globalTimeout`; give "not propagated" its own exit code |
| GPC-off analytics (SMOKE-05) | `analytics.smoke.ts` only, `test.use({ serviceWorkers: 'block' })`. If `analyticsHost` set: `page.route(host + '/api/send', async r => { const res = await r.fetch(); seen.push({status: res.status(), ct: res.headers()['content-type'], body: await res.json()}); await r.fulfill({ response: res }); })`, `goto('')`, `expect.poll(() => seen.length).toBe(1)`, then `networkidle` and assert still exactly 1, status 200, content-type JSON, body parsed. If unset: assert zero cross-origin requests with GPC off (analytics provably off), not a skip |
| axe (SMOKE-06) | `new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])` on `''`, `'renter/'`, `'legal/privacy/'`; `passes.length > 0` non-vacuity; wait for `html` not `hidden` and `h1` visible first |

**Local analytics collector must answer JSON.** `serve-pages.mjs` `/api/send` POST returns an empty `200` today. Change it to `200` `application/json` with an Umami-shaped body (e.g. `{"cache":"serve-pages"}`). Safe: the beacon is `no-cors` so the page never reads it, and `analytics.configured.spec.ts` reads `/__beacons`, not the response. The configured build bakes `PUBLIC_ANALYTICS_HOST=http://127.0.0.1:${E2E_PORT_ATTACKER ?? 4275}` at build time, so the smoke must run serve-pages on the same attacker port the build used.

### Pattern 6: Deploy checklist and Search Console slot (LIVE-05)
- Rewrite Steps 2-6 into the locked order: (2) empty public repo named exactly `tranrealestate.github.io`, no README/licence/.gitignore (a README makes the first push non-fast-forward); (3) Pages source = GitHub Actions (creates the `github-pages` environment; without it `deploy-pages` fails "create deployment" with HTTP 404); (4) secret scanning + push protection + Dependabot; (5) `git remote add` + `git push -u origin main` with `PAGES_ENABLED` unset; (6) first CI run green with `deploy` skipped; (7) set `PAGES_ENABLED=true`, then `git commit --allow-empty -m "chore: go live" && git push` (the deploy gate excludes `workflow_dispatch`, so setting the variable alone deploys nothing). Optional `git push origin v1.0` (filter-repo already moved the annotated tag).
- Umami: replace "for example `https://cloud.umami.is`" with `https://gateway.umami.is` (the live `https://cloud.umami.is/script.js` contains exactly one host, `gateway.umami.is`, and one `/api/send`; re-verified today). Curl verification with the **real** website id: `curl -i -X POST https://gateway.umami.is/api/send -H 'content-type: application/json' --data '{"type":"event","payload":{"website":"<id>","hostname":"tranrealestate.github.io","url":"/"}}'` → `200` JSON = accepted. Note in the checklist: a `404 {"error":"Website not found"}` means **wrong host or wrong website id** (probed today: both `cloud.umami.is` and `gateway.umami.is` answer that for an unknown id), and the probe itself counts one pageview.
- Search Console: meta-tag method only (HTML-file method breaks `csp:assert`'s exact page set; DNS impossible without a custom domain). Add a slot to `app.html` directly after `%sveltekit.head%` (the CSP meta is emitted inside `%sveltekit.head%`, so it stays first), e.g. a marker comment `<!-- search-console: the google-site-verification meta goes on the next line (docs/DEPLOY-CHECKLIST.md) -->`. Pin it in `scripts/app-html.test.ts`: order `<meta charset>` < `%sveltekit.head%` < slot marker < `frame-guard.js`; any `google-site-verification` meta appears only immediately after the marker, matches `content="[A-Za-z0-9_-]{20,}"`; planted wrong-order case fails. The token is public-safe; the owner (or a Phase 13 plan) commits it. No test pins `app.html` today (verified by grep).
- Fresh-profile rule: every post-redeploy check (Step 7 list, Step 8 Umami/Web3Forms/share-card rows) starts with "in an InPrivate/incognito window or a fresh profile" (the SW is cache-first and never skips waiting, so a normal profile keeps old HTML and an old CSP).
- **Step-number cross-references to keep consistent:** `scripts/lib/pitfalls-evidence.mjs:48` and `:68` (cite "Step 5"), `01-HUMAN-UAT.md:11`, `02-HUMAN-UAT.md:27`, `10-HUMAN-UAT.md:35` (cite "Step 7"). Either preserve "Step 5 = security switches, Step 7 = verify the live origin" or update every reference in the same commit. `pitfalls-evidence.mjs` text flows into the generated launch audit.

### Anti-Patterns to Avoid
- **Normalising every commit message in the callback:** changes 593 commits instead of 233 and needlessly rewrites history before the trailered range.
- **Pushing first, cleaning later:** a force-push to a public default branch; forks and indexing make it permanent.
- **Reading the beacon response from `waitForResponse`:** opaque; the JSON assertion would be vacuous or throw.
- **Polling `version.json` inside the Playwright run:** the 10-minute poll would blow the 5-minute `globalTimeout`; keep the poll in `smoke.mjs`.
- **Bare `fetch(` in `scripts/smoke.mjs`:** the repo-wide `no-restricted-syntax` fetch ban covers `**/*.{ts,js,mjs}`; use `node:http`/`node:https` for the poll (the E2E precedent uses a justified `eslint-disable-next-line`, avoid adding more).
- **Importing a Playwright config from a guard test:** the smoke config throws at load by design; any config guard (Phase 15) must read it as text.
- **Building inside `test:unit`:** `.svelte-kit/output` is shared; a build in a unit test races any concurrent build. Keep build-level proofs in `smoke:local` / `seo:assert`.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Message rewrite + old->new SHA map | sed loops, rebase scripts | `git filter-repo --message-callback`; `.git/filter-repo/commit-map` | Exact mapping, tags carried, in-message hash refs auto-updated |
| CSP check on served HTML | new regexes | `checkHtml()` from `scripts/assert-csp.mjs` | Locked "no third copy" |
| Provider host list for the deny monitor | a new list | `CONNECT` from `assert-csp.mjs` minus `'self'` | Already parity-tested against `@tran/core` PROVIDERS (`provider-hosts.test.ts`) |
| Route list / sitemap expectation | literals | `routes.ts` exports | `routes-drift.spec.ts` keeps them equal to the build |
| Per-build env | ad-hoc env maps | `targetEnv()` + `resolveSiteOrigin` / `resolveAnalytics` / `resolveBasePath` | What CI builds is what the smoke expects |
| Static server | a new server | `scripts/serve-pages.mjs` (with `SERVE_PAGES_EXIT_ON_STDIN_END=1`) | Already reproduces Pages 301/200/404 and the Windows shutdown contract |
| Accessibility | custom checks | `@axe-core/playwright` with the existing `WCAG_TAGS` | Same gate as E2E |
| Opaque beacon visibility | CDP plumbing | `route.fetch()` + `route.fulfill({ response })` | Verified: one request reaches the host, full status/headers/body |

**Key insight:** this phase adds almost no new logic. Every risky assertion already has a tested oracle; the work is parameterising them by URL and making the harness provably read-only.

## Runtime State Inventory (history rewrite)

| Category | Items found | Action required |
|----------|-------------|-----------------|
| Stored data | Git object database: 233 commits + `refs/heads/main` + annotated `refs/tags/v1.0` get new IDs; reflogs and old objects are expired/gc'd by filter-repo. `.git/filter-repo/{commit-map,ref-map}` created. 371 hash references in 43 tracked files point at rewritten commits | Bundle backup first; copy `commit-map` out of `.git`; remap tracked files (code/doc edit, new commit) |
| Live service config | None: no remote (`git remote -v` empty), no GitHub repo yet, no CI history | None (this is why the rewrite must precede `git remote add`) |
| OS-registered state | `simple-git-hooks` pre-commit hook in `.git/hooks/` (unaffected by filter-repo; it does not run hooks); no scheduled tasks reference SHAs | None |
| Secrets / env vars | None reference commit IDs. `.gitleaks.toml` `commits` allowlist: SHAs verified unchanged | Record the re-derivation; no key change |
| Build artifacts | `apps/web/build`, `build-sub`, `build-configured` `_app/version.json` (timestamps today; SHA-stamped after LIVE-04) and `apps/extension/.output` predate the rewrite. Out-of-repo notes (user memory files) may quote old hashes | Rebuild all three before `smoke:local` (its stale-stamp check fails closed otherwise). Out-of-repo notes: informational only |

## Common Pitfalls

### Pitfall 1: `pnpm test:unit` is already red (pre-existing, blocks CI)
**What goes wrong:** `scripts/launch-audit.test.ts` (11 of 28 tests) and `scripts/launch-audit.mjs:1185` read `.planning/research/PITFALLS.md`, whose "Looks Done But Isn't" checklist was replaced by the v1.1 research on 2026-10-29 (commit `3c90f0c`); `scripts/lib/pitfalls-evidence.mjs` maps the v1.0 items. `npx vitest run --project scripts` today: 1 file failed, 11 tests failed, 761 passed.
**How to avoid:** point both at `.planning/milestones/v1.0-research/PITFALLS.md` (exists; also update the descriptive string at `launch-audit.mjs:861`). Do it in the first wave; otherwise every executor's `pnpm test:unit` is red for an unrelated reason and the first GitHub CI run fails.
**Warning sign:** `parsePitfallsChecklist > returns every checklist line of the section verbatim (>= 16)` failing.

### Pitfall 2: A trailer reappears after the rewrite
**What goes wrong:** an executor commit made after the rewrite carries a model trailer (lesson 2026-10-25), and the owner pushes it.
**How to avoid:** explicit ban in every executor prompt; `commit-hygiene` guard test in `test:unit`; final check at phase end `git log --all --format='%(trailers:key=Co-Authored-By,valueonly)' | grep -ciE 'anthropic|claude'` = 0 before handing the owner gate over.

### Pitfall 3: Remap by guesswork
**What goes wrong:** subject-only remapping mis-maps repeated subjects (e.g. several "docs(10-xx): complete … plan") or truncated hashes collide.
**How to avoid:** use `commit-map` as the mapping, verify each pair by subject, keep the original abbreviation length (lengthen on ambiguity), and restrict substitutions to unique prefixes of changed old SHAs (never touches action pins or pre-rewrite hashes).

### Pitfall 4: Smoke asserts the site URL against the loopback origin (or vice versa)
**What goes wrong:** locally OG/canonical/robots carry `https://tranrealestate.github.io` (or the configured test origin) while pages are served from `127.0.0.1`; asserting "absolute URLs on `SMOKE_BASE_URL`" fails locally, asserting them on a hard-coded origin breaks the custom-domain case.
**How to avoid:** `SMOKE_SITE_URL` from `targetEnv` + `resolveSiteOrigin` + `resolveBasePath` in `smoke:local`; default to `SMOKE_BASE_URL` for live runs.

### Pitfall 5: The analytics proof is vacuous or pollutes
**What goes wrong:** `waitForResponse` cannot see a `no-cors` body, so a "JSON 200" check silently proves nothing; or more than one beacon is sent; or GPC is forgotten in a spec.
**How to avoid:** `route.fetch()` passthrough in exactly one file; `serviceWorkers: 'block'` there; `expect.poll` to 1 then re-assert 1 after `networkidle`; static guard that only one file imports `testGpcOff`; the shared monitor asserts zero analytics-host requests in every GPC-on test.
**Umami nuance (probed today):** with an unknown website id, both `gateway.umami.is` and `cloud.umami.is` return `404 application/json {"error":"Website not found"}`, even for a `HeadlessChrome` user agent. So 404 means "wrong host **or** wrong id"; assert status 200, not just "is JSON". Whether a `HeadlessChrome` request with a **valid** id returns `200 {"beep":"boop"}` (bot drop) is unverified (LOW); either way it is JSON 200 and records nothing.

### Pitfall 6: Port collisions and the baked collector port
**What goes wrong:** `smoke:local` starts serve-pages while an E2E run holds 4273-4276 (`EADDRINUSE`), or runs it on other ports so the configured build's baked analytics host (`127.0.0.1:4275`) is not the running collector.
**How to avoid:** use the default ports (or the same `E2E_PORT_*` env the configured build was built with), probe readiness on the attacker port like `playwright.config.ts` does, fail with a clear message on `EADDRINUSE`, and never run `smoke:local` concurrently with `test:e2e` (one Playwright owner at a time).

### Pitfall 7: Five-minute budget under load
**What goes wrong:** three sequential builds × route walks exceed 5 minutes on a loaded machine.
**Measured:** `routing + seo + pwa + third-party` specs on the root build, 4 workers, 32 tests: 47.9 s (50.8 s wall). Per-route tests (one test per ROUTE instead of one walking test) parallelise better.
**How to avoid:** `fullyParallel: true`, one test per route for walks, `workers` 4 locally (16 cores / 4, per lesson) and 2 in CI, concurrent asset GETs; `smoke.mjs` prints per-target and total wall time and fails if total ≥ 300 s (the criterion); never fix an overrun by raising timeouts.

### Pitfall 8: Provider-shaped strings and GitHub push protection
**What goes wrong:** the owner's first push is scanned by GitHub's ruleset (Anthropic keys blocked by default on free public repos since 2026-10-13), not gitleaks'.
**Verified today (corrects the milestone research's "zero strings" claim):** prefixes do occur in the tree, but only as regexes, split literals or short fakes: `packages/core/src/backup/key-scan.ts:11` (`/sk-ant-[A-Za-z0-9_-]{20,}/`), `apps/web/tests/e2e/feedback.configured.spec.ts:58` (`'sk-ant-api03-' + 'A'.repeat(40)`, assembled at runtime), and planning docs. No full-length provider key shape (`sk-ant-api03-` + 93 chars + `AA`, `AIza` + 35, `ghp_` + 36, `AKIA` + 16) exists in the tree or history. A guard must match full shapes, not bare prefixes, or it will flag the key scanner itself.
**How to avoid:** optional `scripts/provider-key-shapes.test.ts` with full-shape regexes over tracked files and a planted case; never seed real-format keys in smoke specs.

### Pitfall 9: Build stamp breaks a tool that loads `svelte.config.js`
**What goes wrong:** the resolver throws where git is unavailable or `GITHUB_SHA` is malformed, breaking `svelte-kit sync` during `pnpm install` (`prepare`).
**How to avoid:** `GITHUB_SHA` first, then `git rev-parse HEAD`; throw with a named message only when neither yields 40 hex (fail closed is correct for builds; CI and local clones always have git). Unit-test the resolver with planted bad values.

## Code Examples

### Version poll in `scripts/smoke.mjs` (no `fetch`, distinct exit code)
```js
// Source: pattern from milestone PITFALLS Pitfall 3; node: builtins only (repo fetch ban)
import http from 'node:http';
import https from 'node:https';
const get = (url) => new Promise((resolve, reject) => {
	(url.startsWith('https:') ? https : http)
		.get(url, { headers: { 'cache-control': 'no-cache' } }, (res) => {
			let b = ''; res.setEncoding('utf8');
			res.on('data', (c) => (b += c)); res.on('end', () => resolve({ status: res.statusCode, body: b }));
		})
		.on('error', reject);
});
export async function waitForVersion(base, expected, { timeoutMs = 600_000, everyMs = 15_000 } = {}) {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const r = await get(`${base}_app/version.json?_=${expected}-${Date.now()}`).catch(() => null);
		if (r?.status === 200 && JSON.parse(r.body).version === expected) return;
		if (Date.now() > deadline) process.exit(3); // "not propagated", distinct from a failing suite
		await new Promise((s) => setTimeout(s, everyMs));
	}
}
```

### `smoke:local` orchestration (outline)
```text
for target of ['root','sub','configured']:
  dir = apps/web/<BUILD_DIR from targetEnv(target)>; fail if missing
  stamp = JSON.parse(<dir>/_app/version.json).version; fail closed if stamp != `git rev-parse HEAD` ("rebuild: pnpm build:<target>")
spawn node scripts/serve-pages.mjs (stdio pipe, SERVE_PAGES_EXIT_ON_STDIN_END=1); wait for http://127.0.0.1:4275/ 200
for target (sequential):
  env = SMOKE_BASE_URL (root http://127.0.0.1:4273/, sub http://127.0.0.1:4274/tran_real_estate/, configured http://127.0.0.1:4276/),
        SMOKE_ALLOW_HTTP=1, SMOKE_EXPECT_VERSION=stamp,
        SMOKE_SITE_URL=resolveSiteOrigin(e)+resolveBasePath(e)+'/', SMOKE_ANALYTICS_HOST=resolveAnalytics(e).host
        (e = target==='root' ? process.env : {...process.env, ...targetEnv(target)}, the siteEnv() rule)
  run: pnpm --filter web exec playwright test -c playwright.smoke.config.ts --fail-on-flaky-tests
end stdin -> server exits; print per-target + total time; exit non-zero on any failure or total >= 300 s
```
Root `package.json`: `"smoke": "node scripts/smoke.mjs"`, `"smoke:local": "node scripts/smoke.mjs --local"`. If `smoke:local` joins `verify`, place it before the `ext:*` tail (`workflow-gate.test.ts:304` pins the tail) and after `test:e2e` (builds exist, one Playwright owner at a time).

### GPC fixture split
```ts
// apps/web/tests/smoke/fixtures.ts (sketch)
import { test as base, expect } from '@playwright/test';
const withMonitor = base.extend<{ monitor: void }>({
	monitor: [async ({ context }, use) => { /* record + provider-deny route; teardown assertions */ await use(); }, { auto: true }]
});
export const test = withMonitor.extend<{ gpc: void }>({
	extraHTTPHeaders: async ({}, use) => use({ 'Sec-GPC': '1' }),
	gpc: [async ({ context }, use) => {
		await context.addInitScript(() =>
			Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true }));
		await use();
	}, { auto: true }]
});
export const testGpcOff = withMonitor; // imported by analytics.smoke.ts ONLY (static guard)
export { expect };
```

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| `git filter-branch --msg-filter` (lessons.md) | `git filter-repo` | git docs deprecate filter-branch | Use filter-repo; commit-map makes the remap exact |
| Kit default `version.name` = build timestamp | `version.name` = commit SHA | this phase | Post-deploy smoke can wait for "this" build behind Fastly `max-age=600` |
| `retries` in smoke for CDN lag (ARCHITECTURE.md sample) | `retries: 0` + `--fail-on-flaky-tests` + version poll | milestone SUMMARY decision | Retries would hide the failures a smoke exists to catch |
| DEPLOY-CHECKLIST Umami example `cloud.umami.is` | `gateway.umami.is` + curl with the real id | this phase | Wrong host is silent under `no-cors` |

**Deprecated/outdated in the milestone research (corrected here):**
- "168 commits mention Claude/AI": 145 carry the trailer; the rest are product provider names. Nothing else to triage.
- "Re-derive the two allowlist SHAs or switch to path + regex": the SHAs are unchanged by a message-only rewrite; `paths` alone already covers both findings.
- "zero `sk-ant-`... strings in apps/packages": prefixes exist as regexes/split literals; no full key shapes.
- "`POST cloud.umami.is/api/send` → 404 means wrong host": with a fake id both hosts 404 identically; the claim is unproven for a real id. The checklist should still name `gateway.umami.is` (it is what the official tracker uses).

## Open Questions

1. **Does `WxtVitest` apply `wxt.config.ts`'s `vite().define` to the `extension` Vitest project?**
   - Known: `apps/extension/vitest.config.ts` uses `WxtVitest({ root })`; the popup browser config uses the plain Svelte plugin.
   - Unclear: whether a define in `wxt.config.ts` reaches unit tests. Moving `TRAN_ORIGIN` into its own module limits exposure to the popup footer and its browser test.
   - Recommendation: add the define explicitly to every config whose tests import the module; first task runs `pnpm vitest run --project extension` and `pnpm ext:test:browser`.
2. **Should `smoke:local` join `pnpm verify`?**
   - Recommendation: yes, after `test:e2e` and before the `ext:*` tail; adds ~2.5-3 min. It is the only local gate for LIVE-04's served stamp and the configured-origin proof at the HTTP layer.
3. **Commit-hygiene step in `ci.yml` now or in Phase 13?**
   - Recommendation: now (two-file commit), because the first push is exactly when it matters; it adds a `run:` step only.
4. **Valid-id Umami response for a HeadlessChrome UA** (bot drop body) cannot be checked without the owner's account. Not blocking: the spec asserts JSON 200, which holds for both accept and bot-drop.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.12 (root `vitest.config.ts` projects: web, core, brand, scripts, web-browser, extension) + Playwright 1.63.0 (E2E config and the new smoke config) |
| Config files | `vitest.config.ts`, `scripts/vitest.config.ts`, `apps/web/playwright.config.ts`, NEW `apps/web/playwright.smoke.config.ts` |
| Quick run | `npx vitest run --project scripts` (~17 s) |
| Full suite | `pnpm verify` (plus `pnpm smoke:local` if added) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test type | Automated command | File exists? |
|--------|----------|-----------|-------------------|--------------|
| LIVE-01 | Zero AI trailers / attributions in all refs | CLI assertion + unit guard | `git log --all --format='%(trailers:key=Co-Authored-By,valueonly)' \| grep -ciE 'anthropic\|claude'` → `0`; `git log --all -i -E --grep='co-authored-by:.*(claude\|anthropic)\|noreply@anthropic\.com\|generated with \[?claude\|claude code\|🤖' --format=%H \| wc -l` → `0`; `npx vitest run --project scripts scripts/commit-hygiene.test.ts` | ❌ Wave 0 (`commit-hygiene.mjs/.test.ts`) |
| LIVE-01 | History scan + canary green on rewritten history | CLI | `pnpm secrets:scan && pnpm secrets:canary` (exit 0, "no leaks found", "canary detected") | ✅ |
| LIVE-01 | Allowlist re-derived and load-bearing | CLI (plan verification) | `gitleaks git --config <allowlist-stripped copy> .` → exactly 2 findings at `4e453c1`, `05793bf`; with the real config → 0 | manual-scripted in plan |
| LIVE-01 | Quoted hashes resolve with matching subjects | script check | remap verifier: every hex token that was a changed old SHA is gone; every replaced token `git cat-file -e` resolves and subject matches | one-off script |
| LIVE-04 | Resolver returns `GITHUB_SHA` / HEAD, rejects bad values | unit | `npx vitest run --project web src/lib/build-stamp.test.ts` | ❌ Wave 0 |
| LIVE-04 | Build dir and served `version.json` == HEAD | smoke + smoke.mjs check | `pnpm build:root && pnpm build:sub && pnpm build:configured && pnpm smoke:local` (`version.smoke.ts`, stale-stamp precheck) | ❌ |
| LIVE-05 | Search Console slot after `%sveltekit.head%`, CSP still first | unit + oracle | `npx vitest run --project scripts scripts/app-html.test.ts`; `pnpm csp:assert` | ❌ Wave 0 |
| LIVE-05 | Checklist order and content | unit (text oracle) | optional `scripts/deploy-checklist.test.ts`: headings in order, contains `gateway.umami.is`, `curl -i -X POST`, `tranrealestate.github.io` repo-name rule, "InPrivate" on post-redeploy items, no `cloud.umami.is` example | ❌ (recommended) |
| LIVE-08 | Literal sweep + derivation + configured test origin | unit | `npx vitest run --project scripts scripts/site-url.test.ts scripts/build-targets.test.ts scripts/assert-extension.test.ts` | ❌ / ✅ (edit) |
| LIVE-08 | Built pages honour the configured origin | oracle | `pnpm build:configured && node scripts/assert-seo.mjs apps/web/build-configured --target configured` | ✅ (after target change) |
| LIVE-08 | Extension bundle honours `PUBLIC_SITE_URL` | build + oracle | `PUBLIC_SITE_URL=https://probe.example pnpm ext:build && PUBLIC_SITE_URL=https://probe.example pnpm ext:assert` + grep bundle for `https://probe.example/legal/privacy/#browser-extension` | plan verification step |
| SMOKE-01 | Fail-closed env gate | unit | `npx vitest run ... smoke-env.test.ts` (unset, http non-loopback, http loopback without flag, `ftp:`, no trailing slash, bad version → throw; https and flagged loopback → ok); `SMOKE_BASE_URL= pnpm --filter web exec playwright test -c playwright.smoke.config.ts` exits non-zero before any test | ❌ Wave 0 |
| SMOKE-01 | Read-only harness | unit (static) + runtime monitor | `npx vitest run --project scripts scripts/smoke-readonly.test.ts`; monitor teardown assertions inside every smoke test | ❌ Wave 0 |
| SMOKE-01/03 | < 5 min, zero retries, all three builds green | smoke | `pnpm smoke:local` (prints per-target + total; exit 0) | ❌ |
| SMOKE-02 | Live contract | smoke | `pnpm smoke:local` (routing, csp, assets, pwa, seo, third-party, version, extension-link specs) | ❌ |
| SMOKE-05 | One GPC-off spec; JSON 200 from configured host | smoke + static | `analytics.smoke.ts` green on configured (one beacon, 200 JSON from the emulator collector) and on root/sub (analytics off: zero cross-origin requests); `smoke-readonly.test.ts` "exactly one testGpcOff importer" | ❌ |
| SMOKE-06 | axe zero violations on 3 pages | smoke | `a11y.smoke.ts` inside `pnpm smoke:local` | ❌ |
| (pre-existing) | launch-audit tests read v1.0 PITFALLS | unit | `npx vitest run --project scripts scripts/launch-audit.test.ts` → 28/28 | ✅ (currently 11 red) |

**What "green" means:** `pnpm verify` exit 0 (with `test:unit` restored to fully green), `pnpm smoke:local` exit 0 with total under 300 s and no flaky/retried tests, both history counts 0, `secrets:scan` and `secrets:canary` exit 0, `git remote -v` empty.

### Sampling Rate
- Per task commit: `npx vitest run --project scripts` (and `--project web` / `--project extension` when those files change).
- Per wave merge: `pnpm test:unit`; after any build-affecting change, the three builds + `csp:assert` + `seo:assert` + `smoke:local`.
- Phase gate: full `pnpm verify` + `pnpm smoke:local` + the two history counts + `secrets:scan`/`secrets:canary`, all green, before `/gsd:verify-work` and before handing the owner gate over.

### Wave 0 Gaps
- [ ] Fix `scripts/launch-audit.mjs` + `scripts/launch-audit.test.ts` PITFALLS path (suite is red today)
- [ ] `scripts/commit-hygiene.mjs` + `scripts/commit-hygiene.test.ts`
- [ ] `apps/web/src/lib/build-stamp.js` + `build-stamp.test.ts`
- [ ] `apps/web/tests/smoke/env.ts` + its unit test; `scripts/smoke-readonly.test.ts`
- [ ] `scripts/site-url.test.ts`, `scripts/app-html.test.ts`
- [ ] `serve-pages.mjs` collector JSON response (keep `analytics.configured.spec.ts` green)

## Sources

### Primary (HIGH confidence)
- Repository, read 2026-10-29: `.planning/{REQUIREMENTS,ROADMAP,STATE,PROJECT,MILESTONES}.md`, `.planning/research/{SUMMARY,PITFALLS,ARCHITECTURE}.md`, `CLAUDE.md`, `tasks/lessons.md`, `docs/DEPLOY-CHECKLIST.md`, `docs/LAUNCH-AUDIT.md`, `scripts/{serve-pages,build-web,assert-csp,assert-seo,assert-extension,gitleaks,gitleaks-canary,launch-audit}.mjs`, `scripts/lib/{build-targets,pitfalls-evidence}.mjs`, `scripts/{workflow-gate,extension-release-gate,service-worker-guard,provider-hosts,launch-audit,build-targets}.test.ts`, `.gitleaks.toml`, `package.json`, `apps/web/{package.json,playwright.config.ts,svelte.config.js,vite.config.ts,tsconfig.json}`, `apps/web/src/{app.html,service-worker.ts,lib/site-config.js,lib/base-path.js,lib/site.ts,lib/csp-policy.js,lib/analytics/beacon.ts}`, `apps/web/tests/e2e/{routes,site-env,routing.spec,seo.spec,pwa.spec,third-party.spec,analytics.configured.spec,a11y.spec}.ts`, `apps/web/tests/e2e/{helpers/beacons,support/network}.ts`, `apps/extension/{wxt.config.ts,vitest.config.ts,vitest.browser.config.ts,package.json,src/lib/config.ts}`, `.github/workflows/{ci,extension-release}.yml`, `eslint.config.js`.
- Commands run 2026-10-29: git trailer/grep counts, `git for-each-ref`, `git worktree list`, `%G?`, merge-base ancestry of allowlisted SHAs; `git filter-repo` dry run on a `--no-local` scratch clone (commit-map, ref-map, first-changed-commits, suboptimal-issues); gitleaks 8.30.1 history scans with full / commits-only / paths-only / no allowlist; canary; `vitest run --project scripts` (11 red); probe web build with `PUBLIC_SITE_URL=https://probe-origin.example` + `assert-seo`; Playwright 1.63.0 `--help` and `types/test.d.ts` (`failOnFlakyTests`); two Playwright probes of a `no-cors` beacon (`waitForResponse` vs `route.fetch()`); E2E subset timing (47.9 s, 32 tests, 4 workers).
- `@sveltejs/kit` 2.70.3 installed `types/index.d.ts` `version.name` docs; `src/exports/vite/index.js` writes `${appDir}/version.json`.
- `git filter-repo -h` (installed build): `--message-callback`, `--force`, `--preserve-commit-hashes` (default rewrites hash refs in messages), `--replace-refs`.

### Secondary (MEDIUM confidence)
- Live probes 2026-10-29: `https://cloud.umami.is/script.js` references `gateway.umami.is` and `/api/send`; `POST` with an unknown website id to either host → `404 application/json {"error":"Website not found"}` (both generic and HeadlessChrome UA).
- Milestone research (same day) for Pages/Fastly `max-age=600`, push-protection defaults, Pages source ordering.

### Tertiary (LOW confidence)
- Umami `isbot` drop returning `200 {"beep":"boop"}` for a valid id with a HeadlessChrome UA (from milestone research reading Umami source; not reproducible without an account).

## Metadata

**Confidence breakdown:**
- History rewrite: HIGH (dry-run end to end on a clone, counts exact, scan green)
- Build stamp: HIGH for Kit behaviour (installed types); MEDIUM for every tool tolerating the git spawn at config load (standard, unexercised here)
- `PUBLIC_SITE_URL`: HIGH web half (probe build), MEDIUM extension wiring (WxtVitest define propagation unverified)
- Smoke design: HIGH (every oracle exists; beacon visibility probed); timing MEDIUM (measured on an idle machine)
- Checklist: HIGH (Umami host re-probed; ordering from milestone research)

**Research date:** 2026-10-29
**Valid until:** 2026-11-28 for repo facts; re-run the two history counts immediately before the rewrite (any new commit changes the 233 figure).
