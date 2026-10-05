# Phase 2: Brand System, Marketing & Legal Pages - Research

**Researched:** 2026-10-04
**Domain:** SvelteKit 2 static marketing surface: Tailwind v4 design tokens, self-hosted variable fonts under a strict meta CSP, accessible disclosure navigation, copy-compliance CI gate, Playwright layout/a11y verification on two base paths
**Confidence:** HIGH. Every load-bearing claim below was verified empirically in a throwaway git worktree of this repo (installed the three new packages, built both bases, ran the existing Phase 1 E2E suite plus spike specs). The worktree was removed afterwards.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Proposals were presented 2026-09-23. The owner accepted all of them as recommended on 2026-10-04.

#### Typography & palette
- Fraunces (headings) + Inter (body), both variable fonts.
  - Self-hosted from the repo or `@fontsource-variable` packages bundled by Vite.
  - No Google Fonts CDN and no third-party requests.
- Palette:
  - warm ivory ground
  - espresso text
  - terracotta accent
  - sage secondary
- WCAG 2.2 AA contrast is enforced at the token level:
  - every text/background token pair is asserted by a unit test (≥4.5:1 body text, ≥3:1 large text and UI components).
- Light-only in v1, with no dark mode.
- Tokens live in `packages/brand` (currently an empty `tokens` contract) and are exposed to Tailwind v4 via `@theme` in `apps/web/src/app.css`.
  - The extension popup (Phase 11) will reuse them.

#### Landing & audience pages
- Landing structure:
  - hero (headline, subhead, three portal cards: Renter / Investor / Agent)
  - "How it works" in 3 steps
  - trust strip ("Your keys never leave your browser", "Not a brokerage")
  - footer
- One shared audience-page template drives /for-renters/, /for-investors/ and /for-agents/ (exact slugs at planner discretion; must be prerendered with trailing slashes).
  - Each page has an "Open portal" CTA and a "Try sample data" CTA (the sample-data mode arrives in Phase 4, so the CTA links to the portal for now).
- Imagery:
  - no stock photos of people
  - warm abstract textures (CSS/SVG) plus illustrated property-type marks (inline SVG, no external assets)
- No fabricated metrics, testimonials, user counts or ratings.
- Copy never implies brokerage, appraisal, or investment/legal/tax advice.
- A banned-terms grep runs in CI and in `pnpm verify` over marketing and legal copy. It fails on terms like "appraisal", "guaranteed", "best investment", "we represent", "brokerage services" and fake-testimonial markers. A non-vacuity test proves the grep catches a planted term.

#### Navigation, legal & footer
- Header has a "Tran Real Estate Tools" text-only wordmark (no SVG logo in v1) and portal nav Renter · Investor · Agent.
  - Below ~640px the nav collapses into an accessible disclosure menu (button with aria-expanded, keyboard and focus correct).
  - The portal switcher is reachable from every app page (BRND-05).
- Four prerendered legal pages under `/legal/`:
  - privacy
  - terms ("software tool; not a brokerage; not investment, legal, or tax advice")
  - fair-housing
  - data-coverage (RentCast-sourced, no MLS/IDX, no photos, coverage gaps; no CoStar)
- Footer appears on every page (marketing and app) with:
  - a disclaimer line
  - the four legal links
  - an Equal Housing Opportunity statement
  - © Tran Real Estate Tools

#### Locked from earlier (do not re-ask)
- Public brand "Tran Real Estate Tools".
- Warm editorial direction.
- Self-hosted fonts.
- No third-party scripts.
- No brokerage, appraisal or advice implications.
- The strict meta CSP from Phase 1 must stay green. `default-src 'self'` already covers self-hosted fonts.
- Inline style attributes are allowed (`style-src-attr 'unsafe-inline'`). Inline `<style>`/`<script>` in app.html are not.

### Claude's Discretion
- Exact hex values, type scale, spacing scale and radius tokens, chosen through the UI/UX Pro Max design contract (`/gsd:ui-phase 2`) within the palette above.
- Exact legal copy wording, within the stated constraints. It is plain-language and not legal advice.
- Route slugs for the audience pages and component file layout.

(The approved `02-UI-SPEC.md` has since fixed the hex values, type scale, slugs, copy and component inventory. Treat it as locked too.)

### Deferred Ideas (OUT OF SCOPE)
- Dark mode (post-v1).
- SVG logo mark (post-v1).
- Licensed photography (post-v1, if ever).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRND-01 | Visitor sees a warm-editorial landing page that explains Tran Real Estate Tools and routes to the Renter, Investor, and Agent portals | Font self-hosting verified under both bases (§Pattern 1). Token pipeline: brand TS, `@theme`, parity test (§Pattern 2). Landing components and copy come from the UI-SPEC. The no-third-party-request E2E pattern is verified (§Code Examples). |
| BRND-02 | Visitor can read dedicated For Renters, For Investors, and For Agents pages describing each portal's value | Shared `AudiencePage` plus typed content in `$lib/content/` (it must NOT live in `$lib/data`, see Pitfall 6). Banned-terms gate design (§Pattern 5). |
| BRND-03 | Every page meets WCAG 2.2 AA color contrast and is fully usable at 375px viewport width | Contrast matrix independently recomputed and matches the UI-SPEC exactly (§Pattern 3). Axe on every route at two widths. 375px scrollWidth check verified. 640px switch and disclosure behaviour verified in the spike (§Pattern 4). |
| BRND-04 | Visitor can read legal pages: privacy, terms (software tool; not a brokerage; not investment, legal, or tax advice), Fair Housing statement, data-coverage explainer | `LegalPage` layout component, plain Svelte pages (no mdsvex). Footer links reach them from every page. External-link handling breaks the existing routing spec unless it is filtered (Pitfall 3). |
| BRND-05 | User can switch between portals from any app page | `SiteHeader` rendered from the `(marketing)` and `(app)` group layouts plus `+error.svelte`. `aria-current` must use `page.route.id`, not hrefs (Pitfall 1, verified). |
</phase_requirements>

## Summary

The stack additions are small and all verified: `@fontsource-variable/fraunces@5.3.0`, `@fontsource-variable/inter@5.3.0` and `@lucide/svelte@1.45.0` (pin this one, see Pitfall 8). I built the real repo with the fonts imported in the root layout. Vite emits hashed `.woff2` files to `_app/immutable/assets/`. The bundled CSS references them as `url(./<name>.<hash>.woff2)`, relative to the CSS file itself, so **the same CSS works unchanged under `/` and `/tran_real_estate/`**. At runtime both bases loaded only the Latin subsets (`unicode-range` does its job), every request was same-origin, `document.fonts` reported both families `loaded`, and the existing Phase 1 CSP, axe, routing and framing specs all stayed green. Every woff2 file is over 10 KB, so Vite's default 4 KB inline limit would not have produced `data:` URIs anyway. Kit forwards `build.assetsInlineLimit` to its client build (checked in Kit 2.70.3 source), so setting it to `0` as the UI-SPEC requires is a cheap belt-and-braces guard.

