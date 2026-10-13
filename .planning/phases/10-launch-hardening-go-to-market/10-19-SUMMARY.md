---
phase: 10-launch-hardening-go-to-market
plan: 19
subsystem: analytics-privacy-gtm
tags: [analytics, umami, privacy, web3forms, e2e, csp, budget]
requires: [10-05, 10-06, 10-11, 10-17]
provides:
  - root layout pageview wiring (afterNavigate -> lib/analytics createTracker), compiled out of builds without an analytics host
  - privacy page "Usage counts" (configured / not-configured variants) and Web3Forms forms disclosure
  - LegalPage optional `updated` prop
  - DEPLOY-CHECKLIST Step 8 (Umami, Web3Forms, contact email, Search Console, share cards, Dependabot, cut line)
  - third-party.spec.ts, analytics.configured.spec.ts, helpers/beacons.ts
  - collector records userAgent; POST /__beacons/reset?ua=<tag> clears only tagged entries
affects: [10-18, 10-21, 10-22, 10-23]
tech-stack:
  added: []
  patterns:
    - "Build-time gate on the define globals (`if (__ANALYTICS_HOST__ && __ANALYTICS_WEBSITE_ID__)`) so the bundler removes optional features from the default build"
    - "Beacon specs tag their browser user agent and read/reset only their own collector entries"
key-files:
  created:
    - apps/web/tests/e2e/third-party.spec.ts
    - apps/web/tests/e2e/analytics.configured.spec.ts
    - apps/web/tests/e2e/helpers/beacons.ts
    - .planning/phases/10-launch-hardening-go-to-market/deferred-items.md
  modified:
    - apps/web/src/routes/+layout.svelte
    - apps/web/src/routes/(marketing)/legal/privacy/+page.svelte
    - apps/web/src/lib/components/legal/LegalPage.svelte
    - apps/web/tests/e2e/marketing.spec.ts
    - apps/web/tests/e2e/harness.configured.spec.ts
    - scripts/serve-pages.mjs
    - docs/DEPLOY-CHECKLIST.md
decisions:
  - "The layout gates the tracker on the compile-time defines and lazy-imports both lib/analytics/beacon and lib/site inside the gate. The default build contains no tracker code at all (no `api/send` string anywhere in build/ or build-sub/). Cost: about 15 B gz per route."
  - "Privacy Variant A does not say 'a server we operate' (UI-SPEC wording). The owner may use Umami Cloud, so that would not be true. It says 'Counts go to Tran's Umami counter at {host}, not to an ad company' and names the exact host from the build."
  - "The forms disclosure was checked against 10-17-SUMMARY 'Data sent by the waitlist'. It says that nothing is sent until submit, that each message is labeled with its form (subject/portal), that nothing else on the page is sent, and that the request reaches Web3Forms with the visitor's IP address and browser type."
  - "The beacon collector is shared across workers, and every configured page load now sends a beacon. Specs therefore tag their user agent and use a tag-scoped reset instead of a global reset. The harness spec was moved to the same pattern so it can't race with page-load beacons."
requirements: [GTM-02, GTM-04]
metrics:
  duration: ~95 min (including two network outages)
  completed: 2026-10-13
  tasks: 3
  files: 11
---

# Phase 10 Plan 19: First-party Beacon, Privacy Truth and Go-live Steps Summary

When a build has an analytics host and website id, it sends one Umami pageview per navigation with no cookie, referrer or preflight, and it honors GPC and DNT. The default build compiles the tracker out entirely. The privacy page shows the variant that matches the build and discloses the Web3Forms forms. DEPLOY-CHECKLIST Step 8 gives the owner the exact go-live and cut-line steps.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Beacon wiring, privacy variants, forms disclosure | 7da72e6, f052dc8 (wording fix after 10-17 data flow) | +layout.svelte, privacy/+page.svelte, LegalPage.svelte, marketing.spec.ts (my hunks only) |
| 2 | Owner go-live steps | 3285942 | docs/DEPLOY-CHECKLIST.md |
| 3 | Third-party and beacon E2E | 61bb0c8 | third-party.spec.ts, analytics.configured.spec.ts, helpers/beacons.ts, harness.configured.spec.ts, scripts/serve-pages.mjs |

## Budget (landing-page delta)

I ran an A/B on the same tree, holding the lock: the HEAD layout and then the wired layout, both with `node scripts/assert-budget.mjs apps/web/build --json`:

| Layout variant | index.html JS gz delta | other routes |
| --- | --- | --- |
| First try: `ANALYTICS.host` runtime check + dynamic import | +356 B | +351..361 B |
| Gate on defines, static `$lib/site` import | +132 B | +125..135 B |
| **Final: gate on defines, site + beacon both lazy** | **+14 B** (65561 -> 65575) | +11..17 B |

