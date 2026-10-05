# Phase 10: Launch Hardening & Go-to-Market - Research

**Researched:** 2026-10-04
**Domain:** SvelteKit 2 static SEO surface (sitemap, robots, OG cards, JSON-LD under a hash-mode meta CSP), first-party analytics beacon (Umami collection API), first-run onboarding a11y, Web3Forms waitlist/feedback, build-size budgets, dependency audit, launch audit
**Confidence:** HIGH for the build/CSP/beacon/OG mechanics (each verified by a spike on this machine against the repo's exact Kit 2.70.3 / Vite 8.3.0 / Svelte 5.57.0 toolchain and in Chromium). MEDIUM for Umami Cloud plan details and Dependabot's pnpm 11 status. LOW for nothing that the plan depends on.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

The owner chose fully autonomous mode on 2026-10-04. Recommended defaults adopted.

#### Onboarding (GTM-01)
- First visit (flag in Phase 3 prefs): modal-free inline onboarding on the landing → choose portal → 3-step tour (what it does, where keys go, sample vs live) → "Try sample data" (sets sample mode, opens portal) or "Connect a free RentCast key" guide: (1) create a dedicated endpoint-restricted key at RentCast, (2) paste + Test, (3) set the call cap (default 40). Re-openable from Settings.

#### Waitlist & feedback (GTM-02)
- Forms post to Web3Forms using **the owner's** access key (public-safe), tagged by portal; honeypot + timing; **owner key deferred** — read from a build-time env `PUBLIC_WEB3FORMS_KEY` that, when absent, renders the form in "coming soon" state with a mailto fallback. No third-party scripts.

#### SEO tool pages (GTM-03)
- `/tools/affordability/`, `/tools/cap-rate/`, `/tools/cash-on-cash/`, `/tools/dscr/` reusing `core.finance` and the Phase 6 affordability component; zero API calls; each with title/description, JSON-LD `WebApplication`/`FAQPage`, OG share card (static PNG generated at build from brand tokens via a Node script — no runtime canvas), `sitemap.xml` + `robots.txt` generated at build for the configured base URL. Marketing JS budget: tool pages ≤ 60 KB gz JS (asserted by a build-size test).

#### Analytics (GTM-04)
- First-party **fetch beacon** to a self-hosted Umami collection endpoint host configured via `PUBLIC_ANALYTICS_HOST`; payload = path, portal, referrer host only, screen class; **no IDs, no IP logic, no cookies**; respects `navigator.doNotTrack`/GPC; CSP `connect-src` gains that host only when configured (build-time). If no host configured → beacon no-op. **Owner has no Umami instance yet → ship no-op; CORS verification is a HUMAN-UAT item; cut line applies.**

#### Launch audit (success criterion 5)
- Scripted: axe on every route in keyless and mocked-key states (E2E), CSP review test (no `unsafe-inline` except `style-src-attr`, meta first in head), `pnpm audit --prod` clean (or documented exceptions), banned-terms + disclaimer presence audit (every portal page footer has the disclaimer), Lighthouse-style perf budget check, PITFALLS "Looks Done But Isn't" checklist walked and recorded in `docs/LAUNCH-AUDIT.md`.

### Claude's Discretion
- Tour implementation (inline steps vs. popovers); OG image generation lib (prefer `@resvg/resvg-js` or `sharp` dev-dependency only).

### Deferred Ideas (OUT OF SCOPE)
- "What Tran never does" trust page (GTM-V2-01) — include if time allows as a legal-style page.
- Analytics moves to v2 if Umami CORS fails from the deployed origin (owner records decision).

### Specific Ideas (from CONTEXT)
- No programmatic "rentals in [city]" pages filled with RentCast data (anti-feature): SEO pages are calculators only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GTM-01 | First-time visitor picks a portal, sees a short tour, and chooses "Try sample data" or a guided free RentCast key setup | §Pattern 8 (inline, modal-free tour: radio-group portal choice, focus-to-step-heading, no trap, CLS-safe placement); Phase 4 fact: no key ⇒ sample mode automatically, so "Try sample data" is a link (`/renter/?sample=1`) and the marketing route never imports storage; key guide composes Phase 3 `ProviderKeyCard` + Phase 4 Test key + `CapEditor` in an `(app)` route; Pitfall 9 (prefs module boundary) |
| GTM-02 | Visitor can join a per-portal waitlist and send feedback | §Pattern 9 (reuse Phase 8 `lib/leads/web3forms-sink.ts`, owner key from validated build constant, "coming soon" + optional mailto when absent, honeypot + 3 s timing, `portal` tag), Pitfall 10 (honeypot deprecated, captcha must stay off), privacy-page update |
| GTM-03 | Visitor can use free SEO tool pages discoverable via sitemap and share cards | §Patterns 2-6 (site URL constant, `prerender.origin` crawl validation, glob-derived `sitemap.xml` + `robots.txt` endpoints, OG PNG as prerendered endpoint with resvg + WOFF→SFNT, JSON-LD via `<svelte:element this={'script'}>` with `\u` escaping), §Pattern 7 (JS budget from built HTML), Pitfalls 1-6 |
| GTM-04 | Owner can see page and portal usage counts through a first-party analytics beacon that sends no personal data | §Pattern 10 (Umami `/api/send` payload verified from Umami v3.4.0 source; `no-cors` text/plain keepalive fetch verified to deliver without preflight, cookies or Referer; consent gate; strict payload schema), §Pattern 11 (CSP builder + oracle with optional host), Pitfalls 7-8 (referrer must be a full URL; bare host is silently treated as self-referral) |
</phase_requirements>

## Summary

Phase 10 sits on top of eight phases that are **planned but not yet executed** (only Phase 1 is built; Phase 2 is being planned now). Every integration point below is therefore a contract with a future phase, not existing code. The planner must reference those contracts (Phase 2 `routes.ts` + banned-terms scripts + layout, Phase 3 prefs + vault + Settings, Phase 4 sample mode + `CapEditor` + Test key, Phase 6 affordability component, Phase 7 `packages/core/src/finance/`, Phase 8 `lib/leads/web3forms-sink.ts`) and add a Wave 0 task that re-reads their SUMMARYs before coding.

The technical surface is small and almost entirely build-time. Six findings change how the plan must be written, all verified by spikes in an isolated copy of `apps/web` on this machine: (1) `base` from `$app/paths` is **relative** (`../..`) during prerender, so absolute canonical/OG/sitemap URLs built from it are silently broken; use a validated build-time `SITE_URL` constant instead. (2) `$env/static/public` **fails the build** (`MISSING_EXPORT`) when a `PUBLIC_*` variable is unset, so the "no host → no-op" design cannot import `PUBLIC_ANALYTICS_HOST` that way. (3) Setting `kit.prerender.origin` to the site origin makes Kit's crawler follow absolute `og:image`/`og:url`/canonical URLs, so a missing OG PNG **fails the build** (free validation). (4) `@resvg/resvg-js` renders **no text at all** from WOFF fonts (silently), but works with a 25-line WOFF1→SFNT conversion of the static `@fontsource/*` `.woff` files, and it runs fine inside a prerendered `+server.ts` endpoint, which removes the need for any prebuild script. (5) JSON-LD in a `type="application/ld+json"` block causes **zero CSP violations** under the hash-mode meta CSP and is not duplicated by hydration, but the repo's own `scripts/assert-csp.mjs` oracle flags it, and Svelte entity-escapes `<`/`&` inside it, so the JSON must be `\u`-escaped and the oracle must exempt data blocks. (6) `pnpm audit --prod` is **vacuous** here (every web package is a devDependency because the static build bundles them), so the gate must be the full `pnpm audit` with `audit.ignore` exceptions. It currently reports 7 findings: 6 are fixed by a lockfile-only `pnpm audit --fix=update` (devalue 5.9.2 → 5.9.4), and 1 is a documented exception (`cookie` <0.7 via Kit, server-only, never shipped).

The analytics beacon de-risks itself: a `fetch` with a string body (`text/plain`), no custom headers, `mode: 'no-cors'`, `credentials: 'omit'`, `keepalive: true` and `referrerPolicy: 'no-referrer'` is a CORS "simple request". Chromium delivered it with **no preflight, no cookies and no Referer**, even to a collector that sends no CORS headers at all. Umami's `/api/send` parses the body with `request.json()`, which ignores Content-Type. The deferred "Umami CORS from the deployed origin" UAT therefore reduces to "events appear in the dashboard". The cut line is still recorded, but it is unlikely to trigger.

**Primary recommendation:** Put all build-time configuration (site origin, analytics host + website ID, Web3Forms key, contact email) in one validated `apps/web/src/lib/site-config.js` module, consumed by `svelte.config.js` (CSP + `prerender.origin`) and by `vite.config.ts` (`define`). Generate sitemap, robots and OG PNGs as prerendered `+server.ts` endpoints. Add exactly two dev dependencies (`@resvg/resvg-js@2.6.2`, `@fontsource/fraunces@5.3.0` + `@fontsource/inter@5.3.0`) and zero runtime dependencies.

## Standard Stack

### Core (new in this phase; all dev-only, nothing ships to the browser)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@resvg/resvg-js` | **2.6.2** (stable; 2.7.0 is alpha-only) | Rasterize a hand-authored SVG share card to PNG at prerender | Pure-Rust renderer via prebuilt napi binaries (`win32-x64-msvc`, `linux-x64-gnu` pulled as optionalDependencies; **no install script**, so pnpm 11 `allowBuilds` needs no entry). Deterministic: two renders produced byte-identical PNGs. Verified working inside a Kit prerendered endpoint on Windows. |
| `@fontsource/fraunces` | **5.3.0** | Static Fraunces 600 `.woff` for the OG card headline | The variable package ships only `.woff2`, which resvg cannot read. The static package ships `fraunces-latin-600-normal.woff` (WOFF1, zlib), which converts losslessly to TTF with `node:zlib`. |
| `@fontsource/inter` | **5.3.0** | Static Inter 400/600 `.woff` for the OG card body text | Same reason. |

### Existing stack used (no version changes)
| Library | Version | Use in Phase 10 |
|---------|---------|-----------------|
| `@sveltejs/kit` | 2.70.3 | `+server.ts` prerendered endpoints, `prerender.origin`, `afterNavigate`, `import.meta.glob` |
| `@playwright/test` + `@axe-core/playwright` | 1.63.0 + 4.13.0 | Axe keyless/keyed, third-party-request audit, beacon payload capture, CLS check |
| Vitest | 4.1.11 | Pure units: payload builder, consent gate, site-config validation, CSP builder, WOFF converter, budget calculator, sitemap/OG/JSON-LD oracles |
| `zod` (`zod/mini`) | 4.6.4 (already planned for Phases 3+) | Strict beacon payload schema in tests only (optional; a hand-written key whitelist is equally fine) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| resvg + WOFF→SFNT | `sharp` 0.35.5 | sharp renders SVG through librsvg + **system fontconfig**, so text depends on the OS fonts (Windows vs Ubuntu runner differ). Larger binaries. Reject. |
| resvg + WOFF→SFNT | `satori` 0.35.0 + resvg | Satori lays out JSX-like trees and accepts WOFF (not WOFF2), but adds a layout engine for a fixed 1200×630 card with four short titles. Not worth the dependency. |
| resvg + WOFF→SFNT | Commit Fraunces/Inter TTFs to the repo | Works and avoids the converter, but adds ~1 MB of binaries and a second copy of the brand fonts that can drift from the site's. Acceptable fallback if the converter ever misbehaves. |
| OG PNG as prerendered endpoint | Node prebuild script writing `static/og/*.png` | Needs a gitignored generated dir, a `build` script chain, and a separate step for `vite dev`. The endpoint approach has none of that and is validated by Kit's crawler. |
| Static budget from built HTML | `size-limit` 14.1.0 / Lighthouse CI | size-limit measures entry files, not Kit's per-route modulepreload graph. Lighthouse needs a Chrome download and is flaky in CI. Both are heavier than a 40-line Node oracle. |
| Umami | GoatCounter / Plausible | Only if Umami is abandoned. With a `no-cors` simple-request beacon, delivery does not depend on the collector's CORS headers, so the cut line rarely matters. Plausible's `/api/event` also accepts text/plain JSON. |

**Installation:**
```bash
corepack pnpm --filter web add -D @resvg/resvg-js@2.6.2 @fontsource/fraunces@5.3.0 @fontsource/inter@5.3.0
corepack pnpm audit --fix=update        # lockfile-only: devalue 5.9.2 -> 5.9.4 (fixes 6 of 7 findings)
```

**Version verification (npm registry, 2026-10-04):** `@resvg/resvg-js` 2.6.2 (latest stable; `2.7.0-alpha.2` 2026-01-28), `satori` 0.35.0, `sharp` 0.35.5, `@fontsource/fraunces` 5.3.0, `@fontsource/inter` 5.3.0, `size-limit` 14.1.0, `devalue` 5.9.4 / 6.0.2. Note: `@sveltejs/kit` `latest` is now **3.0.0**. The project pin stays at 2.70.3 and this phase must not migrate.

## Architecture Patterns

### Recommended Project Structure (additions only)
```
apps/web/src/
├── lib/
│   ├── site-config.js            # NEW: validated build-time config (Node + browser safe, like base-path.js)
│   ├── site.ts                   # NEW: typed re-export of the Vite `define` constants
│   ├── csp-policy.js             # NEW: pure CSP directive builder (consumed by svelte.config.js, unit-tested)
│   ├── analytics/                # NEW fetch-allowlisted adapter folder (eslint.config.js + eslint-rules.test.ts)
│   │   ├── payload.ts            # pure: buildPageview(), buildEvent(), screenClass(), referrerOrigin()
│   │   ├── consent.ts            # pure: trackingAllowed(nav, win)
│   │   └── beacon.ts             # the only fetch: send(payload, cfg, fetchImpl)
│   ├── seo/
│   │   ├── SeoHead.svelte        # title, description, canonical, OG/Twitter tags, JSON-LD
│   │   ├── jsonld.ts             # pure: webApplication(), faqPage(), serializeJsonLd()
│   │   ├── og-card.server.ts     # server-only: SVG template from @tran/brand tokens + resvg render
│   │   └── woff.server.ts        # server-only: WOFF1 -> SFNT (node:zlib)
│   ├── content/tools.ts          # typed per-tool copy: title, description, FAQ, disclaimer (NOT under lib/data)
│   ├── components/tools/         # pure calculators (no storage/ai/data imports; lint-enforced)
│   └── features/shared/onboarding/  # Tour.svelte, KeySetupGuide.svelte, onboarding-state.svelte.ts
└── routes/
    ├── sitemap.xml/+server.ts    # NEW prerendered endpoint
    ├── robots.txt/+server.ts     # NEW prerendered endpoint
    ├── og/{affordability,cap-rate,cash-on-cash,dscr,default}.png/+server.ts   # NEW prerendered PNG endpoints
    ├── (marketing)/tools/+page.svelte and tools/{affordability,cap-rate,cash-on-cash,dscr}/+page.svelte
    ├── (marketing)/feedback/+page.svelte
    └── (app)/start/rentcast/+page.svelte   # guided key setup (composes Phase 3/4 components)
scripts/
├── assert-budget.mjs (+ .test.ts)        # NEW: JS/CSS gz per route from built HTML
├── assert-seo.mjs (+ .test.ts)           # NEW: sitemap/robots/OG/JSON-LD oracle over a build dir
└── assert-csp.mjs                        # MODIFY: ld+json exemption, optional analytics host
docs/LAUNCH-AUDIT.md                      # NEW: walked PITFALLS checklist + results
.github/dependabot.yml                    # NEW
```

### Pattern 1: One validated build-time config, two consumers (VERIFIED)
**What:** `$env/static/public` is the idiomatic Kit API, but it throws at build time when a variable is unset (spike: `[MISSING_EXPORT] "PUBLIC_ANALYTICS_HOST" is not exported by "\0virtual:env/static/public"`). An empty string is accepted, but CI, `vite dev` and `pnpm --filter web build` would each have to remember to set it, and the CSP builder (Node) and the client would validate it separately. Instead, read the env once through a validated module, like `base-path.js` already does for `BASE_PATH`.
```js
// apps/web/src/lib/site-config.js  (plain JS: imported by svelte.config.js AND vite.config.ts)
const ORIGIN = /^https:\/\/[a-z0-9.-]+$/i;
const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/; // test builds only
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveSiteOrigin(env = process.env) {
	const o = env.SITE_ORIGIN ?? 'https://tranrealestate.github.io';
	if (!ORIGIN.test(o)) throw new Error(`SITE_ORIGIN must be an https origin with no path (got ${JSON.stringify(o)})`);
	return o;
}
/** Both set or both empty; anything else is a configuration error, never a silent half-config. */
export function resolveAnalytics(env = process.env) {
	const host = env.PUBLIC_ANALYTICS_HOST ?? '';
	const websiteId = env.PUBLIC_ANALYTICS_WEBSITE_ID ?? '';
	if (!host && !websiteId) return { host: '', websiteId: '' };
	if (!(ORIGIN.test(host) || LOOPBACK.test(host)) || !UUID.test(websiteId))
		throw new Error('PUBLIC_ANALYTICS_HOST must be an https origin and PUBLIC_ANALYTICS_WEBSITE_ID a UUID (set both or neither)');
	return { host, websiteId };
}
export function resolveWeb3formsKey(env = process.env) { /* '' or UUID, else throw */ }
export function resolveContactEmail(env = process.env) { /* '' or a plain address, else throw */ }
```
```ts
// apps/web/vite.config.ts  (add `define`; applies to client, SSR/prerender and the Vitest branch)
import { resolveBasePath } from './src/lib/base-path.js';
import { resolveSiteOrigin, resolveAnalytics, resolveWeb3formsKey, resolveContactEmail } from './src/lib/site-config.js';
const a = resolveAnalytics();
// …
define: {
	__SITE_URL__: JSON.stringify(resolveSiteOrigin() + resolveBasePath()),
	__ANALYTICS_HOST__: JSON.stringify(a.host),
	__ANALYTICS_WEBSITE_ID__: JSON.stringify(a.websiteId),
	__WEB3FORMS_KEY__: JSON.stringify(resolveWeb3formsKey()),
	__CONTACT_EMAIL__: JSON.stringify(resolveContactEmail())
},
```
```ts
// apps/web/src/lib/site.ts: the ONLY file that names the globals (declare them in src/app.d.ts;
// add them to eslint languageOptions.globals so no-undef stays quiet in .svelte files)
export const SITE_URL: string = __SITE_URL__; // e.g. https://tranrealestate.github.io  (+ /tran_real_estate on the sub build)
export const ANALYTICS = { host: __ANALYTICS_HOST__, websiteId: __ANALYTICS_WEBSITE_ID__ } as const;
export const WEB3FORMS_KEY: string = __WEB3FORMS_KEY__;
export const CONTACT_EMAIL: string = __CONTACT_EMAIL__;
```
Spike evidence: `__SITE_URL__` resolved correctly in a `.svelte` page and in a `+server.ts` endpoint under both `BASE_PATH=''` and `/tran_real_estate`.

### Pattern 2: Never build absolute URLs from `$app/paths` in pages (VERIFIED)
**What:** Kit defaults to `paths.relative: true`, so during prerender `base` is `../..` inside page components. The spike produced `https://tranrealestate.github.io../../tools/cap-rate/` for canonical, `og:url` and `og:image`. In `+server.ts` endpoints `base` is absolute, so the bug only appears in pages. Use `SITE_URL` from Pattern 1 for every absolute URL (canonical, `og:*`, `twitter:image`, JSON-LD `url`, sitemap `<loc>`, robots `Sitemap:`). Keep `resolve()`/relative links for in-page navigation. **Do not** flip `paths.relative` to `false`: it rewrites every asset URL and breaks Phase 1/2 contracts (e.g. the raw-HTML `href="../renter/"` assertion).

### Pattern 3: `kit.prerender.origin` = site origin, so Kit validates share-card URLs (VERIFIED)
**What:** Kit's crawler (`src/core/postbuild/crawl.js`) follows `<link href>` (canonical included) and `<meta content>` for `og:url`, `og:image`, `og:image:url`, `og:image:secure_url` and `twitter:image`. Absolute URLs that start with `prerender.origin` are stripped to root-relative and requested. With `handleHttpError: 'fail'` (already set), a broken OG link fails the build:
```
[404] GET /tran_real_estate/og/cap-rate.png
Error: 404 /tran_real_estate/og/cap-rate.png (linked from /tran_real_estate/tools/cap-rate/)
```
```js
// apps/web/svelte.config.js
prerender: { origin: resolveSiteOrigin(), handleHttpError: 'fail', handleMissingId: 'fail', handleUnseenRoutes: 'fail' },
```
Side effect: during prerender `page.url.origin` becomes the site origin. That is harmless, but code must still not use `page.url` for absolute URLs (after hydration it is the real origin, such as `127.0.0.1` in E2E).

### Pattern 4: `sitemap.xml` and `robots.txt` as prerendered endpoints, routes derived by glob (VERIFIED)
**What:** `+server.ts` routes with `prerender = true` are written as plain files (`build/sitemap.xml`, `build/robots.txt`). `trailingSlash: 'always'` does not turn them into directories. The default `prerender.entries: ['*']` already includes them, so no config change is needed and `handleUnseenRoutes` stays satisfied. Derive the page list from the filesystem so a new page can never be forgotten:
```ts
// apps/web/src/routes/sitemap.xml/+server.ts
import { SITE_URL } from '$lib/site';
export const prerender = true;
// Explicitly NOT indexable: app shells and query-configured pages. Classify every new page here or in the sitemap.
export const NOINDEX = new Set(['/settings/', '/print/', '/start/rentcast/', '/agent/inquire/' /* + any (print) or query-configured route */]);
const PATHS = Object.keys(import.meta.glob('/src/routes/**/+page.svelte'))
	.map((k) => k.replace('/src/routes', '').replace(/\/\([^)]+\)/g, '').replace(/\+page\.svelte$/, ''))
	.filter((p) => !p.includes('[') && !NOINDEX.has(p) && !p.startsWith('/print/'))
	.sort();
export function GET() {
	const urls = PATHS.map((p) => `  <url><loc>${SITE_URL}${p}</loc></url>`).join('\n');
	return new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
		{ headers: { 'content-type': 'application/xml' } }
	);
}
```
```ts
// apps/web/src/routes/robots.txt/+server.ts
import { SITE_URL } from '$lib/site';
export const prerender = true;
export const GET = () =>
	new Response(`User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`, { headers: { 'content-type': 'text/plain' } });
```
Spike output (sub build): `<loc>https://tranrealestate.github.io/tran_real_estate/tools/cap-rate/</loc>`. Pages in `NOINDEX` also get `<meta name="robots" content="noindex">` through `SeoHead`. Omit `<lastmod>`: a build timestamp on every URL is noise, and Google ignores unreliable lastmod values.

### Pattern 5: OG share card as a prerendered PNG endpoint (VERIFIED on Windows)
**What:** a server-only module renders a hand-authored 1200×630 SVG (brand tokens imported from `@tran/brand`) with resvg. Four tiny endpoints (one per tool, plus a default card for other pages) call it. Use individual files rather than a `[slug]` route so the project's no-dynamic-route rule stays intact. Kit's server build externalizes the native module automatically. The spike wrote `build/og/cap-rate.png` (14.7 KB) through the endpoint.
```ts
// apps/web/src/lib/seo/woff.server.ts: WOFF 1.0 (W3C, §5) -> SFNT. resvg/fontdb reads TTF/OTF only.
import { inflateSync } from 'node:zlib';
export function woffToSfnt(woff: Buffer): Buffer {
	if (woff.toString('ascii', 0, 4) !== 'wOFF') throw new Error('not a WOFF 1.0 file (WOFF2 is unsupported)');
	const flavor = woff.readUInt32BE(4), n = woff.readUInt16BE(12);
	const tables = Array.from({ length: n }, (_, i) => {
		const o = 44 + i * 20;
		const tag = woff.readUInt32BE(o), off = woff.readUInt32BE(o + 4), comp = woff.readUInt32BE(o + 8);
		const orig = woff.readUInt32BE(o + 12), checksum = woff.readUInt32BE(o + 16);
		const raw = woff.subarray(off, off + comp);
		return { tag, checksum, data: comp < orig ? inflateSync(raw) : raw };
	});
	let size = 12 + 16 * n;
	const offsets = tables.map((t) => { const at = size; size += (t.data.length + 3) & ~3; return at; });
	const out = Buffer.alloc(size);
	const es = Math.floor(Math.log2(n)), sr = 16 * 2 ** es;
	out.writeUInt32BE(flavor, 0); out.writeUInt16BE(n, 4); out.writeUInt16BE(sr, 6); out.writeUInt16BE(es, 8); out.writeUInt16BE(n * 16 - sr, 10);
	tables.forEach((t, i) => {
		const o = 12 + 16 * i;
		out.writeUInt32BE(t.tag, o); out.writeUInt32BE(t.checksum, o + 4); out.writeUInt32BE(offsets[i], o + 8); out.writeUInt32BE(t.data.length, o + 12);
		t.data.copy(out, offsets[i]);
	});
	return out;
}
```
```ts
// apps/web/src/lib/seo/og-card.server.ts (shape)
import { Resvg } from '@resvg/resvg-js';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os'; import { join } from 'node:path';
import { tokens } from '@tran/brand';
import { woffToSfnt } from './woff.server';
const req = createRequire(import.meta.url);
const font = (spec: string) => woffToSfnt(readFileSync(req.resolve(spec)));
// resvg-js 2.6.2 takes font FILE PATHS (fontFiles), not buffers: write the converted TTFs once to a temp dir.
const dir = mkdtempSync(join(tmpdir(), 'tran-og-'));
const FILES = [
	['fraunces-600.ttf', '@fontsource/fraunces/files/fraunces-latin-600-normal.woff'],
	['inter-400.ttf', '@fontsource/inter/files/inter-latin-400-normal.woff'],
	['inter-600.ttf', '@fontsource/inter/files/inter-latin-600-normal.woff']
].map(([name, spec]) => { const p = join(dir, name); writeFileSync(p, font(spec)); return p; });
const esc = (s: string) => s.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);
export function renderOgCard({ title, subtitle }: { title: string; subtitle: string }) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${tokens.color.background}"/>
<text x="80" y="300" font-family="Fraunces SemiBold" font-size="72" fill="${tokens.color.foreground}">${esc(title)}</text>
<text x="80" y="380" font-family="Inter" font-size="32" fill="${tokens.color['muted-foreground']}">${esc(subtitle)}</text>
<rect x="80" y="520" width="200" height="8" fill="${tokens.color.primary}"/></svg>`;
	return new Resvg(svg, { font: { loadSystemFonts: false, fontFiles: FILES, defaultFontFamily: 'Inter' }, fitTo: { mode: 'original' } }).render();
}
```
```ts
// apps/web/src/routes/og/cap-rate.png/+server.ts
import { renderOgCard } from '$lib/seo/og-card.server';
import { TOOLS } from '$lib/content/tools';
export const prerender = true;
export const GET = () => new Response(renderOgCard(TOOLS['cap-rate'].og).asPng(), { headers: { 'content-type': 'image/png' } });
```
Facts from the spike: the static Fraunces 600 subset's family name (nameID 1) is **"Fraunces SemiBold"** and it has no nameID 16, so `font-family="Fraunces"` silently falls back to Inter. Inter's family name is "Inter". Always set `loadSystemFonts: false` so Windows and CI render identically. Keep titles short and hand-break lines: SVG `<text>` does not wrap.

### Pattern 6: JSON-LD under the hash-mode meta CSP (VERIFIED in Chromium)
**What:** HTML treats a `<script>` whose type is not a JavaScript MIME type as a **data block**. "Prepare the script element" returns before any CSP check, so the block needs no hash. The spike page (CSP `script-src 'self' 'sha256-…'`) recorded **0** `securitypolicyviolation` events, still had exactly **1** ld+json element after hydration (no duplication), and its JSON parsed. Two repo-specific traps:
1. `{@html}` is banned in marketing routes by the Phase 1 ESLint config (and its rule test asserts it fires there). Use `<svelte:element this={'script'} type="application/ld+json">{json}</svelte:element>`. Svelte 5 warns if `this` is a string literal (`svelte_element_invalid_this`), so pass an expression.
2. Svelte **entity-escapes text** inside it (`<` → `&lt;`, `&` → `&amp;`). Script raw text is never entity-decoded, so the JSON would be corrupted. Escape to JSON `\u` sequences first. That also prevents a `</script>` breakout.
```ts
// apps/web/src/lib/seo/jsonld.ts
export const serializeJsonLd = (data: object) =>
	JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
