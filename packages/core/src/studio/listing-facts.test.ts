import { describe, expect, test } from 'vitest';
import {
	LENGTH_WORDS,
	LISTING_FACT_KEYS,
	LISTING_FEATURES,
	NEARBY_AMENITIES,
	PROPERTY_TYPES_STUDIO,
	listingFreeText,
	pickListingFacts,
	validateListingFacts,
	type ListingFacts
} from './listing-facts';

const NOW = new Date(2026, 9, 7);
const YEAR_COPY = 'Enter a year from 1700 to 2026.';

const baseline = (): Record<string, unknown> => ({
	listingType: 'sale',
	propertyType: 'Condo',
	bedrooms: 2,
	bathrooms: 1.5,
	squareFeet: 1450,
	yearBuilt: 1998,
	lotSize: '0.25 acre',
	garageSpaces: 1,
	price: 425000,
	streetOrArea: 'Maple Street',
	features: ['Hardwood floors', 'Fireplace'],
	otherFeatures: 'bay window',
	nearby: ['Parks'],
	nearbyPlaces: 'Riverside Park',
	tone: 'warm',
	length: 'medium',
	anythingElse: 'Sunny corner unit.',
	siteCharLimit: 1000
});

const errorsFor = (patch: Record<string, unknown>) => {
	const r = validateListingFacts({ ...baseline(), ...patch }, NOW);
	if (r.ok) throw new Error('expected validation to fail');
	return r.errors;
};

describe('constants', () => {
	test('chip lists and word targets match the UI-SPEC', () => {
		expect(LISTING_FEATURES).toHaveLength(16);
		expect(LISTING_FEATURES).toContain('Step-free entry');
		expect(NEARBY_AMENITIES).toHaveLength(9);
		expect(NEARBY_AMENITIES).toContain('Bike lanes');
		expect(PROPERTY_TYPES_STUDIO).toEqual([
			'Single family',
			'Condo',
			'Townhouse',
			'Multi-family',
			'Manufactured'
		]);
		expect(LENGTH_WORDS).toEqual({ short: 75, medium: 150, long: 250 });
	});

	test('the key whitelist is exactly the ListingFacts fields', () => {
		expect([...LISTING_FACT_KEYS].sort()).toEqual(Object.keys(baseline()).sort());
	});
});

describe('validateListingFacts', () => {
	test('a full valid object passes and is returned as a clean copy', () => {
		const input = baseline();
		const r = validateListingFacts(input, NOW);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.value).toEqual(input);
		expect(r.value).not.toBe(input);
	});

	test('a minimal object passes with default features, nearby, tone and length', () => {
		const r = validateListingFacts(
			{ listingType: 'rent', propertyType: 'Townhouse', bedrooms: 0, bathrooms: 1 },
			NOW
		);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.value).toEqual({
			listingType: 'rent',
			propertyType: 'Townhouse',
			bedrooms: 0,
			bathrooms: 1,
			features: [],
			nearby: [],
			tone: 'warm',
			length: 'medium'
		});
	});

	test('empty optional values are dropped from the value', () => {
		const r = validateListingFacts(
			{
				...baseline(),
				squareFeet: undefined,
				yearBuilt: null,
				lotSize: '',
				otherFeatures: '   ',
				anythingElse: undefined
			},
			NOW
		);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect('squareFeet' in r.value).toBe(false);
		expect('yearBuilt' in r.value).toBe(false);
		expect('lotSize' in r.value).toBe(false);
		expect('otherFeatures' in r.value).toBe(false);
		expect('anythingElse' in r.value).toBe(false);
	});

	test.each([null, undefined, 'facts', 42, ['sale']])('rejects non-object input %j', (input) => {
		const r = validateListingFacts(input, NOW);
		expect(r.ok).toBe(false);
	});

	test.each([
		'schools',
		'crime',
		'safety',
		'church',
		'demographics',
		'neighbors',
		'schoolDistrict',
		'worship',
		'whoLivesHere',
		'__proto__x'
	])('rejects the forbidden or unknown key %s', (key) => {
		const r = validateListingFacts({ ...baseline(), [key]: 'Top rated' }, NOW);
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.unknownKeys).toEqual([key]);
		expect(r.errors._unknown).toBe('Unsupported fact.');
	});

	test('lists every unknown key', () => {
		const r = validateListingFacts({ ...baseline(), schools: 'A', crime: 'low' }, NOW);
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(r.unknownKeys).toEqual(['schools', 'crime']);
	});

	test.each<[string, Record<string, unknown>, string]>([
		['listingType', { listingType: undefined }, 'Choose For sale or For rent.'],
		['listingType', { listingType: 'lease' }, 'Choose For sale or For rent.'],
		['propertyType', { propertyType: undefined }, 'Choose a property type.'],
		['propertyType', { propertyType: 'Castle' }, 'Choose a property type.'],
		['bedrooms', { bedrooms: 21 }, 'Enter the number of bedrooms, from 0 to 20.'],
		['bedrooms', { bedrooms: 2.5 }, 'Enter the number of bedrooms, from 0 to 20.'],
		['bedrooms', { bedrooms: undefined }, 'Enter the number of bedrooms, from 0 to 20.'],
		['bedrooms', { bedrooms: -1 }, 'Enter the number of bedrooms, from 0 to 20.'],
		['bedrooms', { bedrooms: Number.NaN }, 'Enter the number of bedrooms, from 0 to 20.'],
		['bathrooms', { bathrooms: 2.25 }, 'Enter the number of bathrooms, like 2 or 2.5.'],
		['bathrooms', { bathrooms: 21 }, 'Enter the number of bathrooms, like 2 or 2.5.'],
		['bathrooms', { bathrooms: undefined }, 'Enter the number of bathrooms, like 2 or 2.5.'],
		['squareFeet', { squareFeet: -1 }, 'Use 0 or more.'],
		['squareFeet', { squareFeet: Number.NaN }, 'Enter a number, like 1450.'],
		['squareFeet', { squareFeet: '1450' }, 'Enter a number, like 1450.'],
		['garageSpaces', { garageSpaces: -2 }, 'Use 0 or more.'],
		['price', { price: -5 }, 'Use 0 or more.'],
		['price', { price: Number.POSITIVE_INFINITY }, 'Enter a number, like 1450.'],
		['siteCharLimit', { siteCharLimit: -1 }, 'Use 0 or more.'],
		['yearBuilt', { yearBuilt: 1699 }, YEAR_COPY],
		['yearBuilt', { yearBuilt: 2027 }, YEAR_COPY],
		['yearBuilt', { yearBuilt: 1999.5 }, YEAR_COPY],
		['otherFeatures', { otherFeatures: 'x'.repeat(201) }, 'Keep this under 200 characters.'],
		['nearbyPlaces', { nearbyPlaces: 'x'.repeat(201) }, 'Keep this under 200 characters.'],
		['anythingElse', { anythingElse: 'x'.repeat(501) }, 'Keep this under 500 characters.'],
		['streetOrArea', { streetOrArea: 'x'.repeat(81) }, 'Keep this under 80 characters.'],
		['lotSize', { lotSize: 'x'.repeat(41) }, 'Keep this under 40 characters.'],
		['features', { features: ['Fireplace', 'Wine cellar'] }, 'Choose from the listed features.'],
		['features', { features: 'Fireplace' }, 'Choose from the listed features.'],
		['nearby', { nearby: ['Good schools'] }, 'Choose from the listed features.']
	])('%s error copy for %j', (key, patch, copy) => {
		expect(errorsFor(patch)[key as keyof ListingFacts]).toBe(copy);
	});

	test('limits are inclusive at the max', () => {
		const r = validateListingFacts(
			{
				...baseline(),
				otherFeatures: 'x'.repeat(200),
				anythingElse: 'x'.repeat(500),
				streetOrArea: 'x'.repeat(80),
				lotSize: 'x'.repeat(40),
				yearBuilt: 2026,
				bedrooms: 20,
				bathrooms: 20
			},
			NOW
		);
		expect(r.ok).toBe(true);
	});

	test('the year bound follows the injected clock', () => {
		const later = validateListingFacts({ ...baseline(), yearBuilt: 2030 }, new Date(2030, 0, 1));
		expect(later.ok).toBe(true);
		expect(errorsFor({ yearBuilt: 2030 }).yearBuilt).toBe(YEAR_COPY);
	});

	test('rejects an unknown tone or length', () => {
		expect(errorsFor({ tone: 'pushy' }).tone).toBeTruthy();
		expect(errorsFor({ length: 'epic' }).length).toBeTruthy();
	});

	test('an unknown key fails even when every field is valid', () => {
		const r = validateListingFacts({ ...baseline(), demographics: 'young families' }, NOW);
		expect(r.ok).toBe(false);
		if (r.ok) return;
		expect(Object.keys(r.errors)).toEqual(['_unknown']);
	});
});

