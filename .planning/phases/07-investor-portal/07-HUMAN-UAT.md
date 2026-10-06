---
phase: 7
slug: investor-portal
status: pending-owner
source: [07-VALIDATION.md "Manual-Only Verifications", 07-12/07-15/07-17/07-18/07-19/07-20/07-21 executor notes, 04-HUMAN-UAT.md, 05-HUMAN-UAT.md, 06-HUMAN-UAT.md]
created: 2026-10-06
updated: 2026-10-06
blocking: false
---

# Phase 7: Investor portal UAT (deferred, owner-gated)

**Status: pending until the owner creates the `tranrealestate` GitHub organization, deploys the
site to `https://tranrealestate.github.io/` (docs/DEPLOY-CHECKLIST.md), creates a real,
endpoint-restricted RentCast key, and has a spend-limited AI key.** These checks do not block
Phases 8-11. Automation already covers every behaviour below with RentCast and the AI providers
mocked: unit, property and SSR tests, and Playwright on both base paths under the production meta
CSP (`tests/e2e/investor/*`, including the keyless and exact-6-call journeys in `demo.spec.ts` and
the axe/CSP/375px `sweep.spec.ts`). Automation cannot reach real RentCast payloads, real AI
output, real print dialogs or real phones.

## Ground rules

- Run from the **deployed origin** `https://tranrealestate.github.io/investor/` (CORS answers
  depend on the origin).
- Use a **dedicated RentCast key** on the free Developer plan with **no card on file**, so a
  mistake cannot bill. Keep the default "This tab only" key mode. Never commit, paste or
  screenshot a key. Revoke it when done.
- Use an AI key with a **hard monthly spend limit** (05-HUMAN-UAT ground rules). One memo is one
  request.
- Before you start, note "N of 50 calls used" in Settings → RentCast usage and the count on the
  RentCast dashboard. Each row lists its expected spend; run the rows in order in one tab.
- DevTools → Network with "Preserve log" on. Record **status codes, hosts and counts only**,
  never response bodies, addresses or contact details from real listings.
- If a row's result differs from Expected, the "If different" column names the change. Make it in
  a normal GSD plan with its test, not ad hoc.

## Checklist

