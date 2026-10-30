# Microsoft Edge Add-ons listing: Sponsored Listing Filter

Paste-ready copy for Partner Center. The name and short description come from the manifest and are
read-only in Partner Center. Screenshots are an owner HUMAN-UAT item.

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

## Assets

- Logo: `store/edge-logo-300.png` (300 x 300).
- Screenshots (640 x 480 or 1280 x 800): owner HUMAN-UAT item, captured from a live search.
