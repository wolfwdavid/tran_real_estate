import { describe, expect, test } from 'vitest';

import {
	applyFilters,
	hasLocalFilters,
	isTruncated,
	matchRental,
	toServerParams,
	utcDayDiff
} from './filters.js';
import { DEFAULT_FILTERS, type RentalFilters, type RentalRowLike } from './types.js';

const NOW = new Date('2026-10-15T12:00:00Z');
const ZIP = { kind: 'zip', zipCode: '78701' } as const;
const CITY = { kind: 'city', city: 'Austin', state: 'TX' } as const;

function row(overrides: Partial<RentalRowLike> = {}): RentalRowLike {
	return {
		id: 'r1',
		price: 1800,
		bedrooms: 2,
		bathrooms: 1,
		squareFootage: 900,
		propertyType: 'Apartment',
		listedDate: '2026-10-10T00:00:00.000Z',
		lastSeenDate: '2026-10-14T00:00:00.000Z',
		daysOnMarket: 5,
		status: 'Active',
		removedDate: null,
		...overrides
	};
}

const f = (overrides: Partial<RentalFilters>): RentalFilters => ({
	...DEFAULT_FILTERS,
	...overrides
});

describe('toServerParams', () => {
	test('wide ZIP params hold exactly zipCode, status=Active, limit=500', () => {
		const p = toServerParams(ZIP);
		expect(p).toEqual({ zipCode: '78701', status: 'Active', limit: 500 });
		expect(Object.keys(p).sort()).toEqual(['limit', 'status', 'zipCode']);
	});

	test('wide city params hold exactly city, state, status, limit (no offset)', () => {
		const p = toServerParams(CITY);
		expect(p).toEqual({ city: 'Austin', state: 'TX', status: 'Active', limit: 500 });
		expect(Object.keys(p).sort()).toEqual(['city', 'limit', 'state', 'status']);
	});

	test('wide params never change with filters (stable cache key)', () => {
		const busy = f({ priceMin: 1000, priceMax: 3000, beds: 2, types: ['Condo'], listedWithin: 7 });
		expect(toServerParams(ZIP, busy)).toEqual(toServerParams(ZIP));
		expect(toServerParams(CITY, busy, 'wide')).toEqual(toServerParams(CITY));
	});

	test('narrow with default filters adds nothing', () => {
		expect(toServerParams(ZIP, DEFAULT_FILTERS, 'narrow')).toEqual(toServerParams(ZIP));
	});

	test.each<[Partial<RentalFilters>, string, unknown]>([
		[{ priceMax: 2000 }, 'price', '0:2000'],
		[{ priceMin: 1500 }, 'price', '1500:100000'],
		[{ priceMin: 1500, priceMax: 2500 }, 'price', '1500:2500'],
		[{ beds: 2 }, 'bedrooms', '2:2'],
		[{ beds: 0 }, 'bedrooms', '0:0'],
		[{ beds: '4+' }, 'bedrooms', '4:20'],
		[{ types: ['Condo', 'Apartment'] }, 'propertyType', ['Apartment', 'Condo']],
		[{ listedWithin: 14 }, 'daysOld', '1:14']
	])('narrow %j → %s = %j', (filters, key, value) => {
		const p = toServerParams(ZIP, f(filters), 'narrow');
		expect(p[key]).toEqual(value);
		expect(Object.keys(p).sort()).toEqual([key, 'limit', 'status', 'zipCode'].sort());
	});

	test('narrow never sends open (*) bounds or an offset', () => {
		const all = f({ priceMin: 1, priceMax: 9, beds: 1, types: ['Condo'], listedWithin: 60 });
		const p = toServerParams(CITY, all, 'narrow');
		expect(JSON.stringify(p)).not.toContain('*');
		expect(p).not.toHaveProperty('offset');
	});

	test('narrow sorting does not mutate the caller types array', () => {
		const types = ['Townhouse', 'Condo'] as const;
		toServerParams(ZIP, f({ types }), 'narrow');
		expect(types).toEqual(['Townhouse', 'Condo']);
	});
});

