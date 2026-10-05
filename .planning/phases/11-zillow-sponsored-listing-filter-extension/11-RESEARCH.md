# Phase 11: Zillow Sponsored Listing Filter Extension - Research

**Researched:** 2026-10-04
**Domain:** MV3 browser extension (WXT 0.21 + Svelte 5 popup) on a third-party SPA, zero-network privacy proof, GitHub Releases + Edge Add-ons distribution
**Confidence:** MEDIUM overall. Tooling (WXT, Vitest, happy-dom, Edge policies) is HIGH because it was verified against source code at the pinned tags and official docs. Zillow DOM signals are MEDIUM/LOW: they come from one archived 2026-09-15 snapshot plus OSS scripts, and paid "Featured" rentals showed **no visible label** in that snapshot.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

The owner chose fully autonomous mode on 2026-10-04. Recommended defaults adopted.

**Detection & behavior**
- **Label-text/ARIA-first detection** ("Sponsored", "Featured", "Promoted", "Ad") within listing-card containers, plus a **versioned selectors file** (`selectors.v1.json`) as a secondary hint; no reliance on obfuscated class names alone.
- Scoped, debounced `MutationObserver` on the results container + WXT `locationchange` for SPA navigation.
- **Dim-with-reveal** default (opacity + "Sponsored — show" button injected with accessible label); the card is never removed from DOM (no layout shifts, no "hide" mode in v1).
- **Synthetic-DOM matcher tests** (Vitest + happy-dom/jsdom fixtures capturing 3+ card variants) — fixtures are hand-written HTML approximating structure, no copied Zillow markup/assets.

**Popup & branding**
- Svelte popup using Phase 2 brand tokens: toggle, hidden-count, "collects nothing, sends nothing" line, "Not affiliated with or endorsed by Zillow Group" line, link to the Tran privacy page. No Zillow logo/colors.
- Name: "Sponsored Listing Filter — for Zillow" (nominative use); single purpose statement.

**Privacy & permissions**
- Manifest permissions exactly `["storage"]` + host permission `*://*.zillow.com/*`; no `tabs`, no `webRequest`. A test asserts the manifest and a static scan asserts no `fetch`/`XMLHttpRequest`/`WebSocket`/`sendBeacon` in extension source. Settings stored in `chrome.storage.local`.

**Distribution**
- `wxt zip` artifacts attached to GitHub Releases by a tag-triggered workflow (gated like the Pages deploy — runs only when the remote exists); `docs/EXTENSION-INSTALL.md` with load-unpacked steps; Edge Add-ons submission is an owner HUMAN-UAT item (account needed). Firefox optional/deferred.

**Owner-gated items (non-blocking)**
- Manual read of Zillow Terms of Use before any public release (automated fetch 403s) — recorded as HUMAN-UAT; Edge Partner Center account.

### Claude's Discretion
- WXT version pin (verify stability at planning), debounce timing, popup layout.

### Deferred Ideas (OUT OF SCOPE)
- Chrome Web Store listing (EXT-V2-02, $5), Tran-site install page (EXT-V2-01), hide mode, Firefox listing.

**Specific idea (locked):** Never scrape, extract, or transmit listing data. The extension only toggles presentation.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXT-01 | Zillow user with the extension installed sees sponsored or promoted listing cards dimmed, with a one-click reveal on each | §Zillow DOM Signals (label vocabulary, ad-slot `data-testid`, card roots, badge scopes); Pattern 2 (reconcile loop, recycled-node safety); Pattern 3 (scoped observer + `wxt:locationchange`); Pattern 4 (shadow-root reveal button with constructable stylesheet); fixtures plan in Validation Architecture |
| EXT-02 | User can toggle the filter on/off and see the count of hidden sponsored listings from the toolbar popup | Pattern 5 (`@wxt-dev/storage` item `local:filterEnabled` + `watch`; popup ↔ content script `tabs.sendMessage` with `sendResponse`, no `tabs` permission needed); brand tokens via `themeVars()` |
| EXT-03 | Extension makes no network requests and collects no data (permissions limited to storage and zillow.com) | Pattern 6 (three-layer zero-network proof: ESLint source ban, built-bundle token scan with planted-violation control, popup CSP `connect-src 'none'`); manifest oracle `scripts/assert-extension.mjs`; avoid `createShadowRootUi` + `cssInjectionMode:'ui'` (it bundles a `fetch()` and adds `web_accessible_resources`) |
| EXT-04 | User can install from a GitHub Releases zip (load-unpacked instructions), Microsoft Edge Add-ons, or Firefox Add-ons | Pattern 7 (tag-triggered, var-gated release workflow using `gh release create`, SHA256SUMS, reusing existing SHA pins); `docs/EXTENSION-INSTALL.md` steps verified against Microsoft sideloading docs; Edge Partner Center requirements (≥250-char description, 300×300 logo, privacy URL, single-purpose + permission justification, no references to other browsers) |
</phase_requirements>

## Summary

WXT **0.21.4** (published 2026-08-11, latest stable, Node ≥22, Vite ^8 peer) is the right framework and matches the repo's Vite 8 / TS 6 / Node 24 pins. Version 0.21 made `vite` a **required peer** and `web-ext` an **optional** one. Install `vite@8.3.0` in the extension package and leave `web-ext` out. The popup uses `@wxt-dev/module-svelte@2.0.5`. The content script should be plain TypeScript built from dependency-injected, pure modules (detector, reconciler, observer, reveal-host), so happy-dom tests drive them directly and the entrypoint is a thin wiring layer. Two verified traps decide the design. First, WXT's `createShadowRootUi` combined with `cssInjectionMode: 'ui'` **bundles a `fetch()` call and adds `web_accessible_resources`** (source: `shadow-root.ts` and `manifest.ts` at tag `wxt-v0.21.4`). That breaks the zero-network bundle scan and lets the page fingerprint the extension. Build the per-card shadow root by hand with a shared constructable stylesheet, and put dimming CSS in the manifest-injected content-script stylesheet. Second, dev mode silently adds the `tabs` and `scripting` permissions, so the manifest oracle must run against the **production** `.output/chrome-mv3/manifest.json`.

