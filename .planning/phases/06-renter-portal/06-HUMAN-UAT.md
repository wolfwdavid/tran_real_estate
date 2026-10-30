---
phase: 6
slug: renter-portal
status: superseded
superseded_by: .planning/HUMAN-UAT.md
source: [06-VALIDATION.md "Manual-Only Verifications", 06-14/06-19/06-20/06-22 executor notes, 04-HUMAN-UAT.md, 05-HUMAN-UAT.md]
created: 2026-10-05
updated: 2026-10-05
blocking: false
---
> Superseded on 2026-10-30 by `.planning/HUMAN-UAT.md` (Phase 13 ledger). This file is kept as history; record results in the ledger.

# Phase 6: Renter portal UAT (deferred, owner-gated)

**Status: pending until the owner creates the `tranrealestate` GitHub organization, deploys the
site to `https://tranrealestate.github.io/` (docs/DEPLOY-CHECKLIST.md), and creates a real,
endpoint-restricted RentCast key.** These checks do not block Phases 7-11. Automation already
covers every behaviour below with RentCast, the AI providers and OpenStreetMap tiles mocked:
unit and SSR tests, and Playwright on both base paths under the production meta CSP
(`renter-*` specs, including `renter-demo-credible` and the 3-call `renter-journey`). Automation
cannot reach real RentCast payloads, the real OSM tile servers, or real phones.

## Ground rules

- Run from the **deployed origin** `https://tranrealestate.github.io/renter/` (OSM's tile policy
  needs a real Referer; CORS answers depend on the origin).
- Use a **dedicated RentCast key** on the free Developer plan with **no card on file**, so a
  mistake cannot bill. Keep the default "This tab only" key mode. Never commit, paste or
  screenshot a key. Revoke it when done.
- Before you start, note "N of 50 calls used" in Settings → RentCast usage and the count on the
  RentCast dashboard. Each row below lists its expected spend.
- DevTools → Network with "Preserve log" on. Record **status codes, hosts and counts only**,
  never response bodies, addresses or contact details from real listings.
- If a row's result differs from Expected, the "If different" column names the change. Make it in
  a normal GSD plan with its test, not ad hoc.

## Checklist

| # | Check | Expected | If different | Result |
|---|-------|----------|--------------|--------|
| R1 | Real search (1 call): search a real ZIP you know, e.g. your own | Results render; the button showed "(1 call)" first; usage rises by exactly 1; DevTools shows one `GET api.rentcast.io/v1/listings/rental/long-term?zipCode=…&status=Active&limit=500`; no "SchemaMismatch" error card | Parse error: compare the payload's field types with `apps/web/src/lib/data/rentcast/schemas.ts` and widen only the drifted field, with a mapper test | [pending] |
| R2 | Filters, sort, reload, shared URL (0 calls) | Change Max, Bedrooms, a type, Listed within and sort; reload; open the URL in a private window with the same key: usage unchanged after the first search | Any extra call is a budget bug: open a GSD debug session | [pending] |
| R3 | Real OSM tiles (0 RentCast calls) | Map tab shows street tiles, "© OpenStreetMap contributors" bottom-right links to `openstreetmap.org/copyright`; tile requests go only to `tile.openstreetmap.org` with `Referer: https://tranrealestate.github.io/`; no grey "Access blocked" tile; zoom and pan twice: the console shows no CSP violation | Blocked tiles: check the Referer policy in `apps/web/src/app.html` and OSM's tile usage policy; never switch to an unlisted tile host without updating `img-src` in `svelte.config.js` and `scripts/assert-csp.mjs` | [pending] |
| R4 | Split view and pins | At 1280px the Map tab shows the 400px list next to the map, the list follows the map view, pin Enter selects the card | Layout bug: fix in `apps/web/src/lib/features/renter/map/` with its E2E | [pending] |
| R5 | Listing detail from the results (0 calls) | Opening a card is free (no "Look it up again" button); facts, price history, contact links render. If the listing has a history entry with a removal date, the history shows **Delisted** and **Relisted** (06-22 now keeps `removedDate` through the mapper) | Missing history kinds: check the payload's per-entry `removedDate` shape against `toRawHistory` (`apps/web/src/lib/features/renter/listing/history.ts`) | [pending] |
| R6 | Fair-rent check (2 calls) | "Load {zip} rent data (1 call)" spends exactly one `/v1/markets?zipCode=…&dataType=All&historyRange=24`; "Get rent estimate (1 call)" spends exactly one `/v1/avm/rent/long-term`. Note whether the subject listing appears in its own comparables (RESEARCH Pitfall 11) | Subject in comps: plan the exclusion in `packages/core/src/renter/fair-rent.ts` with a test | [pending] |
| R7 | Total journey budget | After R1-R6 plus shortlist, notes, saving the search and the affordability CTA: usage rose by **exactly 3**, matching the RentCast dashboard | Any difference: compare the ledger in Settings → RentCast usage with the DevTools log, then debug | [pending] |
| R8 | Saved-search re-run over a real day | Save a search; reopen the app within 24 hours: 0 calls. Reopen after 24 hours: at most 1 call for that search, and new listings carry "since your last visit" | More than 1 call per 24 hours: debug `apps/web/src/lib/features/renter/saved/` | [pending] |
| R9 | Outreach with a real AI key | With a spend-limited AI key (see 05-HUMAN-UAT ground rules), Draft message streams a draft with no Must fix findings; **Open in email app** opens the phone or desktop mail app with the recipient, subject and body filled; Copy text pastes the same text | Long bodies cut off in a mail client: shorten the mailto body and keep Copy as the full path | [pending] |
| R10 | Zillow / Google look-up links | **Search Zillow** opens a Zillow results page for the address (pattern `/homes/{address}_rb/`, undocumented); **Search Google** opens a results page | Zillow 404: switch to `https://www.zillow.com/homes/{enc}` in `SearchElsewhere.svelte` and its test | [pending] |
| R11 | Real phones (iOS Safari, Android Chrome) | All four renter routes: no sideways scroll at phone width; the map pans with one finger only after a tap on it (page scroll is not trapped); `tel:` opens the dialer and `mailto:` the mail app; tap targets are easy to hit; text zoom to 200% stays readable | Fix the specific component at its root cause and extend `renter-demo-credible.spec.ts` if a width or zoom rule can be automated | [pending] |
| R12 | Screen reader pass (VoiceOver on iOS or macOS, NVDA on Windows) | Search results heading and count are announced after a search; map pins read "$rent a month, address"; selecting a pin announces "selected"; shortlist status changes are announced; dialogs trap and return focus | Fix the announcement or focus at its root cause with a test | [pending] |

## Known limitations recorded for this UAT

- Sample mode never loads map tiles, so R3 is the only check of real imagery.
- The usage meter counts this browser only; the RentCast dashboard is authoritative (Phase 4).
- The listing card renders in the list, the split list and the map preview at once, so the same
  element id appears more than once in the DOM (see `deferred-items.md`). Screen readers resolve
  the card name from the first copy; R12 should confirm the names read correctly.
