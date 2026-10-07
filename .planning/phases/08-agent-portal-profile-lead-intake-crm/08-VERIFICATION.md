---
phase: 08-agent-portal-profile-lead-intake-crm
verified: 2026-10-07T07:15:00Z
status: gaps_found
score: 4/5 success criteria verified (SC5 partial); 7/7 requirements satisfied; 26/26 plans' artifacts and key links verified
gaps:
  - truth: "SC5: every agent CRM route spends zero RentCast calls with a real key present"
    status: partial
    reason: >
      The agent CRM code never reaches the RentCast gateway (ESLint ban + transitive import-graph
      test, both green). But every /agent/* page renders inside the (app) layout, whose DataShell
      runs the Phase 4 check-on-open saved-search scheduler on mount regardless of route. With a
      live RentCast key and 1-3 due renter saved searches, opening the app at /agent/ (bookmark,
      PWA start, shared link) spends RentCast calls silently ("1-3 due run silently"), and with
      4+ due the DueSearchesDialog opens on top of the agent page. The agent portal hides the
      DataStatusBar, so the spend happens with no meter visible. The gate spec
      (agent-no-rentcast.spec.ts) runs keyless with no saved searches, so it cannot see this.
    artifacts:
      - path: "apps/web/src/lib/features/shared/data/DataShell.svelte"
        issue: "onMount (line ~120) calls checkSavedSearchesOnOpen unconditionally; only the status bar is gated by showStatusBar (line ~195)"
      - path: "apps/web/src/routes/(app)/+layout.svelte"
        issue: "isAgentCrm(route) is computed but only used to hide the status bar, not to skip the on-open alerts run"
      - path: "apps/web/tests/e2e/agent-no-rentcast.spec.ts"
        issue: "No key-present state: no live RentCast key and no due saved search are seeded before the tripwire walk"
    missing:
      - "Skip (or defer to the next non-agent route) the check-on-open saved-search run when the session starts on an agent CRM route, e.g. a runAlerts prop on DataShell driven by !isAgentCrm(page.route.id); or record an explicit owner decision that renter alerts may spend on agent pages and amend SC5"
      - "Extend agent-no-rentcast (or add a spec) with a seeded live RentCast key plus a due saved search, open /agent/ first, and assert the tripwire stays empty"
human_verification:
  - test: "UAT-1 Real delivery through the agent's own Web3Forms key"
    expected: "'Message sent'; email arrives with visitor fields, reply-to = visitor, subject 'New inquiry for {Name} from {Lead name}', sender 'Tran inquiry form'"
    why_human: "Needs the owner's free Web3Forms access key and a real inbox"
  - test: "UAT-2 tran_lead_v1 field visible in the notification"
    expected: "A tran_lead_v1 row holding the whole TRAN-LEAD v1 ... END TRAN-LEAD block"
    why_human: "Depends on Web3Forms' real email rendering"
  - test: "UAT-3 Paste-back from Gmail web, Outlook and Apple Mail"
    expected: "Review reads the lead exactly; second paste shows the existing contact"
    why_human: "Real mail clients' copy behavior"
  - test: "UAT-4 hCaptcha switched on in the Web3Forms dashboard"
    expected: "\"This form can't send messages right now\", typed message kept, nothing delivered"
    why_human: "Needs the Web3Forms dashboard"
  - test: "UAT-5 Spam and free-tier quota behavior"
    expected: "Over-limit sends show a failure message, never a false 'Message sent'; limit note accurate"
    why_human: "Undocumented provider behavior at volume"
  - test: "UAT-6 Follow-up draft in real email apps (desktop and phone, incl. >1,800 chars)"
    expected: "Compose window holds draft + footer; long-draft note and Copy text carry the full text"
    why_human: "Real devices and mailto handlers"
  - test: "UAT-7 Counsel review of the state disclosure table and CAN-SPAM footer wording"
    expected: "Wording approved or changes recorded before Phase 10 GTM"
    why_human: "Professional/legal review"
---

# Phase 8: Agent Portal: Profile, Lead Intake & CRM Verification Report

**Phase Goal:** An agent captures leads through their own inquiry page, works them through a pipeline, and never misses a follow-up, with required disclosures built in
**Verified:** 2026-10-07T07:15:00Z
**Status:** gaps_found (one partial gap on SC5; everything else verified; 7 owner UAT items pending)
**Re-verification:** No (initial verification)

## Method

- Read ROADMAP Phase 8, REQUIREMENTS AGT-01..07, 08-CONTEXT, 08-UI-SPEC (scope notes), 08-VALIDATION, 08-HUMAN-UAT, deferred-items.md and all 26 plans' must_haves.
- `gsd-tools verify artifacts` on all 26 plans: **80/80 artifacts pass** (exist, substantive).
- `gsd-tools verify key-links` on all 26 plans: 35/45 reported verified. **All 10 reported failures were checked by hand and are wired**: 6 are tool regex double-escaping (`\\(` / `\\[` patterns), 1 is a glob target, 1 is an indirection (LogoUpload -> logo-pipeline.ts -> `checkLogoFile`), and the rest are present literally (see Key Links).
- Read the load-bearing code: disclosure composer and email footer, follow-up prompt/composer/panel exits, Web3Forms sink, inquiry gate and page, pipeline board/column/DnD, TodayQueue/AgentHome, CSV export, share-link builder, backup registration, (app) layout and DataShell.
- Ran (single-core wrapper): Phase 8 unit tests (42 files, **688 passed**), `scripts/agent-boundary.test.ts` (8 passed), `corepack pnpm banned` (passed, 342 files), `corepack pnpm check` (svelte-check 2509 files, 0 errors, 0 warnings), `corepack pnpm csp:assert` (32 pages each in build and build-sub), and Playwright `agent-no-rentcast` on the root project (1 passed). The build (02:54) postdates the last source commit (42aa447, 02:21).

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Agent sets up a profile (name, brokerage, license #, state, logo, brand colors, postal address); required disclosures auto-appended to every export and generated draft | VERIFIED | `ProfileForm.svelte` + `profile-repo.ts` (Dexie, survives reload); `LogoUpload` -> `logo-pipeline.ts` -> `checkLogoFile`/`sniffLogo` (byte sniff, 512 KB, SVG rasterized to PNG); `BrandColorField` with contrast fallback; `composeDisclosure` (brokerage first, FL/NJ/OH/CA/NY/TX rules in `state-rules.ts`) feeds `composeEmailFooter`, which every follow-up exit appends via `exitPayload` (copy, mailto, mark-sent in `panel-state.svelte.ts`). Public inquiry page shows `composeDisclosure(p,'web')`. Contacts CSV deliberately carries no disclosure row (08-UI-SPEC line 681: private data file, would corrupt re-import) - documented scope decision, accepted. |
| 2 | Shareable inquiry page on the agent's own Web3Forms key with spam protection; paste or manual add creates a contact with duplicate detection | VERIFIED (delivery = human) | `(public)/agent/inquire/+page.svelte` reads URL params in onMount, text-only rendering, noindex + no-referrer; `InquiryForm` -> `evaluateGate` (honeypot drop-silently, 3000 ms too-fast) -> `submitInquiry` posts one JSON request to `https://api.web3forms.com/submit` with `tran_lead_v1` block, maps 429/5xx/captcha/rejected/network, redacts the key. `ShareLinkBuilder`/`share-link.ts` whitelist v,k,n,b(+optional) params. `PasteImport` -> `paste-to-leads` -> `lead-block`/`parse-freeform` -> `diff-leads` dry run -> `import-commit` single transaction. `QuickAddDialog` blocks duplicates by normalized email/phone. Real email arrival is UAT-1..3. |
| 3 | Drag contacts New -> Contacted -> Touring -> Offer -> Closed; follow-up tasks; due-today queue on opening the app | VERIFIED | `StageColumn.svelte` native HTML5 DnD gated by `DRAG_MEDIA` (1280px, fine pointer), `readDraggedId` accepts only known ids, "Drop to move to {Stage}"; `MoveMenu` keyboard path; both go through `board-state.svelte.ts` `move()` -> `moveStage` (stage + activity in one `db.transaction('rw', ...)`, `applyMove`) with Undo and `announce`. Tasks: `tasks-repo.ts` on the `[status+dueDate]` compound index; `/agent/` renders `AgentHome` with compact `TodayQueue` first (`groupTasks`: Overdue, Due today, Coming up, Done today); AgentNav Today count pill via aria-label. |
| 4 | AI follow-up draft with postal address and opt-out line, passes the Fair Housing checker, sent only via copy or own email client; CSV import and export | VERIFIED | `followup-prompt.ts` (housingCopy: true, client name/email/phone tokenized as known PII, footer never in the prompt); `followupState` gates opted-out and incomplete profiles; footer = postal address + `OPT_OUT_LINE` + ad-ID line for non-inquiry consent + disclosure; `computeGate` blocks all exits on block findings or unacknowledged warns; exits are only copy / mailto / mark-sent (logs activity, updates lastContactedAt). CSV: `packages/core/src/csv` (BOM, quote-all, CRLF, formula escaping, 5,000-row cap), `CsvImport` + `ColumnMapper` + `decode.ts` (windows-1252), `csv-export.ts` excludes samples. |
| 5 | Demo-credible: works on sample contacts with no keys, **zero RentCast calls with a real key present**, AI copy passes the checker, axe passes | PARTIAL | Keyless: 12 sample contacts (new 4, contacted 3, touring 2, offer 2, closed 1), Fixture provider drafting, agent-a11y on both bases (per 08-26 run, 1490/1490 E2E), `agent-no-rentcast` re-run here: passed. Boundary: agent code never reaches `lib/data` (lint + walker, green). **But** with a real key the (app) layout's `DataShell` still runs the Phase 4 check-on-open saved-search scheduler on agent routes, spending RentCast calls (see Gaps). |

**Score:** 4/5 success criteria verified, 1 partial.

### Plan must_haves

All truths in the 26 plans' must_haves were traced to code or green tests. The only truth affected by the gap is 08-26 truth 2 ("Across every agent flow ... zero requests to api.rentcast.io"), which holds as tested (keyless) but not with a live key plus due saved searches.

### Required Artifacts

| Artifact group | Status | Details |
|---|---|---|
| `packages/core/src/{agent,leads,crm,csv,disclosure}/**` | VERIFIED | 80/80 plan artifacts exist and pass size/pattern checks; property tests (fast-check `fc.assert`) in normalize, CSV and lead-block suites |
| `apps/web/src/lib/storage/agent/**` | VERIFIED | Dexie tables, contacts/tasks/profile repos, import-commit, backup registration (Contacts, Tasks, Activity, Agent profile) |
| `apps/web/src/lib/features/agent/**` | VERIFIED | profile, crm, pipeline, import, tasks, contact, followup, home, ui; all wired from the six `/agent/*` routes |
| `apps/web/src/lib/leads/**`, `lib/components/inquiry/**`, `routes/(public)/agent/inquire` | VERIFIED | Sink, URL params, gate, public page |
| `apps/web/tests/e2e/agent-*.spec.ts` (15 specs + helpers) | VERIFIED | Only skips are `browserName !== 'chromium'` clipboard guards |

### Key Link Verification (tool-reported failures, checked by hand)

| From | To | Status | Details |
|---|---|---|---|
| packages/core/package.json | src/** deep imports | WIRED | exports map has `./*`, `./agent/*`, `./leads/*` |
| normalize.test.ts | fast-check | WIRED | 5 `fc.assert` calls |
| eslint.config.js | routes/(public)/** | WIRED | line 202 `files: [\`${WEB}/routes/(public)/**\`]` |
| tests/e2e/routes.ts | assert-csp.mjs EXPECTED_PAGES | WIRED | `agent/contact/` and `agent/contact/index.html` both present |
| contacts-repo.ts | applyMove + transaction | WIRED | `applyMove` imported, used inside `db.transaction('rw', ...)` (line 244-246) |
| tasks-repo.ts | [status+dueDate] index | WIRED | `.where('[status+dueDate]')` lines 151, 171; index declared in tables.ts |
| StageBoard.svelte | announce() | WIRED | line 113; moves announce via board-state.svelte.ts |
| LogoUpload.svelte | checkLogoFile / sniffLogo | WIRED (indirect) | via `prepareLogo` in `logo-pipeline.ts` line 136 |
| ContactHeader.svelte | board-state move() | WIRED | `board.move(contact, value, { focus: false })` line 49 |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| AGT-01 | 08-01, 04, 08, 12, 16, 22 | Profile + auto disclosures | SATISFIED | Truth 1 |
| AGT-02 | 08-03, 06, 13, 24 | Inquiry page via own Web3Forms key, spam protection | SATISFIED (delivery UAT-1..5) | Truth 2 |
| AGT-03 | 08-05, 06, 14, 15, 20 | Paste/manual import with dedupe | SATISFIED | Truth 2 |
| AGT-04 | 08-09, 10, 19, 23 | Drag-and-drop pipeline | SATISFIED | Truth 3 |
| AGT-05 | 08-09, 14, 21 | Tasks + due-today queue | SATISFIED | Truth 3 |
| AGT-06 | 08-08, 25 | AI follow-ups with CAN-SPAM elements | SATISFIED (real mail apps UAT-6) | Truth 4 |
| AGT-07 | 08-07, 18, 20 | CSV import and export | SATISFIED | Truth 4 |

No orphaned requirements: REQUIREMENTS.md maps exactly AGT-01..07 to Phase 8.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| (scan of all Phase 8 source dirs) | - | TODO/FIXME/HACK/placeholder | none | Only hits are a comment about `\uXXXX` and `+1XXXXXXXXXX` in normalize.ts |
| apps/web/src/lib/features/shared/data/DataShell.svelte | ~120-131 | Route-blind on-open spend | Warning (SC5) | See gap |
| (agent source) | - | `sms:` links | none | grep clean; E2E asserts none on every agent page |

All five items in deferred-items.md are recorded as resolved by 08-26 and the fixes are present (AgentNav aria-label, normalize RegExp, boundary exemption limited to `lib/data/tables.ts`).

### Human Verification Required

These are the owner items already listed in 08-HUMAN-UAT.md (not gaps):

1. **UAT-1 Real Web3Forms delivery**: create a free key, save it on `/agent/profile/`, submit the share link in a private window. Expect "Message sent" and the email with reply-to = visitor.
2. **UAT-2 tran_lead_v1 row**: confirm the field appears in the notification email.
3. **UAT-3 Paste-back** from Gmail web, Outlook, Apple Mail: exact read, then duplicate on second paste.
4. **UAT-4 hCaptcha on**: the captcha-required message shows and the typed message is kept.
5. **UAT-5 Free-tier quota**: over-limit shows a failure, never a false success.
6. **UAT-6 Follow-up in real email apps** (desktop + phone, plus a >1,800-char draft): footer intact.
7. **UAT-7 Counsel review** of the state disclosure table and CAN-SPAM footer wording before Phase 10.

### Gaps Summary

One partial gap, on SC5 only. The agent CRM's own code is clean: it cannot import the RentCast gateway, and a keyless walk through every agent flow makes zero RentCast requests. The leak is app-wide, not in agent code. `routes/(app)/+layout.svelte` already computes `isAgentCrm(route)` but uses it only to hide the DataStatusBar. `DataShell` still runs `checkSavedSearchesOnOpen` on mount for every (app) route. So a user with a live RentCast key and due renter saved searches who opens the app at an `/agent/` URL spends up to 3 calls without being asked, with no meter on screen (or sees the DueSearchesDialog if 4 or more are due). The gate test misses this because it never seeds a key or a saved search.

Fix options: gate the on-open run off agent CRM routes (a `runAlerts` prop driven by `!isAgentCrm`), plus a key-present tripwire test; or have the owner accept the cross-portal alerts behavior and amend SC5. All seven requirements are otherwise met.

---

_Verified: 2026-10-07T07:15:00Z_
_Verifier: gsd-verifier_
