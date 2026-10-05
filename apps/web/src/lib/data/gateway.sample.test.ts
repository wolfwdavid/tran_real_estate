// Sample (demo) mode end to end over the committed synthetic fixtures (DATA-01, DATA-04):
// the real RentCast client, schemas and mappers run over the fixture fetch, every result is badged
// 'sample', and nothing is fetched, metered or cached. Pitfall 4: a sample search never leaks into
// the live gateway's cache.
import { describe, expect, it } from 'vitest';
import { isGatewayError, type DataRequest } from '@tran/core/request';
import type { Listing } from '@tran/core/listings';
import estimates from './fixtures/estimates.json';
import markets from './fixtures/markets.json';
import meta from './fixtures/meta.json';
import metros from './fixtures/metros.json';
import rentalsJson from './fixtures/rentals.json';
import sales from './fixtures/sales.json';
import type { FixtureSet } from './fixtures/fixture-fetch';
import { createDataGateway, createSampleGateway, ReactiveSpendError } from './gateway';
import { createLedgerRepo } from './ledger-repo';
import type { DataDb } from './platform';
import { createCacheRepo } from './cache-repo';
import { createRentCastClient } from './rentcast/client';
import { jsonResponse, makeDb, spyFetch, T0 } from './testing/harness';
import { listingRows, makeGateway, rentals } from './testing/gateway-harness';

/** Same shape loadFixtureSet() returns, imported statically. */
const FIXTURES = {
	meta,
	metros,
	rentals: rentalsJson,
	sales,
	estimates,
	markets
} as unknown as FixtureSet;

type Row = Record<string, unknown>;

const FIXTURE_RENTAL_ID = String(
	(rentalsJson as Row[]).find((r) => r.zipCode === '74201' && r.status === 'Active')!.id
);
/** A sale-listing address with both a rent and a value estimate in the fixtures. */
const SUBJECT_ADDRESS = (() => {
	const rent = new Set(estimates.rent.map((e) => e.formattedAddress));
	const value = new Set(estimates.sale.map((e) => e.formattedAddress));
	const row = (sales as Row[]).find(
		(s) => rent.has(s.formattedAddress as string) && value.has(s.formattedAddress as string)
	);
	return String(row!.formattedAddress);
})();

const saleListings = (zip: string): DataRequest => ({
	endpoint: 'sale-listings',
	params: { zipCode: zip, status: 'Active', limit: 500, offset: 0 }
});
const rentEstimate = (address: string): DataRequest => ({
	endpoint: 'rent-estimate',
	params: { address }
});
const valueEstimate = (address: string): DataRequest => ({
	endpoint: 'value-estimate',
	params: { address }
});
const marketStats = (zip: string): DataRequest => ({
	endpoint: 'markets',
	params: { zipCode: zip, dataType: 'All', historyRange: 12 }
});

const ALL_SIX = (): [string, DataRequest][] => [
	['rentals', rentals('74201')],
	['sale listings', saleListings('70201')],
	['rental listing by id', { endpoint: 'rental-listing-by-id', params: { id: FIXTURE_RENTAL_ID } }],
	['rent estimate', rentEstimate(SUBJECT_ADDRESS)],
	['value estimate', valueEstimate(SUBJECT_ADDRESS)],
	['market stats', marketStats('85801')]
];

/** A live-network stand-in: any call here would be a real RentCast request. */
const liveSpy = () => spyFetch(() => jsonResponse(200, listingRows(3)));

function setup(opts: { db?: DataDb; reactive?: () => boolean } = {}) {
	const db = opts.db ?? makeDb();
	const spy = liveSpy();
	const clock = () => T0;
	const ledger = createLedgerRepo(db, clock);
	const gateway = createSampleGateway({
		fixtures: FIXTURES,
		ledger,
		clock,
		probeFetch: spy.fetch,
		reactiveGuard: opts.reactive
	});
	return { db, spy, gateway, ledger };
}

const errorOf = async (p: Promise<unknown>) => {
	try {
		await p;
	} catch (e) {
		return e;
	}
	throw new Error('expected a rejection');
};

const nonEmpty = (data: unknown): boolean =>
	Array.isArray(data)
		? data.length > 0
		: typeof data === 'object' && data !== null && Object.keys(data).length > 0;

describe('sample gateway: every endpoint from fixtures', () => {
	it('reports source sample', () => {
		expect(setup().gateway.source).toBe('sample');
	});

	it.each(ALL_SIX())('%s resolves with badged, non-empty sample data', async (_, req) => {
		const { gateway } = setup();
		const result = await gateway.get(req);
		expect(result.provenance).toEqual({ source: 'sample', fetchedAt: T0, stale: false });
		expect(nonEmpty(result.data)).toBe(true);
		expect(result.droppedRows).toBe(0);
	});

	it('rentals parse with 0 dropped rows and map to sample listings in the ZIP', async () => {
		const { gateway } = setup();
		const result = await gateway.get<Listing[]>(rentals('74201'));
		expect(result.droppedRows).toBe(0);
		expect(result.data.length).toBeGreaterThan(0);
		expect(result.data.every((l) => l.zipCode === '74201')).toBe(true);
	});

	it('after all six: 0 live fetches, 0 ledger rows, 0 cache rows', async () => {
		const { gateway, spy, db } = setup();
		for (const [, req] of ALL_SIX()) await gateway.get(req);
		await gateway.refresh(rentals('74201'));
		await gateway.rentalListingById(FIXTURE_RENTAL_ID);
		expect(spy.calls).toHaveLength(0);
		expect(await db.ledger.count()).toBe(0);
		expect(await db.apiCache.count()).toBe(0);
		expect((await gateway.usage()).used).toBe(0);
	});

	it('rentalListingById returns the fixture listing badged sample', async () => {
		const { gateway } = setup();
		const result = await gateway.rentalListingById(FIXTURE_RENTAL_ID);
		expect(result.data.id).toBe(FIXTURE_RENTAL_ID);
		expect(result.provenance.source).toBe('sample');
	});
});

