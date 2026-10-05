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
export const PRINT = 'print/';
export const ROUTES: readonly string[] = [
	...MARKETING_ROUTES,
	...LEGAL_ROUTES,
	...APP_ROUTES,
	PRINT
];
/** Every route that renders the site header and footer (all but the chrome-free print surface). */
export const CHROME_ROUTES: readonly string[] = ROUTES.filter((r) => r !== PRINT);
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
