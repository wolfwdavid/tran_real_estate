---
phase: 03-local-platform-storage-key-vault-backup
plan: 12
subsystem: ui
tags: [settings, key-security, passphrase-lock, radio-group, dialog, cooldown, indexeddb, playwright, a11y]

requires:
  - phase: 03-07
    provides: Vault setPassphrase/unlock/lock/changePassphrase/removePassphrase, cooldown math, status.hasLock/locked/cooldownUntil
  - phase: 03-10
    provides: settings context, announce(), SecretInput, ForgetAllDialog, SectionError, E2E helpers
  - phase: 03-11
    provides: ProviderKeyCard locked state and badges
provides:
  - KeyStorageMode radio group (This tab only (default) / Remember on this device) with the locked-mode guard
  - PassphraseLock (no lock / locked with persisted cooldown countdown and forgot path / unlocked with Lock now, Change, Remove)
  - PassphraseDialog (set / change) with submit-only validation
  - HonestyCallout (three passphrase statements, prerendered)
  - settings-security.spec.ts (PLAT-02 remember + PLAT-03 lock E2E, 11 tests x 2 bases)
affects: [03-15, 04, 05]

tech-stack:
  added: []
  patterns:
    - "Caller-owned dialogs: PassphraseDialog has no trigger; PassphraseLock renders it outside its state branches so a successful set (which swaps the branch) cannot unmount it mid-close"
    - "Cooldown derived from max(attempt result, persisted status.cooldownUntil) and a 1 s interval; aria-live=off countdown, start/end announced once"
    - "VaultError codes read structurally (err.code) so the vault stays out of the prerender graph"

key-files:
  created:
    - apps/web/src/lib/features/shared/settings/KeyStorageMode.svelte
    - apps/web/src/lib/features/shared/settings/PassphraseLock.svelte
    - apps/web/src/lib/features/shared/settings/PassphraseDialog.svelte
    - apps/web/src/lib/features/shared/settings/HonestyCallout.svelte
    - apps/web/tests/e2e/settings-security.spec.ts
  modified:
    - apps/web/src/lib/features/shared/settings/KeySecuritySection.svelte

key-decisions:
  - "HonestyCallout renders outside the ctx.ready guard: it is static copy, so it prerenders (mode controls and lock still wait on hydration)"
  - "Radio items use aria-labelledby (title) + aria-describedby (description) so the accessible names are exactly 'This tab only (default)' / 'Remember on this device'"
  - "A cooldown result from an unlock attempt also shows the wrong-passphrase field error (the 5th attempt was wrong)"
  - "Focus after state swaps: unlock / set success / remove -> #key-security-heading; Lock now -> the unlock passphrase input; cancelled dialog -> its opening button"

patterns-established:
  - "Raw IndexedDB at-rest assertion: page.evaluate opens tran-secrets without Dexie, serializes Uint8Array as arrays, and the Node side greps the JSON for planted secrets"

requirements-completed: [PLAT-02, PLAT-03]

duration: 30min
completed: 2026-10-04
---

# Phase 3 Plan 12: Key Security Section Summary

**Key security now offers "This tab only (default)" or "Remember on this device" (the switch applies immediately, is announced, and asks for persistent storage inside the click), plus an optional passphrase lock. The lock has three states: none, locked (unlock form with a reload-proof cooldown countdown and an honest forgot path), and unlocked (Lock now, Change passphrase, Remove passphrase). An honesty callout says what the passphrase does and doesn't protect. E2E proves encryption at rest by reading raw IndexedDB, and proves keys are locked after reopening, on both bases.**

## Performance

- **Duration:** about 30 min
- **Completed:** 2026-10-04
- **Tasks:** 2
- **Files:** 5 created, 1 modified

## Accomplishments

- **KeyStorageMode:** `<fieldset>` with the legend "Where to keep your keys" and a bits-ui radio group bound to the vault mode. It follows remote mode changes whenever no switch is in flight. Choosing remember calls `requestPersistence()` synchronously before `vault.setMode('remember')`.
  - A `vault-locked` refusal reverts the radio, announces the locked line and focuses `#unlock-passphrase`.
  - A `storage-blocked` refusal reverts the radio and shows the storage-blocked SectionError.
  - When `ctx.storageBlocked` is true, the remember option is disabled.
- **PassphraseDialog:** set and change modes.
  - Validation runs on submit only, in field order, and focuses the first invalid field.
  - Every passphrase value is cleared after each attempt.
  - A wrong current passphrase gets a field error and focus.
  - The busy labels are "Locking…" and "Changing…".
- **PassphraseLock:** all three UI-SPEC states.
  - The countdown is `<p aria-live="off">` and re-derives from `status.cooldownUntil` on mount, so it survives a reload.
  - Only the start and end of a cooldown are announced.
  - Input and Unlock are `disabled` during a cooldown, and Unlock also gets `aria-disabled="true"`.
- **HonestyCallout:** an info Alert with `role={null}`, a ShieldCheck icon, an h3 and the three statements verbatim.

## Task Commits

1. **Task 1: key security section with storage mode and passphrase lock** - `547f1d1` (feat)
2. **Task 2: key security E2E for remember, lock-at-rest and cooldown** - `dcb778a` (test)

## Mutation proof

I changed `Vault.setPassphrase` to write plaintext rows (`rows.push({ provider, value })` instead of the sealed `box`) and rebuilt root. `settings-security` "set passphrase validates on submit and encrypts every key at rest" then **FAILED**: the raw IndexedDB JSON contained the planted `sk-ant-…` key. I restored the line with `git checkout -- vault.ts` (diff empty) and rebuilt both bases. The full suite passed afterwards.

## Verification

- `check` (0 errors, 1405 files), `lint` (repo-wide prettier and eslint), `banned` and `ui:guard` all pass.
- `build:root`, `build:sub` and `csp:assert` pass for 14 pages on each base.
- `playwright test settings-security`: **22/22 passed** (11 tests × root and sub) on the first run.
- Full `test:e2e`: **426 passed, 2 skipped, 0 failed**. The known flakes (`layout.spec`, `settings-keys` cross-tab forget) did not recur.
- Every acceptance literal is present, including `indexedDB.open('tran-secrets')`, `600000`, `page.clock.install`, `fastForward`, `Too many attempts. You can try again in 30 seconds.`, `Your keys were locked in another Tran tab.` and `Forgot your passphrase?`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dialog would unmount before closing after a successful set**
- **Found during:** Task 1 design. This is the same failure mode 03-11 hit with ForgetAllDialog.
- **Issue:** A trigger-owned dialog inside the "no lock" branch unmounts as soon as `setPassphrase` flips `hasLock`.
- **Fix:** PassphraseDialog takes `open` (bindable), `returnFocusId` and `successFocusId`. PassphraseLock renders both dialogs outside its state branches, and `onCloseAutoFocus` moves focus deliberately.
- **Commit:** 547f1d1

**2. [Rule 2 - Robustness] Copy for unexpected failures**
- The plan gave no copy for non-validation failures, so I added:
  - Set: "Couldn't add the passphrase in this browser. Try again."
  - Change: "Couldn't change the passphrase in this browser. Try again."
  - Unlock: "Couldn't unlock your keys in this browser. Try again."
  - Mode switch: "Couldn't change where your keys are kept. Try again." (announced)
- None of these contain secret material. This follows the 03-11 precedent.
- **Commit:** 547f1d1

**3. Formatting scope:** an executor was running in parallel, so Prettier ran only on this plan's files. Repo-wide `prettier --check` still passes.

## Known Stubs

None.

## Self-Check: PASSED