describe('sample gateway: free reads and cost', () => {
	it('peek serves fixture data for free', async () => {
		const { gateway, spy, db } = setup();
		const peeked = await gateway.peek<Listing[]>(rentals('74201'));
		expect(peeked?.kind).toBe('data');
		if (peeked?.kind !== 'data') throw new Error('unreachable');
		expect(peeked.result.data.length).toBeGreaterThan(0);
		expect(peeked.result.provenance.source).toBe('sample');
		expect(spy.calls).toHaveLength(0);
		expect(await db.apiCache.count()).toBe(0);
	});

	it('peek reports an out-of-coverage location as an error result', async () => {
		const { gateway } = setup();
		const peeked = await gateway.peek(rentals('78701'));
		expect(peeked?.kind).toBe('error');
		if (peeked?.kind !== 'error') throw new Error('unreachable');
		expect(peeked.error.detail).toBe('outside-sample-coverage');
	});

	it('estimateCost and estimateBatchCost are 0 calls, reason sample', async () => {
		const { gateway } = setup();
		expect(await gateway.estimateCost(rentals('74201'))).toEqual({ calls: 0, reason: 'sample' });
		expect(await gateway.estimateBatchCost(ALL_SIX().map(([, r]) => r))).toEqual({
			calls: 0,
			reason: 'sample'
		});
	});

	it('peekListingById finds a fixture listing badged sample', async () => {
		const { gateway } = setup();
		const found = await gateway.peekListingById(FIXTURE_RENTAL_ID);
		expect(found?.listing.id).toBe(FIXTURE_RENTAL_ID);
		expect(found?.provenance.source).toBe('sample');
		expect(await gateway.peekListingById('SAMPLE-UNKNOWN-R999')).toBeUndefined();
	});
});

describe('sample gateway: errors', () => {
	it("a location outside the sample metros is NoResults 'outside-sample-coverage'", async () => {
		const { gateway, spy } = setup();
		const err = await errorOf(gateway.get(rentals('78701')));
		expect(isGatewayError(err)).toBe(true);
		if (!isGatewayError(err)) throw err;
		expect(err.kind).toBe('NoResults');
		expect(err.detail).toBe('outside-sample-coverage');
		expect(err.provenance?.source).toBe('sample');
		expect(spy.calls).toHaveLength(0);
	});

	it('an unknown listing id is NoResults', async () => {
		const { gateway } = setup();
		const err = await errorOf(gateway.rentalListingById('unknown'));
		expect(isGatewayError(err) && err.kind).toBe('NoResults');
	});

	it('a reactive context rejects get/refresh/rentalListingById with ReactiveSpendError', async () => {
		const { gateway } = setup({ reactive: () => true });
		await expect(gateway.get(rentals('74201'))).rejects.toBeInstanceOf(ReactiveSpendError);
		await expect(gateway.refresh(rentals('74201'))).rejects.toBeInstanceOf(ReactiveSpendError);
		await expect(gateway.rentalListingById(FIXTURE_RENTAL_ID)).rejects.toBeInstanceOf(
			ReactiveSpendError
		);
		// peek stays free and allowed in views.
		expect((await gateway.peek(rentals('74201')))?.kind).toBe('data');
	});
});

describe('sample gateway: grants and key test', () => {
	it('grantOverCap binds to the canonical request key', () => {
		const { gateway } = setup();
		const grant = gateway.grantOverCap(rentals('74201'));
		expect(grant).toBeDefined();
	});

	it('testKey always probes RentCast via probeFetch and meters it', async () => {
		const { gateway, spy, db } = setup();
		await gateway.testKey('test-key-not-real');
		expect(spy.calls).toHaveLength(1);
		expect(new URL(spy.calls[0]!.url).origin).toBe('https://api.rentcast.io');
		expect(await db.ledger.count()).toBe(1);
	});
});

describe('Pitfall 4: switching sample -> live never serves sample rows as live', () => {
	it('after a sample search on db D, the live gateway on D has nothing cached', async () => {
		const db = makeDb();
		const { gateway: sample } = setup({ db });
		const req = rentals('74201');
		await sample.get(req);
		expect(await sample.peek(req)).toBeDefined();

		const live = makeGateway({ fetch: liveSpy().fetch, clock: () => T0, db });
		expect(await live.gateway.peek(req)).toBeUndefined();
		expect(await live.gateway.estimateCost(req)).toEqual({ calls: 1, reason: 'network' });
		expect(await live.gateway.peekListingById(FIXTURE_RENTAL_ID)).toBeUndefined();
	});
});

describe('non-vacuity', () => {
	it('a wrongly wired sample client (live fetch instead of the fixture fetch) is caught', async () => {
		// Deliberately wrong wiring: the live gateway machinery pointed at the live spy. The "0 live
		// fetches" assertion above would go red for such a wiring.
		const db = makeDb();
		const spy = liveSpy();
		const wrong = createDataGateway({
			client: createRentCastClient({ fetch: spy.fetch, getKey: () => 'sample-mode' }),
			cache: createCacheRepo(db),
			ledger: createLedgerRepo(db, () => T0),
			clock: () => T0,
			probeFetch: spy.fetch
		});
		await wrong.get(rentals('74201'));
		expect(() => expect(spy.calls).toHaveLength(0)).toThrow();
		expect(spy.calls.length).toBeGreaterThan(0);
		expect(await db.apiCache.count()).toBeGreaterThan(0);
		expect(await db.ledger.count()).toBeGreaterThan(0);
	});
});
