---
phase: 06-renter-portal
plan: 14
subsystem: renter-listing-detail
tags: [renter, listing-detail, shortlist, prerender, query-param, security, e2e, tdd, a11y]
requires:
  - "06-03 @tran/core/renter contact-links (telHref, formatPhone, mailtoHref, safeHttpUrl, outboundSearchLinks, looksLikeListingId), format, labels"
  - "06-08 needsRemoveConfirm, ShortlistItem"
  - "06-09 E2E harness (net fixture, mockRentCast, withRentCastKey, rentcastFixtures)"
  - "06-10 PropertyTypeMark, PriceHistory, ListingStatusChip"
  - "06-11 getShortlistRepo, listingByIdRequest, gateway peekListingById / rentalListingById"
  - "Phase 4 ProvenanceChip/ProvenanceRow/CostLabel/GatewayError, runtime.requestSpend"
provides:
  - "features/renter/listing/resolve.ts: resolveListing(id, deps), fetchListingById(id, deps), ResolvedListing, ResolveDeps, ListingSource"
  - "features/renter/listing/address.ts: streetLine(row), placeLine(row)"
  - "features/renter/listing: ListingDetail, ListingHeader, RentAndActions, ListingFacts, ListingContact, SearchElsewhere, ListingNotFound"
  - "features/renter/shortlist/ShortlistToggle.svelte (variant card | detail; props row, provenance, variant, streetLine)"
  - "Stubs owned next by 06-17 (fair-rent/FairRentCheck.svelte) and 06-18 (outreach/OutreachSection.svelte), props { row, provenance }"
  - "Route /renter/listing/?id= with resolved / not-found / loading states and matching titles"
  - "@tran/core Listing gains optional addressLine2 and hoaFee (mapper always sets them)"
