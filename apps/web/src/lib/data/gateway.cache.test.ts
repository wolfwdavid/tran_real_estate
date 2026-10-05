// Cache-first reads, honest "as of" stamps, in-flight dedupe, refresh, negative caching, peek,
// by-id reads, truncation and the reactive-context guard (DATA-02, DATA-04).
import { describe, expect, expectTypeOf, it } from 'vitest';
import { HOUR_MS, DAY_MS, isGatewayError, type DataRequest } from '@tran/core/request';
import type { Listing, ListingsRequest } from '@tran/core/listings';
import { ReactiveSpendError } from './gateway';
import { jsonResponse, spyFetch, T0 } from './testing/harness';
import { listingRows, makeGateway, rentals } from './testing/gateway-harness';

const kindOf = async (p: Promise<unknown>): Promise<string> => {
	try {
		await p;
		return 'ok';
	} catch (e) {
		if (isGatewayError(e)) return e.kind;
		if (e instanceof ReactiveSpendError) return 'ReactiveSpendError';
		throw e;
	}
};

/** Fetch that answers every listings request with `n` rows for the requested ZIP. */
function rowsFetch(n = 3) {
	return spyFetch((url) => {
		if (url.pathname.startsWith('/v1/listings/rental/long-term/')) {
			const id = decodeURIComponent(url.pathname.split('/').pop()!);
			return jsonResponse(200, { ...listingRows(1)[0], id });
		}
		return jsonResponse(200, listingRows(n, url.searchParams.get('zipCode') ?? '74201'));
	});
}

function setup(opts: { fetch?: ReturnType<typeof spyFetch>; reactive?: () => boolean } = {}) {
	let now = T0;
	const spy = opts.fetch ?? rowsFetch();
	const h = makeGateway({ fetch: spy.fetch, clock: () => now, reactiveGuard: opts.reactive });
	return {
		...h,
		spy,
		at: (t: number) => {
			now = t;
		}
	};
}

describe('gateway cache', () => {
	it('serves an identical repeat from cache with the ORIGINAL fetchedAt', async () => {
		const { gateway, spy, at } = setup();
		const first = await gateway.get<Listing[]>(rentals('74201'));
		expect(spy.calls).toHaveLength(1);
		expect(first.data).toHaveLength(3);
		expect(first.provenance).toEqual({ source: 'rentcast', fetchedAt: T0, stale: false });

		at(T0 + HOUR_MS);
		const second = await gateway.get<Listing[]>(rentals('74201'));
		expect(spy.calls).toHaveLength(1);
		expect(second.provenance.fetchedAt).toBe(T0);
		// Mutation guard: a hit must not restamp fetchedAt with the current clock.
		expect(second.provenance.fetchedAt).not.toBe(T0 + HOUR_MS);
		expect(second.provenance.stale).toBe(false);
		expect(second.provenance.source).toBe('rentcast');
		expect(second.requestKey).toBe(first.requestKey);
		expect(second.data).toEqual(first.data);
	});

	it('treats reordered params plus suppressLogging as the same request', async () => {
		const { gateway, spy } = setup();
		await gateway.get(rentals('74201'));
		const reordered: DataRequest = {
			endpoint: 'rental-listings',
			params: { offset: 0, limit: 500, suppressLogging: true, status: 'Active', zipCode: '74201' }
		};
		await gateway.get(reordered);
		expect(spy.calls).toHaveLength(1);
	});

	it('dedupes two concurrent identical gets into 1 fetch and 1 ledger row', async () => {
		const { gateway, spy, db } = setup();
		const [a, b] = await Promise.all([
			gateway.get(rentals('74201')),
			gateway.get(rentals('74201'))
		]);
		expect(spy.calls).toHaveLength(1);
		expect(await db.ledger.count()).toBe(1);
		expect(a.provenance.fetchedAt).toBe(T0);
		expect(b.provenance.fetchedAt).toBe(T0);
	});

	it('marks a 24h-old entry stale in peek and spends 1 call on get', async () => {
		const { gateway, spy, at } = setup();
		await gateway.get(rentals('74201'));
		at(T0 + DAY_MS);
		const peeked = await gateway.peek(rentals('74201'));
		expect(peeked?.kind).toBe('data');
		expect(peeked?.kind === 'data' && peeked.result.provenance).toEqual({
			source: 'rentcast',
			fetchedAt: T0,
			stale: true
		});
		expect(spy.calls).toHaveLength(1);
		const fresh = await gateway.get(rentals('74201'));
		expect(spy.calls).toHaveLength(2);
		expect(fresh.provenance).toEqual({ source: 'rentcast', fetchedAt: T0 + DAY_MS, stale: false });
	});

	it('refresh bypasses a fresh entry, costs 1 call and restamps fetchedAt', async () => {
		const { gateway, spy, at, db } = setup();
		await gateway.get(rentals('74201'));
		at(T0 + HOUR_MS);
		const refreshed = await gateway.refresh(rentals('74201'));
		expect(spy.calls).toHaveLength(2);
		expect(refreshed.provenance.fetchedAt).toBe(T0 + HOUR_MS);
		const rows = await db.ledger.toArray();
		expect(rows.map((r) => r.intent).sort()).toEqual(['refresh', 'user']);
		const after = await gateway.get(rentals('74201'));
		expect(after.provenance.fetchedAt).toBe(T0 + HOUR_MS);
		expect(spy.calls).toHaveLength(2);
	});

	it('negative-caches a 404 for 24h', async () => {
		const spy = spyFetch(() => jsonResponse(404, { error: 'not-found' }));
		const { gateway, at } = setup({ fetch: spy });
		expect(await kindOf(gateway.get(rentals('74201')))).toBe('NoResults');
		expect(spy.calls).toHaveLength(1);
		at(T0 + HOUR_MS);
		expect(await kindOf(gateway.get(rentals('74201')))).toBe('NoResults');
		expect(spy.calls).toHaveLength(1);
		at(T0 + DAY_MS);
		expect(await kindOf(gateway.get(rentals('74201')))).toBe('NoResults');
		expect(spy.calls).toHaveLength(2);
	});

	it('negative-caches a 400 as NoResults bad-request', async () => {
		const spy = spyFetch(() => jsonResponse(400, { error: 'bad' }));
		const { gateway } = setup({ fetch: spy });
		const err = await gateway.get(rentals('74201')).catch((e: unknown) => e);
		expect(isGatewayError(err) && [err.kind, err.detail]).toEqual(['NoResults', 'bad-request']);
		const again = await gateway.get(rentals('74201')).catch((e: unknown) => e);
		expect(isGatewayError(again) && [again.kind, again.detail]).toEqual([
			'NoResults',
			'bad-request'
		]);
		expect(spy.calls).toHaveLength(1);
	});
});

