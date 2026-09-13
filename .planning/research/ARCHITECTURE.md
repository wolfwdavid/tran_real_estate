# Architecture Research

**Domain:** Browser-only, bring-your-own-key (BYOK), static multi-portal real-estate GTM SaaS (Renters / Investors / Agents) plus a companion Chrome MV3 extension
**Researched:** 2026-09-13
**Confidence:** HIGH for platform mechanics (CORS verified live, SvelteKit/GitHub Pages docs), MEDIUM for lead-inbox and extension approaches, LOW where flagged inline

---

## 0. Findings That Shape Everything (read first)

These were verified during research and change the architecture. The roadmap must account for them.

| # | Finding | Evidence | Architectural consequence |
|---|---------|----------|---------------------------|
| F1 | **All required providers accept browser (CORS) calls.** The preflight results below came from live `OPTIONS` probes sent from origin `https://wolfwdavid.github.io` on 2026-09-13. RentCast returns `access-control-allow-origin: *` and allows the `x-api-key` header. Anthropic allows `anthropic-dangerous-direct-browser-access`. OpenAI `/v1/responses` and `/v1/models` send `*`. Gemini `streamGenerateContent` echoes the origin. Formspree echoes the origin. Web3Forms sends `*` (it blocks curl without a browser UA; browsers pass). | Live curl probes (HIGH) | The no-backend BYOK design is feasible, and no proxy is needed in v1. |
| F2 | **RentCast does not expose response headers to the browser.** No `Access-Control-Expose-Headers` is sent, so `X-Total-Count` (from `includeTotalCount`) cannot be read by JavaScript. | Live probe of a 401 GET, which is not billed (HIGH) | Pagination must use "page until a response has fewer than `limit` rows". Never rely on total-count headers. |
| F3 | **RentCast bills only HTTP 200 responses with a body.** A 404 means "no results", 401 means a bad key, 403 means key restriction or billing, 429 means more than 20 req/s. The free Developer plan has **overage fees, not a hard cap**. | RentCast billing and response-code docs (HIGH) | The budget meter must be a **client-side hard stop**, because overspending can charge the user's card. Key validation can use a query designed to return 401 or 404, so it costs zero billable calls (MEDIUM, verify with a real key). |
| F4 | **RentCast's max `limit` is 500 per request, and market statistics are zip-code only.** | RentCast pagination and market-stats docs (HIGH) | Use a "fetch wide, filter local" strategy: one geography call can serve many saved searches. Metro dashboards have to be built from multiple cached zips. |
| F5 | **Browser storage is scoped per origin (scheme+host+port), not per path.** The app's origin `wolfwdavid.github.io` is shared with **every** GitHub Pages site on that account: the raj fleet, michelle_ngo_*, Eman_dashboard, DID sites and more. Any XSS or compromised dependency in any of those sites can read Tran's IndexedDB/localStorage, including the users' API keys. | MDN Same-origin policy (HIGH), and the user's own Pages inventory | **Phase 1 gate:** serve from a dedicated origin. A free GitHub organization such as `tran-real-estate.github.io` costs $0, or use a custom domain later. Make `BASE_PATH` an env var so the move needs no code change. |
| F6 | **GitHub Pages terms:** "not intended for or allowed to be used as a free web-hosting service to run your online business … or providing commercial software as a service (SaaS)", and "shouldn't be used for sensitive transactions like sending passwords or credit card numbers." | GitHub Pages limits doc (HIGH) | v1 is a free demo, which is acceptable. The **v2 paid SaaS must move hosting** (e.g., Cloudflare Pages/Netlify/Vercel). Keep the build host-agnostic, and never tie code to GitHub-Pages-only behaviors. |
| F7 | **Free form tiers have no read API.** The Web3Forms Submissions API is Pro-only. Formspree's Form Submissions API is Professional/Business only. The free tiers deliver by email only. | Web3Forms and Formspree docs (HIGH) | The agent "lead inbox" in v1 **cannot pull submissions**. It must be an ingest-by-paste/import inbox (see section 6). |
| F8 | **SvelteKit forbids `url.searchParams` during prerender, and adapter-static SPA fallback hurts SEO/performance.** CSP on prerendered pages is emitted as `<meta http-equiv>`, where `frame-ancestors`, `report-uri` and `sandbox` do not work. | SvelteKit docs (HIGH) | Every route is prerendered with **no dynamic `[param]` routes** in the app. Record IDs go in query strings and are read only in the browser. There is no clickjacking header, so add a JS frame-bust on sensitive pages. |
| F9 | **Safari deletes all script-writable storage (IndexedDB, localStorage) after 7 days without user interaction** (installed home-screen web apps are exempt). | WebKit ITP (MEDIUM, multiple sources) | JSON backup/export is a **core feature, not a nice-to-have**. Add a "last backed up N days ago" nudge and call `navigator.storage.persist()`. |
| F10 | **RentCast's own guidance says keys should "never" be exposed in client-side apps or browser extensions.** It supports per-key endpoint restrictions (IP restriction is impractical for browsers). | RentCast security doc (HIGH) | Onboarding must disclose the risk. Recommend a **dedicated, endpoint-restricted key** for Tran. The extension never touches keys. |

---

## 1. Standard Architecture

Browser-only BYOK apps converge on a **hexagonal (ports and adapters) client**:
- Pure domain logic sits in the middle.
- Ports (interfaces) define every I/O concern: listing data, LLM, persistence, secrets and lead intake.
- Adapters implement them: live provider, fixture/demo, and future server.
- One composition root picks the adapters at runtime based on mode (demo vs. live) and, in v2, on session/plan.

