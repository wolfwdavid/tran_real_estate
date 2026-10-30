---
status: superseded
superseded_by: .planning/HUMAN-UAT.md
phase: 04-data-layer-rentcast-gateway-budget-guard-demo-fixtures
source: [04-RESEARCH.md "Deferred real-key checks (HUMAN-UAT)", 04-CONTEXT.md, 04-VALIDATION.md "Manual-Only Verifications", Phase 6 research additions (coordinator 2026-10-04)]
started: 2026-10-05
updated: 2026-10-05
blocking: false
---
> Superseded on 2026-10-30 by `.planning/HUMAN-UAT.md` (Phase 13 ledger). This file is kept as history; record results in the ledger.

# Phase 4: Real-key UAT (deferred)

**Status: pending until the owner creates a dedicated RentCast key.** These checks are
non-blocking: nothing here blocks Phases 5-9. Every behaviour below is already covered by
automation with RentCast fully mocked (unit, component and E2E on both base paths). What
automation cannot reach is RentCast's real billing counter and real response shapes.

## Ground rules

- Run only from a local `corepack pnpm dev` session (http://localhost:5173), never from CI and
  never from a shared machine.
- Use a **dedicated, endpoint-restricted RentCast key** created only for this UAT. Never commit
  it, never paste it into an issue, a chat, a screenshot or a log. Revoke it when done.
- Open the RentCast dashboard (API usage) in a second tab. **Read the usage counter before and
  after every step** and record the delta.
- Record **status codes and counts only, never response bodies.** RentCast data is licensed and
  real listings can carry agent names and phone numbers; nothing from a real response goes into
  this repo (CLAUDE.md "Data hygiene").
- Status codes come from DevTools → Network (filter `api.rentcast.io`), column **Status**. Do not
  copy the Response tab.
- A row whose result differs from Expected is a one-line switch, named in the
  "If different" column. Make that change in a normal GSD plan with its test, not ad hoc.

## Checklist

| # | Check | How | Expected | If different (exact file/line to change) | Result |
|---|-------|-----|----------|-------------------------------------------|--------|
| U1 | Does the free Developer plan require a card at sign-up? | Create the RentCast account / key at rentcast.io/api; note whether a card is requested | Unknown (pricing page says "no credit card") | Update the Phase 10 onboarding copy ("Getting started" settings section) | [pending] |
| U2 | Key format (length / charset) | Look at the key in the RentCast dashboard: count characters, note the character classes (do not record the key) | Unknown; current check accepts printable ASCII, 16-128 chars | Tighten `validateKeyFormat` in `packages/core/src/request/probe.ts` (line 42) | [pending] |
| U3 | Settings → Test key with a valid key | Steps A below. The probe is `GET /v1/markets?zipCode=00000&dataType=Rental&historyRange=1&suppressLogging=true` | 400 or 404; line "RentCast accepted this key. The test didn't use a call."; dashboard count unchanged; meter stays "0 of 50 calls used this month" | If 200: change `PROBE_REQUEST` in `packages/core/src/request/probe.ts` (line 11) to a request that cannot return data | [pending] |
| U4 | Test key with an invalid key | Steps B below (alter one character of the key) | 401; line "RentCast didn't accept this key. Check that you copied all of it, or create a new key."; dashboard unchanged | n/a | [pending] |
| U5 | Test key with a key restricted to listings only | Steps C below (second dedicated key restricted to rental listings only) | 403 (restriction checked before validation); line "RentCast recognized this key but refused the test request. …" | If 400/404: add a note to `KeyTestResult` / `KEY_TEST_LINES` in `apps/web/src/lib/features/shared/data/copy/source.ts` that restriction cannot be detected by the test | [pending] |
| U6 | Empty listing search for a real but empty query | Once Phase 6 ships Search, run a renter search for a real ZIP with filters that match nothing; until then skip | 404, unbilled (dashboard unchanged); meter shows "Not counted: 1 searches with no results." | If `200 []`: confirm billing on the dashboard; the Pitfall 8 handling (`200 []` treated as empty) stays | [pending] |
| U7 | Does a 404 change the dashboard count? | Compare dashboard before/after U3 and U6 | No | Flip `isBilled` in `packages/core/src/budget/policy.ts` (line 5) to include 404, and update the "Not counted" line (`notCountedLine` in `apps/web/src/lib/features/shared/data/copy/meter.ts`) | [pending] |
| U8 | Is page 2 (`offset=500`) billed separately? | Only if a real search returns 500 rows: request the next page once | Yes (+1 on the dashboard) | n/a (the app never auto-pages) | [pending] |
| U9 | `403 billing/subscription-inactive` body when the plan is cancelled (optional) | Only if the owner cancels a plan anyway; record the status and the error `code` field only | As documented (403, code `billing/...`) | Adjust the `detail` mapping in `packages/core/src/request/errors.ts` (line 91) | [pending] |
| U10 | Field coverage of a real listing (`listingAgent` / `listingOffice` present? `builder`?) | After a billed search, note which top-level fields are present and their types only (no values) | Matches the schema | Loosen `apps/web/src/lib/data/rentcast/schemas.ts` (lines 62-64 for contacts / builder) | [pending] |
| U11 | Browser fetch from the deployed origin succeeds (CORS) | After deploy (docs/DEPLOY-CHECKLIST.md), run U3 from `https://tranrealestate.github.io/settings/` | 200/400/404 with no CORS error in the console | Revisit the proxy plan (CLAUDE.md STACK: stateless Cloudflare Worker pass-through) | [pending] |
| U12 | Open-ended `*` range bounds (`price=*:1500`, `price=1500:*`, `bedrooms=2:*`) | Three "Narrow on RentCast" searches once Phase 6 ships it (3 calls) | Each returns the documented set (bounds inclusive, `*` open) | Adjust `toRentCastFilterParams` in `packages/core/src/listings/request.ts` (line 35) (Phase 6 "Narrow on RentCast") | [pending] |
| U13 | Highest bedroom bucket in market stats `dataByBedrooms` | One market-stats call for a large ZIP; record the max `bedrooms` bucket value only | Record the value (is "5" meaning 5+, or capped?) | Document in the MarketStats mapper (`byBedrooms` in `apps/web/src/lib/data/rentcast/mappers.ts`) and the Phase 6/7 UI copy | [pending] |
| U14 | Does a listing appear in its own rent-estimate comparables? | One rent estimate for the address of a listing returned by a search; compare ids only | Record yes / no | If yes: Phase 6/7 filter the subject id out of comparables | [pending] |

## Settings steps for the key test (U3-U5)

### A. Valid key (U3, U7)

1. `corepack pnpm dev`, open http://localhost:5173/settings/ and DevTools → Network
   (filter `api.rentcast.io`, "Preserve log" on).
2. Note the RentCast dashboard usage count.
3. In **API keys**, on the RentCast card, paste the dedicated key and click **Save key**.
   Expected: no request to `api.rentcast.io` yet.
4. In **RentCast usage**, read the meter. Expected: "0 of 50 calls used this month" and
   "Cap: 40 · 40 left before your cap · Resets <next month> 1 (UTC)".
5. Back on the RentCast card, click **Test key** (labelled free).
6. Expected: one request, status **404** (or 400); the result line reads
   "RentCast accepted this key. The test didn't use a call."; the meter still reads
   "0 of 50 calls used this month" and shows no "Not counted" line (key tests are not
   searches, fixed in 7506489); the dashboard count is unchanged.
7. **If the status is 200 instead:** the line reads "RentCast accepted this key. The test
   returned data, so it counted as 1 call."; the meter reads "1 of 50 calls used this month";
   the dashboard goes up by 1. Record it and plan the `PROBE_REQUEST` swap (U3 "If different").

### B. Invalid key (U4)

1. Click **Replace key**, paste the same key with its last character changed, **Save key**,
   then **Test key**.
2. Expected: status **401**; line "RentCast didn't accept this key. Check that you copied all
   of it, or create a new key."; meter and dashboard unchanged.

### C. Restricted key (U5)

1. In the RentCast dashboard create a second dedicated key restricted to rental listings only.
2. Replace the key with it, **Save key**, **Test key**.
3. Expected: status **403**; line "RentCast recognized this key but refused the test request.
   If you limited the key to certain endpoints, …"; meter and dashboard unchanged.

### Clean-up

Click **Forget all keys** in API keys, confirm, then revoke both dedicated keys in the
RentCast dashboard.

## How to record

Fill the **Result** column of each row with: date, HTTP status code, dashboard delta
(e.g. `2026-11-02 · 404 · +0`), and `pass` / `fail`. Never paste a response body or a key.
When every row you can run is filled (U6, U8, U9, U12-U14 depend on Phase 6 surfaces or an
optional cancellation and may stay `[pending]`), run `/gsd:verify-work 4`.

## Carried forward (tech debt, not owner checks)

- **tailwind-merge font-size collision** (deferred-items.md, from 04-14): Phase 3 Badge/Button lose
  `text-label` / `text-body` when a variant colour class is merged. A Phase 5+ UI fix
  (`extendTailwindMerge` font-size class group in `$lib/utils.ts` and the `tv()` config). Not a
  Phase 4 data-layer gap; Phase 4 chips build their own class strings and are unaffected.

## Summary

total: 14
passed: 0
issues: 0
pending: 14
skipped: 0
blocked: 0

## Gaps

None. Every item is owner-key-gated, not a code gap.
