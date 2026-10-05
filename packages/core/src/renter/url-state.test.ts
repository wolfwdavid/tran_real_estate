import { describe, expect, test } from 'vitest';

import { DEFAULT_FILTERS } from './types.js';
import { decodeSearchParams, encodeSearchParams, type SearchUrlState } from './url-state.js';

const base: SearchUrlState = {
	locInput: 'Austin, TX',
	filters: DEFAULT_FILTERS,
	sort: 'newest',
	view: 'list'
};

describe('encodeSearchParams', () => {
	test('defaults encode to the location only', () => {
		expect(encodeSearchParams(base).toString()).toBe('loc=Austin%2C+TX');
	});

	test('an empty or blank location is omitted', () => {
		expect(encodeSearchParams({ ...base, locInput: '' }).toString()).toBe('');
		expect(encodeSearchParams({ ...base, locInput: '   ' }).toString()).toBe('');
	});

	test('every non-default value gets its own key, types sorted and pipe-joined', () => {
		const p = encodeSearchParams({
			locInput: 'Austin, TX',
			filters: {
				priceMin: 1500,
				priceMax: 2500,
				beds: '4+',
				types: ['Condo', 'Apartment'],
				listedWithin: 14
			},
			sort: 'rent-asc',
			view: 'map'
		});
		expect([...p.keys()]).toEqual(['loc', 'min', 'max', 'beds', 'type', 'days', 'sort', 'view']);
		expect(p.get('loc')).toBe('Austin, TX');
		expect(p.get('min')).toBe('1500');
		expect(p.get('max')).toBe('2500');
		expect(p.get('beds')).toBe('4plus');
		expect(p.get('type')).toBe('Apartment|Condo');
		expect(p.get('days')).toBe('14');
		expect(p.get('sort')).toBe('rent-asc');
		expect(p.get('view')).toBe('map');
	});

	test('beds 0 encodes studio and 1/2/3 encode digits', () => {
		const beds = (b: 0 | 1 | 2 | 3) =>
			encodeSearchParams({ ...base, filters: { ...DEFAULT_FILTERS, beds: b } }).get('beds');
		expect(beds(0)).toBe('studio');
		expect(beds(1)).toBe('1');
		expect(beds(2)).toBe('2');
		expect(beds(3)).toBe('3');
	});

	test('a price of 0 is a real bound and is kept', () => {
		const p = encodeSearchParams({ ...base, filters: { ...DEFAULT_FILTERS, priceMin: 0 } });
		expect(p.get('min')).toBe('0');
	});
});