This gives four things at once: the demo works without keys, tests never hit the network, the v2 backend is an adapter swap, and portals never touch vendors directly.

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     PRESENTATION  (apps/web/src/routes)                      │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ (marketing)│  │ (app)/renters│  │(app)/investors│ │ (app)/agents │        │
│  │ SSR+prerend│  │ search alerts│  │ analyzer deals│ │ inbox crm    │        │
│  │ SEO, low JS│  │ fair-rent    │  │ markets memo  │ │ studio report│        │
│  └─────┬──────┘  └──────┬───────┘  └──────┬────────┘ └──────┬───────┘        │
│        │     ┌──────────┴─────────────────┴─────────────────┴───┐            │
│        │     │ (app)/settings: keys · usage/budget · data backup │ (print)/*  │
│        │     └──────────────────────────┬────────────────────────┘            │
├────────┴────────────────────────────────┴────────────────────────────────────┤
│                  FEATURE / USE-CASE LAYER  (src/lib/features, services)      │
│  ListingSearch · AlertsEngine · DealAnalyzer · FairRent · MarketDashboards   │
│  OutreachDrafts · MemoWriter · ContentStudio · LeadInbox · CRM/FollowUps     │
│  ReportBuilder · BackupService · Entitlements(v1: always-allow)              │
├──────────────────────────────────────────────────────────────────────────────┤
│                          PORTS  (TypeScript interfaces)                      │
│  ListingsSource  ValuationSource  MarketStatsSource  LlmProvider  LeadSink   │
│  Repos<T> (SavedSearch, Snapshot, Deal, Contact, Lead, FollowUp, Report,     │
│  Artifact)  SecretStore  UsageLedger  Clock  IdGen                           │
├───────────────────┬──────────────────┬──────────────────┬────────────────────┤
│  lib/data         │  lib/ai          │  lib/storage     │  lib/leads         │
│  DataGateway:     │  providers/      │  Dexie(IndexedDB)│  web3forms sink    │
│  dedupe→cache→    │  anthropic|openai│  repos, migrations│ paste/.eml parsers │
│  budget→adapter   │  |gemini|fixture │  secrets vault   │                    │
│  rentcast/ fixture│  sse, prompts/,  │  backup envelope │                    │
│                   │  guardrails      │                  │                    │
├───────────────────┴──────────────────┴──────────────────┴────────────────────┤
│                    packages/core  (pure TS, zero DOM, zero vendor)           │
│  domain types · schemas · finance math · filter/match · snapshot diff ·      │
│  budget math · backup schema+migrations · fair-housing term lexicon          │
├──────────────────────────────────────────────────────────────────────────────┤
│  packages/brand: tokens.css (CSS vars) · tokens.ts · Tailwind @theme · fonts │
└──────────────────────────────────────────────────────────────────────────────┘
          ▲ shared by                                   ▲ shared by
     apps/web                                     apps/extension (WXT, MV3)
                                                  content script on zillow.com
                                                  popup · chrome.storage.local
                                                  NO keys, NO network

External (browser → vendor, direct CORS):
  api.rentcast.io  ·  api.anthropic.com  ·  api.openai.com
  generativelanguage.googleapis.com  ·  api.web3forms.com (or formspree.io)
```

### Component Responsibilities

| Component | Owns | Talks to | Must NOT |
|-----------|------|----------|----------|
| **(marketing) routes** | Landing, `/for-renters`, `/for-investors`, `/for-agents`, extension install page. Fully SSR-prerendered for SEO. | `packages/brand`, `lib/ui` | Import `lib/data`, `lib/ai` or `lib/storage` (keeps marketing JS tiny and key-free) |
| **(app) portal routes** | Page composition, view state, UX flow per portal | `lib/features/<own portal>`, `lib/features/shared`, `lib/ui`, `lib/app` (container) | Import another portal's feature folder, or call vendors/`fetch` directly |
| **lib/app (composition root)** | Builds the container: mode (demo/live), selected LLM provider, adapter wiring, entitlements | All adapters | Hold business logic |
| **lib/data (DataGateway)** | Canonical request keys, in-flight dedupe, IndexedDB cache with per-endpoint TTL, budget ledger and hard cap, provenance metadata | `ListingsSource` adapters (RentCast, Fixture), `lib/storage` | Leak raw vendor JSON above the mapper; spend calls without passing the budget check |
| **lib/data/rentcast** | HTTP client (`X-Api-Key`), endpoint definitions, raw-to-domain mappers, response validation, error taxonomy (400/401/403/404/429/5xx) | `fetch` (injected) | Know about UI or cache |
| **lib/data/fixtures** | Synthetic, **hand-authored** RentCast-shaped JSON for a few metros, served through an injected fake `fetch` | Same RentCast client | Contain captured real RentCast data (license and public repo) |
| **lib/ai** | `LlmProvider` port; Anthropic/OpenAI/Gemini/Fixture adapters over raw `fetch`+SSE; prompt registry (versioned); generation runner (stream, abort, token and cost estimate); output guardrails | Provider endpoints, `lib/storage` (artifacts) | Auto-send anything; render output as HTML without sanitizing |
| **lib/storage** | Dexie schema and migrations, typed repositories, secrets vault, backup export/import, `storage.persist()` | IndexedDB, `packages/core` schemas | Store secrets in the same table/export as user data |
| **lib/leads** | Inquiry submission (`LeadSink` to Web3Forms), inbound parsing (pasted email, `.eml`, JSON payload block), lead normalization | Web3Forms API, `lib/storage` | Pretend to have a server-side inbox |
| **lib/export** | Print routes/stylesheets, CSV, lazy PDF (pdfmake) fallback | `lib/ui` charts | Load PDF libraries on initial bundle |
| **lib/ui** | Design-system components (Svelte 5), charts wrapper (LayerChart), generation panel, provenance chip, budget meter, demo banner | `packages/brand` | Fetch data |
| **packages/core** | Domain types, finance math, filters, snapshot diff, budget math, backup schema versions, fair-housing lexicon | Nothing (pure) | Import DOM, Svelte, Dexie or vendor SDKs, so it stays runnable in a Deno edge function in v2 |
| **packages/brand** | Color/type/spacing/radius/shadow tokens as CSS custom properties plus a TS export; Tailwind v4 `@theme` mapping; font files | Nothing | Contain component code |
| **apps/extension** | Zillow sponsored-card detection and hide/dim, popup toggle and counter, SPA navigation handling | `packages/brand`, `chrome.storage.local` | Request keys, call Tran APIs, extract or transmit Zillow listing data (that would be scraping) |

---

## 2. Recommended Project Structure

pnpm workspace monorepo. There are two deployables (web, extension) and two shared packages. The shared packages are cheap now and pay off in v2, because `core` runs server-side unchanged.

```
tran_real_estate/
├── package.json                  # workspace scripts: dev, build, test, lint, check
├── pnpm-workspace.yaml           # apps/*, packages/*
├── .github/workflows/
│   ├── ci.yml                    # typecheck, lint, vitest, playwright (demo mode), dep audit
│   ├── deploy-web.yml            # build apps/web with BASE_PATH → upload-pages-artifact → deploy-pages
│   └── extension.yml             # wxt zip → attach to GitHub Release (store upload is manual)
├── apps/
│   ├── web/                      # SvelteKit + adapter-static
│   │   ├── svelte.config.js      # adapter-static (no SPA fallback), paths.base = env BASE_PATH, kit.csp (mode: 'hash')
│   │   ├── static/               # .nojekyll, self-hosted fonts, optimized imagery, favicon
│   │   ├── src/
│   │   │   ├── app.html
│   │   │   ├── hooks.client.ts   # global error capture (local only), frame-bust guard
│   │   │   ├── routes/
│   │   │   │   ├── +layout.ts            # export const prerender = true
│   │   │   │   ├── (marketing)/
│   │   │   │   │   ├── +page.svelte              # landing: choose portal
│   │   │   │   │   ├── for-renters/ for-investors/ for-agents/
│   │   │   │   │   └── extension/                # install + what it does / doesn't do
│   │   │   │   ├── (app)/
│   │   │   │   │   ├── +layout.svelte    # app shell, demo/live badge, budget meter, container init (browser-only)
│   │   │   │   │   ├── renters/          # search/ alerts/ fair-rent/ outreach/
│   │   │   │   │   ├── investors/        # analyzer/ deals/ buy-boxes/ markets/ memo/
│   │   │   │   │   ├── agents/           # inbox/ crm/ studio/ reports/
│   │   │   │   │   └── settings/         # keys/ usage/ data/ (backup, import, wipe)
│   │   │   │   ├── (print)/              # minimal layout, print CSS: memo/ report/  (?id= query)
│   │   │   │   └── inquire/              # public inquiry form (renter/investor → agent)
│   │   │   └── lib/
│   │   │       ├── app/          # container.ts, mode.svelte.ts, entitlements.ts
│   │   │       ├── data/
│   │   │       │   ├── ports.ts
│   │   │       │   ├── gateway/  # gateway.ts, cache.ts, dedupe.ts, budget.ts, keys.ts (canonical request key)
│   │   │       │   ├── rentcast/ # client.ts, endpoints.ts, mappers.ts, schemas.ts, errors.ts
│   │   │       │   └── fixtures/ # fixture-fetch.ts, metros/*.json (synthetic)
│   │   │       ├── ai/
│   │   │       │   ├── ports.ts, sse.ts, runner.svelte.ts, models.ts (user-editable model IDs)
│   │   │       │   ├── providers/  # anthropic.ts, openai.ts, gemini.ts, fixture.ts
│   │   │       │   ├── prompts/    # outreach/interest.v1.ts, memo/investment.v1.ts, studio/*.v1.ts, crm/followup.v1.ts
│   │   │       │   └── guardrails/ # fair-housing.ts, pii-redact.ts
│   │   │       ├── storage/
│   │   │       │   ├── db.ts       # Dexie schema + versioned migrations
│   │   │       │   ├── repos/      # one file per aggregate, implements Repo<T>
│   │   │       │   ├── secrets/    # vault.ts (remember/session/passphrase modes)
│   │   │       │   └── backup/     # export.ts, import.ts (uses core schema migrations)
│   │   │       ├── alerts/        # run-on-open.ts (scheduler + budget allocation)
│   │   │       ├── leads/         # sink-web3forms.ts, parse-email.ts, parse-eml.ts
│   │   │       ├── export/        # print.ts, csv.ts, pdf-lazy.ts
│   │   │       ├── features/
│   │   │       │   ├── shared/    # listing card, property detail, provenance, generation panel wiring
│   │   │       │   ├── renters/   # view models + components specific to renters
│   │   │       │   ├── investors/
│   │   │       │   └── agents/
│   │   │       ├── security/      # sanitize.ts (DOMPurify), safe-links.ts, csp.md (policy rationale)
│   │   │       └── ui/            # design-system components (UI/UX Pro Max), charts/
│   │   └── tests/                 # playwright e2e (demo mode, built site under BASE_PATH)
│   └── extension/                 # WXT (MV3)
│       ├── wxt.config.ts          # manifest: permissions ['storage'], host_permissions ['*://*.zillow.com/*']
│       ├── entrypoints/
│       │   ├── zillow.content.ts   # defineContentScript, MutationObserver, wxt:locationchange
│       │   └── popup/             # Svelte popup: mode (dim|hide), per-page count
│       └── src/                   # detector.ts (heuristics), selectors.ts (versioned), badge (shadow root UI)
└── packages/
    ├── core/                      # pure TS: types, finance, filters, diff, budget, backup schemas, lexicon
    │   └── src/ + tests (vitest)
    └── brand/                     # tokens.css, tokens.ts, theme.css (Tailwind @theme), fonts/
```

### Structure Rationale

- **Route groups `(marketing)` / `(app)` / `(print)`:** Each group gets its own layout and bundle profile. Marketing stays SEO-prerendered with no storage or key code. The app shell initializes the container only in the browser. Print pages have a stripped layout for "Save as PDF".
- **Query-string IDs (`/investors/memo?id=…`) instead of `[id]` routes:** This keeps every page prerenderable on adapter-static without the SPA `404.html` fallback, which the SvelteKit docs warn has "large negative performance and SEO impacts". Read `page.url.searchParams` only in the browser (F8).
- **`lib/features/<portal>` isolation:** Portals share services, not each other's code. Enforce with ESLint `no-restricted-imports` so the three portals can be built in parallel phases without merge collisions.
- **`packages/core` pure:** Finance math, filter matching, snapshot diffing and backup migrations are the logic a v2 server alert job needs. Keeping them DOM-free means a Supabase Edge Function (Deno) can import them unchanged.
- **`packages/brand` separate:** It is the only thing the extension genuinely shares with the web app. Keeping tokens in plain CSS custom properties means they work in SvelteKit, inside the extension's shadow root and in print CSS.
- **`apps/extension` over `packages/extension`:** It is a deployable, not a library. The `apps/` vs. `packages/` split makes the dependency direction obvious (apps depend on packages, never the reverse).

---

## 3. Architectural Patterns

### Pattern 1: Ports and Adapters with a Runtime Composition Root

**What:** Features depend on interfaces only. `container.ts` wires Fixture adapters in demo mode and live adapters once keys exist. In v2 it wires Supabase/proxy adapters when a session exists.
**When to use:** Always here. Demo mode, tests and the v2 migration all need it.
**Trade-offs:** More files up front. It pays for itself the first time the demo, a test and live mode share one code path.

```typescript
// packages/core/src/ports.ts (types only; adapters live in apps/web)
export interface ListingsSource {
  rentals(q: GeoQuery, page: PageReq, signal?: AbortSignal): Promise<Page<Listing>>;
  sales(q: GeoQuery, page: PageReq, signal?: AbortSignal): Promise<Page<Listing>>;
}
export interface Repo<T extends Syncable> {
  get(id: string): Promise<T | undefined>;
  list(filter?: Partial<T>): Promise<T[]>;
  put(entity: T): Promise<void>;          // sets updatedAt
  remove(id: string): Promise<void>;      // soft delete: sets deletedAt (tombstone)
}
export interface Syncable { id: string; ownerId: 'local' | string; createdAt: string; updatedAt: string; deletedAt?: string; schemaVersion: number; }

// apps/web/src/lib/app/container.ts
export function buildContainer(mode: Mode, secrets: SecretSnapshot) {
  const fetchImpl = mode === 'demo' ? fixtureFetch : window.fetch.bind(window);
  const rentcast = new RentCastClient({ fetch: fetchImpl, apiKey: secrets.rentcast ?? 'demo' });
  return {
    data: new DataGateway({ source: rentcast, cache, ledger, budget, mode }),
    llm: mode === 'demo' ? new FixtureLlm() : providers[secrets.llmProvider](secrets.llmKey),
    repos: dexieRepos(db),
    entitlements: alwaysAllow,            // v2: planEntitlements(session)
  };
}
```

### Pattern 2: DataGateway Pipeline (dedupe, cache, budget, adapter)

**What:** A single choke point for every billable call. The request becomes a canonical key (endpoint plus sorted, normalized params). An in-flight promise map collapses duplicate requests. The IndexedDB cache is checked against a per-endpoint TTL. On a miss, a budget check may prompt for confirmation or hard-stop the call before the adapter runs. The ledger records the result. Normalized domain data returns with **provenance** `{source: 'cache'|'network'|'demo', fetchedAt, stale}`.
**When to use:** Every RentCast call, without exception. Lint-ban `fetch(` outside `lib/*/providers` and `lib/data/rentcast`.
**Trade-offs:** Cache-first means data can be days old. That is surfaced explicitly via provenance chips and a "Refresh (uses 1 call)" button. There is no silent stale-while-revalidate, because background revalidation spends budget.

Recommended TTLs (tune in Phase 4):

| Endpoint | TTL | Why |
|----------|-----|-----|
| Rental/sale listings (geo) | 24h | Alerts cadence; listings churn daily |
| Rent / value estimate (AVM) | 30d | Slow-moving; fair-rent and analyzer reuse |
| Property record | 90d | Near-static |
| Market statistics (zip) | 30d | Monthly history granularity |
| 404 "no results" | 24h negative cache | Not billed, but avoids repeated 20 req/s pressure and UI churn |

**Budget rules (F3):**
- The default hard cap is **45 of 50**, leaving a reserve for manual actions. The user can edit it.
- The billing-period reset day is user-set.
- Only 200s count as billable in the ledger; every attempt is still logged.
- A "calls used elsewhere" manual adjustment covers playground use and other devices. The local ledger cannot see those.
- Alert re-runs need an allocation, e.g., "max 1 call per saved search per 24h, max N per app open", and the usage screen shows a **projected monthly burn**.

**Fetch wide, filter local (F4):** Saved searches are keyed by *geography* (zip / city+state / lat-long+radius) for the network call with `limit=500`. Bedroom, price and property-type filters are applied locally in `core/filters`. Five saved searches in the same zip cost one call. There is one caveat: if a page returns exactly 500 rows, the result may be truncated. Warn the user and offer to page (each page is one billable call) or to narrow the geography.

### Pattern 3: Streaming LLM Provider Abstraction over raw `fetch`

**What:** One `LlmProvider.stream()` returns `AsyncIterable<LlmEvent>` (`text-delta | usage | done | error`). There are three thin adapters (~100-150 LOC each) plus a shared SSE line parser, with no vendor SDKs.
**When to use:** All generative features: outreach, memo, studio, CRM follow-ups.
**Trade-offs:** You maintain three small adapters yourself when APIs evolve. In exchange you get:
- A smaller bundle.
- Exact control of request headers. Vendor SDK telemetry headers such as `x-stainless-*` have broken CORS on Gemini's OpenAI-compat endpoint.
- One CSP `connect-src` list.
- Trivial MSW/fake-fetch testing.
- No SDK "Node 22+" runtime assumptions in the browser.

```typescript
export interface LlmProvider {
  id: 'anthropic' | 'openai' | 'gemini' | 'fixture';
  validateKey(signal?: AbortSignal): Promise<KeyStatus>;   // GET models endpoint: no token spend
  stream(req: LlmRequest, signal: AbortSignal): AsyncIterable<LlmEvent>;
}
// Endpoints (CORS verified 2026-09-13):
//  anthropic: POST https://api.anthropic.com/v1/messages  headers: x-api-key, anthropic-version,
//             anthropic-dangerous-direct-browser-access: true   body.stream = true
//  openai:    POST https://api.openai.com/v1/responses    Authorization: Bearer   body.stream = true
//  gemini:    POST https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse
//             header x-goog-api-key (prefer header over ?key= so the key never lands in URLs/logs)
```

Model IDs live in `lib/ai/models.ts` as defaults the user can override in settings. Model names go stale fast, so never hard-code a single model into feature code.

### Pattern 4: Versioned Prompt Registry with Guardrails

**What:** Each prompt is a module `prompts/<feature>/<name>.v<N>.ts` exporting `{ id, version, system, render(input), maxTokens, guardrails[] }`. Every generated artifact is persisted with `promptId@version`, provider, model, input hash and timestamp. Guardrails run pre-send (PII minimization: send only needed listing fields) and post-receive. The Fair Housing lexicon scan flags familial-status, religion, national-origin, disability and sex phrasing ("perfect for young professionals", "no kids"). Flagged terms are highlighted in the editor before the user can copy or send.
**When to use:** All four generative features.
**Trade-offs:** Slight ceremony. It enables A/B-able prompt changes in git history, reproducible outputs, and an auditable compliance story, which matters for a GTM product selling to agents.

### Pattern 5: Check-on-Open Alerts with Two Cursors

**What:** On app open, `alerts/run-on-open` picks due saved searches within the budget allocation and runs them through the DataGateway (the cache may satisfy some). It then computes `core.diffSnapshots(prev, next)` → `{added, priceChanged, statusChanged, removed}`. Two cursors are kept per search:
- `lastFetchedSnapshot` (what the network last said)
- `lastViewedAt` / `viewedIds` (what the user actually saw)

"N new since last visit" is computed against the *viewed* cursor, so a fetch the user never looked at doesn't swallow new listings.
**When to use:** Renter saved searches and investor buy-boxes (same engine, different `ListingsSource` method).
**Trade-offs:** No push notifications in v1. The same pure diff function runs in a v2 cron edge function, so that upgrade is cheap.

### Pattern 6: Sync-Ready Local Records (the v2 seam)

**What:** Every persisted entity implements `Syncable`: client-generated UUID, `ownerId: 'local'`, `createdAt`/`updatedAt`, soft-delete `deletedAt` tombstones, and `schemaVersion`. Repositories are async everywhere even though IndexedDB could be used synchronously. Mutations go through repos only.
**When to use:** From the first persisted table.
**Trade-offs:** Tombstones need periodic compaction. v2 can then upload local data to Supabase (`ownerId` = user id) with last-write-wins on `updatedAt`, with no rewrite and no ID remapping.

---

## 4. Data Flow

Arrows show the direction of data. `⇢` marks a network boundary (browser to vendor).

### 4.1 Listing search (live mode)

```
User sets filters (renters/search)
  → features/renters view-model
  → container.data.rentals(geoQuery, filters)
  → DataGateway
      → keys.canonical(endpoint, geoParams)            # filters NOT in key (fetch wide)
      → dedupe.inFlight?  ──yes──→ await same promise
      → cache.get(key) ──fresh──→ return {rows, provenance:'cache', fetchedAt}
      → budget.check(1)  ──over cap──→ throw BudgetExceeded → UI: "Cap reached (45/45). Raise cap or wait until <reset>"
                         ──near cap──→ confirm dialog
      → rentcast.client.get('/listings/rental/long-term', {limit:500, ...})  ⇢ api.rentcast.io (X-Api-Key)
      ← 200 → ledger.record(billable) → mappers.toListing[] → schema validate → cache.put(key, rows, ttl)
      ← 404 → ledger.record(unbilled) → negative cache → []
      ← 401/403 → SecretStatus=invalid|restricted → Settings prompt (no retry)
      ← 429 → backoff 1s, max 2 retries (unbilled)
  ← rows + provenance
  → core.filters.apply(rows, filters) → sorted results → UI (provenance chip, budget meter updates)
