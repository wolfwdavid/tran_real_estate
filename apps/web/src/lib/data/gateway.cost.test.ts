// Cost estimates are priced from the cache only and never spend (DATA-04, DATA-05).
import { describe, expect, it } from 'vitest';
import { DAY_MS, HOUR_MS, type DataRequest } from '@tran/core/request';
import { jsonResponse, spyFetch, T0 } from './testing/harness';
import { listingRows, makeGateway, rentals } from './testing/gateway-harness';

function setup(status = 200) {
	let now = T0;
	const spy = spyFetch((url) =>
		status === 200
			? jsonResponse(200, listingRows(2, url.searchParams.get('zipCode') ?? '74201'))
			: jsonResponse(status, {})
	);
	const h = makeGateway({ fetch: spy.fetch, clock: () => now });
	return {
		...h,
		spy,
		at: (t: number) => {
			now = t;
		}
	};
}

/** `a` with its params in a different order: same canonical key. */
const reordered = (zip: string): DataRequest => ({
	endpoint: 'rental-listings',
	params: { offset: 0, limit: 500, status: 'Active', zipCode: zip }
});

describe('estimateCost', () => {
	it('prices an empty cache at 1 network call', async () => {
		const { gateway, spy } = setup();
		expect(await gateway.estimateCost(rentals('74201'))).toEqual({ calls: 1, reason: 'network' });
		expect(spy.calls).toHaveLength(0);
	});

	it('prices a fresh 200 at 0 cached', async () => {
		const { gateway, at } = setup();
		await gateway.get(rentals('74201'));
		at(T0 + HOUR_MS);
		expect(await gateway.estimateCost(rentals('74201'))).toEqual({ calls: 0, reason: 'cached' });
	});

	it('prices a fresh 404 at 0 cached', async () => {
		const { gateway, at } = setup(404);
		await gateway.get(rentals('74201')).catch(() => undefined);
		at(T0 + HOUR_MS);
		expect(await gateway.estimateCost(rentals('74201'))).toEqual({ calls: 0, reason: 'cached' });
	});

	it('prices a stale entry at 1 network call', async () => {
		const { gateway, at } = setup();
		await gateway.get(rentals('74201'));
		at(T0 + DAY_MS);
		expect(await gateway.estimateCost(rentals('74201'))).toEqual({ calls: 1, reason: 'network' });
	});

	it('does not price an unbilled failure as cached', async () => {
		const { gateway } = setup(503);
		await gateway.get(rentals('74201')).catch(() => undefined);
		expect(await gateway.estimateCost(rentals('74201'))).toEqual({ calls: 1, reason: 'network' });
	});
});

describe('estimateBatchCost', () => {
	it('counts unique uncached canonical keys', async () => {
		const { gateway, spy } = setup();
		const batch = [rentals('74201'), reordered('74201'), rentals('74202')];
		expect(await gateway.estimateBatchCost(batch)).toEqual({ calls: 2, reason: 'network' });
		await gateway.get(rentals('74201'));
		expect(await gateway.estimateBatchCost(batch)).toEqual({ calls: 1, reason: 'network' });
		await gateway.get(rentals('74202'));
		expect(await gateway.estimateBatchCost(batch)).toEqual({ calls: 0, reason: 'cached' });
		expect(spy.calls).toHaveLength(2);
	});

	it('prices an empty batch at 0', async () => {
		const { gateway } = setup();
		expect(await gateway.estimateBatchCost([])).toEqual({ calls: 0, reason: 'cached' });
	});
});
