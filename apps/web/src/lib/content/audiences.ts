// Audience-page copy for /for-renters/, /for-investors/ and /for-agents/.
// Lives in $lib/content (never $lib/data) so marketing routes may import it.
// Every string is scanned by the banned-terms gate.

export type PortalId = 'renter' | 'investor' | 'agent';

export type FeatureIcon =
	| 'search'
	| 'bell'
	| 'scale'
	| 'message-square-text'
	| 'calculator'
	| 'columns-2'
	| 'target'
	| 'map-pin'
	| 'inbox'
	| 'list-checks'
	| 'pen-line'
	| 'file-text';

export interface Feature {
	icon: FeatureIcon;
	title: string;
	body: string;
}

export interface Audience {
	portal: PortalId;
	slug: 'for-renters' | 'for-investors' | 'for-agents';
	docTitle: string;
	description: string;
	eyebrow: string;
	title: string;
	lead: string;
	featuresHeading: string;
	features: readonly Feature[];
	limitsHeading: 'Good to know';
	limits: readonly string[];
	closingHeading: string;
	openLabel: string;
}

export const audiences: Record<PortalId, Audience> = {
	renter: {
		portal: 'renter',
		slug: 'for-renters',
		docTitle: 'For renters: Tran Real Estate Tools',
		description:
			'Renter tools: search rentals in any US city or ZIP, track new listings, and compare asking rent to the local market.',
		eyebrow: 'For renters',
		title: 'Find rentals that fit, without refreshing all day',
		lead: "Tell Tran where you want to live and what you can spend. Your saved searches show what's new each time you come back, so you don't have to keep checking.",
		featuresHeading: 'What the renter portal does',
		features: [
			{
				icon: 'search',
				title: 'Search any US city or ZIP',
				body: 'Filter by rent, bedrooms, property type, and how recently a place was listed.'
			},
			{
				icon: 'bell',
				title: "See what's new since your last visit",
				body: 'Saved searches show a count of new listings, so you open the app to answers instead of a blank search box.'
			},
			{
				icon: 'scale',
				title: 'Compare rent to the local market',
				body: "See how an asking rent sits against the ZIP's typical rent for that bedroom count."
			},
			{
				icon: 'message-square-text',
				title: 'Draft an inquiry you review',
				body: 'Get a starting message to the listing contact about availability, pets, fees, and lease terms. You edit it and send it yourself.'
			}
		],
		limitsHeading: 'Good to know',
		limits: [
			"Listings come from RentCast, so some rentals won't appear, and there are no listing photos.",
			'Rent comparisons are estimates from public data, not a promise of what a landlord will accept.',
			"Tran doesn't contact landlords or apply on your behalf."
		],
		closingHeading: 'Start with the renter portal',
		openLabel: 'Open renter portal'
	},
	investor: {
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
	},
	agent: {
		portal: 'agent',
		slug: 'for-agents',
		docTitle: 'For agents: Tran Real Estate Tools',
		description:
			'Agent tools: a lead inbox, a pipeline with follow-ups, and Fair Housing-checked listing content.',
		eyebrow: 'For agents',
		title: 'Leads, follow-ups, and content in one place',
		lead: 'Run your pipeline, follow-ups, and listing content from one browser tab, with your license and brokerage disclosures added to what you export.',
		featuresHeading: 'What the agent portal does',
		features: [
			{
				icon: 'inbox',
				title: 'Collect leads',
				body: 'Publish an inquiry page that sends new leads to your inbox through your own Web3Forms key.'
			},
			{
				icon: 'list-checks',
				title: 'Work your pipeline',
				body: 'Move contacts from New to Closed and see which follow-ups are due today.'
			},
			{
				icon: 'pen-line',
				title: 'Draft listing content',
				body: 'Listing descriptions and social posts are checked for Fair Housing problem phrases before you copy them.'
			},
			{
				icon: 'file-text',
				title: 'Share a market snapshot',
				body: 'Print a branded ZIP-code report to PDF, clearly labeled as an informational snapshot.'
			}
		],
		limitsHeading: 'Good to know',
		limits: [
			'Your contacts and pipeline live in your browser. Back them up, because Tran has no server copy.',
			"Tran doesn't replace your brokerage's tools or compliance review.",
			'AI drafts are starting points. Nothing is sent automatically.'
		],
		closingHeading: 'Start with the agent portal',
		openLabel: 'Open agent portal'
	}
};
