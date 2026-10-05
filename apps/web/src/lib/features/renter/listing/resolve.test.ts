// Listing detail resolution (06-14, RENT-03): `/renter/listing/?id=` finds its listing at 0 calls,
// in a fixed order (shortlist snapshot, then cached search rows or sample fixtures), and only the
// explicit "Look it up again (1 call)" action fetches by id. The gateways are the real ones, built
// through the public $lib/data port exactly as the page gets them; fetch is a recording stand-in.
import { afterEach, describe, expect, it } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import type { Listing } from '@tran/core/listings';
import { createDataRuntime, type DataGateway, type DataRuntime } from '$lib/data';
import { TranDb } from '$lib/storage/db';
import { createShortlistRepo } from '../storage/shortlist-repo';
import { searchRequest } from '../data/requests';
import { fetchListingById, resolveListing, type ResolveDeps } from './resolve';

const T0 = Date.parse('2026-10-03T12:00:00.000Z');
const FIXTURE_ID = 'SAMPLE-74201-R017';
const LIVE_ID = '100-Sample-Way,-Testville,-OK-74201';

const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const c of cleanups.splice(0)) c();
});

/** A schema-valid synthetic RentCast rental row (fictional address). */
function liveRow(id: string, price = 1500): Record<string, unknown> {
	return {
		id,
		price,
		status: 'Active',
		zipCode: '74201',
		formattedAddress: '100 Sample Way, Testville, OK 74201',
		addressLine1: '100 Sample Way',
		city: 'Testville',
		state: 'OK',
		propertyType: 'Single Family',
		bedrooms: 2,
		bathrooms: 1
	};
}

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});

/** Wraps a gateway so the test can see which read/spend methods were called. */
function spyGateway(gateway: DataGateway) {
	const calls: string[] = [];
	const wrapped: ResolveDeps['gateway'] = {
		peekListingById: (id) => {
			calls.push('peekListingById');
			return gateway.peekListingById(id);
		},
		rentalListingById: (id, opts) => {
			calls.push('rentalListingById');
			return gateway.rentalListingById(id, opts);
		}
	};
	return { wrapped, calls };
}

async function setup(source: 'sample' | 'live', opts: { byIdStatus?: number } = {}) {
	const fetches: string[] = [];
	const db = new TranDb({ indexedDB: new IDBFactory(), IDBKeyRange }, `t-${crypto.randomUUID()}`);
	const runtime: DataRuntime = createDataRuntime({
		db,
		clock: () => T0,
		fetch: (async (input: RequestInfo | URL) => {
			const url = new URL(String(input));
			fetches.push(url.pathname);
			if (source === 'sample') throw new Error('network is off in sample mode');
			if (url.pathname.startsWith('/v1/listings/rental/long-term/')) {
				const id = decodeURIComponent(url.pathname.split('/').pop()!);
				return opts.byIdStatus === 404 ? json(404, {}) : json(200, liveRow(id));
			}
			return json(200, [liveRow('CACHED-74201-A1'), liveRow('CACHED-74201-A2', 1650)]);
		}) as typeof fetch,
		keys:
			source === 'live'
				? { get: () => 'test-key-not-real', state: () => 'available', onChange: () => () => {} }
				: { get: () => null, state: () => 'none', onChange: () => () => {} },
		channel: null,
		reactiveGuard: () => false
	});
	const stop = await runtime.start();
	cleanups.push(() => {
		stop();
		db.close();
	});
	expect(runtime.mode?.source).toBe(source === 'live' ? 'rentcast' : 'sample');
	const gateway = spyGateway(runtime.gateway as DataGateway);
	const shortlist = createShortlistRepo(db, () => T0);
	const deps: ResolveDeps = {
		shortlist,
		gateway: gateway.wrapped,
		mode: () => source
	};
	return { runtime, deps, shortlist, fetches, gatewayCalls: gateway.calls };
}

describe('resolveListing: id checks', () => {
	it('a missing id is missing-id, with no lookups', async () => {
		const { deps, fetches, gatewayCalls } = await setup('live');
		expect(await resolveListing(null, deps)).toEqual({ kind: 'missing-id' });
		expect(await resolveListing('', deps)).toEqual({ kind: 'missing-id' });
		expect(gatewayCalls).toEqual([]);
		expect(fetches).toEqual([]);
	});

	it('a malformed id is not-found and can never be fetched', async () => {
		const { deps, fetches, gatewayCalls } = await setup('live');
		expect(await resolveListing('<bad>', deps)).toEqual({ kind: 'not-found', canFetch: false });
		expect(await resolveListing('javascript:alert(1)', deps)).toEqual({
			kind: 'not-found',
			canFetch: false
		});
		expect(gatewayCalls).toEqual([]);
		expect(fetches).toEqual([]);
	});
});

