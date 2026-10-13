// Single source of truth for every prerendered page. routes-drift.spec.ts fails if the build
// gains or loses an index.html that is not listed here.
/** The free calculator pages (Phase 10, GTM-03): the hub and one page per tool. */
export const TOOL_ROUTES = [
	'tools/',
	'tools/cap-rate/',
	'tools/cash-on-cash/',
	'tools/dscr/'
] as const;
export const MARKETING_ROUTES = [
	'',
	'for-renters/',
	'for-investors/',
	'for-agents/',
	...TOOL_ROUTES
] as const;
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
/**
 * The agent portal's sub-pages (Phase 8). `agent/` itself stays in APP_ROUTES. The contact detail
 * reads ?id= in onMount, so it is a prerendered shell listed in svelte.config.js prerender.entries.
 */
export const AGENT_ROUTES = [
	'agent/today/',
	'agent/pipeline/',
	'agent/contacts/',
	'agent/contact/',
	'agent/import/',
	'agent/profile/'
] as const;
/**
 * The agent Studio (Phase 9): the hub and its four tools, all rendered by the (app) agent layout.
 * Kept apart from AGENT_ROUTES (the CRM pages), which the Phase 8 CRM specs walk.
 */
export const STUDIO_ROUTES = [
	'agent/studio/',
	'agent/studio/listing/',
	'agent/studio/social/',
	'agent/studio/reel/',
	'agent/studio/snapshot/'
] as const;
/**
 * The chrome-free `(public)` pages seen by an agent's leads (08-13): their own header and footer,
 * no site header, portal switcher or agent nav. The inquiry page reads its query in onMount.
 */
export const PUBLIC_ROUTES = ['agent/inquire/'] as const;
export const isPublicRoute = (r: string): boolean =>
	(PUBLIC_ROUTES as readonly string[]).includes(r);
/** Every page rendered by the (app) layout: the portals, their sub-pages and Settings. */
export const PORTAL_ROUTES: readonly string[] = [
	...APP_ROUTES,
	...INVESTOR_ROUTES,
	...AGENT_ROUTES,
	...STUDIO_ROUTES
];
export const PRINT = 'print/';
/** The Market Snapshot printout (Phase 9): reads ?id= in onMount; linked as ?id=sample from the hub. */
export const PRINT_SNAPSHOT = 'print/snapshot/';
/** The chrome-free `(print)` surfaces: no header, portal switcher or footer. */
export const PRINT_ROUTES = [PRINT, 'print/memo/', PRINT_SNAPSHOT] as const;
export const isPrintRoute = (r: string): boolean => r.startsWith('print/');
export const ROUTES: readonly string[] = [
	...MARKETING_ROUTES,
	...LEGAL_ROUTES,
	...APP_ROUTES,
	...INVESTOR_ROUTES,
	...AGENT_ROUTES,
	...STUDIO_ROUTES,
	...PUBLIC_ROUTES,
	...PRINT_ROUTES
];
/** Every route that renders the site header and footer (all but the chrome-free print and public pages). */
export const CHROME_ROUTES: readonly string[] = ROUTES.filter(
	(r) => !isPrintRoute(r) && !isPublicRoute(r)
);
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