describe('matchRental', () => {
	test.each<[string, Partial<RentalRowLike>, Partial<RentalFilters>, boolean]>([
		['defaults match an active row', {}, {}, true],
		['priceMin inclusive', { price: 1500 }, { priceMin: 1500 }, true],
		['below priceMin', { price: 1499 }, { priceMin: 1500 }, false],
		['priceMax inclusive', { price: 2000 }, { priceMax: 2000 }, true],
		['above priceMax', { price: 2001 }, { priceMax: 2000 }, false],
		['null price kept with no price bound', { price: null }, {}, true],
		['null price excluded with a price bound', { price: null }, { priceMax: 3000 }, false],
		['studio exact', { bedrooms: 0 }, { beds: 0 }, true],
		['studio rejects 1 bed', { bedrooms: 1 }, { beds: 0 }, false],
		['2 beds exact', { bedrooms: 2 }, { beds: 2 }, true],
		['2 beds rejects 3', { bedrooms: 3 }, { beds: 2 }, false],
		['4+ accepts 4', { bedrooms: 4 }, { beds: '4+' }, true],
		['4+ accepts 6', { bedrooms: 6 }, { beds: '4+' }, true],
		['4+ rejects 3', { bedrooms: 3 }, { beds: '4+' }, false],
		['null bedrooms kept when beds any', { bedrooms: null }, {}, true],
		['null bedrooms excluded when beds set', { bedrooms: null }, { beds: 1 }, false],
		['empty types = any non-Land type', { propertyType: 'Manufactured' }, {}, true],
		['Land excluded with empty types', { propertyType: 'Land' }, {}, false],
		[
			'Land excluded even if somehow selected',
			{ propertyType: 'Land' },
			{ types: ['Land' as never] },
			false
		],
		['selected type matches', { propertyType: 'Condo' }, { types: ['Condo', 'Apartment'] }, true],
		['unselected type rejected', { propertyType: 'Townhouse' }, { types: ['Condo'] }, false],
		[
			'listed exactly 7 UTC days ago within 7',
			{ listedDate: '2026-10-08T23:59:00Z' },
			{ listedWithin: 7 },
			true
		],
		[
			'listed 8 UTC days ago not within 7',
			{ listedDate: '2026-10-07T00:00:00Z' },
			{ listedWithin: 7 },
			false
		],
		['listed today within 7', { listedDate: '2026-10-15' }, { listedWithin: 7 }, true],
		['missing listedDate kept when any', { listedDate: null }, {}, true],
		['missing listedDate excluded when set', { listedDate: null }, { listedWithin: 30 }, false],
		[
			'unparseable listedDate excluded when set',
			{ listedDate: 'soon' },
			{ listedWithin: 30 },
			false
		],
		['Inactive status excluded', { status: 'Inactive' }, {}, false],
		['null status excluded', { status: null }, {}, false],
		['removedDate excluded', { removedDate: '2026-10-12T00:00:00Z' }, {}, false]
	])('%s', (_name, overrides, filters, expected) => {
		expect(matchRental(row(overrides), f(filters), NOW)).toBe(expected);
	});
});

describe('utcDayDiff', () => {
	test('counts UTC calendar days, ignoring the time of day', () => {
		expect(utcDayDiff(NOW, '2026-10-08T23:59:59Z')).toBe(7);
		expect(utcDayDiff(NOW, '2026-10-07T00:00:00Z')).toBe(8);
		expect(utcDayDiff(NOW, '2026-10-15')).toBe(0);
		expect(utcDayDiff(new Date('2026-10-15T00:30:00Z'), '2026-10-14T23:30:00Z')).toBe(1);
	});
});

describe('applyFilters', () => {
	const rows = [
		row({ id: 'a', price: 1200, bedrooms: 0 }),
		row({ id: 'b', price: 2200, bedrooms: 2 }),
		row({ id: 'c', price: 1900, bedrooms: 2, propertyType: 'Condo' }),
		row({ id: 'd', price: 1950, bedrooms: 2, status: 'Inactive' }),
		row({ id: 'e', price: 1700, bedrooms: 2 })
	];

	test('returns matching rows in input order', () => {
		const out = applyFilters(rows, f({ priceMax: 2000, beds: 2 }), NOW);
		expect(out.map((r) => r.id)).toEqual(['c', 'e']);
	});

	test('is idempotent: applying twice equals applying once', () => {
		const filters = f({ priceMin: 1500, types: ['Apartment'] });
		const once = applyFilters(rows, filters, NOW);
		expect(applyFilters(once, filters, NOW)).toEqual(once);
	});

	test('does not mutate the input', () => {
		const copy = [...rows];
		applyFilters(rows, f({ beds: 0 }), NOW);
		expect(rows).toEqual(copy);
	});
});

describe('isTruncated', () => {
	test('499 rows are complete; 500 and more may be truncated', () => {
		expect(isTruncated(new Array(499).fill(0))).toBe(false);
		expect(isTruncated(new Array(500).fill(0))).toBe(true);
		expect(isTruncated(new Array(501).fill(0))).toBe(true);
	});
});

describe('hasLocalFilters', () => {
	test('false for defaults, true when any field differs', () => {
		expect(hasLocalFilters(DEFAULT_FILTERS)).toBe(false);
		expect(hasLocalFilters(f({ priceMin: 0 }))).toBe(true);
		expect(hasLocalFilters(f({ beds: 0 }))).toBe(true);
		expect(hasLocalFilters(f({ types: ['Condo'] }))).toBe(true);
		expect(hasLocalFilters(f({ listedWithin: 60 }))).toBe(true);
	});
});
