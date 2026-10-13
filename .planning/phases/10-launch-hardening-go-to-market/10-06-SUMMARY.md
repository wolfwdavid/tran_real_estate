---
phase: 10-launch-hardening-go-to-market
plan: 06
subsystem: analytics
tags: [analytics, privacy, umami, gpc, dnt, beacon, tdd]
requires:
  - phase: 10-03
    provides: lint boundary making lib/analytics/** fetch-allowlisted and marketing-safe
provides:
  - "lib/analytics/payload.ts: SCREEN_CLASSES, screenClass, stripBase, portalOf, referrerOrigin, buildPageview, BeaconBody"
  - "lib/analytics/consent.ts: trackingAllowed(nav, win) (GPC / DNT gate)"
  - "lib/analytics/beacon.ts: send(body, cfg, fetchImpl), createTracker(cfg).pageview(url, referrer, width)"
affects: [10-19]
tech-stack:
  added: []
  patterns:
    - "Pure, injectable analytics: fetch, navigator and window are all parameters; globalThis.fetch is resolved lazily inside send"
    - "CORS-simple no-cors POST with a string body and no headers, so no preflight and no CSP surprises"
key-files:
  created:
    - apps/web/src/lib/analytics/payload.ts
    - apps/web/src/lib/analytics/payload.test.ts
    - apps/web/src/lib/analytics/consent.ts
    - apps/web/src/lib/analytics/consent.test.ts
    - apps/web/src/lib/analytics/beacon.ts
    - apps/web/src/lib/analytics/beacon.test.ts
  modified: []
key-decisions:
  - "Wire format: UI-SPEC path -> Umami url (base stripped, cut at ?/#), portal -> data.portal, referrerHost -> referrer as https://<host>/ (bare host would be dropped by Umami as self-referral, Pitfall 7), screen class -> screen; plus website (site UUID) and hostname, both required by Umami"
  - "Referrer reduced to protocol + hostname only: port, credentials, path, query and fragment are always dropped; same-host and non-http(s) referrers are omitted (key absent)"
  - "No custom named events: pageviews already carry the portal, which is all CONTEXT locks"
  - "Tracker enabled only when BOTH host and websiteId are set; GPC wins over any DNT value"
patterns-established:
  - "Analytics body is built by one function (buildPageview) whose output is pinned by toStrictEqual and a key whitelist test"
requirements-completed: [GTM-04]
duration: 7min
completed: 2026-10-13
---

# Phase 10 Plan 06: First-party analytics beacon Summary

**Umami-compatible pageview beacon as three pure modules: a whitelisted payload (site id, own host, base-stripped path, external origin referrer, screen class, portal), a GPC/DNT gate, and a single no-cors, header-free, credential-free POST that cannot throw**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-10-13T14:07Z
- **Completed:** 2026-10-13T14:14Z
- **Tasks:** 2 (TDD, RED + GREEN each)
- **Files created:** 6

## Accomplishments

- `buildPageview` produces exactly `{ type: 'event', payload: { website, hostname, url, referrer?, screen, data: { portal } } }`, proven by `toStrictEqual`, a key whitelist, a banned-key list (ip, userAgent, id, language, title, timestamp, tag, name), and value-hygiene checks (no `?`, `#`, `@`, or 24+ char token runs in any value except `website`).
- `trackingAllowed` blocks on `globalPrivacyControl === true` or DNT `'1'`/`'yes'` (navigator first, then legacy `window.doNotTrack`).
- `send` is a no-op without a host; otherwise one `fetch(`${host}/api/send`)` with `method POST, mode no-cors, credentials omit, keepalive, referrerPolicy no-referrer, cache no-store`, a JSON string body, no headers; rejected and synchronously thrown errors are swallowed.
- `createTracker` is a no-op unless both host and website id are set and consent allows it.

## Task Commits

1. **Task 1: Payload builder and consent gate**: `c9ba839` (test, RED), `830bf4e` (feat, GREEN)
2. **Task 2: Transport and tracker**: `efa8b5a` (test, RED), `3984501` (feat, GREEN), `d3de562` (refactor: reworded a doc comment so the `grep headers` acceptance check is clean)

## Verification (real output)

- `corepack pnpm vitest run --project web analytics/payload analytics/consent`: 2 files, **48 passed** (acceptance needs >= 20).
- `corepack pnpm vitest run --project web analytics`: 3 files, **59 passed**.
- RED runs failed as expected (module not found) before each GREEN.
- `grep -n "userAgent\|navigator.language\|document.title\|document.cookie"` on payload.ts/consent.ts: no output.
- `grep -n "headers" beacon.ts` and `grep -n "sendBeacon" lib/analytics/*.ts`: no output.
- `prettier --check apps/web/src/lib/analytics/`: clean. `eslint .` (whole repo): exit 0, so the 10-03 analytics boundary holds.
- **`corepack pnpm lint` exit 2 and `corepack pnpm check` exit 1, NOT caused by this plan:** prettier fails on `apps/web/src/lib/seo/jsonld.test.ts` (syntax error) and on untracked `apps/web/build-configured/**`; svelte-check reports 3 errors in `src/lib/seo/og-card.server.test.ts` and `woff.server.test.ts` (modules not yet created). These are in-progress RED files of parallel executors in the same tree (SEO plans), not files of 10-06. svelte-check reported no errors in `lib/analytics`. The orchestrator should re-run `lint` and `check` after the wave.

## Decisions Made

See frontmatter `key-decisions`. The wire-format reconciliation (UI-SPEC logical fields onto Umami `/api/send` keys) is recorded there as the plan requested.

## Deviations from Plan

- Import specifiers use `./payload.js` / `./consent.js` (the repo's existing convention, e.g. `base-path.test.ts`) instead of the extension-less form in the plan snippet. No behaviour change.
- Exported `ConsentNavigator`, `ConsentWindow` and `Tracker` types (tightened typing in place of the inline casts in the plan snippet; no `any`).
- Added a few extra tests beyond the behaviour list: referrer credentials/port stripping, GPC over DNT `'0'`, DNT `'unspecified'`, window-DNT through the tracker, and `send` without an injected fetch (swallows the no-network guard).

**Total deviations:** none of Rules 1-4; the items above are minor implementation choices.

## Issues Encountered

None in plan scope. Repo-wide lint/check failures from parallel executors noted above.

## Known Stubs

None. Wiring into the layout is plan 10-19 by design.

## Next Phase Readiness

10-19 can call `createTracker({ host, websiteId, base })` with values from `lib/site.ts` and `pageview(page.url, document.referrer, innerWidth)` on navigation.

## Self-Check: PASSED

- All 6 files exist under apps/web/src/lib/analytics/.
- Commits c9ba839, 830bf4e, efa8b5a, 3984501, d3de562 present in `git log`.
