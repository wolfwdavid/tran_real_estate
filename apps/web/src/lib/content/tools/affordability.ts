// Copy for /tools/affordability/ (10-UI-SPEC "Copywriting Contract > Tool pages"). Imported only by
// that page, its calculator and the og card, so other pages never ship these strings.

import {
	OG_EYEBROW,
	OG_SUBLINE,
	PRIVACY_FAQ,
	TOOL_NAMES,
	docTitle,
	ogAlt,
	type ToolContent
} from './shared';

export const affordability: ToolContent = {
	slug: 'affordability',
	name: TOOL_NAMES['affordability'],
	h1: 'Rent affordability calculator',
	docTitle: docTitle('Rent affordability calculator'),
	description:
		'Free rent affordability calculator. Enter your income and monthly debts to see a rent range that fits. Runs in your browser.',
	lead: 'See how much rent fits your income and monthly debts, using common rules of thumb.',
	// Inputs, result, empty state and announcement belong to the Phase 6 component (UI-SPEC [C6]).
	fields: [],
	rows: [],
	// Copied from packages/core/src/renter/affordability.ts (affordability, landlordIncome,
	// moveInCash), which the embedded component calls. Change both together.
	formula: [
		{ term: 'Monthly income', def: 'Your gross monthly income, or your yearly income ÷ 12' },
		{ term: 'Low end of the range', def: '25% of monthly income, rounded to the nearest $25' },
		{
			term: 'Top of the range',
			def: 'The smaller of 30% of monthly income and (40% of monthly income − monthly debts), rounded to the nearest $25'
		},
		{ term: 'Income landlords look for', def: 'About 40 × the monthly rent, per year' },
		{
			term: 'Move-in cash',
			def: 'About 2 × the monthly rent: the first month plus a one-month deposit'
		}
	],
	faq: [
		{
			q: 'What is the 30% rule?',
			a: "A common guideline is to spend no more than about 30% of your gross monthly income, before taxes, on rent. It's a starting point, not a rule landlords must follow."
		},
		{
			q: 'Do landlords have income requirements?',
			a: 'Many do, often asking for monthly income of about three times the rent. Requirements vary, so check each listing.'
		},
		{
			q: 'Why count monthly debts?',
			a: 'Car loans, student loans, and card minimums come out of the same income. Counting them shows how much room is left for rent.'
		},
		{
			q: 'What about move-in costs?',
			a: "Many rentals ask for a security deposit and the first month's rent up front, and some charge application fees. Keep that in mind when you compare your savings with a rent."
		},
		PRIVACY_FAQ
	],
	goFurther: {
		heading: 'Find rentals that fit',
		body: "The renter portal searches rentals in any US city or ZIP code and shows what's new each time you come back.",
		primary: { label: 'Open the renter portal', path: '/renter/' },
		sample: { label: 'Try sample data', path: '/renter/', query: '?source=sample' }
	},
	og: {
		eyebrow: OG_EYEBROW,
		titleLines: ['Rent affordability', 'calculator'],
		subline: OG_SUBLINE,
		mark: 'renter'
	},
	ogAlt: ogAlt('Rent affordability calculator')
};
