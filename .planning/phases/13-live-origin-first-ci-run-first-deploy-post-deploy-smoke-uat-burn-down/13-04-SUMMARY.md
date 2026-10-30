---
phase: 13-live-origin-first-ci-run-first-deploy-post-deploy-smoke-uat-burn-down
plan: 04
subsystem: docs
tags: [deploy-checklist, github-pages, base-path, extension, text-oracle, vitest]

# Dependency graph
requires:
  - phase: 12-go-live-readiness-local-smoke-suite
    provides: the corrected DEPLOY-CHECKLIST (12-05) and its text oracle; the owner's personal-account decision at the 12-10 gate
  - phase: 11-zillow-sponsored-listing-filter-extension
    provides: docs/EXTENSION-INSTALL.md, apps/extension/store/edge-listing.md and scripts/extension-docs.test.ts
provides:
  - docs/DEPLOY-CHECKLIST.md as the one-time go-live record for wolfwdavid/tran_real_estate (Steps 1-6 marked Completed 2026-10-29; Step 6 carries the PUBLIC_SITE_URL + BASE_PATH variables, the MSYS_NO_PATHCONV note and the rehearsal push before PAGES_ENABLED)
  - every live URL in the checklist under https://wolfwdavid.github.io/tran_real_estate/ (Step 7 fresh-profile checks, Step 8 Umami/Search Console/share-card proofs, Step 9 privacy URL)
  - extension install guide and Edge listing pointing at https://wolfwdavid.github.io/tran_real_estate/legal/privacy/#browser-extension
  - text oracles that fail if `tranrealestate` reappears in any of the three docs
affects: [13-13 go-live push, 13 GTM proofs, 13 RUNBOOK plan, 13 launch-proof bundle, 14 DEBT-03 extension constants]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Doc text oracles assert sentence-level prose on the whitespace-collapsed FLAT text and position order on the raw section text"
    - "Owner-action docs carry a bold `**Completed <date>`** marker per step so the record and the instructions live in one file"

key-files:
  created: []
  modified:
    - docs/DEPLOY-CHECKLIST.md
    - scripts/deploy-checklist.test.ts
    - docs/EXTENSION-INSTALL.md
    - apps/extension/store/edge-listing.md
    - scripts/extension-docs.test.ts

key-decisions:
  - "13-04: LIVE-05 and LIVE-09 stay unchecked after this plan: it delivers LIVE-05's checklist half and LIVE-09's one-time record only; the Search Console proof (GTM-04) and the RUNBOOK plan close them"
  - "13-04: PUBLIC_SITE_URL is documented as the origin only (https://wolfwdavid.github.io, no path); BASE_PATH carries /tran_real_estate, and the oracle rejects a PUBLIC_SITE_URL value that includes the path"
  - "13-04: Step 9 item 1 and the Step 8/9 'record the results' pointers name the consolidated .planning/HUMAN-UAT.md instead of the superseded per-phase UAT files"

patterns-established:
  - "Step 6 order is pinned as remote < push < green < vars < rehearse < PAGES_ENABLED < go-live, so no future edit can move the variables after the go-live push"

requirements-completed: []

# Metrics
duration: 8min
completed: 2026-10-30
---

# Phase 13 Plan 04: DEPLOY-CHECKLIST personal-account rewrite + extension privacy URL Summary

**The owner-facing go-live record now describes the real origin: `wolfwdavid/tran_real_estate` served at `https://wolfwdavid.github.io/tran_real_estate/`, with Steps 1-6 marked completed, Step 6 carrying the `PUBLIC_SITE_URL` + `BASE_PATH` variables and a rehearsal push, and the extension docs giving the base-path privacy URL; two Vitest text oracles pin all of it and fail on any `tranrealestate` mention.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-30T11:37:38Z
- **Completed:** 2026-10-30T11:45:30Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `docs/DEPLOY-CHECKLIST.md` rewritten to the personal-account reality (D-03, D-21): intro names the Phase 12 gate decision and points day-to-day operations at `docs/RUNBOOK.md`; Step 1 is "Use the owner account (no organization)" with the shared-origin trade-off; Step 2 names `tran_real_estate` exactly and the `/tran_real_estate` base path; Steps 3-5 record that they were applied through the GitHub API at the gate; Step 6 records run 40961373692, adds the origin-variable item (`gh variable set PUBLIC_SITE_URL ...`, `MSYS_NO_PATHCONV=1 gh variable set BASE_PATH ...`, `gh variable list`), the rehearsal push with `deploy` and `live-smoke` skipped, and the `live-smoke.yml` follow-up after go-live. All nine `## Step N:` headings kept, so "Step 5", "Step 7", "8.1.3", "8.1.8" and "8.7" cross-references stay true.
- Every live URL moved under `https://wolfwdavid.github.io/tran_real_estate/`: Step 7 items 1-4 (item 4 now also asks for HTTP 404 via `curl -w "%{http_code}"`), Step 8 Umami website/hostname/url probe, Search Console URL-prefix property and sitemap (plus the project-site `robots.txt` note from RESEARCH Pitfall 6), share-card URL, and Step 9 privacy URL. `grep -c tranrealestate docs/DEPLOY-CHECKLIST.md` prints 0.
- `scripts/deploy-checklist.test.ts` (21 tests, all green): new Step 1/2 headings, Step 6 order `remote < push < green < vars < rehearse < PAGES_ENABLED < go-live`, completion marker on Steps 1-6, real-origin-only assertion, origin-only `PUBLIC_SITE_URL` + `BASE_PATH` bodies, and the robots.txt note inside the Search Console item.
- `docs/EXTENSION-INSTALL.md` and `apps/extension/store/edge-listing.md` give `https://wolfwdavid.github.io/tran_real_estate/legal/privacy/#browser-extension`; `scripts/extension-docs.test.ts` (15 tests, all green) pins that URL through one `PRIVACY_URL` constant and asserts neither doc names the retired organization host.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite DEPLOY-CHECKLIST to the personal-account origin and update its oracle** - `a942855` (docs)
2. **Task 2: Extension docs and store listing carry the base-path privacy URL** - `4e268ee` (docs)

