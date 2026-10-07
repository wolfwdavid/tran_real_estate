// Sample listing facts for "Fill with sample facts" (09-UI-SPEC "Listing description").
// Synthetic only: a fictional street and park, round made-up figures. The keyless Fixture draft
// built from these facts (studio/listing.v1 sample()) passes every check with zero findings
// (listing-count.test.ts re-asserts it). Fireplace is deliberately not a feature, so the E2E can
// plant "A fireplace." as an unsupported-feature Review finding.
import type { ListingFacts } from '@tran/core/studio';

export const SAMPLE_LISTING_FACTS: Readonly<ListingFacts> = Object.freeze({
	listingType: 'sale',
	propertyType: 'Single family',
	bedrooms: 3,
	bathrooms: 2,
	squareFeet: 1650,
	yearBuilt: 1994,
	lotSize: '0.25 acre',
	garageSpaces: 2,
	price: 425000,
	streetOrArea: '12 Example Lane',
	features: ['Updated kitchen', 'Hardwood floors', 'Central air', 'Private outdoor space'],
	otherFeatures: 'Covered back porch',
	nearby: ['Parks', 'Shops', 'Public transit'],
	nearbyPlaces: 'Example Creek Park',
	tone: 'warm',
	length: 'medium'
} satisfies ListingFacts);
