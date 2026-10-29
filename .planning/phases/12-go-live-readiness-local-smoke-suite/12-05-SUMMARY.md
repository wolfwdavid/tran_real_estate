---
phase: 12-go-live-readiness-local-smoke-suite
plan: 05
subsystem: deploy-runbook
tags: [deploy, github-pages, umami, search-console, csp, docs]
requires:
  - phase: 12-02
    provides: rewritten history and attribution guard (commits here stay trailer-free)
provides:
  - docs/DEPLOY-CHECKLIST.md in the strict go-live order, pinned by scripts/deploy-checklist.test.ts
  - Search Console slot marker in apps/web/src/app.html, pinned by scripts/app-html.test.ts
affects: [12-07, 12-08, 12-10, phase-13]
tech-stack:
  added: []
  patterns:
    - "Text oracle over an owner runbook: heading order, host names, cross-referenced item numbers"
    - "Template slot pin: line-adjacency rules on app.html plus planted wrong-order cases"
key-files:
  created:
    - scripts/deploy-checklist.test.ts
    - scripts/app-html.test.ts
  modified:
    - docs/DEPLOY-CHECKLIST.md
    - apps/web/src/app.html
key-decisions:
  - "Step 5 (secret scanning) and Step 7 (verify live origin) keep their numbers; Step 8 item and sub-item numbers are unchanged (8.1.3, 8.1.8, 8.7), Dependabot body replaced in place by a pointer to Step 4"
  - "Search Console uses only the HTML-tag method, pasted on the line after the app.html marker that sits directly after %sveltekit.head% (CSP meta stays first)"
  - "Umami collect host is https://gateway.umami.is; a curl POST with the real website id proves host and id together before deploy"
patterns-established:
  - "Prose assertions match a whitespace-collapsed copy of the doc so Prettier re-wrapping cannot break them"
requirements-completed: []
duration: 14min
completed: 2026-10-29
---

# Phase 12 Plan 05: Deploy checklist go-live order and Search Console slot Summary

**The owner runbook now runs in the strict go-live order (Pages source before `PAGES_ENABLED`, an empty repo, push with the variable unset, then an empty commit to deploy), names the Umami `gateway.umami.is` host with a real-id curl probe and carries the fresh-profile rule. `app.html` has a pinned Search Console slot after `%sveltekit.head%`.**

## Performance

- **Duration:** about 14 min
- **Completed:** 2026-10-29
- **Tasks:** 2
- **Files:** 4 (2 created, 2 modified)

## Accomplishments

- `docs/DEPLOY-CHECKLIST.md` headings in the locked order: org; empty public repo named exactly `tranrealestate.github.io` (no README, licence or .gitignore); Pages source = GitHub Actions (before Step 6, creates `github-pages`); Dependabot; secret scanning + push protection (before the first push); push `main` with `PAGES_ENABLED` unset, wait for green CI, set the variable, then `git commit --allow-empty -m "chore: go live"`; verify; launch services; extension.
- Step 7 and Step 8 open with the **Fresh-profile rule** (service worker is cache-first and never skips waiting). Step 7 items 1-5 and the Umami GPC checks (8.1.6, 8.1.7) run in a fresh InPrivate window.
- Umami: `PUBLIC_ANALYTICS_HOST=https://gateway.umami.is`, plus an unnumbered curl POST to `/api/send` inside 8.1.4. It explains that `404 {"error":"Website not found"}` means the host OR the id is wrong, and that the probe counts one pageview. `cloud.umami.is` no longer appears.
- Search Console (8.4): HTML-tag method only. Paste the meta after the `<!-- search-console: ... -->` marker, run `scripts/app-html.test.ts`, deploy, Verify, submit the sitemap and confirm 14 URLs.
- Step 9 item 4 now says "After Step 6 (the remote exists)".
- `scripts/deploy-checklist.test.ts` (17 tests) checks:
  - the heading order and titles
  - the Step 6 order (remote, push, green, variable, empty commit)
  - the hosts, the curl probe and the fresh-profile rule
  - every `DEPLOY-CHECKLIST.md Step N` cited in `scripts/lib/pitfalls-evidence.mjs` (Step 5 and Step 7 titles matched)
  - Step 8 top-level items 1-7 and Umami sub-steps 1-9, with 8.1.3 "IP addresses are not stored", 8.1.8 "**Apply the cut line**" and 8.7 "**Record the results**"
