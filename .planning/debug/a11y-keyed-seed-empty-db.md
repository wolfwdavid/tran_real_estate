---
status: resolved
trigger: "CI-only flake [sub] a11y-keyed.spec.ts:150 agent/profile/: seedDueSearch read an empty store list (run 43669219058)"
created: 2026-11-14T22:05:00-05:00
updated: 2026-11-14T23:10:00-05:00
---

## Current Focus

hypothesis: confirmed (see Resolution)
next_action: none. Resolved: fix a29fd53, verified on CI run 43673499633

## Symptoms

expected: seedDueSearch finds the app database at its current schema (savedSearches present)
actual: indexedDB.open('tran') returned objectStoreNames [] on the first attempt; the retry passed
errors: "Error: app database is open before seeding / Expected value: \"savedSearches\" / Received array: []"
reproduction: CI only, sub project, once in 1149 tests (run 43669219058)
started: first seen on the Kit 3 pushes; zero flakes in 14 green Kit 2 runs

## Eliminated

- hypothesis: databases() lists the DB while Dexie's first upgrade is in flight
  evidence: raw-IDB experiment in Chromium 153 (versionchange held 300 ms): databases() and a version-less open both resolve only after the upgrade commits; 21/21 stores every run
- hypothesis: Dexie close/reopen or the "Workaround for Chrome UnknownError" path
  evidence: the trace console has only "Service Worker registration blocked by Playwright"; Dexie warns on that path
- hypothesis: chunk 404 on the sub base path
  evidence: every request in 1-trace.network is 200

## Evidence

- checked: Playwright 1.63 waitForFunctionExpression (playwright-core lib/coreBundle.js:24409-24417)
  found: `const success = predicate(); if (success) fulfill(success)` with no await; an async predicate returns a Promise, which is truthy
  implication: the seed's `waitForFunction(async () => (await indexedDB.databases()).some(...))` never waited; probe: `waitForFunction(async () => false)` resolved in 49-67 ms with a 2000 ms timeout
- checked: CI trace 1-trace.trace / 1-trace.network
  found: goto load at 56497; waitForFunction 56536-56548; version-less open returned {"a":[]} at 56551.9; nodes/1.CzOBoduV.js (root error page) requested at 56522, its static deps KOWm-kC9.js at 56559 and DPSEbxti.js at 56571; error-context snapshot still shows "Loading your contacts…"
  implication: the app had not hydrated (so had not opened 'tran') when the test opened it; the test's version-less open created an empty version 1
- checked: Kit 3.1.1 client.js:500 vs Kit 2.70.3 client.js:368-369
  found: Kit 3 `await Promise.all([default_layout_loader(), default_error_loader()])` before hydrating; Kit 2 `void default_error_loader()`; the error node and its deps are not modulepreloaded
  implication: under Kit 3 hydration can start after the load event on a slow runner; the no-op wait (present since 10-21) became reachable
- checked: delayed reproduction (route delay 500 ms on nodes/1.)
  found: old spec 13/13 agent routes fail with "Received array: []"; new spec 13/13 pass
  implication: mechanism confirmed

## Resolution

root_cause: seedDueSearch's waitForFunction used an async predicate, which Playwright does not await, so the seed only waited for goto's load event. Kit 3 awaits the root error node (not modulepreloaded) before hydrating, so on a slow runner the app's first Dexie open lands after load; the test's version-less indexedDB.open('tran') then ran first and created an empty version 1.
fix: wait for the agent home's "Loading your contacts" line to go (the live query has read the database at the current schema), the repo's existing readiness signal (agent-helpers.ts openContactsReady)
verification: delayed repro 13 red -> 13 green; a11y-keyed sub under 12-thread load 135 + 360 passed; check, lint, test:unit 7384 passed; full sub E2E (see report)
files_changed: [apps/web/tests/e2e/a11y-keyed.spec.ts]
