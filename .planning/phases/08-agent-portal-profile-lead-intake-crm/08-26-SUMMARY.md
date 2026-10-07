---
phase: 08-agent-portal-profile-lead-intake-crm
plan: 26
subsystem: phase-gate
tags: [gate, playwright, axe, wcag, rentcast-tripwire, csv-round-trip, tcpa, import-graph, verify, human-uat]

# Dependency graph
requires:
  - phase: 08-15
    provides: loadSampleContacts, addLeadByHand, announcer (agent-helpers), sample contacts
  - phase: 08-18
    provides: CSV export button and bytes contract
  - phase: 08-20
    provides: CSV and paste import with the dry-run review
  - phase: 08-23
    provides: contact detail page (?id=, not-found block)
  - phase: 08-24
    provides: share-link builder on the profile page
  - phase: 08-25
    provides: follow-up drafts (Fixture provider, Mark as sent)
provides:
  - "tests/e2e/agent-a11y.spec.ts: axe + one visible h1 on every agent route (empty and samples) and three inquiry states at 1280 and 375 (no horizontal scroll), 35 tests per base"
  - "tests/e2e/agent-no-rentcast.spec.ts: one walk through every agent flow with the RentCast tripwire armed and no sms: links"
  - "agent-csv.spec.ts round trip: an export of three real contacts re-imports as Already in contacts 3"
  - "scripts/agent-boundary.test.ts: no sms: in agent/public sources (planted control); leaf proof for the one exempt lib/data module"
  - "agent-helpers: openContactsReady + a hydration-safe addLeadByHand with notes"
  - "08-HUMAN-UAT.md (7 owner checks), final 08-VALIDATION.md, AGT-01..AGT-07 complete, README agent routes"
  - "corepack pnpm verify green, run step by step"
