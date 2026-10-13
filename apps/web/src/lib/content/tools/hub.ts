// Copy for the /tools/ hub only (cards and head). Kept out of ./shared so the calculator pages
// do not ship it.

import { OG_EYEBROW, OG_SUBLINE, type ToolSlug } from './meta';
import type { OgCard, ToolCardContent } from './shared';

/** The /tools/ hub cards (UI-SPEC "ToolCard"). */
export const TOOL_CARDS: Readonly<Record<ToolSlug, ToolCardContent>> = {
	affordability: {
		title: 'Rent affordability',
		body: 'See how much rent fits your income and monthly debts.',
		icon: 'wallet'
	},
	'cap-rate': {
		title: 'Cap rate',
		body: "Net operating income as a share of a property's price.",
		icon: 'percent'
	},
	'cash-on-cash': {
		title: 'Cash-on-cash return',
		body: 'What the cash you put into a rental earns in a year.',
		icon: 'banknote'
	},
	dscr: {
		title: 'DSCR',
		body: "Whether a property's income covers its loan payments.",
		icon: 'landmark'
	}
};

export const TOOLS_HUB = {
	h1: 'Free real estate calculators',
	docTitle: 'Free real estate calculators: Tran Real Estate Tools',
	description:
		'Free rent affordability, cap rate, cash-on-cash return, and DSCR calculators. They run in your browser with no sign-up.',
	lead: 'Quick math for renters and investors. No sign-up, no API key, and nothing leaves your browser.',
	og: {
		eyebrow: OG_EYEBROW,
		titleLines: ['Free real estate', 'calculators'],
		subline: OG_SUBLINE,
		mark: 'investor'
	},
	ogAlt: 'Free real estate calculators. Free calculator from Tran Real Estate Tools.'
} as const satisfies {
	h1: string;
	docTitle: string;
	description: string;
	lead: string;
	og: OgCard;
	ogAlt: string;
};
