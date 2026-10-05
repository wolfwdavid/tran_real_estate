// The renter portal's gateway contract (06-11, RENT-01/RENT-03): with the renter request builders,
// reading cached data (peek, peekListingById, estimateCost) spends 0 calls; get and
// rentalListingById spend exactly 1, and a repeat inside the TTL spends 0.
import { describe, expect, it } from 'vitest';
import { HOUR_MS } from '@tran/core/request';
import type { Listing } from '@tran/core/listings';
import { listingByIdRequest, searchRequest } from '$lib/features/renter/data/requests';
import { jsonResponse, spyFetch, T0 } from './testing/harness';
import { listingRows, makeGateway } from './testing/gateway-harness';

const ZIP = '74201';
const search = () => searchRequest({ kind: 'zip', zipCode: ZIP });

function setup() {
	let now = T0;
	const spy = spyFetch((url) => {
		if (url.pathname.startsWith('/v1/listings/rental/long-term/')) {
			const id = decodeURIComponent(url.pathname.split('/').pop()!);
			return jsonResponse(200, { ...listingRows(1)[0], id });
		}
		return jsonResponse(200, listingRows(3, url.searchParams.get('zipCode') ?? ZIP));
	});
	const h = makeGateway({ fetch: spy.fetch, clock: () => now });
	return {
		...h,
		spy,
		at: (t: number) => {
			now = t;
		}
	};
}

describe('renter gateway contract: 0-call reads', () => {
	it('peek before any spend returns undefined and fetches nothing', async () => {
		const { gateway, spy } = setup();
		expect(await gateway.peek(search())).toBeUndefined();
		expect(await gateway.estimateCost(search())).toEqual({ calls: 1, reason: 'network' });
		expect(spy.calls).toHaveLength(0);
	});

	it('after one get, peek / peekListingById / estimateCost all cost 0', async () => {
		const { gateway, spy, at } = setup();
		const first = await gateway.get<Listing[]>(search());
		expect(spy.calls).toHaveLength(1);
		const rowId = first.data[1].id;

		at(T0 + 2 * HOUR_MS);
		const peeked = await gateway.peek<Listing[]>(search());
		expect(peeked?.kind).toBe('data');
		if (peeked?.kind !== 'data') throw new Error('expected data');
		expect(peeked.result.data.map((l) => l.id)).toEqual(first.data.map((l) => l.id));
		expect(peeked.result.provenance.fetchedAt).toBe(T0);

		const byId = await gateway.peekListingById(rowId);
		expect(byId?.listing.id).toBe(rowId);
		expect(byId?.provenance.fetchedAt).toBe(T0);
		expect(await gateway.peekListingById('missing')).toBeUndefined();

		expect(await gateway.estimateCost(search())).toEqual({ calls: 0, reason: 'cached' });
		// Every read above was free: still exactly the one fetch from get().
		expect(spy.calls).toHaveLength(1);
	});

	it('the narrow request is its own cache entry (costs a call until fetched)', async () => {
		const { gateway, spy } = setup();
		await gateway.get(search());
		const narrow = searchRequest(
			{ kind: 'zip', zipCode: ZIP },
			{ priceMin: 1000, priceMax: 2000, beds: 'any', types: [], listedWithin: 'any' },
			'narrow'
		);
		expect(await gateway.estimateCost(narrow)).toEqual({ calls: 1, reason: 'network' });
		expect(spy.calls).toHaveLength(1);
	});
});

describe('renter gateway contract: rentalListingById', () => {
	it('spends exactly 1 call on the encoded by-id path, then 0 within 24h', async () => {
		const { gateway, spy, at } = setup();
		const id = 'A,1 b';
		const first = await gateway.rentalListingById(id);
		expect(spy.calls).toHaveLength(1);
		expect(new URL(spy.calls[0].url).pathname).toBe(
			`/v1/listings/rental/long-term/${encodeURIComponent(id)}`
		);
		expect(first.data.id).toBe(id);

		at(T0 + 23 * HOUR_MS);
		const again = await gateway.rentalListingById(id);
		expect(spy.calls).toHaveLength(1);
		expect(again.provenance.fetchedAt).toBe(T0);

		// The by-id cache entry is also what peekListingById reads, still free.
		expect((await gateway.peekListingById(id))?.listing.id).toBe(id);
		expect(await gateway.estimateCost(listingByIdRequest(id))).toEqual({
			calls: 0,
			reason: 'cached'
		});
		expect(spy.calls).toHaveLength(1);
	});

	it('peekListingById of a never-fetched id spends nothing', async () => {
		const { gateway, spy } = setup();
		expect(await gateway.peekListingById('SAMPLE-74201-R001')).toBeUndefined();
		expect(spy.calls).toHaveLength(0);
	});
});
