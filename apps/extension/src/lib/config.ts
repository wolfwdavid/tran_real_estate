import raw from './selectors.v1.json';

export const TRAN_ORIGIN = 'https://tranrealestate.github.io';
export const PRIVACY_URL = `${TRAN_ORIGIN}/legal/privacy/#browser-extension`;
export const ZILLOW_MATCH = '*://*.zillow.com/*';
export const PILL_TAG = 'tran-slf-pill';

export type Category = 'sponsored' | 'promoted' | 'featured' | 'ad';
export type OptInCategory = 'showcase';

export interface FilterConfig {
	version: 1;
	observed: string;
	labels: Record<Category, readonly string[]>;
	optInLabels: Record<OptInCategory, readonly string[]>;
	resultsContainers: readonly string[];
	cardRoots: readonly string[];
	itemRoots: readonly string[];
	adSlots: readonly string[];
	badgeScopes: readonly string[];
}

/** Bundled detection hints. There is no remote config: fetching one would be a network request. */
export const CONFIG: FilterConfig = Object.freeze(raw as FilterConfig);

export const MAX_TEXT_LEN = 32;
export const MAX_ATTR_LEN = 48;
export const DEBOUNCE_MS = 150;
export const MAX_WAIT_MS = 600;
export const RETRY_MIN_MS = 250;
export const RETRY_MAX_MS = 4000;

/** NFKC, collapse whitespace, trim, strip trailing `·•:|-—` punctuation, lowercase. */
export function normalizeLabel(s: string): string {
	return s
		.normalize('NFKC')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/[\s·•:|\-—]+$/u, '')
		.trim()
		.toLowerCase();
}

/** True when the selector uses a `.class` part outside attribute brackets and quoted strings. */
export function hasClassSelector(selector: string): boolean {
	const stripped = selector.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"|'[^']*'/g, '');
	return /\.[A-Za-z_-]/.test(stripped);
}
