// /for-investors/ copy, in its own module so each audience page ships only its own content.
// Every string is scanned by the banned-terms gate.
import type { Audience } from './audiences';

export const investorAudience: Audience = {
	portal: 'investor',
	slug: 'for-investors',
	docTitle: 'For investors: Tran Real Estate Tools',
	description:
		'Investor tools: deal analysis with NOI, cap rate, cash-on-cash, and DSCR, saved deals, and market dashboards.',
	eyebrow: 'For investors',
	title: 'Run the numbers before you spend a weekend on a listing',
	lead: "Enter a property's numbers, or autofill rent and value estimates after you see what the lookup costs, and get NOI, cap rate, cash-on-cash return, DSCR, and the 1% rule in one view.",
	featuresHeading: 'What the investor portal does',
	features: [
		{
			icon: 'calculator',
			title: 'Analyze a deal',
			body: 'Edit every expense line. Manual entry uses no API calls at all.'
		},
		{
			icon: 'columns-2',
			title: 'Save and compare deals',
			body: 'Keep analyzed properties and compare them side by side.'
		},
		{
			icon: 'target',
			title: 'Watch your buy box',
			body: 'Saved searches over for-sale listings show new matches with quick metrics.'
		},
		{
			icon: 'map-pin',
			title: 'Track up to five ZIP codes',
			body: 'Rent trends and price-to-rent figures for the markets you follow.'
		}
	],
	limitsHeading: 'Good to know',
	limits: [
		"The analyzer does arithmetic on the numbers you give it. It is not investment advice, and it can't tell you whether to buy.",
		'Value and rent estimates are automated estimates from RentCast, not professional valuations.',
		'Your free RentCast plan has a monthly call limit, and Tran shows the cost of a lookup before it runs.'
	],
	closingHeading: 'Start with the investor portal',
	openLabel: 'Open investor portal'
};
