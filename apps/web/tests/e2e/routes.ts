// Single source of truth for every prerendered page. routes-drift.spec.ts fails if the build
// gains or loses an index.html that is not listed here.
export const MARKETING_ROUTES = ['', 'for-renters/', 'for-investors/', 'for-agents/'] as const;
export const LEGAL_ROUTES = [
	'legal/privacy/',
	'legal/terms/',
	'legal/fair-housing/',
	'legal/data-coverage/'
] as const;
export const APP_ROUTES = ['renter/', 'investor/', 'agent/', 'settings/'] as const;
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
/** The only off-site hosts any page may link to (legal pages, 02-08). */
export const EXTERNAL_HOSTS: readonly string[] = [
	'www.hud.gov',
	'www.rentcast.io',
	'www.anthropic.com',
	'openai.com',
	'policies.google.com',
	'openrouter.ai',
	'web3forms.com'
];
