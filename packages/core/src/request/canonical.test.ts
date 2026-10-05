import { describe, expect, test } from 'vitest';

import { canonicalKey, canonicalParams, TRANSPORT_ONLY } from './canonical.js';
import { ENDPOINT_PATHS, requestTarget, type EndpointId } from './endpoints.js';
import { DAY_MS, HOUR_MS, isStale, NEGATIVE_TTL_MS, TTL_MS, ttlFor } from './ttl.js';

const ALL_ENDPOINTS = Object.keys(ENDPOINT_PATHS) as EndpointId[];

describe('canonicalKey', () => {
	test('sorts params by name and prefixes the endpoint id', () => {
		expect(
			canonicalKey({
				endpoint: 'rental-listings',
				params: { state: 'TX', city: 'Austin', status: 'Active', limit: 500, offset: 0 }
			})
		).toBe('rental-listings?city=Austin&limit=500&offset=0&state=TX&status=Active');
	});

	test('param order does not matter', () => {
		const a = canonicalKey({
			endpoint: 'sale-listings',
			params: { zipCode: '74201', limit: 500, status: 'Active' }
		});
		const b = canonicalKey({
			endpoint: 'sale-listings',
			params: { status: 'Active', limit: 500, zipCode: '74201' }
		});
		expect(a).toBe(b);
	});

	test('undefined, null and empty strings are dropped', () => {
		expect(
			canonicalKey({
				endpoint: 'rental-listings',
				params: { zipCode: '74201', city: undefined, state: null, address: '', bedrooms: '   ' }
			})
		).toBe('rental-listings?zipCode=74201');
	});

	test('transport-only params are dropped', () => {
		expect([...TRANSPORT_ONLY].sort()).toEqual(['includeTotalCount', 'suppressLogging']);
		expect(
			canonicalKey({
				endpoint: 'rental-listings',
				params: { zipCode: '74201', suppressLogging: true, includeTotalCount: true }
			})
		).toBe('rental-listings?zipCode=74201');
	});

	test('multi-values are sorted and pipe-joined regardless of input order', () => {
		const a = canonicalKey({
			endpoint: 'rental-listings',
			params: { zipCode: '74201', propertyType: ['Condo', 'Apartment'] }
		});
		const b = canonicalKey({
			endpoint: 'rental-listings',
			params: { zipCode: '74201', propertyType: ['Apartment', 'Condo'] }
		});
		expect(a).toBe(b);
		expect(a).toBe('rental-listings?propertyType=Apartment%7CCondo&zipCode=74201');
	});

	test('the key is identical to endpoint + encoded canonicalParams', () => {
		const params = { city: 'San Antonio', state: 'tx', limit: 500 };
		const expected =
			'rental-listings?' +
			canonicalParams(params)
				.map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
				.join('&');
		expect(canonicalKey({ endpoint: 'rental-listings', params })).toBe(expected);
		expect(expected).toBe('rental-listings?city=San%20Antonio&limit=500&state=TX');
	});
});

describe('canonicalParams normalization', () => {
	test('state is uppercased', () => {
		expect(canonicalParams({ state: 'tx' })).toEqual([['state', 'TX']]);
	});

	test('zipCode is trimmed to 5 digits', () => {
		expect(canonicalParams({ zipCode: ' 74201-1234 ' })).toEqual([['zipCode', '74201']]);
	});

	test('string values are trimmed', () => {
		expect(canonicalParams({ city: '  Austin  ' })).toEqual([['city', 'Austin']]);
	});

	test('numbers become decimal strings and booleans become true/false', () => {
		expect(
			canonicalParams({ limit: 500, offset: 0, radius: 2.5, lookupSubjectAttributes: true })
		).toEqual([
			['limit', '500'],
			['lookupSubjectAttributes', 'true'],
			['offset', '0'],
			['radius', '2.5']
		]);
		expect(canonicalParams({ flag: false })).toEqual([['flag', 'false']]);
	});

	test.each(['apiKey', 'X-Api-Key', 'api_key', 'APIKEY', 'apikey'])(
		'throws when a param named %s could carry an API key',
		(name) => {
			expect(() => canonicalParams({ zipCode: '74201', [name]: 'secret-value-123456' })).toThrow(
				new TypeError('API keys never belong in request params')
			);
		}
	);

	test('an api-key-named param throws even when empty', () => {
		expect(() => canonicalParams({ apiKey: undefined })).toThrow(TypeError);
	});
});

