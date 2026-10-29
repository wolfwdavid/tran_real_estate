---
status: partial
phase: 12-go-live-readiness-local-smoke-suite
source: [12-VERIFICATION.md]
started: 2026-10-29T21:08:21Z
updated: 2026-10-29T21:08:21Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Owner go-live gate (12-10 Task 3, docs/DEPLOY-CHECKLIST.md Steps 1-6.1)
expected: Org `tranrealestate` exists; EMPTY public repo `tranrealestate.github.io` exists (no README, licence or .gitignore); Pages source = GitHub Actions; Dependabot alerts + security updates ON; secret scanning + push protection ON; then with `PAGES_ENABLED` unset the owner runs `git remote add origin https://github.com/tranrealestate/tranrealestate.github.io.git && git push -u origin main` (and optionally `git push origin v1.0`). Check afterwards: `git remote -v` names the repo, `git rev-parse main` equals `git rev-parse origin/main`, the first `ci` Actions run is green with the `deploy` job skipped, push protection shows ON. Steps 6.2-6.3 (set `PAGES_ENABLED`, "chore: go live") belong to Phase 13.
result: [pending]

### 2. LIVE-05 live half (Phase 13)
expected: Search Console property verified through the pinned HTML-tag slot in `apps/web/src/app.html` and the sitemap read without errors on the live origin. Recorded by Phase 13 under LIVE-06 / GTM-04; LIVE-05 stays Pending in REQUIREMENTS.md until then.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