Absolute numbers moved during the run because other executors were landing code (for example, for-* grew to about 102 KB from 10-17's waitlist). Only the A/B deltas above belong to 10-19. The configured build loads the tracker as a separate lazy chunk. `tools/*` pages already fail the 60 KB gate before my change (63.0-63.2 KB, 10-13's in-flight work). See deferred-items.md.

## Verification (real output)

- `pnpm check`: 0 errors, 0 warnings. `pnpm banned`: passed. `pnpm lint`: exit 0. An earlier run failed only on another executor's untracked onboarding-state.ts.
- `build:root`, `build:sub`, `build:configured`: all exit 0. The plan's node variant check: exit 0. `build-sub` privacy also shows Variant B.
- `pnpm csp:assert`: passed for 42 pages × 3 targets (analytics host none / none / http://127.0.0.1:4275).
- `pnpm test:unit`: 317 files, 6238 tests passed.
- `playwright test analytics harness --project=configured`: 9 passed. `playwright test third-party --project=root --project=sub`: 6 passed.
- **Mutation check:** in beacon.ts I set `credentials: 'include'` and `referrerPolicy: 'unsafe-url'` and removed the consent gate, then rebuilt the configured build. analytics spec: 4 failed (Cookie "tran_probe=1", Referer present, GPC 2 beacons, DNT 2 beacons) and 1 passed (privacy). I restored the file (no diff in lib/analytics), rebuilt, and got 9 passed.
- **Full E2E** in 8 shards: root+configured 239+384+89+236 = 948, sub 230+393+70+227 = 920. That is 1868 tests, with 3 failures, none from 10-19:
  - `agent-inquire.spec.ts:48` (root and sub): duplicate `<meta name="robots" content="noindex">` on agent/inquire/. This is pre-existing from 10-11's (public) layout noindex plus the page's own tag. Logged in deferred-items.md.
  - `investor/autofill.spec.ts:195` (root) and `csp.spec.ts:46` (sub): load flakes, each passed 3/3 on an isolated re-run.

## Privacy text check

The forms paragraph was checked against 10-17-SUMMARY "Data sent by the waitlist":
- "send what you type": the email.
- "Nothing is sent until you submit": nothing is sent on load, on a honeypot trip, or on a too-fast submit.
- "labeled with the form it came from": subject and portal.
- "Nothing else on the page is sent": no UA, URL, query, referrer or analytics id in the body.
- "reaches Web3Forms with your IP address and browser type": the browser's standard headers.

The text does not claim local storage behaviour. The feedback form (10-18) is not built yet. The sentence is general ("what you type", labeled with the form/topic), and 10-18 should keep its body to typed fields plus topic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Privacy Variant A claimed "a server we operate"**
- Untrue if the owner follows Step 8's Umami Cloud path. I replaced it with a sentence that names the configured counter host. Commit 7da72e6.

**2. [Rule 3 - Blocking] marketing.spec.ts pinned every legal page to "4 October 2026"**
- Made it per-route (privacy 13 October 2026). I staged only my hunks with `git apply --cached`; 10-15's hunk is left unstaged. Commit 7da72e6.

**3. [Rule 1 - Bug] Shared beacon collector races**
- With the tracker wired, every configured-build page load (waitlist specs etc.) posts a beacon, so the harness spec's global reset + `toHaveLength(1)`, and the plan's "reset before each test", would race across workers.
- The collector now records `userAgent` and supports `reset?ua=<tag>`. Specs tag their UA and use helpers/beacons.ts. Commit 61bb0c8.

**4. Lazy loading beyond the plan's snippet** (orchestrator budget instruction): the define-gated block plus lazy imports, instead of a top-level `createTracker` call. The plan's acceptance strings (`afterNavigate`, `createTracker(`, `ANALYTICS.host`, `SITE_BASE`) are all present.

**5. Forms paragraph** extends the plan's verbatim sentence with three precise sentences (submit-only, form label, IP/browser type), per the orchestrator's 10-17 data flow. Commit f052dc8.

**6. Step 8 wording:** I wrote "Apply the cut line" rather than a "Cut line." heading so that the plan's case-sensitive `cut line` check matches.

## Known Stubs

None. Variant B ("Tran doesn't count visits right now") is the intended copy for the no-host build, not a stub.

## Handoffs

- 10-18 (feedback): the privacy page already covers the feedback form. Keep its Web3Forms body to typed fields + topic (+ fixed subject/from_name/botcheck), or update the privacy paragraph.
- Beacon/collector specs: use `helpers/beacons.ts` (`beaconTag`, `beaconsFor`, `resetBeacons`) and never call the global `/__beacons/reset`.
- HUMAN-UAT: Umami IP-storage confirmation, live-origin pageview check with and without GPC, and the cut-line decision (DEPLOY-CHECKLIST Step 8.1).

## Self-Check: PASSED

- FOUND: third-party.spec.ts, analytics.configured.spec.ts, helpers/beacons.ts, deferred-items.md
- FOUND commits: 7da72e6, 3285942, f052dc8, 61bb0c8
