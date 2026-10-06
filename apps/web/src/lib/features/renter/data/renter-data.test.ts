// Renter data contract (06-11): every renter RentCast request comes from requests.ts, and sample
// mode — reached through the public $lib/data port exactly as the renter UI reaches it — serves
// every fixture metro at 0 network calls, with listing dates that never age out of "7 days".
import { afterEach, describe, expect, it } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { canonicalKey } from '@tran/core/request';
import { applyFilters, DEFAULT_FILTERS, type RentalFilters } from '@tran/core/renter';
import type { Listing } from '@tran/core/listings';
import { createDataRuntime, SAMPLE_METROS, type DataGateway } from '$lib/data';
import { TranDb } from '$lib/storage/db';
import { marketStatsRequest } from '$lib/features/shared/markets/markets-port';
import { listingByIdRequest, marketsRequest, rentEstimateRequest, searchRequest } from './requests';

const FILTERED: RentalFilters = {
	priceMin: 1000,
	priceMax: 2000,
	beds: 2,
	types: ['Condo', 'Apartment'],
	listedWithin: 14
};

describe('searchRequest', () => {
	it('fetches wide by default: location + Active + limit 500, nothing else', () => {
		expect(searchRequest({ kind: 'zip', zipCode: '74201' })).toEqual({
			endpoint: 'rental-listings',
			params: { zipCode: '74201', status: 'Active', limit: 500 }
		});
		expect(searchRequest({ kind: 'city', city: 'Harlow Springs', state: 'OK' })).toEqual({
			endpoint: 'rental-listings',
			params: { city: 'Harlow Springs', state: 'OK', status: 'Active', limit: 500 }
		});
	});

	it('the wide cache key never changes with the filters', () => {
		const loc = { kind: 'zip', zipCode: '74201' } as const;
		expect(canonicalKey(searchRequest(loc, FILTERED))).toBe(
			canonicalKey(searchRequest(loc, DEFAULT_FILTERS))
		);
		expect(canonicalKey(searchRequest(loc, FILTERED, 'wide'))).toBe(
			canonicalKey(searchRequest(loc))
		);
	});

	it('narrow mode pushes the filters server-side', () => {
		const req = searchRequest({ kind: 'zip', zipCode: '74201' }, FILTERED, 'narrow');
		expect(req.endpoint).toBe('rental-listings');
		expect(req.params).toEqual({
			zipCode: '74201',
			status: 'Active',
			limit: 500,
			price: '1000:2000',
			bedrooms: '2:2',
			propertyType: ['Apartment', 'Condo'],
			daysOld: '1:14'
		});
		expect(canonicalKey(req)).not.toBe(
			canonicalKey(searchRequest({ kind: 'zip', zipCode: '74201' }))
		);
	});
});

describe('listingByIdRequest', () => {
	it('targets the by-id endpoint with the raw id', () => {
		expect(listingByIdRequest('A,1')).toEqual({
			endpoint: 'rental-listing-by-id',
			params: { id: 'A,1' }
		});
	});
});

describe('marketsRequest (Phase 7 parity)', () => {
	it('is exactly the watched-ZIP market stats request', () => {
		expect(marketsRequest('74201')).toEqual({
			endpoint: 'markets',
			params: { zipCode: '74201', dataType: 'All', historyRange: 24 }
		});
	});

	it('is the shared markets port builder itself (one cache entry for every portal)', () => {
		expect(marketsRequest).toBe(marketStatsRequest);
	});

	it('has the canonical key Phase 7 caches under', () => {
		expect(canonicalKey(marketsRequest('74201'))).toBe(
			'markets?dataType=All&historyRange=24&zipCode=74201'
		);
	});
});

