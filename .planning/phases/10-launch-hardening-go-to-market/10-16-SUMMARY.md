---
phase: 10-launch-hardening-go-to-market
plan: 16
subsystem: onboarding/data
tags: [onboarding, rentcast, setup, sample-mode, a11y, gtm]
requires: ["10-15 (guide, onboarding-state, SETUP_COPY)", "Phase 3 ProviderKeyCard + settings context", "Phase 4 CapEditor, KeyTestResult, data runtime, DataShell", "Phase 8 sample contacts"]
provides:
  - "setup-params.ts: parseSetupPortal(search), consumeSampleParam(url)"
  - "/setup/rentcast/ guided key setup route (prerendered shell, noindex from the (app) group)"
  - "hasSavedCap(db) in $lib/data (cap saved at least once)"
  - "DataShell onStart(runtime) prop: hands the runtime up and holds the check-on-open pass until it settles"
  - "(app) layout ?source=sample hand-off + HIDE_STATUS_BAR set"
affects: ["10-18 (Settings 'Set up a RentCast key' link -> resolve('/setup/rentcast/'))", "10-20 (guide journey E2E can follow both exits)", "10-22/10-23 (setup axe group, budget)"]
tech-stack:
  added: []
  patterns: ["read arrival query params synchronously at layout init; act once the runtime is ready", "child-to-parent runtime hand-off via an onStart callback prop"]
key-files:
  created:
    - apps/web/src/lib/components/onboarding/setup-params.ts
    - apps/web/src/lib/components/onboarding/setup-params.test.ts
    - apps/web/src/routes/(app)/setup/rentcast/+page.svelte
    - apps/web/tests/e2e/setup-rentcast.spec.ts
    - apps/web/tests/e2e/sample-handoff.spec.ts
  modified:
    - apps/web/src/routes/(app)/+layout.svelte
    - apps/web/src/lib/features/shared/data/DataShell.svelte
    - apps/web/src/lib/data/ledger-repo.ts
    - apps/web/src/lib/data/ledger-repo.test.ts
    - apps/web/src/lib/data/index.ts
    - apps/web/src/lib/components/onboarding/GetStartedGuide.svelte
    - apps/web/svelte.config.js
    - apps/web/tests/e2e/routes.ts
    - apps/web/tests/e2e/layout.spec.ts
decisions:
  - "The sample hand-off reads ?source=sample from the arrival URL at layout init (page.url) and, for in-app arrivals, from afterNavigate's nav.to.url. Reading location later fails on /renter/, whose search page rewrites its own query in onMount before the runtime is ready."
  - "The data runtime lives in DataShell's context, below the layout, so DataShell gained an onStart(runtime) prop. DataShell awaits it before the check-on-open saved-search pass, so an arrival with ?source=sample never spends calls in live mode first."
  - "Step 3 'Done' comes from a new hasSavedCap(db) (the rentcastCap row exists), exported from $lib/data. The Phase 4 row has no capConfirmedAt field. Its existence is the 'saved at least once' signal, the same signal the contract map names."
  - "Step 2 'Done' needs a saved key and a valid/valid-billed result in rentCastKeyTest.current. That result is memory-only (Phase 4 design), so after a reload step 2 reads To do until the key is tested again."
  - "/setup/rentcast/ is listed in prerender.entries: today only the guide's client-rendered tour step links it, and handleUnseenRoutes is 'fail'. 10-18 adds the static Settings link."
  - "The ghost 'Use sample data for now' is a plain <a> with ghost classes. ButtonLink has no ghost variant, and I did not grow a shared component."
  - "The page copy comes from SETUP_COPY (10-15's single source), not from literals in the page file."
requirements-completed: [GTM-01]
metrics:
  duration: "~2h15m wall (including a network drop and a re-run of the interrupted E2E step)"
  completed: 2026-10-13
  tasks: 2
  files: 14
---

# Phase 10 Plan 16: Guided RentCast key setup and sample hand-off Summary

`/setup/rentcast/` shows three always-visible numbered steps. Step 1 is the RentCast dashboard link (same tab). Step 2 is the Phase 3 key card with the 0-call Test key. Step 3 is the Phase 4 cap editor, default 40. A finish row follows with **Open {portal} portal** and **Use sample data for now**. The step badges come from the vault, the key test and the cap row. Arriving on any portal with `?source=sample` switches the data source to sample, strips the parameter and announces "Showing sample data.". On `/agent/` an empty CRM also gets the sample contacts.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Setup params helper (TDD) and /setup/rentcast/ route | be0f9be (RED), 9b328e9 (GREEN), ea18300 (hasSavedCap), 73dc569 (page, routes, guide link, E2E) |
| 2 | Sample hand-off in the (app) layout and DataStatusBar rule | 7245498 |

## Stubs closed

- The 10-15 guide link is now `` `${resolve('/setup/rentcast/')}?portal=${p}` `` (GetStartedGuide.svelte), and guide.spec's href assertion still passes.
- `?source=sample` is handled. That covers the guide's Try sample data, the audience pages' Try sample data (10-17) and the setup page's own sample link (an in-app navigation, caught by afterNavigate).

## Verification (real output)