affects: [phase 8 verification, Phase 9 studio (agent nav, boundary exemption), Phase 10 GTM (UAT-7 counsel review)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route sweeps import AGENT_ROUTES / PUBLIC_ROUTES from routes.ts so a new route joins the sweep"
    - "E2E waits for data-settled pages by the absence of the prerendered 'Loading ...' line"
    - "A page whose order depends on two live queries renders only when both have settled"
    - "Boundary exemptions are self-verifying: the exempt module must stay a leaf"

key-files:
  created:
    - apps/web/tests/e2e/agent-a11y.spec.ts
    - apps/web/tests/e2e/agent-no-rentcast.spec.ts
    - apps/web/src/lib/features/shared/settings/import-preview.test.ts
    - apps/web/src/lib/features/shared/settings/testing/ImportPreviewHarness.svelte
    - .planning/phases/08-agent-portal-profile-lead-intake-crm/08-HUMAN-UAT.md
  modified:
    - packages/core/src/leads/normalize.ts
    - packages/core/src/leads/normalize.test.ts
    - packages/brand/src/brand-color.ts
    - packages/brand/src/brand-color.test.ts
    - apps/web/src/lib/features/agent/ui/AgentNav.svelte
    - apps/web/src/lib/features/agent/ui/AgentNav.test.ts
    - apps/web/src/lib/features/agent/profile/BrandColorField.svelte
    - apps/web/src/routes/(app)/agent/pipeline/+page.svelte
    - apps/web/tests/e2e/agent-helpers.ts
    - apps/web/tests/e2e/agent-csv.spec.ts
    - apps/web/tests/e2e/agent-today.spec.ts
    - apps/web/tests/e2e/agent-inquire.spec.ts
    - apps/web/tests/e2e/agent-pipeline.spec.ts
    - apps/web/tests/e2e/agent-contact.spec.ts
    - apps/web/tests/e2e/agent-shell.spec.ts
    - apps/web/tests/e2e/settings-backup.spec.ts
    - scripts/agent-boundary.test.ts
    - .planning/phases/08-agent-portal-profile-lead-intake-crm/08-VALIDATION.md
    - .planning/phases/08-agent-portal-profile-lead-intake-crm/deferred-items.md
    - .planning/REQUIREMENTS.md
    - README.md

key-decisions:
  - "Boundary test exempts exactly lib/data/tables.ts (the exemption eslint already grants storage) and proves it stays a leaf, instead of moving Phase 4 store declarations"
  - "The Today pill's full name is an aria-label on the link, not a visually hidden span (position: absolute padded the computed name with a space)"
  - "The pipeline board waits for the open-tasks query as well as contacts, so cards never re-sort under a press"
  - "The untestable-until-v2 backup migration E2E placeholder (test.fixme) became an SSR test of the same UI branch"
  - "Brand color example hex lives beside normalizeHex in @tran/brand so components keep no raw hex"

patterns-established:
  - "settle(page): html shown, one visible h1, no 'Loading (your|this) ...' line"
  - "Pause the Playwright page clock for timing gates, resume it before axe (axe uses timers)"

requirements-completed: [AGT-01, AGT-02, AGT-03, AGT-04, AGT-05, AGT-06, AGT-07]

# Metrics
duration: 160min
completed: 2026-10-07
---

# Phase 8 Plan 26: Phase gate Summary

**The agent portal is proven demo-credible on both bases: axe + 375px on every agent route empty and with samples, zero RentCast requests across every flow, no sms: anywhere, an exact CSV export/re-import round trip, and a green `corepack pnpm verify` after closing every known red (five deferred items, a pipeline re-sort race, two stale specs, a raw-hex check and a skipped placeholder).**

## Performance

- **Duration:** about 160 min (verify itself: about 106 min of wall time, run step by step)
- **Started:** 2026-10-07T04:14:39Z
- **Completed:** 2026-10-07T06:57:00Z
- **Tasks:** 3 of 3
- **Files modified:** 26 (5 created, 21 modified)

## Accomplishments

- **Sweep specs (Task 1).** `agent-a11y.spec.ts`: one test per route x state x width, so a failure names its case: `agent/` plus the six `AGENT_ROUTES` x {empty, samples} x {1280, 375}, the contact detail opened with a real sample `?id=` (samples) or showing "This contact isn't here" (empty), plus the inquiry page from a share link, `?demo=1` and with no params. Each checks html shown, exactly one visible h1, the data loaded, axe WCAG 2.0/2.1/2.2 A+AA, and no horizontal scroll at 375. That is 35 tests per base, all green. `agent-no-rentcast.spec.ts` walks every route empty, loads samples, walks every route again, moves Rowan to Closed through the Move menu, pastes and commits a TRAN-LEAD email, drafts a keyless follow-up and marks it sent, saves the profile and submits the inquiry form to the mocked Web3Forms. The tripwire ends `toEqual([])`, and every visited page has no `a[href^="sms:"]` (in any case). The CSV round trip adds three real contacts (notes with quotes, commas and a line break, and one starting `=SUM(1)`), exports them, uploads the downloaded file on `/agent/import/` and gets "Already in contacts 3", New 0, Updates 0, Can't import 0, three "Matches ... Nothing new to add." lines and no checkbox. `agent-boundary.test.ts` gains a source scan for `sms:` over features/agent, lib/leads, lib/components/inquiry, routes/(app)/agent and routes/(public), with a planted control.
- **Docs (Task 2).** `08-HUMAN-UAT.md` lists UAT-1 to UAT-7 (real Web3Forms delivery, the tran_lead_v1 row, paste-back from Gmail/Outlook/Apple Mail, hCaptcha on, the quota, email apps on desktop and mobile, counsel review), each with steps, expected result and `pending`. In `08-VALIDATION.md` every task row is green with its commit hashes, and the frontmatter reads `status: complete`, `nyquist_compliant: true`, `wave_0_complete: true`, approved 2026-10-07. AGT-01..AGT-07 are ticked and Complete in REQUIREMENTS.md. The README lists the seven agent routes plus `/agent/inquire/` (31 pages, 32 HTML files) and has an "Agent portal (Phase 8)" section noting that the Web3Forms key is public by design and lives in the profile, not the key vault.
- **Gate (Task 3).** Every step of `verify` exits 0 (table below).

## Verify results (run step by step)

`corepack pnpm verify` was not run as one command. This machine's performance counter runs backwards across cores, so every Node process ran pinned to one core through the affinity wrapper, and the full Playwright suite (1490 tests) takes far longer than the 10-minute tool limit on one core. Each `verify` step therefore ran as its own command, in the script's order, with Playwright split into 16 spec-file chunks run in sequence with `--workers=1`. The final pass of each step after the last source commit (`42aa447`):

| # | Step | Result | Time |
|---|------|--------|------|
| 1 | `check` | exit 0: svelte-check 2509 files, 0 errors, 0 warnings; tsc for core and brand clean | 34 s |
| 2 | `lint` | exit 0: Prettier clean, ESLint clean | 111 s |
| 3 | `banned` | exit 0: 342 files | 2 s |
| 4 | `ui:guard` | exit 0: 79 files | 2 s |
| 5 | `test:unit` | exit 0: 258 files, 4871 tests passed, 0 skipped | 290 s |
| 6 | `build:root` | exit 0 | 32 s |
| 7 | `build:sub` | exit 0 | 32 s |
| 8 | `csp:assert` | exit 0: 32 pages in build and 32 in build-sub | 2 s |
| 9 | `test:e2e` | exit 0 in every chunk: **1490 passed, 0 failed, 0 skipped, 0 flaky** (root 747, sub 743; agent specs 152 per base) | 4105 s across 16 chunks (about 68 min) |
| 10 | `guard` | exit 0: 1456 files | 2 s |
| 11 | `fixtures:check` | exit 0: 6 files match | 2 s |
| 12 | `secrets:canary` | exit 0: canary detected | 1 s |
| 13 | `secrets:scan` | exit 0: history scanned, no leaks | 4 s |
| 14 | `lint:workflows` | exit 0 | 2 s |

E2E chunks (each `--workers=1`, both projects unless noted): layout root 188 (182 s); layout sub 188 (179 s); `a11y.spec` filter = a11y + agent-a11y + ai-a11y + settings-a11y 270 (706 s); marketing + routes-drift + routing + framing + csp 118 (238 s); agent-shell + agent-inquire + agent-import + agent-entry + agent-csv + agent-no-rentcast 106 (294 s); agent-contact + agent-followup 42 (277 s); agent-today + agent-pipeline 36 (161 s); agent-profile + agent-profile-brand + agent-share-link + agent-contacts 50 (167 s); ai-drafting + ai-guardrails + app-notice + app-notice-locked + pwa + data-status 70 (265 s); settings data/keys/security 72 (269 s); settings shell/backup/storage/install 46 (104 s, re-run after `42aa447`; the first run was 46 passed + 2 skipped); investor routes + analyze 70 (117 s); the other nine investor specs 80 (628 s); renter-map + renter-map-split + renter-demo-credible 52 (173 s); renter listing/harness/affordability/search 54 (130 s); renter results/outreach/shortlist/fair-rent/saved/journey 48 (215 s). The sum, 1490, equals `playwright test --list`.

Steps 1-5 ran twice: they were re-run after `e73167b` and `42aa447` changed sources. The builds that the e2e chunks used were made after `e73167b`. `42aa447` only adds a test, an unimported test harness (confirmed absent from both build outputs) and a comment in an E2E spec. No `test.slow()` was added to any existing test. The new single-walk `agent-no-rentcast` test calls `test.slow()` because it makes about 20 page loads plus a draft; it ran in about 22 s per base.

## Task Commits

1. **Deferred item 1 (normalize lint):** `70253af` (fix)
2. **Deferred item 3 (AgentNav name):** `cbb6a26` (fix)
3. **Deferred item 5 (boundary exemption):** `e8b048e` (fix)
4. **Deferred item 4 (inquire gate under a frozen clock):** `bab386d` (fix)
5. **addLeadByHand hydration wait:** `98a321a` (fix)
6. **Pipeline board waits for open tasks:** `8b18958` (fix)
7. **Exact Due label (follow-through of cbb6a26):** `ff96d70` (fix)
8. **agent-shell contact not-found expectation:** `177dbea` (fix)
9. **Task 1: sweep specs, CSV round trip, sms: source check:** `7ea8cf3` (test)
10. **Task 2: UAT, validation, requirements, README:** `5a2a59a` (docs)
11. **Task 3 fix: brand color example out of component markup:** `e73167b` (fix)
12. **Task 3 fix: SSR test replaces the skipped backup-migration placeholder:** `42aa447` (fix)

**Plan metadata:** the docs(08-26) commit that follows this file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Deferred item 1: `no-control-regex` in packages/core/src/leads/normalize.ts**
- **Issue:** The HOSTILE class used a literal control-character regex inside a block `eslint-disable`.
- **Fix:** The class is now built with `new RegExp` from a table of code-point ranges, each written as escaped `\uXXXX` text. The disable comments are removed. A new unit test checks every BMP code point against the intended set (C0 except tab and newline, DEL + C1, bidi embeddings and overrides, isolates, zero-width characters, BOM), so the rewrite provably strips exactly the same characters.
- **Commit:** `70253af`

**2. Deferred item 2: gitleaks history finding (commit 4e453c1)**
- **Found:** already resolved. `8549c99` allowlists commits 4e453c1 and 05793bf in `.gitleaks.toml`. `secrets:scan` was green at plan start (850 commits) and at the end; no change made.

**3. [Rule 1 - Bug] Deferred item 3: the Today pill's accessible name read "Today , 5 tasks due"**
- **Fix:** `aria-label={'Today, N tasks due'}` on the link when there is a count (the label starts with the visible "Today", so WCAG 2.5.3 holds). The `sr-only` span is gone and the visible pill stays `aria-hidden`. AgentNav.test.ts reads the aria-label, asserts no sr-only fragment remains and that no other link gets a label. agent-today.spec.ts matches `Today, N tasks due` exactly again.
- **Follow-through:** the label contains "due", so agent-contact's `getByLabel('Due')` matched two elements. It now uses `{ exact: true }` (`ff96d70`).
- **Commits:** `cbb6a26`, `ff96d70`

**4. [Rule 1 - Bug] Deferred item 4: agent-inquire "axe clean at 375px in every state" on one core**
- **Fix (spec only, no product change):** after the valid-state axe check, the test pauses the page clock (`pauseAt`) and re-opens the page, so the gate starts at the frozen instant and the fill and first send happen at zero elapsed time. A first attempt that left the clock paused through the next axe pass hung axe, because axe uses its own timers. That pinned down the mechanism: the clock now resumes right after the too-fast notice appears and before the axe check. The too-fast assertion and every later state are unchanged. 24/24 on both bases.
- **Commit:** `bab386d`

**5. [Rule 1 - Bug] Deferred item 5: agent-boundary reached `lib/data/tables.ts`**
- **Decision:** a narrow exemption, not a move. `tables.ts` holds Phase 4 store schemas, row types and backup-registry constants, and its only import is `import type { Syncable } from '@tran/core'`. eslint.config.js already grants storage exactly this exemption ("may import the table schema module $lib/data/tables and nothing else from lib/data"). The exemption is self-verifying: a new test asserts that the file's whole local import graph is itself, that it contains no `fetch(`, XMLHttpRequest, WebSocket or sendBeacon, and that every import is `import type`.
- **Mutation proof (each restored and byte-compared with sha256, all OK):** (a) `import '$lib/data/gateway';` prepended to `features/agent/samples/samples.ts` made the reach test fail with `lib/data/gateway.ts` reported (1 failed / 5 passed). (b) `import { gateway } from './gateway'` in `tables.ts` failed both the reach test and the leaf test (2 failed). (c) a `fetch('https://api.rentcast.io/...')` export appended to `tables.ts` failed the leaf test (1 failed).
- **Commit:** `e8b048e`

**6. [Rule 1 - Bug] `addLeadByHand` raced the contacts page (flagged by 08-20)**
- **Fix:** a new exported `openContactsReady(page)` waits for the html to be shown, the prerendered "Loading your contacts..." line to be gone (hydrated and the live query settled) and Add a lead to be visible. `addLeadByHand` uses it, waits for the dialog and accepts `notes`. agent-csv's racing local copy was removed in favour of the helper. Every spec that uses the helper passed: agent-contacts, agent-entry, agent-import, agent-csv (48/48), and again in the full run.
- **Commit:** `98a321a`

**7. [Rule 1 - Bug] The pipeline board re-sorted cards after first paint (found as a 1-in-10 flake in "pointer drag at 1280px")**
- **Root cause:** the trace of the failing repeat showed Riley's card at y=912 in a 900 px viewport, against y=468 in a passing run, while the Touring column sat at the same place in both. The board rendered as soon as contacts loaded, but its order (`sortForBoard` by next due task), due badges and filter counts come from the open-tasks live query. When tasks arrived later the cards re-sorted and moved under the pointer. A user could see the same jump.
- **Fix:** `/agent/pipeline/` keeps the loading line until both queries have settled (a failed task query still shows the board, as before). The drag spec now also measures boxes after its settle waits. The drag test then passed 30/30 in a row.
- **Commit:** `8b18958`

**8. [Rule 1 - Bug] agent-shell expected the prerendered "Contact" h1 on a bare `/agent/contact/`**
- **Issue:** since 08-23 the page hydrates into the not-found block ("This contact isn't here") when there is no id. The 08-11 spec was red on both bases (08-21 last ran it before 08-23 landed). Its title stays "Contact: Agent portal", so the spec now takes a separate expected title for that route.
- **Commit:** `177dbea`

**9. [Rule 1 - Bug] theme-parity "no raw hex in components" was red since 08-22**
- **Issue:** BrandColorField.svelte had the example `#A4452A` in its placeholder and format error.
- **Fix:** `HEX_EXAMPLE` lives in `@tran/brand/brand-color` beside `normalizeHex`. The component builds both strings from it, and a unit test asserts the example is a valid normalized color. The theme test is unchanged.
- **Commit:** `e73167b`

**10. [Rule 2 - Missing coverage] Two skipped e2e tests (an empty `test.fixme` placeholder since Phase 3)**
- **Issue:** settings-backup.spec.ts held `test.fixme('older backup shows the migration line', async () => {})`, reported as skipped on both bases. A real E2E needs an older backup version, which does not exist while `BACKUP_SCHEMA_VERSION` is 1.
- **Fix:** an SSR test (`import-preview.test.ts` with a small context harness) renders ImportPreview with a migrated and a current preview and checks the line appears only for the first. Inverting the `{#if}` made both tests fail; the file was restored and byte-compared. The placeholder became a comment that says when the E2E becomes possible. `migrations.test.ts` already fails if the version is bumped without a migration step.
- **Commit:** `42aa447`

**11. [Rule 1 - Bug] Own expectation corrected:** the CSV round-trip test first expected the announcement to include ", 0 can't be imported". The UI omits that clause when it is zero (CsvImport.svelte, by design), so the expectation now matches the real string. No product change.

---

**Total deviations:** 10 fixes plus 1 already resolved (deferred item 2). All were needed to close the gate with no skipped tests, no loosened assertions and no new lint disables. The diff since `d2c491a` adds no `eslint-disable`, `svelte-ignore`, `.skip`, `.only` or `.fixme` and removes one disable and one fixme.

## Flakes and root causes

- **pipeline pointer drag:** the board re-sorted after first paint; fixed in the product (deviation 7).
- **agent-inquire 375px:** the spam gate's real clock kept running while axe ran on a slow core; fixed by restarting the gate under a paused clock (deviation 4).
- **addLeadByHand:** clicked before hydration; fixed in the helper (deviation 6).
No test was retried until green without a diagnosed cause.

## Known Stubs

None. The new specs exercise wired features end to end. The only placeholder this plan touched (the backup-migration fixme) was replaced by a real test.

## Issues Encountered

- **Machine constraint:** every Node command ran through the single-core affinity wrapper (mask 0x100). Two chunk commands that ran past the 10-minute tool limit continued in the background and were awaited in the foreground; no other Playwright run overlapped them.
- **Shell quoting:** inline Python edits through the tool collapsed doubled backslashes, which corrupted one draft of the sms: test (literal newlines). It was rewritten with the editor before any commit.

## User Setup Required

None for the build. The owner's Web3Forms checks are in `08-HUMAN-UAT.md` (UAT-1..UAT-7, non-blocking).

## Next Phase Readiness

- Phase 8 is ready for `/gsd:verify-work`: success criteria 1-5 are covered by tests on both bases, and only the key-dependent checks remain as owner UAT.
- Phase 9 notes: the Studio route is already excluded from the agent boundary entries. The `lib/data/tables.ts` exemption is the only lib/data path agent code may take. A Studio nav item will change AgentNav's link list (the AgentNav and agent-shell tests pin the current five).

---
*Phase: 08-agent-portal-profile-lead-intake-crm*
*Completed: 2026-10-07*

## Self-Check: PASSED

- All created files exist on disk (agent-a11y.spec.ts, agent-no-rentcast.spec.ts, import-preview.test.ts, ImportPreviewHarness.svelte, 08-HUMAN-UAT.md, this SUMMARY).
- Commits 70253af, cbb6a26, e8b048e, bab386d, 98a321a, 8b18958, ff96d70, 177dbea, 7ea8cf3, 5a2a59a, e73167b, 42aa447 (and the pre-existing 8549c99) are in history.
- Acceptance greps: 08-HUMAN-UAT.md has UAT-1..UAT-7 plus Web3Forms, Gmail, Outlook, Apple Mail, hCaptcha, tran_lead_v1; REQUIREMENTS.md has 7 ticked AGT rows; README mentions agent/inquire; agent-a11y imports AGENT_ROUTES; agent-no-rentcast asserts toEqual([]) and checks a[href^="sms:"]; agent-csv contains =SUM(1) and the Already in contacts count; agent-boundary contains sms: and planted.
- No added eslint-disable, svelte-ignore, .skip, .only or .fixme in the diff since d2c491a.