```

### 4.2 Demo mode (no keys) and tests

```
container(mode='demo') → RentCastClient({fetch: fixtureFetch})
  fixtureFetch(url) → matches endpoint + params → returns synthetic RentCast-shaped JSON (+ status codes incl. 404/429 cases)
  → SAME mappers, SAME gateway (ledger records source:'demo', never counts toward cap)
UI: persistent "Sample data" badge; "Add your free RentCast key" CTA.
Tests: vitest setup stubs globalThis.fetch to THROW; unit tests inject fixtureFetch explicitly.
       Playwright runs the built static site (BASE_PATH applied) in demo mode.
```

### 4.3 Alerts on app open

```
(app)/+layout mount (browser only)
  → alerts.runOnOpen()
      → savedSearches.list(due: lastRunAt + cadence < now)
      → budget.allocate(dueSearches) → groups by canonical geo key (one call serves many)
      → for each geo key: DataGateway.rentals|sales(...)            # 4.1 pipeline
      → for each search: core.filters.apply → core.diffSnapshots(prevSnapshot, next)
      → snapshots.put(next) ; savedSearches.put({lastRunAt, pendingNewCount})
  → nav badges "3 new" (renters/alerts, investors/buy-boxes)
User opens alert → mark viewedIds → pendingNewCount = 0
```

### 4.4 Generation (outreach, memo, studio, follow-up)

```
User clicks "Draft message" on a listing
  → prompts/outreach/interest.v1.render({listing subset, user profile tone})  # PII-minimized input
  → guardrails.pre (strip unneeded fields)
  → entitlements.can('ai.outreach')  (v1: true)
  → runner.start(provider.stream(req, abortSignal))  ⇢ provider endpoint (SSE)
  ← text deltas → $state buffer → GenerationPanel renders as PLAIN TEXT / sanitized markdown
  ← usage event → cost estimate shown (tokens × user-visible price table)
  → guardrails.post (fair-housing scan → inline highlights + required acknowledgement if flagged)
  → artifacts.put({promptId@version, provider, model, inputHash, output, edited:false})
