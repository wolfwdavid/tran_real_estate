---
phase: 03-local-platform-storage-key-vault-backup
plan: 11
subsystem: ui
tags: [settings, api-keys, vault, byok, a11y, playwright, broadcastchannel]

requires:
  - phase: 03-10
    provides: settings shell, settings-context, SecretInput, ForgetAllDialog, announce(), E2E helpers
  - phase: 03-04
    provides: Vault (setKey/removeKey/getKey/forgetAll/onChange), VaultStatus, KeyState
  - phase: 03-07
    provides: lock state (status.locked, provider state 'locked'), key tester registry
  - phase: 03-01
    provides: PROVIDERS registry (label, host, keyUrl, note), fakeKey
provides:
  - ProviderKeyCard (article#key-{provider}) with entry form / saved summary / locked state / tester-gated Test key
  - KeyStatusBadge (Not added / Saved for this session / Remembered on this device / Locked)
  - ApiKeysSection body (empty state, five cards, Forget all footer)
  - settings-keys.spec.ts (PLAT-01 / PLAT-02 E2E)
affects: [03-12, 04, 05]

tech-stack:
  added: []
  patterns:
    - "Raw key lives only in the card's bound input value between entry and Save; cleared on every save outcome"
    - "Testers and persistence modules are imported statically (browser-safe, no vault/Dexie); the vault arrives via ctx"

key-files:
  created:
    - apps/web/src/lib/features/shared/settings/ProviderKeyCard.svelte
    - apps/web/src/lib/features/shared/settings/KeyStatusBadge.svelte
    - apps/web/tests/e2e/settings-keys.spec.ts
  modified:
    - apps/web/src/lib/features/shared/settings/ApiKeysSection.svelte
    - apps/web/tests/e2e/routes.ts

key-decisions:
  - "ApiKeysSection focuses #api-keys-heading on a LOCAL vault 'forgotten' event (after tick): a confirmed forget empties the vault, which unmounts the footer's ForgetAllDialog before its onCloseAutoFocus can run"
  - "OpenAI keyUrl kept: curl got 403 with Cf-Mitigated: challenge (Cloudflare bot check), not a moved page"
  - "Save failures other than validation show 'Couldn't save this key in this browser. Try again.'; a vault-locked failure shows the locked-card line"

patterns-established:
  - "Phase 4/5: registerKeyTester(provider, fn) is enough to make Test key appear on that card; result.message overrides the default line"

requirements-completed: [PLAT-01, PLAT-02]

duration: 25min
completed: 2026-10-04
---

# Phase 3 Plan 11: API Keys Section Summary

**Five provider key cards in fixed order. Each states where its key goes, takes masked entry with Paste and show/hide, shows only the last 4 characters after saving, and supports replace/remove, a locked state and a tester-gated Test key button. A confirmed Forget all clears every open Tran tab. E2E covers the session-only default and the cross-tab forget.**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-10-04
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `ProviderKeyCard` renders `<article id="key-{provider}">` (Phase 5 deep-links to `#key-openrouter`). The card has the header and badge, the "Where this key goes" line with the host in `<code>`, the provider note, and a same-tab "Get a {label} key" link. It then shows one of three states:
  - **Entry form:** `SecretInput`, Paste (only when `navigator.clipboard.readText` exists) and Save key, with a "Saving…" spinner.
  - **Saved summary:** "Key ending in {last4}" with Test key (only when `hasKeyTester`), Replace key (focuses the input) and Remove key (announced).
  - **Locked:** a link to `#key-security`, with no input and no last4.
- Save calls `requestPersistence()` synchronously when the mode is remember, before any await. It also validates against empty input or whitespace and focuses the input. The value is cleared and re-masked on every outcome, and the announcement is "{label} key saved for this tab." or "{label} key saved and remembered on this device."
- `ApiKeysSection` shows the "No keys added yet" empty state, the five cards, and the Forget all footer: the dialog when any key exists, otherwise "No keys are stored in this browser."
- `EXTERNAL_HOSTS` gained `app.rentcast.io`, `platform.claude.com`, `platform.openai.com` and `aistudio.google.com`. `openrouter.ai` was already listed.

## Task Commits

1. **Task 1: API keys section with provider key cards** - `465ce49` (feat)
2. **Task 2: API keys E2E** - `3e119ec` (test)

## Key URL check (2026-10-04, `curl -sIL`)

| URL | Result |
|-----|--------|
| https://app.rentcast.io/app/api | 200 |
| https://platform.claude.com/settings/keys | 200 |
| https://platform.openai.com/api-keys | 403 `Cf-Mitigated: challenge` (Cloudflare bot check on curl; the page exists; URL kept) |
| https://aistudio.google.com/apikey | 200 |
| https://openrouter.ai/settings/keys | 200 |

## Mutation proof

I commented out `this.#post('forget-all')` in `Vault.forgetAll()` and rebuilt root. Test 9 ("Forget all in one tab clears every other open Tran tab") then **failed**: tab B never showed "Not added". I restored the line with `git checkout -- vault.ts` and rebuilt, and test 9 passed again.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Focus was lost after a confirmed Forget all**
- **Found during:** Task 2 (test 8)
- **Issue:** `ForgetAllDialog` sits inside the footer's `{#if anyKey}` branch. When `forgetAll()` resolves, the vault status flips to no keys and the dialog unmounts before its `onCloseAutoFocus` handler runs, so focus fell back to `<body>`.
- **Fix:** `ApiKeysSection` subscribes to `vault.onChange`. On a local (non-remote) `forgotten` event it waits for `tick()` and then focuses `#api-keys-heading`. Other tabs' forgets never move focus.
- **Files modified:** ApiKeysSection.svelte
- **Commit:** `465ce49`

**2. [Rule 3 - Lint] External `href` vs `svelte/no-navigation-without-resolve`**
- The "Get a key" link is wrapped in a scoped eslint-disable/enable comment pair. This follows the existing `ButtonLink` and `PortalCard` pattern, because `keyUrl` is an off-site https URL.
- **Commit:** `465ce49`

**3. Minor copy addition:** the plan gave no copy for a non-validation save failure. It now reads "Couldn't save this key in this browser. Try again.", or the locked line when the vault is locked. The message never contains key material.

## Verification

- `check`: the only error is in sibling 03-13's in-progress `BackupImport.svelte` (missing `./ImportPreview.svelte` at the time). That is out of scope. This plan's files have 0 errors.
- `lint` (prettier and eslint on this plan's files), `banned` and `ui:guard` pass.
- `build:root`, `build:sub` and `csp:assert` pass for 14 pages on each base.
- `playwright test settings-keys routing settings-shell` passes 46/46 on root and sub.
- Full `test:e2e`: 384 passed, 2 skipped, 8 failed. All 8 failures are in sibling 03-13's untracked in-progress `settings-backup.spec.ts` (the `import-result` "Import complete." assertions), which this plan does not touch.
- `grep -cE "sk-ant-|AIza|sk-proj-" settings-keys.spec.ts` returns 0. `target=` and `console.` each appear 0 times in ProviderKeyCard.svelte.

## Known Stubs

None. The Test key button stays hidden by design until Phases 4 and 5 register testers.

## Self-Check: PASSED
