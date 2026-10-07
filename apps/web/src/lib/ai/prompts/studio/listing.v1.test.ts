import { describe, expect, it } from 'vitest';
import { checkFairHousing } from '@tran/core/fair-housing';
import { pickListingFacts, type ListingFacts } from '@tran/core/studio';
import { runChecks } from '$lib/ai/ui/panel-controller';
import {
	listingAllowedNumbers,
	numberPostCheck,
	numberWordsPostCheck,
	unsupportedFeaturePostCheck
} from '$lib/features/studio/post-checks';
import { HOUSING_COPY_GUARDRAIL } from '../guardrail.js';
import { buildPrompt, getPrompt } from '../registry.js';
import {
	STUDIO_LISTING_PROMPT_ID,
	STUDIO_LISTING_SYSTEM,
	renderListingUser,
	sampleListing,
	studioListingV1
} from './listing.v1.js';

const BASE: ListingFacts = {
	listingType: 'sale',
	propertyType: 'Single family',
	bedrooms: 3,
	bathrooms: 2.5,
	squareFeet: 1450,
	yearBuilt: 1987,
	garageSpaces: 2,
	price: 489000,
	streetOrArea: '18 Example Lane',
	features: ['Hardwood floors', 'Central air', 'Fireplace', 'Updated kitchen'],
	otherFeatures: '2 skylights',
	nearby: ['Public transit', 'Parks'],
	nearbyPlaces: 'Example Creek Trailhead',
	tone: 'warm',
	length: 'medium'
};

/** Each tone x short/long, with and without price, with and without the optional numbers. */
const FIXTURES: ListingFacts[] = [
	{ ...BASE, tone: 'warm', length: 'short' },
	{
		listingType: 'rent',
		propertyType: 'Condo',
		bedrooms: 1,
		bathrooms: 1,
		features: ['In-unit laundry', 'Walk-in closets'],
		nearby: ['Shops', 'Restaurants and cafes'],
		price: 2450,
		tone: 'warm',
		length: 'long'
	},
	{ ...BASE, propertyType: 'Townhouse', price: undefined, tone: 'concise', length: 'short' },
	{
		listingType: 'sale',
		propertyType: 'Manufactured',
		bedrooms: 0,
		bathrooms: 1,
		features: [],
		nearby: [],
		tone: 'concise',
		length: 'long'
	},
	{
		...BASE,
		propertyType: 'Multi-family',
		features: ['Primary suite', 'Home office', 'Pool', 'Step-free entry', 'Garage'],
		nearby: ['Waterfront', 'Bike lanes'],
		price: 1250000,
		tone: 'luxury',
		length: 'short'
	},
	{
		listingType: 'rent',
		propertyType: 'Single family',
		bedrooms: 4,
		bathrooms: 3,
		features: ['Private outdoor space', 'Solar panels', 'Extra storage', 'Off-street parking'],
		nearby: ['Grocery store', 'Commuting routes', 'Trails'],
		tone: 'luxury',
		length: 'long'
	}
];