User edits → Copy / "Open in email" (mailto: with body) / "Mark sent" → CRM activity log
NO auto-send path exists anywhere in the codebase.
```

### 4.5 Deal analysis, memo, then PDF

```
investors/analyzer?address=…
  → DataGateway.valueEstimate + rentEstimate (+ comps)   # cached 30d
  → core.finance.analyze({price, rent, expenses, financing}) → {capRate, NOI, cashFlow, CoC, DSCR}
  → deals.put(analysis)   (user inputs + snapshot of data used + provenance)
  → "Generate memo" → 4.4 with prompts/memo/investment.v1
  → (print)/memo?id=… → reads deal + artifact from IndexedDB in onMount → SVG charts + print CSS
  → window.print() → "Save as PDF"          (primary path: best brand fidelity, zero deps)
  → optional "Download PDF" → import('pdfmake') lazily → programmatic PDF  (deferred; only if print UX insufficient)
```

### 4.6 Lead intake and agent inbox (no backend, F7)

```
Visitor on /inquire?agent=<profileSlug> (or inquiry CTA on a listing)
  → form fields + hidden honeypot + hidden JSON block "TRAN-LEAD v1 {…}" (structured copy of the fields)
  → POST ⇢ api.web3forms.com/submit  (agent's own public access_key; per-agent BYOK because free tier caps per key)
  → Web3Forms emails the agent
  → visitor's browser stores a local "sent inquiries" record (their own history)

Agent (their own browser, agents/inbox)
  → "Import leads": paste email body(ies) / drop .eml files / paste CSV export
  → leads/parse-email: find "TRAN-LEAD v1" JSON block → validate schema → Lead
       fallback: heuristic field parse → optional LLM extraction (user-triggered, shows diff before save)
  → dedupe by (email, submittedAt, hash) → leads.put → CRM contact upsert → follow-up suggestion (4.4)
v1.x option (flag, LOW): agents on paid Formspree/Web3Forms plans could BYOK a read-API key → LeadSource adapter
v2: Web3Forms/Formspree webhook → Supabase table → SupabaseLeadSource (same port)
```

### 4.7 Keys and settings

```
settings/keys: user pastes key
  → format check (no network)
  → validate:
      RentCast: GET a deliberately-empty query → 404 = key OK (unbilled), 401 = bad key, 403 = restricted/billing   (verify semantics in Phase 4)
      LLM: GET models endpoint (no token spend)
  → vault.put(provider, key, mode)
       mode 'session'   → memory + sessionStorage only (default on shared computers)
       mode 'remember'  → IndexedDB 'secrets' store (separate DB from user data)
       mode 'passphrase'→ AES-GCM via WebCrypto, PBKDF2-derived key held in memory after unlock
  → container rebuilt → mode switches demo → live (existing demo saved searches NOT auto-run: explicit prompt)
Keys are NEVER included in backups, logs, error reports, URLs, or artifacts.
```

### 4.8 Backup / import

```
settings/data → Export
  → repos.dumpAll() (exclude secrets; cache excluded by default, toggle to include)
  → envelope {app:'tran-real-estate', schemaVersion, exportedAt, tables:{…}} → Blob download tran-backup-YYYY-MM-DD.json
  → meta.lastBackupAt = now   (banner if > 7 days: Safari eviction risk, F9)
Import
  → parse → core.backup.validate → core.backup.migrate(fromVersion → current)
  → strategy: 'replace' | 'merge' (by id, last-write-wins on updatedAt, tombstones respected)
  → dry-run summary ("+12 contacts, 3 conflicts") → confirm → transactional write
```

### 4.9 Extension

```
zillow.com page (SPA)
  → zillow.content.ts (runAt document_idle) → detector.scan(document)
       heuristics, ordered: visible "Sponsored"/"Promoted"/"Featured" label text within card → aria/data attributes → selector list (versioned)
  → apply mode: 'dim' (opacity + "Promoted" badge via shadow-root UI) | 'hide'
  → MutationObserver on results container (debounced) + ctx 'wxt:locationchange' re-scan
  → chrome.storage.local {mode, counts} ⇄ popup (Svelte + brand tokens)
No network requests, no data leaves the page, no Tran keys, no messaging to the web app.
```

### State Management

```
IndexedDB (Dexie)  ──liveQuery──►  thin runes adapter (useLive(query) → $state)  ──►  components
     ▲                                                                                  │
     └──────────── repos.put / remove  ◄──── feature actions (async) ◄─────────────────┘
Ephemeral UI state: $state/$derived in .svelte.ts classes (runner, filters, mode)
Cross-tab: Dexie liveQuery propagates DB changes; BroadcastChannel('tran') for secrets/mode changes
SSR/prerender safety: no module-level IndexedDB access; container created in (app) layout onMount / browser guard
```

Dexie `liveQuery` is a Svelte-store-compatible observable. Some Svelte 5 users have reported initial-`undefined` issues. Wrap it once in a runes helper and test that helper (MEDIUM).

---

## 5. Security Architecture and Threat Model

Keys in browser storage on a public static site mean the security boundary *is* the origin. Design for that.

| Threat | Vector | Mitigation (architectural) | Phase |
|--------|--------|----------------------------|-------|
| **Shared-origin exfiltration (F5)** | Any other `wolfwdavid.github.io/*` site (200+ repos) runs script that reads IndexedDB or opens Tran in a same-origin window | **Dedicated origin** (free GitHub org Pages site or custom domain) before any key UX ships. `BASE_PATH` env-driven. If this is deferred, default key mode is `session` and a warning is shown. | 1 (gate), 3 |
| XSS via data | Listing fields (agent names, descriptions), LLM output, pasted emails, imported backups | Never `{@html}` untrusted content. Markdown goes through `marked` then **DOMPurify** only in `lib/security/sanitize`. Lint-ban `{@html}` outside it. Schema-validate imports. | 3, 4, 7, 9 |
| Supply chain | Malicious/compromised npm dependency reads storage | Minimal deps (raw-fetch LLM adapters, no SDKs), pnpm lockfile, `pnpm audit` + Dependabot in CI, pinned GitHub Actions by SHA, no third-party script tags/analytics/CDNs, self-hosted fonts | 1, 12 |
| Exfil after injection | Injected script POSTs keys elsewhere | CSP meta via `kit.csp` mode `hash`: `default-src 'self'`; `script-src 'self'` (+kit hashes); `connect-src 'self' https://api.rentcast.io https://api.anthropic.com https://api.openai.com https://generativelanguage.googleapis.com https://api.web3forms.com`; `img-src 'self' data:`; `object-src 'none'`; `base-uri 'self'`; `form-action https://api.web3forms.com`. A strict `connect-src` is the most valuable directive here. | 1 |
| Clickjacking | `frame-ancestors` unsupported in meta CSP; Pages can't set headers | JS frame-bust on `(app)` layout (`if (top !== self) …` show blocker overlay) | 1 |
| At-rest theft | Profile/disk copy, shoulder-surfing devtools | Optional passphrase vault (AES-GCM). Be honest in the UI: it does **not** stop XSS. Masked inputs, "forget all keys" button. | 3 |
| Key over-privilege | Stolen RentCast key used for anything | Onboarding tells users to create a **dedicated RentCast key with endpoint restrictions** (listings, AVM, markets). LLM: set provider spend limits. | 3 |
| Runaway spend | Loop/bug burns RentCast overage (F3) or LLM tokens | Gateway hard cap, dedupe, alert allocation, per-generation `maxTokens`, abort buttons, "projected burn" UI | 4, 7 |
| Extension abuse | Extension becomes a scraping vector or over-permissioned | Permissions `storage` + zillow host only. No remote code (MV3). No messaging to the web app. Reviewed in store listing. | 11 |
| Compliance | Fair Housing violations in generated copy; auto-sent outreach | Guardrail scan, no auto-send code path, human-review UX | 7-10 |

---

## 6. What the Lead Inbox Can Realistically Be (v1)

| Capability | v1 feasible? | How |
|------------|--------------|-----|
| Visitor submits inquiry that reaches the agent | Yes | Web3Forms free (email delivery). Each agent supplies **their own** access key, because a shared Tran key would hit the free monthly cap across all users (Web3Forms free ≈250/mo, MEDIUM; Formspree free 50/mo, MEDIUM). |
| Agent sees inquiries inside the app automatically | **No** (free tiers have no read API, F7) | Deferred to v2 webhook into Supabase |
| Agent imports inquiries in seconds | Yes | Embedded `TRAN-LEAD v1 {json}` block in every submission, then paste/.eml import with exact parsing |
| Lead to CRM to follow-up reminders | Yes | Local CRM; reminders surface on app open (no push) |
| Visitor sees their own sent inquiries | Yes (same browser only) | Local "sent" record |
| Spam protection | Partial | Honeypot field (free). Captcha/domain restriction options vary by plan (LOW, verify). |

Name the feature honestly in the UI: "Lead Inbox: import from email". Don't imply real-time delivery.

---

## 7. Suggested Build Order (phases ship independently)

Dependency graph (A → B means B needs A):

```
P1 Foundation ─┬─► P2 Brand+Marketing ──────────────────────────────┐
               ├─► P3 Local Platform (storage, secrets, backup) ─┬─► P4 Data Layer ─┬─► P5 Renters ──┐
               │                                                 │                  ├─► P6 Investors ├─► P8 AI Features (renter+investor)
               │                                                 └─► P7 AI Layer ───┴────────────────┘         │
               │                                                                    └─► P9 Agents CRM+Inbox ──► P10 Studio+Reports
               └─► P11 Extension (needs only P1 brand package; can run in parallel any time after P2)
All ─► P12 Hardening & Launch
```

| # | Phase | Delivers (independently shippable) | Depends on | Research flag |
|---|-------|------------------------------------|------------|---------------|
| 1 | **Foundation and Deploy Skeleton** | pnpm monorepo, SvelteKit adapter-static on Pages with env `BASE_PATH`, route groups, `kit.csp` meta, frame-bust, `packages/core` + `packages/brand` stubs, CI (typecheck/lint/vitest/playwright smoke), import-boundary lint rules. **Decision gate: dedicated origin (F5).** | none | Yes: origin decision; GitHub Pages trailing-slash behavior |
| 2 | **Brand System and GTM Marketing Pages** | Tokens (warm editorial), self-hosted serif fonts, core UI components (UI/UX Pro Max), landing plus three audience pages, extension teaser page; WCAG AA contrast checks | P1 | No (standard) |
| 3 | **Local Platform: Storage, Secrets, Backup** | Dexie schema + migrations, `Syncable` repos, secrets vault (3 modes), settings/keys UX with risk disclosure, backup export/import + last-backup nudge, `storage.persist()` | P1 | Light: Safari eviction behavior |
| 4 | **Data Layer: RentCast Gateway and Demo Mode** | RentCast client + mappers + error taxonomy, fixture fetch + synthetic metros, DataGateway (dedupe, cache/TTL, budget hard cap, ledger), usage/budget screen, provenance chips, zero-cost key validation | P3 | **Yes:** verify 404-unbilled key validation, pagination billing, response field coverage with a real key |
| 5 | **Renter Portal: Search, Saved Searches, Alerts, Fair-Rent** | Nationwide search UI, fetch-wide/filter-local, saved searches, check-on-open alerts (core diff, two cursors), fair-rent check (rent AVM vs asking) | P4 | No |
| 6 | **Investor Portal: Analyzer, Buy-Box Alerts, Market Dashboards** | `core.finance` (cap rate, NOI, cash flow, CoC, DSCR) with property tests, deal save/compare, buy-box alerts (reuse engine), zip market dashboards (LayerChart), multi-zip compare from cache | P4 (alerts engine from P5 is reused, so run P6 after P5 or extract the engine in P5) | Light: metro aggregation from zip-only stats |
| 7 | **AI Layer: Providers, Streaming, Prompts, Guardrails** | `LlmProvider` port + Anthropic/OpenAI/Gemini/Fixture adapters, SSE parser, runner (abort, usage, cost estimate), prompt registry, fair-housing guardrail, generation panel, artifact store | P3 (can run in parallel with P4-P6) | **Yes:** current model IDs, streaming event shapes per provider, CORS on models endpoints |
| 8 | **AI Features: Outreach Drafts and Investment Memo + Print/PDF** | Renter outreach (mailto/copy, no auto-send), memo from deal analysis, `(print)` routes + print CSS, optional lazy pdfmake | P5, P6, P7 | Light: print CSS cross-browser |
| 9 | **Agent Portal: Lead Intake, Inbox Import, CRM, Follow-ups** | `/inquire` form + Web3Forms sink (per-agent access key), TRAN-LEAD block, paste/.eml import, CRM contacts/pipeline, follow-up reminders on open, drafted follow-ups | P3, P7 | **Yes:** Web3Forms free-tier limits/captcha, email formatting of payload block |
| 10 | **Agent Content Studio and Branded Market Reports** | Listing descriptions, social posts, founder-story script template (hook, pain, before/after, results, mission, CTA), agent branding profile, neighborhood/market report print/PDF | P6 (dashboards), P7, P8 (print pipeline), P9 (agent profile) | Light: RentCast terms for sharing derived stats in client reports |
| 11 | **Browser Extension: Zillow Sponsored Filter** | WXT MV3 content script, heuristic detector + versioned selectors, dim/hide modes, popup with brand tokens, zip artifact in Releases, store listing copy | P1 (+P2 tokens) only, so it can be scheduled early for GTM | **Yes:** current Zillow DOM/labels, WXT 0.x stability, Chrome Web Store policy for DOM-modifying extensions |
| 12 | **Hardening and Launch** | CSP tightening review, dependency audit, a11y audit (axe) across portals, performance budget (marketing JS), demo polish, docs (privacy/key-handling page, "what Tran never does"), v2 seam review | all | No |

**Ordering rationale:**
- **P3 before P4:** Cache, ledger and secrets all live in storage. Building the gateway without them means rework.
- **P4 before any portal:** Every portal's core value needs listing/AVM/market data. Demo fixtures in P4 mean portals are demoable with no key from day one.
- **P7 is parallel-capable with P4-P6:** It depends only on storage and settings, so AI feature phases (P8-P10) can start once portals have data screens.
- **P9 doesn't need P4:** Leads and CRM are local plus Web3Forms. It could be pulled earlier if the agent audience is the GTM priority.
- **P11 is fully decoupled:** It is a strong standalone GTM hook ("hide promoted listings") and can ship right after P2.
- **Security isn't a late phase:** CSP and origin land in P1, secrets in P3, sanitization with the first untrusted render (P4/P7). P12 audits rather than introduces.

---

## 8. v2 Backend Path (Supabase + Stripe) Without Rewrite

| Seam built in v1 | v1 adapter | v2 adapter | Change required in features |
|------------------|------------|------------|-----------------------------|
| `Repo<T>` + `Syncable` records | Dexie | Supabase (RLS by `ownerId`) + one-time local upload | None |
| `ListingsSource` / valuation / markets | Direct RentCast (BYOK) | Proxy edge function with a server key, metered per plan (BYOK stays as an option) | None |
| `UsageLedger` / budget | Local ledger | Server ledger (authoritative) | None |
| `LlmProvider` | Direct BYOK | Proxy provider (server key, plan quotas) | None |
| `LeadSource` | Paste/.eml import | Webhook into a table, realtime subscription | None |
| Alerts | Check-on-open in browser | Cron edge function importing `packages/core` diff + email digest | None (the browser path remains as fallback) |
| `Entitlements` | always-allow | Stripe-plan-backed | None |
| Session | `ownerId: 'local'` | Supabase auth user id | Container wiring only |
| Hosting | GitHub Pages | Cloudflare Pages / Netlify / Vercel (required by Pages terms for paid SaaS, F6) | Change `BASE_PATH`; the build is host-agnostic |

---

## 9. Scaling Considerations

The app has no servers, so scale concerns are **per-user quotas and shared free tiers**, not compute.

| Scale | Architecture adjustments |
|-------|--------------------------|
| 0-1k users | As designed. Each user's RentCast/LLM quota is their own. GitHub Pages is fine (1 GB site, 100 GB/mo soft bandwidth). |
| 1k-10k users | Bandwidth: optimize imagery (AVIF, responsive), consider Cloudflare Pages. Form service: per-agent access keys are mandatory. Support load from "cap reached" confusion, so improve the budget UX. |
| 10k+ / paid | Execute section 8: hosted origin, Supabase, server-side metered data keys (RentCast paid plan economics), Stripe. |

### Scaling Priorities

1. **First bottleneck: the RentCast 50-call/month budget per user.** It breaks as soon as a user has more than about two daily alerts. Fix with fetch-wide/filter-local, geo-key sharing, TTLs, projected-burn UI, and a clear upgrade path (the user's own paid RentCast plan in v1, a Tran plan in v2).
2. **Second bottleneck: local-only data durability.** Safari eviction, device changes and cleared storage all lose data. Fix with backup nudges and `persist()` in v1, and sync in v2.
3. **Third: form-service caps** if a single shared access key is ever used. Avoid by design.

---

## 10. Anti-Patterns

### Anti-Pattern 1: Portals calling `fetch` / vendor APIs directly
**What people do:** A renter page calls RentCast inline "just for this one feature".
**Why it's wrong:** It bypasses dedupe, cache and budget, so it silently burns the 50-call quota and can trigger overage charges (F3). It also breaks demo mode and makes tests hit the network.
**Do this instead:** All calls go through `DataGateway` / `LlmProvider`. Lint-ban `fetch(` outside adapter folders.

### Anti-Pattern 2: Dynamic `[id]` routes with the SPA `404.html` fallback
**What people do:** `routes/deals/[id]/+page.svelte` with `fallback: '404.html'` to make unknown IDs load.
**Why it's wrong:** GitHub Pages returns HTTP 404 status for those pages, the SvelteKit docs warn of large SEO/performance costs, and it complicates base-path handling.
**Do this instead:** Prerendered pages with `?id=` read in the browser.

### Anti-Pattern 3: Hard-coded root links and asset paths
**What people do:** `<a href="/renters">`, `fetch('/fixtures/x.json')`.
**Why it's wrong:** They break under `/tran_real_estate` today and under a new origin tomorrow.
**Do this instead:** Use `resolve()`/`base` from `$app/paths` everywhere, and add a Playwright smoke test that runs the built site under a non-root base.

### Anti-Pattern 4: Storing keys alongside user data or in exports
**What people do:** Put keys in the same settings object that gets JSON-exported or logged.
**Why it's wrong:** Backups get emailed and uploaded, which leaks keys.
**Do this instead:** Keep a separate secrets DB/store, exclude it from export by construction (the export reads an allowlist of tables), and redact keys in error paths.

### Anti-Pattern 5: Rendering LLM or listing text as HTML
**What people do:** `{@html marked(output)}`.
**Why it's wrong:** Prompt injection via listing descriptions or pasted emails becomes XSS, and XSS on this origin steals keys.
**Do this instead:** Plain text by default. Sanitized markdown only through `lib/security/sanitize`.

### Anti-Pattern 6: Capturing real RentCast/Zillow data as fixtures
**What people do:** Save a real API response or Zillow HTML into `fixtures/` for convenience.
**Why it's wrong:** The repo is public. RentCast redistribution concerns and Zillow copyright/ToS apply.
**Do this instead:** Hand-author synthetic data matching the *shape*. For extension tests, use minimal synthetic DOM mimicking card structure.

### Anti-Pattern 7: Background revalidation or auto-refresh of listings
**What people do:** SWR-style refetch on focus or interval.
**Why it's wrong:** Each refetch is a billable call. A tab left open all day drains the month.
**Do this instead:** Cache-first, explicit "Refresh (1 call)", and alerts only on open within the allocation.

### Anti-Pattern 8: Extension "send to Tran" data extraction
**What people do:** Add a button that reads the Zillow listing and imports it into the app.
**Why it's wrong:** That is scraping by another name and violates Zillow ToS and the project's legitimacy constraint.
**Do this instead:** The extension only hides/dims elements locally. At most, link to Tran's own search for the same zip that the user types.

---

## 11. Integration Points

### External Services

| Service | Integration pattern | Notes / gotchas |
|---------|---------------------|-----------------|
| RentCast `https://api.rentcast.io/v1` | Browser `GET` with `X-Api-Key` via DataGateway | CORS `*` verified. No exposed headers (no `X-Total-Count` access). 20 req/s. Only 200s billed. 404 = no results. Overage fees on the free plan. `limit` ≤ 500. Market stats zip-only (sale history from 2024-01, rental from 2020-04). |
| Anthropic Messages API | `POST /v1/messages`, SSE, `anthropic-dangerous-direct-browser-access: true` | CORS verified. Models via `GET /v1/models` for key validation. |
| OpenAI Responses API | `POST /v1/responses`, `stream: true`, Bearer | CORS verified on `/v1/responses` and `/v1/models`. A transient CORS outage occurred 2025-10-15 and was fixed same day, so surface network errors clearly. |
| Gemini API | `POST …:streamGenerateContent?alt=sse`, `x-goog-api-key` header | CORS verified on the native endpoint. Avoid the OpenAI-compat endpoint and SDK paths that add non-allowlisted headers (`Api-Revision`, `x-stainless-*`). |
| Web3Forms | Browser `POST /submit` (FormData or JSON) | CORS `*` verified (Cloudflare may challenge non-browser UAs). Free = email only, no read API. Access key is public by design. |
| Formspree (alternative) | `POST /f/<id>` | CORS echo verified. Free 50/mo. Submissions API is Professional/Business only. |
| GitHub Pages | Actions artifact deploy | 1 GB site, 100 GB/mo soft, 10 builds/hr soft. **No commercial SaaS use** (F6). No custom headers, so CSP goes in meta. |
| Chrome Web Store | Manual upload of WXT zip | MV3: no remote code; justify host permission. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| routes ↔ features | Direct import (view-models, components) | A portal imports only its own feature folder plus `shared` |
| features ↔ services/ports | Async function calls via container | No vendor types above ports |
| DataGateway ↔ storage | Repo calls (cache, ledger tables) | Transactions for ledger+cache writes |
| AI runner ↔ UI | `AsyncIterable` consumed into `$state`; `AbortController` | One active generation per panel |
| storage ↔ tabs | Dexie liveQuery; `BroadcastChannel('tran')` for secrets/mode | Keys never broadcast, only a "changed" signal |
| web app ↔ extension | **None** (by design) | Shared only at build time via `packages/brand` |
| web app/extension ↔ core/brand | Workspace package imports | `core` stays pure; enforce with lint + a tsconfig without DOM lib |

---

## Sources

**Verified live (HIGH):** CORS preflight probes from origin `https://wolfwdavid.github.io` against `api.rentcast.io`, `api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com`, `api.web3forms.com`, `formspree.io` (2026-09-13). Keyless RentCast GET returned 401 with no exposed headers. npm registry versions (2026-09-13): @sveltejs/kit 2.70.3, svelte 5.57.0, adapter-static 3.0.10, wxt 0.21.4, dexie 4.4.6, layerchart 2.5.0, pdfmake 0.3.11, dompurify 3.4.15, tailwindcss 4.3.3.

**Official documentation (HIGH):**
- RentCast: [Getting started](https://developers.rentcast.io/reference/getting-started-guide), [Billing](https://developers.rentcast.io/reference/billing-and-pricing.md), [Response codes](https://developers.rentcast.io/reference/response-codes.md), [Pagination](https://developers.rentcast.io/reference/pagination.md), [Rental listings](https://developers.rentcast.io/reference/rental-listings-long-term.md), [Market statistics](https://developers.rentcast.io/reference/market-statistics.md), [Security](https://developers.rentcast.io/reference/security.md)
- SvelteKit: [adapter-static](https://svelte.dev/docs/kit/adapter-static), [configuration (csp, paths)](https://svelte.dev/docs/kit/configuration), [page options (prerender, searchParams)](https://svelte.dev/docs/kit/page-options)
- GitHub: [Pages limits and prohibited uses](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), [What is GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- MDN: [Same-origin policy (storage per origin)](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy), [StorageManager.persist()](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)
- Web3Forms: [Submissions API (Pro)](https://docs.web3forms.com/getting-started/submissions-api). Formspree: [Form Submissions API (Professional/Business)](https://help.formspree.io/hc/en-us/articles/360015233153-Form-Submissions-API)
- WXT: [repository](https://github.com/wxt-dev/wxt), [content scripts guide](https://github.com/wxt-dev/wxt/blob/main/docs/guide/essentials/content-scripts.md)
- OpenAI: [openai-node README (browser flag)](https://github.com/openai/openai-node)

**Secondary (MEDIUM/LOW, flagged inline):**
- [Simon Willison: Anthropic CORS header](https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/)
- [OpenAI community: 2025-10-15 CORS incident](https://community.openai.com/t/chat-completions-api-endpoint-down-blocked-any-web-browser-request/1362527)
- [Gemini forum: OpenAI-compat CORS + stainless headers](https://discuss.ai.google.dev/t/gemini-api-cors-error-with-openai-compatability/58619)
- [js-genai #1723: Api-Revision preflight](https://github.com/googleapis/js-genai/issues/1723)
- [Dexie #2075: liveQuery and Svelte 5 runes](https://github.com/dexie/Dexie.js/issues/2075)
- [Safari 7-day storage cap overview](https://support.didomi.io/apple-adds-a-7-day-cap-on-all-script-writable-storage)
- Web3Forms and Formspree free-tier caps: [formgrid](https://formgrid.dev/blog/web3forms-alternatives-in-2026), [splitforms](https://splitforms.com/formspree-free-plan-limits)
- [Client-side PDF library comparison (Nutrient)](https://www.nutrient.io/blog/top-js-pdf-libraries/)

---
*Architecture research for: browser-only BYOK multi-portal real-estate GTM SaaS (Tran Real Estate)*
*Researched: 2026-09-13*