The real planning risks are integration details, not libraries. Each was found by running code:

1. **`aria-current` computed by comparing `page.url.pathname` to `resolve()` is absent from the prerendered HTML.** With `paths.relative`, `resolve()` returns `../renter/` during SSR. Comparing `page.route.id` instead is correct in the prerendered output (verified).
2. **The existing routing spec will fail on legal-page external links** (HUD, RentCast, provider policies). It asserts that every non-fragment `href` resolves to a trailing-slash path under the base.
3. **The footer links to all 7 new routes**, and prerender runs with `handleHttpError: 'fail'`. The plan that adds the footer must also create (at least stub) every route it links.
4. **Tailwind v4 namespace collisions:** `--container-prose` does NOT override the built-in `max-w-prose` (still `65ch`), and `--duration-*` is not a Tailwind namespace, so `duration-fast` generates nothing.
5. **Prettier lowercases hex colors in `app.css`**, so the parity test must compare case-insensitively.
6. **`onkeydown` on `<nav>` triggers a svelte-check a11y warning, and the `$state` + `$effect` close-on-resize pattern trips ESLint `svelte/prefer-writable-derived`.** A `<svelte:window onkeydown>` plus a writable `$derived` passes check and lint with 0 warnings.

The disclosure menu pattern in §Pattern 4 passed a 375px/640px Playwright test on both bases: Escape returns focus, the panel closes after navigation and on resize, landmark counts are right, and the 404 fallback works.

**Primary recommendation:** Build the tokens as one TS module in `@tran/brand` (with contrast and parity unit tests). Restructure the layouts so each group layout owns `<header>/<main>/<footer>` and the routes plan creates all 7 new routes. Ship `scripts/banned-terms.mjs` as a dependency-free rules module plus CLI in the `hygiene` CI job and `pnpm verify`. Put all routes in one shared E2E `routes.ts` with a build-directory drift guard so no future page can escape the axe, CSP, 375px and footer checks.

## Standard Stack

### Core (already installed, verified in `node_modules/.pnpm`)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@sveltejs/kit` | 2.70.3 | Routing, prerender, `$app/state`, `$app/paths` `resolve()` | `page.route.id` is available during prerender (verified) |
| `svelte` | 5.57.0 | Runes, `MediaQuery` from `svelte/reactivity` (since 5.7), writable `$derived` | Verified `MediaQuery(query, fallback)` auto-wraps the query in parentheses |
| `tailwindcss` + `@tailwindcss/vite` | 4.3.3 | `@theme` tokens become utilities | Preflight hides `[hidden]` with `display:none !important` (verified in `preflight.css`), so the `hidden` attribute is reliable |
| `vite` | 8.3.0 | `build.assetsInlineLimit: 0` | Kit 2.70.3 passes it through to the client build (`src/exports/vite/index.js`) |
| `@playwright/test` / `@axe-core/playwright` | 1.63.0 / 4.13.0 | E2E plus axe | Existing dual-base harness, ports 4273-4275 |
| `vitest` | 4.1.11 | Unit tests (projects `web`, `core`, `scripts`, plus the new `brand`) | |

### New in this phase
| Library | Version (verified on npm 2026-10-04) | Purpose | Notes |
|---------|---------|---------|-------|
| `@fontsource-variable/fraunces` | **5.3.0** (latest; published 2026-07-19) | Display serif | OFL-1.1. The default entry `index.css` is byte-identical to `wght.css`: 3 `@font-face` rules (latin, latin-ext, vietnamese), weight 100-900, `font-display: swap` |
| `@fontsource-variable/inter` | **5.3.0** (latest) | Body/UI sans | OFL-1.1. `index.css` equals `wght.css`: 7 faces (adds cyrillic and greek) |
| `@lucide/svelte` | **1.45.0** (pin exact. Latest is 1.52.0, published *today*) | UI glyphs (Menu, X, ArrowRight, KeyRound, ServerOff, Database, ExternalLink) | Peer `svelte ^5`. 1.45.0 has the same `./icons/*` deep-import export map (verified). All 7 icon files exist. |
| `@tran/brand` | `workspace:*` (new dependency of `apps/web`) | Token source of truth imported by the parity test (and by Phase 11) | Verified: Vitest `web` project, `svelte-check` (0 errors) and `vite build` all resolve the `.ts` export map |

**Installation:**
```bash
corepack pnpm --filter web add -D @fontsource-variable/fraunces@5.3.0 @fontsource-variable/inter@5.3.0 @lucide/svelte@1.45.0 "@tran/brand@workspace:*"
corepack pnpm --filter @tran/brand add -D vitest@4.1.11
```
Then check that `package.json` keeps exact pins (the repo convention), not carets. Commit `pnpm-lock.yaml`, because CI runs `--frozen-lockfile`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fraunces `wght` entry (36 KB latin) | `@fontsource-variable/fraunces/opsz.css` (67 KB latin, wght+opsz axes) | The UI-SPEC says "import only the default wght-axis entry" **and** sets `font-optical-sizing: auto`. The wght build has no opsz axis, so that declaration is a harmless no-op. Keep the spec (smaller font). Open Question 1. |
| Plain Svelte legal pages | mdsvex | Not in the stack. It adds a preprocessor, and plain Svelte inside a `LegalPage` wrapper is simpler and gets the same compile-time checks. |
| bits-ui / shadcn for the menu | Hand-built disclosure | The UI-SPEC defers shadcn to Phase 3. A disclosure needs about 40 lines (§Pattern 4). |
| Generating the `@theme` block from TS | Duplicate literals plus a parity test | The UI-SPEC locks duplication plus a parity test, the same as the Phase 1 CSP literal-duplicate pattern. |

## Architecture Patterns

