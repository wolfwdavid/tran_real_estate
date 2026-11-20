# Microsoft Edge Add-ons listing: Sponsored Listing Filter

Not submitted: on 2026-11-20 the owner decided to distribute through the GitHub Release only. This
file is kept for reference.

Paste-ready copy for Partner Center. The name and short description come from the manifest and are
read-only in Partner Center. Screenshots are captured by `pnpm --filter extension capture:store`
from a synthetic results page (fictional addresses), never from live Zillow, and live in
`store/screenshots/`.

## Name

Sponsored Listing Filter — for Zillow

## Description

Sponsored Listing Filter dims the sponsored and promoted listing cards in Zillow search results, so
the organic listings you came for stand out. Each dimmed card keeps its place on the page and gets a
small "Sponsored — show" button: click it to see that card at full strength, and click it again to
dim it.

The toolbar badge shows how many cards were dimmed on the current page. One switch in the popup
turns the filter on or off, and turning it off shows every card normally.

Collects nothing, sends nothing. The extension makes no network requests, has no analytics, and
never reads prices, addresses or any other listing details. It only changes how cards look on
zillow.com pages and keeps one on/off setting in your browser's extension storage.

Some paid placements carry no visible label; the filter leaves those as they are.

Not affiliated with or endorsed by Zillow Group.

## Single purpose

Dims sponsored and promoted listing cards on Zillow search results so organic listings stand out;
any card can be shown with one click.

## Permission justification: storage

Stores one on/off setting (whether the filter is on) locally in the browser's extension storage.
Nothing else is stored, and nothing is synced or sent anywhere.

## Permission justification: host access to zillow.com

Needed to read the short labels on listing cards (such as "Sponsored" or "Promoted") and to change
how those cards look, on zillow.com pages only. No other site is accessed.

## Remote code: No

All code ships inside the package. The extension loads no remote scripts, makes no network
requests, and its popup's content security policy sets connect-src to 'none'.

## Data collection: None

Collects nothing, sends nothing. No personal data, browsing history, page content or usage data is
collected, stored remotely or shared.

## Privacy policy URL: https://wolfwdavid.github.io/tran_real_estate/legal/privacy/#browser-extension

## Search terms

- sponsored listings
- real estate
- home search
- listing filter
- rentals
- housing
- Zillow

## Category: Shopping

## Website

https://wolfwdavid.github.io/tran_real_estate/

## Support contact detail

https://wolfwdavid.github.io/tran_real_estate/feedback/

## Notes for certification

The extension runs only on zillow.com search results pages. It dims list items that Zillow marks as
advertising slots and cards labelled Sponsored, Promoted or Featured, and adds a small "Sponsored -
show" button to each dimmed card. On live Zillow today only advertising-slot list items are dimmed;
labelled cards are matched by exact short text and may not appear on every search. No account, login
or test data is needed. Open a Zillow rentals or for-sale search and the toolbar badge shows how many
items were dimmed; the popup has one on/off switch. The extension makes no network requests and
reads no listing details; the popup content security policy sets connect-src to 'none'. The
screenshots show a synthetic results page with fictional addresses, not live Zillow.

## Assets

- Logo: `store/edge-logo-300.png` (300 x 300).
- `store/screenshots/01-dimmed-results.png` (1280 x 800)
- `store/screenshots/02-reveal-card.png` (1280 x 800)
- `store/screenshots/03-popup.png` (1280 x 800)

Synthetic fixture page, not live Zillow.
