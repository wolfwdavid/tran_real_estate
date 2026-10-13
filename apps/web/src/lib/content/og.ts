// The default share card and the type every share card uses. Kept apart from the tool copy:
// SeoHead runs on every marketing page and must not pull the calculator strings in with it.

/** Share-card content (rendered by lib/seo/og-card.server.ts; the type is defined once, here). */
export interface OgCard {
	eyebrow: string;
	titleLines: readonly string[];
	subline: string;
	mark: 'renter' | 'investor' | null;
}

export const DEFAULT_OG: OgCard = {
	eyebrow: 'FOR RENTERS, INVESTORS, AND AGENTS',
	titleLines: ['Real estate tools that', 'do the refreshing for you'],
	subline: 'Listing data from RentCast. Your own API keys. No Tran server.',
	mark: null
};

export const DEFAULT_OG_ALT =
	'Tran Real Estate Tools: real estate tools for renters, investors, and agents.';