### Recommended file layout
```
packages/brand/
├── src/index.ts              # tokens (color/font/radius/shadow/ease), contrastPairs, luminance(), contrastRatio(), themeVars()
├── src/contrast.test.ts      # every pair meets min, deco/border never fg of text/ui, planted-failure control
├── vitest.config.ts          # name 'brand', setupFiles ../../tooling/vitest/no-network.ts
└── package.json              # + vitest devDep
apps/web/src/
├── app.css                   # @import 'tailwindcss'; @theme { --color-*: initial; ...literals... } + base layer rules
├── app.d.ts                  # (only if using __BUILD_YEAR__ define, see Pattern 7)
├── lib/
│   ├── brand/theme-parity.test.ts   # reads ../../app.css, compares with @tran/brand (web Vitest project)
│   ├── build-info.ts                # export const BUILD_YEAR = __BUILD_YEAR__ (a .ts file, see Pitfall 11)
│   ├── content/audiences.ts         # typed per-audience copy (NOT under lib/data; see Pitfall 6)
│   └── components/
│       ├── layout/{SiteHeader,PortalSwitcher,SiteFooter,SkipLink}.svelte
│       ├── ui/ButtonLink.svelte
│       ├── marketing/{PortalCard,HowItWorks,TrustStrip,AudiencePage,PortalPlaceholder}.svelte
│       ├── legal/LegalPage.svelte
│       └── brand/marks/{Renter,Investor,Agent}Mark.svelte
└── routes/
    ├── +layout.svelte              # fonts + app.css + SkipLink + children (NO <main>)
    ├── +error.svelte               # own SiteHeader + <main> + SiteFooter
    ├── (marketing)/+layout.svelte  # SiteHeader showSettings={false} + <main id tabindex=-1> + SiteFooter
    ├── (marketing)/+page.svelte, for-renters/, for-investors/, for-agents/, legal/{privacy,terms,fair-housing,data-coverage}/
    ├── (app)/+layout.svelte        # SiteHeader showSettings + <main> + SiteFooter
    └── (print)/+layout.svelte      # <main id="main-content" tabindex="-1"> only, chrome-free
apps/web/tests/e2e/
├── routes.ts                 # single exported ROUTES list (+ PRINT_ROUTE, NOT_FOUND) shared by all specs
└── layout.spec.ts            # landmarks, 375/640, disclosure, footer legal links, third-party requests, fonts, external links
scripts/
├── lib/banned-terms-rules.mjs  # pure rules (no I/O)
├── banned-terms.mjs            # CLI: walk scope dirs (fs, not git ls-files), exit 1 on hits
└── banned-terms.test.ts        # rules table + CLI non-vacuity (temp dir) + real-scope coverage
```

### Pattern 1: Self-hosted variable fonts (VERIFIED end-to-end)
**What:** Import the Fontsource CSS entries in the root layout. Vite copies the woff2 files into `_app/immutable/assets/` and rewrites `url()` relative to the CSS file.
```svelte
<!-- apps/web/src/routes/+layout.svelte -->
<script lang="ts">
	import '@fontsource-variable/fraunces'; // = wght.css: 3 faces, latin subset ~36 KB
	import '@fontsource-variable/inter'; // = wght.css: 7 faces, latin subset ~48 KB
	import '../app.css';
	import SkipLink from '$lib/components/layout/SkipLink.svelte';

	let { children } = $props();
</script>

<SkipLink />
{@render children()}
```
```ts
// apps/web/vite.config.ts: add at top level (applies to both the Kit and Vitest branches)
build: { assetsInlineLimit: 0 },
```
Observed build output (root and sub were identical apart from the HTML link depth):
- `_app/immutable/assets/0.<hash>.css` contains `url(./inter-latin-wght-normal.Dx4kXJAl.woff2)` and 9 more. There were 0 `data:` occurrences.
- `build/renter/index.html` links `../_app/immutable/assets/0.<hash>.css`. The relative CSS link plus the relative font `url()`s means no base rewriting is needed.
- Runtime on sub: requests went to `http://127.0.0.1:4274/tran_real_estate/_app/immutable/assets/inter-latin-wght-normal….woff2` and the Fraunces equivalent. There were 14 total requests, all same-origin, 0 failed, and 0 CSP violations.

Tailwind v4 already sets `--default-font-family: var(--font-sans)` in its base layer (verified in emitted CSS). Declaring `--font-sans` in `@theme` therefore makes Inter the document font with no extra rule. `--font-display` produces the `font-display` utility (verified).

### Pattern 2: Token single source plus parity test
**What:** `packages/brand/src/index.ts` holds the literals. `app.css @theme` duplicates them. A Vitest test in the `web` project parses `app.css` and compares.
```ts
// packages/brand/src/index.ts (shape; values from UI-SPEC)
export const tokens = {
	color: { background: '#fbf7f0', surface: '#f2e9db', card: '#fffdf9', foreground: '#2b1d16', /* … */ white: '#ffffff' },
	font: { display: "'Fraunces Variable', Georgia, 'Times New Roman', serif", sans: "'Inter Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" },
	radius: { sm: '4px', md: '8px', lg: '16px', full: '9999px' }
} as const;

/** Flattens tokens to the exact CSS custom-property names used in @theme. */
export function themeVars(t = tokens): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [group, entries] of Object.entries(t))
		for (const [name, value] of Object.entries(entries)) out[`--${group}-${name}`] = value;
	return out;
}
```
```ts
// apps/web/src/lib/brand/theme-parity.test.ts
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { themeVars } from '@tran/brand';

const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');
const block = /@theme\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
const declared = Object.fromEntries(
	[...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])
);
const norm = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').replace(/"/g, "'");
const SCOPED = /^--(color|font|radius)-/;

test('@theme is non-empty (non-vacuity)', () => expect(Object.keys(declared).length).toBeGreaterThan(15));
test('every brand token appears in @theme with the same value', () => {
	for (const [k, v] of Object.entries(themeVars())) expect(norm(declared[k] ?? '<missing>'), k).toBe(norm(v));
});
test('@theme declares no --color/--font/--radius var that brand lacks', () => {
	const brand = themeVars();
	for (const k of Object.keys(declared).filter((k) => SCOPED.test(k) && !k.endsWith('-*')))
		expect(brand, `${k} is in app.css but not in @tran/brand`).toHaveProperty(k);
});
test('the default palette is reset', () => expect(block).toMatch(/--color-\*:\s*initial;/));
```
Also add a mutation unit test that runs the same comparison function on a string copy of `app.css` with one hex changed and expects a mismatch. That proves the parser actually reads values.

**Verified:** `@tran/brand@workspace:*` resolves in the Vitest `web` project (the plain-`svelte()` branch), in `svelte-check` and in `vite build`.

### Pattern 3: WCAG contrast test (formula verified against the UI-SPEC matrix)
```ts
// packages/brand/src/index.ts
const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export function luminance(hex: string): number {
	const n = parseInt(hex.replace('#', ''), 16);
	return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
export function contrastRatio(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}
export type Pair = { fg: ColorToken; bg: ColorToken; min: 4.5 | 3; kind: 'text' | 'large-text' | 'ui' };
export const contrastPairs: readonly Pair[] = [ /* every "pass" row of the UI-SPEC matrix, by token NAME */ ];
export const failingPairs = (pairs = contrastPairs) => pairs.filter((p) => contrastRatio(tokens.color[p.fg], tokens.color[p.bg]) < p.min);
```
Independent recomputation (2026-10-04) matched the UI-SPEC to two decimals in every cell. For example: foreground/background 15.24, primary/accent-surface 4.88, border-strong/accent-surface 3.55, white/primary 6.06. deco-terracotta/background is 3.32, so the planted control (`deco-terracotta` on `background` as `text`, min 4.5) is rejected. Pairs must reference token **names**, not hex, so a palette change can't make the test vacuous. Tests to include:
1. `failingPairs()` is `[]`.
2. No pair of kind `text`/`ui` has `fg` in `{deco-terracotta, deco-sage, border}`.
3. The planted failure `[{fg:'deco-terracotta', bg:'background', min:4.5, kind:'text'}]` returns exactly 1 failing pair.
4. `contrastPairs.length` is at least the matrix row count (non-vacuity).
5. Known anchors: `contrastRatio('#000000','#ffffff')` is 21 (±0.01), and the ratio is symmetric.