describe('decodeSearchParams', () => {
	test('an empty query decodes to defaults', () => {
		expect(decodeSearchParams(new URLSearchParams(''))).toEqual({
			locInput: '',
			filters: DEFAULT_FILTERS,
			sort: 'newest',
			view: 'list'
		});
	});

	test('invalid values fall back to defaults instead of throwing (type=Land|Condo)', () => {
		const s = decodeSearchParams(
			new URLSearchParams('loc=78701&min=abc&beds=9&type=Land|Condo&days=5&sort=x&view=grid')
		);
		expect(s).toEqual({
			locInput: '78701',
			filters: {
				priceMin: null,
				priceMax: null,
				beds: 'any',
				types: ['Condo'],
				listedWithin: 'any'
			},
			sort: 'newest',
			view: 'list'
		});
	});

	test('the percent-encoded type form decodes the same way', () => {
		const s = decodeSearchParams(new URLSearchParams('type=Land%7CCondo'));
		expect(s.filters.types).toEqual(['Condo']);
	});

	test.each([
		['-5'],
		['1.5'],
		['1e3'],
		[' 12'],
		['0x10'],
		[''],
		['99999999999999999999'],
		['Infinity']
	])('min/max %j is not a non-negative integer and decodes to null', (v) => {
		const s = decodeSearchParams(new URLSearchParams({ min: v, max: v }));
		expect(s.filters.priceMin).toBeNull();
		expect(s.filters.priceMax).toBeNull();
	});

	test('each param is validated independently', () => {
		const s = decodeSearchParams(new URLSearchParams('min=oops&max=2000&beds=studio&days=60'));
		expect(s.filters).toEqual({
			priceMin: null,
			priceMax: 2000,
			beds: 0,
			types: [],
			listedWithin: 60
		});
	});

	test('types are de-duplicated and returned in the UI order', () => {
		const s = decodeSearchParams(
			new URLSearchParams('type=Townhouse|Apartment|Townhouse|Single Family|apartment|')
		);
		expect(s.filters.types).toEqual(['Apartment', 'Single Family', 'Townhouse']);
	});

	test('beds accepts studio|1|2|3|4plus and nothing else', () => {
		const beds = (v: string) => decodeSearchParams(new URLSearchParams({ beds: v })).filters.beds;
		expect(beds('studio')).toBe(0);
		expect(beds('1')).toBe(1);
		expect(beds('2')).toBe(2);
		expect(beds('3')).toBe(3);
		expect(beds('4plus')).toBe('4+');
		expect(beds('4+')).toBe('any');
		expect(beds('0')).toBe('any');
		expect(beds('4')).toBe('any');
		expect(beds('01')).toBe('any');
	});

	test('the hostile prototype keys never leak into state', () => {
		const s = decodeSearchParams(
			new URLSearchParams('sort=constructor&view=__proto__&beds=toString')
		);
		expect(s.sort).toBe('newest');
		expect(s.view).toBe('list');
		expect(s.filters.beds).toBe('any');
	});

	test('accepts a leading-? query string such as location.search', () => {
		expect(decodeSearchParams(new URLSearchParams('?loc=10001&view=map')).view).toBe('map');
	});
});

describe('round trip', () => {
	const states: SearchUrlState[] = [
		base,
		{ locInput: '', filters: DEFAULT_FILTERS, sort: 'newest', view: 'list' },
		{
			locInput: 'Austin, TX',
			filters: {
				priceMin: 1500,
				priceMax: 2500,
				beds: '4+',
				types: ['Apartment', 'Condo'],
				listedWithin: 14
			},
			sort: 'rent-asc',
			view: 'map'
		},
		{
			locInput: '78701',
			filters: { ...DEFAULT_FILTERS, beds: 0, priceMin: 0 },
			sort: 'dom',
			view: 'list'
		},
		{
			locInput: 'St. Mary’s City, MD & more',
			filters: { ...DEFAULT_FILTERS, priceMax: 1800, types: ['Single Family', 'Multi-Family'] },
			sort: 'size',
			view: 'map'
		},
		{
			locInput: 'Harlow Springs, OK',
			filters: {
				priceMin: null,
				priceMax: null,
				beds: 2,
				types: ['Apartment', 'Single Family', 'Condo', 'Townhouse', 'Multi-Family', 'Manufactured'],
				listedWithin: 60
			},
			sort: 'beds',
			view: 'list'
		}
	];

	test.each(states.map((s, i) => [i, s] as const))(
		'state %i survives encode → string → decode',
		(_i, s) => {
			const qs = encodeSearchParams(s).toString();
			expect(decodeSearchParams(new URLSearchParams(qs))).toEqual(s);
			// And again through a prerendered `?`-query URL with a trailing slash path.
			const url = new URL(`https://example.com/renter/?${qs}`);
			expect(decodeSearchParams(url.searchParams)).toEqual(s);
		}
	);

	test('encode(decode(q)) is stable for a canonical query', () => {
		const q = 'loc=Austin%2C+TX&min=1500&beds=studio&type=Apartment%7CCondo&sort=rent-desc';
		expect(encodeSearchParams(decodeSearchParams(new URLSearchParams(q))).toString()).toBe(q);
	});
});