describe('rentEstimateRequest', () => {
	it('describes the listing by address and facts, with 15 comps', () => {
		expect(
			rentEstimateRequest({
				formattedAddress: '100 Sample Way, Testville, OK 74201',
				propertyType: 'Condo',
				bedrooms: 2,
				bathrooms: 1.5,
				squareFootage: 900
			})
		).toEqual({
			endpoint: 'rent-estimate',
			params: {
				address: '100 Sample Way, Testville, OK 74201',
				propertyType: 'Condo',
				bedrooms: 2,
				bathrooms: 1.5,
				squareFootage: 900,
				compCount: 15
			}
		});
	});

	it('omits null facts (never sends "null")', () => {
		const req = rentEstimateRequest({
			formattedAddress: '1 Elm St, Testville, OK 74201',
			propertyType: 'Apartment',
			bedrooms: 0,
			bathrooms: null,
			squareFootage: null
		});
		expect(req.params).toEqual({
			address: '1 Elm St, Testville, OK 74201',
			propertyType: 'Apartment',
			bedrooms: 0,
			compCount: 15
		});
		expect(Object.keys(req.params)).not.toContain('bathrooms');
		expect(Object.keys(req.params)).not.toContain('squareFootage');
	});
});

// ---------------------------------------------------------------------------------------------
// Sample mode through the public port (what the renter UI calls).
// ---------------------------------------------------------------------------------------------

const ANCHOR = Date.parse('2026-10-01T00:00:00.000Z'); // fixtures/meta.json anchor
const DAY = 86_400_000;

const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const c of cleanups.splice(0)) c();
});

async function sampleGateway(now: number) {
	const calls: string[] = [];
	const db = new TranDb({ indexedDB: new IDBFactory(), IDBKeyRange }, `t-${crypto.randomUUID()}`);
	const runtime = createDataRuntime({
		db,
		clock: () => now,
		fetch: (async (input: RequestInfo | URL) => {
			calls.push(String(input));
			throw new Error('network is off in sample mode');
		}) as typeof fetch,
		keys: { get: () => null, state: () => 'none', onChange: () => () => {} },
		channel: null,
		reactiveGuard: () => false
	});
	const stop = await runtime.start();
	cleanups.push(() => {
		stop();
		db.close();
	});
	expect(runtime.mode?.source).toBe('sample');
	return { gateway: runtime.gateway as DataGateway, calls };
}

async function sampleRows(gateway: DataGateway, req: ReturnType<typeof searchRequest>) {
	const peeked = await gateway.peek<Listing[]>(req);
	if (!peeked || peeked.kind !== 'data') throw new Error(`no sample data for ${canonicalKey(req)}`);
	expect(peeked.result.provenance.source).toBe('sample');
	return peeked.result.data;
}

describe('sample mode via the $lib/data port', () => {
	it.each(SAMPLE_METROS.flatMap((m) => m.zipCodes))(
		'peek(searchRequest(%s)) returns rows at 0 network calls',
		async (zip) => {
			const { gateway, calls } = await sampleGateway(ANCHOR);
			const rows = await sampleRows(gateway, searchRequest({ kind: 'zip', zipCode: zip }));
			expect(rows.length).toBeGreaterThanOrEqual(1);
			expect(calls).toHaveLength(0);
		}
	);

	it('peekListingById answers a fixture id at 0 network calls; estimateCost is free', async () => {
		const { gateway, calls } = await sampleGateway(ANCHOR);
		const req = searchRequest({ kind: 'zip', zipCode: '74201' });
		const [first] = await sampleRows(gateway, req);
		const found = await gateway.peekListingById(first.id);
		expect(found?.listing.id).toBe(first.id);
		expect(found?.provenance.source).toBe('sample');
		expect(await gateway.estimateCost(req)).toEqual({ calls: 0, reason: 'sample' });
		expect(calls).toHaveLength(0);
	});

	it.each(SAMPLE_METROS.map((m) => [m.label, m] as const))(
		'%s still has rows listed within 7 days 400 days after the fixture anchor',
		async (_, metro) => {
			const now = ANCHOR + 400 * DAY;
			const { gateway, calls } = await sampleGateway(now);
			const rows = await sampleRows(
				gateway,
				searchRequest({ kind: 'city', city: metro.city, state: metro.state })
			);
			const fresh = applyFilters(rows, { ...DEFAULT_FILTERS, listedWithin: 7 }, new Date(now));
			expect(fresh.length).toBeGreaterThanOrEqual(1);
			expect(calls).toHaveLength(0);
		}
	);
});
