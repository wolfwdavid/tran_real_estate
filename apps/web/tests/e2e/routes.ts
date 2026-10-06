// Single source of truth for every prerendered page. routes-drift.spec.ts fails if the build
// gains or loses an index.html that is not listed here.
export const MARKETING_ROUTES = ['', 'for-renters/', 'for-investors/', 'for-agents/'] as const;
export const LEGAL_ROUTES = [
	'legal/privacy/',
	'legal/terms/',
	'legal/fair-housing/',
	'legal/data-coverage/'
] as const;
/** The renter portal (Phase 6): Search, the ?id= listing detail shell, Shortlist and Affordability. */
export const RENTER_ROUTES = [
	'renter/',
	'renter/listing/',
	'renter/shortlist/',
	'renter/affordability/'
] as const;
export const APP_ROUTES = [...RENTER_ROUTES, 'investor/', 'agent/', 'settings/'] as const;
/**
 * The investor portal's sub-pages (Phase 7). `investor/` itself stays in APP_ROUTES. Compare, memo
 * and market take query params read in onMount (?ids=, ?id=, ?zip=), so they are prerendered
 * shells listed in svelte.config.js prerender.entries.
 */
export const INVESTOR_ROUTES = [
	'investor/analyze/',
	'investor/deals/',
	'investor/compare/',
	'investor/memo/',
	'investor/buy-boxes/',
	'investor/markets/',
	'investor/market/'
] as const;
/** Every page rendered by the (app) layout: the portals, their sub-pages and Settings. */
export const PORTAL_ROUTES: readonly string[] = [...APP_ROUTES, ...INVESTOR_ROUTES];
export const PRINT = 'print/';
/** The chrome-free `(print)` surfaces: no header, portal switcher or footer. */
export const PRINT_ROUTES = [PRINT, 'print/memo/'] as const;
export const isPrintRoute = (r: string): boolean => r.startsWith('print/');
export const ROUTES: readonly string[] = [
	...MARKETING_ROUTES,
	...LEGAL_ROUTES,
	...APP_ROUTES,
	...INVESTOR_ROUTES,
	...PRINT_ROUTES
];
/** Every route that renders the site header and footer (all but the chrome-free print surfaces). */
export const CHROME_ROUTES: readonly string[] = ROUTES.filter((r) => !isPrintRoute(r));
export const NOT_FOUND = 'does-not-exist/deeper/';
/** The only off-site hosts any page may link to (legal pages 02-08, Settings "Get a key" links 03-11). */
export const EXTERNAL_HOSTS: readonly string[] = [
	'www.hud.gov',
	'www.rentcast.io',
	'www.anthropic.com',
	'openai.com',
	'policies.google.com',
	'openrouter.ai',
	'web3forms.com',
	// Provider key consoles (PROVIDERS[].keyUrl in packages/core/src/providers.ts).
	'app.rentcast.io',
	'platform.claude.com',
	'platform.openai.com',
	'aistudio.google.com',
	// Renter portal (Phase 6): OSM map attribution and "Report a map problem", plus the listing
	// detail's "Look it up elsewhere" links.
	'www.openstreetmap.org',
	'www.google.com',
	'www.zillow.com'
];