describe('studio/listing.v1 prompt', () => {
	it('is registered with the studio id, no client data and the guardrail', async () => {
		const def = getPrompt('studio/listing.v1');
		expect(def).toBe(studioListingV1);
		expect(def.id).toBe(STUDIO_LISTING_PROMPT_ID);
		expect(def.version).toBe(1);
		expect(def.housingCopy).toBe(true);
		expect(def.containsClientData).toBe(false);
		expect(def.maxTokens).toBeGreaterThanOrEqual(2048);
		const built = await buildPrompt('studio/listing.v1', BASE);
		expect(built.system).toBe(`${HOUSING_COPY_GUARDRAIL.text}\n\n${STUDIO_LISTING_SYSTEM}`);
		expect(built.promptId).toBe('studio/listing.v1@1');
		expect(built.fixtureText).toBe(sampleListing(BASE));
	});

	it('system text carries every facts-only rule verbatim', () => {
		for (const line of [
			'Write a real estate listing description using ONLY the facts in <facts>.',
			'Do not add any feature, amenity, number, measurement, date, or price that is not in <facts>.',
			'Use numerals exactly as given. Do not round, convert, or estimate.',
			'Never describe who should live here, the neighbors, schools, safety, crime, religion, or demographics.',
			'Never promise value, appreciation, or returns. No superlatives like "best" or "#1".',
			'Do not write a disclosure, license number, brokerage name, or hashtags; they are added separately.',
			'Output plain text only. No headings, no markdown, no emoji.'
		]) {
			expect(STUDIO_LISTING_SYSTEM).toContain(line);
		}
	});

	it('sends the whitelisted facts as JSON plus tone and length', () => {
		const user = renderListingUser(BASE);
		expect(user).toContain('<facts>');
		expect(user).toContain('Tone: warm');
		expect(user).toContain('Length: about 150 words');
		const json = user.slice(user.indexOf('<facts>') + 7, user.indexOf('</facts>'));
		const facts = JSON.parse(json) as Record<string, unknown>;
		expect(facts).toEqual(pickListingFacts(BASE));
		for (const key of ['tone', 'length', 'siteCharLimit']) expect(facts).not.toHaveProperty(key);
		expect(renderListingUser({ ...BASE, siteCharLimit: 1000 })).not.toContain('1000');
	});

	it('refuses input outside the whitelist or failing validation', async () => {
		const withSchools = { ...BASE, schools: 'Example Elementary' } as unknown as ListingFacts;
		expect(() => renderListingUser(withSchools)).toThrow('schools');
		await expect(buildPrompt('studio/listing.v1', withSchools)).rejects.toThrow();
		expect(() => renderListingUser({ ...BASE, bedrooms: 40 })).toThrow(/bedrooms/);
	});
});

describe('studio/listing.v1 sample (keyless)', () => {
	it.each(FIXTURES.map((f, n) => [n, f] as const))(
		'fixture %i passes every check with zero findings',
		(_n, f) => {
			const text = sampleListing(f);
			expect(text.length).toBeGreaterThan(0);
			expect(checkFairHousing(text)).toEqual([]);
			expect(numberPostCheck('listing', listingAllowedNumbers(f))(text)).toEqual([]);
			expect(numberWordsPostCheck()(text)).toEqual([]);
			expect(unsupportedFeaturePostCheck(f)(text)).toEqual([]);
			expect(
				runChecks(text, [
					numberPostCheck('listing', listingAllowedNumbers(f)),
					numberWordsPostCheck(),
					unsupportedFeaturePostCheck(f)
				])
			).toEqual([]);
		}
	);

	it('reads as the tone template, from the facts only', () => {
		expect(sampleListing(FIXTURES[0]!)).toBe(
			'Welcome to 18 Example Lane, a 3-bedroom, 2.5-bathroom single-family home with 1,450 square feet. It offers hardwood floors, central air, a fireplace, an updated kitchen and a 2-car garage. Nearby: public transit and parks. Example Creek Trailhead. Built in 1987. Offered at $489,000.'
		);
		expect(sampleListing(FIXTURES[1]!)).toBe(
			'Welcome to this home, a 1-bedroom, 1-bathroom condo. It offers in-unit laundry and walk-in closets. Nearby: shops and restaurants and cafes. Available for $2,450 a month.'
		);
		expect(sampleListing(FIXTURES[3]!)).toBe('Manufactured home. Studio, 1 bathroom.');
		expect(sampleListing(FIXTURES[4]!)).toMatch(/^Presenting 18 Example Lane: a 3-bedroom/);
	});

	it('a planted number or feature is caught (the checks bite)', () => {
		const f = FIXTURES[0]!;
		const text = `${sampleListing(f)} Over 2,000 square feet. A pool out back.`;
		expect(numberPostCheck('listing', listingAllowedNumbers(f))(text)).toHaveLength(1);
		expect(unsupportedFeaturePostCheck(f)(text)).toHaveLength(1);
	});
});
