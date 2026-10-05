---
phase: 06-renter-portal
plan: 03
subsystem: core/renter
tags: [renter, listing-detail, security, formatting, tdd]
requires: []
provides:
  - "@tran/core/renter history: historyEvents, historySummary, pricePoints, RawHistory, HistoryEvent"
  - "@tran/core/renter sparkline: sparklinePath, lastPoint"
  - "@tran/core/renter contact-links: telHref, formatPhone, mailtoHref, safeHttpUrl, outboundSearchLinks, looksLikeListingId"
  - "@tran/core/renter listing-status: listingStatus, ListingStatus"
  - "@tran/core/renter format: formatRent, formatMonthDay, formatMonthDayYear, formatMonthYear, relativeListed, formatSqft, formatDistance, formatPercent"
affects: [06-listing-detail-components, 06-results-cards, 06-shortlist]
tech-stack:
  added: []
  patterns: ["URL protocol allowlist (http/https) for third-party hrefs", "UTC calendar-day math by hand, no date-fns"]
key-files:
  created:
    - packages/core/src/renter/history.ts
    - packages/core/src/renter/sparkline.ts
    - packages/core/src/renter/contact-links.ts
    - packages/core/src/renter/listing-status.ts
    - packages/core/src/renter/format.ts
    - packages/core/src/renter/{history,sparkline,contact-links,listing-status,format}.test.ts
  modified:
    - packages/core/src/renter/index.ts
decisions:
  - "relativeListed says 'N days ago' up to 30 days, then 'on Mon D, YYYY'"
  - "listingStatus is 'gone' only on explicit Inactive status or a removedDate; an unknown/null status falls through to recency so Tran never claims a delisting RentCast did not report"
  - "historyEvents: first entry is 'listed'; entry after a delisting is 'relisted'; same-price entries are skipped; non-date keys ignored"
  - "historySummary 'many' uses the original listed rent/date as first and the latest rent change as last"
  - "UTC day-diff helper duplicated locally in format.ts and listing-status.ts (not exported) with TODO(06-07) to unify with filters.ts utcDayDiff"
metrics:
  duration: "~6 min"
  completed: "2026-10-05"
  tasks: 2
  files: 11
---

# Phase 6 Plan 03: Listing Detail Helpers Summary

Pure, tested RENT-03 helpers: RentCast date-keyed history into a newest-first Listed/Rent changed/Delisted/Relisted event list with signed changes and a summary, a DOM-free sparkline path, injection-safe tel:/mailto:/http(s) links plus outbound search links, honest recent/stale/gone recency, and shared whole-dollar/UTC formatters.

## Tasks

| Task | Name | Commits |
| ---- | ---- | ------- |
| 1 | History, sparkline and format helpers | 43f09a5 (RED), dd165f4 (GREEN) |
| 2 | Safe contact links, outbound links, id check, listing status | 4ea6fe7 (RED), 21157de (GREEN) |

## Verification

- `corepack pnpm vitest run --project core` on my 5 renter test files: 38/38 pass.
- `corepack pnpm --filter @tran/core check`: clean.
- `corepack pnpm guard`: passed (880 files). Planted phone/email in tests are assembled from fragments and use 555-01xx / example.com.
- `grep -ci available listing-status.ts` = 0.
- The full `packages/core/src/renter` run had one failing suite, `affordability.test.ts`. That suite is sibling 06-02's in-progress RED, not this plan's.

## Requirement advanced

RENT-03 (listing detail). The requirement stays open until the 06-22 gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] An unknown listing status is not treated as gone**
- The plan says `Inactive` or `removedDate` means gone. The implementation does exactly that, case-insensitive, and an unknown or null status falls through to recency, so the copy never says "No longer listed" without evidence.
- Commit: 21157de

**2. [Rule 2 - Security] telHref/formatPhone reject letters**
- Input must contain only digits, spaces, `()`, `.`, `+` and `-` before stripping non-digits. A value like `javascript:4055550142` can't be laundered into a valid tel: link.
- Commit: 21157de

### Parallel-wave note

- The `index.ts` commit 21157de also captured 06-01's working-tree line `export * from './filters.js'`, because the file is shared and 06-01 had already edited it. At commit time `filters.ts` was still untracked (06-01 GREEN pending). HEAD briefly references a module that isn't committed until 06-01 commits `filters.ts`. I didn't rewrite history mid-wave. The orchestrator should confirm `filters.ts` is committed after the wave.

## Known Stubs

None.

## Self-Check: PASSED