describe('gateway peek', () => {
	it('returns undefined on an empty cache and never spends', async () => {
		const { gateway, spy, db } = setup();
		expect(await gateway.peek(rentals('74201'))).toBeUndefined();
		expect(spy.calls).toHaveLength(0);
		expect(await db.ledger.count()).toBe(0);
	});

	it('returns the cached error after a 404', async () => {
		const spy = spyFetch(() => jsonResponse(404, {}));
		const { gateway } = setup({ fetch: spy });
		await gateway.get(rentals('74201')).catch(() => undefined);
		const peeked = await gateway.peek(rentals('74201'));
		expect(peeked?.kind).toBe('error');
		expect(peeked?.kind === 'error' && peeked.error.kind).toBe('NoResults');
		expect(spy.calls).toHaveLength(1);
	});

	it('peekListingById finds a row inside a cached search response for 0 calls', async () => {
		const { gateway, spy, at } = setup();
		await gateway.get(rentals('74201'));
		at(T0 + HOUR_MS);
		const hit = await gateway.peekListingById('SAMPLE-74201-R002');
		expect(hit?.listing.id).toBe('SAMPLE-74201-R002');
		expect(hit?.provenance).toEqual({ source: 'rentcast', fetchedAt: T0, stale: false });
		expect(await gateway.peekListingById('SAMPLE-99999-R001')).toBeUndefined();
		expect(spy.calls).toHaveLength(1);
	});
});

describe('gateway rentalListingById', () => {
	it('spends 1 call on the by-id path, then serves the repeat from cache', async () => {
		const { gateway, spy } = setup();
		const first = await gateway.rentalListingById('SAMPLE-74201-R001');
		expect(spy.calls).toHaveLength(1);
		expect(new URL(spy.calls[0]!.url).pathname).toBe(
			'/v1/listings/rental/long-term/SAMPLE-74201-R001'
		);
		expect(first.data.id).toBe('SAMPLE-74201-R001');
		const again = await gateway.rentalListingById('SAMPLE-74201-R001');
		expect(spy.calls).toHaveLength(1);
		expect(again.data.id).toBe('SAMPLE-74201-R001');
	});
});

describe('gateway truncation', () => {
	const limited = (limit: number): DataRequest => ({
		endpoint: 'rental-listings',
		params: { zipCode: '74201', status: 'Active', limit, offset: 0 }
	});

	it('flags a response with exactly `limit` rows as truncated', async () => {
		const { gateway } = setup({ fetch: rowsFetch(3) });
		expect((await gateway.get(limited(3))).truncated).toBe(true);
	});

	it('does not flag a shorter response', async () => {
		const { gateway } = setup({ fetch: rowsFetch(2) });
		const result = await gateway.get(limited(3));
		expect(result.truncated).toBe(false);
		expect(result.droppedRows).toBe(0);
	});

	it('keeps the truncated flag on a cache hit', async () => {
		const { gateway, spy } = setup({ fetch: rowsFetch(3) });
		await gateway.get(limited(3));
		expect((await gateway.get(limited(3))).truncated).toBe(true);
		expect(spy.calls).toHaveLength(1);
	});
});

describe('gateway reactive guard', () => {
	it('rejects spends from a tracking context before any I/O; peek still works', async () => {
		const { gateway, spy, db } = setup({ reactive: () => true });
		expect(await kindOf(gateway.get(rentals('74201')))).toBe('ReactiveSpendError');
		expect(await kindOf(gateway.refresh(rentals('74201')))).toBe('ReactiveSpendError');
		expect(await kindOf(gateway.rentalListingById('SAMPLE-74201-R001'))).toBe('ReactiveSpendError');
		expect(spy.calls).toHaveLength(0);
		expect(await db.ledger.count()).toBe(0);
		expect(await gateway.peek(rentals('74201'))).toBeUndefined();
	});

	it('explains how to read instead', () => {
		expect(new ReactiveSpendError().message).toMatch(/gateway\.peek\(\)/);
	});
});

describe('request types', () => {
	it('ListingsRequest is assignable to DataRequest', () => {
		expectTypeOf<ListingsRequest>().toMatchTypeOf<DataRequest>();
	});
});