const valid = (patch: Record<string, unknown> = {}): ListingFacts => {
	const r = validateListingFacts({ ...baseline(), ...patch }, NOW);
	if (!r.ok) throw new Error('baseline invalid');
	return r.value;
};

describe('pickListingFacts', () => {
	test('never carries tone, length or siteCharLimit', () => {
		const picked = pickListingFacts(valid());
		expect(picked).not.toHaveProperty('tone');
		expect(picked).not.toHaveProperty('length');
		expect(picked).not.toHaveProperty('siteCharLimit');
		expect(picked.bedrooms).toBe(2);
		expect(picked.features).toEqual(['Hardwood floors', 'Fireplace']);
	});

	test('drops empty strings, empty arrays and undefined but keeps zero', () => {
		const facts: ListingFacts = {
			listingType: 'rent',
			propertyType: 'Condo',
			bedrooms: 0,
			bathrooms: 1,
			features: [],
			nearby: [],
			otherFeatures: '  ',
			lotSize: '',
			garageSpaces: 0,
			tone: 'concise',
			length: 'short'
		};
		const picked = pickListingFacts(facts);
		expect(picked).toEqual({
			listingType: 'rent',
			propertyType: 'Condo',
			bedrooms: 0,
			bathrooms: 1,
			garageSpaces: 0
		});
		for (const v of Object.values(picked)) {
			expect(v).not.toBe('');
			expect(v).not.toBeUndefined();
			if (Array.isArray(v)) expect(v.length).toBeGreaterThan(0);
		}
	});

	test('only whitelisted keys can appear', () => {
		const picked = pickListingFacts(valid());
		for (const k of Object.keys(picked)) {
			expect(LISTING_FACT_KEYS).toContain(k);
		}
	});
});

describe('listingFreeText', () => {
	test('returns the non-empty free-text fields in order', () => {
		expect(listingFreeText(valid())).toEqual([
			'bay window',
			'Riverside Park',
			'Sunny corner unit.',
			'0.25 acre',
			'Maple Street'
		]);
	});

	test('skips empty and whitespace-only fields', () => {
		expect(
			listingFreeText(valid({ otherFeatures: '', nearbyPlaces: '  ', lotSize: undefined }))
		).toEqual(['Sunny corner unit.', 'Maple Street']);
	});
});
