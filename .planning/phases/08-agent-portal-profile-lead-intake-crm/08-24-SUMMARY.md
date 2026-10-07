---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 24
subsystem: agent-profile-share-link
tags: [agent, profile, inquiry, web3forms, share-link, svelte5, playwright, axe, clipboard]

# Dependency graph
requires:
  - phase: 08-06
    provides: "@tran/core/leads/inquiry-params InquiryConfig, ACCESS_KEY_RE, inquiryParamPairs; normalize normPhoneUS"
  - phase: 08-12
    provides: "profile-repo saveAccessKey (uuid check, lowercased), live.svelte useProfile()"
  - phase: 08-13
    provides: "lib/leads/inquiry-url buildInquiryUrl / readInquiryParams; public /agent/inquire/ page; agent-helpers (TEST_ACCESS_KEY, mockWeb3Forms, rentcastTripwire, expectAxeClean, expectNoHorizontalScroll, announcer)"
  - phase: 08-16
    provides: "profile page + ProfileForm (draft, dirty baseline effect)"
  - phase: 08-21
    provides: "setup-checklist inquiryConfigFor (home Copy inquiry link, #inquiry-page checklist row)"
  - phase: 08-22
    provides: "profile page layout with brand fieldsets and the sticky previews aside"
provides:
  - "features/agent/profile/share-link.ts: shareLinkBlockers(profile|null) -> ('name'|'brokerage'|'key')[], inquiryConfigFromProfile(profile, { property? }) -> InquiryConfig, MAX_SHARE_PROPERTY, ShareLinkBlocker"
  - "ShareLinkBuilder.svelte { profile: AgentProfile | null }: the 'Your inquiry page' section (<section id=\"inquiry-page\">)"
  - "/agent/profile/ renders the section below the form (outside the <form>) and scrolls to #inquiry-page on load"
  - "tests/e2e/agent-share-link.spec.ts: 6 tests on root and sub"