### Pattern 4: Accessible disclosure portal switcher (VERIFIED: check 0 warnings, lint clean, Playwright green on both bases)
**Landmark layout decision:** The UI-SPEC wants the panel in flow below the header row, full width. If `<nav>` is only the right-hand flex child, the panel can only be as wide as the nav. Making it full width would need `display:contents` (landmark exposure is unreliable) or grid overlap tricks. **Recommended:** have `<nav aria-label="Portals">` wrap the whole header row: wordmark, inline list, button, panel. Use `flex flex-wrap`, with the panel `basis-full`. This keeps exactly one `banner`, one `navigation "Portals"`, one `main`, one `contentinfo` at every width (asserted in the spike at 375px on `/`, `/renter/`, `/print/` and the 404 fallback). The wordmark is a home link, which is legitimately navigation. This is a small structural deviation from the UI-SPEC's component split. Document it in the plan.
```svelte
<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import Menu from '@lucide/svelte/icons/menu'; // deep import: see Pitfall 9
	import X from '@lucide/svelte/icons/x';

	let { showSettings = false }: { showSettings?: boolean } = $props();
	const wide = new MediaQuery('min-width: 640px', false);
	// Writable derived (Svelte >=5.25): re-derives to closed whenever the viewport crosses 640px,
	// still assignable. $state + $effect here trips eslint svelte/prefer-writable-derived.
	let open = $derived.by(() => {
		void wide.current;
		return false;
	});
	let hydrated = $state(false);
	let button: HTMLButtonElement | undefined = $state();

	const links = [
		{ href: resolve('/renter/'), label: 'Renter', id: '/(app)/renter' },
		{ href: resolve('/investor/'), label: 'Investor', id: '/(app)/investor' },
		{ href: resolve('/agent/'), label: 'Agent', id: '/(app)/agent' }
	];
	// page.route.id, NOT page.url.pathname === href (Pitfall 1)
	const current = (id: string) => (page.route.id === id ? 'page' : undefined);

	onMount(() => (hydrated = true)); // E2E waits on [data-hydrated] before clicking
	afterNavigate(() => (open = false));

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			open = false;
			button?.focus();
		}
	}
</script>

<svelte:window {onkeydown} />  <!-- onkeydown on <nav> => a11y_no_noninteractive_element_interactions warning -->

<header>
	<nav aria-label="Portals" class="mx-auto flex max-w-page flex-wrap items-center" data-hydrated={hydrated || undefined}>
		<a class="mr-auto" href={resolve('/')}>Tran Real Estate Tools</a>
		<ul class="hidden sm:flex"> <!-- inline list, ≥640 --> … aria-current={current(l.id)} … </ul>
		<button bind:this={button} type="button" class="sm:hidden" aria-expanded={open} aria-controls="portal-menu"
			onclick={() => (open = !open)}>
			{#if open}<X size={20} aria-hidden="true" />Close{:else}<Menu size={20} aria-hidden="true" />Menu{/if}
		</button>
		<ul id="portal-menu" class="basis-full sm:hidden" hidden={!open}> … </ul>  <!-- always rendered: aria-controls target exists -->
	</nav>
</header>
```
Spike assertions that passed (root and sub): the button starts `aria-expanded="false"` with the panel hidden. Click sets `true`, shows the panel, and the current row has `aria-current="page"`. Escape with focus on a panel link hides the panel and focuses the Menu button. Clicking a panel link navigates and the panel is hidden afterwards. With the menu open, resizing to 640 hides the button and the panel and shows the inline links. Resizing back to 639 shows the button with `aria-expanded="false"`.

### Pattern 5: Banned-terms gate (rules module plus CLI, mirrors `real-data-rules.mjs`)
```js
// scripts/lib/banned-terms-rules.mjs: pure, no I/O
// Word phrases match across any whitespace (Prettier wraps long Svelte text at printWidth 100),
// case-insensitive, with explicit inflections. Symbols are matched literally and as HTML entities.
const words = (s) => s.trim().split(/\s+/).join('\\s+');
export const BANNED = [
	['appraisal', /\bappraisals?\b/i], ['appraise', /\bapprais(?:e|es|ed|ing|er|ers)\b/i],
	['guarantee', /\bguarantee(?:s|d)?\b/i], ['guaranty', /\bguarant(?:y|ies)\b/i],
	['best investment', new RegExp(`\\b${words('best investment')}s?\\b`, 'i')],
	['we represent', new RegExp(`\\b${words('we represent')}\\b`, 'i')],
	['brokerage services', new RegExp(`\\b${words('brokerage services')}\\b`, 'i')],
	['risk-free', /\brisk[-\s]?free\b/i], ['will appreciate', new RegExp(`\\b${words('will appreciate')}\\b`, 'i')],
	['passive income', new RegExp(`\\b${words('passive income')}\\b`, 'i')],
	['testimonial', /\btestimonials?\b/i], ['rated 5', /\brated\s+5\b|\b(?:5|five)[-\s]star\b/i],
	['star glyph', /[★☆]|&#9733;|&#x2605;|&starf;|&#9734;|&star;/i],
	['trusted by', new RegExp(`\\b${words('trusted by')}\\b`, 'i')],
	['thousands of', new RegExp(`\\b${words('thousands of')}\\b`, 'i')]
];
export const SCOPE = ['apps/web/src/routes', 'apps/web/src/lib/components', 'apps/web/src/lib/content'];
export const SCANNED_EXT = /\.(svelte|ts|js|md)$/i;
export const EXCLUDED = /\.(test|spec)\.[tj]s$/i;
/** @returns {string[]} one "file:line: banned term "X" (matched "...")" per hit */
export function findBanned(file, text) { /* run each regex with 'g' over the WHOLE text; line = count of \n before match.index + 1 */ }
```
CLI `scripts/banned-terms.mjs`:
- Walk `SCOPE` with `fs.readdirSync(dir, { recursive: true })` (Node 24), **not** `git ls-files`. That way new, not-yet-staged pages are scanned during `pnpm verify`.
- Accept `--root <dir>` so tests can point it at a temp tree.
- Print `Banned-terms check passed (N files)`, or the hits and exit 1.
- Exit 1 if N is 0. A misconfigured scope must fail closed.

Wiring:
- Root `package.json`: `"banned": "node scripts/banned-terms.mjs"`. Insert `pnpm banned` into `verify` right after `pnpm lint` (fast, fails early).
- `.github/workflows/ci.yml`, `hygiene` job (Node is already set up there and the script needs no `pnpm install`): add a step `- name: Banned marketing/legal terms` with `run: node scripts/banned-terms.mjs`. This adds **no** `uses:` line, so the SHA-pin count (7) and checkout count (2) assertions in `workflow-gate.test.ts` are untouched.
- `scripts/workflow-gate.test.ts`: add `expect(job('hygiene')).toContain('run: node scripts/banned-terms.mjs')` to the hygiene describe. Then mutation-check it by deleting the step and confirming the test goes red.
- Leave the pre-commit hook unchanged. `precommit.test.ts` derives the hook from `package.json`, and changing it widens Phase 1's blast radius for no gain.

