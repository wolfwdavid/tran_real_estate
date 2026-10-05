// Response cache repository: lookups by canonical key, listing lookups by id, age-based pruning.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DAY_MS } from '@tran/core/request';
import type { DataDb } from './platform';
import type { ApiCacheRow } from './tables';
import { createCacheRepo, type CacheRepo } from './cache-repo';
import { T0, makeDb } from './testing/harness';

let db: DataDb;
let cache: CacheRepo;

beforeEach(() => {
	db = makeDb();
	cache = createCacheRepo(db);
});
afterEach(() => db.close());

const row = (over: Partial<ApiCacheRow> & Pick<ApiCacheRow, 'key'>): ApiCacheRow => ({
	endpoint: 'rental-listings',
	status: 200,
	body: [],
	fetchedAt: T0,
	truncated: false,
	droppedRows: 0,
	...over
});

describe('cache repo', () => {
	it('put then get round-trips by canonical key', async () => {
		const r = row({ key: 'rental-listings?zipCode=74201', body: [{ id: 'a' }] });
		await cache.put(r);
		expect(await cache.get(r.key)).toEqual(r);
		expect(await cache.get('missing')).toBeUndefined();
	});

	it('put replaces the row for the same key', async () => {
		await cache.put(row({ key: 'k', body: [1] }));
		await cache.put(row({ key: 'k', body: [2], fetchedAt: T0 + 1 }));
		expect((await cache.get('k'))?.body).toEqual([2]);
		expect(await db.apiCache.count()).toBe(1);
	});

	it('finds a listing inside a cached rental-listings body array', async () => {
		const item = { id: 'SAMPLE-74201-R001', price: 1500 };
		await cache.put(row({ key: 'r1', body: [{ id: 'other' }, item] }));
		const hit = await cache.findListingById('SAMPLE-74201-R001');
		expect(hit?.item).toEqual(item);
		expect(hit?.row.key).toBe('r1');
	});

	it('returns the newest row when two cached rows contain the listing', async () => {
		await cache.put(row({ key: 'old', body: [{ id: 'SAMPLE-74201-R001', price: 1400 }] }));
		await cache.put(
			row({
				key: 'new',
				fetchedAt: T0 + DAY_MS,
				body: [{ id: 'SAMPLE-74201-R001', price: 1500 }]
			})
		);
		const hit = await cache.findListingById('SAMPLE-74201-R001');
		expect(hit?.row.key).toBe('new');
		expect(hit?.item).toEqual({ id: 'SAMPLE-74201-R001', price: 1500 });
	});

	it('finds single-object rows (rental-listing-by-id) and sale listings', async () => {
		await cache.put(row({ key: 'one', endpoint: 'rental-listing-by-id', body: { id: 'L1' } }));
		await cache.put(row({ key: 'sale', endpoint: 'sale-listings', body: [{ id: 'S1' }] }));
		expect((await cache.findListingById('L1'))?.row.key).toBe('one');
		expect((await cache.findListingById('S1'))?.row.key).toBe('sale');
	});

	it('ignores other endpoints and unknown ids', async () => {
		await cache.put(row({ key: 'est', endpoint: 'rent-estimate', body: { id: 'E1' } }));
		await cache.put(row({ key: 'neg', status: 404, body: null }));
		expect(await cache.findListingById('E1')).toBeUndefined();
		expect(await cache.findListingById('nope')).toBeUndefined();
	});

	it('prune deletes rows older than 60 days and returns the count', async () => {
		await cache.put(row({ key: 'ancient', fetchedAt: T0 - 61 * DAY_MS }));
		await cache.put(row({ key: 'edge', fetchedAt: T0 - 60 * DAY_MS }));
		await cache.put(row({ key: 'fresh', fetchedAt: T0 - DAY_MS }));
		expect(await cache.prune(T0)).toBe(1);
		expect((await db.apiCache.toCollection().primaryKeys()).sort()).toEqual(['edge', 'fresh']);
		expect(await cache.prune(T0, DAY_MS / 2)).toBe(2);
	});
});
