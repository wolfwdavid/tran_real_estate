# Stack Research

**Domain:** Static, browser-only, BYOK multi-portal real-estate GTM SaaS (SvelteKit on GitHub Pages) + companion MV3 browser extension
**Researched:** 2026-09-13
**Confidence:** HIGH (versions pulled live from the npm registry on 2026-09-13; CORS behavior verified by live preflight requests against each provider; model IDs from official provider docs)

---

## Headline Findings (read first)

1. **RentCast allows direct browser calls. No proxy is needed.** Verified live on 2026-09-13 with an `OPTIONS` preflight from `Origin: https://wolfwdavid.github.io` to `https://api.rentcast.io/v1/listings/rental/long-term`. The response was `204`, `access-control-allow-origin: *`, `access-control-allow-methods: GET`, `access-control-allow-headers: x-api-key`. A real `GET` with a bad key also returns `access-control-allow-origin: *` on the `401`, so JS can read error bodies (`auth/api-key-invalid`). **Only `GET` and only the `X-Api-Key` header are allowed cross-origin.** Don't send custom headers (e.g., `Content-Type` on a GET, tracing headers) or the preflight fails. (HIGH)
2. **All three LLM providers accept browser-direct calls** (live preflights, 2026-09-13):
   - Anthropic `api.anthropic.com/v1/messages` allows `x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access, content-type` with ACAO `*`. `@anthropic-ai/sdk@0.125.0` with `dangerouslyAllowBrowser: true` sends `anthropic-dangerous-direct-browser-access: true` (confirmed in the package's `client.js`).
   - OpenAI `api.openai.com/v1/responses` allows `authorization, content-type` with ACAO `*`. `openai@7.15.0` needs `dangerouslyAllowBrowser: true`.
   - Gemini `generativelanguage.googleapis.com` echoes the origin and allows `x-goog-api-key, content-type`. `@google/genai@2.22.0` ships a dedicated `browser` export.
   (HIGH)
3. **Pin TypeScript to 6.x, not 7.** `typescript@latest` is now **7.0.2**, but `@sveltejs/kit@2.70.3` peers `typescript ^5.3.3 || ^6.0.0`, `svelte-check@4.7.6` peers `^5 || ^6`, and `typescript-eslint` peers `<6.1.0`. A naive `pnpm add -D typescript` breaks type-checking. The `sv` CLI itself scaffolds `typescript ^6.0.3`. (HIGH)
4. **Start on SvelteKit 2.70 (stable), not the SvelteKit 3 RC.** Kit 3 is at `3.0.0-next.27` (RC since Aug 2026). Kit 3 moves config into `vite.config.ts` and rewrites `$lib` to `#lib`, which conflicts with shadcn-svelte's `components.json` aliases, and `runed` still peers `@sveltejs/kit ^2.21`. Migrate later with `sv migrate sveltekit-3` once it is stable and the UI ecosystem follows. (MEDIUM: the RC blog recommends Kit 3 for new apps; the recommendation here is driven by ecosystem compatibility.)
5. **RentCast API terms are more permissive than PROJECT.md assumes.** §1(iv) permits "sublicense, disclose, display, resell and distribute the API Data to third parties" and §1(v) permits storing it. The binding constraint is instead the preamble: **"The API Key may not be shared with any person or entity for its own independent use."** BYOK is exactly compliant. A shared, bundled "demo key" would violate it. Still, do not commit real RentCast responses to the public repo; use synthetic fixtures. (HIGH, quoted from rentcast.io/terms-api)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| SvelteKit (`@sveltejs/kit`) | **2.70.3** | App framework, file routing, prerendering | User constraint. Latest stable 2.x (2026-08-18). Kit 3 is still RC; see Headline 4. | HIGH |
| Svelte | **5.57.0** | UI runtime (runes) | Current stable. `vite-plugin-svelte@7` requires `svelte ^5.46.4`; bits-ui requires `^5.33`. | HIGH |
| `@sveltejs/adapter-static` | **3.0.10** | Emit static site for GitHub Pages | Official adapter. v4 is `next` only. Supports `fallback: '404.html'` for client-routed deep links on Pages. | HIGH |
| Vite | **8.3.0** | Build/dev server | `@sveltejs/vite-plugin-svelte@7.3.0` requires Vite 8. Kit 2.70, Tailwind 4.3, WXT, and CRXJS all accept Vite 8. | HIGH |
| `@sveltejs/vite-plugin-svelte` | **7.3.0** | Svelte compilation in Vite | Required by Kit + Vite 8. Engines: Node `^20.19 \|\| ^22.12 \|\| >=24`. | HIGH |
| TypeScript | **6.0.3** (pin `~6.0.3`) | Types | See Headline 3. **Do not install 7.x.** | HIGH |
| Node.js (CI + local) | **24 LTS** (24.21.0, "Krypton") | Runtime for tooling | Active LTS. WXT requires Node `>=22`; the OpenAI SDK's Node minimum is 22. 24 satisfies everything. | HIGH |
| pnpm | **11.27.0** (pin via `packageManager`) | Package manager + workspace | User preference. Workspaces host the web app and extension in one repo. pnpm 12 (Rust rewrite, released 2026-08-26) keeps the pnpm 11 lockfile/commands, so upgrading later is trivial. Let it settle a few more patch releases first. | MEDIUM |
| Tailwind CSS (+ `@tailwindcss/vite`) | **4.3.3** | Styling | Required by shadcn-svelte and LayerChart (depends on `@layerstack/tailwind`). v4's CSS-first `@theme` block *is* a design-token system, so "Tailwind vs vanilla CSS tokens" is a false choice: define warm editorial tokens (colors, serif/sans families, radii, spacing) once in `@theme` and they are both CSS variables and utilities. | HIGH |
| bits-ui | **2.19.2** | Headless accessible primitives (Dialog, Popover, Tabs, Select, Combobox…) | Svelte 5-native, WAI-ARIA compliant. The primitive layer under shadcn-svelte. | HIGH |
| shadcn-svelte (CLI) | **1.6.1** | Copy-in component source built on bits-ui + Tailwind v4 | Components live in *your* repo (`$lib/components/ui`), so the UI/UX Pro Max warm-editorial restyle is plain source edits, not theme-override fights. Supports Svelte 5 + Tailwind v4. | HIGH |

### Data, AI, and Integration Layer

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| Native `fetch` (no SDK) | n/a | Typed RentCast client | RentCast is a simple GET + `X-Api-Key` REST API. A ~200-line typed client (endpoint functions + response schemas) beats any wrapper. No official RentCast JS SDK was found. | HIGH (API shape) / LOW (no-SDK claim) |
| Zod | **4.6.4** (import from `zod/mini` in client code) | Runtime validation of RentCast responses, persisted IndexedDB records, imported CRM JSON | Validate at every trust boundary: API responses drift, and user-imported files are untrusted. `runed` peers `zod ^4.1`, so it is already in the graph. | HIGH |
| `@anthropic-ai/sdk` | **0.125.0** | Claude calls (streaming) | `new Anthropic({ apiKey, dangerouslyAllowBrowser: true })`. **Load via dynamic `import()` only when the user picks Claude.** | HIGH |
| `openai` | **7.15.0** | OpenAI calls | Use the **Responses API** (`client.responses.create`), which the official docs recommend over Chat Completions. `dangerouslyAllowBrowser: true`. Dynamic import. | HIGH |
| `@google/genai` | **2.22.0** | Gemini calls | The current unified SDK with a `browser` export. Dynamic import. | HIGH |
| Dexie | **4.4.6** | IndexedDB wrapper: saved searches, listing/response cache, quota ledger, CRM, alert "seen" state, drafts | IndexedDB is the only browser store with enough capacity and structured queries (compound indexes, e.g., `[searchId+firstSeenAt]`) for a CRM and a response cache. Dexie has typed tables, schema versioning/migrations, transactions, and `liveQuery`. Released 2026-09-10, actively maintained. | HIGH |
| runed | **0.37.1** | Svelte 5 utilities; `PersistedState` for small localStorage-backed prefs | Use `PersistedState` for tiny synchronous prefs only (active portal, chosen LLM provider/model, UI density). Everything else goes to Dexie. | HIGH |
| LayerChart | **2.5.0** | Market dashboards (rent trends, price-to-rent, DOM, inventory) | Svelte 5-native, composable, SVG output. Stable 2.0.0 shipped 2026-07-01. The underlying lib for shadcn-svelte's `Chart` component. SVG output feeds straight into PDF export. **Note:** shadcn-svelte's chart docs still say `layerchart@next` (stale); install `layerchart@^2.5.0`. | HIGH (version) / MEDIUM (docs lag) |
| pdfmake | **0.3.11** | Client-side PDF: agent market reports, investor memos | Declarative document definitions (headers, tables, columns, page breaks). Embeds custom TTF fonts (serif headings) and **renders SVG natively** (bundled `svg-to-pdfkit`, confirmed in tarball), so LayerChart SVGs go in as vectors with selectable text. **Always lazy-load** (large bundle with fonts). | HIGH |
| Web3Forms (service, no npm package) | Free plan | Lead inbox delivery to agents | **250 submissions/month free** (vs Formspree 50), unlimited forms/domains, hCaptcha + honeypot `botcheck`. The access key is **public-safe by design**, so each agent pastes their own key (BYOK-consistent). **Client-side only on free.** A non-browser request returned `403 "Use our API in client side… (Pro plan is required)"` in testing, which is fine for this architecture. No file uploads or integrations on free; 30-day retention. | MEDIUM (limits from docs search + third-party comparisons; official pages 403'd automated fetch) |
| `@fontsource-variable/fraunces` + `@fontsource-variable/inter` | **5.3.0** / **5.3.0** | Self-hosted serif headings + sans body | Self-hosting avoids a Google Fonts CDN (privacy, CSP simplicity, no FOUT from 3rd-party). Final pairing is a UI/UX Pro Max decision; Source Serif 4 (`@fontsource-variable/source-serif-4@5.3.0`) is the drop-in alternative. The same TTFs must be registered with pdfmake for on-brand PDFs. | MEDIUM |
| `@lucide/svelte` | **1.45.0** | Icons | The Svelte 5 package shadcn-svelte uses. Tree-shakable. | HIGH |
| svelte-sonner | **1.2.1** | Toasts ("3 new listings", "Draft copied") | shadcn-svelte's Sonner component. | HIGH |
| date-fns | **4.4.0** | "New since last visit", listing age, follow-up due dates | Tree-shakable, immutable. | HIGH |

### Browser Extension (Zillow sponsored-card filter)

| Tool | Version | Purpose | Notes | Confidence |
|------|---------|---------|-------|------------|
| WXT | **0.21.4** | MV3 extension framework (Vite-based) | Entrypoint-driven manifest generation, HMR, `wxt zip` for Chrome/Edge (and `-b firefox`). Built-in `ctx.addEventListener(window, 'wxt:locationchange', …)` handles SPA navigation, **which Zillow's search results require** (cards re-render without page loads). Engines: Node `>=22`. 10.5k stars, pushed 2026-09-12. | HIGH |
| `@wxt-dev/module-svelte` | **2.0.5** | Svelte for the popup/options page | Only for the popup (on/off toggle, hidden-count badge). **The content script itself should be plain TypeScript**: a `MutationObserver` + CSS class toggle. No Svelte and no shadow-root UI needed to hide nodes. | HIGH |
| `@types/chrome` | **0.1.x** latest | Types, if not using WXT's `browser` global | WXT provides typed `browser.*`; usually unnecessary. | MEDIUM |

**Same repo? Yes, as a pnpm workspace.** Suggested layout:

```
tran_real_estate/
  pnpm-workspace.yaml        # packages: ['apps/*', 'packages/*']
  apps/web/                  # SvelteKit app → GitHub Pages
  apps/zillow-filter/        # WXT extension → zip artifact on GitHub Releases
  packages/shared/           # (optional) shared TS types/constants only — keep tiny
```

Treat `apps/zillow-filter` as an independent TS project (it extends `.wxt/tsconfig.json`). Add path aliases in `wxt.config.ts`, not the root tsconfig. Don't share Svelte components between web and extension. The extension has almost no UI and sharing drags Tailwind/bits-ui into the extension build.

**Distribution under a $0 budget:** Chrome Web Store charges a **one-time US$5** developer registration fee. Microsoft Edge Add-ons registration is **free**. For v1: publish to Edge Add-ons + attach the zipped build to GitHub Releases with "Load unpacked" instructions for Chrome. Flag the $5 Chrome listing as a user decision. (MEDIUM)

### Development Tools

| Tool | Version | Purpose | Notes | Confidence |
|------|---------|---------|-------|------------|
| `sv` CLI | **0.17.0** | Scaffold (`sv create --add tailwindcss,vitest,playwright,eslint,prettier`) | Scaffolds Vitest `^4.1.8`, TS `^6.0.3`, Tailwind `^4.3.0`, matching this doc's pins. Do **not** use `sv@next` (targets Kit 3). | HIGH |
| Vitest | **4.1.11** (not 5.0.0) | Unit tests (deal math, cap rate, cache/quota ledger, RentCast client, prompt builders) | Vitest 5.0.0 released 2026-09-03 (10 days old); `sv` still scaffolds 4.x. Upgrade in a later phase. Deal-analyzer math is pure functions, so it should be the highest-coverage module. | HIGH |
| `@vitest/browser-playwright` + `vitest-browser-svelte` | **4.1.11** + **2.2.1** | Component tests in a real browser | Match the Vitest major (4). Real browser = real IndexedDB, no jsdom quirks. | HIGH |
| fake-indexeddb | **6.2.5** | Dexie tests in the Node Vitest project | For fast pure-logic tests of repositories/migrations without a browser. | HIGH |
| `@playwright/test` | **1.63.0** | E2E across the 3 portals | Mock *all* outbound calls with `page.route()` + synthetic fixtures. CI must never hit RentCast (50 calls/month) or LLM providers. | HIGH |
| `@axe-core/playwright` | **4.13.0** | Accessibility assertions (WCAG AA) inside E2E | Run `AxeBuilder` on every route in both empty-key (demo) and key-present states. | HIGH |
| svelte-check | **4.7.6** | Type-check `.svelte` files in CI | Requires TS ≤6. | HIGH |
| ESLint + eslint-plugin-svelte + typescript-eslint | **10.10.0** + **3.23.0** + latest (peer TS `<6.1.0`) | Lint | Flat config as scaffolded by `sv`. | HIGH |
| Prettier + prettier-plugin-svelte + prettier-plugin-tailwindcss | **3.9.6** + **4.1.1** + **0.8.1** | Formatting + class sorting | | HIGH |
| GitHub Actions | `actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5` | CI: lint → check → unit → E2E+axe → build → deploy Pages; extension: `wxt zip` → release artifact | Latest release tags verified via GitHub API. (The SvelteKit docs sample still shows `setup-node@v6`; v7 is current.) Set `BASE_PATH=/tran_real_estate` in the build step. | HIGH |

---

## Current LLM Model IDs (for the provider registry)

Keep these in one `models.ts` registry (not scattered string literals). At key-validation time, call each provider's models-list endpoint to hide IDs the key can't access.

| Provider | Default (quality/cost balance) | Cheap/fast | Premium | Notes |
|----------|-------------------------------|------------|---------|-------|
| Anthropic | `claude-sonnet-5` ($2/$10 per MTok) | `claude-haiku-4-5` ($1/$5) | `claude-opus-5` ($5/$25) | **`claude-haiku-4-5` retirement "not sooner than October 15, 2026"**, which is weeks away, so don't make it a default. `claude-fable-5-1` ($10/$50) is overkill for drafting. Dateless IDs are pinned snapshots. |
| OpenAI | `gpt-5.6-terra` ($2/$12) | `gpt-5.6-luna` ($0.20/$1.20) | `gpt-5.6-sol` (alias `gpt-5.6`, $4/$20) | `gpt-6-astra` ($10/$50) is overkill. Use the Responses API. |
| Google | `gemini-3.8-flash` | `gemini-3.5-flash-lite` | `gemini-3.1-pro-preview` (preview) | `gemini-2.0-flash`/`-lite` are **shut down**. Flash models have a **free tier, but free-tier content is "used to improve our products"**. The settings UI must disclose this before users paste CRM/lead data into Gemini on a free key. |

Confidence: HIGH (official model pages fetched 2026-09-13). Model lineups change quarterly; the registry plus the live models-list check is the mitigation.

---

## RentCast Integration Facts (drive the data-layer phase)

| Fact | Value | Source | Confidence |
|------|-------|--------|------------|
| Base URL / auth | `https://api.rentcast.io/v1/`, header `X-Api-Key` | developers.rentcast.io getting-started | HIGH |
| Browser CORS | Allowed: ACAO `*`, methods `GET`, headers `x-api-key` | Live preflight 2026-09-13 | HIGH |
| Free plan | "Developer" $0, **50 requests/month**, no credit card | rentcast.io/api | HIGH |
| Overage | $0.20/request on Developer plan (if billing enabled) | rentcast.io/api | MEDIUM: warn users that adding a card turns quota overruns into charges |
| Paid tiers | Foundation $74 (1,000), Growth $199 (5,000), Scale $449 (25,000) | rentcast.io/api | HIGH |
| Rate limit | 20 req/s on all plans; `429` `auth/rate-limit-exceeded` | developers.rentcast.io/reference/rate-limits | HIGH |
| Billing counts | Every successful request counts, including API playground calls | getting-started | HIGH |
| Key sharing | Key may not be shared for another party's independent use | rentcast.io/terms-api preamble | HIGH |
| Data storage/display | Store, display, distribute permitted (§1); retained data usable after termination (§7) | rentcast.io/terms-api | HIGH |

**Implication:** the cache is a **quota-budget system**, not a freshness optimization. It needs (a) a Dexie response cache keyed by normalized request URL with per-endpoint TTLs (e.g., market stats 7–30 days, estimates 7 days, listings ~24h), (b) a monthly call ledger shown in the UI ("12 of 50 calls used"), (c) a pre-flight "this will spend 1 call" confirmation for uncached requests, and (d) coalescing of saved-search re-runs on app open, so 5 saved searches never cost 5 calls every load.

---

## GitHub Pages Configuration Essentials

| Setting | Value | Why | Confidence |
|---------|-------|-----|------------|
| `kit.paths.base` | `process.argv.includes('dev') ? '' : process.env.BASE_PATH` with `BASE_PATH=/tran_real_estate` in CI | Project Pages serve under `/<repo>`. All internal links must use `resolve()`/`base` from `$app/paths`, never hard-coded `/`. | HIGH |
| `adapter({ fallback: '404.html' })` | SPA fallback | GitHub Pages serves `404.html` for unknown paths, so client-routed portal deep links (e.g., `/investors/deals/abc`) still boot the app. | HIGH |
| `static/.nojekyll` | Empty file | Stops Jekyll from dropping `_app/` (underscore dirs). | HIGH |
| Root `+layout.ts` | `export const prerender = true` | Marketing/landing pages prerender as real HTML (SEO for GTM). Portal routes that depend on local data render client-side after hydration. | HIGH |
| `kit.csp` | `mode: 'hash'`, `connect-src 'self' https://api.rentcast.io https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https://api.web3forms.com` | Pages can't set response headers; SvelteKit emits CSP as a `<meta>` tag for prerendered pages. Locking `connect-src` is the main defense for keys held in the browser (an injected script can't exfiltrate to arbitrary hosts). | MEDIUM (verify meta-tag emission with `fallback` pages during the platform phase) |

---

## Installation

```bash
# Toolchain
corepack enable && corepack prepare pnpm@11.27.0 --activate   # Node 24 LTS

# Scaffold web app (Kit 2 stable — NOT sv@next)
pnpm dlx sv@0.17.0 create apps/web --template minimal --types ts \
  --add tailwindcss vitest playwright eslint prettier
cd apps/web
pnpm add -D @sveltejs/adapter-static@3.0.10 typescript@~6.0.3

# UI primitives (copy-in components)
pnpm dlx shadcn-svelte@1.6.1 init
pnpm add bits-ui@2.19.2 @lucide/svelte@1.45.0 svelte-sonner@1.2.1

# Data + AI + persistence
pnpm add dexie@4.4.6 runed@0.37.1 zod@4.6.4 date-fns@4.4.0
pnpm add @anthropic-ai/sdk@0.125.0 openai@7.15.0 @google/genai@2.22.0   # dynamically imported

# Charts + export
pnpm add layerchart@2.5.0 pdfmake@0.3.11

# Fonts (self-hosted)
pnpm add @fontsource-variable/fraunces@5.3.0 @fontsource-variable/inter@5.3.0

# Testing
pnpm add -D vitest@4.1.11 @vitest/browser-playwright@4.1.11 vitest-browser-svelte@2.2.1 \
  fake-indexeddb@6.2.5 @playwright/test@1.63.0 @axe-core/playwright@4.13.0 svelte-check@4.7.6

# Extension (from repo root)
pnpm dlx wxt@0.21.4 init apps/zillow-filter    # choose the Svelte template
cd apps/zillow-filter && pnpm add -D @wxt-dev/module-svelte@2.0.5
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| SvelteKit 2.70 | SvelteKit 3 RC (`3.0.0-next.27`) | Once Kit 3 is stable **and** shadcn-svelte's CLI/`components.json` supports `#lib` subpath imports. Run `sv migrate sveltekit-3` as a dedicated maintenance phase. |
| Tailwind v4 `@theme` tokens + shadcn-svelte | Vanilla CSS custom properties + bits-ui only | If UI/UX Pro Max produces a fully bespoke design system and you want zero utility classes. You lose shadcn-svelte's copy-in components and LayerChart's Tailwind-based defaults. Not worth it here. |
| Dexie 4 | `idb` 8.0.3 (thin promise wrapper) | A tiny key-value-only app. This app has a CRM with indexes, migrations, and live queries, which is Dexie territory. |
| Dexie 4 | `idb-keyval` 6.3.0 | Storing one or two blobs. No indexes, no queries. |
| Custom Dexie cache + quota ledger | `@tanstack/svelte-query` 6.1.48 + persister | Server-backed apps where freshness is the concern. Here the concern is a hard 50-call budget, which TanStack Query's refetch-on-focus/stale-while-revalidate model fights. The persister packages are also still on the 5.x line (version skew). |
| Official SDKs (lazy-loaded) | Raw `fetch` for all three providers | If bundle size becomes a problem. The three APIs are simple POSTs, but SSE streaming parsing and error typing are what the SDKs give you for free. |
| Official SDKs | Vercel AI SDK (`ai`) unified provider layer | If you later add many more providers. Not verified in this research for browser-direct BYOK. (LOW) |
| LayerChart 2.5 | ECharts 6.1.0 | Heavy interactive dashboards with huge datasets (canvas rendering). Heavier bundle, not Svelte-native, canvas output is worse for vector PDF. |
| LayerChart 2.5 | Chart.js 4.5.1 | Quick canvas charts without Tailwind. Imperative API, raster output in PDFs. |
| pdfmake 0.3.11 | jsPDF 4.2.1 + jspdf-autotable 5.0.8 | Imperative, coordinate-based layouts or existing jsPDF code. More manual layout work; SVG needs extra plugins. |
| pdfmake | Print stylesheet (`@media print` + `window.print()`) | **Ship this too** as a zero-dependency "Save as PDF" fallback for any report page. It isn't the primary path because the output varies by browser and can't be branded consistently. |
| Web3Forms (250/mo) | Formspree free (50/mo account-wide, 2 linked emails, 30-day history) | If an agent needs Formspree's dashboard/integrations. CORS verified live (echoes origin). Keep the form adapter pluggable so an agent can choose either. |
| WXT 0.21.4 | CRXJS `@crxjs/vite-plugin` 2.7.1 | If you prefer a hand-written `manifest.json` in a plain Vite project. Actively maintained (pushed 2026-09-13), but no built-in SPA location-change helper or zip/publish tooling. |
| Browser-direct RentCast | Cloudflare Workers free tier (`wrangler` 4.131.1) thin pass-through | **Only if RentCast ever removes CORS.** A stateless Worker forwarding the user's `X-Api-Key` without logging. Not needed today. |
| pnpm 11.27 | pnpm 12.4.1 | After pnpm 12 has a few more weeks of patch releases. Lockfile and commands carry over. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `typescript@7.x` (current `latest`) | Outside the peer ranges of `@sveltejs/kit@2`, `svelte-check@4`, `typescript-eslint`. Type-check and lint break. | `typescript@~6.0.3` |
| `sv@next` / `@sveltejs/kit@next` for v1 | Kit 3 RC: config moves to `vite.config.ts`, `$lib` becomes `#lib`, and the UI ecosystem hasn't followed yet. | `sv@0.17.0` + Kit 2.70.3 |
| `@google/generative-ai` (0.24.1) | Legacy Gemini SDK, superseded by `@google/genai`. | `@google/genai@2.22.0` |
| `gemini-2.0-flash` / `gemini-2.0-flash-lite` model IDs | Shut down per official model page. | `gemini-3.8-flash` / `gemini-3.5-flash-lite` |
| `claude-haiku-4-5` as a *default* | Retirement window opens 2026-10-15. | `claude-sonnet-5` default. Haiku only as a user-selected option. |
| Public CORS proxies (cors-anywhere clones, corsfix, etc.) | They see the user's RentCast/LLM keys in transit, which is a key leak by design. Also unnecessary: every provider here supports CORS. | Direct browser calls; your own Cloudflare Worker only if ever required. |
| A shared/bundled RentCast "demo key" in the public repo | Violates RentCast API terms (no sharing keys for others' independent use), gets scraped from the public repo within hours, and burns 50 calls instantly. | Synthetic fixture dataset for demo mode + onboarding to get a free key. |
| Committing real RentCast responses as test fixtures | Public repo + licensed data + possible PII (agent names/phones in listings). | Hand-authored synthetic fixtures with fictional addresses. |
| html2canvas / html2canvas-pro + jsPDF "screenshot to PDF" | Raster output (blurry when printed, huge files), non-selectable/non-accessible text, CSS-support gaps with Tailwind v4 `oklch()` colors. | pdfmake with vector SVG charts; print stylesheet fallback. |
| `localStorage` for CRM, caches, or saved-search results | ~5 MB cap, synchronous (janks main thread), string-only, no indexes, no transactions. | Dexie (IndexedDB). `runed` `PersistedState` only for tiny prefs. |
| `dexie-svelte-query` | Reported not to update reliably under Svelte 5 (Dexie issue #2231). | Plain `liveQuery()` wrapped in a small `.svelte.ts` helper that pipes into `$state`/`$derived`. |
| Google Fonts CDN `<link>` | Third-party request (privacy), complicates CSP, and PDF export needs the TTFs locally anyway. | `@fontsource-variable/*` self-hosted. |
| Svelte UI / shadow-root UI inside the Zillow content script | Unneeded weight on a third-party page. Hiding cards is a `MutationObserver` + class/`display:none`. More surface for Zillow DOM breakage. | Plain TS content script; Svelte only for the popup. |
| Any Zillow data extraction in the extension (reading prices, sending DOM data to the app) | Crosses from "hide elements" into scraping, violating Zillow ToU and PROJECT.md constraints. Also triggers stricter Chrome Web Store review. | Content script reads only selectors/labels needed to identify sponsored cards; no network permissions, no `host_permissions` beyond Zillow match patterns, no messaging of page content. |
| Vitest 5.0.0 right now | 10 days old; `sv` scaffolds 4.x; browser-mode companion packages must match the major exactly. | Vitest 4.1.11 now; upgrade as a chore later. |
| sveltekit-superforms / form actions | Built around server actions. There is no server on GitHub Pages. | Plain Svelte 5 forms + Zod validation client-side. |

---

## Stack Patterns by Variant

**If the user has no keys (demo mode, the default for first visit):**
- Swap the RentCast client for a `FixtureRentCastClient` behind the same interface (dependency-injected at app init).
- Disable AI buttons with an inline "Add a key to draft with AI" explainer rather than faking AI output.
- Because the Core Value must be demonstrable to a first-time visitor without spending anyone's quota.

**If the app bundle grows past ~250 KB gzipped on the landing page:**
- Keep marketing routes free of Dexie/LLM SDKs/pdfmake/LayerChart. Load them via dynamic `import()` inside portal routes.
- Because GTM landing pages must be fast for SEO and first impressions; the heavy libraries are only needed after a user enters a portal.

**If the user decides to pay the $5 Chrome Web Store fee:**
- Add a `wxt zip` → Chrome Web Store upload job (manual approval gate) to CI.
- Keep permissions minimal (`storage` + Zillow `matches` only) to pass review quickly.

**If SvelteKit 3 goes stable mid-roadmap:**
- Do not migrate mid-phase. Schedule a dedicated migration plan: `sv migrate sveltekit-3`, then update shadcn-svelte aliases (`$lib` → `#lib`), adapter-static 4, and re-run the full E2E+axe suite.

**If RentCast ever tightens CORS (re-verify at the start of each milestone):**
- Deploy a stateless Cloudflare Worker pass-through (free tier), user-overridable URL in settings, no logging.
- Because it is the only $0 option that doesn't expose keys to a third party. Hugging Face Spaces cold-start and aren't meant as API proxies.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@sveltejs/kit@2.70.3` | `vite ^5–^8`, `svelte ^4 \|\| ^5`, `typescript ^5.3.3 \|\| ^6`, `vite-plugin-svelte ^3–^7` | Verified from registry peerDependencies. |
| `@sveltejs/vite-plugin-svelte@7.3.0` | `vite ^8`, `svelte ^5.46.4`; Node `^20.19 \|\| ^22.12 \|\| >=24` | Forces Vite 8. |
| `svelte-check@4.7.6` | `typescript ^5 \|\| ^6` | **Blocks TS 7.** |
| `typescript-eslint` (latest) | `typescript >=4.8.4 <6.1.0`, `eslint ^8.57 \|\| ^9 \|\| ^10` | **Blocks TS 7**; pin TS `~6.0.3`. |
| `@tailwindcss/vite@4.3.3` | `vite ^5.2 \|\| ^6 \|\| ^7 \|\| ^8` | OK. |
| `bits-ui@2.19.2` | `svelte ^5.33`, `@internationalized/date ^3.8.1`; Node `>=20` | Install `@internationalized/date` (shadcn-svelte init does). |
| `layerchart@2.5.0` | `svelte ^5`; depends on `runed ^0.37.1`, `@layerstack/tailwind` | Align your `runed` to 0.37.x to avoid duplicates. |
| `runed@0.37.1` | `svelte ^5.7`, `@sveltejs/kit ^2.21`, `zod ^4.1` | Another reason to stay on Kit 2 for now. |
| `wxt@0.21.4` | `vite ^6.3.4 \|\| ^7 \|\| ^8`, `typescript >=5.4`; Node `>=22` | CI Node 24 satisfies it. |
| `@wxt-dev/module-svelte@2.0.5` | `wxt >=0.18.6`, `svelte >=5` | OK. |
| `vitest-browser-svelte@2.2.1` | `vitest ^4` (3.x line requires Vitest 5) | Keep all Vitest-family packages on one major. |
| `@vitest/browser-playwright@4.1.11` | `vitest 4.1.11` (exact) | Exact-match pin. |
| `jspdf-autotable@5.0.8` | `jspdf ^2 \|\| ^3 \|\| ^4` | Only if choosing the jsPDF alternative. |
| `openai@7.15.0` | TS `>=4.9`; Node 22+ (browser OK with flag) | Node minimum only affects running it in Node tests. |
| `@anthropic-ai/sdk@0.125.0` | TS `>=5.0`; Node 20+ (browser OK with flag) | |

---

## Sources

- **npm registry** (`npm view`, 2026-09-13): all version numbers, peerDependencies, engines, dist-tags, release dates. HIGH
- **Live CORS preflights** (curl, 2026-09-13, `Origin: https://wolfwdavid.github.io`) against `api.rentcast.io`, `api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com`, `formspree.io`, `api.web3forms.com`. HIGH
- **Package tarball inspection:** `@anthropic-ai/sdk@0.125.0` `client.js` (browser header), `openai@7.15.0` `client.js` (`dangerouslyAllowBrowser`), `@google/genai@2.22.0` `package.json` exports (browser build), `layerchart@2.5.0` deps, `pdfmake@0.3.11` (bundled svg-to-pdfkit), `sv@0.17.0` scaffold versions, `runed@0.37.1` (`PersistedState`). HIGH
- [RentCast API pricing](https://www.rentcast.io/api): plans, 50 free calls, overage. HIGH
- [RentCast API Terms of Use](https://www.rentcast.io/terms-api): §1 permitted uses, §2 restrictions, key-sharing clause, §7 retention. HIGH
- [RentCast Getting Started](https://developers.rentcast.io/reference/getting-started-guide): `X-Api-Key`, billing counts playground calls. HIGH
- [RentCast Rate Limits](https://developers.rentcast.io/reference/rate-limits): 20 req/s, 429. HIGH
- [Claude models overview](https://platform.claude.com/docs/en/about-claude/models/overview): model IDs, pricing, retirement dates. HIGH
- [OpenAI models](https://developers.openai.com/api/docs/models): GPT-5.6 Sol/Terra/Luna, GPT-6 Astra, Responses API recommendation. HIGH
- [Gemini models](https://ai.google.dev/gemini-api/docs/models) and [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing): IDs, shutdowns, free-tier data-use clause. HIGH
- [Gemini API key guidance](https://ai.google.dev/gemini-api/docs/api-key): client-side key warnings (relevant to BYOK disclosure). HIGH
- [anthropic-sdk-typescript README](https://github.com/anthropics/anthropic-sdk-typescript), [openai-node README](https://github.com/openai/openai-node): browser flags, runtime minimums. HIGH
- [SvelteKit adapter-static docs](https://svelte.dev/docs/kit/adapter-static): GitHub Pages base path, 404 fallback, `.nojekyll`, Actions workflow. HIGH
- [SvelteKit 3 RC announcement](https://svelte.dev/blog/sveltekit-3-release-candidate) and [What's new in Svelte: September 2026](https://svelte.dev/blog/whats-new-in-svelte-september-2026): Kit 3 still RC, breaking changes. HIGH
- [pnpm 12.0 release](https://pnpm.io/blog/releases/12.0) / [InfoQ coverage](https://www.infoq.com/news/2026/09/pnpm-12-rust/): Rust rewrite, pnpm 11 compatibility. MEDIUM
- [WXT installation](https://wxt.dev/guide/installation.html) and [WXT content scripts](https://wxt.dev/guide/essentials/content-scripts.html): Svelte template, `wxt:locationchange`, `createShadowRootUi`. HIGH
- [WXT monorepo write-up](https://weberdominik.com/blog/monorepo-wxt-nextjs/): tsconfig/alias handling in workspaces. MEDIUM
- [shadcn-svelte SvelteKit install](https://www.shadcn-svelte.com/docs/installation/sveltekit), [Chart component](https://www.shadcn-svelte.com/docs/components/chart), [Tailwind v4 migration](https://shadcn-svelte.com/docs/migration/tailwind-v4). HIGH (docs' `layerchart@next` note is stale vs registry)
- [Dexie Svelte tutorial](https://dexie.org/docs/Tutorial/Svelte), [Dexie issue #2231](https://github.com/dexie/Dexie.js/issues/2231), [Dexie issue #2075](https://github.com/dexie/Dexie.js/issues/2075): liveQuery + Svelte 5 patterns. MEDIUM
- [Web3Forms docs FAQ/API reference](https://docs.web3forms.com/getting-started/faq), [splitforms Formspree vs Web3Forms](https://splitforms.com/blog/formspree-vs-web3forms), [Formspree account limits](https://help.formspree.io/articles/account-management/account-limits.md): free-tier limits. MEDIUM (Web3Forms official pricing page blocked automated fetch)
- [Chrome Web Store registration](https://developer.chrome.com/docs/webstore/register), [Edge Add-ons developer registration](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account): $5 one-time vs free. MEDIUM
- GitHub API `releases/latest` for `actions/checkout`, `actions/setup-node`, `actions/upload-pages-artifact`, `actions/deploy-pages`, `pnpm/action-setup`; repo status for `wxt-dev/wxt`, `crxjs/chrome-extension-tools`. HIGH

---
*Stack research for: static browser-only BYOK real-estate GTM SaaS (SvelteKit + GitHub Pages) with MV3 companion extension*
*Researched: 2026-09-13*