**Plan metadata:** see the final docs commit for this plan.

## Files Created/Modified

- `docs/DEPLOY-CHECKLIST.md` - one-time go-live record for the personal-account origin; Steps 1-6 completed markers; Step 6 variables + rehearsal; all URLs under the project site
- `scripts/deploy-checklist.test.ts` - text oracle: headings, Step 6 order including vars/rehearsal, completion markers, origin-only assertions, robots.txt note
- `docs/EXTENSION-INSTALL.md` - Privacy section links the project-site privacy URL
- `apps/extension/store/edge-listing.md` - Partner Center privacy policy URL is the project-site URL
- `scripts/extension-docs.test.ts` - `PRIVACY_URL` constant pinned in both docs; retired-host rejection

## Decisions Made

- **Requirements left unchecked.** The plan frontmatter lists LIVE-05 and LIVE-09, but this plan only delivers LIVE-05's checklist half (REQUIREMENTS.md line 161 and ROADMAP's Phase 12 note say the requirement is ticked when the Search Console / sitemap proof is recorded under GTM-04) and LIVE-09's one-time record (the RUNBOOK that LIVE-09 is defined by is another Phase 13 plan). `requirements mark-complete` was therefore not run; the plans that land the live proof and the RUNBOOK close them.
- **`PUBLIC_SITE_URL` is origin-only.** The checklist and its oracle enforce `--body "https://wolfwdavid.github.io"` (no `/tran_real_estate`), matching D-01 and the `resolveSiteUrl` helper; `BASE_PATH` carries the path. The Phase 12 deferred-items note that suggested the full URL is superseded by this wording.
- **UAT pointers consolidated.** Step 8 item 1.3, Step 8 item 7 and the Step 9 intro/item 1 now point at `.planning/HUMAN-UAT.md` rather than the per-phase 10-/11-HUMAN-UAT files (the plan asked for 1.3, 8.7 and the Step 9 intro; item 9.1 was aligned so it does not cite a superseded file one line below the new pointer).

## Deviations from Plan

None - plan executed as written. The only non-specified touch is the Step 9 item 1 UAT pointer noted above, kept for consistency with the intro pointer the plan did specify.

## Issues Encountered

- The first oracle run failed on `(needs Steps 1-7)` because my manual line wrap in Step 9 item 2 split the phrase across two lines and that assertion runs on the raw section text, not `FLAT`. Reflowed the item so the URL sits alone on its line and the phrase stays intact; Prettier leaves the wrap as written (`proseWrap` is the default `preserve`).

## Verification

- `pnpm vitest run --project scripts scripts/deploy-checklist.test.ts` - 21 passed
- `pnpm vitest run --project scripts scripts/extension-docs.test.ts` - 15 passed
- `pnpm exec prettier --check` on all five files - clean; `pnpm exec eslint` on both test files - clean
- Acceptance greps: `tranrealestate` 0 in all three docs; `^## Step` 9; `Completed 2026-10-29` 6; remote line 1; `MSYS_NO_PATHCONV=1 gh variable set BASE_PATH ... --body "/tran_real_estate"` 1; privacy URL 1 per file
- Commit hygiene: `git log -1 --format=%B | grep -ciE "co-authored-by|claude|anthropic"` printed 0 after each commit
- Full `pnpm lint` / `pnpm test:unit` deliberately not run here (parallel wave; the orchestrator runs them once after the wave)

## Known Stubs

None. Both docs are complete prose; the Edge Add-ons listing-link placeholder in `docs/EXTENSION-INSTALL.md` predates this plan and is filled by Step 9 item 3 once the store listing is certified.

## Next Phase Readiness

- 13-13 (go-live push) can follow Step 6 verbatim: the commands are Windows-safe and the rehearsal run is now part of the record.
- The GTM-04 proof plan should tick LIVE-05 when the Search Console row is recorded; the RUNBOOK plan ticks LIVE-09.
- Phase 14 DEBT-03 replaces the `PRIVACY_URL` literal in `scripts/extension-docs.test.ts` with the shared site constant (noted in a comment next to the constant).

## Self-Check: PASSED

All five modified files, the SUMMARY and both task commits (a942855, 4e268ee) verified on disk and in `git log`.