export const webApplication = (t: { name: string; description: string; url: string }) => ({
	'@context': 'https://schema.org', '@type': 'WebApplication', name: t.name, description: t.description, url: t.url,
	applicationCategory: 'FinanceApplication', operatingSystem: 'Any', isAccessibleForFree: true,
	offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
	// NEVER aggregateRating / review: fabricated ratings are banned (BRND copy rules + banned-terms "rated 5").
});
export const faqPage = (faq: { q: string; a: string }[]) => ({
	'@context': 'https://schema.org', '@type': 'FAQPage',
	mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }))
});
```
```svelte
<!-- inside SeoHead.svelte <svelte:head> -->
{#each jsonLd as block}<svelte:element this={'script'} type="application/ld+json">{serializeJsonLd(block)}</svelte:element>{/each}
```
**Oracle change (mandatory):** `scripts/assert-csp.mjs` hashes every inline `<script>` without `src` and failed the spike build (`inline script not covered by script-src hash`). Exempt only `type="application/ld+json"` blocks, require them to `JSON.parse`, and add mutation tests: an inline `type="module"` or `type="text/javascript"` script must still fail, as must an ld+json block containing raw `</script` or invalid JSON.

**Expectation management:** Google retired FAQ rich results (stopped showing 2026-05-07; Search Console API support removed 2026-08). `SoftwareApplication`/`WebApplication` rich results **require** `aggregateRating` or `review`, which this project must never fabricate. The JSON-LD is valid schema.org for crawlers and LLM-based search, but **no Google rich result will appear**. The visible FAQ section is what earns the traffic. Keep FAQ JSON-LD and visible FAQ generated from the same `content/tools.ts` object, and assert equality in a test.

### Pattern 7: JS budget measured from built HTML (VERIFIED baseline)
**What:** the bytes a browser loads up front for a route are the `<link rel="modulepreload">` set, plus `import("…")` targets inside the inline boot script, plus `<script src>` (`frame-guard.js`). Dynamic `import()` from components is excluded, which is exactly how heavy portal libraries stay off marketing pages. Gzip each file at level 9, sum, and compare to a per-route budget.
- Baseline measured in the spike: Kit 2.70.3 + Svelte 5.57.0 runtime plus an empty page = **32.7-32.8 KB gz** (8-9 files). The 60 KB tool-page budget therefore leaves **~27 KB gz** for the Phase 2 layout/header/footer, Lucide icons, the calculator and the beacon. That is comfortable but not loose: a stray import of Dexie, zod, LayerChart or a `features/<portal>` module will blow it, which is the point.
- Apply the budget to every `(marketing)` route (landing, audience, legal, tools, feedback), not only tools. The landing is the top of the funnel.
- Also report CSS gz per route (informational at first, then a budget once Phase 2's CSS is known).
- Run it on `build/` in `pnpm verify` and in the CI root leg after `assert-csp`.

### Pattern 8: First-run onboarding: inline, modal-free, CLS-safe
**What (recommended implementation of the discretion item):** inline steps, not popovers. Popovers anchored to page elements need positioning logic, fail at 375px, and tend toward focus-management bugs.
- **Placement:** a `<section id="get-started" aria-labelledby="get-started-title">` inside the landing's existing `#portals` region, directly after the three `PortalCard`s.
- **Step 0 (choose portal):** a native radio group (`<fieldset><legend>Which portal fits you?</legend>` with 3 radios). The portal cards stay plain links, so no-JS still works.
- **Steps 1-3:** one panel with an `<h2 id tabindex="-1">` reading "Step 2 of 3: Where your keys go", body copy, and Back / Next / Skip tour buttons (native `<button>`). An `<ol>` progress list marks the current item with `aria-current="step"`.
- **Focus:** on Next/Back, programmatically focus the new step heading. This is the announcement; no `aria-live` is needed. **Never auto-focus on page load** (WCAG 3.2.1/2.4.3).
- **No modal semantics:** no `role="dialog"`, no `inert`, no focus trap. Skip and Esc are not required because nothing traps. "Skip tour" sets `dismissed`.
- **Exits** (the last step shows both):
  - **"Try sample data"** is a link to `resolve('/{portal}/') + '?sample=1'`. Phase 4: no key ⇒ sample mode automatically; `?sample=1` lets the portal force sample mode if a key exists. **The marketing route never imports storage.**
  - **"Connect a free RentCast key"** is a link to `resolve('/start/rentcast/')`. That `(app)` route composes the Phase 3 RentCast `ProviderKeyCard` (paste), the Phase 4 Test key + `KeyTestResult`, and the Phase 4 `CapEditor` (default 40) under an ordered 3-step list. Step 1 is an external link to RentCast's API dashboard with copy telling the user to create a **dedicated, endpoint-restricted** key.
- **State:** `{ status: 'new' | 'dismissed' | 'completed', portal?: Portal, updatedAt }` in a Phase 3 pref (see Pitfall 9 for the import boundary). It is read in `onMount` only (prerender has no `localStorage`). Settings gets "Restart the tour" (resets state, links to `/#get-started`) and "RentCast setup guide".
- **CLS:** SSR renders the first-visit state (most landing visitors are new). For returning users, after hydration the panel collapses to a one-line "Restart the tour" link. Shifts caused by user input are excluded from CLS, so step changes are free. Measure CLS in E2E with the flag unset and set, at 375 and 1280 (budget < 0.1). If it fails, fall back to a same-origin head script (the `frame-guard.js` pattern, never inline) that sets `data-onboarded` on `<html>` before paint, with CSS hiding the panel.
- **Reduced motion:** no step animation is required. If one is added, honor `prefers-reduced-motion`.

### Pattern 9: Waitlist and feedback on the owner's Web3Forms key
**What:** reuse Phase 8's single adapter `lib/leads/web3forms-sink.ts` (already fetch-allowlisted) with the owner key from `WEB3FORMS_KEY` (Pattern 1).
- `WaitlistForm portal={…}` sits in each audience page's closing band (and optionally on the portal placeholders). Fields: email (required) and an optional "what would you use it for" textarea.
- `FeedbackForm` lives on `(marketing)/feedback/`, linked from the footer and Settings. Fields: message (required), optional email, optional portal select.
- Body: `subject: "[Tran waitlist] renter"` / `"[Tran feedback] investor"`, `from_name: "Tran Real Estate Tools"`, plus a `portal` field. Honeypot `botcheck` in a `hidden` wrapper (`tabindex="-1"`, `autocomplete="off"`) and a minimum 3 s time-to-submit. A tripped honeypot or too-fast submit is silently "succeeded" client-side and never sent.
- **Key absent:** render the form disabled as "Coming soon". If `CONTACT_EMAIL` is set, show a `mailto:` fallback link. If neither exists, show only "The waitlist opens soon" (no broken mailto).
- **Privacy:** update `/legal/privacy/` before launch. It must say the waitlist/feedback forms send what you type to Web3Forms (a third party) to email the owner; that analytics, when enabled, counts pages without personal data; and what the analytics server can still see (Pitfall 8). The Phase 2 privacy copy promises "this page will be updated first".

### Pattern 10: Umami beacon: payload, consent, transport (VERIFIED against Umami v3.4.0 source + Chromium)
**Umami collection API facts** (`src/app/api/send/route.ts`, release v3.4.0, 2026-09-17):
- `POST {host}/api/send`, body `{ type: 'event', payload }`. **Exactly one** of `website` / `link` / `pixel` (UUID) is required, so the beacon needs `PUBLIC_ANALYTICS_WEBSITE_ID` in addition to `PUBLIC_ANALYTICS_HOST`. Umami Cloud: `https://cloud.umami.is/api/send` (take the exact host from the dashboard's tracking code).
- A pageview is an event with no `name`. A custom event has `name` (+ optional `data` object, + optional `tag`).
- The body is read with `request.clone().json()`, which ignores Content-Type, so a `text/plain` body works.
- The server derives the IP from request headers and the UA from the `User-Agent` header. Sessions are `uuid(websiteId, ip, ua, salt)` with the salt rotated monthly by default (`SALT_ROTATION`). Country/region/city come from IP geolocation. `isbot(ua)` drops bots (HeadlessChrome included). **The payload can override `ip`, `userAgent`, `id` (distinct ID) and `timestamp`: the beacon must never send them.**
- CORS (`next.config.ts`): `/api/*` answers `Access-Control-Allow-Origin: *`, `Allow-Headers: *`.

**Transport (verified):** a string body, no custom headers, `mode: 'no-cors'`. Chromium sent `POST` with `content-type: text/plain;charset=UTF-8`, **no OPTIONS preflight, no Cookie, no Referer**, to a collector that returned **no CORS headers**. `mode: 'cors'` also delivered, but rejected the promise and logged a console CORS error. `no-cors` resolves `opaque` silently. Use `no-cors`: delivery then does not depend on the collector's CORS configuration at all.
```ts
// apps/web/src/lib/analytics/beacon.ts  (folder added to the eslint fetch allowlist)
export function send(body: BeaconBody, cfg: { host: string }, fetchImpl: typeof fetch = fetch): void {
	if (!cfg.host) return; // no-op build
	void fetchImpl(`${cfg.host}/api/send`, {
		method: 'POST', body: JSON.stringify(body), mode: 'no-cors', credentials: 'omit',
		keepalive: true, referrerPolicy: 'no-referrer', cache: 'no-store'
	}).catch(() => {}); // fire-and-forget; analytics must never surface errors
}
```
```ts
// apps/web/src/lib/analytics/consent.ts
export function trackingAllowed(nav: Navigator & { globalPrivacyControl?: boolean }, win: { doNotTrack?: string | null }) {
	if (nav.globalPrivacyControl === true) return false;                    // GPC: Firefox, Brave, DuckDuckGo
	const dnt = nav.doNotTrack ?? win.doNotTrack ?? null;                   // legacy DNT; Firefox removed the UI in 2025
	return !(dnt === '1' || dnt === 'yes');
}
```
```ts
// apps/web/src/lib/analytics/payload.ts: pure; the ONLY place payloads are built
export const SCREEN_CLASSES = ['sm', 'md', 'lg'] as const; // < 640, < 1024, else (Phase 2 breakpoints)
export const EVENT_NAMES = ['onboarding-start', 'onboarding-complete', 'sample-data', 'key-guide', 'waitlist-join', 'feedback-sent', 'tool-calculate'] as const;
export function buildPageview(loc: { pathname: string; hostname: string }, referrer: string, width: number, websiteId: string) {
	return { type: 'event', payload: {
		website: websiteId,
		hostname: loc.hostname,               // the site's own host (not personal); lets Umami suppress self-referrals
		url: loc.pathname,                    // PATH ONLY: query strings carry ?id= record ids and the agent inquiry key
		referrer: referrerOrigin(referrer, loc.hostname), // 'https://host/' or omitted
		screen: screenClass(width),
		data: { portal: portalOf(loc.pathname) } // 'renter' | 'investor' | 'agent' | 'none'
	} };
}
/** Full origin URL, never a bare host (see Pitfall 7); omitted when same-site or unparseable. */
export function referrerOrigin(ref: string, selfHost: string): string | undefined {
	try { const u = new URL(ref); return u.hostname === selfHost || !/^https?:$/.test(u.protocol) ? undefined : `${u.protocol}//${u.hostname}/`; }
	catch { return undefined; }
}
```
Wire it in the root `+layout.svelte` with `afterNavigate(({ to }) => …)`. It runs on mount and after every client navigation, so it covers both the prerendered first load and SPA navigation. Gate it on `ANALYTICS.host && trackingAllowed(...)`. Custom events take a fixed name plus `data: { portal }` or `{ tool }` drawn from enums only. The beacon adds well under 1 KB gz to every page.

### Pattern 11: CSP host only when configured (builder + oracle)
**What:** move the directive object into `apps/web/src/lib/csp-policy.js` (`buildCsp({ analyticsHost })`) so it is unit-testable with and without a host. `svelte.config.js` calls it with `resolveAnalytics().host`. `scripts/assert-csp.mjs` keeps its **literal** allowlist (the Phase 1 two-file-diff discipline) and appends `process.env.PUBLIC_ANALYTICS_HOST` (validated by the same rules) when set, so the oracle and the build derive the extra host from the same env. Add oracle tests: no env ⇒ exact Phase 1 set; env set ⇒ exact set plus that one origin; a host present in the build but not in env (or vice versa) ⇒ fail. `form-action` is untouched (forms submit with `fetch`; the `<form action>` fallback already targets Web3Forms).

### Anti-Patterns to Avoid
- **`${base}` or `page.url.origin` in absolute URLs.** It is relative during prerender and the real host after hydration. Use `SITE_URL`.
- **`import { PUBLIC_X } from '$env/static/public'` for optional settings.** The build fails when they are unset.
- **`{@html}` for JSON-LD.** It is lint-banned in marketing routes. Use `<svelte:element this={'script'}>` plus `\u` escaping.
- **`navigator.sendBeacon(url, new Blob([json], {type:'application/json'}))`.** A non-safelisted type needs a preflight, which sendBeacon cannot do, so it fails. The CONTEXT locks `fetch` anyway.
- **Sending `title`, `language`, `id`, `ip`, `userAgent`, query strings or full referrer URLs.** Each is either personal data or a way to leak record IDs or keys.
- **Writing generated PNGs into `static/`.** Generated files in a source dir need gitignore rules and a prebuild chain. The endpoint approach avoids both.
- **Relying on `pnpm audit --prod`.** It audits nothing here (Pitfall 11).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG → PNG rasterization | A canvas polyfill, headless Chrome screenshots, `sharp` + system fonts | `@resvg/resvg-js` with `loadSystemFonts: false` | Deterministic, OS-independent, no browser in the build |
| Route list for sitemap | A hand-maintained array | `import.meta.glob('/src/routes/**/+page.svelte')` + explicit `NOINDEX` set + drift test | A new page cannot silently miss the sitemap |
| Link validation for OG/canonical | A custom HTML crawler | `kit.prerender.origin` + `handleHttpError: 'fail'` | Kit already crawls `og:image`/`og:url`/canonical |
| Lead/waitlist delivery | A second fetch adapter | Phase 8 `lib/leads/web3forms-sink.ts` | One adapter, one error mapping, one mock in E2E |
| Analytics backend | A custom collector, Cloudflare Worker, or GitHub-issue counter | Umami (Cloud free tier or self-host) | Owner decision; $0; aggregate dashboard included |
| Dependency vulnerability gate | Custom advisory lookups | `pnpm audit` + `audit.ignore` in `pnpm-workspace.yaml` + Dependabot | pnpm 11.16+ native exception list, verified working |
| Accessibility checks | Bespoke DOM assertions | `@axe-core/playwright` (existing harness) | Already the FND-04 gate |

The one deliberate hand-roll is the 25-line WOFF→SFNT converter. WOFF 1.0 is a frozen W3C format (header + zlib-compressed tables). The alternatives are a second font toolchain dependency or committing duplicate font binaries. Protect it with a unit test (SFNT signature, table count, `name` table readable) and the "text actually rendered" pixel test.

## Common Pitfalls

### Pitfall 1: Relative `base` produces broken absolute URLs (VERIFIED)
**What goes wrong:** canonical/`og:url`/`og:image` become `https://tranrealestate.github.io../../tools/x/`.
**Why:** `paths.relative: true` (Kit default) makes `base` relative in prerendered page components.
**How to avoid:** use `SITE_URL` (Pattern 1). The SEO oracle asserts every absolute URL matches `^https://[^/]+(/tran_real_estate)?/`.
**Warning signs:** `..` inside any `content="https://…"` in built HTML.

### Pitfall 2: Unset `PUBLIC_*` breaks the build (VERIFIED)
**What goes wrong:** `MISSING_EXPORT … is not exported by "\0virtual:env/static/public"` when the owner has no Umami instance or Web3Forms key.
**How to avoid:** Pattern 1. Unit-test `resolveAnalytics({})` returns the no-op config.

### Pitfall 3: Missing OG image ships a broken share card
**What goes wrong:** the link preview shows nothing, and nobody notices until a share.
**How to avoid:** `prerender.origin` = site origin (Pattern 3). Absolute og URLs are then crawled and a 404 fails the build (verified). Additionally assert PNG IHDR = 1200×630 in the SEO oracle.

### Pitfall 4: resvg silently renders no text (VERIFIED)
**What goes wrong:** WOFF/WOFF2 fonts, or the wrong family name, give a card with background only. Exit code 0, no warning. Fraunces' static subset is named "Fraunces SemiBold", not "Fraunces".
**How to avoid:** WOFF→SFNT conversion, `loadSystemFonts: false`, and a unit test that renders a title and asserts dark-pixel count > 1,000 via `render().pixels`. Spike: 4,998 dark pixels with the font, 0 without it, which doubles as the non-vacuity control.

### Pitfall 5: The repo's CSP oracle rejects JSON-LD (VERIFIED)
**What goes wrong:** `assert-csp.mjs` fails with "inline script not covered by script-src hash", and the tempting fix is to hash it or weaken the check.
**How to avoid:** exempt only `type="application/ld+json"` and require valid JSON. Mutation-test both directions (Pattern 6).

### Pitfall 6: Svelte escapes JSON-LD text (VERIFIED)
**What goes wrong:** `&` in "Cash-on-cash & DSCR" becomes `&amp;` inside the script and is never decoded, so the JSON is wrong.
**How to avoid:** `serializeJsonLd` `\u`-escapes `<`, `>`, `&`, U+2028 and U+2029. The E2E parses `textContent` and compares it to the source object.

### Pitfall 7: A bare-host referrer is discarded by Umami (VERIFIED from source)
**What goes wrong:** sending `referrer: "google.com"` (literal "host only") makes Umami resolve it as the path `/google.com` on the event's own domain, which equals `eventDomain`, so it is dropped as a self-referral. Referrer stats are empty.
**How to avoid:** send `https://google.com/` (origin URL, no path or query). The data is still host-only.

### Pitfall 8: Overclaiming privacy
**What goes wrong:** copy says "no IP" or "no personal data collected", but Umami (like any web server) receives the IP and User-Agent on the request, derives country/region/city, and keeps a monthly-salted session hash.
**How to avoid:** precise copy: "Tran's usage counter sends only the page path, which portal you're in, the referring site's domain, and a rough screen size. It sets no cookies and sends no identifiers. Like any web server, the analytics server sees your IP address to count visits by country; Umami does not store it." Respect GPC/DNT. Owner setting: self-host or Cloud. Note that ad-blocker lists (EasyPrivacy) commonly block Umami Cloud hosts, so counts are a lower bound.

### Pitfall 9: The onboarding flag crosses the marketing import boundary
**What goes wrong:** the landing (a `(marketing)` route) must read the onboarding pref, but `eslint.config.js` forbids `(marketing)` from importing `$lib/storage/**`. If Phase 3 puts prefs there, the tour cannot compile. Separately, `features/<portal>` components can transitively import `$lib/data` and blow the 60 KB budget.
**How to avoid:** onboarding state goes in `$lib/features/shared/onboarding/onboarding-state.svelte.ts`, a Dexie-free, localStorage-only module (runed `PersistedState` or plain `localStorage` with try/catch, read in `onMount`) using the **same key namespace** as Phase 3 prefs. If Phase 3 ships a Dexie-free prefs module outside `lib/storage`, import that instead. Add an ESLint rule (with a rule test) that `lib/components/tools/**` and `lib/features/shared/onboarding/**` may not import `storage`, `ai`, `data` or `features/<portal>`. The JS budget is the backstop.

### Pitfall 10: Web3Forms anti-spam mismatch
**What goes wrong:** the owner enables hCaptcha in the Web3Forms dashboard (recommended there), every submission 400s because the CSP forbids the hCaptcha script, and the honeypot is documented as "deprecated".
**How to avoid:** the setup note in `docs/DEPLOY-CHECKLIST.md` says to leave captcha off. Map a captcha 400 to "This form isn't set up correctly yet" (Phase 8 sink already maps `captcha-required`). Web3Forms' own server-side filtering is the real protection. Use the low-entropy test UUID `00000000-0000-4000-8000-000000000000` in tests so gitleaks' generic-key rule stays quiet.

### Pitfall 11: `pnpm audit --prod` is vacuous (VERIFIED)
**What goes wrong:** `pnpm audit --prod` prints "No known vulnerabilities found" because every package the static site bundles is a devDependency (`metadata.dependencies: 0`). Full `pnpm audit` currently finds **7** (3 high, 2 moderate, 2 low).
**How to avoid:** gate on full `pnpm audit` (`--audit-level low`). Fix with `pnpm audit --fix=update` (lockfile only: devalue 5.9.2 → 5.9.4, which clears 6). Record the remaining one, `GHSA-pxg6-pf52-xh8x` (`cookie` <0.7.0 pinned `^0.6.0` by `@sveltejs/kit` 2.70.3; Kit's server cookie API is never shipped by adapter-static), in `pnpm-workspace.yaml`:
```yaml
audit:
  ignore:
    - GHSA-pxg6-pf52-xh8x # cookie <0.7 via @sveltejs/kit 2.x server runtime; not in the static bundle. Re-check on Kit upgrade.
```
Verified: with this, `pnpm audit` reports "1 ignored" and exits 0 after the devalue update. Legacy keys (`auditConfig.ignoreGhsas`, `auditConfig.ignoreCves`) are not used on pnpm 11.27. Also document every exception in `docs/LAUNCH-AUDIT.md` with its reasoning.

### Pitfall 12: Dependabot silently closing alerts on pnpm 11 lockfiles
**What goes wrong:** pnpm 11 writes a two-document `pnpm-lock.yaml` when it records package-manager or config dependencies. Dependabot parsed only the first document and closed every alert as fixed (dependabot-core #14794 / #14919; the pnpm v12 variant #15904 is still open). The repo's lockfile is currently **single-document** (0 `---` separators).
**How to avoid:** add `.github/dependabot.yml` (`npm` at `/` + `github-actions` at `/`, weekly, grouped). Treat `pnpm audit` in CI as the authoritative gate, not Dependabot alerts. Add a unit test asserting the lockfile has no `---` document separator so a format change is noticed. Dependabot alerts and security updates must also be enabled in repo settings once the remote exists (owner checklist item).

### Pitfall 13: Analytics config leaking into E2E or the "no third-party requests" assertion
**What goes wrong:** when the owner sets `vars.PUBLIC_ANALYTICS_HOST` for deploys, the same root build runs E2E. Real beacons then hit Umami from CI, and the third-party assertion fails.
**How to avoid:** the CI build step reads `PUBLIC_ANALYTICS_HOST` / `PUBLIC_ANALYTICS_WEBSITE_ID` / `PUBLIC_WEB3FORMS_KEY` from `vars.*` (deploy what you test). Specs read the same env. When a host is configured, a `page.route('${host}/**', r => r.fulfill({ status: 200 }))` fixture swallows beacons, and the third-party assertion allows exactly that origin with resourceType `fetch`. Update `workflow-gate.test.ts` for the new `vars.` references. The SHA-pin count is unchanged because these are `env:` lines, not `uses:`.

### Pitfall 14: serve-pages and robots on sub-paths
**What goes wrong:** `scripts/serve-pages.mjs` has no MIME types for `.png`, `.xml` or `.txt` (they would be served as `application/octet-stream`), and `robots.txt` under `/tran_real_estate/` is ignored by crawlers (only host-root robots counts).
**How to avoid:** add `.png: image/png`, `.xml: application/xml`, `.txt: text/plain; charset=utf-8` to `types`. Accept that the sub build's robots.txt is test-only. Production is the root org site.

## Code Examples

### Strict payload schema test (shape)
```ts
// apps/web/src/lib/analytics/payload.test.ts
import { describe, expect, test } from 'vitest';
import { buildPageview, referrerOrigin } from './payload';
const ALLOWED = ['website', 'hostname', 'url', 'referrer', 'screen', 'data', 'name'];
const FORBIDDEN = ['ip', 'userAgent', 'id', 'language', 'title', 'timestamp', 'tag'];
const loc = (p: string) => ({ pathname: p, hostname: 'tranrealestate.github.io' });
test('pageview payload carries only whitelisted keys', () => {
	const { payload } = buildPageview(loc('/investor/deals/'), 'https://www.google.com/search?q=x', 390, '00000000-0000-4000-8000-000000000000');
	expect(Object.keys(payload).every((k) => ALLOWED.includes(k))).toBe(true);
	for (const k of FORBIDDEN) expect(payload).not.toHaveProperty(k);
	expect(payload).toMatchObject({ url: '/investor/deals/', referrer: 'https://www.google.com/', screen: 'sm', data: { portal: 'investor' } });
});
test.each(['/agent/inquire/?k=00000000-0000-4000-8000-000000000000&n=A', '/investor/analyze/?id=abc#x'])('url never carries query or hash: %s', (href) => {
	const u = new URL(href, 'https://tranrealestate.github.io');
	expect(buildPageview(loc(u.pathname), '', 1280, 'x').payload.url).not.toMatch(/[?#]/);
});
test('bare host referrer is never produced (Umami would drop it as self-referral)', () => {
	expect(referrerOrigin('https://news.ycombinator.com/item?id=1', 'tranrealestate.github.io')).toBe('https://news.ycombinator.com/');
	expect(referrerOrigin('https://tranrealestate.github.io/renter/', 'tranrealestate.github.io')).toBeUndefined();
	expect(referrerOrigin('android-app://x', 'h')).toBeUndefined();
});
```

### Beacon + consent unit test with injected fetch (respects the no-network harness)
```ts
test('no host => no fetch; GPC => no fetch; otherwise one no-cors text/plain POST', () => {
	const calls: [string, RequestInit][] = [];
	const fake = ((u: string, i: RequestInit) => (calls.push([u, i]), Promise.resolve(new Response()))) as unknown as typeof fetch;
	send(body, { host: '' }, fake); expect(calls).toHaveLength(0);
	expect(trackingAllowed({ globalPrivacyControl: true } as never, {})).toBe(false);
	send(body, { host: 'https://stats.example.org' }, fake);
	expect(calls[0][0]).toBe('https://stats.example.org/api/send');
	expect(calls[0][1]).toMatchObject({ method: 'POST', mode: 'no-cors', credentials: 'omit', keepalive: true, referrerPolicy: 'no-referrer' });
	expect(calls[0][1].headers).toBeUndefined(); // any custom header would force a preflight
	expect(typeof calls[0][1].body).toBe('string');
});
```

### "No third-party requests on any route" (extends the Phase 2 same-origin spec)
```ts
// apps/web/tests/e2e/third-party.spec.ts
import { ROUTES } from './routes';
const ALLOWED_FETCH_HOSTS = new Set(process.env.PUBLIC_ANALYTICS_HOST ? [new URL(process.env.PUBLIC_ANALYTICS_HOST).origin] : []);
test('keyless: every request on every route is same-origin', async ({ page }) => {
	const offenders: string[] = [];
	page.on('request', (r) => {
		const o = new URL(r.url()).origin;
		if (o !== new URL(page.url() || r.url()).origin && !(r.resourceType() === 'fetch' && ALLOWED_FETCH_HOSTS.has(o))) offenders.push(`${r.resourceType()} ${r.url()}`);
	});
	for (const route of ROUTES) { await page.goto(route); await page.waitForLoadState('networkidle'); }
	expect(offenders).toEqual([]);
});
// Non-vacuity: with bypassCSP, inject new Image().src='http://127.0.0.1:4275/x.png' and assert the filter reports it (Phase 2 pattern).
```

### Budget oracle core (shape)
```js
// scripts/assert-budget.mjs
export function initialJs(dir, page) {
	const file = join(dir, page), html = readFileSync(file, 'utf8'), refs = new Set();
	for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]*>/g)) refs.add(/href="([^"]+)"/.exec(m[0])[1]);
	for (const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) for (const i of m[1].matchAll(/import\(\s*"([^"]+\.js)"\s*\)/g)) refs.add(i[1]);
	for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) refs.add(m[1]);
	return [...refs].reduce((sum, r) => sum + gzipSync(readFileSync(resolve(dirname(file), r)), { level: 9 }).length, 0);
}
// BUDGETS: { 'tools/**/index.html': 60 * 1024, '(marketing pages)': 60 * 1024 }; exit 1 listing route, actual, budget.
// Non-vacuity test: a temp build dir whose page modulepreloads a 200 KB random (incompressible) chunk must fail.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FAQ rich results in Google | Retired (stopped 2026-05-07; Search Console API support removed 2026-08) | 2026 | Keep FAQPage only as valid schema; value comes from visible FAQ content |
| DNT header / `navigator.doNotTrack` | GPC (`Sec-GPC`, `navigator.globalPrivacyControl`) | Firefox removed DNT 2025; DNT spec discontinued | Check GPC first, DNT as legacy |
| pnpm `auditConfig.ignoreGhsas` | `audit.ignore` in `pnpm-workspace.yaml` | pnpm 11.16 | Use the new key (verified on 11.27.0) |
| Umami tracker `<script>` | Direct `/api/send` from first-party code | n/a (Umami documents the API) | No third-party script; CSP connect-src only |
| SvelteKit 2 | SvelteKit 3.0.0 is now `latest` on npm | 2026 | Out of scope; stay on 2.70.3 (separate migration phase) |

**Deprecated/outdated:**
- Web3Forms honeypot: documented as "depreciated" by Web3Forms. Still used as a thin client filter. Captcha cannot be used (CSP).
- `pnpm audit --prod` as a gate for SvelteKit static sites: meaningless because the bundled code is all devDependencies.

## Open Questions

1. **Where does Phase 3 put prefs?**
   - What we know: CONTEXT says "flag in Phase 3 prefs". Phase 3 uses runed `PersistedState` for small prefs. `(marketing)` cannot import `$lib/storage/**`.
   - What's unclear: the module path and key namespace (Phase 3 is not built).
   - Recommendation: Wave 0 reads the Phase 3 SUMMARY. If prefs live under `lib/storage`, add the Dexie-free `features/shared/onboarding/onboarding-state.svelte.ts` with the same key prefix (Pitfall 9).

2. **Is the Phase 6 affordability component pure?**
   - What we know: CONTEXT says reuse it. Phase 6 places renter code in `features/renter`, which may import `data`/`storage`.
   - Recommendation: if it is not import-pure, extract the math to `packages/core` and the UI to `lib/components/tools/AffordabilityCalculator.svelte` (Phase 6 re-imports it). Lint rule + budget enforce this.

3. **Should a third "analytics" build/E2E project exist?**
   - What we know: payload/consent/transport are fully unit-testable with an injected fetch, and Chromium delivery was proven in this research spike. Only an end-to-end run proves CSP `connect-src` + `afterNavigate` wiring in the real bundle.
   - Recommendation: yes, a cheap one. Add a `build-analytics` target to `scripts/build-web.mjs` (`BASE_PATH=''`, `PUBLIC_ANALYTICS_HOST=http://127.0.0.1:4275`, test UUID) and a collector `POST /api/send` + `GET /__beacons` on the existing attacker listener in `serve-pages.mjs`. Add one Playwright project `analytics` (port 4276) that asserts: one pageview per navigation, body matches the strict schema, no Cookie/Referer, zero CSP violations, and GPC-stubbed (`addInitScript` defining `Navigator.prototype.globalPrivacyControl`) ⇒ zero beacons. Run it on the CI root leg only. If time-boxed, this is the first item to cut; the unit tests remain.

4. **Umami Cloud vs self-host for the owner (HUMAN-UAT)**
   - What we know: Cloud Hobby is reported as free, ~100K events/month, ~3 sites, ~6-month retention (MEDIUM, third-party summaries; the official pricing page did not render for fetch). Self-host needs a server, which conflicts with the $0 constraint unless a free tier is used.
   - Recommendation: document Cloud as the default in `docs/DEPLOY-CHECKLIST.md`: create the site, copy the host + website ID into repo variables, deploy, load two pages from the live origin, and confirm both pageviews in the dashboard. This replaces the "CORS check" with a delivery check.

5. **Owner contact email for the mailto fallback**
   - What we know: none exists (the privacy page says "Contact details will be posted here before public launch").
   - Recommendation: optional `PUBLIC_CONTACT_EMAIL`. When absent, show "opens soon" text only. Record it as an owner action.

6. **"What Tran never does" page (deferred, "if time allows")**
   - Recommendation: plan it as the last, independently cuttable task. It is a `LegalPage` with copy from the trust strip and PITFALLS. Add it to the sitemap automatically via the glob.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.11 (projects `web`, `core`, `scripts`, `brand`), Playwright 1.63.0 + @axe-core/playwright 4.13.0 (projects `root`, `sub`, + new `analytics`), Node oracles `scripts/assert-csp.mjs`, new `scripts/assert-seo.mjs`, new `scripts/assert-budget.mjs` |
| Config files | `vitest.config.ts`, `apps/web/vite.config.ts` (`define`), `apps/web/playwright.config.ts` (+ `analytics` project, port 4276), `scripts/serve-pages.mjs` (MIME types, collector, analytics listener) |
| Quick run command | `corepack pnpm lint && corepack pnpm test:unit && corepack pnpm banned` (~30-40 s) |
| Full suite command | `corepack pnpm verify` (extended with `pnpm seo:assert`, `pnpm budget:assert`, `pnpm audit:deps`), plus `corepack pnpm lint:workflows` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | Failure mode it catches | File Exists? |
|--------|----------|-----------|-------------------|-------------------------|-------------|
| GTM-01 | Onboarding: radio portal choice → 3 steps → focus moves to each step heading → both exits link correctly (`/{portal}/?sample=1`, `/start/rentcast/`), Skip persists, reload shows collapsed "Restart the tour", Settings restart works | E2E | `pnpm --filter web exec playwright test onboarding` | Focus lost, trap introduced, exits wrong, flag not persisted | ❌ Wave 0 |
| GTM-01 | Onboarding a11y: axe on landing with tour open at each step, 375 + 1280; no `role=dialog`, no `inert` | E2E | `playwright test onboarding -g axe` | Modal semantics or contrast regressions | ❌ Wave 0 |
| GTM-01 | CLS < 0.1 on landing (flag unset and set) at 375/1280 | E2E (PerformanceObserver `layout-shift`, `hadRecentInput` excluded) | `playwright test perf -g cls` | Returning-visitor collapse shifts content | ❌ Wave 0 |
| GTM-01 | Key guide: 3 ordered steps; Test key (mocked RentCast 404 ⇒ "valid") and cap editor default 40 render; RentCast link is external, same tab | E2E with `page.route` mock | `playwright test start-rentcast` | Guide missing a step or calling RentCast unmocked | ❌ Wave 0 |
| GTM-01 | Onboarding state module: SSR-safe (no `localStorage` at import), corrupt value ⇒ `new` | unit | `vitest run --project web onboarding-state` | Prerender crash, stuck state | ❌ Wave 0 |
| GTM-02 | Waitlist/feedback: key set (test UUID build) ⇒ POST body has `access_key`, `subject` tagged by portal, `portal`; honeypot tripped or < 3 s ⇒ zero requests; success/error copy announced | E2E (`page.route('https://api.web3forms.com/submit')`) | `playwright test waitlist` | Spam path reaching Web3Forms, wrong portal tag | ❌ Wave 0 |
| GTM-02 | Key absent ⇒ disabled "Coming soon"; mailto only when `CONTACT_EMAIL` set | unit (component) + E2E on default build | `vitest run --project web waitlist` | Broken mailto, enabled form with no key | ❌ Wave 0 |
| GTM-02 | site-config validation: '' or UUID only; both-or-neither analytics; https-or-loopback host | unit | `vitest run --project web site-config` | Half-config silently shipping | ❌ Wave 0 |
| GTM-03 | Each tool page: correct math vs `core.finance` reference cases, zero non-self requests while calculating | unit + E2E | `vitest run --project core finance`; `playwright test tools` | Divergent formulas, accidental API call | ❌ Wave 0 (core tests from Phase 7) |
| GTM-03 | SEO oracle over `build/` and `build-sub/`: sitemap well-formed, `<loc>` set == glob pages − NOINDEX, all absolute under `SITE_URL`, no `..`; robots has `Sitemap:`; every tool page has unique title/description, canonical, `og:title/description/image/url/type`, `twitter:card=summary_large_image`; OG PNG exists and IHDR = 1200×630; ld+json blocks `JSON.parse`, contain `WebApplication` + `FAQPage`, no `aggregateRating`/`review`, FAQ questions == visible FAQ headings | Node oracle + unit mutation tests | `node scripts/assert-seo.mjs apps/web/build`; `vitest run --project scripts assert-seo` | Broken share card, sitemap drift, fabricated ratings | ❌ Wave 0 |
| GTM-03 | OG renderer: WOFF→SFNT valid; render with fonts ⇒ > 1,000 dark pixels; without fonts ⇒ 0 (non-vacuity) | unit | `vitest run --project web og-card` | Silent text-less cards (Pitfall 4) | ❌ Wave 0 |
| GTM-03 | JSON-LD runtime: 0 CSP violations, exactly one block per type after hydration, parsed content equals source | E2E | `playwright test seo` | Hydration duplication, escaping corruption | ❌ Wave 0 |
| GTM-03 | JS budget: every `(marketing)` page ≤ 60 KB gz initial JS; non-vacuity with a planted 200 KB chunk | Node oracle + unit | `node scripts/assert-budget.mjs apps/web/build`; `vitest run --project scripts assert-budget` | Heavy import leaking into marketing | ❌ Wave 0 |
| GTM-04 | Payload builder: whitelist keys only, path without `?`/`#`, referrer origin form, screen class enum, portal enum; forbidden keys absent | unit | `vitest run --project web analytics` | PII/ID leakage, Umami self-referral drop | ❌ Wave 0 |
| GTM-04 | Consent gate: GPC true ⇒ false; DNT '1' ⇒ false; default ⇒ true. Beacon: no host ⇒ 0 calls; otherwise one `no-cors` `credentials:'omit'` `keepalive` `no-referrer` string-body POST with no headers | unit (injected fetch) | `vitest run --project web beacon` | Preflight-triggering headers, cookies, tracking despite GPC | ❌ Wave 0 |
| GTM-04 | CSP builder: no host ⇒ exact Phase 1 connect-src; host ⇒ +1 origin; oracle reads the same env; mismatch fails | unit + oracle | `vitest run --project web csp-policy`; `vitest run --project scripts assert-csp` | Host missing from CSP, or present without config | ❌ extend |
| GTM-04 | Real browser: analytics build ⇒ 1 beacon per navigation to the collector, strict-schema body, no Cookie/Referer, 0 CSP violations; GPC stub ⇒ 0 beacons | E2E (`analytics` project) | `playwright test --project=analytics` | Wiring/CSP gaps the unit tests can't see | ❌ Wave 0 (cuttable, see OQ3) |
| GTM-04 | Default build sends nothing anywhere: no third-party request of any type on any route (keyless) | E2E | `playwright test third-party` | No-op not actually no-op; third-party asset added | ❌ Wave 0 |
| Audit | Axe WCAG A/AA on every route keyless AND with mocked keys (vault seeded via Phase 3 test helper, provider hosts mocked with `page.route`) | E2E | `playwright test a11y` | Keyed-state UI regressions | ✅ extend (Phase 2 `routes.ts`) |
| Audit | CSP: meta first, no `unsafe-inline` outside `style-src-attr`, no `unsafe-eval`, ld+json exemption only for valid JSON | oracle + unit | `pnpm csp:assert`; `vitest run --project scripts assert-csp` | Policy weakening | ✅ extend |
| Audit | Dependencies: full `pnpm audit` exits 0 with only documented `audit.ignore` entries; lockfile single-document; `dependabot.yml` has npm + github-actions | CLI + unit | `corepack pnpm audit`; `vitest run --project scripts supply-chain` | New advisories; Dependabot blind spot | ❌ Wave 0 |
| Audit | Banned terms over new dirs (tools content, onboarding, forms); disclaimer text present in footer of every non-print page and next to every tool result | script + E2E | `pnpm banned`; `playwright test disclaimers` | Advice/appraisal language; missing disclaimer | ✅ extend (Phase 2) / ❌ new spec |
| Audit | `docs/LAUNCH-AUDIT.md` lists every PITFALLS "Looks Done But Isn't" row with status (automated test name / HUMAN-UAT / N/A + reason) | unit (doc lint: every checklist line from PITFALLS.md appears) | `vitest run --project scripts launch-audit` | Checklist silently skipped | ❌ Wave 0 |

### Manual-Only Verifications (HUMAN-UAT)
| Behavior | Why manual | Steps |
|----------|-----------|-------|
| Umami receives events from the deployed origin | Needs the owner's Umami site + deployed Pages | Set `vars.PUBLIC_ANALYTICS_HOST` + `vars.PUBLIC_ANALYTICS_WEBSITE_ID`, deploy, visit 2 pages in a normal browser without GPC, confirm 2 pageviews in the dashboard; repeat with GPC on (Firefox/Brave) and confirm 0 |
| Web3Forms waitlist email arrives | Needs the owner's key | Set `vars.PUBLIC_WEB3FORMS_KEY`, deploy, submit one waitlist and one feedback, confirm the email subject carries the portal tag; confirm captcha is OFF |
| Share cards render on real platforms | Third-party scrapers | Paste a tool URL into a link-preview debugger (e.g. LinkedIn Post Inspector / Facebook Sharing Debugger) after deploy |
| Search Console sitemap submission | Needs the domain property | Submit `https://tranrealestate.github.io/sitemap.xml` |
| PITFALLS live-origin rows (deep-link refresh, key test from deployed URL, push protection) | Live origin only | Already in `docs/DEPLOY-CHECKLIST.md` Step 7; link them from `LAUNCH-AUDIT.md` |

### Sampling Rate
- **Per task commit:** `corepack pnpm lint && corepack pnpm test:unit` (+ `pnpm banned` once Phase 2 ships it)
- **Per wave merge:** `corepack pnpm build:root && corepack pnpm build:sub && pnpm csp:assert && pnpm seo:assert && pnpm budget:assert && pnpm test:e2e`
- **Phase gate:** `corepack pnpm verify` + `corepack pnpm audit` green, then `docs/LAUNCH-AUDIT.md` walked, before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Re-read Phase 2-9 SUMMARYs: confirm `routes.ts`, banned-terms scripts, prefs module path, `web3forms-sink.ts`, `core/finance` exports, affordability component location, Phase 3 key-seeding test helper
- [ ] `apps/web/src/lib/site-config.js` + `site-config.test.ts`; `src/lib/site.ts`; `src/app.d.ts` globals; eslint globals
- [ ] `apps/web/src/lib/csp-policy.js` + test; `scripts/assert-csp.mjs` ld+json exemption + optional host + mutation tests
- [ ] `lib/analytics/{payload,consent,beacon}.ts` + tests; `eslint.config.js` fetch allowlist + `eslint-rules.test.ts` case for `lib/analytics`
- [ ] `lib/seo/{woff.server,og-card.server,jsonld}.ts` + tests; `SeoHead.svelte`
- [ ] `scripts/assert-seo.mjs`, `scripts/assert-budget.mjs` + tests; root `package.json` scripts `seo:assert`, `budget:assert`, `audit:deps`, wired into `verify` and the CI root/sub legs (no new `uses:`)
- [ ] `scripts/serve-pages.mjs`: `.png/.xml/.txt` MIME types; optional collector + analytics listener; `playwright.config.ts` `analytics` project
- [ ] `.github/dependabot.yml`; `pnpm-workspace.yaml` `audit.ignore`; lockfile update via `pnpm audit --fix=update`; `scripts/supply-chain.test.ts`
- [ ] E2E specs: `onboarding`, `start-rentcast`, `waitlist`, `tools`, `seo`, `third-party`, `disclaimers`, `perf` (CLS); extend `a11y` with keyed state; `routes.ts` gains `tools/`, 4 tool routes, `feedback/`, `start/rentcast/`
- [ ] `docs/LAUNCH-AUDIT.md` + doc-lint test; `docs/DEPLOY-CHECKLIST.md` gains Umami/Web3Forms/vars/Search Console steps; privacy page copy update

## Sources

### Primary (HIGH confidence)
- **Spikes on this machine (2026-10-04)**, isolated copy of `apps/web` with junctioned node_modules (Kit 2.70.3, Vite 8.3.0/rolldown 1.2.8, Svelte 5.57.0, Node 24.18.0, Windows 11):
  - `$env/static/public` MISSING_EXPORT when unset; empty string accepted
  - relative `base` in prerendered pages
  - `define` constants in pages + endpoints
  - sitemap/robots endpoints emitted as files under `trailingSlash: 'always'`; default entries include them
  - `import.meta.glob` route derivation
  - `prerender.origin` crawl failing the build on a missing OG image
  - resvg-js 2.6.2: WOFF yields no text, WOFF→SFNT works, "Fraunces SemiBold" family name, deterministic PNG, dark-pixel non-vacuity, native module inside a prerendered endpoint
  - JSON-LD via `svelte:element`: Svelte escaping, `\u` fix, 0 CSP violations, no hydration duplication (Playwright Chromium)
  - JS budget baseline 32.7-32.8 KB gz
  - no-cors/cors text/plain keepalive fetch delivery without preflight/cookies/Referer
  - `pnpm audit` vs `--prod`, `audit.ignore`, `--fix=update`
- `@sveltejs/kit` 2.70.3 source: `src/core/postbuild/crawl.js` (`CRAWLABLE_META_NAME_ATTRS`, link href crawl), `src/core/postbuild/prerender.js` (`removePrerenderOrigin`, root non-HTML guard)
- Umami v3.4.0 source (GitHub API, release 2026-09-17): `src/app/api/send/route.ts` (schema, session hashing, referrer handling, bot check), `src/lib/request.ts` (`getJsonBody`), `src/lib/detect.ts`, `src/lib/schema.ts`, `next.config.ts` (CORS headers), `src/tracker/index.ts` (fetch options, DNT)
- [Umami docs: Sending stats](https://docs.umami.is/docs/api/sending-stats): `/api/send`, payload, User-Agent requirement, Cloud endpoint
- [pnpm audit docs](https://pnpm.io/cli/audit): `audit.ignore`, `audit.level`, `--fix=update`, legacy keys
- [Google: Software app structured data](https://developers.google.com/search/docs/appearance/structured-data/software-app) (updated 2026-09-08): `aggregateRating` or `review` required
- [Web3Forms API reference](https://docs.web3forms.com/getting-started/api-reference): endpoint, fields, client-side use
- npm registry (`npm view`, 2026-10-04): versions listed in Standard Stack; `@sveltejs/kit` dist-tags (`latest` 3.0.0)
- Phase 8 RESEARCH (sibling, 2026-10-04): Web3Forms response shapes, deprecated honeypot, captcha breakage, test UUID

### Secondary (MEDIUM confidence)
- [dependabot-core #14794 Support PNPM v11](https://github.com/dependabot/dependabot-core/issues/14794) (closed 2026-09-15; pnpm maintainer's comment on two-document lockfiles), [#14919](https://github.com/dependabot/dependabot-core/issues/14919), #15904 (open, pnpm v12)
- [Search Engine Journal: Google drops FAQ rich results](https://www.searchenginejournal.com/google-drops-faq-rich-results-from-search/574429/), [seostrategy.co.uk: FAQ schema after 7 May 2026](https://www.seostrategy.co.uk/learn/faq-schema-deprecation-2026-rich-result-vs-schema/)
- [MDN: DNT header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/DNT), [MDN blog: Global Privacy Control](https://developer.mozilla.org/en-US/blog/global-privacy-control/), [cookient.app: GPC vs DNT 2026](https://cookient.app/blog/global-privacy-control-vs-do-not-track)

### Tertiary (LOW confidence, flagged)
- Umami Cloud Hobby limits (100K events/month, ~3 sites, 6-month retention): [freetier.co](https://freetier.co/directory/products/umami), [canivibecodeit.com](https://canivibecodeit.com/umami-cloud). The official pricing page did not render for fetch. Owner confirms at signup.
- Ad-blocker lists blocking Umami Cloud hosts: community knowledge, not verified against current EasyPrivacy. Treated only as "counts are a lower bound".

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Two dev dependencies, both exercised end to end in a spike on Windows; Linux binaries come from the same optionalDependencies mechanism (not run on Linux here: MEDIUM for CI until the first CI run).
- Architecture: HIGH for build/SEO/CSP/beacon mechanics (spike-verified). MEDIUM for onboarding/prefs integration (depends on unbuilt Phases 3/4/6).
- Pitfalls: HIGH (11 of 14 reproduced or read from source).
- Validation: HIGH for the test design. The analytics E2E project is optional (OQ3).

**Research date:** 2026-10-04
**Valid until:** 2026-11-03 (30 days; re-check Umami `/api/send` schema and Dependabot pnpm status if planning slips)