- `apps/web/src/app.html`: one marker line directly after `%sveltekit.head%`; nothing else changed.
- `scripts/app-html.test.ts` (11 tests) adds a pure `checkAppHtml`. It covers the real file, one valid planted 43-char token, and these failure cases: marker before head, marker missing, meta before head, meta not adjacent to the marker, two metas, a short token, a token containing `"` or `<`, and a marker after frame-guard.

## Task Commits

1. **Task 1: Deploy checklist in strict go-live order** - `56151ce` (docs)
2. **Task 2: Search Console slot in app.html** - `21a79f7` (feat)

## Verification

- `corepack pnpm vitest run --project scripts scripts/deploy-checklist.test.ts scripts/app-html.test.ts scripts/launch-audit.test.ts scripts/assert-csp.test.ts`: 4 files, 158 tests passed.
- `corepack pnpm lint` and `corepack pnpm banned` (446 files) both pass.
- Acceptance greps: `cloud.umami.is` 0, `gateway.umami.is` 3, curl line 1, `**Fresh-profile rule:**` 2, `chore: go live` 1, nine `## Step` lines in order. app.html: marker 1, marker adjacent to `%sveltekit.head%` 1, `google-site-verification` 1 (only inside the comment).
- `git diff --name-only HEAD~1` over `pitfalls-evidence.mjs`, `docs/LAUNCH-AUDIT.md`, `10-HUMAN-UAT.md` and `10-23-SUMMARY.md` printed nothing, so no external reference needed an edit.
- Mutation check on the checklist oracle. Each mutation below failed the suite and the doc was restored:
  - the host swapped to cloud
  - 8.1.8 un-bolded
  - the Step 5 title changed
  - the InPrivate prefix dropped from item 7.5
  - Step 9 reverted to "After Step 3"
- `gitleaks dir scripts/app-html.test.ts`: no leaks. The planted token is a low-entropy fictional value.
- Neither commit message mentions an assistant, and neither has a trailer (checked with `git log -1 --format=%B`).
- No web build or Playwright run, per the wave 3 rule. `csp:assert` over the built HTML from the new app.html (CSP meta still first; `checkHtml` strips comments, so the marker cannot affect it) runs in 12-07, 12-08 and the 12-10 gate.

## Requirements

LIVE-05 stays **unticked**. This plan delivers the local half only: the corrected checklist and the pinned meta slot. The live half (Search Console verified, sitemap read with 14 URLs) is recorded in Phase 13 under LIVE-06/GTM-04.

## Decisions Made

- Numbering is preserved, not renumbered. Dependabot moved to Step 4, and Step 8 item 6 now holds a one-line pointer so 8.7 stays "Record the results".
- The curl probe is an indented, unnumbered paragraph inside 8.1.4, so sub-steps 5-9 keep their numbers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prose assertions broke on Prettier line wrapping**
- **Found during:** Task 1 (GREEN run)
- **Issue:** `/host OR the website id is wrong/` failed because the sentence wraps across two lines in the doc.
- **Fix:** added a whitespace-collapsed `FLAT` copy of the doc for prose matches.
- **Files modified:** scripts/deploy-checklist.test.ts
- **Commit:** 56151ce

**2. [Rule 2 - Security hygiene] Planted verification token made low-entropy**
- **Found during:** Task 2
- **Issue:** a random-looking 43-char value assigned to `TOKEN` could trip the gitleaks generic-key rule in the CI history scan.
- **Fix:** replaced it with the fictional `sample-site-verification-value-for-tests-00` (43 chars) and confirmed with `gitleaks dir`.
- **Files modified:** scripts/app-html.test.ts
- **Commit:** 21a79f7

Otherwise the plan executed as written. Each task was one commit, as the plan specifies, with no separate RED commit. RED was still confirmed before each implementation: 15 of 17 failed for Task 1, and 2 of 11 (the real-file cases) for Task 2.

## Known Stubs

None. The marker comment is the intended slot. The owner fills it in Phase 13 with the real Search Console token.

## Self-Check: PASSED

- FOUND: docs/DEPLOY-CHECKLIST.md, scripts/deploy-checklist.test.ts, apps/web/src/app.html, scripts/app-html.test.ts
- FOUND: commits 56151ce, 21a79f7