describe('resolveListing: 0-call order', () => {
	it('a shortlisted listing resolves from its snapshot without asking the gateway', async () => {
		const { deps, shortlist, fetches, gatewayCalls } = await setup('live');
		const row = { ...liveRow('SHORT-1'), kind: 'rental', price: 1725 } as unknown as Listing;
		await shortlist.add(row, { source: 'rentcast', fetchedAt: T0 - 5000 });

		const r = await resolveListing('SHORT-1', deps);
		expect(r.kind).toBe('found');
		if (r.kind !== 'found') throw new Error('expected found');
		expect(r.source).toBe('shortlist');
		expect(r.row.id).toBe('SHORT-1');
		expect(r.row.price).toBe(1725);
		expect(r.provenance).toEqual({ source: 'rentcast', fetchedAt: T0 - 5000, stale: false });
		expect(gatewayCalls).toEqual([]);
		expect(fetches).toEqual([]);
	});

	it('a removed shortlist item no longer resolves from the shortlist', async () => {
		const { deps, shortlist, gatewayCalls } = await setup('live');
		await shortlist.add(liveRow('SHORT-2') as unknown as Listing, {
			source: 'rentcast',
			fetchedAt: T0
		});
		await shortlist.remove('SHORT-2');
		const r = await resolveListing('SHORT-2', deps);
		expect(r).toEqual({ kind: 'not-found', canFetch: true });
		expect(gatewayCalls).toEqual(['peekListingById']);
	});

	it('a listing in a cached search resolves from the cache at 0 calls', async () => {
		const { runtime, deps, fetches } = await setup('live');
		await runtime.requestSpend(searchRequest({ kind: 'zip', zipCode: '74201' }));
		expect(fetches).toHaveLength(1);

		const r = await resolveListing('CACHED-74201-A2', deps);
		expect(r.kind).toBe('found');
		if (r.kind !== 'found') throw new Error('expected found');
		expect(r.source).toBe('cache');
		expect(r.row.price).toBe(1650);
		expect(r.provenance.source).toBe('rentcast');
		expect(r.provenance.fetchedAt).toBe(T0);
		expect(fetches).toHaveLength(1);
	});

	it('sample mode resolves a fixture id from the sample data at 0 calls', async () => {
		const { deps, fetches } = await setup('sample');
		const r = await resolveListing(FIXTURE_ID, deps);
		expect(r.kind).toBe('found');
		if (r.kind !== 'found') throw new Error('expected found');
		expect(r.source).toBe('sample');
		expect(r.row.id).toBe(FIXTURE_ID);
		expect(r.provenance.source).toBe('sample');
		expect(fetches).toEqual([]);
	});

	it('sample mode: an unknown id is not-found and cannot be fetched', async () => {
		const { deps, fetches } = await setup('sample');
		expect(await resolveListing('SAMPLE-00000-R999', deps)).toEqual({
			kind: 'not-found',
			canFetch: false
		});
		expect(await fetchListingById('SAMPLE-00000-R999', deps)).toEqual({
			kind: 'not-found',
			canFetch: false
		});
		expect(fetches).toEqual([]);
	});

	it('live mode: an unknown valid-looking id is not-found but fetchable, and nothing is fetched', async () => {
		const { deps, fetches, gatewayCalls } = await setup('live');
		expect(await resolveListing(LIVE_ID, deps)).toEqual({ kind: 'not-found', canFetch: true });
		expect(gatewayCalls).toEqual(['peekListingById']);
		expect(fetches).toEqual([]);
	});
});

describe('fetchListingById: the one spending path', () => {
	it('spends exactly one call and returns the listing from the network', async () => {
		const { deps, fetches } = await setup('live');
		const r = await fetchListingById(LIVE_ID, deps);
		expect(fetches).toEqual([`/v1/listings/rental/long-term/${encodeURIComponent(LIVE_ID)}`]);
		expect(r.kind).toBe('found');
		if (r.kind !== 'found') throw new Error('expected found');
		expect(r.source).toBe('network');
		expect(r.row.id).toBe(LIVE_ID);
		expect(r.provenance.source).toBe('rentcast');

		// The fetched row is now cached: resolving again costs nothing.
		const again = await resolveListing(LIVE_ID, deps);
		expect(again.kind === 'found' && again.source).toBe('cache');
		expect(fetches).toHaveLength(1);
	});

	it('goes through the injected spend helper when one is given (cap prompts)', async () => {
		const { runtime, deps, fetches, gatewayCalls } = await setup('live');
		const spent: string[] = [];
		const r = await fetchListingById(LIVE_ID, {
			...deps,
			spend: (req) => {
				spent.push(req.endpoint);
				return runtime.requestSpend(req);
			}
		});
		expect(spent).toEqual(['rental-listing-by-id']);
		expect(gatewayCalls).not.toContain('rentalListingById');
		expect(fetches).toHaveLength(1);
		expect(r.kind === 'found' && r.source).toBe('network');
	});

	it('a 404 is not-found with a NoResults error and no second try', async () => {
		const { deps, fetches } = await setup('live', { byIdStatus: 404 });
		const r = await fetchListingById(LIVE_ID, deps);
		expect(fetches).toHaveLength(1);
		expect(r.kind).toBe('not-found');
		if (r.kind !== 'not-found') throw new Error('expected not-found');
		expect(r.canFetch).toBe(false);
		expect(r.error?.kind).toBe('NoResults');
	});

	it('never fetches a malformed id', async () => {
		const { deps, fetches } = await setup('live');
		expect(await fetchListingById('<bad>', deps)).toEqual({ kind: 'not-found', canFetch: false });
		expect(fetches).toEqual([]);
	});
});
