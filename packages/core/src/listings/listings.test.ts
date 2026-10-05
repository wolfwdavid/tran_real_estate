import { describe, expect, test } from 'vitest';

import type { NormalizedLocation } from '../location/normalize.js';
import { filterListings, hasActiveFilters, type ListingFilters } from './filter.js';
import {
	buildListingByIdRequest,
	buildListingsRequest,
	isTruncated,
	LISTINGS_LIMIT,
	shouldOfferNarrow,
	toRentCastFilterParams
} from './request.js';
import { PROPERTY_TYPES, type Listing } from './types.js';

const ZIP: NormalizedLocation = { kind: 'zip', zipCode: '74201', label: '74201' };
const CITY: NormalizedLocation = {
	kind: 'city',
	city: 'Harlow Springs',
	state: 'OK',
	label: 'Harlow Springs, OK'
};

type Row = Pick<Listing, 'price' | 'bedrooms' | 'bathrooms' | 'propertyType' | 'listedDate'> & {
	id: string;
};

const row = (id: string, over: Partial<Row> = {}): Row => ({
	id,
	price: 1500,
	bedrooms: 2,
	bathrooms: 1,
	propertyType: 'Single Family',
	listedDate: '2026-10-10T00:00:00.000Z',
	...over
});

const NOW = Date.parse('2026-10-15T00:00:00Z');
const ids = (rows: readonly Row[]) => rows.map((r) => r.id);

describe('PROPERTY_TYPES', () => {
	test('lists RentCast case-sensitive property types', () => {
		expect(PROPERTY_TYPES).toEqual([
			'Single Family',
			'Condo',
			'Townhouse',
			'Manufactured',
			'Multi-Family',
			'Apartment',
			'Land'
		]);
	});
});

describe('buildListingsRequest', () => {
	test('zip search carries only location + status + limit + offset', () => {
		expect(LISTINGS_LIMIT).toBe(500);
		expect(buildListingsRequest(ZIP, 'rental-listings')).toEqual({
			endpoint: 'rental-listings',
			params: { zipCode: '74201', status: 'Active', limit: 500, offset: 0 }
		});
	});

	test('city search carries city + state', () => {
		expect(buildListingsRequest(CITY, 'sale-listings')).toEqual({
			endpoint: 'sale-listings',
			params: { city: 'Harlow Springs', state: 'OK', status: 'Active', limit: 500, offset: 0 }
		});
	});

	test('changing local filters does not change the request (0 extra calls)', () => {
		// A view searches fetch-wide and applies its filters locally; only an explicit narrow passes
		// filters to the builder. Two different local filter sets therefore share one request.
		const search = (local: ListingFilters) => {
			const req = buildListingsRequest(ZIP, 'rental-listings');
			return { req, local };
		};
		const a = search({ minPrice: 1000 });
		const b = search({ maxPrice: 3000, propertyTypes: ['Condo'], listedWithinDays: 7 });
		expect(a.req).toEqual(b.req);
		expect(Object.keys(a.req.params).sort()).toEqual(['limit', 'offset', 'status', 'zipCode']);
		expect(buildListingsRequest(ZIP, 'rental-listings', {})).toEqual(a.req);
	});

	test('narrow request adds RentCast filter params to the base params', () => {
		expect(
			buildListingsRequest(ZIP, 'rental-listings', { minPrice: 1000, propertyTypes: ['Condo'] })
		).toEqual({
			endpoint: 'rental-listings',
			params: {
				zipCode: '74201',
				status: 'Active',
				limit: 500,
				offset: 0,
				price: '1000:*',
				propertyType: ['Condo']
			}
		});
	});
});

describe('toRentCastFilterParams', () => {
	test.each<[ListingFilters, Record<string, string | readonly string[]>]>([
		[{ minPrice: 1000, maxPrice: 2000 }, { price: '1000:2000' }],
		[{ minPrice: 1000 }, { price: '1000:*' }],
		[{ maxPrice: 2000 }, { price: '*:2000' }],
		[{ minBedrooms: 2 }, { bedrooms: '2:*' }],
		[{ minBedrooms: 2, maxBedrooms: 3 }, { bedrooms: '2:3' }],
		[{ minBathrooms: 1.5 }, { bathrooms: '1.5:*' }],
		[{ propertyTypes: ['Condo', 'Apartment'] }, { propertyType: ['Apartment', 'Condo'] }],
		[{ listedWithinDays: 7 }, { daysOld: '*:7' }],
		[{}, {}]
	])('%j → %j', (filters, params) => {
		expect(toRentCastFilterParams(filters)).toEqual(params);
	});

	test('does not mutate the propertyTypes array when sorting', () => {
		const types = ['Condo', 'Apartment'] as const;
		toRentCastFilterParams({ propertyTypes: types });
		expect(types).toEqual(['Condo', 'Apartment']);
	});
});

