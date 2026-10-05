// Saved-search repository: Syncable rows, transactional claims, snapshot + lastRunAt in one write.
// The cross-connection claim test is the two-tab guard: it fails if claim() reads the row outside
// the read-write transaction that sets claimedAt (mutation proof recorded in 04-19-SUMMARY.md).
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SyncableSchema } from '@tran/core';
import { CLAIM_TTL_MS, DUE_AFTER_MS } from '@tran/core/alerts';
import { createDataDb, type DataDb } from './platform';
import { createSavedSearchRepo } from './saved-search-repo';
import { makeDb, T0 } from './testing/harness';

const HOUR = 3_600_000;

const open: DataDb[] = [];
afterEach(() => {
	for (const db of open.splice(0)) db.close();
});

const input = (zip = '74201') => ({
	portal: 'renter' as const,
	name: `Rentals in ${zip}`,
	endpoint: 'rental-listings' as const,
	params: { zipCode: zip, status: 'Active', limit: 500, offset: 0 }
});

function setup() {
	let now = T0;
	const db = makeDb();
	open.push(db);
	const repo = createSavedSearchRepo(db, () => now);
	return {
		db,
		repo,
		at: (t: number) => {
			now = t;
		}
	};
}

const snap = (takenAt: number, ids: string[] = []) => ({
	takenAt,
	truncated: false,
	items: Object.fromEntries(
		ids.map((id) => [
			id,
			{ price: 1500, status: 'Active', removedDate: null, firstSeenAt: takenAt }
		])
	)
});

describe('create and list', () => {
	it('creates a Syncable row that has never run and was seen now', async () => {
		const { repo } = setup();
		const row = await repo.create(input());
		expect(SyncableSchema.safeParse(row).success).toBe(true);
		expect(row).toMatchObject({
			portal: 'renter',
			endpoint: 'rental-listings',
			lastRunAt: null,
			lastSeenAt: T0,
			claimedAt: null
		});
		expect(row.deletedAt).toBeUndefined();
		expect(await repo.list()).toEqual([row]);
	});

	it('copies the params so later caller mutation does not leak in', async () => {
		const { repo } = setup();
		const i = input();
		const row = await repo.create(i);
		i.params.zipCode = '99999';
		expect((await repo.list())[0]!.params.zipCode).toBe('74201');
		expect(row.params.zipCode).toBe('74201');
	});
});

describe('claim', () => {
	it('claims a due, unclaimed row once; a second claim within the TTL fails', async () => {
		const { repo, db, at } = setup();
		const { id } = await repo.create(input());
		expect(await repo.claim(id)).toBe(true);
		expect((await db.savedSearches.get(id))!.claimedAt).toBe(T0);
		at(T0 + CLAIM_TTL_MS - 1);
		expect(await repo.claim(id)).toBe(false);
		at(T0 + CLAIM_TTL_MS);
		expect(await repo.claim(id)).toBe(true);
		expect((await db.savedSearches.get(id))!.claimedAt).toBe(T0 + CLAIM_TTL_MS);
	});

	it('refuses a row that ran an hour ago (not due)', async () => {
		const { repo, at } = setup();
		const { id } = await repo.create(input());
		expect(await repo.claim(id)).toBe(true);
		await repo.complete(id, snap(T0));
		at(T0 + HOUR);
		expect(await repo.claim(id)).toBe(false);
		at(T0 + DUE_AFTER_MS);
		expect(await repo.claim(id)).toBe(true);
	});

	it('refuses unknown and tombstoned rows', async () => {
		const { repo } = setup();
		expect(await repo.claim(crypto.randomUUID())).toBe(false);
		const { id } = await repo.create(input());
		await repo.remove(id);
		expect(await repo.claim(id)).toBe(false);
	});

	it('two connections (two tabs) claiming the same row: exactly one wins, over 20 races', async () => {
		for (let i = 0; i < 20; i++) {
			const indexedDB = new IDBFactory();
			const name = `claim-${crypto.randomUUID()}`;
			const dbA = createDataDb({ name, indexedDB, IDBKeyRange });
			const dbB = createDataDb({ name, indexedDB, IDBKeyRange });
			open.push(dbA, dbB);
			const a = createSavedSearchRepo(dbA, () => T0);
			const b = createSavedSearchRepo(dbB, () => T0);
			const { id } = await a.create(input());
			await dbB.open();
			const results = await Promise.all([a.claim(id), b.claim(id)]);
			expect(results.filter(Boolean)).toHaveLength(1);
		}
	});
});

