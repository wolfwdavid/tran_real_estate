---
status: deferred
phase: 03-local-platform-storage-key-vault-backup
source: [03-VALIDATION.md "Manual-Only Verifications", 03-RESEARCH.md Pattern 6 / Pattern 7 / Pitfall 6]
started: 2026-10-05
updated: 2026-10-05
blocking: false
---

# Phase 3: Real-device UAT (deferred)

**Status: deferred until the `tranrealestate.github.io` origin exists.** These checks are
non-blocking per the owner instruction of 2026-09-13 ("keep going" without the org or domain).
Every behaviour below is already covered by automation on both base paths (root and
`/tran_real_estate`) with synthetic stubs: install states, persist() stubs, offline service
worker, manifest via CDP, iOS detection. What automation cannot reach is real browser chrome:
the install prompt, the Home Screen, permission prompts and real eviction heuristics.

Run these after `docs/DEPLOY-CHECKLIST.md` Steps 1-7 are done (org, repo, push, Pages source,
`PAGES_ENABLED`, live-origin checks). Do not edit DEPLOY-CHECKLIST for these; record the
evidence here.

**Where to record evidence:** fill the `result:` line of each item with `pass` / `fail`, the
date, the device and browser version, and a screenshot filename. Store screenshots under
`.planning/phases/03-local-platform-storage-key-vault-backup/uat-evidence/` (create it when
the first item is run). Never capture a real API key in a screenshot.

## Current Test

[awaiting the live origin; all items are device-gated, none is a code gap]

## Tests

### 1. Android Chrome: install and launch standalone
steps:
1. On an Android phone, open `https://tranrealestate.github.io/settings/` in Chrome.
2. In Settings, go to the "Install the app" section and tap **Install app**.
3. Confirm the browser's install dialog ("Install app" / "Install").
4. Open the new icon from the home screen.
5. In the installed app, open Settings again.
expected: The icon is on the home screen; the app launches standalone (no URL bar); Settings shows "Tran is installed on this device. You're using the installed app."
why human: Headless Chromium never fires a real `beforeinstallprompt` and cannot install (PLAT-06).
result: [pending]

### 2. Desktop Chrome / Edge: install and launch in its own window
steps:
1. On Windows or macOS, open `https://tranrealestate.github.io/settings/` in Chrome, then repeat in Edge.
2. Click **Install app** in the "Install the app" section and confirm the browser dialog.
3. Launch the installed app from the Start menu / Dock / app launcher.
expected: The app opens in its own window without browser tabs or URL bar; Settings shows the installed state.
why human: Real install UI is browser chrome (PLAT-06).
result: [pending]

### 3. iPhone Safari (iOS 17+): Add to Home Screen
Note: on iOS 26, sites added to the Home Screen open as web apps by default.
steps:
1. On an iPhone, open `https://tranrealestate.github.io/settings/` in Safari.
2. Confirm Settings shows the three Add to Home Screen steps and no Install button.
3. Tap **Share**, then **Add to Home Screen**, then **Add**.
4. Look at the icon on the Home Screen, then open it.
5. Open Settings inside the launched app.
expected: The icon is the cream "T" on terracotta; the app launches standalone (no Safari toolbar); Settings then shows the installed state.
why human: Requires real iOS Safari and its Home Screen (PLAT-06).
result: [pending]

### 4. iPad (desktop user agent): iOS steps still shown
steps:
1. On an iPad with Safari's default "Request Desktop Website" behaviour, open `https://tranrealestate.github.io/settings/`.
2. Scroll to "Install the app".
expected: Settings shows the iOS Add to Home Screen steps (iPadOS reports `MacIntel` with touch points, and the detection treats it as iOS), not the desktop "unsupported" copy.
why human: Real iPadOS user agent and touch reporting (PLAT-06).
result: [pending]

### 5. Firefox desktop: persistent-storage permission prompt
steps:
1. In a fresh Firefox profile, open `https://tranrealestate.github.io/settings/`.
2. Add a dedicated test key, then switch key storage to **Remember on this device**.
3. Watch for Firefox's persistent-storage permission prompt (doorhanger next to the address bar).
4. Click **Allow**, then look at the Storage section.
expected: Firefox shows a persistent-storage permission prompt immediately on the click (proves `navigator.storage.persist()` is called synchronously inside the user gesture); after Allow, Storage shows "Granted".
why human: The prompt is browser chrome, not page DOM (PLAT-05).
result: [pending]

### 6. Safari: real persistence status
steps:
1. On macOS Safari and on iPhone Safari, open Settings and read the Storage section.
2. Click **Ask the browser again** and note the status.
3. Install to the Home Screen (item 3), open Settings in the installed app and click **Ask the browser again** once more.
expected: Storage shows a real status (granted or not granted, never an error); after installing to the Home Screen, "Ask the browser again" may grant, since WebKit weighs installed web apps more favourably.
why human: WebKit persistence heuristics and real eviction cannot be simulated (PLAT-05).
result: [pending]

### 7. Offline launch on a real device
steps:
1. Install the app on a phone (item 1 or 3) and open it once while online; visit the home page and one portal page.
2. Turn on airplane mode.
3. Fully close the app, then launch it from the Home Screen.
4. Open the home page, then `/renter/`, `/investor/` and `/agent/`.
expected: In airplane mode the home and portal pages render from the service worker cache; no browser offline error page appears.
why human: Real device offline behaviour and OS-level app lifecycle (PLAT-06).
result: [pending]

### 8. Firefox session restore of session keys (accepted limitation)
steps:
1. In Firefox, open Settings and add a dedicated test key with **This tab only** (the default).
2. Close the tab, then use **Reopen Closed Tab** (Ctrl+Shift+T / Cmd+Shift+T).
3. Note whether the key card shows "Key ending in …" again.
4. Click **Forget all keys**, confirm, then repeat step 2.
expected: Record the observation. Firefox session restore may bring back `sessionStorage`, so the key may reappear after step 2; that is an accepted, documented limitation (RESEARCH Pitfall 6). After **Forget all keys**, no key comes back.
why human: Browser session-restore behaviour (PLAT-02).
result: [pending]

### 9. Real-key smoke (optional)
steps:
1. Create a dedicated RentCast key used only for this test.
2. Open DevTools → Network, clear the log, then paste the key in Settings and save.
3. Read the key card, then filter the Network log for `rentcast`.
4. Click **Forget all keys** and revoke the key in the RentCast dashboard afterwards.
expected: The card shows "Key ending in" plus the last 4 characters only; no network request carries the key (Network shows no request to `api.rentcast.io`) until Phase 4 adds the key tester.
why human: Needs a real owner-held key; CI never uses real keys (PLAT-01).
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps

None. Every item is device-gated, not a code gap.