### Pattern 6: Group-layout restructure (VERIFIED)
- The root `+layout.svelte` loses `<main>` and keeps fonts, CSS, SkipLink and children.
- The `(marketing)` and `(app)` layouts each render `SiteHeader`, `<main id="main-content" tabindex="-1">` and `SiteFooter`.
- `(print)` renders only `<main id="main-content" tabindex="-1">`.
- `+error.svelte` renders its own header, main and footer. It renders inside the root layout only, and it is what the `404.html` fallback shows client-side.

In the spike this gave the exact landmark counts on all four route kinds, under both bases.

### Pattern 7: Copyright year without a hydration/fallback mismatch
Compute the year once at build time with a Vite `define` (`__BUILD_YEAR__: JSON.stringify(new Date().getFullYear())`) and expose it from a **`.ts`** module (`$lib/build-info.ts`). Declare the global in `src/app.d.ts`. The prerendered HTML, the hydrated client and the client-rendered `404.html` then agree. MEDIUM confidence: this is the standard Vite `define` mechanism, but it was not exercised in the spike. Fallback: a literal `© 2026` updated yearly is acceptable for v1.

### Anti-Patterns to Avoid
- **`page.url.pathname === resolve('/x/')` for current-page detection.** It is wrong in the prerendered HTML (Pitfall 1).
- **`{#if open}` around the menu panel.** `aria-controls` would point at a missing id while closed. Keep it rendered with `hidden={!open}`.
- **Any `<style>`/`<script>` added to `app.html`, or Kit `inlineStyleThreshold > 0`.** Both produce inline CSS, which `style-src 'self'` blocks (meta CSP hash mode does not hash styles). Leave `inlineStyleThreshold` at its default of 0.
- **Raw hex in components.** Use token utilities: `bg-surface`, `text-muted-foreground`, and for SVG marks `fill-deco-terracotta` / `stroke-foreground` (verified: Tailwind emits `.fill-primary{fill:var(--color-primary)}`). Use `var(--color-…)` in `<style>` blocks; Tailwind detects such usage and emits the variable (verified with a var referenced only inside a component `<style>`). A dynamically built name (`var(--color-${x})`) is NOT detected.
- **`target="_blank"` on external links.** The UI-SPEC says same tab.
- **`page.addStyleTag()` in E2E** (for text-spacing tests). The CSP blocks it (verified: `style-src-elem` violation). Use `adoptedStyleSheets` (Code Examples).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Font subsetting, `@font-face`, unicode-range | Hand-copied woff2 files plus hand-written `@font-face` | `@fontsource-variable/*` CSS entries through Vite | Hashed filenames, relative URLs that survive the base path, per-script subsets loaded on demand (verified: only latin requested) |
| Icon SVG paths | Copy-pasted SVG strings | `@lucide/svelte/icons/<name>` | Tree-shaken (the landing node chunk was 4.1 KB with 2 icons), consistent stroke, no inline style attributes (verified rendered markup) |
| Viewport-change listener | `window.matchMedia` plus manual add/removeEventListener in `$effect` | `MediaQuery` from `svelte/reactivity` | SSR-safe fallback, automatic subscription cleanup |
| Contrast math | An npm "color-contrast" package | 10 lines of the WCAG formula (Pattern 3) | Zero dependencies, the formula is normative, and the values are verified against the UI-SPEC |
| Accessibility rules | Hand-written DOM checks for alt/labels/contrast | `@axe-core/playwright` with WCAG tags | Add only what axe can't see: landmark counts, 375px overflow, target behaviour |
| HTML structural checks of the build | A new scanner | Extend `scripts/assert-csp.mjs` (`EXPECTED_PAGES`, plus a `data:` URI check over `.css`/`.html`) | One oracle that is already mutation-tested |

## Common Pitfalls

### Pitfall 1: `aria-current` missing from prerendered HTML (VERIFIED)
**What goes wrong:** `page.url.pathname === resolve('/renter/')` is false during prerender. `paths.relative` (the Kit default) makes `resolve()` return `../renter/` in SSR. The built `renter/index.html` had **no** `aria-current`. It appeared only after hydration.
**How to avoid:** Compare `page.route.id === '/(app)/renter'`. In the spike the prerendered sub-path HTML then contained `aria-current="page"`. Do the same for footer links (`'/(marketing)/legal/privacy'`, …).
**Warning signs:** The E2E passes (post-hydration) but `page.request.get('renter/')` raw HTML lacks `aria-current`. Add exactly that raw-HTML assertion.

### Pitfall 2: Footer links to routes that don't exist yet break prerender
**What goes wrong:** `prerender.handleHttpError: 'fail'` means a footer linking `/legal/privacy/` before that route exists fails the build. `handleUnseenRoutes: 'fail'` means a new route not linked anywhere also fails.
**How to avoid:** The plan that introduces `SiteFooter` must create all 7 new routes in the same plan, at least as stubs (h1 plus `<title>`). Later content plans fill them.

### Pitfall 3: The routing spec rejects external links
**What goes wrong:** `routing.spec.ts` "every in-page link resolves to a trailing-slash path under the current base" maps every `a:not([href^="#"])` through `new URL(href, page.url())`. A HUD or RentCast link fails `/\/$/` and the sub-base prefix check.
**How to avoid:** Filter to same-origin before the assertions. Add a separate assertion that external links are `https:`, have no `target`, and (if desired) belong to an allowlist of hosts: `hud.gov`, `rentcast.io`, the provider policy hosts.