affects: [08-26 AGT gate (AGT-02 HUMAN-UAT real Web3Forms delivery), agent home Copy inquiry link (same mapping)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Share link built from the SAVED profile only, in a $derived gated on an onMount flag (no location access during prerender)"
    - "A field saved outside the form (the access key) is carried into a dirty form draft when the stored profile changes, so Save profile never writes a stale value back"

key-files:
  created:
    - apps/web/src/lib/features/agent/profile/share-link.ts
    - apps/web/src/lib/features/agent/profile/share-link.test.ts
    - apps/web/src/lib/features/agent/profile/ShareLinkBuilder.svelte
    - apps/web/tests/e2e/agent-share-link.spec.ts
  modified:
    - apps/web/src/routes/(app)/agent/profile/+page.svelte
    - apps/web/src/lib/features/agent/profile/ProfileForm.svelte
    - .planning/phases/08-agent-portal-profile-lead-intake-crm/deferred-items.md

key-decisions:
  - "08-24: the share link is built from the SAVED profile (the live view), the same data the home page's Copy inquiry link uses; typed-but-unsaved details keep the blocked line until Save profile"
  - "08-24: UI-SPEC's 'Show my brokerage on the page' checkbox dropped (state rules require the brokerage); a missing brokerage is a blocked state with its own line"
  - "08-24: ProfileForm carries the stored web3formsAccessKey into a dirty draft, otherwise Save profile after Save key would wipe the key"
  - "08-24: the key field shows the stored key (public by design) until the agent types a replacement; replacing a key = type + Save key"
  - "08-24: requirements mark-complete not run for AGT-02 (Phase 8 convention: AGT ids close at the 08-26 gate)"

patterns-established:
  - "Profile -> public link mapping lives in one pure module per surface (share-link.ts here, inquiryConfigFor on the home), with a unit test asserting they agree"

requirements-completed: [AGT-02]  # advanced here; left open in REQUIREMENTS.md until the 08-26 gate (Phase 8 convention)

# Metrics
duration: ~42 min active (stage 1 02:56-03:12Z; stage 2 builds + E2E ~03:15-03:38Z after the shared build directory was handed over)
completed: 2026-10-07
---

# Phase 8 Plan 24: Inquiry share-link builder Summary

**The profile page now has a "Your inquiry page" section. There the agent saves a UUID-checked Web3Forms access key into the profile (never the key store) and gets a share link built from the saved profile that carries only `v, k, n, b` plus optional `tm, t, st, lic, ph, p`. The section also has Copy link, Open your inquiry page, and honest captcha, spam and monthly-limit copy. The link is proven to round-trip to the public page and a mocked Web3Forms send on both bases.**

## Performance

- **Duration:** ~42 min active over two stages (stage 2 waited for 08-23 to release the shared build directory)
- **Started:** 2026-10-07T02:56:41Z
- **Completed:** 2026-10-07T03:38:09Z
- **Tasks:** 3 of 3
- **Files modified:** 7 (4 created, 3 modified incl. deferred-items.md)

## Accomplishments

- **share-link.ts (Task 1, TDD).** `shareLinkBlockers` returns the missing items in section order (name, brokerage, then a key that is missing or fails `ACCESS_KEY_RE`; whitespace counts as missing). `inquiryConfigFromProfile` maps the key (trimmed, lowercased), name, brokerage, team, license type, license state, license number and `normPhoneUS(brokeragePhone)`, each only when present. It also maps a property trimmed to at most 120 characters. Nothing else on the profile is read. 13 unit tests, including a fully populated profile whose email, personal phone, postal address, website, IABS link, brokerage license, logo and colors never appear in the raw or decoded URL. The param names are exactly the ten public ones. The link round-trips through `readInquiryParams` on `/` and `/tran_real_estate/`, and the mapping agrees with 08-21's `inquiryConfigFor`.
- **ShareLinkBuilder (Task 2).** `<section id="inquiry-page" aria-labelledby>` card with the h2 **Your inquiry page** and the intro. The key is saved through its own small form (Enter saves): a text input (autocomplete off, spellcheck false, maxlength 36, tabular), the "keys are meant to be public" helper with the shared `ExternalLink` **Get a free Web3Forms key** (14px icon, same tab, sr-only "(opens external site)"), and **Save key** (outline, "Saving…") calling `saveAccessKey`. An invalid key shows the 36-characters error with `aria-invalid`, moves focus to the field, and saves nothing. Success shows "Access key saved." and announces it. A storage failure shows a SectionError. Below the form are the captcha and spam lines (plan copy verbatim) and **Property (optional)** with its helper. When the link is ready it shows **Your link** (readonly, describedby the limit note), **Copy link** (primary, Link 16px, "Link copied." plus announcement, or the clipboard-refused copy with the field selected), and **Open your inquiry page** (outline link to the built URL). When blocked it shows one line per blocker and the static **Preview the page with sample details** link to `resolve('/agent/inquire/') + '?demo=1'`, which is in the prerendered HTML. The section ends with the monthly-limit note and the three test steps, with **Import leads** linking to `/agent/import/#paste`.
- **Profile page.** The section renders below `ProfileForm` in the form column, outside the `<form>`; the aside is unchanged. `#inquiry-page` scrolls into view on mount (the home checklist row links there).
- **E2E (Task 3).** `agent-share-link.spec.ts`, 6 tests per base:
  - Blocked states: three lines, the preview href, the honest copy, the external link with no `target`, and the Import leads href. Saving only the key clears only the key line. The preview opens the demo page.
  - Key validation: `not-a-key` and a 36-character non-hex value are refused with focus and `aria-invalid`. An uppercase key is saved lowercased and survives a reload.
  - Full TX profile with personal phone, email and postal address: the URL origin and path are right for each project (sub includes `/tran_real_estate/agent/inquire/`). The params are exactly `v,k,n,b,tm,t,st,lic,ph,p` with the expected values, and none of the private values appear. The ProfileForm key-preservation regression is covered. Clicking **Open your inquiry page** shows "The Sample Team at Example Realty", "Contact Sample Agent", "Lic. #SAMPLE-0001 (TX)" and the prefilled property. A mocked send posts `access_key` = TEST_ACCESS_KEY.
  - Clipboard copy in Chromium with granted permissions. The clipboard text equals the field; changing the property clears the stale status.
  - Axe, blocked: at 1280 (including the key error) and 375.
  - Axe, ready: at 1280 and 375, with no horizontal page scroll and the long URL scrolling inside its field.

## Task Commits

1. **Task 1 (RED): failing tests for profile to inquiry link mapping** - `af14d32` (test)
2. **Task 1 (GREEN): profile to inquiry link mapping** - `0f525a7` (feat)
3. **Task 2: inquiry share-link builder** - `4bedc7f` (feat; includes the ProfileForm fix and a Prettier reflow of the test file)
4. **Task 3: share-link builder E2E** - `a151752` (test; includes the deferred-items entry)

**Plan metadata:** the docs(08-24) commit that adds this file.

## Files Created/Modified

- `apps/web/src/lib/features/agent/profile/share-link.ts` - blockers + profile-to-InquiryConfig mapping
- `apps/web/src/lib/features/agent/profile/share-link.test.ts` - 13 unit tests
- `apps/web/src/lib/features/agent/profile/ShareLinkBuilder.svelte` - the "Your inquiry page" section
- `apps/web/src/routes/(app)/agent/profile/+page.svelte` - renders the section below the form; hash scroll
- `apps/web/src/lib/features/agent/profile/ProfileForm.svelte` - dirty draft adopts the stored access key
- `apps/web/tests/e2e/agent-share-link.spec.ts` - 6 built-site tests
- `.planning/phases/08-agent-portal-profile-lead-intake-crm/deferred-items.md` - agent-inquire single-core timing note

## Verification

Every Node command ran through the single-core affinity wrapper (mask 0x200); Playwright with `--workers=1`.

- `vitest run --project web src/lib/features/agent`: 17 files / 192 passed (profile set 63, of which 13 new).
- `corepack pnpm check`: tsc x2 clean; svelte-check 2498 files, 0 errors, 0 warnings.
- `corepack pnpm lint` (repo-wide prettier --check + eslint): clean at stage 1; the stage 2 spec edits were prettier + eslint clean. `corepack pnpm banned`: passed (339 files).
- `corepack pnpm build:root` and `build:sub`: both built (HEAD fe3a430 plus this plan). `corepack pnpm csp:assert`: passed, 32 pages per base.
- Playwright `agent-share-link`: **12/12 (root 6, sub 6)**.
- Playwright `agent-share-link agent-inquire` (first run, before the split): 31 passed, 3 failed. The failures were my then-single axe test, which timed out at 30 s on one core and has since been split and passes, and `agent-inquire` "375px axe clean in every state" on root and sub (see Issues). With the split, agent-inquire is **22/24 (root 11/12, sub 11/12)**.
- Playwright `agent-profile` (agent-profile.spec.ts + agent-profile-brand.spec.ts, affected by the page and ProfileForm changes): **24/24 (root 12, sub 12)**.
- Acceptance greps: every Task 2 string is present in ShareLinkBuilder.svelte, "Show my brokerage on the page" = 0, `getKey|vault` = 0. The spec contains `?demo=1`, "The Sample Team at Example Realty", "Link copied.", `grantPermissions` and the ten-param list. The new .ts files are ASCII-only.
- `apps/web/test-results/` removed after the runs.

## Decisions Made

- **Saved-profile-only link.** The builder reads `useProfile()` (stored data), not the form draft, so the link always matches what the home page's Copy inquiry link and the public page will see. An agent who typed a name without saving still sees "Add your full name in Your details to build your link." until they press Save profile.
- **Brokerage checkbox reconciled away** (plan objective): the brokerage is always in the link; a missing brokerage blocks.
- **Key field pre-filled** with the stored key (public by design). A replacement key is typed over it and saved, and the link updates.
- **`aria-describedby` on Your link** points at the monthly-limit note. The plan names a "helper" but gives no copy for it, so no new text was invented.
- **Storage-failure copy** (not in UI-SPEC): "Your key wasn't saved" / "Your key is still on this page. Try again. If it keeps failing, check Storage in Settings." It mirrors the profile save failure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Save profile could wipe a key saved from the builder**
- **Found during:** Task 2 (wiring the builder next to the form)
- **Issue:** `toProfileInput` copies `web3formsAccessKey` into ProfileForm's draft. When the agent had unsaved form edits and then pressed Save key, the form's adopt-`initial` effect kept the dirty draft, which still held the old ('' or previous) key. The next Save profile then called `saveProfile` with that stale key and erased the one just saved.
- **Fix:** In the effect, a typed (dirty) draft now takes `next.web3formsAccessKey` (the form has no key field, so this never overwrites user input). ProfileForm.svelte is outside this plan's `files_modified`; no concurrent plan owns it.
- **Files modified:** apps/web/src/lib/features/agent/profile/ProfileForm.svelte
- **Verification:** E2E "link carries only public fields..." does Save key, edits Website, then Save profile, and asserts the key field and the link are unchanged. agent-profile 24/24 is still green.
- **Committed in:** 4bedc7f

**2. [Test-side] Axe test split in two**
- **Found during:** Task 3 (combined run with agent-inquire)
- **Issue:** One test with four axe passes over the long profile page took 15 s alone and exceeded the 30 s timeout once the suite ran longer on a single core.
- **Fix:** Separate "blocked" and "ready" tests, each `test.slow()`. They took 9-18 s each.
- **Committed in:** a151752

---

**Total deviations:** 1 auto-fixed bug + 1 test-side adjustment. **Impact:** The ProfileForm line was required for the plan's own "stored in the profile" truth to hold. There was no scope change.

## Issues Encountered

- **agent-inquire 375px test vs a single core (out of scope, logged in deferred-items.md).** 08-13's "axe clean at 375px in every state" uses `page.clock.install()` (time keeps flowing) and expects the 3-second "too fast" notice after an axe pass and a form fill. A throwaway probe measured 2,653 ms for the axe pass plus 1,006 ms for the fill, which is past the gate, so the send goes through instead. Nothing in the inquiry path changed after 08-13, and the other 11 agent-inquire tests pass per base. The suggested fix for 08-13's spec is `clock.pauseAt` after load. The probe file was deleted.
- **Concurrent executors.** 08-23 finished before stage 2. 08-25's in-progress files (features/agent/followup/*, the contact route) were in the tree during stage 2 and were neither touched nor staged; both builds succeeded with them present.
- The wrapper's cmd layer rejects literal `(app)` paths; prettier/eslint were pointed at `apps/web/src/routes/*/agent/profile/*.svelte` globs.

## Requirements

`requirements-completed` copies the plan's `requirements` field (AGT-02). The share-link builder, its key handling and the round trip to the public page are in place, but `requirements mark-complete AGT-02` was NOT run: the Phase 8 convention leaves AGT ids open until the 08-26 gate. Real Web3Forms delivery to an inbox remains a HUMAN-UAT item for 08-26.

## User Setup Required

None. No external service configuration is required (an agent's own Web3Forms key is entered in the app).

## Known Stubs

None. The section reads the live stored profile and writes the key through `saveAccessKey`.

## Next Phase Readiness

- 08-26 gate: the AGT-02 HUMAN-UAT step is to save a real Web3Forms key, open the link, send a test, find the email (spam folder first time), and paste it into Import leads.
- 08-13's owner: the agent-inquire 375px clock note in deferred-items.md.

---
*Phase: 08-agent-portal-profile-lead-intake-crm*
*Completed: 2026-10-07*

## Self-Check: PASSED

All four plan files plus this SUMMARY exist on disk; commits af14d32, 0f525a7, 4bedc7f and a151752 are in `git log`. Playwright agent-share-link 12/12 and agent-profile 24/24 on root + sub; csp:assert passed on both builds.
