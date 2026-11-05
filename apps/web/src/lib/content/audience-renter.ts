// /for-renters/ copy, in its own module so each audience page ships only its own content.
// Every string is scanned by the banned-terms gate.
import type { Audience } from './audiences';

export const renterAudience: Audience = {
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
};