### Pitfall 4: Tailwind v4 namespace collisions (VERIFIED)
**What goes wrong:** `--container-prose: 40rem` does **not** change `max-w-prose`; the emitted rule stayed `.max-w-prose{max-width:65ch}`. `--duration-fast` emits no `duration-fast` utility, because `--duration-*` is not a theme namespace. `--container-page` works (`.max-w-page{max-width:var(--container-page)}`), as do `--shadow-card`, `--ease-out`, `--radius-*` and `fill-*`/`stroke-*` from colors.
**How to avoid:** Rename `--container-prose` to `--container-reading` (`max-w-reading`), or use `max-w-(--container-prose)`. Use `duration-150`/`duration-200` utilities (Tailwind's default transition duration is already 150ms), or `[transition-duration:var(--duration-base)]` from a component style. Record this as a deviation from the UI-SPEC's token names.

### Pitfall 5: Prettier lowercases hex colors (VERIFIED)
**What goes wrong:** Writing `#FBF7F0` in `app.css` gets reformatted to `#fbf7f0` by `prettier --write`, and `prettier --check` (in `pnpm lint`) fails on the uppercase form. A case-sensitive parity test would then fail.
**How to avoid:** Store lowercase hex in both files and also normalize in the test.

### Pitfall 6: Audience copy under `$lib/data` breaks the ESLint boundary
**What goes wrong:** `eslint.config.js` forbids `(marketing)` routes from importing `$lib/data/**`, `$lib/storage/**` and `$lib/ai/**`. Putting `audiences.ts` in `lib/data/` fails lint. Also, `scripts/lib/real-data-rules.mjs` scans `(^|/)data/` paths for emails and phones.
**How to avoid:** Use `$lib/content/`. Don't name any file or folder with "costar" (the real-data guard flags the path, case-insensitive). The data-coverage page can say "CoStar" in its text: the route slug `legal/data-coverage` doesn't match the `data/` segment rule.

### Pitfall 7: The Settings page carries the Phase 1 CSP transition probe
**What goes wrong:** Rewriting `(app)/settings/+page.svelte` to the UI-SPEC copy can drop `data-testid="csp-transition-toggle"` / `csp-transition-target`, and then `csp.spec.ts` fails.
**How to avoid:** Keep the toggle button and the `transition:fade` paragraph. Restyle and re-word around them.

### Pitfall 8: pnpm 11 minimum-release-age and the exact Lucide version
**What goes wrong:** `pnpm add @lucide/svelte@1.52.0` (published 2026-10-04) made pnpm 11.27 **write a `minimumReleaseAgeExclude` entry into `pnpm-workspace.yaml`**. That is an unplanned config change.
**How to avoid:** Pin `@lucide/svelte@1.45.0` (published 2026-09-11, the version in the stack doc and UI-SPEC). Afterwards, check that `git diff pnpm-workspace.yaml` is empty.

### Pitfall 9: Lucide barrel import compiles about 1,900 components
**What goes wrong:** `import { ArrowRight } from '@lucide/svelte'` tree-shakes correctly in the output, but the build ran 1,878 `vite-plugin-svelte:compile` transforms, which slows builds and dev.
**How to avoid:** Use deep imports, `import ArrowRight from '@lucide/svelte/icons/arrow-right'` (exported via `./icons/*` in 1.45.0, verified).

### Pitfall 10: Hydration races in disclosure E2E
**What goes wrong:** Clicking the Menu button before hydration does nothing on the prerendered page, so the test flakes.
**How to avoid:** Set `data-hydrated` in `onMount` and `await expect(page.locator('nav[data-hydrated]')).toBeAttached()` before interacting (used in the spike, 0 flakes).

### Pitfall 11: `__BUILD_YEAR__` in a `.svelte` file fails ESLint `no-undef`
**Why:** typescript-eslint disables `no-undef` only for TS files. `.svelte` files still get `js.configs.recommended`'s `no-undef`.
**How to avoid:** Read the define only inside `$lib/build-info.ts` and import the constant.

### Pitfall 12: Axe can't judge contrast over the hero gradient
**What goes wrong:** Axe puts text over `background-image` gradients in `incomplete` (needs review), not in `passes` or `violations`. A green axe run therefore says nothing about hero text contrast. (MEDIUM: known axe behaviour, not reproduced in the spike because the spike had no gradient.)
**How to avoid:** Rely on the token-level test. The UI-SPEC already computes hero text against both gradient tints (accent-surface and secondary-surface columns). Optionally log `results.incomplete` for `color-contrast` in the a11y spec so reviewers can see it.

### Pitfall 13: Route lists drift between specs and the oracle
**What goes wrong:** Phase 1 has four copies of `ROUTES` plus `EXPECTED_PAGES`. A page missing from one list escapes axe, CSP or the 375px check.
**How to avoid:** Use one `tests/e2e/routes.ts`, plus a drift guard test. It walks `apps/web/build` (root project) or `apps/web/build-sub` (sub project) for `**/index.html` and asserts the set equals `ROUTES`. Add the 7 new pages to `EXPECTED_PAGES` in `assert-csp.mjs`. The `assert-csp.test.ts` count `2 + EXPECTED_PAGES.length` adjusts automatically.

### Pitfall 14: Global pnpm and corepack
Always run `corepack pnpm …`. The machine-global pnpm is 11.0.9 and refuses to run under corepack (Phase 1 deviation). Prettier will reflow any hand-written `package.json` and config files, so run `corepack pnpm format` before `lint`.

## Code Examples

### No-third-party requests plus fonts actually loaded (VERIFIED in spike on both bases)
```ts
test('every route makes only same-origin requests and loads both brand fonts', async ({ page }) => {
	const requests: string[] = [];
	page.on('request', (r) => requests.push(r.url()));
	for (const route of ROUTES) {
		await page.goto(route);
		await page.evaluate(() => document.fonts.ready);
	}
	const origin = new URL(page.url()).origin;
	expect(requests.length).toBeGreaterThan(ROUTES.length); // non-vacuity
	for (const u of requests) expect(new URL(u).origin, u).toBe(origin);
	const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
	expect(loaded).toEqual(expect.arrayContaining(['Inter Variable', 'Fraunces Variable']));
});
```
Non-vacuity control: CSP-blocked requests never reach the network, so they don't fire `request` events. The control therefore runs in its own test with `test.use({ bypassCSP: true })`. It injects `new Image().src = 'http://127.0.0.1:4275/x.png'` (the attacker port, a different origin) and asserts that the same origin filter reports it. The main tests keep the CSP on, and `csp.spec.ts` already proves zero violations.

### 375px overflow and the 640px switch (VERIFIED)
```ts
test.describe('375px', () => {
	test.use({ viewport: { width: 375, height: 812 } });
	for (const route of [...ROUTES, NOT_FOUND]) test(`no horizontal scroll on ${JSON.stringify(route)}`, async ({ page }) => {
		await page.goto(route);
		await expect(page.locator('h1')).toBeVisible();
		const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
		expect(overflow).toBeLessThanOrEqual(0);
		if (route !== PRINT) {
			await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
			await expect(page.getByRole('navigation', { name: 'Portals' }).locator('ul:not(#portal-menu)')).toBeHidden();
		}
	});
	test('overflow detector catches a planted wide element (non-vacuity)', async ({ page }) => {
		await page.goto('');
		await page.evaluate(() => { const d = document.createElement('div'); d.setAttribute('style', 'width:1000px;height:1px'); document.body.append(d); });
		expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeGreaterThan(0);
	});
});
```
Also run the overflow check with the menu **open** at 375, and on a legal page with a long URL (`overflow-wrap: anywhere`).

### WCAG 1.4.12 text spacing under the strict CSP (VERIFIED: `addStyleTag` is blocked, this works)
```ts
await page.evaluate(() => {
	const s = new CSSStyleSheet();
	s.replaceSync('*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}');
	document.adoptedStyleSheets = [...document.adoptedStyleSheets, s];
});
// then re-run the overflow check and assert headings/CTAs are still visible
```

### Raw-HTML aria-current check (pre-hydration truth)
```ts
const html = await (await page.request.get('renter/')).text();
expect(html).toMatch(/<a[^>]*href="\.\.\/renter\/"[^>]*aria-current="page"/);
```

### Footer legal links reachable from every page
```ts
for (const route of ROUTES.filter((r) => r !== PRINT)) {
	await page.goto(route);
	const footer = page.getByRole('contentinfo');
	for (const name of ['Privacy', 'Terms', 'Fair Housing', 'Data coverage']) {
		const href = await footer.getByRole('link', { name, exact: true }).getAttribute('href');
		const res = await page.request.get(new URL(href!, page.url()).href);
		expect(res.status(), `${name} from ${route}`).toBe(200);
	}
	await expect(footer).toContainText('Equal Housing Opportunity');
	await expect(footer).toContainText(/© \d{4} Tran Real Estate Tools/);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` theme | CSS-first `@theme` plus `--color-*: initial` reset | Tailwind v4.0 | Tokens are CSS variables and utilities in one place. Only vars that are used get emitted. |
| `$state` + `$effect` to sync derived-but-overridable state | Writable `$derived` | Svelte 5.25 | ESLint `svelte/prefer-writable-derived` (eslint-plugin-svelte 3.23) flags the old pattern as an error |
| `window.matchMedia` in `onMount` | `svelte/reactivity` `MediaQuery` | Svelte 5.7 | SSR fallback built in |
| `lucide-svelte` | `@lucide/svelte` (Svelte 5 package) | 2025 | Deep imports via `./icons/*` |
| WCAG 2.0 sRGB threshold 0.03928 | 0.04045 (WCAG 2.2 text) | WCAG 2.2 | No numeric difference for 8-bit colors |

## Open Questions

1. **Fraunces opsz axis.** The UI-SPEC says "wght entry only" and also "`font-optical-sizing: auto`". The wght build has no opsz axis, so the latter does nothing. Recommendation: keep the wght entry (36 KB vs 67 KB latin) and keep the declaration (harmless). Revisit only if headings look wrong at 40px.
2. **Token names that collide with Tailwind built-ins** (`--container-prose`, `--duration-*`). Recommendation: rename to `--container-reading`, and drop the `--duration-*` tokens from `@theme` in favour of `duration-150`/`duration-200`. Keep those values in `@tran/brand` as `motion` constants for Phase 11 if wanted. Neither belongs to the parity-tested groups (`color|font|radius`).
3. **Nav landmark wraps the wordmark** (Pattern 4). Recommendation: accept it, since one Portals landmark at every width is verified. The alternative is a CSS-grid overlap with `pointer-events` juggling.
4. **OFL-1.1 notice.** The Fontsource woff2 files normally carry copyright and license in their name tables. Strict OFL compliance could also ship the license text. Recommendation (LOW priority): copy both packages' `LICENSE` files to `static/licenses/` and link them from the Terms page. The cost is 2 files.
5. **Banned-terms scope.** The UI-SPEC lists marketing, layout and legal component dirs. Recommendation: scan all of `apps/web/src/routes/**`, `lib/components/**` and `lib/content/**`, excluding tests. The `(app)` placeholders and `+error.svelte` carry copy too, and later phases' fair-housing phrase lists (`lib/ai/**`, `lib/features/**`) stay out of scope, so there is no allowlist pressure.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.11 (projects `web`, `core`, `scripts`, plus **new `brand`**), Playwright 1.63.0 + @axe-core/playwright 4.13.0 (projects `root`, `sub`), Node oracle `scripts/assert-csp.mjs`, new `scripts/banned-terms.mjs` |
| Config files | `vitest.config.ts` (add `'packages/brand'` to `projects`), `packages/brand/vitest.config.ts` (new), `apps/web/vite.config.ts` (add `build.assetsInlineLimit: 0`), `apps/web/playwright.config.ts` (unchanged) |
| Quick run command | `corepack pnpm lint && corepack pnpm test:unit && corepack pnpm banned` (about 30 s) |
| E2E run (needs builds) | `corepack pnpm build:root && corepack pnpm build:sub && corepack pnpm csp:assert && corepack pnpm test:e2e` |
| Full suite command | `corepack pnpm verify` (now including `pnpm banned`), plus `corepack pnpm lint:workflows` |

### Phase Requirements to Test Map
| Req / Criterion | Behavior | Test Type | File and command | How it can fail (non-vacuity) | Exists? |
|---|---|---|---|---|---|
| BRND-03 (tokens) | Every text/UI token pair meets 4.5/3, and deco/border tokens are never text or UI | unit | `packages/brand/src/contrast.test.ts`, `corepack pnpm vitest run --project brand` | Planted `deco-terracotta` on `background` as text must be rejected. 21:1 black/white anchor. | ❌ Wave 0 |
| BRND-01/03 (token parity) | `app.css @theme` equals `@tran/brand` for `--color/--font/--radius`, and the palette is reset | unit | `apps/web/src/lib/brand/theme-parity.test.ts`, `corepack pnpm vitest run --project web` | Mutated-hex copy of app.css must mismatch. Non-empty `@theme` guard. | ❌ Wave 0 |
| BRND-01 (self-hosted, no data:) | Built CSS/HTML contain no `data:` URIs, and all 14 expected pages exist | build oracle | extend `scripts/assert-csp.mjs` + `scripts/assert-csp.test.ts`, `corepack pnpm csp:assert` | Unit test feeds CSS containing `url(data:font/woff2;base64,AA)` and expects an error | ❌ extend |
| BRND-01 (no third-party, fonts load) | All requests on every route are same-origin, and Inter plus Fraunces are `loaded` | E2E | `tests/e2e/layout.spec.ts`, `corepack pnpm test:e2e` | `bypassCSP` control: a cross-port image must be flagged | ❌ Wave 0 |
| BRND-01 (landing routes to portals) | Landing h1, 3 portal cards linking to `/for-*/`, header links to `/renter/ /investor/ /agent/` | E2E | `tests/e2e/marketing.spec.ts` | Asserts exact hrefs resolve to 200 pages with the expected h1 | ❌ Wave 0 |
| BRND-02 (audience pages) | Each `/for-*/` has its h1, "Open {x} portal" and "Try sample data" pointing at the portal, and a "Good to know" section | E2E | `tests/e2e/marketing.spec.ts` | Wrong href or missing CTA fails | ❌ Wave 0 |
| BRND-02/04 (copy compliance) | No banned term in source copy | script + unit | `scripts/banned-terms.mjs`, `scripts/banned-terms.test.ts`, `corepack pnpm banned` | Temp-dir fixture with "guaranteed returns" makes the CLI exit 1. A multi-line "best\n\tinvestment" hit. Scope count > 0 and includes `SiteFooter.svelte`. | ❌ Wave 0 |
| BRND-02/04 (rendered copy, optional) | Rendered `body.innerText` of every route passes `findBanned` | E2E | `tests/e2e/marketing.spec.ts` (imports `scripts/lib/banned-terms-rules.mjs`) | Catches copy coming from anywhere, not just scanned dirs | ❌ optional |
| BRND-03 (axe) | Zero WCAG 2.0/2.1/2.2 A/AA violations on all 14 routes plus the 404, at 1280 and 375, and with the menu open | E2E | `tests/e2e/a11y.spec.ts` (route list from `routes.ts`) | Existing `passes.length > 0` guard | ✅ extend |
| BRND-03 (375px) | `scrollWidth - innerWidth <= 0` on every route, menu open and closed, plus text-spacing overrides | E2E | `tests/e2e/layout.spec.ts` | Planted 1000px div must be detected | ❌ Wave 0 |
| BRND-03/05 (640 switch) | At 375 the button is visible and the inline list hidden; at 640 the reverse; resize closes the open menu | E2E | `tests/e2e/layout.spec.ts` | Verified pattern in spike | ❌ Wave 0 |
| BRND-05 (switcher everywhere) | Exactly one banner, one `navigation "Portals"`, one main and one contentinfo on every route except print (print: 0/0/1/0); `aria-current` present in **raw prerendered HTML** for app pages | E2E | `tests/e2e/layout.spec.ts` | Raw-HTML check fails under the `pathname === resolve()` bug (Pitfall 1) | ❌ Wave 0 |
| BRND-05 (disclosure keyboard) | Enter/Space toggles, Escape closes and refocuses the button, link click navigates and closes | E2E | `tests/e2e/layout.spec.ts` | Waits on `nav[data-hydrated]` | ❌ Wave 0 |
| BRND-04 (legal reachable) | Footer on every non-print route has the 4 legal links, each returning 200; EHO line; © year; Terms contains the verbatim "not a real estate brokerage … investment, legal, or tax advice" sentence | E2E | `tests/e2e/layout.spec.ts`, `tests/e2e/marketing.spec.ts` | Missing route gives a non-200 | ❌ Wave 0 |
| Regression (Phase 1) | Routing (same-origin filter added), CSP, framing, workflow gate (+ banned step) | E2E + unit | existing specs, `scripts/workflow-gate.test.ts` | Deleting the hygiene banned step must turn the gate test red | ✅ modify |
| Drift guard | `ROUTES` equals the build's `**/index.html` set; `EXPECTED_PAGES` includes the new pages | E2E + unit | `tests/e2e/routes-drift.spec.ts` (reads `apps/web/build` or `build-sub` by project) | Adding a page without listing it fails | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `corepack pnpm lint && corepack pnpm test:unit && corepack pnpm banned`. The pre-commit hook (gitleaks staged plus real-data guard) runs automatically.
- **Per wave merge:** `corepack pnpm verify`. This covers both builds, the CSP oracle and E2E on both bases.
- **Phase gate:** full `corepack pnpm verify` plus `corepack pnpm lint:workflows` green before `/gsd:verify-work`. Manual UAT at a real 375px device or emulator is optional (visual polish only).

### Wave 0 Gaps
- [ ] `packages/brand/vitest.config.ts` plus `vitest` devDep, and `'packages/brand'` added to the root `vitest.config.ts` projects
- [ ] `apps/web` devDeps: the two fonts, `@lucide/svelte@1.45.0`, `@tran/brand@workspace:*` (lockfile committed, `pnpm-workspace.yaml` unchanged)
- [ ] `apps/web/tests/e2e/routes.ts` (shared list: `''`, `for-renters/`, `for-investors/`, `for-agents/`, `legal/privacy/`, `legal/terms/`, `legal/fair-housing/`, `legal/data-coverage/`, `renter/`, `investor/`, `agent/`, `settings/`, `print/`), with existing specs refactored to import it
- [ ] `scripts/lib/banned-terms-rules.mjs`, `scripts/banned-terms.mjs`, `scripts/banned-terms.test.ts`
- [ ] `apps/web/tests/e2e/layout.spec.ts`, `marketing.spec.ts`, `routes-drift.spec.ts`
- [ ] Stub pages for all 7 new routes, created in the same plan as the footer (Pitfall 2)

### Suggested plan ordering (for the planner; fine granularity)
1. **Wave 1, parallel:**
   - (a) Brand tokens, contrast and parity tests, `app.css @theme`, fonts, `assetsInlineLimit`, `data:` oracle check.
   - (b) Banned-terms rules, CLI, tests, `verify` and CI hygiene step, workflow-gate assertion.
2. **Wave 2:** Layout restructure: SkipLink, SiteHeader/PortalSwitcher, SiteFooter, ButtonLink, error page, placeholder restyle keeping the CSP probe, **stubs for all 7 routes**, shared `routes.ts`, routing-spec same-origin fix, `EXPECTED_PAGES`.
3. **Wave 3, parallel:**
   - Landing (PortalCard, marks, HowItWorks, TrustStrip).
   - Audience template and content.
   - Legal pages and LegalPage.
4. **Wave 4:** `layout.spec.ts` and `marketing.spec.ts`, axe at 375 and menu-open, drift guard, full `verify`.

## Sources

### Primary (HIGH confidence, executed in this repo on 2026-10-04)
- Spike worktree of this repo at `d300953`: installed the fonts and Lucide, built `build/` and `build-sub/`, ran `assert-csp.mjs` on both (7 pages pass), ran the full existing E2E suite plus spike specs (all green, both projects), and ran `svelte-check` (0/0) and `eslint` on the disclosure component.
- `node_modules/@fontsource-variable/{fraunces,inter}@5.3.0`: `index.css` = `wght.css`, `@font-face` counts, file sizes, package `exports`.
- `@sveltejs/kit@2.70.3` `src/exports/vite/index.js`: `assetsInlineLimit` forwarded to the client build.
- `svelte@5.57.0` `src/reactivity/media-query.js`: `MediaQuery(query, fallback)`.
- `tailwindcss@4.3.3` `preflight.css`: `[hidden]:where(:not([hidden='until-found'])) { display: none !important }`.
- Tailwind emitted CSS: namespace behaviour of `--container-*`, `--duration-*`, `--shadow-*`, `--ease-*`, `fill-*`/`stroke-*`, and var-usage detection in component `<style>`.
- npm registry (`npm view`): fraunces/inter 5.3.0 latest (OFL-1.1). @lucide/svelte latest 1.52.0 (2026-10-04), 1.45.0 (2026-09-11) with the same exports and `svelte ^5` peer.
- Independent WCAG contrast recomputation: matches every UI-SPEC matrix value.

### Secondary (MEDIUM)
- Vite `define` for the build year (standard mechanism, not exercised in the spike).
- Axe treats text over background images as `incomplete` (well-known axe behaviour, not reproduced here).

### Tertiary (LOW)
- OFL redistribution notice expectations for web-served woff2 (Open Question 4).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Versions checked against the registry, and the packages were installed and built.
- Architecture (layouts, disclosure, tokens, fonts): HIGH. Executed under both bases with the existing gates.
- Banned-terms design: HIGH for the wiring (read `ci.yml` and `workflow-gate.test.ts`), MEDIUM for the exact regex list (the planner may extend it).
- Pitfalls: HIGH for 1-11 and 13-14 (reproduced), MEDIUM for 12.

**Research date:** 2026-10-04
**Valid until:** 2026-11-03 (stable pins; re-check `@lucide/svelte` only if the pin changes)