describe('complete, release, markSeen, snapshot, remove', () => {
	it('complete writes the snapshot and sets lastRunAt = takenAt with the claim cleared', async () => {
		const { repo, db, at } = setup();
		const { id } = await repo.create(input());
		await repo.claim(id);
		at(T0 + 5_000);
		await repo.complete(id, snap(T0 + 4_000, ['L1', 'L2']));
		const row = (await db.savedSearches.get(id))!;
		expect(row.lastRunAt).toBe(T0 + 4_000);
		expect(row.claimedAt).toBeNull();
		expect(row.updatedAt).toBe(new Date(T0 + 5_000).toISOString());
		const s = (await repo.snapshot(id))!;
		expect(s.searchId).toBe(id);
		expect(s.id).toBe(id);
		expect(SyncableSchema.safeParse(s).success).toBe(true);
		expect(Object.keys(s.items)).toEqual(['L1', 'L2']);
		expect(s.takenAt).toBe(T0 + 4_000);
	});

	it('a rewritten snapshot keeps its createdAt and bumps updatedAt', async () => {
		const { repo, at } = setup();
		const { id } = await repo.create(input());
		await repo.claim(id);
		await repo.complete(id, snap(T0));
		at(T0 + DUE_AFTER_MS);
		await repo.claim(id);
		await repo.complete(id, snap(T0 + DUE_AFTER_MS, ['L9']));
		const s = (await repo.snapshot(id))!;
		expect(s.createdAt).toBe(new Date(T0).toISOString());
		expect(s.updatedAt).toBe(new Date(T0 + DUE_AFTER_MS).toISOString());
		expect(Object.keys(s.items)).toEqual(['L9']);
	});

	it('complete is atomic: an unknown search writes no snapshot', async () => {
		const { repo, db } = setup();
		const ghost = crypto.randomUUID();
		await repo.complete(ghost, snap(T0, ['L1']));
		expect(await db.searchSnapshots.count()).toBe(0);
	});

	it('release clears the claim and leaves lastRunAt unchanged', async () => {
		const { repo, db } = setup();
		const { id } = await repo.create(input());
		await repo.claim(id);
		await repo.release(id);
		const row = (await db.savedSearches.get(id))!;
		expect(row.claimedAt).toBeNull();
		expect(row.lastRunAt).toBeNull();
		expect(await repo.claim(id)).toBe(true);
	});

	it('markSeen sets lastSeenAt = now', async () => {
		const { repo, db, at } = setup();
		const { id } = await repo.create(input());
		at(T0 + HOUR);
		await repo.markSeen(id);
		expect((await db.savedSearches.get(id))!.lastSeenAt).toBe(T0 + HOUR);
	});

	it('remove tombstones the row and list() no longer returns it', async () => {
		const { repo, db, at } = setup();
		const keep = await repo.create(input('74202'));
		const { id } = await repo.create(input());
		at(T0 + HOUR);
		await repo.remove(id);
		const row = (await db.savedSearches.get(id))!;
		expect(row.deletedAt).toBe(new Date(T0 + HOUR).toISOString());
		expect(row.updatedAt).toBe(row.deletedAt);
		expect((await repo.list()).map((r) => r.id)).toEqual([keep.id]);
	});

	it('snapshot() is undefined before the first run', async () => {
		const { repo } = setup();
		const { id } = await repo.create(input());
		expect(await repo.snapshot(id)).toBeUndefined();
	});
});
