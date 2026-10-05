---
phase: 03-local-platform-storage-key-vault-backup
plan: 14
subsystem: settings
tags: [pwa, storage-api, persist, install, settings, e2e]
requires:
  - phase: 03-03
    provides: static/pwa-capture.js (window.__tranInstallPrompt, tran:installable / tran:installed)
  - phase: 03-05
    provides: requestPersistence (sync-first), persistenceStatus, storageEstimate, formatBytes
  - phase: 03-10
    provides: settings context, announce(), StorageSection/InstallSection stubs, CSP probe, E2E helpers
provides:
  - lib/pwa/detect.ts (isIos, isStandalone)
  - lib/pwa/install.svelte.ts (createInstallState → { state, install(), dispose() })
  - StorageStatus.svelte (Persistent storage / Space used / Last backup dl + Ask the browser again)
  - InstallApp.svelte (installable / ios / installed / unsupported)
affects: [03-17 human UAT (real-device install), later phases calling requestPersistence]
tech-stack:
  added: []
  patterns:
    - "Storage-status reads in onMount after ctx.ready; Dexie/@tran/core loaded by dynamic import, persistence.ts statically so persist() is the handler's first call"
    - "Install state is a $state rune factory over window globals + custom events, created in onMount and disposed on destroy"
key-files:
  created:
    - apps/web/src/lib/pwa/detect.ts
    - apps/web/src/lib/pwa/detect.test.ts
    - apps/web/src/lib/pwa/install.svelte.ts
    - apps/web/src/lib/features/shared/settings/StorageStatus.svelte
    - apps/web/src/lib/features/shared/settings/InstallApp.svelte
    - apps/web/tests/e2e/settings-storage.spec.ts
    - apps/web/tests/e2e/settings-install.spec.ts
  modified:
    - apps/web/src/lib/features/shared/settings/StorageSection.svelte
    - apps/web/src/lib/features/shared/settings/InstallSection.svelte
key-decisions:
  - "An accepted install prompt announces 'Tran was installed.' once; the section switches to the installed state only when the browser's appinstalled arrives (relayed as tran:installed), with a dedupe flag so it is not announced twice"
  - "persistence.ts is a static import (dependency-free) so requestPersistence() is literally the first statement of the Ask handler; live/meta/@tran/core stay dynamic imports to keep Dexie out of the prerendered graph"
  - "Last backup row is omitted when site storage is blocked (ctx.db null) rather than showing a made-up 'Never'"
patterns-established:
  - "E2E persist() call counting: an init script registered after stubStorage wraps navigator.storage.persist"
requirements-completed: [PLAT-05, PLAT-06]
duration: 30min
completed: 2026-10-04
---

# Phase 3 Plan 14: Storage Status and Install Sections Summary

**Honest persistent-storage badge with a sync-first "Ask the browser again", browser-estimate space line and last-backup row, plus a four-state Install section that catches the pre-hydration install prompt through pwa-capture.js.**

## Performance

- **Duration:** about 30 min
- **Completed:** 2026-10-04
- **Tasks:** 2
- **Files:** 9 (7 created, 2 modified)

## Accomplishments

- `isIos` (UA plus the iPadOS `MacIntel` + `maxTouchPoints > 1` case) and `isStandalone` (`(display-mode: standalone)` or `navigator.standalone === true`), with 7 unit tests.
- `createInstallState(win)` picks the first state that applies, in this order: installed, installable (`__tranInstallPrompt`), ios, unsupported. It listens for `tran:installable` and `tran:installed`. `install()` calls `prompt()`, awaits `userChoice`, and on `accepted` clears the global and announces.
- `StorageStatus`: badge Granted / Not granted / Not reported, using the verbatim explanations. **Ask the browser again** shows **Asking…** while it waits, updates the badge, announces the result, and shows the "The browser said no." line when the browser refuses. The space row reads "About X of Y" and is hidden when `estimate()` is unavailable. The last-backup row shows Never / Today / Yesterday / N days ago from a Dexie `live()` query, with a link to `#backup`.
- `StorageSection` keeps the CSP probe markup byte-identical. `StorageStatus` replaces "Checking this browser…" once `ctx.ready` is true.
- `InstallApp` renders exactly one state: the **Install app** button (primary, `MonitorDown`), the three-step iOS `<ol>` with an inline `Share` icon, the installed confirmation (`CircleCheck` secondary), or the honest unsupported copy.

## Task Commits

1. **Task 1 RED: PWA detection tests** - `db26aa2` (test)
2. **Task 1 GREEN: storage status and install sections** - `14ec6dc` (feat)
3. **Task 2: storage status and install E2E** - `e96ec6a` (test)

## Verification

- `pnpm vitest run --project web pwa/detect`: 7/7. `pnpm test:unit`: 566/566. `pnpm check`: 0 errors. eslint and prettier pass on the plan's files. `banned` and `ui:guard` pass.
- `build:root`, `build:sub` and `csp:assert` pass (14 pages on each base).
- `playwright test settings-storage settings-install csp`: 26/26 on root and sub. That includes the Phase 1 CSP transition probe.
- Full `pnpm test:e2e`: 392/392.
- **Mutation proof (pwa-capture removal):** I deleted the `pwa-capture.js` `<script>` from `app.html`, rebuilt root, and ran the installable test. It **failed** (`Install app` button not found), because the synthetic `beforeinstallprompt` fired at DOMContentLoaded, before hydration, and nothing caught it. I then restored `app.html` (git diff empty), rebuilt, and ran the full suite: green.

## Deviations from Plan

None. The plan was executed as written. The only interpretation call: `install()` announces on `accepted` but does not switch the state, because the plan routes the installed state through `tran:installed`. A dedupe flag prevents a second announcement when `appinstalled` follows.

## Known Stubs

None. Real-device install remains a HUMAN-UAT item (03-17).

## Self-Check: PASSED