describe('buildListingByIdRequest', () => {
	test('builds a by-id lookup', () => {
		expect(buildListingByIdRequest('SAMPLE-74201-R001')).toEqual({
			endpoint: 'rental-listing-by-id',
			params: { id: 'SAMPLE-74201-R001' }
		});
	});

	test('empty id throws RangeError', () => {
		expect(() => buildListingByIdRequest('')).toThrow(RangeError);
		expect(() => buildListingByIdRequest('   ')).toThrow(RangeError);
	});
});

describe('filterListings', () => {
	test('price bounds are inclusive', () => {
		const rows = [row('a', { price: 999 }), row('b', { price: 1000 }), row('c', { price: 2000 })];
		rows.push(row('d', { price: 2001 }));
		expect(ids(filterListings(rows, { minPrice: 1000, maxPrice: 2000 }, NOW))).toEqual(['b', 'c']);
	});

	test('minBedrooms drops smaller and null-bedroom rows', () => {
		const rows = [
			row('a', { bedrooms: 1 }),
			row('b', { bedrooms: null }),
			row('c', { bedrooms: 2 })
		];
		expect(ids(filterListings(rows, { minBedrooms: 2 }, NOW))).toEqual(['c']);
	});

	test('maxBedrooms and minBathrooms', () => {
		const rows = [
			row('a', { bedrooms: 4 }),
			row('b', { bedrooms: 3, bathrooms: 1 }),
			row('c', { bedrooms: 3, bathrooms: 2 }),
			row('d', { bedrooms: 3, bathrooms: null })
		];
		expect(ids(filterListings(rows, { maxBedrooms: 3, minBathrooms: 1.5 }, NOW))).toEqual(['c']);
	});

	test('propertyTypes keeps only matching types', () => {
		const rows = [
			row('a', { propertyType: 'Condo' }),
			row('b', { propertyType: 'Apartment' }),
			row('c', { propertyType: 'Other' })
		];
		expect(ids(filterListings(rows, { propertyTypes: ['Condo'] }, NOW))).toEqual(['a']);
	});

	test('listedWithinDays is inclusive of exactly N days and drops null dates', () => {
		const rows = [
			row('a', { listedDate: '2026-10-08T00:00:00.000Z' }),
			row('b', { listedDate: '2026-10-07T23:59:59.000Z' }),
			row('c', { listedDate: null })
		];
		expect(ids(filterListings(rows, { listedWithinDays: 7 }, NOW))).toEqual(['a']);
	});

	test('empty filters return every row in input order without mutating the input', () => {
		const rows = [row('c'), row('a'), row('b')];
		const snapshot = structuredClone(rows);
		const out = filterListings(rows, {}, NOW);
		expect(ids(out)).toEqual(['c', 'a', 'b']);
		expect(out).not.toBe(rows);
		filterListings(rows, { minPrice: 5000 }, NOW);
		expect(rows).toEqual(snapshot);
	});

	test('an empty propertyTypes array is no filter', () => {
		const rows = [row('a', { propertyType: 'Land' })];
		expect(ids(filterListings(rows, { propertyTypes: [] }, NOW))).toEqual(['a']);
	});
});

describe('hasActiveFilters', () => {
	test.each<[ListingFilters, boolean]>([
		[{}, false],
		[{ propertyTypes: [] }, false],
		[{ minPrice: 1 }, true],
		[{ propertyTypes: ['Condo'] }, true],
		[{ listedWithinDays: 7 }, true]
	])('%j → %s', (filters, active) => {
		expect(hasActiveFilters(filters)).toBe(active);
	});
});

describe('truncation and narrow', () => {
	test('isTruncated compares the row count to the limit', () => {
		expect(isTruncated(500)).toBe(true);
		expect(isTruncated(499)).toBe(false);
		expect(isTruncated(50, 50)).toBe(true);
	});

	test('shouldOfferNarrow needs truncation and at least one filter', () => {
		expect(shouldOfferNarrow(true, { minPrice: 1 })).toBe(true);
		expect(shouldOfferNarrow(true, {})).toBe(false);
		expect(shouldOfferNarrow(false, { minPrice: 1 })).toBe(false);
	});
});
