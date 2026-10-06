// Watched ZIPs (07-09, INV-05): cap of 5 enforced inside a transaction (two tabs cannot both add a
// sixth), duplicates and invalid ZIPs refused, unwatch tombstones only the watch row.
// fake-indexeddb with a fresh IDBFactory per test and an injected clock.
import { afterEach, describe, expect, it } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { MAX_WATCHED_ZIPS } from '@tran/core/markets';
import { TranDb } from '$lib/storage/db';
import { watchedZipId, watchedZipRecordSchema } from './watched-zip-record';
import { createWatchedZipsRepo } from './watchedZipsRepo';

const T0 = Date.parse('2026-10-15T12:00:00.000Z');

const dbs: TranDb[] = [];
afterEach(() => {
	for (const db of dbs.splice(0)) db.close();
});

function open(factory = new IDBFactory(), name = `t-${crypto.randomUUID()}`) {
	const db = new TranDb({ indexedDB: factory, IDBKeyRange }, name);
	dbs.push(db);
	return { db, factory, name };
}

function setup() {
	const env = open();
	let now = T0;
	const clock = () => now++;
	return { ...env, repo: createWatchedZipsRepo(env.db, clock), clock };
}

describe('watched ZIPs repository', () => {
	it('watches a ZIP, refuses a duplicate and an invalid ZIP', async () => {
		const { repo } = setup();
		expect(await repo.watchZip(' 79999 ')).toEqual({ ok: true, zip: '79999' });
		expect(await repo.watchZip('79999')).toEqual({ ok: false, error: 'duplicate' });
		expect(await repo.watchZip('7999')).toEqual({ ok: false, error: 'invalid' });
		expect(await repo.watchZip('00000')).toEqual({ ok: false, error: 'invalid' });
		expect((await repo.listWatchedZips()).map((z) => z.zip)).toEqual(['79999']);
	});

	it('stores a valid Syncable row keyed by the ZIP-derived id, deletedAt omitted', async () => {
		const { db, repo } = setup();
		await repo.watchZip('79999');
		const row = await db.watchedZips.get(watchedZipId('79999'));
		expect(row).toBeDefined();
		expect(watchedZipRecordSchema.safeParse(row).success).toBe(true);
		expect('deletedAt' in row!).toBe(false);
		expect(row?.addedAt).toBe(T0);
	});

	it('caps the list at 5 and lists oldest first', async () => {
		const { repo } = setup();
		const zips = ['79991', '79992', '79993', '79994', '79995'];
		for (const z of zips) expect((await repo.watchZip(z)).ok).toBe(true);
		expect(MAX_WATCHED_ZIPS).toBe(5);
		expect(await repo.watchZip('79996')).toEqual({ ok: false, error: 'limit' });
		expect((await repo.listWatchedZips()).map((z) => z.zip)).toEqual(zips);
	});

	it('two concurrent watches with 4 stored: exactly one succeeds (transaction re-reads)', async () => {
		const { repo } = setup();
		for (const z of ['79991', '79992', '79993', '79994']) await repo.watchZip(z);
		const results = await Promise.all([repo.watchZip('79995'), repo.watchZip('79996')]);
		expect(results.filter((r) => r.ok)).toHaveLength(1);
		expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, error: 'limit' }]);
		expect(await repo.listWatchedZips()).toHaveLength(5);
	});

	it('two tabs (two connections to one database) cannot both add the fifth ZIP', async () => {
		const a = open();
		const b = open(a.factory, a.name);
		const tabA = createWatchedZipsRepo(a.db, () => T0);
		const tabB = createWatchedZipsRepo(b.db, () => T0 + 1);
		for (const z of ['79991', '79992', '79993', '79994']) await tabA.watchZip(z);
		const results = await Promise.all([tabA.watchZip('79995'), tabB.watchZip('79996')]);
		expect(results.filter((r) => r.ok)).toHaveLength(1);
		expect(await tabB.listWatchedZips()).toHaveLength(5);
	});

	it('unwatch tombstones only the watch row; the market-stats cache is untouched', async () => {
		const { db, repo } = setup();
		await repo.watchZip('79999');
		const cacheKey = 'markets?dataType=All&historyRange=24&zipCode=79999';
		await db.apiCache.put({ key: cacheKey } as never);
		await repo.unwatchZip('79999');
		expect(await repo.listWatchedZips()).toEqual([]);
		expect((await db.watchedZips.get(watchedZipId('79999')))?.deletedAt).toBeDefined();
		expect(await db.apiCache.get(cacheKey)).toEqual({ key: cacheKey });
		await repo.unwatchZip('12345'); // not watched: no-op
	});

	it('re-watching restores the row (same id, createdAt kept, deletedAt removed)', async () => {
		const { db, repo } = setup();
		await repo.watchZip('79999');
		const first = await db.watchedZips.get(watchedZipId('79999'));
		await repo.unwatchZip('79999');
		expect(await repo.watchZip('79999')).toEqual({ ok: true, zip: '79999' });
		const again = await db.watchedZips.get(watchedZipId('79999'));
		expect(again?.createdAt).toBe(first?.createdAt);
		expect('deletedAt' in again!).toBe(false);
		expect(again!.addedAt).toBeGreaterThan(first!.addedAt);
		expect(await repo.listWatchedZips()).toHaveLength(1);
	});
});