describe('requestTarget', () => {
	test('by-id substitutes the id into the path and removes it from the query', () => {
		expect(
			requestTarget({ endpoint: 'rental-listing-by-id', params: { id: 'SAMPLE-74201-R001' } })
		).toEqual({ path: '/v1/listings/rental/long-term/SAMPLE-74201-R001', query: [] });
	});

	test('by-id percent-encodes an id containing a slash', () => {
		const { path } = requestTarget({
			endpoint: 'rental-listing-by-id',
			params: { id: 'a/b c' }
		});
		expect(path).toBe('/v1/listings/rental/long-term/a%2Fb%20c');
	});

	test('a list endpoint uses ENDPOINT_PATHS and the canonical params as the query', () => {
		const params = { zipCode: '74201', status: 'Active', limit: 500, suppressLogging: true };
		expect(requestTarget({ endpoint: 'rental-listings', params })).toEqual({
			path: ENDPOINT_PATHS['rental-listings'],
			query: canonicalParams(params)
		});
	});

	test('every endpoint path is the documented RentCast path', () => {
		expect(ENDPOINT_PATHS).toEqual({
			'rental-listings': '/v1/listings/rental/long-term',
			'sale-listings': '/v1/listings/sale',
			'rental-listing-by-id': '/v1/listings/rental/long-term/{id}',
			'rent-estimate': '/v1/avm/rent/long-term',
			'value-estimate': '/v1/avm/value',
			markets: '/v1/markets'
		});
	});
});

describe('TTLs', () => {
	test('unit constants', () => {
		expect(HOUR_MS).toBe(3_600_000);
		expect(DAY_MS).toBe(86_400_000);
	});

	test('one TTL per endpoint', () => {
		expect(TTL_MS).toEqual({
			'rental-listings': DAY_MS,
			'sale-listings': DAY_MS,
			'rental-listing-by-id': DAY_MS,
			'rent-estimate': 7 * DAY_MS,
			'value-estimate': 7 * DAY_MS,
			markets: 30 * DAY_MS
		});
		expect(NEGATIVE_TTL_MS).toBe(DAY_MS);
	});

	test.each(ALL_ENDPOINTS)(
		'%s: 404 and 400 are negative-cached for 24h, 200 uses the table',
		(e) => {
			expect(ttlFor(e, 404)).toBe(NEGATIVE_TTL_MS);
			expect(ttlFor(e, 400)).toBe(NEGATIVE_TTL_MS);
			expect(ttlFor(e, 200)).toBe(TTL_MS[e]);
		}
	);
});

describe('isStale', () => {
	const t = 1_790_000_000_000;

	test('listings are fresh just under 24h and stale at 24h', () => {
		expect(isStale(t, 'rental-listings', 200, t + DAY_MS - 1)).toBe(false);
		expect(isStale(t, 'rental-listings', 200, t + DAY_MS)).toBe(true);
	});

	test('markets 200 is stale at 30 days', () => {
		expect(isStale(t, 'markets', 200, t + 30 * DAY_MS - 1)).toBe(false);
		expect(isStale(t, 'markets', 200, t + 30 * DAY_MS)).toBe(true);
	});

	test('markets 404 is stale at 24h', () => {
		expect(isStale(t, 'markets', 404, t + DAY_MS - 1)).toBe(false);
		expect(isStale(t, 'markets', 404, t + DAY_MS)).toBe(true);
	});
});