The Zillow DOM signals are the weakest part of this phase, and the plan must be honest about that. In an archived 2026-09-15 snapshot, Zillow search results use `#grid-search-results` › `ul` › `li[data-c11n-component="List.Item"]`. Cards are `article[data-testid="property-card"]` (note **`data-testid`**; older scraper write-ups say `data-test`). Badges render in `[data-c11n-component="PropertyCard.Badge"]`, and interleaved **ad slots** are `li[data-testid="search-list-{first,second,third}-ad"]`. Those ad slots are the most concrete paid-placement signal (Zillow's own Boost docs describe "display advertisement on the first search results pages"). Card badges carry organic text too ("Showcase", "Special Offer", "Gas fireplace"). Label matching must therefore be **exact-token on short text**, never a substring of card text. The rentals snapshot's embedded page state contained `"isFeatured":true` while **no card showed a visible "Featured" label**. Reading that JSON would be listing-data extraction, which is locked out, so some paid placements may be undetectable by design. The selectors file must be easy to update, and a HUMAN-UAT live smoke on zillow.com is mandatory.

The zero-network claim is proven in three layers. (1) An extension-scoped ESLint ban covers network globals and APIs. (2) A built-bundle token scan runs over `.output/chrome-mv3/**` with a planted-violation control, which follows the repo's existing `assert-csp.mjs` + mutation-test pattern. (3) A strict popup CSP (`connect-src 'none'`) enforces it at runtime. Distribution reuses the three SHA pins already in `ci.yml`, publishes with the preinstalled `gh` CLI (no new third-party action), and gates on a new repo variable just like `PAGES_ENABLED`. The archived Zillow Terms of Use (version "Updated October 28, 2025") forbid users to "reproduce, **modify**, distribute, display … any portion of the Services". A hide-only extension sits in a grey zone here, so the owner's manual ToU read before public release is a real gate, not a formality.

**Primary recommendation:** Scaffold `apps/extension` on WXT 0.21.4 with `imports: false`, a hand-rolled closed shadow-root reveal button, manifest CSS for dimming, a data-driven `selectors.v1.json`, and DI'd pure modules tested in happy-dom. Prove EXT-03 with a production-manifest oracle and a bundle scan, both mutation-tested.

## Standard Stack

### Core
| Library | Version (verified npm 2026-10-04) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `wxt` | **0.21.4** (2026-08-11; latest; next=0.20.0-beta2 is older) | MV3 build, manifest generation, `wxt zip`, `wxt:locationchange`, `ContentScriptContext` | Project stack decision. Peers: `vite ^6.3.4‖^7‖^8`, `typescript >=5.4` (optional), `web-ext >=9.2` (optional). Engines Node ≥22. |
| `vite` | **8.3.0** (same as `apps/web`) | Required WXT peer since 0.21 | v0.21 upgrade guide: "`vite` is a required peer, add it to your devDependencies" |
| `@wxt-dev/module-svelte` | **2.0.5** | Svelte compilation for the popup entrypoint | Peers `wxt >=0.18.6`, `svelte >=5`. Depends on `@sveltejs/vite-plugin-svelte >=4`, so pin it to **7.3.0** to match web. |
| `svelte` | **5.57.0** | Popup UI | Workspace pin |
| `@tran/brand` | `workspace:*` | Tokens via `themeVars()` (Phase 2 contract) | Phase 2 UI-SPEC: "The extension popup (Phase 11) imports `@tran/brand` directly." |
| `@fontsource-variable/fraunces`, `@fontsource-variable/inter` | **5.3.0** | Popup fonts only (never injected into Zillow) | Phase 2 brand fonts, self-hosted |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `wxt/utils/storage` (bundled `@wxt-dev/storage` 1.3.0) | via wxt | `storage.defineItem<boolean>('local:filterEnabled', { fallback: true })`, `.watch()` | The only persisted setting. Do not add a storage dependency. |
| `wxt/browser` | via wxt (`@wxt-dev/browser` 0.3.4) | Typed `browser.*` (chrome-style promises) | All extension API calls. No `webextension-polyfill` (removed in WXT 0.20). |
| `wxt/testing/vitest-plugin` + `wxt/testing/fake-browser` | via wxt (`@webext-core/fake-browser` 2.0.1) | Mocks `wxt/browser`, in-memory `storage` | Storage and popup-model tests. **Must pass `{ root: import.meta.dirname }`** under the root `projects` harness. |
| `happy-dom` | **20.14.5** (2026-09-12) | DOM for matcher/observer/shadow tests | Supports `MutationObserver`, `attachShadow`, `adoptedStyleSheets` + `CSSStyleSheet.replaceSync` (verified in happy-dom source). Vitest 4.1.11 peers `happy-dom: *`. |
| `vitest` | **4.1.11** | Test runner | Workspace pin (not 5.x) |
| `svelte-check` | **4.7.6** | Typecheck popup | Workspace pin |
| `@sveltejs/vite-plugin-svelte` | **7.3.0** | Needed in the extension's Vitest config only if a popup mount test is written (WxtVitest does NOT load module plugins) | Optional |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled closed shadow root + constructable sheet | WXT `createShadowRootUi` | `createShadowRootUi` is async, built for one UI rather than ~40 per-card hosts, and its `cssInjectionMode:'ui'` path calls `fetch(browser.runtime.getURL(...))` and adds `web_accessible_resources`. Both break EXT-03 evidence. Rejected. |
| happy-dom | jsdom 30.1.2 | jsdom lacks constructable stylesheets (`replaceSync`). Its engines (`^22.22.2‖^24.15‖>=26`) are fine on Node 24.21. happy-dom is faster and covers what we need. |
| `tabs.sendMessage` for the count | Background SW + `action.setBadgeText` | A badge looks nice but adds a background entrypoint and manifest surface. Popup-only satisfies EXT-02. Defer the badge. |
| `gh release create` (preinstalled) | `softprops/action-gh-release` | It would be another third-party `uses:` to SHA-pin and audit. `gh` ships on `ubuntu-24.04` runners. |
| Playwright-rendered icons (one-off script) | `@wxt-dev/auto-icons` | auto-icons pulls `sharp`, a native build-script dependency, into pnpm 11's `allowBuilds`. The icons are static, so render them once and commit. |

**Installation (from repo root):**
```bash
corepack pnpm --filter extension add -D wxt@0.21.4 vite@8.3.0 @wxt-dev/module-svelte@2.0.5 @sveltejs/vite-plugin-svelte@7.3.0 svelte@5.57.0 svelte-check@4.7.6 typescript@~6.0.3 vitest@4.1.11 happy-dom@20.14.5 "@tran/brand@workspace:*" @fontsource-variable/fraunces@5.3.0 @fontsource-variable/inter@5.3.0
```
(Create `apps/extension/package.json` by hand first. Do **not** run `wxt init`, because it adds `web-ext` and template icons.) After install, if pnpm 11 reports ignored dependency build scripts, add each one explicitly to `allowBuilds` in `pnpm-workspace.yaml` (true/false). Never blanket-allow.

## Zillow DOM Signals (research focus 1)

All observations below come from **archived snapshots on web.archive.org** (`/homes/for_sale/` 2026-09-15 and `/homes/for_rent/` 2026-09-15, both San Francisco) plus OSS scripts. Zillow itself was **not** fetched. Nothing below may be pasted into fixtures as markup. Attribute *names* are interoperability facts and may appear in `selectors.v1.json`.

| Signal | Observation | Confidence | Use as |
|--------|-------------|------------|--------|
| Results list | `#grid-search-results` › `ul` › `li[data-c11n-component="List.Item"]`. Also `#search-page-list-container` / `[data-testid="search-page-list-container"]` (older `ul.photo-cards`) | MEDIUM | `resultsContainers` (ordered fallbacks) |
| Card root | `article[data-testid="property-card"][data-c11n-component="PropertyCard.Root"]`, `id="zpid_…"` | MEDIUM (2026 snapshot). The `data-test="property-card"` form in scraper blogs is older (LOW). | `cardRoots`. **Never read `id`/zpid.** |
| Card badges | `[data-c11n-component="PropertyCard.Badge"]` within `PropertyCard.BadgeArea`. Texts seen: "Showcase", "Special Offer", amenity highlights ("Gas fireplace", "Modern finishes") | MEDIUM | `badgeScopes`: the preferred place to look for labels, not a signal by itself |
| **Ad slots** | `li[data-testid="search-list-first-ad"]`, `…-second-ad`, `…-third-ad` interleaved at list positions ~3/9/12-17, initially a loading spinner (`nav-ad-loading-container`), filled asynchronously (likely iframe) | MEDIUM (present in both snapshots). The filled content and its labels are unknown (LOW). | `adSlots`: dim regardless of label. These are display ads in the results flow, which matches Zillow Boost's "display advertisement on the first search results pages" (zillow.com rentals-network/boost) |
| Lazy rendering | Only 9 cards are server-rendered. Remaining `li`s are placeholders (`data-renderstrat="timeout"`) hydrated later; pagination is SPA (`/2_p/`) | MEDIUM | Observer must handle late insertion, text changes, and node recycling |
| Paid "Featured" rentals | Page state had `"isFeatured":true` (2 occurrences) but **zero** visible `>Featured<` / `>Sponsored<` / `>Promoted<` text nodes in the 9 SSR cards | MEDIUM that this was true on that date | Some paid placements may carry **no visible label**. Do not read the JSON (extraction). Accept that and document it. |
| Showcase | Paid agent product with "priority placement in search" (multiple 2026 secondary sources); visible "Showcase" badge | MEDIUM | Put it in `selectors.v1.json` as an **opt-in category, disabled by default** (the locked vocabulary is Sponsored/Featured/Promoted/Ad) |
| Builder ads | Zillow sells "Promoted Communities" and "Builder Boost" native ads in search results; `isPaidBuilderNewConstruction` flag exists in state | MEDIUM (Zillow marketing pages via search) | The label vocabulary covers "Promoted". Expect native ad cards in ad slots. |

**Label vocabulary (exact match after normalization, case-insensitive):** `sponsored`, `sponsored listing`, `promoted`, `promoted listing`, `promoted community`, `featured`, `featured listing`, `ad`, `advertisement`. Normalization: NFKC, trim, collapse whitespace, strip trailing `·•:|-—` punctuation, lowercase. Candidate strings are (a) text nodes ≤ 32 chars within badge scopes or the card, and (b) `aria-label`/`title`/`alt` attribute values ≤ 48 chars on descendants. Exact equality is non-negotiable. Substring matching flags "Address", "Featured amenities", "Ad-free". The OSS heuristic `/\b(ad|sponsored)\b/` over whole-card text (lhammond/keyboard-maestro-fsbo) also proves too broad.

**Versioned selectors file schema (`apps/extension/src/lib/selectors.v1.json`):**
```json
{
	"version": 1,
	"observed": "2026-09-15 (web.archive.org snapshots)",
	"labels": {
		"sponsored": ["sponsored", "sponsored listing"],
		"promoted": ["promoted", "promoted listing", "promoted community"],
		"featured": ["featured", "featured listing"],
		"ad": ["ad", "advertisement"]
	},
	"optInLabels": { "showcase": ["showcase"] },
	"resultsContainers": ["#grid-search-results", "[data-testid=\"search-page-list-container\"]", "#search-page-list-container"],
	"cardRoots": ["article[data-testid=\"property-card\"]", "[data-c11n-component=\"PropertyCard.Root\"]", "[data-test=\"property-card\"]"],
	"itemRoots": ["li[data-c11n-component=\"List.Item\"]", ":scope > ul > li"],
	"adSlots": ["[data-testid^=\"search-list-\"][data-testid$=\"-ad\"]"],
	"badgeScopes": ["[data-c11n-component=\"PropertyCard.Badge\"]", "[data-c11n-component=\"PropertyCard.BadgeArea\"]"]
}
```
A schema unit test asserts: every selector parses in happy-dom (`querySelector` does not throw), **no selector contains a class selector** (`/\.[A-Za-z_-]/` outside attribute brackets, which bans hashed `StyledPropertyCard…-c11n-…__sc-…` names), all label strings are already normalized, and `optInLabels` is disjoint from `labels`. The file is bundled at build time. **No remote config in v1.** Remote JSON would need a network request and would contradict EXT-03.

**Dim target:** the outermost item (`li` from `itemRoots`, else the card root, else the ad slot `li`), so the reveal host is a **direct child** of the dimmed element (see Pattern 4).

## Architecture Patterns

### Recommended Project Structure
```
apps/extension/
├── package.json              # name "extension", version "0.1.0", scripts: prepare/dev/build/zip/check
├── wxt.config.ts             # srcDir 'src', modules svelte, imports:false, manifest fn, zip template
├── vitest.config.ts          # WxtVitest({ root }), happy-dom, setupFiles (no-network + extra bans)
├── tsconfig.json             # extends ./.wxt/tsconfig.json
├── public/icon/{16,32,48,96,128}.png   # generated once by scripts/make-extension-icons.mjs, committed
└── src/
    ├── entrypoints/
    │   ├── zillow.content/
    │   │   ├── index.ts      # THIN: defineContentScript → startFilter(deps) wiring only
    │   │   └── dim.css       # manifest-injected: [data-slf-state] opacity rules (no url())
    │   └── popup/
    │       ├── index.html    # <meta name="manifest.default_popup"…> not needed; title only
    │       ├── main.ts       # applies themeVars() via CSSOM, imports fonts, mounts App
    │       └── App.svelte
    ├── lib/
    │   ├── selectors.v1.json
    │   ├── config.ts         # typed import + normalize()
    │   ├── detect.ts         # classify(root, cfg) → { category } | null   (pure)
    │   ├── reconcile.ts      # reconcile(container, state, cfg, enabled) → count  (idempotent)
    │   ├── reveal-host.ts    # create/update/remove the closed-shadow-root button
    │   ├── observe.ts        # scoped debounced MutationObserver + container re-acquire (DI timers)
    │   ├── filter.ts         # startFilter({ doc, settings, onNavigate, timers }) → controller
    │   ├── settings.ts       # storage.defineItem wrapper (only file importing wxt/utils/storage)
    │   ├── messages.ts       # message types + content-side responder (sendResponse pattern)
    │   └── popup-model.ts    # pure status → copy mapping; tab lookup + sendMessage via DI
    └── test/
        ├── setup-no-network.ts   # bans XHR/WebSocket/EventSource/sendBeacon (+ window.fetch)
        └── fixtures/             # synthetic .html strings (or .ts exporting strings)
docs/EXTENSION-INSTALL.md
scripts/assert-extension.mjs (+ .test.ts)    # manifest oracle + bundle zero-network scan
scripts/make-extension-icons.mjs              # Playwright → PNG (one-off, outputs committed)
.github/workflows/extension-release.yml
```

### Pattern 1: WXT config (production-only strict manifest)
**What:** Explicit manifest with exact permissions, strict popup CSP, deterministic zip name, auto-imports off.
```ts
// apps/extension/wxt.config.ts  (Source: wxt.dev config/manifest docs; types.ts @ wxt-v0.21.4)
import { defineConfig } from 'wxt';

const ZILLOW = '*://*.zillow.com/*';

export default defineConfig({
	srcDir: 'src',
	modules: ['@wxt-dev/module-svelte'],
	imports: false, // explicit imports only: makes the static scan and reviews exact
	manifest: ({ mode }) => ({
		name: 'Sponsored Listing Filter — for Zillow',
		description:
			'Dims sponsored listing cards on Zillow search results, with one-click reveal. Collects nothing. Not affiliated with Zillow Group.', // 129 chars (Chrome max 132)
		permissions: ['storage'],
		host_permissions: [ZILLOW],
		// Production only: dev mode needs WXT's HMR/reload CSP additions.
		...(mode === 'production'
			? {
					content_security_policy: {
						extension_pages:
							"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
					}
				}
			: {})
	}),
	zip: { artifactTemplate: 'sponsored-listing-filter-{{packageVersion}}-{{browser}}{{modeSuffix}}.zip' },
	vite: () => ({ build: { assetsInlineLimit: 0 } }) // no data: fonts in the popup (font-src 'self')
});
```
Notes: `name` must be set explicitly, because it otherwise defaults to package.json `name`. `version` comes from package.json. Do **not** list `content_scripts` here. WXT generates them from the entrypoint and, in build mode, does not add their `matches` to `host_permissions` (verified in `manifest.ts`). The planner should verify the `ConfigEnv.mode` field name in `UserManifestFn` at Wave 0 and fall back to `command === 'build'` if needed.

### Pattern 2: Idempotent reconcile, safe against node recycling
**What:** Each pass recomputes classification for every item in the container. It **adds** dims for new matches and **removes** dims for items that no longer match, which covers virtualized or recycled nodes that now show an organic listing. Revealed state lives in a `WeakSet<Element>` (never persisted, never keyed by listing ID).
**When:** Called on start, on debounced mutation bursts, on `wxt:locationchange`, and on settings change.
```ts
// src/lib/reconcile.ts (sketch)
export function reconcile(container: ParentNode, s: FilterState, cfg: Config): number {
	let dimmed = 0;
	for (const item of itemsIn(container, cfg)) {
		const hit = s.enabled ? classify(item, cfg) : null;
		if (!hit) { unmark(item); continue; }                 // recycled or organic → undo
		mark(item, hit.category, s.revealed.has(item));        // sets data-slf-state + ensures 1 host
		if (!s.revealed.has(item)) dimmed++;
	}
	return dimmed; // "hidden count" = currently dimmed (revealed excluded; 0 when disabled)
}
```

### Pattern 3: Scoped, debounced observer + SPA navigation
**What:** Observe only the results container: `{ childList: true, subtree: true, characterData: true }`. **Do not observe `attributes`**, because our own `data-slf-state` writes would loop. Ignore records whose added/removed nodes are our hosts. Debounce trailing **150 ms** with a **600 ms max-wait** (discretion default) through injected `ctx.setTimeout`. On every flush, check `container.isConnected` and re-acquire the container if React swapped it. On `wxt:locationchange`, re-acquire, then reconcile after the debounce. If no container is found, retry with backoff (250 ms → 4 s, via `ctx.setTimeout`) and **never** fall back to observing `document.body` with `subtree`.
```ts
// src/entrypoints/zillow.content/index.ts  (Source: wxt.dev content-scripts "Dealing with SPAs")
import './dim.css';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { startFilter } from '../../lib/filter';
import { settings } from '../../lib/settings';

export default defineContentScript({
	matches: ['*://*.zillow.com/*'], // gate by container presence, not URL, because SPA routes vary
	runAt: 'document_idle',
	main(ctx) {
		const filter = startFilter({
			doc: document,
			settings,
			timers: { setTimeout: (cb, ms) => ctx.setTimeout(cb, ms), clearTimeout },
			onNavigate: (cb) => ctx.addEventListener(window, 'wxt:locationchange', () => cb())
		});
		ctx.onInvalidated(() => filter.stop()); // removes hosts + data attributes, disconnects observer
	}
});
```
`wxt:locationchange` uses the Navigation API `navigate` event when available, else 1 s polling (verified in `location-watcher.ts` @ wxt-v0.21.4). It fires at navigation **start**, before the new DOM exists, which is why the debounce plus container re-acquire is required.

### Pattern 4: Reveal button in a closed shadow root, styles via constructable sheet
**What:** Each dimmed item gets one direct-child host `<slf-reveal>` (unregistered custom tag, so page CSS rarely targets it). The host `attachShadow({ mode: 'closed' })`, the control is a real `<button type="button">`, and it adopts one **shared** `CSSStyleSheet` (`replaceSync` once). Constructable stylesheets work under strict page `style-src` CSPs where an injected `<style>` may be dropped (MEDIUM; WICG/construct-stylesheets#98 discussion). Dimming lives in the manifest CSS (`dim.css`), which page CSP cannot block:
```css
/* dim.css: manifest-injected; never url(), never fonts */
[data-slf-state='dimmed'] > :not(slf-reveal) { opacity: 0.3; transition: opacity 150ms ease-out; }
[data-slf-state] { position: relative; }
slf-reveal { all: initial; position: absolute; inset-block-start: 8px; inset-inline-start: 8px; z-index: 2; }
@media (prefers-reduced-motion: reduce) { [data-slf-state='dimmed'] > :not(slf-reveal) { transition: none; } }
```
Opacity on a parent cannot be undone for a child, so the reveal host must be a direct child, and only the **siblings** get dimmed. Shadow CSS: `:host{all:initial}`, a system font stack (no web fonts on Zillow, since loading them needs `web_accessible_resources`), a solid espresso `#2B1D16` fill with `#FFFFFF` text (≈16:1), a 2px white outline ring so the button stays visible on photos, a two-tone focus indicator (`outline: 3px solid #FFFFFF; box-shadow: 0 0 0 6px #A4452A`), min 44×44 px, and `transition: none` under reduced motion. Accessible name (WCAG 2.5.3 label-in-name): visible text "Sponsored — Show" plus a visually-hidden suffix inside the button, " (dimmed by Sponsored Listing Filter)". **Do not** set an `aria-label` that drops the visible words. After reveal, the button text becomes "Sponsored — Dim again" and focus stays on it. The visible category word is our vocabulary label, never page text. Event handling: `click` only, with `stopPropagation()` so Zillow's card link does not navigate.

### Pattern 5: Settings and count (no `tabs` permission)
```ts
// src/lib/settings.ts  (Source: wxt.dev storage docs)
import { storage } from 'wxt/utils/storage';
export const filterEnabled = storage.defineItem<boolean>('local:filterEnabled', { fallback: true });
```
- The content script calls `filterEnabled.watch(v => …reconcile…)`. The popup toggle writes the item. No messaging is needed for the toggle.
- Count: the popup runs `browser.tabs.query({ active: true, currentWindow: true })`. This works **without** the `tabs` permission; only `url`/`title`/`favIconUrl` are gated, and the zillow host permission exposes `url` on Zillow tabs. It then calls `browser.tabs.sendMessage(tab.id, { type: 'slf:status' })`. The content script answers through **`sendResponse` + `return true`**. WXT 0.21's fake-browser v2 note says promise-returning `onMessage` listeners are not supported in its mocks. Error cases map to copy: no content script on a Zillow URL → "Reload this Zillow tab to start filtering." Non-Zillow tab → "Open a Zillow search page to see the count." `enabled:false` → "Filter is off."
- `fakeBrowser` does **not** implement `tabs.sendMessage`, so inject `sendToTab` into `popup-model.ts` and fake it with `vi.fn()`.

### Pattern 6: Zero-network proof (three layers)
1. **Source (ESLint, `apps/extension/**`):** `no-restricted-globals` for `XMLHttpRequest`, `WebSocket`, `EventSource`, `WebTransport`, `RTCPeerConnection`, `importScripts`. `no-restricted-properties` for `navigator.sendBeacon`, `window.fetch`, `globalThis.fetch`, `self.fetch`, `runtime.connectNative`, `runtime.sendNativeMessage`. `no-restricted-syntax` for `ImportExpression` (no dynamic import) and `NewExpression[callee.name='Image']`. **Flat-config gotcha:** a later `no-restricted-syntax` entry **replaces** the earlier options for matching files. Re-spread the root `noFetch` selectors into the extension block, or the global `fetch()` ban silently disappears for the extension.
2. **Built bundle (`scripts/assert-extension.mjs <outDir>`):** scan every `.js`/`.html`/`.css` in `.output/chrome-mv3` for `\bfetch\s*\(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `importScripts`, `WebTransport`, `RTCPeerConnection`, `connectNative|sendNativeMessage`, and CSS `url\(\s*['"]?(https?:)?//`. Inventory every `https?://` literal against an allowlist: the privacy URL, `http://www.w3.org/2000/svg`, `http://www.w3.org/1998/Math/MathML`, `https://svelte.dev/e/` (Svelte 5 prod error links, verified present in the 5.57 client runtime). Svelte's only `fetch(` occurrence is in a JSDoc comment (`index-client.js:58`), which minification strips. Verify on the first real build.
3. **Runtime:** popup CSP `connect-src 'none'` (Pattern 1). Content scripts are not governed by extension CSP, so layers 1 and 2 cover them.
The same oracle asserts the manifest exactly. `permissions` deep-equals `['storage']`. `host_permissions` deep-equals `['*://*.zillow.com/*']`. There is one `content_scripts` entry, with `matches` deep-equal to the same pattern and a `css` array present. `web_accessible_resources`, `background`, `optional_permissions`, `optional_host_permissions`, `externally_connectable`, `commands`, and `declarative_net_request` are all absent. `manifest_version === 3`. `name` equals the locked name. `description.length <= 132` and it contains "Not affiliated". The CSP contains `connect-src 'none'`. Every file referenced exists.

### Pattern 7: Release workflow (tag-triggered, var-gated)
```yaml
# .github/workflows/extension-release.yml  (reuse ci.yml's exact SHAs)
name: extension-release
on:
  push:
    tags: ['ext-v*']
permissions:
  contents: read
concurrency:
  group: extension-release
  cancel-in-progress: false
jobs:
  release:
    if: vars.EXTENSION_RELEASES_ENABLED == 'true'
    runs-on: ubuntu-24.04
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: .nvmrc   # NO cache: on a release job (cache-poisoning)
      - run: pnpm install --frozen-lockfile
      - name: Tag matches package version
        run: test "$GITHUB_REF_NAME" = "ext-v$(node -p "require('./apps/extension/package.json').version")"
      - run: pnpm vitest run --project extension
      - run: pnpm --filter extension zip
      - run: node scripts/assert-extension.mjs apps/extension/.output/chrome-mv3
      - name: Checksums
        working-directory: apps/extension/.output
        run: sha256sum sponsored-listing-filter-*.zip > SHA256SUMS.txt
      - name: Publish release
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh release create "$GITHUB_REF_NAME" --verify-tag --title "Sponsored Listing Filter $GITHUB_REF_NAME" --notes-file docs/EXTENSION-INSTALL.md apps/extension/.output/sponsored-listing-filter-*.zip apps/extension/.output/SHA256SUMS.txt
```
Keep `if:` on one line, because the existing gate-suite convention parses single-line `if:`. `scripts/actionlint.mjs` defaults to **only** `ci.yml`, so update the `lint:workflows` script to pass both files (or make the default glob all workflows). Otherwise the new workflow is never linted.

### Anti-Patterns to Avoid
- **`cssInjectionMode: 'ui'` / `createShadowRootUi`:** bundles `fetch()` and adds `web_accessible_resources` (verified). Use Pattern 4.
- **Substring label matching or whole-card `textContent` regex:** false positives on organic listings ("Address", "Featured amenities").
- **Reading `zpid`, prices, addresses, `__NEXT_DATA__`/`isFeatured` JSON:** listing-data extraction, which is locked out and violates the ToU's scraping clause.
- **`display:none` / removing nodes:** locked out (no hide mode). It also fights React reconciliation.
- **Observing `attributes` or `document.body` subtree:** self-trigger loops and CPU cost on infinite results.
- **Hashed class selectors (`.StyledPropertyCard…-c11n-…__sc-…`):** break on every Zillow deploy, so the schema test bans class selectors entirely.
- **Asserting the manifest from `wxt dev` output:** dev adds `tabs` + `scripting`.
- **Remote selector JSON:** a network request, which contradicts EXT-03. Bundled only (v1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Manifest generation, MV3 bundling, IIFE content scripts | Hand-written manifest + Vite multi-entry | WXT 0.21.4 | Entrypoint-driven manifest, CSS → `content_scripts.css`, Chromium/Firefox targets |
| Zip artifacts | `zip -r` in CI | `wxt zip` (`@aklinker1/zero-zip`) | Manifest at zip root, mode-suffixed names, Firefox sources zip later |
| SPA route detection | `history.pushState` monkey-patching | `ctx.addEventListener(window, 'wxt:locationchange', …)` | Navigation API with polling fallback, auto-cleanup on invalidation |
| Context invalidation (extension update/disable) | Manual `chrome.runtime.id` checks | `ContentScriptContext` (`ctx.setTimeout`, `ctx.onInvalidated`) | Avoids "Extension context invalidated" errors |
| `chrome.storage` wrapper | Custom get/set/onChanged plumbing | `storage.defineItem` + `.watch()` | Typed, fallback default, change events |
| Browser API mocks | Hand-written `chrome` stubs | `wxt/testing/fake-browser` (via `WxtVitest`) | In-memory storage, `runtime.onMessage`, `tabs.query` |
| GitHub release upload | Third-party release action | Preinstalled `gh release create --verify-tag` | No new supply-chain pin |

**Deliberate hand-roll (justified):** the ~40-line shadow-root reveal host. WXT's helper violates the zero-network evidence and is designed for single UIs (see Anti-Patterns).

## Common Pitfalls

### Pitfall 1: Paid placements with no visible label
**What goes wrong:** The 2026-09-15 rentals snapshot had `isFeatured:true` in page state and no visible "Featured" text. The extension dims nothing, and users think it's broken.
**How to avoid:** Use ad-slot selectors as a label-independent signal. Write popup copy that does not over-promise ("Dims listings Zillow labels as sponsored or promoted, and ad slots in results."). Run the HUMAN-UAT live smoke and update `selectors.v1.json` from what the owner actually sees. Never read page JSON.
**Warning signs:** Count stays 0 on rentals searches that visibly show top-of-list promotions.

### Pitfall 2: Dimming a recycled organic card
**What goes wrong:** Zillow re-renders or recycles `li`/`article` nodes on scroll, filter, or page change. A stale `data-slf-state` leaves an organic listing dimmed.
**How to avoid:** Use a full reconcile that also **unmarks** (Pattern 2). Observe `characterData` so badge text swaps trigger a pass. Include a fixture test that flips a sponsored card's label text to an organic one and asserts undim plus host removal.

### Pitfall 3: Observer self-trigger loop
**What goes wrong:** Inserting hosts or setting attributes fires the observer, which reconciles, which inserts again.
**How to avoid:** No `attributes` in observer options, idempotent `mark()` (at most one host per item), and filtering out records consisting solely of `SLF-REVEAL` nodes. Test: after N mutation bursts, the reconcile call count stays bounded and each item has exactly one host.

### Pitfall 4: Dev-mode manifest contamination and the wrong output dir
**What goes wrong:** `wxt dev` adds `tabs`/`scripting`. Dev builds go to `.output/chrome-mv3-dev` (0.21 `{{modeSuffix}}`). An oracle pointed at the wrong dir passes or fails for the wrong reason.
**How to avoid:** The oracle runs only on `wxt build`/`wxt zip` output at `.output/chrome-mv3`, and fails if the dir name ends with `-dev`.

### Pitfall 5: WxtVitest under the root `projects` harness
**What goes wrong:** `WxtVitest()` calls `registerWxt('serve', inlineConfig)`, which resolves root from `process.cwd()`, the **repo root** under `vitest.config.ts` `projects`. It then finds no `wxt.config.ts`. This is the same class of bug Phase 01 hit with Kit's plugin.
**How to avoid:** `WxtVitest({ root: fileURLToPath(new URL('.', import.meta.url)) })`. Wave 0 verifies `corepack pnpm vitest run --project extension` **from the repo root**. Fallback if it still misbehaves: drop WxtVitest and alias `wxt/browser` → `wxt/testing/fake-browser` manually.

### Pitfall 6: happy-dom performs real network I/O
**What goes wrong:** In the happy-dom environment, `window.fetch`/`XMLHttpRequest` are real implementations, and fixture `<img src>`/`<iframe src>`/`<link>` can trigger loads. The repo's `tooling/vitest/no-network.ts` only replaces `globalThis.fetch`.
**How to avoid:** Fixtures contain **no URLs** (no `src`/`href` to http). Set `environmentOptions.happyDOM.settings`: `disableJavaScriptFileLoading`, `disableCSSFileLoading`, `navigation.disableChildFrameNavigation`, `navigation.disableMainFrameNavigation` all `true`, and a `fetch.interceptor` that throws. Add `src/test/setup-no-network.ts`, which replaces `window.fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, and `navigator.sendBeacon` with throwers. Add a non-vacuity test proving each throws.

### Pitfall 7: ESLint flat-config override drops the fetch ban
**What goes wrong:** Adding an extension `no-restricted-syntax` block replaces the root `noFetch` options for those files.
**How to avoid:** Spread `...noFetch` into the extension rule. Planted-violation test: a temp file with `fetch('x')` and one with `navigator.sendBeacon('x')` under `apps/extension/src/` must each fail ESLint. Mirror `scripts/eslint-rules.test.ts`.

### Pitfall 8: Generated dirs break lint/format/check
**What goes wrong:** `.wxt/` and `.output/` are hit by `prettier --check .` and `eslint .`. A fresh clone lacks `.wxt/tsconfig.json`, so `svelte-check` and ESLint `projectService` fail.
**How to avoid:** Add `**/.wxt/` and `**/.output/` to `.gitignore`, `.prettierignore`, and ESLint `ignores`. Give the extension package `"prepare": "wxt prepare"` (mirrors web's `svelte-kit sync`). Its `check` script is `wxt prepare && svelte-check --tsconfig ./tsconfig.json`. Note that the generated tsconfig enables `verbatimModuleSyntax` and `noUncheckedIndexedAccess` (0.21 change).

### Pitfall 9: Store and ToU trademark and claims issues
**What goes wrong:** The name implies an official Zillow product, Zillow blue or logo-like icons appear, or the Edge listing mentions Chrome. Edge policy 1.1.2 bars referencing other browsers, and its privacy policy "should primarily refer to the Microsoft Edge browser and not other browsers".
**How to avoid:** Use the locked nominative name, a terracotta/ivory icon (no house-and-Z, no `#006AFF`-like blue), and "Not affiliated with or endorsed by Zillow Group" in the popup, manifest description, Edge description, and privacy section. Keep the privacy text browser-neutral ("your browser"). Keep Chrome-specific steps only in `docs/EXTENSION-INSTALL.md` (repo doc, not listing).

### Pitfall 10: Real-data guard trips on fixtures
**What goes wrong:** `scripts/lib/real-data-rules.mjs` scans `fixtures/` dirs for real-looking emails and US phones.
**How to avoid:** Fixture cards carry fictional text only. If a phone appears, use 555-01xx. Emails use `@example.com`. Use no real addresses. Use `zpid`-free ids (`id="card-1"`).

### Pitfall 11: Existing tabs have no content script after install/update
**What goes wrong:** MV3 does not inject into already-open tabs without `scripting`, which we must not request. The popup shows an error on a Zillow tab.
**How to avoid:** The "Reload this Zillow tab to start filtering." copy (Pattern 5). Document it in the install guide.

### Pitfall 12: Release job hygiene
**What goes wrong:** `cache: pnpm` on a tag-release job can restore a cache populated by other refs (cache poisoning). Persisted checkout credentials widen token exposure.
**How to avoid:** No `cache:` in the release job, `persist-credentials: false`, job-scoped `contents: write` only, `--verify-tag`, and a tag/version equality check. Lock these in a gate test.

## Code Examples

### Reveal host (closed shadow root + shared constructable sheet)
```ts
// src/lib/reveal-host.ts (sketch; happy-dom supports attachShadow + adoptedStyleSheets)
const SHEET_CSS = `:host{all:initial}button{font:600 14px/1.2 ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;min-width:44px;min-height:44px;padding:8px 12px;border-radius:8px;border:2px solid #fff;background:#2b1d16;color:#fff;cursor:pointer}button:focus-visible{outline:3px solid #fff;box-shadow:0 0 0 6px #a4452a}.vh{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}@media (prefers-reduced-motion:reduce){*{transition:none!important}}`;
const sheets = new WeakMap<Document, CSSStyleSheet>(); // one shared sheet per document/realm
const roots = new WeakMap<Element, ShadowRoot>(); // closed roots are only reachable via our map

export function ensureHost(item: Element, label: string, revealed: boolean, onToggle: () => void) {
	let host = item.querySelector(':scope > slf-reveal');
	if (!host) {
		host = item.ownerDocument.createElement('slf-reveal');
		const root = host.attachShadow({ mode: 'closed' });
		const doc = item.ownerDocument;
		let sheet = sheets.get(doc);
		if (!sheet) { sheet = new (doc.defaultView!.CSSStyleSheet)(); sheet.replaceSync(SHEET_CSS); sheets.set(doc, sheet); }
		root.adoptedStyleSheets = [sheet];
		const btn = item.ownerDocument.createElement('button');
		btn.type = 'button';
		btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onToggle(); });
		root.append(btn);
		roots.set(host, root);
		item.prepend(host); // first in DOM order: screen readers hear it before the card
	}
	const btn = roots.get(host)!.querySelector('button')!;
	btn.replaceChildren(
		`${label} — ${revealed ? 'Dim again' : 'Show'}`,
		Object.assign(item.ownerDocument.createElement('span'), { className: 'vh', textContent: ' (dimmed by Sponsored Listing Filter)' })
	);
}
```
(The sheet is cached per `Document` because constructable sheets can only be adopted in the realm that created them. Each happy-dom test window is a separate realm.)

### Popup token application (CSP-safe CSSOM, no inline style attribute)
```ts
// src/entrypoints/popup/main.ts
import '@fontsource-variable/fraunces';
import '@fontsource-variable/inter';
import './app.css';
import { mount } from 'svelte';
import { themeVars } from '@tran/brand'; // Phase 2 contract: { '--color-background': '#fbf7f0', ... }
import App from './App.svelte';

for (const [k, v] of Object.entries(themeVars())) document.documentElement.style.setProperty(k, v);
mount(App, { target: document.getElementById('app')! });
```

### Extension Vitest project
```ts
// apps/extension/vitest.config.ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
	plugins: [WxtVitest({ root })],
	test: {
		name: 'extension',
		environment: 'happy-dom',
		include: ['src/**/*.test.ts'],
		setupFiles: ['../../tooling/vitest/no-network.ts', './src/test/setup-no-network.ts'],
		environmentOptions: {
			happyDOM: {
				settings: {
					disableJavaScriptFileLoading: true,
					disableCSSFileLoading: true,
					navigation: { disableMainFrameNavigation: true, disableChildFrameNavigation: true, disableChildPageNavigation: true }
				}
			}
		}
	}
});
```
Then add `'apps/extension'` to the root `vitest.config.ts` `projects`.

### `docs/EXTENSION-INSTALL.md` load-unpacked core (verified against Microsoft sideloading docs)
1. Download `sponsored-listing-filter-<version>-chrome.zip` and `SHA256SUMS.txt` from the GitHub Release.
2. Verify the checksum. Windows: `Get-FileHash -Algorithm SHA256 <zip>`. macOS: `shasum -a 256 <zip>`. Linux: `sha256sum -c SHA256SUMS.txt`.
3. Unzip into a **permanent** folder. Deleting the folder removes the extension.
4. Chrome: open `chrome://extensions`, turn on **Developer mode** (top right), click **Load unpacked**, and select the folder containing `manifest.json`. Edge: open `edge://extensions` (or **Settings and more › Extensions › Manage extensions**), turn on **Developer mode**, click **Load unpacked**, and select the folder.
5. Reload any open Zillow tabs.
6. Updates: replace the folder contents with the new zip, click **Reload** on the extension card, and refresh Zillow tabs. Unpacked installs do not auto-update. Managed or work devices may block developer-mode extensions.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WXT bundles its own `vite`/`web-ext` | `vite` required peer; `web-ext` optional (browser auto-open only when installed) | WXT 0.21.0 (2026-07) | Add `vite@8.3.0`; omit `web-ext` |
| `import { fakeBrowser, WxtVitest } from 'wxt/testing'` | `wxt/testing/fake-browser`, `wxt/testing/vitest-plugin` | 0.21 (barrel removed) | Use submodule paths |
| Zip `{{name}}-{{version}}-{{browser}}.zip` | `{{name}}-{{packageVersion}}-{{browser}}{{modeSuffix}}.zip`; dev output dirs suffixed | 0.21 | Explicit template; oracle refuses `-dev` dirs |
| Content-script IIFE global var | `globalName` defaults `false` | 0.21 | Nothing leaks to page globals |
| fake-browser v1 (polyfill types, promise `onMessage`) | v2 (`@wxt-dev/browser` types, `sendResponse` + `return true`) | 0.21 | Responder uses `sendResponse` |
| `url:` remote imports | Removed | 0.21 | Nothing remote can enter the bundle |
| Zillow `data-test="property-card"` (scraper blogs) | `data-testid="property-card"` + `data-c11n-component` | Seen in 2026-09 snapshot | Use both in `cardRoots`; label-first anyway |

**Deprecated/outdated:** `webextension-polyfill` (removed in WXT 0.20). WXT `runner` config (now `webExt`). The research-era plan to fetch remote matcher JSON (PITFALLS #20) is superseded by bundled-only selectors for v1.

## Zillow Terms of Use (research focus 6)

- Automated fetch of `zillow.com` returns 403 (not bypassed). The **archived** ToU (web.archive.org snapshot 2026-05-02, page header "Updated October 28, 2025"), §5 Prohibited Use, says users agree not to: "reproduce, **modify**, distribute, display or otherwise provide access to, create derivative works from … any portion of the Services". They also may not "conduct automated queries (including screen and database scraping … or any other automated activity with the purpose of obtaining information from the Services)", "use the Services in any way that … harms the Zillow Companies", or "access or use any of the Services to develop competitive products or services". **Confidence: MEDIUM** for the text as of that snapshot. The current text is unverified.
- Assessment (not legal advice): a local, presentation-only, user-initiated dimming tool does not obtain information, so it avoids the scraping clause. The "modify" and "harms" clauses, however, are broad enough that Zillow could object. The mitigations are already locked: no extraction, no network, dim (not remove), nominative naming, a non-affiliation notice, and a separate slippable phase. **HUMAN-UAT (blocking public release, not blocking build):** the owner reads the current ToU in a browser, records the "Updated" date and §5 wording in `11-HUMAN-UAT.md`, and decides go/no-go. If Zillow objects later, the recovery is to delist and rename, per PITFALLS recovery table.

## Edge Add-ons Requirements (research focus 4)

Verified from Microsoft Learn (policies updated 2026-08-13; publish guide updated 2026-09-02). **HIGH** confidence.
- Single purpose with narrow functionality (1.1.1). Partner Center **Privacy** page asks for a Single Purpose Description, a justification for **each** permission (`storage`, host `*.zillow.com`), the remote-code declaration ("No"), data-usage certification (collects none), and a **Privacy policy URL** (required if any personal info is accessed; supply it anyway).
- Metadata must not claim to represent a company without permission and **must not reference other browsers** (1.1.2). Third-party content needs a disclaimer (2.2). Permissions must be minimal with no "future proofing" (1.6). No obfuscated code (1.1.7). Vite minification is fine; do not add obfuscators.
- Listing: description **min 250 / max 10,000 chars**. Logo 1:1 at **300×300** recommended, min 128. Optional small tile 440×280. Optional screenshots 640×480 or 1280×800. ≤7 search terms. `name`/short description come from the manifest and are read-only in Partner Center. Certification takes up to **7 business days**.
- **Privacy URL target:** add a browser-neutral h2 section "Sponsored Listing Filter browser extension" (`#browser-extension`) to the Phase 2 `/legal/privacy/` page. Do not create a new route, which would add footer and E2E route-list churn. It goes live only after the owner enables Pages on `tranrealestate.github.io`. Keep one `PRIVACY_URL` constant in the extension, include it in the bundle-scan URL allowlist, and keep the copy within Phase 2's banned-terms list.
- Firefox AMO (deferred): needs `browser_specific_settings.gecko.id`, and current AMO rules require a `data_collection_permissions` manifest key (LOW; verify when un-deferred). WXT also builds a sources zip for Firefox.

## Open Questions

1. **Will anything be detected on live Zillow?**
   - What we know: ad-slot `li`s exist; badge areas exist; the archived "Featured" rental had no visible label.
   - Unclear: the rendered contents and labels of ad slots, and whether rentals or new-construction cards show "Sponsored"/"Promoted" text today.
   - Recommendation: build against the vocabulary plus ad slots. Make HUMAN-UAT "live smoke" record observed labels and update `selectors.v1.json` (bump `observed`). Accept 0-detection pages as a documented limitation rather than reading page JSON.
2. **Should "Showcase" be dimmed?**
   - What we know: it is paid priority placement, but it is a real for-sale listing, and the locked vocabulary excludes it.
   - Recommendation: keep it in `optInLabels` (disabled), with no popup UI in v1. The owner may flip it in a later patch.
3. **Phase 2 dependency timing.**
   - What we know: `packages/brand` is still the empty Phase 1 contract (`tokens = {}`), and Phase 2 is planned but not executed (STATE: "Phase 2 plan not started").
   - Recommendation: the plan must declare Phase 2 complete as a precondition (needs `themeVars()` and `/legal/privacy/`). If Phase 11 is pulled forward, the popup task imports `themeVars` and fails closed. Do not duplicate hex values in the extension.
4. **`UserManifestFn` env field for mode** (`mode` vs `command`).
   - Recommendation: verify in `.wxt/types` at Wave 0. The oracle test catches a dev CSP or a missing CSP either way.
5. **Ad-slot "listings" in the count.**
   - Recommendation: count them (they are paid placements in the results flow). Popup copy says "sponsored items dimmed on this page".

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.11 (`extension` project, happy-dom 20.14.5) + existing `scripts` project (node) |
| Config file | `apps/extension/vitest.config.ts` (new, Wave 0); root `vitest.config.ts` `projects` gains `'apps/extension'` |
| Quick run command | `corepack pnpm vitest run --project extension` |
| Full suite command | `corepack pnpm verify` (extended: `… && pnpm ext:build && pnpm ext:assert`) |
| Build + oracle | `corepack pnpm --filter extension build && node scripts/assert-extension.mjs apps/extension/.output/chrome-mv3` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | Failure mode it catches | File Exists? |
|--------|----------|-----------|-------------------|--------------------------|-------------|
| EXT-01 | `classify()` detects exact labels in badge scopes, ARIA/title/alt, and ad slots; rejects "Address", "Featured amenities", "Showcase" (opt-in off), labels > 32 chars | unit (happy-dom) | `pnpm vitest run --project extension detect` | Substring/false-positive matching; vocabulary drift | ❌ Wave 0 |
| EXT-01 | Fixture variants (≥3): **A** rentals-style card grid with "Featured"/"Sponsored" badges + organic negatives; **B** for-sale list with `search-list-*-ad` slots filled late; **C** label-only generic `ul>li` with no Zillow attributes (proves label-first independence); **D** nested `aria-label="Sponsored listing"` | unit | `… --project extension fixtures` | Detector coupled to selectors; missed ad slots | ❌ Wave 0 |
| EXT-01 | Reconcile is idempotent (exactly 1 host per item after 5 passes), unmarks recycled nodes, never removes cards (node count unchanged), reveal toggles state and focus stays on the button | unit | `… --project extension reconcile` | Recycled organic card stays dimmed; duplicate hosts; layout removal | ❌ Wave 0 |
| EXT-01 | Observer: late-inserted cards are dimmed after debounce (`vi.useFakeTimers` + `advanceTimersByTimeAsync(150)`); a label text change (characterData) undims; a container replaced + `onNavigate` re-acquires; no loop (reconcile calls bounded after host insertion) | unit | `… --project extension observe` | Scroll/SPA breakage; self-trigger loop; `document.body` fallback | ❌ Wave 0 |
| EXT-01 | Reveal host: closed shadow root, `adoptedStyleSheets.length === 1` shared across hosts, `button[type=button]`, accessible name contains visible "Sponsored — Show", click calls `stopPropagation` (card link handler not invoked) | unit | `… --project extension reveal-host` | Unstyled/inaccessible button; navigation on click | ❌ Wave 0 |
| EXT-01 | `selectors.v1.json` schema: selectors parse, **no class selectors**, normalized labels, opt-in disjoint | unit | `… --project extension selectors` | Hashed-class reliance; typo selectors | ❌ Wave 0 |
| EXT-02 | `filterEnabled` defaults true (fakeBrowser), toggling false undims all and count→0, true re-dims; watch callback wired | unit (fakeBrowser) | `… --project extension settings` | Toggle not persisted; content not reacting | ❌ Wave 0 |
| EXT-02 | Content responder answers `slf:status` with `{enabled, count}` via `sendResponse` + `return true`; popup-model maps responses/errors to the 4 copy states | unit | `… --project extension popup-model` | Wrong count; unhelpful error on stale tab | ❌ Wave 0 |
| EXT-02/03 | Popup copy contains "Collects nothing. Sends nothing." and "Not affiliated with or endorsed by Zillow Group." and the privacy link equals `PRIVACY_URL` (source assertion or happy-dom mount) | unit | `… --project extension popup-copy` | Missing required notices | ❌ Wave 0 |
| EXT-03 | Manifest oracle on production output: exact permissions/hosts/content_scripts; no WAR/background/optional/externally_connectable; CSP `connect-src 'none'`; name; description ≤132 and contains "Not affiliated"; refuses `-dev` dir | integration (node) | `node scripts/assert-extension.mjs apps/extension/.output/chrome-mv3` | Permission creep; dev contamination | ❌ Wave 0 |
| EXT-03 | Oracle mutation tests: planted faults in tmpdir copies (add `"tabs"`; add `web_accessible_resources`; add `<all_urls>`; drop CSP; inject `navigator.sendBeacon(` into a JS file; inject `new WebSocket(`; inject `url(https://x)` into CSS; add an unallowlisted URL) → each must fail; golden passes | unit (scripts) | `pnpm vitest run --project scripts assert-extension` | Vacuous oracle | ❌ Wave 0 |
| EXT-03 | ESLint planted violations under `apps/extension/src/__lintfix__/`: `fetch('x')`, `navigator.sendBeacon('x')`, `new XMLHttpRequest()`, `import('x')` each produce errors; the root fetch ban is still active for the extension | unit (scripts) | `pnpm vitest run --project scripts eslint-rules` | Flat-config override dropping bans | ❌ Wave 0 (extend existing `scripts/eslint-rules.test.ts`) |
| EXT-03 | Test-env network bans: `window.fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon` all throw in the extension project | unit | `… --project extension no-network` | Fixture/test silently hitting the network | ❌ Wave 0 |
| EXT-04 | Release workflow gate: trigger `tags: ['ext-v*']` only; top-level `contents: read`; job `contents: write`; single-line `vars.EXTENSION_RELEASES_ENABLED == 'true'`; all `uses:` 40-hex SHA; no `cache:`; `persist-credentials: false`; `--verify-tag`; `sha256sum`; tag/version check; actionlint clean | unit (scripts) + lint | `pnpm vitest run --project scripts extension-release-gate && pnpm lint:workflows` | Ungated/unpinned release; unlinted workflow | ❌ Wave 0 |
| EXT-04 | `wxt zip` produces `sponsored-listing-filter-<ver>-chrome.zip` with `manifest.json` at zip root | integration | `pnpm --filter extension zip` + oracle reads zip entry list | Wrong zip layout breaks load-unpacked/Edge upload | ❌ Wave 0 |
| EXT-04 | `docs/EXTENSION-INSTALL.md` contains `chrome://extensions`, `edge://extensions`, "Developer mode", "Load unpacked", checksum commands, update/reload steps | unit (text) | `pnpm vitest run --project scripts extension-docs` | Missing install steps | ❌ Wave 0 |
| EXT-01..04 | Live smoke on zillow.com (Chrome + Edge, load-unpacked): dims seen on paid items, reveal works, scroll + page 2 + filter change keep working, popup count matches, DevTools shows **no** requests initiated by the extension (popup inspector Network empty; page Network "Initiator" never `chrome-extension://…/content-scripts/…`) | manual-only (HUMAN-UAT) | — | Zillow DOM differs from snapshot; real-world network | n/a |
| EXT-03/04 | Owner reads current Zillow ToU; creates Edge Partner Center account; submits listing; privacy URL live | manual-only (HUMAN-UAT) | — | Legal/store gates | n/a |

### Sampling Rate
- **Per task commit:** `corepack pnpm vitest run --project extension` (< 10 s expected)
- **Per wave merge:** `corepack pnpm test:unit && corepack pnpm --filter extension build && node scripts/assert-extension.mjs apps/extension/.output/chrome-mv3 && corepack pnpm lint && corepack pnpm check && corepack pnpm lint:workflows`
- **Phase gate:** full `corepack pnpm verify` green (with the extension build+oracle appended) before `/gsd:verify-work`. CI: add extension build + oracle as steps in the `quality` job guarded by `if: matrix.target == 'root'`, so no new `uses:` is added and the existing gate suite's pin count (7) stays valid.

### Wave 0 Gaps
- [ ] `apps/extension/package.json` (name `extension`, version `0.1.0`, `prepare: wxt prepare`, `check`, `build`, `zip`), `wxt.config.ts`, `tsconfig.json`, `vitest.config.ts`, `src/test/setup-no-network.ts`
- [ ] Root `vitest.config.ts` projects += `'apps/extension'`. Verify the extension tests run from the repo root (Pitfall 5).
- [ ] `.gitignore`, `.prettierignore`, ESLint `ignores` += `**/.wxt/`, `**/.output/`. ESLint extension block (with `...noFetch` re-spread).
- [ ] `scripts/assert-extension.mjs` + `scripts/assert-extension.test.ts` (mutation tests, tmpdir only, mirroring `assert-csp.test.ts`)
- [ ] `scripts/extension-release-gate.test.ts`, `scripts/extension-docs.test.ts`. Extend `scripts/eslint-rules.test.ts`.
- [ ] `package.json` scripts: `ext:build`, `ext:assert`, `lint:workflows` covering both workflow files. Append to `verify`.
- [ ] Synthetic fixtures A–D (fictional text, no URLs, 555-01xx if any phone)
- [ ] Framework install: see Installation command above

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view`, 2026-10-04): wxt 0.21.4 (peers/engines/deps), @wxt-dev/module-svelte 2.0.5, @webext-core/fake-browser 2.0.1, @wxt-dev/browser 0.3.4, @wxt-dev/storage 1.3.0, happy-dom 20.14.5, jsdom 30.1.2, vitest 4.1.11 peers
- WXT source at tag `wxt-v0.21.4` (raw.githubusercontent.com/wxt-dev/wxt): `packages/wxt/src/core/utils/manifest.ts` (dev permissions, WAR for `cssInjectionMode:'ui'`, content-script host perms), `utils/content-script-ui/shadow-root.ts` (`loadCss` → `fetch`), `utils/internal/location-watcher.ts`, `utils/content-script-context.ts`, `testing/wxt-vitest-plugin.ts`, `core/builders/vite/plugins/extensionApiMock.ts`, `core/zip.ts`, `types.ts`, `templates/svelte/*`, `CHANGELOG.md`, `docs/guide/resources/upgrading.md` (0.20→0.21)
- https://wxt.dev/guide/essentials/unit-testing.html and https://wxt.dev/guide/essentials/content-scripts.html (+ GitHub docs source)
- happy-dom source v20.14.5 `IBrowserSettings.ts`; GitHub code search confirming `adoptedStyleSheets`/`replaceSync` support
- https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies (updated 2026-08-13)
- https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension (updated 2026-09-02)
- https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading
- Repo files: `.github/workflows/ci.yml` (SHA pins), `scripts/actionlint.mjs` (default file list), `tooling/vitest/no-network.ts`, `scripts/lib/real-data-rules.mjs`, `eslint.config.js`, Phase 2 UI-SPEC/RESEARCH (`themeVars()` contract), Svelte 5.57.0 client runtime (URL/fetch scan)

### Secondary (MEDIUM confidence)
- web.archive.org snapshots of Zillow `/homes/for_sale/` and `/homes/for_rent/` (2026-09-15): structural attribute names, ad-slot test ids, badge components, `isFeatured` without visible label
- web.archive.org snapshot of Zillow Terms of Use (2026-05-02; "Updated October 28, 2025"): §5 Prohibited Use wording
- Zillow Boost (zillow.com/rentals-network/boost/), Zillow Builder Boost / Promoted Communities pages, Zillow Showcase coverage (HousingWire, sofabrain, amplifiles): what paid placements exist
- https://github.com/WICG/construct-stylesheets/issues/98 and related: constructable sheets not blocked by `style-src`
- OSS selector evidence: kamranazam-1/zillow-scraper `selectors.ts` (2025-08), lhammond/keyboard-maestro-fsbo `get-card-page-data.js` (2025-09)

### Tertiary (LOW confidence)
- Scraper blog posts asserting `data-test="property-card"` (older markup)
- Firefox AMO `data_collection_permissions` requirement (not verified this session; deferred scope)
- Exact rendered content/labels of Zillow ad slots (never observed)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Versions come from the registry today, and behavior was read from source at the pinned tag.
- Architecture: HIGH for WXT/test/CI mechanics. MEDIUM for the shadow-root and CSP interplay on Zillow (needs the live smoke).
- Zillow DOM signals: MEDIUM for structure, LOW for paid-label presence.
- Pitfalls: HIGH (most verified in source or repo files).
- Legal/ToU: MEDIUM for the archived text, unverified for current text (HUMAN-UAT).

**Research date:** 2026-10-04
**Valid until:** WXT/tooling about 30 days. Zillow DOM about **7 days** (re-verify in the live smoke right before release).
