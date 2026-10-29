---
phase: 12-go-live-readiness-local-smoke-suite
verified: 2026-10-29T17:20:00Z
status: human_needed
score: 5/5 success criteria verified locally (owner gate pending)
re_verification: false
human_verification:
  - test: "Plan 12-10 Task 3 owner go-live gate"
    expected: "Follow docs/DEPLOY-CHECKLIST.md Steps 1-5 (org tranrealestate, empty public repo tranrealestate.github.io, Pages source = GitHub Actions, Dependabot, secret scanning + push protection), then git remote add origin ... and git push -u origin main with PAGES_ENABLED unset"
    why_human: "Blocking human-action: creates external GitHub resources; no agent may do it"
  - test: "LIVE-05 live half (Phase 13)"
    expected: "Search Console verified by the meta tag, sitemap.xml submitted and read (14 URLs)"
    why_human: "Needs the live origin; owned by Phase 13 / GTM-04"
---

# Phase 12: Go-live Readiness & Local Smoke Suite Verification Report

**Phase Goal:** Everything required before `git remote add` is true (clean history, re-derived gitleaks allowlist, build stamp, `PUBLIC_SITE_URL` honoured, corrected deploy checklist) and a read-only fail-closed smoke suite proves the Pages contract against the local emulator for all three builds.
**Verified:** 2026-10-29
**Status:** human_needed (all local must-haves hold; only the intentional owner gate remains)
**Re-verification:** No

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Zero AI trailers/mentions in whole history; gitleaks allowlist re-derived; history scan green | VERIFIED | `commit-hygiene.mjs --history`: 1252 scanned, 0 attributed. Co-Authored-By trailer grep for anthropic/claude: 0. `secrets:scan`: 1251 commits, no leaks. `secrets:canary`: detected as expected. `git remote -v`: empty. `.gitleaks.toml` re-derivation recorded (12-02); hygiene guard in test:unit and CI (commit-hygiene.test.ts, workflow-gate.test.ts pass). |
| 2 | `smoke:local` green on all three builds, under 5 min, zero retries, fail-closed env gate, read-only monitor | VERIFIED | Rebuilt all three builds at HEAD c767cb0 and ran `node scripts/smoke.mjs --local`: root/sub/configured each 121 passed, total 61.8 s (budget 300). smoke-env.test.ts, smoke.test.ts, smoke-readonly.test.ts pass (part of 180/180 in 9 files). Config has retries 0, failOnFlakyTests. |
| 3 | Suite asserts full live contract; single GPC-off analytics spec; axe on 3 pages | VERIFIED | Smoke specs present: routing, csp, seo, assets, pwa, third-party, version, extension-link, analytics, a11y. `testGpcOff` used only in analytics.smoke.ts; all other specs use the GPC fixture. All 121 tests per build pass. |
| 4 | `/_app/version.json` = commit SHA; `PUBLIC_SITE_URL` alone changes canonicals, sitemap, OG, extension TRAN_ORIGIN/PRIVACY_URL, proven by test | VERIFIED | `apps/web/build/_app/version.json` = c767cb074c51... = HEAD. `scripts/site-url.test.ts` passes; configured target uses test origin tran-configured.example; 12-04 probe build passed the oracle. |
| 5 | DEPLOY-CHECKLIST strict order, `gateway.umami.is` + curl, Search Console slot after `%sveltekit.head%` pinned, fresh-profile rule | VERIFIED | `deploy-checklist.test.ts` (17 tests) and `app-html.test.ts` pass. `app.html` line 6 marker directly follows `%sveltekit.head%` (line 5). |

**Score:** 5/5 truths verified (owner gate excluded by design)

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| scripts/commit-hygiene.mjs + test | VERIFIED | Runs, wired into hook, test:unit and CI |
| apps/web/src/lib/build-stamp.js, svelte.config.js, scripts/build-web.mjs | VERIFIED | version.json equals HEAD after fresh build |
| apps/extension/src/lib/site.ts, assert-extension.mjs urlAllowlist | VERIFIED | Covered by 12-04 summary; site-url.test.ts passes |
| docs/DEPLOY-CHECKLIST.md, apps/web/src/app.html | VERIFIED | Pinned by tests |
| apps/web/tests/smoke/*.smoke.ts (11 files), env.js, fixtures.ts, playwright.smoke.config.ts, scripts/smoke.mjs | VERIFIED | Substantive; executed green |
| package.json `smoke`, `smoke:local`, `verify` includes smoke:local | VERIFIED | Lines 26, 27, 44; pinned by workflow-gate.test.ts |

### Key Link Verification

| From | To | Status | Details |
|------|----|--------|---------|
| build-web.mjs BUILD_SHA | kit.version.name | WIRED | Fresh build stamp equals HEAD |
| smoke.mjs | serve-pages.mjs + build-dir stamp | WIRED | Stale-gate exit 2 observed in design; fresh run green |
| fixtures.ts | assert-csp CONNECT | WIRED | Provider deny-list derived, no third copy |
| verify script | smoke:local | WIRED | After test:e2e, before audit:deps |
| PUBLIC_SITE_URL | ci.yml / extension-release.yml | WIRED | Pinned by site-url.test.ts and workflow-gate.test.ts |

### Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
|-------------|----------------|--------|----------|
| LIVE-01 | 12-01, 12-02, 12-10 | SATISFIED | Truth 1 |
| LIVE-04 | 12-03, 12-10 | SATISFIED | Truth 4 |
| LIVE-05 | 12-05, 12-10 | LOCAL HALF SATISFIED | Truth 5; live half intentionally Pending to Phase 13 (not a gap) |
| LIVE-08 | 12-04, 12-07, 12-10 | SATISFIED | Truth 4 |
| SMOKE-01 | 12-06, 12-09, 12-10 | SATISFIED | Truth 2 |
| SMOKE-02 | 12-08, 12-09, 12-10 | SATISFIED | Truth 3 |
| SMOKE-03 | 12-08, 12-10 | SATISFIED | 3 targets green |
| SMOKE-05 | 12-09, 12-10 | SATISFIED | Single GPC-off analytics spec |
| SMOKE-06 | 12-08, 12-10 | SATISFIED | a11y.smoke.ts passes |

All 9 phase IDs appear in plan frontmatter and REQUIREMENTS.md; no orphaned requirements (SMOKE-04 and LIVE-02/03/06/07/09 map to Phase 13).

### Anti-Patterns Found

None blocking. `deferred-items.md` holds one item: precommit.test.ts failed once under four-executor load, passed alone and in later full runs (12-10 full run 349 files / 6803 tests green). Info only; not a Phase 12 goal blocker. Working tree was clean after my rebuild and smoke run (build dirs are untracked/ignored).

### Human Verification Required

1. **Owner go-live gate (12-10 Task 3).** Create org `tranrealestate`, empty public repo `tranrealestate.github.io` (no README), set Pages source = GitHub Actions, enable Dependabot, secret scanning and push protection, then `git remote add origin https://github.com/tranrealestate/tranrealestate.github.io.git` and `git push -u origin main` with `PAGES_ENABLED` unset. Why human: external account resources.
2. **LIVE-05 live half** (Search Console verification and sitemap submission) after Phase 13 deploy.

### Gaps Summary

No gaps. Not independently re-run: the full 7.9-minute-per-project E2E suites and the extension tail of the gate (taken from the 12-10 SUMMARY gate record at a61db44, a docs-only HEAD difference). 12-10 is correctly left unchecked in ROADMAP pending the owner gate.

---

_Verified: 2026-10-29_
_Verifier: Claude (gsd-verifier)_