- `vitest run --project web setup-params`: RED failed (module missing). GREEN passed 15/15. `vitest run --project web ledger-repo`: 20/20, including the new hasSavedCap test.
- `pnpm check`: 0 errors, 0 warnings (2736 files). `pnpm lint`: exit 0. `pnpm banned`: passed (443 files).
- `build:root`, `build:sub` and `build:configured` all exit 0. `csp:assert`: passed for 44 pages × 3 targets (it was 42 pages before the new route).
- `grep -c 'content="noindex"' apps/web/build/setup/rentcast/index.html` returns 1. The setup E2E also asserts exactly one robots noindex and no `target="_blank"` in the prerendered HTML.
- `curl -sI https://app.rentcast.io/app/api` returned `HTTP/1.1 200 OK`, so the dashboard URL is unchanged.
- Focused E2E, root + sub: `setup-rentcast` + `sample-handoff` + `data-status` passed 38/38, and `setup-rentcast` + `guide` passed 26/26. a11y.spec passed 159/159 on root and 159/159 on sub. The first sample-handoff run failed 4 tests, which exposed the renter query-rewrite race (see Deviations 2). They passed after the fix.
- Full E2E in 8 shards (all projects): 265+2F / 371+1F / 123 / 331 / 178 / 372 / 132 / 253, so 2025 passed and 3 failed:
  - `agent-contact.spec.ts:351` and `agent-followup.spec.ts:169` (root) passed 3/3 each in isolation. These are load flakes.
  - `guide.spec.ts:107` (root) is the known guide flake logged by 10-13 and 10-14. It also failed 1 of 3 isolated repeats, timing out on "Agent Start the tour", which is unrelated to this plan's href change. It stays with 10-23.
- `pnpm test:unit`: 6254 passed and 2 failed. The failures were the known load flakes `ResultsView.browser.test.ts` and `scripts/precommit.test.ts`. Re-run in isolation together with `DataShell.browser.test.ts`: 35/35 passed.
- Budget, `assert-budget --require-tools`, initial JS in KB gz for build / sub / configured:
  - Tool pages are 59.4-59.7 and all PASS. On configured they are affordability 59.6, cap-rate 59.5, cash-on-cash 59.7 and dscr 59.7, about 0.1-0.2 KB more than 10-14's figures. A new route adds an entry to the client route manifest that every page loads.
  - Landing (report-only): 58.4 / 58.5 / 58.6.
  - Headroom on configured is now about 0.3 KB.

## Axe coverage (10-22 naming contract)

`tests/e2e/setup-rentcast.spec.ts` runs WCAG 2.0/2.1/2.2 A/AA on root and sub, in the three UI-SPEC states:
- `axe setup: no key …`
- `axe setup: saved untested key …`
- `axe setup: tested key …`

`setup/rentcast/` is also in APP_ROUTES, so the keyless route sweeps (a11y, seo, layout, routing) cover it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prerender entry for the new route**
- **Issue:** `handleUnseenRoutes: 'fail'`, and the only link to `/setup/rentcast/` is client-rendered (the tour step). The Settings link arrives in 10-18.
- **Fix:** Added `'/setup/rentcast/'` to `prerender.entries` in svelte.config.js. This is a one-line, commented change. The CSP wiring is untouched, and csp:assert passes on all 3 targets.
- **Commit:** 73dc569

**2. [Rule 1 - Bug] Hand-off read the param too late; DataShell runtime not reachable from the layout**
- **Issue:** The plan's sketch has the layout `onMount` call a data-source writer, but the runtime is created in DataShell, the layout's child. Reading `location` once the runtime was ready also missed `/renter/`, because its search page rewrites the query first. The E2E caught both problems: the status bar stayed live, and the in-app link produced no announcement.
- **Fix:** Added a DataShell `onStart(runtime)` prop, and DataShell awaits it before the check-on-open pass. The layout reads the param from `page.url` at init and from `nav.to.url` in afterNavigate. It then waits for the runtime and calls `setSourcePreference('sample')`. On `/agent/` it dynamically imports `hasAnyContacts`/`loadSampleContacts`. Finally it does `replaceState` on the current URL minus `source`, then `announce`.
- **Files:** `(app)/+layout.svelte`, DataShell.svelte
- **Commit:** 7245498

**3. [Rule 2 - Missing functionality] Cap-saved signal**
- **Issue:** Routes may import only from `$lib/data`, and nothing there exposed whether the cap row exists.
- **Fix:** Added `hasSavedCap(db)` in ledger-repo.ts, exported it, and added a unit test.
- **Commit:** ea18300

**4. [Rule 1 - Test semantics] layout.spec "prerendered HTML marks the current portal"**
- **Issue:** This test iterates every (app) route, but the setup page is not a switcher destination, so nothing in it is marked.
- **Fix:** The setup page is now skipped there. It stays in APP_ROUTES/PORTAL_ROUTES, which also means "the header shows the Settings link", and that holds.
- **Commit:** 7245498

**5. Acceptance-grep note:** The page strings (`Create a key just for Tran`, etc.) live in `SETUP_COPY` (content/onboarding.ts), not as literals in `+page.svelte`. The prerendered HTML contains them all, and the E2E asserts this. `(opens external site)`, `https://app.rentcast.io/app/api`, `writeOnboarding(`, `Checking this browser` and `/(app)/setup/rentcast`, `consumeSampleParam`, `replaceState` and `Showing sample data.` are literal in the files the plan names. `app.rentcast.io` was already in `EXTERNAL_HOSTS`.

**6. The two new specs** (`setup-rentcast.spec.ts`, `sample-handoff.spec.ts`) are not in `files_modified`. The orchestrator asked for setup axe tests under the 10-22 contract.

## Known Stubs / Limitations

- ProviderKeyCard is embedded unchanged, so after hydration its "RentCast usage" pointer (`#rentcast-usage`) and its locked-state "Key security" link (`#key-security`) target ids that exist only on Settings. They do nothing on the setup page. This is logged in deferred-items.md. The page's own storage line links correctly to `/settings/#key-security`.
- The step 2 badge depends on the in-memory key-test result (Phase 4 does not persist it), so after a reload it shows To do until the key is re-tested.

## Self-Check: PASSED

- All 5 created files exist on disk.
- Commits be0f9be, 9b328e9, ea18300, 73dc569 and 7245498 are present in `git log`.