| # | Check | Expected | If different | Result |
|---|-------|----------|--------------|--------|
| I1 | Manual analysis (0 calls) | Open **Analyze a deal**, type an address you know, a price, rent, down payment and two expense lines. Results update as you type. Usage unchanged; DevTools shows no `api.rentcast.io` request | Any request is a budget bug: open a GSD debug session | [pending] |
| I2 | Autofill rent estimate (1 call) | The button reads "Autofill rent estimate (1 call)" before the click. One click: exactly one `GET api.rentcast.io/v1/avm/rent/long-term?address=…`; usage +1; your typed rent is kept and the estimate shows below with "Use this estimate"; no "SchemaMismatch" error card | Parse error: compare the payload's field types with `apps/web/src/lib/data/rentcast/schemas.ts` and widen only the drifted field, with a mapper test | [pending] |
| I3 | Autofill value estimate (1 call) | "Autofill value estimate (1 call)" first; one `GET /v1/avm/value?address=…`; usage +1. Click both buttons again: they read "(0 calls · cached)" and spend nothing | A second call for the same address: debug the canonical key in `packages/core/src/request/` | [pending] |
| I4 | Save, reload, compare (0 calls) | Save the deal, change the rent, **Save as a new deal**, reload. Deals → select both → **Compare 2 deals**: a table at desktop width, stacked cards on a phone; "Highest"/"Lowest" words, never "best". Usage unchanged | Any call: debug | [pending] |
| I5 | Watch a real ZIP (1 call) | Markets → type the ZIP of the deal → "Watch ZIP (1 call)" → exactly one `GET /v1/markets?zipCode=…&dataType=All&historyRange=…`; usage +1. **Open dashboard**: both charts draw from real months, gaps show as breaks, the tables below match the charts. Reload: 0 calls | Missing months or a schema error: check `apps/web/src/lib/data/rentcast/` market mapping (per-month `dataByBedrooms`) with a test | [pending] |
| I6 | Buy box in the watched ZIP (1 call) | Buy boxes → New buy box → Location = that ZIP → "Save and check now (1 call)" → exactly one `GET /v1/listings/sale?…`; usage +1. Matches show quick metrics at once ("Load ZIP rents" absent for that ZIP, because I5 cached its stats). A match in another ZIP offers "Load ZIP rents (1 call)" and spends only on its click | Quick metrics fetching on their own: debug `apps/web/src/lib/features/investor/buybox/` | [pending] |
| I7 | Deep analyze (2 calls) | On a match, "Deep analyze (2 calls)" → exactly one rent and one value estimate request for that listing's address; the analyzer opens with the price "From listing" and the rent chip "RentCast · as of …"; usage +2 | More than 2 or a partial failure that loses the rent: debug `deep-analyze.ts` with a test | [pending] |
| I8 | Total journey budget | After I1-I7 plus a memo and print (I9, I10): usage rose by **exactly 6** (2 autofill, 1 watched ZIP, 1 buy-box check, 2 Deep analyze), matching the RentCast dashboard. Reloading every investor page spends nothing | Any difference: compare Settings → RentCast usage with the DevTools log, then debug | [pending] |
| I9 | Memo with a real AI key (1 AI request, 0 RentCast) | Deals → **Memo** for the saved deal → Draft memo. DevTools: one request to the chosen provider whose body contains `FACTS:` and formatted figures only (no raw decimals like `0.0712345`). The draft streams; the checks read "Number check passed", Fair Housing and advice checks pass, or any flagged number is genuinely absent from the analysis. Copy text, Open in email app and the print link unlock only when nothing is Must fix | A real model often adds figures the analysis lacks: tighten the prompt in the memo prompt definition (`memo.v1`) with a test, never loosen the number check | [pending] |
| I10 | Print to PDF on real browsers | From a passed memo, open the print view. Nothing prints on load; **Print or save as PDF** opens the dialog once. Save as PDF in Chrome (desktop), Safari (macOS and iOS) and Firefox: the not-investment-advice disclaimer is at the top and in the closing "Important" block, tables do not split rows, 1-4 pages, no site header or toolbar. Page numbers appear in Chrome 131+ and Safari 18.2+ only (Firefox ignores margin boxes; expected) | Layout breaks: fix `apps/web/src/lib/features/shared/print/print.css` and extend `print.spec.ts` where Chromium can show it | [pending] |
| I11 | Real phones (iOS Safari, Android Chrome) | All nine investor routes and the print view: no sideways scroll at phone width, also with text zoom at 200%; the compare view stacks; chart tables are reachable; cost buttons wrap instead of overflowing; tap targets are easy to hit | Fix the component at its root cause and extend `sweep.spec.ts` if the rule can be automated | [pending] |
| I12 | Screen reader pass (VoiceOver on iOS or macOS, NVDA on Windows) | Autofill announces "Rent estimate filled: … from RentCast." or "Your number was kept"; the compare table reads its caption and row/column headers; each chart reads its title and summary and the data table follows; the memo's Must fix marks open a popover that traps and returns focus | Fix the announcement or focus at its root cause with a test | [pending] |
| I13 | Deployed CSP and hosts | On every investor route and the print view, the console shows no CSP violation; the only third-party hosts contacted are `api.rentcast.io` and the chosen AI provider | A new host: it must be added to `connect-src` in `svelte.config.js` and `scripts/assert-csp.mjs` with a reason, or the request removed | [pending] |

## Owner sign-off on copy and known limitations

| # | Item | What to decide | Result |
|---|------|----------------|--------|
| S1 | Unspecified save message (07-12) | Saving with price or rent blank announces "Enter a purchase price and monthly rent before saving." and focuses the missing field. The UI-SPEC has no string for this case. Approve the wording or supply a replacement | [pending] |
| S2 | Notes-only numbers are blocked at print (07-19) | A memo that quotes a number found only in the user's memo notes passes on the memo page but is blocked at the print view, because the print re-check cannot see the notes (they are not stored with the memo). It fails closed: nothing unchecked reaches the printout. Accept as is, or plan the fix (store the notes' allowed numerals in the memo artifact's `meta` and pass them to the print re-check, with a test) | [pending] |

## Known limitations recorded for this UAT

- The usage meter counts this browser only; the RentCast dashboard is authoritative (Phase 4).
- Sample mode answers only the three sample metros; a real address outside them shows the
  "outside sample coverage" state until a key is added (Phase 4 behaviour).
- `bestInRow` (07-07) is an internal function name only; no user-facing copy says "best"
  (asserted by `deals.spec.ts`).