affects: [06-15 shortlist board (reuses the toggle's confirm pattern), 06-17 fair rent, 06-18 outreach, 06-19 map (detail links), 06-22 gate, Phase 7 (Listing.addressLine2 / hoaFee available to sale listings)]
tech-stack:
  added: []
  patterns:
    - "Prerendered query-param route: `$derived(browser ? page.url.searchParams.get('id') : null)` + a read-only $effect that resolves; spending only in click handlers"
    - "Values held in $state are deep proxies: pass `$state.snapshot(x)` to anything that structuredClones (Dexie repos)"
    - "A ConfirmDialog trigger that unmounts on confirm: preventDefault in onCloseAutoFocus and focus the replacement via an effect once the liveQuery swaps it in"
key-files:
  created:
    - apps/web/src/lib/features/renter/listing/resolve.ts
    - apps/web/src/lib/features/renter/listing/resolve.test.ts
    - apps/web/src/lib/features/renter/listing/address.ts
    - apps/web/src/lib/features/renter/listing/listing-ui.test.ts
    - apps/web/src/lib/features/renter/listing/ListingDetail.svelte
    - apps/web/src/lib/features/renter/listing/ListingHeader.svelte
    - apps/web/src/lib/features/renter/listing/RentAndActions.svelte
    - apps/web/src/lib/features/renter/listing/ListingFacts.svelte
    - apps/web/src/lib/features/renter/listing/ListingContact.svelte
    - apps/web/src/lib/features/renter/listing/SearchElsewhere.svelte
    - apps/web/src/lib/features/renter/listing/ListingNotFound.svelte
    - apps/web/src/lib/features/renter/shortlist/ShortlistToggle.svelte
    - apps/web/src/lib/features/renter/shortlist/ShortlistToggle.browser.test.ts
    - apps/web/src/lib/features/renter/shortlist/testing/ProxiedToggle.svelte
    - apps/web/src/lib/features/renter/fair-rent/FairRentCheck.svelte
    - apps/web/src/lib/features/renter/outreach/OutreachSection.svelte
    - apps/web/tests/e2e/renter-listing.spec.ts
  modified:
    - apps/web/src/routes/(app)/renter/listing/+page.svelte
    - packages/core/src/listings/types.ts
    - apps/web/src/lib/data/rentcast/mappers.ts
    - apps/web/src/lib/data/rentcast/mappers.test.ts
key-decisions:
  - "Resolution order is shortlist snapshot -> gateway.peekListingById (cache in live mode, fixtures in sample mode) -> not found; canFetch = live mode AND looksLikeListingId. resolveListing never spends."
  - "fetchListingById spends through the injected runtime.requestSpend (so the over-cap prompt applies), falling back to gateway.rentalListingById. NoResults ends the lookup (canFetch false); a dismissed cap prompt returns canFetch true with no error."
  - "A shortlist snapshot resolves with stale: false; its chip shows the original fetchedAt."
  - "Below 1024px the single aside (rent + toggle, contact, look-it-up-elsewhere) follows the header; the aside is sticky only when the viewport is at least 1024px wide AND 896px tall, so a tall aside never hides its own end."
  - "Listing gains optional addressLine2 and hoaFee (Rule 2): the Phase 4 mapper dropped RentCast's unit line and HOA fee, and the detail must show both."
  - "Live header Refresh (1 call) re-fetches by id; its onRefresh rethrows after rendering GatewayError so ProvenanceRow never announces a refresh that failed."
  - "Zillow pattern kept as /homes/{address}_rb/: both candidate URLs answer 403 to curl (CloudFront bot wall), so the check cannot tell them apart."
requirements-completed: []
metrics:
  duration: ~28min
  completed: 2026-10-05
  tasks: 2
  files: 21
---

# Phase 6 Plan 14: Listing detail route Summary

**`/renter/listing/?id=` opens any listing at 0 calls from the shortlist snapshot, the cache or the sample fixtures. It shows the facts, the dated price history and safe tel:/mailto:/http(s) contact links, and its shortlist toggle follows the remove-confirmation rule. One explicit "Look it up again (1 call)" click is the only way it spends.**

Advances RENT-03 (listing detail with price history and listing agent/office contact) and RENT-05 (shared shortlist toggle). Both stay open until the 06-22 gate, so `requirements mark-complete` was not run.

## Tasks

| # | Task | Commits |
| --- | --- | --- |
| 0 | (Rule 2) Unit line and HOA fee on mapped listings | d5f0902 |
| 1 | 0-call listing resolver and ShortlistToggle | c1627c0 (RED), 4d2627b (GREEN) |
| 2 | Detail components, section stubs, route and E2E | 7fae148 |

## What the tests prove

- **resolve.test.ts (12, Node, real runtime gateways through `$lib/data` + real shortlist repo on fake-indexeddb):**
  - A null or empty id is missing-id. A malformed or `javascript:` id is not-found with canFetch false. Neither calls the gateway or fetch.
  - A shortlisted id resolves from the snapshot, and `peekListingById` is never called. A removed item falls through.
  - A cached search row resolves as `cache` with the original fetchedAt. A fixture id resolves as `sample`. Both make 0 fetches.
  - In live mode an unknown valid id is not-found with canFetch true and 0 fetches. In sample mode it can't be fetched, and `fetchListingById` makes no request either.
  - `fetchListingById` makes exactly 1 request to the percent-encoded by-id path. A second resolve hits the cache, still at 1. With a `spend` helper injected, the helper is used and `rentalListingById` is not. A 404 gives NoResults with canFetch false.
- **listing-ui.test.ts (10, SSR):** all 9 facts appear in order with formatted values. Missing values show "Not listed" 8 times and never 0, and a studio reads "Studio". The contact rows contain only safe hrefs, with an agent→office fallback. `javascript:`/`data:` values and an email with `?body=` render nothing. The empty-contact copy and the sample chip show. There are 3 outbound links (google/zillow/google). Both not-found variants are covered, and the button's name includes "(1 call)".
- **ShortlistToggle.browser.test.ts (5, Chromium):** a plain item saves and is removed without a dialog. An item with notes opens the dialog with focus on "Keep it", and keeping it returns focus to the toggle. "Remove listing" moves focus to the new "Save to shortlist" button. The card variant's names and aria-pressed are covered. A `$state`-proxied row saves. axe is clean.
- **renter-listing.spec.ts (7 × root/sub = 14):**
  - Keyless sample detail: h1 is the street line, 9 `dt`, "$320 a month" HOA, the history table or the no-changes line, `tel:+1` and mailto links, sample chips on the header and the contact card, no "Look it up elsewhere", the sample-chip rule holds, 0 RentCast calls, axe clean.
  - Missing id and unknown keyless id: the right body, and no paid lookup.
  - Live unknown id: the button shows "(1 call)" with 0 calls made. A click sends exactly one request to `long-term/74201-Unknown-Ln`, which ends at NoResults.
  - Live known id: one call, the h1 takes focus, the "RentCast · as of" chip, "Refresh (1 call)", and 3 elsewhere links on www.google.com / www.zillow.com. A reload still shows 1 call. axe is clean.
  - Shortlist: save, reload (snapshot path), then remove without a dialog.
  - Unsafe contact values (a later `page.route` override): no `javascript:` href, no tel row, no "Visit website".
  - `--repeat-each 2`: 28/28.

## Mutation checks (not committed; restored)

| Mutation | Killed by |
| --- | --- |
| `add(row, provenance)` without `$state.snapshot` | browser "saves a deeply proxied row" (and E2E shortlist test, found first) |
| Focus restore by `tick()` only (first draft) | browser "Remove listing … focus lands on Save to shortlist" |

## Verification

- `corepack pnpm vitest run --project web src/lib/features/renter/listing`: 22/22. `test:unit`: 153 files / 3058 tests passed.
- `vitest --project web-browser src/lib/features/renter/shortlist`: 5/5.
- `pnpm --filter web check`: 0 errors, 0 warnings. ESLint and Prettier are clean on every touched file. `pnpm banned`: passed (142 files).
- `build:root` + `build:sub` + `csp:assert`: 17 pages per base. Run under `.tools/build.lock`, which was released.
- `playwright test renter-listing routing a11y csp layout routes-drift`: 382 passed.
- `grep -c "url.searchParams" "apps/web/src/routes/(app)/renter/listing/+page.svelte"` = 1. It is the guarded expression.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] HOA fee and unit line were dropped by the Phase 4 mapper**
- **Found during:** Task 1 (reading the `Listing` type)
- **Issue:** The detail must show the HOA fee ("$120 a month") and the street line uses `addressLine2`. Neither survived `mapListing`, although the RentCast schema validates both.
- **Fix:** I added optional `addressLine2?` and `hoaFee?` to core `Listing`. They're optional so existing hand-built rows still type-check. The mapper always sets them, and two mapper tests were added.
- **Files:** packages/core/src/listings/types.ts, apps/web/src/lib/data/rentcast/mappers.ts(+test)
- **Commit:** d5f0902

**2. [Rule 1 - Bug] Saving from the detail page threw DataCloneError (silently)**
- **Found during:** Task 2 E2E
- **Issue:** The page holds the resolved row in `$state`, so the toggle received a deep proxy, and the repo's `structuredClone` rejected it. The browser component test passed plain props, so it missed this.
- **Fix:** The toggle now passes `$state.snapshot(row)` and `$state.snapshot(provenance)`. A `testing/ProxiedToggle.svelte` browser test covers it and is mutation-checked.
- **Commit:** 7fae148

**3. [Rule 1 - Bug] Focus was lost after "Remove listing"**
- **Found during:** Task 1 browser test
- **Issue:** The dialog trigger unmounts when the liveQuery reports the removal, so bits-ui's focus return targets a detached node.
- **Fix:** `onCloseAutoFocus` prevents the default. On "Keep it" the trigger is refocused. After a removal, an effect focuses the replacement button once `confirmFirst` flips.
- **Commit:** 4d2627b

**4. E2E keyless path skips "Try a sample search"**
- The plan ran the sample search on `renter/` first. That button belongs to the parallel 06-13. Sample mode resolves fixture ids straight from `peekListingById` at 0 calls, so the spec opens the detail URL directly. This also makes it a stronger "deep link works" check.

**5. The unsafe-website override uses a URL predicate**
- A glob string route registered after `mockRentCast` did not take precedence for the by-id URL. A `(url) => url.pathname === …` matcher does, and the test now proves the override is active.

**6. Additive**
- `address.ts` (streetLine/placeLine) and `listing-ui.test.ts` were added beyond the file list. The live header has "Refresh (1 call)", following the Phase 4 ProvenanceRow convention.

## Known Stubs

- `apps/web/src/lib/features/renter/fair-rent/FairRentCheck.svelte`: h2 "How this rent compares" only. 06-17 owns and fills it.
- `apps/web/src/lib/features/renter/outreach/OutreachSection.svelte`: h2 "Message the listing contact" only. 06-18 owns and fills it.

Both are intentional per the plan. The detail's RENT-03 goal (facts, history, contact) doesn't depend on them.

## Notes for downstream plans

- 06-15: the toggle's confirm pattern is in `ShortlistToggle.svelte`. Pass `$state.snapshot()` of any `$state` value to repo writes.
- 06-17/06-18: the props are `{ row: Listing; provenance: Provenance }`. The section card classes match the UI-SPEC.
- Mapped history drops RentCast's per-entry `removedDate`, so "Delisted"/"Relisted" events can't appear from mapped rows yet. That's a Phase 4 mapper limitation and is noted for 06-22.

## Self-Check: PASSED
