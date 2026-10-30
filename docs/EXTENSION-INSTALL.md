# Sponsored Listing Filter — for Zillow: install guide

Sponsored Listing Filter dims the sponsored and promoted listing cards in Zillow search results so
organic listings stand out. You can show any dimmed card with one click.

## Install from a release zip (Chrome, Edge, Brave)

1. Open the project's GitHub Releases page and download two files from the latest `ext-v<version>`
   release: `sponsored-listing-filter-<version>-chrome.zip` and `SHA256SUMS.txt`. The same zip
   works in Chrome, Edge and Brave.
2. Check that the zip is the one the release published. The hash you see must match the line for
   the zip in `SHA256SUMS.txt`.
   - Windows (PowerShell): `Get-FileHash -Algorithm SHA256 sponsored-listing-filter-<version>-chrome.zip`
   - macOS: `shasum -a 256 sponsored-listing-filter-<version>-chrome.zip`
   - Linux (run in the download folder): `sha256sum -c SHA256SUMS.txt`
3. Unzip into a permanent folder, for example `Documents/sponsored-listing-filter`. The browser
   loads the extension from this folder every time it starts.
   Deleting the folder uninstalls the extension.
4. Open the extensions page:
   - Chrome or Brave: go to `chrome://extensions` (Brave also accepts `brave://extensions`).
   - Edge: go to `edge://extensions`, or open **Settings and more › Extensions › Manage
     extensions**.
5. Turn on **Developer mode** (top right in Chrome and Brave, left side in Edge).
6. Click **Load unpacked** and choose the unzipped folder, the one that contains `manifest.json`.
7. Pin the extension: open the browser's extensions menu (the puzzle-piece icon) and pin
   Sponsored Listing Filter so its count badge stays visible.
8. Reload any Zillow tabs that were already open. The browser starts the filter only in pages
   loaded after the install, so an older tab shows "Reload the Zillow page to start it" in the
   popup until you reload it.

### Updating

Installs from a zip never update on their own. To move to a new release:

1. Download and check the new zip and `SHA256SUMS.txt` as in steps 1 and 2.
2. Replace the contents of your permanent folder with the new unzipped files.
3. On the extensions page, click **Reload** on the Sponsored Listing Filter card.
4. Refresh your open Zillow tabs.

Managed or work devices may not allow developer-mode extensions. If **Developer mode** is greyed
out, ask your administrator, or use the Microsoft Edge Add-ons listing below once it is live.

## Install from Microsoft Edge Add-ons

The listing link will appear here once the Microsoft Edge Add-ons listing is live. Installs from
Edge Add-ons update automatically.

## What it does

- Dims listing cards that Zillow labels Sponsored, Promoted or Featured, plus the advertising slots
  in the results list.
- Puts a "Sponsored — show" button on each dimmed card. Click it to show that card at full
  strength; click it again to dim it.
- Shows how many cards it dimmed on the current page, in the toolbar badge and in the popup.
- Has one setting: the "Dim sponsored listings" switch in the popup. Turn it off and every card
  shows normally.

Some paid placements carry no visible label on the page. The filter leaves those as they are,
because it only acts on what you can see.

## What it doesn't do

- It makes no network requests and has no analytics.
- It never reads prices, addresses or any other listing details.
- It never takes a card off the page. Dimmed cards stay in place and stay clickable.
- It runs only on zillow.com pages.

## Privacy

The extension stores one setting, on or off, in your browser's extension storage. Nothing else is
stored and nothing is sent anywhere. The full statement is in the Tran privacy policy:
https://wolfwdavid.github.io/tran_real_estate/legal/privacy/#browser-extension

Not affiliated with or endorsed by Zillow Group.
